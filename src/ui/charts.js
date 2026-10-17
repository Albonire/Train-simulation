// Graficas minimas en canvas 2D (sin dependencias).

export class History {
  constructor(capacity = 6000, step = 0.02) {
    this.cap = capacity;
    this.step = step;
    this.t = new Float64Array(capacity);
    this.cols = {};
    this.n = 0; // total insertado
    this.nextT = 0;
  }
  has(name) {
    return name in this.cols;
  }
  ensure(names) {
    for (const k of names) if (!this.cols[k]) this.cols[k] = new Float32Array(this.cap);
  }
  clear() {
    this.n = 0;
    this.nextT = 0;
  }
  /** Inserta una muestra si paso al menos `step` s de simulacion. */
  push(t, values) {
    if (t < this.nextT) return false;
    this.nextT = t + this.step;
    const i = this.n % this.cap;
    this.t[i] = t;
    for (const k in values) {
      if (!this.cols[k]) this.cols[k] = new Float32Array(this.cap);
      this.cols[k][i] = values[k];
    }
    this.n++;
    return true;
  }
  /** Indices (en orden) de las muestras dentro de los ultimos `seconds` s. */
  range(seconds, maxPoints = 400) {
    const count = Math.min(this.n, this.cap);
    if (!count) return [];
    const lastI = (this.n - 1) % this.cap;
    const tEnd = this.t[lastI];
    const out = [];
    for (let k = 0; k < count; k++) {
      const i = (lastI - k + this.cap) % this.cap;
      if (this.t[i] < tEnd - seconds) break;
      out.push(i);
    }
    out.reverse();
    const stride = Math.max(1, Math.ceil(out.length / maxPoints));
    return stride === 1 ? out : out.filter((_, j) => j % stride === 0);
  }
}

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function setupCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(10, Math.round(canvas.clientWidth));
  const h = Math.max(10, Math.round(canvas.clientHeight));
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  const g = canvas.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w, h };
}

/**
 * spec: { x:[x0,x1], y:[y0,y1], series:[{xs,ys,color,width,dash}], refs:[{y,color,dash,label}],
 *         xLabel, yLabel, marker:{x,y,color}, xFmt, yFmt, bands:[{y0,y1,color}] }
 */
export function drawChart(canvas, spec) {
  const { g, w, h } = setupCanvas(canvas);
  const padL = 38, padR = 6, padT = 8, padB = 18;
  const iw = w - padL - padR;
  const ih = h - padT - padB;
  const [x0, x1] = spec.x;
  const [y0, y1] = spec.y;
  const X = (x) => padL + ((x - x0) / (x1 - x0 || 1)) * iw;
  const Y = (y) => padT + (1 - (y - y0) / (y1 - y0 || 1)) * ih;
  g.clearRect(0, 0, w, h);
  const muted = css("--muted") || "#aab4bf";
  const line = css("--line") || "#313b46";
  g.font = "12px " + (css("--num") || "sans-serif");
  g.textBaseline = "middle";

  for (const b of spec.bands ?? []) {
    g.fillStyle = b.color;
    g.fillRect(padL, Y(b.y1), iw, Y(b.y0) - Y(b.y1));
  }
  // rejilla horizontal (3 lineas) y etiquetas
  g.strokeStyle = line;
  g.lineWidth = 1;
  g.fillStyle = muted;
  g.textAlign = "right";
  for (let i = 0; i <= 2; i++) {
    const v = y0 + ((y1 - y0) * i) / 2;
    const yy = Y(v);
    g.beginPath();
    g.moveTo(padL, yy);
    g.lineTo(padL + iw, yy);
    g.stroke();
    g.fillText((spec.yFmt ?? ((q) => q.toFixed(1)))(v), padL - 4, yy);
  }
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  const xf = spec.xFmt ?? ((q) => q.toFixed(0));
  g.fillText(xf(x0), padL + 10, h - 3);
  g.fillText(xf(x1), padL + iw - 12, h - 3);
  if (spec.xLabel) g.fillText(spec.xLabel, padL + iw / 2, h - 3);

  for (const r of spec.refs ?? []) {
    g.strokeStyle = r.color ?? muted;
    g.setLineDash(r.dash ?? [4, 3]);
    g.beginPath();
    g.moveTo(padL, Y(r.y));
    g.lineTo(padL + iw, Y(r.y));
    g.stroke();
    g.setLineDash([]);
    if (r.label) {
      g.fillStyle = r.color ?? muted;
      g.textAlign = "right";
      g.fillText(r.label, padL + iw - 2, Y(r.y) - 4);
    }
  }
  g.save();
  g.beginPath();
  g.rect(padL, padT, iw, ih);
  g.clip();
  for (const s of spec.series) {
    if (!s.xs.length) continue;
    g.strokeStyle = s.color;
    g.lineWidth = s.width ?? 1.6;
    g.setLineDash(s.dash ?? []);
    g.beginPath();
    for (let i = 0; i < s.xs.length; i++) {
      const px = X(s.xs[i]);
      const py = Y(s.ys[i]);
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke();
    g.setLineDash([]);
  }
  g.restore();
  if (spec.marker) {
    g.fillStyle = spec.marker.color ?? "#fff";
    g.beginPath();
    g.arc(X(spec.marker.x), Y(spec.marker.y), 3.4, 0, Math.PI * 2);
    g.fill();
  }
}
