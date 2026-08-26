# Geometry & Density

Status: **[Verified]**

Last source verification: **2026-08-26**

Owner: **Admin Portal**

Source: `src/app/globals.css`, `src/design-system/lib/variants.ts`.

## Radius — 5 steps

```css
--radius-xs:  0.1875rem;  /* 3px  — checkbox */
--radius-sm:  0.25rem;    /* 4px  — chips, inline code */
--radius-md:  0.375rem;   /* 6px  — default: buttons, inputs, badges, tabs */
--radius-lg:  0.5rem;     /* 8px  — cards, table shell, popovers */
--radius-xl:  0.625rem;   /* 10px — dialogs, drawers */
```

Before this migration, 727 sites used `rounded-xl` (12px) and 324 used
`rounded-2xl`/`rounded-3xl` (16px+) — visually one of the loudest signals
that the app looked AI-generated. The theme flip applied a transitional
radius squash first (deflating `--radius-2xl`/`--radius-3xl` to 10px so
every existing usage tightened with zero file edits), then Phase 7's codemod
renamed every `rounded-2xl`/`rounded-3xl` call site to `rounded-xl`, so no
transitional alias remains for those two Tailwind keys.

Recovered code (e.g. Phase 22's dashboard charts, which predate this
migration and were reintroduced from git history) is not blanket-normalized
to this 5-step scale — matching the surrounding file's already-established
local convention is preferred over chasing every literal radius class to its
"ideal" tier, since the census check's `roundedXl` counter only flags growth
beyond what a given phase's diff actually intends, not the pre-existing
total.

## Control-height scale

```css
--size-control-xs: 1.5rem;   /* 24px */
--size-control-sm: 1.75rem;  /* 28px */
--size-control-md: 2rem;     /* 32px — default */
--size-control-lg: 2.25rem;  /* 36px */
--size-control-xl: 2.5rem;   /* 40px */
```

Consumed via Tailwind v4's arbitrary-var syntax (`h-(--size-control-md)`) by
`src/design-system/lib/variants.ts`'s `controlSize` CVA fragment, which every
sized primitive (`Button`, `Input`, `Select`, …) shares:

```ts
export const controlSize = cva("", {
  variants: {
    size: {
      xs: "h-(--size-control-xs) px-2 text-xs",
      sm: "h-(--size-control-sm) px-2.5 text-xs",
      md: "h-(--size-control-md) px-3 text-sm",
      lg: "h-(--size-control-lg) px-3.5 text-sm",
      xl: "h-(--size-control-xl) px-4 text-base",
    },
  },
  defaultVariants: { size: "md" },
});
```

Controls below the 40px touch-target floor get a **hit-area expansion**
instead of a bigger box — `variants.ts`'s `hitArea` fragment adds an
absolutely-positioned, inset-negative pseudo-element rather than growing the
visible control, matching the pattern `ToastContext.tsx` already used ad hoc
before this migration.

## Row density

`DataTable` rows are a fixed 44px (`px-4 py-2.5`, `text-sm`) — see
`src/design-system/patterns/data-table/DataTable.tsx`. A per-operator compact
density toggle (a `--size-row-compact` token persisted to
`localStorage["ds_density"]`) was in the original plan for this migration but
was not built; there is exactly one row height today, not a toggle. Treat any
reference to a density preference elsewhere as aspirational until this lands.

## Elevation

Surfaces separate by **border + background step**. A shadow means "floating
above the document" — nothing else. Three shadows exist in the whole app:
`pop`, `overlay`, `sticky`. **Zero shadow on cards** — `surface.ts`'s
`base` level is `bg-card` + `border-border`, no shadow; only `raised`
(popovers, dropdowns) carries `shadow-pop`. Dark mode substitutes a top
inset hairline for shadow rather than a darker shadow, since shadows read
poorly against an already-dark canvas.

## Gradient and blur budgets

The app had 47 gradients and 42 `backdrop-blur` usages before this
migration — almost all decorative, none load-bearing. The budgets going
forward:

- **Gradients: 3 total** — the brand mark, a sticky-header fade, and
  `Skeleton`'s shimmer sweep keyframe.
- **Blur: 1 total** — the modal scrim.

`node scripts/design/census.mjs --check` fails a phase's verification gate
if either count grows without an explicit, reasoned baseline update. This is
why Phase 22's recovered `ChartTooltip.tsx` had its `backdrop-blur-md`
removed during that phase's cleanup (it was recovered code from before this
migration existed, and reintroducing it would have silently spent the app's
one blur budget slot on a chart tooltip instead of the modal scrim it's
reserved for) rather than kept because "it looked fine."

## The one-primary-fill rule

At most **one** filled `variant="primary"` button per page, placed in
`PageHeader`. Everything else is `outline` or `ghost`. This is a layout rule
as much as a color rule — it is what keeps a bright emerald legible as *the*
action on a dense, 44-row table instead of competing with a row of equally
loud buttons for attention.
