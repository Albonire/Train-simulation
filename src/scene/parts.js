// Registro de piezas, explosion, seleccion y resaltado.
//
// Los constructores de la via y de los coches etiquetan cada malla con `tag(modo, id, malla, dir)`.
// `dir` es el desplazamiento (m) de esa malla con la vista expandida al maximo. Con eso:
//  - `pick` lanza un rayo y devuelve la pieza bajo el puntero (el coche solo si no hay otra)
//  - `setExplode(k)` separa las piezas (k de 0 a 1)
//  - `setHighlight` superpone una copia translucida de las mallas de una pieza
//  - `focusBox` da la caja que encuadra una pieza cerca del centro del tren

import * as THREE from "three";
import { partById } from "./partsData.js";

const reg = { ems: new Map(), eds: new Map() }; // id -> [{ mesh, rest, dir }]
const lists = { ems: [], eds: [] }; // todas las mallas, para el rayo
let explodeK = 0;

/** Etiqueta una malla como parte de la pieza `id`. Llamar despues de fijar su posicion. */
export function tag(mode, id, mesh, dir = [0, 0, 0]) {
  mesh.userData.part = id;
  if (!reg[mode].has(id)) reg[mode].set(id, []);
  reg[mode].get(id).push({ mesh, rest: mesh.position.clone(), dir: new THREE.Vector3(...dir) });
  lists[mode].push(mesh);
  return mesh;
}

/**
 * Etiqueta una malla con el desplazamiento de explosion del catalogo (partsData.js).
 * side: +1 o -1, el lado de la via: el desplazamiento lateral se refleja.
 */
export function tagPart(mode, id, mesh, side = 1) {
  const e = partById(mode, id).explode;
  return tag(mode, id, mesh, [e.dx, e.dy, e.dz * side]);
}

/** Etiqueta todas las mallas de un objeto con el catalogo. */
export function tagPartTree(mode, id, obj, side = 1) {
  obj.traverse((o) => {
    if (o.isMesh) tagPart(mode, id, o, side);
  });
  return obj;
}

/** Etiqueta todas las mallas de un objeto. */
export function tagTree(mode, id, obj, dir) {
  obj.traverse((o) => {
    if (o.isMesh) tag(mode, id, o, dir);
  });
  return obj;
}

export function setExplode(k) {
  explodeK = k;
  for (const mode of ["ems", "eds"]) {
    for (const list of reg[mode].values()) {
      for (const e of list) e.mesh.position.copy(e.rest).addScaledVector(e.dir, k);
    }
  }
}
export const getExplode = () => explodeK;

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();

/** Pieza bajo el puntero (coordenadas de pantalla) o null. */
export function pick(mode, camera, clientX, clientY, w, h) {
  ndc.set((clientX / w) * 2 - 1, -(clientY / h) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(lists[mode], false);
  let coche = null;
  for (const hit of hits) {
    if (!hit.object.visible) continue;
    const id = hit.object.userData.part;
    if (id === "coche") coche ??= { id, point: hit.point };
    else return { id, point: hit.point };
  }
  return coche;
}

// ---- resaltado ----
// Relleno translucido y aristas del mismo color: el relleno solo no se distingue sobre
// piezas claras o de color, y las aristas solas no se ven de lejos.
const hlMat = new THREE.MeshBasicMaterial({
  color: "#19d9bd",
  transparent: true,
  opacity: 0.35,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
});
const hlEdge = new THREE.LineBasicMaterial({ color: "#19d9bd", transparent: true, opacity: 0.95 });
const edgeCache = new WeakMap();
const edgesOf = (geo) => {
  if (!edgeCache.has(geo)) edgeCache.set(geo, new THREE.EdgesGeometry(geo, 25));
  return edgeCache.get(geo);
};
let hl = { mode: null, id: null, clones: [] };

export function setHighlightColor(css) {
  hlMat.color.set(css);
  hlEdge.color.set(css);
}
export function setHighlightOpacity(o) {
  hlMat.opacity = o;
}

export function setHighlight(mode, id) {
  if (hl.id === id && hl.mode === mode) return;
  for (const c of hl.clones) c.removeFromParent();
  hl = { mode, id, clones: [] };
  if (!id) return;
  for (const { mesh } of reg[mode].get(id) ?? []) {
    // todas las copias del pool de tramos: la via corre bajo el tren y la seleccion debe seguirla
    if (!mesh.visible) continue;
    const c = new THREE.Mesh(mesh.geometry, hlMat);
    c.renderOrder = 6;
    c.castShadow = false;
    c.receiveShadow = false;
    c.scale.setScalar(1.004); // evita pelearse con la propia malla
    c.userData.isHighlight = true;
    mesh.add(c); // hijo de la malla: sigue su posicion, tambien al separar las piezas
    hl.clones.push(c);
    const e = new THREE.LineSegments(edgesOf(mesh.geometry), hlEdge);
    e.renderOrder = 8;
    e.userData.isHighlight = true;
    mesh.add(e);
    hl.clones.push(e);
  }
}

/** Caja (mundo) que encuadra la pieza cerca del centro del tren, recortada a +-span m en x. */
export function focusBox(mode, id, span) {
  const box = new THREE.Box3();
  const b = new THREE.Box3();
  for (const { mesh } of reg[mode].get(id) ?? []) {
    if (!mesh.visible) continue;
    // mallas de otros coches o tramos lejanos no cuentan
    const p = new THREE.Vector3();
    mesh.getWorldPosition(p);
    if (Math.abs(p.x) > span + 14) continue;
    mesh.updateWorldMatrix(true, false);
    b.setFromObject(mesh, true);
    // setFromObject incluye a los hijos (el resaltado): se ignora
    box.union(b);
  }
  if (box.isEmpty()) return null;
  box.min.x = Math.max(box.min.x, -span);
  box.max.x = Math.min(box.max.x, span);
  if (box.min.x > box.max.x) box.min.x = box.max.x = 0;
  return box;
}
