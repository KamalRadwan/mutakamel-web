# CRM dashboard builder and widgets

> Status: `verified-current`
> Last source verification: `2026-08-25`
> Owner: CRM (`crm-app`)
> Canonical browser prefix: `/api/tenant/crm/v1`
> Controller-relative prefix: `/api/v1/crm`
> Tenant Portal replacement: `not-started`
> Historical consolidated frontend: `absent-from-current-checkout`
> Authorship: hand-written from current backend source; historical frontend evidence is non-authoritative

The builder stores user dashboards, reusable widgets, placements, favorites/defaults, and user/team shares. It also validates and executes server-owned metric queries. The Gateway exposes 33 builder/widget routes.

## Endpoint catalogue

### Dashboards

| Method | Canonical browser path | Controller/upstream path | Permission | Success |
|---|---|---|---|---|
| `GET` | `/api/tenant/crm/v1/dashboards/catalog` | `/api/v1/crm/dashboards/catalog` | `crm.dashboards.read.{own|team|all}` | `200`, catalogue |
| `GET` | `/api/tenant/crm/v1/dashboards/navigation` | `/api/v1/crm/dashboards/navigation` | `crm.dashboards.read.{own|team|all}` | `200`, navigation |
| `GET` | `/api/tenant/crm/v1/dashboards/default` | `/api/v1/crm/dashboards/default` | `crm.dashboards.read.{own|team|all}` | `200`, default/null |
| `GET` | `/api/tenant/crm/v1/dashboards/share-targets` | `/api/v1/crm/dashboards/share-targets` | `crm.dashboards.share` | `200`, targets |
| `POST` | `/api/tenant/crm/v1/dashboards/from-template/:templateKey` | `/api/v1/crm/dashboards/from-template/:templateKey` | `crm.dashboards.create` | `201`, new dashboard |
| `PUT` | `/api/tenant/crm/v1/dashboards/from-template/:templateKey` | `/api/v1/crm/dashboards/from-template/:templateKey` | `crm.dashboards.create` | `200`, ensured dashboard |
| `GET` | `/api/tenant/crm/v1/dashboards` | `/api/v1/crm/dashboards` | `crm.dashboards.read.{own|team|all}` | `200`, array |
| `POST` | `/api/tenant/crm/v1/dashboards` | `/api/v1/crm/dashboards` | `crm.dashboards.create` | `201`, dashboard |
| `GET` | `/api/tenant/crm/v1/dashboards/:id` | `/api/v1/crm/dashboards/:id` | `crm.dashboards.read.{own|team|all}` | `200`, dashboard |
| `PATCH` | `/api/tenant/crm/v1/dashboards/:id` | `/api/v1/crm/dashboards/:id` | `crm.dashboards.update` | `200`, dashboard |
| `DELETE` | `/api/tenant/crm/v1/dashboards/:id` | `/api/v1/crm/dashboards/:id` | `crm.dashboards.delete` | `204` |
| `POST` | `/api/tenant/crm/v1/dashboards/:id/duplicate` | `/api/v1/crm/dashboards/:id/duplicate` | `crm.dashboards.create` | `201`, copy |
| `PUT` | `/api/tenant/crm/v1/dashboards/:id/default` | `/api/v1/crm/dashboards/:id/default` | `crm.dashboards.read.{own|team|all}` | `200`, dashboard detail |
| `PUT` | `/api/tenant/crm/v1/dashboards/:id/favorite` | `/api/v1/crm/dashboards/:id/favorite` | `crm.dashboards.read.{own|team|all}` | `200`, dashboard detail |
| `PUT` | `/api/tenant/crm/v1/dashboards/:id/layout` | `/api/v1/crm/dashboards/:id/layout` | `crm.dashboards.update` | `200`, dashboard |
| `POST` | `/api/tenant/crm/v1/dashboards/:id/run` | `/api/v1/crm/dashboards/:id/run` | `crm.dashboards.read.{own|team|all}` | `201`, execution |
| `POST` | `/api/tenant/crm/v1/dashboards/:id/widgets/:widgetId/drilldown` | `/api/v1/crm/dashboards/:id/widgets/:widgetId/drilldown` | `crm.dashboards.read.{own|team|all}` | `201`, bounded drill-down page |
| `POST` | `/api/tenant/crm/v1/dashboards/:id/placements` | `/api/v1/crm/dashboards/:id/placements` | `crm.dashboards.update` | `201`, placement/dashboard |
| `DELETE` | `/api/tenant/crm/v1/dashboards/:id/placements/:placementId` | `/api/v1/crm/dashboards/:id/placements/:placementId` | `crm.dashboards.update` | `200`, new dashboard revision |
| `GET` | `/api/tenant/crm/v1/dashboards/:id/shares` | `/api/v1/crm/dashboards/:id/shares` | `crm.dashboards.share` | `200`, array |
| `POST` | `/api/tenant/crm/v1/dashboards/:id/shares` | `/api/v1/crm/dashboards/:id/shares` | `crm.dashboards.share` | `201`, share |
| `DELETE` | `/api/tenant/crm/v1/dashboards/:id/shares/:shareId` | `/api/v1/crm/dashboards/:id/shares/:shareId` | `crm.dashboards.share` | `204` |

### Reusable widgets

| Method | Canonical browser path | Controller/upstream path | Permission | Success |
|---|---|---|---|---|
| `POST` | `/api/tenant/crm/v1/widgets/preview` | `/api/v1/crm/widgets/preview` | `crm.dashboards.read.{own|team|all}` | `201`, preview result |
| `GET` | `/api/tenant/crm/v1/widgets/share-targets` | `/api/v1/crm/widgets/share-targets` | `crm.widgets.share` | `200`, targets |
| `GET` | `/api/tenant/crm/v1/widgets` | `/api/v1/crm/widgets` | `crm.widgets.read` | `200`, array |
| `POST` | `/api/tenant/crm/v1/widgets` | `/api/v1/crm/widgets` | `crm.widgets.create` | `201`, widget |
| `GET` | `/api/tenant/crm/v1/widgets/:id` | `/api/v1/crm/widgets/:id` | `crm.widgets.read` | `200`, widget |
| `PATCH` | `/api/tenant/crm/v1/widgets/:id` | `/api/v1/crm/widgets/:id` | `crm.widgets.update` | `200`, widget |
| `DELETE` | `/api/tenant/crm/v1/widgets/:id` | `/api/v1/crm/widgets/:id` | `crm.widgets.delete` | `204` |
| `POST` | `/api/tenant/crm/v1/widgets/:id/clone` | `/api/v1/crm/widgets/:id/clone` | `crm.widgets.create` | `201`, clone |
| `GET` | `/api/tenant/crm/v1/widgets/:id/shares` | `/api/v1/crm/widgets/:id/shares` | `crm.widgets.share` | `200`, array |
| `POST` | `/api/tenant/crm/v1/widgets/:id/shares` | `/api/v1/crm/widgets/:id/shares` | `crm.widgets.share` | `201`, share |
| `DELETE` | `/api/tenant/crm/v1/widgets/:id/shares/:shareId` | `/api/v1/crm/widgets/:id/shares/:shareId` | `crm.widgets.share` | `204` |

Drill-down accepts a server-owned widget selection only: required `pointKey`, optional `seriesKey`, opaque URL-safe `cursor`, `limit` from 1 through 100, optional positive `expectedWidgetRevision`, and optional dashboard filters. Clients cannot supply query text, projections, predicates, or SQL.

## Access model

- Dashboard reads and execution use scoped `crm.dashboards.read.{own|team|all}`.
- Dashboard create/update/delete/share and all widget permissions are static permission names.
- Permission alone is insufficient: the access service also checks resource ownership or an effective, unexpired `USER`/`TEAM` share.
- `VIEW` shares grant visibility; `EDIT` shares can grant supported edit behavior, subject to the route permission.
- A share never expands underlying CRM branch/owner/pipeline data access. Execution applies the actor's current scoped CRM access.
- Inaccessible resources can be returned as not found.

## Runtime catalogue

`GET /dashboards/catalog` is the authoritative source for template, metric, dimension, visualization, compatibility, unit, and shape metadata. Do not hardcode the 76 current metric keys.

Current template keys:

```text
CRM_DEFAULT
SALES_PIPELINE
LEAD_PERFORMANCE
KPIS_TARGETS
TRENDS_COMPARISONS
DISTRIBUTION_RELATIONSHIPS
PROCESS_OPERATIONS
ACTIVITIES_PRODUCTIVITY
CUSTOMER_INTELLIGENCE
DATA_QUALITY
ACTION_CENTER
```

Current visualization wire values:

```text
METRIC_CARD
LINE
AREA
LINE_AREA
COLUMN
BAR
STACKED_BAR
PIE
DONUT
SCATTER
BUBBLE
GANTT
FLOWCHART
SEMI_CIRCLE_GAUGE
THREE_QUARTER_GAUGE
CIRCULAR_PROGRESS_GAUGE
DETAILED_SPEEDOMETER
TABLE
FUNNEL
HEATMAP
MULTI_KPI
PROGRESS_CARD
BULLET
STACKED_BAR_100
COMBO
WATERFALL
TREEMAP
LEADERBOARD
SCORECARD
HISTOGRAM
CALENDAR
TIMELINE
CALENDAR_HEATMAP
ALERT_LIST
ACTIVITY_FEED
```

Current dimension keys:

```text
none
time
lead_status
lead_stage
assignment_status
created_weekday
created_hour
pipeline_stage
deal_size_bin
branch
owner
pipeline
stage
source
status
lost_reason
currency
opportunity
activity_type
activity_slot
reminder_status
calendar
activity_event
customer_status
customer
stage_flow
record
```

The catalogue response wins if these lists change.

## Dashboard definitions

Create body:

| Field | Contract |
|---|---|
| `name` | required, trimmed, `1..120` |
| `description` | optional, trimmed, maximum 500 |
| `defaultFilters` | optional filter object |
| `templateKey` | optional current template key |

Patch accepts optional name, description, default filters and requires integer `revision >= 1`. Duplicate accepts optional name. From-template POST/PUT accepts optional name, description, and default filters; `templateKey` is validated in the path.

`POST /from-template` always creates. `PUT /from-template` ensures the actor's template-derived dashboard and requires UUIDv7 `x-idempotency-key`.

Favorite body is strict:

```json
{ "favorite": true }
```

Set-default and set-favorite both require UUIDv7 `x-idempotency-key`. They modify the actor's navigation preference, not tenant authorization.

## Filters

Dashboard defaults, runs, and previews use:

| Field | Contract |
|---|---|
| `datePreset` | `CURRENT_MONTH`, `CURRENT_QUARTER`, `CURRENT_YEAR`, `LAST_30_DAYS` |
| `compare` | `NONE`, `PREVIOUS_PERIOD`, `PREVIOUS_YEAR` |
| `dateFrom`, `dateTo` | ISO date-time |
| `branchId`, `ownerUserId`, `pipelineId` | UUIDv7 |
| `currencyCode` | exactly three uppercase letters |
| `staleDays`, `closingWindowDays` | integer `1..365` |
| `limit` | integer `1..100` |

Execution validates date ordering and rejects a requested range longer than two years with `CRM_DASHBOARD_DATE_RANGE_EXCEEDED`. Filters always narrow the actor's server-resolved data boundary.

## Widget definition

Create requires:

- `name`: trimmed `1..120`;
- `visualizationType`: runtime catalogue value;
- `querySpec`: validated object;
- optional `displaySpec`.

Patch accepts the same fields optionally and requires integer `revision >= 1`. Clone accepts an optional trimmed name `1..120`.

### Query specification

| Field | Contract |
|---|---|
| `engine` | optional `LEGACY_V1` or `SEMANTIC_V1` |
| `semanticVersion` | when supplied, exactly `1` |
| `source` | optional `leads` or `opportunities` |
| `semanticFilters` | at most 5 filters |
| `series` | required `1..4` metric series |
| `dimension` | optional dimension |
| `filters` | optional dashboard filters |
| `comparison` | optional comparison |
| `topN` | integer `1..100` |
| `maxPoints` | integer `1..1000` |

A semantic filter has:

- `field`: `status`, `stageId`, or `sourceId`;
- `operator`: `EQ` or `IN`;
- `values`: `1..100` strings, each maximum 80.

A series requires `metricKey` matching `^crm\.[a-z0-9_.]+$`, length `3..120`. Optional `axis` is `LEFT|RIGHT`, label is `1..80`, and color is `#RRGGBB`.

A dimension key matches `^[a-z_]+$`, length `1..40`; optional grain is `DAY`, `WEEK`, `MONTH`, `QUARTER`, or `YEAR`.

Comparison type is `PREVIOUS_PERIOD`, `PREVIOUS_YEAR`, `TARGET`, or `NONE`; `TARGET` requires a finite positive `target`. Metric units, axes, dimensions, grain, comparison, visualization, engine, and output shape must be compatible according to the runtime catalogue.

### Display specification

Optional fields:

- trimmed `title` up to 120 and `subtitle` up to 300;
- `color` and `targetColor` as `#RRGGBB`;
- `numberFormat` and `legendPosition` up to 80;
- `options` as an opaque object.

`options` has no public item schema. Use only options advertised by the runtime catalogue/current backend behavior; do not send renderer-internal or executable content.

## Placements and layout

Add placement requires UUIDv7 `widgetId`; optional grid values:

```text
x: 0..11
y: 0..10000
width: 1..12
height: 1..24
```

A dashboard can contain at most 20 widgets. The same widget cannot be placed twice, rectangles cannot overlap, and the service checks widget visibility.

Full layout update requires:

```json
{
  "revision": 4,
  "placements": [
    {
      "placementId": "0191e9a8-7f51-7b32-8d72-19f9217a41b3",
      "x": 0,
      "y": 0,
      "width": 6,
      "height": 6
    }
  ]
}
```

The array is the complete layout, maximum 20. Layout update requires UUIDv7 `x-idempotency-key` and optimistic `revision`. On a conflict, re-fetch and reconcile; never silently overwrite.

## Execution and preview

Run body optionally supplies `filters` and at most 20 UUIDv7 `widgetIds`. Omit `widgetIds` to execute the dashboard placement set. Preview accepts an unsaved complete widget definition plus optional run filters and creates no widget.

Responses are raw execution projections. Each widget can have its own result, warnings, or safe error so one inaccessible/failed metric does not require leaking another resource. Validate the result shape declared by the runtime metric/visualization catalogue and preserve partial failures.

Execution is synchronous from the API caller's perspective; there is no job/poll contract. It can still fail on dependencies or query limits.

## Shares

Share-target query supports trimmed `search` up to 80, integer `limit 1..100`, and integer `offset 0..10000`.

Share body:

```json
{
  "subjectType": "TEAM",
  "subjectId": "0191e9a8-7f51-7b32-8d72-19f9217a41b3",
  "accessLevel": "VIEW",
  "expiresAt": "2026-12-31T23:59:59.000Z"
}
```

`subjectType` is `USER|TEAM`, `subjectId` is UUIDv7, access is `VIEW|EDIT`, and optional expiry is ISO date-time and must be valid/future under service rules. A resource cannot be shared to an invalid target or in a prohibited self-share configuration.

Dashboard and widget share creation each require UUIDv7 `x-idempotency-key`. Share deletion has no Gateway replay protection.

## Idempotent routes

Exactly six routes on this page require UUIDv7 `x-idempotency-key`:

1. `PUT /dashboards/from-template/:templateKey`
2. `PUT /dashboards/:id/default`
3. `PUT /dashboards/:id/favorite`
4. `PUT /dashboards/:id/layout`
5. `POST /dashboards/:id/shares`
6. `POST /widgets/:id/shares`

Paths above are relative to `/api/tenant/crm/v1`. Preserve a key only for an exact replay. Other mutations require a state re-read after ambiguous transport failure.

## Errors and security

Dashboard/access/layout/share errors:

```text
CRM_DASHBOARD_ACTOR_INVALID
CRM_DASHBOARD_FILTER_INVALID
CRM_DASHBOARD_DATE_RANGE_EXCEEDED
CRM_DASHBOARD_DEFINITION_ACCESS_DENIED
CRM_DASHBOARD_LAYOUT_OVERLAP
CRM_DASHBOARD_LAYOUT_POSITION_INVALID
CRM_DASHBOARD_LAYOUT_SIZE_INVALID
CRM_DASHBOARD_LAYOUT_STALE
CRM_DASHBOARD_NAME_CONFLICT
CRM_DASHBOARD_NOT_FOUND
CRM_DASHBOARD_PLACEMENT_NOT_FOUND
CRM_DASHBOARD_RESOURCE_NOT_FOUND
CRM_DASHBOARD_REVISION_CONFLICT
CRM_DASHBOARD_REVISION_UPDATE_FAILED
CRM_DASHBOARD_TEMPLATE_INVALID
CRM_DASHBOARD_WIDGET_ALREADY_ADDED
CRM_DASHBOARD_WIDGET_LIMIT
CRM_DASHBOARD_WIDGET_SELECTION_INVALID
CRM_SHARE_EXPIRY_INVALID
CRM_SHARE_NOT_FOUND
CRM_SHARE_SELF_INVALID
CRM_SHARE_TARGET_INVALID
```

Widget/query errors:

```text
CRM_WIDGET_AXIS_REQUIRED
CRM_WIDGET_COMPARISON_UNSUPPORTED
CRM_WIDGET_DIMENSION_INVALID
CRM_WIDGET_ENGINE_INVALID
CRM_WIDGET_EXECUTION_FAILED
CRM_WIDGET_FILTER_INVALID
CRM_WIDGET_METRIC_INVALID
CRM_WIDGET_NOT_FOUND
CRM_WIDGET_QUERY_INVALID
CRM_WIDGET_REVISION_CONFLICT
CRM_WIDGET_SERIES_INVALID
CRM_WIDGET_SHAPE_INCOMPATIBLE
CRM_WIDGET_TARGET_INVALID
CRM_WIDGET_TARGET_REQUIRED
CRM_WIDGET_TIME_GRAIN_REQUIRED
CRM_WIDGET_UNITS_INCOMPATIBLE
CRM_WIDGET_VISUALIZATION_INVALID
```

Names, descriptions, labels, and display options are tenant/user data; render safely. Query specifications are declarative, but clients must not turn opaque options into executable code. Never cache an execution across actors because scope and shares are actor-specific.

## Sources

- `../backend/mutakamel-apps/crm-app/src/crm/dashboards/dashboard-builder.controller.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/dashboards/dashboard-widgets.controller.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/dashboards/dto/dashboard-builder.dto.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/dashboards/dto/dashboard-drilldown.dto.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/dashboards/dashboard-catalog.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/dashboards/dashboard-definitions.service.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/dashboards/dashboard-widgets.service.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/dashboards/dashboard-shares.service.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/dashboards/dashboard-execution.service.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/dashboards/dashboard-access.service.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/dashboards/dashboard-definitions.service.spec.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/dashboards/dashboard-widgets.service.spec.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/dashboards/dashboard-shares.service.spec.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/dashboards/dashboard-execution.service.spec.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/crm.route-contracts.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/idempotency/gateway-idempotency.service.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/crm/dashboards/dashboard-api.ts`
