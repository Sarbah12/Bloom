import { randomUUID } from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import type { ISODate } from '@/lib/cycle/dates';
import {
  analyzeCycles,
  endPeriod as endPeriodRule,
  startPeriod as startPeriodRule,
  togglePeriodDay as togglePeriodRule,
  type CycleAnalysis,
  type CycleSettings,
  type PeriodRecord,
} from '@/lib/cycle/engine';
import { destroyVault, loadVault, saveVault } from '@/lib/storage/vault';
import { mergeSnapshot, snapshotOf } from '@/lib/sync/merge';

import type { GoalKey } from './catalog';
import { createDefaultData, hydrate } from './defaults';
import { useToday } from './today';
import type { AppData, Consents, DailyLog, JournalEntry, Medication, Preferences, Profile, Reminders, StoredPeriod } from './types';

export interface OnboardingInput {
  lastPeriodStart: ISODate | null;
  cycle: CycleSettings;
  goals: GoalKey[];
  consents: Pick<Consents, 'cloudBackup' | 'aiAssistant' | 'productAnalytics'>;
  name?: string;
}

export interface DataActions {
  completeOnboarding(input: OnboardingInput): void;
  startPeriod(date: ISODate): void;
  endPeriod(date: ISODate): void;
  togglePeriodDay(date: ISODate): void;
  updateDay(date: ISODate, patch: Partial<Omit<DailyLog, 'date' | 'updatedAt'>>): void;
  saveJournal(entry: Pick<JournalEntry, 'title' | 'body' | 'date'> & { id?: string }): string;
  deleteJournal(id: string): void;
  saveMedication(med: Pick<Medication, 'name' | 'kind' | 'dose' | 'reminder'> & { id?: string }): string;
  deleteMedication(id: string): void;
  /** Ticks or unticks a medication for a day. */
  toggleMedTaken(date: ISODate, medId: string): void;
  updateCycleSettings(patch: Partial<CycleSettings>): void;
  updateReminders(patch: Partial<Reminders>): void;
  updateConsents(patch: Partial<Omit<Consents, 'updatedAt'>>): void;
  updatePreferences(patch: Partial<Preferences>): void;
  updateProfile(patch: Partial<Profile>): void;
  /** Replaces everything (used when restoring an export). */
  replaceAll(next: AppData): void;
  /**
   * Applies the result of a cloud sync. Merged rather than replaced, so an
   * edit made while the sync was running isn't lost.
   */
  applyCloudMerge(merged: AppData): void;
  exportJSON(): string;
  eraseEverything(): Promise<void>;
}

interface DataContextValue {
  ready: boolean;
  /** Set when stored data existed but couldn't be decrypted on this device. */
  recoveredFromUnreadable: boolean;
  /** True while the latest changes couldn't be written to secure storage. */
  saveFailed: boolean;
  data: AppData;
  actions: DataActions;
}

const DataContext = createContext<DataContextValue | null>(null);

const now = () => new Date().toISOString();

export function activePeriods(data: AppData): PeriodRecord[] {
  return data.periods.filter((p) => !p.deletedAt).map(({ id, startDate, endDate }) => ({ id, startDate, endDate }));
}

/**
 * Applies the engine's new list of periods, keeping tombstones for removed ones
 * and touching `updatedAt` only on records that actually changed.
 */
function applyPeriods(data: AppData, next: PeriodRecord[]): AppData {
  const stamp = now();
  const byId = new Map(data.periods.map((p) => [p.id, p]));
  const nextIds = new Set(next.map((p) => p.id));
  const periods: StoredPeriod[] = [];

  for (const p of next) {
    const prev = byId.get(p.id);
    const same = prev && !prev.deletedAt && prev.startDate === p.startDate && prev.endDate === p.endDate;
    periods.push(same ? prev : { ...p, updatedAt: stamp });
  }
  for (const p of data.periods) {
    if (!nextIds.has(p.id)) periods.push(p.deletedAt ? p : { ...p, deletedAt: stamp, updatedAt: stamp });
  }
  return { ...data, periods };
}

function stamp(d: AppData, key: 'profile' | 'cycle' | 'reminders'): AppData['sync'] {
  return { ...d.sync, stamps: { ...d.sync.stamps, [key]: now() } };
}

function isEmptyLog(log: DailyLog): boolean {
  return (
    !log.flow &&
    log.symptoms.length === 0 &&
    log.moods.length === 0 &&
    !log.energy &&
    !log.pain &&
    !log.relief?.length &&
    log.sleepHours === undefined &&
    log.water === undefined &&
    !log.exercise &&
    log.weightKg === undefined &&
    log.temperatureC === undefined &&
    !log.medsTaken?.length &&
    !log.note?.trim()
  );
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => createDefaultData());
  const [ready, setReady] = useState(false);
  const [recoveredFromUnreadable, setRecovered] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const latest = useRef(data);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const today = useToday();
  const todayRef = useRef(today);
  todayRef.current = today;

  useEffect(() => {
    let cancelled = false;
    loadVault<AppData>().then(
      (result) => {
        if (cancelled) return;
        if (result.status === 'ok') {
          const hydrated = hydrate(result.data);
          latest.current = hydrated;
          setData(hydrated);
        } else if (result.status === 'unreadable') {
          setRecovered(true);
        }
        setReady(true);
      },
      () => {
        if (!cancelled) {
          setRecovered(true);
          setReady(true);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return;
    dirty.current = false;
    try {
      await saveVault(latest.current);
      setSaveFailed(false);
    } catch (e) {
      // Keep the changes in memory and retry on the next edit or when the app
      // goes to the background; meanwhile the UI says so.
      dirty.current = true;
      setSaveFailed(true);
      console.warn('Bloom: saving failed, will retry', e);
    }
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') flush();
    });
    return () => sub.remove();
  }, [flush]);

  const update = useCallback(
    (fn: (d: AppData) => AppData) => {
      const next = fn(latest.current);
      if (next === latest.current) return;
      latest.current = next;
      dirty.current = true;
      setData(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 250);
    },
    [flush],
  );

  const actions = useMemo<DataActions>(() => {
    const periodLength = () => latest.current.cycle.typicalPeriodLength;
    const api: DataActions = {
      completeOnboarding(input) {
        update((d) => {
          const stamp = now();
          const periods: StoredPeriod[] = input.lastPeriodStart
            ? [{ id: randomUUID(), startDate: input.lastPeriodStart, endDate: null, updatedAt: stamp }]
            : [];
          return {
            ...d,
            profile: { ...d.profile, name: input.name?.trim() || undefined, goals: input.goals, onboardedAt: stamp },
            cycle: input.cycle,
            periods: [...d.periods, ...periods],
            consents: { ...d.consents, ...input.consents, updatedAt: stamp },
            preferences: { ...d.preferences, showFertility: true },
            sync: { ...d.sync, stamps: { profile: stamp, cycle: stamp, reminders: stamp } },
          };
        });
      },
      startPeriod(date) {
        update((d) => applyPeriods(d, startPeriodRule(activePeriods(d), date, periodLength(), todayRef.current, randomUUID)));
      },
      endPeriod(date) {
        update((d) => applyPeriods(d, endPeriodRule(activePeriods(d), date, todayRef.current)));
      },
      togglePeriodDay(date) {
        update((d) => applyPeriods(d, togglePeriodRule(activePeriods(d), date, periodLength(), todayRef.current, randomUUID)));
      },
      updateDay(date, patch) {
        update((d) => {
          const prev: DailyLog = d.days[date] ?? { date, symptoms: [], moods: [], updatedAt: now() };
          const next: DailyLog = { ...prev, ...patch, date, updatedAt: now() };
          const days = { ...d.days };
          const deletedDays = { ...(d.sync.deletedDays ?? {}) };
          if (isEmptyLog(next)) {
            if (days[date]) deletedDays[date] = next.updatedAt;
            delete days[date];
          } else {
            days[date] = next;
            delete deletedDays[date];
          }
          return { ...d, days, sync: { ...d.sync, deletedDays } };
        });
      },
      saveJournal(entry) {
        const id = entry.id ?? randomUUID();
        update((d) => {
          const stamp = now();
          const existing = d.journal.find((j) => j.id === id);
          const saved: JournalEntry = existing
            ? { ...existing, ...entry, id, updatedAt: stamp }
            : { ...entry, id, createdAt: stamp, updatedAt: stamp };
          return { ...d, journal: [saved, ...d.journal.filter((j) => j.id !== id)] };
        });
        return id;
      },
      deleteJournal(id) {
        update((d) => ({
          ...d,
          journal: d.journal.map((j) => (j.id === id ? { ...j, title: '', body: '', deletedAt: now(), updatedAt: now() } : j)),
        }));
      },
      saveMedication(med) {
        const id = med.id ?? randomUUID();
        update((d) => {
          const stamp = now();
          const existing = d.medications.find((m) => m.id === id);
          const saved: Medication = existing
            ? { ...existing, ...med, id, name: med.name.trim(), updatedAt: stamp }
            : { ...med, id, name: med.name.trim(), createdAt: stamp, updatedAt: stamp };
          return { ...d, medications: [...d.medications.filter((m) => m.id !== id), saved] };
        });
        return id;
      },
      deleteMedication(id) {
        update((d) => ({
          ...d,
          medications: d.medications.map((m) =>
            m.id === id
              ? { ...m, name: '', dose: undefined, reminder: { ...m.reminder, enabled: false }, deletedAt: now(), updatedAt: now() }
              : m,
          ),
        }));
      },
      toggleMedTaken(date, medId) {
        const prev = latest.current.days[date]?.medsTaken ?? [];
        const medsTaken = prev.includes(medId) ? prev.filter((x) => x !== medId) : [...prev, medId];
        api.updateDay(date, { medsTaken });
      },
      updateCycleSettings(patch) {
        update((d) => ({ ...d, cycle: { ...d.cycle, ...patch }, sync: stamp(d, 'cycle') }));
      },
      updateReminders(patch) {
        update((d) => ({ ...d, reminders: { ...d.reminders, ...patch }, sync: stamp(d, 'reminders') }));
      },
      updateConsents(patch) {
        update((d) => ({ ...d, consents: { ...d.consents, ...patch, updatedAt: now() } }));
      },
      updatePreferences(patch) {
        // App lock is a per-device choice, so it doesn't count as a profile change.
        const synced = Object.keys(patch).some((k) => k !== 'appLock');
        update((d) => ({ ...d, preferences: { ...d.preferences, ...patch }, sync: synced ? stamp(d, 'profile') : d.sync }));
      },
      updateProfile(patch) {
        update((d) => ({ ...d, profile: { ...d.profile, ...patch }, sync: stamp(d, 'profile') }));
      },
      replaceAll(next) {
        update(() => hydrate(next));
      },
      applyCloudMerge(merged) {
        update((d) => mergeSnapshot(d, snapshotOf(merged), now()).data);
      },
      exportJSON() {
        const d = latest.current;
        return JSON.stringify(
          {
            exportedAt: now(),
            app: 'Bloom',
            format: 'bloom-export',
            version: 1,
            ...d,
            periods: d.periods.filter((p) => !p.deletedAt),
            journal: d.journal.filter((j) => !j.deletedAt),
            medications: d.medications.filter((m) => !m.deletedAt),
          },
          null,
          2,
        );
      },
      async eraseEverything() {
        if (timer.current) clearTimeout(timer.current);
        dirty.current = false;
        await destroyVault();
        const fresh = createDefaultData();
        latest.current = fresh;
        setData(fresh);
      },
    };
    return api;
  }, [update]);

  const value = useMemo(
    () => ({ ready, recoveredFromUnreadable, saveFailed, data, actions }),
    [ready, recoveredFromUnreadable, saveFailed, data, actions],
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}

/** The cycle analysis for today, recomputed only when periods or settings change. */
export function useCycle(): { analysis: CycleAnalysis; today: ISODate } {
  const { data } = useData();
  const today = useToday();
  const age = data.profile.birthYear ? Number(today.slice(0, 4)) - data.profile.birthYear : undefined;
  const periods = data.periods;
  const cycle = data.cycle;
  const analysis = useMemo(() => analyzeCycles(activePeriods({ periods } as AppData), cycle, today, { age }), [periods, cycle, today, age]);
  return { analysis, today };
}
