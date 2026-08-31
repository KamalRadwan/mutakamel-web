# Tokens

Status: **[Verified current source; approved target differs]**

Last source verification: **2026-08-29**

Owner: **Admin Portal**

Source: `src/app/globals.css`.

## Approved target

[Cold-Blue Design Update](design-update.md#semantic-color-architecture) is the
normative target for new work. It separates cobalt `action` from emerald
`success` and introduces explicit cold-blue surface roles. The four-role model
below documents current source only; do not recolor the combined `brand` ramp
blue in place.

## Current four roles

Current source routes color through four roles. This is the migration baseline,
not the final semantic contract.

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

### "In progress" is cobalt + motion

Before the cold-blue migration, blue carried `PROVISIONING` / `RUNNING` /
`TRIAL` / `PARTIALLY_PAID` as a fifth de facto hue with no name, and was
removed for that reason: an in-progress state became **neutral + motion**
(`ink` tint, pulsing dot, `border-dashed`).

The `progress` tone is now the `info` role — cobalt — and keeps the pulse and
the dashed border. What changed is that blue is no longer nameless: `action`
owns interaction *and information*, and work in flight is informational, so
this sits inside that law rather than beside it. The original objection was
that a 5th hue would not survive colorblindness; that does not carry here,
because the hue is additive. `StatusBadge` always renders a text label, the
dashed border is a structural difference no other tone uses, and the pulse is
still there — colour is the fourth signal, not the only one.

The practical reason for the change: 18 statuses resolve to `progress`, and
with them neutral the most common states in the product (`RUNNING`,
`PROVISIONING`, `PENDING`, `QUEUED`, `TRIAL`) were grey, so an operator
scanning a table had no colour to read.

Under reduced motion, the pulse stops. The label, the cobalt tint, and the
static dashed/shape treatment remain sufficient to distinguish the state.

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

The old family names stay functional as migration aliases. New work follows the
approved target and reaches for semantic tokens (`bg-card`, `bg-primary`,
`text-success`, `border-input`) rather than direct family or ramp steps.
Direct `brand-*`/`ink-*` usage in theme-sensitive components is a migration
target because it prevents complete semantic repainting.

## Chroma headroom

Saturation in this palette is bounded by lightness, not by choice: sRGB's
chroma ceiling collapses at both ends of the lightness axis. Measured against
that ceiling, the ramp steps consumed as status colour were already spending
83–97% of what is physically available, so "make it more saturated" is mostly
not a lever. Where the colour still read as weak, the cause was the
*lightness* of the step selected for the role.

**Fail, in the default dark theme.** `--destructive` was `danger-300` at
L 0.812, where the red ceiling is only C 0.107 — the step could not be
anything but pale. It also spent its budget on 10.16:1 contrast when AA needs
4.5. It is now `danger-400`: C 0.152 (+55%) at 7.04:1 on `card`.

**Chart series, dark.** The dark chart roles all pointed at 300 steps —
pastels with a 1.53× chroma spread (0.098–0.150), so series read as unequal
before any data did. They now point at 400 steps: chroma 0.152–0.156, a
**1.03×** spread, every mark still above 7:1 on `card`.

**Chart series, light.** These were `-600`/`-700` steps at L 0.49–0.55, and
the six qualitative slots were all L 0.45–0.56 — dark and muddy against a
white card. Two things held them there. The palette was one; the other was
`ChartPalette.test.ts`, which held *marks* to 4.5:1. That is a text floor.
WCAG 1.4.11 asks 3:1 of non-text content, and a chart mark is non-text — so
the guard now holds marks to 3:1 and `--chart-axis`, which is text, to 4.5:1
in its own assertion.

At that floor every slot moves into **L 0.625–0.681**, with chroma
0.105–0.241. Lightness is also where chroma lives, since sRGB's ceiling peaks
near L 0.6–0.7, so the move buys saturation as well as brightness.

The band is deliberately narrow. A categorical palette has to stay *level*: a
series darker than its neighbours reads as more important before the data says
anything, so each slot takes the chroma available at its held lightness rather
than chasing its own maximum, and hue does the separating. Minimum OKLab
separation is 0.140 across the qualitative slots (floor 0.100) and 0.127
across the semantic marks (floor 0.080).

Explicit values rather than ramp aliases, because no single step lands on the
floor; the cost is that they no longer track the ramp if it is retuned.

**Status dots** paint from the `*-vivid` roles, not the filled `--success` /
`--warning` / `--destructive` roles. The filled roles resolve to `-700`/`-800`
steps, which they need for AA against white but which render a dot dark and
desaturated — the reason badges read as grey-green rather than green. Because
`StatusBadge` always renders its text label, the dot is reinforcement rather
than the sole carrier of meaning, so it answers to 3:1 and can sit on the mid
steps: `success-600` is C 0.170 against C 0.118 for `success-800`, and gives
exactly 3.00:1 on its own subtle tint.

**Status solids.** `success-800`, `warn-800`, and `danger-700` — the steps
rendered as filled status backgrounds — were lifted to 94–97% of their
ceiling. All three stay above 7:1 against their white labels.

**Subtle fills** are the 100 step, not the 50. `*-subtle` is the most-used
colored surface in the portal (268 call sites against 35 for the
full-strength fills), so it alone decides whether the UI reads as coloured;
the 50 steps carry C 0.014–0.019, indistinguishable from white on a 20px
pill. Every 100-step pair stays AA against its `-700`/`-800` label: success
6.49:1, warning 6.69:1, danger 5.77:1, info 8.49:1.

Two values were silently outside sRGB and browser-clamped; they are now
pinned at their true ceiling, which changes the source but not the render:
`action-400` (C 0.165 → 0.156) and `action-300` (C 0.105 → 0.099).

Known floor: light `chart-qualitative-2` (teal, C 0.086) sits at 95% of its
ceiling. Teal and green are intrinsically the weakest region of sRGB at mid
lightness — that series cannot match the purple or blue slots without moving
its lightness away from the rest of the set, which would cost more in series
equality than it gains in vividness.

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
| `--primary` | `action-600` | `action-400` |
| `--primary-foreground` | `white` | `ink-1000` |
| `--secondary` | `surface-100` | `ink-800` |
| `--muted-foreground` | calibrated cold ink | `ink-400` |
| `--accent` | `surface-100` | `ink-800` |
| `--destructive` | `danger-700` | `danger-300` |
| `--border` / `--input` | `surface-200` / `control-border` | calibrated cold boundary |
| `--ring` | `action-500` | `action-400` |
| `--chart-1..5` | brand-500 / ink-500 / warn-500 / danger-500 / brand-800 | brand-400 / ink-400 / warn-400 / danger-400 / brand-300 |
| `--sidebar` | `surface-25` | `ink-950` |

`--chart-1..5` remain a placeholder **status** palette, not a qualitative
categorical palette. Phase 22 (dashboard chart restoration) did not end up
routing any wired chart through them, since
each restored chart encodes categorical, chart-specific data-series meaning
in its own hex values rather than a generic 5-slot palette (see
[migration.md](migration.md#phase-22)). The tokens stay defined and correctly
themed for the next component that does want a generic series palette.

## Dual-use semantic contrast

`--primary` and `--destructive` are consumed both as filled-control
backgrounds and as standalone text/icon colors, so each dark-mode value must
clear AA in both contexts. The deterministic source-token guard in
`src/design-system/theme-contrast.test.ts` locks the current pairs to these
ratios:

| Dark role | Pair | Ratio |
| --- | --- | --- |
| Primary text | `action-400` on `card` | 7.24:1 |
| Primary fill | `ink-1000` on `action-400` | 7.68:1 |
| Destructive text | `danger-400` on `card` | 7.04:1 |
| Destructive fill | `ink-1000` on `danger-400` | 7.47:1 |
| Control boundary | calibrated `border` / `input` against `card` | 3.04:1 |
| Focus ring | `action-400` against `card` | 7.24:1 |

The test converts the source OKLCH tokens to linear sRGB and fails below
4.5:1 for ordinary text pairs or 3:1 for component boundaries. Browser gamut
mapping, transparency, and composited states still require runtime visual
conformance evidence. Amber remains unavailable as a default filled button;
warning controls must use the documented semantic foreground/background pair.

## Control-height and gradient/blur tokens

`--size-control-xs..xl` (24/28/32/36/40px) are consumed by
`src/design-system/lib/variants.ts`'s `controlSize` CVA fragment — see
[geometry-and-density.md](geometry-and-density.md).

The gradient budget is 3 total in the whole app (brand mark, sticky-header
fade, `Skeleton`'s shimmer keyframe); the blur budget is 1 (the modal scrim).
`node scripts/design/census.mjs --check` currently reports differences but
does not exit nonzero and excludes `src/design-system`; it is diagnostic, not
a build gate, until Phase 0 of the
[design-update roadmap](design-update-roadmap.md#phase-0--make-drift-visible).

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
