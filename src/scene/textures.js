// texturas y sombreado procedurales del entorno. todo sale de generadores
// deterministas (la misma escena en cada carga) y no requiere archivos de imagen.

import * as THREE from "three";
import { DETAIL } from "./depth.js";

export function rng(seed) {
  let x = seed;
  return () => ((x = (x * 16807) % 2147483647) / 2147483647);
}

/**
 * mapa de macro-variacion del terreno, como multiplicador del color (128 = x1.0).
 * parcelas de tono propio con bordes difusos y ruido de baja frecuencia. a proposito no hay
 * lineas finas (surcos, setos, caminos): con el suelo corriendo a cientos de metros por
 * segundo se convertian en bandas que parpadeaban (ver depth.js). se pinta pequeno y la
 * textura lo amplia con filtro lineal: asi los bordes salen desenfocados siete u ocho metros.
 */
export function fieldTexture(size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const rnd = rng(9137);
  g.fillStyle = "rgb(128,128,128)";
  g.fillRect(0, 0, size, size);

  const TONES = [
    [146, 138, 106], // paja
    [118, 136, 108], // pasto fresco
    [128, 130, 102], // barbecho
    [110, 126, 100], // cultivo oscuro
    [138, 146, 108], // pasto claro
    [134, 122, 100], // tierra arada
  ];
  const cuts = (n) => {
    const a = [0];
    for (let i = 1; i < n; i++) a.push(a[i - 1] + (size / n) * (0.6 + rnd() * 0.8));
    const last = a[a.length - 1];
    return a.map((v) => (v / last) * size);
  };
  const xs = cuts(8);
  const ys = cuts(8);
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const t = TONES[Math.floor(rnd() * TONES.length)];
      g.fillStyle = `rgb(${t[0]},${t[1]},${t[2]})`;
      // un pixel de solape evita costuras entre parcelas
      g.fillRect(xs[i], ys[j], xs[i + 1] - xs[i] + 1, ys[j + 1] - ys[j] + 1);
    }
  }
  // manchas anchas y suaves que rompen los bordes rectos
  for (let i = 0; i < 40; i++) {
    const x = rnd() * size, y = rnd() * size, r = size * (0.04 + rnd() * 0.1);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = rnd() < 0.5;
    grd.addColorStop(0, dark ? "rgba(70,92,60,0.35)" : "rgba(180,184,128,0.3)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

/** Nubes: ruido fractal en el canal alfa (blanco); se usa en un plano alto. */
export function cloudTexture(size = 512) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const img = g.createImageData(size, size);
  const rnd = rng(2718);
  // ruido de valor periodico a varias octavas
  const N = 8;
  const grid = (n) => Array.from({ length: n * n }, () => rnd());
  const oct = [grid(4), grid(8), grid(16), grid(32)];
  const sample = (o, n, x, y) => {
    const fx = x * n, fy = y * n;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = fx - ix, ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = o[(iy % n) * n + (ix % n)], b = o[(iy % n) * n + ((ix + 1) % n)];
    const d = o[((iy + 1) % n) * n + (ix % n)], e = o[((iy + 1) % n) * n + ((ix + 1) % n)];
    return a + (b - a) * sx + (d - a) * sy + (a - b - d + e) * sx * sy;
  };
  void N;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      let n = 0;
      let amp = 0.5;
      for (let k = 0; k < 4; k++) {
        n += amp * sample(oct[k], 4 << k, u, v);
        amp *= 0.5;
      }
      const a = Math.min(1, Math.max(0, (n - 0.42) * 3.2));
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * a * 235);
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---- hormigon: tono, juntas de encofrado y vetas, en coordenadas locales de cada malla ----
const CONCRETE_GLSL = /* glsl */ `
float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
uniform float uDetail;
vec3 concreteTone(vec3 p){
  // ruido procedural: no tiene mipmaps, asi que cada octava se apaga cuando su longitud de
  // onda es menor que dos pixeles (fp = tamano de un pixel en la superficie). sin esto, a
  // distancia es ruido sub-pixel que parpadea con cualquier movimiento (lo detecto el qa).
  float fp = length(fwidth(p));
  float a2 = clamp(1.0 - fp / 0.15, 0.0, 1.0);   // 0,3 m
  float a3 = clamp(1.0 - fp / 0.038, 0.0, 1.0);  // 7,7 cm
  float as = clamp(1.0 - fp / 0.03, 0.0, 1.0);   // junta de ~2 cm
  float n = vnoise(p * 0.8) * 0.5 + vnoise(p * 3.3) * 0.3 * a2 * mix(0.4, 1.0, uDetail) + vnoise(p * 13.0) * 0.2 * a3 * uDetail;
  // lo que se pierde de las octavas finas se repone con su media para no aclarar ni oscurecer
  n += (0.3 * 0.5 * (1.0 - a2) + 0.2 * 0.5 * (1.0 - a3));
  float streak = vnoise(vec3(p.x * 1.6, p.y * 0.12, p.z * 1.6));
  float f = fract(p.y / 0.6);
  float seam = smoothstep(0.035, 0.0, min(f, 1.0 - f)) * uDetail * as;
  float tone = 0.80 + 0.30 * n - 0.10 * streak - 0.16 * seam;
  // suciedad segun la altura del mundo (no cambia con el avance): zocalo salpicado junto al suelo y
  // un oscurecimiento suave hacia abajo en los pilares
  float splash = 1.0 - smoothstep(0.0, 1.3, vWY);
  tone *= (0.93 + 0.07 * smoothstep(0.0, 6.0, vWY)) * (1.0 - 0.30 * splash * (0.55 + 0.45 * n));
  vec3 col = vec3(tone, tone * 0.995, tone * 0.985);
  return mix(col, col * vec3(0.88, 0.92, 0.80), splash * 0.5);
}
`;

/** Da al material de hormigon su aspecto sin necesitar UV ni imagenes. */
export function patchConcrete(material) {
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uDetail = DETAIL.uDetail;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vOP;\nvarying float vWY;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvOP = position;\nvWY = (modelMatrix * vec4(position, 1.0)).y;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vOP;\nvarying float vWY;\n${CONCRETE_GLSL}`)
      .replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb *= concreteTone(vOP);");
  };
  material.customProgramCacheKey = () => "concrete-v4";
  return material;
}

/** Caja que se estrecha hacia arriba (pilares): anchos y fondos en la base y en la cabeza. */
export function taperedBox(wBase, dBase, wTop, dTop, h) {
  const b = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => new THREE.Vector3((x * wBase) / 2, -h / 2, (z * dBase) / 2));
  const t = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => new THREE.Vector3((x * wTop) / 2, h / 2, (z * dTop) / 2));
  const pos = [];
  // sentido antihorario visto desde fuera: las normales salen hacia afuera
  const quad = (a, b2, c, d) => pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b2.x, b2.y, b2.z, a.x, a.y, a.z, d.x, d.y, d.z, c.x, c.y, c.z);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad(b[i], b[j], t[j], t[i]);
  }
  quad(t[0], t[1], t[2], t[3]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
