# Motion

Status: **Specification**

Written: **2026-08-27**

## The current state this replaces

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
| Toast enter / exit | `sonner` defaults | 200ms |
| Skeleton shimmer | `Skeleton` primitive | 1.4s loop |
| Pending dot | `StatusBadge` in-progress | 1.8s loop |
| Spinner | `Button loading`, `ErrorState` retry | 700ms loop |
| Board card drop settle | `@hello-pangea/dnd` | library default |

**That is the complete list.** Anything not on it does not animate. In
particular there are no scroll-triggered reveals, no staggered list entrances,
no page transitions, and no hover lift on cards.

Exit is always faster than enter. A thing leaving should not make you wait.

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

## Transitions

Only these properties transition, and only at 120ms:

```text
background-color, border-color, color, opacity, box-shadow
```

Never transition `width`, `height`, `transform` on layout, or `all`. `all` is
banned outright — it animates properties you did not intend, including ones
added later by someone else.
