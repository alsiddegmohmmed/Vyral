# Brand: loyalty clone

Skill: replica-brand. Date: 2026-11-25. Angle (from `fixes.md` §5): **the counter never stops** (A), packaged for Kigali (B): mobile money, any phone, a person on WhatsApp.

Status: **applied.** The owner chose **Garuka** and the **Kivu** palette on 2026-11-25. Trademark checks are still to run; see Step 2.

## What we must not resemble

Measured 2026-11-25 from public pages (CSS of loopyloyalty.com; computed styles of koroot.io in the owner's own session):

| source | name | colours |
| --- | --- | --- |
| original (Loopy Loyalty) | "Loopy", "Loopy Loyalty", loopyloyalty.com | pink `#ed3e75` / `#f74780` / `#e73971`, amber `#ffb30c`, slate `#353f4f` |
| layout reference (koroot.io) | "Koroot", koroot.io | emerald `#10b77f`, green `#1fb255`, navy `#0f1729` / `#1d283a` |

The old tokens note said the original's signature colour was purple. Their CSS shows pink and amber, so `brand.json` lists the measured values.

## Step 1: names

**20 candidates, by style:**

| style | candidates |
| --- | --- |
| descriptive | Stampdesk, Countercard, Tillcard, Repeat Card |
| compound | Tillmark, Stampsure, Steadystamp, Keepstamp |
| invented / local | **Garuka** (Kinyarwanda, "come back"), Komeza (Kinyarwanda, "keep going"), Tambo, Sunduk |
| metaphor | Hearth, Notch, Tally, Regulars |
| verb | Return, Revisit, Comeback, Stamp |

**Cut, and why:**

| candidate(s) | reason cut |
| --- | --- |
| Komeza | Opens with "Ko-" like Koroot, a direct competitor in the same category. |
| Tally, Notch, Stamp, Return, Revisit, Hearth | Generic or heavily used, so they'd be weak marks. Hearth is too close to a well-known game. |
| Anything with "loop", or a "-y"/"-ly" ending | Too near the original's name. |
| Regulars | It was shortlisted, then cut after its checks. A "Regulars Scanner" loyalty app by Regulars ApS is already on the App Store with Apple Wallet cards and counter scanning: the same category. |

**Shortlist:** Garuka, Steadystamp, Tillmark and Stampsure.

## Step 2: checks (screening, not legal clearance)

These were run on 2026-11-25 from this machine unless marked **to run**. A trademark lawyer should do a full search before any money is spent on the name.

| check | Garuka | Steadystamp | Tillmark | Stampsure |
| --- | --- | --- | --- | --- |
| US trademark (USPTO, classes 9 and 42) | to run | to run | to run | to run |
| EU trademark (EUIPO / TMview) | to run | to run | to run | to run |
| Canada (CIPO) | to run | to run | to run | to run |
| global (WIPO Brand DB) | to run | to run | to run | to run |
| Rwanda (RDB IP registry) | to run | to run | to run | to run |
| `.com` (whois) | **taken**, registered 2013-12-23 (NameBright) | **free**: "No match" | **taken**, registered 2026-01-15 (Namecheap) | **taken**, registered 2018-06-12 |
| `.app` / `.co` / `.rw` | to run: the `.app`/`.co` whois gave no answer, and `.rw` whois echoes every name, so it proves nothing | to run | to run | to run |
| App Store, exact name (iTunes Search API) | no match in the top 5 | 0 results | no match | no match |
| Google Play, exact name | to run | to run | to run | to run |
| GitHub handle | **taken** (`api.github.com/users/garuka` 200) | **free** (404) | **taken** (200) | **free** (404) |
| X, Instagram, TikTok handles | to run | to run | to run | to run |
| web: "name + loyalty / app" | no loyalty product found (closest is "Garuda Car Spa", a different name) | no product found | no product found | no product found |

**Fit:**
- **Garuka:**
  - It's an invented word outside Rwanda, which makes a strong mark, and it says what loyalty is for ("come back"). It's local without being hard to spell.
  - **The meaning must be confirmed with a Kinyarwanda speaker** before use. The `.com` is taken, so it would need `garuka.app`, `getgaruka.com` or similar (to run).
- **Steadystamp:**
  - It says the promise ("the counter never stops"), and its `.com` and GitHub handle are free.
  - It's descriptive, so it would be a weaker trademark and harder to stand out with.
- **Tillmark and Stampsure:** both are fine, but their `.com`s are taken and neither carries the angle as well.

## Step 3: palette options

Every option keeps the token role names. Each was run through `contrast.py` against all 38 pairs, and all **3 options show 0 AA failures**. Their hues stay clear of pink (≈341°), amber (≈41°), emerald and green (≈150–160°) and navy.

| option | accent / hover / subtle | neutrals | focus | accent contrast |
| --- | --- | --- | --- | --- |
| **Clay** (terracotta, hue ≈15°) | `#a63d1c` / `#8c3215` / `#f8ece6` | warm: surface `#f7f4f1`, sidebar `#f4efea`, text `#1d1714` | blue `#1d5fd1` | white on accent 6.35:1 |
| **Kivu** (lake blue, hue ≈218°) | `#1f56b8` / `#18459a` / `#eaf0fb` | cool: surface `#f4f6f9`, sidebar `#eef2f8` | terracotta `#d2501c`; info moves to `#0e6a8a` so banners don't read as brand | 6.81:1 |
| **Roast** (dark coffee, hue ≈20°) | `#4a2c1f` / `#5f3a29` / `#f3ece6` | warm, like Clay | blue `#1d5fd1` | 12.57:1 |

**Chosen: Kivu.** It's applied to `tokens.json`, and `contrast.py` reports 38 pairs with 0 failing AA (`design/contrast-report.txt`).

New merchant cards also start in Kivu: background `#1F56B8`, label `#D6E2F7`, white text and stamps. These are only defaults (in `createCampaign`); the owner changes them in the designer.

## Step 4: logo brief

- **The idea:** "come back". A path that returns to where it started, so one more visit closes the circle. It should feel like a stamp landing, not a loop. The original's name is about loops, so **no ring, no infinity sign and no circular arrow.**
- **Mark type:** a symbol plus a wordmark.
  - **Symbol:** a lowercase **g** whose tail curls back up toward its bowl, like a step turning homeward. Make it from one stroke, with flat ends and the same thickness throughout.
  - **Wordmark:** "garuka" in lowercase, in a grotesque with open apertures. Inter Display or Satoshi are good references; check the licence before using either.
- **Colour:**
  - Kivu blue `#1f56b8` on white, or white on Kivu blue. Terracotta `#d2501c` is allowed only as a small accent (for example a dot on the stamp).
  - It must work in one colour, black on white.
- **Sizes:** it must read at 16 px as a favicon (the symbol alone) and as a 1024 px app icon.
- **Deliverables:**
  - SVG symbol, wordmark and lockup;
  - app icon 1024×1024 with no transparency (iOS);
  - favicon set (16, 32 and 180 px, plus an SVG);
  - social image 1200×630;
  - the scanner's home-screen icon (scanner background `#0f1216`).
  - Today the app has **none of these files**. The sign-in page uses a Lucide stamp icon as a placeholder until they exist.
- **Must not resemble:**
  - Loopy's mark: no loop or ring motifs, and no pink or amber pairing.
  - koroot's mark: no white rounded tile with a letter, and no emerald or navy.
  - Lay the drafts next to both marks and check the shape, the colour pair and any letterform trick.
- **Name check first:** confirm with a Kinyarwanda speaker that "garuka" reads as a warm "come back", with no awkward second meaning. Do the same check in Swahili and French.

## Step 5: voice

**Three words:**
- **Steady, not stiff.** Calm when something goes wrong. We say what happened and what to do next. No alarm and no "Oops!".
- **Warm, not chatty.** Like a shopkeeper who knows the regulars: friendly and brief. No jokes, no exclamation marks in errors, no emoji.
- **Plain, not blunt.** Short everyday words and the number first ("3 stamps to go"). Every sentence still has a "you" or a next step.

**Do and don't:**

| do | don't |
| --- | --- |
| "Nothing was saved. Check the connection and scan again." | "Error 503: request failed." |
| "15 days free. No card or MoMo needed to start." | "Start your risk-free trial today!!" |
| "Customers join from their own phone in seconds." | "Leverage frictionless omnichannel onboarding." |
| "Pair a new phone in 30 seconds. No new device needed." | "Please contact support to reset your device." |
| "3 stamps to go." | "You have accumulated 7 of 10 stamps." |

**The 10 most-seen strings.** They're rewritten in this voice, and none echoes the original's phrasing. Where a test pins a string, it already fits the voice, so it's kept.

| # | where | before | now | status |
| --- | --- | --- | --- | --- |
| 1 | sign-up lead | "15 days, no payment needed. Your first card takes about five minutes." | "15 days free. No card or MoMo needed to start. Your first stamp card takes about five minutes." | applied |
| 2 | sign-in lead | "Sign in to manage your cards." | "Sign in to your cards and counter phones." | applied |
| 3 | empty state (/cards) | "Pick a reward, choose your colours, and share a QR code. Customers join in seconds." | "Choose a reward and your colours, then print one QR code. Customers join from their own phone in seconds." | applied |
| 4 | trial banner | "Your cards keep working while you decide." | "Everything keeps working while you choose." | applied |
| 5 | setup checklist title | "Get ready for your first customer" | "Get ready for your first regular" | applied |
| 6 | share panel | "Customers scan this to join. Print it and put it where people pay." | "Customers scan this to join. Print it and stand it by the till." | applied |
| 7 | auth rail footer | "Digital stamp cards for small businesses." | "Garuka means “come back”. That’s the whole job." | applied |
| 8 | welcome email | "Welcome! Confirm your email…" | "Welcome to Garuka. Confirm your email…" | applied |
| 9 | main confirmation | "Your card is live" | kept | test-pinned (designer.spec), already in voice |
| 10 | scanner error | "No connection — nothing was saved" | kept | test-pinned (scanner-recovery.spec), already in voice |

Also renamed:
- the page title (now `%s · Garuka`) and the meta description;
- the scanner web-app manifest (now "Garuka counter");
- the renewal email subject.

## Step 6: sweep

`python3 sweep.py . --config replica/brand.json` was run on 2026-11-25 from `loyalty-clone/`. It printed **Clean**: none of the original's names, domains or colours, and none of koroot's.
- **The sweep is trustworthy:** I planted a probe file (`LoopyBadge #ed3e75`). The sweep reported both hits, and the probe was then deleted.
- **What it skips:** `node_modules`, build output and `replica/`. Recon and research notes there name the original on purpose.

**Checked by eye:**
- **Page titles:** Garuka.
- **Emails:** the welcome, reset, card-link and renewal emails carry no original name.
- **Favicon, app icon, OG image:** none exist yet; they're deliverables from the logo brief.

**Open before launch:**
1. The trademark, Play, handle and `.app`/`.co`/`.rw` checks in Step 2.
2. A Kinyarwanda speaker's check of the name.
3. The logo files.
4. A domain (`garuka.com` is taken).

Next: `/replica-launch`.
