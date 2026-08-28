# Design System

Status: **[Verified]**

Last source verification: **2026-08-26**

Owner: **Admin Portal**

## Purpose

This is the index for the Admin Portal design system: the token layer,
component layer, type scale, and sidebar IA that replaced 552 files' worth of
screen-by-screen, independently-invented styling with one system. It exists
because the app was measurably incoherent before this work — 9,154
color-utility usages across 14 Tailwind color families competing for the same
job, 69% of all text at 12px or smaller, 467 hand-rolled `<button>` elements,
and a `layout.tsx` that hardcoded `lang="ar" dir="rtl" className="dark"`
regardless of the visiting user's actual preference.

## The three laws

1. **Four color roles, not fourteen families.** Every use of color is
   `brand` (emerald — primary actions, active nav, focus rings,
   success/healthy), `danger` (warm vermilion, deliberately not rose),
   `warn` (amber — border/tint/dot/text only, never a filled button), or
   `ink` (the neutral ramp — everything else). "In progress" is **neutral +
   motion**, not a fifth hue — see [tokens.md](tokens.md).
2. **Three font weights, not eight.** 600 for headings/`<th>`/KPI
   numerals/button labels/active nav; 500 for form labels/tabs/badges; 400
   for everything else, including all table body cells. Hierarchy comes from
   size and color, never weight — see [typography.md](typography.md).
3. **One primary-fill button per page.** At most one `variant="primary"`
   button, placed in `PageHeader`. Everything else is outline or ghost. This
   is what keeps a bright emerald legible as *the* action on a dense,
   44-row table — see [primitives.md](primitives.md#button).

## Map

| Area | Reference |
| --- | --- |
| Color roles, OKLCH ramps, contrast ratios | [tokens.md](tokens.md) |
| Font pairing, type scale, weight policy, Arabic lift | [typography.md](typography.md) |
| Radius, spacing, control/row heights, elevation budgets | [geometry-and-density.md](geometry-and-density.md) |
| The 26 primitives (Button, Field, Dialog, Table, …) | [primitives.md](primitives.md) |
| The 15 composite patterns (DataTable, FormDrawer, …) | [patterns.md](patterns.md) |
| Sidebar, topbar, command palette, the 54-route nav map | [shell-and-navigation.md](shell-and-navigation.md) |
| Cookie-resolved theme/language, RTL direction wiring | [theming-and-direction.md](theming-and-direction.md) |
| Where a write result belongs — toast vs. in-body | [toast-contract.md](toast-contract.md) |
| Codemod inventory, phase gates, census baselines | [migration.md](migration.md) |

## Where the code lives

```text
src/design-system/
  index.ts        # public barrel — feature code imports only from here
  lib/             cn.ts, variants.ts
  primitives/      26 files — see primitives.md
  patterns/        15 directories — see patterns.md
  shell/           AppShell, Sidebar, Topbar, SubNav, MobileNav, CommandPalette,
                    nav-config.ts, useNavTree.ts, useSidebar.ts
  feedback/        ToastProvider, useToast, AppToast, toast-bridge
```

`src/app/globals.css` is the token source of truth. `AGENTS.md` requires
feature code to import design-system pieces only from `@/design-system` (the
barrel), not by reaching into `src/design-system/primitives/Button` directly
— that indirection is what let every one of the 54 routes repaint from a
handful of files instead of 552.

## Verification

Every phase of this migration is gated on the same commands, run from
`admin-portal/`:

```bash
npx tsc --noEmit
rm -rf .next && pnpm build
pnpm lint
pnpm test
node scripts/design/census.mjs --check
node scripts/design/rtl-guard.mjs
```

A green run of all six proves `Type-validated` + `Build-validated` +
`Lint-validated` + `Unit-tested` per `DOCUMENTATION_CONTRACT.md`'s evidence
levels — nothing more. `Live authenticated` requires driving the app in a
real authorized session, which several phases of this migration could not
obtain in this environment; that gap is called out explicitly wherever it
applies rather than implied by a green build.
