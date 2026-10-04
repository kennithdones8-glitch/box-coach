import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { norm, pieces, playlist } from '../web/js/voicepack.js';
import { voiceLines } from '../scripts/voice-lines.mjs';

const manifest = JSON.parse(fs.readFileSync(new URL('../web/voice/manifest.json', import.meta.url)));

test('every line the coach can say is recorded (re-run scripts/make-voice.mjs after changing them)', () => {
  const missing = voiceLines().filter((l) => !manifest[norm(l.text)]).map((l) => l.text);
  assert.deepEqual(missing, []);
  for (const f of new Set(Object.values(manifest))) assert.ok(fs.existsSync(new URL(`../web/${f}`, import.meta.url)), f);
});

test('a sentence plays as one recording, else stitched from recorded pieces, else not at all', () => {
  const m = { 'get ready': 'a.mp3', jab: 'j.mp3', cross: 'c.mp3', 'hands up': 'h.mp3', 'last thirty empty the tank': 'l.mp3' };
  assert.deepEqual(playlist('Last thirty. Empty the tank.', m), [{ file: 'l.mp3', gap: 0 }]);
  assert.deepEqual(playlist('Get ready. jab, cross. Hands up!', m).map((x) => [x.file, x.gap]), [['a.mp3', 0.2], ['j.mp3', 0.06], ['c.mp3', 0.2], ['h.mp3', 0.2]]);
  assert.equal(playlist('Get ready. Uppercut.', m), null, 'one piece missing: the phone says it instead');
  assert.deepEqual(pieces('Thirty seconds... Go!'), ['Thirty seconds.', 'Go!']);
});

test('real calls from a session are fully recorded', async () => {
  const { comboSpeech, parseCombo } = await import('../web/js/combos.js');
  const { line, LINES } = await import('../web/js/voice.js');
  for (const c of ['1-2', '1-2-3-2', '3b roll 6-3-2 roll 2', '1-2 slip 2']) assert.ok(playlist(comboSpeech(parseCombo(c)), manifest), c);
  assert.ok(playlist(`${line('roundDone')} ${line('guard')}`, manifest));
  assert.ok(playlist('Get ready. Round one: Under pressure.', manifest));
  assert.ok(playlist('Under pressure. Opponent: Pressure fighter.', manifest));
  for (const k of Object.keys(LINES)) assert.ok(playlist(LINES[k][0], manifest), k);
});

test('the sound module still offers everything the app calls', async () => {
  const audio = await import('../web/js/audio.js');
  for (const f of ['bell', 'clap', 'tick', 'say', 'vibrate', 'unlockAudio', 'setVoice', 'preloadVoice', 'loadVoicePack']) assert.equal(typeof audio[f], 'function', f);
});
