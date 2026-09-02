# Primitives

Status: **Specification**

Written: **2026-08-27**

Implementation: `src/design-system/primitives/` — 21 files, all exported from
the `@/design-system` barrel.

Every primitive composes `focusRing` and, where sized, `controlSize` from
`src/design-system/lib/variants.ts`, so a visible keyboard focus ring and the
28/32/36/40/44px height scale are consistent for free.

Radix UI supplies focus trapping, `Esc` handling, roving tabindex and ARIA
wiring wherever noted. **Do not hand-roll those behaviors** — the current app
hand-rolls a focus trap in `Modal.tsx` and it is one of the things being
deleted.

## Dependencies to install

```bash
pnpm add @radix-ui/react-alert-dialog @radix-ui/react-avatar \
  @radix-ui/react-checkbox @radix-ui/react-dialog @radix-ui/react-direction \
  @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-popover \
  @radix-ui/react-radio-group @radix-ui/react-scroll-area @radix-ui/react-select \
  @radix-ui/react-separator @radix-ui/react-slot @radix-ui/react-switch \
  @radix-ui/react-tabs @radix-ui/react-tooltip \
  class-variance-authority clsx tailwind-merge sonner next-themes tw-animate-css
```

## The 21

| Primitive | Built on | Notes |
| --- | --- | --- |
| `Button` | `@radix-ui/react-slot` | See below |
| `Input` | plain `<input>` | `controlSize`, `focusRing`, `aria-invalid`, `text-base sm:text-sm` |
| `Textarea` | plain `<textarea>` | Min 3 rows, resize-y only, `text-base sm:text-sm` |
| `Label` | `@radix-ui/react-label` | Weight 500, `text-sm` |
| `Field` | plain + `useId` | See below — constraint-critical |
| `Select` | `@radix-ui/react-select` | Propagates `dir` for RTL keys |
| `Checkbox` | `@radix-ui/react-checkbox` | `rounded-xs` (2px) |
| `RadioGroup` | `@radix-ui/react-radio-group` | |
| `Switch` | `@radix-ui/react-switch` | Thumb travel mirrors under RTL |
| `Card` | plain | `CardHeader`/`Title`/`Description`/`Content`/`Footer`. **No shadow** |
| `Badge` | plain CVA | `tone`: `brand`/`positive`/`caution`/`negative`/`neutral` |
| `Separator` | `@radix-ui/react-separator` | |
| `Skeleton` | plain | The one permitted shimmer |
| `IdentifierText` | plain `<bdi>` | **The only way to render a machine identifier.** `dir="ltr"` + `wrap-anywhere`. See [typography.md](typography.md#identifiers-wrap-never-overflow) |
| `Dialog` | `@radix-ui/react-dialog` | `showCloseButton` prop |
| `AlertDialog` | `@radix-ui/react-alert-dialog` | Destructive confirmation only |
| `Sheet` | `@radix-ui/react-dialog` | **Logical** `side`: `start`/`end` |
| `Tabs` | `@radix-ui/react-tabs` | |
| `DropdownMenu` | `@radix-ui/react-dropdown-menu` | Compute physical `side` from `dir` |
| `Popover` | `@radix-ui/react-popover` | Same |
| `Tooltip` | `@radix-ui/react-tooltip` | `TooltipProvider` wraps the tree once |
| `Avatar` | `@radix-ui/react-avatar` | Initials fallback |
| `ScrollArea` | `@radix-ui/react-scroll-area` | Board columns, long menus |
| `Table` | plain | Semantic wrappers. Feature code uses `DataTable` instead |

## Button

```ts
variant: "primary" | "secondary" | "outline" | "ghost" | "destructive" | "link"
size:    "xs" | "sm" | "md" | "lg" | "xl"        // default md (36px)
loading?: boolean
asChild?: boolean
```

| Variant | Light | Dark |
| --- | --- | --- |
| `primary` | `bg-brand-600` + white label | `bg-brand-400` + `ink-950` label |
| `secondary` | `bg-secondary` + `text-secondary-foreground` | same tokens |
| `outline` | `border-border`, transparent, `hover:bg-accent` | same |
| `ghost` | transparent, `hover:bg-accent` | same |
| `destructive` | `bg-negative-700` + white | same |
| `link` | `text-brand-700`, underline on hover | `text-brand-300` |

Rules:

- **At most one `primary` per screen**, in `PageHeader`.
- **`type` defaults to `"button"`.** HTML defaults a `<button>` inside a
  `<form>` to `type="submit"`, and `FormDrawer` is a real form — without this,
  every add-a-row, remove-a-chip and reveal-password control in a drawer body
  would save the record. A submit control says `type="submit"` for itself. Left
  alone under `asChild`, where the rendered element may not be a button at all.
- **`cursor-pointer` lives in the base CVA.** Neither Radix nor Tailwind
  Preflight adds it, and a native `<button>` does not carry it by default —
  without this line every button in the app shows a text cursor. Anything else
  clickable that is not a `Button` (a row, a card, a chip) has to add it
  itself.
- `loading` renders a spinning `Loader2` before the label and sets `aria-busy`.
  It does **not** replace the label — a button that becomes a bare spinner
  loses its accessible name and its width.
- **`asChild` + `loading` trap:** Radix `Slot` requires exactly one child
  element. Rendering the spinner as an unconditional sibling breaks it. Render
  the spinner sibling **only when not `asChild`**. This exact defect shipped in
  the sibling portal.
- Export `buttonVariantClasses()` as a plain class string for the one case
  where the framework must own the element — Radix `AlertDialog.Action` and
  `.Cancel` — so `asChild` is not needed there.
- Icon-only buttons take `size="icon"` semantics via `aria-label` **and** a
  `Tooltip`. Never an icon-only button with no accessible name.

## Field

Constraint-critical. It is the only correct way to render a labelled input.

```tsx
<Field label={t.fields.email} hint={t.auth.emailHint} error={errors.email} required>
  <Input type="email" />
</Field>
```

It generates a stable `useId()` `htmlFor`, wires `aria-describedby` to hint and
error text, sets `aria-invalid`, and marks required state.

**A field error stays inline and never becomes a toast.** It must remain a
persistent, programmatically-associated target for the input. See
[patterns.md](patterns.md#where-a-result-belongs).

### The control claims the field, the field does not push at the control

`Field` publishes its id and ARIA state through **context**
(`primitives/field-control.tsx`). Every design-system control calls
`useFieldControl()` and takes them; the control's own props always win.

It used to push them onto its **direct child** with `cloneElement`. That is a
guess about which element is focusable, and the guess was wrong in four shapes
at once:

| Shape | What the direct child actually was | Result |
| --- | --- | --- |
| `Field > Select` | Radix `Select.Root` — a context component that renders **no DOM node** | 125 selects with no accessible name |
| `Field > div > Input` | a wrapper positioning a reveal button | the id landed on the `<div>`; two password fields unnamed |
| `Field > CustomFieldValueInput` | a feature component that forwarded nothing | every custom-field value unnamed |
| `Field > Combobox` / `DatePicker` / `MultiSelect` / `DateRangePicker` | a composite taking `id` but not the rest | 29 fields lost hint, error and required |

Context fixes all four at once, because it reaches the control **at any depth**
and through anything in between. Two rules follow from it:

- **Exactly one control per `Field`.** Two controls claiming the same id
  produce duplicate ids, and `htmlFor` then resolves to whichever comes first.
- **`FieldControlBoundary` opts a subtree out.** A composite wraps its popover
  in one, so its internal search box cannot re-claim the field. A call site with
  two controls under one label — a day picker beside a time input — wraps the
  secondary one, which then carries its own `aria-label`.

An `aria-label` on the control **outranks** the `Field`'s `<label>`, so a
control that names itself for standalone use drops that name inside a `Field`
rather than shadowing the real label. `MultiSelect` does exactly this.

In development, a `Field` whose id lands on nothing logs an error naming the
label. This wiring fails silently by nature — nothing throws, nothing looks
different — so the failure is made loud where it can still be seen.

### Validate on blur, not on keystroke

A field validates when it **loses focus**, not while the user is typing. Once
it has errored, and only then, it re-validates on change so the error clears
the moment the input becomes valid.

Validating per keystroke marks an email invalid after the first character —
the user is told they are wrong before they have had a chance to be right.

### `readOnly` is not `disabled`

Three distinct states, and conflating the last two is a real information bug:

| State | Looks like | Semantics | Means |
| --- | --- | --- | --- |
| Normal | full contrast | — | Edit it |
| `readOnly` | **full contrast**, muted surface, **keeps its focus ring** | `aria-readonly` + the native `readOnly` attribute | The value matters, you just cannot change it here |
| `disabled` | `opacity-50`, `cursor-not-allowed` | `disabled` | Not applicable, or temporarily unavailable |

`readOnly` keeps **normal text contrast** — the value is still information the
user needs to read. Dimming it to 50% says "this doesn't apply to you", which
is false.

**It also keeps its focus ring.** An earlier draft of this table said "no focus
ring on the input itself"; that was wrong and is corrected here. A `readOnly`
input is still focusable, still reachable by Tab, and still selectable for
copying — WCAG 2.4.7 requires a visible indicator on anything that can take
focus, and `readOnly` is not `disabled`, which is the state that removes the
control from the tab order. The implementation is `readOnlySurface` in
`src/design-system/lib/variants.ts`.

`Field` takes a `readOnly` prop that sets **both** the native attribute (which
is what makes `read-only:*` variants render, and what stops typing) and
`aria-readonly` (which is what a screen reader announces on a composite control
like `Select` that has no native read-only state).

This is not hypothetical: `crm-catalogues.md` documents CRM settings sections
that are deliberately read-only in this portal. Rendering those as `disabled`
tells the user to come back later for something that will never become
editable here. A `readOnly` field takes a short reason line in its `hint` slot
saying where it *is* editable.

## Badge

```ts
tone: "brand" | "positive" | "caution" | "negative" | "neutral"
```

Five tones — the four roles plus neutral. **There is no `info` tone and no
blue.** If you reach for one, the thing you are labelling is a category, not a
state, and it takes `neutral`.

Tinted background + matching foreground + 1px border. `text-xs`, weight 500,
`rounded-sm`.

## Dialog / AlertDialog / Sheet

- `Dialog` — general modal. `DialogContent` takes `showCloseButton`
  (default `true`).
- `AlertDialog` — destructive confirmation **only**. No dismiss-by-backdrop, no
  `Esc`-to-confirm. Used for terminal stage moves and deletes.
- `Sheet` — side panel over Radix `Dialog`. Its `side` prop is **logical**
  (`"start" | "end"`) and resolves direction internally, so consumers never
  branch on `dir`.

Scrim is `bg-ink-950/50` plus the **one** permitted `backdrop-blur-sm`.

Max width: `sm` 384 · `md` 448 · `lg` 512 · `xl` 576 · `2xl` 672. Beyond that
use a `Sheet` or a route — a 900px dialog is a page.

## Select

Radix `Select`, not a native `<select>`, so the option list can be styled and
keyboard-navigated consistently across browsers.

Must receive `dir` — without it, arrow keys navigate LTR while the list renders
RTL. See [theming.md](theming.md#third-party-physical-apis).

**`SelectTrigger` is the control, `Select` is not.** The exported `Select` is
Radix's `Root`: a context component that renders no DOM node at all, so an `id`
or an `aria-*` attribute handed to it reaches nothing. `SelectTrigger` is the
only focusable element a select has, and it is what claims an enclosing `Field`
— see [Field](#the-control-claims-the-field-the-field-does-not-push-at-the-control).

For >20 options with search, that is a `Combobox` — **which does not exist
yet**. Build it when first genuinely needed (`CountrySelect`'s 250 countries is
the likely trigger) and add it to this table. Do not fake it with a `Select`
plus a filter input.

## Table

Bare semantic wrappers — `Table`, `TableHeader`, `TableBody`, `TableRow`,
`TableHead`, `TableCell` — with design-system classNames. No Radix; native
table semantics are already correct.

**Feature code does not use these directly.** A screen's table is `DataTable`.
These exist for `DataTable` to build on and for the rare genuinely-static
table.

## Skeleton

`bg-muted` with the shimmer sweep from [motion.md](motion.md#shimmer). The
sweep must mirror under RTL.

Skeletons match the **shape** of what is loading — a table skeleton is rows of
the right height and column widths, not a grey rectangle. `DataTableSkeleton`
handles this for tables.

## Built in Phase 1

The "not built" list this section used to carry is empty. Everything on it —
`Combobox`, `DatePicker`, `DateRangePicker`, `FileUpload` — now exists, along
with the rest of Phase 1's primitives.

| Primitive | Built on | Notes |
| --- | --- | --- |
| `Calendar` | `react-day-picker` | No vendored stylesheet — see [DECISIONS D15](../build/DECISIONS.md#d15--third-party-components-take-no-stylesheet--assumed) |
| `DatePicker` · `DateRangePicker` | `Calendar` | `Intl` with an explicit locale; Arabic uses Western digits |
| `Combobox` | `Popover` + `Input` | Type-ahead over a large remote list, debounced |
| `MultiSelect` | `Popover` + `Badge` | Chips in the trigger; overflow is a **button**, never a static count |
| `Stepper` | plain `<ol>` | A step's position never takes a hue |
| `Progress` | `@radix-ui/react-progress` | Determinate and indeterminate — see below |
| `Accordion` · `Collapsible` | Radix | The one permitted height keyframe — [motion.md](motion.md#the-one-height-exception) |
| `ToggleGroup` · `Slider` · `HoverCard` · `ContextMenu` | Radix | |
| `CopyButton` | `Button` | `aria-live` confirmation for UUIDs and correlation ids |
| `Money` · `DateTime` | plain + `Intl` | Correctness primitives — a decimal string is never `Number()`d |
| **`FileUpload`** | plain `<label>` + `<input type=file>` | See below |
| **`CommandPalette`** | `cmdk` + `Dialog` | See below |
| **`RichTextEditor`** | `contenteditable` | See below |

### FileUpload

Drag-and-drop plus click, with the MIME allowlist and the size cap enforced
**before** anything reaches the caller. Rejections come back as
already-translated strings rather than being rendered here, so a screen can
choose between an inline list and its own surface.

Backend caps it is built for: branding 2 MB · party image 2 MB · template asset
5 MiB · CRM attachment 26 MiB.

**There is no progress bar, and there is no fake one.** `fetch` cannot report
upload progress — only `XMLHttpRequest` can — and `AGENTS.md` says `fetch` is
called in exactly one file. A file in flight renders the **indeterminate**
`Progress` bar, which announces as indeterminate because Radix omits
`aria-valuenow` for a null value. An optional `progress` prop exists for the day
a transport reports real bytes; driving it from a timer is the fabricated-success
failure in [anti-patterns.md § 13](anti-patterns.md#13-fake-data-and-fake-success).
Full reasoning: [DECISIONS D14](../build/DECISIONS.md#d14--fileupload-has-no-progress-bar--assumed).

The drop zone is a `<label>`, not a `<button>`: it has to open the native
picker on click **and** stay a valid drop target, and a button wrapping a file
input is neither.

### CommandPalette

Ctrl/Cmd+K over a list of groups the caller supplies. It is generic and reads no
dictionary; `NavCommandPalette` in the shell is what feeds it the
**permission-filtered** nav tree, so a route the user cannot reach is not
offered.

The shortcut listens on `event.code === "KeyK"`, not `event.key`. An Arabic
keyboard layout produces `ن` for that physical key, and a `key` check silently
stops working for half the users.

Styling takes no stylesheet: six of `cmdk`'s seven parts take a `className`, and
the group heading — which does not — is reached by a Tailwind arbitrary variant
on the group's own class list. See
[DECISIONS D15](../build/DECISIONS.md#d15--third-party-components-take-no-stylesheet--assumed).

### RichTextEditor

For `loginHtml` and email templates. `contenteditable` plus
`document.execCommand`: formally deprecated, universally implemented, and
without a replacement — the alternative is a 200KB editor framework for two
fields.

**Everything that leaves it is sanitized** by `sanitizeRichText`, an allowlist,
on every change and on every paste. `loginHtml` renders on the **login page**,
before a session exists, so the output is treated as hostile by construction.
The allowlist drops every attribute except a safe `href`, drops `<script>` and
`<style>` contents entirely, refuses `javascript:` and `data:` hrefs while
keeping the words, and unwraps the `<div>`/`<font>` soup `execCommand` emits.

This is defence in depth, not the boundary: the backend sanitizes what it
stores, and the renderer still treats stored HTML as untrusted.

## Icons

`iconSize` ties an icon to the control it sits in, and `mirrorInRtl` is the one
RTL mirror mechanism in the system. Full rules, the enforcement table and the
canonical icon-per-concept map: [icons.md](icons.md).

## Checklist for every primitive

- [ ] Composes `focusRing`
- [ ] Sized primitives compose `controlSize`
- [ ] Colors come from semantic tokens, never raw palette
- [ ] Correct in light and dark
- [ ] Correct in RTL and LTR
- [ ] Keyboard operable; visible focus
- [ ] `disabled` and `aria-disabled` handled
- [ ] Forwards `ref` and spreads `...props`
- [ ] `className` merged through `cn()`, never concatenated
- [ ] Exported from `src/design-system/index.ts`
- [ ] No `useToast` import — primitives never raise toasts
