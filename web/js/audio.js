// Bell, beeps and spoken cues.
import { playlist } from './voicepack.js';

let ctx = null;

export function unlockAudio() {
  loadVoicePack();
  // iPhone: Web Audio follows the ring/silent switch; a workout coach must be heard anyway.
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* older Safari */ }
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
// Settings: '' = the recorded BoxCoach coach, 'device' = the phone's most natural voice, or a
// phone voice by name.
let wanted = '';
export function setVoice(on, name = '') {
  voiceOn = on;
  wanted = name || '';
}

// The phone's English voices, most natural first: iPhone "Premium"/"Enhanced" downloads and the
// neural voices on Android/Chrome sound like a person; the basic ones sound like a robot.
export function englishVoices() {
  const all = globalThis.speechSynthesis?.getVoices?.() || [];
  return all.filter((v) => /^en[-_]/i.test(v.lang)).sort((a, b) => voiceScore(b) - voiceScore(a));
}
export function voiceScore(v) {
  const n = v.name;
  return (/premium/i.test(n) ? 6 : 0) + (/enhanced|neural|natural/i.test(n) ? 5 : 0) + (/siri/i.test(n) ? 4 : 0)
    + (/google/i.test(n) ? 3 : 0) + (/samantha|daniel|karen|moira|alex|ava|evan|zoe|serena/i.test(n) ? 1 : 0)
    + (v.localService ? 0.5 : 0) + (/en[-_](US|GB)/i.test(v.lang) ? 0.3 : 0) - (/compact|eloquence|novelty|whisper|bells|bubbles|zarvox|trinoids|albert|bad news|good news|jester|organ|superstar|wobble|cellos/i.test(n) ? 10 : 0);
}
let chosen = null;
function pickVoice() {
  const list = englishVoices();
  chosen = (wanted && wanted !== 'device' && list.find((v) => v.name === wanted)) || list[0] || null;
}
globalThis.speechSynthesis?.addEventListener?.('voiceschanged', pickVoice);

// The recorded coach (voicepack.js): the manifest (loaded before a session starts), and clips
// decoded on first use. A clip that fails is forgotten, so it's tried again next time.
let manifest = null, manifestLoad = null;
const clips = new Map();
export function loadVoicePack() {
  manifestLoad ||= fetch('voice/manifest.json').then((r) => (r.ok ? r.json() : null)).then((m) => { manifest = m; return m; }).catch(() => null);
  return manifestLoad;
}
const clip = (file) => {
  if (!clips.has(file)) {
    const p = fetch(file).then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.arrayBuffer(); }).then((b) => ctx.decodeAudioData(b));
    p.catch(() => clips.delete(file));
    clips.set(file, p);
  }
  return clips.get(file);
};
// Before a session: download every clip (so it works offline), but decode only the short combo
// words, which must play on the beat. Decoding all of them would hold ~75 MB of audio in memory.
export async function preloadVoice() {
  await loadVoicePack();
  if (!manifest || !ctx || wanted || !voiceOn) return;
  const words = new Set(Object.entries(manifest).filter(([k]) => k.split(' ').length <= 2).map(([, f]) => f));
  const files = [...new Set(Object.values(manifest))];
  for (let i = 0; i < files.length; i += 8) {
    await Promise.all(files.slice(i, i + 8).map((f) => (words.has(f) ? clip(f) : fetch(f).then((r) => r.blob())).catch(() => {})));
  }
}

let playing = [], busyUntil = 0, loading = false, turn = 0;
function stopClips() {
  turn++;
  loading = false;
  for (const src of playing) { try { src.stop(); } catch { /* already done */ } }
  playing = [];
  busyUntil = 0;
}
const phoneBusy = () => !!(globalThis.speechSynthesis?.speaking || globalThis.speechSynthesis?.pending);
export const speaking = () => loading || (ctx && ctx.state === 'running' && ctx.currentTime < busyUntil) || phoneBusy();

// Stop the coach mid-sentence (pause, end of session).
export function stopSpeech() {
  stopClips();
  globalThis.speechSynthesis?.cancel();
}

// rate 1 = calm, talking pace; combo calls go a little quicker (recorded calls already are).
export function say(text, { interrupt = false, rate = 1 } = {}) {
  if (!voiceOn || !text) return;
  if (ctx && ctx.state !== 'running') ctx.resume?.().catch(() => {}); // back from a lock screen or a call
  const list = !wanted && ctx?.state === 'running' && manifest ? playlist(text, manifest) : null;
  if (!list) return speakWithPhone(text, { interrupt, rate });
  if (interrupt) stopSpeech(); else if (speaking()) return; // don't queue up stale cues
  const mine = ++turn;
  loading = true;
  Promise.all(list.map((x) => clip(x.file))).then((bufs) => {
    if (mine !== turn) return; // something newer took over
    loading = false;
    let t = ctx.currentTime + 0.02;
    bufs.forEach((b, i) => {
      const src = ctx.createBufferSource();
      src.buffer = b;
      src.connect(ctx.destination);
      src.onended = () => { playing = playing.filter((x) => x !== src); };
      src.start(t);
      playing.push(src);
      t += b.duration + list[i].gap;
    });
    busyUntil = t;
  }).catch(() => {
    if (mine !== turn) return; // outdated: don't talk over what came after
    loading = false;
    speakWithPhone(text, { interrupt, rate });
  });
}

function speakWithPhone(text, { interrupt, rate }) {
  if (!('speechSynthesis' in window)) return;
  const s = window.speechSynthesis;
  if (interrupt) stopSpeech(); else if (speaking()) return;
  if (!chosen || (wanted && wanted !== 'device' && chosen.name !== wanted)) pickVoice();
  const u = new SpeechSynthesisUtterance(text);
  if (chosen) { u.voice = chosen; u.lang = chosen.lang; }
  u.rate = rate;
  u.pitch = 1;
  s.speak(u);
}

export function vibrate(pattern) {
  navigator.vibrate?.(pattern);
}
