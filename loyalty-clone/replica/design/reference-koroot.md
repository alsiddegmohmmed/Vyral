# Layout reference: koroot.io (structure only)

Studied 2026-11-25 in the owner's own signed-in Chrome session, at a 1506 × 812 viewport (page width 1680 CSS px). I only looked: I took no account action and submitted no forms. I opened the completed or current steps from the step rail and nothing else.

**Clean-room rule.** This file records *structure and UX patterns* in our own words. We take nothing else from the reference: no logo, colours, copy, icons, illustrations or photos. Their accent colour, their imagery and their typeface choice do not carry over. Our tokens (`tokens.json`) stay the source of truth for colour and type. See `components.md` for the full rules.

---

## 1. Onboarding

### 1.1 Frame

- **Two columns, full height.**
  - Left: a fixed **step rail**, 320 px wide, with a darker surface than the content and a 1 px divider on its right edge.
  - Right: the content area, scrolling independently.
- **Rail, top to bottom:**
  - the product mark (~32 px) and its name;
  - a small uppercase eyebrow label for the list (12 px / 600, letter-spacing ~0.05 em, muted);
  - the step list;
  - the account exit (sign out), pinned to the bottom above a divider.
- **The content column is centred.** There's a max-width wrapper (~1024 px) with 56 px top padding and 24 px side gutters. Forms inside it are narrower (~672 px).

### 1.2 Step list (the progress pattern)

- **Each step is a full-width button** in the rail: 56 px tall, 10 × 12 px padding, 10 px radius, 12 px gap.
  - It has three parts: an indicator, two lines of text, and a chevron.
  - Title: 14 px / 500. Subtitle: 12 px, muted. The subtitle is a 2–4 word summary of what the step asks for.
- **Indicator states:**
  - **Done:** filled circle with a check, in the accent colour.
  - **Current:** numbered circle. The row also gets a raised surface and a trailing chevron ("you are here").
  - **Upcoming:** numbered circle, title and subtitle dimmed to about 50%. You can't open these steps yet.
- **Done steps stay clickable,** so you can go back and edit. Steps unlock in order.
- **Six steps:** welcome → plan/industry → brand → card → locations → done. The last step is a celebration and summary, not a form.

### 1.3 Step page anatomy (repeated on every form step)

1. **Eyebrow:** "STEP n OF N" (12 px / 600, uppercase, tracked, muted).
2. **H1:** 36 px / 700, 40 px line height, slight negative tracking (−0.025 em).
3. **Lead:** one sentence, 16 px, muted, max ~672 px wide.
4. **A hairline divider** under the header.
5. **The body:**
   - form steps use one narrow column of fields: label 14 px / 500 above a 40 px input, 8 px radius, ~24 px between fields;
   - choice steps use a grid of tiles.
6. **Footer action bar** behind a top hairline:
   - a ghost "previous" link on the left (arrow plus text);
   - the primary "save and continue" on the right (arrow plus text, 40–44 px tall, soft shadow).
   - The bar stays at the bottom of the content column, so the main action is always in the same place.

### 1.4 Welcome step (step 1)

This is not a form. It's an orientation page:

- **Hero:** an accent-tinted pill with an icon and a one-line label, then the H1 (48 px / 700, tight 1.0 line height, two lines), then a 18 px muted lead promising how long setup takes.
- **Three equal tiles** in a row explain the promise: time to finish, the wallet benefit, and that you can resume later.
  - Each tile: an icon in a 32 px tinted square, a 14 px / 600 title, and a 12–13 px muted description.
  - Tile styling: 12 px radius, 1 px border, about 16 px padding.
- **One primary button** below the tiles.
- **An FAQ accordion** at the bottom: rows with a chevron, divided by hairlines. It answers objections before they come up (do customers need an app, can I change the design, what does it cost).
- **A language picker card** sits at the top as a segmented row of three large choice buttons.

### 1.5 Choice-tile grid (industry step)

- **Six columns** of square-ish tiles (~136 × 112 px), 8 px gaps, 10 px radius, 1 px border.
  - Each tile has an image at the top and a centred label at the bottom (14 px / 600).
- **Selected state:** accent border, a faint accent tint, and a small check in the top-right corner.
- **Single select.** The footer button commits the choice.

### 1.6 Form step (brand details)

- **One column, about 420 px wide.** The fields are: name, sector (select), country (select with flag), logo (a 64 px dashed drop square plus an "upload" secondary button), and two colour fields side by side (swatch plus hex).
- **Required fields** are marked in the label, and an inline red error sits under the field ("upload a logo before saving").
- **Helper text** goes between the label and the control (12 px, muted).

### 1.7 Density and type scale (onboarding)

| Role | Size / weight | Line height |
|---|---|---|
| Hero H1 (welcome) | 48 / 700 | 1.0 |
| Step H1 | 36 / 700, −0.025 em | 40 |
| Lead | 16–18 / 400, muted | 1.5–1.6 |
| Card title | 18 / 600 | 28 |
| Field label, step title | 14 / 500 | 20 |
| Body small, input text | 14 / 400 | 20 |
| Meta, eyebrow, subtitle | 12 / 600 caps, or 12 / 400 | 16 |

- **Spacing rhythm:** an 8 px base. There are 24 px gaps inside sections and 40–56 px between the header and the body.
- **Radii:** 8 px for inputs, 10 px for list rows and tiles, 12 px for cards and big buttons.
- **The look overall is calm and roomy:** one decision per screen, with large type and a lot of empty space.

### 1.8 What we take

- A left **step rail** with done / current / locked states and a two-line description per step.
- The step header anatomy: eyebrow "Step n of N", H1, lead, divider.
- A **fixed footer action bar** with back on the left and the primary button on the right.
- A **welcome page** made of a promise and three benefit tiles.
- **Choice tiles** with a check-corner selected state.

### 1.9 What we leave

- Their colours (dark navy rail, green accent), their imagery, their mark, their wording, and their font choice.
- The language picker. That's a separate feature, not a layout pattern.

---

### 1.10 Later onboarding steps (watched while the owner completed them)

- **Step 4, card.** This is the biggest step, a split screen.
  - **Left:** the editor, with a top row of choices (three candidate designs, each in a phone frame tagged "Option n of 3"), then a tab strip (stamps & reward · styling · stamp icon · background · layout).
    - Under the tabs: 2×2 mechanic tiles (icon, title, one-line example; one is "coming soon" and locked), then a "Configure" card with a two-column field grid and reward chips.
  - **Right:** a **sticky phone preview** that updates live.
- **Step 5, locations.**
  - An illustration band, then a location row card showing its status, with an inline error in red text ("not set").
  - Below that, a dashed "add" panel with a two-way segmented choice (search / paste a link) and a search field with a square icon button.
  - **The primary button changes its label with the state,** for example "skip for now" when nothing is set. Good pattern: the button always says what will happen.
- **Step 6, done.** A centred column with no step header:
  - a big check badge, then an H1 plus an emoji, then one line saying the program is live;
  - a card holding the join QR, a "try it" button, and a monospace join link with a copy button;
  - a primary "next: how to add stamps" button, which leads into a **four-slide staff walkthrough** (phone mock, "step n of 4", title, one line, back/next).
- **The rail stays visible through all six steps,** and every step finished turns into a check.

---

## 2. Dashboard

Studied in a second tab at the same viewport after onboarding was complete: Overview, Cards, Customers, plus the Branches page the owner had open.

### 2.1 Shell

- **Left sidebar,** 256 px, full height, its own darker surface, no top bar.
  - **Header:** the mark plus the product name, and a collapse button (32 px) on the right.
  - **Nav:** one flat list of about 14 items, each an icon plus a label.
    - Row: 40 px tall, 10 × 12 px padding, 10 px radius, 12 px gap, 14 px / 500.
    - No group headings. Overflow goes under a "More ›" row.
  - **Active item:** a raised surface fill, with the icon and label in the accent colour.
  - **Footer, pinned:** a prominent help button (full width, filled), "what's new", a language pill, and the account row.
    - Account row: an avatar initial, the business name, the plan name in muted text, and a sign-out icon button.
- **Main area:** 32 px padding on every side, full width of the remaining space (no max-width at 1680). The page background is one step lighter than the sidebar.

### 2.2 Page header

- **Left:** an H1 (30 px / 700, 36 px line height) with a one-line muted description under it (16 px).
- **Right:** the page's primary action or a filter, top-aligned with the H1. For example "add location", or a date-range button with a calendar icon.
- **A dismissible banner can sit above the header.** One example is "walk through onboarding again": a tinted card with an icon tile, a title and one line, a primary button on the right, and a close × in the corner.

### 2.3 Overview (home)

Each section is a block, from top to bottom:

1. **Hero metrics card,** full width, 10 px radius, 1 px border.
   - Its title names the period.
   - **Left ~75%:** a row of four inline metrics (a coloured dot as the series key, a 13 px label plus an info icon, and a 24 px / 600 number), with a line chart underneath.
   - **Right ~25%:** behind a vertical divider, three stacked secondary metrics (number, then label) separated by hairlines.
2. **Four stat tiles,** in a row of equal width.
   - Each tile: the number top-left (24–28 px / 600), a status dot top-right, and an info icon plus label at the bottom.
   - Tile styling: about 110 px tall, 18 px padding, 10 px radius.
3. **Named sections.** Each one opens with a **section chip:** a small bordered pill holding the section name, followed by a hairline that runs to the right edge. The sections are "join link reach" (four tiles), "finance" (a chart card), "performance" (three tiles) and "points" (two chart cards side by side).
4. **Recent activity:** a table with small uppercase column headers (12 px, tracked, muted): customer, date/time, event, location, quantity. When the table is empty, it shows one centred muted line inside the table area.

- **Density:** gaps of about 20 px between tiles and 40 px between sections. The numbers are big and the labels small, so the page reads like a report you scroll.

### 2.4 List page (customers)

- **Header:** an H1 plus a count line ("0 of 0 members").
- **A filter card:** a full-width search field (search icon, 40 px) on the first row, and a wrapping row of compact select pills on the second (status, wallet, device, location, date ranges, plus a min/max number pair).
- **Results:** a card underneath. The empty state is a single centred muted line, with no illustration.

### 2.5 Cards page

- **Header:** an H1 plus a description, then a small **segmented switch** (two options, 32 px, inside a 4 px padded track) for the page's two modes.
- **"Your cards" grid:** each card is drawn as a **phone frame** (~240 × 480) showing the live pass. Under it: the card name with an edit icon, a full-width "open" button, and a row of small icon actions (pause, duplicate).
  - Each card has a status chip ("active") and a type chip above it.
- **The first slot is a dashed "create" tile,** the same size as a card, with a sparkle icon and a "from scratch" button under it.
- **A "start from a template" grid** below repeats the same phone-frame tiles.

### 2.6 Smaller patterns

- **Location card:** an icon tile, a status chip, and edit/delete icon buttons in the top row. Then the name (16 px / 600), the address in muted text, a check-and-label status line, and a secondary button bottom-right.
- **Info icons next to metric labels** explain each number. They help a lot on a dashboard full of rates.
- **Plan limits are shown inline,** for example "1 / 1 on the free plan · upgrade" in the header line. The UI doesn't hide the cap.

### 2.7 What we take for the dashboard

- A 256 px sidebar: a flat icon-and-label list, 40 px rows, an accent-tinted active row, and a pinned account block (business name and plan).
- The page header pattern: H1, description and right-aligned action.
- Overview: a hero metrics card (inline metrics, a chart and a side column), then a row of stat tiles, then named sections with a chip-and-hairline heading.
- Cards list: cards drawn as passes in a grid, a dashed "create" tile first, a status chip, and an open button under each card.
- Empty states inside the table or card frame as one muted line, plus a next step where one exists.

### 2.8 What we leave

- The green accent, the navy sidebar, the WhatsApp help button styling, their nav labels and order, their copy and images, and the stamp-icon art.
- Features we don't have yet (link-in-bio, menu and orders, finance) aren't added to our nav just to match.

### 2.9 Not observed

- Their phone-width layout. I didn't resize the owner's window, so how their sidebar collapses at 390 px isn't recorded. Ours will use a top bar with a menu drawer at that width.
