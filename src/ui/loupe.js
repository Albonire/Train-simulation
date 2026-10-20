// Lupa del entrehierro: un corte transversal en vivo del sistema de levitacion, dibujado en 2D.
//
// EMS: viga y estator arriba, el iman del coche debajo; el hueco entre ambos es el entrehierro, a
//      una escala ampliada y a escala 1:1 en la cifra. Las lineas de campo salen del polo norte,
//      cruzan el hueco y entran por el sur. La flecha verde es la atraccion; la blanca, el peso.
// EDS: pared de la via con bobinas en 8 a la derecha, iman superconductor del coche a la izquierda;
//      la levitacion sale de que el iman quede por encima del eje nulo de las bobinas.
//
// Todo sale de la telemetria del modelo: no hay nada dibujado "a mano" que no se mueva con ella.

import { ICONS } from "./icons.js";

const W = 336;
const H = 196;
const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d).replace(".", ",") : "–");
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const N_COL = "#f0574a";
const S_COL = "#4a90f0";
const LIFT = "#35e08a";
const COPPER = "#c8742a";

/** Estado en palabras para la insignia. Devuelve [texto, tipo de insignia]. */
export function loupeState(mode, tel, train) {
  if (mode === "ems") {
    if (train.sections.some((s) => s.fallen)) return ["Sobre patines", "bad"];
    if (train.sections.some((s) => s.contact)) return ["Pegado al riel", "bad"];
    if (!tel.levitated) return [tel.state === "reposo" ? "Sobre patines" : "Despegando", tel.state === "reposo" ? "idle" : "warn"];
    return ["Levitando", "ok"];
  }
  if (tel.wheelsDown) return [tel.speedKmh > 1 ? "Sobre ruedas" : "En reposo", tel.speedKmh > 1 ? "warn" : "idle"];
  return ["Levitando", "ok"];
}

export function createLoupe(root, { setRig, toast }) {
  root.innerHTML = `
    <button class="lp-head" id="lpHead" aria-expanded="true" aria-controls="lpBody" title="Mostrar u ocultar la lupa (L)">
      <span class="lp-title" id="lpTitle">Entrehierro</span>
      <output class="lp-val" id="lpVal">–</output>
      <span class="pill" id="lpState" data-k="idle">En reposo</span>
      <span class="lp-chev" aria-hidden="true">${ICONS.chev}</span>
    </button>
    <div class="lp-body" id="lpBody">
      <canvas id="lpCanvas" width="${W}" height="${H}" aria-hidden="true"></canvas>
      <div class="lp-foot">
        <span class="lp-note" id="lpNote"></span>
        <button class="btn lp-go" id="lpGo" title="Abre la cámara de primer plano de los imanes (4)">Ver en 3D</button>
      </div>
    </div>`;
  const head = root.querySelector("#lpHead");
  const canvas = root.querySelector("#lpCanvas");
  const ctx = canvas.getContext("2d");
  const els = {
    title: root.querySelector("#lpTitle"),
    val: root.querySelector("#lpVal"),
    state: root.querySelector("#lpState"),
    note: root.querySelector("#lpNote"),
  };
  // con poca altura arranca plegada para no tapar el carril de camaras
  let open = window.innerHeight >= 800;
  try {
    const saved = localStorage.getItem("lupa");
    if (saved !== null) open = saved === "1";
  } catch {
    /* sin almacenamiento: vale el valor por defecto */
  }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);

  function setOpen(v) {
    open = v;
    root.dataset.open = String(v);
    head.setAttribute("aria-expanded", String(v));
    try {
      localStorage.setItem("lupa", v ? "1" : "0");
    } catch {
      /* ignorado */
    }
  }
  setOpen(open);
  head.addEventListener("click", () => setOpen(!open));
  root.querySelector("#lpGo").addEventListener("click", () => setRig("gap"));

  // colores del tema: se leen una vez por cambio de tema o de modo
  let colors = null;
  let colorKey = "";
  function readColors() {
    const key = `${document.documentElement.dataset.theme}|${document.documentElement.dataset.mode}`;
    if (key === colorKey) return colors;
    colorKey = key;
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => cs.getPropertyValue(n).trim();
    const dark = document.documentElement.dataset.theme !== "light";
    colors = {
      bg: v("--surface"),
      bg2: v("--surface-2"),
      line: v("--line-strong"),
      text: v("--text"),
      muted: v("--muted"),
      accent: v("--accent"),
      warn: v("--warn"),
      bad: v("--bad"),
      concrete: dark ? "#56606b" : "#b7bec6",
      steel: dark ? "#7b8692" : "#8d98a4",
      iron: dark ? "#3c444d" : "#4b545d",
      body: dark ? "#cfd6dd" : "#c3ccd5",
      font: getComputedStyle(document.body).fontFamily,
    };
    return colors;
  }

  // ---- utilidades de dibujo ----
  function arrow(c, x0, y0, x1, y1, color, w = 2.4) {
    const a = Math.atan2(y1 - y0, x1 - x0);
    const hd = 7;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1 - Math.cos(a) * hd * 0.6, y1 - Math.sin(a) * hd * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - Math.cos(a - 0.45) * hd, y1 - Math.sin(a - 0.45) * hd);
    ctx.lineTo(x1 - Math.cos(a + 0.45) * hd, y1 - Math.sin(a + 0.45) * hd);
    ctx.closePath();
    ctx.fill();
  }
  const text = (c, s, x, y, { size = 11, weight = 500, color = c.muted, align = "left", mono = false } = {}) => {
    ctx.font = `${weight} ${size}px ${mono ? "ui-monospace, 'SFMono-Regular', Menlo, monospace" : c.font}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(s, x, y);
  };
  function rrect(x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  // flechas de fuerza: sustentacion hacia arriba y peso hacia abajo desde un mismo punto
  function forces(c, hx, hy, lift, weight, liftName) {
    const ref = Math.max(1, weight);
    const len = (F) => 12 + 30 * Math.sqrt(clamp(F / ref, 0, 1.6));
    ctx.fillStyle = c.bg;
    ctx.beginPath();
    ctx.arc(hx, hy, 4, 0, 6.3);
    ctx.fill();
    if (lift > 1) arrow(c, hx, hy - 2, hx, hy - len(lift), LIFT);
    arrow(c, hx, hy + 2, hx, hy + len(weight), c.text);
    text(c, liftName, hx + 10, hy - 22, { size: 10.5 });
    text(c, `${fmt(lift / 1e3, 0)} kN`, hx + 10, hy - 9, { size: 12, weight: 650, color: LIFT, mono: true });
    text(c, "Peso", hx + 10, hy + 18, { size: 10.5 });
    text(c, `${fmt(weight / 1e3, 0)} kN`, hx + 10, hy + 31, { size: 12, weight: 650, color: c.text, mono: true });
  }

  // ---- EMS ----
  const EMS_PX = 3.6; // px por mm de entrehierro (dibujo ampliado)
  function drawEms(c, tel, train, view, t) {
    const s = train.sections[Math.floor(train.sections.length / 2)];
    const gapMm = s.gap * 1000;
    const g = clamp(gapMm * EMS_PX, 3, 82);
    const yS = 58; // cara inferior del estator
    const yM = yS + g; // cara superior del iman
    // viga y estator
    rrect(12, 6, 218, 34, 3, c.concrete);
    text(c, "Viga", 20, 27, { size: 11, color: c.bg, weight: 600 });
    rrect(26, 40, 190, 18, 2, c.steel);
    ctx.fillStyle = COPPER;
    for (let x = 36; x < 210; x += 12) ctx.fillRect(x, 51, 6, 4);
    text(c, "Estator", 34, 49, { size: 10, color: c.bg, weight: 600 });
    // campo: tres lazos del polo norte al sur a traves del hueco
    const B = clamp(view.fieldLevel ?? 1, 0, 2);
    const live = !s.fallen && s.I > 0.5;
    const nx = [58, 72, 86];
    const sx = [158, 172, 186];
    if (live) {
      ctx.lineCap = "round";
      for (let k = 0; k < 3; k++) {
        const top = yS - 9 - k * 3;
        const grad = ctx.createLinearGradient(nx[k], 0, sx[k], 0);
        grad.addColorStop(0, N_COL);
        grad.addColorStop(1, S_COL);
        ctx.strokeStyle = grad;
        ctx.globalAlpha = clamp(0.35 + 0.4 * B, 0.2, 0.9);
        ctx.lineWidth = 1.2 + 0.9 * clamp(B, 0, 1.4);
        ctx.setLineDash([6, 6]);
        ctx.lineDashOffset = -t * 26;
        ctx.beginPath();
        ctx.moveTo(nx[k], yM);
        ctx.lineTo(nx[k], yS);
        ctx.bezierCurveTo(nx[k], top, sx[k], top, sx[k], yS);
        ctx.lineTo(sx[k], yM);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    // iman: dos polos con su bobinado y el yugo
    rrect(40, yM, 62, 30, 3, c.iron);
    rrect(142, yM, 62, 30, 3, c.iron);
    rrect(40, yM + 24, 164, 12, 3, c.iron);
    ctx.fillStyle = N_COL;
    ctx.fillRect(40, yM - 3, 62, 4);
    ctx.fillStyle = S_COL;
    ctx.fillRect(142, yM - 3, 62, 4);
    ctx.fillStyle = COPPER;
    for (const x of [48, 150]) ctx.fillRect(x, yM + 8, 46, 10);
    text(c, "N", 71, yM + 7, { size: 10, weight: 700, color: "#fff", align: "center" });
    text(c, "S", 173, yM + 7, { size: 10, weight: 700, color: "#fff", align: "center" });
    text(c, "Imán", 122, yM + 18, { size: 10, color: c.text, align: "center", weight: 600 });
    // coche: el piso y la caja sobre el iman
    rrect(24, yM + 36, 196, 26, 4, c.body);
    ctx.fillStyle = c.bg2;
    for (let x = 40; x < 200; x += 28) ctx.fillRect(x, yM + 40, 16, 6);
    text(c, "Coche", 122, yM + 59, { size: 9.5, align: "center", color: c.iron, weight: 600 });
    // cota del entrehierro, a escala del dibujo
    const dx = 224;
    ctx.strokeStyle = c.text;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(dx - 4, yS);
    ctx.lineTo(dx + 4, yS);
    ctx.moveTo(dx - 4, yM);
    ctx.lineTo(dx + 4, yM);
    ctx.moveTo(dx, yS);
    ctx.lineTo(dx, yM);
    ctx.stroke();
    // fuerzas junto al coche
    forces(c, 266, 138, s.lift, (s.mass + s.extraMass) * 9.81, "Atracción");
    // la cifra real del hueco, junto a la cota
    text(c, `${fmt(gapMm, 1)} mm`, dx + 8, yS + g / 2 + 4, { size: 13, weight: 700, color: c.text, mono: true });
  }

  // ---- EDS ----
  const EDS_PX = 0.5; // px por mm de elevacion
  function drawEds(c, tel, train, view, t) {
    const s = train.sections[Math.floor(train.sections.length / 2)];
    const elev = clamp(tel.gapMm * EDS_PX, 8, 70);
    const ground = 168;
    const floorY = ground - elev; // piso del coche
    // losa y pared con sus bobinas
    rrect(8, ground, 226, 14, 2, c.concrete);
    rrect(176, 26, 46, ground - 26, 2, c.concrete);
    text(c, "Pared", 199, 40, { size: 10, color: c.bg, align: "center", weight: 600 });
    const nullY = 98; // eje nulo de las bobinas en 8 (fijo en la pared)
    const ind = clamp(tel.induced ?? 0, 0, 1);
    for (const [cy, hue] of [[nullY - 18, COPPER], [nullY + 18, COPPER]]) {
      ctx.strokeStyle = hue;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(176, cy, 9, 14, 0, 0, 6.3);
      ctx.stroke();
      // corriente inducida: giro de trazos con la intensidad relativa
      if (ind > 0.05) {
        ctx.strokeStyle = LIFT;
        ctx.globalAlpha = 0.35 + 0.6 * ind;
        ctx.lineWidth = 1.8;
        ctx.setLineDash([4, 5]);
        ctx.lineDashOffset = -t * 30 * (cy < nullY ? 1 : -1);
        ctx.beginPath();
        ctx.ellipse(176, cy, 9, 14, 0, 0, 6.3);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }
    ctx.strokeStyle = c.muted;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(110, nullY);
    ctx.lineTo(222, nullY);
    ctx.stroke();
    ctx.setLineDash([]);
    text(c, "eje nulo", 205, nullY + 3, { size: 9, align: "center", color: c.bg, weight: 600 });
    // coche: cuerpo, iman superconductor frente a la pared y ruedas
    const bodyTop = floorY - 74;
    rrect(30, bodyTop, 122, 74, 6, c.body);
    ctx.fillStyle = c.bg2;
    for (let x = 42; x < 140; x += 22) ctx.fillRect(x, bodyTop + 12, 14, 10);
    const my = floorY - 38;
    rrect(152, my - 22, 18, 44, 3, N_COL);
    text(c, "N", 161, my + 4, { size: 11, weight: 700, color: "#fff", align: "center" });
    // centro del iman: su altura respecto del eje nulo es lo que da la fuerza
    ctx.strokeStyle = c.text;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(170, my);
    ctx.lineTo(180, my);
    ctx.stroke();
    // ruedas
    if (tel.wheelsDown) {
      for (const x of [58, 122]) {
        ctx.fillStyle = c.iron;
        ctx.beginPath();
        ctx.arc(x, floorY + 1, 8, 0, 6.3);
        ctx.fill();
      }
    } else {
      for (const x of [58, 122]) rrect(x - 6, floorY - 4, 12, 4, 2, c.iron);
    }
    // cota de la elevacion
    const dx = 20;
    ctx.strokeStyle = c.text;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(dx - 4, ground);
    ctx.lineTo(dx + 4, ground);
    ctx.moveTo(dx - 4, floorY);
    ctx.lineTo(dx + 4, floorY);
    ctx.moveTo(dx, ground);
    ctx.lineTo(dx, floorY);
    ctx.stroke();
    text(c, `${fmt(tel.gapMm, 0)} mm`, dx + 7, (ground + floorY) / 2 + 4, { size: 12.5, weight: 700, color: c.text, mono: true });
    forces(c, 262, 96, tel.liftTotal / train.sections.length, tel.weight / train.sections.length, "Repulsión");
    text(c, `${fmt(tel.speedKmh, 0)} km/h`, 262, 150, { size: 12, weight: 650, color: c.text, mono: true });
    text(c, tel.wheelsDown ? "ruedas fuera" : "ruedas dentro", 262, 164, { size: 10.5 });
  }

  let last = 0;
  let shown = null; // ultimo estado anunciado (true = levitando)
  let pending = null;
  let pendingSince = 0;
  const set = (el, v) => {
    if (el.textContent !== v) el.textContent = v;
  };
  const t0 = performance.now();
  return {
    /** Se llama cada fotograma; dibuja a 30 por segundo como mucho. */
    update(mode, tel, train, view, hidden) {
      const [label, kind] = loupeState(mode, tel, train);
      const s = train.sections[Math.floor(train.sections.length / 2)];
      // el texto solo se toca si cambia: asignarlo cada fotograma invalida el diseno
      set(els.state, label);
      if (els.state.dataset.k !== kind) els.state.dataset.k = kind;
      set(els.title, mode === "ems" ? "Entrehierro" : "Elevación");
      set(els.val, mode === "ems" ? `${fmt(s.gap * 1000, 1)} mm` : `${fmt(tel.gapMm, 0)} mm`);
      set(els.note, mode === "ems" ? "Esquema fuera de escala: el hueco real mide 10 mm" : "Esquema fuera de escala: elevación ampliada");
      // avisos de despegue y aterrizaje: el estado debe mantenerse medio segundo, para que una
      // perturbacion breve no dispare avisos
      const levitating = kind === "ok";
      const nowMs = performance.now();
      if (levitating !== pending) {
        pending = levitating;
        pendingSince = nowMs;
      }
      if (shown === null) shown = levitating;
      else if (pending !== shown && nowMs - pendingSince > 500) {
        shown = pending;
        toast(shown ? (mode === "ems" ? "Despegue: el imán ya sostiene al tren" : "Despegue: las ruedas se recogen") : (mode === "ems" ? "Aterrizaje: el tren baja a los patines" : "Aterrizaje: salen las ruedas"));
      }
      if (!open || hidden) return;
      const now = performance.now();
      if (now - last < 33) return;
      last = now;
      const c = readColors();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const t = (now - t0) / 1000;
      if (mode === "ems") drawEms(c, tel, train, view, t);
      else drawEds(c, tel, train, view, t);
    },
    toggle: () => setOpen(!open),
    get open() {
      return open;
    },
    /** Al cambiar de modo se evita un aviso falso. */
    reset: () => {
      shown = null;
      pending = null;
    },
  };
}
