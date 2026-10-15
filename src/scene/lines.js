// Lineas gruesas (Line2) con resolucion compartida, para contornos de corte.

import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

const materials = new Set();

export function fatLine(points, { color = "#ffffff", width = 2, closed = false, dashed = false, dashSize = 0.2, gapSize = 0.15 } = {}) {
  const flat = [];
  for (const p of points) flat.push(p.x ?? p[0], p.y ?? p[1], p.z ?? p[2]);
  if (closed) flat.push(points[0].x ?? points[0][0], points[0].y ?? points[0][1], points[0].z ?? points[0][2]);
  const geo = new LineGeometry();
  geo.setPositions(flat);
  const mat = new LineMaterial({ color: new THREE.Color(color), linewidth: width, dashed, dashSize, gapSize, transparent: true });
  mat.resolution.set(window.innerWidth, window.innerHeight);
  materials.add(mat);
  const line = new Line2(geo, mat);
  if (dashed) line.computeLineDistances();
  return line;
}

export function setLineResolution(w, h) {
  for (const m of materials) m.resolution.set(w, h);
}
