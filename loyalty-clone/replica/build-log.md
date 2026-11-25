# Build log

App: `loyalty-clone/web` (Next.js 16, Tailwind 4). Data: **fake layer** (`lib/data`), persisted to `.data/dev-db.json` and seeded with a Kigali café (`lib/data/seed.ts` has the dev login). It keeps the same signatures as the future Postgres layer, so `/replica-backend` changes no screen code.

Checks used throughout:
- type check (`npm run typecheck`);
- rules tests (`npm test`, 6 tests mirroring `apply_card_transaction`);
- every route requested with a session (all 200; unknown IDs 404);
- browser checks at 1440 px and 390/375 px (no sideways scroll);
- keyboard dialogs (focus starts on the first field, Esc closes, focus returns);
- screenshots saved in `clone-screens/`.

| ID | date | status | missing / notes | harder than expected |
| --- | --- | --- | --- | --- |
| S01 Sign up | 2026-11-25 | done | Time zone from the browser; Google sign-in later (should) | — |
| S02 Log in | 2026-11-25 | partial | Password reset not built | — |
| S03 Cards | 2026-11-25 | done | Empty state, plan limit swaps "New card" for "Upgrade" | — |
| S04 Designer: Design | 2026-11-25 | partial | Live preview and live contrast check work. **Logo/icon image upload not built** (needs storage) | Remounting after save lost the "Saved" message; fixed |
| S05 Designer: Details | 2026-11-25 | done | Reward, texts, expiry (locked when live), links | — |
| S06 Designer: Locations | 2026-11-25 | done | Max 10, disabled past the limit | — |
| S07 Designer: Terms & limits | 2026-11-25 | done | Also holds the scanner limits (per scan, cooldown, per day) | — |
| S08 Designer: Signup form | 2026-11-25 | done | Email or phone always required; system fields once each | — |
| S09 Custom labels | — | not built | Should-have | — |
| S10 Preview pass | — | partial | In-page preview only; a real stampable preview pass needs Apple signing | — |
| S11 Activate | 2026-11-25 | done | Confirm dialog lists what locks | — |
| S12 Overview | 2026-11-25 | done | Stats, wallet split, real QR, pause/resume, "Update all cards" (10-min cooldown) | — |
| S13 Insights | 2026-11-25 | done | 7/30/90 days, SVG chart + table toggle, ROI inputs inline | — |
| S14 Customers | 2026-11-25 | done | Search, sort, show more, stacks on mobile, add customer (link) | — |
| S15 Card detail | 2026-11-25 | done | Timeline, edit details, copy link, delete with goodbye note | — |
| S16 Give stamps | 2026-11-25 | done | Inline on S15 (add/remove/give reward), idempotent | — |
| S17 Messages | 2026-11-25 | partial | Composer, confirm, honest reach and history. **Wallet delivery simulated** | — |
| S18 Locations | 2026-11-25 | partial | Add/edit/delete, "use where I am". **Address search (Places) not built** | — |
| S19 Counter phones | 2026-11-25 | done | One-use 6-character code, 10 minutes, revoke | Dialog focus started on Close, so typing went nowhere; fixed for all dialogs |
| S20 Settings | 2026-11-25 | done | Business details, time zone (validated) | — |
| S21 Plan & billing | 2026-11-25 | partial | Plans, limits, RWF/USD. **Payments simulated**; no cancel flow | — |
| S22 Join | 2026-11-25 | done | Branded, per-type fields, phone to E.164, birthday day+month. Existing customer gets "we sent your link" (no leak) | Copy bug "Enter your your name" caught and fixed |
| S23 Web card | 2026-11-25 | partial | Signed QR, typed code, live refresh 15 s, news, links, terms; paused/expired/deleted states. No add-to-home-screen manifest yet | — |
| S24 Apple Wallet pass | — | not built | Backend: Pass Type ID, signing, APNs | — |
| S25 Google Wallet pass | — | not built | Backend: issuer account, objects, callbacks | — |
| S26 Restore card | — | partial | Join answers "sent"; actually sending the link needs email/SMS | — |
| S27 Scanner pair | 2026-11-25 | done | Pairing code or owner session | — |
| S28 Scan | 2026-11-25 | partial | Camera with native BarcodeDetector and self-hosted ZXing WASM fallback, torch. **Not tested with a real camera here**; typed code tested | Dev server missed new route folders until restarted |
| S29 Transaction | 2026-11-25 | done | Outcome sentence before submit, new idempotency key whenever amounts change | — |
| S30 Result / errors | 2026-11-25 | done | Plain-language errors (forged, replaced, cooldown, limits, offline) | — |
| S31 Join QR on scanner | — | not built | Should-have | — |
| S32 History | 2026-11-25 | done | Per device (or whole org for the owner) | — |
| S33 Edit customer in scanner | — | not built | Should-have | — |
| S34 Scanner settings | 2026-11-25 | partial | Vibrate, beep, confirm. No GPS or biometrics | — |
| S35 Automations | 2026-11-25 | partial | Settings, on/off, `{name}`, send hour, 7-day forecast, birthday-field check. **The hourly sending job is backend work** | — |

**Screens:** 19 done, 11 partial and 5 not built, out of 35 (S09, S24, S25, S31, S33).
**Must features** (`features.csv`): 31 yes, 15 partial and 7 no, out of 53. Every "no" is Apple Wallet, Google Wallet, payments, image upload or the preview pass, all of which need real keys or storage.

## Bigger than it looked
- **The fake store across workers.** The Next dev server runs routes in separate workers. The in-memory store went stale, and a new card 404'd on its join page. The store now reloads from disk whenever another worker wrote. This doesn't apply to Postgres.
- **Automations aren't just a settings screen.** Sending needs the hourly job, per-org time zones, `automation_sends` claims and the notification budget. That's all in `architecture.md` and lands with `/replica-backend`. Today the screen saves the settings and forecasts reach, and **nothing is sent yet**.
- **Wallet passes are the product's core and aren't here.** The web card covers every customer today. Apple and Google need the accounts from M0.

## Verified flows (browser plus API)
1. **Card setup and join (F01, F02, F04):**
   - Sign in, create a card, design it, go live, get the QR.
   - Join on a 375 px phone; validation errors are tied to their fields.
   - The web card shows a signed QR and a typed code.
2. **Scanning (F06, F07):**
   - Find the card by typed code, add 3 stamps; the web card shows 3/10.
   - Through the API: valid QR found, forged QR rejected, 7 stamps refused by the 5-per-scan cap.
   - A replay returns the original result; a reused key with different amounts is refused.
   - Earn and redeem in one scan works; the old QR then says "replaced".
3. **Pairing (F13):** the code works once, and the scanner then acts as "Back bar".

## 2026-11-25: a counter phone that recovers by itself (fixes.md #1, scanner half of #3 and #4)

- **Re-pair from the error screen.** Every scanner 401 now carries a reason (`device_removed`, `cookie_missing`, `session_expired`, `device_unknown`, `not_paired`). The phone remembers its device id and name in localStorage, so a lost cookie is told apart from a removed phone. The screen says "This phone needs pairing again" with the code input right there; pairing goes back to the camera without a reload. A 60 s heartbeat (`/api/scan/status`) moves an idle phone to that screen and never interrupts an open card.
- **No silent logouts.** Device tokens still have no expiry; the cookie stays at 400 days (tested). Counter phones shows **Online** (seen in the last 3 minutes) or "Last seen …".
- **Self-check** in scanner settings: connection (with latency), pairing name, camera permission, QR reader WASM compile, clock skew. Plain results with a fix hint each.
- **Scan loop.** Error boundary with "Restart scanner"; one automatic retry of a dropped lookup; a submit that fails keeps the card open with "No connection — nothing was saved" and a Retry that resends the same idempotency key (amounts are locked meanwhile), so a timeout after the save never double-stamps. Requests time out after 10–15 s.
- **Updates.** `NEXT_PUBLIC_APP_VERSION` (or Vercel's commit SHA) is the build id; `/api/scan/version` and `/api/scan/status` report the live one. A newer build shows "Update ready" and applies on the next return to the camera. No kill switch, rollback or service worker yet.
- **Report a problem.** Migration `0007_scanner_reports.sql`. The bundle is whitelisted and scrubbed on the phone and again on the server (QR payloads, card codes, serials, ids, emails and numbers removed), rate limited to 5 per 10 minutes, and listed under Problem reports on Counter phones. "Contact support" reads `SUPPORT_WHATSAPP` (empty: "not set up yet").
- **Tests.** Unit 61/61 (7 new in `tests/scanner-health.test.mjs`). E2E 146/146 (12 new in `e2e/scanner-recovery.spec.ts`; F06-E7 and F13-H1 now expect the re-pair screen).
- **Not verified:** a real camera, permission prompts and the decoder on a cheap Android phone; the heartbeat's effect on battery and data.
