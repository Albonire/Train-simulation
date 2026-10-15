// Contenido de la ventana "Como funciona". Texto en espanol, con la procedencia
// de cada dato y los limites del modelo.

const L = (href, text) => `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:var(--accent)">${text}</a>`;

const COMMON = `
<h4>Las tres funciones de un maglev</h4>
<ul>
  <li><b>Sustentación</b>: sostener el peso sin tocar la vía.</li>
  <li><b>Guiado</b>: mantener el vehículo centrado lateralmente.</li>
  <li><b>Propulsión y frenado</b>: un <b>motor lineal síncrono</b> (LSM). Un devanado trifásico crea una onda de campo que viaja a <code>v = 2 · τ · f</code> (τ es el paso polar y f la frecuencia del convertidor). El vehículo se mueve exactamente a la velocidad de la onda: no hay deslizamiento. El empuje depende del <b>ángulo de carga</b> δ entre la onda y el campo del vehículo: <code>F = F<sub>máx</sub> · sen δ</code>. Frenar es invertir δ, y el motor devuelve energía a la red.</li>
</ul>
<h4>Cómo leer los colores</h4>
<ul>
  <li><span style="color:var(--n)">Rojo</span>: polo norte. <span style="color:var(--s)">Azul</span>: polo sur. Sobre el estator, las franjas muestran la polaridad opuesta a la del imán que tiene enfrente, porque se atraen.</li>
  <li>Cuando el ángulo de carga es 0, las franjas del estator quedan justo bajo los polos contrarios del vehículo: máxima atracción vertical y empuje nulo. Al aumentar δ se desplazan hacia adelante y aparece el empuje.</li>
  <li>Trazos amarillos: líneas de flujo. Cada lazo sube por el entrehierro desde un polo norte, recorre el hierro del estator, baja por un polo sur y cierra por el núcleo del imán.</li>
</ul>`;

const EMS_HTML = `
<h3 id="mTitle">Cómo funciona el EMS (estilo Transrapid)</h3>
<p>El vehículo abraza una viga en T. Los <b>electroimanes de sustentación</b> cuelgan <i>debajo</i> de los paquetes de estator y <b>atraen</b> el vehículo hacia arriba. Los imanes de guiado miran a los rieles laterales de la viga.</p>
<h4>Por qué hace falta control activo</h4>
<p>La fuerza de un electroimán de dos polos es <code>F = μ₀ N² I² A / (4 g²)</code>. Como <code>F</code> crece al disminuir el entrehierro <code>g</code>, el equilibrio es <b>inestable</b>: si el vehículo sube un poco, la atracción aumenta y lo pega al riel; si baja, la atracción cae y se desploma. Con los valores del modelo, el polo inestable está en <code>√(2g/g₀) ≈ 44 rad/s</code>, es decir, la perturbación se duplica en unos 16 ms.</p>
<p>Un lazo cerrado (sensor de entrehierro, controlador PID y convertidor de corriente) lo estabiliza: mide el entrehierro, calcula la corriente y la corrige cientos de veces por segundo. Pruébalo: pulsa <b>Apagar el control</b> y mira cómo el vehículo se pega o cae en una fracción de segundo.</p>
<h4>Arranque y parada</h4>
<p>En reposo el vehículo descansa sobre patines. En este modelo, para despegar la referencia de entrehierro baja en rampa de 20 a 10 mm (el valor de 20 mm en reposo es ilustrativo), y el tren aterriza en cada estación y vuelve a levitar antes de salir. Esto último es una decisión del modelo: no he encontrado una fuente que describa el procedimiento real de las estaciones.</p>
<h4>Propulsión</h4>
<p>El estator largo va en la vía y se alimenta por <b>tramos</b> que se conmutan al paso del vehículo (${L("https://patents.google.com/patent/WO1997047493A1/en", "patente WO 1997/047493")}). Con τ = 258 mm, la frecuencia máxima de 215 Hz corresponde a 399 km/h.</p>
${COMMON}
<h4>Datos y valores ilustrativos</h4>
<table>
<tr><th>Valor</th><th>Origen</th></tr>
<tr><td>Entrehierro nominal 10 mm (rango 10 a 15 mm)</td><td><span class="tag">fuente</span> ${L("https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/7637214", "patente US 7,637,214")}, ${L("https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/7814840", "US 7,814,840")}</td></tr>
<tr><td>Paso polar 258 mm; paso de diente 63 mm</td><td><span class="tag">fuente</span> ${L("https://www.mdpi.com/2076-0825/14/11/514", "MDPI Actuators 14(11):514")}, ${L("https://www.researchgate.net/publication/224055510_MAGLEV_projects_technology_aspects_and_choices", "MAGLEV projects: technology aspects and choices")}</td></tr>
<tr><td>Dos secciones: 54 m, 120 t en vacío, empuje máx. 85 kN, 0 a 215 Hz, 4250 V, 400 km/h</td><td><span class="tag">fuente</span> ${L("https://artefacts-discovery.researcher.life/full_text/DA-2/68/680fe23b46a73ba28f0969fd014f70bc/full_text/623230215391790103f89577fdb0e5e6.pdf", "tabla de un documento sobre motores lineales")}; el motor (4250 V, 1200 A, 0 a 215 Hz) coincide con ${L("https://escholarship.org/content/qt6ds64496/qt6ds64496.pdf", "The Transrapid Magnetic Levitation System")}. El empuje de 85 kN solo aparece en una fuente.</td></tr>
<tr><td>3 secciones de 60 t y 27 m; 42,5 kN por sección</td><td><span class="tag">derivado</span> de lo anterior (por sección)</td></tr>
<tr><td>Corriente de equilibrio 50 A, retardo del convertidor 5 ms, ganancias del PID, patín a 20 mm, área frontal 10 m², Cd 0,3, potencia por sección</td><td><span class="tag">ilustrativo</span> elegidos para que el modelo sea coherente</td></tr>
</table>
<p style="color:var(--muted);font-size:12.5px">Límites del modelo: cada sección se simula por separado (sin acoplamiento mecánico entre ellas), en dos grados de libertad (vertical y lateral), sin cabeceo ni balanceo, y sin alimentación de a bordo (el Transrapid reporta 450 kW a bordo). El modelo no se ha validado contra datos de medición.</p>`;

const EDS_HTML = `
<h3 id="mTitle">Cómo funciona el EDS (estilo SCMaglev)</h3>
<p>Imanes <b>superconductores</b> a bordo (niobio-titanio enfriado con helio líquido, unos 700 kA de fuerza magnetomotriz) crean un campo constante. Al moverse frente a las bobinas de las paredes de la vía, ese campo <b>induce corrientes</b> en ellas, y esas corrientes generan un campo que <b>repele</b> al imán.</p>
<h4>Consecuencias</h4>
<ul>
  <li><b>Sin movimiento no hay sustentación.</b> Hasta unos 150 km/h el tren rueda sobre ruedas de goma, que se retraen al despegar.</li>
  <li>Las bobinas de levitación tienen forma de <b>8</b> y van conectadas entre ambas paredes (flujo nulo): si el imán está centrado no se induce corriente; si se desplaza, aparece una fuerza que lo devuelve al centro.</li>
  <li>En el modelo la levitación es <b>estable por sí misma</b>: la fuerza cae al subir y aumenta al bajar, así que no hace falta un lazo como el del EMS (se añade amortiguamiento de la suspensión secundaria). A cambio hay un <b>arrastre magnético</b> con un pico a baja velocidad, que el motor lineal debe vencer.</li>
  <li>La elevación en crucero es de unos 100 mm, mucho mayor que los 10 mm del EMS.</li>
</ul>
<h4>Modelo usado aquí</h4>
<p>Para la sustentación se usa una ley cualitativa de repulsión inducida con velocidad característica <code>v<sub>c</sub></code>: <code>F = F₀ · v²/(v² + v<sub>c</sub>²) · exp(-(g - g<sub>r</sub>)/λ)</code>, con arrastre <code>κ · F · v<sub>c</sub>/v</code>. Reproduce lo esencial (sustentación nula en reposo, saturación con la velocidad, pico de arrastre, estabilidad), pero <b>no es la ley de las bobinas en 8 reales</b>: en una patente de levitación por inducción, la fuerza restauradora vertical es proporcional al desplazamiento del imán respecto del centro de la bobina. Por eso las cifras de fuerza y arrastre de este modo son ilustrativas.</p>
${COMMON}
<h4>Datos y valores ilustrativos</h4>
<table>
<tr><th>Valor</th><th>Origen</th></tr>
<tr><td>Elevación de unos 100 mm</td><td><span class="tag">fuente</span> ${L("https://global.jr-central.co.jp/en/company/_pdf/superconducting_maglev.pdf", "JR Central")}, ${L("https://publikationen.bibliothek.kit.edu/1000075557/4402937", "KIT")}</td></tr>
<tr><td>Ruedas hasta unos 150 km/h</td><td><span class="tag">fuente aprox.</span> ${L("https://www.japansociety.org.uk/usercontent/572cf69871d517dad7964c455c746698/JR-Central-SCMAGLEV-Worksheet.pdf", "ficha educativa de JR Central")} (describe la línea de pruebas de Yamanashi)</td></tr>
<tr><td>603 km/h, récord de la serie L0 (2015)</td><td><span class="tag">fuente</span> ${L("https://en.wikipedia.org/wiki/L0_Series", "L0 Series")}</td></tr>
<tr><td>700 kA, NbTi y helio líquido; bobinas en 8 conectadas entre paredes</td><td><span class="tag">fuente</span> KIT; ${L("https://en.wikipedia.org/wiki/SCMaglev", "SCMaglev")}</td></tr>
<tr><td>Masa 25 t por sección, empuje y potencia, v<sub>c</sub> = 20 m/s, κ = 0,35, λ calibrado, elevación sobre ruedas 85 mm, Cd 0,25</td><td><span class="tag">ilustrativo</span></td></tr>
</table>
<p style="color:var(--muted);font-size:12.5px">El factor κ reduce el arrastre magnético: con la ley simple el pico de arrastre sería de ~0,6 veces el peso y el tren no podría arrancar.</p>`;

export const INFO_HTML = (mode) => (mode === "ems" ? EMS_HTML : EDS_HTML);
