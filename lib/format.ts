import { diffDays, toLocalDate, type ISODate } from '@/lib/cycle/dates';

/** Formats a calendar date in the device's language, e.g. "Tue 11 Nov". */
export function formatDate(iso: ISODate, style: 'short' | 'long' | 'weekday' | 'month' = 'short'): string {
  const options: Intl.DateTimeFormatOptions =
    style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long' }
      : style === 'weekday'
        ? { weekday: 'short', day: 'numeric', month: 'short' }
        : style === 'month'
          ? { month: 'long', year: 'numeric' }
          : { day: 'numeric', month: 'short' };
  try {
    return new Intl.DateTimeFormat(undefined, options).format(toLocalDate(iso));
  } catch {
    return iso;
  }
}

export function formatRange(start: ISODate, end: ISODate): string {
  return start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;
}

/** "Today", "Tomorrow", "Yesterday", "in 5 days", "3 days ago". */
export function relativeDay(target: ISODate, today: ISODate): string {
  const d = diffDays(today, target);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d === -1) return 'Yesterday';
  return d > 0 ? `in ${d} days` : `${-d} days ago`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Short weekday initials for calendar headers, in the device language. */
export function weekdayInitials(weekStartsOn: 0 | 1): { short: string; long: string }[] {
  // 2026-11-01 is a Sunday.
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(2026, 10, 1 + ((i + weekStartsOn) % 7));
    try {
      return {
        short: new Intl.DateTimeFormat(undefined, { weekday: 'narrow' }).format(date),
        long: new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(date),
      };
    } catch {
      const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const name = names[(i + weekStartsOn) % 7];
      return { short: name[0], long: name };
    }
  });
}

/** A time of day in the phone's own clock style (8 AM or 08:00). */
export function formatTime(hour: number, minute = 0): string {
  try {
    return new Date(2026, 0, 1, hour, minute).toLocaleTimeString([], { hour: 'numeric', minute: minute ? '2-digit' : undefined });
  } catch {
    return `${hour}:${String(minute).padStart(2, '0')}`;
  }
}
