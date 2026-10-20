// Capa de campos del modo EMS: lazos de flujo con particulas que recorren el circuito
// magnetico (estator, entrehierro, iman), onda del estator y flechas de fuerza.

import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { sets } from "./glow.js";
import { DIM } from "./ems.js";
import { createForceArrows } from "./forceArrows.js";
import { createEmsFlux } from "./flux.js";
import { EMS } from "../physics/constants.js";

const ARROW_RIGS = ["orbit", "chase", "top"];
const TAU = EMS.polePitch;
const N_COL = new THREE.Color("#ff4d3d");
const S_COL = new THREE.Color("#2f8cff");
const IRON = new THREE.Color("#ffe3a8");
// banda de aire: cian en el hueco nominal, ambar fuera de el, rojo si el vehiculo cayo o se pego en marcha
const AIR = { ok: new THREE.Color("#35d0ff"), off: new THREE.Color("#ffb02e"), bad: new THREE.Color("#ff4d3d") };

export function createEmsFields(sceneApi) {
  const mid = sceneApi.sections[Math.floor(sceneApi.sections.length / 2)];
  const midBaseX = mid.baseX;
  const zc = (DIM.statorZ0 + DIM.statorZ1) / 2;

  // lazos de una seccion (marco local: x respecto de la seccion, y = 0 en la cara polar)
  const loopsOf = (sec) => {
    const out = [];
    for (const side of [-1, 1]) {
      for (const m of sec.modules) {
        for (let p = 0; p < 6; p++) {
          const xa = m.x0 - sec.baseX + (2 * p + 0.5) * TAU;
          for (const dz of [-0.14, 0.14]) out.push({ xa, z: side * zc + dz });
        }
      }
    }
    return out;
  };

  // particulas en las tres secciones (se mueven con el entrehierro de cada una)
  const fluxes = sceneApi.sections.map((sec) => {
    const f = createEmsFlux(loopsOf(sec), TAU);
    sec.levGroup.add(f.object);
    return f;
  });

  // lazos finos y continuos en la seccion central: dan la forma, las particulas el sentido
  const loops = loopsOf(mid).filter((_, i) => i % 2 === 0);
  const ARC = 10;
  let lastGv = -1;
  const geo = new LineSegmentsGeometry();
  const mat = new LineMaterial({ vertexColors: true, linewidth: 1.4, transparent: true, opacity: 0.55, depthTest: false });
  mat.resolution.set(window.innerWidth, window.innerHeight);
  sceneApi.clipMats.push(mat); // las lineas tambien se recortan con el plano de corte
  const lines = new LineSegments2(geo, mat);
  lines.renderOrder = 7;
  lines.frustumCulled = false;
  mid.levGroup.add(lines);

  function rebuild(gv) {
    const pos = [];
    const col = [];
    const seg = (a, ca, b, cb) => {
      pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b);
    };
    const c = new THREE.Color();
    for (const { xa, z } of loops) {
      const xb = xa + TAU;
      const xm = (xa + xb) / 2;
      const r = TAU / 2;
      // [punto, color]: sube por el polo N (rojo), cruza el hierro (calido), baja por el S (azul)
      const path = [[[xa, 0, z], N_COL], [[xa, gv, z], N_COL]];
      for (let i = 1; i <= ARC; i++) {
        const f = (Math.PI * i) / ARC;
        const u = i / ARC;
        c.copy(N_COL).lerp(IRON, Math.min(1, u / 0.3)).lerp(S_COL, Math.max(0, (u - 0.7) / 0.3));
        path.push([[xm - r * Math.cos(f), gv + 0.75 * r * Math.sin(f), z], c.clone()]);
      }
      path.push([[xb, 0, z], S_COL]);
      for (let i = 1; i <= ARC; i++) {
        const f = (Math.PI * i) / ARC;
        path.push([[xm + r * Math.cos(f), -0.75 * r * Math.sin(f), z], S_COL.clone().lerp(IRON, 0.35)]);
      }
      for (let i = 0; i < path.length - 1; i++) seg(path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]);
    }
    geo.setPositions(pos);
    geo.setColors(col);
  }

  const arrowsApi = createForceArrows(mid.group, DIM.roof);
  const t0 = performance.now();
  const airState = sceneApi.sections.map(() => "");

  return {
    arrows: arrowsApi.group,
    forces: arrowsApi,
    lines,
    /** Intensidad relativa del campo (1 = nominal): I/I0 por g0/g. */
    fieldLevel(train) {
      const s = train.sections[Math.floor(train.sections.length / 2)];
      return (s.I / s.I0) * (s.gap0 / s.gap);
    },
    update(tel, train, view, camera, h) {
      const s = train.sections[Math.floor(train.sections.length / 2)];
      const gv = s.gap * view.exag;
      if (Math.abs(gv - lastGv) > 0.002) {
        rebuild(gv);
        lastGv = gv;
      }
      const B = Math.min(2.2, (s.I / s.I0) * (s.gap0 / s.gap));
      // sin corriente en el imán (parado sobre los patines o sin energía) no hay campo que dibujar
      const show = view.layers.fields && view.magnetsVisible && !train.sections[0].fallen && train.sections[0].I > 0.5;
      lines.visible = show;
      mat.opacity = Math.min(0.9, 0.25 + 0.4 * B) * (view.boost ? 1.2 : 1);
      mat.linewidth = view.intro ? 3.2 : 1.4;
      mat.resolution.set(window.innerWidth, window.innerHeight);

      // particulas: en la vista Campo mas grandes y brillantes
      // los puntos se miden en pixeles del buffer, no en pixeles CSS
      const px = ((h / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * Math.min(window.devicePixelRatio || 1, 1.5);
      const t = (performance.now() - t0) / 1000;
      train.sections.forEach((sec, i) => {
        const f = fluxes[i];
        f.object.visible = show;
        if (!show) return;
        const gap = sec.gap * view.exag;
        f.update(t, gap, Math.min(0.85, 0.2 + 0.3 * B) * (view.boost ? 1 : 0.8), view.intro ? 0.09 : view.boost ? 0.075 : 0.05, px, view.intro ? 20 : 10);
      });

      // la banda de aire se ve cuando se ven los imanes, salvo con las piezas separadas o elegidas
      const airOn = view.magnetsVisible && !view.explode && !view.parts;
      train.sections.forEach((sec, i) => {
        const o = sceneApi.sections[i];
        o.air.visible = airOn;
        if (!airOn) return;
        const down = sec.fallen || sec.contact;
        const st = down && train.v > 2 ? "bad" : down || Math.abs(sec.gap - sec.gap0) > 1e-3 ? "off" : "ok";
        if (airState[i] !== st) {
          airState[i] = st;
          o.airM.color.copy(AIR[st]);
          o.airM.opacity = st === "ok" ? 0.34 : 0.5;
        }
      });

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
  shared.uAmp.value = view.layers.wave ? Math.min(1.4, amp * (view.boost ? 1.4 : 1)) : 0;
  shared.uRangeMin.value = -L / 2 - 28;
  shared.uRangeMax.value = L / 2 + 28;
  shared.uFade.value = 18;
}
