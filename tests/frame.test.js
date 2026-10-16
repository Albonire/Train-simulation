import { describe, expect, it } from "vitest";
import { cameraIsSane, framePart, windowBox } from "../src/scene/frame.js";
import { PARTS } from "../src/scene/partsData.js";

const box = (min, max) => ({ min: { x: min[0], y: min[1], z: min[2] }, max: { x: max[0], y: max[1], z: max[2] } });
const def = { pose: { az: 35, el: 10, fit: 1.2 } };
const finiteAll = (f) => [...f.target, ...f.position].every(Number.isFinite);

describe("windowBox: recorte de la caja a la ventana de la pieza", () => {
  it("una caja que cruza el centro se recorta alrededor de x = 0", () => {
    const w = windowBox(box([-12, 0, -1], [13, 5, 1]), 4);
    expect(w.min.x).toBe(-4);
    expect(w.max.x).toBe(4);
  });
  it("una caja lejos del centro no queda invertida ni vacia", () => {
    for (const x0 of [10, 17, 25, -30, 400]) {
      const w = windowBox(box([x0, 0, -1], [x0 + 1.7, 5, 1]), 3);
      expect(w.min.x).toBeLessThanOrEqual(w.max.x);
      expect(w.max.x - w.min.x).toBeGreaterThan(1);
    }
  });
  it("rechaza cajas invalidas", () => {
    expect(windowBox(null, 3)).toBe(null);
    expect(windowBox(box([NaN, 0, 0], [1, 1, 1]), 3)).toBe(null);
    expect(windowBox(box([2, 0, 0], [1, 1, 1]), 3)).toBe(null);
    expect(windowBox(box([0, 0, 0], [1, 1, 1]), 0)).toBe(null);
    expect(windowBox(box([0, 0, 0], [1, 1, 1]), Infinity)).toBe(null);
  });
});

describe("framePart: siempre un encuadre finito o null", () => {
  it("caja normal", () => {
    const f = framePart(box([-3, 0, -1.2], [3, 5.5, 1.2]), def);
    expect(finiteAll(f)).toBe(true);
    expect(f.distance).toBeGreaterThanOrEqual(3.2);
    expect(f.position[1]).toBeGreaterThanOrEqual(1.7);
  });
  it("caja plana en un eje, o un punto", () => {
    expect(finiteAll(framePart(box([0, 0, 0], [0, 5, 2]), def))).toBe(true);
    expect(finiteAll(framePart(box([1, 2, 3], [1, 2, 3]), def))).toBe(true);
  });
  it("caja enorme: la distancia se acota", () => {
    const f = framePart(box([-5000, 0, -5000], [5000, 50, 5000]), def);
    expect(f.distance).toBeLessThanOrEqual(80);
    expect(finiteAll(f)).toBe(true);
  });
  it("valores no validos dan null", () => {
    expect(framePart(null, def)).toBe(null);
    expect(framePart(box([NaN, 0, 0], [1, 1, 1]), def)).toBe(null);
    expect(framePart(box([0, 0, 0], [Infinity, 1, 1]), def)).toBe(null);
    expect(framePart(box([2, 0, 0], [1, 1, 1]), def)).toBe(null);
    expect(framePart(box([0, 0, 0], [1, 1, 1]), {})).toBe(null);
    expect(framePart(box([0, 0, 0], [1, 1, 1]), def, { aspect: NaN })).toBe(null);
    expect(framePart(box([0, 0, 0], [1, 1, 1]), def, { fov: 0 })).toBe(null);
  });
  it("una pose sin ajuste usa uno por defecto", () => {
    const f = framePart(box([-1, 0, -1], [1, 2, 1]), { pose: { az: 0, el: 0 } });
    expect(finiteAll(f)).toBe(true);
  });
  it("pantalla vertical: la camara se aleja mas", () => {
    const b = box([-3, 0, -1], [3, 5, 1]);
    expect(framePart(b, def, { aspect: 0.46 }).distance).toBeGreaterThan(framePart(b, def, { aspect: 2.1 }).distance);
  });
  it("la camara no baja de la altura de los ojos aunque la pieza este a ras de suelo", () => {
    const f = framePart(box([-2, 0, -1], [2, 0.3, 1]), { pose: { az: 20, el: -30, fit: 1.2 } });
    expect(f.position[1]).toBeGreaterThanOrEqual(1.7);
  });
});

describe("todas las piezas del catalogo se encuadran en cualquier posicion de la via", () => {
  for (const mode of ["ems", "eds"]) {
    for (const p of PARTS[mode]) {
      it(`${mode} ${p.id}`, () => {
        // la pieza puede estar en cualquier punto de un tramo de 27 m, a cualquier altura del modelo
        for (let x = -30; x <= 30; x += 7.3) {
          const win = windowBox(box([x - 12, 0, -2.4], [x + 12, 8, 2.4]), p.span);
          for (const aspect of [0.46, 1, 2.1]) {
            const f = framePart(win, p, { aspect });
            expect(f).not.toBe(null);
            expect(finiteAll(f)).toBe(true);
            expect(f.position[1]).toBeGreaterThanOrEqual(1.7);
          }
        }
      });
    }
  }
});

describe("cameraIsSane", () => {
  const P = { x: 10, y: 5, z: 20 };
  const T = { x: 0, y: 6, z: 0 };
  it("acepta una camara normal", () => {
    expect(cameraIsSane(P, T, [1, 0, 0, 0])).toBe(true);
  });
  it("rechaza NaN, infinito y camaras lejanas", () => {
    expect(cameraIsSane({ ...P, x: NaN }, T)).toBe(false);
    expect(cameraIsSane(P, { ...T, y: Infinity })).toBe(false);
    expect(cameraIsSane(P, T, [1, NaN])).toBe(false);
    expect(cameraIsSane({ x: 5000, y: 5, z: 0 }, T)).toBe(false);
  });
});
