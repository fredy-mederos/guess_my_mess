// Runs inside every player's page (browser.mjs injects it as window.__d) and plays the way a
// person would: pointer events on the board, clicks on the real buttons, typing in the chat.
// It's copied into the page as source, so it can't use anything from outside its own body.
export function driver() {
  const live = () => document.querySelector('.board .live');
  const touch = () => matchMedia('(max-width: 759px)').matches;
  const pointer = (type, x, y) => {
    const r = live().getBoundingClientRect();
    return new PointerEvent(type, {
      clientX: r.left + x * r.width,
      clientY: r.top + y * r.height,
      pointerId: touch() ? 7 : 1,
      pointerType: touch() ? 'touch' : 'mouse',
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
      bubbles: true,
      cancelable: true,
      isPrimary: true,
    });
  };

  // One stroke through points in board coordinates (0..1)
  const path = (pts) => {
    const el = live();
    el.dispatchEvent(pointer('pointerdown', ...pts[0]));
    for (const p of pts.slice(1)) el.dispatchEvent(pointer('pointermove', ...p));
    el.dispatchEvent(pointer('pointerup', ...pts.at(-1)));
  };
  const curve = (fn, n = 60) => path(Array.from({ length: n }, (_, i) => fn(i / (n - 1))));
  const brush = (name) => document.querySelector(`.pop-tools .tool-pick[data-brush="${name}"]`).click();
  const tool = (kind) => document.querySelector(`.pop-tools .tool-pick[data-kind="${kind}"]`).click();
  const color = (c) => document.querySelector(`.pop-colors .swatch[data-color="${c}"]`).click();
  const paper = (c) => document.querySelector(`.pop-bg .swatch[data-color="${c}"]`).click();
  const size = (n) => {
    const range = document.querySelector('.size-range');
    range.value = n;
    range.dispatchEvent(new Event('input'));
  };
  const undo = () => document.querySelector('.tb-row button[title^="Undo"]').click();
  const redo = () => document.querySelector('.tb-row button[title^="Redo"]').click();
  // A Ctrl shortcut from the keyboard; a capital letter means Shift too ('Z' is Ctrl+Shift+Z)
  const ctrl = (key) => document.body.dispatchEvent(new KeyboardEvent('keydown',
    { key, ctrlKey: true, shiftKey: key !== key.toLowerCase(), bubbles: true, cancelable: true }));
  // There are no shape tools: outline with the pen, then the bucket fills it, like a player would
  const shape = (kind, x1, y1, x2, y2, fill) => {
    brush('pen');
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
    path(kind === 'rect'
      ? [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]
      : Array.from({ length: 73 }, (_, i) => [cx + rx * Math.cos((i / 72) * 2 * Math.PI), cy + ry * Math.sin((i / 72) * 2 * Math.PI)]));
    if (fill) {
      tool('fill');
      path([[cx, cy]]);
    }
  };

  // Clicks the visible button whose text includes `text`; false when there's none
  const click = (text) => {
    const b = [...document.querySelectorAll('button')].find((el) => el.textContent.trim().includes(text) && el.offsetParent);
    b?.click();
    return !!b;
  };
  const say = (text) => {
    document.querySelector('#chatInput').value = text;
    document.querySelector('#chatForm').requestSubmit();
  };
  const pickWord = (word) => {
    const b = [...document.querySelectorAll('.word-choices button')].find((el) => el.textContent === word);
    b?.click();
    return !!b;
  };
  const react = (i) => document.querySelectorAll('#reactBar button')[i]?.click();
  // Chat lines on this screen that include `text`
  const chatHas = (text) => [...document.querySelectorAll('#chatLog .msg')].some((m) => m.textContent.includes(text));

  // Sends the right answer; resolves with the ms until this player's "You guessed it" for that
  // word comes back from the host, or -1 after 15 s. Watches for the line itself: the chat keeps
  // only its last 150 lines, so counting lines can miss a reply.
  const timedGuess = (word) => new Promise((resolve) => {
    const t0 = performance.now();
    const finish = (ms) => {
      observer.disconnect();
      clearTimeout(timer);
      resolve(ms);
    };
    const observer = new MutationObserver((records) => {
      const reply = records.some((r) => [...r.addedNodes].some((n) => n.classList?.contains('you') && n.textContent.includes(`“${word}”`)));
      if (reply) finish(Math.round(performance.now() - t0));
    });
    const timer = setTimeout(() => finish(-1), 15000);
    observer.observe(document.querySelector('#chatLog'), { childList: true });
    say(word);
  });
  // Inked pixels on the board, to compare the same drawing across screens
  const inkCount = () => {
    const c = document.querySelector('.board canvas.layer:not(.live)');
    const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i]) n++;
    return n;
  };

  window.__d = { path, curve, brush, tool, color, paper, size, undo, redo, ctrl, shape, click, say, pickWord, react, chatHas, timedGuess, inkCount };
}
