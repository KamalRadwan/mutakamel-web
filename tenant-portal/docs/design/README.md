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
  Arabic and English share the same type sizes and line-heights (updated 2026-11-04).
- **Controls are touched constantly.** 32px default control height, and since
  the token port that is 32 real pixels rather than the 28.8 a 0.9 scale used
  to produce. Compact and comfortable remain a user setting.
- **Arabic is the default, not a translation.** Direction is a first-class
  layout concern, never a post-processing step.

## The five laws

### 1. Four hues — and a stage is never one of them

Every outcome and core surface in this app uses `brand` (cobalt), `positive`
(green), `caution` (amber), `negative` (warm vermilion), or `ink` (the
cold-blue neutral ramp). Those five names are this portal's; the values behind
them are the admin portal's `action` / `success` / `warn` / `danger` / `ink`,
declared here under both spellings. Alongside them, eleven theme-adaptive
`--swatch-*` tokens (`indigo`, `green`, `purple`, `blue`, `amber`, `teal`,
`pink`, `red`, `orange`, `yellow`, `slate`) power user-picked card marks
(`card-color.ts`) and structured category/activity-type/entity surface palettes
(`swatch-palette.ts`), always paired with icons and text labels.

The critical corollary, and the law most specific to this product: **pipeline
and lifecycle stages are not colors.** `LeadStageFlagEnum` has 8 values.
`OpportunityStageFlagEnum` has 9. No palette contains 9 hues that stay
distinguishable under colorblindness at badge size — attempting it is what
produces the confetti-colored CRM look.

Stage is communicated by **position, label, and progress**. CRM lifecycle and
category progress use one shared active hue, while outcomes retain semantic
roles (updated 2026-11-04):

| Outcome | Role | Wire values |
| --- | --- | --- |
| Lead/opportunity stage and category progress | `brand` + motion | Intermediate stage flags; category `OPEN`, `IN_PROGRESS` |
| Other in-progress statuses | `ink` + motion | Other status kinds' pending values |
| Succeeded | `positive` | `WON`, `CONVERTED`, `ACTIVE_CUSTOMER` |
| Paused / needs attention | `caution` | `ON_HOLD`, `NURTURING`, `PENDING` |
| Failed / ended badly | `negative` | `LOST`, `DISQUALIFIED`, `BLACKLISTED` |

See [tokens.md](tokens.md#status-mapping) and
[DESIGN-SYSTEM.md § Colorful Swatch & Semantic Surface Palettes](DESIGN-SYSTEM.md#colorful-swatch--semantic-surface-palettes)
for the complete enum-to-role and category-to-swatch tables.

### 2. Two scripts, one font stack

Text is set in **Plus Jakarta Sans** for Latin and **Cairo** for Arabic,
ordered Latin-then-Arabic in a single stack. **IBM Plex Mono** stays for codes
and identifiers. The browser resolves `font-family` per character, so Latin
runs inside an Arabic sentence render in Plus Jakarta Sans while Arabic runs
render in Cairo on the same line.

Components share that stack without `:lang()` switching. Font policy updated
**2026-10-26** for [CRM Leads v3](specs/crm-leads-v3.md#part-1-lead-decisions-binding).

### 3. Five UI weights, 900 banned

UI fonts load **400, 500, 600, 700 and 800**. IBM Plex Mono keeps 400/500/600.
`font-synthesis-weight: none` blocks synthetic bolding. `font-bold` is 700 and
`font-extrabold` is 800; **900 is banned**, with `font-black` remapped to 800 as
a guard. Table body cells stay 400. Weight policy updated **2026-10-26** under
[CRM Leads v3](specs/crm-leads-v3.md#part-1-lead-decisions-binding).

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
| Color roles, OKLCH ramps, semantic tokens, status & swatch mapping | [tokens.md](tokens.md) |
| Font pairing, type scale, weights, bilingual size parity, numerals | [typography.md](typography.md) |
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
  index.ts             public barrel — feature code imports ONLY from here
  lib/
    cn.ts              className merge
    variants.ts        shared CVA fragments: focusRing, controlSize, surface
    icons.ts           iconSize, mirrorInRtl — see icons.md
    swatch-palette.ts  11-hue SwatchSurfacePalette & segmented pill tokens
  primitives/          see primitives.md
  patterns/            see patterns.md
  views/               board / card / table / card-color.ts — see views.md
  shell/               AppShell, GlobalNav, PageActionBar, NavSheet, nav-config
  feedback/            ToastProvider, useToast, AppToast
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
- **The fonts, updated 2026-10-26.** [CRM Leads v3](specs/crm-leads-v3.md)
  replaces the original port's UI faces with Plus Jakarta Sans for Latin and
  Cairo for Arabic at 400/500/600/700/800; 900 is banned. IBM Plex Mono remains
  for codes at 400/500/600.
- **The geometry.** 44px row, the control scale unscaled at `--ui-scale: 1`,
  admin's control paddings, and the five-step radius scale. The *chrome* no
  longer matches: admin's 48px topbar and 240px sidebar were adopted and then
  replaced by two 35px bars, because this portal's shell answers a different
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
Arabic tracking, the toast rule, the status→role mapping, and all of the
per-screen design.

## Accounting design process

The accounting app is the portal's fourth app. Its screens are designed before
their APIs are coded, and each design is reconciled with the frozen contracts
before any screen is built (accounting implementation plan P03, task P03.T08).
The process has three rules.

**1. One brief per subtask.** The lead fills the
[Antigravity brief template](../../../../backend/docs/plans/accounting-app-template-antigravity-brief.md)
for one tracker id (`Pnn.Tmm.Sk`) and saves it as
`backend/.omc/artifacts/ask/accounting/agy-<id>.md`. The brief:

- lists the screen inventory rows it covers, with route, permission, feature key
  and scope target;
- names the DTOs, routes, error codes and enums the screen may use, so the
  design never invents a field;
- tells the designer to consult the `ui-ux-pro-max` skill before designing, as
  this portal's `AGENTS.md` requires.

The run is `agy --model gemini-4-argon-high`, started in the background so it
notifies the lead when it ends. A design run never shares a file with a running
Codex run.

**2. The lead reviews every result against this checklist** before anything is
copied into this folder:

- Every screen traces to a screen inventory row: use case, journey step, route,
  permission, feature key and scope target.
- There are mockups in all four combinations: Arabic RTL and English LTR, each
  in light and dark.
- Status is never carried by colour alone. Only the four role hues are used, and
  the status-to-role mapping of [tokens.md](tokens.md) holds.
- Waiting states show the deadline, the owner and the next allowed action, and
  never imply a resend.
- Error copy states the cause, the effect and the action. A timeout of an
  idempotent write keeps its key.
- Identifiers and amounts are LTR islands with Western digits
  (`ar-EG-u-nu-latn`), and only logical properties are used.
- Every field, filter, action and state maps to a DTO member or a route of the
  accounting Endpoint Catalogue. Each gap is listed in the run's "Contract gaps"
  section. P03.T11 then fixes it in the accounting docs first, or files it for
  its stage.

**3. Approved artifacts move here; drafts do not.** The run writes under
`backend/.omc/artifacts/ask/accounting/`. After the review passes, the lead
copies:

- the spec to `specs/accounting-<name>.md`;
- the mockups to `mockups/accounting-<name>/`;
- each screen's status into the accounting screen inventory
  (`docs/plans/accounting-screen-inventory.md`).

A rejected run gets a new brief with the review findings; nothing from it is
copied. The accounting specs cite the accounting LLD
(`backend/docs/LLD/accounting-app`) and never restate a contract.
