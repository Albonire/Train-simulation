// mundo: renderer, cielo, luces, terreno y pool de tramos de via.
// el tren esta siempre en x = 0 (centrado); lo que se desplaza es la via. asi no
// hay perdida de precision en recorridos de decenas de kilometros.

import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { fieldTexture, rng } from "./textures.js";
import { createMountains, createClouds } from "./terrain.js";
import { createProps } from "./props.js";
import { DETAIL, setVisualSpeed } from "./depth.js";
import { cameraFootprint, toWorld } from "./clearance.js";
import { trainSightPoints } from "./sightline.js";
import { createForest } from "./forest.js";

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
      .replace("#include <map_fragment>", `#include <map_fragment>
vec3 mc = texture2D(uMacro, (vWorldXZ + uMacroOff) / ${MACRO.toFixed(1)}).rgb * 2.0;
diffuseColor.rgb *= mc;
// franjas que dependen solo de la distancia a la via (z): no varian con el avance, asi que no
// parpadean. margen de tierra junto al corredor de grava y hierba mas seca hasta la cerca; la
// banda sigue un poco al mapa de parcelas para que no parezca una raya pintada.
float az = abs(vWorldXZ.y);
float wob = clamp(0.75 + 0.7 * (mc.g - 1.0), 0.35, 1.0);
float soilBand = smoothstep(3.6, 5.0, az) * (1.0 - smoothstep(5.4, 9.0, az));
float dryBand = 1.0 - smoothstep(9.0, 17.0, az);
diffuseColor.rgb *= mix(vec3(1.0), vec3(1.10, 1.04, 0.84), dryBand * 0.5 * wob);
diffuseColor.rgb *= mix(vec3(1.0), vec3(0.80, 0.70, 0.56), soilBand * 0.8 * wob);`);
  };
  groundMat.customProgramCacheKey = () => "ground-v3";
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

  // ---- arboles: mallas fusionadas por celda de pista (sin instancias de GPU, ver forest.js) ----
  const forest = createForest(scene);
  let sightPts = null;
  let sightLen = 0;
  // camara y puntos del tren: un arbol que tapa la vista del tren se oculta (ver sightline.js)
  function setSight(cam, length) {
    if (!sightPts || sightLen !== length) {
      sightPts = trainSightPoints(length);
      sightLen = length;
    }
    forest.setSight(cam, sightPts);
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
    const boxes = stationBoxes.map((b) => toWorld(b, s));
    const cb = cameraFootprint(camPos);
    if (cb) boxes.push(cb);
    props.setClear(boxes);
  }

  function scroll(s) {
    gTex.offset.x = s / TILE;
    vTex.offset.x = s / VTILE;
    // el mapa de parcelas es de 1800 m y se desplaza con la via en el sentido x
    macroU.uMacroOff.value.set(s, 0);
    forest.update(s);
    applyClear(s);
    props.update(s);
    // con window.__qaSpeed (QA visual) las nubes se quedan quietas: deriva en tiempo real no es parpadeo
    clouds.update(s, window.__qaSpeed !== undefined ? 0 : (performance.now() - t0) / 1000);
  }

  setTheme("light");
  return { renderer, scene, sun, ground, gTex, GROUND_TILE: TILE, forest, scroll, makePool, setTheme, setVisualSpeed, setSight, setClear };
}
