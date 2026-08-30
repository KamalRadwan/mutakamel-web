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

Rules:

- Column headers arrive translated. `DataTable` never touches the dictionary.
- Sorting is server-side. A client sort over one page is a lie about the data.
- The first column is the display name and links to the detail route.
- The action column is `sticky="end"`, `ghost` icon buttons with tooltips.
- Never render a raw `<table>` in feature code.

## FilterBar

```ts
interface FilterBarProps {
  filters: FilterDef[];
  values: Record<string, string | undefined>;
  onChange: (next: Record<string, string | undefined>) => void;
  onReset: () => void;
  searchValue: string;
  onSearchChange: (q: string) => void;
}
```

- **Filter state lives in the URL**, so a filtered view is shareable and
  survives refresh.
- Search debounces 300ms before touching the URL, and renders
  `text-base sm:text-sm` — it takes typed input, so the
  [mobile input rule](DESIGN-SYSTEM.md#inputs-are-16px-on-mobile) applies.
- Active filters render as removable chips; a "Clear all" appears only when at
  least one is set.
- **Chips wrap before they shrink, and never truncate.** Past two rows the
  remainder collapses into a `+n` **button** that opens a popover of the rest,
  each still removable. A static `+n` count hides filter state the user is
  entitled to change; a truncated chip label (`Acquisition so…`) tells them
  nothing about what is filtering their data. Full rule in
  [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md#toolbar--28px-controls).
- Filters that map to an enum build their options from
  [../reference/enums.md](../reference/enums.md) with `t.status.*` labels.
- Collapses behind a "Filters" button with a count badge below `lg`.

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

## FormDrawer

Create and edit forms in a `Sheet`, not a dialog — a form long enough to need a
scrollbar in a dialog belongs in a drawer.

- **Dirty guard**: closing with unsaved changes opens a confirm. Applies to
  backdrop click, `Esc`, and the close button alike.
- Submit disabled while pending; button shows `loading`.
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
