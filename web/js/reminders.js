// Program reminders as calendar events: one event per remaining session on your chosen days, each
// with an alert. A calendar file works on every phone, with no account and no server.

const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const utcStamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
// Text values: escape what the format needs, fold long lines.
const text = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const fold = (line) => { const cs = Array.from(line), out = []; for (let i = 0; i < cs.length; i += 70) out.push((i ? ' ' : '') + cs.slice(i, i + 70).join('')); return out.join('\r\n'); };

// Default days for a number of sessions a week (0 = Monday).
export const DEFAULT_DAYS = { 2: [1, 4], 3: [0, 2, 4], 4: [0, 1, 3, 5], 5: [0, 1, 2, 4, 5] };

// The dates of the next `count` sessions on the chosen weekdays (0 = Monday), from `from` on (today
// counts if the time hasn't passed).
export function sessionDates(count, days, time = '18:00', from = new Date()) {
  const [h, m] = time.split(':').map(Number);
  const out = [];
  const d = new Date(from);
  d.setHours(h, m, 0, 0);
  if (d < from) d.setDate(d.getDate() + 1);
  for (let guard = 0; out.length < count && guard < 400; guard++) {
    if (days.includes((d.getDay() + 6) % 7)) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// prog: a program (programs.js); steps from `startStep` on. url: where the app lives.
export function programIcs(prog, startStep, { days, time = '18:00', from = new Date(), url = '', minutes = () => 30 } = {}) {
  const steps = prog.steps.map((st, i) => [st, i]).slice(startStep);
  const dates = sessionDates(steps.length, days, time, from);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BoxCoach//Programs//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  steps.forEach(([st, i], k) => {
    const start = dates[k];
    const end = new Date(+start + Math.max(10, minutes(st)) * 60000);
    lines.push('BEGIN:VEVENT',
      `UID:boxcoach-${prog.id}-${i}-${utcStamp(from)}@boxcoach`,
      `DTSTAMP:${utcStamp(from)}`,
      `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
      fold(`SUMMARY:${text(`🥊 ${prog.name}: ${st.name}`)}`),
      fold(`DESCRIPTION:${text(`Week ${Math.floor(i / prog.perWeek) + 1} · Day ${(i % prog.perWeek) + 1}. ${st.note}${url ? `\nOpen BoxCoach: ${url}` : ''}`)}`),
      ...(url ? [fold(`URL:${url}`)] : []),
      'BEGIN:VALARM', 'ACTION:DISPLAY', fold(`DESCRIPTION:${text(`${prog.name}: ${st.name}`)}`), 'TRIGGER:-PT15M', 'END:VALARM',
      'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return { ics: `${lines.join('\r\n')}\r\n`, count: steps.length, first: dates[0] || null, last: dates.at(-1) || null };
}
