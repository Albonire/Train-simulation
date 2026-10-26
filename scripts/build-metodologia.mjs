// imprime docs/metodologia/metodologia.html a PDF con chromium (sin latex).
//
//   node scripts/build-metodologia.mjs

import { chromium } from "playwright-core";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "metodologia");
const CHROME = process.env.CHROME_PATH ?? ["/opt/pw-browsers/chromium", "/usr/bin/chromium", "/usr/bin/google-chrome"].find((p) => existsSync(p));
const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const page = await browser.newPage();
await page.goto(pathToFileURL(join(DIR, "metodologia.html")).href, { waitUntil: "load" });
const head = `<div style="width:100%;font:8pt Arial,sans-serif;color:#8b0000;padding:0 18mm;display:flex;justify-content:space-between;border-bottom:0"><span style="font-weight:700;letter-spacing:.05em">UNIVERSIDAD DE PAMPLONA</span><span style="color:#5a6573">Simulador maglev · Metodología</span></div>`;
const foot = `<div style="width:100%;font:8pt Arial,sans-serif;color:#5a6573;padding:0 18mm;display:flex;justify-content:space-between"><span>Pamplona, Norte de Santander, Colombia</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`;
await page.pdf({ path: join(DIR, "metodologia.pdf"), format: "A4", printBackground: true, displayHeaderFooter: true, headerTemplate: head, footerTemplate: foot, preferCSSPageSize: true });
await browser.close();
console.log(join(DIR, "metodologia.pdf"));
