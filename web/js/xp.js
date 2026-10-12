// XP, levels and the day streak: worked out from your saved sessions and food log (never a
// separate counter, so deleting a session takes its XP with it).

const dayKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`; };

export const LEVELS = [
  [0, 'Rookie'], [300, 'Novice'], [800, 'Amateur'], [1600, 'Contender'], [3000, 'Prospect'],
  [5000, 'Pro'], [8000, 'Title Challenger'], [12000, 'Champion'], [18000, 'Legend'],
];

// XP for one session: showing up, the rounds you finished, and extra for structured work.
export function sessionXp(s) {
  const rounds = s.completedRounds ?? s.plan?.rounds ?? (s.durationMin ? Math.round(s.durationMin / 4) : 0);
  let xp = 20 + 10 * Math.min(rounds || 0, 15);
  if (s.program) xp += 40;
  if (s.drill || s.libDrill || s.defense) xp += 20;
  if (s.test) xp += 30;
  return xp;
}

// A day of food logging (3+ entries) is worth a little too.
const FUEL_XP = 15;

export function xpTotal(sessions = [], food = []) {
  const s = sessions.reduce((a, x) => a + sessionXp(x), 0);
  const days = new Map();
  for (const e of food) days.set(e.day, (days.get(e.day) || 0) + 1);
  return s + [...days.values()].filter((n) => n >= 3).length * FUEL_XP;
}

// { xp, level (1-based), name, floor, next (XP for the next level or null), pct to next }
export function levelOf(xp) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1][0]) i++;
  const floor = LEVELS[i][0], next = LEVELS[i + 1]?.[0] ?? null;
  return { xp, level: i + 1, name: LEVELS[i][1], floor, next, pct: next ? Math.round((100 * (xp - floor)) / (next - floor)) : 100 };
}

// Days in a row with a session, ending today (or yesterday, until you train today).
export function dayStreak(sessions = [], now = new Date()) {
  const days = new Set(sessions.map((s) => dayKey(s.date)));
  const d = new Date(now);
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
