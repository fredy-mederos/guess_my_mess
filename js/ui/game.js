// In-game UI: players list, top bar (round, word hint, timer), overlays on the board
// (word picker, waiting, reveal) and floating reactions. The final results live in gallery.js.
import { h } from '../util.js';
import { avatarSvg } from '../avatar.js';
import { REACTIONS } from '../engine.js';
import { icon } from '../icons.js';

const av = (a, size) => h('span', { html: avatarSvg(a, size) });
const REASONS = {
  all: ['star', 'Everyone got it!'],
  time: ['clock', 'Time’s up!'],
  skipped: ['skip', 'Turn skipped'],
  left: ['door', 'The drawer left'],
};

export function createGameUI(els, { onChoose, onReact, onKick }) {
  let overlayKey = '';
  let deadline = 0;       // local clock time when the current phase ends
  let phaseMs = 0;
  let lowPlayed = -1;
  let onTick = null;

  els.reactBar.replaceChildren(...REACTIONS.map((name, i) =>
    h('button', { type: 'button', title: 'React', 'aria-label': name, onclick: () => onReact(i) }, icon(name))));

  // ---------- players ----------
  function renderPlayers(st) {
    const inGame = st.phase !== 'lobby';
    const list = inGame ? [...st.players].sort((a, b) => b.score - a.score) : st.players;
    const amHost = st.me === st.host;
    els.players.replaceChildren(
      h('h3.players-title', h('span.marker', `Players (${st.players.filter((p) => p.online).length})`)),
      ...list.map((p, i) => {
        const drawing = inGame && p.id === st.drawer && st.phase !== 'podium';
        // A check means "guessed it" during turns and "done voting" in the gallery
        const done = st.phase === 'voting' ? p.voted : ['drawing', 'reveal'].includes(st.phase) && p.guessed;
        const badge = drawing ? icon('pencil') : done ? icon('check') : p.id === st.host ? icon('crown') : '';
        const gain = st.phase === 'reveal' && st.results?.pts[p.id];
        return h(`div.player${p.id === st.me ? '.me' : ''}${done ? '.guessed' : ''}${drawing ? '.drawing' : ''}${p.online ? '' : '.offline'}`,
          h('span.rank', inGame ? `#${i + 1}` : ''),
          av(p.avatar, 44),
          h('span.who',
            h('span.name', p.name),
            h('span.pts', inGame ? `${p.score} pts` : p.id === st.host ? 'host' : 'ready'),
            gain ? h('span.gain', ` +${gain}`) : null),
          h('span.badge', badge),
          amHost && p.id !== st.me
            ? h('button.kick', { type: 'button', title: `Remove ${p.name}`, onclick: () => onKick(p) }, '✕')
            : null);
      }));
  }

  // ---------- top bar ----------
  function renderTop(st) {
    const drawer = st.players.find((p) => p.id === st.drawer);
    const me = st.players.find((p) => p.id === st.me);
    // Long form on big screens, "1/3" on phones (see .wide-only / .narrow-only)
    const r = Math.min(st.round, st.settings.rounds);
    els.roundInfo.replaceChildren(...(st.phase === 'lobby' ? ['Lobby']
      : st.phase === 'podium' ? ['Final scores']
        : st.phase === 'voting' ? ['Voting']
        : [h('span.wide-only', `Round ${r} of ${st.settings.rounds}`), h('span.narrow-only', `${r}/${st.settings.rounds}`)]));

    let hint;
    if (st.phase === 'lobby') hint = [h('small', 'waiting room'), h('span.known', 'Get your pencils ready')];
    else if (st.phase === 'choosing') hint = [h('small', ' '), h('span.known', st.me === st.drawer ? 'Pick a word!' : `${drawer?.name || '…'} is choosing`)];
    else if (st.phase === 'drawing' && st.me === st.drawer) hint = [h('small', 'draw this'), h('span.known', st.word)];
    else if (st.phase === 'drawing' && me?.guessed) hint = [h('small', 'you got it!'), h('span.known', st.word)];
    else if (st.phase === 'drawing') {
      const letters = [...st.hint].filter((c) => c !== ' ' && c !== '-').length;
      hint = [h('small', `guess this · ${letters} letters`), h('span', st.hint)];
    } else if (st.phase === 'reveal') hint = [h('small', 'the word was'), h('span.known', st.results?.word || '…')];
    else if (st.phase === 'voting') {
      const left = st.maxVotes - st.myVotes.length;
      hint = [h('small', 'vote for the best drawings'), h('span.known', icon('heart'), ` ${left} left`)];
    } else hint = [h('small', ' '), h('span.known', icon('trophy'), ' Game over')];
    els.hint.replaceChildren(...hint);

    const timed = st.remaining > 0 && ['choosing', 'drawing', 'reveal', 'voting'].includes(st.phase);
    els.timer.hidden = !timed;
    deadline = timed ? performance.now() + st.remaining : 0;
    phaseMs = st.phaseMs || 1;
    els.timer.dataset.phase = st.phase;
  }

  function tick() {
    if (deadline) {
      const left = Math.max(0, deadline - performance.now());
      const secs = Math.ceil(left / 1000);
      els.timerText.textContent = secs;
      els.timer.style.setProperty('--p', (left / phaseMs).toFixed(3));
      const low = els.timer.dataset.phase === 'drawing' && secs <= 10 && secs > 0;
      els.timer.classList.toggle('low', low);
      if (low && secs !== lowPlayed) { lowPlayed = secs; onTick?.(secs); }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ---------- overlays ----------
  function renderOverlay(st) {
    const key = [st.phase, st.round, st.drawer, st.choices?.join(), st.results?.word, st.final?.length, st.me === st.host].join('|');
    if (key === overlayKey) return;
    overlayKey = key;
    const drawer = st.players.find((p) => p.id === st.drawer);
    let card = null;

    if (st.phase === 'choosing' && st.choices) {
      card = h('div.ov-card.card.tape',
        h('h2', 'Pick a word to draw'),
        h('div.word-choices', st.choices.map((w, i) =>
          h('button.btn.primary.big', { type: 'button', onclick: () => onChoose(i) }, w))),
        h('p.muted', 'Others will see blanks for each letter. Don’t write the word!'));
    } else if (st.phase === 'choosing') {
      card = h('div.ov-card.card',
        h('div.waiting-avatar.wiggle', av(drawer?.avatar, 96)),
        h('h2', `${drawer?.name || 'Someone'} is picking a word…`),
        h('p.muted', 'Get ready to guess in the chat!'));
    } else if (st.phase === 'reveal' && st.results) {
      const r = st.results;
      const [reasonIcon, reasonText] = REASONS[r.reason] || [];
      const rows = st.players
        .filter((p) => p.online || r.pts[p.id])
        .sort((a, b) => (r.pts[b.id] || 0) - (r.pts[a.id] || 0));
      card = h('div.ov-card.card',
        h('p.muted', reasonIcon && icon(reasonIcon), ' ', reasonText),
        h('h2', 'The word was'),
        h('div.big-word', h('span.marker', r.word || '???')),
        h('ul.gains', rows.map((p) => h('li',
          r.pts[p.id] ? h('span.plus', `+${r.pts[p.id]}`) : h('span.plus.zero', '+0'),
          av(p.avatar, 28), p.name, p.id === r.drawer ? icon('pencil') : ''))));
    }

    els.overlay.hidden = !card;
    els.overlay.replaceChildren(...(card ? [card] : []));
  }

  // ---------- reactions ----------
  function showReaction(name, i) {
    const el = h('div.float-emoji', { style: { left: `${8 + Math.random() * 78}%` } }, icon(REACTIONS[i]), h('span', name));
    els.reactionsLayer.append(el);
    setTimeout(() => el.remove(), 2500);
  }

  // Phone drawers don't see the chat, so the latest lines show in a small feed under the tools
  function showTicker(msg) {
    const named = msg.name ? `${msg.name}: ` : '';
    const el = h(`div.ticker.${msg.kind || 'msg'}`, `${named}${msg.text}`);
    els.drawerFeed.append(el);
    const notes = els.drawerFeed.querySelectorAll('.ticker');
    if (notes.length > 3) notes[0].remove();
    setTimeout(() => el.remove(), 5000);
  }

  return {
    render(st) {
      renderPlayers(st);
      renderTop(st);
      renderOverlay(st);
      els.reactBar.hidden = !(st.phase === 'drawing' && st.me !== st.drawer);
    },
    showReaction,
    showTicker,
    onLowTime(fn) { onTick = fn; },
    resetOverlay() { overlayKey = ''; },
  };
}
