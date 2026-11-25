import { NextResponse } from 'next/server';
import { scanLookup } from '@/lib/data/api';
import { withScanner } from '@/lib/scan-api';

export async function POST(req: Request) {
  return withScanner(async (ctx) => {
    const body = (await req.json().catch(() => ({}))) as { qr?: string; manual?: string };
    return NextResponse.json(await scanLookup(ctx, { qr: body.qr, manual: body.manual }));
  });
}
