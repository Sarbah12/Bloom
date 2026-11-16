import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import type { ISODate } from '@/lib/cycle/dates';
import type { AppData } from '@/lib/data/types';
import { healthAvailable, syncHealth, type SyncResult } from '@/modules/bloom-health';

import { healthSamples } from './plan';

/** What the last sync did, for the Apple Health screen. Kept in memory only. */
export interface HealthSyncState {
  running: boolean;
  lastAt?: number;
  lastResult?: SyncResult;
  error?: string;
}

let state: HealthSyncState = { running: false };
const listeners = new Set<() => void>();
function set(patch: Partial<HealthSyncState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function useHealthSyncState(): HealthSyncState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

let lastSent = '';
let queue: Promise<unknown> = Promise.resolve();

/**
 * Makes Apple Health match Bloom now. Runs one at a time; `force` re-sends
 * even when nothing changed since the last sync (e.g. after access changes).
 */
export function syncHealthNow(data: AppData, today: ISODate, force = false): Promise<SyncResult | null> {
  const samples = healthSamples(data, today);
  const key = JSON.stringify(samples);
  if (!force && key === lastSent) return Promise.resolve(null);
  lastSent = key;
  const run = queue.then(async () => {
    set({ running: true });
    try {
      const result = await syncHealth(samples);
      set({ running: false, lastAt: Date.now(), lastResult: result, error: undefined });
      return result;
    } catch (e) {
      lastSent = ''; // try again next time
      set({ running: false, error: e instanceof Error ? e.message : String(e) });
      return null;
    }
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Removes everything Bloom wrote to Apple Health. */
export async function removeFromHealth(): Promise<SyncResult> {
  lastSent = '';
  const result = await syncHealth([]);
  set({ lastAt: undefined, lastResult: undefined, error: undefined });
  return result;
}

/**
 * Keeps Apple Health up to date while it's turned on: a few seconds after
 * the log changes, and when the app goes to the background.
 */
export function useHealthSync(data: AppData, today: ISODate, ready: boolean) {
  const enabled = ready && data.preferences.appleHealth && healthAvailable();
  const latest = useRef({ data, today });
  latest.current = { data, today };

  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => syncHealthNow(latest.current.data, latest.current.today), 3000);
    return () => clearTimeout(t);
  }, [enabled, data.periods, data.days, data.cycle.typicalPeriodLength, today]);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') syncHealthNow(latest.current.data, latest.current.today);
    });
    return () => sub.remove();
  }, [enabled]);
}
