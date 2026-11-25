// Paddle Billing webhooks. Signature: https://developer.paddle.com/webhooks/signature-verification
// Logs carry only provider, event id, event type and an error code: no personal data.
import { NextResponse } from 'next/server';
import { applyBillingUpdate, markWebhook, recordWebhook } from '@/lib/data/billing';
import { mapPaddleEvent, verifyPaddleSignature } from '@/lib/billing/paddle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'not_configured', message: 'PADDLE_WEBHOOK_SECRET is not set' }, { status: 503 });
  }
  const raw = await req.text(); // exact bytes: the signature covers the raw body
  if (!verifyPaddleSignature(raw, req.headers.get('paddle-signature'), secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let event: { event_id?: unknown; event_type?: unknown };
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const eventId = typeof event.event_id === 'string' ? event.event_id : null;
  const type = typeof event.event_type === 'string' ? event.event_type : 'unknown';
  if (!eventId) return NextResponse.json({ error: 'missing_event_id' }, { status: 400 });

  // A failure here (database down) returns 500 so Paddle retries.
  const fresh = await recordWebhook('paddle', eventId, type, event);
  if (!fresh) return NextResponse.json({ ok: true, duplicate: true });

  try {
    await applyBillingUpdate(mapPaddleEvent(event));
    await markWebhook('paddle', eventId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = err instanceof Error ? err.name : 'error';
    const detail = err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500); // stored, not logged
    console.error('[webhook] paddle apply failed', { eventId, type, code });
    await markWebhook('paddle', eventId, detail).catch(() => {});
    return NextResponse.json({ ok: false, handled: true }); // 200: stored as failed, no endless retries
  }
}
