import { describe, it, expect } from "vitest";
import { frequencyFor, speedFor, maxThrust, loadAngle, gridPower, phaseCurrents } from "../src/physics/lsm.js";
import { EMS, LSM_EFFICIENCY } from "../src/physics/constants.js";

describe("motor lineal sincrono", () => {
  it("v = 2 * tau * f", () => {
    expect(speedFor(100, 0.258)).toBeCloseTo(51.6, 6);
    expect(frequencyFor(51.6, 0.258)).toBeCloseTo(100, 6);
  });
  it("215 Hz con tau = 258 mm corresponden a unos 399 km/h", () => {
    expect(speedFor(EMS.fMax, EMS.polePitch) * 3.6).toBeCloseTo(399.4, 0);
  });
  it("el empuje esta limitado por fuerza a baja velocidad y por potencia a alta", () => {
    expect(maxThrust(10, 100e3, 5e6)).toBe(100e3);
    expect(maxThrust(100, 100e3, 5e6)).toBe(50e3);
  });
  it("angulo de carga: sin(delta) = F / Fmax, saturado en 90 grados", () => {
    expect(Math.sin(loadAngle(50e3, 100e3))).toBeCloseTo(0.5, 9);
    expect(loadAngle(500e3, 100e3)).toBeCloseTo(Math.PI / 2, 9);
    expect(loadAngle(-50e3, 100e3)).toBeLessThan(0);
  });
  it("traccionar consume de la red y frenar devuelve energia", () => {
    expect(gridPower(100e3, 50)).toBeCloseTo((100e3 * 50) / LSM_EFFICIENCY, 6);
    expect(gridPower(-100e3, 50)).toBeCloseTo(-100e3 * 50 * LSM_EFFICIENCY, 6);
  });
  it("las tres fases suman cero en cualquier instante", () => {
    for (const th of [0, 0.3, 1.7, 4.2]) {
      const [a, b, c] = phaseCurrents(th, 1);
      expect(a + b + c).toBeCloseTo(0, 12);
    }
  });
});
