// suspension electrodinamica (eds, estilo scmaglev).
//
// un iman superconductor a bordo (corriente constante, persistente) se mueve
// frente a las bobinas de la via. el movimiento induce corriente en ellas y esa
// corriente genera un campo que repele al iman. sin movimiento no hay corriente
// inducida: a velocidad cero la sustentacion es cero, por eso el tren rueda sobre
// ruedas de goma hasta unos 150 km/h.
//
// modelo cualitativo (circuito l-r de la bobina de la via, velocidad caracteristica
// vc = r/l * longitud caracteristica):
//     f_lift(v, g) = f0 * v^2 / (v^2 + vc^2) * exp(-(g - g_w) / lambda)
//     f_drag       = kappa * f_lift * vc / v   (l/d = v/(kappa*vc))
// la fuerza disminuye al subir (g aumenta), asi que el equilibrio es estable:
// no hace falta control activo. el arrastre magnetico tiene su pico a baja
// velocidad y cae despues. las constantes se calibran para que el vehiculo
// despegue a v_liftoff con las ruedas y alcance gapcruise a alta velocidad.
// es un modelo ilustrativo, no los datos de jr central. en particular no es la ley
// de las bobinas en 8 de flujo nulo del scmaglev real: en una patente de
// levitacion por induccion (us 5,649,489) la fuerza restauradora vertical es
// proporcional al desplazamiento del iman respecto del centro de la bobina, no una
// exponencial en el entrehierro. aqui se usa la ley de repulsion inducida de tipo
// inductrack porque reproduce lo cualitativo (cero en reposo, saturacion con la
// velocidad, pico de arrastre, estabilidad) con pocos parametros.

import { EDS, G, WHEEL_ROLLING } from "./constants.js";

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export function calibrate({ liftoffSpeed, vc, gapWheels, gapCruise }) {
  const lambda = (gapCruise - gapWheels) / Math.log(1 + (vc / liftoffSpeed) ** 2);
  return { lambda };
}

export class EdsSection {
  constructor(opts = {}) {
    this.mass = opts.mass ?? EDS.sectionMass;
    this.vc = opts.vc ?? EDS.vc;
    this.vl = opts.liftoffSpeed ?? EDS.liftoffSpeed;
    this.gw = opts.gapWheels ?? EDS.gapWheels;
    this.gc = opts.gapCruise ?? EDS.gapCruise;
    this.lambda = calibrate({
      liftoffSpeed: this.vl, vc: this.vc, gapWheels: this.gw, gapCruise: this.gc,
    }).lambda;
    const W = this.mass * G;
    // f0 tal que, a v = vl y g = gw, f_lift = w
    this.F0 = (W * (this.vl ** 2 + this.vc ** 2)) / this.vl ** 2;
    this.damping = EDS.dampingPerKg; // 1/s, c/m de la suspension secundaria
    this.reset();
  }

  reset() {
    this.gap = this.gw; // sobre las ruedas
    this.gapVel = 0;
    this.y = 0;
    this.vy = 0;
    this.wheelsDown = true;
    this.onWheels = true; // contacto con la via
    this.extraMass = 0;
    this.gust = 0;
    this.gustLeft = 0;
    this.lift = 0;
    this.drag = 0;
    this.lateralForce = 0;
    this.inducedRel = 0; // 0..1, intensidad relativa de la corriente inducida
  }

  addLoad(fraction = 0.12) {
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

  /** sustentacion a velocidad v y separacion g, n. */
  liftAt(v, g = this.gap) {
    const s = (v * v) / (v * v + this.vc * this.vc);
    return this.F0 * s * Math.exp(-(g - this.gw) / this.lambda);
  }
  /** arrastre magnetico asociado, n. */
  dragAt(v, g = this.gap) {
    return (EDS.dragFactor * this.liftAt(v, g) * this.vc) / Math.max(v, 0.1);
  }
  /** separacion de equilibrio a velocidad v (con el peso en vacio), m. */
  equilibriumGap(v) {
    const W = (this.mass + this.extraMass) * G;
    const s = (v * v) / (v * v + this.vc * this.vc);
    if (s <= 0) return -Infinity;
    return this.gw - this.lambda * Math.log(W / (this.F0 * s));
  }

  step(dt, speed) {
    const v = Math.max(0, speed);
    const m = this.mass + this.extraMass;
    const W = m * G;

    // ---- ruedas: se extienden por debajo de 0.9*vl y se retraen por encima de vl
    if (v >= this.vl) this.wheelsDown = false;
    else if (v < this.vl * 0.9) this.wheelsDown = true;

    // ---- vertical ----
    const F = this.liftAt(v, this.gap);
    this.lift = F;
    const acc = (F - W) / m - this.damping * this.gapVel;
    this.gapVel += acc * dt;
    this.gap += this.gapVel * dt;
    // el suelo de la via (ruedas extendidas o no): el vehiculo no baja de gw
    this.onWheels = false;
    if (this.gap <= this.gw) {
      this.gap = this.gw;
      if (this.gapVel < 0) this.gapVel = 0;
      this.onWheels = true;
    }
    this.drag = this.dragAt(v, this.gap);
    this.inducedRel = v / Math.sqrt(v * v + this.vc * this.vc);

    // ---- lateral ----
    if (this.gustLeft > 0) {
      this.gustLeft -= dt;
      if (this.gustLeft <= 0) this.gust = 0;
    }
    const wl = EDS.lateralOmega;
    const s = (v * v) / (v * v + this.vc * this.vc);
    // rigidez magnetica (bobinas en 8 conectadas entre ambos lados) + ruedas guia
    const kMag = m * wl * wl * s;
    const kWheel = this.wheelsDown ? m * 20 * 20 : 0;
    const k = kMag + kWheel;
    const c = 2 * 0.5 * m * wl * (1 + (this.wheelsDown ? 3 : 0));
    const Fy = -k * this.y - c * this.vy + this.gust;
    this.lateralForce = Fy;
    this.vy += (Fy / m) * dt;
    this.y += this.vy * dt;
    const lim = 0.15; // holgura lateral, m [ilustrativo]
    this.y = clamp(this.y, -lim, lim);
  }

  /** resistencia de rodadura de las ruedas (n). */
  rollingResistance() {
    return this.onWheels && this.wheelsDown
      ? WHEEL_ROLLING * Math.max(0, (this.mass + this.extraMass) * G - this.lift)
      : 0;
  }

  get gapMm() {
    return this.gap * 1000;
  }
}
