// Lock-screen bells (store app only): when the screen goes off mid-session, the round bells still
// to come are handed to the phone as notifications, so they ring with the phone locked; when you
// come back, they're taken back so nothing rings twice. The website can't do this (a locked phone
// pauses web pages), so on the web every call here does nothing.
import { upcomingBells } from './timer.js';

const IDS = Array.from({ length: 40 }, (_, i) => ({ id: 7100 + i }));
// The app has no build step, so it talks to the native plugin through Capacitor's bridge directly
// (what @capacitor/core's plugin wrapper does under the hood).
const plugin = () => {
  const cap = globalThis.Capacitor;
  if (!cap?.isNativePlatform?.() || !cap.nativePromise) return null;
  const call = (method) => (options = {}) => cap.nativePromise('LocalNotifications', method, options);
  return { checkPermissions: call('checkPermissions'), requestPermissions: call('requestPermissions'), schedule: call('schedule'), cancel: call('cancel') };
};

// Ask once, at the start of a session.
export async function bellsReady() {
  const ln = plugin();
  if (!ln) return false;
  try {
    const p = await ln.checkPermissions();
    return (p.display === 'granted' ? p : await ln.requestPermissions()).display === 'granted';
  } catch { return false; }
}

export async function handBellsToPhone(timer) {
  const ln = plugin();
  if (!ln) return;
  const bells = upcomingBells(timer);
  if (!bells.length) return;
  try {
    await ln.schedule({ notifications: bells.map((b, i) => ({ id: IDS[i].id, title: b.title, body: b.body, schedule: { at: new Date(b.at).toISOString(), allowWhileIdle: true } })) });
  } catch { /* notifications off: the timer still catches up when you come back */ }
}

export async function takeBellsBack() {
  const ln = plugin();
  if (!ln) return;
  try { await ln.cancel({ notifications: IDS }); } catch { /* nothing scheduled */ }
}
