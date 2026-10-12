// Programs: multi-week plans made of sessions the app already runs and measures (called punches,
// constraint rounds, the defense drill). Pure data and logic. A step counts as done once at least
// half its rounds were finished; progress comes from your saved sessions, never a separate tick.

const every = (n, constraint, opponent = null) => Array.from({ length: n }, (_, i) => ({ round: i + 1, constraint, opponent, why: '' }));
const S = (name, note, plan) => ({ name, note, plan: { type: 'shadow', combos: true, comboLevel: 1, constraints: false, ...plan } });
// Only these combos are called.
const calls = (name, note, rounds, roundSec, restSec, callList, type = 'shadow') => S(name, note, { type, rounds, roundSec, restSec, callList });
// A problem to solve every round (library.js CONSTRAINTS); a list gives one per round.
const con = (name, note, rounds, roundSec, restSec, key, type = 'shadow', opponent = null) => S(name, note, {
  type, rounds, roundSec, restSec, comboLevel: 2, constraints: true,
  rounds_: Array.isArray(key) ? key.slice(0, rounds).map((k, i) => ({ round: i + 1, constraint: k, opponent, why: '' })) : every(rounds, key, opponent),
});
// Slip, roll and block called out and checked by the camera.
const def = (name, note, rounds = 3, roundSec = 120, restSec = 30) => S(name, note, { rounds, roundSec, restSec, combos: false, defense: true });
// Built-in combos at a level (1 basic, 2 intermediate, 3 advanced).
const free = (name, note, rounds, roundSec, restSec, comboLevel, type = 'shadow', focus = null) => S(name, note, { type, rounds, roundSec, restSec, comboLevel, focus });
const tabata = (name, note) => S(name, note, { rounds: 8, roundSec: 20, restSec: 10, combos: false });

export const PROGRAM_CATS = [['all', 'All'], ['fundamentals', 'Fundamentals'], ['offense', 'Offense'], ['defense', 'Defense'], ['movement', 'Footwork'], ['power', 'Power'], ['conditioning', 'Engine'], ['fight', 'Fight ready']];

export const PROGRAMS = [
  {
    id: 'jab-lab', name: 'Jab Lab', cat: 'fundamentals', level: 'Beginner', weeks: 2, perWeek: 3,
    blurb: 'Your jab is your rangefinder, your scoring punch and your defense. Two weeks to make it sharp.',
    steps: [
      calls('Find your jab', 'Slow and clean. Snap it out, snap it straight back to the chin.', 3, 120, 60, ['1', '1, 1']),
      calls('Double jab', 'Two jabs, the second a half-step longer.', 3, 120, 60, ['1, 1', '1', '1, 1, 1']),
      con('Jab and move', 'Jab, then move: in, out, left, right. Never stand still after it.', 3, 120, 60, 'jabFootwork'),
      calls('Jab to the body', 'Bend the knees, not the waist. Up, down, up.', 3, 150, 60, ['1', '1b', '1, 1b', '1b, 1']),
      calls('Feint, then jab', 'Sell a half-jab, then throw the real one.', 3, 150, 60, ['Feint, 1', '1, 1', 'Feint, 1, 1']),
      con('Jab test', 'Four rounds of jab and move. Compare your numbers with day one.', 4, 180, 60, 'jabFootwork'),
    ],
  },
  {
    id: 'fundamentals', name: 'Fundamentals', cat: 'fundamentals', level: 'Beginner', weeks: 4, perWeek: 3,
    blurb: 'Stance, guard, the six punches, basic defense and footwork. Four weeks from first jab to real rounds.',
    steps: [
      con('Stance and guard', 'Hands home after every punch. Chin down, elbows in.', 3, 120, 60, 'guardRecovery'),
      calls('Jab and cross', 'Turn the back foot on the cross. Both hands come straight back.', 3, 120, 60, ['1', '2', '1, 2']),
      free('First combos', 'Basic combos called. Clean beats fast.', 3, 120, 60, 1),
      calls('Add the hook', 'Lead hook: elbow up level with the fist, turn the lead foot.', 3, 120, 60, ['1, 2', '3', '1, 2, 3']),
      def('Slip, roll, block', 'The camera checks you moved in time.'),
      con('In and out', 'Step in to punch, step out before he can answer.', 3, 120, 60, 'inOut'),
      free('Longer rounds', 'Four rounds, mixed combos.', 4, 120, 60, 2),
      con('Move your head', 'Slip or roll after every combo.', 3, 120, 60, 'headMove'),
      free('On the bag', 'Same combos on the bag. Hit through it, not at it.', 4, 120, 60, 2, 'bag'),
      con('Exit every time', 'Pivot or angle out after each combo. Never straight back.', 4, 120, 60, 'exitEvery'),
      def('Defense check', 'Faster calls than week two. Stay calm.', 3, 120, 30),
      free('Graduation', 'Five rounds, everything you learned. Then try Jab Lab or Head Movement.', 5, 120, 60, 2),
    ],
  },
  {
    id: 'one-two', name: 'The 1-2', cat: 'fundamentals', level: 'Beginner', weeks: 2, perWeek: 3,
    blurb: 'The most important combination in boxing: fast, straight, and back home.',
    steps: [
      calls('Mechanics', 'Rear foot turns, hip turns, shoulder to the chin.', 3, 120, 60, ['1, 2', '2']),
      calls('Speed', 'Second punch lands before the first is fully back.', 3, 120, 45, ['1, 2', '1, 1, 2']),
      calls('Body and head', 'Change levels with the knees.', 3, 150, 60, ['1, 2', '1, 2b', '1b, 2']),
      con('1-2 and out', 'Every 1-2 ends with a pivot or step out.', 3, 150, 60, 'exitEvery'),
      calls('On the bag', 'Sit down on the cross. Exhale on every punch.', 4, 120, 60, ['1, 2', '1, 2, 1, 2', '1, 1, 2'], 'bag'),
      calls('1-2 under fatigue', 'Last 30 s of each round: non-stop 1-2s, form first.', 4, 180, 60, ['1, 2', '1, 2, 3, 2', '1, 1, 2']),
    ],
  },
  {
    id: 'hooks-uppers', name: 'Hooks & Uppercuts', cat: 'offense', level: 'Intermediate', weeks: 3, perWeek: 3,
    blurb: 'Short power on the inside: tight hooks, uppercuts from the legs, and how to set them up.',
    steps: [
      calls('Lead hook', 'Elbow up level with the fist, pivot the lead foot.', 3, 120, 60, ['3', '1, 3', '1, 2, 3']),
      calls('Rear hook', 'Short arc, turn through the rear hip.', 3, 120, 60, ['4', '3, 4', '1, 2, 4']),
      calls('Uppercuts', 'Dip the knees, drive up with the legs, not the arm.', 3, 120, 60, ['5', '6', '5, 6', '6, 5, 2']),
      con('Body to head', 'Every combo changes levels.', 3, 150, 60, 'bodyHead'),
      calls('Inside combos', 'Stay close and keep the elbows tight.', 3, 150, 60, ['3, 6, 3', '6, 3, 2', '5, 2, 3', '3b, 3']),
      con('Hook, then move', 'Roll or slip after every hook.', 3, 150, 60, 'headMove'),
      calls('Bag: power hooks', 'Sit down on each one.', 4, 150, 60, ['3', '2, 3', '3, 2, 3', '6, 3'], 'bag'),
      free('Mixed rounds', 'Advanced combos called. Finish every one with a hook or uppercut.', 4, 180, 60, 3),
      calls('Test', 'Four rounds inside. Check your hook and uppercut stats in Punches.', 4, 180, 60, ['3, 2', '6, 3, 2', '1, 2, 3, 6', '5, 6, 3, 2']),
    ],
  },
  {
    id: 'body', name: 'Body Snatcher', cat: 'offense', level: 'Intermediate', weeks: 2, perWeek: 3,
    blurb: 'Body shots win late rounds. Learn to go downstairs safely and come back up.',
    steps: [
      calls('Going down', 'Bend the knees to change level, keep the head off the centre line.', 3, 120, 60, ['1b', '2b', '3b']),
      con('Body–head', 'Down and up, or up and down. Every combo.', 3, 150, 60, 'bodyHead'),
      calls('Liver shot', 'Lead hook to the body: step outside first.', 3, 150, 60, ['3b', '1, 2, 3b', '2, 3b, 3']),
      calls('Bag: body work', 'Dig them in. Exhale on every one.', 4, 150, 60, ['3b, 3', '2b, 3', '1, 2b, 3', '3b, 3b, 2'], 'bag'),
      con('Body then exit', 'Body shot, then angle out.', 3, 180, 60, ['bodyHead', 'exitEvery', 'bodyHead']),
      free('Test', 'Four rounds. Half your punches to the body.', 4, 180, 60, 3, 'shadow', 'output'),
    ],
  },
  {
    id: 'head-movement', name: 'Head Movement', cat: 'defense', level: 'Intermediate', weeks: 3, perWeek: 3,
    blurb: 'Slip, roll and punch back. The camera checks your head moves in time.',
    steps: [
      def('Slips and rolls', 'Small slips, bend the knees on rolls.'),
      con('Punch, then move', 'Every combo ends with a slip or roll.', 3, 120, 60, 'headMove'),
      calls('Slip and counter', 'Slip the jab, fire back straight away.', 3, 150, 60, ['slip, 2', 'slip, 2, 3', 'roll, 3, 2']),
      def('Faster defense', 'Calls come quicker. Stay relaxed.', 3, 150, 30),
      con('Off the centre line', 'Head never stays where it punched from.', 3, 150, 60, 'headMove'),
      con('Counter only', 'Never lead. Make him miss, then make him pay.', 3, 150, 60, 'counterOnly'),
      def('Long defense', 'Four rounds of calls.', 4, 120, 30),
      con('Mixed', 'Head movement and counters, one after the other.', 4, 180, 60, ['headMove', 'counterOnly', 'headMove', 'counterOnly']),
      con('Test', 'Four rounds moving your head after every combo. Check your head movement score.', 4, 180, 60, 'headMove'),
    ],
  },
  {
    id: 'counterpuncher', name: 'Counterpuncher', cat: 'defense', level: 'Advanced', weeks: 3, perWeek: 3,
    blurb: 'Make him miss and make him pay: parry, slip, pull and return in one beat.',
    steps: [
      calls('Parry and return', 'Catch the jab, return your own straight away.', 3, 150, 60, ['parry, 1, 2', 'parry, 1', 'parry, 2']),
      calls('Slip counters', 'Slip outside the jab, cross over the top.', 3, 150, 60, ['slip, 2', 'slip, 2, 3', 'slip, 3, 2']),
      con('Counter only', 'Never lead a whole round.', 3, 180, 60, 'counterOnly'),
      calls('Pull counter', 'Lean back off the jab, come back with the cross.', 3, 150, 60, ['pull, 2', 'pull, 2, 3', 'pull, 1, 2']),
      def('Read and react', 'Defense calls. Hands stay home.', 3, 150, 30),
      con('Counter his counter', 'Feint, wait for his answer, counter that.', 3, 180, 60, 'feints', 'shadow', 'counter'),
      calls('Roll counters', 'Roll under the hook, come up with your own.', 3, 180, 60, ['roll, 3, 2', 'roll, 4', 'roll, 3, 6']),
      con('Vs volume', 'He throws a lot. Block and fire back short.', 4, 180, 60, 'counterOnly', 'shadow', 'volume'),
      con('Test', 'Four rounds counter only. Patience.', 4, 180, 60, 'counterOnly'),
    ],
  },
  {
    id: 'footwork', name: 'Footwork & Angles', cat: 'movement', level: 'Intermediate', weeks: 3, perWeek: 3,
    blurb: 'Hit and not get hit: control distance, take angles, never get stuck on the ropes.',
    steps: [
      con('In and out', 'Attack from the edge of range, be gone before he answers.', 3, 120, 60, 'inOut'),
      con('Jab and move', 'Move after every jab.', 3, 150, 60, 'jabFootwork'),
      con('Pivot out', 'Every combo ends with a pivot or angle.', 3, 150, 60, 'exitEvery'),
      con('Cut the ring', "He's moving. Step to where he's going, not where he is.", 3, 150, 60, 'ringCut', 'shadow', 'outfighter'),
      con('Off the ropes', 'He walks you down. Pivot, angle, tie up.', 3, 180, 60, 'pressureDefense', 'shadow', 'pressure'),
      con('Mixed movement', 'A different problem each round.', 4, 150, 60, ['inOut', 'exitEvery', 'ringCut', 'jabFootwork']),
      free('Bag movement', 'Move around the bag. Never punch from the same spot twice.', 4, 150, 60, 2, 'bag', 'footwork'),
      con('Long rounds', 'Three-minute rounds of exits.', 4, 180, 60, 'exitEvery'),
      con('Test', 'Four rounds, a problem per round. Check your footwork score.', 4, 180, 60, ['inOut', 'exitEvery', 'ringCut', 'pressureDefense']),
    ],
  },
  {
    id: 'southpaw', name: 'Southpaw Solutions', cat: 'fight', level: 'Advanced', weeks: 2, perWeek: 3,
    blurb: 'Beat the lefty: lead foot outside, straight right down the middle, circle away from his power.',
    steps: [
      con('Foot position', 'Lead foot outside his before you punch.', 3, 150, 60, 'southpawWork', 'shadow', 'southpaw'),
      calls('Straight right', 'Right hand down the middle, over his jab.', 3, 150, 60, ['2', '1, 2', 'pivot, 2']),
      con('Circle left', 'Away from his left hand, always.', 3, 180, 60, 'southpawWork', 'shadow', 'southpaw'),
      calls('Lead hook vs lefty', 'Hook as he steps in to your right.', 3, 180, 60, ['2, 3', '3', '1, 2, 3']),
      con('Body to head', 'His liver is open on your right side.', 3, 180, 60, 'bodyHead', 'shadow', 'southpaw'),
      con('Test', 'Five rounds vs a southpaw.', 5, 180, 60, 'southpawWork', 'shadow', 'southpaw'),
    ],
  },
  {
    id: 'pressure', name: 'Pressure Fighter', cat: 'fight', level: 'Advanced', weeks: 3, perWeek: 3,
    blurb: 'Walk him down without walking into shots: cut the ring, go to the body, keep a pace he can’t.',
    steps: [
      con('Cut the ring', 'Trap him, then punch.', 3, 180, 60, 'ringCut', 'shadow', 'outfighter'),
      con('Body–head', 'Break him down from the body.', 3, 180, 60, 'bodyHead'),
      con('Head in, hands up', 'Move your head on the way in.', 3, 180, 60, 'headMove'),
      con('Bursts', 'Every 30 s: 10 s all out, then straight back to technique.', 4, 180, 60, 'fatigueSim'),
      free('Bag pressure', 'Never stop. Advanced combos.', 5, 180, 60, 3, 'bag', 'output'),
      con('Inside work', 'Clinch entries and exits after close combos.', 3, 180, 60, 'clinchWork'),
      con('Mixed', 'A different problem each round.', 5, 180, 60, ['ringCut', 'bodyHead', 'headMove', 'fatigueSim', 'ringCut']),
      free('High volume', 'Six rounds, constant output.', 6, 180, 60, 3, 'bag', 'output'),
      con('Test', 'Six rounds pressing. Last one, empty the tank.', 6, 180, 60, ['ringCut', 'bodyHead', 'headMove', 'ringCut', 'bodyHead', 'fatigueSim']),
    ],
  },
  {
    id: 'feints', name: 'Feint Master', cat: 'offense', level: 'Advanced', weeks: 2, perWeek: 3,
    blurb: 'Make him guess first. Hand, shoulder and level feints that open the real shot.',
    steps: [
      calls('Jab feints', 'A quarter of the way out, sharp, then the real one.', 3, 150, 60, ['Feint, 1', 'Feint, 1, 2', 'Feint, 2']),
      calls('Level feints', 'Dip as if to the body, then come up high.', 3, 150, 60, ['Feint, 2', 'Feint, 3', 'Feint, 1b, 2']),
      con('Feint every attack', 'No attack without a feint first.', 3, 180, 60, 'feints'),
      con('Break your rhythm', 'Half-beats, pauses, doubled shots.', 3, 180, 60, 'rhythmBreak'),
      con('Vs a counterpuncher', 'Feint to draw his counter, then counter it.', 3, 180, 60, 'feints', 'shadow', 'counter'),
      con('Test', 'Four rounds, feints and rhythm. Check feints per minute in Punches.', 4, 180, 60, ['feints', 'rhythmBreak', 'feints', 'rhythmBreak']),
    ],
  },
  {
    id: 'bag-power', name: 'Bag Power', cat: 'power', level: 'Intermediate', weeks: 3, perWeek: 3,
    blurb: 'Sit down on your shots: power from the floor, then keep it when you’re tired.',
    steps: [
      calls('1-2 weight transfer', 'Drive the cross from the back foot.', 4, 120, 60, ['1, 2', '2', '1, 2, 1, 2'], 'bag'),
      calls('Power hooks', 'Turn the hip, short arc.', 4, 120, 60, ['3', '2, 3', '1, 2, 3'], 'bag'),
      calls('Uppercut power', 'Legs, not arms.', 4, 120, 60, ['6', '5, 6', '6, 3', '3, 6, 3'], 'bag'),
      free('Power rounds', 'Every punch with intent.', 5, 150, 60, 2, 'bag'),
      con('Body–head power', 'Dig to the body, finish up top.', 4, 150, 60, 'bodyHead', 'bag'),
      con('Power under fatigue', 'Bursts every 30 s, then power again.', 4, 180, 60, 'fatigueSim', 'bag'),
      free('Volume', 'Six rounds of advanced combos.', 6, 180, 60, 3, 'bag', 'output'),
      calls('Finishers', 'Four-punch combos ending on the hardest shot.', 5, 180, 60, ['1, 2, 3, 2', '1, 1, 2, 3', '2, 3, 2, 6', '3b, 3, 2, 3'], 'bag'),
      free('Test', 'Six rounds. Compare punches per minute with week one.', 6, 180, 60, 3, 'bag', 'output'),
    ],
  },
  {
    id: 'engine', name: 'Boxing Engine', cat: 'conditioning', level: 'Any level', weeks: 4, perWeek: 3,
    blurb: 'Gas tank for the late rounds: intervals, bursts, and longer rounds each week.',
    steps: [
      tabata('Tabata hands', '8 × 20 s all out, 10 s rest.'),
      free('Steady rounds', 'Four rounds at a pace you can hold.', 4, 180, 60, 2, 'shadow', 'output'),
      con('Bursts', '10 s all out every 30 s.', 3, 180, 60, 'fatigueSim'),
      tabata('Tabata again', 'Beat last week.'),
      free('Five rounds', 'Same pace, one more round.', 5, 180, 60, 2, 'shadow', 'output'),
      con('Bag bursts', 'Bursts on the bag.', 4, 180, 60, 'fatigueSim', 'bag'),
      free('Short rest', 'Five rounds, 45 s rest.', 5, 180, 45, 3, 'bag', 'output'),
      con('Bursts × 5', 'Five rounds of bursts.', 5, 180, 60, 'fatigueSim'),
      tabata('Double Tabata, part 1', 'Then rest 2 min and do a normal round.'),
      free('Six rounds', 'Hold your pace to the end.', 6, 180, 60, 3, 'bag', 'output'),
      con('Fight-pace bursts', 'Six rounds of bursts.', 6, 180, 60, 'fatigueSim', 'bag'),
      free('Test', 'Eight rounds. Watch whether your output holds in the last two.', 8, 180, 60, 3, 'bag', 'output'),
    ],
  },
  {
    id: 'fight-camp', name: 'Fight Camp', cat: 'fight', level: 'Advanced', weeks: 6, perWeek: 4, camp: true,
    blurb: 'Six weeks to fight night: build, sharpen, peak, then taper so you’re fresh on the night.',
    steps: [
      // Build (weeks 1-2): technique and volume.
      con('Build: technique', 'Clean technique, a problem each round.', 4, 180, 60, ['jabFootwork', 'headMove', 'exitEvery', 'guardRecovery']),
      free('Build: bag volume', 'Five rounds at a steady pace.', 5, 180, 60, 2, 'bag', 'output'),
      def('Build: defense', 'Defense calls, three rounds.', 3, 150, 30),
      tabata('Build: engine', 'Tabata hands.'),
      con('Build: technique 2', 'Five rounds, a problem each round.', 5, 180, 60, ['inOut', 'bodyHead', 'counterOnly', 'headMove', 'exitEvery']),
      free('Build: bag 2', 'Six rounds.', 6, 180, 60, 3, 'bag', 'output'),
      con('Build: counters', 'Counter only.', 4, 180, 60, 'counterOnly'),
      con('Build: bursts', 'Bursts every 30 s.', 4, 180, 60, 'fatigueSim'),
      // Sharpen (weeks 3-4): fight-specific.
      con('Sharpen: your opponent', 'Rounds against the style you expect.', 5, 180, 60, ['pressureDefense', 'counterOnly', 'ringCut', 'southpawWork', 'feints']),
      free('Sharpen: bag', 'Seven rounds, fight pace.', 7, 180, 60, 3, 'bag', 'output'),
      def('Sharpen: defense', 'Faster calls.', 4, 150, 30),
      con('Sharpen: bursts', 'Six rounds of bursts.', 6, 180, 60, 'fatigueSim', 'bag'),
      con('Sharpen: pressure', 'Handle his pressure, then apply yours.', 6, 180, 60, ['pressureDefense', 'ringCut', 'pressureDefense', 'ringCut', 'bodyHead', 'fatigueSim']),
      free('Sharpen: bag 2', 'Eight rounds.', 8, 180, 60, 3, 'bag', 'output'),
      con('Sharpen: feints', 'Feint every attack.', 4, 180, 60, 'feints'),
      tabata('Sharpen: engine', 'Tabata hands, all out.'),
      // Peak (week 5): full fight simulations.
      con('Peak: fight sim', 'Full fight length at fight pace. Last round, empty the tank.', 8, 180, 60, ['pressureDefense', 'counterOnly', 'ringCut', 'bodyHead', 'headMove', 'feints', 'exitEvery', 'fatigueSim'], 'bag'),
      con('Peak: sharp technique', 'Short and crisp.', 4, 150, 60, ['jabFootwork', 'headMove', 'counterOnly', 'exitEvery']),
      def('Peak: defense', 'Defense calls.', 3, 150, 30),
      con('Peak: fight sim 2', 'One more full fight.', 8, 180, 60, ['ringCut', 'bodyHead', 'counterOnly', 'pressureDefense', 'feints', 'headMove', 'bodyHead', 'fatigueSim'], 'bag'),
      // Taper (week 6): less volume, keep it sharp.
      con('Taper: sharp', 'Three crisp rounds. Leave wanting more.', 3, 150, 60, ['jabFootwork', 'counterOnly', 'exitEvery']),
      def('Taper: defense', 'Two light rounds.', 2, 120, 45),
      free('Taper: speed', 'Three short rounds, fast hands, no fatigue.', 3, 120, 60, 2),
      calls('Taper: last session', 'Two easy rounds of your best combos. Rest, eat, sleep. Good luck.', 2, 120, 60, ['1, 2', '1, 2, 3', '1, 1, 2']),
    ],
  },
];

export const programById = (id) => PROGRAMS.find((p) => p.id === id) || null;

export const stepLabel = (prog, i) => `Week ${Math.floor(i / prog.perWeek) + 1} · Day ${(i % prog.perWeek) + 1}`;
export const stepMinutes = (st) => Math.round((st.plan.rounds * st.plan.roundSec + (st.plan.rounds - 1) * st.plan.restSec) / 60);

// A step counts once at least half its rounds were done.
const finished = (s) => s.completedRounds >= Math.ceil((s.plan?.rounds || 1) / 2);

// { done, total, pct, next (step index, null when finished), finished, last (date), doneSteps: Set }
// since: only sessions after it count (the program was started again).
export function programProgress(prog, sessions = [], since = null) {
  const doneSteps = new Set();
  let last = null;
  for (const s of sessions) {
    if (s.program?.id !== prog.id || !finished(s) || (since && s.date <= since)) continue;
    doneSteps.add(s.program.step);
    if (!last || s.date > last) last = s.date;
  }
  const total = prog.steps.length;
  const done = [...doneSteps].filter((i) => i >= 0 && i < total).length;
  const next = prog.steps.findIndex((_, i) => !doneSteps.has(i));
  return { done, total, pct: Math.round((100 * done) / total), next: next < 0 ? null : next, finished: next < 0, last, doneSteps };
}


// A first program for someone without one: by level, and fight camp if a fight is booked.
export function suggestProgram(profile = {}) {
  if (profile.fightDate && new Date(profile.fightDate) > new Date()) return 'fight-camp';
  return { beginner: 'fundamentals', intermediate: 'head-movement' }[profile.level] || 'footwork';
}
