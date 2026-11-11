/**
 * Writes the machine-readable half of the Bloom design-system artifact —
 * tokens.json and the font files — into brand/design-system/project/, straight
 * from theme/tokens.ts so the published system always matches the app.
 *
 *   npm run build:design-system
 *
 * The prose (README, component guidelines, previews, cover) lives beside it
 * in brand/design-system/project/ and is edited by hand.
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { darkColors, lightColors, radii, space, typeScale, type Colors } from '../theme/tokens.ts';

const root = new URL('..', import.meta.url).pathname;
const project = join(root, 'brand/design-system/project');
mkdirSync(join(project, 'fonts'), { recursive: true });

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** Where each colour is used — shown beside every token in the system. */
const USAGE: Record<string, string> = {
  background: 'Page background behind every screen. `ink`, `ink-muted` and `ink-subtle` read on it in both themes.',
  surface: 'Cards, list groups, the floating tab bar and sheets. Floats on `background` with `shadow-card`.',
  'surface-muted': 'Quiet fills: inactive quick-action circles, segmented-control tracks, the check-in card.',
  border: 'Hairlines between list rows and around cards in the dark theme. Decorative only.',
  'border-strong': 'Borders that carry meaning: unselected chips, text fields. 3:1 on `surface` in both themes.',
  ink: 'Headings and body text on `background`, `surface`, `surface-muted` and the tint gradient.',
  'ink-muted': 'Secondary text: subtitles, captions, helper text. 4.5:1 on `background`, `surface` and `surface-muted`.',
  'ink-subtle': 'Placeholders and the least important labels. 4.5:1 on `background` and `surface`.',
  primary: 'Bloom raspberry. Primary buttons, the active tab, selected chips, links. Text on it uses `on-primary`.',
  'primary-pressed': 'Pressed state of primary buttons and pills.',
  'on-primary': 'Text and icons on `primary`.',
  'primary-soft': 'Soft buttons, icon tiles in list rows, the avatar circle.',
  'on-primary-soft': 'Text and icons on `primary-soft`.',
  'hero-start': 'Deep berry. Start of the hero gradient (top-left) for the one number that matters on a screen.',
  'hero-end': 'Plum. End of the hero gradient (bottom-right).',
  'on-hero': 'Large numbers and headings on the hero gradient. 4.5:1 on both ends.',
  'on-hero-muted': 'Supporting text on the hero gradient. 4.5:1 on both ends.',
  'tint-start': 'Blush. Start of the soft tint gradient used for supporting cards (Cycle overview, the Learn banner).',
  'tint-end': 'End of the soft tint gradient.',
  focus: 'Keyboard focus ring: 2px solid, offset 2px.',
  success: 'Positive confirmations, always with a word or icon.',
  'success-soft': 'Background for success notices.',
  warning: 'Caution text. Pair with a word, never colour alone.',
  'warning-soft': 'Background of “worth knowing” and care notices.',
  'on-warning-soft': 'Text on `warning-soft`.',
  danger: 'Destructive actions (Delete all my data) and errors. Always with a word.',
  'danger-soft': 'Background of destructive buttons and error notices.',
  'on-danger-soft': 'Text on `danger-soft`.',
  overlay: 'Scrim behind sheets and dialogs.',
  shadow: 'Colour of elevation shadows (see `shadow-card`, `shadow-raised`).',
  'switch-off': 'Track of a switch that is off.',
};

const PHASE_USAGE: Record<string, string> = {
  menstrual: 'Logged period days (filled), predicted days (dashed ring), period phase marks. Never used for the brand.',
  follicular: 'Follicular phase marks in rings, badges and charts.',
  ovulatory: 'Estimated fertile window (soft fill) and ovulation (ring). Always labelled “est.”.',
  luteal: 'Luteal phase marks; also pattern dots for “before your period”.',
};

type Token = { name: string; value: string | Record<string, string>; usage: string };
const colorTokens: Token[] = [];

for (const key of Object.keys(lightColors) as (keyof Colors)[]) {
  if (key === 'phase') continue;
  const name = kebab(key);
  colorTokens.push({
    name,
    value: { light: lightColors[key] as string, dark: darkColors[key] as string },
    usage: USAGE[name] ?? 'Interface colour.',
  });
}
for (const phase of Object.keys(lightColors.phase) as (keyof Colors['phase'])[]) {
  const l = lightColors.phase[phase];
  const d = darkColors.phase[phase];
  colorTokens.push(
    { name: phase, value: { light: l.solid, dark: d.solid }, usage: PHASE_USAGE[phase] },
    { name: `${phase}-soft`, value: { light: l.soft, dark: d.soft }, usage: `Soft ${phase} fills (calendar days, badges).` },
    { name: `${phase}-on-soft`, value: { light: l.onSoft, dark: d.onSoft }, usage: `Text on \`${phase}-soft\`.` },
    {
      name: `${phase}-on-solid`,
      value: { light: l.onSolid, dark: d.onSolid },
      usage: `Text on \`${phase}\` (e.g. the day number of a logged period).`,
    },
  );
}
colorTokens.push(
  { name: 'rose', value: '#f27ba6', usage: 'Brand only: top-left of the app icon gradient. Not for UI text.' },
  { name: 'petal', value: '#e8a1be', usage: 'Brand only: the leaves of the mark on light and dark grounds.' },
  { name: 'cream', value: '#fff7f0', usage: 'Brand only: the drop of the mark on the berry gradient and app icon.' },
);

const px = (n: number) => `${n}px`;
const style = (name: keyof typeof typeScale, sample: string, usage: string, weight: number) => {
  const t = typeScale[name] as { fontSize: number; lineHeight: number; letterSpacing?: number };
  return {
    name: kebab(name),
    fontSize: px(t.fontSize),
    lineHeight: px(t.lineHeight),
    fontWeight: weight,
    ...(t.letterSpacing ? { letterSpacing: px(t.letterSpacing) } : {}),
    sample,
    usage,
  };
};

const tokens = {
  name: 'Bloom',
  version: 1,
  meta: {
    source: 'codebase',
    paths: { tokens: ['theme/tokens.ts'], fonts: ['node_modules/@expo-google-fonts/*'], assets: ['brand/logo', 'brand/social'] },
    synced: new Date().toISOString().slice(0, 10),
  },
  color: {
    themes: [
      { id: 'light', name: 'Light' },
      { id: 'dark', name: 'Dark' },
    ],
    tokens: colorTokens,
  },
  type: {
    fonts: [
      { family: 'Plus Jakarta Sans', file: 'fonts/PlusJakartaSans-SemiBold.ttf', weight: '600' },
      { family: 'Plus Jakarta Sans', file: 'fonts/PlusJakartaSans-Bold.ttf', weight: '700' },
      { family: 'Plus Jakarta Sans', file: 'fonts/PlusJakartaSans-ExtraBold.ttf', weight: '800' },
      { family: 'Inter', file: 'fonts/Inter-Regular.ttf', weight: '400' },
      { family: 'Inter', file: 'fonts/Inter-Medium.ttf', weight: '500' },
      { family: 'Inter', file: 'fonts/Inter-SemiBold.ttf', weight: '600' },
      { family: 'Playfair Display', file: 'fonts/PlayfairDisplay-SemiBold.ttf', weight: '600' },
    ],
    families: {
      display: '"Plus Jakarta Sans", system-ui, sans-serif',
      body: 'Inter, system-ui, sans-serif',
      wordmark: '"Playfair Display", Georgia, serif',
    },
    groups: [
      {
        name: 'Display',
        family: 'display',
        note: 'Plus Jakarta Sans for headings and the numbers that matter. Tight tracking at large sizes.',
        styles: [
          style('hero', '4 days', 'The single big number in a hero card. Once per screen.', 800),
          style('display', 'Your cycle, understood.', 'Screen titles.', 700),
          style('title1', 'Cycle overview', 'Large card titles, onboarding questions.', 700),
          style('title2', 'Your patterns', 'Section headers.', 700),
          style('title3', 'Quick log', 'Card titles.', 600),
        ],
      },
      {
        name: 'Text',
        family: 'body',
        note: 'Inter for everything people read at length.',
        styles: [
          style('headline', 'Period coming up', 'Row titles, button labels.', 600),
          style('body', 'Tap the first day of bleeding. An approximate date is fine.', 'Running text, articles.', 400),
          style('bodyStrong', 'Cycle settings', 'List row titles.', 500),
          style('callout', 'Estimated Nov 17 – Nov 19', 'Supporting lines in cards.', 400),
          style('footnote', 'Patterns describe what you’ve logged. They aren’t a diagnosis.', 'Disclaimers, helper text.', 400),
          style('caption', '14 of 14 logs · 7 cycles', 'Metadata and chart labels.', 500),
          style('eyebrow', 'Your next period', 'Small label above a big value.', 500),
        ],
      },
      {
        name: 'Wordmark',
        family: 'wordmark',
        note: 'Playfair Display is reserved for the “bloom” wordmark. Never set UI text in it.',
        styles: [
          {
            name: 'wordmark',
            fontSize: '64px',
            lineHeight: '72px',
            fontWeight: 600,
            sample: 'bloom',
            usage: 'The logo only — use the supplied artwork.',
          },
        ],
      },
    ],
  },
  spacing: {
    note: '4-point grid. Screens use a 20px side gutter.',
    tokens: [
      { name: 'space-xxs', value: px(space.xxs), usage: 'Hairline nudges, text under a label.' },
      { name: 'space-xs', value: px(space.xs), usage: 'Icon-to-label gaps in chips.' },
      { name: 'space-sm', value: px(space.sm), usage: 'Gaps between chips and small items.' },
      { name: 'space-md', value: px(space.md), usage: 'Gaps between cards in a grid; row padding.' },
      { name: 'space-lg', value: px(space.lg), usage: 'Gap between stacked cards; list row padding.' },
      { name: 'space-xl', value: px(space.xl), usage: 'Card inner padding.' },
      { name: 'space-xxl', value: px(space.xxl), usage: 'Space above section headers.' },
      { name: 'space-xxxl', value: px(space.xxxl), usage: 'Empty-state breathing room.' },
      { name: 'space-huge', value: px(space.huge), usage: 'Top of the welcome screen.' },
      { name: 'gutter', value: px(space.gutter), usage: 'Left and right page margin on every screen.' },
    ],
  },
  radius: {
    note: 'Generous, soft corners; pills for anything tappable.',
    tokens: [
      { name: 'radius-sm', value: px(radii.sm), usage: 'Icon tiles in list rows.' },
      { name: 'radius-md', value: px(radii.md), usage: 'Text fields, notices, stat tiles.' },
      { name: 'radius-lg', value: px(radii.lg), usage: 'Cards and hero cards.' },
      { name: 'radius-xl', value: px(radii.xl), usage: 'Large brand shapes and covers.' },
      { name: 'radius-pill', value: px(radii.pill), usage: 'Buttons, chips, segmented controls, the tab bar.' },
    ],
  },
  shadow: {
    note: 'Two soft elevations tinted with deep berry; black in the dark theme, where cards also get a hairline border.',
    tokens: [
      {
        name: 'shadow-card',
        value: { light: '0 8px 20px #5e1a430f', dark: '0 8px 20px #0000000f' },
        usage: 'Cards and list groups floating on `background`.',
      },
      {
        name: 'shadow-raised',
        value: { light: '0 12px 28px #5e1a4329', dark: '0 12px 28px #00000029' },
        usage: 'Hero cards and the floating tab bar.',
      },
    ],
  },
};

writeFileSync(join(project, 'tokens.json'), JSON.stringify(tokens, null, 2));

const font = (pkg: string, weight: string, name: string, out: string) =>
  copyFileSync(join(root, 'node_modules/@expo-google-fonts', pkg, weight, `${name}.ttf`), join(project, 'fonts', out));
font('plus-jakarta-sans', '600SemiBold', 'PlusJakartaSans_600SemiBold', 'PlusJakartaSans-SemiBold.ttf');
font('plus-jakarta-sans', '700Bold', 'PlusJakartaSans_700Bold', 'PlusJakartaSans-Bold.ttf');
font('plus-jakarta-sans', '800ExtraBold', 'PlusJakartaSans_800ExtraBold', 'PlusJakartaSans-ExtraBold.ttf');
font('inter', '400Regular', 'Inter_400Regular', 'Inter-Regular.ttf');
font('inter', '500Medium', 'Inter_500Medium', 'Inter-Medium.ttf');
font('inter', '600SemiBold', 'Inter_600SemiBold', 'Inter-SemiBold.ttf');
font('playfair-display', '600SemiBold', 'PlayfairDisplay_600SemiBold', 'PlayfairDisplay-SemiBold.ttf');

console.log(
  `design system: ${colorTokens.length} colours, ${tokens.type.groups.reduce((n, g) => n + g.styles.length, 0)} text styles, 7 fonts`,
);
