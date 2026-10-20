// Chat doubles as the guess box. Message kinds map to styles in game.css.
import { h } from '../util.js';
import { icon } from '../icons.js';

const KIND_ICONS = {
  join: 'join', leave: 'door', start: 'sparkle', drawing: 'pencil', win: 'trophy',
  good: 'check', you: 'star', close: 'target', reveal: 'eye', warn: 'warn', guessed: 'check',
};

export function createChat({ log, form, input }, { onSend }) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (text) onSend(text);
    input.value = '';
  });

  return {
    add(m) {
      const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
      const named = (m.kind === 'msg' || m.kind === 'guessed') && m.name;
      const ic = KIND_ICONS[m.kind];
      log.append(h(`div.msg.${m.kind || 'msg'}`, ic && icon(ic), ic && ' ', named && [h('b', m.name), ' '], m.text));
      while (log.children.length > 150) log.firstChild.remove();
      if (nearBottom || m.kind === 'you' || m.kind === 'close') log.scrollTop = log.scrollHeight;
    },
    clear() {
      log.replaceChildren();
    },
    setMode(placeholder) {
      if (input.placeholder !== placeholder) input.placeholder = placeholder;
    },
    focus() {
      // Only on devices with a real keyboard; on phones it would pop up the keyboard
      if (matchMedia('(pointer: fine)').matches) input.focus({ preventScroll: true });
    },
  };
}
