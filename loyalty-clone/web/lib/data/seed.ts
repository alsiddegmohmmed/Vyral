// Development seed: one café in Kigali with a live coffee card, ~40 customers
// and 45 days of activity so every screen has real-looking data.
// Demo login (dev only, fake data layer): see DEMO_LOGIN below.
import { randomToken, uuid } from '@/lib/ids';
import { hashPassword } from './password';
import type { Campaign, Card, CardEvent, Customer, DB, Location, Message, Automation } from './types';

export const DEMO_LOGIN = { email: 'owner@cafe-neza.test', password: 'neza-demo-2026' };

const day = 86_400_000;
const iso = (t: number) => new Date(t).toISOString();

// deterministic pseudo-random so the seed is stable between resets
function rng(seed: number) { return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296); }

const NAMES = ['Aline Uwase', 'Eric Mugisha', 'Grace Iradukunda', 'Jean Bosco Habimana', 'Diane Mukamana', 'Patrick Nshuti',
  'Claudine Ingabire', 'Olivier Ndayisaba', 'Sandrine Umutoni', 'Emmanuel Niyonzima', 'Josiane Uwimana', 'Kevin Manzi',
  'Ange Kamikazi', 'Yves Ishimwe', 'Clarisse Mutesi', 'David Gatete', 'Esther Nyiraneza', 'Fabrice Hakizimana',
  'Gisele Umuhoza', 'Herve Tuyishime', 'Irene Uwera', 'Jules Mutabazi', 'Liliane Ikirezi', 'Moses Kayitare',
  'Nadine Uwamahoro', 'Paul Rwigema', 'Rose Mukeshimana', 'Samuel Bizimana', 'Teta Keza', 'Vanessa Iribagiza',
  'Wilson Ntwari', 'Yvette Nyampinga', 'Arnaud Shema', 'Belyse Uwineza', 'Cedric Nkurunziza', 'Denise Umurerwa',
  'Fiona Akaliza', 'Gael Mucyo', 'Honorine Abijuru', 'Isaac Ruzindana-Twagiramungu Bizimungu Nkusi Mugenzi'];

export function buildSeed(): DB {
  const now = Date.now();
  const r = rng(42);
  const userId = uuid(), orgId = uuid(), campaignId = uuid(), draftId = uuid();
  const loc1 = uuid(), loc2 = uuid();

  const locations: Location[] = [
    { id: loc1, orgId, name: 'Kimihurura', address: 'KG 7 Ave, Kigali', lat: -1.9536, lon: 30.0925, addressOnCard: 'KG 7 Ave, Kimihurura', showOnCard: true, relevantText: 'Café Neza is around the corner' },
    { id: loc2, orgId, name: 'Kigali Heights', address: 'KG 7 Ave, Kigali Heights', lat: -1.9532, lon: 30.0937, addressOnCard: 'Kigali Heights, ground floor', showOnCard: true, relevantText: 'Your coffee card works here too' },
  ];

  const baseCampaign = {
    orgId, programName: 'Café Neza', terms: 'One stamp per drink. Rewards can’t be exchanged for cash. Cards stay valid for 12 months after your last visit.',
    hideTerms: false, stampMessage: 'You have {n} stamps', rewardMessage: 'Your free coffee is ready!',
    defaultCountry: 'RW', consentEnabled: true, consentText: 'Send me news and offers from Café Neza. I can stop anytime.',
    expiryMode: 'never' as const, stampCooldownMinutes: 5, maxStampsPerTransaction: 5, maxStampsPerDay: 6,
    currency: 'RWF', createdAt: iso(now - 60 * day), updatedAt: iso(now - 2 * day),
    fields: [
      { key: 'name', label: 'Your name', type: 'name' as const, required: true },
      { key: 'phone', label: 'Phone', type: 'phone' as const, required: true },
      { key: 'birthday', label: 'Birthday', type: 'birthday' as const, required: false },
    ],
    links: [
      { kind: 'whatsapp' as const, label: 'Order on WhatsApp', value: '+250788000111' },
      { kind: 'instagram' as const, label: 'Instagram', value: 'cafeneza.kgl' },
    ],
  };

  const campaigns: Campaign[] = [
    {
      ...baseCampaign, id: campaignId, name: 'Coffee card', shortCode: 'neza1cup', status: 'live', totalStamps: 10,
      description: 'Collect a stamp with every drink. Your tenth one is on us.', howToEarn: 'Show this card when you pay. One stamp per drink.',
      newsText: 'Double stamps every Friday this month.', newsUpdatedAt: iso(now - 3 * day),
      reward: { name: 'Free coffee', details: 'Any hot drink, any size.', costCents: 150000 },
      design: { background: '#1F3B2C', foreground: '#F1EAD8', label: '#C9D6A3', stamp: '#F1EAD8', icon: 'cup', logoText: 'café neza' },
      locationIds: [loc1, loc2], stampValueCents: 250000, activatedAt: iso(now - 55 * day),
    },
    {
      ...baseCampaign, id: draftId, name: 'Pastry club', shortCode: 'neza2pas', status: 'draft', totalStamps: 6,
      description: '', howToEarn: '', reward: { name: 'Free croissant', details: '' },
      design: { background: '#5B2A1C', foreground: '#FFF4E6', label: '#F4C9A8', stamp: '#FFF4E6', icon: 'croissant', logoText: 'café neza' },
      locationIds: [], createdAt: iso(now - 4 * day), updatedAt: iso(now - 4 * day),
    },
  ];

  const customers: Customer[] = [];
  const cards: Card[] = [];
  const events: CardEvent[] = [];
  NAMES.forEach((name, i) => {
    const joined = now - Math.floor(r() * 45 * day) - day;
    const cust: Customer = {
      id: uuid(), orgId, name, phoneE164: `+25078${String(1000000 + i * 7919).slice(0, 7)}`,
      email: i % 3 === 0 ? `${name.split(' ')[0].toLowerCase()}@example.test` : undefined,
      birthdayMonth: i % 4 === 0 ? new Date(now).getUTCMonth() + 1 : 1 + Math.floor(r() * 12),
      birthdayDay: i % 4 === 0 ? new Date(now + (i % 8) * day).getUTCDate() : 1 + Math.floor(r() * 28),
      extra: {}, marketingConsent: r() > 0.3, consentAt: iso(joined), createdAt: iso(joined),
    };
    customers.push(cust);
    const cardId = uuid();
    let current = 0, rewards = 0, earned = 0, rEarned = 0, redeemed = 0, lastStamp: number | null = null;
    events.push({ id: uuid(), orgId, campaignId, cardId, type: 'enrolled', quantity: 1, source: 'customer', createdAt: iso(joined) });
    const visits = i === 2 ? 0 : Math.floor(r() * 14);
    let t = joined;
    for (let v = 0; v < visits; v++) {
      t += Math.floor(r() * 5 * day) + 3_600_000;
      if (t > now - 3_600_000) break;
      const q = r() > 0.8 ? 2 : 1;
      current += q; earned += q; lastStamp = t;
      events.push({ id: uuid(), orgId, campaignId, cardId, type: 'stamped', quantity: q, source: 'scanner', actorLabel: 'Front counter', createdAt: iso(t) });
      if (current >= 10) {
        current -= 10; rewards++; rEarned++;
        events.push({ id: uuid(), orgId, campaignId, cardId, type: 'reward_earned', quantity: 1, source: 'scanner', actorLabel: 'Front counter', createdAt: iso(t) });
      }
      if (rewards > 0 && r() > 0.5) {
        rewards--; redeemed++;
        events.push({ id: uuid(), orgId, campaignId, cardId, type: 'reward_redeemed', quantity: 1, source: 'scanner', actorLabel: 'Front counter', createdAt: iso(t + 60_000) });
      }
    }
    const wallet = r();
    cards.push({
      id: cardId, orgId, campaignId, customerId: cust.id, serial: randomToken(16), barcodeToken: randomToken(16),
      manualCode: randomToken(5), status: 'active', currentStamps: current, rewardsAvailable: rewards,
      totalStampsEarned: earned, totalRewardsEarned: rEarned, totalRewardsRedeemed: redeemed,
      lastStampAt: lastStamp ? iso(lastStamp) : null, lastVisitAt: iso(lastStamp ?? joined), expiresAt: null,
      appleInstalled: wallet < 0.35, googleSaved: wallet >= 0.35 && wallet < 0.6,
      webCardSeenAt: iso(now - Math.floor(r() * 20) * day), version: 1, passModifiedAt: iso(lastStamp ?? joined), createdAt: iso(joined),
    });
  });
  // the demo customer used in screenshots: 9 of 10, ready to complete
  const aline = cards[0];
  Object.assign(aline, { currentStamps: 9, rewardsAvailable: 1, lastStampAt: iso(now - 2 * day), lastVisitAt: iso(now - 2 * day), appleInstalled: true, googleSaved: false });

  const messages: Message[] = [
    { id: uuid(), orgId, campaignId, kind: 'broadcast', body: 'Double stamps every Friday this month.', status: 'sent', recipients: 23, delivered: 21, skipped: 2, webCards: 9, createdAt: iso(now - 3 * day) },
    { id: uuid(), orgId, campaignId, kind: 'birthday', body: 'Happy birthday {name}! Your next drink is on us this week.', status: 'sent', recipients: 2, delivered: 2, skipped: 0, webCards: 0, createdAt: iso(now - 9 * day) },
  ];
  const automations: Automation[] = [
    { id: uuid(), orgId, campaignId, kind: 'birthday', enabled: true, body: 'Happy birthday {name}! Your next drink is on us this week.', sendHour: 10, enabledAt: iso(now - 40 * day) },
    { id: uuid(), orgId, campaignId, kind: 'winback', enabled: false, body: 'We miss you, {name}. Come by this week for a double stamp.', daysInactive: 30, sendHour: 10 },
  ];

  return {
    users: [{ id: userId, email: DEMO_LOGIN.email, passwordHash: hashPassword(DEMO_LOGIN.password), name: 'Neza Owner' }],
    orgs: [{ id: orgId, name: 'Café Neza', timezone: 'Africa/Kigali', country: 'RW', defaultCurrency: 'RWF', email: 'hello@cafe-neza.test', phone: '+250788000111', addressLine1: 'KG 7 Ave', city: 'Kigali', plan: 'growth', planStatus: 'trialing', trialEndsAt: iso(now + 9 * day), createdAt: iso(now - 60 * day) }],
    members: [{ orgId, userId, role: 'owner' }],
    campaigns, customers, cards, events, locations,
    devices: [{ id: uuid(), orgId, label: 'Front counter', tokenHash: 'seed-device-without-token', locationId: loc1, lastSeenAt: iso(now - 2 * day), createdAt: iso(now - 50 * day) }],
    pairingCodes: [], messages, automations, idempotency: [], notifications: [], sessions: [],
  };
}
