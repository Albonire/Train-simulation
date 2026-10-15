import { describe, it, expect } from "vitest";
import { EmsSection, magnetForce } from "../src/physics/ems.js";
import { EMS, G } from "../src/physics/constants.js";

const run = (s, seconds, dt = 0.001) => {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) s.step(dt, 0);
};

describe("EMS levitacion", () => {
  it("la corriente de equilibrio sostiene el peso a 10 mm", () => {
    const s = new EmsSection({ noise: 0 });
    const F = magnetForce(s.K, s.I0, s.gap0);
    expect(F).toBeCloseTo(s.mass * G, 3);
  });

  it("sin control el equilibrio es inestable (una perturbacion lo rompe)", () => {
    const s = new EmsSection({ noise: 0 });
    s.control = false;
    s.openLoop = true; // corriente fija en I0, sin realimentacion
    s.kick(0.0005); // +0.5 mm
    run(s, 2);
    expect(Math.abs(s.gap - s.gap0)).toBeGreaterThan(0.005);
  });

  it("con control, una perturbacion de 2 mm converge a 10 mm", () => {
    const s = new EmsSection({ noise: 0 });
    s.kick(0.002);
    run(s, 3);
    expect(s.gap).toBeCloseTo(s.gap0, 4);
    expect(s.contact).toBe(false);
  });

  it("con control, un aumento de carga del 12% se recupera por el integral", () => {
    const s = new EmsSection({ noise: 0 });
    s.addLoad();
    run(s, 6);
    expect(Math.abs(s.gap - s.gap0)).toBeLessThan(2e-4);
    expect(s.I).toBeGreaterThan(s.I0 * 1.05); // necesita mas corriente
  });

  it("la respuesta es amortiguada (sin sobreoscilacion grande)", () => {
    const s = new EmsSection({ noise: 0 });
    s.kick(0.002);
    let minGap = s.gap;
    for (let i = 0; i < 3000; i++) {
      s.step(0.001);
      minGap = Math.min(minGap, s.gap);
    }
    // no debe cruzar el nominal por mas de 1.5 mm
    expect(s.gap0 - minGap).toBeLessThan(0.0015);
  });

  it("el guiado lateral absorbe una rafaga del 10% del peso", () => {
    const s = new EmsSection({ noise: 0 });
    s.addGust(0.1 * s.mass * G, 0.6);
    let maxY = 0;
    for (let i = 0; i < 5000; i++) {
      s.step(0.001);
      maxY = Math.max(maxY, Math.abs(s.y));
    }
    expect(maxY).toBeLessThan(EMS.gapNominal - EMS.skidGap); // no toca el riel
    expect(Math.abs(s.y)).toBeLessThan(3e-4); // vuelve al centro
  });

  it("despega desde los patines (20 mm) hasta 10 mm sin tocar el riel", () => {
    const s = new EmsSection({ noise: 0, resting: true });
    expect(s.gap).toBeCloseTo(0.02, 6);
    s.engage();
    let minGap = s.gap;
    for (let i = 0; i < 12000; i++) {
      s.step(0.001);
      minGap = Math.min(minGap, s.gap);
    }
    expect(s.gap).toBeCloseTo(s.gap0, 3);
    expect(minGap).toBeGreaterThan(0.006); // nunca se acerca al contacto
  });

  it("al cortar la corriente el vehiculo cae a los patines", () => {
    const s = new EmsSection({ noise: 0 });
    s.release();
    for (let i = 0; i < 1500; i++) s.step(0.001);
    expect(s.fallen).toBe(true);
    expect(s.gap).toBeCloseTo(0.02, 6);
  });

  it("con ruido de sensor sigue estable", () => {
    const s = new EmsSection({ seed: 7 });
    run(s, 5);
    expect(Math.abs(s.gap - s.gap0)).toBeLessThan(5e-4);
  });
});
