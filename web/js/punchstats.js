// Punch analysis: what you throw, how each punch is doing and how it's changing, and what to work
// on. Pure logic. Only numbers the camera measured well count (punchCountOk / trackingOk); punch
// tests are left out of the mix (they call each punch ten times). Every number carries how many
// sessions or punches it rests on, and nothing is called a change from thin evidence.
import { punchCountOk, trackingOk } from './coach.js';
import { PUNCH_NAMES } from './form.js';

export const TYPES = ['jab', 'cross', 'leadHook', 'rearHook', 'leadUppercut', 'rearUppercut'];
const DIGIT_TYPE = { 1: 'jab', 2: 'cross', 3: 'leadHook', 4: 'rearHook', 5: 'leadUppercut', 6: 'rearUppercut' };
const LEAD = new Set(['jab', 'leadHook', 'leadUppercut']);
const DAY = 86400000;
const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

// Sessions whose punch counts can be trusted for the mix.
const counted = (s) => s.punches?.byType && s.source !== 'manual' && !s.test && punchCountOk(s);

function period(sessions) {
  const cam = sessions.filter(counted);
  const byType = Object.fromEntries(TYPES.map((t) => [t, 0]));
  for (const s of cam) for (const t of TYPES) byType[t] += s.punches.byType[t] || 0;
  const total = TYPES.reduce((a, t) => a + byType[t], 0);
  const minutes = cam.reduce((a, s) => a + (s.workSec || 0) / 60, 0);
  // Fist speed per punch (m/s), from the per-punch rows kept on recent sessions.
  const speeds = Object.fromEntries(TYPES.map((t) => [t, []]));
  for (const s of cam) for (const row of s.calib?.punches || []) {
    const t = DIGIT_TYPE[row[0]];
    if (t && row[1] > 0 && row[1] < 14) speeds[t].push(row[1]);
  }
  const form = sessions.filter((s) => s.form && trackingOk(s) && !s.test);
  const f = (k) => avg(form.map((s) => s.form[k]).filter((v) => v != null && Number.isFinite(v)));
  const feintS = form.filter((s) => s.form.feintsPerMin != null);
  return {
    sessions: cam.length, total, byType, minutes,
    ppm: minutes ? Math.round(total / minutes) : null,
    speeds,
    leadReturn: f('leadReturnMs'), rearReturn: f('rearReturnMs'), rearDrop: f('rearDropPct'), comboShare: f('comboShare'),
    feintsPerMin: feintS.length ? r1(avg(feintS.map((s) => s.form.feintsPerMin))) : null,
    feints: feintS.reduce((a, s) => a + (s.form.feints || 0), 0),
    feintSetups: feintS.reduce((a, s) => a + (s.form.feintSetups || 0), 0),
    formSessions: form.length,
  };
}

// The latest punch test's read rate per punch: how far to trust the type counts.
function readRates(sessions) {
  const t = [...sessions].reverse().find((s) => s.test?.rows?.length);
  if (!t) return null;
  const out = {};
  for (const r of t.test.rows) if (r.want && r.n) out[r.want] = Math.round((100 * r.right) / r.n);
  return { date: t.date, rates: out };
}

const WEIGHT = { rearDrop: 3, slowReturn: 2, slower: 2, underused: 1 };
const weight = (x) => x.focus.reduce((a, f) => a + (WEIGHT[f.key] || 1), 0);

// days: the period looked at (null = everything); compared with the period of the same length before.
export function punchStats(sessions, { days = 30, now = new Date() } = {}) {
  const t = +now;
  const inRange = (a, b) => sessions.filter((s) => { const d = +new Date(s.date); return d > a && d <= b; });
  const cur = days ? inRange(t - days * DAY, t) : sessions.filter((s) => +new Date(s.date) <= t);
  const prev = days ? inRange(t - 2 * days * DAY, t - days * DAY) : [];
  const A = period(cur), B = period(prev);
  const reads = readRates(sessions);
  const types = TYPES.map((type) => {
    const n = A.byType[type], share = A.total ? Math.round((100 * n) / A.total) : null;
    const pShare = B.total >= 50 ? Math.round((100 * B.byType[type]) / B.total) : null;
    const sp = A.speeds[type].length >= 5 ? r1(median(A.speeds[type])) : null;
    const pSp = B.speeds[type].length >= 5 ? r1(median(B.speeds[type])) : null;
    const lead = LEAD.has(type);
    return {
      type, name: PUNCH_NAMES[type], lead, n, share,
      shareDelta: share != null && pShare != null && A.total >= 50 ? share - pShare : null,
      speed: sp, speedN: A.speeds[type].length, speedDelta: sp != null && pSp != null ? r1(sp - pSp) : null,
      returnMs: lead ? (A.leadReturn != null ? Math.round(A.leadReturn) : null) : (A.rearReturn != null ? Math.round(A.rearReturn) : null),
      read: reads?.rates[type] ?? null,
      focus: [],
    };
  });
  // What each punch needs, from the evidence (strongest first). Needs enough punches to say.
  const enough = A.total >= 100;
  const byKey = Object.fromEntries(types.map((x) => [x.type, x]));
  if (A.rearDrop != null && A.rearDrop > 25 && A.formSessions >= 2) byKey.jab.focus.push({ key: 'rearDrop', text: `Rear hand drops on ${Math.round(A.rearDrop)}% of your jabs` });
  for (const x of types) {
    if (enough && x.share != null && x.share < (x.type.includes('Uppercut') ? 3 : 6)) x.focus.push({ key: 'underused', text: `Only ${x.share}% of your punches` });
    if (x.speedDelta != null && x.speed && x.speedDelta <= -0.4) x.focus.push({ key: 'slower', text: `Slower than last period (${x.speedDelta} m/s)` });
    // Hand return is per hand, so it's flagged once: on the jab (lead) and the cross (rear).
    if ((x.type === 'jab' || x.type === 'cross') && x.returnMs != null && x.returnMs > 450 && A.formSessions >= 2) x.focus.push({ key: 'slowReturn', text: `${x.lead ? 'Lead' : 'Rear'} hand takes ${x.returnMs} ms to come home` });
  }
  // Improvements and slips against the period before, only from real comparisons.
  const changes = [];
  for (const x of types) {
    if (x.speedDelta != null && Math.abs(x.speedDelta) >= 0.3) changes.push({ text: `${x.name} speed ${x.speedDelta > 0 ? 'up' : 'down'} ${Math.abs(x.speedDelta)} m/s`, good: x.speedDelta > 0, size: Math.abs(x.speedDelta) / 0.3 });
    if (x.shareDelta != null && Math.abs(x.shareDelta) >= 4) changes.push({ text: `${x.name}: ${Math.abs(x.shareDelta)}% ${x.shareDelta > 0 ? 'more' : 'less'} of your output`, good: null, size: Math.abs(x.shareDelta) / 4 });
  }
  const cmp = (k, label, better, min) => {
    if (A[k] == null || B[k] == null || A.formSessions < 2 || B.formSessions < 2) return;
    const d = Math.round(A[k] - B[k]);
    if (Math.abs(d) >= min) changes.push({ text: `${label} ${d > 0 ? '+' : ''}${d}${k.endsWith('Return') ? ' ms' : '%'}`, good: d * better > 0, size: Math.abs(d) / min });
  };
  cmp('leadReturn', 'Lead hand return', -1, 30);
  cmp('rearReturn', 'Rear hand return', -1, 30);
  cmp('rearDrop', 'Rear hand dropping on jabs', -1, 5);
  cmp('comboShare', 'Punches in combinations', 1, 5);
  if (A.ppm != null && B.ppm != null && A.sessions >= 2 && B.sessions >= 2 && Math.abs(A.ppm - B.ppm) >= 4) changes.push({ text: `Output ${A.ppm - B.ppm > 0 ? '+' : ''}${A.ppm - B.ppm} punches/min`, good: A.ppm > B.ppm, size: Math.abs(A.ppm - B.ppm) / 4 });
  changes.sort((a, b) => b.size - a.size);
  return {
    days, sessions: A.sessions, prevSessions: B.sessions, total: A.total, ppm: A.ppm,
    comboShare: A.comboShare != null ? Math.round(A.comboShare) : null,
    feintsPerMin: A.feintsPerMin, feints: A.feints, feintSetups: A.feintSetups,
    leadReturn: A.leadReturn != null ? Math.round(A.leadReturn) : null, rearReturn: A.rearReturn != null ? Math.round(A.rearReturn) : null,
    rearDrop: A.rearDrop != null ? Math.round(A.rearDrop) : null,
    types, changes: changes.map(({ size, ...c }) => c), reads,
    // Technique problems come before "you rarely throw it"; among equals, the punch you throw most.
    focus: types.filter((x) => x.focus.length).sort((a, b) => weight(b) - weight(a) || b.n - a.n)[0]?.type || null,
  };
}

// Drills for each punch (and feints). calls: what the coach calls in a practice session (punch
// numbers: 1 jab, 2 cross, 3 lead hook, 4 rear hook, 5 lead uppercut, 6 rear uppercut).
export const PUNCH_DRILLS = {
  jab: [
    { name: 'Freeze-check jab', fixes: ['rearDrop', 'slowReturn'], how: 'Jab at half speed and freeze at full extension: rear glove on your cheek, chin behind the lead shoulder. Snap back, reset. 20 reps, then speed up.', cue: 'Rear hand glued to your face', calls: ['1', '1', '1, 1'] },
    { name: 'Step-jab in and out', fixes: ['underused', 'slower'], how: 'Step in as the jab lands, step out. Light feet, 2 minutes. The jab and the front foot land together.', cue: 'Foot and fist land together', calls: ['1', '1, step out', '1, 1, step out'] },
    { name: 'Jab variety', fixes: ['underused'], how: 'Rotate: single, double, body jab, jab-feint-jab. Never the same one twice in a row.', cue: 'Make him guess', calls: ['1', '1, 1', '1b', '1, 1, 1'] },
  ],
  cross: [
    { name: 'Pivot cross', fixes: ['slower', 'underused'], how: 'Turn the rear foot and hip through, as if squashing a bug. The power comes from the floor, not the arm.', cue: 'Rear heel turns out', calls: ['2', '1, 2', '1, 2, 1'] },
    { name: 'Cross and home', fixes: ['slowReturn'], how: '1-2 and freeze: lead hand on your cheek while the cross is out, then the cross comes back faster than it went.', cue: 'Back faster than out', calls: ['1, 2', '2', '1, 1, 2'] },
    { name: 'Body-head cross', fixes: ['underused'], how: 'Drop the level with the knees (not the waist) for a cross to the body, then come up with a cross to the head.', cue: 'Bend the knees, not the back', calls: ['1, 2b', '2b, 2', '1, 2b, 3'] },
  ],
  leadHook: [
    { name: 'Hook off the cross', fixes: ['underused', 'slower'], how: '1-2-3: the cross loads the lead hook. Turn the lead foot and hip, elbow at shoulder height, short arc.', cue: 'Turn the hip, not the arm', calls: ['1, 2, 3', '2, 3', '1, 2, 3, 2'] },
    { name: 'Check hook', fixes: ['underused'], how: 'Step back and turn with a lead hook as he comes in. Pivot on the lead foot as you throw.', cue: 'Turn him as you turn', calls: ['3, pivot', '1, 3, pivot', '3, step out'] },
    { name: 'Hook and home', fixes: ['slowReturn'], how: 'Throw the hook, then the glove goes straight back to the cheek, not down. 15 reps each side.', cue: 'Elbow back down, glove to cheek', calls: ['3', '3, 2', '1, 3'] },
  ],
  rearHook: [
    { name: 'Rear hook to the body', fixes: ['underused'], how: 'Level change, rear hook to the liver side, then up. Keep the lead hand on your face.', cue: 'Sit down on it', calls: ['4b', '1, 4b', '3, 4b, 3'] },
    { name: 'Rear hook after the hook', fixes: ['underused', 'slower'], how: '3-4: lead hook loads the rear hook. Short, tight, turn through.', cue: 'Short and tight', calls: ['3, 4', '1, 2, 3, 4', '4, 3, 2'] },
    { name: 'Rear hook and home', fixes: ['slowReturn'], how: 'Throw, then the rear glove goes straight back to the chin before anything else.', cue: 'Home before the next one', calls: ['4', '3, 4', '4, 3'] },
  ],
  leadUppercut: [
    { name: 'Uppercut inside', fixes: ['underused'], how: 'Dip slightly to the lead side, drive up from the legs: palm towards you, short.', cue: 'Legs, not arm', calls: ['5', '5, 2', '1, 5, 2'] },
    { name: 'Uppercut after a slip', fixes: ['underused', 'slower'], how: 'Slip outside his jab, come up with the lead uppercut, then a cross.', cue: 'Slip and rip', calls: ['Slip, 5, 2', '5, 2, 3', '1, slip, 5'] },
    { name: 'Uppercut and home', fixes: ['slowReturn'], how: 'Short uppercut, then straight back to guard: no dropping the hand to load it.', cue: "Don't wind it up", calls: ['5', '5, 3', '2, 5'] },
  ],
  rearUppercut: [
    { name: 'Rear uppercut off the hook', fixes: ['underused'], how: '3-6: the lead hook turns you, the rear uppercut comes up the middle.', cue: 'Turn and come up', calls: ['3, 6', '1, 6, 3', '3, 6, 3'] },
    { name: 'Rear uppercut-hook', fixes: ['underused', 'slower'], how: '6-3-2 at full speed. Bend the knees to throw the uppercut, rise with it.', cue: 'Drive up from the floor', calls: ['6, 3, 2', '6, 3', '2, 6, 3'] },
    { name: 'Rear uppercut and home', fixes: ['slowReturn'], how: 'Throw it short, then glove back to the chin. Watch for the hand dropping first.', cue: "Don't drop it to load it", calls: ['6', '6, 3', '1, 6'] },
  ],
  feints: [
    { name: 'Jab feint, real jab', fixes: [], how: 'Half-jab feint, then the real jab while he reacts. Sharp, short feint, a quarter of the way out.', cue: 'Sell it with the shoulder', calls: ['Feint, 1', 'Feint, 1, 2', 'Feint, 2'] },
    { name: 'Feint to the body, punch high', fixes: [], how: 'Dip the level as if to the body, then come up with the cross or hook.', cue: 'Low feint, high punch', calls: ['Feint, 2', 'Feint, 3', 'Feint, 1b, 2'] },
    { name: 'Feint every attack', fixes: [], how: 'For a whole round, every attack starts with a feint: hand, shoulder, foot or level change.', cue: 'Make him guess first', calls: ['Feint, 1, 2', 'Feint, 2, 3', 'Feint, 1, 1, 2'] },
  ],
};

// The drill that suits a punch's biggest problem (or its first drill).
export function drillsFor(type, focus = []) {
  const all = PUNCH_DRILLS[type] || [];
  const keys = focus.map((f) => f.key);
  return [...all].sort((a, b) => b.fixes.filter((k) => keys.includes(k)).length - a.fixes.filter((k) => keys.includes(k)).length);
}

// Did the drill work? For each drill you've practised, the numbers it targets in your other
// training (drill sessions themselves are left out: slow, focused reps would flatter them),
// before you started it against since. Nothing is called better or worse from fewer than two
// well-measured sessions on each side.
const DRILL_METRICS = {
  rearDrop: { key: 'rearDrop', label: 'Rear hand drops on jabs', unit: '%', better: -1, min: 5 },
  slowReturn: { key: 'returnMs', label: 'Hand back home', unit: ' ms', better: -1, min: 30 },
  underused: { key: 'share', label: 'Share of your punches', unit: '%', better: 1, min: 3 },
  slower: { key: 'speed', label: 'Speed', unit: ' m/s', better: 1, min: 0.3 },
};
function sideStats(sessions, type) {
  const cam = sessions.filter(counted);
  const total = cam.reduce((a, s) => a + TYPES.reduce((b, t) => b + (s.punches.byType[t] || 0), 0), 0);
  const n = cam.reduce((a, s) => a + (s.punches.byType[type] || 0), 0);
  const speeds = [];
  for (const s of cam) for (const row of s.calib?.punches || []) if (DIGIT_TYPE[row[0]] === type && row[1] > 0 && row[1] < 14) speeds.push(row[1]);
  const form = sessions.filter((s) => s.form && trackingOk(s) && !s.test);
  const f = (k) => form.map((s) => s.form[k]).filter((v) => v != null && Number.isFinite(v));
  const ret = f(LEAD.has(type) ? 'leadReturnMs' : 'rearReturnMs'), drop = f('rearDropPct');
  return {
    share: { v: total >= 30 ? Math.round((100 * n) / total) : null, n: cam.length },
    speed: { v: speeds.length >= 5 ? r1(median(speeds)) : null, n: cam.length },
    returnMs: { v: ret.length ? Math.round(avg(ret)) : null, n: ret.length },
    rearDrop: { v: type === 'jab' && drop.length ? Math.round(avg(drop)) : null, n: drop.length },
  };
}
export function drillProgress(sessions, { now = new Date() } = {}) {
  const sorted = [...sessions].filter((s) => +new Date(s.date) <= +now).sort((a, b) => new Date(a.date) - new Date(b.date));
  const drills = new Map();
  for (const s of sorted) {
    if (!s.drill?.name) continue;
    const k = `${s.drill.punch}|${s.drill.name}`;
    const d = drills.get(k) || { punch: s.drill.punch, name: s.drill.name, times: 0, first: s.date, last: s.date };
    d.times++;
    d.last = s.date;
    drills.set(k, d);
  }
  const other = sorted.filter((s) => !s.drill);
  return [...drills.values()].map((d) => {
    const def = (PUNCH_DRILLS[d.punch] || []).find((x) => x.name === d.name);
    const keys = [...new Set([...(def?.fixes || []), 'slowReturn', 'underused'])].filter((k) => DRILL_METRICS[k]);
    const t0 = +new Date(d.first);
    const before = other.filter((s) => { const t = +new Date(s.date); return t < t0 && t0 - t <= 60 * DAY; });
    const after = other.filter((s) => +new Date(s.date) > t0);
    const A = sideStats(before, d.punch), B = sideStats(after, d.punch);
    const metrics = keys.map((k) => {
      const m = DRILL_METRICS[k], a = A[m.key], b = B[m.key];
      if (a.v == null && b.v == null) return null;
      const enough = a.v != null && b.v != null && a.n >= 2 && b.n >= 2;
      const diff = enough ? b.v - a.v : null;
      const verdict = diff == null ? null : Math.abs(diff) < m.min ? 'same' : diff * m.better > 0 ? 'better' : 'worse';
      return { key: k, label: m.label, unit: m.unit, before: a.v, after: b.v, nBefore: a.n, nAfter: b.n, verdict, main: def?.fixes?.[0] === k };
    }).filter(Boolean).slice(0, 3);
    // The drill's verdict comes from what it's meant to fix (else the first comparable number).
    const lead = metrics.find((m) => m.main && m.verdict) || metrics.find((m) => m.verdict);
    return { ...d, metrics, verdict: lead?.verdict || 'early', afterSessions: after.length, beforeSessions: before.length };
  }).sort((a, b) => new Date(b.last) - new Date(a.last));
}
