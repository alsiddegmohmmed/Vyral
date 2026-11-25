import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getContextFromDevice, getContextFromSession, type OrgContext } from '@/lib/data/api';

export const SESSION_COOKIE = 'lc_session';
export const DEVICE_COOKIE = 'lc_device';

/** Owner/staff session for the dashboard. Redirects to /login when missing. */
export async function requireOwner(): Promise<OrgContext> {
  const jar = await cookies();
  const ctx = await getContextFromSession(jar.get(SESSION_COOKIE)?.value);
  if (!ctx) redirect('/login');
  return ctx;
}

/** Scanner: a paired device token, or an owner session (owner can scan too). */
export async function scannerContext(): Promise<OrgContext | null> {
  const jar = await cookies();
  return (await getContextFromDevice(jar.get(DEVICE_COOKIE)?.value)) ?? (await getContextFromSession(jar.get(SESSION_COOKIE)?.value));
}

export const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/' };
