// Home screen: build your character, then create a room or join the one in the link.
import { h, store } from '../util.js';
import { PARTS, avatarSvg, randomAvatar, sanitizeAvatar } from '../avatar.js';
import { icon } from '../icons.js';

const PART_LABELS = { c: 'Color', e: 'Eyes', m: 'Mouth', h: 'Hat' };

export function renderHome(root, { room, error, busy, onGo }) {
  const avatar = sanitizeAvatar(store.get('gmm:avatar') || randomAvatar());
  const preview = h('div.big-avatar.wiggle');
  const updaters = [];

  const name = h('input.input', {
    placeholder: 'Your name',
    maxLength: 18,
    value: store.get('gmm:name', ''),
    'aria-label': 'Your name',
    onkeydown: (e) => { if (e.key === 'Enter') go(!room); },
  });

  function update() {
    preview.innerHTML = avatarSvg(avatar, 150);
    updaters.forEach((fn) => fn());
  }

  function part(key) {
    const list = PARTS[key];
    const value = h('span');
    updaters.push(() => {
      value.textContent = key === 'c' ? `${avatar.c + 1} / ${list.length}` : list[avatar[key]][0];
    });
    const step = (d) => {
      avatar[key] = (avatar[key] + d + list.length) % list.length;
      update();
    };
    return h('div.part',
      h('button.arrow', { type: 'button', onclick: () => step(-1), 'aria-label': `Previous ${PART_LABELS[key]}` }, '‹'),
      h('div', h('b', PART_LABELS[key]), value),
      h('button.arrow', { type: 'button', onclick: () => step(1), 'aria-label': `Next ${PART_LABELS[key]}` }, '›'));
  }

  function go(create) {
    const profile = { name: name.value.trim().slice(0, 18) || 'Mystery Doodler', avatar: { ...avatar } };
    store.set('gmm:name', name.value.trim());
    store.set('gmm:avatar', avatar);
    onGo({ create, profile });
  }

  const dice = h('button.arrow', {
    type: 'button',
    title: 'Surprise me',
    'aria-label': 'Random character',
    style: { width: '46px', height: '46px', fontSize: '1.4rem' },
    onclick: () => { Object.assign(avatar, randomAvatar()); update(); },
  }, icon('dice'));

  root.replaceChildren(h('div.home-inner',
    h('h1.logo', 'Guess My Mess', h('small', 'draw it badly · guess it fast')),
    h('div.card.creator.tape',
      h('h2', room ? 'You’re invited! Who are you?' : 'Make your doodle'),
      h('div.avatar-stage', h('span'), preview, dice),
      h('div.part-grid', part('c'), part('e'), part('m'), part('h')),
      name,
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
  update();
  if (!busy) setTimeout(() => name.focus({ preventScroll: true }), 50);
}
