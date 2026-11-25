# Test plan: loyalty clone v1 (web dashboard, join page, web card, scanner)

Build: `bc702c7` (branch `recon/loyalty-clone`)  Date: 2026-11-25  Env: local, `next dev` on :3100, pglite-server on :54321, seed data from `db/seed.mjs` (reseeded before and after every run).

**How to read this.** Every case is numbered `Fxx-Hn` (happy), `Fxx-En` (edge) or `Fxx-Nn` (negative). **auto** = Playwright spec in `web/e2e/` (test title starts with the case ID); **manual** = checked by hand or by script during the manual pass, or still to do; **needs keys** = can't be tested until Apple, Google, Paddle, Flutterwave or Resend accounts exist (none are configured; wallet routes answer 503 and payments switch plans directly in dev). Result: **pass**, **FAIL → B-0xx** (see `bugs.md`), **blocked** (can't reach the step because of a bug), or **todo**.

Every automated test also fails on any console error, any 5xx response, and any serious or critical axe violation on each screen it visits (see "Checks in every spec" at the end). Specs tagged `@mobile` run a second time at 390 × 844.

## Last run (2026-11-25)

`cd web && npm run e2e`: **132 tests** (115 desktop + 17 at 390 px), **107 passed, 25 failed**, about 5 minutes. Every failure is an app bug in `bugs.md` (B-001 accounts for 6 of them). No test needed a retry.
Plan: 147 numbered rows: 114 automated, 19 manual, 14 needs keys. Of the manual rows, 6 passed in the manual pass, 10 are still todo (most need a real phone or camera) and 3 are features not built yet.

## F01 Merchant signs up and starts trial (S01, S02, S03, S20) — `auth.spec.ts`, `settings.spec.ts`

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F01-H1 | happy | /signup, business name, email, 10+ char password, Create account | lands on /cards, empty state "Make your first card", trial banner "N days left" | auto (+390) | pass |
| F01-H2 | happy | /login with email in upper case and spaces, right password | /cards with the Coffee card | auto (+390) | pass |
| F01-H3 | happy | forgot → outbox link → new password twice | /login?reset=1 "Password changed"; other device signed out; new password works; link works once | auto | pass |
| F01-E1 | empty input | submit empty sign-up form | "Enter your business name.", stays on /signup | auto | pass |
| F01-E2 | edge | password of 6 chars | "Use at least 10 characters", email and name kept | auto | pass |
| F01-E3 | long + emoji | business name of 66 chars with accents and ☕️ | stored exactly, shown in the sidebar | auto | pass |
| F01-E4 | double click | double-click Create account | one user, one org, no orphan org | auto | pass |
| F01-E5 | edge | open the verification link from `outbox_emails`, then again | "Email confirmed", then "expired or was already used" | auto | pass |
| F01-E6 | expired session | delete the session row, then send a message | sent to /login, nothing saved | auto | pass |
| F01-E7 | two devices | Settings → Sign out on all devices | both browsers signed out | auto | pass |
| F01-E8 | edge | signed-out visit to 7 dashboard URLs | each redirects to /login | auto | pass |
| F01-E9 | second business | sign up business B, open A's card/customer/design URLs; scan A's code via API | 404 on every page, "card_not_found" from the scanner API | auto | pass |
| F01-E10 | edge | public join link while signed in elsewhere | join form shows | auto | pass |
| F01-E11 | emoji | Settings: business name with ☕ | saved, shown in sidebar | auto | pass |
| F01-E12 | edge | delete account (type the name to confirm), then open the business's join link | join closed ("Your cards stop working") | auto | FAIL → B-012 |
| F01-E13 | time zone | sign up from a browser in another zone | zone from browser stored, shown "Time zone: …" | manual | todo |
| F01-E14 | keyboard only | Tab through sign-up and log-in | logical order, visible focus, Enter submits | manual | pass |
| F01-E15 | offline / slow network | submit sign-up offline | browser error page, nothing created | manual | todo |
| F01-N1 | negative | sign up with the owner's email in upper case | "An account with this email already exists" | auto | pass |
| F01-N2 | wrong password | wrong password | "That email and password don’t match.", email kept, no session | auto | pass |
| F01-N3 | negative | 9 wrong passwords in 15 min | "Too many tries" | auto | pass |
| F01-N4 | negative | reset for an unknown email | same "Check your email" screen (no leak) | auto | pass |
| F01-N5 | needs keys | verification and reset emails actually delivered | arrive in an inbox from EMAIL_FROM | needs keys (Resend) | — |
| F01-N6 | needs keys | Google sign-in | — (should-have, not built) | needs keys | — |

## F02 Merchant designs and publishes a stamp card (S03–S08, S10, S11, S12) — `designer.spec.ts`

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F02-H1 | happy | New card → name on card, icon, 11 stamps, reward "Free smoothie" → Save → Go live → confirm | "Saved.", Go live enabled, overview "Your card is live" + QR, join page "11 stamps, then free smoothie on us" | auto | FAIL → B-001 |
| F02-H2 | happy | New card → Go live without edits | live, overview with QR | auto | pass |
| F02-E1 | edge | new card named "COFFEE CARD" | "You already have a card with this name." | auto | pass |
| F02-E2 | plan limit | create a 3rd design on Growth | "3 of 3", New card replaced by "Upgrade for more cards" | auto | pass |
| F02-E3 | edge | remove the Phone field | warning, tab marked "(has errors)", save refused with "Keep email or phone…" | auto | FAIL → B-001 (generic error instead) |
| F02-E4 | very long input | 80-char card name | input stops at 60 | auto | pass |
| F02-E5 | very long input | link label of 51 chars | error names the link label | auto | FAIL → B-001 (masked; see To check T-03) |
| F02-N1 | negative | draft card | no Overview / Customers / Messages / Insights tabs | auto | pass |
| F02-E6 | edge | type 0 or 99 in the stamps stepper | clamps to 1 and 30 | manual | pass |
| F02-E7 | edge | logo / icon upload, image wrong size | — (not built, needs storage) | manual | — |
| F02-E8 | needs keys | install a preview pass on a phone | — (needs Apple Pass Type ID) | needs keys | — |
| F02-E9 | keyboard only | design tabs, icon radios, stepper with keyboard | reachable, arrow keys move between tabs | manual | todo |
| F02-E10 | 390 px | designer on a phone | sticky save bar, no sideways scroll | manual | pass |

## F03 Merchant edits a live card and pushes the update — `designer.spec.ts`

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F03-H1 | happy | open the live Coffee card designer | "This card is live", no stamp stepper, expiry radios don't change | auto | pass |
| F03-H2 | happy | change "Name on the card", Save | success message, DB updated, total stamps and expiry unchanged | auto | FAIL → B-001 (DB updated but "Something went wrong") |
| F03-H3 | happy | Signup form → add Email field → Save | field stored | auto | FAIL → B-001 |
| F03-H4 | happy | Update all cards twice | "Updating N cards.", then the 10-minute cooldown message | auto | pass |
| F03-E1 | edge | Pause → confirm → Resume | banner "This card is paused", then "Live again." | auto | pass |
| F03-E2 | two tabs | tab B saves a new name, stale tab A saves another field | B's newer value kept (or a conflict warning) | auto | blocked by B-001 |
| F03-E3 | edge | change a locked field through the API (server action) | "This can’t change after the card went live." | manual | todo (no UI path; server check read in code) |
| F03-N1 | needs keys | passes on phones update after "Update all cards" | Apple/Google passes refresh | needs keys | — |

## F04 Customer joins and gets the card (S22, S23, S26) — `join.spec.ts`

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F04-H1 | happy | /j/neza1cup, name with accent, 0788… phone, birthday 14 Feb, consent ticked | /c/{serial} "You’re in!", "Hi Aimée", "10 more stamps", QR + typed code; phone stored +250…, consent + text stored | auto (+390) | pass |
| F04-E1 | consent | leave consent alone | box starts unticked, stored false | auto | pass |
| F04-E2 | empty input | submit empty | both fields marked invalid, messages, nothing stored | auto | pass |
| F04-E3a–e | duplicate phone | same number as `0788…`, `+250 788 …`, `788…`, `250788…`, `00250788…` | always "Check your messages", one customer | auto | a–c pass; d, e FAIL → B-003 |
| F04-E4 | emoji/accents/long | 70-char name with ë, É and 🌸 | stored as typed, "Hi Zoë-Émilie" | auto | pass |
| F04-E5 | very long input | 130-char name | joins, or an error about the name | auto | FAIL → B-004 |
| F04-E6 | negative | phone "12" | "Enter a valid phone number.", name kept | auto | pass |
| F04-E7 | edge | birthday day without month | "Choose both the day and the month." | auto | pass |
| F04-E8 | edge | birthday 31 February | refused with a birthday message | auto | FAIL → B-004 (refused, but message blames phone/email) |
| F04-E9 | double click | double-click Get my card | one customer | auto | pass |
| F04-E10 | keyboard only | Tab/Space/Enter only | focus order name → country → phone → day → month → consent → button; card opens | auto (+390) | pass |
| F04-E11 | back button | join, Back, submit again | "Check your messages", no duplicate | auto | pass |
| F04-E12 | edge | card paused | "This card is paused for now", no form | auto | pass |
| F04-E13 | edge | existing coffee customer joins the café's second live card | second card created | auto | FAIL → B-002 |
| F04-E14 | deleted record | open a deleted card | "This card was closed by the business", goodbye note, no code | auto | pass |
| F04-E15 | privacy | web card | first name only, no phone | auto | pass |
| F04-N1 | negative | unknown code, draft code | 404 | auto | pass |
| F04-N2 | negative | malformed / unknown serial | 404 | auto | pass |
| F04-E16 | refresh mid-flow | refresh the web card | same card; live refresh every 15 s picks up a stamp | manual | pass |
| F04-E17 | slow network | 3G throttling, tap Get my card twice | button busy, one card | manual | pass (1.5 s latency, two taps, one customer) |
| F04-E18 | in-app browser | open link in WhatsApp/Instagram browser | web card works | manual | todo (needs a phone) |
| F04-N3 | needs keys | Add to Apple Wallet / Save to Google Wallet | pass installs | needs keys | — (routes answer 503) |
| F04-N4 | needs keys | restore: existing customer gets their link by email/SMS | link arrives | needs keys (Resend; SMS not built) | — |

## F05 Staff enrols a customer at the counter (S14 add customer) — `join.spec.ts`

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F05-H1 | happy | Customers → Add customer → name, +250 phone → Create card → open link | "Card created", link opens "Hi Counter" | auto | pass |
| F05-E1 | edge | phone typed 0788… | stored +250… (as on the join page) | auto | FAIL → B-005 |
| F05-E2 | edge | add a second customer in the same visit | fresh form | auto | FAIL → B-006 |
| F05-E3 | edge | counter QR on the scanner (S31) | — (should-have, not built) | manual | — |

## F06 Staff stamps a card (S27–S30, S32, S34) — `scanner.spec.ts`

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F06-H1 | happy | owner at /scan → Type the code → Find → + → Add 2 stamps | "2 stamps added", "has 2 of 10"; web card "8 more" | auto (+390) | pass |
| F06-E1 | edge | code typed lowercase with a dash; via API with spaces | input upper-cases and strips; card found | auto | pass |
| F06-E2 | double click | double-click Add 1 stamp | one stamp event | auto | pass |
| F06-E3 | two tabs | two simultaneous requests, same idempotency key | applied once | auto | pass |
| F06-E4 | edge | second stamp within 5-min cooldown | "stamped a moment ago" | auto | pass |
| F06-E5 | edge | stepper past 5 / type 9 / API 7 | stops at 5, clamps to 5, too_many_stamps | auto | pass |
| F06-E6 | edge | 5 then 2 more in a day | daily_limit_reached | auto | pass |
| F06-E7 | expired session | delete session on the transaction screen, submit | "This phone needs pairing again" with the code input, nothing saved | auto | pass |
| F06-E8 | offline | offline at submit | "No connection", nothing saved | auto | pass |
| F06-E9 | keyboard only | scan by keyboard only | card found and stamped | auto (+390) | pass |
| F06-E10 | edge | confirm step on | "Yes, save it" before saving | auto | pass |
| F06-E11 | edge | Recent scans | lists "+1 stamp" | auto (+390) | pass |
| F06-E12 | refresh | turn confirm on, reload | setting kept | auto | FAIL → B-015 |
| F06-N1 | deleted record | scan a deleted card | "This card was deleted by the business." | auto | pass |
| F06-N2 | negative | forged QR, unknown code | invalid_code; "No card with that code" | auto | pass |
| F06-N3 | negative | programme paused | "This card’s programme is paused." | auto | pass |
| F06-N4 | negative | expired card | "This card has expired." | auto | pass |
| F06-N5 | second business | B's scanner on A's card | not found | auto (F01-E9) | pass |
| F06-E13 | edge | real camera scan with BarcodeDetector / ZXing | QR read, card found | manual | todo (needs a phone camera) |
| F06-E14 | edge | camera permission denied | "Camera blocked" + type-code option | manual | todo |

## F07 Customer earns and redeems a reward — `scanner.spec.ts`

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F07-H1 | happy | card at 9 → add 1 + Give reward | "1 stamp added · Reward given", 0 stamps, barcode rotated, old QR "card_replaced" | auto | pass |
| F07-E1 | stale card | after a redemption, use the typed code from an old screenshot | refused like the old QR | auto | FAIL → B-007 |
| F07-E2 | edge | card at 8 + 5 | 3 stamps + 1 reward banked | auto | pass |
| F07-E3 | happy | web card after the 10th stamp | "Your reward is ready", "1 × Free coffee" | auto (+390) | pass |
| F07-N1 | negative | redeem with no reward | no_reward_available; no reward toggle | auto | pass |
| F07-N2 | needs keys | lock-screen "reward ready" notification | arrives once | needs keys | — |

## F08 Merchant stamps or rewards remotely (S14–S16) — `customers.spec.ts`

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F08-H0 | happy | customers list, Show more, search "Isaac", sort by name | counts, 1 match, no sideways scroll with the 55-char seeded name | auto (+390) | pass |
| F08-H1 | happy | card detail → + + → Add 3 | "3 stamps added", timeline "Neza Owner added 3 stamps" | auto (+390) | pass |
| F08-E0 | edge | search "%_%" | literal match, no results state, Clear search | auto | pass |
| F08-E1 | double click | double-click Add 1 | one stamp | auto | pass |
| F08-E2 | edge | remove 2 of 2 stamps | 0 stamps; stepper no longer offers removal | auto | FAIL → B-014 |
| F08-E3 | edge | give a banked reward while paused | allowed from the dashboard | auto | pass |
| F08-E4 | edge | clear phone and email; then accents + emoji name | "Keep an email or a phone number."; then saved | auto | pass |
| F08-N1 | deleted record | unknown card id in URL | 404 | auto | pass |
| F08-E5 | 390 px | overview and menu on a phone | no sideways scroll, menu dialog | auto (390 only) | pass |

## F09 Merchant sends a push message (S17) — `messages.spec.ts`

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F09-H1 | happy | type message with emoji → Send → confirm "Send now" | success line reports the promised reach; listed under Sent; shown on web cards | auto (+390) | FAIL → B-008 |
| F09-E1 | empty input | empty, spaces only | Send disabled | auto | pass |
| F09-E2 | very long input | 301 chars / 300 chars | "301 / 300", disabled / enabled | auto | pass |
| F09-E3 | two tabs | card paused elsewhere, then send | error, typed text kept | auto | FAIL → B-009 |
| F09-E4 | emoji/accents | "Café au lait ☕️ 🇷🇼 — très bon" | stored and shown intact | auto | pass |
| F09-E5 | expired session | session deleted before Send | /login, nothing sent | auto (F01-E6) | pass |
| F09-N1 | needs keys | passes receive the push; 3-per-day budget skips | delivered/skipped counts | needs keys | — |

## F10 Location alert fires (S18, S06) — `settings.spec.ts`

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F10-H1 | happy | Add location with emoji name and coordinates | listed, "3 of 3", Add disabled, attachable in the designer | auto (+390) | pass |
| F10-E1 | edge | add a second location in the same visit | fresh form | auto | FAIL → B-006 |
| F10-E2 | negative | latitude 123, longitude "abc" | "Enter a valid latitude and longitude" | auto | pass |
| F10-E3 | happy | edit name, delete | renamed, then gone | auto | pass |
| F10-E4 | edge | 11th location on a card | checkbox disabled at 10 | manual | todo (needs Pro plan + 11 places) |
| F10-N1 | needs keys | lock-screen suggestion near the place | shown by iOS/Android | needs keys + device | — |

## F11 Merchant reviews results (S12, S13) — `customers.spec.ts`

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F11-H1 | happy | Insights → Show as table | table of stamps and new customers per day | auto (+390) | pass |
| F11-E1 | time zones | a stamp at 01:30 Kigali time | counted on the local day | auto | FAIL → B-013 |
| F11-E2 | edge | Export | — (not built) | manual | — |

## F12 Merchant deletes a customer (S15) — `customers.spec.ts`

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F12-H1 | happy | Delete with goodbye note → confirm | "Card deleted"; web card closed with note; scanner card_deleted; same phone can join again | auto | pass |
| F12-E1 | deleted record | search for the deleted customer | not listed | auto | pass |

## F13 Owner adds a counter phone (S19, S27) — `settings.spec.ts`

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F13-H1 | happy | Pair a phone "Back bar ☕" → code typed in lowercase on a 390 px phone → stamp → revoke | paired as "Scanner · Back bar ☕", event names the phone, can't open /cards, code single-use, revoked phone sees "This phone needs pairing again" naming the removed phone | auto (+390) | pass |
| F13-E1 | edge | pair a second phone in the same visit | new form / new code | auto | FAIL → B-006 |
| F13-E2 | negative | expired code; 11 wrong codes | "That code didn’t work"; "Too many tries" | auto | pass |
| F13-N1 | permission denied | paired phone requests the customers page | redirected to /login | auto | pass |

## R Counter phone recovers by itself (fixes.md #1, #3, #4) — `scanner-recovery.spec.ts`

| id | type | steps | expected | how | status |
| --- | --- | --- | --- | --- | --- |
| R1 | revoked device | paired phone is removed, then looks up a card; owner makes a new code; phone types it | "This phone needs pairing again" naming the phone, code input on the same screen; new code restores it with no reload; stamping works | auto (+390) | pass |
| R2 | cookie lost | paired phone loses its cookie, reloads | says the pairing still exists but this browser forgot its sign-in | auto | pass |
| R3 | no silent logout | inspect the device cookie and schema | httpOnly cookie lasts 400 days; scanner_devices has no expiry column | auto | pass |
| R4 | timeout after save | first submit reaches the server but the answer is lost; Retry | "No connection — nothing was saved" with Retry focused; Retry sends the same idempotency key; exactly one stamp and one event | auto | pass |
| R5 | offline submit | offline, submit, Retry still offline, back online, Retry | card stays open, nothing saved until online, then one stamp | auto | pass |
| R6 | flaky lookup | first lookup request dropped | retried once automatically, card opens | auto | pass |
| R7 | crash | malformed lookup answer makes the card screen throw | "The scanner stopped" with "Restart scanner"; restart works; crash kept as last error | auto | pass |
| R8 | self-check | Scanner settings → Check this phone | connection, pairing, camera, QR reader, clock each with a plain result | auto | pass |
| R9 | update mid-shift | server reports a newer build while a card is open | "Update ready · installs after this card", no reload until back at the camera | auto | pass |
| R10 | problem report | paired phone → Report a problem; owner opens Counter phones | report listed with the phone name and scrubbed last error (no card code or phone number); phone shows Online | auto | pass |
| R11 | report API | unpaired phone posts a report; paired phone posts extra fields | 401 `not_paired`; only whitelisted, scrubbed fields stored | auto | pass |
| R12 | real phone | camera permission states and WASM decoder on a cheap Android | self-check matches reality | manual | todo (needs a phone) |

## F14 Trial ends, plan and billing (S21) — `settings.spec.ts`

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F14-H1 | happy | Choose Pro (dev mode) | "Plan changed (development mode…)", "You’re on Pro.", trial banner gone | auto (+390) | pass |
| F14-E1 | edge | plan_status = locked, then send a message | banner "Editing is paused"; send refused | auto | FAIL → B-010 |
| F14-E2 | edge | downgrade to Starter while using 2 designs | refused or explained | auto | FAIL → B-011 |
| F14-N1 | negative | unsigned Paddle webhook | 4xx | auto | pass |
| F14-N2 | needs keys | Paddle checkout with a test card | subscription active | needs keys (Paddle) | — |
| F14-N3 | card declined | Paddle test card declined | error, plan unchanged | needs keys (Paddle) | — |
| F14-N4 | needs keys | MTN MoMo / Airtel Money via Flutterwave | invoice paid, plan active | needs keys (Flutterwave) | — |
| F14-E3 | time zones | trial end and billing job at day boundaries | correct day count | manual | todo |

## F15 Birthday message (S35) — `messages.spec.ts`

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F15-H1 | happy | switch off, on, change message with emoji | "Saved. It’s off/on.", stored | auto (+390) | pass |
| F15-E1 | edge | no Birthday field on the form | prompt shown, switch disabled | auto | pass |
| F15-E2 | edge | field removed while ON | can still switch it off | auto | pass |
| F15-E3 | empty input | empty message | "Write the message." | auto | pass |
| F15-E4 | time zones | run `/api/cron/automations` with CRON_SECRET | today's birthdays (business time zone) claimed once; web card shows the note | manual | pass (see bugs.md, manual pass notes) |
| F15-N1 | needs keys | birthday push reaches a wallet pass | lock-screen message | needs keys | — |

## F16 Win-back message (S35) — `messages.spec.ts`

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F16-H1 | happy | 45 days, switch on | saved, forecast shown | auto | pass |
| F16-E1 | edge | 3 days, switch on | "Choose between 7 and 365 days.", switch back off | auto | pass |
| F16-E2 | edge | first run after switching on | no day-one blast to old lapsed customers | manual | todo (only read in the job SQL: `last_visit_at >= enabled_at - days`) |
| F16-N1 | needs keys | win-back push on a pass | delivered once per lapse | needs keys | — |

## Checks in every spec

- **Console errors** fail the test (`support/fixtures.ts`: `console` type `error` and `pageerror`). A test may allow a specific expected one (a 4xx it provokes on purpose, or `ERR_INTERNET_DISCONNECTED` in the offline test); each allowance is in the test itself.
- **5xx responses** fail the test (no allowances are used).
- **axe** (`@axe-core/playwright`, WCAG 2.0/2.1 A and AA + best-practice) on each screen visited; serious or critical violations fail. Excluded: only `nextjs-portal` (the Next.js dev-tools indicator, dev only). The scan waits for running animations to finish, because dialogs fade and pop in and axe reads mid-fade text as low contrast.
- **Login** uses a fresh session row (`support/db.ts: createSessionToken`), not the form, so the 8-per-15-minutes login limit never trips. The login form itself is covered by F01-H2 and F01-N2/N3.
- **Reseed**: `globalSetup` removes throwaway `@example.test` accounts and runs `db/seed.mjs`; `globalTeardown` does the same, so the demo café is left as seeded.
