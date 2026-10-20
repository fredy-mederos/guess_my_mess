// Stress test: a full room of phones, laptops and tablets plays one round (everyone draws once)
// with chat floods, wrong and close guesses, reactions, a player reloading, the host reloading
// and a player leaving; then voting and results. Prints a report with timings and saves it,
// with screenshots, to tests/out/stress. About 8 minutes with 20 players.
// Usage: node tests/stress.mjs [players]   (5 to 24, default 20)
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './lib/browser.mjs';
import { site } from './lib/server.mjs';
import { createRoom, joinRoom, setup } from './lib/game.mjs';

const N = +(process.argv[2] || 20);
if (!(N >= 5 && N <= 24)) throw new Error('Players: 5 to 24');
const NAMES = ['Fredy', 'Ana', 'Sam', 'Lea', 'Max', 'Mia', 'Leo', 'Zoe', 'Ben', 'Eva', 'Tom', 'Ivy', 'Kai', 'Nia', 'Ola', 'Raj', 'Uma', 'Vic', 'Wes', 'Yui', 'Zed', 'Ari', 'Jo', 'Pia'];
const WRONG = ['cat?', 'a house', 'pizza!!', 'is it a dog', 'banana', 'lol what', 'no idea', 'tree', 'a car?', 'hmm', 'the sun', 'flower'];
// The host and Sam on laptops and Ana on a phone, sharp enough for screenshots; everyone else
// takes turns being a phone, a small laptop or a tablet
const device = (i) => (i === 0 || i === 2 ? { width: 1280, height: 800 }
  : i === 1 ? { width: 390, height: 844, mobile: true }
    : [{ width: 390, height: 844, mobile: true, scale: 1 }, { width: 1024, height: 700, scale: 1 }, { width: 820, height: 1180, mobile: true, scale: 1 }][i % 3]);
const avatar = (i) => ({ c: i % 12, e: (i * 3) % 8, m: (i * 5) % 8, h: (i * 7) % 10 });
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const sorted = (a) => [...a].sort((x, y) => x - y);
const median = (a) => sorted(a)[Math.floor(a.length / 2)];
const pct = (a, p) => sorted(a)[Math.min(a.length - 1, Math.floor(a.length * p))];
const secs = (ms) => (ms / 1000).toFixed(1);
const T0 = Date.now();
const log = (...a) => console.log(`[${secs(Date.now() - T0)}s]`, ...a);

const game = await site();
const browser = await launch('stress');
const stats = { joinMs: [], rtts: [], failedGuesses: 0, syncChecks: [], turnMs: [], turns: [], events: [], problems: [] };

try {
  const pages = [];
  for (let i = 0; i < N; i++) pages.push(await browser.player(NAMES[i], device(i)));
  const [host, ana, sam] = pages;
  const reloader = pages[Math.min(6, N - 2)];
  const leaver = pages[Math.min(15, N - 1)];
  const invite = await createRoom(host, game.url, avatar(0));
  log('room', invite.split('#room=')[1]);

  // People trickle in, 5 at a time
  const guests = pages.slice(1);
  for (let b = 0; b < guests.length; b += 5) {
    await Promise.all(guests.slice(b, b + 5).map(async (p) => stats.joinMs.push(await joinRoom(p, invite, avatar(pages.indexOf(p))))));
  }
  await host.waitFor(`__gmm.state().players.filter((p) => p.online).length === ${N}`, 30000);
  log(`all ${N} players in the lobby`);
  const byId = new Map();
  for (const p of pages) byId.set(await p.eval('__gmm.state().me'), p);
  const alive = new Set(pages);

  for (const p of guests.slice(0, 6)) {
    await p.eval(`__d.say(${JSON.stringify(pick(['hi all!', 'ready', 'let’s go', 'hello', 'good luck', 'yo']))})`);
    await sleep(120);
  }
  await sleep(500);
  await host.resize(1280, 1000);
  await host.shot('01-lobby.jpg');
  await host.resize(1280, 800);
  await setup(host, { rounds: 1, drawTime: 30 });

  // ---------- the round: everybody draws once ----------
  const gameT0 = Date.now();
  await host.eval(`__d.click('Start the game')`);
  let turn = 0;
  while (true) {
    await host.waitFor(`['choosing', 'drawing', 'voting', 'podium'].includes(__gmm.state()?.phase)`, 40000);
    const phase = await host.eval('__gmm.state().phase');
    if (phase === 'voting' || phase === 'podium') break;
    turn++;
    const t0 = Date.now();
    const drawerId = await host.eval('__gmm.state().drawer');
    const drawer = byId.get(drawerId);
    if (!drawer || !alive.has(drawer)) {
      await host.waitFor(`__gmm.state().drawer !== ${JSON.stringify(drawerId)} || __gmm.state().phase === 'reveal'`, 30000);
      continue;
    }
    await drawer.waitFor(`document.querySelectorAll('.word-choices button').length > 0`, 20000);
    await drawer.eval(`document.querySelector('.word-choices button').click(); true`);
    await drawer.waitFor(`__gmm.state()?.phase === 'drawing' && document.querySelector('.board').classList.contains('drawing')`);
    const pickedMs = Date.now() - t0;
    const word = await drawer.eval('__gmm.state().word');
    await drawer.eval(`(() => { const d = __d, s = ${turn};
      const pal = ['#e03131', '#1c7ed6', '#2f9e44', '#f76707', '#7048e8', '#e64980', '#fcc419', '#0ca678'];
      const c = (i) => pal[(s + i) % pal.length];
      d.paper(['#ffffff', '#fff8e7', '#dbeafe', '#dcfce7', '#fde2e4'][s % 5]);
      d.size(8); d.color(c(0)); d.shape('ellipse', 0.3 + (s % 3) * 0.05, 0.3, 0.7, 0.75, true);
      d.brush('rainbow'); d.size(9); d.curve((t) => [0.1 + 0.8 * t, 0.15 + 0.05 * Math.sin(t * (6 + s))], 50);
      d.brush('spray'); d.color(c(2)); d.size(10); d.curve((t) => [0.15 + 0.7 * t, 0.88], 24);
      d.brush('neon'); d.color(c(3)); d.size(6); d.curve((t) => [0.5 + 0.13 * Math.cos(t * 6.28), 0.52 + 0.17 * Math.sin(t * 6.28)], 50);
      d.brush('marker'); d.color(c(4)); d.size(8); d.path([[0.2, 0.62], [0.5, 0.58], [0.8, 0.62]]);
      d.brush('pen'); d.color('#2b2533'); d.size(6); d.curve((t) => [0.42 + 0.16 * t, 0.66 + 0.04 * Math.sin(t * 3.14)], 20);
      document.querySelector('.board .live').dispatchEvent(new PointerEvent('pointerleave'));
      return true; })()`);
    await sleep(500);
    if (drawer === ana) await ana.shot('03-phone-drawer.jpg');
    if (drawer === sam) await sam.shot('04-desktop-drawer.jpg');

    // Guessers: wrong, close and right guesses, reactions, chat noise. Odd turns everyone gets
    // it (some after mistakes); even turns about a quarter never do, so the timer runs out;
    // on turn 10 nobody does.
    const guessers = [...alive].filter((p) => p !== drawer);
    const missers = new Set(turn === 10 ? guessers : turn % 2 === 0 ? guessers.filter(() => Math.random() < 0.25) : []);
    // Typing the next guess takes a person a moment. Bots must not be faster than that: the host
    // drops a player's messages that arrive within 100 ms of each other.
    const typing = () => sleep(400 + Math.random() * 600);
    const guess = async (g, i) => {
      await sleep(150 + Math.random() * 2000);
      if (missers.has(g)) {
        for (let k = 0; k < 1 + Math.floor(Math.random() * 3); k++) {
          await g.eval(`__d.say(${JSON.stringify(pick(WRONG))})`).catch(() => {});
          await sleep(400 + Math.random() * 1500);
        }
        return;
      }
      const r = Math.random();
      if (r < 0.4) {
        await g.eval(`__d.say(${JSON.stringify(pick(WRONG))})`).catch(() => {});
        await typing();
      }
      if (r > 0.8 && word.replace(/[^a-z]/g, '').length >= 4) {
        const k = Math.floor(word.length / 2); // one letter short: "so close!"
        await g.eval(`__d.say(${JSON.stringify(word.slice(0, k) + word.slice(k + 1))})`).catch(() => {});
        await typing();
      }
      if (Math.random() < 0.25) await g.eval(`__d.react(${i % 6})`).catch(() => {});
      const ms = await g.eval(`__d.timedGuess(${JSON.stringify(word)})`).catch(() => -1);
      if (ms >= 0) stats.rtts.push(ms);
      else stats.failedGuesses++;
    };
    // On turn 3 half the room holds back, so the screenshots catch a turn in progress
    const holdBack = turn === 3 ? guessers.filter((g, i) => i % 2 === 1 && g !== ana && g !== host) : [];
    const noReplyBefore = stats.failedGuesses;
    await Promise.all(guessers.filter((g) => !holdBack.includes(g)).map(guess));
    if (turn === 3) {
      await sleep(600);
      if (drawer !== ana) await ana.shot('02-phone-guesser.jpg');
      if (drawer !== host) await host.shot('05-desktop-guesser.jpg');
      await Promise.all(holdBack.map(guess));
    }
    const guessesMs = Date.now() - t0;
    await host.waitFor(`__gmm.state().phase === 'reveal'`, 45000);
    // How the turn ended and how many guessers the host credited, by its own count
    const { ended, credited } = await host.eval(`(() => { const s = __gmm.state();
      return { ended: s.results.reason, credited: s.players.filter((p) => p.guessed).length }; })()`);

    // Every few turns: is the drawing pixel-identical on every screen?
    if (turn % 4 === 1) {
      await sleep(300);
      const ref = await drawer.eval('__d.inkCount()');
      const inks = await Promise.all([...alive].map((p) => p.eval('__d.inkCount()').catch(() => -1)));
      stats.syncChecks.push({ turn, word, identical: inks.filter((x) => x === ref).length, screens: inks.length });
    }
    stats.turnMs.push(Date.now() - t0);
    const tried = guessers.length - missers.size;
    stats.turns.push({ turn, drawer: drawer.name, word, tried, credited, of: guessers.length, ended, noReply: stats.failedGuesses - noReplyBefore,
      seconds: { picked: +secs(pickedMs), guessesDone: +secs(guessesMs), ended: +secs(Date.now() - t0) } });
    log(`turn ${turn}: ${drawer.name} drew "${word}", ${credited}/${guessers.length} got it (${tried} tried), ended by ${ended}, ${secs(Date.now() - t0)}s`);

    // ---------- disruptions ----------
    if (turn === 4) {
      const score = `__gmm.state().players.find((p) => p.name === '${reloader.name}')`;
      const before = await host.eval(`${score}.score`);
      const t = Date.now();
      await reloader.reload();
      await reloader.waitFor(`!document.querySelector('#room').hidden && !!__gmm.state()`, 30000);
      await host.waitFor(`${score}.online`, 30000);
      const after = await host.eval(`${score}.score`);
      if (before !== after) stats.problems.push(`${reloader.name}'s score changed after a reload`);
      stats.events.push(`${reloader.name} reloaded the page: back in ${secs(Date.now() - t)}s, score ${before === after ? 'kept' : 'CHANGED'} (${before} → ${after})`);
      log(stats.events.at(-1));
    }
    if (turn === 6) {
      const scores = 'JSON.stringify(__gmm.state().players.map((p) => [p.name, p.score]))';
      const before = await host.eval(scores);
      const t = Date.now();
      await host.reload();
      await host.waitFor(`!!window.__gmm && __gmm.state()?.players?.filter((p) => p.online).length === ${alive.size}`, 90000);
      const same = before === (await host.eval(scores));
      if (!same) stats.problems.push('scores changed after the host reloaded');
      stats.events.push(`The host reloaded mid-game: all ${alive.size - 1} guests back in ${secs(Date.now() - t)}s, scores ${same ? 'identical' : 'CHANGED'}`);
      log(stats.events.at(-1));
    }
    if (turn === 9) {
      await leaver.close();
      alive.delete(leaver);
      const t = Date.now();
      await host.waitFor(`!__gmm.state().players.find((p) => p.name === '${leaver.name}').online`, 30000);
      stats.events.push(`${leaver.name} closed the tab: the host noticed in ${secs(Date.now() - t)}s; that turn gets skipped`);
      log(stats.events.at(-1));
    }
  }
  const gameMs = Date.now() - gameT0;

  // ---------- voting ----------
  log('voting');
  const voters = [...alive];
  await Promise.all(voters.map((p) => p.waitFor(`document.querySelectorAll('.vote-card').length > 0`, 20000)));
  await Promise.all(voters.map((p) => p.eval(`(() => { const c = [...document.querySelectorAll('.vote-card:not(:disabled)')]; c[Math.floor(Math.random() * c.length)]?.click(); return true; })()`)));
  await sleep(1200);
  await sam.resize(1280, 1500);
  await sam.shot('06-vote-desktop.jpg');
  await ana.shot('07-vote-phone.jpg');
  for (const p of voters) await p.eval(`__d.click('Done voting')`).catch(() => {});
  await host.waitFor(`__gmm.state().phase === 'podium'`, 30000);
  await sleep(1500);

  // ---------- results: does everybody see the same thing? ----------
  const finals = await Promise.all(voters.map((p) => p.eval(`JSON.stringify(__gmm.state().final.map((p) => [p.name, p.score]))`)));
  const galleries = await Promise.all(voters.map((p) => p.eval(`document.querySelectorAll('#results .gallery-grid.small .gallery-card').length`)));
  const summary = await host.eval(`(() => { const s = __gmm.state(); return { podium: s.final.slice(0, 3).map((p) => p.name + ' ' + p.score),
    bestDrawings: s.best.length, stats: s.stats.map((x) => x.title + ': ' + x.who + ', ' + x.detail),
    hostHeapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null }; })()`);
  await host.resize(1280, 3000);
  await host.shot('08-results-desktop.jpg');
  await ana.resize(390, 3200);
  await ana.shot('09-results-phone.jpg');

  if (new Set(finals).size !== 1) stats.problems.push('final scores differ between screens');
  if (new Set(galleries).size !== 1) stats.problems.push('galleries differ between screens');
  if (stats.syncChecks.some((c) => c.identical !== c.screens)) stats.problems.push('a drawing looked different on some screens');
  if (stats.failedGuesses) stats.problems.push(`${stats.failedGuesses} right answers got no reply`);
  if (browser.errors.length) stats.problems.push(`${browser.errors.length} JavaScript errors`);
  const report = {
    players: N,
    turnsPlayed: turn,
    gameMinutes: +(gameMs / 60000).toFixed(1),
    joinSeconds: { median: +secs(median(stats.joinMs)), max: +secs(Math.max(...stats.joinMs)) },
    guessRoundTripMs: { count: stats.rtts.length, median: median(stats.rtts), p95: pct(stats.rtts, 0.95), max: Math.max(...stats.rtts), failed: stats.failedGuesses },
    avgTurnSeconds: +secs(stats.turnMs.reduce((a, b) => a + b, 0) / stats.turnMs.length),
    drawingSync: stats.syncChecks,
    turns: stats.turns,
    disruptions: stats.events,
    sameFinalScoresEverywhere: new Set(finals).size === 1,
    galleryCounts: [...new Set(galleries)],
    summary,
    jsErrors: browser.errors,
    problems: stats.problems,
  };
  writeFileSync(join(browser.out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`\n===== REPORT =====\n${JSON.stringify(report, null, 2)}`);
  console.log(stats.problems.length ? `\nFAIL: ${stats.problems.join('; ')}` : '\nPASS: everyone saw the same game');
  if (stats.problems.length) process.exitCode = 1;
} catch (e) {
  console.error('FAILED', e.message);
  console.log('so far:', JSON.stringify(stats));
  console.log(browser.errors.length ? `JavaScript errors:\n  ${browser.errors.join('\n  ')}` : 'JavaScript errors: none');
  process.exitCode = 1;
} finally {
  await browser.close();
  await game.close();
}
