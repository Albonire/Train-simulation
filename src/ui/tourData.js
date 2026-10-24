// visita guiada: pasos fijos por tecnologia. datos puros (sin dom ni three): main.js los recorre
// (camara, carroceria, capas, escala de tiempo, evento) y ui.js dibuja la tarjeta.
//
// cada paso:
//   id, title, text   lo que se lee (titulo corto, a lo sumo dos frases sencillas)
//   rig               camara: orbit | chase | section | gap | top | field
//   layers            capas que se encienden o se apagan en este paso (fields, wave, forces, labels)
//   timescale         escala de tiempo (1 = tiempo real)
//   loupe             true: la lupa del entrehierro abierta
//   reset             true: el viaje vuelve al principio al entrar (solo el primer paso)
//   advance           s simulados que se adelanta el viaje al entrar (el eds necesita llegar a su velocidad)
//   event             perturbacion que se dispara al entrar: ctrloff | cutpower | kick | gust | null
//   slow              { scale, seconds }: camara lenta durante `seconds` de tiempo real tras el evento
//   eventundo         s de tiempo real tras los que se deshace el evento (ctrloff) y vuelve el control
//
// las cifras que aparecen en el texto son las del modelo (hueco nominal de 10 mm, 150 km/h de las ruedas);
// el resto es explicacion cualitativa.

const LAYERS_OFF = { fields: false, wave: false, forces: false };

export const TOUR = {
  ems: [
    {
      id: "hueco",
      title: "El tren no toca la vía",
      text: "Entre el imán del tren y el riel de hierro de la vía (el estator) quedan solo 10 mm de aire. Nada roza.",
      rig: "gap",
      layers: LAYERS_OFF,
      timeScale: 1,
      loupe: true,
      reset: true,
    },
    {
      id: "iman",
      title: "El imán atrae hacia arriba",
      text: "Cada imán tira del estator hacia arriba. La suma de todos sostiene el peso del tren.",
      rig: "gap",
      layers: { fields: true, wave: false, forces: true },
      timeScale: 1,
      loupe: true,
    },
    {
      id: "control",
      title: "Atraer es inestable",
      text: "Si el hueco se achica, la atracción crece y el imán se pega. Un control mide el hueco y corrige la corriente sin parar. Mira qué pasa sin él.",
      rig: "gap",
      layers: { fields: true, wave: false, forces: true },
      timeScale: 1,
      loupe: true,
      event: "ctrlOff",
      slow: { scale: 0.12, seconds: 2.5 },
      eventUndo: 3,
    },
    {
      id: "motor",
      title: "La vía también es el motor",
      text: "Una onda de corriente recorre el estator y arrastra al tren a su propia velocidad. Las franjas rojas y azules son esa onda.",
      rig: "orbit",
      layers: { fields: false, wave: true, forces: false },
      timeScale: 5,
      loupe: false,
    },
    {
      id: "libre",
      title: "Ahora, tú",
      text: "Prueba las perturbaciones en Control, elige una pieza con P o cambia de cámara con 1 a 6.",
      rig: "orbit",
      layers: { fields: true, wave: true, forces: false },
      timeScale: 5,
      loupe: true,
    },
  ],
  eds: [
    {
      id: "ruedas",
      title: "Despacio, rueda",
      text: "Parado, el tren descansa sobre neumáticos. Sin movimiento no hay levitación: hacen falta unos 150 km/h.",
      rig: "gap",
      layers: LAYERS_OFF,
      timeScale: 1,
      loupe: true,
      reset: true,
    },
    {
      id: "campo",
      title: "El imán induce corrientes",
      text: "Al pasar, el imán superconductor del tren induce corrientes en las bobinas de la pared. Esas corrientes lo empujan hacia arriba.",
      rig: "gap",
      layers: { fields: true, wave: false, forces: true },
      timeScale: 20,
      loupe: true,
      advance: 44,
    },
    {
      id: "despega",
      title: "Despega y recoge las ruedas",
      text: "Pasados unos 150 km/h la fuerza supera al peso: las ruedas se recogen y el tren queda flotando a unos 10 cm.",
      rig: "gap",
      layers: { fields: true, wave: false, forces: true },
      timeScale: 5,
      loupe: true,
      advance: 6,
    },
    {
      id: "estable",
      title: "Se corrige solo",
      text: "Si el tren se desplaza o lo golpean, las bobinas en 8 lo devuelven al centro. No hace falta ningún control.",
      rig: "gap",
      layers: { fields: true, wave: false, forces: true },
      timeScale: 1,
      loupe: true,
      event: "kick",
      slow: { scale: 0.3, seconds: 3 },
    },
  ],
};

/** pasos de un modo (siempre un arreglo, aunque el modo no exista). */
export const stepsOf = (mode) => TOUR[mode] ?? [];

/** paso `i` acotado al rango valido, o null si el modo no tiene visita. */
export function stepAt(mode, i) {
  const s = stepsOf(mode);
  if (!s.length) return null;
  return s[Math.min(s.length - 1, Math.max(0, Math.trunc(i) || 0))];
}

/** texto del indicador de avance: "2 de 5". */
export const stepLabel = (mode, i) => `${Math.min(stepsOf(mode).length, Math.max(0, i) + 1)} de ${stepsOf(mode).length}`;
