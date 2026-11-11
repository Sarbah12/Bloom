import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { todayISO } from '@/lib/cycle/dates';
import { useData } from '@/lib/data/store';

import { describeAuthError, useSession } from './auth';
import { cloudConfigured } from './client';
import { syncNow } from './sync';

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'error';

/** Backs up only when the person is signed in AND has turned backup on. */
export function useCloudSync() {
  const { data, actions } = useData();
  const { session, loading } = useSession();
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(data);
  latest.current = data;
  const running = useRef(false);

  const enabled = cloudConfigured && !!session && data.consents.cloudBackup;

  const run = useCallback(async () => {
    if (!session || !latest.current.consents.cloudBackup || running.current) return;
    running.current = true;
    setStatus('syncing');
    setError(null);
    try {
      const merged = await syncNow(latest.current, session.user.id, todayISO());
      actions.applyCloudMerge(merged);
      setStatus('idle');
    } catch (e) {
      setError(describeAuthError(e));
      setStatus('error');
    } finally {
      running.current = false;
    }
  }, [session, actions]);

  return { enabled, status: enabled ? status : 'off', error, run, session, loading, lastSyncedAt: data.sync.lastSyncedAt };
}

const AUTO_SYNC_EVERY_MS = 5 * 60_000;

/** Mounted once at the root: syncs on sign-in and when the app returns to the foreground. */
export function CloudAutoSync() {
  const { enabled, run, lastSyncedAt } = useCloudSync();
  const last = useRef(lastSyncedAt);
  last.current = lastSyncedAt;

  useEffect(() => {
    if (!enabled) return;
    run();
    const sub = AppState.addEventListener('change', (s) => {
      const age = last.current ? Date.now() - Date.parse(last.current) : Infinity;
      if (s === 'active' && age > AUTO_SYNC_EVERY_MS) run();
    });
    return () => sub.remove();
  }, [enabled, run]);

  return null;
}
