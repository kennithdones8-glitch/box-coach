// Story player: full-screen animated slides in a fight-breakdown style. A kicker, a two-line
// headline that slams in, a stage (animated figures, bars or a big number), a caption that builds
// word by word, and segment bars that fill as it plays. Tap right / left to move, hold to pause.
import { playScene } from './figure.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// slide: { kicker, title: [line1, line2], tone: 'gold' | 'red' | 'green', caption: 'words, *highlighted*',
//   scene?: { actors, callouts }, bars?: [{ label, v, max, tone, note }], big?: { value, unit, note },
//   cta?: { label, run }, ms? }
function slideHTML(s, i, n, label) {
  const caption = String(s.caption || '').split(/\s+/).filter(Boolean)
    .map((w, k) => `<span style="animation-delay:${400 + k * 170}ms" class="${/^\*.*\*[.,!?]?$/.test(w) ? `hl ${s.tone || 'gold'}` : ''}">${esc(w.replace(/\*/g, ''))}</span>`).join(' ');
  return `<div class="st-slide tone-${s.tone || 'gold'}">
    <div class="st-kicker"><i></i>${esc(s.kicker || '')}</div>
    <h2 class="st-title"><span class="l1">${esc(s.title?.[0] || '')}</span>${s.title?.[1] ? `<span class="l2">${esc(s.title[1])}</span>` : ''}</h2>
    <div class="st-stage">
      ${s.scene ? '<svg class="st-svg" aria-hidden="true"></svg>' : ''}
      ${s.bars ? `<div class="st-bars-chart">${s.bars.map((b, k) => `<div class="sb"><span class="sb-l">${esc(b.label)}</span><span class="sb-t"><span class="sb-f ${b.tone || ''}" style="--w:${Math.max(2, Math.min(100, (100 * b.v) / (b.max || 100)))}%;animation-delay:${300 + k * 160}ms"></span></span><b class="sb-v">${esc(b.text ?? b.v)}</b></div>`).join('')}</div>` : ''}
      ${s.big ? `<div class="st-big"><b data-count="${Number(s.big.value) || 0}">${esc(s.big.value)}</b>${s.big.unit ? `<span>${esc(s.big.unit)}</span>` : ''}${s.big.note ? `<small>${esc(s.big.note)}</small>` : ''}</div>` : ''}
    </div>
    <p class="st-cap">${caption}</p>
    ${s.cta ? `<button class="btn primary big block st-cta" type="button">${esc(s.cta.label)}</button>` : ''}
    <div class="st-foot">${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')} · ${esc(label)}</div>
  </div>`;
}

export function openStory(slides, { label = '' } = {}) {
  if (!slides.length) return;
  document.querySelector('.story')?.remove();
  const el = document.createElement('div');
  el.className = 'story';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', label || 'Breakdown');
  el.innerHTML = `<div class="st-segs">${slides.map(() => '<span><i></i></span>').join('')}</div>
    <button class="st-close" type="button" aria-label="Close">✕</button>
    <div class="st-body"></div>
    <button class="st-prev" type="button" aria-label="Previous"></button><button class="st-next" type="button" aria-label="Next"></button>`;
  document.body.append(el);
  document.body.classList.add('in-story');
  const prevFocus = document.activeElement;
  let i = 0, timer = 0, stop = null, left = 0, startedAt = 0, paused = false;
  const segs = [...el.querySelectorAll('.st-segs i')];
  const close = () => {
    clearTimeout(timer);
    stop?.();
    el.remove();
    document.body.classList.remove('in-story');
    document.removeEventListener('keydown', key);
    prevFocus?.focus?.();
  };
  const show = (k) => {
    if (k < 0) k = 0;
    if (k >= slides.length) return close();
    i = k;
    clearTimeout(timer);
    stop?.();
    const s = slides[i];
    const body = el.querySelector('.st-body');
    body.innerHTML = slideHTML(s, i, slides.length, label);
    if (s.scene) stop = playScene(body.querySelector('.st-svg'), s.scene);
    const big = body.querySelector('[data-count]');
    if (big && !matchMedia('(prefers-reduced-motion: reduce)').matches) countUp(big);
    body.querySelector('.st-cta')?.addEventListener('click', (e) => { e.stopPropagation(); close(); s.cta.run(); });
    left = s.ms || (s.cta ? 0 : 4800);
    segs.forEach((g, n) => { g.style.transition = 'none'; g.style.width = n < i ? '100%' : '0%'; });
    void el.offsetWidth;
    if (left) run();
    else segs[i].style.width = '100%';
  };
  const run = () => {
    startedAt = performance.now();
    segs[i].style.transition = `width ${left}ms linear`;
    segs[i].style.width = '100%';
    timer = setTimeout(() => show(i + 1), left);
  };
  const pause = () => {
    if (paused || !left) return;
    paused = true;
    clearTimeout(timer);
    left = Math.max(300, left - (performance.now() - startedAt));
    const seg = segs[i];
    seg.style.width = getComputedStyle(seg).width;
    seg.style.transition = 'none';
  };
  const resume = () => { if (paused) { paused = false; run(); } };
  const key = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') show(i + 1);
    if (e.key === 'ArrowLeft') show(i - 1);
  };
  document.addEventListener('keydown', key);
  el.querySelector('.st-close').addEventListener('click', close);
  // Tap to move on; hold to pause.
  let downAt = 0;
  for (const [sel, d] of [['.st-prev', -1], ['.st-next', 1]]) {
    const b = el.querySelector(sel);
    b.addEventListener('pointerdown', () => { downAt = performance.now(); setTimeout(() => { if (downAt) pause(); }, 220); });
    b.addEventListener('pointerup', () => { const held = performance.now() - downAt > 220; downAt = 0; if (held) resume(); else show(i + d); });
    b.addEventListener('pointerleave', () => { if (downAt) { downAt = 0; resume(); } });
  }
  show(0);
  el.querySelector('.st-close').focus();
  return close;
}

function countUp(b) {
  const to = +b.dataset.count, text = b.textContent;
  if (!to || !/^[\d,]+$/.test(text)) return;
  const t0 = performance.now(), dur = 900;
  const step = (now) => {
    const t = Math.min(1, (now - t0) / dur);
    b.textContent = Math.round(to * (1 - (1 - t) ** 3)).toLocaleString();
    if (t < 1 && b.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
