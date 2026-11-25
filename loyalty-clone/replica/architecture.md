# Architecture: loyalty clone v1 (a rebuild of Loopy Loyalty's core features)

Working name: "the loyalty clone". The real name comes from /replica-brand.
Date: 2026-11-25. Inputs: `recon.md`, `features.csv` (must = v1), and two research reports (Apple Wallet + web scanner; Google Wallet + billing). Their key findings are cited inline as **[A]** and **[G]**.

## Decisions at a glance

1. **Every customer gets a web card. The wallets are upgrades.** Google Wallet passes work in Rwanda [G §5], but they need Android 9+, Google Play services and the Wallet app. Many Kigali phones fail one of those, and Huawei phones fail all three. So the join flow always ends on our own web card page (`/c/{serial}`) with a live QR code and stamp grid, which can be added to the home screen. "Add to Apple Wallet" and "Save to Google Wallet" sit on top of that page. This is a change from Loopy, which assumes a wallet. It's also one of our selling points.
2. **One Next.js app, one Postgres, one queue.** No microservices.
3. **Stamps change only through one SQL function**, `apply_card_transaction`. It locks the card row, is idempotent (a replay returns the original result) and writes the ledger. It's tested: 75/75 in `tests/schema.test.mjs`, including a regression test for every SQL issue the independent review found.
7. **Counter phones are paired, never signed in as the owner.** The owner scans a pairing QR on each shop phone, and the phone gets a revocable scanner-only token that can't reach billing, settings or customers. The audit log names the device ("Front counter").
4. **Messages respect a notification budget.** Google allows only 3 notifying updates per pass per rolling 24 hours [G §3], and Apple throttles without publishing limits [A §3]. We enforce 3 per pass per day on both, in our scheduler.
5. **Billing:** Stripe isn't available in Rwanda [G §7].
   - International card customers pay through **Paddle**, as merchant of record.
   - Kigali merchants pay with MTN MoMo or Airtel Money through **Flutterwave**. We bill each prepaid period ourselves.
   - Our own `subscriptions` table decides what a merchant can use.
6. **Barcode = signed, rotating token.** The QR carries `v1.<token>.<hmac>`. The token rotates on every redemption, and the scanner enforces a cooldown and a daily cap [A §7].

## Stack

| layer | choice | why |
| --- | --- | --- |
| web app | **Next.js 16 (App Router) + TypeScript** | The founder's site already runs on it, so there's one framework to know. Server actions handle dashboard writes and route handlers handle the Apple, Google and billing endpoints. |
| runtime | **Node.js runtime on all wallet routes (not Edge)** | passkit-generator needs node-forge, and the APNs push needs `http2` [A §2–3]. |
| styling | Tailwind CSS v4 with tokens from /replica-design | Fast, and themeable per merchant on the enrolment and web-card pages. |
| scanner | **PWA route `/scan` in the same app**, scanning with `barcode-detector` (native BarcodeDetector, falling back to zxing-wasm that we host ourselves) | iOS Safari has no native BarcodeDetector [A §6]. html5-qrcode is in maintenance mode. Hosting the WASM ourselves keeps it working under our CSP and when the network is poor. |
| database | **Postgres 15+ on Supabase** | One managed service gives us Postgres, Auth and Storage. The schema uses only standard Postgres plus pgcrypto, citext and pg_trgm. |
| ORM | **Drizzle** (types generated from `schema.sql`) | SQL-first. `apply_card_transaction` stays in SQL, called through `db.execute`. |
| auth | **Supabase Auth** (email + password, magic link, Google sign-in) | Loopy has no social login, which is a gap. Sessions are cookies via `@supabase/ssr`. |
| access rules | **Data-layer checks. RLS is on with no policies.** | The browser never talks to Supabase directly. All reads and writes go through server code with the service role, and every query is scoped by `org_id` (see "Access rules"). RLS-with-no-policies means a leaked anon key exposes nothing. |
| files | **Supabase Storage** (public bucket for pass images, private bucket for uploads) | Logos and strips need stable HTTPS URLs that Google can fetch [G §2], and Apple needs bytes when it builds the pass. |
| images | **`@resvg/resvg-js`**: SVG templates rendered to PNG, cached per `(campaign, design_version, stamps)` | A stamp strip depends only on the stamp count, so a 10-stamp card has 11 images per design version. Render once, serve from the CDN with content-hashed paths. |
| Apple Wallet | **passkit-generator 3.7** (MIT, TypeScript), WWDR **G4** intermediate, one **organisation** Apple Developer account, one Pass Type ID | It's maintained (Oct 2026 release) and runs on Vercel Node [A §2]. |
| APNs | Node `http2`, pass certificate auth, production only, one session per batch | The sandbox doesn't deliver pass pushes, and `.p8` token auth is unconfirmed for passes [A §3]. |
| Google Wallet | `googleapis` walletobjects + `jsonwebtoken` (RS256), one issuer account, **one LoyaltyClass per campaign**, skinny-JWT save links | Branding lives on the class, and save URLs must stay under 1800 characters [G §2]. |
| jobs / queue | **Inngest** | Fan-out with retries, per-key concurrency limits (Google: 20 requests per second [G §3]), debounce (several stamps make one pass push) and cron. Vercel functions alone would time out on a 5,000-pass broadcast. |
| email | **Resend** (also as Supabase Auth's SMTP) | Merchant mail only: auth, trial ending, invoices, export ready. v1 never emails customers. |
| SMS / WhatsApp | **Not in v1.** Planned: Africa's Talking for SMS in Rwanda, WhatsApp Cloud API | This is the fallback channel for web-card customers (should). v1 web cards show messages on the page itself. |
| payments | **Paddle** (international, merchant of record, 5% + $0.50) **+ Flutterwave Rwanda** (MoMo 3.5%, cards 4.8%) behind a `billing` module | See "Payments". Lemon Squeezy shuts down on 31 Mar 2027, and Stripe Atlas waits until there's a reason [G §7–8]. |
| maps | Google Places Autocomplete (Maps JavaScript API), with our own key | Turns an address into lat/lon for locations. |
| hosting | **Vercel** (Pro, for longer functions and cron) | Same as the site. Apple's `webServiceURL` needs one stable HTTPS domain. |
| monitoring | Sentry, plus an Inngest dashboard and a nightly reconcile job | Wallet failures are silent, so we have to look for them. |

## Domains and surfaces

- **Dashboard:** `app.<domain>`, at `/` (S01–S21, S35).
- **Public pages:** `<domain>/j/{short_code}` for the join page (S22) and `<domain>/c/{serial}` for the web card (S23, S26).
- **Scanner:** `app.<domain>/scan` (S27–S34), installable as a PWA on a single route with no hash routing, so iOS doesn't keep re-asking for camera permission [A §6].
- **Apple web service:** `api.<domain>/apple`, with `/v1/...` under it. Same app, one rewrite.
- **Webhooks:** `api.<domain>/webhooks/{paddle|flutterwave|google}`.

## Schema

**Tables: 23.** The full DDL is in **`schema.sql`**, and its tests are in **`tests/schema.test.mjs`** (75 checks, run against real Postgres in PGlite).

| area | tables |
| --- | --- |
| tenants | `orgs`, `org_members` (role owner \| staff; staff logins come later), `scanner_devices` (paired counter phones, in v1) |
| programme | `campaigns`, `rewards` (v1 creates exactly one), `campaign_fields`, `campaign_links`, `locations`, `campaign_locations` (at most 10, enforced by a trigger) |
| people and cards | `customers` (one per person per org, deduped on email and on phone), `cards` (one active card per customer per campaign) |
| ledger | `card_events` (append-only; only personal and actor fields may be nulled), `idempotency_keys` (request fingerprint plus stored result) |
| wallets | `apple_devices`, `apple_registrations`, `pass_notifications` (the notification budget) |
| messaging | `messages`, `message_deliveries`, `automations`, `automation_sends` (the never-send-twice table) |
| billing | `subscriptions`, `invoices` |
| infra | `webhook_events` (dedupe for every inbound webhook) |

Every table follows the same rules: uuid primary keys, `created_at` and `updated_at` timestamps, and `org_id` on everything a merchant owns. Every foreign key has a deliberate `on delete` rule, which is `cascade` from the org down and `set null` for actors and locations in the ledger. Every status column has a check constraint. All times are `timestamptz` in UTC. Money is stored as integer minor units plus a currency; RWF is stored in whole francs.

### What the database guarantees, so the UI doesn't have to

| rule | how |
| --- | --- |
| Two staff scanning the same card at once can't double-count | `select … for update` on the card row inside `apply_card_transaction` |
| A retried Submit on a bad connection stamps once, and shows the same result | The `idempotency_keys` primary key `(org_id, key)` is claimed first, which serialises duplicates. A replay returns the **original** result (`earned`, `redeemed`) with `replayed: true`. The same key with a different request raises `idempotency_key_reused`. A failed attempt rolls its key back, so a retry runs normally. |
| Tenant integrity in the database, not just the data layer | Composite foreign keys `(org_id, campaign_id)`, `(org_id, customer_id)` and `(org_id, card_id)` mean a card, event, message or automation can't mix orgs, even through a data-layer bug |
| A 10-stamp card at 9 stamps plus 3 more gives 1 reward and 2 stamps | Overflow carries over, which is our decision; Loopy's docs don't say |
| You can't remove stamps you don't have or redeem a reward you haven't earned | `not_enough_stamps` and `no_reward_available` errors |
| Scanner abuse | `max_stamps_per_transaction` (default 5), `stamp_cooldown_minutes` and `max_stamps_per_day`. The daily cap is a rolling 24 hours, **net of corrections**. These apply to the scanner only. |
| The owner can always fix a card | Dashboard transactions skip the paused-campaign, expired-card and cap checks, with a typo guard of 100 per transaction. Deleted cards stay dead. Removing stamps also lowers the lifetime total, so corrections don't inflate insights. |
| Old screenshots stop working | Redemption rotates `barcode_token`. The old token is kept in `previous_barcode_token` so the scanner can say "This card was replaced. Ask the customer to open their latest card." |
| A deleted card is dead | `status = 'deleted'`. The scanner rejects it, and its unique email or phone is freed. |
| One card per customer per campaign | Partial unique index on active cards |
| No duplicate customers | Partial unique indexes on `(org_id, email)` and `(org_id, phone_e164)`. Emails are citext, so matching ignores case. |
| A birthday message goes out at most once a year, and a win-back once per lapse | `automation_sends` unique on `(automation_id, card_id, period_key)` |
| A broadcast retry never double-sends | `message_deliveries` unique on `(message_id, card_id, channel)` |
| An invoice can't be raised twice for the same period | `invoices` unique on `(subscription_id, period_start)` |
| Apple's "what changed since tag X" never misses a pass | `cards.pass_modified_at` is bumped by a trigger on visible changes, and explicitly by campaign-level pushes (design, news). The tag we hand out is the request time. `apple_updated_serials(device, tag)` re-sends anything modified within 120 s before the tag, which covers transactions that committed late. Re-sending is harmless because Apple re-fetches and gets a 304. `Last-Modified` is `pass_modified_at`, and web-card views never touch it (`web_card_seen_at` is written at most once an hour). |
| The ledger can't be edited | The `card_events` trigger allows only nulling of `actor_user_id`, `location_id`, `ip`, `user_agent` and `scan_lat`/`scan_lon`. That covers user or location deletes and the privacy scrub. Every other field is frozen, and `actor_label` and `location_name` are kept so the history still reads correctly. |
| The notification budget can't be overrun | `claim_notification_slot(card, channel, reason)` takes a per-card advisory lock, counts the last 24 hours and inserts the slot in one step. Every sender calls it before talking to Apple or Google. |
| A bad timezone can't break automations for everyone | A trigger validates `orgs.timezone` against `pg_timezone_names` |
| Supabase RPC can't call our functions | `revoke execute … from public, anon, authenticated` |
| Account deletion removes everything (GDPR) | Cascade from `orgs`; tested |

### Access rules

- **Server only.** The browser never holds a database credential. Supabase is used for Auth sessions (cookie) and Storage (signed upload URLs). Every database read and write runs in server code through one module, `lib/db/scoped.ts`.
- **`getOrgContext()`** reads the session, loads `org_members` for the user, and returns `{orgId, userId, role}`. Every data function takes that context and adds `where org_id = ctx.orgId`. A lint rule bans importing the raw Drizzle client outside `lib/db/`.
- **Role checks:** `owner` can do everything.
  - A **paired scanner device** (header `Authorization: Scanner <token>`; we store only its sha256 in `scanner_devices.token_hash`) can call only `/api/scan/*`, and only for its own org.
  - `staff` logins (later) get the same scope.
- **Public routes** (`/j/*`, `/c/*`, Apple `/v1/*`, webhooks) authenticate with what they hold: a short code, a serial, an Apple auth token, or a webhook signature. They never accept an `org_id` from the client.
- **RLS** is enabled on all 23 tables with no policies, so the anon key reads nothing. This is defence in depth, not the primary check.

## API

These are server actions (SA) or route handlers (RH). "Owner" means a signed-in member with role owner. Every owner route is org-scoped.

### Merchant account (F01, F14)

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| SA `signUp` | Creates a user, an org (trialing, 15 days) and the owner membership. Login is **email** (or Google), not Loopy's username. The scanner doesn't need one because devices are paired. | public | email, password, business name, country, timezone (detected from the browser, validated) | session, redirect to `/` | F01 |
| SA `signIn` / `resetPassword` / Google OAuth | Supabase Auth | public | — | session | F01 |
| RH `GET /auth/callback` | OAuth / magic-link exchange | public | code | redirect | F01 |
| SA `updateOrg` | Saves business details (printed on the back of the pass) and timezone | owner | org fields | org | S20 |
| SA `deleteAccount` | Cancels billing and sets `orgs.deletion_scheduled_at` = +7 days, so it can be undone until then. The `privacy/scrub` job then deletes the org (cascade). | owner | confirm text | — | S20 |

### Card designer (F02, F03)

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| SA `createCampaign` | Creates a draft with defaults: 10 stamps, 1 reward, fields name/phone/birthday, consent on | owner (checks the plan's design limit) | name | campaign | S03→S04 |
| SA `updateCampaign` | Patches design, text, expiry, form and consent. Rejects locked fields when live (`card_type`, `total_stamps`, reward `stamps_required`, expiry, unique fields). Bumps `design_version` on visual change. | owner | partial campaign (zod) | campaign + validation errors | S04–S09 |
| SA `upsertReward` | v1: the single reward's name, details and cost | owner | reward | reward | S05 |
| SA `setFormFields` | Replaces the field list. Warns before data loss when a field is removed. | owner | fields[] | fields | S08 |
| SA `setLinks` | Card-back links | owner | links[] | links | S05 |
| SA `getUploadUrl` | Signed Storage upload URL. Afterwards the server checks type, size (≤ 2 MB), dimensions and transparency. | owner | kind (logo \| icon \| strip \| stamp \| unstamp) | url, path | S04 |
| RH `GET /api/campaigns/{id}/preview` | Live preview data: Apple front and back, Google, web card. Strip PNG via `?stamps=n`. | owner | stamps | json / png | S04–S09 |
| RH `GET /api/campaigns/{id}/preview.pkpass` | **A real, signed preview pass** on our own preview serial. Unlike Loopy's, it can be stamped from the dashboard, which removes their #1 support issue. | owner | — | pkpass | S10 |
| SA `activateCampaign` | Checks the plan, that the trial is active or paid, and that a unique name, a reward and a logo exist. Sets `live` and `activated_at`. Creates the Google LoyaltyClass. Renders the strip set. | owner | campaignId | campaign | S11, F02 |
| SA `pushCampaignUpdate` | 10-minute cooldown (`last_pushed_at`). Patches the Google class. Queues `campaign/updated`. | owner | campaignId | queued count | S12, F03 |
| SA `pauseCampaign` / `archiveCampaign` | Paused stops joining and stamping; archived hides it | owner | campaignId | campaign | S03 |
| RH `GET /api/campaigns/{id}/qr.{png,svg}` and `/poster.pdf` | QR of `/j/{short_code}`, plus an A5 counter poster | owner | — | file | S12 |

### Locations (F10)

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| SA `upsertLocation` / `deleteLocation` | Account-level locations, with lat/lon from Places | owner (checks the plan's location limit) | name, address, lat, lon, address_on_card, relevant_text | location + "affects N cards" | S18 |
| SA `setCampaignLocations` | Attaches up to 10 locations (database trigger), patches the Google class `merchantLocations`, queues a silent pass update | owner | campaignId, locationIds[] | — | S06 |

### Public: join, web card, wallets (F04, F05, F26)

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| RH `GET /j/{short_code}` | Join page in the merchant's branding. Shows a "Paused/closed" state when not live. | public | — | html | S22 |
| RH `POST /api/j/{short_code}` | Validates the dynamic form (zod schema built from `campaign_fields`; **every form requires email or phone**, enforced in the database) and the consent box. **Cloudflare Turnstile on every submit** is the main gate. The per-IP limit is generous (30 per minute), because Rwandan carriers put many phones behind one IP, and there's no hard per-campaign cap, just an alert at unusual volume. Matching is by email first, then phone. **If the person already exists, nothing about them changes and no card is returned.** The response says "You already have a card — we've sent the link to the email/phone on file", using the restore path. That response is the same whether or not they exist, so the page can't be used to check whether someone is a customer. A new person gets a customer, a card, an `enrolled` event and `expires_at` from the expiry mode. | public | form values, consent, tz offset, Turnstile token | `{cardUrl}` (new) or `{sent: true}` | F04, F26 |
| RH `GET /c/{serial}` | **The web card.** Live QR, stamp grid, rewards, latest message, card-back info, and wallet buttons (detects the OS; on desktop shows a QR to open it on a phone). Includes a web manifest for add-to-home-screen. Polls every 15 s while it's open. **Shows the customer's first name only, never their email, phone or birthday.** The serial is 128-bit random, the page sends `noindex` and `Referrer-Policy: no-referrer`, and requests are rate-limited per IP against enumeration. | holder of the link | — | html | S23–S25, S26 |
| RH `GET /c/{serial}/apple` | Builds and signs the `.pkpass` | holder | — | `application/vnd.apple.pkpass` | F04 |
| RH `GET /c/{serial}/google` | Inserts the LoyaltyObject if it's missing, then redirects to `https://pay.google.com/gp/v/save/{skinnyJWT}` | holder | — | 302 | F04 |
| RH `POST /api/c/{serial}/restore` | "Lost your card?" Sends the link by email; SMS comes later. Never reveals whether an address exists. | public | email or phone | 202 | S26 |

### Apple PassKit web service (exact paths from Apple [A §3])

Base URL: `https://api.<domain>/apple`. Auth is `Authorization: ApplePass <cards.apple_auth_token>`.

| method path | does | status |
| --- | --- | --- |
| `POST /v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}/{serialNumber}` | Upserts `apple_devices` (push token) and `apple_registrations`, sets `apple_installed`, writes an `apple_installed` event | 201 new, 200 existing, 401 |
| `GET /v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}?passesUpdatedSince={tag}` | `apple_updated_serials(device, tag)`: this device's passes modified since `tag − 120 s`. `lastUpdated` = the request time in epoch ms. | 200, 204 |
| `GET /v1/passes/{passTypeIdentifier}/{serialNumber}` | Rebuilds and signs the current pass. `Last-Modified` = `cards.pass_modified_at`. Returns 304 on `If-Modified-Since`. | 200, 304, 401 |
| `DELETE /v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}/{serialNumber}` | Removes the registration. When the card has none left: `apple_installed = false` and an `apple_removed` event. Deletes the device when it has no passes. | 200, 401 |
| `POST /v1/log` | Writes to Sentry (breadcrumbs, sampled) | 200 |

### Scanner (F05–F07)

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| SA `createPairingCode` | Makes a one-time pairing QR, valid for 10 minutes, labelled with the device name and optional location | owner | label, locationId? | QR | S19 (v1-lite: device list, pair, revoke) |
| RH `POST /api/scan/pair` | The counter phone exchanges the pairing code for a long-lived device token, shown once and kept in the PWA's storage. We store its sha256. | public + pairing code | code | token | S27 |
| SA `revokeDevice` | Sets `revoked_at`, so the device's next call gets 401 | owner | deviceId | — | S19 |
| RH `POST /api/scan/lookup` | Verifies the HMAC first, so a forged QR costs no database work. Finds the card by `barcode_token`, by `previous_barcode_token` (to show "card replaced"), or by the 8-character `manual_code` typed by staff. Returns first name, stamps, rewards, last visit and the campaign rules. | owner / paired device | `{code}` or `{manualCode}` | card summary or error key | S28→S29 |
| RH `POST /api/scan/transaction` | Calls `apply_card_transaction(source='scanner', scanner_device_id)`, then queues `pass/changed`. Shows "Reward earned!" from the returned `earned`, which is also correct on a replay. | owner / paired device | `{cardId, stamps, redeem, idempotencyKey, lat?, lon?}`. The client makes a **new** uuid every time the amounts change, so the key always matches one exact request. | `{card, earned, redeemed, replayed}` | S29→S30 |
| RH `GET /api/scan/history` | The last 50 events by this org (owner) or by this user (staff) | owner / staff | cursor | events | S32 |
| RH `GET /api/scan/join-qr` | QR of the active campaign's join page, for the counter | owner / staff | campaignId | svg | S31 |

The scanner maps error keys to plain-language messages: `card_not_found`, `card_deleted`, `card_expired`, `campaign_not_live`, `cooldown_active`, `daily_limit_reached`, `too_many_stamps`, `not_enough_stamps`, `no_reward_available`, plus network loss. v1 **does not queue scans offline**. An offline scan shows "No connection — nothing was saved", which matches Loopy. Offline stamping invites fraud.

### Customers and insights (F08, F11, F12)

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| RSC `/campaigns/{id}/customers` | Table with search (trigram), sort and keyset pagination | owner | q, sort, cursor | rows | S14 |
| RSC `/cards/{id}` | Card detail with the event timeline | owner | — | card, events | S15 |
| SA `giveStamps` | `apply_card_transaction(source='dashboard')`. No cooldown or caps, but logged. | owner | cardId, stamps, redeem, idempotencyKey | card | S16, F08 |
| SA `updateCustomer` | Edits fields. Writes a `customer_updated` event. | owner | customer patch | customer | S15 |
| SA `deleteCard` | `status='deleted'`, with optional farewell text in `note_text` (a deleted card gets no further messages, so nothing collides). Queues an update. After 30 days a job scrubs the customer's personal data if they hold no other active cards. | owner | cardId, farewell? | — | F12 |
| SA `copyCardLink` / `createCardForCustomer` | Staff-side enrolment, then share the `/c/{serial}` link | owner | customer fields | cardUrl | F05 |
| RSC `/campaigns/{id}/insights` | Counts by day from `card_events` (enrolments, stamps, rewards, redemptions), the status breakdown, and ROI = stamps × stamp value − redemptions × reward cost | owner | range | aggregates | S13, F11 |

### Messages and automations (F09, F15, F16)

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| SA `sendBroadcast` | Validates the text (≤ 300 characters; lock screen is about 90). Shows two honest numbers: "**N** wallet passes will be notified (some may be over today's limit)" and "also shown on **M** web cards". Inserts `messages`, sets `campaigns.news_text`, queues `message/send`. | owner | campaignId, body | message | S17, F09 |
| RSC `/campaigns/{id}/messages` | History with recipients, delivered, failed and skipped (budget) | owner | — | messages | S17 |
| SA `saveAutomation` | Upserts the birthday or win-back automation. Sets `enabled_at` on **every** switch from off to on, so win-back never blasts an old customer base, whether it's the first switch-on or a re-enable. | owner | kind, enabled, body, days_inactive, send_hour | automation | S35 |
| RH `GET /api/automations/{id}/forecast` | "Would reach N customers in the next 7 days" | owner | — | count | S35 |

### Billing (F14)

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| RSC `/settings/billing` | Plan cards in USD (Paddle) or RWF (Flutterwave). The currency follows the org's country, and the owner can switch. | owner | — | — | S21 |
| SA `startCheckout` | Paddle: returns a checkout transaction for Paddle.js overlay. Flutterwave: creates an `invoices` row and returns a hosted payment link (MoMo, Airtel, card). | owner | plan, interval, provider | checkout url / id | S21 |
| SA `cancelSubscription` | Paddle: cancel at period end through the API. Flutterwave: sets `cancel_at_period_end` (we simply don't raise the next invoice). | owner | — | subscription | S21 |
| RH `POST /webhooks/paddle` | Verifies the `Paddle-Signature` and dedupes in `webhook_events`. **Ignores events older than `subscriptions.provider_updated_at`**, because Paddle can deliver them out of order. Upserts `subscriptions` and `invoices`, then recomputes the org entitlement. | Paddle | event | 200 | — |
| RH `POST /webhooks/flutterwave` | Verifies the `verif-hash`, **re-fetches the transaction from Flutterwave's verify endpoint** (never trusts the body), checks amount and currency against the invoice, marks it paid, extends the period | Flutterwave | event | 200 | — |

Webhooks in: Paddle, Flutterwave, and Google Wallet save/delete callbacks (`POST /webhooks/google`: ECv2SigningOnly verification in Node `crypto`, nonce dedupe [G §6]). The Apple web service is inbound too.
Webhooks out: none in v1. Merchant webhooks and the API are could-haves.

### Jobs (Inngest)

| job | trigger / schedule | what it does |
| --- | --- | --- |
| `pass/changed` | event from any balance change. **Debounced 5 s per card**, so 3 quick stamps make 1 push. | Apple: HTTP/2 push `{}` to each registered device token (topic = Pass Type ID). On 410 / BadDeviceToken, delete the device and **recompute `cards.apple_installed`** from the remaining registrations. Google: PATCH the object's `loyaltyPoints.balance.string` ("7/10") and the `heroImage` for that count. **Stamps are always silent.** On Apple, `stamp_message` ("You have {n} stamps") is a back field with no `changeMessage`. Only "reward earned" notifies: `reward_message` as a `changeMessage` on Apple, `notifyOnUpdate` on Google, and only if `claim_notification_slot` succeeds. |
| `campaign/updated` | `pushCampaignUpdate` | Sets `pass_modified_at = clock_timestamp()` on all active cards in the campaign, in **short transactions of 500** (well under the 120 s tag look-back), then fans out Apple pushes. Google picks up class changes itself. |
| `message/send` | `sendBroadcast` | For each card with a wallet installed, per channel, it does two things in one transaction: `claim_notification_slot`, then insert a `message_deliveries` row (pending, or `skipped` when over budget). It then calls the wallet.<br>**Apple:** the back field `news` with `changeMessage "%@"`, bump `pass_modified_at`, push.<br>**Google:** **object-level** `addMessage` (TEXT_AND_NOTIFY) per card, so the budget really applies per card; a class-level message can't skip anyone [review H3]. That's about 6 minutes per 5,000 cards at 15 requests per second, which is acceptable for a broadcast. Old messages are pruned so at most 10 stay on each object.<br>Delivery rows are unique, so the job is safe to retry. Concurrency: 1 per campaign. |
| `automations/tick` | **cron hourly** at :05 | Processes **each org separately** (one failure can't stop the rest). For each enabled automation whose org's local time is at or after `send_hour` today, it picks eligible cards (below) and claims rows with `insert … on conflict (automation_id, card_id, period_key) do update set status='pending' where status in ('skipped','failed') returning *`, so new rows and retries come back and sent ones never do. For each claimed row: `claim_notification_slot`, then the wallet call (Apple `note_text` back field with changeMessage, or Google object `addMessage`), then `sent`, `failed` or `skipped` (budget). Retries end at midnight local time, and after 3 attempts. |
| `billing/renewals` | cron daily 06:00 Africa/Kigali | Flutterwave subscriptions: 7 days before `current_period_end`, raise the next invoice (unique per period) and email the owner a pay link (WhatsApp later). The state machine is below. |
| `trial/check` | cron daily | Emails at 3 days left and at expiry. An expired trial means no new activations and the dashboard is read-only. Live cards keep working for 14 days, then the campaign pauses. |
| `wallet/reconcile` | cron nightly | Google: GET objects with recent activity and correct `google_saved` from `hasUsers`, because callbacks can be missed [G §6]. Apple: counts registrations and flags any drift. |
| `privacy/scrub` | cron daily | Deleted cards older than 30 days lose the customer's personal data if the customer has no other active card. Old Apple `/v1/log` noise is dropped. |

**Billing state machine.** Two places hold state:
- `subscriptions.status` (`active`, `past_due`, `cancelled`) is the provider's view.
- `orgs.plan_status` is the **entitlement**. Only the billing module writes it, and it's recomputed after every webhook or job.

| from | event | to | what the merchant sees |
| --- | --- | --- | --- |
| trialing | paid | active | — |
| trialing | trial ends unpaid | locked (`locked_at` set) | Dashboard read-only. No new activations. Cards and scanning keep working. |
| active | period ends unpaid | past_due (`grace_until` = +7 days) | Banner. Everything still works. |
| past_due | paid | active | — |
| past_due | grace ends | locked | As above |
| locked | paid | active | Everything restored |
| locked | **30 days in locked** | locked, and campaigns **paused** | Join pages show "programme paused". The scanner refuses new stamps. Owner corrections and reward redemptions still work, so customers' banked rewards stay honoured. |
| any | cancel | cancelled at period end, then locked | Same lock path. Data is kept 90 days, then scheduled for deletion with an email warning. |

The merchant's customers are never punished on the first day of a missed invoice, but the core product doesn't stay free forever.

**Who is eligible for an automation:**
- **Birthday:** the customer's `birthday_month` and `birthday_day` equal today in the org's timezone. On a non-leap year, 29 Feb birthdays send on 28 Feb. `period_key = year`. Customers who joined today are skipped. **One birthday message per customer per org per year:** if the customer holds cards in two of the merchant's campaigns, only the card with the most recent visit gets it, and the others are recorded as `skipped: other card`.
- **Win-back:** `last_visit_at < now() − days_inactive` and `last_visit_at >= automation.enabled_at − days_inactive`, so only lapses that end after it was switched on count. `period_key = last_visit_at::date`, so the next visit starts a new lapse.
- **Both:** the card is active, not expired, and reachable. Reachable means a wallet is installed, or (for later SMS) phone plus consent. The customer has marketing consent where the campaign's consent box is on.

## The parts that bite

- **Time zones:**
  - Everything is stored in UTC.
  - `orgs.timezone` (IANA) drives automation hours, "today" for birthdays, and insights bucketing (`date_trunc` at the org's timezone).
  - Kigali has no daylight saving, but international merchants do. An hourly tick at "local hour = send_hour" means a DST jump can skip or repeat one hour. The repeat is harmless (period keys stop a second send), and the skip is caught by the next tick, which also checks "today, at or after send_hour, not yet sent".
  - The scanner's 24-hour cap is rolling, not per calendar day, so it doesn't depend on time zones.
- **Idempotency:**
  - Scanner submits carry a client UUID.
  - Webhooks dedupe in `webhook_events (provider, external_id)`.
  - Flutterwave payments re-verify through the API and match `invoice.provider_ref`.
  - Message fan-out is unique on `(message, card, channel)`.
  - Automations are unique on `(automation, card, period)`.
  - Inngest steps are retried, so each one is written to be idempotent.
- **Races:**
  - Concurrent scans serialise on the card row lock. Duplicate submits serialise on the `idempotency_keys` primary key.
  - Concurrent senders for one card serialise on the notification advisory lock.
  - Concurrent joins with the same email hit the unique index; the handler catches 23505 and returns the existing card.
  - Two owners activating at once is handled by a conditional update (`where status = 'draft'`).
  - The 10-locations trigger takes a per-campaign advisory lock and also checks UPDATEs.
- **Rate limits:**
  - Google Wallet: 20 requests per second per project [G §3], so we throttle to 15.
  - Notifications: 3 per pass per 24 hours on Google, which we also apply to Apple. This is enforced atomically by `claim_notification_slot`. Stamps are silent, and only reward-earned, broadcast, birthday and win-back notify.
  - Join endpoint: Turnstile first, then a generous per-IP limit (carrier NAT).
  - APNs: one HTTP/2 session per batch, with many streams.
- **Notification-budget collisions:**
  - Slots are claimed atomically (`claim_notification_slot`). If a broadcast and a birthday land on the same day, the birthday wins.
  - Broadcasts skip cards with fewer than 2 slots left that day and record `skipped: budget`.
  - The dashboard shows delivered and skipped honestly. We never promise 100% delivery.
- **Wallet behaviour we don't control:**
  - Apple shows location relevance as a lock-screen *suggestion* that iOS decides on and the user can turn off [A §4].
  - Google "Nearby Passes" uses `merchantLocations`, and Google picks the radius and text [G §4].
  - The UI copy says "may appear near your locations", never "alert".
- **Apple guideline risk:**
  - Apple's design guidelines say change messages shouldn't be used for marketing [A §3].
  - Mitigations: broadcasts are capped, framed as "news from {business}", and always visible on the web card too.
  - Most of the product (stamps, rewards, birthday) is transactional.
  - If Apple pushes back, broadcasts become silent updates plus SMS/WhatsApp.
- **Certificates:**
  - The Pass Type ID certificate expires yearly. When it lapses, both signing and pushes stop for every merchant at once.
  - The expiry date is stored in an env var, the health check alerts at 30, 14 and 3 days, and `ops/RUNBOOK.md` documents the renewal (create it during build).
- **Images:**
  - Apple's two sources disagree on sizes (strip 1125×432 vs 1125×369) [A §1]. We render at 1125×432 and keep content in the bottom 369 px.
  - Google's hero image is 1032×812 [G §2].
  - All of these are config in one module, with a test on real devices before launch.
- **File limits:** uploads ≤ 2 MB, PNG/JPEG/SVG (SVG is sanitised and rasterised; never served as-is). Server-side checks of size and dimensions.
- **Search:** the trigram GIN index over name, email and phone. Fine up to about 1M customers per org, after which we'd revisit.
- **Realtime:**
  - The scanner gets its result synchronously.
  - The dashboard and web card poll every 15 s, which is enough; no websockets in v1.
  - The pass on the phone updates within seconds (APNs) or "next sync" (Google).
- **Offline:** none in v1 (see the scanner section). The scanner shell and WASM are precached, so a bad connection only affects the submit.
- **Email deliverability:** merchant-only email through Resend, with SPF, DKIM and DMARC on our domain. No bulk customer email in v1.
- **Multi-tenancy:**
  - `org_id` on every table, with one scoped data module.
  - One Apple Pass Type ID and one Google issuer for all merchants, branded per pass and class.
  - Licence risk is noted below.
- **GDPR and data protection (Rwanda Law 058/2021 and GDPR for EU merchants):**
  - Consent text is stored on the customer.
  - The checkbox is off by default.
  - Deletion is per card and per account (cascade).
  - There's a scrub job.
  - There's an export (should).
  - Customers' data is processed on the merchant's behalf, so we need a DPA in the merchant terms.

## Independent review (2026-11-25)

A separate reviewer read the plan cold and found **2 critical, 5 high and 9 medium issues, plus 5 low**. All of them are fixed in this version:
- the join page leaked existing cards;
- `ON DELETE SET NULL` clashed with the append-only ledger;
- the Apple tag race and the 304 column;
- the Google class-message budget;
- automation retries;
- counter phones signed in as the owner;
- tenant foreign keys;
- replay semantics;
- dashboard corrections;
- the budget race;
- timezone validation;
- billing history, ordering and the terminal state;
- carrier NAT;
- manual code, farewell text, scheduled deletion and win-back re-enable;
- the locations UPDATE bypass;
- RPC execute grants;
- recipient counts;
- APNs 410 cleanup;
- contact required on join.

The SQL fixes are covered by regression tests in `tests/schema.test.mjs`.

## Risks to retire early (week 1 spikes)

1. **Apple end to end from Vercel:**
   - Get the organisation account (needs a D-U-N-S number) and a Pass Type ID.
   - Sign a pass with passkit-generator.
   - Register through our web service.
   - Push over HTTP/2 from a Vercel Node function to production APNs.
   - Watch a real iPhone update.

   This proves the core product. [A §2–3]
2. **Google issuer publishing access:**
   - Apply in week 1. It needs a Business Profile and a Google payments profile from a Rwanda-based business, and the review time is undocumented [G §1].
   - Test a save on a real Rwandan Android phone in demo mode, and record what an ineligible phone sees.
3. **Paddle and Flutterwave approval.** Paddle needs custom pricing under $10. Flutterwave probably needs Rwanda Development Board (RDB) registration. Ask a Rwandan accountant about VAT and EBM receipts on local sales [G Risks].
4. **Licences:**
   - Apple's licence allows Pass Type IDs only "under your own trademark or brand" [A §5], and Google doesn't explicitly cover multi-merchant classes [G §1].
   - Get a lawyer's read, and add a brand-licence clause to the merchant terms.
   - Fallback if Apple objects: become the brand on the pass ("{Merchant} Rewards by OurApp").

## Build order

Each milestone lists its screens, tables and routes. Dates assume one developer working with Claude, and start once the Apple and Google accounts are approved.

**M0: Spikes and accounts (week 1)**
- **Work:** the 4 risks above.
- **Tables:** none.
- **Exit:** a real iPhone pass updates after a server push from Vercel, and a Google demo-mode pass saves on a Rwandan phone.

**M1: Vertical slice, ugly (weeks 1–2)**
- **Work:** sign up, make one card with defaults, join on the web, see the web card, pair a phone and scan it on the `/scan` PWA, and watch the web card and the Apple pass update.
- **Screens:** S01, S03 (minimal), S04 (name + stamps + colour only), S19-lite (pair device), S22, S23, S27–S30.
- **Tables:** orgs, org_members, scanner_devices, campaigns, rewards, campaign_fields, customers, cards, card_events, idempotency_keys, apple_devices, apple_registrations.
- **Routes:** signUp, createCampaign, activateCampaign, `/j`, `POST /api/j`, `/c/{serial}`, `/c/{serial}/apple`, Apple `/v1/*`, createPairingCode, `/api/scan/pair`, `/api/scan/lookup`, `/api/scan/transaction`, the `pass/changed` job (Apple only).

**M2: Wallets complete (weeks 2–3)**
- **Work:** Google class and object, the save link, silent updates and reward notify, callbacks, the reconcile job, hero images per count, the strip renderer and cache, and a real stampable preview pass.
- **Screens:** S10, S24, S25.
- **Tables:** pass_notifications, webhook_events.
- **Routes:** `/c/{serial}/google`, `POST /webhooks/google`, preview routes.

**M3: Designer and dashboard musts (weeks 3–4)**
- **Work:** all designer tabs, activation locks, QR and poster, customers table and detail, remote stamping, delete card, insights, restore card.
- **Screens:** S04–S09, S11–S16, S26.
- **Tables:** campaign_links.
- **Routes:** the designer, customer and insights actions.

**M4: Locations and messages (weeks 4–5)**
- **Work:** locations with Places, `campaign_locations` written to the Apple pass and Google `merchantLocations`, broadcasts with the budget, history, automations (birthday, win-back) with the forecast.
- **Screens:** S06, S17, S18, S35.
- **Tables:** locations, campaign_locations, messages, message_deliveries, automations, automation_sends.
- **Jobs:** `message/send`, `automations/tick`, `campaign/updated`.

**M5: Billing and limits (weeks 5–6)**
- **Work:** Paddle checkout and webhooks, Flutterwave invoices with MoMo and the renewal job, plan limits (designs, locations), trial lock, settings.
- **Screens:** S02, S20, S21.
- **Tables:** subscriptions, invoices.
- **Jobs:** `billing/renewals`, `trial/check`.

**M6: Hardening (weeks 6–7)**
- **Work:** rate limits and Turnstile, Sentry, privacy scrub (including pruning `idempotency_keys` older than 7 days), certificate-expiry alerts, the runbook, real-device image QA, two-connection race tests (scan vs scan, duplicate submit, budget claim), load-test a 5,000-pass broadcast, accessibility pass.

**After v1 (should, in this order)**
1. Staff personal logins (S19 full). Paired devices already cover counters in v1, and `org_members.role = 'staff'` already exists.
2. SMS and WhatsApp for web-card customers.
3. Segments and single-customer messages.
4. Multi-reward cards. The rewards table already exists.
5. CSV export.
6. Scanner history and edit-customer (S32–S33).
7. Native scanner apps, the API and webhooks.

**Fixes from replica-entrepreneur:** to be filled in after `/replica-entrepreneur`. Already designed in from the recon:
- the web card for phones without a wallet;
- a preview pass you can actually stamp;
- free duplicate protection (a top-tier feature at Loopy);
- Google sign-in;
- automations;
- local mobile-money billing;
- a lower entry price (decided in /replica-launch).

Estimate: **M, about 6–7 weeks of build** plus account-approval time. That matches the recon's 5–8 weeks.
