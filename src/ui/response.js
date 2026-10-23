// mide la respuesta del tren a una perturbacion: cuanto se desvia como maximo y en
// cuanto tiempo vuelve a quedar dentro de una banda. trabaja con el tiempo simulado,
// asi que el resultado no depende de la escala de tiempo ni de los fotogramas.

export class ResponseTracker {
  constructor() {
    this.cur = null;
  }

  /**
   * label: texto para el resultado; ref: valor antes de perturbar; tol: banda minima
   * (misma unidad que `ref`); t: tiempo simulado actual; maxtime: limite de espera (s).
   */
  start({ label, ref, tol, t, maxTime = 12 }) {
    this.cur = { label, ref, tol, t0: t, peak: 0, calmSince: null, maxTime, result: null };
  }

  get active() {
    return this.cur !== null && this.cur.result === null;
  }

  /** devuelve el resultado la primera vez que esta listo; despues, null. */
  push(t, value) {
    const a = this.cur;
    if (!a || a.result) return null;
    const dev = Math.abs(value - a.ref);
    if (dev > a.peak) {
      a.peak = dev;
      a.calmSince = null;
    }
    const band = Math.max(a.tol, 0.05 * a.peak);
    if (a.peak > a.tol && dev <= band) {
      if (a.calmSince === null) a.calmSince = t;
      if (t - a.calmSince >= 0.25) return this.finish(true, a.calmSince - a.t0);
    } else {
      a.calmSince = null;
    }
    if (t - a.t0 > a.maxTime) return this.finish(dev <= band, null);
    return null;
  }

  finish(settled, settle) {
    const a = this.cur;
    a.result = { label: a.label, peak: a.peak, settled, settle };
    return a.result;
  }

  cancel() {
    this.cur = null;
  }
}
