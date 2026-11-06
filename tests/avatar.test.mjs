// Avatar parts, in plain Node (no browser needed): saved characters keep their look as parts
// get added, and every part draws clean SVG
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLORS, SHAPES, EYES, MOUTHS, HATS, OUTFITS, PARTS, avatarSvg, randomAvatar, sanitizeAvatar } from '../js/avatar.js';

const names = (list) => list.map(([name]) => name);

test('characters saved before shapes and outfits keep their look', () => {
  // An avatar is just indexes, so the parts that existed first must stay where they are
  assert.deepEqual(COLORS.slice(0, 12), ['#ff6b6b', '#ff922b', '#fcc419', '#94d82d', '#51cf66', '#20c997',
    '#22b8cf', '#339af0', '#5c7cfa', '#845ef7', '#cc5de8', '#f06595']);
  assert.deepEqual(names(EYES).slice(0, 8), ['Dots', 'Big', 'Happy', 'Sleepy', 'Wink', 'Grumpy', 'Shades', 'Dizzy']);
  assert.deepEqual(names(MOUTHS).slice(0, 8), ['Smile', 'Grin', 'Meh', 'Oh', 'Tongue', 'Smirk', 'Teeth', 'Stache']);
  assert.deepEqual(names(HATS).slice(0, 10), ['None', 'Party', 'Crown', 'Cap', 'Beanie', 'Phones', 'Bow', 'Antenna', 'Sprout', 'Specs']);
  // ...and a character from back then is the plain blob, with no outfit
  assert.equal(SHAPES[0][0], 'Blob');
  assert.equal(OUTFITS[0][0], 'None');
  const old = { c: 1, e: 4, m: 7, h: 8 };
  assert.deepEqual(sanitizeAvatar(old), { c: 1, s: 0, e: 4, m: 7, h: 8, o: 0 });
  const svg = avatarSvg(old);
  assert.match(svg, /<ellipse cx="50" cy="60" rx="35" ry="33" fill="#ff922b"/, 'the blob body in its old color');
  assert.ok(svg.includes(EYES[4][1]) && svg.includes(MOUTHS[7][1]) && svg.includes(HATS[8][1]));
});

test('broken or made-up parts from a guest fall back to the first variant', () => {
  assert.deepEqual(sanitizeAvatar({ c: 999, s: -1, e: 1.5, m: '2', h: null, o: 3, x: 5 }), { c: 0, s: 0, e: 0, m: 0, h: 0, o: 3 });
  assert.deepEqual(sanitizeAvatar(null), { c: 0, s: 0, e: 0, m: 0, h: 0, o: 0 });
  assert.deepEqual(sanitizeAvatar('robot'), { c: 0, s: 0, e: 0, m: 0, h: 0, o: 0 });
});

// Tags open and close in order, every attribute is quoted, and no number went missing
function checkSvg(svg, what) {
  assert.ok(!/NaN|undefined|null/.test(svg), `${what}: a number went missing`);
  assert.equal(svg.replace(/<[^<>]*>/g, '').trim(), '', `${what}: stray text, < or > between tags`);
  const stack = [];
  for (const tag of svg.match(/<[^<>]*>/g)) {
    const m = tag.match(/^<(\/?)([a-zA-Z]+)((?:\s+[a-zA-Z:-]+="[^"]*")*)\s*(\/?)>$/);
    assert.ok(m, `${what}: malformed tag ${tag}`);
    const [, closing, name, , selfClosing] = m;
    if (closing) assert.equal(stack.pop(), name, `${what}: </${name}> closes the wrong tag`);
    else if (!selfClosing) stack.push(name);
  }
  assert.deepEqual(stack, [], `${what}: unclosed tags`);
}

test('every part draws clean SVG, on every body shape', () => {
  for (const [key, list] of Object.entries(PARTS)) {
    for (let i = 0; i < list.length; i++) {
      for (let s = 0; s < SHAPES.length; s++) checkSvg(avatarSvg({ s, [key]: i }), `${key}=${i} on shape ${s}`);
    }
  }
  for (const list of [SHAPES, EYES, MOUTHS, HATS, OUTFITS]) {
    assert.equal(new Set(names(list)).size, list.length, `two parts share a name: ${names(list).join(', ')}`);
    // The name sits between the picker's arrows: longer ones don't fit on a small phone
    for (const name of names(list)) assert.ok(name.length <= 9, `"${name}" is too long for the picker`);
  }
  assert.equal(new Set(COLORS).size, COLORS.length, 'a color is listed twice');
});

test('random characters use every part, always wear a hat, and about half get an outfit', () => {
  const seen = Object.fromEntries(Object.keys(PARTS).map((k) => [k, new Set()]));
  const runs = 3000;
  let outfits = 0;
  for (let i = 0; i < runs; i++) {
    const a = randomAvatar();
    assert.deepEqual(sanitizeAvatar(a), a, 'a random character is already valid');
    for (const k of Object.keys(PARTS)) seen[k].add(a[k]);
    assert.ok(a.h > 0, 'no hat');
    if (a.o) outfits++;
  }
  for (const [k, list] of Object.entries(PARTS)) {
    assert.equal(seen[k].size, k === 'h' ? list.length - 1 : list.length, `not every ${k} shows up`);
  }
  assert.ok(outfits > runs * 0.4 && outfits < runs * 0.6, `${outfits} of ${runs} with an outfit`);
});
