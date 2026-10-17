import { describe, expect, it } from "vitest";
import { INTRO, introCaption, introExag, introPose, introTimeScale, introXray } from "../src/scene/intro.js";

const orbit = { pos: [-17, 10, 44], tgt: [1, 6.4, 0], fov: 40 };
const finite = (p) => [...p.pos, ...p.tgt, p.fov].every(Number.isFinite);

describe("introPose", () => {
  for (const mode of ["ems", "eds"]) {
    const cfg = INTRO[mode];
    it(`${mode}: empieza en la primera clave y termina exactamente en la orbita`, () => {
      const a = introPose(cfg, 0, orbit);
      expect(a.pos).toEqual(cfg.keys[0].pos);
      const z = introPose(cfg, cfg.duration, orbit);
      expect(z.pos).toEqual(orbit.pos);
      expect(z.tgt).toEqual(orbit.tgt);
      expect(z.fov).toBe(orbit.fov);
      expect(introPose(cfg, cfg.duration + 3, orbit).pos).toEqual(orbit.pos);
    });
    it(`${mode}: es continua y finita en todo el recorrido`, () => {
      let prev = introPose(cfg, 0, orbit);
      for (let t = 0.02; t <= cfg.duration; t += 0.02) {
        const p = introPose(cfg, t, orbit);
        expect(finite(p)).toBe(true);
        // sin saltos: a lo sumo unos metros entre dos instantes de 20 ms
        expect(Math.hypot(...p.pos.map((v, i) => v - prev.pos[i]))).toBeLessThan(2);
        prev = p;
      }
    });
    it(`${mode}: la camara no baja de 1,7 m`, () => {
      for (let t = 0; t <= cfg.duration; t += 0.1) expect(introPose(cfg, t, orbit).pos[1]).toBeGreaterThanOrEqual(1.7);
    });
  }
});

describe("introExag", () => {
  it("es entera y baja de la del primer plano a la normal", () => {
    const cfg = INTRO.ems;
    expect(introExag(cfg, 0, 8)).toBe(24);
    expect(introExag(cfg, cfg.exagRamp[1] + 1, 8)).toBe(8);
    for (let t = 0; t < 9; t += 0.05) expect(Number.isInteger(introExag(cfg, t, 8))).toBe(true);
  });
});

describe("tiempo y rayos X", () => {
  it("el primer plano va a su escala y despues a la habitual", () => {
    const cfg = INTRO.ems;
    expect(introTimeScale(cfg, 1, 5)).toBe(1);
    expect(introTimeScale(cfg, cfg.tsAt + 0.1, 5)).toBe(5);
    expect(introXray(cfg, 1)).toBe(true);
    expect(introXray(cfg, cfg.closeUntil + 0.1)).toBe(false);
  });
});

describe("introCaption", () => {
  it("sigue al modelo y se apaga al terminar el primer plano", () => {
    const e = INTRO.ems;
    expect(introCaption("ems", 0.5, e, { gapMm: 20, levitated: false })).toMatch(/patines/);
    expect(introCaption("ems", 2, e, { gapMm: 14, levitated: false })).toMatch(/despega/);
    expect(introCaption("ems", 5, e, { gapMm: 10, levitated: true })).toMatch(/Levita/);
    expect(introCaption("ems", e.closeUntil + 0.1, e, { gapMm: 10, levitated: true })).toBe("");
    const d = INTRO.eds;
    expect(introCaption("eds", 1, d, { wheelsDown: true })).toMatch(/ruedas/);
    expect(introCaption("eds", 3, d, { wheelsDown: false })).toMatch(/recogen/);
  });
  it("ningun texto pasa de 80 caracteres ni lleva guion largo", () => {
    for (const [mode, tel] of [["ems", { gapMm: 20 }], ["ems", { gapMm: 12, levitated: false }], ["ems", { gapMm: 10, levitated: true }], ["eds", { wheelsDown: true }], ["eds", { wheelsDown: false }]]) {
      const s = introCaption(mode, 1, INTRO[mode], tel);
      expect(s.length).toBeLessThanOrEqual(80);
      expect(s.includes("—")).toBe(false);
    }
  });
});
