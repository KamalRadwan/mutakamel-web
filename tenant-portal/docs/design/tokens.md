# Tokens

Status: **Specification**

Written: **2026-08-27**

Updated: **2026-10-26** — [CRM Leads v3 Ocean Navy token contract](specs/crm-leads-v3.md).

Source of truth once implemented: `src/app/globals.css`.

> **Authoritative token contract (2026-10-26).** [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) and
> [specs/crm-leads-v3.md](specs/crm-leads-v3.md) define the shipped ramps,
> semantic roles, named gradients, shadows, radii and sizes (`--ui-scale: 1`).
> Spec blues map onto `--color-brand-*` so tenant white-labelling survives, while
> the Ocean Navy header, brand strip and avatar gradients remain fixed chrome.
> This page keeps the structural reasoning, the v3 role architecture and the
> exhaustive status mapping.

## The four roles

| Role | Ramp | Admin's name | Hue | Meaning |
| --- | --- | --- | --- | --- |
| Brand | `brand` | `action` | cobalt, ~254 → 267 | Primary actions, active nav, focus rings, links |
| Positive | `positive` | `success` | 149–164 (green) | Won, converted, active, healthy |
| Caution | `caution` | `warn` | 92 → 44 (amber) | On hold, nurturing, degraded, needs attention |
| Negative | `negative` | `danger` | 30 → 26 (vermilion) | Lost, disqualified, blacklisted, destructive, error |
| Neutral | `ink` | `ink` / `surface` | 232 → 245 (cold blue) | Text, borders, surfaces, and **every in-progress state** |

> **The role names are the only thing that did not move.** The values are the
> admin portal's; `brand` / `positive` / `caution` / `negative` / `ink` stay
> because `src/lib/branding/apply-branding.ts` writes `--color-brand-*` on
> `:root` at runtime for a white-labelled tenant, and because ~360 feature call
> sites, the theme flip below and `scripts/design/contrast.mjs` all key off
> these spellings. Admin's own names are declared as **aliases**
> (`--color-action-*`, `--color-success-*`, `--color-warn-*`, `--color-danger-*`,
> `--color-surface-*`), so markup lifted from the admin portal resolves here
> unedited. The rationale for the current hues is in
> [DESIGN-SYSTEM.md § Color](DESIGN-SYSTEM.md#1--color).

`ink` has **13 steps**. `ink-25` exists because a dense table needs a zebra
row one step above `50`; `ink-1000` exists because the dark canvas must sit
below the darkest card surface. Tailwind's stock 11-step families have neither.
Steps `25`–`300` do double duty as the light surface ramp — that is the range
admin spells `--color-surface-*`.

## Ramps

**Contact-channel identity exception — 2026-09-07:** the explicitly requested
authentic service marks use `--color-channel-whatsapp` and
`--color-channel-telegram`, centralized in `globals.css`. They identify only
those services and are not additional outcome roles, stage colors, body-text
colors, or tenant-brand overrides. See [contact channel marks](icons.md#contact-channel-marks).

> **The exact values are not duplicated here.** All 57 OKLCH steps live in one
> place only: **[DESIGN-SYSTEM.md § Ramps](DESIGN-SYSTEM.md#ramps--exact-values)**,
> mirroring `src/app/globals.css`.
>
> This page has twice carried a full, copyable ramp block that later went
> stale — first the petrol/warm-graphite palette, then the cold-blue one the
> admin port replaced. Both times an agent skimming for "the ramps" would have
> implemented the wrong palette and every contrast number with it. The values
> stay in one file.

The structural decisions behind the ramps **do** still hold, and are why the
current palette is shaped the way it is:

- **`ink` carries 13 steps, not 11.** A dense table needs a zebra row one step
  above `50`, and the dark canvas has to sit below the darkest card surface.
  Tailwind's stock families have neither, so `ink-25` and `ink-1000` are
  additions.
- **Amber's hue torsion is physics, not taste.** The `caution` ramp travels
  from hue 92 down to 44 as it darkens; without that drift the 700–950 steps
  read olive rather than amber. The port widened the torsion — it did not
  invent it.
- **Each role peaks its chroma mid-ramp.** The 50 and 950 ends stay low-chroma
  so tints and dark fills do not turn muddy.
- **Matching numeric steps across roles are near-luminance matched**, which is
  what lets the theme flip swap a family without anything going unreadable.
- **Nine steps are written in-gamut rather than as admin wrote them.** In the
  admin file those nine sit fractionally outside sRGB and the browser clips
  them. Here they carry the in-gamut OKLCH that round-trips to the exact hex the
  browser already paints — pixel-identical output, and the out-of-gamut check in
  `contrast.mjs` stays meaningful instead of failing on nine known-clipped
  values.

### CRM Leads v3 ramps (`accent`, `aqua`, `ember`, `navy`)

Added **2026-10-26** ([specs/crm-leads-v3.md](specs/crm-leads-v3.md) Part 2) in
section 2 (`@theme`) of `src/app/globals.css`, written as sRGB-in-gamut OKLCH
steps verified by `scripts/design/contrast.mjs`:

| Ramp | Steps | Anchor | Purpose |
| --- | --- | --- | --- |
| `--color-accent-50…950` | 11 | `600 = #0284c7` (Tailwind sky) | Fixed sky chrome highlights, company entity badges (`entity-company-*`), and the secondary stop of `bg-gradient-primary`, `bg-gradient-avatar` and `bg-gradient-logo` — replacing purple/violet |
| `--color-aqua-50…950` | 11 | `600 = #0d9488` (Tailwind teal) | User/owner avatar (`bg-gradient-avatar`) and brand logo (`bg-gradient-logo`) gradient stops |
| `--color-ember-50…950` | 11 | `500 = #f97316` (Tailwind orange) | "Due today" activity health (`--activity-today`), distinct from amber rating stars |
| `--color-navy-800/900/950` | 3 | `#132c52` / `#0f2342` / `#091526` | Fixed Ocean Navy global header stops (`bg-gradient-header`); invariant across light, dark and white-label tenants |

Rating stars (`--star-filled`) bind directly to `#f59e0b` in `:root` and
`#fbbf24` in `.dark` rather than `caution-500` (`#f29a08`) or a separate
`--color-amber-500` ramp token, because section 5 ("The theme flip") already
aliases `--color-amber-*` onto `--color-caution-*`.


## Contrast resolution

Every ratio is **computed, not estimated** — `node scripts/design/contrast.mjs`
reproduces them and fails if any token falls outside the sRGB gamut.

**The authoritative table is [DESIGN-SYSTEM.md § Measured contrast](DESIGN-SYSTEM.md#measured-contrast).**
It is not duplicated here: two copies of a number that must match the running
CSS is exactly how one of them goes quietly wrong.

Three facts worth carrying in your head:

- The brand fill uses **different ramp steps per theme** — a single step cannot
  clear 4.5:1 against both a light and a dark ground.
- The **tightest value in the system is now positive text in light mode**, at
  5.02 against a 4.5 bar (`positive-700` on white). The focus ring used to hold
  that position at 3.40; the ported palette lifted it to 4.86 against a 3.0
  non-text bar. Do not darken `--card` or lower `positive-700`'s lightness
  without re-running the script.
- The gate also carries a **negative control**: `ink-500` as muted text on
  white measures 4.12 and has to keep failing. A palette edit that makes that
  pass has flattened the neutral ramp.

### Three rules whose original justification was wrong

All three rules stand. The reasons first given for them did not survive
measurement, and are corrected here rather than quietly left in place. The
figures below are the ported palette's, recomputed after the port:

- **`--muted-foreground` is not `ink-500`.** Correct as stated: `ink-500`
  measures **4.12** on white, below the 4.5 bar. As of **2026-10-26**
  ([specs/crm-leads-v3.md](specs/crm-leads-v3.md)), `--muted-foreground` is
  `#64748b` in light mode (**4.76:1** on white, **4.56:1** on `--surface-subtle`)
  and `ink-400` in dark mode (**7.78:1** on `--card`). Where the owner spec
  paired `#64748b` with a darker `#f1f5f9` pill fill (4.34:1) or `#dc2626` on
  `#fef2f2` (4.41:1) or white count text on `#d97706` / `#16a34a` / `#ef4444`,
  the token layer steps one Tailwind shade darker so every shipped pair clears
  WCAG AA (`#475569` = **6.92:1**, `#b91c1c` = **5.92:1**, and KPI count fills
  `#b45309` = **5.03:1**, `#15803d` = **5.01:1**, `#dc2626` = **4.83:1**), all
  verified in `CRM LEADS V3 SEMANTIC ROLES` inside `scripts/design/contrast.mjs`.
- **Destructive is `negative-700`, not `negative-600`.** The original claim was
  that `negative-600` *fails* contrast. It does not — it measures **5.01** with
  a white label and would be acceptable. `negative-700` (7.02) is kept as a
  **margin choice**, not a compliance requirement. This survived the port
  intact: the numbers moved by 0.02, the conclusion did not.
- **Amber is never a filled button.** The original claim was that no `caution`
  step clears 4.5:1 against both label colors. That is false:
  `caution-500` with an `ink-950` label measures **8.35**. The rule stands on
  **semantic** grounds instead — a filled button reads as *the* action on a
  screen, and "caution" is not an action; a second filled hue also competes
  with the brand fill for the one-primary-per-screen rule in
  [geometry.md](geometry.md#the-one-filled-action-rule-as-geometry). Caution
  stays border, tint, dot, or text.

> `globals.css`'s comment beside `--destructive` still reads "`-600` fails
> contrast (~3.4:1) with white text". That figure came across with the port and
> is wrong for the values this portal ships — `negative-600` on white measures
> 5.01 here. The **choice** of `negative-700` is right; only the stated reason
> is not. `contrast.mjs` agrees with this page: it lists `ink-500` as the one
> genuine contrast-driven exclusion and explicitly warns against re-adding
> `negative-600` as a contrast claim.

## Semantic tokens

Named to match the shadcn/ui registry exactly, so `npx shadcn add <x>` pastes
in with no edits. Declared on `:root` and overridden in `.dark`.

**Trap:** shadcn's `--accent` means *neutral hover fill*, not brand. It stays
`ink` here on purpose. Brand-as-accent lives only in `--primary` and `--ring`.
Wiring a new component's hover to `--accent` expecting brand blue is the single
most common way to reintroduce the "everything glows the accent color" look.

The full table is in
[DESIGN-SYSTEM.md § Semantic tokens](DESIGN-SYSTEM.md#semantic-tokens); this
page records only what is worth explaining. Four groups arrived with the port
and did not exist before:

| Group | Members | What it is for |
| --- | --- | --- |
| Selection | `--selected`, `--selected-foreground` | The selected-row tint, a surface `--accent` was being overloaded to do |
| Status roles | `--info-*`, `--success-*`, `--warning-*`, and `--destructive-subtle` / `-vivid` | A named role per outcome, each with a filled, a subtle and a vivid form |
| Charts | `--chart-1…5`, `--chart-qualitative-1…6`, `--chart-grid`, `--chart-axis` | See [§ Charts](#charts) |
| Chrome | `--sidebar`, `--sidebar-foreground`, `--sidebar-active`, `-primary`, `-accent`, `-selected`, `-border`, `-ring` | The shell's own copies, so re-theming chrome does not disturb the body. The `sidebar` spelling outlived the sidebar: `brand-ramp.ts` validates `--sidebar-active` under the `sidebarActiveLight` / `sidebarActiveDark` contrast pairs, and the name is shared with `admin-portal`. `NavSheet` is what still draws them |
| Nav surface | `--nav`, `--nav-foreground`, `--nav-muted-foreground`, `--nav-accent`, `--nav-border`, `--nav-active`, `--nav-ring`, over `--color-chrome` | The global nav's own inverted set — see [§ The nav is the one inverted surface](#the-nav-is-the-one-inverted-surface) |

Two distinctions inside the status roles decide how the product reads:

- **`*-subtle` is the `100` step, never the `50`.** The 50 steps carry chroma
  0.014–0.019, which on a 20px status pill is indistinguishable from white — and
  `*-subtle` is the most-used coloured surface in the app, so it single-handedly
  decides whether the portal reads as coloured at all. The 100 step is 2.1–2.4×
  the chroma and every pair still clears AA against its `-700`/`-800` label.
- **`*-vivid` is the non-text accent** — status dots and indicator marks, which
  a text label already names. It answers to the **3:1** graphics bar rather than
  4.5:1, so it can sit far brighter than the dark steps a filled role needs.
  Those dark steps are exactly what made every badge read grey-green instead of
  green.

`PageActionBar` paints `--surface-toolbar` (`#ffffff` in light, `ink-950` in
dark), matching `--card` so `--sidebar-active`'s two contrast pairs remain
validated on the surface `NavSheet` sits on.

### CRM Leads v3 semantic role groups and named gradients

Added **2026-10-26** ([specs/crm-leads-v3.md](specs/crm-leads-v3.md) Part 2).
Every role is declared in `:root`, overridden in `.dark`, and bridged in
`@theme inline` as `--color-<role>`:

| Group | Tokens | White-label behaviour |
| --- | --- | --- |
| Neutral surfaces & lines | `--surface-{column,column-header,toolbar,subtle}`, `--line-{column,card,control,divider}`, `--foreground-secondary` | Neutral slate/cool-ink staircase in both themes |
| Activity health & pills | `--activity-{none,today,future,overdue}` and `--activity-{none,future,today,overdue}-{surface,line,text}` | Fixed semantic status hues (slate, orange, green, red); dark mode uses low-alpha `rgb(... / 0.14–0.15)` tints with bright pastel text |
| Rating stars | `--star-filled` (`#f59e0b` / `#fbbf24`), `--star-empty` (`#cbd5e1` / `#475569`) | Fixed amber/slate |
| KPI badges | `--kpi-{total,new,rated,qualified,overdue}-{surface,line,text,count}` | `kpi-new-*` maps to `--color-brand-{50,200,800,600}` (light) / `{950,800,200,600}` (dark); count text is `text-white` in both themes |
| Entity & count badges | `--entity-{person,company}-{surface,fg}`, `--count-{active,zero,danger}-{surface,fg}`, `--chip-active-{line,fg}` | `entity-person-*`, `count-active-*` and `chip-active-*` map to `--color-brand-*`; `entity-company-*` maps to `--color-accent-*` |
| Named gradients (`@utility`) | `bg-gradient-header`, `bg-gradient-brand-strip`, `bg-gradient-primary`, `bg-gradient-avatar`, `bg-gradient-logo`, `bg-gradient-canvas`, `bg-gradient-chip-active` | `header`, `brand-strip` and `avatar` stay fixed Ocean Navy / sky-teal chrome; `primary`, `logo` and `chip-active` consume `--color-brand-*` |

### The nav is the one inverted surface

`GlobalNav` is a fixed `58px` (`--size-topbar`) Ocean Navy chrome band in **both**
light and dark modes, crowned by a `3px` `bg-gradient-brand-strip` bar. Its
primary surface is `bg-gradient-header` (`--color-navy-950` `#091526` →
`--color-navy-900` `#0f2342` → `--color-navy-800` `#132c52`), while
`--color-chrome` (`#000068`) remains declared for `brand-ramp.ts` parity and
`.nav-surface` fallback.

| Token | Value (light & dark) | Against `navy-800` (lightest header stop) |
| --- | --- | ---: |
| `--nav-foreground-strong` | `#f8fafc` | 13.78 |
| `--nav-foreground` | `#e2e8f0` | 11.39 |
| `--nav-switcher-fg` on `--nav-switcher-surface` | `#e0f2fe` on `rgb(14 165 233 / 0.16–0.18)` | ≥ 9.23 |
| `--nav-muted-foreground` | `ink-300` | ≥ 8.80 |
| `--nav-active` | `#38bdf8` | 6.82 (non-text ≥ 3.0) |
| `--nav-tab-active-line` / `--nav-chrome-line` | translucent sky / slate hairlines | separation, not legibility |

Every text and non-text pair above is guarded in both themes by
`scripts/design/contrast.mjs`. `.nav-surface` continues to re-point ordinary
semantic names (`--foreground`, `--muted-foreground`, `--accent`, `--border`,
`--ring`) on `<header>` while Radix dropdown/popover portals render under
`<body>` on `--popover`. Active nav pills use `bg-gradient-primary` with
`text-white` and `shadow-nav-active`; the screen's primary CTA lives below in
the floating `48px` `PageActionBar` (`bg-surface-toolbar`).

## Status mapping

**This table is exhaustive.** Every status value the tenant UI can render maps
to exactly one role here. Do not invent a mapping for a value not listed —
if you meet one, it means the enum changed and
[reference/enums.md](../reference/enums.md) needs regenerating from source.

`StatusBadge` always renders a **text label**, so color is reinforcement and
never the only signal.

### Outcome-bearing values → a hue

| Enum | Value | Role |
| --- | --- | --- |
| `LeadStatusEnum` | `CONVERTED` | positive |
| `LeadStatusEnum` | `DISQUALIFIED` | negative |
| `LeadStatusEnum` | `ON_HOLD` | caution |
| `LeadStatusEnum` | `OPEN` | ink + motion |
| `LeadStageFlagEnum` | `CONVERTED`, `QUALIFIED` | positive |
| `LeadStageFlagEnum` | `DISQUALIFIED` | negative |
| `LeadStageFlagEnum` | `ON_HOLD`, `NURTURING` | caution |
| `LeadStageFlagEnum` | `NEW`, `CONTACTED`, `QUALIFYING` | ink + motion |
| `OpportunityStatusEnum` | `WON` | positive |
| `OpportunityStatusEnum` | `LOST` | negative |
| `OpportunityStatusEnum` | `ON_HOLD` | caution |
| `OpportunityStatusEnum` | `IN_PROGRESS` | ink + motion |
| `OpportunityStageFlagEnum` | `WON` | positive |
| `OpportunityStageFlagEnum` | `LOST` | negative |
| `OpportunityStageFlagEnum` | `ON_HOLD` | caution |
| `OpportunityStageFlagEnum` | `NEW`, `DISCOVERY`, `QUALIFICATION`, `PROPOSAL`, `NEGOTIATION`, `CONTRACTING` | ink + motion |
| `CustomerStatusEnum` | `ACTIVE_CUSTOMER` | positive |
| `CustomerStatusEnum` | `BLACKLISTED` | negative |
| `CustomerStatusEnum` | `INACTIVE` | caution |
| `CustomerStatusEnum` | `PROSPECT` | ink + motion |
| `StageCategoryEnum` | `POSITIVE` | positive |
| `StageCategoryEnum` | `NEGATIVE` | negative |
| `StageCategoryEnum` | `OPEN`, `IN_PROGRESS` | ink + motion |
| `TenantStatusEnum` | `ACTIVE` | positive |
| `TenantStatusEnum` | `PROVISIONING_FAILED`, `DELETED` | negative |
| `TenantStatusEnum` | `SUSPENDED` | caution |
| `TenantStatusEnum` | `PROVISIONING` | ink + motion |
| `UserStatusEnum` | `ACTIVE` | positive |
| `UserStatusEnum` | `DEACTIVATED` | negative |
| `UserStatusEnum` | `SUSPENDED` | caution |
| `UserStatusEnum` | `INVITED` | ink + motion |
| `SubscriptionStatusEnum` | `ACTIVE` | positive |
| `SubscriptionStatusEnum` | `CANCELLED` | negative |
| `SubscriptionStatusEnum` | `PAST_DUE`, `PENDING_ACTIVATION` | caution |
| `SubscriptionStatusEnum` | `TRIAL` | ink + motion |
| `AccessModeEnum` | `FULL` | positive |
| `AccessModeEnum` | `BLOCKED` | negative |
| `AccessModeEnum` | `DUNNING`, `READ_ONLY` | caution |
| `ActivityStatusEnum` | `DONE` | positive |
| `ActivityStatusEnum` | `CANCELLED` | negative |
| `ActivityStatusEnum` | `PLANNED`, `IN_PROGRESS` | ink + motion |

The four Core lifecycles above were transcribed on **2026-08-30** from
`../backend/mutakamel-apps/core-app/packages/common/src/enums/` —
`tenant-status.enum.ts`, `user-status.enum.ts`, `subscription-status.enum.ts`
and `access-mode.enum.ts`. Two findings worth carrying forward:

- **`SubscriptionStatusEnum` has five values, not four.**
  `PENDING_ACTIVATION` is real and was missing from the lifecycle table in
  [../build/MASTER-PLAN.md](../build/MASTER-PLAN.md). It takes `caution`
  because `SubscriptionEnforcementGuard.statusAccessMode` falls it through to
  `BLOCKED`.
- The subscription roles follow what the subscription actually **permits**,
  not how its name reads: `PAST_DUE` is `DUNNING`, `CANCELLED` is
  `READ_ONLY`, and `TRIAL` is full access while its period is current — hence
  ink + motion rather than caution.

`ActivityStatusEnum` is Core's activity hub
(`packages/common/src/enums/activity.enum.ts`), mapped **2026-09-24** as
`StatusBadge kind="ActivityStatus"`, labels from
`t.statusValues["ActivityStatus.*"]`. `IN_PROGRESS` arrives with the Activities
workspace, between `PLANNED` and `DONE`. **Both open values are ink + motion**:
an activity that has started differs from one that is scheduled by its label,
not by a hue, and neither is an outcome yet. Overdue is not a status — see
[below](#activity-due-state--derived-not-an-enum).

### Activity due state — derived, not an enum

An open activity is also coloured by **when it is due**, measured against now
with the same buckets `GET /activities/summary` counts. It is computed, never
sent as a field, so it has no row in the table above:

| State | When | Role |
| --- | --- | --- |
| Overdue | open, and its end (or its due time, when it has no end) has passed | negative |
| Due today | open, not overdue, due before the end of the reader's day | caution |
| Upcoming | open, due after today | ink — no hue |
| Completed | `DONE` | positive |
| Cancelled | `CANCELLED` | negative, and struck through |

The words always travel with the colour — "Overdue", "Due today" — in the
item's accessible name and in its text, so the hue is reinforcement. A calendar
chip or a board card takes its tone from this table and **never from its
type**.

On CRM boards and cards ([specs/crm-leads-v3.md](specs/crm-leads-v3.md) Part 1 #9–10),
`crmActivityState` classifies `nextActivity` against local midnight (`startOfToday`):
`OVERDUE` (`due < startOfToday`, `--activity-overdue`), `TODAY`
(`startOfToday <= due <= now`, `--activity-today`), `FUTURE` (`due > now`,
`--activity-future`), and `NONE` (`--activity-none`), powering both the card's
`--activity-<state>-{surface,line,text}` pill and the stage column header's
proportional segmented progress bar.

### Structured category & entity palettes (`--swatch-*`) vs generic enums

Generic configuration enums that have no visual icon vocabulary stay neutral (`ink`):

`CrmProfileTypeEnum` (`INDIVIDUAL`, `CORPORATE`) ·
`CrmActivityDirectionEnum` (all 3) ·
`CrmCustomFieldTypeEnum` (all 11) ·
`CrmCustomFieldOwnerTypeEnum` (all 5) ·
`CrmReminderChannelEnum` (all 3) ·
`PipelineAccessModeEnum` (both) ·
Core's `ActivityDirectionEnum` (all 3).

By contrast, **Activity Types (`ACTIVITY_TYPES`)** and **Target Entity Types (`ACTIVITY_TARGET_TYPES`)** use the design system's theme-adaptive `--swatch-*` surface palettes (`src/design-system/lib/swatch-palette.ts`), always paired with their canonical [icon](icons.md#activity-types) and translated text label:

| Domain | Value | Swatch Hue | Token Stem |
| --- | --- | --- | --- |
| `ActivityType` | `TODO` | `indigo` | `swatch-indigo` |
| `ActivityType` | `CALL` | `green` | `swatch-green` |
| `ActivityType` | `MEETING` | `purple` | `swatch-purple` |
| `ActivityType` | `EMAIL` | `blue` | `swatch-blue` |
| `ActivityType` | `VISIT` | `amber` | `swatch-amber` |
| `ActivityType` | `FOLLOW_UP` | `teal` | `swatch-teal` |
| `ActivityType` | `OTHER` | `pink` | `swatch-pink` |
| `ActivityTargetType` | `LEAD` | `indigo` | `swatch-indigo` |
| `ActivityTargetType` | `CUSTOMER_PROFILE` | `green` | `swatch-green` |
| `ActivityTargetType` | `OPPORTUNITY` | `purple` | `swatch-purple` |
| `ActivityTargetType` | `PARTY` | `teal` | `swatch-teal` |
| `ActivityTargetType` | `QUOTATION` | `amber` | `swatch-amber` |
| `ActivityTargetType` | `SALES_ORDER` | `blue` | `swatch-blue` |

**Segmented Status & Priority pill tracks** (`semanticSegmentPillClasses` and `semanticSegmentDotClasses` in `src/design-system/lib/swatch-palette.ts`) use the semantic outcome roles (`info`, `warning`, `success`, `destructive`) plus `swatch-purple` (`IN_PROGRESS`) and `swatch-slate` (`LOW` priority):
- **Status (`ActivityStatusEnum`)**: `PLANNED` → `info` · `IN_PROGRESS` → `purple` (`swatch-purple`) · `DONE` → `success` · `CANCELLED` → `destructive` (while read-only table/list `StatusBadge` keeps `PLANNED` and `IN_PROGRESS` as `ink + motion`).
- **Priority (`ActivityPriorityEnum` / `CrmPriorityEnum`)**: `LOW` → `slate` (`swatch-slate`) · `NORMAL` → `info` · `HIGH` → `warning` · `URGENT` → `destructive`.

### "In progress" is ink plus motion

In read-only `StatusBadge` cells, an in-progress state renders as an `ink` tint with a **pulsing dot** and, for a pending row, `border-dashed`. Motion carries the state without spending a hue, and it survives colorblindness in a way a fifth color never would. See [motion.md](motion.md#the-pending-dot).

## The theme flip

Technique borrowed from `admin-portal` on its merits — it is hue-agnostic and
it is the highest-leverage step available in this migration.

`globals.css` overrides Tailwind's **own built-in** color family variables,
mapping every stock family onto one of the four roles:

```text
brand     <- blue, sky, cyan, indigo, violet, purple, slate*
positive  <- emerald, green, teal, lime
caution   <- amber, orange, yellow
negative  <- red, rose, pink, fuchsia
ink       <- slate, gray, zinc, neutral, stone
```

\* `slate` maps to `ink`, not brand — it is by far the most common family in
the current code (1,075 of 1,992 usages) and it is always doing a neutral job.

Because `@theme` merges over Tailwind's defaults and the last declaration of a
given `--color-*` wins, **all 1,992 existing color utilities in the codebase
repaint from this one block with zero `.tsx` edits** — including the ~940 that
sit in code scheduled for deletion, which therefore cost nothing.

Matching the numeric step (`500` → `500`) keeps luminance close to the old
palette, so nothing goes unreadable and no layout shifts.

The stock family names stay functional on purpose. New code reaches for the
semantic tokens (`bg-card`, `text-muted-foreground`) or the role names
(`bg-brand-600`); the codemod renames existing call sites at its own pace. Once
a family has zero references, delete its override block.

## Swatch tokens — card marks and colorful category surface palettes

Eleven marks plus "none": `--swatch-red` · `orange` · `amber` · `yellow` ·
`green` · `teal` · `blue` · `indigo` · `purple` · `pink` · `slate`, declared on
`:root`, overridden in `.dark`, and bridged as `--color-swatch-*` so
`border-swatch-*`, `bg-swatch-*`, `text-swatch-*`, and `ring-swatch-*` exist.
See [DESIGN-SYSTEM.md § Colorful Swatch & Semantic Surface Palettes](DESIGN-SYSTEM.md#colorful-swatch--semantic-surface-palettes)
for the complete Light and Dark OKLCH/Hex table.

**They exist because the theme flip above is right.** Both user-chosen card
marks and structured multi-item categories (7 activity types, 6 target entity
types) need up to eleven distinguishable hues that survive light and dark mode,
whereas the theme flip deliberately collapses Tailwind's 22 families onto four
outcome ramps.

Four rules keep them disciplined:

- **Consumed only through two design-system modules**:
  1. `src/design-system/views/card-color.ts` — for board/card border marks and
     their picker squares.
  2. `src/design-system/lib/swatch-palette.ts` — for structured category surface
     palettes (`SWATCH_SURFACE_PALETTES`, exposing `tileActive`, `tileIdle`,
     `iconBoxActive`, `iconBoxIdle`, `iconText`, `badge`, `pillActive`,
     `accentBorder`, `sectionCard`, and `dot`).
  Every class string is written out statically in those files because Tailwind v4
  extracts classes by scanning source text; dynamic string interpolation (`bg-swatch-${hue}`)
  would generate no CSS at all.
- **No ramp steps.** One calibrated value per theme (with alpha modifiers `/5`,
  `/10`, `/15`, `/20`, `/25`, `/30`, `/40` for tinted surfaces and rings), so
  there is no numeric suffix for the census's raw-palette regex to catch.
- **Never the sole carrier of meaning.** Card swatches are named in words and
  marked by a ring when selected; category tiles, icon boxes, and badges always
  sit beside their canonical icon and translated text label.
- **Hue-spread, not luminance-spread**, each at 92% of the in-gamut chroma
  ceiling for its lightness. `scripts/design/contrast.mjs` parses both theme
  blocks and computes all 22 pairs against that theme's `--card` at the 3:1
  non-text bar; a swatch declared on `:root` and forgotten in `.dark` fails the
  parse rather than shipping a light colour onto a dark card.

## Tag colours — a pair the tenant owns

Added **2026-09-24**. A tag — in CRM today, in Trade or Accounting when they
grow tags — may carry a colour, and that colour is **two values chosen
together**: a background and a text colour, each an upper-case `#RRGGBB`. It
replaces the earlier rule that a tag's colour was only a leading dot on the one
neutral chip.

Like a card swatch it is a private filing mark, so no role ramp supplies it —
but unlike a swatch it is **text on a fill**, and that changes what has to be
measured:

- **The pair is judged against itself, never against the page.** A chip's
  text sits on the chip's own background, so its legibility does not depend on
  the card, the theme or the tenant's brand. The pair is therefore *not*
  re-tinted for dark mode: a pale chip on a dark card still reads, because its
  text contrast never involved the card.
- **Thirty presets, every one at 4.5:1 or better.** `TAG_COLOR_PRESETS` in
  `src/design-system/primitives/tag-color.ts` — twenty tinted chips (each hue
  family's 100 fill with its 800 text, plus slate/gray/stone) and ten solid
  ones. The hex values are written out because the theme flip above collapses
  the stock families; no utility can supply them. `pnpm design:contrast` parses
  that file and fails on any pair under 4.5:1 or a count other than 30.
- **A custom pair is allowed and always flagged.** `TagColorPicker` shows the
  live ratio and a caution note under 4.5:1. The tenant may know better, so it
  does not block; it never lets a weak pair pass silently.
- **Uncoloured is the default and stays theme-aware.** Both values `null`
  renders the neutral chip (`bg-muted/60`, `text-muted-foreground`,
  `border-border/70`), which the semantic tokens already carry into dark mode.
- **Inline style, inside the design system only.** The pair is tenant data, so
  `TagChip` applies it as `style` — the same exception `chart-common.tsx` takes
  for a legend swatch — after `toTagColor` has proved both values are
  `#RRGGBB`. Feature code passes `backgroundColor`/`textColor` props and never
  writes a colour itself.

## Elevation and control tokens

> **Superseded.** The control scale that was here specified 28/32/36/40/44px.
> The implemented scale is **24/28/32/36/40px**, and since the admin port those
> are the pixel sizes that actually render: `--ui-scale` ships at **1**, so the
> `rem` values are no longer multiplied down. The live block is in
> [DESIGN-SYSTEM.md § Sizing & density](DESIGN-SYSTEM.md#3--sizing--density).
>
> Removed rather than annotated, because it was copyable CSS.

The two elevation values are admin's, and they are **literal `rgb()` shadows**,
not derived from a ramp step: `0 4px 6px -1px rgb(15 23 32 / 0.08)` plus a
tighter second layer for `pop`, and a 20px/8px pair at 0.12/0.08 for `overlay`.
An earlier revision of this page had them mixed from `ink-950` via
`color-mix()`; the port replaced that with admin's fixed values so both portals
cast the same shadow. `rgb(15 23 32)` sits a little above `ink-950` (`#091219`)
and is not derived from it — at 6–12 % opacity the two are near enough that the
loss of the derivation costs nothing but the guarantee. In dark mode both become
a **top inset hairline**
(`inset 0 1px 0 0 rgb(255 255 255 / 0.06 | 0.08)`) — a drop shadow on an
already-dark canvas reads as mud.

Both must be bridged into Tailwind through `@theme inline` as `--shadow-pop`
and `--shadow-overlay`, or the `shadow-pop` / `shadow-overlay` utilities
generate **nothing at all** and every popover silently renders flat. Verify
this after implementing — it is a known trap that shipped undetected in the
sibling portal.

CRM Leads v3 ([specs/crm-leads-v3.md](specs/crm-leads-v3.md) Part 2) extends the
bridged elevation, radius and shell-size tokens with:

- **Shadows (`@theme inline`)**: `--shadow-toolbar`, `--shadow-column`,
  `--shadow-card` (soft `rgb(15 23 42)` drop shadows in `:root`; subtle top
  inset hairlines in `.dark`) and `--shadow-nav-active` (`0 4px 14px rgb(2 132 199 / 0.42)`
  in `:root`, `0.36` in `.dark`).
- **Named radii (`@theme`)**: `--radius-card` (`13px` → `rounded-card`) and
  `--radius-column` (`16px` → `rounded-column`).
- **Scaled chrome & toolbar heights (`:root`, multiplied by `var(--ui-scale)`)**:
  `--size-topbar` (`58px`), `--size-toolbar` (`48px`), and
  `--size-toolbar-control` (`33px`).

The `--text-tab` type step produces `text-tab`, avoiding a utility collision with `--color-nav`; nav foreground color roles stay separate.

See [geometry.md](geometry.md) for how these are consumed.

## Charts

The port brought admin's chart tokens across: `--chart-action` / `-success` /
`-warning` / `-danger`, six `--chart-qualitative-*` slots, `--chart-grid`,
`--chart-axis`, and the shadcn-shaped `--chart-1…5` aliases over them. Every
qualitative slot is held inside L 0.625–0.681 so no series reads as more
important than another before the data says so — hue does the separating — and
the marks sit just above WCAG's 3:1 floor for non-text graphics while the axis,
which is text, keeps 4.5:1.

**No chart in this portal consumes the qualitative slots, and that is the
rule, not an omission.** `src/design-system/patterns/chart/chart-palette.ts`
offers exactly two ways to colour a series, and every chart takes one:

- A breakdown that **is** a status (`byStatus`, win/loss, stage outcome) uses
  the four roles directly, at the `600` step. This covers most CRM charts.
- A genuinely qualitative breakdown (`bySource`, `byOwner`, `byCountry`) uses
  **top-N plus "Other" in a single-hue sequential ramp** — `brand-800` down to
  `brand-200`, darkest slice first. Order carries the meaning, not hue; a
  reader who cannot separate two adjacent blues can still read the ranking.
  Seven steps means six real categories plus "Other", and past that the answer
  is a table, not more colours.
- Never place `caution` and `negative` adjacent as fills. They sit ~30° apart
  and fail the perceptual-distance floor for normal vision, which secondary
  encoding does not excuse. `STATUS_DRAW_ORDER` puts `brand` between them by
  construction; a two-role `{caution, negative}` breakdown, which reordering
  cannot fix, gets a background-coloured stroke between segments instead.

So the six-slot palette exists as a token, because a page copied from the admin
portal has to resolve. Reaching for it from tenant chart code is still the
unvalidated rainbow this system exists to prevent — take one of the two routes
above.
