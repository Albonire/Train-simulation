// Encuadre de una pieza: dado su caja en el mundo, devuelve donde poner la camara y a donde
// mirar. Es codigo puro (sin three) para poder probar todos los casos raros: cajas vacias,
// planas, invertidas, con NaN o enormes. Devuelve null si no hay un encuadre fiable, y quien
// llama conserva entonces la vista actual en vez de quedarse con una camara rota.

import { poseDirection } from "./partsData.js";

const fin = (v) => Number.isFinite(v);
const vec3 = (v) => v && fin(v.x) && fin(v.y) && fin(v.z);

export const FRAME_LIMITS = { minDist: 3.2, maxDist: 80, minY: 1.7, maxRadius: 60 };

/**
 * Caja de una pieza de la via (periodica): se recorta en x a +-span alrededor de su propio
 * centro, de modo que nunca queda invertida aunque la pieza este lejos del centro del tren.
 * Para piezas del coche (cerca de x = 0) el resultado es el mismo que recortar a +-span.
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
 * Devuelve { target: [x, y, z], position: [x, y, z], distance } o null.
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

/** Comprueba que una camara es utilizable: valores finitos y no demasiado lejos del origen. */
export function cameraIsSane(position, target, projection, maxFromOrigin = 1000) {
  const v = [position.x, position.y, position.z, target.x, target.y, target.z];
  if (!v.every(fin)) return false;
  if (projection && !projection.every(fin)) return false;
  return Math.hypot(position.x, position.y, position.z) <= maxFromOrigin && Math.hypot(target.x, target.y, target.z) <= maxFromOrigin;
}
