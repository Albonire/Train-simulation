// estado compartible de la simulacion: modo, camara, escala de tiempo y pestana del panel. va en el
// hash (#/?m=eds&c=gap&t=5&tab=ctrl) para poder copiar un enlace, y en localstorage para recordarlo.
// codigo puro: cada campo se valida y lo desconocido se ignora, asi un enlace viejo o a mano no rompe nada.

export const MODES_OK = ["ems", "eds"];
export const RIGS_OK = ["orbit", "chase", "section", "gap", "top", "field"];
export const TIMES_OK = [0.25, 1, 5, 20, 60];
export const TABS_OK = ["data", "ctrl", "view"];

/** lee { m, c, t, tab } de un hash tipo "#/?m=eds&c=gap". devuelve null si no hay ningun campo valido. */
export function parseState(hash) {
  const q = String(hash ?? "").split("?")[1] ?? "";
  const p = new URLSearchParams(q);
  const out = {};
  if (MODES_OK.includes(p.get("m"))) out.m = p.get("m");
  if (RIGS_OK.includes(p.get("c"))) out.c = p.get("c");
  const t = Number(p.get("t"));
  if (TIMES_OK.includes(t)) out.t = t;
  if (TABS_OK.includes(p.get("tab"))) out.tab = p.get("tab");
  return Object.keys(out).length ? out : null;
}

/** el hash de un estado; los campos invalidos se omiten. */
export function stateHash(state) {
  const p = new URLSearchParams();
  if (MODES_OK.includes(state?.m)) p.set("m", state.m);
  if (RIGS_OK.includes(state?.c)) p.set("c", state.c);
  if (TIMES_OK.includes(state?.t)) p.set("t", String(state.t));
  if (TABS_OK.includes(state?.tab)) p.set("tab", state.tab);
  const s = p.toString();
  return s ? `#/?${s}` : "#/";
}
