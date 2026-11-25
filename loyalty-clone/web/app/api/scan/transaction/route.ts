import { NextResponse } from 'next/server';
import { applyCardTransaction } from '@/lib/data/api';
import { withScanner } from '@/lib/scan-api';

export async function POST(req: Request) {
  return withScanner(async (ctx) => {
    const b = (await req.json().catch(() => ({}))) as { cardId?: string; stamps?: number; redeem?: number; idempotencyKey?: string };
    if (!b.cardId || typeof b.idempotencyKey !== 'string' || b.idempotencyKey.length < 8) return NextResponse.json({ ok: false, error: 'invalid_redeem' }, { status: 400 });
    const r = await applyCardTransaction(ctx, { cardId: b.cardId, stamps: Number(b.stamps) || 0, redeem: Number(b.redeem) || 0, source: 'scanner', idempotencyKey: b.idempotencyKey });
    return NextResponse.json(r, { status: r.ok ? 200 : 422 });
  });
}
