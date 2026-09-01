# Tenant Portal — Design System

Status: **Specification**

Written: **2026-08-28**

Supersedes the warm-neutral palette and the 36px/40px density in
[tokens.md](tokens.md) and [geometry.md](geometry.md). Where this file and
those disagree, **this file wins** — the sibling pages carry the longer
reasoning, this one carries the decisions.

> **The token layer is now the admin portal's.** Fonts, every ramp value, the
> semantic roles, the radius scale and the whole of the shell geometry were
> ported wholesale from `admin-portal/src/app/globals.css`. What did **not**
> move is the *role naming*: `brand` / `positive` / `caution` / `negative` /
> `ink` stay, because `src/lib/branding/apply-branding.ts` writes
> `--color-brand-*` on `:root` at runtime for a white-labelled tenant, and
> because ~360 feature call sites and `scripts/design/contrast.mjs` key off
> those names. Admin's own spellings (`--color-action-*`, `--color-success-*`,
> `--color-warn-*`, `--color-danger-*`, `--color-surface-*`) are declared as
> **aliases**, so markup copied from the admin portal resolves here unedited.

## The seven constraints this was built to

1. Per-page UI/UX, not just tokens.
2. Explicit colors, fonts, sizes — no "pick something sensible".
3. **Cold blue**, not warm grey.
4. Named libraries. **No stylesheet full of component classes.**
5. **Every write result is a toast.** Never a card in the page body.
6. **Dense** — many rows visible at once.
7. Looks designed, not generated.

Constraint 3 survived the port intact — admin's neutral is a desaturated blue
too. Constraint 6 is the one the port re-tuned: density is now a *user*
setting whose shipped default is standard, not compact. See
[§3](#3--sizing--density).

---

# 1 · Color

Cold blue throughout. The neutral ramp is not grey — it is a desaturated blue
running hue 232→245, so a surface next to a white browser chrome reads *cool*,
and the brand sits inside the same family instead of fighting it.

## The four roles

| Role | Ramp | Admin's name | Hue | Job |
| --- | --- | --- | --- | --- |
| Brand | `brand` | `action` | cobalt, ~254→267 | Primary action, active nav, focus ring, links |
| Positive | `positive` | `success` | 149–164 (green) | Won, converted, active |
| Caution | `caution` | `warn` | 92 → 44 (amber) | On hold, degraded, needs attention |
| Negative | `negative` | `danger` | 30 → 26 (vermilion) | Lost, disqualified, destructive, error |
| Neutral | `ink` | `ink` / `surface` | 232 → 245 (cold blue) | Text, borders, surfaces, **every in-progress state** |

Four deliberate choices, all of them admin's and all of them kept:

- **Brand is cobalt, anchored at `brand-600` = `#1d4ed8`.** It is the only
  saturated fill on a screen, and it is the family a tenant's own brand colour
  is written over at runtime — so it has to be one a substituted ramp can stand
  in for without the rest of the system going strange.
- **Positive is green, not teal.** It has to read as *healthy / done* at badge
  size before the label is read. A teal that harmonises with the cold neutral
  is a teal nobody registers as success.
- **Negative is warm vermilion (hue 26→30), not rose.** Rose at ~hue 15 reads
  pink and fights amber. 27 is near-complementary to `ink`'s 232, so it has
  maximum pop against every neutral surface in the app.
- **Amber's hue drifts 92 → 44 as it darkens.** The torsion is deliberate, not
  drift: amber held at one hue turns olive in its low steps, which is the one
  thing a caution state cannot afford to look like.

Nine steps sit fractionally outside sRGB in the admin file and the browser
clips them. They are written here as the in-gamut OKLCH that round-trips to the
exact hex the browser already paints — pixel-identical to admin, and honest to
the out-of-gamut check in `scripts/design/contrast.mjs`. Each is marked
`clipped:` below and in `globals.css`.

## Ramps — exact values

Every step verified in-gamut and contrast-checked by
`node scripts/design/contrast.mjs`.

```css
@theme {
  /* INK — the neutral ramp, hue 232->245. Half the chroma of Tailwind's slate
     and rotated ~25deg cooler: machined steel, not denim. 13 steps: ink-25 is
     the table zebra row, ink-1000 the dark canvas — Tailwind's 11-step families
     have neither. Steps 25-300 double as the light surface ramp, which is what
     admin spells --color-surface-*. */
  --color-ink-25:        oklch(0.991674 0.00507 227.479702);   /* clipped: #f9fdff */
  --color-ink-50:        oklch(0.977927 0.01177 238.823972);   /* clipped: #f1f9ff */
  --color-ink-100:       oklch(0.955 0.02 240);                /* #e5f2fd */
  --color-ink-200:       oklch(0.91 0.03 240);                 /* #d0e5f4 */
  --color-ink-300:       oklch(0.84 0.035 240);                /* #b7cedf */
  --color-ink-400:       oklch(0.715 0.021 235);               /* #97a5af */
  --color-ink-500:       oklch(0.588 0.024 236);               /* #707f89 */
  --color-ink-600:       oklch(0.487 0.024 237);               /* #53626c */
  --color-ink-700:       oklch(0.404 0.024 238);               /* #3d4b54 */
  --color-ink-800:       oklch(0.32 0.023 240);                /* #28353e */
  --color-ink-900:       oklch(0.252 0.021 242);               /* #19232b */
  --color-ink-950:       oklch(0.176 0.019 244);               /* #091219 */
  --color-ink-1000:      oklch(0.132 0.017 245);               /* #03080e */

  /* BRAND (admin: action) — cobalt interaction and information, anchored at
     600. This family must never encode success or health. */
  --color-brand-50:      oklch(0.97048 0.014182 254.604);      /* #eff6ff */
  --color-brand-100:     oklch(0.931918 0.031591 255.585);     /* #dbeafe */
  --color-brand-200:     oklch(0.881948 0.058827 254.029488);  /* clipped: #bedbff */
  --color-brand-300:     oklch(0.808973 0.098925 251.786743);  /* clipped: #91c5ff */
  --color-brand-400:     oklch(0.706954 0.155896 254.605926);  /* clipped: #56a2ff */
  --color-brand-500:     oklch(0.54615 0.215208 262.881);      /* #2563eb */
  --color-brand-600:     oklch(0.488198 0.217165 264.376);     /* #1d4ed8 */
  --color-brand-700:     oklch(0.424445 0.180869 265.638);     /* #1e40af */
  --color-brand-800:     oklch(0.379059 0.137761 265.522);     /* #1e3a8a */
  --color-brand-900:     oklch(0.321 0.101 266.2);             /* #1b2e66 */
  --color-brand-950:     oklch(0.245 0.098 267.1);             /* #0c1a4e */

  /* POSITIVE (admin: success) — healthy, completed, connected, verified. */
  --color-positive-50:   oklch(0.981926 0.01806 155.826);      /* #f0fdf4 */
  --color-positive-100:  oklch(0.962 0.044 156.743);           /* #dcfce7 */
  --color-positive-200:  oklch(0.925 0.084 155.995);           /* #b9f8cf */
  --color-positive-300:  oklch(0.871 0.15 154.449);            /* #7bf1a8 */
  --color-positive-400:  oklch(0.783 0.155 163);               /* #37d79b */
  --color-positive-500:  oklch(0.723 0.191 149.579);           /* #24c55f */
  --color-positive-600:  oklch(0.627 0.17 149.214);            /* #16a34a */
  --color-positive-700:  oklch(0.527 0.137 150.069);           /* #15803d */
  --color-positive-800:  oklch(0.447925 0.118 151.328);        /* #046630 */
  --color-positive-900:  oklch(0.393 0.095 152.535);           /* #0d542b */
  --color-positive-950:  oklch(0.267081 0.07034 151.94981);    /* clipped: #002f13 */

  /* CAUTION (admin: warn) — amber, hue 92->44. The large hue torsion is
     deliberate: amber has to drift toward orange as it darkens or the low
     steps read as olive. */
  --color-caution-50:    oklch(0.98 0.019 92);                 /* #fdf8ea */
  --color-caution-100:   oklch(0.956 0.045 92);                /* #fbf0cf */
  --color-caution-200:   oklch(0.912 0.086 88);                /* #fadfa0 */
  --color-caution-300:   oklch(0.86 0.128 84);                 /* #f9ca67 */
  --color-caution-400:   oklch(0.806 0.152 79);                /* #f4b235 */
  --color-caution-500:   oklch(0.752 0.156 74);                /* #e89d13 */
  --color-caution-600:   oklch(0.66 0.148 62);                 /* #d17a10 */
  --color-caution-700:   oklch(0.545 0.13 52);                 /* #a95616 */
  --color-caution-800:   oklch(0.455 0.12 48);                 /* #8a3d07 */
  --color-caution-900:   oklch(0.39 0.086 46);                 /* #6a3419 */
  --color-caution-950:   oklch(0.255276 0.076956 42.052195);   /* clipped: #401200 */

  /* NEGATIVE (admin: danger) — warm vermilion, hue 26->30. Deliberately not
     rose (hue ~15, which reads pink and fights amber); 27 is near-complementary
     to ink's 232, so it has maximum pop against every neutral surface. */
  --color-negative-50:   oklch(0.971876 0.013835 30.150941);   /* clipped: #fff3f0 */
  --color-negative-100:  oklch(0.94 0.03 30);                  /* #ffe4df */
  --color-negative-200:  oklch(0.888 0.058 29);                /* #feccc4 */
  --color-negative-300:  oklch(0.812 0.098 28);                /* #fba99e */
  --color-negative-400:  oklch(0.716 0.152 28);                /* #f47a6c */
  --color-negative-500:  oklch(0.637 0.194 27);                /* #e94d45 */
  --color-negative-600:  oklch(0.567 0.203 27);                /* #d42d2b */
  --color-negative-700:  oklch(0.487 0.192 27);                /* #b30e17 */
  --color-negative-800:  oklch(0.41 0.144 27);                 /* #881b19 */
  --color-negative-900:  oklch(0.352 0.118 26);                /* #6c1717 */
  --color-negative-950:  oklch(0.234429 0.095572 27.123489);   /* clipped: #400002 */
}
```

Two steps the `ink` ramp cannot express are carried over verbatim from admin:
`--color-surface-selected` (`oklch(0.932953 0.032255 258.369)`, the selected-row
tint) and `--color-control-border` (`oklch(0.656043 0.054999 250.432)`, darker
than `ink-200` so an input outline clears 3:1 against the card it sits on).

## Semantic tokens

shadcn-registry names, so `npx shadcn add <x>` pastes in unmodified.

| Token | Light | Dark |
| --- | --- | --- |
| `--background` | `ink-50` | `ink-1000` |
| `--foreground` | `oklch(0.256528 0.058664 258.037)` | `ink-100` |
| `--canvas` | `ink-50` | `ink-1000` |
| `--card` / `--card-foreground` | `white` / `--foreground` | `ink-950` / `ink-100` |
| `--popover` / `--popover-foreground` | `white` / `--foreground` | `ink-900` / `ink-100` |
| `--primary` / `--primary-foreground` | `brand-600` / `white` | `brand-400` / `ink-1000` |
| `--secondary` / `--secondary-foreground` | `ink-100` / `--foreground` | `ink-800` / `ink-100` |
| `--muted` / `--muted-foreground` | `ink-100` / `oklch(0.518211 0.050915 249.823)` | `ink-900` / `ink-400` |
| `--accent` / `--accent-foreground` | `ink-100` / `--foreground` | `ink-800` / `ink-100` |
| `--selected` / `--selected-foreground` | `surface-selected` / `brand-800` | `brand-950` / `brand-200` |
| `--info` / `-subtle` / `-vivid` | `brand-700` / `brand-100` / `brand-500` | `brand-400` / `brand-950` / `brand-400` |
| `--success` / `-subtle` / `-vivid` | `positive-800` / `positive-100` / `positive-600` | `positive-300` / `positive-950` / `positive-400` |
| `--warning` / `-subtle` / `-vivid` | `caution-800` / `caution-100` / `caution-600` | `caution-300` / `caution-950` / `caution-400` |
| `--destructive` / `-subtle` / `-vivid` | `negative-700` / `negative-100` / `negative-500` | `negative-400` / `negative-950` / `negative-400` |
| `--destructive-foreground` | `white` | `ink-1000` |
| `--border` | `ink-200` | `oklch(0.49 0.024 237)` |
| `--input` | `control-border` | `oklch(0.49 0.024 237)` |
| `--ring` | `brand-500` | `brand-400` |
| `--row-zebra` | `ink-25` | `ink-950` |
| `--sidebar` / `--sidebar-active` | `ink-25` / `brand-800` | `ink-950` / `brand-200` |
| `--sidebar-primary` / `-accent` / `-selected` | `brand-600` / `ink-100` / `surface-selected` | `brand-500` / `ink-800` / `brand-950` |
| `--sidebar-border` / `--sidebar-ring` | `ink-200` / `brand-500` | `ink-800` / `brand-400` |
| `--chart-1…5`, `--chart-qualitative-1…6` | held in L 0.625–0.681 | brightened per theme |

Each `*-subtle` has a matching `*-subtle-foreground` — the `-800` step in light
(`-700` for destructive, which is where its filled role also sits) and the
`-200` in dark — and each filled role has a `*-foreground`. The table above
lists the fills only; `globals.css` is the complete list.

**`--accent` is neutral hover fill, not brand.** Wiring a hover to it expecting
blue is how a UI ends up glowing everywhere.

**`*-subtle` is the 100 step, never the 50.** The 50 steps carry C 0.014–0.019,
which on a 20px status pill is indistinguishable from white — and `*-subtle` is
the most-used coloured surface in the app, so it decides whether the portal
reads as coloured at all. The 100 step is 2.1–2.4× the chroma and every pair
stays AA against its `-700`/`-800` label.

**`*-vivid` is the non-text accent** — status dots, indicator marks, things a
text label already names. It answers to the 3:1 graphics bar rather than 4.5:1,
so it can sit far brighter than the dark steps a filled role needs. Those dark
steps are what made every badge read grey-green rather than green.

## Measured contrast

| Pairing | Light | Dark | Bar |
| --- | ---: | ---: | ---: |
| Fill — label on `--primary` | **6.70** | **7.24** | 4.5 |
| Link / text | **8.72** | **11.12** | 4.5 |
| Muted text | **6.31** | **7.98** | 4.5 |
| Body text | **14.92** | **17.65** | 4.5 |
| Focus ring (non-text) | **4.86** | **7.68** | 3.0 |
| Destructive fill | **7.02** | **7.02** | 4.5 |
| Positive text | **5.02** | **14.35** | 4.5 |
| Badge — brand | **8.49** | **9.15** | 4.5 |
| Badge — positive | **6.46** | **10.61** | 4.5 |
| Badge — caution | **6.73** | **10.46** | 4.5 |
| Badge — negative | **7.89** | **9.24** | 4.5 |

Every number computed by `scripts/design/contrast.mjs`, which **parses
`globals.css`** rather than carrying a hand-copied table — a duplicate table is
what let the old values rot. It also fails the build on any out-of-gamut step,
because a clipped colour is not the colour that was measured; the nine clipped
steps above are written in-gamut precisely so that check stays meaningful.

The gate carries a negative control as well: `ink-500` used as muted text on
white measures **4.12** and must keep failing the 4.5 bar. A palette change
that makes that pass has flattened the ramp.

**Headroom moved in the app's favour.** The primary fill went from 4.79 to
6.70 and the focus ring from 3.40 to 4.86, so the ring is no longer the tightest
value in the system. The tightest is now **positive text in light mode at 5.02
against a 4.5 bar** — that is the pairing to re-measure before touching
`positive-700` or `--card`.

## Stage is never a color

`OpportunityStageFlagEnum` has 9 values, `LeadStageFlagEnum` has 8. No palette
has 9 colorblind-safe hues. Stage is conveyed by **column position, label, and
progress**. Only outcome takes a hue:

| Outcome | Role |
| --- | --- |
| In progress | `ink` + a pulsing dot |
| Won / converted / active | `positive` |
| On hold / nurturing | `caution` |
| Lost / disqualified / blacklisted | `negative` |

Full enum→role table: [tokens.md](tokens.md#status-mapping).

---

# 2 · Typography

## Faces

| Role | Family | Subsets | Weights | Why |
| --- | --- | --- | --- | --- |
| Latin UI text | **IBM Plex Sans** | `latin`, `latin-ext` | 400 · 500 · 600 | Drawn against Plex Sans Arabic by the same team |
| Arabic UI text | **IBM Plex Sans Arabic** | `arabic` | 400 · 500 · 600 | Same superfamily, same vertical metrics — no baseline jump on a mixed-script line |
| IDs, codes, numerals | **IBM Plex Mono** | `latin` | 400 · 500 · 600 | Unambiguous `0`/`O`, `1`/`l`; sits quietly beside Plex Sans |

```css
--font-sans: var(--font-plex-latin), var(--font-plex-arabic), ui-sans-serif,
  system-ui, sans-serif;
```

**Latin first, Arabic second, and the order is load-bearing.** The browser
resolves `font-family` per *character*, so a Latin enum value inside an Arabic
sentence renders in Plex Sans while the sentence around it renders in Plex Sans
Arabic — on the same line, with no `:lang()` switching and no per-script stack.
Two families, one superfamily; the property the old single-family choice bought
is bought here by the pairing being drawn together.

Loaded through `next/font`, self-hosted — **no `<link>` to Google**, which keeps
`font-src 'self'` in the CSP. All three are `display: swap` and
**`preload: false`**: a preload is a promise that a file is needed for the first
paint, and this app cannot make that promise about any of them — the language
lives in `localStorage`, so the server always renders `lang="ar"` and the client
corrects it after hydration, which means every Arabic preload is wasted on an
English operator and vice versa. See `src/app/fonts.ts`.

## Scale — 7 steps

| Token | Latin | Arabic | Line | Use |
| --- | ---: | ---: | ---: | --- |
| `text-2xs` | 13px | 13px | 18 | Latin uppercase micro-labels; a **compatibility alias** for `text-xs` |
| `text-xs` | **13px** | **14px** | 18 / 20 | **Workhorse** — table headers, badges, metadata |
| `text-sm` | **14px** | **15px** | 20 / 22 | Base — body, table cells, buttons, nav ([not inputs on mobile](#inputs-are-16px-on-mobile)) |
| `text-base` | 15px | 16px | 24 / 26 | Prose, dialog description |
| `text-lg` | 17px | 17px | 24 | Card and dialog titles |
| `text-xl` | 20px | 20px | 28 | Page title |
| `text-2xl` | 25px | 25px | 32 | KPI numerals — **ceiling** |

Only two steps moved in the port: `text-2xs` 12 → 13px and `text-2xl` 24 →
25px. `text-2xs` now shares its size with `text-xs` and differs only in its
`0.06em` tracking, which is what an uppercase micro-label wants; `text-xs`
gained an explicit `letter-spacing: 0em` so it cannot inherit that tracking by
accident.

**The 13px floor is not negotiable, even for density.** Density comes from
tighter spacing and shorter rows, never smaller type — 11px Arabic is
unreadable, and a screen nobody can read fits zero items. Arabic gains 1px on
the three smallest steps because Naskh forms need the room for dots and
diacritics.

### Inputs are 16px on mobile

**Every text-entry control renders at 16px below `sm` (640px), and drops to
`text-sm` from `sm:` upward.**

```
text-base sm:text-sm      /* Input, Textarea, Select trigger, search */
```

This is not a style preference. **Mobile Safari zooms the viewport whenever a
focused input is smaller than 16px** — the page jumps, the layout leaves the
frame, and the user has to pinch back out to carry on. It fires on every focus,
on every visit.

Desktop density is untouched: the rule only applies under 640px, where there is
no dense table to protect. `/login` is the screen this actually saves, since it
is the one page genuinely opened from a phone.

Applies to anything that receives typed input, including the `FilterBar` search
field. It does **not** apply to buttons, labels, or read-only text.

## Weights — three, physically enforced

| 600 | Headings, `<th>`, KPI numerals, button labels, active nav, **card titles** |
| 500 | Form labels, tabs, badges |
| 400 | **All table body cells**, prose, values, metadata |

Only those three are downloaded. `font-synthesis-weight: none` blocks fake
bolds. Tailwind's `--font-weight-bold/extrabold/black` are remapped to 600, so
a stray class cannot escalate. **Hierarchy comes from size and color, never
weight.**

## Numerals

`tabular-nums` on every column of digits. All formatting through `Intl` with an
explicit locale — `ar-EG-u-nu-latn` (Arabic locale, **Western digits**) and
`en-US`. Money and quantity are **decimal strings**: format from the string,
never `Number()`.

---

# 3 · Sizing & density

Tuned for many rows on a 1366×768 laptop — but no longer at the cost of
rendering smaller than its sibling portal.

Every size token multiplies by `--ui-scale`, which ships at **1**. The whole
shell geometry below is the admin portal's exact chrome.

```css
:root {
  --ui-scale: 1;

  --size-control-xs: calc(1.5rem  * var(--ui-scale));  /* 24px */
  --size-control-sm: calc(1.75rem * var(--ui-scale));  /* 28px */
  --size-control-md: calc(2rem    * var(--ui-scale));  /* 32px  DEFAULT */
  --size-control-lg: calc(2.25rem * var(--ui-scale));  /* 36px */
  --size-control-xl: calc(2.5rem  * var(--ui-scale));  /* 40px */

  --size-row:     calc(2.75rem * var(--ui-scale));     /* 44px  — admin's px-4/py-3 body cell */
  --size-topbar:  calc(3rem    * var(--ui-scale));     /* 48px  — admin's h-12 */
  --size-sidebar: calc(15rem   * var(--ui-scale));     /* 240px — admin's SIDEBAR_EXPANDED_WIDTH */
  --size-rail:    calc(3.25rem * var(--ui-scale));     /* 52px  — admin's SIDEBAR_COLLAPSED_WIDTH */
}
```

**The default moved from 0.9 to 1, and that is the headline of the port.** The
control scale in `rem` never changed; what changed is that it is no longer
multiplied down. That single multiplier is the whole reason the tenant portal
rendered about 10 % smaller than the admin portal at every control, row and
chrome edge. Admin has no density multiplier at all, so scale 1 is precisely
what "the same size as admin" means.

Compact (0.9) and comfortable (1.1) remain selectable from the user menu.
**Standard is now expressed by *removing* the inline property** — it used to be
compact that was the absence — see
[theming.md](theming.md#density-is-the-absence-of-a-value-not-a-value).

**Type is deliberately not in there.** The 13px Latin / 14px Arabic floor is
absolute, not relative — density comes from tighter spacing and shorter rows,
never smaller type. **Radius is not in there either**: 3/4/6/8/10 is a shape
constant.

**Do not scale this through `html { font-size }`.** It was tried: that selector
is banned in `globals.css` (see [§5](#5--no-stylesheet-of-component-classes)),
**and Tailwind v4 strips it silently** — the rule reaches no stylesheet while
any compensating change to the type tokens still applies, so the interface
renders *larger*. Every gate stays green. Scale the tokens.

**Consequence:** `hitArea` is no longer a hardcoded inset. It used to be
`after:-inset-2` — 8px, derived from "28.8px control + 8px per side = 44.8px",
a figure that silently stopped being right the moment the scale default moved
to 1. It is now the `ds-hit-area` class, expressed as a *minimum size*
(24×24px normally, 44×44px under `(pointer: coarse)`), so it holds the floor at
any scale and expands only where the floor actually applies.

## Stacking order

Six real layers, and they collide if left to chance — a sticky table column
will happily cover an open dropdown. Declare the ladder once; never write a
bare `z-50`.

```css
:root {
  --z-sticky-cell:   10;   /* sticky first / action column */
  --z-sticky-header: 20;   /* sticky table header — above its own cells */
  --z-topbar:        30;   /* app chrome, above page content */
  --z-dropdown:      40;   /* popover, select, tooltip, flyout */
  --z-overlay:      100;   /* dialog, sheet, and their scrim */
  --z-toast:       1000;   /* always last — must clear a modal */
}
```

Two ordering facts that are easy to get backwards: the sticky **header** sits
above the sticky **cell** (or the first column covers the header on horizontal
scroll), and the **toast** sits above the **overlay** (a confirm dialog's
result has to be visible over the dialog that triggered it).

**What this costs.** The row budget measured in the running app at 1366×768 —
14 rows at scale 1.0, 15 at 0.9, counting the real chrome (topbar, page gutter,
`PageHeader`, `FilterBar`, table header, pager) — **was measured against the
pre-port geometry and no longer holds.** Three things moved against it at once:
the row went 36 → 44px, the topbar 44 → 48px, and `<main>`'s gutter 16 → 24px
from `md:` upward.

Working from the same measurement, a standard-density screen now fits **about
11 rows**: the 14 old rows occupied 14 × 36 = 504px, the extra chrome takes 20
of those, and 484 / 44 = 11. **That figure is derived, not measured** — mark it
as such wherever it is quoted until someone re-runs the count in the running
app. What is not in doubt is the direction: standard density trades rows for
matching the admin portal's physical size, and an operator who wants the rows
back selects compact.

## Radius — 5 steps, tight

```css
--radius-xs: 0.1875rem;  /* 3px — checkbox */
--radius-sm: 0.25rem;    /* 4px — chips, inline code */
--radius-md: 0.375rem;   /* 6px — DEFAULT: buttons, inputs, badges, tabs */
--radius-lg: 0.5rem;     /* 8px — cards, table shell, popovers */
--radius-xl: 0.625rem;   /* 10px — dialogs, drawers */
```

Admin's five steps, replacing the previous four. `xs` went 2 → 3px, and `xl` is
now a real step rather than a squash down to `lg`. The transitional
`--radius-2xl` / `--radius-3xl` aliases are **gone**: they existed to tighten
pre-rebuild call sites, and the census baseline records **zero** `rounded-2xl`
and `rounded-3xl` sites, so removing them changes the shape of nothing.

**The markup ceiling is still `rounded-lg`.** `--radius-xl` is declared for
parity with admin, but nothing consumes it: `Dialog` and `AlertDialog` render
`rounded-lg`, and `Sheet` renders square because it is an edge drawer. Both the
ESLint selector and the census counter reject `rounded-xl` in source. Nothing
above 10px exists as a token at all — oversized corners are the single loudest
"generated" tell.

## Spacing

| Step | Use |
| --- | --- |
| `1` (4px) | Icon↔label inside a chip |
| `1.5` (6px) | Badge padding, dense toolbar gaps |
| `2` (8px) | Control padding, table cell vertical, list gaps |
| `3` (12px) | Table cell horizontal, card padding, form field gaps |
| `4` (16px) | Page gutter, gap between sections |
| `6` (24px) | Gap above a page heading block |

Nothing above `6`. Layout uses flex/grid with `gap` — **never per-element
margins**, which collapse and double invisibly.

## Elevation

Surfaces separate by **border + background step**. A shadow means "floating
above the document" and nothing else.

| Level | Treatment |
| --- | --- |
| `base` — cards, table shell, board columns | `bg-card` + `border-border`, **no shadow** |
| `raised` — popover, dropdown, tooltip | + `shadow-pop` |
| `overlay` — dialog, sheet | `shadow-overlay` |

Dark mode substitutes a **top inset hairline** for shadow — a drop shadow on a
dark canvas reads as mud.

> Both must be bridged through `@theme inline` as `--shadow-pop` /
> `--shadow-overlay`. An undefined `--shadow-*` key in Tailwind v4 generates
> **no utility at all**, and every popover renders flat with no error.

---

# 4 · Libraries

## Install

```bash
pnpm add @radix-ui/react-alert-dialog @radix-ui/react-avatar \
  @radix-ui/react-checkbox @radix-ui/react-dialog @radix-ui/react-direction \
  @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-popover \
  @radix-ui/react-radio-group @radix-ui/react-scroll-area @radix-ui/react-select \
  @radix-ui/react-separator @radix-ui/react-slot @radix-ui/react-switch \
  @radix-ui/react-tabs @radix-ui/react-tooltip \
  class-variance-authority clsx tailwind-merge \
  sonner next-themes tw-animate-css
```

| Library | Job | Why this one |
| --- | --- | --- |
| **Radix UI** (16 packages) | Primitive behavior | Focus trapping, roving tabindex, ARIA, `Esc` — unstyled. Hand-rolling these is how the current `Modal.tsx` ended up with a broken trap |
| **class-variance-authority** | Variant→class mapping | Typed variants without a styling runtime |
| **clsx** + **tailwind-merge** | `cn()` helper | Resolves conflicting utilities so `className` overrides actually win |
| **sonner** | Toasts | Requirement #5. Stacking, swipe-dismiss, RTL, `duration: 0` for permanent |
| **next-themes** | Theme class | Well-tested flash prevention; do not reimplement |
| **tw-animate-css** | Radix enter/exit | Required — the app already uses `animate-in` classes that are currently **undefined and inert** |
| **@hello-pangea/dnd** | Board drag | Already installed and working; has a real keyboard path |
| **zod** | Response validation | Already installed |
| **lucide-react** | Icons | Already installed. Consistent stroke, themeable, mirrors under RTL |

## Explicitly not used

| Not using | Why |
| --- | --- |
| A component library (MUI, Chakra, Mantine) | Brings its own design language; you would fight it forever |
| `styled-components` / `emotion` | A second styling system beside Tailwind |
| `cmdk` | Command palette not built — 11 routes do not need one |
| `framer-motion` | The motion budget is small enough for CSS |
| `@tanstack/react-table` | `DataTable` needs server pagination + sorting, not client-side table logic |
| `recharts` / `echarts` | No charts in scope. Both currently installed with **zero imports** — removed |

---

# 5 · No stylesheet of component classes

**The rule: `globals.css` declares tokens. It styles nothing.**

Be clear about what is and is not possible: Tailwind v4 **requires** a CSS entry
file — `@theme` is how tokens enter the build, and there is no JS config
alternative. So the file exists. What it must never contain is styling.

### What `globals.css` may contain — and nothing else

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:where(.dark, .dark *));

@theme        { /* ramps, admin's aliases, type scale, radius, the theme flip */ }
@theme inline { /* font vars, semantic→utility bridges */ }
:root / .dark { /* semantic token values, control sizes, z-ladder, elevation */ }
html[lang="ar"] { /* the Arabic type lift */ }

.ds-hit-area, .ds-hit-target { /* the pointer-target floor */ }
.dot-pending                 { /* the one informational animation */ }

@keyframes shimmer   { }
@keyframes pulse-dot { }

body { background; color; font-family; font-synthesis-weight: none; }

@media (prefers-reduced-motion: reduce) { }
@media print { }
```

**About 1,060 lines, of which zero style a component.** The length is almost
entirely data: five 11-to-13-step ramps, admin's alias spellings of all of them,
and the theme flip's 22 remapped Tailwind families.

### Banned in that file

- Any class selector **that styles a component** — no `.btn`, `.card`,
  `.field`, `.table-row`
- `@apply` — it is a stylesheet wearing a utility costume
- Element selectors beyond `body` and `html[lang]`
- Any `@layer components` block

The permitted class selectors are a closed, enumerated set, and every one of
them exists because a utility genuinely cannot express it: `.dark` (the theme
flip's own hook), `.dot-pending` and `.animate-spin` (targeted by name so the
reduced-motion block can spare them), `.print-document`, and the pair
`.ds-hit-area` / `.ds-hit-target` — ported from admin, because a
minimum-size-plus-coarse-pointer rule has no utility spelling. Adding a sixth is
a change to this section, not a judgement call.

### Where styling actually lives

```tsx
// src/design-system/lib/variants.ts — one shared fragment, spread by 21 components
export const controlSize = cva("", {
  variants: {
    size: {
      xs: "h-(--size-control-xs) px-2   text-xs   gap-1.5",
      sm: "h-(--size-control-sm) px-2.5 text-xs   gap-1.5",
      md: "h-(--size-control-md) px-3   text-sm   gap-1.5",
      lg: "h-(--size-control-lg) px-3.5 text-sm   gap-1.5",
      xl: "h-(--size-control-xl) px-4   text-base gap-1.5",
    },
  },
  defaultVariants: { size: "md" },
});

// src/design-system/primitives/Button.tsx — variants only; size comes from above
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium cursor-pointer " +
  "transition-colors disabled:opacity-50 disabled:cursor-not-allowed " +
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        primary:  "bg-primary text-primary-foreground not-disabled:hover:bg-brand-700",
        outline:  "border border-border bg-transparent not-disabled:hover:bg-accent",
        ghost:    "bg-transparent not-disabled:hover:bg-accent",
        destructive: "bg-destructive text-destructive-foreground not-disabled:hover:bg-negative-800",
      },
    },
    defaultVariants: { variant: "outline" },
  },
);
```

Three things in that pair are admin's and are easy to get wrong when hand-editing:
the button is `rounded-md` (not `rounded-sm`); the paddings are `2 / 2.5 / 3 /
3.5 / 4` so `lg` is not the same width as `xl`; and the gap is a **fixed**
`1.5` at every size rather than growing with the control.

Utilities in the component, variants in CVA, tokens in `@theme`. A restyle is a
token edit or a CVA edit — never a hunt through a stylesheet.

**Enforcement:** `pnpm lint` errors on `@apply` and on any class selector added
to `globals.css`. The census counts stylesheet lines and fails on growth.

---

# 6 · Every result is a toast

**No success or failure card ever renders in the page body.**

## The API

```ts
toast.success(title, message?)
toast.error(title, message?)
toast.warning(title, message?)
toast.info(title, message?)
toast.errorFromApi(title, error)   // appends errorCode + correlationId
```

Titles and messages come from the dictionary. `sonner` mounted once in the root
layout; RTL-aware; bottom-`end` anchored so it never covers the primary action
in `PageHeader`.

### The accessibility contract

Because **every** write result in this product is a toast, this contract is
load-bearing — a toast that a screen-reader user never hears means they get no
confirmation of any action they take.

- **`aria-live="polite"`. Never `assertive`.** A save confirmation must not
  interrupt what the user is reading mid-sentence.
- **A toast never takes focus.** Focus stays where the user put it; stealing it
  after a save throws a keyboard user out of the form they were in.
- **Any toast carrying an action must be keyboard-reachable.** This covers the
  5xx retry and, critically, the permanent `duration: 0` ambiguous-outcome
  toast — its Retry is sometimes the only path to resolving a write, so it must
  be operable without a mouse and must not auto-dismiss out from under a
  keyboard user.
- **Never convey a result by color alone.** Success and failure toasts carry an
  icon and a text label, not just a green or red edge.

Timed dismissal at 4000ms is a *default*, not a rule for every case: a toast
whose only purpose is confirmation may be shorter (2s for a stage move), and
one carrying evidence must be permanent.

## Mapping

| Event | Surface |
| --- | --- |
| Create / update / delete succeeded | `toast.success` |
| Stage moved, status changed | `toast.success`, 2s — frequent, so short |
| Validation failed (422) | Field-level `aria-describedby` text **plus** `toast.error` summarising |
| Conflict (409) | `toast.errorFromApi`, then refetch |
| Forbidden (403) | The transport's toast only — **never raise a second** |
| Rate limited (429) | `toast.warning` |
| Server error (5xx) | `toast.error` with a retry action in the toast |
| Ambiguous write outcome | `toast.error` with **`duration: 0`** and a retry action — see below |

## Field errors

A 422 still marks the offending inputs — `aria-invalid` and
`aria-describedby` are how a screen-reader user finds the problem, and no toast
can do that job. **That is inline text on the input, not a card**, and it is
accompanied by a toast so the rule holds.

## The one case that needs care

A write that times out may or may not have applied, and its idempotency key is
the only way to retry safely. A 4-second toast would take that key with it.

**Solution that keeps the rule:** a toast with `duration: 0` — permanent until
dismissed — carrying the `correlationId` and a **Retry** action that reuses the
same idempotency key.

```ts
toast.error(t.errors.outcomeUnknown, `${t.errors.ref}: ${correlationId}`, 0);
```

Still a toast. Still no body card. The evidence survives.

## Page states are not results

These are **conditions of the page**, not responses to an action, and have no
toast to attach to:

| State | Rendering |
| --- | --- |
| Empty result set | One line + one action, centred in the table body |
| Load failure | One line + Retry, centred in the table body |
| 403 on the whole screen | Labelled in-body state — a 403 is not an empty state |
| Partial / stale data | A single-line strip under `PageHeader` |

A user who lands on a screen that failed to load has nothing to attach a toast
to; the page itself must say so.

---

# 7 · Page-by-page UI/UX

Shell for every authenticated page: **240px sidebar** (52px rail when
collapsed) + **48px topbar** + `main` with a 16px gutter that opens to 24px
from `md:` upward (`p-4 md:p-6`). These are admin's exact chrome dimensions,
not approximations of them.

Sidebar active state is a **2px logical inset-start bar plus weight 500** —
not a filled pill. Collapse persists in a cookie, read server-side, so there is
no flash.

Topbar, inline end: language · theme · notifications · separator · user menu.
No global search — search belongs to the workspace it filters.

---

## 7.1 Login — `/login`

Single centred card, `max-w-[380px]`, on `bg-canvas`. No gradient, no blurred
orbs, no illustration.

| Element | Spec |
| --- | --- |
| Brand mark | 28px square, `bg-brand-600`, `rounded-sm`, above the card |
| Card | `bg-card`, `border-border`, `rounded-md`, `p-6`, **no shadow** |
| Title | `text-lg` / 600 |
| Fields | `Field` + `Input`, `size="lg"` (36px) — the one place bigger is right. `text-base sm:text-sm` per the [mobile input rule](#inputs-are-16px-on-mobile) |
| Autofill | `autocomplete="username"` on email, `autocomplete="current-password"` on password. **Never block paste** — WCAG 2.2 AA `accessible-authentication` requires password managers to work |
| Submit | `Button variant="primary" size="lg"`, full width |
| Forgot password | `Button variant="link"`, `text-xs`, under the password field |
| Toggles | Language + theme, top-inline-end of the viewport |
| Footer | One `text-2xs` line, `text-muted-foreground` |

**Every string from the dictionary** — the current page is 100% hardcoded
Arabic while rendering a language toggle.

The reset dialog gets **its own bound email state**. Today the input is unbound
and the request sends the login field's value ([D1](../build/DEFECTS.md#d1--forgot-password-sends-the-wrong-address)).

Errors are toasts. Success navigates.

---

## 7.2 Workspace home — `/`

Not a dashboard — there is no metrics endpoint. A launcher.

- `PageHeader` with the user's name, no primary action
- A responsive grid of destination cards: icon (16px, `text-brand-600`), title
  `text-sm`/500, one line of `text-xs` muted description
- Only permitted destinations render — no disabled tiles

Hover: `bg-accent` and `border-ink-300`. **No lift, no scale, no shadow.**

---

## 7.3 Leads · Customers · Opportunities — the workspace

Three screens, one layout. Full contract in [views.md](views.md).

```
PageHeader        title · count · [ + Add ]           ← the one primary
FilterBar         search · filters · branch · [board|card|table]
─────────────────────────────────────────────────────
view body (fills remaining height, scrolls internally)
─────────────────────────────────────────────────────
Pagination        table view only
```

The workspace owns data, filters, search, branch, permissions, and the empty /
error / loading states. **A view never fetches.**

### Toolbar — 28px controls

Search input `size="sm"`, 240px, leading `Search` icon, 300ms debounce, `q` in
the URL, and `text-base sm:text-sm` — it takes typed input, so the
[mobile input rule](#inputs-are-16px-on-mobile) applies to it too.

Filters collapse behind a `Filters` button with a count badge below `lg`.
Active filters show as removable chips on a second line **only when set** — an
always-present empty chip row wastes 32px.

**Chip overflow.** With eight filters set the row has to give somewhere, and
the wrong answer is shrinking labels until they truncate — a chip reading
`Acquisition so…` tells the user nothing about what is filtering their data.

1. **Wrap the collection first.** Chips reflow onto a second row at full label
   width before anything shrinks.
2. **Past two rows, collapse to `+n`.** That `+n` is a real `Button` that opens
   a popover listing the remaining chips, each still individually removable —
   **not** a static count. A number the user cannot act on hides state they are
   entitled to change.
3. **Never truncate a chip label.** If a value is genuinely too long for one
   line, it belongs in the popover, not in an ellipsis.

### View switcher

Segmented, 28px, icon-only with tooltips: `Columns3` · `LayoutGrid` · `Rows3`.
Active = `bg-secondary`. **Not a colored fill** — the current implementation
tints it purple/emerald/amber depending on view, which is three hues for one
control.

### Board view

- Columns 280px, gap 8px, horizontal scroll on the row — never the page
- Column header: stage name `text-xs`/500 · count chip · **per-currency
  amount** in `text-2xs` mono · a 2px top border only when the stage carries an
  outcome
- `overdueCount` from `activitySummary` shows as a `caution` dot in the header
- Cards `p-2`, `rounded-sm`, `border-border`, 6px gap
- Empty column: dashed `border-ink-300` drop zone with a translated label
- Drag optimistic with rollback; terminal moves confirm first; keyboard drag
  enabled and announced

Opportunities board reads `GET /pipelines/:id/board` — **not** the generic
list. Each column paginates on its own cursor.

### Card view

`grid gap-2`, 1 / 2 / 3 / 4 columns at `sm` / `lg` / `2xl`. Cards `p-3`,
`border-border`, no shadow. The only view with a sort control.

### Table view

`DataTable`. 44px rows, `text-sm`, weight 400, zebra `--row-zebra`. Body cells
are `px-4 py-3`.

- Header band: `bg-muted`, `border-b`, `h-9 px-4`, `text-xs`/600 **uppercase
  with `tracking-wide`** — admin's header, adopted with the rest of its table.
  The uppercase and the tracking are both undone under `rtl:`
  (`rtl:normal-case rtl:tracking-normal`), because Arabic has no uppercase and
  letter-spacing breaks its joined forms
- First column is the record name, a link, `font-medium`, and **sticky to the
  inline start** under narrow viewports
- Numeric columns `tabular-nums`, aligned to the inline end
- Last column: `ghost` 24px icon buttons, sticky to the inline end
- Row hover: `bg-accent`. No shadow, no transform
- Truncated cells carry a `title` attribute
- Loading: `DataTableSkeleton` matching real column widths — **not a spinner**

---

## 7.4 Detail screens

`/crm/leads/[id]` and `/crm/customer-profiles/[id]`.

Two columns, **no tabs** — a rep is scanning for a phone number, a stage and a
next step; tabs hide two of them.

```
PageHeader   ‹ back · name · StatusBadge · [Convert] [Edit] [⋯]
┌ MAIN (flex-1, min-w-0) ────────┬ RAIL (300px) ──────┐
│ Identity · Contact · Address   │ Owner · Stage      │
│ Corporate contacts (corp only) │ Custom fields      │
│                                │ Metadata           │
└────────────────────────────────┴────────────────────┘
```

Cards are the `Card` primitive: `rounded-lg`, `p-4` per section, a rule between
header/footer and body, `CardTitle` at `text-lg`/600 and `CardDescription` at
`text-sm`. Below `lg` the rail stacks above. Definition lists are two columns:
label `text-xs` muted, value `text-xs`/400. Full spec:
[detail-screens.md](detail-screens.md).

---

## 7.5 Catalogue screens

Lead stages · Acquisition sources · Custom fields · CRM settings · Reference
data. `SubNav` underneath `PageHeader`, active item underlined.

All are `PageHeader` + `DataTable` + `FormDrawer`. Reorderable catalogues get a
drag handle in a 24px first column and call the dedicated `reorder` endpoint —
never a per-row `PATCH` of rank, which races.

CRM settings is a form, not a table; its write is a **`PUT`** (send the whole
object) and needs `crm.settings.manage`.

---

## 7.6 Sign-in sessions — `/core/authentication`

`DataTable`: device · client type · last activity · created · [Revoke].

The current session's row is marked with a `positive` "This device" badge and
its Revoke opens an `AlertDialog` that says plainly it will sign you out.
Counters arrive as **decimal strings** — render, never `Number()`.

---

# 8 · Details that make it look designed

Small, specific, and the reason a screen reads as considered rather than
assembled.

**Optical, not mathematical, alignment.** The sidebar's 2px active bar sits at
`inset-inline-start: 0` with the label at 12px — the icon is nudged 1px so the
optical centre lines up with the collapsed rail. Centring by pure maths looks
off by exactly this much.

**The table header is a quiet band, not a hairline — and that is a reversal.**
This page used to argue that a filled header band is the commonest "admin
template" tell, and that `bg-card` plus a bottom border was the answer. The
ported header is `bg-muted` (`ink-100`) at `h-9`, with `text-xs`/600 uppercase
labels in `--muted-foreground`. What makes it read as designed rather than
templated is not the absence of a fill but the restraint of one: a single
neutral step above the card, a 36px band rather than a 44px one, and label
colour that sits *below* the body text it introduces instead of above it. A
grey bar is a tell when it shouts; this one recedes.

**Zebra rows at `ink-25`, not `ink-50`.** 1.4 points of OKLCH lightness against
the page ground is enough for the eye to track a row across eight columns and
quiet enough to disappear when you are not tracking. `ink-50` reads as stripes.
`design:contrast` holds the zebra step to a floor of **1.02** — deliberately
not a legibility threshold, since zebra is non-text separation and is meant to
be barely there, but high enough that two *identical* colours fail. The old
check required 1.0, which identical colours satisfy exactly and which therefore
could never fail.

**Focus rings inset on dense controls.** At 24px with 4px gaps, a 2px ring plus
2px offset collides with the neighbour. Table-row action buttons use
`focus-visible:ring-inset` — visible, no collision.

**Numbers get the mono face, names do not.** IDs, amounts, counts and
timestamps in IBM Plex Mono at `text-xs`; names in Plex Sans. The eye stops
hunting for column boundaries.

**One empty-state line, no illustration.** "No leads match these filters" plus
a **Clear filters** button. A centred illustration in a 44px-row table is
absurd, and a stock SVG of a person at a desk is the most generated thing a UI
can contain.

**Skeletons match column widths.** A skeleton that mirrors the real layout
makes the load feel instant. Grey rectangles of arbitrary width make it feel
broken.

**Board column headers carry money.** Stage name + count + per-currency total.
The header is prime real estate and a bare title wastes it — this is the number
a sales manager opens the board to see.

**Hover changes background only.** No lift, no scale, no shadow. On a 16-row
table, transform-on-hover makes the page feel like it is breathing.

**Disabled means disabled, not invisible.** `opacity-50` +
`pointer-events-none`, control still in the DOM and still readable. Hiding a
control the user had a moment ago is disorienting.

**Truncate with a tooltip, never wrap.** A wrapping cell breaks the 44px row
and the whole table shifts. `truncate` + `title`.

**The primary button is the only saturated fill on screen.** Everything else is
outline, ghost, or a tint. That is what makes `brand-600` read as *the* action
above a screenful of data.

---

# 9 · Non-negotiables

- **Logical properties only.** `ms-` `me-` `ps-` `pe-` `start-` `end-`
  `text-start` `text-end`. `pnpm design:rtl` fails the build at count > 0.
- **Both languages, both themes, every screen.** Not a later pass.
- **Zero language ternaries** — a component never branches on language to pick
  a string.
- **No arbitrary `text-[Npx]`**, no `font-bold`, no `rounded-xl` or above in
  markup (`--radius-xl` exists as a token for parity with admin; the ESLint
  selector and the census still reject the utility), no decorative gradient, no
  `backdrop-blur` outside the modal scrim.
- **No hand-rolled** `<button>` `<input>` `<select>` `<table>`.
- **No mock data, no simulated success.**
- Every icon-only control has a translated `aria-label` **and** a tooltip.
- **`cursor-pointer` on everything clickable.** Neither Radix nor Tailwind
  Preflight sets it, and a native `<button>` does not get it for free. It lives
  in the `Button` base CVA; a clickable row, card, or chip has to add it. A
  clickable surface with a text cursor reads as inert.
- **Text-entry controls are `text-base sm:text-sm`** — see
  [the mobile input rule](#inputs-are-16px-on-mobile).
- **Identifiers wrap, they do not overflow.** `overflow-wrap: anywhere` on the
  mono/ID utility, so a 36-character UUID, `correlationId`, or idempotency key
  reflows instead of pushing a toast or a cell off-screen. **Never
  `word-break: break-all`** — it applies to prose too and mangles ordinary
  sentences mid-word.
- **Prose is capped at `max-w-[65ch]`.** Dialog descriptions, empty states, and
  the ambiguous-outcome panel. Table cells, labels, and badges are exempt —
  they are not prose.

## Gates

```bash
pnpm verify           # typecheck · lint · test · docs · contrast · rtl
pnpm design:contrast  # every ratio computed from the OKLCH values
pnpm design:census -- --check
```
