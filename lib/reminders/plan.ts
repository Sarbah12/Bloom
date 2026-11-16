/**
 * Which local notifications should exist right now. Pure — settings, cycle
 * analysis and dates in, a list out — so every rule is tested. Scheduling
 * lives in lib/notifications.ts.
 *
 * Privacy: with `discreet` on (the default) no text mentions periods,
 * fertility, symptoms or medicine names, because lock screens are seen by
 * others. Discreet notifications still open the right screen when tapped.
 */
import { addDays, compareISO, type ISODate } from '../cycle/dates.ts';
import type { CycleAnalysis } from '../cycle/engine.ts';
import { pillSchedule } from '../data/pill.ts';
import type { DailyLog, Medication, Reminders } from '../data/types.ts';

export interface PlannedReminder {
  id: string;
  title: string;
  body: string;
  /** Local date + time to fire, or a daily repeat. */
  at: { date: ISODate; hour: number; minute: number } | { daily: true; hour: number; minute: number };
  /** Screen to open when tapped (an app path). */
  url?: string;
  /** iOS/Android action buttons; never used when discreet. */
  category?: 'period-due';
}

export interface PlanContext {
  showFertility: boolean;
  medications?: readonly Medication[];
  /** Typical period length, for how long a period in progress lasts. */
  periodLength: number;
  days?: Record<ISODate, DailyLog>;
}

/** iOS keeps at most 64 pending notifications per app; stay under it. */
export const MAX_SCHEDULED = 60;

const GENTLE = { title: 'Bloom', body: 'A gentle reminder from Bloom.' };
const GENTLE_CHECK_IN = { title: 'Bloom', body: 'How are you today? Tap to check in.' };

export function planReminders(reminders: Reminders, analysis: CycleAnalysis, today: ISODate, ctx: PlanContext): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  const discreet = reminders.discreet;
  const periodCare = reminders.periodCare ?? { enabled: false, hour: 19 };
  const periodDue = reminders.periodDue ?? { enabled: false };

  if (reminders.dailyCheckIn.enabled) {
    out.push({
      id: 'check-in',
      title: 'Bloom',
      body: 'How are you feeling today? Take a moment to check in.',
      at: { daily: true, hour: reminders.dailyCheckIn.hour, minute: reminders.dailyCheckIn.minute },
      url: '/quick/check-in',
    });
  }

  for (const m of ctx.medications ?? []) {
    if (m.deletedAt || !m.reminder.enabled) continue;
    if (m.pack) {
      // Pill packs: only on days a pill is taken, plus a heads-up before a new pack.
      for (const dose of pillSchedule(m.pack, today)) {
        out.push({
          id: `med-${m.id}-${dose.date}`,
          ...(discreet
            ? GENTLE
            : dose.kind === 'pill'
              ? { title: 'Pill reminder', body: `Time for ${m.name}.` }
              : { title: 'New pill pack tomorrow', body: `Your next pack of ${m.name} starts tomorrow.` }),
          at: { date: dose.date, hour: m.reminder.hour, minute: m.reminder.minute },
          url: `/log/${dose.date}`,
        });
      }
      continue;
    }
    out.push({
      id: `med-${m.id}`,
      ...(discreet ? GENTLE : { title: 'Medication reminder', body: `Time for ${m.name}${m.dose ? ` (${m.dose})` : ''}.` }),
      at: { daily: true, hour: m.reminder.hour, minute: m.reminder.minute },
      url: '/quick/check-in',
    });
  }

  const next = analysis.nextPeriod;
  const status = analysis.today;

  if (reminders.periodSoon.enabled && next && !next.isLate) {
    const date = addDays(next.start, -reminders.periodSoon.daysBefore);
    if (compareISO(date, today) > 0) {
      out.push({
        id: 'period-soon',
        ...(discreet
          ? GENTLE
          : {
              title: 'Your period may start soon',
              body: `Estimated in ${reminders.periodSoon.daysBefore} day${reminders.periodSoon.daysBefore === 1 ? '' : 's'}. A good time to pack what you need. Estimates can vary.`,
            }),
        at: { date, hour: 9, minute: 0 },
        url: '/(tabs)',
      });
    }
  }

  // On the estimated day, and again if it hasn't been logged three days later.
  if (periodDue.enabled && next && !status?.isPeriodDay) {
    if (!next.isLate && compareISO(next.start, today) >= 0) {
      out.push({
        id: 'period-due',
        ...(discreet
          ? GENTLE_CHECK_IN
          : { title: 'Your period may start today', body: 'Tap “It started” when it does, and Bloom will update your predictions.' }),
        at: { date: next.start, hour: 9, minute: 0 },
        url: discreet ? '/quick/check-in' : '/quick/period-start',
        category: discreet ? undefined : 'period-due',
      });
    }
    const followUp = addDays(next.start, 3);
    if (compareISO(followUp, today) >= 0) {
      out.push({
        id: 'period-late',
        ...(discreet
          ? GENTLE_CHECK_IN
          : {
              title: 'Has your period started?',
              body: 'It was estimated a few days ago. Log it if it has — cycles often vary by a few days.',
            }),
        at: { date: followUp, hour: 9, minute: 0 },
        url: discreet ? '/quick/check-in' : '/quick/period-start',
        category: discreet ? undefined : 'period-due',
      });
    }
  }

  // During a period: an evening "how are you feeling?" each day, and a
  // question the day after it would usually end.
  if (periodCare.enabled && status?.isPeriodDay && status.periodDay) {
    const remaining = Math.max(0, ctx.periodLength - status.periodDay);
    // The daily check-in already asks every evening; don't ask twice.
    if (!reminders.dailyCheckIn.enabled) {
      for (let i = 0; i <= remaining; i++) {
        const date = addDays(today, i);
        if (i === 0 && ctx.days?.[date]?.flow) continue; // already checked in today
        const dayNumber = status.periodDay + i;
        out.push({
          id: `period-care-${date}`,
          ...(discreet
            ? GENTLE_CHECK_IN
            : {
                title: `Period day ${dayNumber}: how are you feeling?`,
                body: 'Log your flow and any cramps — Bloom learns what helps you most.',
              }),
          at: { date, hour: periodCare.hour, minute: 0 },
          url: `/log/${date}`,
        });
      }
    }
    if (status.openPeriod) {
      const ask = addDays(today, remaining + 1);
      out.push({
        id: 'period-ended',
        ...(discreet ? GENTLE : { title: 'Has your period ended?', body: 'Mark the last day so Bloom’s predictions stay accurate.' }),
        at: { date: ask, hour: periodCare.hour, minute: 0 },
        url: '/(tabs)/calendar',
      });
    }
  }

  if (reminders.fertileWindow.enabled && ctx.showFertility) {
    const upcoming = analysis.projections.find((p) => compareISO(p.fertileStart, today) > 0);
    if (upcoming) {
      out.push({
        id: 'fertile-window',
        ...(discreet
          ? GENTLE
          : { title: 'Estimated fertile window', body: 'Your estimated fertile window begins tomorrow. This is not a form of contraception.' }),
        at: { date: addDays(upcoming.fertileStart, -1), hour: 9, minute: 0 },
        url: '/(tabs)/calendar',
      });
    }
  }

  return out
    .filter((r) => !('date' in r.at) || compareISO(r.at.date, today) >= 0)
    .sort((a, b) => ('daily' in a.at ? -1 : 'daily' in b.at ? 1 : compareISO(a.at.date, (b.at as { date: ISODate }).date)))
    .slice(0, MAX_SCHEDULED);
}
