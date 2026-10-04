// What the coach says, in a few different ways each, so it sounds like a person and not a
// recording on repeat. line(key) picks one, never the same as last time for that key.

const LINES = {
  // Form cues (keys from FormAnalyzer).
  guard: ['Hands up.', 'Get those hands up.', 'Chin down, hands up.', 'Hands back to your face.', 'Guard up.'],
  rearDrop: ['Keep that back hand home.', 'Back hand stays on your chin.', "Don't drop the back hand."],
  crossed: ["Don't cross your feet.", 'Feet. Stop crossing them.', 'Step, drag. Keep the feet apart.'],
  narrow: ['Widen your stance a little.', 'Bit wider with the feet.', 'Get your base back.'],
  wide: ['Stance is too wide. Bring it in.', 'Feet a little closer.', "Narrow it up, you're stuck."],
  squared: ['Turn that lead shoulder in.', "You're square. Turn your shoulder.", 'Blade your stance.'],
  static: ['Move your feet.', "Don't stand still. Move.", 'Feet moving. In and out.', 'Get on your toes.'],
  head: ['Move your head.', 'Head movement. Slip something.', "Don't stay on the centre line.", 'Move that head.'],
  visibility: ["Step back, I can't see you.", 'Back up a bit so I can see you.'],
  feet: ['Step back, show me your feet.', "I can't see your feet. Step back."],
  // Full coach.
  'praise.guard': ['Good. Hands are home.', "That's it, hands up.", 'Nice. Guard is back.', 'Better. Keep them there.'],
  'praise.rearDrop': ["That's it. Hand stays home.", 'Good, back hand on the chin.'],
  'praise.static': ["That's it. Keep moving.", 'Good feet. Stay on them.', 'Nice, keep that rhythm.'],
  'praise.head': ["Good. Head's moving.", "That's it, keep slipping.", 'Nice head movement.'],
  last30: ['Last thirty. Empty the tank.', 'Thirty seconds. Finish strong.', 'Last thirty. Let them go.', "Thirty left. Don't coast."],
  pace: ["Pick it up. You're slowing down.", "Work rate's dropping. Let your hands go.", 'More punches. Stay busy.', 'Come on, pick the pace back up.'],
  // Round rhythm.
  getReady: ['Get ready.', "Let's go. Get set.", 'Here we go. Get ready.'],
  roundDone: ['Time.', "Time. That's the round.", 'Bell. Breathe.', 'Time. Good work.'],
  goodRound: ['Good round.', 'Solid round.', 'Nice work that round.', 'Good. Same again.'],
  done: ['Time! Great work.', "That's it. Great session.", 'Done. Proud of that work.', 'Time. Good session.'],
  burst: ['Burst! All out!', 'Go go go! All out!', 'Ten seconds, everything you have!'],
  backToTech: ['Back to technique. Hands home.', 'Ease off. Clean shots now.', 'Breathe. Back to sharp, clean work.'],
};

const last = {};
export function line(key, rand = Math.random) {
  const opts = LINES[key];
  if (!opts) return null;
  let i = Math.floor(rand() * opts.length);
  if (opts.length > 1 && opts[i] === last[key]) i = (i + 1) % opts.length;
  last[key] = opts[i];
  return opts[i];
}

export const hasLine = (key) => key in LINES;
