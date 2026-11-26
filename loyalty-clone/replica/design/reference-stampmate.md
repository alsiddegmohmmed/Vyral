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
