import { describe, expect, it } from "vitest";
import { TOUR, stepAt, stepLabel, stepsOf } from "../src/ui/tourData.js";
import { Train } from "../src/physics/train.js";

const RIGS = ["orbit", "chase", "section", "gap", "top", "field"];
const LAYERS = ["fields", "wave", "forces", "labels"];
const EVENTS = ["ctrlOff", "cutPower", "kick", "gust", "load"];

describe("visita guiada: datos", () => {
  for (const mode of ["ems", "eds"]) {
    describe(mode, () => {
      const steps = stepsOf(mode);
      it("tiene entre 4 y 6 pasos con id unico", () => {
        expect(steps.length).toBeGreaterThanOrEqual(4);
        expect(steps.length).toBeLessThanOrEqual(6);
        expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
      });
      it("cada paso es corto: titulo de a lo sumo 36 letras y texto de a lo sumo 3 frases y 230 letras", () => {
        for (const s of steps) {
          expect(s.title.length).toBeGreaterThan(0);
          expect(s.title.length).toBeLessThanOrEqual(36);
          expect(s.text.length).toBeLessThanOrEqual(230);
          const sentences = s.text.split(/[.!?]\s/).filter(Boolean).length;
          expect(sentences).toBeLessThanOrEqual(3);
        }
      });
      it("sin rayas largas, emoticonos ni signos raros (el proyecto no los usa)", () => {
        for (const s of steps) {
          expect(`${s.title} ${s.text}`).not.toMatch(/[—–]/);
          expect(`${s.title} ${s.text}`).not.toMatch(/[\u{1F300}-\u{1FAFF}☀-➿]/u);
        }
      });
      it("usa solo camaras, capas y eventos que existen", () => {
        for (const s of steps) {
          expect(RIGS).toContain(s.rig);
          for (const k of Object.keys(s.layers ?? {})) expect(LAYERS).toContain(k);
          if (s.event) expect(EVENTS).toContain(s.event);
          expect(s.timeScale).toBeGreaterThan(0);
        }
      });
      it("solo el primer paso reinicia el viaje", () => {
        expect(steps[0].reset).toBe(true);
        expect(steps.slice(1).some((s) => s.reset)).toBe(false);
      });
      it("un evento con camara lenta dice cuanta y por cuanto tiempo", () => {
        for (const s of steps.filter((x) => x.slow)) {
          expect(s.slow.scale).toBeGreaterThan(0);
          expect(s.slow.scale).toBeLessThan(1);
          expect(s.slow.seconds).toBeGreaterThan(0);
          expect(s.event).toBeTruthy();
        }
      });
    });
  }
  it("el ultimo paso del EMS devuelve al usuario el control", () => {
    expect(stepsOf("ems").at(-1).id).toBe("libre");
  });
  it("modos desconocidos no rompen nada", () => {
    expect(stepsOf("xx")).toEqual([]);
    expect(stepAt("xx", 0)).toBe(null);
    expect(stepAt("ems", -5)).toBe(TOUR.ems[0]);
    expect(stepAt("ems", 99)).toBe(TOUR.ems.at(-1));
    expect(stepLabel("ems", 1)).toBe("2 de 5");
  });
});

// El texto de cada paso afirma algo del modelo: aqui se comprueba con la Train real.
describe("visita guiada: lo que dice cada paso es lo que pasa", () => {
  it("EDS: parado va sobre ruedas; a los 44 s sigue sobre ruedas y poco despues las recoge, cerca de 150 km/h", () => {
    const t = new Train("eds");
    const steps = stepsOf("eds");
    expect(t.levitated).toBe(false); // paso 1: sobre ruedas
    t.advance(steps[1].advance); // paso 2: adelanta 44 s
    expect(t.sections[0].wheelsDown).toBe(true);
    expect(t.v * 3.6).toBeLessThan(150);
    t.advance(steps[2].advance); // paso 3: 6 s mas
    expect(t.sections[0].wheelsDown).toBe(true); // todavia no: se ve la maniobra con la camara
    let sec = 0;
    while (t.sections[0].wheelsDown && sec < 30) {
      t.advance(0.5);
      sec += 0.5;
    }
    expect(sec).toBeLessThan(10); // a x5, menos de 2 s reales
    expect(t.v * 3.6).toBeGreaterThan(140);
    expect(t.v * 3.6).toBeLessThan(165);
  });

  it("EMS: el hueco nominal es de 10 mm, como dice el primer paso", () => {
    const t = new Train("ems");
    t.advance(80);
    expect(t.sections[1].gapMm).toBeCloseTo(10, 0);
    expect(stepsOf("ems")[0].text).toMatch(/10 mm/);
  });

  it("EMS: el paso de Sin control termina con el tren caido, y deshacerlo lo recupera dentro del tiempo de la visita", () => {
    const t = new Train("ems");
    t.advance(80);
    const step = stepsOf("ems").find((s) => s.event === "ctrlOff");
    t.setControlOff(1, true);
    // camara lenta: `seconds` reales a `scale` son seconds * scale simulados; la caida (menos de 0,25 s) cabe
    t.advance(step.slow.seconds * step.slow.scale);
    expect(t.sections[1].fallen || t.sections[1].contact).toBe(true);
    t.setControlOff(1, false);
    let sec = 0;
    while (!t.levitated && sec < 20) {
      t.advance(0.25);
      sec += 0.25;
    }
    expect(t.levitated).toBe(true);
    expect(sec).toBeLessThan(6);
  });
});
