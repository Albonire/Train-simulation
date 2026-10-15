// Interfaz. Principios: la escena manda; lo esencial (velocidad, estado, entrehierro,
// progreso del tramo, tiempo) vive en un cuadro de mando compacto abajo; el resto va en
// un panel plegable con pestanas. Las explicaciones largas van en informacion emergente
// (title) o en "Como funciona", nunca como parrafos fijos en pantalla.

import { History, drawChart } from "./charts.js";
import { INFO_HTML } from "./info.js";
import { ICONS } from "./icons.js";
import { EDS, G } from "../physics/constants.js";
import { EdsSection } from "../physics/eds.js";
import { MODES } from "../physics/train.js";

const $ = (sel, root = document) => root.querySelector(sel);
const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : "–");

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

const PERTURB = {
  ems: [
    ["load", "load", "Carga +12 %", "Añade un 12 % de masa a la sección central. El control sube la corriente y recupera los 10 mm.", true],
    ["gust", "gust", "Ráfaga", "Empuje lateral del 10 % del peso durante 0,6 s. Lo corrigen los imanes de guiado."],
    ["kick", "kick", "Golpe", "Abre el entrehierro 2 mm de golpe."],
    ["ctrlOff", "ctrl", "Sin control", "Deja la corriente fija: el equilibrio es inestable y el imán se pega o cae en menos de un cuarto de segundo.", true],
    ["cutPower", "power", "Sin corriente", "Corta la alimentación: el tren cae a los patines y vuelve a levitar a los pocos segundos."],
  ],
  eds: [
    ["load", "load", "Carga +12 %", "Añade un 12 % de masa a la sección central. Baja un poco y se estabiliza sola.", true],
    ["gust", "gust", "Ráfaga", "Empuje lateral del 10 % del peso. Lo devuelven las bobinas en 8 de las paredes."],
    ["kick", "kick", "Golpe", "Sube el vehículo 15 mm de golpe: la sustentación cae y vuelve a su altura sin control."],
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
    <div class="brand panel"><span class="logo" aria-hidden="true"></span><span>Maglev</span>
      <div class="seg" role="group" aria-label="Tecnología">
        <button data-mode="ems" aria-pressed="true" title="Suspensión electromagnética (Transrapid): atracción bajo la vía con control activo">EMS</button>
        <button data-mode="eds" aria-pressed="false" title="Suspensión electrodinámica (SCMaglev): repulsión por corrientes inducidas">EDS</button>
      </div>
    </div>
    <div class="tools panel">
      <button class="ib" id="figBtn" title="Láminas explicativas">${ICONS.book}<span>Láminas</span></button>
      <button class="ib" id="infoBtn" title="Cómo funciona (?)">${ICONS.help}</button>
      <button class="ib" id="themeBtn" title="Tema claro u oscuro">${ICONS.moon}</button>
      <button class="ib" id="panelBtn" aria-pressed="true" title="Mostrar u ocultar el panel (H)">${ICONS.panel}</button>
    </div>
  </header>

  <nav id="cams" class="panel" aria-label="Cámaras">
    ${RIGS.map(([id, label, tip], i) => `<button data-rig="${id}" aria-pressed="${id === "orbit"}" title="${tip} (${i + 1})">${ICONS[["orbit", "chase", "section", "magnet", "top"][i]]}<span>${label}</span><kbd>${i + 1}</kbd></button>`).join("")}
  </nav>

  <section id="hud" class="panel" aria-label="Cuadro de mando">
    <div class="h-speed"><output id="hSpeed">0</output><span>km/h</span></div>
    <div class="h-state"><span class="pill" id="hState" data-k="idle">En reposo</span><span class="h-sub" id="hTarget"></span></div>
    <div class="h-gap" title="Entrehierro de cada sección. La zona verde es la nominal.">
      <span class="h-lbl" id="hGapLbl">Entrehierro</span>
      <output id="hGap">–</output>
      <div class="bar" id="hGapBar" aria-hidden="true"><i></i><b></b><b></b><b></b></div>
    </div>
    <div class="h-trip" title="Progreso hacia la próxima estación">
      <span class="h-lbl"><span id="hFrom">E1</span><span id="hRem">–</span><span id="hTo">E2</span></span>
      <div class="track" aria-hidden="true"><i id="hFill"></i><b id="hDot"></b></div>
    </div>
    <div class="h-time">
      <button class="ib" id="pauseBtn" aria-pressed="false" title="Pausa (Espacio)">${ICONS.pause}</button>
      <div class="seg sm" id="timeBtns" role="group" aria-label="Escala de tiempo">
        ${[1, 5, 20, 60].map((t) => `<button data-ts="${t}" aria-pressed="${t === 5}" title="Tiempo x${t}">x${t}</button>`).join("")}
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
      <div class="grid2" id="perturb"></div>
    </div>

    <div class="tab" data-pane="view" hidden>
      <h3>Carrocería</h3>
      <div class="seg wide" id="bodyBtns" role="group" aria-label="Carrocería">
        <button data-body="auto" aria-pressed="true" title="Según la cámara">Auto</button>
        <button data-body="solid" aria-pressed="false">Sólida</button>
        <button data-body="xray" aria-pressed="false" title="Carrocería translúcida">Rayos X</button>
        <button data-body="cut" aria-pressed="false" title="Media carrocería cortada">Corte</button>
      </div>
      <label class="field"><span>Exagerar entrehierro <output id="exagOut"></output></span>
        <input id="exag" type="range" min="1" max="24" step="1" value="8" title="El entrehierro real (10 mm) no se vería a esta escala"></label>
      <h3>Capas</h3>
      <div class="chips" id="layers">
        <button data-layer="fields" aria-pressed="true" title="Líneas de flujo magnético">Flujo</button>
        <button data-layer="wave" aria-pressed="true" title="Onda del estator: rojo N, azul S">Onda</button>
        <button data-layer="forces" aria-pressed="true" title="Flechas de fuerza (escala de raíz cuadrada)">Fuerzas</button>
        <button data-layer="labels" aria-pressed="true" title="Nombres de las piezas en las vistas de detalle">Nombres</button>
      </div>
      <h3>Colores</h3>
      <ul class="legend">${LEGEND.map(([c, l]) => `<li><i style="background:${c}"></i>${l}</li>`).join("")}</ul>
    </div>
  </aside>

  <div id="labels"></div>
  <div id="toast" role="status" aria-live="polite"></div>

  <div id="gallery" class="overlay" role="dialog" aria-modal="true" aria-label="Láminas"><div class="card">
    <div class="gbar"><div class="seg" role="group" aria-label="Lámina" id="gTabs">
      <button data-fig="ems-levitacion" aria-pressed="true">Levitación EMS</button>
      <button data-fig="lsm-sincrono" aria-pressed="false">Motor lineal</button>
      <button data-fig="eds-sustentacion" aria-pressed="false">Levitación EDS</button></div>
      <button class="ib" id="gClose" title="Cerrar (Esc)">${ICONS.close}</button></div>
    <iframe id="gFrame" title="Lámina explicativa"></iframe>
  </div></div>
  <div id="modal" class="overlay" role="dialog" aria-modal="true" aria-labelledby="mTitle"><div class="card">
    <button class="ib x" id="mClose" title="Cerrar (Esc)">${ICONS.close}</button><div id="mBody"></div></div></div>
  `;
  document.body.appendChild(root);

  const els = {
    rows: $("#rows"), hSpeed: $("#hSpeed"), hState: $("#hState"), hTarget: $("#hTarget"), hGap: $("#hGap"),
    hGapLbl: $("#hGapLbl"), hGapBar: $("#hGapBar"), hFrom: $("#hFrom"), hTo: $("#hTo"), hRem: $("#hRem"),
    hFill: $("#hFill"), hDot: $("#hDot"),
    target: $("#target"), targetOut: $("#targetOut"), spacing: $("#spacing"), spacingOut: $("#spacingOut"),
    exag: $("#exag"), exagOut: $("#exagOut"), perturb: $("#perturb"),
    cams: $("#cams"), toast: $("#toast"), modal: $("#modal"), labels: $("#labels"), side: $("#side"),
    cA: $("#chartA"), cB: $("#chartB"), cC: $("#chartC"),
    capA: $("#capA"), capB: $("#capB"), capC: $("#capC"), valA: $("#valA"), valB: $("#valB"), valC: $("#valC"),
  };

  let mode = "ems";
  let rowEls = {};
  let tab = "data";
  const hist = new History(6000, 0.02);
  let legTrace = { xs: [], ys: [] };
  let lastLeg = -1;

  // ---- construccion por modo ----
  function build(modeId) {
    mode = modeId;
    const m = MODES[modeId];
    for (const b of root.querySelectorAll("[data-mode]")) b.setAttribute("aria-pressed", String(b.dataset.mode === modeId));
    els.rows.innerHTML = ROWS[modeId].map(([id, label, unit]) => `<dt>${label}</dt><dd><span data-r="${id}">–</span><small>${unit}</small></dd>`).join("");
    rowEls = {};
    for (const [id] of ROWS[modeId]) rowEls[id] = $(`[data-r="${id}"]`, els.rows);
    els.hGapLbl.textContent = modeId === "ems" ? "Entrehierro" : "Elevación";
    const vmax = Math.round(m.vMax * 3.6);
    els.target.max = String(vmax);
    els.target.value = String(vmax);
    els.spacing.value = String(Math.round(m.stationSpacing / 1000));
    els.perturb.innerHTML = PERTURB[modeId]
      .map(([id, ic, label, tip, toggle]) => `<button class="btn" data-p="${id}" ${toggle ? 'aria-pressed="false"' : ""} title="${tip}">${ICONS[ic]}<span>${label}</span></button>`)
      .join("");
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

  function setOutputs() {
    els.exagOut.textContent = "×" + els.exag.value;
    els.targetOut.textContent = els.target.value + " km/h";
    els.spacingOut.textContent = els.spacing.value + " km";
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
    if (b.dataset.p) return h.perturb(b.dataset.p, b);
    if (b.dataset.fig) return showFigure(b.dataset.fig);
    switch (b.id) {
      case "pauseBtn": return setPaused(b.getAttribute("aria-pressed") !== "true");
      case "goBtn": return h.depart();
      case "stopBtn": {
        const on = b.getAttribute("aria-pressed") !== "true";
        press(b, on);
        return h.setHold(on);
      }
      case "resetBtn": return h.reset();
      case "infoBtn": return openInfo();
      case "figBtn": return openGallery();
      case "gClose": return closeGallery();
      case "mClose": return closeInfo();
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
  for (const o of [els.modal, $("#gallery")]) {
    o.addEventListener("click", (e) => {
      if (e.target === o) (o === els.modal ? closeInfo : closeGallery)();
    });
  }

  // atajos de teclado (no actuan mientras se escribe en un control)
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeInfo(); closeGallery(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector(".overlay.open")) return;
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    const n = Number(e.key);
    if (n >= 1 && n <= RIGS.length) { h.setRig(RIGS[n - 1][0]); return; }
    if (e.key === " " && tag !== "BUTTON") { e.preventDefault(); setPaused($("#pauseBtn").getAttribute("aria-pressed") !== "true"); return; }
    if (e.key === "h" || e.key === "H") return setPanel(els.side.classList.contains("closed"));
    if (e.key === "?") return openInfo();
  });

  // ---- laminas, ayuda y tema ----
  let figName = "ems-levitacion";
  const isLight = () => document.documentElement.dataset.theme === "light";
  function showFigure(name) {
    figName = name;
    for (const x of $("#gTabs").children) press(x, x.dataset.fig === name);
    $("#gFrame").src = `figures/${name}${isLight() ? "-light" : ""}.html`;
  }
  function openGallery() {
    showFigure(mode === "eds" ? "eds-sustentacion" : figName);
    $("#gallery").classList.add("open");
    $("#gClose").focus();
  }
  function closeGallery() {
    if (!$("#gallery").classList.contains("open")) return;
    $("#gallery").classList.remove("open");
    $("#gFrame").src = "about:blank";
  }
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    $("#themeBtn").innerHTML = t === "light" ? ICONS.moon : ICONS.sun;
    h.setTheme?.(t);
  }
  function toggleTheme() {
    const next = isLight() ? "dark" : "light";
    applyTheme(next);
    try { localStorage.setItem("maglev-theme", next); } catch {}
    if ($("#gallery").classList.contains("open")) showFigure(figName);
  }
  function openInfo() {
    $("#mBody").innerHTML = INFO_HTML(mode);
    els.modal.classList.add("open");
    $("#mClose").focus();
  }
  function closeInfo() {
    els.modal.classList.remove("open");
  }

  let toastTimer = 0;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2200);
  }

  // ---- actualizacion por cuadro ----
  let lastText = 0;
  const edsRef = new EdsSection();
  function update(tel, train, view) {
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
    if (tab === "data" && !els.side.classList.contains("closed")) drawCharts(tel, train, view);
  }

  function drawCharts(tel, train, view) {
    const W = Math.min(120, Math.max(10, 10 * view.timeScale));
    const idx = hist.range(W, 240);
    const tEnd = idx.length ? hist.t[idx[idx.length - 1]] : 0;
    const xs = idx.map((i) => hist.t[i] - tEnd);
    const colors = ["#5ec8ff", "#ffb454", "#8be28b"];
    if (mode === "ems") {
      const series = train.sections.map((_, k) => ({ xs, ys: idx.map((i) => hist.cols["g" + k][i]), color: colors[k % 3] }));
      drawChart(els.cA, {
        x: [-W, 0], y: [0, 22], series, xFmt: (v) => v.toFixed(0) + " s", yFmt: (v) => v.toFixed(0),
        bands: [{ y0: 9.5, y1: 10.5, color: "rgba(74,222,128,0.2)" }],
        refs: [{ y: 20, color: "#f87171" }, { y: 3, color: "#f87171" }],
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
        refs: [{ y: W0 / 1e3, color: "#c9d3dd", label: "peso" }],
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
      refs: [{ y: 0, color: "rgba(160,190,220,.35)", dash: [] }],
    });
    els.valB.textContent = moving ? `${fmt(f, 0)} Hz` : "detenido";
    drawChart(els.cC, {
      x: [0, train.stationSpacing / 1000],
      y: [0, Math.ceil((MODES[mode].vMax * 3.6) / 100) * 100],
      series: [{ xs: legTrace.xs, ys: legTrace.ys, color: "#5ec8ff", width: 1.8 }],
      marker: legTrace.xs.length ? { x: legTrace.xs[legTrace.xs.length - 1], y: tel.speedKmh, color: "#fff" } : null,
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

  return { root, els, build, update, toast, hist, setTimeScale, setPaused, setOutputs };
}
