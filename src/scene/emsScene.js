// Escena EMS completa: via + tren + camaras propias del modo.

import * as THREE from "three";
import { SEG, DIM, buildEmsSegment, createEmsShared, buildEmsSection, outline } from "./ems.js";
import { fatLine } from "./lines.js";
import { capMesh } from "./caps.js";
import { EMS } from "../physics/constants.js";

export const RIGS = {
  orbit: { pos: [-24, 11.5, 59], target: [0, 6.4, 0], fov: 40, body: "solid", fit: { y: [4.5, 11.4], fill: 0.88 } },
  chase: { pos: [-45, 9, 13.5], target: [6, 7.0, 0], fov: 50, body: "solid" },
  section: { pos: [10.5, 6.9, 0.01], target: [0, 6.55, 0], fov: 44, body: "cut", cut: { axis: "x", c: 0 } },
  gap: { pos: [3.6, 6.45, 5.2], target: [0, 6.3, 1.1], fov: 34, body: "cut", cut: { axis: "z", c: 1.62 }, minExag: 24 },
  top: { pos: [0, 58, 0.01], target: [0, 0, 0], fov: 45, body: "solid" },
  // vista oblicua y baja: carroceria transparente y capas de campo realzadas
  field: { pos: [-11, 4.8, 10.5], target: [0, 6.5, 1.0], fov: 46, body: "xray", boost: true },
};

function buildCaps() {
  const fixed = new THREE.Group(); // viga y estatores (mundo)
  const veh = new THREE.Group(); // vehiculo (sigue a la seccion central)
  const lev = new THREE.Group(); // imanes de sustentacion
  const guide = new THREE.Group(); // imanes de guiado
  veh.add(lev, guide);
  const sides = [-1, 1];
  const mirror = (z0, z1) => sides.map((s) => (s > 0 ? [z0, z1] : [-z1, -z0]));
  // viga
  fixed.add(capMesh([[-0.5, 0.5, DIM.pillarH, DIM.webTop]], "#aab1b8"));
  fixed.add(capMesh([[-DIM.plateHalf, DIM.plateHalf, DIM.webTop, DIM.plateTop]], "#bfc5cb"));
  fixed.add(capMesh(mirror(DIM.statorZ0, DIM.statorZ1).map(([a, b]) => [a, b, DIM.statorBottom, DIM.webTop]), "#4b535c"));
  // cables de alta tension en las ranuras (tres fases)
  const cab = ["#ffb000", "#19c37d", "#b45cff"];
  mirror(DIM.statorZ0 + 0.04, DIM.statorZ1 - 0.04).forEach(([a, b]) => {
    const w = (b - a) / 5;
    cab.forEach((c, i) => fixed.add(capMesh([[a + w * (1 + i * 1.3), a + w * (2 + i * 1.3), DIM.statorBottom + 0.05, DIM.statorBottom + 0.19]], c)));
  });
  fixed.add(capMesh(mirror(DIM.plateHalf, DIM.plateHalf + 0.06).map(([a, b]) => [a, b, DIM.railY0, DIM.railY1]), "#e4e9ee"));
  // vehiculo: relleno translucido del contorno
  const pts = outline();
  const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  const fill = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({ color: "#6fb7ff", transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  fill.rotation.y = Math.PI / 2;
  veh.add(fill);
  const line = fatLine(pts.map(([z, y]) => new THREE.Vector3(0, y, z)), { color: "#ffffff", width: 2.2, closed: true });
  veh.add(line);
  // imanes de sustentacion (y local de levGroup: 0 = cara polar)
  const zc = (DIM.statorZ0 + DIM.statorZ1) / 2;
  lev.add(capMesh(mirror(DIM.statorZ0, DIM.statorZ1).map(([a, b]) => [a, b, -0.14, 0]), "#59626d"));
  lev.add(capMesh(mirror(zc - 0.33, zc + 0.33).map(([a, b]) => [a, b, -0.27, -0.15]), "#d9822b"));
  lev.add(capMesh(mirror(DIM.statorZ1, DIM.cavityHalf).map(([a, b]) => [a, b, -0.39, -0.27]), "#3a4149"));
  lev.add(capMesh(mirror(DIM.statorZ0, DIM.statorZ1).map(([a, b]) => [a, b, -0.012, 0.0]), "#ff4d3d"));
  return { fixed, veh, lev, guide, guideMeshes: [] };
}

export function createEmsScene(world) {
  const shared = createEmsShared();
  const pool = world.makePool(() => buildEmsSegment(shared), SEG, 56);
  const group = new THREE.Group();
  group.add(pool.group);

  const n = EMS.sections;
  const sections = [];
  const clipMats = [...Object.values(shared.m)];
  for (let i = 0; i < n; i++) {
    const role = i === 0 ? "rear" : i === n - 1 ? "front" : "mid";
    const baseX = -((n - 1) / 2) * EMS.sectionLength + i * EMS.sectionLength;
    const sec = buildEmsSection({ role, shared, length: EMS.sectionLength, baseX, carNo: i + 1 });
    sec.group.position.x = baseX;
    sec.baseX = sec.group.position.x;
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
  let guideCap = null;
  let guideExag = -1;

  return {
    id: "ems",
    group,
    capGroup,
    sections,
    clipMats,
    bodyMats: sections.flatMap((s) => s.bodyMats),
    rigs: RIGS,
    shared,
    update(tel, train, view) {
      pool.update(train.x - train.length / 2);
      train.sections.forEach((s, i) => {
        const o = sections[i];
        o.setGap(s.gap, s.y, view.exag, s.gap0);
        o.group.position.x = o.baseX;
        o.setCurrentRel(s.I / s.I0);
      });
      // la tapa del vehiculo sigue a la seccion central
      const mid = sections[Math.floor(n / 2)];
      caps.veh.position.set(0, mid.group.position.y, mid.group.position.z);
      caps.lev.position.y = mid.levGroup.position.y;
      if (guideExag !== view.exag) {
        guideExag = view.exag;
        if (guideCap) caps.veh.remove(guideCap);
        const gz = DIM.plateHalf + 0.06 + EMS.gapNominal * view.exag;
        const y0 = (DIM.railY0 + DIM.railY1) / 2 - (DIM.plateTop + DIM.floorClear);
        guideCap = new THREE.Group();
        for (const sg of [-1, 1]) {
          const side = (z0, z1) => (sg > 0 ? [z0, z1] : [-z1, -z0]);
          const [c0, c1] = side(gz, gz + 0.14); // nucleo, cara hacia el riel
          const [k0, k1] = side(gz + 0.14, gz + 0.24); // bobinado detras
          const [a0, a1] = side(gz + 0.24, DIM.cavityHalf + 0.12); // brazo al faldon
          guideCap.add(capMesh([[c0, c1, y0 - 0.2, y0 + 0.2]], "#59626d"));
          guideCap.add(capMesh([[k0, k1, y0 - 0.15, y0 + 0.15]], "#d9822b"));
          guideCap.add(capMesh([[a0, a1, y0 - 0.2, y0 + 0.2]], "#3a4149"));
          const [f0, f1] = side(gz - 0.012, gz); // cara polar
          guideCap.add(capMesh([[f0, f1, y0 - 0.2, y0 + 0.2]], "#ff4d3d"));
        }
        caps.veh.add(guideCap);
      }
    },
  };
}
