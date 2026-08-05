# Admin Dashboard API Contract

Status: **[Verified]**

This contract is the blueprint for how the `/api/admin/core/v1/dashboard` endpoint must be consumed by the frontend.

## 1. API

Browser endpoint: `GET /api/admin/core/v1/dashboard`
Core internal controller: `GET /admin/dashboard`

The browser must call the Gateway endpoint, never Core directly.

Authentication:
- Admin Bearer access token.
- Same-origin request through the web application.
- Include credentials for the admin refresh-cookie flow.
- Endpoint access requires `admin.reports.read`.

Example request:
```http
GET /api/admin/core/v1/dashboard
Accept: application/json
Authorization: Bearer <admin-access-token>
```

Example with a single date:
`GET /api/admin/core/v1/dashboard?date=2026-08-02`

Example with a custom range:
`GET /api/admin/core/v1/dashboard?from=2026-08-01&to=2026-08-31`

No idempotency key is required because this is a read-only GET request.

Date behavior:
- `date` selects a single reporting day.
- `date` overrides `from` and `to`.
- `from` is inclusive.
- Date-only `to` is treated as the inclusive final day.
- Internally, the backend uses an exclusive range-end boundary.
- The default range is the current UTC month.
- Invalid or reversed ranges return HTTP 422 with `DASHBOARD_RANGE_INVALID`.

## 2. Success and Error Envelopes

Do not invent a universal `{ status, code, data }` JSON envelope.

Successful Core responses have this body:
```json
{
  "success": true,
  "data": {},
  "correlationId": "string",
  "timestamp": "ISO-8601"
}
```
The HTTP status is `response.status`, normally 200.
There is no success-body `status` field.
There is no success-body `code` field.

Core-originated error body (uses `statusCode` and `errorCode`):
```json
{
  "success": false,
  "statusCode": 422,
  "errorCode": "DASHBOARD_RANGE_INVALID",
  "errorCategory": "VALIDATION",
  "message": "The dashboard \"from\" date must be before or equal to the \"to\" date.",
  "details": {},
  "correlationId": "uuid-v7",
  "timestamp": "ISO-8601 timestamp",
  "path": "/api/v1/admin/dashboard"
}
```

Gateway-originated errors use RFC 7807 Problem Details (uses `status` and `code`):
```json
{
  "type": "https://errors.mutakamel.ai/gw/auth/forbidden",
  "title": "Forbidden",
  "status": 403,
  "code": "GW.AUTH.FORBIDDEN",
  "detail": "Optional safe detail",
  "instance": "/api/admin/core/v1/dashboard",
  "correlationId": "uuid-v7",
  "errors": {}
}
```

The API client must support both error contracts.

## 3. Permission Model

`admin.reports.read` allows the administrator to call the endpoint.
Each dashboard group additionally requires its exact permission:
- tenants: `admin.reports.tenants`
- domains: `admin.reports.domains`
- subscriptions: `admin.reports.subscriptions`
- billing: `admin.reports.billing`
- payments: `admin.reports.payments`
- wallets: `admin.reports.wallets`
- database: `admin.reports.database-server`
- storage: `admin.reports.storage`
- provisioning: `admin.reports.provisioning`
- catalogue: `admin.reports.catalogue`
- notifications: `admin.reports.notifications`
- usage: `admin.reports.usage`
- security: `admin.reports.security`
- audit: `admin.reports.audit`

Authorization rules:
- Platform Super Admin receives every group.
- Ordinary administrators receive only explicitly assigned groups.
- Unauthorized providers are not queried.
- Unauthorized top-level groups are omitted from the response.
- A missing group means the user is not authorized.
- A present group with `available: false` means the user is authorized, but its authoritative data projection is unavailable.
- Never treat a missing group as a zero-value group.
- Never show an unauthorized group as disabled or empty.

## 4. Root Dashboard Contract

`authorizedGroups` is the authoritative list of groups available to this administrator.

```ts
type AdminDashboardData = {
  asOf: string;
  authorizedGroups: DashboardGroupKey[];

  range: {
    from: string;
    to: string;
    label: string;
    granularity: "day" | "month";
  };

  // Compatibility projections retained during migration.
  sections: DashboardSection[];
  panels: DashboardPanels;
  overview: DashboardOverview;

  // Permission-filtered group objects.
  tenants?: DashboardGroup;
  domains?: DashboardGroup;
  subscriptions?: DashboardGroup;
  billing?: DashboardGroup;
  payments?: DashboardGroup;
  wallets?: DashboardGroup;
  database?: DashboardGroup;
  storage?: DashboardGroup;
  provisioning?: DashboardGroup;
  catalogue?: DashboardGroup;
  notifications?: DashboardGroup;
  usage?: DashboardGroup;
  security?: DashboardGroup;
  audit?: DashboardGroup;
};
```

## 5. Implementation Rules

1. Use `body.data.authorizedGroups` as the authoritative navigation/filter list.
2. Access groups with `body.data[groupKey]`.
3. If a group property is absent, treat it as unauthorized.
4. If `available === false`, render an unavailable-data state using `reasonCode` and `message`.
5. Do not convert unavailable data to zero.
6. Render cards from each group’s `cards` array.
7. Render alert counts from only the groups present in the response.
8. Preserve unknown breakdown keys rather than crashing on new statuses.
9. Format ratios and percentages as values between 0 and 1.
10. Keep decimal money strings intact (never parse canonical USD money values into JavaScript `number`).
11. Do not use `sections`, `panels`, or `overview` as the long-term data authority. They remain compatibility projections during migration.
12. Never expose or request storage credentials, database credentials, infrastructure endpoints, audit identities, raw errors, or provider evidence.
13. Do not infer runtime health from ACTIVE/OFFLINE registry values.
14. Do not add a health group in this implementation.
15. Do not create a `/v2` endpoint or a second dashboard endpoint.


## DTOs (Migrated from dtos.md)

### `AdminDashboardQueryDto`
```typescript
{
  date?: string; // @IsOptional, @IsDateString; overrides from/to
  from?: string; // @IsOptional, @IsDateString
  to?: string;   // @IsOptional, @IsDateString
}
```

- No fields selects the current UTC calendar month.
- Supplying only `from` or only `to` selects a single day when the value is
  `YYYY-MM-DD`; a lone full timestamp currently produces HTTP `422`.
- An invalid or reversed range is rejected. See
  [the dashboard contract](../api/dashboard.md) for exact range semantics and
  response types.

---
