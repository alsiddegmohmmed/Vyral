import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DataError, pairDevice } from '@/lib/data/api';
import { cookieOptions, DEVICE_COOKIE } from '@/lib/session';

export async function POST(req: Request) {
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  try {
    const token = await pairDevice(String(code ?? ''));
    (await cookies()).set(DEVICE_COOKIE, token, { ...cookieOptions, maxAge: 60 * 60 * 24 * 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof DataError ? e.message : 'Pairing failed.' }, { status: 400 });
  }
}
