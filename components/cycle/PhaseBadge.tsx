import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { PHASES } from '@/lib/content/phases';
import { useTheme } from '@/theme/theme';
import type { Phase } from '@/theme/tokens';

export function PhaseBadge({ phase, estimated = true }: { phase: Phase; estimated?: boolean }) {
  const { colors, radii, space } = useTheme();
  const p = colors.phase[phase];
  const label = `${PHASES[phase].label.replace(' (estimated)', '')}${estimated ? ' · Estimated' : ''}`;
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.badge, { backgroundColor: p.soft, borderRadius: radii.pill, paddingHorizontal: space.md, paddingVertical: space.xs }]}
    >
      <View style={[styles.dot, { backgroundColor: p.solid }]} />
      <Text variant="caption" color={p.onSoft}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
});
