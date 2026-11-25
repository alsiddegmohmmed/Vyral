# Deploy checklist: Garuka

Date: 2026-11-25. Commit: `6015780` (brand kit applied), on `recon/loyalty-clone`.

**Go from the owner: NOT YET.** The preflight still fails on two items: 13 must-have features aren't done, and the privacy and terms pages exist only as drafts waiting for legal review. Nothing has been deployed, bought or signed into. Live keys don't belong in the repo; the owner adds them in the host.

## Preflight (all must pass)

- [x] **e2e suite green: 152 passed of 152.** `npx playwright test` on `6015780`: desktop 1440 plus phone 390, with axe checks. Unit tests: 61 of 61.
- [x] **No open S1 or S2 bugs.** `bugs.md`: all 15 are marked fixed (B-001 S1; B-002, 003, 007, 010 and 012 S2), each with a passing test.
- [ ] **Parity: FAIL.** 32 of 45 must-haves are done, and the feature score is 71.4 / 100 (`parity.py`: "Not shippable yet").
  - **Blocked on the owner's accounts and keys (9):**
    - Apple Wallet add, live pass updates, and pass status tracking: an Apple Pass Type ID plus APNs;
    - Google Wallet save: a Google Wallet issuer account;
    - pushes reaching wallet passes, lock-screen reward text, and location messages: both of the above;
    - Paddle card billing and live subscription billing: a Paddle account and 6 prices (`launch/pricing.md` §5).
    - The code for all of these is built and tested against signed test events or test certificates. It needs the real keys, plus one real-device test each.
  - **Still to build or verify (4):**
    - a preview pass you can stamp (needs the Apple certificate);
    - the business issuer details on the back of the card;
    - camera scanning on a real cheap Android phone (built, not yet tested with a real camera);
    - "Edit live card → push": the code is there, but it's only proven once the keys exist.
  - **The owner's choice:** launch as **web-card only** with this gap stated plainly, or wait for the wallet accounts. If web-card only, remove the wallet wording from the landing page and the listing first (`launch-plan.md` §0.6).
- [x] **Rebrand sweep clean.** `sweep.py . --config replica/brand.json` exit 0: "Clean". The accepted Sunrise near-match is logged in `brand.md`.
- [x] **Store listing passes.** `listing.py replica/launch/listing.json`: 0 errors, 0 warnings. That's for the later store release; the first launch is the web app.
- [x] **Production build passes.** `npm run build`: exit 0, every route compiled.
- [ ] **Privacy policy and terms: DRAFTED, waiting for review.** `/privacy` and `/terms` exist (`web/app/(legal)/`). They show a "Draft for legal review" banner until `LEGAL.reviewed` is set in `web/lib/legal.ts`. They're linked from sign-up, the join page and the landing page, and e2e LG-H1 to LG-H3 check them, with axe.
  - **Every processor is listed** (`PROCESSORS` in `lib/legal.ts`): Vercel, the Postgres provider, Resend, Paddle, Flutterwave, Apple, Google, and WhatsApp (Meta) for support chats.
  - **The privacy statements were checked against the code:** what's collected, the cookies (`lc_session`, `lc_device`), browser storage, the retention jobs and the deletion timings. It states that no location or tracking data is collected, which is true today.
  - **The owner fills in** the legal entity, address, privacy and support emails, the effective date, and the database region.
  - **Marked [owner to confirm] in the terms:** the refund promise, a customer export before deletion, and the liability cap.
  - **Question for the lawyer:** invoices are deleted with the account (`on delete cascade`). Rwandan tax law may require keeping them. If so, change the schema to keep invoices after deletion, and update the privacy notice.
  - **Law:** Rwanda Law No. 058/2021 for Kigali, plus GDPR and UK GDPR for EU and UK owners. Get a local legal review before `reviewed: true`.
- [x] **Account deletion works.** Deletion closes the join page at once (e2e F01-E12). The org is purged after 7 days by the `/api/cron/cleanup` job, and the orphaned owner account the day after. Deleted customers' details are scrubbed after 30 days.
- [x] **Favicon, titles, OG image, emails and app icon are ours.**
  - **Favicon and icons:** a one-colour Full Circle favicon, an Apple touch icon, and counter icons on Night.
  - **Social image:** a 1200×630 OG image.
  - **Titles and emails:** titles read "… · Garuka". Emails read "Welcome to Garuka", and the sender name in `.env.example` is Garuka.
  - **Not yet set:** the real `EMAIL_FROM` domain, which comes with the domain.

## Production (the owner sets up the accounts; Claude writes the steps)

- [ ] **A separate production Postgres, never the dev pglite.**
  - Use Supabase (EU or the nearest region; Postgres 15+), or any managed Postgres with backups and point-in-time recovery on.
  - Use the **pooled** connection string as `DATABASE_URL`, with `PG_POOL_MAX=5`.
- [ ] **Migrations run by the deploy, not by hand.**
  - Set the Vercel build command to `npm run db:migrate && npm run build` with the root at `loyalty-clone/web`.
  - `db/migrate.mjs` applies `0001` to `0007` in order and records them.
  - Run it once against a staging copy first.
- [ ] **Env vars in the host match `.env.example`.**
  - `DATABASE_URL`, `PUBLIC_BASE_URL=https://<domain>`, `BARCODE_SECRET` (new, long and random; rotating it invalidates every printed QR) and `CRON_SECRET`;
  - `RESEND_API_KEY`, `EMAIL_FROM="Garuka <hello@<domain>>"`;
  - `PADDLE_*` (live; `PADDLE_ENV=production`; 6 price IDs), `FLW_SECRET_KEY`, `FLW_SECRET_HASH`;
  - `APPLE_*` and `GOOGLE_WALLET_*` when you have them;
  - `SUPPORT_WHATSAPP`.
  - `NEXT_PUBLIC_APP_VERSION` is left empty on Vercel (the commit SHA is used).
- [ ] **Payments live.** Here that means Paddle and Flutterwave instead of Stripe.
  - **Paddle:** live mode, the 6 prices, webhook to `https://<domain>/api/webhooks/paddle` with its secret. Make one real purchase, then refund it.
  - **Flutterwave:** webhook to `https://<domain>/api/webhooks/flutterwave` with the secret hash. Make one real 100 RWF MoMo test charge, then refund it.
- [ ] **OAuth:** not applicable. Owner sign-in is email and password; "Sign in with Google" is in the feature list but isn't built.
- [ ] **Google Wallet callbacks:** add `https://<domain>/api/webhooks/google` in the issuer console. For **Apple**, the pass `webServiceURL` is `PUBLIC_BASE_URL` + `/api/apple`.
- [ ] **Email sending domain verified** in Resend (its DNS records are below).
- [ ] **Crons:** `vercel.json` already declares them: automations hourly, deliveries every 5 minutes, billing daily at 04:00 UTC, and cleanup daily at 03:30 UTC. Vercel sends `CRON_SECRET`, and the routes refuse requests without it.

## Host and domain

**Host:** Vercel, with the project root set to `loyalty-clone/web`. Connect the repo so that `main` deploys and pull requests get preview URLs.
- Today this work sits on `recon/loyalty-clone`, inside the Vyral site repo. Before connecting, decide whether Garuka moves to its own repository. Recommended: yes, so Vyral's site and Garuka deploy separately.

**Domain:** not bought yet. `garuka.com` is taken; the candidates are `garuka.app`, `getgaruka.com` and `garuka.rw` (availability to run). After the owner buys one, set:

| record | name | value |
| --- | --- | --- |
| A | @ | the apex IP that Vercel shows in Project → Domains |
| CNAME | www | `cname.vercel-dns.com` |
| TXT | `_vercel` (if asked) | the verification value Vercel shows |
| TXT (SPF) | `send` (Resend's subdomain) | the value Resend shows, e.g. `v=spf1 include:amazonses.com ~all` |
| MX | `send` | the feedback MX that Resend shows |
| TXT (DKIM) | `resend._domainkey` | the public key Resend shows |
| TXT (DMARC) | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@<domain>`. Tighten to `p=quarantine` once two weeks of reports are clean. |

Use the values from the dashboards, not these examples. Make the **apex** canonical and redirect `www` to it in Vercel. HTTPS is automatic; check it once DNS resolves.

## Watch (first week)

- [ ] **Error tracking:** Sentry (or Vercel's) on the dashboard, the API and `/scan`, scrubbed of customer data as the scanner reports already are. Alert the owner's phone on any new error in `/api/scan/*`.
- [ ] **Uptime checks every minute:**
  - `https://<domain>/` (landing);
  - `https://<domain>/api/scan/version` (the counter's heartbeat);
  - `https://<domain>/j/<a live code>` (join).
- [ ] **Analytics:** a cookie-free counter (Plausible or Umami) on the landing page and sign-up, so no cookie banner is needed.
- [ ] **Logs:** keep the Vercel logs, and add a log drain if the plan's retention is short.
- [ ] **What to watch:**
  - sign-ups, then card created, then live, then first join, then first stamp;
  - scanner reports per day;
  - pairing failures;
  - billing webhook failures;
  - cron runs (each returns counts).
- [ ] **The core flow on the live site:**
  1. Sign up.
  2. Design a card and go live.
  3. Join from a phone (as a customer).
  4. Pair a counter phone and stamp, then redeem.
  - Claude does it on desktop; the owner does it on their own phone at a real counter.

## Mobile

No native app yet. The counter is an installable web app (`/scan`, using the Garuka counter icons). The order is the browser install, then Play as a Trusted Web Activity, then the App Store only once there's native value (`launch-plan.md` §5). The owner holds the developer accounts: Apple $99 a year, Google $25 once.

## Live URL

None. It isn't deployed: the preflight failed, and the owner hasn't given a go.
