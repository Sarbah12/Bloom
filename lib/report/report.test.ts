import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { addDays } from '../cycle/dates.ts';
import { analyzeCycles } from '../cycle/engine.ts';
import type { DailyLog, Medication } from '../data/types.ts';
import { buildReport, reportHtml } from './report.ts';

const starts = ['2026-07-01', '2026-07-29', '2026-08-26', '2026-09-23', '2026-10-21'];
const today = '2026-11-11';
const analysis = analyzeCycles(
  starts.map((s, i) => ({ id: `p${i}`, startDate: s, endDate: addDays(s, 4) })),
  { typicalCycleLength: 28, typicalPeriodLength: 5 },
  today,
);
const days: Record<string, DailyLog> = {};
for (const s of starts) {
  days[s] = { date: s, flow: 'heavy', symptoms: ['cramps'], moods: ['low'], pain: 3, relief: ['heat'], medsTaken: ['m1'], updatedAt: 'x' };
  days[addDays(s, 1)] = {
    date: addDays(s, 1),
    flow: 'medium',
    symptoms: ['cramps'],
    moods: [],
    pain: 2,
    sleepHours: 7,
    note: 'Missed <work>',
    updatedAt: 'x',
  };
}
const meds: Medication[] = [
  {
    id: 'm1',
    name: 'Ibuprofen',
    kind: 'pain_relief',
    dose: '400 mg',
    reminder: { enabled: false, hour: 8, minute: 0 },
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: 'x',
  },
];
const input = {
  name: 'Ama',
  analysis,
  days,
  medications: meds,
  findings: [{ title: 'Severe cramps on 2 days', detail: 'Last period' }],
  today,
  units: 'metric' as const,
  toLocalDay: (i: string) => i.slice(0, 10),
  formatDay: (d: string) => d,
};

describe('doctor visit report', () => {
  it('summarises the chosen number of cycles', () => {
    const m = buildReport(input, { cycles: 3, includeName: false, includeNotes: false });
    assert.equal(m.cycles.length, 4); // 3 complete + the current one
    assert.deepEqual(m.cycles[0], { start: '2026-07-29', length: 28, periodLength: 5, heavyDays: 1, crampDays: 2, worstPain: 'Severe' });
    assert.equal(m.cycles[3].length, null);
    assert.equal(m.name, undefined);
    assert.equal(m.notes.length, 0);
    assert.deepEqual(m.relief, [{ label: 'Heat', days: 4 }]);
    assert.equal(m.symptoms[0].label, 'Cramps');
  });

  it('includes the name and notes only when asked, escaped', () => {
    const m = buildReport(input, { cycles: 3, includeName: true, includeNotes: true });
    assert.equal(m.name, 'Ama');
    const html = reportHtml(m);
    assert.match(html, /Cycle summary — Ama/);
    assert.match(html, /Missed &lt;work&gt;/);
    assert.doesNotMatch(html, /<work>/);
    assert.match(html, /not a method of contraception/);
    assert.match(html, /Ibuprofen/);
  });
});
