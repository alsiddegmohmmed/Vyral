# Mechanism reference: StampMate card creation (structure only)

Studied 2026-11-25/26 at `trystampmate.com/start` in the in-app browser.
- **What I did:** declined non-essential cookies, typed only a made-up business ("Demo Cafe" / "Demo Barber", Kigali), and stopped at step 6 of 6, before anything that creates an account or a lead.
- **Clean-room:** this records the *mechanism* in our own words. No copy, icons, illustrations, colours or brand were taken. Our steps, presets, wording and visuals are new (`web/lib/card-presets.ts`, `web/app/(app)/cards/new/`).

## Their flow

| step | asks | how it works | effect on the live card |
| --- | --- | --- | --- |
| intro | "create a card in a minute": six questions, one minute, a free-trial chip | one start button | the phone preview cycles through sample brands |
| 1 | kind of place: 9 tiles with an icon and a label | **one click picks and advances** (no Next) | the stamp icon follows the type (café → cups; other types → a generic star); a reward suggestion is attached |
| 2 | name: a Google business search, or "not listed? type it" for name and town; an optional disclosure with **colour swatches** (10 presets plus a custom picker) and a logo upload | Next is disabled until the required fields are filled | the business name shows on the card as you type |
| 3 | stamps to fill: chips **4–10**; the reward is a tab, either a single reward (pre-filled per type, e.g. barber → "free trim") **or a mystery box** (prize rows with odds %, Common/Rare/Legendary tiers, add or remove a prize, "open a test box") | — | stamp count and reward text update |
| 4 | which feature matters most: one choice | sales-lead qualification | none |
| 5 | how many locations: buckets | lead qualification | none |
| 6 | when should it be running | lead qualification; the account step follows | none |

**Constant across steps:**
- a "Back" link, a "0n / 06" counter and a thin progress bar;
- a big question heading, then a one-line lead;
- the **phone preview on the right**, which fills one stamp every ~1.2 s and loops (adopted earlier as our self-filling preview, commit 3880125);
- **tapping the card adds a stamp** ("click to add a stamp").

## What we took (mechanism) and how ours differs

- **One question per screen with a live card beside it.** Ours lives inside the dashboard at `/cards/new`, for signed-in owners, so the sales-lead questions (steps 4–6) are dropped.
- **The business type fills in sensible defaults.** Our list is 11 types for Kigali high streets (café, restaurant, bakery, juice bar, salon & beauty, barber, gym, car wash, pet care, shop, something else). Each sets the stamp icon, a suggested reward, a stamp count, a card name and a colour theme. The rewards are pre-filled as editable **values**, not placeholders.
- **Colour presets:** nine AA-checked merchant themes (each one sets background, text, labels and stamps). Exact colours, the logo and a custom stamp stay in the designer.
- **Stamp chips:** 4–10 plus 12. Up to 30 can still be set in the designer before going live.
- **Locations:** shown only when the business has any, all ticked by default.
- **Review step:** every answer has a "Change" link. It ends with two outcomes: **Create and go live** (straight to the overview with the QR) or **Fine-tune in the designer first** (a draft).
- **Tap the card to add a stamp:** for pointer users. Keyboard and screen-reader users get a visible **Add a stamp** button (axe flagged a card-as-button whose name didn't match its text).

**Mystery box: built later the same day** (migration `0008_mystery_box.sql`):
- **Setup:** a card is either "one reward" or a "mystery box" of 2–6 prizes. Each prize has a relative chance (1–100) and a tier (Common, Rare, Legendary). It's set in the wizard's reward step or the designer's Details tab, which shows an odds bar, "about 1 in N" wording, and **Try a box** (the same weighted draw, run locally).
- **The draw:** when a card fills, `apply_card_transaction` calls `draw_prize()` under the card lock and the idempotency key, so a replayed or doubled scan can't redraw. The won prize's name and tier are snapshotted in `card_prizes`, and the ledger events carry them in `meta`.
- **Customer:** the web card shows "Open your mystery box" and reveals the prize; the join page reads "N stamps, then a mystery box on us".
- **Counter:** the scanner names the exact prize to hand over ("Give Free pastry · Mystery box · Rare") and confirms "Hand over: …". The oldest prize is given first.
- **Rules:** the mode is locked once the card is live (the prizes can still be edited, and only future draws change), and going live needs at least 2 prizes.
- **Not done:** the wallet pass shows "Mystery box ready" rather than the prize name. Showing the prize name there is a follow-up.

**Not taken:**
- **The Google business search.** It needs a Places API key.

## Visual layout (measured 2026-11-26 at 1440 px) and how ours maps it

The owner asked for the wizard to "look exactly like" StampMate's /start, in Garuka's identity. We copy the **structure and proportions**; colours, type, mark, phone drawing and wording are ours.

| element | theirs (measured) | ours |
| --- | --- | --- |
| page | dark section, nav on top, 72 px side padding | full-screen route `app/(wizard)` (no sidebar): Night ground with a Jacaranda and Sunrise glow, Garuka lockup, and a "Close" pill |
| frame | 1240×672, radius 44, padding 16, gap 16, light radial gradient, deep shadow | the same: radius 44, padding 16 (12 on phones), gap 16, a Paper→nav-active radial, the same shadow |
| question card | white, radius 32, padding 28/30/30, ~52% of the width | the same; grid `1.11fr / 1fr` |
| eyebrow | 11 px mono, tracked 0.08em, uppercase | IBM Plex Mono 11 px, "Garuka · New card" |
| intro headline | 60/60, tracking −0.045em, light weight | Bricolage 60/60 (44 on phones), −0.045em |
| intro pills | three 83 px colour pills, radius 20, padding 14/16 | the same shape in Jacaranda, Night and Sunrise: "5 quick questions · 1 minute · 0 apps for customers" |
| primary button | full width, 54 px pill, tinted glow shadow | the same, Jacaranda with a Jacaranda glow |
| step header | 36 px "Back" pill; counter "01" (26 px display) plus "/ 06" (12 px mono) | the same; the counter is Plex Mono in Jacaranda |
| progress | 6 px pill track | the same |
| step headline | 38/40, −0.04em | the same (30 on phones) |
| option tiles | 3 columns, 8 px gap, 96 px tall, radius 20, padding 14, grey fill, 22 px accent icon, 14/500 label | the same in surface and accent; selected = accent-subtle plus a 2 px accent ring and a check |
| inputs and chips | filled grey, no border, rounded | 48 px filled inputs (radius 14), 48 px chips (radius 14) with mono digits |
| stage | radius 32, warm gradient, phone ~270×565 | radius 32, a Jacaranda gradient with a Sunrise glow and a large faint ring mark; our own 270×565 phone (Night frame, status bar, wallet-style screen); the card fits inside |

## Logo → automatic design (studied 2026-11-26, built the same day)

**Theirs:** the owner uploaded a test logo. The browser sent it to `POST /api/stampmate/start/logo-parts`, which answered with a layout class (`"icon-text"`) and processed images.
- **Header:** the wordmark, background removed and trimmed (337×84).
- **Stamp:** a 360×360 square symbol. Empty stamps show the same symbol, greyscale at 22% opacity.
- **Card colours:** the card background took the logo's own ground (`#EDEDE7`), and the labels took its ink (`#123A2D`).

**Ours, in the browser, with no third party** (`lib/logo-parts.ts`, pure and unit-tested; `lib/logo-canvas.ts`):
1. Find the background from the border colours, or none if the border is transparent.
2. Knock the background out to a soft mask.
3. Split the artwork by empty columns or rows into symbol plus text: side by side (`icon-text`), stacked (`icon-top`), symbol only (`icon`) or wordmark only (`text`).
4. Read the ink and accent colours.
5. Build a card theme that passes contrast (text and labels 4.5:1, stamps 3:1).

**Where the parts go:**
- The wizard's look step: "Upload your logo", what was found, "Use the symbol as your stamp", and a "From your logo" swatch.
- The images are stored with the new card through the shared `attachCardImage` helper (also used by `/api/images`).
- A wordmark clears the pass's text logo.
