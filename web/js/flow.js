// How to play a video while analysing it. Pure logic (no DOM), so it can be tested.
//
// 'flow': keep the video playing, slowed down just enough that each frame we want can be
// analysed before the next one shows. 'step': pause on every frame we want (never misses one,
// but each pause and restart costs time on a phone). Flow is much faster when it keeps up; when
// wanted frames start slipping by, the analysis falls back to step and rewinds (views/video.js).
export const MIN_RATE = 0.5; // slowest playback phones handle well (iPhone Safari: 0.5–2)
export const MAX_RATE = 2.5;
const ROOM = 1.4; // a frame costs the pose model plus grabbing and the rest: leave room

// typicalMs: how long the pose model took per frame on this phone (median of a few runs);
// gapMs: time between the frames we want (1000 / fps).
export function playPlan(typicalMs, gapMs) {
  if (!(typicalMs > 0)) return { mode: 'flow', rate: 1 };
  const rate = Math.min(1, gapMs / (typicalMs * ROOM));
  return rate >= MIN_RATE ? { mode: 'flow', rate: Math.round(rate * 100) / 100 } : { mode: 'step', rate: 1 };
}

// After each analysed frame in flow: n = how many wanted frames went by since the last one
// (1 = kept up). Creep up when keeping up, back off fast when not.
export const steer = (rate, n) => Math.min(MAX_RATE, Math.max(MIN_RATE, n <= 1 ? rate + 0.005 : rate * 0.8));
