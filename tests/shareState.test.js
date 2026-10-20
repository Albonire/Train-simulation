import { describe, expect, it } from "vitest";
import { parseState, stateHash } from "../src/ui/shareState.js";
import { parseRoute } from "../src/ui/router.js";

describe("estado compartible", () => {
  it("ida y vuelta", () => {
    const s = { m: "eds", c: "gap", t: 20, tab: "ctrl" };
    expect(parseState(stateHash(s))).toEqual(s);
  });
  it("sin campos validos no hay estado", () => {
    expect(parseState("")).toBe(null);
    expect(parseState("#/")).toBe(null);
    expect(parseState("#/?m=xx&c=nada&t=7&tab=otra")).toBe(null);
  });
  it("ignora lo invalido y conserva lo valido", () => {
    expect(parseState("#/?m=eds&c=nada&t=0.12")).toEqual({ m: "eds" });
    expect(parseState("#/?t=5&junk=1")).toEqual({ t: 5 });
  });
  it("la escala de camara lenta de un evento no se guarda", () => {
    expect(stateHash({ m: "ems", t: 0.12 })).toBe("#/?m=ems");
  });
  it("un hash con estado sigue siendo la simulacion para el router", () => {
    expect(parseRoute("#/?m=eds&c=gap")).toEqual({ page: "sim", arg: "" });
  });
  it("sin estado, la ruta de la simulacion", () => {
    expect(stateHash({})).toBe("#/");
  });
});
