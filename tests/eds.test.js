import { describe, it, expect } from "vitest";
import { EdsSection } from "../src/physics/eds.js";
import { EDS, G } from "../src/physics/constants.js";

describe("EDS sustentacion", () => {
  const s = new EdsSection();
  const W = s.mass * G;

  it("sin movimiento no hay sustentacion ni arrastre", () => {
    expect(s.liftAt(0)).toBe(0);
    expect(s.dragAt(0)).toBe(0);
  });
  it("la sustentacion iguala el peso a la velocidad de despegue sobre las ruedas", () => {
    expect(s.liftAt(EDS.liftoffSpeed, EDS.gapWheels)).toBeCloseTo(W, 3);
    expect(s.equilibriumGap(EDS.liftoffSpeed)).toBeCloseTo(EDS.gapWheels, 6);
  });
  it("a alta velocidad el equilibrio tiende a la elevacion de crucero (100 mm)", () => {
    expect(s.equilibriumGap(1e4)).toBeCloseTo(EDS.gapCruise, 3);
  });
  it("la elevacion de equilibrio crece con la velocidad", () => {
    let prev = -Infinity;
    for (const kmh of [60, 100, 150, 250, 400, 603]) {
      const g = s.equilibriumGap(kmh / 3.6);
      expect(g).toBeGreaterThan(prev);
      prev = g;
    }
  });
  it("el equilibrio es estable: una perturbacion vertical se amortigua sola", () => {
    const t = new EdsSection();
    const v = 500 / 3.6;
    for (let i = 0; i < 20000; i++) t.step(0.001, v); // llega al equilibrio
    const g0 = t.gap;
    t.kick(0.01);
    for (let i = 0; i < 20000; i++) t.step(0.001, v);
    expect(t.gap).toBeCloseTo(g0, 4);
  });
  it("el arrastre magnetico tiene un pico cerca de v = vc y cae despues", () => {
    const at = (kmh) => {
      const t = new EdsSection();
      const v = kmh / 3.6;
      const g = Math.max(t.equilibriumGap(v), EDS.gapWheels);
      return t.dragAt(v, g);
    };
    const peak = EDS.vc * 3.6; // 72 km/h
    expect(at(30)).toBeLessThan(at(peak));
    expect(at(peak)).toBeGreaterThan(at(150));
    expect(at(150)).toBeGreaterThan(at(603));
  });
  it("las ruedas se retraen a 150 km/h y se extienden por debajo de 135 km/h", () => {
    const t = new EdsSection();
    t.step(0.001, 149 / 3.6);
    expect(t.wheelsDown).toBe(true);
    t.step(0.001, 151 / 3.6);
    expect(t.wheelsDown).toBe(false);
    t.step(0.001, 140 / 3.6);
    expect(t.wheelsDown).toBe(false); // histeresis
    t.step(0.001, 130 / 3.6);
    expect(t.wheelsDown).toBe(true);
  });
  it("el guiado lateral pasivo restituye el vehiculo tras una rafaga", () => {
    const t = new EdsSection();
    const v = 400 / 3.6;
    for (let i = 0; i < 5000; i++) t.step(0.001, v);
    t.addGust(0.1 * W, 0.5);
    for (let i = 0; i < 15000; i++) t.step(0.001, v);
    expect(Math.abs(t.y)).toBeLessThan(2e-3);
  });
});
