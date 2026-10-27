import { describe, it, expect } from "vitest";
import { Train, TRIP_MIN, TRIP_MAX } from "../src/physics/train.js";
import { fmtKm } from "../src/physics/constants.js";

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

  it("salir despues del viaje repite el viaje: misma distancia, misma velocidad maxima y tiempo por tramo", () => {
    const r = runTrip("eds", 3000, 250, { extra: 1 });
    const first = r.t.trip.duration;
    expect(r.t.hold).toBe(true);
    r.t.hold = false;
    r.t.advance(1);
    expect(r.t.trip).not.toBe(null);
    expect(r.t.trip.done).toBe(false);
    expect(r.t.trip.distance).toBe(3000);
    expect(r.t.nextStation).toBeCloseTo(6000, 6);
    expect(r.t.targetSpeed * 3.6).toBeCloseTo(250, 6);
    while (!r.t.trip.done && r.t.time < 3000) r.t.step(0.001);
    expect(r.t.trip.done).toBe(true);
    expect(Math.abs(r.t.x - 6000)).toBeLessThan(1.5);
    // la duracion es la del segundo tramo, no la acumulada
    expect(Math.abs(r.t.trip.duration - first)).toBeLessThan(0.05 * first);
  });

  it("elegir la distancia entre estaciones vuelve al recorrido continuo", () => {
    const t = new Train("ems");
    t.startTrip(2000, 300);
    t.setSpacing(30e3);
    expect(t.trip).toBe(null);
  });
});

describe("fmtKm", () => {
  it("entero sin decimales y con coma si no lo es", () => {
    expect(fmtKm(12000)).toBe("12");
    expect(fmtKm(12500)).toBe("12,5");
    expect(fmtKm(500)).toBe("0,5");
    expect(fmtKm(250)).toBe("0,25");
    expect(fmtKm(2500)).toBe("2,5");
    expect(fmtKm(1000.0000001)).toBe("1");
  });
});
