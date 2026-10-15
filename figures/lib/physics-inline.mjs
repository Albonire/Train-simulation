// Incrusta modulos del modelo fisico (src/physics) en una pagina autonoma.
// Quita los import/export y envuelve todo en una funcion para no chocar con los
// nombres del kit ni de la pagina.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PHYS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "physics");

/**
 * files: archivos de src/physics en orden de dependencia (constants.js primero)
 * names: simbolos que la pagina necesita; quedan en un objeto con el nombre `into`
 */
export function physicsScript(files, names, into = "PHYS") {
  const body = files
    .map((f) =>
      readFileSync(join(PHYS, f), "utf8")
        .replace(/^import[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm, "")
        .replace(/^export\s+(default\s+)?/gm, ""),
    )
    .join("\n");
  return `const ${into} = (() => {\n${body}\nreturn { ${names.join(", ")} };\n})();\n`;
}
