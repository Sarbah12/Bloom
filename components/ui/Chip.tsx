import Feather from '@expo/vector-icons/Feather';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme';

import type { FeatherName } from './Button';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: FeatherName;
  /** Tint used when selected. Defaults to the brand colour. */
  tint?: { bg: string; fg: string };
  /** 'checkbox' for multi-select groups, 'radio' for pick-one groups. */
  role?: 'checkbox' | 'radio';
  testID?: string;
}

export function Chip({ label, selected, onPress, icon, tint, role = 'checkbox', testID }: ChipProps) {
  const { colors, radii, space } = useTheme();
  const bg = selected ? (tint?.bg ?? colors.primary) : colors.surface;
  const fg = selected ? (tint?.fg ?? colors.onPrimary) : colors.ink;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ checked: !!selected }}
      aria-checked={!!selected}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: bg,
          borderColor: selected ? bg : colors.borderStrong,
          borderRadius: radii.pill,
          paddingHorizontal: space.lg,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        {selected ? (
          <Feather name="check" size={15} color={fg} style={{ marginRight: space.xs }} />
        ) : icon ? (
          <Feather name={icon} size={15} color={colors.inkMuted} style={{ marginRight: space.xs }} />
        ) : null}
        <Text variant="callout" color={fg}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

/** Wraps chips onto new lines, or — with `scroll` — keeps them on one sliding row. */
export function ChipGroup({ children, scroll }: { children: React.ReactNode; scroll?: boolean }) {
  const { space } = useTheme();
  if (scroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -space.gutter }}
        contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.gutter }}
      >
        {children}
      </ScrollView>
    );
  }
  return <View style={[styles.group, { gap: space.sm }]}>{children}</View>;
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  group: { flexDirection: 'row', flexWrap: 'wrap' },
});
