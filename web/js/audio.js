// Bell, beeps and spoken cues.

let ctx = null;

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx?.state === 'suspended') ctx.resume();
  // Prime speech on iOS, which only allows it after a user gesture.
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance('');
    window.speechSynthesis.speak(u);
  }
}

function tone(freq, start, dur, vol = 0.4) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, ctx.currentTime + start);
  g.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur + 0.05);
}

// A ring bell: a struck metal bell has partials that aren't whole multiples of the note, a
// bright attack and a long ring. Several strikes for the end of the session.
export function bell(times = 1) {
  if (!ctx) return;
  const PARTIALS = [[1, 0.36, 2.4], [2.76, 0.2, 1.5], [5.4, 0.11, 0.9], [8.93, 0.06, 0.5]]; // [ratio, volume, ring seconds]
  for (let i = 0; i < times; i++) {
    const at = i * 0.45;
    for (const [ratio, vol, ring] of PARTIALS) tone(620 * ratio, at, ring, vol);
    knock(at, 0.03, 3000, 0.25); // the hammer hitting the bell
  }
}

// A short burst of filtered noise: wood or a hammer hitting something.
function knock(start, dur, freq, vol) {
  if (!ctx) return;
  const n = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(ctx.currentTime + start);
}

// The 10-second clapper: two sharp wooden claps.
export function clap() {
  knock(0, 0.06, 1800, 1.2);
  knock(0.18, 0.06, 1800, 1.2);
}

// Last seconds of the rest: a soft wood-block tick.
export function tick() {
  knock(0, 0.04, 1200, 1.4);
}

let voiceOn = true;
export function setVoice(on) {
  voiceOn = on;
}

export function say(text, { interrupt = false, rate = 1.1 } = {}) {
  if (!voiceOn || !('speechSynthesis' in window)) return;
  const s = window.speechSynthesis;
  if (interrupt) s.cancel();
  else if (s.speaking || s.pending) return; // don't queue up stale cues
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate;
  s.speak(u);
}

export function vibrate(pattern) {
  navigator.vibrate?.(pattern);
}
