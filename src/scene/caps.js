// tapas planas sobre el plano de corte x = 0: la seccion transversal dibujada
// como una lamina tecnica dentro de la escena 3d.

import * as THREE from "three";

/** rects: [[z0, z1, y0, y1], ...] en coordenadas (z, y). */
export function capMesh(rects, color, opacity = 1) {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  for (const [z0, z1, y0, y1] of rects) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0, y1 - y0), m);
    mesh.rotation.y = Math.PI / 2; // el plano mira a +x
    mesh.position.set(0, (y0 + y1) / 2, (z0 + z1) / 2);
    g.add(mesh);
  }
  return g;
}

/** devuelve [z0, z1] para el lado `side` (+1/-1) dado el intervalo positivo. */
export const sideRange = (side, a, b) => (side > 0 ? [a, b] : [-b, -a]);
