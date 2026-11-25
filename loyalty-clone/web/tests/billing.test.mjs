// node --test tests/*.test.mjs   (Node 23.6+ runs the .ts modules directly)
// No network: fetch is stubbed where provider calls are exercised.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyPaddleSignature, mapPaddleEvent, createPaddleCheckout, cancelPaddleSubscription } from '../lib/billing/paddle.ts';
import {
  verifyFlutterwaveHash, mapFlutterwaveEvent, createFlutterwavePayment, verifyFlutterwaveTransaction,
  flutterwaveExternalId, redactFlutterwavePayload,
} from '../lib/billing/flutterwave.ts';

const ENV_KEYS = ['PADDLE_API_KEY', 'PADDLE_ENV', 'PADDLE_CHECKOUT_URL', 'PADDLE_PRICE_GROWTH_MONTH', 'PADDLE_PRICE_PRO_YEAR', 'FLW_SECRET_KEY'];
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
const realFetch = globalThis.fetch;
afterEach(() => {
  for (const k of ENV_KEYS) { if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; }
  globalThis.fetch = realFetch;
});
const stubFetch = (status, body) => {
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }); };
  return calls;
};

// ------------------------------------------------------------------ Paddle signature

const SECRET = 'pdl_ntfset_test_secret';
const NOW = 1_764_000_000_000;
const sign = (body, ts = Math.floor(NOW / 1000), secret = SECRET) =>
  `ts=${ts};h1=${createHmac('sha256', secret).update(`${ts}:${body}`).digest('hex')}`;
const BODY = JSON.stringify({ event_id: 'evt_1', event_type: 'subscription.created', data: {} });

test('paddle signature: valid', () => assert.equal(verifyPaddleSignature(BODY, sign(BODY), SECRET, NOW), true));
test('paddle signature: tampered body', () => assert.equal(verifyPaddleSignature(BODY.replace('evt_1', 'evt_2'), sign(BODY), SECRET, NOW), false));
test('paddle signature: wrong secret', () => assert.equal(verifyPaddleSignature(BODY, sign(BODY, undefined, 'other'), SECRET, NOW), false));
test('paddle signature: old timestamp', () => {
  const ts = Math.floor(NOW / 1000) - 301;
  assert.equal(verifyPaddleSignature(BODY, sign(BODY, ts), SECRET, NOW), false);
  assert.equal(verifyPaddleSignature(BODY, sign(BODY, ts), SECRET, NOW, 600), true); // tolerance is configurable
});
test('paddle signature: future timestamp beyond tolerance', () =>
  assert.equal(verifyPaddleSignature(BODY, sign(BODY, Math.floor(NOW / 1000) + 3600), SECRET, NOW), false));
test('paddle signature: missing or malformed header', () => {
  assert.equal(verifyPaddleSignature(BODY, null, SECRET, NOW), false);
  assert.equal(verifyPaddleSignature(BODY, '', SECRET, NOW), false);
  assert.equal(verifyPaddleSignature(BODY, 'h1=abc', SECRET, NOW), false);
  assert.equal(verifyPaddleSignature(BODY, sign(BODY), '', NOW), false);
});
test('paddle signature: any h1 matches during secret rotation', () => {
  const ts = Math.floor(NOW / 1000);
  const good = createHmac('sha256', SECRET).update(`${ts}:${BODY}`).digest('hex');
  assert.equal(verifyPaddleSignature(BODY, `ts=${ts};h1=${'0'.repeat(64)};h1=${good}`, SECRET, NOW), true);
});

// ------------------------------------------------------------------ Paddle mapping
// Fixtures follow the example shapes on developer.paddle.com/webhooks/* (abridged).

const sub = (eventType, data = {}, extra = {}) => ({
  event_id: 'evt_01hv8x2acma2gz7he8kg2s0hna',
  event_type: eventType,
  occurred_at: '2026-11-25T10:18:49.621022Z',
  notification_id: 'ntf_01hv8x2af22vrrz7k67g06x1kq',
  data: {
    id: 'sub_01hv8x29kz0t586xy6zn1a62ny',
    status: 'active',
    customer_id: 'ctm_01hv6y1jedq4p1n0yqn5ba3ky4',
    custom_data: { org_id: 'org_1', plan: 'growth', interval: 'month' },
    currency_code: 'USD',
    items: [{ price: { id: 'pri_growth_m', billing_cycle: { interval: 'month', frequency: 1 } }, quantity: 1 }],
    billing_cycle: { interval: 'month', frequency: 1 },
    current_billing_period: { starts_at: '2026-11-25T10:18:47.635628Z', ends_at: '2026-12-25T10:18:47.635628Z' },
    scheduled_change: null,
    canceled_at: null,
    ...data,
  },
  ...extra,
});
const txn = (eventType, data = {}) => ({
  event_id: 'evt_txn_1', event_type: eventType, occurred_at: '2026-11-25T10:20:00Z', notification_id: 'ntf_2',
  data: {
    id: 'txn_01hv8wptq8987qeep44cyrewp9', status: eventType === 'transaction.completed' ? 'completed' : 'ready',
    customer_id: 'ctm_1', subscription_id: 'sub_1', currency_code: 'USD',
    custom_data: { org_id: 'org_1', plan: 'growth', interval: 'month' },
    items: [{ price: { id: 'pri_growth_m' }, quantity: 1 }],
    details: { totals: { subtotal: '1900', tax: '0', total: '1900', grand_total: '1900', currency_code: 'USD' } },
    payments: [{ amount: '1900', status: eventType === 'transaction.completed' ? 'captured' : 'error', error_code: eventType === 'transaction.completed' ? null : 'declined' }],
    ...data,
  },
});

test('paddle map: subscription.created', () => {
  const u = mapPaddleEvent(sub('subscription.created'));
  assert.deepEqual(u, {
    kind: 'subscription', provider: 'paddle', eventId: 'evt_01hv8x2acma2gz7he8kg2s0hna', occurredAt: '2026-11-25T10:18:49.621022Z',
    orgId: 'org_1', providerCustomerId: 'ctm_01hv6y1jedq4p1n0yqn5ba3ky4', providerSubscriptionId: 'sub_01hv8x29kz0t586xy6zn1a62ny',
    plan: 'growth', interval: 'month', status: 'active',
    currentPeriodStart: '2026-11-25T10:18:47.635628Z', currentPeriodEnd: '2026-12-25T10:18:47.635628Z', cancelAtPeriodEnd: false,
  });
});
test('paddle map: subscription.updated with a scheduled cancel', () => {
  const u = mapPaddleEvent(sub('subscription.updated', { scheduled_change: { action: 'cancel', effective_at: '2026-12-25T10:18:47Z', resume_at: null } }));
  assert.equal(u.kind, 'subscription'); assert.equal(u.status, 'active'); assert.equal(u.cancelAtPeriodEnd, true);
});
test('paddle map: subscription.updated falls back to the price-id env map', () => {
  process.env.PADDLE_PRICE_PRO_YEAR = 'pri_pro_y';
  const u = mapPaddleEvent(sub('subscription.updated', {
    custom_data: { org_id: 'org_1' }, items: [{ price: { id: 'pri_pro_y' } }], billing_cycle: { interval: 'year', frequency: 1 },
  }));
  assert.equal(u.plan, 'pro'); assert.equal(u.interval, 'year');
});
test('paddle map: subscription.canceled (period is null)', () => {
  const u = mapPaddleEvent(sub('subscription.canceled', { status: 'canceled', current_billing_period: null, canceled_at: '2026-12-25T10:18:47Z' }));
  assert.equal(u.status, 'cancelled'); assert.equal(u.currentPeriodEnd, '2026-12-25T10:18:47Z'); assert.equal(u.cancelAtPeriodEnd, false);
});
test('paddle map: subscription.past_due', () => {
  const u = mapPaddleEvent(sub('subscription.past_due', { status: 'past_due' }));
  assert.equal(u.kind, 'subscription'); assert.equal(u.status, 'past_due');
});
test('paddle map: transaction.completed is a paid payment in minor units', () => {
  assert.deepEqual(mapPaddleEvent(txn('transaction.completed')), {
    kind: 'payment', provider: 'paddle', eventId: 'evt_txn_1', occurredAt: '2026-11-25T10:20:00Z', orgId: 'org_1',
    providerRef: 'txn_01hv8wptq8987qeep44cyrewp9', amountMinor: 1900, currency: 'USD', status: 'paid',
  });
});
test('paddle map: transaction.payment_failed', () => {
  const u = mapPaddleEvent(txn('transaction.payment_failed'));
  assert.equal(u.kind, 'payment'); assert.equal(u.status, 'failed');
});
test('paddle map: unknown, missing org and paused are ignored', () => {
  assert.equal(mapPaddleEvent(sub('customer.updated')).kind, 'ignored');
  assert.equal(mapPaddleEvent({ nonsense: true }).kind, 'ignored');
  assert.equal(mapPaddleEvent(null).kind, 'ignored');
  const noOrg = mapPaddleEvent(sub('subscription.created', { custom_data: null }));
  assert.equal(noOrg.kind, 'ignored'); assert.equal(noOrg.reason, 'missing_org_id');
  assert.equal(mapPaddleEvent(sub('subscription.updated', { status: 'paused' })).kind, 'ignored');
});

// ------------------------------------------------------------------ Paddle API (stubbed fetch, no keys)

test('paddle checkout: not_configured without a key', async () => {
  delete process.env.PADDLE_API_KEY;
  const r = await createPaddleCheckout({ orgId: 'org_1', orgName: 'Cafe', email: 'a@b.test', plan: 'growth', interval: 'month', currency: 'USD', amountMinor: 1900, returnUrl: 'https://x.test' });
  assert.equal(r.error, 'not_configured');
  assert.equal((await cancelPaddleSubscription('sub_1')).error, 'not_configured');
});
test('paddle checkout: request shape and url (stubbed)', async () => {
  Object.assign(process.env, { PADDLE_API_KEY: 'test_key', PADDLE_ENV: 'sandbox', PADDLE_PRICE_GROWTH_MONTH: 'pri_growth_m' });
  const calls = stubFetch(201, { data: { id: 'txn_1', checkout: { url: 'https://pay.example.test/?_ptxn=txn_1' } } });
  const r = await createPaddleCheckout({ orgId: 'org_1', orgName: 'Cafe', email: 'a@b.test', plan: 'growth', interval: 'month', currency: 'USD', amountMinor: 1900, returnUrl: 'https://x.test' });
  assert.deepEqual(r, { url: 'https://pay.example.test/?_ptxn=txn_1' });
  assert.equal(calls[0].url, 'https://sandbox-api.paddle.com/transactions');
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(body.items, [{ price_id: 'pri_growth_m', quantity: 1 }]);
  assert.deepEqual(body.custom_data, { org_id: 'org_1', plan: 'growth', interval: 'month' });
});
test('paddle cancel: next_billing_period (stubbed)', async () => {
  Object.assign(process.env, { PADDLE_API_KEY: 'test_key', PADDLE_ENV: 'production' });
  const calls = stubFetch(200, { data: { id: 'sub_1' } });
  assert.deepEqual(await cancelPaddleSubscription('sub_1'), { ok: true });
  assert.equal(calls[0].url, 'https://api.paddle.com/subscriptions/sub_1/cancel');
  assert.deepEqual(JSON.parse(calls[0].init.body), { effective_from: 'next_billing_period' });
});

// ------------------------------------------------------------------ Flutterwave

test('flutterwave hash: match, mismatch, missing', () => {
  assert.equal(verifyFlutterwaveHash('my-secret-hash', 'my-secret-hash'), true);
  assert.equal(verifyFlutterwaveHash('my-secret-hasH', 'my-secret-hash'), false);
  assert.equal(verifyFlutterwaveHash('short', 'my-secret-hash'), false);
  assert.equal(verifyFlutterwaveHash(null, 'my-secret-hash'), false);
  assert.equal(verifyFlutterwaveHash('anything', ''), false);
});

// Shape from developer.flutterwave.com/docs/webhooks (charge.completed, abridged).
const flwEvent = (data = {}) => ({
  event: 'charge.completed',
  data: {
    id: 285959875, tx_ref: 'inv_123', flw_ref: 'FLW-MOCK-1', amount: 25000, currency: 'RWF', charged_amount: 25000,
    status: 'successful', payment_type: 'mobilemoneyrw', created_at: '2026-11-25T10:00:00.000Z',
    customer: { id: 1, name: 'Owner', phone_number: '250780000000', email: 'owner@cafe.test' },
    ...data,
  },
  meta_data: { org_id: 'org_9' },
});
const verifiedOk = (o = {}) => ({ ok: true, id: 285959875, status: 'successful', txRef: 'inv_123', amount: 25000, currency: 'RWF', createdAt: '2026-11-25T10:00:00.000Z', meta: { org_id: 'org_9', plan: 'starter', interval: 'month' }, ...o });

test('flutterwave map: verified successful charge is a paid payment from verified data', () => {
  // body lies about the amount; the verified amount wins
  assert.deepEqual(mapFlutterwaveEvent(flwEvent({ amount: 1 }), verifiedOk()), {
    kind: 'payment', provider: 'flutterwave', eventId: '285959875:successful', occurredAt: '2026-11-25T10:00:00.000Z',
    orgId: 'org_9', invoiceId: 'inv_123', providerRef: '285959875', amountMinor: 25000, currency: 'RWF', status: 'paid',
  });
});
test('flutterwave map: body claiming "successful" without verification never yields paid', () => {
  for (const v of [null, undefined, { ok: false, error: 'not_found_or_error 404' }]) {
    const u = mapFlutterwaveEvent(flwEvent({ status: 'successful' }), v);
    assert.equal(u.kind, 'ignored'); assert.notEqual(u.status, 'paid');
  }
  // verify says failed although the body says successful
  assert.equal(mapFlutterwaveEvent(flwEvent({ status: 'successful' }), verifiedOk({ status: 'failed' })).status, 'failed');
  // verify still pending: not final
  assert.equal(mapFlutterwaveEvent(flwEvent(), verifiedOk({ status: 'pending' })).kind, 'ignored');
  // a verify result for another transaction is rejected
  assert.equal(mapFlutterwaveEvent(flwEvent(), verifiedOk({ id: 1 })).reason, 'verify_id_mismatch');
});
test('flutterwave map: other events are ignored', () => {
  assert.equal(mapFlutterwaveEvent({ event: 'transfer.completed', data: { id: 1 } }, verifiedOk()).kind, 'ignored');
});
test('flutterwave: external id and redaction', () => {
  assert.equal(flutterwaveExternalId(flwEvent()), '285959875:successful');
  const r = redactFlutterwavePayload(flwEvent());
  assert.equal(r.data.customer, undefined); assert.equal(r.data.tx_ref, 'inv_123');
});
test('flutterwave api: not_configured without a key', async () => {
  delete process.env.FLW_SECRET_KEY;
  const r = await createFlutterwavePayment({ orgId: 'org_9', orgName: 'Cafe', email: 'o@c.test', plan: 'starter', interval: 'month', currency: 'RWF', amountMinor: 25000, invoiceId: 'inv_123', returnUrl: 'https://x.test' });
  assert.equal(r.error, 'not_configured');
  const v = await verifyFlutterwaveTransaction(1);
  assert.equal(v.ok, false); assert.equal(v.error, 'not_configured');
});
test('flutterwave payment: request shape (stubbed)', async () => {
  process.env.FLW_SECRET_KEY = 'FLWSECK_TEST-x';
  const calls = stubFetch(200, { status: 'success', message: 'Hosted Link', data: { link: 'https://checkout.example.test/abc' } });
  const r = await createFlutterwavePayment({ orgId: 'org_9', orgName: 'Cafe', email: 'o@c.test', plan: 'starter', interval: 'month', currency: 'RWF', amountMinor: 25000, invoiceId: 'inv_123', returnUrl: 'https://x.test/back', phone: '250780000000' });
  assert.deepEqual(r, { url: 'https://checkout.example.test/abc' });
  assert.equal(calls[0].url, 'https://api.flutterwave.com/v3/payments');
  const b = JSON.parse(calls[0].init.body);
  assert.equal(b.tx_ref, 'inv_123'); assert.equal(b.amount, 25000); assert.equal(b.currency, 'RWF');
  assert.equal(b.payment_options, 'mobilemoneyrwanda,card');
  assert.deepEqual(b.meta, { org_id: 'org_9', plan: 'starter', interval: 'month', invoice_id: 'inv_123' });
});
test('flutterwave verify: parses the verify response (stubbed)', async () => {
  process.env.FLW_SECRET_KEY = 'FLWSECK_TEST-x';
  const calls = stubFetch(200, { status: 'success', message: 'Transaction fetched successfully', data: { id: 285959875, tx_ref: 'inv_123', flw_ref: 'F', amount: 25000, currency: 'RWF', status: 'successful', created_at: '2026-11-25T10:00:00.000Z', meta: { org_id: 'org_9' } } });
  const v = await verifyFlutterwaveTransaction(285959875);
  assert.equal(calls[0].url, 'https://api.flutterwave.com/v3/transactions/285959875/verify');
  assert.equal(v.ok, true); assert.equal(v.txRef, 'inv_123'); assert.equal(v.amount, 25000); assert.equal(v.meta.org_id, 'org_9');
  stubFetch(502, {});
  const t = await verifyFlutterwaveTransaction(285959875);
  assert.equal(t.ok, false); assert.equal(t.retryable, true);
});
