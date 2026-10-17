import { describe, expect, it } from "vitest";
import { parseRoute, routeHref } from "../src/ui/router.js";
import { ResponseTracker } from "../src/ui/response.js";
import { perimeterV, vAt } from "../src/scene/loft.js";

describe("rutas", () => {
  it("la raiz y lo desconocido van a la simulacion", () => {
    expect(parseRoute("")).toEqual({ page: "sim", arg: "" });
    expect(parseRoute("#/")).toEqual({ page: "sim", arg: "" });
    expect(parseRoute("#/nada")).toEqual({ page: "sim", arg: "" });
  });
  it("lee la pagina y su argumento", () => {
    expect(parseRoute("#/guia")).toEqual({ page: "guia", arg: "" });
    expect(parseRoute("#/guia/como-avanza")).toEqual({ page: "guia", arg: "como-avanza" });
    expect(parseRoute("#/laminas/eds-sustentacion")).toEqual({ page: "laminas", arg: "eds-sustentacion" });
  });
  it("routeHref es la inversa de parseRoute", () => {
    for (const r of [{ page: "sim", arg: "" }, { page: "guia", arg: "" }, { page: "guia", arg: "modelo" }, { page: "laminas", arg: "lsm-sincrono" }]) {
      expect(parseRoute(routeHref(r.page, r.arg))).toEqual(r);
    }
  });
});

describe("respuesta a una perturbacion", () => {
  const run = (f, { ref = 10, tol = 0.05, maxTime = 12, dt = 0.01 } = {}) => {
    const tr = new ResponseTracker();
    tr.start({ label: "golpe", ref, tol, t: 0, maxTime });
    for (let t = dt; t < 30; t += dt) {
      const r = tr.push(t, ref + f(t));
      if (r) return r;
    }
    return null;
  };

  it("mide la desviacion maxima y el tiempo de asentamiento de una oscilacion amortiguada", () => {
    // 2 mm de pico, decae con tau = 0.1 s
    const r = run((t) => 2 * Math.exp(-t / 0.1) * Math.cos(30 * t));
    expect(r.settled).toBe(true);
    expect(r.peak).toBeGreaterThan(1.7);
    expect(r.peak).toBeLessThanOrEqual(2);
    // la banda es max(tol, 5 % del pico) = 0.1 mm: 2*exp(-t/0.1) = 0.1 => t = 0.30 s
    expect(r.settle).toBeGreaterThan(0.2);
    expect(r.settle).toBeLessThan(0.5);
  });

  it("si no vuelve a la banda, lo dice al agotar el tiempo", () => {
    const r = run(() => 2, { maxTime: 3 });
    expect(r.settled).toBe(false);
    expect(r.settle).toBe(null);
  });

  it("no devuelve el resultado dos veces", () => {
    const tr = new ResponseTracker();
    tr.start({ label: "x", ref: 0, tol: 0.1, t: 0 });
    let n = 0;
    for (let t = 0.01; t < 20; t += 0.01) if (tr.push(t, t < 0.05 ? 1 : 0)) n++;
    expect(n).toBe(1);
  });
});

describe("loft: coordenadas de textura", () => {
  const sq = [[1, 0], [1, 1], [-1, 1], [-1, 0]];
  it("el perimetro acumulado va de 0 a 1 y crece", () => {
    const v = perimeterV(sq);
    expect(v).toHaveLength(sq.length + 1);
    expect(v[0]).toBe(0);
    expect(v[v.length - 1]).toBeCloseTo(1, 12);
    for (let i = 1; i < v.length; i++) expect(v[i]).toBeGreaterThan(v[i - 1]);
  });
  it("vAt encuentra una altura en cada costado y no la confunde", () => {
    const a = vAt(sq, 1, 0.5);
    const b = vAt(sq, -1, 0.5);
    expect(a).not.toBe(null);
    expect(b).not.toBe(null);
    expect(a).toBeLessThan(b);
    expect(vAt(sq, 1, 5)).toBe(null);
  });
});
