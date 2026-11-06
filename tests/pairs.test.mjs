// Pairs mode for four players, three on laptops and one on a phone: the host picks Pairs, and
// every turn two players draw the same word at once on one board (one of them picks it). Undo
// and redo only touch each drawer's own strokes, both drawers score, nobody can heart the drawing
// they made together, and both artists share the best-drawing award.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep, DESKTOP, PHONE } from './lib/browser.mjs';
import { site } from './lib/server.mjs';
import { story, createRoom, joinRoom, setup } from './lib/game.mjs';

const game = await site();
const browser = await launch('pairs');
after(async () => {
  await browser.close();
  await game.close();
});
const step = story();
let fredy, ana, sam, lea, everyone;
const byId = new Map(); // player id -> their screen
const turns = [];       // { lead, partner, guessers, word } per turn

// Ink on the left and right half of the board: the lead draws on the left, the partner on the right
const HALVES = `[__d.inkCount(0, 0, 0.5, 1), __d.inkCount(0.5, 0, 1, 1)]`;
const halves = () => Promise.all(everyone.map((p) => p.eval(HALVES)));
// Every screen shows the same drawing; resolves with its ink as [left, right]
async function sameEverywhere(what) {
  await sleep(700);
  const ink = await halves();
  assert.ok(ink.every(([l, r]) => l === ink[0][0] && r === ink[0][1]), `${what}: ${everyone.map((p, i) => `${p.name} ${ink[i]}`).join(', ')}`);
  return ink[0];
}

// Who draws now, as screens
async function currentTurn() {
  const s = await fredy.eval('__gmm.state()');
  const lead = byId.get(s.drawer);
  const partner = byId.get(s.partner);
  return { lead, partner, guessers: everyone.filter((p) => p !== lead && p !== partner) };
}

// The lead picks the first word on offer; resolves once both of them can draw
async function pickWord(t) {
  await t.lead.waitFor(`document.querySelectorAll('.word-choices button').length > 0`);
  await t.lead.eval(`document.querySelector('.word-choices button').click(); true`);
  await Promise.all([t.lead, t.partner].map((p) => p.waitFor(`document.querySelector('.board').classList.contains('drawing')`)));
  t.word = await t.lead.eval('__gmm.state().word');
}

// The guessers type the word; resolves with the points everyone got this turn
async function guessIt(t) {
  for (const g of t.guessers) await g.eval(`__d.say(${JSON.stringify(t.word)})`);
  await fredy.waitFor(`__gmm.state().phase === 'reveal'`, 10000);
  const { results } = await fredy.eval('__gmm.state()');
  return (p) => results.pts[[...byId].find(([, s]) => s === p)[0]] || 0;
}

step('four players meet and the host picks Pairs', async () => {
  fredy = await browser.player('Fredy', DESKTOP);
  ana = await browser.player('Ana', PHONE);
  sam = await browser.player('Sam', DESKTOP);
  lea = await browser.player('Lea', DESKTOP);
  everyone = [fredy, ana, sam, lea];
  const invite = await createRoom(fredy, game.url, { c: 1, e: 4, m: 7, h: 8 });
  await joinRoom(ana, invite, { c: 11, e: 1, m: 1, h: 6 });
  await joinRoom(sam, invite, { c: 7, e: 6, m: 0, h: 3 });
  await joinRoom(lea, invite, { c: 4, e: 2, m: 4, h: 1 });
  for (const p of everyone) byId.set(await p.eval('__gmm.state().me'), p);
  await setup(fredy, { mode: 'pairs', rounds: 1, drawTime: 120, customWords: 'rubber duck, sunflower, robot, rocket', customOnly: true });
  await ana.waitFor(`document.querySelector('.mode-pick.sel input')?.value === 'pairs'`, 5000);
  assert.ok(await ana.eval(`[...document.querySelectorAll('.mode-pick input')].every((i) => i.disabled)`), 'only the host picks the mode');
  await fredy.shot('lobby-desktop.jpg');
  await ana.shot('lobby-phone.jpg');
});

step('turn 1: one of the pair picks the word, the other one waits for it', async () => {
  await fredy.eval(`__d.click('Start the game')`);
  await fredy.waitFor(`__gmm.state().phase === 'choosing' && !!__gmm.state().partner`);
  const t = await currentTurn();
  turns.push(t);
  await t.lead.waitFor(`document.querySelectorAll('.word-choices button').length > 0`);
  assert.match(await t.lead.eval(`document.querySelector('.pair-note').textContent`), new RegExp(`${t.partner.name} draws it with you`));
  await t.partner.waitFor(`document.querySelector('#overlay h2')?.textContent === 'You’re drawing with ${t.lead.name}!'`);
  assert.equal(await t.partner.eval(`document.querySelectorAll('.word-choices button').length`), 0, 'only one of them picks');
  await t.guessers[0].waitFor(`document.querySelector('#overlay h2')?.textContent === '${t.lead.name} & ${t.partner.name} are drawing together'`);
  await t.lead.shot('choosing-lead.jpg');
  await t.partner.shot('choosing-partner.jpg');
  await t.guessers[0].shot('choosing-guesser.jpg');
});

step('turn 1: both draw at the same time, and every screen sees both', async () => {
  const t = turns[0];
  await pickWord(t);
  const hint = await t.partner.eval(`document.querySelector('#hint').textContent`);
  assert.equal(hint, `draw this with ${t.lead.name}${t.word}`, 'the partner sees the word too');
  assert.match(await t.guessers[0].eval(`document.querySelector('#hint small').textContent`), /^guess this/);
  // Translucent marker and glowing neon in progress at the same moment, then pen and spray
  await Promise.all([
    t.lead.eval(`(async () => { const d = __d; d.brush('marker'); d.color('#fcc419'); d.size(20);
      await d.slowCurve((x) => [0.08 + 0.3 * x, 0.3 + 0.15 * Math.sin(x * 6)], 50, 15);
      d.brush('pen'); d.color('#2b2533'); d.size(6);
      await d.slowCurve((x) => [0.08 + 0.3 * x, 0.75], 30, 15);
      return true; })()`),
    t.partner.eval(`(async () => { const d = __d; d.brush('neon'); d.color('#e64980'); d.size(8);
      await d.slowCurve((x) => [0.62 + 0.3 * x, 0.3 + 0.15 * Math.cos(x * 6)], 50, 15);
      d.brush('spray'); d.color('#1c7ed6'); d.size(10);
      await d.slowCurve((x) => [0.62 + 0.3 * x, 0.75], 30, 15);
      return true; })()`),
  ]);
  t.ink = await sameEverywhere('both strokes');
  assert.ok(t.ink[0] > 0 && t.ink[1] > 0, `ink left and right: ${t.ink}`);
  await t.guessers[0].shot('drawing-guesser.jpg');
  await t.partner.shot('drawing-partner.jpg');
});

step('turn 1: undo and redo only touch your own strokes, on every screen', async () => {
  const t = turns[0];
  const [left, right] = t.ink;
  // Which of Undo / Redo are greyed out on a drawer's toolbar
  const off = (p) => p.eval(`['Undo', 'Redo'].map((b) => document.querySelector('.tb-row button[title^="' + b + '"]').disabled)`);
  await t.partner.eval(`__d.undo(); true`); // the spray line
  const once = await sameEverywhere('after one undo');
  assert.ok(once[1] > 0 && once[1] < right, `the right half lost its spray: ${once}`);
  assert.equal(once[0], left, 'the lead’s half is untouched');
  await t.partner.eval(`__d.undo(); __d.undo(); __d.undo(); true`); // the neon wave, then nothing left to undo
  assert.deepEqual(await sameEverywhere('after the partner undid everything'), [left, 0], 'only the partner’s strokes are gone');
  assert.deepEqual(await off(t.partner), [true, false], 'the lead’s strokes give the partner nothing to undo');
  await t.lead.eval(`__d.undo(); true`); // the pen line
  const lead = await sameEverywhere('after the lead’s undo');
  assert.ok(lead[0] > 0 && lead[0] < left, `the lead’s marker stays: ${lead}`);
  // Redo brings back the partner's own two strokes (a third has nothing left), not the lead's line
  await t.partner.eval(`__d.redo(); __d.redo(); __d.redo(); true`);
  assert.deepEqual(await sameEverywhere('after the partner’s redos'), [lead[0], right], 'the partner’s strokes are back');
  // A new stroke ends the partner's redos, but not the lead's
  await t.partner.eval(`(async () => { const d = __d; d.brush('rainbow'); d.size(12);
    await d.slowCurve((x) => [0.62 + 0.3 * x, 0.5 + 0.2 * Math.sin(x * 9)], 40, 10); return true; })()`);
  await sameEverywhere('a new stroke from the partner');
  assert.deepEqual(await off(t.partner), [false, true], 'nothing for the partner to redo');
  assert.deepEqual(await off(t.lead), [false, false], 'the lead can still redo');
  await t.lead.eval(`__d.ctrl('Z'); true`); // Ctrl+Shift+Z
  assert.equal((await sameEverywhere('after the lead’s redo'))[0], left, 'the lead’s pen line is back');
});

step('turn 1: the guessers get it and both drawers score', async () => {
  const t = turns[0];
  const pts = await guessIt(t);
  assert.equal(pts(t.lead), 150, 'two guessers, 75 each');
  assert.equal(pts(t.partner), 150, 'the partner earns the same');
  assert.ok(t.guessers.every((g) => pts(g) > 100));
  const pencils = await t.guessers[0].eval(`[...document.querySelectorAll('.gains .who')].filter((w) => w.querySelector('.ic')).map((w) => w.textContent.trim()).sort()`);
  assert.deepEqual(pencils, [t.lead.name, t.partner.name].sort(), 'the reveal marks both drawers');
});

step('turn 2: the other two draw, so everyone drew once this round', async () => {
  await fredy.waitFor(`__gmm.state().phase === 'choosing'`, 10000);
  const t = await currentTurn();
  turns.push(t);
  assert.deepEqual([t.lead, t.partner].map((p) => p.name).sort(), turns[0].guessers.map((p) => p.name).sort());
  await pickWord(t);
  await Promise.all([
    t.lead.eval(`(async () => { const d = __d; d.brush('pen'); d.color('#2f9e44'); d.size(14);
      await d.slowCurve((x) => [0.1 + 0.3 * x, 0.4 + 0.3 * x], 40, 10); return true; })()`),
    t.partner.eval(`(async () => { const d = __d; d.brush('calli'); d.color('#7048e8'); d.size(12);
      await d.slowCurve((x) => [0.6 + 0.3 * x, 0.7 - 0.3 * x], 40, 10); return true; })()`),
  ]);
  await sameEverywhere('turn 2');
  // The phone player drew in one of the two turns: the whole screen is the board
  const phoneTurn = turns.find((x) => x.lead === ana || x.partner === ana);
  if (phoneTurn === t) {
    assert.ok(await ana.eval(`document.querySelector('#room').classList.contains('drawer-mode')`), 'a phone drawer gets the full screen');
    await ana.shot('drawing-phone.jpg');
  }
  const pts = await guessIt(t);
  assert.equal(pts(t.lead), 150);
  assert.equal(pts(t.partner), 150);
});

step('voting: nobody can heart the drawing they made with their partner', async () => {
  await Promise.all(everyone.map((p) => p.waitFor(`!document.querySelector('#vote').hidden && document.querySelectorAll('.vote-card').length === 2`, 20000)));
  await fredy.waitFor(`[...document.querySelectorAll('.vote-card img')].every((i) => i.complete && i.naturalWidth === 1200)`, 8000);
  const captions = await fredy.eval(`[...document.querySelectorAll('.vote-card')].map((c) => [c.querySelector('.by').textContent, c.querySelectorAll('.duo svg').length])`);
  assert.deepEqual(captions, turns.map((t) => [`${t.lead.name} & ${t.partner.name}`, 2]), 'both artists on every drawing');
  for (const p of everyone) {
    const locked = await p.eval(`[...document.querySelectorAll('.vote-card')].filter((c) => c.disabled).map((c) => c.querySelector('.by').textContent)`);
    const mine = turns.find((t) => t.lead === p || t.partner === p);
    assert.deepEqual(locked, [`${mine.lead.name} & ${mine.partner.name}`], `${p.name}: only their own pair's drawing is locked`);
    await p.eval(`document.querySelector('.vote-card:not(:disabled)').click(); true`);
  }
  await fredy.waitFor(`document.querySelector('.vote-status').textContent.includes('0 of 1 heart left')`, 5000);
  await fredy.shot('vote-desktop.jpg');
  await ana.shot('vote-phone.jpg');
  for (const p of everyone) await p.eval(`__d.click('Done voting')`);
});

step('results: both pair drawings tie, all four artists get the award, and any drawing can be saved', async () => {
  await fredy.waitFor(`!document.querySelector('#results').hidden && document.querySelectorAll('.best-pic').length === 2`, 10000);
  const { hall } = await fredy.eval('__gmm.state()');
  assert.deepEqual(hall.map((h) => h.art), [1, 1, 1, 1], 'every artist of a best drawing gets art credit');
  const dir = await lea.allowDownloads();
  const t = turns[0];
  await lea.eval(`[...document.querySelectorAll('#results .gallery-card')][0].querySelector('.save-pic').click(); true`);
  const file = join(dir, `${t.word}-by-${t.lead.name}-${t.partner.name}.png`.replace(/ /g, '-'));
  for (let i = 0; i < 50 && !existsSync(file); i++) await sleep(200);
  const png = readFileSync(file);
  assert.deepEqual([png.toString('latin1', 1, 4), png.readUInt32BE(16), png.readUInt32BE(20)], ['PNG', 1200, 900]);
  await fredy.resize(1280, 2100);
  await fredy.shot('results-desktop.jpg');
  await ana.resize(390, 2000);
  await ana.shot('results-phone.jpg');
});

test('no JavaScript errors on any screen', () => assert.deepEqual(browser.errors, []));
