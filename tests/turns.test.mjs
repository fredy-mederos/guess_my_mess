// The game engine on its own, in plain Node with a fake clock (no browser needed): who draws
// when in pairs mode, and the pairs rules for strokes, points and hearts.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../js/engine.js';

const REVEAL_MS = 6000; // see js/engine.js
const GRACE_MS = 8000;

const fakeClock = () => mock.timers.enable({ apis: ['setInterval', 'Date'], now: 1_000_000 });

// A room on a fake clock: the host is the first player. Cleaned up when the test ends.
function room(t, names, settings) {
  fakeClock();
  const r = openRoom(names, settings);
  t.after(() => {
    r.engine.destroy();
    mock.timers.reset();
  });
  return r;
}

// A room, on whatever clock the test set up
function openRoom(names, settings) {
  const inbox = new Map(names.map((id) => [id, []]));
  const engine = createEngine({ hostId: names[0], sendTo: (id, msg) => inbox.get(id)?.push(msg), kick() {} });
  for (const id of names) engine.handle(id, { t: 'hello', name: id });
  engine.handle(names[0], { t: 'settings', settings: { rounds: 3, ...settings } });
  const S = engine.snapshot();
  return {
    S,
    engine,
    inbox,
    say: (id, msg) => engine.handle(id, msg),
    tick: (ms) => mock.timers.tick(ms),
    // The latest state a player was sent (states go out on the next microtask)
    async view(id) {
      await Promise.resolve();
      return inbox.get(id).findLast((m) => m.t === 'state');
    },
    // Skips the current turn (as the host) and moves on to the next one
    next() {
      engine.handle(names[0], { t: 'skip' });
      mock.timers.tick(REVEAL_MS + 300);
    },
  };
}

// Plays a whole game of skipped turns; resolves with the turns as [round, drawer, partner]
function playThrough(r) {
  const turns = [];
  r.say(r.S.players[0].id, { t: 'start' });
  while (['choosing', 'drawing'].includes(r.S.phase)) {
    turns.push([r.S.round, r.S.drawer, r.S.partner]);
    r.next();
  }
  return turns;
}

const pairOf = ([, a, b]) => [a, b].sort().join('+');

test('pairs: four players draw once per round, with a new partner every round', (t) => {
  const r = room(t, ['ana', 'ben', 'cy', 'dee'], { mode: 'pairs', rounds: 3 });
  const turns = playThrough(r);
  assert.equal(turns.length, 6, 'two turns per round');
  for (const round of [1, 2, 3]) {
    const drew = turns.filter((t) => t[0] === round).flatMap((t) => [t[1], t[2]]);
    assert.deepEqual(drew.sort(), ['ana', 'ben', 'cy', 'dee'], `round ${round}: everyone draws once`);
  }
  const pairs = turns.map(pairOf);
  assert.equal(new Set(pairs).size, 6, `no pair twice: ${pairs.join(', ')}`);
  // Six words for four players: nobody picks twice before everyone picked once
  const picks = Object.values(Object.groupBy(turns, (t) => t[1])).map((list) => list.length);
  assert.equal(picks.length, 4, 'everyone picks a word');
  assert.ok(Math.max(...picks) - Math.min(...picks) <= 1, `words picked per player: ${picks}`);
});

test('pairs: nobody draws with the same partner twice while there is someone new to draw with', (t) => {
  fakeClock();
  t.after(() => mock.timers.reset());
  // Six players over five rounds is every possible pair exactly once. Picking one partner per
  // turn used to leave the last two of a round together again in most of these games.
  const names = ['ana', 'ben', 'cy', 'dee', 'eve', 'fay', 'gus', 'hal'];
  for (const [players, rounds, games] of [[6, 5, 30], [8, 5, 15], [5, 3, 15], [7, 3, 15]]) {
    const everyone = names.slice(0, players);
    for (let game = 0; game < games; game++) {
      const r = openRoom(everyone, { mode: 'pairs', rounds });
      const turns = playThrough(r);
      r.engine.destroy();
      const pairs = turns.map(pairOf);
      assert.equal(new Set(pairs).size, pairs.length, `${players} players, ${rounds} rounds: ${pairs.join(', ')}`);
      for (let round = 1; round <= rounds; round++) {
        const drew = turns.filter((t) => t[0] === round).flatMap((t) => [t[1], t[2]]);
        assert.deepEqual([...new Set(drew)].sort(), everyone, `${players} players, round ${round}: everyone draws`);
      }
    }
  }
});

test('pairs: with an odd number, the last player draws with someone who already drew', (t) => {
  const r = room(t, ['ana', 'ben', 'cy', 'dee', 'eve'], { mode: 'pairs', rounds: 2 });
  const turns = playThrough(r);
  for (const round of [1, 2]) {
    const these = turns.filter((t) => t[0] === round);
    assert.equal(these.length, 3, `round ${round}: three turns`);
    assert.ok(these.every((t) => t[2] && t[1] !== t[2]), 'every turn has two different drawers');
    const drew = these.flatMap((t) => [t[1], t[2]]);
    assert.deepEqual([...new Set(drew)].sort(), ['ana', 'ben', 'cy', 'dee', 'eve'], `round ${round}: everyone draws`);
  }
});

test('pairs: two players take turns alone, there would be nobody left to guess', (t) => {
  const r = room(t, ['ana', 'ben'], { mode: 'pairs', rounds: 1 });
  const turns = playThrough(r);
  assert.deepEqual(turns.map((t) => t[2]), [null, null]);
});

test('classic: one drawer per turn, in the order people joined', (t) => {
  const r = room(t, ['ana', 'ben', 'cy'], { rounds: 1 });
  const turns = playThrough(r);
  assert.deepEqual(turns, [[1, 'ana', null], [1, 'ben', null], [1, 'cy', null]]);
});

test('pairs: both draw at once, undo takes back only your own strokes', async (t) => {
  const r = room(t, ['ana', 'ben', 'cy'], { mode: 'pairs', rounds: 1 });
  r.say('ana', { t: 'start' });
  const { drawer, partner } = r.S;
  const guesser = ['ana', 'ben', 'cy'].find((id) => id !== drawer && id !== partner);
  assert.equal((await r.view(drawer)).choices.length, 3, 'the drawer picks the word');
  assert.equal((await r.view(partner)).choices, null, 'the partner waits for it');
  r.say(drawer, { t: 'choose', i: 0 });
  const word = r.S.word;
  assert.equal((await r.view(partner)).word, word, 'the partner sees the word');
  assert.equal((await r.view(guesser)).word, null, 'the guesser does not');

  const stroke = (id) => ({ k: 's', id, b: 'pen', c: '#000', w: 4, p: [0.1, 0.1] });
  r.say(drawer, { t: 'd', a: 'begin', op: stroke('d1') });
  r.say(partner, { t: 'd', a: 'begin', op: stroke('p1') });
  r.say(drawer, { t: 'd', a: 'pts', id: 'd1', p: [0.2, 0.2] });
  r.say(partner, { t: 'd', a: 'pts', id: 'd1', p: [0.9, 0.9] }); // not theirs: ignored
  r.say(guesser, { t: 'd', a: 'begin', op: stroke('g1') }); // not drawing: ignored
  assert.deepEqual(r.S.ops.map((o) => [o.id, o.u]), [['d1', drawer], ['p1', partner]]);
  assert.deepEqual(r.S.ops[0].p, [0.1, 0.1, 0.2, 0.2]);

  r.inbox.get(guesser).length = 0;
  r.say(partner, { t: 'd', a: 'undo', id: 'd1' }); // someone else's stroke: ignored
  r.say(drawer, { t: 'd', a: 'undo' }); // an older version names no stroke: your latest
  assert.deepEqual(r.S.ops.map((o) => o.id), ['p1'], 'the partner’s stroke stays');
  assert.deepEqual(r.inbox.get(guesser).filter((m) => m.t === 'd'), [{ t: 'd', a: 'undo', id: 'd1' }], 'everyone removes the same stroke');

  // Redo sends the stroke again as a new op: it goes back on top, and stays the drawer's
  // whoever it claims to be from
  r.say(drawer, { t: 'd', a: 'op', op: { ...stroke('d1'), p: [0.1, 0.1, 0.2, 0.2], u: partner } });
  assert.deepEqual(r.S.ops.map((o) => [o.id, o.u]), [['p1', partner], ['d1', drawer]]);
  assert.deepEqual(r.inbox.get(guesser).filter((m) => m.t === 'd').at(-1), { t: 'd', a: 'op', op: r.S.ops[1] }, 'everyone gets it back');
  r.say(partner, { t: 'd', a: 'undo' });
  assert.deepEqual(r.S.ops.map((o) => o.id), ['d1'], 'the partner’s undo still takes their own stroke');

  // A right guess pays both drawers
  r.say(guesser, { t: 'chat', text: word });
  const pts = Object.fromEntries(r.S.players.map((p) => [p.id, p.turnPts]));
  assert.equal(pts[drawer], 75);
  assert.equal(pts[partner], 75);
  assert.ok(pts[guesser] > 100);
  assert.equal(r.S.phase, 'reveal', 'the only guesser got it: the turn ends');
  assert.equal(r.S.gallery[0].name, `${drawer} & ${partner}`);
  assert.equal(r.S.gallery[0].partner, partner);
});

test('pairs: no hearts for a drawing you made with someone', async (t) => {
  const r = room(t, ['ana', 'ben', 'cy', 'dee'], { mode: 'pairs', rounds: 1 });
  r.say('ana', { t: 'start' });
  for (let turn = 0; turn < 2; turn++) {
    r.say(r.S.drawer, { t: 'choose', i: 0 });
    r.say(r.S.partner, { t: 'd', a: 'op', op: { k: 'f', id: `f${turn}`, x: 0.5, y: 0.5, c: '#f00' } });
    r.next();
  }
  assert.equal(r.S.phase, 'voting');
  const [first, second] = r.S.gallery;
  r.say(first.partner, { t: 'vote', id: first.id }); // their own: ignored
  r.say(first.partner, { t: 'vote', id: second.id });
  assert.deepEqual(r.S.votes[first.partner], [second.id]);
  assert.equal((await r.view(first.partner)).maxVotes, 1, 'one drawing is theirs, so one heart');
});

test('pairs: if the word picker drops out, their partner picks instead', async (t) => {
  const r = room(t, ['ana', 'ben', 'cy', 'dee'], { mode: 'pairs', rounds: 1 });
  r.say('ana', { t: 'start' });
  const { drawer, partner } = r.S;
  r.engine.leave(drawer);
  r.tick(GRACE_MS + 500);
  assert.equal(r.S.phase, 'choosing');
  assert.equal(r.S.drawer, partner);
  assert.equal((await r.view(partner)).choices.length, 3);
});
