// Mundo: renderer, luces, cielo, terreno y pool de tramos de via.
// El tren esta siempre en x = 0 (centrado); lo que se desplaza es la via. Asi no
// hay perdida de precision en recorridos de decenas de kilometros.

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

function skyTexture(top, mid, bottom) {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(0.55, mid);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// generador determinista (las texturas salen iguales en cada carga)
function rng(seed) {
  let x = seed;
  return () => ((x = (x * 16807) % 2147483647) / 2147483647);
}

function groundTexture() {
  // hierba: base uniforme y briznas finas de bajo contraste (el mosaico no se nota)
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#6e8a57";
  g.fillRect(0, 0, 512, 512);
  const rnd = rng(1234);
  for (let i = 0; i < 9000; i++) {
    const l = 0.82 + rnd() * 0.36;
    g.fillStyle = `rgba(${Math.round(110 * l)},${Math.round(140 * l)},${Math.round(86 * l)},0.35)`;
    g.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 2.5, 1 + rnd() * 2.5);
  }
  for (let i = 0; i < 70; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 18 + rnd() * 50;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = rnd() < 0.5;
    grd.addColorStop(0, dark ? "rgba(70,96,58,0.16)" : "rgba(150,170,110,0.13)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function gravelTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#9c978b";
  g.fillRect(0, 0, 256, 256);
  const rnd = rng(77);
  for (let i = 0; i < 5000; i++) {
    const l = 0.7 + rnd() * 0.5;
    g.fillStyle = `rgba(${Math.round(160 * l)},${Math.round(155 * l)},${Math.round(142 * l)},0.55)`;
    g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const THEMES = {
  light: { sky: ["#3c79c6", "#9ac6ee", "#e2edf6"], fog: "#d3e4f2", near: 320, far: 2300, sun: ["#fff3dd", 2.4, [-40, 70, 45]], hemi: ["#bcd8ff", "#6c7f55", 0.55], exposure: 1.05, ground: "#ffffff", hills: "#7d98a8" },
  dark: { sky: ["#0d1a2d", "#33507a", "#e0a473"], fog: "#5b6a80", near: 260, far: 2000, sun: ["#ffc996", 1.7, [-90, 32, 50]], hemi: ["#7f9cc9", "#3b4433", 0.4], exposure: 0.98, ground: "#c9cdbf", hills: "#465a72" },
};

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  const skies = Object.fromEntries(Object.entries(THEMES).map(([k, v]) => [k, skyTexture(...v.sky)]));
  scene.background = skies.light;
  scene.fog = new THREE.Fog(THEMES.light.fog, THEMES.light.near, THEMES.light.far);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const sun = new THREE.DirectionalLight("#fff3dd", 2.4);
  sun.position.set(-40, 70, 45);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -70; sc.right = 70; sc.top = 40; sc.bottom = -40; sc.near = 10; sc.far = 220;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight("#bcd8ff", "#6c7f55", 0.55);
  scene.add(hemi);

  // ---- terreno ----
  const gTex = groundTexture();
  const TILE = 40;
  gTex.repeat.set(6000 / TILE, 6000 / TILE);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(6000, 6000),
    new THREE.MeshStandardMaterial({ map: gTex, roughness: 1, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // corredor de mantenimiento bajo la via (grava), se desplaza con el terreno
  const vTex = gravelTexture();
  const VTILE = 12;
  vTex.repeat.set(3000 / VTILE, 1);
  const corridor = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 9),
    new THREE.MeshStandardMaterial({ map: vTex, roughness: 1, metalness: 0 }),
  );
  corridor.rotation.x = -Math.PI / 2;
  corridor.position.y = 0.03;
  corridor.receiveShadow = true;
  scene.add(corridor);

  // colinas lejanas: un anillo fijo (lo bastante lejos para que no se note que no se desplaza)
  const hillMat = new THREE.MeshStandardMaterial({ color: THEMES.light.hills, roughness: 1, flatShading: true });
  const hills = new THREE.Group();
  const hr = rng(4321);
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + hr() * 0.08;
    const d = 1250 + hr() * 450;
    const r = 120 + hr() * 220;
    const h = 40 + hr() * 120;
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6 + Math.floor(hr() * 3)), hillMat);
    m.position.set(Math.cos(a) * d, h / 2 - 4, Math.sin(a) * d);
    m.rotation.y = hr() * Math.PI;
    hills.add(m);
  }
  scene.add(hills);

  function setTheme(name) {
    const th = THEMES[name] ?? THEMES.light;
    scene.background = skies[name] ?? skies.light;
    scene.fog.color.set(th.fog);
    scene.fog.near = th.near;
    scene.fog.far = th.far;
    sun.color.set(th.sun[0]);
    sun.intensity = th.sun[1];
    sun.position.set(...th.sun[2]);
    hemi.color.set(th.hemi[0]);
    hemi.groundColor.set(th.hemi[1]);
    hemi.intensity = th.hemi[2];
    renderer.toneMappingExposure = th.exposure;
    ground.material.color.set(th.ground);
    hillMat.color.set(th.hills);
  }

  // ---- arboles (instanciados, se recolocan con el desplazamiento) ----
  // dos especies: coniferas (cono) y frondosos (copa redonda), con tono variable
  const TREES = 520;
  const mk = (geo, color) => {
    const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.92, flatShading: true }), TREES);
    m.castShadow = true;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(m);
    return m;
  };
  const coneGeo = new THREE.ConeGeometry(2.2, 7, 7);
  coneGeo.translate(0, 3.5 + 1.6, 0);
  const crownGeo = new THREE.IcosahedronGeometry(2.6, 1);
  crownGeo.translate(0, 5.2, 0);
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.4, 3.2, 6);
  trunkGeo.translate(0, 1.6, 0);
  const cones = mk(coneGeo, "#ffffff");
  const crowns = mk(crownGeo, "#ffffff");
  const trunks = mk(trunkGeo, "#5a4030");
  const CELL = 60;
  const CELLS = 40; // ventana de +-1200 m
  const hash = (a, b) => {
    let h = (a * 374761393 + b * 668265263) ^ 0x5bd1e995;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const tmp = new THREE.Object3D();
  const col = new THREE.Color();
  const CONIFER = ["#2b5f37", "#335f3a", "#24543a"];
  const BROAD = ["#4f7a3a", "#5d8540", "#6f8c42", "#47703d"];

  function updateTrees(s) {
    const base = Math.floor(s / CELL);
    let nc = 0, nb = 0, nt = 0;
    for (let i = -CELLS / 2; i < CELLS / 2; i++) {
      const cell = base + i;
      for (let k = 0; k < 14; k++) {
        const r1 = hash(cell, k * 5 + 1), r2 = hash(cell, k * 5 + 2), r3 = hash(cell, k * 5 + 3), r4 = hash(cell, k * 5 + 4);
        if (r3 < 0.42) continue;
        const x = cell * CELL + r1 * CELL - s;
        // franja libre de 18 m a cada lado de la via y bosquetes mas densos lejos
        const side = r2 < 0.5 ? -1 : 1;
        const z = side * (18 + Math.pow(r4, 0.7) * 230);
        const sc2 = 0.75 + r3 * 0.9;
        tmp.position.set(x, 0, z);
        tmp.rotation.set(0, r1 * 6.28, 0);
        tmp.scale.set(sc2, sc2 * (0.85 + r2 * 0.3), sc2);
        tmp.updateMatrix();
        if (nt < TREES) trunks.setMatrixAt(nt++, tmp.matrix);
        if (r4 < 0.55 && nc < TREES) {
          cones.setMatrixAt(nc, tmp.matrix);
          cones.setColorAt(nc++, col.set(CONIFER[Math.floor(r1 * 3) % 3]));
        } else if (nb < TREES) {
          crowns.setMatrixAt(nb, tmp.matrix);
          crowns.setColorAt(nb++, col.set(BROAD[Math.floor(r2 * 4) % 4]));
        }
      }
    }
    cones.count = nc;
    crowns.count = nb;
    trunks.count = nt;
    for (const m of [cones, crowns, trunks]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  // ---- pool de tramos de via ----
  function makePool(build, seg, count) {
    const slots = Array.from({ length: count }, () => build());
    const group = new THREE.Group();
    for (const s of slots) group.add(s);
    return {
      group,
      slots,
      update(sCenter) {
        const base = Math.floor(sCenter / seg);
        const half = Math.floor(count / 2);
        for (let j = 0; j < count; j++) {
          slots[j].position.x = (base - half + j) * seg - sCenter;
        }
      },
    };
  }

  function scroll(s) {
    gTex.offset.x = s / TILE;
    vTex.offset.x = s / VTILE;
    updateTrees(s);
  }

  return { renderer, scene, sun, ground, gTex, GROUND_TILE: TILE, updateTrees, scroll, makePool, setTheme };
}
