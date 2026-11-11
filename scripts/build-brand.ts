/**
 * Generates the Bloom brand kit into brand/: logo suite (SVG + PNG), social
 * and store graphics, and design tokens exported from theme/tokens.ts.
 *
 *   npm run build:brand
 *
 * Every shape comes from components/brand/logo-paths.ts and every colour from
 * theme/tokens.ts, so the kit can't drift from the app. Text is converted to
 * vector outlines from the bundled font files, so the SVGs look identical on
 * any machine, with or without the fonts installed.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import opentype from 'opentype.js';
import sharp from 'sharp';

import { DROP_WITH_CRESCENT, LEAF_LEFT, LEAF_RIGHT, MARK_BOUNDS } from '../components/brand/logo-paths.ts';
import { darkColors, lightColors, radii, space, typeScale } from '../theme/tokens.ts';

const root = new URL('..', import.meta.url).pathname;
const out = (...p: string[]) => join(root, 'brand', ...p);
for (const dir of ['logo', 'social', 'tokens']) mkdirSync(out(dir), { recursive: true });

const fontFile = (pkg: string, weight: string, name: string) => join(root, 'node_modules/@expo-google-fonts', pkg, weight, `${name}.ttf`);
const FONT = {
  wordmark: opentype.loadSync(fontFile('playfair-display', '600SemiBold', 'PlayfairDisplay_600SemiBold')),
  display: opentype.loadSync(fontFile('plus-jakarta-sans', '800ExtraBold', 'PlusJakartaSans_800ExtraBold')),
  heading: opentype.loadSync(fontFile('plus-jakarta-sans', '700Bold', 'PlusJakartaSans_700Bold')),
  body: opentype.loadSync(fontFile('inter', '400Regular', 'Inter_400Regular')),
  medium: opentype.loadSync(fontFile('inter', '500Medium', 'Inter_500Medium')),
};

/** Brand colours. Core UI colours come from the app's tokens. */
export const BRAND = {
  berry: lightColors.primary, // #A23B6D
  deepBerry: lightColors.heroStart, // #5E1A43
  plum: lightColors.heroEnd, // #A33F6C
  rose: '#F27BA6',
  petal: '#E8A1BE',
  blush: lightColors.tintStart, // #FBE3EC
  petalWhite: lightColors.background, // #FCF7F8
  cream: '#FFF7F0',
  ink: lightColors.ink, // #2D1A24
  inkMuted: lightColors.inkMuted,
};

type Font = opentype.Font;

/**
 * Sets a line of text as vector outlines. Glyphs are placed one by one with
 * the font's pair kerning; opentype.js doesn't apply every GPOS rule, so
 * commas and full stops get the small pull-in the fonts intend.
 */
function text(
  font: Font,
  str: string,
  x: number,
  y: number,
  size: number,
  fill: string,
  anchor: 'start' | 'middle' | 'end' = 'start',
  tracking = 0,
) {
  const chars = Array.from(str);
  const glyphs = chars.map((ch) => font.charToGlyph(ch));
  const scale = size / font.unitsPerEm;
  const offsets: number[] = [];
  let cursor = 0;
  glyphs.forEach((g, i) => {
    offsets.push(cursor);
    cursor += (g.advanceWidth ?? 0) * scale + tracking * size;
    const next = glyphs[i + 1];
    if (next) {
      cursor += font.getKerningValue(g, next) * scale;
      if (/[.,]/.test(chars[i + 1])) cursor -= 0.05 * size;
    }
  });
  const width = cursor - tracking * size;
  const sx = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  const d = glyphs.map((g, i) => g.getPath(sx + offsets[i], y, size).toPathData(2)).join('');
  return `<path d="${d}" fill="${fill}"/>`;
}

function mark(x: number, y: number, height: number, drop: string, leaf: string) {
  const s = height / MARK_BOUNDS.height;
  const tx = x - MARK_BOUNDS.x * s;
  const ty = y - MARK_BOUNDS.y * s;
  return `<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})"><path d="${LEAF_LEFT}" fill="${leaf}"/><path d="${LEAF_RIGHT}" fill="${leaf}"/><path d="${DROP_WITH_CRESCENT}" fill="${drop}" fill-rule="evenodd"/></g>`;
}

const markWidth = (height: number) => (MARK_BOUNDS.width / MARK_BOUNDS.height) * height;

/**
 * "bloom" with the mark as the first o — the same construction as the app's
 * Wordmark component: Playfair Display SemiBold at size 100, the mark as tall
 * as the ascender and sitting on the baseline.
 */
function wordmark(ink: string, drop: string, leaf: string) {
  const size = 100;
  const baseline = 92;
  const blWidth = FONT.wordmark.getAdvanceWidth('bl', size);
  const omWidth = FONT.wordmark.getAdvanceWidth('om', size);
  const markH = 0.95 * MARK_BOUNDS.height;
  const markLeft = 4 + blWidth + 3;
  const omLeft = markLeft + markWidth(markH) + 3;
  const width = Math.ceil(omLeft + omWidth + 4);
  const height = 104;
  const body =
    text(FONT.wordmark, 'bl', 4, baseline, size, ink) +
    mark(markLeft, baseline + 1 - markH, markH, drop, leaf) +
    text(FONT.wordmark, 'om', omLeft, baseline, size, ink);
  return { body, width, height };
}

const svg = (w: number, h: number, body: string, bg?: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ''}${body}</svg>`;

const linear = (id: string, from: string, to: string, x2 = 1, y2 = 1) =>
  `<defs><linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>`;

/** The layered waves from the welcome screen, stretched into a box. */
function waves(x: number, y: number, w: number, h: number) {
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 375 220" preserveAspectRatio="none">
<path d="M0,58 C90,8 180,10 262,48 C322,76 352,66 375,40 L375,220 L0,220 Z" fill="${BRAND.blush}"/>
<path d="M0,96 C80,60 170,70 250,96 C310,116 345,102 375,82 L375,220 L0,220 Z" fill="${BRAND.plum}" opacity="0.55"/>
<path d="M0,132 C90,106 170,116 260,138 C320,150 350,142 375,126 L375,220 L0,220 Z" fill="${BRAND.deepBerry}"/></svg>`;
}

const written: string[] = [];
async function save(rel: string, content: string, png?: { width: number; height?: number }) {
  writeFileSync(out(rel), content);
  written.push(rel);
  if (png) {
    const pngPath = rel.replace(/\.svg$/, '.png');
    await sharp(Buffer.from(content), { density: 288 })
      .resize(png.width, png.height ?? null)
      .png()
      .toFile(out(pngPath));
    written.push(pngPath);
  }
}

/* ------------------------------------------------------------------ logos */

const W = wordmark(BRAND.ink, BRAND.berry, BRAND.petal);
await save('logo/bloom-wordmark.svg', svg(W.width, W.height, W.body), { width: 1600 });

const WR = wordmark('#FFFFFF', BRAND.cream, BRAND.petal);
await save('logo/bloom-wordmark-reversed.svg', svg(WR.width, WR.height, WR.body), { width: 1600 });

const WM = wordmark('#000000', '#000000', '#000000');
await save('logo/bloom-wordmark-mono.svg', svg(WM.width, WM.height, WM.body), { width: 1600 });

const markSvg = (drop: string, leaf: string) => svg(MARK_BOUNDS.width, MARK_BOUNDS.height, mark(0, 0, MARK_BOUNDS.height, drop, leaf));
await save('logo/bloom-mark.svg', markSvg(BRAND.berry, BRAND.petal), { width: 1024 });
await save('logo/bloom-mark-reversed.svg', markSvg(BRAND.cream, BRAND.petal), { width: 1024 });
await save('logo/bloom-mark-mono.svg', markSvg('#000000', '#000000'), { width: 1024 });

// App icon, with and without the platform corner mask (for presentations).
const iconBody = (size: number, rounded: boolean) =>
  `${linear('ig', BRAND.rose, BRAND.berry)}<rect width="${size}" height="${size}" ${rounded ? `rx="${size * 0.225}"` : ''} fill="url(#ig)"/>` +
  mark((size - markWidth(size * 0.56)) / 2, size * 0.22, size * 0.56, BRAND.cream, '#FFD9E6');
await save('logo/bloom-app-icon.svg', svg(1024, 1024, iconBody(1024, false)), { width: 1024 });
await save('logo/bloom-app-icon-rounded.svg', svg(1024, 1024, iconBody(1024, true)), { width: 512 });

// Lockup: wordmark over the tagline.
{
  const scale = 2;
  const w = W.width * scale;
  const tagSize = 34;
  const h = W.height * scale + 70;
  const body =
    `<g transform="scale(${scale})">${W.body}</g>` +
    text(FONT.heading, 'Your cycle, understood.', w / 2, h - 12, tagSize, BRAND.inkMuted, 'middle');
  await save('logo/bloom-lockup-tagline.svg', svg(w, h, body), { width: 1600 });
}

/* ----------------------------------------------------------------- social */

// Profile avatar: survives a circular crop.
await save(
  'social/avatar.svg',
  svg(
    1080,
    1080,
    `${linear('ag', BRAND.rose, BRAND.berry)}<rect width="1080" height="1080" fill="url(#ag)"/>${mark((1080 - markWidth(560)) / 2, 250, 560, BRAND.cream, '#FFD9E6')}`,
  ),
  { width: 1080 },
);

// Instagram post, 4:5.
{
  const w = 1080;
  const h = 1350;
  const wmScale = 520 / W.width;
  const body =
    linear('pg', BRAND.petalWhite, BRAND.blush, 0, 1) +
    `<rect width="${w}" height="${h}" fill="url(#pg)"/>` +
    `<g transform="translate(${(w - W.width * wmScale) / 2} 170) scale(${wmScale})">${W.body}</g>` +
    text(FONT.display, 'Your cycle,', w / 2, 560, 104, BRAND.ink, 'middle') +
    text(FONT.display, 'understood.', w / 2, 680, 104, BRAND.ink, 'middle') +
    text(FONT.body, 'Period and cycle tracking that stays', w / 2, 790, 36, BRAND.inkMuted, 'middle') +
    text(FONT.body, 'encrypted on your phone.', w / 2, 840, 36, BRAND.inkMuted, 'middle') +
    waves(0, 960, w, 390) +
    text(FONT.medium, 'PRIVATE BY DESIGN', w / 2, 1270, 30, '#FFFFFF', 'middle', 0.14);
  await save('social/instagram-post.svg', svg(w, h, body), { width: w });
}

// Instagram / WhatsApp story, 9:16.
{
  const w = 1080;
  const h = 1920;
  const wmScale = 600 / WR.width;
  const promises = ['Encrypted on your phone', 'No ads, ever', 'Honest estimates'];
  const body =
    linear('sg', BRAND.deepBerry, BRAND.plum, 0.4, 1) +
    `<rect width="${w}" height="${h}" fill="url(#sg)"/>` +
    mark((w - markWidth(420)) / 2, 420, 420, BRAND.cream, BRAND.petal) +
    `<g transform="translate(${(w - WR.width * wmScale) / 2} 960) scale(${wmScale})">${WR.body}</g>` +
    text(FONT.heading, 'Your cycle, understood.', w / 2, 1240, 54, '#FBE0EB', 'middle') +
    promises.map((p, i) => text(FONT.medium, p, w / 2, 1480 + i * 70, 38, '#FBE0EB', 'middle')).join('');
  await save('social/instagram-story.svg', svg(w, h, body), { width: w });
}

// Profile banner (X, LinkedIn): content kept right of the avatar overlap.
{
  const w = 1500;
  const h = 500;
  const wmScale = 420 / W.width;
  const body =
    linear('bg', BRAND.petalWhite, BRAND.blush, 1, 0) +
    `<rect width="${w}" height="${h}" fill="url(#bg)"/>` +
    waves(0, 330, w, 170) +
    `<g transform="translate(${w - 120 - W.width * wmScale} 110) scale(${wmScale})">${W.body}</g>` +
    text(FONT.heading, 'Your cycle, understood.', w - 120, 290, 40, BRAND.inkMuted, 'end');
  await save('social/banner.svg', svg(w, h, body), { width: w });
}

// Google Play feature graphic, 1024 × 500.
{
  const w = 1024;
  const h = 500;
  const wmScale = 380 / WR.width;
  const body =
    linear('fg', BRAND.deepBerry, BRAND.plum) +
    `<rect width="${w}" height="${h}" fill="url(#fg)"/>` +
    mark(120, 120, 260, BRAND.cream, BRAND.petal) +
    `<g transform="translate(470 150) scale(${wmScale})">${WR.body}</g>` +
    text(FONT.heading, 'Your cycle, understood.', 474, 330, 36, '#FBE0EB') +
    text(FONT.body, 'Private period & cycle tracking', 474, 380, 26, '#E9C9D8');
  await save('social/play-feature-graphic.svg', svg(w, h, body), { width: w });
}

/* ----------------------------------------------------------------- tokens */

const tokens = {
  brand: BRAND,
  color: { light: lightColors, dark: darkColors },
  type: {
    families: {
      wordmark: 'Playfair Display SemiBold (logo only)',
      display: 'Plus Jakarta Sans (600–800)',
      body: 'Inter (400–600)',
    },
    scale: typeScale,
  },
  space,
  radii,
};
writeFileSync(out('tokens/bloom-tokens.json'), JSON.stringify(tokens, null, 2));
written.push('tokens/bloom-tokens.json');

const cssVars = (c: typeof lightColors) =>
  Object.entries(c)
    .flatMap(([k, v]) =>
      typeof v === 'string'
        ? [`  --bloom-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${v};`]
        : Object.entries(v).flatMap(([phase, p]) =>
            Object.entries(p).map(([kk, vv]) => `  --bloom-${phase}-${kk.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${vv};`),
          ),
    )
    .join('\n');
writeFileSync(
  out('tokens/bloom-tokens.css'),
  `/* Bloom design tokens — generated from theme/tokens.ts by scripts/build-brand.ts */\n:root {\n${Object.entries(BRAND)
    .map(([k, v]) => `  --bloom-brand-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${v};`)
    .join(
      '\n',
    )}\n${cssVars(lightColors)}\n}\n@media (prefers-color-scheme: dark) {\n  :root {\n${cssVars(darkColors).replace(/^/gm, '  ')}\n  }\n}\n`,
);
written.push('tokens/bloom-tokens.css');

console.log(`brand: ${written.length} files in brand/`);
for (const f of written) console.log(`  ${f}`);
