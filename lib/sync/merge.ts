/**
 * Merging this phone's data with the cloud backup.
 *
 * Every record carries `updatedAt`; for each one the newer side wins, and on a
 * tie the cloud copy is kept (nothing to send). Deletions travel as
 * tombstones, so a period removed on one phone doesn't come back from the
 * other. Pure: no network, no clock — `now` is passed in.
 */
import type { CycleSettings } from '../cycle/engine.ts';
import type { ISODate } from '../cycle/dates.ts';
import type {
  AppData,
  DailyLog,
  JournalEntry,
  Medication,
  Preferences,
  Profile,
  Reminders,
  StoredPeriod,
  Timestamp,
} from '../data/types.ts';

export type SyncedProfile = Pick<Profile, 'name' | 'birthYear' | 'goals' | 'onboardedAt'> &
  Pick<Preferences, 'appearance' | 'weekStartsOn' | 'showFertility'>;

export interface Stamped<T> {
  value: T;
  updatedAt: Timestamp;
}

export interface RemoteSnapshot {
  periods: StoredPeriod[];
  days: DailyLog[];
  deletedDays: Record<ISODate, Timestamp>;
  journal: JournalEntry[];
  /** Absent from backups made before medications existed. */
  medications?: Medication[];
  profile?: Stamped<SyncedProfile>;
  cycle?: Stamped<CycleSettings>;
  reminders?: Stamped<Reminders>;
}

export interface PushPlan {
  periods: StoredPeriod[];
  days: DailyLog[];
  deletedDays: { date: ISODate; deletedAt: Timestamp }[];
  journal: JournalEntry[];
  medications: Medication[];
  profile: Stamped<SyncedProfile> | null;
  cycle: Stamped<CycleSettings> | null;
  reminders: Stamped<Reminders> | null;
}

export interface MergeResult {
  data: AppData;
  push: PushPlan;
}

/** Postgres and JavaScript format instants differently; compare as numbers. */
export function instant(ts: Timestamp | undefined): number {
  const n = ts ? Date.parse(ts) : NaN;
  return Number.isNaN(n) ? 0 : n;
}

function mergeById<T extends { id: string; updatedAt: Timestamp }>(local: T[], remote: T[]): { merged: T[]; push: T[] } {
  const remaining = new Map(remote.map((r) => [r.id, r]));
  const merged: T[] = [];
  const push: T[] = [];
  for (const l of local) {
    const r = remaining.get(l.id);
    remaining.delete(l.id);
    if (!r || instant(l.updatedAt) > instant(r.updatedAt)) {
      merged.push(l);
      push.push(l);
    } else {
      merged.push(r);
    }
  }
  return { merged: [...merged, ...remaining.values()], push };
}

type DayState = { kind: 'live'; log: DailyLog; at: number } | { kind: 'deleted'; deletedAt: Timestamp; at: number };

function dayState(live: DailyLog | undefined, deletedAt: Timestamp | undefined): DayState | null {
  const liveAt = live ? instant(live.updatedAt) : -1;
  const deadAt = deletedAt ? instant(deletedAt) : -1;
  if (liveAt < 0 && deadAt < 0) return null;
  return liveAt >= deadAt
    ? { kind: 'live', log: live as DailyLog, at: liveAt }
    : { kind: 'deleted', deletedAt: deletedAt as Timestamp, at: deadAt };
}

export function toSyncedProfile(d: AppData): SyncedProfile {
  return {
    name: d.profile.name,
    birthYear: d.profile.birthYear,
    goals: d.profile.goals,
    onboardedAt: d.profile.onboardedAt,
    appearance: d.preferences.appearance,
    weekStartsOn: d.preferences.weekStartsOn,
    showFertility: d.preferences.showFertility,
  };
}

function pickSingleton<T>(localValue: T, localAt: Timestamp | undefined, remote: Stamped<T> | undefined, now: Timestamp) {
  if (remote && instant(remote.updatedAt) >= instant(localAt)) return { value: remote.value, at: remote.updatedAt, push: null };
  const at = localAt ?? now;
  return { value: localValue, at, push: { value: localValue, updatedAt: at } };
}

export function mergeSnapshot(local: AppData, remote: RemoteSnapshot, now: Timestamp): MergeResult {
  const periods = mergeById(local.periods, remote.periods);
  const journal = mergeById(local.journal, remote.journal);
  const medications = mergeById(local.medications ?? [], remote.medications ?? []);

  const remoteDays = new Map(remote.days.map((d) => [d.date, d]));
  const localDeleted = local.sync.deletedDays ?? {};
  const dates = new Set<ISODate>([
    ...Object.keys(local.days),
    ...Object.keys(localDeleted),
    ...remoteDays.keys(),
    ...Object.keys(remote.deletedDays),
  ]);
  const days: Record<ISODate, DailyLog> = {};
  const deletedDays: Record<ISODate, Timestamp> = {};
  const pushDays: DailyLog[] = [];
  const pushDeleted: PushPlan['deletedDays'] = [];

  for (const date of dates) {
    const mine = dayState(local.days[date], localDeleted[date]);
    const theirs = dayState(remoteDays.get(date), remote.deletedDays[date]);
    const localWins = mine && (!theirs || mine.at > theirs.at);
    const winner = localWins ? mine : (theirs ?? mine);
    if (!winner) continue;
    if (winner.kind === 'live') days[date] = winner.log;
    else deletedDays[date] = winner.deletedAt;
    if (localWins && mine) {
      if (mine.kind === 'live') pushDays.push(mine.log);
      else pushDeleted.push({ date, deletedAt: mine.deletedAt });
    }
  }

  const profile = pickSingleton(toSyncedProfile(local), local.sync.stamps?.profile, remote.profile, now);
  const cycle = pickSingleton(local.cycle, local.sync.stamps?.cycle, remote.cycle, now);
  const reminders = pickSingleton(local.reminders, local.sync.stamps?.reminders, remote.reminders, now);
  const p = profile.value;

  return {
    data: {
      ...local,
      profile: {
        ...local.profile,
        name: p.name,
        birthYear: p.birthYear,
        goals: p.goals,
        onboardedAt: p.onboardedAt ?? local.profile.onboardedAt,
      },
      preferences: { ...local.preferences, appearance: p.appearance, weekStartsOn: p.weekStartsOn, showFertility: p.showFertility },
      cycle: cycle.value,
      reminders: reminders.value,
      periods: periods.merged,
      journal: journal.merged,
      medications: medications.merged,
      days,
      sync: {
        ...local.sync,
        lastSyncedAt: now,
        deletedDays,
        stamps: { profile: profile.at, cycle: cycle.at, reminders: reminders.at },
      },
    },
    push: {
      periods: periods.push,
      journal: journal.push,
      medications: medications.push,
      days: pushDays,
      deletedDays: pushDeleted,
      profile: profile.push,
      cycle: cycle.push,
      reminders: reminders.push,
    },
  };
}

/** Describes merged data as if it were the cloud copy (see applyCloudMerge). */
export function snapshotOf(d: AppData): RemoteSnapshot {
  const stamps = d.sync.stamps ?? {};
  return {
    periods: d.periods,
    days: Object.values(d.days),
    deletedDays: d.sync.deletedDays ?? {},
    journal: d.journal,
    medications: d.medications,
    profile: stamps.profile ? { value: toSyncedProfile(d), updatedAt: stamps.profile } : undefined,
    cycle: stamps.cycle ? { value: d.cycle, updatedAt: stamps.cycle } : undefined,
    reminders: stamps.reminders ? { value: d.reminders, updatedAt: stamps.reminders } : undefined,
  };
}
