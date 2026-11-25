import { NextResponse } from 'next/server';
import { withScanner } from '@/lib/scan-api';
import { APP_VERSION } from '@/lib/version';

// Heartbeat and pairing check: who this phone is (updates last_seen_at), plus the live build.
export async function GET() {
  return withScanner(async (ctx) => NextResponse.json(
    { ok: true, who: ctx.actorLabel, role: ctx.role, deviceId: ctx.deviceId ?? null, version: APP_VERSION },
    { headers: { 'cache-control': 'no-store' } }));
}
