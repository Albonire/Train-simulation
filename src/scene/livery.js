// Librea pintada sobre la carroceria (u = a lo largo de x, v = perimetro del
// contorno, ver loft.js). Sustituye a las cajas planas de ventanas y franja, que
// atravesaban el techo curvo y dejaban un borde serrado.
//
// Devuelve { map, emissiveMap }: el emisivo lleva los faros y una luz tenue en
// las ventanas, que se nota al atardecer (tema oscuro).

import * as THREE from "three";
import { vAt, loft } from "./loft.js";

const W = 2048;
const H = 512;

function roundRect(g, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

/**
 * points: contorno [z, y]; x0, x1: extremos del loft; len: tramo recto (centrado en 0);
 * role: "front" | "mid" | "rear"; noseLen: largo de la nariz.
 * style: { base, lower, lowerY, accent, stripeY: [a, b], windowY: [a, b], winW, winPitch }
 */
export function liveryTextures({ points, x0, x1, len, role, noseLen = 9, style }) {
  const X = (x) => ((x - x0) / (x1 - x0)) * W;
  const V = (v) => v * H;
  const band = (s, ya, yb) => {
    const a = V(vAt(points, s, ya));
    const b = V(vAt(points, s, yb));
    return [Math.min(a, b), Math.abs(b - a)];
  };
  const vTop = (s, y) => V(vAt(points, s, y));

  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  const e = document.createElement("canvas");
  e.width = W / 2;
  e.height = H / 2;
  const ge = e.getContext("2d");
  ge.fillStyle = "#000";
  ge.fillRect(0, 0, e.width, e.height);
  ge.scale(0.5, 0.5);

  // base y parte baja (faldon)
  g.fillStyle = style.base;
  g.fillRect(0, 0, W, H);
  if (style.lower) {
    g.fillStyle = style.lower;
    const vp = V(vAt(points, 1, style.lowerY));
    const vn = V(vAt(points, -1, style.lowerY));
    g.fillRect(0, 0, W, vp);
    g.fillRect(0, vn, W, H - vn);
  }

  const half = len / 2;
  const hasFront = role === "front";
  const hasRear = role === "rear";
  // tramo de cabina (sin ventanas de pasajeros) en los extremos con nariz
  const cab = 2.4;
  const pxa = -half + (hasRear ? cab : 0.9);
  const pxb = half - (hasFront ? cab : 0.9);
  const doorW = 1.1;
  const doors = [pxa + 0.4 + doorW / 2, pxb - 0.4 - doorW / 2];

  for (const s of [1, -1]) {
    // franja de acento (sigue hasta la punta de la nariz)
    const [sy, sh] = band(s, style.stripeY[0], style.stripeY[1]);
    g.fillStyle = style.accent;
    g.fillRect(0, sy, W, sh);
    // filete fino sobre la franja
    g.fillStyle = "rgba(255,255,255,0.55)";
    g.fillRect(0, s > 0 ? sy + sh + 3 : sy - 5, W, 2);

    // ventanas individuales, saltando las puertas
    const [wy, wh] = band(s, style.windowY[0], style.windowY[1]);
    const ww = style.winW;
    for (let x = pxa + 1.6; x + ww <= pxb - 1.6 + 1e-6; x += style.winPitch) {
      const xc = x + ww / 2;
      if (doors.some((d) => Math.abs(d - xc) < doorW / 2 + ww / 2 + 0.15)) continue;
      const px = X(x);
      const pw = X(x + ww) - px;
      g.fillStyle = "#0f1c29";
      roundRect(g, px, wy, pw, wh, Math.min(pw, wh) * 0.32);
      g.fill();
      // reflejo
      g.fillStyle = "rgba(160,200,235,0.18)";
      roundRect(g, px + 2, s > 0 ? wy + wh * 0.55 : wy + 2, pw - 4, wh * 0.4, 4);
      g.fill();
      ge.fillStyle = "rgba(255,214,160,0.42)";
      roundRect(ge, px + 3, wy + 3, pw - 6, wh - 6, 4);
      ge.fill();
    }

    // puertas: contorno y ventanilla
    const [dy, dh] = band(s, 0.12, style.windowY[1] + 0.05);
    for (const d of doors) {
      const px = X(d - doorW / 2);
      const pw = X(d + doorW / 2) - px;
      g.strokeStyle = "rgba(30,40,52,0.55)";
      g.lineWidth = 2;
      roundRect(g, px, dy, pw, dh, 6);
      g.stroke();
      g.beginPath();
      g.moveTo(px + pw / 2, dy);
      g.lineTo(px + pw / 2, dy + dh);
      g.stroke();
      const [gy, gh] = band(s, style.windowY[0] + 0.1, style.windowY[1] - 0.05);
      g.fillStyle = "#0f1c29";
      roundRect(g, px + pw * 0.14, gy, pw * 0.72, gh, 5);
      g.fill();
    }
  }

  // narices: parabrisas envolvente y faros
  const nose = (dir) => {
    // dir = +1: nariz hacia +x; -1: hacia -x
    const xa = dir * (half + 0.6);
    const xb = dir * (half + 3.6);
    const va = vTop(1, style.windowY[0] - 0.05);
    const vb = vTop(-1, style.windowY[0] - 0.05);
    const inset = (vb - va) * 0.16;
    const p0 = X(Math.min(xa, xb));
    const p1 = X(Math.max(xa, xb));
    const back = dir > 0 ? p0 : p1;
    const tip = dir > 0 ? p1 : p0;
    g.fillStyle = "#0b1622";
    g.beginPath();
    g.moveTo(back, va);
    g.lineTo(tip, va + inset);
    g.lineTo(tip, vb - inset);
    g.lineTo(back, vb);
    g.closePath();
    g.fill();
    g.strokeStyle = style.accent;
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = "rgba(160,200,235,0.16)";
    g.beginPath();
    g.moveTo(back + (tip - back) * 0.1, va + (vb - va) * 0.18);
    g.lineTo(back + (tip - back) * 0.7, va + (vb - va) * 0.3);
    g.lineTo(back + (tip - back) * 0.7, va + (vb - va) * 0.42);
    g.lineTo(back + (tip - back) * 0.1, va + (vb - va) * 0.34);
    g.closePath();
    g.fill();

    // faros sobre la franja, cerca de la punta
    const lx0 = X(dir * (half + noseLen * 0.6));
    const lx1 = X(dir * (half + noseLen * 0.69));
    const lamp = dir > 0 ? "#fff6dc" : "#ff3b30";
    for (const s of [1, -1]) {
      const [sy0, sh0] = band(s, style.stripeY[0], style.stripeY[1]);
      const ly = sy0 + sh0 * 0.2;
      const lh = sh0 * 0.6;
      const x = Math.min(lx0, lx1);
      const w = Math.abs(lx1 - lx0);
      g.fillStyle = "#1a222b";
      roundRect(g, x - 3, ly - 3, w + 6, lh + 6, lh / 2 + 3);
      g.fill();
      g.fillStyle = lamp;
      roundRect(g, x, ly, w, lh, lh / 2);
      g.fill();
      ge.fillStyle = lamp;
      roundRect(ge, x, ly, w, lh, lh / 2);
      ge.fill();
    }
  };
  if (hasFront) nose(1);
  if (hasRear) nose(-1);

  const mk = (cv) => {
    const t = new THREE.CanvasTexture(cv);
    t.flipY = false;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return { map: mk(c), emissiveMap: mk(e) };
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
