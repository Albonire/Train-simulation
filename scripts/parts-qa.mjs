// qa del explorador de piezas: recorre secuencias de seleccion, separar, modos, temas y
// tamanos de ventana, y tras cada paso comprueba que la escena sigue viva:
//   - camara, objetivo y proyeccion finitos y a menos de 1000 m del origen
//   - el fotograma no es liso (un color uniforme es una escena vacia)
//   - se dibujo geometria (llamadas de dibujo del renderizador)
//   - cero errores de consola y excepciones de pagina
//
//   npm run qa:parts                       contra http://127.0.0.1:5173/
//   node scripts/parts-qa.mjs <url>        contra otra direccion
//   qa_modes=ems qa_themes=dark qa_sizes=1920x918 node scripts/parts-qa.mjs

import { chromium } from "playwright-core";
import { existsSync } from "node:fs";
import { PNG } from "pngjs";

const URL_BASE = process.argv.find((a) => a.startsWith("http")) ?? "http://127.0.0.1:5173/";
const CHROME =
  process.env.CHROME_PATH ??
  ["/opt/pw-browsers/chromium", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/usr/bin/chromium", "/usr/bin/google-chrome"].find((p) => existsSync(p));
const MODES = (process.env.QA_MODES ?? "ems,eds").split(",");
const THEMES = (process.env.QA_THEMES ?? "light,dark").split(",");
const SIZES = (process.env.QA_SIZES ?? "1920x918,390x844").split(",").map((s) => s.split("x").map(Number));
const SETTLE = Number(process.env.QA_SETTLE ?? 2600); // ms tras elegir una pieza
const MIN_STD = 4; // desviacion tipica minima de la luminancia (0..255)

if (!CHROME) {
  console.error("No encuentro Chrome: define CHROME_PATH.");
  process.exit(2);
}

function stats(buf) {
  const p = PNG.sync.read(buf);
  let sum = 0, sum2 = 0, n = 0;
  for (let i = 0; i < p.data.length; i += 16) {
    const l = 0.2126 * p.data[i] + 0.7152 * p.data[i + 1] + 0.0722 * p.data[i + 2];
    sum += l; sum2 += l * l; n++;
  }
  const m = sum / n;
  return { mean: m, std: Math.sqrt(Math.max(0, sum2 / n - m * m)) };
}

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--use-angle=swiftshader", "--hide-scrollbars"],
});

const failures = [];
let checks = 0;

async function run([w, h], mode, theme) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("excepcion: " + e));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("consola: " + m.text());
  });
  await page.goto(URL_BASE, { waitUntil: "load", timeout: 120000 });
  await page.waitForFunction(() => window.__app, null, { timeout: 30000 });
  await page.evaluate(([m, t, adv]) => {
    const a = window.__app;
    document.documentElement.dataset.theme = t;
    a.world.setTheme(t);
    a.setMode(m);
    a.train.advance(adv || (m === "ems" ? 80 : 150));
  }, [mode, theme, Number(process.env.QA_ADVANCE ?? 0)]);
  await page.waitForTimeout(800);

  const tag = `${mode} ${theme} ${w}x${h}`;
  const check = async (label) => {
    checks++;
    // se mide el lienzo sin interfaz; la tarjeta (capa superior) se oculta con #ui
    await page.addStyleTag({ content: "#ui{visibility:hidden !important}" }).catch(() => {});
    const info = await page.evaluate(() => {
      const a = window.__app;
      const fin = (v) => Number.isFinite(v);
      const c = a.camera, t = a.controls.target;
      const pm = c.projectionMatrix.elements;
      return {
        cam: [c.position.x, c.position.y, c.position.z],
        tgt: [t.x, t.y, t.z],
        proj: pm.every(fin),
        near: c.near,
        calls: a.renderer?.info?.render?.calls ?? -1,
        sel: document.getElementById("pcTitle")?.textContent ?? "",
      };
    });
    const png = await page.screenshot({ type: "png" });
    const s = stats(png);
    await page.addStyleTag({ content: "#ui{visibility:visible !important}" }).catch(() => {});
    const bad = [];
    if (![...info.cam, ...info.tgt].every(Number.isFinite)) bad.push(`camara no finita ${info.cam} -> ${info.tgt}`);
    else if (Math.hypot(...info.cam) > 1000) bad.push(`camara lejos: ${info.cam.map((v) => v.toFixed(0))}`);
    if (!info.proj) bad.push("proyeccion no finita");
    if (s.std < MIN_STD) bad.push(`fotograma liso (std ${s.std.toFixed(1)}, media ${s.mean.toFixed(0)})`);
    if (info.calls === 0) bad.push("sin llamadas de dibujo");
    if (errors.length) bad.push(...errors.splice(0));
    const ok = bad.length === 0;
    console.log(`${ok ? "ok   " : "FALLA"} ${tag} | ${label} | ${info.sel} std=${s.std.toFixed(0)}${ok ? "" : " | " + bad.join("; ")}`);
    if (!ok) failures.push(`${tag} | ${label}: ${bad.join("; ")}`);
  };

  const ids = await page.evaluate(() => (window.__app.partIds ? window.__app.partIds() : []));
  const ev = (fn, arg) => page.evaluate(fn, arg);

  // 1) cada pieza sola, sin separar
  await ev(() => window.__app.setParts(true));
  for (const id of ids) {
    await ev((i) => window.__app.selectPart(i), id);
    await page.waitForTimeout(SETTLE);
    await check(`pieza ${id}`);
  }
  // 2) con Separar: recorrido completo en orden con "siguiente"
  await ev(() => window.__app.setExplodeView(true));
  await page.waitForTimeout(1500);
  await check("separar activado");
  for (const id of ids) {
    await ev((i) => window.__app.selectPart(i), id);
    await page.waitForTimeout(SETTLE);
    await check(`separado, pieza ${id}`);
  }
  // 3) la secuencia del usuario: primero un riel, luego Separar y despues "siguiente" hasta el final
  await ev(() => window.__app.setExplodeView(false));
  await page.waitForTimeout(1200);
  const start = ids.includes("rail") ? "rail" : ids[1];
  await ev((i) => window.__app.selectPart(i), start);
  await page.waitForTimeout(SETTLE);
  await ev(() => window.__app.setExplodeView(true));
  for (let k = 0; k < ids.length; k++) {
    await page.waitForTimeout(700); // sin dejar asentar: es la parte delicada (el reencuadre diferido)
    await ev(() => window.__app.partStep(1));
    await page.waitForTimeout(900);
    await check(`secuencia usuario, paso ${k + 1}`);
  }
  await page.waitForTimeout(SETTLE);
  await check("secuencia usuario, reposo");
  // 4) la via corre rapido: x60 con una pieza de la via abierta
  await ev(() => { window.__app.view.timeScale = 60; });
  await page.waitForTimeout(1500);
  await check("x60 con pieza abierta");
  // 5) con el raton de verdad: clic en las piezas del lienzo, en los botones y en la tarjeta
  await ev(() => { window.__app.setExplodeView(false); window.__app.setParts(false); window.__app.setRig("orbit", true); });
  await page.waitForTimeout(1500);
  await page.click('[data-tool="parts"]');
  await page.waitForTimeout(500);
  const where = (name) => ev((n) => {
    const a = window.__app, T = window.__THREE;
    // puntos del mundo que pertenecen a cada pieza (a la altura de la via)
    const P = { rail: [0, 6.85, 1.56], stator: [0, 6.5, 1.15], pier: [0, 3, 0], beam: [0, 6.9, 0], tren: [0, 3.2, 2.04] };
    const q = P[n] ?? P.beam;
    const v = new T.Vector3(...q).project(a.camera);
    return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight];
  }, name);
  for (const name of ["rail", "stator", "pier"]) {
    const [x, y] = await where(name);
    await page.mouse.move(x - 40, y - 40, { steps: 4 });
    await page.mouse.move(x, y, { steps: 6 });
    await page.waitForTimeout(250);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(900);
    if (name === "rail") await page.click('[data-tool="explode"]');
    await page.waitForTimeout(SETTLE);
    await check(`raton: clic en ${name}${name === "rail" ? " y Separar" : ""}`);
  }
  for (let k = 0; k < ids.length; k++) {
    await page.click('[data-pc="next"]');
    await page.waitForTimeout(SETTLE);
    await check(`raton: Siguiente ${k + 1}`);
  }
  await page.mouse.move(w / 2, h / 2, { steps: 5 });
  await page.waitForTimeout(600);
  await check("raton: puntero en el centro");
  await page.click('[data-pc="close"]');
  await page.waitForTimeout(800);
  await check("raton: tarjeta cerrada");
  // 6) salir y volver a empezar
  await ev(() => { window.__app.view.timeScale = 5; window.__app.setExplodeView(false); window.__app.setParts(false); });
  await page.waitForTimeout(1200);
  await check("modo apagado");
  await page.close();
}

for (const size of SIZES) for (const mode of MODES) for (const theme of THEMES) await run(size, mode, theme);
await browser.close();
console.log(`\n${checks} comprobaciones, ${failures.length} fallos`);
for (const f of failures) console.log(" - " + f);
process.exit(failures.length ? 1 : 0);
