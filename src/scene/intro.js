// apertura de la simulacion: unos segundos de primer plano sobre el mecanismo de levitacion y
// despues la vista general. es codigo puro (claves, interpolacion, textos), asi se prueba sin
// navegador; el estado vive en main.js.
//
// ems: se ve desde fuera, de costado y casi a ras, el hueco entre la cara inferior de la viga
//      (estator) y las caras polares del iman, con el coche aun sobre los patines; el tren
//      despega (el hueco baja de 20 a 10 mm) y la camara se aleja hasta la orbita.
// eds: corte transversal (como la camara imanes) con la pared y sus bobinas en 8, el iman
//      superconductor y el coche, que sube al recogerse las ruedas; despues la orbita.
//
// todas las poses son { pos, tgt, fov } en coordenadas del mundo.

const smoother = (x) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const lerp = (a, b, k) => a + (b - a) * k;
const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

export const INTRO = {
  ems: {
    duration: 8.4, // s de tiempo real
    hold: 0.8, // el tren espera sobre los patines hasta aqui
    preAdvance: 0, // s de viaje que se adelantan sin dibujar
    tsClose: 1, // escala de tiempo durante el primer plano (el despegue dura 3,3 s)
    tsAt: 4.6, // y a partir de aqui, la habitual
    closeUntil: 6.0, // hasta aqui: rayos x, campo realzado, rotulos del hueco
    exag: 24, // exageracion del entrehierro en el primer plano
    exagRamp: [6.0, 7.6], // y como vuelve a la normal
    keys: [
      { t: 0, pos: [2.8, 6.25, 5.6], tgt: [0, 6.22, 1.15], fov: 30 },
      { t: 1.4, pos: [2.8, 6.25, 5.6], tgt: [0, 6.22, 1.15], fov: 30 },
      { t: 4.6, pos: [-5.5, 6.6, 5.0], tgt: [0.5, 6.25, 1.15], fov: 32 },
      { t: 6.0, pos: [-9, 6.6, 9], tgt: [0, 6.4, 1], fov: 40 },
    ],
  },
  eds: {
    duration: 7.4,
    hold: 0,
    preAdvance: 44, // las ruedas se recogen a los 52 s de viaje
    tsClose: 4,
    tsAt: 4.4,
    closeUntil: 4.4,
    bodyRig: "gap", // se ve en corte transversal, como la camara imanes: pared con bobinas, iman y coche
    exag: 12,
    exagRamp: [4.4, 5.8],
    keys: [
      { t: 0, pos: [4.2, 6.95, 0.01], tgt: [0, 6.85, 1.75], fov: 30 },
      { t: 1.4, pos: [4.2, 6.95, 0.01], tgt: [0, 6.85, 1.75], fov: 30 },
      { t: 4.4, pos: [7.5, 8.2, 5.8], tgt: [0, 6.6, 0.9], fov: 36 },
    ],
  },
};

/** pose de la camara en el instante t (s); `orbit` es la pose final, { pos, tgt, fov }. */
export function introPose(cfg, t, orbit) {
  const keys = [...cfg.keys, { t: cfg.duration, ...orbit }];
  if (t <= keys[0].t) return { pos: keys[0].pos, tgt: keys[0].tgt, fov: keys[0].fov };
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) {
      const a = keys[i - 1];
      const b = keys[i];
      const k = smoother((t - a.t) / (b.t - a.t));
      return { pos: lerp3(a.pos, b.pos, k), tgt: lerp3(a.tgt, b.tgt, k), fov: lerp(a.fov, b.fov, k) };
    }
  }
  const z = keys[keys.length - 1];
  return { pos: z.pos, tgt: z.tgt, fov: z.fov };
}

/** exageracion del entrehierro: entera, para no reconstruir las lineas de campo a cada fotograma. */
export function introExag(cfg, t, base) {
  const [t0, t1] = cfg.exagRamp;
  if (t <= t0) return cfg.exag;
  return Math.round(lerp(cfg.exag, base, smoother((t - t0) / (t1 - t0))));
}

export const introTimeScale = (cfg, t, base) => (t < cfg.tsAt ? cfg.tsClose : base);
export const introXray = (cfg, t) => t < cfg.closeUntil;

/** pie de texto segun lo que pasa en el modelo; cadena vacia cuando ya no hace falta. */
export function introCaption(mode, t, cfg, tel) {
  if (t >= cfg.closeUntil) return "";
  if (mode === "ems") {
    if (tel.gapMm > 15) return "Parado: el coche descansa sobre patines, a 20 mm de la viga";
    if (!tel.levitated) return "El imán atrae hacia arriba y el coche despega";
    return "Levita a 10 mm sin tocar la viga. Aquí el hueco está ampliado";
  }
  if (tel.wheelsDown) return "Sobre ruedas: todavía no levita";
  return "Pasados los 150 km/h las ruedas se recogen y las bobinas lo empujan hacia arriba";
}
