import 'server-only';
import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { DEVICE_COOKIE, scannerContext, SESSION_COOKIE } from '@/lib/session';
import { unpairedReason, type OrgContext } from '@/lib/data/api';

/** Header a scanner sends with the device id it remembers, so a lost cookie can be told apart from a removed phone. */
export const DEVICE_HINT_HEADER = 'x-scanner-device';

/** 401 body for the scanner: says why, so the phone can show the right re-pair screen. */
export async function unauthorized(): Promise<Response> {
  const jar = await cookies();
  const reason = await unpairedReason(jar.get(DEVICE_COOKIE)?.value, jar.get(SESSION_COOKIE)?.value, (await headers()).get(DEVICE_HINT_HEADER));
  return NextResponse.json({ error: 'session_expired', reason }, { status: 401 });
}

/** Route-handler guard: paired device or signed-in owner, else 401 with a reason. */
export async function withScanner(fn: (ctx: OrgContext) => Promise<Response>): Promise<Response> {
  const ctx = await scannerContext();
  if (!ctx) return unauthorized();
  return fn(ctx);
}
