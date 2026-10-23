// qa visual: mide el parpadeo (aliasing temporal y z-fighting) de la escena.
//
//   npm run qa:visual                      contra http://127.0.0.1:5173/ (el servidor de desarrollo)
//   node scripts/visual-qa.mjs <url>       contra otra direccion
//   chrome_path=/ruta/a/chrome ...         navegador a usar
//
// para cada modo, tema, camara y velocidad visual toma dos fotogramas separados por un
// desplazamiento de pista de 0,37 m y mide la diferencia media de luminancia en la zona de
// suelo y via. un contenido liso cambia poco al moverse 37 cm; un patron fino que parpadea
// cambia mucho. sale con codigo 1 si algun caso supera el umbral.

import { chromium } from "playwright-core";
import { existsSync } from "node:fs";
import { PNG } from "pngjs";

const URL_BASE = process.argv.find((a) => a.startsWith("http")) ?? "http://127.0.0.1:5173/";
const CHROME =
  process.env.CHROME_PATH ??
  ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/usr/bin/chromium", "/usr/bin/google-chrome"].find((p) => existsSync(p));
const THRESHOLD = Number(process.env.QA_THRESHOLD ?? 6); // diferencia media maxima (0..255)
const SHIFT = 0.37; // m de pista entre los dos fotogramas

const VIEWS = {
  // [x, y, z] de la camara y [x, y, z] del objetivo
  orbit: { pos: [-26, 15, 96], target: [0, 6.5, 0] },
  rasante: { pos: [-60, 2.2, 30], target: [0, 4, 0] },
  lejos: { pos: [-150, 30, 200], target: [0, 5, 0] },
  cenital: { pos: [0, 108, 0.01], target: [0, 0, 0] },
};
const SPEEDS = (process.env.QA_SPEEDS ?? "0,100,480").split(",").map(Number); // m/s de velocidad visual: parado, 360 km/h a x1 y a x5
const MODES = (process.env.QA_MODES ?? "ems,eds").split(",");
const THEMES = (process.env.QA_THEMES ?? "light,dark").split(",");

if (!CHROME) {
  console.error("No encuentro Chrome: define CHROME_PATH.");
  process.exit(2);
}

const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];

function diff(a, b) {
  const A = PNG.sync.read(a), B = PNG.sync.read(b);
  // zona central y baja: suelo y via; se evita el borde superior (cielo)
  const x0 = Math.floor(A.width * 0.1), x1 = Math.floor(A.width * 0.9);
  const y0 = Math.floor(A.height * 0.45), y1 = Math.floor(A.height * 0.95);
  let sum = 0, n = 0;
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const i = (y * A.width + x) * 4;
      sum += Math.abs(lum(A.data, i) - lum(B.data, i));
      n++;
    }
  }
  return sum / n;
}

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--use-angle=swiftshader", "--hide-scrollbars"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("response", (r) => {
  if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
});
page.on("console", (m) => {
  if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text());
});
await page.goto(URL_BASE, { waitUntil: "load", timeout: 120000 });
await page.waitForFunction(() => window.__app, null, { timeout: 30000 });
await page.addStyleTag({ content: "#ui{display:none !important}" });

const settle = (ms) => page.waitForTimeout(ms);
const results = [];
for (const mode of MODES) {
  for (const theme of THEMES) {
    await page.evaluate(([m, t]) => {
      window.__app.setMode(m);
      document.documentElement.dataset.theme = t;
      window.__app.world?.setTheme?.(t);
      window.__app.train.advance(80);
      window.__app.view.paused = true;
    }, [mode, theme]);
    for (const [name, v] of Object.entries(VIEWS)) {
      for (const speed of SPEEDS) {
        await page.evaluate(([view, sp]) => {
          const a = window.__app;
          window.__qaSpeed = sp;
          a.view.layers.labels = false;
          a.view.layers.forces = false;
          a.camera.position.set(...view.pos);
          a.controls.target.set(...view.target);
          a.controls.update();
        }, [v, speed]);
        await settle(1500);
        const A = await page.screenshot({ type: "png" });
        await page.evaluate((d) => (window.__app.train.x += d), SHIFT);
        await settle(900);
        const B = await page.screenshot({ type: "png" });
        await page.evaluate((d) => (window.__app.train.x -= d), SHIFT);
        const d = diff(A, B);
        results.push({ mode, theme, view: name, speed, d });
        const flag = d > THRESHOLD ? "FALLA" : "ok";
        console.log(`${flag.padEnd(5)} ${mode} ${theme.padEnd(5)} ${name.padEnd(8)} v=${String(speed).padStart(3)} m/s  dif=${d.toFixed(2)}`);
      }
    }
  }
}
await browser.close();

const worst = results.reduce((a, b) => (b.d > a.d ? b : a));
console.log(`\npeor caso: ${worst.mode} ${worst.theme} ${worst.view} v=${worst.speed} dif=${worst.d.toFixed(2)} (umbral ${THRESHOLD})`);
if (errors.length) console.log("errores de consola:\n" + [...new Set(errors)].join("\n"));
process.exit(results.some((r) => r.d > THRESHOLD) || errors.length ? 1 : 0);
