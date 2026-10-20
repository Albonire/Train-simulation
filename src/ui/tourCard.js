// Tarjeta de la visita guiada: titulo, un texto corto y el avance. Es un popover manual, como la
// tarjeta de pieza (capa superior del navegador, sin fondo oscuro ni bloqueo): la escena sigue
// manejable y se puede girar la camara con la tarjeta abierta. Esc la cierra.

import { ICONS } from "./icons.js";

export function createTourCard(parent, { onPrev, onNext, onClose }) {
  const el = document.createElement("div");
  el.id = "tourCard";
  el.setAttribute("popover", "manual");
  el.setAttribute("role", "region");
  el.setAttribute("aria-labelledby", "tcTitle");
  el.innerHTML = `
    <div class="tc-head">
      <span id="tcCount" aria-live="polite"></span>
      <button class="ib" data-tc="close" aria-label="Salir de la visita (Esc)" title="Salir (Esc)">${ICONS.close}</button>
    </div>
    <h2 id="tcTitle" tabindex="-1"></h2>
    <p id="tcText"></p>
    <div class="tc-nav">
      <button class="btn" data-tc="prev" aria-label="Paso anterior">${ICONS.prev}<span>Atrás</span></button>
      <span class="tc-dots" aria-hidden="true"></span>
      <button class="btn" data-tc="next" aria-label="Paso siguiente"><span id="tcNext">Siguiente</span>${ICONS.next}</button>
    </div>`;
  parent.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const title = $("#tcTitle"), text = $("#tcText"), count = $("#tcCount"), dots = $(".tc-dots"), next = $("#tcNext"), prev = $('[data-tc="prev"]');

  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tc]");
    if (!b) return;
    if (b.dataset.tc === "prev") onPrev();
    else if (b.dataset.tc === "next") onNext();
    else onClose();
  });

  return {
    el,
    get open() {
      return el.matches(":popover-open");
    },
    /** step: { title, text }; index y total: posicion en la visita. */
    show(step, index, total) {
      title.textContent = step.title;
      text.textContent = step.text;
      count.textContent = `${index + 1} de ${total}`;
      next.textContent = index >= total - 1 ? "Terminar" : "Siguiente";
      prev.disabled = index <= 0;
      if (dots.childElementCount !== total) dots.innerHTML = "<i></i>".repeat(total);
      [...dots.children].forEach((d, i) => d.classList.toggle("on", i === index));
      if (!el.matches(":popover-open")) el.showPopover();
    },
    hide() {
      if (el.matches(":popover-open")) el.hidePopover();
    },
    focusTitle() {
      title.focus({ preventScroll: true });
    },
  };
}
