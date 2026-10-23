// pagina "guia": lectura con indice lateral, en lugar de un dialogo con scroll.

import { guide } from "../info.js";
import { routeHref } from "../router.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function renderGuia(el, { mode, arg, setMode }) {
  const g = guide(mode);
  const [figId, figText] = g.figure;
  el.innerHTML = `
  <div class="doc">
    <nav class="toc" aria-label="En esta página">
      <div class="seg wide" role="group" aria-label="Tecnología">
        <button data-gm="ems" aria-pressed="${mode === "ems"}">EMS</button>
        <button data-gm="eds" aria-pressed="${mode === "eds"}">EDS</button>
      </div>
      <ol>${g.sections.map((s) => `<li><a href="${routeHref("guia", s.id)}" data-sec="${s.id}">${esc(s.title)}</a></li>`).join("")}</ol>
    </nav>
    <article class="prose">
      <h1 id="guiaTitulo" tabindex="-1">${esc(g.title)}</h1>
      <p class="lead">${esc(g.lead)} <a href="${routeHref("laminas", figId)}">${esc(figText)}</a>.</p>
      ${g.sections.map((s) => `<section id="sec-${s.id}"><h2>${esc(s.title)}</h2>${s.html}</section>`).join("")}
    </article>
  </div>`;

  for (const b of el.querySelectorAll("[data-gm]")) b.addEventListener("click", () => setMode(b.dataset.gm));

  // indice: marca la seccion que esta a la vista
  const links = [...el.querySelectorAll("[data-sec]")];
  const secs = g.sections.map((s) => el.querySelector(`#sec-${s.id}`));
  const spy = () => {
    const y = el.scrollTop + 96;
    let cur = 0;
    secs.forEach((s, i) => {
      if (s.offsetTop <= y) cur = i;
    });
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) cur = secs.length - 1;
    links.forEach((a, i) => a.setAttribute("aria-current", String(i === cur)));
  };
  el.onscroll = spy;
  spy();

  const target = arg && el.querySelector(`#sec-${CSS.escape(arg)}`);
  if (target) target.scrollIntoView({ block: "start" });
  else el.scrollTop = 0;
  spy();
}
