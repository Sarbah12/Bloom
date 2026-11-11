import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseBackup } from './backup.ts';

const NOW = '2026-11-11T10:00:00.000Z';

function exportFile(patch: Record<string, unknown> = {}) {
  return JSON.stringify({
    exportedAt: '2026-11-01T09:00:00.000Z',
    app: 'Bloom',
    format: 'bloom-export',
    version: 1,
    schemaVersion: 1,
    profile: { name: 'Ama', goals: ['track_periods'], onboardedAt: '2026-10-01T09:00:00.000Z' },
    cycle: { typicalCycleLength: 30, typicalPeriodLength: 6 },
    periods: [{ id: 'p1', startDate: '2026-10-18', endDate: '2026-10-22', updatedAt: '2026-10-22T08:00:00.000Z' }],
    days: {
      '2026-10-18': {
        date: '2026-10-18',
        flow: 'heavy',
        symptoms: ['cramps'],
        moods: ['calm'],
        energy: 2,
        note: 'Rest day',
        updatedAt: NOW,
      },
    },
    journal: [{ id: 'j1', date: '2026-10-18', title: 'Hello', body: 'First entry', createdAt: NOW, updatedAt: NOW }],
    reminders: {
      periodSoon: { enabled: true, daysBefore: 2 },
      dailyCheckIn: { enabled: false, hour: 20, minute: 0 },
      fertileWindow: { enabled: false },
      discreet: true,
    },
    consents: { cloudBackup: false, aiAssistant: false, productAnalytics: false, updatedAt: NOW },
    preferences: { appearance: 'dark', weekStartsOn: 0, appLock: true, showFertility: false },
    sync: { lastSyncedAt: NOW },
    ...patch,
  });
}

describe('restoring a backup', () => {
  it('restores everything from an export', () => {
    const r = parseBackup(exportFile(), NOW);
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.data.profile.name, 'Ama');
    assert.equal(r.data.cycle.typicalCycleLength, 30);
    assert.equal(r.data.periods[0].endDate, '2026-10-22');
    assert.deepEqual(r.data.days['2026-10-18'].symptoms, ['cramps']);
    assert.equal(r.data.journal[0].body, 'First entry');
    assert.equal(r.data.preferences.appearance, 'dark');
    assert.deepEqual(r.counts, { periods: 1, days: 1, journal: 1, medications: 0 });
    assert.deepEqual(r.data.sync, {}, 'cloud bookkeeping is not carried over');
  });

  it('refuses files that are not Bloom backups', () => {
    assert.equal(parseBackup('not json').ok, false);
    assert.equal(parseBackup('{"hello":1}').ok, false);
    assert.equal(parseBackup(exportFile({ format: 'other-app' })).ok, false);
    const newer = parseBackup(exportFile({ version: 2 }));
    assert.ok(!newer.ok && /newer version/.test(newer.reason));
  });

  it('drops malformed records instead of failing the restore', () => {
    const r = parseBackup(
      exportFile({
        periods: [
          { id: 'ok', startDate: '2026-09-20', endDate: null },
          { id: 'bad-date', startDate: '2026-02-30', endDate: null },
          { id: 'backwards', startDate: '2026-09-10', endDate: '2026-09-01' },
          { id: 'ok', startDate: '2026-08-01', endDate: null },
          'nonsense',
        ],
        days: {
          '2026-10-01': { flow: 'gushing', symptoms: ['cramps', 'made_up', 7], moods: [], energy: 9 },
          'not-a-date': { symptoms: ['cramps'] },
          '2026-10-02': { symptoms: [], moods: [] },
        },
        journal: [{ id: 'j', date: 'yesterday', title: 'x', body: 'y' }],
      }),
      NOW,
    );
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.deepEqual(
      r.data.periods.map((p) => p.id),
      ['ok'],
    );
    assert.deepEqual(Object.keys(r.data.days), ['2026-10-01']);
    assert.equal(r.data.days['2026-10-01'].flow, undefined);
    assert.deepEqual(r.data.days['2026-10-01'].symptoms, ['cramps']);
    assert.equal(r.data.days['2026-10-01'].energy, undefined);
    assert.equal(r.data.journal.length, 0);
  });

  it('keeps cramp strength and relief only on days with cramps', () => {
    const r = parseBackup(
      exportFile({
        days: {
          '2026-10-18': {
            date: '2026-10-18',
            symptoms: ['cramps'],
            moods: [],
            pain: 3,
            relief: ['heat', 'heat', 'rest', 'not_a_relief', 7],
            updatedAt: NOW,
          },
          '2026-10-19': { date: '2026-10-19', symptoms: ['cramps'], moods: [], pain: 9, relief: 'heat', updatedAt: NOW },
          '2026-10-20': { date: '2026-10-20', symptoms: ['bloating'], moods: [], pain: 2, relief: ['heat'], updatedAt: NOW },
        },
      }),
      NOW,
    );
    assert.ok(r.ok);
    assert.equal(r.data.days['2026-10-18'].pain, 3);
    assert.deepEqual(r.data.days['2026-10-18'].relief, ['heat', 'rest']);
    assert.equal(r.data.days['2026-10-19'].pain, undefined);
    assert.equal(r.data.days['2026-10-19'].relief, undefined);
    assert.equal(r.data.days['2026-10-20'].pain, undefined);
    assert.equal(r.data.days['2026-10-20'].relief, undefined);
  });

  it('restores lifestyle fields and medications, dropping bad values', () => {
    const r = parseBackup(
      exportFile({
        days: {
          '2026-10-18': {
            date: '2026-10-18',
            symptoms: [],
            moods: [],
            sleepHours: 7.5,
            water: 6,
            exercise: 'light',
            weightKg: 64.25,
            temperatureC: 36.62,
            medsTaken: ['m1', 'm1'],
            updatedAt: NOW,
          },
          '2026-10-19': {
            date: '2026-10-19',
            symptoms: [],
            moods: [],
            sleepHours: 40,
            water: -1,
            exercise: 'marathon',
            weightKg: 'heavy',
            temperatureC: 50,
            updatedAt: NOW,
          },
        },
        medications: [
          {
            id: 'm1',
            name: '  Iron ',
            kind: 'iron',
            dose: '14 mg',
            reminder: { enabled: true, hour: 8, minute: 30 },
            createdAt: NOW,
            updatedAt: NOW,
          },
          { id: 'm2', name: '', kind: 'iron' },
          { id: 'm3', name: 'Mystery', kind: 'potion', reminder: { enabled: true, hour: 99 } },
        ],
      }),
      NOW,
    );
    assert.ok(r.ok);
    const d = r.data.days['2026-10-18'];
    assert.deepEqual([d.sleepHours, d.water, d.exercise, d.weightKg, d.temperatureC, d.medsTaken], [7.5, 6, 'light', 64.3, 36.62, ['m1']]);
    assert.equal(r.data.days['2026-10-19'], undefined);
    assert.equal(r.counts.medications, 2);
    assert.deepEqual(r.data.medications[0], {
      id: 'm1',
      name: 'Iron',
      kind: 'iron',
      dose: '14 mg',
      reminder: { enabled: true, hour: 8, minute: 30 },
      createdAt: NOW,
      updatedAt: NOW,
    });
    assert.equal(r.data.medications[1].kind, 'other');
    assert.equal(r.data.medications[1].reminder.enabled, false);
  });

  it('marks a restored app as set up', () => {
    const r = parseBackup(exportFile({ profile: { goals: [] } }), NOW);
    assert.ok(r.ok && r.data.profile.onboardedAt === NOW);
  });
});
