// Serial numbers of this device's passes that changed since a tag.
// https://developer.apple.com/documentation/walletpasses/get-the-list-of-updatable-passes
// GET ...?passesUpdatedSince={previousLastUpdated} → 200 SerialNumbers { serialNumbers, lastUpdated } or 204.
// No Authorization header on this call: the device library id is the shared secret
// (https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes, "Server Configuration").
import { appleSerialsSince } from '@/lib/data/wallet';
import { empty, rejectForeignPassType } from '@/lib/wallet/apple/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ deviceLibraryIdentifier: string; passTypeIdentifier: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { deviceLibraryIdentifier, passTypeIdentifier } = await ctx.params;
  const reject = rejectForeignPassType(passTypeIdentifier);
  if (reject) return reject;

  // The tag we hand out is the request time in epoch ms (architecture.md); read it before the query
  // so a pass modified during the query is caught next time (the data layer also looks back 120 s).
  const requestTime = Date.now();
  const raw = new URL(req.url).searchParams.get('passesUpdatedSince');
  const since = raw && /^\d{1,16}$/.test(raw) ? Number(raw) : null;

  const serialNumbers = await appleSerialsSince(deviceLibraryIdentifier, since);
  if (!serialNumbers.length) return empty(204);
  return Response.json({ serialNumbers, lastUpdated: String(requestTime) }, { headers: { 'cache-control': 'no-store' } });
}
