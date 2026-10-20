// Hand-drawn style line icons (24×24, stroke = currentColor), so they follow the ink color
// in both the notebook and chalkboard themes. Used instead of emoji everywhere.

const P = {
  pen: 'M4 20l1.4-4.6L15.8 5a2.1 2.1 0 0 1 3.1 3L8.6 18.6z M13.8 7l3.1 3.1 M4 20l4.6-1.4',
  pencil: 'M15.4 4.6l4 4L9 19l-5.2 1.2L5 15z M13.4 6.6l4 4 M5 15l4 4 M4.3 18.2l1.6 1.5',
  marker: 'M14.2 3.8l6 6-8.6 8.6-3.4.6-3.2-3.2.6-3.4z M12.8 5.2l6 6 M4.4 19.6l3-3 M4 20h5',
  nib: 'M12 21.5c-.6-3.6-3.8-6.6-5.6-9.6L12 2.5l5.6 9.4c-1.8 3-5 6-5.6 9.6z M12 8.5v5 M12 15.6v.1',
  spray: 'M7.5 10.5h7v9.5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1z M8.5 10.5V7.5h5v3 M10 7.5V5.2h2v2.3 M17.5 5.5h.1 M20 4h.1 M19.5 7.5h.1 M17.5 9.5h.1 M20.5 10.5h.1',
  neon: 'M13.5 2.5L5 13.6h6.3L10.4 21.5l8.6-11.8h-6.4z',
  rainbow: 'M2.8 18a9.2 9.2 0 0 1 18.4 0 M6.3 18a5.7 5.7 0 0 1 11.4 0 M9.8 18a2.2 2.2 0 0 1 4.4 0',
  eraser: 'M8.6 20.2H20 M4.6 15.4l8.8-8.9a2 2 0 0 1 2.9 0l3.2 3.2a2 2 0 0 1 0 2.9l-7.6 7.6H8.6l-4-4a.3.3 0 0 1 0-.8z M8.6 11.4l5.6 5.6',
  bucket: 'M5.2 11.1l6-6 8 8-6 6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8z M5.4 12.6h13.4 M11.2 5.1L9 2.9 M20.3 16c.2 1.4 1.2 2.3 1.2 3.3a1.2 1.2 0 0 1-2.4 0c0-1 1-1.9 1.2-3.3z',
  line: 'M5 19L19 5 M4.2 19.8h.1 M19.8 4.2h.1',
  rect: 'M4.4 6.3c5-.4 10.1.2 15.2-.1.3 3.8-.2 7.6.1 11.4-5.1.4-10.2-.2-15.3.1-.2-3.8.3-7.6 0-11.4z',
  ellipse: 'M12 5.8c5 0 8.6 2.8 8.6 6.2s-3.6 6.2-8.6 6.2-8.6-2.8-8.6-6.2 3.6-6.2 8.6-6.2z',
  filled: 'M4.4 6.3c5-.4 10.1.2 15.2-.1.3 3.8-.2 7.6.1 11.4-5.1.4-10.2-.2-15.3.1-.2-3.8.3-7.6 0-11.4z M6.5 14.5l5-6 M9.5 17l7.5-9 M14 17.2l4.4-5.2',
  undo: 'M9 14.5L4 9.5l5-5 M4 9.5h10.5a5.5 5.5 0 0 1 0 11H11',
  trash: 'M4 7h16 M9.8 3.6h4.4 M6 7l1.1 13.2h9.8L18 7 M10 11v6 M14 11v6',
  soundOn: 'M3.8 9.4h3.6L12 5.4v13.2L7.4 14.6H3.8z M15.6 9a4.2 4.2 0 0 1 0 6 M18.2 6.4a7.8 7.8 0 0 1 0 11.2',
  soundOff: 'M3.8 9.4h3.6L12 5.4v13.2L7.4 14.6H3.8z M15.8 9.6l4.8 4.8 M20.6 9.6l-4.8 4.8',
  moon: 'M20 14.6A8.6 8.6 0 1 1 9.4 4a7 7 0 0 0 10.6 10.6z',
  door: 'M13.5 4H6v16h7.5 M10 12h10.2 M17 8.8l3.2 3.2-3.2 3.2',
  skip: 'M5 5.2l9 6.8-9 6.8z M18.5 5v14',
  link: 'M10 14a3.6 3.6 0 0 0 5.1 0l3-3a3.6 3.6 0 0 0-5.1-5.1l-1 1 M14 10a3.6 3.6 0 0 0-5.1 0l-3 3a3.6 3.6 0 0 0 5.1 5.1l1-1',
  dice: 'M6.5 4.2h11a2.3 2.3 0 0 1 2.3 2.3v11a2.3 2.3 0 0 1-2.3 2.3h-11a2.3 2.3 0 0 1-2.3-2.3v-11a2.3 2.3 0 0 1 2.3-2.3z M8.6 8.6h.1 M15.4 8.6h.1 M12 12h.1 M8.6 15.4h.1 M15.4 15.4h.1',
  paper: 'M6 3h9l4 4v14H6z M15 3v4h4 M9 12h7 M9 15.5h5',
  check: 'M4 12.6l5 5L20.2 6.4',
  crown: 'M4 18.5h16 M4.4 18.5L3 8l5 4.2 4-7.2 4 7.2L21 8l-1.4 10.5',
  join: 'M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M3.5 20.2c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2 M19 7.8v6 M16 10.8h6',
  trophy: 'M8 4h8v5.2a4 4 0 0 1-8 0z M8 5.8H5.2a3 3 0 0 0 3 4.2 M16 5.8h2.8a3 3 0 0 1-3 4.2 M12 13.2v3.6 M8.4 20.2h7.2 M9.8 16.8h4.4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7.2V12l3.2 2.2',
  star: 'M12 3.4l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.7l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z',
  heart: 'M12 20.2s-7.6-4.6-7.6-10.1A4.3 4.3 0 0 1 12 7.5a4.3 4.3 0 0 1 7.6 2.6c0 5.5-7.6 10.1-7.6 10.1z',
  fire: 'M12 21.2c-3.9 0-6.6-2.7-6.6-6.3 0-3.6 2.9-5.3 3.6-8.9 1.8 1.2 2.6 3 2.8 4.7 1-1 1.6-2.5 1.6-4.2 2.8 2 5.2 5 5.2 8.4 0 3.6-2.7 6.3-6.6 6.3z',
  thumbs: 'M7 20.8H4.4V11H7z M7 11l3.5-7c1.5 0 2.6 1.1 2.2 2.7L12.2 10h5.5a2 2 0 0 1 2 2.3l-1.2 6.7a2.2 2.2 0 0 1-2.2 1.8H7',
  laugh: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M7.8 9.2l2.2 1.2-2.2 1.2 M16.2 9.2L14 10.4l2.2 1.2 M7.4 14h9.2a4.6 4.6 0 0 1-9.2 0z',
  wow: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M9 9.2v1.4 M15 9.2v1.4 M12 13.4a2 2.6 0 1 0 0 5.2 2 2.6 0 0 0 0-5.2z',
  think: 'M8.8 8.8a3.2 3.2 0 1 1 4.8 2.8c-1 .6-1.6 1.4-1.6 2.6 M12 18.2h.1',
  eye: 'M2.6 12S6 5.6 12 5.6 21.4 12 21.4 12 18 18.4 12 18.4 2.6 12 2.6 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z M12 12.1h.1',
  warn: 'M12 3.8l9.2 16.2H2.8z M12 10v4.2 M12 17.2h.1',
  chat: 'M4 5.5h16v10.5H10l-4.5 3.8V16H4z M8 9.6h8 M8 12.6h5',
  sparkle: 'M12 3v4.5 M12 16.5V21 M3 12h4.5 M16.5 12H21 M6 6l2.6 2.6 M15.4 15.4L18 18 M18 6l-2.6 2.6 M8.6 15.4L6 18',
};

export const ICON_NAMES = Object.keys(P);

export function iconSvg(name) {
  const d = P[name];
  if (!d) return '';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

// <span class="ic">…</span>; sized by the surrounding font-size
export function icon(name, cls = '') {
  const span = document.createElement('span');
  span.className = `ic${cls ? ` ${cls}` : ''}`;
  span.innerHTML = iconSvg(name);
  return span;
}

// 1st / 2nd / 3rd place medal with a ribbon
export function medal(n) {
  const span = document.createElement('span');
  span.className = 'ic medal';
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M8 2.8l2.6 6.4 M16 2.8l-2.6 6.4"/><circle cx="12" cy="15" r="6.2"/>
    <text x="12" y="18.4" text-anchor="middle" font-size="9" font-family="Patrick Hand, sans-serif" fill="currentColor" stroke="none">${n}</text></svg>`;
  return span;
}

// Static HTML can ask for icons with <span data-icon="name"></span>
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    el.classList.add('ic');
    el.innerHTML = iconSvg(el.dataset.icon);
  });
}
