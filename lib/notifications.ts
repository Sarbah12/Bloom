import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { addDays, toLocalDate, type ISODate } from '@/lib/cycle/dates';
import type { CycleAnalysis } from '@/lib/cycle/engine';
import type { Medication, Reminders } from '@/lib/data/types';

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

export interface PlannedReminder {
  id: string;
  title: string;
  body: string;
  /** Local date + time to fire, or a daily repeat. */
  at: { date: ISODate; hour: number; minute: number } | { daily: true; hour: number; minute: number };
}

/** Works out which reminders should exist. Pure, so it can be reasoned about. */
export function planReminders(
  reminders: Reminders,
  analysis: CycleAnalysis,
  today: ISODate,
  showFertility: boolean,
  medications: readonly Medication[] = [],
): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  const discreet = reminders.discreet;
  const gentle = { title: 'Bloom', body: 'A gentle reminder from Bloom.' };

  if (reminders.dailyCheckIn.enabled) {
    out.push({
      id: 'check-in',
      title: 'Bloom',
      body: 'How are you feeling today? Take a moment to check in.',
      at: { daily: true, hour: reminders.dailyCheckIn.hour, minute: reminders.dailyCheckIn.minute },
    });
  }

  for (const m of medications) {
    if (m.deletedAt || !m.reminder.enabled) continue;
    out.push({
      id: `med-${m.id}`,
      ...(discreet ? gentle : { title: 'Medication reminder', body: `Time for ${m.name}${m.dose ? ` (${m.dose})` : ''}.` }),
      at: { daily: true, hour: m.reminder.hour, minute: m.reminder.minute },
    });
  }

  const next = analysis.nextPeriod;
  if (reminders.periodSoon.enabled && next && !next.isLate) {
    const date = addDays(next.start, -reminders.periodSoon.daysBefore);
    if (date > today) {
      out.push({
        id: 'period-soon',
        ...(discreet
          ? gentle
          : {
              title: 'Your period may start soon',
              body: `Estimated in ${reminders.periodSoon.daysBefore} day${reminders.periodSoon.daysBefore === 1 ? '' : 's'}. Estimates can vary.`,
            }),
        at: { date, hour: 9, minute: 0 },
      });
    }
  }

  if (reminders.fertileWindow.enabled && showFertility) {
    const upcoming = analysis.projections.find((p) => p.fertileStart > today);
    if (upcoming) {
      out.push({
        id: 'fertile-window',
        ...(discreet
          ? gentle
          : {
              title: 'Estimated fertile window',
              body: 'Your estimated fertile window begins tomorrow. This is not a form of contraception.',
            }),
        at: { date: addDays(upcoming.fertileStart, -1), hour: 9, minute: 0 },
      });
    }
  }
  return out.filter((r) => !('date' in r.at) || r.at.date > today || r.at.date === today);
}

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
      content: { title: r.title, body: r.body, sound: false },
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
) {
  const key = JSON.stringify(planReminders(reminders, analysis, today, showFertility, medications));
  useEffect(() => {
    if (!supportsReminders || !ready) return;
    apply(JSON.parse(key) as PlannedReminder[]).catch((e) => console.warn('Bloom: reminders not scheduled', e));
  }, [key, ready]);
}
