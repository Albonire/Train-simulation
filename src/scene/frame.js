// encuadre de una pieza: dado su caja en el mundo, devuelve donde poner la camara y a donde
// mirar. es codigo puro (sin three) para poder probar todos los casos raros: cajas vacias,
// planas, invertidas, con nan o enormes. devuelve null si no hay un encuadre fiable, y quien
// llama conserva entonces la vista actual en vez de quedarse con una camara rota.

import { poseDirection } from "./partsData.js";

const fin = (v) => Number.isFinite(v);
const vec3 = (v) => v && fin(v.x) && fin(v.y) && fin(v.z);

export const FRAME_LIMITS = { minDist: 3.2, maxDist: 80, minY: 1.7, maxRadius: 60 };

/**
 * caja de una pieza de la via (periodica): se recorta en x a +-span alrededor de su propio
 * centro, de modo que nunca queda invertida aunque la pieza este lejos del centro del tren.
 * para piezas del tren (cerca de x = 0) el resultado es el mismo que recortar a +-span.
 */
export function windowBox(box, span, center = 0) {
  if (!box || !vec3(box.min) || !vec3(box.max) || !fin(span) || span <= 0) return null;
  if (box.min.x > box.max.x || box.min.y > box.max.y || box.min.z > box.max.z) return null;
  const cx = (box.min.x + box.max.x) / 2;
  // si la caja cruza el centro, se recorta alrededor de este; si no, alrededor de su centro
  const inside = box.min.x <= center + span && box.max.x >= center - span;
  const mid = inside ? Math.min(Math.max(center, box.min.x), box.max.x) : cx;
  const lo = Math.max(box.min.x, mid - span);
  const hi = Math.min(box.max.x, mid + span);
  return { min: { x: lo, y: box.min.y, z: box.min.z }, max: { x: hi, y: box.max.y, z: box.max.z } };
}

/**
 * box: { min, max } en el mundo. def: { pose: { az, el, fit } }.
 * devuelve { target: [x, y, z], position: [x, y, z], distance } o null.
 */
export function framePart(box, def, { aspect = 1.6, fov = 44, limits = FRAME_LIMITS } = {}) {
  if (!box || !vec3(box.min) || !vec3(box.max) || !def?.pose || !fin(aspect) || !fin(fov) || fov <= 1 || fov >= 120) return null;
  const sx = box.max.x - box.min.x;
  const sy = box.max.y - box.min.y;
  const sz = box.max.z - box.min.z;
  if (![sx, sy, sz].every(fin) || sx < 0 || sy < 0 || sz < 0) return null;
  const target = [(box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, (box.min.z + box.max.z) / 2];
  const radius = Math.min(limits.maxRadius, Math.max(0.5 * Math.hypot(sx, sy, sz), 0.8));
  // en pantalla vertical el campo horizontal es corto: se aleja un poco mas
  const wide = aspect < 0.9 ? 1.6 : 1;
  const fit = fin(def.pose.fit) ? def.pose.fit : 1.2;
  let distance = (radius / Math.tan((fov * Math.PI) / 360)) * fit * wide;
  distance = Math.min(limits.maxDist, Math.max(limits.minDist, distance));
  const d = poseDirection(def.pose);
  if (!d.every(fin)) return null;
  const position = target.map((t, i) => t + d[i] * distance);
  // la camara no baja del nivel de los ojos: se eleva y el objetivo se mantiene
  if (position[1] < limits.minY) position[1] = limits.minY;
  if (![...target, ...position].every(fin)) return null;
  return { target, position, distance };
}

/** comprueba que una camara es utilizable: valores finitos y no demasiado lejos del origen. */
export function cameraIsSane(position, target, projection, maxFromOrigin = 1000) {
  const v = [position.x, position.y, position.z, target.x, target.y, target.z];
  if (!v.every(fin)) return false;
  if (projection && !projection.every(fin)) return false;
  return Math.hypot(position.x, position.y, position.z) <= maxFromOrigin && Math.hypot(target.x, target.y, target.z) <= maxFromOrigin;
}

/**
 * encuadre de la camara orbital: distancia y desplazamiento del objetivo para que una caja (el
 * tren) llene `fill` del area libre de la pantalla, centrada en ella. la camara mira a `target`
 * desde la direccion `dir` (hacia la camara, unitaria); `fov` es el vertical en grados y `aspect`
 * el de la ventana. `free`: { fx, fy } = fraccion del ancho y del alto de la ventana que dejan
 * libre los paneles; el objetivo se muestra en el centro de esa area (lo hace `setviewoffset`).
 *
 * como el extremo cercano del tren se ve mas grande que el lejano, centrar el objetivo en el tren
 * deja un lado casi vacio. por eso se desplaza el objetivo (a lo largo de la derecha y la vertical
 * de la camara) hasta que el tren queda centrado, y se busca por biseccion la distancia a la que su
 * extension proyectada ocupa `fill`. devuelve { distance, shift: [x, y, z] } o null.
 */
export function fitDistance({ target, dir, fov, aspect, free, box, fill = 0.88, min = 6, max = 420 }) {
  const ok = [...target, ...dir, fov, aspect, free?.fx, free?.fy, fill].every(fin) && box && [...box.min, ...box.max].every(fin);
  if (!ok || fov <= 1 || fov >= 120 || aspect <= 0 || free.fx <= 0 || free.fy <= 0) return null;
  const len = Math.hypot(...dir);
  if (len < 1e-6) return null;
  const d0 = dir.map((v) => v / len);
  // base de la camara: f hacia el objetivo, r a la derecha, u arriba
  const f = d0.map((v) => -v);
  let R = [-f[2], 0, f[0]];
  const rl = Math.hypot(...R);
  if (rl < 1e-6) R = [1, 0, 0];
  else R = R.map((v) => v / rl);
  const U = [R[1] * f[2] - R[2] * f[1], R[2] * f[0] - R[0] * f[2], R[0] * f[1] - R[1] * f[0]];
  const th = Math.tan((fov * Math.PI) / 360);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const corners = [];
  for (const x of [box.min[0], box.max[0]]) for (const y of [box.min[1], box.max[1]]) for (const z of [box.min[2], box.max[2]]) corners.push([x - target[0], y - target[1], z - target[2]]);
  const lat = corners.map((c) => dot(c, R));
  const ver = corners.map((c) => dot(c, U));
  const dep = corners.map((c) => dot(c, f));
  // a la distancia d: extension proyectada (mitad de la anchura y del alto, en ndc) con el tren
  // centrado, y el desplazamiento del objetivo que lo centra
  const at = (d) => {
    const depth = dep.map((z) => d + z);
    if (depth.some((z) => z < 0.5)) return null;
    const k = depth.map((z) => 1 / (z * th));
    let dx = 0;
    let dy = 0;
    let hx = 0;
    let hy = 0;
    for (let it = 0; it < 4; it++) {
      const xs = lat.map((v, i) => ((v - dx) * k[i]) / aspect);
      const ys = ver.map((v, i) => (v - dy) * k[i]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      hx = (x1 - x0) / 2;
      hy = (y1 - y0) / 2;
      // pasar el centro de la extension al centro de la pantalla: en ndc cx equivale a cx / k metros
      const mk = k.reduce((a, v) => a + v, 0) / k.length;
      dx += ((x0 + x1) / 2) * aspect / mk;
      dy += ((y0 + y1) / 2) / mk;
    }
    return { w: Math.max(hx / (fill * free.fx), hy / (fill * free.fy)), dx, dy };
  };
  const done = (d) => {
    const r = at(d);
    return { distance: d, shift: [0, 1, 2].map((i) => R[i] * r.dx + U[i] * r.dy) };
  };
  const top = at(max);
  if (!top || top.w > 1) return done(max); // no cabe ni a la maxima distancia
  let lo = min;
  let hi = max;
  const near = at(lo);
  if (near && near.w <= 1) return done(lo);
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    const r = at(mid);
    if (!r || r.w > 1) lo = mid;
    else hi = mid;
  }
  return done(hi);
}
