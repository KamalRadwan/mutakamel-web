# Motion

Status: **Specification**

Written: **2026-08-27**

## What this replaced (pre-rebuild, for context)

Six surfaces in the live shell — the notifications dropdown, user dropdown,
pipeline select, country select, toast, and modal scrim — carry animation
classes that **do nothing**. `animate-in`, `fade-in`, `slide-in-from-top-2`,
`zoom-in-95`, `animate-fade-in` and `animate-gradient-x` are all undefined:
neither `tw-animate-css` nor `tailwindcss-animate` is installed, and
`globals.css` imports no animation plugin. Only `animate-bell-ring` is real.

Every dropdown in the app appears by hard cut today. Nobody noticed, which is
itself worth knowing — it sets the bar for how much motion this product
actually needs.

## Principle

Motion in an operations tool has exactly three jobs:

1. **Explain where something came from** — a popover growing from its trigger.
2. **Hold attention across a state change** — a row updating in place.
3. **Encode "in progress" without spending a hue** — the pending dot.

Motion that is not doing one of those three is decoration, and decoration is
what makes a dense tool tiring over an eight-hour shift.

## Install the plugin

```bash
pnpm add tw-animate-css
```

```css
/* src/app/globals.css — line 2, immediately after the tailwind import */
@import "tailwindcss";
@import "tw-animate-css";
```

This makes the existing `animate-in` / `fade-in` / `slide-in-from-*` /
`zoom-in-*` classes real, and it is what Radix's `data-[state=open]` variants
expect. Without it, every primitive built below renders with a hard cut.

## The budget

| Animation | Where | Duration |
| --- | --- | --- |
| Popover / dropdown / tooltip enter | Radix `data-[state=open]` | 120ms |
| Popover / dropdown / tooltip exit | Radix `data-[state=closed]` | 90ms |
| Dialog / sheet enter | Radix `data-[state=open]` | 160ms |
| Dialog / sheet exit | Radix `data-[state=closed]` | 120ms |
| **Command palette enter / exit** | `CommandPalette` — it *is* a `Dialog` | 160 / 120ms |
| **Disclosure open** | `Accordion` · `Collapsible` | **150ms** |
| **Disclosure close** | `Accordion` · `Collapsible` | **100ms** |
| Toast enter / exit | `sonner` defaults | 200ms |
| Skeleton shimmer | `Skeleton` primitive | 1.4s loop |
| Pending dot | `StatusBadge` in-progress | 1.8s loop |
| **Indeterminate progress** | `Progress` with a null value | **2s opacity loop** |
| Spinner | `Button loading`, `ErrorState` retry | 700ms loop |
| Board card drop settle | `@hello-pangea/dnd` | library default |
| **Chart mount** | `LineChart` · `BarChart` · `AreaChart` · `DonutChart` · `Sparkline` | **none — explicitly disabled** |

**That is the complete list.** Anything not on it does not animate. In
particular there are no scroll-triggered reveals, no staggered list entrances,
no page transitions, and no hover lift on cards.

Exit is always faster than enter. A thing leaving should not make you wait.

The bolded rows were added by MASTER-PLAN task 1.42, alongside the components
that needed them. Each is justified below rather than simply listed — a budget
that grows without a reason per line stops being a budget.

## The three overlays added in Phase 1 take the existing pairs

`CommandPalette`, `DeletionBlockerDialog` and `AtomicReplacementConfirm` all
compose the `Dialog` primitive, so they inherit **160 / 120ms** with no new
entry of their own. `FilterBar`'s chip-overflow popover and `MultiSelect`'s
compose `Popover`, so they inherit **120 / 90ms**. Nothing new was written;
this row exists so the inheritance is stated rather than assumed.

## The one height exception

**The general rule stands: never `transition` `height`, `width`, or a layout
`transform`.** It is in [Transitions](#transitions) below and it did not move.

**One narrow exception is now permitted**: a *keyframe* over a height the
library has already measured, on a **disclosure panel**, and nowhere else.
`Accordion` and `Collapsible` take it. Nothing else may.

It earns the exception on the budget's own first job — *explain where something
came from*. Without it a long accordion snaps everything below it up or down
under the pointer, which is precisely the layout jump the animation prevents.

Three properties make it safe, and all three must hold for any future case to
qualify:

1. **The height is measured, not guessed.** Radix writes
   `--radix-accordion-content-height` / `--radix-collapsible-content-height`
   before the animation runs, so this is a keyframe between two known values —
   not a transition to `auto`, which does not animate at all, and not the
   `grid-template-rows: 0fr → 1fr` trick, which animates the whole grid.
2. **It is one contained element**, not a page region. The cost is bounded.
3. **Removing it loses no information.** The open state is carried by
   `aria-expanded` and by the chevron, so the `prefers-reduced-motion` reset
   collapsing it to a hard cut is a complete degradation. This is what
   separates it from the pending dot and the spinner, which carve themselves
   *out* of that reset because removing them removes meaning.

**No CSS was added to `globals.css`.** `tw-animate-css` — already a dependency
— ships `accordion-down`, `accordion-up`, `collapsible-down` and
`collapsible-up`, and each reads the Radix variable. The primitives apply them
as utilities, which is where
[DESIGN-SYSTEM.md § 5](DESIGN-SYSTEM.md#5--no-stylesheet-of-component-classes)
says styling belongs.

## Indeterminate progress, and its reduced-motion carve-out

`Progress` with a `null` value renders a full-width bar pulsing its **opacity**
— the one property [Transitions](#transitions) already permits. It never
animates its width, because a width that moves without bytes moving is a
fabricated claim about the state of a write
([anti-patterns.md § 13](anti-patterns.md#13-fake-data-and-fake-success),
and [DECISIONS.md D14](../build/DECISIONS.md#d14--fileupload-has-no-progress-bar--assumed)).

**Its carve-out is different from the pending dot's, on purpose.** The dot
falls back to a static 45%-opacity dot so the in-progress state stays readable.
The indeterminate bar instead falls back to a **solid bar at 70% opacity**
(`motion-reduce:animate-none motion-reduce:opacity-70`), because a
half-transparent bar and a solid one are the determinate and indeterminate
states respectively — fading it would make it look like a bar stuck at some
percentage.

Radix omits `aria-valuenow` entirely for a null value, so the indeterminate
case *announces* as indeterminate. That is the primary signal; the animation is
reinforcement, which is why removing it costs nothing.

## Charts do not animate in

recharts animates a series in over **1500ms** by default, and every chart
wrapper passes `isAnimationActive={false}`.

A chart drawing itself does none of the three jobs at the top of this page. It
also delays the number the user opened the screen to read, on a dashboard whose
whole purpose is that number. The constant lives in one place —
`CHART_ANIMATION` in `src/design-system/patterns/chart/chart-common.tsx` — so a
new chart cannot forget it by omission.

`Calendar` disables `react-day-picker`'s month-slide for the same reason.

## Standard easing

```css
@theme {
  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
}
```

One curve for everything. `ease-out` shaped — fast start, soft landing — which
is what makes 120ms feel instant rather than abrupt.

## The pending dot

This is the mechanism that lets [tokens.md](tokens.md)'s law 1 hold — encoding
"in progress" without a fifth hue.

```css
@keyframes pulse-dot {
  0%, 100% { opacity: 1;    transform: scale(1);    }
  50%      { opacity: 0.45; transform: scale(0.82); }
}

.dot-pending {
  animation: pulse-dot 1.8s var(--ease-out-quart) infinite;
}
```

Rendered by `StatusBadge` whenever the mapped role is `ink + motion` — a 6px
`bg-ink-400` dot before the label. The badge always carries its text label, so
the motion is reinforcement, never the only signal.

For a whole row awaiting a server result, add `border-dashed` to the row rather
than animating the row itself. A pulsing table row is unusable to read.

## Shimmer

The one permitted gradient animation, and one of the two total gradients in the
[geometry budget](geometry.md#gradient-and-blur-budgets).

```css
@keyframes shimmer {
  100% { transform: translateX(100%); }
}
```

Applied by `Skeleton` as a translating highlight sweep over `bg-muted`. Under
RTL the sweep direction must mirror — drive it from `dir` rather than
hardcoding `translateX(100%)`, or Arabic users get a sweep running backwards
against their reading direction.

## Reduced motion

**Non-negotiable, and it must ship in the first foundation commit** —
not deferred to a polish pass.

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Two things survive this reset because removing them removes *information*, not
decoration:

- The **pending dot** falls back to a static 45%-opacity dot — still visually
  distinct from a solid dot, so the in-progress state stays readable.
- The **spinner** falls back to a static `aria-busy` state with visible text.

Verify both by toggling the OS setting, not by reading the CSS.

Both carve-outs are in `globals.css`'s `prefers-reduced-motion` block, as
`animation: none !important` overrides. The spinner's was missing until
MASTER-PLAN task 3.32, and the failure it left behind is worth naming: under
the generic reset, `animate-spin` plays **one** 0.01ms revolution and settles
on whatever rotation that lands on. The result is a motionless icon that still
claims to be a spinner — which is why the carve-out stops the animation
outright rather than leaving it to the reset. Every `animate-spin` site pairs
with `aria-busy` and visible text (`Button`, `TenantAuthGuard`, `Combobox`,
the reload controls), so the state survives losing the animation.

`animate-bell-ring` and its keyframe are **gone** as of task 3.33. It was an
infinite rotation outside the motion budget, carrying a standing instruction to
delete it that no task had picked up. Its only consumer,
`NotificationsDropdown`, now carries the unread state through the count badge,
the dot and the polite live region — none of which need motion to be read.

## Transitions

Only these properties transition, and only at 120ms:

```text
background-color, border-color, color, opacity, box-shadow
```

Never transition `width`, `height`, `transform` on layout, or `all`. `all` is
banned outright — it animates properties you did not intend, including ones
added later by someone else.

This is about `transition`, and it is unchanged. The single **keyframe**
exception for a measured disclosure height is
[above](#the-one-height-exception), and it is not a licence to transition
height anywhere.
