import type { AppData, Preferences } from './types';

/** Regions where calendars conventionally start on Sunday. */
const SUNDAY_FIRST = new Set([
  'US',
  'CA',
  'MX',
  'BR',
  'JP',
  'KR',
  'TW',
  'HK',
  'IL',
  'PH',
  'IN',
  'ZA',
  'AR',
  'CO',
  'PE',
  'VE',
  'GT',
  'SV',
  'HN',
  'NI',
  'PA',
  'DO',
  'PR',
  'TH',
  'ID',
  'SG',
  'KE',
  'ET',
]);

export function defaultWeekStart(): Preferences['weekStartsOn'] {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const region = locale.split(/[-_]/).find((part, i) => i > 0 && /^[A-Z]{2}$/.test(part));
    return region && SUNDAY_FIRST.has(region) ? 0 : 1;
  } catch {
    return 1;
  }
}

/** The few regions that use pounds and Fahrenheit day to day. */
const IMPERIAL = new Set(['US', 'LR', 'MM']);

export function defaultUnits(): Preferences['units'] {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const region = locale.split(/[-_]/).find((part, i) => i > 0 && /^[A-Z]{2}$/.test(part));
    return region && IMPERIAL.has(region) ? 'imperial' : 'metric';
  } catch {
    return 'metric';
  }
}

export function createDefaultData(now: Date = new Date()): AppData {
  const stamp = now.toISOString();
  return {
    schemaVersion: 1,
    profile: { goals: [] },
    cycle: { typicalCycleLength: 28, typicalPeriodLength: 5 },
    periods: [],
    days: {},
    journal: [],
    medications: [],
    reminders: {
      periodSoon: { enabled: false, daysBefore: 2 },
      dailyCheckIn: { enabled: false, hour: 20, minute: 0 },
      fertileWindow: { enabled: false },
      discreet: true,
    },
    consents: { cloudBackup: false, aiAssistant: false, productAnalytics: false, updatedAt: stamp },
    preferences: {
      appearance: 'system',
      weekStartsOn: defaultWeekStart(),
      appLock: false,
      showFertility: true,
      units: defaultUnits(),
      widgetDetailed: false,
    },
    sync: {},
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Fills in anything missing from stored data — older versions, or a file
 * restored from an export — so the rest of the app can rely on the full shape.
 */
export function hydrate(raw: unknown): AppData {
  const base = createDefaultData();
  if (!isObject(raw)) return base;
  const r = raw as Partial<AppData>;
  return {
    schemaVersion: 1,
    profile: { ...base.profile, ...(isObject(r.profile) ? r.profile : {}) },
    cycle: { ...base.cycle, ...(isObject(r.cycle) ? r.cycle : {}) },
    periods: Array.isArray(r.periods) ? r.periods : [],
    days: isObject(r.days) ? (r.days as AppData['days']) : {},
    journal: Array.isArray(r.journal) ? r.journal : [],
    medications: Array.isArray(r.medications) ? r.medications : [],
    reminders: {
      ...base.reminders,
      ...(isObject(r.reminders) ? r.reminders : {}),
      periodSoon: { ...base.reminders.periodSoon, ...(isObject(r.reminders?.periodSoon) ? r.reminders.periodSoon : {}) },
      dailyCheckIn: { ...base.reminders.dailyCheckIn, ...(isObject(r.reminders?.dailyCheckIn) ? r.reminders.dailyCheckIn : {}) },
      fertileWindow: { ...base.reminders.fertileWindow, ...(isObject(r.reminders?.fertileWindow) ? r.reminders.fertileWindow : {}) },
    },
    consents: { ...base.consents, ...(isObject(r.consents) ? r.consents : {}) },
    preferences: { ...base.preferences, ...(isObject(r.preferences) ? r.preferences : {}) },
    sync: isObject(r.sync) ? r.sync : {},
  };
}
