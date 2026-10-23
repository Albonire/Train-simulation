// material estandar al que se le inyecta una emision calculada por posicion.
// cada "juego de uniformes" (set) controla un tipo de superficie:
//  - estator del ems y bobinas de propulsion del eds: onda del campo viajero
//  - bobinas de levitacion del eds: corrientes inducidas por el paso de los imanes
// como el motor es sincrono, la onda viaja a la velocidad del tren, asi que en
// coordenadas del tren esta quieta; lo que se mueve es la via por debajo.
// la posicion x que usa el shader es la del mundo con el tren centrado en x = 0.

import * as THREE from "three";
import { DETAIL } from "./depth.js";

export const POLE_N = new THREE.Color("#ff4d3d"); // polo norte / campo +
export const POLE_S = new THREE.Color("#2f8cff"); // polo sur / campo -

function makeSet(pitch) {
  return {
    uPitch: { value: pitch }, // paso polar del patron, m
    uShift: { value: 0 }, // desplazamiento de la onda (angulo de carga), m
    uAmp: { value: 0 }, // 0..1 intensidad
    uRangeMin: { value: -60 }, // zona activa (x del mundo), m
    uRangeMax: { value: 60 },
    uFade: { value: 25 }, // longitud de transicion en los extremos, m
    uAlong: { value: 0 }, // desfase extra del patron, m
  };
}

/** uniformes por tipo de superficie. */
export const sets = {
  stator: makeSet(0.258), // estator del ems
  propulsion: makeSet(0.9), // bobinas de propulsion del eds
  induced: makeSet(0.9), // bobinas de levitacion del eds
};
export const shared = sets.stator; // compatibilidad

const GLSL = /* glsl */ `
  uniform float uPitch, uShift, uAmp, uRangeMin, uRangeMax, uFade, uAlong, uSign, uGain;
  varying float vWx;
  float waveAt(float x) {
    return uSign * sin(3.14159265 * (x - uShift - uAlong) / uPitch);
  }
  float zoneAt(float x) {
    return smoothstep(uRangeMin, uRangeMin + uFade, x) * (1.0 - smoothstep(uRangeMax - uFade, uRangeMax, x));
  }
`;

/**
 * @param params  parametros de meshstandardmaterial
 * @param set     juego de uniformes (sets.stator, sets.propulsion, sets.induced)
 * @param opts    { sign: +1|-1, gain: intensidad, key: id de cache }
 */
export function glowMaterial(params, set = sets.stator, opts = {}) {
  const mat = new THREE.MeshStandardMaterial(params);
  const sign = { value: opts.sign ?? 1 };
  const gain = { value: opts.gain ?? 1.25 };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, set, { uSign: sign, uGain: gain, uBias: DETAIL.uBias });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n varying float vWx;`)
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>\n vec4 wp = modelMatrix * vec4(transformed, 1.0);\n vWx = wp.x;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${GLSL}\nuniform float uBias;`)
      // la textura del estator (diente y ranura de 6 cm) corre con la via: se desenfoca a velocidad
      .replace("#include <map_fragment>", "#ifdef USE_MAP\n vec4 sampledDiffuseColor = texture2D( map, vMapUv, uBias );\n diffuseColor *= sampledDiffuseColor;\n#endif")
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
         {
           float w = waveAt(vWx);
           float z = zoneAt(vWx) * uAmp;
           vec3 colN = vec3(1.0, 0.30, 0.24);
           vec3 colS = vec3(0.18, 0.55, 1.0);
           // la polaridad mostrada es la opuesta a la del iman enfrentado (se atraen)
           vec3 c = mix(colN, colS, step(0.0, w));
           float k = pow(abs(w), 0.6);
           totalEmissiveRadiance += c * k * z * uGain;
         }`,
      );
  };
  mat.customProgramCacheKey = () => "glow-v2";
  mat.userData.glow = { sign, gain };
  return mat;
}

/** Textura de polos alternos N/S para la cara de un iman (franjas en x). */
export function poleTexture(poles = 12, { rounded = false } = {}) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 64;
  const g = c.getContext("2d");
  const w = c.width / poles;
  if (rounded) {
    g.fillStyle = "#1b2430";
    g.fillRect(0, 0, c.width, c.height);
  }
  for (let i = 0; i < poles; i++) {
    g.fillStyle = i % 2 === 0 ? "#ff4d3d" : "#2f8cff";
    if (rounded) {
      const r = 14;
      const x = i * w + 5, y = 6, ww = w - 10, hh = c.height - 12;
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + ww, y, x + ww, y + hh, r);
      g.arcTo(x + ww, y + hh, x, y + hh, r);
      g.arcTo(x, y + hh, x, y, r);
      g.arcTo(x, y, x + ww, y, r);
      g.fill();
    } else {
      g.fillRect(i * w, 0, w + 1, c.height);
      g.fillStyle = "rgba(0,0,0,0.25)";
      g.fillRect(i * w, 0, 2, c.height);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
