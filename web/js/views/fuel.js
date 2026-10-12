// Fuel: log what you eat and drink, see calories, protein and water against today's targets, and
// a grade for your pace so far with what to do next. Everything stays on the phone.
import { FOODS, FOOD_CATS, targets, goalFrom, gradeDay, totals, kgOf, waterText } from '../nutrition.js';
import { weightStats, localDay } from '../plan.js';
import { $, $$, esc, toast, pageHead } from '../ui.js';

let foodCat = 'Protein';
let query = '';

const LABEL = { kcal: 'Calories', protein: 'Protein', water: 'Water' };
const STATUS = { on: 'On pace', behind: 'Behind', well: 'Well behind', over: 'Over pace' };

export function renderFuel(el, app) {
  const state = app.state;
  const { profile } = state;
  const today = localDay(new Date());
  const entries = state.food.filter((e) => e.day === today);
  const ws = weightStats(state.weights, profile);
  const kg = kgOf(ws?.avg7, profile.unit);
  const tr = app.trainingToday();
  const tg = targets({ kg, trainMin: Math.max(tr.doneMin, tr.plannedMin), goal: goalFrom(ws?.avg7, profile.targetWeight) });
  const g = tg && gradeDay(entries, tg, { trainedToday: tr.doneMin > 0, unit: profile.unit });
  const fmtV = (k, v) => (k === 'water' ? waterText(v, profile.unit) : k === 'kcal' ? v.toLocaleString() : `${v} g`);
  const waterBtns = profile.unit === 'lb' ? [[237, '+8 oz'], [473, '+16 oz'], [710, '+24 oz']] : [[250, '+250 ml'], [500, '+500 ml'], [750, '+750 ml']];
  const q = query.trim().toLowerCase();
  const foods = q ? FOODS.filter((f) => f.name.toLowerCase().includes(q)) : FOODS.filter((f) => f.cat === foodCat);

  el.innerHTML = `
    ${pageHead('Fuel', { eyebrow: g ? `${esc(g.part)} · ${Math.round(g.pace * 100)}% through the day` : 'Nutrition' })}
    ${!tg ? `<section class="card hero">
      <h2>Your weight first</h2>
      <p class="small muted">Targets come from your body weight and today's training.</p>
      <form id="fuelWeight" class="row2"><label>Weight (${esc(profile.unit)})<input name="w" type="number" inputmode="decimal" min="30" max="500" step="0.1" required></label><button class="btn primary" type="submit" style="align-self:end">Save</button></form>
    </section>` : `
    <section class="grade-hero">
      ${g.early ? `<div class="grade-ring empty"><b>–</b></div><h2 class="gh-head">The day's just started</h2><p class="gh-sub">Log breakfast and you'll get a grade.</p>`
      : `<div class="grade-ring g-${g.letter}" style="--v:${g.score}"><b>${g.letter}</b><span>${g.score} / 100</span></div>
      <h2 class="gh-head">${esc(g.headline)}</h2>
      <p class="gh-sub">Graded on your pace, not the full day.</p>`}
    </section>

    ${g.early ? '' : `<section class="card coach-card">
      <div class="eyebrow gold">🥗 Fuel coach</div>
      <ul class="tips">${g.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    </section>`}

    <section class="card">
      <div class="card-head"><h2>Pace vs plan</h2><span class="muted small">${tg.goal === 'cut' ? 'Cutting' : tg.goal === 'gain' ? 'Gaining' : 'Maintain'}</span></div>
      ${['kcal', 'protein', 'water'].map((k) => {
        const got = totals(entries)[k], target = tg[k];
        const row = g.rows?.find((r) => r.key === k);
        return `<div class="pace-row">
          <div class="pr-top"><b>${LABEL[k]}</b>${row ? `<span class="pill ${row.status}">${STATUS[row.status]}</span>` : ''}<span class="pr-v"><b class="num">${fmtV(k, got)}</b> <span class="muted">/ ${fmtV(k, target)}</span></span></div>
          <div class="pace-bar"><div class="pb-fill ${row?.status || ''}" style="width:${Math.min(100, (got / target) * 100)}%"></div>${g.pace ? `<i class="pb-mark" style="left:${Math.min(100, g.pace * 100)}%" title="Where you should be by now"></i>` : ''}</div>
        </div>`;
      }).join('')}
      <p class="small muted" style="margin:6px 0 0">${g.early ? '' : 'The line marks where you should be by now. '}${tg.trainMin ? `Includes ${tg.trainMin} min of training today.` : 'Rest day targets.'}</p>
    </section>`}

    <section class="card">
      <div class="card-head"><h2>Water</h2>${tg ? `<span class="muted small">${waterText(totals(entries).water, profile.unit)} today</span>` : ''}</div>
      <div class="water-btns">${waterBtns.map(([ml, l]) => `<button class="btn ghost" type="button" data-water="${ml}">💧 ${l}</button>`).join('')}</div>
    </section>

    <section class="card">
      <h2>Log food</h2>
      <input id="foodSearch" class="search" type="search" placeholder="Search foods" value="${esc(query)}" aria-label="Search foods">
      ${q ? '' : `<div class="chips filt" role="group" aria-label="Food type">${FOOD_CATS.map((c) => `<button class="chip ${c === foodCat ? 'on' : ''}" type="button" data-fcat="${c}" aria-pressed="${c === foodCat}">${c}</button>`).join('')}</div>`}
      <ul class="food-list">${foods.map((f) => `<li>
        <div class="grow"><b>${esc(f.name)}</b><span class="small muted">${esc(f.portion)} · ${f.kcal} kcal · ${f.protein} g protein</span></div>
        <button class="btn primary sm" type="button" data-food="${f.id}" aria-label="Add ${esc(f.name)}">+ Add</button>
      </li>`).join('') || '<li class="muted small">Nothing matches. Add it yourself below.</li>'}</ul>
      <details class="custom-food">
        <summary>Add your own</summary>
        <form id="customFood" class="form">
          <label>What<input name="name" maxlength="40" required placeholder="e.g. Mum's lasagne"></label>
          <div class="row2"><label>Calories<input name="kcal" type="number" inputmode="numeric" min="0" max="3000" required></label><label>Protein (g)<input name="protein" type="number" inputmode="numeric" min="0" max="300" value="0"></label></div>
          <button class="btn primary block" type="submit">Add</button>
        </form>
      </details>
    </section>

    <section class="card">
      <div class="card-head"><h2>Today</h2><span class="muted small">${entries.filter((e) => e.kcal != null).length} logged</span></div>
      ${entries.length ? `<ul class="rows log-list">${[...entries].reverse().map((e) => `<li>
        <span class="row-ico">${e.water ? '💧' : '🍽️'}</span>
        <div class="grow"><b>${esc(e.name)}</b><span class="small muted">${new Date(e.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}${e.water ? ` · ${waterText(e.water, profile.unit)}` : ` · ${e.kcal} kcal · ${e.protein} g`}</span></div>
        <button class="linkbtn small" type="button" data-del="${e.id}" aria-label="Remove ${esc(e.name)}">Remove</button>
      </li>`).join('')}</ul>` : '<p class="small muted" style="margin:0">Nothing yet. Tap + Add on what you ate.</p>'}
    </section>

    <p class="small muted" style="margin:6px 2px 16px">Targets are estimates from your weight and training: about ${tg?.goal === 'cut' ? '2.2' : '2'} g of protein per kg, calories for an active day plus your training, and water at 35 ml per kg plus more for training. Food values are typical portions. This isn't medical advice: if you're making weight for a fight, work with your coach or a sports dietitian, and never cut water to make weight without one.</p>`;

  const redraw = () => renderFuel(el, app);
  const add = (e) => {
    state.food = [...state.food, { id: Math.random().toString(36).slice(2, 10), day: today, at: new Date().toISOString(), ...e }]
      .filter((x) => x.day >= localDay(new Date(Date.now() - 90 * 86400000)));
    app.persist();
    redraw();
  };
  $('#fuelWeight')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = +e.target.w.value;
    if (!(v > 0)) return;
    state.weights = state.weights.filter((w) => w.date !== today).concat({ date: today, value: v });
    app.persist();
    redraw();
  });
  $$('[data-water]', el).forEach((b) => b.addEventListener('click', () => { add({ name: 'Water', water: +b.dataset.water }); toast('Water logged.'); }));
  $$('[data-food]', el).forEach((b) => b.addEventListener('click', () => {
    const f = FOODS.find((x) => x.id === b.dataset.food);
    add({ name: f.name, kcal: f.kcal, protein: f.protein, food: f.id });
    toast(`${f.name} added.`);
  }));
  $$('[data-fcat]', el).forEach((b) => b.addEventListener('click', () => { foodCat = b.dataset.fcat; redraw(); }));
  $$('[data-del]', el).forEach((b) => b.addEventListener('click', () => { state.food = state.food.filter((x) => x.id !== b.dataset.del); app.persist(); redraw(); }));
  const search = $('#foodSearch');
  search.addEventListener('input', () => {
    query = search.value;
    const pos = search.selectionStart;
    redraw();
    const s2 = $('#foodSearch');
    s2.focus();
    s2.setSelectionRange(pos, pos);
  });
  $('#customFood').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    add({ name: f.name.value.trim() || 'Food', kcal: Math.max(0, Math.round(+f.kcal.value || 0)), protein: Math.max(0, Math.round(+f.protein.value || 0)) });
    toast('Added.');
  });
}

// The small Fuel tile for Today: the grade so far, or a nudge to log.
export function fuelTile(state, trainingToday) {
  const today = localDay(new Date());
  const ws = weightStats(state.weights, state.profile);
  const kg = kgOf(ws?.avg7, state.profile.unit);
  const tg = targets({ kg, trainMin: Math.max(trainingToday.doneMin, trainingToday.plannedMin), goal: goalFrom(ws?.avg7, state.profile.targetWeight) });
  const entries = state.food.filter((e) => e.day === today);
  const g = tg && gradeDay(entries, tg, { trainedToday: trainingToday.doneMin > 0, unit: state.profile.unit });
  const t = totals(entries);
  return `<a class="th-tile th-fuel" href="#fuel">
    ${g && !g.early ? `<span class="grade-ring sm g-${g.letter}" style="--v:${g.score}"><b>${g.letter}</b></span>` : '<span class="ring sm empty"><b>🍽</b></span>'}
    <span class="th-t"><span class="th-l">Fuel</span><b>${g && !g.early ? esc(g.headline) : tg ? 'Log what you eat' : 'Set up nutrition'}</b><span class="th-s">${tg ? `${t.protein} / ${tg.protein} g protein · ${t.kcal.toLocaleString()} / ${tg.kcal.toLocaleString()} kcal` : 'Targets from your weight and training'}</span></span>
  </a>`;
}
