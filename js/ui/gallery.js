// End of game: a gallery of every drawing to hand out hearts, then the results with two
// awards: most points (podium) and best drawing (most hearts), plus all drawings with counts.
import { h, $$ } from '../util.js';
import { avatarSvg } from '../avatar.js';
import { icon, medal } from '../icons.js';
import { renderDrawing } from '../board.js';

const av = (a, size) => h('span', { html: avatarSvg(a, size) });
const byLine = (d) => [av(d.avatar, 26), h('span.by', d.name), h('span.word', `“${d.word}”`)];
// The image may still be rendering; it's filled in by data-drawing id once ready
const pic = (d) => h('img', { src: d.url || '', alt: `${d.name}'s drawing of ${d.word}`, dataset: { drawing: d.id } });

export function createGallery(els, { onVote, onDone, onShowResults, onPlayAgain, onLobby }) {
  const drawings = new Map();       // id -> { id, drawer, name, avatar, word, ops, bg, url }
  let voteKey = '';
  let resultsKey = '';
  const cards = new Map();          // id -> vote card element

  // ---------- voting ----------
  const voteStatus = h('p.vote-status');
  const doneBtn = h('button.btn.primary', { type: 'button', onclick: () => onDone() }, icon('check'), 'Done voting');
  const showBtn = h('button.btn', { type: 'button', onclick: () => onShowResults() }, 'Show results now');
  const voteGrid = h('div.gallery-grid');
  els.vote.replaceChildren(
    h('div.card.tape.vote-head',
      h('h3', h('span.marker', 'Vote for the best drawings')),
      h('p.muted', 'Tap the ones you love to give them a heart. Your own drawings don’t count.'),
      h('div.vote-actions', voteStatus, doneBtn, showBtn)),
    voteGrid);

  function renderVoting(st) {
    const list = [...drawings.values()];
    const key = list.map((d) => d.id).join();
    if (key !== voteKey) {
      voteKey = key;
      cards.clear();
      voteGrid.replaceChildren(...list.map((d) => {
        const card = h('button.gallery-card.vote-card', { type: 'button', onclick: () => onVote(d.id) },
          pic(d),
          h('span.caption', byLine(d)),
          h('span.heart', icon('heart')),
          h('span.yours', 'yours'));
        cards.set(d.id, card);
        return card;
      }));
    }
    const mine = new Set(st.myVotes);
    const left = st.maxVotes - mine.size;
    for (const [id, card] of cards) {
      const own = drawings.get(id).drawer === st.me;
      card.classList.toggle('own', own);
      card.classList.toggle('voted', mine.has(id));
      card.disabled = own;
    }
    const me = st.players.find((p) => p.id === st.me);
    const here = st.players.filter((p) => p.online);
    const doneCount = here.filter((p) => p.voted).length;
    const hearts = st.maxVotes === 1 ? 'heart' : 'hearts';
    voteStatus.replaceChildren(icon('heart'), ` ${left} of ${st.maxVotes} ${hearts} left · ${doneCount}/${here.length} done`);
    doneBtn.hidden = !!me?.voted;
    showBtn.hidden = st.me !== st.host;
  }

  // ---------- results ----------
  function podium(st) {
    const [p1, p2, p3, ...rest] = st.final;
    const step = (p, cls, place) => p && h(`div.step.${cls}`,
      av(p.avatar, cls === 'p1' ? 76 : 58),
      h('span.name', p.name),
      h('div.block', medal(place), h('small', p.score)));
    return [
      h('div.podium', step(p2, 'p2', 2), step(p1, 'p1', 1), step(p3, 'p3', 3)),
      rest.length ? h('ol.rest', { start: 4 }, rest.map((p) => h('li', `${p.name} · ${p.score}`))) : null,
    ];
  }

  function bestDrawings(st) {
    const best = st.best.map((id) => drawings.get(id)).filter(Boolean);
    if (!best.length) return h('p.muted', 'No hearts were given this time.');
    return h('div.best-list', best.map((d) => h('figure.best-pic',
      pic(d),
      h('figcaption',
        h('span.caption', byLine(d)),
        h('span.hearts', icon('heart'), ` ${st.tally[d.id] || 0}`),
        h('button.btn.small', { type: 'button', onclick: () => save(d) }, icon('download'), 'Save')))));
  }

  // Full-size PNG, rendered on this device from the strokes
  function save(d) {
    if (!d.url) return;
    const a = h('a', { href: d.url, download: `${d.word.replace(/[^\p{L}\p{N}]+/gu, '-')}-by-${d.name}.png` });
    document.body.append(a);
    a.click();
    a.remove();
  }

  // Fun stats as a wall of sticky notes
  function statNotes(st) {
    return h('div.stats-grid', st.stats.map((s) => h('div.stat-note',
      h('span.stat-head', icon(s.icon), ' ', s.title),
      h('strong.stat-who', s.who),
      h('span.stat-detail', s.detail))));
  }

  function renderResults(st) {
    const key = [st.final?.map((p) => p.id + p.score).join(), st.best.join(), st.stats.length, drawings.size, st.me === st.host].join('|');
    if (key === resultsKey) return;
    resultsKey = key;
    const top = st.final?.[0];
    const amHost = st.me === st.host;
    const all = [...drawings.values()];
    els.results.replaceChildren(
      h('h2.results-title', top?.winner ? [`${top.name} wins! `, icon('trophy')] : 'Game over!'),
      h('section.card.tape.award',
        h('h3', icon('trophy'), ' ', h('span.marker', 'Most points')),
        podium(st)),
      h('section.card.award',
        h('h3', icon('heart'), ' ', h('span.marker', 'Best drawing')),
        bestDrawings(st)),
      st.stats.length ? h('section.card.award',
        h('h3', icon('sparkle'), ' ', h('span.marker', 'Fun stats')),
        statNotes(st)) : null,
      all.length ? h('section.card.award',
        h('h3', h('span.marker', 'All drawings')),
        h('div.gallery-grid.small', all.map((d) => h('figure.gallery-card',
          pic(d),
          h('figcaption.caption', byLine(d), h('span.hearts', icon('heart'), ` ${st.tally[d.id] || 0}`)))))) : null,
      h('div.results-actions', amHost
        ? [h('button.btn.pink.big', { type: 'button', onclick: onPlayAgain }, 'Play again'),
          h('button.btn', { type: 'button', onclick: onLobby }, 'Change setup')]
        : h('p.muted', 'Waiting for the host to start another game…')),
    );
    els.results.scrollTop = 0;
    els.results.append(confetti());
  }

  function confetti() {
    const c = h('canvas.confetti');
    const ctx = c.getContext('2d');
    const colors = ['#ffd43b', '#ff8fab', '#74c0fc', '#8ce99a', '#b197fc', '#ffa94d'];
    const bits = Array.from({ length: 150 }, () => ({
      x: Math.random(), y: -Math.random() * 0.6, vy: 0.003 + Math.random() * 0.004,
      vx: (Math.random() - 0.5) * 0.002, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3,
      c: colors[Math.floor(Math.random() * colors.length)], s: 6 + Math.random() * 6,
    }));
    const start = performance.now();
    (function frame(t) {
      if (!c.isConnected && t - start > 100) return;
      c.width = c.clientWidth;
      c.height = c.clientHeight;
      for (const b of bits) {
        b.x += b.vx; b.y += b.vy; b.r += b.vr;
        ctx.save();
        ctx.translate(b.x * c.width, b.y * c.height);
        ctx.rotate(b.r);
        ctx.fillStyle = b.c;
        ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2);
        ctx.restore();
      }
      if (t - start < 6000) requestAnimationFrame(frame);
      else c.remove();
    })(start);
    return c;
  }

  return {
    // d carries the strokes (ops + bg); turn them into an image once, off the critical path
    add(d) {
      if (drawings.get(d.id)?.ops?.length) return; // already have it (e.g. after a reconnect)
      drawings.set(d.id, d);
      renderDrawing(d.ops || [], d.bg).then((url) => {
        if (drawings.get(d.id) !== d) return URL.revokeObjectURL(url);
        d.url = url;
        $$(`img[data-drawing="${d.id}"]`).forEach((img) => { img.src = url; });
      });
    },
    reset() {
      for (const d of drawings.values()) if (d.url) URL.revokeObjectURL(d.url);
      drawings.clear();
      voteKey = '';
      resultsKey = '';
    },
    renderVoting,
    renderResults,
  };
}
