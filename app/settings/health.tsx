import Feather from '@expo/vector-icons/Feather';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, View } from 'react-native';
import { randomUUID } from 'expo-crypto';

import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Feedback';
import { ListGroup, ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { addDays } from '@/lib/cycle/dates';
import { activePeriods, useCycle, useData } from '@/lib/data/store';
import { planImport } from '@/lib/health/plan';
import { removeFromHealth, syncHealthNow, useHealthSyncState } from '@/lib/health/sync';
import { confirm, notify } from '@/lib/platform';
import { healthStatus, readHealthPeriodDays, requestHealthAccess, type HealthStatus } from '@/modules/bloom-health';
import { useTheme } from '@/theme/theme';

const WRITES = [
  { icon: 'droplet', title: 'Period days and flow', body: 'Each logged period day, with its flow and the first day marked.' },
  { icon: 'activity', title: 'Symptoms', body: 'Cramps (with how strong), headache, bloating, tender breasts, acne, poor sleep, hot flushes and others Health tracks.' },
  { icon: 'circle', title: 'Spotting', body: 'Spotting outside a period.' },
  { icon: 'bar-chart-2', title: 'Weight, temperature and water', body: 'When you log them in a check-in.' },
] as const;

function ago(ms: number): string {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  return `${Math.round(min / 60)} h ago`;
}

export default function AppleHealth() {
  const { data, actions } = useData();
  const { today } = useCycle();
  const { colors, space } = useTheme();
  const sync = useHealthSyncState();
  const [status, setStatus] = useState<HealthStatus>(() => healthStatus());
  const [busy, setBusy] = useState<'enable' | 'import' | null>(null);
  const [imported, setImported] = useState<string | null>(null);
  const enabled = data.preferences.appleHealth;

  const refresh = useCallback(() => setStatus(healthStatus()), []);
  // Coming back from the Health app, access may have changed: re-check and re-send.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      const next = healthStatus();
      setStatus(next);
      if (enabled && next.allowed > 0) syncHealthNow(data, today, true);
    });
    return () => sub.remove();
  }, [enabled, data, today]);

  const turnOn = async () => {
    setBusy('enable');
    try {
      await requestHealthAccess();
      const next = healthStatus();
      setStatus(next);
      actions.updatePreferences({ appleHealth: true });
      if (next.allowed > 0) await syncHealthNow(data, today, true);
    } catch (e) {
      notify('Couldn’t connect to Apple Health', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const turnOff = async () => {
    actions.updatePreferences({ appleHealth: false });
    const remove = await confirm(
      'Remove Bloom’s data from Health?',
      'What Bloom already added stays in Apple Health unless you remove it. Data from other apps isn’t touched.',
      'Remove',
      true,
    );
    if (!remove) return;
    try {
      const r = await removeFromHealth();
      notify('Removed from Health', `Bloom removed ${r.removed} entr${r.removed === 1 ? 'y' : 'ies'} it had added.`);
    } catch (e) {
      notify('Couldn’t remove the data', e instanceof Error ? e.message : String(e));
    }
  };

  const importPeriods = async () => {
    setBusy('import');
    setImported(null);
    try {
      const days = await readHealthPeriodDays(addDays(today, -365 * 3));
      const plan = planImport(activePeriods(data), days, data, data.cycle.typicalPeriodLength, today, randomUUID);
      if (plan.addedDays === 0 && Object.keys(plan.flows).length === 0) {
        setImported(
          days.length
            ? 'Bloom already has every period day that’s in Health.'
            : 'Health has no period days from other apps or devices — or Bloom isn’t allowed to read them. You can check in Health › your picture › Apps › Bloom.',
        );
        return;
      }
      actions.applyHealthImport(plan.periods, plan.flows);
      const flowCount = Object.keys(plan.flows).length;
      setImported(
        plan.addedDays
          ? `Added ${plan.addedDays} period day${plan.addedDays === 1 ? '' : 's'} from Health.`
          : `Added flow to ${flowCount} day${flowCount === 1 ? '' : 's'} from Health.`,
      );
    } catch (e) {
      notify('Couldn’t read from Apple Health', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const denied = enabled && status.allowed === 0;
  const partial = enabled && status.allowed > 0 && status.allowed < status.total;
  const summary = !enabled
    ? 'Off'
    : sync.running
      ? 'Updating Health…'
      : sync.error
        ? `Last update failed: ${sync.error}`
        : sync.lastAt && sync.lastResult
          ? `On · ${sync.lastResult.added + sync.lastResult.kept} entries in Health · updated ${ago(sync.lastAt)}`
          : 'On';

  return (
    <Screen
      nav="back"
      title="Apple Health"
      subtitle="Keep your cycle in the Health app next to your sleep, activity and the rest of your health."
      testID="health"
    >
      <ListGroup>
        <ListRow
          icon="heart"
          title="Share with Apple Health"
          subtitle={summary}
          toggle={{ value: enabled, onChange: (v) => (v ? turnOn() : turnOff()) }}
          testID="health-toggle"
          last
        />
      </ListGroup>

      {busy === 'enable' ? (
        <Text variant="callout" tone="muted" style={{ marginTop: space.md }}>
          Waiting for Apple Health…
        </Text>
      ) : null}

      {denied || partial ? (
        <View style={{ marginTop: space.lg }}>
          <Notice
            tone="care"
            title={denied ? 'Bloom can’t write to Health yet' : 'Some data is switched off'}
            action={<Button label="Open Health" variant="secondary" onPress={() => Linking.openURL('x-apple-health://')} />}
          >
            {denied
              ? 'In the Health app, tap your picture, then Apps › Bloom, and turn on the categories you want.'
              : `Bloom may write ${status.allowed} of ${status.total} kinds of data. Change this in Health › your picture › Apps › Bloom.`}
          </Notice>
        </View>
      ) : null}

      <Text variant="eyebrow" tone="muted" style={{ marginTop: space.xxl, marginBottom: space.md }}>
        What Bloom adds to Health
      </Text>
      <View style={{ gap: space.lg }}>
        {WRITES.map((w) => (
          <View key={w.title} style={{ flexDirection: 'row', gap: space.lg }}>
            <Feather name={w.icon} size={20} color={colors.primary} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text variant="headline">{w.title}</Text>
              <Text variant="callout" tone="muted" style={{ marginTop: 2 }}>
                {w.body}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <Text variant="footnote" tone="muted" style={{ marginTop: space.lg }}>
        Moods, notes, your journal and medications stay in Bloom. Changes you make in Bloom update Health within a few seconds.
      </Text>

      <Text variant="eyebrow" tone="muted" style={{ marginTop: space.xxl, marginBottom: space.md }}>
        Bring periods into Bloom
      </Text>
      <Text variant="callout" tone="muted" style={{ marginBottom: space.lg }}>
        Add period days that other apps or your Apple Watch saved to Health in the last three years. Bloom only adds days; it never
        changes or removes what you logged here.
      </Text>
      <Button
        label="Import periods from Health"
        variant="secondary"
        icon="download"
        loading={busy === 'import'}
        disabled={!enabled || busy !== null || denied}
        onPress={importPeriods}
        testID="health-import"
      />
      {!enabled ? (
        <Text variant="footnote" tone="muted" style={{ marginTop: space.sm }}>
          Turn on Share with Apple Health first.
        </Text>
      ) : null}
      {imported ? (
        <View style={{ marginTop: space.lg }}>
          <Notice tone="info">{imported}</Notice>
        </View>
      ) : null}

      <Text variant="footnote" tone="muted" style={{ marginTop: space.xxl }}>
        Health data stays on your iPhone and, if you use iCloud, is end-to-end encrypted by Apple. Bloom never uses it for ads and
        never sends it anywhere.
      </Text>
    </Screen>
  );
}
