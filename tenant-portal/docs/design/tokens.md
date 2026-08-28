# Tokens

Status: **Specification**

Written: **2026-08-27**

Source of truth once implemented: `src/app/globals.css`.

> **Superseded on palette and density.** [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) is authoritative for colors, fonts,
> sizes and per-page UI/UX: the neutral ramp is **cold blue** (hue 240), not warm
> graphite, and controls/rows are **32px/36px**, not 36px/40px. This page keeps the
> longer reasoning and the exhaustive status mapping.

## The four roles

| Role | Ramp | Hue | Meaning |
| --- | --- | --- | --- |
| Brand | `brand` | **258** (blue) | Primary actions, active nav, focus rings, links |
| Positive | `positive` | **168 → 160** (teal-green) | Won, converted, active, healthy |
| Caution | `caution` | 82 → 56 (amber) | On hold, nurturing, degraded, needs attention |
| Negative | `negative` | **20 → 13** (crimson) | Lost, disqualified, blacklisted, destructive, error |
| Neutral | `ink` | **240** (cold blue) | Text, borders, surfaces, and **every in-progress state** |

> The earlier version of this table specified a petrol brand (hue 216–226) on a
> **warm graphite** neutral, and argued at length for both. That palette is
> superseded — the product direction is a **cold blue** light theme. The
> rationale for the current hues, including why `positive` moved to teal-green
> and `negative` to crimson to stay coherent against a cold ground, is in
> [DESIGN-SYSTEM.md § Color](DESIGN-SYSTEM.md#1--color).

`ink` has **13 steps**. `ink-25` exists because a dense table needs a zebra
row one step above `50`; `ink-1000` exists because the dark canvas must sit
below the darkest card surface. Tailwind's stock 11-step families have neither.

## Ramps

> **The ramp values that were here are superseded and have been removed.**
> They specified the earlier petrol/warm-graphite palette (brand hue 221, ink
> hue ~75). The implemented palette is **cold blue** — brand hue 258, ink hue
> 240 — and its 57 exact OKLCH values live in one place only:
> **[DESIGN-SYSTEM.md § Ramps](DESIGN-SYSTEM.md#ramps--exact-values)**.
>
> They were deleted rather than left with a warning because they were valid,
> copyable CSS: an agent skimming for "the ramps" would have implemented the
> wrong palette and every contrast number in this file with it.

The structural decisions behind the ramps **do** still hold, and are why the
current palette is shaped the way it is:

- **`ink` carries 13 steps, not 11.** A dense table needs a zebra row one step
  above `50`, and the dark canvas has to sit below the darkest card surface.
  Tailwind's stock families have neither, so `ink-25` and `ink-1000` are
  additions.
- **Amber's hue torsion is physics, not taste.** The `caution` ramp travels
  from hue 82 down to 56 as it darkens; without that drift the 700–950 steps
  read olive rather than amber.
- **Each role peaks its chroma mid-ramp.** The 50 and 950 ends stay low-chroma
  so tints and dark fills do not turn muddy.
- **Matching numeric steps across roles are near-luminance matched**, which is
  what lets the theme flip swap a family without anything going unreadable.


## Contrast resolution

Every ratio is **computed, not estimated** — `node scripts/design/contrast.mjs`
reproduces them and fails if any token falls outside the sRGB gamut.

**The authoritative table is [DESIGN-SYSTEM.md § Measured contrast](DESIGN-SYSTEM.md#measured-contrast).**
It is not duplicated here: two copies of a number that must match the running
CSS is exactly how one of them goes quietly wrong.

Two facts worth carrying in your head:

- The brand fill uses **different ramp steps per theme** — a single step cannot
  clear 4.5:1 against both a light and a dark ground.
- The **focus ring is the tightest value in the system** (3.74 against a 3.0
  bar for non-text). Do not lighten `ink-50` or lower `brand-500`'s chroma
  without re-running the script.

### Two rules whose original justification was wrong

Both rules stand. The reasons first given for them did not survive measurement,
and are corrected here rather than quietly left in place:

- **`--muted-foreground` is `ink-600`, not `ink-500`.** Correct as stated:
  `ink-500` measures **4.32** on white, below the 4.5 bar.
- **Destructive is `negative-700`, not `negative-600`.** The original claim was
  that `negative-600` *fails* contrast. It does not — it measures **5.09** with
  a white label and would be acceptable. `negative-700` (7.07) is kept as a
  **margin choice**, not a compliance requirement.
- **Amber is never a filled button.** The original claim was that no `caution`
  step clears 4.5:1 against both label colors. That is false:
  `caution-500` with an `ink-950` label measures **8.42**. The rule stands on
  **semantic** grounds instead — a filled button reads as *the* action on a
  screen, and "caution" is not an action; a second filled hue also competes
  with the brand fill for the one-primary-per-screen rule in
  [geometry.md](geometry.md#the-one-filled-action-rule-as-geometry). Caution
  stays border, tint, dot, or text.

## Semantic tokens

Named to match the shadcn/ui registry exactly, so `npx shadcn add <x>` pastes
in with no edits. Declared on `:root` and overridden in `.dark`.

**Trap:** shadcn's `--accent` means *neutral hover fill*, not brand. It stays
`ink` here on purpose. Brand-as-accent lives only in `--primary` and `--ring`.
Wiring a new component's hover to `--accent` expecting brand blue is the single
most common way to reintroduce the "everything glows the accent color" look.

| Token | Light | Dark |
| --- | --- | --- |
| `--background` | `ink-50` | `ink-1000` |
| `--foreground` | `ink-900` | `ink-100` |
| `--canvas` | `ink-100` | `ink-1000` |
| `--card` | `white` | `ink-950` |
| `--card-foreground` | `ink-900` | `ink-100` |
| `--popover` | `white` | `ink-900` |
| `--popover-foreground` | `ink-900` | `ink-100` |
| `--primary` | `brand-600` | `brand-400` |
| `--primary-foreground` | `white` | `ink-950` |
| `--secondary` | `ink-100` | `ink-800` |
| `--secondary-foreground` | `ink-800` | `ink-100` |
| `--muted` | `ink-100` | `ink-900` |
| `--muted-foreground` | `ink-600` | `ink-400` |
| `--accent` | `ink-100` | `ink-800` |
| `--accent-foreground` | `ink-900` | `ink-100` |
| `--destructive` | `negative-700` | `negative-700` |
| `--destructive-foreground` | `white` | `white` |
| `--border` | `ink-200` | `ink-800` |
| `--input` | `ink-200` | `ink-800` |
| `--ring` | `brand-500` | `brand-400` |
| `--row-zebra` | `ink-25` | `ink-950` |
| `--sidebar` | `white` | `ink-950` |
| `--sidebar-foreground` | `ink-800` | `ink-200` |
| `--sidebar-active` | `brand-700` | `brand-300` |

The sidebar is a light surface in light mode. It is **not** permanently dark —
a permanently dark chrome around a light body is one of the tells listed in
[anti-patterns.md](anti-patterns.md).

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

## Elevation and control tokens

```css
:root {
  --size-control-xs: 1.75rem;  /* 28px */
  --size-control-sm: 2rem;     /* 32px */
  --size-control-md: 2.25rem;  /* 36px — default */
  --size-control-lg: 2.5rem;   /* 40px */
  --size-control-xl: 2.75rem;  /* 44px */

  --size-row: 2.5rem;          /* 40px — DataTable row */

  --elevation-pop:     0 1px 2px oklch(0.172 0.008 79 / 0.08),
                       0 2px 6px oklch(0.172 0.008 79 / 0.06);
  --elevation-overlay: 0 2px 4px oklch(0.172 0.008 79 / 0.10),
                       0 8px 24px oklch(0.172 0.008 79 / 0.12);
}

.dark {
  /* Dark mode substitutes a top inset hairline for shadow — a heavier
     shadow against an already-dark canvas reads as mud. */
  --elevation-pop:     inset 0 1px 0 oklch(1 0 0 / 0.06);
  --elevation-overlay: inset 0 1px 0 oklch(1 0 0 / 0.08),
                       0 8px 24px oklch(0 0 0 / 0.40);
}
```

Both must be bridged into Tailwind through `@theme inline` as `--shadow-pop`
and `--shadow-overlay`, or the `shadow-pop` / `shadow-overlay` utilities
generate **nothing at all** and every popover silently renders flat. Verify
this after implementing — it is a known trap that shipped undetected in the
sibling portal.

See [geometry.md](geometry.md) for how these are consumed.

## Charts

There is no generic 5-slot categorical chart palette, and one must not be
invented. The system has four hues; four hues cannot encode an arbitrary
categorical breakdown, and cycling or generating hues produces exactly the
unvalidated rainbow this system exists to prevent.

- A breakdown that **is** a status (`byStatus`, win/loss, stage outcome) uses
  the four roles directly. This covers most CRM charts.
- A genuinely qualitative breakdown (`bySource`, `byOwner`, `byCountry`) uses
  **top-N plus "Other" in a single-hue sequential ramp** — `brand-200` through
  `brand-800`. Order carries the meaning, not hue.
- Never place `caution` and `negative` adjacent as fills. They sit ~30° apart
  and fail the perceptual-distance floor for normal vision, which secondary
  encoding does not excuse.
