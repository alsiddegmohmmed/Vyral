import { createHmac, timingSafeEqual } from 'node:crypto';

// The QR carries v1.<barcode_token>.<mac> (architecture.md decision 6).
// The MAC lets the scanner reject forged or mistyped codes before any lookup.
const secret = () => process.env.BARCODE_SECRET ?? 'dev-only-barcode-secret-change-me';

const mac = (token: string) => createHmac('sha256', secret()).update(`v1.${token}`).digest('base64url').slice(0, 10);

export const encodeBarcode = (token: string) => `v1.${token}.${mac(token)}`;

/** Returns the token if the code is ours and untampered, else null. */
export function decodeBarcode(code: string): string | null {
  const m = /^v1\.([0-9A-Z]{26})\.([A-Za-z0-9_-]{10})$/.exec(code.trim());
  if (!m) return null;
  const want = Buffer.from(mac(m[1]));
  const got = Buffer.from(m[2]);
  return want.length === got.length && timingSafeEqual(want, got) ? m[1] : null;
}
