// Huellas que el entorno deja libres: la de una estacion (anden, escalera y edificio de acceso)
// y la de una camara baja junto a la via. Codigo puro, para probarlo sin three.
//
// Las cajas son { x0, x1, z0, z1 } en coordenadas de pista (x) y del mundo (z). El anden va al
// lado -z; el edificio de acceso sale por detras, hacia -x.

export const STATION_REACH = { back: 82, front: 60 }; // m a cada lado del centro del anden
export const PLATFORM_WIDTH = 6; // ancho del anden, m (el mismo que stations.js)

/** Caja de una estacion cuyo centro esta en la coordenada de pista xTrack. */
export function stationFootprint(xTrack, zIn) {
  return { x0: xTrack - STATION_REACH.back, x1: xTrack + STATION_REACH.front, z0: -(zIn + PLATFORM_WIDTH + 24), z1: 0.5 };
}

/** Caja alrededor de una camara baja y cercana a la via; null si no estorba a nada. */
export function cameraFootprint(cam, s, { height = 14, side = 28, half = 9 } = {}) {
  if (!cam || cam.y >= height || Math.abs(cam.z) >= side) return null;
  return { x0: cam.x + s - half, x1: cam.x + s + half, z0: cam.z - half, z1: cam.z + half };
}

export function inAnyBox(x, z, boxes) {
  for (const b of boxes) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return true;
  return false;
}
