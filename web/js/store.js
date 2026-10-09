// Everything lives on the device in localStorage. Export/import gives you a backup.
import { emptyMemory } from './coach.js';

const KEY = 'boxcoach.v1';

export function defaultState() {
  return {
    version: 1,
    profile: {
      name: '', stance: 'orthodox', level: 'advanced', goal: 'compete', weeklyGoal: 6, sensitivity: 1,
      fight: { rounds: 6, roundSec: 180, restSec: 60 }, fightDate: '', opponentStyle: '', targetWeight: null, unit: 'lb',
    },
    settings: { voice: true, combos: true, comboInterval: 6, tracking: 'camera', cues: true, voiceV2: true, simple: true, voiceStyle: 'coach' },
    sessions: [],
    memory: emptyMemory(),
    weights: [],
    plans: {},
    observations: [], // { source: coach | self | ai, kind: issue | positive | note, text, tags }
    patterns: [], // combinations being developed, tracked from drilling to sparring
    combos: [], // your own combos: { id, tokens, name, created }
    refVideos: [], // YouTube links to study: { id, yt, name, added }
    references: [], // analysed pro clips to compare against: { id, name, date, metrics, byType }
    decisions: [], // decision-drill answers
    hypotheses: [],
    checkins: [], // morning readiness: sleep, soreness, motivation, resting HR
    paused: [], // priorities parked to avoid skill interference
    friends: [], // friends' stat cards from shared links (friends.js)
    coach: { equipment: [], levels: {}, overrides: [], assigned: {} }, // Coach me: drill ladder, coach overrides, gear
  };
}

const ARRAYS = ['sessions', 'weights', 'observations', 'patterns', 'combos', 'refVideos', 'references', 'decisions', 'hypotheses', 'checkins', 'paused', 'friends'];

function merge(base, data) {
  // Earlier versions defaulted to kg; switch to lb if no weights were logged in kg yet.
  if (data.profile?.unit === 'kg' && !(data.weights || []).length) data.profile.unit = 'lb';
  // The voice now gives form fixes only; combo calls are opt-in (once, for older saves).
  if (data.settings && !data.settings.voiceV2) data.settings = { ...data.settings, combos: false, voiceV2: true };
  // Simple mode is for new installs; anyone who already uses the app keeps every screen.
  if (data.settings && data.settings.simple === undefined) data.settings = { ...data.settings, simple: false };
  // The full-coach voice (combos, pushes, praise) is the default; fixes-only stays a choice.
  if (data.settings && !data.settings.voiceStyle) data.settings = { ...data.settings, voiceStyle: 'coach', combos: true };
  return {
    ...base,
    ...data,
    profile: { ...base.profile, ...(data.profile || {}), fight: { ...base.profile.fight, ...(data.profile?.fight || {}) } },
    settings: { ...base.settings, ...(data.settings || {}) },
    coach: { ...base.coach, ...(data.coach || {}) },
    memory: { ...base.memory, ...(data.memory || {}) },
    ...Object.fromEntries(ARRAYS.map((k) => [k, Array.isArray(data[k]) ? data[k] : []])),
    plans: data.plans && typeof data.plans === 'object' ? data.plans : {},
  };
}

// If the saved data can't be read (cut short by a full phone, say), it's kept under RESCUE rather
// than overwritten by the next save, and load reports it so the app can say so.
export const RESCUE = 'boxcoach.rescue';
export const BEFORE_IMPORT = 'boxcoach.beforeImport';
export let loadProblem = null;

export function load(storage = globalThis.localStorage) {
  loadProblem = null;
  let raw = null;
  try {
    raw = storage?.getItem(KEY);
    if (!raw) return defaultState();
    return merge(defaultState(), JSON.parse(raw));
  } catch {
    if (raw) {
      try { storage.setItem(RESCUE, raw); loadProblem = 'rescued'; } catch { loadProblem = 'unreadable'; }
    }
    return defaultState();
  }
}

// Saves; if the phone's storage is full, slims the per-punch diagnostics of older sessions and
// tries again before giving up (the sessions themselves are never dropped).
export function save(state, storage = globalThis.localStorage) {
  try {
    storage?.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    for (const keep of [3, 0]) {
      try {
        trimDiagnostics(state.sessions, keep);
        storage?.setItem(KEY, JSON.stringify(state));
        return true;
      } catch { /* still too big */ }
    }
    return false;
  }
}

// A session not saved yet: the summary screen's, or the rounds done so far in a live session.
// If the phone closes the app (it often does when it's put away), it comes back on next open.
const DRAFT = 'boxcoach.draft';
export function saveDraft(session, partial = false, storage = globalThis.localStorage) {
  try { storage?.setItem(DRAFT, JSON.stringify({ session, partial, at: new Date().toISOString() })); return true; } catch { return false; }
}
export function takeDraft(storage = globalThis.localStorage) {
  try {
    const d = JSON.parse(storage?.getItem(DRAFT) || 'null');
    return d && d.session && typeof d.session === 'object' && !Number.isNaN(new Date(d.session.date).getTime()) ? d : null;
  } catch { return null; }
}
export function clearDraft(storage = globalThis.localStorage) {
  try { storage?.removeItem(DRAFT); } catch { /* nothing to do */ }
}

export function exportJSON(state) {
  return JSON.stringify(state, null, 2);
}

// Every problem that would stop a backup from being used, checked before anything is replaced.
export function checkBackup(data) {
  const problems = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ['That file is not a BoxCoach backup.'];
  if (!Array.isArray(data.sessions)) return ['That file is not a BoxCoach backup.'];
  const okDate = (d) => typeof d === 'string' && !Number.isNaN(new Date(d).getTime());
  data.sessions.forEach((x, i) => {
    if (!x || typeof x !== 'object' || Array.isArray(x)) problems.push(`Session ${i + 1} is empty or not a session.`);
    else if (!okDate(x.date)) problems.push(`Session ${i + 1} has no valid date.`);
  });
  for (const k of ARRAYS) {
    if (k === 'sessions' || data[k] == null) continue;
    if (!Array.isArray(data[k])) problems.push(`"${k}" is not a list.`);
    else if (data[k].some((x) => x == null || typeof x !== 'object')) problems.push(`"${k}" has entries that aren't records.`);
  }
  for (const k of ['profile', 'settings', 'memory', 'coach', 'plans']) {
    if (data[k] != null && (typeof data[k] !== 'object' || Array.isArray(data[k]))) problems.push(`"${k}" is not a record.`);
  }
  return problems;
}

export function importJSON(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('That file is not a BoxCoach backup (it could not be read).'); }
  const problems = checkBackup(data);
  if (problems.length) {
    const more = problems.length > 3 ? ` (+${problems.length - 3} more)` : '';
    throw new Error(`Backup not imported, nothing was changed. ${problems.slice(0, 3).join(' ')}${more}`);
  }
  return merge(defaultState(), data);
}

// Per-punch diagnostics (calib) are only needed for recent coach reports. Keep them on the latest
// few sessions and slim older ones, so months of camera sessions don't fill the phone's storage.
export function trimDiagnostics(sessions, keep = 12) {
  let seen = 0;
  for (let i = sessions.length - 1; i >= 0; i--) {
    const c = sessions[i].calib;
    if (!c) continue;
    if (++seen <= keep) continue;
    for (const k of ['punches', 'vec', 'vec2', 'rejected', 'nearMiss', 'fixes', 'labels', 'track', 'motion', 'pt']) delete c[k];
  }
  return sessions;
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
