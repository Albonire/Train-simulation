import { describe, expect, it } from "vitest";
import { cameraFootprint, inAnyBox, stationFootprint, tileBlocked, toWorld } from "../src/scene/clearance.js";

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
  // posiciones de las camaras de emsscene.js / edsscene.js
  it("Seguir (y = 9 m) y la camara de campo del EDS ven pasar los postes: no ocultan nada", () => {
    expect(cameraFootprint({ x: -45, y: 9, z: 13.5 })).toBe(null);
    expect(cameraFootprint({ x: -7, y: 16.5, z: 7 })).toBe(null);
  });
  it("las camaras de detalle, pegadas a la via, si dejan su hueco", () => {
    for (const p of [
      { x: 10.5, y: 6.9, z: 0.01 }, // ems seccion
      { x: 3.6, y: 6.45, z: 5.2 }, // ems imanes
      { x: -11, y: 4.8, z: 10.5 }, // ems campo
      { x: 10, y: 7.0, z: 0.01 }, // eds seccion
      { x: 4.2, y: 6.95, z: 0.01 }, // eds imanes
    ]) {
      const b = cameraFootprint(p);
      expect(b).not.toBe(null);
      expect(b.x1 - b.x0).toBeLessThanOrEqual(12); // un hueco corto: nada de ocultar 100 m
    }
  });
});

describe("tileBlocked: se oculta lo que hay, no la loseta entera", () => {
  const lampSpans = [[-0.4, 0.4]];
  const lampZ = [[-7.6, -5.4], [5.4, 7.6]];
  const field = cameraFootprint({ x: -11, y: 4.8, z: 10.5 }); // x de -17 a -5
  it("un poste dentro del hueco de la camara se oculta", () => {
    expect(tileBlocked(-10, lampSpans, lampZ, [field])).toBe(true);
  });
  it("un poste fuera del hueco sigue visible, aunque su loseta de 48 m lo rodee (antes parpadeaba)", () => {
    expect(tileBlocked(-60, lampSpans, lampZ, [field])).toBe(false); // la loseta [-60, -12] tocaba el hueco; el poste no
    expect(tileBlocked(-18, lampSpans, lampZ, [field])).toBe(false);
    expect(tileBlocked(20, lampSpans, lampZ, [field])).toBe(false);
  });
  it("de un poste a otro, el hueco cambia por pasos de un poste, no de una loseta", () => {
    // a 554 m/s (x5 a 399 km/h) el decorado pasa por el hueco en 2 centesimas: como mucho 1 poste dentro
    let inside = 0;
    for (let x = -100; x < 60; x += 48) if (tileBlocked(x, lampSpans, lampZ, [field])) inside++;
    expect(inside).toBeLessThanOrEqual(1);
  });
  it("solo cuenta si hay algo a esa altura de z", () => {
    const far = { x0: -17, x1: -5, z0: 30, z1: 40 };
    expect(tileBlocked(-10, lampSpans, lampZ, [far])).toBe(false);
  });
  it("una estacion si oculta los postes de su huella y no los de fuera", () => {
    const st = toWorld(stationFootprint(1000, ZIN), 900); // el tren 100 m antes de la estacion
    expect(tileBlocked(1000 - 900 + 10, lampSpans, lampZ, [st])).toBe(true);
    expect(tileBlocked(1000 - 900 + 61, lampSpans, lampZ, [st])).toBe(false);
  });
  it("sin tramos con geometria nunca se oculta", () => {
    expect(tileBlocked(-10, [], lampZ, [field])).toBe(false);
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
