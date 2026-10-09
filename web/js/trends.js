// Recent form for the Today screen: a few measured numbers, the latest against your usual, and a
// small trend line. Only well-measured sessions count (see trackingOk), punch rates only within
// one kind of session (bag and shadowboxing rates aren't comparable), and nothing is claimed from
// fewer than two sessions.
import { trackingOk, punchCountOk, outputPpm } from './coach.js';

export const FORM_METRICS = [
  { key: 'guard', name: 'Guard up', unit: '%', better: 1, get: (s) => (trackingOk(s) ? s.form?.guard : null) },
  { key: 'ppm', name: 'Punches / min', unit: '', better: 1, get: (s) => (punchCountOk(s) && s.source !== 'manual' && !s.test ? outputPpm(s) : null) },
  { key: 'returnMs', name: 'Hand return', unit: ' ms', better: -1, get: (s) => (trackingOk(s) ? s.form?.handReturnMs : null) },
];

// { key, name, unit, better, last, usual, delta, trend: 'up' | 'down' | 'flat', series, n, type }
export function recentForm(sessions, { keep = 8, base = 4 } = {}) {
  const sorted = [...sessions].sort((a, b) => new Date(a.date) - new Date(b.date));
  return FORM_METRICS.map((m) => {
    let rows = sorted.map((s) => ({ s, v: m.get(s) })).filter((r) => r.v != null && Number.isFinite(r.v));
    const type = m.key === 'ppm' ? rows.at(-1)?.s.type : null;
    if (type) rows = rows.filter((r) => r.s.type === type);
    const series = rows.slice(-keep).map((r) => r.v);
    const out = { key: m.key, name: m.name, unit: m.unit, better: m.better, n: rows.length, series, type, last: series.at(-1) ?? null, usual: null, delta: null, trend: null };
    if (rows.length < 2) return out;
    const prev = rows.slice(-1 - base, -1).map((r) => r.v);
    out.usual = Math.round(prev.reduce((a, b) => a + b, 0) / prev.length);
    out.delta = Math.round(out.last - out.usual);
    const small = m.key === 'returnMs' ? 15 : 3; // below this it's noise, not a change
    out.trend = Math.abs(out.delta) < small ? 'flat' : out.delta * m.better > 0 ? 'up' : 'down';
    return out;
  });
}

// A tiny inline trend line (SVG markup) for a series of numbers.
export function sparkline(series, { w = 84, h = 26 } = {}) {
  if (series.length < 2) return '';
  const lo = Math.min(...series), hi = Math.max(...series);
  const x = (i) => (i / (series.length - 1)) * (w - 4) + 2;
  const y = (v) => h - 3 - ((v - lo) / (hi - lo || 1)) * (h - 6);
  const d = series.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}"/><circle cx="${x(series.length - 1)}" cy="${y(series.at(-1))}" r="2.5"/></svg>`;
}
