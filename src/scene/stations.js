// Estaciones: anden elevado junto a la via, marquesina y edificio con cartel.
// Hay tres instancias que se reciclan: las estaciones estan en los multiplos de
// la distancia entre estaciones y se muestran las mas cercanas al tren.

import * as THREE from "three";

const LEN = 140; // longitud del anden, m

function signTexture(text, sub) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#0f2a44";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#ffffff";
  g.font = "700 110px system-ui, sans-serif";
  g.textAlign = "center";
  g.fillText(text, 512, 140);
  g.fillStyle = "#8fd3ff";
  g.font = "500 54px system-ui, sans-serif";
  g.fillText(sub, 512, 215);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function buildStation() {
  const g = new THREE.Group();
  const mConcrete = new THREE.MeshStandardMaterial({ color: "#b8bec5", roughness: 0.9 });
  const mRoof = new THREE.MeshStandardMaterial({ color: "#dfe6ee", roughness: 0.5, metalness: 0.3 });
  const mPost = new THREE.MeshStandardMaterial({ color: "#4a525b", roughness: 0.6, metalness: 0.6 });
  const mBuild = new THREE.MeshStandardMaterial({ color: "#d9dde2", roughness: 0.8 });
  const mGlass = new THREE.MeshStandardMaterial({ color: "#274868", roughness: 0.15, metalness: 0.6 });
  const mk = (geo, mat, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    return m;
  };
  g.userData = {};
  // se construye con alturas unitarias y se escala en `place`
  const platform = new THREE.Group(); // lado +z
  const slab = mk(new THREE.BoxGeometry(LEN, 1, 6), mConcrete);
  slab.name = "slab";
  const under = mk(new THREE.BoxGeometry(LEN, 1, 6), mConcrete);
  under.name = "under";
  const roof = mk(new THREE.BoxGeometry(LEN, 0.25, 7), mRoof);
  roof.name = "roof";
  platform.add(slab, under, roof);
  const posts = [];
  for (let i = 0; i <= 14; i++) {
    const p = mk(new THREE.BoxGeometry(0.35, 1, 0.35), mPost);
    posts.push(p);
    platform.add(p);
  }
  const build = mk(new THREE.BoxGeometry(60, 7, 14), mBuild);
  const glass = mk(new THREE.BoxGeometry(58, 3, 0.2), mGlass, false);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshBasicMaterial({ toneMapped: false }));
  platform.add(build, glass, sign);
  g.add(platform);
  g.userData = { platform, slab, under, roof, posts, build, glass, sign };
  return g;
}

export function createStations() {
  const group = new THREE.Group();
  const items = [0, 1, 2].map(() => ({ obj: buildStation(), k: null }));
  for (const it of items) group.add(it.obj);
  const textures = new Map();

  /** cfg: { floorY (cara superior del anden), zIn } */
  function place(obj, cfg) {
    const { slab, under, roof, posts, build, glass, sign } = obj.userData;
    const { floorY, zIn } = cfg;
    const sg = -1; // el anden va al lado -z, lejos de la camara por defecto
    const zc = sg * (zIn + 3);
    slab.scale.set(1, 0.35, 1);
    slab.position.set(0, floorY - 0.175, zc);
    under.scale.set(1, floorY - 0.35, 1);
    under.position.set(0, (floorY - 0.35) / 2, zc);
    const roofY = floorY + 3.6;
    roof.position.set(0, roofY, zc + sg * 0.5);
    posts.forEach((p, i) => {
      p.scale.set(1, roofY - floorY, 1);
      p.position.set(-LEN / 2 + (i * LEN) / (posts.length - 1), floorY + (roofY - floorY) / 2, sg * (zIn + 5.7));
    });
    build.position.set(0, 3.5, sg * (zIn + 12.5));
    glass.position.set(0, 3.2, sg * (zIn + 5.55));
    sign.position.set(0, 6.4, sg * (zIn + 5.45));
  }

  return {
    group,
    /** sCenter: coordenada de pista del centro del tren; lenTrain: largo del tren */
    update(sCenter, lenTrain, spacing, cfg) {
      const k0 = Math.round((sCenter + lenTrain / 2) / spacing);
      items.forEach((it, j) => {
        const k = k0 + j - 1;
        const xTrack = k * spacing - lenTrain / 2; // centro del tren detenido en la estacion k
        const x = xTrack - sCenter;
        it.obj.visible = k >= 0 && Math.abs(x) < 1200;
        it.obj.position.x = x;
        if (it.cfgKey !== `${cfg.floorY}|${cfg.zIn}`) {
          place(it.obj, cfg);
          it.cfgKey = `${cfg.floorY}|${cfg.zIn}`;
        }
        if (it.k !== k || it.spacing !== spacing) {
          it.k = k;
          it.spacing = spacing;
          const key = `${k}|${spacing}`;
          if (!textures.has(key)) textures.set(key, signTexture(`ESTACIÓN ${k + 1}`, `km ${((k * spacing) / 1000).toFixed(0)}`));
          it.obj.userData.sign.material.map = textures.get(key);
          it.obj.userData.sign.material.needsUpdate = true;
        }
      });
    },
  };
}
