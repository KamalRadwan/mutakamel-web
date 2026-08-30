# Tenant Portal — Master Plan

Written: **2026-08-30** · Owner: **Kamal Radwan** · Status: **not started**

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
| No-flash theme and direction | A pre-hydration `beforeInteractive` script sets `lang`, `dir` and `.dark` before React runs |
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

Phase 2 fixes this with one generic `WorkspaceView<T>` contract that all three
implement, owning pagination, sorting, selection and scroll restoration once.

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

| Phase | Title | Tasks | Done |
|---|---|---:|---:|
| 0 | Design system correction | 34 | 26 |
| 1 | Design system completion | 50 | 0 |
| 2 | The three views, properly | 18 | 0 |
| 3 | Accessibility, cross-cutting mechanisms | 40 | 1 |
| 4 | Core · identity and organization | 34 | 0 |
| 5 | Core · settings and catalogues | 19 | 0 |
| 6 | Core · billing, subscription, branding | 21 | 0 |
| 7 | Core · directory, templates, audit, activities | 23 | 0 |
| 8 | CRM · completion | 27 | 1 |
| 9 | CRM · dashboards and widgets | 15 | 0 |
| 10 | Trade · foundation | 21 | 0 |
| 11 | Trade · commercial documents | 22 | 0 |
| 12 | Trade · advanced and analytics | 28 | 0 |
| 13 | Hardening and release | 27 | 0 |
| | **Total** | **379** | **28** |

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

**26 / 34 done.** Fixes the user-facing complaints and the broken foundations
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
- [ ] **0.9** Verify the theme flip still maps correctly — all 22 Tailwind families remapped onto the new ramps
- [ ] **0.10** Look at every existing screen in light and dark, Arabic and English. The primary button, the focus ring, every badge tone, the sidebar active marker, the zebra row

### Scale — 90 %

- [x] **0.11** Add `--ui-scale` to `:root`, default `0.9`, and `html { font-size: calc(100% * var(--ui-scale)) }`
- [x] **0.12** Rebase the seven type tokens by `1/0.9` so effective rendered size is unchanged, and rebase the Arabic lift in `html[lang="ar"]` in lockstep
- [x] **0.13** Verify every geometry token lands where §0.3 predicts, and that the 13 px Latin / 14 px Arabic floors still hold at the rendered size
- [ ] **0.14** Add the density preference — Compact 0.9 / Default 1.0 / Comfortable 1.1 — persisted like the theme, applied in the same pre-hydration bootstrap script so there is no flash
- [ ] **0.15** Add the density control to the user menu, with both dictionary keys
- [x] **0.16** Re-measure rows-visible at 1366×768 and record the real number in `geometry.md`

### The missing z-index scale

- [x] **0.17** Add the six `--z-*` tokens to `globals.css` (G1): `sticky-cell 10 · sticky-header 20 · topbar 30 · dropdown 40 · overlay 100 · toast 1000`
- [x] **0.18** Replace every literal `z-50` / `z-10` / `z-20` in the primitives and `DataTable` with the token
- [x] **0.19** Add an ESLint `no-restricted-syntax` selector banning bare `z-<number>` outside `src/design-system/`, and a census counter for it
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

- [ ] **0.31** ★ **Blocking prerequisite of the scale change (Q4).** Open a populated table in **Arabic** and look at `text-xs` in a 32.4 px row. This is the repo's own named "last unverified visual assumption", it was never checked at 36 px, and 0.11 shrinks the row. If Readex Pro's Arabic does not fit, switch to **Zain** — the recorded fallback
- [x] **0.32** Widen `hitArea` from 6 px to 8 px — at 0.9 the default control is 28.8 px and 6 px reached only 40.8 px, under the 44 px floor the helper exists to clear
- [ ] **0.33** Record the `--ui-scale` breakpoint consequence: content shrinks, `sm:`/`md:` reflow points do not move, so every responsive boundary now fires at a different content density. Check the shell and one dense table at each breakpoint
- [x] **0.34** Record Q11's reversal in `DECISIONS.md` — the shell tokens 44/232/48 were settled by human decision on 2026-08-28 and this phase changes all three

**Gate:** `pnpm verify` green · one real page load in ar/en × light/dark ·
`contrast.mjs` reports all claims passing and zero out-of-gamut steps.

---

## Phase 1 — Design system completion

**0 / 50 done.** Builds the components the rest of the plan depends on. Every
one is generic, prop-driven, bilingual and themed — no entity knowledge.

### Dependencies

- [ ] **1.1** Add `react-day-picker` + `date-fns` (G14), `cmdk` (G21), `recharts` (G17), `@radix-ui/react-accordion`, `-collapsible`, `-toggle-group`, `-progress`, `-hover-card`, `-context-menu` (G22), `@tanstack/react-virtual` (G19)
- [ ] **1.2** Decide and record: `react-hook-form` + `zodResolver` for forms (G23), or keep hand-rolled. If adopted, `FormDrawer` becomes its host

### Primitives

- [ ] **1.3** `DatePicker` — single date, locale-aware via `Intl`, Arabic uses `ar-EG-u-nu-latn` (Western digits), RTL-mirrored, keyboard-navigable
- [ ] **1.4** `DateRangePicker` — from/to with presets (today, last 7/30/90 days, this month, this quarter)
- [ ] **1.5** `Combobox` — single-select with type-ahead over a large remote list, debounced, with loading and empty states
- [ ] **1.6** `MultiSelect` — chips inside the trigger, overflow collapses to "+N", clear-all
- [ ] **1.7** `FileUpload` — drag-and-drop plus click, MIME allowlist, size cap, per-file progress, preview for images. Backend caps: branding 2 MB, party image 2 MB, template asset 5 MiB, CRM attachment 26 MiB
- [ ] **1.8** `Stepper` — horizontal, numbered, with per-step valid/invalid/current state and RTL ordering
- [ ] **1.9** `Progress` — determinate and indeterminate, with `role="progressbar"` and full ARIA values
- [ ] **1.10** `Accordion` and `Collapsible`
- [ ] **1.11** `ToggleGroup` — and refactor `ViewSwitcher` onto it, since it currently hand-rolls a segmented control on `RadioGroup`
- [ ] **1.12** `HoverCard` and `ContextMenu`
- [ ] **1.13** `Textarea` gains the `size` variant it is missing, matching `Input` and `SelectTrigger`
- [ ] **1.14** `CopyButton` — for the UUIDs, correlation IDs and cursors this product shows constantly. With `aria-live` confirmation
- [ ] **1.15** `Money` — renders a decimal **string** with `Intl.NumberFormat`, `tabular-nums`, never `Number()`. This is a correctness primitive, not a style one
- [ ] **1.16** `DateTime` — same discipline for timestamps, explicit locale, `<time dateTime>`

### Patterns

- [ ] **1.17** `FilterBar` gains real filter types (G5): select, multi-select, date range, numeric range, boolean. Chips overflow behind "+N" (audit B12)
- [ ] **1.18** `DetailHeader` — title, subtitle, status badge, back link, action cluster. Every detail screen in phases 4–12 uses it
- [ ] **1.19** `DetailSection` — a labelled field group for read-mostly detail bodies
- [ ] **1.20** `Timeline` — for audit history, stage history, delivery attempts, approval ladders
- [ ] **1.21** `AttachmentList` — list, upload, download, delete; built on `FileUpload`
- [ ] **1.22** `CommandPalette` — Ctrl/Cmd+K, navigates the permission-filtered nav tree (G21)
- [ ] **1.23** `Chart` wrappers — line, bar, area, donut, sparkline. Colours come from the four role ramps only; the categorical sequence is defined once and is colourblind-checked (G17)
- [ ] **1.24** Every new primitive and pattern gets: both dictionary keys, a `.test.tsx`, an entry in `docs/design/primitives.md` or `patterns.md`, and an export from the barrel
### State components — added by L2 (build before any screen consumes them)

- [ ] **1.25** ★ `ConflictDialog` — the 409/412/428 resolution surface: what you changed, what they changed, reload-and-reapply / overwrite / cancel. Blocking for 5.9, 5.17, 7.13, 7.22 and every editable resource
- [ ] **1.26** ★ `AmbiguousOutcomePanel` — persistent, in-body, carrying the operation, the idempotency key and a retry-exact affordance. Mandated by `patterns.md`; **seven hooks already detect the condition and have nowhere to render it**
- [ ] **1.27** `NotFoundState` — a deleted record reached from a stale link, with a back-to-list action and **no retry button**
- [ ] **1.28** `OfflineBanner` + `useConnectivity()` — subscribes to the `tenant-realtime:*` events `TenantRealtimeProvider` already dispatches to **zero listeners**. Mounted in `AppShell`
- [ ] **1.29** ★ `useAccessMode()` + `ReadOnlyGate` — one source of truth for FULL / READ_ONLY / DUNNING / BLOCKED that suppresses every mutating affordance. Consumed by every screen in phases 4–12
- [ ] **1.30** `BulkActionBar` + `BulkConfirmDialog` + `BulkResultPanel` (partial success: "38 of 50 succeeded, here are the 12"). Without these, 2.1's selection and 2.5's checkboxes are dead code
- [ ] **1.31** `ReasonDialog` — promote `TerminalMoveDialog` to a pattern. Consumed by 10.18, 11.5, 11.10, 11.11, 11.14 and the ~30 governance-ladder actions
- [ ] **1.32** `AsyncJobState` — queued / running / succeeded / failed / artifact-expired, with polling. Consumed by 7.17, 11.7, 11.12, 11.15
- [ ] **1.33** `useUnsavedChangesGuard()` — page-level route guard; `FormDrawer` guards drawer close only
- [ ] **1.34** Extend `StatusKind` in `tone-map.ts` with `TenantStatus`, `UserStatus`, `SubscriptionStatus` and `AccessMode`, sourced from the backend enums, never guessed
- [ ] **1.35** `EditDrawer` — every `FormDrawer` in the app today is **create-only**; ~20 edit drawers in phases 4–12 need one shape
- [ ] **1.36** `DeletionBlockerDialog` — `ConfirmActionModal` has no slot for a list of blocking children. Required by 4.10
- [ ] **1.37** `AtomicReplacementConfirm` — a pre-write diff for the full-replacement PUTs in 4.15 and 4.21, the most destructive writes in Core

### Added by L3

- [ ] **1.38** ★ **Rewrite 1.23.** It contradicts `tokens.md`, which forbids inventing a categorical chart palette. Correct rule: status breakdowns use the four roles; qualitative breakdowns use **top-N + Other on a single-hue `brand-200…brand-800` ramp**; `caution` and `negative` are never adjacent fills; recharts mount animation disabled
- [ ] **1.39** Apply the FilterBar overflow rule to `MultiSelect` — the `+N` collapse is a **button** opening a popover of removable chips, never a static count
- [ ] **1.40** Decide and record how `react-day-picker` is styled without importing its stylesheet, and how `cmdk`'s `[cmdk-*]` attribute selectors coexist with the no-component-stylesheet rule
- [ ] **1.41** ★ An **icon system**: a size scale tied to `controlSize`; one RTL mirror mechanism (`rtl:-scale-x-100`) with a lint selector and a census counter; and a canonical icon-per-concept map. Fix the `rtl:rotate-180` outlier
- [ ] **1.42** ★ A **motion budget extension** covering `Accordion`/`Collapsible` (and the height-transition ban), `Progress` indeterminate plus its reduced-motion carve-out, the new overlays' 120/90 ms pair, and chart mount
- [ ] **1.43** Reconcile `DetailHeader` (1.18) with `PageHeader` on the one-filled-primary rule — state which owns the primary action
- [ ] **1.44** State on `Stepper` and `Timeline` that step and event **type never takes a hue**
### Added by L5

- [ ] **1.45** ★ Resolve `FileUpload` progress before building it: `fetch` cannot report upload progress, only `XHR` can — and the rule is "`fetch` in exactly one file". Either amend the rule for the upload path, or ship no progress bar. **A fake progress bar violates two rules at once**
- [ ] **1.46** ★ De-risk 2.8 **before** the dependency choice is locked: prove `@hello-pangea/dnd` + `@tanstack/react-virtual` in a throwaway branch, or switch to `react-window`, which is what the dnd library's virtual mode is actually exercised against. Name the fallback
- [ ] **1.47** `Slider` (G22) — listed as missing and then scheduled nowhere
- [ ] **1.48** Rich-text editor (G20) for `loginHtml` and email templates — identified as missing and scheduled nowhere. 6.15 omits `loginHtml` entirely
- [ ] **1.49** `DataTable` column resize and reorder (G19) — only the virtualization third of that gap was scheduled
- [ ] **1.50** Note in 1.1 that `tenant-portal` has **no lockfile of its own** — `../pnpm-lock.yaml` and `../pnpm-workspace.yaml` are shared with `admin-portal` and `partner-portal`. Adding ~10 packages affects two other products

**Gate:** `pnpm verify` green · every new component rendered in ar/en × light/dark · zero new census regressions. **`knip` is not a meaningful gate for this phase** — `src/design-system/index.ts` is a knip entry point, so every new barrel export is invisible to it by construction.

---

## Phase 2 — The three views, properly

**0 / 18 done.** Fixes V1–V5 from §0.5.

- [ ] **2.1** Define `WorkspaceViewProps<T>` — one generic contract: `items`, `itemKey`, `isLoading`, `error`, `onRetry`, `emptyState`, `page`, `onPageChange`, `sort`, `onSortChange`, `selection`, `onActivate`, `labels`. All three views implement it (V1)
- [ ] **2.2** Adapt `TableView` to the shared contract while keeping `DataTable` as its engine
- [ ] **2.3** Add pagination to `CardView` and `BoardView` via the shared contract (V2)
- [ ] **2.4** Add sorting to `CardView` — a sort control in the toolbar, since there are no column headers to click
- [ ] **2.5** Add selection to `CardView` and `BoardView` — a checkbox affordance on the card, driven by the same `SelectionState`
- [ ] **2.6** Preserve page, sort, filters and selection **across a view switch** (V2). The URL already carries `?view=`; extend it to carry the rest
- [ ] **2.7** **Add a "Move to…" action on every board card** (V3, audit B3). A `DropdownMenu` listing every permitted target column. This is the WCAG AA fix and the single highest-severity item in the plan
- [ ] **2.8** Virtualize board columns above 50 cards with `@tanstack/react-virtual` (V4) — the behaviour `SKILL-AUDIT` already claims exists
- [ ] **2.9** Virtualize `CardView` above 100 items, and `DataTable` above 100 rows
- [ ] **2.10** Give `BoardCard` `role="button"` and disambiguate click from drag with a movement threshold (V5)
- [ ] **2.11** Remove the `EmptyState title=""` and `ErrorState title=""` fallbacks (G24). Make the label props required so a blank heading cannot compile
- [ ] **2.12** Scroll restoration on back-navigation for all three views (audit B15)
- [ ] **2.13** `aria-sort` on every sortable `DataTable` header (audit B5)
- [ ] **2.14** Sticky chrome must not obscure the keyboard-focused row (audit B4) — `scroll-margin` on the sticky header and column
- [ ] **2.15** Update `docs/design/views.md` to describe the real shared contract, and delete the claims that no longer match the code
### Added by L3

- [ ] **2.16** ★ Make `CardView` and `BoardCard` compose the `Card` primitive and `focusRing` instead of hand-rolling both; settle **one** radius for a card object; replace both template-literal `className`s with `cn()`. Do this **before** 2.5 adds a checkbox to each, or the duplication doubles
- [ ] **2.17** State how `@tanstack/react-virtual` composes with the Radix `ScrollArea` viewport that board columns scroll inside — the classic broken-measurement pairing
- [ ] **2.18** ★ **Ship 2.7 on its own, before 2.8.** It is the plan's highest-severity item (the WCAG AA failure) and it currently shares a gate with the riskiest change in the plan. If virtualization stalls, the accessibility fix must not stall with it

**Gate:** `pnpm verify` green · `/crm/leads`, `/crm/opportunities` and
`/crm/customer-profiles` exercised in all three views, both languages, both
themes · a card moved by mouse, by keyboard, and by the new Move-to menu.

---

## Phase 3 — Accessibility and cross-cutting mechanisms

**1 / 40 done.** All 17 are specified in `SKILL-AUDIT.md` and none are coded.
B3, B4, B5 and B15 are delivered in Phase 2; the rest are here.

- [ ] **3.1** B1 — inputs render at 16 px below `sm` (`text-base sm:text-sm`) on `Input`, `Textarea`, `SelectTrigger` and the `FilterBar` search. Stops iOS Safari auto-zoom on every focus
- [ ] **3.2** B2 — move focus to the first invalid field after a failed submit, in `FormDrawer` and every form
- [ ] **3.3** B6 — a skip link as the first focusable element in `AppShell`, and an `id` on `<main>`
- [ ] **3.4** B8 — `cursor-pointer` specified and applied on `Button` and every interactive surface
- [ ] **3.5** B9 — autofill and password-manager support on `/login`: correct `autocomplete`, `name` and form semantics
- [ ] **3.6** B10 — validate on blur, never on keystroke
- [ ] **3.7** B11 — a wrapping rule for UUIDs and correlation IDs so they cannot overflow their container
- [ ] **3.8** B13 — announce the notification badge count with `aria-live`
- [ ] **3.9** B14 — the toast accessibility contract: `role`, `aria-live`, dismiss timing, focus behaviour
- [ ] **3.10** B16 — `readOnly` renders distinctly from `disabled` on every input
- [ ] **3.11** B17 — a `max-w` prose measure so long descriptions do not run the full width
- [ ] **3.12** Convert `TenantAuthGuard` onto the design system (G11, D16) — tokens, both dictionaries, no hand-rolled `<button>`
- [ ] **3.13** Convert `TenantHostStateBoundary` the same way (G11, D16)
- [ ] **3.14** Remove `src/components/auth/**` from the ESLint exclusion once 3.12 and 3.13 land
- [ ] **3.15** Create `src/lib/format/localized.ts` with `localizedName(item, lang)` (G8) and route all 16 inline data ternaries through it
- [-] **3.16** Settle whether bilingual **data-field** selection is exempt from the zero-ternary rule — **already settled** in `i18n.md`, which states the exemption and makes `localizedName()` mandatory. 3.15 still builds the helper
- [ ] **3.17** Drive the census to its documented targets and **re-baseline honestly** (G7) — `colorUtilityTotal 0`, `roundedXlOrAbove 0`, `handRolledButtons 0`, `fontBoldOrHeavier 0`. **`languageTernaries` cannot reach 0**: `I18nContext` must branch on language to pick the dictionary and `dir`, and `localizedName()` contains the syntax by definition. Baseline at the real floor (~4) with the exempt sites named on the line, or the task gets closed dishonestly. Depends on 3.30
- [ ] **3.18** Render `PermissionGate` wherever a 403 is reachable in-body (G3), so the mandated 403 surface stops being dead code
- [ ] **3.19** Keyboard-only pass over every existing screen: tab order, visible focus, no trap, Escape closes, Enter activates
- [ ] **3.20** **Envelope discipline (S1, L4-1)** — make the Core `unwrapCoreData<T>()` helper impossible to apply to a CRM response. Type-level separation, plus a test that a CRM payload through the Core helper fails to compile
- [ ] **3.21** **429 and rate-limit handling (S9, L4-2)** — a distinct, retryable surface for `429`, and a separate one for `RATE_LIMIT_UNAVAILABLE`, which means the limiter itself is down and is **not** a permission problem
- [ ] **3.22** **Organization scope (S2, L4-3)** — one shared scope resolver covering CRM's `branchId`, Core's branch-scoped routes and Trade's operating context, so 77 scope-carrying routes are handled once
- [ ] **3.23** **Idempotency replay and conflict (S8, L4-4)** — render `Idempotency-Replayed: true` as success-not-duplicate, and `IDEMPOTENCY_BODY_MISMATCH` (422) / `IDEMPOTENCY_REQUEST_PROCESSING` (409) as distinct, actionable states
### Added by L2 — the state contract and the live defects

- [ ] **3.24** ★ Write `docs/design/states.md`: the eleven-state contract (loading, empty, error+retry, 403, read-only, offline, optimistic-pending, optimistic-rollback, conflict, not-found, partial-failure), and add it to every phase-4-to-12 gate. **Without this the omission repeats 70 times**
- [ ] **3.25** Fix the error/empty collision on all five list pages — pass the real error into the view instead of `error={null}`, so the error state replaces the empty state rather than stacking with it
- [ ] **3.26** Give the retry-less error banners a retry: customer-profiles, acquisition-sources, custom-fields, static-data-catalogue, and all three opportunity views
- [ ] **3.27** Replace `Promise.all` with `Promise.allSettled` + per-source degradation in `useLeads` and `usePipelineWorkspace`; stop `useCustomerProfilesCapabilities` swallowing a fetch failure as "no permission"
- [ ] **3.28** Reclassify "No accessible opportunity pipeline is configured" from an error to an empty state with a create-pipeline action
- [ ] **3.29** Replace the faked pagination on five pages (`limit: items.length`, no-op `onPageChange`) with real paging or an honest absence of it

### Added by L3

- [ ] **3.30** ★ **Fix the census before re-baselining (3.17 depends on it).** It excludes all of `src/design-system/`, counts only the 22 Tailwind families so the five role ramps are **uncounted**, and its gradient counter matches `bg-gradient-to-` while the code uses v4's `bg-linear-to-r`. As written, 3.17's "honest baseline" is not honest
- [ ] **3.31** `Button`'s `disabled:pointer-events-none` makes the documented `disabled:cursor-not-allowed` unrenderable. Resolve as part of 3.4
- [ ] **3.32** Add the **spinner** reduced-motion carve-out — `motion.md` requires two survivors, the pending dot and the spinner; only the dot is carved out
- [ ] **3.33** Delete `animate-bell-ring` and its keyframe, per the standing instruction in `globals.css`. It is outside the motion budget and no task removed it
- [ ] **3.34** Give `surface` and `hitArea` a consumer or delete them
- [ ] **3.35** Cite **B7** by name so 13.19's "all 17 B-items implemented" has traceable evidence
### Added by L5

- [ ] **3.36** ★ Reconcile Tier 1 before 3.12–3.14 touch it. `HANDOFF.md` marks `src/components/auth/` **do not touch** with exactly two permitted exceptions. Amend it explicitly to add a third, or move the two auth screens out of Tier 1 first — do not silently rewrite files a binding doc protects
- [ ] **3.37** `sortDir` vs `sortDirection` (G13) — the shared `PaginationQueryDto` documents `sortDir` as `ASC`/`DESC` while Template Platform uses lowercase `sortDirection` and a combined `sort` token. **Blocking 7.10**; every paginated call must be verified against its own controller
- [ ] **3.38** A stated rule for **multi-action document headers** — 11.5, 11.14, 12.13 and 12.14 build headers with 6–8 lifecycle actions against a one-filled-primary rule that has no guidance for them
- [ ] **3.39** File length: **8 files already exceed the ~300-line rule**, two by more than 3× (`axiosClient.ts` 1141, `usePipelineWorkspace.ts` 1021). Either schedule the splits or amend `AGENTS.md` — do not plan around a rule the codebase already breaks
- [ ] **3.40** Verify `docs:routes:check` passes from a fresh checkout (D8's outstanding verification, never scheduled)

**Gate:** `pnpm verify` green · census at documented targets with an honest
baseline · full keyboard traversal of every built screen · a screen reader pass
on `/login` and one list screen.

---

## Phase 4 — Core · identity and organization

**0 / 34 done.** **50** Gateway routes — organization 21, users 22, roles 6, permissions 1 — plus the auth completion in 4.1–4.4. Start of the feature build.

### Auth completion

- [ ] **4.1** `/accept-invite` — consumes the single-use invite token, sets the initial password. `POST /auth/accept-invite`
- [ ] **4.2** `/reset-password` — consumes the reset token. `POST /auth/reset-password`
- [ ] **4.3** Fix the forgot-password dialog (defect D1) — the email field is unbound and the request sends the **login form's** email. Give the dialog its own state and add a test that types a distinct address and asserts it reaches the body
- [ ] **4.4** Localize `dispatchForbiddenToast()` in the transport (defect D9) — the one permitted i18n change inside Tier 1

### Organization — 21 routes

- [ ] **4.5** `/core/organization` — the company → branch → department → team tree. `GET /organization/tree`, bounded at 5 000 nodes per level
- [ ] **4.6** `/core/organization/companies` — list, create, edit, deactivate. 5 routes
- [ ] **4.7** `/core/organization/branches` — list filtered by company, create, edit, delete. HQ uniqueness is enforced server-side; surface the 409 properly. 5 routes
- [ ] **4.8** `/core/organization/departments` — 5 routes
- [ ] **4.9** `/core/organization/teams` — including the optional lead user. 5 routes
- [ ] **4.10** Deletion blockers are 409s with meaning — a company with branches, a branch with departments, a team with placed users. Render the reason, never a bare "failed"

### Users — 26 routes

- [ ] **4.11** `/core/users` — list with status and placement filters, all three views
- [ ] **4.12** `/core/users/[id]` — detail with identity, placement, manager, job metadata
- [ ] **4.13** Invite drawer — `POST /tenant/users`. Note `@CountsAgainstUsers()`: a seat-limit 403 is a real outcome and needs its own message
- [ ] **4.14** Suspend / activate / delete, with owner and self protections surfaced
- [ ] **4.15** Team memberships — list, full replacement, add, remove. Primary membership cannot be removed. 4 routes
- [ ] **4.16** Module seat assignment — `GET/POST/DELETE /users/:id/modules`. Seat capacity 403 is a real outcome
- [ ] **4.17** `/core/profile` — own preferences, `GET/PUT /users/me/profile`. Theme, language, and the new density preference

### Roles and permissions — 7 routes

- [ ] **4.18** `/core/roles` — list with the system-role filter
- [ ] **4.19** `/core/roles/[id]` — the permission editor. `GET /tenant/permissions` supplies the catalogue with localized labels; grouped by domain, max 200 per role
- [ ] **4.20** Branch-role assignments — `GET/PUT/POST/DELETE /users/:id/assignments`
- [ ] **4.21** Scope-role assignments — `GET/PUT /users/:userId/scope-role-assignments`. TENANT / COMPANY / BRANCH targets, **PUT is a full atomic replacement**, owner-only
- [ ] **4.22** Document both grant models in `docs/api/core-users.md` — the legacy branch-role table and the newer scope-role table coexist, and the UI must not imply otherwise
### The missing auth and tenant pages — added by L2, moved ahead of the feature build

- [ ] **4.23** ★ `not-found.tsx`, `global-error.tsx`, and a per-segment `error.tsx` for `(tenant)/`, `crm/`, `core/`, `trade/`. A single root boundary unmounts `AppShell` on any thrown error. **`TenantHostAdmission` already calls `notFound()` on the hot path**, so the missing file is user-visible today
- [ ] **4.24** `/session-expired` carrying the four terminal reasons; make `TenantAuthGuard` pass the reason instead of bouncing silently
- [ ] **4.25** `/account-suspended` for `SESSION_IDENTITY_INACTIVE` and the DEACTIVATED user
- [ ] **4.26** ★ Extend `TenantHostStatus` to the full five-value enum and render PROVISIONING, PROVISIONING_FAILED and DELETED distinctly instead of 404-ing them
- [ ] **4.27** `/maintenance` fence driven by `server-draining` / `permanent-stop`
- [ ] **4.28** `/entitlement-blocked` — the surface 10.3 gates on and the Phase 10 gate asserts
- [ ] **4.29** Seat-limit-reached state on `/core/users`, linked to 6.12's plan-change path
- [ ] **4.30** Expired / already-consumed / revoked token states for `/accept-invite` and `/reset-password`
- [ ] **4.31** Login failure discrimination — invalid credentials vs suspended account vs suspended tenant vs 429 vs offline, in-body, not one toast
- [ ] **4.32** Detail pages for the four organization lists, and for the user's team and role sub-resources
- [ ] **4.33** INVITED user lifecycle — pending badge, resend, revoke, invite-expired
- [ ] **4.34** The 15 routes assigned to no phase: `provisioning` 3, `public` 3, `activity-types` 1, the 8 `auth` routes beyond login/logout/refresh, `catalog` 1, `decisions` 1. Assign or `[-]` each with a reason

**Gate:** `pnpm verify` green · every screen in ar/en × light/dark · a real
authenticated session exercising invite → accept → role assignment → suspend.

---

## Phase 5 — Core · settings and catalogues

**0 / 19 done.** **33** Gateway routes — workspace-settings 2, currencies 5, taxes 4, numbering 4, email-config 4, notifications 14. Small, high-value CRUD screens; the cleanest place to prove the Phase 0–2 foundations at volume.

- [ ] **5.1** `/core/settings/workspace` — language, timezone, default currency, support toggle. `GET/PUT /workspace-settings`. Handle `TENANT_NOT_READY`
- [ ] **5.2** `/core/settings/currencies` — list, create, edit, set-default, deactivate. 5 routes. The single-default invariant is server-side; the UI reflects it
- [ ] **5.3** `/core/settings/taxes` — 4 routes, company-scoped, inclusive/exclusive
- [ ] **5.4** `/core/settings/numbering` — sequences with prefix, padding, start value. 4 routes
- [ ] **5.5** Numbering peek — `GET /numbering/:code/peek` renders the formatted next number live as the form changes
- [ ] **5.6** `nextValue` may never move backward — a 422 with a clear message, not a generic failure
- [ ] **5.7** `/core/settings/email` — sender identity, provider config, DKIM/SPF status. `GET/PATCH /email-config`
- [ ] **5.8** Email verification — `POST /email-config/verify` and `/verify-connection`, with the DNS record values shown for copy-paste
- [ ] **5.9** Email config uses **strict** `If-Match` — a missing header is 428, a malformed one is 409. Both need distinct, actionable messages
- [ ] **5.10** `/core/notifications` — the full inbox, cursor-paginated. The dropdown exists; this is the full-page view
- [ ] **5.11** Notification preferences — `GET/PUT /notifications/preferences`, per type per channel
- [ ] **5.12** Device tokens — register and revoke
- [ ] **5.13** Mark-read, read-all, acknowledge, dismiss wired to the existing realtime runtime
- [ ] **5.14** `/core/settings` — a settings hub that lists only the sections the user may reach
- [ ] **5.15** Add every settings route to `nav-config.ts` with a correct `hasAccess` predicate
- [ ] **5.16** `SubNav` currently uses the **unfiltered** setup list, so it shows pages the user may lack permission for. Filter it through the same predicate as the sidebar
- [ ] **5.17** Every `ETag` / `If-Match` screen surfaces a real conflict path: someone else saved, here is what changed, retry
- [ ] **5.18** Document each screen in `docs/api/core-settings.md` with verified status and date
- [ ] **5.19** Detail page for `/core/notifications`

**Gate:** `pnpm verify` green · every screen in ar/en × light/dark · a
deliberate 409 conflict triggered and rendered correctly.

---

## Phase 6 — Core · billing, subscription, branding

**0 / 21 done.** **23** Gateway routes — billing 8, subscription 4, branding 7, payments 2, wallet 2. Owner-only, money-touching. Decimal strings are never `Number()`d.

- [ ] **6.1** `/core/billing` — summary: subscription, wallet, invoices, collection state. Owner-only, `TenantOwnerGuard`
- [ ] **6.2** `/core/billing/invoices` — paginated list
- [ ] **6.3** `/core/billing/invoices/[id]` — detail with lines
- [ ] **6.4** Payment quote — `POST /invoices/:id/payment-quote`. Immutable, short-lived; show the expiry and what happens when it lapses
- [ ] **6.5** Payment intent — `POST /invoices/:id/payment-intents`, idempotency-required, hosted checkout hand-off
- [ ] **6.6** Active intent — `GET /invoices/:id/payment-intents/active`. **A URL success is never settlement authority**; the UI must poll the authoritative status
- [ ] **6.7** Payment status — `GET /billing/payments/:paymentId`
- [ ] **6.8** Wallet top-up — `POST /tenant/payments/topup`, and the payments history list
- [ ] **6.9** Every money value renders through the `Money` primitive from a decimal string. **Any `Number()` on a decimal is a defect**
- [ ] **6.10** Payment input currencies — `GET /billing/payment-input-currencies`. Non-USD are display and collection values only; the wallet is always USD
- [ ] **6.11** `/core/subscription` — current plan, modules, tiers, seats, renewal terms
- [ ] **6.12** Plan change preview — `POST /subscription/plan-change-previews`. **Add-or-increase only.** The UI must not offer a downgrade path that the API will reject
- [ ] **6.13** Plan change apply — `POST .../:previewId/apply`, with the expiry countdown on the preview
- [ ] **6.14** The dunning state — while `PAST_DUE`, only the owner can log in and only `@AllowedDuringDunning()` routes are writable. A `DegradedBanner`, not a toast
- [ ] **6.15** `/core/settings/branding` — colours, font, app name, tab title. `GET/PUT /branding`
- [ ] **6.16** Branding logo and icon upload — `POST /branding/logo`, `/branding/icon`, 2 MB cap, png/jpeg/webp. Handle 413 and 415 distinctly
- [ ] **6.17** ★ **Wire tenant branding into the token layer (G2)** — read `GET /branding/public` and override `--color-brand-*` on `:root` at runtime. **Three** semantic tokens consume the brand ramp, not two: `--primary`, `--ring` and `--sidebar-active` (`brand-700` light / `brand-300` dark). Verified live in the app
- [ ] **6.18** Branding must not be able to break contrast. Derive the ramp from the tenant's `primaryColor` by holding lightness and fitting chroma to gamut, exactly as Phase 0 does — then re-check the fill pair before applying
### Added by L2

- [ ] **6.19** Render `SubscriptionStatus` on `/core/subscription`: TRIAL (days remaining + convert), ACTIVE, PAST_DUE, CANCELLED (grace + resubscribe). Only PAST_DUE was covered
- [ ] **6.20** Non-owner 403 in-body for every `TenantOwnerGuard` screen
- [ ] **6.21** Payment-quote-lapsed and intent-abandoned states

**Gate:** `pnpm verify` green · a full payment flow against a real session · a tenant `primaryColor` applied and contrast re-verified · no numeric coercion of a decimal string. **Not provable by grep** — `+value`, `parseFloat`, `value * 1` and plain arithmetic all coerce and none match `Number(`. Needs a lint rule over decimal-typed values.

---

## Phase 7 — Core · directory, templates, audit, activities

**0 / 23 done.** 71 Gateway routes. The largest Core surface.

### Directory — 21 routes

- [ ] **7.1** `/core/directory` — parties list, all three views, filtered by type, status, role, branch, owner
- [ ] **7.2** `/core/directory/[id]` — party detail
- [ ] **7.3** Create and edit party — person and organization variants
- [ ] **7.4** Contact methods — add, edit, delete. Max 200 per party
- [ ] **7.5** Addresses — add, edit, delete. Max 200 per party
- [ ] **7.6** Party roles — assign and remove, branch-scoped
- [ ] **7.7** Relationships — create and delete between parties
- [ ] **7.8** Party image — upload, view, delete. 2 MB, server-side sharp validation; handle 415 and 413
- [ ] **7.9** `/core/directory/settings` — duplicate prevention scope and the per-party caps

### Templates — 41 routes

- [ ] **7.10** `/core/templates` — definitions list, cursor-paginated, scope-filtered. Note the prefix is `templates`, **not** `tenant/templates`
- [ ] **7.11** Create from a starter — `GET /templates/starters` filtered by the exact doc/output/adapter/locale/schema tuple
- [ ] **7.12** `/core/templates/[id]` — the editor shell: draft, save, validate, publish
- [ ] **7.13** Draft autosave against `If-Match`, with recovery snapshots listed and restorable
- [ ] **7.14** Validation runs — `POST /:id/validate`, results rendered per renderer target
- [ ] **7.15** Publish — pinned definition + draft revisions and a passed validation run. All three preconditions surfaced before the button enables
- [ ] **7.16** Versions — list, view, restore-to-draft, retire
- [ ] **7.17** Preview — HTML and email synchronous; PDF is a **202 async job** with polling and artifact download
- [ ] **7.18** Assets — list, upload (5 MiB, multipart `metadata` + `file`), view, retire. `EMAIL_PUBLIC` requires explicit confirmation
- [ ] **7.19** Assignments — list, create, resolve, edit, delete, with priority and effective dates

### Audit and activities — 9 routes

- [ ] **7.20** `/core/audit` — the audit ledger, filtered by actor, entity, action, date range. Uses the `Timeline` pattern
- [ ] **7.21** Entity history — `GET /audit/entities/:entityType/:entityId`, embedded on every detail screen that has one
- [ ] **7.22** `/core/activities` — list, create, update, complete, cancel, with the assignee picker. `If-Match` + idempotency on every mutation
- [ ] **7.23** In-body success panel and ambiguous-outcome panel for lead conversion, per `detail-screens.md` — explicitly **not a toast**. Depends on 1.26

**Gate:** `pnpm verify` green · a template drafted, validated, published,
assigned and previewed as PDF end to end · a party created with contacts,
addresses, roles and an image.

---

## Phase 8 — CRM · completion

**1 / 27 done.** Finishes the module that is already 17 % built.

- [ ] **8.1** `/crm/leads/[id]` — lead detail. Specified in `detail-screens.md`, never built
- [ ] **8.2** Lead conversion — the three-step flow on the new `Stepper`. `POST /leads/:id/convert`
- [ ] **8.3** Lead edit — `PATCH /leads/:id`
- [ ] **8.4** Corporate lead company options and their contacts — 2 routes
- [ ] **8.5** Replace the remaining permission-string action gating with the `capabilities` endpoints (defect D11). A user with `crm.leads.update.own` currently sees an edit control on records they do not own
- [-] **8.6** Remove every "Kanban" string from both dictionaries (defect D12) — **already done**; `grep -rn Kanban src/` is empty and `views.md` records the three keys and the icon import as deleted
- [ ] **8.7** Customer profile actions (Q12) — add contact, edit via `FormDrawer` on `UpdateCustomerProfileDto`, change status, delete. `useCustomerProfilesCapabilities` is already built and waiting
- [ ] **8.8** Customer profile custom-fields rail card
- [ ] **8.9** Customer profile create — `POST /customer-profiles`
- [ ] **8.10** `/crm/opportunities/[id]` — detail with stage history
- [ ] **8.11** Opportunity create and edit
- [ ] **8.12** Pipeline transfer — `PUT /opportunities/:id/pipeline`
- [ ] **8.13** `/crm/pipelines` — pipeline configuration: create, edit, delete, set default, reset to default stages
- [ ] **8.14** Pipeline stages — attach, reorder, detach
- [ ] **8.15** Pipeline assignments — read and replace, with the assignment-options picker
- [ ] **8.16** `/crm/opportunity-stages` — the reusable stage catalogue, 5 routes
- [ ] **8.17** Lead stage edit and set-default — completing the existing screen
- [ ] **8.18** Acquisition source icon upload and reorder
- [ ] **8.19** Custom field requirements and values — 4 routes
- [ ] **8.20** `/crm/activities` — the CRM activity log
- [ ] **8.21** `/crm/tasks` — list, create, update
- [ ] **8.22** `/crm/calendar` — events list, create, update. Uses `DatePicker`
- [ ] **8.23** `/crm/reminders` — list, create, cancel
- [ ] **8.24** Notes — CRUD, embedded on lead, customer and opportunity detail
- [ ] **8.25** Attachments — upload, list, download, delete via the `AttachmentList` pattern. 26 MiB cap
- [ ] **8.26** `/crm/outbound-emails` — options, preview, send, list, detail, retry. 6 routes. Delivery status comes from the worker pipeline, so it is eventually consistent — say so in the UI
- [ ] **8.27** Detail pages for `/crm/pipelines`, `/crm/opportunity-stages`, `/crm/activities`, `/crm/tasks`, `/crm/calendar`, `/crm/reminders`

**Gate:** `pnpm verify` green · a lead created, worked through the board,
converted to a customer and an opportunity, with a note, an attachment and an
outbound email · every action gated by `capabilities`, not permission strings.

---

## Phase 9 — CRM · dashboards and widgets

**0 / 15 done.** 40 Gateway routes. Depends on the Phase 1 chart wrappers.

- [ ] **9.1** `/crm/dashboards` — the dashboard list plus catalog and navigation
- [ ] **9.2** The seven prebuilt dashboards: overview, sales-pipeline, leads, activities-productivity, customer-intelligence, data-quality, action-center
- [ ] **9.3** `StatCard` finally gets its consumer (G4) — the KPI row on every dashboard
- [ ] **9.4** Dashboard detail with layout rendering — `POST /:id/run`
- [ ] **9.5** Dashboard builder — create, edit, delete, duplicate
- [ ] **9.6** Create from template — `POST /from-template/:templateKey`
- [ ] **9.7** Layout editing — `PUT /:id/layout`, drag-to-arrange on the existing dnd dependency
- [ ] **9.8** Set default and favourite
- [ ] **9.9** Widget placements — add and remove
- [ ] **9.10** Widget drilldown — `POST /:id/widgets/:widgetId/drilldown`
- [ ] **9.11** Dashboard sharing — list, create, revoke, with the share-targets picker
- [ ] **9.12** `/crm/widgets` — widget CRUD, preview, clone
- [ ] **9.13** Widget sharing
- [ ] **9.14** Every chart is readable in both themes, colourblind-safe, and has a table fallback for screen readers
- [ ] **9.15** Dashboard partial-failure — "3 of 9 widgets failed", per widget, without failing the dashboard

**Gate:** `pnpm verify` green · every prebuilt dashboard rendered against real
data · a custom dashboard built, laid out, shared and drilled into.

---

## Phase 10 — Trade · foundation

**0 / 21 done.** 231 Trade routes, zero built. Trade authorization differs from
CRM: `@RequireTradeFeature` at the controller and `@RequireTradeAccess` with an
explicit scope target per handler.

- [ ] **10.1** Extract the Trade permission and feature catalogue into `docs/reference/permissions.md`. This was deliberately deferred as Q9 and is now blocking
- [ ] **10.2** Document the Trade authorization model in `docs/api/trade-authorization.md`: the 15 features, the scope targets, and how they compose
- [ ] **10.3** Unseal `/trade` — replace `UnavailableState` with a real module home, gated on entitlement
- [ ] **10.4** Add Trade to `proxy.ts`'s matcher and the nav tree
- [ ] **10.5** A trade operating-context selector — company, branch, channel. Most Trade routes require it, and it is a different axis from the CRM branch selector
- [ ] **10.6** `/trade/items` — catalog list, all three views, 12 routes
- [ ] **10.7** `/trade/items/[id]` — item detail
- [ ] **10.8** Item create and edit
- [ ] **10.9** Item company profile — upsert
- [ ] **10.10** Item branch profile — upsert
- [ ] **10.11** Item channel listings — list, create, update
- [ ] **10.12** `/trade/uoms` — units of measure, 4 routes
- [ ] **10.13** `/trade/channels` — channels and their branches, 6 routes
- [ ] **10.14** `/trade/commercial-accounts` — list, 10 routes
- [ ] **10.15** Commercial account detail, create, edit
- [ ] **10.16** Account branch rules — create and update
- [ ] **10.17** Credit evaluation — `POST /:id/evaluate-credit`, gated on `trade.credit.view`
- [ ] **10.18** Block and unblock an account
- [ ] **10.19** `/trade/configuration` — definitions, versions, test, publish, resolve. 9 routes
- [ ] **10.20** Item search — `POST /items/search`, the read-like POST variant for large filter sets
- [ ] **10.21** Detail pages for `/trade/uoms`, `/trade/channels`, `/trade/configuration`

**Gate:** `pnpm verify` green · an item created with company, branch and
channel profiles · a commercial account created and credit-evaluated · every
screen correct with a missing entitlement.

---

## Phase 11 — Trade · commercial documents

**0 / 22 done.** The transactional core. Every document has a lifecycle, and
the UI must reflect the real state machine, never guess it.

- [ ] **11.1** `/trade/quotations` — list, all three views, 14 routes
- [ ] **11.2** Quotation detail with lines
- [ ] **11.3** Quotation create and edit, with the customer-options picker
- [ ] **11.4** Quotation revisions — `POST /:id/revisions`
- [ ] **11.5** Quotation lifecycle: send, accept, reject, cancel — each with its reason dialog
- [ ] **11.6** Convert quotation to sales order
- [ ] **11.7** Quotation PDF — a **202 async render job** with polling and download. The gateway enforces the exact `Location` prefix
- [ ] **11.8** `/trade/sales-orders` — list, 12 routes
- [ ] **11.9** Sales order detail, create, edit
- [ ] **11.10** Order confirmation — `POST /:id/confirm`, plus the async confirmation-attempt polling and cancel
- [ ] **11.11** Order lifecycle: hold, release-hold, cancel
- [ ] **11.12** Sales order PDF render job
- [ ] **11.13** `/trade/purchase-orders` — list, detail, create, edit. 12 routes
- [ ] **11.14** Purchase order approval ladder: submit, withdraw, approve, reject, confirm, cancel. Uses the `Timeline` pattern
- [ ] **11.15** Purchase order PDF render job
- [ ] **11.16** `/trade/purchase-quotations` — list, search, detail, create, edit, issue. 8 routes
- [ ] **11.17** `/trade/invoices` — list, detail, create, edit, issue. 7 routes
- [ ] **11.18** `/trade/contracts` — list, detail, create, edit, activate. 7 routes, feature-gated on `trade.contracts_recurring`
- [ ] **11.19** Document lineage — quotation → order → invoice, rendered as a `Timeline` on every document
- [ ] **11.20** Every document line editor: item picker via `Combobox`, quantity, UOM, price, tax, and a running total computed **server-side**. The browser never computes financial truth
- [ ] **11.21** Every document total renders through `Money` from a decimal string
- [ ] **11.22** Every lifecycle action surfaces its real precondition failure — a 409 says which state transition was refused, not "failed"

**Gate:** `pnpm verify` green · a quotation created, revised, sent, accepted,
converted to a sales order, confirmed, and invoiced, with a PDF at each stage ·
every total matching the server to the last decimal place.

---

## Phase 12 — Trade · advanced and analytics

**0 / 28 done.** Inventory, pricing, governance, automation, analytics.

- [ ] **12.1** `/trade/inventory` — availability, 26 routes
- [ ] **12.2** Inventory nodes — list, detail, create, update
- [ ] **12.3** Inventory periods — create, close, reopen
- [ ] **12.4** UOM conversions — create, publish, retire
- [ ] **12.5** Opening balances, reservations and releases
- [ ] **12.6** Receipts and deliveries — create, post, reverse
- [ ] **12.7** Serial tracking — list and detail
- [ ] **12.8** `/trade/pricing` — price books and versions, 6 routes
- [ ] **12.9** Price book version editor with entries and promotion rules
- [ ] **12.10** Price test and publish
- [ ] **12.11** Pricing evaluation — `POST /pricing/evaluate`, with the decision receipt shown
- [ ] **12.12** Company default price books
- [ ] **12.13** `/trade/policies` — Policy Studio, 12 routes. The governance ladder: validate, test, submit, approve, reject, publish, retire, rollback
- [ ] **12.14** `/trade/workflows` — the identical ladder, 12 routes
- [ ] **12.15** `/trade/document-profiles` — profiles and versions, **5 routes** (3 + 2)
- [ ] **12.16** `/trade/extensions` — targets, profiles, versions, validate, publish. 9 routes
- [ ] **12.17** `/trade/imports` — sources, mappings, preview, execute, results. 11 routes, uses `FileUpload`
- [ ] **12.18** `/trade/webhooks` — subscriptions, secret rotation, test, deliveries, retry. 11 routes
- [ ] **12.19** `/trade/control-tower` — exceptions list, detail, retry, resolve. 4 routes, feature-gated on `trade.control_tower_advanced`
- [ ] **12.20** `/trade/dashboards` — list, catalog, navigation, default, share-targets. **20 routes** (L1-3: this was buried in a half-sentence)
- [ ] **12.21** Trade dashboard CRUD, duplicate, from-template, set-default, set-favourite
- [ ] **12.22** Trade dashboard layout editing and `POST /:id/run`
- [ ] **12.23** Trade dashboard placements and shares
- [ ] **12.24** `/trade/widgets` — CRUD, preview, clone. **11 routes**
- [ ] **12.25** Trade widget shares, including `shares/bulk-upsert`
- [ ] **12.26** Trade analytics reuses the Phase 1 chart wrappers and the Phase 9 dashboard shell — no second dashboard implementation
- [ ] **12.27** Detail pages for inventory nodes, periods, receipts, deliveries, price-book versions, import runs and webhook deliveries
- [ ] **12.28** Import partial-success result page — succeeded / failed / skipped rows, downloadable

**Gate:** `pnpm verify` green · a policy drafted through the full governance
ladder to published · an import run end to end · a webhook delivered and
retried.

---

## Phase 13 — Hardening and release

**0 / 27 done.** Everything that must be true before this is a product.

- [ ] **13.1** Security headers and CSP — Nginx Proxy Manager owns transport headers; the app owns CSP because the theme bootstrap script needs a per-request nonce
- [ ] **13.2** Error boundaries — Next `error.tsx` and `global-error.tsx`. **There are none today**
- [ ] **13.3** `loading.tsx` per route segment, or a documented decision not to
- [ ] **13.4** `not-found.tsx`
- [ ] **13.5** Offline and reconnect handling, driven by the realtime `server-draining` and `permanent-stop` events
- [ ] **13.6** Realtime resync — `realtime.sync.required.v1` must reconcile every open list, not only notifications
- [ ] **13.7** Session expiry UX — the four distinct terminal reasons need four distinct messages
- [ ] **13.8** Route-level code splitting audit; Trade must not ship in the Core bundle
- [ ] **13.9** Bundle budget, recorded and enforced in CI
- [ ] **13.10** Lighthouse pass on the five busiest screens, both languages
- [ ] **13.11** A real screen-reader pass — NVDA or JAWS — on login, one list, one detail, one form
- [ ] **13.12** Full keyboard traversal of every screen in the app
- [ ] **13.13** Print stylesheet for every document detail screen
- [ ] **13.14** Empty-state copy review — every one names the next action
- [ ] **13.15** Error-message review — all 95 error codes reach the user as something actionable
- [ ] **13.16** `docs/generated/` regenerated, and `docs:verify-called-routes` green
- [ ] **13.17** Every `docs/api/*.md` page carries a truthful portal status and a fresh verification date
- [ ] **13.18** `DEFECTS.md` — every D-item closed or explicitly deferred with a reason
- [ ] **13.19** `SKILL-AUDIT.md` — all 17 B-items marked implemented
- [ ] **13.20** Final census re-baseline at documented targets, and this plan's counters brought to 100 %
### Added by L2

- [ ] **13.21** Global search results page across leads, parties, opportunities, items and commercial documents. `CommandPalette` searches the nav tree, not records
- [ ] **13.22** Export flow — CSV/XLSX from every list, PDF from every dashboard. **Zero coverage in the plan today**
- [ ] **13.23** First-run onboarding for a zero-data tenant: no companies, no branches, no pipelines, no items
### Added by L5

- [ ] **13.24** ★ **Test tasks for phases 4–13.** Q6 produced a written test strategy that the plan applies only to primitives. ~250 screens with no test task is not a plan
- [ ] **13.25** Split 13.1: decide the CSP **policy in Phase 0**, enforce it here. It currently lands seven phases after the runtime style injection (6.17) and the second bootstrap script (0.14) that it must permit
- [ ] **13.26** ★ A **runtime** gamut fitter and contrast checker for tenant branding. 6.18 assumes one exists; Phase 0's is an offline Node script that is never shipped. Without it, the contrast gate proves nothing about any real tenant from the moment 6.17 lands
- [ ] **13.27** Carry Q13 (colocated screen shape is canonical) and Q14 (opportunities render raw ids, not names) forward into the build rules, so ~250 new screens do not re-litigate settled decisions

**Gate:** `pnpm verify` green · full manual pass in ar/en × light/dark ×
compact/default/comfortable · Lighthouse and screen-reader results recorded.

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
match the actual checkbox count exactly. **278 tasks.**

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
| `login/hooks/useLogin.ts:41` | **One message for every failure** — suspended account, suspended tenant, rate-limit and wrong password are indistinguishable |
| five pages | **Faked pagination** — `page={{ page: 1, limit: items.length, total: items.length }}` with a no-op `onPageChange` |
| `static-data-catalogue:66` | **`DegradedBanner` fires on success**, so a real degradation has nowhere to render |
| all 12 pages | **Zero offline handling** — `TenantRealtimeProvider` dispatches `server-draining`, `permanent-stop` and `resync-required` to **zero listeners** |
| `TenantAuthGuard.tsx:23` | **Session expiry bounces silently** — all four terminal reasons collapse to one redirect |

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
