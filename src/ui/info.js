// Contenido de la guia. Cada modo tiene sus secciones; las comunes (motor lineal,
// colores, controles) se comparten. Lo que es dato de una fuente, lo que se derivo y
// lo que es ilustrativo va marcado en la tabla de fuentes.

import { routeHref } from "./router.js";

const L = (href, text) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
const fig = (id, text) => `<a href="${routeHref("laminas", id)}">${text}</a>`;

const MOTOR = `
<p>Un <b>motor lineal síncrono</b> en la vía crea una onda de campo que viaja a <code>v = 2 · τ · f</code>, con τ el paso polar y f la frecuencia del convertidor. El tren va exactamente a la velocidad de esa onda, sin deslizamiento.</p>
<p>El empuje depende del <b>ángulo de carga</b> δ entre la onda y el campo del vehículo: <code>F = F<sub>máx</sub> · sen δ</code>. Para frenar se invierte δ y el motor devuelve energía a la red. Si la frecuencia sube más rápido de lo que el empuje permite, el tren pierde el sincronismo. ${fig("lsm-sincrono", "Ver la lámina del motor lineal")}.</p>`;

const COLORES = `
<ul>
  <li><span class="sw n"></span><b>Rojo</b> es polo norte y <span class="sw s"></span><b>azul</b> polo sur. En el estator, las franjas muestran el polo opuesto al del imán que tienen enfrente, porque se atraen.</li>
  <li><b>Apertura</b>: al cargar, unos 8 s de primer plano sobre el mecanismo y después la vista general. Cualquier clic o tecla la omite y <kbd>I</kbd> la repite.</li>
  <li><b>Lupa del entrehierro</b> (abajo a la izquierda, tecla <kbd>L</kbd>): un corte en vivo del sistema. En el EMS se ve el estator arriba, el imán del coche debajo y el hueco entre ambos, ampliado en el dibujo y con su cifra real al lado; las líneas de campo van del polo norte al sur y las flechas son la atracción (verde) y el peso (blanco). En el EDS se ve la pared con sus bobinas en 8, el imán superconductor del coche y el eje nulo de las bobinas: el coche se eleva cuando su imán queda por encima de ese eje. Avisa del despegue y del aterrizaje.</li>
  <li><b>Partículas y líneas de flujo</b>: recorren el circuito magnético con el sentido real del campo, del polo norte (rojo) al sur (azul). Se dibujan cuando los imanes están a la vista: cámaras Campo, Sección e Imanes, o carrocería en rayos X o corte. El indicador <b>Campo</b> del cuadro de mando muestra su intensidad y abre la cámara Campo.</li>
  <li>Flechas sobre el techo, en escala de raíz cuadrada para que se vean fuerzas de órdenes distintos: <span class="sw lift"></span>sustentación, <span class="sw weight"></span>peso, <span class="sw thrust"></span>empuje, <span class="sw drag"></span>resistencia y <span class="sw side"></span>fuerza lateral.</li>
</ul>`;

const CONTROLES = `
<p>La cámara no baja de 1,7 m sobre el suelo: se puede mirar la vía desde abajo, pero no atravesar el terreno. Doble clic sobre la escena recupera la vista de la cámara activa.</p>
<dl class="keys">
  <dt><kbd>1</kbd> a <kbd>6</kbd></dt><dd>Cámaras: órbita, seguir, sección, imanes, arriba y campo</dd>
  <dt><kbd>P</kbd></dt><dd>Explorador de piezas: clic en una pieza para acercarte y leer qué hace; las flechas pasan a la siguiente</dd>
  <dt><kbd>E</kbd></dt><dd>Separar las piezas para verlas por dentro</dd>
  <dt><kbd>Espacio</kbd></dt><dd>Pausa y reanuda</dd>
  <dt><kbd>H</kbd></dt><dd>Muestra u oculta el panel lateral</dd>
  <dt><kbd>?</kbd></dt><dd>Lista de atajos</dd>
  <dt><kbd>Esc</kbd></dt><dd>Cierra lo abierto, o vuelve a la simulación desde una página</dd>
</dl>
<p>El panel lateral tiene tres pestañas. <b>Datos</b> muestra las magnitudes y las gráficas en vivo; <b>Control</b>, la velocidad objetivo, las estaciones y las perturbaciones, con la respuesta medida; <b>Vista</b>, la carrocería, la exageración del entrehierro y las capas.</p>`;

const EMS = {
  title: "Cómo funciona el EMS",
  lead: "Suspensión electromagnética, como el Transrapid: el vehículo abraza una viga en T y los electroimanes que cuelgan bajo el estator lo atraen hacia arriba.",
  figure: ["ems-levitacion", "Ver la lámina de la levitación EMS"],
  sections: [
    {
      id: "sostiene",
      title: "Cómo se sostiene",
      html: `
<p>Los <b>electroimanes de sustentación</b> están debajo del estator y lo atraen. Otros imanes miran a los rieles laterales de la viga y guían el vehículo.</p>
<p>La atracción de un electroimán de dos polos es <code>F = μ₀ N² I² A / (4 g²)</code>. Crece al cerrarse el entrehierro <code>g</code>, así que el equilibrio es <b>inestable</b>: si el vehículo sube un poco, la atracción aumenta y lo pega al riel; si baja, cae. Con los valores del modelo, el error se duplica en unos 16 ms (polo en <code>√(2g/g₀) ≈ 44 rad/s</code>).</p>
<p>Un lazo cerrado lo evita: un sensor mide el entrehierro, un controlador PID calcula la corriente y un convertidor la aplica, cientos de veces por segundo, para mantener 10 mm. Pruébalo en <b>Control</b> con <b>Sin control</b>: el vehículo se pega o cae en una fracción de segundo.</p>`,
    },
    {
      id: "avanza",
      title: "Cómo avanza",
      html: `${MOTOR}<p>En el Transrapid el estator largo va en la vía y se alimenta por <b>tramos</b> que se conmutan al paso del vehículo (${L("https://patents.google.com/patent/WO1997047493A1/en", "WO 1997/047493")}). Con τ = 258 mm, 215 Hz equivalen a 399 km/h.</p>`,
    },
    { id: "colores", title: "Colores", html: COLORES },
    { id: "controles", title: "Controles", html: CONTROLES },
    {
      id: "modelo",
      title: "Modelo y límites",
      html: `
<p>En reposo el vehículo descansa sobre patines. Para despegar, la referencia de entrehierro baja en rampa de 20 a 10 mm (20 mm es ilustrativo). Que el tren aterrice en cada estación y vuelva a levitar antes de salir es una decisión del modelo: no he encontrado una fuente que describa el procedimiento real.</p>
<p>Cada sección se simula por separado, sin acoplamiento entre ellas, en dos grados de libertad (vertical y lateral), sin cabeceo ni balanceo y sin alimentación de a bordo (el Transrapid reporta 450 kW a bordo). El modelo no se ha validado contra datos de medición.</p>`,
    },
    {
      id: "fuentes",
      title: "Fuentes de los datos",
      html: `
<table>
<thead><tr><th>Valor</th><th>Origen</th></tr></thead>
<tbody>
<tr><td>Entrehierro nominal 10 mm (rango 10 a 15 mm)</td><td><span class="tag">fuente</span> ${L("https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/7637214", "US 7,637,214")}, ${L("https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/7814840", "US 7,814,840")}</td></tr>
<tr><td>Paso polar 258 mm; paso de diente 63 mm</td><td><span class="tag">fuente</span> ${L("https://www.mdpi.com/2076-0825/14/11/514", "MDPI Actuators 14(11):514")}, ${L("https://www.researchgate.net/publication/224055510_MAGLEV_projects_technology_aspects_and_choices", "MAGLEV projects: technology aspects and choices")}</td></tr>
<tr><td>Dos secciones: 54 m, 120 t en vacío, empuje máx. 85 kN, 0 a 215 Hz, 4250 V, 400 km/h</td><td><span class="tag">fuente</span> ${L("https://artefacts-discovery.researcher.life/full_text/DA-2/68/680fe23b46a73ba28f0969fd014f70bc/full_text/623230215391790103f89577fdb0e5e6.pdf", "tabla de un documento sobre motores lineales")}. El motor (4250 V, 1200 A, 0 a 215 Hz) coincide con ${L("https://escholarship.org/content/qt6ds64496/qt6ds64496.pdf", "The Transrapid Magnetic Levitation System")}. Los 85 kN solo aparecen en una fuente.</td></tr>
<tr><td>3 secciones de 60 t; 42,5 kN por sección</td><td><span class="tag">derivado</span> de lo anterior</td></tr>
<tr><td>14 m por sección (la fuente da 27 m)</td><td><span class="tag">ilustrativo</span> se acorta para el encuadre</td></tr>
<tr><td>Corriente de equilibrio 50 A, retardo del convertidor 5 ms, ganancias del PID, patín a 20 mm, área frontal 10 m², Cd 0,3, potencia por sección</td><td><span class="tag">ilustrativo</span> elegidos para que el modelo sea coherente</td></tr>
</tbody>
</table>`,
    },
  ],
};

const EDS = {
  title: "Cómo funciona el EDS",
  lead: "Suspensión electrodinámica, como el SCMaglev: imanes superconductores a bordo inducen corrientes en las bobinas de las paredes de la vía, y esas corrientes los repelen.",
  figure: ["eds-sustentacion", "Ver la lámina de la levitación EDS"],
  sections: [
    {
      id: "sostiene",
      title: "Cómo se sostiene",
      html: `
<p>Los imanes son de niobio-titanio enfriados con helio líquido (unos 700 kA de fuerza magnetomotriz). Al moverse frente a las bobinas, su campo constante <b>induce corrientes</b> en ellas, y esas corrientes generan un campo que <b>repele</b> al imán.</p>
<ul>
  <li><b>Sin movimiento no hay sustentación.</b> Hasta unos 150 km/h el tren rueda sobre neumáticos, que se retraen al despegar.</li>
  <li>Las bobinas de levitación tienen forma de <b>8</b> y están conectadas entre ambas paredes (flujo nulo): si el imán está centrado no se induce corriente; si se desplaza, aparece una fuerza que lo devuelve al centro.</li>
  <li>En el modelo la levitación es <b>estable por sí misma</b>: la fuerza cae al subir y aumenta al bajar, así que no hace falta el lazo del EMS (solo se añade amortiguamiento de la suspensión secundaria). A cambio hay un <b>arrastre magnético</b> con un pico a baja velocidad, que el motor debe vencer.</li>
  <li>La elevación en crucero es de unos 100 mm, frente a los 10 mm del EMS.</li>
</ul>`,
    },
    { id: "avanza", title: "Cómo avanza", html: MOTOR },
    { id: "colores", title: "Colores", html: COLORES },
    { id: "controles", title: "Controles", html: CONTROLES },
    {
      id: "modelo",
      title: "Modelo y límites",
      html: `
<p>Para la sustentación se usa una ley cualitativa de repulsión inducida con velocidad característica <code>v<sub>c</sub></code>: <code>F = F₀ · v²/(v² + v<sub>c</sub>²) · exp(-(g - g<sub>r</sub>)/λ)</code>, con arrastre <code>κ · F · v<sub>c</sub>/v</code>. Reproduce lo esencial (nada en reposo, saturación con la velocidad, pico de arrastre, estabilidad), pero <b>no es la ley de las bobinas en 8 reales</b>: en una patente de levitación por inducción, la fuerza vertical es proporcional al desplazamiento del imán respecto del centro de la bobina. Por eso las cifras de fuerza y arrastre de este modo son ilustrativas.</p>
<p>El factor κ reduce el arrastre magnético: con la ley simple, el pico sería de unas 0,6 veces el peso y el tren no podría arrancar.</p>`,
    },
    {
      id: "fuentes",
      title: "Fuentes de los datos",
      html: `
<table>
<thead><tr><th>Valor</th><th>Origen</th></tr></thead>
<tbody>
<tr><td>Elevación de unos 100 mm</td><td><span class="tag">fuente</span> ${L("https://global.jr-central.co.jp/en/company/_pdf/superconducting_maglev.pdf", "JR Central")}, ${L("https://publikationen.bibliothek.kit.edu/1000075557/4402937", "KIT")}</td></tr>
<tr><td>Ruedas hasta unos 150 km/h</td><td><span class="tag">fuente aprox.</span> ${L("https://www.japansociety.org.uk/usercontent/572cf69871d517dad7964c455c746698/JR-Central-SCMAGLEV-Worksheet.pdf", "ficha educativa de JR Central")} (línea de pruebas de Yamanashi)</td></tr>
<tr><td>603 km/h, récord de la serie L0 (2015)</td><td><span class="tag">fuente</span> ${L("https://en.wikipedia.org/wiki/L0_Series", "L0 Series")}</td></tr>
<tr><td>700 kA, NbTi y helio líquido; bobinas en 8 conectadas entre paredes</td><td><span class="tag">fuente</span> KIT; ${L("https://en.wikipedia.org/wiki/SCMaglev", "SCMaglev")}</td></tr>
<tr><td>Masa 25 t por sección, empuje y potencia, v<sub>c</sub> = 20 m/s, κ = 0,35, λ calibrado, elevación sobre ruedas 85 mm, Cd 0,25</td><td><span class="tag">ilustrativo</span></td></tr>
<tr><td>14 m por sección</td><td><span class="tag">ilustrativo</span> se acorta para el encuadre</td></tr>
</tbody>
</table>`,
    },
  ],
};

export const guide = (mode) => (mode === "eds" ? EDS : EMS);

export const FIGURES = [
  { id: "ems-levitacion", title: "Levitación EMS", line: "Un imán bajo el estator: el control mantiene los 10 mm." },
  { id: "lsm-sincrono", title: "Motor lineal síncrono", line: "La onda del estator y el ángulo de carga." },
  { id: "eds-sustentacion", title: "Levitación EDS", line: "Imanes superconductores y bobinas de la pared." },
];

export const KEYS = [
  [["1", "6"], "Cámaras"],
  [["P"], "Piezas"],
  [["E"], "Separar"],
  [["L"], "Lupa del entrehierro"],
  [["I"], "Repetir la apertura"],
  [["Espacio"], "Pausa"],
  [["H"], "Panel lateral"],
  [["?"], "Esta lista"],
  [["Esc"], "Volver o cerrar"],
];
