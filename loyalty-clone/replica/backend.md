# Backend: loyalty clone v1

App: `loyalty-clone/web`. Date: 2026-11-25. Everything below runs locally today. Each external service switches on when its keys are added to `.env.local` (see `.env.example`). **No accounts were created, and no live keys or passwords were used.** You create the accounts.

## How to run it

```bash
cd loyalty-clone/web
npm run db:dev        # local Postgres (pglite-server) on :54321, data in .data/pglite
npm run db:migrate    # db/migrations/*.sql, recorded in schema_migrations
npm run db:seed       # Kigali café demo data (fake people); login is in db/seed.mjs
npm run dev           # app on :3100
npm test              # 50 unit tests (rules, billing, wallet)
node tests/access.integration.mjs   # second-business access test, against the running app
```

In production `DATABASE_URL` points at Supabase (or any Postgres 15+). Run the same migrations there.

## Decisions taken in this step (differences from architecture.md)

| topic | decision | why |
| --- | --- | --- |
| Auth | **Own email + password auth on Postgres** (`users`, `sessions`, `auth_tokens`), with scrypt hashes and http-only cookies. Only the sha256 of each session token is stored. Supabase is used as a database only. | Works on any Postgres and needs no account to develop. Supabase Auth can be added later. |
| Transactions | **The app never holds a transaction open.** Every atomic write is one SQL statement (CTEs) or one SQL function: `apply_card_transaction`, `join_campaign`, `claim_notification_slot`, the `replace_*` helpers. | Short requests on real Postgres, no half-finished state. It also makes the dev database safe. |
| Dev database | `pglite-server` (real Postgres in WASM) instead of Docker. **Dev only: set `PG_POOL_MAX=1`**, because its multiplexer stalled on parallel queries (one request hung for 5 minutes until the pool was set to 1). | No Postgres or Homebrew on this Mac, and Docker wasn't running. In production, keep the default pool size. |
| Jobs | **Vercel Cron → `/api/cron/{automations,deliveries,billing,cleanup}`** (Bearer `CRON_SECRET`), with retries in `job_runs` (3 attempts; a `failed` row is the dead-letter log). Message fan-out runs after the response with `after()`, and the `deliveries` cron resumes anything unfinished. | No Inngest account needed. Every job is idempotent through its unique claims. Move to Inngest if fan-out outgrows a function's run time. |
| Apple alerts | The pass carries `appleAlert` flags. A `changeMessage` is only included when a notification slot was actually claimed for that change. | On iPhone the pass content, not the push, decides whether an alert shows. Without the flags the daily limit would leak. |

## Auth
- [x] Email sign-up with verification (48-hour link, works once). Tested in the browser.
- [x] Password reset (1-hour link, works once). It **signs out every session**. Tested in the browser.
- [x] Sessions in http-only, `SameSite=Lax` cookies, `Secure` in production. 30-day expiry. Only token hashes are stored.
- [x] Sign out on all devices (Settings).
- [x] Roles: owner; staff role in the schema; **paired counter phones** limited to `/api/scan/*`.
- [x] Account deletion: sessions end at once and the business plus everything in it is purged after 7 days by `cleanup`. Signing in within the 7 days cancels it.
- [ ] Magic link: Loopy doesn't offer it; not built.
- [ ] Google sign-in: should-have, needs your Google OAuth client.

## Database
- [x] Migrations 0001–0004 are checked in, run by `db/migrate.mjs`, and applied to the local database.
- [x] Access rules: **one authorisation path.** Every function takes the caller's org and every query is filtered by it. Composite tenant foreign keys and RLS (on, with no policies) back it up in the database.
- [x] **Second-business test passes 15/15** (`tests/access.integration.mjs`): business B gets 404 on every page of A's cards, B's scanner can't find or stamp A's cards, there's a 401 without a session, cron refuses requests without the secret, and the public card shows only a first name.
- [x] Seed script with realistic fake data. It's repeatable: it wipes and reseeds the demo café.
- [ ] **Backups:** turn on Supabase daily backups, or PITR on Pro, when you create the project. Not possible to check from here.

## Payments (test mode first)
- **Paddle** (international cards, merchant of record): checkout, cancel at period end, and a signed webhook.
- **Flutterwave Rwanda** (MTN MoMo, Airtel Money, local cards): payment link per prepaid invoice, plus a webhook that is **re-verified with Flutterwave's API**.

Checks:
- [x] Webhooks verify signatures, store the event ID (dedupe) and are idempotent.
- [x] **Tested end to end against the database with signed Paddle events:** forged signature 401; duplicate ignored; an older event arriving late doesn't overwrite a newer one; the plan and plan status follow the subscription.
- [x] Subscription status lives in our database (`subscriptions`, `invoices`) and the app reads only that.
- [x] Cancelling is one click (Paddle: at period end. MoMo: the next invoice isn't raised).
- [ ] **Needs your accounts:** a Paddle sandbox (API key, webhook secret, price IDs) and a Flutterwave Rwanda test account. Until then the billing page switches plans directly in development and **refuses to in production**.
- **Unverified until a real test** (from the payments developer):
  - whether Flutterwave's verify response includes `meta`;
  - the exact `payment_options` value for Rwandan mobile money;
  - whether Paddle checkout needs a default payment link set in its dashboard.

## Email and jobs
- [x] Resend through its official API from `EMAIL_FROM`. **Every email is written to `outbox_emails` first**, which gives an audit trail, and in dev the email is just logged there. Templates written fresh.
- [x] Jobs (all ran OK against the database):
  - `automations` (hourly): birthday and win-back claims, with a retry of skipped sends and at most 3 attempts.
  - `deliveries` (every 5 min).
  - `billing` (daily): trial end, MoMo invoice 7 days before renewal, past due, then locked after 7 days' grace, then cards paused after 30 days locked.
  - `cleanup` (daily): expired sessions and tokens, idempotency keys, privacy scrub after 30 days, scheduled account deletions.
- [x] Times are stored in UTC. Automations use each business's time zone.
- [ ] **Needs your Resend account** and a verified sending domain (SPF, DKIM, DMARC).

## Integrations (wallets)
- **Apple Wallet:**
  - The full PassKit web service (register, unregister, updated serials with a 120-second look-back, latest pass with 304, log).
  - The `.pkpass` is built with passkit-generator. **Tested with a self-signed certificate:** the signature verifies with `openssl smime`.
  - APNs pushes over HTTP/2 with the pass certificate, production only.
- **Google Wallet:**
  - One LoyaltyClass per card and objects per customer.
  - Short ("skinny") save-link JWTs, 1,800 characters or less.
  - Silent point updates; a notification only when a reward is earned and a slot is free.
  - Messages for broadcasts, birthdays and win-back.
  - Signed save/delete callbacks (ECv2SigningOnly), deduped by nonce.
- [x] Without keys, every wallet route answers **503 `not_configured`** and the app keeps working on web cards.
- [ ] **Needs your accounts:**
  - an organisation Apple Developer account (D-U-N-S number), Pass Type ID, certificate and WWDR G4;
  - a Google Pay & Wallet Console issuer plus a service account. **Apply for publishing access in week 1; Google's review takes an unknown amount of time.**
- **Unverified until real devices** (from the wallet developer):
  - the APNs headers for passes (no `apns-push-type` is sent);
  - Google's `notifyPreference` value (`NOTIFY_ON_UPDATE`);
  - the ECv2 byte format against real Google messages;
  - image sizes on real phones.
- [ ] Pass images are **placeholders** (solid colours) until `npm i @resvg/resvg-js` renders the stamp strip.
- [ ] Google's `programLogo` URL needs an image route before the first real class insert.
- [ ] Not built yet:
  - pruning Google messages to at most 10 per card;
  - logo and image upload (needs Supabase Storage).

## Security checklist
- [x] Secrets only in env vars. `.env*` is git-ignored (with `.env.example` committed), and nothing secret goes to the client: the wallet, billing and database code is server-only.
- [x] Input validated on the server on every route: types and limits in the data layer, regex IDs, and database check constraints as the backstop.
- [x] Authorisation on every read and write, **tested with a second business**.
- [x] Rate limits, in Postgres (`rate_hit`):
  - login: 8 per 15 minutes per email;
  - sign-up: 5 per hour per IP;
  - password reset: 3 per hour per email;
  - join: 30 per minute per IP;
  - pairing: 10 per 10 minutes per IP;
  - resend verification: 3 per hour.
- [ ] Turnstile on the join form (architecture): not added yet; it needs your Cloudflare site key.
- [x] Webhooks verify signatures (Paddle HMAC, Flutterwave hash plus API re-verify, Google ECv2).
- [ ] Uploads: not built yet (no upload feature). When added: size and type limits, served from a separate Storage bucket.
- [x] No user data in URLs or logs:
  - tokens appear only in emailed links;
  - webhook logs hold event IDs only;
  - Flutterwave payloads are redacted before storage;
  - the client IP is used for rate limits and never stored.
- [x] `npm audit`: Next upgraded 16.2.9 → 16.4.6 (fixes a **critical** middleware-bypass advisory), along with PostCSS and sharp.
  - **Open:** `joi` (high, through passkit-generator). The only fix npm offers is a downgrade to passkit-generator 3.1.2, which loses iOS 27 support.
  - Our pass.json is built by our own code, never from user-supplied keys, so the prototype-pollution path doesn't apply.
  - Re-check when passkit-generator updates joi.
- [ ] Privacy policy listing every processor: Supabase (database), Vercel (hosting), Resend (email), Paddle and Flutterwave (payments), Apple and Google (wallet passes), Cloudflare (if Turnstile is added). This belongs to `/replica-launch`.

## Feature matrix
Updated in `features.csv`. Must-haves are now **36 yes, 15 partial and 2 no**. The rows that moved are listed in the commit.
