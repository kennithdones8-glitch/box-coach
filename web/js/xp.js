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

// A day of food logging (3+ foods, not water) is worth a little too, once per day.
const FUEL_XP = 15;

export function xpTotal(sessions = [], food = []) {
  // The same session saved twice (a retried save, an imported backup) counts once.
  const seen = new Set();
  const s = sessions.reduce((a, x) => { const k = x.id ?? `${x.date}|${x.type}`; if (seen.has(k)) return a; seen.add(k); return a + sessionXp(x); }, 0);
  const days = new Map();
  for (const e of food) if (e?.kcal != null && e.day) days.set(e.day, (days.get(e.day) || 0) + 1);
  return s + [...days.values()].filter((n) => n >= 3).length * FUEL_XP;
}

// { xp, level (1-based), name, floor, next (XP for the next level or null), pct to next }
export function levelOf(xp) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1][0]) i++;
  const floor = LEVELS[i][0], next = LEVELS[i + 1]?.[0] ?? null;
  return { xp, level: i + 1, name: LEVELS[i][1], floor, next, pct: next ? Math.round((100 * (xp - floor)) / (next - floor)) : 100 };
}

// Training days in a run where rest days don't break it: up to REST_OK rest days in a row are
// fine (rest is part of training; a streak that punished it would push you to train hurt).
// Counts the training days in the current run, which is still alive within REST_OK days of today.
export const REST_OK = 2;
export function dayStreak(sessions = [], now = new Date()) {
  const days = new Set(sessions.map((s) => dayKey(s.date)));
  const d = new Date(now);
  let n = 0, gap = 0;
  for (let i = 0; i < 400; i++) {
    if (days.has(dayKey(d))) { n++; gap = 0; } else if (++gap > REST_OK) break;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
