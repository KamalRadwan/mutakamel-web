# Tokens

Status: **Specification**

Written: **2026-08-27**

Source of truth once implemented: `src/app/globals.css`.

> **Superseded on palette and density.** [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) is authoritative for colors, fonts,
> sizes and per-page UI/UX: every ramp value, the fonts and the whole shell
> geometry are now the **admin portal's**, and `--ui-scale` ships at **1**, not
> 0.9. This page keeps the longer reasoning and the exhaustive status mapping.

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
  measures **4.12** on white, below the 4.5 bar. (The light value is now a
  dedicated `oklch(0.518211 0.050915 249.823)` rather than a ramp step; it
  measures 6.31.)
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
| Chrome | `--sidebar`, `--sidebar-foreground`, `--sidebar-active`, `-primary`, `-accent`, `-selected`, `-border`, `-ring` | The shell's own copies, so re-theming chrome does not disturb the body. The `sidebar` spelling outlived the sidebar: `brand-ramp.ts` validates `--sidebar-active` under the `sidebarActiveLight` / `sidebarActiveDark` contrast pairs, and the name is shared with `admin-portal` |

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

The chrome is a light surface in light mode. Both nav bars paint `--card` —
white in light, `ink-950` in dark — which is also the exact background
`--sidebar-active`'s two contrast pairs are measured against, so the active
marker is validated on the surface it actually sits on. `--sidebar-foreground`
and `--sidebar-active` are the two the shell draws; `--sidebar` itself is now
declared for `admin-portal` parity and consumed by nothing, the same standing
`--radius-xl` has. It is **not**
permanently dark; a permanently dark chrome around a light body is one of the
tells listed in [anti-patterns.md](anti-patterns.md).

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
| `CrmTaskStatusEnum` | `DONE` | positive |
| `CrmTaskStatusEnum` | `CANCELLED` | negative |
| `CrmTaskStatusEnum` | `OPEN`, `IN_PROGRESS` | ink + motion |
| `CrmActivityStatusEnum` | `DONE` | positive |
| `CrmActivityStatusEnum` | `OPEN` | ink + motion |
| `CrmReminderStatusEnum` | `SENT` | positive |
| `CrmReminderStatusEnum` | `CANCELLED` | negative |
| `CrmReminderStatusEnum` | `PENDING` | caution |
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

### Non-outcome values → never a hue

These are **categories**, not states. They take `ink` and are distinguished by
their label and, where useful, an icon:

`CrmProfileTypeEnum` (`INDIVIDUAL`, `CORPORATE`) ·
`CrmActivityTypeEnum` (all 7) ·
`CrmActivityDirectionEnum` (all 3) ·
`CrmCustomFieldTypeEnum` (all 11) ·
`CrmCustomFieldOwnerTypeEnum` (all 5) ·
`CrmReminderChannelEnum` (all 3) ·
`PipelineAccessModeEnum` (both).

`CrmPriorityEnum` is the one deliberate exception: `URGENT` and `HIGH` take
`caution`, `MEDIUM` and `LOW` take `ink`. Priority genuinely is an
attention signal.

### "In progress" is ink plus motion

An in-progress state renders as an `ink` tint with a **pulsing dot** and, for
a pending row, `border-dashed`. Motion carries the state without spending a
hue, and it survives colorblindness in a way a fifth color never would. See
[motion.md](motion.md#the-pending-dot).

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

## Card swatches — the one unsemantic colour set

Eleven marks plus "none": `--swatch-red` · `orange` · `amber` · `yellow` ·
`green` · `teal` · `blue` · `indigo` · `purple` · `pink` · `slate`, declared on
`:root`, overridden in `.dark`, and bridged as `--color-swatch-*` so
`border-swatch-*` and `bg-swatch-*` exist. The values live in
`src/app/globals.css` and are not duplicated here.

**They exist because the theme flip above is right.** A user-chosen card colour
is a private filing mark — its meaning lives in the head of whoever set it — so
no role ramp can supply one, and the flip deliberately collapses Tailwind's 22
families onto four hues. That is correct for `bg-red-500` and fatal for a
picker whose whole point is eleven colours a person can tell apart.

Four rules keep them from becoming a second palette:

- **Consumed for a card border and for the swatch that picks it, nothing else.**
  The class strings live in one file, `src/design-system/views/card-color.ts`,
  and are written out rather than built from the colour name — Tailwind extracts
  classes by scanning source text, so an interpolated `bg-swatch-…` generates no
  CSS at all and every swatch renders transparent.
- **No ramp steps.** One value per theme, so there is nothing to choose wrongly,
  and no numeric suffix for the census's raw-palette regex to catch.
- **Never the sole carrier of meaning.** The picker names every swatch in words,
  the chosen one is marked by a ring rather than by hue, and the border only
  restates a colour the user assigned themself.
- **Hue-spread, not luminance-spread**, each at 92% of the in-gamut chroma
  ceiling for its lightness. `scripts/design/contrast.mjs` parses both theme
  blocks and computes all 22 pairs against that theme's `--card` at the 3:1
  non-text bar; a swatch declared on `:root` and forgotten in `.dark` fails the
  parse rather than shipping a light colour onto a dark card.

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
