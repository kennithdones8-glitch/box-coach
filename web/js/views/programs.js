// Train → Programs and Train → Drills: pro-built multi-week plans, and a library of short drills.
import { PROGRAMS, PROGRAM_CATS, programById, programProgress, stepLabel, stepMinutes, suggestProgram } from '../programs.js';
import { allDrills, DRILL_CATS, CAT_ICON } from '../drills.js';
import { $, $$, esc, toast } from '../ui.js';
import { programIcs, DEFAULT_DAYS } from '../reminders.js';

let progCat = 'all';
let drillCat = 'all';
let openDrill = null;

const TYPE_ICON = { shadow: '🥊', bag: '🎯' };
const stepIcon = (st) => (st.plan.defense ? '🛡️' : st.plan.rounds === 8 && st.plan.roundSec === 20 ? '🔥' : TYPE_ICON[st.plan.type] || '🥊');
const tagLine = (p) => `<span class="plvl ${p.level === 'Beginner' ? 'beg' : p.level === 'Advanced' ? 'adv' : 'mid'}">${esc(p.level)}</span><span class="dotsep">•</span>${esc(PROGRAM_CATS.find(([k]) => k === p.cat)?.[1] || p.cat)}`;

export const progressOf = (state, p) => programProgress(p, state.sessions, state.profile.programs?.[p.id]?.since);

function programCard(state, p, { wide = false } = {}) {
  const pr = progressOf(state, p);
  const started = pr.done > 0;
  return `<article class="prog-card ${wide ? 'wide' : ''} cat-${p.cat}">
    <a class="pg-link" href="#train/programs/${p.id}" aria-label="${esc(p.name)}: see the plan"></a>
    <div class="pg-tag">${tagLine(p)}</div>
    <h3 class="pg-name">${esc(p.name)}</h3>
    <p class="pg-blurb">${esc(p.blurb)}</p>
    <div class="pg-meta"><span>${p.weeks} wk</span><span>${p.steps.length} sessions</span>${started ? `<span class="gold">${pr.finished ? 'Done ✓' : `${pr.pct}%`}</span>` : ''}</div>
    ${started && !pr.finished ? `<div class="bar thin"><div style="width:${pr.pct}%"></div></div>` : ''}
    <button class="btn primary sm pg-go" type="button" data-start="${p.id}">▶ ${pr.finished ? 'Again' : started ? 'Continue' : 'Start'}</button>
  </article>`;
}

function drillCard(d, open) {
  return `<article class="drill-card ${open ? 'open' : ''}" data-cat="${d.cat}">
    <button class="dc-head" type="button" data-open-drill="${d.id}" aria-expanded="${open}">
      <span class="dc-ico" aria-hidden="true">${CAT_ICON[d.cat]}</span>
      <span class="dc-min">${d.mins} min</span>
      <b class="dc-name">${esc(d.name)}</b>
      <span class="dc-how">${d.tag ? `${esc(d.tag)} · ` : ''}${esc(d.how)}</span>
    </button>
    ${open ? `<div class="dc-more">
      <p class="small">Cue: <b>${esc(d.cue)}</b></p>
      <p class="small muted">${d.plan.rounds} × ${d.plan.roundSec >= 60 ? `${d.plan.roundSec / 60} min` : `${d.plan.roundSec} s`}, ${d.plan.restSec} s rest${d.plan.type === 'bag' ? ' · on the bag' : ''}${d.plan.defense ? ' · camera checks each move' : ''}</p>
      <button class="btn primary block" type="button" data-drill-go="${d.id}">▶ Start drill</button>
    </div>` : ''}
  </article>`;
}

export function renderPrograms(el, app) {
  const state = app.state;
  const id = location.hash.split('/')[2];
  const one = id && programById(id);
  if (one) return renderProgram(el, app, one);
  const active = programById(state.profile.program);
  const ap = active && progressOf(state, active);
  const suggest = programById(suggestProgram(state.profile));
  const list = PROGRAMS.filter((p) => progCat === 'all' || p.cat === progCat);
  const drills = allDrills();
  const picks = ['slip-roll', 'weight-transfer', 'pivot-out', 'tabata', 'triple-jab', 'head-after'].map((x) => drills.find((d) => d.id === x)).filter(Boolean);

  el.innerHTML = `
    ${active && !ap.finished ? `<section class="hero-band">
      <div class="eyebrow">Your program · ${ap.pct}%</div>
      <h2 class="hb-title">${esc(active.name)}</h2>
      <p class="hb-sub"><b>${esc(stepLabel(active, ap.next))}:</b> ${esc(active.steps[ap.next].name)} · ${stepMinutes(active.steps[ap.next])} min</p>
      <div class="bar"><div style="width:${ap.pct}%"></div></div>
      <div class="hb-btns"><button class="btn primary big" type="button" data-step="${active.id}:${ap.next}">▶ Start</button><a class="btn ghost big" href="#train/programs/${active.id}">Plan</a></div>
    </section>` : `<section class="hero-band">
      <div class="eyebrow">Programs</div>
      <h2 class="hb-title">${PROGRAMS.length} pro programs. Zero guesswork.</h2>
      <p class="hb-sub">From your first jab to fight night. Every session is called out and measured by the camera.</p>
      <a class="btn primary big block" href="#train/programs/${suggest.id}">Suggested for you: ${esc(suggest.name)} →</a>
    </section>`}

    <div class="sec-head"><h2>Programs</h2><span class="muted small">${PROGRAMS.length} pro-built plans</span></div>
    <div class="chips filt" role="group" aria-label="Filter programs">${PROGRAM_CATS.map(([k, l]) => `<button class="chip ${k === progCat ? 'on' : ''}" type="button" data-pcat="${k}" aria-pressed="${k === progCat}">${esc(l)}</button>`).join('')}</div>
    <div class="carousel">${list.map((p) => programCard(state, p)).join('')}</div>

    <div class="sec-head"><h2>Drills</h2><a class="small" href="#train/drills">All ${drills.length} →</a></div>
    <p class="small muted" style="margin:-6px 2px 10px">Focused skill sessions, a few minutes each.</p>
    <div class="drill-grid">${picks.map((d) => drillCard(d, openDrill === d.id)).join('')}</div>
    <p class="small muted" style="margin:12px 2px 0">Want to set your own rounds? <a href="#train/session">Custom session →</a></p>`;
  bind(el, app);
}

export function renderDrills(el, app) {
  const drills = allDrills().filter((d) => drillCat === 'all' || d.cat === drillCat);
  el.innerHTML = `
    <div class="chips filt" role="group" aria-label="Filter drills">${DRILL_CATS.map(([k, l]) => `<button class="chip ${k === drillCat ? 'on' : ''}" type="button" data-dcat="${k}" aria-pressed="${k === drillCat}">${k === 'all' ? '' : `${CAT_ICON[k]} `}${esc(l)}</button>`).join('')}</div>
    <div class="drill-grid">${drills.map((d) => drillCard(d, openDrill === d.id)).join('')}</div>
    <p class="small muted" style="margin:12px 2px 0">Punch drills are followed up on the Punches page: it checks whether they changed that punch in your other training.</p>`;
  bind(el, app, () => renderDrills(el, app));
}

function renderProgram(el, app, p) {
  const state = app.state;
  const pr = progressOf(state, p);
  const avgMin = Math.round(p.steps.reduce((a, s) => a + stepMinutes(s), 0) / p.steps.length);
  const weeks = Array.from({ length: p.weeks }, (_, w) => p.steps.map((st, i) => [st, i]).slice(w * p.perWeek, (w + 1) * p.perWeek));
  el.innerHTML = `
    <a class="back" href="#train/programs">‹ Programs</a>
    <section class="hero-band">
      <div class="pg-tag">${tagLine(p)}</div>
      <h2 class="hb-title">${esc(p.name)}</h2>
      <p class="hb-sub">${esc(p.blurb)}</p>
      <div class="stats4 hb-stats">
        <div><b>${p.weeks}</b><span>weeks</span></div>
        <div><b>${p.perWeek}</b><span>a week</span></div>
        <div><b>${avgMin}</b><span>min each</span></div>
        <div><b>${pr.done}/${pr.total}</b><span>done</span></div>
      </div>
      <div class="bar"><div style="width:${pr.pct}%"></div></div>
      ${pr.finished ? `<p class="hb-sub" style="margin-top:10px"><b>Finished ✓</b> Check your numbers in Punches and Progress.</p>
        <button class="btn ghost big block" type="button" data-restart="${p.id}">Start it again</button>`
        : `<button class="btn primary big block" type="button" data-step="${p.id}:${pr.next}">▶ ${pr.done ? 'Continue' : 'Start'} · ${esc(p.steps[pr.next].name)}</button>`}
    </section>
    ${pr.finished ? '' : remindHTML(state, p)}
    ${weeks.map((steps, w) => `
    <div class="sec-head"><h2>Week ${w + 1}</h2><span class="muted small">${steps.filter(([, i]) => pr.doneSteps.has(i)).length} of ${steps.length}</span></div>
    <ol class="steps-list">${steps.map(([st, i]) => {
      const done = pr.doneSteps.has(i), next = i === pr.next;
      return `<li class="${done ? 'done' : ''} ${next ? 'next' : ''}">
        <span class="sl-n" aria-label="${done ? 'Done' : `Day ${(i % p.perWeek) + 1}`}">${done ? '✓' : (i % p.perWeek) + 1}</span>
        <div class="sl-main"><b>${stepIcon(st)} ${esc(st.name)}</b><span class="small muted">${st.plan.rounds} × ${st.plan.roundSec >= 60 ? `${st.plan.roundSec / 60} min` : `${st.plan.roundSec} s`} · ${stepMinutes(st)} min${st.plan.type === 'bag' ? ' · bag' : ''}</span><span class="small">${esc(st.note)}</span></div>
        <button class="btn ${next ? 'primary' : 'ghost'} sm" type="button" data-step="${p.id}:${i}" aria-label="Start ${esc(st.name)}">${done ? 'Redo' : '▶'}</button>
      </li>`;
    }).join('')}</ol>`).join('')}
    <p class="small muted" style="margin:12px 2px 0">A session counts once you finish at least half its rounds. Do them in order, about ${p.perWeek} a week, with rest days between hard ones.</p>`;
  bind(el, app, () => renderProgram(el, app, p));
  bindRemind(el, app, p, pr);
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const remindOf = (state, p) => state.profile.programs?.[p.id]?.remind || { days: DEFAULT_DAYS[p.perWeek] || [0, 2, 4], time: '18:00' };

function remindHTML(state, p) {
  const r = remindOf(state, p);
  return `<details class="card remind" ${state.profile.programs?.[p.id]?.remind ? '' : 'open'}>
    <summary><b>⏰ Reminders</b><span class="muted small">${r.days.map((d) => WEEKDAYS[d]).join(' · ')} at ${esc(r.time)}</span></summary>
    <p class="small muted" style="margin:8px 0">Puts each session in your phone's calendar with an alert 15 minutes before. Pick ${p.perWeek} days.</p>
    <div class="daychips" role="group" aria-label="Training days">${WEEKDAYS.map((n, d) => `<button type="button" data-rday="${d}" class="${r.days.includes(d) ? 'on' : ''}" aria-pressed="${r.days.includes(d)}">${n}</button>`).join('')}</div>
    <div class="row2" style="margin-top:10px;align-items:end"><label>Time<input type="time" id="remTime" value="${esc(r.time)}"></label><button class="btn primary" type="button" id="remAdd">📅 Add</button></div>
  </details>`;
}

function bindRemind(el, app, p, pr) {
  const state = app.state;
  const save = (r) => { state.profile.programs = { ...(state.profile.programs || {}), [p.id]: { ...(state.profile.programs?.[p.id] || {}), remind: r } }; app.persist(); };
  $$('[data-rday]', el).forEach((b) => b.addEventListener('click', () => {
    const r = remindOf(state, p), d = +b.dataset.rday;
    const days = r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d].sort((a, c) => a - c);
    if (!days.length) return;
    save({ ...r, days, time: $('#remTime').value || r.time });
    renderProgram(el, app, p);
    el.querySelector('.remind').open = true;
  }));
  $('#remAdd', el)?.addEventListener('click', async () => {
    const r = { ...remindOf(state, p), time: $('#remTime').value || '18:00' };
    save(r);
    const { ics, count, first } = programIcs(p, pr.next, { ...r, url: location.href.split('#')[0], minutes: stepMinutes });
    const file = new File([ics], `boxcoach-${p.id}.ics`, { type: 'text/calendar' });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `${p.name} sessions` });
      else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        document.body.append(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      }
      toast(`${count} sessions from ${first.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}. Open the file to add them.`);
    } catch (e) {
      if (e?.name !== 'AbortError') toast('Could not make the calendar file.');
    }
  });
}

function bind(el, app, redraw = () => renderPrograms(el, app)) {
  const state = app.state;
  $$('[data-pcat]', el).forEach((b) => b.addEventListener('click', () => { progCat = b.dataset.pcat; redraw(); }));
  $$('[data-dcat]', el).forEach((b) => b.addEventListener('click', () => { drillCat = b.dataset.dcat; openDrill = null; redraw(); }));
  $$('[data-open-drill]', el).forEach((b) => b.addEventListener('click', () => { openDrill = openDrill === b.dataset.openDrill ? null : b.dataset.openDrill; redraw(); }));
  $$('[data-drill-go]', el).forEach((b) => b.addEventListener('click', () => app.startLibraryDrill(allDrills().find((d) => d.id === b.dataset.drillGo))));
  $$('[data-step]', el).forEach((b) => b.addEventListener('click', () => {
    const [pid, i] = b.dataset.step.split(':');
    app.startProgramStep(programById(pid), +i);
  }));
  $$('[data-start]', el).forEach((b) => b.addEventListener('click', () => {
    const p = programById(b.dataset.start);
    const pr = progressOf(state, p);
    if (pr.finished) restart(app, p.id);
    app.startProgramStep(p, pr.finished ? 0 : pr.next);
  }));
  $$('[data-restart]', el).forEach((b) => b.addEventListener('click', () => { restart(app, b.dataset.restart); redraw(); }));
}

// Progress counts sessions after this moment.
function restart(app, id) {
  const s = app.state;
  s.profile.programs = { ...(s.profile.programs || {}), [id]: { since: new Date().toISOString() } };
  s.profile.program = id;
  app.persist();
}
