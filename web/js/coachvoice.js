// "Full coach" voice: besides the form fixes, it pushes you near the end of a round and when your
// pace drops, and praises a fix the moment the camera sees it stick. Pure decisions, no audio:
// the app asks tick() every second and says a line for the key that comes back (voice.js words
// it), never over a combo call.

const GAP_MS = 8000; // between coach lines
const PRAISE = {
  guard: { need: 'guard', holdMs: 3000 },
  rearDrop: { need: 'guard', holdMs: 3000 },
  static: { need: 'moving', holdMs: 2000 },
  head: { need: 'head', holdMs: 1000 },
};
const WATCH_MS = 15000; // a fix has to stick within this long after the cue to earn praise

export class CoachVoice {
  constructor() { this.startRound(0); }

  startRound(t) {
    this.roundStart = t;
    this.punches = [];
    this.watch = null; // { key, since, okSince }
    this.saidLast30 = false;
    this.saidPace = false;
    this.lastLine = -Infinity;
  }

  punch(t) { this.punches.push(t); }

  // A form cue was given: watch for the fix.
  cued(key, t) { if (PRAISE[key]) this.watch = { key, since: t, okSince: null }; }

  // seen: { guard, moving, head } from the camera (null when it can't tell). leftMs: time left in
  // the round. Returns the key of a line to say (see voice.js), or null.
  tick(t, { seen = null, leftMs = Infinity } = {}) {
    if (t - this.lastLine < GAP_MS) return null;
    const line = this._praise(t, seen) || this._last30(leftMs) || this._pace(t);
    if (line) this.lastLine = t;
    return line;
  }

  _praise(t, seen) {
    const w = this.watch;
    if (!w) return null;
    if (t - w.since > WATCH_MS) { this.watch = null; return null; }
    const p = PRAISE[w.key];
    if (seen?.[p.need] === true) {
      w.okSince ??= t;
      if (t - w.okSince >= p.holdMs) { this.watch = null; return `praise.${w.key}`; }
    } else w.okSince = null;
    return null;
  }

  _last30(leftMs) {
    if (this.saidLast30 || leftMs > 30000 || leftMs < 20000) return null;
    this.saidLast30 = true;
    return 'last30';
  }

  // Output in the last 30 s well under the first minute's (needs a real first minute to compare).
  _pace(t) {
    if (this.saidPace || t - this.roundStart < 90000) return null;
    const first = this.punches.filter((p) => p - this.roundStart < 60000).length; // per minute
    if (first < 20) return null;
    const recent = this.punches.filter((p) => p <= t && t - p <= 30000).length * 2; // per minute
    if (recent >= first * 0.65) return null;
    this.saidPace = true;
    return 'pace';
  }
}
