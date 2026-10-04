// Every line the coach can say, for recording (scripts/make-voice.mjs) and for the test that
// checks the recordings cover them. [{ text, fast }]: fast = said quicker (combo calls).
import { LINES } from '../web/js/voice.js';
import { COMBOS, FOCUS_ADDONS, AREAS, comboToSpeech } from '../web/js/coach.js';
import { CONSTRAINTS, OPPONENTS } from '../web/js/library.js';
import { parseCombo, comboSpeech, PUNCH_WORDS, DEFENSE, STARTERS } from '../web/js/combos.js';
import { testPlan } from '../web/js/punchtest.js';
import { SETUP_TEXT } from '../web/js/camcheck.js';
import { DEF_MOVES } from '../web/js/defense.js';
import { pieces, norm } from '../web/js/voicepack.js';

const NUM = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
// Finishers and round-to-round changes from Coach me (coachme.js).
const FINISHERS = ['hands home', 'then pivot out', 'then step out', 'then slip', 'breathe, hands home', 'reset your feet'];
const EXTRA = [
  'Guard dropping. Next round: guard only, slower.', 'Clean. Longer combos next round.', 'Next round: two-punch combos.',
  ...FINISHERS.map((f) => `Next round: two-punch combos, ${f}.`),
  'Jab quality cap reached. Switch focus.', 'Rest.', 'Stop.', 'Done.', 'Stop. Reset.',
  ...NUM.map((n) => `Round ${n}.`), ...NUM.map((_, i) => `Round ${i + 1}.`), 'Round one:', 'Opponent:', 'Focus:',
];

export function voiceLines() {
  const whole = new Map(); // norm → { text, fast }
  const add = (text, fast = false) => { const k = norm(text); if (k && !whole.has(k)) whole.set(k, { text, fast }); };
  const addWithPieces = (text, fast = false) => { add(text, fast); for (const p of pieces(text)) add(p, fast); };
  for (const opts of Object.values(LINES)) for (const t of opts) addWithPieces(t);
  for (const t of EXTRA) addWithPieces(t);
  for (const t of Object.values(SETUP_TEXT)) addWithPieces(`${t}.`);
  for (const stance of ['orthodox', 'southpaw']) for (const s of testPlan(stance).steps) addWithPieces(s.say);
  for (const c of Object.values(CONSTRAINTS)) addWithPieces(`${c.name}.`);
  for (const o of Object.values(OPPONENTS)) addWithPieces(`${o.name}.`);
  for (const a of Object.values(AREAS)) addWithPieces(`${a}.`);
  // Combo calls: every punch and move word, quick.
  for (const w of Object.values(PUNCH_WORDS)) { add(w.toLowerCase(), true); add(`${w.toLowerCase()} body`, true); }
  for (const d of DEFENSE) add(d, true);
  for (const m of Object.values(DEF_MOVES)) add(`${m}!`, true);
  const comboTexts = [...Object.values(COMBOS).flat(), ...Object.values(FOCUS_ADDONS).flat(), ...Object.values(CONSTRAINTS).flatMap((c) => c.combos || []), ...STARTERS.map((s) => (typeof s === 'string' ? s : s.text || s.combo || '')), ...FINISHERS];
  for (const t of comboTexts) {
    const toks = parseCombo(t);
    for (const p of pieces(toks ? comboSpeech(toks) : comboToSpeech(t))) add(p.replace(/,$/, ''), true);
  }
  return [...whole.values()];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const lines = voiceLines();
  console.log(JSON.stringify(lines, null, 1));
  console.error(`${lines.length} lines`);
}
