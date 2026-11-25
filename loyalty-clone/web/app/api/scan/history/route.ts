import { NextResponse } from 'next/server';
import { recentScans } from '@/lib/data/api';
import { withScanner } from '@/lib/scan-api';

export async function GET() {
  return withScanner(async (ctx) => NextResponse.json({ who: ctx.actorLabel, events: await recentScans(ctx, 30) }));
}
