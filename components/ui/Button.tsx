import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/theme';
import { MIN_TOUCH } from '@/theme/tokens';

import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger' | 'inverse';
export type FeatherName = ComponentProps<typeof Feather>['name'];

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  icon?: FeatherName;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  /** A trailing arrow in a circle, for the main call to action on a screen. */
  arrow?: boolean;
  accessibilityHint?: string;
  style?: ViewStyle;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  loading,
  fullWidth,
  arrow,
  accessibilityHint,
  style,
  testID,
}: ButtonProps) {
  const { colors, radii, space } = useTheme();
  const inactive = disabled || loading;

  const palette = {
    primary: { bg: colors.primary, pressed: colors.primaryPressed, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: colors.surface, pressed: colors.surfaceMuted, fg: colors.ink, border: colors.borderStrong },
    soft: { bg: colors.primarySoft, pressed: colors.surfaceMuted, fg: colors.onPrimarySoft, border: colors.primarySoft },
    ghost: { bg: 'transparent', pressed: colors.surfaceMuted, fg: colors.primary, border: 'transparent' },
    danger: { bg: colors.dangerSoft, pressed: colors.surfaceMuted, fg: colors.onDangerSoft, border: colors.dangerSoft },
    /** White pill for use on hero gradients. */
    inverse: { bg: colors.onHero, pressed: colors.onHeroMuted, fg: colors.heroStart, border: colors.onHero },
  }[variant];

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      aria-disabled={!!inactive}
      aria-busy={!!loading}
      disabled={inactive}
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: size === 'lg' ? 56 : MIN_TOUCH,
          paddingHorizontal: arrow ? space.sm : size === 'lg' ? space.xxl : space.xl,
          paddingLeft: arrow ? space.xxl : undefined,
          borderRadius: radii.pill,
          backgroundColor: pressed ? palette.pressed : palette.bg,
          borderColor: palette.border,
          opacity: inactive ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={[styles.row, arrow ? styles.spread : null]}>
          <View style={styles.row}>
            {icon ? <Feather name={icon} size={18} color={palette.fg} style={{ marginRight: space.sm }} /> : null}
            <Text variant="headline" color={palette.fg}>
              {label}
            </Text>
          </View>
          {arrow ? (
            <View style={[styles.arrow, { backgroundColor: palette.fg }]}>
              <Feather name="arrow-right" size={18} color={palette.bg === 'transparent' ? colors.surface : palette.bg} />
            </View>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  spread: { alignSelf: 'stretch', justifyContent: 'space-between', flex: 1 },
  arrow: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
