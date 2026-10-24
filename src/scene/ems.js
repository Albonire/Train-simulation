// geometria ems (estilo transrapid): viga guia en t y secciones de vehiculo que
// la abrazan. unidades en metros. x = a lo largo de la via, y = arriba, z = lateral.
//
// disposicion (corte transversal):
//   - viga: alma central y placa superior con voladizos laterales.
//   - estatores bajo los voladizos (mirando hacia abajo).
//   - imanes de sustentacion debajo de los estatores, con el entrehierro entre ambos.
//   - rieles de guiado en los costados de la placa; imanes de guiado en los faldones.
// los entrehierros reales (10 mm) son invisibles a esta escala, por eso se
// multiplican por un factor de exageracion visual que muestra la interfaz.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { glowMaterial, poleTexture, sets } from "./glow.js";
import { loft, bodyStations } from "./loft.js";
import { liveryTextures, paintMaterial, bellows } from "./livery.js";
import { roofEquipment, headlamps } from "./trainParts.js";
import { patchConcrete, taperedBox } from "./textures.js";
import { tagPart, tagPartTree } from "./parts.js";
import { EMS } from "../physics/constants.js";

export const SEG = 25.8; // 400 ranuras de 64.5 mm: el patron no salta al reciclar tramos
export const SLOT_PITCH = SEG / 400;
export const PAIR = 2 * EMS.polePitch; // par de polos n+s, m
export const MOD = 6 * PAIR; // modulo imán: 12 polos = 3.096 m

// cotas (mundo)
export const DIM = {
  pillarH: 5.5,
  webTop: 6.6,
  plateTop: 7.1,
  plateHalf: 1.5,
  statorBottom: 6.35,
  statorZ0: 0.85,
  statorZ1: 1.45,
  railY0: 6.65,
  railY1: 7.05,
  // vehiculo (local, y = 0 es la cara inferior del suelo)
  halfW: 2.04,
  cavityHalf: 1.92,
  skirtBottom: -1.37,
  roof: 3.7,
  floorClear: 0.12,
};

const mat = {
  concrete: () => patchConcrete(new THREE.MeshStandardMaterial({ color: "#b9bfc6", roughness: 0.92, metalness: 0.0 })),
  steel: () => new THREE.MeshStandardMaterial({ color: "#3a424b", roughness: 0.5, metalness: 0.7 }),
  rail: () => new THREE.MeshStandardMaterial({ color: "#c7ced6", roughness: 0.3, metalness: 0.85 }),
  copper: () => new THREE.MeshStandardMaterial({ color: "#c8742a", roughness: 0.45, metalness: 0.8 }),
  dark: () => new THREE.MeshStandardMaterial({ color: "#14181d", roughness: 0.7, metalness: 0.3 }),
  seat: () => new THREE.MeshStandardMaterial({ color: "#2c5aa0", roughness: 0.8 }),
  floor: () => new THREE.MeshStandardMaterial({ color: "#b9c0c8", roughness: 0.9, side: THREE.DoubleSide }),
};

function statorTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "#8d959e"; // diente
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = "#222830"; // ranura (con cable de alta tension)
  g.fillRect(24, 0, 28, 64);
  g.fillStyle = "rgba(255,255,255,0.12)";
  g.fillRect(0, 0, 4, 64);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(400, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** un tramo de via (se recicla en un pool). */
export function buildEmsSegment(shared) {
  const g = new THREE.Group();
  const add = (geo, m, x, y, z, cast = true) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };
  // cada malla se etiqueta con su pieza para el explorador (parts.js)
  tagPart("ems", "pier", add(shared.pillar, shared.m.concrete, 0, DIM.pillarH / 2, 0));
  tagPart("ems", "pier", add(shared.cap, shared.m.concrete, 0, DIM.pillarH - 0.2, 0));
  // junta de dilatacion al inicio del tramo
  tagPart("ems", "beam", add(shared.joint, shared.m.dark, 0.02, (DIM.webTop + DIM.plateTop) / 2, 0, false));
  tagPart("ems", "beam", add(shared.web, shared.m.concrete, SEG / 2, (DIM.pillarH + DIM.webTop) / 2, 0));
  tagPart("ems", "beam", add(shared.plate, shared.m.concrete, SEG / 2, (DIM.webTop + DIM.plateTop) / 2, 0));
  for (const s of [-1, 1]) {
    tagPart("ems", "stator", add(shared.stator, shared.m.stator, SEG / 2, DIM.statorBottom + 0.125, s * (DIM.statorZ0 + DIM.statorZ1) / 2, false), s);
    tagPart("ems", "rail", add(shared.rail, shared.m.rail, SEG / 2, (DIM.railY0 + DIM.railY1) / 2, s * (DIM.plateHalf + 0.03), false), s);
    tagPart("ems", "beam", add(shared.tray, shared.m.dark, SEG / 2, DIM.webTop - 0.25, s * 0.52, false));
  }
  return g;
}

export function createEmsShared() {
  const m = {
    concrete: mat.concrete(),
    rail: mat.rail(),
    dark: mat.dark(),
    stator: glowMaterial({ map: statorTexture(), roughness: 0.55, metalness: 0.6, color: "#ffffff" }, sets.stator),
  };
  return {
    m,
    // pilar que se ensancha hacia la cabeza, con su cabezal
    pillar: taperedBox(1.25, 1.7, 1.7, 2.5, DIM.pillarH),
    cap: new THREE.BoxGeometry(2.1, 0.4, 2.8),
    joint: new THREE.BoxGeometry(0.06, DIM.plateTop - DIM.webTop + 0.04, DIM.plateHalf * 2 + 0.04),
    web: new THREE.BoxGeometry(SEG, DIM.webTop - DIM.pillarH, 1.0),
    plate: new THREE.BoxGeometry(SEG, DIM.plateTop - DIM.webTop, DIM.plateHalf * 2),
    stator: new THREE.BoxGeometry(SEG, 0.25, DIM.statorZ1 - DIM.statorZ0),
    rail: new THREE.BoxGeometry(SEG, DIM.railY1 - DIM.railY0, 0.06),
    tray: new THREE.BoxGeometry(SEG, 0.3, 0.22),
  };
}

// ---------------------------------------------------------------- vehiculo

export function outline() {
  const W = DIM.halfW;
  const Wc = DIM.cavityHalf;
  const H = DIM.roof - 1.3;
  const pts = [];
  pts.push([W, DIM.skirtBottom]);
  pts.push([W, 0]); // el faldon (lo que cuelga bajo el suelo) acaba aqui: ver loft(skirtbelow)
  // arco superior (superelipse n = 3) de derecha a izquierda
  const N = 36;
  for (let k = 0; k <= N; k++) {
    const a = (Math.PI * k) / N;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    pts.push([W * Math.sign(c) * Math.abs(c) ** (2 / 3), 1.3 + H * Math.abs(sn) ** (2 / 3)]);
  }
  pts.push([-W, 0]);
  pts.push([-W, DIM.skirtBottom]);
  pts.push([-Wc, DIM.skirtBottom]);
  pts.push([-Wc, 0]);
  pts.push([Wc, 0]);
  pts.push([Wc, DIM.skirtBottom]);
  return pts;
}

/**
 * una seccion del vehiculo. `role`: "front" | "mid" | "rear".
 * devuelve { group, setgap(gapm, lateralm, exag), setcurrent(rel), bodymats }.
 */
// largo de la nariz aerodinamica de las secciones de cabeza y cola (m)
const NOSE = 6.5;

export function buildEmsSection({ length = EMS.sectionLength, role = "mid", shared, baseX = 0, carNo = 1 }) {
  const group = new THREE.Group();
  const bodyMats = [];
  const clipMats = [];

  const pts = outline();
  const stations = bodyStations(length - 0.6, {
    noseFront: role === "front" ? NOSE : 0,
    noseRear: role === "rear" ? NOSE : 0,
  });
  const livery = liveryTextures({
    points: pts,
    x0: stations[0].x,
    x1: stations[stations.length - 1].x,
    len: length - 0.6,
    role,
    carNo,
    style: {
      base: "#eef2f6",
      lower: "#9aa4ae",
      lowerY: 0.05,
      accent: "#16a085",
      stripeY: [0.42, 0.66],
      windowY: [1.58, 2.36],
      winW: 1.05,
      winPitch: 1.42,
      name: "MAGLEV",
      signY: 1.02,
      ventY: [0.1, 0.34],
    },
  });
  const bodyM = paintMaterial(livery);
  // el faldon (lo que cuelga bajo el suelo del tren) lleva la misma pintura pero puede volverse
  // translucido: detras estan los imanes, el estator y el hueco, que es lo que hay que ver.
  const skirtM = paintMaterial(livery);
  skirtM.userData.skirt = true;
  bodyMats.push(bodyM, skirtM);
  const body = new THREE.Mesh(loft(pts, stations, { skirtBelow: -0.01 }), [bodyM, skirtM]);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  clipMats.push(bodyM, skirtM);

  // equipos de techo
  const roof = roofEquipment({ len: length - 0.6, role, roofY: DIM.roof });
  group.add(roof.group);
  for (const m of roof.mats) {
    bodyMats.push(m);
    clipMats.push(m);
  }
  // faros con luz propia (solo la cabeza del tren; se encienden con luz baja)
  const lamps = role === "front" ? headlamps({ len: length - 0.6, noseLen: NOSE, y: 0.7 }) : null;
  if (lamps) group.add(lamps.group);

  // fuelle hacia la seccion siguiente (la delantera no tiene)
  if (role !== "front") {
    const bel = bellows(pts, length, 0.94, 0.96);
    bodyMats.push(bel.material);
    clipMats.push(bel.material);
    group.add(bel);
    tagPart("ems", "tren", bel);
  }

  const Lb = length - 0.6 - (role === "mid" ? 0 : 3);
  const xc = role === "front" ? -1.5 : role === "rear" ? 1.5 : 0;

  // interior visible en el corte: suelo y asientos
  const interior = new THREE.Group();
  const floorM = mat.floor();
  const seatM = mat.seat();
  clipMats.push(floorM, seatM);
  bodyMats.push(floorM, seatM); // en rayos x el interior tambien se vuelve transparente
  const fl = new THREE.Mesh(new THREE.BoxGeometry(Lb, 0.08, DIM.halfW * 2 - 0.1), floorM);
  fl.position.set(xc, 0.5, 0);
  interior.add(fl);
  const rows = Math.floor((Lb - 3) / 1.0);
  for (let i = 0; i < rows; i++) {
    for (const s of [-1, 1]) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 1.5), seatM);
      seat.position.set(xc - (Lb - 3) / 2 + i * 1.0 + 0.5, 1.0, s * 1.15);
      interior.add(seat);
    }
  }
  group.add(interior);

  // ---- imanes de sustentacion y de guiado (cuelgan del faldon) ----
  const mag = new THREE.Group();
  group.add(mag);
  const levM = new THREE.MeshStandardMaterial({ color: "#454d57", roughness: 0.5, metalness: 0.8 });
  const copperM = mat.copper();
  const darkM = mat.dark();
  const poleTex = poleTexture(12);
  const poleM = new THREE.MeshStandardMaterial({
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2, // la cara polar va a 2 mm del nucleo
    map: poleTex,
    emissiveMap: poleTex,
    emissive: new THREE.Color("#ffffff"),
    emissiveIntensity: 0.35,
    roughness: 0.5,
  });
  clipMats.push(levM, copperM, darkM, poleM);

  const nMod = Math.floor((length - 2.5) / MOD);
  const modules = []; // x del inicio de cada modulo en el mundo (multiplo del par de polos)
  const levMeshes = [];
  const guideMeshes = [];
  const levGroup = new THREE.Group(); // se mueve en y con la exageracion
  const guideGroup = new THREE.Group();
  mag.add(levGroup, guideGroup);
  const airGeos = []; // una caja por modulo y lado: el aire entre la cara polar y el estator
  for (const s of [-1, 1]) {
    for (let i = 0; i < nMod; i++) {
      const raw = (i - (nMod - 1) / 2) * (MOD + 0.12) + (role === "front" ? -1.2 : role === "rear" ? 1.2 : 0);
      const start = Math.round((baseX + raw - MOD / 2) / PAIR) * PAIR; // alineado con la onda
      const x = start + MOD / 2 - baseX;
      if (s > 0) modules.push({ x0: start, xc: start + MOD / 2 });
      airGeos.push(new THREE.BoxGeometry(MOD - 0.04, 1, DIM.statorZ1 - DIM.statorZ0).translate(x, 0.5, s * (DIM.statorZ0 + DIM.statorZ1) / 2));
      // sustentacion: nucleo, bobinado y cara polar (en y local de levgroup: 0 = cara polar)
      const core = new THREE.Mesh(new THREE.BoxGeometry(MOD - 0.04, 0.14, 0.5), levM);
      core.position.set(x, -0.075, s * (DIM.statorZ0 + DIM.statorZ1) / 2);
      const coil = new THREE.Mesh(new THREE.BoxGeometry(MOD - 0.3, 0.12, 0.66), copperM);
      coil.position.set(x, -0.21, s * (DIM.statorZ0 + DIM.statorZ1) / 2);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(MOD - 0.04, 0.5), poleM);
      face.rotation.x = -Math.PI / 2;
      face.position.set(x, 0.002, s * (DIM.statorZ0 + DIM.statorZ1) / 2);
      levGroup.add(core, coil, face);
      levMeshes.push(core, coil, face);
      // brazo hasta el faldon
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, DIM.cavityHalf - DIM.statorZ1 + 0.05), darkM);
      arm.position.set(x - (MOD - 0.04) / 2 + 0.2, -0.33, s * ((DIM.cavityHalf + DIM.statorZ1) / 2));
      levGroup.add(arm);
      // guiado: placa sobre el faldon mirando al riel
      const gcore = new THREE.Mesh(new THREE.BoxGeometry(MOD - 0.04, 0.4, 0.14), levM);
      gcore.position.set(x, 0, s * 0);
      const gcoil = new THREE.Mesh(new THREE.BoxGeometry(MOD - 0.3, 0.3, 0.1), copperM);
      gcoil.position.set(x, 0, s * 0.12); // detras del nucleo, lejos del riel
      const gface = new THREE.Mesh(new THREE.PlaneGeometry(MOD - 0.04, 0.4), poleM);
      // la cara mira hacia el riel (hacia el centro): +z para el lado -z, -z para el +z
      gface.rotation.y = s > 0 ? Math.PI : 0;
      gface.position.set(x, 0, s > 0 ? -0.071 : 0.071);
      // se coloca despues segun la exageracion
      const holder = new THREE.Group();
      holder.userData.side = s;
      holder.add(gcore, gcoil, gface);
      guideGroup.add(holder);
      guideMeshes.push(holder);
    }
  }
  for (const o of [...levGroup.children, ...guideGroup.children]) {
    o.traverse((c) => {
      if (c.isMesh) c.castShadow = true;
    });
  }

  // piezas del explorador: el tren (carroceria, techo, fuelle, interior) y los imanes
  tagPart("ems", "tren", body);
  tagPartTree("ems", "tren", roof.group);
  tagPartTree("ems", "tren", interior);
  levGroup.children.forEach((c) => c.isMesh && tagPart("ems", "lev", c, Math.sign(c.position.z) || 1));
  guideGroup.children.forEach((h) => h.children.forEach((c) => tagPart("ems", "guide", c, h.userData.side)));

  // el hueco de 10 mm, dibujado como una banda de color entre la cara polar (y = 0 en levgroup) y el estator
  // (y = hueco dibujado): sin ella el hueco es una rendija que se confunde con la sombra. no es una pieza.
  const airM = new THREE.MeshBasicMaterial({ color: "#35d0ff", transparent: true, opacity: 0.34, depthWrite: false });
  clipMats.push(airM);
  const air = new THREE.Mesh(mergeGeometries(airGeos), airM);
  air.renderOrder = 3;
  air.frustumCulled = false;
  levGroup.add(air);

  // refs
  const api = {
    group,
    bodyMats,
    clipMats,
    levGroup,
    air,
    airM,
    modules,
    poleM,
    length,
    /** gapm, lateralm: entrehierro y desplazamiento reales; exag: factor visual */
    setGap(gapM, lateralM, exag, gap0 = EMS.gapNominal) {
      const gv = gapM * exag;
      // el vehiculo cuelga: origen local y = 7.22 - (gap - gap0) * exag
      group.position.y = DIM.plateTop + DIM.floorClear - (gapM - gap0) * exag;
      group.position.z = lateralM * exag;
      // cara polar a statorbottom - gap0*exag respecto del origen local del vehiculo
      levGroup.position.y = DIM.statorBottom - gap0 * exag - (DIM.plateTop + DIM.floorClear);
      air.scale.y = Math.max(gv, 1e-4);
      // guiado: cara a platehalf + .06 + gap0*exag del riel
      for (const h of guideMeshes) {
        const s = h.userData.side;
        h.position.set(0, (DIM.railY0 + DIM.railY1) / 2 - (DIM.plateTop + DIM.floorClear), s * (DIM.plateHalf + 0.06 + gap0 * exag + 0.07));
      }
      return gv;
    },
    setNight(on) {
      lamps?.setOn(on);
    },
    setCurrentRel(rel) {
      poleM.emissiveIntensity = 0.15 + 0.35 * Math.min(2, rel);
    },
  };
  return api;
}
