// Fig 3. Banco de levitacion EDS: una cinta con bobinas bajo un bloque de imanes
// superconductores. Sin movimiento no hay corriente inducida y el bloque descansa
// en sus ruedas; al subir la velocidad aparece la repulsion, el bloque se eleva y
// las ruedas se retraen. La cinta se dibuja en camara lenta (1/40).
// Todo numero sale de EdsSection (src/physics/eds.js), el mismo modelo de la
// simulacion, cuya ley de sustentacion es cualitativa (ver "Como funciona").
//
//   node figures/eds-sustentacion/build.mjs [--light]

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../vendor/anatomy/kit/iso-kit.mjs";
import { kitScript } from "../../vendor/anatomy/scripts/inline-kit.mjs";
import { physicsScript } from "../lib/physics-inline.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 660;
const HEIGHT = 420;

const S = 2.4; // px por mm de elevacion
const GAP_W = 85; // mm, sobre las ruedas
const BELT_TOP = 22;
const BOT_W = BELT_TOP + 14; // cara inferior del bloque apoyado en las ruedas
const MAG = { x: -48, y: -30, w: 96, d: 60, r: 3 };
const MAG_H = 16;
const POLE = 24; // paso polar del dibujo, px
const COIL_P = 24;

const PLATE = { x: -156, y: -86, w: 312, d: 172, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;
const PANEL = { x: -138, y: -84, w: 276, d: 12, r: 2.5 };
const PANEL_TOP = 190;
const RAIL_Y = -72;
const RAIL_X = [-92, 92];
const RULER = { x: 118, y: RAIL_Y, w: 14, d: 1.6, r: 0.6 };
const RULER_G0 = 84;
const RULER_G1 = 104;
const zOfGap = (g) => BOT_W + (g - GAP_W) * S;

const BELT = { x: -134, y: -44, w: 268, d: 88, r: 16 };
const BELT_H = 20;

const BOX = { x: 76, y: 52, w: 72, d: 28, r: 4 };
const BOX_H = 26;
const DIAL_A = [96, 66];
const DIAL_B = [128, 66];
const DIAL_R = 11;
const DIAL_TOP = BOX_H + 7;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [PANEL.x, PANEL.y, PANEL_TOP], [PANEL.x + PANEL.w, PANEL.y, PANEL_TOP]],
  WIDTH,
  HEIGHT,
  { pad: 12, azimuth: 40, elevation: 33 },
);

const at = (point) => k.iso(point, P);
const S_ = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const seg = (a, b) => k.segment(a, b, P);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

function bench() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 24))) {
    out.push(S_(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S_(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S_(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  return out.join("");
}

function panel() {
  const out = [];
  out.push(S_(k.slabOf(PANEL, 0, PANEL_TOP, P, 3, 0.6), { tone: "mid" }));
  const front = PANEL.y + PANEL.d;
  const screws = [];
  for (const x of [-124, -62, 0, 62, 124]) for (const z of [12, 178]) screws.push(at([x, front, z]));
  out.push(D(screws, { size: 0.45 }));
  for (const cx of RAIL_X) {
    out.push(S_(k.slabOf({ x: cx - 4, y: RAIL_Y, w: 8, d: 6, r: 1 }, 14, 166, P, 3, 0.4), { tone: "hi", crease: "lo" }));
    out.push(S_(k.slabOf({ x: cx - 6, y: RAIL_Y - 2, w: 12, d: 8, r: 1.4 }, 0, 14, P, 3, 0.4), { tone: "mid" }));
    out.push(D([at([cx - 2.5, RAIL_Y + 2, 14]), at([cx + 2.5, RAIL_Y + 2, 14])], { size: 0.4 }));
  }
  // regla de elevacion: marcas de 1 mm que nacen del borde izquierdo de la tira
  const z0 = zOfGap(RULER_G0);
  const z1 = zOfGap(RULER_G1);
  out.push(S_(k.slabOf(RULER, z0 - 3, z1 - z0 + 6, P, 2), { tone: "lo", crease: "none" }));
  const face = RULER.y + RULER.d;
  const minor = [];
  const major = [];
  for (let g = RULER_G0; g <= RULER_G1; g++) {
    const z = zOfGap(g);
    (g % 5 === 0 ? major : minor).push(seg([RULER.x, face, z], [RULER.x + (g % 5 === 0 ? 6 : 3), face, z]));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  // marcas de referencia: 85 mm (sobre las ruedas) y 100 mm (crucero)
  for (const g of [85, 100]) out.push(L(seg([RULER.x, face, zOfGap(g)], [RULER.x + 6, face, zOfGap(g)]), { tone: "hi" }));
  out.push(D([at([RULER.x + RULER.w - 2.2, face, z1 + 1]), at([RULER.x + RULER.w - 2.2, face, z0 - 1])], { size: 0.4 }));
  return out.join("");
}

function belt() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BELT, 0, BELT_H, P)}" style="filter:blur(5px)"/>`];
  out.push(S_(k.slabOf(BELT, 0, BELT_H, P, 10, 0.8), { tone: "mid" }));
  const skin = { x: BELT.x + 3, y: BELT.y + 3, w: BELT.w - 6, d: BELT.d - 6, r: BELT.r - 3 };
  out.push(S_(k.slabOf(skin, BELT_H, BELT_TOP - BELT_H, P, 10, 0.4), { tone: "lo", crease: "none" }));
  // tambores en los extremos y tornillos de la tapa
  for (const x of [BELT.x + 8, BELT.x + BELT.w - 8]) out.push(D([at([x, BELT.y + 4, BELT_H]), at([x, BELT.y + BELT.d - 4, BELT_H])], { size: 0.45 }));
  return out.join("");
}

// ----------------------------------------------------------------- carro movil
const ARM_Y = [-72, -48];
function carriage() {
  const out = [];
  // deslizaderas sobre los carriles y brazos hasta el bloque
  for (const cx of RAIL_X) {
    const slider = { x: cx - 10, y: RAIL_Y - 2, w: 20, d: 18, r: 2 };
    out.push(S_(k.slabOf(slider, BOT_W - 4, 44, P, 3, 0.5), { tone: "mid" }));
    out.push(D([at([cx - 6, slider.y + slider.d, BOT_W + 20]), at([cx + 6, slider.y + slider.d, BOT_W + 20])], { size: 0.45 }));
    const ax = cx < 0 ? { x: cx + 8, y: -66, w: MAG.x - cx - 8 + 4, d: 36, r: 2 } : { x: MAG.x + MAG.w - 4, y: -66, w: cx - 8 - (MAG.x + MAG.w) + 12, d: 36, r: 2 };
    out.push(S_(k.slabOf(ax, BOT_W + 6, 8, P, 3, 0.5), { tone: "mid" }));
  }
  // bloque criostato con los cuatro polos del iman superconductor
  out.push(S_(k.slabOf(MAG, BOT_W, MAG_H, P, 4, 0.8), { tone: "hi", crease: "lo", lit: true }));
  const top = BOT_W + MAG_H;
  const pw = (MAG.w - 8) / 4;
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const xa = MAG.x + 4 + i * pw;
    const xb = xa + pw;
    const tone = i % 2 === 0 ? "red" : "blue";
    const pts = [at([xa + 1, MAG.y + 4, top]), at([xb - 1, MAG.y + 4, top]), at([xb - 1, MAG.y + MAG.d - 4, top]), at([xa + 1, MAG.y + MAG.d - 4, top])];
    parts.push(`<path d="M${pts.map((p) => p.join(" ")).join("L")}Z" style="fill:var(--anatomy-${tone});opacity:.85;stroke:none"/>`);
    const f = [at([xa + 1, MAG.y + MAG.d, BOT_W + 2]), at([xb - 1, MAG.y + MAG.d, BOT_W + 2]), at([xb - 1, MAG.y + MAG.d, top - 2]), at([xa + 1, MAG.y + MAG.d, top - 2])];
    parts.push(`<path d="M${f.map((p) => p.join(" ")).join("L")}Z" style="fill:var(--anatomy-${tone});opacity:.7;stroke:none"/>`);
  }
  out.push(parts.join(""));
  // conexiones del criostato: dos bridas en el costado
  for (const dx of [-30, 30]) out.push(S_(k.cylinder(MAG.x + MAG.w / 2 + dx, MAG.y + 8, 3.6, top, 5, P, 18), { tone: "lo" }));
  return out.join("");
}

function wheelBase(cx, cy) {
  // soporte de la rueda: se mueve con el bloque; el aro rota (se dibuja aparte)
  return S_(k.cylinder(cx, cy, 2.4, BOT_W - 6, 6, P, 14), { tone: "lo", crease: "none" });
}

// ------------------------------------------------------------- caja de mando
function box() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BOX, 0, BOX_H, P)}" style="filter:blur(5px)"/>`];
  out.push(S_(k.slabOf(BOX, 0, BOX_H, P, 5, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(BOX, 3), BOX_H, P), { tone: "faint" }));
  out.push(D(k.corners(BOX, 6).map(([x, y]) => at([x, y, BOX_H])), { size: 0.45 }));
  for (const [x, y] of [DIAL_A, DIAL_B]) {
    out.push(S_(k.cylinder(x, y, DIAL_R, BOX_H, 7, P, 40, 0.5), { tone: "hi", crease: "lo" }));
    out.push(L(k.knurl(x, y, DIAL_R, DIAL_TOP - 2.6, DIAL_TOP, 52, P, 0.3), { tone: "lo" }));
    out.push(L(k.ring(x, y, DIAL_R - 1.8, DIAL_TOP, P, 40), { tone: "lo" }));
    const t = k.radialTicks(x, y, DIAL_R - 2.4, 25, 5, DIAL_TOP, [0.9, 2.1], P, (Math.PI * 5) / 4, (Math.PI * 3) / 2);
    out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
    out.push(L(k.ring(x, y, 1.2, DIAL_TOP, P, 12), { tone: "mid" }));
  }
  const plate = { x: BOX.x + 6, y: BOX.y + 19, w: 28, d: 5.5, r: 1 };
  out.push(S_(k.slabOf(plate, BOX_H, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L([0, 1, 2].map((i) => k.lineOnTop([plate.x + 3, plate.y + 1 + i * 1.5], [plate.x + 3 + 18 - i * 4, plate.y + 1 + i * 1.5], BOX_H + 0.8, P)).join(""), { tone: "lo", free: true }));
  return out.join("");
}

const needle = (cx, cy, frac) => {
  const a = (Math.PI * 5) / 4 + frac * ((Math.PI * 3) / 2);
  return k.lineOnTop([cx - Math.sin(a) * 2.2, cy + Math.cos(a) * 2.2], [cx + Math.sin(a) * (DIAL_R - 3.4), cy - Math.cos(a) * (DIAL_R - 3.4)], DIAL_TOP + 0.2, P);
};

// el contorno de la tapa de la cinta, en pantalla, para recortar las bobinas
const skinPoints = k.ringOf({ x: BELT.x + 3, y: BELT.y + 3, w: BELT.w - 6, d: BELT.d - 6, r: BELT.r - 3 }, 10).map(([x, y]) => at([x, y, BELT_TOP]));
const skinPath = "M" + skinPoints.map((p) => p.join(" ")).join("L") + "Z";

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Banco de levitacion electrodinamica. Una cinta lleva bobinas de via; encima, un bloque con cuatro polos de imanes superconductores, rojo norte y azul sur, descansa en ruedas de goma. Al subir la velocidad de la cinta aparecen corrientes inducidas en las bobinas, el bloque se eleva sobre una regla y las ruedas se retraen. Dos diales leen la velocidad y la relacion entre sustentacion y peso.",
  body: [
    bench(),
    panel(),
    belt(),
    `<g data-part="coils" clip-path="url(#beltclip)"></g>`,
    `<clipPath id="beltclip"><path d="${skinPath}"/></clipPath>`,
    `<g data-part="carriage" transform="${k.translateAlong(P, [0, 0, 0])}">${carriage()}</g>`,
    `<g data-part="wheels"></g>`,
    `<g data-part="pointer"></g>`,
    box(),
    `<path data-part="needleA" class="iso-line" data-tone="lit" data-free="start" d="${needle(DIAL_A[0], DIAL_A[1], 0)}" style="stroke-width:1"/>`,
    `<path data-part="needleB" class="iso-line" data-tone="lit" data-free="start" d="${needle(DIAL_B[0], DIAL_B[1], 0)}" style="stroke-width:1"/>`,
    `<g data-part="led"></g>`,
  ],
});

const live = `
${physicsScript(["constants.js", "eds.js"], ["EdsSection", "EDS", "G"])}
const P = ${JSON.stringify(P)};
const S = ${S}, GAP_W = ${GAP_W}, BOT_W = ${BOT_W}, BELT_TOP = ${BELT_TOP};
const MAG = ${JSON.stringify(MAG)}, MAG_H = ${MAG_H}, POLE = ${POLE}, COIL_P = ${COIL_P};
const BELT = ${JSON.stringify(BELT)};
const DIAL_A = ${JSON.stringify(DIAL_A)}, DIAL_B = ${JSON.stringify(DIAL_B)}, DIAL_R = ${DIAL_R}, DIAL_TOP = ${DIAL_TOP};
const RULER_X = ${RULER.x}, RULER_Y = ${RULER.y + RULER.d}, RAIL_X1 = ${RAIL_X[1]};
const LED = ${JSON.stringify([BOX.x + 56, BOX.y + 8, BOX_H])};
const RAIL_Y_SL = ${RAIL_Y - 2 + 18}; // arista frontal derecha de la deslizadera
const VMAX = EDS_RECORD;
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const q = (n) => svg.querySelector('[data-part="' + n + '"]');
const coils = q("coils"), wheels = q("wheels"), carriage = q("carriage"), pointer = q("pointer"), nA = q("needleA"), nB = q("needleB"), led = q("led");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const sec = new PHYS.EdsSection();
const W = sec.mass * PHYS.G;
let v = 0, vTarget = 0, wheelAng = 0, scroll = 0, retract = 0;
let touring = !still.matches, clock = 0, visible = false, frame = 0, last = 0, idleTimer = 0;
const needleAt = ${needle.toString().replace("k.lineOnTop", "lineOnTop")};
const rect = (xa, xb, ya, yb, z) => [iso([xa, ya, z], P), iso([xb, ya, z], P), iso([xb, yb, z], P), iso([xa, yb, z], P)];
const poly = (pts) => "M" + pts.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L") + "Z";

function drawCoils() {
  // bobinas de via: se desplazan en camara lenta y se colorean con la corriente inducida
  const induced = v / Math.sqrt(v * v + sec.vc * sec.vc);
  const out = [];
  const x0 = BELT.x - COIL_P;
  const n = Math.ceil(BELT.w / COIL_P) + 3;
  for (let j = 0; j < n; j++) {
    const xa = x0 + j * COIL_P + (scroll % COIL_P) + 2, xb = xa + COIL_P - 4;
    const xm = (xa + xb) / 2;
    const near = Math.exp(-Math.pow((xm - (MAG.x + MAG.w / 2)) / (MAG.w * 0.62), 2));
    const s = Math.sin(Math.PI * (xm - MAG.x - MAG.w / 2) / POLE + Math.PI / 2) * induced * near;
    const a = rect(xa, xb, BELT.y + 8, BELT.y + BELT.d - 8, BELT_TOP);
    const alpha = Math.abs(s);
    out.push('<path d="' + poly(a) + '" style="fill:var(--anatomy-' + (s > 0 ? "red" : "blue") + ');opacity:' + (alpha * 0.8).toFixed(2) + ';stroke:none"/>');
    const inset = rect(xa + 2.4, xb - 2.4, BELT.y + 10.4, BELT.y + BELT.d - 10.4, BELT_TOP);
    out.push('<path class="iso-line" data-tone="lo" d="' + poly(a) + poly(inset) + '"/>');
  }
  coils.innerHTML = out.join("");
}

function drawWheels(dz) {
  // dos ruedas en los extremos del bloque: extendidas tocan la cinta; retraidas suben junto al bloque
  let h = "";
  const zb = BOT_W + dz + 6; // altura de la ménsula en el costado del bloque
  for (const sx of [-1, 1]) {
    const cx = MAG.x + MAG.w / 2 + sx * (MAG.w / 2 + 11);
    const zc = BELT_TOP + 7 + (BOT_W + dz - 2 - (BELT_TOP + 7)) * retract;
    const r = 7;
    const c = iso([cx, 0, zc], P);
    const rx = r, ry = r * 0.82;
    const top = iso([cx, 0, zb], P);
    const face = iso([sx < 0 ? MAG.x : MAG.x + MAG.w, 0, zb], P);
    h += '<path class="iso-line" data-tone="mid" d="M' + c[0].toFixed(1) + " " + c[1].toFixed(1) + "L" + top[0].toFixed(1) + " " + top[1].toFixed(1) + "L" + face[0].toFixed(1) + " " + face[1].toFixed(1) + '"/>';
    h += '<ellipse cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" rx="' + rx + '" ry="' + ry.toFixed(1) + '" class="iso-line" data-tone="mid" style="fill:var(--anatomy-paper)"/>';
    for (let i = 0; i < 4; i++) {
      const a = wheelAng + (i * Math.PI) / 2;
      h += '<path class="iso-line" data-tone="lo" d="M' + c[0].toFixed(1) + " " + c[1].toFixed(1) + "L" + (c[0] + Math.cos(a) * (rx - 1)).toFixed(1) + " " + (c[1] + Math.sin(a) * (ry - 1)).toFixed(1) + '"/>';
    }
    h += '<circle cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="1.2" class="iso-wire-end"/>';
  }
  wheels.innerHTML = h;
}

function draw() {
  const gap = sec.gap * 1000;
  const dz = (gap - GAP_W) * S;
  carriage.setAttribute("transform", translateAlong(P, [0, 0, dz]));
  drawCoils();
  drawWheels(dz);
  // puntero que lee la regla: nace en la deslizadera derecha
  const zp = BOT_W + dz + 7;
  const a = iso([RAIL_X1 + 10, RAIL_Y_SL, zp], P), b = iso([RULER_X + 1.4, RULER_Y, zp], P); // nace en la cara de la deslizadera
  pointer.innerHTML = '<path class="iso-line" data-tone="lit" d="M' + a[0].toFixed(1) + " " + a[1].toFixed(1) + "L" + b[0].toFixed(1) + " " + b[1].toFixed(1) + '" style="stroke-width:1.4"/>';
  nA.setAttribute("d", needleAt(DIAL_A[0], DIAL_A[1], clamp(v / VMAX, 0, 1)));
  nB.setAttribute("d", needleAt(DIAL_B[0], DIAL_B[1], clamp(sec.lift / W / 1.2, 0, 1)));
  const lp = iso(LED, P);
  led.innerHTML = '<circle cx="' + lp[0].toFixed(1) + '" cy="' + lp[1].toFixed(1) + '" r="1.9" style="fill:' + (sec.wheelsDown ? "var(--anatomy-red)" : "var(--anatomy-green)") + ';stroke:var(--anatomy-lo);stroke-width:.4"/>';
  const kmh = v * 3.6;
  const state = sec.wheelsDown ? (kmh < 1 ? "parado, sobre ruedas" : "sobre ruedas") : "levitando";
  const text = kmh.toFixed(0) + " km/h · " + gap.toFixed(1) + " mm · " + state;
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", "velocidad " + kmh.toFixed(0) + " kilometros por hora, elevacion " + gap.toFixed(1) + " milimetros, " + state + ", sustentacion " + Math.round(sec.lift / W * 100) + " por ciento del peso");
}

function tourV(t) {
  // 0 -> 603 km/h en 24 s, 4 s arriba, baja en 18 s, 6 s parado
  const T = 52;
  const u = t % T;
  if (u < 24) return (u / 24) * VMAX;
  if (u < 28) return VMAX;
  if (u < 46) return (1 - (u - 28) / 18) * VMAX;
  return 0;
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) { clock += dt; vTarget = tourV(clock); }
  v = calm ? vTarget : v + (vTarget - v) * (1 - Math.exp(-dt / 0.5));
  if (Math.abs(vTarget - v) < 0.02) v = vTarget;
  const n = Math.max(1, Math.round(dt / 0.002));
  for (let i = 0; i < n; i++) sec.step(dt / n, v);
  scroll += (v / 40) * (${COIL_P} / 0.9) * dt; // camara lenta 1/40: 0.9 m = una bobina
  wheelAng += (v / 40) * dt * 4;
  retract += ((sec.wheelsDown ? 0 : 1) - retract) * (1 - Math.exp(-dt / 0.25));
  draw();
  const settled = !touring && v === vTarget && Math.abs(sec.gapVel) < 1e-5 && v < 0.01;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const takeOver = () => { touring = false; clearTimeout(idleTimer); idleTimer = setTimeout(() => { if (!still.matches) { touring = true; clock = 0; run(); } }, 3600); };
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (e) => {
  const box = svg.getBoundingClientRect();
  const share = clamp(((e.clientX - box.left) / box.width - 0.15) / 0.7, 0, 1);
  takeOver(); vTarget = share * VMAX; run();
});
stage.addEventListener("pointerleave", () => { vTarget = 0; run(); });
stage.addEventListener("keydown", (e) => {
  const step = e.shiftKey ? 100 / 3.6 : 25 / 3.6;
  if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); takeOver(); vTarget = clamp(vTarget + step, 0, VMAX); }
  else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); takeOver(); vTarget = clamp(vTarget - step, 0, VMAX); }
  else if (e.key === "Home" || e.key === "Escape" || e.key === " ") { e.preventDefault(); takeOver(); vTarget = 0; }
  else if (e.key === "End") { e.preventDefault(); takeOver(); vTarget = VMAX; }
  else return;
  run();
});
draw();
`.replace("EDS_RECORD", "PHYS.EDS.recordSpeed");

const body = k.plateHtml({
  fig: "Fig 3",
  title: "Banco de levitación EDS",
  hint: "Mueve el cursor: velocidad",
  readout: "0 km/h · 85.0 mm · parado, sobre ruedas",
  keys: [
    { mark: "red", label: "Polo norte, o corriente inducida de un sentido" },
    { mark: "blue", label: "Polo sur, o corriente inducida del otro" },
    { mark: "lit", label: "Puntero y agujas: elevación, velocidad y sustentación / peso" },
  ],
  caption:
    "Los imanes superconductores del bloque inducen corriente en las bobinas de la vía solo si hay movimiento. Parado no hay sustentación y el bloque descansa en sus ruedas; hacia los 150 km/h la repulsión iguala el peso, las ruedas se retraen y la elevación sigue creciendo con la velocidad hasta cerca de los 100 mm. La cinta se dibuja en cámara lenta (1/40). La ley de sustentación es cualitativa, no la de las bobinas en 8 reales.",
  body: `<div class="iso-stage" tabindex="0" role="group" aria-label="Banco de levitación EDS. Las flechas derecha e izquierda cambian la velocidad de la cinta, Espacio la detiene y Fin la lleva a 603 kilómetros por hora." aria-valuetext="velocidad 0 kilómetros por hora">${svg}</div>`,
});

const html = k.pageHtml({ title: "Banco de levitación EDS", theme, body, script: kitScript() + live }).replace('<html lang="en">', '<html lang="es">');
const out = join(HERE, theme === "light" ? "eds-sustentacion-light.html" : "eds-sustentacion.html");
writeFileSync(out, html);
console.log("wrote", out);
void wheelBase;
