import { describe, expect, it } from "vitest";
import { MAX_TEXT, PARTS, partById, partIds, poseDirection, stepPart } from "../src/scene/partsData.js";
import { Train } from "../src/physics/train.js";

describe("catalogo de piezas", () => {
  for (const mode of ["ems", "eds"]) {
    describe(mode, () => {
      const parts = PARTS[mode];
      it("ids unicos y con coche, pilar y al menos un iman", () => {
        const ids = partIds(mode);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toContain("coche");
        expect(ids).toContain("pier");
        expect(ids.length).toBeGreaterThanOrEqual(6);
      });
      it("textos breves y sin guion largo ni emojis", () => {
        for (const p of parts) {
          expect(p.text.length).toBeGreaterThan(30);
          expect(p.text.length).toBeLessThanOrEqual(MAX_TEXT);
          // dos frases como maximo
          const sentences = p.text.split(/(?<=[.!?])\s+/).filter(Boolean);
          expect(sentences.length).toBeLessThanOrEqual(3);
          expect(p.text + p.name).not.toMatch(/—|–|[\u{1F300}-\u{1FAFF}]/u);
        }
      });
      it("las cifras en vivo se calculan con el modelo sin fallar", () => {
        const tr = new Train(mode);
        tr.advance(60);
        const tel = tr.telemetry();
        for (const p of parts) {
          const rows = p.live(tel, tr);
          expect(rows.length).toBeLessThanOrEqual(2);
          for (const [label, value] of rows) {
            expect(label.length).toBeGreaterThan(2);
            expect(value).not.toBe("–");
            expect(value).not.toMatch(/NaN|undefined/);
          }
        }
      });
      it("encuadre y explosion son finitos", () => {
        for (const p of parts) {
          for (const v of [p.pose.az, p.pose.el, p.pose.fit, p.span, p.explode.dx, p.explode.dy, p.explode.dz]) {
            expect(Number.isFinite(v)).toBe(true);
          }
          expect(p.pose.fit).toBeGreaterThan(0.8);
          expect(p.span).toBeGreaterThan(0);
          expect(Math.hypot(p.explode.dx, p.explode.dy, p.explode.dz)).toBeLessThanOrEqual(6);
        }
      });
    });
  }

  it("poseDirection devuelve un vector unitario", () => {
    for (const pose of [{ az: 0, el: 0 }, { az: 40, el: -12 }, { az: 90, el: 30 }]) {
      const [x, y, z] = poseDirection(pose);
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 12);
    }
    expect(poseDirection({ az: 0, el: 0 })).toEqual([-0, 0, 1]);
  });

  it("stepPart recorre las piezas en circulo en los dos sentidos", () => {
    const ids = partIds("ems");
    expect(stepPart("ems", ids[0], -1)).toBe(ids[ids.length - 1]);
    expect(stepPart("ems", ids[ids.length - 1], 1)).toBe(ids[0]);
    expect(stepPart("ems", "lev", 1)).not.toBe("lev");
    expect(partById("eds", "cryo").name).toMatch(/superconductor/);
  });
});
