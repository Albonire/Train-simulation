import { describe, expect, it } from "vitest";
import { occludes, segmentPointDistance, trainSightPoints, treeSpheres } from "../src/scene/sightline.js";

const P = (x, y, z) => ({ x, y, z });

describe("segmentPointDistance", () => {
  it("distancia a un punto sobre el segmento y fuera de el", () => {
    expect(segmentPointDistance(P(0, 0, 0), P(10, 0, 0), P(5, 3, 0))).toBeCloseTo(3);
    expect(segmentPointDistance(P(0, 0, 0), P(10, 0, 0), P(14, 3, 0))).toBeCloseTo(5);
    expect(segmentPointDistance(P(0, 0, 0), P(0, 0, 0), P(0, 4, 0))).toBeCloseTo(4);
  });
});

describe("occludes: un arbol que tapa el tren se oculta", () => {
  const pts = trainSightPoints(42);
  const cam = P(-36, 14, 88);
  it("un arbol justo en la linea de mira al vagon central tapa", () => {
    // sobre la recta camara-centro, a 65 m de la camara
    const t = 65 / Math.hypot(36, 8, 88);
    const x = cam.x + (0 - cam.x) * t;
    const z = cam.z + (0 - cam.z) * t;
    expect(occludes(cam, treeSpheres(x, z, 12, 3), pts)).toBe(true);
  });
  it("un arbol lejos de la linea de mira no tapa", () => {
    expect(occludes(cam, treeSpheres(120, 60, 12, 3), pts)).toBe(false);
    expect(occludes(cam, treeSpheres(-90, -50, 12, 3), pts)).toBe(false);
  });
  it("un arbol detras del tren (mas lejos que el) no lo tapa", () => {
    expect(occludes(cam, treeSpheres(5, -60, 12, 3), pts)).toBe(false);
  });
  it("un arbol entre la camara y el tren, del otro lado (-z), tapa si la camara gira", () => {
    const back = P(20, 6, -80);
    const t = 55 / Math.hypot(20, 0, 80);
    expect(occludes(back, treeSpheres(back.x - 20 * t, back.z + 80 * t, 14, 3), pts)).toBe(true);
  });
  it("la camara dentro de la copa tapa", () => {
    expect(occludes(P(10, 5, 40), treeSpheres(10, 40, 12, 3), pts)).toBe(true);
  });
  it("la camara cenital no queda tapada por ningun arbol cercano a la via", () => {
    const top = P(0, 108, 0.01);
    for (let x = -60; x <= 60; x += 12) {
      for (const z of [-40, -31, 31, 40]) expect(occludes(top, treeSpheres(x, z, 22, 4), pts)).toBe(false);
    }
  });
});
