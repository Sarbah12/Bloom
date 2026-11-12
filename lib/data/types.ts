import type { ISODate } from '@/lib/cycle/dates';
import type { CycleSettings, PeriodRecord } from '@/lib/cycle/engine';

import type { PillPack } from './pill';
import type { Energy, ExerciseLevel, Flow, GoalKey, MedicationKind, MoodKey, PainLevel, ReliefKey, SymptomKey } from './catalog';

/** Timestamps are full ISO-8601 instants; calendar days are `ISODate`. */
export type Timestamp = string;

export interface StoredPeriod extends PeriodRecord {
  updatedAt: Timestamp;
  /** Kept as a tombstone so a deletion reaches the cloud copy too. */
  deletedAt?: Timestamp;
}

export interface DailyLog {
  date: ISODate;
  flow?: Flow;
  symptoms: SymptomKey[];
  moods: MoodKey[];
  energy?: Energy;
  /** Cramp strength, only when cramps are logged. */
  pain?: PainLevel;
  /** What helped with the cramps. */
  relief?: ReliefKey[];
  /** Hours slept the night before, in half hours. */
  sleepHours?: number;
  /** Glasses of water (about 250 ml each). */
  water?: number;
  exercise?: ExerciseLevel;
  /** Always stored in kilograms; shown in the person's units. */
  weightKg?: number;
  /** Always stored in °C; shown in the person's units. */
  temperatureC?: number;
  /** Ids of medications taken that day. */
  medsTaken?: string[];
  note?: string;
  updatedAt: Timestamp;
}

export interface JournalEntry {
  id: string;
  date: ISODate;
  title: string;
  body: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp;
}

export interface Medication {
  id: string;
  name: string;
  kind: MedicationKind;
  /** Free text such as "400 mg" or "1 tablet". */
  dose?: string;
  /** A daily reminder at this time, scheduled on the phone. */
  reminder: { enabled: boolean; hour: number; minute: number };
  /** For the contraceptive pill: the pack it comes in, so Bloom knows today's pill. */
  pack?: PillPack;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** Tombstone so the removal reaches the cloud copy; the name is blanked. */
  deletedAt?: Timestamp;
}

export interface Reminders {
  periodSoon: { enabled: boolean; daysBefore: 1 | 2 | 3 };
  dailyCheckIn: { enabled: boolean; hour: number; minute: number };
  fertileWindow: { enabled: boolean };
  /**
   * On by default: lock-screen previews never mention periods, fertility or
   * symptoms — just "A gentle reminder from Bloom".
   */
  discreet: boolean;
}

/** Every optional data use is off until the person turns it on. */
export interface Consents {
  cloudBackup: boolean;
  aiAssistant: boolean;
  productAnalytics: boolean;
  updatedAt: Timestamp;
}

export interface Preferences {
  appearance: 'system' | 'light' | 'dark';
  weekStartsOn: 0 | 1;
  appLock: boolean;
  showFertility: boolean;
  /** Units for weight and temperature. Stored values are always metric. */
  units: 'metric' | 'imperial';
  /** Home screen widget: false shows numbers only ("Day 14 · 14 days to go"). */
  widgetDetailed: boolean;
}

export interface Profile {
  name?: string;
  birthYear?: number;
  goals: GoalKey[];
  onboardedAt?: Timestamp;
}

export interface AppData {
  schemaVersion: 1;
  profile: Profile;
  cycle: CycleSettings;
  periods: StoredPeriod[];
  days: Record<ISODate, DailyLog>;
  journal: JournalEntry[];
  medications: Medication[];
  reminders: Reminders;
  consents: Consents;
  preferences: Preferences;
  sync: SyncState;
}

/** Bookkeeping for the optional cloud backup. Never shown to the person. */
export interface SyncState {
  lastSyncedAt?: Timestamp;
  /** Days whose check-in was cleared, so the deletion reaches the cloud. */
  deletedDays?: Record<ISODate, Timestamp>;
  /** When each single-row record last changed, for last-write-wins. */
  stamps?: { profile?: Timestamp; cycle?: Timestamp; reminders?: Timestamp };
}
