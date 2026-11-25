// Contracts between the data layer (lib/data/*) and the integration modules
// (lib/billing/*, lib/wallet/*). Integrations never touch SQL; they call these
// functions, which the data layer implements against Postgres.

// ------------------------------------------------------------------ billing

export type BillingProvider = 'paddle' | 'flutterwave';
export type Plan = 'starter' | 'growth' | 'pro';
export type Interval = 'month' | 'year';

/** A provider event, normalised. Applied idempotently by applyBillingUpdate. */
export type BillingUpdate =
  | {
      kind: 'subscription';
      provider: BillingProvider;
      eventId: string;            // provider event id (dedupe key)
      occurredAt: string;         // ISO; older events than the stored one are ignored
      orgId: string;              // from custom_data / meta we set at checkout
      providerCustomerId?: string;
      providerSubscriptionId?: string;
      plan: Plan;
      interval: Interval;
      status: 'active' | 'past_due' | 'cancelled';
      currentPeriodStart: string;
      currentPeriodEnd: string;
      cancelAtPeriodEnd: boolean;
    }
  | {
      kind: 'payment';            // one invoice paid (Flutterwave prepaid periods, Paddle transactions)
      provider: BillingProvider;
      eventId: string;
      occurredAt: string;
      orgId: string;
      invoiceId?: string;         // our invoice id when we created one (Flutterwave tx_ref)
      providerRef: string;        // provider transaction id
      amountMinor: number;
      currency: string;
      status: 'paid' | 'failed';
    }
  | { kind: 'ignored'; provider: BillingProvider; eventId: string; reason: string };

export type CheckoutRequest = {
  orgId: string; orgName: string; email: string; plan: Plan; interval: Interval;
  currency: 'USD' | 'RWF'; amountMinor: number; invoiceId?: string; returnUrl: string;
};
export type CheckoutResult = { url: string } | { error: 'not_configured' | 'provider_error'; message: string };

// ------------------------------------------------------------------ wallet

/** Everything needed to build an Apple pass or a Google object for one card. */
export type WalletPassData = {
  cardId: string;
  serial: string;
  appleAuthToken: string;
  qrPayload: string;            // signed v1.<token>.<mac>
  manualCode: string;
  firstName: string;
  status: 'active' | 'deleted';
  expired: boolean;
  currentStamps: number;
  rewardsAvailable: number;
  totalStamps: number;
  noteText?: string;            // birthday / win-back / farewell (back field with changeMessage)
  newsText?: string;            // campaign broadcast (back field with changeMessage)
  passModifiedAt: string;       // ISO, Apple Last-Modified
  /**
   * Apple decides whether to alert from the pass CONTENT (changeMessage), not the push.
   * A flag is true only when a notification slot was claimed for that change, so a card
   * over its daily budget updates silently. Undefined = alerts allowed (tests, previews).
   */
  appleAlert?: { reward: boolean; news: boolean; note: boolean };
  campaign: {
    id: string; name: string; programName: string; business: string;
    googleClassId?: string;
    description: string; howToEarn: string; terms: string;
    stampMessage: string;       // "You have {n} stamps" (silent)
    rewardMessage: string;      // notification when a reward is earned
    reward: { name: string; details: string };
    design: { background: string; foreground: string; label: string; stamp: string; icon: string; logoText: string };
    links: { kind: string; label: string; value: string }[];
    locations: { name: string; lat: number; lon: number; addressOnCard: string; relevantText: string }[]; // max 10
  };
};
