# Recon map: Loopy Loyalty (web dashboard + staff scanner app + Apple/Google Wallet passes)

Scope: core loop plus marketing. A merchant designs a stamp card, customers join through a link or QR and add the card to their wallet, staff scan it to stamp and redeem, and the merchant messages customers through wallet pushes, segments and location alerts and reads the results. Out of this slice: the developer API as a product, the agency/affiliate programme and white-label.
**v1 scope (decided 2026-11-25):**
- Apple Wallet and Google Wallet passes.
- Single-reward cards only.
- A web-based staff scanner.
- Location alerts.
- Messages: broadcast to everyone, plus two automations, birthday and "we miss you" win-back after N days without a visit.

In `features.csv`, **must** means v1. Should and could are later.

For: a standalone loyalty SaaS for small businesses (cafes, restaurants, salons, gyms, retail). It is our own product, not a Loopy reseller.
Date: 2026-11-25

## Ground rules followed

- Public sources only. Loopy's Terms of Service §3 forbid using the service "to build or enhance a competing product" (https://loopyloyalty.com/legal/terms/). So **no Loopy account was used, and none should be**: no trial signup and no driving the dashboard. Every screen below is inferred from public help articles, feature pages, store listings, video descriptions and the public API reference.
- No JS bundles were read and no network calls were logged. The public OpenAPI reference at developer.loopyloyalty.com was read as documentation, for the data model only. Our schema is written fresh in /replica-architect.
- `screens/` holds no images yet. Downloading store screenshots needs your OK, so `screens/README.md` lists the public URLs instead.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | help center index | https://docs.loopyloyalty.com/en/ | Intercom site, 10 collections, about 131 articles |
| 2 | designer: card types | https://docs.loopyloyalty.com/en/articles/921269-stamp-card-types | single vs multi reward |
| 3 | designer pt 1, design | https://docs.loopyloyalty.com/en/articles/995995-part-1-designing-your-digital-stamp-cards | images and sizes, stamps 1–30, colours |
| 4 | designer pt 2, details | https://docs.loopyloyalty.com/en/articles/995999-part-2-adding-details-to-your-digital-stamp-card | description, rewards, lock-screen messages, expiry, links |
| 5 | designer pt 3, locations | https://docs.loopyloyalty.com/en/articles/1312453-part-3-adding-your-location-s | geo messages |
| 6 | designer pt 4, terms | https://docs.loopyloyalty.com/en/articles/1312778-part-4-terms-support | terms, issuer |
| 7 | designer pt 5, data | https://docs.loopyloyalty.com/en/articles/1313084-part-5-data-collection | signup fields, consent |
| 8 | designer pt 6, labels | https://docs.loopyloyalty.com/en/articles/1101063-part-6a-adding-customizations-to-your-card | label text, update-all-cards |
| 9 | designer pt 6b, front field | https://docs.loopyloyalty.com/en/articles/1116182-part-6b-changing-the-default-field-s-on-your-digital-stamp-cards | front-of-pass field |
| 10 | activation | https://docs.loopyloyalty.com/en/articles/1098882-part-7-activating-your-card-design | unique name, warning |
| 11 | after activation | https://docs.loopyloyalty.com/en/articles/935400-what-happens-after-i-activate-my-card-design | what locks |
| 12 | Apple vs Google | https://docs.loopyloyalty.com/en/articles/1133529-apple-wallet-vs-google-wallet | platform differences |
| 13 | unique enrolments | https://docs.loopyloyalty.com/en/articles/1513524-unique-customer-enrolments | duplicate prevention |
| 14 | iOS Stamper app | https://docs.loopyloyalty.com/en/articles/10502182-using-the-ios-stamper-app | scanner screens and settings |
| 15 | staff logins | https://docs.loopyloyalty.com/en/articles/16534331-adding-staff-logins-and-what-they-can-and-can-t-do | sub-user permissions |
| 16 | card details screen | https://docs.loopyloyalty.com/en/articles/16534343-what-you-can-do-from-a-customer-s-card-details-screen | events, reinstall |
| 17 | scan errors | https://docs.loopyloyalty.com/en/articles/16522344-common-scan-and-connection-errors-and-what-they-mean | error states |
| 18 | remote stamping | https://docs.loopyloyalty.com/en/articles/985755-how-to-give-stamps-rewards-remotely | web stamping |
| 19 | card status | https://docs.loopyloyalty.com/en/articles/1101379-what-does-card-status-mean | issued/installed/deleted/removed |
| 20 | CSV export | https://docs.loopyloyalty.com/en/articles/1552364-export-data-in-csv-format | emailed link, 24 h |
| 21 | push messages | https://docs.loopyloyalty.com/en/articles/984908-how-push-messages-work | delivery rules |
| 22 | segments | https://docs.loopyloyalty.com/en/articles/985205-sending-messages-to-a-segment-of-customers | one condition, live count |
| 23 | push troubleshooting | https://docs.loopyloyalty.com/en/articles/1150707-why-aren-t-my-customers-receiving-push-messages | edge cases |
| 24 | card full | https://docs.loopyloyalty.com/en/articles/1825292-what-happens-when-a-card-is-full | reset logic |
| 25 | staff-side enrolment | https://docs.loopyloyalty.com/en/articles/1123137-how-to-send-your-customers-their-card-without-having-sign-up | copy the card link |
| 26 | delete customer | https://docs.loopyloyalty.com/en/articles/1073589-how-to-delete-a-customer | irreversible |
| 27 | insights / ROI | https://docs.loopyloyalty.com/en/articles/2310329-how-do-i-track-sales-and-revenue-of-my-rewards-program | stamp value, reward cost |
| 28 | preview vs live | https://docs.loopyloyalty.com/en/articles/993767-why-aren-t-my-stamps-updating-on-my-card | preview pass trap |
| 29 | what's new (2022) | https://docs.loopyloyalty.com/en/articles/1043131-what-s-new-in-loopy-loyalty | multi reward, audit log |
| 30 | public API docs | https://developer.loopyloyalty.com/ | OpenAPI 2.0 reference: entities, fields, webhooks |
| 31 | Make modules | https://apps.make.com/loopy-loyalty.md | triggers and actions |
| 32 | pricing page | https://loopyloyalty.com/pricing/ | 3 tiers and gating |
| 33 | marketing home | https://loopyloyalty.com/ | positioning, claims |
| 34 | feature pages | https://loopyloyalty.com/features/ (web-app, enrollment, stamper-app, messaging, analytics, locations) | core loop in their words |
| 35 | FAQ | https://loopyloyalty.com/faq/ | billing behaviour |
| 36 | terms | https://loopyloyalty.com/legal/terms/ | §3 no competing products |
| 37 | merchant signup / login | https://app.loopyloyalty.com/signup/get-started, https://app.loopyloyalty.com/auth/login | fields only, not submitted |
| 38 | iOS Stamper listing | https://apps.apple.com/us/app/loopy-loyalty-stamper/id945301614 | 4.5★ (112), version history |
| 39 | Android Stamper listing | https://play.google.com/store/apps/details?id=com.loopyloyalty.app.scanner | 4.1★ (81), 10K+ installs |
| 40 | demo video | https://www.youtube.com/watch?v=JDEJ5fDKrmo | customer + staff flow |
| 41 | design videos | https://www.youtube.com/watch?v=7yFu2fXVjYU, https://www.youtube.com/watch?v=RDp6xYpSEyA, https://www.youtube.com/watch?v=vIRFnKKvwHs | designer flow (2017 UI) |
| 42 | stamping videos | https://www.youtube.com/watch?v=CdVfl3lqg3E, https://www.youtube.com/watch?v=KXvhdIbJ1Jo | scan; remote stamp |
| 43 | reviews | https://www.capterra.com/p/160859/Loopy-Loyalty/reviews, https://www.g2.com/products/loopyloyalty/reviews | search snippets only (the pages blocked our fetcher) |
| 44 | competitors | https://alternativeto.net/software/loopy-loyalty/ | alternatives list |

## Core loop

A merchant publishes a branded stamp card, customers join through a QR code in under a minute and keep the card in their phone wallet, and staff tap "+" on any phone to stamp it until a reward unlocks. That repeat-visit loop is what merchants pay for, at $25–95 a month.

## Screens

Three surfaces: **W** is the merchant web dashboard, **C** is customer-facing (web page plus wallet pass), **A** is the staff scanner app (native at Loopy; a PWA is an option for us).

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | W Sign up | /signup | create merchant account, start 15-day trial | email + confirm, username (permanent, also scanner login), password + confirm (≥8 chars, 1 digit), marketing opt-in, terms notice | filled, validation error, username taken |
| S02 | W Log in / forgot password | /login | sign in with username or email | text input, password, link | error, reset sent |
| S03 | W Card designs list | home after login | list programs, create, duplicate | card thumbnails, status badge (draft/live), New button, plan-limit notice | **empty (first run)**, filled, at plan limit |
| S04 | W Designer: Design tab | S03 → New / Edit | type, images, stamp count, colours | single/multi toggle, image uploaders (icon 87², logo 480×150, stamp/unstamp 200², background 1125×432), stamp template picker, stepper 1–30, colour pickers, **live pass preview (Apple/Google)**, Save | draft, saved, upload error, locked fields after activation |
| S05 | W Designer: Details tab | tab | text on card back, rewards, messages, expiry, links | text areas, reward list (name, text, stamps required, cost), lock-screen messages with `{#}` token, expiry radio (never / date / N days), link rows (url/phone/email/address) | single vs multi, reward position picker for multi |
| S06 | W Designer: Locations tab | tab | attach saved locations to card | location picker, "+" add, per-location message, show-address toggle | none attached, plan limit |
| S07 | W Designer: Terms & support tab | tab | terms text/link, issuer business details | textarea, toggle hide terms, address fields | — |
| S08 | W Designer: Data tab | tab | signup form builder | field rows (label, type text/number/date/email/url/mobile, required), default phone country, consent text + checkbox default, unique-field selectors (email/phone/text) | warning on rename/delete of field (data loss), unique locked to top tier |
| S09 | W Designer: Custom labels tab | tab | rename pass labels, choose front field | label inputs, front-field select (stamps to next reward / lifetime stamps / any data field) | gated (upgrade prompt on lowest tier) |
| S10 | W Preview | designer → Preview | QR/link to install a **non-functional preview pass** on own phone | QR, link, "preview cards can't be stamped" notice | — |
| S11 | W Activate dialog | designer → Activate | name it uniquely and go live | name input, warning of locked fields, confirm | name taken, requires payment card at end of trial |
| S12 | W Card overview | /overview/{id} | share and manage a live card | live link + QR download, poster/tent-card assets, "Update all cards" (push design changes, cooldown), Export button, quick stats | just activated, export emailed |
| S13 | W Insights | card left menu | ROI and activity | stamp value + reward cost inputs, revenue / cost / net benefit tiles, enrolments, stamps, redemptions over time, card-status breakdown | no data yet |
| S14 | W Customers table | card left menu | find and act on customers | search (all fields, wildcard), sortable columns (status, current stamps, lifetime stamps, rewards, last activity, created), row Actions menu (give stamps, copy card link, message, delete), pagination | **empty**, filled, no search results |
| S15 | W Customer / card detail | S14 row | one customer's card | details (editable fields), card status, current stamps, rewards available, event timeline (who, when, where, IP/device), reinstall QR, resync | active, expired, deleted |
| S16 | W Give stamps / reward modal | S14/S15 Actions | remote stamping | quantity stepper, reward toggle, confirm | success, card expired, no rewards |
| S17 | W Messages composer | left menu | push to wallet passes | audience radio (all / segment / one customer), segment builder (metric + operator + value) with **live match count**, text with ~90-char lock-screen hint, send confirm, sent history | 0 matches, sent, plan/fair-use notice |
| S18 | W Locations & beacons | settings / left menu | account-level places | list, add/edit (name, address search → lat/lon, address on card, message), beacon rows (uuid/major/minor/text), "affects N cards" note | empty, at plan limit |
| S19 | W Staff logins / counter devices | settings | v1: pair, list and revoke counter phones; later: personal staff logins | list, add (label, username, password, location), deactivate/delete | empty, at plan limit (3/10/50) |
| S20 | W Settings | settings | business details, username, API keys, webhooks, delete account | form, key reveal/regenerate, webhook list (url + event) | — |
| S21 | W Billing / plan | settings | trial, plan, upgrade/downgrade, cancel | plan cards, trial countdown, payment card, cancel flow | trialing, **trial expired / locked**, past due, cancelled (scheduled deletion) |
| S22 | C Enrolment page | /c/{shortCode} (QR or link) | customer joins | merchant logo/colours header, description, dynamic form, phone with country flag, terms, consent checkbox, Join button | filled, validation error, **duplicate customer**, campaign expired/inactive, mobile (primary) |
| S23 | C Join success / add to wallet | after Join | install the pass | Add to Apple Wallet / Save to Google Wallet buttons (OS-detected), card link to save | iOS, Android, desktop (show QR to open on phone) |
| S24 | C Apple Wallet pass | in Wallet | the card itself | front: logo, strip with stamp grid, header field, barcode; back: description, how to earn, rewards, links, locations, terms, issuer, "latest updates" | 0 stamps, partial, reward ready, expired, lock-screen notification |
| S25 | C Google Wallet pass | in Google Wallet | same, Google layout | icon on card, strip, fields, messages at bottom | no lock-screen push, no beacons |
| S26 | C Card restore | same link as S22 | customer lost the pass | re-add same card without reset (by unique field or link) | found, not found |
| S27 | A Scanner login | app launch | staff or owner sign in | username, password, biometric toggle, remember me | session expired, wrong password |
| S28 | A Scan | after login | read the pass barcode | camera viewfinder, zoom, front camera toggle, torch | camera denied, scanning, not found |
| S29 | A Transaction screen | after scan | stamp and redeem | customer summary (up to 3 fields), lifetime stamps, rewards available toggles, "+"/"−" stamps (− limited to since last reward), Submit, Confirm dialog | reward available, none, card expired, campaign expired |
| S30 | A Result / errors | after Submit | feedback | success alert (vibrate/beep), error messages | card not found, expired, no rewards, invalid transaction, no internet (**no offline queue**) |
| S31 | A Enrol QR | app menu | let a customer sign up at the counter | big QR for S22, pass-reinstall QR | — |
| S32 | A History / audit | app menu or after scan | recent transactions | list (time, staff, action, qty) | empty |
| S33 | A Edit customer | from S29 | fix customer data | form | saved, error |
| S35 | W Automations (ours, not in original) | card left menu → Automations | birthday and win-back messages | per-automation card: on/off toggle, message text with ~90-char hint and `{name}` token, win-back "days since last visit" input (e.g. 30), send hour, live pass preview, "would reach N customers this week" count, recent sends list | off, on, no birthday field on form (prompt to add it), 0 eligible |
| S34 | A Scanner settings | app menu | device preferences | toggles: stay logged in, biometrics, vibrate, beep, copy to clipboard, show barcode contents, open links, front camera, zoom, confirm transaction, success alert, send GPS | — |

35 screens: 22 web dashboard (S35 is our addition), 5 customer-facing, 8 scanner. The scanner (S27–S34) is a **web app (PWA)** in v1, not native.

## Flows

```
F01 Merchant signs up and starts trial
    S01 -> S03 (empty state)
    happy path clicks: ~4 (fill 5 fields, tick, submit)
    edge: username taken, weak password, username is permanent (warn)

F02 Merchant designs and publishes a stamp card
    S03 -> S04 -> S05 -> S06 -> S07 -> S08 -> (S09) -> S10 -> S11 -> S12
    happy path clicks: ~25+ across 6 tabs (template-first can cut this hard)
    edge: image wrong size, stamps>30, reward stampsRequired > total stamps,
          activation name taken, trial needs payment card to go live,
          post-activation locks (type, stamp count, reward logic, expiry, unique fields),
          new stamp images only affect new cards, preview pass cannot be stamped

F03 Merchant edits a live card and pushes the update to every pass
    S12 -> S04/S05 -> Save -> S12 "Update all cards"
    happy path clicks: ~4
    edge: cooldown (10 min) between pushes, locked fields greyed, Google vs Apple differences

F04 Customer joins and adds card to wallet
    QR/link -> S22 -> S23 -> S24|S25
    happy path clicks: 3 (fill form, Join, Add to Wallet) — the number to beat
    edge: duplicate unique email/phone -> error (offer restore instead),
          consent required, desktop visitor, in-app browser (Instagram/WhatsApp) can't open wallet,
          Android without Google Wallet / unsupported country, campaign expired

F05 Staff enrols a customer at the counter
    A S31 (customer scans QR) -> F04
    or W S14 internal enrol -> copy card link -> send by SMS/WhatsApp/email
    happy path clicks: 2 (staff) + F04

F06 Staff stamps a card
    A S27 -> S28 -> S29 (+ x n) -> Submit -> Confirm -> S30
    happy path clicks: 3 for one stamp (scan, +, submit) + confirm if on
    edge: card from another merchant, deleted card (even a screenshot fails), expired card,
          no internet, session expired, double scan / fraud, GPS logged

F07 Customer earns and redeems a reward
    F06 until full -> pass shows reward + lock-screen message
    -> next visit S28 -> S29 toggle reward -> Submit -> Confirm
    happy path clicks: 3
    edge: single reward resets card to 0 and banks reward; multi reward unlocks at positions (e.g. 4, 6, 10);
          removing stamps can forfeit an earned reward; overflow stamps beyond full (undocumented — decide)

F08 Merchant stamps or rewards remotely
    S14 -> Actions -> S16 -> confirm
    happy path clicks: 4
    edge: same rules as F06

F09 Merchant sends a push message
    S17 -> pick audience -> (segment: metric op value, see count) -> type -> Send -> confirm
    happy path clicks: ~5
    edge: only installed passes receive; Apple users with automatic updates off miss it;
          Google shows no lock-screen alert; >90 chars truncated on lock screen; 0 matches

F10 Location alert fires
    Merchant: S18 add location + message -> attach in S06 -> push update
    Customer: phone near location -> lock-screen message (Apple; Google GPS only, no beacons)
    edge: Wallet decides when to show, not us; limited number of locations per pass (Apple max 10)

F11 Merchant reviews results and exports
    S13 (enter stamp value + reward cost) -> read net benefit; S12 -> Export -> email link
    edge: export link expires 24h, top tier only

F12 Merchant deletes a customer
    S14 -> Actions -> Delete -> optional farewell message -> confirm
    edge: irreversible, barcode dead, frees unique field for re-signup

F13 Owner adds staff
    S19 -> Add (label, username, password, location) -> staff logs in on S27
    edge: plan seat limit, staff cannot see customers, settings or billing

F14 Trial ends
    S21 trial expired -> add payment -> plan active
    edge: cancel = account and cards scheduled for deletion, passes stop updating; no refunds

F15 Birthday message (ours)
    Merchant: S08 add Birthday field -> S35 turn on, write message -> save
    System: daily job at the send hour (business time zone) -> customers whose birthday is today
            -> push to their installed pass -> log event
    happy path clicks: ~4 (merchant, once)
    edge: no birthday field yet, Feb 29 (send Feb 28 in non-leap years), customer joined today,
          pass removed or opted out (skip), already sent this year (never twice)

F16 Win-back message (ours)
    Merchant: S35 turn on, set N days (default 30), write message -> save
    System: daily job -> installed cards whose last visit (last stamp, or join date if never stamped)
            is exactly N+ days ago and not yet messaged in this lapse -> push -> log event
    happy path clicks: ~4 (merchant, once)
    edge: send once per lapse, reset when they're stamped again; don't hit a whole old customer
          base on day one (cap or "only from now on" option); quiet hours; Google may rate-limit
          notifications per pass (verify in architect)
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary, secondary, ghost, danger, icon | default, hover, focus, disabled, loading | all |
| Text input | text, email, password, number, url, search | default, focus, error, disabled | S01, S02, S05–S08, S14, S18–S20, S22, S27, S33 |
| Phone input | with country flag select | default, error | S08 (default country), S22 |
| Date input | — | default, error | S05 expiry, S22 date fields |
| Textarea | with char counter | default, over-limit | S05, S07, S17 |
| Colour picker | swatch + hex | default, invalid hex | S04 |
| Image uploader | fixed-size target with crop hint | empty, uploading, done, wrong size | S04 |
| Stamp template picker | grid of icons | selected | S04 |
| Stepper | − n + | min, max | S04 stamps, S16, S29 |
| Toggle / switch | — | on, off, disabled (locked) | S07, S09, S29 rewards, S34 |
| Radio group / segmented control | — | — | S04 type, S05 expiry, S17 audience |
| Tabs | designer tabs | active, locked badge | S04–S09 |
| **Pass preview** | Apple front, Apple back, Google | 0 / n / full stamps, reward ready | S04–S09, marketing |
| **Stamp strip renderer** | grid 1–30, reward markers | stamped, unstamped, reward slot | S04, S24, S25, S15 |
| Field-list builder | sortable rows | add, edit, remove (warn) | S08 |
| Segment builder | metric + operator + value | live count, 0 matches | S17 |
| Data table | sortable, searchable, paginated | loading, empty, no results | S14, S18, S19, S32 |
| Row actions menu | dropdown | — | S14, S18, S19 |
| Event timeline | per-event rows with icon by type | empty | S15, S32 |
| Stat tile | number + delta, currency | empty, loading | S12, S13 |
| Chart | line/bar over time | empty | S13 |
| QR code block | with download PNG/SVG, copy link | — | S10, S12, S31 |
| Modal / dialog | confirm, destructive confirm, form | open, submitting | S11, S16, S17 send, delete |
| Toast | success, error, info | — | all |
| Banner | trial countdown, plan limit, upgrade gate, locked-after-activation | — | S03, S04, S09, S21 |
| Empty state | illustration + CTA | — | S03, S14, S18, S19, S32 |
| Nav | left sidebar (per card), top bar (account) | active | W |
| Plan card | 3 tiers, monthly/annual switch | current, recommended | S21 |
| Wallet buttons | Add to Apple Wallet, Save to Google Wallet (official badges, our usage under their guidelines) | OS-detected | S23 |
| Camera scanner | viewfinder + zoom + torch | permission denied, scanning, hit | S28 |

## Inferred data model

The original keeps customer data on the Card and has no Customer entity. We may choose otherwise in /replica-architect, for example a Customer shared across a merchant's cards.

```
Account (merchant)  id, email, username (unique, immutable), password_hash, plan (starter|growth|ultimate),
                    trial_ends_at, subscription_status, marketing_opt_in, api_key, api_secret, created_at
                    evidence: S01 signup fields, pricing page, help 803301, API auth section
                    confidence: high (plan/subscription fields: medium)

Business            account_id, name, website, address_line1/2, city, region, zip, country, email, phone
                    evidence: API Business object, help 1312778, 1102139
                    confidence: high

StaffUser (sub-user) id, account_id, label, username, password_hash, location_id?, status (active|inactive|deleted),
                    created_at, updated_at
                    evidence: API Subuser, help 16534331
                    confidence: high

Campaign (card design) id, account_id, name (unique per account), short_code (6), status (draft|published),
                    type (single|multi), description, how_to_earn, org_name, total_stamps (1–30),
                    stamp_value, currency, terms, terms_hidden, terms_url, allow_push,
                    default_country_code, consent_enabled, consent_text, consent_checked_default,
                    unique_email_field, unique_phone_field, unique_text_field,
                    expiry_mode (never|date|days_after_join), expiry_date, expiry_days,
                    design {icon, logo, background_image, background_color, text_color,
                            stamped_image, unstamped_image, strip config (colours, opacities, placeholders, padding)},
                    labels (json), front_fields (json), created_at, updated_at, last_pushed_at
                    evidence: S04–S11, API Campaign/Design/StripImage, help 995995, 995999, 1098882
                    confidence: high

Reward (ordered, embedded in Campaign)  campaign_id, position (1-based index), name, text,
                    stamps_required (≤ total_stamps), stamp_lockscreen_msg ({#} token), reward_lockscreen_msg,
                    cost, currency
                    evidence: API Reward, help 921269, 1825292
                    confidence: high

FormField           campaign_id, key/label, type (text|number|date|email|url|mobile), required, position
                    evidence: S08, API DataField, help 1313084
                    confidence: high

Link                campaign_id, label, href, type (url|phone|email|address), position
                    evidence: API Link, help 995999
                    confidence: high

Location            id, account_id, name, lat, lon, alt, address, address_on_card, show_address, message
                    evidence: API Location (update returns campaignsAffected), help 1312453
                    confidence: high
CampaignLocation    campaign_id, location_id   (N–N)

Beacon              id, account_id, name, uuid, major, minor, relevant_text   (+ N–N with Campaign)
                    evidence: API Beacon
                    confidence: high (could priority for us)

Card (one customer's pass in one campaign)
                    id, campaign_id, account_id, serial/barcode value, auth_token (wallet web service),
                    pass_status (issued|installed|removed|invalidated), platform (ios|android|unknown),
                    current_stamps, reward_balance (json: position -> count available),
                    total_stamps_earned, total_rewards_earned, total_rewards_redeemed,
                    last_stamp_at, last_reward_earned_at, last_reward_redeemed_at,
                    customer_details (json keyed by FormField), unique_email, unique_phone, unique_text,
                    consent_opt_in, push_opt_out, expires_at, deleted_at, created_at, updated_at
                    evidence: API Card + enrol response (pid + url), S14 columns, help 1101379, 1513524
                    confidence: high

Event (transaction / audit log, append-only)
                    id, card_id, campaign_id, account_id, actor (owner|staff username|customer|system),
                    type (enrol|stamp|receive_reward|redeem_reward|tap_link|wallet_register|wallet_unregister|
                          google_register|delete_card|forfeit_reward|message_sent),
                    quantity, reward_position, location_name, scan_lat, scan_lon, ip, user_agent, referrer,
                    geo (country, city, tz), created_at
                    evidence: API Event (eventType 0–9), help 16534343, 10502182
                    confidence: high (message_sent: guess, our addition)

WalletRegistration (Apple web service)  card_id, device_library_id, push_token, created_at
                    evidence: guess, required by Apple's PassKit web service protocol, not from Loopy docs
                    confidence: guess (but certain we need it)

Message (push broadcast)  id, account_id, campaign_id, audience (all|segment|card), filter (json conditions),
                    card_id?, text, recipients_count, sent_at, sent_by
                    evidence: S17, API push endpoints + FilterCondition, help 984908, 985205
                    confidence: medium (Loopy shows no sent history in docs; we add one)

Automation (ours)   id, campaign_id, kind (birthday|winback), enabled, message_text, days_inactive (winback),
                    send_hour, timezone, created_at, updated_at
                    evidence: v1 scope decision; no equivalent at original
                    confidence: our design
AutomationSend      automation_id, card_id, period_key (birthday: year; winback: lapse start date), sent_at,
                    status (sent|skipped|failed), reason
                    evidence: needed so nothing is ever sent twice
                    confidence: our design
Card additions      birthday (month, day; from the Birthday form field), last_visit_at (= last stamp or join)

WebhookSubscription id, account_id, campaign_id, url, event (enrol|stamp|receive_reward|redeem_reward|forfeit_reward), secret
                    evidence: API webhooks, Make triggers
                    confidence: high

Export              id, campaign_id, kind (customers|transactions), timezone, status, file_url, expires_at (24h)
                    evidence: API Export, help 1552364
                    confidence: medium
```

Relationships: Account 1-1 Business; Account 1-n StaffUser, Campaign, Location, Beacon, Message, WebhookSubscription; Campaign 1-n Reward, FormField, Link, Card; Campaign n-n Location, Beacon; Card 1-n Event, WalletRegistration; StaffUser 0-1 Location.

Derived rules worth carrying over:
- Single reward: when `current_stamps` reaches `stamps_required`, bank one reward and reset to 0.
- Multi reward: each reward unlocks at its position, and the card resets at `total_stamps`.
- Staff can only remove stamps earned since the last reward. If removing stamps undoes an earned reward, log `forfeit_reward`.
- A deleted card's barcode is rejected and its unique field values are freed.
- Activation locks `type`, `total_stamps`, rewards, expiry and unique fields.

## Feature matrix

See `features.csv`. Must (= v1): 53, should: 25, could: 13, skip: 6 (97 rows).

## Out of scope (cannot or should not be cloned)

- **Loopy's brand, copy, templates and stamp artwork** (for example their default stamp images). We make our own.
- **Their wallet-pass infrastructure.** Loopy runs on PassKit, Inc.'s pass platform. We need our **own Apple Pass Type ID and certificate** and our **own Google Wallet issuer account**, or we rent a pass vendor. Apple and Google set the rules for lock-screen text, location relevance (Apple shows at most 10 locations per pass) and beacons, and we can't change them.
- **The Zapier and Make app listings and partner integrations** (Square, Acuity, Mailchimp). These are partner deals. We can build our own webhooks and API, then apply to those marketplaces ourselves.
- **Their customer base and reviews.** The "89k cards today" network effect isn't a feature.
- **The affiliate programme.** It's a business arrangement, not product.
- **The native scanner apps as a copy.** We build our own scanner (a PWA first). It must not copy their screens or names.

## Size

- **Counts:** 35 screens, 16 flows, 17 entities. The extras are automations, which are ours.
- **Hard parts:**
  1. **Apple Wallet:** signed `.pkpass` generation, the PassKit web service (device register and unregister, the "latest pass" endpoint) and APNs pushes that update installed passes, plus lock-screen change messages. This is the core of the product and the riskiest piece.
  2. **Google Wallet:** loyalty class and object API, JWT save links, object updates for stamps and messages, and the issuer approval process.
  3. **Dynamic strip-image rendering** of the stamp grid per card state, at the right sizes for both wallets.
  4. **Staff scanner:** camera barcode scanning on cheap Android phones, fast enough to use at a counter, with clear errors and an audit trail.
  5. **Push at scale:** segment queries, fan-out to APNs and the Google API, and delivery tracking.
  6. **Plan gating and billing:** Stripe subscriptions, trial lock and seat or design limits.
- **Full slice: L** (about a quarter).
- **v1 as scoped: M, upper end.** That is roughly 5–8 weeks of focused work, not counting Apple and Google account approval time.
  - Location alerts add little. The locations are written into the pass, and the phone decides when to show the alert.
  - The two automations add a daily scheduler, time-zone handling and never-send-twice records.
  - Both need checking in /replica-architect:
    - current iOS behaviour for location alerts on passes
    - Google Wallet's limit on notifying messages per pass
- **Later** (should/could): multi reward, segments and single-customer messages, staff sub-users, CSV export, API and webhooks, native scanner apps.
