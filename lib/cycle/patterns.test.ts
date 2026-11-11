import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { addDays } from './dates.ts';
import { analyzeCycles, type PeriodRecord } from './engine.ts';
import { findPatterns, summarizeRange, type DayEntry } from './patterns.ts';

const settings = { typicalCycleLength: 28, typicalPeriodLength: 5 };
const starts = ['2026-07-01', '2026-07-29', '2026-08-26', '2026-09-23'];
const records: PeriodRecord[] = starts.map((s, i) => ({ id: `p${i}`, startDate: s, endDate: addDays(s, 4) }));
const today = '2026-10-10';
const analysis = analyzeCycles(records, settings, today);

describe('cycle patterns', () => {
  it('finds a symptom that keeps landing in the same part of the cycle', () => {
    const entries: DayEntry[] = starts.slice(0, 3).map((s) => ({ date: addDays(s, 1), symptoms: ['cramps'] }));
    const [p] = findPatterns(entries, analysis);
    assert.equal(p.key, 'cramps');
    assert.equal(p.timing, 'during-period');
    assert.equal(p.matching, 3);
    assert.equal(p.cycles, 3);
  });

  it('finds moods in the days before a period', () => {
    const entries: DayEntry[] = starts.slice(1).map((s) => ({ date: addDays(s, -2), moods: ['anxious'] }));
    const [p] = findPatterns(entries, analysis);
    assert.equal(p.kind, 'mood');
    assert.equal(p.timing, 'before-period');
  });

  it('stays quiet about scattered or sparse logs', () => {
    const scattered: DayEntry[] = [
      { date: addDays(starts[0], 1), symptoms: ['headache'] },
      { date: addDays(starts[1], 9), symptoms: ['headache'] },
      { date: addDays(starts[2], 20), symptoms: ['headache'] },
    ];
    assert.deepEqual(findPatterns(scattered, analysis), []);
    const sparse: DayEntry[] = [
      { date: addDays(starts[0], 1), symptoms: ['acne'] },
      { date: addDays(starts[0], 2), symptoms: ['acne'] },
    ];
    assert.deepEqual(findPatterns(sparse, analysis), []);
  });

  it('needs logs from at least two cycles', () => {
    const oneCycle: DayEntry[] = [0, 1, 2].map((d) => ({ date: addDays(starts[0], d), symptoms: ['cramps'] }));
    assert.deepEqual(findPatterns(oneCycle, analysis), []);
  });
});

describe('range summaries', () => {
  it('counts check-ins, periods and the most common entries', () => {
    const entries: DayEntry[] = [
      { date: '2026-09-23', symptoms: ['cramps', 'fatigue'], moods: ['calm'] },
      { date: '2026-09-24', symptoms: ['cramps'] },
      { date: '2026-08-30', symptoms: ['acne'] },
    ];
    const s = summarizeRange(entries, analysis, '2026-09-01', '2026-09-30');
    assert.equal(s.checkIns, 2);
    assert.equal(s.periodsStarted, 1);
    assert.deepEqual(s.topSymptoms[0], { key: 'cramps', count: 2 });
    assert.deepEqual(s.topMoods, [{ key: 'calm', count: 1 }]);
  });
});
