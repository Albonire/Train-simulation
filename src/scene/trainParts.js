// Piezas sueltas del coche que no caben en la textura: equipos de techo, antenas y
// faros con luz propia. Los materiales que devuelve se registran en `bodyMats` y
// `clipMats` del coche para que sigan los modos Rayos X y Corte.

import * as THREE from "three";

/**
 * Equipos de techo: unidades de climatizacion, una antena y un pequeno carenado.
 * roofY: altura de la cresta del techo (local); len: tramo recto del coche.
 */
export function roofEquipment({ len, role, roofY }) {
  const group = new THREE.Group();
  const podM = new THREE.MeshStandardMaterial({ color: "#d5dbe1", roughness: 0.55, metalness: 0.3 });
  const ventM = new THREE.MeshStandardMaterial({ color: "#2a323b", roughness: 0.8, metalness: 0.2 });
  const half = len / 2;
  const x0 = -half + (role === "rear" ? 4.5 : 3);
  const x1 = half - (role === "front" ? 4.5 : 3);
  const n = Math.max(1, Math.round((x1 - x0) / 7));
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (n - 1);
    const pod = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.26, 1.1), podM);
    pod.position.set(x, roofY + 0.1, 0);
    pod.castShadow = true;
    const vent = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.03, 0.7), ventM);
    vent.position.set(x, roofY + 0.235, 0);
    group.add(pod, vent);
  }
  // antena de aleta y varilla
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.12), podM);
  fin.position.set(x0 + 0.3, roofY + 0.07, 0.5);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), ventM);
  rod.position.set(x1 - 0.3, roofY + 0.28, -0.4);
  group.add(fin, rod);
  return { group, mats: [podM, ventM] };
}

/**
 * Faros de la cabeza del tren: dos focos sin sombra. Solo se encienden con luz baja
 * (tema oscuro); en el dia estan apagados para no gastar en el sombreado.
 */
export function headlamps({ len, noseLen, y }) {
  const group = new THREE.Group();
  const lights = [];
  for (const z of [-0.9, 0.9]) {
    const l = new THREE.SpotLight("#fff1d6", 6000, 160, 0.34, 0.7, 2);
    l.position.set(len / 2 + noseLen * 0.85, y, z);
    l.target.position.set(len / 2 + noseLen + 70, y - 4, z * 1.6);
    l.castShadow = false;
    l.visible = false;
    group.add(l, l.target);
    lights.push(l);
  }
  return { group, setOn: (on) => lights.forEach((l) => (l.visible = on)) };
}
