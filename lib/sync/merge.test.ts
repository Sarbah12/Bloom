import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AppData, DailyLog } from '../data/types.ts';
import { mergeSnapshot, type RemoteSnapshot } from './merge.ts';

const T1 = '2026-11-01T10:00:00.000Z';
const T2 = '2026-11-02T10:00:00.000Z';
const T3 = '2026-11-03T10:00:00.000Z';
const NOW = '2026-11-11T10:00:00.000Z';

function local(patch: Partial<AppData> = {}): AppData {
  return {
    schemaVersion: 1,
    profile: { goals: ['track_periods'], onboardedAt: T1 },
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
    consents: { cloudBackup: true, aiAssistant: false, productAnalytics: false, updatedAt: T1 },
    preferences: { appearance: 'system', weekStartsOn: 1, appLock: true, showFertility: true, units: 'metric' },
    sync: { stamps: { profile: T1, cycle: T1, reminders: T1 } },
    ...patch,
  };
}

const empty: RemoteSnapshot = { periods: [], days: [], deletedDays: {}, journal: [] };
const day = (date: string, at: string, symptoms: DailyLog['symptoms'] = ['cramps']): DailyLog => ({
  date,
  symptoms,
  moods: [],
  updatedAt: at,
});

describe('merging with the cloud backup', () => {
  it('merges medications by newest change, keeping removals', () => {
    const med = (id: string, at: string, extra = {}) => ({
      id,
      name: id,
      kind: 'iron' as const,
      reminder: { enabled: false, hour: 8, minute: 0 },
      createdAt: T1,
      updatedAt: at,
      ...extra,
    });
    const l = local({ medications: [med('a', T3, { name: 'Iron 2' }), med('b', T1)] });
    const remote: RemoteSnapshot = { ...empty, medications: [med('a', T2), med('b', T2, { name: '', deletedAt: T2 }), med('c', T2)] };
    const { data, push } = mergeSnapshot(l, remote, NOW);
    const byId = Object.fromEntries(data.medications.map((m) => [m.id, m]));
    assert.equal(byId.a.name, 'Iron 2');
    assert.equal(byId.b.deletedAt, T2);
    assert.ok(byId.c);
    assert.deepEqual(
      push.medications.map((m) => m.id),
      ['a'],
    );
  });

  it('uploads everything on the first backup', () => {
    const l = local({
      periods: [{ id: 'p1', startDate: '2026-10-01', endDate: '2026-10-05', updatedAt: T1 }],
      days: { '2026-10-01': day('2026-10-01', T1) },
    });
    const { push, data } = mergeSnapshot(l, empty, NOW);
    assert.equal(push.periods.length, 1);
    assert.equal(push.days.length, 1);
    assert.ok(push.profile && push.cycle && push.reminders);
    assert.equal(data.sync.lastSyncedAt, NOW);
  });

  it('restores everything onto a fresh phone', () => {
    const fresh = local({ profile: { goals: [] }, sync: {} });
    const remote: RemoteSnapshot = {
      ...empty,
      periods: [{ id: 'p1', startDate: '2026-10-01', endDate: null, updatedAt: T2 }],
      days: [day('2026-10-02', T2)],
      cycle: { value: { typicalCycleLength: 31, typicalPeriodLength: 6 }, updatedAt: T2 },
      profile: {
        value: { goals: ['conceive'], name: 'Ama', onboardedAt: T1, appearance: 'dark', weekStartsOn: 0, showFertility: true },
        updatedAt: T2,
      },
    };
    const { data, push } = mergeSnapshot(fresh, remote, NOW);
    assert.equal(data.periods[0].id, 'p1');
    assert.equal(data.days['2026-10-02'].symptoms[0], 'cramps');
    assert.equal(data.cycle.typicalCycleLength, 31);
    assert.equal(data.profile.name, 'Ama');
    assert.equal(data.preferences.appearance, 'dark');
    assert.equal(data.preferences.appLock, true, 'app lock is per device and never synced');
    assert.equal(push.periods.length, 0);
    assert.equal(push.cycle, null);
  });

  it('keeps whichever edit is newer', () => {
    const l = local({ periods: [{ id: 'p1', startDate: '2026-10-01', endDate: '2026-10-04', updatedAt: T3 }] });
    const remote = { ...empty, periods: [{ id: 'p1', startDate: '2026-10-01', endDate: '2026-10-06', updatedAt: T2 }] };
    const a = mergeSnapshot(l, remote, NOW);
    assert.equal(a.data.periods[0].endDate, '2026-10-04');
    assert.equal(a.push.periods.length, 1);

    const older = local({ periods: [{ id: 'p1', startDate: '2026-10-01', endDate: '2026-10-04', updatedAt: T1 }] });
    const b = mergeSnapshot(older, remote, NOW);
    assert.equal(b.data.periods[0].endDate, '2026-10-06');
    assert.equal(b.push.periods.length, 0);
  });

  it('compares Postgres-style timestamps by instant, not text', () => {
    const l = local({ periods: [{ id: 'p1', startDate: '2026-10-01', endDate: null, updatedAt: '2026-11-02T10:00:00.500Z' }] });
    const remote = {
      ...empty,
      periods: [{ id: 'p1', startDate: '2026-10-02', endDate: null, updatedAt: '2026-11-02T10:00:00.900123+00:00' }],
    };
    assert.equal(mergeSnapshot(l, remote, NOW).data.periods[0].startDate, '2026-10-02');
  });

  it('carries deletions both ways', () => {
    const removedHere = local({ periods: [{ id: 'p1', startDate: '2026-10-01', endDate: null, updatedAt: T3, deletedAt: T3 }] });
    const remote = { ...empty, periods: [{ id: 'p1', startDate: '2026-10-01', endDate: null, updatedAt: T2 }] };
    const a = mergeSnapshot(removedHere, remote, NOW);
    assert.equal(a.push.periods[0].deletedAt, T3);

    const clearedDay = local({ sync: { deletedDays: { '2026-10-02': T3 } } });
    const b = mergeSnapshot(clearedDay, { ...empty, days: [day('2026-10-02', T2)] }, NOW);
    assert.equal(b.data.days['2026-10-02'], undefined);
    assert.deepEqual(b.push.deletedDays, [{ date: '2026-10-02', deletedAt: T3 }]);

    const clearedThere = local({ days: { '2026-10-02': day('2026-10-02', T1) } });
    const c = mergeSnapshot(clearedThere, { ...empty, deletedDays: { '2026-10-02': T2 } }, NOW);
    assert.equal(c.data.days['2026-10-02'], undefined);
    assert.equal(c.push.days.length, 0);
  });

  it('lets a re-logged day beat an older deletion', () => {
    const relogged = local({ days: { '2026-10-02': day('2026-10-02', T3, ['headache']) } });
    const r = mergeSnapshot(relogged, { ...empty, deletedDays: { '2026-10-02': T2 } }, NOW);
    assert.equal(r.data.days['2026-10-02'].symptoms[0], 'headache');
    assert.equal(r.push.days.length, 1);
  });
});
