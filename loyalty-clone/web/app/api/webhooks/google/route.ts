// Google Wallet save / delete callbacks (callbackOptions.url on each LoyaltyClass).
// https://developers.google.com/wallet/generic/use-cases/use-callbacks-for-saves-and-deletions
// Verified with ECv2SigningOnly (lib/wallet/google/callback.ts), deduped by nonce in the data layer.
import { recordGoogleCallback } from '@/lib/data/wallet';
import { googleConfig, isNotConfigured } from '@/lib/wallet/config';
import { CallbackVerificationError, getGoogleRootKeys, verifyGoogleCallback } from '@/lib/wallet/google/callback';
import { notConfigured } from '@/lib/wallet/apple/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let issuerId: string;
  try {
    issuerId = googleConfig().issuerId;
  } catch (e) {
    if (isNotConfigured(e)) return notConfigured('google');
    throw e;
  }

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: 'bad_request' }, { status: 400 });

  let msg;
  try {
    msg = verifyGoogleCallback(body, { issuerId, rootKeys: await getGoogleRootKeys() });
  } catch (e) {
    if (e instanceof CallbackVerificationError) return Response.json({ error: 'bad_signature' }, { status: 400 });
    throw e;
  }

  // Only ids, event and nonce are stored; false = nonce already seen, which is still a 200.
  await recordGoogleCallback(msg.nonce, msg.objectId, msg.eventType, msg);
  return Response.json({ ok: true });
}
