// Drill library: short focused sessions, browsable by what they work on. Punch drills come from
// punchstats.js (their effect on your other training is followed there); the rest are built from
// the constraint rounds and the defense drill the camera can already check.
import { PUNCH_DRILLS } from './punchstats.js';
import { PUNCH_NAMES } from './form.js';

export const DRILL_CATS = [['all', 'All'], ['punches', 'Punches'], ['defense', 'Defense'], ['footwork', 'Footwork'], ['power', 'Power'], ['engine', 'Engine'], ['iq', 'Ring IQ']];
export const CAT_ICON = { punches: '👊', defense: '🛡️', footwork: '👟', power: '💥', engine: '🔥', iq: '🧠' };

const rounds = (n, constraint, opponent = null) => Array.from({ length: n }, (_, i) => ({ round: i + 1, constraint, opponent, why: '' }));
const con = (key, opts = {}) => ({ type: 'shadow', rounds: 3, roundSec: 120, restSec: 45, combos: true, comboLevel: 2, constraints: true, ...opts, rounds_: rounds(opts.rounds || 3, key, opts.opponent || null) });
const calls = (callList, opts = {}) => ({ type: 'shadow', rounds: 3, roundSec: 120, restSec: 45, combos: true, comboLevel: 1, constraints: false, callList, ...opts });

const LIB = [
  { id: 'slip-roll', cat: 'defense', name: 'Slip, roll, block', how: 'Slips, rolls and blocks are called every few seconds; the camera checks you did each one in time.', cue: 'Small slips, bend the knees', plan: { type: 'shadow', rounds: 3, roundSec: 120, restSec: 30, combos: false, constraints: false, defense: true }, camera: true },
  { id: 'head-after', cat: 'defense', name: 'Punch, then move your head', how: 'Every combo ends with a slip or roll. The camera scores your head movement.', cue: 'Never stay on the centre line', plan: con('headMove') },
  { id: 'hands-home', cat: 'defense', name: 'Hands home', how: 'Glove back to the face after every punch, before you move.', cue: 'Freeze-check your guard', plan: con('guardRecovery') },
  { id: 'tie-up', cat: 'defense', name: 'Tie up and turn', how: 'After close combos, tie up, turn him, and break out on an angle.', cue: 'Frame, turn, exit', plan: con('clinchWork') },
  { id: 'in-out', cat: 'footwork', name: 'In and out', how: 'Attack from the edge of range and be gone before he can answer.', cue: 'Step in, punch, step out', plan: con('inOut') },
  { id: 'pivot-out', cat: 'footwork', name: 'Pivot out', how: 'Every combination finishes with a pivot or an angle. Never straight back.', cue: 'Finish off the line', plan: con('exitEvery') },
  { id: 'jab-move', cat: 'footwork', name: 'Jab and move', how: 'Only the jab, and move after every one: in, out, left, right.', cue: 'Never stand still', plan: con('jabFootwork') },
  { id: 'cut-ring', cat: 'footwork', name: 'Cut the ring', how: "He's moving away. Step to cut off his exits instead of following him.", cue: "Go where he's going", plan: con('ringCut', { opponent: 'outfighter' }) },
  { id: 'off-ropes', cat: 'footwork', name: 'Off the ropes', how: 'He walks you down all round: pivot, angle or tie up. No straight-back steps.', cue: 'Angle, don’t back up', plan: con('pressureDefense', { rounds: 3, roundSec: 150, opponent: 'pressure' }) },
  { id: 'weight-transfer', cat: 'power', name: '1-2 weight transfer', how: 'Drive the cross from the back foot, turn the hip, land with your weight behind it.', cue: 'Back foot, hip, shoulder', plan: calls(['1, 2', '2', '1, 2, 1, 2'], { type: 'bag' }) },
  { id: 'sit-down', cat: 'power', name: 'Sit down on it', how: 'Bend the knees a touch on every power shot. Hit through the bag, not at it.', cue: 'Through, not at', plan: calls(['2', '3', '2, 3', '6, 3'], { type: 'bag', rounds: 4 }) },
  { id: 'body-head', cat: 'power', name: 'Body to head', how: 'Every combo changes levels: body then head, or head then body.', cue: 'Bend the knees, not the waist', plan: con('bodyHead') },
  { id: 'tabata', cat: 'engine', name: 'Tabata hands', how: '20 s all out, 10 s rest, eight times. Straight punches, full speed.', cue: 'Empty the tank', plan: { type: 'shadow', rounds: 8, roundSec: 20, restSec: 10, combos: false, constraints: false } },
  { id: 'bursts', cat: 'engine', name: '10-second bursts', how: 'Every 30 s: 10 s of all-out straight punches, then straight back to clean technique.', cue: 'Recover in the round', plan: con('fatigueSim', { rounds: 3, roundSec: 180, restSec: 60 }) },
  { id: 'triple-jab', cat: 'iq', name: 'Triple jab rhythm', how: 'Vary the rhythm of the jab: three quick, then a pause, then a double. Make him guess.', cue: 'Never the same beat twice', plan: calls(['1, 1, 1', '1, 1, 2', '1, pause, 1, 2', '1, 1, pause, 1']) },
  { id: 'counter-only', cat: 'iq', name: 'Counter only', how: 'Never lead. Picture his jab: slip, parry or pull, then fire back.', cue: 'Make him miss, make him pay', plan: con('counterOnly') },
  { id: 'rhythm', cat: 'iq', name: 'Break your rhythm', how: 'Half-beat punches, pauses, doubled-up shots. Be unpredictable.', cue: 'Change the music', plan: con('rhythmBreak') },
  { id: 'southpaw', cat: 'iq', name: 'Versus a southpaw', how: 'Lead foot outside his, right hand down the middle, circle to your left.', cue: 'Outside foot, straight right', plan: con('southpawWork', { opponent: 'southpaw' }) },
];

export const drillMinutes = (p) => Math.round((p.rounds * p.roundSec + (p.rounds - 1) * p.restSec) / 60);

// Every drill: { id, cat, name, how, cue, plan, mins, punch?, punchDrill? }. Punch drills keep the
// punch and the PUNCH_DRILLS entry so they start through app.startDrill (and are followed up).
export function allDrills() {
  const punch = Object.entries(PUNCH_DRILLS).flatMap(([type, list]) => list.map((d, i) => ({
    id: `p-${type}-${i}`, cat: type === 'feints' ? 'iq' : 'punches', name: d.name, how: d.how, cue: d.cue,
    tag: type === 'feints' ? 'Feints' : PUNCH_NAMES[type], punch: type, punchDrill: d,
    plan: { rounds: 3, roundSec: 120, restSec: 45 },
  })));
  return [...LIB.map((d) => ({ ...d, tag: null })), ...punch].map((d) => ({ ...d, mins: drillMinutes(d.plan) }));
}
