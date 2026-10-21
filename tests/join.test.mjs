// Joining when things aren't perfect: a host who stepped away for a moment (a phone host
// sharing the link from another app), a room that's gone, and two devices that can't connect.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { launch, sleep, PHONE } from './lib/browser.mjs';
import { site } from './lib/server.mjs';
import { createRoom, joinRoom } from './lib/game.mjs';

const game = await site();
const browser = await launch('join');
after(async () => {
  await browser.close();
  await game.close();
});
const errorShown = (text) => `document.querySelector('.home-error')?.textContent.includes(${JSON.stringify(text)})`;

test('a guest who taps the link while the host is away gets in once they’re back', async () => {
  const host = await browser.player('Fredy', PHONE);
  const guest = await browser.player('Ana', PHONE);
  const invite = await createRoom(host, game.url, { c: 1, e: 4, m: 7, h: 2 });
  const [base, room] = invite.split('#');
  await guest.open(`${base}?debug#${room}`, { c: 11, e: 1, m: 1, h: 6 });

  // The host's page goes away, taking the room off the PeerJS server, and the guest taps Join
  await host.eval(`location.href = 'about:blank'; true`);
  await sleep(1000);
  await guest.eval(`__d.click('Join the room')`);
  // Long enough for PeerJS to report the room missing, then the host comes back
  await sleep(6000);
  await host.load(`${base}?debug#${room}`);
  await guest.waitFor(`!document.querySelector('#room').hidden && !!__gmm.state()`, 30000);
  await host.waitFor(`document.querySelectorAll('#players .player').length === 2`, 15000);
});

test('a link to a room that’s gone says so', async () => {
  const guest = await browser.player('Bo', PHONE);
  await guest.open(`${game.url}?debug#room=gone${Date.now()}`, { c: 3, e: 2, m: 3, h: 1 });
  await guest.eval(`__d.click('Join the room')`);
  await guest.waitFor(errorShown('Couldn’t find that room'), 30000);
});

test('when the two devices can’t connect, the guest is told it’s the network', async () => {
  const host = await browser.player('Cy', PHONE);
  const guest = await browser.player('Di', PHONE);
  const invite = await createRoom(host, game.url, { c: 5, e: 3, m: 2, h: 4 });
  const [base, room] = invite.split('#');
  await guest.open(`${base}?debug#${room}`, { c: 7, e: 1, m: 5, h: 3 });
  // No network route at all: the guest's browser may only use a relay, and has none
  await guest.eval(`(() => {
    const RTC = window.RTCPeerConnection;
    window.RTCPeerConnection = function (config) { return new RTC({ ...config, iceServers: [], iceTransportPolicy: 'relay' }); };
    window.RTCPeerConnection.prototype = RTC.prototype;
    return true;
  })()`);
  await guest.eval(`__d.click('Join the room')`);
  await guest.waitFor(errorShown('couldn’t connect'), 30000);
});

// PeerJS logs the missing room itself; anything else would be ours
test('no JavaScript errors on any screen', () => {
  assert.deepEqual(browser.errors.filter((e) => !e.includes('PeerJS:')), []);
});
