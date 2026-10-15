// Etiquetas HTML ancladas a puntos del mundo 3D.

import * as THREE from "three";

export function createLabels(container) {
  const items = [];
  const v = new THREE.Vector3();
  return {
    clear() {
      container.innerHTML = "";
      items.length = 0;
    },
    /** spec: { text: () => string, pos: () => Vector3, rigs: [...], cls } */
    add(spec) {
      const el = document.createElement("div");
      el.className = "lbl" + (spec.cls ? " " + spec.cls : "");
      container.appendChild(el);
      items.push({ spec, el, last: "" });
    },
    update(camera, rig, enabled, w, h) {
      for (const it of items) {
        const show = enabled && it.spec.rigs.includes(rig);
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
        it.el.style.left = `${((v.x + 1) / 2) * w}px`;
        it.el.style.top = `${((1 - v.y) / 2) * h}px`;
      }
    },
  };
}
