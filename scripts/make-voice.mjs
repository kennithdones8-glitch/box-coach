// Records every coach line (scripts/voice-lines.mjs) with a Piper voice into web/voice/*.mp3 plus
// web/voice/manifest.json (spoken text → file). Re-run after changing what the coach says.
//   pip install piper-tts imageio-ffmpeg
//   PIPER_MODEL=path/to/en_GB-northern_english_male-medium.onnx node scripts/make-voice.mjs
// (voice: https://huggingface.co/rhasspy/piper-voices, en/en_GB/northern_english_male/medium)
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { voiceLines } from './voice-lines.mjs';
import { norm } from '../web/js/voicepack.js';

const model = process.env.PIPER_MODEL;
if (!model) { console.error('Set PIPER_MODEL to the Piper .onnx voice'); process.exit(1); }
const ffmpeg = process.env.FFMPEG || execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
const out = fileURLToPath(new URL('../web/voice/', import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-'));
const lines = voiceLines().map((l) => ({ ...l, id: crypto.createHash('sha1').update(`${norm(l.text)}|${l.fast}`).digest('hex').slice(0, 10) }));
fs.writeFileSync(path.join(tmp, 'lines.json'), JSON.stringify(lines));
execFileSync('python3', [fileURLToPath(new URL('./make_voice.py', import.meta.url)), model, path.join(tmp, 'lines.json'), tmp], { stdio: 'inherit' });
// Encode into a fresh folder first; only replace web/voice once every clip worked.
const next = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-out-'));
const manifest = {};
for (const l of lines) {
  // Trim the silence Piper leaves at both ends so stitched combos flow; small mono MP3.
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', path.join(tmp, `${l.id}.wav`),
    '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse',
    '-ac', '1', '-b:a', '48k', path.join(next, `${l.id}.mp3`)]);
  manifest[norm(l.text)] = `voice/${l.id}.mp3`;
}
fs.writeFileSync(path.join(next, 'manifest.json'), `${JSON.stringify(manifest, null, 0)}\n`);
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(next, out, { recursive: true });
fs.rmSync(next, { recursive: true, force: true });
fs.rmSync(tmp, { recursive: true, force: true });
const kb = fs.readdirSync(out).reduce((a, f) => a + fs.statSync(path.join(out, f)).size, 0) / 1024;
console.log(`${lines.length} clips, ${Math.round(kb)} KB in web/voice/`);
