// etiquetas html ancladas a puntos del mundo 3d.

import * as THREE from "three";

export function createLabels(container) {
  const items = [];
  const v = new THREE.Vector3();
  return {
    clear() {
      container.innerHTML = "";
      items.length = 0;
    },
    /** spec: { text: () => string, pos: () => vector3, rigs: [...], cls } */
    add(spec) {
      const el = document.createElement("div");
      el.className = "lbl" + (spec.cls ? " " + spec.cls : "");
      container.appendChild(el);
      items.push({ spec, el, last: "" });
    },
    update(camera, rig, enabled, w, h) {
      // las que se solapan con una anterior (orden de alta) se ocultan: en pantallas
      // estrechas varias piezas caen en el mismo sitio
      const placed = [];
      for (const it of items) {
        const show = enabled && it.spec.rigs.includes(rig) && (!it.spec.when || it.spec.when());
        if (!show) {
          it.el.style.display = "none";
          continue;
        }
        v.copy(it.spec.pos()).project(camera);
        if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) {
          it.el.style.display = "none";
          continue;
        }
        const t = it.spec.text();
        if (t !== it.last) {
          it.el.textContent = t;
          it.last = t;
        }
        it.el.style.display = "block";
        if (it.size?.text !== t) it.size = { text: t, w: it.el.offsetWidth, h: it.el.offsetHeight };
        const x = ((v.x + 1) / 2) * w;
        const y = ((1 - v.y) / 2) * h;
        const r = { x0: x - it.size.w / 2 - 3, x1: x + it.size.w / 2 + 3, y0: y - it.size.h - 3, y1: y + 3 };
        const hit = placed.some((p) => r.x0 < p.x1 && r.x1 > p.x0 && r.y0 < p.y1 && r.y1 > p.y0);
        it.el.style.visibility = hit ? "hidden" : "visible";
        if (!hit) placed.push(r);
        it.el.style.left = `${x}px`;
        it.el.style.top = `${y}px`;
      }
    },
  };
}
