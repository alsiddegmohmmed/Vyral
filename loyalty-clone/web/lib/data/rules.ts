// Pure stamping rules: a TypeScript mirror of apply_card_transaction in
// replica/schema.sql (same rules, same error keys). No imports, so Node can run
// the tests directly (type stripping). When the real Postgres layer lands,
// the SQL function is the source of truth and these tests keep both honest.

export type TxSource = 'scanner' | 'dashboard';

export type TxCard = {
  status: 'active' | 'deleted';
  currentStamps: number;
  rewardsAvailable: number;
  totalStampsEarned: number;
  totalRewardsEarned: number;
  totalRewardsRedeemed: number;
  lastStampAt: string | null;
  expiresAt: string | null;
};

export type TxCampaign = {
  status: 'draft' | 'live' | 'paused' | 'archived';
  totalStamps: number;
  maxStampsPerTransaction: number;
  stampCooldownMinutes: number;
  maxStampsPerDay: number;
};

export type TxInput = { stamps: number; redeem: number; source: TxSource };

export type TxErrorKey =
  | 'empty_transaction' | 'invalid_redeem' | 'card_deleted' | 'card_expired' | 'campaign_not_live'
  | 'too_many_stamps' | 'cooldown_active' | 'daily_limit_reached' | 'not_enough_stamps' | 'no_reward_available' | 'box_not_opened';

export type TxOutcome =
  | { ok: true; earned: number; redeemed: number; card: TxCard; rotateBarcode: boolean }
  | { ok: false; error: TxErrorKey };

/** netStampsLast24h = stamped minus unstamped on this card in the last 24 h. */
export function applyTransaction(
  card: TxCard, campaign: TxCampaign, input: TxInput, now: Date, netStampsLast24h: number,
): TxOutcome {
  const { stamps, redeem, source } = input;
  if (stamps === 0 && redeem === 0) return { ok: false, error: 'empty_transaction' };
  if (redeem < 0 || !Number.isInteger(redeem) || !Number.isInteger(stamps)) return { ok: false, error: 'invalid_redeem' };
  if (card.status !== 'active') return { ok: false, error: 'card_deleted' };

  if (source === 'scanner') {
    if (card.expiresAt && new Date(card.expiresAt) <= now) return { ok: false, error: 'card_expired' };
    if (campaign.status !== 'live') return { ok: false, error: 'campaign_not_live' };
    if (Math.abs(stamps) > campaign.maxStampsPerTransaction) return { ok: false, error: 'too_many_stamps' };
    if (stamps > 0 && campaign.stampCooldownMinutes > 0 && card.lastStampAt &&
        now.getTime() - new Date(card.lastStampAt).getTime() < campaign.stampCooldownMinutes * 60_000) {
      return { ok: false, error: 'cooldown_active' };
    }
    if (stamps > 0 && campaign.maxStampsPerDay > 0 && netStampsLast24h + stamps > campaign.maxStampsPerDay) {
      return { ok: false, error: 'daily_limit_reached' };
    }
  } else if (Math.abs(stamps) > 100 || redeem > 100) {
    return { ok: false, error: 'too_many_stamps' };
  }

  let current = card.currentStamps + stamps;
  let earned = 0;
  if (stamps < 0) {
    if (current < 0) return { ok: false, error: 'not_enough_stamps' };
  } else {
    earned = Math.floor(current / campaign.totalStamps);
    current = current % campaign.totalStamps;
  }
  if (redeem > card.rewardsAvailable + earned) return { ok: false, error: 'no_reward_available' };

  const nowIso = now.toISOString();
  return {
    ok: true,
    earned,
    redeemed: redeem,
    rotateBarcode: redeem > 0,
    card: {
      ...card,
      currentStamps: current,
      rewardsAvailable: card.rewardsAvailable + earned - redeem,
      totalStampsEarned: Math.max(card.totalStampsEarned + stamps, 0),
      totalRewardsEarned: card.totalRewardsEarned + earned,
      totalRewardsRedeemed: card.totalRewardsRedeemed + redeem,
      lastStampAt: stamps > 0 ? nowIso : card.lastStampAt,
    },
  };
}

/** Plain-language messages for scanner and dashboard (our copy). */
export const txErrorMessage: Record<TxErrorKey | 'card_not_found' | 'card_replaced' | 'invalid_code', string> = {
  empty_transaction: 'Choose stamps to add or a reward to give.',
  invalid_redeem: 'That amount isn’t valid.',
  card_deleted: 'This card was deleted by the business.',
  card_expired: 'This card has expired.',
  campaign_not_live: 'This card’s programme is paused.',
  too_many_stamps: 'That’s more stamps than one visit allows.',
  cooldown_active: 'This card was stamped a moment ago. Try again in a few minutes.',
  daily_limit_reached: 'This card has had today’s maximum stamps.',
  not_enough_stamps: 'The card doesn’t have that many stamps to remove.',
  no_reward_available: 'There’s no reward ready on this card.',
  box_not_opened: 'The customer hasn’t opened their mystery box yet. Ask them to open it on their card, then scan again.',
  card_not_found: 'We couldn’t find this card. It may belong to another business.',
  card_replaced: 'This card was replaced. Ask the customer to open their latest card and scan again.',
  invalid_code: 'That code isn’t one of our cards.',
};

/** Birthday matching in the org's local date; Feb 29 sends on Feb 28 in non-leap years. */
export function isBirthdayToday(month: number, day: number, localYear: number, localMonth: number, localDay: number): boolean {
  const leap = (localYear % 4 === 0 && localYear % 100 !== 0) || localYear % 400 === 0;
  if (month === 2 && day === 29 && !leap) return localMonth === 2 && localDay === 28;
  return month === localMonth && day === localDay;
}
