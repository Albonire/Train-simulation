import { describe, it, expect } from "vitest";
import { Train } from "../src/physics/train.js";
import { previewTrip, distanceToReach } from "../src/physics/tripPreview.js";

// la estimacion debe coincidir con el simulador completo: si alguien cambia el planificador de train.js y
// no este archivo, estos casos fallan
function real(mode, meters, kmh) {
  const t = new Train(mode, { noise: 0 });
  t.startTrip(meters, kmh);
  let peak = 0;
  while (!t.trip.done && t.time < 20000) {
    t.step(0.002);
    peak = Math.max(peak, t.v);
  }
  return { peakKmh: peak * 3.6, seconds: t.trip.duration };
}

describe("estimacion previa del viaje", () => {
  const cases = [
    [500, 399], [1000, 399], [2000, 250], [5000, 399], [10000, 399], [10000, 150], [30000, 399], [3000, 100],
  ];
  for (const mode of ["ems", "eds"]) {
    for (const [m, kmh] of cases) {
      it(`${mode} ${m} m a ${kmh} km/h: pico y duracion como el simulador`, () => {
        const r = real(mode, m, kmh);
        const p = previewTrip(mode, m, kmh);
        expect(Math.abs(p.peakKmh / r.peakKmh - 1)).toBeLessThan(0.06);
        expect(Math.abs(p.seconds / r.seconds - 1)).toBeLessThan(0.1);
      });
    }
  }

  it("con poca distancia avisa de que no llega a la velocidad pedida", () => {
    const p = previewTrip("ems", 1000, 399);
    expect(p.limited).toBe(true);
    expect(p.peakKmh).toBeLessThan(0.5 * 399);
  });

  it("con distancia de sobra llega a la velocidad pedida", () => {
    const p = previewTrip("eds", 60000, 400);
    expect(p.limited).toBe(false);
    expect(p.peakKmh).toBeGreaterThan(0.97 * 400);
  });

  it("la velocidad que se alcanza crece con la distancia", () => {
    let prev = 0;
    for (const m of [500, 1000, 2000, 5000, 10000, 20000]) {
      const p = previewTrip("ems", m, 399).peakKmh;
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });

  it("distanceToReach: con esa distancia se alcanza y con bastante menos no", () => {
    for (const mode of ["ems", "eds"]) {
      const d = distanceToReach(mode, 250);
      expect(d).toBeGreaterThan(1000);
      expect(previewTrip(mode, d * 1.02, 250).limited).toBe(false);
      expect(previewTrip(mode, d * 0.8, 250).limited).toBe(true);
    }
  });
});
