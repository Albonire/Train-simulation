import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Lee los tokens de color de style.css y comprueba el contraste de los pares que se usan para leer.
// WCAG 2.x: texto normal 4,5:1; elementos graficos (series, bordes de controles) 3:1.
const css = readFileSync(new URL("../src/ui/style.css", import.meta.url), "utf8");

function tokens(selectorStart) {
  const i = css.indexOf(selectorStart);
  const block = css.slice(i, css.indexOf("}", i));
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
}
const dark = tokens(":root {");
const light = { ...dark, ...tokens(':root[data-theme="light"] {') };
const lightEds = { ...light, ...tokens(':root[data-theme="light"][data-mode="eds"] {') };
const darkEds = { ...dark, ...tokens(':root[data-mode="eds"] {') };

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const L = (h) => {
  const [r, g, b] = rgb(h).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [L(a), L(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
// --tint = 20 % del acento sobre la superficie (mezcla en sRGB: una buena aproximacion de la de oklab)
const mix = (a, b, k) => "#" + rgb(a).map((v, i) => Math.round((v * k + rgb(b)[i] * (1 - k)) * 255).toString(16).padStart(2, "0")).join("");

const THEMES = { "oscuro": dark, "claro": light, "oscuro EDS": darkEds, "claro EDS": lightEds };

describe("contraste de los tokens de color", () => {
  for (const [name, t] of Object.entries(THEMES)) {
    describe(name, () => {
      it("texto, texto atenuado y tenue sobre la superficie y sobre el fondo (4,5:1)", () => {
        for (const k of ["text", "muted", "faint"]) {
          expect(ratio(t[k], t.surface), `${k} sobre surface`).toBeGreaterThanOrEqual(4.5);
          expect(ratio(t[k], t["surface-2"]), `${k} sobre surface-2`).toBeGreaterThanOrEqual(4.5);
        }
      });
      it("el acento y los estados se leen como texto sobre la superficie y sobre el tinte de lo activo (4,5:1)", () => {
        const tint = mix(t.accent, t.surface, 0.2);
        expect(ratio(t.accent, t.surface), "accent sobre surface").toBeGreaterThanOrEqual(4.5);
        expect(ratio(t.accent, tint), "accent sobre tint").toBeGreaterThanOrEqual(4.5);
        for (const k of ["ok", "warn", "bad"]) expect(ratio(t[k], t.surface), `${k} sobre surface`).toBeGreaterThanOrEqual(4.5);
      });
      it("las series de los graficos se distinguen de la superficie (3:1)", () => {
        for (const k of ["series-1", "series-2", "series-3"]) expect(ratio(t[k], t.surface), k).toBeGreaterThanOrEqual(3);
      });
      it("el borde de los controles (--edge) se ve sobre la superficie (3:1)", () => {
        expect(ratio(t.edge, t.surface)).toBeGreaterThanOrEqual(3);
      });
      it("el contorno de foco se ve sobre la superficie (3:1)", () => {
        expect(ratio(t.focus, t.surface)).toBeGreaterThanOrEqual(3);
      });
    });
  }
});
