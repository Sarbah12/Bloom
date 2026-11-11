/**
 * Symptom and mood trends: how often something is logged on each day of the
 * cycle, and month by month. Shares are "of the days you checked in", so a
 * month with few check-ins doesn't look like a month with few symptoms.
 * Pure: no clock, no storage.
 */
import { addMonths, diffDays, monthOf, type ISODate, type MonthKey } from './dates.ts';
import type { Episode } from './engine.ts';

export interface TrendEntry {
  date: ISODate;
  symptoms?: readonly string[];
  moods?: readonly string[];
}

export interface TrendKey {
  kind: 'symptom' | 'mood';
  key: string;
}

export interface TrendBucket {
  /** Cycle day (1-based) or month (YYYY-MM). */
  label: string;
  /** Days with a check-in in this bucket. */
  logged: number;
  /** Of those, days where the symptom or mood was logged. */
  matching: number;
}

/** Days after a period start beyond which a cycle day means little (a missed log). */
const MAX_CYCLE_DAY = 60;

export const matches = (t: TrendKey) => (e: TrendEntry) => (t.kind === 'symptom' ? e.symptoms : e.moods)?.includes(t.key) ?? false;

/** Day of the cycle for a date: 1 on the first day of the latest period on or before it. */
export function cycleDayOf(episodes: readonly Episode[], date: ISODate): number | null {
  let start: ISODate | null = null;
  for (const e of episodes) if (e.start <= date && (!start || e.start > start)) start = e.start;
  if (!start) return null;
  const day = diffDays(start, date) + 1;
  return day <= MAX_CYCLE_DAY ? day : null;
}

export function byCycleDay(entries: readonly TrendEntry[], episodes: readonly Episode[], key: TrendKey, maxDay = 35): TrendBucket[] {
  const buckets: TrendBucket[] = Array.from({ length: maxDay }, (_, i) => ({ label: String(i + 1), logged: 0, matching: 0 }));
  const hit = matches(key);
  for (const e of entries) {
    const day = cycleDayOf(episodes, e.date);
    if (!day || day > maxDay) continue;
    buckets[day - 1].logged++;
    if (hit(e)) buckets[day - 1].matching++;
  }
  return buckets;
}

export function byMonth(entries: readonly TrendEntry[], key: TrendKey, today: ISODate, months = 6): TrendBucket[] {
  const last = monthOf(today);
  const list: MonthKey[] = Array.from({ length: months }, (_, i) => addMonths(last, i - months + 1));
  const index = new Map(list.map((m, i) => [m, i]));
  const buckets: TrendBucket[] = list.map((m) => ({ label: m, logged: 0, matching: 0 }));
  const hit = matches(key);
  for (const e of entries) {
    const i = index.get(monthOf(e.date));
    if (i === undefined || e.date > today) continue;
    buckets[i].logged++;
    if (hit(e)) buckets[i].matching++;
  }
  return buckets;
}

/** The symptoms and moods logged most often, for the trend picker. */
export function topTrendKeys(entries: readonly TrendEntry[], limit = 8): (TrendKey & { days: number })[] {
  const counts = new Map<string, TrendKey & { days: number }>();
  const add = (kind: TrendKey['kind'], key: string) => {
    const id = `${kind}:${key}`;
    const c = counts.get(id) ?? { kind, key, days: 0 };
    c.days++;
    counts.set(id, c);
  };
  for (const e of entries) {
    for (const s of new Set(e.symptoms ?? [])) add('symptom', s);
    for (const m of new Set(e.moods ?? [])) add('mood', m);
  }
  return [...counts.values()].sort((a, b) => b.days - a.days || a.key.localeCompare(b.key)).slice(0, limit);
}

/** "Most often on days 1–3 of your cycle": the peak run of cycle days, if there is one. */
export function peakDays(buckets: readonly TrendBucket[], minLogged = 2): { from: number; to: number; share: number } | null {
  const share = buckets.map((b) => (b.logged >= minLogged ? b.matching / b.logged : 0));
  const top = Math.max(0, ...share);
  if (top < 0.3) return null;
  const threshold = top * 0.75;
  const i = share.indexOf(top);
  let from = i;
  let to = i;
  while (from > 0 && share[from - 1] >= threshold) from--;
  while (to < share.length - 1 && share[to + 1] >= threshold) to++;
  return { from: from + 1, to: to + 1, share: top };
}
