// The recorded coach: every line the coach says, recorded once in one voice (voice/*.mp3, made by
// scripts/make-voice.mjs) so it sounds like a person on every phone, offline. A sentence plays
// as one recording when there is one, else stitched from recorded pieces ("jab", "cross",
// "Hands up."); anything not recorded falls back to the phone's own voice.

// The key a piece of text is stored under: lower case, words only.
export const norm = (s) => String(s).toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();

// Pieces of a sentence, split after commas, full stops, colons and the like ("..." is a pause).
export function pieces(text) {
  return String(text).replace(/\.\.\./g, '.').split(/(?<=[.!?;:,])\s+/).map((s) => s.trim()).filter((s) => norm(s));
}

// How to play `text` from the recordings: [{ file, gap }] (gap: silence after it, seconds), or null
// when some piece isn't recorded.
export function playlist(text, manifest) {
  if (!manifest) return null;
  const whole = manifest[norm(text)];
  if (whole) return [{ file: whole, gap: 0 }];
  const out = [];
  for (const p of pieces(text)) {
    const file = manifest[norm(p)];
    if (!file) return null;
    out.push({ file, gap: /[.!?:]$/.test(p) ? 0.2 : /,$/.test(p) ? 0.06 : 0.1 });
  }
  return out.length ? out : null;
}
