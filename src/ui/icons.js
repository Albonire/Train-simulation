// Iconos de trazo (16x16, currentColor). Sin dependencias.

const svg = (body, extra = "") =>
  `<svg class="ic" viewBox="0 0 16 16" aria-hidden="true" ${extra}>${body}</svg>`;

export const ICONS = {
  orbit: svg('<ellipse cx="8" cy="8" rx="6.5" ry="3"/><circle cx="8" cy="8" r="1.6" class="f"/><path d="M12.6 5.4l.9-1.6"/>'),
  chase: svg('<path d="M2 11h8.5a3 3 0 0 0 0-6H6"/><path d="M8 3L6 5l2 2"/><path d="M2 13.5h12"/>'),
  section: svg('<rect x="2.5" y="2.5" width="11" height="11" rx="2"/><path d="M8 2.5v11"/><path d="M5 9h6" class="d"/>'),
  magnet: svg('<path d="M4 2.5v6a4 4 0 0 0 8 0v-6"/><path d="M2.5 2.5h3M10.5 2.5h3"/>'),
  top: svg('<path d="M8 2v8"/><path d="M5 7l3 3 3-3"/><path d="M3 13.5h10"/>'),
  book: svg('<path d="M3 3h4.2A1.8 1.8 0 0 1 9 4.8V13a1.6 1.6 0 0 0-1.6-1.6H3z"/><path d="M13 3H9"/><path d="M13 3v8.4H9.6A.6.6 0 0 0 9 12"/>'),
  help: svg('<circle cx="8" cy="8" r="6.2"/><path d="M6.3 6.2a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1v.5"/><circle cx="8" cy="11.4" r=".6" class="f"/>'),
  sun: svg('<circle cx="8" cy="8" r="2.8"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"/>'),
  moon: svg('<path d="M12.8 10.4A5.6 5.6 0 0 1 5.6 3.2a5.6 5.6 0 1 0 7.2 7.2z"/>'),
  panel: svg('<rect x="2" y="3" width="12" height="10" rx="1.8"/><path d="M10 3v10"/>'),
  play: svg('<path d="M5 3.2v9.6L12.6 8z" class="f"/>'),
  pause: svg('<rect x="4" y="3.2" width="2.6" height="9.6" rx=".6" class="f"/><rect x="9.4" y="3.2" width="2.6" height="9.6" rx=".6" class="f"/>'),
  go: svg('<path d="M3 8h9"/><path d="M8.5 4.5L12 8l-3.5 3.5"/>'),
  hold: svg('<rect x="4" y="4" width="8" height="8" rx="1.2"/>'),
  reset: svg('<path d="M3.2 8a4.8 4.8 0 1 0 1.5-3.5"/><path d="M3 2.5v3h3"/>'),
  load: svg('<path d="M5.5 6h5l1.5 7.5H4z"/><circle cx="8" cy="4" r="1.6"/>'),
  gust: svg('<path d="M2 6h7.5a2 2 0 1 0-2-2"/><path d="M2 10h10a2 2 0 1 1-2 2"/>'),
  kick: svg('<path d="M8 2v7"/><path d="M5 6l3 3 3-3"/><path d="M2.5 13h11"/>'),
  ctrl: svg('<path d="M2 8h2.5l1.5-4 2.5 8 1.5-4H14"/>'),
  power: svg('<path d="M8 2v6"/><path d="M4.6 4.4a5 5 0 1 0 6.8 0"/>'),
  close: svg('<path d="M4 4l8 8M12 4l-8 8"/>'),
  view: svg('<path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>'),
  data: svg('<path d="M2.5 13.5h11"/><path d="M4.5 11V7M8 11V4M11.5 11V8.5"/>'),
  keys: svg('<rect x="1.5" y="4" width="13" height="8" rx="1.6"/><path d="M4.2 7h.01M6.7 7h.01M9.2 7h.01M11.7 7h.01M5 9.6h6"/>'),
  cube: svg('<path d="M8 1.8l5.5 3.1v6.2L8 14.2 2.5 11.1V4.9z"/><path d="M2.5 4.9L8 8l5.5-3.1M8 8v6.2"/>'),
  train: svg('<rect x="3.2" y="2.2" width="9.6" height="8.8" rx="2.6"/><path d="M3.2 7.6h9.6"/><path d="M5.2 13.6h.01M10.8 13.6h.01"/>'),
  sliders: svg('<path d="M2.5 5h11M2.5 11h11"/><circle cx="6" cy="5" r="1.6" class="w"/><circle cx="10.5" cy="11" r="1.6" class="w"/>'),
};
