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
controls.minDistance = 3;
controls.maxDistance = 420;
controls.screenSpacePanning = true;

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

// Las lineas de flujo se dibujan sin prueba de profundidad: solo tienen sentido
// cuando los imanes estan a la vista (vistas de detalle, rayos X o corte).
function magnetsVisible() {
  const rig = active.rigs[view.rig];
  const bodyMode = view.body === "auto" ? rig.body : view.body;
  return DETAIL.includes(view.rig) || bodyMode !== "solid";
}

// ---- camaras con transicion ----
const tween = { active: false, pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 50 };
controls.addEventListener("start", () => (tween.active = false));
function setRig(name, instant = false) {
  view.rig = name;
  const r = active.rigs[name];
  tween.target.set(...r.target);
  // en pantallas verticales el campo horizontal es estrecho: se aleja la camara
  const far = Math.min(2.4, Math.max(1, (1.3 / camera.aspect) ** 0.6));
  tween.pos.set(...r.pos).sub(tween.target).multiplyScalar(far).add(tween.target);
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

// ---- etiquetas: solo en las vistas de detalle y con nombres cortos ----
let labels;
const DETAIL = ["gap", "section"];
function buildLabels() {
  labels.clear();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const midGroup = () => active.sections[Math.floor(active.sections.length / 2)].group.position;
  if (mode === "ems") {
    const gv = () => train.sections[1].gap * effExag();
    labels.add({ text: () => `${(train.sections[1].gap * 1000).toFixed(1)} mm`, pos: () => V(0, DIM.statorBottom - gv() / 2, 1.15), rigs: DETAIL });
    labels.add({ text: () => "Estator", pos: () => V(2.0, DIM.statorBottom + 0.3, 1.15), rigs: DETAIL, cls: "s" });
    labels.add({ text: () => "Imán de sustentación", pos: () => V(-1.6, DIM.statorBottom - gv() - 0.55, 1.15), rigs: DETAIL, cls: "n" });
    labels.add({ text: () => "Riel de guiado", pos: () => V(0, DIM.railY1 + 0.15, 1.58), rigs: ["section"] });
    labels.add({ text: () => "Imán de guiado", pos: () => V(2.2, (DIM.railY0 + DIM.railY1) / 2 - (DIM.plateTop + DIM.floorClear) + midGroup().y - 0.4, 1.8), rigs: ["section"], cls: "n" });
  } else {
    const gap = () => train.sections[1].gap;
    labels.add({ text: () => `${(gap() * 1000).toFixed(0)} mm`, pos: () => V(0, EDIM.slabTop + 0.1, 0), rigs: DETAIL });
    labels.add({ text: () => "Propulsión", pos: () => V(1.4, EDIM.propY + 0.5, 1.93), rigs: DETAIL, cls: "s" });
    labels.add({ text: () => "Bobinas en 8", pos: () => V(-1.6, EDIM.levY - 0.9, 1.93), rigs: DETAIL, cls: "n" });
    labels.add({ text: () => "Imán superconductor", pos: () => V(0.0, EDIM.slabTop + gap() + 1.0, 1.2), rigs: DETAIL, cls: "n" });
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
    document.getElementById("stopBtn")?.setAttribute("aria-pressed", "false");
    ui.toast("Reiniciado");
  },
  perturb,
  setTheme: (t) => {
    world.setTheme(t);
    // faros y luz de las ventanas: discretos de dia, visibles al atardecer
    for (const sc of Object.values(scenes)) for (const m of sc.bodyMats) m.emissiveIntensity = t === "light" ? 0.08 : 1;
  },
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
  ui.setOutputs();
  buildLabels();
  setRig(view.rig, true);
  ui.toast(next === "ems" ? "EMS · Transrapid" : "EDS · SCMaglev");
}

function depart() {
  train.hold = false;
  document.getElementById("stopBtn")?.setAttribute("aria-pressed", "false");
  if (train.state === "estacion") train.stateTime = Math.max(train.stateTime, train.dwell - 8);
  ui.toast("Saliendo");
}

const midIdx = () => Math.floor(train.sections.length / 2);
function slowForPerturbation() {
  // a x5 o mas la respuesta dura una fraccion de segundo: se pasa a tiempo real
  if (view.timeScale > 2) ui.setTimeScale(1);
}
function perturb(kind, btn) {
  const s = train.sections[midIdx()];
  const W = (s.mass + s.extraMass) * G;
  slowForPerturbation();
  if (kind === "load") {
    if (s.extraMass > 0) s.clearLoad();
    else s.addLoad();
    btn.setAttribute("aria-pressed", String(s.extraMass > 0));
    ui.toast(s.extraMass > 0 ? "Carga +12 %" : "Carga retirada");
  } else if (kind === "gust") {
    s.addGust(0.1 * W, 0.6);
    ui.toast("Ráfaga lateral");
  } else if (kind === "kick") {
    s.kick(mode === "ems" ? 0.002 : 0.015);
    ui.toast(mode === "ems" ? "Golpe de 2 mm" : "Golpe de 15 mm");
  } else if (kind === "ctrlOff" && mode === "ems") {
    const on = btn.getAttribute("aria-pressed") !== "true";
    btn.setAttribute("aria-pressed", String(on));
    if (on) {
      s.control = false;
      s.openLoop = true;
      s.kick(0.0005);
      ui.toast("Control apagado");
    } else {
      s.openLoop = false;
      s.engage();
      ui.toast("Control activo");
    }
  } else if (kind === "cutPower" && mode === "ems") {
    train.sections.forEach((q) => q.release());
    ui.toast("Sin corriente: cae a los patines");
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

// ---- la camara nunca baja del suelo ----
// Con el objetivo a la altura de la via se puede mirar desde abajo (ver los imanes),
// pero la camara se queda por encima de la altura de los ojos de una persona.
const EYE = 1.7;
function keepAboveGround() {
  const t = controls.target;
  t.y = Math.min(40, Math.max(0.5, t.y));
  t.x = Math.min(400, Math.max(-400, t.x));
  t.z = Math.min(300, Math.max(-300, t.z));
  const r = camera.position.distanceTo(t);
  const c = (EYE - t.y) / Math.max(r, 1e-3);
  controls.maxPolarAngle = Math.acos(Math.min(1, Math.max(-1, c)));
  if (camera.position.y < EYE) camera.position.y = EYE;
}

// ---- bucle ----
let last = performance.now();
const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
function frame(now) {
  const wall = Math.min(0.25, (now - last) / 1000);
  const dt = Math.min(0.05, wall);
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
  world.scroll(sc);
  stations.update(sc, train.length, train.stationSpacing, STATION_CFG[mode]);
  const tel = train.telemetry();
  const v2 = { ...view, exag: effExag(), magnetsVisible: magnetsVisible() };
  active.update(tel, train, v2, dt);
  if (mode === "ems") {
    fields.ems.update(tel, train, v2);
    updateEmsGlow(tel, train, v2);
  } else {
    fields.eds.update(tel, train, v2);
    updateEdsGlow(tel, train, v2);
  }

  if (tween.active) {
    // con tiempo real (no el paso limitado): en equipos lentos la transicion dura lo mismo
    const k = reduced ? 1 : 1 - Math.exp(-wall * 5);
    camera.position.lerp(tween.pos, k);
    controls.target.lerp(tween.target, k);
    camera.fov += (tween.fov - camera.fov) * k;
    camera.updateProjectionMatrix();
    if (camera.position.distanceTo(tween.pos) < 0.02) tween.active = false;
  }
  keepAboveGround();
  controls.update();
  renderer.render(scene, camera);
  labels.update(camera, view.rig, view.layers.labels, window.innerWidth, window.innerHeight);
  ui.update(tel, train, view);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__THREE = THREE;
window.__app = { train, view, setRig, setMode, applyBody, camera, controls, scene, scenes, ui, perturb, depart };
