// estimacion previa de un viaje con distancia fija: a que velocidad llegara y cuantos km hacen falta para
// alcanzar la velocidad maxima pedida. integra solo la dinamica longitudinal con el mismo planificador de
// train.js (aceleracion de planificacion, perfil de frenado y limites del motor), sin las secciones ni el
// ruido, asi que es barato y se puede llamar en cada pulsacion. tests/tripPreview.test.js lo compara con el
// simulador completo para que no se desfasen.

import { RHO_AIR, toKmh } from "./constants.js";
import { MODES, TRIP_MIN, TRIP_MAX } from "./train.js";
import { maxThrust } from "./lsm.js";

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// el ems espera a levitar antes de salir: la referencia sube de 20 a 10 mm a 3 mm/s (ems.js, refRate) [derivado]
const EMS_LIFTOFF_S = 3.3;
// el viaje se da por llegado igual que en train.js: casi parado y a menos de 1,5 m de la estacion
const DT = 0.05;
const LIMITED_BELOW = 0.97; // un pico por debajo de este tanto de la velocidad pedida cuenta como limitado por la distancia

/**
 * @param modeId  "ems" | "eds"
 * @param meters  distancia del viaje, m
 * @param kmh     velocidad maxima pedida, km/h
 * @returns { targetKmh, peakKmh, seconds, limited }
 */
export function previewTrip(modeId, meters, kmh) {
  const mode = MODES[modeId];
  const cfg = mode.cfg;
  const d = clamp(meters, TRIP_MIN, TRIP_MAX);
  const target = clamp(kmh / 3.6, 0, mode.vMax);
  const n = cfg.sections;
  const m = n * cfg.sectionMass;
  const fMaxAt = (v) => maxThrust(v, n * cfg.thrustPerSection, n * cfg.powerPerSection);
  const aero = (v) => 0.5 * RHO_AIR * cfg.dragCd * cfg.dragArea * v * v;
  const aPlan = clamp((0.6 * fMaxAt(0.7 * target)) / m, 0.15, 0.8);

  if (target < 1) return { targetKmh: toKmh(target), peakKmh: 0, seconds: 0, limited: true };
  let v = 0;
  let x = 0;
  let t = modeId === "ems" ? EMS_LIFTOFF_S : 0;
  let peak = 0;
  while (t < 20000) {
    const remaining = d - x;
    if (v < 0.03 && remaining < 1.5 && t > 1) break;
    const fMax = fMaxAt(v);
    const aAcc = clamp((0.9 * fMax) / m, 0.05, 0.8);
    const vBrake = Math.sqrt(2 * aPlan * Math.max(0, remaining - 0.05));
    const vRef = Math.min(target, vBrake);
    const aFF = vBrake < target ? -aPlan : 0;
    const aDecMax = clamp((0.9 * fMax) / m, aPlan, 1.2);
    const aDes = clamp(aFF + (vRef - v) / 3, -aDecMax, aAcc);
    const res = aero(v);
    const F = clamp(m * aDes + res, -fMax, fMax);
    const vNew = Math.max(0, v + ((F - res) / m) * DT);
    x += 0.5 * (v + vNew) * DT;
    v = vNew;
    t += DT;
    if (v > peak) peak = v;
    if (v === 0 && remaining < 1.5) break;
  }
  return { targetKmh: toKmh(target), peakKmh: toKmh(peak), seconds: t, limited: peak < LIMITED_BELOW * target };
}

/** distancia minima (m) con la que el viaje alcanza la velocidad pedida, o null si ni con el maximo alcanza. */
export function distanceToReach(modeId, kmh) {
  const reaches = (d) => !previewTrip(modeId, d, kmh).limited;
  if (!reaches(TRIP_MAX)) return null;
  let lo = TRIP_MIN;
  let hi = TRIP_MAX;
  if (reaches(lo)) return lo;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (reaches(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}
