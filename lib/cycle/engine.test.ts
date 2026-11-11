import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { addDays } from './dates.ts';
import { analyzeCycles, describeDay, endPeriod, startPeriod, toEpisodes, togglePeriodDay, type PeriodRecord } from './engine.ts';

const settings = { typicalCycleLength: 28, typicalPeriodLength: 5 };
let seq = 0;
const id = () => `p${++seq}`;

/** Closed periods of `len` days starting at `first`, then every gap in `gaps`. */
function history(first: string, gaps: number[], len = 5): PeriodRecord[] {
  const out: PeriodRecord[] = [];
  let start = first;
  for (const g of [0, ...gaps]) {
    start = addDays(start, g);
    out.push({ id: id(), startDate: start, endDate: addDays(start, len - 1) });
  }
  return out;
}

describe('no history', () => {
  it('makes no predictions without a single period', () => {
    const a = analyzeCycles([], settings, '2026-11-11');
    assert.equal(a.hasHistory, false);
    assert.equal(a.nextPeriod, null);
    assert.equal(a.today, null);
    assert.equal(a.confidence, 'low');
  });
});

describe('one period (fresh from onboarding)', () => {
  const records: PeriodRecord[] = [{ id: 'a', startDate: '2026-10-20', endDate: null }];
  const a = analyzeCycles(records, settings, '2026-11-11');

  it('uses the stated typical length', () => {
    assert.equal(a.stats.basis, 'settings');
    assert.equal(a.stats.averageCycleLength, 28);
    assert.equal(a.nextPeriod?.start, '2026-11-17');
    assert.equal(a.nextPeriod?.daysUntil, 6);
    assert.equal(a.confidence, 'low');
  });

  it('places today in the cycle', () => {
    assert.equal(a.today?.cycleDay, 23);
    assert.equal(a.today?.phase, 'luteal');
    assert.equal(a.today?.isPeriodDay, false);
  });

  it('estimates ovulation 14 days before the next period and a six-day fertile window', () => {
    const p = a.projections[0];
    assert.equal(p.ovulation, '2026-11-02'); // cycle day 14
    assert.equal(p.fertileStart, '2026-10-26');
    assert.equal(p.fertileEnd, '2026-11-04'); // ±2 days of uncertainty with no history
  });
});

describe('regular history', () => {
  const records = history('2026-05-01', [28, 28, 28, 28, 28, 28]);
  const today = '2026-10-25'; // last start 2026-10-16
  const a = analyzeCycles(records, settings, today);

  it('learns the average and is confident', () => {
    assert.equal(a.stats.countedCycles, 6);
    assert.equal(a.stats.averageCycleLength, 28);
    assert.equal(a.stats.averagePeriodLength, 5);
    assert.equal(a.stats.variation, 0);
    assert.equal(a.confidence, 'high');
    assert.deepEqual(a.notices, []);
  });

  it('predicts the next start exactly one cycle after the last', () => {
    const last = records[records.length - 1].startDate;
    assert.equal(a.nextPeriod?.start, addDays(last, 28));
    assert.equal(a.nextPeriod?.isLate, false);
  });

  it('marks a six-day fertile window ending on ovulation day', () => {
    const p = a.projections[0];
    assert.equal(p.fertileStart, addDays(p.start, 8)); // cycle day 9
    assert.equal(p.fertileEnd, p.ovulation); // cycle day 14
    assert.equal(p.ovulation, addDays(p.start, 13));
  });

  it('describes calendar days', () => {
    const last = records[records.length - 1].startDate;
    assert.equal(describeDay(a, last, today).period, 'logged');
    assert.equal(describeDay(a, addDays(last, 10), today).fertile, true);
    assert.equal(describeDay(a, addDays(last, 13), today).ovulation, true);
    assert.equal(describeDay(a, addDays(last, 13), today).phase, 'ovulatory');
    const next = addDays(last, 28);
    assert.equal(describeDay(a, next, today).period, 'predicted');
    assert.equal(describeDay(a, addDays(next, 4), today).period, 'predicted');
    assert.equal(describeDay(a, addDays(next, 5), today).period, null);
    // Past cycles get a cycle day but no retrospective fertility guesses.
    const past = describeDay(a, addDays(records[0].startDate, 12), today);
    assert.equal(past.fertile, false);
    assert.equal(past.cycleDay, 13);
  });
});

describe('few cycles', () => {
  it('blends recorded cycles with the stated length', () => {
    const a = analyzeCycles(history('2026-09-01', [32]), settings, '2026-10-10');
    assert.equal(a.stats.basis, 'blended');
    assert.equal(a.stats.averageCycleLength, 29); // (32 + 28 + 28) / 3
  });

  it('is medium-confident with three steady cycles', () => {
    const a = analyzeCycles(history('2026-07-01', [29, 27, 28]), settings, '2026-10-01');
    assert.equal(a.confidence, 'medium');
  });
});

describe('irregular and atypical cycles', () => {
  it('flags large variation and lowers confidence', () => {
    const a = analyzeCycles(history('2026-01-10', [24, 35, 27, 40]), settings, '2026-05-20');
    assert.equal(a.stats.variation, 16);
    assert.equal(a.confidence, 'low');
    assert.ok(a.notices.some((n) => n.id === 'cycles-irregular' && n.level === 'care'));
  });

  it('uses the tighter 7-day limit for ages 26–41', () => {
    const records = history('2026-01-10', [26, 34, 30, 28]); // variation 8
    assert.ok(!analyzeCycles(records, settings, '2026-05-20').notices.some((n) => n.id === 'cycles-irregular'));
    assert.ok(analyzeCycles(records, settings, '2026-05-20', { age: 30 }).notices.some((n) => n.id === 'cycles-irregular'));
  });

  it('flags cycles shorter or longer than 24–38 days', () => {
    const short = analyzeCycles(history('2026-01-01', [21, 21, 21, 21]), settings, '2026-03-30');
    assert.ok(short.notices.some((n) => n.id === 'cycles-short'));
    const long = analyzeCycles(history('2025-06-01', [45, 44, 46, 45]), settings, '2026-02-10');
    assert.ok(long.notices.some((n) => n.id === 'cycles-long'));
  });

  it('flags a period longer than 8 days', () => {
    const a = analyzeCycles(history('2026-09-01', [28], 10), settings, '2026-10-10');
    assert.ok(a.notices.some((n) => n.id === 'period-long'));
  });

  it("doesn't count a gap that looks like missed logging", () => {
    const a = analyzeCycles(history('2025-10-01', [28, 28, 150, 28]), settings, '2026-06-01');
    assert.equal(a.cycles.filter((c) => !c.counted).length, 1);
    assert.equal(a.stats.averageCycleLength, 28);
  });
});

describe('late and missing periods', () => {
  it('reports lateness and restarts the forecast from today', () => {
    const a = analyzeCycles(history('2026-09-03', [28]), settings, '2026-11-11');
    // last start 2026-10-01, expected 2026-10-29
    assert.equal(a.nextPeriod?.isLate, true);
    assert.equal(a.nextPeriod?.daysLate, 13);
    assert.equal(a.projections[1].start, '2026-11-11');
    assert.ok(a.notices.some((n) => n.id === 'late'));
    assert.equal(a.today?.phase, 'luteal');
  });

  it('suggests care after 90 days without a period', () => {
    const a = analyzeCycles(history('2026-07-01', []), settings, '2026-10-05');
    assert.ok(a.notices.some((n) => n.id === 'no-period' && n.level === 'care'));
    assert.equal(a.today?.phase, null);
  });
});

describe('grouping bleeding days', () => {
  it('treats a one- or two-day gap as the same period', () => {
    const eps = toEpisodes(
      [
        { id: 'a', startDate: '2026-11-01', endDate: '2026-11-03' },
        { id: 'b', startDate: '2026-11-06', endDate: '2026-11-07' },
      ],
      5,
      '2026-11-20',
    );
    assert.equal(eps.length, 1);
    assert.equal(eps[0].end, '2026-11-07');
  });

  it('keeps periods three empty days apart separate', () => {
    const eps = toEpisodes(
      [
        { id: 'a', startDate: '2026-11-01', endDate: '2026-11-03' },
        { id: 'b', startDate: '2026-11-07', endDate: '2026-11-08' },
      ],
      5,
      '2026-11-20',
    );
    assert.equal(eps.length, 2);
  });

  it('forecasts the rest of an ongoing period', () => {
    const today = '2026-11-11';
    const a = analyzeCycles([{ id: 'a', startDate: '2026-11-10', endDate: null }], settings, today);
    assert.equal(a.today?.isPeriodDay, true);
    assert.equal(a.today?.periodDay, 2);
    assert.equal(a.today?.openPeriod, true);
    assert.equal(describeDay(a, '2026-11-11', today).period, 'logged');
    assert.equal(describeDay(a, '2026-11-13', today).period, 'predicted');
  });
});

describe('editing period days', () => {
  const today = '2026-11-20';
  const base: PeriodRecord[] = [{ id: 'a', startDate: '2026-11-05', endDate: '2026-11-09' }];

  it('adds a lone day as a new period', () => {
    const out = togglePeriodDay([], '2026-11-12', 5, today, () => 'n');
    assert.deepEqual(out, [{ id: 'n', startDate: '2026-11-12', endDate: '2026-11-12' }]);
  });

  it('extends a period from either end', () => {
    assert.equal(togglePeriodDay(base, '2026-11-10', 5, today, id)[0].endDate, '2026-11-10');
    assert.equal(togglePeriodDay(base, '2026-11-04', 5, today, id)[0].startDate, '2026-11-04');
  });

  it('shrinks from either end and removes a single-day period', () => {
    assert.equal(togglePeriodDay(base, '2026-11-09', 5, today, id)[0].endDate, '2026-11-08');
    assert.equal(togglePeriodDay(base, '2026-11-05', 5, today, id)[0].startDate, '2026-11-06');
    const single: PeriodRecord[] = [{ id: 'a', startDate: '2026-11-05', endDate: '2026-11-05' }];
    assert.deepEqual(togglePeriodDay(single, '2026-11-05', 5, today, id), []);
  });

  it('splits when a middle day is removed', () => {
    const out = togglePeriodDay(base, '2026-11-07', 5, today, () => 'n');
    assert.deepEqual(out, [
      { id: 'a', startDate: '2026-11-05', endDate: '2026-11-06' },
      { id: 'n', startDate: '2026-11-08', endDate: '2026-11-09' },
    ]);
  });

  it('bridges two periods with the day between them', () => {
    const two: PeriodRecord[] = [
      { id: 'a', startDate: '2026-11-01', endDate: '2026-11-03' },
      { id: 'b', startDate: '2026-11-05', endDate: '2026-11-06' },
    ];
    assert.deepEqual(togglePeriodDay(two, '2026-11-04', 5, today, id), [{ id: 'a', startDate: '2026-11-01', endDate: '2026-11-06' }]);
  });

  it("won't log the future", () => {
    assert.equal(togglePeriodDay(base, '2026-11-21', 5, today, id), base);
  });

  it('ends an ongoing period when today is unmarked', () => {
    const open: PeriodRecord[] = [{ id: 'a', startDate: '2026-11-18', endDate: null }];
    assert.deepEqual(togglePeriodDay(open, today, 5, today, id), [{ id: 'a', startDate: '2026-11-18', endDate: '2026-11-19' }]);
  });

  it('keeps an ongoing period ongoing when an earlier day is unmarked', () => {
    const open: PeriodRecord[] = [{ id: 'a', startDate: '2026-11-17', endDate: null }];
    assert.deepEqual(togglePeriodDay(open, '2026-11-17', 5, today, id), [{ id: 'a', startDate: '2026-11-18', endDate: null }]);
    assert.deepEqual(
      togglePeriodDay(open, '2026-11-18', 5, today, () => 'n'),
      [
        { id: 'a', startDate: '2026-11-17', endDate: '2026-11-17' },
        { id: 'n', startDate: '2026-11-19', endDate: null },
      ],
    );
  });

  it('starts and ends periods', () => {
    const open: PeriodRecord[] = [{ id: 'a', startDate: '2026-10-20', endDate: null }];
    const started = startPeriod(open, today, 5, today, () => 'n');
    assert.deepEqual(started, [
      { id: 'a', startDate: '2026-10-20', endDate: '2026-10-24' },
      { id: 'n', startDate: '2026-11-20', endDate: null },
    ]);
    assert.equal(startPeriod(started, today, 5, today, id), started, 'already in a period');
    assert.equal(endPeriod(started, today, today)[1].endDate, today);
  });
});
