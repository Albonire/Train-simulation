// rutas por hash: #/ (simulacion), #/guia[/seccion], #/laminas[/lamina].
// el boton atras del navegador y los enlaces compartidos funcionan sin servidor.

export function parseRoute(hash) {
  const parts = String(hash ?? "")
    .replace(/^#\/?/, "")
    .split("/")
    .filter(Boolean);
  const [first, ...rest] = parts;
  if (first === "guia" || first === "laminas") return { page: first, arg: rest.join("/") };
  return { page: "sim", arg: "" };
}

export function routeHref(page, arg = "") {
  if (page === "sim") return "#/";
  return `#/${page}${arg ? "/" + arg : ""}`;
}

export function createRouter(onRoute) {
  const run = () => onRoute(parseRoute(window.location.hash));
  window.addEventListener("hashchange", run);
  return {
    start: run,
    go(page, arg = "") {
      const href = routeHref(page, arg);
      if (window.location.hash === href) run();
      else window.location.hash = href;
    },
    current: () => parseRoute(window.location.hash),
  };
}
