// Interfaz: barra superior, panel de telemetria y controles, camaras, graficas y
// ventana "Como funciona". Todo el texto visible esta en espanol.

import { History, drawChart } from "./charts.js";
import { INFO_HTML } from "./info.js";
import { EMS, EDS, G } from "../physics/constants.js";
import { EdsSection } from "../physics/eds.js";
import { MODES } from "../physics/train.js";

const $ = (sel, root = document) => root.querySelector(sel);
const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : "-");

const STATE_TXT = {
  reposo: "En reposo",
  levitando: "Levitando",
  acelerando: "Acelerando",
  crucero: "Crucero",
  frenando: "Frenando",
  estacion: "En estación",
};

const RIG_BTNS = [
  ["orbit", "Órbita"],
  ["chase", "Persecución"],
  ["section", "Sección"],
  ["gap", "Entrehierro"],
  ["top", "Cenital"],
];

// lecturas por modo: [id, etiqueta, unidad, funcion]
const READOUTS = {
  ems: [
    ["speed", "Velocidad", "km/h", (t) => fmt(t.speedKmh, 0)],
    ["gap", "Entrehierro medio", "mm", (t) => fmt(t.gapMm, 2)],
    ["cur", "Corriente del imán", "A", (t) => fmt(t.current, 1)],
    ["freq", "Frecuencia del estator", "Hz", (t) => fmt(t.frequency, 1)],
    ["thr", "Empuje", "kN", (t) => fmt(t.thrust / 1e3, 0)],
    ["ang", "Ángulo de carga", "grados", (t) => fmt(t.loadAngleDeg, 0)],
    ["lift", "Sustentación", "kN", (t) => fmt(t.liftTotal / 1e3, 0)],
    ["wt", "Peso", "kN", (t) => fmt(t.weight / 1e3, 0)],
    ["aero", "Arrastre aerodinámico", "kN", (t) => fmt(t.dragAero / 1e3, 1)],
    ["pow", "Potencia en red", "MW", (t) => fmt(t.gridPowerMW, 2)],
  ],
  eds: [
    ["speed", "Velocidad", "km/h", (t) => fmt(t.speedKmh, 0)],
    ["gap", "Elevación", "mm", (t) => fmt(t.gapMm, 1)],
    ["cur", "Fmm del imán SC", "kA", (t) => fmt(t.current / 1e3, 0)],
    ["ind", "Corriente inducida", "%", (t) => fmt(t.induced * 100, 0)],
    ["freq", "Frecuencia de propulsión", "Hz", (t) => fmt(t.frequency, 1)],
    ["thr", "Empuje", "kN", (t) => fmt(t.thrust / 1e3, 0)],
    ["lift", "Sustentación", "kN", (t) => fmt(t.liftTotal / 1e3, 0)],
    ["wt", "Peso", "kN", (t) => fmt(t.weight / 1e3, 0)],
    ["dmag", "Arrastre magnético", "kN", (t) => fmt(t.dragMag / 1e3, 0)],
    ["aero", "Arrastre aerodinámico", "kN", (t) => fmt(t.dragAero / 1e3, 1)],
    ["whl", "Ruedas de goma", "", (t) => (t.wheelsDown ? "extendidas" : "retraídas")],
    ["pow", "Potencia en red", "MW", (t) => fmt(t.gridPowerMW, 2)],
  ],
};

export function createUI(h) {
  const root = document.createElement("div");
  root.id = "ui";
  root.innerHTML = `
  <div id="topbar" class="panel">
    <div class="title"><h1>Simulador de levitación magnética</h1><span class="sub" id="sub"></span></div>
    <span class="spacer"></span>
    <div class="seg" role="group" aria-label="Tecnología de levitación">
      <button data-mode="ems" aria-pressed="true">EMS · Transrapid</button>
      <button data-mode="eds" aria-pressed="false">EDS · SCMaglev</button>
    </div>
    <span class="chip" id="stateChip">En reposo</span>
    <button class="iconbtn" id="infoBtn" type="button">Cómo funciona</button>
  </div>

  <aside id="side" class="panel" aria-label="Telemetría y controles">
    <h2>Telemetría</h2>
    <div class="grid" id="stats"></div>
    <div class="stat wide" id="gapStat"><div class="l" id="gapLabel">Entrehierro por sección</div>
      <div class="gauge" id="gapGauge" aria-hidden="true"><i></i><b></b><b></b><b></b></div></div>
    <div class="grid" style="margin-top:6px">
      <div class="stat"><div class="l">Distancia a la estación</div><div class="v" id="dist">-</div></div>
      <div class="stat"><div class="l">Energía red / regenerada</div><div class="v" id="energy" style="font-size:14px">-</div></div>
    </div>

    <h2>Viaje</h2>
    <div class="row"><label for="target">Velocidad objetivo</label><input id="target" type="range" min="0" max="400" step="1" value="400"><output id="targetOut"></output></div>
    <div class="row"><label>Escala de tiempo</label>
      <div class="btns" id="timeBtns">
        <button class="btn" data-ts="1" aria-pressed="false">x1</button>
        <button class="btn" data-ts="5" aria-pressed="true">x5</button>
        <button class="btn" data-ts="20" aria-pressed="false">x20</button>
        <button class="btn" data-ts="60" aria-pressed="false">x60</button>
        <button class="btn" id="pauseBtn" aria-pressed="false">Pausa</button>
      </div></div>
    <div class="btns">
      <button class="btn" id="goBtn">Salir ahora</button>
      <button class="btn" id="stopBtn" aria-pressed="false">Retener en estación</button>
      <button class="btn" id="resetBtn">Reiniciar</button>
    </div>
    <div class="row"><label for="spacing">Distancia entre estaciones</label><input id="spacing" type="range" min="5" max="120" step="5"><output id="spacingOut"></output></div>

    <h2>Perturbaciones</h2>
    <div class="btns" id="perturb"></div>
    <p class="note" id="perturbNote"></p>

    <h2>Visualización</h2>
    <div class="row"><label for="exag">Exagerar entrehierro</label><input id="exag" type="range" min="1" max="24" step="1" value="8"><output id="exagOut"></output></div>
    <div class="row"><label>Carrocería</label>
      <div class="btns" id="bodyBtns">
        <button class="btn" data-body="auto" aria-pressed="true">Auto</button>
        <button class="btn" data-body="solid" aria-pressed="false">Sólida</button>
        <button class="btn" data-body="xray" aria-pressed="false">Rayos X</button>
        <button class="btn" data-body="cut" aria-pressed="false">Corte</button>
      </div></div>
    <div class="checks">
      <label><input type="checkbox" data-layer="fields" checked> Líneas de flujo</label>
      <label><input type="checkbox" data-layer="wave" checked> Onda del estator</label>
      <label><input type="checkbox" data-layer="forces" checked> Fuerzas</label>
      <label><input type="checkbox" data-layer="labels" checked> Etiquetas</label>
    </div>
    <div class="legend" id="legend"></div>
    <p class="note" id="visNote"></p>
  </aside>

  <nav id="cams" class="panel" aria-label="Cámaras"></nav>

  <section id="charts" aria-label="Gráficas">
    <figure class="panel"><figcaption><span id="capA"></span><span id="valA"></span></figcaption><canvas id="chartA"></canvas></figure>
    <figure class="panel"><figcaption><span id="capB"></span><span id="valB"></span></figcaption><canvas id="chartB"></canvas></figure>
    <figure class="panel"><figcaption><span id="capC"></span><span id="valC"></span></figcaption><canvas id="chartC"></canvas></figure>
  </section>

  <div id="labels"></div>
  <div id="toast" role="status" aria-live="polite"></div>
  <div id="modal" role="dialog" aria-modal="true" aria-labelledby="mTitle"><div class="card"><button class="iconbtn x" id="mClose" type="button">Cerrar</button><div id="mBody"></div></div></div>
  `;
  document.body.appendChild(root);

  const els = {
    stats: $("#stats"), sub: $("#sub"), stateChip: $("#stateChip"), dist: $("#dist"), energy: $("#energy"),
    target: $("#target"), targetOut: $("#targetOut"), spacing: $("#spacing"), spacingOut: $("#spacingOut"),
    exag: $("#exag"), exagOut: $("#exagOut"), perturb: $("#perturb"), perturbNote: $("#perturbNote"),
    legend: $("#legend"), visNote: $("#visNote"), cams: $("#cams"), toast: $("#toast"), modal: $("#modal"),
    gapGauge: $("#gapGauge"), gapLabel: $("#gapLabel"), labels: $("#labels"),
    cA: $("#chartA"), cB: $("#chartB"), cC: $("#chartC"),
    capA: $("#capA"), capB: $("#capB"), capC: $("#capC"), valA: $("#valA"), valB: $("#valB"), valC: $("#valC"),
  };

  let mode = "ems";
  let statEls = {};
  const hist = new History(6000, 0.02);
  let legTrace = { xs: [], ys: [] }; // perfil de velocidad del tramo
  let lastLeg = -1;

  // ---- construccion por modo ----
  function build(modeId) {
    mode = modeId;
    const m = MODES[modeId];
    for (const b of root.querySelectorAll("[data-mode]")) b.setAttribute("aria-pressed", String(b.dataset.mode === modeId));
    els.sub.textContent =
      modeId === "ems"
        ? "Suspensión electromagnética: atracción bajo la vía, entrehierro de 10 mm con control activo"
        : "Suspensión electrodinámica: repulsión por corrientes inducidas, elevación de unos 100 mm";
    // lecturas
    els.stats.innerHTML = "";
    statEls = {};
    for (const [id, label, unit] of READOUTS[modeId]) {
      const d = document.createElement("div");
      d.className = "stat";
      d.innerHTML = `<div class="l">${label}</div><div class="v"><span data-v>-</span><small>${unit}</small></div>`;
      els.stats.appendChild(d);
      statEls[id] = $("[data-v]", d);
    }
    els.gapLabel.textContent = modeId === "ems" ? "Entrehierro por sección (zona verde: 10 mm +- 0.5)" : "Elevación de cada sección (zona verde: de ruedas a crucero)";
    // objetivo
    const vmax = Math.round(m.vMax * 3.6);
    els.target.max = String(vmax);
    els.target.value = String(vmax);
    els.spacing.value = String(Math.round(m.stationSpacing / 1000));
    // perturbaciones
    els.perturb.innerHTML = "";
    const P = modeId === "ems"
      ? [
          ["load", "Carga +12 % (sección 2)"],
          ["gust", "Ráfaga lateral"],
          ["kick", "Golpe vertical +2 mm"],
          ["ctrlOff", "Apagar el control", true],
          ["cutPower", "Cortar la corriente"],
        ]
      : [
          ["load", "Carga +12 % (sección 2)"],
          ["gust", "Ráfaga lateral"],
          ["kick", "Golpe vertical +15 mm"],
        ];
    for (const [id, label, toggle] of P) {
      const b = document.createElement("button");
      b.className = "btn" + (toggle ? " warn" : "");
      b.textContent = label;
      b.dataset.p = id;
      if (toggle) b.setAttribute("aria-pressed", "false");
      els.perturb.appendChild(b);
    }
    els.perturbNote.textContent =
      modeId === "ems"
        ? "El equilibrio EMS es inestable: sin control, una perturbación de 0,5 mm hace que el vehículo se pegue al riel o caiga en menos de un cuarto de segundo."
        : "El equilibrio EDS es estable por sí mismo: la sustentación cae al subir y aumenta al bajar, sin control activo.";
    // leyenda
    els.legend.innerHTML =
      `<i style="background:var(--n)"></i><span>Polo norte / campo hacia afuera</span>
       <i style="background:var(--s)"></i><span>Polo sur / campo hacia adentro</span>
       <i style="background:#ff9d00"></i><span>Líneas de flujo (el sentido es el del movimiento de los trazos)</span>
       <i style="background:#35e08a"></i><span>Sustentación</span><i style="background:#f2f5f8"></i><span>Peso</span>
       <i style="background:#35d0ff"></i><span>Empuje</span><i style="background:#ffa43a"></i><span>Resistencia</span>
       <i style="background:#ff5fd2"></i><span>Fuerza lateral</span>`;
    els.visNote.textContent =
      "Escalas: el entrehierro se exagera (lo indica el control de arriba), las flechas usan escala de raíz cuadrada y la onda del estator se dibuja en el marco del vehículo (el motor es síncrono: la onda viaja a la velocidad del tren).";
    // camaras
    els.cams.innerHTML = "";
    for (const [id, label] of RIG_BTNS) {
      const b = document.createElement("button");
      b.className = "btn";
      b.dataset.rig = id;
      b.textContent = label;
      b.setAttribute("aria-pressed", String(id === "orbit"));
      els.cams.appendChild(b);
    }
    // graficas
    if (modeId === "ems") {
      els.capA.textContent = "Entrehierro (mm)";
      els.capB.textContent = "Corrientes del estator (3 fases)";
      els.capC.textContent = "Perfil de velocidad del tramo";
    } else {
      els.capA.textContent = "Fuerzas frente a velocidad (kN)";
      els.capB.textContent = "Corrientes de propulsión (3 fases)";
      els.capC.textContent = "Perfil de velocidad del tramo";
    }
    hist.clear();
    legTrace = { xs: [], ys: [] };
    lastLeg = -1;
    setTimeout(() => setExagText(), 0);
  }

  const setExagText = () => {
    els.exagOut.textContent = "x" + els.exag.value;
    els.targetOut.textContent = els.target.value + " km/h";
    els.spacingOut.textContent = els.spacing.value + " km";
  };

  // ---- eventos ----
  root.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.mode) return h.setMode(b.dataset.mode);
    if (b.dataset.rig) {
      for (const x of els.cams.children) x.setAttribute("aria-pressed", String(x === b));
      return h.setRig(b.dataset.rig);
    }
    if (b.dataset.ts) {
      for (const x of $("#timeBtns").querySelectorAll("[data-ts]")) x.setAttribute("aria-pressed", String(x === b));
      return h.setTimeScale(Number(b.dataset.ts));
    }
    if (b.dataset.body) {
      for (const x of $("#bodyBtns").children) x.setAttribute("aria-pressed", String(x === b));
      return h.setBody(b.dataset.body);
    }
    if (b.dataset.p) return h.perturb(b.dataset.p, b);
    if (b.id === "pauseBtn") {
      const on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", String(on));
      return h.setPaused(on);
    }
    if (b.id === "goBtn") return h.depart();
    if (b.id === "stopBtn") {
      const on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", String(on));
      return h.setHold(on);
    }
    if (b.id === "resetBtn") return h.reset();
    if (b.id === "infoBtn") return openInfo();
    if (b.id === "mClose") return closeInfo();
  });
  root.addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "target") h.setTarget(Number(t.value));
    if (t.id === "exag") h.setExag(Number(t.value));
    if (t.id === "spacing") h.setSpacing(Number(t.value) * 1000);
    if (t.dataset.layer) h.setLayer(t.dataset.layer, t.checked);
    setExagText();
  });
  els.modal.addEventListener("click", (e) => {
    if (e.target === els.modal) closeInfo();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeInfo();
  });
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
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 3200);
  }

  // ---- actualizacion por cuadro ----
  let lastText = 0;
  const edsRef = new EdsSection();
  function update(tel, train, view, ctrl) {
    // historial en tiempo de simulacion
    const vals = {
      speed: tel.speedKmh,
      thrust: tel.thrust / 1e3,
      u: tel.phases[0], v: tel.phases[1], w: tel.phases[2],
    };
    train.sections.forEach((s, i) => (vals["g" + i] = s.gapMm));
    hist.push(tel.time, vals);

    // perfil del tramo
    const leg = Math.round(tel.nextStation / train.stationSpacing);
    if (leg !== lastLeg) {
      lastLeg = leg;
      legTrace = { xs: [], ys: [] };
    }
    const prevX = leg * train.stationSpacing - train.stationSpacing;
    const dx = (tel.x - prevX) / 1000;
    const lastPoint = legTrace.xs[legTrace.xs.length - 1];
    if (lastPoint === undefined || dx - lastPoint > train.stationSpacing / 1000 / 400) {
      legTrace.xs.push(dx);
      legTrace.ys.push(tel.speedKmh);
    }

    const now = performance.now();
    if (now - lastText > 90) {
      lastText = now;
      for (const [id, , , f] of READOUTS[mode]) statEls[id].textContent = f(tel);
      els.stateChip.innerHTML = `<b>${STATE_TXT[tel.state] ?? tel.state}</b>${tel.levitated && tel.speed > 0.5 ? " · levitando" : ""}`;
      els.dist.innerHTML = `<span>${fmt(Math.max(0, tel.remaining) / 1000, 2)}</span><small>km</small>`;
      els.energy.textContent = `${fmt(tel.energyTractionKWh, 0)} / ${fmt(tel.energyRegenKWh, 0)} kWh`;
      // medidor de entrehierro
      const g = els.gapGauge;
      const range = mode === "ems" ? [0, 22] : [70, 105];
      const pos = (v) => `${(Math.min(1, Math.max(0, (v - range[0]) / (range[1] - range[0]))) * 100).toFixed(1)}%`;
      const zone = g.children[0];
      if (mode === "ems") {
        zone.style.left = pos(9.5);
        zone.style.width = `calc(${pos(10.5)} - ${pos(9.5)})`;
      } else {
        zone.style.left = pos(EDS.gapWheels * 1000);
        zone.style.width = `calc(${pos(EDS.gapCruise * 1000)} - ${pos(EDS.gapWheels * 1000)})`;
      }
      train.sections.forEach((s, i) => {
        if (g.children[i + 1]) g.children[i + 1].style.left = pos(s.gapMm);
      });
    }
    drawCharts(tel, train, view);
  }

  function drawCharts(tel, train, view) {
    const W = Math.min(120, Math.max(10, 10 * view.timeScale));
    const idx = hist.range(W);
    const tEnd = idx.length ? hist.t[idx[idx.length - 1]] : 0;
    const xs = idx.map((i) => hist.t[i] - tEnd);
    const colors = ["#5ec8ff", "#ffb454", "#8be28b"];
    // --- A ---
    if (mode === "ems") {
      const series = train.sections.map((_, k) => ({ xs, ys: idx.map((i) => hist.cols["g" + k][i]), color: colors[k % 3] }));
      drawChart(els.cA, {
        x: [-W, 0], y: [0, 22], series, xFmt: (v) => v.toFixed(0) + " s",
        bands: [{ y0: 9.5, y1: 10.5, color: "rgba(74,222,128,0.18)" }],
        refs: [{ y: 20, color: "#f87171", label: "patin" }, { y: 3, color: "#f87171", label: "contacto" }],
      });
      els.valA.textContent = `ventana ${W.toFixed(0)} s`;
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
        refs: [{ y: W0 / 1e3, color: "#f2f5f8", label: "peso" }],
        marker: { x: tel.speedKmh, y: tel.liftTotal / 1e3, color: "#35e08a" },
        xFmt: (v) => v.toFixed(0), xLabel: "km/h",
      });
      els.valA.textContent = "verde: sustentación, naranja: arrastre";
    }
    // --- B: trifasica (3 ciclos a la frecuencia real) ---
    {
      const f = tel.frequency;
      const N = 120;
      const xs2 = [], u = [], v = [], w = [];
      const TWO = Math.PI * 2;
      const amp = Math.min(1, 0.3 + 0.9 * Math.abs(train.thrust) / Math.max(1, train.fMaxAt(0)));
      for (let i = 0; i <= N; i++) {
        const ph = (i / N) * 3 * TWO;
        xs2.push(i / N * 3);
        u.push(amp * Math.sin(ph - tel.theta));
        v.push(amp * Math.sin(ph - tel.theta - TWO / 3));
        w.push(amp * Math.sin(ph - tel.theta + TWO / 3));
      }
      drawChart(els.cB, {
        x: [0, 3], y: [-1.1, 1.1],
        series: f > 0.3 && train.v > 0.5
          ? [{ xs: xs2, ys: u, color: "#ffb000" }, { xs: xs2, ys: v, color: "#19c37d" }, { xs: xs2, ys: w, color: "#b45cff" }]
          : [],
        xFmt: (q) => q.toFixed(0), xLabel: "ciclos",
        refs: [{ y: 0, color: "rgba(160,190,220,.4)", dash: [] }],
      });
      els.valB.textContent = f > 0.3 ? `${fmt(f, 1)} Hz` : "sin movimiento";
    }
    // --- C: perfil del tramo ---
    drawChart(els.cC, {
      x: [0, train.stationSpacing / 1000],
      y: [0, Math.ceil(MODES[mode].vMax * 3.6 / 100) * 100],
      series: [{ xs: legTrace.xs, ys: legTrace.ys, color: "#5ec8ff", width: 1.8 }],
      marker: legTrace.xs.length ? { x: legTrace.xs[legTrace.xs.length - 1], y: tel.speedKmh, color: "#fff" } : null,
      xFmt: (v) => v.toFixed(0), xLabel: "km", yFmt: (v) => v.toFixed(0),
    });
    els.valC.textContent = `${fmt(tel.speedKmh, 0)} km/h`;
  }

  // arranque
  build("ems");
  setExagText();

  return { root, els, build, update, toast, setExagText, hist };
}
