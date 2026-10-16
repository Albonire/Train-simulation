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
