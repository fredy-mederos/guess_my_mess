// The drawing board. Drawings are lists of "ops" in 0..1 coordinates, so they render the
// same on a phone and a 4K screen. The drawer's ops stream out as they happen; everyone
// else replays them. Undo simply drops the last op and replays the rest.
//
//   stroke: { k: 's',  id, b: brush, c: color, w: width, p: [x, y, x, y, ...] }
//   fill:   { k: 'f',  id, x, y, c }
//   shape:  { k: 'sh', id, s: 'line' | 'rect' | 'ellipse', c, w, f: filled, x1, y1, x2, y2 }
import { seeded } from './util.js';

export const W = 1200;
export const H = 900;

// 'inc' brushes draw piece by piece; 'live' brushes are translucent or glowing, so they're
// redrawn as one path while in progress (no dark blobs where pieces overlap)
export const BRUSHES = {
  pen: { label: 'Pen', mode: 'inc' },
  pencil: { label: 'Pencil', mode: 'inc' },
  marker: { label: 'Marker', mode: 'live' },
  calli: { label: 'Ink nib', mode: 'inc' },
  spray: { label: 'Spray', mode: 'inc' },
  neon: { label: 'Neon', mode: 'live' },
  rainbow: { label: 'Rainbow', mode: 'inc' },
  eraser: { label: 'Eraser', mode: 'inc' },
};
export const SHAPES = ['line', 'rect', 'ellipse'];

const pt = (op, i) => [op.p[2 * i] * W, op.p[2 * i + 1] * H];
const count = (op) => op.p.length >> 1;

function hexToRgb(hex) {
  const n = parseInt(String(hex).replace('#', '').slice(0, 6).padEnd(6, '0'), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function line(ctx, a, b) {
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

function dot(ctx, p, r) {
  ctx.beginPath();
  ctx.arc(p[0], p[1], Math.max(0.5, r), 0, Math.PI * 2);
  ctx.fill();
}

// Draws the part of an 'inc' stroke that ends at point i
function segment(ctx, op, i) {
  const b = pt(op, i);
  const a = i > 0 ? pt(op, i - 1) : b;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ctx.fillStyle = op.c;
  ctx.lineWidth = op.w;
  switch (op.b) {
    case 'eraser':
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = op.w * 2;
      i ? line(ctx, a, b) : dot(ctx, b, op.w);
      break;
    case 'pencil': {
      const rnd = seeded(op.id + i);
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = Math.max(1.4, op.w * 0.4);
      for (let k = 0; k < 3; k++) {
        const j = () => (rnd() - 0.5) * op.w * 0.5;
        line(ctx, [a[0] + j(), a[1] + j()], [b[0] + j(), b[1] + j()]);
      }
      break;
    }
    case 'spray': {
      const rnd = seeded(op.id + i);
      const radius = op.w * 1.8 + 4;
      for (let k = 0, n = 10 + op.w * 2; k < n; k++) {
        const ang = rnd() * Math.PI * 2;
        const r = radius * Math.sqrt(rnd());
        ctx.fillRect(b[0] + Math.cos(ang) * r, b[1] + Math.sin(ang) * r, 1.8, 1.8);
      }
      break;
    }
    case 'calli': {
      // A flat nib held at 45°: thick on one diagonal, hairline on the other
      const dx = Math.cos(-Math.PI / 4) * op.w * 0.8;
      const dy = Math.sin(-Math.PI / 4) * op.w * 0.8;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(a[0] + dx, a[1] + dy);
      ctx.lineTo(b[0] + dx, b[1] + dy);
      ctx.lineTo(b[0] - dx, b[1] - dy);
      ctx.lineTo(a[0] - dx, a[1] - dy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'rainbow': {
      if (i === 0) op._len = 0;
      op._len = (op._len || 0) + Math.hypot(b[0] - a[0], b[1] - a[1]);
      ctx.strokeStyle = ctx.fillStyle = `hsl(${Math.round(op._len * 0.6) % 360}, 90%, 55%)`;
      i ? line(ctx, a, b) : dot(ctx, b, op.w / 2);
      break;
    }
    default: // pen
      i ? line(ctx, a, b) : dot(ctx, b, op.w / 2);
  }
  ctx.restore();
}

// Smooth path through all points (midpoint quadratic curves), used by 'live' brushes
function tracePath(ctx, op) {
  const n = count(op);
  const p0 = pt(op, 0);
  ctx.beginPath();
  ctx.moveTo(p0[0], p0[1]);
  if (n < 3) {
    const p1 = pt(op, n - 1);
    ctx.lineTo(p1[0] + 0.01, p1[1]);
    return;
  }
  for (let i = 1; i < n - 1; i++) {
    const c = pt(op, i);
    const d = pt(op, i + 1);
    ctx.quadraticCurveTo(c[0], c[1], (c[0] + d[0]) / 2, (c[1] + d[1]) / 2);
  }
  const last = pt(op, n - 1);
  ctx.lineTo(last[0], last[1]);
}

function drawLive(ctx, op) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  tracePath(ctx, op);
  if (op.b === 'neon') {
    ctx.shadowColor = op.c;
    ctx.shadowBlur = op.w * 2 + 8;
    ctx.strokeStyle = op.c;
    ctx.lineWidth = op.w;
    ctx.stroke();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = Math.max(1.5, op.w * 0.35);
    ctx.stroke();
  } else { // marker
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = op.c;
    ctx.lineWidth = op.w * 2.2;
    ctx.stroke();
  }
  ctx.restore();
}

function drawShape(ctx, op) {
  const [x1, y1, x2, y2] = [op.x1 * W, op.y1 * H, op.x2 * W, op.y2 * H];
  ctx.save();
  ctx.strokeStyle = ctx.fillStyle = op.c;
  ctx.lineWidth = op.w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (op.s === 'line') {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  } else if (op.s === 'rect') {
    ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
  } else {
    ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
  }
  op.f && op.s !== 'line' ? ctx.fill() : ctx.stroke();
  ctx.restore();
}

// Paint-bucket fill. Anything not clearly inked counts as "paper", so fills slide under
// the soft anti-aliased edges of lines instead of leaving a halo.
function floodFill(ctx, op) {
  const x = Math.floor(op.x * W);
  const y = Math.floor(op.y * H);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const start = (y * W + x) * 4;
  const [tr, tg, tb, ta] = [d[start], d[start + 1], d[start + 2], d[start + 3]];
  const [r, g, b] = hexToRgb(op.c);
  if (ta >= 128 && Math.abs(tr - r) + Math.abs(tg - g) + Math.abs(tb - b) < 6) return;
  const match = (i) => (ta < 128
    ? d[i + 3] < 128
    : d[i + 3] >= 128 && Math.abs(d[i] - tr) + Math.abs(d[i + 1] - tg) + Math.abs(d[i + 2] - tb) < 100);

  const filled = new Uint8Array(W * H);
  const stack = new Int32Array(W * H);
  let top = 0;
  stack[top++] = y * W + x;
  filled[y * W + x] = 1;
  while (top) {
    const p = stack[--top];
    const px = p % W;
    const around = [px > 0 ? p - 1 : -1, px < W - 1 ? p + 1 : -1, p - W, p + W];
    for (const q of around) {
      if (q < 0 || q >= W * H || filled[q] || !match(q * 4)) continue;
      filled[q] = 1;
      stack[top++] = q;
    }
  }
  // Grow the fill by one pixel to tuck it under the edge of the outline
  const grown = filled.slice();
  for (let p = 0; p < W * H; p++) {
    if (!filled[p]) continue;
    const px = p % W;
    if (px > 0) grown[p - 1] = 1;
    if (px < W - 1) grown[p + 1] = 1;
    if (p >= W) grown[p - W] = 1;
    if (p < W * (H - 1)) grown[p + W] = 1;
  }
  for (let p = 0; p < W * H; p++) {
    if (!grown[p]) continue;
    const i = p * 4;
    d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function renderOp(ctx, op) {
  if (op.k === 's') {
    if (!op.p?.length) return;
    if (BRUSHES[op.b]?.mode === 'live') return drawLive(ctx, op);
    for (let i = 0; i < count(op); i++) segment(ctx, op, i);
  } else if (op.k === 'f') {
    floodFill(ctx, op);
  } else if (op.k === 'sh') {
    drawShape(ctx, op);
  } else if (op.k === 'c') {
    ctx.clearRect(0, 0, W, H); // "clear" is an op too, so it can be undone
  }
}

export function createBoard(root, { onEmit }) {
  const main = document.createElement('canvas');
  const live = document.createElement('canvas');
  const cursor = document.createElement('div');
  main.className = 'layer';
  live.className = 'layer live';
  cursor.className = 'brush-cursor';
  cursor.hidden = true;
  for (const c of [main, live]) { c.width = W; c.height = H; }
  root.append(main, live, cursor);
  const ctx = main.getContext('2d', { willReadFrequently: true });
  const lctx = live.getContext('2d');

  let ops = [];
  let bg = '#ffffff';
  let liveOp = null;       // translucent stroke currently being drawn (by anyone)
  let liveFrame = 0;
  let interactive = false;
  const tool = { kind: 'brush', brush: 'pen', color: '#2b2533', size: 8, filled: false };

  // ---------- rendering ----------
  function setBg(c) {
    bg = c;
    root.style.setProperty('--board-bg', c);
  }

  function replay() {
    ctx.clearRect(0, 0, W, H);
    for (const op of ops) renderOp(ctx, op);
  }

  function redrawLive() {
    if (liveFrame) return;
    liveFrame = requestAnimationFrame(() => {
      liveFrame = 0;
      lctx.clearRect(0, 0, W, H);
      if (liveOp) drawLive(lctx, liveOp);
    });
  }

  function commitLive(op) {
    if (liveOp === op) liveOp = null;
    lctx.clearRect(0, 0, W, H);
    drawLive(ctx, op);
  }

  // ---------- remote ops ----------
  function apply(msg) {
    const find = (id) => ops.findLast((o) => o.id === id);
    switch (msg.a) {
      case 'begin': {
        const op = { ...msg.op, p: [...msg.op.p] };
        ops.push(op);
        if (BRUSHES[op.b]?.mode === 'live') { liveOp = op; redrawLive(); } else renderOp(ctx, op);
        break;
      }
      case 'pts': {
        const op = find(msg.id);
        if (!op) return;
        const from = count(op);
        op.p.push(...msg.p);
        if (BRUSHES[op.b]?.mode === 'live') { if (op === liveOp) redrawLive(); } else for (let i = from; i < count(op); i++) segment(ctx, op, i);
        break;
      }
      case 'end': {
        const op = find(msg.id);
        if (op && op === liveOp) commitLive(op);
        break;
      }
      case 'op': ops.push(msg.op); renderOp(ctx, msg.op); break;
      case 'ops': for (const op of msg.ops) { ops.push(op); renderOp(ctx, op); } break;
      case 'undo': ops.pop(); liveOp = null; lctx.clearRect(0, 0, W, H); replay(); break;
      case 'clear': ops = []; replay(); break;
      case 'bg': setBg(msg.c); break;
    }
  }

  function reset(newBg = '#ffffff') {
    ops = [];
    liveOp = null;
    lctx.clearRect(0, 0, W, H);
    ctx.clearRect(0, 0, W, H);
    setBg(newBg);
  }

  // ---------- local drawing ----------
  let current = null;      // stroke in progress
  let pending = [];        // its points not yet sent
  let shapeStart = null;
  let opSeq = 0;
  const newId = () => Date.now().toString(36) + (opSeq++).toString(36);

  function toNorm(e) {
    const r = live.getBoundingClientRect();
    const q = (v) => Math.round(v * 10000) / 10000;
    return [q((e.clientX - r.left) / r.width), q((e.clientY - r.top) / r.height)];
  }

  function flush() {
    if (!current || !pending.length) return;
    onEmit({ a: 'pts', id: current.id, p: pending });
    pending = [];
  }
  setInterval(flush, 40);

  function shapeOp(end) {
    return { k: 'sh', id: newId(), s: tool.kind, c: tool.color, w: tool.size, f: tool.filled,
      x1: shapeStart[0], y1: shapeStart[1], x2: end[0], y2: end[1] };
  }

  live.addEventListener('pointerdown', (e) => {
    if (!interactive || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    try { live.setPointerCapture(e.pointerId); } catch {} // keeps the stroke going if the finger leaves the board
    const p = toNorm(e);
    if (tool.kind === 'fill') {
      const op = { k: 'f', id: newId(), x: p[0], y: p[1], c: tool.color };
      ops.push(op);
      renderOp(ctx, op);
      return onEmit({ a: 'op', op });
    }
    if (SHAPES.includes(tool.kind)) {
      shapeStart = p;
      return;
    }
    current = { k: 's', id: newId(), b: tool.brush, c: tool.color, w: tool.size, p: [...p] };
    ops.push(current);
    pending = [];
    if (BRUSHES[current.b].mode === 'live') { liveOp = current; redrawLive(); } else segment(ctx, current, 0);
    onEmit({ a: 'begin', op: { ...current, p: [...current.p] } });
  });

  live.addEventListener('pointermove', (e) => {
    moveCursor(e);
    if (!interactive) return;
    if (shapeStart) {
      lctx.clearRect(0, 0, W, H);
      drawShape(lctx, shapeOp(toNorm(e)));
      return;
    }
    if (!current) return;
    const events = e.getCoalescedEvents?.() || [e];
    for (const ev of events.length ? events : [e]) {
      const p = toNorm(ev);
      current.p.push(...p);
      pending.push(...p);
      if (BRUSHES[current.b].mode === 'inc') segment(ctx, current, count(current) - 1);
    }
    if (BRUSHES[current.b].mode === 'live') redrawLive();
  });

  function finish(e) {
    if (shapeStart) {
      const op = shapeOp(toNorm(e));
      shapeStart = null;
      lctx.clearRect(0, 0, W, H);
      ops.push(op);
      renderOp(ctx, op);
      onEmit({ a: 'op', op });
    }
    if (!current) return;
    flush();
    onEmit({ a: 'end', id: current.id });
    if (BRUSHES[current.b].mode === 'live') commitLive(current);
    current = null;
  }
  live.addEventListener('pointerup', finish);
  live.addEventListener('pointercancel', finish);

  // Brush-size ring that follows the mouse (desktop only)
  function moveCursor(e) {
    const show = interactive && e.pointerType === 'mouse' && tool.kind !== 'fill';
    cursor.hidden = !show;
    if (!show) return;
    const r = live.getBoundingClientRect();
    const scale = r.width / W;
    const brushW = tool.kind === 'brush'
      ? tool.size * ({ eraser: 2, marker: 2.2, spray: 3.6 }[tool.brush] || 1)
      : tool.size;
    const size = Math.max(4, brushW * scale);
    Object.assign(cursor.style, {
      width: size + 'px', height: size + 'px',
      transform: `translate(${e.clientX - r.left - size / 2}px, ${e.clientY - r.top - size / 2}px)`,
    });
  }
  live.addEventListener('pointerleave', () => { cursor.hidden = true; });

  return {
    tool,
    apply,
    reset,
    get bg() { return bg; },
    setInteractive(on) {
      interactive = on;
      root.classList.toggle('drawing', on);
      if (!on) { current = null; shapeStart = null; cursor.hidden = true; }
    },
    undo() {
      if (!ops.length) return;
      ops.pop();
      replay();
      onEmit({ a: 'undo' });
    },
    clear() {
      const op = { k: 'c', id: newId() };
      ops.push(op);
      renderOp(ctx, op);
      onEmit({ a: 'op', op });
    },
    setBackground(c) {
      setBg(c);
      onEmit({ a: 'bg', c });
    },
    snapshot() {
      // Flatten background + drawing into one image (for "save drawing")
      const out = document.createElement('canvas');
      out.width = W;
      out.height = H;
      const o = out.getContext('2d');
      o.fillStyle = bg;
      o.fillRect(0, 0, W, H);
      o.drawImage(main, 0, 0);
      return out.toDataURL('image/png');
    },
  };
}
