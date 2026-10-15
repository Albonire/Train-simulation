// Motor lineal sincrono (LSM). El devanado trifasico va en la via; el campo de
// excitacion lo dan los imanes del vehiculo. La corriente trifasica crea una
// onda viajera de campo que arrastra al vehiculo SIN deslizamiento:
//     v = 2 * tau * f           (tau = paso polar, f = frecuencia del convertidor)
// El empuje depende del angulo de carga delta entre la onda y el campo del
// vehiculo: F = F_max * sin(delta). Frenar es invertir el signo de delta, y el
// motor devuelve energia a la red (regeneracion).

import { LSM_EFFICIENCY } from "./constants.js";

/** Frecuencia del convertidor para una velocidad dada, Hz. */
export const frequencyFor = (v, polePitch) => v / (2 * polePitch);
/** Velocidad sincrona para una frecuencia dada, m/s. */
export const speedFor = (f, polePitch) => 2 * polePitch * f;

/**
 * Empuje maximo disponible a velocidad v: constante hasta la velocidad base y
 * limitado por potencia (P = F*v) por encima.
 */
export function maxThrust(v, forceMax, powerMax) {
  if (v < 1) return forceMax;
  return Math.min(forceMax, powerMax / v);
}

/** Angulo de carga (rad) necesario para un empuje F dado el maximo disponible. */
export function loadAngle(F, Fmax) {
  if (Fmax <= 0) return 0;
  return Math.asin(Math.max(-1, Math.min(1, F / Fmax)));
}

/**
 * Potencia electrica en la red (W). Positiva al traccionar, negativa al regenerar.
 */
export function gridPower(F, v) {
  const mech = F * v;
  return mech >= 0 ? mech / LSM_EFFICIENCY : mech * LSM_EFFICIENCY;
}

/** Fase electrica instantanea de las tres fases (rad), a 0, -120 y +120 grados. */
export function phaseCurrents(theta, amplitude) {
  const TWO_PI_3 = (2 * Math.PI) / 3;
  return [
    amplitude * Math.sin(theta),
    amplitude * Math.sin(theta - TWO_PI_3),
    amplitude * Math.sin(theta + TWO_PI_3),
  ];
}
