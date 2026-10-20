// The character creator (avatar preview, part pickers, dice, name) — used on the home screen
// and, as a pop-up, to change your look in the middle of a room.
import { h } from '../util.js';
import { PARTS, avatarSvg, randomAvatar, sanitizeAvatar } from '../avatar.js';
import { icon } from '../icons.js';

const PART_LABELS = { c: 'Color', e: 'Eyes', m: 'Mouth', h: 'Hat' };

// onChange (optional) fires on every tweak, so a half-designed character isn't lost on a reload
export function characterEditor({ avatar, name, onEnter, onChange }) {
  const state = sanitizeAvatar(avatar || randomAvatar());
  const preview = h('div.big-avatar.wiggle');
  const updaters = [];
  const profile = () => ({ name: nameInput.value.trim().slice(0, 18), avatar: { ...state } });

  const nameInput = h('input.input', {
    placeholder: 'Your name',
    maxLength: 18,
    value: name || '',
    'aria-label': 'Your name',
    onkeydown: (e) => { if (e.key === 'Enter') onEnter?.(); },
    oninput: () => onChange?.(profile()),
  });

  function update(changed = true) {
    preview.innerHTML = avatarSvg(state, 150);
    updaters.forEach((fn) => fn());
    if (changed) onChange?.(profile());
  }

  function part(key) {
    const list = PARTS[key];
    const value = h('span');
    updaters.push(() => {
      value.textContent = key === 'c' ? `${state.c + 1} / ${list.length}` : list[state[key]][0];
    });
    const step = (d) => {
      state[key] = (state[key] + d + list.length) % list.length;
      update();
    };
    return h('div.part',
      h('button.arrow', { type: 'button', onclick: () => step(-1), 'aria-label': `Previous ${PART_LABELS[key]}` }, '‹'),
      h('div', h('b', PART_LABELS[key]), value),
      h('button.arrow', { type: 'button', onclick: () => step(1), 'aria-label': `Next ${PART_LABELS[key]}` }, '›'));
  }

  const dice = h('button.arrow.dice', {
    type: 'button',
    title: 'Surprise me',
    'aria-label': 'Random character',
    onclick: () => { Object.assign(state, randomAvatar()); update(); },
  }, icon('dice'));

  // Build the pickers first: they register the labels that update() fills in
  const nodes = [h('div.avatar-stage', h('span'), preview, dice), h('div.part-grid', part('c'), part('e'), part('m'), part('h')), nameInput];
  update(false);
  return { nodes, nameInput, profile };
}

// In-room pop-up: change your name/look without leaving the game
export function openCharacterEditor({ profile, onSave }) {
  const editor = characterEditor({ avatar: profile.avatar, name: profile.name, onEnter: save });
  const dialog = h('div.modal', {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Edit your character',
    onclick: (e) => { if (e.target === dialog) close(); },
  }, h('div.card.tape.creator.modal-card',
    h('h2', 'Edit your character'),
    editor.nodes,
    h('div.modal-actions',
      h('button.btn', { type: 'button', onclick: close }, 'Cancel'),
      h('button.btn.primary', { type: 'button', onclick: save }, icon('check'), 'Save'))));

  function save() {
    const p = editor.profile();
    onSave({ name: p.name || profile.name, avatar: p.avatar });
    close();
  }
  function close() {
    dialog.remove();
    removeEventListener('keydown', onKey);
  }
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  addEventListener('keydown', onKey);
  document.body.append(dialog);
}
