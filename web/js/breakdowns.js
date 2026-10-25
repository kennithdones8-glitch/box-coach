// What the animated figures show: a demo for each drill, a recap story after a session, and a
// breakdown of the punch most worth fixing. Only numbers the camera measured well are shown
// (punchCountOk / trackingOk); a slide without trustworthy data is left out, not guessed.
import { punchCountOk, trackingOk, typesOk, outputPpm } from './coach.js';
import { typeTrusted } from './trust.js';
import { PUNCH_NAMES } from './form.js';

const YOU = (move, x = 150) => ({ who: 'you', move, at: [x, 176], scale: 1.25 });
const PARTNER = (move, delay = 0) => ({ who: 'partner', move, at: [262, 176], scale: 1.25, mirror: true, delay });
const up = (s, n = 24) => { const t = String(s).toUpperCase().replace(/[.!]$/, ''); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
// The first sentence (or clause), at most n words.
const words = (s, n = 12) => {
  const first = String(s).replace(/\s+/g, ' ').trim().split(/(?<=[.!?:;])\s/)[0].replace(/[:;,]$/, '.');
  const w = first.split(' ');
  return w.length > n ? `${w.slice(0, n).join(' ')}…` : first;
};

export const PUNCH_MOVE = { jab: 'jab', cross: 'cross', leadHook: 'hook', rearHook: 'rearHook', leadUppercut: 'leadUpper', rearUppercut: 'upper', feints: 'feint' };
const REAR = new Set(['cross', 'rearHook', 'rearUppercut']);

// Library drills: the move to show, where the cue points, and when.
const DRILL_SCENE = {
  'slip-roll': { move: 'defense', marks: [['head', 'SLIP', 0, 0.3], ['head', 'ROLL', 0.3, 0.62], ['fH', 'BLOCK', 0.62, 1]] },
  'head-after': { move: 'headMove', joint: 'head', from: 0.6 },
  'hands-home': { move: 'oneTwo', joint: 'bH', tone: 'green' },
  'tie-up': { move: 'block', joint: 'fH' },
  'in-out': { move: 'inOut', joint: 'fF', from: 0.45 },
  'pivot-out': { move: 'pivotOut', joint: 'fF', from: 0.55 },
  'jab-move': { move: 'jabMove', joint: 'fF' },
  'cut-ring': { move: 'inOut', joint: 'fF' },
  'off-ropes': { move: 'pivotOut', joint: 'fF', from: 0.5 },
  'weight-transfer': { move: 'oneTwo', joint: 'bF', from: 0.35, to: 0.8 },
  'sit-down': { move: 'cross', joint: 'hip' },
  'body-head': { move: 'bodyHead', joint: 'fH' },
  tabata: { move: 'burst', joint: 'fH' },
  bursts: { move: 'burst', joint: 'fH' },
  'triple-jab': { move: 'tripleJab', joint: 'fH' },
  'counter-only': { move: 'pull', joint: 'head', partner: 'partnerJab' },
  rhythm: { move: 'feint', joint: 'fH' },
  southpaw: { move: 'oneTwo', joint: 'fF' },
};

// The scene for a drill from drills.js: { actors, callouts }.
export function drillScene(d) {
  const m = d.punch ? { move: PUNCH_MOVE[d.punch] || 'jab', joint: REAR.has(d.punch) ? 'bH' : 'fH', from: 0.3 } : DRILL_SCENE[d.id] || { move: 'oneTwo', joint: 'fH' };
  const actors = [YOU(m.move, m.partner ? 128 : 150)];
  if (m.partner) actors.push({ ...PARTNER(m.partner), at: [250, 176] });
  const callouts = m.marks
    ? m.marks.map(([joint, text, from, to]) => ({ joint, text, from, to, tone: 'gold', dx: 46, dy: -46 }))
    : [{ joint: m.joint, text: up(d.cue, 22), tone: m.tone || 'gold', from: m.from ?? 0, to: m.to ?? 1, dx: m.joint === 'fF' || m.joint === 'bF' ? 30 : 40, dy: m.joint === 'fF' || m.joint === 'bF' ? 20 : -54 }];
  return { actors, callouts };
}

// What a fix is about, from its words: the figure to show it and a short name for it.
function fixVisual(text) {
  const t = text.toLowerCase();
  if (/guard|hand|chin|drop/.test(t)) return { name: 'HANDS HOME.', bad: 'jabDrop', badJoint: 'bH', badText: 'HAND DROPS', good: 'oneTwo', goodJoint: 'bH', goodText: 'GLOVE ON CHEEK' };
  if (/head|slip|roll|centre line|center line/.test(t)) return { name: 'MOVE YOUR HEAD.', bad: 'oneTwo', badJoint: 'head', badText: 'STILL HEAD', good: 'headMove', goodJoint: 'head', goodText: 'OFF THE LINE' };
  if (/feet|foot|stance|pivot|angle|exit|step/.test(t)) return { name: 'MOVE YOUR FEET.', bad: 'oneTwo', badJoint: 'fF', badText: 'FLAT FEET', good: 'pivotOut', goodJoint: 'fF', goodText: 'PIVOT OUT' };
  return { name: 'THE FIX.', bad: 'slowReturn', badJoint: 'fH', badText: 'SLOW HOME', good: 'oneTwo', goodJoint: 'fH', goodText: 'SNAP BACK' };
}

// After a session: what you did, the punch mix, what went well, what to fix, your XP.
export function recapSlides(s, { name = 'Session', xp = null, level = null } = {}) {
  const slides = [];
  const rounds = s.completedRounds || 0, mins = Math.max(1, Math.round((s.workSec || 0) / 60));
  slides.push({
    kicker: `${name.toUpperCase()} · DONE`, title: rounds ? ['YOU PUT IN', `${rounds} ROUND${rounds === 1 ? '' : 'S'}.`] : ['YOU PUT IN', `${mins} MINUTES.`], tone: 'gold',
    caption: `${mins} minute${mins === 1 ? '' : 's'} of *work*. It all counts.`, scene: { actors: [YOU('oneTwo')] },
  });
  const trusted = s.punches?.total && s.source !== 'manual' && punchCountOk(s);
  if (trusted) {
    const total = s.punches.total, ppm = outputPpm(s);
    const by = typesOk(s) ? s.punches.byType : null; // side-on or from behind: a count, no punch mix
    const types = by ? Object.entries(by).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 5) : [];
    const top = types[0];
    slides.push({
      kicker: 'THE COUNT', title: [`${total.toLocaleString()} PUNCHES.`, ppm ? `${Math.round(ppm)} A MINUTE.` : ''], tone: 'gold',
      bars: types.map(([t, n]) => ({ label: `${PUNCH_NAMES[t] || t}${typeTrusted(t) ? '' : ' ?'}`, v: n, max: top[1], text: `${Math.round((100 * n) / total)}%`, tone: t === top[0] ? 'gold' : '' })),
      big: types.length ? null : { value: total, unit: 'punches' },
      caption: top && typeTrusted(top[0]) ? `Your *${(PUNCH_NAMES[top[0]] || top[0]).toLowerCase()}* led the way.` : by ? 'Counted by the camera. *?* = often misread.' : 'Counted by the camera. Types need a *front-on* camera.',
    });
  }
  if (s.form && trackingOk(s) && s.form.guard != null) {
    const gd = Math.round(s.form.guard), good = gd >= 75;
    slides.push({
      kicker: 'THE GUARD', title: ['HANDS UP', `${gd}% OF THE TIME.`], tone: good ? 'green' : 'red',
      caption: good ? 'Your guard *held*. Keep it there when tired.' : 'Your hands *dropped*. Chin stays covered.',
      scene: { actors: [YOU(good ? 'guardHold' : 'jabDrop')], callouts: [{ joint: good ? 'fH' : 'bH', text: good ? 'HANDS HOME' : 'HAND DROPS', tone: good ? 'green' : 'red', dx: 44, dy: -50 }] },
    });
  }
  const fix = s.feedback?.fixes?.[0];
  if (fix) {
    const v = fixVisual(fix);
    slides.push({
      kicker: 'FIX NEXT', title: ['THE PROBLEM:', v.name.replace('.', '') === 'THE FIX' ? 'ONE THING.' : v.name], tone: 'red',
      caption: words(fix, 14), scene: { actors: [YOU(v.bad)], callouts: [{ joint: v.badJoint, text: v.badText, tone: 'red', dx: 44, dy: -50 }] },
    });
    slides.push({
      kicker: 'THE FIX', title: ['DO THIS', 'INSTEAD.'], tone: 'green',
      caption: s.feedback.drills?.[0] ? words(s.feedback.drills[0], 14) : 'Slow it down until it’s *clean*, then add speed.',
      scene: { actors: [YOU(v.good)], callouts: [{ joint: v.goodJoint, text: v.goodText, tone: 'green', dx: 44, dy: -50 }] },
    });
  }
  if (xp) {
    slides.push({
      kicker: 'XP', title: [`+${xp} XP.`, level ? `${level.name.toUpperCase()}.` : ''], tone: 'gold',
      big: { value: xp, unit: 'XP' },
      bars: level?.next ? [{ label: `LV ${level.level}`, v: level.xp - level.floor, max: level.next - level.floor, text: `${level.pct}%`, tone: 'gold' }] : null,
      caption: level?.next ? `*${(level.next - level.xp).toLocaleString()}* to the next level.` : 'Top level. *Legend*.',
    });
  }
  return slides;
}

const PROBLEM = {
  rearDrop: { title: 'REAR HAND DROPS.', why: 'Your chin is *open* every time you jab.', bad: 'jabDrop', joint: 'bH', mark: 'HAND DROPS', counter: true },
  slowReturn: { title: 'SLOW BACK HOME.', why: 'A slow hand home is how *counters* land.', bad: 'slowReturn', joint: 'fH', mark: 'SLOW HOME', counter: true },
  slower: { title: 'LOSING SPEED.', why: 'Slower shots get *read* and slipped.', joint: 'fH', mark: 'SLOWER' },
  underused: { title: 'BARELY THROWN.', why: 'If he never sees it, he can’t *read* it. Use it.', joint: 'fH', mark: 'THROW IT MORE' },
};

// Punches → Work on next: the problem, why it matters, the fix, and a button to practise it.
export function punchSlides(x, drill, { days = 30, run } = {}) {
  const f = x.focus[0], pr = PROBLEM[f.key] || PROBLEM.underused;
  const move = PUNCH_MOVE[x.type] || 'jab';
  const joint = REAR.has(x.type) && pr.joint === 'fH' ? 'bH' : pr.joint;
  const slides = [{
    kicker: `YOUR ${x.name.toUpperCase()} · ${days ? `LAST ${days} DAYS` : 'ALL TIME'}`,
    title: [`${x.n.toLocaleString()} THROWN.`, x.share != null ? `${x.share}% OF YOUR PUNCHES.` : ''], tone: 'gold',
    caption: 'Here’s what the camera *sees*.', scene: { actors: [YOU(move)] },
  }, {
    kicker: 'THE PROBLEM', title: ['THE PROBLEM:', pr.title], tone: 'red', caption: words(f.text, 14),
    scene: { actors: [YOU(pr.bad || move)], callouts: [{ joint, text: f.key === 'slowReturn' && x.returnMs ? `${x.returnMs} MS HOME` : pr.mark, tone: 'red', dx: 44, dy: -50 }] },
  }];
  if (pr.counter) {
    slides.push({
      kicker: 'WHY IT MATTERS', title: ['THAT’S WHEN', 'IT LANDS.'], tone: 'red', caption: pr.why,
      scene: { actors: [YOU(pr.bad, 128), { ...PARTNER('partnerJab', 120), at: [246, 176] }], callouts: [{ actor: 0, joint: 'head', text: 'OPEN', tone: 'red', dx: -30, dy: -40, from: 0.45, to: 0.85 }] },
    });
  } else slides.push({ kicker: 'WHY IT MATTERS', title: ['WHY IT', 'MATTERS.'], tone: 'red', caption: pr.why, scene: { actors: [YOU(move)] } });
  slides.push({
    kicker: 'THE FIX', title: ['THE FIX:', `${up(drill.name, 22)}.`], tone: 'green', caption: words(drill.how, 16),
    scene: { actors: [YOU(move)], callouts: [{ joint: f.key === 'rearDrop' ? 'bH' : joint, text: up(drill.cue, 22), tone: 'green', dx: 44, dy: -50 }] },
  });
  slides.push({
    kicker: 'PRACTISE IT', title: ['3 × 2 MIN.', 'ON THE CLOCK.'], tone: 'green', caption: 'Then train as normal. Punches checks it *carried over*.',
    scene: { actors: [YOU(move)] }, cta: run ? { label: '▶ Practise now', run } : null,
  });
  return slides;
}
