// Quick check that the game works end to end: the home page, two players meeting in a room over
// WebRTC, and the game starting on both screens. After a release, point BASE_URL at the live site.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { launch, DESKTOP, PHONE } from './lib/browser.mjs';
import { site } from './lib/server.mjs';
import { story, createRoom, joinRoom } from './lib/game.mjs';

const game = await site();
const browser = await launch('smoke');
after(async () => {
  await browser.close();
  await game.close();
});
const step = story();
let host, guest;

step('the home page loads, with the link for reporting issues', async () => {
  host = await browser.player('Fredy', DESKTOP);
  guest = await browser.player('Ana', PHONE);
  await guest.load(game.url);
  const link = await guest.eval(`(() => { const a = document.querySelector('#home .issue-link'); return a && { href: a.href, target: a.target }; })()`);
  assert.deepEqual(link, { href: 'https://github.com/fredy-mederos/guess_my_mess/issues', target: '_blank' });
});

step('a phone joins a laptop host over WebRTC', async () => {
  const invite = await createRoom(host, game.url, { c: 1, e: 4, m: 7, h: 2 });
  await joinRoom(guest, invite, { c: 11, e: 1, m: 1, h: 6 });
  await host.waitFor(`document.querySelectorAll('#players .player').length === 2`, 30000);
});

step('the game starts on both screens', async () => {
  await host.eval(`__d.click('Start the game')`);
  await host.waitFor(`document.querySelectorAll('.word-choices button').length > 0`, 20000);
  await guest.waitFor(`!document.querySelector('#play').hidden`, 20000);
});

test('no JavaScript errors on any screen', () => assert.deepEqual(browser.errors, []));
