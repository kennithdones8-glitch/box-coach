// Small single-series SVG line chart with tap/hover tooltip.
// points: [{ x: label, y: value, est: true when it's an estimate or from a badly tracked session }].
// The best point is ringed (better: 1 = higher is better, -1 = lower), the latest is labelled,
// and estimates are drawn hollow so a shaky reading never looks like a measured one.

const W = 340, H = 160, PAD = { l: 34, r: 14, t: 18, b: 22 };
let uid = 0;

export function lineChart(el, points, { min = 0, max = null, unit = '', target = null, label = '', better = 1 } = {}) {
  if (!points.length) {
    el.innerHTML = '<p class="muted small chart-empty">No data yet. Train with the camera on to see this.</p>';
    return;
  }
  if (points.length === 1) {
    el.innerHTML = `<div class="chart-one"><b class="num">${points[0].y}${unit}</b><span class="muted small">${points[0].x}${points[0].est ? ' · estimate' : ''}. One session so far: a trend needs two or more.</span></div>`;
    return;
  }
  const ys = points.map((p) => p.y);
  const hi = max ?? Math.max(10, ...ys, target ?? 0) * 1.12;
  const lo = min;
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const x = (i) => PAD.l + (i / (points.length - 1)) * iw;
  const y = (v) => PAD.t + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const ticks = [lo, lo + (hi - lo) / 2, hi].map((v) => Math.round(v));
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join('');
  const area = `${path}L${x(points.length - 1).toFixed(1)},${PAD.t + ih}L${x(0).toFixed(1)},${PAD.t + ih}Z`;
  const measured = points.map((p, i) => [p, i]).filter(([p]) => !p.est);
  const best = measured.length >= 3 ? measured.reduce((a, b) => ((b[0].y - a[0].y) * better > 0 ? b : a))[1] : -1;
  const last = points.length - 1;
  const mid = Math.floor(last / 2);
  const id = `cg${++uid}`;
  const hasEst = points.some((p) => p.est);
  const lx = Math.min(x(last), W - PAD.r - 2);

  el.innerHTML = `
    <div class="chart-wrap">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}: latest ${points[last].y}${unit}${best >= 0 ? `, best ${points[best].y}${unit}` : ''}">
        <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" class="area-top"/><stop offset="1" class="area-bottom"/></linearGradient></defs>
        ${ticks.map((t) => `<line class="grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(t)}" y2="${y(t)}"/><text class="axis" x="${PAD.l - 6}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join('')}
        ${target != null ? `<line class="target" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(target)}" y2="${y(target)}"/><text class="axis tgt" x="${PAD.l + 4}" y="${y(target) - 4}">target ${target}${unit}</text>` : ''}
        <path class="area" d="${area}" fill="url(#${id})"/>
        <path class="line" d="${path}" pathLength="1"/>
        ${points.map((p, i) => `<circle class="dot${p.est ? ' est' : ''}${i === last ? ' last' : ''}" cx="${x(i)}" cy="${y(p.y)}" r="${i === last ? 4.5 : 3.2}"/>`).join('')}
        ${best >= 0 ? `<circle class="best" cx="${x(best)}" cy="${y(points[best].y)}" r="8"/><text class="axis best-l" x="${x(best)}" y="${y(points[best].y) - 12}" text-anchor="middle">best</text>` : ''}
        <text class="val" x="${lx}" y="${Math.max(12, y(points[last].y) - 9)}" text-anchor="end">${points[last].y}${unit}</text>
        <text class="axis" x="${PAD.l}" y="${H - 4}">${points[0].x}</text>
        ${last >= 4 ? `<text class="axis" x="${x(mid)}" y="${H - 4}" text-anchor="middle">${points[mid].x}</text>` : ''}
        <text class="axis" x="${W - PAD.r}" y="${H - 4}" text-anchor="end">${points[last].x}</text>
        <line class="cross" x1="0" x2="0" y1="${PAD.t}" y2="${PAD.t + ih}" visibility="hidden"/>
        <rect class="hit" x="${PAD.l}" y="0" width="${iw}" height="${H}" fill="transparent"/>
      </svg>
      <div class="tip" hidden></div>
      ${hasEst ? '<p class="chart-key"><i class="k-m"></i>measured <i class="k-e"></i>estimate (camera unsure)</p>' : ''}
    </div>`;

  const svg = el.querySelector('svg');
  const tip = el.querySelector('.tip');
  const cross = el.querySelector('.cross');
  const show = (evt) => {
    const r = svg.getBoundingClientRect();
    const sx = ((evt.clientX - r.left) / r.width) * W;
    let near = 0;
    points.forEach((_, i) => { if (Math.abs(x(i) - sx) < Math.abs(x(near) - sx)) near = i; });
    const p = points[near];
    cross.setAttribute('x1', x(near));
    cross.setAttribute('x2', x(near));
    cross.setAttribute('visibility', 'visible');
    tip.hidden = false;
    tip.innerHTML = `<b>${p.y}${unit}</b> <span>${p.x}${p.est ? ' · estimate' : ''}${near === best ? ' · best' : ''}</span>`;
    const left = (x(near) / W) * r.width;
    tip.style.left = `${Math.min(Math.max(left, 50), r.width - 50)}px`;
    tip.style.top = `${(y(p.y) / H) * r.height - 10}px`;
  };
  const hide = () => {
    tip.hidden = true;
    cross.setAttribute('visibility', 'hidden');
  };
  svg.addEventListener('pointermove', show);
  svg.addEventListener('pointerdown', show);
  svg.addEventListener('pointerleave', hide);
}
