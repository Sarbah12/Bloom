import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { CycleAnalysis } from '../cycle/engine.ts';
import type { Reminders } from '../data/types.ts';

import { planReminders } from './plan.ts';

const TODAY = '2026-11-16';

function reminders(patch: Partial<Reminders> = {}): Reminders {
  return {
    periodSoon: { enabled: false, daysBefore: 2 },
    dailyCheckIn: { enabled: false, hour: 20, minute: 0 },
    fertileWindow: { enabled: false },
    periodCare: { enabled: false, hour: 19 },
    periodDue: { enabled: false },
    discreet: false,
    ...patch,
  };
}

function analysis(patch: { next?: Partial<NonNullable<CycleAnalysis['nextPeriod']>> | null; today?: Partial<NonNullable<CycleAnalysis['today']>> } = {}) {
  return {
    nextPeriod:
      patch.next === null
        ? null
        : { start: '2026-11-20', windowStart: '2026-11-18', windowEnd: '2026-11-22', daysUntil: 4, isLate: false, daysLate: 0, ...patch.next },
    today: { date: TODAY, cycleDay: 24, phase: 'luteal', isPeriodDay: false, periodDay: null, openPeriod: false, ...patch.today },
    projections: [],
  } as unknown as CycleAnalysis;
}

const ctx = { showFertility: true, periodLength: 5 };
const ids = (list: { id: string }[]) => list.map((r) => r.id);

describe('planReminders: period due', () => {
  it('nudges on the estimated day with an "It started" button, and follows up three days later', () => {
    const plan = planReminders(reminders({ periodDue: { enabled: true } }), analysis(), TODAY, ctx);
    const due = plan.find((r) => r.id === 'period-due')!;
    assert.deepEqual(due.at, { date: '2026-11-20', hour: 9, minute: 0 });
    assert.equal(due.url, '/quick/period-start');
    assert.equal(due.category, 'period-due');
    assert.deepEqual(plan.find((r) => r.id === 'period-late')?.at, { date: '2026-11-23', hour: 9, minute: 0 });
  });

  it('stays neutral and has no buttons when discreet', () => {
    const plan = planReminders(reminders({ periodDue: { enabled: true }, discreet: true }), analysis(), TODAY, ctx);
    for (const r of plan) {
      assert.ok(!/period|fertil/i.test(`${r.title} ${r.body}`), r.body);
      assert.equal(r.category, undefined);
    }
  });

  it('skips both once a period is logged', () => {
    const plan = planReminders(
      reminders({ periodDue: { enabled: true } }),
      analysis({ today: { isPeriodDay: true, periodDay: 1, openPeriod: true } }),
      TODAY,
      ctx,
    );
    assert.deepEqual(ids(plan), []);
  });
});

describe('planReminders: during a period', () => {
  const onDay2 = analysis({ today: { isPeriodDay: true, periodDay: 2, openPeriod: true } });

  it('asks how you feel each remaining evening, then whether it ended', () => {
    const plan = planReminders(reminders({ periodCare: { enabled: true, hour: 19 } }), onDay2, TODAY, ctx);
    assert.deepEqual(ids(plan), [
      'period-care-2026-11-16',
      'period-care-2026-11-17',
      'period-care-2026-11-18',
      'period-care-2026-11-19',
      'period-ended',
    ]);
    assert.match(plan[0].title, /Period day 2/);
    assert.equal(plan[0].url, '/log/2026-11-16');
    assert.deepEqual(plan[4].at, { date: '2026-11-20', hour: 19, minute: 0 });
  });

  it('skips tonight once flow is logged, and leaves the evening to the daily check-in when that is on', () => {
    const logged = planReminders(reminders({ periodCare: { enabled: true, hour: 19 } }), onDay2, TODAY, {
      ...ctx,
      days: { [TODAY]: { date: TODAY, flow: 'medium', symptoms: [], moods: [], updatedAt: '' } },
    });
    assert.ok(!ids(logged).includes('period-care-2026-11-16'));

    const withDaily = planReminders(
      reminders({ periodCare: { enabled: true, hour: 19 }, dailyCheckIn: { enabled: true, hour: 20, minute: 0 } }),
      onDay2,
      TODAY,
      ctx,
    );
    assert.deepEqual(ids(withDaily), ['check-in', 'period-ended']);
  });

  it('does not ask "has it ended?" when the last day is already logged', () => {
    const closed = analysis({ today: { isPeriodDay: true, periodDay: 2, openPeriod: false } });
    const plan = planReminders(reminders({ periodCare: { enabled: true, hour: 19 } }), closed, TODAY, ctx);
    assert.ok(!ids(plan).includes('period-ended'));
  });
});

describe('planReminders: older settings', () => {
  it('tolerates reminders saved before period care existed', () => {
    const old = { ...reminders(), periodCare: undefined, periodDue: undefined } as unknown as Reminders;
    assert.doesNotThrow(() => planReminders(old, analysis(), TODAY, ctx));
  });
});
