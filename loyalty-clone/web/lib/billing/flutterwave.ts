// Flutterwave (v3 API) for Rwanda: MTN MoMo, Airtel Money and local cards as
// one-off charges against an invoice we raise for each prepaid period.
// Flutterwave has no auto-debit here, so there are no subscription events.
//
// This file must stay importable by plain Node (node --test runs .ts directly):
// no `@/` imports, only `import type` from other modules, no enums.
//
// Env: FLW_SECRET_KEY (API calls), FLW_SECRET_HASH (webhook verif-hash).
import { timingSafeEqual, createHash } from 'node:crypto';
import type { BillingUpdate, CheckoutRequest, CheckoutResult } from '../integrations/contracts';

const BASE = 'https://api.flutterwave.com/v3';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined);

/** Minor-unit exponent. RWF is stored in whole francs (architecture: Schema). */
const EXPONENT: Record<string, number> = { RWF: 0, USD: 2, EUR: 2, GBP: 2, KES: 2, UGX: 0, TZS: 2, NGN: 2 };
export function toMinor(amount: number, currency: string): number {
  return Math.round(amount * 10 ** (EXPONENT[currency.toUpperCase()] ?? 2));
}
export function fromMinor(amountMinor: number, currency: string): number {
  return amountMinor / 10 ** (EXPONENT[currency.toUpperCase()] ?? 2);
}

// ------------------------------------------------------------------ webhook hash

/**
 * The `verif-hash` header carries the secret hash set in the dashboard, verbatim
 * (no HMAC over the body). Doc: https://developer.flutterwave.com/docs/webhooks
 * Both sides are hashed first so timingSafeEqual gets equal lengths and the
 * comparison doesn't leak the secret's length.
 */
export function verifyFlutterwaveHash(header: string | null, secretHash: string): boolean {
  if (!header || !secretHash) return false;
  const a = createHash('sha256').update(header).digest();
  const b = createHash('sha256').update(secretHash).digest();
  return timingSafeEqual(a, b);
}

// ------------------------------------------------------------------ API calls

type FlwError = { error: 'not_configured' | 'provider_error'; message: string };

function secretKey(): string | FlwError {
  const key = process.env.FLW_SECRET_KEY;
  return key ? key : { error: 'not_configured', message: 'FLW_SECRET_KEY is not set' };
}

/**
 * Create a hosted payment link for one invoice (one prepaid period).
 * tx_ref = our invoice id, so the verified transaction points back at the invoice.
 */
export async function createFlutterwavePayment(
  req: CheckoutRequest & { invoiceId: string; phone?: string },
): Promise<CheckoutResult> {
  const key = secretKey();
  if (typeof key !== 'string') return key;
  if (req.currency !== 'RWF') return { error: 'provider_error', message: 'Flutterwave checkout is RWF only' };
  if (!req.invoiceId) return { error: 'provider_error', message: 'invoiceId is required' };
  const body = {
    tx_ref: req.invoiceId,
    amount: fromMinor(req.amountMinor, req.currency), // RWF: whole francs
    currency: 'RWF',
    redirect_url: req.returnUrl,
    payment_options: 'mobilemoneyrwanda,card',
    customer: { email: req.email, name: req.orgName, ...(req.phone ? { phone_number: req.phone } : {}) },
    customizations: { title: 'Subscription' },
    meta: { org_id: req.orgId, plan: req.plan, interval: req.interval, invoice_id: req.invoiceId },
  };
  try {
    // POST /v3/payments (Standard / hosted checkout): https://developer.flutterwave.com/api/charge/standard
    // Guide: https://developer.flutterwave.com/docs/collections-inflow/flutterwave-standard
    const res = await fetch(`${BASE}/payments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as { status?: string; data?: { link?: string } } | null;
    if (!res.ok || json?.status !== 'success' || !json.data?.link) {
      return { error: 'provider_error', message: `flutterwave ${res.status}` };
    }
    return { url: json.data.link };
  } catch {
    return { error: 'provider_error', message: 'flutterwave request failed' };
  }
}

export type FlutterwaveVerified = {
  ok: true;
  id: number | string;
  status: string;          // successful | failed | pending ...
  txRef: string;
  amount: number;          // major units as Flutterwave reports them
  currency: string;
  createdAt?: string;
  meta: Record<string, unknown>;
};
export type FlutterwaveVerifyResult =
  | FlutterwaveVerified
  | { ok: false; error: string; retryable?: boolean };

/** Re-fetch a transaction from Flutterwave. The only source of truth for money. */
export async function verifyFlutterwaveTransaction(id: string | number): Promise<FlutterwaveVerifyResult> {
  const key = secretKey();
  if (typeof key !== 'string') return { ok: false, error: 'not_configured', retryable: true };
  if (!/^\d+$/.test(String(id))) return { ok: false, error: 'invalid_id' };
  try {
    // GET /v3/transactions/{id}/verify: https://developer.flutterwave.com/docs/transaction-verification
    const res = await fetch(`${BASE}/transactions/${id}/verify`, { headers: { Authorization: `Bearer ${key}` } });
    if (res.status >= 500 || res.status === 429) return { ok: false, error: `flutterwave ${res.status}`, retryable: true };
    const json = (await res.json().catch(() => null)) as { status?: string; data?: Obj | null } | null;
    const d = json?.data;
    if (!res.ok || json?.status !== 'success' || !isObj(d)) return { ok: false, error: `not_found_or_error ${res.status}` };
    const amount = typeof d.amount === 'number' ? d.amount : Number(d.amount);
    const status = str(d.status);
    const txRef = str(d.tx_ref);
    const currency = str(d.currency);
    if (!status || !txRef || !currency || !Number.isFinite(amount)) return { ok: false, error: 'incomplete_verify_response' };
    // meta: returned as `meta` on Standard transactions in practice; the verify doc
    // page does not show it (unverified), so fall back to `meta_data` and {}.
    const meta = isObj(d.meta) ? d.meta : isObj(d.meta_data) ? d.meta_data : {};
    return { ok: true, id: (d.id as number | string) ?? id, status, txRef, amount, currency, createdAt: str(d.created_at), meta };
  } catch {
    return { ok: false, error: 'flutterwave request failed', retryable: true };
  }
}

// ------------------------------------------------------------------ mapping

/** Dedupe key for webhook_events: transaction id + reported status (a pending and a final webhook are distinct). */
export function flutterwaveExternalId(event: unknown): string | null {
  const data = isObj(event) && isObj(event.data) ? event.data : null;
  const id = data && (typeof data.id === 'number' || typeof data.id === 'string') ? String(data.id) : null;
  if (!id) return null;
  return `${id}:${str(data?.status) ?? 'unknown'}`;
}

/** Transaction id to verify, from the (untrusted) webhook body. */
export function flutterwaveTransactionId(event: unknown): string | null {
  const data = isObj(event) && isObj(event.data) ? event.data : null;
  const id = data?.id;
  return typeof id === 'number' || (typeof id === 'string' && /^\d+$/.test(id)) ? String(id) : null;
}

/**
 * Normalise a Flutterwave `charge.completed` webhook.
 * The body is only used to find the transaction id and event name. Amount,
 * currency, status and tx_ref come from `verified` (the verify call). Without a
 * successful verify result this never returns a paid update.
 * Event shape: https://developer.flutterwave.com/docs/webhooks
 */
export function mapFlutterwaveEvent(event: unknown, verified: FlutterwaveVerifyResult | null | undefined): BillingUpdate {
  const e = isObj(event) ? event : {};
  const eventId = flutterwaveExternalId(event) ?? 'unknown';
  const ignored = (reason: string): BillingUpdate => ({ kind: 'ignored', provider: 'flutterwave', eventId, reason });
  const type = str(e.event) ?? str(e['event.type']) ?? '';
  if (type !== 'charge.completed') return ignored(`unhandled_event:${type || 'none'}`);
  if (!verified || !verified.ok) return ignored('unverified');
  if (String(verified.id) !== flutterwaveTransactionId(event)) return ignored('verify_id_mismatch');

  const status = verified.status === 'successful' ? 'paid' : verified.status === 'failed' ? 'failed' : null;
  if (!status) return ignored(`not_final:${verified.status}`);

  // orgId identifies, it doesn't pay: prefer the verified meta, else the body's meta.
  // applyBillingUpdate must still check it against the invoice found by tx_ref.
  const data = isObj(e.data) ? e.data : {};
  const bodyMeta = isObj(e.meta_data) ? e.meta_data : isObj(data.meta) ? data.meta : isObj(e.meta) ? e.meta : {};
  const orgId = str(verified.meta.org_id) ?? str(bodyMeta.org_id);
  if (!orgId) return ignored('missing_org_id');

  return {
    kind: 'payment',
    provider: 'flutterwave',
    eventId: `${verified.id}:${verified.status}`,
    occurredAt: verified.createdAt ?? new Date().toISOString(),
    orgId,
    invoiceId: verified.txRef,
    providerRef: String(verified.id),
    amountMinor: toMinor(verified.amount, verified.currency),
    currency: verified.currency.toUpperCase(),
    status,
  };
}

/** Drop personal data (customer, card) before the payload is stored. */
export function redactFlutterwavePayload(event: unknown): unknown {
  if (!isObj(event)) return event;
  const data = isObj(event.data) ? { ...event.data } : event.data;
  if (isObj(data)) { delete data.customer; delete data.card; }
  return { ...event, data };
}
