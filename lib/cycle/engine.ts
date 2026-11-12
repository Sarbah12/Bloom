/**
 * The cycle engine: one pure function from period records to everything the
 * app shows about cycles — today's cycle day and phase, the next period, the
 * fertile window, confidence, and when a pattern is worth a conversation with
 * a healthcare professional.
 *
 * Nothing in here touches React, storage or the clock. `today` is always
 * passed in, which makes every rule testable with fixed dates.
 *
 * Every output is an ESTIMATE. The UI must say so, and the fertile window must
 * never be presented as contraception.
 */
import { addDays, diffDays, isWithin, maxISO, minISO, type ISODate } from './dates.ts';

export type Phase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';
export type Confidence = 'low' | 'medium' | 'high';

export interface PeriodRecord {
  id: string;
  startDate: ISODate;
  /** Null while the period is ongoing and its last day isn't recorded yet. */
  endDate: ISODate | null;
}

export interface CycleSettings {
  /** What the person told us in onboarding; used until history takes over. */
  typicalCycleLength: number;
  typicalPeriodLength: number;
  /** Perimenopause changes how estimates and notices are worded. */
  lifeStage?: LifeStage;
}

export interface EngineOptions {
  /** Narrows the "regular" variation threshold to 7 days for ages 26–41 (FIGO 2018). */
  age?: number;
  /** How many future cycles to project for the calendar. */
  projectCycles?: number;
  /**
   * Perimenopause: cycles are expected to vary, so estimates are wider and
   * gentler, and bleeding after a year without periods is flagged.
   */
  lifeStage?: LifeStage;
}

export type LifeStage = 'cycles' | 'perimenopause';

/**
 * Clinical reference points. Sources:
 * - FIGO AUB System 1 (Munro et al., 2018): normal frequency 24–38 days,
 *   duration ≤ 8 days, regularity: shortest-to-longest variation ≤ 7–9 days.
 * - Fertile window: the 5 days before ovulation and the day of ovulation
 *   (Wilcox et al., NEJM 1995).
 * - Luteal phase is ~14 days on average, so ovulation is estimated 14 days
 *   before the next period starts.
 */
export const LIMITS = {
  lutealDays: 14,
  fertileDaysBeforeOvulation: 5,
  /** Bleeding days separated by up to this many empty days count as one period. */
  episodeGapDays: 2,
  minCountedCycle: 10,
  maxCountedCycle: 120,
  historyWindow: 6,
  typicalCycleMin: 24,
  typicalCycleMax: 38,
  maxTypicalPeriod: 8,
  variationLimit: 9,
  variationLimitPrime: 7,
  noPeriodDays: 90,
  /** 12 months without a period: menopause (NHS / NICE NG23). */
  menopauseGapDays: 365,
  minCycleForPrediction: 15,
  maxCycleForPrediction: 90,
} as const;

export interface Episode {
  start: ISODate;
  end: ISODate;
  /** True when the end comes from the average because it wasn't recorded. */
  endIsEstimated: boolean;
  length: number;
}

export interface CompletedCycle {
  start: ISODate;
  /** Day before the next period started. */
  end: ISODate;
  length: number;
  periodLength: number;
  /** False when the length looks like a logging gap rather than a real cycle. */
  counted: boolean;
}

export interface CycleStats {
  countedCycles: number;
  averageCycleLength: number;
  averagePeriodLength: number;
  shortestCycle: number | null;
  longestCycle: number | null;
  /** Longest minus shortest of the recent counted cycles (FIGO's measure). */
  variation: number | null;
  standardDeviation: number | null;
  /** Where the averages came from. */
  basis: 'settings' | 'blended' | 'history';
}

export interface ProjectedCycle {
  /** 0 = the cycle you're in now, 1 = the next one, … */
  index: number;
  start: ISODate;
  periodEnd: ISODate;
  ovulation: ISODate;
  ovulationEarliest: ISODate;
  ovulationLatest: ISODate;
  fertileStart: ISODate;
  fertileEnd: ISODate;
  /** When the following period is expected. */
  nextStart: ISODate;
}

export interface NextPeriod {
  start: ISODate;
  windowStart: ISODate;
  windowEnd: ISODate;
  /** Negative when the period is late. */
  daysUntil: number;
  isLate: boolean;
  daysLate: number;
}

export type NoticeId = 'cycles-short' | 'cycles-long' | 'cycles-irregular' | 'period-long' | 'no-period' | 'late' | 'bleeding-after-gap';

export interface HealthNotice {
  id: NoticeId;
  /** `care` = worth discussing with a healthcare professional. */
  level: 'info' | 'care';
  title: string;
  body: string;
}

export interface TodayStatus {
  date: ISODate;
  cycleDay: number;
  phase: Phase | null;
  isPeriodDay: boolean;
  /** Day N of the current period, when bleeding today. */
  periodDay: number | null;
  /** An ongoing period whose end hasn't been recorded. */
  openPeriod: boolean;
}

export interface CycleAnalysis {
  hasHistory: boolean;
  episodes: Episode[];
  cycles: CompletedCycle[];
  stats: CycleStats;
  confidence: Confidence;
  confidenceReasons: string[];
  today: TodayStatus | null;
  nextPeriod: NextPeriod | null;
  projections: ProjectedCycle[];
  notices: HealthNotice[];
}

const CARE_FOOTER =
  "This isn't a diagnosis. If you're concerned — or you have severe pain, very heavy bleeding, or bleeding between periods or after sex — talk to a healthcare professional.";

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function standardDeviation(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length);
}

/** The last day of a record, estimating it from the average when it's open. */
export function effectiveEnd(record: PeriodRecord, periodLength: number, today: ISODate): ISODate {
  if (record.endDate) return maxISO(record.startDate, record.endDate);
  const estimated = addDays(record.startDate, Math.max(1, periodLength) - 1);
  return maxISO(record.startDate, minISO(estimated, today));
}

/**
 * Turns raw records into bleeding episodes. Records that overlap, touch, or are
 * separated by a day or two (spotting gaps, a missed log) are one period.
 * Records starting in the future are ignored — you can't log tomorrow.
 */
export function toEpisodes(records: PeriodRecord[], periodLength: number, today: ISODate): Episode[] {
  const valid = records
    .filter((r) => r.startDate <= today)
    .map((r) => {
      const open = !r.endDate;
      // An open period is assumed to run for the average length; days after
      // today are still a forecast, but for grouping we use the full estimate.
      const end = open ? addDays(r.startDate, Math.max(1, periodLength) - 1) : maxISO(r.startDate, r.endDate as ISODate);
      return { start: r.startDate, end, endIsEstimated: open };
    })
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

  const out: Episode[] = [];
  for (const r of valid) {
    const last = out[out.length - 1];
    if (last && diffDays(last.end, r.start) <= LIMITS.episodeGapDays + 1) {
      if (r.end > last.end) {
        last.end = r.end;
        last.endIsEstimated = r.endIsEstimated;
      }
      last.length = diffDays(last.start, last.end) + 1;
    } else {
      out.push({ ...r, length: diffDays(r.start, r.end) + 1 });
    }
  }
  return out;
}

function computeStats(episodes: Episode[], cycles: CompletedCycle[], settings: CycleSettings): CycleStats {
  const recent = cycles.filter((c) => c.counted).slice(-LIMITS.historyWindow);
  const lengths = recent.map((c) => c.length);
  const n = lengths.length;
  const typicalC = clamp(Math.round(settings.typicalCycleLength), LIMITS.minCycleForPrediction, LIMITS.maxCycleForPrediction);
  const typicalP = clamp(Math.round(settings.typicalPeriodLength), 1, 14);

  // With fewer than three cycles, what the person told us still carries weight:
  // one odd month shouldn't swing every prediction.
  let averageCycleLength: number;
  let basis: CycleStats['basis'];
  if (n >= 3) {
    averageCycleLength = mean(lengths);
    basis = 'history';
  } else if (n > 0) {
    averageCycleLength = (lengths.reduce((a, b) => a + b, 0) + typicalC * (3 - n)) / 3;
    basis = 'blended';
  } else {
    averageCycleLength = typicalC;
    basis = 'settings';
  }

  const closed = episodes
    .filter((e) => !e.endIsEstimated)
    .slice(-LIMITS.historyWindow)
    .map((e) => e.length);
  const averagePeriodLength = closed.length >= 2 ? mean(closed) : closed.length === 1 ? (closed[0] + typicalP) / 2 : typicalP;

  return {
    countedCycles: n,
    averageCycleLength: clamp(Math.round(averageCycleLength), LIMITS.minCycleForPrediction, LIMITS.maxCycleForPrediction),
    averagePeriodLength: clamp(Math.round(averagePeriodLength), 1, 14),
    shortestCycle: n >= 2 ? Math.min(...lengths) : null,
    longestCycle: n >= 2 ? Math.max(...lengths) : null,
    variation: n >= 2 ? Math.max(...lengths) - Math.min(...lengths) : null,
    standardDeviation: n >= 2 ? Math.round(standardDeviation(lengths) * 10) / 10 : null,
    basis,
  };
}

function variationLimit(age?: number): number {
  return age !== undefined && age >= 26 && age <= 41 ? LIMITS.variationLimitPrime : LIMITS.variationLimit;
}

function assessConfidence(stats: CycleStats, age?: number, peri = false): { level: Confidence; reasons: string[] } {
  const result = assessBase(stats, age);
  if (!peri) return result;
  result.reasons.push('Cycles often change in perimenopause, so treat dates as a rough guide.');
  return { level: result.level === 'high' ? 'medium' : result.level, reasons: result.reasons };
}

function assessBase(stats: CycleStats, age?: number): { level: Confidence; reasons: string[] } {
  const n = stats.countedCycles;
  const reasons: string[] = [];
  if (n === 0) {
    reasons.push('Based on the typical cycle length you entered.');
    reasons.push('Log your next few periods and estimates will adapt to you.');
    return { level: 'low', reasons };
  }
  reasons.push(`Based on ${n} recorded cycle${n === 1 ? '' : 's'}.`);
  if (stats.variation !== null) {
    reasons.push(
      stats.variation === 0
        ? 'Your recent cycles have all been the same length.'
        : `Your recent cycles vary by ${stats.variation} day${stats.variation === 1 ? '' : 's'}.`,
    );
  }
  if (stats.variation !== null && stats.variation > variationLimit(age)) {
    reasons.push('Cycles that vary a lot are harder to predict, so treat dates as a rough guide.');
    return { level: 'low', reasons };
  }
  if (n >= 4 && stats.variation !== null && stats.variation <= LIMITS.variationLimitPrime) {
    return { level: 'high', reasons };
  }
  if (n >= 3) return { level: 'medium', reasons };
  reasons.push('A few more cycles will make estimates more personal.');
  return { level: 'low', reasons };
}

function project(start: ISODate, periodEnd: ISODate, index: number, stats: CycleStats): ProjectedCycle {
  const C = stats.averageCycleLength;
  const shortest = stats.shortestCycle ?? C - 2;
  const longest = stats.longestCycle ?? C + 2;
  // Ovulation ~14 days before the next period: cycle day (C - 14).
  const ovuDay = (len: number) => Math.max(1, len - LIMITS.lutealDays);
  const ovulation = addDays(start, ovuDay(C) - 1);
  const ovulationEarliest = addDays(start, ovuDay(Math.min(shortest, C)) - 1);
  const ovulationLatest = addDays(start, ovuDay(Math.max(longest, C)) - 1);
  return {
    index,
    start,
    periodEnd,
    ovulation,
    ovulationEarliest,
    ovulationLatest,
    fertileStart: addDays(ovulationEarliest, -LIMITS.fertileDaysBeforeOvulation),
    fertileEnd: ovulationLatest,
    nextStart: addDays(start, C),
  };
}

function phaseIn(p: ProjectedCycle, date: ISODate, lateTolerance: number): Phase | null {
  if (date <= p.periodEnd) return 'menstrual';
  const fromOvu = diffDays(p.ovulation, date);
  if (Math.abs(fromOvu) <= 1) return 'ovulatory';
  if (fromOvu < -1) return 'follicular';
  if (date < p.nextStart) return 'luteal';
  // Past the expected start of the next period: still luteal for a while, then
  // we stop guessing.
  return diffDays(p.nextStart, date) <= lateTolerance ? 'luteal' : null;
}

function buildNotices(
  stats: CycleStats,
  episodes: Episode[],
  next: NextPeriod | null,
  today: ISODate,
  age?: number,
  peri = false,
): HealthNotice[] {
  const notices: HealthNotice[] = [];
  const n = stats.countedCycles;
  const last = episodes[episodes.length - 1];
  const previous = episodes[episodes.length - 2];

  // Bleeding after 12 months without a period (NHS: always see a GP).
  if (last && previous && diffDays(previous.start, last.start) >= LIMITS.menopauseGapDays && diffDays(last.start, today) <= 90) {
    notices.push({
      id: 'bleeding-after-gap',
      level: 'care',
      title: 'Bleeding after a year without periods',
      body: `Your last period started ${diffDays(previous.start, last.start)} days after the one before. Any bleeding after 12 months without a period should be checked by a GP, even if it’s light or only once. It’s usually not serious, but it’s important to get it looked at. ${CARE_FOOTER}`,
    });
  }

  if (peri && last && diffDays(last.start, today) >= LIMITS.noPeriodDays) {
    const gap = diffDays(last.start, today);
    notices.push({
      id: 'no-period',
      level: 'info',
      title: `No period recorded for ${gap} days`,
      body:
        gap >= LIMITS.menopauseGapDays
          ? 'Twelve months without a period usually means you’ve reached menopause. If you bleed after this, see a GP — bleeding after menopause should always be checked.'
          : 'Longer gaps between periods are common in perimenopause. Pregnancy is still possible until menopause, so if there’s any chance, a pregnancy test can help.',
    });
  } else if (last && diffDays(last.start, today) >= LIMITS.noPeriodDays) {
    notices.push({
      id: 'no-period',
      level: 'care',
      title: `No period recorded for ${diffDays(last.start, today)} days`,
      body: `Going three months or more without a period is worth checking with a healthcare professional, especially if this is new for you. If you've simply not logged recently, you can add past periods in the calendar. ${CARE_FOOTER}`,
    });
  } else if (next?.isLate && next.daysLate >= 7) {
    notices.push({
      id: 'late',
      level: 'info',
      title: `Your period is ${next.daysLate} days later than estimated`,
      body: 'Late periods are common — stress, illness, travel, weight changes and some medicines can shift a cycle. If there is any chance you could be pregnant, a pregnancy test can help. If periods stay irregular, mention it to a healthcare professional.',
    });
  }

  if (n >= 3 && stats.basis === 'history') {
    if (stats.averageCycleLength < LIMITS.typicalCycleMin) {
      notices.push({
        id: 'cycles-short',
        level: 'care',
        title: 'Your cycles are shorter than the typical range',
        body: `Your recent cycles average ${stats.averageCycleLength} days. A typical adult cycle is ${LIMITS.typicalCycleMin}–${LIMITS.typicalCycleMax} days. If this is a change for you or it continues, it's worth discussing with a healthcare professional. ${CARE_FOOTER}`,
      });
    } else if (stats.averageCycleLength > LIMITS.typicalCycleMax) {
      notices.push({
        id: 'cycles-long',
        level: 'care',
        title: 'Your cycles are longer than the typical range',
        body: `Your recent cycles average ${stats.averageCycleLength} days. A typical adult cycle is ${LIMITS.typicalCycleMin}–${LIMITS.typicalCycleMax} days. Longer cycles have many causes, and a healthcare professional can help you understand yours. ${CARE_FOOTER}`,
      });
    }
    if (peri && stats.variation !== null && stats.variation > variationLimit(age)) {
      notices.push({
        id: 'cycles-irregular',
        level: 'info',
        title: 'Your cycle length has been varying',
        body: `Your shortest and longest recent cycles differ by ${stats.variation} days. This is common in perimenopause. See a GP if periods come more often than every 3 weeks, are very heavy, or you bleed between periods or after sex. ${CARE_FOOTER}`,
      });
    } else if (stats.variation !== null && stats.variation > variationLimit(age)) {
      notices.push({
        id: 'cycles-irregular',
        level: 'care',
        title: 'Your cycle length has been varying',
        body: `Your shortest and longest recent cycles differ by ${stats.variation} days. Some variation is normal, but a difference of more than ${variationLimit(age)} days is often described as irregular. Tracking a few more cycles will show whether it settles; if it doesn't, consider talking to a healthcare professional. ${CARE_FOOTER}`,
      });
    }
  }

  const recentClosed = episodes.filter((e) => !e.endIsEstimated).slice(-3);
  const longOne = recentClosed.find((e) => e.length > LIMITS.maxTypicalPeriod);
  if (longOne) {
    notices.push({
      id: 'period-long',
      level: 'care',
      title: 'A recent period lasted longer than usual',
      body: `A period of ${longOne.length} days is longer than the typical ${LIMITS.maxTypicalPeriod} days or fewer. If your periods are often this long or very heavy, a healthcare professional can help. ${CARE_FOOTER}`,
    });
  }
  return notices;
}

/** Everything the app knows about cycles, as of `today`. */
export function analyzeCycles(
  records: PeriodRecord[],
  settings: CycleSettings,
  today: ISODate,
  options: EngineOptions = {},
): CycleAnalysis {
  const projectCount = options.projectCycles ?? 6;
  const typicalP = clamp(Math.round(settings.typicalPeriodLength), 1, 14);

  // Group with the stated period length first; the average needs episodes.
  let episodes = toEpisodes(records, typicalP, today);
  const draftCycles = cyclesFrom(episodes);
  const draftStats = computeStats(episodes, draftCycles, settings);
  // Re-group open periods with the learned average, so an open period is
  // estimated from your history rather than the onboarding guess.
  if (draftStats.averagePeriodLength !== typicalP) {
    episodes = toEpisodes(records, draftStats.averagePeriodLength, today);
  }
  const cycles = cyclesFrom(episodes);
  const stats = computeStats(episodes, cycles, settings);
  const peri = options.lifeStage === 'perimenopause';
  const { level, reasons } = assessConfidence(stats, options.age, peri);

  if (episodes.length === 0) {
    return {
      hasHistory: false,
      episodes,
      cycles,
      stats,
      confidence: level,
      confidenceReasons: reasons,
      today: null,
      nextPeriod: null,
      projections: [],
      notices: [],
    };
  }

  const last = episodes[episodes.length - 1];
  const C = stats.averageCycleLength;
  const P = stats.averagePeriodLength;
  const predictedStart = addDays(last.start, C);
  const isLate = today > predictedStart;
  const daysLate = isLate ? diffDays(predictedStart, today) : 0;
  const spread = stats.countedCycles >= 3 && stats.standardDeviation !== null ? clamp(Math.ceil(stats.standardDeviation), 1, 5) : 3;
  // Perimenopause: cycles change, so the window is never narrower than ±4 days.
  const half = peri ? clamp(spread + 2, 4, 7) : spread;

  const nextPeriod: NextPeriod = {
    start: predictedStart,
    windowStart: addDays(predictedStart, -half),
    windowEnd: addDays(predictedStart, half),
    daysUntil: diffDays(today, predictedStart),
    isLate,
    daysLate,
  };

  const projections: ProjectedCycle[] = [project(last.start, last.end, 0, stats)];
  // When the period is late, the next one could start any day, so the forecast
  // restarts from today rather than from a date that has already passed.
  let start = isLate ? today : predictedStart;
  for (let i = 1; i <= projectCount; i++) {
    projections.push(project(start, addDays(start, P - 1), i, stats));
    start = addDays(start, C);
  }
  if (isLate) projections[0].nextStart = today;

  const current = projections[0];
  const periodToday = isWithin(today, last.start, last.end);
  const todayStatus: TodayStatus = {
    date: today,
    cycleDay: diffDays(last.start, today) + 1,
    phase: periodToday ? 'menstrual' : phaseIn({ ...current, nextStart: predictedStart }, today, 14),
    isPeriodDay: periodToday,
    periodDay: periodToday ? diffDays(last.start, today) + 1 : null,
    openPeriod: periodToday && last.endIsEstimated,
  };

  return {
    hasHistory: true,
    episodes,
    cycles,
    stats,
    confidence: level,
    confidenceReasons: reasons,
    today: todayStatus,
    nextPeriod,
    projections,
    notices: buildNotices(stats, episodes, nextPeriod, today, options.age, peri),
  };
}

function cyclesFrom(episodes: Episode[]): CompletedCycle[] {
  const out: CompletedCycle[] = [];
  for (let i = 0; i < episodes.length - 1; i++) {
    const length = diffDays(episodes[i].start, episodes[i + 1].start);
    out.push({
      start: episodes[i].start,
      end: addDays(episodes[i + 1].start, -1),
      length,
      periodLength: episodes[i].length,
      counted: length >= LIMITS.minCountedCycle && length <= LIMITS.maxCountedCycle,
    });
  }
  return out;
}

export type PeriodMark = 'logged' | 'predicted' | null;

export interface DayInfo {
  period: PeriodMark;
  fertile: boolean;
  ovulation: boolean;
  phase: Phase | null;
  cycleDay: number | null;
}

/** What the calendar shows for one date. */
export function describeDay(analysis: CycleAnalysis, date: ISODate, today: ISODate): DayInfo {
  const none: DayInfo = { period: null, fertile: false, ovulation: false, phase: null, cycleDay: null };
  if (!analysis.hasHistory) return none;

  const episode = analysis.episodes.find((e) => isWithin(date, e.start, e.end));
  if (episode) {
    // An open period's days after today are still a forecast.
    const forecast = episode.endIsEstimated && date > today;
    return {
      ...none,
      period: forecast ? 'predicted' : 'logged',
      phase: 'menstrual',
      cycleDay: diffDays(episode.start, date) + 1,
    };
  }

  const first = analysis.projections[0];
  if (!first || date < first.start) {
    // Past cycles: show the cycle day, but no retrospective fertility guesses.
    const owner = [...analysis.episodes].reverse().find((e) => e.start <= date);
    return { ...none, cycleDay: owner ? diffDays(owner.start, date) + 1 : null };
  }

  // Find the projected cycle this date belongs to.
  let owner = first;
  for (const p of analysis.projections) if (p.start <= date) owner = p;

  const isCurrent = owner.index === 0;
  const late = analysis.nextPeriod?.isLate ?? false;
  const inPredictedPeriod = owner.index > 0 && date <= owner.periodEnd && date > today;
  const fertile = isWithin(date, owner.fertileStart, owner.fertileEnd);
  const ovulation = date === owner.ovulation;
  const phaseCycle = isCurrent && late && analysis.nextPeriod ? { ...owner, nextStart: analysis.nextPeriod.start } : owner;

  return {
    period: inPredictedPeriod ? 'predicted' : null,
    fertile,
    ovulation,
    phase: inPredictedPeriod ? 'menstrual' : phaseIn(phaseCycle, date, 14),
    cycleDay: diffDays(owner.start, date) + 1,
  };
}

/* ------------------------------------------------------------------------ */
/* Editing period records                                                    */
/* ------------------------------------------------------------------------ */

type IdFactory = () => string;

function sortRecords(records: PeriodRecord[]): PeriodRecord[] {
  return [...records].sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
}

/** Merges records that overlap or touch. Keeps the earlier record's id. */
export function normalizeRecords(records: PeriodRecord[], periodLength: number, today: ISODate): PeriodRecord[] {
  const out: PeriodRecord[] = [];
  for (const r of sortRecords(records)) {
    const last = out[out.length - 1];
    if (last) {
      const lastEnd = effectiveEnd(last, periodLength, today);
      if (r.startDate <= addDays(lastEnd, 1)) {
        const rEnd = effectiveEnd(r, periodLength, today);
        if (rEnd > lastEnd || (rEnd === lastEnd && r.endDate === null)) last.endDate = r.endDate;
        continue;
      }
    }
    out.push({ ...r });
  }
  return out;
}

/**
 * Marks or unmarks one day as a period day — what tapping a day in the
 * calendar's "Edit period" mode does. Future days can't be logged.
 */
export function togglePeriodDay(
  records: PeriodRecord[],
  date: ISODate,
  periodLength: number,
  today: ISODate,
  newId: IdFactory,
): PeriodRecord[] {
  if (date > today) return records;
  const list = records.map((r) => ({ ...r }));
  const end = (r: PeriodRecord) => effectiveEnd(r, periodLength, today);
  const hit = list.find((r) => isWithin(date, r.startDate, end(r)));

  if (hit) {
    const s = hit.startDate;
    const e = end(hit);
    // An ongoing period stays ongoing unless today itself is unmarked.
    const ongoing = hit.endDate === null;
    if (s === e)
      return normalizeRecords(
        list.filter((r) => r !== hit),
        periodLength,
        today,
      );
    if (date === s) {
      hit.startDate = addDays(s, 1);
      if (!ongoing) hit.endDate = e;
    } else if (date === e) {
      hit.endDate = addDays(e, -1);
    } else {
      hit.endDate = addDays(date, -1);
      list.push({ id: newId(), startDate: addDays(date, 1), endDate: ongoing ? null : e });
    }
    return normalizeRecords(list, periodLength, today);
  }

  const before = list.find((r) => addDays(end(r), 1) === date);
  const after = list.find((r) => addDays(r.startDate, -1) === date);
  if (before && after) {
    before.endDate = after.endDate === null ? null : end(after);
    return normalizeRecords(
      list.filter((r) => r !== after),
      periodLength,
      today,
    );
  }
  if (before) before.endDate = date;
  else if (after) after.startDate = date;
  else list.push({ id: newId(), startDate: date, endDate: date });
  return normalizeRecords(list, periodLength, today);
}

/** "My period started" on `date`. Closes any earlier open period first. */
export function startPeriod(
  records: PeriodRecord[],
  date: ISODate,
  periodLength: number,
  today: ISODate,
  newId: IdFactory,
): PeriodRecord[] {
  if (date > today) return records;
  if (records.some((r) => isWithin(date, r.startDate, effectiveEnd(r, periodLength, today)))) return records;
  const list = records.map((r) =>
    r.endDate === null && r.startDate < date
      ? { ...r, endDate: minISO(effectiveEnd(r, periodLength, today), addDays(date, -1)) }
      : { ...r },
  );
  list.push({ id: newId(), startDate: date, endDate: null });
  return normalizeRecords(list, periodLength, today);
}

/** "My period ended" on `date` — closes the period that contains or precedes it. */
export function endPeriod(records: PeriodRecord[], date: ISODate, today: ISODate): PeriodRecord[] {
  if (date > today) return records;
  const candidates = sortRecords(records).filter((r) => r.startDate <= date);
  const target = candidates[candidates.length - 1];
  if (!target) return records;
  return records.map((r) => (r.id === target.id ? { ...r, endDate: date } : r));
}
