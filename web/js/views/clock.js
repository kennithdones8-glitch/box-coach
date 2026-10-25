// Train → Stopwatch and Round timer: plain clocks. No voice, no camera, no coaching. When you're
// done it asks whether to save it to your log.
import { Stopwatch, RoundTimer, fmt, fmtMs } from '../timer.js';
import * as audio from '../audio.js';
import { newId } from '../store.js';
import { $, $$, toast } from '../ui.js';

const sw = new Stopwatch();
let rt = null; // the running round timer
let rtCfg = { rounds: 3, roundSec: 180, restSec: 60, warn: false };
let rtStartedAt = null;
let ask = null; // { kind, workSec, totalSec, rounds, date } waiting for "save it?"
let tick = null;
let wake = null;

const TYPES = [['shadow', 'Shadow'], ['bag', 'Bag'], ['mitts', 'Mitts'], ['sparring', 'Sparring'], ['rope', 'Rope'], ['conditioning', 'Conditioning']];
const keepAwake = async (on) => {
  try {
    if (on && !wake) wake = await navigator.wakeLock?.request('screen');
    if (!on && wake) { wake.release?.(); wake = null; }
  } catch { /* optional */ }
};
const loop = (fn) => { clearInterval(tick); tick = setInterval(() => { if (!document.body.contains(document.getElementById('clockFace'))) return; fn(); }, 50); };

function askHTML() {
  if (!ask) return '';
  return `<section class="card save-ask">
    <h2>Save ${ask.kind === 'rounds' ? `${ask.rounds} round${ask.rounds === 1 ? '' : 's'}` : fmt(ask.totalSec)} to your log?</h2>
    <p class="small muted" style="margin:2px 0 8px">It counts toward your streak and XP.</p>
    <div class="seg wide" role="radiogroup" aria-label="What was it">${TYPES.map(([k, l], i) => `<label><input type="radio" name="stype" value="${k}" ${i === (ask.kind === 'rounds' ? 1 : 0) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
    <div class="row2" style="margin-top:12px"><button class="btn primary" type="button" id="saveYes">Save</button><button class="btn ghost" type="button" id="saveNo">Don't save</button></div>
  </section>`;
}

function bindAsk(el, app, redraw) {
  $('#saveYes', el)?.addEventListener('click', () => {
    const type = el.querySelector('[name=stype]:checked')?.value || 'shadow';
    const s = {
      id: newId(), manual: true, source: 'manual', timer: ask.kind, type, date: ask.date,
      durationMin: Math.max(1, Math.round(ask.totalSec / 60)), workSec: ask.workSec, totalSec: ask.totalSec, rpe: null, notes: '',
    };
    if (ask.kind === 'rounds') { s.completedRounds = ask.rounds; s.plan = { rounds: ask.plan.rounds, roundSec: ask.plan.roundSec, restSec: ask.plan.restSec }; }
    app.logSession(s);
    ask = null;
    toast('Saved to your log.');
    redraw();
  });
  $('#saveNo', el)?.addEventListener('click', () => { ask = null; redraw(); });
}

export function renderStopwatch(el, app) {
  const run = sw.running, t = sw.elapsed();
  const laps = sw.laps;
  const best = laps.length > 1 ? Math.min(...laps) : null, worst = laps.length > 1 ? Math.max(...laps) : null;
  el.innerHTML = `
    <section class="clock-card">
      <div class="clock-face" id="clockFace" role="timer" aria-label="Stopwatch">${fmtMs(t)}</div>
      <div class="clock-btns">
        ${run ? '<button class="btn ghost big" type="button" id="swLap">Lap</button><button class="btn danger big" type="button" id="swStop">Stop</button>'
        : t ? '<button class="btn ghost big" type="button" id="swReset">Reset</button><button class="btn primary big" type="button" id="swGo">Resume</button>'
        : '<button class="btn primary big block-span" type="button" id="swGo">Start</button>'}
      </div>
    </section>
    ${askHTML()}
    ${laps.length ? `<section class="card"><div class="card-head"><h2>Laps</h2><span class="muted small">${laps.length}</span></div>
      <ol class="laps">${laps.map((l, i) => [l, i]).reverse().map(([l, i]) => `<li class="${l === best ? 'best' : l === worst ? 'worst' : ''}"><span>Lap ${i + 1}</span><b class="num">${fmtMs(l)}</b><span class="muted num">${fmtMs(laps.slice(0, i + 1).reduce((a, b) => a + b, 0))}</span></li>`).join('')}</ol>
    </section>` : ''}`;
  const redraw = () => renderStopwatch(el, app);
  $('#swGo', el)?.addEventListener('click', () => { audio.unlockAudio(); sw.start(); keepAwake(true); redraw(); });
  $('#swStop', el)?.addEventListener('click', () => { sw.pause(); keepAwake(false); redraw(); });
  $('#swLap', el)?.addEventListener('click', () => { sw.lap(); audio.vibrate?.(20); redraw(); });
  $('#swReset', el)?.addEventListener('click', () => {
    const total = Math.round(sw.elapsed() / 1000);
    if (total >= 60) ask = { kind: 'stopwatch', totalSec: total, workSec: total, date: sw.startedAt };
    sw.reset();
    redraw();
  });
  bindAsk(el, app, redraw);
  loop(() => { $('#clockFace').textContent = fmtMs(sw.elapsed()); });
}

const PHASE = { prep: 'Get ready', work: 'Round', rest: 'Rest', done: 'Done' };

export function renderRoundTimer(el, app) {
  const on = rt && rt.phase !== 'done';
  const secs = [30, 60, 90, 120, 150, 180, 240, 300];
  const rests = [0, 15, 30, 45, 60, 90, 120];
  el.innerHTML = `
    <section class="clock-card ${on ? `ph-${rt.phase}` : ''}">
      ${on ? `<div class="clock-ph">${PHASE[rt.phase]}${rt.phase === 'work' || rt.phase === 'rest' ? ` ${rt.round} / ${rt.rounds}` : ''}${rt.paused ? ' · paused' : ''}</div>
        <div class="clock-face" id="clockFace" role="timer" aria-label="Time left">${fmt(Math.ceil(rt.remainingMs / 1000))}</div>
        <div class="clock-btns"><button class="btn ghost big" type="button" id="rtPause">${rt.paused ? 'Resume' : 'Pause'}</button><button class="btn danger big" type="button" id="rtEnd">End</button></div>`
      : `<div class="clock-face" id="clockFace">${fmt(rtCfg.roundSec)}</div>
        <div class="row3 clock-set">
          <label>Rounds<select id="rtRounds">${Array.from({ length: 15 }, (_, i) => `<option ${i + 1 === rtCfg.rounds ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label>
          <label>Round<select id="rtRound">${secs.map((s) => `<option value="${s}" ${s === rtCfg.roundSec ? 'selected' : ''}>${fmt(s)}</option>`).join('')}</select></label>
          <label>Rest<select id="rtRest">${rests.map((s) => `<option value="${s}" ${s === rtCfg.restSec ? 'selected' : ''}>${fmt(s)}</option>`).join('')}</select></label>
        </div>
        <label class="switch" style="margin-top:10px"><input type="checkbox" id="rtWarn" ${rtCfg.warn ? 'checked' : ''}> <span>10-second clapper</span></label>
        <button class="btn primary big block" type="button" id="rtGo">Start · ${fmt(rtCfg.rounds * rtCfg.roundSec + (rtCfg.rounds - 1) * rtCfg.restSec)}</button>
        <p class="small muted center" style="margin:8px 0 0">Bells only. No voice, no camera.</p>`}
    </section>
    ${askHTML()}`;
  const redraw = () => renderRoundTimer(el, app);
  const finish = () => {
    const rounds = rt.phase === 'done' ? rt.rounds : rt.round - (rt.phase === 'work' ? 1 : 0);
    const workSec = Math.round(rt.workMs / 1000);
    if (rounds >= 1 || workSec >= 60) ask = { kind: 'rounds', rounds: Math.max(rounds, 0), workSec, totalSec: Math.round((Date.now() - +new Date(rtStartedAt)) / 1000), date: rtStartedAt, plan: { ...rtCfg } };
    rt.stop();
    rt = null;
    keepAwake(false);
  };
  const cfg = () => { rtCfg = { rounds: +$('#rtRounds').value, roundSec: +$('#rtRound').value, restSec: +$('#rtRest').value, warn: $('#rtWarn').checked }; };
  $$('#rtRounds, #rtRound, #rtRest, #rtWarn', el).forEach((x) => x.addEventListener('change', () => { cfg(); redraw(); }));
  $('#rtGo', el)?.addEventListener('click', () => {
    cfg();
    audio.unlockAudio();
    rtStartedAt = new Date().toISOString();
    rt = new RoundTimer({
      ...rtCfg, prepSec: 10,
      onPhase: (phase) => {
        if (!rt?.catchingUp) {
          if (phase === 'work') audio.bell(1);
          if (phase === 'rest') audio.bell(2);
          if (phase === 'done') audio.bell(3);
          audio.vibrate?.(phase === 'done' ? [300, 100, 300] : 200);
        }
        if (phase === 'done') finish();
        if (document.getElementById('clockFace')) redraw();
      },
      onTick: (phase, left) => {
        if (rtCfg.warn && phase === 'work' && left === 10) audio.clap();
        if ((phase === 'rest' || phase === 'prep') && left <= 3 && left > 0) audio.tick();
      },
      onWake: () => { if (document.getElementById('clockFace')) redraw(); },
    });
    rt.start();
    keepAwake(true);
    redraw();
  });
  $('#rtPause', el)?.addEventListener('click', () => { rt.togglePause(); redraw(); });
  $('#rtEnd', el)?.addEventListener('click', () => { finish(); redraw(); });
  bindAsk(el, app, redraw);
  loop(() => { if (rt && rt.phase !== 'done') $('#clockFace').textContent = fmt(Math.ceil(rt.remainingMs / 1000)); });
}

// For the Train screen: is a clock running right now?
export const clockRunning = () => ({ stopwatch: sw.running, rounds: !!rt && rt.phase !== 'done' });
