// tren completo: secciones + dinamica longitudinal + controlador de viaje.
// es un modelo puro (sin dom): lo comparten la escena 3d y las laminas.

import { EMS, EDS, RHO_AIR, G, toKmh } from "./constants.js";
import { EmsSection } from "./ems.js";
import { EdsSection } from "./eds.js";
import { frequencyFor, speedFor, maxThrust, loadAngle, gridPower, phaseCurrents } from "./lsm.js";

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export const MODES = {
  ems: {
    id: "ems",
    label: "EMS (Transrapid)",
    cfg: EMS,
    vMax: speedFor(EMS.fMax, EMS.polePitch), // 111 m/s = 399 km/h [derivado]
    stationSpacing: 30e3,
    Section: EmsSection,
  },
  eds: {
    id: "eds",
    label: "EDS (SCMaglev)",
    cfg: EDS,
    vMax: EDS.recordSpeed,
    stationSpacing: 80e3,
    Section: EdsSection,
  },
};

// limites del viaje con distancia fija, m. por debajo de 200 m el ems apenas termina de despegar.
export const TRIP_MIN = 200;
export const TRIP_MAX = 200e3;

export const STATES = {
  REPOSO: "reposo",
  LEVITANDO: "levitando",
  ACELERANDO: "acelerando",
  CRUCERO: "crucero",
  FRENANDO: "frenando",
  ESTACION: "estacion",
};

export class Train {
  constructor(mode = "ems", opts = {}) {
    this.opts = opts;
    this.setMode(mode);
  }

  setMode(mode) {
    this.mode = MODES[mode];
    const cfg = this.mode.cfg;
    const noise = this.opts.noise;
    this.sections = Array.from(
      { length: cfg.sections },
      (_, i) =>
        new this.mode.Section({
          resting: mode === "ems",
          seed: 11 + i * 7,
          ...(noise !== undefined ? { noise } : {}),
        }),
    );
    this.length = cfg.sections * cfg.sectionLength;
    this.reset();
  }

  reset() {
    this.x = 0; // posicion de la nariz, m
    this.v = 0;
    this.a = 0;
    this.theta = 0; // fase electrica, rad
    this.time = 0;
    this.targetSpeed = this.mode.vMax;
    this.stationSpacing = this.mode.stationSpacing;
    this.nextStation = this.stationSpacing;
    this.autoTrip = true;
    this.state = STATES.REPOSO;
    this.stateTime = 0;
    this.dwell = 30; // s de parada en estacion [ilustrativo]
    this.thrust = 0;
    this.loadAngle = 0;
    this.energyTraction = 0; // j
    this.energyRegen = 0; // j
    this.gridPower = 0;
    this.lastSnap = 0;
    this.hold = false; // el usuario pide quedarse en reposo
    this.powerCut = 0; // s simulados que le quedan al corte de alimentacion (solo ems)
    this.trip = null; // viaje con distancia fija (starttrip): el tren se detiene al final y no sigue
    for (const s of this.sections) s.reset(this.mode.id === "ems");
  }

  /**
   * apaga (o devuelve) el control de una seccion ems: queda la corriente fija en i0 y el equilibrio
   * es inestable, asi que el vehiculo cae a los patines en menos de 0,25 s. el tren no lo vuelve a
   * encender mientras el usuario no lo pida. devuelve false si no es un tren ems.
   */
  setControlOff(index, off = true) {
    const s = this.sections[index];
    if (this.mode.id !== "ems" || !s) return false;
    s.forcedOff = off;
    s.openLoop = off;
    if (off) {
      s.release();
      s.kick(0.0005); // un empujon de 0,5 mm decide hacia donde se va el desequilibrio
    } else {
      s.engage();
    }
    return true;
  }

  /** corta la alimentacion de todos los imanes durante `seconds` de tiempo simulado; despues vuelven a subir. */
  cutPower(seconds = 3.5) {
    if (this.mode.id !== "ems") return false;
    this.powerCut = seconds;
    for (const s of this.sections) {
      s.powered = false;
      s.release();
    }
    return true;
  }

  get cfg() {
    return this.mode.cfg;
  }
  get totalMass() {
    return this.sections.reduce((a, s) => a + s.mass + s.extraMass, 0);
  }
  get polePitch() {
    return this.cfg.polePitch;
  }
  get frequency() {
    return frequencyFor(this.v, this.polePitch);
  }

  /** cambia la distancia entre estaciones; la siguiente es la mas cercana por delante. */
  setSpacing(meters) {
    this.stationSpacing = meters;
    this.trip = null; // elegir la distancia entre estaciones vuelve al recorrido continuo
    this.nextStation = (Math.floor(this.x / meters + 1e-6) + 1) * meters;
  }

  /**
   * viaje de una sola etapa: sale desde el origen, recorre `distance` metros con la velocidad maxima
   * pedida y se detiene en la estacion de llegada (no sigue a la siguiente). devuelve la distancia usada.
   */
  startTrip(distance, speedKmh = toKmh(this.mode.vMax)) {
    const d = clamp(distance, TRIP_MIN, TRIP_MAX);
    this.reset();
    this.stationSpacing = d;
    this.nextStation = d;
    this.setTargetSpeedKmh(speedKmh);
    this.trip = { distance: d, done: false, vMax: 0, duration: 0 };
    return d;
  }

  setTargetSpeedKmh(kmh) {
    this.targetSpeed = clamp(kmh / 3.6, 0, this.mode.vMax);
  }

  aero(v) {
    return 0.5 * RHO_AIR * this.cfg.dragCd * this.cfg.dragArea * v * v;
  }

  /** resistencia total sin contar el motor, n. */
  resistance(v) {
    let r = this.aero(v);
    if (this.mode.id === "eds") {
      for (const s of this.sections) r += s.drag + s.rollingResistance();
    }
    return r;
  }

  fMaxAt(v) {
    const n = this.sections.length;
    return maxThrust(v, n * this.cfg.thrustPerSection, n * this.cfg.powerPerSection);
  }

  get levitated() {
    if (this.mode.id === "ems") {
      return this.sections.every((s) => s.control && Math.abs(s.gap - s.gap0) < 3e-4 && s.gapRef <= s.gap0 + 1e-6);
    }
    return !this.sections[0].onWheels;
  }

  /** llamar con intervalos pequenos (<= 2 ms). */
  step(dt) {
    const m = this.totalMass;
    this.time += dt;
    this.stateTime += dt;

    // ---- maquina de estados / seleccion de velocidad de referencia ----
    let vRef = 0;
    let canMove = true;
    // deceleracion de planificacion (con margen sobre el empuje disponible) y
    // aceleracion maxima en la velocidad actual
    const aPlan = clamp((0.6 * this.fMaxAt(0.7 * this.targetSpeed)) / m, 0.15, 0.8);
    const aAcc = clamp((0.9 * this.fMaxAt(this.v)) / m, 0.05, 0.8);
    const Fmax0 = this.fMaxAt(this.v);

    if (this.mode.id === "ems") {
      const wantLevitate = this.state !== STATES.REPOSO || !this.hold;
      const landed = this.state === STATES.ESTACION && this.stateTime > 2 && this.stateTime < this.dwell - 8;
      // el corte de alimentacion y el control apagado por el usuario mandan sobre la maquina de estados
      if (this.powerCut > 0) {
        this.powerCut = Math.max(0, this.powerCut - dt);
        if (this.powerCut === 0) for (const s of this.sections) s.powered = true;
      }
      for (const s of this.sections) {
        if (this.powerCut > 0 || s.forcedOff || landed || !wantLevitate) s.release();
        else s.engage();
      }
      canMove = this.levitated;
    }

    switch (this.state) {
      case STATES.REPOSO:
        if (!this.hold) {
          // tras un viaje terminado, salir de nuevo es otra etapa de la misma distancia
          if (this.trip?.done) {
            this.nextStation += this.stationSpacing;
            this.trip = null;
          }
          this._go(STATES.LEVITANDO);
        }
        break;
      case STATES.LEVITANDO:
        if (canMove) this._go(STATES.ACELERANDO);
        break;
      case STATES.ESTACION:
        if (this.stateTime >= this.dwell && canMove && !this.hold) {
          this.nextStation += this.stationSpacing;
          this._go(STATES.ACELERANDO);
        }
        break;
      default:
        break;
    }

    // distancia a la estacion, calculada despues de cualquier cambio de estacion
    const remaining = this.nextStation - this.x;
    const driving =
      this.state === STATES.ACELERANDO || this.state === STATES.CRUCERO || this.state === STATES.FRENANDO;
    let aDes = 0;
    if (driving) {
      const vBrake = this.autoTrip ? Math.sqrt(2 * aPlan * Math.max(0, remaining - 0.05)) : Infinity;
      vRef = Math.min(this.targetSpeed, vBrake);
      // anticipacion: sobre el perfil de frenado la velocidad de referencia baja
      // a -aplan; sin este termino el seguimiento por realimentacion arrastra un
      // retardo de velocidad y el tren se pasa de la estacion
      const aFF = vBrake < this.targetSpeed ? -aPlan : 0;
      const aDecMax = clamp((0.9 * Fmax0) / m, aPlan, 1.2);
      aDes = clamp(aFF + (vRef - this.v) / 3, -aDecMax, aAcc);
      // el estado describe lo que hace el tren, no lo que planea
      if (aDes < -0.04) this.state = STATES.FRENANDO;
      else if (aDes > 0.04 && this.v < vRef - 0.5) this.state = STATES.ACELERANDO;
      else if (this.v > 5) this.state = STATES.CRUCERO;
    }

    // ---- empuje ----
    const res = this.resistance(this.v);
    const Fmax = this.fMaxAt(this.v);
    let F = 0;
    if (driving) F = clamp(m * aDes + res, -Fmax, Fmax);
    this.thrust = F;
    this.loadAngle = loadAngle(F, Fmax);

    // ---- dinamica longitudinal ----
    const net = F - res;
    this.a = net / m;
    const vOld = this.v;
    this.v = Math.max(0, this.v + this.a * dt);
    this.x += 0.5 * (vOld + this.v) * dt;
    if (this.state === STATES.FRENANDO && this.autoTrip && this.v < 0.03 && Math.abs(this.nextStation - this.x) < 1.5) {
      this.lastSnap = this.nextStation - this.x; // ajuste final de posicion, m
      this.v = 0;
      this.x = this.nextStation;
      if (this.trip) {
        // fin del viaje: se queda en reposo (en ems aterriza sobre los patines) hasta que se pida salir
        this.trip.done = true;
        this.trip.duration = this.time;
        this.hold = true;
        this._go(STATES.REPOSO);
      } else {
        this._go(STATES.ESTACION);
      }
    }
    if (this.trip && !this.trip.done) this.trip.vMax = Math.max(this.trip.vMax, this.v);
    if (!this.autoTrip && this.targetSpeed === 0 && this.v < 0.03 && this.state !== STATES.REPOSO) {
      this.v = 0;
    }

    // ---- electrica ----
    this.theta = (this.theta + 2 * Math.PI * this.frequency * dt) % (2 * Math.PI);
    this.gridPower = gridPower(F, this.v);
    if (this.gridPower >= 0) this.energyTraction += this.gridPower * dt;
    else this.energyRegen -= this.gridPower * dt;

    // ---- secciones ----
    for (const s of this.sections) s.step(dt, this.v);
  }

  /** avanza `seconds` de tiempo simulado con paso fijo. */
  advance(seconds, dt = 0.001) {
    const n = Math.max(1, Math.round(seconds / dt));
    for (let i = 0; i < n; i++) this.step(dt);
  }

  _go(state) {
    this.state = state;
    this.stateTime = 0;
  }

  /** foto de las magnitudes que muestra la interfaz. */
  telemetry() {
    const gaps = this.sections.map((s) => s.gapMm);
    const mid = Math.floor(gaps.length / 2);
    const ems = this.mode.id === "ems";
    const sec0 = this.sections[0];
    const amplitude = Math.abs(this.thrust) / Math.max(1, this.fMaxAt(0)); // 0..1, relativo
    return {
      mode: this.mode.id,
      state: this.state,
      x: this.x,
      speed: this.v,
      speedKmh: toKmh(this.v),
      accel: this.a,
      gapsMm: gaps,
      // una sola definicion en toda la interfaz: la de la seccion central (la que miran la lupa y los
      // rotulos); el minimo y el maximo de las tres van aparte
      gapMm: gaps[mid],
      gapMinMm: Math.min(...gaps),
      gapMaxMm: Math.max(...gaps),
      current: ems ? sec0.I : this.cfg.magnetMmf ?? EDS.magnetMmf,
      induced: ems ? 0 : sec0.inducedRel,
      frequency: this.frequency,
      thrust: this.thrust,
      loadAngleDeg: (this.loadAngle * 180) / Math.PI,
      liftTotal: this.sections.reduce((a, s) => a + s.lift, 0),
      weight: this.totalMass * G,
      dragMag: ems ? 0 : this.sections.reduce((a, s) => a + s.drag, 0),
      dragAero: this.aero(this.v),
      gridPowerMW: this.gridPower / 1e6,
      energyTractionKWh: this.energyTraction / 3.6e6,
      energyRegenKWh: this.energyRegen / 3.6e6,
      wheelsDown: ems ? false : this.sections[0].wheelsDown,
      levitated: this.levitated,
      phases: phaseCurrents(this.theta, amplitude),
      theta: this.theta,
      nextStation: this.nextStation,
      remaining: this.nextStation - this.x,
      time: this.time,
      trip: this.trip ? { ...this.trip } : null,
    };
  }
}
