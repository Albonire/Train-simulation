// qa de uso: lo que un usuario hace con los controles y lo que la interfaz tiene que contestar.
// cada escenario corre en una pagina nueva (sin almacenamiento previo) y comprueba el comportamiento,
// no el aspecto (para eso estan visual-qa.mjs y las capturas de shot.mjs).
//
//   node scripts/ux-qa.mjs                       contra http://127.0.0.1:5173/
//   node scripts/ux-qa.mjs http://127.0.0.1:5174/
//
// escenarios:
//   1  las pistas de primera visita aparecen tras omitir la apertura (tecla, clic, boton) y se
//      cierran con el gesto siguiente
//   2  "sin control" tira la seccion central a los patines y no la rescata la maquina de estados
//   3  "sin corriente" tira todo el tren y 3,5 s simulados despues vuelve a levitar
//   4  "reiniciar" deja velocidad, estaciones, perturbaciones y respuesta como al principio
//   5  la exageracion que fija la camara se dice (rotulo y deslizador) y no se finge
//   6  con la camara seguir ninguna farola parpadea al pasar el decorado
//   (viaje) con el panel cerrado, la distancia se pide desde el cuadro de mando y el tren se detiene ahi

import { chromium } from "playwright-core";
import { existsSync } from "node:fs";

const URL_BASE = process.argv.find((a) => a.startsWith("http")) ?? "http://127.0.0.1:5173/";
const CHROME =
  process.env.CHROME_PATH ??
  ["/opt/pw-browsers/chromium", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/usr/bin/chromium", "/usr/bin/google-chrome"].find((p) => existsSync(p));
if (!CHROME) {
  console.error("No encuentro Chrome: define CHROME_PATH.");
  process.exit(2);
}

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--use-angle=swiftshader", "--hide-scrollbars"],
});

const failures = [];
let checks = 0;
const check = (scenario, name, ok, detail = "") => {
  checks++;
  if (!ok) failures.push(`[${scenario}] ${name}${detail ? ": " + detail : ""}`);
  console.log(`${ok ? "ok  " : "FALLA"} [${scenario}] ${name}${!ok && detail ? ": " + detail : ""}`);
};

async function open({ query = "", size = [1280, 720], pause = true, advance = 80 } = {}) {
  const page = await browser.newPage({ viewport: { width: size[0], height: size[1] } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("excepcion: " + e));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push("consola: " + m.text()));
  // el panel lateral arranca cerrado por debajo de 1500 px: los escenarios lo necesitan abierto
  await page.addInitScript(() => {
    try { if (localStorage.getItem("maglev-panel") === null) localStorage.setItem("maglev-panel", "1"); } catch {}
  });
  await page.goto(URL_BASE + query, { waitUntil: "load", timeout: 120000 });
  await page.waitForFunction(() => window.__app, null, { timeout: 30000 });
  await page.evaluate(([p, adv]) => {
    const a = window.__app;
    if (adv > 0) a.train.advance(adv);
    if (p) a.ui.setPaused(true); // el tiempo lo avanza el script: el resultado no depende de la velocidad del equipo
  }, [pause, advance]);
  return { page, errors };
}
const frames = (page, n = 3) => page.evaluate((k) => new Promise((r) => { let i = 0; const f = () => (++i >= k ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

// ---- 1: pistas tras omitir la apertura ----
async function hints() {
  const S = "pistas";
  const way = {
    tecla: (page) => page.keyboard.press("x"),
    clic: (page) => page.mouse.click(640, 360),
    // el boton, con la secuencia real (pointerdown y despues click) y sin esperar a que sea "accionable":
    // en un equipo lento la apertura puede terminar mientras Playwright espera
    boton: (page) =>
      page.evaluate(() => {
        const b = document.getElementById("introSkip");
        b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
        b.click();
      }),
  };
  for (const [name, skip] of Object.entries(way)) {
    const { page, errors } = await open({ query: "?intro=1", pause: false, advance: 0 });
    await page.waitForFunction(() => window.__app.intro.state.active, null, { timeout: 20000 });
    await skip(page);
    await page.waitForTimeout(900);
    const r = await page.evaluate(() => {
      const el = document.getElementById("hint");
      let stored = "n/a";
      try { stored = localStorage.getItem("maglev-hint"); } catch {}
      return { active: window.__app.intro.state.active, exists: !!el, gone: el?.classList.contains("gone"), text: el?.textContent ?? "", stored };
    });
    check(S, `omitir con ${name}: la apertura termina`, r.active === false);
    check(S, `omitir con ${name}: la primera pista se ve`, r.exists && !r.gone && r.text.length > 8, JSON.stringify(r));
    check(S, `omitir con ${name}: no se da por vista`, r.stored === null, String(r.stored));
    // el gesto siguiente si las cierra
    await page.keyboard.press("x");
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({ gone: document.getElementById("hint")?.classList.contains("gone") ?? true, stored: localStorage.getItem("maglev-hint") }));
    check(S, `omitir con ${name}: el gesto siguiente las cierra y las da por vistas`, after.gone && after.stored === "2", JSON.stringify(after));
    check(S, `omitir con ${name}: sin errores`, errors.length === 0, errors.join(" | "));
    await page.close();
  }
}

// ---- 2: Sin control ----
async function ctrlOff() {
  const S = "sin control";
  const { page, errors } = await open();
  await page.click('[data-tab="ctrl"]');
  const before = await page.evaluate(() => ({ lev: window.__app.train.levitated, gap: window.__app.train.sections[1].gapMm }));
  check(S, "antes de pulsar el tren va levitado a 10 mm", before.lev && Math.abs(before.gap - 10) < 0.3, JSON.stringify(before));
  await page.click('[data-p="ctrlOff"]');
  const r = await page.evaluate(() => {
    const t = window.__app.train;
    const s = t.sections[1];
    t.advance(0.4);
    const early = { down: s.fallen || s.contact, control: s.control };
    t.advance(6);
    return { early, late: { down: s.fallen || s.contact, control: s.control, lev: t.levitated, others: t.sections[0].control && t.sections[2].control } };
  });
  check(S, "cae en menos de 0,4 s simulados", r.early.down && !r.early.control, JSON.stringify(r.early));
  check(S, "6 s despues sigue caida: la maquina de estados no la rescata", r.late.down && !r.late.control && !r.late.lev, JSON.stringify(r.late));
  check(S, "las otras secciones siguen con control", r.late.others === true);
  await frames(page, 4);
  const pill = await page.textContent("#hState");
  check(S, "el cuadro de mando lo dice", /patines|riel/i.test(pill), pill);
  check(S, "el boton queda pulsado", (await page.getAttribute('[data-p="ctrlOff"]', "aria-pressed")) === "true");
  await page.click('[data-p="ctrlOff"]');
  const back = await page.evaluate(() => {
    const t = window.__app.train;
    t.advance(9);
    return { lev: t.levitated, gap: t.sections[1].gapMm };
  });
  check(S, "al volver a pulsar vuelve a levitar", back.lev && Math.abs(back.gap - 10) < 0.3, JSON.stringify(back));
  check(S, "sin errores", errors.length === 0, errors.join(" | "));
  await page.close();
}

// ---- 3: Sin corriente ----
async function cutPower() {
  const S = "sin corriente";
  const { page, errors } = await open();
  await page.click('[data-tab="ctrl"]');
  await page.click('[data-p="cutPower"]');
  const r = await page.evaluate(() => {
    const t = window.__app.train;
    t.advance(1);
    const mid = { all: t.sections.every((s) => s.fallen || s.contact), I: Math.max(...t.sections.map((s) => s.I)), cut: t.powerCut };
    t.advance(2.4); // 3,4 s: todavia sin corriente
    const still = { lev: t.levitated, cut: t.powerCut > 0 };
    t.advance(9); // vuelve y sube
    return { mid, still, end: { lev: t.levitated, cut: t.powerCut, gap: t.sections[1].gapMm } };
  });
  check(S, "al segundo cae todo el tren y no circula corriente", r.mid.all && r.mid.I < 0.5, JSON.stringify(r.mid));
  check(S, "a los 3,4 s el corte sigue", !r.still.lev && r.still.cut, JSON.stringify(r.still));
  check(S, "despues vuelve a levitar a 10 mm", r.end.lev && r.end.cut === 0 && Math.abs(r.end.gap - 10) < 0.3, JSON.stringify(r.end));
  check(S, "sin errores", errors.length === 0, errors.join(" | "));
  await page.close();
}

// ---- 4: Reiniciar ----
async function reset() {
  const S = "reiniciar";
  const { page, errors } = await open();
  await page.click('[data-tab="ctrl"]');
  await page.evaluate(() => {
    for (const [id, v] of [["target", "200"], ["spacing", "60"]]) {
      const el = document.getElementById(id);
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await page.click('[data-p="load"]');
  await page.click('[data-p="ctrlOff"]');
  await page.click('[data-p="gust"]');
  const dirty = await page.evaluate(() => ({ pressed: [...document.querySelectorAll("#perturb [aria-pressed=true]")].length, resp: document.getElementById("resp").textContent }));
  check(S, "antes de reiniciar hay controles alterados", dirty.pressed === 2 && dirty.resp.length > 0, JSON.stringify(dirty));
  await page.click("#resetBtn");
  await frames(page, 2);
  const r = await page.evaluate(() => {
    const a = window.__app;
    const t = a.train;
    return {
      target: Number(document.getElementById("target").value),
      targetMax: Number(document.getElementById("target").max),
      spacing: Number(document.getElementById("spacing").value),
      pressed: [...document.querySelectorAll("#perturb [aria-pressed=true]")].length,
      resp: document.getElementById("resp").textContent,
      forced: t.sections.some((s) => s.forcedOff || s.extraMass > 0 || !s.powered),
      x: t.x,
      targetSpeed: t.targetSpeed * 3.6,
      spacingKm: t.stationSpacing / 1000,
    };
  });
  check(S, "velocidad objetivo vuelve al maximo", r.target === r.targetMax && Math.abs(r.targetSpeed - r.targetMax) < 1, JSON.stringify(r));
  check(S, "estaciones vuelven a su distancia", r.spacing === r.spacingKm, JSON.stringify(r));
  check(S, "ninguna perturbacion queda pulsada ni aplicada", r.pressed === 0 && !r.forced, JSON.stringify(r));
  check(S, "la respuesta medida se borra", r.resp === "", r.resp);
  check(S, "el viaje vuelve al principio", r.x === 0, String(r.x));
  check(S, "sin errores", errors.length === 0, errors.join(" | "));
  await page.close();
}

// ---- 5: exageracion honesta ----
async function exaggeration() {
  const S = "exageracion";
  for (const mode of ["ems", "eds"]) {
    const { page, errors } = await open({ advance: mode === "ems" ? 80 : 150 });
    await page.evaluate((m) => window.__app.setMode(m), mode);
    await page.click('[data-tab="view"]');
    await page.evaluate(() => window.__app.setRig("orbit", true));
    await frames(page, 3);
    let st = await page.evaluate(() => ({ off: document.getElementById("exag").disabled, out: document.getElementById("exagOut").textContent, user: Number(document.getElementById("exag").value), drawn: window.__app.view.exag[document.documentElement.dataset.mode] }));
    check(S, `${mode}: en la orbita el deslizador es del usuario`, !st.off && /^×\d+$/.test(st.out), JSON.stringify(st));
    check(S, `${mode}: el deslizador muestra la exageracion que se dibuja`, st.user === st.drawn, JSON.stringify(st));
    // se baja a x8 para que la camara de detalle (que fija x24 en el EMS) tenga algo que forzar
    await page.evaluate(() => {
      const el = document.getElementById("exag");
      el.value = "8";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.evaluate(() => window.__app.setRig("gap", true));
    await frames(page, 4);
    st = await page.evaluate(() => ({ off: document.getElementById("exag").disabled, out: document.getElementById("exagOut").textContent, label: document.getElementById("labels").textContent }));
    if (mode === "ems") {
      check(S, "ems: la camara de imanes fija x24 y el deslizador lo dice", st.off && /×24/.test(st.out) && /camara|cámara/.test(st.out), JSON.stringify(st));
      check(S, "ems: el rotulo del hueco dice cuanto se amplia el dibujo", /dibujo ×24/.test(st.label), st.label);
    } else {
      // en el EDS la exageracion amplia lo que el tren sube sobre las ruedas: el rotulo dice la altura dibujada
      check(S, "eds: el rotulo no finge una ampliacion que no hay o dice la altura dibujada", !/dibujo/.test(st.label) || /dibujo \d+ mm/.test(st.label), st.label);
    }
    await page.evaluate(() => window.__app.setRig("orbit", true));
    await frames(page, 3);
    st = await page.evaluate(() => ({ off: document.getElementById("exag").disabled }));
    check(S, `${mode}: al volver a la orbita el deslizador se libera`, !st.off);
    check(S, `${mode}: sin errores`, errors.length === 0, errors.join(" | "));
    await page.close();
  }
}

// ---- 6: farolas ----
async function lamps() {
  const S = "farolas";
  const { page, errors } = await open({ advance: 80 });
  const count = (rig) =>
    page.evaluate(async (r) => {
      const a = window.__app;
      a.setRig(r, true);
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      const poles = [];
      a.scene.traverse((o) => {
        if (o.isMesh && o.material?.color && o.material.color.getHexString() === "5b636c") poles.push(o);
      });
      // lejos de las estaciones (la primera, en 0 m; la siguiente, a 30 km): el unico que oculta es la camara
      const seen = new Set();
      for (let sc = 9000; sc < 9300; sc += 3.7) {
        a.world.scroll(sc);
        seen.add(poles.filter((p) => !p.visible).length);
      }
      return { total: poles.length, hidden: [...seen].sort((x, y) => x - y) };
    }, rig);
  const chase = await count("chase");
  check(S, "Seguir: no hay ninguna farola oculta en ningun punto del recorrido", chase.total === 68 && chase.hidden.length === 1 && chase.hidden[0] === 0, JSON.stringify(chase));
  const orbit = await count("orbit");
  check(S, "Orbita: ninguna oculta", orbit.hidden.length === 1 && orbit.hidden[0] === 0, JSON.stringify(orbit));
  const field = await count("field");
  check(S, "Campo (camara baja): como mucho una oculta a la vez", Math.max(...field.hidden) <= 1, JSON.stringify(field));
  check(S, "sin errores", errors.length === 0, errors.join(" | "));
  await page.close();
}

// ---- 7: el mecanismo se ve en la vista por defecto ----
async function visibility() {
  const S = "visibilidad";
  {
    const { page, errors } = await open({ size: [1920, 918], advance: 80 });
    await page.evaluate(() => window.__app.setRig("orbit", true));
    await frames(page, 4);
    const r = await page.evaluate(() => {
      const a = window.__app;
      const T = window.__THREE;
      const sec = a.scenes.ems.sections[1];
      const box = new T.Box3().setFromObject(sec.air);
      const px = (y) => (-new T.Vector3((box.min.x + box.max.x) / 2, y, box.max.z).project(a.camera).y * 0.5 + 0.5) * innerHeight;
      const skirt = a.scenes.ems.bodyMats.filter((m) => m.userData.skirt);
      return {
        gapPx: Math.abs(px(box.min.y) - px(box.max.y)),
        airVisible: sec.air.visible,
        skirt: skirt.map((m) => ({ transparent: m.transparent, opacity: m.opacity })),
        exag: a.view.exag.ems,
      };
    });
    check(S, "EMS, orbita 1920x918: el hueco mide al menos 4 px", r.gapPx >= 4, r.gapPx.toFixed(1) + " px");
    check(S, "EMS: la banda de aire se dibuja", r.airVisible === true);
    check(S, "EMS: el faldon es translucido por defecto", r.skirt.length >= 3 && r.skirt.every((m) => m.transparent && m.opacity < 0.5), JSON.stringify(r.skirt));
    await page.click('[data-tab="view"]');
    await page.click('[data-body="solid"]');
    await frames(page, 3);
    const solid = await page.evaluate(() => window.__app.scenes.ems.bodyMats.filter((m) => m.userData.skirt).map((m) => m.opacity));
    check(S, "EMS: con la carroceria Solida el faldon es opaco", solid.every((o) => o === 1), JSON.stringify(solid));
    check(S, "EMS: sin errores", errors.length === 0, errors.join(" | "));
    await page.close();
  }
  {
    const { page, errors } = await open({ size: [1920, 918], advance: 150 });
    await page.evaluate(() => window.__app.setMode("eds"));
    await page.evaluate(() => window.__app.setRig("orbit", true));
    await frames(page, 4);
    const r = await page.evaluate(() => {
      const a = window.__app;
      const m = a.scenes.eds.shared.m;
      return { near: m.wallPos.opacity, far: m.wallNeg.opacity, nearT: m.wallPos.transparent, camZ: a.camera.position.z };
    });
    check(S, "EDS, orbita: la pared cercana a la camara es translucida y la lejana opaca", r.camZ > 0 && r.nearT && r.near < 0.5 && r.far === 1, JSON.stringify(r));
    await page.evaluate(() => {
      const a = window.__app;
      a.camera.position.z = -Math.abs(a.camera.position.z);
      a.controls.update();
    });
    await frames(page, 4);
    const flip = await page.evaluate(() => {
      const m = window.__app.scenes.eds.shared.m;
      return { pos: m.wallPos.opacity, neg: m.wallNeg.opacity };
    });
    check(S, "EDS: al pasar al otro lado se invierte cual pared es translucida", flip.neg < 0.5 && flip.pos === 1, JSON.stringify(flip));
    check(S, "EDS: sin errores", errors.length === 0, errors.join(" | "));
    await page.close();
  }
}

// ---- 8: eventos visibles: camara lenta y camara de detalle, y despues todo vuelve ----
async function events() {
  const S = "evento";
  const { page, errors } = await open({ pause: true });
  await page.evaluate(() => {
    const a = window.__app;
    a.setRig("orbit", true);
    a.ui.setTimeScale(5);
  });
  await page.click('[data-tab="ctrl"]');
  // en un equipo lento el evento puede empezar y acabar entre dos lecturas: se anota lo que pase, a 20 ms
  await page.evaluate(() => {
    window.__seen = { gap: false, slow: false };
    setInterval(() => {
      const v = window.__app.view;
      if (v.rig === "gap") window.__seen.gap = true;
      if (v.timeScale < 1) window.__seen.slow = true;
    }, 20);
  });
  await page.click('[data-p="cutPower"]');
  await page.waitForFunction(() => window.__seen.gap && window.__seen.slow, null, { timeout: 15000 }).catch(() => {});
  let st = await page.evaluate(() => window.__seen);
  check(S, "Sin corriente desde la orbita: pasa a la camara de los imanes", st.gap === true, JSON.stringify(st));
  check(S, "Sin corriente: camara lenta", st.slow === true, JSON.stringify(st));
  await page.waitForFunction(() => window.__app.view.rig === "orbit", null, { timeout: 40000 });
  st = await page.evaluate(() => ({ rig: window.__app.view.rig, ts: window.__app.view.timeScale }));
  check(S, "despues vuelve a la orbita y a la escala de tiempo de antes", st.rig === "orbit" && st.ts === 5, JSON.stringify(st));
  // si el usuario cambia de camara durante el evento, no se la quitan
  await page.click('[data-p="kick"]');
  await frames(page, 2);
  await page.evaluate(() => window.__app.setRig("top", true));
  await page.waitForTimeout(6000);
  st = await page.evaluate(() => ({ rig: window.__app.view.rig, ts: window.__app.view.timeScale }));
  check(S, "si el usuario elige otra camara, el evento no se la devuelve a la orbita", st.rig === "top", JSON.stringify(st));
  check(S, "pero la escala de tiempo si se restablece", st.ts === 5, JSON.stringify(st));
  check(S, "sin errores", errors.length === 0, errors.join(" | "));
  await page.close();
}

// ---- 9: visita guiada ----
async function tour() {
  const S = "visita";
  for (const mode of ["ems", "eds"]) {
    const { page, errors } = await open({ pause: false, advance: 0 });
    await page.evaluate((m) => window.__app.setMode(m), mode);
    const before = await page.evaluate(() => {
      const a = window.__app;
      return { rig: a.view.rig, layers: { ...a.view.layers }, ts: a.view.timeScale, paused: a.view.paused };
    });
    await page.click("#tourBtn");
    await frames(page, 2);
    const total = await page.evaluate(() => window.__app.tour.total());
    check(S, `${mode}: la visita tiene entre 4 y 6 pasos`, total >= 4 && total <= 6, String(total));
    for (let i = 0; i < total; i++) {
      const st = await page.evaluate(() => ({
        open: document.getElementById("tourCard").matches(":popover-open"),
        title: document.getElementById("tcTitle").textContent,
        text: document.getElementById("tcText").textContent,
        count: document.getElementById("tcCount").textContent,
        next: document.getElementById("tcNext").textContent,
        rig: window.__app.view.rig,
      }));
      check(S, `${mode}: paso ${i + 1}: la tarjeta se ve con su titulo y su texto`, st.open && st.title.length > 3 && st.text.length > 20 && st.count === `${i + 1} de ${total}`, JSON.stringify(st));
      check(S, `${mode}: paso ${i + 1}: el ultimo dice Terminar`, (i === total - 1) === (st.next === "Terminar"), st.next);
      await page.click('[data-tc="next"]');
      await frames(page, 2);
    }
    const end = await page.evaluate(() => {
      const a = window.__app;
      return { open: document.getElementById("tourCard").matches(":popover-open"), rig: a.view.rig, layers: { ...a.view.layers }, ts: a.view.timeScale, paused: a.view.paused, hold: a.train.hold };
    });
    check(S, `${mode}: al terminar la tarjeta se cierra`, end.open === false, JSON.stringify(end));
    check(S, `${mode}: al terminar vuelve la camara, las capas, la escala de tiempo y la pausa de antes`, end.rig === before.rig && JSON.stringify(end.layers) === JSON.stringify(before.layers) && end.ts === before.ts && end.paused === before.paused && end.hold === false, JSON.stringify({ before, end }));
    // salir a la mitad con Esc
    await page.click("#tourBtn");
    await frames(page, 2);
    await page.keyboard.press("Escape");
    await frames(page, 2);
    const esc = await page.evaluate(() => ({ open: document.getElementById("tourCard").matches(":popover-open"), active: window.__app.tour.state.active }));
    check(S, `${mode}: Esc sale de la visita`, !esc.open && !esc.active, JSON.stringify(esc));
    check(S, `${mode}: sin errores`, errors.length === 0, errors.join(" | "));
    await page.close();
  }
}

// ---- 10: pestanas y teclado ----
async function tabs() {
  const S = "pestanas";
  const { page, errors } = await open();
  const sel = () => page.evaluate(() => [...document.querySelectorAll("[data-tab]")].map((b) => b.getAttribute("aria-selected") === "true").join());
  check(S, "las pestanas son un tablist con tabpanel asociado", await page.evaluate(() => !!document.querySelector('[role=tablist]') && document.querySelectorAll('[role=tabpanel]').length === 3 && document.getElementById("tab-data").getAttribute("aria-controls") === "pane-data"));
  await page.focus("#tab-data");
  await page.keyboard.press("ArrowRight");
  check(S, "flecha derecha pasa a Control y lo enfoca", (await sel()) === "false,true,false" && (await page.evaluate(() => document.activeElement.id)) === "tab-ctrl");
  await page.keyboard.press("End");
  check(S, "Fin va a la ultima", (await sel()) === "false,false,true");
  await page.keyboard.press("ArrowRight");
  check(S, "flecha derecha de la ultima vuelve a la primera", (await sel()) === "true,false,false");
  check(S, "solo la pestana activa entra en el orden de tabulacion", await page.evaluate(() => [...document.querySelectorAll("[data-tab]")].filter((b) => b.tabIndex === 0).length === 1));
  check(S, "sin errores", errors.length === 0, errors.join(" | "));
  await page.close();
}

// ---- 11: estado en el enlace y memoria ----
async function state() {
  const S = "estado";
  {
    const { page, errors } = await open({ query: "#/?m=eds&c=top&t=20&tab=view", pause: false, advance: 0 });
    await frames(page, 3);
    const r = await page.evaluate(() => ({ mode: document.documentElement.dataset.mode, rig: window.__app.view.rig, ts: window.__app.view.timeScale, tab: window.__app.ui.getTab() }));
    check(S, "un enlace con estado abre ese modo, camara, escala de tiempo y pestana", r.mode === "eds" && r.rig === "top" && r.ts === 20 && r.tab === "view", JSON.stringify(r));
    check(S, "sin errores", errors.length === 0, errors.join(" | "));
    await page.close();
  }
  {
    const { page, errors } = await open({ pause: false, advance: 0 });
    await page.evaluate(() => {
      window.__app.setRig("gap", true);
      window.__app.ui.setTimeScale(60);
    });
    await page.waitForFunction(() => (localStorage.getItem("maglev-state") ?? "").includes('"c":"gap"'), null, { timeout: 20000 });
    check(S, "la vista se guarda", true);
    check(S, "la barra de direcciones no cambia sola (recargar no cuenta como enlace con estado)", await page.evaluate(() => !location.hash.includes("c=")));
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => window.__app, null, { timeout: 30000 });
    await frames(page, 2);
    const r = await page.evaluate(() => ({ mode: document.documentElement.dataset.mode, ts: window.__app.view.timeScale, title: document.title }));
    check(S, "al recargar vuelve el modo y la escala de tiempo de antes", r.mode === "ems" && r.ts === 60, JSON.stringify(r));
    check(S, "el titulo de la pagina dice donde estas", /Simulaci/.test(r.title), r.title);
    check(S, "sin errores", errors.length === 0, errors.join(" | "));
    await page.close();
  }
}

// ---- 12: la lupa provoca fallas ----
async function loupeFails() {
  const S = "lupa";
  const { page, errors } = await open({ pause: true });
  await page.evaluate(() => {
    window.__app.ui.loupe.setOpen(true);
    window.__app.setRig("orbit", true);
    window.__seen = { gap: false };
    setInterval(() => { if (window.__app.view.rig === "gap") window.__seen.gap = true; }, 20);
  });
  await frames(page, 2);
  const btns = await page.evaluate(() => [...document.querySelectorAll("#lpFail [data-fail]")].map((b) => b.dataset.fail));
  check(S, "EMS: la lupa ofrece Sin control, Sin corriente y Golpe", btns.join() === "ctrlOff,cutPower,kick", btns.join());
  await page.click('#lpFail [data-fail="cutPower"]');
  await page.waitForFunction(() => window.__seen.gap, null, { timeout: 15000 }).catch(() => {});
  const r = await page.evaluate(() => ({ gap: window.__seen.gap, down: window.__app.train.sections.every((s) => s.powered === false || s.fallen || s.contact || s.I < 49) }));
  check(S, "pulsar Sin corriente en la lupa provoca el evento (camara de los imanes)", r.gap === true, JSON.stringify(r));
  const lab = await page.evaluate(() => document.getElementById("labels").textContent);
  check(S, "con la lupa abierta no se repite 'Levita a' en 3D", !/Levita a/.test(lab), lab);
  check(S, "sin errores", errors.length === 0, errors.join(" | "));
  await page.close();
}

const only = process.env.QA_ONLY?.split(",");
// ---- viaje con distancia fija, desde el cuadro de mando (con el panel cerrado) ----
async function trip() {
  const S = "viaje";
  const { page, errors } = await open({ advance: 0 });
  await page.click("#panelBtn"); // el panel cerrado es el caso normal: el viaje se pide desde el cuadro de mando
  await frames(page, 3);
  const vis = await page.evaluate(() => {
    const inView = (id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; };
    return { dist: inView("tripDist"), btn: inView("tripBtn"), ts: inView("tsBtn"), side: document.getElementById("side").classList.contains("closed") };
  });
  check(S, "con el panel cerrado, la distancia, el boton y la escala estan a la vista", vis.dist && vis.btn && vis.ts && vis.side, JSON.stringify(vis));
  const gone = await page.evaluate(() => ["hGap", "hGapBar", "hTarget", "timeBtns"].filter((id) => document.getElementById(id)));
  check(S, "el cuadro de mando ya no trae entrehierro, objetivo ni cinco botones de escala", gone.length === 0, gone.join(","));
  await page.fill("#tripDist", "");
  await page.click("#tripBtn");
  check(S, "sin distancia no arranca ningun viaje", await page.evaluate(() => window.__app.train.trip === null));
  await page.fill("#tripDist", "1");
  await frames(page, 2);
  const hint = await page.evaluate(() => ({ t: document.getElementById("tripHint").textContent, k: document.getElementById("tripHint").dataset.k }));
  check(S, "la estimacion avisa de que 1 km no llega a la velocidad maxima", /^Con 1 km solo llega a unos \d+ km\/h\. Para 399 hacen falta \d+ km$/.test(hint.t) && hint.k === "warn", JSON.stringify(hint));
  await page.fill("#tripDist", "60");
  await frames(page, 2);
  const hint2 = await page.evaluate(() => document.getElementById("tripHint").textContent);
  check(S, "con 60 km la estimacion dice que llega a 399", hint2 === "Llegará a 399 km/h", hint2);
  await page.fill("#tripDist", "1");
  await page.click("#tripBtn");
  await page.evaluate(() => { const a = window.__app; a.ui.setPaused(true); a.train.advance(40); });
  await frames(page, 3);
  const mid = await page.evaluate(() => ({ trip: !!window.__app.train.trip, done: window.__app.train.trip?.done, noteHidden: document.getElementById("tripNote").hidden, pill: document.getElementById("hState").hidden }));
  check(S, "durante el viaje no hay aviso de llegada y no se rotula 'acelerando'", mid.trip && !mid.done && mid.noteHidden && mid.pill, JSON.stringify(mid));
  await page.evaluate(() => window.__app.train.advance(400));
  await frames(page, 4);
  const end = await page.evaluate(() => {
    const t = window.__app.train;
    const n = document.getElementById("tripNote");
    const pill = document.getElementById("hState");
    return { x: t.x, v: t.v, done: t.trip?.done, hold: t.hold, pill: pill.hidden ? "" : pill.textContent, noteShown: !n.hidden && n.getBoundingClientRect().width > 0, note: document.getElementById("tripNoteTxt").textContent };
  });
  check(S, "se detiene a 1 km (error < 1,5 m)", end.done && end.v === 0 && Math.abs(end.x - 1000) < 1.5, JSON.stringify(end));
  check(S, "al llegar aparece el resumen aunque el panel este cerrado", end.noteShown && /^Llegó: 1 km en/.test(end.note) && end.pill === "Viaje terminado", JSON.stringify(end));
  check(S, "el resumen dice que la distancia no dio para la velocidad pedida", /La distancia no dio para llegar a 399 km\/h/.test(end.note), end.note);
  await page.click("#tripNoteX");
  check(S, "el aviso se cierra", await page.evaluate(() => document.getElementById("tripNote").hidden));
  // Salir repite el viaje (no pasa a recorrido continuo)
  await page.evaluate(() => { const a = window.__app; a.depart(); a.train.advance(5); });
  await frames(page, 3);
  const leg2 = await page.evaluate(() => { const t = window.__app.train; return { trip: !!t.trip, done: t.trip?.done, next: t.nextStation, tgt: Math.round(t.targetSpeed * 3.6), hid: document.getElementById("tripNote").hidden }; });
  check(S, "Salir repite el viaje con la misma distancia y velocidad", leg2.trip && leg2.done === false && leg2.next === 2000 && leg2.tgt === 399 && leg2.hid, JSON.stringify(leg2));
  await page.evaluate(() => window.__app.train.advance(400));
  await frames(page, 4);
  const end2 = await page.evaluate(() => { const t = window.__app.train; return { x: t.x, done: t.trip?.done, note: document.getElementById("tripNoteTxt").textContent }; });
  check(S, "el segundo tramo termina a 2 km y su tiempo es el del tramo", end2.done && Math.abs(end2.x - 2000) < 1.5 && /^Llegó: 1 km en 1 min 3\d s|^Llegó: 1 km en 1 min 4\d s|^Llegó: 1 km en 1 min 2\d s/.test(end2.note), JSON.stringify(end2));
  await page.click("#tripBtn");
  await frames(page, 2);
  const again = await page.evaluate(() => ({ x: window.__app.train.x, done: window.__app.train.trip?.done, noteHidden: document.getElementById("tripNote").hidden }));
  check(S, "pulsar de nuevo repite el viaje desde el origen", again.x < 5 && again.done === false && again.noteHidden, JSON.stringify(again));
  // cambiar de modo en pleno viaje no deja texto de un viaje que ya no existe
  await page.evaluate(() => window.__app.ui.selectTab("ctrl"));
  await page.click("#panelBtn");
  await page.click('[data-mode="eds"]');
  await page.evaluate(() => window.__app.train.advance(0.1));
  await frames(page, 3);
  const stale = await page.evaluate(() => document.getElementById("tripRes").textContent);
  check(S, "al cambiar de modo se borra el texto del viaje", stale === "", stale);
  await page.click('[data-mode="ems"]');
  // un solo boton de escala que cicla
  const ts = await page.evaluate(() => {
    const b = document.getElementById("tsBtn");
    const out = [b.textContent];
    for (let i = 0; i < 5; i++) { b.click(); out.push(b.textContent + "=" + window.__app.view.timeScale); }
    return out;
  });
  check(S, "el boton de escala cicla x5, x20, x60, x¼, x1, x5", JSON.stringify(ts) === JSON.stringify(["x5", "x20=20", "x60=60", "x¼=0.25", "x1=1", "x5=5"]), JSON.stringify(ts));
  await page.focus("#tripDist");
  await page.keyboard.press("p"); // escribir en el campo no dispara atajos
  check(S, "las teclas dentro del campo no activan atajos", await page.evaluate(() => !window.__app.view.parts));
  check(S, "sin errores", errors.length === 0, errors.join(" | "));
  await page.close();
}

const scenarios = { hints, ctrlOff, cutPower, reset, exaggeration, lamps, visibility, events, tour, tabs, state, loupeFails, trip };
for (const [name, fn] of Object.entries(scenarios)) {
  if (only && !only.includes(name)) continue;
  try {
    await fn();
  } catch (err) {
    checks++;
    failures.push(`[${name}] excepcion del script: ${err?.message ?? err}`);
    console.log(`FALLA [${name}] excepcion del script: ${err?.message ?? err}`);
  }
}
await browser.close();
console.log(`\n${checks} comprobaciones, ${failures.length} fallos`);
for (const f of failures) console.log(" - " + f);
process.exit(failures.length ? 1 : 0);
