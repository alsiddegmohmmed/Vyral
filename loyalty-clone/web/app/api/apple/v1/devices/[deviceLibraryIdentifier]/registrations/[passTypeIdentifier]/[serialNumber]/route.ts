// Register / unregister a device for pass updates.
// POST:   https://developer.apple.com/documentation/walletpasses/register-a-pass-for-update-notifications
//         body PushToken { pushToken }; 201 registered, 200 already registered, 401 not authorized.
// DELETE: https://developer.apple.com/documentation/walletpasses/unregister-a-pass-for-update-notifications
//         200 unregistered, 401 not authorized.
import { z } from 'zod';
import { checkAppleAuth, registerAppleDevice, unregisterAppleDevice } from '@/lib/data/wallet';
import { applePassToken, empty, rejectForeignPassType } from '@/lib/wallet/apple/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ deviceLibraryIdentifier: string; passTypeIdentifier: string; serialNumber: string }> };

const PushToken = z.object({ pushToken: z.string().regex(/^[0-9a-fA-F]{32,200}$/) });

async function authorised(req: Request, serial: string): Promise<boolean> {
  const token = applePassToken(req);
  return !!token && (await checkAppleAuth(serial, token));
}

export async function POST(req: Request, ctx: Ctx) {
  const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = await ctx.params;
  const reject = rejectForeignPassType(passTypeIdentifier);
  if (reject) return reject;
  if (!(await authorised(req, serialNumber))) return empty(401);

  const body = PushToken.safeParse(await req.json().catch(() => null));
  if (!body.success) return empty(400);

  const r = await registerAppleDevice(deviceLibraryIdentifier, body.data.pushToken, serialNumber);
  return empty(r === 'created' ? 201 : 200);
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = await ctx.params;
  const reject = rejectForeignPassType(passTypeIdentifier);
  if (reject) return reject;
  if (!(await authorised(req, serialNumber))) return empty(401);

  await unregisterAppleDevice(deviceLibraryIdentifier, serialNumber);
  return empty(200);
}
