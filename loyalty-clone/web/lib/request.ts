import 'server-only';
import { headers } from 'next/headers';

/** Client IP for rate limits only (never stored or logged). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'local').trim();
}
export async function userAgent(): Promise<string | undefined> { return (await headers()).get('user-agent') ?? undefined; }
