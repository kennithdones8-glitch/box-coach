// Boxer tab: the development model made visible.
import { SKILLS, SKILL_GROUPS, OPPONENTS, PATTERN_LIBRARY } from '../library.js';
import { evidenceFor, proofOfImprovement, styleProfile, developmentTimeline, compareThen, levelWord } from '../skills.js';
import { fatigueMap, medAnalysis, DIM_NAMES } from '../analysis.js';
import { BOXING_TYPES, TARGETS, outputPpm, speedText } from '../coach.js';
import { lineChart } from '../chart.js';
import { badges } from '../badges.js';
import { myCard, shareLink, COMPARE } from '../friends.js';
import { $, $$, esc, shortDate, subnav, subOf, deltaHTML, confDot, scoreClass, toast, pageHead } from '../ui.js';
import { newId } from '../store.js';

// Progress tab: session history first, then what the sessions add up to.
export { PROGRESS_SUBS } from '../ui.js';
import { PROGRESS_SUBS } from '../ui.js';

export function renderBoxer(view, app) {
  const sub = subOf('skills');
  const ctx = app.model();
  const body = { skills, analysis, style, timeline, charts }[sub] || skills;
  const measured = ctx.skills.filter((x) => x.confidence !== 'none').length;
  view.innerHTML = `${pageHead('Progress', { eyebrow: `${app.state.sessions.length} sessions · ${measured} of 18 skills measured`, nav: subnav('progress', PROGRESS_SUBS, sub) })}<div id="boxerBody"></div>`;
  body($('#boxerBody'), app, ctx);
}

// ---------------------------------------------------------------------------

function skills(el, app, ctx) {
  const byGroup = Object.fromEntries(SKILL_GROUPS.map((g) => [g, ctx.skills.filter((s) => s.group === g)]));
  el.innerHTML = `
    <p class="muted small" style="margin:0 2px 10px">Calculated from evidence — camera, sparring, drills, decisions and coach notes. Unmeasured skills sit at 50. Tap a skill for its proof.</p>
    <div class="legend" style="margin:0 2px 12px"><span>${confDot('high')}High confidence</span><span>${confDot('medium')}Medium</span><span>${confDot('low')}Low</span><span>${confDot('none')}None</span></div>
    ${SKILL_GROUPS.map((g) => `
      <section class="card">
        <h3 class="group-h">${g}</h3>
        ${byGroup[g].map((s) => `
          <button class="skill-row" data-skill="${s.key}">
            <span class="skill-name">${confDot(s.confidence)}${esc(s.name)}</span>
            <span class="skill-bar"><span class="${s.confidence === 'none' ? 'none' : scoreClass(s.rating, 65)}" style="width:${s.rating}%"></span></span>
            <span class="skill-val"><b>${s.rating}</b>${deltaHTML(s.delta)}</span>
          </button>`).join('')}
      </section>`).join('')}
    <dialog id="skillDlg"></dialog>`;
  $$('[data-skill]', el).forEach((b) => b.addEventListener('click', () => openSkill(b.dataset.skill, app, ctx)));
}

function openSkill(key, app, ctx) {
  const s = ctx.skills.find((x) => x.key === key);
  const proof = proofOfImprovement(app.state, key, ctx.now, 8, ctx.evidence);
  const ev = evidenceFor(ctx.evidence, key);
  const d = $('#skillDlg');
  d.innerHTML = `
    <div class="dialog-body">
      <div class="eyebrow">${esc(s.group)} · ${s.confidence} confidence</div>
      <h2>${esc(s.name)}: ${s.prev != null ? `${s.prev} → ` : ''}${s.rating}</h2>
      <p class="small"><b>Evidence:</b> ${esc(s.summary)}</p>
      <h3>Proof of improvement</h3>
      ${proof.from != null ? `<p class="proof-head ${proof.change > 0 ? 'good' : proof.change < 0 ? 'bad' : ''}">${proof.change > 0 ? '+' : ''}${proof.change}% over ${proof.weeks} weeks <span class="muted small">(${proof.from} → ${proof.to})</span></p>` : '<p class="muted small">Not enough history for an 8-week comparison yet.</p>'}
      ${proof.lines.length ? `<ul class="proof">${proof.lines.map((l) => `<li class="${l.good ? 'good' : 'bad'}">${esc(l.text)}</li>`).join('')}</ul>` : '<p class="muted small">Measured metrics appear here as camera, sparring and drill data builds up.</p>'}
      <h3>Recent evidence</h3>
      ${ev.length ? `<ul class="evidence">${ev.map((e) => `<li><span class="ev-v ${scoreClass(e.value, 65)}">${e.value}</span><span>${esc(e.detail || '')}<br><span class="muted small">${shortDate(e.date)} · ${esc(e.source)} · weight ${e.weight.toFixed(1)}</span></span></li>`).join('')}</ul>` : '<p class="muted small">No evidence yet.</p>'}
      <button class="btn primary block" data-close>Close</button>
    </div>`;
  d.querySelector('[data-close]').addEventListener('click', () => d.close());
  d.showModal();
}

// ---------------------------------------------------------------------------

function analysis(el, app, ctx) {
  const state = app.state;
  const lastCam = [...state.sessions].reverse().find((s) => fatigueMap(s, state.profile));
  const fm = lastCam ? fatigueMap(lastCam, state.profile) : null;
  const cross = medAnalysis(state.sessions, 'cross', state.profile);
  const exp = ctx.exposure;
  const expMax = Math.max(1, ...Object.values(exp.counts));
  el.innerHTML = `
    <section class="card">
      <h2>Round-by-round fatigue map</h2>
      ${fm ? `
        <p class="muted small">${esc(new Date(lastCam.date).toLocaleDateString())} · ${lastCam.completedRounds} rounds</p>
        <div class="tbl-wrap"><table class="tbl fmap"><thead><tr><th>Round</th>${['technique', 'pace', 'defense', 'footwork'].map((d) => `<th>${DIM_NAMES[d]}</th>`).join('')}</tr></thead>
        <tbody>${fm.rows.map((r) => `<tr><td>R${r.round}</td>${['technique', 'pace', 'defense', 'footwork'].map((d) => `<td class="${scoreClass(r[d], 75)}${fm.breaks[d] === r.round ? ' brk' : ''}">${r[d] ?? '–'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <div class="msg">${esc(fm.conclusion)}</div>` : '<p class="muted small">Do a camera session of 3+ rounds to see how each part of your game holds up round by round.</p>'}
    </section>

    <section class="card">
      <h2>Technique decay</h2>
      ${ctx.decay.length ? ctx.decay.map((f) => `<div class="finding ${f.kind}"><span class="tag">${f.kind === 'fatigue' ? 'Fatigue-induced' : 'Technical'}</span><p>${esc(f.text)}</p><p class="small"><b>What to do:</b> ${esc(f.advice)}</p></div>`).join('')
        : '<p class="muted small">No consistent decay pattern yet. I compare your first two rounds with your last two across recent camera sessions.</p>'}
    </section>

    <section class="card">
      <h2>Why do you get hit?</h2>
      ${ctx.hits.total ? `<p class="muted small">Last ${ctx.hits.sessions} sessions · ${ctx.hits.total} defensive failures logged</p>
        <div class="breakdown">${ctx.hits.shares.map((h) => `<div class="bd-row"><span>${esc(h.name)}</span><div class="bd-bar"><div style="width:${h.pct}%"></div></div><b>${h.pct}%</b></div>`).join('')}</div>
        ${ctx.hits.top ? `<div class="msg">Biggest recurring problem: <b>${esc(ctx.hits.top.name.toLowerCase())}</b>. Your plan attacks this automatically.</div>` : ''}`
        : '<p class="muted small">Log sparring in the Log tab and tap why you got hit each time. After a few sessions I\'ll show what\'s really costing you.</p>'}
    </section>

    <section class="card">
      <h2>Training transfer</h2>
      <p class="muted small">Does what you drill show up under pressure? Drilling → shadowboxing → bag → sparring.</p>
      ${ctx.transfer.length ? ctx.transfer.map((t) => `
        <div class="transfer">
          <div class="tr-head"><b>${esc(t.name)}</b><span class="badge ${scoreClass(t.transfer, 70)}">${t.transfer}%</span></div>
          <div class="funnel">
            <span><b>${t.ctx.drill.reps}</b>drilled</span><span><b>${t.ctx.shadow.uses}</b>shadow</span><span><b>${t.ctx.bag.uses}</b>bag</span><span><b>${t.ctx.sparring.used}</b>sparring</span><span><b>${t.ctx.sparring.landed}</b>landed</span>
          </div>
          <p class="small">${esc(t.message)}</p>
          <button class="linkbtn small" data-archive="${t.id}">Stop tracking</button>
        </div>`).join('') : '<p class="muted small">Add a combination you\'re developing and I\'ll track whether it transfers.</p>'}
      <details class="add"><summary class="btn ghost block">+ Track a pattern</summary>
        <div class="chipset">${PATTERN_LIBRARY.map((p, i) => `<button class="chip" data-lib="${i}">${esc(p.name)}</button>`).join('')}</div>
        <form id="patForm" class="form">
          <label>Or your own<input name="name" maxlength="60" placeholder="e.g. Jab → pull → cross counter"></label>
          <label>Punch numbers (for camera auto-count, optional)<input name="seq" maxlength="20" placeholder="e.g. 1-2-3"></label>
          <button class="btn primary" type="submit">Add</button>
        </form>
      </details>
    </section>

    <section class="card">
      <h2>Minimum effective dose</h2>
      <p>${esc(ctx.med.message)}</p>
      <p class="muted small">${esc(cross.message)}</p>
    </section>

    <section class="card">
      <h2>Opponent exposure</h2>
      <p class="muted small">Rounds in the last 45 days (shadowboxing scenarios + sparring partners).</p>
      <div class="breakdown">${Object.entries(exp.counts).map(([k, n]) => `<div class="bd-row"><span>${esc(OPPONENTS[k].name)}</span><div class="bd-bar"><div style="width:${(n / expMax) * 100}%"></div></div><b>${n}</b></div>`).join('')}</div>
      <div class="msg">${esc(exp.message)}</div>
    </section>`;

  $$('[data-lib]', el).forEach((b) => b.addEventListener('click', () => {
    const p = PATTERN_LIBRARY[+b.dataset.lib];
    addPattern(app, { ...p });
  }));
  $('#patForm', el).addEventListener('submit', (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    if (!name) return;
    const seq = e.target.seq.value.trim().replace(/[^1-6-]/g, '') || null;
    addPattern(app, { name, seq, skills: ['combinations'] });
  });
  $$('[data-archive]', el).forEach((b) => b.addEventListener('click', () => {
    const p = app.state.patterns.find((x) => x.id === b.dataset.archive);
    if (p) p.active = false;
    app.persist();
    app.rerender();
  }));
}

function addPattern(app, p) {
  if (app.state.patterns.some((x) => x.active !== false && x.name === p.name)) return toast('Already tracking that one.');
  app.state.patterns.push({ id: newId(), active: true, created: new Date().toISOString(), ...p });
  app.persist();
  toast(`Tracking "${p.name}".`);
  app.rerender();
}

// ---------------------------------------------------------------------------

function style(el, app, ctx) {
  const now = styleProfile(app.state, ctx.now);
  const before = styleProfile(app.state, new Date(+ctx.now - 30 * 86400000));
  const cls = { High: 'good', Strong: 'good', Moderate: 'warn', Low: 'bad', Weak: 'bad' };
  el.innerHTML = `
    <section class="card">
      <h2>Your current style profile</h2>
      <p class="muted small">Discovered from the last 30 days of training, not assigned. It will change as you do.</p>
      ${now.traits.length ? `<ul class="traits">${now.traits.map((t) => `<li><span class="lvl ${cls[t.level] || ''}">${t.level}</span> ${esc(t.label)} <span class="muted small">· ${esc(t.detail)}</span></li>`).join('')}</ul>`
        : '<p class="muted small">Not enough data yet — a few camera sessions and a sparring log will reveal your tendencies.</p>'}
      ${now.lean ? `<div class="msg">Currently leaning: <b>${esc(now.lean)}</b>${before.lean && before.lean !== now.lean ? ` (was ${esc(before.lean)} a month ago)` : before.lean ? ' — same as a month ago' : ''}.</div>` : ''}
    </section>`;
}

// ---------------------------------------------------------------------------

function timeline(el, app, ctx) {
  const tl = developmentTimeline(app.state, ctx.now, 6, ctx.evidence);
  const cmp = compareThen(app.state, ctx.now, 90, ctx.evidence);
  el.innerHTML = `
    <section class="card">
      <h2>Development timeline</h2>
      ${tl.length ? `<ol class="timeline">${tl.map((m) => `
        <li><div class="tl-month">${esc(m.label)}</div>
          <div class="tl-body"><b>${esc(m.headline)}</b>
            <p class="small muted">${m.sessions} sessions</p>
            ${m.improving.length ? `<p class="small">Improving: ${m.improving.map((x) => `${esc(SKILLS[x.key].name)} ${x.from}→${x.to}`).join(', ')}</p>` : ''}
            ${m.declining.length ? `<p class="small">Slipping: ${m.declining.map((x) => `${esc(SKILLS[x.key].name)} ${x.from}→${x.to}`).join(', ')}</p>` : ''}
            ${m.events.length ? `<ul class="small">${m.events.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
          </div></li>`).join('')}</ol>` : '<p class="muted small">Your timeline starts with your first session.</p>'}
    </section>
    <section class="card">
      <h2>You 3 months ago vs now</h2>
      ${cmp.length && cmp.every((c) => c.then == null) ? '<p class="muted small">Your history is younger than 3 months, so "then" fills in as time passes.</p>' : ''}
      ${cmp.length ? `<table class="tbl"><thead><tr><th>Skill</th><th>Then</th><th>Now</th></tr></thead><tbody>
        ${cmp.map((c) => `<tr><td class="left">${esc(c.name)}</td><td>${c.then != null ? `${c.then} <span class="muted small">${levelWord(c.then)}</span>` : '–'}</td><td><b>${c.now}</b> <span class="muted small">${levelWord(c.now)}</span></td></tr>`).join('')}
      </tbody></table>` : '<p class="muted small">Needs training history.</p>'}
    </section>`;
}

// ---------------------------------------------------------------------------

// Earned badges first, then the next few to go for with how close you are.
function badgesHTML(state) {
  const all = badges(state.sessions, state.profile);
  const got = all.filter((b) => b.earned);
  const next = all.filter((b) => !b.earned).sort((a, b) => b.have / b.need - a.have / a.need).slice(0, 3);
  return `<section class="card"><div class="card-head"><h2>Badges</h2><span class="muted small">${got.length} of ${all.length}</span></div>
    ${got.length ? `<div class="badges">${got.map((b) => `<span class="badge-chip" title="${esc(b.how)}">${b.icon} ${esc(b.name)}</span>`).join('')}</div>` : ''}
    <ul class="rows small next-badges">${next.map((b) => `<li><span class="row-ico">${b.icon}</span><div class="grow"><b>${esc(b.name)}</b><br><span class="muted">${esc(b.how)}</span><div class="bar"><div style="width:${Math.round((100 * b.have) / b.need)}%"></div></div></div><span class="muted">${b.need > 1 ? `${b.have.toLocaleString()}/${b.need.toLocaleString()}` : ''}</span></li>`).join('')}</ul>
  </section>`;
}

// You next to the friends whose links you opened (their numbers are from when they shared).
function friendsHTML(state) {
  const me = myCard(state);
  const fr = state.friends.slice(-3).reverse();
  const val = (c, k) => (c[k] == null ? '–' : k === 'h' ? speedText(c[k], state.profile.unit) : c[k].toLocaleString());
  return `<section class="card"><div class="card-head"><h2>Friends</h2><button class="linkbtn small" id="shareStats" type="button">Share my stats</button></div>
    ${fr.length ? `<div class="tbl-wrap"><table class="tbl small"><thead><tr><th class="left"></th><th>You</th>${fr.map((f) => `<th>${esc(f.n)}<br><button class="linkbtn small" data-unfriend="${esc(f.i)}" type="button" aria-label="Remove ${esc(f.n)}">remove</button></th>`).join('')}</tr></thead>
      <tbody>${COMPARE.map(([label, k]) => `<tr><td class="left">${label}</td><td><b>${val(me, k)}</b></td>${fr.map((f) => `<td>${val(f, k)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="small muted" style="margin:6px 0 0">Their numbers are from ${fr.map((f) => `${esc(f.n)} on ${f.d ? esc(shortDate(f.d + 'T12:00:00')) : '?'}`).join(', ')}. Ask them to share again for fresh ones.</p>`
    : '<p class="small muted" style="margin:0">Send your stats to a training partner; when they open the link in BoxCoach you show up side by side. Nothing is uploaded: your numbers travel inside the link.</p>'}
  </section>`;
}

function charts(el, app) {
  const state = app.state;
  const box = state.sessions.filter((s) => s.type in BOXING_TYPES && !s.manual).slice(-20);
  const pts = (fn) => box.map((s) => ({ x: shortDate(s.date), y: fn(s) })).filter((p) => p.y != null);
  const prs = Object.entries(state.memory.prs).map(([k, p]) => ({ ...p, value: k === 'fastestHands' ? speedText(p.value, state.profile.unit) : p.value }));
  const weeks = [];
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  for (let i = 7; i >= 0; i--) {
    const start = new Date(monday);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const mins = state.sessions.filter((s) => new Date(s.date) >= start && new Date(s.date) < end)
      .reduce((a, s) => a + (s.durationMin || Math.round((s.totalSec || s.workSec || 0) / 60)), 0);
    weeks.push({ x: shortDate(start), y: mins });
  }
  el.innerHTML = `
    <section class="card"><h2>Personal records</h2>
      ${prs.length ? `<div class="prs">${prs.map((p) => `<div><b>${p.value}</b><span>${esc(p.label)}</span><em>${shortDate(p.date)}</em></div>`).join('')}</div>` : '<p class="muted">Records show up after your first session.</p>'}
    </section>
    ${badgesHTML(state)}
    ${friendsHTML(state)}
    <section class="card"><h3>Overall score</h3><div id="c-overall"></div></section>
    <section class="card"><h3>Punches per minute</h3><div id="c-ppm"></div></section>
    <section class="card"><h3>Guard up %</h3><div id="c-guard"></div></section>
    ${box.some((s) => s.form?.speed != null) ? `<section class="card"><h3>Hand speed (${state.profile.unit === 'kg' ? 'km/h' : 'mph'})</h3><div id="c-speed"></div><p class="small muted" style="margin:6px 0 0">The camera's estimate, from the same spot each time it's a fair comparison.</p></section>` : ''}
    <section class="card"><h3>Stance held %</h3><div id="c-stance"></div></section>
    <section class="card"><h3>Training minutes per week</h3><div id="c-weeks"></div></section>`;
  $('#shareStats')?.addEventListener('click', async () => {
    if (!state.profile.shareId) { state.profile.shareId = newId(); app.persist(); }
    const url = shareLink(myCard(state));
    try {
      if (navigator.share) await navigator.share({ title: 'My BoxCoach stats', text: `${state.profile.name || 'My'} boxing this week — open it in BoxCoach to compare:`, url });
      else { await navigator.clipboard.writeText(url); toast('Link copied. Send it to your training partner.'); }
    } catch { /* share sheet closed */ }
  });
  $$('[data-unfriend]').forEach((b) => b.addEventListener('click', () => {
    state.friends = state.friends.filter((f) => f.i !== b.dataset.unfriend);
    app.persist();
    charts(el, app);
  }));
  lineChart($('#c-overall'), pts((s) => s.scores?.overall), { max: 100, label: 'Overall score' });
  lineChart($('#c-ppm'), pts((s) => outputPpm(s)), { label: 'Punches per minute' });
  const k = state.profile.unit === 'kg' ? 3.6 : 2.237;
  if ($('#c-speed')) lineChart($('#c-speed'), pts((s) => (s.form?.speed != null ? Math.round(s.form.speed * k) : null)), { label: 'Hand speed' });
  lineChart($('#c-guard'), pts((s) => s.form?.guard), { max: 100, unit: '%', target: TARGETS.guard, label: 'Guard up percent' });
  lineChart($('#c-stance'), pts((s) => s.form?.stance), { max: 100, unit: '%', target: TARGETS.stance, label: 'Stance percent' });
  lineChart($('#c-weeks'), weeks, { unit: ' min', label: 'Minutes per week' });
}
