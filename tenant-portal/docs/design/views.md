# The Three-View Contract

Status: **Specification**

Written: **2026-08-27** · Contract section rewritten: **2026-08-31** (Phase 2)

Implementation: `src/design-system/views/`

## Rule

**Leads, Customer Profiles and Opportunities each render in exactly three
views: `board`, `card`, `table`.** Same data, same filters, same permissions,
same empty and error states — three presentations of one workspace.

A screen implements all three or none. There is no "table only for now".

## Naming — "Kanban" is dead

The board view is called **board** everywhere: in code, in types, in dictionary
keys, in UI copy, in both languages.

The word "Kanban" must not appear in any user-facing string. It currently
survives in three dictionary keys and several icon imports; all are renamed
during the rebuild:

| Current (now removed) | Resolution |
| --- | --- |
| `t.crm.kanbanBoard` | Deleted — `ViewSwitcher`'s `t.views.board` covers it; nothing else referenced it |
| `t.crm.pipelinesKanbanBoards` | Deleted — orphaned, no caller ever read it |
| `t.crm.buildInteractiveKanbanStyle` | Deleted — orphaned, no caller ever read it |
| `PipelineSelectDropdown`'s `Kanban` icon import | Deleted with the component; its design-system replacement uses no icon there |

`Kanban` as a lucide icon *identifier* is acceptable only if the icon is
genuinely the best glyph; prefer `Columns3`. The banned thing is the word
reaching a user.

## Current state

All three screens now implement all three views — Phase 4 is complete.

| Screen | board | card | table | Notes |
| --- | :--: | :--: | :--: | --- |
| Leads | ✅ | ✅ | ✅ | `list` renamed to `table`, rebuilt on `DataTable` |
| Opportunities (Pipeline) | ✅ | ✅ | ✅ | Card and table built against their own purpose-built/generic endpoints — see [../api/crm-opportunities.md](../api/crm-opportunities.md) |
| Customer Profiles | ✅ | ✅ | ✅ | Built as one three-view workspace with `ViewSwitcher` |

## The grouping axis — this is not uniform

The board view needs a column axis. **It differs per screen, and it is not
guessable.** This is the single most likely thing to be got wrong:

| Screen | Board columns | Source | Ordered by |
| --- | --- | --- | --- |
| Leads | Tenant lead-stage catalogue | `GET /api/tenant/crm/v1/lead-stages` | `sortOrder` from the catalogue |
| Opportunities | Stages of the **selected pipeline** | `GET /api/tenant/crm/v1/pipelines/:id` | `sortOrder` within that pipeline |
| Customer Profiles | `CustomerStatusEnum` — fixed, 4 values | Static enum, not an API | `PROSPECT`, `ACTIVE_CUSTOMER`, `INACTIVE`, `BLACKLISTED` |

Consequences that follow from that table:

- Leads and Opportunities have **tenant-configurable** columns. Never hardcode
  stage names, never assume a count, and always render in `sortOrder`.
- Opportunities' board is meaningless without a selected pipeline. The pipeline
  selector is **required** on that screen and its value belongs in the URL.
- Customer Profiles' columns are a **fixed enum**, so its board never needs a
  catalogue fetch — and its drag-and-drop writes `status`, not a stage id.

## The shared contract

All three views implement one generic interface — `WorkspaceViewProps<T>` in
`src/design-system/views/types.ts`. Before it existed the "contract" was a
convention: the three took `cardsByColumn` / `items` / `rows`, `itemKey` /
`itemKey` / `rowKey` and `onCardClick` / `onItemClick` / `onRowClick`, every
workspace wired three different prop sets by hand, and switching view silently
dropped pagination, sorting and selection.

```ts
interface WorkspaceViewProps<T> {
  items: T[];                                 // ONE list; the board groups it itself
  itemKey: (item: T) => string;
  isLoading: boolean;
  error?: NormalizedApiError | null;
  onRetry?: () => void;
  emptyState?: ReactNode;                     // for a precondition, not for "no results"
  page?: PageInfo;                            // server pagination
  onPageChange?: (page: number) => void;
  sort?: SortState;                           // server sorting
  onSortChange?: (sort: SortState) => void;
  selection?: SelectionState;                 // the same SelectionState in all three
  onActivate?: (item: T) => void;             // open the detail route
  labels: WorkspaceViewLabels;                // every string, already translated
  className?: string;
}
```

Rules that hold for every implementation:

- A view never fetches, never reads the dictionary, and never knows which
  entity it renders. Every string arrives in `labels`.
- Pagination and sorting are **server** state. A view reports the change and
  renders whatever it is handed next; it never slices or reorders `items`.
- `labels.emptyTitle` and `labels.errorTitle` are **required**, so a blank
  heading cannot compile. The `title=""` fallbacks the board and card views
  carried are gone.
- `page` / `onPageChange` are optional **only** because not every list is
  page-numbered: the opportunity board and card endpoints are cursor-paginated
  and a page control there would be a lie about the data. Supply both or
  neither.

Two deliberate, **typed** deviations — a view that cannot do something omits
the prop rather than accepting it and ignoring it:

| View | Type | Why |
| --- | --- | --- |
| `BoardView` | `Omit<…, "sort" \| "onSortChange">` | A board's order *is* its grouping axis; there is nothing for a sort control to act on |
| `CardView` | adds `sortOptions` | With no column headers, the sortable fields have to be named somewhere |

Each view extends `WorkspaceViewLabels` with the strings only it needs:
`BoardViewLabels` adds `emptyColumn` and `moveTo`; `CardViewLabels` adds
`sortBy`.

### The card object

`WorkspaceCard` is the one card surface in the product. The board card and the
card-view card are the same component at two densities — `p-2` and `p-3` — and
they no longer disagree about anything else:

- One radius: **`rounded-md`**, inherited from the `Card` primitive. The board
  card used to hand-roll `rounded-sm`.
- One focus ring: the shared `focusRing` from `lib/variants`, not a
  hand-written `focus-visible:ring-2`.
- `cn()` for both, never a template-literal `className`.
- `role="button"` and the tab stop are set by `WorkspaceCard` itself, **not**
  inherited from `provided.dragHandleProps` — which is `null` the moment
  dragging is disabled, which is how board cards lost both for any user
  without the update capability.
- Click and drag are disambiguated by a **5px movement threshold**. A small
  drag used to fire `onClick` mid-gesture.
- The selection checkbox and the per-card actions render **outside** the
  activation surface, so no interactive element is nested inside a
  `role="button"` and neither can start a drag.

## Shared behavior — identical across all three views

Anything in this list is owned by the workspace, not by a view. A view never
re-implements one.

- **Data.** One `use<Entity>()` hook. Views receive already-fetched, already
  filtered data as props. **A view never fetches.**
- **Filters.** One `FilterBar` above the view switcher. Filter state lives in
  the URL.
- **Search.** One search input; debounced 300ms; `q` in the URL.
- **Branch scope.** One `TenantBranchSelect`. Every CRM read is branch-scoped —
  `branchId` is a **required** query parameter on all three list endpoints.
- **Permissions.** Action visibility comes from the screen's `capabilities`
  endpoint, not from guessing at `/auth/me` strings. See
  [api/crm-leads.md](../api/crm-leads.md#get-leadscapabilities).
- **Empty / error / forbidden / loading.** `EmptyState`, `ErrorState`,
  `PermissionGate`, `Skeleton` — rendered by the workspace, above the view.
- **Bilingual and themed.** Every view, in both languages and both themes.

## View state

```ts
export type WorkspaceView = "board" | "card" | "table";
```

- **URL is the source of truth**: `?view=board`, plus `?page=`, `?sort=` and
  `?dir=`. Deep links and refresh must land on the same view *and the same
  place in it*. `useWorkspaceState` owns all four; a view switch never resets
  any of them.
- **Selection deliberately stays out of the URL.** It is an unbounded set of
  ids. It lives in `useWorkspaceState`, above the view switch, which is what
  it has to survive.
- **Per-screen persistence**: on change, write
  `localStorage["tenant_view_<screen>"]`. On mount with no `?view` parameter,
  restore from storage, else fall back to the screen default.
- **Defaults**: Leads → `board`. Opportunities → `board`. Customer
  Profiles → `table` (a customer list is a directory, not a funnel).
- Storage reads and writes go through `safeStorage` and must survive a throwing
  or absent `localStorage`.

### Returning from a detail screen restores position

Filters, page, sort, view and branch already live in the URL, so they come back
for free. **Scroll position does not** — and a table is where it matters most:
opening row 40, then coming back to row 1, means re-scrolling and re-finding
your place on every single record you inspect.

- The **table view** scrolls the page; Next's scroll restoration handles it, so
  do not intercept it with a manual `scrollTo(0)` on mount.
- The **board view** scrolls *inside* its own row of columns, which browser
  restoration does not cover. `useScrollRestoration` persists that offset per
  route in `sessionStorage` and restores it when the container mounts — an
  offset is a property of this visit, not a durable preference.
- The **card view** does the same for the container it scrolls inside once it
  is windowed. Un-windowed, the page scrolls and Next owns it.
- Restoration is per **column row**, not per column body: a board column's own
  vertical offset is not persisted today.
- Never reset scroll on a filter change — that is a new result set, and the top
  is correct there.

## The switcher

`ViewSwitcher` — a segmented control in the workspace toolbar, at the inline
end, beside the branch selector.

```tsx
<ViewSwitcher value={view} onChange={setView} available={["board","card","table"]} />
```

| View | Icon | `t.views.*` |
| --- | --- | --- |
| `board` | `Columns3` | `t.views.board` |
| `card` | `LayoutGrid` | `t.views.card` |
| `table` | `Rows3` | `t.views.table` |

Rules:

- Icon-only buttons, 32px (`size="sm"`), each with `aria-label` **and** a
  `Tooltip` carrying the translated name.
- `role="radiogroup"`; the active button carries `aria-checked="true"`.
- The active button is `bg-secondary text-secondary-foreground`. **Not a
  colored fill.** The current leads implementation tints the active button
  purple, emerald or amber depending on which view is selected — three hues for
  one control, and one of the clearest examples of the problem this system
  removes.
- Arrow keys move between options; the group is one tab stop.

## Board view

```
src/design-system/views/board/
  BoardView.tsx        generic, driven by props
  BoardColumn.tsx
  BoardCard.tsx        wraps a per-screen card renderer
```

**Layout.** Horizontally scrolling flex row of fixed-width columns. Column
width 288px, gap 12px. The row scrolls; the page does not. Under RTL the
scroll direction and column order mirror automatically — use logical
properties and let the browser handle it.

**Column header.** Stage name (400 weight), a count chip, and — where the
stage carries an outcome — a 2px top border in the mapped role color from
[tokens.md](tokens.md#status-mapping). Intermediate stages get no color.

**Column body.** An empty column shows a dashed `border-border` drop zone with
the translated "Drop here" label — never blank space, which reads as broken.
The body is a plain `overflow-y-auto` element, **not** a Radix `ScrollArea`.

<a id="virtualization"></a>

**Virtualization is not shipped here yet.** See the section below.

**Drag and drop** via `@hello-pangea/dnd` (already a dependency, already used).

- Dragging is enabled only when the capability for that entity's update action
  is non-null. When disabled, cards are still focusable and readable.
- **Optimistic move, with rollback.** Move the card immediately, fire the
  mutation, and restore the original position on failure while surfacing the
  error as a toast.
- The move mutation is a distinct endpoint per entity — `POST
  /leads/:id/stage`, `POST /opportunities/:id/stage`, `PATCH
  /customer-profiles/:id` — never a generic PATCH.
- **Keyboard equivalent is required.** `@hello-pangea/dnd` provides one
  (space to lift, arrows to move, space to drop); do not disable it, and
  ensure the lift announcement is translated.
- A terminal move — into a `WON`/`LOST`/`CONVERTED`/`DISQUALIFIED` stage —
  opens a confirm dialog before committing, because it is not freely
  reversible. Leads and Opportunities both need this.

### Every card carries a "Move to…" action — not optional

**WCAG 2.2 AA (`dragging-alternative`) requires a single-pointer alternative to
every drag operation, in addition to the keyboard path.** The keyboard path
above satisfies only half of it.

Each board card carries a **Move to…** `DropdownMenu` listing every permitted
target column, and choosing one calls the same move path a drag does. One
control, no new endpoint, no new state.

**Shipped**, on all three board screens. `BoardView` builds the menu from its
own `columns`, minus the column the card is already in, filtered by
`canMoveTo` — gate that with the same rule that gates dragging, so the two
paths cannot disagree. A menu move goes through `confirmMove` exactly as a
drag does, so a terminal destination confirms identically. The opportunities
board composes `BoardCard` directly and is wired the same way, from the
pipeline's own stage list.

This is a conformance requirement, not a convenience. A user with a tremor, a
motor impairment, a trackpad they struggle with, or a switch device cannot
complete a sustained press-move-release — and without this menu the board is
**completely unusable** to them, because moving a card between stages is the
only thing a board is for.

Applies to all three board screens. The menu item is subject to the same
capability gate as dragging, and a terminal destination confirms the same way.

**Card content** is per-screen; see the table at the end of this file.

## Virtualization

| List | Threshold | State |
| --- | --- | --- |
| `DataTable` rows | 100 | **Shipped.** Rows are uniform by construction at `h-(--size-row)`, so the window is exact |
| `CardView` grid | 100 | **Shipped.** Grid rows stretch to a common height; the column count is read back from the laid-out element rather than duplicated in JS |
| Board column body | 50 | **Not shipped.** See below |

The mechanism is `useVirtualWindow` in `src/design-system/views/` — a
dependency-free vertical window over a uniform-pitch list, rendering a slice
plus two spacers sized to the rows it left out. It is honest about not having
measured anything yet: until a real row pitch and viewport height are
observed, the window is a safe prefix of `threshold` items, so the first paint
never renders the whole list and never renders a blank box. A container that
never lays out — SSR, jsdom, a browser with no `ResizeObserver` — simply stays
at that prefix.

**The board is deliberately not windowed.**
[DECISIONS.md](../build/DECISIONS.md#d9--virtualization--assumed-split-by-surface-on-2026-08-31) records D9 as
*assumed*, with the risk that a virtualized list unmounts the node
`@hello-pangea/dnd` is dragging. Task 1.46 was to prove
`@tanstack/react-virtual` composes with it — or switch to `react-window`,
which is what the dnd library's virtual mode is actually exercised against —
and that proof does not exist yet. Neither package is installed, and the
lockfile is shared with `admin-portal` and `partner-portal`, so adding one is
not a view-layer decision. Windowing the two lists that carry no drag
interaction takes none of that risk.

**How it will compose with the column body when it lands.** The body is a
plain `overflow-y-auto` element and **not** a Radix `ScrollArea`. That matters:
`ScrollArea` moves the scroll onto an inner `Viewport` element and wraps the
content in a `display: table` child, so a virtualizer handed the `Root` (the
obvious element to reach for) measures a box that never scrolls and computes a
window of zero rows — the classic broken-measurement pairing. If a board
column ever gains a `ScrollArea`, the virtualizer's scroll element must be the
**viewport**, not the root, and the spacer must sit inside the viewport's
content wrapper. Keeping the plain element avoids the question entirely.

## Card view

```
src/design-system/views/card/CardView.tsx
```

**Layout.** Responsive grid, no stage grouping:

```
grid gap-3
  grid-cols-1
  sm:grid-cols-2
  lg:grid-cols-3
  2xl:grid-cols-4
```

Each card is the shared `WorkspaceCard` at `density="default"` — border, no
shadow, `rounded-md`, `p-3`. See [The card object](#the-card-object).

Card view is the **sortable** view. Its sort control — a field `Select` plus a
direction toggle — is rendered by `CardView` itself, in a strip above the grid,
because it exists in exactly one view and putting it in the workspace toolbar
made every screen re-implement the "only when `view === "card"`" condition.
It renders only when the caller supplies both `onSortChange` and
`sortOptions`; a list the server will not sort gets no control rather than a
dead one. Sort state goes in the URL (`sort`, `dir`).

Same card renderer as the board, at a wider measure. Cards are focusable and
`Enter` opens the detail route.

**Windowed above 100 items**, inside its own scroll container. Below that the
grid renders whole and the page scrolls, exactly as before.

## Table view

```
src/design-system/views/table/TableView.tsx  →  adapts DataTable
```

Not a hand-rolled `<table>`. `TableView` implements the shared contract and
maps its names onto `DataTable`'s — `items` / `itemKey` / `onActivate` in,
`rows` / `rowKey` / `onRowClick` out — and changes nothing else. `DataTable`
stays the engine and keeps owning the sticky header, column sizing, row
selection, sorting, pagination, keyboard navigation, the row height and the
zebra row token. See [patterns.md](patterns.md#datatable).

**Screens render `TableView`, not `DataTable`.** Reaching past the adapter is
what let the three views drift apart in the first place.

Also owned by `DataTable`, and added in Phase 2:

- `aria-sort` on every sortable header — `"ascending"`, `"descending"` or
  `"none"`, and *absent* on a column that cannot sort. Without it the sort
  arrow is a purely visual signal.
- `scroll-margin` sized to the sticky chrome, so tabbing into a row never
  lands the focus ring behind the sticky header or a sticky column.
- **Windowed above 100 rows.** The scroll container then owns the vertical
  scroll, which is also what finally gives the sticky header something to
  stick to.

- Row height 40px, `text-xs`, weight 400.
- Sticky header, `bg-card` with a bottom `border-border`.
- The first column is the entity's display name and is a link to the detail
  route.
- The last column is a `ghost` icon-button action cluster, `sticky` to the
  inline end.
- Numeric and currency columns are `tabular-nums` and align to the inline end.
- Every column header is translated; no raw field names reach the UI.

## Per-screen configuration

The only per-screen code. Everything above is shared.

### Leads

| | |
| --- | --- |
| Hook | `useLeads()` |
| List | `GET /api/tenant/crm/v1/leads` |
| Board axis | Lead-stage catalogue, by `sortOrder` |
| Move | `POST /api/tenant/crm/v1/leads/:id/stage` |
| Capabilities | `GET /api/tenant/crm/v1/leads/capabilities?branchId=` |
| Default view | `board` |
| Card fields | Display name · profile-type icon · owner avatar · acquisition source · `StatusBadge(status)` · created date |
| Table columns | Name · Type · Stage · Status · Owner · Source · Branch · Created · Actions |
| Sortable | `createdAt`, `updatedAt`, `name` |
| Filters | `leadProfileType`, `status`, `stageId`, `stageFlag`, `acquisitionSourceId`, `ownerUserId` |
| Terminal stages | Any stage whose flag is `CONVERTED` or `DISQUALIFIED` |

### Customer Profiles

| | |
| --- | --- |
| Hook | `useCustomerProfiles()` |
| List | `GET /api/tenant/crm/v1/customer-profiles` |
| Board axis | `CustomerStatusEnum`, fixed order |
| Move | `PATCH /api/tenant/crm/v1/customer-profiles/:id` — `{ status }` |
| Capabilities | `GET /api/tenant/crm/v1/customer-profiles/capabilities?branchId=` |
| Default view | `table` |
| Card fields | Display name · profile-type icon · owner · acquisition source · `StatusBadge(status)` · contact count |
| Table columns | Name · Type · Status · Owner · Source · Branch · Created · Actions |
| Sortable | `createdAt`, `updatedAt`, `name` |
| Filters | `profileType`, `status`, `acquisitionSourceId`, `ownerUserId` |
| Terminal stages | `BLACKLISTED` — confirm before moving |

### Opportunities (Pipeline)

| | |
| --- | --- |
| Hook | `usePipelineWorkspace()` |
| **Board data** | `GET /api/tenant/crm/v1/pipelines/:id/board` — **not** the list |
| **Card data** | `GET /api/tenant/crm/v1/pipelines/:id/cards` — **not** the list |
| **Table data** | `GET /api/tenant/crm/v1/opportunities` |
| Board column paging | `GET /api/tenant/crm/v1/pipelines/:id/stages/:stageId/opportunities` |
| Board axis | Stages of the selected pipeline, by `stage.rank` |
| Move | `POST /api/tenant/crm/v1/opportunities/:id/stage` |
| Capabilities | `GET /api/tenant/crm/v1/opportunities/capabilities?branchId=` |
| Default view | `board` |
| Extra control | **Pipeline selector, required.** `pipelineId` in the URL |
| Card fields | Title · customer display name · customer type · phone · city/country · lead source · owner name + avatar · `importance` (stars) · `openActivityCount` |
| Table columns | Title · Customer (link to the customer-profile detail page — see below) · Stage · Status · Owner (raw id — see below) · Expected close · Actions |
| Sortable (table only) | `createdAt`, `expectedCloseDate` |
| Filters | `pipelineId`, `stageId`, `status`, `customerProfileId`, `ownerUserId`, `expectedCloseFrom`, `expectedCloseTo` |
| Terminal stages | Flags `WON` and `LOST` |

**Opportunities is the one screen where the three views hit three different
endpoints.** The backend ships purpose-built read models for board and card;
the generic list serves only the table. Full shapes in
[../api/crm-opportunities.md](../api/crm-opportunities.md#the-board-and-card-endpoints--use-these-not-the-list).

Consequences you must design for:

- **Board and card are cursor-paginated; the table is page-numbered.** Do not
  unify them. Each board column follows its own `nextCursor`, so columns
  paginate independently — that is the whole point of the board endpoint.
- **Cursors are filter-bound.** Resend the same filters with the cursor or the
  page is rejected.
- **There is no per-card amount.** Money arrives as
  `stage.summary.amountsByCurrency` — a per-stage, per-currency array of
  decimal strings. Render each currency separately in the column header; never
  add across currencies, and never put an amount on a card.
- Each column also carries `activitySummary` with `overdueCount` — surface it,
  it is the most actionable number on the board.
- `ownerAvatarUrl` is a safe, cache-busted server path. Render as given.
- **The table's `Customer`/`Owner` columns cannot show a name.** `GET
  /opportunities` returns the raw `OpportunityEntity` — `customerProfileId`
  and `ownerUserId` only, verified against `opportunities.service.ts`'s
  `findAll` return type. The card endpoint has display names because it is a
  different, purpose-built projection; the table's generic list does not, and
  there is no separate user/party-directory lookup to resolve `ownerUserId`
  elsewhere in the app. Settled: `Customer` renders as a link to
  `/crm/customer-profiles/:id` (a real, working affordance) instead of a
  fabricated name; `Owner` renders the raw id. Do not build a fake name for
  either — see [anti-patterns.md](anti-patterns.md#13-fake-data-and-fake-success).

## Accessibility

Required for all three views, not optional polish:

- The switcher is a keyboard-operable radiogroup.
- Board drag has a working, translated keyboard path **and** a single-pointer
  alternative — see [Move to…](#every-card-carries-a-move-to-action--not-optional).
- Every card is a `role="button"` with a tab stop, whether or not dragging is
  permitted, and a small drag never fires it.
- `aria-sort` on every sortable table header.
- Sticky chrome never obscures the keyboard-focused row.
- Table rows are navigable; the row action cluster is reachable by keyboard.
- Cards are focusable and open on `Enter`.
- View changes announce via `aria-live="polite"` — "Board view, 42 leads".
- Every icon-only control has an `aria-label` from the dictionary.

## Definition of done

A screen's three-view work is complete when all of these hold:

- [ ] All three views render real server data
- [ ] `?view=` round-trips through refresh and deep link
- [ ] Preference persists per screen in `localStorage`
- [ ] Board columns come from the correct axis, in `sortOrder`
- [ ] Drag-and-drop is optimistic, rolls back, and honors capabilities
- [ ] Terminal moves confirm first
- [ ] Keyboard drag works and announces in both languages
- [ ] Table is `DataTable`, not hand-rolled markup
- [ ] Card view exposes sorting; board and table do not duplicate it
- [ ] Zero hardcoded strings — every label from the dictionary
- [ ] Correct in light and dark
- [ ] Correct in RTL and LTR
- [ ] Empty, loading, error and forbidden states covered in all three
- [ ] All three views wired through `WorkspaceViewProps<T>` — one prop set
- [ ] Page, sort and selection survive a view switch
- [ ] Every board card has a working "Move to…" menu
