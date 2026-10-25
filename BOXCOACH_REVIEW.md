# BoxCoach engineering review (2026.10.25-3)

What was checked, what changed, what the evidence says, and what still needs real footage or a
phone. Numbers here are measured in this repository; nothing on an iPhone was verified.

## Punch accuracy (`npm run accuracy`)

The labelled data is 3 real clips (`tests/fixtures/clips.json`), 151 labelled punches plus 45 detections nobody labelled.
Each row is a punch the app detected, with the true punch number, so these clips measure **punch type**, not detection.
Missed and extra punches can't be scored from them.
`bag-side.json` only has a hand count (45–50 real punches); its test checks that the count lands in that range.

| Clip | Camera | Labels | n | Type right | Baseline (lead = jab, rear = cross) |
|---|---|---|---|---|---|
| pads-side-on | side | drilled combo | 70 | 23% | 53% |
| shadow-front-on | front | drilled combo | 50 | 58% | 58% |
| chest-front-test | front | punch test | 31 | 90% | 55% |

Pooled front-on precision: jab 90%, cross 75%, lead hook 85%, rear hook 17%, lead uppercut 0%, rear uppercut never called (0 times).

The top mistakes are cross → rear hook (×26) and jab ↔ lead hook (×25).
"Hand" agreement is 100% only because the labels were assigned per detected hand.

Findings:
- **Side-on punch types are worse than not classifying.** So a session's punch mix only counts when it was mostly filmed from the front or at 45° (`typesOk` in `coach.js`, using the existing 60% "side-on" rule).
- **True rear hooks and crosses misread as rear hooks have the same features** (sideways travel 0.1–0.34, elbow 95–136°). No threshold separates them on this data, and tuning one would overfit 3 clips.
  - Instead, `trust.js` marks types the camera calls right less than half the time as **unverified**: shown, but never coached from.
  - A test keeps `trust.js` in step with the measured numbers.
- **The classifier's margin is not calibrated.** Margin 0.6–0.8 was right 28% of the time; under 0.4 it was right 90%. It isn't used to hide uncertain types. The review screen's "%" now says it means how clearly the punch was seen, not whether its type is right.

No classifier change was made: the floors (23 / 58 / 90%) are unchanged.

To move them, record a front-on bag round and a side-on round, and label them frame by frame.
`matchEvents` in `scripts/evaluate.mjs` already scores time-stamped labels one to one: missed punches, false detections and types.

## Personal reader (`personal.js`)

- It is checked session against session when the examples come from 2+ batches (`addExamples` tags each batch). Leave-one-out let near-identical punch-test punches vouch for each other. With one batch it must beat the built-in reader by 10 points instead of 5.
- Damaged examples are skipped.
- A kind taught fewer than 3 times, or a close vote (< 60%), keeps the built-in reading.
- Random labels never take over (tested).

## Video speed

The pose model on a slow phone (about 51 ms on the iPhone report) always made the analysis pause on every frame.
It now plays the video slowed down (≥ 0.5×) when that keeps up (`flow.js`). It still falls back to pausing and rewinding if frames slip by.

Measured in headless Chromium on a 20 s 1080p clip, with a 51 ms pose stand-in:

| | Mode | Time ÷ video length | Frames |
|---|---|---|---|
| Before | step | 1.91× | 299 |
| After | flow 0.67× | 1.56× | 292 |

The before figure matches the 1.7× seen on the iPhone. Not yet measured on an iPhone.

Also:
- the preview overlay is drawn at most about 12 times a second;
- the colour sampler no longer reallocates its canvas;
- the status line doesn't rescan every event;
- a second tap can't start a second job;
- the analyser itself costs about 0.07 ms a frame (Node, desktop).

## Coaching

- Today leads with the single root problem Coach me builds the session around, with its follow-up.
- Scores, habits, form fixes and drills are not produced from sessions the camera lost you in (`trackingOk`).
- Type-based metrics (opener, calls) need `typesOk`.
- "Taking hold" / "slipping" need 2+ measured sessions on each side, like with like (bag vs bag) when possible.

## Safety and data

- Fuel gives no grade for a day with nothing logged. The grade is described as a guide to estimated targets.
- The streak allows 2 rest days in a row.
- XP isn't doubled by a duplicate session or water logs.
- Damaged saved records are set aside (`boxcoach.quarantine`, downloadable in Settings) instead of crashing screens.
- A finished video analysis is saved as an unsaved session until reviewed. The video itself can't survive a reload.
- localStorage stays: per-punch rows are already trimmed to the latest 12 sessions, and nothing large (video, sheets) is stored. IndexedDB wasn't worth a migration yet.

## Needs real footage or a phone

1. Frame-labelled front-on and side-on clips, to score detection (missed / extra) and to tune the cross ↔ rear hook boundary.
2. An iPhone video report, to confirm flow mode at about 0.9× and the new time ÷ length.
3. Feint accuracy, partner rejection in sparring, and recovery when iOS kills the app.
