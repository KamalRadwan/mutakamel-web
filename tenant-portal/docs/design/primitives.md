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
| `Badge` | plain CVA | `tone`: `brand`/`positive`/`caution`/`negative`/`neutral`; `size`: `default`/`sm` |
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
| `Avatar` | `@radix-ui/react-avatar` | Initials fallback; `tone`: `default`/`user` |
| `ScrollArea` | `@radix-ui/react-scroll-area` | Board columns, long menus |
| `Table` | plain | Semantic wrappers. Feature code uses `DataTable` instead |

## Button

Updated **2026-10-26** ([crm-leads-v3.md](specs/crm-leads-v3.md)).

```ts
variant: "primary" | "secondary" | "outline" | "ghost" | "destructive" | "link"
size:    "xs" | "sm" | "md" | "lg" | "xl" | "toolbar" // default sm (28px); toolbar is 33px (--size-toolbar-control)
loading?: boolean
asChild?: boolean
```

| Variant | Light | Dark |
| --- | --- | --- |
| `primary` | `bg-gradient-primary` + `text-white`, hover `brightness-90` + `shadow-pop` | same tokens (`--gradient-primary` + `text-white`) |
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
- `size="toolbar"` maps to `h-(--size-toolbar-control)` (33px), `px-3.5`,
  `gap-1.5`, `rounded-lg` (8px), `text-label`, and `font-bold` for action-bar
  controls whose height falls outside the 24/28/32/36/40px `controlSize` scale.

## Field

Constraint-critical. It is the only correct way to render a labelled input.

```tsx
<Field label={t.fields.email} hint={t.auth.emailHint} error={errors.email} required>
  <Input type="email" />
</Field>
```

It generates a stable `useId()` `htmlFor`, wires `aria-describedby` to hint and
error text, sets `aria-invalid`, and marks required state.

**The label is hidden, and the control carries its text as the prompt.** The
`<label for>` is still rendered — `sr-only`, pointing at the control — because
a placeholder is not an accessible name: screen readers announce it
inconsistently, and it is gone the moment there is a value. So the NAME stays
in the label and only the LOOK moves into the placeholder, and neither pretends
to be the other. The required marker rides on the prompt, where it can be seen;
a hidden asterisk marks nothing.

`Input` and `Textarea` fall back to `field.label` for their placeholder;
`SelectValue` reads the field itself, because a Radix select's placeholder is a
prop on the value rather than on the trigger that claims the field. A caller's
own placeholder always wins — which is how `Default stage`, `No source` and
`New company` keep saying what the EMPTY value means instead of repeating the
box's name.

**The trade-off, stated plainly:** the prompt disappears as soon as the field
has a value, so a filled form no longer says what each box is. That is inherent
to the pattern, not an oversight of this implementation.

**A field error stays inline and never becomes a toast.** It must remain a
persistent, programmatically-associated target for the input. See
[patterns.md](patterns.md#where-a-result-belongs).

### Field hint placement

```tsx
<Field label={t.trade.uomCode} hint={t.trade.uomCodeHint} hintPlacement="tooltip" showLabel>
  <Input />
</Field>
```

`hintPlacement` defaults to `"below"` — the hint renders as a paragraph under
the control, exactly as above. `"tooltip"` moves it into an `Info`-icon
`Tooltip` trigger beside the label instead, for a dense, multi-field modal
where a paragraph per field would cost more vertical space than the form can
spare — see the UOM create modal, `UomFormFields.tsx`.

Either way, `aria-describedby` still wires the input to the hint text: the
paragraph never leaves the DOM, `"tooltip"` only adds `sr-only` to it. A screen
reader announces the hint on focusing the control regardless of which mode is
active; the icon is for sighted pointer/keyboard users, with its own
`aria-label` carrying the same text, per **Icon-only buttons** above.

Because the trigger is a real `Tooltip`, an ancestor `TooltipProvider` is
required — the app provides one at the root (`app/layout.tsx`), but a test
that renders a `hintPlacement="tooltip"` field in isolation must wrap it in
one too (see `Field.test.tsx`).

Reach for `"tooltip"` only when the field also sets `showLabel` — a tooltip
trigger beside an `sr-only` label has nothing visible to sit next to.

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

Updated **2026-10-26** ([crm-leads-v3.md](specs/crm-leads-v3.md)).

```ts
tone: "brand" | "positive" | "caution" | "negative" | "neutral"
size?: "default" | "sm" // default "default"
```

Five tones — the four outcome roles plus neutral (`*-subtle` semantic pairs).
**There is no `info` tone and no purple or indigo tone.** If you reach for one,
the thing you are labelling is a category, not a state, and it takes `neutral`.

- `size="default"` (default): `rounded-sm px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide` (`rtl:normal-case rtl:tracking-normal`), preserving every existing caller.
- `size="sm"`: `h-6` (24px), `rounded-md` (6px), `px-2`, `text-badge` (11px), `font-semibold`, never uppercase.

## Avatar

Updated **2026-10-26** ([crm-leads-v3.md](specs/crm-leads-v3.md)).

```ts
tone?: "default" | "user" // default "default"
```

- `tone="default"` (default): neutral `bg-secondary text-secondary-foreground font-medium` initials fallback with no outer ring.
- `tone="user"`: renders the initials fallback with `bg-gradient-avatar text-white font-bold` (cyan-to-teal chrome gradient, never purple) and adds `ring-[1.5px] ring-card` on `Avatar` (`white` in light mode, `--card` in dark mode) so user avatars separate cleanly from nav chrome, toolbar chips, and board cards.

## Dialog / AlertDialog / Sheet

- `Dialog` — general modal. `DialogContent` takes `showCloseButton`
  (default `true`). When a custom sticky header band owns the close affordance
  (as in `FormModal`, `ReasonDialog`, and `ActivityModal`), pass
  `showCloseButton={false}` on `DialogContent` and render `<DialogCloseButton label={...} disabled={...} />`
  inside the header flex row — a `32×32px` bordered icon button (`rounded-md border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground`).
- `AlertDialog` — destructive confirmation **only**. No dismiss-by-backdrop, no
  `Esc`-to-confirm. Used for terminal stage moves and deletes.
- `Sheet` — side panel over Radix `Dialog`. Its `side` prop is **logical**
  (`"start" | "end"`) and resolves direction internally, so consumers never
  branch on `dir`.

Scrim is `bg-ink-950/50` plus the **one** permitted `backdrop-blur-sm`.

Max width: `sm` 384 · `md` 448 · `lg` 512 · `xl` 576 · `2xl` 672 · `wide` 960.
`wide` (`max-w-[60rem]`) exists specifically for split-workbench modals such as
`ActivityModal` when an inline agenda column (`asideSlot`, `320px`) sits beside
the form column (`640px`).

`size="full"` is the seventh step and the only one that is not a centred card: it
is `inset-5`, the viewport less 20px on every side. It brings **no padding of
its own** and lays its children out in a column, because a surface that size
wants a header and a footer that reach its own edges. Reach for it only when
the record genuinely fills it — see
[patterns.md § FormModal](patterns.md#formmodal) for the bar. Everything else
about it is unchanged: same scrim, same close button, same dismissal keys.

The centred card steps carry `grid`, `gap-4` and `p-6` by default, and that
layout is a default rather than a guarantee: a consumer whose own header, body
and footer bands already own their padding overrides all three through
`className`, and tailwind-merge resolves them because `grid`/`flex`, the gap
and the padding are each a last-wins group. `FormModal` (`size="card"` or
`size="wide"`) turns the card into the same flex column `full` is, with an
optional `asideSlot` split workbench at `wide`.

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
| `DatePicker` · `DateRangePicker` | `Calendar` | `Intl` with an explicit locale; Arabic uses Western digits. Range presets — see below |
| `Combobox` | `Popover` + `Input` | Type-ahead over a large remote list, debounced — see below |
| `MultiSelect` | `Popover` + `Badge` | Chips in the trigger; overflow is a **button**, never a static count. An option carrying `tagColor` renders as a `TagChip` in the trigger and the list |
| **`TagChip`** · `TagChipOverflow` | plain `<span>` | See below |
| `Stepper` | plain `<ol>` | A step's position never takes a hue |
| `Progress` | `@radix-ui/react-progress` | Determinate and indeterminate — see below |
| `Accordion` · `Collapsible` | Radix | The one permitted height keyframe — [motion.md](motion.md#the-one-height-exception) |
| `ToggleGroup` · `Slider` · `HoverCard` · `ContextMenu` | Radix | |
| `CopyButton` | `Button` | `aria-live` confirmation for UUIDs and correlation ids |
| `Money` · `DateTime` | plain + `Intl` | Correctness primitives — a decimal string is never `Number()`d |
| **`FileUpload`** | plain `<label>` + `<input type=file>` | See below |
| **`ImageUploadTile`** | `Button` + `<input type=file>` | See below |
| **`CommandPalette`** | `cmdk` + `Dialog` | See below |

### DateRangePicker presets

Updated **2026-09-24**: the picker can look forward as well as back.

```ts
presets?: readonly DateRangePresetId[]   // which shortcuts, in this order
presetLabels: DateRangePresetLabels      // Partial<Record<DateRangePresetId, string>>
weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6 // "This week", and the grid's first column
```

| Preset | Range (inclusive, snapped to day boundaries) |
| --- | --- |
| `today` | today |
| `thisWeek` | the week holding today, from `weekStartsOn` (default Sunday) |
| `next7Days` · `next30Days` | today and the 6 · 29 days after it |
| `last7Days` · `last30Days` · `last90Days` | today and the 6 · 29 · 89 days before it |
| `thisMonth` · `thisQuarter` | the calendar month · quarter holding today |

- **Omit `presets` and nothing changes**: the picker offers
  `DATE_RANGE_PRESET_IDS`, the six backward ranges every filter screen was
  built with, in the order it always did.
- **A preset the caller has not labelled is not offered.** The labels are a
  partial map because a screen names only the presets it offers; a shortcut
  missing from the list costs less than a button with no name.
- **`weekStartsOn` sets the grid too**, so "This week" and the calendar under it
  cannot disagree. Omitted, "This week" starts on Sunday and the grid follows
  the locale. A screen with a calendar passes `calendarWeekStart(language)` —
  CLDR's week, which for Arabic is Saturday
  ([views.md](views.md#calendar-view)).
- `resolveDateRangePreset(id, now, weekStartsOn = 0)` stays the pure resolver,
  given its "now" so it is deterministic in tests.
- FilterBar's `dateRange` filter takes the same optional `presets` and
  `weekStartsOn` and hands them through. The Activities workspace offers
  `today, thisWeek, next7Days, next30Days, thisMonth, last7Days, last30Days`.

### TagChip

```ts
label: string
backgroundColor?: string | null   // "#RRGGBB"
textColor?: string | null         // "#RRGGBB" — used only as a pair
size?: "sm" | "xs"                // card face · dense table cell
children?: ReactNode              // trailing content, e.g. a remove control
```

One tag, in any app. A valid pair paints the chip's own background, text and
a border mixed from the two; a missing, half-set or malformed pair is the
neutral chip. The label is `<bdi dir="auto">` and truncates, with the full name
in `title`. `TagChipOverflow` is the `+N` chip beside it: the visible count is
`aria-hidden` and the hidden names are announced instead. Never `Badge` —
a badge states a record's state. Colour rules:
[tokens.md](tokens.md#tag-colours--a-pair-the-tenant-owns).

### Combobox

Type-ahead over a **remote** list: the options are whatever the server last
returned for the query, so filtering never happens in the browser and the
control has real loading and empty states instead of an empty dropdown. It is
not a `Select` with a filter box bolted on.

**Two callers narrow the list themselves, and neither contradicts that rule.**
The contract the primitive states is that `options` are the answer to the
current query — whether a server or an array answered it is the caller's
business. What the rule forbids is handing over the whole catalogue and
filtering it inside the popup. Both of these do the narrowing outside:
`onSearch` sets a query in the caller's state, the caller filters, and only the
matches arrive as `options`, with `debounceMs={0}` because there is nothing to
wait for.

| Caller | The list | Why there is no query to send |
| --- | --- | --- |
| `CrmPhoneNumberInput`'s country picker | 250 countries | The catalogue is static and offline — there is no endpoint at all |
| `LeadCompanySection`'s existing-company picker | A branch's organizations | `GET /leads/company-options` takes `branchId` and nothing else; the whole permitted list arrives once when the modal opens |

Two conditions make a caller like this legitimate, and both must hold: **there
is no endpoint that answers the query**, and **the caller still narrows before
the primitive sees the list**. A screen whose endpoint does take a search
parameter sends it instead — that is the default this section describes, not a
harder path to be avoided.

The company picker adds one wrinkle worth copying: its "Create a new company"
row is **pinned and never filtered**. A search that finds nothing is exactly
when that row is the answer, and making the user clear the box to reach it
would be backwards.

`leadingSlot` renders an optional inline badge or chip at the logical start of
the `Combobox` trigger/search shell (for example, `ActivityTargetPicker`
places the active target entity type badge — `LEAD`, `CUSTOMER_PROFILE`,
`OPPORTUNITY`, `PARTY`, `QUOTATION`, `SALES_ORDER` — directly inside the unified
search input beside the query text).

### FileUpload

Drag-and-drop plus click, with the MIME allowlist and the size cap enforced
**before** anything reaches the caller. Rejections come back as
already-translated strings rather than being rendered here, so a screen can
choose between an inline list and its own surface.

Backend caps it is built for: branding 2 MB · party image 2 MB · template asset
5 MiB · CRM attachment **25 MiB** per file (the Gateway multipart envelope has
a separate, larger whole-body ceiling).

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

`variant="button"` renders a compact, keyboard-operable picker button instead
of the visible drop zone. It opens the same native input and reuses the MIME,
size and count checks, rejection callbacks and queued upload states. The
default remains `"dropzone"`; `disabled` blocks both picker admission and queue
removal in either variant. The caller supplies the localized button label.

The MIME, size and count checks live in `design-system/lib/upload-screening.ts`
(`screenUploadFiles`), shared with `ImageUploadTile`, so the two can never
disagree about what they admit.

### ImageUploadTile

Added **2026-10-17** for the Trade Item image (backend LLD
`trade-app/.../02b_item_images.md` §19). A square tile that **is** the picker:
click, Enter or Space opens the native dialog, and an image dropped on it is
admitted the same way. One file at a time; extra dropped files are ignored, not
rejected. Checks come from the same `screenUploadFiles` as `FileUpload`, and
rejections return as translated strings through `onReject`.

The tile is a `Button`, not a `<label>`: it has its own accessible name
(`label`, e.g. "Add item image" / "Change item image") and its face is an image
or an icon, which as label content would become the input's name. The caller
renders the face as `children` (a preview, a thumbnail through `Avatar`, or the
kind icon) and any decorative badge. `busy` sets `aria-busy`; `describedBy`
points at the caller's polite status line. A ref exposes `openPicker()` for a
separate "Replace image" control. There is no upload progress for the same
reason as `FileUpload` (D14): render the indeterminate `Progress` beside it.
No crop step exists yet — the LLD's `ImageCropDialog` is not built.

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
