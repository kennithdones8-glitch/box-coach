import test from 'node:test';
import assert from 'node:assert/strict';
import { badges, newBadges, weekStreak } from '../web/js/badges.js';

const at = (d, extra = {}) => ({ id: d, date: new Date(`${d}T18:00:00`).toISOString(), type: 'shadow', workSec: 540, completedRounds: 3, plan: { rounds: 3, roundSec: 180 }, punches: { total: 300 }, ...extra });

test('weekly streak: weeks in a row at your training days; rest days never break it', () => {
  // Mon 2026-09-14 week: 3 days; next week: 3 days; this week (Mon 28th): 1 day so far.
  const s = ['2026-09-14', '2026-09-16', '2026-09-18', '2026-09-21', '2026-09-23', '2026-09-26', '2026-09-28'].map((d) => at(d));
  const now = new Date('2026-09-29T12:00:00');
  assert.equal(weekStreak(s, 3, now), 2, 'this week not hit yet: the streak still stands');
  assert.equal(weekStreak([...s, at('2026-09-29'), at('2026-09-30')], 3, now), 3);
  assert.equal(weekStreak(s.slice(3), 3, now), 1, 'a short week before breaks it');
});

test('badges are earned from the log, with the date, and the summary shows only new ones', () => {
  const s = Array.from({ length: 9 }, (_, i) => at(`2026-09-${String(10 + i).padStart(2, '0')}`));
  const b = Object.fromEntries(badges(s, { weeklyGoal: 3 }).map((x) => [x.id, x]));
  assert.ok(b.sessions1.earned);
  assert.equal(b.sessions10.earned, null);
  assert.equal(b.sessions10.have, 9);
  assert.ok(b.punches1000.earned, '9 × 300 punches');
  const fresh = newBadges(s, at('2026-09-20'), { weeklyGoal: 3 }).map((x) => x.id);
  assert.ok(fresh.includes('sessions10'));
  assert.ok(!fresh.includes('sessions1'));
  // A punch test with 85% read right earns "Dialled in"; manual logs add no punches.
  const t = badges([at('2026-09-01', { test: { typePct: 85 } }), at('2026-09-02', { source: 'manual', punches: { total: 5000 } })], {});
  assert.ok(t.find((x) => x.id === 'tested').earned);
  assert.equal(t.find((x) => x.id === 'punches1000').have, 300);
});

test('share card: the session in four big numbers, with its name and new badges', async () => {
  const { cardData } = await import('../web/js/sharecard.js');
  const d = cardData({ date: '2026-10-04T18:00:00Z', type: 'shadow', completedRounds: 6, workSec: 1080, punches: { total: 1240 }, form: { guard: 88, speed: 3.9 } },
    { name: 'Head movement', unit: 'lb', badges: [{ icon: '👊', name: '10,000 punches' }] });
  assert.equal(d.title, 'Head movement');
  assert.deepEqual(d.stats.map((x) => x[1]), ['rounds', 'punches', 'per minute', 'hands up']);
  assert.deepEqual(d.stats[1], ['1,240', 'punches']);
  assert.equal(d.sub, '18 min of work');
  assert.deepEqual(d.badges, ['👊 10,000 punches']);
});

test('streak badges: consecutive weeks at your training days; a short week starts again', () => {
  const day = (w, d) => at(new Date(Date.UTC(2026, 6, 6 + w * 7 + d)).toISOString().slice(0, 10)); // Mondays from Jul 6
  const weeks = (n, from = 0) => Array.from({ length: n }, (_, w) => [0, 2, 4].map((d) => day(from + w, d))).flat();
  const b = (s) => Object.fromEntries(badges(s, { weeklyGoal: 3 }).map((x) => [x.id, x]));
  assert.ok(b(weeks(5)).weeks5.earned);
  assert.equal(b(weeks(4)).weeks5.earned, null);
  // 3 weeks, a week off, 3 more: best is 3.
  const gap = [...weeks(3), ...weeks(3, 4)];
  assert.ok(b(gap).weeks3.earned);
  assert.equal(b(gap).weeks5.have, 3);
});
