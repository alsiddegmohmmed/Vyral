// "Add to Apple Wallet": the signed .pkpass for this card (architecture.md, RH GET /c/{serial}/apple).
// MIME type: https://developer.apple.com/documentation/walletpasses/distributing-and-updating-a-pass
import { getPassDataBySerial } from '@/lib/data/wallet';
import { appleConfig, isNotConfigured } from '@/lib/wallet/config';
import { buildPkpass } from '@/lib/wallet/apple/pkpass';
import { notConfigured } from '@/lib/wallet/apple/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ serial: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { serial } = await ctx.params;
  try {
    const config = appleConfig(); // 503 before any data access when Apple isn't set up
    const d = await getPassDataBySerial(serial);
    if (!d || d.status === 'deleted') return Response.json({ error: 'not_found' }, { status: 404 });
    const pkpass = await buildPkpass(d, { config });
    return new Response(new Uint8Array(pkpass), {
      headers: {
        'content-type': 'application/vnd.apple.pkpass',
        'content-disposition': 'attachment; filename="card.pkpass"',
        'cache-control': 'no-store',
        'x-robots-tag': 'noindex',
        'referrer-policy': 'no-referrer',
      },
    });
  } catch (e) {
    if (isNotConfigured(e)) return notConfigured('apple');
    throw e;
  }
}
