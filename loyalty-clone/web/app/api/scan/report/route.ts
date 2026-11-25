import { NextResponse } from 'next/server';
import { createScannerReport, DataError } from '@/lib/data/api';
import { withScanner } from '@/lib/scan-api';
import { buildReport } from '@/lib/scanner-health';

// "Report a problem" from scanner settings: a scrubbed diagnostics bundle, never customer data.
export async function POST(req: Request) {
  return withScanner(async (ctx) => {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    try {
      const id = await createScannerReport(ctx, buildReport(body));
      return NextResponse.json({ ok: true, id });
    } catch (e) {
      if (e instanceof DataError) return NextResponse.json({ ok: false, error: e.message }, { status: 429 });
      throw e;
    }
  });
}
