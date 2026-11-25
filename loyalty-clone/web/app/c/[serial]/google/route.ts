// "Save to Google Wallet": make sure the class and object exist, then 302 to the skinny-JWT save link
// (architecture.md, RH GET /c/{serial}/google; https://developers.google.com/wallet/generic/web).
import { getPassDataBySerial, setGoogleClassId, setGoogleObjectId } from '@/lib/data/wallet';
import { googleConfig, isNotConfigured } from '@/lib/wallet/config';
import { upsertClass, upsertObject, GoogleWalletError } from '@/lib/wallet/google/api';
import { buildSaveUrl } from '@/lib/wallet/google/jwt';
import { buildLoyaltyClass, buildLoyaltyObject, classIdFor } from '@/lib/wallet/google/objects';
import { notConfigured } from '@/lib/wallet/apple/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ serial: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { serial } = await ctx.params;
  try {
    const cfg = googleConfig();
    const d = await getPassDataBySerial(serial);
    if (!d || d.status === 'deleted') return Response.json({ error: 'not_found' }, { status: 404 });

    // The class is normally created at activation; create it here only if that never happened.
    let classId = d.campaign.googleClassId;
    if (!classId) {
      const cls = buildLoyaltyClass(d.campaign, cfg.issuerId, { publicBaseUrl: cfg.publicBaseUrl });
      await upsertClass(cls);
      classId = cls.id;
      await setGoogleClassId(d.campaign.id, classId);
    } else if (classId !== classIdFor(cfg.issuerId, d.campaign.id)) {
      // A stored id from another issuer would make every object insert fail.
      return Response.json({ error: 'class_id_mismatch' }, { status: 500 });
    }

    const obj = buildLoyaltyObject(d, cfg.issuerId, classId);
    await upsertObject(obj);
    await setGoogleObjectId(d.cardId, obj.id);

    const url = buildSaveUrl({
      serviceAccountEmail: cfg.serviceAccountEmail,
      privateKeyPem: cfg.privateKeyPem,
      origins: [new URL(cfg.publicBaseUrl).origin],
      objectId: obj.id,
      classId,
    });
    return new Response(null, { status: 302, headers: { location: url, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });
  } catch (e) {
    if (isNotConfigured(e)) return notConfigured('google');
    if (e instanceof GoogleWalletError) {
      console.error(`[google-wallet] ${e.message}`);
      return Response.json({ error: 'google_unavailable' }, { status: 502 });
    }
    throw e;
  }
}
