import test from 'node:test';
import assert from 'node:assert/strict';
import { judgeDefense, defenseSummary, nextDefCall } from '../web/js/defense.js';

test('defense drill: a call counts when the right move follows in time, each move answers one call', () => {
  const calls = [{ t: 1000, move: 'slip' }, { t: 5000, move: 'roll' }, { t: 9000, move: 'block' }, { t: 13000, move: 'slip' }];
  const log = [{ t: 1600, move: 'slip' }, { t: 5400, move: 'slip' }, { t: 9200, move: 'block' }, { t: 15000, move: 'slip' }];
  const r = judgeDefense(calls, log);
  assert.deepEqual(r.slip, { called: 2, done: 1 }, 'second slip came 2 s late');
  assert.deepEqual(r.roll, { called: 1, done: 0 }, 'slipped instead of rolling');
  assert.deepEqual(r.block, { called: 1, done: 1 });
  const s = defenseSummary([r, r]);
  assert.equal(s.called, 8);
  assert.equal(s.pct, 50);
});

test('defense calls are random but never the same move three times running', () => {
  for (let i = 0; i < 50; i++) assert.notEqual(nextDefCall(['roll', 'roll'], Math.random), 'roll');
  assert.equal(nextDefCall([], () => 0), 'slip');
});
