// Texturas y sombreado procedurales del entorno. Todo sale de generadores
// deterministas (la misma escena en cada carga) y no requiere archivos de imagen.

import * as THREE from "three";

export function rng(seed) {
  let x = seed;
  return () => ((x = (x * 16807) % 2147483647) / 2147483647);
}

/**
 * Mapa de macro-variacion del terreno, como multiplicador del color (128 = x1.0):
 * parcelas de cultivo de varios tonos, setos en los linderos y dos caminos de tierra.
 * Cubre `tile` metros y se repite; con el detalle fino encima el mosaico no se nota.
 */
export function fieldTexture(size = 2048) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const rnd = rng(9137);
  g.fillStyle = "rgb(128,128,128)";
  g.fillRect(0, 0, size, size);

  // parcelas: cuadricula irregular de rectangulos con tono propio
  const TONES = [
    [150, 140, 100], // paja
    [110, 138, 104], // pasto fresco
    [124, 130, 96], // barbecho
    [100, 124, 94], // cultivo oscuro
    [140, 150, 104], // pasto claro
    [132, 118, 92], // tierra arada
  ];
  const cuts = (n) => {
    const a = [0];
    for (let i = 1; i < n; i++) a.push(a[i - 1] + (size / n) * (0.6 + rnd() * 0.8));
    return a.map((v) => (v / a[a.length - 1] > 1 ? size : v)).concat(size);
  };
  const xs = cuts(9);
  const ys = cuts(9);
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const t = TONES[Math.floor(rnd() * TONES.length)];
      g.fillStyle = `rgb(${t[0]},${t[1]},${t[2]})`;
      g.fillRect(xs[i], ys[j], xs[i + 1] - xs[i], ys[j + 1] - ys[j]);
      // surcos suaves: bandas finas en una direccion
      if (rnd() < 0.55) {
        const vertical = rnd() < 0.5;
        g.fillStyle = "rgba(0,0,0,0.07)";
        const step = 7 + Math.floor(rnd() * 6);
        if (vertical) for (let x = xs[i]; x < xs[i + 1]; x += step) g.fillRect(x, ys[j], 2, ys[j + 1] - ys[j]);
        else for (let y = ys[j]; y < ys[j + 1]; y += step) g.fillRect(xs[i], y, xs[i + 1] - xs[i], 2);
      }
    }
  }
  // setos en los linderos
  g.fillStyle = "rgba(55,78,52,0.85)";
  for (const x of xs) g.fillRect(x - 2, 0, 4, size);
  for (const y of ys) g.fillRect(0, y - 2, size, 4);
  // caminos de tierra
  g.strokeStyle = "rgba(190,172,132,0.9)";
  g.lineWidth = 5;
  for (const [x0, y0, x1, y1] of [[0, size * 0.31, size, size * 0.4], [size * 0.62, 0, size * 0.55, size]]) {
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo((x0 + x1) / 2 + 40, (y0 + y1) / 2 - 30, x1, y1);
    g.stroke();
  }
  // manchas grandes y suaves para romper los bordes rectos
  for (let i = 0; i < 90; i++) {
    const x = rnd() * size, y = rnd() * size, r = 40 + rnd() * 160;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = rnd() < 0.5;
    grd.addColorStop(0, dark ? "rgba(60,80,50,0.18)" : "rgba(190,190,130,0.16)");
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
vec3 concreteTone(vec3 p){
  float n = vnoise(p * 0.8) * 0.5 + vnoise(p * 3.3) * 0.3 + vnoise(p * 13.0) * 0.2;
  float streak = vnoise(vec3(p.x * 1.6, p.y * 0.12, p.z * 1.6));
  float f = fract(p.y / 0.6);
  float seam = smoothstep(0.035, 0.0, min(f, 1.0 - f));
  float tone = 0.80 + 0.30 * n - 0.10 * streak - 0.16 * seam;
  return vec3(tone, tone * 0.995, tone * 0.985);
}
`;

/** Da al material de hormigon su aspecto sin necesitar UV ni imagenes. */
export function patchConcrete(material) {
  material.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vOP;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvOP = position;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vOP;\n${CONCRETE_GLSL}`)
      .replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb *= concreteTone(vOP);");
  };
  material.customProgramCacheKey = () => "concrete-v1";
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
