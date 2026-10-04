import test from 'node:test';
import assert from 'node:assert/strict';
import { myCard, shareLink, readCard, addFriend } from '../web/js/friends.js';
import { defaultState } from '../web/js/store.js';

test('friend cards: your numbers travel in the link, are checked on arrival, one card per friend', () => {
  const st = defaultState();
  st.profile.name = 'Kenny 🥊'; st.profile.shareId = 'abc123def'; st.profile.weeklyGoal = 2;
  const now = new Date('2026-10-04T12:00:00');
  st.sessions = [1, 2].map((d) => ({ id: `s${d}`, date: new Date(now - d * 86400000).toISOString(), type: 'shadow', workSec: 540, completedRounds: 3, punches: { total: 250 }, form: { guard: 80, speed: 3.6 } }));
  const card = myCard(st, now);
  assert.equal(card.s, 2);
  assert.equal(card.p, 500);
  assert.equal(card.g, 80);
  const link = shareLink(card, { protocol: 'capacitor:', href: 'capacitor://localhost/#home' });
  assert.ok(link.startsWith('https://kennithdones8-glitch.github.io/box-coach/#friend/'), 'store app shares the public address');
  const back = readCard(link.split('#friend/')[1]);
  assert.equal(back.n, 'Kenny 🥊');
  assert.equal(back.p, 500);
  // Tampered or broken links are refused; silly numbers are dropped.
  assert.equal(readCard('not-a-card'), null);
  const bad = Buffer.from(JSON.stringify({ ...card, p: 1e12, n: '<img src=x>'.repeat(5) })).toString('base64url');
  const r = readCard(bad);
  assert.equal(r.p, null);
  assert.equal(r.n.length, 20);
  // One card per friend, newest wins; never yourself.
  let fr = addFriend([], { ...back, i: 'friend001', p: 1 });
  fr = addFriend(fr, { ...back, i: 'friend001', p: 2 });
  fr = addFriend(fr, back, 'abc123def');
  assert.deepEqual(fr.map((f) => f.p), [2]);
});
