// Libreria pintada sobre la carroceria (u = a lo largo de x, v = perimetro del
// contorno, ver loft.js). Cada coche lleva cuatro texturas sobre las mismas UV:
//   map        color (ventanas, puertas, franja, rotulo, parabrisas, faros)
//   emissive   faros, pilotos y luz tenue de las ventanas (se nota al atardecer)
//   bump       relieve: juntas de paneles, marcos de puerta y de ventana
//   orm        rugosidad y metalicidad: los cristales reflejan mas que la pintura
//
// Las coordenadas de pintura son metros del vehiculo (x a lo largo, y altura): el
// helper convierte a pixeles y corrige el sentido de cada flanco. En el flanco +z
// la imagen queda invertida en vertical (v crece hacia arriba) y en el -z invertida
// en horizontal (se ve desde el otro lado), asi que el texto se dibuja ya corregido.

import * as THREE from "three";
import { vAt, loft, perimeterLength } from "./loft.js";

const W = 3072;
const H = 768;

function roundRect(g, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

function layer(w, h, base) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  g.scale(w / W, h / H); // se pinta siempre en coordenadas del mapa de color
  return { c, g };
}

/**
 * points: contorno [z, y]; x0, x1: extremos del loft; len: tramo recto (centrado en 0);
 * role: "front" | "mid" | "rear"; noseLen: largo de la nariz; carNo: numero de coche.
 * style: { base, lower, lowerY, accent, stripeY: [a, b], windowY: [a, b], winW, winPitch, name }
 */
export function liveryTextures({ points, x0, x1, len, role, noseLen = 9, carNo = 1, style }) {
  const pu = W / (x1 - x0); // px por metro a lo largo
  const pv = H / perimeterLength(points); // px por metro en el contorno
  const X = (x) => (x - x0) * pu;
  const V = (v) => v * H;
  const band = (s, ya, yb) => {
    const a = V(vAt(points, s, ya));
    const b = V(vAt(points, s, yb));
    return [Math.min(a, b), Math.abs(b - a)];
  };
  const vTop = (s, y) => V(vAt(points, s, y));

  const M = layer(W, H, style.base);
  const E = layer(W / 2, H / 2, "#000000");
  const B = layer(W / 2, H / 2, "#808080");
  const O = layer(W / 2, H / 2, "rgb(255,100,14)"); // ao, rugosidad, metalicidad (pintura, poco metalica)
  const all = [M, E, B, O];

  // faldon inferior
  if (style.lower) {
    const vp = V(vAt(points, 1, style.lowerY));
    const vn = V(vAt(points, -1, style.lowerY));
    M.g.fillStyle = style.lower;
    M.g.fillRect(0, 0, W, vp);
    M.g.fillRect(0, vn, W, H - vn);
    O.g.fillStyle = "rgb(255,160,20)";
    O.g.fillRect(0, 0, W, vp);
    O.g.fillRect(0, vn, W, H - vn);
    // suciedad del faldon: se oscurece suavemente hacia el borde inferior de cada flanco
    const dirt = (y0, y1, yEdge) => {
      const gr = M.g.createLinearGradient(0, y0, 0, y1);
      gr.addColorStop(0, "rgba(46,38,30,0)");
      gr.addColorStop(1, "rgba(46,38,30,0.30)");
      M.g.fillStyle = gr;
      M.g.fillRect(0, Math.min(y0, yEdge), W, Math.abs(yEdge - y0));
    };
    dirt(vp, 0, 0);
    dirt(vn, H, H);
  }

  const half = len / 2;
  const hasFront = role === "front";
  const hasRear = role === "rear";
  const cab = 2.4; // tramo de cabina (sin ventanas de pasajeros) en los extremos con nariz
  const pxa = -half + (hasRear ? cab : 0.9);
  const pxb = half - (hasFront ? cab : 0.9);
  const doorW = 1.1;
  const doors = [pxa + 0.4 + doorW / 2, pxb - 0.4 - doorW / 2];
  const [w0, w1] = style.windowY;

  const fillRR = (L, color, x, y, w, h, r) => {
    L.g.fillStyle = color;
    roundRect(L.g, x, y, w, h, r);
    L.g.fill();
  };
  const strokeRR = (L, color, lw, x, y, w, h, r) => {
    L.g.strokeStyle = color;
    L.g.lineWidth = lw;
    roundRect(L.g, x, y, w, h, r);
    L.g.stroke();
  };

  // texto en metros del vehiculo, ya corregido para el flanco `s`
  const text = (L, s, str, xm, ym, hm, color, weight = 700) => {
    const vy = vTop(s, ym);
    L.g.save();
    L.g.translate(X(xm), vy);
    L.g.scale(pu * (s < 0 ? -1 : 1), pv * (s > 0 ? -1 : 1));
    L.g.fillStyle = color;
    L.g.font = `${weight} ${hm * 1.45}px system-ui, "Helvetica Neue", Arial, sans-serif`;
    L.g.textAlign = "center";
    L.g.textBaseline = "middle";
    L.g.fillText(str, 0, 0);
    L.g.restore();
  };

  for (const s of [1, -1]) {
    // franja de acento y filete
    const [sy, sh] = band(s, style.stripeY[0], style.stripeY[1]);
    M.g.fillStyle = style.accent;
    M.g.fillRect(0, sy, W, sh);
    M.g.fillStyle = "rgba(255,255,255,0.6)";
    M.g.fillRect(0, s > 0 ? sy + sh + 4 : sy - 6, W, 2.5);

    // ventanas individuales (saltando las puertas): cristal, marco y reflejo
    const [wy, wh] = band(s, w0, w1);
    const ww = style.winW;
    for (let x = pxa + 1.6; x + ww <= pxb - 1.6 + 1e-6; x += style.winPitch) {
      const xc = x + ww / 2;
      if (doors.some((d) => Math.abs(d - xc) < doorW / 2 + ww / 2 + 0.15)) continue;
      const px = X(x);
      const pw = X(x + ww) - px;
      const rr = Math.min(pw, wh) * 0.3;
      fillRR(M, "#0e1a26", px, wy, pw, wh, rr);
      fillRR(M, "rgba(165,205,240,0.16)", px + 3, s > 0 ? wy + wh * 0.5 : wy + 3, pw - 6, wh * 0.42, 5);
      fillRR(E, "rgba(255,206,150,0.4)", px + 3, wy + 3, pw - 6, wh - 6, 5);
      fillRR(O, "rgb(255,26,205)", px, wy, pw, wh, rr);
      fillRR(B, "#6c6c6c", px, wy, pw, wh, rr);
      strokeRR(B, "#c4c4c4", 7, px - 2, wy - 2, pw + 4, wh + 4, rr + 2);
      strokeRR(M, "rgba(20,30,40,0.55)", 3, px - 2, wy - 2, pw + 4, wh + 4, rr + 2);
    }

    // puertas: contorno, hendidura y ventanilla
    const [dy, dh] = band(s, 0.12, w1 + 0.05);
    for (const d of doors) {
      const px = X(d - doorW / 2);
      const pw = X(d + doorW / 2) - px;
      strokeRR(M, "rgba(25,35,46,0.6)", 2.5, px, dy, pw, dh, 6);
      strokeRR(B, "#3a3a3a", 7, px, dy, pw, dh, 6);
      B.g.strokeStyle = "#3a3a3a";
      B.g.lineWidth = 5;
      B.g.beginPath();
      B.g.moveTo(px + pw / 2, dy);
      B.g.lineTo(px + pw / 2, dy + dh);
      B.g.stroke();
      M.g.strokeStyle = "rgba(25,35,46,0.6)";
      M.g.lineWidth = 2.5;
      M.g.beginPath();
      M.g.moveTo(px + pw / 2, dy);
      M.g.lineTo(px + pw / 2, dy + dh);
      M.g.stroke();
      const [gy, gh] = band(s, w0 + 0.1, w1 - 0.05);
      fillRR(M, "#0e1a26", px + pw * 0.14, gy, pw * 0.72, gh, 5);
      fillRR(O, "rgb(255,26,205)", px + pw * 0.14, gy, pw * 0.72, gh, 5);
      // manilla
      fillRR(M, "rgba(30,40,52,0.7)", px + pw * 0.44, vTop(s, 0.95) - 5, pw * 0.12, 10, 3);
    }

    // juntas de paneles cada ~3 m, entre puertas y ventanas
    for (let x = pxa + 3; x < pxb - 1; x += 3) {
      const [py, ph] = band(s, 0.14, w0 - 0.08);
      B.g.fillStyle = "#505050";
      B.g.fillRect(X(x), py, 3, ph);
      M.g.fillStyle = "rgba(30,40,50,0.16)";
      M.g.fillRect(X(x), py, 1.5, ph);
    }

    // rotulo y numero de coche, bajo la franja de ventanas
    const mid = (pxa + pxb) / 2;
    const ty = style.signY;
    text(M, s, style.name, mid, ty, 0.34, style.accent, 700);
    text(B, s, style.name, mid, ty, 0.34, "#9a9a9a", 700);
    text(M, s, String(carNo), doors[0] + 1.5 + (s < 0 ? 0 : 0), ty, 0.36, "rgba(40,50,62,0.85)", 700);
    text(M, s, String(carNo), doors[1] - 1.5, ty, 0.36, "rgba(40,50,62,0.85)", 700);
  }

  // rejillas de ventilacion bajo la franja: caja oscura con lamas claras
  for (const s of [1, -1]) {
    const [gy, gh] = band(s, style.ventY[0], style.ventY[1]);
    for (let x = pxa + 0.6; x < pxb - 1.6; x += 4.2) {
      const gx = X(x);
      const gw = 0.9 * pu;
      fillRR(M, "rgba(20,26,33,0.85)", gx, gy, gw, gh, 4);
      fillRR(B, "#5a5a5a", gx, gy, gw, gh, 4);
      for (let k = 1; k <= 3; k++) {
        M.g.fillStyle = "rgba(150,160,170,0.55)";
        M.g.fillRect(gx + 4, gy + (gh * k) / 4 - 1, gw - 8, 2.5);
        B.g.fillStyle = "#9a9a9a";
        B.g.fillRect(gx + 4, gy + (gh * k) / 4 - 1, gw - 8, 2.5);
      }
    }
  }

  // narices: parabrisas envolvente, faros, pilotos y spoiler oscuro
  const nose = (dir) => {
    const a = dir * (half + 0.6);
    const b = dir * (half + 3.6);
    const va = vTop(1, w0 - 0.05);
    const vb = vTop(-1, w0 - 0.05);
    const inset = (vb - va) * 0.16;
    const back = dir > 0 ? X(Math.min(a, b)) : X(Math.max(a, b));
    const tip = dir > 0 ? X(Math.max(a, b)) : X(Math.min(a, b));
    for (const L of [M, O]) {
      L.g.fillStyle = L === M ? "#0a1520" : "rgb(255,20,210)";
      L.g.beginPath();
      L.g.moveTo(back, va);
      L.g.lineTo(tip, va + inset);
      L.g.lineTo(tip, vb - inset);
      L.g.lineTo(back, vb);
      L.g.closePath();
      L.g.fill();
    }
    M.g.strokeStyle = style.accent;
    M.g.lineWidth = 3;
    M.g.stroke();
    // reflejo y limpiaparabrisas
    M.g.fillStyle = "rgba(165,205,240,0.15)";
    M.g.beginPath();
    M.g.moveTo(back + (tip - back) * 0.1, va + (vb - va) * 0.18);
    M.g.lineTo(back + (tip - back) * 0.7, va + (vb - va) * 0.3);
    M.g.lineTo(back + (tip - back) * 0.7, va + (vb - va) * 0.42);
    M.g.lineTo(back + (tip - back) * 0.1, va + (vb - va) * 0.34);
    M.g.closePath();
    M.g.fill();
    M.g.strokeStyle = "rgba(190,200,210,0.5)";
    M.g.lineWidth = 3;
    for (const f of [0.3, 0.7]) {
      M.g.beginPath();
      M.g.moveTo(back + (tip - back) * 0.05, va + (vb - va) * (0.9 - f * 0.15));
      M.g.lineTo(back + (tip - back) * 0.45, va + (vb - va) * (0.55 + f * 0.1));
      M.g.stroke();
    }

    // faldon aerodinamico oscuro bajo la franja, en toda la nariz
    const xs0 = X(Math.min(dir * half, dir * (half + noseLen)));
    const xs1 = X(Math.max(dir * half, dir * (half + noseLen)));
    for (const s of [1, -1]) {
      const [by, bh] = band(s, 0.05, style.stripeY[0] - 0.02);
      M.g.fillStyle = "rgba(24,30,38,0.9)";
      M.g.fillRect(xs0, by, xs1 - xs0, bh);
    }

    // faros (blancos delante, rojos detras) junto a la punta
    const lx0 = X(dir * (half + noseLen * 0.58));
    const lx1 = X(dir * (half + noseLen * 0.7));
    const lamp = dir > 0 ? "#fff6dc" : "#ff3b30";
    for (const s of [1, -1]) {
      const [sy0, sh0] = band(s, style.stripeY[0], style.stripeY[1]);
      const ly = sy0 + sh0 * 0.15;
      const lh = sh0 * 0.7;
      const x = Math.min(lx0, lx1);
      const w = Math.abs(lx1 - lx0);
      fillRR(M, "#161d25", x - 3, ly - 3, w + 6, lh + 6, lh / 2 + 3);
      fillRR(M, lamp, x, ly, w, lh, lh / 2);
      fillRR(E, lamp, x, ly, w, lh, lh / 2);
      fillRR(O, "rgb(255,10,0)", x, ly, w, lh, lh / 2);
    }
  };
  if (hasFront) nose(1);
  if (hasRear) nose(-1);

  const mk = (cv, srgb) => {
    const t = new THREE.CanvasTexture(cv);
    t.flipY = false;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  void all;
  return { map: mk(M.c, true), emissiveMap: mk(E.c, true), bumpMap: mk(B.c, false), ormMap: mk(O.c, false) };
}

/** Pintura con barniz: los reflejos del cielo (entorno) marcan la forma de la carroceria. */
export function paintMaterial(tex) {
  return new THREE.MeshPhysicalMaterial({
    color: "#ffffff",
    map: tex.map,
    emissive: new THREE.Color("#ffffff"),
    emissiveMap: tex.emissiveMap,
    bumpMap: tex.bumpMap,
    bumpScale: 2.2,
    roughnessMap: tex.ormMap,
    metalnessMap: tex.ormMap,
    roughness: 1,
    metalness: 1,
    clearcoat: 0.7,
    clearcoatRoughness: 0.12,
    side: THREE.DoubleSide,
  });
}

/**
 * Fuelle entre la seccion (largo `length`, cuerpo de length - 0.6) y la siguiente:
 * el mismo contorno algo reducido, abierto en los extremos (quedan dentro de los cuerpos).
 */
export function bellows(points, length, sz, sy) {
  const x = length / 2;
  const geo = loft(points, [
    { x: x - 0.42, sy, sz, dy: 0 },
    { x: x + 0.42, sy, sz, dy: 0 },
  ], { close: false });
  const m = new THREE.MeshStandardMaterial({ map: bellowsTexture(), roughness: 0.9, metalness: 0.1, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, m);
  mesh.castShadow = true;
  return mesh;
}

/** Textura de fuelle: pliegues verticales oscuros. */
let bellowsTex = null;
function bellowsTexture() {
  if (bellowsTex) return bellowsTex;
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 8;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 32, 0);
  grad.addColorStop(0, "#1b2027");
  grad.addColorStop(0.5, "#3a424c");
  grad.addColorStop(1, "#1b2027");
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 8);
  bellowsTex = new THREE.CanvasTexture(c);
  bellowsTex.wrapS = THREE.RepeatWrapping;
  bellowsTex.repeat.set(9, 1);
  bellowsTex.colorSpace = THREE.SRGBColorSpace;
  return bellowsTex;
}
