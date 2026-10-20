// Moves every test needs: opening a room, joining it, changing the setup, and steps that
// tell one game's story in order.
import { test } from 'node:test';

// Steps of one game run in order; after a failing step the rest are skipped, since they would
// only fail for the same reason
export function story() {
  let broken = false;
  return (name, fn) => test(name, async (t) => {
    if (broken) return t.skip('an earlier step failed');
    try {
      await fn(t);
    } catch (e) {
      broken = true;
      throw e;
    }
  });
}

// The host opens a room (?debug lets tests read the game state); resolves with the invite link
export async function createRoom(host, base, avatar) {
  await host.open(`${base}?debug`, avatar);
  await host.eval(`__d.click('Create a room')`);
  await host.waitFor(`document.querySelector('.invite-link')?.title.includes('#room=')`, 30000);
  return host.eval(`document.querySelector('.invite-link').title`);
}

// A guest follows the invite link and joins; resolves with the ms from tapping Join to being in
export async function joinRoom(guest, invite, avatar) {
  const [base, room] = invite.split('#');
  await guest.open(`${base}?debug#${room}`, avatar);
  const t0 = Date.now();
  await guest.eval(`__d.click('Join the room')`);
  await guest.waitFor(`!document.querySelector('#room').hidden && !!__gmm.state()`, 30000);
  return Date.now() - t0;
}

// The host fills in the lobby form like a person would, then waits until the room has the new
// setup. Keys are the engine's setting names: rounds, drawTime, choices, hints, customWords…
export async function setup(host, settings) {
  const want = JSON.stringify(settings);
  await host.eval(`(${fillSetup})(${want})`);
  await host.waitFor(`Object.entries(${want}).every(([k, v]) => __gmm.state().settings[k] === v)`, 10000);
}

// Runs in the host's page
function fillSetup(settings) {
  const labels = { lang: 'Word pack', difficulty: 'Difficulty', rounds: 'Game length', drawTime: 'Drawing time', choices: 'Word choices', hints: 'Letter hints', customWords: 'Custom words' };
  const checks = { closeHints: 'Tell people when a guess is close', customOnly: 'Only use our custom words' };
  for (const [key, value] of Object.entries(settings)) {
    if (checks[key]) {
      const box = [...document.querySelectorAll('#lobby label.check')].find((l) => l.textContent.includes(checks[key])).querySelector('input');
      box.checked = value;
      box.dispatchEvent(new Event('change'));
    } else {
      const field = [...document.querySelectorAll('#lobby label.setting')].find((l) => l.querySelector('span')?.textContent === labels[key]).querySelector('select, textarea');
      field.value = String(value);
      field.dispatchEvent(new Event(field.tagName === 'TEXTAREA' ? 'input' : 'change'));
    }
  }
  return true;
}
