// Reparto del entorno: arboles y arbustos. Codigo puro (sin three), asi se puede probar.
//
// Todo es deterministico y sale de la coordenada de pista: la misma celda da siempre los mismos
// arboles. Las posiciones se devuelven en coordenadas de pista (x) y del mundo (z); el mundo las
// desplaza restando la coordenada del tren.

export const CELL = 60; // m de pista por celda
export const CORRIDOR = 30; // m libres a cada lado de la via
export const CAMERA_SIDE_GAP = 52; // del lado de la camara orbital (+z) no hay arboles hasta aqui (la camara queda a ~45 m)

/** Hash entero determinista a [0, 1). */
export function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) ^ 0x5bd1e995;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Semilla -> generador (el mismo que usan las texturas). */
export function rng(seed) {
  let x = seed;
  return () => ((x = (x * 16807) % 2147483647) / 2147483647);
}

/** Una posicion es valida para un arbol: fuera del corredor y de la franja de la camara. */
export function allowedTreeSpot(z) {
  if (!Number.isFinite(z)) return false;
  if (Math.abs(z) < CORRIDOR) return false;
  if (z > 0 && z < CAMERA_SIDE_GAP) return false;
  return true;
}

/** Especie segun un numero en [0, 1): conifera, frondoso o alamo. */
export const kindOf = (r4) => (r4 < 0.42 ? "c" : r4 < 0.88 ? "b" : "p");

/** Escala de un arbol: [horizontal, vertical]. */
export function treeScale(r2, r3) {
  const sc = 0.75 + r3 * 0.9;
  return [sc, sc * (0.85 + r2 * 0.3)];
}

/**
 * Arboles de una celda y un lado (-1 o 1). Cada uno:
 *   { x (pista), z, ang, sx, sy, kind, tone }   tone en [0, 1): reparte el tono dentro de la paleta
 * Entran los bosquetes (grupos de arboles) y los arboles sueltos de los linderos.
 */
export function treesForCell(cell, side) {
  const out = [];
  const push = (x, z, r1, r2, r3, r4) => {
    if (!allowedTreeSpot(z)) return;
    const [sx, sy] = treeScale(r2, r3);
    out.push({ x, z, ang: r1 * 6.28, sx, sy, kind: kindOf(r4), tone: r1 });
  };
  // bosquetes: de 0 a 2 por celda y lado (casi siempre al menos uno); el numero de arboles sale de un tamano
  const groves = hash(cell, side * 91) < 0.2 ? 0 : hash(cell, side * 17) < 0.5 ? 1 : 2;
  for (let g = 0; g < groves; g++) {
    const gx = cell * CELL + hash(cell, side * 31 + g) * CELL;
    const gz = side * (40 + hash(cell, side * 53 + g) * 210);
    const rad = 14 + hash(cell, side * 71 + g) * 30;
    const n = 12 + Math.floor(hash(cell, side * 13 + g) * 26);
    for (let k = 0; k < n; k++) {
      const a = hash(cell, side * 1000 + g * 100 + k) * 6.283;
      const d = Math.sqrt(hash(cell, side * 2000 + g * 100 + k)) * rad;
      push(gx + Math.cos(a) * d, gz + Math.sin(a) * d, hash(cell, k * 5 + 1 + g), hash(cell, k * 5 + 2 + g), hash(cell, k * 5 + 3 + g), hash(cell, k * 5 + 4 + g));
    }
  }
  // arboles sueltos y alamos en los linderos
  for (let k = 0; k < 4; k++) {
    const r1 = hash(cell, side * 300 + k), r2 = hash(cell, side * 400 + k), r3 = hash(cell, side * 500 + k), r4 = hash(cell, side * 600 + k);
    push(cell * CELL + r1 * CELL, side * (30 + Math.pow(r2, 0.8) * 200), r1, r2, r3, r4 < 0.7 ? r4 * 1.25 : 0.9 + (r4 - 0.7) * 0.33);
  }
  return out;
}

/** Arbustos junto a la cerca: reparto fijo que se repite cada `period` m. */
export function bushLayout(period = 600, count = 110, seed = 555) {
  const rnd = rng(seed);
  return Array.from({ length: count }, () => ({
    x: rnd() * period,
    z: (rnd() < 0.5 ? -1 : 1) * (11 + rnd() * 12),
    r: 0.42 + rnd() * 0.5,
    hue: Math.floor(rnd() * 4),
  }));
}

/** Los arboles (de ambos lados) de las celdas que cubren la ventana de +-halfCells alrededor de s. */
export function treesAround(s, halfCells = 22) {
  const base = Math.floor(s / CELL);
  const out = [];
  for (let i = -halfCells; i < halfCells; i++) {
    for (const side of [-1, 1]) for (const t of treesForCell(base + i, side)) out.push(t);
  }
  return out;
}
