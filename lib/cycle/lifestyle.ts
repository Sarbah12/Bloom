/**
 * How sleep, water, energy and activity line up with the cycle: averages on
 * period days, in the 5 days before a period, and on other days. Only the
 * person's own logs, compared with themselves. Pure.
 */
import { addDays, isWithin, type ISODate } from './dates.ts';
import type { Episode } from './engine.ts';

export interface LifestyleEntry {
  date: ISODate;
  sleepHours?: number;
  water?: number;
  energy?: number;
  exercise?: string;
}

export type LifeWindow = 'period' | 'before' | 'rest';
export type LifeMetric = 'sleepHours' | 'water' | 'energy' | 'active';

export interface WindowStat {
  avg: number | null;
  n: number;
}

export interface MetricSummary {
  metric: LifeMetric;
  period: WindowStat;
  before: WindowStat;
  rest: WindowStat;
}

export const BEFORE_DAYS = 5;
const MIN_DAYS = 3;

/** The smallest gap worth mentioning, per metric. */
const NOTABLE: Record<LifeMetric, number> = { sleepHours: 0.5, water: 1, energy: 0.5, active: 0.2 };

export function windowOf(episodes: readonly Episode[], date: ISODate): LifeWindow {
  if (episodes.some((e) => isWithin(date, e.start, e.end))) return 'period';
  if (episodes.some((e) => isWithin(date, addDays(e.start, -BEFORE_DAYS), addDays(e.start, -1)))) return 'before';
  return 'rest';
}

function value(e: LifestyleEntry, m: LifeMetric): number | undefined {
  if (m === 'active') return e.exercise ? (e.exercise === 'none' ? 0 : 1) : undefined;
  return e[m];
}

export function lifestyleByWindow(entries: readonly LifestyleEntry[], episodes: readonly Episode[]): MetricSummary[] {
  const metrics: LifeMetric[] = ['sleepHours', 'water', 'energy', 'active'];
  const sums = new Map<string, { total: number; n: number }>();
  for (const e of entries) {
    const w = windowOf(episodes, e.date);
    for (const m of metrics) {
      const v = value(e, m);
      if (v === undefined || Number.isNaN(v)) continue;
      const k = `${m}:${w}`;
      const s = sums.get(k) ?? { total: 0, n: 0 };
      s.total += v;
      s.n++;
      sums.set(k, s);
    }
  }
  const stat = (m: LifeMetric, w: LifeWindow): WindowStat => {
    const s = sums.get(`${m}:${w}`);
    return s ? { avg: s.total / s.n, n: s.n } : { avg: null, n: 0 };
  };
  return metrics.map((metric) => ({ metric, period: stat(metric, 'period'), before: stat(metric, 'before'), rest: stat(metric, 'rest') }));
}

const round = (n: number, step: number) => Math.round(n / step) * step;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * One plain sentence per notable difference, comparing period days and the
 * days before a period with the rest of the cycle.
 */
export function lifestyleNotes(summaries: readonly MetricSummary[]): string[] {
  const out: string[] = [];
  for (const s of summaries) {
    if (s.rest.n < MIN_DAYS || s.rest.avg === null) continue;
    for (const w of ['before', 'period'] as const) {
      const ws = s[w];
      if (ws.n < MIN_DAYS || ws.avg === null) continue;
      const diff = ws.avg - s.rest.avg;
      if (Math.abs(diff) < NOTABLE[s.metric]) continue;
      const when = w === 'before' ? 'in the 5 days before your period' : 'during your period';
      const more = diff > 0;
      switch (s.metric) {
        case 'sleepHours':
          out.push(`You sleep about ${fmt(round(Math.abs(diff), 0.5))} hours ${more ? 'more' : 'less'} ${when}.`);
          break;
        case 'water':
          out.push(
            `You drink about ${fmt(round(Math.abs(diff), 1))} ${round(Math.abs(diff), 1) === 1 ? 'glass' : 'glasses'} ${more ? 'more' : 'less'} water ${when}.`,
          );
          break;
        case 'energy':
          out.push(`Your energy tends to be ${more ? 'higher' : 'lower'} ${when}.`);
          break;
        case 'active':
          out.push(
            `You’re ${more ? 'more' : 'less'} active ${when} (${Math.round(ws.avg * 100)}% of days, versus ${Math.round(s.rest.avg * 100)}% otherwise).`,
          );
          break;
      }
    }
  }
  return out;
}
