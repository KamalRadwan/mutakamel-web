# The Three-View Contract

Status: **Specification**

Written: **2026-08-27**

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
  [api/crm-leads.md](../api/crm-leads.md#capabilities).
- **Empty / error / forbidden / loading.** `EmptyState`, `ErrorState`,
  `PermissionGate`, `Skeleton` — rendered by the workspace, above the view.
- **Bilingual and themed.** Every view, in both languages and both themes.

## View state

```ts
export type WorkspaceView = "board" | "card" | "table";
```

- **URL is the source of truth**: `?view=board`. Deep links and refresh must
  land on the same view.
- **Per-screen persistence**: on change, write
  `localStorage["tenant_view_<screen>"]`. On mount with no `?view` parameter,
  restore from storage, else fall back to the screen default.
- **Defaults**: Leads → `board`. Opportunities → `board`. Customer
  Profiles → `table` (a customer list is a directory, not a funnel).
- Storage reads and writes go through `safeStorage` and must survive a throwing
  or absent `localStorage`.

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

**Column body.** Virtualized above 50 cards. Empty column shows a dashed
`border-border` drop zone with the translated "Drop here" label — never a
blank space, which reads as broken.

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

**Card content** is per-screen; see the table at the end of this file.

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

Each card is `surface.base` — border, no shadow — `rounded-md`, `p-3`.

Card view is the **sortable** view: a sort control appears in the toolbar only
when `view === "card"`, offering the entity's sortable fields. Sort state goes
in the URL (`sort`, `dir`).

Same card renderer as the board, at a wider measure. Cards are focusable, and
`Enter` opens the detail route.

## Table view

```
src/design-system/views/table/TableView.tsx  →  wraps DataTable
```

Not a hand-rolled `<table>`. It configures `DataTable` — see
[patterns.md](patterns.md#datatable) — which already owns sticky headers,
column sizing, row selection, sorting, pagination, keyboard navigation, the
40px row height, and the zebra row token.

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
- Board drag has a working, translated keyboard path.
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
