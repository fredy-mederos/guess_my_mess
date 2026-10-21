// Lobby: invite link, game setup (host edits, everyone sees it live), start, hall of fame.
// Built once and updated in place, so the host never loses focus while typing.
import { h, debounce } from '../util.js';
import { avatarSvg } from '../avatar.js';
import { LANGUAGES, parseCustomWords } from '../words/index.js';
import { icon } from '../icons.js';
import { issueLink } from './issue-link.js';

const DIFFICULTY = { easy: 'Easy peasy', mixed: 'Mixed bag', medium: 'Medium', hard: 'Hard mode' };
const TIMES = [30, 45, 60, 80, 100, 120, 150, 180, 240];
const HINTS = ['Off', 'A few', 'Lots'];

const options = (pairs) => pairs.map(([v, label]) => h('option', { value: v }, label));

export function createLobby(root, { onSettings, onStart, onCopy, onResetHall }) {
  const f = {
    lang: h('select.select', options(Object.entries(LANGUAGES).map(([k, l]) => [k, l.label]))),
    difficulty: h('select.select', options(Object.entries(DIFFICULTY))),
    rounds: h('select.select', options([1, 2, 3, 4, 5, 6, 8, 10].map((n) => [n, `${n} round${n > 1 ? 's' : ''}`]))),
    // Short labels: the field names above already explain them, and the selects are narrow
    drawTime: h('select.select', options(TIMES.map((s) => [s, `${s} sec`]))),
    choices: h('select.select', options([1, 2, 3, 4, 5].map((n) => [n, n === 1 ? '1 word' : `${n} words`]))),
    hints: h('select.select', options(HINTS.map((l, i) => [i, l]))),
    closeHints: h('input', { type: 'checkbox' }),
    customWords: h('textarea.textarea', {
      rows: 3,
      maxLength: 4000,
      placeholder: 'Our own words, separated by commas: stand-up, rubber duck, deploy on friday…',
    }),
    customOnly: h('input', { type: 'checkbox' }),
  };
  const customCount = h('span.muted');
  // The room code at the end is what matters, so the middle of the address gets trimmed instead
  const linkStart = h('span.link-start');
  const linkEnd = h('span.link-end');
  const link = h('div.input.invite-link', { 'aria-label': 'Invite link (tap to copy)', onclick: () => onCopy() }, linkStart, linkEnd);
  // Kept as stable elements (not rebuilt per update) so clicks never land on a stale button
  const inviteNote = h('p.muted');
  const startBtn = h('button.btn.pink.big', { type: 'button', onclick: () => onStart() }, 'Start the game!');
  const startNote = h('p');
  const startArea = h('div.start-area', startBtn, startNote);
  const hallBody = h('tbody');
  const hallReset = h('button.link-btn', { type: 'button', onclick: () => onResetHall() }, 'reset');
  let isHost = false;

  function collect() {
    return {
      lang: f.lang.value,
      difficulty: f.difficulty.value,
      rounds: +f.rounds.value,
      drawTime: +f.drawTime.value,
      choices: +f.choices.value,
      hints: +f.hints.value,
      closeHints: f.closeHints.checked,
      customWords: f.customWords.value,
      customOnly: f.customOnly.checked,
    };
  }
  const send = () => { if (isHost) onSettings(collect()); };
  for (const [key, el] of Object.entries(f)) {
    if (key === 'customWords') el.addEventListener('input', debounce(send, 400));
    else el.addEventListener('change', send);
  }
  f.customWords.addEventListener('input', () => {
    customCount.textContent = `${parseCustomWords(f.customWords.value).length} custom words`;
  });

  const setting = (label, el, cls = '') => h(`label.setting${cls}`, h('span', label), el);

  root.replaceChildren(
    h('section.card.tape',
      h('h3', h('span.marker', 'Invite your team')),
      h('div.invite-row', link, h('button.btn.primary.small', { type: 'button', title: 'Copy the invite link', onclick: () => onCopy() }, icon('link'), 'Copy link')),
      inviteNote,
      startArea,
    ),
    h('section.card',
      h('h3', h('span.marker', 'Game setup')),
      h('div.settings-grid',
        setting('Word pack', f.lang),
        setting('Difficulty', f.difficulty),
        setting('Game length', f.rounds),
        setting('Drawing time', f.drawTime),
        setting('Word choices', f.choices),
        setting('Letter hints', f.hints),
        h('label.check.setting.full', f.closeHints, 'Tell people when a guess is close'),
        setting('Custom words', f.customWords, '.full'),
        h('div.setting.full', h('label.check', f.customOnly, 'Only use our custom words'), customCount),
      ),
    ),
    h('section.card.hall.wide',
      h('h3', h('span.marker', 'Hall of fame'), ' ', hallReset),
      h('table', h('thead', h('tr', h('th', '#'), h('th', 'Player'), h('th.num', { title: 'Games won on points' }, icon('trophy'), ' Wins'),
        h('th.num', { title: 'Best-drawing awards' }, icon('heart'), ' Art'), h('th.num', 'Games'), h('th.num', 'Points'), h('th.num', 'Best'))), hallBody),
      h('p.muted', 'Kept on the host’s device, across games and rooms.'),
    ),
    h('div.lobby-foot.wide', h('span.muted', 'Found a bug or have an idea?'), issueLink()),
  );

  return {
    update(st, { host, inviteLink }) {
      isHost = host;
      const [base, room] = inviteLink.split('#');
      linkStart.textContent = base.replace(/^https?:\/\//, '');
      linkEnd.textContent = room ? `#${room}` : '';
      link.title = inviteLink;
      // Phones pause a page in the background, and a paused host can't let anyone in
      inviteNote.textContent = host
        ? 'Keep this page open while people join. On a phone, switching to another app can pause the room.'
        : 'Anyone with this link can join while the host keeps this room open.';
      for (const [key, el] of Object.entries(f)) {
        el.disabled = !host;
        if (document.activeElement === el) continue; // don't fight the host's typing
        if (el.type === 'checkbox') el.checked = !!st.settings[key];
        else el.value = String(st.settings[key]);
      }
      customCount.textContent = `${parseCustomWords(st.settings.customWords).length} custom words`;
      hallReset.hidden = !host || !st.hall.length;

      const onlineCount = st.players.filter((p) => p.online).length;
      const hostName = st.players.find((p) => p.id === st.host)?.name || 'the host';
      startBtn.hidden = !host;
      startBtn.disabled = onlineCount < 2;
      startNote.replaceChildren(...(!host ? [h('span.wiggle', { style: { display: 'inline-block' } }, icon('pencil')), ` Waiting for ${hostName} to start…`]
        : [onlineCount < 2 ? 'Waiting for at least one more player…' : `${onlineCount} players ready`]));

      hallBody.replaceChildren(...(st.hall.length
        ? st.hall.map((r, i) => h('tr',
          h('td', i + 1),
          h('td', h('span.who', h('span', { html: avatarSvg(r.avatar, 28) }), r.name)),
          h('td.num', r.wins), h('td.num', r.art || 0), h('td.num', r.games), h('td.num', r.points), h('td.num', r.best)))
        : [h('tr', h('td.muted', { colSpan: 7 }, 'No games yet. Be the first legend!'))]));
    },
  };
}
