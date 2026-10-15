import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Train } from "./physics/train.js";
import { G } from "./physics/constants.js";
import { createWorld } from "./scene/world.js";
import { createEmsScene } from "./scene/emsScene.js";
import { createEdsScene } from "./scene/edsScene.js";
import { createEmsFields, updateEmsGlow } from "./scene/emsFields.js";
import { createEdsFields, updateEdsGlow } from "./scene/edsFields.js";
import { setLineResolution } from "./scene/lines.js";
import { createLabels } from "./scene/labels.js";
import { createStations } from "./scene/stations.js";
import { DIM } from "./scene/ems.js";
import { D as EDIM } from "./scene/edsGeo.js";
import { createUI } from "./ui/ui.js";
import "./ui/style.css";

const canvas = document.getElementById("view");
const world = createWorld(canvas);
const { renderer, scene } = world;
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 4000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.62;

const train = new Train("ems");
const scenes = { ems: createEmsScene(world), eds: createEdsScene(world) };
const fields = { ems: createEmsFields(scenes.ems), eds: createEdsFields(scenes.eds) };
scene.add(scenes.ems.group, scenes.eds.group);
const stations = createStations();
scene.add(stations.group);
const STATION_CFG = { ems: { floorY: 7.62, zIn: 2.5 }, eds: { floorY: 6.25, zIn: 2.7 } };
let mode = "ems";
let active = scenes.ems;

const view = {
  exag: { ems: 8, eds: 3 },
  timeScale: 5,
  rig: "orbit",
  body: "auto",
  paused: false,
  layers: { fields: true, wave: true, forces: true, labels: true },
};
const rigMinExag = () => active.rigs[view.rig].minExag ?? 0;
const effExag = () => Math.max(view.exag[mode], rigMinExag());

// ---- carroceria: solida, rayos X o corte ----
const planes = {
  x: new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0),
  z: new THREE.Plane(new THREE.Vector3(0, 0, -1), 0),
};
function applyBody() {
  const rig = active.rigs[view.rig];
  const bodyMode = view.body === "auto" ? rig.body : view.body;
  let plane = null;
  if (bodyMode === "cut") {
    const cut = rig.cut ?? { axis: "z", c: 0 };
    plane = planes[cut.axis];
    plane.constant = cut.c;
  }
  for (const sc of Object.values(scenes)) {
    const on = sc === active;
    sc.capGroup.visible = on && plane === planes.x;
    for (const m of sc.clipMats) {
      m.clippingPlanes = on && plane ? [plane] : null;
      m.clipShadows = true;
      if (m.userData.baseSide === undefined) m.userData.baseSide = m.side;
      m.side = on && plane ? THREE.DoubleSide : m.userData.baseSide;
    }
    for (const m of sc.bodyMats) {
      const x = on && bodyMode === "xray";
      m.transparent = x;
      m.opacity = x ? 0.18 : 1;
      m.depthWrite = !x;
      m.needsUpdate = true;
    }
  }
}

// ---- camaras con transicion ----
const tween = { active: false, pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 50 };
controls.addEventListener("start", () => (tween.active = false));
function setRig(name, instant = false) {
  view.rig = name;
  const r = active.rigs[name];
  tween.pos.set(...r.pos);
  tween.target.set(...r.target);
  tween.fov = r.fov;
  tween.active = !instant;
  if (instant) {
    camera.position.copy(tween.pos);
    controls.target.copy(tween.target);
    camera.fov = r.fov;
    camera.updateProjectionMatrix();
    controls.update();
  }
  applyBody();
  document.querySelectorAll("#cams [data-rig]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.rig === name)));
}

// ---- etiquetas ----
let labels;
function buildLabels() {
  labels.clear();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const midGroup = () => active.sections[Math.floor(active.sections.length / 2)].group.position;
  if (mode === "ems") {
    const gv = () => train.sections[1].gap * effExag();
    labels.add({ text: () => `Entrehierro: ${(train.sections[1].gap * 1000).toFixed(2)} mm`, pos: () => V(0, DIM.statorBottom - gv() / 2, 1.15), rigs: ["gap", "section"] });
    labels.add({ text: () => "Estator (devanado trifásico)", pos: () => V(2.0, DIM.statorBottom + 0.3, 1.15), rigs: ["gap", "section"], cls: "s" });
    labels.add({ text: () => "Imán de sustentación (polos N/S)", pos: () => V(-1.6, DIM.statorBottom - gv() - 0.55, 1.15), rigs: ["gap", "section"], cls: "n" });
    labels.add({ text: () => "Riel de guiado", pos: () => V(0, DIM.railY1 + 0.15, 1.58), rigs: ["gap", "section"] });
    labels.add({ text: () => "Imán de guiado", pos: () => V(2.2, (DIM.railY0 + DIM.railY1) / 2 - (DIM.plateTop + DIM.floorClear) + midGroup().y - 0.4, 1.8), rigs: ["gap", "section"], cls: "n" });
    labels.add({ text: () => "Viga guía en T", pos: () => V(0, DIM.webTop - 0.4, 0), rigs: ["section", "orbit"] });
    labels.add({ text: () => "Vehículo (3 secciones)", pos: () => V(0, DIM.plateTop + DIM.floorClear + 4.0, 0), rigs: ["orbit", "chase"] });
    labels.add({ text: () => "Onda del estator: avanza con el tren", pos: () => V(-8, 6.2, 1.6), rigs: ["chase"], cls: "s" });
  } else {
    const gap = () => train.sections[1].gap;
    labels.add({ text: () => `Elevación: ${(gap() * 1000).toFixed(1)} mm`, pos: () => V(0, EDIM.slabTop + 0.1, 0), rigs: ["section", "gap"] });
    labels.add({ text: () => "Bobinas de propulsión", pos: () => V(1.4, EDIM.propY + 0.5, 1.93), rigs: ["gap", "section"], cls: "s" });
    labels.add({ text: () => "Bobinas de levitación en 8", pos: () => V(-1.6, EDIM.levY - 0.9, 1.93), rigs: ["gap", "section"], cls: "n" });
    labels.add({ text: () => "Imán superconductor (criostato)", pos: () => V(0.0, EDIM.slabTop + 2.35, 1.6), rigs: ["gap", "section"], cls: "n" });
    labels.add({ text: () => (train.sections[1].wheelsDown ? "Ruedas extendidas" : "Ruedas retraídas"), pos: () => V(0, EDIM.slabTop + 0.5, 0.85), rigs: ["section"] });
    labels.add({ text: () => "Vía en U", pos: () => V(0, EDIM.slabTop - 0.6, 2.3), rigs: ["section", "orbit"] });
    labels.add({ text: () => "Vehículo (3 secciones)", pos: () => V(0, EDIM.slabTop + 4.4, 0), rigs: ["orbit", "chase"] });
  }
}

// ---- interfaz ----
const ui = createUI({
  setMode,
  setTarget: (kmh) => train.setTargetSpeedKmh(kmh),
  setTimeScale: (x) => (view.timeScale = x),
  setPaused: (p) => (view.paused = p),
  setRig: (name) => setRig(name),
  setBody: (b) => {
    view.body = b;
    applyBody();
  },
  setLayer: (name, on) => (view.layers[name] = on),
  setExag: (v) => (view.exag[mode] = v),
  setSpacing: (m) => train.setSpacing(m),
  setHold: (on) => (train.hold = on),
  depart,
  reset: () => {
    train.reset();
    ui.hist.clear();
  },
  perturb,
});
labels = createLabels(ui.els.labels);

function setMode(next) {
  if (next === mode) return;
  mode = next;
  train.setMode(next);
  active = scenes[next];
  scenes.ems.group.visible = next === "ems";
  scenes.eds.group.visible = next === "eds";
  ui.build(next);
  ui.els.exag.value = String(view.exag[next]);
  ui.setExagText();
  buildLabels();
  setRig("orbit", true);
}

function depart() {
  train.hold = false;
  document.getElementById("stopBtn")?.setAttribute("aria-pressed", "false");
  if (train.state === "estacion") train.stateTime = Math.max(train.stateTime, train.dwell - 8);
  ui.toast("Salida solicitada");
}

const midIdx = () => Math.floor(train.sections.length / 2);
function slowForPerturbation() {
  if (view.timeScale > 2) {
    view.timeScale = 1;
    document.querySelectorAll("#timeBtns [data-ts]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.ts === "1")));
    ui.toast("Escala de tiempo fijada en x1 para ver la respuesta");
  }
}
function perturb(kind, btn) {
  const s = train.sections[midIdx()];
  const W = (s.mass + s.extraMass) * G;
  if (kind === "load") {
    if (s.extraMass > 0) s.clearLoad();
    else s.addLoad();
    ui.toast(s.extraMass > 0 ? "Carga añadida: la sección 2 pesa un 12 % más" : "Carga retirada");
    slowForPerturbation();
  } else if (kind === "gust") {
    s.addGust(0.1 * W, 0.6);
    slowForPerturbation();
    ui.toast("Ráfaga lateral del 10 % del peso durante 0,6 s");
  } else if (kind === "kick") {
    s.kick(mode === "ems" ? 0.002 : 0.015);
    slowForPerturbation();
  } else if (kind === "ctrlOff" && mode === "ems") {
    const on = btn.getAttribute("aria-pressed") !== "true";
    btn.setAttribute("aria-pressed", String(on));
    if (on) {
      s.control = false;
      s.openLoop = true;
      s.kick(0.0005);
      slowForPerturbation();
      ui.toast("Control apagado en la sección 2 con la corriente fija: el equilibrio es inestable");
    } else {
      s.openLoop = false;
      s.engage();
      ui.toast("Control reactivado: el vehículo vuelve a su entrehierro");
    }
  } else if (kind === "cutPower" && mode === "ems") {
    train.sections.forEach((q) => q.release());
    slowForPerturbation();
    ui.toast("Corriente cortada: el tren cae a los patines y se re-levanta solo");
    // solo si seguimos en EMS: al cambiar de modo las secciones son otras y no tienen engage()
    setTimeout(() => {
      if (mode === "ems") train.sections.forEach((q) => q.engage?.());
    }, 3500);
  }
}

// ---- tamano ----
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  setLineResolution(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

buildLabels();
scenes.eds.group.visible = false;
setRig("orbit", true);

// ---- bucle ----
let last = performance.now();
const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!view.paused) {
    // trozos de a lo sumo 20 ms: mantiene el historial y la precision con escalas altas
    let left = dt * view.timeScale;
    while (left > 1e-9) {
      const chunk = Math.min(left, 0.02);
      train.advance(chunk);
      left -= chunk;
    }
  }
  const sc = train.x - train.length / 2;
  world.updateTrees(sc);
  world.gTex.offset.x = sc / world.GROUND_TILE;
  stations.update(sc, train.length, train.stationSpacing, STATION_CFG[mode]);
  const tel = train.telemetry();
  const v2 = { ...view, exag: effExag() };
  active.update(tel, train, v2, dt);
  if (mode === "ems") {
    fields.ems.update(tel, train, v2);
    updateEmsGlow(tel, train, v2);
  } else {
    fields.eds.update(tel, train, v2);
    updateEdsGlow(tel, train, v2);
  }

  if (tween.active) {
    const k = reduced ? 1 : 1 - Math.exp(-dt * 5);
    camera.position.lerp(tween.pos, k);
    controls.target.lerp(tween.target, k);
    camera.fov += (tween.fov - camera.fov) * k;
    camera.updateProjectionMatrix();
    if (camera.position.distanceTo(tween.pos) < 0.02) tween.active = false;
  }
  controls.update();
  renderer.render(scene, camera);
  labels.update(camera, view.rig, view.layers.labels, window.innerWidth, window.innerHeight);
  ui.update(tel, train, view);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__THREE = THREE;
window.__app = { train, view, setRig, setMode, applyBody, camera, controls, scene, scenes, ui, perturb, depart };
