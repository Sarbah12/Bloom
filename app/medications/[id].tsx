import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { CompactStepper, TextField } from '@/components/ui/Controls';
import { SectionHeader } from '@/components/ui/Feedback';
import { ListGroup, ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { toLocalISO } from '@/lib/cycle/dates';
import { MEDICATION_KINDS, type MedicationKind } from '@/lib/data/catalog';
import { adherence, medHistory } from '@/lib/data/meds';
import { PACK_TYPES, packDay, packSpec, startForPillNumber, type PackType } from '@/lib/data/pill';
import { useCycle, useData } from '@/lib/data/store';
import { formatDate, formatTime } from '@/lib/format';
import { requestReminderPermission, supportsReminders } from '@/lib/notifications';
import { confirm, notify } from '@/lib/platform';
import { useTheme } from '@/theme/theme';

const TIMES = [7, 8, 9, 12, 18, 20, 21, 22];

/** Add or edit one medication: name, type, dose, daily reminder and the last 30 days. */
export default function MedicationEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, actions } = useData();
  const { today } = useCycle();
  const { colors, space } = useTheme();
  const existing = id && id !== 'new' ? data.medications.find((m) => m.id === id && !m.deletedAt) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<MedicationKind>(existing?.kind ?? 'pain_relief');
  const [dose, setDose] = useState(existing?.dose ?? '');
  const [reminder, setReminder] = useState(existing?.reminder ?? { enabled: false, hour: 8, minute: 0 });
  const [error, setError] = useState<string>();
  const [packType, setPackType] = useState<PackType>(existing?.pack?.type ?? 'combined_21_7');
  const [pillNumber, setPillNumber] = useState<number | undefined>(existing?.pack ? packDay(existing.pack, today)?.day : undefined);
  const spec = packSpec(packType);
  const isPill = kind === 'pill';

  const history = useMemo(
    () => (existing ? medHistory(existing, data.days, today, toLocalISO(new Date(existing.createdAt))) : []),
    [existing, data.days, today],
  );
  const stats = adherence(history);

  const save = () => {
    if (!name.trim()) return setError('Give it a name, such as “Ibuprofen” or “Iron”.');
    let pack = undefined;
    if (isPill && pillNumber !== undefined) {
      const startDate = startForPillNumber(today, pillNumber);
      const unchanged = existing?.pack && existing.pack.type === packType && existing.pack.startDate === startDate;
      pack = unchanged ? existing!.pack : { type: packType, startDate, setOn: today };
    }
    actions.saveMedication({ id: existing?.id, name, kind, dose: dose.trim() || undefined, reminder, pack });
    router.back();
  };

  const toggleReminder = async (on: boolean) => {
    if (on && !(await requestReminderPermission())) {
      notify('Notifications are off', 'Allow notifications for Bloom in your phone’s Settings to get reminders.');
      return;
    }
    setReminder((r) => ({ ...r, enabled: on }));
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirm(
      `Remove ${existing.name}?`,
      'Its reminder stops. Days you already ticked stay in your history.',
      'Remove',
      true,
    );
    if (!ok) return;
    actions.deleteMedication(existing.id);
    router.back();
  };

  return (
    <Screen
      nav="back"
      title={existing ? existing.name : 'Add a medication'}
      testID="medication-editor"
      footer={<Button label="Save" size="lg" fullWidth onPress={save} testID="save-medication" />}
    >
      <TextField
        label="Name"
        value={name}
        onChangeText={(t) => {
          setName(t);
          setError(undefined);
        }}
        placeholder="For example, Ibuprofen"
        maxLength={80}
        error={error}
        testID="med-name"
      />

      <SectionHeader title="Type" />
      <ChipGroup>
        {MEDICATION_KINDS.map((k) => (
          <Chip key={k.key} role="radio" label={k.label} icon={k.icon} selected={kind === k.key} onPress={() => setKind(k.key)} />
        ))}
      </ChipGroup>

      <View style={{ marginTop: space.xl }}>
        <TextField label="Dose (optional)" value={dose} onChangeText={setDose} placeholder="For example, 400 mg" maxLength={40} />
      </View>

      {isPill ? (
        <>
          <SectionHeader title="Pill pack" />
          <ChipGroup>
            {PACK_TYPES.map((p) => (
              <Chip
                key={p.type}
                role="radio"
                label={p.label}
                selected={packType === p.type}
                onPress={() => {
                  setPackType(p.type);
                  if (pillNumber !== undefined) setPillNumber(Math.min(pillNumber, p.length));
                }}
              />
            ))}
          </ChipGroup>
          <Text variant="footnote" tone="muted" style={{ marginTop: space.sm }}>
            {spec.detail}. Your leaflet says which kind you have.
          </Text>
          <Card style={{ marginTop: space.lg }} testID="pill-number">
            <View style={styles.pillRow}>
              <View style={{ flex: 1 }}>
                <Text variant="headline">Today’s pill</Text>
                <Text variant="footnote" tone="muted">
                  {pillNumber === undefined
                    ? 'Set it to track your pack'
                    : pillNumber > spec.active
                      ? spec.gap === 'break'
                        ? `Break day ${pillNumber - spec.active} of ${spec.length - spec.active}`
                        : `Inactive pill ${pillNumber}`
                      : `Pill ${pillNumber} of ${spec.active}`}
                </Text>
              </View>
              <CompactStepper
                label="Today’s pill number in the pack"
                value={pillNumber}
                start={1}
                min={1}
                max={spec.length}
                onChange={setPillNumber}
              />
            </View>
          </Card>
        </>
      ) : null}

      <SectionHeader title="Reminder" />
      <ListGroup flush>
        <ListRow
          icon="bell"
          title="Daily reminder"
          subtitle={
            supportsReminders
              ? reminder.enabled
                ? `Every day at ${formatTime(reminder.hour, reminder.minute)}`
                : 'Off'
              : 'Available in the iOS and Android apps'
          }
          toggle={{ value: reminder.enabled, disabled: !supportsReminders, onChange: toggleReminder }}
          last
        />
      </ListGroup>
      {reminder.enabled ? (
        <View style={{ marginTop: space.md }}>
          <ChipGroup>
            {TIMES.map((h) => (
              <Chip
                key={h}
                role="radio"
                label={formatTime(h)}
                selected={reminder.hour === h && reminder.minute === 0}
                onPress={() => setReminder((r) => ({ ...r, hour: h, minute: 0 }))}
              />
            ))}
          </ChipGroup>
        </View>
      ) : null}

      {existing ? (
        <>
          <SectionHeader title="Last 30 days" />
          <Card>
            <Text variant="headline">{stats.total ? `Ticked on ${stats.taken} of ${stats.total} days` : 'Added today'}</Text>
            <View
              style={[styles.grid, { marginTop: space.md }]}
              accessible
              accessibilityLabel={`Taken on ${stats.taken} of the last ${stats.total} days`}
            >
              {history.map((h) => (
                <View
                  key={h.date}
                  style={[
                    styles.dot,
                    h.taken === null
                      ? { backgroundColor: 'transparent', borderColor: colors.border, borderWidth: 1 }
                      : h.taken
                        ? { backgroundColor: colors.primary }
                        : { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong, borderWidth: 1 },
                  ]}
                />
              ))}
            </View>
            <View style={[styles.legend, { marginTop: space.md, gap: space.lg }]}>
              <View style={styles.legendItem}>
                <View style={[styles.swatch, { backgroundColor: colors.primary }]} />
                <Text variant="caption" tone="muted">
                  Taken
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.swatch, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong, borderWidth: 1 }]} />
                <Text variant="caption" tone="muted">
                  Not ticked
                </Text>
              </View>
              <Text variant="caption" tone="muted">
                {history.length ? `${formatDate(history[0].date)} – today` : ''}
              </Text>
            </View>
          </Card>
          <View style={{ marginTop: space.xl, alignItems: 'flex-start' }}>
            <Button label="Remove medication" icon="trash-2" variant="danger" onPress={remove} />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dot: { width: 16, height: 16, borderRadius: 8 },
  legend: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
});
