// capturas de la escena para revisarlas a ojo (desarrollo).
//
//   node scripts/shot.mjs <url> <carpeta> <especificacion>...
//
// especificacion: modo:tema:camara:anchoxalto[:clave=valor...]
//   modo   ems | eds            tema   light | dark         camara   orbit chase section gap top field
//   claves: cam=x,y,z  tgt=x,y,z   (camara y objetivo a mano)  adv=s (segundos de viaje antes)
//           intro=t (apertura en el instante t, en s; la camara y el viaje se ignoran)
//           ui=0 (sin interfaz)   wait=ms   speed=m/s (velocidad visual del suelo)   parts=id (elige una pieza)
//
//   node scripts/shot.mjs http://127.0.0.1:5174/ /tmp/shots ems:dark:orbit:1920x918 eds:light:gap:1280x720:ui=0

import { chromium } from "playwright-core";
import { existsSync, mkdirSync } from "node:fs";

const args = process.argv.slice(2);
const URL_BASE = args.find((a) => a.startsWith("http")) ?? "http://127.0.0.1:5173/";
const rest = args.filter((a) => !a.startsWith("http"));
const OUT = rest.shift();
const CHROME =
  process.env.CHROME_PATH ??
  ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/usr/bin/chromium", "/usr/bin/google-chrome"].find((p) => existsSync(p));
if (!CHROME || !OUT || !rest.length) {
  console.error("uso: node scripts/shot.mjs <url> <carpeta> modo:tema:camara:AnchoxAlto[:clave=valor...] ...");
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--use-angle=swiftshader", "--hide-scrollbars"],
});

for (const spec of rest) {
  const [mode, theme, rig, size, ...kv] = spec.split(":");
  const opt = Object.fromEntries(kv.map((s) => s.split("=")));
  const [w, h] = size.split("x").map(Number);
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("excepcion: " + e));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push("consola: " + m.text()));
  await page.goto(URL_BASE, { waitUntil: "load", timeout: 120000 });
  await page.waitForFunction(() => window.__app, null, { timeout: 30000 });
  await page.evaluate(
    ([m, t, r, o]) => {
      const a = window.__app;
      document.documentElement.dataset.theme = t;
      a.world.setTheme(t);
      a.setMode(m);
      if (o.intro !== undefined) {
        a.intro.seek(Number(o.intro)); // la apertura en el instante t (s)
      } else {
        a.train.advance(Number(o.adv ?? (m === "ems" ? 80 : 150)));
        a.setRig(r, true);
      }
      const v = (s) => s.split(",").map(Number);
      if (o.cam) a.camera.position.set(...v(o.cam));
      if (o.tgt) a.controls.target.set(...v(o.tgt));
      if (o.cam || o.tgt) a.controls.update();
      if (o.speed !== undefined) window.__qaSpeed = Number(o.speed);
      if (o.parts) {
        a.setParts(true);
        a.selectPart(o.parts);
      }
    },
    [mode, theme, rig, opt],
  );
  await page.waitForTimeout(Number(opt.wait ?? 2500));
  if (opt.ui === "0") await page.addStyleTag({ content: "#ui,#cams,#hud,#side,#topbar,#toast,#hint{visibility:hidden !important}" });
  const name = `${mode}-${theme}-${rig}-${w}x${h}${kv.length ? "-" + kv.join("-").replace(/[^\w=.,-]/g, "") : ""}.png`;
  await page.screenshot({ path: `${OUT}/${name}`, timeout: 120000 });
  console.log(`${OUT}/${name}${errors.length ? "  ERRORES: " + errors.join(" | ") : ""}`);
  await page.close();
}
await browser.close();
