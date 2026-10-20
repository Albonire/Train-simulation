// Interfaz. Principios: la escena manda; lo esencial (velocidad, estado, entrehierro,
// progreso del tramo, tiempo) vive en un cuadro de mando compacto abajo; el resto va en
// un panel plegable con pestanas. Lo que requiere lectura (guia y laminas) son paginas
// con su ruta, no dialogos; los atajos, un popover pequeno.

import { History, drawChart } from "./charts.js";
import { ICONS } from "./icons.js";
import { createRouter, routeHref } from "./router.js";
import { ResponseTracker } from "./response.js";
import { renderGuia } from "./pages/guia.js";
import { renderLaminas, clearLaminas } from "./pages/laminas.js";
import { KEYS } from "./info.js";
import { createPartCard } from "./partCard.js";
import { createTourCard } from "./tourCard.js";
import { createLoupe } from "./loupe.js";
import { EDS, G } from "../physics/constants.js";
import { EdsSection } from "../physics/eds.js";
import { MODES } from "../physics/train.js";

const $ = (sel, root = document) => root.querySelector(sel);
const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d).replace(".", ",") : "–");
const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

const STATE = {
  reposo: ["En reposo", "idle"],
  levitando: ["Despegando", "warn"],
  acelerando: ["Acelerando", "ok"],
  crucero: ["Crucero", "ok"],
  frenando: ["Frenando", "warn"],
  estacion: ["En estación", "info"],
};

export const RIGS = [
  ["orbit", "Órbita", "Vista general. Arrastra para girar, rueda para acercar."],
  ["chase", "Seguir", "Cámara que acompaña al tren desde atrás."],
  ["section", "Sección", "Corte transversal: viga, estator, imanes y entrehierro."],
  ["gap", "Imanes", "Primer plano del entrehierro entre imán y estator."],
  ["top", "Arriba", "Vista cenital."],
  ["field", "Campo", "Carrocería transparente y campo magnético realzado."],
];

// [id, etiqueta, unidad, valor]
const ROWS = {
  ems: [
    ["cur", "Corriente del imán", "A", (t) => fmt(t.current, 1)],
    ["freq", "Frecuencia", "Hz", (t) => fmt(t.frequency, 1)],
    ["thr", "Empuje", "kN", (t) => fmt(t.thrust / 1e3, 0)],
    ["ang", "Ángulo de carga", "°", (t) => fmt(t.loadAngleDeg, 0)],
    ["lift", "Sustentación / peso", "kN", (t) => `${fmt(t.liftTotal / 1e3, 0)} / ${fmt(t.weight / 1e3, 0)}`],
    ["aero", "Arrastre aerodinámico", "kN", (t) => fmt(t.dragAero / 1e3, 1)],
    ["pow", "Potencia en red", "MW", (t) => fmt(t.gridPowerMW, 2)],
    ["en", "Energía red / recuperada", "kWh", (t) => `${fmt(t.energyTractionKWh, 0)} / ${fmt(t.energyRegenKWh, 0)}`],
  ],
  eds: [
    ["ind", "Corriente inducida", "%", (t) => fmt(t.induced * 100, 0)],
    ["freq", "Frecuencia", "Hz", (t) => fmt(t.frequency, 1)],
    ["thr", "Empuje", "kN", (t) => fmt(t.thrust / 1e3, 0)],
    ["lift", "Sustentación / peso", "kN", (t) => `${fmt(t.liftTotal / 1e3, 0)} / ${fmt(t.weight / 1e3, 0)}`],
    ["drag", "Arrastre magnético / aire", "kN", (t) => `${fmt(t.dragMag / 1e3, 0)} / ${fmt(t.dragAero / 1e3, 0)}`],
    ["whl", "Ruedas", "", (t) => (t.wheelsDown ? "fuera" : "recogidas")],
    ["pow", "Potencia en red", "MW", (t) => fmt(t.gridPowerMW, 2)],
    ["en", "Energía red / recuperada", "kWh", (t) => `${fmt(t.energyTractionKWh, 0)} / ${fmt(t.energyRegenKWh, 0)}`],
  ],
};

// [id, icono, nombre, efecto en una linea, conmutable]
const PERTURB = {
  ems: [
    ["load", "load", "Carga +12 %", "Más masa en la sección central. El control sube la corriente.", true],
    ["gust", "gust", "Ráfaga", "Empuje lateral del 10 % del peso durante 0,6 s."],
    ["kick", "kick", "Golpe", "Abre el entrehierro 2 mm de golpe."],
    ["ctrlOff", "ctrl", "Sin control", "Corriente fija: sin lazo cerrado cae a los patines en menos de 0,25 s. Púlsalo otra vez para devolverlo.", true],
    ["cutPower", "power", "Sin corriente", "Corta la alimentación 3,5 s: cae a los patines y después vuelve a levitar."],
  ],
  eds: [
    ["load", "load", "Carga +12 %", "Más masa en la sección central. Baja un poco y se estabiliza.", true],
    ["gust", "gust", "Ráfaga", "Empuje lateral del 10 % del peso. Lo devuelven las bobinas en 8."],
    ["kick", "kick", "Golpe", "Sube el vehículo 15 mm: la sustentación cae y vuelve sola."],
  ],
};

const LEGEND = [
  ["var(--n)", "Polo N"],
  ["var(--s)", "Polo S"],
  ["#ffd23f", "Flujo"],
  ["#35e08a", "Sustentación"],
  ["#f2f5f8", "Peso"],
  ["#35d0ff", "Empuje"],
  ["#ffa43a", "Resistencia"],
  ["#ff5fd2", "Lateral"],
];

export function createUI(h) {
  const root = document.createElement("div");
  root.id = "ui";
  root.innerHTML = `
  <header id="topbar">
    <a class="brand" href="${routeHref("sim")}" aria-label="Simulador maglev: ir a la simulación"><span class="logo" aria-hidden="true"><i></i><i></i></span><span>Maglev</span></a>
    <div class="seg" role="group" aria-label="Tecnología">
      <button data-mode="ems" aria-pressed="true" title="Suspensión electromagnética: atracción bajo la vía con control activo">EMS</button>
      <button data-mode="eds" aria-pressed="false" title="Suspensión electrodinámica: repulsión por corrientes inducidas">EDS</button>
    </div>
    <span class="mode-name" id="modeName"></span>
    <button class="btn tour-btn" id="tourBtn" aria-pressed="false" title="Visita guiada: unos pasos cortos que explican qué pasa. Reinicia el viaje (V)">${ICONS.tour}<span>Visita</span></button>
    <nav class="nav" aria-label="Secciones">
      <a href="${routeHref("sim")}" data-page="sim">${ICONS.train}<span>Simulación</span></a>
      <a href="${routeHref("guia")}" data-page="guia" aria-label="Guía">${ICONS.book}<span>Guía</span></a>
      <a href="${routeHref("laminas")}" data-page="laminas" aria-label="Láminas">${ICONS.cube}<span>Láminas</span></a>
    </nav>
    <div class="tools">
      <button class="ib" id="keysBtn" popovertarget="keys" title="Atajos de teclado (?)" aria-label="Atajos de teclado">${ICONS.keys}</button>
      <button class="ib" id="themeBtn" title="Tema claro u oscuro" aria-label="Cambiar tema">${ICONS.moon}</button>
      <button class="ib" id="panelBtn" aria-pressed="true" title="Mostrar u ocultar el panel (H)" aria-label="Panel lateral">${ICONS.panel}</button>
    </div>
  </header>

  <nav id="cams" class="panel" aria-label="Cámaras">
    ${RIGS.map(([id, label, tip], i) => `<button data-rig="${id}" aria-pressed="${id === "orbit"}" title="${tip}">${ICONS[["orbit", "chase", "section", "magnet", "top", "field"][i]]}<span>${label}</span><span class="k" aria-hidden="true">${i + 1}</span></button>`).join("")}
    <div class="rule" role="separator"></div>
    <button class="tool" data-tool="parts" aria-pressed="false" title="Haz clic en una pieza para acercarte y leer qué hace">${ICONS.parts}<span>Piezas</span><span class="k" aria-hidden="true">P</span></button>
    <button class="tool" data-tool="explode" aria-pressed="false" title="Separa las piezas para verlas por dentro">${ICONS.explode}<span>Separar</span><span class="k" aria-hidden="true">E</span></button>
  </nav>

  <aside id="loupe" class="panel" aria-label="Entrehierro en vivo"></aside>

  <p id="hint" role="note"></p>

  <div id="intro" hidden><p id="introCap" role="status"></p><button class="btn" id="introSkip" title="Salta la apertura (cualquier tecla o clic)">Omitir</button></div>

  <section id="hud" class="panel" aria-label="Cuadro de mando">
    <div class="h-speed"><output id="hSpeed">0</output><span>km/h</span></div>
    <div class="h-state"><span class="pill" id="hState" data-k="idle" role="status">En reposo</span><span class="h-sub" id="hTarget"></span></div>
    <div class="h-gap" id="hGapBox">
      <span class="h-lbl" id="hGapLbl">Entrehierro</span>
      <output id="hGap">–</output>
      <div class="bar" id="hGapBar" aria-hidden="true"><i></i><b></b><b></b><b></b></div>
    </div>
    <button class="h-field" id="hField" title="Intensidad del campo magnético. Pulsa para verlo (6)">
      <span class="h-lbl">Campo</span>
      <output id="hFieldV">–</output>
      <div class="bar" id="hFieldBar" aria-hidden="true"><i></i><b></b></div>
    </button>
    <div class="h-trip" title="Progreso hacia la próxima estación">
      <span class="h-lbl"><span id="hFrom">E1</span><span id="hRem">–</span><span id="hTo">E2</span></span>
      <div class="track" aria-hidden="true"><i id="hFill"></i><b id="hDot"></b></div>
    </div>
    <div class="h-time">
      <button class="ib" id="pauseBtn" aria-pressed="false" title="Pausa (Espacio)" aria-label="Pausa">${ICONS.pause}</button>
      <div class="seg sm" id="timeBtns" role="group" aria-label="Velocidad de simulación">
        ${[1, 5, 20, 60].map((t) => `<button data-ts="${t}" aria-pressed="${t === 5}" title="Simula ${t} s por cada segundo real">x${t}</button>`).join("")}
      </div>
    </div>
  </section>

  <aside id="side" class="panel" aria-label="Panel">
    <div class="tabs" role="tablist">
      <button role="tab" data-tab="data" aria-selected="true">${ICONS.data}<span>Datos</span></button>
      <button role="tab" data-tab="ctrl" aria-selected="false">${ICONS.sliders}<span>Control</span></button>
      <button role="tab" data-tab="view" aria-selected="false">${ICONS.view}<span>Vista</span></button>
    </div>

    <div class="tab" data-pane="data">
      <dl class="rows" id="rows"></dl>
      <figure class="chart"><figcaption><span id="capA"></span><span id="valA"></span></figcaption><canvas id="chartA"></canvas></figure>
      <figure class="chart"><figcaption><span id="capB"></span><span id="valB"></span></figcaption><canvas id="chartB"></canvas></figure>
      <figure class="chart"><figcaption><span id="capC"></span><span id="valC"></span></figcaption><canvas id="chartC"></canvas></figure>
    </div>

    <div class="tab" data-pane="ctrl" hidden>
      <label class="field"><span>Velocidad objetivo <output id="targetOut"></output></span>
        <input id="target" type="range" min="0" max="400" step="1" value="400"></label>
      <div class="actions">
        <button class="btn" id="goBtn" title="Salir de la estación ahora">${ICONS.go}<span>Salir</span></button>
        <button class="btn" id="stopBtn" aria-pressed="false" title="Quedarse en la próxima estación">${ICONS.hold}<span>Retener</span></button>
        <button class="btn" id="resetBtn" title="Volver al inicio">${ICONS.reset}<span>Reiniciar</span></button>
      </div>
      <label class="field"><span>Estaciones cada <output id="spacingOut"></output></span>
        <input id="spacing" type="range" min="5" max="120" step="5"></label>
      <h3>Perturbaciones</h3>
      <div class="acts" id="perturb"></div>
      <p class="resp" id="resp" role="status" aria-live="polite"></p>
    </div>

    <div class="tab" data-pane="view" hidden>
      <h3>Carrocería</h3>
      <div class="seg wide" id="bodyBtns" role="group" aria-label="Carrocería">
        <button data-body="auto" aria-pressed="true" title="Según la cámara">Auto</button>
        <button data-body="solid" aria-pressed="false">Sólida</button>
        <button data-body="xray" aria-pressed="false" title="Carrocería translúcida">Rayos X</button>
        <button data-body="cut" aria-pressed="false" title="Media carrocería cortada">Corte</button>
      </div>
      <h3>Entrehierro</h3>
      <label class="field"><span>Exagerar <output id="exagOut"></output></span>
        <input id="exag" type="range" min="1" max="24" step="1" value="8" title="El entrehierro real (10 mm) no se vería a esta escala"></label>
      <h3>Capas</h3>
      <div class="chips" id="layers">
        <button data-layer="fields" aria-pressed="true" title="Líneas de flujo magnético">Flujo</button>
        <button data-layer="wave" aria-pressed="true" title="Onda del estator: rojo N, azul S">Onda</button>
        <button data-layer="forces" aria-pressed="false" title="Flechas de fuerza (escala de raíz cuadrada)">Fuerzas</button>
        <button data-layer="labels" aria-pressed="true" title="Nombres de las piezas en las vistas de detalle">Nombres</button>
      </div>
      <h3>Apertura</h3>
      <button class="btn" id="introBtn" title="Vuelve a ver el primer plano de la levitación. Reinicia el viaje (I)">Repetir la apertura</button>
      <h3>Colores</h3>
      <ul class="legend">${LEGEND.map(([c, l]) => `<li><i style="background:${c}"></i>${l}</li>`).join("")}</ul>
    </div>
  </aside>

  <div id="labels"></div>
  <div id="toast" role="status" aria-live="polite"></div>

  <div id="keys" popover>
    <h2>Atajos</h2>
    <dl>${KEYS.map(([ks, what]) => `<dt>${ks.map((k) => `<kbd>${k}</kbd>`).join(" a ")}</dt><dd>${what}</dd>`).join("")}</dl>
  </div>
  <main id="page" hidden></main>
  `;
  document.body.appendChild(root);
  const card = createPartCard(root, { onPrev: () => h.partStep(-1), onNext: () => h.partStep(1), onClose: () => h.partClose() });
  const tourCard = createTourCard(root, { onPrev: () => h.tourStep(-1), onNext: () => h.tourStep(1), onClose: () => h.tourEnd() });

  const loupe = createLoupe($("#loupe"), { setRig: (n) => h.setRig(n), toast: (m) => toast(m) });

  const els = {
    rows: $("#rows"), hSpeed: $("#hSpeed"), hState: $("#hState"), hTarget: $("#hTarget"), hGap: $("#hGap"),
    hGapLbl: $("#hGapLbl"), hGapBar: $("#hGapBar"), hFrom: $("#hFrom"), hTo: $("#hTo"), hRem: $("#hRem"),
    hFill: $("#hFill"), hDot: $("#hDot"), hFieldV: $("#hFieldV"), hFieldBar: $("#hFieldBar"),
    target: $("#target"), targetOut: $("#targetOut"), spacing: $("#spacing"), spacingOut: $("#spacingOut"),
    exag: $("#exag"), exagOut: $("#exagOut"), perturb: $("#perturb"),
    cams: $("#cams"), toast: $("#toast"), labels: $("#labels"), side: $("#side"), resp: $("#resp"),
    cA: $("#chartA"), cB: $("#chartB"), cC: $("#chartC"),
    capA: $("#capA"), capB: $("#capB"), capC: $("#capC"), valA: $("#valA"), valB: $("#valB"), valC: $("#valC"),
  };

  let mode = "ems";
  const tracker = new ResponseTracker();
  let lastTrain = null;
  let rowEls = {};
  let tab = "data";
  const hist = new History(6000, 0.02);
  let legTrace = { xs: [], ys: [] };
  let lastLeg = -1;

  // ---- construccion por modo ----
  function build(modeId) {
    mode = modeId;
    document.documentElement.dataset.mode = modeId;
    loupe.reset();
    $("#modeName").textContent = modeId === "ems" ? "Transrapid" : "SCMaglev";
    const m = MODES[modeId];
    for (const b of root.querySelectorAll("[data-mode]")) b.setAttribute("aria-pressed", String(b.dataset.mode === modeId));
    els.rows.innerHTML = ROWS[modeId].map(([id, label, unit]) => `<dt>${label}</dt><dd><span data-r="${id}">–</span><small>${unit}</small></dd>`).join("");
    rowEls = {};
    for (const [id] of ROWS[modeId]) rowEls[id] = $(`[data-r="${id}"]`, els.rows);
    els.hGapLbl.textContent = modeId === "ems" ? "Entrehierro" : "Elevación";
    $("#hGapBox").title = modeId === "ems"
      ? "Entrehierro de la sección central: el hueco entre el imán y la vía. Los tres puntos de la barra son las tres secciones; la zona verde es la nominal."
      : "Elevación de la sección central sobre la losa. Los tres puntos de la barra son las tres secciones; la zona verde es la nominal.";
    const vmax = Math.round(m.vMax * 3.6);
    els.target.max = String(vmax);
    els.target.value = String(vmax);
    els.spacing.value = String(Math.round(m.stationSpacing / 1000));
    els.perturb.innerHTML = PERTURB[modeId]
      .map(([id, ic, label, effect, toggle]) => `<button class="act" data-p="${id}" ${toggle ? 'aria-pressed="false"' : ""}>${ICONS[ic]}<span><b>${label}</b><small>${effect}</small></span></button>`)
      .join("");
    els.resp.textContent = "";
    tracker.cancel();
    refreshPage();
    $("[data-layer=wave]").title = modeId === "ems" ? "Onda del estator: rojo N, azul S" : "Corrientes en las bobinas de la vía";
    if (modeId === "ems") {
      els.capA.textContent = "Entrehierro, mm";
      els.capB.textContent = "Corrientes del estator";
    } else {
      els.capA.innerHTML = `<i class="dot" style="background:#35e08a"></i>sustentación <i class="dot" style="background:#ffa43a"></i>arrastre, kN`;
      els.capB.textContent = "Corrientes de propulsión";
    }
    els.capC.textContent = "Velocidad en el tramo";
    hist.clear();
    legTrace = { xs: [], ys: [] };
    lastLeg = -1;
    setOutputs();
  }

  // La camara de detalle y la apertura fijan su propia exageracion: el deslizador lo dice y se desactiva,
  // en vez de mostrar un valor que no es el que se esta dibujando.
  let exagForced = null; // null, o la exageracion que se dibuja mientras la fija la vista
  function setOutputs() {
    els.exagOut.textContent = exagForced ? `×${exagForced} · la fija la cámara` : "×" + els.exag.value;
    els.exag.disabled = !!exagForced;
    els.targetOut.textContent = els.target.value + " km/h";
    els.spacingOut.textContent = els.spacing.value + " km";
  }
  /** value: la exageracion que se dibuja; forced: true si no es la del usuario. */
  function setExagState(value, forced) {
    const next = forced ? value : null;
    if (next === exagForced) return;
    exagForced = next;
    setOutputs();
  }

  /**
   * "Reiniciar": el viaje vuelve al principio y los controles que lo gobiernan tambien (velocidad
   * objetivo, distancia entre estaciones, perturbaciones y la respuesta que se estaba midiendo).
   * La vista (camara, capas, escala de tiempo, exageracion) es del usuario y no se toca.
   */
  function resetControls() {
    const m = MODES[mode];
    els.target.value = String(Math.round(m.vMax * 3.6));
    els.spacing.value = String(Math.round(m.stationSpacing / 1000));
    for (const b of els.perturb.querySelectorAll("[aria-pressed]")) b.setAttribute("aria-pressed", "false");
    $("#stopBtn").setAttribute("aria-pressed", "false");
    els.resp.textContent = "";
    tracker.cancel();
    hist.clear();
    legTrace = { xs: [], ys: [] };
    lastLeg = -1;
    loupe.reset();
    setOutputs();
  }

  function selectTab(name) {
    tab = name;
    for (const b of root.querySelectorAll("[data-tab]")) b.setAttribute("aria-selected", String(b.dataset.tab === name));
    for (const p of root.querySelectorAll("[data-pane]")) p.hidden = p.dataset.pane !== name;
  }

  const press = (sel, on) => sel.setAttribute("aria-pressed", String(on));
  function setPanel(open) {
    els.side.classList.toggle("closed", !open);
    press($("#panelBtn"), open);
    try { localStorage.setItem("maglev-panel", open ? "1" : "0"); } catch {}
  }
  const setTourActive = (on) => press($("#tourBtn"), on);
  /** Las capas las cambia la visita sin pasar por las fichas: se dejan al dia. */
  function syncLayers(layers) {
    for (const b of root.querySelectorAll("[data-layer]")) press(b, !!layers[b.dataset.layer]);
  }
  function setPaused(on) {
    const b = $("#pauseBtn");
    press(b, on);
    b.innerHTML = on ? ICONS.play : ICONS.pause;
    b.title = on ? "Reanudar (Espacio)" : "Pausa (Espacio)";
    h.setPaused(on);
  }
  function setTimeScale(ts) {
    for (const x of root.querySelectorAll("[data-ts]")) press(x, Number(x.dataset.ts) === ts);
    h.setTimeScale(ts);
  }

  // ---- eventos ----
  root.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.mode) return h.setMode(b.dataset.mode);
    if (b.dataset.rig) return h.setRig(b.dataset.rig);
    if (b.dataset.ts) return setTimeScale(Number(b.dataset.ts));
    if (b.dataset.tab) return selectTab(b.dataset.tab);
    if (b.dataset.body) {
      for (const x of $("#bodyBtns").children) press(x, x === b);
      return h.setBody(b.dataset.body);
    }
    if (b.dataset.layer) {
      const on = b.getAttribute("aria-pressed") !== "true";
      press(b, on);
      return h.setLayer(b.dataset.layer, on);
    }
    if (b.dataset.p) return perturbClick(b);
    if (b.dataset.tool === "parts") return h.setParts(b.getAttribute("aria-pressed") !== "true");
    if (b.dataset.tool === "explode") return h.setExplode(b.getAttribute("aria-pressed") !== "true");
    if (b.id === "hField") return h.setRig("field");
    switch (b.id) {
      case "pauseBtn": return setPaused(b.getAttribute("aria-pressed") !== "true");
      case "goBtn": return h.depart();
      case "stopBtn": {
        const on = b.getAttribute("aria-pressed") !== "true";
        press(b, on);
        return h.setHold(on);
      }
      case "resetBtn": return h.reset();
      case "introBtn": return h.replayIntro?.();
      case "tourBtn": return h.tourToggle?.();
      case "themeBtn": return toggleTheme();
      case "panelBtn": return setPanel(els.side.classList.contains("closed"));
    }
  });
  root.addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "target") h.setTarget(Number(t.value));
    if (t.id === "exag") h.setExag(Number(t.value));
    if (t.id === "spacing") h.setSpacing(Number(t.value) * 1000);
    setOutputs();
  });

  // atajos de teclado (no actuan mientras se escribe en un control)
  const keysPop = $("#keys");
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      // un popover abierto se cierra solo; despues la tarjeta de pieza; si no, se vuelve a la simulacion
      if (keysPop.matches?.(":popover-open")) return;
      if (view.page === "sim" && (h.tourEsc?.() || h.partEsc())) return;
      if (view.page !== "sim") router.go("sim");
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "?") { keysPop.togglePopover?.(); return; }
    if (view.page !== "sim") return;
    const n = Number(e.key);
    if (n >= 1 && n <= RIGS.length) { h.setRig(RIGS[n - 1][0]); return; }
    if (e.key === " " && tag !== "BUTTON") { e.preventDefault(); setPaused($("#pauseBtn").getAttribute("aria-pressed") !== "true"); return; }
    if (e.key === "h" || e.key === "H") return setPanel(els.side.classList.contains("closed"));
    if (e.key === "l" || e.key === "L") return loupe.toggle();
    if (e.key === "i" || e.key === "I") return h.replayIntro?.();
    if (e.key === "v" || e.key === "V") return h.tourToggle?.();
    if (document.body.dataset.tour === "on" && document.body.dataset.parts !== "on" && (e.key === "ArrowRight" || e.key === "ArrowLeft") && tag !== "BUTTON") {
      e.preventDefault();
      return h.tourStep(e.key === "ArrowRight" ? 1 : -1);
    }
    if (e.key === "p" || e.key === "P") return h.setParts(document.querySelector('[data-tool="parts"]').getAttribute("aria-pressed") !== "true");
    if (e.key === "e" || e.key === "E") return h.setExplode(document.querySelector('[data-tool="explode"]').getAttribute("aria-pressed") !== "true");
    if (document.body.dataset.parts === "on" && (e.key === "ArrowRight" || e.key === "ArrowLeft") && tag !== "BUTTON") {
      e.preventDefault();
      return h.partStep(e.key === "ArrowRight" ? 1 : -1);
    }
  });

  // ---- paginas ----
  const view = { page: "sim", arg: "" };
  const pageEl = $("#page");
  const isLight = () => document.documentElement.dataset.theme === "light";
  function renderPage() {
    if (view.page === "guia") {
      renderGuia(pageEl, { mode, arg: view.arg, setMode: (m) => h.setMode(m) });
    } else if (view.page === "laminas") {
      renderLaminas(pageEl, { arg: view.arg, theme: isLight() ? "light" : "dark", mode });
    }
  }
  function refreshPage() {
    if (view.page !== "sim") renderPage();
  }
  function showPage({ page, arg }) {
    const prev = view.page;
    const same = prev === page;
    view.page = page;
    view.arg = arg;
    document.body.dataset.view = page;
    keysPop.hidePopover?.();
    if (page !== "sim") h.partClose();
    for (const a of root.querySelectorAll("[data-page]")) {
      if (a.dataset.page === page) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
    if (page === "sim") {
      if (prev === "laminas") clearLaminas(pageEl);
      pageEl.hidden = true;
      pageEl.innerHTML = "";
      pageEl.onscroll = null;
      return;
    }
    pageEl.hidden = false;
    // misma pagina y solo cambia la seccion: no se vuelve a construir
    if (same && page === "guia" && pageEl.firstChild) {
      const t = arg && pageEl.querySelector(`#sec-${CSS.escape(arg)}`);
      if (t) t.scrollIntoView({ block: "start" });
      else pageEl.scrollTop = 0;
      return;
    }
    if (prev === "laminas") clearLaminas(pageEl);
    renderPage();
    if (page === "guia") $("#guiaTitulo")?.focus({ preventScroll: true });
  }
  const router = createRouter(showPage);

  // ---- tema ----
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    $("#themeBtn").innerHTML = t === "light" ? ICONS.moon : ICONS.sun;
    h.setTheme?.(t);
  }
  function toggleTheme() {
    const next = isLight() ? "dark" : "light";
    applyTheme(next);
    try { localStorage.setItem("maglev-theme", next); } catch {}
    if (view.page === "laminas") renderPage();
  }

  let toastTimer = 0;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2600);
  }

  // ---- perturbaciones: el efecto se mide y se muestra en el panel ----
  function perturbClick(b) {
    const d = h.perturb(b.dataset.p, b);
    if (!d) {
      tracker.cancel();
      els.resp.textContent = "";
      return;
    }
    activeResp = d;
    els.resp.textContent = "Midiendo la respuesta...";
    selectTab("ctrl");
    tracker.start({ label: d.label, ref: d.ref, tol: d.tol, t: lastTrain ? lastTrain.time : 0, maxTime: d.maxTime });
    // la perturbacion ya esta aplicada: este primer valor recoge el desvio instantaneo
    if (lastTrain) pushResponse(lastTrain);
  }
  function pushResponse(train) {
    if (!tracker.active) return;
    const r = tracker.push(train.time, activeResp.get(train));
    if (r) showResponse(r, activeResp);
  }
  /** Se llama tras cada paso de simulacion (cada 20 ms de tiempo simulado, a cualquier escala). */
  function sample(train) {
    lastTrain = train;
    pushResponse(train);
  }
  function showResponse(r, d) {
    const peak = `${fmt(r.peak, d.digits ?? 1)} ${d.unit}`;
    els.resp.textContent = r.settled
      ? `${r.label}: desvío máximo ${peak}, vuelve a su valor en ${fmt(r.settle, 2)} s.`
      : `${r.label}: desvío máximo ${peak}, no vuelve a su valor en ${d.maxTime} s.`;
  }
  let activeResp = null;

  // ---- pistas de primera visita: tres, una tras otra; cualquier gesto las cierra ----
  let startHint = () => {};
  (function hint() {
    const el = $("#hint");
    let seen = false;
    try { seen = localStorage.getItem("maglev-hint") === "2"; } catch {}
    if (seen) return el.remove();
    const coarse = window.matchMedia?.("(pointer: coarse)").matches;
    const tips = coarse
      ? ["Arrastra para girar, pellizca para acercar, doble toque para recentrar"]
      : [
          "Abajo a la izquierda, el corte en vivo de la levitación",
          "Arrastra para girar, rueda para acercar, 1 a 6 cambian de cámara",
          "P elige una pieza para leer qué hace; E las separa",
        ];
    let i = 0;
    let timer = 0;
    const show = () => {
      el.textContent = tips[i];
      el.classList.remove("gone");
      timer = setTimeout(() => {
        if (++i >= tips.length) return done();
        el.classList.add("gone");
        timer = setTimeout(show, 450);
      }, 5200);
    };
    const done = () => {
      clearTimeout(timer);
      el.classList.add("gone");
      setTimeout(() => el.remove(), 500);
      try { localStorage.setItem("maglev-hint", "2"); } catch {}
      window.removeEventListener("pointerdown", done);
      window.removeEventListener("keydown", done);
      window.removeEventListener("wheel", done);
    };
    // las pistas empiezan cuando termina la apertura (o ya, si no hay apertura)
    let started = false;
    startHint = () => {
      if (started) return;
      started = true;
      show();
      window.addEventListener("pointerdown", done);
      window.addEventListener("keydown", done);
      window.addEventListener("wheel", done, { passive: true });
    };
  })();

  // ---- actualizacion por cuadro ----
  let lastText = 0;
  const edsRef = new EdsSection();
  function update(tel, train, simView) {
    loupe.update(mode, tel, train, simView, false);
    lastTrain = train;
    const vals = { speed: tel.speedKmh };
    train.sections.forEach((s, i) => (vals["g" + i] = s.gapMm));
    hist.push(tel.time, vals);

    const leg = Math.round(tel.nextStation / train.stationSpacing);
    if (leg !== lastLeg) {
      lastLeg = leg;
      legTrace = { xs: [], ys: [] };
    }
    const prevX = (leg - 1) * train.stationSpacing;
    const dx = (tel.x - prevX) / 1000;
    const lastPoint = legTrace.xs[legTrace.xs.length - 1];
    if (lastPoint === undefined || dx - lastPoint > train.stationSpacing / 1000 / 400) {
      legTrace.xs.push(dx);
      legTrace.ys.push(tel.speedKmh);
    }

    const now = performance.now();
    if (now - lastText > 80) {
      lastText = now;
      // cuadro de mando
      els.hSpeed.textContent = fmt(tel.speedKmh, 0);
      let [label, kind] = STATE[tel.state] ?? [tel.state, "idle"];
      if (tel.state === "levitando" && mode === "eds") label = "Preparado";
      if (train.sections.some((s) => s.fallen)) [label, kind] = ["Sobre patines", "bad"];
      if (train.sections.some((s) => s.contact)) [label, kind] = ["Pegado al riel", "bad"];
      els.hState.textContent = label;
      els.hState.dataset.k = kind;
      els.hTarget.textContent = train.hold ? "retenido" : `objetivo ${Math.round(train.targetSpeed * 3.6)} km/h`;
      els.hGap.textContent = fmt(tel.gapMm, mode === "ems" ? 1 : 0) + " mm";
      const range = mode === "ems" ? [0, 22] : [80, 102];
      const pos = (v) => `${(Math.min(1, Math.max(0, (v - range[0]) / (range[1] - range[0]))) * 100).toFixed(1)}%`;
      const bar = els.hGapBar;
      const [z0, z1] = mode === "ems" ? [9.5, 10.5] : [EDS.gapWheels * 1000 + 8, EDS.gapCruise * 1000];
      bar.children[0].style.left = pos(z0);
      bar.children[0].style.width = `calc(${pos(z1)} - ${pos(z0)})`;
      train.sections.forEach((s, i) => {
        if (bar.children[i + 1]) bar.children[i + 1].style.left = pos(s.gapMm);
      });
      // indicador de campo: EMS I/g relativo al nominal (zona 95 a 105 %), EDS corriente inducida
      const lvl = simView.fieldLevel ?? 0;
      els.hFieldV.textContent = `${fmt(lvl * 100, 0)} %`;
      const fr = mode === "ems" ? [0, 2] : [0, 1];
      const fp = (v) => `${(Math.min(1, Math.max(0, (v - fr[0]) / (fr[1] - fr[0]))) * 100).toFixed(1)}%`;
      const fb = els.hFieldBar;
      fb.children[0].style.left = "0";
      fb.children[0].style.width = fp(lvl);
      fb.children[1].style.left = mode === "ems" ? fp(1) : fp(lvl);
      const frac = Math.min(1, Math.max(0, 1 - tel.remaining / train.stationSpacing));
      els.hFill.style.width = `${(frac * 100).toFixed(1)}%`;
      els.hDot.style.left = `${(frac * 100).toFixed(1)}%`;
      els.hFrom.textContent = `E${leg}`;
      els.hTo.textContent = `E${leg + 1}`;
      els.hRem.textContent = `${fmt(Math.max(0, tel.remaining) / 1000, tel.remaining < 10e3 ? 1 : 0)} km`;
      // panel de datos (solo si esta visible)
      if (tab === "data" && !els.side.classList.contains("closed")) {
        for (const [id, , , f] of ROWS[mode]) rowEls[id].textContent = f(tel);
      }
    }
    if (tab === "data" && !els.side.classList.contains("closed")) drawCharts(tel, train, simView);
  }

  function drawCharts(tel, train, simView) {
    const W = Math.min(120, Math.max(10, 10 * simView.timeScale));
    const idx = hist.range(W, 240);
    const tEnd = idx.length ? hist.t[idx[idx.length - 1]] : 0;
    const xs = idx.map((i) => hist.t[i] - tEnd);
    const colors = [cssVar("--series-1"), cssVar("--series-2"), cssVar("--series-3")];
    if (mode === "ems") {
      const series = train.sections.map((_, k) => ({ xs, ys: idx.map((i) => hist.cols["g" + k][i]), color: colors[k % 3] }));
      drawChart(els.cA, {
        x: [-W, 0], y: [0, 22], series, xFmt: (v) => v.toFixed(0) + " s", yFmt: (v) => v.toFixed(0),
        bands: [{ y0: 9.5, y1: 10.5, color: "rgba(92,207,138,0.22)" }],
        refs: [{ y: 20, color: cssVar("--bad") }, { y: 3, color: cssVar("--bad") }],
      });
      els.valA.textContent = `${W.toFixed(0)} s`;
    } else {
      const vmaxK = Math.round(EDS.recordSpeed * 3.6);
      const n = 60;
      const kx = [], lift = [], drag = [];
      const W0 = edsRef.mass * G * train.sections.length;
      for (let i = 0; i <= n; i++) {
        const v = (i / n) * EDS.recordSpeed;
        kx.push(v * 3.6);
        const g = Math.max(edsRef.equilibriumGap(Math.max(v, 0.1)), EDS.gapWheels);
        lift.push(Math.min(edsRef.liftAt(v, g) * train.sections.length, W0 * 1.05) / 1e3);
        drag.push((edsRef.dragAt(v, g) * train.sections.length) / 1e3);
      }
      drawChart(els.cA, {
        x: [0, vmaxK], y: [0, Math.ceil((W0 * 1.1) / 1e5) * 100],
        series: [{ xs: kx, ys: lift, color: "#35e08a" }, { xs: kx, ys: drag, color: "#ffa43a" }],
        refs: [{ y: W0 / 1e3, color: cssVar("--muted"), label: "peso" }],
        marker: { x: tel.speedKmh, y: tel.liftTotal / 1e3, color: "#35e08a" },
        xFmt: (v) => v.toFixed(0) + " km/h", yFmt: (v) => v.toFixed(0),
      });
      els.valA.textContent = "";
    }
    // trifasica: tres ciclos a la frecuencia real
    const f = tel.frequency;
    const N = 120;
    const xs2 = [], u = [], v = [], w = [];
    const TWO = Math.PI * 2;
    const amp = Math.min(1, 0.3 + 0.9 * Math.abs(train.thrust) / Math.max(1, train.fMaxAt(0)));
    for (let i = 0; i <= N; i++) {
      const ph = (i / N) * 3 * TWO;
      xs2.push((i / N) * 3);
      u.push(amp * Math.sin(ph - tel.theta));
      v.push(amp * Math.sin(ph - tel.theta - TWO / 3));
      w.push(amp * Math.sin(ph - tel.theta + TWO / 3));
    }
    const moving = f > 0.3 && train.v > 0.5;
    drawChart(els.cB, {
      x: [0, 3], y: [-1.1, 1.1],
      series: moving ? [{ xs: xs2, ys: u, color: "#ffb000" }, { xs: xs2, ys: v, color: "#19c37d" }, { xs: xs2, ys: w, color: "#b45cff" }] : [],
      xFmt: () => "", yFmt: () => "",
      refs: [{ y: 0, color: cssVar("--line-strong"), dash: [] }],
    });
    els.valB.textContent = moving ? `${fmt(f, 0)} Hz` : "detenido";
    drawChart(els.cC, {
      x: [0, train.stationSpacing / 1000],
      y: [0, Math.ceil((MODES[mode].vMax * 3.6) / 100) * 100],
      series: [{ xs: legTrace.xs, ys: legTrace.ys, color: cssVar("--accent"), width: 2 }],
      marker: legTrace.xs.length ? { x: legTrace.xs[legTrace.xs.length - 1], y: tel.speedKmh, color: cssVar("--text") } : null,
      xFmt: (q) => q.toFixed(0) + " km", yFmt: (q) => q.toFixed(0),
    });
    els.valC.textContent = "";
  }

  // ---- arranque ----
  build("ems");
  try {
    const saved = localStorage.getItem("maglev-theme");
    applyTheme(saved ?? (window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark"));
    const panel = localStorage.getItem("maglev-panel");
    setPanel(panel === null ? window.innerWidth > 900 : panel === "1");
  } catch {
    applyTheme("dark");
  }

  document.body.dataset.view = "sim";
  router.start();
  return { root, els, card, loupe, startHint: () => startHint(), build, update, sample, toast, hist, setTimeScale, setPaused, setOutputs, resetControls, setExagState, tour: tourCard, setTourActive, syncLayers, router, view };
}
