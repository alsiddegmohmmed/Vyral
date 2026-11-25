// Test-only database access (pg). pglite-server runs one query at a time per
// connection, so every query here goes through one client and one queue.
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const env = (() => {
  try {
    return Object.fromEntries(readFileSync(path.join(__dirname, '../../.env.local'), 'utf8').split('\n')
      .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
  } catch { return {} as Record<string, string>; }
})();

export const DATABASE_URL = process.env.DATABASE_URL ?? env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:54321/postgres';
const BARCODE_SECRET = process.env.BARCODE_SECRET ?? env.BARCODE_SECRET ?? 'dev-only-barcode-secret-change-me';

let client: pg.Client | null = null;
let chain: Promise<unknown> = Promise.resolve();

async function conn() {
  if (!client) { client = new pg.Client({ connectionString: DATABASE_URL }); await client.connect(); }
  return client;
}

/** Run one query, serialised behind every other query from this process. */
export function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const run = chain.then(async () => (await (await conn()).query(text, params)).rows as T[]);
  chain = run.catch(() => undefined);
  return run;
}
export const one = async <T = Record<string, unknown>>(text: string, params: unknown[] = []) => (await sql<T>(text, params))[0];
export async function closeDb() { await chain; await client?.end(); client = null; }

export const sha = (s: string) => createHash('sha256').update(s).digest('hex');
export const OWNER_EMAIL = 'owner@cafe-neza.test';
export const OWNER_PASSWORD = 'neza-demo-2026'; // from the header of db/seed.mjs (dev only)
export const JOIN_CODE = 'neza1cup';

/** A fresh session row for a user, without going through the login form (no rate limit). */
export async function createSessionToken(email = OWNER_EMAIL) {
  const u = await one<{ id: string; org_id: string }>(
    `select u.id, m.org_id from users u join org_members m on m.user_id = u.id where u.email = $1 limit 1`, [email]);
  if (!u) throw new Error(`no user ${email}`);
  const token = randomBytes(24).toString('base64url');
  await sql('insert into sessions (token_hash, user_id, org_id, user_agent) values ($1,$2,$3,$4)', [sha(token), u.id, u.org_id, 'playwright']);
  return token;
}

/** The QR payload a customer's web card shows (same HMAC as lib/barcode.ts). */
export const qrFor = (barcodeToken: string) =>
  `v1.${barcodeToken}.${createHmac('sha256', BARCODE_SECRET).update(`v1.${barcodeToken}`).digest('base64url').slice(0, 10)}`;

export async function seedOrg() {
  return one<{ id: string }>(`select id from orgs where name = 'Café Neza' and deletion_scheduled_at is null`);
}
export async function coffeeCampaign() {
  return one<{ id: string; org_id: string; status: string }>(`select id, org_id, status from campaigns where short_code = $1`, [JOIN_CODE]);
}
export async function pastryCampaign() {
  return one<{ id: string; status: string }>(`select id, status from campaigns where short_code = 'neza2pas'`);
}

export type CardRow = { id: string; serial: string; manual_code: string; barcode_token: string; current_stamps: number; rewards_available: number; status: string; customer_id: string };
export async function cardBySerial(serial: string) {
  return one<CardRow>('select id, serial, manual_code, barcode_token, current_stamps, rewards_available, status, customer_id from cards where serial = $1', [serial]);
}
export async function cardById(id: string) {
  return one<CardRow>('select id, serial, manual_code, barcode_token, current_stamps, rewards_available, status, customer_id from cards where id = $1', [id]);
}

/** Reset per-key rate limits so repeated joins / logins in one run stay deterministic. */
export async function clearRateLimits() { await sql('delete from rate_limits'); }

/** Make a card freely stampable by the scanner (no cooldown/day cap), so tests don't depend on order. */
export async function relaxScannerLimits(campaignId: string) {
  await sql('update campaigns set stamp_cooldown_minutes = 0, max_stamps_per_day = 0, max_stamps_per_transaction = 5 where id = $1', [campaignId]);
}

/** A unique, valid-looking Rwandan mobile number for this run. */
let phoneSeq = 0;
export function uniquePhone() {
  phoneSeq++;
  const n = (Date.now() % 1_000_000) * 10 + (phoneSeq % 10);
  return `78${String(n).padStart(7, '0').slice(-7)}`; // 9 digits, national format without the 0
}

/** A brand-new card on a campaign via the same SQL the join form uses (fast, no UI). */
export async function newCard(name = 'Test Customer', code = JOIN_CODE) {
  const phone = `+250${uniquePhone()}`;
  const r = await one<{ serial: string }>(`select serial from join_campaign($1,$2,null,$3,null,null,'{}'::jsonb,false,null)`, [code, name, phone]);
  if (!r?.serial) throw new Error('join_campaign made no card');
  return (await cardBySerial(r.serial))!;
}
