// Mobiliario de via y vegetacion baja: postes de luz, hitos, cerca de servicio y
// arbustos. Todo esta instanciado y sigue la via con la tecnica de la cinta: las
// instancias se reparten con una separacion fija y lo unico que se mueve por cuadro
// es el grupo (-(s mod separacion)), sin reescribir matrices.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng } from "./textures.js";

const SPAN = 1600; // m a cada lado del tren

/** Posiciones x = i * spacing para i en [-span/spacing, span/spacing]. */
function line(spacing, span = SPAN) {
  const out = [];
  const n = Math.ceil(span / spacing);
  for (let i = -n; i <= n; i++) out.push(i * spacing);
  return out;
}

export function createProps(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const tmp = new THREE.Object3D();
  const items = []; // { group, spacing }

  const mkGroup = (spacing) => {
    const g = new THREE.Group();
    root.add(g);
    items.push({ g, spacing });
    return g;
  };

  // ---- postes de luz cada 48 m, a ambos lados del corredor ----
  const LAMP = 48;
  const xs = line(LAMP);
  const poleGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.07, 0.1, 7.2, 8).translate(0, 3.6, 0),
    new THREE.BoxGeometry(1.5, 0.07, 0.07).translate(-0.7, 7.15, 0),
  ]);
  const headGeo = new THREE.BoxGeometry(0.55, 0.1, 0.26).translate(-1.35, 7.08, 0);
  const poleMat = new THREE.MeshStandardMaterial({ color: "#5b636c", roughness: 0.6, metalness: 0.6 });
  const headMat = new THREE.MeshStandardMaterial({ color: "#e8e6dc", roughness: 0.4, emissive: new THREE.Color("#ffe6b0"), emissiveIntensity: 0 });
  const lampG = mkGroup(LAMP);
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, xs.length * 2);
  const heads = new THREE.InstancedMesh(headGeo, headMat, xs.length * 2);
  let k = 0;
  for (const side of [-1, 1]) {
    for (const x of xs) {
      tmp.position.set(x, 0, side * 7.2);
      tmp.rotation.set(0, side > 0 ? 0 : Math.PI, 0); // el brazo apunta a la via
      tmp.updateMatrix();
      poles.setMatrixAt(k, tmp.matrix);
      heads.setMatrixAt(k, tmp.matrix);
      k++;
    }
  }
  poles.castShadow = true;
  lampG.add(poles, heads);

  // ---- hitos cada 250 m ----
  const HITO = 250;
  const hx = line(HITO);
  const hitoMat = new THREE.MeshStandardMaterial({ color: "#e7e9ec", roughness: 0.85 });
  const bandMat = new THREE.MeshStandardMaterial({ color: "#c8372d", roughness: 0.7 });
  const hitoG = mkGroup(HITO);
  const hitos = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 1.2, 0.18).translate(0, 0.6, 0), hitoMat, hx.length * 2);
  const bands = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.22, 0.2).translate(0, 0.95, 0), bandMat, hx.length * 2);
  k = 0;
  for (const side of [-1, 1]) {
    for (const x of hx) {
      tmp.position.set(x, 0, side * 5.6);
      tmp.rotation.set(0, 0, 0);
      tmp.updateMatrix();
      hitos.setMatrixAt(k, tmp.matrix);
      bands.setMatrixAt(k++, tmp.matrix);
    }
  }
  hitos.castShadow = true;
  hitoG.add(hitos, bands);

  // ---- cerca de servicio: postes cada 6 m y un alambre continuo (fijo: es invariante en x) ----
  const FENCE = 6;
  const FENCE_SPAN = 520; // m: mas lejos solo seria una raya brillante en el horizonte
  const fx = line(FENCE, FENCE_SPAN);
  const fenceMat = new THREE.MeshStandardMaterial({ color: "#7d776b", roughness: 0.9 });
  const fenceG = mkGroup(FENCE);
  const fPosts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.06, 1.25, 6).translate(0, 0.62, 0), fenceMat, fx.length * 2);
  k = 0;
  for (const side of [-1, 1]) {
    for (const x of fx) {
      tmp.position.set(x, 0, side * 13);
      tmp.rotation.set(0, 0, 0);
      tmp.updateMatrix();
      fPosts.setMatrixAt(k++, tmp.matrix);
    }
  }
  fenceG.add(fPosts);
  const wireMat = new THREE.MeshStandardMaterial({ color: "#7f7a70", roughness: 1, metalness: 0 });
  for (const side of [-1, 1]) {
    for (const y of [0.45, 0.85, 1.2]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(FENCE_SPAN * 2, 0.015, 0.015), wireMat);
      w.position.set(0, y, side * 13);
      root.add(w);
    }
  }

  // ---- arbustos junto a la cerca: reparto fijo que se repite cada 600 m ----
  const PERIOD = 600;
  const rnd = rng(555);
  const bushGeo = new THREE.IcosahedronGeometry(1, 1);
  const bushMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, flatShading: true });
  const layout = Array.from({ length: 110 }, () => ({
    x: rnd() * PERIOD,
    z: (rnd() < 0.5 ? -1 : 1) * (11 + rnd() * 12),
    r: 0.42 + rnd() * 0.5,
    hue: Math.floor(rnd() * 4),
  }));
  const reps = Math.ceil(SPAN / PERIOD) + 1;
  const bushG = mkGroup(PERIOD);
  const bushes = new THREE.InstancedMesh(bushGeo, bushMat, layout.length * reps * 2);
  const BUSH = ["#4d7a3a", "#5f8742", "#3f6b36", "#7a8a3e"];
  const col = new THREE.Color();
  k = 0;
  for (let p = -reps; p < reps; p++) {
    for (const b of layout) {
      tmp.position.set(p * PERIOD + b.x, b.r * 0.45, b.z);
      tmp.rotation.set(0, b.x, 0);
      tmp.scale.set(b.r * 1.3, b.r * 0.9, b.r * 1.3);
      tmp.updateMatrix();
      bushes.setMatrixAt(k, tmp.matrix);
      bushes.setColorAt(k++, col.set(BUSH[b.hue]));
    }
  }
  bushes.count = k;
  bushes.castShadow = true;
  bushG.add(bushes);

  return {
    /** s: coordenada de pista del centro del tren */
    update(s) {
      for (const it of items) it.g.position.x = -(((s % it.spacing) + it.spacing) % it.spacing);
    },
    setNight(on) {
      headMat.emissiveIntensity = on ? 3 : 0;
    },
    tint(c) {
      bushMat.color.set(c);
    },
  };
}
