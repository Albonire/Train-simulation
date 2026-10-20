import { describe, it, expect } from "vitest";
import { Train } from "../src/physics/train.js";

// Perturbaciones que cambian el estado del control, con la Train real (la misma que usa la interfaz).
// Antes de este arreglo, Train.step volvia a encender el control en el paso siguiente: "Sin control" y
// "Sin corriente" no hacian nada. Estas pruebas fijan el comportamiento prometido.

const cruise = (mode = "ems") => {
  const t = new Train(mode);
  t.advance(mode === "ems" ? 80 : 150);
  return t;
};
const sim = (t, seconds, stop) => {
  const n = Math.round(seconds / 0.001);
  for (let i = 0; i < n; i++) {
    t.step(0.001);
    if (stop?.(t)) return t.time;
  }
  return null;
};

describe("Sin control (EMS)", () => {
  it("antes de perturbar el tren va levitado", () => {
    const t = cruise();
    expect(t.levitated).toBe(true);
  });

  it("el vehiculo cae a los patines en menos de 0,25 s y el tren no lo rescata", () => {
    const t = cruise();
    const mid = t.sections[1];
    expect(t.setControlOff(1, true)).toBe(true);
    const t0 = t.time;
    const hit = sim(t, 0.25, () => mid.fallen || mid.contact);
    expect(hit).not.toBeNull();
    expect(hit - t0).toBeLessThan(0.25);
    // sigue caido mucho tiempo despues: el control no se vuelve a encender solo
    sim(t, 6);
    expect(mid.control).toBe(false);
    expect(mid.fallen || mid.contact).toBe(true);
    expect(t.levitated).toBe(false);
    // las otras secciones no se tocan
    expect(t.sections[0].fallen || t.sections[0].contact).toBe(false);
    expect(t.sections[0].control).toBe(true);
  });

  it("al devolver el control el vehiculo vuelve a levitar", () => {
    const t = cruise();
    t.setControlOff(1, true);
    sim(t, 1);
    t.setControlOff(1, false);
    const back = sim(t, 12, (q) => q.levitated);
    expect(back).not.toBeNull();
    expect(Math.abs(t.sections[1].gap - t.sections[1].gap0)).toBeLessThan(3e-4);
  });

  it("no hace nada en un tren EDS", () => {
    const t = cruise("eds");
    expect(t.setControlOff(1, true)).toBe(false);
    expect(t.cutPower(3)).toBe(false);
    sim(t, 1);
    expect(t.levitated).toBe(true);
  });
});

describe("Sin corriente (EMS)", () => {
  it("cae toda la unidad y no queda corriente en los imanes", () => {
    const t = cruise();
    expect(t.cutPower(3.5)).toBe(true);
    sim(t, 1);
    for (const s of t.sections) {
      expect(s.fallen || s.contact).toBe(true);
      expect(s.I).toBeLessThan(0.5);
    }
    expect(t.levitated).toBe(false);
  });

  it("a los 3,5 s vuelve la alimentacion y recupera la levitacion", () => {
    const t = cruise();
    t.cutPower(3.5);
    sim(t, 3.4);
    expect(t.levitated).toBe(false);
    expect(t.powerCut).toBeGreaterThan(0);
    const back = sim(t, 10, (q) => q.levitated);
    expect(back).not.toBeNull();
    expect(t.powerCut).toBe(0);
    expect(t.sections.every((s) => s.powered)).toBe(true);
  });

  it("el corte se mide en tiempo simulado, no en tiempo real", () => {
    const t = cruise();
    t.cutPower(2);
    t.advance(1.99);
    expect(t.powerCut).toBeGreaterThan(0);
    t.advance(0.02);
    expect(t.powerCut).toBe(0);
  });

  it("con el control apagado, el corte no lo devuelve: la corriente fija vuelve y el vehiculo sigue caido", () => {
    const t = cruise();
    const mid = t.sections[1];
    t.setControlOff(1, true);
    t.advance(1);
    t.cutPower(2);
    t.advance(1);
    expect(mid.I).toBeLessThan(0.5); // durante el corte no pasa corriente, tampoco la fija
    t.advance(3);
    expect(mid.forcedOff).toBe(true);
    expect(mid.control).toBe(false);
    expect(mid.I).toBeCloseTo(mid.I0, 0);
    expect(mid.fallen || mid.contact).toBe(true);
  });
});

describe("Reiniciar", () => {
  it("limpia el corte, el control apagado y la corriente fija", () => {
    const t = cruise();
    t.setControlOff(1, true);
    t.cutPower(3.5);
    t.reset();
    expect(t.powerCut).toBe(0);
    for (const s of t.sections) {
      expect(s.forcedOff).toBe(false);
      expect(s.powered).toBe(true);
      expect(s.openLoop).toBe(false);
    }
    // y el viaje arranca y levita como la primera vez
    const up = sim(t, 40, (q) => q.levitated && q.v > 5);
    expect(up).not.toBeNull();
  });
});
