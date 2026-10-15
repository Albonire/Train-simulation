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

// ---------------------------------------------------------------------------
// Maquina sincrona con carga: dinamica de angulo de carga (la base del LSM).
//
// La onda de campo avanza a v_onda = 2 * tau * f (su posicion es x_w). El
// vehiculo (un imán con polos de paso tau) se acopla a ella con una fuerza
//     F = F_max * sen(delta),  delta = pi * (x_w - x) / tau
// Es un "resorte" no lineal: en equilibrio sen(delta) = F_carga / F_max; con la
// carga justa el vehiculo queda retrasado un angulo delta respecto de la onda;
// al frenar (f decrece) delta se hace negativo y el motor regenera; si la carga
// supera F_max no hay equilibrio y el vehiculo "pierde el sincronismo".
// ---------------------------------------------------------------------------
export class SyncDrive {
  /**
   * @param polePitch  paso polar tau, m
   * @param forceMax   empuje maximo F_max, N
   * @param mass       masa del vehiculo, kg
   * @param damping    amortiguamiento de oscilaciones c/m, 1/s. Actua sobre la velocidad
   *                   RELATIVA a la onda (las corrientes parasitas del imán), asi que en
   *                   regimen sincrono no frena; la carga (rozamiento, arrastre) es aparte.
   */
  constructor({ polePitch = 0.258, forceMax = 2.05, mass = 1, damping = 2.5 } = {}) {
    this.tau = polePitch;
    this.Fmax = forceMax;
    this.m = mass;
    this.c = damping;
    this.reset();
  }

  reset(x = 0) {
    this.thetaW = (x * Math.PI) / this.tau; // fase de la onda: x_w = theta * tau / pi
    this.x = x;
    this.v = 0;
    this.delta = 0;
    this.force = 0;
  }

  /** Posicion de la onda, m. */
  get xWave() {
    return (this.thetaW * this.tau) / Math.PI;
  }
  /** Velocidad sincrona instantanea para la frecuencia f, m/s. */
  syncSpeed(f) {
    return 2 * this.tau * f;
  }

  /**
   * @param dt    paso, s (<= 2 ms recomendado)
   * @param freq  frecuencia del convertidor, Hz (negativa: la onda retrocede)
   * @param load  fuerza de carga que se opone al avance, N (positiva: frena hacia -x)
   */
  step(dt, freq, load = 0) {
    this.thetaW += 2 * Math.PI * freq * dt;
    const d = (Math.PI * (this.xWave - this.x)) / this.tau;
    this.delta = Math.atan2(Math.sin(d), Math.cos(d)); // envuelto a (-pi, pi]
    this.force = this.Fmax * Math.sin(d);
    const vWave = 2 * this.tau * freq;
    const a = (this.force - load) / this.m - this.c * (this.v - vWave);
    this.v += a * dt;
    this.x += this.v * dt;
  }

  /**
   * Campo de la onda en x, normalizado a [-1, 1]: B = sen(pi * (x_w - x) / tau).
   * Es la misma funcion que da el angulo de carga: con el vehiculo centrado en x_w
   * el campo bajo sus polos vale 0, y vale +-1 a media distancia.
   */
  waveAt(x) {
    return Math.sin((Math.PI * (this.xWave - x)) / this.tau);
  }
}
