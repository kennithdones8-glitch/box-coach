// Train with a friend, without accounts or a server: "Share my stats" makes a link holding a small
// card of your numbers; a friend opening it in their BoxCoach sees you next to them. Re-share to
// update. Nothing is uploaded: the card travels inside the link you send.
import { outputPpm } from './coach.js';
import { weekStreak, badges } from './badges.js';

const WEEK = 7 * 86400000;
const PUBLIC = 'https://kennithdones8-glitch.github.io/box-coach/';
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);

// Your numbers: this week's work, your streak, and form from your last few camera sessions.
export function myCard(state, now = new Date()) {
  const recent = state.sessions.filter((s) => now - new Date(s.date) < WEEK && new Date(s.date) <= now);
  const cam = state.sessions.filter((s) => s.form && !s.test).slice(-5);
  return {
    v: 1,
    i: state.profile.shareId,
    n: (state.profile.name || 'A boxer').slice(0, 20),
    d: now.toISOString().slice(0, 10),
    k: weekStreak(state.sessions, state.profile.weeklyGoal, now),
    s: recent.length,
    m: recent.reduce((a, s) => a + (s.durationMin || Math.round((s.workSec || 0) / 60)), 0),
    p: recent.reduce((a, s) => a + (s.source === 'manual' ? 0 : s.punches?.total || 0), 0),
    r: Math.round(avg(cam.map(outputPpm).filter((x) => x != null)) ?? 0) || null,
    g: Math.round(avg(cam.map((s) => s.form.guard).filter((x) => x != null)) ?? 0) || null,
    h: r1(avg(cam.map((s) => s.form.speed).filter((x) => x != null))),
    b: badges(state.sessions, state.profile).filter((x) => x.earned).length,
  };
}

const b64 = (str) => btoa(String.fromCharCode(...new TextEncoder().encode(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

export function shareLink(card, here = globalThis.location) {
  // Inside the store app the page address is internal to the phone: use the public one.
  const base = here?.protocol?.startsWith('http') ? here.href.split('#')[0] : PUBLIC;
  return `${base}#friend/${b64(JSON.stringify(card))}`;
}

// A card from a link, checked field by field (it came from someone else's phone).
export function readCard(code) {
  let c;
  try { c = JSON.parse(unb64(code)); } catch { return null; }
  if (!c || c.v !== 1 || typeof c.i !== 'string' || !/^[a-z0-9]{6,24}$/.test(c.i)) return null;
  const num = (v, max) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : null);
  return {
    v: 1, i: c.i, n: String(c.n || 'A boxer').slice(0, 20),
    d: /^\d{4}-\d{2}-\d{2}$/.test(c.d) ? c.d : null,
    k: num(c.k, 520), s: num(c.s, 50), m: num(c.m, 5000), p: num(c.p, 200000),
    r: num(c.r, 400), g: num(c.g, 100), h: num(c.h, 14), b: num(c.b, 100),
  };
}

// Keep one card per friend (the newest), never yourself.
export function addFriend(friends = [], card, myId) {
  if (!card || card.i === myId) return friends;
  return [...friends.filter((f) => f.i !== card.i), card].slice(-20);
}

// The rows of the comparison: [label, you, friend, higher is better].
export const COMPARE = [
  ['Streak (weeks)', 'k'], ['Sessions this week', 's'], ['Minutes this week', 'm'], ['Punches this week', 'p'],
  ['Punches / min', 'r'], ['Guard up %', 'g'], ['Hand speed', 'h'], ['Badges', 'b'],
];
