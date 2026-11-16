import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { analyzeCycles } from '../cycle/engine.ts';
import { createDefaultData } from '../data/defaults.ts';
import type { AppData, DailyLog } from '../data/types.ts';
import { buildCycleSummary } from './summary.ts';

const TODAY = '2026-11-12';
const stamp = '2026-11-01T00:00:00.000Z';

function day(date: string, extra: Partial<DailyLog>): DailyLog {
  return { date, symptoms: [], moods: [], updatedAt: stamp, ...extra };
}

function sample(): AppData {
  const data = createDefaultData(new Date('2026-01-01T00:00:00Z'));
  data.profile = { name: 'Ama', birthYear: 1991, goals: ['manage_symptoms'], onboardedAt: stamp };
  data.periods = ['2026-08-01', '2026-08-29', '2026-09-27', '2026-10-25'].map((startDate, i) => ({
    id: `p${i}`,
    startDate,
    endDate: null,
    updatedAt: stamp,
  }));
  data.days = {
    '2026-10-25': day('2026-10-25', { flow: 'heavy', symptoms: ['cramps', 'bloating'], moods: ['irritable'], pain: 3, note: 'secret note' }),
    '2026-10-26': day('2026-10-26', { flow: 'medium', symptoms: ['cramps'], moods: ['irritable'], pain: 2 }),
    '2026-05-01': day('2026-05-01', { symptoms: ['headache'], moods: [] }),
  };
  data.journal = [{ id: 'j', date: '2026-10-26', title: 'Private', body: 'journal body', createdAt: stamp, updatedAt: stamp }];
  data.medications = [
    { id: 'm', name: 'Brand X 400', kind: 'pain_relief', reminder: { enabled: false, hour: 8, minute: 0 }, createdAt: stamp, updatedAt: stamp },
  ];
  return data;
}

describe('buildCycleSummary', () => {
  const data = sample();
  const summary = buildCycleSummary(data, analyzeCycles(data.periods, data.cycle, TODAY), TODAY);

  it('includes cycle numbers and recent logs', () => {
    assert.match(summary, /Cycles: average \d+ days/);
    assert.match(summary, /Today is cycle day \d+/);
    assert.match(summary, /Cramps 2/);
    assert.match(summary, /Heavy-flow days: 1/);
    assert.match(summary, /Medication types tracked: Pain relief/);
    assert.match(summary, /Age: 30s/);
  });

  it('never includes names, notes, the journal or exact birth year', () => {
    for (const secret of ['Ama', 'secret note', 'journal body', 'Private', 'Brand X', '1991']) {
      assert.ok(!summary.includes(secret), `summary leaked "${secret}"`);
    }
  });

  it('only counts check-ins from the last 90 days', () => {
    assert.ok(!summary.includes('Headache'));
    assert.match(summary, /Check-ins in the last 90 days: 2/);
  });

  it('works with no history', () => {
    const empty = createDefaultData(new Date('2026-01-01T00:00:00Z'));
    const text = buildCycleSummary(empty, analyzeCycles([], empty.cycle, TODAY), TODAY);
    assert.match(text, /No periods logged yet/);
  });
});
