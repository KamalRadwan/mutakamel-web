# Tenant Portal — Design System

Status: **Specification**

Written: **2026-08-28**

Supersedes the warm-neutral palette and the 36px/40px density in
[tokens.md](tokens.md) and [geometry.md](geometry.md). Where this file and
those disagree, **this file wins** — the sibling pages carry the longer
reasoning, this one carries the decisions.

## The seven constraints this was built to

1. Per-page UI/UX, not just tokens.
2. Explicit colors, fonts, sizes — no "pick something sensible".
3. **Cold blue**, not warm grey.
4. Named libraries. **No stylesheet full of component classes.**
5. **Every write result is a toast.** Never a card in the page body.
6. **Dense** — many rows visible at once.
7. Looks designed, not generated.

---

# 1 · Color

Cold blue throughout. The neutral ramp is not grey — it is a desaturated blue
at hue 240, so a surface next to a white browser chrome reads *cool*, and the
brand sits inside the same family instead of fighting it.

## The four roles

| Role | Ramp | Hue | Job |
| --- | --- | --- | --- |
| Brand | `brand` | 258 | Primary action, active nav, focus ring, links |
| Positive | `positive` | 160–168 (teal-green) | Won, converted, active |
| Caution | `caution` | 56–82 (amber) | On hold, degraded, needs attention |
| Negative | `negative` | 13–20 (crimson) | Lost, disqualified, destructive, error |
| Neutral | `ink` | 240 (cold blue) | Text, borders, surfaces, **every in-progress state** |

Three deliberate choices:

- **Positive is teal-green (hue ~164), not grass green.** A warm green next to
  a cold blue neutral looks like it came from a different system. Teal belongs.
- **Negative is crimson (hue ~15), not orange-red.** Warm red fights the cold
  ground; crimson sits against it cleanly and stays far from amber.
- **Amber stays warm on purpose.** It is the one hue allowed to feel out of
  place — that is what makes a caution state catch the eye on a cold screen.

## Ramps — exact values

Every step verified in-gamut and contrast-checked by
`node scripts/design/contrast.mjs`.

```css
@theme {
  /* INK — cold blue neutral, hue 240. 13 steps: ink-25 is the table zebra row,
     ink-1000 the dark canvas. Chroma peaks mid-ramp so mid-greys read blue
     rather than washing out at the ends. */
  --color-ink-25:   oklch(0.992 0.004 240);  /* #fafdff */
  --color-ink-50:   oklch(0.983 0.006 240);  /* #f6fafd */
  --color-ink-100:  oklch(0.963 0.010 240);  /* #edf4f9 */
  --color-ink-200:  oklch(0.923 0.016 240);  /* #dce7ef */
  --color-ink-300:  oklch(0.865 0.022 240);  /* #c6d5e0 */
  --color-ink-400:  oklch(0.712 0.028 240);  /* #93a5b2 */
  --color-ink-500:  oklch(0.585 0.030 240);  /* #6c7f8c */
  --color-ink-600:  oklch(0.482 0.030 240);  /* #4f616e */
  --color-ink-700:  oklch(0.399 0.028 240);  /* #3a4a55 */
  --color-ink-800:  oklch(0.316 0.026 240);  /* #26343e */
  --color-ink-900:  oklch(0.247 0.023 240);  /* #17222b */
  --color-ink-950:  oklch(0.174 0.020 240);  /* #081118 */
  --color-ink-1000: oklch(0.126 0.017 240);  /* #02070c */

  /* BRAND — blue, hue 258. Anchored at 600, the light-mode fill. */
  --color-brand-50:  oklch(0.968 0.014 258);  /* #eff5fe */
  --color-brand-100: oklch(0.936 0.030 258);  /* #deebfe */
  --color-brand-200: oklch(0.882 0.056 258);  /* #c2dafe */
  --color-brand-300: oklch(0.800 0.097 258);  /* #97c0fc */
  --color-brand-400: oklch(0.700 0.155 258);  /* #5e9efd */
  --color-brand-500: oklch(0.606 0.180 258);  /* #327feb */
  --color-brand-600: oklch(0.520 0.180 258);  /* #1364ce */
  --color-brand-700: oklch(0.442 0.155 258);  /* #0a4ea6 */
  --color-brand-800: oklch(0.375 0.128 258);  /* #093e83 */
  --color-brand-900: oklch(0.318 0.102 258);  /* #0a3065 */
  --color-brand-950: oklch(0.220 0.070 258);  /* #04193a */

  /* POSITIVE — teal-green, hue 168->160. */
  --color-positive-50:  oklch(0.972 0.016 168);
  --color-positive-100: oklch(0.940 0.036 168);
  --color-positive-200: oklch(0.884 0.066 168);
  --color-positive-300: oklch(0.812 0.096 166);
  --color-positive-400: oklch(0.740 0.118 165);
  --color-positive-500: oklch(0.660 0.125 164);
  --color-positive-600: oklch(0.565 0.113 163);
  --color-positive-700: oklch(0.478 0.094 162);
  --color-positive-800: oklch(0.402 0.077 161);
  --color-positive-900: oklch(0.340 0.062 160);
  --color-positive-950: oklch(0.232 0.042 160);

  /* CAUTION — amber, hue 82->56. The torsion toward orange is physics: without
     it the dark steps read olive. */
  --color-caution-50:  oklch(0.981 0.018 82);
  --color-caution-100: oklch(0.957 0.040 81);
  --color-caution-200: oklch(0.914 0.076 78);
  --color-caution-300: oklch(0.863 0.112 74);
  --color-caution-400: oklch(0.809 0.150 69);
  --color-caution-500: oklch(0.755 0.154 64);
  --color-caution-600: oklch(0.663 0.146 60);
  --color-caution-700: oklch(0.548 0.128 58);
  --color-caution-800: oklch(0.458 0.104 57);
  --color-caution-900: oklch(0.392 0.084 56);
  --color-caution-950: oklch(0.257 0.056 56);

  /* NEGATIVE — crimson, hue 20->13. Cold-compatible; far from amber. */
  --color-negative-50:  oklch(0.971 0.014 20);
  --color-negative-100: oklch(0.939 0.029 19);
  --color-negative-200: oklch(0.886 0.056 18);
  --color-negative-300: oklch(0.810 0.104 17);
  --color-negative-400: oklch(0.712 0.160 16);
  --color-negative-500: oklch(0.630 0.200 15);
  --color-negative-600: oklch(0.556 0.208 15);
  --color-negative-700: oklch(0.474 0.180 14);
  --color-negative-800: oklch(0.400 0.148 14);
  --color-negative-900: oklch(0.343 0.121 13);
  --color-negative-950: oklch(0.228 0.082 13);
}
```

## Semantic tokens

shadcn-registry names, so `npx shadcn add <x>` pastes in unmodified.

| Token | Light | Dark |
| --- | --- | --- |
| `--background` | `ink-50` | `ink-1000` |
| `--foreground` | `ink-900` | `ink-100` |
| `--canvas` | `ink-100` | `ink-1000` |
| `--card` / `--card-foreground` | `white` / `ink-900` | `ink-950` / `ink-100` |
| `--popover` / `--popover-foreground` | `white` / `ink-900` | `ink-900` / `ink-100` |
| `--primary` / `--primary-foreground` | `brand-600` / `white` | `brand-400` / `ink-950` |
| `--secondary` / `--secondary-foreground` | `ink-100` / `ink-800` | `ink-800` / `ink-100` |
| `--muted` / `--muted-foreground` | `ink-100` / `ink-600` | `ink-900` / `ink-400` |
| `--accent` / `--accent-foreground` | `ink-100` / `ink-900` | `ink-800` / `ink-100` |
| `--destructive` / `--destructive-foreground` | `negative-700` / `white` | `negative-700` / `white` |
| `--border` / `--input` | `ink-200` | `ink-800` |
| `--ring` | `brand-500` | `brand-400` |
| `--row-zebra` | `ink-25` | `ink-950` |
| `--sidebar` / `--sidebar-active` | `white` / `brand-700` | `ink-950` / `brand-300` |

**`--accent` is neutral hover fill, not brand.** Wiring a hover to it expecting
blue is how a UI ends up glowing everywhere.

## Measured contrast

| Pairing | Light | Dark | Bar |
| --- | ---: | ---: | ---: |
| Fill — label on `--primary` | **5.64** | **7.04** | 4.5 |
| Link / text | **7.87** | **10.80** | 4.5 |
| Muted text | **6.44** | **7.94** | 4.5 |
| Body text | **15.34** | **18.15** | 4.5 |
| Focus ring (non-text) | **3.74** | ≥3 | 3.0 |
| Destructive fill | **7.41** | **7.41** | 4.5 |
| Positive text | **6.28** | **11.71** | 4.5 |

Every number computed, not estimated. The cold palette has **more headroom
than the warm one it replaces** — the tightest value moved from 3.19 to 3.74.

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

| Role | Family | Weights | Why |
| --- | --- | --- | --- |
| All UI text | **Readex Pro** | 400 · 500 · 600 | One superfamily covering Latin **and** Arabic. A Latin enum inside an Arabic sentence shares vertical metrics — no baseline jump, no `:lang()` switching |
| IDs, codes, numerals | **DM Mono** | 400 · 500 | Unambiguous `0`/`O`, `1`/`l`; sits quietly beside Readex |

Verified available on Google Fonts with a full Arabic subset
(`U+0600–06FF`, `U+FB50–FDFF`, `U+FE70–FEFC`). Loaded through `next/font`,
self-hosted — **no `<link>` to Google**, which keeps `font-src 'self'` in the
CSP.

Fallback if Readex Pro's Arabic proves too wide at row density: **Zain**.

## Scale — 7 steps

| Token | Latin | Arabic | Line | Use |
| --- | ---: | ---: | ---: | --- |
| `text-2xs` | 12px | 12px | 16 | Latin uppercase micro-labels **only** |
| `text-xs` | **13px** | **14px** | 18 / 20 | **Workhorse** — table cells, badges, metadata |
| `text-sm` | **14px** | **15px** | 20 / 22 | Base — body, buttons, nav ([not inputs on mobile](#inputs-are-16px-on-mobile)) |
| `text-base` | 15px | 16px | 24 / 26 | Prose, dialog description |
| `text-lg` | 17px | 17px | 24 | Card and dialog titles |
| `text-xl` | 20px | 20px | 28 | Page title |
| `text-2xl` | 24px | 24px | 32 | KPI numerals — **ceiling** |

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

| 600 | Headings, `<th>`, KPI numerals, button labels, active nav |
| 500 | Form labels, tabs, badges, card titles |
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

Tuned for many rows on a 1366×768 laptop.

```css
:root {
  --size-control-xs: 1.5rem;    /* 24px — inline table actions */
  --size-control-sm: 1.75rem;   /* 28px — toolbar, filters */
  --size-control-md: 2rem;      /* 32px — DEFAULT */
  --size-control-lg: 2.25rem;   /* 36px — primary action, login */
  --size-control-xl: 2.5rem;    /* 40px — rare */

  --size-row:      2.25rem;     /* 36px — DataTable row */
  --size-topbar:   2.75rem;     /* 44px */
  --size-sidebar:  14.5rem;     /* 232px expanded */
  --size-rail:     3rem;        /* 48px collapsed */
}
```

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

**What this buys:** 44px topbar + 36px header + 36px rows on 768px of viewport
gives **16 rows visible without scrolling**, against 11 at the previous
40px/48px sizing.

## Radius — 4 steps, tight

```css
--radius-xs: 0.125rem;  /* 2px — checkbox, chips, inline code */
--radius-sm: 0.25rem;   /* 4px — DEFAULT: buttons, inputs, badges */
--radius-md: 0.375rem;  /* 6px — cards, table shell, popovers */
--radius-lg: 0.5rem;    /* 8px — dialogs, drawers */
```

Nothing above 8px. Oversized corners are the single loudest "generated" tell.

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

@theme        { /* ramps, type scale, radius, control sizes */ }
@theme inline { /* font vars, semantic→utility bridges */ }
:root / .dark { /* semantic token values */ }
html[lang="ar"] { /* the Arabic type lift */ }

@keyframes shimmer   { }
@keyframes pulse-dot { }

body { background; color; font-family; font-synthesis-weight: none; }

@media (prefers-reduced-motion: reduce) { }
```

**Roughly 200 lines, of which zero style a component.**

### Banned in that file

- Any class selector — no `.btn`, `.card`, `.field`, `.table-row`
- `@apply` — it is a stylesheet wearing a utility costume
- Element selectors beyond `body` and `html[lang]`
- Any `@layer components` block

### Where styling actually lives

```tsx
// src/design-system/primitives/Button.tsx
const button = cva(
  "inline-flex items-center justify-center rounded-sm font-semibold " +
  "transition-colors disabled:opacity-50 disabled:pointer-events-none " +
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        primary:  "bg-primary text-primary-foreground hover:bg-brand-700",
        outline:  "border border-border bg-transparent hover:bg-accent",
        ghost:    "hover:bg-accent",
        destructive: "bg-destructive text-destructive-foreground hover:bg-negative-800",
      },
      size: {
        xs: "h-(--size-control-xs) px-1.5 text-xs gap-1",
        sm: "h-(--size-control-sm) px-2   text-xs gap-1.5",
        md: "h-(--size-control-md) px-3   text-sm gap-1.5",
        lg: "h-(--size-control-lg) px-4   text-sm gap-2",
      },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);
```

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

Shell for every authenticated page: **232px sidebar** (48px rail when
collapsed) + **44px topbar** + `main` with a 16px gutter.

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

`DataTable`. 36px rows, `text-xs`, weight 400, zebra `--row-zebra`.

- Sticky header: `bg-card`, `border-b`, `text-xs`/600 — **a hairline and a
  label, not a filled grey bar**
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

Cards `p-3`, `rounded-md`, title `text-sm`/500. Below `lg` the rail stacks
above. Definition lists are two columns: label `text-xs` muted, value
`text-xs`/400. Full spec: [detail-screens.md](detail-screens.md).

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

**The table header is a hairline, not a bar.** `bg-card` with a bottom border
and 600-weight labels. A filled grey header band is the single most common
"admin template" tell.

**Zebra rows at `ink-25`, not `ink-50`.** A 0.9% lightness step is enough for
the eye to track a row across eight columns and quiet enough to disappear when
you are not tracking. `ink-50` reads as stripes.

**Focus rings inset on dense controls.** At 24px with 4px gaps, a 2px ring plus
2px offset collides with the neighbour. Table-row action buttons use
`focus-visible:ring-inset` — visible, no collision.

**Numbers get the mono face, names do not.** IDs, amounts, counts and
timestamps in DM Mono at `text-xs`; names in Readex. The eye stops hunting for
column boundaries.

**One empty-state line, no illustration.** "No leads match these filters" plus
a **Clear filters** button. A centred illustration in a 36px-row table is
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

**Truncate with a tooltip, never wrap.** A wrapping cell breaks the 36px row
and the whole table shifts. `truncate` + `title`.

**The primary button is the only saturated fill on screen.** Everything else is
outline, ghost, or a tint. That is what makes `brand-600` read as *the* action
above 16 rows of data.

---

# 9 · Non-negotiables

- **Logical properties only.** `ms-` `me-` `ps-` `pe-` `start-` `end-`
  `text-start` `text-end`. `pnpm design:rtl` fails the build at count > 0.
- **Both languages, both themes, every screen.** Not a later pass.
- **Zero language ternaries** — a component never branches on language to pick
  a string.
- **No arbitrary `text-[Npx]`**, no `font-bold`, no `rounded-xl` or above, no
  decorative gradient, no `backdrop-blur` outside the modal scrim.
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
