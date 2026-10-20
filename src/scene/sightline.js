// Linea de mira: decide si un arbol (aproximado por esferas a lo largo de su eje) tapa la vista
// de la camara hacia el tren. Es codigo puro, asi se prueba sin three.
//
// Un arbol que tapa el tren se oculta en ese fotograma: ninguna orientacion de la camara deja
// una copa delante de un coche. Se comprueban varios puntos del tren y varias alturas del arbol.

/** Distancia minima (m) entre el segmento a-b y el punto c. a, b, c: { x, y, z }. */
export function segmentPointDistance(a, b, c) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const l2 = dx * dx + dy * dy + dz * dz;
  let t = l2 > 0 ? ((c.x - a.x) * dx + (c.y - a.y) * dy + (c.z - a.z) * dz) / l2 : 0;
  t = Math.min(1, Math.max(0, t));
  return Math.hypot(a.x + dx * t - c.x, a.y + dy * t - c.y, a.z + dz * t - c.z);
}

/** Puntos del tren a los que se comprueba la vista: a lo largo de la composicion, a dos alturas. */
export function trainSightPoints(length, yLow = 5, yHigh = 10.5) {
  const pts = [];
  for (const f of [-0.6, -0.3, 0, 0.3, 0.6]) {
    for (const y of [yLow, yHigh]) pts.push({ x: f * length, y, z: 0 });
  }
  return pts;
}

/**
 * Esferas del eje de un arbol: de la base a la copa. `height` y `radius` en metros ya escalados.
 * Para la copa ancha (conifera, frondoso) el radio es el de la copa; para el alamo, el del fuste.
 */
export function treeSpheres(x, z, height, radius) {
  const out = [];
  for (const f of [0.3, 0.6, 0.9]) out.push({ x, y: height * f, z, r: radius });
  return out;
}

/** true si algun punto del tren queda tapado por alguna de las esferas del arbol. */
export function occludes(cam, spheres, points) {
  for (const s of spheres) {
    for (const p of points) {
      if (segmentPointDistance(cam, p, s) <= s.r) return true;
    }
  }
  return false;
}
