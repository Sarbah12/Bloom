import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { addDays } from './dates.ts';
import { analyzeCycles, type PeriodRecord } from './engine.ts';
import { lifestyleByWindow, lifestyleNotes, windowOf } from './lifestyle.ts';
import { byCycleDay, byMonth, cycleDayOf, peakDays, topTrendKeys, type TrendEntry } from './trends.ts';

const settings = { typicalCycleLength: 28, typicalPeriodLength: 5 };
const starts = ['2026-07-01', '2026-07-29', '2026-08-26', '2026-09-23', '2026-10-21'];
const records: PeriodRecord[] = starts.map((s, i) => ({ id: `p${i}`, startDate: s, endDate: addDays(s, 4) }));
const today = '2026-11-11';
const a = analyzeCycles(records, settings, today);

describe('symptom trends', () => {
  const entries: TrendEntry[] = starts.flatMap((s) => [
    { date: s, symptoms: ['cramps'], moods: ['low'] },
    { date: addDays(s, 1), symptoms: ['cramps', 'fatigue'] },
    { date: addDays(s, 14), symptoms: ['headache'] },
    { date: addDays(s, 24), symptoms: ['bloating'], moods: ['anxious'] },
  ]);

  it('places a date on its cycle day', () => {
    assert.equal(cycleDayOf(a.episodes, '2026-07-01'), 1);
    assert.equal(cycleDayOf(a.episodes, '2026-07-10'), 10);
    assert.equal(cycleDayOf(a.episodes, '2026-06-30'), null);
  });

  it('counts a symptom by cycle day, as a share of check-ins', () => {
    const b = byCycleDay(entries, a.episodes, { kind: 'symptom', key: 'cramps' });
    assert.deepEqual([b[0].logged, b[0].matching], [5, 5]);
    assert.deepEqual([b[1].logged, b[1].matching], [5, 5]);
    assert.deepEqual([b[14].logged, b[14].matching], [5, 0]);
    assert.deepEqual(peakDays(b), { from: 1, to: 2, share: 1 });
  });

  it('counts by month for the last six months', () => {
    const m = byMonth(entries, { kind: 'symptom', key: 'cramps' }, today);
    assert.deepEqual(
      m.map((x) => x.label),
      ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'],
    );
    assert.equal(m[0].logged, 0);
    assert.ok(m[1].matching >= 2);
  });

  it('lists the most logged symptoms and moods first', () => {
    const top = topTrendKeys(entries, 3);
    assert.deepEqual(top[0], { kind: 'symptom', key: 'cramps', days: 10 });
  });
});

describe('lifestyle across the cycle', () => {
  it('sorts days into period, the 5 days before, and the rest', () => {
    assert.equal(windowOf(a.episodes, '2026-07-02'), 'period');
    assert.equal(windowOf(a.episodes, '2026-07-26'), 'before');
    assert.equal(windowOf(a.episodes, '2026-07-12'), 'rest');
  });

  it('notices shorter sleep before a period', () => {
    const entries = starts.slice(1).flatMap((s) => [
      { date: addDays(s, -3), sleepHours: 6 },
      { date: addDays(s, -2), sleepHours: 6.5 },
      { date: addDays(s, 10), sleepHours: 7.5 },
      { date: addDays(s, 12), sleepHours: 8 },
    ]);
    const notes = lifestyleNotes(lifestyleByWindow(entries, a.episodes));
    assert.deepEqual(notes, ['You sleep about 1.5 hours less in the 5 days before your period.']);
  });

  it('says nothing without enough days', () => {
    const notes = lifestyleNotes(
      lifestyleByWindow(
        [
          { date: '2026-07-26', sleepHours: 4 },
          { date: '2026-07-12', sleepHours: 9 },
        ],
        a.episodes,
      ),
    );
    assert.deepEqual(notes, []);
  });
});

describe('home screen widget', async () => {
  const { widgetSnapshot } = await import('../widget-snapshot.ts');
  it('shares only cycle numbers', () => {
    const s = widgetSnapshot(a, today, false);
    assert.deepEqual(Object.keys(s).sort(), ['asOf', 'average', 'cycleDay', 'daysUntil', 'detailed', 'hasData', 'periodDay']);
    assert.equal(s.hasData, 1);
    assert.equal(s.cycleDay, a.today!.cycleDay);
    assert.equal(s.detailed, 0);
  });
  it('says there is nothing to show without history', () => {
    const empty = analyzeCycles([], settings, today);
    assert.deepEqual(widgetSnapshot(empty, today, true), { hasData: 0, asOf: today, detailed: 1 });
  });
});
