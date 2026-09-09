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

See [shell.md](shell.md#it-holds-the-screens-controls).

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
and on Leads it writes the same single filter the search bar's Stage field
writes, because the endpoint answers one filter at a time.

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
| Card write | `PATCH /api/tenant/crm/v1/leads/:id` — `rating`, `cardColor` |
| Card activities | `GET` + `POST /api/tenant/core/v1/activities` — **Core's**, not CRM's |
| Default view | `board` |
| Card fields | Company name (contact name beneath, corporate only) · tag chips · activity mark · 0–3 rating · owner initials · overflow menu |
| Column bar | Next-activity buckets — overdue / today / upcoming / none — over the cards **loaded** in that column |
| Table columns | Name · Type · Stage · Status · Owner · Source · Branch · Created · Actions |
| Sortable | `createdAt`, `updatedAt`, `name` |
| Filters | `leadProfileType`, `status`, `stageId`, `stageFlag`, `acquisitionSourceId`, `ownerUserId` |
| Terminal stages | Any stage whose flag is `CONVERTED` or `DISQUALIFIED` |

**Tags** render as chips under the contact name — sentence case on
`bg-muted`, never the `Badge` primitive, which states a record's *state* and
says so in uppercase semibold. A tag is a value the tenant chose, so its
optional colour is a leading dot rather than the chip's own background: the
name is beside it, so nothing is carried by hue alone, and every chip stays on
one background pair whose contrast is already known. The row is capped at
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
across the transport's retries of that press — `crm/shared/crm-write.ts`,
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

Activities shows **all open (`PLANNED`) activities**, soonest due first, using
the same compact cards as the lead card-view activity modal. Both consume the
reusable design-system [`ActivityList`](patterns.md#activitylist) through
`LeadActivityList`; do not copy its markup into another screen. Each card has
subject, priority, type, due date and the existing permission-gated row menu:
Edit opens the existing modal prefilled with that row, Mark as done completes
it, and Discard confirms cancellation. Successful writes reload the open list.

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
