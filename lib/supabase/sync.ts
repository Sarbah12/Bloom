import type { SupabaseClient } from '@supabase/supabase-js';

import type { ISODate } from '@/lib/cycle/dates';
import { analyzeCycles } from '@/lib/cycle/engine';
import type { Energy, ExerciseLevel, Flow, GoalKey, MedicationKind, MoodKey, PainLevel, ReliefKey, SymptomKey } from '@/lib/data/catalog';
import type { AppData, DailyLog, JournalEntry, Medication, Reminders, StoredPeriod, Timestamp } from '@/lib/data/types';
import { mergeSnapshot, type PushPlan, type RemoteSnapshot } from '@/lib/sync/merge';

import { supabase } from './client';

/** Bump when the prediction rules change, so cached predictions can be told apart. */
export const ENGINE_VERSION = '1';
/** The privacy-policy version a consent was given against. */
export const POLICY_VERSION = '2026-11';

const PAGE = 1000;

function client(): SupabaseClient {
  if (!supabase) throw new Error('Cloud backup is not configured in this build.');
  return supabase;
}

/** Supabase returns at most 1000 rows per request; read every page. */
async function selectAll<T>(table: string, columns: string, order: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client()
      .from(table)
      .select(columns)
      .order(order)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return out;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const num = (v: unknown) => (v === null || v === undefined || v === '' ? undefined : Number(v));

function chunks<T>(xs: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

async function check<T extends { error: unknown }>(p: PromiseLike<T>): Promise<T> {
  const r = await p;
  if (r.error) throw r.error;
  return r;
}

interface PeriodRow {
  id: string;
  start_date: string;
  end_date: string | null;
  updated_at: string;
  deleted_at: string | null;
}
interface DayRow {
  log_date: string;
  flow: Flow | null;
  energy: number | null;
  note: string | null;
  relief: string[] | null;
  sleep_hours: number | string | null;
  water_glasses: number | null;
  exercise: ExerciseLevel | null;
  weight_kg: number | string | null;
  temperature_c: number | string | null;
  meds_taken: string[] | null;
  updated_at: string;
  deleted_at: string | null;
}
interface ChildRow {
  log_date: string;
  symptom?: string;
  severity?: number | null;
  mood?: string;
}
interface MedicationRow {
  id: string;
  name: string;
  kind: MedicationKind;
  dose: string | null;
  reminder_enabled: boolean;
  reminder_time: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
interface JournalRow {
  id: string;
  entry_date: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

async function pull(): Promise<RemoteSnapshot> {
  const [periods, days, symptoms, moods, journal, meds] = await Promise.all([
    selectAll<PeriodRow>('period_logs', 'id,start_date,end_date,updated_at,deleted_at', 'id'),
    selectAll<DayRow>(
      'daily_logs',
      'log_date,flow,energy,note,relief,sleep_hours,water_glasses,exercise,weight_kg,temperature_c,meds_taken,updated_at,deleted_at',
      'log_date',
    ),
    selectAll<ChildRow>('symptom_logs', 'log_date,symptom,severity', 'id'),
    selectAll<ChildRow>('mood_logs', 'log_date,mood', 'id'),
    selectAll<JournalRow>('journal_entries', 'id,entry_date,title,body,created_at,updated_at,deleted_at', 'id'),
    selectAll<MedicationRow>('medications', 'id,name,kind,dose,reminder_enabled,reminder_time,created_at,updated_at,deleted_at', 'id'),
  ]);
  const [{ data: profile }, { data: cycle }, { data: reminders }] = await Promise.all([
    check(client().from('profiles').select('*').maybeSingle()),
    check(client().from('cycle_settings').select('*').maybeSingle()),
    check(client().from('reminders').select('*').maybeSingle()),
  ]);

  const byDay = (rows: ChildRow[], key: 'symptom' | 'mood') => {
    const m = new Map<string, string[]>();
    for (const r of rows) m.set(r.log_date, [...(m.get(r.log_date) ?? []), r[key] as string]);
    return m;
  };
  const symptomMap = byDay(symptoms, 'symptom');
  const moodMap = byDay(moods, 'mood');
  // Cramp strength travels as the severity on that day's cramps row.
  const painMap = new Map<string, PainLevel>();
  for (const r of symptoms) {
    if (r.symptom === 'cramps' && (r.severity === 1 || r.severity === 2 || r.severity === 3)) painMap.set(r.log_date, r.severity);
  }

  const liveDays: DailyLog[] = [];
  const deletedDays: Record<ISODate, Timestamp> = {};
  for (const d of days) {
    if (d.deleted_at) {
      deletedDays[d.log_date] = d.deleted_at;
      continue;
    }
    const day: DailyLog = {
      date: d.log_date,
      flow: d.flow ?? undefined,
      energy: (d.energy ?? undefined) as Energy | undefined,
      note: d.note ?? undefined,
      symptoms: (symptomMap.get(d.log_date) ?? []) as SymptomKey[],
      moods: (moodMap.get(d.log_date) ?? []) as MoodKey[],
      updatedAt: d.updated_at,
    };
    const pain = painMap.get(d.log_date);
    if (pain) day.pain = pain;
    if (d.relief?.length) day.relief = d.relief as ReliefKey[];
    const sleep = num(d.sleep_hours);
    if (sleep !== undefined) day.sleepHours = sleep;
    if (d.water_glasses !== null) day.water = d.water_glasses;
    if (d.exercise) day.exercise = d.exercise;
    const weight = num(d.weight_kg);
    if (weight !== undefined) day.weightKg = weight;
    const temp = num(d.temperature_c);
    if (temp !== undefined) day.temperatureC = temp;
    if (d.meds_taken?.length) day.medsTaken = d.meds_taken;
    liveDays.push(day);
  }

  const [hour, minute] = String(reminders?.daily_check_in_time ?? '20:00')
    .split(':')
    .map(Number);

  return {
    periods: periods.map<StoredPeriod>((p) => ({
      id: p.id,
      startDate: p.start_date,
      endDate: p.end_date,
      updatedAt: p.updated_at,
      deletedAt: p.deleted_at ?? undefined,
    })),
    days: liveDays,
    deletedDays,
    journal: journal.map<JournalEntry>((j) => ({
      id: j.id,
      date: j.entry_date,
      title: j.title,
      body: j.body,
      createdAt: j.created_at,
      updatedAt: j.updated_at,
      deletedAt: j.deleted_at ?? undefined,
    })),
    medications: meds.map<Medication>((m) => {
      const [h, min] = String(m.reminder_time ?? '08:00')
        .split(':')
        .map(Number);
      return {
        id: m.id,
        name: m.name,
        kind: m.kind,
        dose: m.dose ?? undefined,
        reminder: { enabled: m.reminder_enabled, hour: h || 0, minute: min || 0 },
        createdAt: m.created_at,
        updatedAt: m.updated_at,
        deletedAt: m.deleted_at ?? undefined,
      };
    }),
    profile: profile
      ? {
          updatedAt: profile.updated_at,
          value: {
            name: profile.display_name ?? undefined,
            birthYear: profile.birth_year ?? undefined,
            goals: (profile.goals ?? []) as GoalKey[],
            onboardedAt: profile.onboarded_at ?? undefined,
            appearance: profile.appearance,
            weekStartsOn: profile.week_starts_on,
            showFertility: profile.show_fertility,
          },
        }
      : undefined,
    cycle: cycle
      ? {
          updatedAt: cycle.updated_at,
          value: { typicalCycleLength: cycle.typical_cycle_length, typicalPeriodLength: cycle.typical_period_length },
        }
      : undefined,
    reminders: reminders
      ? {
          updatedAt: reminders.updated_at,
          value: {
            periodSoon: {
              enabled: reminders.period_soon_enabled,
              daysBefore: reminders.period_soon_days_before as Reminders['periodSoon']['daysBefore'],
            },
            dailyCheckIn: { enabled: reminders.daily_check_in_enabled, hour: hour || 0, minute: minute || 0 },
            fertileWindow: { enabled: reminders.fertile_window_enabled },
            discreet: reminders.discreet,
          },
        }
      : undefined,
  };
}

async function push(plan: PushPlan, userId: string): Promise<void> {
  const db = client();
  for (const batch of chunks(plan.periods)) {
    await check(
      db.from('period_logs').upsert(
        batch.map((p) => ({
          id: p.id,
          user_id: userId,
          start_date: p.startDate,
          end_date: p.endDate,
          updated_at: p.updatedAt,
          deleted_at: p.deletedAt ?? null,
        })),
      ),
    );
  }
  for (const batch of chunks(plan.journal)) {
    await check(
      db.from('journal_entries').upsert(
        batch.map((j) => ({
          id: j.id,
          user_id: userId,
          entry_date: j.date,
          title: j.deletedAt ? '' : j.title,
          body: j.deletedAt ? '' : j.body,
          created_at: j.createdAt,
          updated_at: j.updatedAt,
          deleted_at: j.deletedAt ?? null,
        })),
      ),
    );
  }

  const medsOut = plan.medications.filter((m) => UUID.test(m.id));
  for (const batch of chunks(medsOut)) {
    await check(
      db.from('medications').upsert(
        batch.map((m) => ({
          id: m.id,
          user_id: userId,
          name: m.deletedAt ? '' : m.name,
          kind: m.kind,
          dose: m.deletedAt ? null : (m.dose ?? null),
          reminder_enabled: m.deletedAt ? false : m.reminder.enabled,
          reminder_time: `${String(m.reminder.hour).padStart(2, '0')}:${String(m.reminder.minute).padStart(2, '0')}`,
          created_at: m.createdAt,
          updated_at: m.updatedAt,
          deleted_at: m.deletedAt ?? null,
        })),
      ),
    );
  }

  const dayRows = [
    ...plan.days.map((d) => ({
      user_id: userId,
      log_date: d.date,
      flow: d.flow ?? null,
      energy: d.energy ?? null,
      note: d.note?.trim() ? d.note : null,
      relief: d.relief ?? [],
      sleep_hours: d.sleepHours ?? null,
      water_glasses: d.water ?? null,
      exercise: d.exercise ?? null,
      weight_kg: d.weightKg ?? null,
      temperature_c: d.temperatureC ?? null,
      meds_taken: (d.medsTaken ?? []).filter((id) => UUID.test(id)),
      updated_at: d.updatedAt,
      deleted_at: null,
    })),
    ...plan.deletedDays.map((d) => ({
      user_id: userId,
      log_date: d.date,
      flow: null,
      energy: null,
      note: null,
      relief: [],
      sleep_hours: null,
      water_glasses: null,
      exercise: null,
      weight_kg: null,
      temperature_c: null,
      meds_taken: [],
      updated_at: d.deletedAt,
      deleted_at: d.deletedAt,
    })),
  ];
  for (const batch of chunks(dayRows)) {
    await check(db.from('daily_logs').upsert(batch, { onConflict: 'user_id,log_date' }));
    // A day's symptoms and moods are replaced as a set.
    const dates = batch.map((r) => r.log_date);
    await check(db.from('symptom_logs').delete().in('log_date', dates));
    await check(db.from('mood_logs').delete().in('log_date', dates));
  }
  const symptomRows = plan.days.flatMap((d) =>
    d.symptoms.map((symptom) => ({ user_id: userId, log_date: d.date, symptom, severity: symptom === 'cramps' ? (d.pain ?? null) : null })),
  );
  const moodRows = plan.days.flatMap((d) => d.moods.map((mood) => ({ user_id: userId, log_date: d.date, mood })));
  for (const batch of chunks(symptomRows, 500)) await check(db.from('symptom_logs').insert(batch));
  for (const batch of chunks(moodRows, 500)) await check(db.from('mood_logs').insert(batch));

  if (plan.profile) {
    const p = plan.profile.value;
    await check(
      db.from('profiles').upsert({
        id: userId,
        display_name: p.name ?? null,
        birth_year: p.birthYear ?? null,
        goals: p.goals,
        onboarded_at: p.onboardedAt ?? null,
        appearance: p.appearance,
        week_starts_on: p.weekStartsOn,
        show_fertility: p.showFertility,
        updated_at: plan.profile.updatedAt,
      }),
    );
  }
  if (plan.cycle) {
    await check(
      db.from('cycle_settings').upsert({
        user_id: userId,
        typical_cycle_length: plan.cycle.value.typicalCycleLength,
        typical_period_length: plan.cycle.value.typicalPeriodLength,
        updated_at: plan.cycle.updatedAt,
      }),
    );
  }
  if (plan.reminders) {
    const r = plan.reminders.value;
    await check(
      db.from('reminders').upsert({
        user_id: userId,
        period_soon_enabled: r.periodSoon.enabled,
        period_soon_days_before: r.periodSoon.daysBefore,
        daily_check_in_enabled: r.dailyCheckIn.enabled,
        daily_check_in_time: `${String(r.dailyCheckIn.hour).padStart(2, '0')}:${String(r.dailyCheckIn.minute).padStart(2, '0')}`,
        fertile_window_enabled: r.fertileWindow.enabled,
        discreet: r.discreet,
        updated_at: plan.reminders.updatedAt,
      }),
    );
  }
}

async function cachePredictions(data: AppData, userId: string, today: ISODate): Promise<void> {
  const a = analyzeCycles(
    data.periods.filter((p) => !p.deletedAt),
    data.cycle,
    today,
  );
  const next = a.nextPeriod;
  const p = a.projections.find((x) => x.fertileEnd >= today);
  await check(
    client()
      .from('cycle_predictions')
      .upsert({
        user_id: userId,
        next_period_start: next?.start ?? null,
        next_period_window_start: next?.windowStart ?? null,
        next_period_window_end: next?.windowEnd ?? null,
        ovulation_date: p?.ovulation ?? null,
        fertile_start: p?.fertileStart ?? null,
        fertile_end: p?.fertileEnd ?? null,
        confidence: a.hasHistory ? a.confidence : null,
        average_cycle_length: a.stats.averageCycleLength,
        average_period_length: a.stats.averagePeriodLength,
        engine_version: ENGINE_VERSION,
        computed_at: new Date().toISOString(),
      }),
  );
}

/**
 * One full backup round: download the cloud copy, merge, upload whatever this
 * phone has that's newer. Returns the merged data for the store to apply.
 */
export async function syncNow(local: AppData, userId: string, today: ISODate): Promise<AppData> {
  const remote = await pull();
  const { data, push: plan } = mergeSnapshot(local, remote, new Date().toISOString());
  await push(plan, userId);
  await cachePredictions(data, userId, today);
  return data;
}

/** Appends a consent decision to the audit log in the cloud. */
export async function recordConsent(purpose: 'cloud_backup' | 'ai_assistant' | 'product_analytics', granted: boolean): Promise<void> {
  await check(client().from('user_consents').insert({ purpose, granted, policy_version: POLICY_VERSION }));
}
