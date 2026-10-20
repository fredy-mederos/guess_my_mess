// Tiny synthesized sound effects, no audio files needed.
import { store } from './util.js';

let ctx = null;
let muted = store.get('gmm:muted', false);

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Browsers only allow audio after a user gesture, so unlock on the first tap
addEventListener('pointerdown', () => audio(), { once: true });

function tone(freq, start, dur, { type = 'triangle', gain = 0.12, slide = 0 } = {}) {
  const ac = audio();
  if (!ac || muted) return;
  const t = ac.currentTime + start;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export const sfx = {
  join: () => { tone(660, 0, 0.12); tone(880, 0.08, 0.15); },
  leave: () => { tone(500, 0, 0.15, { slide: 0.6 }); },
  turn: () => { tone(523, 0, 0.12); tone(659, 0.1, 0.12); tone(784, 0.2, 0.2); },
  correct: () => { tone(784, 0, 0.1); tone(1047, 0.09, 0.22, { gain: 0.14 }); },
  mine: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.22, { gain: 0.14 })); },
  close: () => { tone(440, 0, 0.1, { type: 'sine' }); tone(470, 0.1, 0.12, { type: 'sine' }); },
  tick: (s) => { tone(s <= 3 ? 1200 : 900, 0, 0.05, { type: 'square', gain: 0.04 }); },
  reveal: () => { tone(392, 0, 0.18); tone(330, 0.15, 0.25, { slide: 0.9 }); },
  win: () => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.25, { gain: 0.13 })); },
  pop: () => { tone(900, 0, 0.06, { type: 'sine', gain: 0.06, slide: 1.5 }); },
  get muted() { return muted; },
  toggle() {
    muted = !muted;
    store.set('gmm:muted', muted);
    return muted;
  },
};
