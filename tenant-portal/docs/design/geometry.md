# Geometry & Density

Status: **Specification**

Written: **2026-08-27**

Source of truth once implemented: `src/app/globals.css`,
`src/design-system/lib/variants.ts`.

> **Superseded on palette and density.** [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) is authoritative for colors, fonts,
> sizes and per-page UI/UX. Since the admin-portal token port the shipped
> geometry is **32px controls / 44px rows** at `--ui-scale` **1**, and the shell
> is admin's exact chrome — 48px topbar, 240px sidebar, 52px rail. This page
> keeps the longer reasoning behind the radius scale, elevation model and
> budgets.

## What this replaced (pre-rebuild, for context)

112 `rounded-xl` (12px), 38 `rounded-2xl` (16px) and 1 `rounded-3xl` (24px)
usages, with no scale behind any of them. Oversized corner radius is the single
loudest signal that a UI was generated screen-by-screen rather than designed,
and this app has 151 instances of it.

## Radius — 5 steps

Deliberately tighter than a consumer product. A dense operations UI reads as
precise when its corners are quiet.

```css
@theme {
  --radius-xs: 0.1875rem;  /* 3px  — checkbox */
  --radius-sm: 0.25rem;    /* 4px  — chips, inline code */
  --radius-md: 0.375rem;   /* 6px  — DEFAULT: buttons, inputs, badges, tabs */
  --radius-lg: 0.5rem;     /* 8px  — cards, table shell, popovers, board columns */
  --radius-xl: 0.625rem;   /* 10px — dialogs, drawers */
}
```

Admin's five steps, adopted whole. Two things moved and one disappeared:

- **`xs` went 2px → 3px.** At 2px a 16px checkbox reads as a square with a
  manufacturing defect rather than a rounded one; 3px is the smallest radius
  that reads as intentional at that size.
- **`xl` is a real 10px step** for dialogs and drawers, rather than an alias
  squashed down to `lg`. The default also shifted one rung: buttons and inputs
  are `md` (6px) now, not `sm`, and cards are `lg` (8px), not `md`.
- **The transitional squash is gone.** `--radius-2xl` and `--radius-3xl` no
  longer alias down to `0.5rem`, because they no longer have anything to catch:
  the census baseline records **zero** `rounded-2xl` and `rounded-3xl` call
  sites, so the codemod below finished and the aliases were deleted as it
  always said they should be. Nothing changed shape when they went.

**The markup ceiling is `rounded-lg`, not `rounded-xl`.** `--radius-xl` is
declared for parity with admin, but nothing in this portal consumes it:
`Dialog` and `AlertDialog` render `rounded-lg`, and `Sheet` renders square
because it is an edge drawer with no free corners. Both the ESLint selector and
the census counter still reject `rounded-xl` in source. Widening the ceiling is
a change to the lint rule and to this section, not a call an individual
component makes.

The original migration, for the record, ran in two moves:

1. **Transitional squash** — during the theme flip, alias Tailwind's own
   `--radius-xl`, `--radius-2xl` and `--radius-3xl` down to `0.5rem`, so every
   existing call site tightens with zero file edits.
2. **Codemod** — rewrite `rounded-xl`/`2xl`/`3xl` → `rounded-md` (cards,
   panels) or `rounded-sm` (controls) per call site, then **delete the
   transitional aliases**. Leaving them in place permanently is how the scale
   quietly grows back to six steps.

## Control heights and row density

> **The size values that were here are superseded and have been removed.**
> They specified 36px controls and 40px rows. The implemented control scale is
> **24/28/32/36/40px**, and since the admin port those are the pixel sizes that
> actually render: `--ui-scale` ships at **1**, so the `rem` values are no
> longer multiplied down by 0.9. The row is **44px** and the shell is admin's
> exact chrome.
>
> The "16 rows on a 1366×768 laptop" figure counts only the topbar and the
> table header, and the measured "14 rows at 1.0 / 15 at 0.9" figure was taken
> against the pre-port geometry. **Both are stale**; the derivation of the
> current budget, and the fact that it is derived rather than measured, is in
> **[DESIGN-SYSTEM.md § Sizing & density](DESIGN-SYSTEM.md#3--sizing--density)**,
> which also carries the exact token block.
>
> Removed rather than annotated because they were copyable CSS — an agent
> reading "the control scale" here would have implemented the looser one.

**The scale default moving from 0.9 to 1 is the whole substance of the port's
density change.** No `rem` value in `controlSize` moved; they simply stopped
being shrunk. That one multiplier was the entire reason this portal rendered
about 10 % smaller than the admin portal at every control, row and chrome edge.

Three mechanisms behind those numbers do still apply, and are not repeated in
DESIGN-SYSTEM.md:

### The shared `controlSize` fragment

Every sized primitive spreads one CVA fragment rather than declaring its own
heights, so a density change is a single-token edit and not a sweep across 21
components. Consumed through Tailwind v4's arbitrary-variable syntax —
`h-(--size-control-md)`.

**Every text control now defaults to `sm`.** `Input`, `Select`, `Combobox`,
`MultiSelect`, `DatePicker`, `DateRangePicker` and `Textarea` each declared
`lg` (or `md`); they now declare `sm`, which is what makes a dense form fit.
Nothing else changed — a call site that names its own size still wins, and the
mobile rule below is untouched because `textEntrySize` is a separate fragment
that keeps typed input at 16px under `sm:`.

The fragment carries padding as well as height, and the port took admin's:
`px-2 / px-2.5 / px-3 / px-3.5 / px-4` for `xs`→`xl`. The two that moved are
`xs` (1.5 → 2) and `sm` (2 → 2.5); `lg` tightened from `px-4` to `px-3.5` so it
is not the same width as `xl`. The gap is a **fixed** `1.5` at every size — an
icon-to-label gap that grows with the control makes a large button look loose
rather than large.

### Hit-area expansion, not bigger boxes

Controls below the touch floor get an expanded target rather than a bigger
visible box:

```ts
export const hitArea = "ds-hit-area";     // grows the control box itself
export const hitTarget = "ds-hit-target"; // keeps a compact visual box, expands its ::after
```

Both resolve to classes declared in `globals.css`, expressed as a **minimum
size** — 24×24px normally, 44×44px under `@media (pointer: coarse)`.

This replaced a hardcoded `relative after:absolute after:-inset-1.5`, and then
an `-inset-2` version of the same. That 8px was derived arithmetically from
`--ui-scale` 0.9 — "28.8px control + 8px per side = 44.8px" — which means it
silently stopped being the right number the moment the scale default moved to
1. A minimum-size rule cannot go stale that way: it holds the floor at any
scale, and it expands only for coarse pointers, where the 44px floor actually
applies.

`hitTarget` exists for the case `hitArea` cannot serve: a checkbox or radio
whose **visible** box must stay 16px while its hit-testing area does not. It
is exported and available; no primitive consumes it yet.

The visible control keeps its density; the tap target grows. **Never solve a
target-size finding by enlarging the visible control** — that is how a dense
table turns into a phone app one component at a time.

Note the bar for web is **24×24 CSS px** (WCAG 2.2 AA `web-target-size`), not
the 44pt native figure — see
[accessibility.md](accessibility.md#wcag-22-criteria-this-app-specifically-has-to-meet).
The 32px default clears it outright; the 24px `xs` sits at it and keeps the
expansion above, which is why `Button` applies `hitArea` at `size="xs"` and
nowhere else.

## Density does not move the breakpoints

`--ui-scale` multiplies geometry. It does **not** touch
`--breakpoint-*`, and it cannot: a breakpoint is measured against the
viewport, which is a property of the user's screen, not of our tokens. This
file customises no breakpoints, so Tailwind v4's defaults stand — `sm` 40rem,
`md` 48rem, `lg` 64rem, `xl` 80rem, `2xl` 96rem.

The consequence is that **every responsive boundary now fires at a different
content density than it was drawn for**, and since density became a user
preference ([theming.md](theming.md#density-is-the-absence-of-a-value-not-a-value))
it fires at *three*.

The shell makes it concrete. `--size-sidebar` is `15rem` scaled, so the
content column at a given viewport width is whatever the sidebar leaves:

| Viewport | Sidebar @ compact | @ standard | @ comfortable | Content column, compact → comfortable |
|---|---:|---:|---:|---:|
| `md` 768 px | 216 px | 240 px | 264 px | 552 → 504 px |
| `lg` 1024 px | 216 px | 240 px | 264 px | 808 → 760 px |
| `xl` 1280 px | 216 px | 240 px | 264 px | 1064 → 1016 px |

The sidebar swing is 48 px — about **9 % of the content column at `md`** —
and no `md:` rule knows it happened. A layout that *just* fits two columns at
`md` on compact can overflow at comfortable while remaining, as far as CSS is
concerned, at exactly the same breakpoint. The port widened the sidebar by
8 px at every density and left this swing unchanged, so the hazard is the same
size it always was; only the starting width moved.

Vertically the same thing costs rows, and the port made each row cost more:

| Density | Row | Topbar | Rows visible |
|---|---:|---:|---:|
| compact 0.9 | 39.6 px | 43.2 px | ~12 |
| standard 1.0 | 44 px | 48 px | ~11 |
| comfortable 1.1 | 48.4 px | 52.8 px | ~9 |

**Every figure in that last column is derived, not measured, and must be
quoted as such.** The measurement this table used to carry — 15 rows at
compact, 14 at standard, taken in the running app at 1366×768 with the real
chrome — was taken against 36px rows and a 44px topbar and no longer holds.
The derivation runs from that same measurement: 14 rows × 36 px is the height
that was available, the taller topbar and the wider `md:p-6` gutter take 20 px
of it, and what remains divides by the new row height. A fresh count in the
running app would supersede all three numbers, and should.

The direction is not in doubt: **standard density trades roughly three rows for
matching the admin portal's physical size.** An operator who wants the rows
back picks compact, which is exactly what the setting is for.

**What this means when writing a screen.** Do not tune a `md:`/`lg:` rule
against what you see at one density — you are looking at one of three layouts
that rule produces. Prefer container-relative sizing and `min-w-0` over
column counts pinned to a breakpoint, and let dense tables scroll rather than
assuming a row budget. Where a layout genuinely cannot survive the swing, the
honest fix is a wider breakpoint, not a smaller token.

**Not verified at each breakpoint.** MASTER-PLAN 0.33 also asks for an eyes-on
pass over the shell and one dense table at every breakpoint. That needs an
authenticated session, which is blocked on P4
([MANUAL-TEST-PLAN.md](../build/MANUAL-TEST-PLAN.md)). The horizontal
arithmetic above is exact — it comes straight from the token definitions. The
vertical figures are not: the only measurement ever taken predates the admin
port, so **all three row counts are now derived**. That pass is worth more
after the port than it was before it.

## Spacing

Tailwind's default 4px-based scale, restricted to these steps:

| Step | Use |
| --- | --- |
| `0.5` (2px) | Icon-to-label inside a chip |
| `1` (4px) | Tight inline gaps |
| `1.5` (6px) | Badge padding, dense toolbar gaps |
| `2` (8px) | Control internal padding, list item gaps |
| `3` (12px) | Table cell vertical padding, form field gaps |
| `4` (16px) | Table cell horizontal padding, card padding, section gaps, page gutter (mobile) |
| `6` (24px) | Page gutter (desktop), gap between major sections |
| `8` (32px) | Space above a page-level heading block |

Nothing above `8`. A CRM screen that needs 48px of breathing room is a screen
with too little on it.

**Lay out with `gap`, not margins.** Sibling groups use flex or grid with
`gap-*`. Per-element margins collapse and double in ways that are invisible in
review and obvious in production.

## Elevation

Surfaces separate by **border plus background step**. A shadow means exactly
one thing: *this is floating above the document.*

| Level | Treatment | Used by |
| --- | --- | --- |
| `canvas` | `bg-canvas` | Page background |
| `base` | `bg-card` + `border-border`, **no shadow** | Cards, table shell, board columns |
| `raised` | `bg-popover` + `border-border` + `shadow-pop` | Popovers, dropdowns, tooltips |
| `overlay` | `bg-popover` + `shadow-overlay` | Dialogs, sheets, drawers |
| `sunken` | `bg-muted` | Inset wells, disabled regions |

**Zero shadow on cards.** A card is not floating; it is a region.

```ts
export const surface = cva("", {
  variants: {
    level: {
      canvas:  "bg-canvas text-foreground",
      base:    "bg-card text-card-foreground border border-border",
      raised:  "bg-popover text-popover-foreground border border-border shadow-pop",
      overlay: "bg-popover text-popover-foreground shadow-overlay",
      sunken:  "bg-muted text-muted-foreground",
    },
  },
  defaultVariants: { level: "base" },
});
```

In dark mode `--elevation-pop` and `--elevation-overlay` become a **top inset
hairline** rather than a heavier shadow — see
[tokens.md](tokens.md#elevation-and-control-tokens). A drop shadow against an
already-dark canvas reads as mud, not lift.

> **Trap, verify after implementing.** Both elevation tokens must be bridged
> into Tailwind via `@theme inline` as `--shadow-pop` / `--shadow-overlay`.
> Under Tailwind v4 an undefined `--shadow-*` theme key generates **no utility
> at all** — every popover, dropdown, tooltip and dialog then renders
> completely flat with no error anywhere. This exact bug shipped undetected in
> the sibling portal across eleven call sites.

## Stacking order

Six layers, declared once as tokens rather than left to ad-hoc `z-50`. The full
ladder and the two non-obvious orderings (sticky header above sticky cell;
toast above overlay) are in
[DESIGN-SYSTEM.md](DESIGN-SYSTEM.md#stacking-order).

This is [SKILL-AUDIT.md](SKILL-AUDIT.md) **B7**, implemented by MASTER-PLAN
tasks 0.17–0.20: tokens in `globals.css`, every literal replaced in the
primitives and `DataTable`, an ESLint selector banning a bare `z-<number>`
outside `src/design-system/`, and a census counter behind it. Named here so
13.19's "all 17 B-items implemented" has a citation rather than a claim.

A bare `z-` utility in feature code is a bug — it works until the day two
layers meet.

## Borders

One width: `1px`. There are no 2px borders in this system except the active-nav
indicator, which is a 2px logical inset-start bar and is a *position* marker,
not a border.

Border color is always `border-border`. A border that needs to signal state
(invalid field, selected row) changes color to `ring`, `destructive`, or
`caution` — never width, which shifts layout.

## Focus

Every interactive element spreads `focusRing`:

```ts
export const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";
```

`focus-visible`, not `focus` — a mouse click should not paint a ring. Never set
`outline: none` without providing this replacement.

## Gradient and blur budgets

Before the rebuild this app carried **19 gradients** and **14 `backdrop-blur`**
usages — none load-bearing, all decorative, and together a large part of why
the old UI read as generated. Both are now at **0** and the budgets below are
what keeps them there.

- **Gradients: 2 total.** The brand mark, and `Skeleton`'s shimmer sweep.
- **Blur: 1 total.** The modal scrim.

`pnpm design:census -- --check` fails the build if either count grows without
an explicit, reasoned baseline update. "It looked fine" is not a reason.

## The one-filled-action rule, as geometry

At most one filled `variant="primary"` button per screen, placed in
`PageHeader`. This is a layout rule as much as a color rule: it is what keeps
the cobalt `brand-600` fill legible as *the* action above a long table, instead
of competing with a toolbar of equally loud buttons.

Row-level actions are `ghost` icon buttons. Bulk actions on a selection are
`outline`. Destructive actions are `outline` with `text-destructive` until
confirmed inside an `AlertDialog`, where the confirm button is the filled
`destructive`.

A document header carrying six to eight lifecycle actions is the case this
rule does not settle on its own — the three-tier resolution is in
[patterns.md](patterns.md#multi-action-document-headers).
