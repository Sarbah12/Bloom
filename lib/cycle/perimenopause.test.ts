import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { addDays } from './dates.ts';
import { analyzeCycles, type PeriodRecord } from './engine.ts';

const settings = { typicalCycleLength: 28, typicalPeriodLength: 5 };
const build = (first: string, gaps: number[]): PeriodRecord[] => {
  const starts = [first];
  for (const g of gaps) starts.push(addDays(starts[starts.length - 1], g));
  return starts.map((s, i) => ({ id: `p${i}`, startDate: s, endDate: addDays(s, 4) }));
};
const peri = { lifeStage: 'perimenopause' as const };

describe('perimenopause', () => {
  const varying = build('2026-01-01', [24, 40, 26, 45, 30]);
  const today = '2026-07-20';

  it('treats varying cycles as expected, not as a care notice', () => {
    const usual = analyzeCycles(varying, settings, today);
    const p = analyzeCycles(varying, settings, today, peri);
    assert.equal(usual.notices.find((n) => n.id === 'cycles-irregular')?.level, 'care');
    const n = p.notices.find((x) => x.id === 'cycles-irregular');
    assert.equal(n?.level, 'info');
    assert.match(n!.body, /common in perimenopause/);
  });

  it('never claims high confidence and widens the window', () => {
    const steady = build('2026-01-01', [28, 28, 28, 28, 28]);
    const t = '2026-05-30';
    assert.equal(analyzeCycles(steady, settings, t).confidence, 'high');
    const p = analyzeCycles(steady, settings, t, peri);
    assert.equal(p.confidence, 'medium');
    const w = p.nextPeriod!;
    assert.ok(w.windowEnd > addDays(w.start, 3));
  });

  it('flags bleeding after 12 months without a period', () => {
    const records = build('2025-01-01', [400]);
    const p = analyzeCycles(records, settings, addDays(records[1].startDate, 3), peri);
    const n = p.notices.find((x) => x.id === 'bleeding-after-gap');
    assert.equal(n?.level, 'care');
    assert.match(n!.body, /checked by a GP/);
  });

  it('words long gaps gently, mentioning pregnancy is still possible', () => {
    const records = build('2026-01-01', [30]);
    const p = analyzeCycles(records, settings, addDays(records[1].startDate, 120), peri);
    const n = p.notices.find((x) => x.id === 'no-period');
    assert.equal(n?.level, 'info');
    assert.match(n!.body, /Pregnancy is still possible/);
  });
});
