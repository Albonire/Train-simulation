import { describe, it, expect } from "vitest";
import { Train, TRIP_MIN, TRIP_MAX } from "../src/physics/train.js";

// viaje con distancia fija: corre hasta que termina (o se agota el tiempo) y sigue un rato mas
function runTrip(mode, distance, kmh, { extra = 60, maxSeconds = 3000 } = {}) {
  const t = new Train(mode, { noise: 0 });
  const d = t.startTrip(distance, kmh);
  let maxV = 0;
  while (t.time < maxSeconds && !t.trip?.done) {
    t.step(0.001);
    maxV = Math.max(maxV, t.v);
  }
  const done = !!t.trip?.done;
  const xArrive = t.x;
  const tel = t.telemetry();
  t.advance(extra);
  return { t, d, done, maxV, xArrive, tel, xAfter: t.x };
}

describe("viaje con distancia fija", () => {
  for (const mode of ["ems", "eds"]) {
    for (const [km, kmh] of [[0.5, 400], [5, 250], [40, 600]]) {
      it(`${mode}: ${km} km a ${kmh} km/h se detiene en el punto pedido y no sigue`, () => {
        const r = runTrip(mode, km * 1000, kmh);
        expect(r.done).toBe(true);
        expect(Math.abs(r.xArrive - r.d)).toBeLessThan(1.5);
        expect(r.t.v).toBe(0);
        expect(r.xAfter).toBe(r.xArrive); // se queda quieto
        expect(r.t.hold).toBe(true);
        expect(r.maxV * 3.6).toBeLessThanOrEqual(Math.min(kmh, r.t.mode.vMax * 3.6) + 1);
        expect(r.tel.trip.done).toBe(true);
        expect(r.tel.trip.duration).toBeGreaterThan(0);
      });
    }
  }

  it("ems: al terminar aterriza sobre los patines", () => {
    const r = runTrip("ems", 2000, 300, { extra: 5 });
    expect(r.t.sections.every((s) => s.fallen)).toBe(true);
  });

  it("acota la distancia a los limites", () => {
    const t = new Train("ems");
    expect(t.startTrip(10)).toBe(TRIP_MIN);
    expect(t.startTrip(1e9)).toBe(TRIP_MAX);
  });

  it("salir despues del viaje recorre otra etapa igual y vuelve al modo continuo", () => {
    const r = runTrip("eds", 3000, 400, { extra: 1 });
    r.t.hold = false;
    r.t.advance(1);
    expect(r.t.trip).toBe(null);
    expect(r.t.nextStation).toBeCloseTo(6000, 6);
  });
});
