// Geometria EDS (estilo SCMaglev): via en U con bobinas en las paredes y vehiculo
// con imanes superconductores. Unidades en metros.
//
// Esquema (las bobinas reales estan apiladas en la pared; aqui se separan en
// filas para poder explicarlas):
//   - fila inferior: bobinas de levitacion en 8 (lazo superior e inferior con
//     corrientes opuestas)
//   - fila superior: bobinas de propulsion
// El vehiculo lleva criostatos con electroimanes superconductores (polos N/S
// alternos, paso 0.9 m) enfrentados a las dos filas.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { glowMaterial, poleTexture, sets } from "./glow.js";
import { superellipse, loft, bodyStations } from "./loft.js";
import { liveryTextures, paintMaterial, bellows } from "./livery.js";
import { roofEquipment, headlamps } from "./trainParts.js";
import { patchConcrete, taperedBox } from "./textures.js";
import { EDS } from "../physics/constants.js";

export const SEG = 27.0; // 30 bobinas de 0.9 m
export const COIL_P = EDS.polePitch; // 0.9 m
export const PAIR = 2 * COIL_P; // 1.8 m
export const CRYO_LEN = 2 * PAIR; // 3.6 m: 4 polos

export const D = {
  pillarH: 5.2,
  slabTop: 5.8,
  wallInner: 1.95,
  wallOuter: 2.35,
  wallTop: 7.8,
  coilZ: 1.93,
  levY: 6.45,
  propY: 7.4,
  // vehiculo (local, y = 0 es la cara inferior del suelo)
  halfW: 1.45,
  height: 3.3,
  cryoZ0: 1.45,
  cryoZ1: 1.66,
  cryoY0: 0.05,
  cryoY1: 1.85,
};

const m = {
  concrete: () => patchConcrete(new THREE.MeshStandardMaterial({ color: "#b9bfc6", roughness: 0.92 })),
  dark: () => new THREE.MeshStandardMaterial({ color: "#1c2128", roughness: 0.7, metalness: 0.3 }),
  steel: () => new THREE.MeshStandardMaterial({ color: "#3b434d", roughness: 0.5, metalness: 0.7 }),
  seat: () => new THREE.MeshStandardMaterial({ color: "#7a2c4a", roughness: 0.8 }),
  floor: () => new THREE.MeshStandardMaterial({ color: "#b9c0c8", roughness: 0.9, side: THREE.DoubleSide }),
  tire: () => new THREE.MeshStandardMaterial({ color: "#16191d", roughness: 0.95 }),
};

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function ringGeometry(w, h, thick, depth) {
  const shape = roundedRect(w, h, 0.09);
  const hole = roundedRect(w - 2 * thick, h - 2 * thick, 0.04);
  shape.holes.push(new THREE.Path(hole.getPoints(3)));
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 3 });
}

/** Tira de bobinas a lo largo de un tramo (una pared), geometria fusionada. */
function coilStrip(side, yCenter, h, w = 0.72) {
  const geos = [];
  const n = Math.round(SEG / COIL_P);
  for (let i = 0; i < n; i++) {
    const g = ringGeometry(w, h, 0.07, 0.05);
    g.translate((i + 0.5) * COIL_P, yCenter, side * D.coilZ - 0.025);
    geos.push(g);
  }
  return mergeGeometries(geos);
}

export function createEdsShared() {
  const copper = { color: "#c8742a", roughness: 0.45, metalness: 0.8 };
  const alu = { color: "#9fb4c8", roughness: 0.4, metalness: 0.85 };
  const mats = {
    concrete: m.concrete(),
    dark: m.dark(),
    levUp: glowMaterial(copper, sets.induced, { sign: 1, gain: 1.1 }),
    levDown: glowMaterial(copper, sets.induced, { sign: -1, gain: 1.1 }),
    prop: glowMaterial(alu, sets.propulsion, { sign: 1, gain: 1.3 }),
  };
  const wallH = D.wallTop - D.slabTop;
  const geos = {
    pillar: taperedBox(1.4, 2.1, 1.9, 3.0, D.pillarH),
    cap: new THREE.BoxGeometry(2.4, 0.36, 3.5),
    jointSlab: new THREE.BoxGeometry(0.06, 0.012, D.wallInner * 2),
    jointWall: new THREE.BoxGeometry(0.06, wallH, D.wallOuter - D.wallInner + 0.02),
    slab: new THREE.BoxGeometry(SEG, 0.6, 4.7), wall: new THREE.BoxGeometry(SEG, wallH, 0.4),
  };
  for (const s of [-1, 1]) {
    geos["levUp" + s] = coilStrip(s, D.levY + 0.285, 0.55);
    geos["levDown" + s] = coilStrip(s, D.levY - 0.285, 0.55);
    geos["prop" + s] = coilStrip(s, D.propY, 0.7);
  }
  return { m: mats, g: geos };
}

export function buildEdsSegment(sh) {
  const grp = new THREE.Group();
  const add = (geo, mat, x, y, z, cast = true) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    grp.add(mesh);
  };
  add(sh.g.pillar, sh.m.concrete, 0, D.pillarH / 2, 0);
  add(sh.g.cap, sh.m.concrete, 0, D.pillarH - 0.18, 0);
  // juntas de dilatacion al inicio del tramo: en el suelo de la U y en las paredes
  add(sh.g.jointSlab, sh.m.dark, 0.02, D.slabTop + 0.006, 0, false);
  add(sh.g.slab, sh.m.concrete, SEG / 2, D.slabTop - 0.3, 0);
  for (const s of [-1, 1]) {
    add(sh.g.wall, sh.m.concrete, SEG / 2, (D.wallTop + D.slabTop) / 2, s * (D.wallInner + D.wallOuter) / 2);
    add(sh.g.jointWall, sh.m.dark, 0.02, (D.wallTop + D.slabTop) / 2, s * (D.wallInner + D.wallOuter) / 2, false);
    add(sh.g["levUp" + s], sh.m.levUp, 0, 0, 0, false);
    add(sh.g["levDown" + s], sh.m.levDown, 0, 0, 0, false);
    add(sh.g["prop" + s], sh.m.prop, 0, 0, 0, false);
  }
  return grp;
}

// ---------------------------------------------------------------- vehiculo

export function edsOutline() {
  // empieza en el centro inferior: ahi queda la costura de la textura (loft.js)
  const pts = superellipse(D.halfW, D.height, 4, 48, 0);
  return [...pts.slice(36), ...pts.slice(0, 36)];
}

export function buildEdsSection({ length = EDS.sectionLength, role = "mid", baseX = 0, carNo = 1 }) {
  const group = new THREE.Group();
  const clipMats = [];
  const bodyMats = [];
  const pts = edsOutline();
  const stations = bodyStations(length - 0.6, { noseFront: role === "front" ? 9 : 0, noseRear: role === "rear" ? 9 : 0, noseDrop: 0.4 });
  const livery = liveryTextures({
    points: pts,
    x0: stations[0].x,
    x1: stations[stations.length - 1].x,
    len: length - 0.6,
    role,
    carNo,
    style: {
      base: "#f3f6f9",
      lower: "#c9d0d7",
      lowerY: 0.3,
      accent: "#1d4ed8",
      stripeY: [1.4, 1.56], // bajo las ventanas: lo de abajo queda tras las paredes de la via
      windowY: [1.68, 2.42],
      winW: 0.9,
      winPitch: 1.25,
      name: "MAGLEV",
      signY: 0.95,
      ventY: [0.7, 1.12],
    },
  });
  const bodyM = paintMaterial(livery);
  bodyMats.push(bodyM);
  clipMats.push(bodyM);
  const body = new THREE.Mesh(loft(pts, stations), bodyM);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const roof = roofEquipment({ len: length - 0.6, role, roofY: D.height });
  group.add(roof.group);
  for (const mm of roof.mats) {
    bodyMats.push(mm);
    clipMats.push(mm);
  }
  const lamps = role === "front" ? headlamps({ len: length - 0.6, noseLen: 9, y: 0.9 }) : null;
  if (lamps) group.add(lamps.group);
  if (role !== "front") {
    const bel = bellows(pts, length, 0.92, 0.95);
    bodyMats.push(bel.material);
    clipMats.push(bel.material);
    group.add(bel);
  }

  const Lb = length - 0.6 - (role === "mid" ? 0 : 3);
  const xc = role === "front" ? -1.5 : role === "rear" ? 1.5 : 0;
  // interior
  const floorM = m.floor();
  const seatM = m.seat();
  clipMats.push(floorM, seatM);
  const fl = new THREE.Mesh(new THREE.BoxGeometry(Lb, 0.08, D.halfW * 2 - 0.1), floorM);
  fl.position.set(xc, 0.5, 0);
  group.add(fl);
  const rows = Math.floor((Lb - 3) / 1.0);
  for (let i = 0; i < rows; i++) {
    for (const s of [-1, 1]) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 1.0), seatM);
      seat.position.set(xc - (Lb - 3) / 2 + i + 0.5, 1.0, s * 0.8);
      group.add(seat);
    }
  }

  // ---- criostatos con imanes superconductores ----
  const cryoM = m.steel();
  const poleTex = poleTexture(4, { rounded: true });
  const poleM = new THREE.MeshStandardMaterial({
    map: poleTex, emissiveMap: poleTex, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.55, roughness: 0.5,
  });
  clipMats.push(cryoM, poleM);
  const modules = [];
  const SP = 3 * PAIR; // 5.4 m entre modulos
  const nMod = Math.max(2, Math.floor((length - 4) / SP) + 1);
  const cryoGroup = new THREE.Group();
  group.add(cryoGroup);
  for (const s of [-1, 1]) {
    for (let i = 0; i < nMod; i++) {
      const raw = (i - (nMod - 1) / 2) * SP + (role === "front" ? -2 : role === "rear" ? 2 : 0);
      const start = Math.round((baseX + raw - CRYO_LEN / 2) / PAIR) * PAIR;
      const x = start + CRYO_LEN / 2 - baseX;
      if (s > 0) modules.push({ x0: start, xc: start + CRYO_LEN / 2 });
      const zc = s * (D.cryoZ0 + D.cryoZ1) / 2;
      const yc = (D.cryoY0 + D.cryoY1) / 2;
      const box = new THREE.Mesh(new THREE.BoxGeometry(CRYO_LEN - 0.04, D.cryoY1 - D.cryoY0, D.cryoZ1 - D.cryoZ0), cryoM);
      box.position.set(x, yc, zc);
      box.castShadow = true;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(CRYO_LEN - 0.04, D.cryoY1 - D.cryoY0 - 0.2), poleM);
      face.position.set(x, yc, s * (D.cryoZ1 + 0.002));
      face.rotation.y = s > 0 ? 0 : Math.PI; // mira hacia la pared de su lado
      cryoGroup.add(box, face);
    }
  }

  // ---- ruedas retractiles ----
  const tireM = m.tire();
  const hubM = m.steel();
  clipMats.push(tireM, hubM);
  const wheels = [];
  const wheelXs = [-length / 2 + 4, length / 2 - 4];
  for (const wx of wheelXs) {
    for (const s of [-1, 1]) {
      const g = new THREE.Group();
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.3, 24), tireM);
      tire.rotation.x = Math.PI / 2;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.34, 16), hubM);
      hub.rotation.x = Math.PI / 2;
      g.add(tire, hub);
      g.position.set(wx, 0.265, s * 0.85);
      g.userData.base = 0.265;
      tire.castShadow = true;
      group.add(g);
      wheels.push(g);
    }
  }

  return {
    group, bodyMats, clipMats, modules, poleM, wheels, length,
    /** gapM: separacion real; exag: factor visual. Origen: suelo sobre la via. */
    setPose(gapM, lateralM, exag) {
      group.position.y = D.slabTop + EDS.gapWheels + (gapM - EDS.gapWheels) * exag;
      group.position.z = lateralM * Math.max(1, exag);
    },
    /** retract: 0 = extendidas, 1 = retraidas */
    setWheels(retract) {
      for (const w of wheels) w.position.y = w.userData.base + 0.45 * retract;
    },
    setNight(on) {
      lamps?.setOn(on);
    },
    setIntensity(k) {
      poleM.emissiveIntensity = 0.3 + 0.5 * Math.min(1.5, k);
    },
  };
}
