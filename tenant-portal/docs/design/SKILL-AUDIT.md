# UI/UX Pro Max — Compatibility Audit

Audited: **2026-08-28**

Auditor: `ui-ux-pro-max` v2.13.0 (119 UX guidelines, 74 font pairings, 192 palettes)

Subject: this portal's design documentation — [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md)
and its supporting pages.

Product context supplied: **SaaS ERP web app, Arabic-first RTL, cold-blue light
palette, dense data workspace, Next.js 16.**

---

## Summary

| Outcome | Count |
| --- | ---: |
| Rules where the docs already agree with the skill | 14 |
| **Real gaps found** | **17** |
| Deliberate divergences (documented, keeping ours) | 5 |
| Skill guidance that does not apply to this product | 5 |

## Status — documentation closed, code landed

**All 17 gaps are specified in the docs (2026-08-28) and implemented in `src/`
(2026-08-31).** Every B-item below has an exact rule in the page that owns it
and a call site in the code.

| Gap | Landed in | Where |
| --- | --- | --- |
| B1 · 16px inputs | Phase 3 · 3.1 | `textEntrySize` on `Input`, `Textarea`, `SelectTrigger`, `Combobox`, `MultiSelect`; `FilterBar`'s search inherits it through `Input` |
| B2 · Focus after failed submit | 3.2 | `FormDrawer` focuses the first `[aria-invalid="true"]`; covered by `FormDrawer.test.tsx` |
| B3 · Board single-pointer alternative | Phase 2 | `views.md` |
| B4 · `focus-not-obscured` | Phase 2 | `DataTable` scroll-margin |
| B5 · `aria-sort` | Phase 2 | `DataTable` |
| B6 · Skip link | 3.3 | `AppShell`, first focusable element, `<main id="main" tabIndex={-1}>`; covered by `AppShell.test.tsx` |
| B7 · z-index scale | Phase 0 · 0.17–0.20 | Six `--z-*` tokens, an ESLint selector, a census counter |
| B8 · `cursor-pointer` | 3.4 / 3.31 | `Button` base CVA, plus every clickable row, card and overlay control |
| B9 · Autofill on login | 3.5 | `autocomplete` + `name` on both fields, paste never blocked |
| B10 · Validate on blur | 3.6 | `useBlurValidation`; covered by `Field.test.tsx` |
| B11 · Long-token wrapping | 3.7 | `identifierText` (`wrap-anywhere`, never `break-all`) plus `<bdi>` |
| B12 · Chip overflow | Phase 1 | `FilterBar` |
| B13 · Badge announcement | 3.8 | Polite live region announcing a whole phrase in `NotificationsDropdown` |
| B14 · Toast a11y contract | 3.9 | `AppToast` is `role="status"` + explicit `aria-live="polite"`, never `role="alert"` |
| B15 · Scroll restoration | Phase 2 | `useScrollRestoration` |
| B16 · `readOnly` ≠ `disabled` | 3.10 | `readOnlySurface` + `Field readOnly`; covered by `Field.test.tsx` |
| B17 · Prose line length | 3.11 | `proseMeasure` on every prose surface |

**One correction found while implementing B8.** `Button`'s base carried
`disabled:pointer-events-none` alongside the documented
`disabled:cursor-not-allowed`, which made the cursor rule unrenderable — a
pointer-events-none element is not hit-tested, so the cursor comes from its
ancestor. The `pointer-events-none` was also doing no work: a native
`<button disabled>` already blocks clicks and focus, and Tailwind's
`disabled:` variant is the `:disabled` **pseudo-class**, which never matches
the `<a>` an `asChild` button renders. It was removed, and the per-variant
hovers moved to `not-disabled:hover:*` so a disabled control still does not
light up. A disabled button inside a `Tooltip` now also shows its tooltip,
which is the accessible way to say *why* it is disabled.

| Gap | Specified in |
| --- | --- |
| B1 · 16px inputs on mobile | [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md#inputs-are-16px-on-mobile) · [typography.md](typography.md) · [primitives.md](primitives.md) |
| B2 · Focus after failed submit | [patterns.md](patterns.md#focus-after-a-failed-submit) |
| B3 · Board single-pointer alternative | [views.md](views.md#every-card-carries-a-move-to-action--not-optional) |
| B4 · `focus-not-obscured` | [patterns.md](patterns.md#datatable) · [accessibility.md](accessibility.md) |
| B5 · `aria-sort` | [patterns.md](patterns.md#datatable) |
| B6 · Skip link | [shell.md](shell.md#skip-link--the-first-focusable-element-in-the-app) |
| B7 · z-index scale | [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md#stacking-order) · [geometry.md](geometry.md) |
| B8 · `cursor-pointer` | [primitives.md](primitives.md#button) · [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md#9--non-negotiables) |
| B9 · Autofill on login | [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md#71-login--login) |
| B10 · Validate on blur | [primitives.md](primitives.md#validate-on-blur-not-on-keystroke) |
| B11 · Long-token wrapping | [typography.md](typography.md) |
| B12 · Chip overflow | [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md#toolbar--28px-controls) · [patterns.md](patterns.md#filterbar) |
| B13 · Badge announcement | [shell.md](shell.md#the-unread-badge-has-to-be-announced) |
| B14 · Toast a11y contract | [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md#the-accessibility-contract) |
| B15 · Scroll restoration | [views.md](views.md) · [state.md](../architecture/state.md) |
| B16 · `readOnly` ≠ `disabled` | [primitives.md](primitives.md#readonly-is-not-disabled) |
| B17 · Prose line length | [typography.md](typography.md) |

Test assertions for B2, B3, B5, B6, B10 and B16 are in
[testing.md](../architecture/testing.md#phase-3-minimum); the review steps for
all of them are in
[accessibility.md](accessibility.md#per-screen-review-checklist).

Nothing in the audit invalidates the cold-blue palette, the density decisions,
or the toast rule. The gaps are almost entirely **accessibility mechanics the
docs never specified**, not visual-design disagreements.

> **Read after the admin-portal token port.** The audit's *findings* all still
> hold — none of them turned on a specific hue, size or face. Its *figures* do
> not: this page quoted the pre-port palette's contrast ratios and the pre-port
> font choice, and both have been corrected in place below. Sections C and D5
> are unaffected; D2 and E are the two that had to be rewritten.

---

## A · Where the docs already match the skill

No action needed. Recorded so a future pass does not "fix" what is correct.

| Skill rule | Where we already have it |
| --- | --- |
| `primary-action` — one primary CTA per screen | The one-filled-action rule |
| `blur-purpose` — blur for dismissal, not decoration | Blur budget = 1, modal scrim only |
| `no-emoji-icons` — SVG, not emoji | anti-patterns.md §9 |
| `icon-style-consistent` — one icon family | `lucide-react` throughout |
| `color-not-only` / `color-not-decorative-only` | `StatusBadge` always renders a text label |
| `elevation-consistent` | base / raised / overlay ladder |
| `number-tabular` | `tabular-nums` on every numeric column |
| `reduced-motion` | Ships in the foundation commit, not a polish pass |
| `virtualize-lists` (50+) | Board columns virtualize above 50 cards |
| `focus-states` (2–4px visible ring) | `focusRing`, `focus-visible`, measured **4.86:1** |
| `color-accessible-pairs` (4.5:1 / 3:1) | Every pairing computed by `design:contrast`, plus a negative control that has to keep failing |
| `exit-faster-than-enter` (~60–70%) | Enter 120ms / exit 90ms = 75% |
| `toast-dismiss` (3–5s) | 4000ms default |
| `adaptive-navigation` (≥1024px sidebar) | Sidebar at `lg`, sheet below |

---

## B · Real gaps — the refactor list

Ordered by severity. Each cites the skill rule that found it.

### B1 · Inputs are 14px — iOS Safari will auto-zoom on focus
**Rule:** `readable-font-size` — "Minimum 16px body text on mobile (avoids iOS auto-zoom)"

`DESIGN-SYSTEM.md` §2 sets `text-sm` (14px Latin / 15px Arabic) as the size for
"body, **inputs**, buttons, nav". Mobile Safari zooms the viewport whenever a
focused input is under 16px, which throws the whole page out of layout and the
user has to pinch back.

Desktop is unaffected, and this is a laptop-first ERP — but `/login` is the one
screen genuinely reached from a phone, and it is exactly where a zoom-on-focus
is most damaging.

**Fix:** raise the input font-size to **16px at mobile widths only**, keeping
the dense 14px on `sm:` and up:

```
text-base sm:text-sm      /* on Input, Textarea, Select trigger */
```

This costs nothing on desktop density and removes the zoom entirely.

### B2 · No focus management after a failed submit
**Rules:** `focus-management`, `error-summary`, `aria-live-errors`

The docs specify inline field errors (`aria-invalid` + `aria-describedby`) plus
a summarising toast. What they never specify is **where focus goes** after a
failed submit.

The skill's rule allows either path — a focusable error summary at the top, or
focus moved to the first invalid field. **Our toast-only rule survives**: we
take the second path.

**Fix:** document in `patterns.md` that `FormDrawer`/form submit must, on a
422, move focus to the **first invalid field** and ensure its error text is
announced. Add it to the `FormDrawer` test list.

### B3 · Board drag has a keyboard path but no single-pointer alternative
**Rule:** `dragging-alternative` (WCAG 2.2 AA) — "Every author-controlled drag action needs a single-pointer **and** keyboard alternative"

`views.md` requires the `@hello-pangea/dnd` keyboard path, which satisfies the
keyboard half. It does not provide a **pointer** alternative — a user who
cannot perform a sustained drag (tremor, touchpad difficulty, switch device)
has no way to move a card between stages.

This is a conformance failure, not a nicety.

**Fix:** every board card gets a "Move to…" action in its overflow menu that
opens the same stage `Select` the detail screen uses. One control, reuses the
existing move mutation, satisfies AA.

### B4 · Sticky chrome can obscure the keyboard-focused control
**Rule:** `focus-not-obscured` (WCAG 2.2 AA)

We stack four sticky layers: the topbar (44px when this was written, 48px since
the admin port), sticky table header, sticky inline-start first column, sticky
inline-end action column. A `Tab` into a row action near a viewport edge can
land behind one of them, with no visible focus.

**Fix:** add `scroll-margin` on focusable row content sized to the sticky
offsets, and add a check to the a11y checklist: tab to the first and last
column of the top and bottom row and confirm the ring is fully visible.

### B5 · Sortable columns have no `aria-sort`
**Rule:** `sortable-table` — "must support sorting with `aria-sort` indicating current sort state"

`DataTable` specifies server-side sorting but never the ARIA state, so a
screen-reader user cannot tell which column is sorted or in which direction.

**Fix:** `<th aria-sort="ascending|descending|none">` driven by `SortState`.
Add to the `DataTable` test list.

### B6 · No skip link
**Rule:** `skip-links` — "Skip to main content for keyboard users"

With a 240px sidebar of up to 11 nav items, a keyboard user tabs through the
entire nav on every page load before reaching content.

**Fix:** visually-hidden "Skip to content" as the first focusable element in
`AppShell`, targeting `<main id="main">`, revealed on focus.

### B7 · No z-index scale
**Rule:** `z-index-management` — "Define layered z-index scale"

We have at least six stacking contexts (sticky header, sticky columns, topbar,
dropdown, dialog, toast) and no documented ordering. This is exactly how a
dropdown ends up behind a sticky column.

**Fix:** add tokens to `globals.css` and document the ladder:

```
--z-sticky-cell: 10   --z-sticky-header: 20   --z-topbar: 30
--z-dropdown: 40      --z-overlay: 100        --z-toast: 1000
```

### B8 · `cursor-pointer` is not specified
**Rule:** `cursor-pointer` — appears in the skill's own pre-delivery checklist

Radix and native `<button>` do not set it; Tailwind Preflight does not either.
Clickable rows and cards are the likely offenders.

**Fix:** `cursor-pointer` in the `Button` base CVA and on any clickable row or
card. One line in `primitives.md`.

### B9 · Login is missing autofill/password-manager support
**Rules:** `autofill-support`, `accessible-authentication` (WCAG 2.2 AA — "Allow password managers and paste")

`detail-screens.md` and the login spec never mention `autocomplete` attributes.
Without them, password managers cannot fill reliably.

**Fix:** `autocomplete="username"` / `autocomplete="current-password"` on
login, `autocomplete="email"` on the reset dialog. **Never** block paste on a
password field. Add a line to the a11y checklist.

### B10 · No inline-validation timing rule
**Rule:** `inline-validation` — "Validate on blur (not keystroke)"

Unspecified, so implementations will diverge. Validating per keystroke shows an
error before the user has finished typing their first character.

**Fix:** validate on **blur**, re-validate on change only after a field has
already errored once. Document in `patterns.md` under `FormDrawer`.

### B11 · No wrapping rule for UUIDs and correlation IDs
**Rule:** `long-token-wrapping` — "Let URLs, IDs, and user content reflow with `overflow-wrap: anywhere`"

We display `correlationId` and idempotency keys in toasts and error surfaces —
unbroken 36-character strings that will overflow a toast at mobile width.

**Fix:** `overflow-wrap: anywhere` on the mono/ID utility class. Never
`word-break: break-all`, which also mangles prose.

### B12 · FilterBar chips have no overflow behavior
**Rules:** `chip-collection-reflow`, `compact-label-overflow`

`DESIGN-SYSTEM.md` §7.3 specifies removable filter chips on a second line but
not what happens when there are twelve of them.

**Fix:** wrap the collection before shrinking any label; past two rows collapse
to an operable `+n` disclosure — a real button that reveals the rest, not a
static count.

### B13 · Notification badge count is not announced
**Rule:** `contextual-live-badge-updates` — "Announce a changed count/status as a complete contextual phrase without moving focus"

The realtime unread count changes silently for screen-reader users.

**Fix:** a polite live region announcing a full phrase from the dictionary
("3 unread notifications"), not a bare number, and never moving focus.

### B14 · Toast accessibility contract is unspecified
**Rule:** `toast-accessibility` — "Toasts must not steal focus; use `aria-live="polite"`"

Given that **every** write result in this product is a toast, this is
load-bearing — but it is nowhere in the docs.

**Fix:** document that `sonner` is configured `aria-live="polite"`, never
`assertive`, never auto-focused; and that the permanent (`duration: 0`)
ambiguous-outcome toast must be keyboard-reachable to retry and dismiss.

### B15 · Scroll position is not restored on back navigation
**Rule:** `state-preservation` — "Navigating back must restore previous scroll position, filter state, and input"

Filters and pagination live in the URL (good), but scroll position is
unaddressed. Returning from a detail screen to row 40 of a table drops you at
the top.

**Fix:** document the expected behavior and rely on Next's scroll restoration;
verify it survives the board view's internal scroll container.

### B16 · Read-only is not distinguished from disabled
**Rule:** `read-only-distinction` — "Read-only state should be visually and semantically different from disabled"

`crm-catalogues.md` states some CRM settings sections are deliberately
read-only. Rendering those as `disabled` tells the user "temporarily
unavailable" when the truth is "not editable here".

**Fix:** a `readOnly` presentation on `Field` — normal text contrast, no
reduced opacity, `aria-readonly`, with a short reason line.

### B17 · No line-length control for prose
**Rule:** `line-length-control` — "desktop 60–75 chars"

Dialog descriptions, empty states and the ambiguous-outcome panel are prose in
a full-width container.

**Fix:** `max-w-[65ch]` on prose blocks. Table cells and labels are exempt.

---

## C · Deliberate divergences — keeping ours

Each is a considered decision, not an oversight. Recorded so nobody "fixes"
them later.

| Skill rule | Our decision | Why |
| --- | --- | --- |
| `truncation-strategy` — prefer wrapping | **Truncate + `title`** in table cells | A wrapping cell breaks the fixed row height (36px then, 44px now) and shifts every row below it. Wrapping applies to prose, which we do wrap |
| `empty-nav-state` — explain unavailable destinations | **Hide** unpermitted routes | Enumerating capabilities a user lacks is an information leak. Our unavailable boundary already explains *sealed* routes, which is the case the rule is really about |
| `undo-support` — undo for destructive actions | **`AlertDialog` confirm** | No backend undo endpoint exists. A fake undo that cannot restore the record is worse than a confirm |
| Checklist "hover 150–300ms" | **120ms** | The skill's own `duration-timing` rule supersedes the flat number: "choose tokens by distance, complexity… instead of treating one duration range as universal". 120ms on a dense table reads as instant |
| `nav-label-icon` — icon-only nav harms discoverability | **Icon rail when collapsed** | Collapse is user-chosen and reversible, every rail icon has a tooltip and `aria-label`, and the expanded default shows labels |

---

## D · Skill guidance that does not apply here

Where the tool is outside its competence for this product. Stated plainly so
its output is not over-trusted next time.

### D1 · Zero RTL coverage — our single largest constraint
All 119 UX guidelines were searched for `rtl`, `right-to-left`, `bidirectional`
and `bidi`: **0 matches.** Logical properties (`margin-inline`, `ms-`/`me-`):
**0 matches**, including in the Tailwind stack file.

The skill cannot audit the thing this app is most shaped by. Our RTL rules are
**additive**, not conflicting — there is simply nothing to reconcile.

### D2 · Its typography recommendations cannot be used
Of 74 curated font pairings, **exactly one** supports Arabic (Noto Naskh Arabic
+ Noto Sans Arabic). Every pairing it recommended for this product — Plus
Jakarta Sans, Fira Code/Fira Sans, Exo/Roboto Mono — has **no Arabic subset**
and would fall back mid-sentence.

The finding holds; the example moved. At the time of the audit the chosen face
was Readex Pro with Zain as its documented fallback, and the skill's own
`google-fonts.csv` contained both while its pairing database had no entry for
either. The faces are now **IBM Plex Sans + IBM Plex Sans Arabic + IBM Plex
Mono**, ported from the admin portal — a pairing the skill likewise does not
list. The type decision in this product is driven by Arabic coverage and by
consistency with the sibling portal, neither of which this tool models.

### D3 · `--design-system` returns landing pages for an internal app
Its PATTERN axis reads from `landing.csv` — **35 rows, all marketing-page
structures**. Three separate queries ("SaaS ERP", "internal admin panel",
"data table dense") each returned Hero / Features / CTA / "Start trial"
sections and a `Contact Sales` CTA.

Used the one retry the skill's own contract allows; the retry returned the same
class of result plus a **dark** palette, contradicting the cold-blue-light
requirement. Per its contract, treating `--design-system` output as unverified
for this product. **The `--domain` searches are the usable part** and produced
every finding in section B.

### D4 · It recommended Glassmorphism, contradicting itself
`--design-system` returned Glassmorphism (backdrop blur 10–20px) twice. That
conflicts with our blur budget of 1 — and with the skill's **own**
`blur-purpose` rule: "use blur to indicate background dismissal, **not as
decoration**." An internal contradiction in the tool; our rule is the one
consistent with its own guidelines.

### D5 · The 44pt touch target is not the web bar
The priority table lists "Min size 44×44px" as CRITICAL, but `pro-rules.md`
opens by scoping itself to native/mobile and redirecting web to
`quick-reference.md`. The web rule there is **`web-target-size`: 24×24 CSS px
(WCAG 2.2 AA), "do not substitute native units."**

Our 32px default controls pass with margin; the 24px `xs` control sits exactly
at the bar and keeps its hit-area expansion. **No change needed** — but the
priority table alone would have caused a pointless resize of the whole system.

---

## E · Cold blue — confirmed

The skill's own SaaS palettes cluster on cold blue and corroborate the
direction:

| Source | Primary |
| --- | --- |
| Skill · "SaaS (General)" | `#2563EB` |
| Skill · "Analytics Dashboard" | `#1E40AF` |
| **Ours · `brand-600`** | **`#1d4ed8`** |

The convergence got closer, not weaker: since the admin-portal token port
`brand-600` is `#1d4ed8` and `brand-500` is `#2563eb`, which is the skill's own
"SaaS (General)" value exactly, and `brand-700` is `#1e40af`, which is its
"Analytics Dashboard" value exactly. Two independent routes to the same ramp.

Ours remains the only one with **measured** contrast — fill 6.70:1, link
8.72:1, ring 4.86:1, every step verified in-gamut by `design:contrast`, which
parses `globals.css` rather than a hand-copied table. The skill supplies flat
hex values with no ramp and no contrast proof.

Keeping our palette. The values are now the admin portal's, and the audit's
conclusion is unaffected.

---

## Found while applying the fixes — six further docs defects

Applying the 17 surfaced problems the skill could not have seen, because they
are internal consistency failures rather than UI/UX rule breaches. All are now
fixed.

| # | Defect | Why it mattered |
| --- | --- | --- |
| 1 | `tokens.md` still carried **64 lines of copyable OKLCH** for the superseded warm palette (brand hue 221) | An agent reading "the ramps" would have implemented the wrong palette and every contrast number with it. Values removed; the structural reasoning kept |
| 2 | `tokens.md`'s roles table, rationale and **contrast numbers** were all the old palette | It argued "why petrol and not blue" — for a system that was blue by then. Corrected, with the supersession stated rather than silently overwritten |
| 3 | `geometry.md` carried **12 superseded size values** (36px/40px vs the 32px/36px implemented at the time) | Same trap, one file over. Values removed; `controlSize` and hit-area mechanisms kept |
| 4 | Four files opened with "**The current state this replaces**" in present tense | Described a codebase that no longer exists; read as current. Retitled to "What this replaced (pre-rebuild, for context)" |
| 5 | `design/README.md` still said **"not yet implemented"** | Phases 1–5 shipped |
| 6 | The **bilingual data-field ternary** question was never answered | `lang === "ar" ? item.nameAr : item.nameEn` is data selection, not UI copy — but `i18n.md` did not say so, which made the census's `languageTernaries` counter meaningless. Now exempt **via a mandatory `localizedName()` helper**, which removes the syntax from feature code and restores the counter as a real gate |

Defect 6 also carried a latent bug: an inline ternary renders an **empty cell**
when a tenant leaves one language blank. The helper falls back to the other
language, so a stage always has a visible name.

Four further code defects found during the verify pass are recorded as
[D14–D17](../build/DEFECTS.md) — including one that returned **500 on every
route**.

## Suggested order of work

B1 and B3 first — the two with real user impact (mobile zoom, WCAG AA
conformance). Then B2, B4, B5, B6, B9 as one accessibility commit. B7, B8,
B10–B17 are small and can ride along with the screens they touch.

None of these require re-opening the palette, the type scale, the density, or
the toast rule.
