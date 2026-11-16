# CRM — Dashboards & Widgets

Status: **verified**

Last source verification: **2026-11-03**

Current execution-field review: **2026-11-05** (source and focused tests;
authenticated rendering is a separate acceptance gate). Series preserve nullable
values, paired comparison keys/values/windows and XY size. Current widget states
are `READY`, `EMPTY`, `UNAVAILABLE`, `RETIRED`, `FAILED` and
`DEADLINE_EXCEEDED`; unavailable/retired/failed results do not render numeric
content. A missing point is never an invented zero.

Source readiness verified **2026-11-09**. When one resource's team coverage
projection is unavailable, its affected widgets return `UNAVAILABLE` with
`CRM_TEAM_SCOPE_NOT_READY`. Widgets with independent, resolved source authority
can still run. A dashboard-wide scope admission failure returns the source error
for the entire request.

Dashboard runtime team and owner selection verified in source and focused tests **2026-11-10**.
Widget library search, source classification, owner options and filtered paging verified in source and focused tests **2026-11-10**.

CRM-ACT-003 retires metrics backed by CRM tasks, calendar events and reminders.
The catalogue marks them `availability: RETIRED`; the builder excludes them.
Stored widget runs return `state: RETIRED`, null value and empty series/rows;
the portal shows a translated retirement message and disables drill actions.
New widget queries and clones reject retired metrics, and new templates omit them.
The fixed-report sections `overdueWork`, `overdueTasks`, `repWorkload`,
`reminderSummary` and `calendarUtilization` now return `{ state: "RETIRED" }`.
The builder's `crm.tasks.overdue.count` remains live through Core's projection.

Widget rendering boundary verified: **2026-10-17** (FE-CRM-DASH-001).

Dashboard labels reviewed: **2026-10-18** (FE-CRM-DASH-010).
Tile errors and warnings show translated messages, with generic translated
fallbacks for unknown codes; raw codes are not displayed. Alert severity,
histogram bin labels, heatmap weekdays and target comparisons use the
Arabic/English dictionaries. Unknown visualization, entity, reason and activity
types use generic translated labels. The activity feed reflects the last run
and carries no live-update badge. Template labels remain catalogue-supplied,
and currency options retain the tenant's ISO currency codes.

Scalar KPI and dashboard access behavior reviewed: **2026-10-18**
(FE-CRM-DASH-006, including FE-CRM-DASH-004). Scalar KPI cards show the
returned value, the existing comparison badge when a previous value is
available, and progress when a target is supplied. They do not draw a trend
curve from scalar values. A dashboard-detail 403 renders the permission-denied
state even when the session still holds the route-level read grant.

Fixed-report security contract verified: **2026-10-17** (CRM-DASH-001).

Dashboard filter behavior reviewed: **2026-10-18** (FE-CRM-DASH-007).
Unset date and comparison controls display “Dashboard default”; unset currency
displays “All currencies”. They send no filters on the initial run. Currency
options come only from the run's available currencies, and branch options must
match the session's accessible branch ids, including when that list is empty
or has no match. A single dashboard switcher lives in the filter bar. The
default dashboard and report explorer show their own page headings and actions.

Owning app: **crm-app**

Dashboard Settings redesign verified: **2026-11-03** (approved item 10).
Definitions use full-width CRM Analytics navigation, a visible page header and local search
over loaded cursor pages. There is no branch filter, invented total, row-number
column, publish, export, or schedule action on this list. Personal default and
favorite preferences do not alter the tenant's settings. Templates and dashboard
duplication require both dashboard creation and widget creation; blank creation
requires dashboard creation alone. Names are limited to 120 characters and
descriptions to 500; the owner limit is 50 live dashboards and 500 live widgets.

The working canvas preserves each server placement's 12-column x/y/width/height,
including unavailable placement boxes. The layout editor previews one-unit moves
and resizes of the selected widget against catalogue size limits and occupied
cells. Dragging a row or using earlier/later repacks the draft around hidden
boxes. Save sends the exact draft geometry and the revision captured on entry.
Hidden boxes count toward the 20-placement limit. Removing one placement keeps
its widget definition. Deleting a dashboard also removes its placements/shares
and may remove its unused template-generated widgets; it does not remove other
independent reusable widget definitions. The delete confirmation states this.

Widget authoring workspace reviewed **2026-11-09**. The library opens a dedicated
`/crm/widgets/new` page with exact widget read and create permissions. Editing
opens the same workspace from the widget detail page for owner/edit access with
`crm.widgets.update`. Details, Metrics, Scope and time, Comparison, Display and
Review share one local form state. The review step validates the current catalogue
and links to the affected step when settings are invalid. Preview uses the existing
preview route and requires scoped dashboard read. Create and update use the same
validated mutation receipts and conflict/reconciliation controls as the library.
Successful creation opens the new definition. Navigation prompts before discarding
local changes. This workspace uses the current widget payload.

Metric chooser reviewed **2026-11-10** (source and focused component tests;
authenticated visual acceptance remains separate). Each series opens a centered,
searchable catalogue dialog. Search covers both metric labels, unit, date basis
and CRM data sources without additional requests. Inspecting a row stages its
selection locally; Choose changes only that series' metric key. Cancel, Escape
and dismissal keep the definition intact; reopening restores its current metric
and clears the search. The dialog focuses search on entry and returns focus to
its labelled trigger on close.
The existing form handler still reconciles common dimensions and standalone
comparison constraints after the metric changes.

The parser retains the server's `timeModel`, `dateField` and `accessResources`
semantic metadata. Missing or future time/date values render as unspecified;
they never default to creation date. Current snapshots are explicitly described
as current state. Details show the source-owned unit/date/model, source domains
and compatible catalogue visualizations, without invented formulas or sample
totals. Structural compatibility checks reuse the chart's allowed shapes,
metric-specific chart restrictions and standalone-series rule. Incompatible
metrics remain inspectable but cannot be chosen. This is not a data-access
grant: preview and saving retain their existing authorization and complete-form
validation. Retired metrics remain excluded. Catalogue refresh or a pending
parent mutation rechecks whether the staged metric can be chosen.
Typed row metrics are offered only for their matching row renderer, so an alert
contract is not labelled compatible with a leaderboard or a generic table.

All thirteen source date presets are available. The centered filter dialog stages
branch, period, comparison and currency locally, then submits them together on
Apply. A Custom period needs a valid date pair. Cancel leaves the active run
selection intact. The dashboard switcher remains on the toolbar. Currency options
come from the run and branches match current access. The initial run omits unset
filters. A changed widget, missing drilldown source, or source-access denial
clears old drilldown rows and directs the actor to refresh or return, rather
than retrying a stale cursor. Successful chart tiles remain readable when other
tiles fail. Supported Cartesian/composed charts plot separately labelled units
on their declared axes and include the server-matched previous points. Invalid
unit/axis combinations retain a truthful table boundary. Other chart families
that plot only current values retain matched values in the exact table and state
that limitation.

Mutations acquire a synchronous session-scoped lock before their request and
validate exact-resource receipts before success feedback. Scope changes hide
old data immediately, including an A→B→A authority round trip. Unknown,
malformed, 5xx, or still-processing write outcomes are not repeated
automatically. A successful read followed by explicit review is required to
clear the session-persistent mutation fence; recovery controls are reachable
inside the affected modal as well as in the page. Confirmed writes followed by
a failed refresh receive distinct feedback. Busy and stale results are ignored
without a false permission error. Dirty layout switches, navigation, normal
reloads, and Done/Cancel ask before discarding; conflict/reconciliation reads
keep the open draft. Revision conflicts offer Reload and Cancel, never force
overwrite. Sharing is owner-only with its explicit permission and supports
User/Team, View/Edit, and an optional future expiry; target and existing-share
load failures remain independent.

Dashboard request ordering reviewed: **2026-10-18** (FE-CRM-DASH-009).
Filter reruns and full reloads cancel superseded executions and only the latest
execution may update results, errors or running state. Changing filters clears
the previous run while the next one loads. Drilldowns snapshot the selection
when opened and reuse it with every cursor page. Opening another drilldown,
closing it or changing dashboards invalidates pending drilldown responses.

Dashboard template switcher behavior reviewed: **2026-10-18** (FE-CRM-DASH-008).
Template options and their write handler require `crm.dashboards.create` and
`crm.widgets.create`.
Labels come from `/dashboards/catalog`; owned `sourceTemplateKey` values
determine which templates are already provisioned, regardless of dashboard
names. The switcher reads `/dashboards` because it returns the same accessible
rows as `/navigation` with the template key included. Shared template instances
do not suppress the actor's own template option. Loading failures retain the
last dashboard list, hide template offers and show a translated retry boundary;
a failed `PUT /from-template/:key` shows a translated error toast.

Canonical prefix: `/api/tenant/crm/v1/dashboards`, `/api/tenant/crm/v1/widgets`

Portal source includes **52 Gateway routes** with the `crm.dashboard.` route key prefix. The November 5
execution-field review does not certify authenticated execution or visual
acceptance of the full module. Historical P4/Q17 blockers are not evidence of
the current running tenant's status.

Source inspected:
`crm-app/src/crm/dashboards/dashboards.controller.ts`,
`dashboard-builder.controller.ts`,
`dashboard-widgets.controller.ts`,
`dashboards.service.ts`,
`dashboard-definitions.service.ts`,
`dashboard-execution.service.ts`,
`dashboard-widgets.service.ts`,
`dashboard-shares.service.ts`,
`dashboard-drilldown.service.ts`,
`dashboard-drilldown.strategies.ts`,
`dashboard-access.service.ts`,
`dashboard-catalog.ts`,
`dashboard-openapi.docs.ts`,
`contracts/dashboard-p2-contracts.ts`,
`dto/dashboard-builder.dto.ts`,
`dto/dashboard-drilldown.dto.ts`,
`dto/dashboard-query.dto.ts`,
`crm-app/packages/common/src/constants/permissions.ts`,
`crm-app/src/common/crm-scoped-permissions.ts`,
`api-gateway-app/src/routing-proxy/route-contracts/crm.route-contracts.ts`,
`api-gateway-app/src/common/middleware/route-context.middleware.ts`.

## Two families that share a prefix and nothing else

| Family | Routes | What it is |
| --- | ---: | --- |
| **Prebuilt reports** | 7 | Fixed `GET`s. Each returns a named set of widgets with a **bespoke shape per widget**. Predates the builder |
| **Dashboard builder** | 22 | Dashboards, placements, layout, execution, drill-down, sharing |
| **Widgets** | 12 | Reusable widget definitions, preview, clone, sharing |

They share one permission root and one catalogue. They share no response shape:
a prebuilt report's `widgets` is `{ pipelineValue: {...}, activeDeals: 12 }`,
while a builder run's `widgets` is `{ "<widgetId>": WidgetResult }`.

## Routes — prebuilt reports

| Method | Canonical path | Permission | Success |
| --- | --- | --- | --- |
| GET | `/api/tenant/crm/v1/dashboards/overview` | `crm.dashboards.read` (scoped) | 200 |
| GET | `/api/tenant/crm/v1/dashboards/sales-pipeline` | `crm.dashboards.read` (scoped) | 200 |
| GET | `/api/tenant/crm/v1/dashboards/leads` | `crm.dashboards.read` (scoped) | 200 |
| GET | `/api/tenant/crm/v1/dashboards/activities-productivity` | `crm.dashboards.read` (scoped) | 200 |
| GET | `/api/tenant/crm/v1/dashboards/customer-intelligence` | `crm.dashboards.read` (scoped) | 200 |
| GET | `/api/tenant/crm/v1/dashboards/data-quality` | `crm.dashboards.read` (scoped) | 200 |
| GET | `/api/tenant/crm/v1/dashboards/action-center` | `crm.dashboards.read` (scoped) | 200 |

All fixed-report aggregates and lists intersect dashboard scope with source
read scope, including branch and owner restrictions. Missing source read
permission returns `403 CRM_SCOPED_PERMISSION_DENIED` before report queries run.
Overview and Action Center require leads, opportunities and activities;
Sales Pipeline requires opportunities; Lead Performance requires leads and
opportunities; Activities Productivity requires activities; Customer
Intelligence requires customer profiles; Data Quality requires leads,
opportunities and customer profiles. Source-to-value applies the two source
scopes independently. `scope.branches` contains only `branchId` and `scope`.

Data Quality's `duplicateSignals` is a numeric count of duplicate phone groups
among readable customer profiles, with the contact-method date filter applied.
No phone value or party id is returned. Its portal widget uses `COUNT`.

`DashboardQueryDto` — the **only** query these seven accept:

| Parameter | Type | Notes |
| --- | --- | --- |
| `dateFrom`, `dateTo` | `@IsDateString()` | A bare `YYYY-MM-DD` becomes 00:00:00 / 23:59:59.999 UTC |
| `branchId` | UUIDv7 | **Optional.** Narrows the dataset; it does not grant |
| `ownerUserId` | UUIDv7 | Optional, narrows only |
| `pipelineId` | UUIDv7 | Optional. An inaccessible one is `404 PIPELINE_NOT_FOUND` |
| `currencyCode` | 3 chars, upper-cased | Optional |
| `staleDays` | 1–365 | Optional |
| `limit` | 1–100 | Optional |

There is **no `datePreset` and no `compare` here.** Those two exist only on
`DashboardFiltersDto`, which the builder uses. There is also no `page`, no
`sortBy` and no `sortDir`: none of these seven is a paginated list.

## Routes — dashboard builder

| Method | Canonical path | Permission | Success |
| --- | --- | --- | --- |
| GET | `/api/tenant/crm/v1/dashboards/catalog` | `crm.dashboards.read` (scoped) | 200 |
| GET | `/api/tenant/crm/v1/dashboards/blueprints` | `crm.dashboards.read` (scoped), `crm.dashboards.create`, `crm.widgets.create` | 200 |
| PUT | `/api/tenant/crm/v1/dashboards/blueprints/:blueprintKey/adoption` | `crm.dashboards.read` (scoped), `crm.dashboards.create`, `crm.widgets.create` | 200 |
| GET | `/api/tenant/crm/v1/dashboards/navigation` | `crm.dashboards.read` (scoped) | 200 |
| GET | `/api/tenant/crm/v1/dashboards/default` | `crm.dashboards.read` (scoped) | 200 |
| GET | `/api/tenant/crm/v1/dashboards/share-targets` | **`crm.dashboards.share`** | 200 |
| GET | `/api/tenant/crm/v1/dashboards` | `crm.dashboards.read` (scoped) | 200 |
| POST | `/api/tenant/crm/v1/dashboards` | `crm.dashboards.create` | **201** |
| POST | `/api/tenant/crm/v1/dashboards/from-template/:templateKey` | `crm.dashboards.create` | **201** |
| PUT | `/api/tenant/crm/v1/dashboards/from-template/:templateKey` | `crm.dashboards.create` | 200 |
| GET | `/api/tenant/crm/v1/dashboards/:id` | `crm.dashboards.read` (scoped) | 200 |
| PATCH | `/api/tenant/crm/v1/dashboards/:id` | `crm.dashboards.update` | 200 |
| DELETE | `/api/tenant/crm/v1/dashboards/:id` | `crm.dashboards.delete` | **204** |
| POST | `/api/tenant/crm/v1/dashboards/:id/duplicate` | `crm.dashboards.create` | **201** |
| PUT | `/api/tenant/crm/v1/dashboards/:id/default` | **`crm.dashboards.read`** (scoped) | 200 |
| PUT | `/api/tenant/crm/v1/dashboards/:id/favorite` | **`crm.dashboards.read`** (scoped) | 200 |
| PUT | `/api/tenant/crm/v1/dashboards/:id/layout` | `crm.dashboards.update` | 200 |
| POST | `/api/tenant/crm/v1/dashboards/:id/run` | `crm.dashboards.read` (scoped) | **201** |
| POST | `/api/tenant/crm/v1/dashboards/:id/widgets/:widgetId/drilldown` | `crm.dashboards.read` (scoped) | **201** |
| POST | `/api/tenant/crm/v1/dashboards/:id/placements` | `crm.dashboards.update` | **201** |
| DELETE | `/api/tenant/crm/v1/dashboards/:id/placements/:placementId` | `crm.dashboards.update` | **200** |
| GET | `/api/tenant/crm/v1/dashboards/:id/shares` | `crm.dashboards.share` | 200 |
| POST | `/api/tenant/crm/v1/dashboards/:id/shares` | `crm.dashboards.share` | **201** |
| DELETE | `/api/tenant/crm/v1/dashboards/:id/shares/:shareId` | `crm.dashboards.share` | **204** |

## Routes — widgets

Lifecycle source verification **2026-11-10**. The contract below is for the
coordinated CRM lifecycle release. Its draft endpoints require the versioning
schema and current permission catalogue. The running portal and authenticated
browser acceptance are tracked separately.

Widget library and detail editor loading use `GET /api/tenant/crm/v1/widgets/catalog` with
`crm.widgets.read`. It returns the same static catalogue as the dashboard
builder without requiring dashboard read access or executing data. Users with
widget read/create can configure and save widgets independently; preview still
requires `crm.dashboards.read` and execution still enforces source read access.

Starter template metadata verified **2026-11-10**. `GET /widgets/catalog`
includes `widgetRecipes`, a bounded list of portable template definitions. Each
recipe has a stable key, a family, Arabic and English copy, a visualization,
query and display settings, and configured source resources. The catalogue
offers the recipe while its metrics remain available. Opening `/crm/widgets/new`
shows the searchable gallery and a blank-report action. Selecting a recipe
prefills the existing builder. Saving uses the existing `POST /widgets` draft
contract after the user confirms. Preview continues to require its own grant
and resolves actual source access at execution time. The gallery displays
configuration metadata without requesting report data.

The lead arrival starter opens a Heatmap for
`crm.leads.created.by_weekday_hour.count` with dimension `lead_arrival_slot`.
The metric counts non-deleted leads created in the selected half-open window.
The tenant time zone determines the weekday and the four six-hour bands
`00–05`, `06–11`, `12–17` and `18–23`. Execution uses the same lead-read
intersection as the dashboard for company, branch, team and owner filters.
Each readable window produces four series of seven weekday points, including
zero-count cells. A denied source returns the existing permission warning with
no cells. Heatmap shows exact day and period totals. Table is also supported.
Previous period and previous year pair the same weekday and band. The starter
uses the selected period alone until the author changes its comparison mode.

The intake growth measure `crm.leads.created.by_source.growth_percent` uses
`source` grouping in a BAR or TABLE widget. The server pairs the selected
window with its matched previous period using the tenant calendar. Both
windows use the same current lead-read scope. It ranks sources by combined
lead count and folds sources after the first ten into a single shared Other
bucket. Unspecified and unknown or retired source groups stay separate.
Each point carries `currentCount`, `previousCount`, `absoluteChange` and
`growthPercent` in its metadata. Growth is relative to the previous count and
is null when that count is zero. `details.sourceGrowth` supplies the two civil
date ranges, the time zone, aggregate counts and growth, and the number of
folded sources. The `lead-source-growth` starter opens the horizontal bar in
the Builder. The Review step and dashboard tile show both calendar windows,
and the exact table shows the prior count, current count, signed change and
growth for each source and the total. Sources with a zero baseline keep their
counts and signed change in the table and have an empty growth cell. The
comparison is built into the measure and follows the selected date range.

The `LEAD_ACQUISITION` dashboard template materializes three placed widgets
using the normal dashboard and widget publication flow. The monthly intake
line uses `LAST_3_COMPLETE_MONTHS`, which ends before the open calendar month
in the tenant time zone. The arrival heatmap and growth by source use
`LAST_MONTH`. An organization or population filter preserves the saved date
ranges. An explicit dashboard date selection overrides every tile's range.
Date-based widget results can include `meta.effectivePeriod` with the inclusive
civil dates and time zone. Widgets with saved date overrides display the range
from the receipt. The trend and growth widgets open their exact data tables by
default through `displaySpec.options.showTable`.
The populated monthly intake result includes `details.monthlyIntake` with
the exact three-month total and the latest month's absolute and relative change.
The three complete buckets include zero for any gap within the populated range.
Relative change is null when the prior month has zero leads. On a wide tile,
the intake line and exact table appear next to each other.

| Method | Canonical path | Permission | Success |
| --- | --- | --- | --- |
| GET | `/api/tenant/crm/v1/widgets/catalog` | `crm.widgets.read` | 200 |
| POST | `/api/tenant/crm/v1/widgets/preview` | **`crm.dashboards.read`** (scoped) | **201** |
| GET | `/api/tenant/crm/v1/widgets/share-targets` | `crm.widgets.share` | 200 |
| GET | `/api/tenant/crm/v1/widgets` | `crm.widgets.read` | 200 |
| GET | `/api/tenant/crm/v1/widgets/owner-options` | `crm.widgets.read` | 200 |
| POST | `/api/tenant/crm/v1/widgets` | `crm.widgets.create` | **201** |
| GET | `/api/tenant/crm/v1/widgets/:id` | `crm.widgets.read` | 200 |
| GET | `/api/tenant/crm/v1/widgets/:id/versions` | `crm.widgets.read` and resource EDIT | 200 |
| GET | `/api/tenant/crm/v1/widgets/:id/draft` | `crm.widgets.update` and resource EDIT | 200 |
| PATCH | `/api/tenant/crm/v1/widgets/:id` | `crm.widgets.update` | 200 |
| POST | `/api/tenant/crm/v1/widgets/:id/draft/discard` | `crm.widgets.update` and resource EDIT | 200 |
| POST | `/api/tenant/crm/v1/widgets/:id/publish-impact` | `crm.widgets.publish` and resource EDIT | 200 |
| POST | `/api/tenant/crm/v1/widgets/:id/publish` | `crm.widgets.publish` and resource EDIT | 200 |
| POST | `/api/tenant/crm/v1/widgets/:id/lifecycle-impact` | `crm.widgets.delete` and resource OWNER | 200 |
| POST | `/api/tenant/crm/v1/widgets/:id/lifecycle` | `crm.widgets.delete` and resource OWNER | 200 |
| DELETE | `/api/tenant/crm/v1/widgets/:id` | `crm.widgets.delete` | **204** |
| POST | `/api/tenant/crm/v1/widgets/:id/clone` | `crm.widgets.create` | **201** |
| GET | `/api/tenant/crm/v1/widgets/:id/shares` | `crm.widgets.share` | 200 |
| POST | `/api/tenant/crm/v1/widgets/:id/shares` | `crm.widgets.share` | **201** |
| DELETE | `/api/tenant/crm/v1/widgets/:id/shares/:shareId` | `crm.widgets.share` | **204** |

Complete list: [crm-reference.md](crm-reference.md).

Library list and detail use `status`, `versionNumber` and `governanceRevision`
from the widget head. Draft-only entries may have no name or visualization,
and have null published query, display, schema and version fields. View grants
receive active publications and null draft metadata. Owners and editors can
see `hasDraft` and `draftRevision` on the library head. The add-widget picker
uses published entries and keeps the server cursor even when a page has no
eligible entries.

Create and clone return a new draft state. The builder opens the returned
`widgetId`. A save sends all four content fields and the captured
`expectedWidgetRevision`, `expectedDraftId` and `expectedDraftRevision`.
Use null draft ID and revision zero to start a working generation. A save
advances the draft revision while the current publication remains available.
Preview keeps its separate, complete definition input and scoped read permission.

Publication review binds the head, governance and draft revisions. Confirmation
adds the returned `impactId` and sends a UUIDv7 `x-idempotency-key`. A retry
of an unconfirmed command reuses the same key and body while the review stays
open. CRM checks the stored receipt before it checks proof expiry. A stale
proof clears the review and refreshes the draft so the user can inspect current
impact. Publish requires the dedicated grant and access to the editable draft
state. The portal shows dashboard impact only for visible records and reports
layout adjustments separately. Discard requires explicit confirmation against
the displayed draft generation and revision. It leaves the active publication
in place.

The review loads version history newest first using `limit` (default 20,
maximum 50) and the exclusive `beforeVersion` cursor. The response includes
`widgetRevision` and `activeVersionNumber` so the screen can match the
history to the reviewed head. Each item includes the recorded name,
publication date and provenance. Backfilled definitions have no publication
date. The working draft appears separately from the immutable history.
The review can run the saved draft through the existing scoped preview route.
It uses the draft definition bound to the impact proof and the same chart and
exact-value table as the builder. Preview retains its independent permission.

Widget owners can open archive review from the widget detail or a placed
widget's dashboard menu. Restore starts from the archived widget's detail.
The portal reads the current standalone widget head before requesting
impact. Impact returns visible placement policies and their version
numbers, plus an aggregate count of hidden uses. The confirmation binds
the reviewed head and proof, and archive requires a reason. Both
`FOLLOW_ACTIVE` and `PINNED` are suspended by archive. If the confirmation
response is lost, the portal reads the current widget and refreshes the
workspace. A stale proof requires a fresh impact review.

### The four permission facts a screen must not infer

1. **`crm.dashboards.read` is seeded ONLY in its scoped form.**
   `crm-app/packages/common/src/constants/permissions.ts` puts it in
   `CRM_SCOPED_PERMISSION_BASES`, and `CRM_PERMISSIONS` expands that list into
   `.own`/`.team`/`.all` **without** the bare key. `/auth/me` therefore never
   returns `crm.dashboards.read`. Gating a screen on the exact string admits
   nobody. `CrmPermissionsGuard` accepts any of the three.
2. **`crm.dashboards.create` / `.update` / `.delete` / `.share` are static.**
   They sit in `CRM_STATIC_PERMISSIONS` and are granted as the exact string.
   (`isScopedCrmPermissionBase` would *also* accept a `.own` variant for the
   first three, but no such key is ever seeded, so matching only the exact
   string is correct and matching the scoped form is dead code.)
3. **Every `crm.widgets.*` key is static.** `widgets` is not in
   `CRM_SCOPED_RESOURCES`, so `crm.widgets.read.all` satisfies nothing.
4. **Setting default and favourite need `.read`, not `.update`.** Both handlers
   carry `@RequirePermissions('crm.dashboards.read')`, because they write a
   per-user preference row rather than the dashboard. And
   **`POST /widgets/preview` needs `crm.dashboards.read`, not a widgets
   permission** — it is on the widgets controller but it executes a query.

### Permission is not access

Every builder route additionally resolves a **record** access level:
`OWNER` / `EDIT` / `VIEW`, from ownership plus an unexpired, active share
(`DashboardAccessService.definition`). The rules that are not guessable:

| Operation | Level required |
| --- | --- |
| Read, run, drill down, set default, set favourite | `VIEW` |
| Update, layout, add/remove placement | `EDIT` |
| Delete, list/create/revoke shares | `OWNER` |

`DELETE /:id` and `DELETE /widgets/:id` additionally filter on
`owner_user_id` in the `UPDATE`, so an `EDIT` share deleting answers
**404**, not 403.

`removePlacement` is the one asymmetry: an `OWNER` may remove any placement,
while an `EDIT` collaborator may remove only placements whose widget **they**
can see — removing a hidden one answers
`403 CRM_DASHBOARD_DEFINITION_ACCESS_DENIED`.

## Organization scope — do not send the headers

**None of these 41 routes is `BRANCH_REQUIRED`.** 39 declare no
`organizationScopeMode` at all, and the Gateway's
`RouteContextMiddleware.validateOrganizationScope` returns early for a route
with no mode, so the headers are simply ignored.

The two explicit exceptions run the other way:

```text
POST /dashboards/:id/widgets/:widgetId/drilldown   organizationScopeMode: NONE
GET  /widgets/catalog                            organizationScopeMode: NONE
```

`NONE` means **neither header may be present**. Sending
`x-mutakamel-company-id` or `x-mutakamel-branch-id` on either route is a
**400 `GW.REQUEST.INVALID`** before crm-app sees the request — the exact
inverse of defect D11, and the reason a shared "always attach the scope
headers" helper must not be pointed at this family.

`branchId` here is an ordinary **optional filter**, in the query on the seven
prebuilt reports and in `filters` on the builder. Standing rule S2 — *every CRM
list requires `branchId`* — does not reach definition lists: their authorization
is ownership/sharing, independent of the branch filters used when executing data.

## Reviewed dashboard blueprints

Source verified on **2026-11-10** against the CRM controller, DTO and service and
the Gateway contracts. The tenant portal source calls both routes from **Browse
blueprints** on `/crm/dashboards`. Availability depends on the tenant's published
blueprint catalogue and live grants. Authenticated portal acceptance remains
pending the coordinated release.

- `GET /dashboards/blueprints` accepts an optional UUIDv7 `branchId` query.
  Without it, the catalogue uses the actor's eligible branches across active
  companies. It returns raw CRM `{ items }` with `key`, `definitionRevision`,
  `audience`, `name`, `description`, `widgetCount`, numeric `targets`,
  `branchSelectionRequired` and an `adoption` state. Audiences are `USER`,
  `TEAM_LEADER` and `CRM_ADMIN`. States are `AVAILABLE`, `ADOPTED` with
  `dashboardId` and the adopted revision, `REMOVED` and `ADOPTED_ELSEWHERE`.
  The latter reports an existing adoption for a different scope without a
  dashboard link.
- `PUT /dashboards/blueprints/:blueprintKey/adoption` accepts an integer
  `definitionRevision`, optional UUIDv7 `branchId`, optional `name` up to 120
  characters and `confirmTargets: true` when the selected revision includes
  numeric targets. The key is a lowercase slug of up to 80 characters. The
  selected branch becomes a default report filter. Creation without a branch
  is available when every branch in the viewer's dashboard scope qualifies.
  Partial coverage returns `409 CRM_DASHBOARD_BLUEPRINT_BRANCH_REQUIRED` until
  an eligible branch is selected. The receipt contains
  `dashboardId`, `definitionRevision` and `created`. The client checks the
  receipt and rereads the owned dashboard before opening it.
- An exact retry uses the original revision, branch, name and target
  confirmation. Changing branch, name or target confirmation on the same
  revision returns `409 CRM_DASHBOARD_BLUEPRINT_ADOPTION_MISMATCH`. Later
  dashboard edits leave the original intent unchanged. A removed adoption
  remains removed. The drawer distinguishes `403` from an empty
  catalogue and `503 CRM_DASHBOARD_BLUEPRINTS_NOT_READY` from access denial.
  Unknown write outcomes require fresh catalogue readback and explicit review.

## Idempotency

`WRITE_SENSITIVE` **and** `idempotent: true` is the pair that makes the Gateway
reserve a key. The blueprint adoption command also has an owner/revision
receipt that prevents another creation after transport replay. Routes include:

```text
PUT    /dashboards/from-template/:templateKey
PUT    /dashboards/blueprints/:blueprintKey/adoption
PUT    /dashboards/:id/default
PUT    /dashboards/:id/favorite
PUT    /dashboards/:id/layout
POST   /dashboards/:id/shares
POST   /widgets/:id/shares
```

`POST /:id/run`, `POST /widgets/preview` and the drill-down are **`READ_HEAVY`**,
not `WRITE_SENSITIVE`. They are POSTs because their input is a body, not
because they mutate: no key is reserved, none is required, and re-running is
free.

## Pagination

| Route | Paging |
| --- | --- |
| `GET /dashboards`, `GET /widgets`, `GET /dashboards/navigation` | `limit` 1–100 (default 50), exclusive UUIDv7 `cursor`; `{ items, nextCursor }`, newest ID first. Navigation also includes the resolved `activeDashboardId`, even when it is outside this page. |
| `GET /:id/shares`, `GET /widgets/:id/shares` | **None** |
| `GET /dashboards/share-targets`, `GET /widgets/share-targets` | `limit` + `offset`, and a `nextOffset` only when a category filled its page |
| `POST /:id/widgets/:widgetId/drilldown` | **Cursor.** `pageInfo: { limit, hasMore, nextCursor }` — no total |

`share-targets` pages **users and teams with the same offset**, so page 2 can
legitimately contain one category only.

Dashboard lists, the dashboard switcher and the widget library/picker load one
page at a time with translated load-more controls. The dashboard list's search
and client table sorting apply to loaded items. A reload or successful mutation
resets the list to page one. The switcher offers missing template setup only after
all dashboard pages are loaded. A failed next-page request retains loaded items
and its cursor for retry.

`GET /widgets` accepts optional `search`, `access`, `status`, `source`, and
`ownerUserId` filters. It
applies them to visible entries before pagination. `search` is a trimmed,
case-insensitive literal substring of the displayed widget name (up to 120
characters). It matches the active publication name when available and an
authorized draft name for a draft-only widget. `access` accepts `OWNED`, `SHARED`
(all incoming shares), or `TEAM` (incoming shares through a current, eligible
team that permits the definition's status). The team tab requires a team EDIT
share for a draft-only or archived definition. Overlapping direct and team grants produce one row with the highest
effective access. `status` accepts `PUBLISHED`, `DRAFT`, or `ARCHIVED` and still
requires the applicable definition grant. The dashboard placement picker sends
`status=PUBLISHED`.

`source` accepts `leads`, `opportunities`, `activities`, `customer_profiles`,
`targets`, or `unclassified`. The same classification powers the
`sourceResources` array on each library item. Resources come from the metric
catalogue for all selected series, plus the sales target resource for a bound
governed target comparison. A widget with multiple resources matches each of
its sources. `unclassified` selects items with no recognized resource. The
active publication takes precedence over a working draft. An authorized
draft-only entry can use its saved editor series to classify its sources.
Resource labels describe the definition. Report execution still resolves
current data access and readiness independently. Use the same filters with
`nextCursor`. Changing a filter starts a new result set from page one.

`GET /widgets/owner-options` returns `{ items: [{ id, name }], nextCursor }`
with one entry per owner of a visible widget in the selected `access` tab.
Owner name search uses the same literal case-insensitive matching as widget
name search and supports `limit` and the exclusive UUIDv7 `cursor`. Names can
be null for unavailable directory entries. The route returns only identifiers
and display names from the visible widget population. Choosing an owner sends
their UUIDv7 as `ownerUserId` on the widget list and intersects the existing
name, source, status and access filters. Switching access tabs clears the owner
selection and reloads options under that tab’s visibility rules.

The owner caps are 50 live dashboards and 500 live widgets. All create, template,
duplicate and clone paths serialize capacity checks under one owner transaction
lock; over-cap creation returns 409 `CRM_DASHBOARD_OWNER_LIMIT` or
`CRM_WIDGET_OWNER_LIMIT`. Existing excess data stays intact. Template widgets
carry creation provenance: deleting a dashboard also removes its proven template
widgets only when they have no other live placement or standalone share. Ordinary
widgets, copies and historical widgets with null provenance are preserved.
`GET /default` reads existing definitions and returns 404 if none is visible;
template setup uses the explicit PUT and never happens on a GET.

## `POST /:id/run` — the execution response

```json
{
  "dashboardId": "0199…",
  "revision": 7,
  "filters": { "dateFrom": "…", "dateTo": "…", "staleDays": 30, "limit": 10 },
  "generatedAt": "2026-08-31T09:00:00.000Z",
  "scope": [{ "branchId": "0199…", "scope": "team" }],
  "widgets": { "<widgetId>": { } },
  "unavailablePlacements": [],
  "comparisonCompatibility": { }
}
```

`RunDashboardDto` accepts optional `filters` (`DashboardRuntimeFiltersDto`),
`includePopulationOptions` (boolean), and `widgetIds` (max 20 UUIDv7; a widget not on the dashboard is
`422 CRM_DASHBOARD_WIDGET_SELECTION_INVALID`).

The Filters dialog uses `organizationScope.companies` and `organizationScope.branches` from the current viewer's dashboard-read grants. Each branch carries its company ID and name. Choose one company with `filters.companyId` or send `filters.companyIds` for a set. Choose one branch with `filters.branchId` or send `filters.branchIds` for a set. Omit a field to leave that axis open. Each array accepts 1 to 500 distinct UUIDv7 values. Send one representation per axis. The response echoes array selections in lowercase UUID order in `filters` and `organizationScope`.

Company selection takes the union of the selected companies' eligible branches. Branch selection intersects that population. Every explicitly selected company must have an eligible branch in the viewer's organization, and every selected branch must be eligible within the selected companies. Any unavailable or incompatible entry rejects the complete selection with `403 CRM_SCOPED_PERMISSION_DENIED`. Empty arrays and invalid IDs fail request validation. Sending a singular value and an array for the same axis returns `422 CRM_DASHBOARD_FILTER_INVALID`. A saved dashboard or widget branch can further narrow an array selection.

Use `filters.teamIds` and `filters.ownerUserIds` to select current teams and CRM owners. Each array accepts 1 to 500 distinct UUIDv7 values. An owner array and the legacy runtime `ownerUserId` are mutually exclusive. All supplied IDs must be available to the current viewer in the selected organization. Within an axis the values are alternatives. Across axes, records must match both the selected team's current branch coverage and the selected owner. Eligible IDs with no overlapping people give an empty population. Team membership reflects the current reporting structure even when the report dates are historical.

The run returns canonical lowercase ID arrays in `filters` and `populationScope` when population filters are active. With `includePopulationOptions: true`, `populationScope` also carries `teams` and `owners` as `{ id, name, branchIds }` lists. Options come from the selected companies and branches and the viewer's dashboard grants. Team-scope grants expose only teams the viewer manages in that branch. Own-scope grants can expose the viewer as an owner. An individual widget can have narrower source permissions than the dashboard. Apply a company or branch change to refresh options for newly included branches. `SOURCE_NOT_READY` means the membership source is unavailable. `TOO_BROAD` means the option lists exceed the response limit. Either state can return empty option lists alongside the dashboard results. A run that actually applies population filters requires the membership source and returns `503 CRM_TEAM_SCOPE_NOT_READY` if it is unavailable.

`scope` lists organization branches with each viewer's own, team or all dashboard grant. Widget source permissions still apply inside those branches, and widgets can report partial source coverage. Shared dashboard viewers execute against their own grants. The drill-down POST carries the same runtime selection and intersects it before planning records. Branch-wide metrics that require All scope are unavailable with explicit team or owner arrays. The legacy singular owner override retains its existing behavior for those metrics. Organization and population filters are part of the current dashboard session. Saved definitions and blueprints retain their own scope.

### One widget's result

```json
{
  "widgetId": "0199…",
  "shape": "CATEGORY",
  "value": 42,
  "previousValue": 37,
  "target": 25,
  "details": { },
  "result": { },
  "rows": [],
  "series": [{
    "key": "crm.leads.by_source.count",
    "label": "Leads by source",
    "unit": "COUNT",
    "axis": "LEFT",
    "currency": "EGP",
    "points": [{ "key": "web", "label": "Web", "value": 12, "meta": { } }]
  }],
  "meta": { "unit": "COUNT", "currency": "EGP", "generatedAt": "…", "warnings": [] }
}
```

`value` appears only for a `SCALAR` metric that produced exactly one point.
`target` appears only when the stored comparison is `TARGET`. `rows` appears
for a `TABLE` visualization and for a `ROWS` metric. `result` is the typed P2
payload — and see the trap below.

`series[].points[].value` may be **null**, including on the current
`TIME_SERIES` and category producers. Finite numbers and null are distinct;
malformed numeric values reject the response rather than becoming zero. Period
comparison uses the same current series and attaches `previousValue`,
`previousKey`, and, for time buckets, `previousStart`/`previousEnd` to its points.
It does not append a series whose key ends in a period suffix. Cartesian charts
plot the current and matched values with explicit labels and dashed historical
lines (or separate historical bars). The exact table also includes the matched
previous value/key. Other families still show a translated notice when only
their primary values are plotted.

For the current opportunity XY metric, point `value` is probability (x),
`secondaryValue` is deal amount (y), and `size` is opportunity age in days.
Scatter/bubble axes and the exact table use those meanings. Missing coordinates
are not plotted at zero; a bubble without age cannot invent a size. A donut,
funnel or normalized stack with missing values uses the exact table instead of
calculating a percentage over an incomplete population.

Scalar `comparison` also carries the server's nullable `previousValue`,
`absoluteChange`, `percentChange` and `previousWindow`. Its details and matched
period fields are preserved rather than reconstructed from labels.

Current `meta.partialAccess` remains a separate coverage fact; readable values
stay visible with a translated partial-coverage notice. `meta.ignoredFilters`
also produces a translated notice when a selected filter was not applicable.
The UI does not display internal filter keys or describe the result as complete.
The returned `meta.timeBasis` is retained for current-contract consumers.

Builder alert lists and activity feeds render only the current widget result.
They do not fetch prebuilt action-center reports or activity lists to enrich
rows, and keep no shared enrichment cache. Alert titles, amounts and currencies
come from the result rows; activity titles and optional actor names come from
the result events. Missing attribution is omitted. Any future owner, branch or
subject names must be supplied by the scoped semantic executor under the same
dashboard filters.

### Partial failure is the normal case, not an error

`DashboardExecutionService.run` wraps **every** widget in its own SQL
`SAVEPOINT`. A widget that throws is rolled back to that savepoint and written
into the response beside the ones that worked:

```json
{
  "widgetId": "0199…",
  "shape": "ROWS",
  "series": [],
  "error": { "code": "CRM_WIDGET_METRIC_INVALID" },
  "meta": { "generatedAt": "…", "warnings": ["WIDGET_EXECUTION_FAILED"] }
}
```

The whole run still answers **201**. Three of nine failing is nine widgets in
the response, three of them carrying `error`. A screen that treats any `error`
as a failed dashboard throws away six working widgets.

Two details that bite:

- **`meta.unit` is absent on the failure path.** Only the success path sets it.
- **`error.code` is sanitized.** `safeWidgetError` passes a code through only
  when it came from a 4xx `HttpException` and matches `/^[A-Z][A-Z0-9_]{2,100}$/`;
  everything else — including the internal
  `CRM_DASHBOARD_WIDGET_PREPARATION_FAILED`, which is a plain `Error` — becomes
  `CRM_WIDGET_EXECUTION_FAILED`.

### Widget warnings

`meta.warnings` is a string array. Currency options come from structured fields,
not warning text:

| Warning | Means |
| --- | --- |
| `WIDGET_EXECUTION_FAILED` | This widget's query was rolled back |
| `SOURCE_PERMISSION_REQUIRED` | The metric needs a source resource the actor cannot read |
| `REPORTING_CURRENCY_UNSET` | A reporting currency is needed; the result is unavailable until one is selected |
| `OTHER_CURRENCIES` | Additional currencies are present separately in the metadata |
| `NO_DATA` | No readable records contributed to this result |
| `WIDGET_DEADLINE_EXCEEDED` | The item could not start within the dashboard execution budget |
| `RESULT_TRUNCATED` | Cut off at the server's row cap |
| `MISSING_AMOUNT` · `INVALID_AMOUNT` · `MISSING_CURRENCY` | Rows excluded from an aggregate |
| `MISSING_PROBABILITY` · `INVALID_PROBABILITY` | Same, for value-vs-probability |
| `NO_SOURCE_RECORD_ACCESS` · `PARTIAL_SOURCE_ACCESS` | The action-centre feed could reach none / some of its three sources |

The picker uses `meta.currency`, `series[].currency`,
`meta.otherCurrencies[].currencyCode` and `meta.breakdown[].currencyCode` from
the current scoped result. The latter two arrays carry independent
`{ currencyCode, value }` entries. Their amounts are never summed across
currencies by the client. The obsolete `CURRENCIES:` warning prefix has no
current producer and is not interpreted as a currency catalogue. Unknown
warning codes show translated generic copy in both preview and dashboard tiles.

## Money is a number here, not a decimal string

Standing rule S5 says never `Number()` a decimal string. **These routes never
send one.**

- Every money aggregate in `dashboards.service.ts` is cast `::float` —
  `COALESCE(SUM(o.amount), 0)::float AS value`, `o.amount::float AS value`.
- Every point in `dashboard-execution.service.ts` goes through `toPoints`.
  Its time/category paths preserve explicit null; non-null values become
  numbers. Scalar values likewise preserve null before numeric conversion.

So the precision loss happens **server-side, before serialization**, and the
portal cannot restore it. The discriminator for *rendering* is not the JS type —
it is always `number` — it is **`meta.unit === "MONEY"`** at the widget level and
**`series[].unit === "MONEY"`** per series, with the code in `meta.currency` /
`series[].currency`. Render through `Money`/`formatDecimalString` with the
number's own exact string form; do not re-round it, and do not sum a column in
the browser.

`/opportunities` and the rest of CRM **do** send decimal strings. This family is
the exception, and it is the only one — recorded as
[Q101](../build/OPEN-QUESTIONS.md).

## The typed P2 shapes carry no series at all

Five metrics return a typed `result` instead of series. `executeWidget` does
`continue` the moment a metric returns one, so `series` stays `[]` **and**
`rows` stays empty:

| `result.shape` | Payload key | Produced by |
| --- | --- | --- |
| `HIERARCHY` | `nodes[]` | `crm.opportunities.pipeline_stage.hierarchy.*` |
| `BINNED_DISTRIBUTION` | `bins[]` | `crm.opportunities.won.deal_size.histogram` |
| `DURATION_DISTRIBUTION` | `groups[]`, `totalCount`, `excludedCount`, `whiskerMethod` | `crm.leads.converted.conversion_duration.box_plot`, `crm.opportunities.won.cycle_duration.by_branch.box_plot` |
| `EVENT_STREAM` | `events[]` | `crm.activities.feed` |
| `ROWS` + `rowKind: "ALERT"` | `rows[]` | `crm.action_center.prioritized_alerts` |
| `WATERFALL` | `steps[]` | no metric declares this shape today |

A renderer that reads `series` for these draws an empty chart and reports no
error.

## Drill-down — the selection vocabulary is the STORED widget's

`POST /:id/widgets/:widgetId/drilldown` takes selection only. Query fields,
predicates and SQL are resolved from the stored widget by a server-registered
strategy; there is no way to pass a filter expression.

| Field | Notes |
| --- | --- |
| `pointKey` | Required, 1–256 chars, no control characters |
| `seriesKey` | Optional, ≤160 chars. **Required when the stored widget has more than one series** |
| `cursor` | Opaque, `[A-Za-z0-9_-]{,1024}` — pass back byte for byte |
| `limit` | 1–100, default 25 |
| `expectedWidgetRevision` | Optional. A mismatch is `409 CRM_WIDGET_REVISION_CONFLICT` |
| `filters` | A `DashboardFiltersDto`, merged under the dashboard's and the widget's |

**`seriesKey` is not the executed series key.** The run response splits a
series by currency and by runtime group, so its key can be
`crm.x.count:EGP:1`. The strategy matches against the **stored** `querySpec`:
`metricKey` for a single-series widget, `metricKey:index` for a multi-series
one, plus `metricKey:CURRENCY[:index]` when a `currencyCode` filter is in
force. Anything else is
`422 CRM_DASHBOARD_DRILLDOWN_SELECTION_INVALID`. The safe move is to offer
drill-down only on single-series widgets and omit `seriesKey`, which is what
the portal does.

`pointKey` is the point's own `key` from the run, passed back unchanged: `"0"`
for a scalar, a date-bucket string for a time series, the category id (or
`UNSPECIFIED`) for a category, a UUIDv7 for an entity.

Response `records` are **projected and redacted** to the 21 fields in
`CRM_DASHBOARD_DRILLDOWN_PROJECTION_FIELDS`; a plan may include fewer, and only
`id` is guaranteed.

## Layout — the complete set, every time

`PUT /:id/layout` takes `{ revision, placements[] }`. `placements` must be the
**complete current visible set**: a subset, a duplicate, or an id that is not
on the dashboard is `409 CRM_DASHBOARD_LAYOUT_STALE`.

Three constraints are checked server-side and are easy to violate by accident:

1. `x + width ≤ 12`, `x ≥ 0`, `y ≥ 0` — `CRM_DASHBOARD_LAYOUT_POSITION_INVALID`.
2. Width and height must sit inside the **visualization's own** min/max, which
   the catalogue publishes — `CRM_DASHBOARD_LAYOUT_SIZE_INVALID`.
3. No overlap — and the overlap check includes the **`unavailablePlacements`**,
   which the editor cannot move and a `VIEW` viewer cannot even see.

`unavailablePlacements` is returned **empty to a `VIEW` viewer** and populated
only for `OWNER`/`EDIT`, so an empty array is not proof the layout is complete.
Its `reason` is one of `WIDGET_ACCESS_REVOKED`, `WIDGET_PERMISSION_REQUIRED`,
`WIDGET_DELETED`.

### Choosing a placed widget's publication

Source verified **2026-11-10** against the Gateway contracts and
`DashboardBuilderController`, `ReviewPlacementVersionDto` and
`DashboardPlacementVersionService`. The tile's **Widget version** action is
available to dashboard OWNER/EDIT with `crm.dashboards.update` in writable mode.
The action requires a visible, published widget on the dashboard.

| Method | Gateway path | Outcome |
| --- | --- | --- |
| GET | `/api/tenant/crm/v1/dashboards/:id/placements/:placementId/version-policy` | 200 with selected and active versions, policy, box and revision tokens |
| POST | `/api/tenant/crm/v1/dashboards/:id/placements/:placementId/version-policy/impact` | 200 with the current binding and the proposed version, chart type and box |
| PATCH | `/api/tenant/crm/v1/dashboards/:id/placements/:placementId/version-policy` | 200 with the confirmed binding and whether it changed |

The user can follow the active publication, pin the active publication, or
retain the current pinned publication. The paginated widget version history
allows authorized widget editors with `crm.widgets.read` to select another
earlier publication. Each review sends `versionPolicy`, `pinnedVersionNumber`
(null for `FOLLOW_ACTIVE`), `expectedDashboardRevision`,
`expectedWidgetRevision`, and `expectedGovernanceRevision`.

The preview shows the selected version and chart type, plus both boxes when
the chart requires new dimensions. Apply sends the reviewed body plus
`expectedSelectedVersionNumber` and `expectedPlacement`. The portal verifies
the receipt before refreshing the dashboard. A stale review requires a fresh
binding and a new preview. An uncertain write uses dashboard recovery and
requires reload and review before further edits. The portal never automatically
resends confirmation.

## Widget definitions

Lifecycle source verified **2026-11-10** against the widget controller,
DTOs and services. The six-stage builder follows the approved CRM Settings item 11.

The library shows name, data source, visualization, publication status, owner, access, usage,
update time and available actions. Search filters the authorized library before
pagination. Create and clone enforce the server's 500-owned-widget ceiling.

Widget usage source verified **2026-11-10**. Library usage opens a panel from the
selected row and widget detail opens the same list with its initial response.
`GET /widgets/:id` returns up to 20 visible placements in descending placement
UUID order. Send `usageCursor=usage.nextCursor` on the same route for the next
page. Each request rechecks the widget definition and current dashboard access.
Dashboard names and links require a live `crm.dashboards.read` grant and visibility
of that dashboard definition. The widget owner receives total counts and an
anonymous `hiddenPlacementCount`. Collaborators receive counts for visible
placements only. Deleted placements and dashboards are outside those counts.
Totals describe the authorized result across pages. The panel replaces visible
links with each page it loads.

The draft API accepts a trimmed name up to 120 characters, a nullable
visualization and JSON objects for query and display. The builder saves from
any step. An incomplete draft stores a versioned editor form in the draft query
object so unfinished controls can be restored. A complete save replaces that
form with a normal query specification. Owner or EDIT authority and the widget update
permission are both required for editing. Deletion and sharing have separate
ownership and permission checks. Preview uses scoped dashboard read permission.

### Comparing publications and restoring a draft

Source verified **2026-11-10** against the Gateway, widget controller,
comparison and restoration DTOs and `DashboardWidgetVersionRestoreService`.
**Version history** is available from widget detail to owners and editors
with `crm.widgets.read`. The user can page the immutable history and
select any two distinct loaded publications. The comparison highlights
differences in the saved definition, including the metrics, grouping,
filters, comparison and display controls.

| Method | Gateway path | Outcome |
| --- | --- | --- |
| POST | `/api/tenant/crm/v1/widgets/:id/versions/compare` | 200 with both ordered immutable snapshots, changed sections and restore availability |
| POST | `/api/tenant/crm/v1/widgets/:id/versions/restore-draft` | 200 with the new working draft and the source version number |

Compare sends `leftVersionNumber` and `rightVersionNumber`. The server
returns `AVAILABLE` with a ten-minute proof when the actor can restore
and the draft slot is empty. `DRAFT_EXISTS` and `PERMISSION_REQUIRED`
leave the comparison available. The view displays stored configuration
without executing a report.

Restore also sends the selected `sourceVersionNumber`, both head
revisions, `impactId` and JSON `acknowledged: true`. It requires
`crm.widgets.read`, `crm.widgets.update` and widget EDIT resource
access. The draft keeps the chosen settings and uses the active
publication as its base. Older unsupported settings remain reviewable
in a draft with a compatibility notice. Publishing is a separate
reviewed action that validates the current catalogue and permissions.

A stale or expired proof requires a fresh comparison. When the
confirmation is uncertain, the portal fetches the current widget and
draft and requires explicit review before another write. The portal
validates the receipt against the chosen source and skips automatic
command replay. Authenticated browser acceptance awaits the coordinated
CRM lifecycle release.

### Widget ownership administration

Source verified **2026-11-10** against the Gateway contracts and
`DashboardWidgetsController`, `DashboardWidgetOwnershipService` and the
ownership transfer DTOs. Open **Widget ownership** under CRM Analytics or
at `/crm/widgets/ownership-transfers`. Route and menu admission use the
dedicated `crm.widgets.transfer_ownership` permission. CRM resolves the
current tenant-level grant before admitting reads or writes.

| Method | Gateway path | Outcome |
| --- | --- | --- |
| GET | `/api/tenant/crm/v1/widgets/ownership-transfers` | 200 with a metadata page |
| GET | `/api/tenant/crm/v1/widgets/:id/ownership-transfer` | 200 with current ownership metadata |
| GET | `/api/tenant/crm/v1/widgets/:id/ownership-transfer/targets` | 200 with an eligible-user page |
| POST | `/api/tenant/crm/v1/widgets/:id/ownership-transfer/impact` | 200 with aggregate impact and a ten-minute review proof |
| PATCH | `/api/tenant/crm/v1/widgets/:id/ownership-transfer` | 200 with the new owner, revisions and confirmed counts |

The metadata list shows names, current owners, publication status and the
active publication and draft revision numbers. The list and target search
use the server's `search` and `cursor` parameters. The new owner must be
active and have tenant-level widget read and update authority or tenant-owner
authority, and room under the owner limit. The page supports metadata reads
when the tenant is read-only.

The review sends `targetUserId`, `expectedWidgetRevision` and
`expectedGovernanceRevision`. The modal shows the selected owner and five
aggregate counts covering placements, retained shares and access impact.
Confirmation requires the same revisions, `impactId`, a reason of at most
500 characters and JSON `acknowledged: true`. Existing publications, drafts,
placement policies and direct shares are retained. CRM record access is
still checked against each viewer's permissions.

The client validates the proof and receipt before refreshing ownership. A
conflict requires a fresh metadata read and review. If the confirmation
cannot be verified, the workspace reloads the affected widget's current
owner for explicit acknowledgement, including after navigating away and
back within the session. Confirmation is never automatically replayed.
Authenticated browser acceptance awaits the coordinated CRM lifecycle release.

### Saving the working draft

The save sends both complete specifications. The editor carries unchanged
stored fields forward and preserves supported series, filters, styling and
scalar display options. Definitions with unsupported fields stay readable.
Only a confirmed publication can change which version following placements use.

### Advanced authoring — approved 2026-11-03

The authoring form exposes every current catalogue visualization and **1–4 series**, constrained further by each visualization's minSeries/maxSeries. Each series has an available metric, optional label up to 80 characters, optional #RRGGBB color and optional LEFT/RIGHT axis. The selected dimension must be supported by every metric; all series need one compatible shape and matching row contract. Mixed units use at most two units and require a capable visualization plus explicit axes where required. A time dimension requires a supported grain. Period comparison must be supported by the visualization and every metric; gauges and target comparisons require a finite target of at least 0.000001.

Only **LEGACY_V1** can be authored; omission selects this engine. SEMANTIC_V1, semanticVersion, source, semanticFilters, topN and maxPoints are retired and rejected by the current catalogue, even if older documentation or persisted rows mention them.

Optional filters expose the real date presets, custom dates, branch, owner, pipeline, uppercase three-letter currency, stale/closing-window days 1–365 and result limit 1–100. Pickers use real authorized option sources. Unavailable sources preserve existing selections with a clear reason. Incomplete settings can be saved. Preview and publication review require complete settings and retain field validation.

Display controls include title up to 120, subtitle up to 300, primary/target colors, all seven number formats, five legend positions and useful scalar options. Other supported scalar options are preserved; the API permits at most 32 scalar keys and 4096 UTF-8 bytes. There is no raw JSON, SQL or query-engine editor.

### Preview and chart fidelity

Preview executes the current unsaved definition, never saves it, and clears immediately when form/auth scope changes. The real result uses shared chart and exact table components. LINE, COLUMN, LINE_AREA and COMBO support valid two-unit LEFT/RIGHT axes with independent formatters. BAR is horizontal; PIE has no donut hole. COMBO uses the first declared series as bars and the remaining series as lines; LINE_AREA uses the first as area and the remaining as lines. Matched previous values follow the same declared axis and retain their own labels. Currencies appear in independent chart panels. Invalid axes or incomplete part-to-whole data retain a table boundary. No third comparison dataset is inferred from the current contract.

Exact tables show every loaded row through a progressive “show more” control,
with an explicit shown/loaded count. Preview no longer silently stops at twelve
rows. This loaded-row count is not an invented source-population total. Chart
display limits do not truncate the source table. Catalogue-default metric names
use the current bilingual catalogue while explicit labels and business group
names remain unchanged. These source/unit checks do not certify live geometry;
authenticated screenshot acceptance remains separate.

Saved display title/subtitle appear in both preview and dashboard tiles. Supported Cartesian/donut paths consume unit-aware number formatting, explicit primary/per-series colors, logical legend position or hidden legend, points and value labels. Scalar/gauge change visibility and target text color are honored. Controls unavailable for a visualization or mixed-unit/RIGHT-axis fallback are disabled with a translated explanation; existing settings are retained and unsupported saved presentation has an explicit render notice. Tables always retain full notation and source units, as their captions explain. Duration conversion applies to minute-based scalar duration values (catalogue calendar-utilization minutes); interval millisecond values remain in their exact table boundary.

### Sharing, deletion and outcomes

Widget sharing supports User/Team, View/Edit and optional future expiry. Target search and current-share reads fail independently and offer their own recovery. POST share receipts are validated against the selected target/access/expiry. Revoking a share does not delete the widget. An owner deletion **removes every placement and share** and updates affected dashboard revisions; it is not blocked merely because dashboards use it.

List, detail, preview and share snapshots are tagged by actor/session/grants/resource and masked on the first scope-changing render. Reads have cancellation/generation guards. Mutation tickets synchronously block duplicate submissions and pending close/edit actions. Unknown, malformed, 5xx and in-flight write outcomes reconcile once, then retain a session-bound fence across close/reopen until a successful current read and explicit user review. No write is automatically repeated. A valid save followed by a failed refresh is reported as saved with a separate refresh warning. Revision conflict retains the draft with Reload/Cancel, without overwrite.

Draft save returns the working generation and current head. Publication review
returns the visible dashboard impact and layout adjustments. Publication
confirmation returns the new version and visible dashboard revisions.

## Enums

`INHERIT` is an editor choice, not a wire enum. It omits
`querySpec.comparison` and follows runtime/widget-filter/dashboard comparison
precedence. “Comparison disabled” sends the existing `{ "type": "NONE" }`,
which stays disabled despite runtime comparisons. Query edits preserve stored
NONE, and name-only edits omit the unchanged query entirely.

| Enum | Values |
| --- | --- |
| Visualization | 36 — `METRIC_CARD`, `LINE`, `AREA`, `LINE_AREA`, `COLUMN`, `BAR`, `STACKED_BAR`, `PIE`, `DONUT`, `SCATTER`, `BUBBLE`, `GANTT`, `FLOWCHART`, `SEMI_CIRCLE_GAUGE`, `THREE_QUARTER_GAUGE`, `CIRCULAR_PROGRESS_GAUGE`, `DETAILED_SPEEDOMETER`, `TABLE`, `FUNNEL`, `HEATMAP`, `MULTI_KPI`, `PROGRESS_CARD`, `BULLET`, `STACKED_BAR_100`, `COMBO`, `WATERFALL`, `TREEMAP`, `LEADERBOARD`, `SCORECARD`, `HISTOGRAM`, `BOX_PLOT`, `CALENDAR`, `TIMELINE`, `CALENDAR_HEATMAP`, `ALERT_LIST`, `ACTIVITY_FEED` |
| Data shape | `SCALAR`, `TIME_SERIES`, `CATEGORY`, `XY`, `INTERVAL`, `GRAPH`, `ROWS`, `HIERARCHY`, `BINNED_DISTRIBUTION`, `DURATION_DISTRIBUTION`, `WATERFALL`, `EVENT_STREAM` |
| Metric unit | `COUNT`, `MONEY`, `PERCENT`, `DURATION`, `SCORE` |
| `datePreset` | `TODAY`, `CURRENT_WEEK`, `CURRENT_MONTH`, `CURRENT_QUARTER`, `CURRENT_YEAR`, `LAST_MONTH`, `LAST_3_COMPLETE_MONTHS`, `LAST_QUARTER`, `LAST_YEAR`, `LAST_7_DAYS`, `LAST_30_DAYS`, `LAST_90_DAYS`, `CUSTOM` |
| `compare` | `NONE`, `PREVIOUS_PERIOD`, `PREVIOUS_YEAR` |
| `comparison.type` | `PREVIOUS_PERIOD`, `PREVIOUS_YEAR`, `TARGET`, `NONE`, `DATASETS` · dataset admission follows the metric catalogue capability |
| Time grain | `DAY`, `WEEK`, `MONTH`, `QUARTER`, `YEAR` |
| Template key | `CRM_DEFAULT`, `SALES_PIPELINE`, `LEAD_PERFORMANCE`, `KPIS_TARGETS`, `TRENDS_COMPARISONS`, `DISTRIBUTION_RELATIONSHIPS`, `PROCESS_OPERATIONS`, `ACTIVITIES_PRODUCTIVITY`, `CUSTOMER_INTELLIGENCE`, `DATA_QUALITY`, `ACTION_CENTER` |
| Access level | `OWNER`, `EDIT`, `VIEW` |
| Share subject | `USER`, `TEAM` · access `VIEW`, `EDIT` |
| Unavailable reason | `WIDGET_ACCESS_REVOKED`, `WIDGET_PERMISSION_REQUIRED`, `WIDGET_DELETED` |

`PERCENT` values are **already 0–100** on the wire
(`(converted / total) * 100`). The one exception is the prebuilt leads report's
`conversionRate.rate`, which is a ratio in 0–1 — the same number, two scales,
in two families.

## Error codes and their real statuses

| Code | Status | Raised by |
| --- | ---: | --- |
| `CRM_DASHBOARD_ACTOR_INVALID` | 401 | Not a tenant-audience session |
| `CRM_PERMISSION_DENIED` | 403 | `CrmPermissionsGuard` |
| `CRM_DASHBOARD_DEFINITION_ACCESS_DENIED` | 403 | Access level below the one required |
| `CRM_DASHBOARD_DRILLDOWN_SOURCE_ACCESS_DENIED` | 403 | Source records outside the actor's scope |
| `CRM_DASHBOARD_NOT_FOUND` | 404 | Deleted or never existed |
| `CRM_WIDGET_NOT_FOUND` | 404 | Same, and what a non-owner delete gets |
| `CRM_DASHBOARD_RESOURCE_NOT_FOUND` | 404 | Access lookup found no row |
| `CRM_DASHBOARD_PLACEMENT_NOT_FOUND` | 404 | Owner removing an unknown placement |
| `CRM_DASHBOARD_DRILLDOWN_WIDGET_NOT_FOUND` | 404 | Widget is not placed on this dashboard |
| `PIPELINE_NOT_FOUND` | 404 | `pipelineId` filter outside the actor's pipelines |
| `CRM_SHARE_NOT_FOUND` | 404 | Revoking an unknown share |
| `CRM_DASHBOARD_NAME_CONFLICT` | 409 | Another dashboard of yours has that name |
| `CRM_DASHBOARD_REVISION_CONFLICT` | 409 | Stale `revision` on `PATCH /:id` or `PUT /:id/layout` |
| `CRM_WIDGET_REVISION_CONFLICT` | 409 | The expected published widget revision has changed |
| `CRM_WIDGET_DRAFT_CONFLICT` | 409 | The expected draft generation or revision has changed |
| `CRM_WIDGET_DRAFT_BASE_CONFLICT` | 409 | The draft is based on a different publication |
| `CRM_WIDGET_PUBLISH_IMPACT_STALE` | 409 | Publication impact needs a fresh review |
| `CRM_DASHBOARD_LAYOUT_STALE` | 409 | The submitted placement set is not the current one |
| `CRM_DASHBOARD_LAYOUT_OVERLAP` | 409 | Two boxes overlap, hidden ones included |
| `CRM_DASHBOARD_WIDGET_LIMIT` | 409 | 20-widget ceiling |
| `CRM_DASHBOARD_WIDGET_ALREADY_ADDED` | 409 | That widget is already placed here |
| `CRM_DASHBOARD_WIDGET_LIMIT_EXCEEDED` | 422 | A **stored** dashboard already exceeds 20 |
| `CRM_DASHBOARD_WIDGET_SELECTION_INVALID` | 422 | A `widgetIds` entry is not on this dashboard |
| `CRM_DASHBOARD_FILTER_INVALID` | 422 | `dateFrom > dateTo`, or an unparseable date |
| `CRM_DASHBOARD_DATE_RANGE_EXCEEDED` | 422 | Range longer than two years |
| `CRM_WIDGET_FILTER_INVALID` | 422 | A stored filter key or value is not allowed |
| `CRM_WIDGET_ENGINE_INVALID` | 422 | Any engine other than `LEGACY_V1`, or retired semantic/result-limit fields |
| `CRM_WIDGET_METRIC_INVALID` | 422 | Unknown metric, or no executor registered |
| `CRM_WIDGET_VISUALIZATION_INVALID` | 422 | Unknown visualization |
| `CRM_WIDGET_SERIES_INVALID` | 422 | Series count outside min/max |
| `CRM_WIDGET_DIMENSION_INVALID` | 422 | Metric does not declare that dimension |
| `CRM_WIDGET_SHAPE_INCOMPATIBLE` | 422 | Shape or `rowKind` mismatch |
| `CRM_WIDGET_UNITS_INCOMPATIBLE` | 422 | Mixed units without dual-axis support |
| `CRM_WIDGET_AXIS_REQUIRED` | 422 | Mixed units with a series missing `axis` |
| `CRM_WIDGET_TARGET_REQUIRED` / `_INVALID` | 422 | Gauges need a positive finite target |
| `CRM_WIDGET_COMPARISON_UNSUPPORTED` | 422 | Period comparison on a snapshot metric |
| `CRM_WIDGET_TIME_GRAIN_REQUIRED` | 422 | `dimension.key = "time"` with no grain |
| `CRM_DASHBOARD_TEMPLATE_INVALID` | 422 | Unknown template key |
| `CRM_SHARE_SELF_INVALID` | 422 | Sharing with yourself |
| `CRM_SHARE_TARGET_INVALID` | 422 | Target missing or not `ACTIVE` |
| `CRM_SHARE_EXPIRY_INVALID` | 422 | Expiry not in the future |
| `CRM_DASHBOARD_DRILLDOWN_SELECTION_INVALID` | 422 | `pointKey`/`seriesKey` not resolvable |
| `CRM_DASHBOARD_DRILLDOWN_UNSUPPORTED` | 422 | No strategy for that widget |
| `CRM_VALIDATION_FAILED` | 422 | DTO validation |
| `CRM_DASHBOARD_DRILLDOWN_PLAN_INVALID` | 500 | Server plan self-check failed |
| `CRM_DASHBOARD_DRILLDOWN_RESULT_INVALID` | 500 | Server result self-check failed |
| `CRM_DASHBOARD_REVISION_UPDATE_FAILED` | 500 | Revision bump returned nothing |

Dashboard edits and layout saves use `revision` in the request body. Widget
draft saves use the widget revision and the draft generation and revision.
When the saved state changes concurrently, reload the current state before
reapplying the intended changes.

## What will bite you

1. **`repWorkload` is retired.** It returns a retirement marker, with no task rows or counts.
2. **Sending the scope headers on the drill-down is a 400.** It declares
   `organizationScopeMode: NONE`, as does `GET /widgets/catalog`. Other routes
   in this family declare no organization scope mode.
3. **`POST /:id/run` answers 201, not 200.** So do `preview`, the drill-down,
   `duplicate`, `from-template` (POST), `create`, `clone` and both share
   creates. `DELETE /:id/placements/:placementId` answers **200 with a body**,
   while the other deletes answer 204.
4. **A run with failed widgets is still a 201.** Read `widgets[id].error`, not
   the HTTP status.
5. **Money is a JSON number here.** Every other CRM family sends decimal
   strings. Use `meta.unit`, not `typeof`.
6. **A typed P2 result has no `series`.** Five metrics return `result` only.
7. **`unavailablePlacements` is empty for a `VIEW` viewer**, and non-empty for
   an editor. It is not a count of "nothing wrong".
8. **`crm.dashboards.read` never arrives unscoped**, and `crm.widgets.read`
   never arrives scoped.
9. **Default and favourite are `.read` writes.** Hiding them behind
   `.update` hides them from every user who has only `.read`.
10. **`GET /dashboards/default` is read-only.** It selects an existing visible
    dashboard and returns 404 when none exists. Setup is the explicit
    `PUT /dashboards/from-template/CRM_DEFAULT`.
11. **The layout write needs the complete visible set**, and its overlap check
    includes placements the caller cannot see.
12. **`share-targets` needs the `.share` permission**, so a screen that offers
    sharing to a non-owner will 403 on the picker before the share itself.
13. **A sent `querySpec` replaces the stored one wholesale.** Omit it to keep
    the spec; send it only when the user edited the query. Rebuilding it from
    the fields your form models deletes the rest, with a 200 and no error —
    see [above](#patch-widgetsid-replaces-queryspec-wholesale--it-never-merges)
    and [D23](../build/DEFECTS.md#d23--editing-a-widgets-name-can-destroy-its-query-spec--fixed-2026-08-31).

## Portal status

| Capability | Status |
| --- | --- |
| Dashboard list, create, create-from-template, duplicate, delete | live — `/crm/dashboards` |
| Standard dashboard | live — `PUT /from-template/CRM_DEFAULT`, get-or-create, so pressing it twice leaves one |
| Open my default | live — `GET /dashboards/default`, read-only; returns 404 when none is visible |
| Default and favourite | live — optimistic, reverted on failure |
| Dashboard detail, run, filters, re-run | Live at `/crm/dashboards/[id]`. The centered filter dialog stages branch, period, comparison and currency until Apply. |
| Rename / describe | live — `PATCH /:id` with `revision`; a 409 opens `ConflictDialog` |
| Dashboard switcher | live — `GET /dashboards` plus catalogue template labels, in the filter bar; template actions require create permission |
| Per-widget partial failure | A failed or unavailable tile has a translated state. Independent widgets can still render. |
| KPI row | live — `StatCard`, its first consumer (G4) |
| Charts | The current 36 visualization IDs have native rendering paths for their compatible result shapes. See the capability boundaries below. |
| Chart table fallback | live — a real `<table>` with a `<caption>`, on every charted widget |
| Layout editing | Drag or use earlier/later to reorder. On desktop, canvas handles preview and commit local move or resize drafts. Keyboard-operable controls adjust the same geometry. Both check occupied cells, including unavailable placements. Save uses the captured dashboard revision. |
| Placements | live — add and remove |
| Drill-down | live — single-series widgets only, cursor-paged |
| Dashboard sharing | live — list, create, revoke, with the share-targets picker |
| Prebuilt reports | `/crm/dashboards/reports`, seven legacy routes and dedicated tabs for branch cohorts, conversion journey and won sales cycle. Live browser acceptance for the dedicated tabs is pending. |
| Widget authoring, clone, preview | The lifecycle source uses the six-stage builder to save a working draft and keeps preview scoped to dashboard read. Coordinated runtime verification is pending. |
| Widget sharing | live — `/crm/widgets/[id]` |
| Multi-series widget authoring | live — 1–4 compatible series with complete query/display preservation; unfaithful chart geometries use exact table fallback |
| `SEMANTIC_V1` widget authoring | retired and rejected by the current backend; persisted unsupported definitions remain safely readable |

## Current native rendering and proposal presentation boundaries (2026-11-05)

The portal has source adapters for all 36 current persisted visualization enums. Source/type/unit tests are distinct from authenticated browser and visual acceptance, which remain separate gates. Invalid, incomplete, unavailable or over-budget geometry shows a translated notice and keeps the exact accessible table when the payload contains usable evidence.

Native families are Cartesian/pie; six distinct target gauges; funnel and registered probability/amount/age XY; hierarchy, waterfall and histogram; category/typed ranked and scorecard views; intervals, UTC calendar/timeline, civil-day calendar heatmap; directed graphs supporting return transitions; and complete matrix heatmaps. Typed WATERFALL/SCORECARD are schema support without an active compatible current metric.

The six target variants use the actual positive goal, show above-target values, and invent no qualitative thresholds. Bubble area uses the current executor age rounded up and capped1–365days; XY is limited to the actual first1,000 opportunities ordered by amount. Waterfall uses server cumulativeValue. Hierarchy never adds parent totals to leaf area, and incomplete proportional hierarchies retain an exact-table boundary.

Current paired values are drawn on Cartesian axes and in separate matrix heatmaps. Exact tables keep previous keys/windows, typed units/currencies/references, histogram bounds/counts, waterfall cumulative values, ranks/statuses and interval instants. Missing and zero remain distinct. Money currencies have separate panels. Third comparison datasets remain a coordinated backend-contract dependency.

Interval responses currently lack a resolved calendar time zone at the widget boundary. Native calendar/interval views explicitly use UTC; the daily calendar heatmap uses the server civil date key. Non-daily grains do not become fabricated daily observations. Directed graph links count transition events and do not imply unique opportunity node totals.

The following48 proposal labels are reconciled explicitly. A geometry alias alone does not prove the proposed data, statistics, maturity, scope or policy contract. Empty current-enum mappings require a future presentation or composition contract; no table fallback is described as native support for those modes.

| Proposal label | Current geometry vocabulary | Source or semantic limit |
| --- | --- | --- |
| `LINE` | `LINE` | Current finite/null value plus paired previousValue/key/window; no third dataset yet. |
| `BAR` | `BAR` | Horizontal geometry, signed domain supported; report-specific source/denominator still governed. |
| `HEATMAP` | `HEATMAP` | Native cell grid possible; matrix/cohort semantics require exact server data. |
| `DIVERGING_BAR` | `BAR` | Signed comparative measure must be produced by registered backend recipe; do not derive growth from unrelated values. |
| `PROGRESS_CARD` | `PROGRESS_CARD` | Manual target current; governed goal approval/history needs future source. |
| `TABLE` | `TABLE` | Exact current series/P2 values; richer report source fields still require contracts. |
| `STACKED_BAR` | `STACKED_BAR` | Only additive same-unit/currency disjoint groups; no created+subset or rates stack. |
| `GROUPED_COLUMN` | `COLUMN` | Same units parallel series and current+matched previous datasets; third dataset future. |
| `METRIC_CARD` | `METRIC_CARD` | Current scalar plus authoritative previous comparison; report definition/source may be future. |
| `COLUMN` | `COLUMN` | True vertical bars, nullable values remain gaps. |
| `COHORT_MATRIX` | `HEATMAP` | Requires cohort-age grid, n/N, maturity and exclusions; current HEATMAP enum does not prove cohort dataset contract. |
| `BOX_PLOT` | `BOX_PLOT` | `DURATION_DISTRIBUTION` uses Q1, P50 and Q3 with observed min/max whiskers. The exact table includes P90, valid and excluded counts and all authorized groups. |
| `FUNNEL` | `FUNNEL` | Milestone conversion population needs server cohort recipe; current stage stock cannot imply conversion. |
| `COMPOSITE` | Future presentation/composition | Composition/container of independent panels, not a persisted visualization enum. |
| `DONUT` | `DONUT` | Only complete disjoint additive parts with exact denominator. |
| `HISTOGRAM` | `HISTOGRAM` | Current typed BINNED_DISTRIBUTION, count y-axis and exact money bounds. |
| `SANKEY` | `FLOWCHART` | Current GRAPH edge source/target/value supports flow layout; future report source adapters separate. Cycles need explicit safe graph treatment. |
| `PARETO` | `COMBO` | Needs authoritative cumulative proportion/eligible denominator; current geometry reuse does not register Pareto measure. |
| `BULLET` | `BULLET` | Actual value and target marker; do not invent qualitative threshold ranges. |
| `TREEMAP` | `TREEMAP` | Current HIERARCHY id/parentId/depth/value; children define disjoint area, parent totals not double-counted. |
| `CALENDAR` | `CALENDAR` | Current INTERVAL start/end only; opportunity closing-calendar recipe still needs registered date/event adapter. |
| `ALERT_LIST` | `ALERT_LIST` | Current scoped rows; saved alert policy/scheduling separate future capability. |
| `BUBBLE` | `BUBBLE` | Current XY probability/amount/age; generic axes need new semantic contract. |
| `COMBO` | `COMBO` | Declared series order first bar and remaining lines, axes/units explicit; convention documented, not new wire field. |
| `WATERFALL` | `WATERFALL` | Current declared typed steps START/DELTA/SUBTOTAL/TOTAL plus cumulativeValue; no live registered WATERFALL metric today. |
| `CALIBRATION_CURVE` | `LINE`, `SCATTER` | Geometry reusable; predicted/observed cohorts, bins, uncertainty and policy require new recipe/source. |
| `SCENARIO_BAND` | `LINE_AREA` | Interval/range-band data and forecast assumptions are future result semantics, not inferred from two ordinary lines. |
| `TIMELINE` | `TIMELINE` | Current INTERVAL or EVENT_STREAM; never invent missing dates. |
| `LEADERBOARD` | `LEADERBOARD` | Current CATEGORY or typed ROWS/RANKED with primary/secondary measures; no client-hidden-currency sum. |
| `DOT_PLOT` | Future presentation/composition | Generic categorical point axes are not current fixed probability/amount XY semantics; future presentation contract needed. |
| `QUADRANT` | Future presentation/composition | Generic axis/threshold definitions require source/policy contract; do not borrow fixed XY meanings silently. |
| `SCORECARD` | `SCORECARD` | Declared ROWS/SCORECARD measures/status/references schema; no currently registered compatible metric. |
| `SMALL_MULTIPLES` | Future presentation/composition | Container of repeated eligible chart views with shared scales; future report composition, not a new backend enum invented by frontend. |
| `UPSET_MATRIX` | Future presentation/composition | Requires exact intersection populations and membership incidence; current flat HEATMAP cannot manufacture overlap facts. |
| `SCOPE_TABLE` | `TABLE` | Geometry reuse; effective-scope proof/atomic membership payload still future W1. |
| `RELATIONSHIP_MAP` | `FLOWCHART` | Actual graph adjacency may be reused; graph cycles and entity relationship data need registered source policy. |
| `BOXED_BAR` | `BAR`, `BULLET` | Bounds/reference ranges need actual governed policy data; no fabricated benchmark. |
| `COVERAGE_STRIP` | `PROGRESS_CARD` | Coverage numerator/denominator/exclusions need registered result metadata, not vague frontend percentages. |
| `BRIDGE` | `WATERFALL` | Must receive authoritative additive bridge/decomposition steps and residual semantics. |
| `ANOMALY_BAND` | `LINE_AREA` | Observed/expected/robust-scale bands need source-produced statistics; two-line rendering alone is not anomaly support. |
| `STATUS_BOARD` | `SCORECARD` | Status/readiness/audit facts require actual policy source; no cached pretend success. |
| `EXPLAINER_DRAWER` | Future presentation/composition | Superseded presentation label: use centered explainer modal per no-drawer rule; scope/provenance/receipt backend dependency remains. |
| `CHANGE_LEDGER` | `TABLE`, `ACTIVITY_FEED` | Requires append-only actual audit/history; current mutable revisions are not historical facts. |
| `GEOGRAPHY` | Future presentation/composition | Current35 has no geographic/projection/coordinates contract; no invented place or coordinates. |
| `FLOWCHART` | `FLOWCHART` | Current GRAPH points retain edge metadata, source/target labels and count. |
| `ALIGNED_LINES` | `LINE` | Equal-age alignment/maturity requires server-produced cohort age index; current calendar pairing alone insufficient. |
| `GAUGE` | `SEMI_CIRCLE_GAUGE`, `THREE_QUARTER_GAUGE`, `CIRCULAR_PROGRESS_GAUGE`, `DETAILED_SPEEDOMETER` | Targets real; attainment labels may exceed100%, drawing clamped only with explicit value/scale. |
| `DUMBBELL` | Future presentation/composition | Paired numeric endpoint SVG grammar can be added later, but no current persisted display choice; do not silently call COLUMN a dumbbell. |

The catalogue returns optional `metrics[].drilldown` with `dimensionKey` and `requiresCurrency` directly from its 19 registered strategies. The portal uses this capability to enable single-series drill actions. Dashboard defaults, widget filters and runtime currency retain server precedence. The backend rechecks permission, population and revision on each drill request.

`crm.leads.converted.trend` is a time series of distinct lead conversion events with the tenant calendar grain. Its authorized empty buckets are zero. `crm.leads.converted.by_branch.count` groups those events by stable branch ID. Both use `converted_at`, support matched previous windows, and retain branch and owner restrictions. The trend drills by civil bucket, and the branch metric drills by branch ID. Both drill predicates keep the full widget window and current data scope. These counts are independent of currency and have no creation-cohort denominator.

`crm.leads.converted.median_conversion_duration` and `crm.leads.converted.p90_conversion_duration` use the same conversion-event population and percentile query. The current `DURATION` response uses minutes. A missing or backwards creation time is excluded and counted. An empty valid sample yields null. In a two-metric `MULTI_KPI`, the preview and saved tile render both statistics and the valid and excluded sample counts.

`crm.leads.cohort.by_source.eligible.count`, `crm.leads.cohort.by_source.converted.count` and `crm.leads.cohort.by_source.conversion.rate` use the same creation cohort. The observation cutoff is exclusive. A valid conversion can occur after the selected creation window and before that cutoff. All series carry the same per-source numerator and denominator. The exact-value table displays both counts even when only the rate is configured. For the three-series `COMBO`, put eligible and converted counts on the primary axis and rate on the other axis. The counts render as bars with integer ticks and the rate renders as a line on a 0–100% scale. Unknown or inactive source references and missing source assignments have distinct buckets. The folded Other bucket divides the summed numerator by the summed denominator. Period comparison and source drill for this report await a common bucket universe and explicit cohort evidence in drill receipts.

### Creation cohort progress

For CON03, select the three `crm.leads.cohort.progress.*.count` measures with the `time` dimension and one grain. Use `COLUMN` for grouped columns or choose `LINE` or `TABLE`. The series are `eligible`, `converted` and `remaining`. Preview and saved dashboards use the same catalogue and execution paths.

The selected date window is the lead creation window in the tenant time zone. A conversion at or after creation and before the exclusive run cutoff counts even when it occurred after the creation window. Remaining is the eligible count minus valid conversions at that cutoff. The calculation uses the viewer's current dashboard and lead access, narrowed by branch and owner filters. Authorized observed buckets with no leads show zero. Future buckets are excluded.

`details.cohortProgress` carries `eligible`, `converted`, `remaining`, `invalidIntervals` and `asOf`. Both the preview and saved tile display the cutoff. The exact-value table retains the three selected counts for each creation bucket. A conversion timestamp earlier than creation keeps the lead in the eligible and remaining counts and raises `INVALID_COHORT_CONVERSIONS`. The catalogue admits these measures with comparison `NONE`. Record drill requires a separate cohort evidence contract.

### Creation cohort conversion by branch

CON09 uses `dimension.key = branch` and the three `crm.leads.cohort.by_branch.*.count` measures in one grouped count panel. Use `BAR`, `COLUMN` or `TABLE`. Put `crm.leads.cohort.by_branch.conversion.rate` in a separate `BAR` or `TABLE` panel. Both panels use the same creation window, exclusive observation cutoff and current dashboard and lead access. The stable point key is the branch ID. Its display label includes the company name when available. The reports sort by eligible count, then label and branch ID.

The percentage bars use a 0–100% scale. The exact table includes the converted numerator and eligible denominator. The overall rate in `details.cohortProgress.rate` divides the total authorized converted count by the total authorized eligible count, and is null when there is no eligible cohort. The branch breakdown emits only branches with eligible leads. A branch with eligible leads and no observed conversions displays 0%. The widget comparison mode is `NONE`. The standalone report below provides company selection.

### Lead acquisition source mix

Verified against CRM, Gateway and portal source on 2026-11-11. Open **Lead sources** at `/crm/dashboards/reports?report=lead-sources`. The page posts `DashboardExecutionRequestDto` to `/api/tenant/crm/v1/dashboards/lead-source-mix-report` with `includePopulationOptions: true`. The upstream route is `POST /api/v1/crm/dashboards/lead-source-mix-report`, with HTTP 200 and read-heavy transport policy. It uses the existing dashboard and lead scope intersection for record data and selector options.

The `LEAD_SOURCE_MIX` template contains one `source-mix` panel using `crm.leads.by_source.count`. Its default is the last complete tenant civil month. The Builder starter is `lead-source-mix`. Saved templates and previews use the same count population and receipt as the Explorer. Pie and Donut now admit a full-width 12-column placement with a maximum height of 10 units so the chart and exact table fit together.

Each live lead created in the selected period contributes once to its current acquisition source. The exact result retains up to 100 named source identities, a separate `UNSPECIFIED` point and an `OTHER` tail when remaining sources exist. A retired source retains its identity and uses the unknown-or-retired label. `details.sourceMix` contains `total`, `unspecifiedCount`, `foldedSourceCount`, `attributionBasis: CURRENT_SOURCE` and `populationBasis: CREATED_IN_PERIOD`. Each point's metadata contains `numerator`, `denominator` and `sharePercent`. Shares are rounded to two decimals. The total row uses the total count and 100% for a nonzero denominator.

The frontend validates the denominator, each rounded share and the summed counts. Pie, Donut, Bar and the exact data view reuse one response. View changes use local presentation state. A zero total produces an empty chart and an unavailable total percentage. Existing saved period comparisons retain their previous-value table. Rounded row shares may sum slightly above or below 100%.

### Lead acquisition report

Verified against CRM, Gateway and portal source on 2026-11-10. Open **Lead acquisition** at `/crm/dashboards/reports?report=lead-acquisition`. It posts to `/api/tenant/crm/v1/dashboards/lead-acquisition-report`. Gateway forwards the request to `POST /api/v1/crm/dashboards/lead-acquisition-report` as a read-heavy operation with HTTP 200. Scoped `crm.dashboards.read` admits the route. The dashboard and lead grants are intersected before CRM reads the organization, team and owner options or lead data.

The request uses `DashboardExecutionRequestDto` with optional `filters` and `includePopulationOptions`. The Explorer sends `includePopulationOptions: true`. The shared dashboard date, company, branch, team and owner filters apply. An explicitly selected period applies across all three panels. Otherwise `monthly-intake` uses the last three complete tenant civil months, while `arrival-heatmap` and `source-growth` use the last complete month. Growth compares against the immediately preceding matched window. The Explorer shows each effective period and exact values. **Explain the calculation** describes the calendar, arrival bands and zero-baseline behavior. **View exact data** opens the arrival matrix as a table.

The response identifies `reportKey: LEAD_ACQUISITION` and returns the three ordered panel definitions and results by panel key, plus `generatedAt`, `filters`, `scope`, `organizationScope` and optional `populationScope`. The shared execution engine runs all panels in one read-only snapshot. Each panel retains its own readiness state. Report and panel keys identify this execution.

### Standalone branch cohort report

Verified against CRM and Gateway source on 2026-11-10. The branch cohort tab at `/crm/dashboards/reports` calls `GET /api/tenant/crm/v1/dashboards/lead-cohort-branches`. The owning CRM app route is `GET /api/v1/crm/dashboards/lead-cohort-branches`. Gateway classifies the operation as read-heavy. The server requires scoped `crm.dashboards.read` and intersects that scope with current `crm.leads.read` before returning company or branch choices or aggregating records.

`datePreset` uses the standard CRM date preset enum and defaults to `CURRENT_MONTH`. `CUSTOM` uses both inclusive tenant civil dates `dateFrom` and `dateTo` within the standard two-year limit. Optional `companyId` and `branchId` must be UUIDv7. Supplying both requires the branch to belong to the selected company and remain in the actor's authorized reporting scope.

The response contains `state`, `asOf`, `range`, `scope`, `rows`, `totals` and `warnings`. `scope` echoes the selected IDs and includes authorized active company and branch choices and `partialAccess`. Each ranked row contains branch and company identity, eligible, converted, remaining and rate. `totals` reconciles the ranked rows and includes `invalidIntervals`. `READY` includes populated rows. `EMPTY` is an authorized cohort with no eligible records and a null rate. `UNAVAILABLE` carries null totals and no organization choices. An unauthorized or mismatched selection returns `403 CRM_SCOPED_PERMISSION_DENIED`. Invalid query fields return validation errors. Database execution timeouts return `408 CRM_DASHBOARD_STATEMENT_TIMEOUT`.

The portal renders the same response in the summary, count and rate charts, and exact-value table. Charts show up to 12 ranked branches with an explicit notice when the exact table contains more. The table and totals retain every authorized result row. The browser does not retain a previous filter's results under a new selection. PostgreSQL acceptance and authenticated visual acceptance remain release gates.

### Conversion journey report

Verified against CRM, Gateway and portal source on 2026-11-10. The R66 tab uses `GET /api/tenant/crm/v1/dashboards/lead-conversion-journey`, forwarded to `GET /api/v1/crm/dashboards/lead-conversion-journey`. It accepts the same date, company and branch selections as the branch cohort tab. The result has one authorized scope and observation cutoff and two independently evaluated panels.

`duration` uses authorized conversion events in the selected civil period up to the exclusive observation cutoff. Its data provides median, P90, counts of valid and excluded intervals, and eight duration bands. Valid intervals include zero elapsed time. Finite bins have exclusive upper bounds at 1, 3, 7, 14, 30, 60 and 90 elapsed days. The final band starts at 90 days. API units are minutes, and the report displays elapsed days. The exact table retains every band and event count. The standalone `crm.leads.converted.conversion_duration.histogram` Builder metric uses `conversion_duration_bin` and the existing `HISTOGRAM` visualization. P50 and P90 share its duration sample.

`cohort` selects active leads created within the period and counts each converted lead with a readable linked opportunity whose current status is `WON`. Its availability and partial branch scope are independent of the duration panel. The report identifies both calculation bases, shows the current-win numerator and converted-lead denominator, and retains the exact outcome split. The portal clears earlier report values during scope changes and validates that counts reconcile before displaying a result. PostgreSQL and authenticated browser acceptance remain release gates.

### Won sales cycle report

Verified against CRM, Gateway and portal source on 2026-11-10. The R16 tab calls `GET /api/tenant/crm/v1/dashboards/won-sales-cycle`. Company and branch options come from the current dashboard and opportunity scope. The sample is further constrained by readable pipelines. The report uses the current `WON` state and the recorded `won_at` inside the selected civil interval and before the observation cutoff.

Overall P50 and P90 are calculated directly from valid observations across all included branches. Each branch keeps its own quartiles, observed whiskers and valid and excluded counts. The stacked chart counts exact observed durations. The chart shows elapsed days and the table retains minutes. The table preserves branch counts even when the chart groups additional series under Other authorized branches. Previous and next controls page up to 24 exact values at a time. `afterMinutes` must be the prior page's exclusive cursor. Each response contains a single observation instant for its statistics and frequency page.

The compare panel accepts two or three branches with valid samples in the current report. It shows sample counts, P50, P90 and median difference to the first selected branch. Changes to date or organization filters discard earlier values and reset the frequency cursor. Live authenticated visual and PostgreSQL acceptance remain release gates.

### Team lead cohort comparison

The Teams tab on `/crm/dashboards/reports` reads `GET /api/tenant/crm/v1/dashboards/lead-team-cohort`. Apply a creation date range and a company, one branch, or up to 20 selected branches. Compare one to three eligible teams. Team choices and counts use current team coverage intersected with the viewer's dashboard and lead access. Team rows use active members and the lead's current branch and owner. Changing the organization or date filters resets the team selection.

The chart uses one count axis for created and converted leads. The exact table and separate badges show conversion rates. The overall cards count distinct leads and display how many contributions the team rows share and how many extra contributions were removed. For three teams, the overlap card also shows how many leads are shared by exactly two teams and by all three. Active-seller and per-seller measures require historical staffing data and appear as unavailable. The page distinguishes an authorized empty selection, insufficient team scope, and a temporarily unavailable coverage source. The authenticated browser and PostgreSQL release checks remain pending.

### Sales target registry

The CRM Gateway source exposes list and create at `/api/tenant/crm/v1/targets`. Read, update and retirement use `/api/tenant/crm/v1/targets/{id}`. The list requires `branchId`. A target binds a user, team or branch to one metric and aligned calendar month, quarter or year. Money targets require a currency. The list and detail responses preserve `targetValue` as a two-place decimal string. List results use current target grants for the requested branch and include only authorized subjects.

Create and update send a JSON number for `targetValue`. Update also sends the last observed `revision`. Handle `CRM_TARGET_DUPLICATE` by opening the existing live target and `CRM_TARGET_REVISION_CONFLICT` by reloading its current revision. Retirement leaves audit history and permits a new target for the same tuple. The management UI remains pending. The source routes depend on coordinated schema and permissions adoption.

### Won estimated value against targets

The **Sales target attainment** tab uses `GET /api/tenant/crm/v1/dashboards/won-target-attainment`. Select an aligned civil month, quarter or year with optional company, branch and subject. The endpoint returns `period`, `coverageStartedAt`, current target `revision`, `rows`, per-currency summaries and a `pace` reason. The portal checks decimal arithmetic and scope before showing the exact table. Compare up to three currencies on independent money axes. Changing the displayed currencies leaves the exact table intact. An authorized zero uses `0.000`. A null actual uses a localized unavailable state and a target-only row.

Periods before capture, insufficient opportunity authority, invalid money data, unavailable team history and future periods have distinct row states. Currency totals are withheld when a row for that currency is incomplete. Team rows retain each visible target with separate scope. The report labels the value as the current target and shows its revision. Authenticated visual acceptance awaits the live release.

### Branch working calendars and required pace

Managers open **Manage branch calendars** in the Sales target attainment tab. The branch and civil year identify a calendar. Apply a workweek pattern, then adjust individual dates for holidays and special working days. Publishing creates an immutable revision. The report refreshes after a verified publication.

`GET /api/tenant/crm/v1/targets/working-calendars/{branchId}/{year}` reads the current revision. An unpublished year returns `revision: 0` with null `workingDays` and `publishedAt`. `POST` to the same path publishes a full calendar and returns HTTP `201`. The request carries `expectedRevision` and `workingDays`. Use revision `0` for the first publication. The string contains exactly 365 or 366 characters, in civil date order from January 1. `1` marks a workday and `0` marks a non-working day. Both routes require target management authority in the requested active branch. Stale writes return `CRM_WORKING_CALENDAR_REVISION_CONFLICT` with HTTP `409`. Reload the published calendar before another attempt. The publication and its audit event commit together.

The report reads the latest published calendar for each visible target branch in the report’s tenant civil time zone. For an open period, `workingPace` carries `state`, `calendarRevision`, `remainingWorkdays` and `requiredPerWorkday`. It counts full working days after the observation date and before the exclusive period end. A positive denominator and available actual give `max(target − actual, 0) ÷ remainingWorkdays`, rounded up to three decimal places in the target currency. Zero remaining workdays, missing calendar, unavailable actual and closed or future periods carry distinct states. Pace is presented per target because branches can have different workdays. The currency summaries continue to describe attainment and remaining value.

### Daily won value and remaining plan

In **Won value and remaining plan**, choose one target from the current report. The same GET accepts its UUIDv7 as `trajectoryTargetId` and returns `trajectory: { targetId, points }`. The field is null without a selection or when the target is outside the authorized report. A visible target with unavailable actuals returns an empty point list and keeps its report row reason.

Each point has a civil `date`, `wonValue`, `observedCumulative`, `plannedCumulative` and `isPlannedWorkday`. Money values are exact three-decimal strings in the selected target currency. The bars and observed line use authorized recorded wins up to the report snapshot. The dashed plan starts at the observation-date cumulative value, adds the required pace on published future workdays, and caps at the current target or the actual already above it. Non-working dates carry the previous plan value. Closed periods, missing calendars and periods without remaining workdays show the observed series when available. Future actuals and historical plan values are null. View exact daily data for the complete civil dates and unrounded amounts. One response contains at most 366 points.

The Widget Builder offers **Daily won value and target plan** (`crm.opportunities.won.target.trajectory`) as a standalone measure for **Combo**. Its catalogue definition requires `dimension.key = time`, `dimension.grain = DAY` and `comparison.type = GOVERNED_TARGET`. Select a target in the comparison step to bind its branch, subject, native currency and complete period. One configured measure supplies the observed bars, observed cumulative line and remaining plan. Other Combo measures retain the normal two-series minimum.

Preview and published dashboard run return `shape: TIME_SERIES`, `meta.timeBasis: SNAPSHOT` and `governedTarget.measure: TRAJECTORY`. `governedTarget.trajectory` contains the tenant `timeZone` and the same exact daily `points` as the report, and is null when actuals are unavailable. Chart geometry comes from this evidence. The generic `series` array is empty and the scalar `value` is null. The Builder preview and dashboard's data table show exact values. A shared viewer's current dashboard, target and opportunity permissions govern their own result.

### CRM sales targets in the Widget Builder

Choose the **Won opportunity value** metric and a target visualization. The comparison step can browse authorized target records by branch, period grain and subject type. Selecting a record uses its complete civil period as a widget date filter. The scope step can change that period, and the dashboard can apply its own runtime dates. The saved query stores `comparison.type = GOVERNED_TARGET` and `comparison.governedTarget` with `branchId`, `subjectType`, `subjectId`, `currencyCode` and `periodGrain`. The amount comes from the matching live target revision at execution time. Existing manually entered targets use `comparison.type = TARGET` and `comparison.target`.

Preview and published dashboard execution use the viewer's dashboard and target permissions. The actual applies the report's recorded won-event, opportunity and pipeline checks. The period must align exactly to the saved grain. A pipeline filter or conflicting branch, owner or currency returns `FILTER_MISMATCH`. Misaligned periods return `PERIOD_MISMATCH`. Missing or unreadable target records return `TARGET_UNAVAILABLE`. Team targets can show the authorized denominator while historical team actuals remain unavailable.

The scalar execution response includes `governedTarget` with `measure`, `state`, `basis`, native `currencyCode`, the exclusive period bounds, `periodState`, `coverageStartedAt`, `revision` and exact `amounts`. The attainment gauge uses `measure: ATTAINMENT` with null `workingPace`. A chart plots numeric geometry only when the outcome is ready. Labels use the decimal strings, including a real zero. Governed widgets use recorded won-event evidence and have no current-opportunity record drill. Live acceptance requires the matching database and portal release.

### Required sales value per workday widget

Select **Required sales value per workday** (`crm.opportunities.won.target.required_per_workday`) as the sole metric of a `METRIC_CARD` with dimension `none`. In the Comparison step choose a CRM sales target. The picker reads targets defined for the underlying won opportunity value measure. The saved query uses `GOVERNED_TARGET` and the branch, subject, currency and grain binding. The complete civil period and the viewer's current permissions apply to both preview and published dashboard execution.

The governed evidence uses `measure: DAILY_PACE`. Its `workingPace` matches the report row for the bound target. The scalar `value` is the numeric rate per workday when available. The card and exact table use the decimal evidence and show remaining workdays and calendar revision. A missing calendar, a period with zero full remaining workdays, unavailable actuals or a closed/future period can leave the rate unavailable while the target evidence is available. An achieved target with remaining workdays gives a real zero. The pace result carries no scalar `target`, since the target amount and daily rate have different units.

### Duration box plots

Verified against CRM and portal source on 2026-11-10. Configure `BOX_PLOT` with one metric. Use `crm.leads.converted.conversion_duration.box_plot` with `none` for CON05 or `crm.opportunities.won.cycle_duration.by_branch.box_plot` with `branch` for the R16 Builder measure. The conversion measure shares its sample with the R66 histogram, median and P90. The cycle measure uses readable current `WON` records whose `won_at` falls within the selected civil dates and before the observation cutoff. Each branch has an independent sample, and the actor's branch, owner and pipeline access constrain the result.

The wire shape is `DURATION_DISTRIBUTION` with `unit: DURATION` and `whiskerMethod: MIN_MAX`. Each group carries `key`, `label`, `sampleCount`, `excludedCount`, `min`, `q1`, `median`, `q3`, `p90` and `max`. Values are in elapsed minutes. Q1, P50, Q3 and P90 use continuous interpolation. A group with only excluded records has null duration statistics. Equal observed values render as a single marker. The plot shows up to 12 populated groups on a common scale, while the exact table retains all groups and source values. PostgreSQL and authenticated browser acceptance remain pending.

### Converted lead cohort with a current won opportunity

CON07 uses `crm.leads.cohort.won_link.converted.count`, `crm.leads.cohort.won_link.current_won.count` and `crm.leads.cohort.won_link.current_won.rate` with the `none` dimension. Use `METRIC_CARD`, `MULTI_KPI` or `TABLE`. The standalone `crm.leads.cohort.won_link.funnel` uses `lead_conversion_milestone` with `FUNNEL`, `BAR`, `COLUMN` or `TABLE`. The standalone `crm.leads.cohort.won_link.outcomes` uses `lead_won_link_status` with `BAR`, `COLUMN`, `DONUT` or `TABLE`. Comparison is `NONE`.

The creation window selects active leads. Valid conversions occur at or after creation and before the exclusive observation cutoff. A converted lead enters the winning subset once if any active opportunity linked to it in the same branch currently has `WON` status and the viewer can read the opportunity and its pipeline. The date and owner filters select the lead cohort. Opportunity owners are evaluated against their own grants, independently of the selected lead owner. Only branches with both source scopes enter the aggregate. Missing joint authority or missing readable pipelines returns `UNAVAILABLE`. An authorized positive conversion denominator with zero readable wins has a 0% rate. An empty conversion denominator has a null rate.

`details.leadWonCohort` supplies `created`, `converted`, `won`, `withoutReadableWin`, `rate`, `invalidIntervals`, `asOf` and `outcomeBasis: CURRENT_WON`. The preview and saved tile label the outcome as current and display the observation cutoff. The `withoutReadableWin` count is the converted population minus the readable winning subset. The timestamp bounds lead creation and conversion observations. The opportunity status is read at execution time.

### Monthly cohort maturity

`crm.leads.cohort.by_month.maturity.rate` uses the `cohort_month` dimension. The catalogue admits it as the sole configured measure in a `HEATMAP` or `TABLE`. It generates D7, D14 and D30 series in one execution. It uses the tenant civil month for creation cohorts and elapsed 24-hour days for lead age. A valid conversion is at or after creation, at or before the age threshold and strictly before the observation cutoff. A full month matures when the month-end instant plus the horizon has elapsed. The report uses active leads under the viewer's current lead and dashboard access, with the branch and owner filters applied.

Clipped, future and open months produce null percentages and no sample counts. A closed, fully selected month can show its eligible count before an age horizon matures. Mature months with no eligible leads produce null, while a positive eligible sample with zero conversions produces 0%. Leads with invalid chronology or a missing conversion timestamp remain in the denominator and are excluded from the numerator. Each point carries `meta.cohortMaturity` with `days`, `numerator`, `denominator`, `reason` and `matureAt`. The detail summary carries the exclusive cutoff, tenant time zone, exclusions and weighted D30 totals across mature cohorts with eligible leads. The table retains the exact counts and maturity reasons. This measure has no target, previous-period comparison or record drill capability.

### Two- and three-dataset conversion event comparisons

The catalogue's `crm.leads.converted.trend.datasetComparison` declares supported `PERIOD` and `BRANCH` bases and `LINE`, `COLUMN` and `TABLE` visualizations. Configure one metric with a time grain and `comparison.type = DATASETS`. The comparison contains `basis` and two or three `datasets`. For `PERIOD`, every dataset contains an existing `datePreset`, plus both civil `dateFrom` and `dateTo` for `CUSTOM`. For `BRANCH`, every dataset contains only `branchId`. The first dataset is the baseline. Selections must be distinct, including after period presets resolve in the tenant time zone.

Explicit periods supply their own dates while branch comparisons use the active dashboard/widget/runtime window. Both bases retain the current dashboard/source intersection and owner restriction. Branch filters can further narrow the requested branches. Only authorized selected branch IDs enter the name and data queries. Unavailable branch datasets retain null values and a generic label. A denied dataset cannot contribute a count or a difference.

Execution reuses the existing converted-lead event executor in one bounded transaction, with an exclusive observation cutoff shared by all datasets. Each dataset is limited to 333 time buckets. `PERIOD` aligns bucket ordinals `P1`, `P2` and so forth. The table retains each point's actual civil source date. Trailing unmatched buckets remain null. Authorized observed buckets with no conversions remain zero. Partial buckets retain their observed count, and period differences require complete matched buckets. Complete same-length periods support total differences. Branch datasets share the same observed window and can compare its counts. A zero baseline produces no relative change.

`details.datasetComparison` contains the basis, grain, time zone, observation cutoff and entries with totals and total differences. Points carry `meta.datasetPoint` with source dates, observed bounds, completeness, absolute difference and missing reason. The saved tile and Builder preview use the same localized summary, exact table and chart. This mode requires dataset-specific drill evidence before record drill is admitted. The broader canonical recipe registry still needs release bindings and governed hierarchical scope.


## Acquisition quality source update — 2026-11-11

ACQ05 is `crm.leads.created.missing_source.rate`: the scoped creation cohort is counted once; the numerator is its rows whose current `acquisition_source_id` is null. The percentage is rounded to two decimals. A positive denominator with zero missing sources returns measured zero; zero denominator returns null with NO_DATA/EMPTY. `details.populationShare` carries numerator, denominator, sharePercent, CREATED_IN_PERIOD and CURRENT_SOURCE. Its catalogue `populationShare: true` capability admits PROGRESS_CARD without a target, and METRIC_CARD. It remains standalone with NONE comparison. Other gauges and progress metrics retain their target requirements.

ACQ08 is `crm.leads.created.by_current_rating.count`, dimension `lead_rating`: leads created in the selected period grouped by current rating 0..3. Zero means unrated; labels are zero/unrated, one star, two stars and three stars, not high/medium/low. A nonempty cohort includes all four groups, including genuine zero counts. Point metadata includes numerator, denominator and rounded sharePercent. `details.currentRatingMix` carries total, CREATED_IN_PERIOD, CURRENT_RATING and min/max 0/3. Empty cohorts return no distribution points and NO_DATA/EMPTY. It is standalone, NONE comparison, and supports STACKED_BAR, BAR, COLUMN, DONUT and TABLE. The stacked view shows one cohort split into the four rating groups; the exact table includes all groups and the total.

Both measures use the existing readonly run/preview engine, dashboard/lead permission intersection, current branch/owner scope and half-open created_at window. Updating a current source or rating later changes this result; neither metric reconstructs values at creation. Portable Builder starters are `lead-missing-source-share` and `lead-current-rating-mix` (LAST_MONTH/NONE). Preview and saved dashboard tiles share validated evidence, summaries, charts and exact tables in both locales. No new endpoint, table, migration or library is needed for these two metrics.

### R53 inquiry quality

Open **Inquiry quality** at `/crm/dashboards/reports?report=inquiry-quality`. The page posts the current filter selection to `/api/tenant/crm/v1/dashboards/lead-acquisition-quality-report` with population options enabled. It renders the three panels `missing-source-share`, `current-rating-mix` and `inquiry-classification` from the same execution period. The portable starter `lead-inquiry-classification` and template `LEAD_ACQUISITION_QUALITY` reuse the same source.

The classification counts first observed, repeat, awaiting review and before observation began. A strictly earlier approved observation establishes repeat, and ties at the first instant count as first observed. The response returns counts and coverage metadata. Viewers use `crm.inquiry_identities.classification.read` in addition to their current lead and dashboard read scope. Narrower classification grants can reduce that panel's denominator. The client reconciles all counts, shares and period evidence before rendering.

The classification panel shows an unavailable state when the permission or source is missing. The other two panels stay visible. The classification source uses the staged inquiry observation and review schema and the candidate common permission catalogue. Runtime adoption, real PostgreSQL acceptance, role and share coverage, and UI-authored persona seeds and provisioning remain release requirements.

### R54 intake allocation

Open **Intake allocation** at `/crm/dashboards/reports?report=lead-intake-allocation`. The page posts to `/api/tenant/crm/v1/dashboards/lead-intake-allocation-report`. It sends optional organization and civil date filters, one to three `comparisonOwnerIds`, a separate `queuePeriod`, and a `queueCursor` from the previous receipt. A filter change clears the selected reps and cursor. Changing the queue period clears its cursor.

The intake period defaults to the last complete tenant month. The queue defaults to the complete tenant month before that. The report returns its observation time, both effective periods, the current organization scope, and the exact count of visible leads created in the intake period. Owner attribution uses current ownership. Selected reps, other assigned owners and unassigned leads sum to that total. The picker offers the top 50 owners by intake with explicit selections retained. Each rep's created count equals converted by observation plus remaining. Invalid and missing conversion dates are included in remaining and disclosed separately.

The queue returns current open, unassigned rows under full read access to both dashboards and leads. It shows coverage when selected branches have mixed access. Each receipt contains a count and up to five rows from the same database snapshot. Pagination uses the exact creation timestamp and lead ID. The cursor is valid for the same tenant, actor, full-read branch set and queue window. The queue is live across requests, so assigning or closing a lead may change the next receipt.

The queue displays the lead link, branch, source, creation date and open status in a table at 384px and wider. Below 384px it uses a list of lead records with the same fields and pagination controls.

The Builder catalogue offers **Intake by current owner** (`lead-owner-allocation`) and **Rep intake and conversion** (`lead-owner-conversion`). Both start with a column chart, owner dimension, last complete month and no period comparison. The allocation preview uses the top three current owners, an exact Other bucket and an Unassigned bucket. The conversion preview groups created, converted and remaining as three outcome series for the top three owners. The report page also allows explicit rep selection and a separately dated queue. These controls are part of the report endpoint. Both Builder starters use the existing chart and table libraries.

### R55 lifecycle Builder starters

`lead-cohort-current-status`, `lead-cohort-current-stage` and `lead-cohort-qualified-open` start with a donut, column chart and metric card respectively. They default to the last complete tenant month. The preview measures the current status, stage or open qualification of retained leads created in that period. The status and stage views count the same creation population. The qualified card uses the current qualification flag on each lead. These recipes use the standard catalogue and preview endpoints.

`POST /api/tenant/crm/v1/dashboards/lead-lifecycle-inventory-report` runs all three views from the same source snapshot. It accepts optional execution filters and `includePopulationOptions`. The HTTP 200 receipt uses `reportKey: LEAD_LIFECYCLE_INVENTORY` and the ordered keys `current-status`, `current-stage` and `qualified-open`. Open the report at `/crm/dashboards/reports?report=lead-lifecycle` or select **Lead lifecycle** in Reports Explorer. The **Current Lead Lifecycle** dashboard template uses the same metrics and is offered when returned by the authorized catalogue.

The report validates scope, civil dates, observation time and counts before presenting the status donut, stage distribution and qualified backlog. The status table includes counts and shares. The stage table includes each returned group's total, open and on-hold counts. The qualified card includes the current qualified denominator and a breakdown by status. Below the desktop layout the cards stack and the stage bars are horizontal. Large stage populations display the first seven groups and a remaining-stages bar, with every returned group in the table.

Builder previews and saved widgets use the same evidence tables and qualified denominator. A readable empty period has a single Explorer empty state and permits filter changes. A denied request clears the previous result and filter options. Existing runtime packages, APIs and chart libraries supply this flow.

## Inquiry identity review contract — 2026-11-11 source candidate

Gateway admits GET and POST `/api/tenant/crm/v1/dashboards/inquiry-identities/:leadId`. The CRM controller, service, DTOs, immutable journal and scoped tests define the contract. Reports Explorer opens a bilingual review dialog once the tenant owner's permission catalogue includes the management key or the actor holds a tenant-wide management grant. The matching database and permission packages are required for authenticated acceptance.

The dialog selects the inquiry and reference independently by branch and name. Its picker uses the current lead list with a branch filter, bounded pages and `searchField=lead`. It keeps the selected name, branch and creation time for comparison and opens the original inquiry records in separate tabs. Linking requires another inquiry with a currently approved identity and a compatible profile. The client rechecks the reference before sending a new link command.

The dialog re-reads current context after a receipt or conflict. An ambiguous write keeps the original payload and request ID in the open dialog for explicit reconciliation. Ordinary dismissal is disabled while the result is outstanding. A fresh authorized context read drives the visible review state and paged history. Loss of the management grant or a change of actor clears the dialog.

Both operations require tenant-only `crm.inquiry_identities.manage` (or the active tenant owner) plus complete active-company/branch lead read/update ALL coverage. Dashboard edit/share permission does not grant identity management. The static key is in common candidate 0.0.8; runtime still pins 0.0.7. Backend admission is authoritative.

GET takes UUIDv7 leadId and optional beforeRevision (integer 1..2147483647). It returns leadId, nullable leadName, branchId, INDIVIDUAL/CORPORATE profileType, state, coverageStartedAt, nullable sourceRevision/current, history (maximum 25 descending decisions), hasMore and nullable nextBeforeRevision. States: HISTORY_UNAVAILABLE, UNREVIEWED, REVIEWED, SOURCE_CHANGED. Paging history never replaces the separate current decision. A missing observed creation cannot be reviewed or classified as first-time.

POST sends only requestId (UUIDv7), mode (NEW/LINK), expectedRevision (JSON integer 0..2147483646), expectedSourceRevision (JSON integer 1..2147483647), reason and conditional targetIdentityId (UUIDv7). NEW omits targetIdentityId; LINK requires it. First NEW uses VERIFIED_DISTINCT; first LINK uses VERIFIED_SAME; later reviews use CORRECTION. The target is an immutable established identity, not a Party/customer merge or an automatic name/contact match.

Both first commit and exact replay answer HTTP 200 `{ decision, replayed, requiresContextReload: true }`. A decision contains id, leadId, revision, sourceRevision, identityId, nullable requestedIdentityId/previousIdentityId, actorUserId, reason and decidedAt. Runtime-validate the receipt against the exact command. **Always reload GET current context** before displaying a current approval or enabling another review. A replay deliberately returns the historical receipt after a later correction/source change; it is not current approval. Retain requestId unchanged for explicit identical outcome reconciliation. Never automatically retry the write or issue a fresh request ID after an ambiguous outcome.

Errors: 403 CRM_PERMISSION_DENIED / CRM_INQUIRY_REVIEW_SCOPE_REQUIRED; 404 CRM_INQUIRY_NOT_FOUND / CRM_INQUIRY_IDENTITY_NOT_FOUND; 409 CRM_INQUIRY_DECISION_CONFLICT / CRM_INQUIRY_HISTORY_REQUIRED; 422 CRM_INQUIRY_DECISION_INVALID; 503 CRM_INQUIRY_SOURCE_NOT_READY. Show permission denial separately from unavailable source/history and genuine empty search. A stale source/review requires reload. No raw UUID is needed in normal product copy; select records by readable name and branch, and resolve an existing identity through its currently reviewed inquiry context.

GET is READ_HEAVY with safe retry. POST is WRITE_SENSITIVE with transport replay disabled. The review and derived aggregate each have their own admission. Both use the existing portal component libraries.
