import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Train } from "./physics/train.js";
import { G, EDS } from "./physics/constants.js";
import { createWorld } from "./scene/world.js";
import { createEmsScene } from "./scene/emsScene.js";
import { createEdsScene } from "./scene/edsScene.js";
import { createEmsFields, updateEmsGlow } from "./scene/emsFields.js";
import { createEdsFields, updateEdsGlow } from "./scene/edsFields.js";
import { setLineResolution } from "./scene/lines.js";
import { createLabels } from "./scene/labels.js";
import { createStations } from "./scene/stations.js";
import { adaptiveNear } from "./scene/depth.js";
import { framePart, cameraIsSane, fitDistance } from "./scene/frame.js";
import { INTRO, introPose, introExag, introTimeScale, introXray, introCaption } from "./scene/intro.js";
import { stepsOf } from "./ui/tourData.js";
import { parseState, stateHash } from "./ui/shareState.js";
import { setExplode as applyExplode, pick, setHighlight, setHighlightColor, setHighlightOpacity, focusBox } from "./scene/parts.js";
import { partById, partIds, stepPart } from "./scene/partsData.js";
import { DIM } from "./scene/ems.js";
import { D as EDIM } from "./scene/edsGeo.js";
import { createUI } from "./ui/ui.js";
import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-500.css";
import "@fontsource/barlow/latin-600.css";
import "@fontsource/barlow/latin-700.css";
import "@fontsource/barlow-semi-condensed/latin-500.css";
import "@fontsource/barlow-semi-condensed/latin-600.css";
import "./ui/style.css";

const canvas = document.getElementById("view");
// sin webgl no hay escena: se dice claro en vez de dejar la pagina en blanco
if (!document.createElement("canvas").getContext("webgl2") && !document.createElement("canvas").getContext("webgl")) {
  document.body.innerHTML =
    '<main style="font:16px/1.5 system-ui,sans-serif;max-width:34em;margin:12vh auto;padding:0 20px;color:#14202b"><h1 style="font-size:22px">Este navegador no puede dibujar la escena 3D</h1><p>El simulador necesita WebGL. Prueba con un navegador actualizado, activa la aceleración por hardware o abre el enlace en otro dispositivo.</p></main>';
  throw new Error("sin WebGL");
}
const world = createWorld(canvas);
const { renderer, scene } = world;
// una linea de diagnostico: si algo no se ve bien en una maquina, esto dice con que gpu se dibuja
try {
  const gl = renderer.getContext();
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  console.info("[gpu]", info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "sin datos", "|", gl.getParameter(gl.VERSION), "| atributos", gl.getParameter(gl.MAX_VERTEX_ATTRIBS));
} catch {
  /* sin diagnostico */
}
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 4000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.minDistance = 3;
controls.maxDistance = 420;
controls.screenSpacePanning = true;
// con el lienzo enfocado, las flechas mueven la vista (teclado)
canvas.tabIndex = 0;
controls.listenToKeyEvents(canvas);

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
  exag: { ems: 24, eds: 8 }, // con 24 el hueco de 10 mm mide unos 8 px en la orbita; el rotulo dice el factor
  timeScale: 5,
  rig: "orbit",
  body: "auto",
  paused: false,
  parts: false, // explorador de piezas
  explode: false, // vista separada
  boost: false, // la camara campo realza las capas de campo
  // las fuerzas se piden (capa fuerzas): el diagrama sobre el techo y sus cifras fijas sobraban en la vista por defecto
  layers: { fields: true, wave: true, forces: false, labels: true },
};
// estado de la apertura (ver mas abajo): se declara aqui porque effexag y effbody lo leen
const intro = { active: false, t: 0, cfg: null, saved: null, exag: 0, xray: false };
const rigMinExag = () => active.rigs[view.rig].minExag ?? 0;
const effExag = () => Math.max(view.exag[mode], rigMinExag(), intro.active ? intro.exag : 0);

// ---- carroceria: solida, rayos x, corte, o "faldon": solida con la parte baja translucida ----
const SKIRT_ALPHA = 0.2;
const planes = {
  x: new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0),
  z: new THREE.Plane(new THREE.Vector3(0, 0, -1), 0),
};
// carroceria efectiva: el explorador de piezas y la vista separada necesitan ver dentro.
function effBody() {
  // la apertura se ve por dentro: rayos x, o la carroceria de otra camara (el corte del eds)
  if (intro.active && intro.xray) return introRig() ? active.rigs[introRig()].body : "xray";
  const rig = active.rigs[view.rig];
  let bodyMode = view.body === "auto" ? rig.body : view.body;
  if ((view.parts || view.explode) && bodyMode !== "cut") bodyMode = "xray";
  if (view.explode && bodyMode === "cut") bodyMode = "xray"; // el corte no se lleva con piezas separadas
  return bodyMode;
}
const introRig = () => (intro.active && intro.xray ? intro.cfg.bodyRig : null);
function applyBody() {
  const rig = active.rigs[introRig() ?? view.rig];
  const bodyMode = effBody();
  view.boost = !!rig.boost || (intro.active && intro.xray);
  let plane = null;
  if (bodyMode === "cut") {
    const cut = rig.cut ?? { axis: "z", c: 0 };
    plane = planes[cut.axis];
    plane.constant = cut.c;
  }
  const camSide = camera.position.z >= 0 ? 1 : -1;
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
      let a = x ? 0.18 : 1;
      // faldon del ems y pared cercana del eds: translucidos en las vistas generales, para ver el mecanismo
      // que esconden (imanes, estator y hueco; imanes superconductores y bobinas)
      if (on && !x && m.userData.skirt && bodyMode === "skirt" && (m.userData.side === undefined || m.userData.side === camSide)) a = SKIRT_ALPHA;
      m.transparent = a < 1;
      m.opacity = a;
      m.depthWrite = a >= 1;
      m.needsUpdate = true;
    }
  }
}

// las lineas de flujo se dibujan sin prueba de profundidad: solo tienen sentido
// cuando los imanes estan a la vista (vistas de detalle, rayos x o corte).
function magnetsVisible() {
  const b = effBody();
  // con el faldon translucido del ems se ven desde la orbita; desde seguir o arriba las lineas (sin prueba de
  // profundidad) se dibujarian sobre la carroceria, y en el eds lo que se ve por la pared ya es la geometria
  return DETAIL.includes(view.rig) || b === "xray" || b === "cut" || (b === "skirt" && view.rig === "orbit" && mode === "ems");
}

// ---- camaras con transicion ----
const tween = { active: false, pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 50 };
controls.addEventListener("start", () => {
  tween.active = false;
  userMoved = true;
});
// pantallas verticales: el campo horizontal es estrecho y el tren es largo. la orbita
// pasa a un 3/4 desde la proa (el tren se aleja en profundidad en vez de cruzar la
// pantalla) y la vista cenital gira para que la via quede vertical.
// la orbita se encuadra por calculo: el tren llena el 88 % del area libre de la pantalla,
// centrado en ella, sea cual sea el tamano de la ventana y los paneles abiertos.
const NOSE_LEN = 6.5; // largo de la nariz de las secciones de cabeza y cola (ems.js, edsgeo.js)
function rigPose(name, r) {
  const target = new THREE.Vector3(...r.target);
  const off = new THREE.Vector3(...r.pos).sub(target);
  if (camera.aspect < 0.9 && name === "orbit") {
    const d = Math.hypot(off.x, off.z) * 2.0;
    const a = THREE.MathUtils.degToRad(42);
    off.set(-d * Math.sin(a), off.y, d * Math.cos(a));
  } else if (camera.aspect < 0.9 && name === "top") {
    off.set(0.05, off.y * 1.2, 0);
  }
  if (name === "orbit" && r.fit) {
    const half = train.length / 2 + NOSE_LEN;
    const dir = off.clone().normalize();
    const free = safeFreeArea();
    const fit = fitDistance({
      target: target.toArray(),
      dir: dir.toArray(),
      fov: r.fov,
      aspect: camera.aspect,
      free: { fx: free.fx, fy: free.fy },
      box: { min: [-half, r.fit.y[0], -2.4], max: [half, r.fit.y[1], 2.4] },
      fill: r.fit.fill,
    });
    if (fit) {
      target.add(new THREE.Vector3(...fit.shift));
      return { pos: target.clone().addScaledVector(dir, fit.distance), target };
    }
  }
  return { pos: off.add(target), target };
}
let userMoved = false;
function setRig(name, instant = false) {
  view.rig = name;
  const r = active.rigs[name];
  const pose = rigPose(name, r);
  userMoved = false;
  tween.target.copy(pose.target);
  tween.pos.copy(pose.pos);
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

// ---- explorador de piezas ----
// con el modo activo la carroceria se vuelve transparente, la pieza bajo el puntero se resalta
// y un clic acerca la camara y abre su tarjeta. la via corre bajo el tren, asi que el resaltado
// se aplica a todas las copias del pool de tramos y la seleccion no se pierde.
let selected = null;
let hoverId = null;
const explode = { target: 0, k: 0 };
const hoverTip = document.createElement("div");
hoverTip.id = "partHover";
hoverTip.hidden = true;
document.body.appendChild(hoverTip);

function refreshHighlight() {
  const id = view.parts ? (hoverId ?? selected) : null;
  // verde agua vivo en los dos temas: el acento del tema claro es demasiado oscuro para resaltar
  setHighlightOpacity(hoverId && hoverId !== selected ? 0.22 : 0.4);
  setHighlight(mode, id);
}
const pressTool = (name, on) => document.querySelector(`[data-tool="${name}"]`)?.setAttribute("aria-pressed", String(on));

function setParts(on) {
  view.parts = on;
  document.body.dataset.parts = on ? "on" : "off";
  pressTool("parts", on);
  if (!on) {
    closePart();
    hoverId = null;
    hoverTip.hidden = true;
  } else {
    ui.toast("Haz clic en una pieza, o usa las flechas");
  }
  applyBody();
  refreshHighlight();
}
let refly = 0;
function setExplodeView(on) {
  view.explode = on;
  explode.target = on ? 1 : 0;
  pressTool("explode", on);
  applyBody();
  // las piezas se mueven: se vuelve a encuadrar la seleccionada cuando terminan. Un solo
  // temporizador: al activar y desactivar seguido, o al cambiar de pieza, solo vale el ultimo.
  clearTimeout(refly);
  if (selected) {
    const id = selected;
    const m = mode;
    refly = setTimeout(() => {
      if (selected === id && mode === m && view.explode === on) flyTo(id);
    }, 650);
  }
}
function closePart() {
  clearTimeout(refly);
  selected = null;
  ui.card.hide();
  document.body.dataset.card = "closed";
  refreshHighlight();
}
function partEsc() {
  if (selected) return closePart(), true;
  if (view.parts) return setParts(false), true;
  return false;
}
function selectPart(id) {
  if (!view.parts) setParts(true);
  selected = id;
  const ids = partIds(mode);
  ui.card.show(partById(mode, id), ids.indexOf(id), ids.length);
  document.body.dataset.card = "open";
  refreshHighlight();
  flyTo(id);
  // la lista de camaras deja de marcar una vista: ahora se mira una pieza
  document.querySelectorAll("#cams [data-rig]").forEach((b) => b.setAttribute("aria-pressed", "false"));
}
function partStep(dir) {
  const ids = partIds(mode);
  selectPart(selected ? stepPart(mode, selected, dir) : ids[dir > 0 ? 0 : ids.length - 1]);
}
function flyTo(id) {
  const def = partById(mode, id);
  if (!def) return;
  scene.updateMatrixWorld(true);
  const box = focusBox(mode, id, def.span);
  // sin un encuadre fiable se conserva la vista actual en vez de arriesgar una camara rota
  const fr = box && framePart(box, def, { aspect: camera.aspect, fov: 44 });
  if (!fr) return;
  tween.target.set(...fr.target);
  tween.pos.set(...fr.position);
  tween.fov = 44;
  tween.active = true;
}

// clic (sin arrastre) para elegir; el movimiento del puntero resalta y nombra la pieza
let down = null;
canvas.addEventListener("pointerdown", (e) => (down = { x: e.clientX, y: e.clientY, t: performance.now() }));
canvas.addEventListener("pointerup", (e) => {
  const d = down;
  down = null;
  if (!view.parts || !d) return;
  if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5 || performance.now() - d.t > 500) return;
  const hit = pick(mode, camera, e.clientX, e.clientY, window.innerWidth, window.innerHeight);
  if (hit) selectPart(hit.id);
});
let lastHover = 0;
canvas.addEventListener("pointermove", (e) => {
  if (!view.parts || e.buttons) return;
  const now = performance.now();
  if (now - lastHover < 60) return;
  lastHover = now;
  const hit = pick(mode, camera, e.clientX, e.clientY, window.innerWidth, window.innerHeight);
  const id = hit ? hit.id : null;
  if (id !== hoverId) {
    hoverId = id;
    refreshHighlight();
  }
  hoverTip.hidden = !id;
  if (id) {
    hoverTip.textContent = partById(mode, id).name;
    hoverTip.style.left = `${e.clientX}px`;
    hoverTip.style.top = `${e.clientY}px`;
  }
});
canvas.addEventListener("pointerleave", () => {
  hoverId = null;
  hoverTip.hidden = true;
  refreshHighlight();
});

// ---- etiquetas: solo en las vistas de detalle y con nombres cortos ----
let labels;
const DETAIL = ["gap", "section"];
// la cifra de un rotulo es la real; si el dibujo esta ampliado, se dice cuanto. En el EMS la exageracion
// multiplica el hueco; en el EDS, lo que el coche sube sobre la altura de las ruedas.
function drawnTag() {
  const ex = effExag();
  if (ex <= 1) return "";
  if (mode === "ems") return ` · dibujo ×${ex}`;
  const g = train.sections[1].gap;
  const drawn = EDS.gapWheels + (g - EDS.gapWheels) * ex;
  return Math.abs(drawn - g) < 0.002 ? "" : ` · dibujo ${(drawn * 1000).toFixed(0)} mm`;
}
function buildLabels() {
  labels.clear();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const midGroup = () => active.sections[Math.floor(active.sections.length / 2)].group.position;
  // rotulos de las flechas de fuerza y del entrehierro real en las vistas generales
  const OVERVIEW = ["orbit", "chase"];
  const f = fields[mode].forces;
  labels.add({ text: () => `${mode === "ems" ? "Atracción" : "Repulsión"} ${(train.sections[1].lift / 1e3).toFixed(0)} kN`, pos: () => f.tips.lift, rigs: OVERVIEW, when: () => view.layers.forces && !view.parts });
  labels.add({ text: () => `Peso ${(((train.sections[1].mass + train.sections[1].extraMass) * G) / 1e3).toFixed(0)} kN`, pos: () => f.tips.weight, rigs: OVERVIEW, when: () => view.layers.forces && !view.parts });
  labels.add({
    text: () => (train.levitated ? `Levita a ${train.sections[1].gapMm.toFixed(mode === "ems" ? 1 : 0).replace(".", ",")} mm${drawnTag()}` : mode === "ems" ? "Sobre patines" : "Sobre ruedas"),
    pos: () => V(midGroup().x, mode === "ems" ? DIM.statorBottom - 1.4 : EDIM.slabTop - 0.4, mode === "ems" ? 2.5 : 2.9),
    rigs: OVERVIEW,
    when: () => !view.parts && !ui.loupe.open, // con la lupa abierta la cifra ya esta ahi
    cls: "lev",
  });
  if (mode === "ems") {
    const gv = () => train.sections[1].gap * effExag();
    labels.add({ text: () => `${(train.sections[1].gap * 1000).toFixed(1).replace(".", ",")} mm${drawnTag()}`, pos: () => V(0, DIM.statorBottom - gv() / 2, 1.15), rigs: DETAIL });
    labels.add({ text: () => "Estator", pos: () => V(2.0, DIM.statorBottom + 0.3, 1.15), rigs: DETAIL, cls: "s" });
    labels.add({ text: () => "Imán de sustentación", pos: () => V(-1.6, DIM.statorBottom - gv() - 0.55, 1.15), rigs: DETAIL, cls: "n" });
    labels.add({ text: () => "Riel de guiado", pos: () => V(0, DIM.railY1 + 0.15, 1.58), rigs: ["section"] });
    labels.add({ text: () => "Imán de guiado", pos: () => V(2.2, (DIM.railY0 + DIM.railY1) / 2 - (DIM.plateTop + DIM.floorClear) + midGroup().y - 0.4, 1.8), rigs: ["section"], cls: "n" });
  } else {
    const gap = () => train.sections[1].gap;
    labels.add({ text: () => `${(gap() * 1000).toFixed(0)} mm${drawnTag()}`, pos: () => V(0, EDIM.slabTop + 0.1, 0), rigs: DETAIL });
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
    ui.resetControls();
    ui.toast("Reiniciado");
  },
  perturb,
  replayIntro: () => startIntro({ replay: true }),
  tourToggle: () => tourToggle(),
  tourStep: (dir) => tourStep(dir),
  tourEnd: () => tourEnd(),
  tourEsc: () => tourEsc(),
  copyLink: () => copyLink(),
  screenshot: () => screenshot(),
  setParts: (on) => setParts(on),
  setExplode: (on) => setExplodeView(on),
  partStep: (dir) => partStep(dir),
  partClose: () => closePart(),
  partEsc: () => partEsc(),
  setTheme: (t) => {
    world.setTheme(t);
    stations.setNight(t !== "light");
    // faros y luz de las ventanas: discretos de dia, visibles al atardecer
    for (const sc of Object.values(scenes)) {
      for (const m of sc.bodyMats) if (m.emissiveMap) m.emissiveIntensity = t === "light" ? 0.08 : 1;
      for (const sec of sc.sections) sec.setNight?.(t !== "light");
    }
  },
});
labels = createLabels(ui.els.labels);
// el deslizador de Vista arranca con la exageracion que se dibuja (el marcado trae otro valor por defecto)
ui.els.exag.value = String(view.exag[mode]);
ui.setOutputs();

function setMode(next) {
  if (next === mode) return;
  if (tour.active) tourEnd();
  if (selected) closePart();
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

// ---- eventos visibles ----
// Lo que cambia el estado del tren (cae, se pega, lo golpean) dura una fraccion de segundo: el coche cae
// en 0,1 s. Se mira en camara lenta y, si la camara no es de detalle, desde la de los imanes; pasados unos
// segundos todo vuelve a como estaba, salvo lo que el usuario haya tocado entretanto.
const ev = { active: false, end: 0, prevRig: null, movedTo: null, prevTs: 0, slowTs: 0 };
const EVENT_SLOW = { cutPower: { scale: 0.12, seconds: 3 }, ctrlOff: { scale: 0.12, seconds: 2.5 }, kick: { scale: 0.2, seconds: 2.5 } };
function showEvent({ scale = 0.12, seconds = 2.5 } = {}) {
  if (intro.active) return;
  if (!ev.active) {
    ev.active = true;
    ev.prevTs = view.timeScale;
    ev.prevRig = view.rig;
    ev.movedTo = null;
  }
  if (view.paused) ui.setPaused(false);
  if (!["gap", "section", "field"].includes(view.rig) && !ev.movedTo) {
    ev.movedTo = "gap";
    setRig("gap");
  }
  ev.slowTs = scale;
  ui.setTimeScale(scale);
  ev.end = performance.now() + (seconds + 1.2) * 1000;
}
function endEvent() {
  ev.active = false;
  // el usuario manda: si cambio la escala de tiempo o la camara durante el evento, no se le devuelve la anterior
  if (view.timeScale === ev.slowTs) ui.setTimeScale(ev.prevTs);
  if (ev.movedTo && view.rig === ev.movedTo && !userMoved) setRig(ev.prevRig);
  ev.movedTo = null;
}
function perturb(kind, btn, opts = {}) {
  const s = train.sections[midIdx()];
  const W = (s.mass + s.extraMass) * G;
  const ems = mode === "ems";
  // respuesta que mide la interfaz: valor antes de perturbar, banda y como leerlo
  const gapSignal = (label, tol) => ({
    label, unit: "mm", digits: ems ? 2 : 1, ref: s.gap * 1000, tol, maxTime: 15,
    get: (t) => t.sections[midIdx()].gap * 1000,
  });
  const turningOn = btn?.getAttribute("aria-pressed") !== "true";
  if ((kind === "cutPower" || kind === "kick" || (kind === "ctrlOff" && turningOn)) && (kind !== "ctrlOff" || ems)) {
    showEvent({ ...(EVENT_SLOW[kind] ?? {}), ...(opts.slow ?? {}) });
  } else {
    slowForPerturbation();
  }
  if (kind === "load") {
    const d = ems ? gapSignal("Carga +12 %", 0.05) : null;
    if (s.extraMass > 0) s.clearLoad();
    else s.addLoad();
    btn.setAttribute("aria-pressed", String(s.extraMass > 0));
    if (s.extraMass > 0) ui.toast(ems ? "Carga +12 %. Mira cómo sube la corriente." : "Carga +12 %. La elevación baja un poco.");
    else ui.toast("Carga retirada");
    return d;
  }
  if (kind === "gust") {
    const d = { label: "Ráfaga", unit: "mm", digits: 2, ref: s.y * 1000, tol: ems ? 0.05 : 0.3, maxTime: 15, get: (t) => t.sections[midIdx()].y * 1000 };
    s.addGust(0.1 * W, 0.6);
    ui.toast("Ráfaga lateral. Mira la posición lateral.");
    return d;
  }
  if (kind === "kick") {
    const d = gapSignal(ems ? "Golpe de 2 mm" : "Golpe de 15 mm", ems ? 0.05 : 0.5);
    s.kick(ems ? 0.002 : 0.015);
    ui.toast(ems ? "Golpe de 2 mm. Mira el entrehierro." : "Golpe de 15 mm. Mira la elevación.");
    return d;
  }
  // el estado del control lo lleva la Train (en tiempo simulado): asi la maquina de estados no lo deshace
  if (kind === "ctrlOff" && ems) {
    const on = btn.getAttribute("aria-pressed") !== "true";
    btn.setAttribute("aria-pressed", String(on));
    train.setControlOff(midIdx(), on);
    ui.toast(on ? "Control apagado. Sin lazo cerrado el equilibrio no se sostiene." : "Control activo");
  } else if (kind === "cutPower" && ems) {
    train.cutPower(3.5);
    ui.toast("Sin corriente: cae a los patines");
  }
  return null;
}

// ---- tamano ----
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  setLineResolution(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  applyFraming(true);
  // con la orbita sin tocar, se vuelve a encuadrar el tren al cambiar la ventana
  if (view.rig === "orbit" && !userMoved && !selected && !tween.active) setRig("orbit", true);
}

// ---- encuadre: la escena se centra en el area que dejan libre los paneles ----
// Los paneles flotan sobre el lienzo; sin esto el tren queda cortado por el carril de
// camaras o escondido tras el panel lateral. Se desplaza la ventana de proyeccion.
const framing = { x: 0, y: 0, tx: 0, ty: 0 };
function freeArea() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const { cams, side } = ui.els;
  const hud = document.getElementById("hud");
  const topbar = document.getElementById("topbar");
  const open = !side.classList.contains("closed");
  const card = ui.card.open ? ui.card.el : null;
  if (w > 760) {
    let l = cams.offsetLeft + cams.offsetWidth + 8;
    if (card) l = Math.max(l, card.offsetLeft + card.offsetWidth + 8);
    const r = open ? w - side.offsetLeft + 8 : 0;
    const t = topbar.offsetTop + topbar.offsetHeight;
    const b = h - hud.offsetTop;
    return { x: (l - r) / 2, y: (t - b) / 2, fx: (w - l - r) / w, fy: (h - t - b) / h };
  }
  const t = cams.offsetTop + cams.offsetHeight + 4;
  const b = h - (card ? card.offsetTop : open ? side.offsetTop : hud.offsetTop);
  return { x: 0, y: (t - b) / 2, fx: 1, fy: (h - t - b) / h };
}
// el area libre solo se usa si es un numero razonable; si no, sin desplazamiento
function safeFreeArea() {
  let f = null;
  try {
    f = freeArea();
  } catch {
    f = null;
  }
  const lim = Math.max(window.innerWidth, window.innerHeight);
  const good = f && [f.x, f.y, f.fx, f.fy].every(Number.isFinite) && Math.abs(f.x) < lim && Math.abs(f.y) < lim && f.fx > 0.2 && f.fx <= 1 && f.fy > 0.2 && f.fy <= 1;
  return good ? f : { x: 0, y: 0, fx: 0.7, fy: 0.75 };
}
let framed = "";
function applyFraming(instant = false) {
  const f = safeFreeArea();
  framing.tx = f.x;
  framing.ty = f.y;
  if (instant) {
    framing.x = f.x;
    framing.y = f.y;
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  const key = `${w}|${h}|${framing.x.toFixed(1)}|${framing.y.toFixed(1)}`;
  if (key === framed) return;
  framed = key;
  camera.setViewOffset(w, h, -framing.x, -framing.y, w, h);
}
window.addEventListener("resize", resize);
canvas.addEventListener("dblclick", () => setRig(view.rig));
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

// ---- apertura: primer plano de la levitacion y despues la vista general ----
// Se avanza con el tiempo real de pared desde step(). Cualquier gesto la corta; al terminar o al
// omitirla se devuelve todo lo que cambio (escala de tiempo, tren retenido, carroceria, exageracion).
const introEls = { box: document.getElementById("intro"), cap: document.getElementById("introCap"), skip: document.getElementById("introSkip") };
const qs = new URLSearchParams(location.search);
function introAllowed() {
  if (qs.has("nointro")) return false;
  if (navigator.webdriver && !qs.has("intro")) return false; // los scripts de QA miden la escena sin ella
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  return document.body.dataset.view === "sim";
}
const orbitPoseNow = () => {
  const p = rigPose("orbit", active.rigs.orbit);
  return { pos: p.pos.toArray(), tgt: p.target.toArray(), fov: active.rigs.orbit.fov };
};
function startIntro({ replay = false } = {}) {
  if (intro.active) return;
  if (tour.active) tourEnd();
  if (selected) closePart();
  if (view.parts) setParts(false);
  if (view.explode) setExplodeView(false);
  const cfg = INTRO[mode];
  intro.cfg = cfg;
  intro.t = 0;
  intro.saved = { timeScale: view.timeScale };
  if (replay || cfg.preAdvance) {
    train.reset();
    ui.resetControls();
  }
  if (cfg.preAdvance) train.advance(cfg.preAdvance);
  train.hold = cfg.hold > 0;
  if (view.paused) ui.setPaused(false);
  ui.setTimeScale(cfg.tsClose);
  intro.active = true;
  intro.xray = true;
  intro.exag = introExag(cfg, 0, view.exag[mode]);
  tween.active = false;
  document.body.dataset.intro = "on";
  introEls.box.hidden = false;
  applyBody();
}
function endIntro({ toOrbit = false, snap = false } = {}) {
  if (!intro.active) return;
  intro.active = false;
  intro.xray = false;
  intro.exag = 0;
  document.body.dataset.intro = "off";
  introEls.box.hidden = true;
  train.hold = false;
  document.getElementById("stopBtn")?.setAttribute("aria-pressed", "false");
  ui.setTimeScale(intro.saved?.timeScale ?? 5);
  // despues del gesto que la corto: el mismo evento, ya en fase de burbuja, cerraria la pista recien puesta
  setTimeout(() => {
    if (!tour.active) ui.startHint();
  }, 0);
  if (toOrbit) setRig("orbit", snap);
  else applyBody();
}
function introTick(wall) {
  const cfg = intro.cfg;
  intro.t += wall;
  if (train.hold && intro.t >= cfg.hold) train.hold = false;
  const ts = introTimeScale(cfg, intro.t, intro.saved.timeScale);
  if (view.timeScale !== ts) ui.setTimeScale(ts);
  intro.exag = introExag(cfg, intro.t, view.exag[mode]);
  const xr = introXray(cfg, intro.t);
  if (xr !== intro.xray) {
    intro.xray = xr;
    applyBody();
  }
  if (intro.t >= cfg.duration) return endIntro({ toOrbit: true, snap: true });
  const txt = introCaption(mode, intro.t, cfg, train.telemetry());
  if (introEls.cap.textContent !== txt) introEls.cap.textContent = txt;
  introEls.box.style.visibility = txt ? "visible" : "hidden";
}
function introCamera() {
  const p = introPose(intro.cfg, intro.t, orbitPoseNow());
  camera.position.set(...p.pos);
  controls.target.set(...p.tgt);
  camera.fov = p.fov;
  camera.updateProjectionMatrix();
}
// Prueba y capturas: deja la apertura en el instante t (s), avanzando el tren como habria ido
function seekIntro(t) {
  if (intro.active) endIntro();
  startIntro({ replay: true });
  const cfg = intro.cfg;
  for (let tt = 0; tt < t; tt += 0.05) {
    const step = Math.min(0.05, t - tt);
    if (train.hold && tt >= cfg.hold) train.hold = false;
    train.advance(step * introTimeScale(cfg, tt, intro.saved.timeScale));
  }
  intro.t = t;
  train.hold = train.hold && t < cfg.hold;
  intro.xray = introXray(cfg, t);
  intro.exag = introExag(cfg, t, view.exag[mode]);
  ui.setTimeScale(introTimeScale(cfg, t, intro.saved.timeScale));
  applyBody();
  introCamera();
}
// cualquier gesto la corta: se va a la orbita con una transicion suave
const skipIntro = () => endIntro({ toOrbit: true });
for (const ev of ["pointerdown", "keydown", "wheel"]) window.addEventListener(ev, skipIntro, { capture: true, passive: true });
introEls.skip.addEventListener("click", skipIntro);

// ---- visita guiada ----
// Pasos fijos (ui/tourData.js): cada uno pone camara, capas, escala de tiempo y, a veces, provoca un evento.
// Al terminar se devuelve lo que habia (camara, capas, escala de tiempo, pausa); el viaje si se reinicia.
const tour = { active: false, i: 0, saved: null, timers: [] };
const perturbBtn = (kind) => document.querySelector(`#perturb [data-p="${kind}"]`);
function tourClearTimers() {
  tour.timers.forEach(clearTimeout);
  tour.timers = [];
}
// el control apagado por un paso no se deja puesto al salir de el
function tourReleaseControl() {
  const b = perturbBtn("ctrlOff");
  if (mode === "ems" && b?.getAttribute("aria-pressed") === "true") perturb("ctrlOff", b);
}
function tourGo(i) {
  const steps = stepsOf(mode);
  if (!steps.length) return tourEnd();
  tourClearTimers();
  tourReleaseControl();
  tour.i = Math.min(steps.length - 1, Math.max(0, i));
  const st = steps[tour.i];
  if (st.reset) {
    train.reset();
    ui.resetControls();
  }
  if (st.advance) train.advance(st.advance);
  if (view.paused) ui.setPaused(false);
  Object.assign(view.layers, st.layers ?? {});
  ui.syncLayers(view.layers);
  setRig(st.rig);
  ui.setTimeScale(st.timeScale);
  ui.loupe.setOpen(!!st.loupe);
  ui.tour.show(st, tour.i, steps.length);
  if (st.event) {
    const arrive = 900; // ms: lo que tarda la camara en llegar a su sitio
    tour.timers.push(
      setTimeout(() => {
        const b = perturbBtn(st.event);
        if (b) perturb(st.event, b, { slow: st.slow });
      }, arrive),
    );
    if (st.eventUndo) tour.timers.push(setTimeout(tourReleaseControl, arrive + st.eventUndo * 1000));
  }
}
function tourStart() {
  if (tour.active || document.body.dataset.view !== "sim") return;
  if (intro.active) endIntro();
  if (selected) closePart();
  if (view.parts) setParts(false);
  if (view.explode) setExplodeView(false);
  tour.saved = { rig: view.rig, layers: { ...view.layers }, timeScale: view.timeScale, paused: view.paused, loupe: ui.loupe.open };
  tour.active = true;
  document.body.dataset.tour = "on";
  ui.setTourActive(true);
  tourGo(0);
}
function tourEnd() {
  if (!tour.active) return;
  tourClearTimers();
  tourReleaseControl();
  tour.active = false;
  const sv = tour.saved;
  tour.saved = null;
  document.body.dataset.tour = "off";
  ui.tour.hide();
  ui.setTourActive(false);
  Object.assign(view.layers, sv.layers);
  ui.syncLayers(view.layers);
  ui.loupe.setOpen(sv.loupe);
  ui.setTimeScale(sv.timeScale);
  ui.setPaused(sv.paused);
  if (view.rig !== sv.rig) setRig(sv.rig);
  ui.startHint();
}
function tourStep(dir) {
  if (!tour.active) return;
  const next = tour.i + dir;
  if (next >= stepsOf(mode).length) return tourEnd();
  if (next >= 0) tourGo(next);
}
const tourToggle = () => (tour.active ? tourEnd() : tourStart());
const tourEsc = () => (tour.active ? (tourEnd(), true) : false);

// ---- bucle ----
let last = performance.now();
let lastSide = 1;
let scFrozen = null;
const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
// Si la camara se vuelve inutilizable (valores no finitos o muy lejos) o un fotograma lanza una
// excepcion, se vuelve a la camara activa en vez de dejar la escena vacia o el bucle parado.
let recoveries = 0;
function recoverView(reason) {
  recoveries++;
  if (recoveries <= 5) console.error("[vista] recuperada:", reason);
  tween.active = false;
  clearTimeout(refly);
  framing.x = framing.tx = framing.y = framing.ty = 0;
  framed = "";
  camera.clearViewOffset();
  if (selected) closePart();
  setRig(view.rig || "orbit", true);
  if (recoveries <= 3) ui.toast("Se restableció la cámara");
}
function frame(now) {
  try {
    step(now);
  } catch (err) {
    try {
      recoverView(err?.message ?? String(err));
    } catch (err2) {
      console.error("[vista] sin recuperar:", err2);
    }
  }
  requestAnimationFrame(frame);
}
function step(now) {
  // en las paginas (guia, laminas) la escena se detiene: no gasta GPU ni avanza el viaje
  if (document.body.dataset.view !== "sim") {
    last = now;
    return;
  }
  const wall = Math.min(0.25, (now - last) / 1000);
  const dt = Math.min(0.05, wall);
  last = now;
  if (intro.active) introTick(wall);
  if (ev.active && now >= ev.end) endEvent();
  saveState(now);
  if (!view.paused) {
    // trozos de a lo sumo 20 ms: mantiene el historial y la precision con escalas altas
    let left = dt * view.timeScale;
    while (left > 1e-9) {
      const chunk = Math.min(left, 0.02);
      train.advance(chunk);
      ui.sample(train);
      left -= chunk;
    }
  }
  // al inspeccionar una pieza de la via (riel, viga, pilar...) el decorado se detiene: a la
  // velocidad del tren la pieza elegida pasaria de largo antes de poder mirarla
  const inspecting = !!selected && selected !== "coche";
  if (inspecting) scFrozen ??= train.x - train.length / 2;
  else scFrozen = null;
  const sc = scFrozen ?? train.x - train.length / 2;
  // velocidad visual del suelo: lo que el ojo ve pasar (m/s de pista por segundo real)
  // window.__qaSpeed lo fija el script de QA visual (scripts/visual-qa.mjs)
  world.setVisualSpeed(inspecting ? 0 : (window.__qaSpeed ?? (view.paused ? 0 : Math.abs(train.v) * view.timeScale)), wall);
  world.setSight(camera.position, train.length);
  world.setClear(stations.footprints(STATION_CFG[mode]), camera.position);
  world.scroll(sc);
  stations.update(sc, train.length, train.stationSpacing, STATION_CFG[mode]);
  const tel = train.telemetry();
  // vista separada: la separacion se suaviza con tiempo real
  if (explode.k !== explode.target) {
    explode.k += (explode.target - explode.k) * (reduced ? 1 : 1 - Math.exp(-wall * 5));
    if (Math.abs(explode.target - explode.k) < 0.002) explode.k = explode.target;
    applyExplode(explode.k);
  }
  const level = mode === "ems" ? fields.ems.fieldLevel(train) : fields.eds.fieldLevel(train, tel);
  const exag = effExag();
  ui.setExagState(exag, exag > view.exag[mode]);
  const v2 = { ...view, exag, magnetsVisible: magnetsVisible(), fieldLevel: level, intro: intro.active && intro.xray };
  active.update(tel, train, v2, dt);
  if (mode === "ems") {
    fields.ems.update(tel, train, v2, camera, window.innerHeight);
    updateEmsGlow(tel, train, v2);
  } else {
    fields.eds.update(tel, train, v2, camera, window.innerHeight);
    updateEdsGlow(tel, train, v2);
  }
  if (selected) ui.card.update(partById(mode, selected).live(tel, train));

  if (tween.active) {
    // con tiempo real (no el paso limitado): en equipos lentos la transicion dura lo mismo
    const k = reduced ? 1 : 1 - Math.exp(-wall * 5);
    camera.position.lerp(tween.pos, k);
    controls.target.lerp(tween.target, k);
    camera.fov += (tween.fov - camera.fov) * k;
    camera.updateProjectionMatrix();
    if (camera.position.distanceTo(tween.pos) < 0.05) {
      // se fija el destino exacto: con la camara cenital, una desviacion de centimetros
      // cambia el acimut y deja el tren en diagonal
      camera.position.copy(tween.pos);
      controls.target.copy(tween.target);
      camera.fov = tween.fov;
      camera.updateProjectionMatrix();
      tween.active = false;
    }
  }
  if (intro.active) introCamera();
  const kf = reduced ? 1 : 1 - Math.exp(-wall * 8);
  framing.x += (framing.tx - framing.x) * kf;
  framing.y += (framing.ty - framing.y) * kf;
  applyFraming();
  keepAboveGround();
  controls.update();
  // la pared del EDS que se vuelve translucida es la que queda del lado de la camara
  const side = camera.position.z >= 0 ? 1 : -1;
  if (side !== lastSide) {
    lastSide = side;
    applyBody();
  }
  if (!cameraIsSane(camera.position, controls.target, camera.projectionMatrix.elements)) {
    recoverView("camara no finita o demasiado lejos");
    return;
  }
  // plano cercano segun a que distancia se mira: mas resolucion de profundidad lejos
  const near = adaptiveNear(camera.position.distanceTo(controls.target));
  if (Math.abs(near - camera.near) > 0.02) {
    camera.near = near;
    camera.updateProjectionMatrix();
  }
  renderer.render(scene, camera);
  labels.update(camera, intro.active && intro.xray ? "gap" : view.rig, view.layers.labels, window.innerWidth, window.innerHeight);
  ui.update(tel, train, v2);
}
// ---- estado: enlaces y memoria ----
// El estado va en el hash (para compartirlo) y en localStorage (para recordarlo). Quien vuelve, o llega por
// un enlace con estado, entra directo a esa vista; la apertura es para la primera visita.
const STATE_KEY = "maglev-state";
const currentState = () => ({ m: mode, c: view.rig, t: view.timeScale, tab: ui.getTab() });
function loadSaved() {
  try {
    return parseState("#/?" + new URLSearchParams(JSON.parse(localStorage.getItem(STATE_KEY) ?? "{}")).toString());
  } catch {
    return null;
  }
}
const fromLink = parseState(location.hash);
const restored = fromLink ?? loadSaved();
// La apertura se ve en cada carga normal; solo un enlace con estado (alguien comparte una vista concreta) la omite.
const playIntro = introAllowed() && (!fromLink || qs.has("intro"));
if (restored) {
  if (restored.m && restored.m !== mode) setMode(restored.m);
  if (restored.c && !playIntro) setRig(restored.c, true); // la apertura termina en la orbita
  if (restored.t) ui.setTimeScale(restored.t);
  if (restored.tab) ui.selectTab(restored.tab);
}
let lastSaved = "";
function saveState(now) {
  if (now - saveState.at < 1000) return;
  saveState.at = now;
  // durante la apertura, la visita o un evento la camara y la escala de tiempo son prestadas: no se guardan
  if (intro.active || tour.active || ev.active || document.body.dataset.view !== "sim") return;
  const cur = JSON.stringify(currentState());
  if (cur === lastSaved) return;
  lastSaved = cur;
  try {
    // solo se recuerda; el enlace se arma al pulsar Copiar enlace (si la barra de direcciones siguiera la vista,
    // recargar contaria como abrir un enlace con estado y se saltaria la apertura)
    localStorage.setItem(STATE_KEY, cur);
  } catch {
    /* sin almacenamiento o en una vista previa: no pasa nada */
  }
}
saveState.at = 0;
async function copyLink() {
  const url = location.origin + location.pathname + stateHash(currentState());
  try {
    await navigator.clipboard.writeText(url);
    ui.toast("Enlace copiado");
  } catch {
    ui.toast("No se pudo copiar: " + url);
  }
}
function screenshot() {
  // se dibuja y se lee en el mismo turno: asi no hace falta conservar el buffer entre fotogramas
  renderer.render(scene, camera);
  canvas.toBlob((blob) => {
    if (!blob) return ui.toast("No se pudo guardar la imagen");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `maglev-${mode}-${view.rig}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    ui.toast("Imagen guardada");
  }, "image/png");
}

requestAnimationFrame(frame);
if (playIntro) startIntro();
else ui.startHint();

window.__THREE = THREE;
window.__app = { intro: { start: startIntro, end: endIntro, state: intro, seek: seekIntro }, tour: { start: tourStart, end: tourEnd, state: tour, total: () => stepsOf(mode).length }, event: showEvent, world, renderer, partIds: () => partIds(mode), partStep, selectPart, setParts, setExplodeView, train, view, setRig, setMode, applyBody, camera, controls, scene, scenes, ui, perturb, depart };
