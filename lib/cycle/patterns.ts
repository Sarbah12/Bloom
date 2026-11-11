/**
 * Patterns across cycles: "cramps usually show up in the first two days of
 * your period", "you often log feeling anxious in the days before it".
 *
 * Deliberately conservative — a pattern needs at least three logs across at
 * least two cycles, and most of them (60 %+) in the same part of the cycle.
 * Patterns describe what you logged; they never explain why.
 */
import { addDays, diffDays, isWithin, type ISODate } from './dates.ts';
import { LIMITS, type CycleAnalysis } from './engine.ts';

export interface DayEntry {
  date: ISODate;
  symptoms?: string[];
  moods?: string[];
}

export type Timing = 'during-period' | 'before-period' | 'mid-cycle' | 'other';

export interface Pattern {
  kind: 'symptom' | 'mood';
  key: string;
  timing: Exclude<Timing, 'other'>;
  /** Logs that fell in `timing`. */
  matching: number;
  /** All logs of this key that could be placed in a cycle. */
  total: number;
  cycles: number;
}

export const PATTERN_RULES = {
  minLogs: 3,
  minCycles: 2,
  minShare: 0.6,
  beforePeriodDays: 5,
  midCycleRadius: 2,
} as const;

/** Where a date sits relative to the cycle it belongs to. */
export function timingOf(analysis: CycleAnalysis, date: ISODate): { timing: Timing; cycle: number } | null {
  const eps = analysis.episodes;
  let i = -1;
  for (let k = 0; k < eps.length; k++) if (eps[k].start <= date) i = k;
  if (i < 0) return null;
  const nextStart = eps[i + 1]?.start ?? analysis.nextPeriod?.start;
  if (!nextStart || date >= nextStart) return null;

  if (isWithin(date, eps[i].start, eps[i].end)) return { timing: 'during-period', cycle: i };
  const untilNext = diffDays(date, nextStart);
  if (untilNext >= 1 && untilNext <= PATTERN_RULES.beforePeriodDays) return { timing: 'before-period', cycle: i };
  const ovulation = addDays(nextStart, -(LIMITS.lutealDays + 1));
  if (Math.abs(diffDays(ovulation, date)) <= PATTERN_RULES.midCycleRadius) return { timing: 'mid-cycle', cycle: i };
  return { timing: 'other', cycle: i };
}

export function findPatterns(entries: DayEntry[], analysis: CycleAnalysis): Pattern[] {
  if (!analysis.hasHistory) return [];
  const tally = new Map<
    string,
    { kind: Pattern['kind']; key: string; byTiming: Record<Timing, number>; cycles: Set<number>; total: number }
  >();

  for (const entry of entries) {
    const placed = timingOf(analysis, entry.date);
    if (!placed) continue;
    const add = (kind: Pattern['kind'], key: string) => {
      const id = `${kind}:${key}`;
      const t = tally.get(id) ?? {
        kind,
        key,
        byTiming: { 'during-period': 0, 'before-period': 0, 'mid-cycle': 0, other: 0 },
        cycles: new Set<number>(),
        total: 0,
      };
      t.byTiming[placed.timing] += 1;
      t.cycles.add(placed.cycle);
      t.total += 1;
      tally.set(id, t);
    };
    for (const s of new Set(entry.symptoms ?? [])) add('symptom', s);
    for (const m of new Set(entry.moods ?? [])) add('mood', m);
  }

  const out: Pattern[] = [];
  for (const t of tally.values()) {
    if (t.total < PATTERN_RULES.minLogs || t.cycles.size < PATTERN_RULES.minCycles) continue;
    const ranked = (['during-period', 'before-period', 'mid-cycle'] as const)
      .map((timing) => ({ timing, matching: t.byTiming[timing] }))
      .sort((a, b) => b.matching - a.matching);
    const best = ranked[0];
    if (best.matching / t.total < PATTERN_RULES.minShare) continue;
    out.push({ kind: t.kind, key: t.key, timing: best.timing, matching: best.matching, total: t.total, cycles: t.cycles.size });
  }
  return out.sort((a, b) => b.matching / b.total - a.matching / a.total || b.matching - a.matching);
}

export interface RangeSummary {
  checkIns: number;
  periodsStarted: number;
  topSymptoms: { key: string; count: number }[];
  topMoods: { key: string; count: number }[];
}

/** Counts for a report period, e.g. one month or one year (inclusive). */
export function summarizeRange(entries: DayEntry[], analysis: CycleAnalysis, from: ISODate, to: ISODate): RangeSummary {
  const inRange = entries.filter((e) => isWithin(e.date, from, to));
  const count = (pick: (e: DayEntry) => string[] | undefined) => {
    const m = new Map<string, number>();
    for (const e of inRange) for (const k of new Set(pick(e) ?? [])) m.set(k, (m.get(k) ?? 0) + 1);
    return [...m.entries()]
      .map(([key, c]) => ({ key, count: c }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
      .slice(0, 5);
  };
  return {
    checkIns: inRange.length,
    periodsStarted: analysis.episodes.filter((e) => isWithin(e.start, from, to)).length,
    topSymptoms: count((e) => e.symptoms),
    topMoods: count((e) => e.moods),
  };
}
