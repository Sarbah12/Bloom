import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { activeMeds, adherence, medHistory } from './meds.ts';

describe('medication history', () => {
  const med = { id: 'm1', name: 'Iron', createdAt: '2026-11-05T09:00:00Z' };
  const days = { '2026-11-06': { medsTaken: ['m1'] }, '2026-11-08': { medsTaken: ['m1', 'm2'] }, '2026-11-09': { medsTaken: ['m2'] } };

  it('counts only days since the medication was added', () => {
    const h = medHistory(med, days, '2026-11-10', '2026-11-05', 10);
    assert.equal(h.length, 10);
    assert.equal(h[0].taken, null);
    assert.deepEqual(adherence(h), { taken: 2, total: 6 });
  });

  it('hides removed medications', () => {
    assert.deepEqual(
      activeMeds([med, { ...med, id: 'm2', name: 'Pill', deletedAt: 'x' }, { ...med, id: 'm3', name: 'Aspirin' }]).map((m) => m.name),
      ['Aspirin', 'Iron'],
    );
  });
});
