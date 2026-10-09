import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recentForm, sparkline } from '../web/js/trends.js';

const s = (d, form, extra = {}) => ({ date: `2026-10-0${d}T10:00:00Z`, type: 'shadow', workSec: 600, punches: { total: 500 }, form, ...extra });

test('recent form: latest well-measured session against the ones before, honest about thin data', () => {
  const rows = recentForm([
    s(1, { guard: 60, handReturnMs: 400 }), s(2, { guard: 62, handReturnMs: 380 }), s(3, { guard: 64, handReturnMs: 390 }),
    s(4, { guard: 20 }, { calib: { frames: 400, tracked: 100 } }), // badly tracked: ignored
    s(5, { guard: 75, handReturnMs: 340 }),
  ]);
  const by = Object.fromEntries(rows.map((r) => [r.key, r]));
  assert.equal(by.guard.last, 75);
  assert.equal(by.guard.usual, 62);
  assert.equal(by.guard.trend, 'up');
  assert.equal(by.guard.n, 4, 'the badly tracked session is left out');
  assert.equal(by.returnMs.trend, 'up', 'a faster hand return is better');
  assert.equal(by.ppm.last, 50);
  assert.equal(by.ppm.trend, 'flat');
  // Punch rate only against the same kind of session.
  const mixed = recentForm([s(1, null, { type: 'bag', punches: { total: 1200 } }), s(2, null)]);
  assert.equal(mixed.find((r) => r.key === 'ppm').trend, null, 'one shadow session, one bag: no comparison');
  // One session: a number, no claim.
  const one = recentForm([s(1, { guard: 70 })]).find((r) => r.key === 'guard');
  assert.deepEqual([one.last, one.trend], [70, null]);
  assert.equal(sparkline([1]), '');
  assert.match(sparkline([1, 3, 2]), /<svg class="spark"/);
});
