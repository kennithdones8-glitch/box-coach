// Weekly recap: last week (Monday to Sunday) in one card at the start of the new week: how much you
// trained, the one thing that got better, and the one thing to work on next.
import { outputPpm, trackingOk, punchCountOk } from './coach.js';

const DAY = 86400000;
const monday = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

// What we compare week to week. better: +1 when higher is better, -1 when lower is.
// Only numbers that were measured well count (see trackingOk).
const formOf = (k) => (s) => (trackingOk(s) ? s.form?.[k] : null);
const METRICS = [
  { key: 'guard', name: 'Guard up', unit: '%', better: 1, get: formOf('guard') },
  { key: 'head', name: 'Head movement', unit: '%', better: 1, get: formOf('head') },
  { key: 'footwork', name: 'Footwork', unit: '%', better: 1, get: formOf('footwork') },
  { key: 'ppm', name: 'Punches per minute', unit: '', better: 1, get: (s) => (punchCountOk(s) && s.source !== 'manual' ? outputPpm(s) : null) },
  { key: 'returnMs', name: 'Hand return', unit: ' ms', better: -1, get: formOf('handReturnMs') },
];
// A change is only called from at least this many measured sessions in each week: one session
// against one says more about that day than about the week.
const MIN_N = 2;
const MIN_CHANGE = { guard: 3, head: 3, footwork: 3, ppm: 3, returnMs: 15 };

const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const values = (sessions, m) => sessions.map(m.get).filter((v) => v != null && Number.isFinite(v));
// The most common session type: punch rates on the bag and in shadowboxing aren't comparable.
const mainType = (sessions) => {
  const n = {};
  for (const s of sessions) if (outputPpm(s) != null) n[s.type] = (n[s.type] || 0) + 1;
  return Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0];
};

// The recap for the week before `now`'s week, or null when there's nothing to recap.
export function weeklyRecap(sessions, now = new Date()) {
  const thisWeek = monday(now);
  const lastStart = new Date(+thisWeek - 7 * DAY), prevStart = new Date(+thisWeek - 14 * DAY);
  const inRange = (a, b) => sessions.filter((s) => { const t = new Date(s.date); return t >= a && t < b; });
  const week = inRange(lastStart, thisWeek), prev = inRange(prevStart, lastStart);
  if (!week.length) return null;
  const minutes = week.reduce((a, s) => a + (s.durationMin || Math.round((s.totalSec || s.workSec || 0) / 60)), 0);
  const punches = week.reduce((a, s) => a + (s.punches?.total || 0), 0);
  const days = new Set(week.map((s) => new Date(s.date).toDateString())).size;
  // Changes against the week before, in each metric's "good" direction.
  const type = mainType([...prev, ...week]);
  const measured = METRICS.map((m) => {
    const pick = (ss) => values(m.key === 'ppm' ? ss.filter((x) => x.type === type) : ss, m);
    const a = pick(prev), b = pick(week);
    return a.length < MIN_N || b.length < MIN_N ? null : { ...m, from: avg(a), to: avg(b), nFrom: a.length, nTo: b.length, gain: (avg(b) - avg(a)) * m.better };
  }).filter(Boolean);
  const changes = measured.filter((c) => Math.abs(c.gain) >= MIN_CHANGE[c.key]);
  const best = changes.filter((c) => c.gain > 0).sort((x, y) => y.gain / MIN_CHANGE[y.key] - x.gain / MIN_CHANGE[x.key])[0] || null;
  const worst = changes.filter((c) => c.gain < 0).sort((x, y) => x.gain / MIN_CHANGE[x.key] - y.gain / MIN_CHANGE[y.key])[0] || null;
  const strip = ({ get, ...c }) => c; // eslint-disable-line no-unused-vars
  return {
    weekOf: lastStart.toISOString().slice(0, 10), sessions: week.length, days, minutes, punches,
    best: best && strip(best), worst: worst && strip(worst),
    compared: measured.length > 0, // false: too few well-measured sessions to say what changed
  };
}
