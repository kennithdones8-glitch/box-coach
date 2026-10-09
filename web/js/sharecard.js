// A session as a picture for an Instagram story or a group chat: the numbers that matter, big,
// on a dark card with the BoxCoach name. Drawn on the phone; nothing is uploaded.
import { outputPpm, speedText } from './coach.js';

// What goes on the card (pure, so it can be tested without a canvas).
export function cardData(session, { name, unit = 'lb', badges = [] } = {}) {
  const stats = [];
  const rounds = session.completedRounds;
  if (rounds) stats.push([String(rounds), rounds === 1 ? 'round' : 'rounds']);
  if (session.punches?.total) stats.push([session.punches.total.toLocaleString('en-US'), 'punches']);
  const ppm = outputPpm(session);
  if (ppm != null) stats.push([String(ppm), 'per minute']);
  if (session.form?.guard != null) stats.push([`${session.form.guard}%`, 'hands up']);
  if (session.form?.speed != null) stats.push([speedText(session.form.speed, unit), 'hand speed']);
  if (session.defense?.pct != null) stats.push([`${session.defense.pct}%`, 'defense calls hit']);
  if (session.test) stats.push([`${session.test.typePct}%`, 'punches read right']);
  const mins = Math.round((session.workSec || 0) / 60);
  return {
    title: name,
    date: new Date(session.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
    stats: stats.slice(0, 4),
    sub: mins ? `${mins} min of work` : '',
    badges: badges.slice(0, 2).map((b) => `${b.icon} ${b.name}`),
  };
}

const W = 1080, H = 1920;

export async function drawCard(canvas, d, iconUrl = 'icon.svg') {
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1d1708'); bg.addColorStop(0.55, '#0b0b0d'); bg.addColorStop(1, '#000');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // A soft red glow behind the numbers.
  const glow = g.createRadialGradient(W * 0.5, H * 0.42, 40, W * 0.5, H * 0.42, W * 0.75);
  glow.addColorStop(0, 'rgba(212, 32, 51, 0.35)'); glow.addColorStop(1, 'rgba(212, 32, 51, 0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  const font = (w, s) => `${w} ${s}px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif`;
  const num = (s) => `700 ${s}px ui-rounded, "SF Pro Rounded", -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;
  g.textAlign = 'left'; g.fillStyle = '#fff';
  // Header: icon + name.
  try {
    const img = new Image(); img.src = iconUrl; await img.decode();
    g.drawImage(img, 90, 150, 96, 96);
  } catch { /* no icon: the name alone */ }
  g.font = font(700, 54); g.fillText('BoxCoach', 210, 216);
  g.fillStyle = 'rgba(255,255,255,0.6)'; g.font = font(600, 38); g.fillText(d.date.toUpperCase(), 90, 400);
  g.fillStyle = '#fff'; g.font = font(800, 96);
  wrap(g, d.title, 90, 510, W - 180, 104);
  // The numbers: a 2 × 2 grid.
  const top = 760, cellH = 330;
  const cellW = (W - 180) / 2 - 30;
  d.stats.forEach(([v, label], i) => {
    const x = 90 + (i % 2) * ((W - 180) / 2), y = top + Math.floor(i / 2) * cellH;
    let size = 160; // shrink a long number until it fits its half of the card
    g.font = num(size);
    while (size > 70 && g.measureText(v).width > cellW) { size -= 8; g.font = num(size); }
    g.fillStyle = '#fff'; g.fillText(v, x, y + 160);
    g.fillStyle = 'rgba(255,255,255,0.62)'; g.font = font(600, 40); g.fillText(label, x + 4, y + 225);
  });
  let y = top + Math.ceil(d.stats.length / 2) * cellH + 40;
  if (d.sub) { g.fillStyle = 'rgba(255,255,255,0.75)'; g.font = font(600, 44); g.fillText(d.sub, 90, y); y += 80; }
  for (const b of d.badges) { g.fillStyle = '#fff'; g.font = font(700, 44); g.fillText(b, 90, y); y += 70; }
  // Footer.
  g.fillStyle = '#f5b700'; g.fillRect(90, H - 230, 120, 8);
  g.fillStyle = 'rgba(255,255,255,0.8)'; g.font = font(600, 40); g.fillText('Tracked with BoxCoach', 90, H - 150);
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.font = font(500, 34); g.fillText('A boxing coach in your phone', 90, H - 95);
  return canvas;
}

function wrap(g, text, x, y, max, lh) {
  const words = String(text).split(' ');
  let lineText = '';
  for (const w of words) {
    const t = lineText ? `${lineText} ${w}` : w;
    if (g.measureText(t).width > max && lineText) { g.fillText(lineText, x, y); y += lh; lineText = w; } else lineText = t;
  }
  g.fillText(lineText, x, y);
}

// Share the picture (phone share sheet), or download it where sharing files isn't supported.
export async function shareCard(d) {
  const c = await drawCard(document.createElement('canvas'), d);
  const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
  const file = new File([blob], 'boxcoach-session.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'My BoxCoach session' }); return 'shared'; } catch (err) {
      // Closing the share sheet is fine; a refusal (the tap counted as too old after drawing) isn't.
      if (err?.name !== 'NotAllowedError') return 'cancelled';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'downloaded';
}
