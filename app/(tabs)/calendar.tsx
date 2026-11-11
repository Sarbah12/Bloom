import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, View } from 'react-native';

import { CalendarLegend, MonthCalendar, type CalendarDay } from '@/components/cycle/MonthCalendar';
import { MonthHeader } from '@/components/cycle/MonthHeader';
import { PhaseBadge } from '@/components/cycle/PhaseBadge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { GradientCard } from '@/components/ui/GradientCard';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { CONTRACEPTION_DISCLAIMER } from '@/lib/content/phases';
import { addMonths, monthOf, type ISODate } from '@/lib/cycle/dates';
import { describeDay } from '@/lib/cycle/engine';
import { flowLabel, moodLabel, symptomLabel } from '@/lib/data/catalog';
import { useCycle, useData } from '@/lib/data/store';
import { formatDate } from '@/lib/format';
import { useTheme } from '@/theme/theme';

export default function CalendarScreen() {
  const { data, actions } = useData();
  const { analysis, today } = useCycle();
  const { space } = useTheme();
  const [month, setMonth] = useState(monthOf(today));
  const [selected, setSelected] = useState<ISODate>(today);
  const [editing, setEditing] = useState(false);
  const showFertility = data.preferences.showFertility;

  // In edit mode a tap marks or unmarks the day straight away — the quickest
  // way to log a whole period, or fix an old one.
  const onDayPress = (date: ISODate) => {
    if (!editing) return setSelected(date);
    if (date > today) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    actions.togglePeriodDay(date);
  };

  const describe = useCallback(
    (date: ISODate): CalendarDay => ({
      ...describeDay(analysis, date, today),
      hasLog: !!data.days[date],
    }),
    [analysis, data.days, today],
  );

  const info = describe(selected);
  const log = data.days[selected];
  const future = selected > today;

  const details: string[] = [];
  if (log?.flow) details.push(`Flow: ${flowLabel(log.flow)}`);
  if (log?.symptoms.length) details.push(`Symptoms: ${log.symptoms.map(symptomLabel).join(', ')}`);
  if (log?.moods.length) details.push(`Mood: ${log.moods.map(moodLabel).join(', ')}`);

  const estimate =
    info.period === 'predicted'
      ? 'Period expected (estimate)'
      : showFertility && info.ovulation
        ? 'Estimated ovulation'
        : showFertility && info.fertile
          ? 'Estimated fertile window'
          : null;

  return (
    <Screen withTabBar title="Calendar" subtitle={editing ? undefined : 'Tap a day to see or log it.'} testID="calendar">
      {editing ? (
        <GradientCard variant="tint" style={{ marginBottom: space.lg }}>
          <Text variant="title3">Editing period days</Text>
          <Text variant="callout" tone="muted" style={{ marginTop: space.xs, marginBottom: space.lg }}>
            Tap each day you bled. Tap a marked day again to remove it.
          </Text>
          <Button testID="finish-editing" label="Done" icon="check" onPress={() => setEditing(false)} />
        </GradientCard>
      ) : (
        <View style={{ alignItems: 'flex-start', marginBottom: space.lg }}>
          <Button testID="edit-period" label="Edit period days" icon="edit-2" variant="soft" onPress={() => setEditing(true)} />
        </View>
      )}
      <Card padded={false} style={{ paddingHorizontal: space.sm, paddingVertical: space.lg }}>
        <MonthHeader
          month={month}
          onChange={setMonth}
          minMonth={addMonths(monthOf(today), -36)}
          maxMonth={addMonths(monthOf(today), 12)}
          onToday={() => {
            setMonth(monthOf(today));
            setSelected(today);
          }}
        />
        <MonthCalendar
          month={month}
          weekStartsOn={data.preferences.weekStartsOn}
          today={today}
          selected={editing ? null : selected}
          onSelect={onDayPress}
          describe={describe}
          showFertility={showFertility}
          disableFuture={editing}
          dayHint={editing ? 'Marks or unmarks this day as a period day' : undefined}
        />
        <View style={{ marginTop: space.lg, paddingHorizontal: space.md }}>
          <CalendarLegend showFertility={showFertility} />
        </View>
      </Card>

      {editing ? null : (
        <Card style={{ marginTop: space.lg }} testID="day-panel">
          <Text variant="title3" heading>
            {formatDate(selected, 'long')}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: space.sm,
              marginTop: space.sm,
              alignItems: 'center',
            }}
          >
            {info.cycleDay ? (
              <Text variant="callout" tone="muted">
                Cycle day {info.cycleDay}
              </Text>
            ) : null}
            {info.phase ? <PhaseBadge phase={info.phase} estimated={info.period !== 'logged'} /> : null}
          </View>
          {estimate ? (
            <Text variant="callout" style={{ marginTop: space.sm }}>
              {estimate}
            </Text>
          ) : null}
          {details.map((d) => (
            <Text key={d} variant="callout" style={{ marginTop: space.xs }}>
              {d}
            </Text>
          ))}
          {log?.note ? (
            <Text variant="callout" tone="muted" numberOfLines={3} style={{ marginTop: space.xs }}>
              “{log.note}”
            </Text>
          ) : null}

          {future ? (
            <Text variant="footnote" tone="muted" style={{ marginTop: space.md }}>
              You can log this day once it arrives.
            </Text>
          ) : (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: space.sm,
                marginTop: space.lg,
              }}
            >
              <Button
                testID="toggle-period-day"
                label={info.period === 'logged' ? 'Remove period day' : 'Mark period day'}
                icon="droplet"
                variant={info.period === 'logged' ? 'secondary' : 'primary'}
                onPress={() => actions.togglePeriodDay(selected)}
              />
              <Button
                label={log ? 'Edit check-in' : 'Check in'}
                icon="edit-3"
                variant="soft"
                onPress={() => router.push(`/log/${selected}`)}
              />
            </View>
          )}
        </Card>
      )}

      {showFertility ? (
        <Text variant="footnote" tone="muted" style={{ marginTop: space.xl }}>
          {CONTRACEPTION_DISCLAIMER}
        </Text>
      ) : null}
    </Screen>
  );
}
