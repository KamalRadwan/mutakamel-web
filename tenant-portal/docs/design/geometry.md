# Geometry & Density

Status: **Specification**

Written: **2026-08-27**

Source of truth once implemented: `src/app/globals.css`,
`src/design-system/lib/variants.ts`.

> **Superseded on palette and density.** [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) is authoritative for colors, fonts,
> sizes and per-page UI/UX: the neutral ramp is **cold blue** (hue 240), not warm
> graphite, and controls/rows are **32px/36px**, not 36px/40px. This page keeps the
> longer reasoning behind the radius scale, elevation model and budgets.

## What this replaced (pre-rebuild, for context)

112 `rounded-xl` (12px), 38 `rounded-2xl` (16px) and 1 `rounded-3xl` (24px)
usages, with no scale behind any of them. Oversized corner radius is the single
loudest signal that a UI was generated screen-by-screen rather than designed,
and this app has 151 instances of it.

## Radius — 4 steps

Deliberately tighter than a consumer product. A dense operations UI reads as
precise when its corners are quiet.

```css
@theme {
  --radius-xs: 0.125rem;  /* 2px  — checkbox, inline code, chips */
  --radius-sm: 0.25rem;   /* 4px  — DEFAULT: buttons, inputs, badges, tabs */
  --radius-md: 0.375rem;  /* 6px  — cards, table shell, popovers, board columns */
  --radius-lg: 0.5rem;    /* 8px  — dialogs, drawers, sheets */
}
```

There is no `rounded-xl` and above in this system. The migration handles the
151 existing sites in two moves:

1. **Transitional squash** — during the theme flip, alias Tailwind's own
   `--radius-xl`, `--radius-2xl` and `--radius-3xl` down to `0.5rem`, so every
   existing call site tightens with zero file edits.
2. **Codemod** — rewrite `rounded-xl`/`2xl`/`3xl` → `rounded-md` (cards,
   panels) or `rounded-sm` (controls) per call site, then **delete the
   transitional aliases**. Leaving them in place permanently is how the scale
   quietly grows back to six steps.

## Control heights and row density

> **The size values that were here are superseded and have been removed.**
> They specified 36px controls and 40px rows; the implemented density is
> **32px controls / 36px rows**, which is what fits 16 rows on a 1366×768
> laptop instead of 11. The exact token block is in
> **[DESIGN-SYSTEM.md § Sizing & density](DESIGN-SYSTEM.md#3--sizing--density)**.
>
> Removed rather than annotated because they were copyable CSS — an agent
> reading "the control scale" here would have implemented the looser one.

Two mechanisms behind those numbers do still apply, and are not repeated in
DESIGN-SYSTEM.md:

### The shared `controlSize` fragment

Every sized primitive spreads one CVA fragment rather than declaring its own
heights, so a density change is a single-token edit and not a sweep across 21
components. Consumed through Tailwind v4's arbitrary-variable syntax —
`h-(--size-control-md)`.

### Hit-area expansion, not bigger boxes

Controls below the touch floor get an **invisible expanded hit area**:

```ts
export const hitArea =
  "relative after:absolute after:-inset-1.5 after:content-['']";
```

The visible control keeps its density; the tap target grows. **Never solve a
target-size finding by enlarging the visible control** — that is how a dense
table turns into a phone app one component at a time.

Note the bar for web is **24×24 CSS px** (WCAG 2.2 AA `web-target-size`), not
the 44pt native figure — see
[accessibility.md](accessibility.md#wcag-22-criteria-this-app-specifically-has-to-meet).
The 32px default clears it outright; the 24px `xs` sits at it and keeps the
expansion above.

## Spacing

Tailwind's default 4px-based scale, restricted to these steps:

| Step | Use |
| --- | --- |
| `0.5` (2px) | Icon-to-label inside a chip |
| `1` (4px) | Tight inline gaps |
| `1.5` (6px) | Badge padding, dense toolbar gaps |
| `2` (8px) | Control internal padding, list item gaps |
| `3` (12px) | Table cell padding, form field gaps |
| `4` (16px) | Card padding, section gaps, page gutter (mobile) |
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
the petrol fill legible as *the* action above a 40-row table, instead of
competing with a toolbar of equally loud buttons.

Row-level actions are `ghost` icon buttons. Bulk actions on a selection are
`outline`. Destructive actions are `outline` with `text-destructive` until
confirmed inside an `AlertDialog`, where the confirm button is the filled
`destructive`.
