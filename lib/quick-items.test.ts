import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { quickActionItems } from './quick-items.ts';

describe('quickActionItems', () => {
  it('shows only a neutral check-in when discreet', () => {
    const items = quickActionItems(true, false);
    assert.deepEqual(items.map((i) => i.type), ['check-in']);
    assert.ok(!JSON.stringify(items).toLowerCase().includes('period'));
  });

  it('offers the period action that fits today when not discreet', () => {
    assert.deepEqual(quickActionItems(false, false).map((i) => i.type), ['period-start', 'check-in', 'assistant']);
    assert.deepEqual(quickActionItems(false, true).map((i) => i.type), ['period-end', 'check-in', 'assistant']);
  });
});
