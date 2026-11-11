import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BloomBadge, Wordmark, WaveFooter } from '@/components/brand/Brand';
import { MonthCalendar } from '@/components/cycle/MonthCalendar';
import { MonthHeader } from '@/components/cycle/MonthHeader';
import { Button } from '@/components/ui/Button';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { Stepper, TextField } from '@/components/ui/Controls';
import { Notice } from '@/components/ui/Feedback';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { CONTRACEPTION_DISCLAIMER, MEDICAL_DISCLAIMER } from '@/lib/content/phases';
import { addMonths, diffDays, monthOf, type ISODate } from '@/lib/cycle/dates';
import { GOALS, type GoalKey } from '@/lib/data/catalog';
import { useData } from '@/lib/data/store';
import { useRestore } from '@/lib/data/useRestore';
import { useToday } from '@/lib/data/today';
import { formatDate } from '@/lib/format';
import { useTheme } from '@/theme/theme';

const STEPS = ['welcome', 'period', 'cycle', 'goals', 'privacy'] as const;
type Step = (typeof STEPS)[number];

export default function Onboarding() {
  const { actions, data } = useData();
  const { colors, space, radii } = useTheme();
  const today = useToday();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [lastStart, setLastStart] = useState<ISODate | null>(null);
  const [unsure, setUnsure] = useState(false);
  const [month, setMonth] = useState(monthOf(today));
  const [cycleLength, setCycleLength] = useState(28);
  const [periodLength, setPeriodLength] = useState(5);
  const [goals, setGoals] = useState<GoalKey[]>(['track_periods']);

  const restore = useRestore();
  const index = STEPS.indexOf(step);
  const go = (delta: 1 | -1) => setStep(STEPS[Math.min(STEPS.length - 1, Math.max(0, index + delta))]);
  const describeOnboardingDay = useCallback(
    (date: ISODate) => ({
      period: date === lastStart ? ('logged' as const) : null,
      fertile: false,
      ovulation: false,
      phase: null,
      cycleDay: null,
      hasLog: false,
    }),
    [lastStart],
  );

  const finish = () => {
    actions.completeOnboarding({
      name,
      lastPeriodStart: unsure ? null : lastStart,
      cycle: { typicalCycleLength: cycleLength, typicalPeriodLength: periodLength },
      goals,
      consents: { cloudBackup: false, aiAssistant: false, productAnalytics: false },
    });
    router.replace('/(tabs)');
  };

  const progress = (
    <View
      style={[styles.progress, { gap: space.xs, marginTop: space.md, marginBottom: space.xl }]}
      accessible
      accessibilityLabel={`Step ${index} of ${STEPS.length - 1}`}
    >
      {STEPS.slice(1).map((s, i) => (
        <View
          key={s}
          style={[styles.bar, { borderRadius: radii.pill, backgroundColor: i < index ? colors.primary : colors.surfaceMuted }]}
        />
      ))}
    </View>
  );

  if (step === 'welcome') {
    return (
      <View testID="onboarding-welcome" style={[styles.flex, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: space.huge, paddingBottom: space.xl }}>
          <View style={{ alignItems: 'center', marginBottom: space.xxxl }}>
            <BloomBadge size={88} />
            <View style={{ marginTop: space.xl }}>
              <Wordmark height={56} />
            </View>
            <Text variant="title1" heading align="center" style={{ marginTop: space.lg }}>
              Your cycle, understood.
            </Text>
            <Text variant="body" tone="muted" align="center" style={{ marginTop: space.md, maxWidth: 320 }}>
              Track your period, symptoms and mood, and see how your cycle shapes how you feel — privately.
            </Text>
          </View>
          {[
            { icon: 'lock' as const, title: 'Private by design', body: 'Encrypted on this phone. No account needed.' },
            { icon: 'eye-off' as const, title: 'Never sold, never used for ads', body: 'Your health data is yours. Full stop.' },
            { icon: 'compass' as const, title: 'Honest estimates', body: 'Predictions adapt to you and show how sure they are.' },
          ].map((p) => (
            <View key={p.title} style={[styles.promise, { gap: space.lg, marginBottom: space.lg }]}>
              <View style={[styles.promiseIcon, { backgroundColor: colors.primarySoft }]}>
                <Feather name={p.icon} size={18} color={colors.onPrimarySoft} />
              </View>
              <View style={styles.flex}>
                <Text variant="headline">{p.title}</Text>
                <Text variant="callout" tone="muted">
                  {p.body}
                </Text>
              </View>
            </View>
          ))}
          <View style={{ alignItems: 'center', marginTop: space.sm }}>
            <Button
              label="New phone? Restore a backup"
              variant="ghost"
              icon="upload"
              onPress={async () => {
                if (await restore()) router.replace('/(tabs)');
              }}
            />
          </View>
        </ScrollView>
        <WaveFooter>
          <Button label="Get started" size="lg" variant="inverse" arrow fullWidth onPress={() => go(1)} />
        </WaveFooter>
      </View>
    );
  }

  if (step === 'period') {
    const ready = unsure || !!lastStart;
    return (
      <Screen
        nav="back"
        onBack={() => go(-1)}
        testID="onboarding-period"
        footer={<Button label="Continue" size="lg" fullWidth disabled={!ready} onPress={() => go(1)} />}
      >
        {progress}
        <Text variant="title1" heading>
          When did your last period start?
        </Text>
        <Text variant="callout" tone="muted" style={{ marginTop: space.sm, marginBottom: space.xl }}>
          Tap the first day of bleeding. An approximate date is fine — you can change it later.
        </Text>
        <MonthHeader month={month} onChange={setMonth} maxMonth={monthOf(today)} minMonth={addMonths(monthOf(today), -6)} />
        <MonthCalendar
          month={month}
          weekStartsOn={data.preferences.weekStartsOn}
          today={today}
          selected={lastStart}
          disableFuture
          showFertility={false}
          onSelect={(d) => {
            setLastStart(d);
            setUnsure(false);
          }}
          describe={describeOnboardingDay}
        />
        {lastStart ? (
          <Text variant="callout" tone="muted" align="center" style={{ marginTop: space.lg }} accessibilityLiveRegion="polite">
            {formatDate(lastStart, 'long')} · {diffDays(lastStart, today) === 0 ? 'today' : `${diffDays(lastStart, today)} days ago`}
          </Text>
        ) : null}
        <View style={{ marginTop: space.xl, alignItems: 'center' }}>
          <Chip
            label="I don't remember"
            selected={unsure}
            onPress={() => {
              setUnsure(!unsure);
              if (!unsure) setLastStart(null);
            }}
          />
        </View>
      </Screen>
    );
  }

  if (step === 'cycle') {
    return (
      <Screen
        nav="back"
        onBack={() => go(-1)}
        testID="onboarding-cycle"
        footer={<Button label="Continue" size="lg" fullWidth onPress={() => go(1)} />}
      >
        {progress}
        <Text variant="title1" heading>
          Tell us about your usual cycle
        </Text>
        <Text variant="callout" tone="muted" style={{ marginTop: space.sm, marginBottom: space.xxl }}>
          A cycle runs from the first day of one period to the day before the next. Not sure? Leave the usual values — Bloom learns from
          what you log.
        </Text>
        <Text variant="headline" align="center" style={{ marginBottom: space.md }}>
          Cycle length
        </Text>
        <Stepper testID="cycle-length" label="Cycle length" value={cycleLength} min={15} max={90} unit="days" onChange={setCycleLength} />
        <View style={{ height: space.xxxl }} />
        <Text variant="headline" align="center" style={{ marginBottom: space.md }}>
          Period length
        </Text>
        <Stepper
          testID="period-length"
          label="Period length"
          value={periodLength}
          min={1}
          max={14}
          unit="days"
          onChange={setPeriodLength}
        />
      </Screen>
    );
  }

  if (step === 'goals') {
    return (
      <Screen
        nav="back"
        onBack={() => go(-1)}
        testID="onboarding-goals"
        footer={<Button label="Continue" size="lg" fullWidth onPress={() => go(1)} />}
      >
        {progress}
        <Text variant="title1" heading>
          What would you like Bloom to help with?
        </Text>
        <Text variant="callout" tone="muted" style={{ marginTop: space.sm, marginBottom: space.xl }}>
          Choose any that apply. This shapes the insights you see.
        </Text>
        <ChipGroup>
          {GOALS.map((g) => (
            <Chip
              key={g.key}
              label={g.label}
              icon={g.icon}
              selected={goals.includes(g.key)}
              onPress={() => setGoals((cur) => (cur.includes(g.key) ? cur.filter((k) => k !== g.key) : [...cur, g.key]))}
            />
          ))}
        </ChipGroup>
        <View style={{ height: space.xxl }} />
        <TextField
          label="What should we call you? (optional)"
          value={name}
          onChangeText={setName}
          placeholder="First name"
          autoComplete="given-name"
          textContentType="givenName"
          returnKeyType="done"
          hint="Only used for your greeting. Stays on this phone."
        />
      </Screen>
    );
  }

  return (
    <Screen
      nav="back"
      onBack={() => go(-1)}
      testID="onboarding-privacy"
      footer={<Button testID="finish-onboarding" label="Start using Bloom" size="lg" fullWidth onPress={finish} />}
    >
      {progress}
      <Text variant="title1" heading>
        Your privacy, your choice
      </Text>
      <Text variant="callout" tone="muted" style={{ marginTop: space.sm, marginBottom: space.xl }}>
        Everything you log is encrypted and stays on this phone. You can export or delete it at any time.
      </Text>
      <View style={{ gap: space.md, marginBottom: space.xl }}>
        {[
          { icon: 'smartphone' as const, text: 'Stored only on this phone, encrypted with a key held in its secure keychain.' },
          { icon: 'bar-chart-2' as const, text: 'No analytics, no advertising trackers, nothing sold.' },
          { icon: 'bell-off' as const, text: 'Reminders are discreet — lock-screen text never mentions periods.' },
          { icon: 'cloud-off' as const, text: 'Cloud backup and the AI assistant stay off unless you turn them on and agree.' },
        ].map((p) => (
          <View key={p.icon} style={[styles.promise, { gap: space.md }]}>
            <Feather name={p.icon} size={18} color={colors.primary} style={{ marginTop: 2 }} />
            <Text variant="callout" style={{ flex: 1 }}>
              {p.text}
            </Text>
          </View>
        ))}
      </View>
      <View style={{ gap: space.md }}>
        <Notice tone="info" title="Good to know">
          {MEDICAL_DISCLAIMER}
        </Notice>
        <Notice tone="care" icon="alert-circle" title="Not contraception">
          {CONTRACEPTION_DISCLAIMER}
        </Notice>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row' },
  bar: { flex: 1, height: 4 },
  flex: { flex: 1 },
  promise: { flexDirection: 'row', alignItems: 'flex-start' },
  promiseIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
