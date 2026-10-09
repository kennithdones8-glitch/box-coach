import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punchStats, drillsFor, PUNCH_DRILLS, TYPES } from '../web/js/punchstats.js';
import { parseCombo } from '../web/js/combos.js';

const now = new Date('2026-10-09T12:00:00Z');
const day = (n) => new Date(+now - n * 86400000).toISOString();
const sess = (n, byType, extra = {}) => ({ date: day(n), type: 'shadow', source: 'live', workSec: 540, punches: { total: Object.values(byType).reduce((a, b) => a + b, 0), byType }, ...extra });
const mix = (j, c, lh, rh, lu, ru) => ({ jab: j, cross: c, leadHook: lh, rearHook: rh, leadUppercut: lu, rearUppercut: ru });
const rows = (digit, speed, n) => Array.from({ length: n }, () => [digit, speed, 0.9, 160, 0, 0.1, 80, 0.2]);

test('punch stats: mix, per-punch speed and changes against the period before', () => {
  const sessions = [
    // Previous 30 days: slower jabs, more crosses.
    sess(45, mix(80, 80, 20, 10, 5, 5), { calib: { punches: rows(1, 4.0, 10) }, form: { leadReturnMs: 420, rearReturnMs: 400, rearDropPct: 35, comboShare: 50 } }),
    sess(40, mix(80, 80, 20, 10, 5, 5), { calib: { punches: rows(1, 4.0, 10) }, form: { leadReturnMs: 420, rearReturnMs: 400, rearDropPct: 35, comboShare: 50 } }),
    // This period: faster jabs, rear hand still dropping, hardly any uppercuts.
    sess(10, mix(120, 60, 15, 3, 1, 1), { calib: { punches: rows(1, 4.8, 12) }, form: { leadReturnMs: 380, rearReturnMs: 390, rearDropPct: 30, comboShare: 60 } }),
    sess(5, mix(120, 60, 15, 3, 1, 1), { calib: { punches: rows(1, 4.8, 12) }, form: { leadReturnMs: 380, rearReturnMs: 390, rearDropPct: 30, comboShare: 60 } }),
    // Left out: a punch test, a sparring clip with the partner in frame, a badly tracked session.
    sess(3, mix(10, 10, 10, 10, 10, 10), { test: { rows: [{ want: 'jab', n: 10, right: 9 }, { want: 'leadUppercut', n: 10, right: 4 }] } }),
    sess(2, mix(43, 0, 0, 0, 0, 0), { calib: { multi: 75 } }),
    sess(1, mix(300, 0, 0, 0, 0, 0), { calib: { frames: 400, tracked: 100 } }),
  ];
  const st = punchStats(sessions, { days: 30, now });
  assert.equal(st.sessions, 2, 'only the two well-measured sessions this period');
  assert.equal(st.total, 400);
  const jab = st.types.find((x) => x.type === 'jab');
  assert.equal(jab.share, 60);
  assert.equal(jab.shareDelta, 60 - 40);
  assert.equal(jab.speed, 4.8);
  assert.equal(jab.speedDelta, 0.8);
  assert.equal(jab.read, 90, 'camera read rate from the punch test');
  assert.ok(jab.focus.some((f) => f.key === 'rearDrop'), 'rear hand dropping on jabs');
  const lu = st.types.find((x) => x.type === 'leadUppercut');
  assert.ok(lu.focus.some((f) => f.key === 'underused'));
  assert.equal(lu.read, 40);
  assert.equal(st.types.find((x) => x.type === 'cross').speed, null, 'no speed from fewer than 5 punches');
  assert.ok(st.changes.some((c) => /Jab speed up 0.8/.test(c.text) && c.good));
  assert.ok(st.changes.some((c) => /Lead hand return -40 ms/.test(c.text) && c.good));
  assert.equal(st.focus, 'jab');
  // Nothing before: no changes claimed.
  const fresh = punchStats(sessions.slice(2), { days: 30, now });
  assert.equal(fresh.changes.length, 0);
  assert.equal(punchStats([], { now }).total, 0);
});

test('every punch has drills the coach can call, best fit for the problem first', () => {
  for (const t of [...TYPES, 'feints']) {
    assert.ok(PUNCH_DRILLS[t].length >= 3, t);
    for (const d of PUNCH_DRILLS[t]) for (const c of d.calls) assert.ok(parseCombo(c), `${t}: "${c}" can't be called`);
  }
  assert.equal(drillsFor('jab', [{ key: 'rearDrop' }])[0].name, 'Freeze-check jab');
  assert.equal(drillsFor('cross', [{ key: 'slowReturn' }])[0].name, 'Cross and home');
});
