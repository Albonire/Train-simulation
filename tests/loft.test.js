import { describe, expect, it } from "vitest";
import { loft, bodyStations } from "../src/scene/loft.js";

// contorno parecido al del ems (z, y): costados que llegan hasta y = -1,37, un vertice a y = 0 en cada
// costado exterior y la cavidad por donde pasa la viga.
const W = 2.04;
const Wc = 1.92;
const outline = [
  [W, -1.37],
  [W, 0],
  [W, 1.3],
  [0, 3.7],
  [-W, 1.3],
  [-W, 0],
  [-W, -1.37],
  [-Wc, -1.37],
  [-Wc, 0],
  [Wc, 0],
  [Wc, -1.37],
];
const stations = bodyStations(10);

describe("loft con faldon", () => {
  it("sin skirtBelow es una sola malla, sin grupos (como siempre)", () => {
    const g = loft(outline, stations);
    expect(g.groups.length).toBe(0);
  });

  it("con skirtBelow hay dos grupos que cubren todos los indices, sin solaparse", () => {
    const g = loft(outline, stations, { skirtBelow: -0.01 });
    expect(g.groups.length).toBe(2);
    const [a, b] = g.groups;
    expect(a.materialIndex).toBe(0);
    expect(b.materialIndex).toBe(1);
    expect(a.start).toBe(0);
    expect(b.start).toBe(a.count);
    expect(a.count + b.count).toBe(g.index.count);
    expect(b.count).toBeGreaterThan(0);
    expect(a.count).toBeGreaterThan(b.count); // el cuerpo pesa mas que el faldon
  });

  it("los triangulos del faldon estan todos por debajo del suelo del coche (y <= 0) y los otros no son faldon", () => {
    const g = loft(outline, stations, { skirtBelow: -0.01 });
    const pos = g.getAttribute("position");
    const idx = g.index;
    const [body, skirt] = g.groups;
    for (let i = skirt.start; i < skirt.start + skirt.count; i++) {
      expect(pos.getY(idx.getX(i))).toBeLessThanOrEqual(1e-6);
    }
    // ningun triangulo de la carroceria queda entero por debajo de y = 0 salvo las tapas de los extremos:
    // un costado exterior bajo el suelo es siempre faldon
    let strayWalls = 0;
    for (let i = body.start; i < body.start + body.count; i += 3) {
      const ys = [0, 1, 2].map((k) => pos.getY(idx.getX(i + k)));
      const x = [0, 1, 2].map((k) => pos.getX(idx.getX(i + k)));
      const flat = Math.max(...x) - Math.min(...x) < 1e-6; // una tapa: todo a la misma x
      if (!flat && Math.max(...ys) < -0.2) strayWalls++;
    }
    expect(strayWalls).toBe(0);
  });

  it("el techo de la cavidad (y = 0) sigue siendo opaco: el punto medio del segmento no baja de skirtBelow", () => {
    const g = loft(outline, stations, { skirtBelow: -0.01 });
    const pos = g.getAttribute("position");
    const idx = g.index;
    const skirt = g.groups[1];
    // el techo de la cavidad es el segmento de (-wc, 0) a (wc, 0): ningun triangulo del faldon tiene
    // todos sus vertices en y = 0
    for (let i = skirt.start; i < skirt.start + skirt.count; i += 3) {
      const ys = [0, 1, 2].map((k) => pos.getY(idx.getX(i + k)));
      expect(ys.every((y) => Math.abs(y) < 1e-6)).toBe(false);
    }
  });

  it("las tapas de los extremos van con la carroceria (grupo 0)", () => {
    const g = loft(outline, stations, { skirtBelow: -0.01 });
    const pos = g.getAttribute("position");
    const idx = g.index;
    const skirt = g.groups[1];
    for (let i = skirt.start; i < skirt.start + skirt.count; i += 3) {
      const x = [0, 1, 2].map((k) => pos.getX(idx.getX(i + k)));
      expect(Math.max(...x) - Math.min(...x)).toBeGreaterThan(1e-6); // ninguna es una tapa
    }
  });
});
