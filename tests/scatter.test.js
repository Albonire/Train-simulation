import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { CAMERA_SIDE_GAP, CELL, CORRIDOR, allowedTreeSpot, bushLayout, hash, treesAround, treesForCell } from "../src/scene/scatter.js";

describe("hash", () => {
  it("es determinista y cae en [0, 1) tambien a decenas de kilometros", () => {
    for (let cell = 0; cell < 2000; cell += 37) {
      for (const b of [-91, 17, 300, 2000, 99999]) {
        const h = hash(cell, b);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(1);
        expect(hash(cell, b)).toBe(h);
      }
    }
  });
});

describe("reparto de arboles", () => {
  it("ninguno invade el corredor de la via ni la franja de la camara orbital", () => {
    expect(allowedTreeSpot(0)).toBe(false);
    expect(allowedTreeSpot(CORRIDOR - 1)).toBe(false);
    expect(allowedTreeSpot(-(CORRIDOR - 1))).toBe(false);
    expect(allowedTreeSpot(CAMERA_SIDE_GAP - 1)).toBe(false);
    expect(allowedTreeSpot(-CORRIDOR - 1)).toBe(true);
    expect(allowedTreeSpot(CAMERA_SIDE_GAP + 1)).toBe(true);
    expect(allowedTreeSpot(NaN)).toBe(false);
  });
  it("de 0 a 100 km: todo es finito, esta fuera del corredor y hay arboles a los dos lados", () => {
    for (let s = 0; s <= 100000; s += 1237) {
      const trees = treesAround(s);
      let far = 0;
      for (const t of trees) {
        expect([t.x, t.z, t.ang, t.sx, t.sy, t.tone].every(Number.isFinite)).toBe(true);
        expect(Math.abs(t.z)).toBeGreaterThanOrEqual(CORRIDOR);
        expect(t.z > 0 && t.z < CAMERA_SIDE_GAP).toBe(false);
        if (t.z < 0) far++;
      }
      expect(far).toBeGreaterThan(500);
      expect(trees.length).toBeGreaterThan(900);
    }
  });
  it("una celda da siempre los mismos arboles y todos son de una especie conocida", () => {
    const a = treesForCell(316, -1);
    const b = treesForCell(316, -1);
    expect(a).toEqual(b);
    for (const t of a) expect(["c", "b", "p"]).toContain(t.kind);
  });
  it("los arboles de una celda caen cerca de ella (a lo mas un bosquete de radio)", () => {
    for (const cell of [0, 5, 316, 1600]) {
      for (const side of [-1, 1]) {
        for (const t of treesForCell(cell, side)) {
          expect(t.x).toBeGreaterThan(cell * CELL - 50);
          expect(t.x).toBeLessThan((cell + 1) * CELL + 50);
        }
      }
    }
  });
});

describe("arbustos", () => {
  it("el reparto es fijo y cabe en su periodo", () => {
    const a = bushLayout();
    expect(bushLayout()).toEqual(a);
    expect(a).toHaveLength(110);
    for (const b of a) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x).toBeLessThan(600);
      expect(Math.abs(b.z)).toBeGreaterThanOrEqual(11);
    }
  });
});

describe("sin instancias de GPU en el entorno", () => {
  it("ningun archivo del entorno crea un InstancedMesh", () => {
    // las instancias fallan en algunas GPU: el entorno usa mallas fusionadas (ver forest.js y props.js)
    const dir = new URL("../src/scene/", import.meta.url);
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".js"))) {
      const src = readFileSync(new URL(f, dir), "utf8");
      const code = src.replace(/\/\/.*$/gm, "");
      if (f === "parts.js") continue; // solo comprueba `isInstancedMesh` por si llega una
      expect(code.includes("new THREE.InstancedMesh"), f).toBe(false);
    }
  });
});
