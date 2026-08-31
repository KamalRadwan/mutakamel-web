# CRM — Dashboards & Widgets

Status: **verified**

Last source verification: **2026-08-31**

Owning app: **crm-app**

Canonical prefix: `/api/tenant/crm/v1/dashboards`, `/api/tenant/crm/v1/widgets`

Portal status: **built** — Phase 9, all 40 routes called. Not exercised against
a live session: CRM is blocked twice over, by P4 and by
[Q17](../build/OPEN-QUESTIONS.md).

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
| **Dashboard builder** | 23 | Dashboards, placements, layout, execution, drill-down, sharing |
| **Widgets** | 10 | Reusable widget definitions, preview, clone, sharing |

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

| Method | Canonical path | Permission | Success |
| --- | --- | --- | --- |
| POST | `/api/tenant/crm/v1/widgets/preview` | **`crm.dashboards.read`** (scoped) | **201** |
| GET | `/api/tenant/crm/v1/widgets/share-targets` | `crm.widgets.share` | 200 |
| GET | `/api/tenant/crm/v1/widgets` | `crm.widgets.read` | 200 |
| POST | `/api/tenant/crm/v1/widgets` | `crm.widgets.create` | **201** |
| GET | `/api/tenant/crm/v1/widgets/:id` | `crm.widgets.read` | 200 |
| PATCH | `/api/tenant/crm/v1/widgets/:id` | `crm.widgets.update` | 200 |
| DELETE | `/api/tenant/crm/v1/widgets/:id` | `crm.widgets.delete` | **204** |
| POST | `/api/tenant/crm/v1/widgets/:id/clone` | `crm.widgets.create` | **201** |
| GET | `/api/tenant/crm/v1/widgets/:id/shares` | `crm.widgets.share` | 200 |
| POST | `/api/tenant/crm/v1/widgets/:id/shares` | `crm.widgets.share` | **201** |
| DELETE | `/api/tenant/crm/v1/widgets/:id/shares/:shareId` | `crm.widgets.share` | **204** |

Complete list: [crm-reference.md](crm-reference.md).

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

**None of these 40 routes is `BRANCH_REQUIRED`.** 39 declare no
`organizationScopeMode` at all, and the Gateway's
`RouteContextMiddleware.validateOrganizationScope` returns early for a route
with no mode, so the headers are simply ignored.

The exception runs the other way:

```text
POST /dashboards/:id/widgets/:widgetId/drilldown   organizationScopeMode: NONE
```

`NONE` means **neither header may be present**. Sending
`x-mutakamel-company-id` or `x-mutakamel-branch-id` on the drill-down is a
**400 `GW.REQUEST.INVALID`** before crm-app sees the request — the exact
inverse of defect D11, and the reason a shared "always attach the scope
headers" helper must not be pointed at this family.

`branchId` here is an ordinary **optional filter**, in the query on the seven
prebuilt reports and in `filters` on the builder. Standing rule S2 — *every CRM
list requires `branchId`* — does not reach these routes, because none of them
is a paginated list.

## Idempotency

`WRITE_SENSITIVE` **and** `idempotent: true` is the pair that makes the Gateway
reserve a key; without one, the answer is `GW.IDEM.MISSING`. Six routes qualify:

```text
PUT    /dashboards/from-template/:templateKey
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

## Pagination — there is almost none

| Route | Paging |
| --- | --- |
| `GET /dashboards`, `GET /widgets`, `GET /dashboards/navigation` | **None.** One array of everything visible |
| `GET /:id/shares`, `GET /widgets/:id/shares` | **None** |
| `GET /dashboards/share-targets`, `GET /widgets/share-targets` | `limit` + `offset`, and a `nextOffset` only when a category filled its page |
| `POST /:id/widgets/:widgetId/drilldown` | **Cursor.** `pageInfo: { limit, hasMore, nextCursor }` — no total |

`share-targets` pages **users and teams with the same offset**, so page 2 can
legitimately contain one category only.

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

Request body — `RunDashboardDto`: `filters?` (a `DashboardFiltersDto`) and
`widgetIds?` (max 20 UUIDv7; a widget not on the dashboard is
`422 CRM_DASHBOARD_WIDGET_SELECTION_INVALID`).

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

`meta.warnings` is a string array. `CURRENCIES:` is a **prefix carrying data**,
not a constant:

| Warning | Means |
| --- | --- |
| `WIDGET_EXECUTION_FAILED` | This widget's query was rolled back |
| `SOURCE_PERMISSION_REQUIRED` | The metric needs a source resource the actor cannot read |
| `CURRENCY_FILTER_REQUIRED` | Multi-currency money on a shape that cannot show a split; the data is **blanked** |
| `MULTI_CURRENCY_SPLIT` | Values are split per currency, not summed |
| `CURRENCIES:EGP,USD` | The currencies present, appended when more than one |
| `RESULT_TRUNCATED` | Cut off at the server's row cap |
| `MISSING_AMOUNT` · `INVALID_AMOUNT` · `MISSING_CURRENCY` | Rows excluded from an aggregate |
| `MISSING_PROBABILITY` · `INVALID_PROBABILITY` | Same, for value-vs-probability |
| `NO_SOURCE_RECORD_ACCESS` · `PARTIAL_SOURCE_ACCESS` | The action-centre feed could reach none / some of its three sources |

`CURRENCIES:` is the **only** honest source for a currency picker on a CRM
dashboard screen: there is no currency catalogue reachable from `/crm`, and
`CURRENCY_FILTER_REQUIRED` blanks a widget until one is chosen.

## Money is a number here, not a decimal string

Standing rule S5 says never `Number()` a decimal string. **These routes never
send one.**

- Every money aggregate in `dashboards.service.ts` is cast `::float` —
  `COALESCE(SUM(o.amount), 0)::float AS value`, `o.amount::float AS value`.
- Every point in `dashboard-execution.service.ts` goes through
  `toPoints`, which does `value: Number(row.value ?? 0)`; the scalar goes
  through `Number(firstData[0].value)`.

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

## Widget definitions

`CreateWidgetDto`: `name` (1–120), `visualizationType` (one of 34),
`querySpec`, `displaySpec?`. `UpdateWidgetDto` is the same plus a **required**
`revision`, and every field is optional-with-`ValidateIf`, so an omitted key
keeps its stored value.

### `PATCH /widgets/:id` replaces `querySpec` wholesale — it never merges

**This is the single most damaging thing to get wrong in this family, and it is
what produced [D23](../build/DEFECTS.md#d23--editing-a-widgets-name-can-destroy-its-query-spec--fixed-2026-08-31).** Read this before writing a
widget editor.

There are exactly two behaviours, and the difference is *omission*, not
partiality:

| What you send | What happens to the stored `query_spec` |
| --- | --- |
| No `querySpec` key at all | **Preserved untouched.** `dashboard-widgets.service.ts:102` computes `dto.querySpec ?? current.querySpec` from a `SELECT` taken inside the same transaction |
| Any `querySpec` | **Replaced in full.** The object you send becomes the stored spec. Every key you did not send is gone |

There is **no field-level merge**. Sending `{ series, dimension }` on a widget
that stored `{ series, dimension, filters, comparison }` does not update two
fields and keep two — it stores exactly `{ series, dimension }` and the other
two cease to exist. The same is true of `displaySpec`.

So the rule for any client is:

> **Send `querySpec` only when the user edited the query.** A metadata-only
> change — a rename — sends `{ revision, name }` and nothing else.

A client that "helpfully" rebuilds the spec from the fields its form models
**destroys everything it did not model**, silently, with a 200 and a bumped
revision. There is no server-side error for this, because a narrower spec is a
perfectly valid spec. What is lost, concretely:

- **`filters`** — the stored `DashboardFiltersDto`. Seven of the 80 widgets in
  the eleven built-in templates carry one.
- **Series 2–4.** `series` is 1–4 items. Four template widgets ship two, and
  none of them is a `MULTI_KPI` or a `COMBO` — they are `COLUMN` and
  `LINE_AREA`, whose `minSeries` is 1, so nothing about the widget's type warns
  a single-series form that it is about to narrow one.
- **Per-series `axis`, `label` and `color`**, which a form that models only
  `metricKey` cannot reproduce.
- **The whole `SEMANTIC_V1` envelope** — `engine`, `semanticVersion`, `source`,
  `semanticFilters`, `topN`, `maxPoints`. And because `schema_version` is
  recomputed from the spec that lands (`engine === 'SEMANTIC_V1' ? 2 : 1`),
  dropping `engine` also **silently downgrades the row's `schemaVersion` from 2
  to 1**.

Two further consequences worth stating, because they are not obvious:

1. **Echoing the stored spec back is not a safe substitute for omitting it.**
   crm-app runs `whitelist: true, forbidNonWhitelisted: true`
   (`crm-app/src/main.ts:48`), so a stored spec carrying any key
   `DashboardWidgetQuerySpecDto` does not model comes back as a
   **400 `CRM_VALIDATION_FAILED`**, not a silent strip. Omission cannot fail
   this way. Prefer it.
2. **`name` and `displaySpec` are guarded in SQL; `querySpec` and
   `visualizationType` are guarded in TypeScript.** The `UPDATE` writes
   `name = CASE WHEN $3 THEN $4 ELSE name END` but `query_spec = $6::jsonb`
   unconditionally — `$6` is already the coalesced value, so the *net* contract
   is identical for all four. Do not read the bare `$6` as "always replaced"
   and conclude you must therefore always send a spec. The opposite is true.

The portal's own guard is in
`src/app/(tenant)/crm/widgets/widget-form.ts`: `buildWidgetUpdate` returns the
spec **only** when the form owns every part of the stored one, and
`isSpecEditable` refuses to open the single-series editor otherwise.

### Decided 2026-08-31 — metadata-only editing first, authoring later

From the CRM audit review's open question 6, *what is the scope of the dashboard
editor now?*

**Metadata-only editing that provably preserves the spec.** Multi-series and
`SEMANTIC_V1` authoring is a separate, later scope — see
[Q104](../build/OPEN-QUESTIONS.md#q104--the-widget-builder-cannot-create-a-multi_kpi-or-a-combo)
and [Q105](../build/OPEN-QUESTIONS.md#q105--the-semantic_v1-engine-is-not-offered-by-the-builder).

The reasoning is worth keeping, because the tempting answer is the wrong one.
A limited editor and an unsafe editor are not two points on the same scale:

> A user who can only rename a widget is **inconvenienced**, and knows it.
> A user whose rename deletes their filters has **lost work**, does not know it,
> and cannot get it back — the update succeeded, the revision advanced, and
> there is no prior version to restore.

So the ordering is not "ship the editor, harden it later". Preservation is the
precondition, and breadth is the follow-on.

`querySpec` — `DashboardWidgetQuerySpecDto`:

| Field | Rule |
| --- | --- |
| `series` | 1–4 items of `{ metricKey, axis?, label?, color? }`; `metricKey` matches `^crm\.[a-z0-9_.]+$` |
| `dimension` | `{ key, grain? }`; `key` matches `^[a-z_]+$`. A `time` key **must** carry a grain |
| `filters` | A `DashboardFiltersDto`; only its eleven keys are accepted |
| `comparison` | `{ type, target? }`; `TARGET` needs a finite `target > 0` |
| `engine` | `LEGACY_V1` (default) or `SEMANTIC_V1` |
| `semanticVersion`, `source`, `semanticFilters`, `topN`, `maxPoints` | **Only with `SEMANTIC_V1`.** Any of them under the default engine is `422 CRM_WIDGET_ENGINE_INVALID` |

`validateWidget` additionally enforces: the visualization's `minSeries`/
`maxSeries`; every metric supports the chosen dimension; all series share one
shape and the visualization accepts it; a `ROWS` shape matches the
visualization's `rowKind`; mixed units need dual-axis or mixed-unit support and
an explicit `axis` per series; `requiresTarget`; and that a period comparison is
supported by both the visualization and every metric.

`PATCH /widgets/:id` returns more than the widget: `dashboardRevisions`
(a map of dashboard id to new revision) and `layoutAdjustments` — placements
the server **resized or moved** because the new visualization's constraints no
longer fitted the old box. Both are filtered to dashboards the caller can see.
Swallowing them hides a change the user made to somebody else's screen.

## Enums

| Enum | Values |
| --- | --- |
| Visualization | 34 — `METRIC_CARD`, `LINE`, `AREA`, `LINE_AREA`, `COLUMN`, `BAR`, `STACKED_BAR`, `PIE`, `DONUT`, `SCATTER`, `BUBBLE`, `GANTT`, `FLOWCHART`, `SEMI_CIRCLE_GAUGE`, `THREE_QUARTER_GAUGE`, `CIRCULAR_PROGRESS_GAUGE`, `DETAILED_SPEEDOMETER`, `TABLE`, `FUNNEL`, `HEATMAP`, `MULTI_KPI`, `PROGRESS_CARD`, `BULLET`, `STACKED_BAR_100`, `COMBO`, `WATERFALL`, `TREEMAP`, `LEADERBOARD`, `SCORECARD`, `HISTOGRAM`, `CALENDAR`, `TIMELINE`, `CALENDAR_HEATMAP`, `ALERT_LIST`, `ACTIVITY_FEED` |
| Data shape | `SCALAR`, `TIME_SERIES`, `CATEGORY`, `XY`, `INTERVAL`, `GRAPH`, `ROWS`, `HIERARCHY`, `BINNED_DISTRIBUTION`, `WATERFALL`, `EVENT_STREAM` |
| Metric unit | `COUNT`, `MONEY`, `PERCENT`, `DURATION`, `SCORE` |
| `datePreset` | `CURRENT_MONTH`, `CURRENT_QUARTER`, `CURRENT_YEAR`, `LAST_30_DAYS` |
| `compare` | `NONE`, `PREVIOUS_PERIOD`, `PREVIOUS_YEAR` |
| `comparison.type` | `PREVIOUS_PERIOD`, `PREVIOUS_YEAR`, `TARGET`, `NONE` |
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
| `CRM_WIDGET_REVISION_CONFLICT` | 409 | Stale `revision` on `PATCH /widgets/:id`, or a stale `expectedWidgetRevision` |
| `CRM_DASHBOARD_LAYOUT_STALE` | 409 | The submitted placement set is not the current one |
| `CRM_DASHBOARD_LAYOUT_OVERLAP` | 409 | Two boxes overlap, hidden ones included |
| `CRM_DASHBOARD_WIDGET_LIMIT` | 409 | 20-widget ceiling |
| `CRM_DASHBOARD_WIDGET_ALREADY_ADDED` | 409 | That widget is already placed here |
| `CRM_DASHBOARD_WIDGET_LIMIT_EXCEEDED` | 422 | A **stored** dashboard already exceeds 20 |
| `CRM_DASHBOARD_WIDGET_SELECTION_INVALID` | 422 | A `widgetIds` entry is not on this dashboard |
| `CRM_DASHBOARD_FILTER_INVALID` | 422 | `dateFrom > dateTo`, or an unparseable date |
| `CRM_DASHBOARD_DATE_RANGE_EXCEEDED` | 422 | Range longer than two years |
| `CRM_WIDGET_FILTER_INVALID` | 422 | A stored filter key or value is not allowed |
| `CRM_WIDGET_ENGINE_INVALID` | 422 | Semantic field without `SEMANTIC_V1`, or a bad limit |
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

**A 409 in this family is a revision conflict, not only a domain one.**
`PATCH /:id`, `PUT /:id/layout` and `PATCH /widgets/:id` all carry `revision`
in the **body** and answer 409 when it is stale. crm-app still has no
`If-Match` and no `ETag` anywhere — the token is a body field — but the
resolution surface is the same: refetch and reapply. There is no overwrite,
because the server requires the current revision.

## What will bite you

1. **`repWorkload` returns `opentasks`, not `openTasks`.**
   `dashboards.service.ts` writes `COUNT(*)::int AS openTasks` **unquoted**, so
   PostgreSQL folds the identifier to lower case. Reading `openTasks` is
   `undefined` on every row. No backend test asserts either spelling — see
   [Q100](../build/OPEN-QUESTIONS.md).
2. **Sending the scope headers on the drill-down is a 400.** It declares
   `organizationScopeMode: NONE`. Everything else in the family declares no
   mode at all.
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
10. **`GET /dashboards/default` provisions.** With no default and no
    `CRM_DEFAULT` instance, it **creates one** and emits a `DASHBOARD_CREATED`
    audit event. It is a `GET` that writes; do not call it to probe.
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
| Open my default | live — `GET /dashboards/default`, bound to a button because it provisions |
| Default and favourite | live — optimistic, reverted on failure |
| Dashboard detail, run, filters, re-run | live — `/crm/dashboards/[id]` |
| Rename / describe | live — `PATCH /:id` with `revision`; a 409 opens `ConflictDialog` |
| Dashboard switcher | live — `GET /dashboards/navigation`, in the detail header |
| Per-widget partial failure | live — the failed tile names its code; the rest render |
| KPI row | live — `StatCard`, its first consumer (G4) |
| Charts | live — line, area, bar, donut; every other visualization renders its data table |
| Chart table fallback | live — a real `<table>` with a `<caption>`, on every charted widget |
| Layout editing | live — drag **and** earlier/later buttons, repacked first-fit around hidden placements |
| Placements | live — add and remove |
| Drill-down | live — single-series widgets only, cursor-paged |
| Dashboard sharing | live — list, create, revoke, with the share-targets picker |
| Prebuilt reports | live — `/crm/dashboards/reports`, all seven |
| Widget CRUD, clone, preview | live — `/crm/widgets` |
| Widget sharing | live — `/crm/widgets/[id]` |
| Multi-series charting | **not built** — see Q103 |
| `SEMANTIC_V1` widgets | **not built** — see Q105 |
