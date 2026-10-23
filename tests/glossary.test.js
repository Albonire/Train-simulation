import { describe, expect, it } from "vitest";
import { GLOSARIO } from "../src/ui/info.js";

// ids de las filas de datos (rows en ui.js) y de los indicadores del cuadro de mando
const IDS = {
  ems: ["cur", "freq", "thr", "ang", "lift", "aero", "pow", "en", "gap", "field"],
  eds: ["ind", "freq", "thr", "lift", "drag", "whl", "pow", "en", "gap", "field"],
};

describe("glosario", () => {
  for (const mode of ["ems", "eds"]) {
    it(`${mode}: toda cifra del panel tiene su definicion, corta y sin jerga sin explicar`, () => {
      for (const id of IDS[mode]) {
        const d = GLOSARIO[mode][id];
        expect(d, `${mode}.${id}`).toBeTruthy();
        expect(d.length).toBeLessThanOrEqual(190);
        expect(d).not.toMatch(/[—–"<>]/); // sin rayas largas ni comillas que rompan el atributo title
      }
    });
  }
  it("el entrehierro se define como el hueco entre el iman y la via", () => {
    expect(GLOSARIO.ems.gap).toMatch(/hueco/i);
    expect(GLOSARIO.ems.gap).toMatch(/10 mm/);
  });
});
