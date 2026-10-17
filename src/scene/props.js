// Mobiliario de via y vegetacion baja: postes de luz, hitos, cerca de servicio y arbustos.
//
// Sin instancias de GPU: cada tipo es un conjunto de mallas fusionadas ("losetas") que siguen la
// via con la tecnica de la cinta. Una loseta cubre un tramo fijo de pista y es identica a las
// demas (o se repite cada pocas), de modo que al salir por un extremo se recoloca en el otro sin
// cambiar su contenido. Cada loseta es un objeto aparte: asi se puede ocultar entera cuando cae
// una estacion encima o una camara baja a su lado (ver setClear).

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { bushLayout } from "./scatter.js";

const flat = (g) => (g.index ? g.toNonIndexed() : g);

/** Fusiona geometrias, cada una con su matriz, en una sola. */
function merge(list) {
  const out = list.map(({ geo, at = [0, 0, 0], rotY = 0, scale = [1, 1, 1] }) => {
    const g = flat(geo.clone());
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)), new THREE.Vector3(...scale));
    g.applyMatrix4(m);
    return g;
  });
  return mergeGeometries(out, false);
}

export function createProps(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const rings = []; // { tile, count, z0, z1, tiles: [{ meshes }] }

  /**
   * Anillo de losetas. parts: [{ geos: [geometria por variante], mat }]; M variantes que se repiten
   * (count debe ser multiplo de M). zRange: [z0, z1] de lo que contiene, para ocultarlo.
   */
  function ring({ tile, count, parts, zRange }) {
    const M = parts[0].geos.length;
    const tiles = [];
    for (let j = 0; j < count; j++) {
      const meshes = parts.map(({ geos, mat }) => {
        const m = new THREE.Mesh(geos[j % M], mat);
        m.castShadow = false;
        root.add(m);
        return m;
      });
      tiles.push({ meshes });
    }
    rings.push({ tile, count, z0: zRange[0], z1: zRange[1], tiles });
  }

  // ---- postes de luz cada 48 m, a ambos lados del corredor ----
  const LAMP = 48;
  const lampPole = [];
  const lampHead = [];
  for (const side of [-1, 1]) {
    for (const x of [0, LAMP]) {
      const rotY = side > 0 ? 0 : Math.PI; // el brazo apunta a la via
      const at = [x, 0, side * 7.2];
      lampPole.push({ geo: new THREE.CylinderGeometry(0.07, 0.1, 7.2, 8).translate(0, 3.6, 0), at, rotY });
      lampPole.push({ geo: new THREE.BoxGeometry(1.5, 0.07, 0.07).translate(-0.7, 7.15, 0), at, rotY });
      lampHead.push({ geo: new THREE.BoxGeometry(0.55, 0.1, 0.26).translate(-1.35, 7.08, 0), at, rotY });
      lampPole.push({ geo: new THREE.BoxGeometry(0.34, 0.5, 0.34).translate(0, 0.25, 0), at, rotY }); // zocalo
    }
  }
  const poleMat = new THREE.MeshStandardMaterial({ color: "#5b636c", roughness: 0.6, metalness: 0.6 });
  const headMat = new THREE.MeshStandardMaterial({ color: "#e8e6dc", roughness: 0.4, emissive: new THREE.Color("#ffe6b0"), emissiveIntensity: 0 });
  ring({
    tile: LAMP * 2,
    count: 34,
    parts: [
      { geos: [merge(lampPole)], mat: poleMat },
      { geos: [merge(lampHead)], mat: headMat },
    ],
    zRange: [-8.6, 8.6],
  });

  // ---- hitos cada 250 m ----
  const hitoMat = new THREE.MeshStandardMaterial({ color: "#e7e9ec", roughness: 0.85 });
  const bandMat = new THREE.MeshStandardMaterial({ color: "#c8372d", roughness: 0.7 });
  const hitoList = [];
  const bandList = [];
  for (const side of [-1, 1]) {
    hitoList.push({ geo: new THREE.BoxGeometry(0.28, 1.2, 0.18).translate(0, 0.6, 0), at: [0, 0, side * 5.6] });
    bandList.push({ geo: new THREE.BoxGeometry(0.3, 0.22, 0.2).translate(0, 0.95, 0), at: [0, 0, side * 5.6] });
  }
  ring({
    tile: 250,
    count: 13,
    parts: [
      { geos: [merge(hitoList)], mat: hitoMat },
      { geos: [merge(bandList)], mat: bandMat },
    ],
    zRange: [-6, 6],
  });

  // ---- cerca de servicio: postes cada 6 m y tres alambres por tramo de 48 m ----
  const FENCE = 6;
  const FENCE_TILE = 48;
  const fenceMat = new THREE.MeshStandardMaterial({ color: "#a9a69c", roughness: 0.92 });
  const wireMat = new THREE.MeshStandardMaterial({ color: "#7f7a70", roughness: 1, metalness: 0 });
  const postList = [];
  const wireList = [];
  for (const side of [-1, 1]) {
    for (let x = 0; x < FENCE_TILE; x += FENCE) postList.push({ geo: new THREE.CylinderGeometry(0.05, 0.06, 1.25, 6).translate(0, 0.62, 0), at: [x, 0, side * 13] });
    for (const y of [0.45, 0.85, 1.2]) wireList.push({ geo: new THREE.BoxGeometry(FENCE_TILE, 0.015, 0.015).translate(FENCE_TILE / 2, 0, 0), at: [0, y, side * 13] });
  }
  ring({
    tile: FENCE_TILE,
    count: 22,
    parts: [
      { geos: [merge(postList)], mat: fenceMat },
      { geos: [merge(wireList)], mat: wireMat },
    ],
    zRange: [-13.2, 13.2],
  });

  // ---- arbustos junto a la cerca: reparto fijo que se repite cada 600 m, en losetas de 60 m ----
  const PERIOD = 600;
  const BUSH_TILE = 60;
  const BUSH = ["#4d7a3a", "#5f8742", "#3f6b36", "#7a8a3e"].map((h) => {
    const c = new THREE.Color(h);
    return [c.r, c.g, c.b];
  });
  const layout = bushLayout(PERIOD);
  const bushMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, vertexColors: true, flatShading: true });
  const variants = Array.from({ length: PERIOD / BUSH_TILE }, (_, v) => {
    const list = [];
    for (const b of layout) {
      if (Math.floor(b.x / BUSH_TILE) !== v) continue;
      const g = new THREE.IcosahedronGeometry(1, 1);
      const n = g.getAttribute("position").count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) col.set(BUSH[b.hue], i * 3);
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      g.deleteAttribute("uv");
      list.push({ geo: g, at: [b.x - v * BUSH_TILE, b.r * 0.45, b.z], rotY: b.x, scale: [b.r * 1.3, b.r * 0.9, b.r * 1.3] });
    }
    return list.length ? merge(list) : new THREE.BufferGeometry();
  });
  ring({ tile: BUSH_TILE, count: 60, parts: [{ geos: variants, mat: bushMat }], zRange: [-24, 24] });

  // huellas ocultas (mundo): { x0, x1, z0, z1 }
  let clear = [];
  const hits = (x0, x1, z0, z1) => clear.some((b) => x1 >= b.x0 && x0 <= b.x1 && z1 >= b.z0 && z0 <= b.z1);

  return {
    /** Cajas del mundo que deben quedar libres (estaciones y camara baja). */
    setClear(boxes) {
      clear = boxes;
    },
    /** s: coordenada de pista del centro del tren */
    update(s) {
      for (const r of rings) {
        const span = r.count * r.tile;
        for (let j = 0; j < r.count; j++) {
          const t = r.tiles[j];
          const x = ((((j * r.tile - s) % span) + span) % span) - span / 2;
          const hide = clear.length > 0 && hits(x, x + r.tile, r.z0, r.z1);
          for (const m of t.meshes) {
            m.position.x = x;
            m.visible = !hide;
          }
        }
      }
    },
    setNight(on) {
      headMat.emissiveIntensity = on ? 3 : 0;
    },
    tint(c) {
      bushMat.color.set(c);
    },
  };
}
