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
/** Fraccion de perimetro acumulado de cada punto del contorno cerrado (n + 1 valores). */
export function perimeterV(points) {
  const n = points.length;
  const acc = [0];
  for (let j = 0; j < n; j++) {
    const [z0, y0] = points[j];
    const [z1, y1] = points[(j + 1) % n];
    acc.push(acc[j] + Math.hypot(z1 - z0, y1 - y0));
  }
  const total = acc[n];
  return acc.map((a) => a / total);
}

/** Longitud (m) del contorno cerrado: escala de v. */
export function perimeterLength(points) {
  let t = 0;
  for (let j = 0; j < points.length; j++) {
    const [z0, y0] = points[j];
    const [z1, y1] = points[(j + 1) % points.length];
    t += Math.hypot(z1 - z0, y1 - y0);
  }
  return t;
}

/**
 * v (0..1) del contorno a la altura `y` en el costado `side` (+1: z > 0, -1: z < 0).
 * Toma el primer cruce del lado pedido; los contornos de carroceria tienen uno por costado
 * en la zona de ventanas.
 */
export function vAt(points, side, y) {
  const vs = perimeterV(points);
  const n = points.length;
  for (let j = 0; j < n; j++) {
    const [z0, y0] = points[j];
    const [z1, y1] = points[(j + 1) % n];
    if (Math.sign(z0 + z1) !== Math.sign(side)) continue;
    if ((y0 - y) * (y1 - y) > 0 || y0 === y1) continue;
    const t = (y - y0) / (y1 - y0);
    return vs[j] + t * (vs[j + 1] - vs[j]);
  }
  return null;
}

/** Subdivide los tramos largos del contorno (misma polilinea, mismo v). */
function densify(points, maxSeg) {
  const out = [];
  const n = points.length;
  for (let j = 0; j < n; j++) {
    const [z0, y0] = points[j];
    const [z1, y1] = points[(j + 1) % n];
    const k = Math.max(1, Math.ceil(Math.hypot(z1 - z0, y1 - y0) / maxSeg));
    for (let i = 0; i < k; i++) out.push([z0 + ((z1 - z0) * i) / k, y0 + ((y1 - y0) * i) / k]);
  }
  return out;
}

/**
 * Con `skirtBelow` (una y del contorno), los costados cuyo punto medio queda por debajo de esa altura van en
 * un segundo grupo de indices (materialIndex 1): asi el faldon puede llevar otro material, translucido,
 * sin tocar el resto de la carroceria. Las tapas de los extremos van siempre en el grupo 0.
 */
export function loft(rawPoints, stations, { close = true, maxSeg = 0.25, skirtBelow = null } = {}) {
  // Los costados planos se subdividen: en la nariz cada estacion escala el contorno
  // y un triangulo grande deformaria la textura (franja dentada).
  const points = densify(rawPoints, maxSeg);
  // n + 1 vertices por anillo: el ultimo repite el primero para que la textura
  // no se envuelva (costura en el centro inferior, que no se ve).
  const n = points.length;
  const m = n + 1;
  const vs = perimeterV(points);
  const x0 = stations[0].x;
  const x1 = stations[stations.length - 1].x;
  const pos = [];
  const uv = [];
  const idx = []; // grupo 0
  const idxSkirt = []; // grupo 1
  const isSkirt = points.map((p, j) => skirtBelow !== null && (p[1] + points[(j + 1) % n][1]) / 2 < skirtBelow);
  for (const st of stations) {
    const u = (st.x - x0) / (x1 - x0);
    for (let j = 0; j <= n; j++) {
      const [z, y] = points[j % n];
      pos.push(st.x, y * st.sy + (st.dy ?? 0), z * st.sz);
      uv.push(u, vs[j]);
    }
  }
  for (let i = 0; i < stations.length - 1; i++) {
    for (let j = 0; j < n; j++) {
      const a = i * m + j;
      const b = i * m + j + 1;
      const c = (i + 1) * m + j;
      const d = (i + 1) * m + j + 1;
      (isSkirt[j] ? idxSkirt : idx).push(a, c, b, b, c, d);
    }
  }
  if (close) {
    // tapas: abanico hacia el centro de cada extremo
    const cap = (i, flip) => {
      let cy = 0;
      let cz = 0;
      for (let j = 0; j < n; j++) {
        cy += pos[(i * m + j) * 3 + 1];
        cz += pos[(i * m + j) * 3 + 2];
      }
      const ci = pos.length / 3;
      pos.push(stations[i].x, cy / n, cz / n);
      uv.push(i === 0 ? 0 : 1, 0.5);
      for (let j = 0; j < n; j++) {
        const a = i * m + j;
        const b = i * m + j + 1;
        if (flip) idx.push(ci, a, b);
        else idx.push(ci, b, a);
      }
    };
    cap(0, true);
    cap(stations.length - 1, false);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(skirtBelow === null ? idx : [...idx, ...idxSkirt]);
  if (skirtBelow !== null) {
    g.addGroup(0, idx.length, 0);
    g.addGroup(idx.length, idxSkirt.length, 1);
  }
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
