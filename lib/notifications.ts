import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { toLocalDate, type ISODate } from '@/lib/cycle/dates';
import type { CycleAnalysis } from '@/lib/cycle/engine';
import type { DailyLog, Medication, Reminders } from '@/lib/data/types';

import { planReminders, type PlannedReminder } from './reminders/plan';

/**
 * Local reminders, scheduled on the device. Nothing is sent from a server.
 *
 * Privacy: with `discreet` on (the default) no notification text mentions
 * periods, fertility or symptoms, because lock screens are seen by others.
 */
export const supportsReminders = Platform.OS !== 'web';

const CHANNEL = 'reminders';

if (supportsReminders) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  // Long-press buttons on "your period may start today" (never used when discreet).
  Notifications.setNotificationCategoryAsync('period-due', [
    { identifier: 'started', buttonTitle: 'It started', options: { opensAppToForeground: true } },
    { identifier: 'not-yet', buttonTitle: 'Not yet', options: { opensAppToForeground: false } },
  ]).catch(() => {});
}

export async function requestReminderPermission(): Promise<boolean> {
  if (!supportsReminders) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

export { planReminders, type PlannedReminder } from './reminders/plan';

async function apply(plan: PlannedReminder[]): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!plan.length) return;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;
  for (const r of plan) {
    const trigger: Notifications.NotificationTriggerInput =
      'daily' in r.at
        ? { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: r.at.hour, minute: r.at.minute, channelId: CHANNEL }
        : {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: (() => {
              const d = toLocalDate(r.at.date);
              d.setHours(r.at.hour, r.at.minute, 0, 0);
              return d;
            })(),
            channelId: CHANNEL,
          };
    if (trigger.type === Notifications.SchedulableTriggerInputTypes.DATE && (trigger.date as Date).getTime() <= Date.now()) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: {
        title: r.title,
        body: r.body,
        sound: false,
        data: r.url ? { url: r.url } : {},
        ...(r.category ? { categoryIdentifier: r.category } : {}),
      },
      trigger,
    });
  }
}

/** Keeps scheduled reminders in step with settings and predictions. */
export function useReminderSync(
  reminders: Reminders,
  analysis: CycleAnalysis,
  today: ISODate,
  showFertility: boolean,
  ready: boolean,
  medications: readonly Medication[] = [],
  periodLength = 5,
  days: Record<ISODate, DailyLog> = {},
) {
  const todayLog = days[today];
  const key = JSON.stringify(
    planReminders(reminders, analysis, today, { showFertility, medications, periodLength, days: todayLog ? { [today]: todayLog } : {} }),
  );
  useEffect(() => {
    if (!supportsReminders || !ready) return;
    apply(JSON.parse(key) as PlannedReminder[]).catch((e) => console.warn('Bloom: reminders not scheduled', e));
  }, [key, ready]);
}

/** Opens the screen a notification points to when it's tapped (or its "It started" button). */
export function useNotificationTaps(ready: boolean) {
  useEffect(() => {
    if (!supportsReminders || !ready) return;
    const open = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      if (response.actionIdentifier === 'not-yet') return;
      const url = response.notification.request.content.data?.url;
      const target = response.actionIdentifier === 'started' ? '/quick/period-start' : typeof url === 'string' ? url : null;
      if (target) router.push(target as never);
    };
    // Tapped while Bloom wasn't running.
    Notifications.getLastNotificationResponseAsync()
      .then((r) => {
        open(r);
        return Notifications.clearLastNotificationResponseAsync();
      })
      .catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [ready]);
}
