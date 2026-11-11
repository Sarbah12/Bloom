import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from '@/theme/theme';
import type { Colors, TypeVariant } from '@/theme/tokens';

export type TextTone = 'default' | 'muted' | 'subtle' | 'primary' | 'onPrimary' | 'danger' | 'success' | 'warning';

const toneKey: Record<TextTone, keyof Colors> = {
  default: 'ink',
  muted: 'inkMuted',
  subtle: 'inkSubtle',
  primary: 'primary',
  onPrimary: 'onPrimary',
  danger: 'danger',
  success: 'success',
  warning: 'warning',
};

/**
 * How far each size may grow with the system text size. Body text grows the
 * most (that's what people read); big display numbers are already large and
 * grow least, so layouts survive the accessibility sizes.
 */
const MAX_SCALE: Partial<Record<TypeVariant, number>> = {
  hero: 1.15,
  display: 1.25,
  title1: 1.25,
  title2: 1.35,
  title3: 1.4,
  caption: 1.4,
  eyebrow: 1.4,
};

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  tone?: TextTone;
  /** An explicit colour wins over `tone` (used for phase-tinted text). */
  color?: string;
  /** Marks the text as a heading for screen readers. */
  heading?: boolean;
  align?: 'left' | 'center' | 'right';
}

export function Text({ variant = 'body', tone = 'default', color, heading, align, style, maxFontSizeMultiplier, ...rest }: TextProps) {
  const { colors, type } = useTheme();
  const cap = maxFontSizeMultiplier ?? MAX_SCALE[variant] ?? 1.7;

  return (
    <RNText
      accessibilityRole={heading ? 'header' : rest.accessibilityRole}
      maxFontSizeMultiplier={cap}
      {...rest}
      style={[type[variant], { color: color ?? (colors[toneKey[tone]] as string) }, align ? { textAlign: align } : null, style]}
    />
  );
}
