import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { addDays } from '../cycle/dates.ts';
import { analyzeCycles } from '../cycle/engine.ts';
import { buildPartnerSummary, supportTips } from './summary.ts';

const starts = ['2026-08-26', '2026-09-23', '2026-10-21', '2026-11-18'];
const records = starts.map((s, i) => ({ id: `p${i}`, startDate: s, endDate: addDays(s, 4) }));
const settings = { typicalCycleLength: 28, typicalPeriodLength: 5 };
const all = { period: true, phase: true, today: true, fertile: true };

describe('partner summary', () => {
  const today = '2026-11-19';
  const a = analyzeCycles(records, settings, today);
  const log = { moods: ['low'], symptoms: ['cramps'], note: 'private', pain: 3, medsTaken: ['m1'] };

  it('shares period, phase, today and fertile window when all are on', () => {
    const s = buildPartnerSummary(a, log, today, all, true);
    assert.equal(s.asOf, today);
    assert.equal(s.period?.isPeriodDay, true);
    assert.equal(s.period?.periodDay, 2);
    assert.equal(s.phase?.phase, 'menstrual');
    assert.deepEqual(s.today, { moods: ['low'], symptoms: ['cramps'] });
    assert.ok(s.fertile?.start);
  });

  it('never includes notes, pain or medications', () => {
    const json = JSON.stringify(buildPartnerSummary(a, log, today, all, true));
    assert.doesNotMatch(json, /private|pain|medsTaken|m1/);
  });

  it('leaves switched-off parts out entirely', () => {
    const s = buildPartnerSummary(a, log, today, { period: true, phase: false, today: false, fertile: false }, true);
    assert.deepEqual(Object.keys(s).sort(), ['asOf', 'period']);
  });

  it('hides the fertile window when fertility estimates are off in the app', () => {
    const s = buildPartnerSummary(a, log, today, all, false);
    assert.equal(s.fertile, undefined);
  });
});

describe('support tips', () => {
  it('puts what was logged today first, then the phase', () => {
    const tips = supportTips({ today: { moods: ['low'], symptoms: ['cramps'] }, phase: { phase: 'menstrual', cycleDay: 2 } }, 0);
    assert.equal(tips.length, 3);
    assert.match(tips[0], /cramps/);
    assert.match(tips[1], /low/);
  });

  it('works with only the phase shared', () => {
    assert.equal(supportTips({ phase: { phase: 'luteal', cycleDay: 24 } }, 1).length, 1);
  });

  it('says nothing when nothing is shared', () => {
    assert.deepEqual(supportTips({}, 0), []);
  });
});
