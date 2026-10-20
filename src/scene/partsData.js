// Catalogo de piezas del explorador: nombre, texto breve, cifras en vivo, encuadre y como se
// separa en la vista expandida. Es solo datos (sin three), asi se puede probar.
//
// Texto: dos frases como maximo. Lo que es dato del modelo y no de una fuente se dice asi.
//
// pose: { az, el, fit } direccion de la camara (grados; az 0 mira desde +z, el > 0 desde arriba)
//       y holgura del encuadre. span: mitad de la longitud (m) que se encuadra a lo largo de la via.
// explode: desplazamiento (m) con la vista separada al maximo. dz se refleja segun el lado
//       de cada malla (dentro del constructor), por eso aqui es el valor hacia afuera.

const f = (v, d = 1) => {
  if (!Number.isFinite(v)) return "–";
  const t = v.toFixed(d);
  // un valor que se redondea a cero no lleva signo (evita "-0,00")
  return (Number(t) === 0 ? (0).toFixed(d) : t).replace(".", ",");
};

export const MAX_TEXT = 230; // caracteres por texto

export const PARTS = {
  ems: [
    {
      id: "coche",
      name: "Coche",
      text: "Cada sección abraza la viga por debajo y por los lados. De su faldón cuelgan los imanes. En el modelo mide 14 m y pesa 60 t.",
      live: (t, tr) => [["Velocidad", f(t.speedKmh, 0), "km/h"], ["Masa", f(tr.sections[1].mass / 1e3, 0), "t"]],
      pose: { az: 28, el: 14, fit: 1.05 },
      span: 10,
      explode: { dx: 0, dy: 5, dz: 0 },
    },
    {
      id: "lev",
      name: "Imán de sustentación",
      text: "Electroimán bajo el estator que lo atrae hacia arriba. El control corrige su corriente cientos de veces por segundo para mantener 10 mm.",
      live: (t, tr) => [["Corriente", f(tr.sections[1].I, 1), "A"], ["Entrehierro", f(tr.sections[1].gap * 1000, 1), "mm"]],
      pose: { az: 22, el: -12, fit: 1.25 },
      span: 4,
      explode: { dx: 0, dy: -2, dz: 0 },
    },
    {
      id: "guide",
      name: "Imán de guiado",
      text: "Mira al riel lateral de la viga y evita que el coche se desplace de lado. Trabaja con el mismo principio que el de sustentación.",
      live: (t, tr) => [["Fuerza lateral", f(tr.sections[1].lateralForce / 1e3, 1), "kN"], ["Desvío lateral", f(tr.sections[1].y * 1000, 2), "mm"]],
      pose: { az: 40, el: 6, fit: 1.3 },
      span: 4,
      explode: { dx: 0, dy: -0.8, dz: 2.6 },
    },
    {
      id: "stator",
      name: "Estator largo",
      text: "Paquete de hierro con el devanado trifásico, a lo largo de la vía. Su onda de campo viaja a 2·τ·f y arrastra al tren sin contacto.",
      live: (t) => [["Frecuencia", f(t.frequency, 1), "Hz"], ["Ángulo de carga", f(t.loadAngleDeg, 0), "°"]],
      pose: { az: 20, el: -14, fit: 1.3 },
      span: 4,
      explode: { dx: 0, dy: -0.5, dz: 1.8 },
    },
    {
      id: "rail",
      name: "Riel de guiado",
      text: "Placa de acero en el costado de la viga, frente a los imanes de guiado. Cierra el circuito magnético lateral.",
      live: () => [["Entrehierro lateral", "10", "mm"]],
      pose: { az: 62, el: 8, fit: 1.35 },
      span: 4,
      explode: { dx: 0, dy: 0.4, dz: 2.8 },
    },
    {
      id: "beam",
      name: "Viga",
      text: "Estructura de hormigón en T que lleva el estator, los rieles y los cables. El vehículo la abraza.",
      live: () => [["Paso polar τ", "258", "mm"]],
      pose: { az: 30, el: 18, fit: 1.1 },
      span: 8,
      explode: { dx: 0, dy: 0, dz: 0 },
    },
    {
      id: "pier",
      name: "Pilar",
      text: "Eleva la viga unos 5 m sobre el suelo. En el modelo hay uno por tramo de estator, cada 25,8 m.",
      live: () => [["Separación", "25,8", "m"]],
      pose: { az: 35, el: 10, fit: 1.2 },
      span: 3,
      explode: { dx: 0, dy: 0, dz: 0 },
    },
  ],
  eds: [
    {
      id: "coche",
      name: "Coche",
      text: "Rueda sobre neumáticos hasta unos 150 km/h y después levita sobre sus imanes. En el modelo cada sección mide 14 m y pesa 25 t.",
      live: (t) => [["Velocidad", f(t.speedKmh, 0), "km/h"], ["Elevación", f(t.gapMm, 0), "mm"]],
      pose: { az: 30, el: 12, fit: 1.05 },
      span: 10,
      explode: { dx: 0, dy: 4.5, dz: 0 },
    },
    {
      id: "cryo",
      name: "Imán superconductor",
      text: "Bobina de niobio-titanio enfriada con helio líquido. Su campo constante induce corrientes en la pared y la repulsión sostiene al coche.",
      live: (t) => [["Corriente inducida", f(t.induced * 100, 0), "%"], ["Elevación", f(t.gapMm, 0), "mm"]],
      // desde arriba: la pared de la via tapa lo que hay dentro de la U
      pose: { az: 48, el: 42, fit: 1.25 },
      span: 4,
      explode: { dx: 0, dy: 0, dz: 2.2 },
    },
    {
      id: "lev8",
      name: "Bobinas en 8",
      text: "Conectadas entre ambas paredes. Con el imán centrado no se induce corriente y con un desvío aparece una fuerza que lo recentra.",
      live: (t) => [["Corriente inducida", f(t.induced * 100, 0), "%"], ["Sustentación", f(t.liftTotal / 1e3, 0), "kN"]],
      pose: { az: 18, el: 44, fit: 1.2 },
      span: 4,
      explode: { dx: 0, dy: -0.7, dz: 3.2 },
    },
    {
      id: "prop",
      name: "Bobinas de propulsión",
      text: "Estator del motor lineal: su onda de corriente arrastra a los imanes, que hacen de campo. Cambiando la fase se frena.",
      live: (t) => [["Frecuencia", f(t.frequency, 1), "Hz"], ["Empuje", f(t.thrust / 1e3, 0), "kN"]],
      pose: { az: 18, el: 44, fit: 1.2 },
      span: 4,
      explode: { dx: 0, dy: 0.7, dz: 3.2 },
    },
    {
      id: "wall",
      name: "Pared de la vía",
      text: "Forma una U con la losa y lleva las bobinas en su cara interior. El vehículo circula dentro.",
      live: () => [["Altura", "2", "m"]],
      pose: { az: 40, el: 12, fit: 1.15 },
      span: 6,
      explode: { dx: 0, dy: 0, dz: 3.8 },
    },
    {
      id: "wheels",
      name: "Neumáticos retráctiles",
      text: "Soportan al coche en parado y hasta unos 150 km/h. Después se recogen: la sustentación magnética ya iguala el peso.",
      live: (t) => [["Estado", t.wheelsDown ? "fuera" : "recogidos", ""]],
      pose: { az: 30, el: 46, fit: 1.35 },
      span: 5,
      explode: { dx: 0, dy: -1.3, dz: 0 },
    },
    {
      id: "pier",
      name: "Pilar y losa",
      text: "Sostienen la vía en U. En el modelo hay un pilar por tramo, cada 27 m.",
      live: () => [["Separación", "27", "m"]],
      pose: { az: 35, el: 10, fit: 1.2 },
      span: 3,
      explode: { dx: 0, dy: 0, dz: 0 },
    },
  ],
};

export const partIds = (mode) => PARTS[mode].map((p) => p.id);
export const partById = (mode, id) => PARTS[mode].find((p) => p.id === id);

/** Direccion de la camara (vector unitario hacia donde esta la camara respecto del objetivo). */
export function poseDirection({ az, el }) {
  const a = (az * Math.PI) / 180;
  const e = (el * Math.PI) / 180;
  return [-Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)];
}

/** Pieza siguiente o anterior, en circulo. */
export function stepPart(mode, id, dir) {
  const ids = partIds(mode);
  const i = ids.indexOf(id);
  return ids[(i + dir + ids.length) % ids.length];
}
