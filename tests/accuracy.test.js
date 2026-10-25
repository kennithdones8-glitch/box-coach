import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { scoreClips, pooled } from '../scripts/accuracy.mjs';
import { typeReport, priorBaseline, matchEvents, countCheck } from '../scripts/evaluate.mjs';
import { TYPE_PRECISION, typeTrusted } from '../web/js/trust.js';
import { PUNCH_DIGIT } from '../web/js/form.js';

const { clips } = JSON.parse(fs.readFileSync(new URL('./fixtures/clips.json', import.meta.url)));

// Accuracy on the boxer's real clips may only go up. When a change improves it, raise the floor.
const MIN_N = { 'chest-front-test': 30 }; // labelled punches each clip must keep
const FLOOR = { 'pads-side-on': 23, 'shadow-front-on': 58, 'chest-front-test': 90 };

test('punch types on real labelled clips never get worse', () => {
  for (const s of scoreClips(clips)) {
    assert.ok(s.n >= (MIN_N[s.name] ?? 40), `${s.name}: ${s.n} labelled punches`);
    assert.ok(s.pct >= FLOOR[s.name], `${s.name}: ${s.pct}% right, floor ${FLOOR[s.name]}%`);
  }
});

test('the trust table matches what the labelled front-on clips measure', () => {
  const front = pooled(clips).camera.front.report;
  for (const [type, t] of Object.entries(TYPE_PRECISION)) {
    const c = front.classes[String(PUNCH_DIGIT[type])];
    assert.equal(t.called, c.predicted, `${type}: called ${c.predicted} times on labelled front clips (update trust.js)`);
    if (c.precision == null) assert.equal(t.precision, null, type);
    else assert.ok(Math.abs(t.precision - c.precision) <= 1, `${type}: measured ${c.precision}%, trust.js says ${t.precision}%`);
  }
  // Side-on, types are worse than a fixed guess: that's why side-on sessions don't count toward the mix.
  const side = pooled(clips).camera.side;
  assert.ok(side.report.accuracy < side.baseline.accuracy, 'if side-on types ever beat the baseline, revisit typesOk');
  assert.deepEqual(['jab', 'cross', 'leadHook', 'rearHook', 'leadUppercut', 'rearUppercut'].filter(typeTrusted), ['jab', 'cross', 'leadHook']);
});

test('evaluation: unlabelled rows are never scored, empty classes have no recall', () => {
  const r = typeReport([
    { truth: '1', pred: '1', hand: 'lead' }, { truth: '1', pred: '3', hand: 'lead' },
    { truth: '2', pred: '4', hand: 'rear' }, { truth: null, pred: '2', hand: 'rear' },
  ]);
  assert.equal(r.n, 3);
  assert.equal(r.unlabelled, 1);
  assert.equal(r.accuracy, 33.3);
  assert.deepEqual([r.classes[1].precision, r.classes[1].recall], [100, 50]);
  assert.equal(r.classes[2].recall, 0);
  assert.equal(r.classes[2].precision, null, 'never predicted: precision unknown, not 0');
  assert.equal(r.classes[5].recall, null, 'no labelled lead uppercuts: no recall at all');
  assert.equal(r.classes[4].precision, 0, 'every rear hook called was wrong');
  assert.equal(r.confusion[2][4], 1);
  assert.equal(priorBaseline([{ truth: '1', pred: '3', hand: 'lead' }, { truth: '4', pred: '4', hand: 'rear' }]).accuracy, 50);
});

test('evaluation: detections are matched to labelled punches one to one, in time', () => {
  const truth = [{ t: 1000, type: '1' }, { t: 2000, type: '2' }, { t: 5000, type: '3' }];
  // Two detections on the first punch (a double count), one on time, one extra, one missed.
  const pred = [{ t: 980, type: '1', hand: 'lead' }, { t: 1100, type: '1', hand: 'lead' }, { t: 2050, type: '4', hand: 'rear' }, { t: 3500, type: '2', hand: 'rear' }];
  const m = matchEvents(pred, truth, 250);
  assert.equal(m.matched.length, 2);
  assert.equal(m.matched[0].pred.t, 980, 'the closer detection wins');
  assert.equal(m.falseDetections.length, 2, 'the double count and the extra are false detections');
  assert.equal(m.missed.length, 1);
  assert.equal(m.precision, 50);
  assert.equal(m.recall, 66.7);
  assert.equal(m.types.n, 2);
  assert.equal(m.types.accuracy, 50);
  assert.deepEqual(countCheck(65, [45, 50]), { counted: 65, lo: 45, hi: 50, within: false, off: 15, offPct: 30 });
  assert.equal(countCheck(47, [45, 50]).within, true);
});
