// The latest version of a pass.
// https://developer.apple.com/documentation/walletpasses/send-an-updated-pass
// GET → 200 application/vnd.apple.pkpass, 401 not authorized. We also answer 304 to If-Modified-Since
// with Last-Modified = cards.pass_modified_at (architecture.md, Apple web service table).
import { checkAppleAuth, getPassDataBySerial } from '@/lib/data/wallet';
import { isNotConfigured } from '@/lib/wallet/config';
import { buildPkpass } from '@/lib/wallet/apple/pkpass';
import { applePassToken, empty, notConfigured, rejectForeignPassType } from '@/lib/wallet/apple/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ passTypeIdentifier: string; serialNumber: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { passTypeIdentifier, serialNumber } = await ctx.params;
  const reject = rejectForeignPassType(passTypeIdentifier);
  if (reject) return reject;

  const token = applePassToken(req);
  if (!token || !(await checkAppleAuth(serialNumber, token))) return empty(401);

  const d = await getPassDataBySerial(serialNumber);
  if (!d) return empty(401);

  // HTTP dates have 1 s resolution, so compare whole seconds.
  const modifiedSec = Math.floor(Date.parse(d.passModifiedAt) / 1000);
  const lastModified = new Date(modifiedSec * 1000).toUTCString();
  const ims = req.headers.get('if-modified-since');
  if (ims) {
    const imsSec = Math.floor(Date.parse(ims) / 1000);
    if (Number.isFinite(imsSec) && modifiedSec <= imsSec) return empty(304, { 'last-modified': lastModified });
  }

  try {
    const pkpass = await buildPkpass(d);
    return new Response(new Uint8Array(pkpass), {
      status: 200,
      headers: {
        'content-type': 'application/vnd.apple.pkpass',
        'last-modified': lastModified,
        'cache-control': 'no-cache',
      },
    });
  } catch (e) {
    if (isNotConfigured(e)) return notConfigured('apple');
    throw e;
  }
}
