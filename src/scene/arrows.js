// flechas de fuerza 3d. la longitud sigue una escala de raiz cuadrada respecto
// de una fuerza de referencia, para que fuerzas de ordenes distintos se vean.

import * as THREE from "three";

export function makeArrow(color, { radius = 0.07, head = 0.32 } = {}) {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: false });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 12), m);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(radius * 2.6, head, 16), m);
  shaft.renderOrder = cone.renderOrder = 8;
  g.add(shaft, cone);
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  g.userData.set = (dir, length) => {
    const L = Math.max(0, length);
    g.visible = L > 0.45; // mas cortas que la cabeza no se leen: solo estorban
    if (!g.visible) return;
    const d = dir.clone().normalize();
    q.setFromUnitVectors(up, d);
    g.quaternion.copy(q);
    const shaftLen = Math.max(0.02, L - head);
    shaft.scale.set(1, shaftLen, 1);
    shaft.position.set(0, shaftLen / 2, 0);
    cone.position.set(0, shaftLen + head / 2, 0);
  };
  return g;
}

/** longitud (m) a partir de la fuerza f y la de referencia fref (escala de raiz). */
export const arrowLength = (F, Fref, Lref = 3.2) => Lref * Math.sqrt(Math.max(0, F) / Fref);
