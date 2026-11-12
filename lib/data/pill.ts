/**
 * Contraceptive pill packs: which pill is today's, when the break or
 * inactive pills come, and which active pills in the current pack weren't
 * ticked. A pack is attached to a medication of kind "pill"; taking a pill is
 * the same tick as any medication. Pure: dates in, facts out.
 */
import { addDays, diffDays, type ISODate } from '../cycle/dates.ts';

export type PackType = 'combined_21_7' | 'combined_21_7i' | 'combined_24_4' | 'continuous' | 'pop';
export type PillFamily = 'combined' | 'pop';

export interface PackSpec {
  type: PackType;
  label: string;
  detail: string;
  family: PillFamily;
  /** Active (hormone) pills per pack. */
  active: number;
  /** Days per pack, including the break or inactive pills. */
  length: number;
  /** What happens after the active pills: no pills, or inactive (sugar) pills. */
  gap: 'break' | 'inactive' | null;
}

export const PACK_TYPES: PackSpec[] = [
  {
    type: 'combined_21_7',
    label: '21 pills + 7-day break',
    detail: 'Combined pill with a week off',
    family: 'combined',
    active: 21,
    length: 28,
    gap: 'break',
  },
  {
    type: 'combined_21_7i',
    label: '21 + 7 inactive',
    detail: 'Combined pill, every day (ED)',
    family: 'combined',
    active: 21,
    length: 28,
    gap: 'inactive',
  },
  {
    type: 'combined_24_4',
    label: '24 + 4 inactive',
    detail: 'Combined pill, every day',
    family: 'combined',
    active: 24,
    length: 28,
    gap: 'inactive',
  },
  {
    type: 'continuous',
    label: 'No break',
    detail: 'Combined pill taken back to back',
    family: 'combined',
    active: 28,
    length: 28,
    gap: null,
  },
  { type: 'pop', label: 'Mini pill', detail: 'Progestogen-only, every day', family: 'pop', active: 28, length: 28, gap: null },
];

export const packSpec = (type: string): PackSpec => PACK_TYPES.find((p) => p.type === type) ?? PACK_TYPES[0];

export interface PillPack {
  type: PackType;
  /** The day the person took pill 1 of a pack (any pack — later packs follow on). */
  startDate: ISODate;
  /** When the pack was set up in Bloom; pills before this are never "missed". */
  setOn?: ISODate;
}

export interface PackDay {
  /** 0 for the pack containing startDate, then 1, 2… */
  packIndex: number;
  /** 1-based position in the pack. */
  day: number;
  /** First day of this pack. */
  packStart: ISODate;
  kind: 'active' | 'inactive' | 'break';
  /** Whether a pill (active or inactive) is taken today. */
  takesPill: boolean;
  /** Days until the break or inactive pills start; null if none ahead in this pack. */
  gapIn: number | null;
  /** Days until the next pack's first pill. */
  nextPackIn: number;
}

export function packDay(pack: PillPack, date: ISODate): PackDay | null {
  const spec = packSpec(pack.type);
  const offset = diffDays(pack.startDate, date);
  if (offset < 0) return null;
  const packIndex = Math.floor(offset / spec.length);
  const day = (offset % spec.length) + 1;
  const kind = day <= spec.active ? 'active' : spec.gap === 'break' ? 'break' : 'inactive';
  return {
    packIndex,
    day,
    packStart: addDays(pack.startDate, packIndex * spec.length),
    kind,
    takesPill: kind !== 'break',
    gapIn: spec.gap && day <= spec.active ? spec.active - day + 1 : null,
    nextPackIn: spec.length - day + 1,
  };
}

/** Start date that makes `pillNumber` today's pill. */
export function startForPillNumber(today: ISODate, pillNumber: number): ISODate {
  return addDays(today, -(pillNumber - 1));
}

export type DaysWithTicks = Record<ISODate, { medsTaken?: readonly string[] } | undefined>;

/**
 * Active pills in the current pack (before today) that weren't ticked, oldest
 * first. Only counts from when the pack was set up, so a newly added pack
 * doesn't look like a run of missed pills.
 */
export function missedPills(pack: PillPack, medId: string, days: DaysWithTicks, today: ISODate, trackedFrom: ISODate): ISODate[] {
  const now = packDay(pack, today);
  if (!now) return [];
  const out: ISODate[] = [];
  for (let d = now.packStart; d < today; d = addDays(d, 1)) {
    if (d < trackedFrom) continue;
    const info = packDay(pack, d);
    if (info?.kind === 'active' && !days[d]?.medsTaken?.includes(medId)) out.push(d);
  }
  return out;
}

export interface PillDose {
  date: ISODate;
  kind: 'pill' | 'new-pack-tomorrow';
}

/**
 * Reminder dates for the next `horizon` days: every day a pill is taken, plus
 * a heads-up on the last day of a pill-free break.
 */
export function pillSchedule(pack: PillPack, from: ISODate, horizon = 14): PillDose[] {
  const out: PillDose[] = [];
  for (let i = 0; i < horizon; i++) {
    const date = addDays(from, i);
    const info = packDay(pack, date);
    if (!info) continue;
    if (info.takesPill) out.push({ date, kind: 'pill' });
    else if (info.nextPackIn === 1) out.push({ date, kind: 'new-pack-tomorrow' });
  }
  return out;
}
