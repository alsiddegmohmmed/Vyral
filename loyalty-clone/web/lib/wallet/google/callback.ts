// Verifies Google Wallet save/delete callbacks (ECv2SigningOnly). Node crypto only; no `@/` imports.
//
// Callback contract: https://developers.google.com/wallet/generic/use-cases/use-callbacks-for-saves-and-deletions
//   - keys URL https://pay.google.com/gp/m/issuer/keys, protocol "ECv2SigningOnly",
//     sender id "GooglePayPasses", recipient id = our issuer id;
//   - signed message fields: classId, objectId, expTimeMillis, eventType ('save' | 'del'), nonce.
// That page delegates the cryptography to Tink's PaymentMethodTokenRecipient. The byte-level scheme
// Tink implements is the one Google documents for Google Pay ECv2:
// https://developers.google.com/pay/api/web/guides/resources/payment-data-cryptography
//   - signed string = each component as 4-byte little-endian length + UTF-8 bytes;
//   - intermediate key: sign(sender_id, protocolVersion, signedKey) by a root key;
//   - message: sign(sender_id, recipient_id, protocolVersion, signedMessage) by the intermediate key;
//   - ECDSA P-256 / SHA-256, signatures base64 ASN.1 (DER), keys base64 SubjectPublicKeyInfo;
//   - reject expired root keys, intermediate keys (keyExpiration) and messages (expTimeMillis here).
import { createPublicKey, verify, type KeyObject } from 'node:crypto';
import { z } from 'zod';

export const GOOGLE_ROOT_KEYS_URL = 'https://pay.google.com/gp/m/issuer/keys';
export const SENDER_ID = 'GooglePayPasses';
export const PROTOCOL = 'ECv2SigningOnly';

export type RootKey = { keyValue: string; protocolVersion: string; keyExpiration?: string };

export type GoogleCallbackMessage = {
  classId: string;
  objectId: string;
  eventType: 'save' | 'del';
  nonce: string;
  expTimeMillis: number;
};

export class CallbackVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CallbackVerificationError';
  }
}

const Body = z.object({
  signature: z.string().min(1),
  intermediateSigningKey: z.object({ signedKey: z.string().min(1), signatures: z.array(z.string().min(1)).min(1) }),
  protocolVersion: z.string(),
  signedMessage: z.string().min(1),
});
const SignedKey = z.object({ keyValue: z.string().min(1), keyExpiration: z.union([z.string(), z.number()]) });
const Message = z.object({
  classId: z.string().min(1),
  objectId: z.string().min(1),
  eventType: z.enum(['save', 'del']),
  nonce: z.string().min(1),
  expTimeMillis: z.union([z.string(), z.number()]),
});

/** Concatenation of 4-byte little-endian length + UTF-8 bytes for each component. */
export function lengthValue(...parts: string[]): Buffer {
  return Buffer.concat(
    parts.flatMap((p) => {
      const b = Buffer.from(p, 'utf8');
      const len = Buffer.alloc(4);
      len.writeUInt32LE(b.length);
      return [len, b];
    }),
  );
}

const spki = (b64: string): KeyObject => createPublicKey({ key: Buffer.from(b64, 'base64'), format: 'der', type: 'spki' });

function ecdsaOk(key: KeyObject, data: Buffer, sigB64: string): boolean {
  try {
    return verify('sha256', data, { key, dsaEncoding: 'der' }, Buffer.from(sigB64, 'base64'));
  } catch {
    return false;
  }
}

const notExpired = (exp: string | number | undefined, now: number) => exp === undefined || exp === '' || Number(exp) > now;

/**
 * Returns the verified message, or throws CallbackVerificationError.
 * `rootKeys` come from GOOGLE_ROOT_KEYS_URL (see getGoogleRootKeys).
 */
export function verifyGoogleCallback(body: unknown, o: { issuerId: string; rootKeys: RootKey[]; now?: number }): GoogleCallbackMessage {
  const now = o.now ?? Date.now();
  const p = Body.safeParse(typeof body === 'string' ? safeJson(body) : body);
  if (!p.success) throw new CallbackVerificationError('malformed callback body');
  const b = p.data;
  if (b.protocolVersion !== PROTOCOL) throw new CallbackVerificationError('unsupported protocolVersion');

  // 1. Intermediate signing key, signed by any current root key.
  const roots = o.rootKeys.filter((k) => k.protocolVersion === PROTOCOL && notExpired(k.keyExpiration, now));
  if (!roots.length) throw new CallbackVerificationError('no valid root keys');
  const keyData = lengthValue(SENDER_ID, PROTOCOL, b.intermediateSigningKey.signedKey);
  const rootObjs = roots.flatMap((k) => { try { return [spki(k.keyValue)]; } catch { return []; } });
  const keyOk = b.intermediateSigningKey.signatures.some((s) => rootObjs.some((k) => ecdsaOk(k, keyData, s)));
  if (!keyOk) throw new CallbackVerificationError('intermediate key signature invalid');

  // 2. Intermediate key not expired.
  const sk = SignedKey.safeParse(safeJson(b.intermediateSigningKey.signedKey));
  if (!sk.success) throw new CallbackVerificationError('malformed signedKey');
  if (!notExpired(sk.data.keyExpiration, now) || sk.data.keyExpiration === '') throw new CallbackVerificationError('intermediate key expired');

  // 3. Message signature with the intermediate key; recipient is our issuer id.
  let ik: KeyObject;
  try { ik = spki(sk.data.keyValue); } catch { throw new CallbackVerificationError('bad intermediate key'); }
  const msgData = lengthValue(SENDER_ID, o.issuerId, PROTOCOL, b.signedMessage);
  if (!ecdsaOk(ik, msgData, b.signature)) throw new CallbackVerificationError('message signature invalid');

  // 4. Message content and expiry.
  const m = Message.safeParse(safeJson(b.signedMessage));
  if (!m.success) throw new CallbackVerificationError('malformed signedMessage');
  const exp = Number(m.data.expTimeMillis);
  if (!Number.isFinite(exp) || exp <= now) throw new CallbackVerificationError('message expired');
  return { classId: m.data.classId, objectId: m.data.objectId, eventType: m.data.eventType, nonce: m.data.nonce, expTimeMillis: exp };
}

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return undefined; }
}

// ---------------------------------------------------------------- root keys (cached)

let rootCache: { keys: RootKey[]; until: number } | null = null;

/** Fetches Google's root signing keys, cached per Cache-Control max-age (default 1 h). */
export async function getGoogleRootKeys(fetchImpl: typeof fetch = fetch): Promise<RootKey[]> {
  const now = Date.now();
  if (rootCache && rootCache.until > now) return rootCache.keys;
  const res = await fetchImpl(GOOGLE_ROOT_KEYS_URL);
  if (!res.ok) {
    if (rootCache) return rootCache.keys; // keep serving the last good set
    throw new Error(`Google root keys fetch failed: ${res.status}`);
  }
  const j = (await res.json()) as { keys?: RootKey[] };
  const keys = Array.isArray(j.keys) ? j.keys : [];
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600);
  rootCache = { keys, until: now + Math.max(60, maxAge) * 1000 };
  return keys;
}

export function clearRootKeyCache() {
  rootCache = null;
}
