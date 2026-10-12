import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROGRAMS, PROGRAM_CATS, programProgress, stepLabel, suggestProgram } from '../web/js/programs.js';
import { allDrills, DRILL_CATS } from '../web/js/drills.js';
import { targets, goalFrom, gradeDay, dayPace, FOODS, kgOf } from '../web/js/nutrition.js';
import { parseCombo } from '../web/js/combos.js';
import { CONSTRAINTS, OPPONENTS } from '../web/js/library.js';

test('programs: 14, each step a session the app can run (calls parse, constraints exist)', () => {
  assert.equal(PROGRAMS.length, 14);
  assert.equal(new Set(PROGRAMS.map((p) => p.id)).size, 14);
  const cats = PROGRAM_CATS.map(([k]) => k);
  for (const p of PROGRAMS) {
    assert.ok(cats.includes(p.cat), p.id);
    assert.equal(p.steps.length, p.weeks * p.perWeek, `${p.id} has a step for every day`);
    for (const st of p.steps) {
      const pl = st.plan;
      assert.ok(pl.rounds >= 1 && pl.roundSec >= 20 && pl.restSec >= 0, `${p.id}: ${st.name}`);
      for (const c of pl.callList || []) assert.ok(parseCombo(c), `${p.id}: "${c}" parses`);
      if (pl.rounds_) {
        assert.equal(pl.rounds_.length, pl.rounds, `${p.id}: ${st.name} has a problem per round`);
        for (const r of pl.rounds_) {
          assert.ok(CONSTRAINTS[r.constraint], r.constraint);
          if (r.opponent) assert.ok(OPPONENTS[r.opponent], r.opponent);
        }
      }
    }
  }
});

test('program progress comes from saved sessions; half the rounds counts; restart resets', () => {
  const p = PROGRAMS.find((x) => x.id === 'jab-lab');
  const s = (step, done, date = '2026-10-01T10:00:00.000Z') => ({ date, completedRounds: done, plan: { rounds: 3 }, program: { id: 'jab-lab', step } });
  let pr = programProgress(p, []);
  assert.deepEqual([pr.done, pr.next, pr.finished], [0, 0, false]);
  pr = programProgress(p, [s(0, 3), s(1, 1), { date: '2026-10-02', completedRounds: 3, plan: { rounds: 3 }, program: { id: 'other', step: 1 } }]);
  assert.equal(pr.done, 1, 'one round of three is not done; another program does not count');
  assert.equal(pr.next, 1);
  assert.equal(stepLabel(p, 4), 'Week 2 · Day 2');
  pr = programProgress(p, p.steps.map((_, i) => s(i, 2)));
  assert.ok(pr.finished);
  assert.equal(pr.pct, 100);
  assert.equal(programProgress(p, p.steps.map((_, i) => s(i, 3)), '2026-10-05T00:00:00.000Z').done, 0, 'started again: earlier sessions no longer count');
  assert.equal(suggestProgram({ level: 'beginner' }), 'fundamentals');
  assert.equal(suggestProgram({ level: 'advanced', fightDate: '2999-01-01' }), 'fight-camp');
});

test('drill library: every drill runs, punch drills keep their punch', () => {
  const ds = allDrills();
  const cats = DRILL_CATS.map(([k]) => k);
  assert.equal(new Set(ds.map((d) => d.id)).size, ds.length);
  for (const d of ds) {
    assert.ok(cats.includes(d.cat), d.id);
    assert.ok(d.mins >= 3 && d.mins <= 15, `${d.id}: ${d.mins} min`);
    for (const c of d.plan.callList || []) assert.ok(parseCombo(c), `${d.id}: "${c}" parses`);
    for (const r of d.plan.rounds_ || []) assert.ok(CONSTRAINTS[r.constraint], r.constraint);
  }
  const jab = ds.find((d) => d.punch === 'jab');
  assert.ok(jab.punchDrill && jab.cat === 'punches');
  assert.ok(ds.some((d) => d.plan.defense), 'the camera-checked defense drill is in the library');
});

test('fuel targets: from weight and training, lower for a cut', () => {
  const kg = kgOf(176, 'lb');
  assert.ok(Math.abs(kg - 79.8) < 0.2);
  const rest = targets({ kg: 80 });
  const train = targets({ kg: 80, trainMin: 60 });
  assert.equal(rest.protein, 160);
  assert.ok(train.kcal - rest.kcal > 500 && train.kcal - rest.kcal < 800, 'an hour of boxing is ~650 kcal at 80 kg');
  assert.ok(train.water > rest.water);
  assert.ok(targets({ kg: 80, goal: 'cut' }).kcal < rest.kcal);
  assert.equal(targets({ kg: null }), null, 'no weight, no targets');
  assert.equal(goalFrom(180, 165), 'cut');
  assert.equal(goalFrom(165, 165), 'keep');
  assert.equal(goalFrom(150, 165), 'gain');
  assert.equal(goalFrom(150, null), 'keep');
  assert.ok(FOODS.every((f) => f.kcal >= 0 && f.protein >= 0 && f.protein * 4 <= f.kcal + 10), 'protein never has more calories than the food');
});

test('fuel grade: on pace, not the full day', () => {
  const tg = targets({ kg: 80 }); // 2400 kcal, 160 g protein
  const at = (h) => new Date(2026, 9, 12, h, 0);
  assert.equal(dayPace(at(14)).pace, 0.5);
  assert.ok(gradeDay([], tg, { now: at(7) }).early, 'nothing expected before the day starts');
  // Half the day, half of everything: an A.
  const half = [{ kcal: 1200, protein: 80 }, { water: tg.water / 2 }];
  const g = gradeDay(half, tg, { now: at(14) });
  assert.equal(g.letter, 'A');
  assert.equal(g.headline, 'Right on pace');
  // Same food in the evening: behind.
  const late = gradeDay(half, tg, { now: at(20) });
  assert.ok(late.score < g.score);
  // Light breakfast at midday, protein low: F-ish and the tip says protein.
  const light = gradeDay([{ kcal: 300, protein: 8 }], tg, { now: at(13) });
  assert.ok(['D', 'F'].includes(light.letter));
  assert.match(light.tips[0], /Protein is behind/);
  // Way over on a cut is marked down.
  const cut = targets({ kg: 80, goal: 'cut' });
  const over = gradeDay([{ kcal: 2500, protein: 110 }, { water: 2000 }], cut, { now: at(14) });
  assert.equal(over.rows.find((r) => r.key === 'kcal').status, 'over');
  assert.match(over.tips.join(' '), /cut/);
});

import { bmr, mealIdeas, fightWeek, FOODS as F2 } from '../web/js/nutrition.js';
import { sessionXp, xpTotal, levelOf, dayStreak, LEVELS } from '../web/js/xp.js';
import { programIcs, sessionDates } from '../web/js/reminders.js';

test('fuel: height, age and sex give a closer estimate; meal ideas fit what is left', () => {
  assert.equal(bmr(80, { height: 180, age: 30, sex: 'm' }), 1780);
  assert.equal(bmr(80, { skipped: true }), null);
  const exact = targets({ kg: 80, body: { height: 180, age: 30, sex: 'm' } });
  assert.ok(exact.exact && Math.abs(exact.kcal - 2490) <= 10);
  const tg = targets({ kg: 80 });
  const ideas = mealIdeas({ kcal: 600, protein: 20 }, tg, { pace: 0.5 });
  assert.equal(ideas.length, 3);
  for (const m of ideas) {
    assert.ok(m.ids.every((id) => F2.some((f) => f.id === id)));
    assert.ok(m.protein >= 20, `${m.name}: protein-heavy when protein is behind`);
  }
  assert.equal(new Set(ideas.flatMap((m) => m.ids)).size, ideas.flatMap((m) => m.ids).length, 'no food repeated');
  assert.deepEqual(mealIdeas({ kcal: tg.kcal, protein: tg.protein }, tg, { pace: 0.9 }), [], 'nothing left to eat');
  assert.equal(fightWeek(10), null);
  assert.match(fightWeek(1).join(' '), /coach/);
});

test('XP and levels come from sessions; day streak counts days in a row', () => {
  assert.equal(sessionXp({ completedRounds: 3 }), 50);
  assert.equal(sessionXp({ completedRounds: 3, program: { id: 'x' } }), 90);
  assert.equal(levelOf(0).name, 'Rookie');
  assert.equal(levelOf(850).name, 'Amateur');
  assert.equal(levelOf(850).pct, 6);
  assert.equal(levelOf(99999).next, null);
  assert.equal(LEVELS.length, 9);
  const food = [1, 2, 3].map(() => ({ day: '2026-10-10' }));
  assert.equal(xpTotal([{ completedRounds: 3 }], food), 65, 'a day of food logging adds a little');
  const now = new Date(2026, 9, 12, 20);
  const at = (d) => new Date(2026, 9, d, 18).toISOString();
  assert.equal(dayStreak([at(10), at(11), at(12)].map((date) => ({ date })), now), 3);
  assert.equal(dayStreak([at(10), at(11)].map((date) => ({ date })), now), 2, 'not trained yet today: the streak still stands');
  assert.equal(dayStreak([at(9), at(11)].map((date) => ({ date })), new Date(2026, 9, 13, 9)), 0);
});

test('program reminders: a calendar event per remaining session on the chosen days', () => {
  const from = new Date(2026, 9, 12, 19, 0); // Monday 7 pm, after 6 pm
  const ds = sessionDates(3, [0, 2, 4], '18:00', from);
  assert.deepEqual(ds.map((d) => d.getDate()), [14, 16, 19], 'Monday 6 pm has passed: Wed, Fri, next Mon');
  const p = PROGRAMS.find((x) => x.id === 'jab-lab');
  const { ics, count } = programIcs(p, 2, { days: [0, 2, 4], time: '18:00', from, url: 'https://example.org/app/', minutes: () => 8 });
  assert.equal(count, 4);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 4);
  assert.equal((ics.match(/BEGIN:VALARM/g) || []).length, 4);
  assert.match(ics, /DTSTART:20261014T180000/);
  assert.match(ics, /DTEND:20261014T181000/, 'at least 10 minutes long');
  assert.ok(ics.split('\r\n').every((l) => Array.from(l).length <= 75), 'lines folded');
  assert.ok(ics.startsWith('BEGIN:VCALENDAR') && ics.trimEnd().endsWith('END:VCALENDAR'));
});
