// pass.json for one card. Pure: no env, no I/O, no `@/` imports (tests load it with node).
//
// Pass keys:            https://developer.apple.com/documentation/walletpasses/pass
// Field keys:           https://developer.apple.com/documentation/walletpasses/passfieldcontent
// Locations (max 10):   https://developer.apple.com/documentation/walletpasses/pass/locations-data.dictionary
// Web service keys:     https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes
import type { WalletPassData } from '../../integrations/contracts';
import { rewardHeadline, stampCount, toGo } from '../reward-first';

export type PassJsonConfig = {
  passTypeIdentifier: string;
  teamIdentifier: string;
  /** `${PUBLIC_BASE_URL}/api/apple`; the device appends /v1/... itself. */
  webServiceURL: string;
  organizationName?: string;
};

type Field = {
  key: string;
  label?: string;
  value: string;
  changeMessage?: string;
  attributedValue?: string;
  textAlignment?: string;
};

/** '#1a2b3c' or '#abc' → 'rgb(26, 43, 60)'. Unparseable input falls back to the given rgb(). */
export function hexToRgb(hex: string, fallback = 'rgb(0, 0, 0)'): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex ?? '').trim());
  if (!m) return /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i.test(hex ?? '') ? hex : fallback;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`;
}

/**
 * A changeMessage "needs to contain the escape %@, which the field's new value
 * replaces" (passfieldcontent). If the merchant's text has no %@, append it.
 */
export function asChangeMessage(text: string): string {
  const t = (text ?? '').replace(/%(?!@)/g, '').trim();
  if (!t) return '%@';
  return t.includes('%@') ? t : `${t} %@`;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function linkField(l: WalletPassData['campaign']['links'][number], i: number): Field {
  const f: Field = { key: `link_${i}`, label: l.label || l.kind, value: l.value };
  const href =
    /^https?:\/\//i.test(l.value) ? l.value
    : l.kind === 'email' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(l.value) ? `mailto:${l.value}`
    : l.kind === 'phone' ? `tel:${l.value.replace(/[^\d+]/g, '')}`
    : null;
  // attributedValue supports only <a href> (passfieldcontent).
  if (href) f.attributedValue = `<a href='${escapeHtml(href)}'>${escapeHtml(l.label || l.value)}</a>`;
  return f;
}

export function buildPassJson(d: WalletPassData, cfg: PassJsonConfig) {
  const c = d.campaign;
  // Reward first (lib/wallet/reward-first.ts): the reward is the big primary field over the
  // stamp strip, visits to go sit top right, and the stamp count goes underneath.
  // Stamps are always silent. The reward field changes VALUE when a reward becomes ready (or a
  // mystery box arrives), and only then carries a changeMessage, so earning notifies and
  // redeeming or revealing does not.
  const head = rewardHeadline({ rewardName: c.reward.name, rewardsAvailable: d.rewardsAvailable, currentStamps: d.currentStamps, totalStamps: d.totalStamps, mystery: d.mystery });
  const alertOk = d.appleAlert?.reward !== false;
  const reward: Field = {
    key: 'reward', label: head.label, value: head.value,
    ...(alertOk && head.kind === 'ready' ? { changeMessage: asChangeMessage(c.rewardMessage) } : {}),
    ...(alertOk && head.kind === 'box_waiting' ? { changeMessage: 'Your mystery box is ready! Tap ••• on your card, then Pass Details, to open it.' } : {}),
  };
  const go = toGo(d);
  const headerFields: Field[] = [{ key: 'to_go', label: go.label, value: go.value }];
  const primaryFields: Field[] = [reward];
  const secondaryFields: Field[] = [{ key: 'stamps', label: 'Stamps', value: stampCount(d) }];

  const backFields: Field[] = [];
  // Mystery box: "Ready to open" alerts once (above); revealing the prize on the web card
  // changes it to "You won …" silently. The back links to the web card, where it's opened.
  if (d.mystery && d.cardUrl && d.mystery.boxes.length) {
    const text = d.mystery.boxes.some((b) => !b.opened) ? 'Open your mystery box' : 'See your prize';
    backFields.push({ key: 'open_box', label: 'Mystery box', value: d.cardUrl, attributedValue: `<a href='${escapeHtml(d.cardUrl)}'>${text}</a>` });
  }
  // News and note only appear when set; each change of text notifies with the text itself.
  if (d.newsText) backFields.push({ key: 'news', label: `News from ${c.business}`, value: d.newsText, ...(d.appleAlert?.news === false ? {} : { changeMessage: '%@' }) });
  if (d.noteText) backFields.push({ key: 'note', label: 'Message', value: d.noteText, ...(d.appleAlert?.note === false ? {} : { changeMessage: '%@' }) });
  // Stamp status text ("You have {n} stamps"), deliberately without changeMessage.
  if (c.stampMessage) backFields.push({ key: 'stamp_status', label: 'Your card', value: c.stampMessage.replace(/\{n\}/g, String(d.currentStamps)) });
  if (c.reward.details) backFields.push({ key: 'reward_details', label: c.reward.name, value: c.reward.details });
  if (c.howToEarn) backFields.push({ key: 'how_to_earn', label: 'How to earn', value: c.howToEarn });
  c.links.forEach((l, i) => backFields.push(linkField(l, i)));
  if (c.terms) backFields.push({ key: 'terms', label: 'Terms', value: c.terms });
  backFields.push({ key: 'card_code', label: 'Card code', value: d.manualCode });

  const locations = c.locations.slice(0, 10).map((l) => ({
    latitude: l.lat,
    longitude: l.lon,
    ...(l.relevantText ? { relevantText: l.relevantText } : {}),
  }));

  return {
    formatVersion: 1 as const,
    passTypeIdentifier: cfg.passTypeIdentifier,
    teamIdentifier: cfg.teamIdentifier,
    serialNumber: d.serial,
    organizationName: cfg.organizationName ?? c.business,
    description: c.description || `${c.programName} loyalty card`,
    logoText: c.design.logoText || c.business,
    foregroundColor: hexToRgb(c.design.foreground, 'rgb(255, 255, 255)'),
    backgroundColor: hexToRgb(c.design.background, 'rgb(0, 0, 0)'),
    labelColor: hexToRgb(c.design.label, 'rgb(255, 255, 255)'),
    webServiceURL: cfg.webServiceURL,
    authenticationToken: d.appleAuthToken,
    barcodes: [{ format: 'PKBarcodeFormatQR' as const, message: d.qrPayload, messageEncoding: 'iso-8859-1', altText: d.manualCode }],
    ...(locations.length ? { locations } : {}),
    ...(d.status === 'deleted' || d.expired ? { voided: true } : {}),
    storeCard: { headerFields, primaryFields, secondaryFields, backFields },
  };
}

export type PassJson = ReturnType<typeof buildPassJson>;
