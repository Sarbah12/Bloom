import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CycleHistoryChart } from '@/components/cycle/CycleHistoryChart';
import { CycleRing } from '@/components/cycle/CycleRing';
import { FindingCard } from '@/components/insights/FindingCard';
import { TrendChart } from '@/components/insights/TrendChart';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { GradientCard } from '@/components/ui/GradientCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Controls';
import { EmptyState, Notice, SectionHeader, StatTile } from '@/components/ui/Feedback';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { CONFIDENCE_LABEL, describePattern, PATTERN_DISCLAIMER, TIMING_PHASE } from '@/lib/content/insights';
import { CONTRACEPTION_DISCLAIMER, PHASES } from '@/lib/content/phases';
import { findChanges, findDeviations } from '@/lib/cycle/changes';
import { lifestyleByWindow, lifestyleNotes } from '@/lib/cycle/lifestyle';
import { byCycleDay, byMonth, peakDays, topTrendKeys, type TrendKey } from '@/lib/cycle/trends';
import { addDays, formatParts } from '@/lib/cycle/dates';
import type { Phase } from '@/lib/cycle/engine';
import { findPatterns, summarizeRange } from '@/lib/cycle/patterns';
import { moodLabel, symptomLabel } from '@/lib/data/catalog';
import { useCycle, useData } from '@/lib/data/store';
import { formatDate, formatRange, plural } from '@/lib/format';
import { formatHours } from '@/lib/units';
import { useTheme } from '@/theme/theme';

export default function Insights() {
  const { data } = useData();
  const { analysis, today } = useCycle();
  const { colors, space } = useTheme();
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [trendPick, setTrendPick] = useState<string>();
  const [trendMode, setTrendMode] = useState<'cycleDay' | 'month'>('cycleDay');
  const entries = useMemo(() => Object.values(data.days), [data.days]);
  const patterns = useMemo(() => findPatterns(entries, analysis), [entries, analysis]);
  const changes = useMemo(() => findChanges(analysis, entries, today, symptomLabel), [analysis, entries, today]);
  const trendKeys = useMemo(() => topTrendKeys(entries), [entries]);
  const trend: TrendKey | undefined = trendKeys.find((k) => `${k.kind}:${k.key}` === trendPick) ?? trendKeys[0];
  const trendBuckets = useMemo(
    () => (trend ? (trendMode === 'cycleDay' ? byCycleDay(entries, analysis.episodes, trend) : byMonth(entries, trend, today)) : []),
    [trend, trendMode, entries, analysis.episodes, today],
  );
  const trendName = trend ? (trend.kind === 'symptom' ? symptomLabel(trend.key) : `Feeling ${moodLabel(trend.key).toLowerCase()}`) : '';
  const peak = trend && trendMode === 'cycleDay' ? peakDays(trendBuckets) : null;
  const life = useMemo(() => {
    const recent = entries.filter((d) => d.date > addDays(today, -30));
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    return {
      sleep: mean(recent.map((d) => d.sleepHours).filter((n): n is number => n !== undefined)),
      water: mean(recent.map((d) => d.water).filter((n): n is number => n !== undefined)),
      active: recent.filter((d) => d.exercise && d.exercise !== 'none').length,
      activityLogged: recent.filter((d) => d.exercise).length,
      notes: lifestyleNotes(lifestyleByWindow(entries, analysis.episodes)),
    };
  }, [entries, analysis.episodes, today]);
  const deviations = useMemo(() => findDeviations(analysis, entries, today, (d) => formatDate(d)), [analysis, entries, today]);

  const [y, m] = today.split('-').map(Number);
  const from = period === 'month' ? formatParts(y, m, 1) : formatParts(y, 1, 1);
  const report = summarizeRange(entries, analysis, from, today);
  const stats = analysis.stats;
  const upcoming = analysis.projections.find((p) => p.fertileEnd >= today);
  const ovuDay = Math.max(stats.averagePeriodLength + 2, stats.averageCycleLength - 14);
  const phaseDays: { phase: Phase; days: number }[] = [
    { phase: 'menstrual', days: stats.averagePeriodLength },
    { phase: 'follicular', days: Math.max(0, ovuDay - 2 - stats.averagePeriodLength) },
    { phase: 'ovulatory', days: 3 },
    { phase: 'luteal', days: Math.max(0, stats.averageCycleLength - (ovuDay + 1)) },
  ];

  if (!analysis.hasHistory) {
    return (
      <Screen withTabBar title="Insights" testID="insights">
        <EmptyState
          icon="bar-chart-2"
          title="Insights grow with your history"
          body="Log your periods and daily check-ins. After a couple of cycles, Bloom will show your averages, how regular you are, and patterns in your symptoms."
          action={<Button label="Go to calendar" variant="soft" onPress={() => router.push('/(tabs)/calendar')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen withTabBar title="Insights" subtitle="Patterns from what you've logged. Estimates, not diagnoses." testID="insights">
      <Card>
        <Text variant="title3">Your average cycle</Text>
        <Text variant="footnote" tone="muted" style={{ marginTop: 2, marginBottom: space.lg }}>
          {stats.basis === 'history' ? `From your last ${plural(stats.countedCycles, 'cycle')}` : 'Will adapt as you log more cycles'}
        </Text>
        <View style={[styles.phaseRow, { gap: space.lg, alignItems: 'center' }]}>
          <CycleRing
            size={132}
            cycleLength={stats.averageCycleLength}
            periodLength={stats.averagePeriodLength}
            ovulationDay={ovuDay}
            cycleDay={analysis.today?.cycleDay ?? 1}
            accessibilityLabel={`Average cycle of ${stats.averageCycleLength} days`}
          >
            <Text variant="title1">{stats.averageCycleLength}</Text>
            <Text variant="caption" tone="muted">
              days
            </Text>
          </CycleRing>
          <View style={[styles.flex, { gap: space.sm }]}>
            {phaseDays.map((p) => (
              <View
                key={p.phase}
                style={[styles.phaseRow, { alignItems: 'center', gap: space.sm }]}
                accessible
                accessibilityLabel={`${PHASES[p.phase].short}: about ${plural(p.days, 'day')}`}
              >
                <View style={[styles.square, { backgroundColor: colors.phase[p.phase].solid }]} />
                <Text variant="callout" style={styles.flex}>
                  {PHASES[p.phase].short}
                </Text>
                <Text variant="headline">{p.days}d</Text>
              </View>
            ))}
          </View>
        </View>
      </Card>
      <View style={{ height: space.lg }} />
      <View style={[styles.grid, { gap: space.md }]}>
        <StatTile
          label="Avg. cycle"
          value={`${stats.averageCycleLength} days`}
          caption={
            stats.basis === 'history'
              ? `Last ${plural(stats.countedCycles, 'cycle')}`
              : stats.basis === 'blended'
                ? 'Your logs + typical length'
                : 'From what you entered'
          }
        />
        <StatTile
          label="Avg. period"
          value={`${stats.averagePeriodLength} days`}
          caption={analysis.episodes.some((e) => !e.endIsEstimated) ? 'From logged periods' : 'From what you entered'}
        />
      </View>
      <View style={[styles.grid, { gap: space.md, marginTop: space.md }]}>
        <StatTile
          label="Variation"
          value={stats.variation === null ? '—' : `${stats.variation} days`}
          caption={stats.variation === null ? 'Needs 2+ cycles' : 'Shortest to longest'}
        />
        <StatTile label="Cycles logged" value={String(analysis.cycles.length)} caption={`${stats.countedCycles} used for estimates`} />
      </View>

      <Card style={{ marginTop: space.lg }} background={colors.surfaceMuted}>
        <Text variant="eyebrow" tone="muted">
          Prediction confidence
        </Text>
        <Text variant="title2" style={{ marginTop: space.xs }}>
          {CONFIDENCE_LABEL[analysis.confidence]}
        </Text>
        {analysis.confidenceReasons.map((r) => (
          <Text key={r} variant="callout" tone="muted" style={{ marginTop: space.xs }}>
            {r}
          </Text>
        ))}
      </Card>

      <SectionHeader title="Cycle history" />
      {analysis.cycles.length ? (
        <Card>
          <CycleHistoryChart cycles={analysis.cycles} />
        </Card>
      ) : (
        <Text variant="callout" tone="muted">
          Your first full cycle will appear here when your next period is logged.
        </Text>
      )}

      <SectionHeader title="What’s changed" />
      {changes.length ? (
        <View style={{ gap: space.md }} testID="changes">
          {changes.map((f) => (
            <FindingCard key={f.id} finding={f} />
          ))}
        </View>
      ) : (
        <Text variant="callout" tone="muted">
          {analysis.cycles.length >= 5
            ? 'Nothing has shifted much. Your last 3 cycles look like the ones before.'
            : 'After about 5 cycles, Bloom compares your last 3 with the ones before and tells you if anything has shifted.'}
        </Text>
      )}

      {deviations.length ? (
        <>
          <SectionHeader title="Compared with your usual" />
          <View style={{ gap: space.md }} testID="deviations">
            {deviations.map((f) => (
              <FindingCard key={f.id} finding={f} />
            ))}
          </View>
        </>
      ) : null}

      {analysis.notices.length ? (
        <>
          <SectionHeader title="Worth knowing" />
          <View style={{ gap: space.md }}>
            {analysis.notices.map((n) => (
              <Notice key={n.id} tone={n.level === 'care' ? 'care' : 'info'} title={n.title}>
                {n.body}
              </Notice>
            ))}
          </View>
        </>
      ) : null}

      <SectionHeader title="Your patterns" />
      {patterns.length ? (
        <>
          <Card padded={false}>
            {patterns.slice(0, 6).map((p, i, shown) => {
              const d = describePattern(p);
              return (
                <View
                  key={`${p.kind}:${p.key}`}
                  accessible
                  accessibilityLabel={`${d.name}. ${d.when}. ${d.evidence}.`}
                  style={[
                    styles.patternRow,
                    {
                      padding: space.lg,
                      gap: space.md,
                      borderBottomWidth: i < shown.length - 1 ? StyleSheet.hairlineWidth : 0,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <View style={[styles.patternDot, { backgroundColor: colors.phase[TIMING_PHASE[p.timing]].solid }]} />
                  <View style={styles.flex}>
                    <Text variant="headline">{d.name}</Text>
                    <Text variant="callout" tone="muted">
                      {d.when}
                    </Text>
                    <Text variant="caption" tone="subtle" style={{ marginTop: 2 }}>
                      {d.evidence}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>
          <Text variant="footnote" tone="muted" style={{ marginTop: space.sm }}>
            {PATTERN_DISCLAIMER}
          </Text>
        </>
      ) : (
        <Text variant="callout" tone="muted">
          Keep checking in. A pattern appears once a symptom or mood shows up at the same point in at least two cycles.
        </Text>
      )}

      <SectionHeader title="Symptom trends" />
      {trend ? (
        <Card testID="trends">
          <ChipGroup scroll>
            {trendKeys.map((k) => {
              const id = `${k.kind}:${k.key}`;
              return (
                <Chip
                  key={id}
                  role="radio"
                  label={k.kind === 'symptom' ? symptomLabel(k.key) : moodLabel(k.key)}
                  selected={trend === k}
                  onPress={() => setTrendPick(id)}
                />
              );
            })}
          </ChipGroup>
          <View style={{ marginTop: space.md }}>
            <Segmented
              label="Show trend"
              options={[
                { value: 'cycleDay', label: 'By cycle day' },
                { value: 'month', label: 'By month' },
              ]}
              value={trendMode}
              onChange={setTrendMode}
            />
          </View>
          <Text variant="headline" style={{ marginTop: space.lg }}>
            {trendName}
          </Text>
          <Text variant="footnote" tone="muted" style={{ marginBottom: space.sm }}>
            {trendMode === 'cycleDay'
              ? peak
                ? `Most often on day${peak.from === peak.to ? ` ${peak.from}` : `s ${peak.from}–${peak.to}`} of your cycle`
                : 'Share of check-ins on each day of your cycle'
              : 'Share of check-ins each month'}
          </Text>
          <TrendChart
            buckets={trendBuckets}
            mode={trendMode}
            name={trendName}
            color={trend.kind === 'symptom' ? colors.primary : colors.phase.luteal.solid}
          />
          <Text variant="caption" tone="muted" style={{ marginTop: space.sm }}>
            {trendMode === 'cycleDay' ? 'Cycle day 1 is the first day of your period.' : 'Last 6 months.'} Bars show the share of days you
            checked in.
          </Text>
        </Card>
      ) : (
        <Text variant="callout" tone="muted">
          Log symptoms or moods in your check-ins and their trends will appear here.
        </Text>
      )}

      <SectionHeader title="Body & lifestyle" />
      {life.sleep !== null || life.water !== null || life.activityLogged ? (
        <>
          <View style={[styles.lifeRow, { gap: space.md }]}>
            <View style={styles.flex}>
              <StatTile
                label="Sleep"
                value={life.sleep !== null ? formatHours(Math.round(life.sleep * 2) / 2) : '—'}
                caption="Average, last 30 days"
              />
            </View>
            <View style={styles.flex}>
              <StatTile label="Water" value={life.water !== null ? `${Math.round(life.water * 10) / 10}` : '—'} caption="Glasses a day" />
            </View>
          </View>
          <View style={{ marginTop: space.md }}>
            <StatTile
              label="Active days"
              value={life.activityLogged ? `${life.active} of ${life.activityLogged}` : '—'}
              caption="Days you logged activity, last 30 days"
            />
          </View>
          {life.notes.length ? (
            <Card style={{ marginTop: space.md }}>
              <Text variant="headline">Across your cycle</Text>
              <View style={{ gap: space.sm, marginTop: space.sm }}>
                {life.notes.map((n) => (
                  <Text key={n} variant="callout" tone="muted">
                    {n}
                  </Text>
                ))}
              </View>
            </Card>
          ) : (
            <Text variant="footnote" tone="muted" style={{ marginTop: space.sm }}>
              After a few cycles of logging, Bloom will show how your sleep, water and activity change around your period.
            </Text>
          )}
        </>
      ) : (
        <Text variant="callout" tone="muted">
          Add sleep, water and activity in your check-in to see how they line up with your cycle.
        </Text>
      )}

      <GradientCard
        variant="tint"
        style={{ marginTop: space.xl }}
        onPress={() => router.push('/report')}
        accessibilityLabel="Doctor visit report. Create a PDF summary to share at an appointment."
        testID="insights-report"
      >
        <View style={[styles.lifeRow, { alignItems: 'center', gap: space.md }]}>
          <View style={styles.flex}>
            <Text variant="headline">Doctor visit report</Text>
            <Text variant="footnote" tone="muted" style={{ marginTop: 2 }}>
              A PDF of your cycles, symptoms and medications to share at an appointment
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.inkMuted} />
        </View>
      </GradientCard>

      <SectionHeader title="Summary" />
      <Segmented
        label="Report period"
        options={[
          { value: 'month', label: 'This month' },
          { value: 'year', label: 'This year' },
        ]}
        value={period}
        onChange={setPeriod}
      />
      <Card style={{ marginTop: space.md }}>
        <Text variant="footnote" tone="muted">
          {formatRange(from, today)}
        </Text>
        <View style={[styles.grid, { gap: space.md, marginTop: space.md }]}>
          <View style={styles.flex}>
            <Text variant="title1">{report.periodsStarted}</Text>
            <Text variant="footnote" tone="muted">
              {report.periodsStarted === 1 ? 'period started' : 'periods started'}
            </Text>
          </View>
          <View style={styles.flex}>
            <Text variant="title1">{report.checkIns}</Text>
            <Text variant="footnote" tone="muted">
              {report.checkIns === 1 ? 'day logged' : 'days logged'}
            </Text>
          </View>
        </View>
        {report.topSymptoms.length ? (
          <Text variant="callout" style={{ marginTop: space.md }}>
            Most logged symptoms: {report.topSymptoms.map((s) => `${symptomLabel(s.key)} (${s.count})`).join(', ')}
          </Text>
        ) : null}
        {report.topMoods.length ? (
          <Text variant="callout" style={{ marginTop: space.xs }}>
            Most logged moods: {report.topMoods.map((s) => `${moodLabel(s.key)} (${s.count})`).join(', ')}
          </Text>
        ) : null}
      </Card>

      {data.preferences.showFertility && upcoming ? (
        <>
          <SectionHeader title="Fertility estimates" />
          <Card background={colors.phase.ovulatory.soft}>
            <Text variant="eyebrow" color={colors.phase.ovulatory.onSoft}>
              {upcoming.fertileStart <= today ? 'Current fertile window (est.)' : 'Next fertile window (est.)'}
            </Text>
            <Text variant="title2" color={colors.phase.ovulatory.onSoft} style={{ marginTop: space.xs }}>
              {formatRange(upcoming.fertileStart, upcoming.fertileEnd)}
            </Text>
            <Text variant="callout" color={colors.phase.ovulatory.onSoft} style={{ marginTop: space.xs }}>
              Estimated ovulation around {formatDate(upcoming.ovulation)}
            </Text>
            <Text variant="footnote" color={colors.phase.ovulatory.onSoft} style={{ marginTop: space.md }}>
              {CONTRACEPTION_DISCLAIMER}
            </Text>
          </Card>
        </>
      ) : null}

      <SectionHeader title="The four phases" />
      <View style={{ gap: space.md }}>
        {(Object.keys(PHASES) as Phase[]).map((phase) => (
          <View key={phase} style={[styles.phaseRow, { gap: space.md }]}>
            <View style={[styles.swatch, { backgroundColor: colors.phase[phase].solid }]} />
            <View style={styles.flex}>
              <Text variant="headline">{PHASES[phase].label}</Text>
              <Text variant="callout" tone="muted">
                {PHASES[phase].body}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lifeRow: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  flex: { flex: 1 },
  phaseRow: { flexDirection: 'row', alignItems: 'flex-start' },
  swatch: { width: 12, height: 12, borderRadius: 6, marginTop: 6 },
  square: { width: 14, height: 14, borderRadius: 4 },
  patternRow: { flexDirection: 'row', alignItems: 'flex-start' },
  patternDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
});
