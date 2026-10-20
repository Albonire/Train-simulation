// Huellas que el entorno deja libres: la de una estacion (anden, escalera y edificio de acceso)
// y la de una camara baja junto a la via. Codigo puro, para probarlo sin three.
//
// Las cajas son { x0, x1, z0, z1 }: la de una estacion, en coordenadas de pista (x) y del mundo (z);
// la de la camara, ya en el mundo. `toWorld` pasa las de pista al mundo. El anden va al
// lado -z; el edificio de acceso sale por detras, hacia -x.

export const STATION_REACH = { back: 82, front: 60 }; // m a cada lado del centro del anden
export const PLATFORM_WIDTH = 6; // ancho del anden, m (el mismo que stations.js)

/** Caja de una estacion cuyo centro esta en la coordenada de pista xTrack. */
export function stationFootprint(xTrack, zIn) {
  return { x0: xTrack - STATION_REACH.back, x1: xTrack + STATION_REACH.front, z0: -(zIn + PLATFORM_WIDTH + 24), z1: 0.5 };
}

/**
 * Caja alrededor de una camara baja y pegada a la via, en coordenadas del mundo; null si no estorba.
 * Solo cuenta lo que pasaria a un lado del objetivo: las camaras altas (Seguir, Orbita) ven los postes
 * pasar sin taparles nada, y ocultarlos a trozos los haria parpadear a la velocidad del decorado.
 */
export function cameraFootprint(cam, { height = 8, side = 16, half = 6 } = {}) {
  if (!cam || cam.y >= height || Math.abs(cam.z) >= side) return null;
  return { x0: cam.x - half, x1: cam.x + half, z0: cam.z - half, z1: cam.z + half };
}

/**
 * Una loseta de utileria con su origen en x (mundo) se oculta solo si algo de lo que contiene cae en
 * una caja: `spans` son los tramos de x (relativos a la loseta) que tienen geometria y `zs` los de z.
 * Asi un poste de 0,6 m de ancho no oculta los 96 m de loseta que lo rodean.
 */
export function tileBlocked(x, spans, zs, boxes) {
  for (const b of boxes) {
    let inZ = false;
    for (const [z0, z1] of zs) if (z1 >= b.z0 && z0 <= b.z1) inZ = true;
    if (!inZ) continue;
    for (const [a0, a1] of spans) if (x + a1 >= b.x0 && x + a0 <= b.x1) return true;
  }
  return false;
}

/** Pasa una caja de coordenadas de pista a coordenadas del mundo (el tren esta en la pista `s`). */
export function toWorld(box, s) {
  return { x0: box.x0 - s, x1: box.x1 - s, z0: box.z0, z1: box.z1 };
}

export function inAnyBox(x, z, boxes) {
  for (const b of boxes) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return true;
  return false;
}
