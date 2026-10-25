// Your own punches, labelled by you, teach the reader what they look like on your camera.
// Nearest neighbours over the measurements behind each punch: it copes with the camera being in a
// different place each session, because similar setups sit near each other.

export const KIND_OF = { jab: 'straight', cross: 'straight', leadHook: 'hook', rearHook: 'hook', leadUppercut: 'uppercut', rearUppercut: 'uppercut' };
const MAX = 800; // examples kept (newest)
const MIN = 20; // before it's worth trying
const K = 5;
const MIN_CLASS = 3; // a kind taught fewer times than this is never predicted (falls back to built-in)
const MIN_SHARE = 0.6; // and a close vote keeps the built-in reading

// Version of the measurements. 2: an uppercut's rise is measured from the bottom of its dip
// (before, uppercuts that dipped first measured almost no rise and looked like hooks).
const FEAT_V = 2;
// Before version 2 a bent arm's rise was measured differently (uppercuts and hooks that dip):
// those examples would teach the wrong thing. Straight-arm ones are unchanged and kept.
const current = (x) => x && x.kind && (x.v >= 2 || x.angle >= 140);

const vec = (x) => [x.ext, x.angle / 180, x.rise, x.fwd, x.lat, x.e2, x.a2 / 180, x.dx, x.dy, Math.min(3, x.fore) / 3, x.side];
const finite = (x) => vec(x).every(Number.isFinite); // a damaged saved example is skipped, never measured

// One labelled punch from a detection event. kind: straight / hook / uppercut / none (not a punch).
export function example(e, kind) {
  const r = (v) => Math.round((v || 0) * 1000) / 1000;
  return {
    kind, base: e.baseKind || null, v: FEAT_V,
    ext: r(e.f.ext), angle: Math.round(e.f.angle), rise: r(e.f.rise), fwd: r(e.fwd), lat: r(e.lat),
    e2: r(e.i2?.ext), a2: Math.round(e.i2?.angle || 0), dx: r(e.i2?.dx), dy: r(e.i2?.dy), fore: r(e.i2?.fore ?? 1),
    side: r(e.face ? Math.abs(e.face[0]) : 0.5),
    // The camera spot it was filmed from (see FormAnalyzer setup): tilt in degrees and how long
    // the legs look next to the torso (a phone on the floor makes legs look long).
    tilt: e.setup?.tilt ?? null, ratio: e.setup?.ratio ?? null,
  };
}

// Same camera spot: similar height (leg/torso look), facing and tilt. What you taught it from the
// floor isn't used from chest height, and the other way round.
export function setupNear(x, s) {
  if (!x || !s || x.ratio == null || s.ratio == null) return false;
  if (Math.abs(x.ratio - s.ratio) > 0.35) return false;
  if (Math.abs((x.side ?? 0.5) - (s.side ?? 0.5)) > 0.35) return false;
  return x.tilt == null || s.tilt == null || Math.abs(x.tilt - s.tilt) <= 12;
}

// How well your taught punches from this spot are read (for the summary), used or not.
export const spotModel = (labels, setup) => trainPersonal((labels || []).filter((x) => setupNear(x, setup)));

// The reader for this camera spot: trained only on punches taught from a similar spot, and only
// used when it beats the built-in reader on them. Cached per spot.
let spots = { src: null, map: new Map() };
export function readerFor(labels, setup) {
  if (!labels?.length || !setup || setup.ratio == null) return null;
  if (spots.src !== labels) spots = { src: labels, map: new Map() };
  const key = `${Math.round(setup.ratio * 10)}|${Math.round((setup.side ?? 0.5) * 5)}|${setup.tilt == null ? '-' : Math.round(setup.tilt / 4)}`;
  if (!spots.map.has(key)) {
    const m = trainPersonal(labels.filter((x) => setupNear(x, setup)));
    spots.map.set(key, m?.use ? m : null);
  }
  return spots.map.get(key);
}

// Examples from a reviewed video: every punch you labelled, fixed, confirmed or unticked.
export function harvest(events) {
  return events.filter((e) => e.kind === 'punch' && e.f && (e.labelled || e.edited))
    .map((e) => example(e, e.keep ? KIND_OF[e.fix] : 'none'));
}

// g: which batch (a punch test, a reviewed video) the examples came from, so checking the reader
// never lets a punch vouch for its near-twins from the same session.
export const addExamples = (old = [], add = [], g = Date.now().toString(36)) => [...(Array.isArray(old) ? old : []), ...add.map((x) => ({ g, ...x }))].slice(-MAX);

export function trainPersonal(examples) {
  const xs = (Array.isArray(examples) ? examples : []).filter((x) => current(x) && finite(x));
  if (xs.length < MIN || new Set(xs.map((x) => x.kind)).size < 2) return null;
  const perKind = {};
  for (const x of xs) perKind[x.kind] = (perKind[x.kind] || 0) + 1;
  const raw = xs.map(vec);
  const d = raw[0].length;
  const mean = Array.from({ length: d }, (_, j) => raw.reduce((a, v) => a + v[j], 0) / raw.length);
  const sd = Array.from({ length: d }, (_, j) => Math.sqrt(raw.reduce((a, v) => a + (v[j] - mean[j]) ** 2, 0) / raw.length) || 1);
  const pts = raw.map((v) => v.map((x, j) => (x - mean[j]) / sd[j]));
  const vote = (p, skip = () => false) => {
    const near = pts.map((q, i) => [skip(i) ? Infinity : q.reduce((a, x, j) => a + (x - p[j]) ** 2, 0), i]).sort((a, b) => a[0] - b[0]).slice(0, K);
    const tally = {};
    for (const [dist, i] of near) if (dist < Infinity) tally[xs[i].kind] = (tally[xs[i].kind] || 0) + 1 / (1 + Math.sqrt(dist));
    const total = Object.values(tally).reduce((a, b) => a + b, 0) || 1;
    const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    if (!top) return { kind: null, share: 0 };
    const [kind, w] = top;
    // Too few examples of that kind, or a close vote: no say (the built-in reading stands).
    if ((perKind[kind] || 0) < MIN_CLASS || w / total < MIN_SHARE) return { kind: null, share: w / total };
    return { kind, share: w / total };
  };
  // Checked on punches it hasn't seen: each one is read without its own batch (session) when the
  // examples come from 2+ batches, else without itself. A wrong or skipped call counts as wrong;
  // the built-in reading is scored on exactly the same punches.
  const groups = new Set(xs.map((x) => x.g ?? null));
  const grouped = groups.size >= 2 && !groups.has(null);
  let right = 0, baseRight = 0, baseN = 0, fallback = 0;
  pts.forEach((p, i) => {
    const v = vote(p, grouped ? (k) => xs[k].g === xs[i].g : (k) => k === i);
    const said = v.kind ?? xs[i].base; // no say: the built-in reading
    if (!v.kind) fallback++;
    if (said === xs[i].kind) right++;
    if (xs[i].base) { baseN++; if (xs[i].base === xs[i].kind) baseRight++; }
  });
  const acc = right / xs.length;
  // "Not a punch" labels the built-in reader never gets right, so compare over all labels.
  const baseAcc = baseN ? baseRight / xs.length : 0;
  return {
    n: xs.length, acc: Math.round(acc * 100) / 100, baseAcc: Math.round(baseAcc * 100) / 100, grouped,
    // Within one session the check is easier (near-identical punches), so it must win by more.
    use: acc >= 0.6 && acc >= baseAcc + (grouped ? 0.05 : 0.1),
    predict: (x) => (finite(x) ? vote(vec(x).map((v, j) => (v - mean[j]) / sd[j])) : { kind: null, share: 0 }),
  };
}

// Trained once per set of labels.
let memo = { src: null, model: null };
export function personalFor(profile) {
  const src = profile?.punchLabels || null;
  if (memo.src !== src) memo = { src, model: src ? trainPersonal(src) : null };
  return memo.model;
}
