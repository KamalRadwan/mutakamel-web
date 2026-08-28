# Geometry & Density

Status: **Specification**

Written: **2026-08-27**

Source of truth once implemented: `src/app/globals.css`,
`src/design-system/lib/variants.ts`.

> **Superseded on palette and density.** [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) is authoritative for colors, fonts,
> sizes and per-page UI/UX: the neutral ramp is **cold blue** (hue 240), not warm
> graphite, and controls/rows are **32px/36px**, not 36px/40px. This page keeps the
> longer reasoning behind the radius scale, elevation model and budgets.

## The current state this replaces

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

## Control heights — 5 steps

```css
:root {
  --size-control-xs: 1.75rem;  /* 28px */
  --size-control-sm: 2rem;     /* 32px */
  --size-control-md: 2.25rem;  /* 36px — DEFAULT */
  --size-control-lg: 2.5rem;   /* 40px */
  --size-control-xl: 2.75rem;  /* 44px */
}
```

**36px is the default, not 32px.** This is a deliberate divergence from a
developer-tool default. The people using this app are sales and operations
staff, not engineers; they hit these controls hundreds of times a shift, often
on a trackpad, and the Arabic label inside needs the extra 4px of vertical room
that [typography.md](typography.md#arabic-gets-a-lift)'s Arabic lift implies.

Consumed through Tailwind v4's arbitrary-variable syntax by the shared CVA
fragment every sized primitive spreads in:

```ts
// src/design-system/lib/variants.ts
export const controlSize = cva("", {
  variants: {
    size: {
      xs: "h-(--size-control-xs) px-2   text-xs gap-1.5",
      sm: "h-(--size-control-sm) px-2.5 text-xs gap-1.5",
      md: "h-(--size-control-md) px-3   text-sm gap-2",
      lg: "h-(--size-control-lg) px-3.5 text-sm gap-2",
      xl: "h-(--size-control-xl) px-4   text-base gap-2.5",
    },
  },
  defaultVariants: { size: "md" },
});
```

### Hit-area expansion

Controls below the 44px touch-target floor — `xs`, `sm`, `md`, `lg` — get an
**invisible expanded hit area**, not a bigger box:

```ts
export const hitArea =
  "relative after:absolute after:-inset-1.5 after:content-['']";
```

The visible control keeps its density; the tap target clears the floor. Never
solve a touch-target audit by growing the visible control — that is how a dense
table turns into a phone app.

## Row density — 40px

```css
:root { --size-row: 2.5rem; }  /* 40px */
```

`DataTable` rows are a fixed 40px: `px-3 py-2`, `text-xs`, weight 400. On a
1366×768 laptop with the shell chrome subtracted, that shows **14 rows without
scrolling** — the number that makes a lead list scannable in one glance.

There is exactly one row height. There is no density toggle. If one is ever
added it needs a token (`--size-row-compact`) and a persisted preference, and
this paragraph must be rewritten — do not add a local `compact` prop to
`DataTable` instead.

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

The app currently has **19 gradients** and **14 `backdrop-blur`** usages. None
are load-bearing; all are decorative, and together they are a large part of why
the current UI reads as generated.

Going forward:

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
