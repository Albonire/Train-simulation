// Reglas para que la escena no parpadee ni "corra" a cualquier velocidad.
//
// Dos fuentes de parpadeo, las dos medibles:
//  1) Profundidad: con un buffer de 24 bits, dos superficies a menos de `depthResolution`
//     metros una de otra se pelean (z-fighting). La resolucion crece con el cuadrado de
//     la distancia y baja con el plano cercano de la camara.
//  2) Tiempo: el suelo se desplaza a velocidad de tren por la escala de tiempo. Un detalle
//     de L metros que pasa a v m/s parpadea si v / L supera la mitad de la frecuencia de
//     refresco (aliasing temporal). La solucion es desenfocar lo que sea mas fino que
//     v / (2 * REFRESH) metros: equivale a la difuminacion por movimiento.

export const REFRESH_HZ = 60;

/** Resolucion de profundidad (m) a la distancia z con planos near/far y `bits` de buffer. */
export function depthResolution(near, far, z, bits = 24) {
  // proyeccion en perspectiva: dz = z^2 * (far - near) / (near * far * 2^bits)
  return (z * z * (far - near)) / (near * far * 2 ** bits);
}

/** Plano cercano segun a que distancia mira la camara: 0,1 m de cerca, hasta 2 m de lejos. */
export function adaptiveNear(distance) {
  return Math.min(2, Math.max(0.1, distance / 60));
}

/** Separacion minima (m) para que dos superficies paralelas no se peleen a la distancia z. */
export function minSafeOffset(near, far, z, margin = 4) {
  return margin * depthResolution(near, far, z);
}

/**
 * Sesgo de mipmap (en niveles) que desenfoca el detalle mas fino que v / (2 * REFRESH)
 * metros. `texelMeters` es el tamano de un texel de nivel 0 en el mundo.
 */
export function mipBiasFor(visualSpeed, texelMeters = 0.08) {
  const finest = visualSpeed / (2 * REFRESH_HZ); // m
  if (finest <= texelMeters) return 0;
  return Math.min(7, Math.log2(finest / texelMeters));
}

/** Factor 1 (todo el detalle) a 0 (liso) para las capas procedurales de hormigon. */
export function detailFactor(visualSpeed) {
  return 1 / (1 + (visualSpeed / 120) ** 2);
}

/** Uniformes compartidos por todos los materiales que se desplazan. */
export const DETAIL = {
  uBias: { value: 0 },
  uDetail: { value: 1 },
};

let smooth = 0;
/**
 * Actualiza los uniformes con la velocidad visual (|v| * escala de tiempo, m/s). Se filtra
 * con un tiempo de ~0,25 s para que el detalle no aparezca y desaparezca de golpe.
 */
export function setVisualSpeed(speed, dt = 1 / 60) {
  const k = 1 - Math.exp(-dt / 0.25);
  smooth += (speed - smooth) * k;
  DETAIL.uBias.value = mipBiasFor(smooth);
  DETAIL.uDetail.value = detailFactor(smooth);
  return smooth;
}
