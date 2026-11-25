# Fixes: what Loopy Loyalty's users hate, and what we do about it

Date: 2026-11-25. Skill: replica-entrepreneur. Inputs: `reviews.csv` (30 rows), `feedback.md` (ranker output), the public pages listed below.

## Sample: small, and said plainly

**30 public reviews of Loopy Loyalty, from 3 sources:**

| source | rows | how it was read |
| --- | --- | --- |
| App Store, "Loopy Loyalty Stamper" (id945301614) | 11 | Apple's official customer-reviews RSS feed for US, GB, AU, CA, NZ, IE and ZA. Only US (8), GB (2) and AU (1) had reviews. The feed has no per-review URL, so each row links the storefront feed it came from and notes Apple's review id. |
| Google Play, `com.loopyloyalty.app.scanner` | 14 | "See all reviews" in a browser, US / English. That's every review with text that the dialog loaded; the other ~64 of 78 ratings have no text. The UK listing showed no reviews. Play has no per-review URL, so rows link the listing. |
| G2, LoopyLoyalty | 5 | All 6 reviews on the page were read. One was dropped because it describes a returns tool ("I love loop for returns"), not Loopy. G2 has no per-review URL on that page. |

**This is under 30 usable reviews, so it gives a direction, not a ranking.** Most are 1-star reviews of the staff app, so the sample leans toward the scanner. Dashboard complaints are underrepresented.

**Sources that could not be used:**
- **Capterra and GetApp:** a Cloudflare "verify you are human" check. I did not try to get past it.
  - Capterra UK returned 410 Gone.
  - Search snippets say Capterra shows about 67 reviews at 4.6. Those reviews are unread and not counted.
- **Software Advice:** every profile URL tried returned 404.
- **Trustpilot:** no page for loopyloyalty.com (404).
- **Reddit:** blocked to both the browser and web search here. The public JSON returned an HTML wall. Nothing from Reddit is counted.
- **Hacker News:** the Algolia API returned **0** threads or comments about Loopy Loyalty. The only HN hits were general wallet-pass talk, and none is quoted as evidence.
- **SourceForge:** a listing with 0 reviews.
- **Loopy feature-request board:** none found. Requests seem to go through support chat. Its changelog (help article 1043131, 2022) was read so we don't "fix" what they already ship.

**Vendor-side evidence.** This is Loopy's own help center: their words, not users'. It's used to support findings, never counted as reviews.
- [What if my customers don't have Google Wallet?](https://docs.loopyloyalty.com/en/articles/1002521-what-if-my-customers-don-t-have-google-wallet) sends those customers to a third-party Android app, Wallet Passes, which they have to install.
- [Why aren't my stamps updating on my card?](https://docs.loopyloyalty.com/en/articles/993767-why-aren-t-my-stamps-updating-on-my-card) warns in bold not to send the preview card to customers. The preview pass trap is real enough to need its own article.

**How the ranker was run.** I used the default `themes.json`, plus four loyalty themes in a scratch copy: stamper failures, locked out of the scanner, customers can't get the card, and fraud. That copy stays outside the project. The counts below are **hand-checked**, because the regex ranker double-counted some rows and mis-tagged others. For example, it filed a login complaint under pricing because the review mentions "$25 monthly subscription".

## 1. What they hate (ranked)

| # | problem | reviews | sources | dates |
| --- | --- | --- | --- | --- |
| H1 | **The stamper fails at the counter**: it crashes, freezes, closes itself or can't stamp, and the queue waits | 6 | 2 (Google Play, App Store) | 2023–2026; 4 of 6 since Dec 2024 |
| H2 | **Support is slow, uncaring or a bot** | 5 | 3 (App Store, Google Play, G2) | 2018–2025 |
| H3 | **Locked out of the shop device**: it logs out after every use, won't let you log in, or you're told to buy a new device | 4 | 1 (App Store, 3 storefronts): **thin** | 2017–2025 |
| H4 | **Too expensive for what it is** | 4 | 2 (Google Play, G2) | 2018–2019: **old** |
| H5 | **Changes don't stick, or an update breaks it**: business details not saved, an update broke a working app, the website is buggy | 4 | 3 (Google Play, App Store, G2) | 2017–2026 |
| H6 | "Hackable" (no detail given) | 1 | 1: **thin** | 2021 |

Quotes, verbatim and linked:
- **H1:**
  - "I scan a barcode and in less than half a second it turns off by itself." ([Google Play, 1★, 2023](https://play.google.com/store/apps/details?id=com.loopyloyalty.app.scanner&hl=en&gl=US&showAllReviews=true))
  - "stamp doesn't work most of the time." ([Google Play, 1★, 2026](https://play.google.com/store/apps/details?id=com.loopyloyalty.app.scanner&hl=en&gl=US&showAllReviews=true))
- **H2:**
  - "customer service takes 23hrs to reply." ([App Store GB, 1★, 2024](https://itunes.apple.com/gb/rss/customerreviews/id=945301614/sortBy=mostRecent/json))
  - "Customer service is a bot" ([G2, 0/5, 2021](https://www.g2.com/products/loopyloyalty/reviews))
- **H3:**
  - "The app logs out after every use." ([App Store AU, 3★, 2025](https://itunes.apple.com/au/rss/customerreviews/id=945301614/sortBy=mostRecent/json))
  - "they told me I have to buy a new device in order to redeem the stamps." ([App Store US, 1★, 2025](https://itunes.apple.com/us/rss/customerreviews/id=945301614/sortBy=mostRecent/json))
- **H4:**
  - "Very expensive subscription." ([Google Play, 2★, 2018](https://play.google.com/store/apps/details?id=com.loopyloyalty.app.scanner&hl=en&gl=US&showAllReviews=true))
  - "$50 for just a month is pretty steep for something this simple." ([G2, 4/5, 2018](https://www.g2.com/products/loopyloyalty/reviews))
- **H5:**
  - "I updated all business information twice and the app never saved my updates." ([Google Play, 2★, 2018](https://play.google.com/store/apps/details?id=com.loopyloyalty.app.scanner&hl=en&gl=US&showAllReviews=true))
  - "so bad update it was working fine before why update!!!!" ([Google Play, 1★, 2026](https://play.google.com/store/apps/details?id=com.loopyloyalty.app.scanner&hl=en&gl=US&showAllReviews=true))
- **H6:** "Hack able" ([G2, 0/5, 2021](https://www.g2.com/products/loopyloyalty/reviews))

H1 and H3 describe the same moment: **the counter stops working.** Together they make 10 of the 30 reviews, and 9 of those 10 are rated 1 to 3 stars.

**What they like (keep it):** simplicity. 7 reviews praise how easy it is, for example "Scanning is super simple" ([App Store US, 5★, 2025](https://itunes.apple.com/us/rss/customerreviews/id=945301614/sortBy=mostRecent/json)). Whatever we add must not cost the counter that.

## 2. What is missing (asked for by name)

Every item here is **thin**: one review each.
- **More customisation:** "a few more options for customization would be ideal." ([G2, 4.5/5, 2019](https://www.g2.com/products/loopyloyalty/reviews))
- **More than one card design on the entry plan:** the base plan "only allows one stamp design." ([G2, 4.5/5, 2018](https://www.g2.com/products/loopyloyalty/reviews)) This is a pricing point and goes to /replica-launch.
- **A way for Android customers to get the card:** "no customer centric Android app, only one for iPhone." ([Google Play, 1★, 2018](https://play.google.com/store/apps/details?id=com.loopyloyalty.app.scanner&hl=en&gl=US&showAllReviews=true))
  - In 2018, Google Wallet loyalty cards were not where they are now.
  - Loopy's own help page still sends customers without Google Wallet to a third-party app.

## 3. What is unsolved (whole jobs the original ignores)

1. **A shop whose only stamping device fails, with no IT person.** This comes from H1, H2 and H3.
   - Loopy's answer in one review was "buy a new device".
   - Nobody in the sample, and none of the competitors read, offers a counter that recovers by itself.
2. **Customers outside the Apple Wallet / Google Wallet happy path.** Evidence: 1 review and Loopy's own help article.
   - **Reasoning, not evidence:** in Kigali this group is larger than in the US or UK. Many customers use low-storage Android phones, sometimes without Play services set up, or have never used a wallet app.
   - Rwanda **is** listed on Google's [Google Wallet country page](https://support.google.com/wallet/answer/12060037?hl=en) (checked 2026-11-25). I did not verify whether that covers loyalty passes or only payments.
3. **Very small budgets.** H4 is old, and US/UK prices since then are $25 to $95 a month. **Reasoning:** a Kigali café can't pay in USD by card, and $25 a month is a lot of coffee there. No competitor read bills in mobile money.

## Competitors' public review themes

These are separate from Loopy's counts, so they don't skew its ranking.

**Stamp Me** (app-based: customers install an app). Source: [App Store RSS, AU/US/GB](https://itunes.apple.com/au/rss/customerreviews/id=485578470/sortBy=mostRecent/json), 189 reviews read, 44 at 3★ or below.
- **The app breaks (crashes, won't open, errors):** 20+ of the 44. About 10 of those say stamps or rewards were lost, for example "Just when I’ve reached my free car Wash after 10 washes the App refuses to open." (AU, 1★, 2022)
- **Phone-number sign-up fails:** 3 reviews (GB 2022 ×2; AU 2022 says the verification code never arrives).
- **A reward vanishes once it's opened before the till:** 2 reviews (US 2025, AU 2022).
- **"Location always on":** 5 reviews, all 2015–2017 (old).

**Boomerangme** (wallet passes, sold through agencies). Source: [G2](https://www.g2.com/products/boomerangme/reviews), 4.8 from 125 reviews; I read the first page of 10.
- Mostly praise from agencies.
- **Billing after the trial, with no way to cancel:** 1 review, "468 dollars (NZ) was deducted".
- **A forced paid add-on, and support that "talk like machines":** 1 review.
- **Customisation and reports limited:** 3 mentions. G2's summary also lists "Lack of Customization (3)".

**PassKit** (Loopy's parent; pass platform). G2: **no reviews**. Its PassReader app ([App Store RSS](https://itunes.apple.com/gb/rss/customerreviews/id=1564208423/sortBy=mostRecent/json), 3 reviews):
- costly setup: an Apple developer certificate, and support slots late at night;
- no list of who has checked in.

**Across competitors:** when the customer's app or the staff app fails, the customer loses their stamps. Billing traps and robotic support come up again. Wallet passes beat apps for adoption, and the Boomerangme reviewers say so themselves.

## Kigali small-business needs: **reasoning, not evidence**

None of this comes from reviews. It's what we believe about cafés, salons and gyms in Kigali, to be checked in customer interviews (/replica-launch).
- **Mobile money.** Owners pay by MTN MoMo or Airtel Money, not card. Built.
- **WhatsApp.** It's where customer conversations already happen, so card links and support should arrive there. Partial: staff copy links by hand.
- **Languages.** Kinyarwanda, French and English on everything a customer or counter staff member sees. Not built.
- **Cheap Android phones on patchy data.** The counter must be a light web app that survives a bad connection and a reboot.
  - Partial: it's a web scanner with honest "nothing was saved" errors.
  - Not built: service-worker caching, and a real cheap-phone test.
- **Shared counters with rotating staff.** No passwords on shop phones. Built: paired counter phones.

## 4. The fix plan, in priority order

Priority is evidence × cheapness. **Built** means it's already in the clone; **New** means it's in this plan and not built.

| # | what to build or change | status | size | skill | evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | **A counter that recovers by itself.** Paired phones never get silently logged out: device tokens have no expiry today, so keep it that way and test it. The scanner error screen gets "re-pair this phone" (a new 6-digit code from the owner, 30 s) and a self-check covering camera, connection and clock. If the camera fails, staff type the code. Test it on a cheap Android phone before every release. | **New**, on top of **built** paired phones and typed-code fallback | M | /replica-build, /replica-test | H1 + H3: 10 reviews, 2 stores |
| 2 | **Any number of counter phones per location, re-paired in seconds.** No "buy a new device" ever. | **Built** (paired counter phones, revocable). The plan's phone limit is a /replica-launch decision. | – | – | H3 |
| 3 | **Updates never break the counter.** Version the scanner, take an update only between scans, keep a server-side kill switch and roll back with one click. There's no service worker in `web/` yet. | **New** | S–M | /replica-build, /replica-deploy | H5 (2 of 4 are "an update broke it") |
| 4 | **Support by a person, on WhatsApp.** A WhatsApp support link with a stated reply time, plus "report a problem" in the scanner that attaches the device, version and last error. | **New** | S | /replica-backend | H2: 5 reviews, 3 sources |
| 5 | **Changes that save and show.** The designer save bug B-001 is marked fixed: commit 5cf0066 fixes every S1/S2 bug, and parity.md records 132/132 tests passing. I did not re-run the tests. Next: a stampable preview pass, so "preview vs live" confusion can't happen. | **Built** (save, "Update all cards"); preview pass **planned** (row exists; needs the Apple Pass Type ID) | S once the cert exists | /replica-backend | H5, and Loopy's own preview-trap help article |
| 6 | **A card on every phone, with the link sent by WhatsApp.** Today staff copy the link by hand. | Web card **built**; WhatsApp delivery at join and on lost-card restore **New** | M (WhatsApp Business Platform approval) | /replica-backend | Missing #3 (thin) plus Loopy's help doc; reasoning for Kigali |
| 7 | **Kinyarwanda, French and English** on the join page, web card and scanner. | **New** | M | /replica-build | Reasoning only |
| 8 | **Price that fits a one-counter shop:** RWF prices, MoMo / Airtel Money, a low entry plan with more than one design. | MoMo / Airtel **built**; plan design goes to **/replica-launch** | – | /replica-launch | H4 (old), Missing #2 |

Also already built, but with **no direct review demand in this sample**:
- Signed QR codes that rotate after each reward. This answers H6, which is thin.
- No-leak joining.
- Birthday and win-back automations.
- Honest message reach.
- Image upload.

Keep them, but don't lead the pitch with them on this evidence. One related point: a reward that vanishes when the customer views it (Stamp Me) can't happen here, because only a counter phone redeems. That's by design and wasn't re-verified in this run.

New rows added to `features.csv` (original = `no`), with existing rows untouched:
- self-recovering scanner;
- safe scanner updates;
- WhatsApp support with diagnostics;
- card link sent by WhatsApp;
- three-language customer and counter pages.

## 5. The angle

**Option A (recommended): the counter never stops.**
> For café, salon and gym owners whose stamping app freezes, logs out or "needs a new device" while a customer waits, [our app] runs the stamp counter on any phone's browser, re-pairs in seconds and recovers by itself, with a person answering on WhatsApp.
> Evidence: H1 + H3, 10 of 30 reviews across 2 stores, plus H2 (5 reviews, 3 sources).

**Option B: built for where you are.**
> For small businesses in Kigali whom wallet-only, card-billed, English-only loyalty apps leave out, [our app] gives every customer a card on any phone, sends it by WhatsApp, bills by MoMo and speaks Kinyarwanda, French and English.
> Evidence: thin. 1 review, Loopy's own help article and H4 (old); the rest is reasoning.

**Option C: simple, and it stays simple.**
> For owners who chose a stamp card because it was easy, [our app] keeps the counter to one button: scan, plus, done, and nothing breaks after an update.
> Evidence: 7 positive reviews on ease, plus H5 (4 reviews, 3 sources).

**Recommendation: A as the promise, with B as the Kigali packaging.** A is the best-evidenced pain and the one competitors don't answer. B is what makes A matter locally, but it's reasoning until interviews confirm it.

Rules:
- Don't use Loopy's name in our name, ads or store listing.
- A side-by-side comparison page is a question for a lawyer.
- Reviewers' words are research, not testimonials. They never go on our site.

Next: `/replica-brand`.
