import { useCallback } from 'react';

import { formatDate } from '@/lib/format';
import { pickBackupFile } from '@/lib/import-file';
import { confirm, notify } from '@/lib/platform';

import { parseBackup } from './backup';
import { useData } from './store';

/**
 * Pick a backup → check it → confirm → replace. Resolves true when data was
 * restored. Nothing on the phone changes until the person confirms.
 */
export function useRestore() {
  const { data, actions } = useData();

  return useCallback(async (): Promise<boolean> => {
    let raw: string | null;
    try {
      raw = await pickBackupFile();
    } catch {
      notify('Couldn’t open the file', 'Try saving it to Files first, then choose it again.');
      return false;
    }
    if (raw === null) return false;

    const parsed = parseBackup(raw);
    if (!parsed.ok) {
      notify('That file can’t be restored', parsed.reason);
      return false;
    }

    const { periods, days, journal, medications } = parsed.counts;
    const when = parsed.exportedAt ? ` from ${formatDate(parsed.exportedAt.slice(0, 10), 'long')}` : '';
    const hasData = data.periods.some((p) => !p.deletedAt) || Object.keys(data.days).length > 0;
    const ok = await confirm(
      'Restore this backup?',
      `The backup${when} has ${periods} period${periods === 1 ? '' : 's'}, ${days} check-in${days === 1 ? '' : 's'}, ${journal} journal entr${journal === 1 ? 'y' : 'ies'}${medications ? ` and ${medications} medication${medications === 1 ? '' : 's'}` : ''}.${hasData ? ' It will replace everything currently on this phone.' : ''}`,
      'Restore',
      hasData,
    );
    if (!ok) return false;

    // App Lock is a choice about this phone, not part of someone's records.
    actions.replaceAll({ ...parsed.data, preferences: { ...parsed.data.preferences, appLock: data.preferences.appLock } });
    return true;
  }, [actions, data]);
}
