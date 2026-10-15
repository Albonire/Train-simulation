import { describe, it, expect } from "vitest";
import { SyncDrive } from "../src/physics/lsm.js";

const run = (d, seconds, freq, load = 0, dt = 0.001) => {
  const n = Math.round(seconds / dt);
  const f = typeof freq === "function" ? freq : () => freq;
  for (let i = 0; i < n; i++) d.step(dt, f(i * dt), load);
};

describe("maquina sincrona con carga", () => {
  it("en vacio, el vehiculo sigue la onda a v = 2 * tau * f", () => {
    const d = new SyncDrive();
    run(d, 20, 0.5);
    expect(d.v).toBeCloseTo(d.syncSpeed(0.5), 3);
    expect(Math.abs(d.delta)).toBeLessThan(0.02);
  });

  it("con carga, queda retrasado el angulo delta = asin(F_carga / F_max)", () => {
    const d = new SyncDrive();
    const load = 1.2;
    run(d, 25, 0.5, load);
    expect(d.v).toBeCloseTo(d.syncSpeed(0.5), 3); // sigue sincrono
    expect(Math.sin(d.delta)).toBeCloseTo(load / d.Fmax, 2);
    expect(d.delta).toBeGreaterThan(0); // la onda va por delante
  });

  it("si la carga supera F_max pierde el sincronismo (nunca alcanza v sincrona)", () => {
    const d = new SyncDrive();
    run(d, 40, 0.5, d.Fmax * 1.2);
    expect(d.v).toBeLessThan(d.syncSpeed(0.5) * 0.9);
    // el angulo de carga recorre mas de una vuelta respecto de la onda
    expect(Math.abs(d.xWave - d.x)).toBeGreaterThan(d.tau * 5);
  });

  it("al frenar (la frecuencia baja) el angulo de carga es negativo y la fuerza frena", () => {
    const d = new SyncDrive();
    run(d, 20, 0.5);
    let minDelta = 0;
    let minForce = 0;
    for (let i = 0; i < 3000; i++) {
      d.step(0.001, Math.max(0, 0.5 - i * 0.0005), 0); // rampa de 1 s hacia 0
      minDelta = Math.min(minDelta, d.delta);
      minForce = Math.min(minForce, d.force);
    }
    expect(minDelta).toBeLessThan(-0.05);
    expect(minForce).toBeLessThan(0);
  });

  it("el campo de la onda es 0 sobre el vehiculo centrado y maximo a media distancia", () => {
    const d = new SyncDrive();
    d.reset(1);
    expect(d.waveAt(d.xWave)).toBeCloseTo(0, 9);
    expect(Math.abs(d.waveAt(d.xWave - d.tau / 2))).toBeCloseTo(1, 9);
  });

  it("el empuje maximo coincide con delta = 90 grados", () => {
    const d = new SyncDrive();
    d.reset(0);
    d.thetaW = Math.PI / 2; // la onda esta delta = 90 grados por delante
    d.step(1e-9, 0, 0);
    expect(d.force).toBeCloseTo(d.Fmax, 6);
  });
});
