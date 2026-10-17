// Mundo: renderer, cielo, luces, terreno y pool de tramos de via.
// El tren esta siempre en x = 0 (centrado); lo que se desplaza es la via. Asi no
// hay perdida de precision en recorridos de decenas de kilometros.

import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { fieldTexture, rng } from "./textures.js";
import { createMountains, createClouds } from "./terrain.js";
import { createProps } from "./props.js";
import { DETAIL, setVisualSpeed } from "./depth.js";
import { cameraFootprint } from "./clearance.js";
import { occludes, segmentPointDistance, treeSpheres, trainSightPoints } from "./sightline.js";

function groundTexture() {
  // hierba: base uniforme y briznas finas de bajo contraste (el mosaico no se nota)
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#7a9660";
  g.fillRect(0, 0, 512, 512);
  const rnd = rng(1234);
  for (let i = 0; i < 12000; i++) {
    const l = 0.8 + rnd() * 0.4;
    g.fillStyle = `rgba(${Math.round(110 * l)},${Math.round(140 * l)},${Math.round(86 * l)},0.4)`;
    g.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 2, 1 + rnd() * 3);
  }
  for (let i = 0; i < 60; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 14 + rnd() * 40;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, rnd() < 0.5 ? "rgba(70,96,58,0.14)" : "rgba(160,176,112,0.12)");
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
  for (let i = 0; i < 6000; i++) {
    const l = 0.7 + rnd() * 0.5;
    g.fillStyle = `rgba(${Math.round(160 * l)},${Math.round(155 * l)},${Math.round(142 * l)},0.6)`;
    g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  // rodadas de los vehiculos de mantenimiento
  g.fillStyle = "rgba(60,55,48,0.16)";
  g.fillRect(0, 96, 256, 14);
  g.fillRect(0, 150, 256, 14);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// sol: direccion (azimut desde +z hacia +x, elevacion), cielo y luces por tema
const THEMES = {
  light: {
    azimuth: -42, elevation: 40,
    sky: { turbidity: 2.4, rayleigh: 1.7, mie: 0.003, mieG: 0.8 },
    fog: "#b9cfe4", near: 450, far: 3600,
    sun: ["#fff2dc", 2.4], hemi: ["#b5d0ee", "#6d8250", 0.45],
    exposure: 0.55, envIntensity: 0.4,
    ground: "#d8dccf", mountains: "#c9ced6", clouds: ["#ffffff", 0.8], bushes: "#d8dccf",
  },
  dark: {
    azimuth: -62, elevation: 7,
    sky: { turbidity: 6, rayleigh: 2.4, mie: 0.01, mieG: 0.9 },
    fog: "#7e87a0", near: 320, far: 3000,
    sun: ["#ffb070", 2.6], hemi: ["#5f7cb4", "#463f33", 0.4],
    exposure: 0.5, envIntensity: 0.45,
    ground: "#a8ae9f", mountains: "#98a0b0", clouds: ["#f0a880", 0.7], bushes: "#a8ae9f",
  },
};

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = THEMES.light.exposure;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(THEMES.light.fog, THEMES.light.near, THEMES.light.far);

  // ---- cielo fisico y entorno (reflejos) generado a partir de el ----
  const sky = new Sky();
  sky.scale.setScalar(3200);
  scene.add(sky);
  const envScene = new THREE.Scene();
  const envSky = new Sky();
  envSky.scale.setScalar(3200);
  envScene.add(envSky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envTarget = null;

  const sun = new THREE.DirectionalLight("#fff4e2", 3.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -80; sc.right = 80; sc.top = 50; sc.bottom = -50; sc.near = 10; sc.far = 420;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 2.5;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight("#bfd8f2", "#7b8f5e", 0.8);
  scene.add(hemi);

  // Muestreo de la textura con sesgo de mipmap: cuando el suelo corre rapido, el detalle
  // mas fino que v / (2 * 60 Hz) se funde con su media (depth.js). Sin esto parpadea.
  const biasedMap = (sh) => {
    sh.uniforms.uBias = DETAIL.uBias;
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uBias;")
      .replace("#include <map_fragment>", "#ifdef USE_MAP\n vec4 sampledDiffuseColor = texture2D( map, vMapUv, uBias );\n diffuseColor *= sampledDiffuseColor;\n#endif");
  };

  // ---- terreno: detalle fino + parcelas de baja frecuencia (sin lineas finas) ----
  const gTex = groundTexture();
  const TILE = 40;
  gTex.repeat.set(6000 / TILE, 6000 / TILE);
  const MACRO = 1800; // m que cubre el mapa de parcelas
  const macro = fieldTexture();
  const macroU = { uMacro: { value: macro }, uMacroOff: { value: new THREE.Vector2(0, 0) } };
  const groundMat = new THREE.MeshStandardMaterial({ map: gTex, roughness: 1, metalness: 0 });
  groundMat.onBeforeCompile = (sh) => {
    biasedMap(sh);
    sh.uniforms.uMacro = macroU.uMacro;
    sh.uniforms.uMacroOff = macroU.uMacroOff;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vWorldXZ;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>\nvWorldXZ = (modelMatrix * vec4(position, 1.0)).xz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vWorldXZ;\nuniform sampler2D uMacro;\nuniform vec2 uMacroOff;")
      .replace("#include <map_fragment>", `#include <map_fragment>\ndiffuseColor.rgb *= texture2D(uMacro, (vWorldXZ + uMacroOff) / ${MACRO.toFixed(1)}).rgb * 2.0;`);
  };
  groundMat.customProgramCacheKey = () => "ground-v2";
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // corredor de mantenimiento bajo la via (grava), se desplaza con el terreno
  const vTex = gravelTexture();
  const VTILE = 12;
  vTex.repeat.set(3000 / VTILE, 1);
  // Pegado al suelo: sin `polygonOffset` y con solo 3 cm de separacion se pelearia con el
  // terreno a mas de ~200 m (depth.js). El offset empuja el corredor hacia la camara.
  const corridorMat = new THREE.MeshStandardMaterial({ map: vTex, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  corridorMat.onBeforeCompile = biasedMap;
  corridorMat.customProgramCacheKey = () => "corridor-v2";
  const corridor = new THREE.Mesh(new THREE.PlaneGeometry(3000, 9), corridorMat);
  corridor.rotation.x = -Math.PI / 2;
  corridor.position.y = 0.05;
  corridor.receiveShadow = true;
  scene.add(corridor);

  // ---- montanas, nubes y mobiliario de via ----
  const mountains = createMountains();
  scene.add(mountains.mesh);
  const clouds = createClouds();
  scene.add(clouds.group);
  const props = createProps(scene);

  function setTheme(name) {
    const th = THEMES[name] ?? THEMES.light;
    scene.fog.color.set(th.fog);
    scene.fog.near = th.near;
    scene.fog.far = th.far;
    renderer.setClearColor(th.fog);
    // direccion del sol: la misma para la luz, el cielo y el entorno
    const phi = THREE.MathUtils.degToRad(90 - th.elevation);
    const theta = THREE.MathUtils.degToRad(th.azimuth);
    const dir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    for (const s of [sky, envSky]) {
      const u = s.material.uniforms;
      u.turbidity.value = th.sky.turbidity;
      u.rayleigh.value = th.sky.rayleigh;
      u.mieCoefficient.value = th.sky.mie;
      u.mieDirectionalG.value = th.sky.mieG;
      u.sunPosition.value.copy(dir);
    }
    sun.color.set(th.sun[0]);
    sun.intensity = th.sun[1];
    sun.position.copy(dir).multiplyScalar(160);
    hemi.color.set(th.hemi[0]);
    hemi.groundColor.set(th.hemi[1]);
    hemi.intensity = th.hemi[2];
    renderer.toneMappingExposure = th.exposure;
    ground.material.color.set(th.ground);
    mountains.material.color.set(th.mountains);
    clouds.setLook(...th.clouds);
    props.setNight(name === "dark");
    props.tint(th.bushes);
    scene.environmentIntensity = th.envIntensity;
    envTarget?.dispose();
    envTarget = pmrem.fromScene(envScene, 0.02);
    scene.environment = envTarget.texture;
  }

  // ---- arboles: bosquetes agrupados y arboles sueltos, instanciados ----
  // Tres especies (conifera, frondoso, alamo) con tono variable. Los cercanos proyectan
  // sombra; los lejanos no (el mapa de sombras solo cubre el entorno del tren).
  const CAP = { near: 450, far: 1700 };
  const mkSet = (cap, shadow) => {
    const mk = (geo, color) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.92, flatShading: true }), cap);
      m.castShadow = shadow;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      scene.add(m);
      return m;
    };
    return { cones: mk(coneGeo, "#ffffff"), crowns: mk(crownGeo, "#ffffff"), poplars: mk(poplarGeo, "#ffffff"), trunks: mk(trunkGeo, "#5a4030") };
  };
  const coneGeo = new THREE.ConeGeometry(2.2, 7, 7);
  coneGeo.translate(0, 3.5 + 1.6, 0);
  const crownGeo = new THREE.IcosahedronGeometry(2.6, 1);
  crownGeo.translate(0, 5.2, 0);
  const poplarGeo = new THREE.CylinderGeometry(0.35, 1.25, 10.5, 7);
  poplarGeo.translate(0, 5.25 + 1.4, 0);
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.4, 3.2, 6);
  trunkGeo.translate(0, 1.6, 0);
  const sets = { near: mkSet(CAP.near, true), far: mkSet(CAP.far, false) };

  const CELL = 60;
  const CELLS = 44; // ventana de +-1300 m
  const hash = (a, b) => {
    let h = (a * 374761393 + b * 668265263) ^ 0x5bd1e995;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const tmp = new THREE.Object3D();
  const col = new THREE.Color();
  const CONIFER = ["#2b5f37", "#335f3a", "#24543a", "#2f6b44"];
  const BROAD = ["#4f7a3a", "#5d8540", "#6f8c42", "#47703d", "#7b9140"];
  const POPLAR = ["#6a8f3c", "#7aa03f", "#5d8238"];
  const counts = { near: { c: 0, b: 0, p: 0, t: 0 }, far: { c: 0, b: 0, p: 0, t: 0 } };

  // camara y puntos del tren: un arbol que tapa la vista del tren se oculta (ver sightline.js)
  let sight = null;
  function setSight(cam, length) {
    if (!sight || sight.length !== length) sight = { length, cam: { x: 0, y: 0, z: 0 }, pts: trainSightPoints(length) };
    sight.cam.x = cam.x;
    sight.cam.y = cam.y;
    sight.cam.z = cam.z;
  }
  // tamano de cada especie (altura, radio de la copa en la base de la escala)
  const SIZE = { c: [8.6, 2.2], b: [7.9, 2.6], p: [11.9, 1.25] };
  function blocked(x, z, kind, sxz, sy) {
    if (!sight) return false;
    const c = sight.cam;
    // descarte barato: lejos de la recta camara-tren no puede taparlo
    const d = segmentPointDistance({ x: c.x, y: 0, z: c.z }, { x: 0, y: 0, z: 0 }, { x, y: 0, z });
    const [h, r] = SIZE[kind];
    if (d > r * sxz + 32) return false;
    return occludes(c, treeSpheres(x, z, h * sy, r * sxz + 0.6), sight.pts);
  }

  function plant(x, z, r1, r2, r3, r4) {
    // franja libre junto a la via
    if (Math.abs(z) < 30) return;
    // del lado de la camara orbital, un hueco amplio: no hay arboles entre ella y el tren
    if (z > 30 && z < 130 && Math.abs(x) < 85) return;
    const set = Math.abs(x) < 120 && Math.abs(z) < 120 ? "near" : "far";
    const S = sets[set];
    const n = counts[set];
    const sc2 = 0.75 + r3 * 0.9;
    const kind = r4 < 0.42 ? "c" : r4 < 0.88 ? "b" : "p";
    if (blocked(x, z, kind, sc2, sc2 * (0.85 + r2 * 0.3))) return;
    tmp.position.set(x, 0, z);
    tmp.rotation.set(0, r1 * 6.28, 0);
    tmp.scale.set(sc2, sc2 * (0.85 + r2 * 0.3), sc2);
    tmp.updateMatrix();
    const cap = set === "near" ? CAP.near : CAP.far;
    if (n.t < cap && kind !== "p") S.trunks.setMatrixAt(n.t++, tmp.matrix);
    if (kind === "c" && n.c < cap) {
      S.cones.setMatrixAt(n.c, tmp.matrix);
      S.cones.setColorAt(n.c++, col.set(CONIFER[Math.floor(r1 * 4) % 4]));
    } else if (kind === "b" && n.b < cap) {
      S.crowns.setMatrixAt(n.b, tmp.matrix);
      S.crowns.setColorAt(n.b++, col.set(BROAD[Math.floor(r2 * 5) % 5]));
    } else if (kind === "p" && n.p < cap) {
      S.poplars.setMatrixAt(n.p, tmp.matrix);
      S.poplars.setColorAt(n.p++, col.set(POPLAR[Math.floor(r1 * 3) % 3]));
    }
  }

  function updateTrees(s) {
    for (const k of ["near", "far"]) counts[k] = { c: 0, b: 0, p: 0, t: 0 };
    const base = Math.floor(s / CELL);
    for (let i = -CELLS / 2; i < CELLS / 2; i++) {
      const cell = base + i;
      for (const side of [-1, 1]) {
        // bosquetes: de 0 a 2 por celda y lado; el numero de arboles sale de un tamano
        const groves = hash(cell, side * 91) < 0.35 ? 0 : hash(cell, side * 17) < 0.55 ? 1 : 2;
        for (let g = 0; g < groves; g++) {
          const gx = cell * CELL + hash(cell, side * 31 + g) * CELL - s;
          const gz = side * (40 + hash(cell, side * 53 + g) * 210);
          const rad = 14 + hash(cell, side * 71 + g) * 30;
          const nTrees = 12 + Math.floor(hash(cell, side * 13 + g) * 26);
          for (let k = 0; k < nTrees; k++) {
            const a = hash(cell, side * 1000 + g * 100 + k) * 6.283;
            const d = Math.sqrt(hash(cell, side * 2000 + g * 100 + k)) * rad;
            plant(gx + Math.cos(a) * d, gz + Math.sin(a) * d, hash(cell, k * 5 + 1 + g), hash(cell, k * 5 + 2 + g), hash(cell, k * 5 + 3 + g), hash(cell, k * 5 + 4 + g));
          }
        }
        // arboles sueltos y alamos en los linderos
        for (let k = 0; k < 3; k++) {
          const r1 = hash(cell, side * 300 + k), r2 = hash(cell, side * 400 + k), r3 = hash(cell, side * 500 + k), r4 = hash(cell, side * 600 + k);
          plant(cell * CELL + r1 * CELL - s, side * (30 + Math.pow(r2, 0.8) * 200), r1, r2, r3, r4 < 0.7 ? r4 * 1.25 : 0.9 + (r4 - 0.7) * 0.33);
        }
      }
    }
    for (const [key, S] of Object.entries(sets)) {
      const n = counts[key];
      S.cones.count = n.c;
      S.crowns.count = n.b;
      S.poplars.count = n.p;
      S.trunks.count = n.t;
      for (const m of Object.values(S)) {
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
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

  let t0 = performance.now();
  // Lo que el entorno tenga en estas huellas se oculta: las estaciones (coordenadas de pista) y,
  // con la camara baja junto a la via, un hueco a su alrededor (un poste delante del objetivo).
  let stationBoxes = [];
  let camPos = null;
  function setClear(boxes, cam) {
    stationBoxes = boxes;
    camPos = cam ?? null;
  }
  function applyClear(s) {
    const boxes = stationBoxes.slice();
    const cb = cameraFootprint(camPos, s);
    if (cb) boxes.push(cb);
    props.setClear(boxes);
  }

  function scroll(s) {
    gTex.offset.x = s / TILE;
    vTex.offset.x = s / VTILE;
    // el mapa de parcelas es de 1800 m y se desplaza con la via en el sentido x
    macroU.uMacroOff.value.set(s, 0);
    updateTrees(s);
    applyClear(s);
    props.update(s);
    // con window.__qaSpeed (QA visual) las nubes se quedan quietas: deriva en tiempo real no es parpadeo
    clouds.update(s, window.__qaSpeed !== undefined ? 0 : (performance.now() - t0) / 1000);
  }

  setTheme("light");
  return { renderer, scene, sun, ground, gTex, GROUND_TILE: TILE, updateTrees, scroll, makePool, setTheme, setVisualSpeed, setSight, setClear };
}
