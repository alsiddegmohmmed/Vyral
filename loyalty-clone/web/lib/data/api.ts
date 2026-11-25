// The data API every screen and action calls, on Postgres (db/migrations).
// Same exports and return types as the build-step fake, so screens didn't change.
// Rules: every query is scoped by the caller's orgId; every atomic write is one
// statement or one SQL function (no client-held transactions).
import 'server-only';
import { createHash } from 'node:crypto';
import { after } from 'next/server';
import { one, pgCode, pgMessage, q } from '@/lib/db/client';
import { randomToken } from '@/lib/ids';
import { decodeBarcode, encodeBarcode } from '@/lib/barcode';
import { emails } from '@/lib/email';
import type { TxErrorKey } from './rules';
import { hashPassword, verifyPassword } from './password';
import type { Automation, Campaign, CardEvent, FormField, Location, Message, Org, PublicCard, ScannerDevice, TxResult } from './types';

export type OrgContext = { orgId: string; userId: string | null; deviceId?: string; role: 'owner' | 'staff' | 'device'; actorLabel: string };

export class DataError extends Error {
  constructor(public key: string, message?: string) { super(message ?? key); }
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const firstName = (name: string | null | undefined) => (name ?? '').trim().split(/\s+/)[0] ?? '';

/** Fixed-window rate limit. Throws a friendly DataError when exceeded. */
export async function rateLimit(key: string, max: number, windowSeconds: number) {
  const r = await one<{ rateHit: number }>('select rate_hit($1, $2) as rate_hit', [key, windowSeconds]);
  if ((r?.rateHit ?? 0) > max) throw new DataError('rate_limited', 'Too many tries. Wait a few minutes and try again.');
}

// ---------------------------------------------------------------- auth / session

async function createSession(userId: string, orgId: string, userAgent?: string) {
  const token = randomToken(24);
  await q('insert into sessions (token_hash, user_id, org_id, user_agent) values ($1,$2,$3,$4)', [sha(token), userId, orgId, userAgent?.slice(0, 200) ?? null]);
  return token;
}

async function issueToken(userId: string, kind: 'verify_email' | 'reset_password', ttlMinutes: number) {
  const token = randomToken(24);
  await q(`insert into auth_tokens (token_hash, user_id, kind, expires_at) values ($1,$2,$3, now() + make_interval(mins => $4))`, [sha(token), userId, kind, ttlMinutes]);
  return token;
}

export async function signUp(input: { email: string; password: string; businessName: string; timezone: string; country: string }) {
  const email = input.email.trim().toLowerCase();
  const tz = Intl.supportedValuesOf('timeZone').includes(input.timezone) ? input.timezone : 'Africa/Kigali';
  const country = /^[A-Z]{2}$/.test(input.country) ? input.country : 'RW';
  let row: { userId: string; orgId: string } | undefined;
  try {
    row = await one<{ userId: string; orgId: string }>(
      `with u as (insert into users (email, password_hash) values ($1,$2) returning id),
            o as (insert into orgs (name, timezone, country, default_currency) values ($3,$4,$5,$6) returning id),
            m as (insert into org_members (org_id, user_id, role) select o.id, u.id, 'owner' from o, u returning org_id, user_id)
       select user_id, org_id from m`,
      [email, hashPassword(input.password), input.businessName.trim(), tz, country, country === 'RW' ? 'RWF' : 'USD'],
    );
  } catch (e) {
    if (pgCode(e) === '23505') throw new DataError('email_taken', 'An account with this email already exists. Sign in instead.');
    throw e;
  }
  const token = await issueToken(row!.userId, 'verify_email', 48 * 60);
  await emails.verify(email, token);
  return createSession(row!.userId, row!.orgId);
}

export async function signIn(emailRaw: string, password: string, userAgent?: string) {
  const email = emailRaw.trim().toLowerCase();
  await rateLimit(`login:${email}`, 8, 15 * 60);
  const u = await one<{ id: string; passwordHash: string; orgId: string }>(
    `select u.id, u.password_hash, m.org_id from users u join org_members m on m.user_id = u.id where u.email = $1 order by m.created_at limit 1`, [email]);
  // verify even when the user doesn't exist, so timing doesn't reveal accounts
  const ok = verifyPassword(password, u?.passwordHash ?? 'scrypt$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  if (!u || !ok) throw new DataError('bad_login', 'That email and password don’t match.');
  // signing in within 7 days cancels a scheduled account deletion
  await q('update orgs set deletion_scheduled_at = null where id = $1 and deletion_scheduled_at > now()', [u.orgId]);
  return createSession(u.id, u.orgId, userAgent);
}

export async function getContextFromSession(token: string | undefined): Promise<OrgContext | null> {
  if (!token) return null;
  const s = await one<{ userId: string; orgId: string; role: 'owner' | 'staff'; label: string }>(
    `update sessions s set last_seen_at = now()
       from org_members m, users u
      where s.token_hash = $1 and s.expires_at > now() and m.user_id = s.user_id and m.org_id = s.org_id and u.id = s.user_id
      returning s.user_id, s.org_id, m.role, coalesce(nullif(u.name, ''), u.email::text) as label`, [sha(token)]);
  if (!s) return null;
  return { orgId: s.orgId, userId: s.userId, role: s.role, actorLabel: s.label };
}

export async function endSession(token: string) { await q('delete from sessions where token_hash = $1', [sha(token)]); }

/** Sign out everywhere: every session of this user. */
export async function endAllSessions(ctx: OrgContext) { if (ctx.userId) await q('delete from sessions where user_id = $1', [ctx.userId]); }

export async function verifyEmail(token: string) {
  const r = await one<{ userId: string }>(
    `with t as (update auth_tokens set used_at = now() where token_hash = $1 and kind = 'verify_email' and used_at is null and expires_at > now() returning user_id)
     update users set email_verified_at = now() from t where users.id = t.user_id returning users.id as user_id`, [sha(token)]);
  if (!r) throw new DataError('bad_token', 'This link has expired or was already used.');
}

export async function resendVerification(ctx: OrgContext) {
  const u = await one<{ email: string; verified: string | null }>('select email, email_verified_at as verified from users where id = $1', [ctx.userId]);
  if (!u || u.verified) return;
  await rateLimit(`verify:${ctx.userId}`, 3, 3600);
  await emails.verify(u.email, await issueToken(ctx.userId!, 'verify_email', 48 * 60));
}

/** Always "ok" to the caller, so the form can't reveal who has an account. */
export async function requestPasswordReset(emailRaw: string) {
  const email = emailRaw.trim().toLowerCase();
  await rateLimit(`reset:${email}`, 3, 3600);
  const u = await one<{ id: string }>('select id from users where email = $1', [email]);
  if (u) await emails.reset(email, await issueToken(u.id, 'reset_password', 60));
}

export async function resetPassword(token: string, newPassword: string) {
  if (newPassword.length < 10) throw new DataError('weak', 'Use at least 10 characters.');
  const r = await one<{ userId: string }>(
    `with t as (update auth_tokens set used_at = now() where token_hash = $1 and kind = 'reset_password' and used_at is null and expires_at > now() returning user_id),
          u as (update users set password_hash = $2 from t where users.id = t.user_id returning users.id),
          s as (delete from sessions using u where sessions.user_id = u.id)
     select id as user_id from u`, [sha(token), hashPassword(newPassword)]);
  if (!r) throw new DataError('bad_token', 'This link has expired or was already used. Ask for a new one.');
}

export async function getContextFromDevice(token: string | undefined): Promise<OrgContext | null> {
  if (!token) return null;
  const d = await one<{ id: string; orgId: string; label: string }>(
    `update scanner_devices set last_seen_at = now() where token_hash = $1 and revoked_at is null returning id, org_id, label`, [sha(token)]);
  return d ? { orgId: d.orgId, userId: null, deviceId: d.id, role: 'device', actorLabel: d.label } : null;
}

// ---------------------------------------------------------------- org

export async function getOrg(ctx: OrgContext): Promise<Org & { emailVerified: boolean }> {
  const o = await one<Org & { emailVerified: boolean }>(
    `select o.*, (select u.email_verified_at is not null from users u where u.id = $2) as email_verified from orgs o where o.id = $1`, [ctx.orgId, ctx.userId]);
  if (!o) throw new DataError('org_not_found');
  return { ...o, emailVerified: !!o.emailVerified || ctx.userId === null };
}

export async function updateOrg(ctx: OrgContext, patch: Partial<Pick<Org, 'name' | 'timezone' | 'website' | 'email' | 'phone' | 'addressLine1' | 'city'>>) {
  if (patch.timezone && !Intl.supportedValuesOf('timeZone').includes(patch.timezone)) throw new DataError('invalid_timezone', 'Pick a time zone from the list.');
  await q(`update orgs set name = coalesce($2, name), timezone = coalesce($3, timezone), website = $4, email = $5, phone = $6, address_line1 = $7, city = $8 where id = $1`,
    [ctx.orgId, patch.name ?? null, patch.timezone ?? null, patch.website ?? null, patch.email ?? null, patch.phone ?? null, patch.addressLine1 ?? null, patch.city ?? null]);
}

/** Account deletion: sessions end now; the org and everything in it is purged after 7 days by the cleanup job. */
export async function scheduleAccountDeletion(ctx: OrgContext) {
  await q(`update orgs set deletion_scheduled_at = now() + interval '7 days' where id = $1`, [ctx.orgId]);
  await q('delete from sessions where org_id = $1', [ctx.orgId]);
}

export const PLAN_LIMITS = {
  starter: { designs: 1, locations: 1, devices: 2 },
  growth: { designs: 3, locations: 3, devices: 5 },
  pro: { designs: 10, locations: 10, devices: 20 },
} as const;

// ---------------------------------------------------------------- campaigns

const CAMPAIGN_SELECT = `
  select c.*,
    (select json_build_object('name', r.name, 'details', coalesce(r.details, ''), 'costCents', r.cost_cents) from rewards r where r.campaign_id = c.id and r.position = 1) as reward_json,
    coalesce((select json_agg(json_build_object('key', f.key, 'label', f.label, 'type', f.type, 'required', f.required) order by f.position) from campaign_fields f where f.campaign_id = c.id), '[]') as fields_json,
    coalesce((select json_agg(json_build_object('kind', l.kind, 'label', l.label, 'value', l.value) order by l.position) from campaign_links l where l.campaign_id = c.id), '[]') as links_json,
    coalesce((select json_agg(cl.location_id) from campaign_locations cl where cl.campaign_id = c.id), '[]') as location_ids_json
  from campaigns c`;

type CampaignRow = Record<string, unknown> & {
  rewardJson: Campaign['reward'] | null; fieldsJson: FormField[]; linksJson: Campaign['links']; locationIdsJson: string[];
};

function toCampaign(r: CampaignRow): Campaign {
  return {
    id: r.id as string, orgId: r.orgId as string, name: r.name as string, shortCode: r.shortCode as string, status: r.status as Campaign['status'],
    totalStamps: r.totalStamps as number, programName: r.programName as string, description: (r.description as string) ?? '',
    howToEarn: (r.howToEarn as string) ?? '', terms: (r.terms as string) ?? '', hideTerms: r.hideTerms as boolean,
    stampMessage: r.stampMessage as string, rewardMessage: r.rewardMessage as string,
    newsText: (r.newsText as string) ?? undefined, newsUpdatedAt: (r.newsUpdatedAt as string) ?? undefined,
    reward: { name: r.rewardJson?.name ?? '', details: r.rewardJson?.details ?? '', costCents: r.rewardJson?.costCents ?? undefined },
    design: {
      background: r.backgroundColor as string, foreground: r.foregroundColor as string, label: r.labelColor as string,
      stamp: r.stampColor as string, icon: r.stampIcon as string, logoText: (r.logoText as string) ?? '',
    },
    fields: r.fieldsJson, links: r.linksJson, locationIds: r.locationIdsJson,
    defaultCountry: (r.defaultCountry as string) ?? 'RW', consentEnabled: r.consentEnabled as boolean, consentText: (r.consentText as string) ?? '',
    expiryMode: r.expiryMode as Campaign['expiryMode'], expiryDate: (r.expiryDate as string) ?? undefined, expiryDays: (r.expiryDays as number) ?? undefined,
    stampCooldownMinutes: r.stampCooldownMinutes as number, maxStampsPerTransaction: r.maxStampsPerTransaction as number, maxStampsPerDay: r.maxStampsPerDay as number,
    stampValueCents: (r.stampValueCents as number) ?? undefined, currency: r.currency as string,
    activatedAt: (r.activatedAt as string) ?? undefined, lastPushedAt: (r.lastPushedAt as string) ?? undefined,
    createdAt: r.createdAt as string, updatedAt: r.updatedAt as string,
  };
}

export type CampaignSummary = Campaign & { customers: number; inWallet: number };

export async function listCampaigns(ctx: OrgContext): Promise<CampaignSummary[]> {
  const rows = await q<CampaignRow & { customers: number; inWallet: number }>(
    `select x.*, (select count(*) from cards k where k.campaign_id = x.id and k.status = 'active')::int as customers,
            (select count(*) from cards k where k.campaign_id = x.id and k.status = 'active' and (k.apple_installed or k.google_saved))::int as in_wallet
       from (${CAMPAIGN_SELECT} where c.org_id = $1 and c.status <> 'archived') x order by x.created_at desc`, [ctx.orgId]);
  return rows.map((r) => ({ ...toCampaign(r), customers: r.customers, inWallet: r.inWallet }));
}

export async function getCampaign(ctx: OrgContext, id: string): Promise<Campaign> {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new DataError('campaign_not_found');
  const r = await one<CampaignRow>(`${CAMPAIGN_SELECT} where c.id = $1 and c.org_id = $2`, [id, ctx.orgId]);
  if (!r) throw new DataError('campaign_not_found');
  return toCampaign(r);
}

async function planOf(ctx: OrgContext) {
  const o = await one<{ plan: keyof typeof PLAN_LIMITS; planStatus: string }>('select plan, plan_status from orgs where id = $1', [ctx.orgId]);
  if (!o) throw new DataError('org_not_found');
  return o;
}

export async function createCampaign(ctx: OrgContext, name: string): Promise<Campaign> {
  const o = await planOf(ctx);
  const limit = PLAN_LIMITS[o.plan].designs;
  const clean = name.trim().slice(0, 60) || 'New card';
  let id: string | undefined;
  try {
    // limit check and insert in one statement
    const r = await one<{ id: string }>(
      `with o as (select name, country, default_currency from orgs where id = $1),
            n as (select count(*) as n from campaigns where org_id = $1 and status <> 'archived'),
            c as (insert into campaigns (org_id, name, program_name, logo_text, default_country, currency, consent_text, background_color, foreground_color, label_color, stamp_color)
                  select $1, $2, o.name, o.name, o.country, o.default_currency, 'Send me news and offers from ' || o.name || '. I can stop anytime.', '#24292F', '#FFFFFF', '#C9D1D9', '#FFFFFF'
                    from o, n where n.n < $3 returning id),
            r as (insert into rewards (campaign_id, position, name, stamps_required) select id, 1, 'Free coffee', 10 from c),
            f as (insert into campaign_fields (campaign_id, key, label, type, required, position)
                  select c.id, v.key, v.label, v.type, v.required, v.pos from c,
                    (values ('name','Your name','name',true,0), ('phone','Phone','phone',true,1), ('birthday','Birthday','birthday',false,2)) as v(key,label,type,required,pos))
       select id from c`, [ctx.orgId, clean, limit]);
    id = r?.id;
  } catch (e) {
    if (pgCode(e) === '23505') throw new DataError('name_taken', 'You already have a card with this name.');
    throw e;
  }
  if (!id) throw new DataError('plan_limit', `Your plan includes ${limit} card ${limit === 1 ? 'design' : 'designs'}.`);
  return getCampaign(ctx, id);
}

export type CampaignPatch = Partial<Pick<Campaign,
  'name' | 'totalStamps' | 'programName' | 'description' | 'howToEarn' | 'terms' | 'hideTerms' | 'stampMessage' | 'rewardMessage' |
  'reward' | 'design' | 'links' | 'defaultCountry' | 'consentEnabled' | 'consentText' | 'expiryMode' | 'expiryDate' | 'expiryDays' |
  'stampCooldownMinutes' | 'maxStampsPerTransaction' | 'maxStampsPerDay' | 'stampValueCents'>>;

export async function updateCampaign(ctx: OrgContext, id: string, patch: CampaignPatch) {
  const c = await getCampaign(ctx, id);
  if (c.status !== 'draft') {
    for (const k of ['totalStamps', 'expiryMode', 'expiryDate', 'expiryDays'] as const) {
      if (k in patch && patch[k] !== c[k]) throw new DataError('locked_field', 'This can’t change after the card went live.');
    }
  }
  const n = { ...c, ...patch, design: { ...c.design, ...patch.design }, reward: { ...c.reward, ...patch.reward } };
  if (n.totalStamps < 1 || n.totalStamps > 30) throw new DataError('invalid', 'Choose between 1 and 30 stamps.');
  if (!n.name.trim()) throw new DataError('invalid', 'Give the card a name.');
  for (const col of [n.design.background, n.design.foreground, n.design.label, n.design.stamp]) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(col)) throw new DataError('invalid', 'Use colours like #1F3B2C.');
  }
  try {
    await q(
      `with c as (
         update campaigns set name = $3, program_name = $4, description = $5, how_to_earn = $6, terms = $7, hide_terms = $8,
           stamp_message = $9, reward_message = $10, background_color = $11, foreground_color = $12, label_color = $13, stamp_color = $14,
           stamp_icon = $15, logo_text = $16, default_country = $17, consent_enabled = $18, consent_text = $19,
           expiry_mode = $20, expiry_date = $21, expiry_days = $22, total_stamps = $23,
           stamp_cooldown_minutes = $24, max_stamps_per_transaction = $25, max_stamps_per_day = $26, stamp_value_cents = $27
         where id = $1 and org_id = $2 returning id, total_stamps)
       update rewards set name = $28, details = $29, cost_cents = $30, stamps_required = c.total_stamps from c
        where rewards.campaign_id = c.id and rewards.position = 1`,
      [id, ctx.orgId, n.name.trim(), n.programName, n.description, n.howToEarn, n.terms, n.hideTerms, n.stampMessage, n.rewardMessage,
        n.design.background, n.design.foreground, n.design.label, n.design.stamp, n.design.icon, n.design.logoText, n.defaultCountry,
        n.consentEnabled, n.consentText, n.expiryMode, n.expiryDate ?? null, n.expiryDays ?? null, n.totalStamps,
        n.stampCooldownMinutes, n.maxStampsPerTransaction, n.maxStampsPerDay, n.stampValueCents ?? null,
        n.reward.name, n.reward.details, n.reward.costCents ?? null]);
    if (patch.links) await q('select replace_campaign_links($1, $2)', [id, JSON.stringify(patch.links)]);
  } catch (e) {
    if (pgCode(e) === '23505') throw new DataError('name_taken', 'You already have a card with this name.');
    if (pgCode(e) === '23514') throw new DataError('invalid', 'One of the values isn’t allowed. Check lengths and dates.');
    throw e;
  }
  return getCampaign(ctx, id);
}

export async function setFormFields(ctx: OrgContext, id: string, fields: FormField[]) {
  await getCampaign(ctx, id);
  if (!fields.some((f) => (f.type === 'email' || f.type === 'phone') && f.required)) {
    throw new DataError('contact_required', 'Keep email or phone as a required field so customers can get their card back.');
  }
  try { await q('select replace_campaign_fields($1, $2)', [id, JSON.stringify(fields)]); } catch (e) {
    if (pgCode(e) === '23505' || pgCode(e) === '23514') throw new DataError('invalid', 'Each field needs a label, and email, phone and birthday can appear once.');
    throw e;
  }
}

export async function activateCampaign(ctx: OrgContext, id: string) {
  const o = await planOf(ctx);
  if (o.planStatus === 'locked') throw new DataError('locked', 'Your account is locked. Choose a plan to activate cards.');
  const c = await getCampaign(ctx, id);
  if (!c.reward.name.trim()) throw new DataError('invalid', 'Name the reward before going live.');
  await q(`update campaigns set status = 'live', activated_at = coalesce(activated_at, now()) where id = $1 and org_id = $2 and status = 'draft'`, [id, ctx.orgId]);
}

export async function setCampaignStatus(ctx: OrgContext, id: string, status: 'live' | 'paused' | 'archived') {
  const r = await one(`update campaigns set status = $3 where id = $1 and org_id = $2 and (activated_at is not null or $3 = 'archived') returning id`, [id, ctx.orgId, status]);
  if (!r) throw new DataError('not_activated', 'Activate the card first.');
}

export async function pushCampaignUpdate(ctx: OrgContext, id: string) {
  const r = await one<{ n: number }>(
    `with c as (update campaigns set last_pushed_at = now() where id = $1 and org_id = $2 and (last_pushed_at is null or last_pushed_at < now() - interval '10 minutes') returning id),
          k as (update cards set pass_modified_at = clock_timestamp() from c where cards.campaign_id = c.id and cards.status = 'active' returning cards.id)
     select (select count(*) from c)::int as c, (select count(*) from k)::int as n`, [id, ctx.orgId]);
  if (!r || (r as unknown as { c: number }).c === 0) throw new DataError('cooldown', 'You can update all cards once every 10 minutes.');
  queueWalletPushForCampaign(id);
  return r.n;
}

export async function setCampaignLocations(ctx: OrgContext, id: string, locationIds: string[]) {
  await getCampaign(ctx, id);
  if (locationIds.length > 10) throw new DataError('too_many', 'A card can show at most 10 locations.');
  try { await q('select replace_campaign_locations($1, $2, $3::uuid[])', [ctx.orgId, id, locationIds]); } catch (e) {
    if (pgMessage(e).includes('at most 10')) throw new DataError('too_many', 'A card can show at most 10 locations.');
    throw e;
  }
}

// ---------------------------------------------------------------- public: join + card

export type PublicCampaign = Pick<Campaign, 'name' | 'programName' | 'description' | 'howToEarn' | 'terms' | 'hideTerms' | 'reward' | 'design' | 'fields' | 'defaultCountry' | 'consentEnabled' | 'consentText' | 'totalStamps' | 'status'> & { business: string; shortCode: string };

export async function getPublicCampaign(shortCode: string): Promise<PublicCampaign | null> {
  if (!/^[0-9a-z]{4,16}$/.test(shortCode)) return null;
  const r = await one<CampaignRow & { business: string }>(`select x.*, o.name as business from (${CAMPAIGN_SELECT} where c.short_code = $1 and c.status in ('live','paused')) x join orgs o on o.id = x.org_id`, [shortCode]);
  if (!r) return null;
  const c = toCampaign(r);
  const { name, programName, description, howToEarn, terms, hideTerms, reward, design, fields, defaultCountry, consentEnabled, consentText, totalStamps, status } = c;
  return { name, programName, description, howToEarn, terms, hideTerms, reward: { name: reward.name, details: reward.details }, design, fields, defaultCountry, consentEnabled, consentText, totalStamps, status, business: r.business, shortCode };
}

export type JoinInput = { values: Record<string, string>; consent: boolean; ip?: string };
export type JoinResult = { status: 'created'; serial: string } | { status: 'sent' };

export async function joinCampaign(shortCode: string, input: JoinInput): Promise<JoinResult> {
  if (input.ip) await rateLimit(`join:${input.ip}`, 30, 60);
  const v = input.values;
  const email = v.email?.trim().toLowerCase() || null;
  const phone = v.phone?.replace(/[^\d+]/g, '') || null;
  const [bm, bd] = (v.birthday ?? '').split('-').map(Number);
  const extra = Object.fromEntries(Object.entries(v).filter(([k]) => !['name', 'email', 'phone', 'birthday'].includes(k)));
  const camp = await one<{ consentText: string; orgId: string; business: string }>(
    'select c.consent_text, c.org_id, o.name as business from campaigns c join orgs o on o.id = c.org_id where c.short_code = $1', [shortCode]);
  let r: { status: 'created' | 'sent'; serial: string | null } | undefined;
  try {
    r = await one('select status, serial from join_campaign($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [shortCode, (v.name ?? '').trim(), email, phone, bm || null, bd || null, JSON.stringify(extra), input.consent, camp?.consentText ?? null]);
  } catch (e) {
    if (pgMessage(e) === 'closed') throw new DataError('closed', 'This card isn’t taking new members right now.');
    if (pgCode(e) === '23514') throw new DataError('invalid', 'Check your phone number and email.');
    throw e;
  }
  if (r?.status === 'created') return { status: 'created', serial: r.serial! };
  // existing member: send their own link to the contact on file (email today; SMS later)
  if (email && camp) {
    const k = await one<{ serial: string }>(
      `select k.serial from cards k join customers cu on cu.id = k.customer_id join campaigns c on c.id = k.campaign_id
        where c.short_code = $1 and cu.email = $2 and k.status = 'active' limit 1`, [shortCode, email]);
    if (k) await emails.cardLink(email, camp.business, k.serial, camp.orgId);
  }
  return { status: 'sent' };
}

export async function getPublicCard(serial: string): Promise<PublicCard | null> {
  if (!/^[0-9A-Z]{26}$/.test(serial)) return null;
  const k = await one<Record<string, unknown> & { campaignId: string; customerName: string; business: string; expired: boolean; barcodeToken: string }>(
    `update cards k set web_card_seen_at = case when k.web_card_seen_at is null or k.web_card_seen_at < now() - interval '1 hour' then now() else k.web_card_seen_at end
       from customers cu, orgs o
      where k.serial = $1 and cu.id = k.customer_id and o.id = k.org_id
      returning k.*, cu.name as customer_name, o.name as business, (k.expires_at is not null and k.expires_at <= now()) as expired`, [serial]);
  if (!k) return null;
  const cr = await one<CampaignRow>(`${CAMPAIGN_SELECT} where c.id = $1`, [k.campaignId]);
  const c = toCampaign(cr!);
  const locs = await q<{ name: string; addressOnCard: string }>(
    `select l.name, coalesce(l.address_on_card, l.address, '') as address_on_card from campaign_locations cl join locations l on l.id = cl.location_id where cl.campaign_id = $1 and l.show_on_card`, [c.id]);
  return {
    serial, firstName: firstName(k.customerName), currentStamps: k.currentStamps as number, rewardsAvailable: k.rewardsAvailable as number,
    manualCode: k.manualCode as string, qrPayload: encodeBarcode(k.barcodeToken), noteText: (k.noteText as string) ?? undefined,
    status: k.status as 'active' | 'deleted', expired: k.expired,
    campaign: {
      name: c.name, programName: c.programName, totalStamps: c.totalStamps, reward: c.reward, design: c.design, description: c.description,
      howToEarn: c.howToEarn, terms: c.terms, hideTerms: c.hideTerms, links: c.links, newsText: c.newsText, status: c.status, business: k.business,
    },
    locations: locs,
  };
}

// ---------------------------------------------------------------- scanner

export type ScanLookup =
  | { ok: true; card: { id: string; firstName: string; currentStamps: number; rewardsAvailable: number; totalStampsEarned: number; lastVisitAt: string; campaignName: string; totalStamps: number; rewardName: string; maxStampsPerTransaction: number; design: Campaign['design'] } }
  | { ok: false; error: 'invalid_code' | 'card_not_found' | 'card_replaced' | TxErrorKey };

export async function scanLookup(ctx: OrgContext, code: { qr?: string; manual?: string }): Promise<ScanLookup> {
  let where = '', param = '';
  if (code.qr) {
    const token = decodeBarcode(code.qr);
    if (!token) return { ok: false, error: 'invalid_code' };
    where = 'k.barcode_token = $2'; param = token;
    const replaced = await one(`select 1 from cards where org_id = $1 and previous_barcode_token = $2`, [ctx.orgId, token]);
    if (replaced) return { ok: false, error: 'card_replaced' };
  } else if (code.manual) {
    param = code.manual.trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (param.length !== 8) return { ok: false, error: 'card_not_found' };
    where = 'k.manual_code = $2';
  } else return { ok: false, error: 'card_not_found' };
  const r = await one<Record<string, unknown> & { customerName: string; status: string }>(
    `select k.id, k.status, k.current_stamps, k.rewards_available, k.total_stamps_earned, k.last_visit_at, cu.name as customer_name,
            c.name as campaign_name, c.total_stamps, c.max_stamps_per_transaction, c.background_color, c.foreground_color, c.label_color, c.stamp_color, c.stamp_icon, c.logo_text,
            (select r.name from rewards r where r.campaign_id = c.id and r.position = 1) as reward_name
       from cards k join customers cu on cu.id = k.customer_id join campaigns c on c.id = k.campaign_id
      where k.org_id = $1 and ${where}`, [ctx.orgId, param]);
  if (!r) return { ok: false, error: 'card_not_found' };
  if (r.status !== 'active') return { ok: false, error: 'card_deleted' };
  return {
    ok: true,
    card: {
      id: r.id as string, firstName: firstName(r.customerName), currentStamps: r.currentStamps as number, rewardsAvailable: r.rewardsAvailable as number,
      totalStampsEarned: r.totalStampsEarned as number, lastVisitAt: r.lastVisitAt as string, campaignName: r.campaignName as string,
      totalStamps: r.totalStamps as number, rewardName: (r.rewardName as string) ?? 'reward', maxStampsPerTransaction: r.maxStampsPerTransaction as number,
      design: { background: r.backgroundColor as string, foreground: r.foregroundColor as string, label: r.labelColor as string, stamp: r.stampColor as string, icon: r.stampIcon as string, logoText: (r.logoText as string) ?? '' },
    },
  };
}

const TX_KEYS: TxErrorKey[] = ['empty_transaction', 'invalid_redeem', 'card_deleted', 'card_expired', 'campaign_not_live', 'too_many_stamps', 'cooldown_active', 'daily_limit_reached', 'not_enough_stamps', 'no_reward_available'];

/** Calls apply_card_transaction (schema.sql): locked, idempotent, rule-checked, ledgered. */
export async function applyCardTransaction(
  ctx: OrgContext,
  input: { cardId: string; stamps: number; redeem: number; source: 'scanner' | 'dashboard'; idempotencyKey: string },
): Promise<{ ok: true; result: TxResult } | { ok: false; error: TxErrorKey | 'card_not_found' | 'idempotency_key_reused' }> {
  if (!/^[0-9a-f-]{36}$/.test(input.cardId)) return { ok: false, error: 'card_not_found' };
  try {
    const r = await one<{ r: { card: Record<string, number | string>; earned: number; redeemed: number; replayed: boolean } }>(
      'select apply_card_transaction($1,$2,$3,$4,$5,$6,$7,$8,$9) as r',
      [ctx.orgId, input.cardId, input.stamps, input.redeem, input.source, ctx.userId, ctx.actorLabel, input.idempotencyKey, ctx.deviceId ?? null]);
    const res = r!.r;
    if (!res.replayed) queueWalletPush(input.cardId, res.earned > 0 ? 'reward_earned' : undefined);
    return { ok: true, result: { cardId: input.cardId, earned: res.earned, redeemed: res.redeemed, currentStamps: res.card.current_stamps as number, rewardsAvailable: res.card.rewards_available as number, replayed: res.replayed } };
  } catch (e) {
    const m = pgMessage(e);
    if (m === 'card_not_found' || m === 'idempotency_key_reused') return { ok: false, error: m };
    if ((TX_KEYS as string[]).includes(m)) return { ok: false, error: m as TxErrorKey };
    throw e;
  }
}

/** After the response: push the changed pass to Apple/Google (never blocks the scanner). */
function queueWalletPush(cardId: string, reason?: 'reward_earned') {
  try {
    after(async () => {
      try { const { pushCardUpdate } = await import('@/lib/wallet/notify'); await pushCardUpdate(cardId, { reason }); } catch (e) { console.error('wallet push failed', (e as Error).message); }
    });
  } catch { /* outside a request (scripts/tests): skip */ }
}
function queueWalletPushForCampaign(campaignId: string) {
  try {
    after(async () => {
      const ids = await q<{ id: string }>(`select id from cards where campaign_id = $1 and status = 'active' and (apple_installed or google_saved)`, [campaignId]);
      const { pushCardUpdate } = await import('@/lib/wallet/notify');
      for (const { id } of ids) { try { await pushCardUpdate(id, {}); } catch { /* logged by notify */ } }
    });
  } catch { /* outside a request */ }
}

export async function recentScans(ctx: OrgContext, limit = 30) {
  return q<CardEvent & { firstName: string }>(
    `select e.id, e.type, e.quantity, e.created_at, e.actor_label, split_part(coalesce(cu.name, ''), ' ', 1) as first_name
       from card_events e join cards k on k.id = e.card_id join customers cu on cu.id = k.customer_id
      where e.org_id = $1 and e.type in ('stamped','unstamped','reward_redeemed') and ($2::uuid is null or e.scanner_device_id = $2)
      order by e.created_at desc limit $3`, [ctx.orgId, ctx.role === 'device' ? ctx.deviceId : null, limit]);
}

// ---------------------------------------------------------------- customers

export type CardRow = {
  cardId: string; name: string; email?: string; phone?: string; currentStamps: number; rewardsAvailable: number;
  totalStampsEarned: number; wallet: 'apple' | 'google' | 'web'; lastVisitAt: string; createdAt: string; status: 'active' | 'deleted';
};
export type CardSort = 'last_visit' | 'stamps' | 'name' | 'joined';
const SORT_SQL: Record<CardSort, string> = {
  last_visit: 'k.last_visit_at desc', stamps: 'k.current_stamps desc, k.rewards_available desc', name: 'cu.name asc nulls last', joined: 'k.created_at desc',
};

export async function listCards(ctx: OrgContext, campaignId: string, opts: { q?: string; sort?: CardSort; limit?: number; offset?: number } = {}) {
  await getCampaign(ctx, campaignId);
  const term = opts.q?.trim() ? `%${opts.q.trim().replace(/[%_\\]/g, (m) => `\\${m}`)}%` : null;
  const rows = await q<CardRow & { total: number; wallet: string }>(
    `select k.id as card_id, coalesce(cu.name, '') as name, cu.email::text as email, cu.phone_e164 as phone, k.current_stamps, k.rewards_available,
            k.total_stamps_earned, case when k.apple_installed then 'apple' when k.google_saved then 'google' else 'web' end as wallet,
            k.last_visit_at, k.created_at, k.status, count(*) over () ::int as total
       from cards k join customers cu on cu.id = k.customer_id
      where k.org_id = $1 and k.campaign_id = $2 and k.status = 'active'
        and ($3::text is null or (coalesce(cu.name,'') || ' ' || coalesce(cu.email::text,'') || ' ' || coalesce(cu.phone_e164,'')) ilike $3)
      order by ${SORT_SQL[opts.sort ?? 'last_visit'] ?? SORT_SQL.last_visit}
      limit $4 offset $5`, [ctx.orgId, campaignId, term, opts.limit ?? 25, opts.offset ?? 0]);
  return { rows: rows.map(({ total: _t, ...r }) => ({ ...r, email: r.email ?? undefined, phone: r.phone ?? undefined })), total: rows[0]?.total ?? 0 };
}

export async function getCardDetail(ctx: OrgContext, cardId: string) {
  if (!/^[0-9a-f-]{36}$/.test(cardId)) throw new DataError('card_not_found');
  const card = await one<Record<string, unknown> & { campaignId: string; customerId: string }>('select * from cards where id = $1 and org_id = $2', [cardId, ctx.orgId]);
  if (!card) throw new DataError('card_not_found');
  const [customer, campaign, events] = await Promise.all([
    one<Record<string, unknown>>('select *, email::text as email from customers where id = $1', [card.customerId]),
    getCampaign(ctx, card.campaignId),
    q<CardEvent>('select * from card_events where card_id = $1 and org_id = $2 order by created_at desc limit 50', [cardId, ctx.orgId]),
  ]);
  return {
    card: card as unknown as import('./types').Card,
    customer: { ...customer, name: (customer?.name as string) ?? '', email: (customer?.email as string) ?? undefined, phoneE164: (customer?.phoneE164 as string) ?? undefined } as unknown as import('./types').Customer,
    campaign, events,
  };
}

export async function updateCustomer(ctx: OrgContext, cardId: string, patch: { name?: string; email?: string; phone?: string }) {
  const email = patch.email?.trim().toLowerCase() || null;
  const phone = patch.phone?.replace(/[^\d+]/g, '') || null;
  if (!email && !phone) throw new DataError('contact_required', 'Keep an email or a phone number.');
  if (phone && !/^\+[1-9]\d{6,14}$/.test(phone)) throw new DataError('invalid_phone', 'Use the full number with country code, like +250788123456.');
  try {
    const r = await one(
      `with k as (select id, customer_id, campaign_id from cards where id = $1 and org_id = $2),
            u as (update customers cu set name = coalesce($3, cu.name), email = $4, phone_e164 = $5 from k where cu.id = k.customer_id returning cu.id)
       insert into card_events (org_id, campaign_id, card_id, type, source, actor_user_id, actor_label)
       select $2, k.campaign_id, k.id, 'customer_updated', 'dashboard', $6, $7 from k, u returning id`,
      [cardId, ctx.orgId, patch.name?.trim() ?? null, email, phone, ctx.userId, ctx.actorLabel]);
    if (!r) throw new DataError('card_not_found');
  } catch (e) {
    if (pgCode(e) === '23505') throw new DataError('duplicate', 'Another customer already uses this email or phone.');
    throw e;
  }
}

export async function deleteCard(ctx: OrgContext, cardId: string, farewell?: string) {
  const r = await one(
    `with k as (update cards set status = 'deleted', deleted_at = now(), note_text = $3 where id = $1 and org_id = $2 and status = 'active' returning id, campaign_id, customer_id),
          e as (insert into card_events (org_id, campaign_id, card_id, type, source, actor_user_id, actor_label)
                select $2, k.campaign_id, k.id, 'card_deleted', 'dashboard', $4, $5 from k)
     update customers cu set deleted_at = now() from k
      where cu.id = k.customer_id and not exists (select 1 from cards x where x.customer_id = k.customer_id and x.status = 'active' and x.id <> k.id)
     returning cu.id`,
    [cardId, ctx.orgId, farewell?.trim().slice(0, 300) || null, ctx.userId, ctx.actorLabel]);
  void r;
  queueWalletPush(cardId);
}

export async function createCardForCustomer(ctx: OrgContext, campaignId: string, input: { name: string; phone?: string; email?: string }) {
  const c = await getCampaign(ctx, campaignId);
  if (c.status !== 'live') throw new DataError('closed', 'Activate the card first.');
  const res = await joinCampaign(c.shortCode, { values: { name: input.name, phone: input.phone ?? '', email: input.email ?? '' }, consent: false });
  if (res.status === 'sent') throw new DataError('duplicate', 'This customer already has this card. Search for them in the list.');
  return res.serial;
}

// ---------------------------------------------------------------- insights

export async function getInsights(ctx: OrgContext, campaignId: string, days = 30) {
  const c = await getCampaign(ctx, campaignId);
  const agg = await one<Record<string, number | null>>(
    `with e as (select type, quantity, created_at from card_events where campaign_id = $1 and org_id = $2 and created_at > now() - make_interval(days => $3 * 2))
     select
       coalesce(sum(quantity) filter (where type = 'enrolled' and created_at > now() - make_interval(days => $3)), 0)::int as enrolled,
       coalesce(sum(case type when 'stamped' then quantity when 'unstamped' then -quantity end) filter (where created_at > now() - make_interval(days => $3)), 0)::int as stamps,
       coalesce(sum(quantity) filter (where type = 'reward_earned' and created_at > now() - make_interval(days => $3)), 0)::int as earned,
       coalesce(sum(quantity) filter (where type = 'reward_redeemed' and created_at > now() - make_interval(days => $3)), 0)::int as redeemed,
       coalesce(sum(quantity) filter (where type = 'enrolled' and created_at <= now() - make_interval(days => $3)), 0)::int as p_enrolled,
       coalesce(sum(case type when 'stamped' then quantity when 'unstamped' then -quantity end) filter (where created_at <= now() - make_interval(days => $3)), 0)::int as p_stamps,
       coalesce(sum(quantity) filter (where type = 'reward_redeemed' and created_at <= now() - make_interval(days => $3)), 0)::int as p_redeemed
     from e`, [campaignId, ctx.orgId, days]);
  const daily = await q<{ date: string; stamps: number; enrolled: number }>(
    `select to_char(d, 'YYYY-MM-DD') as date,
            coalesce((select sum(quantity) from card_events e where e.campaign_id = $1 and e.type = 'stamped' and e.created_at >= d and e.created_at < d + interval '1 day'), 0)::int as stamps,
            coalesce((select count(*) from card_events e where e.campaign_id = $1 and e.type = 'enrolled' and e.created_at >= d and e.created_at < d + interval '1 day'), 0)::int as enrolled
       from generate_series(date_trunc('day', now() - make_interval(days => $2 - 1)), date_trunc('day', now()), interval '1 day') d order by d`, [campaignId, days]);
  const st = await one<{ apple: number; google: number; web: number }>(
    `select count(*) filter (where apple_installed)::int as apple, count(*) filter (where google_saved and not apple_installed)::int as google,
            count(*) filter (where not apple_installed and not google_saved)::int as web from cards where campaign_id = $1 and status = 'active'`, [campaignId]);
  const a = agg!;
  const pct = (x: number, y: number) => (y === 0 ? undefined : Math.round(((x - y) / y) * 100));
  const revenue = c.stampValueCents ? (a.stamps as number) * c.stampValueCents : undefined;
  const cost = c.reward.costCents ? (a.redeemed as number) * c.reward.costCents : undefined;
  return {
    enrolled: a.enrolled as number, stamps: a.stamps as number, earned: a.earned as number, redeemed: a.redeemed as number,
    deltas: { enrolled: pct(a.enrolled as number, a.pEnrolled as number), stamps: pct(a.stamps as number, a.pStamps as number), redeemed: pct(a.redeemed as number, a.pRedeemed as number) },
    daily, status: st!, revenue, cost, net: revenue !== undefined && cost !== undefined ? revenue - cost : undefined, currency: c.currency,
  };
}

// ---------------------------------------------------------------- locations

export async function listLocations(ctx: OrgContext) {
  return q<Location & { cards: number }>(
    `select l.*, coalesce(l.address, '') as address, coalesce(l.address_on_card, '') as address_on_card, coalesce(l.relevant_text, '') as relevant_text,
            (select count(*) from campaign_locations cl where cl.location_id = l.id)::int as cards
       from locations l where l.org_id = $1 order by l.created_at`, [ctx.orgId]);
}

export async function upsertLocation(ctx: OrgContext, input: Omit<Location, 'id' | 'orgId'> & { id?: string }) {
  if (!input.name.trim()) throw new DataError('invalid', 'Give the place a name.');
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lon) || Math.abs(input.lat) > 90 || Math.abs(input.lon) > 180) {
    throw new DataError('invalid', 'Enter a valid latitude and longitude, or use “where I am now”.');
  }
  const vals = [input.name.trim().slice(0, 80), input.address || null, input.lat, input.lon, input.addressOnCard || null, input.showOnCard, input.relevantText?.slice(0, 120) || null];
  if (input.id) {
    const r = await one(
      `with l as (update locations set name = $3, address = $4, lat = $5, lon = $6, address_on_card = $7, show_on_card = $8, relevant_text = $9 where id = $1 and org_id = $2 returning id)
       update cards set pass_modified_at = clock_timestamp() from campaign_locations cl, l
        where cl.location_id = l.id and cards.campaign_id = cl.campaign_id and cards.status = 'active' returning l.id`, [input.id, ctx.orgId, ...vals]);
    void r;
  } else {
    const o = await planOf(ctx);
    const r = await one(
      `insert into locations (org_id, name, address, lat, lon, address_on_card, show_on_card, relevant_text)
       select $1,$2,$3,$4,$5,$6,$7,$8 where (select count(*) from locations where org_id = $1) < $9 returning id`, [ctx.orgId, ...vals, PLAN_LIMITS[o.plan].locations]);
    if (!r) throw new DataError('plan_limit', `Your plan includes ${PLAN_LIMITS[o.plan].locations} locations.`);
  }
}

export async function deleteLocation(ctx: OrgContext, id: string) {
  await q('delete from locations where id = $1 and org_id = $2', [id, ctx.orgId]);
}

// ---------------------------------------------------------------- counter devices

export async function listDevices(ctx: OrgContext): Promise<ScannerDevice[]> {
  return q<ScannerDevice>('select id, org_id, label, location_id, last_seen_at, created_at from scanner_devices where org_id = $1 and revoked_at is null order by created_at', [ctx.orgId]);
}

export async function createPairingCode(ctx: OrgContext, label: string, locationId?: string) {
  if (!label.trim()) throw new DataError('invalid', 'Name the phone, like “Front counter”.');
  const o = await planOf(ctx);
  const code = randomToken(4).slice(0, 6);
  const r = await one<{ expiresAt: string }>(
    `insert into pairing_codes (code, org_id, label, location_id, expires_at)
     select $1, $2, $3, (select id from locations where id = $4 and org_id = $2), now() + interval '10 minutes'
      where (select count(*) from scanner_devices where org_id = $2 and revoked_at is null) < $5 returning expires_at`,
    [code, ctx.orgId, label.trim().slice(0, 40), locationId ?? null, PLAN_LIMITS[o.plan].devices]);
  if (!r) throw new DataError('plan_limit', `Your plan includes ${PLAN_LIMITS[o.plan].devices} counter phones.`);
  return { code, expiresAt: r.expiresAt };
}

/** One use: the code is deleted in the same statement that creates the device. */
export async function pairDevice(codeRaw: string, ip?: string) {
  if (ip) await rateLimit(`pair:${ip}`, 10, 600);
  const token = randomToken(32);
  const r = await one(
    `with p as (delete from pairing_codes where code = $1 and expires_at > now() returning org_id, label, location_id)
     insert into scanner_devices (org_id, label, token_hash, location_id, last_seen_at) select org_id, label, $2, location_id, now() from p returning id`,
    [codeRaw.trim().toUpperCase(), sha(token)]);
  if (!r) throw new DataError('bad_code', 'That code didn’t work. Codes last 10 minutes; ask for a new one.');
  return token;
}

export async function revokeDevice(ctx: OrgContext, id: string) {
  await q('update scanner_devices set revoked_at = now() where id = $1 and org_id = $2', [id, ctx.orgId]);
}

// ---------------------------------------------------------------- messages

export async function broadcastReach(ctx: OrgContext, campaignId: string) {
  const r = await one<{ wallet: number; webCards: number }>(
    `select count(*) filter (where apple_installed or google_saved)::int as wallet,
            count(*) filter (where not apple_installed and not google_saved and web_card_seen_at > now() - interval '90 days')::int as web_cards
       from cards where campaign_id = $1 and org_id = $2 and status = 'active'`, [campaignId, ctx.orgId]);
  return r ?? { wallet: 0, webCards: 0 };
}

/** Records the message, shows it on every pass + web card, and delivers to wallets after the response. */
export async function sendBroadcast(ctx: OrgContext, campaignId: string, body: string): Promise<Message> {
  const text = body.trim();
  if (!text) throw new DataError('invalid', 'Write a message first.');
  if (text.length > 300) throw new DataError('invalid', 'Keep it under 300 characters.');
  const c = await getCampaign(ctx, campaignId);
  if (c.status !== 'live') throw new DataError('closed', 'Activate the card before sending messages.');
  const reach = await broadcastReach(ctx, campaignId);
  const m = await one<Message>(
    `with m as (insert into messages (org_id, campaign_id, kind, body, status, recipients, web_cards, created_by) values ($1,$2,'broadcast',$3,'queued',$4,$5,$6) returning *),
          c as (update campaigns set news_text = $3, news_updated_at = now() where id = $2 and org_id = $1),
          k as (update cards set pass_modified_at = clock_timestamp() where campaign_id = $2 and status = 'active')
     select * from m`, [ctx.orgId, campaignId, text, reach.wallet, reach.webCards, ctx.userId]);
  try { after(() => deliverMessage(m!.id)); } catch { /* outside a request: the cron retry picks it up */ }
  return m!;
}

/** Wallet fan-out for one message (idempotent: message_deliveries is unique per card + channel). */
export async function deliverMessage(messageId: string) {
  const m = await one<{ id: string; campaignId: string; body: string; status: string; business: string }>(
    `update messages set status = 'sending', started_at = coalesce(started_at, now()) where id = $1 and status in ('queued','sending')
     returning id, campaign_id, body, status, (select program_name from campaigns where id = campaign_id) as business`, [messageId]);
  if (!m) return;
  const targets = await q<{ cardId: string; channel: 'apple' | 'google' }>(
    `insert into message_deliveries (message_id, card_id, channel)
     select $1, k.id, case when k.apple_installed then 'apple' else 'google' end from cards k
      where k.campaign_id = $2 and k.status = 'active' and (k.apple_installed or k.google_saved)
     on conflict (message_id, card_id, channel) do nothing returning card_id, channel`, [messageId, m.campaignId]);
  const pending = await q<{ cardId: string }>(`select card_id from message_deliveries where message_id = $1 and status = 'pending'`, [messageId]);
  void targets;
  const { pushCardUpdate } = await import('@/lib/wallet/notify');
  for (const { cardId } of pending) {
    try {
      const r = await pushCardUpdate(cardId, { reason: 'broadcast', messageId, message: { header: m.business, body: m.body } });
      await q(`update message_deliveries set status = $3, sent_at = now(), attempts = attempts + 1 where message_id = $1 and card_id = $2`, [messageId, cardId, r.notified ? 'sent' : 'skipped']);
    } catch (e) {
      await q(`update message_deliveries set status = 'failed', error = $3, attempts = attempts + 1 where message_id = $1 and card_id = $2`, [messageId, cardId, String((e as Error).message).slice(0, 300)]);
    }
  }
  await q(`update messages set status = 'sent', finished_at = now(),
             delivered = (select count(*) from message_deliveries where message_id = $1 and status = 'sent'),
             skipped = (select count(*) from message_deliveries where message_id = $1 and status = 'skipped'),
             failed = (select count(*) from message_deliveries where message_id = $1 and status = 'failed')
           where id = $1`, [messageId]);
}

export async function listMessages(ctx: OrgContext, campaignId: string) {
  return q<Message>('select * from messages where campaign_id = $1 and org_id = $2 order by created_at desc limit 50', [campaignId, ctx.orgId]);
}

// ---------------------------------------------------------------- automations

export async function getAutomations(ctx: OrgContext, campaignId: string): Promise<Record<'birthday' | 'winback', Automation>> {
  await getCampaign(ctx, campaignId);
  const rows = await q<Automation>('select * from automations where campaign_id = $1 and org_id = $2', [campaignId, ctx.orgId]);
  const pick = (kind: 'birthday' | 'winback'): Automation => rows.find((a) => a.kind === kind) ?? {
    id: '', orgId: ctx.orgId, campaignId, kind, enabled: false, sendHour: 10,
    body: kind === 'birthday' ? 'Happy birthday {name}! Come by for a treat on us.' : 'We miss you, {name}. Come by this week for a double stamp.',
    daysInactive: kind === 'winback' ? 30 : undefined,
  };
  return { birthday: pick('birthday'), winback: pick('winback') };
}

export async function saveAutomation(ctx: OrgContext, campaignId: string, kind: 'birthday' | 'winback', input: { enabled: boolean; body: string; daysInactive?: number; sendHour: number }) {
  const c = await getCampaign(ctx, campaignId);
  const body = input.body.trim();
  if (!body) throw new DataError('invalid', 'Write the message.');
  if (body.length > 300) throw new DataError('invalid', 'Keep it under 300 characters.');
  if (kind === 'winback' && (!input.daysInactive || input.daysInactive < 7 || input.daysInactive > 365)) throw new DataError('invalid', 'Choose between 7 and 365 days.');
  if (input.sendHour < 0 || input.sendHour > 23) throw new DataError('invalid', 'Pick a time.');
  if (kind === 'birthday' && input.enabled && !c.fields.some((f) => f.type === 'birthday')) throw new DataError('no_birthday_field', 'Add a Birthday field to the signup form first.');
  // enabled_at resets on every off->on switch (review M9)
  await q(
    `insert into automations (org_id, campaign_id, kind, enabled, body, days_inactive, send_hour, enabled_at)
     values ($1,$2,$3,$4,$5,$6,$7, case when $4 then now() end)
     on conflict (campaign_id, kind) do update set enabled = excluded.enabled, body = excluded.body, days_inactive = excluded.days_inactive, send_hour = excluded.send_hour,
       enabled_at = case when excluded.enabled and not automations.enabled then now() else automations.enabled_at end`,
    [ctx.orgId, campaignId, kind, input.enabled, body, kind === 'winback' ? input.daysInactive : null, input.sendHour]);
}

export async function automationForecast(ctx: OrgContext, campaignId: string, kind: 'birthday' | 'winback', daysInactive = 30) {
  if (kind === 'birthday') {
    const r = await one<{ n: number }>(
      `select count(*)::int as n from cards k join customers cu on cu.id = k.customer_id join orgs o on o.id = k.org_id,
              generate_series(0, 6) g
        where k.campaign_id = $1 and k.org_id = $2 and k.status = 'active' and (k.apple_installed or k.google_saved)
          and cu.birthday_month = extract(month from (now() at time zone o.timezone)::date + g) and cu.birthday_day = extract(day from (now() at time zone o.timezone)::date + g)`, [campaignId, ctx.orgId]);
    return r?.n ?? 0;
  }
  const r = await one<{ n: number }>(
    `select count(*)::int as n from cards where campaign_id = $1 and org_id = $2 and status = 'active' and (apple_installed or google_saved)
        and last_visit_at > now() - make_interval(days => $3) and last_visit_at <= now() - make_interval(days => $3) + interval '7 days'`, [campaignId, ctx.orgId, daysInactive]);
  return r?.n ?? 0;
}

// ---------------------------------------------------------------- billing

export const PRICES = {
  starter: { RWF: 15000, USD: 12 }, growth: { RWF: 35000, USD: 29 }, pro: { RWF: 60000, USD: 49 },
} as const;

export async function getBilling(ctx: OrgContext) {
  const o = await one<{ plan: keyof typeof PLAN_LIMITS; planStatus: string; trialEndsAt: string; defaultCurrency: string }>(
    'select plan, plan_status, trial_ends_at, default_currency from orgs where id = $1', [ctx.orgId]);
  if (!o) throw new DataError('org_not_found');
  const daysLeft = Math.max(0, Math.ceil((+new Date(o.trialEndsAt) - Date.now()) / 86_400_000));
  return { plan: o.plan, planStatus: o.planStatus as Org['planStatus'], trialEndsAt: o.trialEndsAt, daysLeft, currency: o.defaultCurrency === 'RWF' ? ('RWF' as const) : ('USD' as const), limits: PLAN_LIMITS[o.plan] };
}

/** Dev-only plan switch when no payment provider is configured (refused in production). */
export async function fakeCheckout(ctx: OrgContext, plan: 'starter' | 'growth' | 'pro') {
  if (process.env.NODE_ENV === 'production') throw new DataError('not_configured', 'Payments aren’t set up yet.');
  await q(`update orgs set plan = $2, plan_status = 'active' where id = $1`, [ctx.orgId, plan]);
}
