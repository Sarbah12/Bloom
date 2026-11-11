/**
 * Proves the colour tokens meet WCAG 2.1 AA in both light and dark themes:
 * 4.5:1 for text pairs, 3:1 for marks such as rings, dots and input borders.
 */
import { darkColors, lightColors, MARK_PAIRS, TEXT_PAIRS, type Colors } from '../theme/tokens.ts';

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const failures: string[] = [];
const themes: [string, Colors][] = [
  ['light', lightColors],
  ['dark', darkColors],
];

for (const [name, colors] of themes) {
  for (const [fg, bg] of TEXT_PAIRS) {
    const r = contrast(colors[fg] as string, colors[bg] as string);
    if (r < 4.5) failures.push(`${name}: ${fg} on ${bg} is ${r.toFixed(2)}:1 (needs 4.5)`);
  }
  for (const [fg, bg] of MARK_PAIRS) {
    const r = contrast(colors[fg] as string, colors[bg] as string);
    if (r < 3) failures.push(`${name}: ${fg} on ${bg} is ${r.toFixed(2)}:1 (needs 3)`);
  }
  for (const [phase, p] of Object.entries(colors.phase)) {
    const text = contrast(p.onSoft, p.soft);
    if (text < 4.5) failures.push(`${name}: ${phase} onSoft on soft is ${text.toFixed(2)}:1 (needs 4.5)`);
    const onSolid = contrast(p.onSolid, p.solid);
    if (onSolid < 4.5) failures.push(`${name}: ${phase} onSolid on solid is ${onSolid.toFixed(2)}:1 (needs 4.5)`);
    const mark = contrast(p.solid, colors.surface);
    if (mark < 3) failures.push(`${name}: ${phase} solid on surface is ${mark.toFixed(2)}:1 (needs 3)`);
    const markBg = contrast(p.solid, colors.background);
    if (markBg < 3) failures.push(`${name}: ${phase} solid on background is ${markBg.toFixed(2)}:1 (needs 3)`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`contrast: ${themes.length} themes, ${TEXT_PAIRS.length + MARK_PAIRS.length + 16} pairings meet WCAG AA`);
