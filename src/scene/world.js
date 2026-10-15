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

function groundTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#6f8a58";
  g.fillRect(0, 0, 256, 256);
  // ruido determinista
  let seed = 1234;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {
    const v = 90 + Math.floor(rnd() * 60);
    g.fillStyle = `rgba(${v - 20},${v + 25},${v - 35},0.30)`;
    g.fillRect(rnd() * 256, rnd() * 256, 2 + rnd() * 6, 2 + rnd() * 6);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  scene.background = skyTexture("#3e78c4", "#9cc7ee", "#dbe9f4");
  scene.fog = new THREE.Fog("#cfe2f2", 260, 1500);

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
  scene.add(new THREE.HemisphereLight("#bcd8ff", "#6c7f55", 0.55));

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

  // ---- arboles (instanciados, se recolocan con el desplazamiento) ----
  const TREES = 700;
  const treeCone = new THREE.InstancedMesh(
    new THREE.ConeGeometry(2.2, 7, 7),
    new THREE.MeshStandardMaterial({ color: "#2f6b3a", roughness: 0.9 }),
    TREES,
  );
  const treeTrunk = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.3, 0.4, 2, 6),
    new THREE.MeshStandardMaterial({ color: "#5a4030", roughness: 1 }),
    TREES,
  );
  treeCone.castShadow = true;
  scene.add(treeCone, treeTrunk);
  const CELL = 60;
  const CELLS = 36; // ventana de +-1080 m
  const hash = (a, b) => {
    let h = (a * 374761393 + b * 668265263) ^ 0x5bd1e995;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const tmp = new THREE.Object3D();

  function updateTrees(s) {
    const base = Math.floor(s / CELL);
    let n = 0;
    for (let i = -CELLS / 2; i < CELLS / 2 && n < TREES; i++) {
      const cell = base + i;
      for (let k = 0; k < 20 && n < TREES; k++) {
        const r1 = hash(cell, k * 3 + 1);
        const r2 = hash(cell, k * 3 + 2);
        const r3 = hash(cell, k * 3 + 3);
        if (r3 < 0.45) continue;
        const x = cell * CELL + r1 * CELL - s;
        let z = (r2 < 0.5 ? -1 : 1) * (14 + r2 * 150);
        const sc2 = 0.7 + r3 * 1.1;
        tmp.position.set(x, 3.5 * sc2, z);
        tmp.scale.set(sc2, sc2, sc2);
        tmp.rotation.set(0, 0, 0);
        tmp.updateMatrix();
        treeCone.setMatrixAt(n, tmp.matrix);
        tmp.position.set(x, 1 * sc2, z);
        tmp.updateMatrix();
        treeTrunk.setMatrixAt(n, tmp.matrix);
        n++;
      }
    }
    treeCone.count = n;
    treeTrunk.count = n;
    treeCone.instanceMatrix.needsUpdate = true;
    treeTrunk.instanceMatrix.needsUpdate = true;
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

  return { renderer, scene, sun, ground, gTex, GROUND_TILE: TILE, updateTrees, makePool };
}
