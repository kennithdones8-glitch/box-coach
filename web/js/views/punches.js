// Punches: your punch analysis on one page. What you throw, how each punch is doing and changing,
// what to work on, and drills for it (each one starts as a practice session).
import { punchStats, drillsFor, PUNCH_DRILLS } from '../punchstats.js';
import { PUNCH_DIGIT } from '../form.js';
import { speedIn } from '../coach.js';
import { $$, esc, shortDate, pageHead } from '../ui.js';

const RANGES = [[30, '30 days'], [90, '90 days'], [0, 'All time']];
let days = 30;
let open = null; // the punch whose drills are showing

export function renderPunches(el, app) {
  const state = app.state;
  const unit = state.profile.unit;
  const sp = (ms) => (ms == null ? '–' : speedIn(ms, unit));
  const spUnit = unit === 'kg' ? 'km/h' : 'mph';
  const st = punchStats(state.sessions, { days: days || null });
  const label = days ? `Last ${days} days` : 'All time';
  const vsTxt = days ? `the ${days} days before` : '';
  const max = Math.max(1, ...st.types.map((x) => x.share || 0));
  const delta = (d, unitTxt = '', better = 1) => (d == null || d === 0 ? '' : `<span class="dl ${d * better > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}${unitTxt}</span>`);
  const anySpeed = st.types.some((x) => x.speed != null);
  const focusType = st.focus;
  const focusX = focusType && st.types.find((x) => x.type === focusType);
  const focusDrill = focusX ? drillsFor(focusType, focusX.focus)[0] : null;

  const drillHTML = (type, list) => `<ul class="drills">${list.map((d, i) => `
    <li>
      <div class="dr-head"><b>${esc(d.name)}</b><button class="btn primary sm" type="button" data-drill="${type}:${PUNCH_DRILLS[type].indexOf(d)}">Practise</button></div>
      <p class="small">${esc(d.how)}</p>
      <p class="small dr-cue">Cue: <b>${esc(d.cue)}</b> · calls ${d.calls.map(esc).join(' / ')}</p>
    </li>`).join('')}</ul>`;

  el.innerHTML = `
    ${pageHead('Punches', { eyebrow: `${label} · ${st.sessions} camera session${st.sessions === 1 ? '' : 's'}` })}
    <div class="seg range" role="group" aria-label="Period">${RANGES.map(([k, l]) => `<label><input type="radio" name="prange" value="${k}" ${k === days ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
    ${!st.total ? `
    <section class="card">
      <h2>No punch data in this period</h2>
      <p class="small muted">Punch stats come from sessions the camera tracked well: train with the camera on, or analyse a video. ${days ? 'Or pick a longer period.' : ''}</p>
      <a class="btn primary block" href="#train">Train with the camera</a>
    </section>` : `
    <section class="card">
      <div class="stats4">
        <div><b>${st.total.toLocaleString()}</b><span>punches</span></div>
        <div><b>${st.ppm ?? '–'}</b><span>per min</span></div>
        <div><b>${st.comboShare != null ? `${st.comboShare}%` : '–'}</b><span>combos</span></div>
        <div><b>${st.feintsPerMin ?? '–'}</b><span>feints/m</span></div>
      </div>
      ${anySpeed ? '' : '<p class="small muted" style="margin:8px 0 0">Punch speed shows once you have recent camera sessions (the per-punch detail is kept for your latest 12).</p>'}
    </section>

    ${focusX ? `
    <section class="card focus-card">
      <div class="eyebrow">Work on next</div>
      <h2>${esc(focusX.name)}: ${esc(focusX.focus[0].text.toLowerCase())}</h2>
      ${focusX.focus.length > 1 ? `<p class="small muted">Also: ${focusX.focus.slice(1).map((f) => esc(f.text.toLowerCase())).join(' · ')}</p>` : ''}
      <p class="small"><b>${esc(focusDrill.name)}.</b> ${esc(focusDrill.how)}</p>
      <button class="btn primary block" type="button" data-drill="${focusType}:${PUNCH_DRILLS[focusType].indexOf(focusDrill)}">Practise: 3 × 2 min</button>
    </section>` : ''}

    <section class="card">
      <div class="card-head"><h2>Punch mix</h2>${days ? `<span class="muted small">vs ${vsTxt}</span>` : ''}</div>
      <div class="mix">${st.types.map((x) => `
        <div class="mix-row">
          <span class="pnum">${PUNCH_DIGIT[x.type]}</span>
          <span class="mix-name">${esc(x.name)}</span>
          <div class="mix-bar"><div style="width:${((x.share || 0) / max) * 100}%"></div></div>
          <b class="num">${x.share ?? 0}%</b>
          ${delta(x.shareDelta, '', 0) || '<span class="dl"></span>'}
        </div>`).join('')}</div>
      <p class="small muted" style="margin:8px 0 0">${st.total.toLocaleString()} punches from ${st.sessions} session${st.sessions === 1 ? '' : 's'}.${st.reads ? ` Camera read rates from your punch test on ${esc(shortDate(st.reads.date))}.` : ' Do a punch test to see how well the camera reads each punch.'}</p>
    </section>

    <section class="card">
      <h2>What changed</h2>
      ${st.changes.length ? `<ul class="changes">${st.changes.slice(0, 6).map((c) => `<li class="${c.good === true ? 'good' : c.good === false ? 'bad' : ''}">${c.good === true ? '▲' : c.good === false ? '▼' : '•'} ${esc(c.text)}</li>`).join('')}</ul>
        <p class="small muted" style="margin:6px 0 0">Against ${vsTxt || 'earlier'} (${st.prevSessions} session${st.prevSessions === 1 ? '' : 's'}).</p>`
      : `<p class="small muted" style="margin:0">${days ? `Not enough to compare yet: it needs camera sessions in both this period and ${vsTxt} (${st.sessions} now, ${st.prevSessions} before).` : 'Pick 30 or 90 days to compare with the period before.'}</p>`}
    </section>

    <div class="section-label">Each punch</div>
    ${st.types.map((x) => `
    <section class="card punch-card ${x.focus.length ? 'has-focus' : ''}">
      <button class="pc-head" type="button" data-open="${x.type}" aria-expanded="${open === x.type}">
        <span class="pnum big">${PUNCH_DIGIT[x.type]}</span>
        <span class="pc-name"><b>${esc(x.name)}</b><span>${x.lead ? 'Lead hand' : 'Rear hand'}${x.focus.length ? ' · <em>work on this</em>' : ''}</span></span>
        <span class="chev">${open === x.type ? '▾' : '›'}</span>
      </button>
      <div class="pc-stats">
        <div><b class="num">${x.n.toLocaleString()}</b><span>thrown</span></div>
        <div><b class="num">${sp(x.speed)}</b><span>${spUnit}${x.speed != null ? ` ${delta(x.speedDelta != null ? Math.round((speedIn(x.speed, unit) - speedIn(x.speed - x.speedDelta, unit)) * 10) / 10 : null)}` : ''}</span></div>
        <div><b class="num">${x.returnMs ?? '–'}</b><span>ms home</span></div>
        <div><b class="num">${x.read != null ? `${x.read}%` : '–'}</b><span>cam read</span></div>
      </div>
      ${x.focus.length ? `<ul class="pc-focus">${x.focus.map((f) => `<li>${esc(f.text)}</li>`).join('')}</ul>` : ''}
      ${x.speed == null && x.n && anySpeed ? `<p class="small muted" style="margin:6px 0 0">Speed needs 5+ of these from recent camera sessions (${x.speedN} so far).</p>` : ''}
      ${open === x.type ? drillHTML(x.type, drillsFor(x.type, x.focus)) : ''}
    </section>`).join('')}

    <section class="card punch-card">
      <button class="pc-head" type="button" data-open="feints" aria-expanded="${open === 'feints'}">
        <span class="pnum big">F</span>
        <span class="pc-name"><b>Feints</b><span>Hand feints the camera saw</span></span>
        <span class="chev">${open === 'feints' ? '▾' : '›'}</span>
      </button>
      <div class="pc-stats three">
        <div><b class="num">${st.feints}</b><span>feints</span></div>
        <div><b class="num">${st.feintsPerMin ?? '–'}</b><span>per min</span></div>
        <div><b class="num">${st.feints ? `${Math.round((100 * st.feintSetups) / st.feints)}%` : '–'}</b><span>led to a punch</span></div>
      </div>
      ${open === 'feints' ? drillHTML('feints', PUNCH_DRILLS.feints) : ''}
    </section>

    <p class="small muted" style="margin:6px 2px 16px">Counts come only from sessions the camera tracked well and with nobody else in frame; punch tests are left out. Speed and hand return are camera estimates: compare them with yourself, from the same camera spot. "Camera read" is how often your last punch test read that punch right: when it's low, that punch's count is less certain.</p>`}`;

  $$('input[name=prange]', el).forEach((r) => r.addEventListener('change', () => { days = +r.value; renderPunches(el, app); }));
  $$('[data-open]', el).forEach((b) => b.addEventListener('click', () => { open = open === b.dataset.open ? null : b.dataset.open; renderPunches(el, app); }));
  $$('[data-drill]', el).forEach((b) => b.addEventListener('click', () => {
    const [type, i] = b.dataset.drill.split(':');
    const d = PUNCH_DRILLS[type]?.[+i];
    if (d) app.startDrill(type, d);
  }));
}
