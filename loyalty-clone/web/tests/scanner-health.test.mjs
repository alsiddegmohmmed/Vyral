import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asReason, buildReport, evaluateChecks, overallStatus, repairCopy, retryOnce, scrubText, seenLabel, shouldApplyUpdate, updateReady } from '../lib/scanner-health.ts';

test('re-pair copy: first-time setup vs "needs pairing again", with the phone name', () => {
  assert.equal(repairCopy('not_paired').title, 'Set up this phone');
  assert.equal(repairCopy(undefined).firstTime, true);
  for (const r of ['device_removed', 'cookie_missing', 'session_expired', 'device_unknown']) {
    const c = repairCopy(r, 'Front counter');
    assert.equal(c.title, 'This phone needs pairing again', r);
    assert.equal(c.firstTime, false);
  }
  assert.match(repairCopy('cookie_missing', 'Front counter').body, /“Front counter” is still listed/);
  assert.match(repairCopy('device_removed', 'Till').body, /“Till” was removed/);
  assert.equal(asReason('nonsense'), 'not_paired');
  assert.equal(asReason('device_removed'), 'device_removed');
});

test('retryOnce: a network failure is retried exactly once; success is not retried', async () => {
  const noSleep = async () => {};
  let n = 0;
  let r = await retryOnce(async () => (++n === 1 ? null : 'ok'), 0, noSleep);
  assert.deepEqual(r, { value: 'ok', attempts: 2 });
  n = 0;
  r = await retryOnce(async () => { n++; return null; }, 0, noSleep);
  assert.deepEqual(r, { value: null, attempts: 2 });
  assert.equal(n, 2, 'never more than two tries');
  n = 0;
  r = await retryOnce(async () => { n++; return 'first'; }, 0, noSleep);
  assert.deepEqual(r, { value: 'first', attempts: 1 });
});

test('updates apply only on the camera screen, never while a card is open', () => {
  assert.equal(updateReady('a1', 'b2'), true);
  assert.equal(updateReady('a1', 'a1'), false);
  assert.equal(updateReady('a1', null), false);
  assert.equal(shouldApplyUpdate('a1', 'b2', 'card'), false);
  assert.equal(shouldApplyUpdate('a1', 'b2', 'result'), false);
  assert.equal(shouldApplyUpdate('a1', 'b2', 'camera'), true);
  assert.equal(shouldApplyUpdate('a1', 'a1', 'camera'), false);
});

test('self-check: every check gets a plain result, failures get a fix hint', () => {
  const good = evaluateChecks({ network: { ok: true, ms: 120 }, pairing: { status: 'paired', who: 'Front counter', role: 'device' }, camera: 'granted', decoder: 'wasm', clockSkewMs: 20_000 });
  assert.deepEqual(good.map((c) => c.id), ['network', 'pairing', 'camera', 'decoder', 'clock']);
  assert.equal(overallStatus(good), 'ok');
  assert.match(good[1].detail, /Paired as “Front counter”/);

  const bad = evaluateChecks({ network: { ok: false }, pairing: { status: 'unknown' }, camera: 'denied', decoder: 'failed', clockSkewMs: -9 * 60_000 });
  assert.equal(overallStatus(bad), 'fail');
  for (const c of bad) assert.ok(c.hint, `${c.id} has a hint`);
  assert.equal(bad.find((c) => c.id === 'clock').status, 'warn');
  assert.match(bad.find((c) => c.id === 'clock').detail, /9 minutes off/);

  const unpaired = evaluateChecks({ network: { ok: true }, pairing: { status: 'unpaired', reason: 'device_removed' }, camera: 'prompt', decoder: 'native' });
  assert.equal(unpaired.find((c) => c.id === 'pairing').status, 'fail');
  assert.equal(unpaired.some((c) => c.id === 'clock'), false, 'no clock row without a server time');
  assert.equal(overallStatus(unpaired), 'fail');
});

test('problem report: no customer data survives the scrub', () => {
  const dirty = 'lookup failed for v1.AbC_123.xyz-987 code 9Y77BKHV card 3f2b1c4d-1111-4222-8333-123456789abc serial 01JD0000000000000000000000 phone +250 788 600 222 mail amani@example.com';
  const s = scrubText(dirty);
  for (const leak of ['v1.AbC', '9Y77BKHV', '3f2b1c4d', '01JD000', '788 600', 'amani@']) assert.ok(!s.includes(leak), `leaked ${leak}: ${s}`);
  assert.match(s, /lookup failed for \[qr\] code \[code\]/);
  assert.equal(scrubText('x'.repeat(900)).length, 500);
});

test('problem report: only whitelisted fields and checks, capped', () => {
  const r = buildReport({
    appVersion: 'abc1234<script>', userAgent: 'Mozilla/5.0 '.repeat(60), lastError: 'TypeError: card 9Y77BKHV',
    checks: [{ id: 'network', status: 'ok', detail: 'Reached', name: 'Amani' }, { id: 'evil', status: 'ok', detail: 'x' }, { id: 'camera', status: 'meh' }],
    customer: { name: 'Amani' },
  });
  assert.equal(r.appVersion, 'abc1234script');
  assert.equal(r.userAgent.length, 300);
  assert.equal(r.lastError, 'TypeError: card [code]');
  assert.deepEqual(r.checks, [{ id: 'network', status: 'ok', detail: 'Reached' }]);
  assert.equal('customer' in r, false);
  assert.equal(buildReport({}).lastError, null);
  assert.equal(buildReport({ lastError: '2026-11-25T10:00:00.000Z lookup 9Y77BKHV for +250 788 600 222' }).lastError, '2026-11-25T10:00:00.000Z lookup [code] for [number]');
  assert.equal(buildReport({}).appVersion, 'unknown');
});

test('owner view: online for 3 minutes, then a plain "last seen"', () => {
  const now = Date.parse('2026-11-25T12:00:00Z');
  const ago = (s) => new Date(now - s * 1000).toISOString();
  assert.deepEqual(seenLabel(null, now), { online: false, text: 'Not used yet' });
  assert.deepEqual(seenLabel(ago(30), now), { online: true, text: 'Online now' });
  assert.equal(seenLabel(ago(600), now).text, 'Last seen 10 min ago');
  assert.equal(seenLabel(ago(3 * 3600), now).text, 'Last seen 3 h ago');
  assert.equal(seenLabel(ago(26 * 3600), now).text, 'Last seen yesterday');
  assert.equal(seenLabel(ago(5 * 86400), now).text, 'Last seen 5 days ago');
});
