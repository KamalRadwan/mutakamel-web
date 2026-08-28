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
| Brand | `brand` | 216 → 226 (petrol) | Primary actions, active nav, focus rings, links |
| Positive | `positive` | 142 → 150 (moss) | Won, converted, active, healthy |
| Caution | `caution` | 82 → 56 (amber) | On hold, nurturing, degraded, needs attention |
| Negative | `negative` | 34 → 28 (clay) | Lost, disqualified, blacklisted, destructive, error |
| Neutral | `ink` | 70 → 80 (warm graphite) | Text, borders, surfaces, and **every in-progress state** |

**Why petrol and not blue.** The default SaaS accent sits at hue 250–260. 218
is far enough away to not read as "the Bootstrap blue", close enough to stay
calm for eight-hour use, and it is nowhere near `admin-portal`'s emerald.

**Why a warm neutral.** `ink` is hue ~75 at chroma ~0.010 — a warm graphite,
not a cool slate. Nearly every dense SaaS UI pairs a cool accent with a cool
grey, which is what makes them read interchangeable and clinical. Warm grey
under a cool accent reads as ink on paper, and it measurably softens long
Arabic reading sessions where the script's density already carries a lot of
visual weight.

`ink` has **13 steps**. `ink-25` exists because a dense table needs a zebra
row one step above `50`; `ink-1000` exists because the dark canvas must sit
below the darkest card surface. Tailwind's stock 11-step families have neither.

## Ramps

Declared in `@theme` so they generate `bg-brand-600`, `text-ink-500`, etc.

```css
@theme {
  /* Brand — petrol. Hue drifts warmer as it darkens so low steps do not
     collapse into navy-grey. Anchored at 600, the light-mode fill. */
  --color-brand-50:  oklch(0.974 0.012 216);
  --color-brand-100: oklch(0.941 0.028 217);
  --color-brand-200: oklch(0.887 0.053 218);
  --color-brand-300: oklch(0.812 0.083 219);
  --color-brand-400: oklch(0.722 0.111 220);
  --color-brand-500: oklch(0.631 0.111 221);
  --color-brand-600: oklch(0.540 0.096 222);
  --color-brand-700: oklch(0.456 0.082 223);
  --color-brand-800: oklch(0.386 0.070 224);
  --color-brand-900: oklch(0.325 0.059 225);
  --color-brand-950: oklch(0.224 0.043 226);

  /* Ink — warm graphite. 13 steps: ink-25 is the table zebra row above 50,
     ink-1000 is the dark canvas below the darkest card. */
  --color-ink-25:   oklch(0.991 0.002 70);
  --color-ink-50:   oklch(0.981 0.003 70);
  --color-ink-100:  oklch(0.959 0.004 72);
  --color-ink-200:  oklch(0.917 0.006 73);
  --color-ink-300:  oklch(0.857 0.008 74);
  --color-ink-400:  oklch(0.704 0.011 75);
  --color-ink-500:  oklch(0.578 0.012 76);
  --color-ink-600:  oklch(0.476 0.012 76);
  --color-ink-700:  oklch(0.394 0.011 77);
  --color-ink-800:  oklch(0.312 0.010 78);
  --color-ink-900:  oklch(0.244 0.009 79);
  --color-ink-950:  oklch(0.172 0.008 79);
  --color-ink-1000: oklch(0.128 0.007 80);

  /* Positive — moss. Lower chroma and cooler than a notification green:
     "earned", not "alert". Deliberately far from admin-portal's emerald. */
  --color-positive-50:  oklch(0.972 0.016 142);
  --color-positive-100: oklch(0.940 0.036 143);
  --color-positive-200: oklch(0.884 0.066 144);
  --color-positive-300: oklch(0.812 0.096 145);
  --color-positive-400: oklch(0.728 0.117 146);
  --color-positive-500: oklch(0.640 0.121 147);
  --color-positive-600: oklch(0.548 0.110 148);
  --color-positive-700: oklch(0.462 0.092 148);
  --color-positive-800: oklch(0.390 0.075 149);
  --color-positive-900: oklch(0.330 0.060 150);
  --color-positive-950: oklch(0.226 0.041 150);

  /* Caution — amber. The 26-degree hue torsion toward orange is physics,
     not taste: without it the 700-950 steps read olive. */
  --color-caution-50:  oklch(0.981 0.018 82);
  --color-caution-100: oklch(0.957 0.043 81);
  --color-caution-200: oklch(0.914 0.083 78);
  --color-caution-300: oklch(0.863 0.124 74);
  --color-caution-400: oklch(0.809 0.150 69);
  --color-caution-500: oklch(0.755 0.154 64);
  --color-caution-600: oklch(0.663 0.146 60);
  --color-caution-700: oklch(0.548 0.128 58);
  --color-caution-800: oklch(0.458 0.104 57);
  --color-caution-900: oklch(0.392 0.084 56);
  --color-caution-950: oklch(0.257 0.056 56);

  /* Negative — clay. Warm red at hue ~30. Not rose (~15), which reads pink
     and fights amber at badge size. */
  --color-negative-50:  oklch(0.971 0.014 34);
  --color-negative-100: oklch(0.939 0.031 33);
  --color-negative-200: oklch(0.886 0.060 32);
  --color-negative-300: oklch(0.810 0.101 31);
  --color-negative-400: oklch(0.714 0.155 30);
  --color-negative-500: oklch(0.634 0.196 29);
  --color-negative-600: oklch(0.563 0.204 29);
  --color-negative-700: oklch(0.483 0.177 28);
  --color-negative-800: oklch(0.407 0.145 28);
  --color-negative-900: oklch(0.349 0.119 28);
  --color-negative-950: oklch(0.230 0.081 28);
}
```

## Contrast resolution

The brand fill uses **different steps in each theme**, because one step cannot
serve both grounds:

Every ratio below is **computed**, not estimated — run
`node scripts/design/contrast.mjs` to reproduce. That script also fails if any
token falls outside the sRGB gamut, and it is what caught the brand ramp's
original chroma being 6–15% too high at steps 500–900 (the browser would have
silently clipped them to a different color than specified).

| Use | Light | Dark | Computed ratio |
| --- | --- | --- | --- |
| Fill (`--primary`) | `brand-600` + white label | `brand-400` + `ink-950` label | **4.91** / **8.00** |
| Text and links | `brand-700` on white | `brand-300` on `ink-1000` | **7.07** / **11.51** |
| Focus ring (non-text, needs 3.0) | `brand-500` on `ink-50` | `brand-400` on `ink-1000` | **3.19** / **8.46** |
| Muted text | `ink-600` on white | `ink-400` on `ink-1000` | **6.66** / **7.65** |
| Body text | `ink-900` on `ink-50` | `ink-100` on `ink-1000` | **15.41** / **17.89** |
| Destructive fill | `negative-700` + white | `negative-700` + white | **7.07** |

`brand-500` at 3.19 is the tightest number in the system. It is a **non-text**
focus ring, where the bar is 3.0 — but it has only 0.19 of headroom, so do not
lighten `ink-50` or lower `brand-500`'s chroma without re-running the script.

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
Wiring a new component's hover to `--accent` expecting petrol is the single
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
