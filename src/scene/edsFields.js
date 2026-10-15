// Capa de campos del modo EDS: flujo entre los imanes superconductores y las
// bobinas de la pared, ondas de propulsion e induccion, y flechas de fuerza.

import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { sets } from "./glow.js";
import { D, COIL_P } from "./edsGeo.js";
import { createForceArrows } from "./forceArrows.js";
import { EDS } from "../physics/constants.js";

const ARROW_RIGS = ["orbit", "chase", "top"];

export function createEdsFields(sceneApi) {
  const mid = sceneApi.sections[Math.floor(sceneApi.sections.length / 2)];
  const baseX = mid.baseX;

  // arcos en planta (plano x-z) desde un polo N hasta el S contiguo, pasando por la
  // zona de las bobinas de la pared
  const ARC = 10;
  const arcs = [];
  // alturas locales (respecto del suelo del vehiculo): sobre la cara del criostato
  const heights = [0.45, 1.0, 1.55];
  for (const side of [-1, 1]) {
    for (const m of mid.modules) {
      for (let p = 0; p < 4; p += 2) {
        const xa = m.x0 - baseX + (p + 0.5) * COIL_P;
        for (const y of heights) arcs.push({ xa, side, y });
      }
    }
  }
  const geo = new LineSegmentsGeometry();
  const mat = new LineMaterial({
    color: new THREE.Color("#ffd23f"), linewidth: 2.2, dashed: true, dashSize: 0.1, gapSize: 0.09,
    transparent: true, opacity: 0.9, depthTest: false,
  });
  mat.resolution.set(window.innerWidth, window.innerHeight);
  sceneApi.clipMats.push(mat); // las lineas tambien se recortan con el plano de corte
  const lines = new LineSegments2(geo, mat);
  lines.renderOrder = 7;
  lines.frustumCulled = false;
  mid.group.add(lines);

  const zFace = D.cryoZ1; // cara de los criostatos (local)
  function rebuild(reach) {
    const pos = [];
    const r = COIL_P / 2;
    for (const { xa, side, y } of arcs) {
      const xm = xa + r;
      const pts = [];
      // desde el polo N hacia la pared y de vuelta al polo S
      pts.push([xa, y, side * zFace]);
      for (let i = 1; i < ARC; i++) {
        const f = (Math.PI * i) / ARC;
        pts.push([xm - r * Math.cos(f), y, side * (zFace + reach * Math.sin(f))]);
      }
      pts.push([xa + COIL_P, y, side * zFace]);
      for (let i = 0; i < pts.length - 1; i++) pos.push(...pts[i], ...pts[i + 1]);
    }
    geo.setPositions(pos);
    lines.computeLineDistances();
  }
  let lastReach = -1;

  const arrowsApi = createForceArrows(mid.group, D.height);

  return {
    arrows: arrowsApi.group,
    lines,
    update(tel, train, view) {
      const s = train.sections[Math.floor(train.sections.length / 2)];
      // el flujo llega hasta las bobinas de la pared: holgura lateral real, exagerada
      const reach = 0.28 * Math.min(1.4, 0.6 + tel.induced);
      if (Math.abs(reach - lastReach) > 0.01) {
        rebuild(reach);
        lastReach = reach;
      }
      lines.visible = view.layers.fields && view.magnetsVisible;
      mat.opacity = 0.3 + 0.6 * Math.min(1, tel.induced + 0.15);
      mat.dashOffset -= 0.012 * (0.4 + tel.induced);
      mat.resolution.set(window.innerWidth, window.innerHeight);
      const n = train.sections.length;
      const drag = s.drag + s.rollingResistance() + train.aero(train.v) / n;
      arrowsApi.update(s, train, drag, view.layers.forces && ARROW_RIGS.includes(view.rig));
    },
  };
}

/** Uniformes globales de las ondas del EDS (propulsion e induccion). */
export function updateEdsGlow(tel, train, view) {
  const L = train.length;
  const p = sets.propulsion;
  p.uPitch.value = EDS.polePitch;
  p.uShift.value = (tel.loadAngleDeg / 180) * EDS.polePitch;
  const moving = train.v > 0.5;
  p.uAmp.value = view.layers.wave && moving ? Math.min(1, 0.3 + 0.9 * Math.abs(train.thrust) / Math.max(1, train.fMaxAt(0))) : 0;
  p.uRangeMin.value = -L / 2 - 20;
  p.uRangeMax.value = L / 2 + 20;
  p.uFade.value = 12;
  const q = sets.induced;
  q.uPitch.value = EDS.polePitch;
  q.uShift.value = 0;
  q.uAmp.value = view.layers.wave ? tel.induced : 0;
  q.uRangeMin.value = -L / 2 - 4;
  q.uRangeMax.value = L / 2 + 4;
  q.uFade.value = 8;
}
