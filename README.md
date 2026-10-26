# Simulador y Modelado 3D de Tren de Levitación Magnética (Maglev)

Pipeline integral de **diseño y modelado 3D en Blender** articulado con un **motor de simulación física y visualización interactiva en tiempo real** (WebGL / Three.js).

El proyecto aborda el estudio cinemático, dinámico y geométrico de las dos tecnologías principales de levitación magnética a nivel mundial:

- **EMS (suspensión electromagnética, estilo Transrapid):** electroimanes de sustentación y guiado que abrazan la viga por debajo y son atraídos hacia el estator; el equilibrio es inestable y se sostiene mediante un lazo cerrado de control PID.
- **EDS (suspensión electrodinámica, estilo SCMaglev):** imanes superconductores a bordo que inducen corrientes de flujo nulo en bobinas de la pared guía en forma de 8; levitación pasiva y estable generada por el movimiento.
- **Motor lineal síncrono (LSM):** estator en vía para propulsión y frenado regenerativo coordinado en ambas tecnologías.

---

## Arquitectura del Pipeline: Blender + Simulación WebGL

El desarrollo del proyecto se estructuró en dos etapas complementarias:

### 1. Etapa de Modelado Geométrico y Validación en Blender (`blender/`)
- **Modelado a escala real (1:1):** sección del tren de 14,0 m, anchura de 3,2 m, altura de 3,6 m y faldones envolventes.
- **Tolerancias y entrehierros:** verificación geométrica de la brecha crítica de 10 mm (0,010 m) entre electroimanes y paquetes de estator, garantizando márgenes mecánicos frente a colisiones.
- **Despiece paramétrico (*exploded view*):** jerarquía de componentes mecánicos y magnéticos (chasis, electroimanes de sustentación, imanes de guiado lateral, patines de aterrizaje, bobinas superconductoras y núcleo de vía).
- **Recursos incluidos en el repositorio:**
  - `blender/maglev_blender_setup.py`: script de automatización en Python (`bpy`) que construye el modelo completo, iluminación y materiales Principled BSDF dentro de Blender 3.x / 4.x.
  - `blender/maglev_train_ems.obj` y `.mtl`: exportación 3D en formato Wavefront para inspección, edición o renderizado inmediato en cualquier entorno 3D.
  - `blender/README.md`: guía técnica detallada del modelado, jerarquía de colecciones y modo de uso.

### 2. Etapa de Simulación Física Interactiva en Tiempo Real (`src/`)
- La aplicación WebGL reconstruye la geometría con las mismas cotas validadas en Blender (sección de 14 m, entrehierro de 10 mm, paso polar de 258 mm) y la anima a 60 fps.
- Simulación en tiempo real de las ecuaciones diferenciales de levitación, corrientes inducidas, arrastre magnético, aerodinámica y lazos de control frente a perturbaciones.
- Telemetría interactiva con cámaras orbitales, de seguimiento, corte transversal y exploración individual de piezas.

---

## Cómo ejecutar la aplicación web

```bash
npm install       # instalación de dependencias
npm run dev       # servidor de desarrollo en http://127.0.0.1:5173
npm test          # suite de pruebas del modelo físico (Vitest)
npm run build     # compilación de producción para despliegue
npm run figures   # generación de láminas isométricas interactivas
```

Requisitos: Node.js 22.12 o superior.

El documento de metodología, en lenguaje sencillo y con la identidad de la Universidad de Pamplona, está en `docs/metodologia/metodologia.pdf`.

---

## Controles y Funcionalidades del Simulador

| Control | Acción |
|---|---|
| EMS / EDS | Alterna entre suspensión electromagnética y electrodinámica (mismo tren, distinta física). |
| Viaje (pestaña Control) | Escribe la distancia (0,2 a 200 km) y la velocidad máxima: el tren sale, frena solo y se detiene en ese punto. Al llegar muestra el tiempo, la velocidad máxima y el ajuste final. |
| Velocidad máxima, escala temporal (x¼ a x60), pausa | Gobierna el trayecto y la velocidad con que se ve la simulación (x¼ es cámara lenta). |
| Salir / Retener | En EMS, el tren aterriza sobre patines en estación y vuelve a levitar antes de partir. |
| Perturbaciones | Simula carga extra (+12 %), ráfaga lateral de viento, golpe vertical en vía, corte de corriente o desconexión del lazo de control. |
| Cámaras (teclas 1 a 6) | Vistas disponibles: Órbita, Seguir, Sección transversal, Imanes, Cenital y Líneas de Campo Magnético. |
| Explorador de Piezas (P) y Despiece (E) | Permite seleccionar cada módulo modelado en Blender, aproximar la cámara y ver su función y telemetría en vivo. La tecla E ejecuta la animación de separación espacial (*exploded view*). |
| Lupa de Entrehierro (L) | Sección en vivo abajo a la izquierda que mide en milímetros la distancia imán-estator y grafica las fuerzas en tiempo real. |
| Carrocería | Modos de renderizado: sólida, rayos X o corte estructural. |
| Aprender: Láminas (`#/laminas`) | Módulo con figuras isométricas interactivas de los bancos de ensayo. |
| Aprender: Guía (`#/guia`) | Documentación técnica en la propia aplicación con fundamentación teórica y fuentes. |
| Menú `⋯` | Tema claro u oscuro, atajos, copiar enlace, guardar imagen y repetir la apertura. |

---

## Física y Modelo Matemático (`src/physics/`)

- **EMS (`ems.js`):** fuerza atractiva electrodinámica `F = μ0·N²·I²·A / (4 g²)`. Planta inestable en bucle abierto con polo inestable en `√(2g/g0) ≈ 44 rad/s`. Lazo de control PID sobre el entrehierro con anti-windup, corriente de equilibrio y rampa de despegue de 20 mm a 10 mm. Guiado transversal con par diferencial.
- **EDS (`eds.js`):** sustentación por repulsión inducida en movimiento con velocidad característica `vc`: `F = F0 · v²/(v²+vc²) · exp(-(g-gr)/λ)` y arrastre parásito proporcional a `vc / v`. Tren de aterrizaje auxiliar con ruedas desplegables por debajo de 135 km/h.
- **Motor lineal síncrono (`lsm.js`):** cálculo de velocidad sincrónica `v = 2·τ·f`. Empuje acotado por límite térmico a baja velocidad y por límite de potencia del inversor a alta velocidad. Dinámica de ángulo de carga `δ` y detección de pérdida de sincronismo.
- **Cinemática del tren (`train.js`):** integración temporal a paso fijo (1 ms), perfil aerodinámico de resistencia de avance y máquina de estados del viaje.

---

## Procedencia de los Datos Técnicos

| Parámetro | Valor | Clasificación | Referencia técnica |
|---|---|---|---|
| Entrehierro nominal EMS | 10 mm (margen operativo 10 a 15 mm) | Documentado | Patentes US 7,637,214 y US 7,814,840 |
| Paso polar del estator (τ) | 258 mm; paso de diente 63 mm | Documentado | MDPI Actuators 14(11):514 |
| Vehículo de ensayo (2 secciones) | 54 m, 120 t en vacío, 400 km/h, 4250 V, 1200 A | Documentado | The Transrapid Magnetic Levitation System |
| Sección unitaria en el modelo | 14 m por sección del tren, 60 t de masa | Parametrizado | Adaptado para escala de visualización en pantalla |
| Elevación típica en EDS | ~100 mm a alta velocidad | Documentado | JR Central / SCMaglev technical reports |
| Velocidad récord serie L0 (EDS) | 603 km/h (año 2015) | Documentado | Central Japan Railway Company |
| Bobinas superconductoras | 700 kA, aleación NbTi en baño de helio líquido | Documentado | KIT / SCMaglev publications |

---

## Estructura del Repositorio

```
blender/          modelos 3D (.obj, .mtl), scripts de automatización Blender (bpy) y documentación
src/physics/      motor físico puro: constantes, ems, eds, lsm, cinemática de tren
src/scene/        escena Three.js: mallas 3D, mundo, vía, campos electromagnéticos y cámaras
src/ui/           interfaz de usuario, gráficas en vivo, telemetría y enrutador
figures/          láminas interactivas y bancos de prueba isométricos
docs/metodologia/ documento de metodología (HTML y PDF; se regenera con node scripts/build-metodologia.mjs)
tests/            suite de pruebas unitarias y de integración física
scripts/          utilidades de compilación, capturas y QA
```

---

## Licencia

Código y modelos 3D del proyecto bajo licencia MIT.
Los componentes auxiliares en `vendor/anatomy/` conservan sus respectivas licencias originales.
