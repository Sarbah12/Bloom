import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { CompactStepper, Segmented, TextField } from '@/components/ui/Controls';
import { SectionHeader } from '@/components/ui/Feedback';
import { ListGroup, ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { isISODate, type ISODate } from '@/lib/cycle/dates';
import { describeDay } from '@/lib/cycle/engine';
import {
  BODY_LIMITS,
  ENERGY_LEVELS,
  EXERCISE_LEVELS,
  medicationKind,
  FLOWS,
  MOODS,
  PAIN_LEVELS,
  RELIEF,
  SYMPTOMS,
  type Energy,
  type ExerciseLevel,
  type Flow,
  type MoodKey,
  type PainLevel,
  type ReliefKey,
  type SymptomKey,
} from '@/lib/data/catalog';
import { activeMeds } from '@/lib/data/meds';
import { useCycle, useData } from '@/lib/data/store';
import { formatDate, relativeDay } from '@/lib/format';
import { cToDisplay, displayToC, displayToKg, formatHours, kgToDisplay, parseDecimal, tempUnit, weightUnit } from '@/lib/units';
import { useTheme } from '@/theme/theme';

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export default function DailyLog() {
  const params = useLocalSearchParams<{ date: string }>();
  const { data, actions } = useData();
  const { analysis, today } = useCycle();
  const { colors, space } = useTheme();
  const date: ISODate = isISODate(params.date) && params.date <= today ? params.date : today;
  const log = data.days[date];
  const [note, setNote] = useState(log?.note ?? '');
  const units = data.preferences.units;
  const [weight, setWeight] = useState(log?.weightKg !== undefined ? String(kgToDisplay(log.weightKg, units)) : '');
  const [temp, setTemp] = useState(log?.temperatureC !== undefined ? String(cToDisplay(log.temperatureC, units)) : '');
  const [bodyError, setBodyError] = useState<{ weight?: string; temp?: string }>({});
  const meds = activeMeds(data.medications);
  const peri = data.cycle.lifeStage === 'perimenopause';

  const saveWeight = () => {
    const v = parseDecimal(weight);
    if (v === undefined)
      return (
        setBodyError((e) => ({ ...e, weight: undefined })),
        log?.weightKg !== undefined && actions.updateDay(date, { weightKg: undefined })
      );
    const kg = Number.isNaN(v) ? NaN : displayToKg(v, units);
    if (Number.isNaN(kg) || kg < BODY_LIMITS.weightKg.min || kg > BODY_LIMITS.weightKg.max) {
      return setBodyError((e) => ({ ...e, weight: 'Enter a weight like 64.5' }));
    }
    setBodyError((e) => ({ ...e, weight: undefined }));
    if (log?.weightKg !== kg) actions.updateDay(date, { weightKg: kg });
  };
  const saveTemp = () => {
    const v = parseDecimal(temp);
    if (v === undefined)
      return (
        setBodyError((e) => ({ ...e, temp: undefined })),
        log?.temperatureC !== undefined && actions.updateDay(date, { temperatureC: undefined })
      );
    const c = Number.isNaN(v) ? NaN : displayToC(v, units);
    if (Number.isNaN(c) || c < BODY_LIMITS.temperatureC.min || c > BODY_LIMITS.temperatureC.max) {
      return setBodyError((e) => ({
        ...e,
        temp: units === 'imperial' ? 'Enter a temperature like 97.9' : 'Enter a temperature like 36.6',
      }));
    }
    setBodyError((e) => ({ ...e, temp: undefined }));
    if (log?.temperatureC !== c) actions.updateDay(date, { temperatureC: c });
  };

  const info = describeDay(analysis, date, today);
  const isPeriodDay = info.period === 'logged';
  const menstrual = colors.phase.menstrual;

  // Marking *today* means "my period started", so it stays open until it's
  // ended; marking a past day just adds that day.
  const markPeriod = () => (date === today ? actions.startPeriod(date) : actions.togglePeriodDay(date));

  const setFlow = (flow: Flow) => {
    const next = log?.flow === flow ? undefined : flow;
    actions.updateDay(date, { flow: next });
    // Choosing a bleeding flow marks the day as a period day; spotting doesn't.
    if (next && next !== 'spotting' && !isPeriodDay) markPeriod();
  };

  const label = relativeDay(date, today);

  return (
    <Screen
      nav="close"
      navTitle={label === 'Today' || label === 'Yesterday' ? label : formatDate(date, 'weekday')}
      testID="daily-log"
      footer={
        <Button
          testID="log-done"
          label="Done"
          size="lg"
          fullWidth
          onPress={() => {
            if ((log?.note ?? '') !== note) actions.updateDay(date, { note });
            saveWeight();
            saveTemp();
            router.back();
          }}
        />
      }
    >
      <Text variant="title1" heading style={{ marginTop: space.sm }}>
        How are you feeling?
      </Text>
      <Text variant="callout" tone="muted" style={{ marginTop: space.xs, marginBottom: space.lg }}>
        {formatDate(date, 'long')} · Saved as you go
      </Text>

      <ListGroup flush>
        <ListRow
          testID="period-toggle"
          icon="droplet"
          title="Period day"
          subtitle={isPeriodDay ? 'Counted as part of your period' : 'Turn on if you bled today'}
          toggle={{ value: isPeriodDay, onChange: (on) => (on ? markPeriod() : actions.togglePeriodDay(date)) }}
          last
        />
      </ListGroup>

      <SectionHeader title="Flow" />
      <ChipGroup>
        {FLOWS.map((f) => (
          <Chip
            key={f.key}
            role="radio"
            label={f.label}
            selected={log?.flow === f.key}
            tint={{ bg: menstrual.solid, fg: menstrual.onSolid }}
            onPress={() => setFlow(f.key)}
          />
        ))}
      </ChipGroup>
      {log?.flow ? (
        <Text variant="footnote" tone="muted" style={{ marginTop: space.sm }}>
          {FLOWS.find((f) => f.key === log.flow)?.description}
        </Text>
      ) : null}

      <SectionHeader title="Symptoms" />
      <ChipGroup>
        {SYMPTOMS.filter((s) => !('group' in s) || peri || log?.symptoms.includes(s.key)).map((s) => (
          <Chip
            key={s.key}
            label={s.label}
            icon={s.icon}
            selected={log?.symptoms.includes(s.key)}
            onPress={() => {
              const symptoms = toggle<SymptomKey>(log?.symptoms ?? [], s.key);
              // Cramp strength only means something while cramps are logged.
              actions.updateDay(date, symptoms.includes('cramps') ? { symptoms } : { symptoms, pain: undefined });
            }}
          />
        ))}
      </ChipGroup>

      {log?.symptoms.includes('cramps') ? (
        <Card style={{ marginTop: space.lg }} testID="cramps-detail">
          <Text variant="headline" style={{ marginBottom: space.sm }}>
            How strong are the cramps?
          </Text>
          <Segmented<PainLevel>
            label="Cramp strength"
            options={PAIN_LEVELS}
            value={log.pain}
            onChange={(v) => actions.updateDay(date, { pain: log.pain === v ? undefined : v })}
          />
          <Text variant="headline" style={{ marginTop: space.lg, marginBottom: space.sm }}>
            What helped?
          </Text>
          <ChipGroup>
            {RELIEF.map((r) => (
              <Chip
                key={r.key}
                label={r.label}
                icon={r.icon}
                selected={log.relief?.includes(r.key)}
                onPress={() => actions.updateDay(date, { relief: toggle<ReliefKey>(log.relief ?? [], r.key) })}
              />
            ))}
          </ChipGroup>
          <View style={{ marginTop: space.lg, alignItems: 'flex-start' }}>
            <Button label="Cramp relief ideas" icon="heart" variant="soft" onPress={() => router.push('/relief')} />
          </View>
        </Card>
      ) : null}

      <SectionHeader title="Mood" />
      <ChipGroup>
        {MOODS.map((m) => (
          <Chip
            key={m.key}
            label={m.label}
            selected={log?.moods.includes(m.key)}
            tint={{ bg: colors.phase.luteal.solid, fg: colors.phase.luteal.onSolid }}
            onPress={() => actions.updateDay(date, { moods: toggle<MoodKey>(log?.moods ?? [], m.key) })}
          />
        ))}
      </ChipGroup>

      <SectionHeader title="Energy" />
      <Segmented<Energy>
        label="Energy"
        options={ENERGY_LEVELS}
        value={log?.energy}
        onChange={(v) => actions.updateDay(date, { energy: log?.energy === v ? undefined : v })}
      />

      <SectionHeader title="Medications" />
      {meds.length ? (
        <>
          <ChipGroup>
            {meds.map((m) => (
              <Chip
                key={m.id}
                label={m.dose ? `${m.name} · ${m.dose}` : m.name}
                icon={medicationKind(m.kind).icon}
                selected={log?.medsTaken?.includes(m.id)}
                onPress={() => actions.toggleMedTaken(date, m.id)}
                testID={`med-${m.id}`}
              />
            ))}
          </ChipGroup>
          <Text variant="footnote" tone="muted" style={{ marginTop: space.sm }}>
            Tap what you took today.
          </Text>
        </>
      ) : (
        <View style={{ alignItems: 'flex-start' }}>
          <Button label="Add a medication" icon="plus" variant="soft" onPress={() => router.push('/medications/new')} />
        </View>
      )}

      <SectionHeader title="Body & lifestyle" />
      <Card testID="lifestyle">
        <View style={styles.bodyRow}>
          <View style={styles.flex}>
            <Text variant="headline">Sleep</Text>
            <Text variant="footnote" tone="muted">
              Last night
            </Text>
          </View>
          <CompactStepper
            label="Hours of sleep last night"
            value={log?.sleepHours}
            start={7}
            step={BODY_LIMITS.sleepHours.step}
            min={BODY_LIMITS.sleepHours.min}
            max={BODY_LIMITS.sleepHours.max}
            format={formatHours}
            onChange={(sleepHours) => actions.updateDay(date, { sleepHours })}
            testID="sleep-stepper"
          />
        </View>
        <View style={[styles.bodyRow, { marginTop: space.lg }]}>
          <View style={styles.flex}>
            <Text variant="headline">Water</Text>
            <Text variant="footnote" tone="muted">
              Glasses today
            </Text>
          </View>
          <CompactStepper
            label="Glasses of water today"
            value={log?.water}
            start={1}
            min={BODY_LIMITS.water.min}
            max={BODY_LIMITS.water.max}
            onChange={(water) => actions.updateDay(date, { water })}
            testID="water-stepper"
          />
        </View>
        <Text variant="headline" style={{ marginTop: space.lg, marginBottom: space.sm }}>
          Activity
        </Text>
        <Segmented<ExerciseLevel>
          label="Activity"
          options={EXERCISE_LEVELS}
          value={log?.exercise}
          onChange={(v) => actions.updateDay(date, { exercise: log?.exercise === v ? undefined : v })}
        />
        <View style={[styles.bodyRow, { marginTop: space.lg, gap: space.md, alignItems: 'flex-start' }]}>
          <View style={styles.flex}>
            <TextField
              label={`Weight (${weightUnit(units)})`}
              value={weight}
              onChangeText={setWeight}
              onBlur={saveWeight}
              keyboardType="decimal-pad"
              placeholder="Optional"
              error={bodyError.weight}
              testID="weight-field"
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label={`Temperature (${tempUnit(units)})`}
              value={temp}
              onChangeText={setTemp}
              onBlur={saveTemp}
              keyboardType="decimal-pad"
              placeholder="Optional"
              error={bodyError.temp}
              testID="temp-field"
            />
          </View>
        </View>
        <Text variant="footnote" tone="muted" style={{ marginTop: space.sm }}>
          Temperature is for your own records. Bloom doesn’t use it to predict fertility.
        </Text>
      </Card>

      <View style={{ height: space.xxl }} />
      <TextField
        label="Notes"
        value={note}
        onChangeText={setNote}
        onBlur={() => actions.updateDay(date, { note })}
        placeholder="Anything else worth remembering about today?"
        multiline
        hint="Private and encrypted on this phone."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bodyRow: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
