// The phone layout while playing: the guess box stays above the keyboard, the scores on the
// reveal card line up, and a phone drawer gets the whole width with chat and players tucked away.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { launch, sleep, DESKTOP, PHONE } from './lib/browser.mjs';
import { site } from './lib/server.mjs';
import { story, createRoom, joinRoom, setup } from './lib/game.mjs';

const game = await site();
const browser = await launch('phone');
after(async () => {
  await browser.close();
  await game.close();
});
const step = story();
let fredy, ana;

step('a laptop host, a phone and a long name meet in a room', async () => {
  fredy = await browser.player('Fredy', DESKTOP);
  ana = await browser.player('Ana', { ...PHONE, height: 700 });
  const sam = await browser.player('Samantha Longname', DESKTOP);
  const invite = await createRoom(fredy, game.url, { c: 1, e: 4, m: 7, h: 2 });
  await joinRoom(ana, invite, { c: 11, e: 1, m: 1, h: 6 });
  await joinRoom(sam, invite, { c: 7, e: 6, m: 0, h: 3 });
  await setup(fredy, { customWords: 'book, rubber duck, stand-up', customOnly: true });
  await fredy.eval(`__d.click('Start the game')`);
  await fredy.waitFor(`__d.pickWord('book')`);
  await ana.waitFor(`!!document.querySelector('#hint .slots')`);
});

step('the guess box stays above the phone keyboard', async () => {
  await ana.eval(`document.querySelector('#chatInput').focus(); true`);
  await ana.resize(390, 380); // the keyboard takes the bottom of the screen
  await ana.waitFor(`document.querySelector('#room').classList.contains('kb-open')`, 3000);
  const kb = await ana.eval(`(() => { const r = (s) => document.querySelector(s).getBoundingClientRect();
    return { top: r('#chatInput').top, bottom: r('#chatInput').bottom, board: r('#boardWrap').bottom, screen: innerHeight }; })()`);
  await ana.shot('keyboard-open.jpg');
  assert.ok(kb.top >= 0 && kb.bottom <= kb.screen, `guess box at ${kb.top}-${kb.bottom}px on a ${kb.screen}px screen`);
  assert.ok(kb.board <= kb.top, `the board (ends at ${kb.board}px) covers the guess box (starts at ${kb.top}px)`);
  await ana.eval(`document.querySelector('#chatInput').blur(); true`);
  await ana.resize(390, 700);
  await ana.waitFor(`!document.querySelector('#room').classList.contains('kb-open')`, 3000);
});

step('the scores on the reveal card line up', async () => {
  await fredy.eval(`document.querySelector('button[title="Skip this turn"]').click(); true`);
  await ana.waitFor(`!!document.querySelector('.gains .plus')`, 8000);
  await sleep(500); // let the card settle
  const rights = await ana.eval(`[...document.querySelectorAll('.gains .plus')].map((e) => Math.round(e.getBoundingClientRect().right))`);
  await ana.shot('reveal.jpg');
  assert.equal(new Set(rights).size, 1, `score columns end at ${rights.join(', ')}px`);
});

step('a phone drawer gets the full width, with chat and players tucked away', async () => {
  await ana.waitFor(`__d.pickWord('rubber duck') || __d.pickWord('stand-up')`, 20000);
  await ana.waitFor(`document.querySelector('#room').classList.contains('drawer-mode')`);
  await sleep(500);
  const m = await ana.eval(`(() => { const r = (s) => document.querySelector(s).getBoundingClientRect();
    const shown = (s) => getComputedStyle(document.querySelector(s)).display !== 'none';
    return { screen: innerWidth, height: innerHeight, stage: r('#stage').width, board: r('#boardWrap').width,
      colors: r('.tb-inline-colors').right, toolbar: r('#toolbar').bottom, chat: shown('#chat'), players: shown('#players') }; })()`);
  await ana.shot('drawer.jpg');
  assert.ok(m.board >= m.stage - 2, `board ${m.board}px wide on a ${m.stage}px stage`);
  assert.ok(m.colors <= m.screen, `colors run to ${m.colors}px on a ${m.screen}px screen`);
  assert.ok(m.toolbar <= m.height, `toolbar ends at ${m.toolbar}px on a ${m.height}px screen`);
  assert.ok(!m.chat && !m.players, 'chat and players should be hidden while drawing');
});

test('no JavaScript errors on any screen', () => assert.deepEqual(browser.errors, []));
