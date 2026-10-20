// Plays a scripted 4-player game in light mode and retakes the README screenshots:
// desktop.jpg (a laptop guessing a duck) and mobile.jpg (a phone drawing a sunflower).
// Usage: node tests/screenshots.mjs [folder]   (default docs/screenshots)
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep, DESKTOP, PHONE } from './lib/browser.mjs';
import { site } from './lib/server.mjs';
import { createRoom, joinRoom, setup } from './lib/game.mjs';

const DIR = process.argv[2] ? resolve(process.argv[2]) : fileURLToPath(new URL('../docs/screenshots/', import.meta.url));
mkdirSync(DIR, { recursive: true });
const game = await site();
const browser = await launch('screenshots');

// Chat lines from different players, a little apart like real typing
async function chat(...lines) {
  for (const [p, text] of lines) {
    await p.eval(`__d.say(${JSON.stringify(text)})`);
    await sleep(300);
  }
}

try {
  const fredy = await browser.player('Fredy', DESKTOP);
  const ana = await browser.player('Ana', PHONE);
  const sam = await browser.player('Sam', DESKTOP);
  const lea = await browser.player('Lea', DESKTOP);
  const invite = await createRoom(fredy, game.url, { c: 1, e: 4, m: 7, h: 8 });
  await joinRoom(ana, invite, { c: 11, e: 1, m: 1, h: 6 });
  await joinRoom(sam, invite, { c: 7, e: 6, m: 0, h: 3 });
  await joinRoom(lea, invite, { c: 4, e: 2, m: 4, h: 1 });
  await setup(fredy, { rounds: 1, drawTime: 100, customWords: 'rubber duck, sunflower, robot', customOnly: true });
  await chat([ana, 'hi team!'], [sam, 'ready when you are'], [lea, 'let’s goooo']);

  // Fredy draws a rubber duck while the others guess: Sam's laptop is desktop.jpg
  await fredy.eval(`__d.click('Start the game')`);
  await fredy.waitFor(`__d.pickWord('rubber duck')`);
  await fredy.waitFor(`document.querySelector('.board').classList.contains('drawing')`);
  await fredy.eval(`(() => { const d = __d;
    d.paper('#dbeafe');
    d.color('#fcc419'); d.shape('ellipse', 0.06, 0.07, 0.18, 0.23, true);
    d.brush('pen'); d.color('#f76707'); d.size(6);
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; d.path([[0.12 + Math.cos(a) * 0.085, 0.15 + Math.sin(a) * 0.113], [0.12 + Math.cos(a) * 0.12, 0.15 + Math.sin(a) * 0.16]]); }
    d.brush('rainbow'); d.size(12); d.curve((t) => [0.24 + 0.24 * t, 0.36 - 0.2 * Math.sin(t * Math.PI)], 80);
    d.brush('pen'); d.size(8); d.color('#1c7ed6'); d.curve((t) => [0.03 + 0.94 * t, 0.86 + 0.02 * Math.sin(t * 22)], 140);
    d.color('#1098ad'); d.curve((t) => [0.03 + 0.94 * t, 0.94 + 0.02 * Math.sin(t * 22 + 1.5)], 140);
    d.color('#fcc419'); d.shape('ellipse', 0.28, 0.47, 0.70, 0.81, true);
    d.color('#2b2533'); d.size(7); d.shape('ellipse', 0.28, 0.47, 0.70, 0.81, false);
    d.brush('pen'); d.curve((t) => [0.305 - 0.07 * Math.sin(t * Math.PI), 0.58 - 0.1 * t], 20);
    d.color('#fcc419'); d.shape('ellipse', 0.53, 0.2, 0.725, 0.46, true);
    d.color('#2b2533'); d.shape('ellipse', 0.53, 0.2, 0.725, 0.46, false);
    d.color('#f76707'); d.shape('ellipse', 0.705, 0.31, 0.81, 0.39, true);
    d.color('#2b2533'); d.size(5); d.shape('ellipse', 0.705, 0.31, 0.81, 0.39, false);
    d.brush('pen'); d.path([[0.72, 0.35], [0.8, 0.35]]);
    d.color('#2b2533'); d.shape('ellipse', 0.622, 0.27, 0.652, 0.31, true);
    d.color('#ffffff'); d.shape('ellipse', 0.632, 0.276, 0.642, 0.29, true);
    d.brush('pen'); d.color('#2b2533'); d.size(6); d.curve((t) => [0.4 + 0.2 * t, 0.63 + 0.08 * Math.sin(t * Math.PI)], 40);
    d.brush('neon'); d.color('#e64980'); d.size(5);
    d.curve((t) => { const a = t * Math.PI * 2; return [0.87 + 0.0042 * 16 * Math.sin(a) ** 3, 0.24 - 0.0056 * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a))]; }, 90);
    d.brush('pen'); d.color('#2b2533'); d.size(8);
    document.querySelector('.board .live').dispatchEvent(new PointerEvent('pointerleave'));
    return true; })()`);
  await sleep(700);
  await chat([ana, 'a banana?'], [sam, 'chick'], [lea, 'rubber duck'], [sam, 'rubber duk'], [ana, 'duck??'], [lea, 'so cute']);
  for (const [p, i] of [[ana, 1], [lea, 3], [sam, 0]]) await p.eval(`__d.react(${i})`);
  await sleep(700);
  await sam.shot(join(DIR, 'desktop.jpg'));

  // Ana draws a sunflower on a phone: mobile.jpg
  await fredy.eval(`document.querySelector('button[title="Skip this turn"]').click(); true`);
  await ana.waitFor(`__d.pickWord('sunflower')`, 20000);
  await ana.waitFor(`document.querySelector('#room').classList.contains('drawer-mode')`);
  await sleep(300);
  await ana.eval(`(() => { const d = __d;
    d.paper('#fef9c3');
    d.color('#fcc419'); d.size(4);
    for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; const cx = 0.5 + Math.cos(a) * 0.125, cy = 0.31 + Math.sin(a) * 0.167; d.shape('ellipse', cx - 0.055, cy - 0.073, cx + 0.055, cy + 0.073, true); }
    d.color('#f76707'); d.size(4);
    for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; const cx = 0.5 + Math.cos(a) * 0.125, cy = 0.31 + Math.sin(a) * 0.167; d.shape('ellipse', cx - 0.055, cy - 0.073, cx + 0.055, cy + 0.073, false); }
    d.color('#8d5524'); d.shape('ellipse', 0.41, 0.19, 0.59, 0.43, true);
    d.brush('pen'); d.color('#2f9e44'); d.size(14); d.curve((t) => [0.5 + 0.02 * Math.sin(t * 3), 0.56 + 0.39 * t], 40);
    d.color('#94d82d'); d.size(4); d.shape('ellipse', 0.33, 0.66, 0.49, 0.75, true); d.shape('ellipse', 0.52, 0.75, 0.68, 0.84, true);
    d.color('#2f9e44'); d.size(5); d.shape('ellipse', 0.33, 0.66, 0.49, 0.75, false); d.shape('ellipse', 0.52, 0.75, 0.68, 0.84, false);
    d.brush('spray'); d.color('#5c3d2e'); d.size(10);
    for (const y of [0.25, 0.31, 0.37]) d.curve((t) => [0.44 + 0.12 * t, y + 0.01 * Math.sin(t * 8)], 14);
    d.brush('pen'); d.color('#2b2533'); d.size(5); d.curve((t) => [0.47 + 0.06 * t, 0.36 + 0.03 * Math.sin(t * Math.PI)], 20);
    d.brush('pen');
    return true; })()`);
  await sleep(500);
  await chat([sam, 'a lion??'], [lea, 'sun'], [fredy, 'sunflower'], [sam, 'the sun is happy']);
  await sleep(300);
  await ana.shot(join(DIR, 'mobile.jpg'));
  console.log(`Saved desktop.jpg and mobile.jpg in ${DIR}`);
} catch (e) {
  console.error('FAILED', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  await game.close();
}
