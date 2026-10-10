// Project colors. Each project stores one color, picked when it's created:
// the first palette entry no other project is using, so projects never end up
// with near-identical colors (the old approach hashed the project id into a
// hue, and two different ids could land a few degrees apart).
//
// The palette is spaced around the color wheel and varies in lightness so
// neighbours stay distinguishable on the dark theme. Red/orange-red is left
// out on purpose — those colors mean "overdue" and "high priority" in the UI.
const PALETTE = [
  '#4C8DFF', // blue
  '#F0A93B', // amber
  '#3FBF7F', // green
  '#E255A1', // pink
  '#8E7CFF', // violet
  '#25B7C9', // cyan
  '#B6CB3B', // lime
  '#D14DDB', // magenta
  '#B58863', // tan
  '#7C93A8', // slate
  '#FF8FA3', // rose
  '#C4A7E7', // lavender
];

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
}

// Beyond the palette: walk the hue by the golden angle (maximally spread) and
// alternate lightness so the 13th, 14th, ... project still get distinct colors.
function generatedColor(index) {
  const hue = Math.round((index * 137.508) % 360);
  return hslToHex(hue, 62, index % 2 === 0 ? 58 : 46);
}

// `usedColors`: colors already taken by existing projects.
function pickProjectColor(usedColors = []) {
  const used = new Set(usedColors.filter(Boolean).map((c) => c.toUpperCase()));
  const free = PALETTE.find((c) => !used.has(c.toUpperCase()));
  if (free) return free;
  let i = PALETTE.length;
  while (used.has(generatedColor(i))) i += 1;
  return generatedColor(i);
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

module.exports = { PALETTE, pickProjectColor, HEX_COLOR };
