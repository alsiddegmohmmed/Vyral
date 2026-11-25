// Shared bits for the Apple web-service routes (app/api/apple/v1/...).
// Endpoints: https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes
// Auth header: "the word ApplePass, followed by a space, followed by the authenticationToken key of the pass"
// (https://developer.apple.com/documentation/walletpasses/register-a-pass-for-update-notifications).
import { applePassTypeId, isNotConfigured } from '../config';

export const notConfigured = (service: 'apple' | 'google' = 'apple') =>
  Response.json({ error: 'not_configured', service }, { status: 503, headers: { 'cache-control': 'no-store' } });

export const empty = (status: number, headers?: HeadersInit) => new Response(null, { status, headers });

/** Token from `Authorization: ApplePass <token>`, or null. */
export function applePassToken(req: Request): string | null {
  const m = /^ApplePass\s+(\S+)\s*$/.exec(req.headers.get('authorization') ?? '');
  return m ? m[1] : null;
}

/**
 * null when the pass type id is ours; otherwise the Response to return:
 * 503 when Apple isn't configured, 404 for a foreign pass type.
 */
export function rejectForeignPassType(passTypeIdentifier: string): Response | null {
  try {
    return passTypeIdentifier === applePassTypeId() ? null : empty(404);
  } catch (e) {
    if (isNotConfigured(e)) return notConfigured('apple');
    throw e;
  }
}
