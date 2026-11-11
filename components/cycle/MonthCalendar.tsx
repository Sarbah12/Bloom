import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { monthGrid, type ISODate, type MonthKey } from '@/lib/cycle/dates';
import type { DayInfo } from '@/lib/cycle/engine';
import { formatDate, weekdayInitials } from '@/lib/format';
import { useTheme } from '@/theme/theme';

export interface CalendarDay extends DayInfo {
  hasLog: boolean;
}

export interface MonthCalendarProps {
  month: MonthKey;
  weekStartsOn: 0 | 1;
  today: ISODate;
  selected?: ISODate | null;
  onSelect?: (date: ISODate) => void;
  describe: (date: ISODate) => CalendarDay;
  /** Hide fertile/ovulation marks (a preference). */
  showFertility?: boolean;
  /** Disable future days, e.g. when picking the last period start. */
  disableFuture?: boolean;
  /** Spoken after each day's label, e.g. what a tap will do. */
  dayHint?: string;
}

function spoken(date: ISODate, info: CalendarDay, today: ISODate, selected: boolean, showFertility: boolean): string {
  const parts = [formatDate(date, 'long')];
  if (date === today) parts.push('today');
  if (info.period === 'logged') parts.push('period day');
  if (info.period === 'predicted') parts.push('predicted period');
  if (showFertility && info.ovulation) parts.push('estimated ovulation');
  else if (showFertility && info.fertile) parts.push('estimated fertile window');
  if (info.hasLog) parts.push('check-in logged');
  if (selected) parts.push('selected');
  return parts.join(', ');
}

export const MonthCalendar = memo(function MonthCalendar({
  month,
  weekStartsOn,
  today,
  selected,
  onSelect,
  describe,
  showFertility = true,
  disableFuture,
  dayHint,
}: MonthCalendarProps) {
  const { colors, space } = useTheme();
  const weeks = monthGrid(month, weekStartsOn);
  const heads = weekdayInitials(weekStartsOn);
  const menstrual = colors.phase.menstrual;
  const ovulatory = colors.phase.ovulatory;

  return (
    <View>
      <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {heads.map((h, i) => (
          <View key={i} style={styles.cell}>
            <Text variant="caption" tone="muted">
              {h.short}
            </Text>
          </View>
        ))}
      </View>
      {weeks.map((week, w) => (
        <View key={w} style={[styles.row, { marginTop: space.xs }]}>
          {week.map((date, d) => {
            if (!date) return <View key={d} style={styles.cell} />;
            const info = describe(date);
            const isToday = date === today;
            const isSelected = date === selected;
            const future = date > today;
            const disabled = !!disableFuture && future;
            const fertile = showFertility && info.fertile && !info.period;
            const ovulation = showFertility && info.ovulation && !info.period;

            let bg = 'transparent';
            let fg = future ? colors.inkMuted : colors.ink;
            let borderColor = 'transparent';
            let borderStyle: 'solid' | 'dashed' = 'solid';
            if (info.period === 'logged') {
              bg = menstrual.solid;
              fg = menstrual.onSolid;
            } else if (info.period === 'predicted') {
              borderColor = menstrual.solid;
              borderStyle = 'dashed';
              fg = colors.ink;
            } else if (ovulation) {
              bg = ovulatory.soft;
              borderColor = ovulatory.solid;
              fg = ovulatory.onSoft;
            } else if (fertile) {
              bg = ovulatory.soft;
              fg = ovulatory.onSoft;
            }
            if (isToday && borderColor === 'transparent' && info.period !== 'logged') borderColor = colors.ink;

            return (
              <Pressable
                key={d}
                style={styles.cell}
                disabled={disabled || !onSelect}
                onPress={() => onSelect?.(date)}
                accessibilityRole="button"
                accessibilityLabel={spoken(date, info, today, isSelected, showFertility)}
                accessibilityHint={disabled ? undefined : dayHint}
                accessibilityState={{ selected: isSelected, disabled }}
                aria-selected={isSelected}
                aria-disabled={disabled}
              >
                <View style={[styles.selectRing, { borderColor: isSelected ? colors.primary : 'transparent' }]}>
                  <View
                    style={[
                      styles.day,
                      {
                        backgroundColor: bg,
                        borderColor,
                        borderStyle,
                        borderWidth: borderColor === 'transparent' ? 0 : 2,
                        opacity: disabled ? 0.35 : 1,
                      },
                    ]}
                  >
                    <Text variant={isToday ? 'headline' : 'callout'} color={fg} maxFontSizeMultiplier={1.3}>
                      {Number(date.slice(8))}
                    </Text>
                  </View>
                </View>
                <View style={[styles.logDot, { backgroundColor: info.hasLog ? colors.inkMuted : 'transparent' }]} />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
});

export function CalendarLegend({ showFertility }: { showFertility: boolean }) {
  const { colors, space } = useTheme();
  const items: { label: string; swatch: object }[] = [
    { label: 'Period', swatch: { backgroundColor: colors.phase.menstrual.solid } },
    { label: 'Predicted', swatch: { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.phase.menstrual.solid } },
    ...(showFertility
      ? [
          { label: 'Fertile (est.)', swatch: { backgroundColor: colors.phase.ovulatory.soft } },
          {
            label: 'Ovulation (est.)',
            swatch: { backgroundColor: colors.phase.ovulatory.soft, borderWidth: 2, borderColor: colors.phase.ovulatory.solid },
          },
        ]
      : []),
    { label: 'Logged', swatch: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.inkMuted } },
  ];
  return (
    <View style={[styles.legend, { gap: space.md }]} accessibilityRole="summary">
      {items.map((i) => (
        <View key={i.label} style={styles.legendItem}>
          <View style={[styles.swatch, i.swatch]} />
          <Text variant="caption" tone="muted" style={{ marginLeft: space.xs }}>
            {i.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  selectRing: { borderWidth: 2, borderRadius: 24, padding: 1 },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  logDot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  swatch: { width: 14, height: 14, borderRadius: 7 },
});
