# Components: loyalty clone v1

Source of truth for every UI part. Tokens come from `tokens.json` (Tailwind names: `bg-surface`, `text-text-muted`, `rounded-md`, `shadow-pop`). Screen IDs are from `recon.md`.

The accessible base is **Radix UI primitives** (Dialog, AlertDialog, DropdownMenu, Popover, Tabs, Switch, RadioGroup, Toast, Tooltip). Icons are **Lucide** (ISC licence). No icon, illustration, copy or colour comes from the original.

## Rules for every component

- **Tokens in code:**
  - Use Tailwind utilities (`bg-surface`, `text-text-muted`, `rounded-md`).
  - Outside utilities (inline styles, arbitrary values, plain CSS), use the raw `--tk-*` variables, for example `var(--tk-color-accent)`, **never** `var(--color-*)`. Tailwind's `@theme inline` only emits the `--color-*` variables that some utility uses, so a raw `var(--color-…)` can silently point at nothing.
  - `cn()` runs tailwind-merge, so a `className` passed in overrides the variant's conflicting utility.

- **Focus:** keyboard focus always shows a 2px `focus` ring with a 2px offset (`focus-visible`). Never `outline: none` without a replacement.
- **Hit areas:** at least 44×44 on touch. Scanner controls are at least 64×64.
- **Colour is never the only signal.** Errors get an icon and text. Status badges carry a word.
- **Busy states:** loading keeps the element's size and its accessible name, adds `aria-busy="true"`, and disables repeat submits.
- **Motion:** uses `--tk-motion-*` and `ease-out`. It turns off under `prefers-reduced-motion`, except opacity.
- **Numbers that change** (stamps, counts, money) use `tabular-nums`.
- **Copy** is ours, written fresh. It's plain and specific, never "Oops!".

---

## Actions

```
Button
  variants  primary (bg accent, text on-accent), secondary (bg bg, border border, text text),
            ghost (transparent, text text, hover bg surface), danger (bg danger, text on-danger)
  sizes     sm 32px / text-sm, md 40px / text-sm 600, lg 48px / text-base 600, scanner 64px / text-lg
  states    default, hover (accent-hover / surface), active (translateY 1px), focus-visible ring,
            disabled (opacity .5, cursor not-allowed, aria-disabled), loading (spinner left, label kept)
  tokens    radius md, padding x 16 (sm 12, lg 20), gap 8, motion fast
  a11y      real <button type>; icon-only needs aria-label + Tooltip; loading = aria-busy
  used on   all

IconButton
  sizes     sm 32, md 40, scanner 64 (round)
  a11y      aria-label required (TypeScript enforces it)
  used on   S04 (remove row), S14 (row actions), S28 (torch, close)

LinkButton
  variants  inline (underline), quiet (no underline until hover)
  a11y      <a> when it navigates, <button> when it acts; never the other way round
```

## Form fields

```
Field (wrapper)
  parts     label (text-sm 600), control, hint (text-xs text-muted), error (text-xs danger + AlertCircle)
  states    default, focus, invalid (border danger, aria-invalid, aria-describedby -> error id), disabled,
            read-only, locked (after activation: Lock icon + "Locked after the card went live" tooltip)
  a11y      <label for>; required marked with text "(required)", not just *
  used on   S01 S02 S04–S09 S16–S22 S33 S35

TextInput      text, email (inputmode email, autocomplete email), password (show/hide toggle),
               number, url, search (leading Search icon, clear button). height 40 (lg 48 on public pages)
               border border-input, radius md, bg bg
Textarea       auto-grow 3–8 rows; CharCount "42 / 90" turns warning at 90% and danger over the limit;
               aria-live polite on crossing a threshold
PhoneInput     country Select (flag emoji + dial code, searchable) + national number; stores E.164;
               default country from campaign.default_country
DateInput      native <input type=date> on mobile, Popover calendar on desktop
BirthdayInput  day + month selects only (no year: we don't need it, less personal data);
               Feb 29 allowed
Select         Radix Select; height 40; keyboard type-ahead
Checkbox       18px box, label clickable, consent variant wraps long text with links
RadioGroup     vertical list or SegmentedControl (2–4 options, e.g. expiry mode, audience)
Switch         36×20 track; on = accent; label left, state announced ("on"/"off")
Stepper        [−] value [+]; min/max disable the button; long-press repeats; number is typeable;
               scanner size 64 buttons and display-size value
ColorField     swatch button + hex input + Popover picker. Shows a LIVE contrast badge for the
               pair it affects (e.g. pass text on pass background): "Readable 7.1:1" (success)
               or "Hard to read 2.3:1, use a darker colour" (warning). Same maths as contrast.py.
               Never blocks saving: it informs the merchant.
ImageUpload    drop zone with target size ("Logo · 480×150 PNG"); states empty, dragging, uploading
               (progress), done (thumbnail + Replace + Remove), error (wrong type, too big, too small)
               with a fix hint; keyboard: Enter opens the file picker
IconPicker     grid of built-in stamp icons (Lucide set: coffee, cup-soda, scissors, dumbbell,
               utensils, croissant, star, heart, paw-print, flower) + "Upload your own";
               radio semantics, arrow keys move
FieldListBuilder  rows: label, type, required Switch, drag handle; system fields (name, email,
               phone, birthday) badged; rule shown: "Email or phone is always required".
               Removing a field with data opens a ConfirmDialog
```

## Navigation and layout

```
AppShell       sidebar 248 (collapses to a drawer < lg) + top bar 56; content max 1200, padding 24
               (16 on mobile); skip link "Skip to content" first in tab order
Sidebar        org switcher (later), primary nav: Cards, Customers, Messages, Automations,
               Locations, Settings; per-card section when inside a card; active item = bg surface +
               600 weight + aria-current="page"
TopBar         page title (h1), trial/plan Banner slot, account menu (DropdownMenu)
Tabs           Radix Tabs; designer tabs Design / Details / Locations / Terms / Form / Labels;
               a tab with errors shows a danger dot + "(has errors)" in its accessible name;
               locked tabs show a Lock icon
Breadcrumbs    Cards › Coffee card › Customers
PageHeader     h1 + description + actions (right; wraps below on mobile)
```

## Feedback

```
Banner         info, success, warning, danger; icon + text + optional action; dismissible where safe.
               Kinds: trial countdown, plan limit, locked-after-activation, past_due, locked, paused
Toast          Radix Toast bottom-right (bottom-center on mobile); success auto-dismisses 4s,
               error stays until dismissed; role status / alert
EmptyState     icon (Lucide, 40px in a surface circle) + title + one sentence + one primary action.
               Copy per screen (ours): S03 "Make your first card" / S14 "No one has joined yet —
               put your QR code where customers pay" / S18 "Add the places where customers visit you"
               / S32 "Nothing scanned on this device yet"
Skeleton       surface blocks with a 1.2s shimmer (none under reduced motion)
Spinner        16/20/24, currentColor, aria-hidden (the parent has aria-busy)
Badge          neutral, success, warning, danger, info; text-xs 600, pill radius.
               Status words: Draft, Live, Paused, Archived · In Apple Wallet, In Google Wallet,
               Web card only, Removed · Paid, Due, Overdue
InlineError    AlertCircle + message, used under fields and in forms' top summary
               (summary lists errors as links that focus the field)
```

## Overlays

```
Dialog         Radix Dialog; width 480 (form 560); title + body + footer actions (primary right);
               Esc and the close button close it; focus is trapped and returned on close; full-screen
               sheet under sm
ConfirmDialog  Radix AlertDialog; destructive variant: danger button with the exact action
               ("Delete Aline's card"), and for irreversible actions a typed confirmation
               (deleteAccount: type the business name)
Popover        Radix Popover for ColorField, DateInput, filters
DropdownMenu   Radix; row actions in S14: Give stamps, Copy card link, Edit details, Delete card
               (danger, separated)
Tooltip        only for icon buttons and locked fields; never the only place information lives
Sheet          mobile drawer for the sidebar and the filter panel
```

## Data display

```
DataTable      sortable headers (aria-sort), keyset pagination ("Load more", not page numbers),
               sticky header, row click opens detail (row is a link, not a click-handler div),
               states loading (skeleton rows), empty (EmptyState), no results ("No customers match
               'xyz'" + Clear search); columns stack into cards under md
StatTile       label (text-sm muted) + value (2xl tabular) + delta (success/danger with an arrow AND
               a +/− sign) + period; loading skeleton; empty "—"
Chart          line/bar over time (Recharts); always has a visible table toggle for screen readers;
               colours from accent + text-subtle; no red/green-only encoding
Timeline       event rows: icon by type (Stamp, Gift, CheckCircle, Smartphone, Trash), sentence
               ("Front counter added 2 stamps"), relative time with absolute in title/tooltip
KeyValue       label/value rows for card detail and settings summaries
QRBlock        QR (SVG, quiet zone 4 modules) + link with Copy button + Download PNG / SVG / poster;
               the link is also shown as text so it can be read out or typed
```

## Loyalty-specific

```
StampStrip     the stamp grid (SVG), the single renderer used for: pass strip images (server,
               resvg), the web card, the designer preview, the scanner and the customer detail.
               props: total 1–30, filled, icon, stamp colour, empty colour, background
               layout: rows of up to 5 (≤10 stamps), 6 (≤18), 8 (≤30); reward slot drawn with a ring
               a11y: role img, aria-label "7 of 10 stamps"
PassPreview    variants apple-front, apple-back, google, web-card; shows merchant colours, logo,
               StampStrip, fields, QR (blurred "Preview" overlay); toggled by a SegmentedControl;
               updates live while designing (S04–S09)
WebCard        the customer page /c/{serial} (S23): merchant header, StampStrip, "3 more stamps to a
               free coffee", reward ready state (celebration, no motion under reduced motion), QR at
               max brightness area + manual code under it, latest message, wallet buttons, card back
               info in an accordion. Max width 440, works at 320. First name only.
WalletButtons  Add to Apple Wallet / Save to Google Wallet using the OFFICIAL badges under Apple's
               and Google's guidelines (their artwork, their rules; we don't restyle them);
               OS-detected order; desktop shows "Open on your phone" + QRBlock
JoinForm       S22: merchant-branded header (merchant colours), description, dynamic fields,
               consent, Turnstile, Join button full width lg; success goes to WebCard; "already have
               a card" response shows a neutral "We've sent your card link" panel
ScannerView    S28: full-bleed camera (object-fit cover), framing square with corner marks,
               torch + front/back + close IconButtons (scanner size), "Type code" button opening a
               manual-code sheet; states: asking permission (explains why first), denied (how to
               re-enable for iOS / Android), scanning, found (haptic + tone if enabled), error.
               Dark scanner tokens. Camera stays on one route (iOS permission).
TransactionPanel  S29: customer first name + StampStrip + "Lifetime 23 · Last visit 3 days ago";
               Stepper (scanner size) for stamps (− limited to current); Reward toggle(s) with the
               reward name; Submit (scanner Button) showing the outcome sentence before confirm
               ("Add 2 stamps — this completes the card: 1 free coffee earned"); ConfirmDialog
               optional per device setting
ScanResult     S30: full-screen success (scanner-success, check, "2 stamps added · 9 of 10") or
               error (scanner-danger, plain sentence + next step, e.g. "This card was replaced —
               ask the customer to open their latest card"); auto-returns to camera after 3s
               (pausable, announced via role alert)
PairingCode    S19: big QR + 6-char fallback code + countdown (10 min) + device label; device list
               with Last seen and Revoke (ConfirmDialog)
SegmentBuilder (later) metric Select + operator + value + live count
AudiencePicker S17: v1 one option "Everyone with this card" + honest reach line:
               "212 wallet passes · 64 web cards"
BudgetNote     S17/S35 inline info: "Each card gets at most 3 notifications a day. Anyone already
               at today's limit is skipped, and the report shows how many."
AutomationCard S35: icon, title, Switch, body Textarea with {name} token chips, days input
               (win-back), send-hour Select (org time zone shown), forecast line
               ("About 14 customers in the next 7 days"), recent sends list; off state is a
               short explanation + Switch
PlanCard       S21: name, price (USD or RWF by currency toggle), limits list, current/recommended
               Badge, CTA; MoMo/Airtel/card logos as text labels, not their trademarks
```

## Screen → component map (v1)

| screen | main components |
| --- | --- |
| S01–S02 | AppShell-less centered Card, Field, TextInput, Button, LinkButton |
| S03 | PageHeader, card grid (PassPreview mini + Badge), EmptyState, Banner (limit) |
| S04–S09 | Tabs, Field, ColorField, ImageUpload, IconPicker, Stepper, Textarea, FieldListBuilder, PassPreview |
| S10–S12 | QRBlock, Dialog, ConfirmDialog, StatTile, Button |
| S13 | StatTile, Chart, Field (ROI inputs) |
| S14–S16 | DataTable, DropdownMenu, KeyValue, Timeline, Dialog + Stepper |
| S17 | AudiencePicker, Textarea + CharCount, BudgetNote, DataTable (history) |
| S18 | DataTable, Dialog, Field (Places search) |
| S19 | PairingCode, DataTable |
| S20–S21 | Field, PlanCard, Banner, ConfirmDialog |
| S22–S23, S26 | JoinForm, WebCard, WalletButtons, QRBlock |
| S27–S31 | ScannerView, TransactionPanel, ScanResult, QRBlock |
| S35 | AutomationCard, BudgetNote |
