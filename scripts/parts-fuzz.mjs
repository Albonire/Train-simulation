// fuzz del explorador de piezas: acciones al azar (con semilla) sobre la interfaz real, con
// comprobaciones de que la escena sigue viva. reproduce secuencias que ningun guion previsto cubre.
//
//   node scripts/parts-fuzz.mjs <url> [semilla] [pasos]
//   qa_size=1920x918

import { chromium } from "playwright-core";
import { existsSync } from "node:fs";
import { PNG } from "pngjs";

const URL_BASE = process.argv.find((a) => a.startsWith("http")) ?? "http://127.0.0.1:5173/";
const nums = process.argv.filter((a) => /^\d+$/.test(a)).map(Number);
let seed = nums[0] ?? 1;
const STEPS = nums[1] ?? 120;
const [W, H] = (process.env.QA_SIZE ?? "1920x918").split("x").map(Number);
const CHROME =
  process.env.CHROME_PATH ??
  ["/opt/pw-browsers/chromium", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/usr/bin/chromium", "/usr/bin/google-chrome"].find((p) => existsSync(p));
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--use-angle=swiftshader", "--hide-scrollbars"],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on("pageerror", (e) => errors.push("excepcion: " + e));
page.on("console", (m) => {
  if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("consola: " + m.text());
});
await page.goto(URL_BASE, { waitUntil: "load", timeout: 120000 });
await page.waitForFunction(() => window.__app, null, { timeout: 30000 });
await page.evaluate(() => { window.__app.train.advance(150); });

const log = [];
const state = () =>
  page.evaluate(() => {
    const a = window.__app;
    const c = a.camera, t = a.controls.target;
    const v = [c.position.x, c.position.y, c.position.z, t.x, t.y, t.z];
    return {
      finite: v.every(Number.isFinite) && c.projectionMatrix.elements.every(Number.isFinite) && Number.isFinite(c.near),
      far: Math.hypot(c.position.x, c.position.y, c.position.z) > 1000,
      cam: v.map((x) => +x.toFixed(1)),
      sel: document.getElementById("pcTitle")?.textContent ?? "",
      parts: a.view.parts, explode: a.view.explode, rig: a.view.rig, mode: document.documentElement.dataset.mode,
    };
  });

async function flat() {
  await page.addStyleTag({ content: "#ui{visibility:hidden !important}" });
  const png = await page.screenshot({ type: "png" });
  await page.addStyleTag({ content: "#ui{visibility:visible !important}" });
  const p = PNG.sync.read(png);
  let s = 0, s2 = 0, n = 0;
  for (let i = 0; i < p.data.length; i += 16) {
    const l = 0.2126 * p.data[i] + 0.7152 * p.data[i + 1] + 0.0722 * p.data[i + 2];
    s += l; s2 += l * l; n++;
  }
  const m = s / n;
  return Math.sqrt(Math.max(0, s2 / n - m * m));
}

const ACTIONS = [
  ["tecla 1..6", async () => page.keyboard.press(String(1 + Math.floor(rnd() * 6)))],
  ["tecla P", async () => page.keyboard.press("p")],
  ["tecla E", async () => page.keyboard.press("e")],
  ["flecha", async () => page.keyboard.press(rnd() < 0.5 ? "ArrowRight" : "ArrowLeft")],
  ["Esc", async () => page.keyboard.press("Escape")],
  ["clic Siguiente", async () => page.click('[data-pc="next"]', { timeout: 500 }).catch(() => {})],
  ["clic Anterior", async () => page.click('[data-pc="prev"]', { timeout: 500 }).catch(() => {})],
  ["clic Piezas", async () => page.click('[data-tool="parts"]')],
  ["clic Separar", async () => page.click('[data-tool="explode"]')],
  ["pausa", async () => page.keyboard.press(" ")],
  ["tema", async () => page.click("#themeBtn")],
  ["panel H", async () => page.keyboard.press("h")],
  ["escala", async () => page.click(`[data-ts="${pick([1, 5, 20, 60])}"]`)],
  ["modo", async () => page.click(`[data-mode="${pick(["ems", "eds"])}"]`)],
  ["cuerpo", async () => page.evaluate((b) => { document.querySelector('[data-tab="view"]')?.click(); document.querySelector(`[data-body="${b}"]`)?.click(); }, pick(["auto", "solid", "xray", "cut"]))],
  ["clic en el lienzo", async () => { const x = 200 + rnd() * (W - 600), y = 120 + rnd() * (H - 300); await page.mouse.move(x, y, { steps: 3 }); await page.mouse.down(); await page.mouse.up(); }],
  ["arrastre", async () => { const x = 400 + rnd() * 400, y = 300 + rnd() * 200; await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 80 * (rnd() - 0.5), y + 60 * (rnd() - 0.5), { steps: 4 }); await page.mouse.up(); }],
  ["rueda", async () => { await page.mouse.move(W / 2, H / 2); await page.mouse.wheel(0, (rnd() - 0.5) * 600); }],
  ["doble clic", async () => page.mouse.dblclick(W / 2, H / 2)],
  ["guia y volver", async () => { await page.evaluate(() => (location.hash = "#/guia")); await page.waitForTimeout(200); await page.keyboard.press("Escape"); }],
];

let fails = 0;
for (let i = 0; i < STEPS; i++) {
  const [name, fn] = pick(ACTIONS);
  try { await fn(); } catch (e) { log.push(`(accion ${name} no aplicable: ${String(e).split("\n")[0]})`); }
  log.push(name);
  await page.waitForTimeout(40 + rnd() * 500);
  const st = await state();
  let bad = [];
  if (!st.finite) bad.push("camara o proyeccion no finita " + st.cam);
  if (st.far) bad.push("camara lejos " + st.cam);
  if (errors.length) bad.push(...errors.splice(0));
  if (i % 4 === 3 && !bad.length) {
    await page.waitForTimeout(1500); // que termine el vuelo
    const sd = await flat();
    if (sd < 4) bad.push(`fotograma liso (std ${sd.toFixed(1)})`);
  }
  if (bad.length) {
    fails++;
    console.log(`FALLA paso ${i} tras "${name}": ${bad.join("; ")}`);
    console.log("  estado:", JSON.stringify(st));
    console.log("  ultimas acciones:", log.slice(-12).join(" > "));
    await page.screenshot({ path: `/tmp/fuzz_${seed}_${i}.png` });
    break;
  }
}
await browser.close();
console.log(`semilla ${nums[0] ?? 1}: ${STEPS} pasos, ${fails ? "FALLO" : "sin fallos"}`);
process.exit(fails ? 1 : 0);
