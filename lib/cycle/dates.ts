/**
 * Calendar-date arithmetic for cycle tracking.
 *
 * A period starts on a *calendar day*, not at an instant. Storing and comparing
 * `Date` objects invites the classic bugs: a log made at 23:30 lands on the
 * next day after a time-zone change, and a daylight-saving week is 167 hours
 * long, so "7 days later" drifts. Everything here works on plain `YYYY-MM-DD`
 * strings converted to whole day numbers through UTC, where every day is
 * exactly 86 400 000 ms, so arithmetic never depends on the device's zone.
 *
 * The only place the device's zone matters is deciding what *today* is, which
 * `todayISO` reads from local time on purpose.
 */

export type ISODate = string;

const MS_PER_DAY = 86_400_000;
const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string') return false;
  const m = ISO_PATTERN.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

export function parseISO(iso: ISODate): { year: number; month: number; day: number } {
  const m = ISO_PATTERN.exec(iso);
  if (!m) throw new Error(`Not a calendar date: ${iso}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/** Days since 1970-01-01. */
export function toDayNumber(iso: ISODate): number {
  const { year, month, day } = parseISO(iso);
  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

export function fromDayNumber(n: number): ISODate {
  const d = new Date(n * MS_PER_DAY);
  return formatParts(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function formatParts(year: number, month: number, day: number): ISODate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addDays(iso: ISODate, days: number): ISODate {
  return fromDayNumber(toDayNumber(iso) + days);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: ISODate, to: ISODate): number {
  return toDayNumber(to) - toDayNumber(from);
}

export function compareISO(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minISO(a: ISODate, b: ISODate): ISODate {
  return a <= b ? a : b;
}

export function maxISO(a: ISODate, b: ISODate): ISODate {
  return a >= b ? a : b;
}

/** Inclusive on both ends. */
export function isWithin(date: ISODate, start: ISODate, end: ISODate): boolean {
  return date >= start && date <= end;
}

export function eachDay(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let n = toDayNumber(start), last = toDayNumber(end); n <= last; n++) out.push(fromDayNumber(n));
  return out;
}

/** The device's local calendar date. */
export function todayISO(now: Date = new Date()): ISODate {
  return toLocalISO(now);
}

export function toLocalISO(date: Date): ISODate {
  return formatParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** A local-midnight Date for display with Intl formatters. */
export function toLocalDate(iso: ISODate): Date {
  const { year, month, day } = parseISO(iso);
  return new Date(year, month - 1, day);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(iso: ISODate): number {
  return new Date(toDayNumber(iso) * MS_PER_DAY).getUTCDay();
}

export type MonthKey = string; // YYYY-MM

export function monthOf(iso: ISODate): MonthKey {
  return iso.slice(0, 7);
}

export function addMonths(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split('-').map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export function firstOfMonth(month: MonthKey): ISODate {
  return `${month}-01`;
}

/**
 * The dates shown in a month grid: whole weeks covering the month, starting on
 * `weekStartsOn` (0 = Sunday, 1 = Monday). Days outside the month are null.
 */
export function monthGrid(month: MonthKey, weekStartsOn: 0 | 1): (ISODate | null)[][] {
  const [y, m] = month.split('-').map(Number);
  const first = firstOfMonth(month);
  const lead = (weekday(first) - weekStartsOn + 7) % 7;
  const total = daysInMonth(y, m);
  const cells: (ISODate | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= total; d++) cells.push(formatParts(y, m, d));
  while (cells.length % 7) cells.push(null);
  const weeks: (ISODate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
