import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { findChanges, findDeviations, reliefStats, type LogEntry } from './changes.ts';
import { addDays } from './dates.ts';
import { analyzeCycles, type PeriodRecord } from './engine.ts';

const settings = { typicalCycleLength: 28, typicalPeriodLength: 5 };

/** Periods starting at `first` with the given cycle gaps and period lengths. */
function build(first: string, gaps: number[], lens: number[]) {
  const starts = [first];
  for (const g of gaps) starts.push(addDays(starts[starts.length - 1], g));
  const records: PeriodRecord[] = starts.map((s, i) => ({ id: `p${i}`, startDate: s, endDate: addDays(s, (lens[i] ?? 5) - 1) }));
  return { starts, records };
}

const ids = (fs: { id: string }[]) => fs.map((f) => f.id);

describe('cycle changes', () => {
  it('spots cycles getting longer', () => {
    const { records, starts } = build('2026-03-01', [28, 28, 28, 33, 33, 34], []);
    const today = addDays(starts[starts.length - 1], 10);
    const a = analyzeCycles(records, settings, today);
    const f = findChanges(a, [], today).find((x) => x.id === 'cycle-length-trend');
    assert.ok(f);
    assert.equal(f.direction, 'up');
    assert.match(f.detail ?? '', /33 days · before: 28 days/);
  });

  it('treats one unusual cycle as a deviation, not a trend', () => {
    const { records, starts } = build('2026-03-01', [28, 29, 27, 29, 28, 27, 21], []);
    const today = addDays(starts[starts.length - 1], 2);
    const a = analyzeCycles(records, settings, today);
    assert.equal(
      findChanges(a, [], today).find((x) => x.id === 'cycle-length-trend'),
      undefined,
    );
    assert.ok(findDeviations(a, [], today).find((x) => x.id === 'last-cycle-outlier'));
  });

  it('stays quiet when cycles are steady', () => {
    const { records, starts } = build('2026-03-01', [28, 29, 27, 28, 28, 29], []);
    const today = addDays(starts[starts.length - 1], 10);
    assert.deepEqual(findChanges(analyzeCycles(records, settings, today), [], today), []);
  });

  it('needs enough history before comparing', () => {
    const { records, starts } = build('2026-06-01', [28, 35, 36], []);
    const today = addDays(starts[starts.length - 1], 5);
    assert.deepEqual(findChanges(analyzeCycles(records, settings, today), [], today), []);
  });

  it('spots periods lasting longer', () => {
    const { records, starts } = build('2026-03-01', [28, 28, 28, 28, 28], [5, 5, 5, 8, 8, 8]);
    const today = addDays(starts[starts.length - 1], 12);
    const f = findChanges(analyzeCycles(records, settings, today), [], today).find((x) => x.id === 'period-length-trend');
    assert.ok(f);
    assert.equal(f.direction, 'up');
  });

  it('spots more heavy days and stronger cramps', () => {
    const { records, starts } = build('2026-03-01', [28, 28, 28, 28, 28], []);
    const today = addDays(starts[starts.length - 1], 12);
    const entries: LogEntry[] = starts.flatMap((s, i) => {
      const recent = i >= starts.length - 3;
      return [0, 1, 2].map((d) => ({
        date: addDays(s, d),
        flow: recent || d === 0 ? ('heavy' as const) : ('light' as const),
        symptoms: ['cramps'],
        pain: recent ? (3 as const) : (1 as const),
      }));
    });
    const found = ids(findChanges(analyzeCycles(records, settings, today), entries, today));
    assert.ok(found.includes('heavy-trend'));
    assert.ok(found.includes('cramps-worse'));
  });

  it('notices cramps easing', () => {
    const { records, starts } = build('2026-03-01', [28, 28, 28, 28, 28], []);
    const today = addDays(starts[starts.length - 1], 12);
    const entries: LogEntry[] = starts.flatMap((s, i) => {
      const recent = i >= starts.length - 3;
      return [0, 1, 2].map((d) => ({
        date: addDays(s, d),
        symptoms: recent && d > 0 ? [] : ['cramps'],
        pain: 2 as const,
        flow: 'medium' as const,
      }));
    });
    const f = findChanges(analyzeCycles(records, settings, today), entries, today).find((x) => x.id === 'cramps-easier');
    assert.ok(f);
    assert.equal(f.level, 'good');
  });

  it('flags a symptom that is new', () => {
    const { records, starts } = build('2026-03-01', [28, 28, 28, 28, 28], []);
    const today = addDays(starts[starts.length - 1], 12);
    const entries: LogEntry[] = starts.map((s, i) => ({
      date: addDays(s, 10),
      symptoms: i >= starts.length - 2 ? ['bloating', 'headache'] : ['bloating'],
    }));
    const f = findChanges(analyzeCycles(records, settings, today), entries, today, (k) => (k === 'headache' ? 'Headache' : k));
    assert.ok(f.some((x) => x.id === 'new-symptom-headache' && x.title === 'Headache is new for you'));
    assert.ok(!f.some((x) => x.id === 'new-symptom-bloating'));
  });
});

describe('deviations from your usual', () => {
  it('flags one cycle well outside your norm', () => {
    const { records, starts } = build('2026-03-01', [28, 28, 29, 28, 38], []);
    const today = addDays(starts[starts.length - 1], 5);
    const f = findDeviations(analyzeCycles(records, settings, today), [], today).find((x) => x.id === 'last-cycle-outlier');
    assert.ok(f);
    assert.match(f.detail ?? '', /38 days · your usual 28/);
  });

  it('flags an ongoing period running long', () => {
    const { records } = build('2026-07-04', [28, 28], []);
    const start = '2026-08-29';
    const today = addDays(start, 8); // day 9
    records[records.length - 1] = { id: 'open', startDate: start, endDate: null };
    const f = findDeviations(analyzeCycles(records, settings, today), [], today).find((x) => x.id === 'period-longer');
    assert.ok(f);
    assert.equal(f.level, 'care');
    assert.match(f.detail ?? '', /9 days so far · your usual 5/);
  });

  it('flags bleeding between periods but not spotting next to a period', () => {
    const { records, starts } = build('2026-09-01', [28, 28], []);
    const last = starts[starts.length - 1];
    const today = addDays(last, 20);
    const a = analyzeCycles(records, settings, today);
    const near: LogEntry[] = [{ date: addDays(last, -1), flow: 'spotting' }];
    assert.ok(!findDeviations(a, near, today).some((x) => x.id === 'between-periods'));
    const mid: LogEntry[] = [{ date: addDays(last, 14), flow: 'spotting' }];
    const f = findDeviations(a, mid, today).find((x) => x.id === 'between-periods');
    assert.ok(f);
    assert.equal(f.level, 'care');
  });

  it('flags several heavy days and severe pain in the latest period', () => {
    const { records, starts } = build('2026-09-01', [28, 28], []);
    const last = starts[starts.length - 1];
    const today = addDays(last, 6);
    const entries: LogEntry[] = [0, 1, 2].map((d) => ({
      date: addDays(last, d),
      flow: 'heavy',
      symptoms: ['cramps'],
      pain: d < 2 ? 3 : 2,
    }));
    const found = ids(findDeviations(analyzeCycles(records, settings, today), entries, today));
    assert.ok(found.includes('heavy-period'));
    assert.ok(found.includes('severe-pain'));
  });

  it('says nothing for an ordinary history', () => {
    const { records, starts } = build('2026-06-01', [28, 29, 28, 27], []);
    const today = addDays(starts[starts.length - 1], 10);
    const entries: LogEntry[] = [{ date: starts[starts.length - 1], flow: 'medium', symptoms: ['cramps'], pain: 1 }];
    assert.deepEqual(findDeviations(analyzeCycles(records, settings, today), entries, today), []);
  });
});

describe('what helps', () => {
  it('counts relief on cramp days only, most used first', () => {
    const stats = reliefStats([
      { date: '2026-10-01', symptoms: ['cramps'], relief: ['heat', 'rest'] },
      { date: '2026-10-02', symptoms: ['cramps'], relief: ['heat'] },
      { date: '2026-10-03', symptoms: ['headache'], relief: ['rest'] },
    ]);
    assert.deepEqual(stats, [
      { key: 'heat', days: 2 },
      { key: 'rest', days: 1 },
    ]);
  });
});
