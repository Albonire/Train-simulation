// Capa de campos del modo EDS: flujo entre los imanes superconductores y las bobinas de la
// pared (con particulas), ondas de propulsion e induccion, y flechas de fuerza.

import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { sets } from "./glow.js";
import { D, COIL_P } from "./edsGeo.js";
import { createForceArrows } from "./forceArrows.js";
import { createEdsFlux } from "./flux.js";
import { EDS } from "../physics/constants.js";

const ARROW_RIGS = ["orbit", "chase", "top"];
const N_COL = new THREE.Color("#ff4d3d");
const S_COL = new THREE.Color("#2f8cff");

const REDUCED = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export function createEdsFields(sceneApi) {
  const mid = sceneApi.sections[Math.floor(sceneApi.sections.length / 2)];
  const baseX = mid.baseX;
  // alturas locales (respecto del suelo del vehiculo): sobre la cara del criostato
  const heights = [0.45, 1.0, 1.55];

  const arcsOf = (sec) => {
    const out = [];
    for (const side of [-1, 1]) {
      for (const m of sec.modules) {
        for (let p = 0; p < 4; p += 2) {
          const xa = m.x0 - sec.baseX + (p + 0.5) * COIL_P;
          for (const y of heights) out.push({ xa, side, y });
        }
      }
    }
    return out;
  };
  const fluxes = sceneApi.sections.map((sec) => {
    const f = createEdsFlux(arcsOf(sec), COIL_P, D.cryoZ1);
    sec.group.add(f.object);
    return f;
  });

  // arcos finos y continuos (seccion central) con degradado N a S
  const ARC = 10;
  const arcs = arcsOf(mid);
  const geo = new LineSegmentsGeometry();
  const mat = new LineMaterial({ vertexColors: true, linewidth: 1.4, transparent: true, opacity: 0.55, depthTest: false });
  mat.resolution.set(window.innerWidth, window.innerHeight);
  sceneApi.clipMats.push(mat); // las lineas tambien se recortan con el plano de corte
  const lines = new LineSegments2(geo, mat);
  lines.renderOrder = 7;
  lines.frustumCulled = false;
  mid.group.add(lines);

  const zFace = D.cryoZ1; // cara de los criostatos (local)
  function rebuild(reach) {
    const pos = [];
    const col = [];
    const r = COIL_P / 2;
    const c = new THREE.Color();
    for (const { xa, side, y } of arcs) {
      const xm = xa + r;
      const pts = [[xa, y, side * zFace]];
      for (let i = 1; i < ARC; i++) {
        const f = (Math.PI * i) / ARC;
        pts.push([xm - r * Math.cos(f), y, side * (zFace + reach * Math.sin(f))]);
      }
      pts.push([xa + COIL_P, y, side * zFace]);
      for (let i = 0; i < pts.length - 1; i++) {
        pos.push(...pts[i], ...pts[i + 1]);
        c.copy(N_COL).lerp(S_COL, i / (pts.length - 1));
        const a = c.clone();
        c.copy(N_COL).lerp(S_COL, (i + 1) / (pts.length - 1));
        col.push(a.r, a.g, a.b, c.r, c.g, c.b);
      }
    }
    geo.setPositions(pos);
    geo.setColors(col);
  }
  let lastReach = -1;

  const arrowsApi = createForceArrows(mid.group, D.height);
  const t0 = performance.now();

  return {
    arrows: arrowsApi.group,
    forces: arrowsApi,
    lines,
    /** Intensidad relativa del campo: corriente inducida (0 a 1). */
    fieldLevel(train, tel) {
      return tel ? tel.induced : 0;
    },
    update(tel, train, view, camera, h) {
      const s = train.sections[Math.floor(train.sections.length / 2)];
      // el flujo llega hasta las bobinas de la pared: holgura lateral real, exagerada
      const reach = 0.28 * Math.min(1.4, 0.6 + tel.induced);
      if (Math.abs(reach - lastReach) > 0.01) {
        rebuild(reach);
        lastReach = reach;
      }
      // sin corriente inducida (parado o a pocos km/h) no hay campo que dibujar
      const show = view.layers.fields && view.magnetsVisible && tel.induced > 0.02;
      lines.visible = show;
      mat.opacity = (0.3 + 0.4 * Math.min(1, tel.induced + 0.15)) * (view.boost ? 1.2 : 1);
      mat.linewidth = view.intro ? 3.2 : 1.4;
      mat.resolution.set(window.innerWidth, window.innerHeight);

      const px = ((h / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * Math.min(window.devicePixelRatio || 1, 1.5);
      const t = REDUCED ? 0 : (performance.now() - t0) / 1000;
      const alpha = Math.min(0.8, 0.25 + 0.5 * Math.min(1, tel.induced + 0.1)) * (view.boost ? 1 : 0.8);
      fluxes.forEach((f) => {
        f.object.visible = show;
        if (show) f.update(t, reach, alpha, view.intro ? 0.07 : view.boost ? 0.08 : 0.055, px, view.intro ? 18 : 10);
      });

      const n = train.sections.length;
      const drag = s.drag + s.rollingResistance() + train.aero(train.v) / n;
      arrowsApi.update(s, train, drag, view.layers.forces && ARROW_RIGS.includes(view.rig));
    },
  };
}

/** Uniformes globales de las ondas del EDS (propulsion e induccion). */
export function updateEdsGlow(tel, train, view) {
  const L = train.length;
  const boost = view.boost ? 1.4 : 1;
  const p = sets.propulsion;
  p.uPitch.value = EDS.polePitch;
  p.uShift.value = (tel.loadAngleDeg / 180) * EDS.polePitch;
  const moving = train.v > 0.5;
  p.uAmp.value = view.layers.wave && moving ? Math.min(1.4, (0.3 + 0.9 * Math.abs(train.thrust) / Math.max(1, train.fMaxAt(0))) * boost) : 0;
  p.uRangeMin.value = -L / 2 - 20;
  p.uRangeMax.value = L / 2 + 20;
  p.uFade.value = 12;
  const q = sets.induced;
  q.uPitch.value = EDS.polePitch;
  q.uShift.value = 0;
  q.uAmp.value = view.layers.wave ? Math.min(1.4, tel.induced * boost) : 0;
  q.uRangeMin.value = -L / 2 - 4;
  q.uRangeMax.value = L / 2 + 4;
  q.uFade.value = 8;
}
