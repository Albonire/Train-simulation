// pagina "laminas": lista de las figuras isometricas y la figura elegida a pantalla grande.

import { FIGURES } from "../info.js";
import { routeHref } from "../router.js";

export function renderLaminas(el, { arg, theme, mode }) {
  const fallback = mode === "eds" ? "eds-sustentacion" : "ems-levitacion";
  const fig = FIGURES.find((f) => f.id === arg) ?? FIGURES.find((f) => f.id === fallback);
  el.innerHTML = `
  <div class="lam">
    <nav class="lam-list" aria-label="Láminas">
      <h1>Láminas</h1>
      <ul>${FIGURES.map((f) => `<li><a href="${routeHref("laminas", f.id)}" aria-current="${f.id === fig.id}"><b>${f.title}</b><span>${f.line}</span></a></li>`).join("")}</ul>
    </nav>
    <iframe class="lam-frame" title="${fig.title}" src="figures/${fig.id}${theme === "light" ? "-light" : ""}.html"></iframe>
  </div>`;
}

/** Libera el iframe (y sus animaciones) al salir de la pagina. */
export function clearLaminas(el) {
  const f = el.querySelector("iframe");
  if (f) f.src = "about:blank";
  el.innerHTML = "";
}
