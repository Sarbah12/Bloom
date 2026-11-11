import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, View } from 'react-native';

import type { FeatherName } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import type { Finding } from '@/lib/cycle/changes';
import { useTheme } from '@/theme/theme';

/**
 * One change or deviation. Colour follows meaning — care (warm), good news
 * (green), plain information (neutral) — and an icon and words always carry it
 * too, never colour alone.
 */
export function FindingCard({ finding }: { finding: Finding }) {
  const { colors, radii, space } = useTheme();
  const look = {
    care: { bg: colors.warningSoft, fg: colors.onWarningSoft, sub: colors.onWarningSoft, icon: 'alert-circle' as FeatherName },
    good: { bg: colors.successSoft, fg: colors.ink, sub: colors.inkMuted, icon: 'check-circle' as FeatherName },
    info: { bg: colors.surface, fg: colors.ink, sub: colors.inkMuted, icon: 'info' as FeatherName },
  }[finding.level];
  const icon: FeatherName =
    finding.level === 'care'
      ? look.icon
      : finding.direction === 'up'
        ? 'trending-up'
        : finding.direction === 'down'
          ? 'trending-down'
          : look.icon;

  return (
    <View
      accessible
      accessibilityLabel={`${finding.title}. ${finding.detail ?? ''}. ${finding.body}`}
      style={[
        styles.card,
        {
          backgroundColor: look.bg,
          borderRadius: radii.lg,
          padding: space.lg,
          gap: space.md,
          borderWidth: finding.level === 'info' ? 1 : 0,
          borderColor: colors.border,
        },
      ]}
    >
      <Feather name={icon} size={20} color={finding.level === 'good' ? colors.success : look.fg} style={{ marginTop: 2 }} />
      <View style={styles.flex}>
        <Text variant="headline" color={look.fg}>
          {finding.title}
        </Text>
        {finding.detail ? (
          <Text variant="caption" color={look.sub} style={{ marginTop: 2 }}>
            {finding.detail}
          </Text>
        ) : null}
        <Text variant="footnote" color={look.sub} style={{ marginTop: space.xs }}>
          {finding.body}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start' },
  flex: { flex: 1 },
});
