// Boot + glue: picks host or guest mode, wires the network to the engine (host) and
// the UI, and keeps the layout fitted to the screen (including phone keyboards).
import { $, h, store, clientId, randomId, copyText, debounce } from './util.js';
import { hostRoom, joinRoom } from './net.js';
import { createEngine } from './engine.js';
import { createBoard } from './board.js';
import { createToolbar } from './toolbar.js';
import { renderHome } from './ui/home.js';
import { createLobby } from './ui/lobby.js';
import { createGameUI } from './ui/game.js';
import { createChat } from './ui/chat.js';
import { createGallery } from './ui/gallery.js';
import { openCharacterEditor } from './ui/character.js';
import { avatarSvg } from './avatar.js';
import { sfx } from './sound.js';
import { icon, hydrateIcons } from './icons.js';

hydrateIcons();
// No zooming on phones: iOS Safari ignores user-scalable=no, so cancel its pinch gestures too
for (const type of ['gesturestart', 'gesturechange']) document.addEventListener(type, (e) => e.preventDefault());
const cid = clientId();
const isPhone = () => matchMedia('(max-width: 759px)').matches;
const roomEl = $('#room');
let room = new URLSearchParams(location.hash.slice(1)).get('room');
let st = null;            // latest state from the host
let send = () => {};      // sends a message to the engine (wherever it runs)
let net = null;
let engine = null;
let isHosting = false;
let prevPhase = null;
let prevDrawer = null;
let myProfile = null;     // { name, avatar }; also what a reconnect re-sends

// ---------- theme & sound ----------
const savedTheme = store.get('gmm:theme');
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
$('#themeBtn').onclick = () => {
  const dark = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'light' : 'dark';
  store.set('gmm:theme', dark ? 'light' : 'dark');
};
const soundBtn = $('#soundBtn');
const showSound = (muted) => soundBtn.replaceChildren(icon(muted ? 'soundOff' : 'soundOn'));
showSound(sfx.muted);
soundBtn.onclick = () => showSound(sfx.toggle());

let toastTimer;
function toast(text, ms = 2200) {
  const t = $('#toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  if (ms) toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

// ---------- UI pieces ----------
const board = createBoard($('#board'), { onEmit: (msg) => send({ t: 'd', ...msg }) });
const toolbar = createToolbar($('#toolbar'), board);
const chat = createChat({ log: $('#chatLog'), form: $('#chatForm'), input: $('#chatInput') }, {
  onSend: (text) => send({ t: 'chat', text }),
});
const inviteLink = () => `${location.origin}${location.pathname}#room=${room}`;
const lobby = createLobby($('#lobby'), {
  onSettings: (settings) => send({ t: 'settings', settings }),
  onStart: () => send({ t: 'start' }),
  onCopy: async (input) => {
    const ok = await copyText(inviteLink(), input);
    toast(ok ? 'Link copied! Paste it in your team chat' : 'Copy the link from the box');
  },
  onResetHall: () => { if (confirm('Reset the hall of fame on this device?')) engine?.resetHall(); },
});
const game = createGameUI({
  players: $('#players'), roundInfo: $('#roundInfo'), hint: $('#hint'), timer: $('#timer'),
  timerText: $('#timerText'), overlay: $('#overlay'), reactionsLayer: $('#reactionsLayer'), reactBar: $('#reactBar'),
  drawerFeed: $('#drawerFeed'),
}, {
  onChoose: (i) => send({ t: 'choose', i }),
  onReact: (e) => send({ t: 'react', e }),
  onKick: (p) => { if (confirm(`Remove ${p.name} from the room?`)) send({ t: 'kick', id: p.id }); },
});
game.onLowTime((s) => sfx.tick(s));
const gallery = createGallery({ vote: $('#vote'), results: $('#results') }, {
  onVote: (id) => send({ t: 'vote', id }),
  onDone: () => send({ t: 'voted' }),
  onShowResults: () => send({ t: 'results' }),
  onPlayAgain: () => send({ t: 'start' }),
  onLobby: () => send({ t: 'lobby' }),
});

const skipBtn = h('button.icon-btn', { type: 'button', title: 'Skip this turn', 'aria-label': 'Skip this turn', hidden: true, onclick: () => send({ t: 'skip' }) }, icon('skip'));
$('.top-actions').prepend(skipBtn);

// Your own avatar in the top bar: tap it to change your look or name without leaving
const meBtn = $('#meBtn');
meBtn.onclick = () => {
  if (!myProfile) return;
  openCharacterEditor({
    profile: myProfile,
    onSave: (p) => {
      Object.assign(myProfile, p);
      store.set('gmm:name', p.name);
      store.set('gmm:avatar', p.avatar);
      send({ t: 'profile', ...p });
    },
  });
};

// ---------- incoming messages ----------
function onMessage(msg) {
  switch (msg.t) {
    case 'welcome': enterRoom(); break;
    case 'state': st = msg; render(); break;
    case 'canvas': board.reset(msg.bg); break;
    case 'd': board.apply(msg); break;
    case 'chatlog': chat.clear(); msg.list.forEach(chat.add); break;
    case 'chat':
      chat.add(msg);
      if (roomEl.classList.contains('drawer-mode') && isPhone() && msg.kind !== 'reveal') game.showTicker(msg);
      ({ good: sfx.correct, you: sfx.mine, close: sfx.close, join: sfx.join, leave: sfx.leave }[msg.kind])?.();
      break;
    case 'react': {
      const p = st?.players.find((x) => x.id === msg.from);
      game.showReaction(p?.name || '', msg.e);
      sfx.pop();
      break;
    }
    case 'drawing':
      // At the end of a turn only the label arrives: the strokes are already on this board
      gallery.add(msg.d.ops ? msg.d : { ...msg.d, ...board.exportDrawing() });
      if (st?.phase === 'voting') gallery.renderVoting(st);
      break;
    case 'gallery': if (msg.reset) gallery.reset(); break;
    case 'kicked': backHome('The host removed you from the room.'); break;
    case 'full': backHome('This room is full (16 players max).'); break;
  }
}

function render() {
  const amDrawer = st.phase === 'drawing' && st.me === st.drawer;
  const me = st.players.find((p) => p.id === st.me);
  // One stage, four views: lobby, the board, the voting gallery, the results
  const view = { lobby: 'lobby', voting: 'vote', podium: 'results' }[st.phase] || 'play';
  for (const v of ['lobby', 'play', 'vote', 'results']) $(`#${v}`).hidden = v !== view;
  roomEl.classList.toggle('in-panel', view !== 'play');
  roomEl.classList.toggle('in-game', view === 'play');
  lobby.update(st, { host: st.me === st.host, inviteLink: inviteLink() });
  game.render(st);
  if (view === 'vote') gallery.renderVoting(st);
  if (view === 'results') gallery.renderResults(st);
  if (me) meBtn.innerHTML = avatarSvg(me.avatar, 34);

  if (st.drawer !== prevDrawer && st.me === st.drawer) toolbar.reset();
  board.setInteractive(amDrawer);
  $('#toolbar').hidden = !amDrawer;
  // On phones the drawer gets the whole screen: chat hides, every tool shows inline (CSS)
  roomEl.classList.toggle('drawer-mode', amDrawer);
  skipBtn.hidden = !(st.me === st.host && (st.phase === 'drawing' || st.phase === 'choosing'));

  chat.setMode(st.phase !== 'drawing' ? (st.phase === 'lobby' ? 'Say hi to the team…' : 'Chat…')
    : amDrawer ? 'Chat (no spoilers!)'
      : me?.guessed ? 'Chat with the others who got it'
        : 'Type your guess…');

  if (st.phase !== prevPhase) {
    if (st.phase === 'choosing' && st.me === st.drawer) sfx.turn();
    if (st.phase === 'drawing' && !amDrawer) chat.focus();
    if (st.phase === 'reveal') sfx.reveal();
    if (st.phase === 'voting') sfx.turn();
    if (st.phase === 'podium') sfx.win();
  }
  prevPhase = st.phase;
  prevDrawer = st.drawer;
  fitLayout();
}

// ---------- layout ----------
// The board keeps a 4:3 shape and takes as much room as the stage allows. On phones the
// stage gets a computed height so the chat (and the keyboard) still fit underneath.
function fitLayout() {
  if (roomEl.hidden) return;
  const stage = $('#stage');
  const toolbarEl = $('#toolbar');
  const toolbarH = toolbarEl.hidden ? 0 : toolbarEl.offsetHeight + 12;
  if (isPhone() && roomEl.classList.contains('in-game')) {
    const drawerMode = roomEl.classList.contains('drawer-mode');
    const chatSpace = drawerMode ? 0 : 120 + 8;
    const used = $('.topbar').offsetHeight + $('#players').offsetHeight + 16 + 16 + chatSpace;
    const avail = roomEl.clientHeight - used;
    const want = stage.clientWidth * 0.75 + toolbarH;
    roomEl.style.setProperty('--stage-h', `${Math.max(160, Math.min(want, avail))}px`);
  }
  const w = stage.clientWidth;
  const hAvail = stage.clientHeight - toolbarH;
  const boardW = Math.max(200, Math.min(w, (hAvail * 4) / 3));
  $('#play').style.setProperty('--board-w', `${Math.floor(boardW)}px`);
}

function syncViewport() {
  const vv = window.visualViewport;
  document.documentElement.style.setProperty('--app-h', `${vv ? vv.height : innerHeight}px`);
  $('#app').style.transform = vv?.offsetTop ? `translateY(${vv.offsetTop}px)` : '';
  fitLayout();
}
const refit = debounce(syncViewport, 30);
addEventListener('resize', refit);
visualViewport?.addEventListener('resize', refit);
visualViewport?.addEventListener('scroll', refit);
new ResizeObserver(refit).observe(roomEl);
syncViewport();

// ---------- screens ----------
function showHome(opts = {}) {
  $('#home').hidden = false;
  roomEl.hidden = true;
  renderHome($('#home'), { room, ...opts, onGo: ({ create, profile }) => (create ? createRoom(profile) : joinExisting(profile)) });
}

function enterRoom() {
  $('#home').hidden = true;
  roomEl.hidden = false;
  requestAnimationFrame(fitLayout);
}

function backHome(error) {
  net?.close();
  engine?.destroy();
  net = engine = null;
  isHosting = false;
  store.del('gmm:joined', sessionStorage);
  store.del('gmm:hosting', sessionStorage);
  room = null;
  history.replaceState(null, '', location.pathname);
  st = null;
  myProfile = null;
  chat.clear();
  gallery.reset();
  showHome({ error });
}

// ---------- hosting ----------
function createRoom(profile) {
  room = randomId(12);
  history.replaceState(null, '', `#room=${room}`);
  startHost(profile, null);
}

function startHost(profile, saved) {
  isHosting = true;
  myProfile = profile;
  store.set('gmm:hosting', room, sessionStorage);
  showHome({ busy: true });
  const deliverLocal = (msg) => queueMicrotask(() => onMessage(structuredClone(msg)));
  // Session storage is ~5 MB; if a long game's drawings don't fit, keep everything else
  const saveState = (S) => store.set(`gmm:state:${room}`, S, sessionStorage)
    || store.set(`gmm:state:${room}`, { ...S, gallery: [] }, sessionStorage);
  const save = debounce(saveState, 1000);
  engine = createEngine({
    hostId: cid,
    saved,
    hall: store.get('gmm:hall', {}),
    recent: store.get('gmm:recent', []),
    onRecent: (recent) => store.set('gmm:recent', recent),
    sendTo: (pid, msg) => (pid === cid ? deliverLocal(msg) : net?.sendTo(pid, msg)),
    kick: (pid) => net?.kick(pid),
    onSave: save,
    onHall: (hall) => store.set('gmm:hall', hall),
  });
  send = (msg) => queueMicrotask(() => engine?.handle(cid, structuredClone(msg)));
  net = hostRoom(room, {
    onReady: () => send({ t: 'hello', ...profile }),
    onJoin: () => {},
    onMessage: (pid, msg) => engine?.handle(pid, msg),
    onLeave: (pid) => engine?.leave(pid),
    onError: (type) => {
      if (type === 'unavailable-id') return backHome('Couldn’t open that room. Please try again.');
      toast('Matchmaking server hiccup, retrying…', 3000);
    },
  });
  addEventListener('pagehide', () => engine && saveState(engine.snapshot()));
}

// ---------- joining ----------
function joinExisting(profile) {
  isHosting = false;
  myProfile = profile;
  store.set('gmm:joined', room, sessionStorage);
  showHome({ busy: true });
  send = (msg) => net?.send(msg);
  net = joinRoom(room, cid, {
    onOpen: () => send({ t: 'hello', ...profile }),
    onMessage,
    onStatus: (s) => {
      if (s === 'reconnecting') toast('Connection lost, reconnecting…', 0);
      if (s === 'connected') $('#toast').hidden = true;
    },
    onFail: (reason) => backHome({
      notfound: 'That room doesn’t exist anymore. The host may have closed it.',
      timeout: 'Couldn’t reach the host. A network or VPN may be blocking peer-to-peer connections.',
      lost: 'Lost the connection to the host.',
    }[reason] || `Connection problem (${reason}). Please try again.`),
  });
}

// ---------- leaving ----------
$('#leaveBtn').onclick = () => {
  const others = st?.players.filter((p) => p.online && p.id !== cid).length;
  if (!confirm(isHosting && others ? 'You’re the host. Leaving closes the room for everyone. Leave?' : 'Leave the room?')) return;
  store.del('gmm:hosting', sessionStorage);
  store.del(`gmm:state:${room}`, sessionStorage);
  backHome();
};
addEventListener('beforeunload', (e) => {
  if (isHosting && st && st.phase !== 'lobby' && st.players.some((p) => p.online && p.id !== cid)) e.preventDefault();
});
addEventListener('hashchange', () => location.reload());

// ---------- boot ----------
// A reload drops you straight back in: hosts re-open their room, guests rejoin with their score
const profile = { name: store.get('gmm:name', '') || 'Mystery Doodler', avatar: store.get('gmm:avatar') };
if (room && store.get('gmm:hosting', null, sessionStorage) === room) {
  startHost(profile, store.get(`gmm:state:${room}`, null, sessionStorage));
} else if (room && store.get('gmm:joined', null, sessionStorage) === room && profile.avatar) {
  joinExisting(profile);
} else {
  showHome();
}
