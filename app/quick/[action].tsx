import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import type { PeriodRecord } from '@/lib/cycle/engine';
import { formatDate } from '@/lib/format';
import { activePeriods, useCycle, useData } from '@/lib/data/store';
import { useUnlocked } from '@/lib/security/AppLock';
import { useTheme } from '@/theme/theme';

/**
 * Where one-tap logging lands: Siri and Shortcuts, the widget's buttons and
 * the app icon's long-press menu all open bloom://quick/<action>. Logging
 * waits until Bloom is loaded and unlocked, then says what changed, with Undo.
 */
type Outcome =
  | { kind: 'started'; previous: PeriodRecord[] }
  | { kind: 'ended'; previous: PeriodRecord[] }
  | { kind: 'already-started' }
  | { kind: 'nothing-to-end' };

export default function QuickAction() {
  const { action } = useLocalSearchParams<{ action: string }>();
  const { ready, data, actions } = useData();
  const { analysis, today } = useCycle();
  const unlocked = useUnlocked();
  const { colors, space } = useTheme();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (!ready || !unlocked || done.current) return;
    done.current = true;
    if (!data.profile.onboardedAt) {
      router.replace('/');
      return;
    }
    const status = analysis.today;
    const previous = activePeriods(data);
    switch (action) {
      case 'period-start':
        if (status?.isPeriodDay) {
          setOutcome({ kind: 'already-started' });
        } else {
          actions.startPeriod(today);
          setOutcome({ kind: 'started', previous });
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        break;
      case 'period-end':
        if (!status?.isPeriodDay) {
          setOutcome({ kind: 'nothing-to-end' });
        } else {
          actions.endPeriod(today);
          setOutcome({ kind: 'ended', previous });
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        break;
      case 'assistant':
        router.replace('/assistant');
        break;
      default: // 'check-in' and anything unknown
        router.replace(`/log/${today}`);
    }
  }, [ready, unlocked, action, data, analysis.today, actions, today]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const undo = () => {
    if (outcome && 'previous' in outcome) actions.setPeriods(outcome.previous);
    close();
  };

  if (!outcome) return <Screen nav="close" scroll={false}>{null}</Screen>;

  const copy = {
    started: { icon: 'droplet', title: 'Period started today', body: 'Bloom has updated your predictions.' },
    ended: { icon: 'check-circle', title: 'Period ended today', body: 'Bloom has updated your predictions.' },
    'already-started': { icon: 'droplet', title: 'Your period is already logged', body: `Today is part of a period in Bloom.` },
    'nothing-to-end': { icon: 'calendar', title: 'No period to end today', body: 'Bloom doesn’t have a period in progress. You can edit any day in the calendar.' },
  }[outcome.kind] as { icon: 'droplet' | 'check-circle' | 'calendar'; title: string; body: string };

  const changed = outcome.kind === 'started' || outcome.kind === 'ended';

  return (
    <Screen
      nav="close"
      scroll={false}
      testID="quick"
      footer={
        <View style={{ gap: space.sm }}>
          <Button label="Add today’s check-in" onPress={() => router.replace(`/log/${today}`)} fullWidth testID="quick-checkin" />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {changed ? <Button label="Undo" variant="secondary" onPress={undo} style={{ flex: 1 }} testID="quick-undo" /> : null}
            <Button label="Done" variant="soft" onPress={close} style={{ flex: 1 }} testID="quick-done" />
          </View>
        </View>
      }
    >
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: space.lg, paddingHorizontal: space.lg }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather name={copy.icon} size={32} color={colors.onPrimarySoft} />
        </View>
        <Text variant="title1" align="center" heading>
          {copy.title}
        </Text>
        <Text variant="body" tone="muted" align="center">
          {formatDate(today, 'long')}. {copy.body}
        </Text>
      </View>
    </Screen>
  );
}
