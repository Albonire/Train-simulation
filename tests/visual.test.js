import { describe, expect, it } from "vitest";
import { adaptiveNear, depthResolution, detailFactor, minSafeOffset, mipBiasFor } from "../src/scene/depth.js";

const FAR = 4000;

describe("resolucion de profundidad", () => {
  it("crece con el cuadrado de la distancia", () => {
    const a = depthResolution(0.1, FAR, 100);
    const b = depthResolution(0.1, FAR, 200);
    expect(b / a).toBeCloseTo(4, 2);
  });
  it("mejora al alejar el plano cercano", () => {
    expect(depthResolution(2, FAR, 300)).toBeLessThan(depthResolution(0.1, FAR, 300) / 15);
  });
  it("el plano cercano adaptativo queda entre 0,1 y 2 m", () => {
    expect(adaptiveNear(1)).toBe(0.1);
    expect(adaptiveNear(60)).toBeCloseTo(1, 12);
    expect(adaptiveNear(1000)).toBe(2);
  });
});

// superficies pegadas a otra en la escena: [descripcion, separacion en m, tiene polygonoffset, distancia
// maxima a la que se ve de forma razonable]. si alguien anade una capa pegada a otra, debe
// anadirla aqui: el test obliga a decidir entre separarla o darle polygonoffset.
const LAYERS = [
  ["corredor de grava sobre el terreno", 0.05, true, 600],
  ["franja amarilla sobre la losa del anden", 0.004, true, 400],
  ["junta de dilatacion EDS sobre la losa", 0.03, false, 300],
  ["junta de dilatacion EMS sobre la placa", 0.02, false, 300],
  ["casquete de corte sobre el plano de corte", 0.02, true, 60],
  ["hilos de la cerca sobre sus postes", 0.015, false, 120],
];

describe("capas pegadas: ninguna se pelea con la de debajo", () => {
  for (const [name, gap, offset, maxDist] of LAYERS) {
    it(name, () => {
      // distancia tipica de camara con el plano cercano que la propia camara elige a esa distancia
      const near = adaptiveNear(maxDist * 0.5);
      const safe = minSafeOffset(near, FAR, maxDist);
      expect(offset || gap >= safe).toBe(true);
    });
  }
});

describe("atenuacion de detalle por velocidad", () => {
  it("parado y despacio conserva todo el detalle", () => {
    expect(mipBiasFor(0)).toBe(0);
    expect(mipBiasFor(8)).toBe(0);
    expect(detailFactor(0)).toBe(1);
  });
  it("crece con la velocidad y se acota", () => {
    const v = [20, 60, 100, 480, 6000].map((s) => mipBiasFor(s));
    for (let i = 1; i < v.length; i++) expect(v[i]).toBeGreaterThanOrEqual(v[i - 1]);
    expect(v[v.length - 1]).toBeLessThanOrEqual(7);
  });
  it("a 480 m/s se desenfoca lo mas fino que 4 m", () => {
    // un texel de 8 cm con sesgo b cubre 8 cm * 2^b: debe superar v / 120 = 4 m
    const b = mipBiasFor(480);
    expect(0.08 * 2 ** b).toBeGreaterThanOrEqual(480 / 120 - 1e-9);
  });
  it("el factor de hormigon baja con la velocidad", () => {
    expect(detailFactor(480)).toBeLessThan(detailFactor(100));
    expect(detailFactor(100)).toBeLessThan(1);
  });
});
