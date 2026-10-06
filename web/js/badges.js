// Badges and the weekly streak: milestones worth celebrating, worked out from your sessions (so
// they never drift out of step with the log, and deleting a session takes its badge with it).
import { BOXING_TYPES } from './coach.js';

const DAY = 86400000;
const monday = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const rounds = (s) => s.completedRounds || 0;
const fmtN = (n) => n.toLocaleString('en-US');

// Weeks in a row you trained on at least `goal` days. This week counts once you've hit it; until
// then the streak still stands from last week.
export function weekStreak(sessions, goal = 3, now = new Date()) {
  const days = new Map(); // week start → set of days trained
  for (const s of sessions) {
    const w = +monday(s.date);
    if (!days.has(w)) days.set(w, new Set());
    days.get(w).add(new Date(s.date).toDateString());
  }
  const hit = (w) => (days.get(w)?.size || 0) >= goal;
  let w = +monday(now);
  let n = hit(w) ? 1 : 0;
  // Step back a week at a time (7 days, adjusted for clock changes by re-taking Monday).
  for (w = +monday(w - 3 * DAY); hit(w); w = +monday(w - 3 * DAY)) n++;
  return n;
}

const LADDER = [
  // [id, icon, name, how, progress(acc) → [have, need]]
  ...[1, 10, 25, 50, 100].map((n) => [`sessions${n}`, n === 1 ? '🥊' : '📅', n === 1 ? 'First session' : `${n} sessions`, `Finish ${n} session${n === 1 ? '' : 's'}`, (a) => [a.sessions, n]]),
  ...[1000, 10000, 50000, 100000].map((n) => [`punches${n}`, '👊', `${fmtN(n)} punches`, `Throw ${fmtN(n)} punches the camera counts`, (a) => [a.punches, n]]),
  ...[100, 500].map((n) => [`rounds${n}`, '🔔', `${n} rounds`, `Complete ${n} rounds`, (a) => [a.rounds, n]]),
  ...[3, 5, 10].map((n) => [`weeks${n}`, '🔥', `${n}-week streak`, `Hit your training days ${n} weeks in a row`, (a) => [a.bestStreak, n]]),
  ['fullFight', '🏆', 'Full distance', 'Finish a session as long as your fight (rounds × length)', (a) => [a.fullFight ? 1 : 0, 1]],
  ['tested', '🎯', 'Dialled in', 'Score 80%+ "read as the right punch" in a punch test', (a) => [a.bestTest, 80]],
  ['guard', '🛡️', 'Iron guard', 'Hands up 85%+ over a 3+ round camera session', (a) => [a.bestGuard, 85]],
  ['engine', '⚡', 'Fast to the bell', 'Keep your hand speed (within 5%) over 3+ rounds', (a) => [a.engine ? 1 : 0, 1]],
];

// Every badge, earned (with the date) or not (with how close you are). Remembered until the
// sessions or goals change (screens ask several times per render).
let memo = { key: null, out: null };
export function badges(sessions, profile = {}) {
  const key = `${sessions.length}|${sessions.at(-1)?.date}|${sessions.at(-1)?.id}|${profile.weeklyGoal}|${profile.fight?.rounds}|${profile.fight?.roundSec}`;
  if (memo.key === key && memo.src === sessions) return memo.out;
  const out = computeBadges(sessions, profile);
  memo = { key, src: sessions, out };
  return out;
}

function computeBadges(sessions, profile) {
  const fight = profile.fight || { rounds: 6, roundSec: 180 };
  const goal = profile.weeklyGoal || 3;
  const a = { sessions: 0, punches: 0, rounds: 0, bestStreak: 0, fullFight: false, bestTest: 0, bestGuard: 0, engine: false };
  const earned = {};
  const sorted = [...sessions].sort((x, y) => new Date(x.date) - new Date(y.date));
  // The weekly streak, kept as we go (one pass, not a recount per session).
  const weekDays = new Map();
  let streak = 0, lastHitWeek = null;
  for (const s of sorted) {
    const w = +monday(s.date);
    if (!weekDays.has(w)) weekDays.set(w, new Set());
    const days = weekDays.get(w);
    const before = days.size >= goal;
    days.add(new Date(s.date).toDateString());
    if (!before && days.size >= goal) {
      streak = lastHitWeek != null && +monday(lastHitWeek + 10 * DAY) === w ? streak + 1 : 1;
      lastHitWeek = w;
      a.bestStreak = Math.max(a.bestStreak, streak);
    }
    if (s.type in BOXING_TYPES || s.workSec) a.sessions++;
    a.punches += s.source === 'manual' ? 0 : s.punches?.total || 0;
    a.rounds += rounds(s);
    if (!s.test && rounds(s) >= fight.rounds && (s.plan?.roundSec || 0) >= fight.roundSec) a.fullFight = true;
    if (s.test) a.bestTest = Math.max(a.bestTest, s.test.typePct || 0);
    const pr = s.form?.perRound?.length || 0;
    if (s.form?.guard != null && pr >= 3) a.bestGuard = Math.max(a.bestGuard, s.form.guard);
    if (s.form?.speedDrop != null && pr >= 3 && s.form.speedDrop <= 5) a.engine = true;
    for (const [id, , , , prog] of LADDER) {
      if (earned[id]) continue;
      const [have, need] = prog(a);
      if (have >= need) earned[id] = s.date;
    }
  }
  return LADDER.map(([id, icon, name, how, prog]) => {
    const [have, need] = prog(a);
    return { id, icon, name, how, earned: earned[id] || null, have: Math.min(have, need), need };
  });
}

// Badges this session would add (for the summary screen).
export function newBadges(sessions, session, profile) {
  const before = new Set(badges(sessions, profile).filter((b) => b.earned).map((b) => b.id));
  return badges([...sessions, session], profile).filter((b) => b.earned && !before.has(b.id));
}
