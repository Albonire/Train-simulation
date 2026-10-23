// particulas que recorren las lineas de campo. cada particula sigue un lazo cerrado
// (ems: sube por el entrehierro bajo un polo norte, cruza el hierro del estator, baja por el
// polo sur y vuelve por el nucleo del iman) con el sentido real del flujo: sale del polo norte
// y entra por el sur. todo el movimiento se calcula en la gpu a partir de un solo uniforme de
// tiempo, asi que miles de particulas cuestan una llamada de dibujo.
//
// colores: rojo donde el flujo sale del polo norte, blanco calido dentro del hierro y azul
// donde entra al polo sur (los mismos colores de polos del resto de la escena).

import * as THREE from "three";

const COMMON = /* glsl */ `
  uniform float uTime, uAlpha, uSize, uPx, uMax;
  attribute vec4 aLoop; // EMS: xa, z, fase, 0   EDS: xa, y, lado, fase
  varying vec3 vCol;
  varying float vA;
  const vec3 N = vec3(1.0, 0.30, 0.24);
  const vec3 S = vec3(0.20, 0.56, 1.0);
  const vec3 IRON = vec3(1.0, 0.86, 0.60);
`;

const VERT_EMS = /* glsl */ `
  ${COMMON}
  uniform float uGap, uR;
  void main() {
    float ry = 0.75 * uR;
    float arc = 1.57079633 * (uR + ry) * 1.0;     // semielipse, longitud aproximada
    float wGap = max(uGap, 0.02);
    float tot = 2.0 * wGap + 2.0 * arc;
    float d = fract(aLoop.z + uTime * 0.16) * tot;
    float xa = aLoop.x, z = aLoop.y;
    float xm = xa + uR, xb = xa + 2.0 * uR;
    vec3 p; vec3 c; float a = 1.0;
    if (d < wGap) {                                  // sube por el entrehierro (polo n)
      float u = d / wGap;
      p = vec3(xa, uGap * u, z); c = N; a = 1.0;
    } else if (d < wGap + arc) {                     // cruza el estator
      float u = (d - wGap) / arc; float f = 3.14159265 * u;
      p = vec3(xm - uR * cos(f), uGap + ry * sin(f), z);
      c = mix(N, IRON, smoothstep(0.0, 0.3, u)); c = mix(c, S, smoothstep(0.7, 1.0, u)); a = 0.85;
    } else if (d < 2.0 * wGap + arc) {               // baja por el entrehierro (polo s)
      float u = (d - wGap - arc) / wGap;
      p = vec3(xb, uGap * (1.0 - u), z); c = S; a = 1.0;
    } else {                                         // vuelve por el nucleo del iman
      float u = (d - 2.0 * wGap - arc) / arc; float f = 3.14159265 * u;
      p = vec3(xm + uR * cos(f), -ry * sin(f), z);
      c = mix(S, IRON, 0.35); a = 0.45;
    }
    vCol = c; vA = a * uAlpha;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(uSize * uPx / -mv.z, 1.5, uMax);
  }
`;

const VERT_EDS = /* glsl */ `
  ${COMMON}
  uniform float uR, uReach, uZ;
  void main() {
    float u = fract(aLoop.w + uTime * 0.14);
    float f = 3.14159265 * u;
    float xa = aLoop.x, y = aLoop.y, side = aLoop.z;
    float xm = xa + uR;
    vec3 p = vec3(xm - uR * cos(f), y, side * (uZ + uReach * sin(f)));
    vec3 c = mix(N, S, smoothstep(0.15, 0.85, u));
    vCol = c; vA = uAlpha * (0.55 + 0.45 * sin(f));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(uSize * uPx / -mv.z, 1.5, uMax);
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vCol;
  varying float vA;
  void main() {
    vec2 q = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(q, q);
    if (r2 > 1.0) discard;
    float core = smoothstep(1.0, 0.0, r2);
    gl_FragColor = vec4(vCol * (0.9 + 0.3 * core), vA * (0.25 + 0.75 * core));
  }
`;

function material(vert, extra) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 1 }, uSize: { value: 0.08 }, uPx: { value: 600 }, uMax: { value: 10 }, ...extra },
    vertexShader: vert,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false, // el flujo pasa por dentro del hierro: se dibuja siempre, solo en vistas de detalle
    blending: THREE.AdditiveBlending,
  });
}

function points(loops, perLoop, mat, packer) {
  const n = loops.length * perLoop;
  const a = new Float32Array(n * 4);
  const pos = new Float32Array(n * 3); // no se usa: el vertex shader calcula la posicion
  let k = 0;
  loops.forEach((lp, li) => {
    for (let j = 0; j < perLoop; j++) {
      packer(a, k * 4, lp, (j + ((li * 0.37) % 1)) / perLoop);
      k++;
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aLoop", new THREE.BufferAttribute(a, 4));
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 7;
  return pts;
}

/**
 * Flujo del EMS. loops: [{ xa, z }] en el marco de la seccion (y = 0 cara polar).
 * tau: paso polar (m). Devuelve { object, update(time, gap, alpha, size, pxPerUnit, maxPx) }.
 */
export function createEmsFlux(loops, tau, perLoop = 7) {
  const mat = material(VERT_EMS, { uGap: { value: 0.1 }, uR: { value: tau / 2 } });
  const pts = points(loops, perLoop, mat, (a, i, lp, phase) => {
    a[i] = lp.xa; a[i + 1] = lp.z; a[i + 2] = phase; a[i + 3] = 0;
  });
  return {
    object: pts,
    update(time, gap, alpha, size, px, maxPx = 10) {
      mat.uniforms.uTime.value = time;
      mat.uniforms.uGap.value = gap;
      mat.uniforms.uAlpha.value = alpha;
      mat.uniforms.uSize.value = size;
      mat.uniforms.uPx.value = px;
      mat.uniforms.uMax.value = maxPx;
    },
  };
}

/**
 * Flujo del EDS. arcs: [{ xa, y, side }] en el marco de la seccion; zFace: cara del criostato;
 * pitch: paso polar (m). El alcance lateral se ajusta con `reach`.
 */
export function createEdsFlux(arcs, pitch, zFace, perLoop = 6) {
  const mat = material(VERT_EDS, { uR: { value: pitch / 2 }, uReach: { value: 0.3 }, uZ: { value: zFace } });
  const pts = points(arcs, perLoop, mat, (a, i, ar, phase) => {
    a[i] = ar.xa; a[i + 1] = ar.y; a[i + 2] = ar.side; a[i + 3] = phase;
  });
  return {
    object: pts,
    update(time, reach, alpha, size, px, maxPx = 10) {
      mat.uniforms.uTime.value = time;
      mat.uniforms.uReach.value = reach;
      mat.uniforms.uAlpha.value = alpha;
      mat.uniforms.uSize.value = size;
      mat.uniforms.uPx.value = px;
      mat.uniforms.uMax.value = maxPx;
    },
  };
}
