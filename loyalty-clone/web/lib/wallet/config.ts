// Wallet configuration from env. No Apple or Google account exists yet, so every
// reader throws NotConfiguredError when something is missing; routes turn that
// into a 503 and notify.ts treats it as a skip.
//
// Kept free of `@/` imports so `node --test` can load it directly.

export type WalletService = 'apple' | 'google';

export class NotConfiguredError extends Error {
  readonly code = 'not_configured' as const;
  readonly service: WalletService;
  readonly missing: string[];
  constructor(service: WalletService, missing: string[]) {
    super(`${service} wallet is not configured (missing ${missing.join(', ')})`);
    this.name = 'NotConfiguredError';
    this.service = service;
    this.missing = missing;
  }
}

export const isNotConfigured = (e: unknown): e is NotConfiguredError =>
  e instanceof NotConfiguredError || (typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'not_configured');

/** PEMs in env vars are often stored with literal "\n"; restore real newlines. */
const pem = (v: string) => v.replace(/\\n/g, '\n').trim() + '\n';

function read(service: WalletService, names: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const n of names) {
    const v = process.env[n]?.trim();
    if (v) out[n] = v;
    else missing.push(n);
  }
  if (missing.length) throw new NotConfiguredError(service, missing);
  return out;
}

/** Public origin of the app, without a trailing slash (e.g. https://api.example.com). */
export function publicBaseUrl(service: WalletService): string {
  return read(service, ['PUBLIC_BASE_URL']).PUBLIC_BASE_URL.replace(/\/+$/, '');
}

export type AppleConfig = {
  passTypeIdentifier: string;
  teamIdentifier: string;
  webServiceURL: string;
  certPem: string;
  keyPem: string;
  keyPassphrase?: string;
  wwdrPem: string;
};

export function appleConfig(): AppleConfig {
  const e = read('apple', ['APPLE_PASS_TYPE_ID', 'APPLE_TEAM_ID', 'APPLE_PASS_CERT_PEM', 'APPLE_PASS_KEY_PEM', 'APPLE_WWDR_PEM', 'PUBLIC_BASE_URL']);
  return {
    passTypeIdentifier: e.APPLE_PASS_TYPE_ID,
    teamIdentifier: e.APPLE_TEAM_ID,
    webServiceURL: `${e.PUBLIC_BASE_URL.replace(/\/+$/, '')}/api/apple`,
    certPem: pem(e.APPLE_PASS_CERT_PEM),
    keyPem: pem(e.APPLE_PASS_KEY_PEM),
    // Optional: an unencrypted key has no passphrase.
    keyPassphrase: process.env.APPLE_PASS_KEY_PASSPHRASE || undefined,
    wwdrPem: pem(e.APPLE_WWDR_PEM),
  };
}

/** Only the pass type id, for the web-service routes that must reject foreign pass types. */
export function applePassTypeId(): string {
  return read('apple', ['APPLE_PASS_TYPE_ID']).APPLE_PASS_TYPE_ID;
}

export type GoogleConfig = {
  issuerId: string;
  serviceAccountEmail: string;
  privateKeyPem: string;
  publicBaseUrl: string;
};

export function googleConfig(): GoogleConfig {
  const e = read('google', ['GOOGLE_WALLET_ISSUER_ID', 'GOOGLE_WALLET_SA_EMAIL', 'GOOGLE_WALLET_SA_KEY_PEM', 'PUBLIC_BASE_URL']);
  return {
    issuerId: e.GOOGLE_WALLET_ISSUER_ID,
    serviceAccountEmail: e.GOOGLE_WALLET_SA_EMAIL,
    privateKeyPem: pem(e.GOOGLE_WALLET_SA_KEY_PEM),
    publicBaseUrl: e.PUBLIC_BASE_URL.replace(/\/+$/, ''),
  };
}
