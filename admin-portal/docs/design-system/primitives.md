# Primitives

Status: **[Verified inventory; target conformance requirements added]**

Last source verification: **2026-08-29**

Owner: **Admin Portal**

Source: `src/design-system/primitives/*.tsx` (26 files). All are exported
from the `@/design-system` barrel — feature code imports from there, never
by reaching into `src/design-system/primitives/Button` directly (AGENTS.md).

Primitives may compose `focusRing`, `controlSize`, and Radix behavior, but those
dependencies do not make every consumer accessible “for free.” Each primitive
still owns its accessible name, localized built-in text, target area, disabled
explanation, loading announcement, reduced-motion behavior, and focus-return
contract. Current source has gaps in several of these areas.

See [Geometry and density](geometry-and-density.md#hit-areas-current-gap-and-target)
and
[Accessibility, responsive behavior, and localization](accessibility-responsive-and-localization.md).

## Button

Current `variant`: `primary` uses the transitional emerald brand fill. The
approved target maps it to cobalt `action` with a white label after `action`
and `success` are separated.

Variants are `primary`, `secondary` (default), `outline`, `ghost`,
`destructive`, and `link`. `size`:
`xs`/`sm`/`md`/`lg`/`xl`. `loading` renders a spinning `Loader2` before the
label with `aria-busy`. `asChild` (Radix `Slot`) lets a `Button`-styled
element render as something else — e.g. a `next/link` `<Link>` — without an
extra wrapper DOM node.

**Fixed defect:** `asChild` composition used to render the loading spinner
as a sibling of `children` unconditionally, which breaks Radix `Slot`'s
requirement of exactly one child element (`Children.count(children) === 1 &&
isValidElement(children)` — the array-of-two case fails `isValidElement`
even though `Children.count` reports 1 after ignoring the falsy `loading`
value). Fixed in Phase 17 by only rendering the spinner sibling when not
`asChild`.

`buttonVariantClasses()` exports the same styling as a plain class string,
for the one case (Radix `AlertDialog.Action`/`Cancel`) where the framework
requires its own element to be the interactive one, so `asChild` isn't an
option.

## Field

Constraint-critical: generates a stable `useId()`-based `htmlFor`, wires
`aria-describedby` to hint/error text, and sets `aria-invalid`. A `Field`
error stays inline and never becomes toast-only. Multi-field submission
recovery is a form-level target rather than `Field` behavior: one invalid field
receives focus; multiple invalid fields render and focus a summary linked to
each field.

## Badge

Current `tone` values are `brand`, `danger`, `warn`, and `neutral`. The target
renames healthy `brand` usage to `success` and adds an `action`/`info` treatment
that may not be used as a success state.

## Dialog / AlertDialog / Sheet

`Dialog` wraps Radix `Dialog`; `DialogContent` takes `showCloseButton`
(default `true`) added in Phase 14 so `CommandPalette` can suppress the
default close button. `AlertDialog` wraps Radix `AlertDialog` and absorbed
the pre-migration `useAccessibleDialog.ts` hook's job (focus trap, scroll
lock, `Esc`). That former helper has been deleted. `Sheet` also wraps Radix
`Dialog` (not a separate primitive)
with a `side` prop that is **logical** (`"start"` / `"end"`), not
`"left"`/`"right"` — it mirrors correctly under `dir="rtl"` without a
consumer having to branch on direction.

Target requirement: built-in close names are localized. Initial focus, Escape
behavior, focus return, scroll locking, and reduced-motion behavior are verified
in both directions. Incoming calls or other urgent modal interactions use
alert-dialog semantics rather than a visually floating `<aside>`.

## Table

Bare `<table>`/`<thead>`/`<tbody>`/`<tr>` wrappers with design-system
classNames and no Radix dependency. Native table semantics are the foundation,
but they do not automatically provide a name, focusable scroll region,
sortable-button behavior, selection labels, or responsive overflow.
Consumed by `DataTable` (see [patterns.md](patterns.md)), not
meant to be reached for directly by feature code for a new table.

## Everything else

| Primitive | Radix source | Note |
| --- | --- | --- |
| `AlertDialog` | `@radix-ui/react-alert-dialog` | See Dialog above |
| `Avatar` | `@radix-ui/react-avatar` | |
| `Badge` | — (plain CVA) | See Badge above |
| `Breadcrumb` | — (plain markup) | Logical chevron, flips under RTL |
| `Button` | `@radix-ui/react-slot` (for `asChild`) | See Button above |
| `Card` | — (plain markup) | `CardHeader`/`CardTitle`/`CardDescription`/`CardContent`; no shadow — see geometry-and-density.md |
| `Checkbox` | `@radix-ui/react-checkbox` | |
| `Collapsible` | `@radix-ui/react-collapsible` | |
| `Dialog` | `@radix-ui/react-dialog` | See Dialog above |
| `DropdownMenu` | `@radix-ui/react-dropdown-menu` | |
| `Field` | — (plain markup + `useId`) | See Field above |
| `Input` | — (plain `<input>`) | |
| `Label` | `@radix-ui/react-label` | |
| `Popover` | `@radix-ui/react-popover` | |
| `Progress` | `@radix-ui/react-progress` + `@radix-ui/react-direction` | Reads `useDirection()` directly for RTL fill direction |
| `RadioGroup` | `@radix-ui/react-radio-group` | |
| `ScrollArea` | `@radix-ui/react-scroll-area` | |
| `Select` | `@radix-ui/react-select` | Propagates `dir` for RTL keyboard nav |
| `Separator` | `@radix-ui/react-separator` | |
| `Sheet` | `@radix-ui/react-dialog` | See Dialog above |
| `Skeleton` | — (plain markup) | The one permitted shimmer animation |
| `Switch` | `@radix-ui/react-switch` | Thumb travel direction mirrors under RTL |
| `Table` | — (plain markup) | See Table above |
| `Tabs` | `@radix-ui/react-tabs` | |
| `Textarea` | — (plain `<textarea>`) | |
| `Tooltip` | `@radix-ui/react-tooltip` | `TooltipProvider` must wrap the tree once |

## Not yet built

The original plan called for a `Combobox` (command+popover, absorbing
`CountrySelect.tsx`'s 250-country search). It does not exist yet.
`CountrySelect.tsx` remains a separate component and does not currently provide
a complete listbox/option, arrow-key, Escape, typeahead, or focus-return model.
This is an accessibility-critical roadmap item, not optional polish.
