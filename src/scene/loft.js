// Carrocerias por "loft": una seccion transversal (poligono cerrado en el plano
// z-y) que se repite a lo largo de x, con una nariz que se cierra suavemente.

import * as THREE from "three";

/** Superelipse (exponente n) como lista de puntos [z, y], sentido antihorario. */
export function superellipse(halfW, height, n = 3, steps = 48, y0 = 0) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const z = halfW * Math.sign(c) * Math.abs(c) ** (2 / n);
    const y = (height / 2) * Math.sign(s) * Math.abs(s) ** (2 / n) + height / 2 + y0;
    pts.push([z, y]);
  }
  return pts;
}

/**
 * stations: [{ x, sy, sz, dy }]  escala vertical/lateral y desplazamiento en y
 * de la seccion en cada estacion. Devuelve BufferGeometry con normales suaves.
 */
export function loft(points, stations, { close = true } = {}) {
  const n = points.length;
  const pos = [];
  const idx = [];
  for (const st of stations) {
    for (const [z, y] of points) {
      pos.push(st.x, y * st.sy + (st.dy ?? 0), z * st.sz);
    }
  }
  for (let i = 0; i < stations.length - 1; i++) {
    for (let j = 0; j < n; j++) {
      const a = i * n + j;
      const b = i * n + ((j + 1) % n);
      const c = (i + 1) * n + j;
      const d = (i + 1) * n + ((j + 1) % n);
      idx.push(a, c, b, b, c, d);
    }
  }
  if (close) {
    // tapas: abanico hacia el centro de cada extremo
    const cap = (i, flip) => {
      let cy = 0;
      let cz = 0;
      for (let j = 0; j < n; j++) {
        cy += pos[(i * n + j) * 3 + 1];
        cz += pos[(i * n + j) * 3 + 2];
      }
      const ci = pos.length / 3;
      pos.push(stations[i].x, cy / n, cz / n);
      for (let j = 0; j < n; j++) {
        const a = i * n + j;
        const b = i * n + ((j + 1) % n);
        if (flip) idx.push(ci, a, b);
        else idx.push(ci, b, a);
      }
    };
    cap(0, true);
    cap(stations.length - 1, false);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Estaciones de una seccion: tramo recto de longitud `len` centrado en 0 y,
 * opcionalmente, una nariz elipsoidal de longitud `noseLen` hacia +x o -x.
 */
export function bodyStations(len, { noseFront = 0, noseRear = 0, noseDrop = 0.25 } = {}) {
  const st = [];
  const ring = 14;
  if (noseRear > 0) {
    for (let i = 0; i <= ring; i++) {
      const t = i / ring; // 0 punta .. 1 cuerpo
      const k = Math.sqrt(Math.max(0, 1 - (1 - t) ** 2.2));
      st.push({ x: -len / 2 - noseRear * (1 - t), sy: Math.max(0.02, k), sz: Math.max(0.02, k), dy: (1 - k) * noseDrop });
    }
  } else {
    st.push({ x: -len / 2, sy: 1, sz: 1, dy: 0 });
  }
  st.push({ x: len / 2, sy: 1, sz: 1, dy: 0 });
  if (noseFront > 0) {
    for (let i = 1; i <= ring; i++) {
      const t = i / ring;
      const k = Math.sqrt(Math.max(0, 1 - t ** 2.2));
      st.push({ x: len / 2 + noseFront * t, sy: Math.max(0.02, k), sz: Math.max(0.02, k), dy: (1 - k) * noseDrop });
    }
  }
  return st;
}
