# Patterns

Status: **Specification**

Written: **2026-08-27**

Implementation: `src/design-system/patterns/` — 13 directories.

A pattern composes primitives into something a screen uses directly, and unlike
a primitive it usually carries real product behavior: server pagination, dirty
guards, permission projection, idempotency evidence.

**Feature code reaches for a pattern first**, and drops to a bare primitive
only when no pattern fits.

## The patterns

| Pattern | Directory | Purpose |
| --- | --- | --- |
| `DataTable` | `data-table/` | The table view; server pagination and sorting |
| `FilterBar` | `filter-bar/` | URL-backed filters above a workspace |
| `PageHeader` | `page-header/` | Title, description, the one primary action |
| `FormDrawer` | `form-drawer/` | Create/edit in a `Sheet`, with a dirty guard |
| `ConfirmActionModal` | `confirm-action/` | Destructive confirmation |
| `StatusBadge` | `status-badge/` | Enum → label + role color + pending dot |
| `EmptyState` | `empty-state/` | No results |
| `ErrorState` | `error-state/` | Load failure, with retry |
| `PermissionGate` | `permission-gate/` | 403 as a distinct in-body state |
| `DegradedBanner` | `degraded-banner/` | Partial or stale data |
| `Pagination` | `pagination/` | Page controls |
| `StatCard` | `kpi/` | A single metric tile |
| `UnavailableState` | `unavailable-state/` | The sealed-route boundary — a capability that is genuinely not built yet |
| `ConflictDialog` | `conflict-dialog/` | The 409 / 412 / 428 resolution surface |
| `AmbiguousOutcomePanel` | `ambiguous-outcome/` | A write that may or may not have applied, with its idempotency key |
| `NotFoundState` | `not-found-state/` | A deleted record reached from a stale link — **no retry** |
| `ReasonDialog` | `reason-dialog/` | A confirmation that has to collect a reason |
| `AsyncJobState` | `async-job/` | A 202 job: queued / running / succeeded / failed / artifact-expired |
| `BulkActionBar` · `BulkConfirmDialog` · `BulkResultPanel` | `bulk-actions/` | Selection count, scoped confirm, and partial success |
| `ReadOnlyGate` | `access-mode/` | FULL / READ_ONLY / DUNNING / BLOCKED as an in-body boundary |
| `DetailHeader` | `detail-header/` | The detail-screen header. **Composes `PageHeader`** |
| `DetailSection` | `detail-section/` | A labelled field group for read-mostly detail bodies |
| `Timeline` | `timeline/` | Audit history, stage history, delivery attempts, approval ladders |
| `AttachmentList` | `attachment-list/` | Stored attachments plus the upload affordance |
| `EditDrawer` | `edit-drawer/` | The **edit** counterpart to `FormDrawer`, which is create-only |
| `DeletionBlockerDialog` | `deletion-blocker/` | A 409 with reasons — the list of blocking children |
| `AtomicReplacementConfirm` | `atomic-replacement/` | The pre-write diff for a full-replacement `PUT` |
| `OfflineBanner` · `useConnectivity` | `offline-banner/` | The connection strip, mounted once in `AppShell` |
| `useRealtimeResync` | `realtime-resync/` | The one line a list adds to reconcile with the server |
| `LineChart` · `BarChart` · `AreaChart` · `DonutChart` · `Sparkline` | `chart/` | The chart wrappers and the palette law |

## DataTable

The single most important pattern. It owns the table view for all three
workspaces.

```ts
interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  rows: T[];
  isLoading: boolean;
  error?: NormalizedApiError | null;
  onRetry?: () => void;
  page: PageInfo;                    // server pagination
  onPageChange: (page: number) => void;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selection?: SelectionState;
  emptyState?: React.ReactNode;
  rowReorder?: RowReorderState<T>;    // opt-in row drag + earlier/later
}

interface ColumnDef<T> {
  id: string;
  header: string;                    // already translated
  cell: (row: T) => React.ReactNode;
  align?: "start" | "end";           // logical
  width?: string;
  sortable?: boolean;
  numeric?: boolean;                 // applies tabular-nums + align end
  sticky?: "start" | "end";
}
```

Owns, so no screen re-implements them:

- **36px** rows, `text-xs`, weight **400**
- Sticky header, `bg-card`, bottom `border-border`
- Zebra rows via `--row-zebra`
- **Server** pagination and sorting — never client-side over a page of results
- **`aria-sort` on every sortable `<th>`** — `"ascending"`, `"descending"`, or
  `"none"`, driven by `SortState`. Exactly one column carries a value other
  than `none`. Without it a screen-reader user cannot tell which column is
  sorted or which way, and the sort arrow is a purely visual signal
- Row selection with a header select-all reflecting indeterminate state
- Keyboard row navigation; the action cluster is reachable
- **`scroll-margin` on focusable row content**, sized to the sticky offsets, so
  a `Tab` into a row action never lands underneath the sticky header or the
  sticky inline-start/end columns (WCAG 2.2 AA `focus-not-obscured`). Four
  sticky layers overlap this grid; without the margin the focus ring ends up
  behind one of them with no visual indication at all
- `DataTableSkeleton` matching real column widths while loading
- Empty, error and forbidden states rendered in-body
- Horizontal overflow inside its own container — **the page never scrolls
  sideways**

### Column resize and reorder

Optional, and off unless the caller passes `columnLayout`. The caller owns the
`{ order, widths }` object, so it can be persisted per user or not at all.

**Drag is never the only path.** That is the rule the board view is being fixed
for (audit B3), and there is no reason to ship a second WCAG AA failure here:
reorder is a menu on the header, and resize is an ARIA window-splitter
(`role="separator"`, `aria-valuenow`) that responds to a drag **and** to the
arrow keys.

- Reorder is worded **earlier / later**, never left / right. The same column
  moves the opposite way on screen in Arabic.
- **Sticky columns are not reorderable** and are pinned back to their declared
  edge. A sticky action column dragged into the middle would stick over the data
  while the user scrolls.
- A stored layout survives a release that adds or removes a column: unknown ids
  are dropped, and columns the layout has never seen are appended.
- Widths clamp to 64–720px, and the resize handle's direction is computed from
  `dir` — in RTL a drag toward smaller `clientX` makes the column wider.

### Row reorder

Optional, and off unless the caller passes `rowReorder`. It is the drag handle
[DESIGN-SYSTEM.md](DESIGN-SYSTEM.md#75-catalogue-screens) gives a reorderable
catalogue — shipped on lead stages, which ranks its pipeline this way.

```ts
interface RowReorderState<T> {
  onReorder: (orderedIds: string[]) => void;   // the WHOLE order, not (from, to)
  isPinned?: (id: string) => boolean;          // rows that keep their index
  isPending?: boolean;                         // a write is in flight
  rowLabel: (row: T) => string;                // names the row in its grip
  dragHandleLabel: string;                     // names every grip and the column
}
```

- **`onReorder` reports every row key in its new order**, because that is what
  the endpoints behind it take: a catalogue's `reorder` route replaces the whole
  dense order in one write, and a per-row `PATCH` of rank races into duplicate
  ranks. It follows that the caller must pass `rows` **unfiltered** while
  reordering is on, and suppress it while a search narrows the view — the
  visible order is not the order being written.
- **Drag is currently the only pointer path, which is a known conformance gap**
  — WCAG 2.2 AA `dragging-alternative`, recorded as
  [D24](../build/DEFECTS.md#d24--row-reorder-has-no-single-pointer-alternative--open).
  The keyboard half is covered: `@hello-pangea/dnd`'s sensor (space to lift,
  arrows to move, space to drop) rides on `dragHandleProps`, so the grip must
  stay the activation surface and dragging must never be disabled to style it.
  The earlier/later buttons this column shipped with were removed on
  2026-09-04 at the product owner's instruction; restoring them, or a Move-to
  menu on the grip, is what closes D24.
- **A pinned row keeps its index**, and nothing may be dropped through one: a
  move that would displace it is refused before it is sent, so a rank the server
  would answer `422` for never leaves the browser. Lead stages pins its `NEW`
  stage, which the CRM holds at rank 1.
- **The body never windows while reordering.** A windowed body renders a slice,
  so a `Draggable` index would not be the row's index in the order being
  written; virtualized dragging is the board's problem, solved there with
  `react-window` (D9).
- **A row that cannot be dragged keeps a dimmed, inert grip**, never an empty
  cell: the column must not change width row to row, and a control that is
  simply gone reads as a rendering bug where a disabled one reads as a rule.

Rules:

- Column headers arrive translated. `DataTable` never touches the dictionary.
- Sorting is server-side. A client sort over one page is a lie about the data.
- The first column is the display name and links to the detail route.
- The action column is `sticky="end"`, `ghost` icon buttons with tooltips.
- Never render a raw `<table>` in feature code.

## FilterBar

```ts
interface FilterBarProps {
  filters: FilterDef[];                          // a discriminated union — see below
  values: FilterValues;                          // Record<string, FilterValue | undefined>
  onChange: (next: FilterValues) => void;
  onReset: () => void;
  searchValue: string;
  onSearchChange: (q: string) => void;
  maxVisibleChips?: number;                      // default 6
}
```

- **Filter state lives in the URL**, so a filtered view is shareable and
  survives refresh.
- Search debounces 300ms before touching the URL, and renders
  `text-base sm:text-sm` — it takes typed input, so the
  [mobile input rule](DESIGN-SYSTEM.md#inputs-are-16px-on-mobile) applies.
- Active filters render as removable chips; a "Clear all" appears only when at
  least one is set.
- **Chips wrap before they shrink, and never truncate.** Past `maxVisibleChips`
  the remainder collapses into a `+n` **button** that opens a popover of the
  rest, each still removable. A static `+n` count hides filter state the user is
  entitled to change; a truncated chip label (`Acquisition so…`) tells them
  nothing about what is filtering their data. Full rule in
  [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md#toolbar--28px-controls), and see
  [Chip overflow](#chip-overflow--a-count-not-a-row-count) for why the threshold
  is a count rather than the row count that wording originally specified.
- Filters that map to an enum build their options from
  [../reference/enums.md](../reference/enums.md) with `t.status.*` labels.
- Collapses behind a "Filters" button with a count badge below `lg`.

### The five filter kinds

`FilterDef` is a discriminated union, and `FilterValue` mirrors it:

| `kind` | Control | Value shape |
| --- | --- | --- |
| `select` | `Select` | `{ value: string }` |
| `multiSelect` | `MultiSelect` | `{ values: string[] }` |
| `dateRange` | `DateRangePicker` with the six presets | `{ from?: string; to?: string }` — **ISO strings** |
| `numericRange` | two `Input type=number` | `{ min?: string; max?: string }` — **decimal strings** |
| `boolean` | `Switch` | `{ value: true }` |

**Every leaf is a string.** Filter state lives in the query string, a decimal
bound must not be `Number()`d, and an ISO date has to survive a pasted link
exactly as written. `dateRange` converts to `Date` only at the picker boundary.

A `boolean` filter that is switched off **clears** rather than storing `false`:
`?archived=false` and "no archived filter" are the same query, and storing one
of them puts a chip on screen for a filter that is not filtering.

A `multiSelect` contributes **one chip per selected value**, each individually
removable. A single chip listing five stages can only be removed as a block,
which is not what the user is asking for when they click the X on one of them.

### Chip overflow — a count, not a row count

The rule this page originally stated was "past two rows". A row count cannot be
known without measuring every chip's `offsetTop` after layout, which means all
the chips paint and then visibly collapse on every filter change and every
resize. `maxVisibleChips` is a count instead — six by default, roughly two rows
at the widths this bar renders at, and deterministic. The rule that matters is
unchanged: **the overflow is a button opening a popover of still-removable
chips, never a static `+n`.** `MultiSelect` follows the same rule inside its own
trigger.

## PageHeader

```ts
interface PageHeaderProps {
  title: string;
  description?: string;
  primaryAction?: { label: string; onClick: () => void; disabled?: boolean };
  secondaryActions?: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
}
```

**The only place a `primary` button may appear.** If a screen seems to need two
primary actions, one of them is secondary.

`titleAdornment` and `leading` are slots `DetailHeader` fills; nothing else
should need them.

**The action cluster renders in the page action bar**, not under the heading.
The props are unchanged and every screen declares its actions exactly where it
always did; `PageHeader` portals the resulting DOM into the shell's second bar.
Doing it here is what moved 78 screens' actions without editing any of them,
and it keeps the one-filled-action ceiling structural — the bar has no
`primary` of its own. The `<h1>` stays on the page. See
[shell.md](../design/shell.md#it-holds-the-screens-controls).

## DetailHeader

The header every detail screen in phases 4–12 uses: back control, record name,
status badge, subtitle, action cluster.

**It composes `PageHeader` rather than reimplementing it.** That is the whole
resolution of the one-filled-primary question: there is one implementation of
the filled primary in the system and `PageHeader` owns it, in both shapes. A
detail screen renders `DetailHeader` **instead of** `PageHeader`, never both, so
the ceiling holds by construction rather than by review.

The ceiling is a ceiling, not a quota.
[detail-screens.md](detail-screens.md#customer-profile) is explicit that an
`INDIVIDUAL` customer profile simply has no primary action; do not promote Edit
to fill the slot.

### Multi-action document headers

Phases 11 and 12 build headers carrying **six to eight lifecycle actions** —
a quotation reaching Draft → Send → Revise → Accept → Reject → Convert →
Duplicate → Cancel, and the same shape for sales orders, invoices and
policies. The one-filled-primary rule alone does not tell you what to do with
the other seven, and "make them all `outline`" produces a row of eight equally
loud controls that is worse than the thing the rule was protecting against.

**The rule: a lifecycle header shows the ONE action that advances the document,
and nothing else at that weight.**

| Tier | What goes in it | Variant | Where |
| --- | --- | --- | --- |
| **Advance** | The single next step in the document's lifecycle, for its *current* status | `primary` (filled) | `PageHeader`'s `primaryAction` |
| **Alternate** | Other actions legal right now — Revise, Duplicate, Download PDF | `outline` | `secondaryActions`, at most **three** |
| **Everything else** | Legal but rare, and every destructive action | `DropdownMenu` overflow, `ghost` trigger | End of `secondaryActions` |

Four consequences, each of which resolves a real ambiguity:

1. **The advance action is computed from status, not listed.** A quotation in
   `DRAFT` advances by Send; the same screen in `SENT` advances by Accept. One
   filled button whose label changes — never Send and Accept side by side, one
   of them disabled.
2. **A status with no next step has no filled action.** A cancelled document
   gets `primaryAction: undefined`. The slot is a ceiling, not a quota, and
   promoting Duplicate to fill it makes the header lie about what the document
   needs.
3. **Destructive lifecycle actions never sit in the header row.** Cancel, Void
   and Reject go in the overflow and confirm through `AlertDialog`, where the
   filled `destructive` button lives. That is the *only* other filled button
   on the screen, and it is inside a modal, so the two never render together.
4. **An action the user cannot perform is absent, not disabled.** Admission
   comes from `capabilities`, not permission strings. A disabled control the
   user can never enable is an information leak about the workflow and a dead
   tab stop.

If more than three actions qualify as Alternate, the header is being asked to
do a job that belongs to the document body — put the rest in the section they
act on.

This is stated once here rather than in each of 11.5, 11.14, 12.13 and 12.14,
which is where it bites. Recorded by MASTER-PLAN task 3.38.

## DetailSection

A labelled field group — a definition list, not a table. These are attributes of
one record, and a `<table>` would announce row and column positions that carry
no meaning.

A field whose value is missing still renders its label, with `emptyValueLabel`.
Hiding the row leaves the reader unable to tell "not recorded" from "this record
has no such field".

## Timeline

Audit history, stage history, delivery attempts, approval ladders. One rail, one
marker per event.

**An event *type* never takes a hue** — a "note added" and a "stage changed" are
categories, and colouring them is the hue-coded-control anti-pattern arriving one
row at a time. `tone` encodes an **outcome**: a delivery attempt that *failed* is
`negative`; "email sent" takes no tone at all. In-progress is `ink` plus the
pending dot, exactly as `StatusBadge` does it. `Stepper` carries the same rule
for step position.

It never sorts. "Newest first" and "oldest first" are both correct depending on
whether the reader is auditing or following a process, so the caller decides.

## AttachmentList

Stored attachments plus the upload affordance, built on `FileUpload`.

Delete is a **plain control here, not a confirmation**. The confirmation is the
caller's: an attachment on a record with dependents is a
`DeletionBlockerDialog`, an ordinary one is a `ConfirmActionModal`, and this
pattern cannot know which. It reports the intent and stops.

## EditDrawer

Every `FormDrawer` in the app is create-only; roughly twenty screens in phases
4–12 open a drawer on an **existing** record. It composes `FormDrawer`, so the
dirty guard, the escape/backdrop handling and the one filled submit are the same
code rather than a second copy, and adds the four things an edit needs:

- a **load** state, distinct from a submit state;
- a **load failure** with a retry, which is not a submit failure;
- a **deleted-record** state that offers **no** retry, for the same reason
  `NotFoundState` does not;
- a **revert** to the last server values, enabled only once something changed.

A drawer whose record never loaded does not fire the dirty guard on close —
there is nothing to discard, and a confirmation about changes that do not exist
is a dead end.

The 409 / 412 / 428 surface is passed in as a `conflict` node rather than owned:
only the caller knows what "their changes" were, and this drawer must not guess
a diff it cannot see.

## DeletionBlockerDialog

The 409-with-reasons surface: a company that still has branches, a branch that
still has departments, a team that still has placed users.

`ConfirmActionModal` cannot host it — one description string, no slot for a list
— so today those 409s render as a bare "failed" and the user is left to guess.

**There is no confirm button and no "delete anyway".** The backend has already
refused; offering an action guaranteed to fail is worse than offering none.

## AtomicReplacementConfirm

The pre-write diff for a full-replacement `PUT` — team memberships (4.15) and
scope-role assignments (4.21), the most destructive writes in Core.

Those endpoints replace the entire collection atomically, so the request body
describes only the destination: **what is being taken away is invisible in the
payload.** A user who edits a list of eight and saves has no way to see that
three assignments just disappeared, and it looks exactly like an ordinary save.

Removals and additions are always expanded; unchanged rows collapse. When
anything is removed the confirm takes the `destructive` variant and is gated on
an acknowledgement, which resets on close — consent is per attempt, so a second,
different removal cannot inherit the first one's.

`computeReplacementDiff` matches on **id**, never on label: two records may share
a display name, and a removed item's label has to come from the server's copy
because it is by definition absent from the new one.

## OfflineBanner and useConnectivity

`TenantRealtimeProvider` has been dispatching `server-draining`,
`permanent-stop` and `resync-required` to `window` since it was built, **with
zero subscribers**. A tenant whose realtime server drains sees a portal that
looks fine and silently stops updating.

`useConnectivity()` is that subscriber. Three states, three different truths,
and collapsing them into one "you are offline" would be wrong in two of the
three:

| Status | Means | Recovers by |
| --- | --- | --- |
| `offline` | the browser lost the network | itself |
| `draining` | the realtime server is shutting down; a reconnect is coming | itself |
| `stopped` | the realtime client gave up permanently | **a reload, and only a reload** |

`stopped` outranks everything, including `offline`: coming back online does not
restart a client that has given up, and saying "online" again would be a lie
about whether live updates are flowing. Only `stopped` gets an action.

`stopped` also names **why** (13.5). The five
`RealtimeApplicationStopReason` values are not interchangeable — a connection
replaced by another tab, access withdrawn, a workspace taken offline and a
session that could not be renewed each imply a different next move — so each
has its own sentence in both dictionaries, keyed by the wire value and typed
against the package's own union, so a reason added upstream fails the build
until both dictionaries carry a sentence for it. An unrecognised value falls
back to the generic line: a wire value is never shown.

The banner is `caution`, not `negative` — none of the three means a request
failed — and takes `role="status"`, not `alert`.

## useRealtimeResync

`resync-required` is **not** a banner: a strip that flickers on every reconnect
is noise. It is a signal a *screen* acts on, and this hook is the one mechanism
for acting on it. One line, in the hook that owns the fetch:

```ts
useRealtimeResync(reload);
```

**Why every list needs it.** The realtime protocol carries no entity change
events at all — notifications and presence are the only live streams. A lead,
an opportunity or an invoice changes with nothing sent to say so, which makes
these three signals the entire staleness vocabulary the app has:

| Signal | Fires when | Why a list must care |
| --- | --- | --- |
| `realtime.sync.required.v1`, scope `ALL` | the server declares client state suspect | the data underneath the screen moved |
| a **second or later** `session.ready.v1` | the socket dropped and came back | the gap is unobservable — nothing says what changed |
| the browser's `online` | the network returned | same gap, different cause |

`NOTIFICATIONS` and `PRESENCE` scopes are deliberately ignored: the
notification runtime reconciles its own cursor cache, and making every open list
refetch because a notification cursor went ambiguous would be a self-inflicted
request storm. That is exactly what the old scope-blind `resyncCount` on
`useConnectivity` would have done, which is why it was removed rather than kept
alongside this.

Three details that are behaviour, not implementation:

- **It never fires on mount.** The connection a page loads with is not a
  reconnect; counting it would double every list's first fetch.
- **It holds a signal raised while the tab is hidden** and runs it once on
  return. Whatever went stale is still stale, and a portal open in eight tabs
  should not multiply every reconnect by eight.
- **It reads the callback fresh on every call**, so a `reload` whose identity
  changes with the filters neither resubscribes nor fires a stale closure. A
  rejected async `reload` is swallowed — there is no caller to catch it, and
  the screen renders its own load failure anyway.

One implementation detail is load-bearing and must not be "tidied up": the four
window listeners are attached on the first subscriber and **never detached**.
The count of established connections belongs to the *page*, not to a screen.
Tearing it down with the last subscriber resets that count on every navigation,
so the first reconnect after any navigation is counted as a first connection and
silently swallowed — the exact failure this hook exists to prevent. The first
draft did precisely that, and it survived until a test asserted across an
unmount.

## Charts

Five wrappers over `recharts`: `LineChart`, `BarChart`, `AreaChart`,
`DonutChart`, `Sparkline`.

**There is no generic categorical palette, and one must not be invented.**
[tokens.md § Charts](tokens.md#charts) is the law; `chart-palette.ts` is its
implementation. There are exactly two ways to colour a series:

1. **A status breakdown** — `byStatus`, win/loss, stage outcome — uses the four
   roles through `STATUS_FILL`.
2. **A qualitative breakdown** — `bySource`, `byOwner`, `byCountry` — uses
   **top-N plus "Other" on the single-hue `brand-200 … brand-800` ramp**, through
   `topNWithOther`. The largest slice is the darkest: **order carries the
   meaning, not hue.** Six categories plus "Other" is the ceiling, because that
   is how many steps the ramp has. Past it the answer is a table.

`caution` and `negative` are never adjacent fills. Two mechanisms enforce it,
because one is not enough: `STATUS_DRAW_ORDER` puts `brand` between them, which
covers every breakdown with three or more roles; and every segment carries a
background-coloured stroke, which covers the two-role `{caution, negative}` case
where reordering has nowhere to put a separator.

Other rules the wrappers own so no dashboard re-decides them:

- **Mount animation is off** — `isAnimationActive={false}` on every series, from
  one constant. See [motion.md](motion.md#charts-do-not-animate-in).
- **Colours are `var()` references**, never resolved values, so a chart repaints
  with the theme flip and with a tenant's runtime brand override (6.17).
- **RTL is mirrored**: the x axis reverses, the value axis moves to the reading
  end, the legend aligns to it, and the donut sweeps the other way. All computed
  from `dir` — recharts takes physical props, the same third-party situation
  [theming.md](theming.md#third-party-physical-apis) describes for Radix.
- **Numbers go through `Intl` with an explicit locale**, never the runtime
  default.
- **`summary` is required, not optional.** An SVG chart is unreadable to a
  screen reader whatever ARIA is bolted onto it, so every chart states its
  numbers in words in a `<figcaption>`. A `Sparkline` carries the trend in its
  accessible name for the same reason.

## FormDrawer

Create and edit forms in a `Sheet` by default — a form long enough to need a
scrollbar in a centred dialog belongs in a drawer. The exception is a record
that outgrows one column entirely; that one takes
[`FormModal`](#formmodal) instead.

- **It is a real `<form>`.** Body and footer sit inside one, the submit button
  is `type="submit"` and cancel is `type="button"`, so Enter from any text field
  saves the record. It was a `SheetContent` wrapping a `<div>` with the save on
  an `onClick` — 75 create drawers and 6 edit drawers with no form semantics and
  no keyboard submit at all.
- **`noValidate` is deliberate.** Native constraint validation preempts the
  submit event, so `onSubmit` — which is what reveals this app's own field
  errors and runs the focus rule below — would never fire. The user would get a
  transient browser bubble in the **browser's** language rather than a
  persistent inline error in the app's. Errors here are ours.
- **Dirty guard**: closing with unsaved changes opens a confirm. Applies to
  backdrop click, `Esc`, and the close button alike.
- Submit disabled while pending; button shows `loading`. An implicit submit from
  Enter is refused on the same conditions, since Enter does not go through the
  button's `disabled` state.
- Field errors from a 422 map back onto their `Field`s by field path — never a
  toast. See below.
- Success closes the drawer and raises a toast.
- Errors that are not field-level render in-body at the top of the drawer.
- Fields **validate on blur**, then re-validate on change only once they have
  already errored — see [primitives.md](primitives.md#validate-on-blur-not-on-keystroke).

### Focus after a failed submit

**On a 422, move focus to the first invalid field.** Not the drawer, not the
submit button, not nowhere.

WCAG 2.2 allows two paths here: a focusable error summary at the top of the
form, or focus on the first invalid field. **We take the second** — it keeps
the toaster-only rule intact (no in-body error card) while still giving
keyboard and screen-reader users somewhere to land.

Leaving focus on the submit button after a rejected save is the failure mode
worth naming: a sighted user sees a toast, but a screen-reader user hears a
message about errors and is then sitting on a button, with no route to the
field that is actually wrong.

The field's own `aria-describedby` error text is what gets announced on
arrival, which is why [`Field`](primitives.md#field) wiring is
constraint-critical rather than cosmetic.


## FormModal

The same contract as `FormDrawer`, on a centred `DialogContent`. Both take their
behaviour from `useFormShell`, so the real `<form>`, the `noValidate` decision,
the dirty guard on all four dismissal routes and the focus-the-first-invalid-field
rule are one implementation, not two that drift.

`size` picks the surface, and the two answer different questions. `full` — the
default — is `DialogContent size="full"`, the viewport less 20px on every side.
`card` is `DialogContent size="2xl"`: a centred 672px card, capped at `85dvh`,
with that size's own `grid`, `gap-4` and `p-6` overridden away so the header,
body and footer bands own their padding exactly as they do at `full`. Nothing
else forks — one dirty guard, one error summary, one focus rule, one shell.

**The bar for `full`**, and both halves are required:

1. the record has more fields than fit one readable column — `CreateLeadDto` is
   two dozen keys plus a contacts array, an address block and the tenant's own
   custom fields; and
2. those fields group into sections a reader would navigate between.

A form that only fails to fit is a longer drawer, not a modal.

**`card` is not that bar relaxed.** It exists because every CRM *create* is a
centred card rather than a side drawer, and a create that is genuinely short —
a handful of fields, no sections — can never clear the bar above and has no
business being stretched to the viewport to try. Four fields on the whole
screen is absurd; four fields in a drawer breaks the create rule; `card` is the
third answer. Its fields go in as direct children, with no `FormSection` around
them, and it passes no `sections`. `FormModalLabels` still requires the two
index strings — pass the shared `t.crmShared.formSectionsNav` and
`t.crmShared.formSectionInvalid`, so the wording cannot drift from the
full-size modals if the form later grows into one. An *edit* surface is outside
this entirely: the rule is about create, and `EditDrawer` stays a drawer.

What the extra width buys `full`, beyond room:

- **A section index.** Rendered at `size="full"` only — a card has no room for
  one, and a form short enough for a card has no sections to index. `sections`
  renders a `<nav>` on the inline start from
  `lg:` up, and it is the only thing that can say a problem exists in a section
  scrolled out of view — the failure mode a form this tall introduces. An entry
  marked `invalid` carries a visible marker AND the `sectionInvalid` label for a
  screen reader, never colour alone. Activating one scrolls its `FormSection`
  into view and moves focus to that section's heading, because a scroll moves
  the eye and leaves the keyboard behind.
- **`FormSection`.** A titled block with a responsive field grid — one column
  below `md`, then two or three. Each column is **capped at 24rem** rather than
  taking an equal fraction of the row: a full-viewport modal leaves ~1600px of
  body, and three equal fractions of that made a postal-code box 500px wide, so
  every field looked the same size as every other and the form read as a wall.
  A bounded column lets a row end where its fields end. A prose field spans the
  row at the call site (`className="md:col-span-2"`); only the call site knows
  which those are.
- **Sticky header and footer.** The error summary lives in the footer band,
  next to the action that produced it, and stays visible while the body scrolls.

**Submit is not disabled while the form is invalid.** A disabled submit gives a
keyboard user no way to ask what is wrong; the press is what reveals every
error, including on fields never focused, and the focus rule then lands them on
the first one.

### Who uses it

Four create surfaces, and each of them cleared the bar by carrying fields the
drawer could not show:

| Screen | Sections | What the drawer was missing |
|---|---|---|
| Lead | 7 | contacts, phone lists, address, custom fields — 5 of 24 DTO keys were sent |
| Customer profile | 6 | contacts, company phone list, custom fields |
| Opportunity | 4 | `importance`, `probabilityPercent`, `description` (modelled, never rendered) and custom fields |
| Pipeline | 2 | the ordered `stageIds` — every pipeline was born with the canonical six |

Their shared machinery lives in `src/app/(tenant)/crm/shared/`:
`useCrmCreateForm` (the touched-set and reveal rule), `crm-form-validation.ts`
(`CrmErrorBag` and the section-index helpers), `useCrmCreateCustomFields`,
`CrmPhoneListField` and the `CrmPhoneNumberInput` it renders per row (a phone
as a country code and a national number, stored as the single string the DTO
takes), `CrmCountrySelect` (the same catalogue as a flag-and-name picker,
storing the country NAME because that is all the DTO's `country` is, and
keeping a value it does not recognise rather than blanking it),
`CrmCustomFieldsFormSection`, `AcquisitionSourceOption` — a source picker's
row, the tenant's uploaded icon then the name, rendered from one implementation
by all four pickers and the catalogue screen — and `CrmContactLine`, which puts
a whole contact on one line: honorific, name, job title, number, email. A fifth
create form should reach for those before writing a field of its own.

Two of those read from `src/lib/catalogues/contact-titles.ts` and
`src/lib/geo/country-data.ts`, which hold **values rather than copy** and so sit
outside the dictionaries deliberately. What a picker there stores is the LABEL
in the language the person chose, never a key: `honorificTitle`, `jobTitle` and
`country` are free text on the wire with nothing but a length cap, and every
screen that shows a record prints the string back exactly as it was saved — a
key would read as `SALES_MANAGER` on all of them. Each catalogue reads a stored
value back in either language, so a row written in Arabic is still recognised,
and shown in the reader's own language, while the stored string is left alone
until somebody picks a new one. A value the catalogue does not recognise is
kept and shown as it stands, because records written before the picker existed
have to survive being opened in it.

One surface uses `card` instead: **add contact** on a customer profile
(`CustomerProfileActionDialogs`) — full name, job title, email, phone. It is
here for the create rule alone, not for room, which is exactly the case `card`
was added for. The edit surface in the same file is an `EditDrawer` and stays
one.

## StatusBadge

```tsx
<StatusBadge value={lead.status} kind="LeadStatus" />
```

Resolves the wire value through the mapping in
[tokens.md](tokens.md#status-mapping) to a role, renders `Badge` with the
`t.status.*` label, and adds the pulsing dot when the role is `ink + motion`.

- **Always renders a text label.** Color is reinforcement, never the only
  signal.
- An unmapped value renders `neutral` with the raw value in a monospace face,
  so a backend addition is visible rather than silently swallowed.

## When the API gives you an id and no name

**Settled by Q14 on 2026-08-28. It has since been re-litigated twice — Q70
(Trade's operating-context selector) and Q83 (the supplier picker) — which is
why it now lives here as a rule instead of in three separate answers.**

Many list projections carry `customerProfileId`, `ownerUserId`, `branchId` or
`partyId` and no display name. The rule, in order:

1. **Never fabricate a name.** Not from an id, not from an adjacent field, not
   from a lookup the actor's grants do not cover. A wrong name is worse than a
   visible identifier, because it looks authoritative.
2. **If a purpose-built projection carries the name, use it** — but only where
   the screen's own contract says to. The opportunity *card* endpoint carries
   `customerDisplayName`; the generic list does not, and the table is
   specified to use the generic list.
3. **Otherwise render the raw id through `identifierText`** — `wrap-anywhere`
   plus `<bdi>`, so a 36-character token cannot overflow a cell or reverse
   under RTL — and **link it to the detail route when one exists.** An id that
   navigates somewhere is a working affordance; an id that just sits there is
   debt.
4. **Null renders as the "not provided" empty phrase**, never as a blank cell
   and never as the string `null`.
5. **Do not open a new question for it.** Link to
   [Q14](../build/OPEN-QUESTIONS.md) and state which of the cases above
   applies. A fourth number for the same settled decision is noise.

The reason this keeps coming back is that it *looks* like a gap each time it is
met. It is a decision, and the decision is that an honest identifier beats an
invented name.

## PermissionGate

```tsx
<PermissionGate require="crm.leads.read" scoped>
  <LeadsWorkspace />
</PermissionGate>
```

**403 is not an empty state.** A gate renders a distinct, labelled in-body
state explaining that access is missing and who to ask — never `EmptyState`,
which implies "there is nothing here".

Client-side permission checks are **advisory**. The backend is authoritative;
this pattern improves the experience, it does not enforce anything.

## Where a result belongs

The rule that keeps write feedback consistent. Get this wrong and either the
user misses a failure or loses evidence of an ambiguous write.

| Situation | Surface | Why |
| --- | --- | --- |
| Successful write | **Toast** | Transient confirmation |
| Field validation error (422) | **`Field` inline** | Must stay associated with the input |
| Deterministic rejection (409) | **Toast** via `errorFromApi` | Carries code + correlationId |
| **403 on a write** | **Transport's toast only** | `axiosClient` already fires one — a second `toast.error` in the same catch double-fires |
| 403 on a whole section | **`PermissionGate`**, in-body | 403 is not an empty state |
| Load failure | **`ErrorState`**, in-body, with retry | Needs a retry affordance a toast cannot host |
| Empty result set | **`EmptyState`**, in-body | Not an error |
| Partial / stale data | **`DegradedBanner`**, in-body | A persistent condition, not an event |
| **Ambiguous write outcome** | **In-body, persistent** | See below |

### Ambiguous outcomes

A write that timed out, or failed after the request was sent, may or may not
have applied. Its idempotency key is the only way to retry safely.

That evidence **must not** live in a 4-second toast. Render it in-body and
persistently until the user resolves it, showing the operation, the idempotency
key, and a retry-exact affordance that reuses the same key.

This is why `axiosClient` distinguishes `nonReplayable` from
`replayAfterRefresh` — see
[../architecture/data-layer.md](../architecture/data-layer.md).

`AmbiguousOutcomePanel` is that surface. It takes the operation, the
idempotency key, an optional correlation id, a `onRetry` that **must replay
the same key**, and an `onDismiss` — the only thing that removes it. The key
renders `font-mono select-all` so it can be copied in one gesture.

## The state patterns

Seven patterns exist only to render a condition a screen can reach. They
share three properties: every string arrives as a `labels` prop, none imports
`useI18n`, and none imports `useToast`.

### ConflictDialog

```ts
interface ConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  yourChanges?: React.ReactNode;      // optional diff slots
  theirChanges?: React.ReactNode;
  onReload: () => void;
  onOverwrite?: () => void;           // OMIT when overwrite is not permitted
  onCancel: () => void;
  loading?: boolean;
  labels: ConflictDialogLabels;
}
```

`onOverwrite` is optional on purpose: many resources refuse a forced write,
and a disabled overwrite button invites the user to keep pressing it. Leave
it out and the button does not exist.

Escape, the backdrop and the close button all route through `onCancel` — an
abandoned conflict is never silently different from a declined one — and all
three are blocked while `loading`.

### NotFoundState

Distinct from `ErrorState`, and the difference is the whole point: the request
did not fail, it succeeded and the answer was "this is gone". **There is no
retry button**, because retrying cannot change the answer. It takes a
`backHref` (rendered as a `Link`) or an `onBack`, and renders neither when the
caller has nowhere to send the user.

### ReasonDialog

`ConfirmActionModal` has no slot for an input, and `AlertDialog` cannot host
one. `ReasonDialog` is the promotion of the opportunities `TerminalMoveDialog`
to a pattern: `reasonRequired` gates the confirm on a non-blank value,
`maxLength` mirrors the backend column bound, and `destructive` picks the
confirm variant — the pattern never infers destructiveness from the title.

The typed reason lives in the dialog body, which Radix unmounts with the
portal, so a reopened dialog starts empty by construction rather than by a
reset effect.

### AsyncJobState

Five UI states for a `202`. The in-flight affordance is the **pending dot**,
not a progress bar: the server reports no percentage, and a bar that fills on
a timer is fabricated success. `AsyncJobStatus` is a UI union, not a wire
enum — the screen maps its own proven values onto it (Q15 in
[../build/OPEN-QUESTIONS.md](../build/OPEN-QUESTIONS.md)).

### The bulk trio

`BulkActionBar` renders nothing at zero selection and carries no `primary`
variant — the one filled action on a screen belongs to `PageHeader`.
`BulkConfirmDialog` adds the summary slot `ConfirmActionModal` lacks.
`BulkResultPanel` renders partial success in-body: *"38 of 50 succeeded"* plus
every failure with its own reason. A run where **nothing** succeeded renders
`negative`, not `caution` — softening a total loss into a partial one is a
lie about the outcome.

### ReadOnlyGate

Takes `mode: AccessMode | null` and renders a notice above the children, or —
on `BLOCKED`, where the backend refuses reads as well — replaces them.

It does **not** traverse its children to disable controls. A gate that
silently neuters buttons produces controls that look live and do nothing; a
screen suppresses its own affordances from `useAccessMode().canMutate`.

`null` means unresolved, and renders children untouched. See Q16 in
[../build/OPEN-QUESTIONS.md](../build/OPEN-QUESTIONS.md) for why the browser
cannot read the mode yet, and why failing open is the correct answer while
that holds.

## Toast API

```ts
toast.success(title, message?, duration?)
toast.error(title, message?, duration?)
toast.info(title, message?, duration?)
toast.warning(title, message?, duration?)
toast.errorFromApi(title, error: NormalizedApiError, duration?)
```

- Rendered by `sonner`, mounted once in the root layout.
- `duration <= 0` means permanent; omitted uses the 4000ms default.
- **`aria-live="polite"`, never `assertive`; never takes focus; any toast
  carrying an action is keyboard-reachable.** Full contract in
  [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md#the-accessibility-contract) — it matters
  more here than in most products because every write result in this app is a
  toast.
- `errorFromApi` puts `errorCode` and `correlationId` in the message so the
  evidence is not lost.
- **Titles and messages come from the dictionary.** The transport's own
  forbidden-toast must be localized — the current `axiosClient` hard-codes
  English there, and that is fixed in the rebuild.
- Patterns that render an in-body surface must **not** import `useToast`. That
  pairing is a review smell.

## Checklist for every pattern

- [ ] Composes primitives from the barrel, never raw markup
- [ ] All strings arrive translated as props
- [ ] Loading, empty, error, forbidden states handled
- [ ] Correct in light and dark
- [ ] Correct in RTL and LTR
- [ ] Keyboard operable end to end
- [ ] Wide content scrolls inside its own container
- [ ] No `useToast` in an in-body feedback pattern
- [ ] Exported from `src/design-system/index.ts`
