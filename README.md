# Simulador 3D de levitación magnética

Simulación interactiva del funcionamiento de un tren de levitación magnética, con dos tecnologías
seleccionables y un modelo físico detrás de cada número que se ve en pantalla.

- **EMS (estilo Transrapid):** suspensión electromagnética. Los electroimanes cuelgan bajo el estator
  y atraen el vehículo hacia arriba; el equilibrio es inestable y lo sostiene un lazo de control.
- **EDS (estilo SCMaglev):** suspensión electrodinámica. Imanes superconductores inducen corrientes en
  las bobinas de la vía y la repulsión resultante eleva el tren; solo levita en movimiento.
- **Motor lineal síncrono (LSM)** para la propulsión y el frenado regenerativo en ambas.

> **Estado del modelo.** Está pensado para explicar, no para dimensionar un tren. Algunas constantes
> están tomadas de fuentes, otras derivadas y otras son ilustrativas (tabla más abajo), y la ley de
> sustentación del EDS es cualitativa. No se ha validado contra mediciones.

## Cómo ejecutarlo

```bash
npm install
npm run dev      # servidor en http://127.0.0.1:5173 (genera antes las láminas)
npm test         # tests del modelo físico (Vitest)
npm run build    # compilación de producción en dist/
```

Requiere Node.js 22.12 o superior (lo exige Vitest 5; Vite 8 admite desde 20.19 y el kit de las láminas
desde 20.10). Las láminas necesitan solo Node; su comprobación visual con la skill, además Chrome o
Chromium.

## Qué se puede hacer

| Control | Qué hace |
|---|---|
| EMS / EDS | Cambia de tecnología (mismo tren, otra física). |
| Velocidad objetivo, escala de tiempo (x1 a x60), pausa | Gobierna el viaje entre estaciones. |
| Salir ahora / Retener en estación | El tren aterriza en cada estación (EMS) y vuelve a levitar antes de salir. |
| Perturbaciones | Carga extra del 12 %, ráfaga lateral, golpe vertical, apagar el control, cortar la corriente. |
| Cámaras | Órbita, persecución, sección transversal, entrehierro y cenital. |
| Carrocería | Sólida, rayos X o corte. |
| Capas | Líneas de flujo, onda del estator, fuerzas, etiquetas. |
| Exagerar entrehierro | El entrehierro real (10 mm) es invisible a escala; se multiplica y la interfaz lo indica. |
| Láminas | Tres figuras isométricas explicativas e interactivas. |
| Cómo funciona | La física, los colores y la procedencia de cada dato. |

**Qué probar en el EMS.** Pulsa *Apagar el control*: con la corriente fija en su valor de equilibrio,
una perturbación de 0,5 mm basta para que el vehículo se pegue al riel o caiga en menos de un cuarto de
segundo. Con el control activo, un golpe de 2 mm o una carga del 12 % se absorben (la carga se
compensa con un término integral). **En el EDS** el equilibrio es estable por sí mismo.

## Física implementada

Código en `src/physics/` (sin DOM, compartido por la escena 3D y las láminas).

**EMS (`ems.js`).** Fuerza de un electroimán de dos polos, `F = μ0·N²·I²·A / (4 g²)`. Planta
inestable (polo en `√(2g/g0) ≈ 44 rad/s`). Controlador PID sobre el entrehierro, con corriente de
equilibrio, anti-windup y rampa de referencia para despegar desde los patines (20 mm a 10 mm). Guiado
lateral con un par diferencial de imanes y polarización. Convertidor de potencia con retardo de 5 ms.

**EDS (`eds.js`).** Repulsión inducida con velocidad característica `vc`:
`F = F0 · v²/(v²+vc²) · exp(-(g-gr)/λ)` y arrastre `κ · F · vc / v`. Ruedas de goma con histéresis
(se retraen a 150 km/h y se extienden por debajo de 135 km/h). Guiado lateral pasivo.

**Motor lineal síncrono (`lsm.js`).** `v = 2·τ·f`; el empuje máximo está limitado por fuerza a baja
velocidad y por potencia a alta; ángulo de carga `F = F_max·sen δ`. `SyncDrive` modela la dinámica de
la máquina síncrona (retraso δ con carga, δ negativo al frenar, pérdida de sincronismo).

**Tren y viaje (`train.js`).** Secciones, resistencia aerodinámica, controlador de velocidad con
anticipación de la rampa de frenado y máquina de estados (reposo, levitando, acelerando, crucero,
frenando, estación). Integración con paso fijo de 1 ms.

### Tests

`npm test` ejecuta 40 tests, entre ellos: el equilibrio EMS sostiene el peso a 10 mm; sin control una
perturbación lo rompe; con control converge; el despegue no toca el riel; la sustentación EDS iguala
el peso a la velocidad de despegue; el motor síncrono llega a `δ = asin(F_carga/F_max)` y pierde el
sincronismo si la carga lo supera; el balance de energía de un viaje parada a parada se cierra al 1 %;
la posición es continua (sin saltos). Un error real que estos tests detectaron: el tren se pasaba de
la estación por 40 a 84 m por seguir el perfil de frenado solo con realimentación; se corrigió con un
término de anticipación.

## Láminas (skill *anatomy*)

Tres figuras isométricas generadas con la skill [anatomy](https://github.com/wheresryan22/anatomy)
(copia del kit en `vendor/anatomy/`, licencia MIT):

1. **Banco de levitación EMS:** un módulo de imán bajo un estator, con regla de entrehierro,
   amperímetro y carga que se deja caer. Pulsa Espacio para apagar el control.
2. **Banco del motor lineal síncrono:** la onda del estator, el vehículo con cuatro polos, el ángulo
   de carga y la pérdida de sincronismo (tecla J).
3. **Banco de levitación EDS:** una cinta con bobinas bajo un bloque superconductor que se eleva con
   la velocidad y retrae sus ruedas.

Cada figura importa el mismo modelo físico (`figures/lib/physics-inline.mjs` lo incrusta en la página
autónoma). `npm run figures` las regenera en `public/figures/`. Las tres pasan la comprobación de
extremos de línea de la skill (`scripts/lines.mjs`: 0 extremos sueltos) en tema claro y oscuro.

## Procedencia de los datos

`fuente` = hallado en una fuente citada; `derivado` = calculado a partir de ellas; `ilustrativo` =
elegido para que el modelo sea coherente, **no es un dato oficial**. Cada constante lleva su etiqueta en
`src/physics/constants.js`.

| Valor | Tipo | Origen |
|---|---|---|
| Entrehierro nominal EMS: 10 mm (rango 10 a 15 mm) | fuente | [US 7,637,214](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/7637214), [US 7,814,840](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/7814840) |
| Paso polar del estator: 258 mm; paso de diente 63 mm | fuente | [MDPI Actuators 14(11):514](https://www.mdpi.com/2076-0825/14/11/514), [MAGLEV projects: technology aspects and choices](https://www.researchgate.net/publication/224055510_MAGLEV_projects_technology_aspects_and_choices) |
| Vehículo de ensayo de dos secciones: 54 m, 120 t en vacío, 85 kN, 0 a 215 Hz, 4250 V, 400 km/h, 450 kW a bordo | fuente | [tabla en un documento sobre motores lineales](https://artefacts-discovery.researcher.life/full_text/DA-2/68/680fe23b46a73ba28f0969fd014f70bc/full_text/623230215391790103f89577fdb0e5e6.pdf); el motor (4250 V, 1200 A, 0 a 215 Hz) coincide con [The Transrapid Magnetic Levitation System](https://escholarship.org/content/qt6ds64496/qt6ds64496.pdf). El empuje de 85 kN solo aparece en una fuente. |
| 60 t y 27 m por sección; 42,5 kN por sección; velocidad máxima EMS 399 km/h (= 2·τ·215 Hz) | derivado | de lo anterior |
| EDS: elevación de unos 100 mm | fuente | [JR Central](https://global.jr-central.co.jp/en/company/_pdf/superconducting_maglev.pdf), [KIT](https://publikationen.bibliothek.kit.edu/1000075557/4402937) |
| EDS: ruedas hasta unos 150 km/h | fuente aprox. | [ficha educativa de JR Central](https://www.japansociety.org.uk/usercontent/572cf69871d517dad7964c455c746698/JR-Central-SCMAGLEV-Worksheet.pdf) (describe la línea de pruebas de Yamanashi) |
| EDS: 603 km/h (récord de la serie L0, 2015) | fuente | [L0 Series](https://en.wikipedia.org/wiki/L0_Series) |
| EDS: 700 kA, NbTi y helio líquido; bobinas en 8 conectadas entre paredes | fuente | KIT; [SCMaglev](https://en.wikipedia.org/wiki/SCMaglev) |
| Corriente de equilibrio 50 A, retardo del convertidor 5 ms, ganancias del PID, patín a 20 mm, área frontal, Cd, potencia por sección, masa y empuje EDS, `vc = 20 m/s`, `κ = 0,35`, `λ`, elevación sobre ruedas 85 mm, energía en kWh | ilustrativo | elegidos por el autor |

## Límites del modelo y lo que no se hizo

- **La ley de sustentación del EDS es cualitativa.** No es la ley de las bobinas en 8 de flujo nulo:
  en una patente de levitación por inducción ([US 5,649,489](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/5649489))
  la fuerza restauradora vertical es proporcional al desplazamiento del imán respecto del centro de la
  bobina. Con la ley simple de arrastre `F·vc/v` el pico de arrastre es ~0,6 veces el peso y el tren no
  podría arrancar; el factor `κ` lo reduce y es ilustrativo.
- Las secciones se simulan por separado, en dos grados de libertad (vertical y lateral), sin cabeceo,
  balanceo ni acoplamiento mecánico entre ellas. No se modela la alimentación de a bordo.
- Las cifras del vehículo de ensayo del Transrapid no son las de un servicio comercial.
- Representación: el entrehierro se exagera, las flechas de fuerza usan escala de raíz cuadrada, la
  onda del estator se dibuja en el marco del vehículo (el motor es síncrono) y las bobinas de la
  lámina EDS se animan en cámara lenta (1/40).
- El `README` y la ventana "Cómo funciona" separan lo documentado de lo ilustrativo; si un dato importa
  para un uso real, hay que contrastarlo con la fuente primaria.

## Estructura

```
src/physics/      modelo puro: constants, ems, eds, lsm, train
src/scene/        escena Three.js: mundo, vía y vehículo EMS/EDS, campos, cámaras, etiquetas
src/ui/           interfaz, gráficas y ventana "Cómo funciona"
figures/          láminas (build.mjs por figura) y lib/physics-inline.mjs
vendor/anatomy/   kit de la skill anatomy (MIT)
tests/            tests del modelo físico
scripts/          build-figures.mjs
```

## Licencia

Código del proyecto: MIT. El kit de `vendor/anatomy/` conserva su propia licencia MIT
(`vendor/anatomy/LICENSE`).
