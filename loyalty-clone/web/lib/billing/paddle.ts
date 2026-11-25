// Paddle Billing (v1 API, merchant of record) for international card subscriptions.
//
// This file must stay importable by plain Node (node --test runs .ts directly):
// no `@/` imports, only `import type` from other modules, no enums.
// Keys are read from env at call time; nothing here runs without them.
//
// Env: PADDLE_API_KEY, PADDLE_ENV (sandbox | production, default sandbox),
//      PADDLE_WEBHOOK_SECRET (used by the route), PADDLE_CHECKOUT_URL (optional,
//      an approved checkout domain; omitted = the default payment link),
//      PADDLE_PRICE_{STARTER|GROWTH|PRO}_{MONTH|YEAR}.
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { BillingUpdate, CheckoutRequest, CheckoutResult, Interval, Plan } from '../integrations/contracts';

const PLANS: readonly Plan[] = ['starter', 'growth', 'pro'];
const INTERVALS: readonly Interval[] = ['month', 'year'];

// ------------------------------------------------------------------ signature

/**
 * Verify a `Paddle-Signature: ts=...;h1=...` header.
 * Doc: https://developer.paddle.com/webhooks/signature-verification
 * Signed payload is `${ts}:${rawBody}`, HMAC-SHA256 with the destination's secret, hex.
 * During secret rotation Paddle sends more than one h1; any match is accepted.
 * Paddle's SDKs default to a 5 s tolerance; we default to 300 s (clock skew, slow
 * cold starts). Timestamps too far in the future are rejected as well.
 */
export function verifyPaddleSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowMs: number = Date.now(),
  toleranceSec = 300,
): boolean {
  if (!header || !secret) return false;
  let ts: string | undefined;
  const h1s: string[] = [];
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === 'ts') ts = v;
    else if (k === 'h1') h1s.push(v);
  }
  if (!ts || !/^\d+$/.test(ts) || h1s.length === 0) return false;
  const age = Math.floor(nowMs / 1000) - Number(ts);
  if (Math.abs(age) > toleranceSec) return false;

  const expected = createHmac('sha256', secret).update(`${ts}:${rawBody}`).digest();
  let ok = false;
  for (const h of h1s) {
    if (!/^[0-9a-f]{64}$/i.test(h)) continue;
    const got = Buffer.from(h, 'hex');
    // no early exit, so the number of h1 values is the only timing signal
    if (got.length === expected.length && timingSafeEqual(got, expected)) ok = true;
  }
  return ok;
}

// ------------------------------------------------------------------ mapping

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined);

/** Reverse lookup of PADDLE_PRICE_<PLAN>_<INTERVAL> env vars. */
export function planFromPriceId(priceId: string | undefined, env: Obj = process.env): { plan: Plan; interval: Interval } | null {
  if (!priceId) return null;
  for (const plan of PLANS) for (const interval of INTERVALS) {
    if (env[`PADDLE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`] === priceId) return { plan, interval };
  }
  return null;
}

export function priceIdFor(plan: Plan, interval: Interval, env: Obj = process.env): string | undefined {
  return str(env[`PADDLE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`]);
}

function planAndInterval(data: Obj): { plan: Plan; interval: Interval } | null {
  const cd = isObj(data.custom_data) ? data.custom_data : {};
  const items = Array.isArray(data.items) ? data.items : [];
  let fromPrice: { plan: Plan; interval: Interval } | null = null;
  for (const it of items) {
    const price = isObj(it) && isObj(it.price) ? it.price : undefined;
    fromPrice = planFromPriceId(str(price?.id) ?? (isObj(it) ? str(it.price_id) : undefined));
    if (fromPrice) break;
  }
  const cycle = isObj(data.billing_cycle) ? str(data.billing_cycle.interval) : undefined;
  const plan = (PLANS as readonly string[]).includes(cd.plan as string) ? (cd.plan as Plan) : fromPrice?.plan;
  const interval = (INTERVALS as readonly string[]).includes(cd.interval as string)
    ? (cd.interval as Interval)
    : fromPrice?.interval ?? ((INTERVALS as readonly string[]).includes(cycle ?? '') ? (cycle as Interval) : undefined);
  return plan && interval ? { plan, interval } : null;
}

/** Paddle amounts are strings in the currency's lowest denomination. */
function minor(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  if (typeof v === 'string' && /^-?\d+$/.test(v)) return Number(v);
  return undefined;
}

/**
 * Normalise a Paddle Billing notification (envelope: event_id, event_type,
 * occurred_at, notification_id, data). Docs:
 *   https://developer.paddle.com/webhooks/subscriptions/subscription-created
 *   https://developer.paddle.com/webhooks/subscriptions/subscription-activated
 *   https://developer.paddle.com/webhooks/subscriptions/subscription-updated
 *   https://developer.paddle.com/webhooks/subscriptions/subscription-past-due
 *   https://developer.paddle.com/webhooks/subscriptions/subscription-canceled
 *   https://developer.paddle.com/webhooks/transactions/transaction-completed
 *   https://developer.paddle.com/webhooks/transactions/transaction-payment-failed
 * custom_data set on the checkout transaction is copied to the subscription it
 * creates: https://developer.paddle.com/build/transactions/custom-data
 */
export function mapPaddleEvent(event: unknown): BillingUpdate {
  const e = isObj(event) ? event : {};
  const eventId = str(e.event_id) ?? str(e.notification_id) ?? 'unknown';
  const type = str(e.event_type) ?? '';
  const ignored = (reason: string): BillingUpdate => ({ kind: 'ignored', provider: 'paddle', eventId, reason });
  const data = isObj(e.data) ? e.data : null;
  if (!data) return ignored('no_data');
  const occurredAt = str(e.occurred_at) ?? new Date().toISOString();
  const cd = isObj(data.custom_data) ? data.custom_data : {};
  const orgId = str(cd.org_id);

  switch (type) {
    case 'subscription.created':
    case 'subscription.activated':
    case 'subscription.updated':
    case 'subscription.past_due':
    case 'subscription.canceled': {
      if (!orgId) return ignored('missing_org_id');
      const pi = planAndInterval(data);
      if (!pi) return ignored('unknown_plan');
      const raw = str(data.status);
      // Paddle statuses: active | trialing | past_due | paused | canceled
      const status =
        raw === 'active' || raw === 'trialing' ? 'active'
        : raw === 'past_due' ? 'past_due'
        : raw === 'canceled' ? 'cancelled'
        : null;
      if (!status) return ignored(`unsupported_status:${raw ?? 'none'}`);
      // current_billing_period is null for paused and canceled subscriptions.
      const period = isObj(data.current_billing_period) ? data.current_billing_period : null;
      const endedAt = str(data.canceled_at) ?? occurredAt;
      const sc = isObj(data.scheduled_change) ? data.scheduled_change : null;
      return {
        kind: 'subscription',
        provider: 'paddle',
        eventId,
        occurredAt,
        orgId,
        providerCustomerId: str(data.customer_id),
        providerSubscriptionId: str(data.id),
        plan: pi.plan,
        interval: pi.interval,
        status,
        currentPeriodStart: str(period?.starts_at) ?? endedAt,
        currentPeriodEnd: str(period?.ends_at) ?? endedAt,
        cancelAtPeriodEnd: sc?.action === 'cancel',
      };
    }
    case 'transaction.completed':
    case 'transaction.payment_failed': {
      if (!orgId) return ignored('missing_org_id');
      const details = isObj(data.details) ? data.details : {};
      const totals = isObj(details.totals) ? details.totals : {};
      const amountMinor = minor(totals.grand_total) ?? minor(totals.total);
      const currency = str(totals.currency_code) ?? str(data.currency_code);
      const providerRef = str(data.id);
      if (amountMinor === undefined || !currency || !providerRef) return ignored('incomplete_transaction');
      return {
        kind: 'payment',
        provider: 'paddle',
        eventId,
        occurredAt,
        orgId,
        providerRef,
        amountMinor,
        currency,
        status: type === 'transaction.completed' ? 'paid' : 'failed',
      };
    }
    default:
      return ignored(`unhandled_event:${type || 'none'}`);
  }
}

// ------------------------------------------------------------------ API calls

type NotConfigured = { error: 'not_configured'; message: string };

function apiConfig(): { base: string; key: string } | NotConfigured {
  const key = process.env.PADDLE_API_KEY;
  if (!key) return { error: 'not_configured', message: 'PADDLE_API_KEY is not set' };
  const env = process.env.PADDLE_ENV ?? 'sandbox';
  if (env !== 'sandbox' && env !== 'production') return { error: 'not_configured', message: 'PADDLE_ENV must be sandbox or production' };
  // Base URLs: https://developer.paddle.com/api-reference/about/versioning
  return { base: env === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com', key };
}

function headers(key: string): Record<string, string> {
  // Auth: https://developer.paddle.com/api-reference/about/authentication
  // Version header: https://developer.paddle.com/api-reference/about/versioning
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Paddle-Version': '1' };
}

async function paddleError(res: Response): Promise<string> {
  // Paddle error body: { error: { type, code, detail } }. Only the code goes out.
  const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
  return `paddle ${res.status}${body?.error?.code ? ` ${body.error.code}` : ''}`;
}

/**
 * Create a checkout transaction and return its payment link (`?_ptxn=txn_...`),
 * which opens Paddle.js checkout on our default payment link page.
 * Prices come from the Paddle catalogue (price ids in env), not req.amountMinor.
 */
export async function createPaddleCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
  const cfg = apiConfig();
  if ('error' in cfg) return cfg;
  if (req.currency !== 'USD') return { error: 'provider_error', message: 'Paddle checkout is USD only' };
  const priceId = priceIdFor(req.plan, req.interval);
  if (!priceId) {
    return { error: 'not_configured', message: `PADDLE_PRICE_${req.plan.toUpperCase()}_${req.interval.toUpperCase()} is not set` };
  }
  const body: Obj = {
    items: [{ price_id: priceId, quantity: 1 }],
    collection_mode: 'automatic',
    currency_code: 'USD',
    custom_data: { org_id: req.orgId, plan: req.plan, interval: req.interval },
  };
  const checkoutUrl = process.env.PADDLE_CHECKOUT_URL;
  if (checkoutUrl) body.checkout = { url: checkoutUrl };
  try {
    // POST /transactions: https://developer.paddle.com/api-reference/transactions/create-transaction
    const res = await fetch(`${cfg.base}/transactions`, { method: 'POST', headers: headers(cfg.key), body: JSON.stringify(body) });
    if (!res.ok) return { error: 'provider_error', message: await paddleError(res) };
    const json = (await res.json()) as { data?: { checkout?: { url?: string | null } } };
    const url = json.data?.checkout?.url;
    if (!url) return { error: 'provider_error', message: 'paddle returned no checkout url (is a default payment link set?)' };
    return { url };
  } catch {
    return { error: 'provider_error', message: 'paddle request failed' };
  }
}

/** Cancel at the end of the current billing period (Paddle's default). */
export async function cancelPaddleSubscription(
  subscriptionId: string,
): Promise<{ ok: true } | { error: 'not_configured' | 'provider_error'; message: string }> {
  const cfg = apiConfig();
  if ('error' in cfg) return cfg;
  if (!/^sub_[a-z0-9]+$/i.test(subscriptionId)) return { error: 'provider_error', message: 'invalid subscription id' };
  try {
    // POST /subscriptions/{id}/cancel: https://developer.paddle.com/api-reference/subscriptions/cancel-subscription
    const res = await fetch(`${cfg.base}/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      headers: headers(cfg.key),
      body: JSON.stringify({ effective_from: 'next_billing_period' }),
    });
    if (!res.ok) return { error: 'provider_error', message: await paddleError(res) };
    return { ok: true };
  } catch {
    return { error: 'provider_error', message: 'paddle request failed' };
  }
}
