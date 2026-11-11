/**
 * Bloom design tokens.
 *
 * Everything visual comes from here: colour, type, spacing, radii and
 * elevation. Components never hard-code a hex value or a font size, so a
 * rebrand or a contrast fix is a change in one file.
 *
 * Direction: soft and feminine — blush whites, a raspberry-mauve brand colour,
 * deep berry-to-rose gradient hero cards for the one number that matters,
 * blush tints for supporting data, generous radii and floating surfaces.
 * Cycle phases use pastel rose, sage, peach and lilac, distinct enough from
 * the brand colour for the calendar to read at a glance.
 *
 * This file has no React Native imports on purpose — `scripts/check-contrast`
 * loads it in plain Node to prove every text/background pairing meets WCAG AA.
 */

export type Phase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

export interface PhaseColors {
  /** Marks, rings and icons. */
  solid: string;
  /** Tinted backgrounds (cards, calendar fills). */
  soft: string;
  /** Text placed on `soft`. */
  onSoft: string;
  /** Text placed on `solid` (e.g. a logged period day in the calendar). */
  onSolid: string;
}

export interface Colors {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  ink: string;
  inkMuted: string;
  inkSubtle: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  primarySoft: string;
  onPrimarySoft: string;
  /** Deep gradient for hero cards and the active tab: [start, end]. */
  heroStart: string;
  heroEnd: string;
  onHero: string;
  onHeroMuted: string;
  /** Soft lavender gradient for supporting cards: [start, end]. */
  tintStart: string;
  tintEnd: string;
  focus: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  onWarningSoft: string;
  danger: string;
  dangerSoft: string;
  onDangerSoft: string;
  overlay: string;
  shadow: string;
  /** Track of a switch that is off. */
  switchOff: string;
  phase: Record<Phase, PhaseColors>;
}

export const lightColors: Colors = {
  background: '#FCF7F8',
  surface: '#FFFFFF',
  surfaceMuted: '#F8EDF1',
  border: '#F1E3E8',
  borderStrong: '#9A7F89',
  ink: '#2D1A24',
  inkMuted: '#694F5B',
  inkSubtle: '#7A616C',
  primary: '#A23B6D',
  primaryPressed: '#852D58',
  onPrimary: '#FFFFFF',
  primarySoft: '#FBE4EE',
  onPrimarySoft: '#7A2550',
  heroStart: '#5E1A43',
  heroEnd: '#A33F6C',
  onHero: '#FFFFFF',
  onHeroMuted: '#FBE0EB',
  tintStart: '#FBE3EC',
  tintEnd: '#FFF5F8',
  focus: '#A23B6D',
  success: '#2F7A4E',
  successSoft: '#E1F1E7',
  warning: '#8A5200',
  warningSoft: '#FDEFE0',
  onWarningSoft: '#6B3F00',
  danger: '#B42318',
  dangerSoft: '#FDE7E4',
  onDangerSoft: '#8F1B12',
  overlay: 'rgba(45, 26, 36, 0.45)',
  shadow: '#5E1A43',
  switchOff: '#E3D3DA',
  phase: {
    menstrual: { solid: '#C8365A', soft: '#FDE4E9', onSoft: '#8E1F3C', onSolid: '#FFFFFF' },
    follicular: { solid: '#3E7A63', soft: '#E3F2EC', onSoft: '#2A5A47', onSolid: '#FFFFFF' },
    ovulatory: { solid: '#A85A18', soft: '#FDEBDD', onSoft: '#7A3E0C', onSolid: '#FFFFFF' },
    luteal: { solid: '#7A5BB5', soft: '#EFE8FA', onSoft: '#55388F', onSolid: '#FFFFFF' },
  },
};

export const darkColors: Colors = {
  background: '#140D11',
  surface: '#20161B',
  surfaceMuted: '#2C1F26',
  border: '#3A2A32',
  borderStrong: '#9A8490',
  ink: '#FAF0F4',
  inkMuted: '#D4C1CA',
  inkSubtle: '#B7A3AD',
  primary: '#F29BC0',
  primaryPressed: '#F7B6D1',
  onPrimary: '#3A0D24',
  primarySoft: '#3E1A2C',
  onPrimarySoft: '#FAD0E2',
  heroStart: '#4A1534',
  heroEnd: '#7A2A56',
  onHero: '#FFFFFF',
  onHeroMuted: '#F6D2E2',
  tintStart: '#2E1A25',
  tintEnd: '#22161C',
  focus: '#F29BC0',
  success: '#6CC58D',
  successSoft: '#16301F',
  warning: '#F0AE6A',
  warningSoft: '#3B2814',
  onWarningSoft: '#FAD6AE',
  danger: '#FF8A80',
  dangerSoft: '#3D1714',
  onDangerSoft: '#FFC4BE',
  overlay: 'rgba(0, 0, 0, 0.6)',
  shadow: '#000000',
  switchOff: '#4A3A42',
  phase: {
    menstrual: { solid: '#F27A94', soft: '#42192A', onSoft: '#FFC6D3', onSolid: '#1C0A10' },
    follicular: { solid: '#7CC7AA', soft: '#17302A', onSoft: '#B2E6D2', onSolid: '#0B1A15' },
    ovulatory: { solid: '#F0AE6A', soft: '#3B2814', onSoft: '#FAD6AE', onSolid: '#201205' },
    luteal: { solid: '#B9A1F0', soft: '#2A2142', onSoft: '#DCD0FA', onSolid: '#160F28' },
  },
};

/**
 * Pairs that must reach 4.5:1 (normal text) — checked by scripts/check.mjs.
 * Each entry is [foreground key, background key].
 */
export const TEXT_PAIRS: [keyof Colors, keyof Colors][] = [
  ['ink', 'background'],
  ['ink', 'surface'],
  ['ink', 'surfaceMuted'],
  ['ink', 'tintStart'],
  ['ink', 'tintEnd'],
  ['inkMuted', 'background'],
  ['inkMuted', 'surface'],
  ['inkMuted', 'surfaceMuted'],
  ['inkMuted', 'tintStart'],
  ['inkSubtle', 'background'],
  ['inkSubtle', 'surface'],
  ['onPrimary', 'primary'],
  ['onPrimarySoft', 'primarySoft'],
  ['primary', 'background'],
  ['primary', 'surface'],
  ['onHero', 'heroStart'],
  ['onHero', 'heroEnd'],
  ['onHeroMuted', 'heroStart'],
  ['onHeroMuted', 'heroEnd'],
  ['onWarningSoft', 'warningSoft'],
  ['onDangerSoft', 'dangerSoft'],
  ['danger', 'surface'],
  ['success', 'surface'],
];

/** Non-text marks (rings, dots, borders) need 3:1 against the surface. */
export const MARK_PAIRS: [keyof Colors, keyof Colors][] = [
  ['borderStrong', 'surface'],
  ['primary', 'surface'],
];

export const fonts = {
  display: 'PlusJakartaSans_700Bold',
  displayStrong: 'PlusJakartaSans_800ExtraBold',
  displayMedium: 'PlusJakartaSans_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
  /** Only for the "bloom" wordmark. */
  wordmark: 'PlayfairDisplay_600SemiBold',
} as const;

export interface TextStyleToken {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  textTransform?: 'uppercase';
}

/**
 * The type scale. Plus Jakarta Sans — a clean geometric sans — carries
 * headlines and the big numbers; Inter carries everything you read at length.
 */
export const typeScale = {
  hero: { fontFamily: fonts.displayStrong, fontSize: 56, lineHeight: 60, letterSpacing: -2 },
  display: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.8 },
  title1: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.5 },
  title2: { fontFamily: fonts.display, fontSize: 19, lineHeight: 25, letterSpacing: -0.3 },
  title3: { fontFamily: fonts.displayMedium, fontSize: 17, lineHeight: 23, letterSpacing: -0.2 },
  headline: { fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 21 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 22 },
  callout: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  footnote: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16 },
  eyebrow: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
  },
} satisfies Record<string, TextStyleToken>;

export type TypeVariant = keyof typeof typeScale;

/** 4-point spacing grid. `gutter` is the horizontal page margin. */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  gutter: 20,
} as const;

export const radii = {
  sm: 12,
  md: 18,
  lg: 26,
  xl: 34,
  pill: 999,
} as const;

/** Minimum touch target (Apple HIG 44pt, Material 48dp — we use the larger). */
export const MIN_TOUCH = 48;

export const elevation = {
  card: {
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  raised: {
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
} as const;

export const motion = {
  fast: 140,
  base: 220,
  slow: 360,
} as const;
