// Avatars are a little character built from parts:
//   { c: color, s: shape, e: eyes, m: mouth, h: hat, o: outfit }
// Each part is an index, so an avatar is tiny to send over the network. New parts and new
// variants only ever get added at the end, so characters saved earlier keep their look
// (an avatar from before shapes and outfits existed is a plain blob with no outfit).

const INK = '#2b2533';
const PINK = '#ffb3c6';  // inner ears
const GOLD = '#fcc419';
const line = (d, w = 3.5) =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const dot = (x, y, r = 4.5) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/><circle cx="${x + 1.6}" cy="${y - 1.6}" r="1.4" fill="#fff"/>`;
const inked = (w = 2.5) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round"`;
const fixed = (n) => +n.toFixed(1);

// Five-pointed star centered on (x, y)
function star(x, y, outer, inner, fill, w = 2) {
  const pts = Array.from({ length: 10 }, (_, k) => {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const r = k % 2 ? inner : outer;
    return `${fixed(x + Math.cos(a) * r)},${fixed(y + Math.sin(a) * r)}`;
  });
  return `<polygon points="${pts.join(' ')}" fill="${fill}" ${inked(w)}/>`;
}

// Heart centered on (x, y), about 2s wide
const heart = (x, y, s, fill) => `<path d="M${x} ${fixed(y + s * 0.9)} C${fixed(x - s * 1.4)} ${fixed(y)} ${fixed(x - s * 0.9)} ${fixed(y - s * 1.1)} ${x} ${fixed(y - s * 0.35)}
  C${fixed(x + s * 0.9)} ${fixed(y - s * 1.1)} ${fixed(x + s * 1.4)} ${fixed(y)} ${x} ${fixed(y + s * 0.9)} Z" fill="${fill}" ${inked(2)}/>`;

// A little five-petal flower
function flower(x, y, r, petals, w = 1.2) {
  const ring = Array.from({ length: 5 }, (_, k) => {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
    return `<circle cx="${fixed(x + Math.cos(a) * r)}" cy="${fixed(y + Math.sin(a) * r)}" r="${r}" fill="${petals}" ${inked(w)}/>`;
  }).join('');
  return `${ring}<circle cx="${x}" cy="${y}" r="${fixed(r * 0.75)}" fill="${GOLD}" ${inked(w)}/>`;
}

// Points along the curve a necklace follows, from one side of the body to the other
const necklace = (n, from = 27, to = 73, top = 78, sag = 10) => Array.from({ length: n }, (_, i) => {
  const t = i / (n - 1);
  return [fixed(from + (to - from) * t), fixed(top + sag * Math.sin(Math.PI * t))];
});

// A puffy cloud outline: bumps all around an ellipse
function scallops(n = 14, cx = 50, cy = 60, rx = 32, ry = 30) {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [fixed(cx + Math.cos(a) * rx), fixed(cy + Math.sin(a) * ry)];
  });
  const r = fixed(Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) * 0.6);
  return `M${pts[0]} ${pts.slice(1).concat([pts[0]]).map((p) => `A${r} ${r} 0 0 1 ${p}`).join(' ')} Z`;
}

export const COLORS = [
  '#ff6b6b', '#ff922b', '#fcc419', '#94d82d', '#51cf66', '#20c997',
  '#22b8cf', '#339af0', '#5c7cfa', '#845ef7', '#cc5de8', '#f06595',
  // Pastels, earthy tones and snow
  '#ffa8a8', '#ffc078', '#ffe066', '#c0eb75', '#63e6be', '#99e9f2',
  '#a5d8ff', '#b197fc', '#faa2c1', '#e0a96d', '#b08968', '#f1f3f5',
];

// Body shapes, each drawn in the avatar's color. They all keep the face in the same place
// (eyes around y 52, mouth around y 68) and the top of the head near y 27, where hats sit.
const body = (c) => `fill="${c}" ${inked(3)}`;
const blob = (c) => `<ellipse cx="50" cy="60" rx="35" ry="33" ${body(c)}/>`;
const outline = (d) => (c) => `<path d="${d}" ${body(c)}/>`;
export const SHAPES = [
  ['Blob', blob],
  ['Egg', outline('M50 23 C69 23 83 44 83 64 C83 82 68 94 50 94 C32 94 17 82 17 64 C17 44 31 23 50 23 Z')],
  ['Box', outline('M31 28 H69 Q83 28 83 42 V79 Q83 93 69 93 H31 Q17 93 17 79 V42 Q17 28 31 28 Z')],
  ['Bean', (c) => `<ellipse cx="50" cy="61" rx="41" ry="32" ${body(c)}/>`],
  ['Drop', outline('M50 12 C60 30 84 42 84 63 C84 81 69 94 50 94 C31 94 16 81 16 63 C16 42 40 30 50 12 Z')],
  ['Ghost', outline('M17 58 C17 39 32 27 50 27 C68 27 83 39 83 58 V88 q-5.5 7 -11 0 q-5.5 -7 -11 0 q-5.5 7 -11 0 q-5.5 -7 -11 0 q-5.5 7 -11 0 q-5.5 -7 -11 0 Z')],
  ['Fluffy', outline(scallops())],
  ['Cat', (c) => `<path d="M21 48 L19 13 L46 30 Z M79 48 L81 13 L54 30 Z" ${body(c)}/>
    <path d="M25 38 L24 22 L37 30 Z M75 38 L76 22 L63 30 Z" fill="${PINK}"/>${blob(c)}`],
  ['Bear', (c) => `<circle cx="25" cy="34" r="11" ${body(c)}/><circle cx="75" cy="34" r="11" ${body(c)}/>
    <circle cx="25" cy="34" r="5.5" fill="${PINK}"/><circle cx="75" cy="34" r="5.5" fill="${PINK}"/>${blob(c)}`],
  ['Bunny', (c) => `<ellipse cx="35" cy="21" rx="8" ry="19" transform="rotate(-12 35 21)" ${body(c)}/>
    <ellipse cx="65" cy="21" rx="8" ry="19" transform="rotate(12 65 21)" ${body(c)}/>
    <ellipse cx="35" cy="22" rx="3.8" ry="13" transform="rotate(-12 35 22)" fill="${PINK}"/>
    <ellipse cx="65" cy="22" rx="3.8" ry="13" transform="rotate(12 65 22)" fill="${PINK}"/>${blob(c)}`],
  ['Horns', (c) => `<path d="M31 38 Q20 24 28 9 Q32 25 42 31 Z M69 38 Q80 24 72 9 Q68 25 58 31 Z" fill="#fff4e6" ${inked()}/>${blob(c)}`],
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
  ['Stars', star(38, 52, 8, 3.6, GOLD) + star(62, 52, 8, 3.6, GOLD)],
  ['Hearts', heart(38, 52, 6.5, '#f03e3e') + heart(62, 52, 6.5, '#f03e3e')],
  ['Lashes', dot(38, 53) + dot(62, 53) + line('M32 48 l-4 -3 M35 46 l-2 -4.5 M39 45.5 v-4.5 M68 48 l4 -3 M65 46 l2 -4.5 M61 45.5 v-4.5', 2.4)],
  ['Cyclops', `<circle cx="50" cy="51" r="12.5" fill="#fff" ${inked(3)}/><circle cx="50" cy="52" r="6.5" fill="#339af0" ${inked(2)}/>` + dot(50, 52, 3.2)],
  ['Squint', line('M33 46 l9 5.5 l-9 5.5 M67 46 l-9 5.5 l9 5.5', 3.4)],
  ['Sparkly', `<ellipse cx="38" cy="52" rx="6" ry="8" fill="${INK}"/><ellipse cx="62" cy="52" rx="6" ry="8" fill="${INK}"/>
    <circle cx="40" cy="48.5" r="2.5" fill="#fff"/><circle cx="64" cy="48.5" r="2.5" fill="#fff"/>
    <circle cx="36.5" cy="55.5" r="1.2" fill="#fff"/><circle cx="60.5" cy="55.5" r="1.2" fill="#fff"/>`],
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
  ['Fangs', `<path d="M43.5 68 l2 5.5 l2 -4.5 z M56.5 68 l-2 5.5 l-2 -4.5 z" fill="#fff" ${inked(1.6)}/>` + line('M40 65 q10 9 20 0')],
  ['Kiss', line('M48 62 q6 2.5 0 5 q6 2.5 0 5', 3.2) + heart(60, 60, 3.2, '#f06595')],
  ['Buck', `<rect x="46.5" y="68" width="7" height="6.5" rx="1.5" fill="#fff" ${inked(2)}/>` + line('M40 65 q10 8 20 0')],
  ['Wavy', line('M39 69 q2.75 -4 5.5 0 t5.5 0 t5.5 0 t5.5 0', 3)],
  ['Kitty', line('M40 66 q5 6 10 0 q5 6 10 0', 3.2) + line('M25 63 l-9 -2.5 M25 67.5 h-9.5 M75 63 l9 -2.5 M75 67.5 h9.5', 2)],
  ['Beard', `<path d="M21 62 C23 85 36 95 50 95 C64 95 77 85 79 62 C72 72 62 75 50 75 C38 75 28 72 21 62 Z" fill="#7c4f32" ${inked()}/>` +
    line('M43 68 q7 5 14 0', 3)],
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
  ['Wizard', `<path d="M24 31 Q50 25 76 31 L59 12 Q57 5 66 3 Q51 0 45 10 Z" fill="#5f3dc4" ${inked()}/>
    <ellipse cx="50" cy="31" rx="28" ry="5.5" fill="#5f3dc4" ${inked()}/>` + star(47, 19, 4.5, 2, GOLD, 1.4) + star(60, 25, 3, 1.4, GOLD, 1.2)],
  ['Top hat', `<ellipse cx="50" cy="30" rx="27" ry="5.5" fill="#343a40" ${inked()}/>
    <rect x="35" y="4" width="30" height="26" rx="3" fill="#343a40" ${inked()}/>
    <rect x="36.3" y="20" width="27.4" height="5.5" fill="#e03131"/>`],
  ['Cowboy', `<path d="M33 29 C31 13 38 7 44 11 Q50 14 56 11 C62 7 69 13 67 29 Z" fill="#c08457" ${inked()}/>
    <path d="M33 24 Q50 27 67 24 L67.5 29.5 Q50 32.5 32.5 29.5 Z" fill="#7c4f32"/>
    <path d="M11 24 Q18 35 50 34 Q82 35 89 24 Q85 39 50 40 Q15 39 11 24 Z" fill="#c08457" ${inked()}/>`],
  ['Chef', `<path d="M32 24 C21 24 21 8 32 9 C34 0 46 -1 50 5 C54 -1 66 0 68 9 C79 8 79 24 68 24 Z" fill="#fff" ${inked()}/>
    <rect x="32" y="21" width="36" height="11" rx="2" fill="#fff" ${inked()}/>` + line('M41 24 v5 M50 24 v5 M59 24 v5', 1.6)],
  ['Halo', `<ellipse cx="50" cy="12" rx="20" ry="5.5" fill="none" stroke="${INK}" stroke-width="7.5"/>
    <ellipse cx="50" cy="12" rx="20" ry="5.5" fill="none" stroke="${GOLD}" stroke-width="4"/>`],
  ['Viking', `<path d="M27 31 Q13 27 12 8 Q19 22 31 23 Z M73 31 Q87 27 88 8 Q81 22 69 23 Z" fill="#fff4e6" ${inked()}/>
    <path d="M24 37 a26 23 0 0 1 52 0 z" fill="#adb5bd" ${inked()}/>
    <rect x="22" y="32" width="56" height="8" rx="3" fill="#868e96" ${inked()}/>
    <circle cx="33" cy="36" r="1.5" fill="${INK}"/><circle cx="50" cy="36" r="1.5" fill="${INK}"/><circle cx="67" cy="36" r="1.5" fill="${INK}"/>`],
  ['Flower', flower(31, 28, 5.5, '#ff8fab', 1.8)],
  ['Spiky', `<path d="M21 41 L18 21 L30 29 L32 11 L42 25 L50 6 L58 25 L68 11 L70 29 L82 21 L79 41 Q50 30 21 41 Z" fill="#3d2b1f" ${inked()}/>`],
  ['Propeller', `<path d="M24 37 a26 23 0 0 1 52 0 z" fill="${GOLD}" ${inked()}/>
    <path d="M37 18 Q41 26 41 35 M63 18 Q59 26 59 35" stroke="#e03131" stroke-width="3.5" fill="none"/>` + line('M50 14 v-6', 2.5) +
    `<ellipse cx="40" cy="8" rx="10" ry="3.2" fill="#e03131" ${inked(2)}/><ellipse cx="60" cy="8" rx="10" ry="3.2" fill="#339af0" ${inked(2)}/>
    <circle cx="50" cy="8" r="2.6" fill="${INK}"/>`],
  ['Unicorn', `<path d="M43 31 L50 2 L57 31 Z" fill="#fff3bf" ${inked()}/>` + line('M44.5 25 l11 -3.5 M46.5 17 l7.5 -2.5 M48.2 10 l3.6 -1.2', 1.8)],
];

// Outfits: [name, drawn in front, drawn behind the body]
export const OUTFITS = [
  ['None', ''],
  ['Bow tie', `<path d="M50 86 L37 79 Q34 86 37 93 Z M50 86 L63 79 Q66 86 63 93 Z" fill="#e03131" ${inked()}/>
    <rect x="46.5" y="82.5" width="7" height="7" rx="2.2" fill="#c92a2a" ${inked(2)}/>`],
  ['Tie', `<path d="M47.4 82.5 h5.2 l3.6 7 l-6.2 4.8 l-6.2 -4.8 z" fill="#339af0" ${inked(2)}/>
    <path d="M45 77.5 h10 l-2 5 h-6 z" fill="#1c7ed6" ${inked(2)}/>
    <path d="M46.2 88 l6.2 -3 M47.4 92 l5.4 -2.6" stroke="#a5d8ff" stroke-width="1.8" stroke-linecap="round"/>`],
  ['Scarf', `<path d="M62 87 L65 100 H75 L71 85 Z" fill="#ff6b6b" ${inked()}/>
    <path d="M19 75 Q50 90 81 75 L83 84 Q50 101 17 84 Z" fill="#ff6b6b" ${inked()}/>
    <path d="M28 80 l-.5 8 M39 83.5 v9 M61 83.5 v9 M72 80 l.5 8" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".85"/>`],
  ['Bandana', `<path d="M21 79 Q50 91 79 79 L55 98 Q50 102 45 98 Z" fill="#e64980" ${inked()}/>` +
    [[31, 83.5], [40, 87], [50, 90.5], [60, 87], [69, 83.5], [45, 94], [55, 94]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.5" fill="#fff"/>`).join('')],
  ['Pearls', necklace(10).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.1" fill="#fff" ${inked(1.5)}/>`).join('')],
  ['Medal', `<path d="M38 76 L46.5 89 M62 76 L53.5 89" stroke="${INK}" stroke-width="7.5" stroke-linecap="round"/>
    <path d="M38 76 L46.5 89 M62 76 L53.5 89" stroke="#339af0" stroke-width="4.5" stroke-linecap="round"/>
    <circle cx="50" cy="91" r="6.5" fill="${GOLD}" ${inked(2.2)}/><circle cx="50" cy="91" r="3" fill="none" stroke="#e67700" stroke-width="1.6"/>`],
  ['Bell', `<path d="M20 78 Q50 93 80 78" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
    <path d="M20 78 Q50 93 80 78" fill="none" stroke="#e03131" stroke-width="5.5" stroke-linecap="round"/>
    <circle cx="50" cy="91" r="5.5" fill="${GOLD}" ${inked(2)}/>` + line('M46 92 h8 M50 92 v3.5', 1.6)],
  ['Lei', necklace(7, 25, 75, 79, 9).map(([x, y], i) => flower(x, y, 2.7, ['#ff8fab', '#ffd43b', '#b197fc', '#ff922b'][i % 4], 1)).join('')],
  ['Cape', `<path d="M24 80 Q50 90 76 80" fill="none" stroke="#c92a2a" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="24" cy="80" r="3.5" fill="${GOLD}" ${inked(1.8)}/><circle cx="76" cy="80" r="3.5" fill="${GOLD}" ${inked(1.8)}/>`,
  `<path d="M18 64 Q7 90 12 100 H88 Q93 90 82 64 Z" fill="#e03131" ${inked()}/>`],
  ['Name tag', `<g transform="rotate(-8 67 82)"><rect x="57" y="75" width="21" height="14" rx="2.5" fill="#fff" ${inked(2)}/>
    <path d="M58 76 h19 v4 h-19 z" fill="#e03131"/>` + line('M60.5 84 h9 M60.5 86.8 h6', 1.4) + '</g>'],
  ['Straps', `<path d="M31 74 L37 91 M69 74 L63 91" stroke="${INK}" stroke-width="7.5" stroke-linecap="round"/>
    <path d="M31 74 L37 91 M69 74 L63 91" stroke="#e03131" stroke-width="4.5" stroke-linecap="round"/>
    <circle cx="34.5" cy="83" r="2.3" fill="${GOLD}" ${inked(1.5)}/><circle cx="65.5" cy="83" r="2.3" fill="${GOLD}" ${inked(1.5)}/>`],
  ['Tux', `<path d="M37 78 Q50 84 63 78 L50 95 Z" fill="#fff" ${inked(2)}/>
    <path d="M50 83.5 L43.5 80.5 V87 Z M50 83.5 L56.5 80.5 V87 Z" fill="${INK}" ${inked(1.2)}/>
    <circle cx="50" cy="88.5" r="1.3" fill="${INK}"/><circle cx="50" cy="92" r="1.2" fill="${INK}"/>`],
];

export const PARTS = { c: COLORS, s: SHAPES, e: EYES, m: MOUTHS, h: HATS, o: OUTFITS };

export function randomAvatar() {
  const r = (n) => Math.floor(Math.random() * n);
  // A bare head looks plain, so random characters always get a hat; about half get an outfit
  return {
    c: r(COLORS.length), s: r(SHAPES.length), e: r(EYES.length), m: r(MOUTHS.length),
    h: 1 + r(HATS.length - 1), o: r(2) ? 1 + r(OUTFITS.length - 1) : 0,
  };
}

// Guests send avatars, so clamp every index before using it
export function sanitizeAvatar(a) {
  const ok = (v, n) => (Number.isInteger(v) && v >= 0 && v < n ? v : 0);
  a = a || {};
  return Object.fromEntries(Object.entries(PARTS).map(([key, list]) => [key, ok(a[key], list.length)]));
}

export function avatarSvg(a, size = 48) {
  const { c, s, e, m, h, o } = sanitizeAvatar(a);
  const [, front, behind = ''] = OUTFITS[o];
  return `<svg class="avatar" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">
    ${behind}${SHAPES[s][1](COLORS[c])}
    <ellipse cx="36" cy="41" rx="9" ry="4.5" fill="#fff" opacity=".35" transform="rotate(-25 36 41)"/>
    <ellipse cx="29" cy="66" rx="6" ry="3.5" fill="#ff6b8b" opacity=".35"/>
    <ellipse cx="71" cy="66" rx="6" ry="3.5" fill="#ff6b8b" opacity=".35"/>
    ${EYES[e][1]}${MOUTHS[m][1]}${front}${HATS[h][1]}
  </svg>`;
}
