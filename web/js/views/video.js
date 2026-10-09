// Video intelligence: analyse an uploaded shadowboxing/sparring/bag video on-device,
// show every detection with a confidence score, let the boxer correct it, then save.
import { FormAnalyzer, PUNCH_DIGIT, combineRounds, sequencesFrom, streamFrom, comboStats, PUNCH_NAMES, choosePose, PersonTracker, personAt } from '../form.js';
import { ALL_TYPES } from '../coach.js';
import { $, $$, esc, opt, toast } from '../ui.js';
import { newId } from '../store.js';
import { comboLabel, comboText, parseCombo, STARTERS } from '../combos.js';
import { calibrateFromCombo, trustedCal } from '../calibrate.js';
import { harvest, addExamples, spotModel } from '../personal.js';
import { saveReference } from './study.js';
import { takePreset } from './handoff.js';
import { drawBody } from '../pose.js';
import { buildReport } from '../report.js';
import { FrameSheets, aiKey, checkWithClaude, applyAi, AI_MODELS, chatSheets, CHAT_PHOTOS } from '../aicheck.js';

let job = null; // { analyzer, events, rounds, meta } after analysis
let busy = false;
// True while a video is being analysed or waits for review: an app update must not reload then.
export const videoBusy = () => busy || !!job;

// Quick adds not saved yet can be picked straight from the video form; picking one saves it.
const unsavedStarters = (app) => STARTERS.filter((t) => !app.state.combos.some((c) => comboText(c.tokens) === comboText(parseCombo(t))));
function drillCombo(app, value) {
  if (!value) return null;
  if (!value.startsWith('s:')) return app.state.combos.find((c) => c.id === value) || null;
  const c = { id: newId(), tokens: parseCombo(value.slice(2)), name: '', created: new Date().toISOString() };
  app.state.combos.push(c);
  app.persist();
  return c;
}

// A saved punch calibration is only used if it proved itself (60%+ against a drilled combo).

const pctOf = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const fmtT = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

export function renderVideo(el, app) {
  if (job?.done) return renderReview(el, app);
  el.innerHTML = `
    <section class="card">
      <h2>Analyse a video</h2>
      <p class="muted small">Shadowboxing, pads, bag or sparring. It's analysed on your phone; nothing is uploaded unless you switch on the Claude check.</p>
      <details class="howto"><summary class="small"><b>How to film for the best reading</b></summary>
        <ul class="small">
          <li>Phone at chest height and level, not on the floor tilted up.</li>
          <li>Facing you, or at 45°. Side-on hides your far arm.</li>
          <li>Whole body in frame, head to feet, camera still.</li>
          <li>Good light, and iPhone Settings → Camera → Record Video → <b>1080p at 60 fps</b>: less blur on fast hands than 4K.</li>
        </ul>
      </details>
      <div class="msg" style="margin:0 0 12px">📋 Want Claude to check it? When the analysis finishes, tap <b>Copy report + save photos</b>, then paste and attach them in your Claude chat.</div>
      <form id="vidForm" class="form">
        <label>Video<input type="file" name="file" accept="video/*" required></label>
        <label>Whose video?<select name="subject">${opt('me', 'me', 'Me')}${opt('pro', 'me', 'A pro to compare against')}</select></label>
        <label class="pro-only" hidden>Name<input name="proName" maxlength="60" placeholder="e.g. Floyd Mayweather"></label>
        <label>Type<select name="type">${['shadow', 'mitts', 'bag', 'sparring'].map((t) => opt(t, 'shadow', ALL_TYPES[t])).join('')}</select></label>
        <p class="muted small" style="margin:0">Someone else in the video (pads, sparring)? You'll tap yourself before the analysis starts, and it follows you even when you move around or swap sides.</p>
        <label>Drilling one combo on repeat? (optional)<select name="drill">${opt('', '', 'No / mixed punches')}${
          app.state.combos.map((c) => opt(c.id, '', comboLabel(c.tokens))).join('')}${
          unsavedStarters(app).map((t) => opt(`s:${t}`, '', comboLabel(parseCombo(t)))).join('')}</select></label>
        <p class="muted small" style="margin:0">Pick the whole sequence you repeated. Punch types then follow your combo, and the camera checks and trains itself against it. Build your own in Train → Combos.</p>
        <div class="row2">
          <label>Rounds of<select name="roundSec">${opt(0, 0, 'Whole video')}${opt(120, 0, '2 min')}${opt(180, 0, '3 min')}</select></label>
          <label>Detail<select name="fps">${opt(10, 15, 'Fast')}${opt(15, 15, 'Normal')}${opt(24, 15, 'Precise (slow)')}</select></label>
        </div>
        ${aiKey()
          ? '<label class="switch"><input type="checkbox" name="ai" checked> <span>Check every punch with Claude (sends cropped frames of the boxer to Anthropic)</span></label>'
          : '<p class="muted small" style="margin:0">Want Claude to check every punch and find missed ones? Add your API key in <a href="#coach/settings">Coach → Settings</a>.</p>'}
        <button class="btn primary block" type="submit">Analyse</button>
      </form>
      <div id="vidProgress" hidden>
        <div class="vid-stage" id="vidStage"><canvas id="vidOverlay"></canvas></div>
        <div class="bar"><div id="vidBar" style="width:0%"></div></div>
        <p class="small muted" id="vidStatus">Loading…</p>
        <p class="small muted" style="margin-top:0">Keep this screen open. When it finishes you can check every punch and save frames for your Claude chat.</p>
        <div class="row2"><button class="btn ghost" id="vidNotHere" type="button" hidden>I'm out of shot</button><button class="btn ghost" id="vidCancel" type="button">Cancel</button></div>
      </div>
    </section>`;
  const vf = $('#vidForm', el);
  const syncSubject = () => {
    const pro = vf.subject.value === 'pro';
    $('.pro-only', el).hidden = !pro;
    if (vf.drill) vf.drill.closest('label').hidden = pro;
  };
  vf.subject.addEventListener('change', syncSubject);
  const preset = takePreset();
  if (preset) {
    vf.subject.value = preset.subject;
    vf.proName.value = preset.name;
    syncSubject();
  }
  $('#vidForm', el).addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const file = f.file.files[0];
    if (!file) return;
    // Create and start the video inside the tap so iPhone allows playback.
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.preload = 'auto';
    video.src = URL.createObjectURL(file);
    video.play().then(() => video.pause()).catch(() => {});
    analyse(file, video, {
      type: f.type.value, roundSec: +f.roundSec.value, fps: +f.fps.value,
      drill: f.subject.value === 'pro' ? null : drillCombo(app, f.drill?.value),
      subject: f.subject.value, proName: f.proName.value.trim(), ai: !!(f.ai?.checked && aiKey()),
      stance: app.state.profile.stance, sensitivity: app.state.profile.sensitivity,
    }, el, app);
  });
}

// iPhone recordings are often 4K HDR: far more than the pose model needs, and heavy enough to
// stall a phone. Each frame is drawn once at up to 720 px and everything reads from that copy.
const frameCanvas = document.createElement('canvas');
function grabFrame(video) {
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) return video;
  const k = Math.min(1, 720 / Math.max(w, h));
  const cw = Math.round(w * k), ch = Math.round(h * k);
  if (frameCanvas.width !== cw || frameCanvas.height !== ch) { frameCanvas.width = cw; frameCanvas.height = ch; }
  frameCanvas.getContext('2d').drawImage(video, 0, 0, cw, ch);
  return frameCanvas;
}

// What each person looks like: average colour of their top (shoulders to hips) and of their legs
// (hips to knees). The tracker's main identity cue: two colours tell people apart far better
// than one (a brown top and a black top look alike in shade; khaki trousers and blue shorts don't).
const sampler = document.createElement('canvas');
function sampleLooks(frame, people) {
  const fw = frame.videoWidth || frame.width, fh = frame.videoHeight || frame.height;
  if (!people.length || !fw) return [];
  const w = 96, h = Math.round((96 * fh) / fw);
  sampler.width = w;
  sampler.height = h;
  const g = sampler.getContext('2d', { willReadFrequently: true });
  try {
    g.drawImage(frame, 0, 0, w, h);
    const data = g.getImageData(0, 0, w, h).data;
    const region = (pts, ids) => {
      const ps = ids.map((i) => pts[i]);
      if (ps.some((p) => !p || (p.visibility ?? 1) < 0.3)) return null;
      const xs = ps.map((p) => p.x), ys = ps.map((p) => p.y);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const hw = Math.max(0.02, (Math.max(...xs) - Math.min(...xs)) * 0.3), hh = Math.max(0.02, (Math.max(...ys) - Math.min(...ys)) * 0.3);
      let r = 0, gr = 0, b = 0, n = 0;
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          const px = Math.round((cx - hw + (2 * hw * i) / 4) * (w - 1)), py = Math.round((cy - hh + (2 * hh * j) / 4) * (h - 1));
          if (px < 0 || py < 0 || px >= w || py >= h) continue;
          const k = (py * w + px) * 4;
          r += data[k]; gr += data[k + 1]; b += data[k + 2]; n++;
        }
      }
      return n >= 8 ? [r / n, gr / n, b / n] : null;
    };
    return people.map((pts) => {
      const torso = region(pts, [11, 12, 23, 24]), legs = region(pts, [23, 24, 25, 26]);
      return torso || legs ? { ...(torso && { torso }), ...(legs && { legs }) } : null;
    });
  } catch {
    return [];
  }
}

// Box around a person (normalised image coordinates), from the landmarks the model is sure of.
function boxOf(pts) {
  const seen = pts.filter((p) => (p.visibility ?? 1) > 0.3);
  if (seen.length < 5) return null;
  const xs = seen.map((p) => p.x), ys = seen.map((p) => p.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}
// How much of the boxer is covered by someone else (0–1): the partner stepping in front.
function covered(people, idx) {
  const a = boxOf(people[idx]);
  if (!a) return 0;
  const area = (a.x1 - a.x0) * (a.y1 - a.y0) || 1e-6;
  let most = 0;
  people.forEach((pts, i) => {
    if (i === idx) return;
    const b = boxOf(pts);
    if (!b) return;
    const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)), iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
    most = Math.max(most, (ix * iy) / area);
  });
  return most;
}

// Waits for the next decoded frame (play, then pause on the first frame shown).
// Never waits more than 3 s: some recordings don't deliver a frame when asked, which used to
// leave the screen stuck on "Finding you in the video…".
function nextFrame(video, ms = 3000) {
  return new Promise((res) => {
    let done = false;
    const finish = () => { if (!done) { done = true; video.pause(); res(); } };
    setTimeout(finish, ms);
    if (!('requestVideoFrameCallback' in HTMLVideoElement.prototype)) {
      video.addEventListener('seeked', finish, { once: true });
      video.currentTime = Math.min(video.duration, video.currentTime + 0.2);
      return;
    }
    video.requestVideoFrameCallback(finish);
    video.play().catch(finish);
  });
}

// Over the video: a gold ring on the floor under the boxer and their gloves; nobody else is
// marked. While choosing, everyone gets a dashed ring and a "Tap" tag.
function drawPeople(canvas, video, people, chosen, { picking = false } = {}) {
  // Overlay at most 720 px too: a 4K canvas redrawn every frame is heavy on a phone.
  const k = Math.min(1, 720 / Math.max(video.videoWidth || 1, video.videoHeight || 1));
  const cw = Math.round(video.videoWidth * k), ch = Math.round(video.videoHeight * k);
  if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, canvas.width, canvas.height);
  const crowd = people.length > 1;
  // Others first, so the boxer is drawn on top where they overlap.
  people.forEach((pts, i) => { if (i !== chosen) drawBody(g, pts, cw, ch, picking ? { style: 'pick', label: crowd ? 'Tap' : '' } : { style: 'other' }); });
  if (chosen >= 0 && people[chosen]) drawBody(g, people[chosen], cw, ch, { style: 'me' });
}

async function analyse(file, video, opts, el, app) {
  busy = true;
  $('#vidForm', el).hidden = true;
  $('#vidProgress', el).hidden = false;
  const status = $('#vidStatus', el);
  const stage = $('#vidStage', el);
  const overlay = $('#vidOverlay', el);
  stage.prepend(video);
  let cancelled = false;
  $('#vidCancel', el).addEventListener('click', () => { cancelled = true; video.pause(); });
  const url = video.src;
  // Keep the screen on: a 6-minute video can take a few minutes, and the phone locking itself
  // would stop the analysis.
  let wake = null;
  const keepAwake = async () => { try { if (!wake || wake.released) wake = await navigator.wakeLock?.request('screen'); } catch { /* not supported */ } };
  const onShow = () => { if (document.visibilityState === 'visible') keepAwake(); };
  keepAwake();
  document.addEventListener('visibilitychange', onShow);
  try {
    if (video.readyState < 2) {
      await new Promise((res, rej) => {
        video.addEventListener('loadeddata', res, { once: true });
        video.addEventListener('error', () => rej(new Error('Could not read that video. Try a shorter clip or record in "Most Compatible" format.')), { once: true });
      });
    }
    stage.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
    stage.style.width = `min(100%, ${Math.round((380 * video.videoWidth) / video.videoHeight)}px)`;
    // Bigger model for more detail: body tracking is what everything else rests on.
    const model = opts.fps >= 24 ? 'heavy' : opts.fps >= 15 ? 'full' : 'lite';
    status.textContent = model === 'heavy' ? 'Loading the precise pose model (30 MB, first time only)…' : 'Loading pose model…';
    const { getVideoLandmarker, detectVideoFrame } = await import('../pose.js');
    const lm = await getVideoLandmarker(model);
    const analyzer = new FormAnalyzer({ stance: opts.stance, sensitivity: opts.sensitivity, minVis: 0.3, cal: trustedCal(app.state.profile.punchCal), labels: app.state.profile.punchLabels || null, aspect: video.videoWidth / video.videoHeight || 1 });
    const durMs = video.duration * 1000;
    const roundMs = opts.roundSec ? opts.roundSec * 1000 : durMs + 1;
    const rounds = [];
    let roundEnd = roundMs, frames = 0, tracked = 0, multi = 0, lastT = -1;
    const tracker = new PersonTracker();
    let who = 'auto', nobody = 0, lost = 0;
    // Frames of the boxer for a Claude check, or to save and share in a Claude chat.
    const sheets = new FrameSheets();

    // Find people in the first frames; with more than one, ask the boxer to tap themselves.
    status.textContent = 'Finding you in the video…';
    // Look through up to 5 s: people may walk into shot late, or one may be missed on a single frame.
    // Keep the frame showing the most people; stop as soon as two are seen.
    let first = [], colors = [];
    const scanCosts = []; // how long the pose model takes on this phone, to pick how to play the video
    const scanStart = performance.now(); // at most ~12 s looking, however the video behaves
    for (let i = 0; i < 90 && !cancelled && !video.ended && performance.now() - scanStart < 12000; i++) {
      await nextFrame(video);
      let found = [];
      const frame = grabFrame(video);
      const d0 = performance.now();
      try { found = detectVideoFrame(lm, frame)?.landmarks || []; } catch { found = []; }
      scanCosts.push(performance.now() - d0);
      if (found.length > first.length) { first = found; colors = sampleLooks(frame, found); }
      if (first.length > 1 || (first.length === 1 && video.currentTime > 1.5) || video.currentTime > 5) break;
    }
    if (cancelled) throw new Error('cancelled');
    // Time the pose model a few times on this phone (the first run is a slow warm-up).
    while (scanCosts.length < 4) {
      const d0 = performance.now();
      try { detectVideoFrame(lm, grabFrame(video)); } catch { break; }
      scanCosts.push(performance.now() - d0);
    }
    const target = opts.subject === 'pro' ? 'the boxer' : 'yourself';
    // Ask the boxer to tap themselves: at the start, and again if they're lost for a while.
    // Resolves to the person's index, or -1 for "not in shot" (again) or cancel.
    const askWho = (people, again) => {
      drawPeople(overlay, video, people, -1, { picking: true });
      status.innerHTML = again ? `<b>Lost you.</b> Tap ${target} to carry on.` : `<b>Tap ${target}</b> in the video to start.`;
      stage.dataset.pick = `Tap ${target}`;
      stage.classList.add('pick');
      const skip = $('#vidNotHere', el);
      skip.hidden = !again;
      stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return new Promise((resolve) => {
        const done = (i) => {
          stage.removeEventListener('click', onTap);
          skip.removeEventListener('click', onSkip);
          $('#vidCancel', el).removeEventListener('click', onSkip);
          stage.classList.remove('pick');
          skip.hidden = true;
          resolve(i);
        };
        // 'click' rather than 'pointerdown' so scrolling past the video with a finger doesn't pick anyone.
        const onTap = (e) => {
          const r = overlay.getBoundingClientRect();
          done(personAt(people, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height));
        };
        const onSkip = () => done(-1);
        stage.addEventListener('click', onTap);
        skip.addEventListener('click', onSkip);
        $('#vidCancel', el).addEventListener('click', onSkip);
      });
    };
    if (first.length > 1) {
      const i = await askWho(first, false);
      if (cancelled || i < 0) throw new Error('cancelled');
      tracker.lockOn(first[i], colors[i]);
      tracker.crowd = true;
      who = 'tap';
      drawPeople(overlay, video, first, i);
    } else if (first.length === 1) {
      tracker.lockOn(first[0], colors[0]);
    }

    analyzer.startRound();
    const started = performance.now();
    const cost = { grab: 0, looks: 0, sheets: 0, analyse: 0, draw: 0 }; // ms per step, for the report
    const lap = (k, t0) => { const t1 = performance.now(); cost[k] += t1 - t0; return t1; };
    let detectMs = 0, asks = 0, askedThisLoss = false, foundAt = -Infinity, wasLost = false, unsureN = 0;

    // Analyse one frame. Returns the people in it (and their looks) when the boxer has been lost
    // long enough that it's worth asking them to tap themselves again.
    const processFrame = (t) => {
      if (t <= lastT) return null;
      lastT = t;
      while (t >= roundEnd) {
        rounds.push(analyzer.endRound());
        analyzer.startRound();
        roundEnd += roundMs;
      }
      let r = null;
      let c0 = performance.now();
      const frame = grabFrame(video);
      c0 = lap('grab', c0);
      const d0 = c0;
      try { r = detectVideoFrame(lm, frame); } catch { r = null; }
      detectMs += performance.now() - d0;
      const people = r?.landmarks || [];
      c0 = performance.now();
      const looks = people.length > 1 || tracker.crowd ? sampleLooks(frame, people) : [];
      lap('looks', c0);
      let idx = -1;
      if (tracker.locked) idx = tracker.pick(people, looks, t);
      else if (people.length) {
        idx = choosePose(people, 'auto');
        tracker.lockOn(people[idx], (looks.length ? looks : sampleLooks(frame, people))[idx]);
      }
      const image = idx >= 0 ? people[idx] : null;
      const world = idx >= 0 ? r.worldLandmarks?.[idx] : null;
      if (image) tracked++;
      else if (people.length) lost++;
      else nobody++;
      if (idx >= 0 && wasLost) foundAt = t;
      wasLost = idx < 0;
      if (idx >= 0) askedThisLoss = false;
      // Tracking is unsure when the boxer is missing, was only just found again, or is mostly
      // hidden behind someone: punches read then are as likely the partner's as theirs.
      const unsure = tracker.crowd && (idx < 0 || t - foundAt < 300 || covered(people, idx) > 0.35);
      if (unsure) unsureN++;
      analyzer.context({ others: idx >= 0 ? people.filter((_, i) => i !== idx) : [], unsure }, t);
      c0 = performance.now();
      sheets.add(frame, image, t);
      c0 = lap('sheets', c0);
      if (people.length > 1) multi++;
      frames++;
      analyzer.update(world || null, image, t);
      c0 = lap('analyse', c0);
      drawPeople(overlay, video, people, idx);
      lap('draw', c0);
      if (frames % 5 === 0) {
        $('#vidBar', el).style.width = `${Math.min(100, (t / durMs) * 100)}%`;
        status.textContent = `Analysing ${fmtT(t)} / ${fmtT(durMs)} · ${analyzer.events.filter((e) => e.kind === 'punch').length} punches · body found in ${Math.round((tracked / frames) * 100)}% of frames`;
      }
      const lostFor = tracker.lostSince != null ? t - tracker.lostSince : 0;
      if (tracker.crowd && idx < 0 && people.length && lostFor > 2500 && !askedThisLoss && asks < 6) {
        askedThisLoss = true;
        asks++;
        return { people, looks };
      }
      return null;
    };
    // The boxer was lost: ask, then carry on following whoever they tap (or keep looking).
    const reAsk = async ({ people, looks }) => {
      const i = await askWho(people, true);
      if (cancelled) throw new Error('cancelled');
      if (i >= 0) {
        tracker.lockOn(people[i], looks[i]);
        foundAt = lastT;
      }
    };

    const gap = 1000 / opts.fps - 5;
    let mode = 'step', flowRate = 1;
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
      // Play the video and analyse frames as they show. Fastest is to keep it playing, at a speed
      // that leaves time to analyse each frame we want ('flow'). If frames we wanted go by
      // unanalysed (a slow phone), fall back to pausing on each one ('step'): slower, but no
      // frame is ever missed.
      // A phone that can't analyse a frame in well under the time between frames steps from the start.
      const typical = scanCosts.length > 1 ? scanCosts.slice(1).sort((a, b) => a - b)[Math.floor((scanCosts.length - 1) / 2)] : 0;
      mode = typical * 1.5 > gap + 5 ? 'step' : 'flow';
      let rate = 1, wanted = 0, missed = 0, prevT = null, slow = 0, settled = 0, stopAway = () => {};
      let watchdog = null, asking = false, away = false, waiting = false;
      await new Promise((resolve, reject) => {
        let gotFrame = false;
        let lastProgress = performance.now(), nudged = false;
        // If playback stops delivering frames, nudge it once, then give a clear message
        // instead of sitting on a frozen screen.
        watchdog = setInterval(() => {
          if (cancelled || asking || away) { lastProgress = performance.now(); return; }
          const idle = performance.now() - lastProgress;
          if (idle > 6000 && !nudged) { nudged = true; video.play().catch(() => {}); }
          if (idle > 20000) reject(new Error('The analysis stopped responding on this video. Try Detail: Fast, or a shorter clip (iPhone: Settings → Camera → Record Video → 1080p HD).'));
        }, 2000);
        const resume = () => {
          if (!waiting) { waiting = true; video.requestVideoFrameCallback(onFrame); }
          if (video.paused && !away) video.play().catch(() => {});
        };
        // Switched to another app or the screen went off: wait, and carry on when back.
        const onAway = () => {
          if (document.hidden) {
            away = true;
            video.pause();
            status.textContent = `Paused at ${fmtT(lastT)} while BoxCoach was in the background. It carries on when you come back.`;
          } else if (away) {
            away = false;
            lastProgress = performance.now();
            if (!asking) resume();
          }
        };
        document.addEventListener('visibilitychange', onAway);
        stopAway = () => document.removeEventListener('visibilitychange', onAway);
        const onFrame = (now, meta) => {
          waiting = false;
          if (cancelled) return reject(new Error('cancelled'));
          if (away) return; // a frame shown just as the app went away: picked up again on return
          gotFrame = true;
          lastProgress = performance.now();
          nudged = false;
          const t = meta.mediaTime * 1000;
          if (video.ended || t >= durMs - 40) {
            if (t - lastT >= gap) processFrame(t);
            return resolve();
          }
          if (t - lastT >= gap) {
            if (mode === 'step') video.pause();
            const c0 = performance.now();
            const ask = processFrame(t);
            const cost = performance.now() - c0;
            if (mode === 'flow') {
              // Steer the speed by how much video went by since the last analysed frame: a wanted
              // frame skipped means slow down; keeping up means there may be room to go faster.
              if (prevT != null) {
                const step = t - prevT, n = Math.round(step / (gap + 5));
                if (++settled > 10) { wanted += Math.max(1, n); missed += Math.max(0, n - 1); }
                rate = Math.min(2.5, Math.max(0.5, n <= 1 ? rate + 0.005 : rate * 0.8)); // creep up, back off fast
              }
              prevT = t;
              flowRate = rate;
              if (Math.abs(video.playbackRate - rate) > 0.1) video.playbackRate = rate;
              // Too slow to keep up even at half speed, or frames slipping by: pause on each one.
              slow = cost > 2 * (gap + 5) ? slow + 1 : 0;
              if (slow >= 2 || (wanted >= 20 && missed / wanted > 0.15)) {
                // Go back to the last frame analysed so nothing that went by is lost.
                mode = 'step';
                video.pause();
                video.playbackRate = 1;
                video.currentTime = (lastT + 1) / 1000;
              }
            }
            if (ask) {
              asking = true;
              video.pause();
              return reAsk(ask).then(() => { asking = false; lastProgress = performance.now(); resume(); }, reject);
            }
          }
          resume();
        };
        video.addEventListener('ended', () => { if (!asking && !away) resolve(); }, { once: true });
        waiting = true;
        video.requestVideoFrameCallback(onFrame);
        video.currentTime = 0;
        video.play().catch(() => reject(new Error('The video would not play. Tap Analyse again.')));
        setTimeout(() => { if (!gotFrame && !cancelled) reject(new Error('The video did not start playing. Tap Analyse again.')); }, 15000);
        $('#vidCancel', el).addEventListener('click', () => reject(new Error('cancelled')));
      }).finally(() => { clearInterval(watchdog); stopAway(); video.playbackRate = 1; });
    } else {
      // Fallback: step through the video frame by frame.
      const step = 1000 / opts.fps;
      for (let t = 0; t < durMs; t += step) {
        if (cancelled) throw new Error('cancelled');
        video.currentTime = t / 1000;
        await new Promise((res) => { video.addEventListener('seeked', res, { once: true }); setTimeout(res, 3000); });
        const ask = processFrame(t);
        if (ask) await reAsk(ask);
        if (frames % 5 === 0) await new Promise((res) => setTimeout(res, 0));
      }
    }
    const per = (v) => (frames ? Math.round((v / frames) * 10) / 10 : null);
    const speed = {
      ms: Math.round(performance.now() - started), detect: frames ? Math.round(detectMs / frames) : null, mode, asks, unsure: frames ? Math.round((unsureN / frames) * 100) : 0,
      // Where each frame's time goes (ms), and how the playback speed settled: to make it faster where it counts.
      per: Object.fromEntries(Object.entries(cost).map(([k, v]) => [k, per(v)])), rate: Math.round((flowRate || 1) * 100) / 100, fps: durMs ? Math.round((frames / (durMs / 1000)) * 10) / 10 : null,
    };
    rounds.push(analyzer.endRound());
    video.pause();
    sheets.flush();
    analyzer.reclassify();
    // Drilled a known combo: check the camera against it and learn this boxer's straight/hook boundary.
    let comboCheck = null;
    if (opts.drill) {
      const punchEvents = () => analyzer.events.filter((e) => e.kind === 'punch' && e.f);
      const prior = app.state.profile.punchCal || null;
      // 1) How the camera did on its own; this also pins forward from the known straights.
      comboCheck = calibrateFromCombo(punchEvents(), opts.drill.tokens, trustedCal(prior));
      comboCheck.combo = comboLabel(opts.drill.tokens);
      // 2) Re-read with the combo as a guide (forward pinned), current straight/hook boundary.
      analyzer.reclassify();
      comboCheck.guided = calibrateFromCombo(punchEvents(), opts.drill.tokens, prior).agree;
      // 3) Try the learned boundary; keep it only if the clip lined up well and it reads better.
      const lined = comboCheck.matched >= 0.6 * comboCheck.total;
      if (comboCheck.ratio != null && lined) {
        const cal = { ratio: comboCheck.ratio, n: comboCheck.n, updated: new Date().toISOString() };
        analyzer.cal = cal;
        analyzer.reclassify();
        const tuned = calibrateFromCombo(punchEvents(), opts.drill.tokens, cal).agree;
        // Keep it only if it clearly reads your punches: 60%+ right and a real gain, not noise.
        cal.acc = Math.round((tuned / comboCheck.matched) * 100) / 100;
        if (cal.acc >= 0.6 && tuned >= comboCheck.guided + Math.max(3, comboCheck.matched * 0.05)) {
          comboCheck.tuned = tuned;
          comboCheck.saved = true;
          app.state.profile.punchCal = cal;
          app.persist();
        } else {
          analyzer.cal = trustedCal(prior); // never fall back to an unproven setting
          analyzer.reclassify();
        }
      }
      if (!lined) comboCheck.poorFit = true;
      // You told us what you threw: punches that line up with the combo take their type from it.
      // The camera's own reading is kept in the report (calib.punches) so it can keep improving.
      if (lined) {
        const byDigit = Object.fromEntries(Object.entries(PUNCH_DIGIT).map(([t, d]) => [d, t]));
        let set = 0;
        punchEvents().forEach((e, i) => {
          const d = comboCheck.labels[i];
          if (!d) return;
          e.type = byDigit[d];
          e.conf = Math.max(e.conf, 75);
          set++;
        });
        comboCheck.labelled = set;
      }
      analyzer.calib.labels = comboCheck.labels.map((d) => d || '.').join('');
      delete comboCheck.labels;
    }
    job = {
      done: true, url, type: opts.type, subject: opts.subject, proName: opts.proName, roundSec: opts.roundSec || Math.round(durMs / 1000), durMs,
      rounds, events: analyzer.events.map((e, i) => ({ ...e, i, keep: e.conf >= 50, fix: e.type })),
      calib: { ...analyzer.calib, model, who, speed, seen: [frames, nobody, lost], multi: frames ? Math.round((multi / frames) * 100) : 0, comboCheck: comboCheck || undefined, cal: analyzer.cal || undefined },
      comboCheck,
      frames, tracked: frames ? Math.round((tracked / frames) * 100) : 0, multi: frames ? Math.round((multi / frames) * 100) : 0,
      date: new Date(file.lastModified || Date.now()).toISOString(),
      stance: opts.stance, drill: opts.drill ? comboText(opts.drill.tokens) : null,
      sheets: sheets.sheets, ai: opts.ai ? { state: 'pending' } : null, sig: analyzer.sig,
    };
    app.rerender();
  } catch (err) {
    video.pause();
    URL.revokeObjectURL(url);
    if (err.message !== 'cancelled') toast(err.message || 'Video analysis failed.');
    app.rerender();
  } finally {
    busy = false;
    document.removeEventListener('visibilitychange', onShow);
    wake?.release?.().catch?.(() => {});
  }
}

function comboCheckHTML(c) {
  if (!c.total) return `<li>Combo check (${esc(c.combo)}): no punches detected to check.</li>`;
  const p = (n) => pctOf(n, c.matched);
  const final = c.tuned ?? c.guided ?? c.agree;
  return `<li>Combo check (${esc(c.combo)}): ${c.matched} of ${c.total} punches lined up with it.
    On its own the camera read ${p(c.agree)}% of those as the right punch; using your combo as a guide, ${p(final)}%.
    ${c.labelled ? `Punch types for those ${c.labelled} follow your combo.` : ''}
    ${c.saved ? 'It learned how your straights and hooks look on camera and will use that from now on.' : ''}
    ${c.poorFit ? "Most punches didn't line up with this combo, so nothing was learned. Was it the right combo, thrown on repeat?" : ''}</li>`;
}

// Teach it your punches: one detected punch at a time, looping in slow motion, one tap each.
function renderLabel(el, app) {
  const j = job;
  const ps = j.events.filter((e) => e.kind === 'punch');
  const i = j.labelAt;
  if (i >= ps.length) {
    j.labelAt = null;
    const n = ps.filter((e) => e.labelled).length;
    if (n) toast(`${n} labelled. Save the session and it learns from them.`);
    return renderReview(el, app);
  }
  const e = ps[i];
  const lead = e.role === 'lead';
  const choices = lead ? [['jab', 'Jab'], ['leadHook', 'Hook'], ['leadUppercut', 'Uppercut']] : [['cross', 'Cross'], ['rearHook', 'Hook'], ['rearUppercut', 'Uppercut']];
  const picked = e.labelled ? (e.keep ? e.fix : 'none') : null;
  el.innerHTML = `
    <section class="card">
      <div class="card-head"><h2>Punch ${i + 1} of ${ps.length}</h2><button class="linkbtn" id="lblDone" type="button">Done</button></div>
      <video id="lblVid" src="${j.url}" playsinline muted class="vid-preview"></video>
      <p class="small muted">${lead ? 'Lead' : 'Rear'} hand at ${fmtT(e.t)}. I read: <b>${esc(PUNCH_NAMES[e.type])}</b>. What was it?</p>
      <div class="lblgrid">
        ${choices.map(([k, n]) => `<button class="btn ${picked === k ? 'primary' : 'ghost'} big" data-lbl="${k}" type="button">${n}</button>`).join('')}
        <button class="btn ${picked === 'none' ? 'primary' : 'ghost'} big" data-lbl="none" type="button">Not a punch</button>
      </div>
      <div class="row2" style="margin-top:10px"><button class="btn ghost" id="lblBack" type="button" ${i ? '' : 'disabled'}>Back</button><button class="btn ghost" id="lblSkip" type="button">Skip</button></div>
    </section>`;
  const v = $('#lblVid', el);
  const start = Math.max(0, e.t / 1000 - 0.8), end = e.t / 1000 + 0.3;
  const loop = () => { v.currentTime = start; v.play().catch(() => {}); };
  v.playbackRate = 0.5;
  v.addEventListener('loadedmetadata', () => { v.playbackRate = 0.5; loop(); }, { once: true });
  v.addEventListener('timeupdate', () => { if (v.currentTime >= end) loop(); });
  if (v.readyState >= 1) loop();
  const go = (n) => { j.labelAt = n; renderLabel(el, app); };
  $$('[data-lbl]', el).forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.lbl;
    e.labelled = true;
    e.edited = true;
    e.keep = k !== 'none';
    if (k !== 'none') e.fix = k;
    go(i + 1);
  }));
  $('#lblBack', el).addEventListener('click', () => go(i - 1));
  $('#lblSkip', el).addEventListener('click', () => go(i + 1));
  $('#lblDone', el).addEventListener('click', () => go(ps.length));
}

function renderReview(el, app) {
  const j = job;
  if (j.labelAt != null) return renderLabel(el, app);
  const punches = j.events.filter((e) => e.kind === 'punch');
  const others = j.events.filter((e) => e.kind !== 'punch');
  const stance = combineRounds(j.rounds).leftLeadPct;
  const stanceTxt = stance == null ? 'unknown' : stance >= 50 ? `orthodox (${stance}% of frames)` : `southpaw (${100 - stance}% of frames)`;
  const avgConf = punches.length ? Math.round(punches.reduce((a, e) => a + e.conf, 0) / punches.length) : null;
  const away = combineRounds(j.rounds).awayPct ?? 0;
  const unsure = punches.filter((e) => e.typeUnsure).length;
  const uncertainOnly = el.dataset.uncertain === '1';
  const shown = [...punches, ...others].sort((a, b) => a.t - b.t).filter((e) => !uncertainOnly || e.conf < 70);
  el.innerHTML = `
    <section class="card">
      <h2>Video review</h2>
      <video id="vidPreview" src="${j.url}" controls playsinline muted class="vid-preview"></video>
      <div class="vid-quality">
        <div class="${j.tracked >= 85 ? 'good' : j.tracked >= 70 ? 'warn' : 'bad'}"><b>${j.tracked}%</b><span>Body tracked</span></div>
        <div><b>${punches.length}</b><span>Punches${others.some((e) => e.kind === 'feint') ? ` · ${others.filter((e) => e.kind === 'feint').length} feints` : ''}</span></div>
        <div class="${avgConf == null ? '' : avgConf >= 75 ? 'good' : avgConf >= 60 ? 'warn' : 'bad'}"><b>${avgConf ?? '–'}${avgConf != null ? '%' : ''}</b><span>Avg confidence</span></div>
      </div>
      ${j.tracked < 70 || j.multi >= 20 || away >= 25 ? `<div class="msg behind" style="margin:0 0 10px"><b>Treat these numbers as estimates.</b> ${j.tracked < 70 ? `The camera found you in only ${j.tracked}% of frames. ` : ''}${j.multi >= 20 ? `Someone else was in ${j.multi}% of frames, so some of their movement can read as yours. ` : ''}${away >= 25 ? `Your back was to the camera ${away}% of the time: from behind a straight punch looks bent, so jabs and crosses can read as hooks, and guard and hand return can't be measured. ${unsure} punch types are marked "type?". ` : ''}Check the detections below.</div>` : ''}
      <ul class="small">
        <li>${j.frames ?? ''} frames analysed${j.multi ? ` · ${j.multi}% had 2 people (following the person you tapped)` : ''}</li>
        <li>Stance detected: ${esc(stanceTxt)}</li>
        ${j.comboCheck ? comboCheckHTML(j.comboCheck) : ''}
        ${j.ai ? `<li id="aiStatus">${aiStatusHTML(j.ai)}</li>` : ''}
        <li>${others.filter((e) => e.kind === 'feint').length} feints${others.some((e) => e.kind === 'feint') ? ` · ${punches.filter((e) => e.afterFeint).length} led straight into a punch` : ''}</li>
        <li>${others.filter((e) => e.kind === 'guardDrop').length} guard drops · ${others.filter((e) => e.kind === 'crossedFeet').length} crossed-feet moments</li>
      </ul>
      <p class="muted small">Computer vision isn't perfect. Tap a time to jump there, fix the punch type, or untick anything that's wrong. Low-confidence detections start unticked.</p>
      ${j.subject !== 'pro' && punches.length ? `<button class="btn primary block" id="teach" type="button">Teach it your punches (${punches.filter((e) => e.labelled).length}/${punches.length} labelled)</button>` : ''}
      <label class="switch"><input type="checkbox" id="uncertain" ${uncertainOnly ? 'checked' : ''}> <span>Only show uncertain (&lt;70%)</span></label>
    </section>
    ${j.sheets?.length ? `<section class="card">
      <h3 style="margin-top:0">Send to Claude (free)</h3>
      <p class="muted small">One tap copies this video's report and saves ${Math.min(j.sheets.length, CHAT_PHOTOS)} photo${j.sheets.length === 1 ? '' : 's'} of it (your upper body, frame by frame, with times)${j.sheets.length > CHAT_PHOTOS ? `: ${CHAT_PHOTOS} of the ${j.sheets.length}, favouring the moments with punches and feints` : ''}. Choose <b>Save Images</b>. Then in your Claude chat, paste the report and attach the photos. Claude checks every punch, and the app learns from it.${j.sheets.at(-1).t1 < j.durMs - 3000 ? ` <b>The photos (and the Claude check) cover the first ${fmtT(j.sheets.at(-1).t1)} only</b>; the rest of the video is in the numbers above but not in the photos.` : ''}</p>
      <button class="btn primary block" id="saveFrames" type="button">📤 Copy report + save photos</button>
    </section>` : ''}
    ${filmingTips(j) ? `<section class="card"><div class="msg">${filmingTips(j)}</div></section>` : ''}
    ${j.tracked < 30 ? `<section class="card"><div class="msg behind"><b>I could barely see you in this video.</b> Try: whole body in frame (head to feet), steadier camera, better light, or re-run and tap yourself carefully if someone else is in the shot. You can also use Fast/Normal detail on long clips.</div></section>` : ''}
    <section class="card">
      ${shown.length ? '' : '<p class="muted small" style="margin:0">No detections to review.</p>'}
      <ul class="events">${shown.map((e) => `
        <li class="${e.keep ? '' : 'off'}">
          <input type="checkbox" data-keep="${e.i}" ${e.keep ? 'checked' : ''} aria-label="Keep detection">
          <button class="linkbtn" data-seek="${e.t}">${fmtT(e.t)}</button>
          ${e.kind === 'punch'
            ? `<select data-fix="${e.i}">${Object.entries(PUNCH_NAMES).map(([k, n]) => opt(k, e.fix, n)).join('')}</select>`
            : `<span>${e.kind === 'guardDrop' ? 'Guard drop' : e.kind === 'feint' ? `Feint (${e.role === 'lead' ? 'lead' : 'rear'} hand)` : 'Crossed feet'}</span>`}
          ${e.typeUnsure ? '<span class="badge est" title="Thrown with your back to the camera: the punch type is a guess">type?</span>' : `<span class="badge ${e.conf >= 80 ? 'good' : e.conf >= 60 ? 'warn' : 'bad'}">${e.conf}%</span>`}
          ${e.ai ? `<span class="badge ai" title="Checked by Claude">${e.ai === 'added' ? 'Claude: missed' : e.ai === 'none' ? 'Claude: not a punch' : e.ai === 'same' ? 'Claude ✓' : 'Claude fixed'}</span>` : ''}
        </li>`).join('')}</ul>
    </section>
    <section class="card">
      <div class="row2"><button class="btn ghost" id="vidDiscard">Discard</button><button class="btn primary" id="vidSave">${j.subject === 'pro' ? 'Save for comparison' : 'Save session'}</button></div>
    </section>`;

  // iPhone only opens the share sheet straight from a tap, so the photos are made ready beforehand.
  if (j.sheets?.length && !j.files) {
    const chosen = chatSheets(j.sheets, j.events);
    j.files = Promise.all(chosen.map((i) => j.sheets[i].blob)).then((blobs) => blobs
      .map((b, k) => b && new File([b], `boxcoach-${j.date.slice(0, 10)}-frames-${String(chosen[k] + 1).padStart(3, '0')}.jpg`, { type: 'image/jpeg' }))
      .filter(Boolean));
    j.files.then((f) => { j.filesReady = f; });
  }
  $('#saveFrames', el)?.addEventListener('click', () => sendToClaude(j, app));
  $('#aiRetry', el)?.addEventListener('click', () => runAi(el, app));
  if (j.ai?.state === 'pending') runAi(el, app);
  $('#teach', el)?.addEventListener('click', () => {
    const ps = j.events.filter((e) => e.kind === 'punch');
    j.labelAt = Math.max(0, ps.findIndex((e) => !e.labelled));
    renderLabel(el, app);
    el.scrollIntoView({ block: 'start' });
  });
  $('#uncertain', el).addEventListener('change', (e) => { el.dataset.uncertain = e.target.checked ? '1' : ''; renderReview(el, app); });
  $$('[data-seek]', el).forEach((b) => b.addEventListener('click', () => {
    const v = $('#vidPreview', el);
    v.currentTime = Math.max(0, +b.dataset.seek / 1000 - 0.5);
    v.play().catch(() => {});
    setTimeout(() => v.pause(), 1500);
  }));
  $$('[data-keep]', el).forEach((c) => c.addEventListener('change', () => {
    j.events[+c.dataset.keep].keep = c.checked;
    j.events[+c.dataset.keep].edited = true;
    c.closest('li').classList.toggle('off', !c.checked);
  }));
  $$('[data-fix]', el).forEach((s) => s.addEventListener('change', () => { j.events[+s.dataset.fix].fix = s.value; j.events[+s.dataset.fix].edited = true; }));
  $('#vidDiscard', el).addEventListener('click', () => {
    if (!confirm('Discard this analysis?')) return;
    j.aiAbort?.abort();
    URL.revokeObjectURL(j.url);
    job = null;
    app.rerender();
  });
  $('#vidSave', el).addEventListener('click', () => {
    if (j.ai?.state === 'running' && !confirm('Claude is still checking. Save without its check?')) return;
    j.aiAbort?.abort();
    const session = buildSession(j);
    if (j.subject !== 'pro') learnFrom(j, app);
    URL.revokeObjectURL(j.url);
    job = null;
    if (j.subject === 'pro') {
      // A pro's clip is for comparison only: it never enters your log, stats or plan.
      saveReference(app, session, j.proName);
      toast(`Saved ${j.proName || 'the pro'} for comparison.`);
      location.hash = '#train/study';
      return;
    }
    app.showSummary(session);
  });
}

// Your labels and fixes become examples for the reader trained on your own punches.
function learnFrom(j, app) {
  const add = harvest(j.events);
  if (!add.length) return;
  const p = app.state.profile;
  p.punchLabels = addExamples(p.punchLabels, add);
  // Only punches taught from this camera spot count for this spot (see personal.js).
  const m = spotModel(p.punchLabels, j.sig);
  const msg = !m ? `Learned ${add.length} punches. A few more from this camera spot and it starts reading your punches.`
    : m.use ? `From this camera spot it now reads punches your way: ${Math.round(m.acc * 100)}% right on your labels (was ${Math.round(m.baseAcc * 100)}%).`
    : `Learned ${add.length} punches (${Math.round(m.acc * 100)}% vs ${Math.round(m.baseAcc * 100)}% built-in). A few more labels and it takes over.`;
  setTimeout(() => toast(msg), 800);
}

// Report (with the boxer's edits so far) to the clipboard and the frames to the share sheet, in one
// tap. Both are started straight from the tap: iPhone only allows either from a tap.
function sendToClaude(j, app) {
  let copied = null;
  try {
    const text = buildReport(buildSession(j), app.state, app.version);
    copied = navigator.clipboard?.writeText(text).then(() => true, () => false) ?? null; // refused copy is handled, never thrown
  } catch { copied = null; }
  saveFrames(j, copied);
}

// Share the contact sheets (iPhone: Save Images to Photos), or download them where sharing files isn't possible.
async function saveFrames(j, copied = null) {
  const files = j.filesReady;
  const copyNote = async () => ((await copied) ? 'Report copied. ' : '');
  if (!files) return toast(`${await copyNote()}Getting the photos ready. Tap again in a moment.`);
  if (!files.length) return toast(`${await copyNote()}No frames were captured.`);
  // Called with no await before it, so the tap still counts for the share sheet.
  if (navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files, title: 'BoxCoach frames' });
      toast(`${await copyNote()}Now paste the report and attach the photos in your Claude chat.`);
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
      if (err?.name === 'NotAllowedError') return toast(`${await copyNote()}Tap the button once more to save the photos.`);
    }
  }
  for (const f of files) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    await new Promise((r) => setTimeout(r, 250));
  }
  toast(`${await copyNote()}Saved ${files.length} photos.`);
}

// What to change next time, from what the analysis measured.
function filmingTips(j) {
  const tips = [];
  const tilt = j.calib?.tilt;
  if (tilt >= 20) tips.push(`Your phone was tilted about ${tilt}° up or down. The app corrects for it, but a level phone at chest height reads punches and guard more reliably.`);
  const { sidePct: side, awayPct: away } = combineRounds(j.rounds);
  if (away >= 25) tips.push(`The camera was behind you ${away}% of the time. Put it in front of you or at 45°, with the bag beside you, not between you and the phone.`);
  if (side >= 60) tips.push(`You were side-on to the camera ${side}% of the time, which hides your far arm. Face the camera or stand at 45°.`);
  return tips.length ? `<b>Next time you film:</b> ${tips.map(esc).join(' ')}` : '';
}

function aiStatusHTML(a) {
  if (a.state === 'pending' || a.state === 'running') {
    return `Claude is checking every punch${a.total ? ` (part ${Math.min(a.done + 1, a.total)} of ${a.total})` : ''}… <span class="muted">You can review below meanwhile.</span>`;
  }
  if (a.state === 'error') return `Claude check didn't finish: ${esc(a.msg)} <button class="linkbtn" id="aiRetry">Try again</button>`;
  return `Claude checked the punches (${esc(AI_MODELS[a.model] || a.model)}): ${a.same} confirmed, ${a.retyped} punch types corrected, ${a.removed} not punches (unticked), ${a.added} missed punches added.`;
}

// Send the captured frames to Claude and apply its verdicts to the review list.
async function runAi(el, app) {
  const j = job;
  if (!j?.sheets?.length || j.ai?.state === 'running') return;
  const ctrl = new AbortController();
  j.aiAbort = ctrl;
  j.ai = { state: 'running', done: 0, total: 0 };
  const show = () => { const li = $('#aiStatus', el); if (li && job === j) li.innerHTML = aiStatusHTML(j.ai); };
  show();
  // Only the camera's own detections go in; punches Claude added on an earlier try are replaced.
  j.events = j.events.filter((e) => !e.aiAdded);
  const detected = j.events.filter((e) => e.kind === 'punch');
  try {
    const r = await checkWithClaude({
      sheets: j.sheets, stance: j.stance, drill: j.drill, subject: j.subject, signal: ctrl.signal,
      punches: detected.map((e) => ({ id: e.i, t: e.t, role: e.role, type: e.type })),
      onProgress: (done, total) => { j.ai.done = done; j.ai.total = total; show(); },
    });
    if (job !== j) return;
    const tally = applyAi(j, r);
    j.ai = { state: 'done', model: r.model, ...tally };
    j.calib.ai = {
      model: r.model, sheets: r.sheets, usage: r.usage, ...tally,
      // Per camera detection, in calib.punches order: Claude's punch number, '.' not a punch, '?' no answer.
      labels: detected.map((e) => (e.i in r.verdicts ? (r.verdicts[e.i] ? PUNCH_DIGIT[r.verdicts[e.i]] : '.') : '?')).join(''),
      added: r.added.map((a) => [Math.round(a.t / 100), PUNCH_DIGIT[a.type]]),
    };
  } catch (err) {
    if (job !== j || err.message === 'cancelled' || ctrl.signal.aborted) return;
    j.ai = { state: 'error', msg: err.message || 'unknown error' };
  }
  if (job === j) app.rerender();
}

// Apply the boxer's corrections to the per-round metrics and build a session.
export function buildSession(j) {
  const rounds = j.rounds.map((r, idx) => {
    const kept = j.events.filter((e) => e.kind === 'punch' && e.round === idx + 1 && e.keep);
    const punches = { jab: 0, cross: 0, leadHook: 0, rearHook: 0, leadUppercut: 0, rearUppercut: 0 };
    for (const e of kept) punches[e.fix]++;
    const log = kept.map((e) => ({ t: e.t, type: e.fix }));
    const sequences = sequencesFrom(log);
    // Feints you unticked don't count, nor do set-ups by a feint you unticked.
    const feints = j.events.filter((e) => e.kind === 'feint' && e.round === idx + 1 && e.keep).length;
    const feintSetups = Math.min(feints, kept.filter((e) => e.afterFeint).length);
    const perMin = r.feints && r.feintsPerMin ? feints * (r.feintsPerMin / r.feints) : null;
    return { ...r, punches, totalPunches: kept.length, sequences, stream: streamFrom(log), ...comboStats(sequences), feints, feintSetups, feintsPerMin: perMin != null ? Math.round(perMin * 10) / 10 : r.feintsPerMin };
  });
  const form = combineRounds(rounds);
  return {
    id: newId(), date: j.date, type: j.type, tracking: 'camera', source: 'video',
    plan: { rounds: rounds.length, roundSec: j.roundSec, restSec: 60 }, completedRounds: rounds.length,
    workSec: Math.round(j.durMs / 1000), totalSec: Math.round(j.durMs / 1000),
    punches: { total: form.totalPunches, perRound: rounds.map((r) => r.totalPunches), byType: form.punches },
    form: form.perRound.some((r) => r.frames > 30) ? form : null,
    // Only the boxer's own edits count as corrections (low-confidence detections start unticked).
    corrections: j.events.filter((e) => e.edited && (!e.keep || (e.kind === 'punch' && e.fix !== e.type))).length,
    // Ground truth: [detected type, corrected type or 0 if rejected, confidence, 1 = you confirmed it].
    calib: {
      ...j.calib,
      labelled: j.events.filter((e) => e.labelled).length,
      autoUnticked: j.events.filter((e) => e.kind === 'punch' && !e.edited && !e.keep).length,
      fixes: j.events.filter((e) => e.kind === 'punch' && e.edited).slice(0, 200).map((e) => [e.type, e.keep ? e.fix : 0, e.conf, e.keep && e.fix === e.type ? 1 : 0]),
    },
    rpe: 7, notes: '',
  };
}

