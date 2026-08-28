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
| `Input` | plain `<input>` | `controlSize`, `focusRing`, `aria-invalid` |
| `Textarea` | plain `<textarea>` | Min 3 rows, resize-y only |
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

## Not built

`Combobox` (searchable select), `DatePicker`, `FileUpload`. Each is built when
a screen genuinely needs it, specified here at that point. Do not hand-roll one
inside a feature directory — that is how the current app ended up with 46
hand-rolled buttons.

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
