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

export function createForceArrows(parent, y = 1.9) {
  const group = new THREE.Group();
  group.position.set(0, y, 0);
  parent.add(group);
  const a = {
    lift: makeArrow("#35e08a"),
    weight: makeArrow("#f2f5f8"),
    thrust: makeArrow("#35d0ff"),
    drag: makeArrow("#ffa43a"),
    side: makeArrow("#ff5fd2"),
  };
  a.lift.position.set(-0.6, 0, 0);
  a.weight.position.set(0.6, 0, 0);
  a.thrust.position.set(1.0, -0.2, 0);
  a.drag.position.set(-1.0, -0.2, 0);
  a.side.position.set(0, -0.6, 0);
  group.add(...Object.values(a));
  return {
    group,
    /** sec: seccion fisica central; train: tren; drag: resistencia total por seccion (N) */
    update(sec, train, drag, visible) {
      group.visible = visible;
      if (!visible) return;
      const n = train.sections.length;
      const ref = sec.mass * G;
      a.lift.userData.set(Y, arrowLength(sec.lift, ref));
      a.weight.userData.set(nY, arrowLength((sec.mass + sec.extraMass) * G, ref));
      a.thrust.userData.set(X, arrowLength(Math.max(0, train.thrust) / n, ref));
      a.drag.userData.set(nX, arrowLength(drag + Math.max(0, -train.thrust) / n, ref));
      const Fy = sec.lateralForce;
      a.side.userData.set(Fy >= 0 ? Z : nZ, arrowLength(Math.abs(Fy), ref));
    },
  };
}
