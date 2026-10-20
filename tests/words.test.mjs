// Word packs and guess matching, in plain Node (no browser needed)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from '../js/util.js';
import { LANGUAGES, pickChoices } from '../js/words/index.js';

// How the game compares a guess with the word (see guess() in js/engine.js)
const same = (a, b) => normalize(a).replace(/ /g, '') === normalize(b).replace(/ /g, '');
const SETTINGS = { difficulty: 'mixed', customWords: '', customOnly: false };

test('guesses ignore case, accents, ligatures, punctuation and spaces', () => {
  const pairs = [['Árbol', 'arbol'], ['œuf', 'oeuf'], ['Cœur!', 'coeur'], ['ação', 'acao'], ['Straße', 'strasse'],
    ['stand-up', 'standup'], ['stand up', 'standup'], ['cabane dans l’arbre', "cabane dans l'arbre"]];
  for (const [a, b] of pairs) assert.ok(same(a, b), `"${a}" should count as "${b}"`);
  assert.ok(!same('cat', 'car'));
});

for (const [code, { label, words }] of Object.entries(LANGUAGES)) {
  test(`${label} word pack: three tidy lists, no word twice`, (t) => {
    const seen = new Map();
    for (const level of ['easy', 'medium', 'hard']) {
      assert.ok(words[level]?.length > 0, `the ${level} list is empty`);
      for (const word of words[level]) {
        assert.equal(word, word.trim().toLowerCase().replace(/\s+/g, ' '), `"${word}" (${level}) should be lowercase and single-spaced`);
        const key = normalize(word).replace(/ /g, '');
        assert.ok(key, `"${word}" (${level}) has no letters`);
        assert.ok(!seen.has(key), `"${word}" (${level}) is the same guess as ${seen.get(key)}`);
        seen.set(key, `"${word}" (${level})`);
      }
    }
    t.diagnostic(`${code}: ${words.easy.length} easy, ${words.medium.length} medium, ${words.hard.length} hard`);
  });
}

test('every language offers three different words to pick from', () => {
  for (const lang of Object.keys(LANGUAGES)) {
    const choices = pickChoices({ ...SETTINGS, lang }, new Set(), 3);
    assert.equal(new Set(choices).size, 3, `${lang}: ${choices.join(', ')}`);
  }
});

test('words from recent games are skipped until the pack runs out', () => {
  const all = Object.values(LANGUAGES.fr.words).flat();
  const recent = new Set(all.slice(0, -5)); // only 5 fresh words left
  const picks = pickChoices({ ...SETTINGS, lang: 'fr' }, new Set(), 3, recent);
  assert.ok(picks.every((w) => !recent.has(w)), `offered recent words: ${picks.join(', ')}`);
  assert.equal(pickChoices({ ...SETTINGS, lang: 'fr' }, new Set(), 3, new Set(all)).length, 3, 'falls back to recent words');
});

test('custom words: only ours when asked, even if they came up in recent games', () => {
  const ours = ['deploy friday', 'rubber duck', 'standup'];
  const picks = pickChoices({ ...SETTINGS, lang: 'en', customWords: ours.join(', '), customOnly: true }, new Set(), 3, new Set(ours));
  assert.deepEqual([...picks].sort(), ours);
});
