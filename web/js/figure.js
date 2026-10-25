// Animated boxer figures for drill demos and breakdown stories: flat mannequins (you in cream,
// a partner in grey, red gloves) posed by joint angles and tweened between key poses, with dashed
// target rings and labelled callouts. Plain SVG, no libraries.
//
// Angles are in degrees: 0 = pointing straight down, 90 = forward (toward the opponent), 180 = up.
// A figure faces right; a partner is drawn mirrored. Feet stay planted (the legs bend to reach them).

const L = { torso: 64, neck: 19, head: 15, up: 31, fore: 30, thigh: 44, shin: 43 };
const GROUND = 79;
const rad = (d) => (d * Math.PI) / 180;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const polar = (len, deg) => [Math.sin(rad(deg)) * len, Math.cos(rad(deg)) * len];

export const POSES = {
  guard: { x: 0, y: 0, lean: 8, head: 0, fa: [55, 175], ba: [40, 170], ff: 32, bf: -36, heel: 0 },
};
const P = (o) => ({ ...POSES.guard, ...o });
Object.assign(POSES, {
  jab: P({ x: 6, lean: 14, fa: [90, 90], ff: 40 }),
  jabDrop: P({ x: 6, lean: 14, fa: [90, 90], ff: 40, ba: [14, 60] }), // rear hand falls: the mistake
  halfJab: P({ x: 3, lean: 11, fa: [72, 128] }),
  cross: P({ x: 9, lean: 20, ba: [88, 90], fa: [52, 178], heel: 7 }),
  hook: P({ x: 4, lean: 15, fa: [96, 116] }),
  hookLoad: P({ x: -2, lean: 4, fa: [60, 160] }),
  rearHook: P({ x: 7, lean: 18, ba: [94, 114], heel: 6 }),
  dip: P({ y: 12, lean: 18, ba: [28, 140], fa: [50, 172] }),
  upper: P({ y: 4, lean: 12, ba: [62, 178], heel: 6 }),
  leadUpper: P({ y: 4, lean: 12, fa: [66, 178] }),
  slip: P({ y: 11, lean: 30, x: 5, head: 8 }),
  roll: P({ y: 24, lean: 42, x: 2 }),
  pull: P({ lean: -12, x: -7 }),
  block: P({ fa: [78, 184], ba: [66, 184] }),
  stepIn: P({ x: 18, ff: 52, bf: -18 }),
  stepOut: P({ x: -16, ff: 14, bf: -54 }),
  pivot: P({ x: -6, lean: 4, ff: 30, bf: -12, heel: 4 }),
  bodyJab: P({ x: 6, y: 14, lean: 24, fa: [78, 74], ff: 44 }),
  bodyHook: P({ x: 4, y: 12, lean: 24, fa: [80, 118] }),
});

// A move: [pose, ms to get there]. Every move starts and ends in guard.
const g = (ms = 380) => ['guard', ms];
export const MOVES = {
  jab: [g(500), ['jab', 130], ['jab', 90], g(240)],
  cross: [g(500), ['cross', 150], ['cross', 90], g(260)],
  oneTwo: [g(500), ['jab', 120], ['guard', 150], ['cross', 140], ['cross', 80], g(260)],
  hook: [g(500), ['hookLoad', 160], ['hook', 150], ['hook', 90], g(260)],
  rearHook: [g(500), ['rearHook', 170], ['rearHook', 90], g(280)],
  upper: [g(500), ['dip', 200], ['upper', 160], ['upper', 90], g(280)],
  leadUpper: [g(500), ['dip', 200], ['leadUpper', 160], ['leadUpper', 90], g(280)],
  feint: [g(500), ['halfJab', 110], ['guard', 130], ['jab', 120], ['jab', 80], g(260)],
  slip: [g(520), ['slip', 200], ['slip', 160], g(240)],
  roll: [g(520), ['roll', 300], ['roll', 120], g(320)],
  pull: [g(520), ['pull', 180], ['pull', 160], ['cross', 170], ['cross', 80], g(260)],
  block: [g(520), ['block', 160], ['block', 420], g(260)],
  defense: [g(400), ['slip', 200], ['slip', 120], g(220), ['roll', 300], ['roll', 100], g(300), ['block', 160], ['block', 320], g(240)],
  inOut: [g(400), ['stepIn', 260], ['jab', 120], ['jab', 80], ['stepIn', 140], ['stepOut', 340], ['stepOut', 260], g(320)],
  pivotOut: [g(400), ['jab', 120], ['guard', 150], ['cross', 140], ['guard', 200], ['pivot', 260], ['stepOut', 260], ['stepOut', 200], g(320)],
  jabMove: [g(400), ['jab', 130], ['guard', 160], ['stepOut', 260], ['guard', 260], ['jab', 130], ['guard', 160], ['stepIn', 260], g(260)],
  bodyHead: [g(500), ['bodyJab', 180], ['bodyJab', 90], ['guard', 200], ['hookLoad', 120], ['hook', 150], ['hook', 80], g(260)],
  headMove: [g(400), ['jab', 120], ['guard', 150], ['cross', 140], ['guard', 160], ['slip', 200], ['slip', 120], g(260)],
  burst: [g(300), ['jab', 90], ['guard', 90], ['cross', 90], ['guard', 90], ['jab', 90], ['guard', 90], ['cross', 90], ['guard', 90], ['jab', 90], ['guard', 90], ['cross', 90], g(160)],
  tripleJab: [g(420), ['jab', 100], ['guard', 110], ['jab', 100], ['guard', 110], ['jab', 100], ['jab', 70], g(220)],
  jabDrop: [g(500), ['jabDrop', 130], ['jabDrop', 140], g(300)],
  slowReturn: [g(500), ['jab', 130], ['jab', 420], g(700)],
  guardHold: [g(600), ['guard', 900]],
  // The partner's side of a scene.
  partnerJab: [g(700), ['jab', 140], ['jab', 120], g(300)],
};

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const mix = (a, b, t) => (Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * t) : a + (b - a) * t);
const blend = (A, B, t) => Object.fromEntries(Object.keys(A).map((k) => [k, mix(A[k], B[k], t)]));

// The pose a move is in after `ms` (looping).
export function poseAt(move, ms) {
  const seq = MOVES[move] || MOVES.guardHold;
  const total = seq.reduce((a, [, d]) => a + d, 0);
  let t = ((ms % total) + total) % total;
  let prev = POSES[seq.at(-1)[0]];
  for (const [name, d] of seq) {
    const cur = POSES[name];
    if (t <= d) return blend(prev, cur, ease(d ? t / d : 1));
    t -= d;
    prev = cur;
  }
  return prev;
}
export const moveLength = (move) => (MOVES[move] || MOVES.guardHold).reduce((a, [, d]) => a + d, 0);

// Two-bone reach: the knee (or elbow) between a and b, bent toward +x.
function bend(a, b, l1, l2) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01);
  const base = Math.atan2(dy, dx);
  const off = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const k1 = [a[0] + l1 * Math.cos(base - off), a[1] + l1 * Math.sin(base - off)];
  const k2 = [a[0] + l1 * Math.cos(base + off), a[1] + l1 * Math.sin(base + off)];
  return k1[0] > k2[0] ? k1 : k2;
}

// Joint positions for a pose (hip at x, ground at GROUND).
export function joints(p) {
  const hip = [p.x, p.y];
  const neck = add(hip, polar(L.torso, 180 - p.lean));
  const head = add(neck, polar(L.neck, 180 - p.lean - p.head));
  const fS = add(neck, [5, 7]), bS = add(neck, [-4, 7]);
  const fE = add(fS, polar(L.up, p.fa[0])), fH = add(fE, polar(L.fore, p.fa[1]));
  const bE = add(bS, polar(L.up, p.ba[0])), bH = add(bE, polar(L.fore, p.ba[1]));
  const fF = [p.ff, GROUND], bF = [p.bf, GROUND - p.heel];
  const fHip = add(hip, [5, 0]), bHip = add(hip, [-5, 0]);
  return { hip, neck, head, fS, fE, fH, bS, bE, bH, fK: bend(fHip, fF, L.thigh, L.shin), fF, bK: bend(bHip, bF, L.thigh, L.shin), bF, fHip, bHip };
}

const SKIN = {
  you: { near: '#ece1c9', far: '#c3b597', shorts: '#2a2b30', glove: '#e23b3f', gloveFar: '#a9282c' },
  partner: { near: '#8d939e', far: '#676c76', shorts: '#3a3d44', glove: '#e23b3f', gloveFar: '#a9282c' },
};
const f1 = (n) => Math.round(n * 10) / 10;
const seg = (a, b, w, c) => `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;

// SVG for one figure. at: [x, y] where the hip goes in the scene; mirror for a partner facing left.
export function figureSVG(p, { who = 'you', at = [0, 0], scale = 1, mirror = false } = {}) {
  const c = SKIN[who];
  const j = joints(p);
  const ax = j.neck[0] - j.hip[0], ay = j.neck[1] - j.hip[1], len = Math.hypot(ax, ay);
  const px = -ay / len, py = ax / len; // across the torso
  const pt = (o, w) => `${f1(o[0] + px * w)},${f1(o[1] + py * w)} ${f1(o[0] - px * w)},${f1(o[1] - py * w)}`;
  const shoulder = add(j.neck, [ax / len * -2, ay / len * -2]);
  const waist = add(j.hip, [ax / len * 16, ay / len * 16]);
  const torso = `<polygon points="${pt(shoulder, 17)} ${pt(j.hip, 13).split(' ').reverse().join(' ')}" fill="${c.near}"/>`;
  const shorts = `<polygon points="${pt(waist, 14)} ${pt(j.hip, 14).split(' ').reverse().join(' ')}" fill="${c.shorts}"/>`;
  return `<g transform="translate(${at[0]},${at[1]}) scale(${mirror ? -scale : scale},${scale})">
    ${seg(j.bHip, j.bK, 15, c.far)}${seg(j.bK, j.bF, 14, c.far)}${seg(j.bF, add(j.bF, [-9, 0]), 9, c.far)}
    ${seg(j.bS, j.bE, 12, c.far)}${seg(j.bE, j.bH, 11, c.far)}<circle cx="${f1(j.bH[0])}" cy="${f1(j.bH[1])}" r="9" fill="${c.gloveFar}"/>
    ${torso}${shorts}
    ${seg(j.fHip, j.fK, 15, c.near)}${seg(j.fK, j.fF, 14, c.near)}${seg(j.fF, add(j.fF, [10, 0]), 9, c.near)}
    <circle cx="${f1(j.head[0])}" cy="${f1(j.head[1])}" r="${L.head}" fill="${c.near}"/>
    ${seg(j.fS, j.fE, 12, c.near)}${seg(j.fE, j.fH, 11, c.near)}<circle cx="${f1(j.fH[0])}" cy="${f1(j.fH[1])}" r="9.5" fill="${c.glove}"/>
  </g>`;
}

// Where a joint is in scene coordinates.
export function jointAt(p, name, { at = [0, 0], scale = 1, mirror = false } = {}) {
  const v = joints(p)[name];
  return [at[0] + v[0] * scale * (mirror ? -1 : 1), at[1] + v[1] * scale];
}

const TONE = { gold: '#f5b700', red: '#ff5257', green: '#3dd68c', white: '#eceef1' };
// A dashed ring on a point with a leader line to a label.
export function calloutSVG(pt, text, { tone = 'gold', dx = 40, dy = -30, r = 15, width = Infinity } = {}) {
  const c = TONE[tone] || tone;
  const w = text.length * 6.4 + 14;
  if (dx >= 0 && pt[0] + dx + w > width - 4) dx = -Math.abs(dx); // no room on the right: point left
  if (dx < 0 && pt[0] + dx - w < 4) dx = Math.abs(dx);
  const lx = pt[0] + dx, ly = pt[1] + dy;
  const bx = dx >= 0 ? lx : lx - w;
  const edge = dx >= 0 ? bx : bx + w;
  return `<g class="callout">
    <circle cx="${f1(pt[0])}" cy="${f1(pt[1])}" r="${r}" fill="${c}" fill-opacity="0.12" stroke="${c}" stroke-width="1.6" stroke-dasharray="3 3"/>
    <polyline points="${f1(pt[0] + (dx >= 0 ? r : -r) * 0.7)},${f1(pt[1] + (dy >= 0 ? r : -r) * 0.7)} ${f1(edge)},${f1(ly)}" fill="none" stroke="${c}" stroke-width="1.4"/>
    <rect x="${f1(bx)}" y="${f1(ly - 9)}" width="${f1(w)}" height="18" rx="2" fill="#0d0e11" stroke="${c}" stroke-width="1"/>
    <text x="${f1(bx + w / 2)}" y="${f1(ly + 4)}" text-anchor="middle" fill="${c}" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="10.5" font-weight="700" letter-spacing="0.06em">${text.replace(/[<&>]/g, '')}</text>
  </g>`;
}

const reduced = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Play a scene in an SVG element until stop() (or the element leaves the page).
// actors: [{ who, move, at, scale, mirror, delay, trail? (joint whose path to draw, e.g. 'fH') }]; callouts: [{ actor, joint, text, tone, dx, dy, from, to }]
// (from / to: fractions of the first actor's move when the callout shows).
export function playScene(svg, { actors, callouts = [], floor = true, width = 360, height = 300 }) {
  let raf = 0, t0 = performance.now(), stopped = false;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const lead = actors[0];
  const draw = (now) => {
    if (stopped) return;
    if (!svg.isConnected) { stopped = true; return; }
    const ms = reduced() ? 0 : now - t0;
    const poses = actors.map((a) => poseAt(a.move, ms - (a.delay || 0)));
    const frac = (((ms % moveLength(lead.move)) + moveLength(lead.move)) % moveLength(lead.move)) / moveLength(lead.move);
    const groundY = (lead.at[1] + GROUND * (lead.scale || 1)) + 9 * (lead.scale || 1);
    // Trails: where a fist travelled over the last moment, so a hook reads as an arc and an
    // uppercut as a rise (side-on, both otherwise look like a bent arm).
    const trails = actors.map((a, i) => {
      if (!a.trail || reduced()) return '';
      const pts = Array.from({ length: 14 }, (_, k) => jointAt(poseAt(a.move, ms - (a.delay || 0) - k * 30), a.trail, a));
      const moving = Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]) > 12;
      return moving ? `<polyline points="${pts.map((q) => `${f1(q[0])},${f1(q[1])}`).join(' ')}" fill="none" stroke="#f5b700" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>` : '';
    }).join('');
    svg.innerHTML = `${floor ? `<ellipse cx="${width / 2}" cy="${f1(groundY)}" rx="${width * 0.42}" ry="10" fill="#000" opacity="0.35"/>` : ''}
      ${trails}${actors.map((a, i) => figureSVG(poses[i], a)).join('')}
      ${callouts.filter((c) => reduced() || frac >= (c.from ?? 0) && frac <= (c.to ?? 1)).map((c) => calloutSVG(jointAt(poses[c.actor || 0], c.joint, actors[c.actor || 0]), c.text, { ...c, width })).join('')}`;
    if (!reduced()) raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  return () => { stopped = true; cancelAnimationFrame(raf); };
}
