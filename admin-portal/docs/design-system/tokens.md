# Tokens

Status: **[Verified]**

Last source verification: **2026-08-26**

Owner: **Admin Portal**

Source: `src/app/globals.css`.

## The four roles

Every color in the app is one of four roles. There is no fifth hue.

| Role | Meaning | Ramp name |
| --- | --- | --- |
| Brand | Primary actions, active nav, focus rings, success/healthy | `brand` (emerald, hue 158→168, anchored at 400 = `#34d399`, the logo color) |
| Danger | Destructive actions, errors, failed states | `danger` (warm vermilion, hue 26→30 — deliberately *not* rose/hue ~15, which reads pink and fights amber) |
| Warn | Caution, degraded, needs-attention — border/tint/dot/text only, **never a filled button** | `warn` (amber, hue 92→44; the large hue torsion is deliberate, or the low steps read as olive) |
| Ink | Everything else: text, borders, surfaces, and every neutral/informational state | `ink` (hue 232→245, half the chroma of Tailwind's slate and rotated ~25° cooler — "machined steel, not denim") |

Each ramp has 11 steps (50→950); `ink` has 13 (`ink-25` and `ink-1000` added
because a dense admin table needs a zebra-row step above 50 and a
dark-canvas step below 950 that Tailwind's stock 11-step families don't
have).

### Killing "in progress = blue"

Before this migration, blue carried `PROVISIONING` / `RUNNING` / `TRIAL` /
`PARTIALLY_PAID` — a fifth de facto hue with no name. It is not reintroduced.
An in-progress state is **neutral + motion**: `ink` tint, a pulsing dot,
`border-dashed`. Motion communicates state without needing a hue, and it
survives colorblindness in a way a 5th color never would — `StatusBadge`
always renders a text label anyway, so the color is reinforcement, not the
only signal.

## The theme flip

`src/app/globals.css` remaps Tailwind's own built-in color family variables
(`--color-blue-500`, `--color-slate-200`, …) directly onto the four roles —
see the "THE THEME FLIP" block. Every existing `bg-slate-900` /
`text-blue-400` / `bg-emerald-500` class in the app repaints onto the new
palette with zero `.tsx` edits, because `@theme` merges over Tailwind's
defaults and the last declaration of a given `--color-*` variable wins.

```text
brand  (success/healthy) <- emerald, green
danger                   <- red, rose
warn                      <- amber, orange, yellow
ink    (everything else) <- slate, gray, zinc, neutral, stone, lime, teal,
                             cyan, sky, blue, indigo, violet, purple,
                             fuchsia, pink
```

The old family names stay functional on purpose — new code should reach for
the semantic tokens (`bg-card`, `text-danger-600`) or the four role names
directly (`bg-brand-500`), not `bg-emerald-500`, but nothing breaks if it
doesn't. Once nothing references a family name, Phase 25 deletes its
override.

## Semantic roles

Named to match the shadcn/ui registry exactly (`background` / `foreground` /
`card` / `popover` / `primary` / `secondary` / `muted` / `accent` /
`destructive` / `border` / `input` / `ring` / `chart-1..5` / `sidebar*`), so
`npx shadcn add <x>` pastes into this app with zero edits.

**Trap:** shadcn's own `--accent` means "neutral hover fill", not brand. It
stays `ink-100` / `ink-800` here on purpose — brand as an accent lives only
in `--primary` and `--ring`. Wiring a new component's hover state to
`--accent` expecting green is the single most common way to reintroduce the
AI-generated "everything glows the accent color" look this migration removed.

| Token | Light | Dark |
| --- | --- | --- |
| `--background` | `ink-50` | `ink-1000` |
| `--foreground` | `ink-900` | `ink-100` |
| `--card` / `--popover` | `white` / `white` | `ink-950` / `ink-900` |
| `--primary` | `brand-500` | `brand-400` |
| `--primary-foreground` | `ink-950` | `ink-950` |
| `--secondary` | `ink-100` | `ink-800` |
| `--muted-foreground` | `ink-600` | `ink-400` |
| `--accent` | `ink-100` | `ink-800` |
| `--destructive` | `danger-700` | `danger-700` |
| `--border` / `--input` | `ink-200` | `ink-800` |
| `--ring` | `brand-500` | `brand-400` |
| `--chart-1..5` | brand-500 / ink-500 / warn-500 / danger-500 / brand-800 | brand-400 / ink-400 / warn-400 / danger-400 / brand-300 |
| `--sidebar` | `white` | `ink-950` |

`--chart-1..5` remain a placeholder qualitative palette — Phase 22 (dashboard
chart restoration) did not end up routing any wired chart through them, since
each restored chart encodes categorical, chart-specific data-series meaning
in its own hex values rather than a generic 5-slot palette (see
[migration.md](migration.md#phase-22)). The tokens stay defined and correctly
themed for the next component that does want a generic series palette.

## Why `#34d399` is a dark-mode accent, not a light-mode fill

White text on `brand-500` is roughly 1.9:1 contrast — nowhere near
accessible. Three distinct roles solve this instead of one flat "primary"
value:

| Role | Light | Dark | Ratio |
| --- | --- | --- | --- |
| Fill (`--primary`) | `brand-500` + `ink-950` label | `brand-400` + `ink-950` label | 7.9:1 / 9.8:1 |
| Text/link | `brand-700` | `brand-300` | 4.6:1 / 11.8:1 |
| Ring | `brand-500` | `brand-400` | ≥3:1 |

A **dark label on the bright emerald fill in both themes** is the opposite
of shadcn's default (white-on-primary) and is the accessible choice here —
it also keeps the literal logo color on screen instead of darkening it.
`--muted-foreground` is `ink-600` / `ink-400`, not the more obvious `ink-500`,
because `ink-500` fails at 3.1:1. `--destructive` is `danger-700` in both
themes, not `danger-600`, which fails at ~3.4:1 with white text. Amber is
never a filled button for the same reason — no step in the `warn` ramp clears
AA against both a white and a dark label at button-fill size.

## Control-height and gradient/blur tokens

`--size-control-xs..xl` (24/28/32/36/40px) are consumed by
`src/design-system/lib/variants.ts`'s `controlSize` CVA fragment — see
[geometry-and-density.md](geometry-and-density.md).

The gradient budget is 3 total in the whole app (brand mark, sticky-header
fade, `Skeleton`'s shimmer keyframe); the blur budget is 1 (the modal scrim).
`node scripts/design/census.mjs --check` fails the build if either grows
without an explicit baseline update, which is why Phase 22's recovered chart
tooltip had its `backdrop-blur-md` removed rather than kept.

## Elevation tokens: `--shadow-pop` / `--shadow-overlay`

`--elevation-pop` / `--elevation-overlay` (bridged through `@theme inline` to
the `shadow-pop` / `shadow-overlay` utilities, same reason `--background`
needs the inline bridge — see "The theme flip" above) were referenced by 11
call sites — `Dialog`, `AlertDialog`, `Sheet`, `Select`, `Popover`, `Tooltip`,
`DropdownMenu`, `AppToast`, the `Switch` thumb, and `surface.raised` in
`lib/variants.ts` — but were never defined anywhere in this file. Under
Tailwind v4 an undefined `--shadow-*` theme key generates no utility, so
every one of those surfaces rendered with **no shadow at all** until this was
fixed. Light values are a two-layer `ink`-tinted shadow (small for `pop`,
larger for `overlay`); per the "Dark mode substitutes a top inset hairline"
rule in [geometry-and-density.md](geometry-and-density.md#elevation), the
dark values are an inset top highlight instead of a heavier shadow.

The third documented shadow, `sticky`, has no token and no `shadow-sticky`
utility — `DashboardTabsNav.tsx`'s sticky tab strip uses Tailwind's stock
`shadow-xs` instead. Treat `sticky` as aspirational until a token is built,
the same way the density-toggle in geometry-and-density.md is aspirational.

## Chart colors: `--chart-1..5` are a status ramp, not a categorical palette

`--chart-1..5` alias onto the four semantic ramps (`brand-500`, `ink-500`,
`warn-500`, `danger-500`, `brand-800` in light; the `-400`/`-300` steps in
dark). Run through `scripts/validate_palette.js` from the `dataviz` skill
(6-check colorblind/contrast validator), both modes **fail** as a 5-slot
categorical palette:

- Light on `#ffffff`: `brand-800` outside the lightness band; `ink-500` and
  `brand-800` read as gray (below the chroma floor); contrast WARN on
  `brand-500` (2.38:1) and `warn-500` (2.27:1), both under 3:1.
- Dark on `#091219`: all 5 steps outside the lightness band; `ink-400` below
  the chroma floor.

This is structural, not a bad step choice: the token system has only **four
hues** (`brand` ~165°, `ink` ~236°, `warn` ~74°, `danger` ~27°). `warn` and
`danger` are ~47° apart, and at every step pairing tested they land at
ΔE ≈15.0 normal-vision — at or below the hard floor of 15, which secondary
encoding does not excuse. Re-stepping light to the `600` steps clears the
contrast failures (all ≥3:1) but warn↔danger still cannot be adjacent fills.

**Rule:** use `--chart-1..5` only where the category genuinely *is* a status
(good/neutral/warn/bad) — most breakdowns in this app are `byStatus`, so this
is usually correct as-is. Never use them as an arbitrary categorical palette
for 5 unrelated series. A genuinely qualitative breakdown (`byCountry`,
`byProvider`) needs hues this system doesn't have — take top-N + "Other"
with a single hue, or add validated qualitative hues; never cycle or
generate one. Phase 22's dashboard charts sidestepped this by hand-picking
per-chart hex values instead of drawing from `--chart-*` — see
`src/app/(shell)/dashboard/components/charts/`; those values are unvalidated
and a candidate for a follow-up pass with the same validator.
