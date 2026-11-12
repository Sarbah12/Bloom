import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { addDays, type ISODate } from '@/lib/cycle/dates';
import { packDay, packSpec, type PillPack } from '@/lib/data/pill';
import { useTheme } from '@/theme/theme';

export type PillCellState = 'taken' | 'missed' | 'today' | 'upcoming' | 'break' | 'inactive' | 'untracked';

/**
 * The current pack as a 7-wide grid, like the blister pack itself. Taken
 * pills are filled, missed ones carry a warning ring and an "!", break days
 * are dashed, inactive pills are muted. Each state has a shape or mark as
 * well as a colour, and the grid has a spoken summary.
 */
export function PackGrid({
  pack,
  medId,
  days,
  today,
  trackedFrom,
}: {
  pack: PillPack;
  medId: string;
  days: Record<ISODate, { medsTaken?: string[] } | undefined>;
  today: ISODate;
  trackedFrom: ISODate;
}) {
  const { colors } = useTheme();
  const spec = packSpec(pack.type);
  const now = packDay(pack, today);
  if (!now) return null;

  const cells = Array.from({ length: spec.length }, (_, i) => {
    const date = addDays(now.packStart, i);
    const info = packDay(pack, date)!;
    const ticked = !!days[date]?.medsTaken?.includes(medId);
    let state: PillCellState;
    if (info.kind === 'break') state = 'break';
    else if (ticked) state = 'taken';
    else if (date === today) state = 'today';
    else if (date > today) state = info.kind === 'inactive' ? 'inactive' : 'upcoming';
    else if (date < trackedFrom) state = 'untracked';
    else state = info.kind === 'inactive' ? 'inactive' : 'missed';
    return { n: i + 1, date, state, isToday: date === today };
  });

  const taken = cells.filter((c) => c.state === 'taken').length;
  const missed = cells.filter((c) => c.state === 'missed').length;
  const summary = `Pack: ${taken} taken${missed ? `, ${missed} not ticked` : ''}. Today is ${now.kind === 'break' ? `break day ${now.day - spec.active}` : `pill ${now.day}`}.`;

  const look = (s: PillCellState) => {
    switch (s) {
      case 'taken':
        return { bg: colors.primary, fg: colors.onPrimary, border: colors.primary, dashed: false };
      case 'missed':
        return { bg: colors.warningSoft, fg: colors.onWarningSoft, border: colors.warning, dashed: false };
      case 'break':
        return { bg: 'transparent', fg: colors.inkSubtle, border: colors.borderStrong, dashed: true };
      case 'inactive':
        return { bg: colors.surfaceMuted, fg: colors.inkMuted, border: colors.surfaceMuted, dashed: false };
      case 'today':
        return { bg: colors.surface, fg: colors.ink, border: colors.ink, dashed: false };
      default:
        return { bg: colors.surface, fg: colors.inkMuted, border: colors.border, dashed: false };
    }
  };

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} style={styles.grid}>
      {cells.map((c) => {
        const l = look(c.state);
        return (
          <View key={c.n} style={styles.cellWrap}>
            <View
              style={[
                styles.cell,
                {
                  backgroundColor: l.bg,
                  borderColor: c.isToday && c.state !== 'today' ? colors.ink : l.border,
                  borderWidth: c.isToday || c.state === 'missed' || l.dashed ? 2 : 1,
                  borderStyle: l.dashed ? 'dashed' : 'solid',
                },
              ]}
            >
              <Text variant="caption" color={l.fg}>
                {c.state === 'missed' ? '!' : c.n}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  cellWrap: { width: `${100 / 7}%`, alignItems: 'center' },
  cell: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
