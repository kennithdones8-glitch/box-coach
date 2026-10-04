// Round timer driven by wall-clock time so it stays accurate if the phone lags or sleeps.
// Date.now(), not performance.now(): on iPhone performance.now() stops while the phone is locked,
// so a round "paused" whenever the screen was turned off.
const now = () => Date.now();

export class RoundTimer {
  constructor({ rounds, roundSec, restSec, prepSec = 10, onPhase = () => {}, onTick = () => {}, onWake = () => {} }) {
    this.rounds = rounds;
    this.roundSec = roundSec;
    this.restSec = restSec;
    this.prepSec = prepSec;
    this.onPhase = onPhase;
    this.onTick = onTick;
    this.onWake = onWake;
    this.catchingUp = false;
    this.phase = 'idle'; // prep | work | rest | done
    this.round = 0;
    this.remainingMs = 0;
    this.workMs = 0;
    this.paused = false;
    this._last = 0;
    this._id = null;
  }

  start() {
    this._enter(this.prepSec > 0 ? 'prep' : 'work');
    this._last = now();
    this._id = setInterval(() => this._loop(), 100);
  }

  _enter(phase) {
    this.phase = phase;
    if (phase === 'prep') this.remainingMs = this.prepSec * 1000;
    if (phase === 'work') {
      this.round++;
      this.remainingMs = this.roundSec * 1000;
    }
    if (phase === 'rest') this.remainingMs = this.restSec * 1000;
    if (phase === 'done') this.stop();
    this.onPhase(phase, this.round);
  }

  _loop() {
    const t = now();
    const dt = Math.max(0, t - this._last);
    this._last = t;
    if (this.paused || this.phase === 'done') return;
    const before = Math.ceil(this.remainingMs / 1000);
    // Step through the phases: if the phone slept, several may have passed, and only time spent
    // in a round counts as work.
    let left = dt;
    // Back from a locked screen: the phases that passed meanwhile are entered quietly (no bells or
    // calls piling up), then onWake says where you are now.
    const startPhase = this.phase, startRound = this.round;
    this.catchingUp = dt > 1500;
    while (this.phase !== 'done') {
      const step = Math.max(0, Math.min(left, this.remainingMs));
      this.remainingMs -= step;
      left -= step;
      if (this.phase === 'work') this.workMs += step;
      if (this.remainingMs > 0) break;
      this._advance();
    }
    const caughtUp = this.catchingUp && (this.phase !== startPhase || this.round !== startRound);
    this.catchingUp = false;
    if (caughtUp) this.onWake(this.phase, this.round);
    const after = Math.ceil(this.remainingMs / 1000);
    if (before !== after && this.phase !== 'done') this.onTick(this.phase, Math.max(0, after), this.round);
  }

  _advance() {
    if (this.phase === 'prep') this._enter('work');
    else if (this.phase === 'work') this._enter(this.round >= this.rounds ? 'done' : this.restSec > 0 ? 'rest' : 'work');
    else if (this.phase === 'rest') this._enter('work');
  }

  skip() {
    if (this.phase !== 'done' && this.phase !== 'idle') this._advance();
  }

  togglePause() {
    this.paused = !this.paused;
    this._last = now();
    return this.paused;
  }

  stop() {
    clearInterval(this._id);
    this._id = null;
  }
}

export function fmt(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// The bells still to come from now, for handing to the phone when the screen goes off (the store
// app rings them with the screen locked). [{ at (ms since epoch), title, body }]
export function upcomingBells(timer, now = Date.now()) {
  if (!timer || timer.paused || timer.phase === 'done' || timer.phase === 'idle') return [];
  const out = [];
  let at = now + timer.remainingMs, phase = timer.phase, round = timer.round;
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  while (out.length < 40) {
    if (phase === 'prep' || phase === 'rest') {
      round++;
      out.push({ at, title: `🔔 Round ${round}`, body: `Fight! ${mmss(timer.roundSec)} on the clock.` });
      phase = 'work';
      at += timer.roundSec * 1000;
    } else if (round >= timer.rounds) {
      out.push({ at, title: '🔔 Time!', body: 'Session done. Great work.' });
      break;
    } else if (timer.restSec > 0) {
      out.push({ at, title: `🔔 Round ${round} done`, body: `Rest ${mmss(timer.restSec)}.` });
      phase = 'rest';
      at += timer.restSec * 1000;
    } else {
      phase = 'rest'; // no rest: the next round starts straight away
    }
  }
  return out;
}
