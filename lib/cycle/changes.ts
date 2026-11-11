/**
 * Changes and deviations — measured against the person's OWN history, not
 * population averages (those live in engine.ts notices).
 *
 * - A *change* is a trend: the last few cycles differ from the ones before
 *   (cycles getting longer, periods heavier, cramps worse or easing, a new
 *   symptom).
 * - A *deviation* is one cycle or period that stands out from the person's
 *   usual, or something worth checking whenever it happens (bleeding between
 *   periods, several heavy days, severe pain).
 *
 * Wording describes what was logged and suggests when to talk to a healthcare
 * professional. It never names a cause or a condition as the person's own.
 */
import { addDays, diffDays, isWithin, type ISODate } from './dates.ts';
import type { CycleAnalysis, Episode } from './engine.ts';

export interface LogEntry {
  date: ISODate;
  flow?: 'spotting' | 'light' | 'medium' | 'heavy';
  symptoms?: string[];
  /** Cramp strength: 1 mild, 2 moderate, 3 severe. */
  pain?: 1 | 2 | 3;
}

export interface Finding {
  id: string;
  kind: 'change' | 'deviation';
  /** `care` = worth discussing with a healthcare professional. */
  level: 'info' | 'care' | 'good';
  title: string;
  body: string;
  /** A short comparison for the UI, e.g. "Last 3: 32 days · before: 28 days". */
  detail?: string;
  direction?: 'up' | 'down';
}

export const CHANGE_RULES = {
  recentCycles: 3,
  minEarlierCycles: 2,
  earlierWindow: 6,
  cycleShiftDays: 3,
  periodShiftDays: 2,
  heavyShiftDays: 1.5,
  painShift: 0.75,
  crampDayShift: 1.5,
  outlierMinDays: 4,
  /** Bleeding further than this from a period counts as between periods. */
  betweenPeriodsGap: 2,
  betweenPeriodsLookback: 90,
  heavyDaysCare: 3,
  severePainDays: 2,
} as const;

const SEE_SOMEONE = 'If the change continues, or anything about it worries you, mention it to a healthcare professional.';

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round1 = (n: number) => Math.round(n * 10) / 10;
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
/** Middle value: one unusual cycle among three can't make a trend on its own. */
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Log entries that belong to each period: the bleeding days plus the two days before. */
function periodWindows(episodes: Episode[], entries: LogEntry[]) {
  return episodes.map((e) => {
    const from = addDays(e.start, -2);
    const inWindow = entries.filter((x) => isWithin(x.date, from, e.end));
    return {
      episode: e,
      logged: inWindow.length > 0,
      heavyDays: inWindow.filter((x) => x.flow === 'heavy').length,
      crampDays: inWindow.filter((x) => x.symptoms?.includes('cramps')).length,
      maxPain: Math.max(0, ...inWindow.filter((x) => x.symptoms?.includes('cramps')).map((x) => x.pain ?? 0)),
      severeDays: inWindow.filter((x) => x.pain === 3).length,
    };
  });
}

/** Symptoms logged in each cycle (period start to the day before the next). */
function symptomsByCycle(episodes: Episode[], entries: LogEntry[], today: ISODate) {
  return episodes.map((e, i) => {
    const to = episodes[i + 1] ? addDays(episodes[i + 1].start, -1) : today;
    const inCycle = entries.filter((x) => isWithin(x.date, e.start, to));
    return { logged: inCycle.length > 0, symptoms: new Set(inCycle.flatMap((x) => x.symptoms ?? [])) };
  });
}

export function findChanges(
  analysis: CycleAnalysis,
  entries: LogEntry[],
  today: ISODate,
  symptomLabel: (k: string) => string = (k) => k,
): Finding[] {
  if (!analysis.hasHistory) return [];
  const out: Finding[] = [];
  const R = CHANGE_RULES.recentCycles;

  // 1. Cycle length.
  const lengths = analysis.cycles.filter((c) => c.counted).map((c) => c.length);
  if (lengths.length >= R + CHANGE_RULES.minEarlierCycles) {
    // Medians, not means: a single short or long cycle is a deviation (below), not a trend.
    const recent = lengths.slice(-R);
    const earlier = lengths.slice(-R - CHANGE_RULES.earlierWindow, -R);
    const r = Math.round(median(recent));
    const e = Math.round(median(earlier));
    const diff = r - e;
    if (Math.abs(diff) >= CHANGE_RULES.cycleShiftDays) {
      const longer = diff > 0;
      out.push({
        id: 'cycle-length-trend',
        kind: 'change',
        level: r < 24 || r > 38 ? 'care' : 'info',
        direction: longer ? 'up' : 'down',
        title: `Your cycles have been getting ${longer ? 'longer' : 'shorter'}`,
        detail: `Last ${R}: ${r} days · before: ${e} days`,
        body: `Your last ${R} cycles were usually about ${r} days, compared with ${e} days before that. Cycles can shift with stress, illness, travel, changes in weight or exercise, new medicines or contraception, and in the years before menopause. ${SEE_SOMEONE}`,
      });
    }
  }

  // 2–4. Per-period measures (only periods with at least one check-in count).
  const windows = periodWindows(analysis.episodes, entries);
  const closed = windows.filter((w) => !w.episode.endIsEstimated);
  if (closed.length >= R + CHANGE_RULES.minEarlierCycles) {
    const recent = closed.slice(-R).map((w) => w.episode.length);
    const earlier = closed.slice(-R - CHANGE_RULES.earlierWindow, -R).map((w) => w.episode.length);
    const r = Math.round(median(recent));
    const e = Math.round(median(earlier));
    if (Math.abs(r - e) >= CHANGE_RULES.periodShiftDays) {
      const longer = r > e;
      out.push({
        id: 'period-length-trend',
        kind: 'change',
        level: longer && r > 8 ? 'care' : 'info',
        direction: longer ? 'up' : 'down',
        title: `Your periods have been ${longer ? 'lasting longer' : 'getting shorter'}`,
        detail: `Last ${R}: ${plural(r, 'day')} · before: ${plural(e, 'day')}`,
        body: `Your last ${R} periods lasted about ${plural(r, 'day')}, compared with ${plural(e, 'day')} before. ${SEE_SOMEONE}`,
      });
    }
  }

  const loggedPeriods = windows.filter((w) => w.logged);
  if (loggedPeriods.length >= R + CHANGE_RULES.minEarlierCycles) {
    const recent = loggedPeriods.slice(-R);
    const earlier = loggedPeriods.slice(-R - CHANGE_RULES.earlierWindow, -R);

    const heavyR = mean(recent.map((w) => w.heavyDays));
    const heavyE = mean(earlier.map((w) => w.heavyDays));
    if (heavyR - heavyE >= CHANGE_RULES.heavyShiftDays && heavyR >= 2) {
      out.push({
        id: 'heavy-trend',
        kind: 'change',
        level: 'care',
        direction: 'up',
        title: 'Your periods have had more heavy days lately',
        detail: `Last ${R}: ${round1(heavyR)} heavy days · before: ${round1(heavyE)}`,
        body: 'Heavier periods are common and often treatable. Because heavy bleeding can lower your iron, it is worth mentioning to a healthcare professional, especially if you feel tired, dizzy or short of breath.',
      });
    }

    const crampR = mean(recent.map((w) => w.crampDays));
    const crampE = mean(earlier.map((w) => w.crampDays));
    const pained = (ws: typeof recent) => ws.filter((w) => w.maxPain > 0).map((w) => w.maxPain);
    const painR = pained(recent);
    const painE = pained(earlier);
    const painUp = painR.length >= 2 && painE.length >= 1 && mean(painR) - mean(painE) >= CHANGE_RULES.painShift;
    const painDown = painR.length >= 1 && painE.length >= 2 && mean(painE) - mean(painR) >= CHANGE_RULES.painShift;
    if (crampR - crampE >= CHANGE_RULES.crampDayShift || painUp) {
      out.push({
        id: 'cramps-worse',
        kind: 'change',
        level: 'care',
        direction: 'up',
        title: 'Your cramps have been worse lately',
        detail: painUp ? 'Stronger pain in recent periods' : `Last ${R}: ${round1(crampR)} days with cramps · before: ${round1(crampE)}`,
        body: 'Period pain that is getting worse is worth getting checked — causes such as endometriosis or fibroids are treatable, and you do not have to put up with pain that affects your life.',
      });
    } else if (crampE - crampR >= CHANGE_RULES.crampDayShift || painDown) {
      out.push({
        id: 'cramps-easier',
        kind: 'change',
        level: 'good',
        direction: 'down',
        title: 'Your cramps have eased recently',
        detail: `Last ${R}: ${round1(crampR)} days with cramps · before: ${round1(crampE)}`,
        body: 'Fewer or milder cramps in your recent periods than before. Keep logging what helps so you can see what makes the difference.',
      });
    }
  }

  // 5. New symptoms: in at least 2 of the last 3 cycles, never in earlier logged cycles.
  const byCycle = symptomsByCycle(analysis.episodes, entries, today).filter((c) => c.logged);
  if (byCycle.length >= R + CHANGE_RULES.minEarlierCycles) {
    const recent = byCycle.slice(-R);
    const earlier = byCycle.slice(0, -R);
    const seenBefore = new Set(earlier.flatMap((c) => [...c.symptoms]));
    const counts = new Map<string, number>();
    for (const c of recent) for (const s of c.symptoms) if (!seenBefore.has(s)) counts.set(s, (counts.get(s) ?? 0) + 1);
    for (const [key, n] of counts) {
      if (n < 2) continue;
      out.push({
        id: `new-symptom-${key}`,
        kind: 'change',
        level: 'info',
        direction: 'up',
        title: `${symptomLabel(key)} is new for you`,
        detail: `Logged in ${n} of your last ${R} cycles, not before`,
        body: `You've started logging ${symptomLabel(key).toLowerCase()} recently. Keep tracking it to see whether it follows your cycle. ${SEE_SOMEONE}`,
      });
    }
  }

  return out;
}

export function findDeviations(
  analysis: CycleAnalysis,
  entries: LogEntry[],
  today: ISODate,
  formatDay: (d: ISODate) => string = (d) => d,
): Finding[] {
  if (!analysis.hasHistory) return [];
  const out: Finding[] = [];
  const noticeIds = new Set(analysis.notices.map((n) => n.id));

  // 1. The last completed cycle against the ones before it.
  const counted = analysis.cycles.filter((c) => c.counted);
  if (counted.length >= 4) {
    const last = counted[counted.length - 1];
    const before = counted.slice(-7, -1).map((c) => c.length);
    const avg = Math.round(mean(before));
    const threshold = Math.max(CHANGE_RULES.outlierMinDays, Math.ceil(2 * sd(before)));
    const diff = last.length - avg;
    if (Math.abs(diff) >= threshold) {
      out.push({
        id: 'last-cycle-outlier',
        kind: 'deviation',
        level: 'info',
        direction: diff > 0 ? 'up' : 'down',
        title: `Your last cycle was ${diff > 0 ? 'longer' : 'shorter'} than usual`,
        detail: `${last.length} days · your usual ${avg}`,
        body: `The cycle that started ${formatDay(last.start)} lasted ${last.length} days. One unusual cycle is common — stress, illness or travel can shift it. If it keeps happening, mention it to a healthcare professional.`,
      });
    }
  }

  // 2. This (or the last) period lasting longer than usual.
  const eps = analysis.episodes;
  const lastEp = eps[eps.length - 1];
  const priorClosed = eps
    .slice(0, -1)
    .filter((e) => !e.endIsEstimated)
    .map((e) => e.length);
  if (lastEp && priorClosed.length >= 2 && !noticeIds.has('period-long')) {
    const usual = Math.round(mean(priorClosed.slice(-6)));
    const ongoing = lastEp.endIsEstimated && isWithin(today, lastEp.start, addDays(lastEp.start, 30));
    const length = ongoing ? diffDays(lastEp.start, today) + 1 : lastEp.length;
    if ((ongoing || !lastEp.endIsEstimated) && length >= usual + 3) {
      out.push({
        id: 'period-longer',
        kind: 'deviation',
        level: length > 8 ? 'care' : 'info',
        direction: 'up',
        title: ongoing ? 'This period is lasting longer than usual' : 'Your last period lasted longer than usual',
        detail: `${plural(length, 'day')}${ongoing ? ' so far' : ''} · your usual ${usual}`,
        body: ongoing
          ? `If it has actually finished, tap “Period ended” so your history stays accurate. Periods lasting more than 8 days are worth mentioning to a healthcare professional.`
          : `Periods lasting more than 8 days, or very heavy ones, are worth mentioning to a healthcare professional.`,
      });
    }
  }

  // 3. Bleeding between periods (recent only).
  const from = addDays(today, -CHANGE_RULES.betweenPeriodsLookback);
  const gap = CHANGE_RULES.betweenPeriodsGap;
  const between = entries
    .filter((x) => x.flow && x.date >= from && x.date <= today)
    .filter((x) => !eps.some((e) => isWithin(x.date, addDays(e.start, -gap), addDays(e.end, gap))))
    .map((x) => x.date)
    .sort();
  if (between.length) {
    const days =
      between.length === 1 ? formatDay(between[0]) : `${between.length} days, most recently ${formatDay(between[between.length - 1])}`;
    out.push({
      id: 'between-periods',
      kind: 'deviation',
      level: 'care',
      title: 'Bleeding between periods',
      detail: `Logged on ${days}`,
      body: 'Light spotting can happen around ovulation or with hormonal contraception, but bleeding between periods — or after sex — is worth checking with a healthcare professional, especially if it keeps happening.',
    });
  }

  // 4–5. The latest period: several heavy days, severe pain.
  const windows = periodWindows(eps, entries);
  const latest = windows[windows.length - 1];
  if (latest && diffDays(latest.episode.start, today) <= 40) {
    if (latest.heavyDays >= CHANGE_RULES.heavyDaysCare) {
      out.push({
        id: 'heavy-period',
        kind: 'deviation',
        level: 'care',
        title: `${plural(latest.heavyDays, 'heavy day')} this period`,
        detail: `Period starting ${formatDay(latest.episode.start)}`,
        body: 'Needing to change protection every 1–2 hours, passing large clots, or bleeding through clothes are signs of a heavy period. A healthcare professional can check your iron and talk through treatments.',
      });
    }
    if (latest.severeDays >= CHANGE_RULES.severePainDays) {
      out.push({
        id: 'severe-pain',
        kind: 'deviation',
        level: 'care',
        title: `Severe cramps on ${plural(latest.severeDays, 'day')}`,
        detail: `Period starting ${formatDay(latest.episode.start)}`,
        body: 'Pain that stops you doing everyday things, or that pain relief does not help, is worth getting checked. Get urgent help for sudden, severe pain or pain with a high temperature.',
      });
    }
  }

  return out;
}

export interface ReliefStat {
  key: string;
  days: number;
}

/** What the person said helped on days they logged cramps, most used first. */
export function reliefStats(entries: (LogEntry & { relief?: string[] })[]): ReliefStat[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (!e.symptoms?.includes('cramps')) continue;
    for (const r of new Set(e.relief ?? [])) counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, days]) => ({ key, days })).sort((a, b) => b.days - a.days || a.key.localeCompare(b.key));
}
