// Camera + MediaPipe pose tracking. Runs fully on the phone; video never leaves the device.

const VERSION = '0.10.14';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const cdnModel = (size) => `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${size}/float16/1/pose_landmarker_${size}.task`;
// The phone app (App Store / Play) ships the tracking runtime and models inside the app
// (scripts/vendor-mediapipe.mjs puts them in web/vendor/mediapipe): it then works offline from
// the first launch and downloads no code. The website loads them from the CDN as before.
const LOCAL = new URL('../vendor/mediapipe/', import.meta.url).href;
let source = null;
function mediapipe() {
  source ||= fetch(`${LOCAL}vision_bundle.mjs`, { method: 'HEAD' })
    .then((r) => r.ok, () => false)
    .then((local) => (local
      ? { base: LOCAL.replace(/\/$/, ''), model: (size) => `${LOCAL}models/pose_landmarker_${size}.task` }
      : { base: CDN, model: cdnModel }));
  return source;
}
// Live camera: the 'full' model tracks arms noticeably better than 'lite'. It is used when the
// phone keeps up; if it can't (measured in the first seconds), the tracker drops to 'lite' and
// remembers that for next time.
const LIVE_PREF = 'boxcoach.liveModel';
const livePromises = {};

export async function getLandmarker(size = 'lite') {
  if (!livePromises[size]) {
    livePromises[size] = (async () => {
      const src = await mediapipe();
      const { FilesetResolver, PoseLandmarker } = await import(`${src.base}/vision_bundle.mjs`);
      const fileset = await FilesetResolver.forVisionTasks(`${src.base}/wasm`);
      const opts = (delegate) => ({
        baseOptions: { modelAssetPath: src.model(size), delegate },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
      try {
        return await PoseLandmarker.createFromOptions(fileset, opts('GPU'));
      } catch {
        return await PoseLandmarker.createFromOptions(fileset, opts('CPU'));
      }
    })();
    livePromises[size].catch(() => { delete livePromises[size]; });
  }
  return livePromises[size];
}

// Median time per frame (ms) above which the full model is too slow for live coaching (~22 fps).
export const LIVE_SLOW_MS = 45;
// 'lite' is remembered for 14 days, then the full model gets another try (Low Power Mode, a
// busy phone or an older browser version can make one session slow).
export function pickLiveModel(storage = globalThis.localStorage, now = Date.now()) {
  try {
    const [m, at] = String(storage?.getItem(LIVE_PREF) || '').split('@');
    return m === 'lite' && now - (+at || 0) < 14 * 86400000 ? 'lite' : 'full';
  } catch { return 'full'; }
}
export function tooSlow(times) {
  if (times.length < 30) return null;
  const s = [...times].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] > LIVE_SLOW_MS;
}

// Separate instance for video files: up to 2 people (pads/sparring), and its own timestamp
// clock so it never conflicts with the live camera (MediaPipe needs increasing timestamps).
// Videos aren't real-time, so they can use a bigger, more accurate model:
// 'lite' (6 MB, fastest), 'full' (9 MB), 'heavy' (30 MB, most accurate, slowest).
const videoLandmarkers = {};
let videoLastTs = 0;

export async function getVideoLandmarker(size = 'full') {
  if (!videoLandmarkers[size]) {
    videoLandmarkers[size] = (async () => {
      const src = await mediapipe();
      const { FilesetResolver, PoseLandmarker } = await import(`${src.base}/vision_bundle.mjs`);
      const fileset = await FilesetResolver.forVisionTasks(`${src.base}/wasm`);
      const opts = (delegate) => ({ baseOptions: { modelAssetPath: src.model(size), delegate }, runningMode: 'VIDEO', numPoses: 2 });
      try {
        return await PoseLandmarker.createFromOptions(fileset, opts('GPU'));
      } catch {
        return await PoseLandmarker.createFromOptions(fileset, opts('CPU'));
      }
    })();
    videoLandmarkers[size].catch(() => { delete videoLandmarkers[size]; });
  }
  return videoLandmarkers[size];
}

export function detectVideoFrame(lm, source) {
  videoLastTs = Math.max(videoLastTs + 1, Math.round(performance.now()));
  return lm.detectForVideo(source, videoLastTs);
}

// What's drawn over the camera: just the two gloves, green when that hand is up at guard height
// and red when it has dropped. Less clutter than a skeleton, and it shows the one thing a boxer
// checks at a glance.
export function gloveState(pts) {
  const sh = (pts[11].y + pts[12].y) / 2, hip = (pts[23].y + pts[24].y) / 2;
  const limit = sh + (hip - sh) * 0.3; // a little below the shoulders still counts as up
  return [15, 16].map((i) => ({ i, up: pts[i].y <= limit, seen: (pts[i].visibility ?? 1) >= 0.5 }));
}

export function drawGloves(g, pts, w, h, { dim = false, px = 1 } = {}) {
  const shW = Math.hypot((pts[11].x - pts[12].x) * w, (pts[11].y - pts[12].y) * h);
  const r = Math.max(8 * px, shW * 0.22);
  for (const { i, up, seen } of gloveState(pts)) {
    if (!seen) continue;
    g.beginPath();
    g.arc(pts[i].x * w, pts[i].y * h, r, 0, Math.PI * 2);
    g.fillStyle = dim ? 'rgba(255,255,255,0.35)' : up ? 'rgba(34,197,94,0.55)' : 'rgba(239,68,68,0.6)';
    g.fill();
    g.lineWidth = Math.max(2, r * 0.18);
    g.strokeStyle = dim ? 'rgba(255,255,255,0.6)' : up ? '#22c55e' : '#ef4444';
    g.stroke();
  }
}

// The body drawn over the camera or a video: a skeleton you can see on any background (white
// lines with a dark edge), a ring round the head, and the gloves in colour (green = up at guard,
// red = dropped). style: 'me' (the boxer being followed), 'pick' (tap to choose, dashed) or
// 'other' (someone else in shot, faint). label: a tag above the head ('You', 'Tap'), or none.
const BONES = [
  [11, 12], [11, 23], [12, 24], [23, 24], // torso
  [11, 13], [13, 15], [12, 14], [14, 16], // arms
  [23, 25], [25, 27], [24, 26], [26, 28], // legs
];
export function drawBody(g, pts, w, h, { style = 'me', label = '' } = {}) {
  // Canvas pixels per screen pixel: a 720 px video shown 220 px wide still gets readable lines.
  const px = Math.max(1, w / (g.canvas.clientWidth || w));
  const P = (i) => ({ x: pts[i].x * w, y: pts[i].y * h });
  const ok = (i) => (pts[i]?.visibility ?? 1) >= 0.35;
  const shW = Math.max(20, Math.hypot(P(11).x - P(12).x, P(11).y - P(12).y));
  const lw = style === 'other' ? Math.max(1.5 * px, shW * 0.03) : Math.max(3 * px, shW * 0.05);
  const path = () => {
    g.beginPath();
    for (const [a, b] of BONES) {
      if (!ok(a) || !ok(b)) continue;
      g.moveTo(P(a).x, P(a).y);
      g.lineTo(P(b).x, P(b).y);
    }
  };
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (style === 'pick') g.setLineDash([lw * 3, lw * 2.5]);
  if (style !== 'other') { // dark edge first, so white lines show on a bright background too
    path();
    g.lineWidth = lw * 2.2;
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.stroke();
  }
  path();
  g.lineWidth = lw;
  g.strokeStyle = style === 'other' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.92)';
  g.stroke();
  // Head: a ring between the ears.
  const head = ok(0) ? P(0) : null;
  const r = ok(7) && ok(8) ? Math.max(9 * px, Math.hypot(P(7).x - P(8).x, P(7).y - P(8).y) * 0.75) : Math.max(9 * px, shW * 0.28);
  if (head) {
    g.beginPath();
    g.arc(head.x, head.y, r, 0, Math.PI * 2);
    if (style !== 'other') { g.lineWidth = lw * 2.2; g.strokeStyle = 'rgba(0,0,0,0.35)'; g.stroke(); }
    g.lineWidth = lw;
    g.strokeStyle = style === 'other' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.92)';
    g.stroke();
  }
  g.restore();
  if (style === 'me') drawGloves(g, pts, w, h, { px });
  if (label && head) {
    g.save();
    const fs = Math.round(Math.max(12 * px, shW * 0.3));
    g.font = `700 ${fs}px system-ui, -apple-system, sans-serif`;
    const tw = g.measureText(label).width, pad = fs * 0.6, bh = fs * 1.6;
    const x = head.x - tw / 2 - pad, y = head.y - r - bh - fs * 0.4;
    g.fillStyle = style === 'me' ? '#ff4655' : 'rgba(20,20,24,0.75)';
    g.beginPath();
    g.roundRect ? g.roundRect(x, y, tw + pad * 2, bh, bh / 2) : g.rect(x, y, tw + pad * 2, bh);
    g.fill();
    g.fillStyle = '#fff';
    g.textBaseline = 'middle';
    g.fillText(label, x + pad, y + bh / 2);
    g.restore();
  }
}

export class PoseTracker {
  constructor(video, canvas) {
    this.video = video;
    this.canvas = canvas;
    this.stream = null;
    this.running = false;
    this.onFrame = () => {};
    this.facing = 'user';
    this.maxFps = null; // set lower between rounds to save battery; null = every camera frame
  }

  async start(facing = this.facing) {
    this.facing = facing;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera needs the app to be opened over https://');
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      // 30 fps is plenty for punches; phones that film at 60 would double the work (and heat).
      video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 } },
      audio: false,
    });
    this.video.srcObject = this.stream;
    this.video.classList.toggle('mirror', facing === 'user');
    this.canvas.classList.toggle('mirror', facing === 'user');
    await this.video.play();
    this.model = pickLiveModel();
    try {
      this.landmarker = await getLandmarker(this.model);
    } catch {
      this.model = 'lite';
      this.landmarker = await getLandmarker('lite');
    }
    this.times = [];
    this.running = true;
    this._lastVideoTime = -1;
    this._lastDetect = -Infinity;
    // Back from another app: the OS may have paused the camera video, and frame callbacks only
    // come from a playing video, so restart both.
    this._onVis ||= () => {
      if (document.hidden || !this.running) return;
      this.video.play().catch(() => {});
      cancelAnimationFrame(this._raf); // one loop only: drop whichever wake-up is pending
      if (this._vfc != null) this.video.cancelVideoFrameCallback?.(this._vfc);
      this._raf = requestAnimationFrame(this._loop);
    };
    document.addEventListener('visibilitychange', this._onVis);
    this._loop();
  }

  async flip() {
    this.stopCamera();
    await this.start(this.facing === 'user' ? 'environment' : 'user');
  }

  _loop = () => {
    if (!this.running) return;
    const v = this.video;
    const now = performance.now();
    const due = !this.maxFps || now - this._lastDetect >= 1000 / this.maxFps - 4;
    if (v.readyState >= 2 && v.currentTime !== this._lastVideoTime && due && !document.hidden) {
      this._lastVideoTime = v.currentTime;
      this._lastDetect = now;
      const t = performance.now();
      let res;
      try {
        res = this.landmarker.detectForVideo(v, t);
      } catch {
        res = null;
      }
      this._checkSpeed(performance.now() - t);
      const image = res?.landmarks?.[0] || null;
      const world = res?.worldLandmarks?.[0] || null;
      this._draw(image);
      this.onFrame(world, image, t);
    }
    // Wake only when the camera has a new frame (not 60-120 times a second) where supported.
    if (v.requestVideoFrameCallback) this._vfc = v.requestVideoFrameCallback(() => this._loop());
    else this._raf = requestAnimationFrame(this._loop);
  };

  // Too slow for the full model? Switch to lite for the rest of this and future sessions.
  _checkSpeed(ms) {
    if (this.model !== 'full' || this.switching || this.times.length >= 60) return;
    this.times.push(ms);
    if (tooSlow(this.times)) {
      this.switching = true;
      try { localStorage.setItem(LIVE_PREF, `lite@${Date.now()}`); } catch { /* private mode */ }
      getLandmarker('lite').then((lm) => { this.landmarker = lm; this.model = 'lite'; }).catch(() => {}).finally(() => { this.switching = false; });
    }
  }

  _draw(pts) {
    const c = this.canvas;
    const v = this.video;
    if (c.width !== v.videoWidth) {
      c.width = v.videoWidth;
      c.height = v.videoHeight;
    }
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    if (pts) drawBody(g, pts, c.width, c.height);
  }

  stopCamera() {
    this.running = false;
    if (this._onVis) document.removeEventListener('visibilitychange', this._onVis);
    cancelAnimationFrame(this._raf);
    if (this._vfc != null) this.video.cancelVideoFrameCallback?.(this._vfc);
    this.stream?.getTracks().forEach((tr) => tr.stop());
    this.stream = null;
  }

  stop() {
    this.stopCamera();
    const g = this.canvas.getContext('2d');
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
