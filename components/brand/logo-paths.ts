/**
 * The Bloom mark, as raw SVG geometry on a 100 × 100 grid.
 *
 * A drop — the period — whose inner crescent is the moon-like turn of the
 * cycle, cradled by two leaves so the whole shape reads as a bud about to
 * bloom. Shared by the in-app logo and scripts/build-icons.ts, so the app
 * icon, splash and screens can never drift apart.
 *
 * No React Native imports: the icon script loads this in plain Node.
 */

/** The drop, with the crescent cut out of it (render with fill-rule evenodd). */
export const DROP_WITH_CRESCENT =
  'M48 4 C49.5 13 74 33 74 56 A24 24 0 0 1 26 56 C26 37 45 22 48 4 Z ' + 'M47.88 42.16 A14 14 0 1 0 63.23 60.58 A12 12 0 0 1 47.88 42.16 Z';

export const LEAF_LEFT = 'M47 87 C32 88 18 80 12 63 C29 62.5 42 71 47 87 Z';
export const LEAF_RIGHT = 'M53 87 C68 88 82 80 88 63 C71 62.5 58 71 53 87 Z';

/** Visible bounds of the artwork inside the 100 × 100 grid. */
export const MARK_BOUNDS = { x: 12, y: 4, width: 76, height: 84 } as const;

/** A standalone SVG string, used to render PNG icons. */
export function markSvg({
  size,
  mark,
  leaf,
  background,
  scale = 1,
}: {
  size: number;
  mark: string;
  leaf: string;
  /** A solid colour, a [from, to] gradient, or null for transparent. */
  background: string | [string, string] | null;
  /** How much of the canvas the artwork's height fills (0–1). */
  scale?: number;
}): string {
  const s = (size * scale) / MARK_BOUNDS.height;
  const tx = size / 2 - (MARK_BOUNDS.x + MARK_BOUNDS.width / 2) * s;
  const ty = size / 2 - (MARK_BOUNDS.y + MARK_BOUNDS.height / 2) * s;
  const bg = !background
    ? ''
    : Array.isArray(background)
      ? `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${background[0]}"/><stop offset="1" stop-color="${background[1]}"/></linearGradient></defs><rect width="${size}" height="${size}" fill="url(#g)"/>`
      : `<rect width="${size}" height="${size}" fill="${background}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg}<g transform="translate(${tx} ${ty}) scale(${s})"><path d="${LEAF_LEFT}" fill="${leaf}"/><path d="${LEAF_RIGHT}" fill="${leaf}"/><path d="${DROP_WITH_CRESCENT}" fill="${mark}" fill-rule="evenodd"/></g></svg>`;
}
