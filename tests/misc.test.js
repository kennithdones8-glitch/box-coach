import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PunchDetector } from '../web/js/motion.js';
import * as store from '../web/js/store.js';
import { fmt } from '../web/js/timer.js';

test('PunchDetector counts spikes with a refractory period', () => {
  const d = new PunchDetector({ threshold: 18, refractoryMs: 200 });
  const hits = [];
  const signal = [0, 5, 25, 30, 10, 2, 0, 22, 8, 0];
  signal.forEach((a, i) => { const h = d.push(a, 0, 0, i * 20); if (h) hits.push(h); });
  assert.equal(hits.length, 1); // second spike is inside the refractory window
  assert.equal(hits[0].peak, 30);
  const h2 = [];
  [0, 25, 5, 0].forEach((a, i) => { const h = d.push(a, 0, 0, 1000 + i * 20); if (h) h2.push(h); });
  assert.equal(h2.length, 1);
});

test('store round-trips and survives bad data', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const s = store.defaultState();
  s.profile.name = 'Ken';
  s.sessions.push({ id: 'a', type: 'shadow', date: '2026-09-01' });
  store.save(s, storage);
  const back = store.load(storage);
  assert.equal(back.profile.name, 'Ken');
  assert.equal(back.sessions.length, 1);
  assert.equal(back.settings.voice, true);
  mem.set('boxcoach.v1', '{not json');
  assert.equal(store.load(storage).sessions.length, 0);
  assert.throws(() => store.importJSON('{"foo":1}'));
  assert.equal(store.importJSON(store.exportJSON(s)).sessions.length, 1);
});

test('fmt formats seconds', () => {
  assert.equal(fmt(180), '3:00');
  assert.equal(fmt(65), '1:05');
  assert.equal(fmt(-3), '0:00');
});

test('coach report is compact JSON with calibration data', async () => {
  const { buildReport } = await import('../web/js/report.js');
  const round = { frames: 300, guard: 88.123, stance: 80, blade: 75, footwork: 40, head: 30, leadReturnMs: 410, rearReturnMs: 450, rearDropPct: 12, totalPunches: 120 };
  const s = {
    date: '2026-09-29T18:00:00Z', type: 'shadow', source: 'video', completedRounds: 3, workSec: 540, rpe: 7,
    plan: { rounds: 3, roundSec: 180, restSec: 60 },
    punches: { total: 360, perRound: [120, 120, 120], byType: { jab: 150 } },
    form: { guard: 87.66, perRound: [round, round, round], sequences: { '1-2': 30, 1: 50 } },
    calib: { vTh: 1.6, punches: [[1, 2.4, 0.9, 160, 0.02, 0.05, 88]], rejected: [], nearMiss: [['L', 1.2]], frames: 900, tracked: 850 },
    notes: 'felt slow',
  };
  const text = buildReport(s, { profile: { stance: 'orthodox', level: 'advanced', fight: { rounds: 6 }, sensitivity: 1 } });
  assert.match(text, /^BOXCOACH REPORT v1/);
  const data = JSON.parse(text.split('\n')[1]);
  assert.equal(data.form.guard, 87.7);
  assert.equal(data.perRound.rows.length, 3);
  assert.equal(data.perRound.rows[0][0], 88.1);
  assert.deepEqual(data.combos, { 1: 50, '1-2': 30 });
  assert.equal(data.calib.punches[0][1], 2.4);
  assert.match(data.fatigue, /held your form/);
  assert.ok(text.length < 4000);
});

test('old sessions lose their per-punch diagnostics, recent ones keep them', async () => {
  const { trimDiagnostics } = await import('../web/js/store.js');
  const sessions = Array.from({ length: 15 }, (_, i) => ({ id: i, calib: { vTh: 1.6, frames: 100, punches: [[1]], vec: [[1]], vec2: [[1]] } }));
  sessions.splice(5, 0, { id: 'run' });
  trimDiagnostics(sessions, 12);
  const withData = sessions.filter((s) => s.calib?.punches).map((s) => s.id);
  assert.equal(withData.length, 12);
  assert.deepEqual(withData.slice(0, 2), [3, 4]);
  assert.equal(sessions[0].calib.frames, 100, 'summary numbers stay');
  assert.equal(sessions[0].calib.punches, undefined);
});

test('round timer: time the phone was asleep carries over correctly', async () => {
  const { RoundTimer } = await import('../web/js/timer.js');
  const phases = [];
  const t = new RoundTimer({ rounds: 3, roundSec: 180, restSec: 60, prepSec: 10, onPhase: (p, r) => phases.push(`${p}${r}`) });
  t._enter('prep');
  // Asleep for 10 s prep + a 180 s round + 30 s of rest.
  t._last = Date.now() - 220000;
  t._loop();
  assert.equal(t.phase, 'rest');
  assert.equal(t.round, 1);
  assert.ok(Math.abs(t.remainingMs - 30000) < 200, `rest left ${t.remainingMs}`);
  assert.ok(Math.abs(t.workMs - 180000) < 200, `work ${t.workMs}`);
  // Asleep through everything else: finishes, work counts only the rounds.
  t._last = Date.now() - 1e6;
  t._loop();
  assert.equal(t.phase, 'done');
  assert.ok(Math.abs(t.workMs - 540000) < 400, `total work ${t.workMs}`);
  assert.deepEqual(phases, ['prep0', 'work1', 'rest1', 'work2', 'rest2', 'work3', 'done3']);
});

test('live camera uses the full model unless this phone proved too slow for it', async () => {
  const { pickLiveModel, tooSlow, LIVE_SLOW_MS } = await import('../web/js/pose.js');
  const m = new Map();
  const st = { getItem: (k) => m.get(k) ?? null };
  assert.equal(pickLiveModel(st), 'full');
  const now = Date.now();
  m.set('boxcoach.liveModel', `lite@${now - 3 * 86400000}`);
  assert.equal(pickLiveModel(st, now), 'lite');
  m.set('boxcoach.liveModel', `lite@${now - 15 * 86400000}`);
  assert.equal(pickLiveModel(st, now), 'full', 'tries the full model again after two weeks');
  assert.equal(tooSlow(Array(10).fill(80)), null, 'not enough frames to judge');
  assert.equal(tooSlow(Array(40).fill(LIVE_SLOW_MS - 10)), false);
  assert.equal(tooSlow([...Array(25).fill(20), ...Array(15).fill(90)]), false, 'a few slow frames at start-up are fine');
  assert.equal(tooSlow(Array(40).fill(70)), true);
});

test('every module the first screen preloads exists and is cached for offline use', async () => {
  const fs = await import('node:fs');
  const html = fs.readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
  const sw = fs.readFileSync(new URL('../web/sw.js', import.meta.url), 'utf8');
  const pre = [...html.matchAll(/rel="modulepreload" href="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(pre.length > 10);
  for (const f of pre) {
    assert.ok(fs.existsSync(new URL(`../web/${f}`, import.meta.url)), `${f} missing`);
    assert.ok(sw.includes(`'${f}'`), `${f} not in the offline cache list`);
  }
});

test('the offline copy is renamed with every release, and holds every script', async () => {
  const fs = await import('node:fs');
  const sw = fs.readFileSync(new URL('../web/sw.js', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../web/js/app.js', import.meta.url), 'utf8');
  const version = app.match(/APP_VERSION = '([^']+)'/)[1];
  // The app opens from its saved copy; only a new cache name brings a new version to phones.
  assert.match(sw, new RegExp(`const CACHE = 'boxcoach-${version.replace(/\./g, '\\.')}'`), 'bump CACHE in sw.js to match APP_VERSION');
  const dir = new URL('../web/js/', import.meta.url);
  const files = [...fs.readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => `js/${f}`),
    ...fs.readdirSync(new URL('views/', dir)).map((f) => `js/views/${f}`)];
  for (const f of files) assert.ok(sw.includes(`'${f}'`), `${f} not in the offline cache list`);
});

test('round timer: back from a locked screen, the missed phases are quiet and one wake-up says where you are', async () => {
  const { RoundTimer } = await import('../web/js/timer.js');
  const seen = [], wakes = [];
  const t = new RoundTimer({ rounds: 3, roundSec: 180, restSec: 60, prepSec: 10,
    onPhase: (p, r) => seen.push([p, r, t.catchingUp]), onWake: (p, r) => wakes.push([p, r]) });
  t._enter('prep');
  t._last = Date.now() - 250000; // locked for prep + round 1 + rest 1 + 0:00 into round 2
  t._loop();
  assert.deepEqual(seen.slice(1).map((x) => x[2]), [true, true, true], 'missed phases entered quietly');
  assert.deepEqual(wakes, [['work', 2]]);
  // A normal tick is not a wake-up.
  t._last = Date.now() - 100;
  t._loop();
  assert.equal(wakes.length, 1);
});

test('lock-screen bells: the round bells still to come, at the right times', async () => {
  const { RoundTimer, upcomingBells } = await import('../web/js/timer.js');
  const t = new RoundTimer({ rounds: 3, roundSec: 180, restSec: 60, prepSec: 10 });
  t._enter('prep'); t._enter('work'); // round 1 has just started
  t.remainingMs = 100000;
  const b = upcomingBells(t, 0);
  assert.deepEqual(b.map((x) => [x.at / 1000, x.title]), [
    [100, '🔔 Round 1 done'], [160, '🔔 Round 2'], [340, '🔔 Round 2 done'], [400, '🔔 Round 3'], [580, '🔔 Time!']]);
  t.paused = true;
  assert.deepEqual(upcomingBells(t, 0), [], 'paused: nothing rings');
  const noRest = new RoundTimer({ rounds: 2, roundSec: 60, restSec: 0, prepSec: 0 });
  noRest._enter('work'); noRest.remainingMs = 30000;
  assert.deepEqual(upcomingBells(noRest, 0).map((x) => [x.at / 1000, x.title]), [[30, '🔔 Round 2'], [90, '🔔 Time!']]);
});

test('lock-screen bells go to the phone through the native bridge, and come back', async () => {
  const calls = [];
  globalThis.Capacitor = { isNativePlatform: () => true, nativePromise: async (plugin, method, opts) => { calls.push([plugin, method, opts]); return { display: 'granted' }; } };
  try {
    const { bellsReady, handBellsToPhone, takeBellsBack } = await import('../web/js/bells.js');
    const { RoundTimer } = await import('../web/js/timer.js');
    assert.equal(await bellsReady(), true);
    const t = new RoundTimer({ rounds: 2, roundSec: 60, restSec: 30, prepSec: 0 });
    t._enter('work'); t.remainingMs = 20000;
    await handBellsToPhone(t);
    const sched = calls.find((c) => c[1] === 'schedule');
    assert.equal(sched[0], 'LocalNotifications');
    assert.deepEqual(sched[2].notifications.map((n) => n.title), ['🔔 Round 1 done', '🔔 Round 2', '🔔 Time!']);
    assert.match(sched[2].notifications[0].schedule.at, /^\d{4}-\d{2}-\d{2}T/);
    await takeBellsBack();
    assert.equal(calls.at(-1)[1], 'cancel');
  } finally { delete globalThis.Capacitor; }
});

test('simple mode: on for new installs, off for anyone already using the app', async () => {
  const store = await import('../web/js/store.js');
  assert.equal(store.defaultState().settings.simple, true);
  const mem = new Map();
  const st = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  mem.set('boxcoach.v1', JSON.stringify({ sessions: [], settings: { voice: true, voiceV2: true } }));
  assert.equal(store.load(st).settings.simple, false, 'an existing save keeps every screen');
  mem.set('boxcoach.v1', JSON.stringify({ sessions: [], settings: { voiceV2: true, simple: true } }));
  assert.equal(store.load(st).settings.simple, true);
});
