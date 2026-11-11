import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { CycleRing } from '@/components/cycle/CycleRing';
import { HeroRing } from '@/components/cycle/HeroRing';
import { PhaseBadge } from '@/components/cycle/PhaseBadge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { Notice, SectionHeader } from '@/components/ui/Feedback';
import { GradientCard } from '@/components/ui/GradientCard';
import { QuickAction, QuickActions } from '@/components/ui/QuickAction';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { FindingCard } from '@/components/insights/FindingCard';
import { CONFIDENCE_LABEL, periodHeadsUp, suggestionsForToday } from '@/lib/content/insights';
import { findDeviations } from '@/lib/cycle/changes';
import { findPatterns } from '@/lib/cycle/patterns';
import { CONTRACEPTION_DISCLAIMER, PHASES } from '@/lib/content/phases';
import { addDays, diffDays } from '@/lib/cycle/dates';
import { medicationKind, moodLabel, symptomLabel } from '@/lib/data/catalog';
import { activeMeds } from '@/lib/data/meds';
import { useCycle, useData } from '@/lib/data/store';
import { formatDate, formatRange, greeting } from '@/lib/format';
import { useTheme } from '@/theme/theme';
import { MIN_TOUCH } from '@/theme/tokens';
import { useLargeText } from '@/lib/ui/useLargeText';

function Header({ name }: { name?: string }) {
  const { colors, space, elevation, scheme } = useTheme();
  return (
    <View>
      <View style={styles.headerRow}>
        <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]} accessibilityElementsHidden importantForAccessibility="no">
          {name ? (
            <Text variant="title2" color={colors.onPrimarySoft}>
              {name.trim()[0]?.toUpperCase()}
            </Text>
          ) : (
            <Feather name="user" size={22} color={colors.onPrimarySoft} />
          )}
        </View>
        <Pressable
          onPress={() => router.push('/settings/reminders')}
          accessibilityRole="button"
          accessibilityLabel="Reminders"
          style={[
            styles.bell,
            {
              backgroundColor: colors.surface,
              shadowColor: colors.shadow,
              borderWidth: scheme === 'dark' ? 1 : 0,
              borderColor: colors.border,
              ...elevation.card,
            },
          ]}
        >
          <Feather name="bell" size={20} color={colors.ink} />
        </Pressable>
      </View>
      <Text variant="callout" tone="muted" style={{ marginTop: space.lg }}>
        {greeting()},
      </Text>
      <Text variant="display" heading>
        {name || 'Your cycle, understood.'}
      </Text>
    </View>
  );
}

function SaveWarning() {
  const { saveFailed } = useData();
  const { space } = useTheme();
  if (!saveFailed) return null;
  return (
    <View style={{ marginBottom: space.lg }}>
      <Notice tone="care" title="Your latest changes aren’t saved yet">
        Bloom couldn’t write to this phone’s secure storage. Keep the app open — it will try again automatically. If this keeps happening,
        restart your phone.
      </Notice>
    </View>
  );
}

export default function Home() {
  const { data, actions } = useData();
  const { analysis, today } = useCycle();
  const { colors, space, radii } = useTheme();
  const largeText = useLargeText();
  const showFertility = data.preferences.showFertility;
  const todayLog = data.days[today];
  const name = data.profile.name;
  const openLog = () => router.push(`/log/${today}`);

  const quick = (
    <Card style={{ marginTop: space.lg }}>
      <Text variant="title3" style={{ marginBottom: space.lg }}>
        Quick log
      </Text>
      <QuickActions>
        <QuickAction icon="droplet" label="Period" onPress={openLog} active={analysis.today?.isPeriodDay} testID="quick-period" />
        <QuickAction icon="activity" label="Symptoms" onPress={openLog} active={!!todayLog?.symptoms.length} />
        <QuickAction icon="smile" label="Mood" onPress={openLog} active={!!todayLog?.moods.length} />
        <QuickAction icon="book" label="Journal" onPress={() => router.push('/journal')} />
      </QuickActions>
    </Card>
  );

  if (!analysis.hasHistory) {
    return (
      <Screen withTabBar header={<Header name={name} />} testID="home">
        <SaveWarning />
        <GradientCard>
          <Text variant="eyebrow" color={colors.onHeroMuted}>
            Let’s begin
          </Text>
          <Text variant="title1" color={colors.onHero} style={{ marginTop: space.sm }}>
            Log a period to see your estimates
          </Text>
          <Text variant="callout" color={colors.onHeroMuted} style={{ marginTop: space.sm, marginBottom: space.xl }}>
            Once Bloom knows when your last period started, it can estimate your next one, your phase and your fertile window.
          </Text>
          <View style={{ gap: space.sm }}>
            <Button label="My period started today" icon="droplet" variant="inverse" onPress={() => actions.startPeriod(today)} />
            <Button
              label="Add an earlier period"
              variant="ghost"
              style={{ borderColor: colors.onHeroMuted }}
              onPress={() => router.push('/(tabs)/calendar')}
            />
          </View>
        </GradientCard>
        {quick}
      </Screen>
    );
  }

  const status = analysis.today!;
  const next = analysis.nextPeriod!;
  const current = analysis.projections[0];
  const stats = analysis.stats;
  const recent = [0, 1, 2].map((d) => data.days[addDays(today, -d)]).filter(Boolean);
  const suggestions = suggestionsForToday(analysis, recent);
  const entries = Object.values(data.days);
  const deviations = findDeviations(analysis, entries, today, (d) => formatDate(d));
  const headsUp = periodHeadsUp(findPatterns(entries, analysis), analysis);
  const crampsToday = !!todayLog?.symptoms.includes('cramps');
  const meds = activeMeds(data.medications);
  const showRelief = crampsToday || (status.isPeriodDay && entries.some((d) => d.symptoms.includes('cramps')));
  const upcomingFertile = analysis.projections.find((p) => p.fertileEnd >= today);
  const ovulationDay = diffDays(current.start, current.ovulation) + 1;

  let hero: { eyebrow: string; number: string; unit: string; sub: string };
  if (status.isPeriodDay) {
    hero = {
      eyebrow: 'Your period',
      number: `Day ${status.periodDay}`,
      unit: '',
      sub: status.openPeriod ? 'Tap “Period ended” when it finishes' : `Started ${formatDate(current.start)}`,
    };
  } else if (next.isLate) {
    hero = {
      eyebrow: 'Your next period',
      number: String(next.daysLate),
      unit: next.daysLate === 1 ? 'day late' : 'days late',
      sub: `Expected around ${formatDate(next.start)} · Late periods are common`,
    };
  } else if (next.daysUntil <= 1) {
    hero = {
      eyebrow: 'Your next period',
      number: next.daysUntil === 0 ? 'Today' : 'Tomorrow',
      unit: '',
      sub: `Estimated ${formatRange(next.windowStart, next.windowEnd)}`,
    };
  } else {
    hero = {
      eyebrow: 'Your next period',
      number: String(next.daysUntil),
      unit: 'days',
      sub: `Estimated ${formatRange(next.windowStart, next.windowEnd)}`,
    };
  }

  const heroAction = status.isPeriodDay ? (
    status.openPeriod ? (
      <Button
        testID="period-ended"
        label="Period ended"
        icon="check"
        variant="inverse"
        fullWidth
        onPress={() => actions.endPeriod(today)}
      />
    ) : null
  ) : next.daysUntil <= 7 ? (
    <Button
      testID="period-started"
      label="Period started"
      icon="droplet"
      variant="inverse"
      fullWidth
      onPress={() => actions.startPeriod(today)}
    />
  ) : null;

  const overview: { label: string; value: string; sub: string; dot?: string }[] = [
    { label: 'Cycle day', value: String(status.cycleDay), sub: `of ~${stats.averageCycleLength}` },
    {
      label: 'Phase',
      value: status.phase ? PHASES[status.phase].short : '—',
      sub: status.phase === 'menstrual' ? 'Logged' : 'Estimated',
      dot: status.phase ? colors.phase[status.phase].solid : undefined,
    },
    showFertility && upcomingFertile
      ? {
          label: 'Fertile (est.)',
          value: upcomingFertile.fertileStart <= today ? 'Now' : formatDate(upcomingFertile.fertileStart),
          sub: upcomingFertile.fertileStart <= today ? `until ${formatDate(upcomingFertile.fertileEnd)}` : 'window starts',
        }
      : { label: 'Avg. period', value: `${stats.averagePeriodLength}d`, sub: 'length' },
  ];

  return (
    <Screen withTabBar header={<Header name={name} />} testID="home">
      <SaveWarning />
      <GradientCard
        accessibilityLabel={`${hero.eyebrow}: ${hero.number} ${hero.unit}. ${hero.sub}. ${CONFIDENCE_LABEL[analysis.confidence]}.`}
      >
        <View style={styles.heroRow}>
          <View style={{ flex: 1, paddingRight: space.md }}>
            <Text variant="eyebrow" color={colors.onHeroMuted}>
              {hero.eyebrow}
            </Text>
            <View style={[styles.numberRow, { marginTop: space.xs }]}>
              <Text variant="hero" color={colors.onHero} adjustsFontSizeToFit numberOfLines={1}>
                {hero.number}
              </Text>
              {hero.unit ? (
                <Text variant="title2" color={colors.onHero} style={{ marginLeft: space.sm, marginBottom: 8 }}>
                  {hero.unit}
                </Text>
              ) : null}
            </View>
            <Text variant="footnote" color={colors.onHeroMuted}>
              {hero.sub}
            </Text>
          </View>
          <HeroRing day={status.cycleDay} length={stats.averageCycleLength} />
        </View>
        {status.isPeriodDay ? null : (
          <View style={[styles.pill, { borderRadius: radii.pill, borderColor: colors.onHeroMuted, marginTop: space.md }]}>
            <Feather name="compass" size={13} color={colors.onHero} />
            <Text variant="caption" color={colors.onHero} maxFontSizeMultiplier={1.3} style={{ marginLeft: 6 }}>
              {CONFIDENCE_LABEL[analysis.confidence]}
            </Text>
          </View>
        )}
        {heroAction ? <View style={{ marginTop: space.lg }}>{heroAction}</View> : null}
      </GradientCard>

      <GradientCard variant="tint" style={{ marginTop: space.lg }}>
        <View style={[styles.rowBetween, { marginBottom: space.lg, gap: space.sm }]}>
          <Text variant="title3" style={styles.flex}>
            Cycle overview
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/insights')}
            accessibilityRole="button"
            accessibilityLabel="See insights"
            hitSlop={8}
            style={[styles.smallPill, { backgroundColor: colors.surface, borderRadius: radii.pill }]}
          >
            <Text variant="caption" maxFontSizeMultiplier={1.3}>
              Insights
            </Text>
            <Feather name="chevron-right" size={14} color={colors.ink} />
          </Pressable>
        </View>
        <View style={largeText ? { gap: space.md } : styles.statsRow}>
          {overview.map((o, i) => (
            <View
              key={o.label}
              accessible
              accessibilityLabel={`${o.label}: ${o.value}, ${o.sub}`}
              style={[
                styles.stat,
                i > 0 && !largeText
                  ? { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.borderStrong, paddingLeft: space.md }
                  : null,
                i > 0 && largeText
                  ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderStrong, paddingTop: space.md }
                  : null,
              ]}
            >
              <Text variant="caption" tone="muted">
                {o.label}
              </Text>
              <View style={[styles.numberRow, { marginTop: space.sm, alignItems: 'center' }]}>
                {o.dot ? <View style={[styles.dot, { backgroundColor: o.dot }]} /> : null}
                <Text variant="title2" numberOfLines={1}>
                  {o.value}
                </Text>
              </View>
              <Text variant="caption" tone="muted">
                {o.sub}
              </Text>
            </View>
          ))}
        </View>
      </GradientCard>

      {quick}

      <Card style={{ marginTop: space.lg }}>
        <View style={styles.rowBetween}>
          <Text variant="title3">Today</Text>
          <Text variant="caption" tone="muted">
            {formatDate(today, 'weekday')}
          </Text>
        </View>
        <View style={[styles.statsRow, { marginTop: space.md, marginBottom: space.lg }]}>
          <View
            style={styles.stat}
            accessible
            accessibilityLabel={`Mood: ${todayLog?.moods.length ? todayLog.moods.map(moodLabel).join(', ') : 'not logged'}`}
          >
            <Text variant="caption" tone="muted">
              Mood
            </Text>
            <Text variant="headline" tone={todayLog?.moods.length ? 'default' : 'muted'} numberOfLines={2} style={{ marginTop: space.xs }}>
              {todayLog?.moods.length ? todayLog.moods.map(moodLabel).join(', ') : 'Not logged'}
            </Text>
          </View>
          <View
            style={[styles.stat, { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border, paddingLeft: space.md }]}
            accessible
            accessibilityLabel={`Symptoms: ${todayLog?.symptoms.length ? todayLog.symptoms.map(symptomLabel).join(', ') : 'not logged'}`}
          >
            <Text variant="caption" tone="muted">
              Symptoms
            </Text>
            <Text
              variant="headline"
              tone={todayLog?.symptoms.length ? 'default' : 'muted'}
              numberOfLines={2}
              style={{ marginTop: space.xs }}
            >
              {todayLog?.symptoms.length ? todayLog.symptoms.map(symptomLabel).join(', ') : 'Not logged'}
            </Text>
          </View>
        </View>
        <Button testID="log-today" label={todayLog ? 'Edit today’s check-in' : 'Log today’s check-in'} arrow fullWidth onPress={openLog} />
      </Card>

      {meds.length ? (
        <Card style={{ marginTop: space.lg }} testID="home-meds">
          <View style={styles.rowBetween}>
            <Text variant="title3">Today’s medications</Text>
            <Pressable accessibilityRole="link" onPress={() => router.push('/medications')} hitSlop={12}>
              <Text variant="callout" tone="primary">
                Manage
              </Text>
            </Pressable>
          </View>
          <View style={{ marginTop: space.md }}>
            <ChipGroup>
              {meds.map((m) => (
                <Chip
                  key={m.id}
                  label={m.name}
                  icon={medicationKind(m.kind).icon}
                  selected={todayLog?.medsTaken?.includes(m.id)}
                  onPress={() => actions.toggleMedTaken(today, m.id)}
                />
              ))}
            </ChipGroup>
          </View>
          <Text variant="footnote" tone="muted" style={{ marginTop: space.sm }}>
            {(() => {
              const taken = meds.filter((m) => todayLog?.medsTaken?.includes(m.id)).length;
              return taken === meds.length ? 'All done for today.' : `${taken} of ${meds.length} ticked today.`;
            })()}
          </Text>
        </Card>
      ) : null}

      {showRelief ? (
        <GradientCard
          variant="tint"
          style={{ marginTop: space.lg }}
          onPress={() => router.push('/relief')}
          accessibilityLabel="Cramp relief. Breathing, stretches and what helps you."
          testID="relief-card"
        >
          <View style={[styles.rowBetween, { gap: space.md }]}>
            <View style={[styles.reliefIcon, { backgroundColor: colors.surface }]}>
              <Feather name="heart" size={20} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text variant="title3">{crampsToday ? 'Cramps today?' : 'Cramp relief'}</Text>
              <Text variant="callout" tone="muted" style={{ marginTop: 2 }}>
                A 1-minute breathing exercise, gentle stretches and what has helped you before.
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.inkMuted} />
          </View>
        </GradientCard>
      ) : null}

      {headsUp ? (
        <Card style={{ marginTop: space.lg }} testID="heads-up">
          <View style={[styles.rowBetween, { gap: space.md, alignItems: 'flex-start' }]}>
            <View style={[styles.reliefIcon, { backgroundColor: colors.phase.luteal.soft }]}>
              <Feather name="bell" size={18} color={colors.phase.luteal.onSoft} />
            </View>
            <View style={styles.flex}>
              <Text variant="headline">{headsUp.title}</Text>
              <Text variant="callout" tone="muted" style={{ marginTop: 2 }}>
                {headsUp.body}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      <Card style={{ marginTop: space.lg }}>
        <Text variant="title3" style={{ marginBottom: space.lg }}>
          Your cycle
        </Text>
        <View style={styles.center}>
          <CycleRing
            size={176}
            cycleLength={stats.averageCycleLength}
            periodLength={diffDays(current.start, current.periodEnd) + 1}
            ovulationDay={ovulationDay}
            cycleDay={status.cycleDay}
            accessibilityLabel={`Day ${status.cycleDay} of an estimated ${stats.averageCycleLength}-day cycle${status.phase ? `, ${PHASES[status.phase].label}` : ''}`}
          >
            <Text variant="title1" align="center">
              Day {status.cycleDay}
            </Text>
            <Text variant="caption" tone="muted" align="center">
              of your cycle
            </Text>
          </CycleRing>
        </View>
        {status.phase ? (
          <View style={{ marginTop: space.lg, alignItems: 'center' }}>
            <PhaseBadge phase={status.phase} estimated={status.phase !== 'menstrual'} />
            <Text variant="callout" tone="muted" align="center" style={{ marginTop: space.sm }}>
              {PHASES[status.phase].summary}
            </Text>
          </View>
        ) : (
          <Text variant="callout" tone="muted" align="center" style={{ marginTop: space.lg }}>
            This cycle is running longer than your average, so Bloom isn’t estimating a phase.
          </Text>
        )}
      </Card>

      {analysis.notices.length || deviations.length ? (
        <>
          <SectionHeader title="Worth knowing" />
          <View style={{ gap: space.md }}>
            {analysis.notices.map((n) => (
              <Notice key={n.id} tone={n.level === 'care' ? 'care' : 'info'} title={n.title}>
                {n.body}
              </Notice>
            ))}
            {deviations.map((f) => (
              <FindingCard key={f.id} finding={f} />
            ))}
          </View>
        </>
      ) : null}

      {suggestions.length ? (
        <>
          <SectionHeader title="For you today" />
          <View style={{ gap: space.md }}>
            {suggestions.map((s) => (
              <Card key={s.title}>
                <Text variant="headline">{s.title}</Text>
                <Text variant="callout" tone="muted" style={{ marginTop: space.xs }}>
                  {s.body}
                </Text>
              </Card>
            ))}
          </View>
        </>
      ) : null}

      {showFertility ? (
        <Text variant="footnote" tone="muted" style={{ marginTop: space.xxl }}>
          {CONTRACEPTION_DISCLAIMER}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  bell: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: MIN_TOUCH / 2, alignItems: 'center', justifyContent: 'center' },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  numberRow: { flexDirection: 'row', alignItems: 'flex-end' },
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  smallPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, gap: 2, minHeight: 32 },
  statsRow: { flexDirection: 'row' },
  stat: { flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  center: { alignItems: 'center' },
  flex: { flex: 1 },
  reliefIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
