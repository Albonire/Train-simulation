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

import { fitDistance } from "../src/scene/frame.js";

describe("fitDistance: el tren llena el area libre", () => {
  const dirOf = (pos, tgt) => {
    const d = pos.map((v, i) => v - tgt[i]);
    const l = Math.hypot(...d);
    return d.map((v) => v / l);
  };
  const base = {
    target: [0, 6.4, 0],
    dir: dirOf([-24, 11.5, 59], [0, 6.4, 0]),
    fov: 40,
    box: { min: [-27.5, 4.5, -2.4], max: [27.5, 11.4, 2.4] },
  };
  // proyecta las esquinas con la camara colocada por el resultado y devuelve la semianchura y el semialto
  const project = ({ distance, shift }, { aspect }) => {
    const f = base.dir.map((v) => -v);
    const R = (() => { const r = [-f[2], 0, f[0]]; const l = Math.hypot(...r); return r.map((v) => v / l); })();
    const U = [R[1] * f[2] - R[2] * f[1], R[2] * f[0] - R[0] * f[2], R[0] * f[1] - R[1] * f[0]];
    const th = Math.tan((base.fov * Math.PI) / 360);
    const tgt = base.target.map((v, i) => v + shift[i]);
    const xs = [], ys = [];
    for (const x of [base.box.min[0], base.box.max[0]]) for (const y of [base.box.min[1], base.box.max[1]]) for (const z of [base.box.min[2], base.box.max[2]]) {
      const c = [x - tgt[0], y - tgt[1], z - tgt[2]];
      const depth = distance + c[0] * f[0] + c[1] * f[1] + c[2] * f[2];
      xs.push((c[0] * R[0] + c[1] * R[1] + c[2] * R[2]) / (depth * th * aspect));
      ys.push((c[0] * U[0] + c[1] * U[1] + c[2] * U[2]) / (depth * th));
    }
    return { hx: (Math.max(...xs) - Math.min(...xs)) / 2, hy: (Math.max(...ys) - Math.min(...ys)) / 2, cx: (Math.max(...xs) + Math.min(...xs)) / 2 };
  };
  for (const [name, aspect, free] of [
    ["escritorio con panel", 2.09, { fx: 0.73, fy: 0.78 }],
    ["escritorio sin panel", 2.09, { fx: 0.9, fy: 0.78 }],
    ["portatil", 1.78, { fx: 0.64, fy: 0.8 }],
    ["movil vertical", 0.46, { fx: 1, fy: 0.62 }],
  ]) {
    it(`${name}: cabe, queda centrado y llena el 88 %`, () => {
      const r = fitDistance({ ...base, aspect, free });
      expect(Number.isFinite(r.distance)).toBe(true);
      expect(r.shift.every(Number.isFinite)).toBe(true);
      const { hx, hy, cx } = project(r, { aspect });
      expect(hx).toBeLessThanOrEqual(0.88 * free.fx + 1e-3);
      expect(hy).toBeLessThanOrEqual(0.88 * free.fy + 1e-3);
      expect(Math.abs(cx)).toBeLessThan(0.02); // centrado
      const tight = Math.max(hx / (0.88 * free.fx), hy / (0.88 * free.fy));
      expect(tight).toBeGreaterThan(0.99);
    });
  }
  it("un area libre menor aleja la camara", () => {
    const a = fitDistance({ ...base, aspect: 2.09, free: { fx: 0.9, fy: 0.8 } });
    const b = fitDistance({ ...base, aspect: 2.09, free: { fx: 0.6, fy: 0.8 } });
    expect(b.distance).toBeGreaterThan(a.distance);
  });
  it("con el panel abierto en 1920x918 queda mas cerca que los 64 m de antes", () => {
    const r = fitDistance({ ...base, aspect: 2.09, free: { fx: 0.73, fy: 0.78 } });
    expect(r.distance).toBeLessThan(56);
    expect(r.distance).toBeGreaterThan(40);
  });
  it("datos no validos dan null", () => {
    expect(fitDistance({ ...base, aspect: NaN, free: { fx: 1, fy: 1 } })).toBe(null);
    expect(fitDistance({ ...base, aspect: 2, free: { fx: 0, fy: 1 } })).toBe(null);
    expect(fitDistance({ ...base, dir: [0, 0, 0], aspect: 2, free: { fx: 1, fy: 1 } })).toBe(null);
  });
});
