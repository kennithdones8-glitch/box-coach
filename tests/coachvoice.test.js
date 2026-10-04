import test from 'node:test';
import assert from 'node:assert/strict';
import { CoachVoice } from '../web/js/coachvoice.js';

test('coach voice praises a fix only once it sticks, and only after a cue', () => {
  const c = new CoachVoice();
  c.startRound(0);
  assert.equal(c.tick(1000, { seen: { guard: true } }), null, 'no cue, no praise');
  c.cued('guard', 10000);
  assert.equal(c.tick(11000, { seen: { guard: true } }), null);
  assert.equal(c.tick(12000, { seen: { guard: false } }), null, 'dropped again: the clock restarts');
  assert.equal(c.tick(13000, { seen: { guard: true } }), null);
  assert.equal(c.tick(16000, { seen: { guard: true } }), 'praise.guard');
  assert.equal(c.tick(30000, { seen: { guard: true } }), null, 'once per cue');
  c.cued('head', 40000);
  assert.equal(c.tick(60000, { seen: { head: true } }), null, 'too late: the cue was 20 s ago');
});

test('coach voice pushes in the last 30 seconds and when the pace drops', () => {
  const c = new CoachVoice();
  c.startRound(0);
  for (let t = 0; t < 60000; t += 1500) c.punch(t); // 40 a minute
  for (let t = 60000; t < 150000; t += 4000) c.punch(t); // ~15 a minute after that
  assert.equal(c.tick(80000, {}), null, 'too early to judge the pace');
  assert.equal(c.tick(100000, {}), 'pace');
  assert.equal(c.tick(104000, { leftMs: 25000 }), null, 'never two lines within 8 s');
  assert.equal(c.tick(110000, { leftMs: 25000 }), 'last30');
  assert.equal(c.tick(130000, { leftMs: 5000 }), null);
  // A steady round gets no "pick it up".
  const s = new CoachVoice();
  s.startRound(0);
  for (let t = 0; t < 150000; t += 1500) s.punch(t);
  assert.equal(s.tick(120000, {}), null);
});

test('coach lines come in a few wordings and never the same twice in a row', async () => {
  const { line } = await import('../web/js/voice.js');
  const said = Array.from({ length: 30 }, () => line('guard'));
  assert.ok(new Set(said).size >= 3);
  for (let i = 1; i < said.length; i++) assert.notEqual(said[i], said[i - 1]);
  assert.equal(line('no-such-line'), null);
});

test('the most natural English voice is picked first; novelty and compact voices last', async () => {
  globalThis.speechSynthesis = { getVoices: () => [
    { name: 'Zarvox', lang: 'en-US', localService: true },
    { name: 'Samantha (Compact)', lang: 'en-US', localService: true },
    { name: 'Thomas', lang: 'fr-FR', localService: true },
    { name: 'Samantha', lang: 'en-US', localService: true },
    { name: 'Ava (Premium)', lang: 'en-US', localService: true },
    { name: 'Daniel (Enhanced)', lang: 'en-GB', localService: true },
  ], addEventListener() {} };
  try {
    const { englishVoices } = await import('../web/js/audio.js?voices');
    assert.deepEqual(englishVoices().map((v) => v.name), ['Ava (Premium)', 'Daniel (Enhanced)', 'Samantha', 'Samantha (Compact)', 'Zarvox']);
  } finally { delete globalThis.speechSynthesis; }
});
