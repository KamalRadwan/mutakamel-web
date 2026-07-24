# CRM Dashboards API

Base path: `/crm/dashboards`

The CRM Dashboards module provides rich, pre-aggregated analytics and health metrics for sales performance, lead quality, and data hygiene. Responses consist of customized widget payloads.

## Endpoints

### `GET /crm/dashboards/overview`
Returns the executive overview dashboard, featuring high-level CRM health widgets like total pipeline value and conversion rates.
- **Permissions**: `crm.dashboards.read.*`
- **Response**: `200 OK`

### `GET /crm/dashboards/sales-pipeline`
Returns pipeline distribution metrics, stale deals, lost reasons, and currency breakdowns.
- **Permissions**: `crm.dashboards.read.*`
- **Response**: `200 OK`

### `GET /crm/dashboards/leads`
Returns lead source performance, source-to-value calculations, and owner balance metrics.
- **Permissions**: `crm.dashboards.read.*`
- **Response**: `200 OK`

### `GET /crm/dashboards/activities-productivity`
Returns activity mix distributions, overdue work lists, rep workload tracking, and calendar utilization widgets.
- **Permissions**: `crm.dashboards.read.*`
- **Response**: `200 OK`

### `GET /crm/dashboards/customer-intelligence`
Returns MVP customer statuses, contact depth matrices, and engagement analytics.
- **Permissions**: `crm.dashboards.read.*`
- **Response**: `200 OK`

### `GET /crm/dashboards/data-quality`
Highlights missing owner, value, currency, or contact data, including duplicate signal widgets.
- **Permissions**: `crm.dashboards.read.*`
- **Response**: `200 OK`

### `GET /crm/dashboards/action-center`
Returns prioritized actionable lists: stale opportunities, untouched leads, overdue tasks, and cleanup items.
- **Permissions**: `crm.dashboards.read.*`
- **Response**: `200 OK`
