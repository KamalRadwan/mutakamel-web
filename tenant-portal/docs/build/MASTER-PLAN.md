# Tenant Portal — Master Plan

Written: **2026-08-30** · Owner: **Kamal Radwan** · Status: **in progress — 327 `[x]`, 385 / 393 resolved**

The single tracking document for building the tenant portal into the full
product. It covers **every page, colour, control, modal, card, view and state**
in the application.

---

## How to read and update this file

Every task is a checkbox. Mark progress by editing the box character:

```text
- [ ]  not started
- [/]  in progress
- [x]  done, gate green
- [-]  deliberately skipped (must carry a "why" on the same line)
```

A phase is **done** only when every task in it is `[x]` or `[-]` **and** the
phase gate runs green.

### The gate

From `tenant-portal/`:

```bash
pnpm verify
```

Chains `typecheck → lint → design:rtl → design:census --check → design:contrast → test → docs:check → build → knip`.
Cheap gates run first so a failure names itself. A green run proves
*type-validated, lint-validated, unit-tested*. **It does not prove the app runs
in a real authenticated session** — every phase also requires one real page
load, in both languages and both themes.

---

# Part 0 — Design System Review

The verdict, and the evidence behind every change in Phase 0.

## 0.1 Overall verdict

The design system is **structurally excellent and chromatically too
conservative for the audience it serves.**

What is genuinely good and must not be thrown away:

| Strength | Evidence |
|---|---|
| Token discipline | One 670-line source of truth, `src/app/globals.css`. No component stylesheet, no `@apply`, no element selector beyond `body`/`html[lang]` |
| Enforcement is real where it can see | 10 ESLint selectors (11 now), an RTL guard at limit 0, a 12-counter census ratchet, and a contrast script that **computes** WCAG rather than asserting it. The caveat matters: the census **does not scan `src/design-system/`**, so the ratchet is blind to its own subject — see L3 |
| The contrast script has a negative control | `ink-500` on white *must fail* 4.5:1. Very few design systems test that their test can fail |
| RTL is first-class | Direction is computed, never branched on; `translateX` gets its own mirrored keyframe; Radix `DirectionProvider` wraps the tree |
| No-flash theme and direction | A pre-hydration inline `<script>` sets `lang`, `dir` and `.dark` before React runs |
| One superfamily, two scripts | Readex Pro removes an entire class of Latin-inside-Arabic baseline bugs |
| Status semantics are honest | An unmapped enum renders neutral **with the raw wire value in monospace**, so a backend enum addition is visible instead of silently swallowed |
| The view invariants | "never fetches, never reads the dictionary, never knows which entity it renders, never owns the mutation" — held exactly in `BoardView` and `CardView` |

## 0.2 The colour problem — measured, not asserted

Every chromatic ramp is systematically **less saturated than a standard
reference palette** at the same lightness:

| Token | chroma now | Tailwind v4, same role | delta |
|---|---:|---:|---:|
| `brand-500` | 0.180 | 0.214 | **−16 %** |
| `brand-600` | 0.180 | 0.245 | **−27 %** |
| `positive-500` | 0.125 | 0.170 | **−26 %** |
| `positive-600` | 0.113 | 0.145 | **−22 %** |
| `caution-500` | 0.154 | 0.188 | **−18 %** |
| `negative-500` | 0.200 | 0.237 | **−16 %** |
| `negative-600` | 0.208 | 0.245 | **−15 %** |

Three compounding causes, in order of impact:

1. **`--primary` is `brand-600` at L = 0.520.** That renders `#1364ce`, a deep
   navy. It is the most visible colour in the product — every primary button,
   active nav marker and focus-ring anchor — and it reads dark, not bright.
2. **The `ink` neutral runs at chroma 0.028–0.030 where sRGB allows
   0.111–0.163.** It uses **17–27 %** of the colour available at that
   lightness. Every surface, border and body text sits on that ramp, so the
   whole screen reads grey rather than alive.
3. **Only four hues exist, and "a stage is never a colour"** removes colour
   from the busiest object on the busiest screen. That rule is *correct* —
   nine colourblind-safe hues do not exist — but combined with 1 and 2 the
   result is a screen with very little chroma anywhere.

**The correction.** A gamut-fitted brighter palette was generated and validated
against the repo's own contrast method:

- **All 57 steps sit inside the sRGB gamut.** (A naive "just add saturation"
  pass put 36 steps outside it — that constraint is exactly why the original
  ended up muted.)
- **All 22 contrast claims pass.** The script had 14; this adds 8 badge pairs
  (four roles × light and dark) on the most numerous coloured element in the
  product. It now **parses `globals.css`** rather than carrying a hand-copied
  table, so it can never again validate a palette the app does not ship.
- **The negative control still fails correctly**, at 4.07.

| Token | now | proposed | change |
|---|---|---|---|
| `--primary` (`brand-600`) | `#1364ce` L .520 C .180 | `#066de9` L .560 C .204 | **+14 % chroma, brighter** |
| `brand-500` (ring) | `#327feb` C .180 | `#3085fd` C .196 | +9 % |
| `positive-500` | `#31aa7d` C .125 | `#0eb380` C .143 | +14 % |
| `caution-500` | `#f29831` C .154 | `#fe980f` C .172 | +11 % |
| `negative-500` | `#e84461` C .200 | `#fc265c` C .240 | **+20 %** |
| `ink-500` | `#6c7f8c` C .030 | `#628298` C .050 | **+67 %** |

Measured contrast after the change: primary fill **4.79** (was 5.64, bar 4.5),
body text 15.37, muted 6.31, focus ring 3.40 (bar 3.0). Headroom narrows where
the fill got brighter. That is the trade, and it stays above the bar.

> The ceiling is physics, not taste. At `brand-600`'s lightness sRGB caps
> chroma at 0.193; the proposal reaches 0.204 by *also* raising lightness to
> 0.560. Pushing the primary fill past L ≈ 0.57 drops white-label contrast
> below 4.5 and is simply not available in sRGB.

**Every step in the table above also moves lightness, not only chroma** — the
percentages are chroma deltas and would read as pure-saturation changes
otherwise. Six of six move L; `ink-500` also settles a hair off its stated hue.
Stated plainly so the framing cannot mislead.

**And these are the light-mode values.** `.dark` binds `--primary` and `--ring`
to `brand-400` (L .716), not `brand-600`. The dark pairs are measured
separately by `contrast.mjs` — primary fill 7.47, body text 18.31 — and pass.
Verified live in the running app: light `--primary` resolves to
`oklch(0.56 0.204 258)`, dark to `oklch(0.716 0.147 258)`.

## 0.3 The 90 % scale

Confirmed preference: the app should render at **90 % of its current metrics**.

**Implemented, and not the way this section first proposed.** The obvious
approach — scale the root font-size — was tried and abandoned for two
independent reasons, both found by verification rather than reasoning:

1. **`html { font-size }` is a banned selector in that file.**
   `DESIGN-SYSTEM.md#banned-in-that-file`: *"Element selectors beyond `body`
   and `html[lang]`"*. The rule is printed at the top of `globals.css` itself.
2. **Tailwind v4 strips it.** The rule was written, compiled, and did not
   appear in any stylesheet — confirmed by walking `document.styleSheets` in
   the running app. It failed silently, and because the type tokens had been
   rebased by `1/0.9` to compensate, the net effect was the interface rendering
   **11 % larger** — the exact opposite of the goal, with every gate green.

What shipped instead scales the geometry tokens directly:

```css
:root {
  --ui-scale: 0.9;
  --size-control-md: calc(2rem   * var(--ui-scale));
  --size-row:        calc(2.25rem * var(--ui-scale));
  --size-topbar:     calc(2.75rem * var(--ui-scale));
  /* …and the rest of the size tokens */
}
```

No element selector, no root font-size, and **the type floor is untouched by
construction** rather than by a compensating division. Radius stays fixed at
2/4/6/8 for the same reason: it is a shape constant, not a density one.

| Token | now | at 0.9 |
|---|---:|---:|
| `--size-control-md` (default) | 32 px | **28.8 px** |
| `--size-control-lg` (primary) | 36 px | 32.4 px |
| `--size-row` | 36 px | **32.4 px** |
| `--size-topbar` | 44 px | 39.6 px |
| `--size-sidebar` | 232 px | 208.8 px |
| `--size-rail` | 48 px | 43.2 px |

**Payoff, measured in the running app on 2026-08-30** — not asserted. Driving
`--ui-scale` live at 1366×768 with this app's real chrome (topbar + page gutter
+ `PageHeader` + `FilterBar` + table header + pager):

| scale | row | topbar | control | rows visible |
|---|---:|---:|---:|---:|
| 1.00 | 36 px | 44 px | 32 px | **14** |
| 0.95 | 34.2 | 41.8 | 30.4 | 14 |
| **0.90** | **32.4** | **39.6** | **28.8** | **15** |
| 0.85 | 30.6 | 37.4 | 27.2 | 17 |

One row, not two. `geometry.md` separately claims 16 rows at the current
density; it counts a barer screen with no filter bar and no pager. Both numbers
are now stated with their chrome budget so they stop contradicting each other.

**The one real conflict.** A naive 0.9 pushes `text-xs` from 13 px to 11.7 px,
and Arabic `text-xs` from 14 px to **12.6 px — below the 13 px floor**
`typography.md` calls non-negotiable, because Naskh dots and diacritics need
the room.

Resolution: **scale the geometry, hold the type floor.** `--ui-scale` drives
spacing, control heights, row height and chrome; the type tokens are rebased by
`1/0.9` so their *effective* rendered size stays where it is today. The result
is exactly the density a 90 % browser zoom produces, without illegible Arabic.
The scale ships as a three-step user preference — Compact 0.9 / Default 1.0 /
Comfortable 1.1 — defaulting to **Compact**, so it is reversible per user and
is one token to retune.

## 0.4 What is missing — the honest gap list

### Broken or absent, though documented as present

| # | Gap | Evidence |
|---|---|---|
| G1 | **The z-index scale does not exist.** `DESIGN-SYSTEM.md#stacking-order` defines six tokens `--z-sticky-cell … --z-toast` and says "never write a bare `z-50`". **No `--z-*` token is in `globals.css`.** Every overlay primitive writes literal `z-50`; DataTable writes `z-10`/`z-20`. The documented invariant that a toast must clear a modal is unenforced — sonner's own stacking is what happens to save it | `src/app/globals.css` vs `primitives/` |
| G2 | **Tenant branding is not wired at all.** The public payload carries `primaryColor`, `secondaryColor`, `fontFamily`, `appName`, `tabTitle`, `loginHtml` — **no storage keys**; the logo and icon are separate binary routes (`/branding/public/logo`, `/branding/public/icon`). Zero frontend files read any of it; the login page hardcodes `bg-brand-600` for the tenant mark. *(An earlier draft of this row invented `logoStorageKey`/`iconStorageKey` — exactly the "never invent a DTO field" rule this document exists to enforce. Corrected against `swagger.examples.ts` and `update-branding.dto.ts`.)* | `GET /api/tenant/core/v1/branding/public` |
| G3 | **`PermissionGate` has zero consumers**, though `AGENTS.md` mandates "403 is not an empty state — render `PermissionGate`" | barrel-only references |
| G4 | **`StatCard` has zero consumers**; `surface` and `hitArea` variants are exported and never used | knip cannot see them — the barrel is an entry point |
| G5 | **`FilterBar` is half-built.** Every production call site passes `filters={[]}`. Only search is live. No date filter, no multi-select, no numeric range | all list pages |
| G6 | **17 audited accessibility gaps are specified and none are coded** | `docs/design/SKILL-AUDIT.md` |
| G7 | **The census baseline banks its own violations** — `colorUtilityTotal: 19`, `roundedXlOrAbove: 4`, `languageTernaries: 19`, `handRolledButtons: 5`, against documented targets of 0 | `census.baseline.json`, defect D17 |
| G8 | **`localizedName()` is mandated by `i18n.md` and does not exist**; 16 raw `lang === "ar" ? nameAr : nameEn` ternaries remain inline | `docs/design/i18n.md` |
| G9 | **20 of the 23 primitives omit `"use client"`.** Not currently breaking, but the barrel is imported by the root layout — this is the exact shape of defect D14, which returned 500 on every route | `src/design-system/primitives/` |
| G10 | **`pnpm dev` cannot start** — Next 16 defaults to Turbopack, `next.config.ts` carries a `webpack()` block, the `dev` script has no `--webpack` | defect D15 |
| G11 | **Two auth screens were never converted** — `TenantAuthGuard` and `TenantHostStateBoundary` still carry raw palette classes, `rounded-2xl`, a hand-rolled `<button>` and hardcoded Arabic with no English path. They render on every session flicker and every degraded state | defect D16 |
| G12 | **`docs:verify-called-routes` is not in the `verify` chain** — the gate written specifically to catch fabricated endpoints does not run | `package.json` |
| G13 | **`sortDir` contract mismatch.** The shared `PaginationQueryDto` documents `sortDir` as `ASC`/`DESC`, but Template Platform uses lowercase `sortDirection` and a combined `sort` token. Every paginated call must be checked against its own controller, not the shared DTO | backend `PaginationQueryDto` vs template-platform |

### Components a product this size needs and does not have

| # | Missing | Why it is needed here |
|---|---|---|
| G14 | **Date / date-range picker** | No dependency at all. A CRM without a date filter is a hole; Trade needs delivery, validity, period and effective-date pickers everywhere |
| G15 | **Combobox / autocomplete / multi-select** | `Select` is single-value only. Assigning an owner, picking a customer from thousands of parties, or multi-select filtering is impossible today |
| G16 | **File upload** | The backend exposes branding logo/icon, party images, CRM attachments, Trade imports and template assets. Nothing can upload |
| G17 | **Charts** | 29 CRM dashboard routes + 20 Trade dashboard routes + 22 widget routes have no rendering capability |
| G18 | **Stepper / wizard** | Lead conversion is specified as a three-step flow; Trade quotation → order → invoice needs one |
| G19 | **Table virtualization, column resize, column reorder** | `DataTable` is bespoke with none of these. `SKILL-AUDIT` already claims "board columns virtualize above 50 cards" — they do not |
| G20 | **Rich text editor** | The backend `loginHtml` field and email templates have no editor |
| G21 | **Command palette** | The only global shortcut is Ctrl/Cmd+B |
| G22 | **Progress, Accordion, Collapsible, ToggleGroup, Slider, HoverCard, ContextMenu** | Standard Radix set, none installed |
| G23 | **Form library** | Every form is hand-rolled `useState` + `JSON.stringify` dirty-check. zod is present but used only for API contracts |
| G24 | **`EmptyState title=""` fallbacks** in `CardView` and `BoardView` render a blank heading | `CardView.tsx`, `BoardView.tsx` |

## 0.5 The three views — Board · Card · Table

The naming decision is settled: **the board is called "board"**, in code and in
copy. "Kanban" must not appear in any user-facing string.

| | Board | Card | Table |
|---|---|---|---|
| Files | `views/board/` — 4 files, 254 lines | `views/card/CardView.tsx` — 80 | `views/table/TableView.tsx` — **9** |
| What it is | Grouped columns + drag-and-drop | Responsive grid, no grouping | A 7-line pass-through to `DataTable` |
| Pagination | none | **none** | yes |
| Sorting | n/a | **none** | yes |
| Selection | none | **none** | yes |
| Virtualization | **none** | **none** | **none** |
| Empty / error | own copy, `title=""` fallback | own copy, `title=""` fallback | owned by `DataTable` |
| Scroll restore | no | no | no |

**The five real defects:**

- **V1 — the "contract" is a convention, not a type.** The three views share no
  base interface: `cardsByColumn` / `items` / `rows`, `itemKey` / `itemKey` /
  `rowKey`, `onCardClick` / `onItemClick` / `onRowClick`. Every workspace wires
  three different prop sets by hand and nothing stops them drifting.
- **V2 — switching view silently drops capability.** Table has pagination,
  sorting and selection; board and card have none. A user on page 4 of a table
  who switches to card view loses both their place and their page.
- **V3 — the board has no single-pointer alternative.** Drag is the only mouse
  path to move a card. Keyboard works via the dnd sensor; touch and
  reduced-dexterity users have nothing. This is the WCAG AA failure logged as
  B3 and the highest-severity item in the audit.
- **V4 — no virtualization anywhere.** A pipeline with 400 open opportunities
  renders 400 DOM cards.
- **V5 — `BoardCard` has no `role="button"`** while `CardView`'s wrapper does,
  and a small drag fires `onClick`. Click and drag are not disambiguated.

Phase 2 fixes this with one generic `WorkspaceViewProps<T>` contract that all
three implement, owning pagination, sorting, selection and scroll restoration
once.

**Resolved 2026-08-31.** V1, V2, V3 and V5 are closed; V4 is closed on the two
surfaces that carry no drag. The table above is the state *before* Phase 2 —
`docs/design/views.md#the-shared-contract` describes what shipped. What is
still open: the card view's sort control exists but no data hook accepts a
sort parameter (2.4), and board-column windowing waits on D9's `react-window`
decision and a real browser drag (2.8).

## 0.6 Scope — what "the whole application" means

| App | Gateway routes | Portal calls today | Coverage |
|---|---:|---:|---:|
| Core | 195 | 12 | 6 % |
| CRM | 143 | 17 | 12 % |
| Trade | 231 | 0 | **0 %** |
| **Total** | **569** | **29** | **5 %** |

> Portal-call counts are `pnpm docs:verify-called-routes`' own figure — **29
> distinct paths** — not a hand grep. Regenerated 2026-08-30 against backend
> `989ee35f6578+dirty`. Core dropped
> from 199 to 195 — four **webphone** routes (`users/:id/webphone`,
> `users/me/webphone`, and the two call-log routes) are no longer exposed to
> the tenant master. The backend tree is dirty, so re-run `pnpm docs:routes`
> before trusting these counts for planning.

Sixteen route files exist: **12 real screens**, 2 pure redirects (`/core`, `/crm`) and 2 boundaries (`/trade`, `/unavailable`). This plan builds the rest.

### Already built — do not rebuild (L1-1)

Recorded explicitly so "already done" is never mistaken for "forgotten".

| Route | State | What the plan still owes it |
|---|---|---|
| `/login` | live | D1 forgot-password bug (4.3), B9 autofill (3.5) |
| `/` workspace home | live | KPI row once dashboards exist (9.3) |
| `/core/authentication` | live, tested | — |
| `/crm/leads` | live, 3 views | detail (8.1), conversion (8.2), edit (8.3), capabilities (8.5) |
| `/crm/customer-profiles` | partial | action cluster (8.7–8.9) |
| `/crm/customer-profiles/[id]` | read-only | actions, custom-fields rail |
| `/crm/opportunities` | live, 3 views | detail (8.10), create/edit (8.11), transfer (8.12) |
| `/crm/lead-stages` | live | edit + set-default (8.17) |
| `/crm/acquisition-sources` | live | icon upload, reorder (8.18) |
| `/crm/custom-fields` | live | requirements + values (8.19) |
| `/crm/settings` | live | — |
| `/crm/static-data-catalogue` | live, read-only | — |
| `/trade` · `/unavailable` | boundaries | `/trade` unsealed in 10.3 |

### Never build a UI for these (L1-2)

Two routes are marked non-feature by the Gateway contract. The buildable
surface is **567**, not 569.

| Route | Marking | Why |
|---|---|---|
| `GET /public/fqdn-validation/:token` | `PLATFORM_VALIDATION_DO_NOT_CALL_AS_FEATURE_API` | Platform domain-validation probe |
| `POST /public/payments/webhook` | `EXTERNAL_CALLBACK_DO_NOT_CALL` | Paymob server callback, HMAC-authenticated |

---

# Part 1 — The Plan

14 phases. Ordered by dependency: nothing in phase N+1 may start with phase N's
gate red.

| Phase | Title | Tasks | Resolved |
|---|---|---:|---:|
| 0 | Design system correction | 34 | 31 |
| 1 | Design system completion | 50 | 50 |
| 2 | The three views, properly | 18 | 17 |
| 3 | Accessibility, cross-cutting mechanisms | 40 | 40 |
| 4 | Core · identity and organization | 34 | 34 |
| 5 | Core · settings and catalogues | 19 | 19 |
| 6 | Core · billing, subscription, branding | 21 | 21 |
| 7 | Core · directory, templates, audit, activities | 23 | 23 |
| 8 | CRM · completion | 27 | 27 |
| 9 | CRM · dashboards and widgets | 15 | 15 |
| 10 | Trade · foundation | 21 | 21 |
| 11 | Trade · commercial documents | 22 | 22 |
| 12 | Trade · advanced and analytics | 28 | 28 |
| 13 | Hardening and release | 27 | 23 |
| 14 | Absorbing the CRM audit | 14 | 14 |
| | **Total** | **393** | **385** |

---

## Standing requirements for every feature task (phases 4–12)

These apply to **every** screen built from Phase 4 onward. They are stated once
here rather than repeated 200 times, and each has a task in Phase 3 that builds
the mechanism.

| # | Rule | Why it bites |
|---|---|---|
| S1 | **Core wraps responses in `data`; CRM does not.** Never unwrap a CRM response through the Core helper | 199 Core screens and 143 CRM screens, one shared transport. The easiest way to break every new screen (L4-1) |
| S2 | **Every CRM list requires `branchId`** — it is not optional, and a missing one is a 422 | 34 routes are `BRANCH_REQUIRED`, 43 more are `OPTIONAL_COMPANY_BRANCH` (L4-3) |
| S3 | **Every response passes a runtime validator** before reaching the UI | `AGENTS.md`; a type is a guess until checked |
| S4 | **Never invent** a DTO field, enum value, permission string, route or error code | `AGENTS.md`; backend uses `forbidNonWhitelisted`, so an invented key is a 400 |
| S5 | **Never `Number()` a decimal string.** Money and quantity render through `Money` | Silent precision loss on financial data |
| S6 | **Route admission from `/auth/me`; action admission from `capabilities`** | Permission strings do not account for branch and owner scope (defect D11) |
| S7 | **403 renders `PermissionGate`, never an empty state** | `AGENTS.md`; an empty list says "no data", a 403 says "not yours" |
| S8 | **Every mutating call carries an idempotency key**; 61 routes additionally require a fingerprint. Handle replay (`Idempotency-Replayed: true`) and body-mismatch 422 | 355 of 569 routes mutate (L4-4) |
| S9 | **429 and `RATE_LIMIT_UNAVAILABLE` are real outcomes.** The Gateway fails closed when Redis is down — that is not a bypass | Unplanned entirely (L4-2) |
| S10 | **Both dictionaries, both themes, both directions** — not a follow-up pass | `AGENTS.md` |
| S11 | **Preserve exactly**: decimal strings, UUIDs, cursors, ETags, idempotency keys | `AGENTS.md` |
| S12 | **Canonical Gateway paths only**, and `fetch` in exactly one file | `AGENTS.md` |

---

## Phase 0 — Design system correction

**30 / 34 done, 1 partial, 3 open.** Fixes the user-facing complaints and the broken foundations
everything else stands on. Nothing else starts until this gate is green.

### Unblock the environment

- [x] **0.1** Fix `pnpm dev` (G10, D15) — add `--webpack` to the `dev` script, or migrate `watchOptions` to a `turbopack` config and drop the webpack block. Second is the better end state; first unblocks today
- [x] **0.2** Add `"use client"` to the 20 primitives that lack it (G9) — only `Field`, `Sheet` and `Skeleton` have it today, so the rule is "all of them" rather than "the ones that happen to break"
- [x] **0.3** Add `docs:verify-called-routes` to the `verify` chain (G12), positioned after `docs:check`

### Colour — the vivid palette

- [x] **0.4** Replace all five ramps in `globals.css` with the gamut-fitted values from §0.2. 57 steps: ink 13, brand 11, positive 11, caution 11, negative 11
- [x] **0.5** Update `scripts/design/contrast.mjs` — its palette is hardcoded and will otherwise validate the old values. Mirror the new tokens exactly
- [x] **0.6** Extend `contrast.mjs` with the four badge pairs it does not currently check (brand / positive / caution / negative `800` on `100`, light and dark)
- [x] **0.7** Add a gamut assertion to `contrast.mjs` that **fails the build** on any out-of-gamut step, rather than only reporting it
- [x] **0.8** Update `docs/design/tokens.md` and `DESIGN-SYSTEM.md#1--color` with the new values and the newly measured ratios, in the same commit
- [x] **0.9** Verify the theme flip still maps correctly — all 22 Tailwind families remapped onto the new ramps. **Verified in the running app** by reading every root token on a fresh load in each theme (live mutation is not observable in this harness — see D3). All 23 semantic tokens flip onto the new ramps: `--primary` is exactly D1's pair (`oklch(0.560 0.204 258)` → `oklch(0.716 0.147 258)`), and `--card`'s literal `white` correctly becomes `ink-950`. **But the task's premise was wrong: there are 6 families in the compiled CSS, not 22** — Tailwind v4 tree-shakes the unused ones. The six that exist (blue, amber, emerald, slate, gray, rose) are all remapped onto our ramps. The consequence, which "22 families" hid: **the remap only protects families already in use.** A newly written `text-purple-500` would emit stock Tailwind purple and bypass the ramp entirely; only the census gate stands between that and production
- [ ] **0.10** Look at every existing screen in light and dark, Arabic and English. The primary button, the focus ring, every badge tone, the sidebar active marker, the zebra row

### Scale — 90 %

- [x] **0.11** Add `--ui-scale` to `:root`, default `0.9`, and `html { font-size: calc(100% * var(--ui-scale)) }`
- [x] **0.12** Rebase the seven type tokens by `1/0.9` so effective rendered size is unchanged, and rebase the Arabic lift in `html[lang="ar"]` in lockstep
- [x] **0.13** Verify every geometry token lands where §0.3 predicts, and that the 13 px Latin / 14 px Arabic floors still hold at the rendered size
- [x] **0.14** Add the density preference — Compact 0.9 / Default 1.0 / Comfortable 1.1 — persisted like the theme, applied in the same pre-hydration bootstrap script so there is no flash. **Shipped as `DensityProvider`**, beside `ThemeProvider` and reading its own key through the same `useSyncExternalStore` shape, with the write duplicated into the bootstrap and a test that pins the two against each other by reading `layout.tsx` itself. **Two deviations, both recorded in D3:** the middle option is labelled **Standard**, not "Default", because 1.0 is not the default and a menu must not misdescribe the setting in force; and **compact writes nothing** — it removes the stored key and the inline property, leaving `globals.css` the only place 0.9 exists, because D2's parent failure was a `--ui-scale` change that shipped inverted with every gate green
- [x] **0.15** Add the density control to the user menu, with both dictionary keys — a `DropdownMenuRadioGroup` under its own label, so the current density is visible rather than inferred. Labels resolve through a `Record<Density, string>` lookup, not a ternary chain: the language gate only recently began catching **nested** ternaries, and this is exactly the shape that slipped past it once
- [x] **0.16** Re-measure rows-visible at 1366×768 and record the real number in `geometry.md`

### The missing z-index scale

**This is [SKILL-AUDIT.md](../design/SKILL-AUDIT.md) gap B7** — `z-index-management`, "define a layered z-index scale". Tasks 0.17–0.20 are its whole implementation; 3.35 exists because the section named the gap as G1 and never as B7, which left 13.19's "all 17 B-items implemented" with nothing to point at.

- [x] **0.17** Add the six `--z-*` tokens to `globals.css` (G1): `sticky-cell 10 · sticky-header 20 · topbar 30 · dropdown 40 · overlay 100 · toast 1000`
- [x] **0.18** Replace every literal `z-50` / `z-10` / `z-20` in the primitives and `DataTable` with the token
- [x] **0.19** Add an ESLint `no-restricted-syntax` selector banning bare `z-<number>` outside `src/design-system/`, and a census counter for it. **The selector was dead on arrival** — its pattern was written `"…/\bz-…/"` in a JS string, where `\b` is the backspace character rather than a regex word boundary, so it matched nothing. Corrected in 3.35
- [ ] **0.20** Prove the ladder: open a dropdown inside a dialog, trigger a toast from it, horizontally scroll a table with a sticky first column and a sticky header. Screenshot each
### Added by L3

- [x] **0.21** ★ Re-derive `--elevation-pop` and `--elevation-overlay` from the `ink-950` **token**, not a hand-copied value. Four literals duplicated the old triple and did not follow the ramp change — now `color-mix(in oklab, var(--color-ink-950) N%, transparent)`
- [x] **0.22** Extend 0.2 past the primitives: `StatusBadge` (which calls `useI18n()` with no directive — the one genuine unguarded client dependency), `DegradedBanner`, `StatCard`, `DataTableSkeleton`, `TableView`
- [x] **0.23** Correct 0.6 — the dark badge pair is `{role}-300` on `{role}-950`, **not** `800` on `100`. As written it checked the light pair twice and never checked the dark badge
- [x] **0.24** Add contrast claims for the four `AppToast` tone colours on `--popover`, light and dark
- [x] **0.25** Add 3:1 claims for every meaning-carrying **non-text** ramp use: `BoardColumn` role top-borders and count dot, `SubNav` active underline, `Badge` `200` borders, `NotificationsDropdown` dots, `StatusBadge` pending dot
- [x] **0.26** Extend the 0.8 doc sweep to `tokens.md#contrast-resolution` — five measured numbers there all move
- [x] **0.27** Reconcile `tokens.md#elevation-and-control-tokens`: it still declares the superseded 28/32/36/40/44 px control scale and a warm-hue shadow. Not colour, so 0.8 misses it
- [ ] **0.28** ★ Replace 0.10's five-item eyeball list with the full L3 consumer table — `secondary`/`outline`/`ghost`/`destructive`/`link` hovers, the modal scrim, the toast tones, the board column borders, the SubNav underline
- [x] **0.29** Record what `--ui-scale` does to `--radius-*` — **nothing**. The reworked scale multiplies only the size tokens, so radius stays 2/4/6/8 and the px-based elevation offsets stay fixed. Verified live. (The earlier root-font-size approach *would* have shrunk radius to 1.8/3.6/5.4/7.2 px silently; that is one more reason it was wrong.)
- [x] **0.30** Before 0.18: `DataTable`'s sticky z-indices are **inverted** against the documented ladder — `z-10` header, `z-20` cells. Swap them, do not transcribe the bug
### Added by L5

- [x] **0.31** ★ **Blocking prerequisite of the scale change (Q4).** Open a populated table in **Arabic** and look at `text-xs` in a 32.4 px row. This is the repo's own named "last unverified visual assumption", it was never checked at 36 px, and 0.11 shrinks the row. **Resolved: it fits** — 24.4px available ink, 15px for ordinary Arabic, 22.98px for a fully-vocalised worst case (1.42px headroom). Zain not needed. See OPEN-QUESTIONS.md#q4
- [x] **0.32** Widen `hitArea` from 6 px to 8 px — at 0.9 the default control is 28.8 px and 6 px reached only 40.8 px, under the 44 px floor the helper exists to clear
- [/] **0.33** Record the `--ui-scale` breakpoint consequence: content shrinks, `sm:`/`md:` reflow points do not move, so every responsive boundary now fires at a different content density. Check the shell and one dense table at each breakpoint. **Recorded** in [geometry.md](../design/geometry.md#density-does-not-move-the-breakpoints) with the real numbers — and the task understated it: since 0.14 made density a *preference*, each boundary now fires at **three** densities, not one. The sidebar swings 46.4 px across them, ≈9 % of the content column at `md`, invisible to every `md:` rule. **The eyes-on pass at each breakpoint is not done** — it needs an authenticated session, blocked on P4
- [x] **0.34** Record Q11's reversal in `DECISIONS.md` — the shell tokens 44/232/48 were settled by human decision on 2026-08-28 and this phase changes all three

**Gate:** `pnpm verify` green · one real page load in ar/en × light/dark ·
`contrast.mjs` reports all claims passing and zero out-of-gamut steps.

---

## Phase 1 — Design system completion

**50 / 50 done.** Builds the components the rest of the plan depends on. Every
one is generic, prop-driven, bilingual and themed — no entity knowledge.

### Dependencies

- [x] **1.1** Add `react-day-picker` + `date-fns` (G14), `cmdk` (G21), `recharts` (G17), `@radix-ui/react-accordion`, `-collapsible`, `-toggle-group`, `-progress`, `-hover-card`, `-context-menu` (G22), `@tanstack/react-virtual` (G19). **All installed.** `react-window` is deliberately NOT installed — D9 assigns it to the board only, 2.8 is the task that earns it, and an unused dependency fails `knip`
  - **1.50 — the shared lockfile.** `tenant-portal` has **no lockfile of its own**: `../pnpm-lock.yaml` and `../pnpm-workspace.yaml` are shared with `admin-portal` and `partner-portal`. This install added 3 direct packages and touched **261 lockfile lines**, so both siblings' next `pnpm install` resolves against it. No shared version moved and neither sibling depends on the three new packages — but the lockfile diff belongs in this change's review, not a later one
- [x] **1.2** Decide and record: `react-hook-form` + `zodResolver` for forms (G23), or keep hand-rolled. If adopted, `FormDrawer` becomes its host

### Primitives

- [x] **1.3** `DatePicker` — single date, locale-aware via `Intl`, Arabic uses `ar-EG-u-nu-latn` (Western digits), RTL-mirrored, keyboard-navigable
- [x] **1.4** `DateRangePicker` — from/to with presets (today, last 7/30/90 days, this month, this quarter)
- [x] **1.5** `Combobox` — single-select with type-ahead over a large remote list, debounced, with loading and empty states
- [x] **1.6** `MultiSelect` — chips inside the trigger, overflow collapses to "+N", clear-all
- [x] **1.7** `FileUpload` — drag-and-drop plus click, MIME allowlist, size cap, **no progress bar** (1.45 / D14), preview for images. Backend caps: branding 2 MB, party image 2 MB, template asset 5 MiB, CRM attachment 26 MiB
- [x] **1.8** `Stepper` — horizontal, numbered, with per-step valid/invalid/current state and RTL ordering
- [x] **1.9** `Progress` — determinate and indeterminate, with `role="progressbar"` and full ARIA values
- [x] **1.10** `Accordion` and `Collapsible`
- [x] **1.11** `ToggleGroup` — and refactor `ViewSwitcher` onto it, since it currently hand-rolls a segmented control on `RadioGroup`
- [x] **1.12** `HoverCard` and `ContextMenu`
- [x] **1.13** `Textarea` gains the `size` variant it is missing, matching `Input` and `SelectTrigger`
- [x] **1.14** `CopyButton` — for the UUIDs, correlation IDs and cursors this product shows constantly. With `aria-live` confirmation
- [x] **1.15** `Money` — renders a decimal **string** with `Intl.NumberFormat`, `tabular-nums`, never `Number()`. This is a correctness primitive, not a style one
- [x] **1.16** `DateTime` — same discipline for timestamps, explicit locale, `<time dateTime>`

### Patterns

- [x] **1.17** `FilterBar` gains real filter types (G5): select, multi-select, date range, numeric range, boolean. Every value leaf is a **string**, so the URL round-trip is lossless and a decimal bound is never `Number()`d. Chips overflow behind a **button** opening a popover of still-removable chips (audit B12); the "past two rows" wording is now a count, with the reason recorded in `patterns.md`
- [x] **1.18** `DetailHeader` — title, subtitle, status badge, back link, action cluster. **Composes `PageHeader`** rather than reimplementing it, which is what settles 1.43. Every detail screen in phases 4–12 uses it
- [x] **1.19** `DetailSection` — a labelled field group for read-mostly detail bodies. A `<dl>`, not a table; a missing value keeps its label
- [x] **1.20** `Timeline` — for audit history, stage history, delivery attempts, approval ladders. Never sorts; `tone` is an outcome, never a type (1.44)
- [x] **1.21** `AttachmentList` — list, upload, download, delete; built on `FileUpload`. Delete reports intent and stops — the caller owns the confirmation, because only it knows whether the record has blockers
- [x] **1.22** `CommandPalette` — Ctrl/Cmd+K, navigates the permission-filtered nav tree (G21). Generic and dictionary-free; `NavCommandPalette` in the shell feeds it `useNavTree()`. The shortcut listens on `event.code`, not `event.key`, which is what makes it work on an Arabic layout. Styling per 1.40 / D15
- [x] **1.23** `Chart` wrappers — line, bar, area, donut, sparkline (G17). Superseded in substance by **1.38**, which is the rule that shipped: no invented categorical palette, and no "categorical sequence" at all
- [x] **1.24** Every new primitive and pattern gets: both dictionary keys, a `.test.tsx`, an entry in `docs/design/primitives.md` or `patterns.md`, and an export from the barrel. 13 new dictionary sections, in exact sync — `ar.ts` is the type source, so a key in one file and not the other is a typecheck failure rather than a runtime blank
### State components — added by L2 (build before any screen consumes them)

- [x] **1.25** ★ `ConflictDialog` — the 409/412/428 resolution surface: what you changed, what they changed, reload-and-reapply / overwrite / cancel. Blocking for 5.9, 5.17, 7.13, 7.22 and every editable resource
- [x] **1.26** ★ `AmbiguousOutcomePanel` — persistent, in-body, carrying the operation, the idempotency key and a retry-exact affordance. Mandated by `patterns.md`; **seven hooks already detect the condition and have nowhere to render it**
- [x] **1.27** `NotFoundState` — a deleted record reached from a stale link, with a back-to-list action and **no retry button**
- [x] **1.28** `OfflineBanner` + `useConnectivity()` — subscribes to the `tenant-realtime:*` events `TenantRealtimeProvider` already dispatches to **zero listeners**. Mounted in `AppShell`. Three states, not one: `offline` / `draining` / `stopped`, with `stopped` terminal and the only one that gets an action. `resync-required` is exposed as a **counter** a screen refetches on, not a banner that would flicker on every reconnect
- [x] **1.29** ★ `useAccessMode()` + `ReadOnlyGate` — one source of truth for FULL / READ_ONLY / DUNNING / BLOCKED that suppresses every mutating affordance. Consumed by every screen in phases 4–12
- [x] **1.30** `BulkActionBar` + `BulkConfirmDialog` + `BulkResultPanel` (partial success: "38 of 50 succeeded, here are the 12"). Without these, 2.1's selection and 2.5's checkboxes are dead code
- [x] **1.31** `ReasonDialog` — promote `TerminalMoveDialog` to a pattern. Consumed by 10.18, 11.5, 11.10, 11.11, 11.14 and the ~30 governance-ladder actions
- [x] **1.32** `AsyncJobState` — queued / running / succeeded / failed / artifact-expired, with polling. Consumed by 7.17, 11.7, 11.12, 11.15
- [x] **1.33** `useUnsavedChangesGuard()` — page-level route guard; `FormDrawer` guards drawer close only
- [x] **1.34** Extend `StatusKind` in `tone-map.ts` with `TenantStatus`, `UserStatus`, `SubscriptionStatus` and `AccessMode`, sourced from the backend enums, never guessed
- [x] **1.35** `EditDrawer` — every `FormDrawer` in the app today is **create-only**; ~20 edit drawers in phases 4–12 need one shape. Composes `FormDrawer`; adds load / load-failure / deleted-record / revert, and does not fire the dirty guard on a record that never loaded
- [x] **1.36** `DeletionBlockerDialog` — `ConfirmActionModal` has no slot for a list of blocking children. Required by 4.10. No confirm button and no "delete anyway": the backend already refused, and an action guaranteed to fail is worse than none
- [x] **1.37** `AtomicReplacementConfirm` — a pre-write diff for the full-replacement PUTs in 4.15 and 4.21, the most destructive writes in Core. Removals gated on an acknowledgement that resets per attempt; the diff matches on **id**, never label

### Added by L3

- [x] **1.38** ★ **Rewrite 1.23.** It contradicts `tokens.md`, which forbids inventing a categorical chart palette. Correct rule: status breakdowns use the four roles; qualitative breakdowns use **top-N + Other on a single-hue `brand-200…brand-800` ramp**; `caution` and `negative` are never adjacent fills; recharts mount animation disabled
- [x] **1.39** Apply the FilterBar overflow rule to `MultiSelect` — the `+N` collapse is a **button** opening a popover of removable chips, never a static count. **Already correct when checked**, and covered by three assertions in `MultiSelect.test.tsx`; no code change was needed
- [x] **1.40** Decide and record how `react-day-picker` is styled without importing its stylesheet, and how `cmdk`'s `[cmdk-*]` attribute selectors coexist with the no-component-stylesheet rule → **DECISIONS D15**. Neither gets a stylesheet; the one `cmdk` part with no `className` prop is reached by a Tailwind arbitrary variant on its parent, which is a utility in the component rather than a rule in `globals.css`
- [x] **1.41** ★ An **icon system**: a size scale tied to `controlSize`; one RTL mirror mechanism (`rtl:-scale-x-100`) with a lint selector and a census counter; and a canonical icon-per-concept map. Fix the `rtl:rotate-180` outlier
- [x] **1.42** ★ A **motion budget extension** covering `Accordion`/`Collapsible` (and the height-transition ban), `Progress` indeterminate plus its reduced-motion carve-out, the new overlays' 120/90 ms pair, and chart mount. The height ban is **narrowed, not dropped**: a keyframe over a library-measured height, on a disclosure panel, and nowhere else. No CSS added to `globals.css` — `tw-animate-css` already ships the Radix-driven keyframes
- [x] **1.43** Reconcile `DetailHeader` (1.18) with `PageHeader` on the one-filled-primary rule — state which owns the primary action. **`PageHeader` owns it, in both shapes**, because `DetailHeader` composes it. A detail screen renders one or the other, never both, so the ceiling holds structurally rather than by review
- [x] **1.44** State on `Stepper` and `Timeline` that step and event **type never takes a hue** — stated in both components and in `patterns.md`, and asserted in `Timeline.test.tsx`
### Added by L5

- [x] **1.45** ★ Resolve `FileUpload` progress before building it: `fetch` cannot report upload progress, only `XHR` can — and the rule is "`fetch` in exactly one file". Either amend the rule for the upload path, or ship no progress bar. **A fake progress bar violates two rules at once**
- [x] **1.46** ★ De-risk 2.8 **before** the dependency choice is locked: prove `@hello-pangea/dnd` + `@tanstack/react-virtual` in a throwaway branch, or switch to `react-window`, which is what the dnd library's virtual mode is actually exercised against. Name the fallback
- [x] **1.47** `Slider` (G22) — listed as missing and then scheduled nowhere
- [x] **1.48** Rich-text editor (G20) for `loginHtml` and email templates — identified as missing and scheduled nowhere. 6.15 omits `loginHtml` entirely. `contenteditable` + `execCommand`, with an **allowlist sanitizer** on every change and every paste — `loginHtml` renders on the login page before a session exists, so its output is treated as hostile by construction
- [x] **1.49** `DataTable` column resize and reorder (G19) — only the virtualization third of that gap was scheduled. Reorder is a menu and resize is a focusable ARIA splitter: **drag is never the only path**, the same rule 2.7 exists for. `DataTableHeader.tsx` was split out to keep `DataTable` under the line limit
- [x] **1.50** Note in 1.1 that `tenant-portal` has **no lockfile of its own** — `../pnpm-lock.yaml` and `../pnpm-workspace.yaml` are shared with `admin-portal` and `partner-portal`. Adding ~10 packages affects two other products. **Recorded on 1.1 above**, with the measured lockfile delta

**Gate:** `pnpm verify` green · every new component rendered in ar/en × light/dark · zero new census regressions. **`knip` is not a meaningful gate for this phase** — `src/design-system/index.ts` is a knip entry point, so every new barrel export is invisible to it by construction.

---

## Phase 2 — The three views, properly

**16 / 18 done.** Fixes V1, V2, V3 and V5 in full, and V4 on the two surfaces that carry no drag. Both remaining halves are `[/]`, built but unproven rather than unstarted: 2.4 cannot be enabled by any screen yet, and 2.8 is shipped on `react-window@1.8.11` with only D9's real 200-card browser drag outstanding — which needs an authenticated session (P4).

- [x] **2.1** Define `WorkspaceViewProps<T>` — one generic contract: `items`, `itemKey`, `isLoading`, `error`, `onRetry`, `emptyState`, `page`, `onPageChange`, `sort`, `onSortChange`, `selection`, `onActivate`, `labels`. All three views implement it (V1)
- [x] **2.2** Adapt `TableView` to the shared contract while keeping `DataTable` as its engine
- [x] **2.3** Add pagination to `CardView` and `BoardView` via the shared contract (V2)
- [/] **2.4** Add sorting to `CardView` — a sort control in the toolbar, since there are no column headers to click. **Built and covered** (`CardViewToolbar`: field `Select` + direction toggle, rendered only when the caller supplies `sortOptions` **and** `onSortChange`). **No screen can enable it yet:** `useLeads` sends no sort parameter at all, `useCustomerProfiles` hardcodes `sortBy=createdAt&sortDir=DESC`, and the opportunity **card** endpoint is cursor-paged with no sort. Wiring it means changing those hooks, which Phase 2 does not own — a control that cannot reorder anything would be simulated success
- [x] **2.5** Add selection to `CardView` and `BoardView` — a checkbox affordance on the card, driven by the same `SelectionState`
- [x] **2.6** Preserve page, sort, filters and selection **across a view switch** (V2). The URL already carries `?view=`; extend it to carry the rest
- [x] **2.7** **Add a "Move to…" action on every board card** (V3, audit B3). A `DropdownMenu` listing every permitted target column. This is the WCAG AA fix and the single highest-severity item in the plan
- [/] **2.8** Virtualize board columns above 50 cards (V4) — the behaviour `SKILL-AUDIT` already claims exists. **Built; the browser drag D9 requires is the outstanding half.** `react-window@1.8.11` is now a direct dependency — earned, so `knip` is green. **v1 deliberately, not v2:** D9 picked this library because it hands the row a `style` to merge and positions with `top`, leaving `transform` to the drag library; `react-window@2.x` positions with `transform: translateY(…)` and so carries the exact collision D9 moved away from, and it drops `outerRef` for an imperative handle the droppable ref has to be bridged out of. `BoardColumn` picks between two bodies by card count; above the threshold `VirtualColumnBody` wires all four parts of the dnd virtual contract — `mode="virtual"`, a mandatory `renderClone` (the dragged card is unmounted from the list), no `provided.placeholder` (virtual mode throws on one), and manual space via `snapshot.isUsingPlaceholder`, with `overscanCount ≥ 1` which the library requires. Card heights are measured per card, not assumed: board cards are not uniform. The scroll element is react-window's own plain `overflow: auto` div, **not** a Radix `ScrollArea` — 2.17. 2.7's "Move to…" menu is pinned working inside a windowed column. **What is not done:** D9's real 200-card drag in a browser — mouse and keyboard, both directions, both languages — which no authenticated session can reach (D13, and P4 in `MANUAL-TEST-PLAN`). 9 jsdom tests cover the structural half; jsdom has no layout, so every box the dnd library measures is 0×0 and no sensor can produce a drag. **Do not mark `[x]` on the strength of them.** Also unproven in jsdom: keyboard `Tab` past the window's edge depends on the browser scrolling the focused card into view and remounting the next — and the dnd library's own virtual-list guide names the standing cost, that a screen reader and find-in-page cannot reach a card outside the DOM at all
- [x] **2.9** Virtualize `CardView` above 100 items, and `DataTable` above 100 rows
- [x] **2.10** Give `BoardCard` `role="button"` and disambiguate click from drag with a movement threshold (V5)
- [x] **2.11** Remove the `EmptyState title=""` and `ErrorState title=""` fallbacks (G24). Make the label props required so a blank heading cannot compile
- [x] **2.12** Scroll restoration on back-navigation for all three views (audit B15)
- [x] **2.13** `aria-sort` on every sortable `DataTable` header (audit B5)
- [x] **2.14** Sticky chrome must not obscure the keyboard-focused row (audit B4) — `scroll-margin` on the sticky header and column
- [x] **2.15** Update `docs/design/views.md` to describe the real shared contract, and delete the claims that no longer match the code
### Added by L3

- [x] **2.16** ★ Make `CardView` and `BoardCard` compose the `Card` primitive and `focusRing` instead of hand-rolling both; settle **one** radius for a card object; replace both template-literal `className`s with `cn()`. Do this **before** 2.5 adds a checkbox to each, or the duplication doubles
- [x] **2.17** State how `@tanstack/react-virtual` composes with the Radix `ScrollArea` viewport that board columns scroll inside — the classic broken-measurement pairing
- [x] **2.18** ★ **Ship 2.7 on its own, before 2.8.** It is the plan's highest-severity item (the WCAG AA failure) and it currently shares a gate with the riskiest change in the plan. If virtualization stalls, the accessibility fix must not stall with it

**Gate:** `pnpm verify` green · `/crm/leads`, `/crm/opportunities` and
`/crm/customer-profiles` exercised in all three views, both languages, both
themes · a card moved by mouse, by keyboard, and by the new Move-to menu.

---

## Phase 3 — Accessibility and cross-cutting mechanisms

**38 / 40 done** — 38 `[x]`, one `[-]`, one `[/]`. All 17 B-items are now
implemented as well as specified; the per-item map is in
[SKILL-AUDIT.md](../design/SKILL-AUDIT.md#status--documentation-closed-code-landed).
B3, B4, B5 and B15 were delivered in Phase 2; the rest landed here.

The two that are not `[x]`: **3.16** was already settled in `i18n.md` before
this phase started, and **3.19** is a human keyboard pass that no agent can
perform against a real authenticated session — its mechanical half is done and
listed on the task.

- [x] **3.1** B1 — inputs render at 16 px below `sm` (`text-base sm:text-sm`) on `Input`, `Textarea`, `SelectTrigger` and the `FilterBar` search. Stops iOS Safari auto-zoom on every focus
- [x] **3.2** B2 — move focus to the first invalid field after a failed submit, in `FormDrawer` and every form
- [x] **3.3** B6 — a skip link as the first focusable element in `AppShell`, and an `id` on `<main>`
- [x] **3.4** B8 — `cursor-pointer` specified and applied on `Button` and every interactive surface
- [x] **3.5** B9 — autofill and password-manager support on `/login`: correct `autocomplete`, `name` and form semantics
- [x] **3.6** B10 — validate on blur, never on keystroke
- [x] **3.7** B11 — a wrapping rule for UUIDs and correlation IDs so they cannot overflow their container
- [x] **3.8** B13 — announce the notification badge count with `aria-live`
- [x] **3.9** B14 — the toast accessibility contract: `role`, `aria-live`, dismiss timing, focus behaviour
- [x] **3.10** B16 — `readOnly` renders distinctly from `disabled` on every input
- [x] **3.11** B17 — a `max-w` prose measure so long descriptions do not run the full width
- [x] **3.12** Convert `TenantAuthGuard` onto the design system (G11, D16) — tokens, both dictionaries, no hand-rolled `<button>`
- [x] **3.13** Convert `TenantHostStateBoundary` the same way (G11, D16)
- [x] **3.14** Remove `src/components/auth/**` from the ESLint exclusion once 3.12 and 3.13 land
- [x] **3.15** Create `src/lib/format/localized.ts` with `localizedName(item, lang)` (G8) and route all 16 inline data ternaries through it
- [-] **3.16** Settle whether bilingual **data-field** selection is exempt from the zero-ternary rule — **already settled** in `i18n.md`, which states the exemption and makes `localizedName()` mandatory. 3.15 still builds the helper
- [x] **3.17** Drive the census to its documented targets and **re-baseline honestly** (G7). Achieved: `colorUtilityTotal 0`, `colorFamiliesInUse 0`, `roundedXlOrAbove 0`, `fontBoldOrHeavier 0`, `arbitraryTypeSize 0`, `handRolledTables 0`, `physicalRtlViolations 0`. **Two counters have a floor above zero and every site is named**, not footnoted — `languageTernaries` **5** (`I18nContext` 3, which must branch to pick the dictionary and compute `dir`; `lib/format/localized.ts` 2, which contains the syntax by definition) and `handRolledButtons` **2** (both in `context/AuthContext.test.tsx`, test-harness markup — the census is deliberately *not* taught to skip them). Full table in [enforcement.md](../design/enforcement.md#the-two-counters-that-cannot-reach-zero-and-why)
- [x] **3.18** Render `PermissionGate` wherever a 403 is reachable in-body (G3), so the mandated 403 surface stops being dead code
- [/] **3.19** Keyboard-only pass over every existing screen: tab order, visible focus, no trap, Escape closes, Enter activates. **The mechanical half is done** — the skip link is the first tab stop (tested), focus moves to the first invalid field after a failed submit (tested), `readOnly` stays focusable per WCAG 2.4.7, the read-only importance stars stopped rendering three disabled buttons as dead tab stops, and the password toggle's accessible name now says what it does rather than repeating the field label. **The human pass is not done and cannot be faked**: it needs a real authenticated session in both languages, and [accessibility.md](../design/accessibility.md#what-the-gates-catch-and-what-they-do-not) is explicit that nothing mechanical catches a broken keyboard path
- [x] **3.20** **Envelope discipline (S1, L4-1)** — make the Core `unwrapCoreData<T>()` helper impossible to apply to a CRM response. Type-level separation, plus a test that a CRM payload through the Core helper fails to compile
- [x] **3.21** **429 and rate-limit handling (S9, L4-2)** — a distinct, retryable surface for `429`, and a separate one for `RATE_LIMIT_UNAVAILABLE`, which means the limiter itself is down and is **not** a permission problem
- [x] **3.22** **Organization scope (S2, L4-3)** — one shared scope resolver covering CRM's `branchId`, Core's branch-scoped routes and Trade's operating context, so 77 scope-carrying routes are handled once
- [x] **3.23** **Idempotency replay and conflict (S8, L4-4)** — render `Idempotency-Replayed: true` as success-not-duplicate, and `IDEMPOTENCY_BODY_MISMATCH` (422) / `IDEMPOTENCY_REQUEST_PROCESSING` (409) as distinct, actionable states
### Added by L2 — the state contract and the live defects

- [x] **3.24** ★ Write `docs/design/states.md`: the eleven-state contract (loading, empty, error+retry, 403, read-only, offline, optimistic-pending, optimistic-rollback, conflict, not-found, partial-failure), and add it to every phase-4-to-12 gate. **Without this the omission repeats 70 times**
- [x] **3.25** Fix the error/empty collision on all five list pages — pass the real error into the view instead of `error={null}`, so the error state replaces the empty state rather than stacking with it
- [x] **3.26** Give the retry-less error banners a retry: customer-profiles, acquisition-sources, custom-fields, static-data-catalogue, and all three opportunity views
- [x] **3.27** Replace `Promise.all` with `Promise.allSettled` + per-source degradation in `useLeads` and `usePipelineWorkspace`; stop `useCustomerProfilesCapabilities` swallowing a fetch failure as "no permission"
- [x] **3.28** Reclassify "No accessible opportunity pipeline is configured" from an error to an empty state with a create-pipeline action. Reclassified — `opportunities-workspace.tsx` renders `EmptyState` with copy naming the step and who performs it. **The action itself lands with 8.13**, which builds `/crm/pipelines`: a button pointing at a route that does not exist yet would be a fabricated affordance, which is the thing this reclassification was fixing
- [x] **3.29** Replace the faked pagination on five pages (`limit: items.length`, no-op `onPageChange`) with real paging or an honest absence of it

### Added by L3

- [x] **3.30** ★ **Fix the census before re-baselining (3.17 depends on it).** It excludes all of `src/design-system/`, counts only the 22 Tailwind families so the five role ramps are **uncounted**, and its gradient counter matches `bg-gradient-to-` while the code uses v4's `bg-linear-to-r`. As written, 3.17's "honest baseline" is not honest
- [x] **3.31** `Button`'s `disabled:pointer-events-none` makes the documented `disabled:cursor-not-allowed` unrenderable. Resolve as part of 3.4
- [x] **3.32** Add the **spinner** reduced-motion carve-out — `motion.md` requires two survivors, the pending dot and the spinner; only the dot is carved out
- [x] **3.33** Delete `animate-bell-ring` and its keyframe, per the standing instruction in `globals.css`. It is outside the motion budget and no task removed it
- [x] **3.34** Give `surface` and `hitArea` a consumer or delete them
- [x] **3.35** Cite **B7** by name so 13.19's "all 17 B-items implemented" has traceable evidence
### Added by L5

- [x] **3.36** ★ Reconcile Tier 1 before 3.12–3.14 touch it. `HANDOFF.md` marks `src/components/auth/` **do not touch** with exactly two permitted exceptions. Amend it explicitly to add a third, or move the two auth screens out of Tier 1 first — do not silently rewrite files a binding doc protects
- [x] **3.37** `sortDir` vs `sortDirection` (G13) — the shared `PaginationQueryDto` documents `sortDir` as `ASC`/`DESC` while Template Platform uses lowercase `sortDirection` and a combined `sort` token. **Blocking 7.10**; every paginated call must be verified against its own controller
- [x] **3.38** A stated rule for **multi-action document headers** — 11.5, 11.14, 12.13 and 12.14 build headers with 6–8 lifecycle actions against a one-filled-primary rule that has no guidance for them
- [x] **3.39** File length: **8 files already exceed the ~300-line rule**, two by more than 3× (`axiosClient.ts` 1141, `usePipelineWorkspace.ts` 1021). Either schedule the splits or amend `AGENTS.md` — do not plan around a rule the codebase already breaks
- [x] **3.40** Verify `docs:routes:check` passes from a fresh checkout (D8's outstanding verification, never scheduled)

**Gate:** `pnpm verify` green · census at documented targets with an honest
baseline · full keyboard traversal of every built screen · a screen reader pass
on `/login` and one list screen.

**Gate status:** the census is re-baselined honestly and every mechanical gate
owned by this phase is green. The last two clauses — keyboard traversal and the
screen-reader pass — are 3.19 and remain outstanding, and the phase is not done
until a person has run them.

---

## Phase 4 — Core · identity and organization

**30 / 34 done, 3 partial, 1 not buildable.** **50** Gateway routes — organization 21, users 22, roles 6, permissions 1 — plus the auth completion in 4.1–4.4. Every one of the 50 is now called from a screen and runtime-validated.

### Auth completion

- [x] **4.1** `/accept-invite` — consumes the single-use invite token, sets the initial password. `POST /auth/accept-invite`. **Built at `/tenant/accept-invite`, not `/accept-invite`**: `TenantPublicUrlService.buildTenantActionUrl` emails `/tenant/accept-invite#token=…`, and the token is in the **fragment** so it never reaches a server log. The screen reads the fragment once and then clears it from the address bar
- [x] **4.2** `/reset-password` — consumes the reset token. `POST /auth/reset-password`. Same shape and same fragment handling, at `/tenant/reset-password`
- [x] **4.3** Fix the forgot-password dialog (defect D1) — **already fixed in source; D1 is stale.** The regression test lives in `useLogin.test.ts` and asserts the dialog's own address reaches the request body. Original text: — the email field is unbound and the request sends the **login form's** email. Give the dialog its own state and add a test that types a distinct address and asserts it reaches the body
- [x] **4.4** Localize `dispatchForbiddenToast()` in the transport (defect D9) — **already done in source; D9 is stale.** It reads `tenant_lang` and selects the same two dictionaries `I18nContext` does. Original text: — the one permitted i18n change inside Tier 1

### Organization — 21 routes

- [x] **4.5** `/core/organization` — the company → branch → department → team tree. `GET /organization/tree`, bounded at 5 000 nodes per level
- [x] **4.6** `/core/organization/companies` — list, create, edit, deactivate. 5 routes
- [x] **4.7** `/core/organization/branches` — list filtered by company, create, edit, delete. HQ uniqueness is enforced server-side; surface the 409 properly. 5 routes
- [x] **4.8** `/core/organization/departments` — 5 routes
- [x] **4.9** `/core/organization/teams` — including the optional lead user. 5 routes
- [x] **4.10** Deletion blockers are 409s with meaning, rendered through `DeletionBlockerDialog`. **`details.blockers` is server-authored English prose, not an enum** — `OrganizationService.notEmpty()` builds it from a string literal — so the headline is localized from the `ORG_NODE_NOT_EMPTY` code and the blocker phrases render verbatim underneath, the same honesty rule `StatusBadge` applies to an unmapped wire value

### Users — 22 routes

- [x] **4.11** `/core/users` — list with status and placement filters. **Table only**: Phase 2 is 0/18, so the shared three-view contract does not exist yet
- [x] **4.12** `/core/users/[id]` — detail with identity, placement, manager and job metadata, plus the `PATCH /users/:id` edit drawer
- [x] **4.13** Invite drawer — `POST /tenant/users`. Note `@CountsAgainstUsers()`: a seat-limit 403 is a real outcome and needs its own message
- [x] **4.14** Suspend / activate / delete, with owner and self protections surfaced, and all four statuses rendered — `DEACTIVATED` included. Reactivate is offered only on a SUSPENDED user, because `TenantUsersService.activate` refuses anything else with `INVALID_STATUS_TRANSITION`
- [x] **4.15** Team memberships — list, full replacement, add, remove. Primary membership cannot be removed. 4 routes
- [x] **4.16** Module seat assignment — `GET/POST/DELETE /users/:id/modules`. **Seat exhaustion is a 422 `SEAT_LIMIT_REACHED`, not the 403 this line predicted** — `UserModulesService.assign` throws `UnprocessableEntityException` behind its advisory lock
- [x] **4.17** `/core/profile` — own preferences, `GET/PUT /users/me/profile`: theme and language. **Density is deferred to 0.14, which has not landed**; the local-store-wins reconciliation is settled as D-4.17 in DECISIONS.md

### Roles and permissions — 7 routes

- [x] **4.18** `/core/roles` — list with the system-role filter
- [x] **4.19** `/core/roles/[id]` — the permission editor. `GET /tenant/permissions` supplies the catalogue with localized labels; grouped by domain, max 200 per role
- [x] **4.20** Branch-role assignments — `GET/PUT/POST/DELETE /users/:id/assignments`. The `PUT` gets the same pre-write diff as 4.21
- [x] **4.21** Scope-role assignments — `GET/PUT /users/:userId/scope-role-assignments`. TENANT / COMPANY / BRANCH targets, **PUT is a full atomic replacement**, owner-only
- [x] **4.22** Document both grant models in `docs/api/core-users.md` — the legacy branch-role table and the newer scope-role table coexist, and the UI must not imply otherwise
### The missing auth and tenant pages — added by L2, moved ahead of the feature build

- [x] **4.23** ★ `not-found.tsx`, `global-error.tsx`, and a per-segment `error.tsx` for `(tenant)/`, `crm/`, `core/`, `trade/`. A single root boundary unmounts `AppShell` on any thrown error. **`TenantHostAdmission` already calls `notFound()` on the hot path**, so the missing file is user-visible today
- [/] **4.24** `/session-expired` carrying the four terminal reasons; `TenantAuthGuard` now sends an `ENDED` state here instead of bouncing to `/login`. **The reason code cannot reach it yet**: `SESSION_ENDING_AUTH_CODES` is private to `sessionErrors.ts`, `AuthContext` does not put the code on its context value, and both are Tier-1. The page renders the specific reason when one arrives as `?reason=`, validated against the exported `isSessionEndingAuthCode`, and a generic headline otherwise — see Q18
- [x] **4.25** `/account-suspended` for `SESSION_IDENTITY_INACTIVE` and the DEACTIVATED user
- [-] **4.26** ★ Extend `TenantHostStatus` to the full five-value enum — **not buildable: the endpoint cannot return those three values.** `TenantHostStatusService.resolve` filters `t.status IN (ACTIVE, SUSPENDED)` in SQL and throws `404 TENANT_HOST_NOT_FOUND` for everything else, so PROVISIONING, PROVISIONING_FAILED and DELETED are indistinguishable from an unknown host on the wire. Widening the client enum would be inventing states the contract does not carry — see Q19
- [x] **4.27** `/maintenance` fence driven by `server-draining` / `permanent-stop`, read through `useConnectivity`. The `stopReason` renders verbatim — it is a wire value with no client-side mapping
- [x] **4.28** `/entitlement-blocked` — the surface 10.3 gates on and the Phase 10 gate asserts. The mode stays unresolvable for a non-owner (Q16), so the screen states what the server refused rather than claiming which of the four modes applies
- [x] **4.29** Seat-limit-reached state on `/core/users`, linked to 6.12's plan-change path
- [/] **4.30** Expired / already-consumed / revoked token states — **the backend does not distinguish them.** `TenantAuthService.findUsableActionToken` throws one `400 INVALID_ACTION_TOKEN` for all three, so the screen names all three possibilities rather than guessing one. A **fourth** state is client-detectable and is rendered separately: a link opened with no token in its fragment — see Q20
- [x] **4.31** Login failure discrimination — invalid credentials vs suspended account vs suspended tenant vs 429 vs offline, in-body, not one toast
- [x] **4.32** Detail pages for the four organization lists, and the user's team, module and role sub-resources as panels on `/core/users/[id]`
- [/] **4.33** INVITED user lifecycle — pending badge and revoke (`DELETE /users/:id`) are built. **There is no resend route**: `TenantUsersController` sends the invitation once from `POST /users` and exposes nothing else, so the screen says so rather than offering a dead control. Invite-expired is 4.30's shared state — see Q21
- [x] **4.34** The routes assigned to no phase, each now assigned or refused:
  - `POST /auth/accept-invite`, `POST /auth/reset-password` → **4.1 / 4.2**, built
  - `POST /auth/forgot-password` → already live on `/login`; 4.3's regression test covers it
  - `GET /auth/me`, `POST /auth/refresh`, `POST /auth/activity` → `[-]` transport-owned, never called by feature code (`docs/api/core-auth.md`)
  - `GET /auth/sessions`, `DELETE /auth/sessions/:sessionId` → already live on `/core/authentication`
  - `POST /auth/logout-all` → `[-]` deferred to Phase 13 with the rest of the session-hardening surface; it belongs to `/core/authentication`, not this phase
  - `GET /public/tenant-host/status` → already called server-side by `TenantHostAdmission`
  - `GET /branding/public/logo`, `GET /branding/public/icon` → Phase 6, with branding
  - `GET /public/fqdn-validation/:token`, `POST /public/payments/webhook` → `[-]` not browser surfaces: one is a DNS-validation callback, the other a payment-provider webhook
  - `GET /provisioning/updates`, `GET /provisioning/operations/:operationId`, `POST /provisioning/updates/apply` → `[-]` platform-operator surfaces, not tenant-user ones
  - `GET /activity-types` → Phase 7 · `GET /crm/dashboards/catalog` → Phase 9 · `GET /trade/catalog/uoms` → Phase 10 · `GET /trade/dashboards/catalog` → Phase 12 · `GET /trade/decisions/:id` and `GET /trade/inventory/decisions` → Phase 12

**Gate:** `pnpm verify` green · every screen in ar/en × light/dark · a real
authenticated session exercising invite → accept → role assignment → suspend ·
**the eleven-state checklist in [../design/states.md](../design/states.md#per-screen-checklist) passed for every screen**.

---

## Phase 5 — Core · settings and catalogues

**19 / 19 done.** **33** Gateway routes — workspace-settings 2, currencies 5, taxes 4, numbering 4, email-config 4, notifications 14. Small, high-value CRUD screens; the cleanest place to prove the Phase 0–2 foundations at volume.

- [x] **5.1** `/core/settings/workspace` — language, timezone, default currency, support toggle. `GET/PUT /workspace-settings`. Handle `TENANT_NOT_READY`
- [x] **5.2** `/core/settings/currencies` — list, create, edit, set-default, deactivate. 5 routes. The single-default invariant is server-side; the UI reflects it
- [x] **5.3** `/core/settings/taxes` — 4 routes, company-scoped, inclusive/exclusive
- [x] **5.4** `/core/settings/numbering` — sequences with prefix, padding, start value. 4 routes
- [x] **5.5** Numbering peek — `GET /numbering/:code/peek` renders the formatted next number live as the form changes
- [x] **5.6** `nextValue` may never move backward — a 422 with a clear message, not a generic failure
- [x] **5.7** `/core/settings/email` — sender identity, provider config, DKIM/SPF status. `GET/PATCH /email-config`
- [x] **5.8** Email verification — `POST /email-config/verify` and `/verify-connection`, with the DNS record values shown for copy-paste — **partial by contract**: only the DKIM host is derivable from the API; the expected value and SPF are server-side only, see [Q22](OPEN-QUESTIONS.md#q22--the-email-dns-records-a-tenant-must-publish-are-not-returned-by-the-api)
- [x] **5.9** Email config uses **strict** `If-Match` — a missing header is 428, a malformed one is 409. Both need distinct, actionable messages
- [x] **5.10** `/core/notifications` — the full inbox, cursor-paginated. The dropdown exists; this is the full-page view
- [x] **5.11** Notification preferences — `GET/PUT /notifications/preferences`, per type per channel
- [x] **5.12** Device tokens — register and revoke — **no listing route exists**, see [Q23](OPEN-QUESTIONS.md#q23--device-tokens-can-be-registered-and-revoked-but-never-listed)
- [x] **5.13** Mark-read, read-all, acknowledge, dismiss wired to the existing realtime runtime
- [x] **5.14** `/core/settings` — a settings hub that lists only the sections the user may reach
- [x] **5.15** Add every settings route to `nav-config.ts` with a correct `hasAccess` predicate
- [x] **5.16** `SubNav` currently uses the **unfiltered** setup list, so it shows pages the user may lack permission for. Filter it through the same predicate as the sidebar — fixed inside `SubNav` itself, so every caller (CRM setup included) is covered without touching a call site
- [x] **5.17** Every `ETag` / `If-Match` screen surfaces a real conflict path: someone else saved, here is what changed, retry
- [x] **5.18** Document each screen in `docs/api/core-settings.md` with verified status and date
- [x] **5.19** Detail page for `/core/notifications` — Core exposes no `GET /notifications/:id`, so it resolves from the realtime store then a bounded walk of the cursor list, and renders `NotFoundState` past that bound

**Gate:** `pnpm verify` green · every screen in ar/en × light/dark · a
deliberate 409 conflict triggered and rendered correctly ·
**the eleven-state checklist in [../design/states.md](../design/states.md#per-screen-checklist) passed for every screen**.

---

## Phase 6 — Core · billing, subscription, branding

**19 / 21 done, 2 partial.** **23** Gateway routes — billing 8, subscription 4, branding 7, payments 2, wallet 2. Owner-only, money-touching. Decimal strings are never `Number()`d.

**22 of the 23 routes are called.** `GET /wallet` is the one that is not: `GET /billing/summary` already returns the identical `WalletView`, so calling both would be two round trips for one value.

- [x] **6.1** `/core/billing` — summary: subscription, wallet, invoices, collection state. Owner-only, `TenantOwnerGuard`
- [x] **6.2** `/core/billing/invoices` — paginated list
- [x] **6.3** `/core/billing/invoices/[id]` — detail with lines
- [x] **6.4** Payment quote — `POST /invoices/:id/payment-quote`. Immutable, short-lived; show the expiry and what happens when it lapses
- [x] **6.5** Payment intent — `POST /invoices/:id/payment-intents`, idempotency-required, hosted checkout hand-off
- [x] **6.6** Active intent — `GET /invoices/:id/payment-intents/active`. **A URL success is never settlement authority**; the UI must poll the authoritative status
- [x] **6.7** Payment status — `GET /billing/payments/:paymentId`
- [x] **6.8** Wallet top-up — `POST /tenant/payments/topup`, and the payments history list
- [x] **6.9** Every money value renders through the `Money` primitive from a decimal string. **Any `Number()` on a decimal is a defect**
- [x] **6.10** Payment input currencies — `GET /billing/payment-input-currencies`. Non-USD are display and collection values only; the wallet is always USD
- [x] **6.11** `/core/subscription` — current plan, modules, tiers, seats, renewal terms
- [/] **6.12** Plan change preview — `POST /subscription/plan-change-previews`. **Add-or-increase only.** The UI must not offer a downgrade path that the API will reject. **Seat increase only.** `operation: CHANGE` with `itemId` + `seats` is built and verified; `ADD` additionally requires a module and a tier and **no tenant-facing catalogue route exists to enumerate either** — see [Q25](OPEN-QUESTIONS.md#q25--no-tenant-facing-module--tier-catalogue-for-a-plan-change). Offering a free-text module key would be a guessing game the API rejects, so the screen states plainly that adding a module or upgrading a tier goes through support
- [x] **6.13** Plan change apply — `POST .../:previewId/apply`, with the expiry countdown on the preview
- [x] **6.14** The dunning state — while `PAST_DUE`, only the owner can log in and only `@AllowedDuringDunning()` routes are writable. A `DegradedBanner`, not a toast
- [x] **6.15** `/core/settings/branding` — colours, font, app name, tab title. `GET/PUT /branding`
- [x] **6.16** Branding logo and icon upload — `POST /branding/logo`, `/branding/icon`, 2 MB cap, png/jpeg/webp. Handle 413 and 415 distinctly
- [x] **6.17** ★ **Wire tenant branding into the token layer (G2)** — read `GET /branding/public` and override `--color-brand-*` on `:root` at runtime. **Three** semantic tokens consume the brand ramp, not two: `--primary`, `--ring` and `--sidebar-active` (`brand-700` light / `brand-300` dark). Verified live in the app
- [x] **6.18** Branding must not be able to break contrast. Derive the ramp from the tenant's `primaryColor` by holding lightness and fitting chroma to gamut, exactly as Phase 0 does — then re-check the fill pair before applying
### Added by L2

- [/] **6.19** Render `SubscriptionStatus` on `/core/subscription`: all **five** values render with their access consequence, and PENDING_ACTIVATION / PAST_DUE / CANCELLED each get a `DegradedBanner`. The two **actions** L2 asked for do not exist on the tenant surface: there is no convert-from-trial route and no resubscribe route among the four subscription endpoints, so both are stated as support-handled rather than rendered as controls that cannot work
- [x] **6.20** Non-owner 403 in-body for every `TenantOwnerGuard` screen
- [x] **6.21** Payment-quote-lapsed and intent-abandoned states

**Gate:** `pnpm verify` green · a full payment flow against a real session · a tenant `primaryColor` applied and contrast re-verified · **the eleven-state checklist in [../design/states.md](../design/states.md#per-screen-checklist) passed for every screen** · no numeric coercion of a decimal string. **Not provable by grep** — `+value`, `parseFloat`, `value * 1` and plain arithmetic all coerce and none match `Number(`. Needs a lint rule over decimal-typed values.

---

## Phase 7 — Core · directory, templates, audit, activities

**19 / 23 done, 4 partial.** 71 Gateway routes. The largest Core surface.

### Directory — 21 routes

- [x] **7.1** `/core/directory` — parties list, all three views through the shared `WorkspaceViewProps` contract. The board's grouping axis is `status`, the only party field a card move can legitimately write
- [x] **7.2** `/core/directory/[id]` — party detail, with each child section gated on its own grant rather than on the page
- [x] **7.3** Create and edit party — person and organization variants. Create never sends the nested `roles`/`contactMethods`/`addresses` arrays: each child has its own permission and a create body would bypass it
- [x] **7.4** Contact methods — add through the party, edit and delete by the method's own id. A duplicate names the directory setting that refused it
- [x] **7.5** Addresses — add through the party, edit and delete by the address's own id
- [/] **7.6** Party roles — assign and remove built (`POST /parties/:id/roles`, `DELETE /party-roles/:roleId`). The optional `branchId` is **not** offered: the service re-checks it against the actor's branch scope and answers `BRANCH_PERMISSION_DENIED`, and this screen has no branch picker, so a typed branch id could only fail. Roles are assigned tenant-wide until a branch picker exists
- [x] **7.7** Relationships — create and delete. The person picker filters to `PERSON` parties, since a contact relationship to an organization is `PARTY_RELATIONSHIP_INVALID`
- [x] **7.8** Party image — upload, view, delete. The three failures stay distinct: 400 missing part, 415 undecodable after the server's sharp re-encode, 413 too large — which the server can also raise *after* normalising a file that was under the cap
- [x] **7.9** `/core/directory/settings` — duplicate prevention scope and the per-party caps. Gated on `directory.settings.manage` for the GET too: there is no read grant

### Templates — 41 routes

- [x] **7.10** `/core/templates` — cursor-paginated list plus `POST /templates/search` for large filter sets. Cursors are held in memory only, passed back byte-for-byte, and an expired one restarts the list instead of retrying
- [x] **7.11** Create from a starter — the starter list refetches whenever any element of the doc/output/layout/adapter/locale/direction/scope tuple moves
- [/] **7.12** `/core/templates/[id]` — **the editor is not built, and the screen does not claim to be one.** `RichTextEditor` (1.48) edits sanitized HTML for a single field; `TemplateDocumentV1` is a layout document with 18 node types, flow and absolute layout, page config, theme, bindings and formula ASTs (`@mutakamel/template-schema`). Nothing in the design system can express it. What shipped is the definition screen — metadata, lifecycle, revisions, validation, publish, versions, preview, recovery and history
- [/] **7.13** Recovery snapshots are listed and restorable, with the reason **and** the discard acknowledgement both collected as required fields. **Autosave is not built**: `PATCH /draft` takes the whole `editorDocument`, and with no editor there is no document to save — an autosave loop would resend the document it just read. The `If-Match` conflict path it would need is built and exercised on the definition writes instead
- [x] **7.14** Validation runs — `POST /:id/validate` against the draft revision, with exactly the two renderer targets the output channel implies, and the issues rendered per run
- [x] **7.15** Publish — all three preconditions listed before the button enables, and the validation run is compared against the **current** draft revision, so a run that no longer applies reads as such instead of failing on click
- [x] **7.16** Versions — list, view (the detail route carries the compiler and validation-run identifiers the list omits), restore-to-draft with a recorded operator reason, retire against the definition revision
- [x] **7.17** Preview — HTML and email render synchronously from a pinned draft revision; PDF is the 202 job, polled, with `AsyncJobState` carrying the expired-artifact state as a real fifth outcome. Rendered markup is shown as text, never injected
- [x] **7.18** Assets — list, upload (exactly two multipart parts, checksummed client-side), view, retire. `EMAIL_PUBLIC` gets its own confirmation step, not a checkbox
- [x] **7.19** Assignments — list, create, edit, deactivate, and a **resolve preview** so overlapping windows and priorities are answered by the server rather than reasoned about

### Audit and activities — 9 routes

- [x] **7.20** `/core/audit` — the ledger on `Timeline`, surfacing `outcome` and `reason`. `hasNext`/`hasPrev` are derived, because this endpoint returns neither. No search box: the endpoint has no search
- [x] **7.21** Entity history — embedded on the party and template detail screens, from a shared parent-segment component. The Phase 4 detail screens are outside this phase's edit boundary
- [x] **7.22** `/core/activities` — list, create, update, complete, cancel. `complete` and `cancel` are read as **200**, the assignee picker is never called without a resolved target, and every mutation carries `If-Match` plus a caller-owned idempotency key so an ambiguous retry is safe
- [/] **7.23** `AmbiguousOutcomePanel` is wired in-body on `/core/activities`, where a timed-out write is genuinely ambiguous and the retry reuses the same idempotency key. **Lead conversion is not touched**: `POST /leads/:id/convert` and `/crm/leads/[id]` are CRM Phase 8, outside this phase's edit boundary

**Gate:** `pnpm verify` green · a template drafted, validated, published,
assigned and previewed as PDF end to end · a party created with contacts,
addresses, roles and an image ·
**the eleven-state checklist in [../design/states.md](../design/states.md#per-screen-checklist) passed for every screen**.

---

## Phase 8 — CRM · completion

**21 / 27 done, 5 partial, 1 already done elsewhere.** Finishes the module that is already 17 % built.

- [x] **8.1** `/crm/leads/[id]` — lead detail. Built to `detail-screens.md`: two columns, no tabs, capabilities-gated actions, notes and attachments embedded, custom-fields rail. **Route admission fixed 2026-08-31 (Q40).** `isSupportedCrmPath()` matched only `/crm/customer-profiles/[id]`, so the proxy redirected a browser to `/unavailable` before the page ran — **six** built detail screens were unreachable, not two. Replaced with a `CRM_DETAIL_PATHS` pattern mirroring the `CORE_DETAIL_PATHS` that had already solved this, and pinned by tests for all six plus two negatives
- [x] **8.2** Lead conversion — the three-step flow on `Stepper`, prefilled from the lead, terminal stages filtered out of the selector, a read-only review step, and a persistent success panel with both new-record links rather than a toast. **One idempotency key per attempt**, minted when the drawer opens and replayed by the ambiguous-outcome retry — a fresh key would convert the lead twice
- [x] **8.3** Lead edit — `PATCH /leads/:id`, changed keys only. No `stageId`, `status` or singular `companyPhone`: the update DTO carries none of the three
- [x] **8.4** Corporate lead company options and their contacts — 2 routes, in the create drawer. The contacts route is `BRANCH_REQUIRED` and the options route declares no scope mode, so the headers go on exactly one of them. A contact row is keyed on `partyId`, **not** `id`, and a company's `branchId` is nullable — the query returns branch-less organizations by design
- [/] **8.5** Capabilities-driven action gating (defect D11) — done for leads, opportunities and customer profiles. The root cause was not the gating shape but a **missing scope header**: all three `capabilities` routes are `BRANCH_REQUIRED`, the calls sent only the `branchId` query parameter, and the Gateway answered `400 GW.REQUEST.INVALID` before crm-app saw them — so every control silently degraded to unavailable. Fixed in `useLeads`, `usePipelineWorkspace` and the new detail hooks. The remaining CRM screens are another agent's directories
- [-] **8.6** Remove every "Kanban" string from both dictionaries (defect D12) — **already done**; `grep -rn Kanban src/` is empty and `views.md` records the three keys and the icon import as deleted
- [x] **8.7** Customer profile actions (Q12) — add contact, edit, change status, delete, all gated on `useCustomerProfilesCapabilities`. Add contact is the one primary and only on a CORPORATE profile; an INDIVIDUAL has none, per the one-primary ceiling. Only `BLACKLISTED` confirms. `POST /:id/contacts` declares `organizationScopeMode: NONE`, so it is the one CRM write that must send **no** scope headers
- [x] **8.8** Customer profile custom-fields rail card — and the same card on lead and opportunity detail. Hides entirely when the tenant defines none. Its own definitions parser keeps `options`, which the list screen's projection reduces to a count, so a SELECT value renders its label instead of its key
- [x] **8.9** Customer profile create — `POST /customer-profiles`. The corporate block is omitted on an INDIVIDUAL profile because `assertCorporateOnlyFields` rejects every one of those keys there, and only the canonical alias of each legacy pair is sent
- [x] **8.10** `/crm/opportunities/[id]` — detail with the stage-history `Timeline`, rendered in the server's order because `Timeline` never sorts, and toned only on WON/LOST since a stage is an outcome there and a category everywhere else. **Route admission fixed with 8.1** — Q40
- [x] **8.11** Opportunity create and edit. Create picks its customer through a remote `Combobox` and filters out BLACKLISTED profiles, which the service refuses with 409. The amount is a decimal **string** in and out; the one `Number()` is at the request boundary, behind a 15-integer-digit guard that keeps it exact, because `@IsNumber({ maxDecimalPlaces: 2 })` accepts no string form
- [x] **8.12** Pipeline transfer — `PUT /opportunities/:id/pipeline`, in a dialog that names the consequence: with no stage chosen the opportunity lands in the target pipeline's entry stage. Terminal stages are filtered out of the optional stage picker
- [x] **8.13** `/crm/pipelines` — pipeline configuration: create, edit, delete, set default, reset to default stages. `stageIds` is deliberately never sent on create — omitting it seeds the canonical stage set and composition happens on the detail screen. Reset uses `ConfirmActionModal` naming every consequence rather than the typed confirmation crm-opportunities.md asks for: no `TypedConfirmDialog` primitive exists and `src/design-system/` was out of scope
- [x] **8.14** Pipeline stages — attach, reorder, detach. Reorder sends the complete `orderedIds` list to `PATCH /:id/stages/reorder`, driven by earlier/later controls rather than drag-only
- [x] **8.15** Pipeline assignments — read and replace, through `AtomicReplacementConfirm` so the removals a full-replacement `PUT` hides are visible before the write
- [x] **8.16** `/crm/opportunity-stages` — the reusable stage catalogue, 5 routes. All five require `crm.pipelines.manage`, **not** `crm.pipelines.read` as crm-opportunities.md's table states — verified on every handler
- [x] **8.17** Lead stage edit and set-default — set-default was already live; edit added, with the NEW-stage and default-stage protections mirrored from the service
- [x] **8.18** Acquisition source icon upload and reorder — 400 / 413 / 415 render as three distinct messages, and reorder is suppressed while a search narrows the list because the payload is the whole order
- [x] **8.19** Custom field requirements and values — 4 routes. `POST /:id/requirements` takes ONE operation per call (`SetFieldRequirementDto`), not all three as crm-catalogues.md states; values are read and written against a record chosen on the screen
- [/] **8.20** `/crm/activities` — the CRM activity log, read-only. `POST /activities` needs the `sourceType`/`sourceId` of the record being logged against, so logging belongs on that record's screen, not on a cross-record log
- [/] **8.21** `/crm/tasks` — list, create, update. Edit offers only `title`, `status` and `dueAt`: the list projection omits `description`, `priority` and `assigneeUserId`, so the form has no current value for them (Q50)
- [/] **8.22** `/crm/calendar` — events list, create, update on `DatePicker` plus a time input, since the route takes an instant. `attendees` is never sent — the DTO declares no item shape (Q51) — and edit omits the fields the list projection drops (Q50)
- [x] **8.23** `/crm/reminders` — list, create, cancel. No search box: the reminders query passes no search predicate
- [x] **8.24** Notes — CRUD, embedded on all three detail screens. Gated on the source **record's** owner, which is what `resolveSourceScope` authorises against; a note's own `createdByUserId` is not what the scope check reads. Update rides the create boundary because `/leads/capabilities` reports `notes.create` and `notes.delete` and no update signal
- [x] **8.25** Attachments — upload, list, download, delete on `AttachmentList`, on all three detail screens. **The cap is 25 MiB (26 214 400 bytes), not 26** — 26 MiB is the Gateway's whole-body ceiling for this path, file plus multipart envelope; see Q42. Missing file / wrong type / too large render as three distinct messages, matched on code with a status fallback. Download is a same-origin navigation, because the single `fetch` reads every body as text and would corrupt a stream
- [x] **8.26** `/crm/outbound-emails` — options, preview, send, list, detail, retry. 6 routes. The 202 is reported as **queued**, never sent; the list carries a standing eventual-consistency banner and cursor paging with a load-more, not a fabricated page control
- [/] **8.27** Detail pages — routed for `/crm/pipelines/[id]` and `/crm/opportunity-stages/[id]`, which have `GET /:id`. The other four have **no detail route and no id filter** (Q52), so their detail is a drawer over the already-loaded row rather than a page that cannot fetch what it addresses. `/crm/outbound-emails/[id]` is routed too, under 8.26

**Gate:** `pnpm verify` green · a lead created, worked through the board,
converted to a customer and an opportunity, with a note, an attachment and an
outbound email · every action gated by `capabilities`, not permission strings ·
**the eleven-state checklist in [../design/states.md](../design/states.md#per-screen-checklist) passed for every screen**.

---

## Phase 9 — CRM · dashboards and widgets

**13 `[x]`, 2 `[/]`.** 40 Gateway routes, all 40 called. Contract page:
[../api/crm-dashboards.md](../api/crm-dashboards.md).

**Nothing here has been driven against a real authenticated session.** CRM is
blocked twice over — by P4 and by Q17 — so `pnpm verify` green is the ceiling:
type-validated, lint-validated, unit-tested. The eleven-state checklist is met
by construction and by test rather than by observation, and no chart has been
looked at in dark mode or in Arabic.

- [x] **9.1** `/crm/dashboards` — the dashboard list plus catalog and navigation. The list has **no pagination** because `accessibleDashboards` returns one array with no page/limit query; the catalogue loads under `allSettled` beside it, so losing it degrades the template picker rather than the screen. `GET /dashboards/default` is bound to a **button**, never to mount: with no default it *provisions one and audits a creation*, so calling it to probe would create a dashboard by visiting a page
- [x] **9.2** The seven prebuilt dashboards: overview, sales-pipeline, leads, activities-productivity, customer-intelligence, data-quality, action-center — one screen at `/crm/dashboards/reports`, seven routes, a `ToggleGroup` between them. They share a permission and an envelope with the builder and **no response shape**: each widget key has its own payload, transcribed one by one from the SELECT that produces it. `repWorkload` returns `opentasks`, lower-cased by PostgreSQL from an unquoted `AS openTasks` (Q100)
- [x] **9.3** `StatCard` finally gets its consumer (G4) — every `SCALAR` widget on a dashboard, every count on a prebuilt report, and the widget preview. `MONEY` goes through `formatDecimalString`, the same `Intl` path `Money` uses; `PERCENT` is **already 0–100** on the wire and would be multiplied twice by `style: "percent"`
- [x] **9.4** Dashboard detail with layout rendering — `POST /:id/run`, which answers **201**, not 200. The definition and the run are two requests under `allSettled`, so a dashboard whose widgets could not run is still readable, shareable and editable
- [x] **9.5** Dashboard builder — create, edit, delete, duplicate. Edit is name and description only: `defaultFilters` carries `ownerUserId` and `pipelineId`, this screen has no picker for either, and a partial editor would rewrite the whole object and drop the keys it cannot show
- [x] **9.6** Create from template — `POST /from-template/:templateKey` in the create drawer, **and** `PUT` on the same path behind "Standard dashboard". The two are not interchangeable: POST creates another instance every time, PUT is get-or-create
- [x] **9.7** Layout editing — `PUT /:id/layout` on `@hello-pangea/dnd`, with earlier/later buttons beside the drag handle because drag is never the only path (2.7 / audit B3). The saved geometry is **repacked first-fit** from the order rather than swapped: the write takes the complete visible set, and its overlap check includes placements the editor cannot see, so swapping two boxes of different sizes is a 409
- [x] **9.8** Set default and favourite — optimistic, reverted on failure. Both are **`crm.dashboards.read`** writes, not `.update`: they store a per-user preference. Gating them on `.update` would hide them from every user who has only read
- [x] **9.9** Widget placements — add and remove. Position is left to the server, which places below everything at the visualization's default size; a widget already on the dashboard is not offered, because adding it twice is a 409
- [/] **9.10** Widget drilldown — `POST /:id/widgets/:widgetId/drilldown`, cursor-paged with a load-more and no fabricated pager. Offered on **single-series widgets only**: `seriesKey` is resolved against the *stored* `querySpec`, not the executed series keys, which split by currency — so a two-series widget needs a key this screen cannot derive unambiguously. **Partial for that reason**: a multi-series widget's table renders, and its rows do not drill
- [x] **9.11** Dashboard sharing — list, create, revoke, with the share-targets picker. Mounted for the **owner** only: every share route calls `assertOwner`, so holding `crm.dashboards.share` on a dashboard shared *with* you still answers 403, including on the picker
- [/] **9.12** `/crm/widgets` — widget CRUD, preview, clone. Every rule the form enforces is read from `GET /dashboards/catalog`; `POST /widgets/preview` is gated on **`crm.dashboards.read`**, not a widgets permission. `PATCH` reports `layoutAdjustments` — placements the server resized on other people's dashboards — and the screen surfaces them rather than swallowing them. **Partial**: the form builds one series, so `MULTI_KPI` and `COMBO` (`minSeries: 2`) are not offered rather than offered-and-rejected (Q104), and the `SEMANTIC_V1` engine is not exposed (Q105). A stored widget of either kind still lists, renders, runs and edits
- [x] **9.13** Widget sharing — on `/crm/widgets/[id]`, owner-only, without an expiry control (Q106)
- [x] **9.14** Every chart is readable in both themes, colourblind-safe, and has a table fallback for screen readers. The fallback is a real `<table>` with a `<caption>` in a disclosure anyone can open, not `sr-only` markup, and it is built for **every** widget — including the 20-odd visualizations this design system cannot draw, which render as their table rather than as an approximation of a treemap. Colour comes only from the four roles, derived from the metric key, never from series identity (Q103). Census: `handRolledTables` 0 → 1, banked with its reason in [../design/enforcement.md](../design/enforcement.md#the-two-counters-that-cannot-reach-zero-and-why)
- [x] **9.15** Dashboard partial-failure — "3 of 9 widgets failed", per widget, without failing the dashboard. `DashboardExecutionService` wraps each widget in its own SQL savepoint and returns `{ error: { code }, meta: { warnings: ['WIDGET_EXECUTION_FAILED'] } }` beside the ones that worked, still under a **201**. The banner counts them, each failed tile names its own code, and `meta.unit` is absent on that path so nothing downstream may assume it

**Gate:** `pnpm verify` green · every prebuilt dashboard rendered against real
data · a custom dashboard built, laid out, shared and drilled into ·
**the eleven-state checklist in [../design/states.md](../design/states.md#per-screen-checklist) passed for every screen**.

---

## Phase 10 — Trade · foundation

**20 / 21 done, 1 partial.** All 42 foundation routes are called, and
`docs:verify-called-routes` proves each one is in the Gateway contract and
documented. Trade authorization differs from CRM: `@RequireTradeFeature` at the
controller and `@RequireTradeAccess` with an explicit scope target per handler.

- [x] **10.1** Extract the Trade permission and feature catalogue into `docs/reference/permissions.md`. This was deliberately deferred as Q9 and is now blocking. **Extracted: 89 permissions across 23 groups, plus the 15 features.** The catalogue holds **89**, not the 90 `trade-foundation.md` states
- [x] **10.2** Document the Trade authorization model: the features, the scope targets, and how they compose. **Corrected 2026-08-31:** only **8 of the 15** features gate anything — the other seven are inert. The Gateway enforces **zero** Trade permissions (all 231 contracts have `requiredPermissions` absent); `TradePermissionsGuard` matches `scope_target` **exactly**, so a TENANT grant does not satisfy a BRANCH route, and only `is_tenant_owner` bypasses. `DASHBOARD_CONTEXT` routes bypass the guard entirely. Eight catalogued permissions gate no route. The three verified contract pages already carry this per route — write the summary, do not re-derive it. **Written** as `## The Trade authorization model` in `docs/reference/permissions.md`. One correction: the route-decorator count of permissions that gate nothing is **nine**, not eight, and four of the nine are dashboard `fieldPermissions` rather than dead
- [x] **10.3** Unseal `/trade` — replace `UnavailableState` with a real module home, gated on entitlement. Trade publishes no entitlement endpoint, so the gate is a probe: `TradeSubscriptionGuard` refuses before the scope and permission guards, so one cheap catalogue read answers for the whole module, and its three refusal codes are distinguished from a permission 403
- [x] **10.4** Add Trade to `proxy.ts`'s matcher and the nav tree. The matcher and `isSupportedTradePath` were already in place from Phase 12; this added the five foundation segments to the allowlist and the `tradeFoundation` nav section. The owner needs no separate nav predicate: `/auth/me` returns every seeded key to an owner and trade-app seeds its own 89, so an unprovisioned tenant's owner correctly sees no Trade nav
- [x] **10.5** A trade operating-context selector — company, branch, channel. Most Trade routes require it, and it is a different axis from the CRM branch selector. Mounted once in `trade/layout.tsx` so two Trade screens cannot disagree about the company. Company and branch render as **ids**: nothing Trade publishes carries their names and `/auth/me` has none — Q70
- [x] **10.6** `/trade/items` — catalog list, all three views, 12 routes. The board groups by `ItemStatus` and its move is a plain `PATCH /items/:id` with `If-Match`; no column carries a hue, because item status is not a pipeline outcome
- [x] **10.7** `/trade/items/[id]` — item detail
- [x] **10.8** Item create and edit. The code pattern is enforced client-side because the server answers **500** for a malformed one, not a 422 — Q72
- [x] **10.9** Item company profile — upsert. A full-object write on both verbs; the two default-UOM pickers read `GET /catalog/uoms`, which is the 42nd route on the page
- [x] **10.10** Item branch profile — upsert. The same permission as 10.9 at a different scope target, so it carries its own gap and its own optimistic enable
- [x] **10.11** Item channel listings — list, create, update. `publicationStatus` and `saleConstraints` go on every write: both are optional **with defaults**, so omitting either writes the default over the stored value
- [x] **10.12** `/trade/uoms` — units of measure, 4 routes. Reads send company **and** branch (Gateway `BRANCH_REQUIRED`); writes send no scope headers at all (Gateway `NONE`)
- [x] **10.13** `/trade/channels` — channels and their branches, 6 routes. The list is a bare array with no pagination, so the pager reports the honest single page rather than a fabricated one
- [x] **10.14** `/trade/commercial-accounts` — list, 10 routes
- [x] **10.15** Commercial account detail, create, edit. Reads are `COMPANY_OR_BRANCH` and writes `COMPANY`, so the write path deliberately drops the branch header
- [x] **10.16** Account branch rules — create and update. The service refuses any `branchId` but the one in the operating context, so the screen only ever manages the selected branch
- [x] **10.17** Credit evaluation — `POST /:id/evaluate-credit`, gated on `trade.credit.view`. It returns the **decision receipt**, with the decision under `result` — a shape the contract page did not carry, now added to it
- [x] **10.18** Block and unblock an account, through `ReasonDialog` with the 80-character `reasonCode` the DTO requires
- [x] **10.19** `/trade/configuration` — definitions, versions, test, publish, resolve. 9 routes — **the enumeration above lists only 6**; the other three are `/configuration/company-default-price-books/*`, which task 12.12 also claims. They are documented on `trade-foundation.md` with a cross-link from the advanced page. Build them once, here. **All nine are built here**, including the one `If-Match: "0"` route in Trade. Also found: `definitions/:id/versions`, `versions/:id/test` and `versions/:id/publish` all require `If-Match`, which the route table did not mark, and the first carries the **definition's** version rather than the version's own
- [x] **10.20** Item search — `POST /items/search`, the read-like POST variant for large filter sets. Its filters are equality matches, so it is used only when a code is typed and the list falls back to `GET /items` otherwise
- [/] **10.21** Detail pages for `/trade/uoms`, `/trade/channels`, `/trade/configuration`. **UOM and channel detail are built; configuration has none.** trade-app publishes no GET for a single configuration definition or version — `findDefinition` is private to the service — so a detail route would have to page the whole list to render one record. Its versions, their test and their publish live on the list screen instead, and `/trade/configuration/:id` is deliberately absent from the proxy allowlist. Q71

**Gate:** `pnpm verify` green · an item created with company, branch and
channel profiles · a commercial account created and credit-evaluated · every
screen correct with a missing entitlement ·
**the eleven-state checklist in [../design/states.md](../design/states.md#per-screen-checklist) passed for every screen**.

---

## Phase 11 — Trade · commercial documents

**9 / 22 done, 13 partial.** The transactional core. Every document has a lifecycle, and
the UI must reflect the real state machine, never guess it.

- [/] **11.1** `/trade/quotations` — list, all three views, 14 routes
 — **built as a table only.** Board and card views are not offered: `DocumentListQueryDto` exposes no grouping dimension, and a lifecycle transition needs a reason code and an `If-Match`, so a drag would be a lie about what the server accepts. `POST /quotations/search` is not called — it is `GET /quotations` with the same DTO and no extra capability. 12 of the 14 routes are called; convert is 11.6
- [x] **11.2** Quotation detail with lines
- [/] **11.3** Quotation create and edit, with the customer-options picker
 — create is complete, including the cursor customer picker, with blocked customers shown disabled and carrying their `denialCode`. **Edit is limited to `draftReference`**: `UpdateQuotationDto`'s only other field is `contactPartyId`, a bare UUID with no picker route anywhere in the 60
- [x] **11.4** Quotation revisions — `POST /:id/revisions`
 — `terms` is omitted so the server writes its own `{}` default; the consequence for conversion is Q80
- [x] **11.5** Quotation lifecycle: send, accept, reject, cancel — each with its reason dialog
- [/] **11.6** Convert quotation to sales order
 — **blocked, and rendered as a boundary rather than built.** Two independent causes: `ConvertQuotationDto` requires a non-empty `taxSnapshot` per line with no published schema (Q32), and `assertQuotationConversionEvidence` requires the accepted revision's `terms` to be non-empty and reproduced byte for byte, which a portal-created revision can never satisfy (Q80)
- [/] **11.7** Quotation PDF — a **202 async render job** with polling and download. The gateway enforces the exact `Location` prefix
 — **the screen is built; the task's premise is not true.** The 202, the poll and the download all work from `data.statusUrl`, and the `Location` header is ignored. But the Gateway's `assertPublicLocationContract` requires a prefix trade-app does not emit, so on this reading every Trade PDF render is turned into a 502 at the edge (Q36). That failure renders with its own message rather than as a generic upstream error, and cannot be proven working until the backend defect is settled
- [x] **11.8** `/trade/sales-orders` — list, 12 routes
 — the list carries the lifecycle **and** confirmation axes, because one badge would call a failed confirmation and an untouched draft the same thing
- [/] **11.9** Sales order detail, create, edit
 — detail and edit are built. **Create is blocked**: `CreateSalesOrderDto` requires a non-empty `taxSnapshot` per line with no published schema (Q32). Edit is `draftReference` only, for the same reason as 11.3
- [x] **11.10** Order confirmation — `POST /:id/confirm`, plus the async confirmation-attempt polling and cancel
 — branches on the body's own `statusCode`, polls the attempt, and cancels with `If-Match` on the **attempt's** version, which is what the service asserts (Q84)
- [x] **11.11** Order lifecycle: hold, release-hold, cancel
 — hold is suppressed while a confirmation attempt is pending, because the service refuses it rather than cancelling the attempt (Q84)
- [/] **11.12** Sales order PDF render job
 — built; blocked at runtime by the same Gateway `Location` defect as 11.7 (Q36)
- [/] **11.13** `/trade/purchase-orders` — list, detail, create, edit. 12 routes
 — list, detail and edit are built. **Create is blocked** by the same `taxSnapshot` gap (Q32). Edit is `draftReference` only: `receivingNodeId` is a stock-location id and there is no node picker in this phase
- [/] **11.14** Purchase order approval ladder: submit, withdraw, approve, reject, confirm, cancel. Uses the `Timeline` pattern
 — all six transitions are built, with the maker–checker rule applied locally so the wrong person is never offered a control the server will refuse. **It is a `Stepper`, not a `Timeline`**: no route returns the approval instance or its steps, so the only readable fact is the current position (Q82)
- [/] **11.15** Purchase order PDF render job
 — built; blocked at runtime by the same Gateway `Location` defect as 11.7 (Q36)
- [/] **11.16** `/trade/purchase-quotations` — list, search, detail, create, edit, issue. 8 routes
 — **the one family built end to end**: list, detail, create, edit and issue, with the line editor and the PDF. `POST /search` is not called, for the same reason as 11.1. The supplier picker labels each account with its party id because Trade publishes no supplier name anywhere (Q83)
- [/] **11.17** `/trade/invoices` — list, detail, create, edit, issue. 7 routes
 — list, detail, issue and the PDF are built. **Create and edit are blocked**: every invoice line requires a non-empty `priceSnapshot` with no published schema, and `UpdateInvoiceDto` is a full replacement carrying every line and both snapshots (Q32, Q85)
- [/] **11.18** `/trade/contracts` — list, detail, create, edit, activate. 7 routes. **Not feature-gated:** `TradeContractsController` carries no feature decorator and `trade.contracts_recurring` is referenced nowhere in the codebase. Do not build a gate for it. Note also that contract `SIGNED` appears to be unreachable — see Q35
 — list, detail, activate and the PDF are built, with **no entitlement gate**, as the corrected task says. **Create and edit are blocked**: `financialTerms.sourceEvidence` must be non-empty and has no published schema (Q32, Q85). `SIGNED` renders and is never offered
- [/] **11.19** Document lineage — quotation → order → invoice, rendered as a `Timeline` on every document
 — **one edge of three exists.** A sales order links back to its source quotation and revision, and that is rendered. `trade_document_lineage` is written on conversion and read by no route, an invoice's `sourceSalesOrderId` is hard-coded to `null` at creation, and no list route filters by a source id — so quotation-to-order forward, order-to-invoice and invoice-to-order have no data source at all (Q81)
- [x] **11.20** Every document line editor: item picker via `Combobox`, quantity, UOM, price, tax, and a running total. **This task was inverted and is corrected here.** Trade does **not** compute totals for you: the client must submit complete per-line **and** document totals, and the server only *checks* the arithmetic. Worse, `unitPrice` is **not** in the order-line DTO, so `POST /pricing/evaluate` must be called first to obtain it. So the browser does compute the figures it submits — through decimal-string arithmetic, never `Number()` — and the server is the referee, not the calculator. Every mismatch is a rejection, so the arithmetic has to be right, not approximately right
 — the item picker is a `Combobox` over one loaded catalogue page, and says so, because Trade has no item search. The running total comes from `POST /pricing/evaluate` per line, multiplied through a line-for-line port of trade-app's `fixed-decimal.ts`: `bigint` units of 1e-8, half-up on the magnitude, trailing zeros stripped. Price and tax are read-only in the editor — neither is a field on the line DTOs of the two families this editor can submit
- [x] **11.21** Every document total renders through `Money` from a decimal string. All Trade money and quantity fields are decimal strings ≤ 8 dp and **no endpoint returns a JS number for either** — verified by sweeping every `Number(` call in trade-app. Two traps: `fixedDecimalText` **strips trailing zeros**, so `10.50` arrives as `"10.5"` and a naive string compare against `"10.50"` fails; and dashboard `scalar` is a **number for `COUNT` metrics but a decimal string for everything else including `MONEY`** — a union discriminated by `unit`, not a single type
 — every figure renders through `Money` from the exact wire string. The port's tests pin both traps: `fixedDecimalText` strips trailing zeros, and `validateInvoiceTotals` compares raw strings, so the canonical form is mandatory rather than merely tidy
- [x] **11.22** Every lifecycle action surfaces its real precondition failure — a 409 says which state transition was refused, not "failed"
 — 63 documented codes map to their own message in both languages. The twelve codes in `TRADE_ERROR_CODES` with no throw site are deliberately absent, and the ten retryable ones are separated from refusals

**Gate:** `pnpm verify` green · a quotation created, revised, sent, accepted,
converted to a sales order, confirmed, and invoiced, with a PDF at each stage ·
every total matching the server to the last decimal place ·
**the eleven-state checklist in [../design/states.md](../design/states.md#per-screen-checklist) passed for every screen**.

---

## Phase 12 — Trade · advanced and analytics

**21 / 28 done, 6 partial, 1 not mine.** Inventory, pricing, governance,
automation, analytics. New open questions from this phase: **Q90** (periods
and UOM conversions have no GET-by-id), **Q91** (policy and workflow versions
have no GET at all), **Q92** (`mappingKind` on the API page is `targetCode` in
source), **Q93** (S6 is unmeetable across the whole phase).

- [x] **12.1** `/trade/inventory` — availability, 26 routes
- [x] **12.2** Inventory nodes — list, detail, create, update
- [x] **12.3** Inventory periods — create, close, reopen
- [x] **12.4** UOM conversions — create, publish, retire
- [/] **12.5** Opening balances, reservations and releases — **[/]** created and released, but never listed: reservations and opening balances expose no GET (Q37), so the reservation id the create returns is held for the session and the screen says so.
- [/] **12.6** Receipts and deliveries — create, post, reverse — **[/]** create, post and reverse all built; no receipt or delivery can be read back (Q37). Reversal is correctly behind `trade.inventory.adjust`, not the movement's own grant.
- [/] **12.7** Serial tracking — list and detail — **[/]** list and detail built; `serialKey` is an exact-match filter, not a search — the route has no partial-match parameter.
- [x] **12.8** `/trade/pricing` — price books and versions, 6 routes
- [x] **12.9** Price book version editor with entries and promotion rules
- [x] **12.10** Price test and publish
- [x] **12.11** Pricing evaluation — `POST /pricing/evaluate`, with the decision receipt shown
- [-] **12.12** Company default price books — **[-]** not mine: the three `/configuration/company-default-price-books/*` routes are Phase 10's task 10.19 and were built there. `/trade/price-books` links to them rather than duplicating them.
- [x] **12.13** `/trade/policies` — Policy Studio, 12 routes. The governance ladder: validate, test, submit, approve, reject, publish, retire, rollback
- [x] **12.14** `/trade/workflows` — the identical ladder, 12 routes
- [x] **12.15** `/trade/document-profiles` — profiles and versions, **5 routes** (3 + 2)
- [x] **12.16** `/trade/extensions` — targets, profiles, versions, validate, publish. 9 routes
- [x] **12.17** `/trade/imports` — sources, mappings, preview, execute, results. 11 routes, uses `FileUpload`
- [x] **12.18** `/trade/webhooks` — subscriptions, secret rotation, test, deliveries, retry. 11 routes
- [x] **12.19** `/trade/control-tower` — exceptions list, detail, retry, resolve. 4 routes. **Not gated on `trade.control_tower_advanced`** — the real gate is `allOf[analytics]` **plus** `anyOf` seven domain features, so a tenant can hold analytics and still be refused. Note `severity`: the filter and the enum disagree and only `"HIGH"` is ever written (Q31), so render unknown values rather than mapping them
- [x] **12.20** `/trade/dashboards` — list, catalog, navigation, default, share-targets. **20 routes** (L1-3: this was buried in a half-sentence)
- [x] **12.21** Trade dashboard CRUD, duplicate, from-template, set-default, set-favourite
- [/] **12.22** Trade dashboard layout editing and `POST /:id/run` — **[/]** `PATCH /:id/layout` and `POST /:id/run` are both wired, and the six per-tile execution statuses render. Layout is saved from the placements the server returned; there is no drag-and-drop grid editor — the catalogue itself declares `layoutEditing: "DESKTOP_ONLY"` and nothing in source states the interaction.
- [x] **12.23** Trade dashboard placements and shares
- [x] **12.24** `/trade/widgets` — CRUD, preview, clone. **11 routes**
- [x] **12.25** Trade widget shares, including `shares/bulk-upsert`
- [/] **12.26** Trade analytics reuses the Phase 1 chart wrappers and the Phase 9 dashboard shell — no second dashboard implementation — **[/]** the Phase 1 chart wrappers are reused (`BarChart` in `WidgetTile`). There is **no Phase 9 dashboard shell to reuse**: `crm/dashboards/**` landed in parallel with this phase and is not a shared component. Trade analytics has its own tile and grid, which is a second implementation only in the sense that CRM's was not extractable.
- [/] **12.27** Detail pages for inventory nodes, periods, receipts, deliveries, price-book versions, import runs and webhook deliveries — **but two of these have no route behind them.** Inventory movements expose no GET (Q37) and document profiles have no GET-by-id (Q38). Build the detail pages that have a source and say plainly that the others do not; do not fabricate a path to fill the gap — **[/]** nodes, serials, inventory decisions, price-book versions, import runs and webhook deliveries have detail pages. Movements (Q37) and document profiles (Q38) have no route, and **periods and UOM conversions have no GET-by-id either** — recorded as **Q90**. Policy and workflow versions likewise have none (**Q91**), so the ladder runs from the definition list.
- [x] **12.28** Import partial-success result page — succeeded / failed / skipped rows. **Not downloadable: there is no route that returns the result file** (Q39). Render the outcome in the page and omit the download control rather than shipping a dead button. Note `TRADE.IMPORT.FILE_UNSAFE` is emitted at **five** different statuses (400/409/413/415/422), so the code alone does not tell you what happened

**Gate:** `pnpm verify` green · a policy drafted through the full governance
ladder to published · an import run end to end · a webhook delivered and
retried ·
**the eleven-state checklist in [../design/states.md](../design/states.md#per-screen-checklist) passed for every screen**.

---

## Phase 13 — Hardening and release

**10 / 27 done, 13 partial, 4 open.** Everything that must be true before this is a product.

- [/] **13.1** Security headers and CSP — Nginx Proxy Manager owns transport headers; the app owns CSP because the theme bootstrap script needs a per-request nonce. **The app half is built and driven; the Nginx half is a config change on a host I cannot reach, so this stays `[/]`.** D16 decided the policy, and 13.25 had already recorded that `security-headers.md` described a mechanism nobody built — there was no CSP string and no nonce in `src/proxy.ts` at all. There is now: a per-request nonce, the ten directives D16 settled, and `TENANT_CSP_REPORT_ONLY=1` so the rollout's non-optional report-only soak is a flag rather than a code edit. **Three things the spec got wrong, found by building it.** (1) It said to set the nonce on the **response** (`response.headers.set("x-nonce", …)`); Next reads it from the **request**, so that arrangement leaves `headers()` in the layout with nothing and blocks the bootstrap — silently. (2) It justified `style-src 'unsafe-inline'` as "Tailwind emits inline styles"; Tailwind v4 compiles to an external stylesheet and needs nothing. What forces it is `style` **attributes in server-rendered markup** — React `style={{…}}` in eight components plus Radix's positioning — which no nonce can ever whitelist. (3) The matcher only covered `/core`, `/crm`, `/trade`, so `/login` — the one screen handling a password — would have shipped with no policy. Widening it is the one genuinely load-bearing change: `proxy.test.ts` deliberately pinned those paths as *unmatched*, because a matched path with no allowlist entry redirected to `/unavailable` and shipped six screens unreachable (D22, Q40). Both module rules are therefore now gated on the module segment rather than on the matcher, and the test pins the behaviour instead. **Verified against a real `next build` + `next start`, not reasoned about**, because D16 asks for exactly that: every script carries the header's nonce including the bootstrap descriptor, React hydrates under `'strict-dynamic'`, the bootstrap's `lang`/`dir`/`--ui-scale` writes all land, a `setProperty` on `--color-brand-600` moves the token — the CSSOM claim D16 said to confirm rather than trust — and there were **zero** `securitypolicyviolation` events. Table of what each check does and does not prove in [security-headers.md](../architecture/security-headers.md#what-was-actually-driven-2026-08-31)
- [x] **13.2** Error boundaries — Next `error.tsx` and `global-error.tsx`. **There are none today** — there are now **six**. `global-error.tsx` re-declares everything the root layout would have provided (html/body, fonts, token stylesheet, providers), and four `(tenant)/**/error.tsx` boundaries share one `SegmentErrorScreen` so the shell and navigation survive a failed screen. The gap I closed on 2026-08-31 was the **root** `src/app/error.tsx`: every route outside `(tenant)` — `/login`, `/tenant/accept-invite`, `/tenant/reset-password`, the `(fence)` screens — had no boundary and unwound all the way to `global-error`, which *replaces* the root layout. A failed render on the login screen does not warrant losing the document. **The subtle part, and what its test pins:** `I18nProvider` is mounted by `TenantPortalRuntime`, not by the root layout, so a root boundary calling `useI18n()` throws and escalates one failure into two. Proven by removing the local provider — all five tests fail with `useI18n must be used within an I18nProvider`
- [x] **13.3** `loading.tsx` per route segment, or a documented decision not to — **decided: not to, and the reason is mechanical rather than aesthetic.** Next's `loading.tsx` is a Suspense fallback for a segment that **suspends**, and these segments do not: 117 of 120 `page.tsx` files are `"use client"`, and every one fetches in an effect through its own hook. A client component that fetches in `useEffect` never suspends, so the boundary would resolve immediately and the file would render nothing — 200 files that each do exactly nothing, while flashing a second loading representation ahead of the screen's own skeleton. The three server components (`core/page.tsx`, `trade/items/page.tsx`, `unavailable/page.tsx`) do no async data work either. **Revisit only if a route starts fetching on the server** — that is the condition under which this file type earns its place, and it is the thing to check rather than the count
- [x] **13.4** `not-found.tsx` — built, and it mounts `I18nProvider` locally for the same reason the root `error.tsx` does. It is also what `TenantHostAdmission`'s `notFound()` reaches, so it stands on its own rather than assuming the shell
- [x] **13.5** Offline and reconnect handling, driven by the realtime `server-draining` and `permanent-stop` events. Half of this shipped with 1.28 — `useConnectivity` and `OfflineBanner`, mounted once in `AppShell`. **The half that was missing is the one the events actually carry: *why*.** `permanent-stop` arrives with one of five `RealtimeApplicationStopReason` values; `useConnectivity` stored it in `stopReason` and **nothing read it**, so a connection replaced by another tab, access withdrawn, a workspace taken offline, a session that could not be renewed and an unreadable server message all rendered the same sentence — and two of the five are fixed by a reload while a third is not. Each now has its own line in both dictionaries, keyed by the wire value and typed against the **package's own union**, so a reason added upstream fails the build here rather than silently falling back forever. An unrecognised value still falls back: a wire value is never shown. The **reconnect** half is 13.6's mechanism — coming back online is one of the three signals it acts on
- [/] **13.6** Realtime resync — `realtime.sync.required.v1` must reconcile every open list, not only notifications. **`useRealtimeResync(reload)` is the one mechanism; ten lists opt in so far, which is why this is `[/]`.** The finding that shapes it: **the realtime protocol carries no entity change events at all.** Notifications and presence are the only live streams, so a lead, an opportunity or an invoice changes with nothing sent to say so — which makes three signals the entire staleness vocabulary the app has: an `ALL`-scoped sync, a **second or later** `session.ready.v1`, and the browser's `online`. Scope is read, not assumed: `NOTIFICATIONS` and `PRESENCE` are ignored because the notification runtime repairs its own cursor cache, and refetching 200 lists because a notification cursor went ambiguous is a self-inflicted request storm. That is exactly what `useConnectivity`'s `resyncCount` would have done — it counted every scope, patterns.md advertised `useEffect(refetch, [resyncCount])` as the way to refetch, and **nothing had ever read it** — so it was removed rather than left alongside as a documented footgun. Three behaviours are deliberate and tested: it never fires on mount (the connection a page loads with is not a reconnect, and counting it would double every list's first fetch); it holds a signal raised while the tab is hidden and runs it once on return; and it reads the callback fresh, so a `reload` whose identity changes with the filters neither resubscribes nor fires a stale closure. **Wired: `useTenantUsers`, `useTenantRoles`, `useOrganizationLevel`, `useAuditLedger`, `useActivities`, `useCustomerProfiles`, `useOpportunitiesList`, `useTradeDocumentList`, `useItems`, `useItemListings`.** ~87 hooks that return a `reload` remain, and they are a mechanical follow-up rather than a design one — one line each. `useNotificationInbox` is deliberately **not** wired: the notification runtime already owns that scope, and adding it would double-fetch the inbox on every `ALL`
- [/] **13.7** Session expiry UX — the four distinct terminal reasons need four distinct messages. **The screen already told the four apart; the code could not reach it.** That is Q18, and its **first half is now closed**: `endedReason` rides `TenantAuthContextValue`, set from the code `getAuthErrorCode` already read and then discarded, and the guard appends it to the `/session-expired` destination it was already choosing — validated against `isSessionEndingAuthCode` first, so a code the transport never produces cannot reach a URL. Both files are Tier-1 and both are covered by HANDOFF.md's second 2026-08-31 amendment. **Left `[/]` because the second half of Q18 is redirect logic in a spine file and is not this task's to make.** It is not academic, and building this found exactly when it bites: with a session id in `sessionStorage` the transport tries a refresh, the refresh fails definitively, `endTenantBrowserSession` publishes the same cross-tab tombstone another tab would send — carrying a session id and **no code** — and `AuthContext`'s own handler redirects to `/login`. So a session that ends **while the user is working** still loses both the reason and the screen. What does work today is the commonest path by far: `tenant_session_meta` lives in sessionStorage, so a user who closes the tab and comes back has a remembered cookie and no metadata, there is no session id to refresh, no tombstone is published, and the bootstrap failure — with its code — is the outcome. Both paths are pinned by tests, including the broken one, so closing it is a deliberate act
- [x] **13.8** Route-level code splitting audit; Trade must not ship in the Core bundle. **Measured, not assumed** — Next 16 with `--webpack` prints no size table, so the emitted chunks were read directly. **195 chunks; the 5 shared chunks every route loads carry no `trade/`, `crm/` or `core/` feature code at all.** Splitting is doing its job. The largest single chunk (1389.4 kB) is a route-level vendor bundle — recharts, date-fns, lucide, zod, sonner — so only routes that draw charts pay for it. **This is now asserted, not just observed**: the check is part of `build:budget` and any feature code appearing in a shared chunk fails the build outright, because Trade reaching a Core user is a splitting failure rather than a size one and no budget would catch it
- [x] **13.9** Bundle budget, recorded and enforced in CI — `scripts/build/bundle-budget.mjs`, wired into `pnpm verify` immediately after `build`. Three numbers, and the report says which one is a real user cost: **shared 526.6 kB / 600 budget** (paid by someone who only ever opens the login screen), **largest chunk 1389.4 kB / 1500**, **total 5325.7 kB / 6144**. Budgets sit just above the 2026-08-31 measurement so the gate catches growth rather than blessing it, and raising one is a deliberate act. **Proven to reject before being called done**: lowering the shared budget to 400 kB produced `FAIL shared chunks 526.6 kB exceeds 400.0 kB` and exit 1; restoring it returned exit 0. That step is not ceremony here — this project shipped a z-index lint rule that matched nothing and a `--ui-scale` token that inverted the layout, both with every gate green
- [ ] **13.10** Lighthouse pass on the five busiest screens, both languages
- [ ] **13.11** A real screen-reader pass — NVDA or JAWS — on login, one list, one detail, one form
- [ ] **13.12** Full keyboard traversal of every screen in the app
- [/] **13.13** Print stylesheet for every document detail screen. **Built in two halves, split by what each mechanism can express.** The shell hides itself with Tailwind's own `print:` variant — sidebar, topbar and skip link — because a component's own chrome is a component concern. `globals.css` gets only what a utility cannot say: `@page { margin: 12mm }`, an unclip rule for the shell's scroll containers, and **the rule this task actually turns on — undoing dark mode.** `.dark` sits on `documentElement` and survives printing, so an owner who works in dark mode and prints an invoice gets light text on a dark ground, which a printer renders as light text on **white**: a document that comes out looking blank. Twelve tokens are reset under `@media print`, not the whole ramp, so there is no second palette to keep in sync. **Verified in the compiled stylesheet** rather than assumed — `@page`, the `.dark` reset and `.print-document` all survive Tailwind, which is the check that `--ui-scale` and the Readex font each failed in their own way. **Left `[/]`**: no document has been printed, because printing one needs a session (P4), and `print-preview` is exactly the kind of claim this project has learned not to make from source alone
- [/] **13.14** Empty-state copy review — every one names the next action. **Audited 2026-08-31 across 46 files.** The headline number is misleading and worth stating: only **4 of 46** `EmptyState` call sites pass the `action` prop, which looks like a 42-screen gap and is not one. The copy carries the action instead — "Add a stage from the catalogue to make the board usable", "Add a company to start the hierarchy", "Widen the date range or clear a filter", "Create a version first; no ladder action can run before one exists", "Ask a workspace administrator to grant the one you need". **The rule needs one refinement rather than 42 edits:** an empty state does not need its own action button when the action is an **adjacent control already on screen** (attach a file, add a note) or when **no action exists** (an empty inbox — "Everything addressed to you will appear here"). Adding a button in those cases duplicates a control the user is already looking at. **Left `[/]`**: Phase 9 and the Phase 13 feature agent are still adding screens, and the review is only worth its name if it covers the final set
- [/] **13.15** Error-message review — all 95 error codes reach the user as something actionable. **The premise was stale, and finding that out was the first half of the work.** `docs/reference/error-codes.md` is generated, and its generator carries its own instruction: *"Add an area to `SCOPES` when a new screen ships."* Phases 4-12 shipped roughly 200 screens and nobody did. `SCOPES` still listed CRM's original eight modules plus core auth and notifications — so the reference described a fraction of the app while claiming to cover "the error codes the built screens can receive". **Extended to 36 areas** (every Core tenant module, the four newer CRM modules, and all fourteen Trade modules, each directory verified by listing the backends rather than guessed) and regenerated: **95 → 309 codes**. The review itself is now a real task against a real list, and is **left `[/]`** because reviewing 309 messages is only worth doing once Phase 9 and the Phase 13 feature work have landed their own
- [/] **13.16** `docs/generated/` regenerated, and `docs:verify-called-routes` green. **Both done 2026-08-31**: the route inventory was regenerated (569 routes — core 195, CRM 143, Trade 231) after it had gone stale, the API reference pages were regenerated after their `semantic` cross-link list was found to be missing five Core pages and all three Trade pages (so every generated page still told the reader "None yet. This app has no screen in the portal"), and `docs:verify-called-routes` now reports **182 distinct paths called, 182 in contract and documented, 0 fabricated, 0 undocumented**. **Left `[/]`** because it must be re-run once Phase 9 lands — it is a snapshot of a moving tree, and the value of this task is that it is true at release, not that it was true once
- [/] **13.17** Every `docs/api/*.md` page carries a truthful portal status and a fresh verification date. **Audited 2026-08-31 and it found two problems, not one.** The vocabulary was undefined and inconsistent — `built` / `live` / "live and tested" / `partial` / `not built`, with no page saying what any of them meant — and **`live` was an overclaim**: every phase from 4 through 8 closed its report with some form of *"nothing here has been exercised against a real authenticated session"*. `verified` was also carrying two meanings in the same project: on the index it meant "this page matches backend source", on the pages it read as "the portal works". Now four defined words, with contract status and portal status as separate columns, and an explicit statement that **nothing is `verified` yet** because P4 is blocked. The one exception is stated rather than glossed: the unauthenticated half of `core-auth` genuinely has been driven. **Left `[/]`**: the three Trade pages say `not built`, which is true today and will not be when Phases 10-12 land, so this has to be re-run at release
- [/] **13.18** `DEFECTS.md` — every D-item closed or explicitly deferred with a reason. **Audited 2026-08-31: thirteen of the twenty-two carried no status at all.** Each was checked against the current tree rather than assumed, and annotated with the evidence: D2 (45 animation utilities), D3/D4 (the pre-hydration bootstrap writes `.dark`, `lang` and `dir` before first paint), D5, D6, D7 (zero `.next/types` errors), D8, D10, D12 (zero `kanban` hits), D14 (`next build` compiles), D15 (the dev server was driven live today) are **fixed**. **D11 is narrowed, not closed** — 8A found its real cause was a missing scope header, not the gating shape, but `activities.update` is exposed by no capabilities endpoint (Q53), so that half is a backend gap. **D13 is superseded by a gate** rather than closed by hand. **D22 is open** and half-fixed. Statuses were written into each entry's **body, never its heading** — six headings carry inbound links keyed to their full slug, and renaming one has already broken links on this project once. **Left `[/]`**: D13 and D22 both resolve only when Phases 10-12 close
- [x] **13.19** `SKILL-AUDIT.md` — all 17 B-items marked implemented. The page already claimed all 17 had landed; **the claims were spot-checked against `src/` rather than accepted**, because B7 is precisely a case where this project marked a gate implemented while its selector matched nothing. Verified mechanically: `textEntrySize` on five input primitives (B1), `aria-sort` in `DataTableHeader` (B5), the skip link in `AppShell` (B6), `cursor-pointer` in `Button`'s base CVA (B8), `identifierText` using `wrap-anywhere` (B11), `AppToast` as `role="status"` (B14), `readOnlySurface` (B16), and the z-index selector that now actually fires (B7). Two apparent contradictions turned out to be **comments stating the rule** — `role="alert"` inside "never `role="alert"`" and `break-all` inside "deliberately NOT `break-all`" — the same text-scan false positive that made a census comment trip the census it described
- [ ] **13.20** Final census re-baseline at documented targets, and this plan's counters brought to 100 %
### Added by L2

- [/] **13.21** Global search results page across leads, parties, opportunities, items and commercial documents. `CommandPalette` searches the nav tree, not records. **Built at `/search`, and the enumeration came before the screen.** `PaginationQueryDto.search` is honoured **per endpoint**, and only four of the named families honour it: Core `directory/parties` (7 columns), CRM `leads` and `customer-profiles` (the party predicate — display/first/last/organization name plus any contact-method value) and CRM `opportunities` (**`title` only** — `searchableFields: ['title']`, so a deal found by its customer's name is not a result this route can return). Each section states its own match rule on screen, because "no results" means something different when the route reads one column. **Left `[/]`: two of the five named families cannot be searched at all**, and the screen says so rather than omitting them — `CatalogListQueryDto` has no `search`, and `POST /items/search` compares `canonical_code` with `=` (Q110); `DocumentListQueryDto` has no `search` key, so under `forbidNonWhitelisted` sending one is a 400, and the `POST …/search` routes on quotations and purchase-quotations take that same DTO (Q111). Also confirmed while enumerating: **CRM reminders accepts `search` and ignores it** — `RemindersQueryDto extends BranchListQueryDto`, and `listScopedReminders` passes `undefined` where the search tuple goes
- [/] **13.22** Export flow — CSV/XLSX from every list, PDF from every dashboard. **Zero coverage in the plan today.** **There is no backend export route** — all 569 Gateway routes were checked, and the only one matching export/csv/xlsx/download is `GET /crm/v1/attachments/:id/download`, which streams a stored attachment; every CSV/XLSX mention in the three services is **ingest**. So export is assembled client-side: `src/lib/export/csv.ts` (RFC 4180, unconditional quoting, formula-injection guard, UTF-8 BOM so Arabic survives Excel) and `src/lib/export/paged-export.ts` (a **bounded** sequential page walk — 5,000 rows / 50 pages — reporting progress and truncation). Wired to the 13.21 results with two separately named options, "Rows on this screen (N)" and "All matching rows (N)", and a cap notice **before** the download rather than a surprise in the spreadsheet. **Left `[/]` for three reasons.** (1) It reaches one list, not every list: the shared control belongs in `design-system/patterns/`, which this task was not permitted to touch — the follow-up is to lift `SearchExportControls.tsx` there and give `DataTable` an `onExport`. (2) **No XLSX**: it needs a heavy spreadsheet dependency and CSV needs none, so none was added. (3) **No dashboard PDF, because no route exists** — the twelve PDF routes are all Trade *document* renders, there is no dashboard render route anywhere, and Q36 makes even the document flow answer 502 at the Gateway
- [/] **13.23** First-run onboarding for a zero-data tenant: no companies, no branches, no pipelines, no items. **Built at `/getting-started`, with a first-run card on the workspace home for an account whose `accessibleBranches` is empty.** What such a tenant lacks is answerable from `/auth/me` at no request cost: `TenantAuthService.resolveAccess` builds `accessibleCompanies`/`accessibleBranches` for an **owner** as `SELECT id FROM companies`/`branches` with no user join, so an empty array is the tenant's own state — while `fetchPermissionKeys` hands that same owner **every** seeded permission. That pairing is the bug: every nav entry renders, every CRM list demands a `branchId` that does not exist, and the user lands on empty lists. Six ordered steps — company, branch, lead stages, opportunity stages, pipeline, items — each naming its next action (13.14's rule), each gated on the permission its own route declares, and `blocked` outranking `unauthorized` because a branch cannot precede a company for anyone. The owner and member readings of an empty scope list are stated separately rather than collapsed. **Left `[/]`: the Trade step is listed but not probed.** `GET /trade/v1/items` needs a resolved `TradeRequestContext` and `GET /trade/v1/uoms` is `BRANCH_REQUIRED` at the Gateway, so neither can answer before a branch exists, and a row reporting "unknown" for a reason the reader cannot act on is worse than one that simply names the action (Q112)
### Added by L5

- [/] **13.24** ★ **Test tasks for phases 4–13.** Q6 produced a written test strategy that the plan applies only to primitives. ~250 screens with no test task is not a plan. **Measured 2026-08-31, and the concern is real — just not in the shape the task predicted.** Every phase brief required tests and every phase wrote them: **1,333 tests across 153 files**. But sorting the app-level suites by *kind* is the finding:

  | Kind | Files |
  |---|---:|
  | Contract / parser | 47 |
  | Hook | 12 |
  | Component or screen | **2** |
  | Suites that actually render (jsdom) | **2** |

  **131 screens; 2 of them are ever rendered in a test.** The green gate is real but it is measuring parsers, not screens. That matters specifically because every feature phase's gate line reads "*the eleven-state checklist passed for every screen*", and every phase's own report caveated it the same way — "satisfied by construction and by unit test rather than by observation". Combined with **P4** (no authenticated session has ever existed), the eleven-state claim currently rests on **nothing executable**: not a render test, not a live pass. That is the honest status, and it is why no API page is marked `verified`.

  The remedy is a render test per screen family asserting the states that have no other proof — loading, empty, error+retry, 403, read-only — which is a phase of work, not a checkbox. **Left `[/]` with the gap stated rather than ticked**, because recording a known hole accurately is worth more than closing it on paper
- [x] **13.25** Split 13.1: decide the CSP **policy in Phase 0**, enforce it here. It currently lands seven phases after the runtime style injection (6.17) and the second bootstrap script (0.14) that it must permit. **Decided 2026-08-31 as D16, against the real code rather than a guess** — both consumers now exist. The fear behind this task does not survive contact: neither branding nor density injects markup. Both write through `element.style.setProperty`, a **CSSOM mutation**, which `style-src` never sees — so no `'unsafe-inline'` is forced. The only genuine exposure is the inline bootstrap `<script>`, which takes the nonce. Also recorded: `security-headers.md` says CSP is minted in `src/proxy.ts`, and **there is no CSP string or nonce in that file at all** — the doc describes a mechanism nobody built. Enforcement stays 13.1
- [x] **13.26** ★ A **runtime** gamut fitter and contrast checker for tenant branding. 6.18 assumes one exists; Phase 0's is an offline Node script that is never shipped. Without it, the contrast gate proves nothing about any real tenant from the moment 6.17 lands
- [x] **13.27** Carry Q13 (colocated screen shape is canonical) and Q14 (opportunities render raw ids, not names) forward into the build rules, so ~250 new screens do not re-litigate settled decisions. **Q13 was already carried** — `file-architecture.md` states the colocated shape in three places and no phase re-argued it. **Q14 was not, and the cost is measurable**: it was re-litigated **twice more**, as Q70 (Trade's operating-context selector rendering company and branch as ids) and Q83 (the supplier picker showing party ids). Both reached the same answer Q14 had already settled. Now a named rule in [patterns.md](../design/patterns.md), in priority order — never fabricate a name; use a purpose-built projection only where the contract says to; otherwise render the id through `identifierText` and **link it to its detail route**; null is the not-provided phrase; and **do not open a fourth question for it**

**Gate:** `pnpm verify` green · full manual pass in ar/en × light/dark ×
compact/default/comfortable · Lighthouse and screen-reader results recorded.

---

## Phase 14 — Absorbing the CRM audit

**12 / 14 tasks, 2 partial.** Added 2026-08-31 after the external CRM
documentation-vs-implementation audit. Reviewed and verified in
[CRM-AUDIT-REVIEW.md](CRM-AUDIT-REVIEW.md) — four of the audit's claims were
re-checked independently against source and a live PostgreSQL, and all four
held.

**Executing the phase corrected the review twice**, both recorded in
[section 4](CRM-AUDIT-REVIEW.md#4-what-phase-14-changed--re-run-2026-08-31):
P1-05 has **no backend half** — `dashboard-widgets.service.ts:102` already
coalesces `dto.querySpec ?? current.querySpec`, so omitting the key preserves
the spec — and the exposure is **three** templates and four widgets, none of
them a `MULTI_KPI` or a `COMBO`, which made the loss invisible rather than
merely possible.

**This phase is deliberately small.** The audit's subject is `crm-app`; most of
its findings are not this repository's to fix, and adding them here as portal
tasks would be the same category error the audit itself warns against. What
follows is what this repo owns, plus external dependencies labelled as such.

**Docs before code, and the ordering is load-bearing:** two of these items are
contract changes, and writing the contract first is what stops the portal and
the API disagreeing about what a partial update means.

### Documentation

- [x] **14.1** Record the audit and this review as the standing reference — done as [CRM-AUDIT-REVIEW.md](CRM-AUDIT-REVIEW.md); link it from [README](../README.md) and [HANDOFF](HANDOFF.md) so the next builder meets the verdict before the code. **Linked from both** — `docs/README.md`'s reading order as step 10, and a `HANDOFF.md` section that states what the review carries and that one of its own claims did not survive execution
- [/] **14.2** Write the ten decisions from the review into the documents that own them, **not** into a decision log nobody reads at build time: party-type immutability and blacklist stickiness into the CRM contract pages, default-stage authority into `crm-catalogues.md`, reminder recipient/lifecycle into the activities section. A decision recorded only in a review is a decision that will be re-litigated. **Six of ten placed, each with the source trace that settles it**: 1 party-type immutability → `crm-leads.md` (it is already enforced — `409 PARTY_TYPE_IMMUTABLE` at `party-directory.adapter.ts:195`, named in no doc and handled in no portal code); 2 blacklist stickiness → `crm-customer-profiles.md` (and crm-app does **not** honour it — two unconditional `ACTIVE_CUSTOMER` promotions on WIN); 3 default-stage authority → `crm-catalogues.md` (`defaultLeadStageId` is read by nothing; `leads.service.ts:1085` uses `isDefault`); 4 `fieldKey` scoping → `crm-catalogues.md`; 5 reminder recipient/lifecycle → parked in `docs/api/README.md`, **because the activities page named as its owner is one of the 26 that does not exist** (14.4); 6 editor scope → `crm-dashboards.md`. **Four not placed:** 7 attachment upload policy, 8 fresh-only release, 9 retention batching, 10 legacy source-read policy are backend and ops decisions with no portal document that owns them, and writing them into an API contract page would fabricate ownership
- [x] **14.3** Correct `docs/api/crm-dashboards.md` for the widget-update contract: `query_spec` is replaced **wholesale**, while `name` and `display_spec` are conditional. Say plainly that a client which sends a reconstructed spec destroys what it did not model — this is the doc that would have prevented D23. **Landed before 14.7.** The section names what is lost field by field, and adds two things the task did not anticipate: echoing the stored spec back is **not** a safe substitute for omitting it (`forbidNonWhitelisted` makes an unmodelled key a 400), and dropping `engine` silently demotes `schemaVersion` from 2 to 1
- [x] **14.4** Recount the "route-level documentation only" CRM routes. The audit found 26 against a tree that has since gained `crm-dashboards.md`; publish the real number and close the gap or state it. **Still exactly 26** (+1 Core), published in `docs/api/README.md` with the per-controller split — 11 activities, 9 notes/attachments, 6 outbound email. It did not move because **the 40 dashboard and widget routes were never among the 26**. The stale claim corrected in the same pass is worse than the number: that section said these families had "no portal screen", which stopped being true when Phase 8B built them. **Stated, not closed** — three contract pages is a phase, not a task
- [x] **14.5** Record the three external dependencies this portal is blocked by or exposed to, in [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md)'s backend-defect table beside Q17/Q36/Q72: the `FOR SHARE` outer-join rejection (audit P1-06, **reproduced here** on PostgreSQL 16.15), the unconditional `query_spec` replacement (P1-05), and the 78 Arabic permission labels that return English (P2-19). **Two recorded as defects, the third checked and dismissed.** [Q120](OPEN-QUESTIONS.md#q120--a-bare-for-share-with-a-left-join-is-rejected-by-postgresql--backend-defect) — source-traced to two portal-reachable commit paths, `POST /outbound-emails` and its retry, with the correct `FOR SHARE OF` form used 118 lines below in the same file. [Q121](OPEN-QUESTIONS.md#q121--78-of-98-crm-permission-labels-return-english-for-both-languages--backend-defect) — 78 of 98 recounted exactly; all 78 are the scoped permissions. **P1-05 is not a backend defect**: the coalescing at `dashboard-widgets.service.ts:102` means an omitted `querySpec` already preserves the stored one, so recording it as a dependency would have sent another team after a defect that is not there

### Code

- [x] **14.6** ★ **D23 — stop the widget editor destroying a query spec.** Guard the edit path: a widget whose stored spec carries more than one series, any filters, or a semantic engine is **not** opened in the single-series form. Render it read-only with a plain statement of why, rather than a form that silently narrows it. **`widgetSpecLimitations` names all five things the one-metric form cannot represent** — a second series, per-series `axis`/`label`/`color`, stored filters, the `SEMANTIC_V1` envelope, and `topN`/`maxPoints`. `widget-detail-workspace.tsx` withholds the Edit button and lists the specific reasons; the widget still renders, shares, clones and places
- [x] **14.7** Make `buildQuerySpec` preserve what it did not edit — carry the stored spec forward and replace only the fields the form owns. **Ordering: this lands with or after 14.3's contract correction**, never before it. **Landed after 14.3, and took the stronger option the contract work revealed**: rather than carrying the stored spec forward and re-sending it, `buildWidgetUpdate` **omits `querySpec` entirely** unless the user edited the query. Echoing it back cannot be made safe — `forbidNonWhitelisted` turns any stored key the DTO does not model into a 400 — while omission is exactly the server's `?? current.querySpec` path. A rename now sends `{ revision, name, visualizationType }`. This is the second of two independent guards: either one alone prevents the loss
- [x] **14.8** A test that fails without 14.6: load a two-series widget, submit a name change, assert both series and all filters survive. The existing `widget-form.test.ts` covers the *creation* filter (Q104) and not this path — which is exactly how the defect shipped. **Written first and run red before the fix existed: 6 failed, 9 passed.** The fixture is `TRENDS_COMPARISONS`'s real "Count & Estimated Value" widget copied from `dashboard-catalog.ts`, not an invented one. A seventh test documents the loss `buildQuerySpec` still produces, and passes before and after — it is the record of why, not a guard, and is labelled as such
- [x] **14.9** Fix the histogram unit (audit R5): a `BINNED_DISTRIBUTION` bin **count** is a record count and formats as a number, even when the metric's unit is `MONEY`. Bin **boundaries** stay currency. `numeric()` currently formats on the metric's unit alone. **A separate `count()` cell builder**; `numeric()` is untouched, so `WATERFALL` steps and `HIERARCHY` nodes still format as money — pinned by a test, because narrowing that too would have been the easy over-correction. Boundaries need no work: they arrive pre-formatted inside `bin.label`. Verified by reverting the one line and watching the test go red
- [x] **14.10** Guard the Arabic permission labels (audit R4): the backend fallback returns the identical English string for `en` and `ar`, so 78 labels render untranslated in Arabic. Until the backend fix lands, do not present a known-untranslated string as a translation — detect the equality and fall back to the permission key's own localized composition. **Detects the equality and marks the row; it does not compose a substitute.** The portal owns no permission vocabulary, and inventing Arabic for 78 backend-owned strings is the "never invent" rule broken rather than kept. **Scoped to permissions deliberately** — equality is only evidence of the fallback there; elsewhere in the catalogue `attachment_family.pdf` is legitimately "PDF" in both, and a blanket check would have libelled it. Marked in English too, because a missing Arabic label is a fact about the vocabulary this screen exists to document
- [x] **14.11** Re-verify the pagination fix holds across every CRM list, not just opportunities. `useOpportunitiesList` threw on every real response while its test passed; the regression guard exists there and nowhere else. **All 10 CRM paginated parsers read the flat shape; none requires `meta`.** They are `parseActivitiesPage`, `parseTasksPage`, `parseEventsPage`, `parseRemindersPage`, `parseCustomerProfilesPage`, `parseLeadsResponse`, `parseOpportunitiesListResponse`, `parseCrmNotesPage`, `parseCrmAttachmentsPage` and outbound email's `parseListResponse`. The dashboards and widgets lists are bare arrays, matching `accessibleDashboards`/`accessibleWidgets`. **Explicit reject-`meta` guards exist on 2 of the 10** — opportunities and tasks — not one as recorded; the other 8 are pinned only by feeding the flat shape. Adding the remaining 8 is a follow-up: those files are outside this task's ownership and no defect is present in them
- [x] **14.12** Update Q104 to point at D23. It recorded the creation limit and missed the edit path, and a reader who finds Q104 today concludes the gap is cosmetic. **Q104 now opens with what it missed and why the small half was misleading**, and its template count is corrected from nine single-series to eight. [Q105](OPEN-QUESTIONS.md#q105--the-semantic_v1-engine-is-not-offered-by-the-builder) needed the same treatment and got it: its claim that "editing one preserves its stored spec" was **false when written** and is true only now

### Verification

- [/] **14.13** ★ **Render tests for the states nothing else proves.** 13.24 measured it: 131 screens, **2** ever rendered in a test. Start with the five states no parser test can reach — loading, empty, error+retry, 403, read-only — on one screen per family. This is the gap that makes the eleven-state claim unearned. **One family done, not all of them.** `widget-detail-workspace.test.tsx` is the first render suite for a CRM analytics screen: 10 cases covering loading, 403, not-found-with-a-way-back, two distinct read-only paths, and the D23 guard. **It found a live defect on its first run**: a server 403 rendered a **blank page**, because the screen answered it with `<PermissionGate require="crm.widgets.read">{null}</PermissionGate>` — a client check that `page.tsx` had already passed, so it always rendered its `null` children. That is the whole argument for this task, and it is fixed. The remaining families are outside this phase's ownership; the empty state has no home on a detail screen and is covered on the list screen instead
- [x] **14.14** Re-run the audit's own portal checks after 14.6–14.11 and record the deltas, so the next audit starts from a known point rather than re-deriving it. **Recorded as [section 4](CRM-AUDIT-REVIEW.md#4-what-phase-14-changed--re-run-2026-08-31) of the review**, including the two places executing the phase proved the review itself wrong. The verdict is unchanged: **NOT READY**, and nothing here was exercised against a live authenticated session

**Gate:** `pnpm verify` green · D23 closed with a test that fails without the fix
· every decision in 14.2 present in the document that owns it · no task here
claims to have fixed anything in `crm-app`.

---

# Part 2 — The Five Verification Layers

The plan above is checked five times, each layer looking for a different class
of omission. Findings are recorded here, not silently patched into Part 1.

| Layer | Question it asks | Status |
|---|---|---|
| **L1 · Route coverage** | Does every one of the 569 Gateway routes map to a task? | **run** — 3 findings |
| **L2 · Page and state coverage** | Does every page have all its states — loading, empty, error, 403, degraded, offline, conflict? | **run** — not complete, 35 tasks added |
| **L3 · Component coverage** | Is every colour, button, modal, card, badge, form control and view accounted for? | **run** — 1 live bug fixed, 25 tasks added |
| **L4 · Cross-cutting coverage** | i18n, RTL, dark mode, a11y, permissions, idempotency, decimals — on every screen? | **run** — 4 findings |
| **L5 · Adversarial read** | What would a hostile reviewer say is missing or wrong? | **run** — 25 errors corrected, 2 shipped mistakes caught |

Each layer records its findings below. A layer that finds nothing records that
too — an empty result is evidence only if it was actually looked for.

---

## L1 · Route coverage — run 2026-08-30

**Method.** Mechanical, not a read-through. Every route in
`docs/generated/tenant-api-routes.json` was grouped into a family by
`app + first path segment`, then each family was matched against the plan text
through an explicit alias table.

**Result: 72 families · 72 covered · 569 of 569 routes reachable from a task.**
(First run found 1 uncovered family and 572/573; both closed, then re-run
against the regenerated inventory.)

Task-count integrity was checked in the same pass: all 14 declared phase counts
matched the actual checkbox count exactly, at **278 tasks**.

Re-checked **2026-08-31**, after the design-system merge: the plan now carries
**393 tasks**, and the claim above no longer held — four phase headers had
drifted from their own checkboxes (Phases 0, 4, 8 and 13), as had the summary
table's resolved counts for Phases 13 and 14. All six were recomputed from the
checkboxes and corrected. Phases 1, 2, 3, 5, 6, 7, 9, 10, 11, 12 and 14 were
verified to already agree.

### Findings

| # | Finding | Action |
|---|---|---|
| **L1-1** | `crm/static-data` (1 route) appears in no task. It is **already built** — `/crm/static-data-catalogue` ships today — but the plan never says so, which makes "already done" indistinguishable from "forgotten" | Add an explicit already-built inventory so nothing is assumed |
| **L1-2** | **2 routes must never get a UI** and the plan does not say so: `GET /public/fqdn-validation/:token` is `PLATFORM_VALIDATION_DO_NOT_CALL_AS_FEATURE_API`, and `POST /public/payments/webhook` is `EXTERNAL_CALLBACK_DO_NOT_CALL`. The real buildable surface is **571**, not 573 | Record the exclusion, with the reason |
| **L1-3** | **Trade dashboards (20 routes) + Trade widgets (11) + control-tower (4) = 35 routes are crammed into half of task 12.18.** CRM's comparable 40 dashboard routes got a whole phase (9). This is the single worst-scoped area of the plan | Split Trade analytics into its own phase |

---

## L4 · Cross-cutting coverage — run 2026-08-30

**Method.** 32 cross-cutting concerns were derived from the binding rules in
`AGENTS.md` and `docs/CONTRACT.md`, plus the route-contract metadata
(`routeClass`, `idempotencyMode`, `organizationScopeMode`). Each was searched
for in the plan text.

**Result: 30 of 32 covered.**

Volumes that shape the work, measured from the contracts:

| Metric | Value |
|---|---:|
| `WRITE_SENSITIVE` routes | 324 |
| `AUTHENTICATED` | 209 |
| `READ_HEAVY` | 23 |
| `PUBLIC` | 13 |
| **Mutating routes (non-GET/HEAD/OPTIONS)** | **355** — core 116, CRM 84, **Trade 155** |
| `BRANCH_REQUIRED` | 34 |
| `OPTIONAL_COMPANY_BRANCH` | 43 |

### Findings

| # | Finding | Action |
|---|---|---|
| **L4-1** | **The response-envelope rule is absent from the plan.** `AGENTS.md`: "Core wraps responses in `data`; **CRM does not**. Do not unwrap a CRM response through the Core helper." The plan builds 199 Core screens and 143 CRM screens and never states this once. It is the single easiest way to break every new screen | Add a task, and state the rule in each of phases 4–9 |
| **L4-2** | **429 / rate-limit handling is unplanned.** The Gateway rate-limits per user per route and **fails closed** — if Redis is unavailable it returns `RATE_LIMIT_UNAVAILABLE`, not a bypass. No task renders either case | Add a task |
| **L4-3** | **77 routes carry an organization scope requirement** (34 `BRANCH_REQUIRED`, 43 `OPTIONAL_COMPANY_BRANCH`) and the plan only mentions branch scope for CRM and a Trade operating context. Core's directory, activities and numbering are branch-scoped too | Make scope handling an explicit, named concern per phase |
| **L4-4** | **355 mutating routes need idempotency keys.** The transport auto-generates a UUIDv7 for every POST/PUT/PATCH/DELETE, which is correct — but 61 routes declare `idempotencyMode: WRITE_SENSITIVE`, meaning the Gateway *requires* a fingerprint. The plan mentions idempotency only in passing on three tasks | Add a task making the replay/conflict path a standing requirement |


---

## L2 · Page and state coverage — run 2026-08-30

**Method.** Every existing page read for the eleven states it can reach; every
planned screen checked for whether the plan states any state at all; the four
backend lifecycles grepped against the plan text.

**Verdict: not complete.** The plan was strong on *routes* and near-silent on
*states*. It creates ~70 screens across phases 4–12 and stated a behaviour for
16 — all of them HTTP error codes. Loading, empty, in-body 403, read-only,
offline, optimistic-rollback and stale-record-404 were stated for none.

### The structural finding

All state work was deferred to Phase 13. That meant the pattern would be
invented **250 tasks after the first 70 screens had already been built without
it**, then retrofitted 70 times. Fixed by moving the state components to Phase 1
and the state contract to Phase 3.

### Lifecycle states with zero rendering tasks

Grep over the original plan: `PROVISIONING` 0 hits · `SUSPENDED` 0 · `INVITED` 0
· `DEACTIVATED` 0 · `TRIAL` 0 · `CANCELLED` 0 · `READ_ONLY` 0 · `BLOCKED` 0.

| Lifecycle | Values | Was covered |
|---|---|---|
| Tenant status | PROVISIONING · PROVISIONING_FAILED · ACTIVE · SUSPENDED · DELETED | none — three of five fall to `notFound()`, and there is no `not-found.tsx` |
| User status | INVITED · ACTIVE · SUSPENDED · DEACTIVATED | filters only; INVITED had nothing |
| Subscription status | TRIAL · ACTIVE · PAST_DUE · CANCELLED | PAST_DUE only |
| Access mode | FULL · READ_ONLY · DUNNING · BLOCKED | DUNNING only, on billing only |

Access mode is the worst of the four because it is **cross-cutting** — it must
suppress every primary action, every drawer submit, every board drag and every
destructive confirm on all ~70 screens. There was no `useAccessMode()`, no
`ReadOnlyGate`, and no standing requirement.

### Live defects found in existing pages

| Page | Defect |
|---|---|
| all five list pages | **Error and empty stack on top of each other** — the banner renders while `DataTable` gets `error={null}` and an emptied `rows`, so the user sees "Unable to load" *and* "No leads yet" |
| `crm/leads`, `crm/opportunities` | **`Promise.all` turns one failure into three** — a capabilities 403 blanks the entire list |
| `useCustomerProfilesCapabilities.ts:72` | **Swallows every error and returns empty capabilities** — a network blip is indistinguishable from a genuine 403 |
| `usePipelineWorkspace.ts:622` | **"No pipeline configured" is classed as an error** — an unconfigured tenant gets a red banner where it needs an empty state with a create action |
| `opportunities-workspace.tsx:211` | **Board renders literally nothing** when `board` is null — no skeleton, no message, no error |
| `customer-profiles/[id]:55` | **A deleted record renders a retryable error** — retry can never succeed |
| `login/hooks/useLogin.ts:41` | **Fixed 2026-08-31 by 4.31.** One message for every failure — suspended account, suspended tenant, rate-limit and wrong password were indistinguishable |
| five pages | **Faked pagination** — `page={{ page: 1, limit: items.length, total: items.length }}` with a no-op `onPageChange` |
| `static-data-catalogue:66` | **`DegradedBanner` fires on success**, so a real degradation has nowhere to render |
| all 12 pages | **Zero offline handling** — `TenantRealtimeProvider` dispatches `server-draining`, `permanent-stop` and `resync-required` to **zero listeners** |
| `TenantAuthGuard.tsx:23` | **Partly fixed 2026-08-31 by 4.24.** The guard now sends an `ENDED` state to `/session-expired`; the reason code still cannot reach it — Q18 |

### Missing pages

`error.tsx`, `global-error.tsx`, `loading.tsx`, `not-found.tsx`,
`forbidden.tsx`, `unauthorized.tsx` — **none exist**. `TenantHostAdmission`
calls `notFound()` on the hot path today, so the missing file is already
user-visible as Next's unstyled English 404.

Also absent: session-expired, account-suspended, tenant-provisioning,
provisioning-failed, maintenance fence, entitlement-blocked, seat-limit-reached,
global search results, bulk-action surfaces, export flows, first-run onboarding,
and detail pages for ~20 list screens that had list-only tasks.

**Selection was built and abandoned:** 2.1 put `selection` in the contract and
2.5 added checkboxes, and nothing consumed them — no bulk bar, no bulk confirm,
no partial-result panel.

### Missing modals

The plan named **three** overlays across 278 tasks. Unnamed and required:
~20 edit drawers, ~20 delete confirms, ~30 governance-ladder reason dialogs,
8 picker dialogs, 6 upload dialogs, the deletion-blocker dialog, the atomic-
replacement diff confirm, the webhook one-time secret reveal, and the payment
interstitials.

**Every `FormDrawer` in the app today is create-only. No edit drawer exists.**

Two patterns the codebase already needs and does not have: the
**conflict-resolution dialog** (5.17 describes its content and names no
component) and the **ambiguous-outcome panel** — mandated by
`docs/design/patterns.md:224-233`, already detected by **seven hooks**, with
nowhere to render.

---

## L3 · Component coverage — run 2026-08-30

**Method.** Every token in `globals.css` traced to its consumers; all 23
primitives and 13 patterns checked against the plan; the anti-pattern list
checked against every component Phase 1 proposes.

**Verdict.** The plan was strong on views and on new components, and thin in
three places: **it treated the palette swap as a token edit rather than a
consumer sweep**, **it had no motion or icon workstream at all**, and **it never
separated the three meanings of "card"**.

### ★ Fixed immediately (a live bug in the change already applied)

`globals.css` elevation tokens hardcoded `oklch(0.174 0.020 240 …)` ×4 — a
hand-copied duplicate of the *old* `ink-950`. The ramp moved to
`oklch(0.175 0.028 240)` and the shadows did not follow. **Now re-derived
through `color-mix()` from `var(--color-ink-950)`, so a copy cannot rot again.**

### ★ Two enforcement holes that make colour drift invisible to `pnpm verify`

1. **`census.mjs:34` excludes all of `src/design-system/`.** Every hardcoded
   ramp step inside the design system is uncounted by every counter.
2. **`census.mjs:52-54` counts only the 22 Tailwind families.** `brand-*`,
   `ink-*`, `positive-*`, `caution-*`, `negative-*` are **not counted**. So
   "`colorUtilityTotal: 0`" does not mean "no raw ramp step in feature code" —
   roughly 30 ramp call sites in `src/app/(tenant)/**` survive a green census.
3. **The gradient counter cannot fire.** It matches `bg-gradient-to-`; the code
   uses Tailwind v4's renamed `bg-linear-to-r`. The baseline reads
   `gradients: 0` while one gradient exists.

Task 3.17's "drive the census to zero and re-baseline honestly" was therefore
not achievable as written. The census must be fixed first.

### ★ The palette change has ~25 unnamed consumers

Hardcoded ramp steps the original 0.10 eyeball list would not have caught:
`Button` hover fills for `primary`/`secondary`/`destructive` · the `link`
variant · the modal scrim in `AlertDialog`, `Dialog` and `Sheet` · all four
`AppToast` tone colours · `BoardColumn`'s role top-borders and count dot ·
`SubNav`'s active underline · six colours in `NotificationsDropdown` ·
`StatCard` · `ErrorState` · `UnavailableState` · `StatusBadge`'s pending dot ·
the `Badge` `200` borders.

**Task 0.6 was also wrong:** the dark badge pair is `{role}-300` on
`{role}-950`, not "`800` on `100`, light and dark". As written it checked the
light pair twice and never checked the dark badge.

### ★ Task 1.23 contradicted the spec

`tokens.md:278-292` states: *"There is no generic 5-slot categorical chart
palette, and one must not be invented."* Task 1.23 said "the categorical
sequence is defined once and is colourblind-checked" — precisely the invention
the spec forbids. The documented answer is roles-for-status plus **top-N +
Other on a single-hue `brand-200…brand-800` ramp** for qualitative breakdowns.

### Icons and motion: two missing workstreams

**Icons.** All five occurrences of "icon" in the plan were about *uploading an
icon file*. No size scale (46 `size-*` classes spanning six values with no
documented scale), no RTL-mirroring rule — and the codebase already disagrees
with itself, using `rtl:-scale-x-100` in three places and `rtl:rotate-180` in a
fourth — and no canonical icon-per-concept map for the ~200 screens ahead.

**Motion.** The plan contained one word about motion, and it was praise. The
reduced-motion carve-out is half-implemented: `motion.md:140` requires **two**
survivors, the pending dot and the spinner; only the dot is carved out, so every
`Button loading` spinner lands on an arbitrary rotation. `animate-bell-ring` is
orphaned outside the motion budget with a standing instruction to delete it that
no task carries. Four Phase 1 components add motion outside the budget —
`Accordion` needs a height transition that `motion.md:153` bans outright, and
recharts animates series on mount, which is the banned staggered entrance.

### "Card" means three different things

The plan never separated them, and the three defects that hides:

1. **Neither view uses the `Card` primitive** — `CardView` and `BoardCard` each
   hand-roll the same surface classes. Task 2.5 would have added a checkbox to
   both, making it a third and fourth copy.
2. **The two card surfaces disagree on radius** — `rounded-md` vs `rounded-sm`
   for the same logical object.
3. **Both hand-roll their focus ring** instead of composing `focusRing`, so both
   are missing `ring-offset-2` and render flush against the card border.

### Other findings worth carrying

- `DataTable`'s sticky z-indices are **inverted** relative to the documented
  ladder — `z-10` on the header, `z-20` on the cells. Task 0.18 said "replace
  every literal with the token" and would have faithfully preserved the bug.
- `Button`'s `disabled:pointer-events-none` makes the documented
  `disabled:cursor-not-allowed` **unrenderable**. Task 3.4 collides with it.
- **`PageHeader` appeared in zero tasks**, despite owning the one-filled-primary
  rule that every screen in phases 4–12 depends on. Task 1.18 builds a second
  header pattern beside it and never reconciles the two.
- `--radius-*` is in `rem`, so `--ui-scale` silently rescales it to
  1.8/3.6/5.4/7.2 px. §0.3's table omitted radius entirely.
- **`StatusBadge` calls `useI18n()` with no `"use client"`** — the one genuine
  unguarded client dependency in the design system, and task 0.2 covered only
  primitives. **Fixed, along with four other missed files.**
- `docs/design/primitives.md` says "21 files" and lists 23.
- `tokens.md#elevation-and-control-tokens` still declares the superseded
  28/32/36/40/44 px control scale and a warm-hue shadow.

---

## Two gates that never fired — found 2026-08-31

Both were shipped, marked done, and reported clean while matching nothing.

**1. The bare-`z-index` ESLint selector (task 0.19) — mine.** Written as
`"Literal[value=/\bz-(?:0|10|20|30|40|50)\b/]"`. Inside a **JavaScript string**,
`` is a backspace character (``), not a regex word boundary. The
compiled selector was therefore `/z-(?:0|…)/`, which no class name can
ever contain. It matched nothing from the moment Phase 0 added it, and Phase 0
recorded 0.19 as complete on that basis.

Fixed and **verified by making it fail**: a file containing `z-50` now errors.
A gate is not done when it is written; it is done when it has been seen to
reject something.

**2. The language-ternary selectors.** They only fired when a ternary branch was
a `Literal`, so a **nested** ternary slipped straight through —
`useCrmCustomFields.ts` carried hardcoded Arabic and English ambiguous-create
copy past a gate whose entire purpose is to catch exactly that. Selector
widened; the strings moved to both dictionaries.

Recorded because the shape repeats: **every enforcement rule in this repo needs
a proof that it can fail.** The census had the same problem in a different
form — it reported clean across a directory it could not see.

---

## Census re-baseline — 2026-08-31

Task 3.30 fixed the census; task 3.17 then re-baselined it. Recording the
numbers because the *shape* of the change is the finding.

**Every counter the old baseline gated is now zero**, and it banked violations
before:

| Counter | old baseline | now |
|---|---:|---:|
| `colorUtilityTotal` | 19 | **0** |
| `roundedXlOrAbove` | 4 | **0** |
| `fontBoldOrHeavier` | 3 | **0** |
| `handRolledButtons` | 5 | **2** |
| `languageTernaries` | 19 | **5** |

`languageTernaries` stops at 5, not 0, and that is the honest floor: `I18nContext`
must branch on language to pick the dictionary and the direction, and
`localizedName()` contains the syntax by definition. The target was never
reachable and is now written down as such.

**What the fix made visible is the real story.** The old census could not see
`src/design-system/` at all, and counted only the 22 Tailwind families — so the
five role ramps were uncounted everywhere:

| Newly visible | count |
|---|---:|
| `roleRampUtilities` in feature code | **82** |
| `roleRampUtilities` in the design system | **197** |
| `backdropBlur` in the design system | 3 (budget is 1) |
| `handRolledTables` in the design system | 3 |
| `gradients` in the design system | 1 |
| `rtlMirrorOutliers` | 1 |

None of that is new debt. It is debt the gate was structurally blind to while
reporting "clean" — which is exactly what task 3.30 existed to end. It is
banked so the ratchet stops growth; driving it down is follow-on work, and the
design-system scope needs its own thresholds rather than zero (the `Table`
primitive must use `<table>`; the modal scrims are a deliberate `backdrop-blur`).

---

## L5 · Adversarial review — run 2026-08-30

**Method.** Every numeric claim in the plan re-derived from source; every task
checked against the binding rules in `AGENTS.md`, `CONTRACT.md` and
`HANDOFF.md`; every open defect and question cross-checked; dependency order
walked.

**Verdict: the plan was wrong in 25 places and over-claimed in 10.** This is the
layer that earned its keep. Two of its findings had already shipped as code and
had to be reverted.

### ★ The two findings that caught shipped mistakes

**1 — The scale change silently did the opposite of its goal.** The first
implementation scaled the root font-size and rebased the type tokens by `1/0.9`
to compensate. Verification in the running app showed
`html { font-size: calc(100% * var(--ui-scale)) }` **never reached any
stylesheet** — Tailwind v4 strips it — while the compensating division *did*
apply. Net effect: the interface rendered **11 % larger**, with `typecheck`,
`lint`, `build`, `census` and `contrast` all green. L5 independently flagged
that the same rule is a **banned selector** in that file. Reimplemented by
scaling the geometry tokens directly; re-verified live.

**2 — The headline payoff was wrong arithmetic and contradicted the repo.**
The plan claimed "14 rows → 16 at 0.9". `geometry.md` says the *current*
density already fits 16. Measured live by driving `--ui-scale` in the running
app: **14 → 15**, one row. Both numbers now carry their chrome budget.

### Factual errors corrected

`671`→670 lines · `9`→10 ESLint selectors · board `3 files/242 lines`→4/254 ·
`twelve pages`→16 route files · Phase 4 `47`→**54** routes · Phase 5 `21`→**33**
· Phase 6 `25`→**23** · task 12.15 `11`→**5** routes · `21 contrast claims`→14
in the file, 22 after this phase · G8 `16`→15 data ternaries ·
G9 `22 of 25 primitives`→**20 of 23** · 6.17 "only two brand consumers"→
**three** (`--sidebar-active` is the third) · §0.2 was **light-mode only** and
never said so; `.dark` binds `--primary` to `brand-400`.

**And one that broke the plan's own cardinal rule:** G2 listed
`logoStorageKey` and `iconStorageKey` as fields on the public branding payload.
**They do not exist.** The payload carries `loginHtml` instead, and the logo and
icon are separate binary routes. Inventing a DTO field is the exact thing
`AGENTS.md` forbids, in the document that exists to enforce it. Corrected
against `swagger.examples.ts` and `update-branding.dto.ts`.

### Binding-rule violations found

| Rule | Violated by | Resolution |
|---|---|---|
| "Element selectors beyond `body` and `html[lang]`" banned in `globals.css` | the original 0.11 | Reimplemented without any element selector |
| **Tier 1 — `src/components/auth/` do not touch** (`HANDOFF.md`) | 3.12–3.14 | Must amend `HANDOFF.md` explicitly, not silently rewrite |
| "`fetch` in exactly one file" + "no simulated success" | 1.7 `FileUpload` "per-file progress" — `fetch` cannot report upload progress; only `XHR` can | Must decide: amend the one-fetch rule, or ship no progress bar. A fake one violates two rules |
| "Never invent a DTO field" | G2 (above) | Corrected |
| "At most one filled primary per screen" | 11.5, 11.14, 12.13, 12.14 — document headers with 6–8 lifecycle actions | Needs a stated rule for multi-action headers |
| "Files under ~300 lines" | **8 files already exceed it**, two by 3× (`axiosClient.ts` 1141, `usePipelineWorkspace.ts` 1021) | No task addressed it |
| "Every CRM list requires `branchId`" | Phases 8 and 9 never mention it | Covered by S2, needs per-task carry-through |

### One L5 finding that was itself wrong

L5 reported that no `ErrorState title=""` existed and that task 2.11 was
over-specified. **It did exist, twice** — `BoardView.tsx:93` and
`CardView.tsx:48` both rendered `<ErrorState title={errorTitle ?? ""}>`. Found
by the Phase 2 agent while implementing 2.11, and removed along with the
`EmptyState` pair; `emptyTitle` and `errorTitle` are now required props so a
blank heading cannot compile.

Recorded because the claim was carried into this document unverified. An
adversarial layer is still a source to check, not a source to trust.

### Over-claims struck

- "measured" on a number the same document schedules taking (fixed above).
- "`knip` clean" as a Phase 1 gate — the barrel is a knip entry point, so every
  new export is invisible to it **by construction**.
- "no `Number()` on any decimal, **proven by grep**" — `+value`, `parseFloat`
  and `value * 1` all coerce and none match `Number(`.
- "Enforcement is real, not aspirational" — the census **does not scan
  `src/design-system/`**, so the largest ratchet is blind to its own subject.
- Part 2 presented a five-layer verification table with **nothing under it**.
  Now populated.

### Dropped items recovered

**Q4 is still open and the plan made it worse.** Whether Readex Pro's Arabic
fits a **36 px** row at `text-xs` is the repo's own named "last unverified
visual assumption" — and 0.11 takes the row to **32.4 px** without mentioning
it. Now a blocking prerequisite of the scale change.

**Q11 was silently overturned** — the shell tokens 44/232/48 were settled by
human decision on 2026-08-28 and 0.11 changes all three. Recorded as a
deliberate reversal in `DECISIONS.md`, not a silent one.

Also dropped and now scheduled: **G13** (`sortDir` vs `sortDirection`, blocking
7.10), **G19** column resize and reorder, **G20** the rich-text editor and
`loginHtml`, **G22** `Slider`, **D8**'s fresh-checkout verification, the
**B7** label, **Q6**'s test strategy (~250 screens had zero test tasks), and
**15 routes assigned to no phase** — `provisioning` 3, `public` 3,
`activity-types` 1, 8 of 11 `auth`, `catalog` 1, `decisions` 1.

### Phase-shape problems

- **Phase 12 held ~127 routes behind 18 tasks** — more than Phases 4+5+6
  combined. Now 28 after the L1-3 split, still the largest.
- **Phase 0 is four unrelated workstreams behind one gate**, and "nothing else
  starts until this gate is green" makes any wobble block all 350 remaining
  tasks. 0.1–0.3 landed first as a de-facto Phase −1.
- **2.7 — the WCAG AA fix, the plan's own "highest-severity item" — sits in the
  same gate as the virtualization work**, whose interaction with
  `@hello-pangea/dnd` is unproven. If 2.8 fails, the accessibility fix ships
  never.

### Risks it named that the plan had not

1. **The palette swap has no gate that can catch a regression** — 57 values,
   22 Tailwind families repainting at once, and the only control was one human
   looking at 64 screen combinations. Partly closed: `contrast.mjs` now parses
   `globals.css` and covers all 57 steps with a build-failing gamut assertion.
2. **`--ui-scale` vs the 44 px touch floor** — at 0.9 the default control is
   28.8 px, and `hitArea`'s 6 px expansion reached only 40.8 px. **Fixed:**
   widened to 8 px → 44.8 px.
3. **`--ui-scale` does not move breakpoints** — content shrinks, reflow points
   do not, so every `sm:`/`md:` boundary now fires at a different density.
4. **Virtualization vs `@hello-pangea/dnd`** — the library supports windowing
   only through a specific `mode="virtual"` + `renderClone` contract exercised
   against `react-window`. Pairing it with a headless virtualizer is unproven.
5. **The branding runtime override permanently defeats the contrast gate** —
   from the moment 6.17 ships, `--color-brand-*` is tenant data and a
   build-time Node script proves nothing about what a real tenant sees.
6. **`tenant-portal` has no lockfile of its own** — `../pnpm-lock.yaml` is
   shared with `admin-portal` and `partner-portal`. Task 1.1 adds ~10 packages
   to a lockfile two other products depend on.
7. **CSP (13.1) lands seven phases after the runtime style injection it must
   permit** (6.17) and the second inline bootstrap script (0.14).
