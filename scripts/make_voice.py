"""Record the coach's lines with a Piper voice. Called by scripts/make-voice.mjs.
Usage: make_voice.py model.onnx lines.json out_dir   (lines.json: [{"id", "text", "fast"}])"""
import json, sys, wave
from piper import PiperVoice, SynthesisConfig

model, lines_path, out_dir = sys.argv[1:4]
voice = PiperVoice.load(model)
for line in json.load(open(lines_path)):
    # Combo calls a touch quicker; everything else at a natural pace.
    cfg = SynthesisConfig(length_scale=0.85 if line["fast"] else 1.0)
    with wave.open(f"{out_dir}/{line['id']}.wav", "wb") as wf:
        voice.synthesize_wav(line["text"], wf, syn_config=cfg)
print(f"recorded {len(json.load(open(lines_path)))} lines")
