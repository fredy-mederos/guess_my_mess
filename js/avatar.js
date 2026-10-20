// Avatars are a little blob character built from parts: { c: color, e: eyes, m: mouth, h: hat }.
// Each part is an index, so an avatar is tiny to send over the network.

const INK = '#2b2533';
const line = (d, w = 3.5) =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const dot = (x, y, r = 4.5) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/><circle cx="${x + 1.6}" cy="${y - 1.6}" r="1.4" fill="#fff"/>`;

export const COLORS = [
  '#ff6b6b', '#ff922b', '#fcc419', '#94d82d', '#51cf66', '#20c997',
  '#22b8cf', '#339af0', '#5c7cfa', '#845ef7', '#cc5de8', '#f06595',
];

export const EYES = [
  ['Dots', dot(38, 52) + dot(62, 52)],
  ['Big', `<circle cx="38" cy="51" r="8.5" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
    <circle cx="62" cy="51" r="8.5" fill="#fff" stroke="${INK}" stroke-width="2.5"/>` + dot(39, 53, 4.2) + dot(63, 53, 4.2)],
  ['Happy', line('M32 54 q6 -8 12 0 M56 54 q6 -8 12 0')],
  ['Sleepy', line('M32 51 q6 6 12 0 M56 51 q6 6 12 0')],
  ['Wink', dot(38, 52) + line('M56 54 q6 -8 12 0')],
  ['Grumpy', dot(38, 53) + dot(62, 53) + line('M30 42 l13 5 M70 42 l-13 5', 3.2)],
  ['Shades', `<rect x="26" y="45" width="21" height="13" rx="5" fill="${INK}"/>
    <rect x="53" y="45" width="21" height="13" rx="5" fill="${INK}"/>` +
    line('M47 50 h6', 3) + `<path d="M30 49 l5 -2 M57 49 l5 -2" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>`],
  ['Dizzy', line('M34 48 l8 8 M42 48 l-8 8 M58 48 l8 8 M66 48 l-8 8', 3.2)],
];

export const MOUTHS = [
  ['Smile', line('M41 66 q9 9 18 0')],
  ['Grin', `<path d="M38 63 h24 q0 14 -12 14 q-12 0 -12 -14 z" fill="${INK}"/>
    <path d="M44 73 q6 -5 12 0 q-6 5 -12 0 z" fill="#ff8fa3"/>`],
  ['Meh', line('M43 69 h14')],
  ['Oh', `<ellipse cx="50" cy="69" rx="4.5" ry="5.5" fill="${INK}"/>`],
  ['Tongue', line('M41 66 q9 8 18 0') + `<path d="M46 69 h8 v4 a4 4 0 0 1 -8 0 z" fill="#ff8fa3" stroke="${INK}" stroke-width="2"/>`],
  ['Smirk', line('M42 69 q10 4 17 -5')],
  ['Teeth', `<rect x="41" y="63" width="18" height="10" rx="4" fill="#fff" stroke="${INK}" stroke-width="2.5"/>` + line('M50 63 v10', 2)],
  ['Stache', line('M44 73 q6 3 12 0', 2.5) +
    `<path d="M50 65 c-4 -5 -13 -5 -16 2 c5 -1 9 0 16 1 c7 -1 11 -2 16 -1 c-3 -7 -12 -7 -16 -2 z" fill="#4a3426"/>`],
];

export const HATS = [
  ['None', ''],
  ['Party', `<path d="M50 3 L37 29 h26 z" fill="#ffd43b" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M44 16 l11 4 M41 23 l17 5" stroke="#f06595" stroke-width="3" stroke-linecap="round"/>
    <circle cx="50" cy="4" r="4.5" fill="#f06595" stroke="${INK}" stroke-width="2"/>`],
  ['Crown', `<path d="M31 31 l-3 -19 l11 9 l11 -15 l11 15 l11 -9 l-3 19 z" fill="#ffc83d" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="50" cy="24" r="3" fill="#f06595"/><circle cx="38" cy="25" r="2.2" fill="#339af0"/><circle cx="62" cy="25" r="2.2" fill="#339af0"/>`],
  ['Cap', `<path d="M23 35 a27 22 0 0 1 54 0 z" fill="#4c6ef5" stroke="${INK}" stroke-width="2.5"/>
    <path d="M58 34 h27 a4 4 0 0 1 0 7 h-27 z" fill="#364fc7" stroke="${INK}" stroke-width="2.5"/>
    <circle cx="50" cy="13" r="3" fill="${INK}"/>`],
  ['Beanie', `<path d="M21 38 a29 26 0 0 1 58 0 z" fill="#ff922b" stroke="${INK}" stroke-width="2.5"/>
    <rect x="19" y="33" width="62" height="9" rx="4" fill="#e8590c" stroke="${INK}" stroke-width="2.5"/>
    <circle cx="50" cy="11" r="6" fill="#fff4e6" stroke="${INK}" stroke-width="2.5"/>`],
  ['Phones', `<path d="M17 54 a33 33 0 0 1 66 0" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
    <rect x="10" y="46" width="13" height="21" rx="6" fill="#f06595" stroke="${INK}" stroke-width="2.5"/>
    <rect x="77" y="46" width="13" height="21" rx="6" fill="#f06595" stroke="${INK}" stroke-width="2.5"/>`],
  ['Bow', `<path d="M67 22 l-13 -9 v18 z M67 22 l13 -9 v18 z" fill="#f783ac" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="67" cy="22" r="4.5" fill="#e64980" stroke="${INK}" stroke-width="2"/>`],
  ['Antenna', line('M50 25 q-5 -10 2 -18', 3) + `<circle cx="52" cy="7" r="5.5" fill="#ffd43b" stroke="${INK}" stroke-width="2.5"/>`],
  ['Sprout', line('M50 25 v-12', 3) +
    `<path d="M50 15 q-13 -11 -17 0 q10 5 17 0 z M50 13 q10 -13 17 -2 q-8 6 -17 2 z" fill="#69db7c" stroke="${INK}" stroke-width="2.2"/>`],
  ['Specs', `<circle cx="38" cy="52" r="10.5" fill="#ffffff22" stroke="${INK}" stroke-width="3"/>
    <circle cx="62" cy="52" r="10.5" fill="#ffffff22" stroke="${INK}" stroke-width="3"/>` + line('M48.5 51 q1.5 -2 3 0', 3)],
];

export const PARTS = { c: COLORS, e: EYES, m: MOUTHS, h: HATS };

export function randomAvatar() {
  const r = (n) => Math.floor(Math.random() * n);
  // Fewer hats than "no hat" feels too busy, so most random avatars get one
  return { c: r(COLORS.length), e: r(EYES.length), m: r(MOUTHS.length), h: 1 + r(HATS.length - 1) };
}

// Guests send avatars, so clamp every index before using it
export function sanitizeAvatar(a) {
  const ok = (v, n) => (Number.isInteger(v) && v >= 0 && v < n ? v : 0);
  a = a || {};
  return { c: ok(a.c, COLORS.length), e: ok(a.e, EYES.length), m: ok(a.m, MOUTHS.length), h: ok(a.h, HATS.length) };
}

export function avatarSvg(a, size = 48) {
  const { c, e, m, h } = sanitizeAvatar(a);
  return `<svg class="avatar" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">
    <ellipse cx="50" cy="60" rx="35" ry="33" fill="${COLORS[c]}" stroke="${INK}" stroke-width="3"/>
    <ellipse cx="36" cy="41" rx="9" ry="4.5" fill="#fff" opacity=".35" transform="rotate(-25 36 41)"/>
    <ellipse cx="29" cy="66" rx="6" ry="3.5" fill="#ff6b8b" opacity=".35"/>
    <ellipse cx="71" cy="66" rx="6" ry="3.5" fill="#ff6b8b" opacity=".35"/>
    ${EYES[e][1]}${MOUTHS[m][1]}${HATS[h][1]}
  </svg>`;
}
