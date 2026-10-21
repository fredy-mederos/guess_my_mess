// The drawer's toolbox: brushes and tools, colors, size, background, undo, redo, clear.
// Wide screens: compact row with pop-up trays plus quick colors. Phones in drawer mode
// (chat hidden) show every tool and color inline instead — see .tb-inline in game.css.
import { h, $$ } from './util.js';
import { BRUSHES } from './board.js';
import { icon } from './icons.js';

export const PALETTE = [
  '#2b2533', '#868e96', '#dee2e6', '#ffffff', '#e03131', '#f76707', '#fcc419', '#94d82d',
  '#2f9e44', '#0ca678', '#1098ad', '#1c7ed6', '#4263eb', '#7048e8', '#ae3ec9', '#e64980',
  '#5c3d2e', '#8d5524', '#e0ac69', '#ffdbac', '#ffc9c9', '#a5d8ff', '#b2f2bb', '#d0bfff',
];
const QUICK = ['#2b2533', '#e03131', '#f76707', '#fcc419', '#2f9e44', '#1c7ed6', '#7048e8', '#e64980', '#8d5524', '#ffffff'];
export const BACKGROUNDS = [
  '#ffffff', '#fff8e7', '#fef9c3', '#fde2e4', '#dcfce7', '#dbeafe', '#ede9fe', '#e9ecef',
  '#ffd8a8', '#99e9f2', '#1b2a4a', '#2f4f3e', '#22252b', '#111111',
];

// Eight tools on purpose: seven brushes plus the paint bucket (a 4×2 grid on phones)
const ICONS = {
  pen: 'pen', marker: 'marker', calli: 'nib', spray: 'spray', neon: 'neon', rainbow: 'rainbow', eraser: 'eraser', fill: 'bucket',
};

export function createToolbar(root, board) {
  const tool = board.tool;
  let openPop = null;

  const toolBtn = h('button.tb-btn.tb-tool', { type: 'button', title: 'Brushes & tools' });
  const colorBtn = h('button.tb-btn.tb-color', { type: 'button', title: 'Color' }, h('span.chip'));
  const bgBtn = h('button.tb-btn', { type: 'button', title: 'Paper color' }, h('span.bg-chip'), h('span.tb-label', 'Paper'));
  // Arrows without labels: the pair takes the room Undo alone used to, so the toolbar doesn't
  // grow another row and push Clear off the bottom of short laptop screens
  const undoBtn = h('button.tb-btn', { type: 'button', title: 'Undo (Ctrl+Z)', 'aria-label': 'Undo', onclick: () => board.undo() }, icon('undo'));
  const redoBtn = h('button.tb-btn', { type: 'button', title: 'Redo (Ctrl+Shift+Z)', 'aria-label': 'Redo', onclick: () => board.redo() }, icon('redo'));
  const sizeInput = h('input.size-range', { type: 'range', min: 2, max: 60, value: tool.size, 'aria-label': 'Brush size' });
  const sizeDot = h('span.size-dot');
  const custom = h('input', { type: 'color', value: tool.color, oninput: (e) => setColor(e.target.value), 'aria-label': 'Custom color' });

  const pick = (key, label, onclick, data) =>
    h('button.tool-pick', { type: 'button', title: label, dataset: data, onclick }, icon(ICONS[key]), h('span', label));
  const toolPicks = () => [
    ...Object.entries(BRUSHES).map(([key, b]) => pick(key, b.label, () => setTool('brush', key), { brush: key })),
    pick('fill', 'Fill', () => setTool('fill'), { kind: 'fill' }),
  ];
  const swatch = (c, onclick) =>
    h('button.swatch', { type: 'button', style: { '--c': c }, title: c, dataset: { color: c }, onclick });

  // ---------- pop-up trays (wide screens) ----------
  const toolPop = h('div.pop.pop-tools',
    h('div.pop-title', 'Tools'),
    h('div.tool-grid', toolPicks()));
  const colorPop = h('div.pop.pop-colors',
    h('div.pop-title', 'Colors'),
    h('div.swatches', PALETTE.map((c) => swatch(c, () => { setColor(c); close(); }))),
    h('label.custom-color', custom, 'Pick any color'));
  const bgPop = h('div.pop.pop-bg',
    h('div.pop-title', 'Paper color'),
    h('div.swatches', BACKGROUNDS.map((c) => swatch(c, () => { board.setBackground(c); refresh(); close(); }))));

  // ---------- inline panel (phones while drawing) ----------
  const inline = h('div.tb-inline',
    h('div.tb-inline-tools', toolPicks()),
    h('div.tb-inline-colors', PALETTE.map((c) => swatch(c, () => setColor(c)))));

  function toggle(pop) {
    const opening = openPop !== pop;
    close();
    if (opening) {
      pop.classList.add('open');
      openPop = pop;
    }
  }
  function close() {
    openPop?.classList.remove('open');
    openPop = null;
  }
  document.addEventListener('pointerdown', (e) => {
    if (openPop && !root.contains(e.target)) close();
  });

  // ---------- state ----------
  function setTool(kind, brush) {
    tool.kind = kind;
    if (brush) tool.brush = brush;
    refresh();
    close();
  }

  function setColor(c) {
    tool.color = c;
    // Picking a color while erasing almost always means "go back to drawing"
    if (tool.kind === 'brush' && tool.brush === 'eraser') tool.brush = 'pen';
    refresh();
  }

  function refresh() {
    const key = tool.kind === 'brush' ? tool.brush : 'fill';
    toolBtn.replaceChildren(icon(ICONS[key]), h('span.tb-label', tool.kind === 'brush' ? BRUSHES[key].label : 'Fill'));
    colorBtn.style.setProperty('--c', tool.color);
    bgBtn.style.setProperty('--c', board.bg);
    sizeDot.style.setProperty('--s', Math.max(3, Math.min(30, tool.size / 2)) + 'px');
    sizeDot.style.setProperty('--c', tool.color);
    custom.value = /^#[0-9a-f]{6}$/i.test(tool.color) ? tool.color : '#000000';
    $$('.tool-pick[data-brush], .tool-pick[data-kind]', root).forEach((b) =>
      b.classList.toggle('sel', b.dataset.brush ? tool.kind === 'brush' && tool.brush === b.dataset.brush : tool.kind === b.dataset.kind));
    $$('.swatch', root).forEach((s) =>
      s.classList.toggle('sel', s.dataset.color === (s.closest('.pop-bg') ? board.bg : tool.color)));
  }

  sizeInput.addEventListener('input', () => {
    tool.size = +sizeInput.value;
    refresh();
  });

  toolBtn.onclick = () => toggle(toolPop);
  colorBtn.onclick = () => toggle(colorPop);
  bgBtn.onclick = () => toggle(bgPop);

  root.replaceChildren(
    h('div.tb-row',
      toolBtn,
      colorBtn,
      h('div.quick-colors', QUICK.map((c) => swatch(c, () => setColor(c)))),
      h('label.tb-size', sizeDot, sizeInput),
      bgBtn,
      h('span.tb-spacer'),
      undoBtn,
      redoBtn,
      h('button.tb-btn.danger', { type: 'button', title: 'Clear the drawing', onclick: () => board.clear() }, icon('trash'), h('span.tb-label', 'Clear')),
    ),
    inline,
    toolPop, colorPop, bgPop,
  );

  // Undo / Redo grey out when there's nothing to take back or bring back
  board.watchHistory((canUndo, canRedo) => {
    undoBtn.disabled = !canUndo;
    redoBtn.disabled = !canRedo;
  });

  document.addEventListener('keydown', (e) => {
    if (!root.isConnected || root.hidden || e.target.matches('input, textarea')) return;
    const key = e.key.toLowerCase();
    // Ctrl+Z undoes; Ctrl+Shift+Z or Ctrl+Y redoes (Cmd instead of Ctrl on a Mac)
    if ((e.ctrlKey || e.metaKey) && (key === 'z' || key === 'y')) {
      e.preventDefault();
      if (key === 'y' || e.shiftKey) board.redo();
      else board.undo();
    }
  });

  refresh();
  return {
    refresh,
    reset() {
      Object.assign(tool, { kind: 'brush', brush: 'pen', color: '#2b2533', size: 8 });
      sizeInput.value = tool.size;
      close();
      refresh();
    },
  };
}
