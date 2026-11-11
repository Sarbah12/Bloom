import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/theme';

export interface CardProps {
  children: ReactNode;
  /** Tints the card; text inside should use the matching `onSoft` colour. */
  background?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  padded?: boolean;
  flat?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Card({
  children,
  background,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  padded = true,
  flat,
  style,
  testID,
}: CardProps) {
  const { colors, radii, space, elevation, scheme } = useTheme();
  const base: ViewStyle = {
    backgroundColor: background ?? colors.surface,
    borderRadius: radii.lg,
    padding: padded ? space.xl : 0,
    // Floating white cards on light; a hairline edge where shadows don't show.
    borderWidth: background || scheme === 'light' ? 0 : 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    ...(flat || background ? {} : elevation.card),
  };

  if (!onPress) {
    return (
      <View testID={testID} style={[base, style]} accessibilityLabel={accessibilityLabel}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1 }, style]}
    >
      {children}
    </Pressable>
  );
}
