import 'server-only';
import { NextResponse } from 'next/server';
import { scannerContext } from '@/lib/session';
import type { OrgContext } from '@/lib/data/api';

/** Route-handler guard: paired device or signed-in owner, else 401. */
export async function withScanner(fn: (ctx: OrgContext) => Promise<Response>): Promise<Response> {
  const ctx = await scannerContext();
  if (!ctx) return NextResponse.json({ error: 'session_expired' }, { status: 401 });
  return fn(ctx);
}
