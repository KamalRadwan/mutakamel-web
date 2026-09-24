# The Three-View Contract

Status: **Specification**

Written: **2026-08-27** · Contract section rewritten: **2026-08-31** (Phase 2) ·
Calendar view added: **2026-09-24**

Implementation: `src/design-system/views/`

## Rule

**Leads, Customer Profiles and Opportunities each render in exactly three
views: `board`, `card`, `table`.** Same data, same filters, same permissions,
same empty and error states — three presentations of one workspace.

A screen implements all three or none. There is no "table only for now".

**The rule is about those three record workspaces.** Activities is the one
**time-based** workspace, and it renders `calendar`, `board` and `table`: a
calendar because an activity is a thing with a time, a board because its status
moves, and a table because it is the list a keyboard and a screen reader can walk
end to end. It has no card view — a grid of activity cards says nothing a
calendar day does not. See [Calendar view](#calendar-view) and
[Activities](#activities--the-time-based-workspace).

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
- A third slot, **`footer`**, is a full-width strip below the header row and is
  also outside the activation surface. `actions` is a top-end column holding
  one stack of controls; anything that has to sit on its own line and still not
  open the card — a rating a user clicks, an owner badge beside it — goes here.
  Putting such a control in `children` would nest it inside a `role="button"`
  **and** inside the drag handle, which is two bugs rather than one.
- **`cardClassName`**, on `BoardView` and `CardView` alike, paints per-card
  surface classes — today only the user-chosen card colour. Never geometry: a
  card that is a different size from its neighbours breaks the windowed
  column's row estimate. The colour is painted at `WorkspaceCard`'s **2px**
  border, widened from the `surface` default of 1px: eleven filing marks are
  not distinguishable from each other as a hairline at board density. Every
  card carries the 2px, coloured or not, which is what keeps the geometry
  identical either way.

## Shared behavior — identical across all three views

Anything in this list is owned by the workspace, not by a view. A view never
re-implements one.

- **Data.** One `use<Entity>()` hook. Views receive already-fetched, already
  filtered data as props. **A view never fetches.**
- **Filters.** One `FilterBar`; its controls render in the page action bar and
  its chips below the bar, in the body. Filter state lives in
  the URL.
- **Search.** One search input; debounced 300ms; `q` in the URL.
- **Branch scope.** One `TenantBranchSelect`. Every CRM read is branch-scoped —
  `branchId` is a **required** query parameter on all three list endpoints, so
  `useTenantBranchSelection` falls back to the actor's primary branch. A screen
  whose reads narrow by branch only when asked passes
  `useTenantBranchSelection(user, { optional: true })` and
  `<TenantBranchSelect allowAll />`: it opens on "All accessible branches"
  (`null`, no `branchId`), offered first in the list.
- **Permissions.** Action visibility comes from the screen's `capabilities`
  endpoint, not from guessing at `/auth/me` strings. See
  [api/crm-leads.md](../api/crm-leads.md#get-leadscapabilities).
- **Empty / error / forbidden / loading.** `EmptyState`, `ErrorState`,
  `PermissionGate`, `Skeleton` — rendered by the workspace, above the view.
- **Bilingual and themed.** Every view, in both languages and both themes.

## View state

```ts
export type WorkspaceView = "board" | "card" | "table" | "calendar";
export type RecordWorkspaceView = Exclude<WorkspaceView, "calendar">;
```

- **Each screen offers its own set.** `ViewSwitcher`, `useWorkspaceView` and
  `useWorkspaceState` are generic over it. A record workspace names no set and
  gets `RECORD_WORKSPACE_VIEWS` — board, card, table — which is why every call
  site that predates the calendar compiles unchanged. Activities passes
  `views: ["calendar", "board", "table"]`, and `view`, `setView` and the
  switcher's `labels` are then typed to exactly that set: a label missing for
  an offered view does not compile, and neither does a `defaultView` outside it.
  A `?view=` or stored value the screen does not offer falls back like any
  unknown value.
- **URL is the source of truth**: `?view=board`, plus `?page=`, `?sort=` and
  `?dir=`. Deep links and refresh must land on the same view *and the same
  place in it*. `useWorkspaceState` owns all four; a view switch never resets
  any of them.
- **Every write goes through `replaceSearchParams`** (`views/replace-search-params.ts`):
  built from `window.location.search` at the moment of the write and committed
  with `window.history.replaceState`, never `router.replace` from a
  `useSearchParams` snapshot. The router commits a URL only when its transition
  renders, so two writes in one event — or a screen's own filter write and a
  view switch — would each start from the same old query and the later one
  would drop the earlier. Next keeps `useSearchParams` in step with
  `replaceState`, and a query change costs no server round trip. A screen that
  keeps its own keys in the URL writes them through the same function.
- **Selection deliberately stays out of the URL.** It is an unbounded set of
  ids. It lives in `useWorkspaceState`, above the view switch, which is what
  it has to survive.
- **Per-screen persistence**: on change, write
  `localStorage["tenant_view_<screen>"]`. On mount with no `?view` parameter,
  restore from storage, else fall back to the screen default.
- **Defaults**: Leads → `board`. Opportunities → `board`. Customer
  Profiles → `table` (a customer list is a directory, not a funnel).
  Activities → `calendar`.
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

`ViewSwitcher` — a segmented control at the **inline end of the page action
bar**, which is the last of that bar's three regions. It is the only control
that changes how a screen is DRAWN rather than what it holds, so a fixed edge
keeps it still as a screen gains or loses actions. The branch selector moved to
the same bar's `actions` region, with the rest of the screen's controls.

```tsx
<PageActions slot="view">
  <ViewSwitcher value={view} onChange={setView} available={["board","card","table"]} />
</PageActions>
```

`available` is the screen's own set, in the order drawn — Activities passes
`["calendar","board","table"]` — and `labels` must name exactly those views.

See [shell.md](shell.md#it-holds-the-screens-controls).

| View | Icon | `t.views.*` |
| --- | --- | --- |
| `board` | `Columns3` | `t.views.board` |
| `card` | `LayoutGrid` | `t.views.card` |
| `table` | `Rows3` | `t.views.table` |
| `calendar` | `CalendarDays` | `t.views.calendar` |

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

### A link after the switcher — `WorkspaceLink`

Leads, Customers and Opportunities each put one more icon **after** the
switcher, in the same `view` slot: `ActivitiesWorkspaceLink`
(`src/components/activities/`), which draws the design-system `WorkspaceLink`.
It opens the Activities workspace narrowed to that list's record type —
`/crm/activities?targetApp=CRM&targetType=LEAD` (`CUSTOMER_PROFILE`,
`OPPORTUNITY`), shown there as the removable "Related to: Leads" chip.

- It wears the switcher's frame (bordered `bg-card`, 28px target) so the two
  read as one cluster, but it is a **link, never a radio**: a radio promises
  another drawing of the same records, and this leaves for other records.
- Icon `ListChecks` — the Activities glyph the nav uses (one glyph per concept).
  `aria-label` and `Tooltip` carry "Lead activities" / "أنشطة العملاء المحتملين"
  and their customer and opportunity counterparts (`t.activities.workspaceLinks`).
- Admitted by the same rule as the nav's Activities item
  (`canAccessCrmRoute(…, TENANT_ROUTES.crmActivities)`), so it is absent rather
  than a link to a refusal.

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

**Where the pane's height comes from.** `AppShell` is `h-dvh` and `<main>` is
the `flex-1` item inside it, so `<main>` is the one element with a definite
height; a screen root asking for `h-full` gets the viewport minus the bars, and
`min-h-0 flex-1` on the view wrapper hands the remainder to the board. That
chain breaks on a **segment layout that renders a real box**: `h-full` resolves
against the nearest box, not the nearest one with a height, so an unstyled
`<div>` in `app/(tenant)/<segment>/layout.tsx` silently turns the pane back into
"as tall as the cards" and moves the scrollbar from the column body to the page.
`crm/layout.tsx` did exactly that to every CRM screen except `/crm/opportunities`
— which it exempted by pathname — and the leads board rendered short of the fold
until it became the pass-through the Core and Trade layouts already were.

**Every state owns the full height of the pane**, not only the populated one:
the loading skeletons, the error state and the empty state all carry `h-full`.
A board that collapses to its content while loading makes the page jump as the
columns arrive, and an empty pipeline rendered as a short strip under the
filters reads as a broken screen rather than as a pipeline with nothing in it.

**So does every column.** `BoardColumn` asks for `h-full min-h-0` itself
rather than leaning on the row's default `align-items: stretch`: the default
produces the same pixels today and is one `items-start` on that row away from
silently collapsing every column back onto its cards. A stage holding one card
therefore lines up with the stage holding forty, and the drop zone covers the
whole column rather than the inch its cards occupy. The **body** is what
scrolls — the page never grows a second scrollbar, and the row never scrolls
vertically.

**Column header.** Stage name (400 weight), a count chip, and — where the
stage carries an outcome — a 2px top border in the mapped role color from
[tokens.md](tokens.md#status-mapping). Intermediate stages get no color.

At the end of the header sit up to two controls, in this order: **`+`**, then
the **collapse toggle**.

- **`+`** appears only where a screen passes `onAddToColumn`, and it hands back
  the column it was pressed in. The board does not know what creating means —
  the screen opens its own modal and decides what that column id seeds. On
  Leads it opens the create modal with the stage already filled in, keyed by
  stage so pressing `+` in a second column re-seeds instead of showing the
  first one's, and the field stays editable: a preset that cannot be corrected
  is a trap rather than a shortcut. Gate it with the same capability that gates
  the screen's own Add button, or the board offers a create the header refuses.
- **The collapse toggle** takes the column down to
  `--size-column-collapsed` (45px), where the stage name turns on its side and
  the count chip stays under it. `writing-mode: vertical-rl`, not a
  `rotate(270deg)`: the name reads top to bottom, `truncate` still ends a long
  stage in an ellipsis because the box is measured the way it is drawn, and
  Arabic turns with it rather than being laid on its back.

Both toggles carry `aria-expanded` and both names end with the column's own
label — "Collapse column: Qualifying" — because five identical buttons in a row
tell a screen-reader user nothing about which stage they are on.
`collapseColumn` and `expandColumn` are therefore **required** labels, unlike
`moveTo`.

A collapsed column renders no `Droppable`, so it cannot be dragged into. The
single-pointer path is unaffected — "Move to…" still lists it — which is also
what keeps the board's `dragging-alternative` conformance while a stage is
collapsed.

Collapse is **remembered per route** in
`localStorage["tenant_board_collapsed_<pathname>"]`, through `safeStorage`, so
a browser that blocks site data still collapses and merely forgets. It is
restored in an effect rather than during render: reading storage while
rendering would make every board with a collapsed stage a hydration mismatch,
and the cost is one frame in which the column is still open. That is the
opposite choice from [`useScrollRestoration`](#board-view), which is
session-scoped — an offset belongs to one visit, a collapsed stage is a
working preference.

A column may also carry a **distribution bar** under that heading:
`BoardColumnDef.segments` plus `segmentsLabel`, rendered by
`ColumnSegmentBar`. Counts, never percentages — the bar divides its own width
with `flex-grow`, so four numbers cannot round to 101%. Four tones are
available (`negative` / `caution` / `positive` / `neutral`) and each takes a
`*-vivid` step, because a 6px strip is a non-text graphic answering to the 3:1
bar rather than 4.5:1.

The bar is `role="img"` and spells every count into its `aria-label`: its
segments are separated by colour and nothing else, so without the label it
says nothing at all to a reader who cannot see it. `segmentsLabel` names what
the bar summarises — and where the board is paginated, that label has to say
so, because the bar can only describe the cards actually loaded into the
column.

**Column body.** An empty column shows a dashed `border-border` drop zone with
the translated "Drop here" label — never blank space, which reads as broken.
It is `flex-1`, so with the column at full height the drop target is the whole
column. The body is a plain `min-h-0 flex-1 overflow-y-auto` element, **not** a
Radix `ScrollArea`. `min-h-0` is stated rather than inferred: without it a
column flex item sits at `min-height: auto`, and the only reason that resolves
to 0 is the `overflow-y-auto` beside it — a coincidence, not a contract.

<a id="virtualization"></a>

**Above 50 cards the body windows itself.** See the section below.

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

The menu item is subject to the same capability gate as dragging, and a
terminal destination confirms the same way.

> **Leads: the alternative is on the detail screen, not on the card
> (closed 2026-09-07).** The Leads card renders neither `BoardView`'s own
> **Move to…** trigger nor a move section in its menu — the trigger went when
> the card was redesigned to one overflow menu, and the section was removed
> from that menu on request. For a day that left the board with the keyboard
> path only and **not** conforming.
>
> What closed it: the **pipeline bar on `/crm/leads/[id]` is the move**. It
> calls the same `POST /leads/:id/stage` the drag calls, is gated by the same
> `capabilities.update` check, refuses the same `CONVERTED` destination, and is
> reachable with one pointer press or with the keyboard. A card opens its
> record in one press, so the path from board to moved lead is two.
>
> `BoardViewLabels.moveTo` is optional so a screen may own the control itself —
> never so it may drop the capability. Leads owns it on the detail screen; a
> screen that owns it nowhere is the configuration this rule forbids.

**Card content** is per-screen; see the table at the end of this file.

## Virtualization

| List | Threshold | State |
| --- | --- | --- |
| `DataTable` rows | 100 | **Shipped.** Rows are uniform by construction at `h-(--size-row)`, so the window is exact |
| `CardView` grid | 100 | **Shipped.** Grid rows stretch to a common height; the column count is read back from the laid-out element rather than duplicated in JS |
| Board column body | 50 | **Shipped, unverified in a browser.** A different library and a different shape — see below |

The mechanism is `useVirtualWindow` in `src/design-system/views/`, built on
`@tanstack/react-virtual`. It expresses the window as a **slice plus two
spacer sizes** rather than absolutely-positioned rows — the one shape a real
`<tbody>` and a CSS grid can both consume, and what lets the table keep
`aria-sort`, its sticky header and its sticky columns. The un-measured first
paint is a safe prefix of `threshold` items, never the whole list and never a
blank box: the scroll element is only known after the first commit. A
container that never lays out — SSR, jsdom — simply stays at that prefix.

**The board does not use that mechanism.**
[D9](../build/DECISIONS.md#d9--virtualization--assumed-split-by-surface-on-2026-08-31)
is split by surface: board columns get **`react-window`**, the only pairing
`@hello-pangea/dnd`'s virtual mode is actually exercised against. It is now a
direct dependency, earned by task 2.8. Windowing the two surfaces that carry
no drag interaction takes none of that risk, and — per 2.18 — the WCAG AA
"Move to…" fix above does not share a gate with any of it.

**`react-window` v1, not v2, and the version is load-bearing.** D9 chose this
library because it hands the row renderer a `style` object to merge and
positions with `top`, leaving `transform` free for the drag library to displace
a card with. `react-window@2.x` positions with `transform: translateY(…)` — the
exact collision D9 moved away from. It also drops `outerRef` for an imperative
handle whose DOM node has to be bridged out before the droppable can attach to
it, and it renders rows as direct children of the scroller with a trailing
sizer sibling — a shape the drag library has never been exercised against. Do
not bump the major without re-reading D9.

**The board's shape: absolutely-positioned rows, measured per card.**
`VirtualColumnBody` in `src/design-system/views/board/`. Board cards are *not*
uniform — a lead card drops its email and phone rows when the lead has neither
— so heights are measured per card into an id-keyed cache and fed back through
`VariableSizeList`, with an estimate standing in until a card has been laid
out. `BoardColumn` picks between the windowed body and the plain one by card
count, so at or below 50 the column renders exactly as it always did, keeps its
flex `gap`, and keeps the dashed drop zone that an empty column needs and a
windowed body has no row to hang.

**The four parts of the `@hello-pangea/dnd` virtual contract**, all
load-bearing: `mode="virtual"` (without it, a scroll mid-drag warns and drops
the update); a mandatory `renderClone`, because the dragged card is *unmounted*
from the list and a portalled clone is what follows the pointer; **no**
`provided.placeholder`, which virtual mode throws on — space for an incoming
card is made by adding a row while `snapshot.isUsingPlaceholder`; and
`overscanCount ≥ 1`, without which the library cannot tell whether a card
exists past the last visible one.

**How it composes with the column body.** The scroll element is react-window's
own outer `div`, a plain `overflow: auto` element and **not** a Radix
`ScrollArea`. That matters: `ScrollArea` moves the scroll onto an inner
`Viewport` element and wraps the content in a `display: table` child, so a
virtualizer handed the `Root` (the obvious element to reach for) measures a box
that never scrolls and computes a window of zero rows — the classic
broken-measurement pairing. If a board column ever gains a `ScrollArea`, the
virtualizer's scroll element must be the **viewport**, not the root. Keeping
the plain element avoids the question entirely.

**What windowing costs, stated rather than glossed.** The drag library's own
virtual-list guide names two: a screen reader cannot reach a card that is not
in the DOM, and neither can the browser's find-in-page. It suggests windowing
above ~500 items; the board's threshold is 50, so the board pays those costs
ten times sooner. Keyboard `Tab` past the window's edge works only because the
browser scrolls the focused card into view and the scroll mounts the next one —
real-browser behaviour that jsdom cannot exercise. Every card's "Move to…"
menu is reachable once its card is mounted, and 2.7 is pinned by test inside a
windowed column, but a card outside the window is reachable only by scrolling
to it.

**A real 200-card drag in a browser has not been performed** — mouse and
keyboard, both directions, both languages, which is what D9 requires and what
keeps task 2.8 at `[/]`. What exists is `BoardVirtualization.test.tsx` and
`virtual-dnd.probe.test.tsx`: structure, indices and invariants, not behaviour.

## Stage bar — the pipeline, above the two views that lose it

```
src/design-system/views/stage-bar/StageBar.tsx
```

A board shows its stages as columns. A card or table view has nowhere to put
them, and without help the stage a row is in becomes just another text cell.
`StageBar` puts them back as one chevron strip above those two views: an `All`
step first, then a segment per stage, each pointing into the next.

It is the filter as well as the picture. Pressing a stage narrows the list to
it and pressing it again clears — there is no separate control to keep in sync,
and on Leads it replaces only the search bar's Stage tokens, preserving
My Leads and other fields. **Updated 2026-09-16:** the strip is the first visible
content above both Leads card and table views. It reuses the detail screen's
`StageBar`, labels, ordering, and outcome tones. Multiple selected Stage tokens
highlight their matching segments. Pressing a stage (or `All`) edits the same
Basic search state shown in the Odoo-style search bar. The Advanced UI is
available through one compact `Advanced` toggle button and keeps its own explicit-submit
draft. The stage strip is hidden in Advanced so it cannot mutate or apply that
draft. The board keeps its stage columns.

- **The arrow is a `clip-path`**, not a rotated square or a border trick: those
  leave a seam at a non-integer device pixel ratio, and a border chevron cannot
  take a background. The first segment has no notch cut into its start edge and
  the last has no point on its end, so the bar reads as one object rather than
  a row of loose arrows.
- **Selection is `aria-pressed` first and fill second.** Colour is
  reinforcement, never the only signal.
- **Only an outcome stage takes a hue** — WON positive, LOST negative — which
  is the rule the board's columns already follow. An intermediate stage gets
  none: position and label carry it.
- **Mirrored under RTL** by flipping the segment and flipping its label back, so
  the arrow follows the reading direction and the text does not.
- Its hover colours use `not-disabled:hover:` rather than a bare `hover:`.
  `Button`'s ghost variant paints `not-disabled:hover:bg-accent`, two
  pseudo-classes to a bare `hover:`'s one, so a plain `hover:bg-…` loses on
  specificity however late it appears — every segment turned grey under the
  pointer before that was matched.

On Opportunities the bar filters both views for real: `stageId` on
`GET /opportunities` for the table and on `GET /pipelines/:id/cards` for the
cards. The card cursor is **stamped with the selected stage**
(`opportunity-board.service.ts:209`), so `stageId` has to be repeated on every
`loadMore` — dropping it does not return an unfiltered page, it makes the
server reject the cursor.

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

Each card is the shared `WorkspaceCard` at `density="default"` — a 2px border,
no shadow, `rounded-md`, `p-3`. See [The card object](#the-card-object).
Screens may opt into `density="compact"`; Leads uses it with `p-2`, tighter
gaps and up to five columns at `2xl`.

Card view is the **sortable** view. Its sort control — a field `Select` plus a
direction toggle — is rendered by `CardView` itself, in a strip above the grid,
because it exists in exactly one view and putting it in the workspace toolbar
made every screen re-implement the "only when `view === "card"`" condition.
It renders only when the caller supplies both `onSortChange` and
`sortOptions`; a list the server will not sort gets no control rather than a
dead one. Sort state goes in the URL (`sort`, `dir`).

Same card renderer as the board, at a wider measure. Cards are focusable and
`Enter` opens the detail route.

Selection is opt-in. Leads Card View deliberately omits the selection contract,
so there is no checkbox on a card and no Select All control above the grid.

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

## Calendar view

```
src/design-system/views/calendar/
  CalendarView.tsx       the public component: toolbar, states, the grid for the mode
  CalendarMonthGrid.tsx  six fixed weeks
  CalendarTimeGrid.tsx   week and day: hour rows, items placed by time
  CalendarToolbar.tsx    previous / today / next, the range title, Month · Week · Day
  CalendarItem.tsx       the activation surface around the caller's content
  calendar-range.ts      calendarRange, calendarWeekStart — public
  calendar-layout.ts     overlap lanes, wall-clock minutes
  calendar-format.ts     every date string the calendar draws, through Intl
  useCalendarFocus.ts    the grid's single roving tab stop
  useScrollToHour.ts · useNow.ts
```

It keeps the workspace rules — it never fetches, never reads the dictionary
(every string arrives in `labels`), never knows which entity it renders, never
owns a mutation — but **not** `WorkspaceViewProps`. A calendar's range is its
paging and time is its order, so it takes no `page`, `sort` or `selection`, and
it takes the range's anchor and mode instead:

```ts
interface CalendarViewProps<T> {
  mode: CalendarMode;                        // "month" | "week" | "day"
  onModeChange: (mode: CalendarMode) => void;
  anchor: Date;                              // any instant inside the period on show
  onAnchorChange: (anchor: Date) => void;
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  items: T[];
  itemKey: (item: T) => string;
  itemStart: (item: T) => Date;
  itemEnd: (item: T) => Date | null;         // null = a point in time
  renderItem: (item: T, layout: "month" | "timed") => ReactNode;  // content only
  itemLabel: (item: T) => string;            // the surface's accessible name
  itemClassName?: (item: T) => string | undefined;                // tone, semantic tokens only
  onItemActivate?: (item: T) => void;
  onSlotActivate?: (start: Date) => void;    // omitted = no create affordance
  isLoading: boolean;
  error?: NormalizedApiError | null;
  onRetry?: () => void;
  emptyState?: ReactNode;
  toolbarEnd?: ReactNode;                    // e.g. a truncation notice
  labels: CalendarViewLabels;                // incl. moreItems(count), modeLabel, slotLabel?(start)
  className?: string;
}
```

**The range is a function, and the screen fetches exactly it.**
`calendarRange(mode, anchor, weekStartsOn)` returns `[start, end)` as the local
starts of their days: 42 days for a month, 7 for a week, 1 for a day. The month is always
six whole weeks, so the grid keeps one height from February to August — and the
days it draws from the neighbouring months are inside the range, so their items
are fetched rather than silently missing.

**A day starts where the calendar says, not 24 hours after the last.** Every
day boundary — the range's end, the grid's days, a column's end — comes from
`calendarDayStart(day, offset)`, which builds the date from its parts. Stepping
with date-fns `addDays` keeps the time of day, and where daylight saving starts
at midnight — Cairo's last Friday of April, whose day begins at 01:00 — every
later day would begin at 01:00 too, handing each night's first hour to the day
before. The Activities workspace's summary day and due-date range use the same
function.

**The week starts where the reader's locale says.** `calendarWeekStart(language)`
reads CLDR's week data from `Intl.Locale` (`getWeekInfo()`, or the older
`weekInfo` accessor) for `INTL_LOCALE[language]`: Saturday for `ar-EG`, Sunday
for `en-US`, with those two as the fallback where a browser exposes no week
data. Not date-fns — its `ar-EG` locale says Sunday. Pass the same value to a
`dateRange` filter's `weekStartsOn`, or "This week" and the calendar disagree.

**Every date is `Intl` with `INTL_LOCALE`**, Arabic names with Western digits:
"September 2026", "Sep 20 – 26, 2026" (`formatRange`, which writes both months
out when a week crosses one), "Thursday, September 24, 2026".

### Month

Six weeks of seven days under a weekday header. Days outside the anchor's
month take `bg-muted/40`; today is marked by **weight and a hairline ring,
never a hue** — the date picker's rule, because a date is an identity, not an
outcome — and carries `aria-current="date"`.

- A day shows **up to three** items, then **"+N more"**, which opens that day.
  A fixed count keeps every week the same height; the rows are at least
  `8.5rem`, and a pane too short for six of them scrolls inside the grid.
- The **date number is a button** that opens the day. The first of each month
  adds the month's short name beside it, as a caption and not as the button's
  text: the button's name is the whole date, and "Oct 1" is not contained in
  "October 1" (WCAG 2.5.3, label in name).
- An item spanning several days shows on each of them; a point in time belongs
  to the day it falls on, and an item ending at midnight does not spill over.
- **A click in a day's empty space** proposes that day at 09:00. It is pointer
  only on purpose: its keyboard route is the date button, which opens the day
  and its half-hour targets.

### Week and day

48px an hour under a **sticky day header**, beside a **sticky hour gutter**. The
grid opens at the current hour when today is on screen and at 07:00 otherwise —
once, on mount, instantly; after that the scroll position is the user's, and it
survives a switch between week and day.

- Items are placed by start and end, **clamped to the day**; a two-day visit
  draws on both. Positions are **wall-clock** minutes, not elapsed ones, which
  differ by an hour on a daylight-saving day while the hour labels do not.
- **Nothing is drawn shorter than half an hour** — 24px, the WCAG 2.2 target
  floor. A point in time is drawn that tall, and one late in the day is pinned
  inside it rather than run off the bottom.
- **Overlapping items share the width as lanes**, first come first served. A
  run of transitively overlapping items is one cluster; lanes are shared
  within a cluster and never across two, so an early clash does not narrow
  the rest of the day, and a block widens into lanes nothing it overlaps uses.
  Offsets are `insetInlineStart`, so the lanes mirror with the page.
- A **neutral "now" line** (`bg-foreground`, never a hue) crosses today.
- With the create pair supplied, every half-hour is a target — a `Button`
  named by `labels.slotLabel(start)`. **Supply `onSlotActivate` and
  `slotLabel` together or neither**: a target nobody can name is not offered,
  so without the label there is no create affordance at all.
- In a week, each day's heading is a button that opens the day. Seven columns
  take at least 7 × 112px; narrower than that the grid scrolls sideways rather
  than squeezing an activity under a readable width.

### Items

`renderItem` draws the content; the **view owns the surface** around it — a
`Button`, so focus, Enter and Space come from the primitive. `itemLabel` is
that surface's accessible name and it must say **when and in what state** in
words: the grid conveys the time by position, and a position is not a name.
`itemClassName` paints the surface in semantic tokens only — never geometry,
because a block's size is its duration — and a type never takes a hue
([tokens.md](tokens.md#activity-due-state--derived-not-an-enum)). Without
`onItemActivate` an item is not focusable and keeps its name as screen-reader
text.

### Keyboard and semantics

- **One tab stop for the whole grid.** A week offers 336 half-hour targets; as
  tab stops they would bury everything after the calendar. `useCalendarFocus`
  keeps one roving stop and moves it with the arrows.
- **Up / Down** move through a day, top to bottom — in the time grid by time,
  heading first; in the month they run on into the week above or below.
  **Left / Right** move to the neighbouring day at the same time of day, and
  **follow the screen**: under RTL the next day is to the left. **Home / End**
  jump to the first or last day of the row. Enter and Space are the buttons'
  own. A stop that disappears — reloaded away, another period — hands the tab
  stop back to today, or the anchor's day.
- `role="grid"` → `row` → `columnheader` / `gridcell`, labelled by the range
  title. **Days are named on their date buttons (month) and their column
  headers (week, day), not on the cells**: a label on a cell replaces its
  contents for a reader walking the table, which would hide the activities in
  it.
- Items and slots scroll clear of the sticky header and gutter
  (`scroll-mt-12` / `scroll-ms-14`), so a focused control is never behind the
  chrome that stays put (WCAG 2.2 focus-not-obscured).
- The range title is a polite live region: stepping through periods is
  announced as the new period.

### States

The toolbar stays in every state, so the reader can always move to another
period. Every state below it owns the full height of the pane.

| State | Rendering |
| --- | --- |
| Loading | A skeleton shaped like the grid — 42 cells, 7 columns or 1 |
| Error | `ErrorState` with retry, in the grid's frame |
| Empty | The grid, **with a notice over it** (`role="status"`) — `emptyState`, or `EmptyState` with `labels.emptyTitle` |

The empty notice floats over the grid instead of replacing it: an empty week is
still a week to plan into, and a grid that stays put does not jump as the user
pages between empty and busy periods. Only the notice takes the pointer. Keep
an `emptyState` compact — one line and at most one action.

### What it does not do

- **No motion** beyond the budget: no month slide, an instant scroll, and a
  "now" line that moves once a minute without animating.
- **No server-rendered "today".** The clock is read through
  `useSyncExternalStore` (`useNow`), and the server snapshot is empty: the
  server's time zone is not the reader's, and a "today" drawn there could fail
  hydration. The client marks today on its first pass.
- **Opening a day is two callbacks.** "+N more", a date and a week heading call
  `onAnchorChange` and then `onModeChange` in the same event. A screen that
  keeps both in the URL must build each write from the current query, not
  from one read at render, or the second write drops the first.

## Per-screen configuration

The only per-screen code. Everything above is shared.

### Leads

| | |
| --- | --- |
| Hook | `useLeads()` |
| Card/Table data | `GET /api/tenant/crm/v1/leads` or read-only `POST /leads/search` |
| Board data | `POST /api/tenant/crm/v1/leads/board` — independent 50-record page per stage |
| Board column paging | `POST /api/tenant/crm/v1/leads/board/stages/:stageId` |
| Board axis | Lead-stage catalogue, by `sortOrder` |
| Move | `POST /api/tenant/crm/v1/leads/:id/stage` |
| Capabilities | `GET /api/tenant/crm/v1/leads/capabilities?branchId=` |
| Card write | `PATCH /api/tenant/crm/v1/leads/:id` — `rating`, `cardColor` |
| Card activities | `GET` + `POST /api/tenant/core/v1/activities` — **Core's**, not CRM's |
| Default view | `board` |
| Board card fields | Type icon/badge · company/person name · primary-contact name (corporate) · tag chips · activity mark · 0–3 rating · owner initials · overflow menu |
| Card View fields | Board identity plus country flag/name · company/person phones and call/WhatsApp/Telegram actions · email · primary contact name/position/email/phones/compact Primary badge · source avatar/name · bottom-anchored `PQ`/`SO`/`IN`, salesperson, rating and activity block |
| Card View selection | None — no per-card checkbox and no Select All |
| Column bar | Next-activity buckets — overdue / today / upcoming / none — over the cards **loaded** in that column |
| Table density | Compact — 32px header, 36px minimum rows and reduced horizontal padding |
| Table columns | Lead + type · Primary contact/email · Phone + call/WhatsApp/Telegram · Country · Stage · Source · Salesperson · Rating/activity · Actions |
| Table interactions | Lead, Contact and Phone cells open the Lead · rating stars update the Lead · activity opens the shared modal |
| Sortable | `createdAt`, `updatedAt`, `name` |
| Filters | `leadProfileType`, `status`, `stageId`, `stageFlag`, `acquisitionSourceId`, `ownerUserId` |
| Terminal stages | Any stage whose flag is `CONVERTED` or `DISQUALIFIED` |

**Tags** render as `TagChip`s under the contact name — sentence case, never
the `Badge` primitive, which states a record's *state* and says so in
uppercase semibold. A tag is a value the tenant chose, and **a coloured tag
draws its own background/text pair** (changed 2026-09-24): the chip's
background and text are the tag's `backgroundColor`/`textColor`, so the pair's
contrast is the pair's own — every preset clears 4.5:1 and a weaker custom pair
is flagged when it is chosen (see [tokens.md](tokens.md#tag-colours--a-pair-the-tenant-owns)). An
**uncoloured tag stays the neutral theme-aware chip** (`bg-muted/60`,
`text-muted-foreground`). The name is always the text, so nothing is carried
by hue alone. The row is capped at
three plus a `+N` chip that names the rest to a screen reader — a lead may
carry fifty (`MAX_TAGS_PER_ATTACH`), and a card that grew a line per tag would
be a different **height** from its neighbours, which is what the windowed
column measures its rows against.

**The activity mark is a control.** It is lucide `Activity` — a pulse line,
not `Zap`: these are activities with a due date, and a lightning bolt reads as
energy or as something instantaneous. Pressing it opens a dialog split into
two halves — this lead's `PLANNED` activities, and a form that books one more
— stacked below `md` rather than squeezed. It renders in `WorkspaceCard`'s
footer, outside both the activation surface and the drag handle, so it neither
opens the lead nor starts a drag. Its accessible name carries the bucket in
words as well, because the mark's colour is the only thing separating
"overdue" from "due today".

Activities are **Core's** resource. `POST /api/tenant/crm/v1/activities` files
`DONE` rows — a log of what happened — so planned work goes to Core's route,
which is `idempotent: true` in the Gateway contract and therefore refuses a
write without a UUIDv7 `x-idempotency-key`. One key per Save press, reused
across the transport's retries of that press — `lib/api/idempotent-write.ts`,
rule 1. A fresh key per retry books the activity twice. A successful create re-reads
both halves: the dialog's list, and the board, whose `nextActivity` bucket the
server owns.

**One Lead Small density — updated 2026-09-07.** Scope this to
`/crm/leads/[id]` and its company/contact/activity edit modals, not the entire
portal. Use `gap-2` (8px) between cards and `p-2` within card headers/bodies;
field rows use `gap-y-1` and 24px minimum read-value height. Card headings use
`text-sm`; labels and body facts retain readable `text-xs` (13px English,
14px Arabic). Controls and action buttons use `sm` (28px), identity avatars
24px, and Details textareas start at two rows and remain resizable. Mobile
inputs retain 16px text to avoid focus zoom. Keep Contacts at full column width
with two equal person cards per row at `sm` and above; keep the commercial
registration label's intrinsic width and single-line text.

Shared `DetailSection`, `Timeline`, `ActivityList`, `AttachmentList` and
`FormModal` opt in with `density="compact"`; their standard defaults are
unchanged elsewhere. Company/contact modal sections inherit the modal density,
including through its portal. No CSS zoom, root scale change, hidden content,
or permission/write-contract change is part of this density setting.

Phone actions use the local [ContactChannelIcon](icons.md#contact-channel-marks)
component: a solid green call glyph and the authentic colored WhatsApp and
Telegram marks. Preserve the existing `tel:`, `wa.me`, and `t.me` destinations.
The third action currently targets Telegram, not Instagram; an Instagram
action requires a real account URL and must never disguise a Telegram link.

**The detail screen is a pipeline bar over the main cards and a tabbed end rail.** Top to bottom: the
`StageBar` the card view draws, marking the stage this lead stands in
(`aria-current="step"`, no "every stage" step) — and **pressing another stage
moves the lead**. Same `POST /leads/:id/stage` the drag calls, same
`capabilities.update` gate, and the same refusals: a `CONVERTED` lead does not
move, and `CONVERTED` is not a destination — conversion owns that stage, so its
step is drawn and inert rather than dropped from the pipeline. Without the
update capability the bar has no handler at all and is simply a picture. This
is the board's `dragging-alternative`, on the record's own screen.
Then the start cards: **Company → Contacts → Details** on a corporate lead,
and **Contacts → Details** on an individual lead. Company contains the company's
name, tax number, phones, commercial registration, email, website and location;
it never repeats the contact people. Company and each contact stay read-only
on the page; their top-end pencils open separate prefilled edit modals.

Its grid is **four columns — label, value, label, value** — so a row carries two
pairs and the label sits BESIDE its box, not above it. That is why it does not
use `DetailSection`, which stacks the label over the value: right for a column
of read-only facts, and twice the height it needs for a form. Each label track
uses `max-content`, while value tracks use `minmax(0,1fr)`; each field is a
`col-span-2` cell on `grid-cols-subgrid`, keeping the label/value columns aligned
across rows. Below `sm` the pairs stack to one label/value column, still side by
side. Company field groups need not be exactly equal width; the separate
Contacts cards retain their 50%/50% layout.

The commercial registration label has enough intrinsic column width for the
full **Commercial registration number** on one line (`whitespace-nowrap`). Keep
its original `text-xs` size and normal weight: enlarge the available label
space, not its font, and do not insert a line break. This applies in Arabic too.
The stored registration number and modal form label remain unchanged.

**Edit in a modal, never inline** (updated 2026-09-07). The Company pencil opens
a centred `FormModal` containing only company fields and its address, never
contact people. Save sends one PATCH carrying only changed fields; a changed
phone array or address travels whole. Invalid fields keep the form open with
inline errors. Cancel/close/Escape use the dirty-discard guard; untouched Save
sends nothing. The page remains a read-only summary behind the modal.

Company address editing uses the Lead DTO's `LEGAL` upsert. Other address types
remain read-only with an explanation. The DTO cannot remove a whole address,
so a fully cleared address is rejected locally rather than pretending it saved.

Its phone list is the one block that is text even in read mode for a second
reason: a number carries a call, a WhatsApp and a Telegram action beside it,
because that is what it is used for a hundred times for every once it is
corrected. **View mode shows the whole number in one piece; edit mode is where
it comes apart** into the shared `CrmPhoneNumberInput`'s country code and
national number inside the modal. The card's read-mode actions remain behind
the modal and are not editing controls. Both forms come out of the same
`splitPhoneNumber`, so `00201050049899` and `+20 105 0049 899` display alike and
split alike; a second implementation in the row would drift from the editor's
the first time either changed. WhatsApp and Telegram are offered only for a
number that carries a calling code, because both resolve their path as an
international number and `wa.me/010…` opens an error page rather than a chat.
`companyPhones` is an array field, so the list is always sent whole.

Edit mode always shows at least one phone row, plus **Add a number** and a
per-row remove — bounded by the same `@ArrayMaxSize(10)` and `@MaxLength(32)`
`CrmPhoneListField` enforces, exported from it so the two cannot disagree. The
seeded row is what lets a company with no number on file be given one; a row
left blank is dropped before the request is built, so it costs nothing when it
is not used, and a row emptied on purpose is how a number is deleted. A row
added to a company that already has numbers opens on THEIR calling code rather
than on an empty picker or the reader's own locale — a second number for a
company in Egypt is an Egyptian number almost every time.

**Contacts is one full-width (100%) outer card**, separate from Company, with a
single **Contacts** header above the entire collection. Inside it, each person
occupies 50% of the available row, minus the shared gap, from the
`sm` viewport breakpoint (`40rem` / 640px). Only smaller viewports stack the
cards; the narrower main column beside History must not switch desktop contacts
back to one column. More people continue onto subsequent rows. Person cards do
not repeat the Contacts header. Their first label/value row is **Full name**,
followed by job title, all phone numbers and email. The primary marker sits beside
the full-name value when applicable; that person's pencil is at the inline end
of the first row. The person's name is not a heading and is not split into
first/last-name rows. The outer header remains visible for an empty collection.
There is no collection-wide editor and no duplicate person inside Company.
The same outer/inner-card structure applies to individual leads.

Company, Contacts and Details are sibling sections. Their React keys include
both the section role and the lead ID (`company:…`, `contacts:…`, `details:…`),
never the bare lead ID shared across siblings. This preserves section identity
on refresh and resets edit drafts when navigating to another lead without
duplicating or dropping cards. Individual contact keys remain their party IDs.

A contact pencil opens one prefilled modal for **that person only**. It includes
the supported person DTO fields and lead relationship fields, with explicit Save
and Cancel. Name/email/phone edits use the person's existing Directory identity
and contact-method IDs; they require Directory read + party manage + contact
manage grants. Without those grants, identity remains readable with an
explanation while lead job title/primary edits remain available. Shared identity
effects are explained in the modal. No person is recreated or unlinked.

Core person/method updates and the CRM relationship update are separate writes,
not one transaction. Partial or uncertain results block resubmission and require
an explicit reload; the UI never announces complete success for a partial save.
Changing a primary necessarily updates selection across the preserved lead list.
For an individual lead, the person's own modal edits the supported Lead fields.
All edit controls require the lead update capability and a non-converted lead.
See [the contact write contract](../api/crm-leads.md#contacts-on-the-one-lead-screen).

**Details** (updated 2026-09-07) displays Source with its catalog icon/name,
the lead's Tags, Sales person as an avatar/name selector, creation date,
immutable Created by with avatar/name, Last updated, then Interest summary,
Expected need and Notes as textareas. Labels stay visible even when a value is
read-only. User images are not exposed by the current Core user response;
the initials fallback uses first/last initials (`Kamal Radwan` → `KR`), never a
fabricated image or raw UUID presented as a name.

Details is **always in edit mode** for a permitted, non-converted lead: source,
sales person and the three textareas are ready immediately, with no Edit pencil.
Save and Cancel stay visible, enabled when there are changes. Save sends changed
fields only; Cancel resets the draft without closing editing. Neither mounting
nor typing saves automatically. Clean forms follow fresh server values; unsaved
drafts survive unrelated lead refreshes. An uncertain save blocks resubmission
until the lead is re-read. Timestamps, creator and tags remain read-only, and
missing capability or conversion still prevents edits. Preserve an assigned
owner. Only an unassigned lead may suggest the current user in its open draft,
and no assignment is saved on mount. Other owner names/options require
`users.user.read`; the list is active users in the lead's branch, filtered by
the CRM capability's owner boundary, with server validation remaining decisive.
Tags are read from the lead tags endpoint; a failed read is not an empty tag
set. Notes here maps to the lead's `description`, not the separate notes ledger.
The standalone Notes card is not mounted on this page; removing that UI does
not delete, migrate or merge any existing notes-ledger entries.
**End rail — updated 2026-09-07:** a full-width header has three equal icon-only
tabs: **History → Activities → Attachments**. History is selected by default
and resets when navigating to another lead. Each icon has a localized accessible
name and tooltip (`title`); use the shared keyboard-operable `Tabs`, including
RTL direction. Main record cards stay visible; these are rail tabs, not page tabs.
On narrow screens the rail stacks below the main cards.

History uses the shared audit template. Its card header contains
only the title, without the introductory "Everything recorded against this record,
newest first." sentence. Timeline entries and empty/error feedback remain unchanged.
Returning to History remounts its reader; committed lead changes still pass the
whole `lead` object as the refresh token and preserve related Party IDs.

Activities is the shared `RecordActivitiesPanel`
([the activity template](patterns.md#the-activity-template)), the same panel the
customer-profile and opportunity side panels render. It lists the record's
**open activities** (`PLANNED` and `IN_PROGRESS`), soonest due first, through the
design-system [`ActivityList`](patterns.md#activitylist); do not copy its markup
into another screen. **New activity** opens `ActivityModal` with the record
fixed; a row opens that activity; each row's menu offers Edit, Mark as done and
Cancel only where the actor may perform them on that activity. **View all
activities** opens the Activities workspace's table filtered to this record,
across every branch. Successful writes reload the open list, and so does a
write whose answer was lost or whose unknown outcome the user dismissed.

Attachments contains the record's full attachment list, with **Add attachment**
above it and a named download icon for every file. It uses
`RecordAttachmentsSection` with `uploadVariant="button"`, not a second upload
implementation. Add opens the native file picker; the existing MIME/25 MiB
validation, upload queue, error/uncertainty handling and permission-gated delete
confirmation remain. No duplicate attachments card appears in the main column.

Activities and Attachments load only on their first visit, then remain mounted
but hidden while inactive so switching tabs cannot lose a pending upload or
uncertain outcome. Only the selected panel is visible/reachable. Readers follow
all pages (25 activities / 50 attachments per request); an incomplete, malformed
or duplicate page produces an error rather than a falsely complete list.

**The location and the contact list arrive with the lead.** `GET /leads/:id`
returns `address` and `contacts[]` as part of the record — `LeadDetailReadModel`,
two correlated sub-selects folded into the query that already fetched the lead.
Read-mode cards make no extra Directory read for these values. Opening a
corporate contact editor performs a permission-gated fresh person read, and
the board list does not carry them: two aggregates per row that no card draws.
`contacts[]` is not `primaryContactName` — that is one string for the board
card's second line, and this is the people with their own data.

**The history card reads as a story, not a row dump.** Its compact header is the
actor beside the timestamp — `Kamal Radwan 07/09/2026 02:44 AM` — without an
action label such as `Stage changed` and without repeating the actor below.
The ledger's `diff` renders each change as one unboxed line —
`Stage category: New > Contacted` — with no `Changes`, `Old value`, `New value`
or reference text. The old value is light red and struck through; the new value
keeps the normal foreground. The comparison stays old-to-new on both LTR and
RTL pages. It takes the server's precomputed diff so a redacted value stays
redacted; and the timestamp is
`formatDateTimeNumeric` — `06/09/2026 08:01 AM`, day first in both languages,
because a log is read by comparing rows and a month name is a different width
in each.

One Lead aggregates Lead, company/person Party and current contact Party history
in one Core request. Related field lines are prefixed with a direction-isolated
subject label, such as `Saly Essam · Phone: 0100 > 0200`, without new cards or
headings. Empty historic evidence has an explicit localized unavailable message;
it must not be replaced with today's values. A committed save refreshes the
timeline even when the Lead timestamp is unchanged, and stale page requests are
aborted. See [the API contract](../api/core-directory.md#related-party-history).

The header block is `sr-only` for the reason the list's is: the bar above
already names the record and carries Convert (no page-wide Edit), and the `<h1>` is still
the document's outline.

**The detail screen puts four counts in the action bar's middle.**
`LeadRelatedNav` fills the shell's `related` slot with a link per resource —
opportunities, quotations, sales orders, invoices — each carrying the number of
records behind it.

| Count | Joined on | Route |
| --- | --- | --- |
| Opportunities | the LEAD (`leadId`) | `POST /crm/v1/opportunities/search` |
| Quotations · Sales orders · Invoices | the lead's PARTY (`partyId`) | `GET /trade/v1/…?partyId=&limit=1` |

**The two joins are not interchangeable.** An opportunity is filed against the
lead. A trade document has never heard of a lead — it is filed against a party,
and the lead's own `partyId` is that party, the same row the directory holds
and conversion promotes rather than replaces. Filtering opportunities by the
party instead would answer a different question: every opportunity that party
has ever had.

Four services, four permissions, four independent reads. A CRM user with no
Trade access is the ordinary case, so each count settles alone and a refused
one stays `null` — rendered as a **dash, never a zero**, because "no invoices"
and "the count did not come back" are different sentences and the second one
printed as `0` is a number somebody would act on. A kind the user may not read
draws no link at all; all four unpermitted draws nothing, and the bar's middle
stays empty. Only `trading.invoices.get` declares `BRANCH_REQUIRED`, so the
scope headers go to that one route and to nothing else.

**Each planned row carries three actions**, in one overflow menu rather than
three icons — this half is a column inside a dialog, and three 24px targets
beside a priority badge would either wrap or shrink under the touch floor.

| Action | Route | Permission |
| --- | --- | --- |
| Edit | `PATCH /activities/:id` | `activities.update` |
| Mark as done | `POST /activities/:id/complete` | `activities.complete` |
| Discard | `POST /activities/:id/cancel` | `activities.cancel` |

Three things this depends on:

- **The row's `version`, sent as `If-Match`.** All three routes require it —
  Core answers 428 without one and 409 against a stale one — so the list parser
  reads `version` and refuses a row that has none. A row whose Edit and Discard
  could only ever fail is not a row worth rendering.
- **Edit reuses the form half.** The same fields, a different heading, and the
  footer reads *Save and mark as done · Cancel · Save*. Cancel leaves the mode,
  not the dialog: the list the dialog exists to show stays on screen, and the
  dialog's own Close is one more press away. **Save and mark as done is two
  writes**, and the second uses the version the FIRST one returned — reading it
  back out of list state would send the version from before the save.
- **The past-due rule relaxes on edit, exactly as the server's does.**
  `ActivitiesService.update` re-checks the due date only when it moved, so an
  overdue activity can still have its subject corrected. The client validator
  takes the row's own `dueAt` for that comparison rather than refusing a save
  the server would have accepted.

Discard confirms first; completing does not. Both make the row leave a
`PLANNED`-only list, but one of them is the outcome the work was booked for and
the other ends it — and the two sit one menu row apart.

### Customer Profiles

| | |
| --- | --- |
| Hooks | `useCustomerProfiles()` for Card/Table · `useCustomerProfileBoard()` for Board |
| **Board data** | `POST /api/tenant/crm/v1/customer-profiles/board` — first 50 per status |
| **Board continuation** | `POST /api/tenant/crm/v1/customer-profiles/board/statuses/:status` |
| **Card/Table data** | `GET /api/tenant/crm/v1/customer-profiles` or read-only `POST …/search` |
| Board axis | `CustomerStatusEnum`, fixed order |
| Move | `PATCH /api/tenant/crm/v1/customer-profiles/:id` — `{ status }` |
| Capabilities | `GET /api/tenant/crm/v1/customer-profiles/capabilities?branchId=` |
| Default view | `board` |
| Board fields | Display name/type · corporate primary-contact name · tags/source · owner avatar/name · rating/activity · card colour |
| Card fields | Type icon · display name · type/status · tags · city/country + flag · phones/actions · email/website · corporate primary contact · source · `PQ`/`SO`/`IN` · owner avatar/name · rating/activity · card colour |
| Table columns | Customer/type/tags · Contact name/position/email · Phone/actions · Location · Status/rating · Source · Salesperson · Activity · Actions |
| Sortable | `displayName`, `createdAt` |
| Filters | Basic identity tokens plus Advanced `profileType`, `status`, `rating`, `cardColor`, `acquisitionSourceId`, `ownerUserId`, tags and dates |
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
| Card fields | Title/status · customer + primary contact · phone actions · city/country · source · tags · amount/currency · probability · expected close · owner avatar/name · `importance` stars · activity · `PQ`/`SO`/`IN` |
| Table columns | Opportunity/status · Customer · Contact · Phone/actions · Country · Deal value/probability · Stage · Source · Owner · Expected close · Importance/activity · Actions |
| Sortable (table only) | `title`, `amount`, `probabilityPercent`, `expectedCloseDate`, `createdAt` |
| Filters | semantic text, tags, `pipelineId`, `stageId`, `stageFlag`, `status`, `customerProfileId`, `ownerUserId`, `importance`, `cardColor`, `expectedCloseFrom`, `expectedCloseTo` |
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
- Card and list rows retain each opportunity's exact decimal `amount`, currency,
  probability and expected close date. The board also returns
  `stage.summary.amountsByCurrency` for authoritative per-stage totals. Render
  each currency separately and never add across currencies in the browser.
- Each column also carries `activitySummary` with `overdueCount` — surface it,
  it is the most actionable number on the board.
- `ownerAvatarUrl` is a safe, cache-busted server path. Render as given.
- `GET /opportunities` enriches every list row with customer/contact identity,
  source, owner name/avatar, activity and tags. Table view renders those values
  directly and keeps the customer link on the real customer-profile id.

### Activities — the time-based workspace

Added **2026-09-24**. One `<ActivitiesWorkspace scope />`
(`src/components/activities/workspace/`) serves both routes, over Core's
activity hub. It hosts the page's one template `ActivityModal` and one
`ActivityOutcomeDialog`; hooks hold the state and the reads
(`workspace/hooks/`), components hold the markup.

| | |
| --- | --- |
| Routes | `/crm/activities` (scope `CRM`: every read carries `targetApp=CRM`, and the record picker offers CRM record types only) · `/core/activities` (scope `ALL`) |
| Views | `calendar` · `board` · `table` — no card view |
| Default view | `calendar`, persisted per scope — `useWorkspaceState("activities-<scope>", { views })` |
| Branch | `TenantBranchSelect allowAll` over `useTenantBranchSelection(user, { optional: true })`: **optional** here, and the workspace opens on "All accessible branches" — no `branchId`, every branch the viewer can see — so a record's "View all" finds it whichever branch it sits in. A chosen branch narrows every read and the modal's record picker |
| KPI strip | `GET /api/tenant/core/v1/activities/summary` — see [the KPI strip](#activities-the-kpi-strip) |
| Calendar data | `GET /api/tenant/core/v1/activities/calendar?from=&to=` for `calendarRange(mode, anchor, weekStartsOn)`; at most 500 items, and a `truncated` answer puts a notice in `toolbarEnd` |
| Board axis | `ActivityStatusEnum`, fixed: `PLANNED` · `IN_PROGRESS` · `DONE` · `CANCELLED` — each lane pages `GET /activities?statuses=<status>` |
| Move | `PLANNED` ↔ `IN_PROGRESS`: `POST /activities/:id/status`, optimistic with rollback. Into `DONE` / `CANCELLED`: through `confirmMove` to the complete / cancel dialog. A finished activity never drags |
| Table data | `GET /api/tenant/core/v1/activities`, 25 a page, sorted by `dueAt` on the server |
| Filters | search, type, status, priority, assigned to me, overdue only, due date — the due-date range is hidden in the calendar, whose navigation owns the range |
| Due-date presets | `today`, `thisWeek`, `next7Days`, `next30Days`, `thisMonth`, `last7Days`, `last30Days`, with `weekStartsOn: calendarWeekStart(language)` — see [primitives.md](primitives.md#daterangepicker-presets) |
| Calendar chip | Type icon ([icons.md](icons.md#activity-types)) · time · subject · related record; toned by due state, never by type |

The status filter narrows the board's columns as well as its cards: a status
nobody asked for is not drawn as an empty lane.

#### Activities: the URL

Every key below belongs to the workspace; `view`, `page`, `sort` and `dir`
stay `useWorkspaceState`'s. A filter or search change also drops `page` — a new
result set starts on page 1 — and touches nothing else.

| Key | Holds | Notes |
| --- | --- | --- |
| `q` | the search | trimmed and capped at 200 characters on the wire |
| `types` · `statuses` · `priorities` | comma lists | read in enum order; an unknown value is dropped, not an error |
| `mine` · `overdue` | `true` | a switched-off filter is removed, never stored as `false`; `mine` sends the viewer as `assigneeUserId` |
| `from` · `to` | local days, `yyyy-MM-dd`, inclusive | sent as `dueFrom` = where `from` begins locally and `dueTo` = where the day **after** `to` begins (`dueTo` is exclusive). A reversed pair is ignored. Not applied in the calendar |
| `targetApp` · `targetType` · `targetId` | the deep link a record screen hands over | one removable chip: "Related to: Leads" for a record type, "Related record: Lead" for one record. The type must be in `ACTIVITY_TARGET_TYPES` for the page's scope (CRM types only on `/crm/activities`); anything else is ignored, and an id that is not a record id narrows to the type alone. Removing the chip drops all three |
| `cal` | `week` · `day` | absent is `month` |
| `date` | the calendar's anchor day, `yyyy-MM-dd` | absent is today, so paging back to today leaves a link that still means "today" tomorrow |

**Writes go through `replaceSearchParams`**, the same live-query writer as the
view, the page and the sort ([View state](#view-state)): the calendar's two
same-event callbacks ("+N more" calls `onAnchorChange` and then `onModeChange`)
each build on the other instead of the second dropping the first.

Two helpers build links into the workspace: `activitiesWorkspaceHref(target)`
(`activity-presentation.ts`) for one record — the detail panels' "View all",
which opens on `view=table`, because a record's activities span its whole
history and a month of calendar shows only part of it — and
`activitiesWorkspaceTypeHref(scope, { app, type })`
(`workspace/activity-workspace-url.ts`) for every record of one type, which
leaves the view to the viewer's own last choice.

#### Activities: the KPI strip

`GET /activities/summary` for the viewer's own day — `dayStart` is where today
begins locally and `dayEnd` where tomorrow does, which Core cannot know — under the same
filters as the view on screen **minus `statuses` and `overdue`**: either would
zero the other three counts. Open is `PLANNED` or `IN_PROGRESS`.

| Card | Counts | `StatCard` tone |
| --- | --- | --- |
| Overdue | open, and its end — or its due time, when it has no end — has passed | `danger` |
| Due today | open, not overdue, due before `dayEnd` | `warn` |
| Upcoming | open, not overdue, due at or after `dayEnd` | `neutral` |
| Completed today | `DONE`, completed between `dayStart` and `dayEnd` | `brand` |

An ellipsis holds each value until Core answers. A failed summary shows `—` in
every card and a `DegradedBanner`; it never holds up the views.

#### Activities: the three views

**Calendar.** Month by default. It reads exactly `calendarRange(mode, anchor,
weekStartsOn)` with `weekStartsOn = calendarWeekStart(language)`, the value the
due-date presets use too, so "This week" and the week view agree. An item opens
the modal on its view screen; an empty slot opens it on create with that start
— offered only with the create grant, and otherwise not at all. The chip's
surface takes a coloured leading edge for overdue (`destructive-vivid`), due
today (`warning-vivid`) and completed (`success-vivid`); a cancelled item is
muted and struck through; one in progress carries the pending dot. The item's
accessible name spells all of it: subject · type · when · status · due state ·
related record.

**Board.** Lanes `PLANNED` · `IN_PROGRESS` · `DONE` · `CANCELLED`, narrowed by
the status filter. Each lane is its own `GET /activities?statuses=<status>&page=n&limit=25`,
`sortDir=ASC` for the open lanes (soonest first) and `DESC` for the finished ones
(most recent first); the first page of every lane is read together, so the board
is whole or an error, and "Load more (loaded of total)" pages one lane. A card
moved into or out of a lane shifts Core's pages under the loaded ones, so that
lane is marked `shifted` and its next "Load more" reads it again up to the next
page — pages 1…n+1 — instead of asking for page n+1 alone, which would skip the
card that slid back across the page boundary. The count is the lane's total. `DONE` carries the positive outcome border and
`CANCELLED` the negative one; the open lanes carry a due-state bar from
`summary.byStatus` — overdue, due today, upcoming as negative, caution,
positive — which counts the whole lane rather than the cards loaded, so its
label says "this column's open activities". Under "Overdue only" it keeps the
overdue slice alone.

| From → to | Needs | What happens |
| --- | --- | --- |
| `PLANNED` ↔ `IN_PROGRESS` | `activities.update` | The card moves at once and `POST /activities/:id/status` runs; Core's copy replaces the card and the KPIs are read again. A refusal moves it back and toasts |
| open → `DONE` | `activities.complete` | `confirmMove` opens the complete dialog. Nothing moves until Core has completed it; then the lanes and the KPIs are read again |
| open → `CANCELLED` | `activities.cancel` | The same, through the cancel dialog, whose reason is optional |
| `DONE` / `CANCELLED` → anything | — | Never: a finished activity neither drags nor offers "Move to…" |

Each grant is the base permission on an activity the viewer is assigned to or
created, or the base permission **and** its `.all` scope on any: the route's
guard matches the base key exactly, so `.all` alone opens nothing. `canMoveTo` gates "Move to…", and
`confirmMove` checks a drag against the same rule, because the board does not.
A card shows the type glyph and subject (struck through when cancelled), the
related record, when with its due state in words, the assignee ("Me", the
name, or the identifier), and a caution badge for `HIGH` / `URGENT` only.

**Table.** `TableView`, compact, 25 a page. **When** (`dueAt`) is the one
sortable column, sorted on the server. Columns: Activity (glyph + subject),
Related to (a link for leads, customers and opportunities, a label otherwise or
once the record is gone), Assigned to, When (+ due state), Status
(`StatusBadge kind="ActivityStatus"`), Priority (a caution badge for `HIGH` /
`URGENT`, plain words otherwise), and the actions menu. A row opens the modal;
the link and the menu inside it stop the row's own activation. A page left past
the end — its last rows completed or filtered away — moves to the last page
there is.

**The actions menu**, on every card and row: View, Edit, Start or Move back to
scheduled, Mark as done, Cancel activity — each present only when the viewer may
take it on that activity, and every menu waits while a write is in flight **or
its outcome is unknown**.

#### Activities: writes and states

- Every successful write toasts and reads the KPIs and the view on screen again,
  **keeping what is on screen until the new answer lands** — a board does not
  blank out each time a card is completed. A refusal is a toast (a 403 is the
  transport's own); an unknown outcome stays in the body as an
  `AmbiguousOutcomePanel` until it is retried with the same key or dismissed —
  [patterns.md](patterns.md#where-a-result-belongs). Until then no other write
  starts on the board or in the menus (drags and menus are disabled), so a
  later write can never take its place and lose its key; reads — filters,
  views, the branch — go on.
- `useRealtimeResync` reads the KPIs and the view again on a resync signal.
- Only the view on screen reads. A 403 on its read replaces the workspace with
  `PermissionGate`'s denied state; a failure is `ErrorState` with a retry; each
  view loads behind its own skeleton; every state owns the pane's height.
- Empty is two answers: filters on → "No activity matches these filters" with
  **Clear filters**; nothing at all → "No activities yet" with **New activity**
  where the viewer may create. The calendar floats a compact notice over its
  grid instead, and says "Nothing scheduled in this period" when the period is
  empty but the summary counts activities elsewhere.

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
- The calendar grid is one tab stop; the arrows move by day and by time, and
  follow the screen under RTL. Its range title is a polite live region.
- Every calendar item's accessible name carries its time and state in words —
  the grid shows the time only by position.

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
