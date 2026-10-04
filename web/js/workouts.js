// Ready-made sessions: one tap to start, for when you don't want to set rounds up yourself.
// Each becomes a live-session plan; constraint rounds use the coach's library (library.js).

const every = (n, constraint, opponent = null, why = '') => Array.from({ length: n }, (_, i) => ({ round: i + 1, constraint, opponent, why }));

export const WORKOUTS = [
  {
    id: 'basics', icon: '🥊', name: 'Beginner basics', level: 'New to boxing',
    detail: '3 × 2 min. Jab, cross and guard, slow and clean. Learn the shapes first.',
    plan: { type: 'shadow', rounds: 3, roundSec: 120, restSec: 60, comboLevel: 1, focus: 'guard' },
  },
  {
    id: 'burner', icon: '⚡', name: '10-minute burner', level: 'Any level',
    detail: '4 × 2 min, 30 s rest. Non-stop combos when you only have ten minutes.',
    plan: { type: 'shadow', rounds: 4, roundSec: 120, restSec: 30, comboLevel: 3, focus: 'output' },
  },
  {
    id: 'jab', icon: '👊', name: 'Jab and move', level: 'Any level',
    detail: '4 × 3 min. Only the jab, and move after every one. The punch that wins fights.',
    plan: { type: 'shadow', rounds: 4, roundSec: 180, restSec: 60, comboLevel: 1, focus: 'footwork', rounds_: every(4, 'jabFootwork') },
  },
  {
    id: 'head', icon: '🌀', name: 'Head movement', level: 'Some experience',
    detail: '4 × 3 min. Slip, roll, and punch back. The camera checks your head moves.',
    plan: { type: 'shadow', rounds: 4, roundSec: 180, restSec: 60, comboLevel: 2, focus: 'head', rounds_: every(4, 'headMove') },
  },
  {
    id: 'southpaw', icon: '🔁', name: 'Beat a southpaw', level: 'Some experience',
    detail: '5 × 3 min against a southpaw: lead foot outside, straight right down the middle.',
    plan: { type: 'shadow', rounds: 5, roundSec: 180, restSec: 60, comboLevel: 3, rounds_: every(5, 'southpawWork', 'southpaw') },
  },
  {
    id: 'pressure', icon: '🧱', name: 'Handle pressure', level: 'Some experience',
    detail: "5 × 3 min against a fighter who walks you down: pivot, angle, tie up. Don't back straight up.",
    plan: { type: 'shadow', rounds: 5, roundSec: 180, restSec: 60, comboLevel: 3, rounds_: every(5, 'pressureDefense', 'pressure') },
  },
  {
    id: 'bag', icon: '🎯', name: 'Heavy bag power', level: 'Any level',
    detail: '6 × 3 min on the bag. Sit down on your shots, then finish each round with volume.',
    plan: { type: 'bag', rounds: 6, roundSec: 180, restSec: 60, comboLevel: 3, focus: 'output' },
  },
  {
    id: 'tabata', icon: '🔥', name: 'Tabata hands', level: 'Any level',
    detail: '8 × 20 s all out, 10 s rest. Four minutes that feel like twenty.',
    plan: { type: 'shadow', rounds: 8, roundSec: 20, restSec: 10, combos: false },
  },
];

// Fight simulation sized to your fight: every round at fight pace, the last one all out.
export function fightSim(profile) {
  const f = profile?.fight || { rounds: 6, roundSec: 180, restSec: 60 };
  const rounds_ = Array.from({ length: f.rounds }, (_, i) => ({ round: i + 1, constraint: i === f.rounds - 1 ? 'fatigueSim' : 'pressureDefense', opponent: null, why: '' }));
  return {
    id: 'fight', icon: '🏆', name: 'Fight simulation', level: 'Fighters',
    detail: `${f.rounds} × ${Math.round(f.roundSec / 60)} min, your fight's length, at fight pace. Last round, empty the tank.`,
    plan: { type: 'bag', rounds: f.rounds, roundSec: f.roundSec, restSec: f.restSec ?? 60, comboLevel: 3, rounds_ },
  };
}

export const allWorkouts = (profile) => [...WORKOUTS, fightSim(profile)];
