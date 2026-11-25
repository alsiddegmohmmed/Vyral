import { randomBytes, randomUUID } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32, like schema.sql random_token()

export const uuid = () => randomUUID();

/** n random bytes as Crockford base32 (16 bytes -> 26 chars). */
export function randomToken(bytes = 16): string {
  const buf = randomBytes(bytes);
  let bits = 0, acc = 0, out = '';
  for (const b of buf) {
    acc = (acc << 8) | b; bits += 8;
    while (bits >= 5) { bits -= 5; out += ALPHABET[(acc >> bits) & 31]; }
    acc &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(acc << (5 - bits)) & 31];
  return out;
}
