import { describe, expect, it } from "vitest";
import { createMountains } from "../src/scene/terrain.js";

// la cordillera es una lamina en anillos. si su fila interior flota sobre el suelo, por debajo se ve el
// horizonte lejano: una franja clara entre el primer plano y las montanas (se vio en las capturas del
// tema claro). la fila interior tiene que estar a ras del suelo o por debajo.
describe("cordillera", () => {
  const { mesh } = createMountains();
  const pos = mesh.geometry.getAttribute("position");
  const nT = 900;
  const rows = pos.count / nT;

  it("tiene las filas esperadas", () => {
    expect(Number.isInteger(rows)).toBe(true);
    expect(rows).toBe(11);
  });

  it("la fila interior no flota: queda a ras del suelo o por debajo", () => {
    let top = -Infinity;
    for (let i = 0; i < nT; i++) top = Math.max(top, pos.getY(i));
    expect(top).toBeLessThanOrEqual(0.5);
  });

  it("la lamina cruza el suelo con una pendiente suave (sin escalon entre la fila 0 y la 1)", () => {
    for (let i = 0; i < nT; i += 7) {
      const rise = pos.getY(nT + i) - pos.getY(i);
      const run = Math.hypot(pos.getX(nT + i) - pos.getX(i), pos.getZ(nT + i) - pos.getZ(i));
      expect(rise / run).toBeLessThan(0.35); // menos de unos 19 grados
    }
  });

  it("mas lejos siguen las crestas altas", () => {
    let top = -Infinity;
    for (let i = (rows - 1) * nT; i < pos.count; i++) top = Math.max(top, pos.getY(i));
    expect(top).toBeGreaterThan(150);
  });
});
