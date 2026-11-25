## Parity: 69.0 / 100

features 69.0  (76 counted, must-haves 30 of 45 done)

Not shippable yet: 15 must-have features are not done.

## By area, weakest first
- team                           0.0  (1 features)
- integrations                   0.0  (2 features)
- messaging                     42.9  (6 features)
- wallet                        50.0  (4 features)
- designer                      61.4  (22 features)
- billing                       63.6  (4 features)
- analytics                     66.7  (3 features)
- scanner                       70.3  (14 features)
- sharing                       87.5  (2 features)
- crm                           94.1  (7 features)
- enrolment                     94.4  (7 features)
- onboarding                   100.0  (3 features)
- locations                    100.0  (1 features)

## Missing, in build order
- [must] designer: Install a preview pass on your own phone, no  (S10; original preview cannot be stamped (common confusion); build: needs Apple signing (backend))
- [must] designer: Upload logo and icon, no  (S04; Apple sizes 480x150 and 87x87; build: logo text only; image upload needs storage (backend))
- [must] billing: International card billing with tax handled (merchant of record), partial  (Paddle; backend: Paddle checkout + signed webhook built and tested with signed events; needs Paddle account)
- [must] billing: Subscription plans with limits on designs locations and staff, partial  (S21; original 1/3/10 designs 1/3/10 locations 3/10/50 staff; build: design/location/phone limits enforced; payments simulated)
- [must] designer: Edit live card and push design changes to all issued passes, partial  (S12; 10 min cooldown at original; build: Update all cards bumps pass versions; no real push until backend; backend: pushes via APNs/Google when keys are set; not tested on devices)
- [must] designer: Pick stamped and unstamped images from built-in set or upload, partial  (S04; our own icon set; build: 10 built-in icons; custom upload not built)
- [must] designer: Reward-earned lock-screen message, plus stamp count text on the pass, partial  (S05; reward message notifies (uses budget); stamp text "You have {n} stamps" is silent; build: texts editable; lock-screen delivery needs wallet backend)
- [must] designer: Terms text and business issuer details on card back, partial  (S07; build: terms built; business issuer block not yet on card back)
- [must] messaging: Location-based lock-screen messages, partial  (S06 S18; v1 scope; Apple max 10 locations per pass; verify current iOS/Google behaviour in architect; build: locations attach to cards; lock-screen relevance needs passes)
- [must] messaging: Push message to all customers of a card, partial  (S17; build: sent + budget applied + shown on web cards; wallet delivery simulated; backend: fan-out with delivery rows and budget; wallet delivery needs keys)
- [must] scanner: Scan pass barcode with phone camera, partial  (S28; build: native BarcodeDetector + self-hosted WASM fallback built; not yet tested with a real camera)
- [must] wallet: Add to Apple Wallet after joining, partial  (S23 S24; needs our own Pass Type ID cert; backend: pkpass + web service built, signed test pass verified; needs Apple Pass Type ID)
- [must] wallet: Pass status tracking issued installed removed, partial  (S14; from wallet register/unregister callbacks; backend: Apple registration + Google callbacks update status; needs keys)
- [must] wallet: Pass updates live when stamped or redeemed, partial  (APNs + Google object update; core of the product; build: web card refreshes every 15 s; wallet passes need backend; backend: APNs + Google PATCH after every stamp; needs keys)
- [must] wallet: Save to Google Wallet after joining, partial  (S23 S25; needs our own issuer account; backend: class/object/save link built; needs Google issuer)
- [should] analytics: CSV export of customers and transactions, no  (S12; top tier only at original; emailed 24h link)
- [should] designer: Background image on pass strip, no  (S04)
- [should] designer: Choose which field shows on pass front, no  (S09)
- [should] designer: Custom label text on pass, no  (S09; gated to mid tier at original)
- [should] designer: Multi reward card (rewards at several stamp positions), no  (later; v1 is single reward only)
- [should] messaging: Push message to a segment with live match count, no  (S17; original one condition only)
- [should] messaging: Push message to one customer, no  (S17)
- [should] scanner: Edit customer details from scanner, no  (S33)
- [should] scanner: Staff enrols a customer by showing a QR, no  (S31)
- [should] team: Staff personal logins with location and limited permissions, no  (S19 full; later; paired devices cover v1)
- [should] billing: Upgrade downgrade cancel and trial-expired lock, partial  (S21; build: trial/past-due/locked banners; plan choice simulated; no cancel flow yet)
- [should] enrolment: Restore a lost card from the same link, partial  (S26; build: join answers “we sent your link”; actual sending needs email/SMS backend; backend: card link emailed to the address on file; SMS not built)
- [should] scanner: Scanner settings (vibrate beep confirm GPS biometrics), partial  (S34; build: vibrate, beep, confirm; no GPS or biometrics)
- [could] crm: Resync a card that disagrees with the server, no  (S15)
- [could] designer: Duplicate a card design, no  (S03)
- [could] designer: Multi-language passes and labels, no  (labels array in original)
- [could] integrations: Public REST API with API key, no  (S20; out of slice but cheap if API-first)
- [could] integrations: Webhooks for enrol stamp reward redeem forfeit, no  (S20)
- [could] messaging: Beacon lock-screen messages, no  (S18; Apple only; hardware needed)
- [could] scanner: Biometric login on scanner, no  (S34; native only)
- [could] scanner: Native iOS and Android scanner apps, no  (PWA first; native later)
- [could] scanner: Record GPS of the stamping device, no  (S34; fraud signal)
- [could] sharing: Poster and tent-card download for the QR, partial  (S12; original lists print promotion in help; build: QR SVG download; no printable poster yet)

## Left out on purpose (not scored)
- Zapier and Make app listings: partner marketplaces; apply separately once we have an API
- Square Acuity Mailchimp integrations: run via partners at original
- Original stamp artwork templates and card templates: owned by Loopy; we draw our own
- PassKit pass-issuing platform: their vendor; we build or rent our own pass engine
- Affiliate programme: business arrangement not product
- Loopy brand name copy and marketing claims: owned by Loopy; /replica-brand makes ours

## Yours, not in the original (not scored)
- Web card page for every customer (live QR, stamps, messages, add to home screen)
- Automated birthday message on the customer's birthday
- Automated win-back message after N days without a visit
- Automations settings per card (on/off, days, message text, preview)
- Bonus stamp or reward attached to birthday / win-back message
- Skip automated messages for opted-out or removed passes
- Billing in RWF with MTN MoMo and Airtel Money (prepaid periods)
- Sign in with Google
- Preview pass that can actually be stamped
- SMS and WhatsApp messages for web-card customers
- Signed rotating barcode (old screenshots stop working)
- Daily stamp cap and cooldown per card
- Sent message history
- Scheduled one-off broadcast at a set date and time
- Rich media (images) in messages

## Layout diff: not run

**No layout score.** It needs the original's screenshots in `replica/screens/` at the same viewport and state, and none were saved:
- During recon, Loopy's public demo page was blocked to our browser.
- The App Store screenshots of its scanner app were listed in `screens/README.md`, but I never downloaded them without your OK.

Our 18 screenshots in `clone-screens/` are ready for the comparison. Two ways to fill the gap:
1. Save the 10 public App Store scanner screenshots (S27–S34), then run `imgdiff.py` against our scanner screens.
2. Use the dashboard as a user would (your own account). That stays off the table: Loopy's terms §3 forbid using an account to build a competing product.

A layout score would cover only the scanner, which matters least for parity. **Feature parity is the number that counts here.**

## Behaviour diff (from the recon flows vs the clone)

| flow | the original | the clone | keep or fix |
| --- | --- | --- | --- |
| F04 join | 3 taps: form, Join, add to wallet. No pass for phones without a wallet. | 3 taps, plus a **web card for every phone**, wallet optional | keep (better) |
| F04 join again with a used phone | Error when unique enrolment is on (top tier) | Neutral "check your messages", link sent to the contact on file; nothing leaks | keep (better) |
| F06 stamp | Scan, +, Submit, (Confirm) | Scan or type the code, +, one button that shows the outcome first ("completes the card") | keep |
| F06 fraud | Logs who stamped and where | Also: signed QR that rotates after each reward (old screenshots fail), cooldown, daily cap, per-scan cap | keep (better) |
| F02 preview | A preview pass that can't be stamped (top support confusion) | In-page preview only; a real preview pass needs Apple signing | **fix**: build the stampable preview once the certificate exists |
| F02 design | Logo, icon and stamp image upload | Logo text and 10 built-in icons; **no image upload** | **fix**: upload with Supabase Storage |
| F09 message | All, segment, one customer; no scheduling | All customers only; budget-honest counts | fix later: segments and single customer (should) |
| F15/F16 automations | **None** | Birthday and win-back, once per period, local time | keep (better) |
| F14 billing | Card only (USD) | Card through Paddle **plus MTN MoMo and Airtel Money** in RWF | keep (better), once accounts exist |
| Staff | Personal staff logins (3/10/50) | Paired counter phones (no passwords); personal logins later | keep for v1 |
| Export | CSV export (top tier) | None | fix later (should) |

## Verdict: **not shippable yet**

- **Parity score:** 69/100. **Must-haves:** 30 of 45 done.
- **Open S1/S2 bugs:** none. The test suite passes 132/132.
- **Why not shippable:**
  - The core of Loopy's product, **a pass in Apple and Google Wallet that updates itself**, is built but switched off until you add the Apple Pass Type ID and the Google issuer.
  - Paddle and Flutterwave payments are in the same position.
  - That's 11 of the 15 open must-haves.
  - The other 4 need code: logo/image upload, the preview pass, the business details block on the card back, and custom stamp images.
- **Already better than the original in five places:**
  - web cards for phones with no wallet;
  - birthday and win-back automations;
  - mobile money billing;
  - rotating signed QR codes;
  - no-leak joining.

  Those are the start of a reason to exist. `/replica-entrepreneur` should add the rest.

## Top five things to build next
1. **Turn the wallets on.** Get the Apple Developer account and Pass Type ID, and the Google issuer with publishing access. Then do the first real-device test of passes, APNs pushes, Google saves and callbacks. *Your accounts first; then the code is already there.* It unlocks 7 must-haves.
2. **Logo, icon and stamp image upload** (Supabase Storage, size and type limits), plus real stamp-strip images (`npm i @resvg/resvg-js`). It unlocks 2 must-haves and makes passes look real.
3. **Payments live in test mode:** a Paddle sandbox and a Flutterwave Rwanda test account, and one real MoMo test payment. It unlocks 2 must-haves.
4. **A stampable preview pass,** plus the business details block on the back of the pass. It unlocks 2 must-haves and fixes the original's top support complaint.
5. **Test camera scanning on a real counter phone** (Android Chrome and iPhone Safari), then messages to a segment or one customer. That's the scanner must-have and the next messaging should-haves.
