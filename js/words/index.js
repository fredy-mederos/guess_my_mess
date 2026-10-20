// Word bank: built-in curated lists per language, plus the host's own custom words.
// To add a language, drop a file next to these and register it here.
import en from './en.js';
import es from './es.js';
import de from './de.js';
import pt from './pt.js';
import fr from './fr.js';
import { shuffle, normalize } from '../util.js';

export const LANGUAGES = {
  en: { label: 'English', words: en },
  es: { label: 'Español', words: es },
  de: { label: 'Deutsch', words: de },
  pt: { label: 'Português', words: pt },
  fr: { label: 'Français', words: fr },
};

export const DIFFICULTIES = {
  easy: ['easy'],
  mixed: ['easy', 'medium', 'hard'],
  medium: ['medium'],
  hard: ['medium', 'hard'],
};

export function parseCustomWords(text) {
  const seen = new Set();
  return String(text || '')
    .split(/[,\n;]/)
    .map((w) => w.trim().toLowerCase().slice(0, 32))
    .filter((w) => w && normalize(w) && !seen.has(w) && seen.add(w));
}

// Picks `count` options for the drawer, avoiding words already used this game and (for the
// built-in packs) words picked in recent games on this host. Custom words are mixed in at
// roughly a 50/50 rate so team in-jokes show up often; they only skip this game's words.
export function pickChoices(settings, used, count, recent = new Set()) {
  const lang = LANGUAGES[settings.lang] || LANGUAGES.en;
  const levels = DIFFICULTIES[settings.difficulty] || DIFFICULTIES.mixed;
  const builtIn = levels.flatMap((l) => lang.words[l]);
  const custom = parseCustomWords(settings.customWords);
  const fresh = (list, skip = used) => shuffle(list.filter((w) => !skip.has(w)));

  let customPool = fresh(custom);
  let basePool = settings.customOnly && custom.length >= count ? [] : fresh(builtIn, new Set([...used, ...recent]));
  // Played through most of the pack lately? Fall back to just avoiding this game's words
  if (basePool.length < count && !(settings.customOnly && custom.length >= count)) basePool = fresh(builtIn);
  // Once a small list runs dry, allow repeats rather than getting stuck
  if (!customPool.length && !basePool.length) {
    customPool = shuffle(custom);
    basePool = settings.customOnly && custom.length >= count ? [] : shuffle(builtIn);
  }

  const out = [];
  while (out.length < count && (customPool.length || basePool.length)) {
    const fromCustom = customPool.length && (!basePool.length || Math.random() < 0.5);
    const w = (fromCustom ? customPool : basePool).pop();
    if (!out.includes(w)) out.push(w);
  }
  return out;
}
