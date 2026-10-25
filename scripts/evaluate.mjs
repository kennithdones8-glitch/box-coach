// Evaluation maths for punch detection: per-class precision / recall / F1, confusion matrices,
// a fixed baseline to beat, and one-to-one matching of detected punches to labelled ones in time.
// Pure functions, used by scripts/accuracy.mjs and the tests.
//
// Rules: a detection without a true label is "unlabelled", never counted right or wrong; each
// labelled punch can be matched by at most one detection (overlapping detections can't inflate
// the score); classes with no labelled examples get no recall (null, not 0 or 100).

export const CLASSES = ['1', '2', '3', '4', '5', '6'];
export const CLASS_NAME = { 1: 'jab', 2: 'cross', 3: 'lead hook', 4: 'rear hook', 5: 'lead upper', 6: 'rear upper' };
export const HAND_OF = { 1: 'lead', 3: 'lead', 5: 'lead', 2: 'rear', 4: 'rear', 6: 'rear' };
const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : null);

// pairs: [{ truth: '1'..'6' or null (unlabelled), pred: '1'..'6', hand: 'lead' | 'rear' }]
export function typeReport(pairs) {
  const labelled = pairs.filter((p) => p.truth != null && CLASSES.includes(String(p.truth)));
  const confusion = Object.fromEntries(CLASSES.map((t) => [t, Object.fromEntries(CLASSES.map((q) => [q, 0]))]));
  for (const p of labelled) confusion[p.truth][p.pred]++;
  const classes = {};
  for (const c of CLASSES) {
    const tp = confusion[c][c];
    const support = CLASSES.reduce((a, q) => a + confusion[c][q], 0);
    const predicted = CLASSES.reduce((a, t) => a + confusion[t][c], 0);
    const precision = predicted ? tp / predicted : null, recall = support ? tp / support : null;
    const f1 = precision != null && recall != null && precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : support || predicted ? 0 : null;
    classes[c] = { support, predicted, tp, precision: precision == null ? null : pct(tp, predicted), recall: recall == null ? null : pct(tp, support), f1: f1 == null ? null : Math.round(f1 * 1000) / 10 };
  }
  const correct = labelled.filter((p) => p.pred === p.truth).length;
  const scored = CLASSES.filter((c) => classes[c].support);
  const withHand = labelled.filter((p) => p.hand);
  return {
    n: labelled.length,
    unlabelled: pairs.length - labelled.length,
    correct,
    accuracy: pct(correct, labelled.length),
    // Over the classes that have labelled examples: one weak class can't hide behind a common one.
    macroF1: scored.length ? Math.round((scored.reduce((a, c) => a + classes[c].f1, 0) / scored.length) * 10) / 10 : null,
    handAgree: pct(withHand.filter((p) => HAND_OF[p.truth] === p.hand).length, withHand.length),
    classes,
    confusion,
  };
}

// A fixed, untrained guess to beat: every lead-hand punch is a jab, every rear-hand one a cross.
// If the classifier can't beat this, its punch types shouldn't be shown as facts.
export function priorBaseline(pairs) {
  return typeReport(pairs.map((p) => ({ ...p, pred: p.hand === 'lead' ? '1' : '2' })));
}

// Pair detections with labelled punches in time, closest first, each used once.
// pred / truth: [{ t (ms), type? }]. tol: how far apart (ms) still counts as the same punch.
export function matchEvents(pred, truth, tol = 250) {
  const cand = [];
  pred.forEach((p, i) => truth.forEach((q, j) => { const d = Math.abs(p.t - q.t); if (d <= tol) cand.push([d, i, j]); }));
  cand.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  const usedP = new Set(), usedT = new Set(), matched = [];
  for (const [d, i, j] of cand) {
    if (usedP.has(i) || usedT.has(j)) continue;
    usedP.add(i); usedT.add(j);
    matched.push({ pred: pred[i], truth: truth[j], dt: d });
  }
  const falseDetections = pred.filter((_, i) => !usedP.has(i));
  const missed = truth.filter((_, j) => !usedT.has(j));
  return {
    matched, falseDetections, missed,
    precision: pct(matched.length, pred.length), recall: pct(matched.length, truth.length),
    types: typeReport(matched.filter((m) => m.truth.type && m.pred.type).map((m) => ({ truth: m.truth.type, pred: m.pred.type, hand: m.pred.hand }))),
  };
}

// A count against a range counted by hand (e.g. "45-50 real punches").
export function countCheck(counted, [lo, hi]) {
  const within = counted >= lo && counted <= hi;
  const off = within ? 0 : counted > hi ? counted - hi : counted - lo;
  return { counted, lo, hi, within, off, offPct: within ? 0 : pct(off, off > 0 ? hi : lo) };
}
