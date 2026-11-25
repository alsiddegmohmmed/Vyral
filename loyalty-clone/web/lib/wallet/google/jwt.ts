// RS256 JWTs for Google Wallet: the "save to wallet" link and the service-account OAuth token.
// Node crypto only; no `@/` imports.
import { createSign } from 'node:crypto';
import { googleConfig } from '../config';

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

/** Compact JWS, RS256. https://www.rfc-editor.org/rfc/rfc7515 (format Google's Jwt reference expects). */
export function signServiceAccountJwt(payload: Record<string, unknown>, privateKeyPem: string, kid?: string): string {
  const header = { alg: 'RS256', typ: 'JWT', ...(kid ? { kid } : {}) };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = createSign('RSA-SHA256').update(input).sign(privateKeyPem);
  return `${input}.${b64url(sig)}`;
}

export const SAVE_URL_PREFIX = 'https://pay.google.com/gp/v/save/';
export const MAX_SAVE_URL = 1800;

/**
 * Save link with a "skinny" JWT: the class and object are inserted through the REST API first,
 * so the payload only names them.
 * Claims (iss, aud 'google', typ 'savetowallet', iat, origins, payload.loyaltyObjects):
 * https://developers.google.com/wallet/reference/rest/v1/Jwt
 * Link format and the 1800-char safe JWT length: https://developers.google.com/wallet/generic/web
 */
export function buildSaveUrl(o: { serviceAccountEmail: string; privateKeyPem: string; origins: string[]; objectId: string; classId: string; iat?: number }): string {
  const claims = {
    iss: o.serviceAccountEmail,
    aud: 'google',
    typ: 'savetowallet',
    iat: o.iat ?? Math.floor(Date.now() / 1000),
    origins: o.origins,
    payload: { loyaltyObjects: [{ id: o.objectId, classId: o.classId }] },
  };
  const url = SAVE_URL_PREFIX + signServiceAccountJwt(claims, o.privateKeyPem);
  if (url.length > MAX_SAVE_URL) throw new Error(`Google save URL is ${url.length} chars (max ${MAX_SAVE_URL})`);
  return url;
}

// ---------------------------------------------------------------- OAuth access token

export const TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const WALLET_SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer';

let cached: { token: string; exp: number; email: string } | null = null;

/**
 * Service-account OAuth 2.0 (JWT bearer grant).
 * https://developers.google.com/identity/protocols/oauth2/service-account#httprest
 * Scope (Authorization scopes section): https://developers.google.com/wallet/reference/rest/v1/loyaltyobject/insert
 * Cached in memory until 60 s before expiry.
 */
export async function getAccessToken(fetchImpl: typeof fetch = fetch): Promise<string> {
  const cfg = googleConfig(); // throws NotConfiguredError
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.email === cfg.serviceAccountEmail && cached.exp - 60 > now) return cached.token;

  const assertion = signServiceAccountJwt(
    { iss: cfg.serviceAccountEmail, scope: WALLET_SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 },
    cfg.privateKeyPem,
  );
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error(`Google token request failed: ${res.status}`);
  const j = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) throw new Error('Google token response had no access_token');
  cached = { token: j.access_token, exp: now + (j.expires_in ?? 3600), email: cfg.serviceAccountEmail };
  return j.access_token;
}

/** Test hook. */
export function clearAccessTokenCache() {
  cached = null;
}
