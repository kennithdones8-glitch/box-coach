// How far each punch TYPE the camera reports can be trusted, measured on the boxer's labelled
// clips (npm run accuracy; tests/fixtures/clips.json). Counting a punch and telling which hand
// threw it is far more reliable than telling a cross from a rear hook, so types the camera gets
// wrong more often than right are shown as unverified and never drive coaching.
//
// Precision: of the punches the camera called this type, the share that really were. Front-on and
// 45° clips only (side-on sessions are left out of punch types altogether: see typesOk in coach.js).
// Update these from `npm run accuracy` when the classifier or the labelled clips change; a test
// checks they still match.
export const TYPE_PRECISION = {
  jab: { precision: 90, called: 19 },
  cross: { precision: 75, called: 20 },
  leadHook: { precision: 85, called: 27 },
  rearHook: { precision: 17, called: 12 },
  leadUppercut: { precision: 0, called: 3 },
  rearUppercut: { precision: null, called: 0 }, // never called on a labelled clip: unknown
};
export const MIN_PRECISION = 50; // right more often than wrong
export const MIN_CALLED = 10; // and on enough labelled punches to say

export const typeTrusted = (type) => {
  const t = TYPE_PRECISION[type];
  return !!t && t.precision != null && t.precision >= MIN_PRECISION && t.called >= MIN_CALLED;
};
