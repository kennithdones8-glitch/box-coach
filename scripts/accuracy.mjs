// How well the punch classifier reads real, labelled clips (tests/fixtures/clips.json).
// Run: npm run accuracy  (add --json for the full report)
// Each clip row is a punch the app detected, with the true punch number, or "." when nobody
// labelled it. Unlabelled rows are reported, never scored. Detection (missed / extra punches)
// can't be scored from these rows: they only hold what was detected. See scripts/evaluate.mjs.
import fs from 'fs';
import { classifyFeatures, PUNCH_TYPE, PUNCH_DIGIT } from '../web/js/form.js';
import { typeReport, priorBaseline, CLASSES, CLASS_NAME } from './evaluate.mjs';

export function clipPairs(c, cal = null) {
  return c.punches.map(([hand, label, ext, angle, rise, lat, fwd]) => {
    const role = hand === 'L' ? 'lead' : 'rear';
    const pred = String(PUNCH_DIGIT[PUNCH_TYPE[classifyFeatures({ ext, angle, rise, role }, fwd, lat, cal).kind][role]]);
    return { truth: label === '.' ? null : label, pred, hand: role };
  });
}

export function scoreClips(clips, cal = null) {
  return clips.map((c) => {
    const pairs = clipPairs(c, cal);
    const report = typeReport(pairs);
    const confusion = {};
    for (const p of pairs) if (p.truth && p.truth !== p.pred) confusion[`${p.truth}→${p.pred}`] = (confusion[`${p.truth}→${p.pred}`] || 0) + 1;
    return {
      name: c.name, camera: c.camera, labels: c.labels, n: report.n, right: report.correct,
      pct: report.n ? Math.round((report.correct / report.n) * 100) : null, confusion,
      report, baseline: priorBaseline(pairs),
    };
  });
}

// Everything pooled, and by camera angle.
export function pooled(clips, cal = null) {
  const by = {};
  for (const c of clips) (by[c.camera] ||= []).push(...clipPairs(c, cal));
  const all = Object.values(by).flat();
  return {
    all: { report: typeReport(all), baseline: priorBaseline(all) },
    camera: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, { report: typeReport(v), baseline: priorBaseline(v) }])),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { clips } = JSON.parse(fs.readFileSync(new URL('../tests/fixtures/clips.json', import.meta.url)));
  const scores = scoreClips(clips), pool = pooled(clips);
  if (process.argv.includes('--json')) { console.log(JSON.stringify({ clips: scores, pooled: pool }, null, 1)); process.exit(0); }
  const f = (v) => (v == null ? '  –' : String(Math.round(v)).padStart(3));
  console.log('Punch TYPE accuracy on detected, labelled punches (unlabelled rows are not scored)\n');
  console.log('clip               camera  labels  n   right  macroF1  hand  | baseline (lead=jab, rear=cross)');
  for (const s of scores) {
    console.log(`${s.name.padEnd(18)} ${s.camera.padEnd(7)} ${s.labels.padEnd(7)} ${String(s.n).padStart(3)} ${f(s.report.accuracy)}%   ${f(s.report.macroF1)}     ${f(s.report.handAgree)}% | ${f(s.baseline.accuracy)}%${s.report.accuracy < s.baseline.accuracy ? '  ← worse than the baseline' : ''}   (${s.report.unlabelled} unlabelled)`);
  }
  for (const [name, r] of [['ALL', pool.all], ...Object.entries(pool.camera).map(([k, v]) => [`camera: ${k}`, v])]) {
    console.log(`\n${name}: ${r.report.accuracy}% right of ${r.report.n} (baseline ${r.baseline.accuracy}%), macro-F1 ${r.report.macroF1}`);
    console.log('  class        support  pred  precision  recall  F1');
    for (const c of CLASSES) {
      const k = r.report.classes[c];
      if (!k.support && !k.predicted) continue;
      console.log(`  ${`${c} ${CLASS_NAME[c]}`.padEnd(13)} ${String(k.support).padStart(5)} ${String(k.predicted).padStart(5)}   ${f(k.precision)}%     ${f(k.recall)}%   ${f(k.f1)}`);
    }
    const conf = CLASSES.flatMap((t) => CLASSES.filter((p) => p !== t && r.report.confusion[t][p]).map((p) => [`${t}→${p}`, r.report.confusion[t][p]])).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (conf.length) console.log(`  top mistakes: ${conf.map(([k, v]) => `${k} ×${v}`).join(', ')}`);
  }
}
