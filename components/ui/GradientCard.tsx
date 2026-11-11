import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/theme';

/**
 * `hero`: the deep violet card that holds the one number that matters most on
 * a screen. Text inside uses `onHero` / `onHeroMuted`.
 * `tint`: a soft lavender card for supporting figures. Text uses `ink`.
 */
export function GradientCard({
  variant = 'hero',
  children,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: {
  variant?: 'hero' | 'tint';
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { colors, radii, space, elevation } = useTheme();
  const stops = variant === 'hero' ? ([colors.heroStart, colors.heroEnd] as const) : ([colors.tintStart, colors.tintEnd] as const);

  const body = (
    <LinearGradient
      colors={stops}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.fill, { borderRadius: radii.lg, padding: space.xl }]}
    >
      {children}
    </LinearGradient>
  );

  const frame: ViewStyle = {
    borderRadius: radii.lg,
    shadowColor: colors.shadow,
    ...(variant === 'hero' ? elevation.raised : {}),
  };

  if (!onPress) {
    return (
      <View testID={testID} style={[frame, style]} accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [frame, { opacity: pressed ? 0.9 : 1 }, style]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { overflow: 'hidden' },
});
