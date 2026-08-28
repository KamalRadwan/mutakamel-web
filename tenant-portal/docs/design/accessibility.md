# Accessibility

Status: **Specification**

Written: **2026-08-28**

Resolves [OPEN-QUESTIONS.md](../build/OPEN-QUESTIONS.md) Q7.

Target: **WCAG 2.2 AA.** The requirements below are distributed across the
other design pages by topic; this is the single checklist to review a screen
against.

## Why this matters more here than in most apps

This is an Arabic-first, RTL, dense operations tool used all shift. Three
consequences:

- A screen-reader user in Arabic hits **every** hardcoded English `aria-label`.
  There is no "it's just a label" here — see [i18n.md](i18n.md).
- RTL breaks keyboard navigation silently if Radix is not told the direction.
  Arrow keys go the wrong way and nothing errors.
- Density pressure pushes toward icon-only controls and tiny text — the two
  most common accessibility regressions.

## Perceivable

### Contrast

Every pairing in [tokens.md](tokens.md#contrast-resolution) is **computed**,
not estimated — `pnpm design:contrast` reproduces it and fails on a
regression.

- Body and UI text: **≥ 4.5:1**
- Non-text (focus rings, borders carrying meaning): **≥ 3:1**
- `brand-500` as the light focus ring is the tightest value at **3.19** — do
  not lighten `ink-50` or lower `brand-500`'s chroma without re-running.

### Color is never the only signal

`StatusBadge` **always** renders a text label. An in-progress state adds a
pulsing dot *and* keeps its label. A board column carrying an outcome gets a
colored top border *and* its stage name.

This is why stage is not encoded by hue at all — nine opportunity stages have
no colorblind-safe encoding ([README.md](README.md#1-four-hues--and-a-stage-is-never-one-of-them)).

### Type

13px floor, lifted to 14px in Arabic. `text-2xs` (12px) is Latin uppercase
micro-labels only and must never wrap Arabic. No arbitrary `text-[Npx]` — lint
errors on it.

### Motion

`prefers-reduced-motion` ships in the **foundation** commit, not a polish pass
([motion.md](motion.md#reduced-motion)). Two things survive the reset because
removing them removes information:

- the pending dot → static 45% opacity, still distinct
- the spinner → static, with `aria-busy` and visible text

## Operable

### Keyboard

Everything interactive is reachable and operable by keyboard. No exceptions,
including:

| Surface | Requirement |
| --- | --- |
| `ViewSwitcher` | `radiogroup`, arrow keys move, one tab stop |
| **Board drag-and-drop** | `@hello-pangea/dnd`'s keyboard path — space to lift, arrows to move, space to drop. **Do not disable it** |
| `DataTable` rows | Navigable; the action cluster is reachable |
| Cards | Focusable; `Enter` opens the detail route |
| Dialog / Sheet | Focus trapped, `Escape` closes, focus returns to the trigger |
| Sidebar | `Cmd`/`Ctrl` + `B`; mobile sheet traps focus and closes on route change |

### Focus is always visible

Every interactive primitive spreads `focusRing`
([geometry.md](geometry.md#focus)). `focus-visible`, not `focus`, so a mouse
click does not paint a ring.

**Never `outline: none` without a replacement.** Density is not a reason to
remove focus indication.

### Touch targets

Controls below 44px get an **invisible hit-area expansion**, not a bigger box
([geometry.md](geometry.md#hit-area-expansion)). Never solve a target audit by
growing the visible control.

### No keyboard traps

The only focus trap is inside a modal, and `Escape` always exits it.

## Understandable

### Every control has an accessible name, in the active language

Icon-only buttons need `aria-label` **and** a `Tooltip`. Both come from the
dictionary. A hardcoded English `aria-label` is invisible to an Arabic
screen-reader user.

### Direction is wired into Radix

`DirectionBridge` feeds `dir` into Radix's `DirectionProvider`. Without it,
arrow-key navigation in `Tabs`, `Select` and `DropdownMenu` stays LTR while the
UI renders RTL — a silent failure that no test catches unless you assert it
([theming.md](theming.md#rtl)).

### Announcements

`aria-live="polite"` for state the user should hear but not be interrupted by:

- View change — "Board view, 42 leads"
- Board drag lift and drop — translated
- Pagination — "Page 2 of 6"
- Optimistic rollback — the row reverted

`aria-live="assertive"` only for errors that block the current action.

All announcement text is a dictionary string with placeholders.

### Errors

- Field errors: inline, `aria-describedby`, `aria-invalid` — **never a toast**
  ([patterns.md](patterns.md#where-a-result-belongs))
- `403`: `PermissionGate`, a labelled in-body state — **not** `EmptyState`
- Load failure: `ErrorState` with a real retry control

## Robust

### Semantics before ARIA

Use the element that already means it. `DataTable` renders a real `<table>`
with `<th>`; `Button` renders a `<button>`. ARIA is for what HTML cannot
express, not a substitute for it.

### Bidirectional text

Wrap bare identifiers — UUIDs, correlation IDs, phone numbers — in `<bdi>`.
Without it, bidirectional reordering mangles a Latin ID inside an Arabic
sentence, and the displayed value is wrong rather than merely ugly.

### Language and direction on the root

`<html lang>` and `dir` are correct in the **first painted frame**, via the
pre-hydration bootstrap. A screen reader reading Arabic content announced as
`lang="en"` uses the wrong voice for the whole page.

## Per-screen review checklist

- [ ] Tab through the entire screen — everything reachable, focus always visible
- [ ] Operate every control by keyboard alone, including board drag
- [ ] `Escape` closes every overlay and returns focus
- [ ] Every icon-only control has a translated accessible name
- [ ] No information conveyed by color alone
- [ ] Reviewed in **Arabic RTL** and **English LTR**
- [ ] Reviewed in **dark** and **light**
- [ ] Arrow keys work correctly in both directions
- [ ] `prefers-reduced-motion` on — nothing animates, nothing is lost
- [ ] Zoom to 200% — no content lost, no horizontal page scroll
- [ ] Identifiers wrapped in `<bdi>`

## What the gates catch, and what they do not

`pnpm design:rtl` catches physical direction utilities. `pnpm design:contrast`
catches contrast regressions. `pnpm lint` catches arbitrary type sizes.

**Nothing mechanical catches** a missing accessible name, a broken keyboard
path, a wrong announcement, or an Arabic label that reads as nonsense. Those
need the checklist above, run by a person, per screen.
