// suspension electromagnetica (ems, estilo transrapid): sustentacion y guiado.
//
// el electroiman de sustentacion esta debajo del paquete de estator y atrae el
// vehiculo hacia arriba. con n espiras, area de polo a y entrehierro g, la
// fuerza de un iman en u (dos polos) es
//     f = mu0 * n^2 * i^2 * a / (4 g^2)  =  k * (i / g)^2
// donde k agrupa mu0*n^2*a/4 de todos los imanes de la seccion. como f crece
// al disminuir g, el equilibrio es inestable: sin control, el vehiculo se pega
// al riel o cae. el lazo cerrado (sensor de entrehierro + pid sobre la corriente)
// es lo que lo estabiliza.

import { EMS, G } from "./constants.js";

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// prng determinista (mulberry32) para el ruido del sensor
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** fuerza de atraccion de un electroiman (lumped), n. */
export const magnetForce = (K, current, gap) => K * (current / gap) ** 2;

/**
 * ganancias del pid de entrehierro a partir de la planta linealizada.
 * alrededor del equilibrio: m*x'' = (2w/g0) x - (2w/i0) u, con u = kp x + kd x' + ...
 * => w^2 = (2w/i0) kp/m - 2w/(m g0),  2 zeta w = (2w/i0) kd/m
 */
export function designGapGains({ mass, gap0, I0, omega, zeta, ki }) {
  const a = (2 * G) / I0; // = 2w/(m i0)
  const kp = (omega * omega + (2 * G) / gap0) / a;
  const kd = (2 * zeta * omega) / a;
  return { kp, kd, ki: ki ?? 0.3 * kp };
}

export class EmsSection {
  constructor(opts = {}) {
    this.mass = opts.mass ?? EMS.sectionMass;
    this.gap0 = opts.gap0 ?? EMS.gapNominal;
    this.I0 = opts.I0 ?? EMS.currentEq;
    this.Imax = this.I0 * EMS.currentMaxRatio;
    this.lag = opts.lag ?? EMS.currentLag;
    this.noise = opts.noise ?? 0.00002; // m, ruido del sensor
    this._rand = rng(opts.seed ?? 1);

    // k se fija para que a gap0 con i0 la fuerza iguale el peso en vacio
    this.K = (this.mass * G * this.gap0 ** 2) / this.I0 ** 2;

    const vg = designGapGains({
      mass: this.mass, gap0: this.gap0, I0: this.I0, omega: 62, zeta: 0.85,
    });
    this.vk = vg;

    // guiado lateral: pares diferenciales con polarizacion
    this.Ib = EMS.guideCurrentBias;
    const Fb = EMS.guideBiasFraction * this.mass * G; // fuerza de polarizacion por lado
    this.Kg = (Fb * this.gap0 ** 2) / this.Ib ** 2;
    // linealizado: m y'' = (4fb/h0) y + (4fb/ib) u  con u = -(kp y + kd y')
    const wl = 36;
    const zl = 0.85;
    const gain = (4 * Fb) / this.Ib;
    this.lk = {
      kp: (wl * wl * this.mass + (4 * Fb) / this.gap0) / gain,
      kd: (2 * zl * wl * this.mass) / gain,
    };

    // [ilustrativo] velocidad de la rampa de referencia de entrehierro en el despegue
    this.refRate = 0.003; // m/s
    this.reset(opts.resting ?? false);
  }

  reset(resting = false) {
    // en reposo el vehiculo descansa en los patines inferiores (entrehierro
    // grande, [ilustrativo] 2x nominal) con el control apagado
    this.gap = resting ? this.gap0 * 2 : this.gap0;
    this.gapVel = 0;
    this.I = resting ? 0 : this.I0;
    this.gapRef = this.gap0;
    this.integ = 0;
    this.control = !resting;
    this.openLoop = false; // control apagado pero corriente fija en i0 (demostracion)
    this.forcedOff = false; // el usuario apago el control de esta seccion: el tren no lo vuelve a encender
    this.powered = true; // false mientras dura un corte de alimentacion: no circula corriente por ningun iman
    this.contact = false; // toca el patin superior (pegado al riel)
    this.fallen = false; // cayo al patin inferior

    this.y = 0; // desplazamiento lateral, m (positivo hacia el lado derecho)
    this.vy = 0;
    this.IR = this.Ib;
    this.IL = this.Ib;

    this.extraMass = 0; // carga anadida, kg
    this.gust = 0; // fuerza lateral externa, n
    this.gustLeft = 0;
    this.lift = this.mass * G;
    this.lateralForce = 0;
    this.lastSensed = this.gap0;
  }

  /** activa el control y sube el vehiculo con una rampa de referencia. */
  engage() {
    if (this.control) return;
    this.control = true;
    this.gapRef = Math.max(this.gap, this.gap0);
    this.integ = 0;
  }
  /** apaga el control: el vehiculo cae a los patines. */
  release() {
    this.control = false;
  }

  addLoad(fraction = EMS.loadStepFraction) {
    this.extraMass = this.mass * fraction;
  }
  clearLoad() {
    this.extraMass = 0;
  }
  addGust(newtons, seconds = 0.6) {
    this.gust = newtons;
    this.gustLeft = seconds;
  }
  kick(dGap) {
    this.gap += dGap;
  }

  step(dt, _speed = 0) {
    const m = this.mass + this.extraMass;
    const a = 1 - Math.exp(-dt / this.lag);

    // ---- vertical ----
    const sensed = this.gap + (this._rand() - 0.5) * 2 * this.noise;
    this.lastSensed = sensed;
    let Icmd = this.openLoop && !this.control && this.powered ? this.I0 : 0;
    if (this.control) {
      if (this.gapRef > this.gap0) this.gapRef = Math.max(this.gap0, this.gapRef - this.refRate * dt);
      // corriente de equilibrio para la referencia actual: i_ff = i0 * gapref / gap0
      const Iff = (this.I0 * this.gapRef) / this.gap0;
      const x = sensed - this.gapRef;
      const u = this.vk.kp * x + this.vk.kd * this.gapVel + this.vk.ki * this.integ;
      Icmd = clamp(Iff + u, 0, this.Imax);
      // anti-windup: solo integra si no satura
      if (Icmd > 0 && Icmd < this.Imax) this.integ += x * dt;
      this.integ = clamp(this.integ, -2e-3, 2e-3); // m*s, limite de seguridad
    } else {
      this.integ = 0;
    }
    this.I += (Icmd - this.I) * a;

    const F = magnetForce(this.K, this.I, Math.max(this.gap, 1e-4));
    this.lift = F;
    // el vehiculo sube cuando f > m g; subir reduce el entrehierro
    const gapAcc = (m * G - F) / m;
    this.gapVel += gapAcc * dt;
    this.gap += this.gapVel * dt;

    const skidLow = EMS.skidGap;
    const skidHigh = this.gap0 * 2;
    this.contact = false;
    this.fallen = false;
    if (this.gap <= skidLow) {
      this.gap = skidLow;
      if (this.gapVel < 0) this.gapVel = 0;
      this.contact = true;
    } else if (this.gap >= skidHigh) {
      this.gap = skidHigh;
      if (this.gapVel > 0) this.gapVel = 0;
      this.fallen = true;
    }

    // ---- lateral ----
    if (this.gustLeft > 0) {
      this.gustLeft -= dt;
      if (this.gustLeft <= 0) this.gust = 0;
    }
    const yS = this.y + (this._rand() - 0.5) * 2 * this.noise;
    let uy = 0;
    if (this.control) uy = -(this.lk.kp * yS + this.lk.kd * this.vy);
    const Ibias = this.powered ? this.Ib : 0;
    const IRcmd = clamp(Ibias + uy, 0, this.Imax);
    const ILcmd = clamp(Ibias - uy, 0, this.Imax);
    this.IR += (IRcmd - this.IR) * a;
    this.IL += (ILcmd - this.IL) * a;
    const gR = Math.max(this.gap0 - this.y, 1e-4);
    const gL = Math.max(this.gap0 + this.y, 1e-4);
    const Fy = magnetForce(this.Kg, this.IR, gR) - magnetForce(this.Kg, this.IL, gL) + this.gust;
    this.lateralForce = Fy;
    this.vy += (Fy / m) * dt;
    this.y += this.vy * dt;
    const lim = this.gap0 - EMS.skidGap;
    if (this.y > lim) {
      this.y = lim;
      if (this.vy > 0) this.vy = 0;
    } else if (this.y < -lim) {
      this.y = -lim;
      if (this.vy < 0) this.vy = 0;
    }
  }

  get gapMm() {
    return this.gap * 1000;
  }
}
