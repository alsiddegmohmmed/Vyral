# Launch plan: Garuka

Skill: replica-launch. Date: 2026-11-25. Promise: **a loyalty card your counter can't break.** Market: Kigali first, then worldwide.

The **owner** does everything below: posts, outreach, accounts and keys. Nothing here has been sent or published.

## 0. Before anyone sees it (blockers)

| # | item | status | notes |
| --- | --- | --- | --- |
| 1 | Name screening: trademarks (USPTO, EUIPO, CIPO, WIPO, RDB Rwanda), Play, social handles, `.app` / `.co` / `.rw` | to run | `brand.md` Step 2. Get a lawyer's search before spending on the name. |
| 2 | A Kinyarwanda speaker confirms "garuka" reads as a warm "come back" | to run | `brand.md` logo brief |
| 3 | Domain: `garuka.com` is taken; pick `garuka.app`, `getgaruka.com` or `garuka.rw` | to run | |
| 4 | Logo files: SVG, favicon set, 1024 px app icon, 1200×630 social image | not made | `brand.md` Step 4. The page has no favicon or OG image today. |
| 5 | Payment keys: Flutterwave (MoMo, Airtel) and Paddle, plus the 6 Paddle prices | owner creates | `pricing.md` §5 |
| 6 | Wallet passes: Apple Pass Type ID certificate and Google Wallet issuer account | owner applies | Without them, customers get the web card only. Remove the wallet words from the landing and listing if launching first. |
| 7 | A person answering WhatsApp, with a stated reply time, in `SUPPORT_WHATSAPP` | owner | The landing promises a person. Don't launch on a bot or an unwatched number. |
| 8 | Analytics and error tracking live | not built | Use a cookie-free page counter (for example Plausible or Umami) for the landing and sign-up funnel. Use an error tracker (for example Sentry) on the dashboard and the scanner, with customer details scrubbed as the scanner reports already do. |
| 9 | Privacy policy and terms pages | not written | Needed for the stores, Paddle and Flutterwave. The sign-up page already refers to "terms and privacy policy" with no link. |
| 10 | Deploy | next skill | `/replica-deploy` |

## 1. Waitlist and beta (weeks 1–3)

- **Beta list, not a waitlist:** the product works today, so invite shops straight into the 15-day trial and extend it for beta shops. Store "beta" as a note on the org; there's no code for it yet.
- **Ask for one thing:** run Garuka at the real counter for two weeks, and get one 20-minute call at the end.
- **Measure:**
  - joins per QR code per day;
  - stamps per day;
  - how many scanner "Report a problem" sends and pairing failures happen (the devices page lists the reports);
  - whether anyone hits a plan cap.
- **Proof, earned:** at the end, ask permission to quote the owner by name, with their shop's photo. This is the only way testimonials reach the landing page.

## 2. The first 10 shops, by hand (Kigali)

**Who:**
- cafés, juice bars, salons, barbers and car washes with a counter and repeat customers;
- with a mix: some already on paper stamp cards, and some on another loyalty app.

**Where to find them:**
- **Personal network:** walk-ins in Kimihurura, Kiyovu, Kacyiru and Remera.
- **Vyral Labs:** existing contacts and the lead tracker. Ask the owner first; leads are private.
- **Instagram:** the business accounts of Kigali cafés.

**How:**
- Show it on your own phone. Make a card for their shop in 5 minutes, print the QR on the spot, and stamp the owner's own card.
- Bill in RWF by MoMo. Offer the first month free for the beta.

**Questions for every call** (these check the reasoning in `fixes.md`, which isn't evidence yet):
1. What do you use today? What breaks?
2. Who stamps at the counter, and on which phone?
3. Would you pay 15,000 RWF a month? What would make it obviously worth it?
4. Which language should the customer's card be in: Kinyarwanda, French or English?
5. Do your customers use Apple Wallet, Google Wallet, or neither?
6. Would you want card links sent by WhatsApp automatically?

**Record:**
- one row per shop in a sheet: date, answers, and whether they converted;
- update `pricing.md` and `fixes.md` (fixes #6–#8) with what you learn.

## 3. Where the original's unhappy users talk

From the research (`fixes.md`). Most of it is app-store reviews, so reach them with our own listing, not by replying to them:
- **Google Play and App Store reviews of the original's stamper app:** 10 of 30 complain that the counter fails.
  - Our store listing leads with the fix (pair in 30 seconds, self-check, no new device).
  - **Never** name the original in the listing, keywords or ads; `listing.py` checks this.
- **G2 and Capterra category pages for "loyalty program software":**
  - Create a Garuka profile.
  - Don't buy reviews, don't incentivise reviews, and don't post the original's reviewers' words as ours.
- **Reddit (r/smallbusiness, r/barista, r/coffeeshops):** blocked during research, so we have no threads to point to.
  - Join as yourself, answer "our stamp app keeps crashing" questions when they come up, and say you built Garuka.
  - Don't post "alternative to [original]" threads.

## 4. Public launch post (after 10 beta shops)

- **Product Hunt, or "Show HN" on Hacker News.** Lead with the fix, not the clone.
  - **Title:** *Show HN: Garuka, stamp cards with a counter that recovers by itself*
  - **First paragraph:** the counter failure (from public reviews, paraphrased), then what we built: browser-based pairing in 30 seconds, a self-check, honest "nothing was saved" errors, and MoMo billing.
  - **Then:** the beta shops' numbers, with their permission.
  - **Don't:** call it "a [original] clone", or compare by name without a lawyer (`fixes.md` rules).
- **Local:**
  - an Instagram reel of a real counter in Kigali (with permission): scan, stamp, done, then the phone is swapped mid-queue and re-paired;
  - a post in Kigali business WhatsApp groups the owner is already in.

## 5. Store submission (when the counter is wrapped as an app)

The counter is a **web app** today (`/scan`, installable from the browser via `scan.webmanifest`).
- **Ship order:**
  1. The browser install. It needs no store.
  2. Google Play as a Trusted Web Activity.
  3. The App Store, only once the app does more than the website. Apple's guideline 4.2 (minimum functionality) can reject a plain web wrapper. Native camera scanning and offline queueing would be reasons for it to exist.
- **Listing:** `listing.json` passes `listing.py`: 0 errors and 0 warnings, run 2026-11-25. The name and first lines lead with the fixes, which helps with guideline 4.1 (copycats).
- **Screenshots:** take them at the sizes App Store Connect and Play Console ask for on the day of upload (they change). Use the real scanner: camera view, "1 stamp added", the self-check list, and the pairing code screen.
- **Privacy label and data safety form:**
  - the scanner collects no customer data on the device;
  - "Report a problem" sends the device model, app version, browser, last error and self-check results;
  - card codes are scrubbed (`/api/scan/report`).
- **Age rating:** 4+ / Everyone.
- **Review notes:** a demo account the reviewer can use (a seeded demo shop on production, not the dev seed's password), plus a pairing code the reviewer can generate from it, with steps.

## 6. What "launched" means

10 Kigali shops have stamped real customers for 2 weeks; at least 6 of them pay in month two, and none had the counter stop for more than a minute without recovering. Then go to Product Hunt / HN and a second city.

Next: `/replica-deploy`.
