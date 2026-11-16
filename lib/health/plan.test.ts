import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AppData, DailyLog } from '../data/types.ts';

import { healthSamples, periodDays, planImport } from './plan.ts';

const TODAY = '2026-11-16';
const T = '2026-11-16T10:00:00.000Z';

function data(patch: Partial<AppData> = {}): AppData {
  return {
    cycle: { typicalCycleLength: 28, typicalPeriodLength: 5 },
    periods: [],
    days: {},
    ...patch,
  } as AppData;
}

function day(date: string, patch: Partial<DailyLog> = {}): DailyLog {
  return { date, symptoms: [], moods: [], updatedAt: T, ...patch };
}

describe('periodDays', () => {
  it('covers logged periods and stops an ongoing one at today', () => {
    const days = periodDays(
      [
        { id: 'a', startDate: '2026-10-01', endDate: '2026-10-03' },
        { id: 'b', startDate: '2026-11-15', endDate: null },
      ],
      5,
      TODAY,
    );
    assert.deepEqual([...days.keys()], ['2026-10-01', '2026-10-02', '2026-10-03', '2026-11-15', '2026-11-16']);
    assert.equal(days.get('2026-10-01')?.start, true);
    assert.equal(days.get('2026-10-02')?.start, false);
  });
});

describe('healthSamples', () => {
  it('writes each period day with its flow and marks the first day', () => {
    const s = healthSamples(
      data({
        periods: [{ id: 'a', startDate: '2026-10-01', endDate: '2026-10-02', updatedAt: T }],
        days: { '2026-10-01': day('2026-10-01', { flow: 'heavy' }) },
      }),
      TODAY,
    );
    assert.deepEqual(
      s.map((x) => [x.date, x.value, x.cycleStart]),
      [
        ['2026-10-01', 4, true],
        ['2026-10-02', 1, false],
      ],
    );
  });

  it('skips deleted periods', () => {
    const s = healthSamples(
      data({ periods: [{ id: 'a', startDate: '2026-10-01', endDate: '2026-10-02', updatedAt: T, deletedAt: T }] }),
      TODAY,
    );
    assert.equal(s.length, 0);
  });

  it('writes spotting outside a period as spotting, symptoms with severity, and body measurements', () => {
    const s = healthSamples(
      data({
        days: {
          '2026-11-02': day('2026-11-02', {
            flow: 'spotting',
            symptoms: ['cramps', 'joint_pain', 'cravings'],
            moods: ['mood_swings', 'calm'],
            pain: 3,
            weightKg: 61.5,
            temperatureC: 36.7,
            water: 6,
          }),
        },
      }),
      TODAY,
    );
    const byType = Object.fromEntries(s.map((x) => [x.type.replace(/^HK(Category|Quantity)TypeIdentifier/, ''), x]));
    assert.deepEqual(Object.keys(byType).sort(), [
      'AbdominalCramps',
      'AppetiteChanges',
      'BodyMass',
      'BodyTemperature',
      'DietaryWater',
      'IntermenstrualBleeding',
      'MoodChanges',
    ]);
    assert.equal(byType.AbdominalCramps.value, 4);
    assert.equal(byType.AppetiteChanges.value, 3);
    assert.equal(byType.DietaryWater.amount, 1500);
    assert.equal(byType.BodyMass.unit, 'kg');
  });

  it('gives a changed value a new key, so Health gets the new one', () => {
    const before = healthSamples(data({ days: { '2026-11-02': day('2026-11-02', { weightKg: 60 }) } }), TODAY);
    const after = healthSamples(data({ days: { '2026-11-02': day('2026-11-02', { weightKg: 61 }) } }), TODAY);
    assert.notEqual(before[0].key, after[0].key);
  });

  it('never writes future days', () => {
    const s = healthSamples(data({ days: { '2026-12-01': day('2026-12-01', { symptoms: ['acne'] }) } }), TODAY);
    assert.equal(s.length, 0);
  });
});

describe('planImport', () => {
  let n = 0;
  const id = () => `new${n++}`;

  it('adds runs of days Bloom lacks and fills in their flow', () => {
    const r = planImport(
      [{ id: 'a', startDate: '2026-10-01', endDate: '2026-10-04' }],
      [
        { date: '2026-09-03', value: 3 },
        { date: '2026-09-04', value: 2 },
        { date: '2026-09-04', value: 4 },
        { date: '2026-09-05', value: 1 },
        { date: '2026-10-02', value: 3 },
        { date: '2026-12-01', value: 3 },
        { date: '2026-08-01', value: 5 },
      ],
      { days: {} },
      5,
      TODAY,
      id,
    );
    assert.equal(r.addedDays, 3);
    assert.deepEqual(
      r.periods.map((p) => [p.startDate, p.endDate]),
      [
        ['2026-09-03', '2026-09-05'],
        ['2026-10-01', '2026-10-04'],
      ],
    );
    assert.deepEqual(r.flows, { '2026-09-03': 'medium', '2026-09-04': 'heavy', '2026-10-02': 'medium' });
  });

  it('extends a period it touches instead of making a new one, and keeps logged flow', () => {
    const r = planImport(
      [{ id: 'a', startDate: '2026-10-01', endDate: '2026-10-03' }],
      [{ date: '2026-10-04', value: 2 }, { date: '2026-10-02', value: 4 }],
      { days: { '2026-10-02': day('2026-10-02', { flow: 'light' }) } },
      5,
      TODAY,
      id,
    );
    assert.deepEqual(
      r.periods.map((p) => [p.id, p.startDate, p.endDate]),
      [['a', '2026-10-01', '2026-10-04']],
    );
    assert.deepEqual(r.flows, { '2026-10-04': 'light' });
  });

  it('changes nothing when Health has nothing new', () => {
    const existing = [{ id: 'a', startDate: '2026-10-01', endDate: '2026-10-03' }];
    const r = planImport(existing, [{ date: '2026-10-02', value: 1 }], { days: {} }, 5, TODAY, id);
    assert.equal(r.addedDays, 0);
    assert.equal(r.periods, existing);
  });
});
