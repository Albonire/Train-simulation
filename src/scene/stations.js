// estaciones: anden elevado sobre columnas junto a la via, con parapeto de
// vidrio, marquesina, escalera al suelo y un edificio de acceso.
// hay tres instancias que se reciclan: las estaciones estan en los multiplos de
// la distancia entre estaciones y se muestran las mas cercanas al tren.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { stationFootprint, PLATFORM_WIDTH } from "./clearance.js";

const LEN = 110; // longitud del anden, m
const WIDTH = PLATFORM_WIDTH; // ancho del anden, m
const COLS = 15; // columnas por fila

function signTexture(text, sub) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const g = c.getContext("2d");
  const render = () => {
    g.fillStyle = "#0f2a44";
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = "#ffffff";
    g.font = '700 110px "Barlow", system-ui, sans-serif';
    g.textAlign = "center";
    g.fillText(text, 512, 140);
    g.fillStyle = "#8fd3ff";
    g.font = '500 54px "Barlow", system-ui, sans-serif';
    g.fillText(sub, 512, 215);
  };
  render();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  // cuando las fuentes asincronas cargan se redibuja el rotulo
  if (typeof document !== "undefined" && document.fonts?.ready) {
    document.fonts.ready.then(() => {
      render();
      t.needsUpdate = true;
    });
  }
  return t;
}

// materiales compartidos por las tres instancias
const M = {
  concrete: new THREE.MeshStandardMaterial({ color: "#c3c8ce", roughness: 0.9 }),
  column: new THREE.MeshStandardMaterial({ color: "#aeb4bb", roughness: 0.85 }),
  roof: new THREE.MeshStandardMaterial({ color: "#e6ebf0", roughness: 0.45, metalness: 0.35 }),
  steel: new THREE.MeshStandardMaterial({ color: "#4a525b", roughness: 0.55, metalness: 0.7 }),
  glass: new THREE.MeshStandardMaterial({ color: "#a9d2ef", roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.32, depthWrite: false }),
  // la franja va a 4 mm de la losa: sin polygonoffset se pelearia con ella a distancia (depth.js)
  edge: new THREE.MeshStandardMaterial({ color: "#f2c230", roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
  lamp: new THREE.MeshStandardMaterial({ color: "#fff6e0", emissive: "#fff1d0", emissiveIntensity: 0.9 }),
  build: new THREE.MeshStandardMaterial({ color: "#d9dde2", roughness: 0.8 }),
  window: new THREE.MeshStandardMaterial({ color: "#274868", roughness: 0.15, metalness: 0.6 }),
};

/** escalera recta de `rise` metros (huella 0.3, contrahuella <= 0.18) que baja hacia -x. */
function stairGeometry(rise, width) {
  const n = Math.max(2, Math.ceil(rise / 0.18));
  const h = rise / n;
  const geos = [];
  for (let i = 0; i < n; i++) {
    // escalon i: su cara superior a (i + 1) * h, apoyado hasta el suelo
    const top = (i + 1) * h;
    const g = new THREE.BoxGeometry(0.3, top, width);
    g.translate(-(n - i) * 0.3 + 0.15, top / 2, 0);
    geos.push(g);
  }
  return mergeGeometries(geos);
}

function buildStation() {
  const g = new THREE.Group();
  const mk = (geo, mat, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    return m;
  };
  const slab = mk(new THREE.BoxGeometry(LEN, 0.35, WIDTH), M.concrete);
  const beam = mk(new THREE.BoxGeometry(LEN, 0.6, 0.5), M.concrete); // viga de borde
  const edge = mk(new THREE.PlaneGeometry(LEN, 0.3), M.edge, false); // franja de seguridad
  edge.rotation.x = -Math.PI / 2;
  const roof = mk(new THREE.BoxGeometry(LEN + 4, 0.18, WIDTH + 1.4), M.roof);
  const fascia = mk(new THREE.BoxGeometry(LEN + 4, 0.45, 0.12), M.steel);
  const lamp = mk(new THREE.BoxGeometry(LEN - 6, 0.06, 0.25), M.lamp, false);
  // parapeto en dos tramos (hueco frente a la escalera), largo unitario escalado en x
  const parapets = [0, 1].map(() => mk(new THREE.BoxGeometry(1, 1.1, 0.04), M.glass, false));
  const rails = [0, 1].map(() => mk(new THREE.BoxGeometry(1, 0.06, 0.1), M.steel));
  const landing = mk(new THREE.BoxGeometry(2.4, 0.35, 2.4), M.concrete);
  const columns = [];
  for (let i = 0; i < COLS * 2; i++) {
    const c = mk(new THREE.CylinderGeometry(0.32, 0.38, 1, 14), M.column);
    columns.push(c);
  }
  const posts = [];
  for (let i = 0; i < COLS; i++) {
    const p = mk(new THREE.CylinderGeometry(0.1, 0.1, 1, 10), M.steel);
    posts.push(p);
  }
  const stairs = mk(new THREE.BufferGeometry(), M.concrete);
  const stairRail = mk(new THREE.BoxGeometry(1, 0.06, 0.08), M.steel);
  const build = mk(new THREE.BoxGeometry(34, 5.5, 12), M.build);
  const glass = mk(new THREE.BoxGeometry(32, 2.6, 0.2), M.window, false);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), new THREE.MeshBasicMaterial({ toneMapped: false }));
  g.add(slab, beam, edge, roof, fascia, lamp, ...parapets, ...rails, landing, ...columns, ...posts, stairs, stairRail, build, glass, sign);
  g.userData = { slab, beam, edge, roof, fascia, lamp, parapets, rails, landing, columns, posts, stairs, stairRail, build, glass, sign };
  return g;
}

export function createStations() {
  const group = new THREE.Group();
  const items = [0, 1, 2].map(() => ({ obj: buildStation(), k: null }));
  for (const it of items) group.add(it.obj);
  const textures = new Map();

  /** cfg: { floory (cara superior del anden), zin (borde del anden junto a la via) } */
  function place(obj, cfg) {
    const u = obj.userData;
    const { floorY, zIn } = cfg;
    const sg = -1; // el anden va al lado -z, lejos de la camara por defecto
    const z = (d) => sg * (zIn + d); // d: distancia desde el borde del anden
    const zc = z(WIDTH / 2);
    u.slab.position.set(0, floorY - 0.175, zc);
    u.beam.position.set(0, floorY - 0.65, z(0.25));
    u.edge.position.set(0, floorY + 0.004, z(0.35));
    // columnas: dos filas bajo el anden
    const under = floorY - 0.35;
    u.columns.forEach((c, i) => {
      const row = i < COLS ? 0 : 1;
      const k = i % COLS;
      c.scale.set(1, under, 1);
      c.position.set(-LEN / 2 + 5 + (k * (LEN - 10)) / (COLS - 1), under / 2, z(row ? WIDTH - 1.1 : 1.1));
    });
    // marquesina sobre postes delgados en el lado exterior
    const roofY = floorY + 3.7;
    u.roof.position.set(0, roofY, z(WIDTH / 2 + 0.2));
    u.fascia.position.set(0, roofY - 0.05, z(-0.48));
    u.lamp.position.set(0, roofY - 0.12, z(1.6));
    u.posts.forEach((p, i) => {
      p.scale.set(1, roofY - floorY, 1);
      p.position.set(-LEN / 2 + 4 + (i * (LEN - 8)) / (COLS - 1), floorY + (roofY - floorY) / 2, z(WIDTH - 0.35));
    });
    // escalera al suelo, por fuera del parapeto, bajando hacia -x desde un rellano
    const xTop = -LEN / 2 + 30;
    const gap = [xTop, xTop + 2.4];
    // parapeto de vidrio con pasamanos en el borde exterior, abierto en el rellano
    [[-LEN / 2, gap[0]], [gap[1], LEN / 2]].forEach(([a, b], i) => {
      u.parapets[i].scale.set(b - a, 1, 1);
      u.parapets[i].position.set((a + b) / 2, floorY + 0.55, z(WIDTH - 0.05));
      u.rails[i].scale.set(b - a, 1, 1);
      u.rails[i].position.set((a + b) / 2, floorY + 1.12, z(WIDTH - 0.05));
    });
    u.landing.position.set(xTop + 1.2, floorY - 0.175, z(WIDTH + 1.2));
    u.stairs.geometry.dispose();
    u.stairs.geometry = stairGeometry(floorY, 2.2);
    u.stairs.position.set(xTop, 0, z(WIDTH + 1.2));
    const run = Math.ceil(floorY / 0.18) * 0.3;
    u.stairRail.scale.set(Math.hypot(run, floorY), 1, 1);
    u.stairRail.rotation.z = Math.atan2(floorY, run);
    u.stairRail.position.set(xTop - run / 2, floorY / 2 + 1.0, z(WIDTH + 2.3));
    // edificio de acceso al pie de la escalera
    u.build.position.set(xTop - run - 18, 2.75, z(WIDTH + 7));
    u.glass.position.set(xTop - run - 18, 2.4, z(WIDTH + 0.95));
    // cartel sobre la marquesina, mirando a la via
    u.sign.position.set(10, roofY + 1.75, z(1.2));
  }

  return {
    group,
    /** luces de la marquesina y ventanas del edificio: apagadas de dia, encendidas al atardecer. */
    setNight(on) {
      M.lamp.emissiveIntensity = on ? 2.4 : 0.05;
      M.window.emissive.set(on ? "#ffd9a0" : "#000000");
      M.window.emissiveIntensity = on ? 0.6 : 0;
    },
    /**
     * huella de las estaciones visibles en coordenadas de pista ({ x0, x1, z0, z1 }): el anden, la
     * escalera y el edificio de acceso. lo que el entorno ponga ahi (postes, cerca, arbustos) se oculta.
     */
    footprints(cfg) {
      const out = [];
      for (const it of items) {
        if (it.xTrack === undefined || !it.obj.visible) continue;
        out.push(stationFootprint(it.xTrack, cfg.zIn));
      }
      return out;
    },
    /** scenter: coordenada de pista del centro del tren; lentrain: largo del tren */
    update(sCenter, lenTrain, spacing, cfg) {
      const k0 = Math.round((sCenter + lenTrain / 2) / spacing);
      items.forEach((it, j) => {
        const k = k0 + j - 1;
        const xTrack = k * spacing - lenTrain / 2; // centro del tren detenido en la estacion k
        const x = xTrack - sCenter;
        it.xTrack = xTrack;
        it.obj.visible = k >= 0 && Math.abs(x) < 1200;
        it.obj.position.x = x;
        if (it.cfgKey !== `${cfg.floorY}|${cfg.zIn}`) {
          place(it.obj, cfg);
          it.cfgKey = `${cfg.floorY}|${cfg.zIn}`;
        }
        if (it.k !== k || it.spacing !== spacing) {
          it.k = k;
          it.spacing = spacing;
          const key = `${k}|${spacing}`;
          if (!textures.has(key)) textures.set(key, signTexture(`ESTACIÓN ${k + 1}`, `km ${((k * spacing) / 1000).toFixed(0)}`));
          it.obj.userData.sign.material.map = textures.get(key);
          it.obj.userData.sign.material.needsUpdate = true;
        }
      });
    },
  };
}
