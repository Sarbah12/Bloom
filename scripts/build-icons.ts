/**
 * Renders the Bloom app icon, Android adaptive icon, splash mark and favicon
 * from the shared logo geometry. Run after changing the logo:
 *
 *   npm run build:icons
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import sharp from 'sharp';

import { markSvg } from '../components/brand/logo-paths.ts';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'assets/images');
mkdirSync(out, { recursive: true });

/** Brand colours for icons. Icons carry no text, so contrast rules don't apply. */
const ICON = {
  gradient: ['#F27BA6', '#A23B6D'] as [string, string],
  cream: '#FFF7F0',
  leaf: '#FFD9E6',
  brand: '#A23B6D',
  brandLeaf: '#E8A1BE',
};

async function png(name: string, svg: string, size: number) {
  const buffer = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  writeFileSync(join(out, name), buffer);
  console.log(`  ${name} (${size}×${size})`);
}

console.log('icons:');
// iOS / store icon: full-bleed gradient, no transparency allowed.
await png('icon.png', markSvg({ size: 1024, mark: ICON.cream, leaf: ICON.leaf, background: ICON.gradient, scale: 0.56 }), 1024);
// Android adaptive icon: the system crops to a circle/squircle, so keep the
// artwork inside the central 66% safe zone.
await png('android-icon-foreground.png', markSvg({ size: 1024, mark: ICON.cream, leaf: ICON.leaf, background: null, scale: 0.42 }), 1024);
await png('android-icon-background.png', markSvg({ size: 1024, mark: 'none', leaf: 'none', background: ICON.gradient }), 1024);
await png('android-icon-monochrome.png', markSvg({ size: 1024, mark: '#000000', leaf: '#000000', background: null, scale: 0.42 }), 1024);
// Splash: the mark alone on the blush background set in app.json.
await png('splash-icon.png', markSvg({ size: 512, mark: ICON.brand, leaf: ICON.brandLeaf, background: null, scale: 0.9 }), 512);
await png('favicon.png', markSvg({ size: 96, mark: ICON.cream, leaf: ICON.leaf, background: ICON.gradient, scale: 0.7 }), 96);
