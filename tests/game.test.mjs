// A whole game for three players, two on laptops and one on a phone: a character change
// mid-room, three turns of drawing and guessing, the best-drawing vote and the results.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { launch, sleep, DESKTOP, PHONE } from './lib/browser.mjs';
import { site } from './lib/server.mjs';
import { story, createRoom, joinRoom, setup } from './lib/game.mjs';

const game = await site();
const browser = await launch('game');
after(async () => {
  await browser.close();
  await game.close();
});
const step = story();
let fredy, ana, sam;

// Chat lines from different players, a little apart like real typing
async function chat(...lines) {
  for (const [p, text] of lines) {
    await p.eval(`__d.say(${JSON.stringify(text)})`);
    await sleep(200);
  }
}

step('three players meet in a room', async () => {
  fredy = await browser.player('Fredy', DESKTOP);
  ana = await browser.player('Ana', PHONE);
  sam = await browser.player('Sam', DESKTOP);
  const invite = await createRoom(fredy, game.url, { c: 1, e: 4, m: 7, h: 8 });
  await joinRoom(ana, invite, { c: 11, e: 1, m: 1, h: 6 });
  await joinRoom(sam, invite, { c: 7, e: 6, m: 0, h: 3 });
  await fredy.waitFor(`document.querySelectorAll('#players .player').length === 3`);
});

step('a player changes name and doodle mid-room', async () => {
  await sam.eval(`document.querySelector('#meBtn').click(); true`);
  await sam.waitFor(`!!document.querySelector('.modal')`);
  await sam.shot('edit-character.jpg');
  await sam.eval(`(() => {
    document.querySelector('.modal input').value = 'Samuel';
    document.querySelector('.modal .arrow.dice').click();
    [...document.querySelectorAll('.modal button')].find((b) => b.textContent.includes('Save')).click();
    return true; })()`);
  await fredy.waitFor(`[...document.querySelectorAll('#players .name')].some((n) => n.textContent === 'Samuel')`, 5000);
  await fredy.waitFor(`__d.chatHas('Sam is now Samuel')`, 5000);
});

step('the host sets up one round with three team words', () =>
  setup(fredy, { rounds: 1, drawTime: 60, customWords: 'rubber duck, sunflower, robot', customOnly: true }));

step('turn 1: Fredy draws a rubber duck on a laptop, undoing a few lines', async () => {
  await fredy.eval(`__d.click('Start the game')`);
  await fredy.waitFor(`__d.pickWord('rubber duck')`);
  await fredy.waitFor(`document.querySelector('.board').classList.contains('drawing')`);
  await fredy.eval(`(() => { const d = __d;
    d.paper('#dbeafe');
    d.color('#fcc419'); d.shape('ellipse', 0.28, 0.47, 0.70, 0.81, true);
    d.color('#2b2533'); d.size(7); d.shape('ellipse', 0.28, 0.47, 0.70, 0.81, false);
    d.color('#fcc419'); d.shape('ellipse', 0.53, 0.2, 0.725, 0.46, true);
    d.color('#2b2533'); d.shape('ellipse', 0.53, 0.2, 0.725, 0.46, false);
    d.brush('pen'); d.path([[0.1, 0.1], [0.2, 0.2]]); d.path([[0.1, 0.2], [0.2, 0.1]]); d.path([[0.15, 0.1], [0.15, 0.2]]);
    d.undo(); d.undo(); d.undo();
    d.color('#f76707'); d.shape('ellipse', 0.705, 0.31, 0.81, 0.39, true);
    d.color('#2b2533'); d.shape('ellipse', 0.622, 0.27, 0.652, 0.31, true);
    d.brush('pen'); d.color('#1c7ed6'); d.size(8); d.curve((t) => [0.03 + 0.94 * t, 0.88 + 0.02 * Math.sin(t * 22)], 100);
    return true; })()`);
  await chat([ana, 'banana?'], [sam, 'rubbr duck']);
  await sam.waitFor(`__d.chatHas('is really close')`, 5000);
  assert.ok(!(await fredy.eval(`__d.chatHas('is really close')`)), 'only the guesser hears they were close');
  await chat([ana, 'rubber duck']);
  await sam.waitFor(`__d.chatHas('Ana guessed the word!')`, 5000);
  assert.ok(!(await sam.eval(`__d.chatHas('rubber duck')`)), 'the right answer showed up in the chat');
  await chat([sam, 'rubber duck']);
  await sam.waitFor(`__d.chatHas('You guessed it: “rubber duck”')`, 5000);
});

step('turn 2: Ana draws a sunflower on a phone, the board taking the whole screen', async () => {
  await ana.waitFor(`__d.pickWord('sunflower')`, 20000);
  await ana.waitFor(`document.querySelector('#room').classList.contains('drawer-mode')`);
  await ana.eval(`(() => { const d = __d;
    d.paper('#fef9c3');
    d.brush('pen'); d.color('#2f9e44'); d.size(14); d.curve((t) => [0.5, 0.45 + 0.5 * t], 30);
    d.color('#fcc419');
    for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5; const cx = 0.5 + Math.cos(a) * 0.125, cy = 0.31 + Math.sin(a) * 0.167; d.shape('ellipse', cx - 0.055, cy - 0.073, cx + 0.055, cy + 0.073, true); }
    d.color('#8d5524'); d.shape('ellipse', 0.41, 0.19, 0.59, 0.43, true);
    d.color('#94d82d'); d.shape('ellipse', 0.33, 0.66, 0.49, 0.75, true);
    return true; })()`);
  await chat([sam, 'sun'], [sam, 'lion'], [sam, 'sunflowr'], [fredy, 'sunflower'], [sam, 'sunflower']);
  await sam.waitFor(`__d.chatHas('You guessed it: “sunflower”')`, 5000);
});

step('turn 3: Samuel draws a robot in two lines', async () => {
  await sam.waitFor(`__d.pickWord('robot')`, 20000);
  await sam.waitFor(`document.querySelector('.board').classList.contains('drawing')`);
  await sam.eval(`(() => { const d = __d; d.brush('pen'); d.size(10);
    d.color('#868e96'); d.shape('rect', 0.35, 0.3, 0.65, 0.75, true);
    d.color('#2b2533'); d.shape('rect', 0.42, 0.12, 0.58, 0.3, false);
    return true; })()`);
  await chat([fredy, 'box?'], [fredy, 'robot'], [ana, 'robot']);
  await ana.waitFor(`__d.chatHas('You guessed it: “robot”')`, 5000);
});

step('voting: drawings are redrawn from strokes, one heart per round, never for your own', async () => {
  const gallery = `!document.querySelector('#vote').hidden && document.querySelectorAll('.vote-card').length === 3`;
  await Promise.all([fredy, ana, sam].map((p) => p.waitFor(gallery, 20000)));
  await ana.waitFor(`[...document.querySelectorAll('.vote-card img')].every((i) => i.src.startsWith('blob:') && i.complete && i.naturalWidth === 1200)`, 8000);
  const locked = await ana.eval(`[...document.querySelectorAll('.vote-card')].filter((c) => c.disabled).map((c) => c.querySelector('.word').textContent)`);
  assert.deepEqual(locked, ['“sunflower”'], 'only your own drawing is locked');
  const vote = (p, word) => p.eval(`[...document.querySelectorAll('.vote-card')].find((c) => c.querySelector('.word').textContent === '“${word}”').click(); true`);
  await vote(fredy, 'sunflower');
  await vote(ana, 'rubber duck');
  await vote(sam, 'sunflower');
  await sleep(300);
  await vote(sam, 'rubber duck'); // with one heart, a second tap moves it
  await sam.waitFor(`[...document.querySelectorAll('.vote-card.voted .word')].map((w) => w.textContent).join() === '“rubber duck”'`, 5000);
  assert.match(await sam.eval(`document.querySelector('.vote-status').textContent`), /0 of 1 heart left/);
  await sam.shot('vote-desktop.jpg');
  await ana.shot('vote-phone.jpg');
});

step('results: points podium, best drawing and fun stats', async (t) => {
  for (const p of [fredy, ana, sam]) await p.eval(`__d.click('Done voting')`);
  await fredy.waitFor(`!document.querySelector('#results').hidden && !!document.querySelector('.best-pic')`, 10000);
  const best = await fredy.eval(`[...document.querySelectorAll('.best-pic .word')].map((w) => w.textContent)`);
  assert.deepEqual(best, ['“rubber duck”'], 'the duck has 2 hearts, the sunflower 1');
  const { final, stats } = await fredy.eval(`__gmm.state()`);
  t.diagnostic(`podium: ${final.map((p) => `${p.name} ${p.score}`).join(', ')}`);
  for (const s of stats) t.diagnostic(`${s.title}: ${s.who}, ${s.detail}`);
  assert.deepEqual(final.map((p) => p.score), final.map((p) => p.score).sort((a, b) => b - a), 'podium in points order');
  const stat = (title) => stats.find((s) => s.title === title) || {};
  assert.equal(stat('Minimalist').who, 'Samuel', 'the 2-line robot is the minimalist drawing');
  assert.equal(stat('Second thoughts').who, 'Fredy', 'Fredy undid 3 lines');
  await fredy.resize(1280, 2100);
  await fredy.shot('results-desktop.jpg');
  await ana.resize(390, 1900);
  await ana.shot('results-phone.jpg');
});

step('back in the lobby, the hall of fame counts the game', async () => {
  await fredy.eval(`__d.click('Change setup')`);
  await fredy.waitFor(`!document.querySelector('#lobby').hidden`);
  await ana.waitFor(`!document.querySelector('#lobby').hidden`);
  await fredy.resize(1280, 800);
  await ana.resize(390, 844);
  const hall = await fredy.eval(`[...document.querySelectorAll('.hall tbody tr')].map((r) => r.innerText.replace(/\\s+/g, ' ').trim())`);
  assert.equal(hall.length, 3, hall.join(' | '));
  await fredy.shot('lobby-desktop.jpg');
  await ana.shot('lobby-phone.jpg');
});

test('no JavaScript errors on any screen', () => assert.deepEqual(browser.errors, []));
