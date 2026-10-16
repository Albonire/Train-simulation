// Tarjeta de pieza: nombre, un texto breve y hasta dos cifras en vivo. Es un popover manual
// (capa superior del navegador, sin fondo oscuro ni bloqueo): la escena sigue manejable y se
// puede girar la camara con la tarjeta abierta. Esc la cierra.

import { ICONS } from "./icons.js";

export function createPartCard(parent, { onPrev, onNext, onClose }) {
  const el = document.createElement("div");
  el.id = "partCard";
  el.setAttribute("popover", "manual");
  el.setAttribute("role", "region");
  el.setAttribute("aria-labelledby", "pcTitle");
  el.innerHTML = `
    <div class="pc-head">
      <h2 id="pcTitle" tabindex="-1"></h2>
      <button class="ib" data-pc="close" aria-label="Cerrar la tarjeta (Esc)" title="Cerrar (Esc)">${ICONS.close}</button>
    </div>
    <p id="pcText"></p>
    <dl id="pcLive" aria-live="off"></dl>
    <div class="pc-nav">
      <button class="btn" data-pc="prev" aria-label="Pieza anterior">${ICONS.prev}<span>Anterior</span></button>
      <span id="pcCount" aria-live="polite"></span>
      <button class="btn" data-pc="next" aria-label="Pieza siguiente"><span>Siguiente</span>${ICONS.next}</button>
    </div>`;
  parent.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const title = $("#pcTitle"), text = $("#pcText"), live = $("#pcLive"), count = $("#pcCount");
  let lastRows = "";

  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pc]");
    if (!b) return;
    if (b.dataset.pc === "prev") onPrev();
    else if (b.dataset.pc === "next") onNext();
    else onClose();
  });

  return {
    el,
    get open() {
      return el.matches(":popover-open");
    },
    /** part: { name, text }; index y total: posicion en la lista de piezas. */
    show(part, index, total) {
      title.textContent = part.name;
      text.textContent = part.text;
      count.textContent = `${index + 1} de ${total}`;
      lastRows = "";
      live.innerHTML = "";
      if (!el.matches(":popover-open")) el.showPopover();
    },
    /** rows: [[etiqueta, valor, unidad]]. Solo toca el DOM si algo cambio. */
    update(rows) {
      const key = rows.map((r) => r.join("|")).join("~");
      if (key === lastRows) return;
      lastRows = key;
      live.innerHTML = rows.map(([l, v, u]) => `<dt>${l}</dt><dd><span>${v}</span>${u ? `<small>${u}</small>` : ""}</dd>`).join("");
    },
    hide() {
      if (el.matches(":popover-open")) el.hidePopover();
    },
    focusTitle() {
      title.focus({ preventScroll: true });
    },
  };
}
