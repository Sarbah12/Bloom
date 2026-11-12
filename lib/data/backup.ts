/**
 * Reading a Bloom export back in — how someone moves to a new phone without a
 * cloud account.
 *
 * The file came from outside the app (Files, Drive, email), so nothing in it
 * is trusted: anything malformed is dropped record by record rather than
 * failing the whole restore, and nothing is applied until the person confirms.
 */
import { isISODate } from '../cycle/dates.ts';
import { BODY_LIMITS, ENERGY_LEVELS, EXERCISE_LEVELS, FLOWS, MEDICATION_KINDS, MOODS, PAIN_LEVELS, RELIEF, SYMPTOMS } from './catalog.ts';
import { hydrate } from './defaults.ts';
import { PACK_TYPES } from './pill.ts';
import type { AppData, DailyLog, JournalEntry, Medication, StoredPeriod } from './types.ts';

export const BACKUP_FORMAT = 'bloom-export';
export const BACKUP_VERSION = 1;

export type ParseResult =
  | { ok: true; data: AppData; exportedAt?: string; counts: { periods: number; days: number; journal: number; medications: number } }
  | { ok: false; reason: string };

const NOT_A_BACKUP = 'This file isn’t a Bloom backup. Choose the file you saved with “Export my data”.';

const FLOW_KEYS = new Set<string>(FLOWS.map((f) => f.key));
const SYMPTOM_KEYS = new Set<string>(SYMPTOMS.map((s) => s.key));
const MOOD_KEYS = new Set<string>(MOODS.map((m) => m.key));
const ENERGY_VALUES = new Set<number>(ENERGY_LEVELS.map((e) => e.value));
const PAIN_VALUES = new Set<number>(PAIN_LEVELS.map((p) => p.value));
const RELIEF_KEYS = new Set<string>(RELIEF.map((r) => r.key));
const EXERCISE_KEYS = new Set<string>(EXERCISE_LEVELS.map((e) => e.value));
const MED_KINDS = new Set<string>(MEDICATION_KINDS.map((k) => k.key));

/** A finite number inside [min, max], rounded to `step`; anything else is dropped. */
function bounded(v: unknown, min: number, max: number, step = 0.01): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) return undefined;
  return Math.round(v / step) * step;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function text(v: unknown, max: number): string | undefined {
  return typeof v === 'string' ? v.slice(0, max) : undefined;
}

export function parseBackup(raw: string, now: string = new Date().toISOString()): ParseResult {
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch {
    return { ok: false, reason: NOT_A_BACKUP };
  }
  if (!isObject(doc) || doc.format !== BACKUP_FORMAT) return { ok: false, reason: NOT_A_BACKUP };
  if (typeof doc.version !== 'number' || doc.version > BACKUP_VERSION) {
    return { ok: false, reason: 'This backup was made by a newer version of Bloom. Update the app, then try again.' };
  }

  const data = hydrate(doc);

  const periods: StoredPeriod[] = [];
  const seenIds = new Set<string>();
  for (const p of Array.isArray(doc.periods) ? doc.periods : []) {
    if (!isObject(p) || typeof p.id !== 'string' || seenIds.has(p.id) || !isISODate(p.startDate)) continue;
    const end = p.endDate === null || p.endDate === undefined ? null : p.endDate;
    if (end !== null && (!isISODate(end) || end < p.startDate)) continue;
    seenIds.add(p.id);
    periods.push({ id: p.id, startDate: p.startDate, endDate: end, updatedAt: text(p.updatedAt, 40) ?? now });
  }

  const days: Record<string, DailyLog> = {};
  for (const [date, v] of Object.entries(isObject(doc.days) ? doc.days : {})) {
    if (!isISODate(date) || !isObject(v)) continue;
    const log: DailyLog = {
      date,
      flow: typeof v.flow === 'string' && FLOW_KEYS.has(v.flow) ? (v.flow as DailyLog['flow']) : undefined,
      symptoms: (Array.isArray(v.symptoms) ? v.symptoms : []).filter(
        (s): s is DailyLog['symptoms'][number] => typeof s === 'string' && SYMPTOM_KEYS.has(s),
      ),
      moods: (Array.isArray(v.moods) ? v.moods : []).filter(
        (m): m is DailyLog['moods'][number] => typeof m === 'string' && MOOD_KEYS.has(m),
      ),
      energy: typeof v.energy === 'number' && ENERGY_VALUES.has(v.energy) ? (v.energy as DailyLog['energy']) : undefined,
      note: text(v.note, 5000),
      updatedAt: text(v.updatedAt, 40) ?? now,
    };
    // Cramp strength and relief only mean something on a day with cramps.
    if (log.symptoms.includes('cramps')) {
      if (typeof v.pain === 'number' && PAIN_VALUES.has(v.pain)) log.pain = v.pain as DailyLog['pain'];
      const relief = [
        ...new Set((Array.isArray(v.relief) ? v.relief : []).filter((r): r is string => typeof r === 'string' && RELIEF_KEYS.has(r))),
      ];
      if (relief.length) log.relief = relief as DailyLog['relief'];
    }
    const sleep = bounded(v.sleepHours, BODY_LIMITS.sleepHours.min, BODY_LIMITS.sleepHours.max, 0.5);
    if (sleep !== undefined) log.sleepHours = sleep;
    const water = bounded(v.water, BODY_LIMITS.water.min, BODY_LIMITS.water.max, 1);
    if (water !== undefined) log.water = water;
    if (typeof v.exercise === 'string' && EXERCISE_KEYS.has(v.exercise)) log.exercise = v.exercise as DailyLog['exercise'];
    const weight = bounded(v.weightKg, BODY_LIMITS.weightKg.min, BODY_LIMITS.weightKg.max, 0.1);
    if (weight !== undefined) log.weightKg = Math.round(weight * 10) / 10;
    const temp = bounded(v.temperatureC, BODY_LIMITS.temperatureC.min, BODY_LIMITS.temperatureC.max);
    if (temp !== undefined) log.temperatureC = Math.round(temp * 100) / 100;
    const meds = (Array.isArray(v.medsTaken) ? v.medsTaken : []).filter(
      (m): m is string => typeof m === 'string' && m.length > 0 && m.length <= 64,
    );
    if (meds.length) log.medsTaken = [...new Set(meds)].slice(0, 30);
    const hasBody =
      log.sleepHours !== undefined ||
      log.water !== undefined ||
      log.exercise ||
      log.weightKg !== undefined ||
      log.temperatureC !== undefined;
    if (log.flow || log.symptoms.length || log.moods.length || log.energy || log.note?.trim() || hasBody || log.medsTaken) days[date] = log;
  }

  const journal: JournalEntry[] = [];
  for (const j of Array.isArray(doc.journal) ? doc.journal : []) {
    if (!isObject(j) || typeof j.id !== 'string' || !isISODate(j.date)) continue;
    journal.push({
      id: j.id,
      date: j.date,
      title: text(j.title, 200) ?? '',
      body: text(j.body, 20000) ?? '',
      createdAt: text(j.createdAt, 40) ?? now,
      updatedAt: text(j.updatedAt, 40) ?? now,
    });
  }

  const medications: Medication[] = [];
  for (const m of Array.isArray(doc.medications) ? doc.medications : []) {
    if (!isObject(m) || typeof m.id !== 'string' || m.id.length > 64 || medications.some((x) => x.id === m.id)) continue;
    const name = text(m.name, 80)?.trim();
    if (!name) continue;
    const r = isObject(m.reminder) ? m.reminder : {};
    const hour = bounded(r.hour, 0, 23, 1);
    const minute = bounded(r.minute, 0, 59, 1);
    const pack =
      m.kind === 'pill' &&
      isObject(m.pack) &&
      PACK_TYPES.some((p) => p.type === (m.pack as Record<string, unknown>).type) &&
      isISODate(m.pack.startDate)
        ? {
            type: m.pack.type as NonNullable<Medication['pack']>['type'],
            startDate: m.pack.startDate,
            setOn: isISODate(m.pack.setOn) ? m.pack.setOn : undefined,
          }
        : undefined;
    medications.push({
      id: m.id,
      name,
      kind: typeof m.kind === 'string' && MED_KINDS.has(m.kind) ? (m.kind as Medication['kind']) : 'other',
      dose: text(m.dose, 40)?.trim() || undefined,
      reminder: { enabled: r.enabled === true && hour !== undefined, hour: hour ?? 8, minute: minute ?? 0 },
      createdAt: text(m.createdAt, 40) ?? now,
      updatedAt: text(m.updatedAt, 40) ?? now,
      ...(pack ? { pack } : {}),
    });
  }

  return {
    ok: true,
    exportedAt: text(doc.exportedAt, 40),
    counts: { periods: periods.length, days: Object.keys(days).length, journal: journal.length, medications: medications.length },
    data: {
      ...data,
      periods,
      days,
      journal,
      medications,
      cycle: {
        typicalCycleLength: data.cycle.typicalCycleLength,
        typicalPeriodLength: data.cycle.typicalPeriodLength,
        lifeStage: data.cycle.lifeStage === 'perimenopause' ? 'perimenopause' : undefined,
      },
      preferences: { ...data.preferences, widgetDetailed: data.preferences.widgetDetailed === true },
      // A restored backup is a set-up app: skip onboarding.
      profile: { ...data.profile, onboardedAt: data.profile.onboardedAt ?? now },
      // Cloud bookkeeping belongs to the old phone.
      sync: {},
    },
  };
}
