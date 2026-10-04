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
import { voiceLines } from './voice-lines.mjs';
import { norm } from '../web/js/voicepack.js';

const model = process.env.PIPER_MODEL;
if (!model) { console.error('Set PIPER_MODEL to the Piper .onnx voice'); process.exit(1); }
const ffmpeg = process.env.FFMPEG || execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
const out = new URL('../web/voice/', import.meta.url).pathname;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-'));
const lines = voiceLines().map((l) => ({ ...l, id: crypto.createHash('sha1').update(`${norm(l.text)}|${l.fast}`).digest('hex').slice(0, 10) }));
fs.writeFileSync(path.join(tmp, 'lines.json'), JSON.stringify(lines));
execFileSync('python3', [new URL('./make_voice.py', import.meta.url).pathname, model, path.join(tmp, 'lines.json'), tmp], { stdio: 'inherit' });
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out)) if (f.endsWith('.mp3')) fs.unlinkSync(path.join(out, f));
const manifest = {};
for (const l of lines) {
  // Trim the silence Piper leaves at both ends so stitched combos flow; small mono MP3.
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', path.join(tmp, `${l.id}.wav`),
    '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse',
    '-ac', '1', '-b:a', '48k', path.join(out, `${l.id}.mp3`)]);
  manifest[norm(l.text)] = `voice/${l.id}.mp3`;
}
fs.writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 0)}\n`);
const kb = fs.readdirSync(out).reduce((a, f) => a + fs.statSync(path.join(out, f)).size, 0) / 1024;
console.log(`${lines.length} clips, ${Math.round(kb)} KB in web/voice/`);
