// Fig 2. Banco del motor lineal sincrono (LSM).
// Un estator largo con bobinas que se energizan en onda y un vehiculo con cuatro
// polos (N S N S) que se acopla a ella. La frecuencia fija la velocidad de la onda
// (v = 2 * tau * f); el angulo de carga delta es lo que el vehiculo se retrasa.
// Todo sale de SyncDrive (src/physics/lsm.js), el modelo con tests.
//
//   node figures/lsm-sincrono/build.mjs [--light]

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../vendor/anatomy/kit/iso-kit.mjs";
import { kitScript } from "../../vendor/anatomy/scripts/inline-kit.mjs";
import { physicsScript } from "../lib/physics-inline.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 680;
const HEIGHT = 300;

// escala: tau = 258 mm = TAU px  =>  1 px = 7.17 mm
const TAU = 36;
const PX_M = 0.258 / TAU;
const COILS = 35;
const PITCH = 12; // tau / 3
const RAIL_X0 = -210;
const RAIL_W = 420;

const PLATE = { x: -232, y: -52, w: 464, d: 150, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;
const STATOR = { x: RAIL_X0, y: -17, w: RAIL_W, d: 34, r: 2 };
const STATOR_TOP = 16;
const GUIDE_Y = [-37, 31];
const GUIDE_H = 8;
const CAR_LEN = 4 * TAU; // 144
const MAG_Z0 = STATOR_TOP + 4;
const MAG_H = 10;
const BAR_Z0 = MAG_Z0 + 4;
const XLIM = RAIL_W / 2 - CAR_LEN / 2 - 10; // recorrido del centro del vehiculo

const CAB = { x: 140, y: 58, w: 80, d: 34, r: 4 };
const CAB_H = 28;
const DIAL_F = [160, 78];
const DIAL_D = [198, 78];
const DIAL_R = 12.5;
const DIAL_TOP = CAB_H + 7;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [RAIL_X0, STATOR.y, 40], [RAIL_X0 + RAIL_W, STATOR.y + STATOR.d, 40]],
  WIDTH,
  HEIGHT,
  { pad: 6, azimuth: 66, elevation: 34 },
);

const at = (point) => k.iso(point, P);
const S_ = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const seg = (a, b) => k.segment(a, b, P);
const byDepth = (items, key = (i) => i) => [...items].sort((a, b) => k.depthOf([...key(a).slice(0, 2), 0], P) - k.depthOf([...key(b).slice(0, 2), 0], P));

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
  // regla de posicion: una marca por paso polar, mayor cada dos (par de polos)
  const strip = { x: RAIL_X0, y: 46, w: RAIL_W, d: 4.5, r: 0.8 };
  out.push(S_(k.slabOf(strip, 0, 0.6, P, 2), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 2, strip.x + strip.w - 2, TAU / 3, 6, strip.y + 0.6, 0.6, [1.8, 3.2], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  return out.join("");
}

function guides() {
  const out = [];
  for (const y of GUIDE_Y) {
    out.push(S_(k.slabOf({ x: RAIL_X0 + 6, y, w: RAIL_W - 12, d: 6, r: 1 }, 0, GUIDE_H, P, 3, 0.5), { tone: "hi", crease: "lo" }));
  }
  // topes con taco de goma en los dos extremos
  for (const x of [RAIL_X0, RAIL_X0 + RAIL_W - 6]) {
    for (const y of GUIDE_Y) {
      out.push(S_(k.slabOf({ x, y: y - 3, w: 6, d: 12, r: 1.2 }, 0, 12, P, 3, 0.5), { tone: "mid" }));
      const face = x < 0 ? x + 6 : x;
      out.push(D([at([x + 3, y + 3, 12])], { size: 0.45 }));
      void face;
    }
  }
  return out.join("");
}

function stator() {
  const out = [];
  out.push(S_(k.slabOf(STATOR, 0, STATOR_TOP, P, 3, 0.7), { tone: "mid" }));
  // juntas entre bobinas: de cara a cara en el frente
  const front = STATOR.y + STATOR.d;
  const joints = [];
  for (let j = 1; j < COILS; j++) joints.push(seg([RAIL_X0 + j * PITCH, front, 0], [RAIL_X0 + j * PITCH, front, STATOR_TOP]));
  out.push(L(joints.join(""), { tone: "faint" }));
  // bornes de las tres fases en el extremo derecho
  const tb = { x: RAIL_X0 + RAIL_W - 2, y: -13, w: 12, d: 26, r: 1.5 };
  out.push(S_(k.slabOf(tb, 0, 10, P, 3, 0.4), { tone: "lo" }));
  return out.join("");
}

// ------------------------------------------------------------------ vehiculo
const MAGS = [0, 1, 2, 3].map((i) => ({ x: -CAR_LEN / 2 + i * TAU + 1, y: -15, w: TAU - 2, d: 30, r: 1.5, north: i % 2 === 0 }));
const BUSH = [
  [-CAR_LEN / 2 + 12, GUIDE_Y[0] + 3],
  [CAR_LEN / 2 - 12, GUIDE_Y[0] + 3],
  [-CAR_LEN / 2 + 12, GUIDE_Y[1] + 3],
  [CAR_LEN / 2 - 12, GUIDE_Y[1] + 3],
];

function magnetFace(m, z, north, face) {
  // cara polar de color (rojo = N, azul = S) sobre el plano z o la cara frontal
  const tone = north ? "red" : "blue";
  const pts = face === "top"
    ? [at([m.x + 1.5, m.y + 1.5, z]), at([m.x + m.w - 1.5, m.y + 1.5, z]), at([m.x + m.w - 1.5, m.y + m.d - 1.5, z]), at([m.x + 1.5, m.y + m.d - 1.5, z])]
    : [at([m.x + 1.5, m.y + m.d, z - MAG_H + 1.2]), at([m.x + m.w - 1.5, m.y + m.d, z - MAG_H + 1.2]), at([m.x + m.w - 1.5, m.y + m.d, z - 1.2]), at([m.x + 1.5, m.y + m.d, z - 1.2])];
  return `<path d="M${pts.map((p) => p.join(" ")).join("L")}Z" style="fill:var(--anatomy-${tone});opacity:.88;stroke:none"/>`;
}

function carriage() {
  const out = [];
  const bushing = ([x, y]) => S_(k.cylinder(x, y, 4, 8, BAR_Z0 - 8, P, 18), { tone: "mid" });
  const bar = (y) => S_(k.slabOf({ x: -CAR_LEN / 2, y, w: CAR_LEN, d: 6, r: 1.5 }, BAR_Z0, 8, P, 3, 0.5), { tone: "hi", crease: "lo" });
  // lado lejano
  out.push(...BUSH.filter(([, y]) => y < 0).map(bushing));
  out.push(bar(GUIDE_Y[0]));
  // imanes: de atras hacia adelante segun la profundidad
  for (const m of byDepth(MAGS, (m) => [m.x + m.w / 2, m.y + m.d / 2])) {
    out.push(S_(k.slabOf(m, MAG_Z0, MAG_H, P, 3, 0.6), { tone: "mid" }));
    out.push(magnetFace(m, MAG_Z0 + MAG_H, m.north, "top"));
    out.push(magnetFace(m, MAG_Z0 + MAG_H, m.north, "front"));
  }
  // travesanos que unen los dos lados por encima de los imanes
  const ribs = [-CAR_LEN / 2, -TAU + 0, 0, TAU - 6, CAR_LEN / 2 - 6].map((x) => Math.round(x));
  for (const x of ribs) out.push(S_(k.slabOf({ x, y: GUIDE_Y[0], w: 6, d: GUIDE_Y[1] + 6 - GUIDE_Y[0], r: 1.2 }, BAR_Z0 + 8, 4, P, 3, 0.4), { tone: "mid" }));
  out.push(...BUSH.filter(([, y]) => y > 0).map(bushing));
  out.push(bar(GUIDE_Y[1]));
  out.push(D([at([-CAR_LEN / 2 + 8, GUIDE_Y[1] + 6, BAR_Z0 + 4]), at([CAR_LEN / 2 - 8, GUIDE_Y[1] + 6, BAR_Z0 + 4])], { size: 0.45 }));
  // bandera lit de referencia: marca el centro del vehiculo en la regla
  out.push(S_(k.slabOf({ x: -1.5, y: 42, w: 3, d: 6, r: 0.8 }, BAR_Z0, 4, P, 2), { tone: "hi", lit: true }));
  out.push(S_(k.slabOf({ x: -1.5, y: GUIDE_Y[1] + 5, w: 3, d: 38 - GUIDE_Y[1] - 5, r: 0.8 }, BAR_Z0, 2, P, 2), { tone: "mid", crease: "none" }));
  return out.join("");
}

function cabinet() {
  const out = [`<path class="iso-halo" d="${k.haloOf(CAB, 0, CAB_H, P)}" style="filter:blur(5px)"/>`];
  out.push(S_(k.slabOf(CAB, 0, CAB_H, P, 5, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(CAB, 3), CAB_H, P), { tone: "faint" }));
  out.push(D(k.corners(CAB, 6).map(([x, y]) => at([x, y, CAB_H])), { size: 0.45 }));
  for (const [x, y] of [DIAL_F, DIAL_D]) {
    out.push(S_(k.cylinder(x, y, DIAL_R, CAB_H, 7, P, 40, 0.5), { tone: "hi", crease: "lo" }));
    out.push(L(k.knurl(x, y, DIAL_R, DIAL_TOP - 2.6, DIAL_TOP, 52, P, 0.3), { tone: "lo" }));
    out.push(L(k.ring(x, y, DIAL_R - 1.8, DIAL_TOP, P, 40), { tone: "lo" }));
    const t = k.radialTicks(x, y, DIAL_R - 2.4, 24, 6, DIAL_TOP, [0.9, 2.1], P);
    out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
    out.push(L(k.ring(x, y, 1.2, DIAL_TOP, P, 12), { tone: "mid" }));
  }
  // bornes de las tres fases en el borde trasero de la caja
  const terms = [0, 1, 2].map((i) => [CAB.x + 14 + i * 12, CAB.y + 6]);
  for (const [x, y] of terms) out.push(S_(k.cylinder(x, y, 2.6, CAB_H, 3, P, 16), { tone: "lo" }));
  const plate = { x: CAB.x + 8, y: CAB.y + CAB.d - 9, w: 38, d: 6, r: 1 };
  out.push(S_(k.slabOf(plate, CAB_H, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L([0, 1, 2].map((i) => k.lineOnTop([plate.x + 3, plate.y + 1.2 + i * 1.5], [plate.x + 3 + 24 - i * 5, plate.y + 1.2 + i * 1.5], CAB_H + 0.8, P)).join(""), { tone: "lo", free: true }));
  // tres cables de fase hacia los bornes del estator (puntos terminales sobre las piezas)
  const tb = [RAIL_X0 + RAIL_W + 4, -7 + 0];
  void tb;
  return out.join("");
}

function phaseWires() {
  const out = [];
  const terms = [0, 1, 2].map((i) => [CAB.x + 14 + i * 12, CAB.y + 6, CAB_H + 3]);
  const tb = [0, 1, 2].map((i) => [RAIL_X0 + RAIL_W + 4, -8 + i * 8, 10]);
  ["hi", "mid", "lo"].forEach((tone, i) => {
    const a = at(terms[i]);
    const b = at(tb[i]);
    const m1 = at([terms[i][0], terms[i][1] - 6, 46 - i * 5]);
    const m2 = at([tb[i][0] + 8, tb[i][1] + 6 + i * 3, 30 - i * 4]);
    out.push(`<g class="iso-wire" data-tone="${tone}"><path class="iso-line" data-tone="${tone}" d="M${a.join(" ")}C${m1.join(" ")} ${m2.join(" ")} ${b.join(" ")}"/><circle class="iso-wire-end" cx="${a[0].toFixed(1)}" cy="${a[1].toFixed(1)}" r="1.2"/><circle class="iso-wire-end" cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="1.2"/></g>`);
  });
  return out.join("");
}

const needlePath = (cx, cy, angle) =>
  k.lineOnTop([cx - Math.sin(angle) * 2.2, cy + Math.cos(angle) * 2.2], [cx + Math.sin(angle) * (DIAL_R - 3.4), cy - Math.cos(angle) * (DIAL_R - 3.4)], DIAL_TOP + 0.2, P);

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Banco del motor lineal sincrono. Un estator largo de treinta y cinco bobinas muestra una onda de campo que viaja, con rojo para norte y azul para sur. Un vehiculo con cuatro polos alternos, rojo y azul, rueda sobre dos carriles y sigue la onda sin deslizar: la frecuencia fija su velocidad, v igual a dos veces el paso polar por la frecuencia. Un cuadro con dos diales lee la frecuencia y el angulo de carga, que es lo que el vehiculo se retrasa respecto de la onda.",
  body: [
    bench(),
    guides(),
    stator(),
    `<g data-part="patches"></g>`,
    `<g data-part="carriage" transform="${k.translateAlong(P, [0, 0, 0])}">${carriage()}</g>`,
    cabinet(),
    phaseWires(),
    `<path data-part="needleF" class="iso-line" data-tone="lit" data-free="start" d="${needlePath(DIAL_F[0], DIAL_F[1], 0)}" style="stroke-width:1"/>`,
    `<path data-part="needleD" class="iso-line" data-tone="lit" data-free="start" d="${needlePath(DIAL_D[0], DIAL_D[1], 0)}" style="stroke-width:1"/>`,
    `<g data-part="leds"></g>`,
  ],
});

const live = `
${physicsScript(["constants.js", "lsm.js"], ["SyncDrive"])}
const P = ${JSON.stringify(P)};
const TAU = ${TAU}, PX_M = ${PX_M}, COILS = ${COILS}, PITCH = ${PITCH};
const RAIL_X0 = ${RAIL_X0}, STATOR_Y0 = ${STATOR.y}, STATOR_Y1 = ${STATOR.y + STATOR.d}, STATOR_TOP = ${STATOR_TOP};
const XLIM = ${XLIM};
const DIAL_F = ${JSON.stringify(DIAL_F)}, DIAL_D = ${JSON.stringify(DIAL_D)}, DIAL_R = ${DIAL_R}, DIAL_TOP = ${DIAL_TOP};
const LED_POS = ${JSON.stringify([0, 1, 2].map((i) => [CAB.x + 14 + i * 12, CAB.y + 6, CAB_H + 3]))};
const FMAX = 0.75;
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const q = (n) => svg.querySelector('[data-part="' + n + '"]');
const patches = q("patches"), carriage = q("carriage"), nF = q("needleF"), nD = q("needleD"), leds = q("leds");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const drive = new PHYS.SyncDrive();
// resistencia al avance cuadratica (como la del aire): 0.8 N a la velocidad maxima
const DRAG_K = 0.8 / Math.pow(2 * drive.tau * FMAX, 2);
let f = 0, fTarget = 0, touring = !still.matches, visible = false, frame = 0, last = 0, idleTimer = 0, slip = false, slipHold = 0;

const needleD = ${needlePath.toString().replace(/k\.lineOnTop/, "lineOnTop")};
const px = (xm) => xm / PX_M;

function stepModel(dt) {
  const n = Math.max(1, Math.round(dt / 0.002));
  const h = dt / n;
  const xmax = XLIM * PX_M;
  for (let i = 0; i < n; i++) {
    const load = DRAG_K * drive.v * Math.abs(drive.v);
    drive.step(h, f, load);
    // topes: el vehiculo no sale de la via; si choca, la onda sigue y el angulo de carga crece
    if (drive.x > xmax) { drive.x = xmax; if (drive.v > 0) drive.v = 0; }
    if (drive.x < -xmax) { drive.x = -xmax; if (drive.v < 0) drive.v = 0; }
  }
}

function drawPatches() {
  const out = [];
  for (let j = 0; j < COILS; j++) {
    const xa = RAIL_X0 + j * PITCH + 0.8, xb = RAIL_X0 + (j + 1) * PITCH - 0.8;
    const b = drive.waveAt(((xa + xb) / 2) * PX_M);
    const amp = Math.pow(Math.abs(b), 0.7) * Math.min(1, Math.abs(f) / 0.08);
    if (amp < 0.04) continue;
    const a = iso([xa, STATOR_Y0 + 1.6, STATOR_TOP], P), bb = iso([xb, STATOR_Y0 + 1.6, STATOR_TOP], P), c = iso([xb, STATOR_Y1 - 1.6, STATOR_TOP], P), d = iso([xa, STATOR_Y1 - 1.6, STATOR_TOP], P);
    out.push('<path d="M' + [a, bb, c, d].map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L") + 'Z" style="fill:var(--anatomy-' + (b > 0 ? "blue" : "red") + ');opacity:' + (0.15 + 0.7 * amp).toFixed(2) + ';stroke:none"/>');
  }
  patches.innerHTML = out.join("");
}

function draw() {
  const xc = px(drive.x);
  carriage.setAttribute("transform", translateAlong(P, [xc, 0, 0]));
  drawPatches();
  nF.setAttribute("d", needleD(DIAL_F[0], DIAL_F[1], (f / FMAX) * (Math.PI * 0.75)));
  nD.setAttribute("d", needleD(DIAL_D[0], DIAL_D[1], drive.delta));
  const th = drive.thetaW;
  let h = "";
  for (let i = 0; i < 3; i++) {
    const cur = Math.sin(th - (i * 2 * Math.PI) / 3) * Math.min(1, Math.abs(f) / 0.08);
    const p = iso(LED_POS[i], P);
    h += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="1.9" style="fill:var(--anatomy-' + (cur > 0 ? "blue" : "red") + ');opacity:' + (0.15 + 0.8 * Math.abs(cur)).toFixed(2) + ';stroke:var(--anatomy-lo);stroke-width:.4"/>';
  }
  leds.innerHTML = h;
  const slipping = Math.abs(f) > 0.05 && Math.abs(drive.v - drive.syncSpeed(f)) > Math.abs(drive.syncSpeed(f)) * 0.25 + 0.01;
  if (slipping) slipHold = 0.8;
  const deg = drive.delta * 180 / Math.PI;
  const atStop = Math.abs(px(drive.x)) >= XLIM - 0.5 && Math.abs(f) > 0.02;
  const state = atStop ? "en el tope" : slipHold > 0 ? "pierde el sincronismo" : Math.abs(f) < 0.02 && Math.abs(drive.v) < 0.005 ? "parado" : drive.force * drive.v < -0.02 ? "frenando" : "sincronizado";
  const text = (f >= 0 ? "+" : "") + f.toFixed(2) + " Hz · " + (drive.v >= 0 ? "+" : "") + drive.v.toFixed(2) + " m/s · δ " + (Math.round(deg) === 0 ? "" : deg > 0 ? "+" : "") + Math.round(deg) + "° · " + state;
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", "frecuencia " + f.toFixed(2) + " hercios, velocidad " + drive.v.toFixed(2) + " metros por segundo, angulo de carga " + deg.toFixed(0) + " grados, " + state);
}

// guion: el vehiculo rebota entre los topes (acelera, frena con angulo negativo, invierte)
// y una vez por vuelta recibe un salto brusco de frecuencia que rompe el sincronismo
let sweeps = 0, jumped = false, calmFor = 0;
function tourStep(dt) {
  const xp = px(drive.x);
  calmFor = Math.max(0, calmFor - dt);
  if (calmFor > 0) return;
  if (fTarget === 0 && Math.abs(drive.v) < 0.02) { fTarget = xp > 0 ? -0.5 : 0.5; return; }
  if (xp > XLIM - 80 && fTarget > 0) { fTarget = -0.5; sweeps++; jumped = false; }
  else if (xp < -XLIM + 80 && fTarget < 0) { fTarget = 0.5; sweeps++; jumped = false; }
  else if (sweeps % 3 === 2 && !jumped && fTarget > 0 && xp > -90 && xp < -60 && Math.abs(drive.v - drive.syncSpeed(f)) < 0.01) {
    jumped = true; jump(0.75); calmFor = 5; // la onda acelera de golpe; tras 5 s el guion vuelve a su objetivo
  }
}
function jump(v) { f = v; fTarget = v; } // salto sin rampa: la onda acelera mas de lo que el empuje maximo permite
function setTarget(v) { fTarget = clamp(v, -FMAX, FMAX); }

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) tourStep(dt);
  // la frecuencia sigue su objetivo con una rampa suave (limite de variacion)
  const rate = 0.22;
  f = calm ? fTarget : f + clamp(fTarget - f, -rate * dt, rate * dt);
  slipHold = Math.max(0, slipHold - dt);
  stepModel(dt);
  draw();
  const moving = touring || Math.abs(f - fTarget) > 1e-4 || Math.abs(drive.v) > 1e-3 || Math.abs(f) > 1e-3 || slipHold > 0;
  frame = visible && moving ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const takeOver = () => { touring = false; clearTimeout(idleTimer); idleTimer = setTimeout(() => { if (!still.matches) { touring = true; fTarget = 0; calmFor = 0; run(); } }, 3600); };
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (e) => {
  const box = svg.getBoundingClientRect();
  const share = clamp(((e.clientX - box.left) / box.width - 0.5) / 0.35, -1, 1);
  takeOver(); setTarget(Math.abs(share) < 0.08 ? 0 : share * FMAX); run();
});
stage.addEventListener("pointerleave", () => { setTarget(0); run(); });
stage.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") { e.preventDefault(); takeOver(); setTarget(Math.round((fTarget + (e.shiftKey ? 0.25 : 0.05)) * 100) / 100); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); takeOver(); setTarget(Math.round((fTarget - (e.shiftKey ? 0.25 : 0.05)) * 100) / 100); }
  else if (e.key === " " || e.key === "Escape" || e.key === "Home") { e.preventDefault(); takeOver(); setTarget(0); }
  else if (e.key === "j" || e.key === "J") { takeOver(); jump(fTarget >= 0 ? 0.75 : -0.75); }
  else return;
  run();
});
draw();
`;

const body = k.plateHtml({
  fig: "Fig 2",
  title: "Banco del motor lineal síncrono",
  hint: "Mueve el cursor · J: salto",
  readout: "+0.00 Hz · +0.00 m/s · δ 0° · parado",
  keys: [
    { mark: "red", label: "Polo norte" },
    { mark: "blue", label: "Polo sur" },
    { mark: "lit", label: "Agujas: frecuencia y ángulo de carga δ" },
  ],
  caption:
    "El estator se energiza como una onda de campo que avanza a v = 2·τ·f (τ = 258 mm). El vehículo, con cuatro polos, la sigue sin deslizar. En régimen queda un ángulo de carga δ detrás de la onda; al frenar δ es negativo y el motor devuelve energía; y si la frecuencia salta más rápido de lo que el empuje máximo permite, el vehículo pierde el sincronismo. Pulsa J para provocarlo.",
  body: `<div class="iso-stage" tabindex="0" role="group" aria-label="Banco del motor lineal síncrono. Las flechas izquierda y derecha cambian la frecuencia, Espacio la lleva a cero y J da un salto brusco que hace perder el sincronismo." aria-valuetext="frecuencia 0 hercios">${svg}</div>`,
});

const html = k.pageHtml({ title: "Banco del motor lineal síncrono", theme, body, script: kitScript() + live }).replace('<html lang="en">', '<html lang="es">');
const out = join(HERE, theme === "light" ? "lsm-sincrono-light.html" : "lsm-sincrono.html");
writeFileSync(out, html);
console.log("wrote", out);
