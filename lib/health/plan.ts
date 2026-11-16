/**
 * Apple Health: what Bloom writes there, and how period days from Health are
 * imported. Pure — data and dates in, samples and records out — so every rule
 * is tested without HealthKit. The native side (modules/bloom-health) only
 * makes Health match the list built here.
 */
import { addDays, compareISO, eachDay, type ISODate } from '../cycle/dates.ts';
import { effectiveEnd, normalizeRecords, type PeriodRecord } from '../cycle/engine.ts';
import type { Flow } from '../data/catalog.ts';
import type { AppData } from '../data/types.ts';

export interface HealthSample {
  type: string;
  key: string;
  date: ISODate;
  value?: number;
  amount?: number;
  unit?: 'kg' | 'degC' | 'mL';
  cycleStart?: boolean;
}

const CAT = 'HKCategoryTypeIdentifier';
const QTY = 'HKQuantityTypeIdentifier';

// HealthKit's raw category values.
const BLEEDING = { unspecified: 1, light: 2, medium: 3, heavy: 4, none: 5 } as const;
const SEVERITY_UNSPECIFIED = 0; // also "present" and "not applicable"
const APPETITE_INCREASED = 3;

const FLOW_VALUE: Record<Flow, number> = {
  spotting: BLEEDING.light,
  light: BLEEDING.light,
  medium: BLEEDING.medium,
  heavy: BLEEDING.heavy,
};

/** Bloom symptoms and moods that have a Health symptom type. */
export const SYMPTOM_TYPES: Record<string, string> = {
  cramps: 'AbdominalCramps',
  bloating: 'Bloating',
  headache: 'Headache',
  back_pain: 'LowerBackPain',
  breast_tenderness: 'BreastPain',
  acne: 'Acne',
  fatigue: 'Fatigue',
  nausea: 'Nausea',
  cravings: 'AppetiteChanges',
  insomnia: 'SleepChanges',
  constipation: 'Constipation',
  diarrhea: 'Diarrhea',
  dizziness: 'Dizziness',
  hot_flushes: 'HotFlashes',
  night_sweats: 'NightSweats',
  brain_fog: 'MemoryLapse',
  vaginal_dryness: 'VaginalDryness',
  palpitations: 'RapidPoundingOrFlutteringHeartbeat',
  mood_swings: 'MoodChanges',
};

/** Logged period days, from the first day of each period to its end (never past today). */
export function periodDays(periods: PeriodRecord[], periodLength: number, today: ISODate): Map<ISODate, { start: boolean }> {
  const days = new Map<ISODate, { start: boolean }>();
  for (const p of periods) {
    if (compareISO(p.startDate, today) > 0) continue;
    const end = effectiveEnd(p, periodLength, today);
    const last = compareISO(end, today) > 0 ? today : end;
    for (const d of eachDay(p.startDate, last)) days.set(d, { start: d === p.startDate });
  }
  return days;
}

/** Everything Bloom should have in Health, given its data today. */
export function healthSamples(data: AppData, today: ISODate): HealthSample[] {
  const periods = data.periods.filter((p) => !p.deletedAt);
  const onPeriod = periodDays(periods, data.cycle.typicalPeriodLength, today);
  const out: HealthSample[] = [];

  for (const [date, { start }] of onPeriod) {
    const flow = data.days[date]?.flow;
    const value = flow ? FLOW_VALUE[flow] : BLEEDING.unspecified;
    out.push({ type: `${CAT}MenstrualFlow`, key: `flow|${date}|${value}|${start ? 1 : 0}`, date, value, cycleStart: start });
  }

  for (const log of Object.values(data.days)) {
    const { date } = log;
    if (compareISO(date, today) > 0) continue;

    if (log.flow === 'spotting' && !onPeriod.has(date)) {
      out.push({ type: `${CAT}IntermenstrualBleeding`, key: `spotting|${date}`, date, value: SEVERITY_UNSPECIFIED });
    }

    for (const s of [...log.symptoms, ...log.moods] as string[]) {
      const name = SYMPTOM_TYPES[s];
      if (!name) continue;
      let value = SEVERITY_UNSPECIFIED;
      if (s === 'cramps' && log.pain) value = log.pain + 1; // mild 2, moderate 3, severe 4
      if (s === 'cravings') value = APPETITE_INCREASED;
      out.push({ type: `${CAT}${name}`, key: `${s}|${date}|${value}`, date, value });
    }

    if (log.weightKg !== undefined) {
      out.push({ type: `${QTY}BodyMass`, key: `weight|${date}|${log.weightKg}`, date, amount: log.weightKg, unit: 'kg' });
    }
    if (log.temperatureC !== undefined) {
      out.push({ type: `${QTY}BodyTemperature`, key: `temp|${date}|${log.temperatureC}`, date, amount: log.temperatureC, unit: 'degC' });
    }
    if (log.water) {
      const ml = log.water * 250;
      out.push({ type: `${QTY}DietaryWater`, key: `water|${date}|${ml}`, date, amount: ml, unit: 'mL' });
    }
  }

  return out.sort((a, b) => compareISO(a.date, b.date) || (a.key < b.key ? -1 : 1));
}

// --- import ----------------------------------------------------------------

const FLOW_FROM_HEALTH: Record<number, Flow | undefined> = {
  [BLEEDING.light]: 'light',
  [BLEEDING.medium]: 'medium',
  [BLEEDING.heavy]: 'heavy',
};

export interface HealthImport {
  /** The full new list of periods (existing ones kept, new days merged in). */
  periods: PeriodRecord[];
  /** Flow for imported days where Bloom had none. */
  flows: Record<ISODate, Flow>;
  /** Period days Bloom didn't have before. */
  addedDays: number;
}

/**
 * Adds period days from Health that Bloom doesn't have. Never removes or
 * shortens a period Bloom already has, and never adds future days.
 */
export function planImport(
  existing: PeriodRecord[],
  healthDays: { date: ISODate; value: number }[],
  data: Pick<AppData, 'days'>,
  periodLength: number,
  today: ISODate,
  newId: () => string,
): HealthImport {
  const known = periodDays(existing, periodLength, today);
  const valueByDay = new Map<ISODate, number>();
  for (const d of healthDays) {
    if (compareISO(d.date, today) > 0 || d.value === BLEEDING.none) continue;
    valueByDay.set(d.date, Math.max(valueByDay.get(d.date) ?? 0, d.value));
  }

  const flows: Record<ISODate, Flow> = {};
  for (const [date, value] of valueByDay) {
    const flow = FLOW_FROM_HEALTH[value];
    if (flow && !data.days[date]?.flow) flows[date] = flow;
  }

  const fresh = [...valueByDay.keys()].filter((d) => !known.has(d)).sort(compareISO);
  const added: PeriodRecord[] = [];
  for (const date of fresh) {
    const last = added[added.length - 1];
    if (last && last.endDate && addDays(last.endDate, 1) === date) last.endDate = date;
    else added.push({ id: newId(), startDate: date, endDate: date });
  }

  const periods = added.length ? normalizeRecords([...existing, ...added], periodLength, today) : existing;
  return { periods, flows, addedDays: fresh.length };
}
