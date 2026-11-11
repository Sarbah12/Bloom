import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { addMonths, firstOfMonth, type MonthKey } from '@/lib/cycle/dates';
import { formatDate } from '@/lib/format';
import { useTheme } from '@/theme/theme';
import { MIN_TOUCH } from '@/theme/tokens';

export function MonthHeader({
  month,
  onChange,
  maxMonth,
  minMonth,
  onToday,
}: {
  month: MonthKey;
  onChange: (next: MonthKey) => void;
  maxMonth?: MonthKey;
  minMonth?: MonthKey;
  onToday?: () => void;
}) {
  const { colors, space } = useTheme();
  const canBack = !minMonth || month > minMonth;
  const canForward = !maxMonth || month < maxMonth;
  const label = formatDate(firstOfMonth(month), 'month');

  const arrow = (dir: -1 | 1, enabled: boolean) => (
    <Pressable
      onPress={() => onChange(addMonths(month, dir))}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={dir < 0 ? 'Previous month' : 'Next month'}
      accessibilityState={{ disabled: !enabled }}
      style={[styles.arrow, { opacity: enabled ? 1 : 0.3 }]}
    >
      <Feather name={dir < 0 ? 'chevron-left' : 'chevron-right'} size={22} color={colors.ink} />
    </Pressable>
  );

  return (
    <View style={[styles.row, { marginBottom: space.md }]}>
      {arrow(-1, canBack)}
      <Pressable
        style={styles.title}
        onPress={onToday}
        disabled={!onToday}
        accessibilityRole={onToday ? 'button' : 'header'}
        accessibilityLabel={onToday ? `${label}. Go to today` : label}
      >
        <Text variant="title3" align="center" accessibilityLiveRegion="polite">
          {label}
        </Text>
      </Pressable>
      {arrow(1, canForward)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  arrow: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, minHeight: MIN_TOUCH, justifyContent: 'center' },
});
