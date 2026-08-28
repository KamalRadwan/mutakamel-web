# Design System

Status: **Specification — not yet implemented**

Written: **2026-08-27**

Owner: **Tenant Portal**

This is an **independent** design system. It shares no tokens, no fonts, no
components and no visual identity with `admin-portal`. That is deliberate:
`admin-portal` is an internal operations console, this is the product tenants
pay for and live inside all day. Where a technique from `admin-portal` is worth
reusing, this document says so explicitly and explains why — but nothing is
inherited by default.

> **Start here: [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md)** — the complete
> specification in one file: cold-blue palette, fonts, sizes, libraries,
> the toast rule, and per-page UI/UX. The pages below expand on it.

## Who this is for

Tenant staff — sales representatives, account managers, operations people —
working an Arabic-first interface for a full shift, usually on a 1366×768
laptop, moving through dense lists of leads, customers and opportunities. Not
engineers. Not occasional visitors.

Three consequences run through every decision below:

- **Density serves them, microscopic type does not.** The floor is 13px, and
  Arabic gets a lift above that.
- **Controls are touched constantly.** 36px default control height, larger than
  a developer tool would need.
- **Arabic is the default, not a translation.** Direction is a first-class
  layout concern, never a post-processing step.

## The five laws

### 1. Four hues — and a stage is never one of them

Every color in this app is `brand` (petrol), `positive` (moss), `caution`
(amber), `negative` (clay), or `ink` (the warm neutral ramp). There is no
fifth hue.

The critical corollary, and the law most specific to this product: **pipeline
and lifecycle stages are not colors.** `LeadStageFlagEnum` has 8 values.
`OpportunityStageFlagEnum` has 9. No palette contains 9 hues that stay
distinguishable under colorblindness at badge size — attempting it is what
produces the confetti-colored CRM look.

Stage is communicated by **position, label, and progress**. Only *outcome*
takes a hue:

| Outcome | Role | Wire values |
| --- | --- | --- |
| In progress / open | `ink` + motion | `OPEN`, `IN_PROGRESS`, and every intermediate stage flag |
| Succeeded | `positive` | `WON`, `CONVERTED`, `ACTIVE_CUSTOMER` |
| Paused / needs attention | `caution` | `ON_HOLD`, `NURTURING`, `PENDING` |
| Failed / ended badly | `negative` | `LOST`, `DISQUALIFIED`, `BLACKLISTED` |

See [tokens.md](tokens.md#status-mapping) for the complete enum-to-role table.
It is exhaustive; do not extend it by guessing.

### 2. One family, two scripts

Text is set in **Readex Pro**, a superfamily drawn for Latin and Arabic
together. A status badge's Latin enum value sitting inside an Arabic sentence
does not jump baseline or x-height, because it is the same family — not two
families chosen to look similar.

This removes an entire class of bug: no `:lang()` switching, no per-script font
stack, no second set of vertical metrics to reconcile. See
[typography.md](typography.md).

### 3. Three weights, physically enforced

400, 500, 600. Only those three are downloaded, and `font-synthesis-weight:
none` stops the browser faking anything heavier. Hierarchy comes from **size
and color**, never weight. `font-bold` is remapped to 600 at the token level so
a stray class cannot escalate.

### 4. One filled action per screen

At most one `variant="primary"` button on a screen, and it belongs in
`PageHeader`. Everything else is `outline` or `ghost`. This is what keeps the
primary action legible on a 40-row table instead of competing with a row of
equally loud buttons.

### 5. Logical properties only

The app is RTL by default. Physical direction utilities (`ml-`, `mr-`, `pl-`,
`pr-`, `left-`, `right-`, `text-left`, `text-right`) are **forbidden** and the
build fails on any of them. Use `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`,
`text-start`, `text-end`.

Where a third-party API takes a physical side (Radix `side="right"`), compute
it from direction rather than hardcoding — see [theming.md](theming.md#rtl).

## Map

| Concern | File |
| --- | --- |
| **Everything, in one file — start here** | **[DESIGN-SYSTEM.md](DESIGN-SYSTEM.md)** |
| Color roles, OKLCH ramps, semantic tokens, status mapping | [tokens.md](tokens.md) |
| Font pairing, type scale, weights, Arabic lift, numerals | [typography.md](typography.md) |
| Radius, spacing, control heights, row density, elevation | [geometry.md](geometry.md) |
| Animation budget and permitted keyframes | [motion.md](motion.md) |
| Every primitive's props and variants | [primitives.md](primitives.md) |
| Every composite pattern's props | [patterns.md](patterns.md) |
| **Board / card / table — the three-view contract** | [views.md](views.md) |
| Lead & customer detail screens, lead conversion | [detail-screens.md](detail-screens.md) |
| The per-screen accessibility checklist | [accessibility.md](accessibility.md) |
| Sidebar, topbar, navigation map | [shell.md](shell.md) |
| Light/dark, RTL, no-flash first paint | [theming.md](theming.md) |
| Dictionary structure, zero-ternary rule | [i18n.md](i18n.md) |
| The banned list | [anti-patterns.md](anti-patterns.md) |
| Census, RTL guard, ESLint, CI gates | [enforcement.md](enforcement.md) |

## Where the code lives

```text
src/design-system/
  index.ts          public barrel — feature code imports ONLY from here
  lib/
    cn.ts           className merge
    variants.ts     shared CVA fragments: focusRing, controlSize, surface
  primitives/       21 files — see primitives.md
  patterns/         12 directories — see patterns.md
  views/            board / card / table — see views.md
  shell/            AppShell, Sidebar, Topbar, MobileNav, nav-config
  feedback/         ToastProvider, useToast, AppToast
```

`src/app/globals.css` is the token source of truth. Feature code imports from
`@/design-system`, never from a deep path — that single indirection is what
lets every screen repaint from a handful of files.

## Why an independent system, concretely

`admin-portal` solved the same problems with different answers. Two techniques
from it are worth reusing on their merits, and are reused here with attribution:

- **The theme flip** — remapping Tailwind's own built-in color variables onto
  named roles inside `@theme`, so pre-existing `bg-slate-*` call sites repaint
  with zero `.tsx` edits. This is the single highest-leverage migration step
  available and it is hue-agnostic. See [tokens.md](tokens.md#the-theme-flip).
- **shadcn-compatible semantic names** — `--background`, `--card`, `--primary`,
  `--ring` and friends, so `npx shadcn add <x>` pastes in without edits.

Everything else — hue, neutral temperature, type, geometry, density,
components — is decided here from this product's own requirements.
