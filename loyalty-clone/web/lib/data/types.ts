// Domain types: shaped after replica/schema.sql (camelCase). The fake store and
// the future Postgres layer both return these, so screens never change.

export type Plan = 'starter' | 'growth' | 'pro';
export type PlanStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'locked';

export type User = { id: string; email: string; passwordHash: string; name: string };

export type Org = {
  id: string; name: string; timezone: string; country: string; defaultCurrency: string;
  website?: string; email?: string; phone?: string; addressLine1?: string; city?: string;
  plan: Plan; planStatus: PlanStatus; trialEndsAt: string; createdAt: string;
};

export type OrgMember = { orgId: string; userId: string; role: 'owner' | 'staff' };

export type FieldType = 'name' | 'email' | 'phone' | 'birthday' | 'text' | 'number' | 'date' | 'url';
export type FormField = { key: string; label: string; type: FieldType; required: boolean };
export type CardLink = { kind: 'url' | 'phone' | 'email' | 'address' | 'whatsapp' | 'instagram'; label: string; value: string };
export type CampaignStatus = 'draft' | 'live' | 'paused' | 'archived';

export type Campaign = {
  id: string; orgId: string; name: string; shortCode: string; status: CampaignStatus;
  totalStamps: number; programName: string; description: string; howToEarn: string;
  terms: string; hideTerms: boolean;
  stampMessage: string; rewardMessage: string; newsText?: string; newsUpdatedAt?: string;
  reward: { name: string; details: string; costCents?: number };
  /** 'mystery': a full card draws one of `prizes` by weight (migration 0008) */
  rewardMode: 'single' | 'mystery'; prizes: Prize[];
  design: { background: string; foreground: string; label: string; stamp: string; icon: string; logoText: string; logoUrl?: string; iconUrl?: string; stampUrl?: string };
  fields: FormField[]; links: CardLink[]; locationIds: string[];
  defaultCountry: string; consentEnabled: boolean; consentText: string;
  expiryMode: 'never' | 'fixed_date' | 'days_after_join'; expiryDate?: string; expiryDays?: number;
  stampCooldownMinutes: number; maxStampsPerTransaction: number; maxStampsPerDay: number;
  stampValueCents?: number; currency: string;
  activatedAt?: string; lastPushedAt?: string; createdAt: string; updatedAt: string;
};

export type Customer = {
  id: string; orgId: string; name: string; email?: string; phoneE164?: string;
  birthdayMonth?: number; birthdayDay?: number; extra: Record<string, string>;
  marketingConsent: boolean; consentAt?: string; deletedAt?: string; createdAt: string;
};

export type Card = {
  id: string; orgId: string; campaignId: string; customerId: string;
  serial: string; barcodeToken: string; previousBarcodeToken?: string; manualCode: string;
  status: 'active' | 'deleted'; currentStamps: number; rewardsAvailable: number;
  totalStampsEarned: number; totalRewardsEarned: number; totalRewardsRedeemed: number;
  lastStampAt: string | null; lastVisitAt: string; expiresAt: string | null;
  noteText?: string; appleInstalled: boolean; googleSaved: boolean; webCardSeenAt?: string;
  version: number; passModifiedAt: string; deletedAt?: string; createdAt: string;
};

export type EventType =
  | 'enrolled' | 'stamped' | 'unstamped' | 'reward_earned' | 'reward_redeemed'
  | 'apple_installed' | 'apple_removed' | 'google_saved' | 'google_removed'
  | 'message_sent' | 'card_restored' | 'card_deleted' | 'customer_updated';

export type CardEvent = {
  id: string; orgId: string; campaignId: string; cardId: string; type: EventType; quantity: number;
  source: 'scanner' | 'dashboard' | 'customer' | 'system'; actorLabel?: string;
  scannerDeviceId?: string; idempotencyKey?: string; createdAt: string;
};

export type Location = {
  id: string; orgId: string; name: string; address: string; lat: number; lon: number;
  addressOnCard: string; showOnCard: boolean; relevantText: string;
};

export type ScannerDevice = {
  id: string; orgId: string; label: string; tokenHash: string; locationId?: string;
  lastSeenAt?: string; revokedAt?: string; createdAt: string;
};
export type PairingCode = { code: string; orgId: string; label: string; locationId?: string; expiresAt: string };

export type Message = {
  id: string; orgId: string; campaignId: string; kind: 'broadcast' | 'birthday' | 'winback'; body: string;
  status: 'queued' | 'sending' | 'sent' | 'failed'; recipients: number; delivered: number; skipped: number;
  webCards: number; createdAt: string;
};

export type Automation = {
  id: string; orgId: string; campaignId: string; kind: 'birthday' | 'winback'; enabled: boolean;
  body: string; daysInactive?: number; sendHour: number; enabledAt?: string;
};

export type IdempotencyRecord = { orgId: string; key: string; requestHash: string; result: TxResult };

export type PrizeTier = 'common' | 'rare' | 'legendary';
export type Prize = { name: string; weight: number; tier: PrizeTier };
export type WonPrize = { name: string; tier: PrizeTier; /** the customer revealed it on their card (scan lookup only) */ opened?: boolean };
export type TxResult = { cardId: string; earned: number; redeemed: number; currentStamps: number; rewardsAvailable: number; replayed: boolean; prizesEarned: WonPrize[]; prizesRedeemed: WonPrize[] };

export type DB = {
  users: User[]; orgs: Org[]; members: OrgMember[]; campaigns: Campaign[]; customers: Customer[];
  cards: Card[]; events: CardEvent[]; locations: Location[]; devices: ScannerDevice[];
  pairingCodes: PairingCode[]; messages: Message[]; automations: Automation[];
  idempotency: IdempotencyRecord[]; notifications: { cardId: string; channel: 'apple' | 'google'; at: string }[];
  sessions: { token: string; userId: string; orgId: string; createdAt: string }[];
};

/** Public, customer-safe view of a card (architecture: first name only). */
export type PublicCard = {
  serial: string; firstName: string; currentStamps: number; rewardsAvailable: number; manualCode: string;
  qrPayload: string; noteText?: string; status: Card['status']; expired: boolean;
  campaign: Pick<Campaign, 'name' | 'programName' | 'totalStamps' | 'reward' | 'rewardMode' | 'design' | 'description' | 'howToEarn' | 'terms' | 'hideTerms' | 'links' | 'newsText' | 'status'> & { business: string };
  /** mystery box prizes won and not yet handed over, oldest first */
  prizes: (WonPrize & { id: string; opened: boolean })[];
  locations: Pick<Location, 'name' | 'addressOnCard'>[];
};
