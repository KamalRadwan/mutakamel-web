# Geometry & Density

Status: **[Verified current source; approved target gaps recorded]**

Last source verification: **2026-08-29**

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

### Hit areas: current gap and target

Current `variants.ts` has no `hitArea` fragment. The previous claim that every
compact control already receives an invisible expansion was incorrect.
Checkboxes, switches, icon controls, and default buttons therefore need a real
interaction-area pass.

The approved target separates visual density from interaction size:

- a bare web target is at least 24×24px with adequate separation;
- a touch or coarse-pointer target is at least 44×44px;
- a compact desktop control may keep a 32–36px visible box only when its actual
  hit area satisfies the target without overlapping adjacent controls;
- mobile text inputs use a rendered text size that does not trigger unwanted
  browser zoom.

See
[Accessibility, responsive behavior, and localization](accessibility-responsive-and-localization.md#target-sizes-and-density).

## Row density

`DataTable` rows are currently a fixed 44px (`px-4 py-2.5`, `text-sm`) — see
`src/design-system/patterns/data-table/DataTable.tsx`. A per-operator compact
density toggle (a `--size-row-compact` token persisted to
`localStorage["ds_density"]`) was in the original plan for this migration but
was not built; there is exactly one row height today, not a toggle.

The target keeps compact desktop rows while making coarse-pointer actions
comfortable. Responsive layouts reduce simultaneous columns before shrinking
type or hit areas.

## Elevation

Surfaces separate by **border + background step**. A shadow means "floating
above the document" — nothing else. The target permits three semantic shadows:
`pop`, `overlay`, `sticky`. **Zero shadow on cards** — the `surface` fragment
in `src/design-system/lib/variants.ts` uses `bg-card` + `border-border` at its
`base` level with no shadow; only `raised`
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

Current source still contains blur/shadow exceptions that do not match this
budget. In addition, `census.mjs --check` reports drift but currently exits
zero and excludes `src/design-system`. The budget becomes enforceable only
after Phase 0 of the
[design-update roadmap](design-update-roadmap.md#phase-0--make-drift-visible).

## The one-primary-action rule

At most **one** filled primary action appears per visible decision surface: a
page, dialog, drawer, or independently actionable panel. Page-level creation
or administration belongs in `PageHeader`; modal confirmation belongs in the
modal. Secondary and row-level actions use outline, ghost, or an overflow menu.

This is a hierarchy rule, not a literal “one primary in the entire route DOM”
rule. A closed dialog's action does not compete with the page; an open dialog
becomes the active decision context.
