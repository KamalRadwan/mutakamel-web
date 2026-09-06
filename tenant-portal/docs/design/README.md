# Design System

Status: **Implemented** — Phases 1–5 shipped 2026-08-28; all 17
[SKILL-AUDIT.md](SKILL-AUDIT.md#status--documentation-closed-code-landed)
refinements landed 2026-08-31. The token layer was replaced with the admin
portal's afterwards; the pages below describe the ported values.

Written: **2026-08-27**

Owner: **Tenant Portal**

This design system **shares its token layer with `admin-portal`**. Fonts, every
ramp value, the semantic roles, the radius scale and the whole shell geometry
were ported wholesale from `admin-portal/src/app/globals.css`, and the two
products now draw the same palette at the same physical size.

That reverses this page's original position, which was that the two systems
should share nothing by default. The reasoning behind that position is worth
keeping in view: `admin-portal` is an internal operations console and this is
the product tenants pay for and live inside all day, so the two have different
*jobs*. What did not survive contact is the conclusion — different jobs do not
benefit from different blues, different row heights or different type. The
things tenants need that admin does not are white-labelling and Arabic-first
layout, and neither of those is a reason for a second palette.

The split now runs one level down:

- **Shared with admin** — token values, fonts, geometry, and the alias
  spellings (`--color-action-*`, `--color-surface-*`, …) that let markup move
  between the portals unedited.
- **This portal's own** — the role *names* (`brand` / `positive` / `caution` /
  `negative` / `ink`, kept because `src/lib/branding/apply-branding.ts`
  overwrites `--color-brand-*` on `:root` at runtime for a white-labelled
  tenant), every component, the RTL rules, the toast rule, and all of the
  per-screen work from [DESIGN-SYSTEM.md § 7](DESIGN-SYSTEM.md#7--page-by-page-uiux)
  onward.

> **Start here: [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md)** — the complete
> specification in one file: the palette, fonts, sizes, libraries,
> the toast rule, and per-page UI/UX. The pages below expand on it.

## Who this is for

Tenant staff — sales representatives, account managers, operations people —
working an Arabic-first interface for a full shift, usually on a 1366×768
laptop, moving through dense lists of leads, customers and opportunities. Not
engineers. Not occasional visitors.

Three consequences run through every decision below:

- **Density serves them, microscopic type does not.** The floor is 13px, and
  Arabic gets a lift above that.
- **Controls are touched constantly.** 32px default control height, and since
  the token port that is 32 real pixels rather than the 28.8 a 0.9 scale used
  to produce. Compact and comfortable remain a user setting.
- **Arabic is the default, not a translation.** Direction is a first-class
  layout concern, never a post-processing step.

## The five laws

### 1. Four hues — and a stage is never one of them

Every color in this app is `brand` (cobalt), `positive` (green), `caution`
(amber), `negative` (warm vermilion), or `ink` (the cold-blue neutral ramp).
There is no fifth hue. Those five names are this portal's; the values behind
them are the admin portal's `action` / `success` / `warn` / `danger` / `ink`,
declared here under both spellings.

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

### 2. One superfamily, two scripts

Text is set in **IBM Plex Sans** and **IBM Plex Sans Arabic** — two families
drawn against each other by one team, ordered Latin-then-Arabic in a single
stack. The browser resolves `font-family` per character, so a status badge's
Latin enum value sitting inside an Arabic sentence renders in Plex Sans while
the sentence renders in Plex Sans Arabic, on the same line, without jumping
baseline or x-height.

This removes an entire class of bug: no `:lang()` switching, no per-script font
stack in components, no second set of vertical metrics to reconcile. See
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
| Third-party UI/UX audit — 17 gaps to refactor | [SKILL-AUDIT.md](SKILL-AUDIT.md) |
| Color roles, OKLCH ramps, semantic tokens, status mapping | [tokens.md](tokens.md) |
| Font pairing, type scale, weights, Arabic lift, numerals | [typography.md](typography.md) |
| Radius, spacing, control heights, row density, elevation | [geometry.md](geometry.md) |
| Animation budget and permitted keyframes | [motion.md](motion.md) |
| Icon sizes, the one RTL mirror, the icon-per-concept map | [icons.md](icons.md) |
| Every primitive's props and variants | [primitives.md](primitives.md) |
| Every composite pattern's props | [patterns.md](patterns.md) |
| **Board / card / table — the three-view contract** | [views.md](views.md) |
| Lead & customer detail screens, lead conversion | [detail-screens.md](detail-screens.md) |
| The per-screen accessibility checklist | [accessibility.md](accessibility.md) |
| **The eleven states every data screen renders** | [states.md](states.md) |
| The two nav bars, the page action bar, navigation map | [shell.md](shell.md) |
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
    icons.ts        iconSize, mirrorInRtl — see icons.md
  primitives/       see primitives.md
  patterns/         see patterns.md
  views/            board / card / table — see views.md
  shell/            AppShell, GlobalNav, PageActionBar, NavSheet, nav-config
  feedback/         ToastProvider, useToast, AppToast
```

`src/app/globals.css` is the token source of truth. Feature code imports from
`@/design-system`, never from a deep path — that single indirection is what
lets every screen repaint from a handful of files.

## What comes from `admin-portal`, concretely

This section used to be headed "Why an independent system" and listed the two
techniques worth borrowing. The borrowing has since gone considerably further,
so here is the current line.

**Ported wholesale** — the values, not just the ideas:

- **The ramps.** All five, every step, including the nine that sit outside sRGB
  in the admin file and are written here as the in-gamut OKLCH that round-trips
  to the same hex. See [DESIGN-SYSTEM.md § Ramps](DESIGN-SYSTEM.md#ramps--exact-values).
- **The fonts.** IBM Plex Sans, Plex Sans Arabic, Plex Mono, at 400/500/600.
- **The geometry.** 44px row, the control scale unscaled at `--ui-scale: 1`,
  admin's control paddings, and the five-step radius scale. The *chrome* no
  longer matches: admin's 48px topbar and 240px sidebar were adopted and then
  replaced by two 45px bars, because this portal's shell answers a different
  question — see [shell.md](shell.md#what-is-replaced).
- **The semantic roles**, including everything that did not exist here before:
  `--selected`, the `--info-*` / `--success-*` / `--warning-*` families with
  their `-subtle` and `-vivid` forms, the `--chart-*` set, and the `--sidebar-*`
  family the chrome still draws from under that name — see
  [tokens.md](tokens.md#semantic-tokens).
- **The pointer-target mechanism** — `ds-hit-area` / `ds-hit-target`, minimum
  sizes that expand under `(pointer: coarse)`, replacing a hardcoded inset that
  had been derived from the old 0.9 scale.

**Borrowed earlier, as techniques**:

- **The theme flip** — remapping Tailwind's own built-in color variables onto
  named roles inside `@theme`, so pre-existing `bg-slate-*` call sites repaint
  with zero `.tsx` edits. This is the single highest-leverage migration step
  available and it is hue-agnostic. See [tokens.md](tokens.md#the-theme-flip).
- **shadcn-compatible semantic names** — `--background`, `--card`, `--primary`,
  `--ring` and friends, so `npx shadcn add <x>` pastes in without edits.

**Decided here, from this product's own requirements**: the role *names* and
the runtime brand override they exist to serve, every component, RTL and the
Arabic type lift, the toast rule, the status→role mapping, and all of the
per-screen design.
