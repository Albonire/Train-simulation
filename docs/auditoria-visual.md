# Auditoría visual: parpadeo, z-fighting y aliasing

Qué se revisó, qué se encontró y cómo se evita que vuelva. La comprobación automática es
`npm run qa:visual` (necesita el servidor de desarrollo y Chrome) y `npm test` (`tests/visual.test.js`).

## Las tres causas

1. **Aliasing temporal.** El suelo corre a velocidad de tren multiplicada por la escala de
   tiempo. A 360 km/h y x5 son unos 480 m de pista por segundo real. Un detalle de L metros
   parpadea si `v / L` supera la mitad del refresco (60 Hz): lo más fino que `v / 120` m no
   se puede mostrar. Se arregla desenfocándolo (sesgo de mipmap), como haría la difuminación
   por movimiento. Ver `src/scene/depth.js` (`mipBiasFor`, `detailFactor`).
2. **z-fighting.** Con 24 bits de profundidad, dos superficies a menos de
   `z² · (far - near) / (near · far · 2²⁴)` metros se pelean. Con `near = 0,1` eso son 2,4 cm a
   200 m y 15 cm a 500 m. Se arregla con un plano cercano adaptativo (`adaptiveNear`, entre 0,1
   y 2 m según a qué distancia mira la cámara) y con `polygonOffset` en toda superficie pegada
   a otra.
3. **Ruido procedural sin mipmaps.** Las octavas finas del hormigón (7 cm) son menores que un
   píxel a distancia: ruido sub-píxel que cambia con cualquier movimiento. Cada octava se apaga
   cuando su longitud de onda es menor que dos píxeles (`fwidth`). El QA lo detectó: la
   diferencia entre dos fotogramas bajó de 12,1 a 3,7 en la vista de órbita del EMS.

## Inventario

| Superficie | Problema | Estado |
|---|---|---|
| Surcos y setos del mapa de parcelas | Líneas de 1,8 y 3,5 m cada 6 a 10 m: bandas que corrían y parecían costuras | Eliminadas; las parcelas son manchas de baja frecuencia con bordes difusos |
| Textura de hierba (tesela de 40 m) | Briznas de 8 cm que parpadean a velocidad | Sesgo de mipmap según la velocidad visual |
| Corredor de grava (3 cm sobre el suelo) | z-fighting a más de 200 m | 5 cm de separación y `polygonOffset` |
| Textura del estator (diente y ranura de 6 cm) | Patrón fino que corre con la vía | Sesgo de mipmap en el material de brillo |
| Hormigón procedural (viga, pilares, paredes) | Ruido sub-píxel | Octavas por huella de píxel y atenuación por velocidad |
| Franja amarilla del andén (4 mm sobre la losa) | z-fighting | `polygonOffset` |
| Junta de dilatación EDS (6 mm sobre la losa) | z-fighting | 3 cm de grosor, sobresale 2,5 cm |
| Junta de dilatación EMS | Sobresalía 1 cm | Sobresale 2 cm |
| Casquetes de corte (en el plano de corte) | z-fighting con la carrocería cortada | `polygonOffset` |
| Caras polares de los imanes (2 mm sobre el núcleo) | z-fighting en planos medios | `polygonOffset` |
| Hilos de la cerca (1,5 cm) y su longitud | Raya brillante en el horizonte | Longitud limitada a 520 m y color mate |
| Nubes en el borde del plano | Banda blanca a ras de horizonte | Desvanecimiento hacia el borde |
| Sombra del sol | Acné y "peter panning" con el sol bajo | `normalBias` y sesgo revisados; sin hallazgos |
| Librea del coche (UV) | Costura en el centro inferior | Queda fuera de la vista |

## Reglas para el futuro

- Todo lo que se desplaza con la vía y tenga detalle más fino que unos 4 m debe pasar por el
  sesgo de mipmap (`DETAIL.uBias`) o por `DETAIL.uDetail`.
- Nada de líneas finas ni patrones periódicos pintados en el terreno.
- Toda superficie a menos de 5 cm de otra lleva `polygonOffset` o se separa más. Si se añade una,
  se anota en `LAYERS` de `tests/visual.test.js`: el test obliga a decidir.
- El ruido procedural debe atenuarse con `fwidth`.

## Explorador de piezas

Fallo reportado: tras elegir los rieles, activar Separar y llegar a Pilar, la escena quedaba de un color
liso (el de la niebla). No se reprodujo con Chromium por software (`npm run qa:parts` y
`scripts/parts-fuzz.mjs`), asi que la correccion cierra todas las rutas que podian producirlo:

- El encuadre sale de `src/scene/frame.js` (puro y probado en `tests/frame.test.js`): cajas vacias,
  invertidas, planas, con NaN o enormes dan un encuadre finito acotado, o `null` y se conserva la vista.
- `focusBox` mide la geometria de cada malla (no su resaltado) y recorta con `windowBox`, que nunca
  invierte la caja.
- El reencuadre diferido de Separar se cancela al cambiar de pieza, modo o cerrar la tarjeta.
- El area libre del encuadre se valida antes de usarla en `setViewOffset`.
- El bucle de dibujo no se detiene por una excepcion; si la camara deja de ser finita o queda a mas de
  1000 m, se restablece la camara activa.
- Con una pieza de la via seleccionada el decorado se detiene: a la velocidad del tren pasaria de largo.

## Segunda revision: tren, entorno e interfaz

- **Arboles delante del tren.** `plant()` solo dejaba libres 22 m a cada lado y un hueco del lado de la
  camara orbital; con otra orientacion de camara una copa podia cubrir un coche entero. Ahora el
  corredor libre es de 30 m y, ademas, cada arbol cuya silueta (tres esferas a lo largo de su eje) corta
  la linea entre la camara y alguno de diez puntos del tren se oculta en ese fotograma
  (`src/scene/sightline.js`, probado en `tests/sightline.test.js`). Vale para cualquier giro de camara.
- **Utileria dentro de las estaciones.** Los postes de luz, la cerca (con su alambre, que ahora va por
  tramos instanciados) y los arbustos atravesaban el anden y el edificio de acceso. Cada estacion
  declara su huella (`src/scene/clearance.js`) y lo que cae dentro se oculta, sin reescribir matrices en
  cada fotograma: solo al cambiar de celda de la cinta o de huella. Lo mismo ocurre alrededor de una
  camara baja junto a la via (un poste a 3 m de la camara Campo tapaba el objetivo).
- **Lineas laterales.** El estado activo de los botones se marcaba con una raya de 3 px a un lado
  (`box-shadow: inset 3px 0 0`), y asi tambien la lista de la Guia, la de Laminas y las filas de
  perturbaciones; las pestanas y la navegacion lo hacian con un subrayado. Se quitaron todas y los
  separadores decorativos del carril, la barra superior y el cuadro de mando. El estado activo es ahora
  un fondo con un tinte del acento (`--tint`) y, en las herramientas, el icono y el texto en el acento:
  se distingue del hover sin ninguna raya.
- **Cuadro de mando en ventanas medianas.** Entre 1181 y 1460 px de ancho los botones de escala de
  tiempo quedaban cortados por el panel lateral. Se oculta el progreso del tramo (y, por debajo de 1180
  px, tambien el indicador de campo) y la pista de primera visita ya no pisa a la lupa.

