import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { addDays, addMonths, diffDays, eachDay, isISODate, monthGrid, todayISO, weekday } from './dates.ts';

describe('calendar dates', () => {
  it('adds days across month, year and leap-day boundaries', () => {
    assert.equal(addDays('2026-01-31', 1), '2026-02-01');
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addDays('2024-02-28', 1), '2024-02-29');
    assert.equal(addDays('2023-02-28', 1), '2023-03-01');
    assert.equal(addDays('2100-02-28', 1), '2100-03-01');
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  });

  it('counts whole days regardless of daylight saving', () => {
    // US clocks change on 2026-03-08 and 2026-11-01; Europe on 03-29 and 10-25.
    assert.equal(diffDays('2026-03-07', '2026-03-09'), 2);
    assert.equal(diffDays('2026-10-24', '2026-10-26'), 2);
    assert.equal(diffDays('2026-10-31', '2026-11-02'), 2);
    assert.equal(diffDays('2026-11-02', '2026-10-31'), -2);
    assert.equal(diffDays('2024-01-01', '2025-01-01'), 366);
  });

  it('reads today from local time, not UTC', () => {
    const previous = process.env.TZ;
    try {
      process.env.TZ = 'Pacific/Auckland';
      // 23:30 local on the 8th is still the 8th, even though UTC is the 8th at 10:30.
      assert.equal(todayISO(new Date(2026, 2, 8, 23, 30)), '2026-03-08');
      process.env.TZ = 'America/Los_Angeles';
      assert.equal(todayISO(new Date(2026, 10, 1, 0, 15)), '2026-11-01');
    } finally {
      process.env.TZ = previous;
    }
  });

  it('rejects impossible dates', () => {
    assert.equal(isISODate('2026-02-29'), false);
    assert.equal(isISODate('2024-02-29'), true);
    assert.equal(isISODate('2026-13-01'), false);
    assert.equal(isISODate('2026-1-01'), false);
    assert.equal(isISODate(20261111), false);
  });

  it('knows the weekday and builds month grids for either week start', () => {
    assert.equal(weekday('2026-11-11'), 3); // Wednesday
    const sunday = monthGrid('2026-11', 0);
    assert.equal(sunday[0][0], '2026-11-01');
    const monday = monthGrid('2026-11', 1);
    assert.deepEqual(monday[0].slice(0, 7), [null, null, null, null, null, null, '2026-11-01']);
    assert.equal(monday.flat().filter(Boolean).length, 30);
    assert.ok(monday.every((week) => week.length === 7));
  });

  it('steps months across year ends', () => {
    assert.equal(addMonths('2026-11', 2), '2027-01');
    assert.equal(addMonths('2026-01', -1), '2025-12');
    assert.equal(addMonths('2026-06', -18), '2024-12');
  });

  it('lists each day inclusively', () => {
    assert.deepEqual(eachDay('2026-02-27', '2026-03-02'), ['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
  });
});
