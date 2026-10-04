// Defense drill: the voice calls a slip, roll or block every few seconds and the camera checks you
// did it in time. Calls and the moves the camera saw are matched in order; each move answers one call.
export const DEF_MOVES = { slip: 'Slip', roll: 'Roll', block: 'Block' };
export const DEF_WINDOW_MS = 1500; // from the call to the move

// The next call: random, but never the same move three times in a row.
export function nextDefCall(prev = [], rand = Math.random) {
  const moves = Object.keys(DEF_MOVES);
  const pool = prev.length >= 2 && prev.at(-1) === prev.at(-2) ? moves.filter((m) => m !== prev.at(-1)) : moves;
  return pool[Math.floor(rand() * pool.length)];
}

// calls: [{ t, move }], log: [{ t, move }] (from FormAnalyzer rounds). → per move { called, done }.
export function judgeDefense(calls, log) {
  const used = new Set();
  const out = Object.fromEntries(Object.keys(DEF_MOVES).map((m) => [m, { called: 0, done: 0 }]));
  for (const c of calls) {
    out[c.move].called++;
    const i = log.findIndex((e, k) => !used.has(k) && e.move === c.move && e.t >= c.t && e.t - c.t <= DEF_WINDOW_MS);
    if (i >= 0) { used.add(i); out[c.move].done++; }
  }
  return out;
}

// Rounds added up, and one line for the summary.
export function defenseSummary(perRound) {
  const tot = Object.fromEntries(Object.keys(DEF_MOVES).map((m) => [m, { called: 0, done: 0 }]));
  for (const r of perRound) for (const m in r) { tot[m].called += r[m].called; tot[m].done += r[m].done; }
  const called = Object.values(tot).reduce((a, x) => a + x.called, 0);
  const done = Object.values(tot).reduce((a, x) => a + x.done, 0);
  return { moves: tot, called, done, pct: called ? Math.round((100 * done) / called) : null };
}
