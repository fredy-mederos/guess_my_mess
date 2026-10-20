// The game engine. It only runs in the host's browser and is the single source of truth:
// players, turns, timers, the secret word, guesses and scores. Every player (the host
// included) talks to it with the same messages, and it sends each player only what they
// are allowed to see, so the word never reaches someone who shouldn't have it.
import { sanitizeAvatar } from './avatar.js';
import { pickChoices, LANGUAGES, DIFFICULTIES } from './words/index.js';
import { normalize, levenshtein, clamp, pick } from './util.js';

export const DEFAULT_SETTINGS = {
  lang: 'en', difficulty: 'mixed', rounds: 3, drawTime: 80, choices: 3,
  hints: 1, closeHints: true, customWords: '', customOnly: false,
};
export const REACTIONS = ['thumbs', 'laugh', 'fire', 'heart', 'wow', 'think']; // icon names
export const MAX_PLAYERS = 16;

const CHOOSE_MS = 15000;
const REVEAL_MS = 6000;
const GRACE_MS = 8000;          // how long a dropped drawer gets to reconnect
const HINT_SHARE = [0, 0.3, 0.5];
const DRAWER_PTS = 75;
const DEFAULT_BG = '#ffffff';
export const MAX_VOTES = 3;     // hearts each player can hand out in the end-of-game gallery

const int = (v, lo, hi, d) => (Number.isFinite(+v) ? clamp(Math.round(+v), lo, hi) : d);
const cleanName = (name) => String(name || '').replace(/\s+/g, ' ').trim().slice(0, 18) || 'Player';
// More drawings, more time to look at them: 30s to 90s
const votingMs = (drawings) => clamp(20000 + drawings * 6000, 30000, 90000);

export function cleanSettings(s = {}) {
  const d = DEFAULT_SETTINGS;
  return {
    lang: LANGUAGES[s.lang] ? s.lang : d.lang,
    difficulty: DIFFICULTIES[s.difficulty] ? s.difficulty : d.difficulty,
    rounds: int(s.rounds, 1, 10, d.rounds),
    drawTime: int(s.drawTime, 30, 240, d.drawTime),
    choices: int(s.choices, 1, 5, d.choices),
    hints: int(s.hints, 0, 2, d.hints),
    closeHints: s.closeHints == null ? d.closeHints : !!s.closeHints,
    customWords: String(s.customWords || '').slice(0, 4000),
    customOnly: !!s.customOnly,
  };
}

function freshState(settings) {
  return {
    phase: 'lobby', settings: cleanSettings(settings), players: [], round: 0, queue: [],
    drawer: null, choices: [], word: null, deadline: 0, phaseMs: 0, turnStart: 0,
    revealed: [], maxReveal: 0, ops: [], bg: DEFAULT_BG, guessCount: 0, used: [],
    results: null, final: null, banned: [], chatLog: [],
    // End-of-game gallery: one snapshot per finished drawing, hearts per voter, the winners
    gallery: [], votes: {}, done: [], best: [], tally: {},
    // Fun stats: a record per turn plus per-player counters, summed up when the game ends
    turnLog: [], guessTimes: [], undos: 0, wrong: {}, close: {}, stats: [],
  };
}

const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const minBy = (list, f) => list.reduce((a, b) => (a && f(a) <= f(b) ? a : b), null);
const maxBy = (list, f) => list.reduce((a, b) => (a && f(a) >= f(b) ? a : b), null);

export function createEngine({ hostId, sendTo, kick, saved, hall = {}, onSave, onHall }) {
  const S = saved ? { ...freshState(), ...saved } : freshState();
  if (saved) S.players.forEach((p) => { p.online = false; p.offlineSince = Date.now(); });
  let dirty = false;

  // ---------- helpers ----------
  const now = () => Date.now();
  const player = (id) => S.players.find((p) => p.id === id);
  const online = () => S.players.filter((p) => p.online);
  const inGame = () => ['choosing', 'drawing', 'reveal'].includes(S.phase);
  const each = (fn) => online().forEach(fn);

  function sync() {
    if (dirty) return;
    dirty = true;
    queueMicrotask(() => {
      dirty = false;
      each((p) => sendTo(p.id, view(p)));
      onSave?.(S);
    });
  }

  function chat(to, msg) {
    sendTo(to.id, { t: 'chat', ...msg });
  }

  function chatAll(msg, keep = true) {
    each((p) => chat(p, msg));
    if (keep) {
      S.chatLog.push(msg);
      if (S.chatLog.length > 40) S.chatLog.shift();
    }
  }

  const system = (text, kind = 'system') => chatAll({ kind, text });

  function mask() {
    if (!S.word) return '';
    return [...S.word].map((ch, i) => (/[\p{L}\p{N}]/u.test(ch) && !S.revealed.includes(i) ? '_' : ch)).join('');
  }

  function view(p) {
    const isDrawer = p.id === S.drawer;
    const seesWord = isDrawer || p.guessed || S.phase === 'reveal';
    return {
      t: 'state',
      phase: S.phase,
      me: p.id,
      host: hostId,
      settings: S.settings,
      round: S.round,
      drawer: S.drawer,
      players: S.players.map(({ id, name, avatar, score, online, guessed, turnPts }) =>
        ({ id, name, avatar, score, online, guessed, turnPts, voted: S.done.includes(id) })),
      remaining: S.deadline ? Math.max(0, S.deadline - now()) : 0,
      phaseMs: S.phaseMs,
      word: seesWord ? S.word : null,
      hint: S.phase === 'drawing' ? mask() : '',
      choices: isDrawer && S.phase === 'choosing' ? S.choices : null,
      results: S.phase === 'reveal' ? S.results : null,
      final: S.phase === 'podium' ? S.final : null,
      // Votes stay secret until the results, so nobody just follows the crowd
      myVotes: S.votes[p.id] || [],
      maxVotes: maxVotes(p.id),
      best: S.phase === 'podium' ? S.best : [],
      tally: S.phase === 'podium' ? S.tally : {},
      stats: S.phase === 'podium' ? S.stats : [],
      hall: Object.values(hall).sort((a, b) => b.wins - a.wins || b.points - a.points).slice(0, 10),
    };
  }

  // You can't vote for your own drawings, and you never get more hearts than there are drawings to like
  function maxVotes(id) {
    return Math.min(MAX_VOTES, S.gallery.filter((d) => d.drawer !== id).length);
  }

  // Ops can be big, so canvas catch-up goes out in chunks
  function sendCanvas(p) {
    sendTo(p.id, { t: 'canvas', bg: S.bg });
    for (let i = 0; i < S.ops.length; i += 25) sendTo(p.id, { t: 'd', a: 'ops', ops: S.ops.slice(i, i + 25) });
  }

  function toOthers(fromId, msg) {
    each((p) => { if (p.id !== fromId) sendTo(p.id, msg); });
  }

  // ---------- players ----------
  function uniqueName(name, id) {
    let n = name;
    for (let i = 2; S.players.some((p) => p.id !== id && p.online && p.name === n); i++) n = `${name} ${i}`;
    return n;
  }

  function hello(id, msg) {
    if (S.banned.includes(id)) return kick(id);
    let p = player(id);
    const name = cleanName(msg.name);
    if (!p) {
      if (online().length >= MAX_PLAYERS) {
        sendTo(id, { t: 'full' });
        return kick(id);
      }
      p = { id, score: 0, guessed: false, turnPts: 0 };
      S.players.push(p);
      system(`${uniqueName(name, id)} joined`, 'join');
    } else if (!p.online) {
      system(`${p.name} is back`, 'join');
    }
    Object.assign(p, { name: uniqueName(name, id), avatar: sanitizeAvatar(msg.avatar), online: true, offlineSince: 0 });
    sendTo(id, { t: 'welcome', you: id });
    sendTo(id, view(p));
    sendCanvas(p);
    // Newcomers (and anyone reconnecting) get the strokes of every drawing so far, one per message
    for (const d of S.gallery) sendTo(id, { t: 'drawing', d });
    sendTo(id, { t: 'chatlog', list: S.chatLog.filter((m) => !m.private) });
    sync();
  }

  // Change name/avatar in place, without leaving the room (score and turn are kept)
  function updateProfile(p, msg) {
    const old = p.name;
    p.name = uniqueName(cleanName(msg.name), p.id);
    p.avatar = sanitizeAvatar(msg.avatar);
    if (old !== p.name) system(`${old} is now ${p.name}`);
    sync();
  }

  function leave(id) {
    const p = player(id);
    if (!p || !p.online) return;
    p.online = false;
    p.offlineSince = now();
    if (S.phase === 'lobby') S.players = S.players.filter((x) => x !== p);
    system(`${p.name} left`, 'leave');
    sync();
  }

  // ---------- game flow ----------
  function setPhase(phase, ms) {
    S.phase = phase;
    S.phaseMs = ms || 0;
    S.deadline = ms ? now() + ms : 0;
  }

  function startGame() {
    S.players = S.players.filter((p) => p.online);
    S.players.forEach((p) => { p.score = 0; });
    S.round = 1;
    S.queue = S.players.map((p) => p.id);
    S.used = [];
    S.final = null;
    Object.assign(S, { gallery: [], votes: {}, done: [], best: [], tally: {}, turnLog: [], wrong: {}, close: {}, stats: [] });
    each((p) => sendTo(p.id, { t: 'gallery', reset: true }));
    system('Game on! Good luck everyone.', 'start');
    nextTurn();
  }

  function nextTurn() {
    let next = null;
    while (!next) {
      if (!S.queue.length) {
        S.round++;
        // Last turn done: vote on the drawings first (needs at least two to choose from)
        if (S.round > S.settings.rounds) return S.gallery.length >= 2 ? startVoting() : endGame();
        S.queue = online().map((p) => p.id);
      }
      const id = S.queue.shift();
      if (player(id)?.online) next = id;
    }
    S.drawer = next;
    S.word = null;
    S.choices = pickChoices(S.settings, new Set(S.used), S.settings.choices);
    S.revealed = [];
    S.ops = [];
    S.bg = DEFAULT_BG;
    S.guessCount = 0;
    S.results = null;
    S.players.forEach((p) => { p.guessed = false; p.turnPts = 0; });
    setPhase('choosing', CHOOSE_MS);
    each((p) => sendTo(p.id, { t: 'canvas', bg: S.bg }));
    sync();
  }

  function choose(i) {
    const word = S.choices[i] ?? pick(S.choices);
    S.word = word;
    S.used.push(word);
    const letters = [...word].filter((ch) => /[\p{L}\p{N}]/u.test(ch)).length;
    S.maxReveal = Math.min(letters - 1, Math.floor(letters * HINT_SHARE[S.settings.hints]));
    S.turnStart = now();
    S.guessTimes = [];
    S.undos = 0;
    setPhase('drawing', S.settings.drawTime * 1000);
    system(`${player(S.drawer)?.name} is drawing now!`, 'drawing');
    sync();
  }

  // What happened this turn, for the end-of-game fun stats
  function logTurn(drawer, reason) {
    const inked = S.ops.filter((o) => o.c && o.b !== 'eraser');
    S.turnLog.push({
      word: S.word,
      drawer: drawer.id,
      name: drawer.name,
      reason,
      guesses: S.guessTimes.slice(),
      possible: online().filter((o) => o.id !== drawer.id).length,
      ms: now() - S.turnStart,
      lines: S.ops.filter((o) => o.k === 's' || o.k === 'sh').length,
      colors: new Set(inked.map((o) => (o.b === 'rainbow' ? 'rainbow' : o.c))).size,
      undos: S.undos,
    });
  }

  // A handful of playful awards; each one only shows up when there's something to say
  function funStats() {
    const name = (id) => player(id)?.name || 'Someone';
    const turns = S.turnLog.filter((t) => t.reason === 'all' || t.reason === 'time');
    const cracked = turns.filter((t) => t.guesses.length);
    const out = [];
    const add = (icon, title, who, detail) => out.push({ icon, title, who, detail });

    const easy = minBy(cracked, (t) => t.guesses[0].ms);
    if (easy) add('neon', 'Easiest word', `“${easy.word}”`, `guessed in ${secs(easy.guesses[0].ms)}`);
    // Hardest: fewest people got it, then the slowest first guess
    const hardness = (t) => (1 - t.guesses.length / Math.max(1, t.possible)) * 1e7 + (t.guesses[0]?.ms ?? t.ms);
    const hard = turns.length > 1 ? maxBy(turns, hardness) : null;
    if (hard && hard !== easy) add('think', 'Hardest word', `“${hard.word}”`, hard.guesses.length ? `took ${secs(hard.guesses[0].ms)} to crack` : 'nobody got it!');

    const fast = minBy(turns.flatMap((t) => t.guesses.map((g) => ({ ...g, word: t.word }))), (g) => g.ms);
    if (fast) add('clock', 'Fastest guess', name(fast.id), `“${fast.word}” in ${secs(fast.ms)}`);

    const hits = {};
    for (const t of turns) for (const g of t.guesses) hits[g.id] = (hits[g.id] || 0) + 1;
    const sharp = maxBy(Object.entries(hits), ([, n]) => n);
    if (sharp && sharp[1] >= 2) add('target', 'Sharpest eye', name(sharp[0]), `${plural(sharp[1], 'word')} guessed`);

    const minimal = minBy(cracked.filter((t) => t.lines > 0), (t) => t.lines);
    if (minimal) add('line', 'Minimalist', minimal.name, `“${minimal.word}” in ${plural(minimal.lines, 'line')}`);
    const detailed = maxBy(turns, (t) => t.lines);
    if (detailed && detailed !== minimal && detailed.lines >= 10) add('pencil', 'Most detailed', detailed.name, `${detailed.lines} lines for “${detailed.word}”`);
    const colorful = maxBy(turns, (t) => t.colors);
    if (colorful && colorful.colors >= 3) add('rainbow', 'Most colorful', colorful.name, `${colorful.colors} colors in “${colorful.word}”`);
    const undo = maxBy(S.turnLog, (t) => t.undos);
    if (undo && undo.undos >= 3) add('undo', 'Second thoughts', undo.name, `${undo.undos} undos on “${undo.word}”`);

    const close = maxBy(Object.entries(S.close), ([, n]) => n);
    if (close && close[1] >= 2) add('fire', 'So close', name(close[0]), `${close[1]} near misses`);
    const wild = maxBy(Object.entries(S.wrong), ([, n]) => n);
    if (wild && wild[1] >= 3) add('chat', 'Wild guesser', name(wild[0]), `${wild[1]} wrong guesses`);
    return out;
  }

  function endTurn(reason) {
    const drawer = player(S.drawer);
    S.results = {
      word: S.word,
      reason,
      drawer: S.drawer,
      pts: Object.fromEntries(S.players.filter((p) => p.turnPts).map((p) => [p.id, p.turnPts])),
    };
    if (S.word && drawer) logTurn(drawer, reason);
    // Keep every real drawing for the end-of-game gallery, as strokes (vector), not pixels.
    // Everyone already received those strokes live, so only the label goes out now;
    // each device pairs it with the drawing on its own board and redraws it crisply later.
    if (S.word && S.ops.length && drawer) {
      const d = { id: S.gallery.length + 1, drawer: drawer.id, name: drawer.name, avatar: drawer.avatar, word: S.word };
      S.gallery.push({ ...d, bg: S.bg, ops: S.ops });
      each((p) => sendTo(p.id, { t: 'drawing', d }));
    }
    if (S.word) system(`The word was “${S.word}”`, 'reveal');
    else if (reason === 'left') system(`${drawer?.name || 'The drawer'} left, skipping the turn`);
    setPhase('reveal', REVEAL_MS);
    sync();
  }

  function startVoting() {
    S.drawer = null;
    S.word = null;
    S.votes = {};
    S.done = [];
    setPhase('voting', votingMs(S.gallery.length));
    system('Time to vote for the best drawing!', 'start');
    sync();
  }

  function vote(p, id) {
    const d = S.gallery.find((g) => g.id === id);
    if (!d || d.drawer === p.id) return;
    const mine = S.votes[p.id] || (S.votes[p.id] = []);
    if (mine.includes(id)) mine.splice(mine.indexOf(id), 1);
    else if (mine.length < maxVotes(p.id)) mine.push(id);
    sync();
  }

  function doneVoting(p) {
    if (!S.done.includes(p.id)) S.done.push(p.id);
    // Everyone who's here pressed "Done": no need to wait for the clock
    if (online().every((o) => S.done.includes(o.id))) return endGame();
    sync();
  }

  function endGame() {
    S.drawer = null;
    S.word = null;
    const ranked = [...S.players].sort((a, b) => b.score - a.score);
    const top = ranked[0]?.score ?? 0;
    S.final = ranked.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.score, winner: p.score === top && top > 0 }));

    // Second award: the drawing(s) with the most hearts
    S.tally = {};
    for (const ids of Object.values(S.votes)) for (const id of ids) S.tally[id] = (S.tally[id] || 0) + 1;
    const most = Math.max(0, ...Object.values(S.tally));
    S.best = most ? S.gallery.filter((d) => S.tally[d.id] === most).map((d) => d.id) : [];
    const artists = new Set(S.best.map((id) => S.gallery.find((d) => d.id === id).drawer));

    for (const p of S.final) {
      const key = normalize(p.name) || p.id;
      const h = hall[key] || (hall[key] = { name: p.name, wins: 0, games: 0, points: 0, best: 0, art: 0 });
      Object.assign(h, { name: p.name, avatar: p.avatar });
      h.games++;
      h.points += p.score;
      h.best = Math.max(h.best, p.score);
      if (p.winner) h.wins++;
      if (artists.has(p.id)) h.art = (h.art || 0) + 1;
    }
    onHall?.(hall);
    const winners = S.final.filter((p) => p.winner).map((p) => p.name);
    system(winners.length ? `${winners.join(' & ')} won the game!` : 'Game over!', 'win');
    if (artists.size) {
      const names = [...artists].map((id) => player(id)?.name).filter(Boolean);
      system(`Best drawing: ${names.join(' & ')}!`, 'win');
    }
    S.stats = funStats();
    setPhase('podium');
    sync();
  }

  function backToLobby(text) {
    S.players = S.players.filter((p) => p.online);
    S.players.forEach((p) => { p.score = 0; p.guessed = false; p.turnPts = 0; });
    Object.assign(S, { round: 0, drawer: null, word: null, choices: [], ops: [], results: null, final: null });
    setPhase('lobby');
    if (text) system(text);
    each((p) => sendTo(p.id, { t: 'canvas', bg: DEFAULT_BG }));
    sync();
  }

  // ---------- guessing ----------
  function guess(p, text) {
    const n = normalize(text);
    const w = normalize(S.word);
    // "standup", "stand up" and "stand-up" are all the same guess
    if (n === w || n.replace(/ /g, '') === w.replace(/ /g, '')) {
      const frac = clamp((S.deadline - now()) / S.phaseMs, 0, 1);
      const pts = Math.round((100 + 400 * frac + (S.guessCount === 0 ? 50 : 0)) / 5) * 5;
      p.score += pts;
      p.turnPts += pts;
      p.guessed = true;
      S.guessCount++;
      S.guessTimes.push({ id: p.id, ms: now() - S.turnStart });
      const drawer = player(S.drawer);
      if (drawer) { drawer.score += DRAWER_PTS; drawer.turnPts += DRAWER_PTS; }
      each((o) => chat(o, o === p
        ? { kind: 'you', text: `You guessed it: “${S.word}”! +${pts}` }
        : { kind: 'good', from: p.id, text: `${p.name} guessed the word!` }));
      const left = online().filter((o) => o.id !== S.drawer && !o.guessed);
      if (!left.length) return endTurn('all');
      return sync();
    }
    const msg = { kind: 'msg', from: p.id, name: p.name, text };
    chatAll(msg);
    S.wrong[p.id] = (S.wrong[p.id] || 0) + 1;
    const close = w.length >= 4 && levenshtein(n, w) <= (w.length >= 8 ? 2 : 1);
    if (close) S.close[p.id] = (S.close[p.id] || 0) + 1;
    if (close && S.settings.closeHints) chat(p, { kind: 'close', text: `“${text}” is really close!` });
  }

  function onChat(p, raw) {
    const text = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 140);
    if (!text || now() - (p.lastChat || 0) < 100) return;
    p.lastChat = now();
    if (S.phase !== 'drawing') return chatAll({ kind: 'msg', from: p.id, name: p.name, text });
    if (p.id === S.drawer) {
      if (normalize(text).includes(normalize(S.word))) return chat(p, { kind: 'warn', text: 'Nice try, no spoilers!' });
      return chatAll({ kind: 'msg', from: p.id, name: p.name, text });
    }
    if (p.guessed) {
      // People who already know the word can chat among themselves without spoiling it
      const msg = { kind: 'guessed', from: p.id, name: p.name, text };
      return each((o) => { if (o.guessed || o.id === S.drawer) chat(o, msg); });
    }
    guess(p, text);
  }

  // ---------- drawing relay ----------
  function onDraw(p, msg) {
    if (p.id !== S.drawer || S.phase !== 'drawing') return;
    const op = msg.op;
    switch (msg.a) {
      case 'begin':
      case 'op':
        if (!op || typeof op !== 'object' || S.ops.length > 4000) return;
        S.ops.push(op);
        break;
      case 'pts': {
        const target = S.ops.findLast((o) => o.id === msg.id);
        if (!target || !Array.isArray(msg.p) || target.p.length > 20000) return;
        target.p.push(...msg.p.slice(0, 2000));
        break;
      }
      case 'undo': S.ops.pop(); S.undos++; break;
      case 'clear': S.ops = []; break;
      case 'bg': S.bg = String(msg.c).slice(0, 9); break;
      case 'end': break;
      default: return;
    }
    toOthers(p.id, msg);
  }

  // ---------- clock ----------
  const timer = setInterval(() => {
    const t = now();
    const drawer = player(S.drawer);
    if (inGame() && online().length < 2) {
      const lastLeft = Math.max(...S.players.map((p) => p.offlineSince || 0));
      if (t - lastLeft > GRACE_MS) return backToLobby('Not enough players, back to the lobby');
    }
    if ((S.phase === 'choosing' || S.phase === 'drawing') && drawer && !drawer.online && t - drawer.offlineSince > GRACE_MS) {
      return endTurn('left');
    }
    if (S.phase === 'drawing' && S.maxReveal > 0) {
      const elapsed = (t - S.turnStart) / S.phaseMs;
      const target = elapsed < 0.3 ? 0 : Math.min(S.maxReveal, 1 + Math.floor(((elapsed - 0.3) / 0.6) * S.maxReveal));
      if (S.revealed.length < target) {
        const hidden = [...S.word].map((ch, i) => i).filter((i) => /[\p{L}\p{N}]/u.test(S.word[i]) && !S.revealed.includes(i));
        if (hidden.length) {
          S.revealed.push(pick(hidden));
          sync();
        }
      }
    }
    if (!S.deadline || t < S.deadline) return;
    if (S.phase === 'choosing') choose(-1);
    else if (S.phase === 'drawing') endTurn('time');
    else if (S.phase === 'reveal') nextTurn();
    else if (S.phase === 'voting') endGame();
  }, 250);

  // ---------- inbound ----------
  function handle(id, msg) {
    if (msg.t === 'hello') return hello(id, msg);
    const p = player(id);
    if (!p || !p.online) return;
    const isHost = id === hostId;
    switch (msg.t) {
      case 'chat': return onChat(p, msg.text);
      case 'd': return onDraw(p, msg);
      case 'profile': return updateProfile(p, msg);
      case 'vote':
        if (S.phase === 'voting') vote(p, msg.id);
        return;
      case 'voted':
        if (S.phase === 'voting') doneVoting(p);
        return;
      case 'results':
        if (isHost && S.phase === 'voting') endGame();
        return;
      case 'choose':
        if (S.phase === 'choosing' && id === S.drawer) choose(int(msg.i, 0, S.choices.length - 1, 0));
        return;
      case 'react':
        if (inGame() && now() - (p.lastReact || 0) > 600 && REACTIONS[msg.e]) {
          p.lastReact = now();
          each((o) => sendTo(o.id, { t: 'react', from: id, e: msg.e }));
        }
        return;
      case 'settings':
        if (isHost && S.phase === 'lobby') { S.settings = cleanSettings(msg.settings); sync(); }
        return;
      case 'start':
        if (isHost && (S.phase === 'lobby' || S.phase === 'podium') && online().length >= 2) startGame();
        return;
      case 'lobby':
        if (isHost && S.phase === 'podium') backToLobby();
        return;
      case 'skip':
        if (isHost && (S.phase === 'drawing' || S.phase === 'choosing')) endTurn('skipped');
        return;
      case 'end':
        if (isHost && inGame()) endGame();
        return;
      case 'kick': {
        const target = player(msg.id);
        if (!isHost || !target || target.id === hostId) return;
        S.banned.push(target.id);
        sendTo(target.id, { t: 'kicked' });
        kick(target.id);
        leave(target.id);
        return;
      }
    }
  }

  return {
    handle,
    leave,
    snapshot: () => S,
    resetHall() { for (const k of Object.keys(hall)) delete hall[k]; onHall?.(hall); sync(); },
    destroy() { clearInterval(timer); },
  };
}
