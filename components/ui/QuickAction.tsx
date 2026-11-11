import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme';

import type { FeatherName } from './Button';
import { Text } from './Text';

/** A round icon button with a label underneath, for a row of shortcuts. */
export function QuickAction({
  icon,
  label,
  onPress,
  active,
  testID,
}: {
  icon: FeatherName;
  label: string;
  onPress: () => void;
  active?: boolean;
  testID?: string;
}) {
  const { colors, space } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.item, { opacity: pressed ? 0.75 : 1, gap: space.sm }]}
    >
      <View style={[styles.circle, { backgroundColor: active ? colors.primarySoft : colors.surfaceMuted }]}>
        <Feather name={icon} size={22} color={active ? colors.onPrimarySoft : colors.ink} />
      </View>
      <Text variant="caption" align="center" numberOfLines={2} maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
    </Pressable>
  );
}

export function QuickActions({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  item: { flex: 1, alignItems: 'center', minHeight: 48 },
  circle: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
});
