import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { PackGrid } from '@/components/pill/PackGrid';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, Notice, SectionHeader } from '@/components/ui/Feedback';
import { GradientCard } from '@/components/ui/GradientCard';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { addDays, toLocalISO } from '@/lib/cycle/dates';
import { EMERGENCY_CONTRACEPTION, familyLabel, MISSED_PILL_DISCLAIMER, MISSED_PILL_INTRO, PILL_SOURCES } from '@/lib/content/pill';
import { missedPills, packDay, packSpec } from '@/lib/data/pill';
import { useCycle, useData } from '@/lib/data/store';
import { formatDate, formatTime } from '@/lib/format';
import { useTheme } from '@/theme/theme';

/** Today's pill, the pack at a glance, and help if pills were missed. */
export default function PillPackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, actions } = useData();
  const { today } = useCycle();
  const { colors, space } = useTheme();
  const med = data.medications.find((m) => m.id === id && !m.deletedAt);

  if (!med?.pack) {
    return (
      <Screen nav="back" title="Pill pack">
        <EmptyState
          icon="circle"
          title="No pack set up"
          body="Open the medication and set today’s pill number to track your pack."
          action={med ? <Button label="Set up pack" onPress={() => router.replace(`/medications/${med.id}`)} /> : undefined}
        />
      </Screen>
    );
  }

  const pack = med.pack;
  const spec = packSpec(pack.type);
  const now = packDay(pack, today)!;
  const trackedFrom = pack.setOn ?? toLocalISO(new Date(med.createdAt));
  const missed = missedPills(pack, med.id, data.days, today, trackedFrom);
  const takenToday = !!data.days[today]?.medsTaken?.includes(med.id);
  const packNumbers = missed.map((d) => packDay(pack, d)!.day);
  const week = (n: number) => Math.ceil(n / 7);

  const headline =
    now.kind === 'break'
      ? `Break day ${now.day - spec.active} of ${spec.length - spec.active}`
      : now.kind === 'inactive'
        ? `Inactive pill ${now.day} of ${spec.length}`
        : `Pill ${now.day} of ${spec.active}`;
  const next =
    now.gapIn !== null
      ? now.gapIn === 1
        ? spec.gap === 'break'
          ? 'Last pill before your break'
          : 'Inactive pills start tomorrow'
        : `${spec.gap === 'break' ? 'Break' : 'Inactive pills'} in ${now.gapIn} days`
      : `New pack ${now.nextPackIn === 1 ? 'tomorrow' : formatDate(addDays(today, now.nextPackIn), 'weekday')}`;

  return (
    <Screen
      nav="back"
      eyebrow={med.name}
      title="Pill pack"
      testID="pill-pack"
      navRight={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit medication"
          onPress={() => router.push(`/medications/${med.id}`)}
          hitSlop={12}
        >
          <Text variant="callout" tone="primary">
            Edit
          </Text>
        </Pressable>
      }
    >
      <GradientCard testID="pill-today">
        <Text variant="eyebrow" color={colors.onHeroMuted}>
          Today
        </Text>
        <Text variant="display" color={colors.onHero} style={{ marginTop: space.xs }}>
          {headline}
        </Text>
        <Text variant="callout" color={colors.onHeroMuted} style={{ marginTop: space.xs }}>
          {next}
        </Text>
        {now.takesPill ? (
          <View style={{ marginTop: space.lg }}>
            <Button
              label={takenToday ? 'Taken today' : 'I’ve taken today’s pill'}
              icon={takenToday ? 'check' : 'circle'}
              variant="inverse"
              fullWidth
              onPress={() => actions.toggleMedTaken(today, med.id)}
              testID="tick-pill"
            />
          </View>
        ) : (
          <Text variant="callout" color={colors.onHero} style={{ marginTop: space.lg }}>
            No pill today.
          </Text>
        )}
      </GradientCard>

      {missed.length ? (
        <View style={{ marginTop: space.lg }}>
          <Notice tone="care" title={`${missed.length} ${missed.length === 1 ? 'pill' : 'pills'} not ticked in this pack`}>
            <View style={{ gap: space.sm }}>
              <Text variant="footnote" color={colors.onWarningSoft}>
                {MISSED_PILL_INTRO}
              </Text>
              <Text variant="footnote" color={colors.onWarningSoft}>
                {EMERGENCY_CONTRACEPTION}
              </Text>
            </View>
          </Notice>
          <Card style={{ marginTop: space.md }} testID="pill-facts">
            <Text variant="headline">What a pharmacist will ask</Text>
            <View style={{ gap: space.xs, marginTop: space.sm }}>
              <Text variant="callout">
                • Pill type: {familyLabel(spec.family)}, {spec.label.toLowerCase()}
              </Text>
              <Text variant="callout">
                • Not ticked: pill{packNumbers.length === 1 ? '' : 's'} {packNumbers.join(', ')} (
                {missed.map((d) => formatDate(d)).join(', ')})
              </Text>
              <Text variant="callout">• Week of the pack: {[...new Set(packNumbers.map(week))].join(' and ')}</Text>
              <Text variant="callout">• Pack started {formatDate(now.packStart, 'long')}</Text>
            </View>
            <Text variant="footnote" tone="muted" style={{ marginTop: space.md }}>
              If you did take them, tick them in that day’s check-in. {MISSED_PILL_DISCLAIMER}
            </Text>
          </Card>
        </View>
      ) : null}

      <SectionHeader title="This pack" />
      <Card>
        <PackGrid pack={pack} medId={med.id} days={data.days} today={today} trackedFrom={trackedFrom} />
        <View style={[styles.legend, { marginTop: space.lg, gap: space.lg }]}>
          {[
            { label: 'Taken', style: { backgroundColor: colors.primary } },
            { label: 'Not ticked', style: { backgroundColor: colors.warningSoft, borderColor: colors.warning, borderWidth: 2 } },
            ...(spec.gap === 'break'
              ? [{ label: 'Break', style: { borderColor: colors.borderStrong, borderWidth: 2, borderStyle: 'dashed' as const } }]
              : []),
            ...(spec.gap === 'inactive' ? [{ label: 'Inactive', style: { backgroundColor: colors.surfaceMuted } }] : []),
          ].map((l) => (
            <View key={l.label} style={styles.legendItem}>
              <View style={[styles.swatch, l.style]} />
              <Text variant="caption" tone="muted">
                {l.label}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <SectionHeader title="Reminder" />
      <Text variant="callout" tone="muted">
        {med.reminder.enabled
          ? `On pill days at ${formatTime(med.reminder.hour, med.reminder.minute)}${spec.gap === 'break' ? ', plus a heads-up the day before a new pack' : ''}.`
          : 'Off. Turn it on in Edit.'}
      </Text>

      <Text variant="eyebrow" tone="muted" style={{ marginTop: space.xxl, marginBottom: space.sm }} heading>
        Sources
      </Text>
      {[PILL_SOURCES[spec.family], PILL_SOURCES.leaflets].map((src) => (
        <Pressable
          key={src.url}
          accessibilityRole="link"
          accessibilityLabel={`${src.label}, opens in your browser`}
          onPress={() => Linking.openURL(src.url)}
          style={[styles.legendItem, { minHeight: 44, gap: space.sm }]}
        >
          <Feather name="external-link" size={15} color={colors.primary} />
          <Text variant="callout" tone="primary" style={{ flex: 1 }}>
            {src.label}
          </Text>
        </Pressable>
      ))}
      <Text variant="footnote" tone="muted" style={{ marginTop: space.lg }}>
        Bloom helps you keep track of your pill. It isn’t a method of contraception and can’t tell whether you’re protected.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 6 },
});
