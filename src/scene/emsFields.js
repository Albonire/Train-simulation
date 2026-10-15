// Capa de campos del modo EMS: lazos de flujo en el entrehierro, onda del
// estator y flechas de fuerza.

import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { sets } from "./glow.js";
import { DIM } from "./ems.js";
import { createForceArrows } from "./forceArrows.js";
import { EMS } from "../physics/constants.js";

const ARROW_RIGS = ["orbit", "chase", "top"];
const TAU = EMS.polePitch;

export function createEmsFields(sceneApi) {
  const mid = sceneApi.sections[Math.floor(sceneApi.sections.length / 2)];
  const midBaseX = mid.baseX;

  // ---- lazos de flujo (en el marco de levGroup: y = 0 es la cara polar) ----
  const zc = (DIM.statorZ0 + DIM.statorZ1) / 2;
  const loops = [];
  for (const side of [-1, 1]) {
    const c0 = Math.max(0, Math.floor((mid.modules.length - 3) / 2));
    for (const m of mid.modules.slice(c0, c0 + 3)) {
      for (let p = 0; p < 6; p++) {
        const xa = m.x0 - midBaseX + (2 * p + 0.5) * TAU;
        for (const dz of [-0.14, 0.14]) loops.push({ xa, z: side * zc + dz });
      }
    }
  }
  // modulos de ambos lados: mid.modules solo guarda s > 0, se repite en los dos lados arriba

  const ARC = 10;
  let lastGv = -1;
  const geo = new LineSegmentsGeometry();
  const mat = new LineMaterial({
    color: new THREE.Color("#ff9d00"),
    linewidth: 2.2,
    dashed: true,
    dashSize: 0.1,
    gapSize: 0.09,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
  });
  mat.resolution.set(window.innerWidth, window.innerHeight);
  sceneApi.clipMats.push(mat); // las lineas tambien se recortan con el plano de corte
  const lines = new LineSegments2(geo, mat);
  lines.renderOrder = 7;
  lines.frustumCulled = false;
  mid.levGroup.add(lines);

  function rebuild(gv) {
    const pos = [];
    const seg = (a, b) => pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    for (const { xa, z } of loops) {
      const xb = xa + TAU;
      const xm = (xa + xb) / 2;
      const r = TAU / 2;
      const path = [[xa, 0, z], [xa, gv, z]];
      for (let i = 1; i <= ARC; i++) {
        const f = (Math.PI * i) / ARC;
        path.push([xm - r * Math.cos(f), gv + 0.75 * r * Math.sin(f), z]);
      }
      path.push([xb, 0, z]);
      for (let i = 1; i <= ARC; i++) {
        const f = (Math.PI * i) / ARC;
        path.push([xm + r * Math.cos(f), -0.75 * r * Math.sin(f), z]);
      }
      for (let i = 0; i < path.length - 1; i++) seg(path[i], path[i + 1]);
    }
    geo.setPositions(pos);
    lines.computeLineDistances();
  }

  const arrowsApi = createForceArrows(mid.group, 1.9);

  return {
    arrows: arrowsApi.group,
    lines,
    update(tel, train, view) {
      const s = train.sections[Math.floor(train.sections.length / 2)];
      // lazos de flujo
      const gv = s.gap * view.exag;
      if (Math.abs(gv - lastGv) > 0.002) {
        rebuild(gv);
        lastGv = gv;
      }
      const B = Math.min(2.2, (s.I / s.I0) * (s.gap0 / s.gap));
      lines.visible = view.layers.fields && !train.sections[0].fallen;
      mat.opacity = Math.min(1, 0.25 + 0.55 * B);
      mat.dashOffset -= 0.012 * (0.4 + B);
      mat.resolution.set(window.innerWidth, window.innerHeight);

      arrowsApi.update(s, train, train.resistance(train.v) / train.sections.length, view.layers.forces && ARROW_RIGS.includes(view.rig));
    },
  };
}

/** Actualiza los uniformes globales de la onda del estator. */
export function updateEmsGlow(tel, train, view) {
  const L = train.length;
  const shared = sets.stator;
  shared.uPitch.value = TAU;
  shared.uShift.value = (tel.loadAngleDeg / 180) * TAU;
  const moving = train.v > 0.5 && train.levitated;
  const amp = moving ? Math.min(1, 0.3 + 0.9 * Math.abs(train.thrust) / Math.max(1, train.fMaxAt(0))) : 0;
  shared.uAmp.value = view.layers.wave ? amp : 0;
  shared.uRangeMin.value = -L / 2 - 28;
  shared.uRangeMax.value = L / 2 + 28;
  shared.uFade.value = 18;
}
