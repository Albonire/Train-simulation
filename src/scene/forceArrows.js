// Conjunto de flechas de fuerza de una seccion (peso, sustentacion, empuje,
// resistencia y fuerza lateral). Comparte la logica entre EMS y EDS.

import * as THREE from "three";
import { makeArrow, arrowLength } from "./arrows.js";
import { G } from "../physics/constants.js";

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const nX = new THREE.Vector3(-1, 0, 0);
const nY = new THREE.Vector3(0, -1, 0);
const nZ = new THREE.Vector3(0, 0, -1);

// Diagrama de cuerpo libre sobre el techo: todas las flechas salen de un mismo
// punto, por encima de la carroceria, para que no se mezclen con ella.
export function createForceArrows(parent, roofY) {
  const group = new THREE.Group();
  group.position.set(0, roofY + 3.8, 0);
  parent.add(group);
  const opt = { radius: 0.11, head: 0.5 };
  const a = {
    lift: makeArrow("#35e08a", opt),
    weight: makeArrow("#f2f5f8", opt),
    thrust: makeArrow("#35d0ff", opt),
    drag: makeArrow("#ffa43a", opt),
    side: makeArrow("#ff5fd2", opt),
  };
  const hub = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 16, 12),
    new THREE.MeshBasicMaterial({ color: "#1b2430", transparent: true, opacity: 0.9, depthTest: false }),
  );
  hub.renderOrder = 9;
  group.add(hub, ...Object.values(a));
  // extremos de las flechas de sustentacion y peso, en el mundo: ahi se anclan sus rotulos
  const tips = { lift: new THREE.Vector3(), weight: new THREE.Vector3() };
  const origin = new THREE.Vector3();
  return {
    group,
    tips,
    /** sec: seccion fisica central; train: tren; drag: resistencia total por seccion (N) */
    update(sec, train, drag, visible) {
      group.visible = visible;
      if (!visible) return;
      const n = train.sections.length;
      const ref = sec.mass * G;
      const Ll = arrowLength(sec.lift, ref);
      const Lw = arrowLength((sec.mass + sec.extraMass) * G, ref);
      a.lift.userData.set(Y, Ll);
      a.weight.userData.set(nY, Lw);
      group.getWorldPosition(origin);
      // junto al eje de cada flecha, un poco a un lado, a media altura
      tips.lift.set(origin.x + 2.6, origin.y + Math.max(Ll, 0.5) * 0.55 - 0.55, origin.z);
      tips.weight.set(origin.x + 2.6, origin.y - Math.max(Lw, 0.5) * 0.55 - 0.55, origin.z);
      a.thrust.userData.set(X, arrowLength(Math.max(0, train.thrust) / n, ref));
      a.drag.userData.set(nX, arrowLength(drag + Math.max(0, -train.thrust) / n, ref));
      const Fy = sec.lateralForce;
      a.side.userData.set(Fy >= 0 ? Z : nZ, arrowLength(Math.abs(Fy), ref));
    },
  };
}
