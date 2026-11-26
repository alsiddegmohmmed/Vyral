// Google Wallet LoyaltyClass / LoyaltyObject builders. Pure: no I/O, no `@/` imports.
//
// LoyaltyClass:  https://developers.google.com/wallet/reference/rest/v1/loyaltyclass
// LoyaltyObject: https://developers.google.com/wallet/reference/rest/v1/loyaltyobject
// State enum:    https://developers.google.com/wallet/reference/rest/v1/State
// ReviewStatus:  https://developers.google.com/wallet/reference/rest/v1/ReviewStatus
// MerchantLocation (latitude/longitude, max 10): https://developers.google.com/wallet/reference/rest/v1/MerchantLocation
// CallbackOptions (url): https://developers.google.com/wallet/reference/rest/v1/CallbackOptions
// notifyPreference (NotificationSettingsForUpdates): https://developers.google.com/wallet/reference/rest/v1/NotificationSettingsForUpdates
import type { WalletPassData } from '../../integrations/contracts';

type Campaign = WalletPassData['campaign'];

const ID_PART = /^[A-Za-z0-9._-]+$/;

/** Opaque class id: `${issuerId}.c_${campaignId without dashes}`. */
export function classIdFor(issuerId: string, campaignId: string): string {
  const suffix = campaignId.replace(/-/g, '');
  if (!ID_PART.test(issuerId) || !ID_PART.test(suffix)) throw new Error('invalid Google class id parts');
  return `${issuerId}.c_${suffix}`;
}

/** Opaque object id: `${issuerId}.o_${serial}`. */
export function objectIdFor(issuerId: string, serial: string): string {
  if (!ID_PART.test(issuerId) || !ID_PART.test(serial)) throw new Error('invalid Google object id parts');
  return `${issuerId}.o_${serial}`;
}

/** '#abc' / '#aabbcc' → '#aabbcc'; anything else → undefined (Google picks a colour). */
export function normalizeHex(hex: string): string | undefined {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex ?? '').trim());
  if (!m) return undefined;
  return '#' + (m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]).toLowerCase();
}

const localized = (value: string) => ({ defaultValue: { language: 'en-US', value } });

export function buildLoyaltyClass(campaign: Campaign, issuerId: string, opts: { publicBaseUrl?: string } = {}) {
  const base = (opts.publicBaseUrl ?? process.env.PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');
  const hex = normalizeHex(campaign.design.background);
  return {
    id: classIdFor(issuerId, campaign.id),
    issuerName: campaign.business,
    programName: campaign.programName || campaign.name,
    // PLACEHOLDER path: nothing serves it yet. Google fetches this URL, so it must be a public
    // HTTPS image before the class is inserted for real (architecture.md: Storage public bucket).
    programLogo: {
      sourceUri: { uri: `${base}/api/wallet/logo/${encodeURIComponent(campaign.id)}.png` },
      contentDescription: localized(campaign.business),
    },
    ...(hex ? { hexBackgroundColor: hex } : {}),
    reviewStatus: 'UNDER_REVIEW' as const,
    merchantLocations: campaign.locations.slice(0, 10).map((l) => ({ latitude: l.lat, longitude: l.lon })),
    callbackOptions: { url: `${base}/api/webhooks/google` },
  };
}

export type LoyaltyState = 'ACTIVE' | 'EXPIRED' | 'INACTIVE';

export function objectState(d: Pick<WalletPassData, 'status' | 'expired'>): LoyaltyState {
  if (d.status === 'deleted') return 'INACTIVE';
  if (d.expired) return 'EXPIRED';
  return 'ACTIVE';
}

export const stampsBalance = (d: Pick<WalletPassData, 'currentStamps' | 'totalStamps'>) => `${d.currentStamps}/${d.totalStamps}`;

export function loyaltyPoints(d: Pick<WalletPassData, 'currentStamps' | 'totalStamps'>) {
  return { label: 'Stamps', balance: { string: stampsBalance(d) } };
}

export function secondaryLoyaltyPoints(d: Pick<WalletPassData, 'rewardsAvailable'>) {
  return { label: 'Rewards', balance: { string: String(d.rewardsAvailable) } };
}

function textModules(d: WalletPassData) {
  const out: { id: string; header: string; body: string }[] = [];
  if (d.newsText) out.push({ id: 'news', header: `News from ${d.campaign.business}`, body: d.newsText });
  if (d.noteText) out.push({ id: 'note', header: 'Message', body: d.noteText });
  if (d.mystery?.boxes.length) {
    const waiting = d.mystery.boxes.filter((b) => !b.opened).length;
    const won = d.mystery.boxes.filter((b) => b.opened).map((b) => b.name);
    out.push({ id: 'mystery', header: 'Mystery box', body: waiting ? `${waiting > 1 ? `${waiting} boxes are` : 'Your box is'} ready. Open it on your card.` : `You won: ${won.join(', ')}. Show your card at the counter.` });
  }
  return out;
}

/** The link to open a mystery box on the web card (Google "links" module). */
function linksModule(d: WalletPassData) {
  if (!d.mystery?.boxes.length || !d.cardUrl) return undefined;
  const waiting = d.mystery.boxes.some((b) => !b.opened);
  return { uris: [{ id: 'open_box', uri: d.cardUrl, description: waiting ? 'Open your mystery box' : 'See your prize' }] };
}

export function buildLoyaltyObject(d: WalletPassData, issuerId: string, classId: string) {
  return {
    id: objectIdFor(issuerId, d.serial),
    classId,
    state: objectState(d),
    accountName: d.firstName,
    loyaltyPoints: loyaltyPoints(d),
    secondaryLoyaltyPoints: secondaryLoyaltyPoints(d),
    barcode: { type: 'QR_CODE' as const, value: d.qrPayload, alternateText: d.manualCode },
    textModulesData: textModules(d),
    ...(linksModule(d) ? { linksModuleData: linksModule(d) } : {}),
  };
}

export type LoyaltyClass = ReturnType<typeof buildLoyaltyClass>;
export type LoyaltyObject = ReturnType<typeof buildLoyaltyObject>;

/**
 * PATCH body for a balance change. `notifyPreference` is ephemeral (it must be sent on each
 * PATCH that should notify), so it is only included when notify is true. The enum value is
 * NOTIFY_ON_UPDATE per the NotificationSettingsForUpdates reference.
 */
export function pointsPatch(balance: string, notify: boolean, extra: Record<string, unknown> = {}) {
  return {
    ...extra,
    loyaltyPoints: { label: 'Stamps', balance: { string: balance } },
    ...(notify ? { notifyPreference: 'NOTIFY_ON_UPDATE' as const } : {}),
  };
}
