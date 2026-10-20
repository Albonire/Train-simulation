// Constantes del modelo. Cada valor lleva su procedencia:
//   [fuente]       valor encontrado en una fuente citada (ver README).
//   [derivado]     calculado a partir de valores con fuente.
//   [ilustrativo]  elegido por el autor para que el modelo sea coherente; NO es
//                  un dato oficial y la interfaz lo marca como tal.

export const MU0 = 4 * Math.PI * 1e-7; // permeabilidad del vacio, H/m
export const G = 9.81; // m/s^2
export const RHO_AIR = 1.225; // kg/m^3, aire a nivel del mar

export const KMH = 1 / 3.6; // multiplicar km/h por esto para obtener m/s
export const toKmh = (ms) => ms * 3.6;

// ---------------------------------------------------------------- EMS (Transrapid)
export const EMS = {
  // [fuente] entrehierro nominal de 10 mm mantenido por control activo
  // (patentes USPTO 7637214 / 7814840 y ficha tecnica Transrapid; rango 10-15 mm
  // en la tabla del vehiculo de pruebas).
  gapNominal: 0.010,
  // [fuente] paso polar del estator 258 mm (Transrapid, MDPI Actuators 14(11):514)
  polePitch: 0.258,
  // [fuente] frecuencia maxima 215 Hz en el vehiculo de pruebas
  // => v = 2*tau*f = 111 m/s = 399 km/h [derivado]
  fMax: 215,
  // [fuente] vehiculo de pruebas de dos secciones: 120 t vacio, 54 m
  // => 60 t por seccion [derivado]
  sectionMass: 60e3,
  // [ilustrativo] largo de cada seccion. La fuente da 27 m (54 m / 2); se acorta
  // a 14 m para que el tren entero quepa en pantalla con buen tamano. La masa por
  // seccion no cambia: es un dato del modelo, no sale de la longitud.
  sectionLength: 14,
  sections: 3, // [ilustrativo] tren de tres secciones
  // [fuente] empuje maximo 85 kN para dos secciones => 42.5 kN por seccion [derivado]
  thrustPerSection: 42.5e3,
  // [ilustrativo] potencia electrica maxima del tramo energizado, por seccion
  powerPerSection: 3.0e6,
  // [ilustrativo] corriente de equilibrio del electroiman de sustentacion
  currentEq: 50,
  // [ilustrativo] retardo del convertidor de potencia (chopper), s
  currentLag: 0.005,
  // [ilustrativo] corriente maxima como multiplo de la de equilibrio
  currentMaxRatio: 2.5,
  // [ilustrativo] holgura del patin de aterrizaje (contacto mecanico), m
  skidGap: 0.003,
  // [ilustrativo] polarizacion del guiado lateral: fraccion del peso por lado
  guideBiasFraction: 0.05,
  guideCurrentBias: 20,
  // [ilustrativo] carga util para la perturbacion de carga: fraccion de la masa
  loadStepFraction: 0.12,
  // [ilustrativo] area frontal y coeficiente aerodinamico del tren
  dragArea: 10,
  dragCd: 0.3,
};

// ---------------------------------------------------------------- EDS (SCMaglev)
export const EDS = {
  // [fuente] elevacion de 100 mm en crucero (JR Central, KIT)
  gapCruise: 0.100,
  // [fuente aproximada] ruedas de goma por debajo de ~150 km/h (ficha educativa
  // de JR Central; el dato describe la linea de pruebas de Yamanashi)
  liftoffSpeed: 150 * KMH,
  // [fuente] 603 km/h, record de la serie L0 (2015)
  recordSpeed: 603 * KMH,
  // [fuente] 700 kA de fuerza magnetomotriz (NbTi, helio liquido) en el KIT
  magnetMmf: 700e3,
  // [ilustrativo] separacion cuando el vehiculo descansa sobre las ruedas
  gapWheels: 0.085,
  // [ilustrativo] longitud de decaimiento de la fuerza con la distancia
  // (se calibra para que gapCruise se alcance a alta velocidad)
  // [ilustrativo] velocidad caracteristica de la bobina (L/R): el pico de
  // arrastre ocurre alrededor de este valor
  vc: 20,
  // [ilustrativo] factor de reduccion del arrastre inducido. Con la ley simple
  // F_D = F_L*vc/v el pico de arrastre es ~0.6 del peso y el tren no podria
  // arrancar; las bobinas en 8 de flujo nulo lo reducen. Aqui: L/D = v/(kappa*vc).
  dragFactor: 0.35,
  sectionMass: 25e3,
  // [ilustrativo] igual que en EMS: 14 m por seccion
  sectionLength: 14,
  sections: 3,
  // [ilustrativo] amortiguamiento de la suspension secundaria, N*s/m por kg
  dampingPerKg: 8,
  // [ilustrativo] frecuencia propia lateral a alta velocidad, rad/s
  lateralOmega: 6,
  // [ilustrativo] paso polar de las bobinas de propulsion
  polePitch: 0.9,
  thrustPerSection: 80e3,
  powerPerSection: 6.0e6,
  dragArea: 9,
  dragCd: 0.25,
};

// [ilustrativo] rendimiento global del motor lineal + convertidor
export const LSM_EFFICIENCY = 0.9;

// [ilustrativo] resistencia de rodadura de las ruedas de goma (coeficiente)
export const WHEEL_ROLLING = 0.015;
