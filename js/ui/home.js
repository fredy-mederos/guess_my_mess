// Home screen: build your character, then create a room or join the one in the link.
import { h, store } from '../util.js';
import { icon } from '../icons.js';
import { characterEditor } from './character.js';

// Your character lives in this browser (localStorage), so the next game starts with it
function remember({ name, avatar }) {
  store.set('gmm:name', name);
  store.set('gmm:avatar', avatar);
  // Ask the browser not to clear our storage under pressure (Chrome/Android honour this)
  navigator.storage?.persist?.().catch(() => {});
}

export function renderHome(root, { room, error, busy, onGo }) {
  const savedName = store.get('gmm:name', '');
  const editor = characterEditor({
    avatar: store.get('gmm:avatar'),
    name: savedName,
    onEnter: () => go(!room),
    onChange: remember,
  });

  function go(create) {
    const profile = editor.profile();
    remember(profile);
    onGo({ create, profile: { name: profile.name || 'Mystery Doodler', avatar: profile.avatar } });
  }

  const title = room
    ? (savedName ? `You’re invited, ${savedName}!` : 'You’re invited! Who are you?')
    : (savedName ? `Welcome back, ${savedName}!` : 'Make your doodle');

  root.replaceChildren(h('div.home-inner',
    h('h1.logo', 'Guess My Mess', h('small', 'draw it badly · guess it fast')),
    h('div.card.creator.tape',
      h('h2', title),
      editor.nodes,
      error && h('div.home-error', error),
      h('div.creator-actions',
        room
          ? [
            h('button.btn.primary.big', { type: 'button', disabled: busy, onclick: () => go(false) }, busy ? 'Joining…' : ['Join the room', icon('pencil')]),
            h('button.link-btn', { type: 'button', onclick: () => go(true) }, 'or start a new room instead'),
          ]
          : h('button.btn.primary.big', { type: 'button', disabled: busy, onclick: () => go(true) }, busy ? 'Opening…' : ['Create a room', icon('pencil')])),
    ),
    h('p.home-foot', 'No sign-up · peer-to-peer · private link'),
  ));
  if (!busy) setTimeout(() => editor.nameInput.focus({ preventScroll: true }), 50);
}
