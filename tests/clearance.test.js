import { describe, expect, it } from "vitest";
import { cameraFootprint, inAnyBox, stationFootprint, toWorld } from "../src/scene/clearance.js";

const ZIN = 2.5;

describe("huella de una estacion", () => {
  const box = stationFootprint(1000, ZIN);
  it("cubre el anden, la escalera y el edificio de acceso (lado -z, hacia -x)", () => {
    expect(inAnyBox(1000, -ZIN - 3, [box])).toBe(true); // centro del anden
    expect(inAnyBox(1000 - 55, -ZIN - 6 - 7, [box])).toBe(true); // edificio de acceso
    expect(inAnyBox(1000 + 55, -ZIN - 1, [box])).toBe(true); // extremo del anden
  });
  it("incluye lo que la atravesaba: postes de luz, cerca y arbustos del lado del anden", () => {
    expect(inAnyBox(1010, -7.2, [box])).toBe(true); // poste de luz
    expect(inAnyBox(990, -13, [box])).toBe(true); // cerca
    expect(inAnyBox(1020, -20, [box])).toBe(true); // arbusto
  });
  it("no toca el lado de la camara (+z) ni lo que queda lejos de la estacion", () => {
    expect(inAnyBox(1000, 7.2, [box])).toBe(false);
    expect(inAnyBox(1000, 13, [box])).toBe(false);
    expect(inAnyBox(1000 + 200, -7.2, [box])).toBe(false);
    expect(inAnyBox(1000 - 200, -7.2, [box])).toBe(false);
  });
  it("llega mas atras que adelante, donde esta el edificio", () => {
    expect(box.x0).toBeLessThan(1000 - 60);
    expect(box.x1).toBeGreaterThan(1000 + 55);
  });
});

describe("huella de una camara baja", () => {
  it("una camara junto a la via oculta lo que tiene al lado", () => {
    const b = cameraFootprint({ x: -11, y: 4.8, z: 10.5 });
    expect(b).not.toBe(null);
    expect(inAnyBox(-11 + 3, 7.2, [b])).toBe(true); // poste de luz a 3 m de la camara
    expect(inAnyBox(60, 7.2, [b])).toBe(false);
  });
  it("la orbita, lejana o alta, no oculta nada", () => {
    expect(cameraFootprint({ x: -24, y: 11.5, z: 59 })).toBe(null);
    expect(cameraFootprint({ x: 0, y: 58, z: 0.01 })).toBe(null);
  });
});

describe("toWorld", () => {
  it("la estacion se mueve con el tren: lo que esta en la huella cambia con s", () => {
    const box = stationFootprint(1000, ZIN);
    const w = toWorld(box, 900); // el tren esta 100 m antes de la estacion
    expect(w.x0).toBeCloseTo(box.x0 - 900);
    expect(inAnyBox(100, -7.2, [w])).toBe(true);
    expect(inAnyBox(100 + 300, -7.2, [w])).toBe(false);
  });
});
