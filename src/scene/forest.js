// arboles como mallas fusionadas, sin instancias de gpu.
//
// cada celda de pista (60 m) y cada lado tienen su propia malla, con los arboles de esa celda ya
// colocados dentro de sus buffers (posicion, normal y color por vertice). un anillo de mallas cubre
// la ventana de +-1300 m: al avanzar el tren, la malla de la celda que sale se rellena con la de la
// que entra. mover el decorado es solo cambiar `position.x` de cada malla.
//
// por que no `instancedmesh`: en algunas gpu y controladores la traslacion de cada instancia no
// llega al sombreador y todos los arboles se apilan en el origen. con geometria normal no hay
// ningun camino que dependa de los atributos instanciados.

import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CAMERA_GAP_X, CELL, treesForCell } from "./scatter.js";
import { occludes, segmentPointDistance, treeSpheres } from "./sightline.js";

// tamano de cada especie (altura, radio de la copa a escala 1), para la linea de mira
export const TREE_SIZE = { c: [8.6, 2.3], b: [7.9, 2.6], p: [11.9, 1.25] };

const CONIFER = ["#2b5f37", "#335f3a", "#24543a", "#2f6b44"];
const BROAD = ["#4f7a3a", "#5d8540", "#6f8c42", "#47703d", "#7b9140"];
const POPLAR = ["#6a8f3c", "#7aa03f", "#5d8238"];
const TRUNK = "#5a4030";
const rgbOf = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
const PALETTE = { c: CONIFER.map(rgbOf), b: BROAD.map(rgbOf), p: POPLAR.map(rgbOf) };
const TRUNK_RGB = rgbOf(TRUNK);

// ---- plantillas: una por especie, a escala 1, en un solo juego de arreglos ----
function nonIndexed(g) {
  return g.index ? g.toNonIndexed() : g;
}
/** ruido determinista en [-1, 1] a partir de una posicion (para abollar las copas). */
const jitter = (x, y, z, k) => {
  const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + k * 4.581) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
};

/** pieza = geometria + posicion + si es tronco. devuelve { pos, nor, shade, trunk, count }. */
function assemble(pieces, y0, y1) {
  const arrays = pieces.map(({ geo, at = [0, 0, 0], trunk = false }) => {
    const g = nonIndexed(geo);
    g.translate(...at);
    const pos = g.getAttribute("position");
    const nor = g.getAttribute("normal");
    return { pos, nor, trunk, n: pos.count };
  });
  const count = arrays.reduce((a, p) => a + p.n, 0);
  const out = { pos: new Float32Array(count * 3), nor: new Float32Array(count * 3), shade: new Float32Array(count), trunk: new Uint8Array(count), count };
  let o = 0;
  for (const { pos, nor, trunk, n } of arrays) {
    for (let i = 0; i < n; i++, o++) {
      out.pos[o * 3] = pos.getX(i);
      out.pos[o * 3 + 1] = pos.getY(i);
      out.pos[o * 3 + 2] = pos.getZ(i);
      out.nor[o * 3] = nor.getX(i);
      out.nor[o * 3 + 1] = nor.getY(i);
      out.nor[o * 3 + 2] = nor.getZ(i);
      // degradado vertical: mas oscuro abajo y mas claro arriba
      const t = Math.min(1, Math.max(0, (pos.getY(i) - y0) / (y1 - y0)));
      out.shade[o] = trunk ? 0.8 : 0.58 + 0.5 * t;
      out.trunk[o] = trunk ? 1 : 0;
    }
  }
  return out;
}

/** esfera achatada y abollada con normales suaves: una copa frondosa. */
function blob(radius, detail, seed, at) {
  let g = new THREE.IcosahedronGeometry(radius, detail);
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  g = mergeVertices(g, 1e-4);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const k = 1 + 0.12 * jitter(p.getX(i), p.getY(i), p.getZ(i), seed);
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.9, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return { geo: g, at };
}

function makeTemplates() {
  const trunk = () => ({ geo: new THREE.CylinderGeometry(0.28, 0.4, 3.2, 6).translate(0, 1.6, 0), trunk: true });
  // conifera: tres pisos de conos con normales suaves
  const cone = (r, h, y, open) => {
    const g = new THREE.ConeGeometry(r, h, 8, 1, open);
    return { geo: g, at: [0, y + h / 2, 0] };
  };
  const c = assemble([trunk(), cone(2.3, 3.6, 1.6, false), cone(1.8, 3.4, 3.2, true), cone(1.3, 3.4, 5.2, true)], 1.6, 8.6);
  // frondoso: una copa grande y dos lobulos, sobre el tronco
  const b = assemble([trunk(), blob(2.3, 1, 1, [0, 5.4, 0]), blob(1.6, 0, 2, [1.3, 4.5, 0.6]), blob(1.5, 0, 3, [-1.1, 4.8, -0.9])], 1.6, 7.8);
  // alamo: perfil de revolucion alargado sobre un tronco corto (sin el, la copa flota a 1,4 m del suelo)
  const prof = [[0.02, 1.4], [0.55, 2.2], [1.05, 4.4], [1.2, 6.6], [0.95, 9.0], [0.45, 11.0], [0.02, 11.9]].map(([r, y]) => new THREE.Vector2(r, y));
  const lathe = new THREE.LatheGeometry(prof, 8);
  lathe.deleteAttribute("uv");
  const stem = { geo: new THREE.CylinderGeometry(0.2, 0.3, 2.2, 6).translate(0, 1.1, 0), trunk: true };
  const p = assemble([stem, { geo: lathe }], 1.4, 11.9);
  return { c, b, p };
}

// ---- escritura de un arbol en los buffers de una malla ----
function writeTree(T, t, dx, dz, tintRgb, dst, o) {
  const cs = Math.cos(t.ang);
  const sn = Math.sin(t.ang);
  const { sx, sy } = t;
  const { pos, nor, shade, trunk, count } = T;
  for (let i = 0; i < count; i++, o++) {
    const x = pos[i * 3] * sx;
    const y = pos[i * 3 + 1] * sy;
    const z = pos[i * 3 + 2] * sx;
    dst.pos[o * 3] = x * cs + z * sn + dx;
    dst.pos[o * 3 + 1] = y;
    dst.pos[o * 3 + 2] = -x * sn + z * cs + dz;
    // normal bajo escala no uniforme: n / escala, normalizada, y luego el giro
    let nx = nor[i * 3] / sx;
    let ny = nor[i * 3 + 1] / sy;
    let nz = nor[i * 3 + 2] / sx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    dst.nor[o * 3] = nx * cs + nz * sn;
    dst.nor[o * 3 + 1] = ny;
    dst.nor[o * 3 + 2] = -nx * sn + nz * cs;
    const c = trunk[i] ? TRUNK_RGB : tintRgb;
    const k = shade[i];
    dst.col[o * 3] = c[0] * k;
    dst.col[o * 3 + 1] = c[1] * k;
    dst.col[o * 3 + 2] = c[2] * k;
  }
  return o;
}

const tintOf = (t) => {
  const pal = PALETTE[t.kind];
  return pal[Math.floor(t.tone * pal.length) % pal.length];
};

export function createForest(scene, { halfCells = 22, maxFillsPerFrame = 12, nearShadow = 140 } = {}) {
  const T = makeTemplates();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: false });
  const group = new THREE.Group();
  scene.add(group);
  const N = halfCells * 2;
  const INITIAL_VERTS = 12000;

  const makeChunk = (side) => {
    const geo = new THREE.BufferGeometry();
    const cap = INITIAL_VERTS;
    const attr = (n) => new THREE.BufferAttribute(new Float32Array(cap * n), n).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position", attr(3));
    geo.setAttribute("normal", attr(3));
    geo.setAttribute("color", attr(3));
    geo.setDrawRange(0, 0);
    // esfera fija que cubre la celda (x local 0 a 60, z de 30 a ~300 hacia su lado): el recorte por
    // campo de vision funciona por celda sin recalcular nada al rellenar
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(CELL / 2, 8, side * 160), 180);
    const mesh = new THREE.Mesh(geo, material);
    mesh.visible = false;
    group.add(mesh);
    return { mesh, geo, cap, side, cell: null, trees: [], sig: 0, used: 0 };
  };
  const chunks = [[], []];
  for (let side = 0; side < 2; side++) for (let i = 0; i < N; i++) chunks[side].push(makeChunk(side === 0 ? -1 : 1));

  const grow = (ch, need) => {
    let cap = ch.cap;
    while (cap < need) cap *= 2;
    ch.geo.dispose();
    for (const [name, n] of [["position", 3], ["normal", 3], ["color", 3]]) {
      ch.geo.setAttribute(name, new THREE.BufferAttribute(new Float32Array(cap * n), n).setUsage(THREE.DynamicDrawUsage));
    }
    ch.cap = cap;
  };

  // linea de mira
  let sight = null;
  function setSight(cam, pts) {
    if (!sight) sight = { cam: { x: 0, y: 0, z: 0 }, pts };
    sight.pts = pts;
    sight.cam.x = cam.x;
    sight.cam.y = cam.y;
    sight.cam.z = cam.z;
  }
  // un arbol se oculta si esta entre la camara y la via, cerca del tren (un primer plano que se
  // desplaza a cientos de m/s y tapa la escena), o si tapa la linea de mira hacia el tren.
  const blockedAt = (t, s) => {
    if (!sight) return false;
    const c = sight.cam;
    const x = t.x - s; // x del mundo
    if (c.z > 30 && t.z > 0 && t.z < c.z + 10 && Math.abs(x) < CAMERA_GAP_X) return true;
    const [h, r] = TREE_SIZE[t.kind];
    const d = segmentPointDistance({ x: c.x, y: 0, z: c.z }, { x: 0, y: 0, z: 0 }, { x, y: 0, z: t.z });
    if (d > r * t.sx + 32) return false;
    return occludes(c, treeSpheres(x, t.z, h * t.sy, r * t.sx + 0.6), sight.pts);
  };

  function fill(ch, cell, s) {
    if (ch.cell !== cell) {
      ch.cell = cell;
      ch.trees = treesForCell(cell, ch.side);
    }
    // arboles visibles: los que no tapan la vista del tren
    let need = 0;
    let sig = 0;
    const keep = [];
    for (let i = 0; i < ch.trees.length; i++) {
      const t = ch.trees[i];
      if (blockedAt(t, s)) {
        sig = (Math.imul(sig, 31) + i + 1) | 0;
        continue;
      }
      keep.push(t);
      need += T[t.kind].count;
    }
    ch.sig = sig;
    if (need > ch.cap) grow(ch, need);
    const dst = {
      pos: ch.geo.getAttribute("position").array,
      nor: ch.geo.getAttribute("normal").array,
      col: ch.geo.getAttribute("color").array,
    };
    const x0 = cell * CELL;
    let o = 0;
    for (const t of keep) o = writeTree(T[t.kind], t, t.x - x0, t.z, tintOf(t), dst, o);
    for (const name of ["position", "normal", "color"]) {
      const a = ch.geo.getAttribute(name);
      a.clearUpdateRanges?.();
      a.addUpdateRange?.(0, Math.max(1, o) * 3);
      a.needsUpdate = true;
    }
    ch.geo.setDrawRange(0, o);
    ch.used = o;
    ch.mesh.visible = o > 0;
  }

  // la firma de los arboles que hoy taparian la vista, sin tocar los buffers
  function signatureNow(ch, s) {
    let sig = 0;
    for (let i = 0; i < ch.trees.length; i++) if (blockedAt(ch.trees[i], s)) sig = (Math.imul(sig, 31) + i + 1) | 0;
    return sig;
  }

  let wrapBase = null;
  return {
    group,
    setSight,
    /** s: coordenada de pista del centro del tren. */
    update(s) {
      const base = Math.floor(s / CELL);
      const lo = base - halfCells;
      let fills = 0;
      for (const list of chunks) {
        for (let i = 0; i < N; i++) {
          const ch = list[i];
          // la celda que le toca a esta malla: la unica de la ventana con su indice modulo n
          const cell = lo + ((((i - lo) % N) + N) % N);
          const stale = ch.cell !== cell;
          if (stale && fills < maxFillsPerFrame) {
            fill(ch, cell, s);
            fills++;
          } else if (!stale && sight) {
            const wx = ch.cell * CELL + CELL / 2 - s;
            // solo las celdas cerca del tren o de la linea de mira
            if (wx > Math.min(sight.cam.x, 0) - 220 && wx < Math.max(sight.cam.x, 0) + 220 && signatureNow(ch, s) !== ch.sig) fill(ch, ch.cell, s);
          }
          if (ch.cell === null) continue;
          ch.mesh.position.x = ch.cell * CELL - s;
          const near = Math.abs(ch.cell * CELL + CELL / 2 - s) < nearShadow;
          if (ch.mesh.castShadow !== near) ch.mesh.castShadow = near;
        }
      }
      wrapBase = base;
    },
    get base() {
      return wrapBase;
    },
    stats() {
      let verts = 0;
      let meshes = 0;
      for (const list of chunks) for (const ch of list) if (ch.mesh.visible) (verts += ch.used), meshes++;
      return { meshes, verts };
    },
  };
}
