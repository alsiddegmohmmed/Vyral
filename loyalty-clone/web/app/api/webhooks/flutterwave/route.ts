// Flutterwave webhooks. verif-hash: https://developer.flutterwave.com/docs/webhooks
// The body is never trusted for money: we re-fetch the transaction from
// https://developer.flutterwave.com/docs/transaction-verification before mapping.
// Logs carry only provider, external id, event name and an error code: no personal data.
import { NextResponse } from 'next/server';
import { applyBillingUpdate, markWebhook, recordWebhook } from '@/lib/data/billing';
import {
  flutterwaveExternalId,
  flutterwaveTransactionId,
  mapFlutterwaveEvent,
  redactFlutterwavePayload,
  verifyFlutterwaveHash,
  verifyFlutterwaveTransaction,
} from '@/lib/billing/flutterwave';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const secretHash = process.env.FLW_SECRET_HASH;
  if (!secretHash) {
    return NextResponse.json({ error: 'not_configured', message: 'FLW_SECRET_HASH is not set' }, { status: 503 });
  }
  if (!verifyFlutterwaveHash(req.headers.get('verif-hash'), secretHash)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let event: Record<string, unknown>;
  try { event = JSON.parse(await req.text()); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const externalId = flutterwaveExternalId(event);
  const type = typeof event.event === 'string' ? event.event : 'unknown';
  if (!externalId) return NextResponse.json({ error: 'missing_transaction_id' }, { status: 400 });

  // Verify before recording: a transient verify failure returns 503 and nothing is
  // stored, so Flutterwave's retry (3 tries, 30 min apart) gets a clean second attempt.
  let verified = null;
  if (type === 'charge.completed') {
    const txId = flutterwaveTransactionId(event);
    verified = txId ? await verifyFlutterwaveTransaction(txId) : null;
    if (verified && !verified.ok && verified.retryable) {
      console.error('[webhook] flutterwave verify unavailable', { externalId, code: verified.error });
      return NextResponse.json({ error: 'verify_unavailable' }, { status: 503 });
    }
  }

  // A failure here (database down) returns 500 so Flutterwave retries.
  const fresh = await recordWebhook('flutterwave', externalId, type, redactFlutterwavePayload(event));
  if (!fresh) return NextResponse.json({ ok: true, duplicate: true });

  try {
    await applyBillingUpdate(mapFlutterwaveEvent(event, verified));
    await markWebhook('flutterwave', externalId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = err instanceof Error ? err.name : 'error';
    const detail = err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500); // stored, not logged
    console.error('[webhook] flutterwave apply failed', { externalId, type, code });
    await markWebhook('flutterwave', externalId, detail).catch(() => {});
    return NextResponse.json({ ok: false, handled: true }); // 200: stored as failed, no endless retries
  }
}
