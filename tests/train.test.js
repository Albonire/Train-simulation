import { describe, it, expect } from "vitest";
import { Train } from "../src/physics/train.js";
import { EMS } from "../src/physics/constants.js";
import { speedFor } from "../src/physics/lsm.js";

// corre hasta la primera parada en estacion y devuelve metricas
function firstTrip(mode, { maxSeconds = 1500 } = {}) {
  const t = new Train(mode);
  const dt = 0.001;
  let maxV = 0;
  let maxF = 0;
  let maxStepDx = 0;
  let work = 0; // integral de f*v
  let resWork = 0; // integral de resistencia*v
  let minGap = Infinity;
  let maxGapErr = 0;
  let sawMotion = false;
  let arrived = false;
  while (t.time < maxSeconds) {
    const xBefore = t.x;
    const res = t.resistance(t.v);
    t.step(dt);
    if (t.v > 1) sawMotion = true;
    maxStepDx = Math.max(maxStepDx, Math.abs(t.x - xBefore) - t.v * dt);
    maxV = Math.max(maxV, t.v);
    maxF = Math.max(maxF, t.frequency);
    work += t.thrust * t.v * dt;
    resWork += res * t.v * dt;
    for (const s of t.sections) {
      minGap = Math.min(minGap, s.gap);
      if (mode === "ems" && t.v > 1) maxGapErr = Math.max(maxGapErr, Math.abs(s.gap - s.gap0));
    }
    if (sawMotion && t.state === "estacion") { arrived = true; break; }
  }
  return { t, maxV, maxF, maxStepDx, work, resWork, minGap, maxGapErr, arrived };
}

describe("tren EMS (viaje completo)", () => {
  const r = firstTrip("ems");
  it("llega y se detiene en la estacion (error < 0.5 m)", () => {
    expect(r.arrived).toBe(true);
    expect(Math.abs(r.t.x - 30e3)).toBeLessThan(0.5);
    expect(r.t.v).toBe(0);
  });
  it("no supera la velocidad que permite la frecuencia maxima (399 km/h)", () => {
    expect(r.maxV).toBeLessThanOrEqual(speedFor(EMS.fMax, EMS.polePitch) + 0.05);
    expect(r.maxF).toBeLessThanOrEqual(EMS.fMax + 0.5);
  });
  it("mantiene el entrehierro a 10 mm +- 0.5 mm durante todo el movimiento", () => {
    expect(r.maxGapErr).toBeLessThan(5e-4);
    expect(r.minGap).toBeGreaterThan(EMS.skidGap);
  });
  it("la posicion es continua (sin saltos)", () => {
    expect(r.maxStepDx).toBeLessThan(0.1); // solo el ajuste final de unos cm
    expect(Math.abs(r.t.lastSnap)).toBeLessThan(0.2); // el ajuste final es de centimetros
  });
  it("balance de energia: trabajo del motor = trabajo contra la resistencia (parada a parada)", () => {
    expect(Math.abs(r.work - r.resWork) / r.resWork).toBeLessThan(0.01);
  });
  it("regenera energia al frenar", () => {
    expect(r.t.energyRegen).toBeGreaterThan(0);
    expect(r.t.energyRegen).toBeLessThan(r.t.energyTraction);
  });
});

describe("tren EDS (viaje completo)", () => {
  const r = firstTrip("eds", { maxSeconds: 1800 });
  it("llega y se detiene en la estacion (error < 0.5 m)", () => {
    expect(r.arrived).toBe(true);
    expect(Math.abs(r.t.x - 80e3)).toBeLessThan(0.5);
  });
  it("alcanza 603 km/h sin superarlos", () => {
    expect(r.maxV * 3.6).toBeGreaterThan(602);
    expect(r.maxV * 3.6).toBeLessThan(603.1);
  });
  it("la posicion es continua (sin saltos)", () => {
    expect(r.maxStepDx).toBeLessThan(0.1); // solo el ajuste final de unos cm
    expect(Math.abs(r.t.lastSnap)).toBeLessThan(0.2); // el ajuste final es de centimetros
  });
  it("balance de energia: trabajo del motor = trabajo contra la resistencia", () => {
    expect(Math.abs(r.work - r.resWork) / r.resWork).toBeLessThan(0.01);
  });
});

describe("perturbaciones sobre el tren", () => {
  it("EMS: el tren absorbe un aumento de carga en una seccion y mantiene el entrehierro", () => {
    const t = new Train("ems", { noise: 0 });
    t.advance(30);
    t.sections[1].addLoad();
    t.advance(15);
    expect(Math.abs(t.sections[1].gap - t.sections[1].gap0)).toBeLessThan(3e-4);
  });
});
