import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { missedPills, packDay, pillSchedule, startForPillNumber } from './pill.ts';

describe('pill packs', () => {
  const pack = { type: 'combined_21_7' as const, startDate: '2026-11-01' };

  it('knows which pill is today and when the break comes', () => {
    assert.deepEqual(packDay(pack, '2026-11-01'), {
      packIndex: 0,
      day: 1,
      packStart: '2026-11-01',
      kind: 'active',
      takesPill: true,
      gapIn: 21,
      nextPackIn: 28,
    });
    const d21 = packDay(pack, '2026-11-21')!;
    assert.equal(d21.day, 21);
    assert.equal(d21.gapIn, 1);
    const d22 = packDay(pack, '2026-11-22')!;
    assert.deepEqual([d22.kind, d22.takesPill, d22.gapIn, d22.nextPackIn], ['break', false, null, 7]);
    const next = packDay(pack, '2026-11-29')!;
    assert.deepEqual([next.packIndex, next.day, next.packStart], [1, 1, '2026-11-29']);
    assert.equal(packDay(pack, '2026-10-31'), null);
  });

  it('treats inactive pills as pills to take', () => {
    const ed = packDay({ type: 'combined_24_4', startDate: '2026-11-01' }, '2026-11-26')!;
    assert.deepEqual([ed.day, ed.kind, ed.takesPill], [26, 'inactive', true]);
  });

  it('sets the start from today’s pill number', () => {
    assert.equal(startForPillNumber('2026-11-11', 11), '2026-11-01');
  });

  it('lists active pills in this pack that weren’t ticked', () => {
    const days = { '2026-11-01': { medsTaken: ['m'] }, '2026-11-03': { medsTaken: ['m'] } };
    assert.deepEqual(missedPills(pack, 'm', days, '2026-11-05', '2026-11-01'), ['2026-11-02', '2026-11-04']);
    assert.deepEqual(missedPills(pack, 'm', days, '2026-11-05', '2026-11-04'), ['2026-11-04']);
    // Break days are never "missed", and a new pack starts the count again.
    assert.deepEqual(missedPills(pack, 'm', {}, '2026-11-30', '2026-11-01'), ['2026-11-29']);
  });

  it('schedules reminders on pill days and before a new pack', () => {
    const s = pillSchedule(pack, '2026-11-20', 10);
    assert.deepEqual(
      s.map((x) => `${x.date.slice(8)}:${x.kind}`),
      ['20:pill', '21:pill', '28:new-pack-tomorrow', '29:pill'],
    );
  });
});
