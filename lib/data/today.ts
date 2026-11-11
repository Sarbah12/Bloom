import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { todayISO, type ISODate } from '@/lib/cycle/dates';

/**
 * Today's local calendar date, kept current: it re-reads the clock when the
 * app comes back to the foreground and just after midnight, so "cycle day 24"
 * never goes stale on a phone left open overnight.
 */
export function useToday(): ISODate {
  const [today, setToday] = useState(() => todayISO());

  useEffect(() => {
    const refresh = () =>
      setToday((prev) => {
        const now = todayISO();
        return now === prev ? prev : now;
      });
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());

    let timer: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
      timer = setTimeout(() => {
        refresh();
        scheduleMidnight();
      }, next.getTime() - now.getTime());
    };
    scheduleMidnight();

    return () => {
      sub.remove();
      clearTimeout(timer);
    };
  }, []);

  return today;
}
