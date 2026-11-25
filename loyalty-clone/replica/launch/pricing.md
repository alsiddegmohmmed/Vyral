# Pricing: Garuka

Skill: replica-launch. Date: 2026-11-25. Inputs:
- `fixes.md` (angle A, the counter never stops, packaged as B, built for Kigali);
- `feedback.md` (review counts);
- the public pricing pages below, read on 2026-11-25.

## 1. What others charge (read 2026-11-25)

Prices change. Check each page again before quoting it anywhere public.

| product | page | plans (monthly) | annual | trial | limits that matter | billing terms on the page |
| --- | --- | --- | --- | --- | --- | --- |
| **the original** | https://loopyloyalty.com/pricing | Starter $25 · Growth $69 · Ultimate $95 | $250 · $690 · $950 (save 20%) | 15 days | designs 1 / 3 / 10; locations 1 / 3 / 10; sub-users 3 / 10 / 50 | Card via Stripe. Cancel from settings, active to period end. **No refunds.** Cards deleted after a cancelled period ends. |
| Stamp Me | https://www.stampme.com/pricing | Lite $49 · Pro $79 · Elite $199 (a "$100" sits beside Elite as a "limited time offer"; we couldn't confirm which price is struck through) | not shown | 30 days from the first published card, no card needed | 2 published programmes, then a $15 one-off each; Lite and Pro single location; unlimited users | Stripe. "No lock-in", cancel any time. |
| koroot | https://www.koroot.io/pricing | Starter EGP 1,499 · Growth EGP 2,999 · Business EGP 4,999 · Enterprise on request (incl. 14% VAT) | "save 20%" toggle, prices not in text | 14 days, no card | branches 1 / 3 / 10; staff per branch 2 / 5 / unlimited; card designs not capped | Bank transfer or InstaPay. Renewal and cancel terms not stated on the page. |
| Boomerang | https://www.boomerangme.cards/pricing | **not read** | | | | The page redirects (301) to boomerangme.com/. The pricing wasn't fetched. |

**Cheapest entry:** the original's Starter at $25 a month is the cheapest entry plan among those read. Stamp Me starts at $49. A one-counter café in Kigali pays these in USD by card.

## 2. What reviewers said about price and billing

From `feedback.md` (30 reviews, 5 sources) and `fixes.md`:
- **"Price and paywalls": 5 reviews (17%), 3 sources, average 3.0★.** Examples: "Very expensive subscription" (Play, 2★, 2018) and "The pricing" (G2). The H4 rows date from 2018–2019, so this is **old**.
- **One review paid $25 a month and then couldn't log in.** It's counted under the login theme, but it shows that paying while the counter fails makes the anger twice as bad.
- **Competitors (from `fixes.md`):**
  - Boomerang: billing after the trial with no way to cancel (1 review), and a forced paid add-on (1 review).
  - Stamp Me: no billing complaints in the sample.
- **Asked for by name:** more than one card design on the entry plan (1 review, G2 2018, **thin**).

## 3. The model

**Billing:**
- **Trial:** 15 days free with every feature, and no card or MoMo needed to start. When it ends, editing pauses until a plan is chosen. Customers' cards keep working, and nothing is deleted.
- **Flat price per shop, not per seat.** Staff use paired counter phones, so a growing team never raises the bill.
- **Monthly or yearly.** Yearly costs 10 months for 12 (two months free). Renewal already uses the ×10 rule (`maintenance.ts`, `checkoutAction`).
- **Currency:**
  - **RWF:** MTN MoMo, Airtel Money or card, through Flutterwave. Renewal is by invoice, 7 days ahead.
  - **USD:** card, through Paddle (merchant of record, so it handles VAT and sales tax).

**Three tiers, named in the product by who they're for:**

| plan | for | RWF / month | USD / month | yearly (RWF / USD) | card designs | locations | counter phones |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Starter | one shop with one counter | 15,000 | 12 | 150,000 / 120 | **2** | 1 | up to 10 |
| Growth | a shop with a few branches | 35,000 | 29 | 350,000 / 290 | 3 | 3 | up to 30 |
| Pro | chains and franchises | 60,000 | 49 | 600,000 / 490 | 10 | 10 | up to 100 |

Every plan includes unlimited customers and messages, the birthday and win-back messages, the self-recovering counter, and WhatsApp support from a person.

**Why these numbers:**
- **Starter, $12 or 15,000 RWF:** about half the original's entry price. In RWF it's roughly the cost of 5 to 8 coffees in Kigali a month. That's **reasoning, not evidence**: confirm it in the first 10 conversations (see the launch plan).
- **2 designs on Starter:** this answers the one review asking for more than one design on the entry plan. Stamp Me also allows 2.
- **Counter phones:** the caps are far above what a shop needs, and re-pairing is free. A revoked phone doesn't count toward the cap. This is fix #2: "never buy a new device". The caps exist only to stop abuse, not to sell upgrades.
- **Plan names:** "Starter / Growth / Pro" stay as the plan names (the tests and receipts use them). The "for …" line is what the pricing table and the plan cards show. Rename later if interviews show owners pick the wrong plan.

## 4. Billing complaints fixed in the product

| complaint | fix | where |
| --- | --- | --- |
| No way to cancel after the trial (competitor) | **One-click cancel** on Plan & billing, with one confirm. It takes effect at period end, with undo before then. Paddle subscriptions are cancelled through Paddle's API. | `settings/billing/cancel-plan.tsx`, `api.setCancelAtPeriodEnd`; e2e F14-H2 |
| Surprise renewal | A renewal email 7 days ahead (Flutterwave), and the billing page states the renewal date | `maintenance.ts`, billing page |
| Cards deleted when you stop paying (the original's terms) | Customers keep their cards. Only editing pauses. | locked state, already built |
| Per-seat jumps | No per-seat pricing. Counter phones are capped generously, and re-pairing is free. | `PLAN_LIMITS` |
| Downgrade below usage | Refused, with a plain list of what to archive first | `checkoutAction`; e2e F14-E2 |

## 5. Products and prices to create (the owner creates these; no keys in the repo)

**Paddle (USD, card).** Create these in the Paddle dashboard, then put each price ID in the environment under the name `lib/billing/paddle.ts` reads (`priceIdFor`): `PADDLE_PRICE_STARTER_MONTH`, `PADDLE_PRICE_STARTER_YEAR`, and the same for `GROWTH` and `PRO`. Also set `PADDLE_API_KEY`, `PADDLE_ENV` and `PADDLE_CHECKOUT_URL`.

| product | price | interval |
| --- | --- | --- |
| Garuka Starter | $12 | monthly |
| Garuka Starter | $120 | yearly |
| Garuka Growth | $29 | monthly |
| Garuka Growth | $290 | yearly |
| Garuka Pro | $49 | monthly |
| Garuka Pro | $490 | yearly |

Trial: none on the Paddle price. The 15-day trial is ours, in `orgs.trial_ends_at`, so nobody is charged by surprise.

**Flutterwave (RWF, MoMo, Airtel Money, card).** There are no subscription objects: we send an invoice and a payment link each period (`openInvoice`). Amounts come from `PRICES`, so only the API keys and the webhook secret are needed.

Stripe is not used. The skill's Stripe step maps to Paddle (card) and Flutterwave (mobile money) here.
