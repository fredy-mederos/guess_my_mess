// Letter hints: guessers see one blank per letter, grouped by word and inside the screen, and
// letters show up in their right places as the turn goes on, on a phone and on a laptop.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { launch, DESKTOP, PHONE } from './lib/browser.mjs';
import { site } from './lib/server.mjs';
import { story, createRoom, joinRoom, setup } from './lib/game.mjs';

const PHRASE = 'buscar una aguja en un pajar';
const game = await site();
const browser = await launch('hints');
after(async () => {
  await browser.close();
  await game.close();
});
const step = story();
let fredy, ana, sam;

// What a guesser's hint shows: each word as letters and _ for blanks, and where it sits
const hint = `(() => {
  const words = [...document.querySelectorAll('#hint .slot-word')];
  const box = (w) => w.getBoundingClientRect();
  return {
    label: document.querySelector('#hint small').textContent,
    words: words.map((w) => [...w.children].map((c) => (c.classList.contains('shown') ? c.textContent : '_')).join('')),
    left: Math.min(...words.map((w) => box(w).left)),
    right: Math.max(...words.map((w) => box(w).right)),
    screen: innerWidth,
  };
})()`;

step('a host and two guessers, one on a phone', async () => {
  fredy = await browser.player('Fredy', DESKTOP);
  ana = await browser.player('Ana', PHONE);
  sam = await browser.player('Sam', DESKTOP);
  const invite = await createRoom(fredy, game.url, { c: 1, e: 4, m: 7, h: 2 });
  await joinRoom(ana, invite, { c: 11, e: 1, m: 1, h: 6 });
  await joinRoom(sam, invite, { c: 7, e: 6, m: 0, h: 3 });
});

step('the host draws a six-word phrase, with lots of hints', async () => {
  await setup(fredy, { rounds: 1, drawTime: 30, choices: 1, hints: 2, customWords: PHRASE, customOnly: true });
  await fredy.eval(`__d.click('Start the game')`);
  await fredy.waitFor(`__d.pickWord(${JSON.stringify(PHRASE)})`);
  await fredy.waitFor(`document.querySelector('#hint .known')?.textContent === ${JSON.stringify(PHRASE)}`);
});

step('guessers see one blank per letter, grouped by word, inside the screen', async () => {
  for (const p of [ana, sam]) {
    await p.waitFor(`!!document.querySelector('#hint .slots')`, 8000);
    const h = await p.eval(hint);
    assert.equal(h.label, 'guess this · 23 letters', p.name);
    assert.deepEqual(h.words.map((w) => w.length), [6, 3, 5, 2, 2, 5], p.name);
    assert.ok(h.left >= 0 && h.right <= h.screen, `${p.name}: blanks from ${h.left} to ${h.right}px on a ${h.screen}px screen`);
  }
  await ana.shot('hint-phone-start.jpg');
});

step('letters show up in their places as the turn goes on', async () => {
  await ana.waitFor(`document.querySelectorAll('#hint .slot.shown').length >= 2`, 25000);
  const { words } = await ana.eval(hint);
  PHRASE.split(' ').forEach((word, i) => [...words[i]].forEach((ch, j) => {
    if (ch !== '_') assert.equal(ch, word[j], `letter ${j + 1} of "${word}"`);
  }));
  await ana.shot('hint-phone.jpg');
  await sam.shot('hint-desktop.jpg');
});

test('no JavaScript errors on any screen', () => assert.deepEqual(browser.errors, []));
