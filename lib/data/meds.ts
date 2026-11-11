/**
 * Medication history from daily check-ins. A day counts towards a medication
 * only from the day it was added. Pure.
 */
import { addDays, type ISODate } from '../cycle/dates.ts';

export interface MedLike {
  id: string;
  name: string;
  createdAt: string;
  deletedAt?: string;
}

export type DaysWithMeds = Record<ISODate, { medsTaken?: readonly string[] } | undefined>;

/** Medications still in use, by name. */
export function activeMeds<T extends MedLike>(meds: readonly T[]): T[] {
  return meds.filter((m) => !m.deletedAt).sort((a, b) => a.name.localeCompare(b.name));
}

/** Calendar day a medication was added, in the phone's time zone. */
export function addedOn(med: MedLike, toLocalDay: (instant: string) => ISODate): ISODate {
  return toLocalDay(med.createdAt);
}

/** The last `n` days, oldest first: true taken, false not ticked, null before it was added. */
export function medHistory(
  med: MedLike,
  days: DaysWithMeds,
  today: ISODate,
  added: ISODate,
  n = 30,
): { date: ISODate; taken: boolean | null }[] {
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - n + 1);
    if (date < added) return { date, taken: null };
    return { date, taken: days[date]?.medsTaken?.includes(med.id) ?? false };
  });
}

export function adherence(history: readonly { taken: boolean | null }[]): { taken: number; total: number } {
  const counted = history.filter((h) => h.taken !== null);
  return { taken: counted.filter((h) => h.taken).length, total: counted.length };
}
