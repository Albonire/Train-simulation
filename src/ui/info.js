// Contenido de la ventana de ayuda: lo esencial a la vista y el detalle (modelo,
// limites y procedencia de cada dato) plegado en <details>.

const L = (href, text) => `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:var(--accent)">${text}</a>`;

const KEYS_HTML = `
<h4>Atajos</h4>
<div class="keys">
  <span><kbd>1</kbd> a <kbd>5</kbd></span><span>Cámaras</span>
  <span><kbd>Espacio</kbd></span><span>Pausa</span>
  <span><kbd>H</kbd></span><span>Mostrar u ocultar el panel</span>
  <span><kbd>?</kbd></span><span>Esta ayuda</span>
  <span><kbd>Esc</kbd></span><span>Cerrar</span>
  <span>Arrastrar · rueda</span><span>Girar · acercar (la cámara no baja del suelo)</span>
</div>`;

const COLORS = `
<h4>Colores</h4>
<ul>
  <li><span style="color:var(--n)">Rojo</span> polo norte, <span style="color:var(--s)">azul</span> polo sur. En el estator, las franjas muestran el polo opuesto al imán que tienen enfrente.</li>
  <li>Trazos amarillos: líneas de flujo (en las vistas Sección e Imanes, o con la carrocería en rayos X o corte).</li>
  <li>Flechas sobre el techo: <span style="color:#35e08a">sustentación</span>, peso, <span style="color:#35d0ff">empuje</span>, <span style="color:#ffa43a">resistencia</span> y <span style="color:#ff5fd2">fuerza lateral</span>, en escala de raíz cuadrada.</li>
</ul>`;

const LSM = `
<h4>Cómo avanza</h4>
<p>Un <b>motor lineal síncrono</b> en la vía crea una onda de campo que viaja a <code>v = 2 · τ · f</code> (paso polar τ, frecuencia f). El tren va exactamente a esa velocidad. El empuje es <code>F = F<sub>máx</sub> · sen δ</code>, con δ el ángulo de carga; frenar es invertir δ y devolver energía a la red.</p>`;

const EMS_HTML = `
<h3 id="mTitle">EMS · estilo Transrapid</h3>
<p>El vehículo abraza una viga en T. Sus <b>electroimanes</b> están <i>debajo</i> del estator y lo <b>atraen</b> hacia arriba; otros imanes miran a los rieles laterales para guiarlo.</p>
<h4>Cómo se sostiene</h4>
<p>La atracción <code>F = μ₀ N² I² A / (4 g²)</code> crece al cerrarse el entrehierro <code>g</code>: el equilibrio es <b>inestable</b> (en el modelo, el error se duplica en unos 16 ms). Un lazo de control mide <code>g</code> y corrige la corriente cientos de veces por segundo para mantener 10 mm. Pruébalo en <b>Control</b> → <b>Sin control</b>.</p>
${LSM}
<p>En el Transrapid el estator se alimenta por <b>tramos</b> que se conmutan al paso del vehículo (${L("https://patents.google.com/patent/WO1997047493A1/en", "WO 1997/047493")}). Con τ = 258 mm, 215 Hz equivalen a 399 km/h.</p>
${COLORS}
${KEYS_HTML}
<details>
<summary>Modelo y límites</summary>
<p>En reposo el vehículo descansa sobre patines. Para despegar, la referencia de entrehierro baja en rampa de 20 a 10 mm (20 mm es ilustrativo). Aterrizar en cada estación y volver a levitar antes de salir es una decisión del modelo: no he encontrado una fuente que describa el procedimiento real.</p>
<p>Cada sección se simula por separado (sin acoplamiento entre ellas), en dos grados de libertad (vertical y lateral), sin cabeceo ni balanceo y sin alimentación de a bordo (el Transrapid reporta 450 kW a bordo). El modelo no se ha validado contra datos de medición.</p>
</details>
<details>
<summary>Fuentes de los datos</summary>
<table>
<tr><th>Valor</th><th>Origen</th></tr>
<tr><td>Entrehierro nominal 10 mm (rango 10 a 15 mm)</td><td><span class="tag">fuente</span> ${L("https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/7637214", "US 7,637,214")}, ${L("https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/7814840", "US 7,814,840")}</td></tr>
<tr><td>Paso polar 258 mm; paso de diente 63 mm</td><td><span class="tag">fuente</span> ${L("https://www.mdpi.com/2076-0825/14/11/514", "MDPI Actuators 14(11):514")}, ${L("https://www.researchgate.net/publication/224055510_MAGLEV_projects_technology_aspects_and_choices", "MAGLEV projects: technology aspects and choices")}</td></tr>
<tr><td>Dos secciones: 54 m, 120 t en vacío, empuje máx. 85 kN, 0 a 215 Hz, 4250 V, 400 km/h</td><td><span class="tag">fuente</span> ${L("https://artefacts-discovery.researcher.life/full_text/DA-2/68/680fe23b46a73ba28f0969fd014f70bc/full_text/623230215391790103f89577fdb0e5e6.pdf", "tabla de un documento sobre motores lineales")}; el motor (4250 V, 1200 A, 0 a 215 Hz) coincide con ${L("https://escholarship.org/content/qt6ds64496/qt6ds64496.pdf", "The Transrapid Magnetic Levitation System")}. Los 85 kN solo aparecen en una fuente.</td></tr>
<tr><td>3 secciones de 60 t y 27 m; 42,5 kN por sección</td><td><span class="tag">derivado</span> de lo anterior</td></tr>
<tr><td>Corriente de equilibrio 50 A, retardo del convertidor 5 ms, ganancias del PID, patín a 20 mm, área frontal 10 m², Cd 0,3, potencia por sección</td><td><span class="tag">ilustrativo</span></td></tr>
</table>
</details>`;

const EDS_HTML = `
<h3 id="mTitle">EDS · estilo SCMaglev</h3>
<p><b>Imanes superconductores</b> a bordo (niobio-titanio con helio líquido, unos 700 kA) <b>inducen corrientes</b> en las bobinas de las paredes al pasar; esas corrientes los <b>repelen</b>.</p>
<h4>Cómo se sostiene</h4>
<ul>
  <li><b>Sin movimiento no hay sustentación</b>: hasta unos 150 km/h rueda sobre neumáticos, que se retraen al despegar.</li>
  <li>Las bobinas en <b>8</b>, conectadas entre ambas paredes, no generan fuerza si el imán está centrado y lo devuelven al centro si se desplaza.</li>
  <li>Es <b>estable por sí mismo</b> (no necesita el lazo del EMS), pero tiene <b>arrastre magnético</b> con un pico a baja velocidad.</li>
  <li>Elevación en crucero: unos 100 mm, frente a 10 mm en EMS.</li>
</ul>
${LSM}
${COLORS}
${KEYS_HTML}
<details>
<summary>Modelo y límites</summary>
<p>Sustentación: ley cualitativa <code>F = F₀ · v²/(v² + v<sub>c</sub>²) · exp(-(g - g<sub>r</sub>)/λ)</code>, con arrastre <code>κ · F · v<sub>c</sub>/v</code>. Reproduce lo esencial (nada en reposo, saturación, pico de arrastre, estabilidad), pero <b>no es la ley de las bobinas en 8 reales</b>: en una patente de levitación por inducción, la fuerza vertical es proporcional al desplazamiento del imán respecto del centro de la bobina. Las cifras de fuerza y arrastre de este modo son ilustrativas.</p>
<p>El factor κ reduce el arrastre: con la ley simple, el pico sería de unas 0,6 veces el peso y el tren no podría arrancar.</p>
</details>
<details>
<summary>Fuentes de los datos</summary>
<table>
<tr><th>Valor</th><th>Origen</th></tr>
<tr><td>Elevación de unos 100 mm</td><td><span class="tag">fuente</span> ${L("https://global.jr-central.co.jp/en/company/_pdf/superconducting_maglev.pdf", "JR Central")}, ${L("https://publikationen.bibliothek.kit.edu/1000075557/4402937", "KIT")}</td></tr>
<tr><td>Ruedas hasta unos 150 km/h</td><td><span class="tag">fuente aprox.</span> ${L("https://www.japansociety.org.uk/usercontent/572cf69871d517dad7964c455c746698/JR-Central-SCMAGLEV-Worksheet.pdf", "ficha educativa de JR Central")} (línea de pruebas de Yamanashi)</td></tr>
<tr><td>603 km/h, récord de la serie L0 (2015)</td><td><span class="tag">fuente</span> ${L("https://en.wikipedia.org/wiki/L0_Series", "L0 Series")}</td></tr>
<tr><td>700 kA, NbTi y helio líquido; bobinas en 8 conectadas entre paredes</td><td><span class="tag">fuente</span> KIT; ${L("https://en.wikipedia.org/wiki/SCMaglev", "SCMaglev")}</td></tr>
<tr><td>Masa 25 t por sección, empuje y potencia, v<sub>c</sub> = 20 m/s, κ = 0,35, λ calibrado, elevación sobre ruedas 85 mm, Cd 0,25</td><td><span class="tag">ilustrativo</span></td></tr>
</table>
</details>`;

export const INFO_HTML = (mode) => (mode === "ems" ? EMS_HTML : EDS_HTML);
