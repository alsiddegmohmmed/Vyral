// The data API every screen and action calls. Today it runs on the fake store;
// /replica-backend swaps the bodies for Postgres (schema.sql) with the SAME
// signatures and return types. Every org-owned call takes an OrgContext and is
// scoped by orgId (architecture.md "Access rules").
import { createHash } from 'node:crypto';
import { randomToken, uuid } from '@/lib/ids';
import { decodeBarcode, encodeBarcode } from '@/lib/barcode';
import { db, save } from './store';
import { applyTransaction, isBirthdayToday, type TxErrorKey } from './rules';
import { hashPassword, verifyPassword } from './password';
import type {
  Automation, Campaign, Card, CardEvent, Customer, FormField, Location, Message, Org, PublicCard, ScannerDevice, TxResult,
} from './types';

export type OrgContext = { orgId: string; userId: string | null; deviceId?: string; role: 'owner' | 'staff' | 'device'; actorLabel: string };

export class DataError extends Error {
  constructor(public key: string, message?: string) { super(message ?? key); }
}

const now = () => new Date();
const iso = () => now().toISOString();
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

function org(ctx: OrgContext): Org {
  const o = db().orgs.find((x) => x.id === ctx.orgId);
  if (!o) throw new DataError('org_not_found');
  return o;
}
function campaignOf(ctx: OrgContext, id: string): Campaign {
  const c = db().campaigns.find((x) => x.id === id && x.orgId === ctx.orgId);
  if (!c) throw new DataError('campaign_not_found');
  return c;
}
function cardOf(ctx: OrgContext, id: string): Card {
  const c = db().cards.find((x) => x.id === id && x.orgId === ctx.orgId);
  if (!c) throw new DataError('card_not_found');
  return c;
}
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';
const touchPass = (card: Card) => { card.version += 1; card.passModifiedAt = iso(); };

// ---------------------------------------------------------------- auth / session

export async function signUp(input: { email: string; password: string; businessName: string; timezone: string; country: string }) {
  const d = db();
  const email = input.email.trim().toLowerCase();
  if (d.users.some((u) => u.email === email)) throw new DataError('email_taken', 'An account with this email already exists.');
  const userId = uuid(), orgId = uuid();
  d.users.push({ id: userId, email, passwordHash: hashPassword(input.password), name: '' });
  d.orgs.push({
    id: orgId, name: input.businessName.trim(), timezone: input.timezone || 'UTC', country: input.country || 'RW',
    defaultCurrency: input.country === 'RW' ? 'RWF' : 'USD', plan: 'starter', planStatus: 'trialing',
    trialEndsAt: new Date(Date.now() + 15 * 86_400_000).toISOString(), createdAt: iso(),
  });
  d.members.push({ orgId, userId, role: 'owner' });
  return createSession(userId, orgId);
}

export async function signIn(emailRaw: string, password: string) {
  const d = db();
  const user = d.users.find((u) => u.email === emailRaw.trim().toLowerCase());
  if (!user || !verifyPassword(password, user.passwordHash)) throw new DataError('bad_login', 'That email and password don’t match.');
  const m = d.members.find((x) => x.userId === user.id);
  if (!m) throw new DataError('no_org');
  return createSession(user.id, m.orgId);
}

function createSession(userId: string, orgId: string) {
  const token = randomToken(24);
  db().sessions.push({ token, userId, orgId, createdAt: iso() });
  save();
  return token;
}

export async function getContextFromSession(token: string | undefined): Promise<OrgContext | null> {
  if (!token) return null;
  const s = db().sessions.find((x) => x.token === token);
  if (!s) return null;
  const m = db().members.find((x) => x.userId === s.userId && x.orgId === s.orgId);
  if (!m) return null;
  const u = db().users.find((x) => x.id === s.userId);
  return { orgId: s.orgId, userId: s.userId, role: m.role, actorLabel: u?.name || u?.email || 'Owner' };
}

export async function endSession(token: string) {
  const d = db();
  d.sessions = d.sessions.filter((s) => s.token !== token);
  save();
}

export async function getContextFromDevice(token: string | undefined): Promise<OrgContext | null> {
  if (!token) return null;
  const dev = db().devices.find((x) => x.tokenHash === sha(token) && !x.revokedAt);
  if (!dev) return null;
  dev.lastSeenAt = iso();
  return { orgId: dev.orgId, userId: null, deviceId: dev.id, role: 'device', actorLabel: dev.label };
}

// ---------------------------------------------------------------- org

export async function getOrg(ctx: OrgContext) { return { ...org(ctx) }; }

export async function updateOrg(ctx: OrgContext, patch: Partial<Pick<Org, 'name' | 'timezone' | 'website' | 'email' | 'phone' | 'addressLine1' | 'city'>>) {
  if (patch.timezone && !Intl.supportedValuesOf('timeZone').includes(patch.timezone)) throw new DataError('invalid_timezone', 'Pick a time zone from the list.');
  Object.assign(org(ctx), patch);
  save();
}

export const PLAN_LIMITS = {
  starter: { designs: 1, locations: 1, devices: 2 },
  growth: { designs: 3, locations: 3, devices: 5 },
  pro: { designs: 10, locations: 10, devices: 20 },
} as const;

// ---------------------------------------------------------------- campaigns

export type CampaignSummary = Campaign & { customers: number; inWallet: number };

export async function listCampaigns(ctx: OrgContext): Promise<CampaignSummary[]> {
  const d = db();
  return d.campaigns
    .filter((c) => c.orgId === ctx.orgId && c.status !== 'archived')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((c) => {
      const cards = d.cards.filter((k) => k.campaignId === c.id && k.status === 'active');
      return { ...c, customers: cards.length, inWallet: cards.filter((k) => k.appleInstalled || k.googleSaved).length };
    });
}

export async function getCampaign(ctx: OrgContext, id: string) { return { ...campaignOf(ctx, id) }; }

export async function createCampaign(ctx: OrgContext, name: string): Promise<Campaign> {
  const o = org(ctx);
  const existing = db().campaigns.filter((c) => c.orgId === ctx.orgId && c.status !== 'archived');
  if (existing.length >= PLAN_LIMITS[o.plan].designs) throw new DataError('plan_limit', `Your plan includes ${PLAN_LIMITS[o.plan].designs} card ${PLAN_LIMITS[o.plan].designs === 1 ? 'design' : 'designs'}.`);
  const clean = name.trim() || 'New card';
  if (existing.some((c) => c.name.toLowerCase() === clean.toLowerCase())) throw new DataError('name_taken', 'You already have a card with this name.');
  const c: Campaign = {
    id: uuid(), orgId: ctx.orgId, name: clean, shortCode: randomToken(5).toLowerCase(), status: 'draft', totalStamps: 10,
    programName: o.name, description: '', howToEarn: 'One stamp for every visit.', terms: '', hideTerms: false,
    stampMessage: 'You have {n} stamps', rewardMessage: 'Your reward is ready!',
    reward: { name: 'Free coffee', details: '' },
    design: { background: '#24292F', foreground: '#FFFFFF', label: '#C9D1D9', stamp: '#FFFFFF', icon: 'cup', logoText: o.name },
    fields: [
      { key: 'name', label: 'Your name', type: 'name', required: true },
      { key: 'phone', label: 'Phone', type: 'phone', required: true },
      { key: 'birthday', label: 'Birthday', type: 'birthday', required: false },
    ],
    links: [], locationIds: [], defaultCountry: o.country, consentEnabled: true,
    consentText: `Send me news and offers from ${o.name}. I can stop anytime.`,
    expiryMode: 'never', stampCooldownMinutes: 0, maxStampsPerTransaction: 5, maxStampsPerDay: 0,
    currency: o.defaultCurrency, createdAt: iso(), updatedAt: iso(),
  };
  db().campaigns.push(c);
  save();
  return c;
}

/** Fields that can't change once a card is live (architecture.md designer). */
const LOCKED_WHEN_LIVE = ['totalStamps', 'expiryMode', 'expiryDate', 'expiryDays'] as const;

export type CampaignPatch = Partial<Pick<Campaign,
  'name' | 'totalStamps' | 'programName' | 'description' | 'howToEarn' | 'terms' | 'hideTerms' | 'stampMessage' | 'rewardMessage' |
  'reward' | 'design' | 'links' | 'defaultCountry' | 'consentEnabled' | 'consentText' | 'expiryMode' | 'expiryDate' | 'expiryDays' |
  'stampCooldownMinutes' | 'maxStampsPerTransaction' | 'maxStampsPerDay' | 'stampValueCents'>>;

export async function updateCampaign(ctx: OrgContext, id: string, patch: CampaignPatch) {
  const c = campaignOf(ctx, id);
  if (c.status !== 'draft') {
    for (const k of LOCKED_WHEN_LIVE) if (k in patch && patch[k] !== c[k]) throw new DataError('locked_field', 'This can’t change after the card went live.');
  }
  if (patch.totalStamps !== undefined && (patch.totalStamps < 1 || patch.totalStamps > 30)) throw new DataError('invalid', 'Choose between 1 and 30 stamps.');
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new DataError('invalid', 'Give the card a name.');
    if (db().campaigns.some((x) => x.orgId === ctx.orgId && x.id !== id && x.status !== 'archived' && x.name.toLowerCase() === name.toLowerCase())) {
      throw new DataError('name_taken', 'You already have a card with this name.');
    }
  }
  Object.assign(c, patch, { updatedAt: iso() });
  save();
  return { ...c };
}

export async function setFormFields(ctx: OrgContext, id: string, fields: FormField[]) {
  const c = campaignOf(ctx, id);
  if (!fields.some((f) => (f.type === 'email' || f.type === 'phone') && f.required)) {
    throw new DataError('contact_required', 'Keep email or phone as a required field so customers can get their card back.');
  }
  c.fields = fields; c.updatedAt = iso();
  save();
}

export async function activateCampaign(ctx: OrgContext, id: string) {
  const c = campaignOf(ctx, id);
  const o = org(ctx);
  if (o.planStatus === 'locked') throw new DataError('locked', 'Your account is locked. Pay to activate cards.');
  if (!c.reward.name.trim()) throw new DataError('invalid', 'Name the reward before going live.');
  c.status = 'live'; c.activatedAt = c.activatedAt ?? iso(); c.updatedAt = iso();
  save();
}

export async function setCampaignStatus(ctx: OrgContext, id: string, status: 'live' | 'paused' | 'archived') {
  const c = campaignOf(ctx, id);
  if (status === 'live' && !c.activatedAt) throw new DataError('not_activated');
  c.status = status; c.updatedAt = iso();
  save();
}

/** "Update all cards": 10-minute cooldown, bumps every active pass. */
export async function pushCampaignUpdate(ctx: OrgContext, id: string) {
  const c = campaignOf(ctx, id);
  if (c.lastPushedAt && Date.now() - new Date(c.lastPushedAt).getTime() < 10 * 60_000) {
    throw new DataError('cooldown', 'You can update all cards once every 10 minutes.');
  }
  const cards = db().cards.filter((k) => k.campaignId === id && k.status === 'active');
  cards.forEach(touchPass);
  c.lastPushedAt = iso();
  save();
  return cards.length;
}

export async function setCampaignLocations(ctx: OrgContext, id: string, locationIds: string[]) {
  const c = campaignOf(ctx, id);
  if (locationIds.length > 10) throw new DataError('too_many', 'A card can show at most 10 locations.');
  const own = new Set(db().locations.filter((l) => l.orgId === ctx.orgId).map((l) => l.id));
  c.locationIds = locationIds.filter((x) => own.has(x));
  db().cards.filter((k) => k.campaignId === id && k.status === 'active').forEach(touchPass);
  save();
}

// ---------------------------------------------------------------- public: join + card

export type PublicCampaign = Pick<Campaign, 'name' | 'programName' | 'description' | 'howToEarn' | 'terms' | 'hideTerms' | 'reward' | 'design' | 'fields' | 'defaultCountry' | 'consentEnabled' | 'consentText' | 'totalStamps' | 'status'> & { business: string; shortCode: string };

export async function getPublicCampaign(shortCode: string): Promise<PublicCampaign | null> {
  const c = db().campaigns.find((x) => x.shortCode === shortCode);
  if (!c || c.status === 'draft' || c.status === 'archived') return null;
  const o = db().orgs.find((x) => x.id === c.orgId)!;
  const { name, programName, description, howToEarn, terms, hideTerms, reward, design, fields, defaultCountry, consentEnabled, consentText, totalStamps, status } = c;
  return { name, programName, description, howToEarn, terms, hideTerms, reward, design, fields, defaultCountry, consentEnabled, consentText, totalStamps, status, business: o.name, shortCode };
}

export type JoinInput = { values: Record<string, string>; consent: boolean };
export type JoinResult = { status: 'created'; serial: string } | { status: 'sent' };

/**
 * Join (review C1): a matching existing customer is NEVER returned or updated.
 * The response is "sent" (the link goes to the contact on file), identical
 * whether or not the person exists.
 */
export async function joinCampaign(shortCode: string, input: JoinInput): Promise<JoinResult> {
  const d = db();
  const c = d.campaigns.find((x) => x.shortCode === shortCode);
  if (!c || c.status !== 'live') throw new DataError('closed', 'This card isn’t taking new members right now.');
  const v = input.values;
  const email = v.email?.trim().toLowerCase() || undefined;
  const phone = v.phone?.replace(/[^\d+]/g, '') || undefined;
  if (c.consentEnabled && !input.consent && c.fields.length === 0) throw new DataError('consent');
  const existing = d.customers.find((x) => x.orgId === c.orgId && !x.deletedAt && ((email && x.email === email) || (phone && x.phoneE164 === phone)));
  if (existing) {
    // would send the restore link to the contact on file (email now, SMS later)
    return { status: 'sent' };
  }
  const t = iso();
  const [bm, bd] = (v.birthday ?? '').split('-').map(Number);
  const cust: Customer = {
    id: uuid(), orgId: c.orgId, name: (v.name ?? '').trim(), email, phoneE164: phone,
    birthdayMonth: bm || undefined, birthdayDay: bd || undefined,
    extra: Object.fromEntries(Object.entries(v).filter(([k]) => !['name', 'email', 'phone', 'birthday'].includes(k))),
    marketingConsent: input.consent, consentAt: input.consent ? t : undefined, createdAt: t,
  };
  const expiresAt = c.expiryMode === 'fixed_date' ? c.expiryDate ?? null
    : c.expiryMode === 'days_after_join' && c.expiryDays ? new Date(Date.now() + c.expiryDays * 86_400_000).toISOString() : null;
  let manualCode = randomToken(5);
  while (d.cards.some((k) => k.orgId === c.orgId && k.manualCode === manualCode)) manualCode = randomToken(5);
  const card: Card = {
    id: uuid(), orgId: c.orgId, campaignId: c.id, customerId: cust.id, serial: randomToken(16), barcodeToken: randomToken(16),
    manualCode, status: 'active', currentStamps: 0, rewardsAvailable: 0, totalStampsEarned: 0, totalRewardsEarned: 0,
    totalRewardsRedeemed: 0, lastStampAt: null, lastVisitAt: t, expiresAt, appleInstalled: false, googleSaved: false,
    version: 1, passModifiedAt: t, createdAt: t,
  };
  d.customers.push(cust);
  d.cards.push(card);
  d.events.push({ id: uuid(), orgId: c.orgId, campaignId: c.id, cardId: card.id, type: 'enrolled', quantity: 1, source: 'customer', createdAt: t });
  save();
  return { status: 'created', serial: card.serial };
}

export async function getPublicCard(serial: string): Promise<PublicCard | null> {
  const d = db();
  const card = d.cards.find((k) => k.serial === serial);
  if (!card) return null;
  const c = d.campaigns.find((x) => x.id === card.campaignId)!;
  const cust = d.customers.find((x) => x.id === card.customerId)!;
  const o = d.orgs.find((x) => x.id === card.orgId)!;
  // web-card reach: written at most once an hour (keeps the hot row quiet)
  if (!card.webCardSeenAt || Date.now() - new Date(card.webCardSeenAt).getTime() > 3_600_000) { card.webCardSeenAt = iso(); save(); }
  return {
    serial: card.serial, firstName: firstName(cust.name), currentStamps: card.currentStamps, rewardsAvailable: card.rewardsAvailable,
    manualCode: card.manualCode, qrPayload: encodeBarcode(card.barcodeToken), noteText: card.noteText, status: card.status,
    expired: !!card.expiresAt && new Date(card.expiresAt) <= now(),
    campaign: {
      name: c.name, programName: c.programName, totalStamps: c.totalStamps, reward: c.reward, design: c.design, description: c.description,
      howToEarn: c.howToEarn, terms: c.terms, hideTerms: c.hideTerms, links: c.links, newsText: c.newsText, status: c.status, business: o.name,
    },
    locations: d.locations.filter((l) => c.locationIds.includes(l.id) && l.showOnCard).map((l) => ({ name: l.name, addressOnCard: l.addressOnCard })),
  };
}

// ---------------------------------------------------------------- scanner

export type ScanLookup =
  | { ok: true; card: { id: string; firstName: string; currentStamps: number; rewardsAvailable: number; totalStampsEarned: number; lastVisitAt: string; campaignName: string; totalStamps: number; rewardName: string; maxStampsPerTransaction: number; design: Campaign['design'] } }
  | { ok: false; error: 'invalid_code' | 'card_not_found' | 'card_replaced' | TxErrorKey };

export async function scanLookup(ctx: OrgContext, code: { qr?: string; manual?: string }): Promise<ScanLookup> {
  const d = db();
  let card: Card | undefined;
  if (code.qr) {
    const token = decodeBarcode(code.qr);
    if (!token) return { ok: false, error: 'invalid_code' };
    card = d.cards.find((k) => k.orgId === ctx.orgId && k.barcodeToken === token);
    if (!card && d.cards.some((k) => k.orgId === ctx.orgId && k.previousBarcodeToken === token)) return { ok: false, error: 'card_replaced' };
  } else if (code.manual) {
    const m = code.manual.trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
    card = d.cards.find((k) => k.orgId === ctx.orgId && k.manualCode === m);
  }
  if (!card) return { ok: false, error: 'card_not_found' };
  if (card.status !== 'active') return { ok: false, error: 'card_deleted' };
  const c = d.campaigns.find((x) => x.id === card!.campaignId)!;
  const cust = d.customers.find((x) => x.id === card!.customerId)!;
  return {
    ok: true,
    card: {
      id: card.id, firstName: firstName(cust.name), currentStamps: card.currentStamps, rewardsAvailable: card.rewardsAvailable,
      totalStampsEarned: card.totalStampsEarned, lastVisitAt: card.lastVisitAt, campaignName: c.name, totalStamps: c.totalStamps,
      rewardName: c.reward.name, maxStampsPerTransaction: c.maxStampsPerTransaction, design: c.design,
    },
  };
}

/** Mirrors apply_card_transaction: idempotent, rule-checked, ledgered. */
export async function applyCardTransaction(
  ctx: OrgContext,
  input: { cardId: string; stamps: number; redeem: number; source: 'scanner' | 'dashboard'; idempotencyKey: string },
): Promise<{ ok: true; result: TxResult } | { ok: false; error: TxErrorKey | 'card_not_found' | 'idempotency_key_reused' }> {
  const d = db();
  const card = d.cards.find((k) => k.id === input.cardId && k.orgId === ctx.orgId);
  if (!card) return { ok: false, error: 'card_not_found' };
  const reqHash = sha([input.cardId, input.stamps, input.redeem, input.source].join('|'));
  const prev = d.idempotency.find((x) => x.orgId === ctx.orgId && x.key === input.idempotencyKey);
  if (prev) {
    if (prev.requestHash !== reqHash) return { ok: false, error: 'idempotency_key_reused' };
    return { ok: true, result: { ...prev.result, replayed: true } };
  }
  const campaign = d.campaigns.find((x) => x.id === card.campaignId)!;
  const since = Date.now() - 86_400_000;
  const net = d.events
    .filter((e) => e.cardId === card.id && new Date(e.createdAt).getTime() > since && (e.type === 'stamped' || e.type === 'unstamped'))
    .reduce((s, e) => s + (e.type === 'stamped' ? e.quantity : -e.quantity), 0);
  const out = applyTransaction(card, campaign, input, now(), net);
  if (!out.ok) return out;

  Object.assign(card, out.card);
  if (input.stamps > 0 || input.redeem > 0) card.lastVisitAt = iso();
  if (out.rotateBarcode) { card.previousBarcodeToken = card.barcodeToken; card.barcodeToken = randomToken(16); }
  touchPass(card);
  const base = { orgId: ctx.orgId, campaignId: card.campaignId, cardId: card.id, source: input.source, actorLabel: ctx.actorLabel, scannerDeviceId: ctx.deviceId, idempotencyKey: input.idempotencyKey, createdAt: iso() } as const;
  if (input.stamps !== 0) d.events.push({ ...base, id: uuid(), type: input.stamps > 0 ? 'stamped' : 'unstamped', quantity: Math.abs(input.stamps) });
  if (out.earned > 0) d.events.push({ ...base, id: uuid(), type: 'reward_earned', quantity: out.earned });
  if (out.redeemed > 0) d.events.push({ ...base, id: uuid(), type: 'reward_redeemed', quantity: out.redeemed });
  const result: TxResult = { cardId: card.id, earned: out.earned, redeemed: out.redeemed, currentStamps: card.currentStamps, rewardsAvailable: card.rewardsAvailable, replayed: false };
  d.idempotency.push({ orgId: ctx.orgId, key: input.idempotencyKey, requestHash: reqHash, result });
  save();
  return { ok: true, result };
}

export async function recentScans(ctx: OrgContext, limit = 30) {
  const d = db();
  return d.events
    .filter((e) => e.orgId === ctx.orgId && ['stamped', 'unstamped', 'reward_redeemed'].includes(e.type) && (ctx.role !== 'device' || e.scannerDeviceId === ctx.deviceId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((e) => ({ ...e, firstName: firstName(d.customers.find((x) => x.id === d.cards.find((k) => k.id === e.cardId)?.customerId)?.name ?? '') }));
}

// ---------------------------------------------------------------- customers

export type CardRow = {
  cardId: string; name: string; email?: string; phone?: string; currentStamps: number; rewardsAvailable: number;
  totalStampsEarned: number; wallet: 'apple' | 'google' | 'web'; lastVisitAt: string; createdAt: string; status: Card['status'];
};

export type CardSort = 'last_visit' | 'stamps' | 'name' | 'joined';

export async function listCards(ctx: OrgContext, campaignId: string, opts: { q?: string; sort?: CardSort; limit?: number; offset?: number } = {}) {
  campaignOf(ctx, campaignId);
  const d = db();
  const q = opts.q?.trim().toLowerCase();
  let rows: CardRow[] = d.cards
    .filter((k) => k.campaignId === campaignId && k.status === 'active')
    .map((k) => {
      const cust = d.customers.find((x) => x.id === k.customerId)!;
      return {
        cardId: k.id, name: cust.name, email: cust.email, phone: cust.phoneE164, currentStamps: k.currentStamps, rewardsAvailable: k.rewardsAvailable,
        totalStampsEarned: k.totalStampsEarned, wallet: k.appleInstalled ? 'apple' : k.googleSaved ? 'google' : 'web', lastVisitAt: k.lastVisitAt,
        createdAt: k.createdAt, status: k.status,
      } satisfies CardRow;
    });
  if (q) rows = rows.filter((r) => [r.name, r.email, r.phone].some((v) => v?.toLowerCase().includes(q)));
  const sort = opts.sort ?? 'last_visit';
  rows.sort((a, b) =>
    sort === 'stamps' ? b.currentStamps - a.currentStamps || b.rewardsAvailable - a.rewardsAvailable
      : sort === 'name' ? a.name.localeCompare(b.name)
        : sort === 'joined' ? b.createdAt.localeCompare(a.createdAt)
          : b.lastVisitAt.localeCompare(a.lastVisitAt));
  const total = rows.length;
  const offset = opts.offset ?? 0, limit = opts.limit ?? 25;
  return { rows: rows.slice(offset, offset + limit), total };
}

export async function getCardDetail(ctx: OrgContext, cardId: string) {
  const card = cardOf(ctx, cardId);
  const d = db();
  const cust = d.customers.find((x) => x.id === card.customerId)!;
  const campaign = d.campaigns.find((x) => x.id === card.campaignId)!;
  const events: CardEvent[] = d.events.filter((e) => e.cardId === card.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50);
  return { card: { ...card }, customer: { ...cust }, campaign: { ...campaign }, events };
}

export async function updateCustomer(ctx: OrgContext, cardId: string, patch: { name?: string; email?: string; phone?: string }) {
  const card = cardOf(ctx, cardId);
  const d = db();
  const cust = d.customers.find((x) => x.id === card.customerId)!;
  const email = patch.email?.trim().toLowerCase() || undefined;
  const phone = patch.phone?.replace(/[^\d+]/g, '') || undefined;
  if (!email && !phone) throw new DataError('contact_required', 'Keep an email or a phone number.');
  if (phone && !/^\+[1-9]\d{6,14}$/.test(phone)) throw new DataError('invalid_phone', 'Use the full number with country code, like +250788123456.');
  const clash = d.customers.find((x) => x.orgId === ctx.orgId && x.id !== cust.id && !x.deletedAt && ((email && x.email === email) || (phone && x.phoneE164 === phone)));
  if (clash) throw new DataError('duplicate', 'Another customer already uses this email or phone.');
  Object.assign(cust, { name: patch.name?.trim() ?? cust.name, email, phoneE164: phone });
  d.events.push({ id: uuid(), orgId: ctx.orgId, campaignId: card.campaignId, cardId: card.id, type: 'customer_updated', quantity: 1, source: 'dashboard', actorLabel: ctx.actorLabel, createdAt: iso() });
  save();
}

export async function deleteCard(ctx: OrgContext, cardId: string, farewell?: string) {
  const card = cardOf(ctx, cardId);
  card.status = 'deleted'; card.deletedAt = iso(); card.noteText = farewell?.trim() || undefined;
  touchPass(card);
  const d = db();
  // frees the unique email/phone when the customer has no other active card
  if (!d.cards.some((k) => k.customerId === card.customerId && k.status === 'active')) {
    const cust = d.customers.find((x) => x.id === card.customerId)!;
    cust.deletedAt = iso();
  }
  d.events.push({ id: uuid(), orgId: ctx.orgId, campaignId: card.campaignId, cardId: card.id, type: 'card_deleted', quantity: 1, source: 'dashboard', actorLabel: ctx.actorLabel, createdAt: iso() });
  save();
}

/** Staff-side enrolment: create the customer + card and return the link to share. */
export async function createCardForCustomer(ctx: OrgContext, campaignId: string, input: { name: string; phone?: string; email?: string }) {
  const c = campaignOf(ctx, campaignId);
  if (c.status !== 'live') throw new DataError('closed', 'Activate the card first.');
  const res = await joinCampaign(c.shortCode, { values: { name: input.name, phone: input.phone ?? '', email: input.email ?? '' }, consent: false });
  if (res.status === 'sent') throw new DataError('duplicate', 'This customer already has this card. Search for them in the list.');
  return res.serial;
}

// ---------------------------------------------------------------- insights

export async function getInsights(ctx: OrgContext, campaignId: string, days = 30) {
  const c = campaignOf(ctx, campaignId);
  const d = db();
  const since = Date.now() - days * 86_400_000;
  const prevSince = since - days * 86_400_000;
  const ev = d.events.filter((e) => e.campaignId === campaignId);
  const count = (type: string, from: number, to: number) =>
    ev.filter((e) => e.type === type && +new Date(e.createdAt) > from && +new Date(e.createdAt) <= to).reduce((s, e) => s + e.quantity, 0);
  const t = Date.now();
  const cur = { enrolled: count('enrolled', since, t), stamps: count('stamped', since, t) - count('unstamped', since, t), earned: count('reward_earned', since, t), redeemed: count('reward_redeemed', since, t) };
  const prev = { enrolled: count('enrolled', prevSince, since), stamps: count('stamped', prevSince, since) - count('unstamped', prevSince, since), redeemed: count('reward_redeemed', prevSince, since) };
  const pct = (a: number, b: number) => (b === 0 ? undefined : Math.round(((a - b) / b) * 100));
  const daily = Array.from({ length: days }, (_, i) => {
    const start = since + i * 86_400_000, end = start + 86_400_000;
    return { date: new Date(start).toISOString().slice(0, 10), stamps: count('stamped', start, end), enrolled: count('enrolled', start, end) };
  });
  const cards = d.cards.filter((k) => k.campaignId === campaignId && k.status === 'active');
  const status = { apple: cards.filter((k) => k.appleInstalled).length, google: cards.filter((k) => k.googleSaved).length, web: cards.filter((k) => !k.appleInstalled && !k.googleSaved).length };
  const revenue = c.stampValueCents ? cur.stamps * c.stampValueCents : undefined;
  const cost = c.reward.costCents ? cur.redeemed * c.reward.costCents : undefined;
  return { ...cur, deltas: { enrolled: pct(cur.enrolled, prev.enrolled), stamps: pct(cur.stamps, prev.stamps), redeemed: pct(cur.redeemed, prev.redeemed) }, daily, status, revenue, cost, net: revenue !== undefined && cost !== undefined ? revenue - cost : undefined, currency: c.currency };
}

// ---------------------------------------------------------------- locations

export async function listLocations(ctx: OrgContext) {
  const d = db();
  return d.locations.filter((l) => l.orgId === ctx.orgId).map((l) => ({ ...l, cards: d.campaigns.filter((c) => c.locationIds.includes(l.id)).length }));
}

export async function upsertLocation(ctx: OrgContext, input: Omit<Location, 'id' | 'orgId'> & { id?: string }) {
  const d = db();
  const o = org(ctx);
  if (!input.name.trim()) throw new DataError('invalid', 'Give the place a name.');
  if (Number.isNaN(input.lat) || Number.isNaN(input.lon) || Math.abs(input.lat) > 90 || Math.abs(input.lon) > 180) throw new DataError('invalid', 'Pick the place on the map or enter a valid latitude and longitude.');
  if (input.id) {
    const l = d.locations.find((x) => x.id === input.id && x.orgId === ctx.orgId);
    if (!l) throw new DataError('not_found');
    Object.assign(l, { ...input, orgId: ctx.orgId });
    d.campaigns.filter((c) => c.locationIds.includes(l.id)).forEach((c) => d.cards.filter((k) => k.campaignId === c.id && k.status === 'active').forEach(touchPass));
  } else {
    if (d.locations.filter((l) => l.orgId === ctx.orgId).length >= PLAN_LIMITS[o.plan].locations) throw new DataError('plan_limit', `Your plan includes ${PLAN_LIMITS[o.plan].locations} locations.`);
    d.locations.push({ ...input, id: uuid(), orgId: ctx.orgId });
  }
  save();
}

export async function deleteLocation(ctx: OrgContext, id: string) {
  const d = db();
  d.locations = d.locations.filter((l) => !(l.id === id && l.orgId === ctx.orgId));
  d.campaigns.filter((c) => c.orgId === ctx.orgId).forEach((c) => { c.locationIds = c.locationIds.filter((x) => x !== id); });
  save();
}

// ---------------------------------------------------------------- counter devices

export async function listDevices(ctx: OrgContext): Promise<ScannerDevice[]> {
  return db().devices.filter((x) => x.orgId === ctx.orgId && !x.revokedAt);
}

export async function createPairingCode(ctx: OrgContext, label: string, locationId?: string) {
  const o = org(ctx);
  if (!label.trim()) throw new DataError('invalid', 'Name the phone, like “Front counter”.');
  if ((await listDevices(ctx)).length >= PLAN_LIMITS[o.plan].devices) throw new DataError('plan_limit', `Your plan includes ${PLAN_LIMITS[o.plan].devices} counter phones.`);
  const code = randomToken(4).slice(0, 6);
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  db().pairingCodes.push({ code, orgId: ctx.orgId, label: label.trim(), locationId, expiresAt });
  save();
  return { code, expiresAt };
}

/** Counter phone exchanges a pairing code for a device token (shown once). */
export async function pairDevice(codeRaw: string) {
  const d = db();
  const code = codeRaw.trim().toUpperCase();
  const p = d.pairingCodes.find((x) => x.code === code && new Date(x.expiresAt) > now());
  if (!p) throw new DataError('bad_code', 'That code didn’t work. Codes last 10 minutes; ask for a new one.');
  d.pairingCodes = d.pairingCodes.filter((x) => x !== p);
  const token = randomToken(32);
  d.devices.push({ id: uuid(), orgId: p.orgId, label: p.label, tokenHash: sha(token), locationId: p.locationId, lastSeenAt: iso(), createdAt: iso() });
  save();
  return token;
}

export async function revokeDevice(ctx: OrgContext, id: string) {
  const dev = db().devices.find((x) => x.id === id && x.orgId === ctx.orgId);
  if (dev) { dev.revokedAt = iso(); save(); }
}

// ---------------------------------------------------------------- messages

const BUDGET = 3;
function claimSlot(cardId: string, channel: 'apple' | 'google'): boolean {
  const d = db();
  const since = Date.now() - 86_400_000;
  if (d.notifications.filter((n) => n.cardId === cardId && n.channel === channel && +new Date(n.at) > since).length >= BUDGET) return false;
  d.notifications.push({ cardId, channel, at: iso() });
  return true;
}

export async function broadcastReach(ctx: OrgContext, campaignId: string) {
  campaignOf(ctx, campaignId);
  const cards = db().cards.filter((k) => k.campaignId === campaignId && k.status === 'active');
  const since = Date.now() - 90 * 86_400_000;
  return {
    wallet: cards.filter((k) => k.appleInstalled || k.googleSaved).length,
    webCards: cards.filter((k) => !k.appleInstalled && !k.googleSaved && k.webCardSeenAt && +new Date(k.webCardSeenAt) > since).length,
  };
}

/** FAKE delivery: claims budget slots and updates passes; no Apple/Google calls yet. */
export async function sendBroadcast(ctx: OrgContext, campaignId: string, body: string): Promise<Message> {
  const c = campaignOf(ctx, campaignId);
  const text = body.trim();
  if (!text) throw new DataError('invalid', 'Write a message first.');
  if (text.length > 300) throw new DataError('invalid', 'Keep it under 300 characters.');
  if (c.status !== 'live') throw new DataError('closed', 'Activate the card before sending messages.');
  const d = db();
  const cards = d.cards.filter((k) => k.campaignId === campaignId && k.status === 'active');
  let delivered = 0, skipped = 0;
  for (const k of cards.filter((x) => x.appleInstalled || x.googleSaved)) {
    if (claimSlot(k.id, k.appleInstalled ? 'apple' : 'google')) { delivered++; touchPass(k); } else skipped++;
  }
  c.newsText = text; c.newsUpdatedAt = iso();
  const reach = await broadcastReach(ctx, campaignId);
  const m: Message = { id: uuid(), orgId: ctx.orgId, campaignId, kind: 'broadcast', body: text, status: 'sent', recipients: delivered + skipped, delivered, skipped, webCards: reach.webCards, createdAt: iso() };
  d.messages.push(m);
  save();
  return m;
}

export async function listMessages(ctx: OrgContext, campaignId: string) {
  campaignOf(ctx, campaignId);
  return db().messages.filter((m) => m.campaignId === campaignId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ---------------------------------------------------------------- automations

export async function getAutomations(ctx: OrgContext, campaignId: string): Promise<Record<'birthday' | 'winback', Automation>> {
  campaignOf(ctx, campaignId);
  const d = db();
  const find = (kind: 'birthday' | 'winback') => d.automations.find((a) => a.campaignId === campaignId && a.kind === kind);
  const fallback = (kind: 'birthday' | 'winback'): Automation => ({
    id: uuid(), orgId: ctx.orgId, campaignId, kind, enabled: false, sendHour: 10,
    body: kind === 'birthday' ? 'Happy birthday {name}! Come by for a treat on us.' : 'We miss you, {name}. Come by this week for a double stamp.',
    daysInactive: kind === 'winback' ? 30 : undefined,
  });
  return { birthday: find('birthday') ?? fallback('birthday'), winback: find('winback') ?? fallback('winback') };
}

export async function saveAutomation(ctx: OrgContext, campaignId: string, kind: 'birthday' | 'winback', input: { enabled: boolean; body: string; daysInactive?: number; sendHour: number }) {
  const c = campaignOf(ctx, campaignId);
  if (!input.body.trim()) throw new DataError('invalid', 'Write the message.');
  if (input.body.length > 300) throw new DataError('invalid', 'Keep it under 300 characters.');
  if (kind === 'winback' && (!input.daysInactive || input.daysInactive < 7 || input.daysInactive > 365)) throw new DataError('invalid', 'Choose between 7 and 365 days.');
  if (kind === 'birthday' && input.enabled && !c.fields.some((f) => f.type === 'birthday')) {
    throw new DataError('no_birthday_field', 'Add a Birthday field to the signup form first.');
  }
  const d = db();
  let a = d.automations.find((x) => x.campaignId === campaignId && x.kind === kind);
  if (!a) { a = (await getAutomations(ctx, campaignId))[kind]; d.automations.push(a); }
  const turningOn = input.enabled && !a.enabled;
  Object.assign(a, { enabled: input.enabled, body: input.body.trim(), sendHour: input.sendHour, daysInactive: kind === 'winback' ? input.daysInactive : undefined });
  if (turningOn) a.enabledAt = iso(); // reset on every off->on (review M9)
  save();
}

/** Rough 7-day forecast for the automation card. */
export async function automationForecast(ctx: OrgContext, campaignId: string, kind: 'birthday' | 'winback', daysInactive = 30) {
  campaignOf(ctx, campaignId);
  const d = db();
  const cards = d.cards.filter((k) => k.campaignId === campaignId && k.status === 'active' && (k.appleInstalled || k.googleSaved));
  if (kind === 'birthday') {
    let n = 0;
    for (let i = 0; i < 7; i++) {
      const dt = new Date(Date.now() + i * 86_400_000);
      n += cards.filter((k) => {
        const c = d.customers.find((x) => x.id === k.customerId)!;
        return c.birthdayMonth && c.birthdayDay && isBirthdayToday(c.birthdayMonth, c.birthdayDay, dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
      }).length;
    }
    return n;
  }
  // cards that will cross the N-day mark during the next 7 days
  const lo = Date.now() - daysInactive * 86_400_000, hi = lo + 7 * 86_400_000;
  return cards.filter((k) => { const t = +new Date(k.lastVisitAt); return t > lo && t <= hi; }).length;
}

// ---------------------------------------------------------------- billing (fake)

export const PRICES = {
  starter: { RWF: 15000, USD: 12 }, growth: { RWF: 35000, USD: 29 }, pro: { RWF: 60000, USD: 49 },
} as const;

export async function getBilling(ctx: OrgContext) {
  const o = org(ctx);
  const daysLeft = Math.max(0, Math.ceil((+new Date(o.trialEndsAt) - Date.now()) / 86_400_000));
  return { plan: o.plan, planStatus: o.planStatus, trialEndsAt: o.trialEndsAt, daysLeft, currency: o.defaultCurrency === 'RWF' ? 'RWF' as const : 'USD' as const, limits: PLAN_LIMITS[o.plan] };
}

/** FAKE checkout: marks the plan active. Real Paddle / Flutterwave in /replica-backend. */
export async function fakeCheckout(ctx: OrgContext, plan: 'starter' | 'growth' | 'pro') {
  const o = org(ctx);
  o.plan = plan; o.planStatus = 'active';
  save();
}
