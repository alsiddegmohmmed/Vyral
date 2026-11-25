import { NextResponse } from 'next/server';
import { APP_VERSION } from '@/lib/version';

// Public and database-free: the scanner's "is there a newer build?" and "can I reach the server?" probe.
export const dynamic = 'force-dynamic';
export function GET() {
  return NextResponse.json({ version: APP_VERSION, serverTime: new Date().toISOString() }, { headers: { 'cache-control': 'no-store' } });
}
