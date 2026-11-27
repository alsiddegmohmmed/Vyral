// Google Wallet REST calls (walletobjects v1) through fetch. No `@/` imports.
//
// loyaltyClass insert:   POST  https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass
//   https://developers.google.com/wallet/reference/rest/v1/loyaltyclass/insert
// loyaltyClass patch:    PATCH .../loyaltyClass/{resourceId}
//   https://developers.google.com/wallet/reference/rest/v1/loyaltyclass/patch
// loyaltyObject insert:  POST  .../loyaltyObject
//   https://developers.google.com/wallet/reference/rest/v1/loyaltyobject/insert
// loyaltyObject patch:   PATCH .../loyaltyObject/{resourceId}
//   https://developers.google.com/wallet/reference/rest/v1/loyaltyobject/patch
// loyaltyObject addMessage: POST .../loyaltyObject/{resourceId}/addMessage  body { message }
//   https://developers.google.com/wallet/reference/rest/v1/loyaltyobject/addmessage
//   Message.messageType TEXT | TEXT_AND_NOTIFY: https://developers.google.com/wallet/reference/rest/v1/Message
// An insert of an existing id answers 409, which is why upserts fall back to PATCH.
import { getAccessToken } from './jwt';
import { pointsPatch, type facePoints, type LoyaltyClass, type LoyaltyObject } from './objects';

export const WALLET_API = 'https://walletobjects.googleapis.com/walletobjects/v1';

export class GoogleWalletError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string, what: string) {
    super(`Google Wallet ${what} failed: ${status}`);
    this.name = 'GoogleWalletError';
    this.status = status;
    this.body = body;
  }
}

type Fetch = typeof fetch;
let fetchImpl: Fetch = (...a) => fetch(...a);
/** Test hook: swap the fetch used for Wallet API calls (and the token request). */
export function setWalletFetch(f: Fetch | null) {
  fetchImpl = f ?? ((...a) => fetch(...a));
}

async function call(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown): Promise<Response> {
  const token = await getAccessToken(fetchImpl); // throws NotConfiguredError
  return fetchImpl(`${WALLET_API}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function expectOk(res: Response, what: string): Promise<unknown> {
  if (res.ok) return res.json().catch(() => ({}));
  throw new GoogleWalletError(res.status, await res.text().catch(() => ''), what);
}

const rid = (id: string) => encodeURIComponent(id);

export async function upsertClass(cls: LoyaltyClass): Promise<'inserted' | 'patched'> {
  const ins = await call('POST', '/loyaltyClass', cls);
  if (ins.status !== 409) return (await expectOk(ins, 'loyaltyClass.insert'), 'inserted');
  await expectOk(await call('PATCH', `/loyaltyClass/${rid(cls.id)}`, cls), 'loyaltyClass.patch');
  return 'patched';
}

export async function upsertObject(obj: LoyaltyObject): Promise<'inserted' | 'patched'> {
  const ins = await call('POST', '/loyaltyObject', obj);
  if (ins.status !== 409) return (await expectOk(ins, 'loyaltyObject.insert'), 'inserted');
  await expectOk(await call('PATCH', `/loyaltyObject/${rid(obj.id)}`, obj), 'loyaltyObject.patch');
  return 'patched';
}

/**
 * PATCH the points (reward headline and stamps, see facePoints). notifyPreference NOTIFY_ON_UPDATE is
 * sent only when notify is true. `extra` carries other fields to patch in the same request (e.g. state).
 * Returns 'not_found' when the object was never created (the customer never opened the save link).
 */
export async function patchObjectPoints(objectId: string, points: ReturnType<typeof facePoints>, notify: boolean, extra: Record<string, unknown> = {}): Promise<'patched' | 'not_found'> {
  const res = await call('PATCH', `/loyaltyObject/${rid(objectId)}`, pointsPatch(points, notify, extra));
  if (res.status === 404) return 'not_found';
  await expectOk(res, 'loyaltyObject.patch');
  return 'patched';
}

/** Object-level message: TEXT_AND_NOTIFY when notify, else TEXT (shown on the card, no notification). */
export async function addObjectMessage(objectId: string, header: string, body: string, notify: boolean, messageId?: string): Promise<'added' | 'not_found'> {
  const message = {
    header,
    body,
    ...(messageId ? { id: messageId } : {}),
    messageType: notify ? 'TEXT_AND_NOTIFY' : 'TEXT',
  };
  const res = await call('POST', `/loyaltyObject/${rid(objectId)}/addMessage`, { message });
  if (res.status === 404) return 'not_found';
  await expectOk(res, 'loyaltyObject.addMessage');
  return 'added';
}
