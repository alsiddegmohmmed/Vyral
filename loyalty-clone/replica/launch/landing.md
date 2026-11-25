# Landing page: Garuka

Skill: replica-launch. Date: 2026-11-25.
- **Built at:** `/` (`web/app/page.tsx`). The old redirect to `/cards` is gone, and signed-in owners see "Open your dashboard" instead of "Start 15 days free".
- **Tests:** `web/e2e/landing.spec.ts` (L-H1 to L-H3, desktop and 390 px, with axe).
- **Angle:** A, the counter never stops, packaged for Kigali (B). See `fixes.md` §5.
- **Voice:** steady, warm, plain (`brand.md` Step 5).

**Proof rule.** There are no testimonials, user counts, star ratings, press logos or "trusted by" rows. L-H1 fails if the words "trusted by", "customers love" or a ★ appear. Reviewers' words from the research are not used. Section 2 paraphrases the themes.

## 1. Hero

- **Eyebrow:** Stamp cards for cafés, salons and shops
- **Headline:** **A loyalty card your counter can't break.**
- **Line:** Customers get a stamp card on their own phone. Your staff stamp it from any phone at the till, and if that phone fails, another one takes over in 30 seconds.
- **Buttons:** Start 15 days free (primary, to `/signup`), and See how it works (secondary, to `#how`).
- **Under the buttons:** No card or MoMo needed to start. Customers need no app.
- **Image:** a real screenshot of the card overview with demo data (the seeded café, fake people). File: `public/landing/card-overview.jpg`, from `clone-screens/redesign-card-overview-desktop-v3.png`.

## 2. The problem

This section covers the top two "hate" themes from `fixes.md`, paraphrased:
- **H1 + H3 (10 of 30 reviews):** the stamping app freezes, closes or logs out, so the queue waits, and some apps say to buy a new device.
- **H2 (5 reviews, 3 sources):** help is slow, or it's a bot.

## 3. How it works

1. **Design your card:** reward, stamps and colours, with a live preview.
2. **Print one QR code:** customers scan, type a name and phone, and the card is theirs.
3. **Stamp from any phone:** pair it with a short code, then scan and stamp in one tap.

## 4. Features, led by the fixes

Every claim was checked against the code on 2026-11-25:

| feature line | fix (`fixes.md` §4) | where it's built |
| --- | --- | --- |
| A counter that fixes itself: asks for a new code on the spot; self-check of camera, connection and clock | #1 | `app/scan/scanner-app.tsx`, `lib/scanner-health.ts` (checks: network, pairing, camera, decoder, clock) |
| Any phone, never a new device: up to 10 phones on Starter, re-paired free, revoke in one click | #2 | `PLAN_LIMITS`, `settings/devices` |
| Honest when something fails: "nothing was saved", typed-code fallback | #1, #3 | scanner result views, manual entry |
| A person on WhatsApp: "Report a problem" sends the phone's details | #4 | scanner settings, `/api/scan/report`, `SUPPORT_WHATSAPP` |
| A card on every phone: Apple Wallet, Google Wallet or a web card; send the link by WhatsApp or SMS | #6 (the web card part) | `/c/[serial]`, add-customer flow |
| Stamps you can trust: logged per phone; codes change after each reward | built, but not in the pitch's lead (H6 is thin) | `previous_barcode_token`, card events |

**Before launch, the owner must make these claims true:**
- **WhatsApp:** someone answers the WhatsApp number in `SUPPORT_WHATSAPP`. The page promises a person.
- **Apple and Google Wallet:** passes need the Apple Pass Type ID certificate and a Google Wallet issuer account (`parity.md`). Until both exist, customers get the web card only. Drop the wallet words from the page if launch comes first.

**Left off the page because they aren't built:**
- Kinyarwanda and French (fix #7);
- sending the card link by WhatsApp automatically at join (fix #6);
- an importer for existing customers.

## 5. Pricing

This is the table from `pricing.md`, rendered from the same `PRICES` and `PLAN_LIMITS` the billing page uses, so the two can't disagree. Each tier shows its "for …" line.

The intro reads: no price per staff member, every feature on every plan, 15 days free, and yearly is 12 months for the price of 10.

## 6. FAQ (the real objections)

1. Do my customers need to install an app? No.
2. What if the counter phone breaks or gets lost? Pair another phone with a 6-digit code in about 30 seconds.
3. What if the internet drops while we stamp? An honest "nothing was saved", and the typed-code fallback.
4. Can I pay with mobile money? MoMo, Airtel Money or card in RWF; card in USD.
5. What happens if I stop paying? Customers keep their cards, editing pauses, and you can cancel in one click.
6. Can I bring over my paper-card customers? There's no importer yet; add them by hand.

## 7. Final call to action

**Bring your regulars back.** Garuka means "come back". Set up your card today; your first customer can join this afternoon. The button is "Start 15 days free".

## Checks

- **Contrast:** the page uses only token pairs already in `tokens.json`:
  - `text` / `text-muted` on `bg`, `surface` and `accent-subtle`;
  - `accent` on `bg` (the eyebrow);
  - `on-accent` on `accent` (the final call box);
  - `text` on `bg` (its button).
  - `contrast.py` reports 38 pairs, 0 failing AA.
- **Accessibility:** axe (wcag2a/aa, 21a/aa, best practice) is clean at 1440 and 390 px (L-H1). The FAQ answers open from the keyboard (L-H2).
