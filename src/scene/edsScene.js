// escena eds completa: via en u + tren + camaras propias del modo.

import * as THREE from "three";
import { SEG, D, buildEdsSegment, createEdsShared, buildEdsSection, edsOutline } from "./edsGeo.js";
import { fatLine } from "./lines.js";
import { capMesh, sideRange } from "./caps.js";
import { EDS } from "../physics/constants.js";

export const RIGS = {
  // elevacion de unos 26 grados: por encima de la pared de la via se ve el coche y sus imanes
  orbit: { pos: [-20.3, 33.2, 49.9], target: [0, 6.9, 0], fov: 40, body: "skirt", fit: { y: [5.0, 9.6], fill: 0.88 } },
  chase: { pos: [-45, 9, 13.5], target: [6, 7.0, 0], fov: 50, body: "skirt" },
  section: { pos: [10, 7.0, 0.01], target: [0, 6.75, 0], fov: 44, body: "cut", cut: { axis: "x", c: 0 } },
  gap: { pos: [4.2, 6.95, 0.01], target: [0, 6.85, 1.75], fov: 30, body: "cut", cut: { axis: "x", c: 0 } },
  top: { pos: [0, 58, 0.01], target: [0, 0, 0], fov: 45, body: "solid" },
  field: { pos: [-7, 16.5, 7], target: [0, 6.3, 0], fov: 46, body: "xray", boost: true },
};

function buildCaps() {
  const fixed = new THREE.Group();
  const veh = new THREE.Group();
  const cryo = new THREE.Group();
  veh.add(cryo);
  // via: losa, paredes y bobinas (corte por un plano que pasa por el centro de una bobina)
  fixed.add(capMesh([[-2.35, 2.35, D.slabTop - 0.6, D.slabTop]], "#a9afb6"));
  for (const s of [-1, 1]) {
    fixed.add(capMesh([sideRange(s, D.wallInner, D.wallOuter).concat([D.slabTop, D.wallTop])], "#bfc5cb"));
    // bobinas de levitacion (lazos arriba y abajo de la linea nula) y de propulsion
    const z = sideRange(s, D.coilZ - 0.05, D.coilZ);
    const row = (y0, y1, color) => fixed.add(capMesh([[z[0], z[1], y0, y1]], color));
    row(D.levY + 0.015, D.levY + 0.55, "#d9822b");
    row(D.levY - 0.55, D.levY - 0.015, "#d9822b");
    row(D.propY - 0.35, D.propY + 0.35, "#9fb4c8");
  }
  // vehiculo
  const pts = edsOutline();
  const fill = new THREE.Mesh(
    new THREE.ShapeGeometry(new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)))),
    new THREE.MeshBasicMaterial({ color: "#6fb7ff", transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  fill.rotation.y = Math.PI / 2;
  veh.add(fill);
  veh.add(fatLine(pts.map(([z, y]) => new THREE.Vector3(0, y, z)), { color: "#ffffff", width: 2.2, closed: true }));
  for (const s of [-1, 1]) {
    cryo.add(capMesh([[...sideRange(s, D.cryoZ0, D.cryoZ1), D.cryoY0, D.cryoY1]], "#59626d"));
    cryo.add(capMesh([[...sideRange(s, D.cryoZ1, D.cryoZ1 + 0.012), D.cryoY0 + 0.1, D.cryoY1 - 0.1]], "#ff4d3d"));
  }
  return { fixed, veh };
}

export function createEdsScene(world) {
  const shared = createEdsShared();
  const pool = world.makePool(() => buildEdsSegment(shared), SEG, 40);
  const group = new THREE.Group();
  group.add(pool.group);

  const n = EDS.sections;
  const sections = [];
  const clipMats = [...Object.values(shared.m)];
  for (let i = 0; i < n; i++) {
    const role = i === 0 ? "rear" : i === n - 1 ? "front" : "mid";
    const baseX = -((n - 1) / 2) * EDS.sectionLength + i * EDS.sectionLength;
    const sec = buildEdsSection({ role, length: EDS.sectionLength, baseX, carNo: i + 1 });
    sec.group.position.x = baseX;
    sec.baseX = baseX;
    sec.retract = 0;
    group.add(sec.group);
    sections.push(sec);
    clipMats.push(...sec.clipMats);
  }

  const caps = buildCaps();
  const capGroup = new THREE.Group();
  capGroup.add(caps.fixed, caps.veh);
  capGroup.position.x = -0.02;
  capGroup.visible = false;
  group.add(capGroup);

  return {
    id: "eds",
    group,
    capGroup,
    sections,
    clipMats,
    bodyMats: [...sections.flatMap((s) => s.bodyMats), shared.m.wallPos, shared.m.wallNeg],
    rigs: RIGS,
    shared,
    update(tel, train, view, dt) {
      pool.update(train.x - train.length / 2);
      train.sections.forEach((s, i) => {
        const o = sections[i];
        o.setPose(s.gap, s.y, view.exag);
        o.group.position.x = o.baseX;
        const target = s.wheelsDown ? 0 : 1;
        o.retract += (target - o.retract) * Math.min(1, dt * 4);
        o.setWheels(o.retract);
        o.setIntensity(1);
      });
      const mid = sections[Math.floor(n / 2)];
      caps.veh.position.set(0, mid.group.position.y, mid.group.position.z);
    },
  };
}
