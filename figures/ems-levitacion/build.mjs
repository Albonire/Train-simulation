// fig 1. banco de levitacion ems: un modulo de iman suspendido bajo un estator.
// la regla de la izquierda lee el entrehierro; el amperimetro lee la corriente.
// todo numero y todo movimiento salen de src/physics/ems.js (el mismo modelo que la
// simulacion 3d): el equilibrio es inestable y solo el lazo de control lo sostiene.
//
//   node figures/ems-levitacion/build.mjs [--light]

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../vendor/anatomy/kit/iso-kit.mjs";
import { kitScript } from "../../vendor/anatomy/scripts/inline-kit.mjs";
import { physicsScript } from "../lib/physics-inline.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 640;
const HEIGHT = 410;

// ---- escala: 1 mm de entrehierro = s px -------------------------------------
const S = 2.4;
const STATOR_BOTTOM = 150;
const GAP0 = 10; // mm nominal
const MAG_TOP0 = STATOR_BOTTOM - GAP0 * S; // cara polar con el entrehierro nominal

// ---- cotas ---------------------------------------------------------------------
const PLATE = { x: -150, y: -84, w: 300, d: 168, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;
const PANEL = { x: -132, y: -82, w: 264, d: 12, r: 2.5 };
const PANEL_TOP = 198;
const RAIL_Y = -70;
const RAIL_X = [-89, 89];
const STATOR = { x: -120, y: -56, w: 240, d: 26, r: 3 };
const STATOR_TOP = 172;
const ARM_X = [-114, 98];

const CORE = { x: -66, y: -48, w: 132, d: 34, r: 2.5 };
const CORE_H = 8;
const COIL = { x: -60, y: -54, w: 120, d: 46, r: 4 };
const COIL_H = 12;
const DECK = { x: -66, y: -54, w: 132, d: 84, r: 3 };
const DECK_H = 12;
const DECK_Z0 = MAG_TOP0 - CORE_H - COIL_H - DECK_H; // 94
const COIL_Z0 = DECK_Z0 + DECK_H;
const CORE_Z0 = COIL_Z0 + COIL_H;
const PADS = [
  [-54, -24],
  [54, -24],
];
const PAD_H = DECK_Z0 - (20 - GAP0) * S; // la cubierta toca los patines con 20 mm

const RULER = { x: 114, y: RAIL_Y, w: 14, d: 1.6, r: 0.6 };
const RULER_Z0 = STATOR_BOTTOM - 26 * S;
const RULER_Z1 = STATOR_BOTTOM + 3;

const BOX = { x: 70, y: 22, w: 74, d: 48, r: 4 };
const BOX_H = 30;
const DIAL = [96, 46];
const DIAL_R = 13;
const DIAL_Z = BOX_H;
const DIAL_H = 8;
const DIAL_TOP = DIAL_Z + DIAL_H;

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [PANEL.x, PANEL.y, PANEL_TOP],
    [PANEL.x + PANEL.w, PANEL.y, PANEL_TOP],
    [STATOR.x + STATOR.w, STATOR.y + STATOR.d, STATOR_TOP + 14],
  ],
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

// ------------------------------------------------------------------ banco
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
  // tornillos de anclaje en la cara frontal
  const front = PANEL.y + PANEL.d;
  const screws = [];
  for (const x of [-120, -60, 0, 60, 120]) for (const z of [12, 186]) screws.push(at([x, front, z]));
  out.push(D(screws, { size: 0.45 }));
  // carriles verticales
  for (const cx of RAIL_X) {
    out.push(S_(k.slabOf({ x: cx - 4, y: RAIL_Y, w: 8, d: 6, r: 1 }, 14, 178, P, 3, 0.4), { tone: "hi", crease: "lo" }));
    out.push(S_(k.slabOf({ x: cx - 6, y: RAIL_Y - 2, w: 12, d: 8, r: 1.4 }, 0, 14, P, 3, 0.4), { tone: "mid" }));
    out.push(D([at([cx - 2.5, RAIL_Y + 2, 14]), at([cx + 2.5, RAIL_Y + 2, 14])], { size: 0.4 }));
  }
  // regla de entrehierro: tira delgada con marcas que nacen de su borde derecho
  const rulerH = RULER_Z1 - RULER_Z0;
  out.push(S_(k.slabOf(RULER, RULER_Z0, rulerH, P, 2), { tone: "lo", crease: "none" }));
  const xEdge = RULER.x; // las marcas nacen del borde izquierdo de la tira
  const face = RULER.y + RULER.d;
  const minor = [];
  const major = [];
  for (let g = 0; g <= 26; g++) {
    const z = STATOR_BOTTOM - g * S;
    const big = g % 5 === 0;
    (big ? major : minor).push(seg([xEdge, face, z], [xEdge + (big ? 6 : 3), face, z]));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  // la marca de 10 mm (entrehierro nominal) en el color de mayor jerarquia
  out.push(L(seg([xEdge, face, MAG_TOP0], [xEdge + 6, face, MAG_TOP0]), { tone: "hi" }));
  out.push(D([at([RULER.x + RULER.w - 2.2, face, RULER_Z1 - 3]), at([RULER.x + RULER.w - 2.2, face, RULER_Z0 + 3])], { size: 0.4 }));
  return out.join("");
}

function stator() {
  const out = [];
  // brazos que cuelgan el estator del panel
  for (const x of ARM_X) {
    out.push(S_(k.slabOf({ x, y: PANEL.y, w: 16, d: STATOR.y + STATOR.d - PANEL.y, r: 2 }, STATOR_TOP, 12, P, 3, 0.5), { tone: "mid" }));
    out.push(D([at([x + 8, STATOR.y + 8, STATOR_TOP + 12]), at([x + 8, STATOR.y + STATOR.d - 8, STATOR_TOP + 12])], { size: 0.45 }));
  }
  out.push(S_(k.slabOf(STATOR, STATOR_BOTTOM, STATOR_TOP - STATOR_BOTTOM, P, 4, 0.8), { tone: "hi", crease: "lo" }));
  // ranuras: lineas de cara a cara en el frente (los cables de alta tension van dentro)
  const front = STATOR.y + STATOR.d;
  const slots = [];
  for (let x = STATOR.x + 12; x < STATOR.x + STATOR.w - 6; x += 12) slots.push(seg([x, front, STATOR_BOTTOM], [x, front, STATOR_TOP]));
  out.push(L(slots.join(""), { tone: "faint" }));
  // rotulo grabado (la unica etiqueta del dibujo)
  out.push(k.faceTextSvg(k.sideMatrix([STATOR.x + 20, front], STATOR_BOTTOM + 7, P, "right"), "ESTATOR", { size: 5.2, tone: "lo" }));
  return out.join("");
}

function pads() {
  const out = [];
  for (const [x, y] of byDepth(PADS)) {
    out.push(S_(k.cylinder(x, y, 7, 0, 3, P, 24), { tone: "lo" }));
    out.push(S_(k.cylinder(x, y, 5, 3, PAD_H - 3 - 3, P, 24), { tone: "mid", crease: "none" }));
    out.push(L(k.sideArc(x, y, 5, 24, P, 12), { tone: "faint" }));
    out.push(S_(k.cylinder(x, y, 6, PAD_H - 3, 3, P, 24), { tone: "lo" }));
  }
  return out.join("");
}

// ----------------------------------------------------------------- carro movil
// Se construye con el entrehierro nominal y se desplaza con translateAlong.
function poleStripes() {
  // doce polos N/S en la cara frontal del nucleo; el rojo es N y el azul S
  const front = CORE.y + CORE.d;
  const x0 = CORE.x + 3;
  const w = (CORE.w - 6) / 12;
  const parts = [];
  for (let i = 0; i < 12; i++) {
    const xa = x0 + i * w;
    const xb = xa + w;
    const d = `M${at([xa, front, CORE_Z0 + 0.5])}L${at([xb, front, CORE_Z0 + 0.5])}L${at([xb, front, CORE_Z0 + CORE_H - 0.5])}L${at([xa, front, CORE_Z0 + CORE_H - 0.5])}Z`;
    parts.push(`<path d="${d.replaceAll(",", " ")}" style="fill:var(--anatomy-${i % 2 === 0 ? "red" : "blue"});opacity:.85;stroke:none"/>`);
  }
  // los mismos polos en la cara superior del nucleo (la parte que el estator no tapa)
  const top = CORE_Z0 + CORE_H;
  const y0 = CORE.y + 2;
  const y1 = CORE.y + CORE.d - 2;
  for (let i = 0; i < 12; i++) {
    const xa = x0 + i * w;
    const xb = xa + w;
    const d = `M${at([xa, y0, top])}L${at([xb, y0, top])}L${at([xb, y1, top])}L${at([xa, y1, top])}Z`;
    parts.push(`<path d="${d.replaceAll(",", " ")}" style="fill:var(--anatomy-${i % 2 === 0 ? "red" : "blue"});opacity:.85;stroke:none"/>`);
  }
  return parts.join("");
}

function carriage() {
  const out = [];
  const front = COIL.y + COIL.d;
  // deslizaderas sobre los carriles
  for (const cx of RAIL_X) {
    const slider = { x: cx - 10, y: RAIL_Y - 2, w: 20, d: 18, r: 2 };
    out.push(S_(k.slabOf(slider, DECK_Z0 - 12, 46, P, 3, 0.5), { tone: "mid" }));
    out.push(D([at([cx - 6, slider.y + slider.d, DECK_Z0 + 22]), at([cx + 6, slider.y + slider.d, DECK_Z0 + 22])], { size: 0.45 }));
    // brazo hasta la cubierta
    const arm = cx < 0 ? { x: cx + 8, y: -66, w: DECK.x - cx - 8 + 6, d: 22, r: 2 } : { x: DECK.x + DECK.w - 6, y: -66, w: cx - 8 - (DECK.x + DECK.w) + 14, d: 22, r: 2 };
    out.push(S_(k.slabOf(arm, DECK_Z0, DECK_H, P, 3, 0.5), { tone: "mid" }));
  }
  // cubierta, devanado y nucleo
  out.push(S_(k.slabOf(DECK, DECK_Z0, DECK_H, P, 4, 0.7), { tone: "mid" }));
  out.push(D([at([DECK.x + 8, DECK.y + DECK.d - 6, COIL_Z0]), at([DECK.x + DECK.w - 8, DECK.y + DECK.d - 6, COIL_Z0]), at([DECK.x + 8, COIL.y + COIL.d + 6, COIL_Z0]), at([DECK.x + DECK.w - 8, COIL.y + COIL.d + 6, COIL_Z0])], { size: 0.45 }));
  // patines de apoyo: tacos de goma bajo la cubierta, enfrentados a los apoyos de la base
  for (const [x, y] of PADS) out.push(S_(k.cylinder(x, y, 6.4, DECK_Z0 - 2, 2, P, 24), { tone: "lo" }));
  const coilFront = [];
  for (let x = COIL.x + 5; x < COIL.x + COIL.w - 2; x += 5) coilFront.push(seg([x, front, COIL_Z0], [x, front, COIL_Z0 + COIL_H]));
  out.push(S_(k.slabOf(COIL, COIL_Z0, COIL_H, P, 4, 0.5), { tone: "mid", inner: L(coilFront.join(""), { tone: "lo" }) }));
  out.push(S_(k.slabOf(CORE, CORE_Z0, CORE_H, P, 4, 0.7), { tone: "hi", crease: "lo", lit: true }));
  out.push(poleStripes());
  // lengueta del sensor en el extremo derecho del nucleo
  out.push(S_(k.slabOf({ x: CORE.x + CORE.w - 2, y: -40, w: 12, d: 14, r: 1.5 }, CORE_Z0, CORE_H, P, 3, 0.4), { tone: "lo" }));
  // puntero que lee la regla (nace en la deslizadera izquierda)
  out.push(S_(k.slabOf({ x: RAIL_X[1] + 8, y: RAIL_Y + 3, w: RULER.x + 1.4 - (RAIL_X[1] + 8), d: 2.2, r: 0.6 }, MAG_TOP0 - 0.6, 1.2, P, 2), { tone: "hi", lit: true }));
  return out.join("");
}

// pesos que descansan en el saliente de la cubierta; el ultimo cae como carga extra
const WEIGHT_Z = DECK_Z0 + DECK_H;
const WEIGHTS = [
  { x: -54, y: 10, w: 26, d: 14 },
  { x: 28, y: 10, w: 26, d: 14 },
];
const EXTRA = { x: -13, y: 10, w: 26, d: 14, h: 9 };
function weights() {
  return WEIGHTS.map((w) => S_(k.slabOf({ ...w, r: 1.5 }, WEIGHT_Z, 9, P, 3, 0.5), { tone: "hi", crease: "lo" }) +
    L(k.lineOnTop([w.x + 3, w.y + w.d / 2], [w.x + w.w - 3, w.y + w.d / 2], WEIGHT_Z + 9, P), { tone: "faint", free: true })).join("");
}
function extra() {
  return S_(k.slabOf({ x: EXTRA.x, y: EXTRA.y, w: EXTRA.w, d: EXTRA.d, r: 1.5 }, WEIGHT_Z, EXTRA.h, P, 3, 0.5), { tone: "hi", crease: "lo" }) +
    L(k.lineOnTop([EXTRA.x + 3, EXTRA.y + EXTRA.d / 2], [EXTRA.x + EXTRA.w - 3, EXTRA.y + EXTRA.d / 2], WEIGHT_Z + EXTRA.h, P), { tone: "faint", free: true });
}

// --------------------------------------------------------------- sensor y caja
function sensor() {
  const out = [];
  const sx = CORE.x + CORE.w + 4;
  const sy = -33;
  out.push(S_(k.cylinder(sx, sy, 4.6, STATOR_BOTTOM - 5, 5, P, 20), { tone: "mid" }));
  out.push(S_(k.cylinder(sx, sy, 3, STATOR_BOTTOM - 7, 2, P, 20), { tone: "lo" }));
  out.push(L(k.ring(sx, sy, 1.6, STATOR_BOTTOM - 7, P, 14), { tone: "lit" }));
  return out.join("");
}

function box() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BOX, 0, BOX_H, P)}" style="filter:blur(5px)"/>`];
  out.push(S_(k.slabOf(BOX, 0, BOX_H, P, 5, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(BOX, 3), BOX_H, P), { tone: "faint" }));
  const screws = k.corners(BOX, 6);
  out.push(D(screws.map(([x, y]) => at([x, y, BOX_H])), { size: 0.45 }));
  // amperimetro
  const [x, y] = DIAL;
  out.push(S_(k.cylinder(x, y, DIAL_R, DIAL_Z, DIAL_H, P, 48, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, DIAL_R, DIAL_TOP - 3, DIAL_TOP, 60, P, 0.3), { tone: "lo" }));
  out.push(L(k.sideArc(x, y, DIAL_R, DIAL_TOP - 3, P, 30), { tone: "faint" }));
  out.push(L(k.ring(x, y, DIAL_R - 2, DIAL_TOP, P, 48), { tone: "lo" }));
  const ticks = k.radialTicks(x, y, DIAL_R - 2.6, 25, 5, DIAL_TOP, [1, 2.4], P, (Math.PI * 5) / 4, (Math.PI * 3) / 2);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.ring(x, y, 1.4, DIAL_TOP, P, 14), { tone: "mid" }));
  // perillas del PID (decorativas pero reales: kp y kd) y rotulo
  for (const [kx, ky] of [[126, 34], [126, 56]]) {
    out.push(S_(k.cylinder(kx, ky, 5, BOX_H, 4, P, 24), { tone: "mid" }));
    out.push(L(k.knurl(kx, ky, 5, BOX_H, BOX_H + 4, 22, P), { tone: "lo" }));
    out.push(L(k.lineOnTop([kx, ky], [kx + 3.6, ky - 1.4], BOX_H + 4, P), { tone: "hi" }));
  }
  const plate = { x: 76, y: 61, w: 40, d: 7, r: 1 };
  out.push(S_(k.slabOf(plate, BOX_H, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L([0, 1, 2].map((i) => k.lineOnTop([plate.x + 3, plate.y + 1.6 + i * 1.8], [plate.x + 3 + 26 - i * 5, plate.y + 1.6 + i * 1.8], BOX_H + 0.8, P)).join(""), { tone: "lo", free: true }));
  // pasacables
  out.push(S_(k.cylinder(BOX.x + 10, BOX.y + 8, 4, BOX_H, 5, P, 20), { tone: "lo" }));
  return out.join("");
}

const needleAt = (frac) => {
  const [x, y] = DIAL;
  const a = (Math.PI * 5) / 4 + frac * ((Math.PI * 3) / 2);
  // angulo 0 apunta a -y y crece en sentido horario visto desde arriba (como radialTicks)
  return k.lineOnTop([x - Math.sin(a) * 2.4, y + Math.cos(a) * 2.4], [x + Math.sin(a) * (DIAL_R - 4), y - Math.cos(a) * (DIAL_R - 4)], DIAL_TOP + 0.2, P);
};

// ------------------------------------------------------------------- pagina
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Banco de levitacion electromagnetica. Un modulo de iman con doce polos, norte en rojo y sur en azul, cuelga bajo un estator con diez milimetros de entrehierro. Una regla vertical con un puntero lee el entrehierro y un amperimetro lee la corriente. Un sensor y un lazo de control mantienen el modulo en su sitio: sin control, el equilibrio es inestable y el modulo se pega al estator o cae sobre los patines.",
  body: [
    bench(),
    panel(),
    pads(),
    `<g data-part="carriage" transform="${k.translateAlong(P, [0, 0, 0])}">${carriage()}</g>`,
    `<g data-part="weights" transform="${k.translateAlong(P, [0, 0, 0])}">${weights()}</g>`,
    `<g data-part="extra" transform="${k.translateAlong(P, [0, 0, 40])}" style="opacity:0">${extra()}</g>`,
    stator(),
    sensor(),
    box(),
    `<path data-part="needle" class="iso-line" data-tone="lit" data-free="start" d="${needleAt(0.4)}" style="stroke-width:1.1"/>`,
    `<g data-part="wire"></g>`,
    `<g data-part="led"></g>`,
  ],
});

const live = `
${physicsScript(["constants.js", "ems.js"], ["EmsSection", "EMS"])}
const P = ${JSON.stringify(P)};
const S = ${S}, GAP0 = ${GAP0};
const COIL_MID_Z = ${COIL_Z0 + COIL_H / 2};
const BOX_TERM = ${JSON.stringify([BOX.x + 10, BOX.y + 8, BOX_H + 5])};
const COIL_TERM = ${JSON.stringify([COIL.x + COIL.w - 8, COIL.y + COIL.d, COIL_Z0 + COIL_H / 2])};
const DIAL = ${JSON.stringify(DIAL)}, DIAL_R = ${DIAL_R}, DIAL_TOP = ${DIAL_TOP};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const q = (n) => svg.querySelector('[data-part="' + n + '"]');
const carriage = q("carriage"), extraEl = q("extra"), needle = q("needle"), wire = q("wire"), led = q("led");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const sec = new PHYS.EmsSection({ noise: 0 });
const IMAX = sec.Imax;
let loadOn = false, drop = 0, dropV = 0, pending = false;
let clock = 0, touring = !still.matches, visible = false, frame = 0, last = 0, idleTimer = 0, announce = "";

const needleAt = ${needleAt.toString().replace("k.lineOnTop", "lineOnTop")};
const wireD = (dz) => {
  const a = iso(BOX_TERM, P);
  const b = iso([COIL_TERM[0], COIL_TERM[1], COIL_TERM[2] + dz], P);
  const m1 = iso([BOX_TERM[0], BOX_TERM[1] - 8, 52], P);
  const m2 = iso([COIL_TERM[0] + 14, COIL_TERM[1] + 18, COIL_TERM[2] + dz * 0.5 + 10], P);
  return { a, b, m1, m2 };
};
const pt = (p) => p[0].toFixed(1) + " " + p[1].toFixed(1);

function stepModel(dt) {
  const n = Math.max(1, Math.round(dt / 0.001));
  for (let i = 0; i < n; i++) sec.step(0.001);
}

// la carga cae como un peso real: aceleracion y rebote casi nulo
function stepDrop(dt, calm) {
  if (loadOn && drop === 0 && !pending) return;
  const target = loadOn ? 0 : 46;
  if (calm) { drop = target; dropV = 0; } else {
    const w = 9;
    dropV += ((target - drop) * w * w - 2 * w * dropV) * dt;
    drop += dropV * dt;
  }
  if (loadOn && pending && drop < 0.6) { pending = false; sec.addLoad(); drop = 0; dropV = 0; }
  if (!loadOn && Math.abs(target - drop) < 0.2) { drop = target; dropV = 0; }
}
function setLoad(on) {
  if (on === loadOn) return;
  loadOn = on;
  if (on) { pending = true; drop = 46; dropV = 0; } else { pending = false; sec.clearLoad(); }
}
function setControl(on) {
  if (on) { sec.openLoop = false; sec.engage(); } else { sec.control = false; sec.openLoop = true; sec.kick(0.0004); } // el equilibrio es inestable: basta una perturbacion minima
}
function kick() { if (sec.control) sec.kick(0.002); }

// guion de la visita: cada 30 s repite lo esencial
const TOUR = [
  [3.0, () => kick()],
  [8.0, () => setLoad(true)],
  [15.0, () => setControl(false)],
  [18.0, () => { setControl(true); }],
  [24.0, () => setLoad(false)],
];
let tourDone = 0;

function draw() {
  const gap = sec.gap * 1000;
  const dz = -(gap - GAP0) * S;
  carriage.setAttribute("transform", translateAlong(P, [0, 0, dz]));
  q("weights").setAttribute("transform", translateAlong(P, [0, 0, dz]));
  extraEl.setAttribute("transform", translateAlong(P, [0, 0, dz + drop]));
  // la carga extra solo se ve cuando esta cerca de la cubierta: aparece al bajar y se desvanece al retirarse
  extraEl.style.opacity = String(clamp(1 - drop / 46, 0, 1).toFixed(2));
  needle.setAttribute("d", needleAt(clamp(sec.I / IMAX, 0, 1)));
  const w = wireD(dz);
  wire.innerHTML = '<g class="iso-wire" data-tone="mid"><path class="iso-line" data-tone="mid" d="M' + pt(w.a) + ' C' + pt(w.m1) + ' ' + pt(w.m2) + ' ' + pt(w.b) + '"/>' +
    '<circle class="iso-wire-end" cx="' + w.a[0].toFixed(1) + '" cy="' + w.a[1].toFixed(1) + '" r="1.2"/><circle class="iso-wire-end" cx="' + w.b[0].toFixed(1) + '" cy="' + w.b[1].toFixed(1) + '" r="1.2"/></g>';
  const lp = iso([${BOX.x + 52}, ${BOX.y + 8}, ${BOX_H}], P);
  led.innerHTML = '<circle cx="' + lp[0].toFixed(1) + '" cy="' + lp[1].toFixed(1) + '" r="1.9" class="iso-led" style="fill:' + (sec.control ? "var(--anatomy-green)" : "var(--anatomy-red)") + ';stroke:var(--anatomy-lo);stroke-width:.4"/>';
  let state = "levitando";
  if (sec.contact) state = "pegado al estator";
  else if (sec.fallen) state = "sobre los patines";
  else if (!sec.control) state = "sin control";
  else if (Math.abs(gap - GAP0) > 0.4) state = "corrigiendo";
  const text = gap.toFixed(2) + " mm · " + sec.I.toFixed(1) + " A · " + state;
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", "entrehierro " + gap.toFixed(2) + " mm, corriente " + sec.I.toFixed(1) + " A, " + (sec.control ? "control activo" : "control apagado") + ", " + state);
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) {
    clock += dt;
    while (tourDone < TOUR.length && clock >= TOUR[tourDone][0]) TOUR[tourDone++][1]();
    if (clock > 30) { clock = 0; tourDone = 0; }
  }
  stepDrop(dt, calm);
  stepModel(dt);
  draw();
  const moving = Math.abs(sec.gapVel) > 1e-5 || Math.abs(sec.I - sec.I0) > 0.01 || drop > 0.01 || touring || !sec.control;
  frame = visible && moving ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const takeOver = () => {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!still.matches) { touring = true; clock = 0; tourDone = 0; run(); } }, 3600);
};
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointerdown", () => { takeOver(); kick(); run(); });
stage.addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Enter") { e.preventDefault(); takeOver(); setControl(!sec.control); run(); }
  else if (e.key === "l" || e.key === "L") { takeOver(); setLoad(!loadOn); run(); }
  else if (e.key === "k" || e.key === "K") { takeOver(); kick(); run(); }
  else if (e.key === "Escape") { takeOver(); setLoad(false); setControl(true); run(); }
});
draw();
`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "Banco de levitación EMS",
  hint: "Clic · Espacio · L",
  readout: "10.00 mm · 50.0 A · levitando",
  keys: [
    { mark: "lit", label: "Módulo de imán: lo que el control mantiene a 10 mm del estator" },
    { mark: "red", label: "Polo norte" },
    { mark: "blue", label: "Polo sur" },
  ],
  caption:
    "Un imán de doce polos cuelga bajo un estator. La fuerza de atracción crece al cerrarse el entrehierro, así que el equilibrio es inestable: un golpe de 2 mm, una carga de 12 % o apagar el control bastan para que el módulo se pegue al estator o caiga sobre los patines. Con el lazo cerrado el sensor corrige la corriente y vuelve a los 10 mm. La regla marca el entrehierro y el amperímetro la corriente, ambos del mismo modelo que la simulación.",
  body: `<div class="iso-stage" tabindex="0" role="group" aria-label="Banco de levitación EMS. Espacio activa o apaga el control, L añade o quita una carga de 12 por ciento, K da un golpe de 2 milímetros." aria-valuetext="entrehierro 10.00 mm">${svg}</div>`,
});

const html = k.pageHtml({ title: "Banco de levitación EMS", theme, body, script: kitScript() + live }).replace('<html lang="en">', '<html lang="es">');
const out = join(HERE, theme === "light" ? "ems-levitacion-light.html" : "ems-levitacion.html");
writeFileSync(out, html);
console.log("wrote", out);
