// genera las laminas isometricas (figures/*/build.mjs) en los dos temas y las copia a
// public/figures/ para que la aplicacion las muestre y `vite build` las incluya.
//
//   node scripts/build-figures.mjs

import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "figures");
mkdirSync(OUT, { recursive: true });

const FIGS = ["ems-levitacion", "lsm-sincrono", "eds-sustentacion"];
for (const name of FIGS) {
  const dir = join(ROOT, "figures", name);
  for (const flags of [[], ["--light"]]) {
    const r = spawnSync(process.execPath, [join(dir, "build.mjs"), ...flags], { stdio: ["ignore", "ignore", "inherit"] });
    if (r.status !== 0) {
      console.error(`fallo al construir ${name} ${flags.join(" ")}`);
      process.exit(1);
    }
  }
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".html"))) copyFileSync(join(dir, f), join(OUT, f));
  if (!existsSync(join(OUT, `${name}.html`))) throw new Error(`falta ${name}.html`);
}
console.log(`laminas copiadas a ${OUT}`);
