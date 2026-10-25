import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POSES, MOVES, poseAt, joints, moveLength, figureSVG, calloutSVG } from '../web/js/figure.js';
import { drillScene, recapSlides, punchSlides } from '../web/js/breakdowns.js';
import { allDrills } from '../web/js/drills.js';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

test('figures: every move uses real poses; feet stay planted and limbs keep their length', () => {
  for (const [name, seq] of Object.entries(MOVES)) for (const [pose] of seq) assert.ok(POSES[pose], `${name}: ${pose}`);
  for (const [name, p] of Object.entries(POSES)) {
    const j = joints(p);
    assert.ok(Math.abs(dist(j.fHip, j.fK) - 44) < 0.5 && Math.abs(dist(j.fK, j.fF) - 43) < 1.5, `${name}: front leg`);
    assert.ok(Math.abs(dist(j.fS, j.fE) - 31) < 0.01, `${name}: arm`);
    assert.ok(j.fK[0] >= Math.min(j.fHip[0], j.fF[0]) - 1, `${name}: knee bends forward`);
    assert.ok(!figureSVG(p).includes('NaN'), name);
  }
  // Tweening: halfway through a move is between its poses, and it loops.
  assert.deepEqual(poseAt('jab', 0), poseAt('jab', moveLength('jab')));
  const mid = poseAt('jab', 500 + 65);
  assert.ok(mid.fa[0] > POSES.guard.fa[0] && mid.fa[0] < POSES.jab.fa[0]);
  // Callouts flip to stay inside the scene.
  assert.match(calloutSVG([340, 100], 'LONG LABEL HERE', { width: 360 }), /<rect x="(\d+)/);
  const x = +calloutSVG([340, 100], 'LONG LABEL HERE', { width: 360 }).match(/<rect x="([\d.]+)/)[1];
  assert.ok(x < 340, 'points left near the right edge');
});

test('every drill has a demo scene', () => {
  for (const d of allDrills()) {
    const sc = drillScene(d);
    assert.ok(MOVES[sc.actors[0].move], `${d.id}: ${sc.actors[0].move}`);
    for (const c of sc.callouts) assert.ok(c.joint in joints(POSES.guard), `${d.id}: ${c.joint}`);
  }
});

test('recap shows only what was measured well', () => {
  const timerOnly = recapSlides({ completedRounds: 3, workSec: 540, source: 'manual' }, { name: 'Bag', xp: 50 });
  assert.equal(timerOnly.length, 2, 'rounds and XP only: no punches or guard without the camera');
  const cam = recapSlides({
    completedRounds: 3, workSec: 540, source: 'live', punches: { total: 400, byType: { jab: 200, cross: 200 } },
    calib: { frames: 1000, tracked: 950 }, form: { guard: 80 }, feedback: { fixes: ['Move your head after every combo.'], drills: [] },
  }, { name: 'Shadow', xp: 80, level: { level: 2, name: 'Novice', xp: 400, floor: 300, next: 800, pct: 20 } });
  assert.deepEqual(cam.map((s) => s.kicker), ['SHADOW · DONE', 'THE COUNT', 'THE GUARD', 'FIX NEXT', 'THE FIX', 'XP']);
  assert.equal(cam[1].bars.length, 2);
  const badTracking = recapSlides({ completedRounds: 3, workSec: 540, source: 'live', punches: { total: 400 }, calib: { frames: 1000, tracked: 300 } }, {});
  assert.ok(!badTracking.some((s) => s.kicker === 'THE COUNT'), 'a badly tracked session shows no count');
});

test('punch breakdown: problem, why, fix and a practise button', () => {
  const x = { type: 'jab', name: 'Jab', n: 900, share: 40, returnMs: 520, focus: [{ key: 'rearDrop', text: 'Rear hand drops on 30% of jabs' }] };
  const d = { name: 'Freeze-check jab', how: 'Jab at half speed and freeze. Then speed up.', cue: 'Glove on cheek' };
  let ran = false;
  const sl = punchSlides(x, d, { days: 30, run: () => { ran = true; } });
  assert.deepEqual(sl.map((s) => s.kicker), ['YOUR JAB · LAST 30 DAYS', 'THE PROBLEM', 'WHY IT MATTERS', 'THE FIX', 'PRACTISE IT']);
  assert.equal(sl[1].scene.actors[0].move, 'jabDrop');
  assert.equal(sl[2].scene.actors.length, 2, 'the partner shows why it matters');
  sl.at(-1).cta.run();
  assert.ok(ran);
});
