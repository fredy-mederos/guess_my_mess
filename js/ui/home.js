// Home screen: build your character, then create a room or join the one in the link.
import { h, store } from '../util.js';
import { icon } from '../icons.js';
import { characterEditor } from './character.js';

export function renderHome(root, { room, error, busy, onGo }) {
  const editor = characterEditor({
    avatar: store.get('gmm:avatar'),
    name: store.get('gmm:name', ''),
    onEnter: () => go(!room),
  });

  function go(create) {
    const { name, avatar } = editor.profile();
    store.set('gmm:name', name);
    store.set('gmm:avatar', avatar);
    onGo({ create, profile: { name: name || 'Mystery Doodler', avatar } });
  }

  root.replaceChildren(h('div.home-inner',
    h('h1.logo', 'Guess My Mess', h('small', 'draw it badly · guess it fast')),
    h('div.card.creator.tape',
      h('h2', room ? 'You’re invited! Who are you?' : 'Make your doodle'),
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
