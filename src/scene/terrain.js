// fondo lejano: cordillera en anillos (con perspectiva atmosferica gracias a la
// niebla) y capa de nubes. todo queda fijo respecto del observador salvo las nubes,
// que derivan despacio.

import * as THREE from "three";
import { cloudTexture, rng } from "./textures.js";

// ruido de valor 3d (periodico en el angulo al muestrear sobre un circulo)
function hash3(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) ^ 0x5bd1e995;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), sx), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), sx), sy),
    l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), sx), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), sx), sy),
    sz,
  );
}
const smoothUnit = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};
const fbm = (x, y, z) => 0.5 * noise3(x, y, z) + 0.28 * noise3(x * 2.1, y * 2.1, z * 2.1) + 0.14 * noise3(x * 4.3, y * 4.3, z * 4.3) + 0.08 * noise3(x * 8.7, y * 8.7, z * 8.7);

/** anillo de montanas: estribaciones suaves cerca y crestas altas (con nieve) lejos. */
export function createMountains() {
  const nT = 900;
  const r0 = 1300;
  const r1 = 2250;
  const rows = 10;
  const pos = [];
  const col = [];
  const idx = [];
  const c = new THREE.Color();
  for (let j = 0; j <= rows; j++) {
    const t = j / rows;
    const r = r0 + (r1 - r0) * t;
    for (let i = 0; i < nT; i++) {
      const a = (i / nT) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      // dos escalas: cadena principal y relieve fino
      const big = fbm(ca * 3.2 + 11, sa * 3.2 + 5, t * 2.4);
      const fine = fbm(ca * 14 + 3, sa * 14 + 9, t * 7);
      const ridge = Math.pow(Math.min(1, Math.max(0, big * 1.5 - 0.25)), 1.4);
      // la fila interior baja hasta el suelo (y la tapa el plano del terreno): si no, queda una rendija
      // por debajo de la cordillera por la que se ve el horizonte lejano, una franja clara
      const foot = smoothUnit(t / 0.16);
      const h = Math.max(0, (18 + 70 * t * t) * (0.5 + fine) + 330 * ridge * Math.pow(t, 1.15)) * foot;
      pos.push(ca * r, h - 3, sa * r);
      if (h > 250) c.set("#eef1f4");
      else if (h > 150) c.set("#8a847a").lerp(new THREE.Color("#eef1f4"), (h - 150) / 100);
      else if (h > 60) c.set("#5d6d4c").lerp(new THREE.Color("#8a847a"), (h - 60) / 90);
      else c.set("#4a6540").lerp(new THREE.Color("#5d6d4c"), h / 60);
      c.offsetHSL(0, 0, (fine - 0.5) * 0.08);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < nT; i++) {
      const a = j * nT + i;
      const b = j * nT + ((i + 1) % nT);
      const d = (j + 1) * nT + i;
      const e = (j + 1) * nT + ((i + 1) % nT);
      idx.push(a, b, d, b, e, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // roca en las pendientes empinadas y nieve solo donde el terreno es casi plano y alto
  const nor = g.getAttribute("normal");
  const colAttr = g.getAttribute("color");
  const rock = new THREE.Color("#7a7268");
  const snow = new THREE.Color("#eef1f4");
  const smooth = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  for (let v = 0; v < colAttr.count; v++) {
    const h = pos[v * 3 + 1] + 3;
    const flat = Math.abs(nor.getY(v));
    c.setRGB(colAttr.getX(v), colAttr.getY(v), colAttr.getZ(v));
    if (h > 40) c.lerp(rock, smooth(0.45, 0.75, 1 - flat) * smooth(40, 120, h) * 0.8);
    if (h > 150) c.lerp(snow, smooth(150, 230, h) * smooth(0.55, 0.85, flat) * 0.9);
    colAttr.setXYZ(v, c.r, c.g, c.b);
  }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  return { mesh, material: mat };
}

/** dos capas de nubes que derivan con el viento y con un ligero paralaje. */
export function createClouds() {
  const tex = cloudTexture();
  const group = new THREE.Group();
  const layers = [];
  const rnd = rng(31);
  for (const [y, size, rep, speed] of [[620, 7000, 3.2, 1], [900, 9000, 2.4, 0.6]]) {
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(rep, rep);
    t.offset.set(rnd(), rnd());
    const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false, opacity: 0.85 });
    // se desvanecen hacia el borde del plano: a ras de horizonte serian una banda blanca
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vLoc;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLoc = position.xy;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vLoc;")
        .replace("#include <map_fragment>", `#include <map_fragment>\ndiffuseColor.a *= 1.0 - smoothstep(${(size * 0.12).toFixed(1)}, ${(size * 0.46).toFixed(1)}, length(vLoc));`);
    };
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = y;
    plane.renderOrder = -1;
    plane.frustumCulled = false;
    group.add(plane);
    layers.push({ t, speed, m });
  }
  return {
    group,
    /** s: coordenada de pista; time: s reales. Se desplazan con el tren (paralaje) y con el viento. */
    update(s, time) {
      for (const L of layers) {
        L.t.offset.x = (s * 0.00006 + time * 0.0006) * L.speed;
        L.t.offset.y = time * 0.0002 * L.speed;
      }
    },
    setLook(color, opacity) {
      for (const L of layers) {
        L.m.color.set(color);
        L.m.opacity = opacity;
      }
    },
  };
}
