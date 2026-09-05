# Admin Dashboard API Contract

Status: **[Verified]**

This contract is the blueprint for how the `/api/admin/core/v1/dashboard` endpoint must be consumed by the frontend.

## 1. API

Browser endpoint: `GET /api/admin/core/v1/dashboard`
Core internal controller: `GET /admin/dashboard`

The browser must call the Gateway endpoint, never Core directly.

Authentication:
- Secure HttpOnly Admin access cookie, emitted automatically by the browser.
- Same-origin request through the web application with credentials included.
- Browser code must not read, store, or attach a bearer token.
- Endpoint access requires `admin.reports.read`.

Example request:
```ts
await fetch("/api/admin/core/v1/dashboard", {
  credentials: "include",
  headers: { Accept: "application/json" },
});
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

What the portal sends:
- Always full ISO instants, never a bare `YYYY-MM-DD`. A date-only value is read
  as midnight UTC, which shifts the window for any reader outside UTC and
  discards the time of day the picker offers.
- `to` is the inclusive end the operator selected, at millisecond precision. A
  whole day ends at `23:59:59.999` local time, and that instant is identical
  whether the window came from a named preset or from two clicks on the
  calendar. The `HH:mm` time inputs beside the calendar cannot carry seconds, so
  an endpoint moved on to a different date is copied whole
  (`withTimeOf` in `utils/date-range-presets.ts`) rather than round-tripped
  through that format, which would truncate the last minute of the range.

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
16. Re-apply rule 1 to every answer. A group cached from an earlier answer is
    discarded unless the newest `authorizedGroups` still names it.

### Carried groups and the withdrawal case

One subject tab is on screen at a time, so the portal asks for that subject's
reports with `?groups=`, and Core replies with `loadedGroups` naming what it
actually built. Groups the reply left out are carried forward from the previous
answer for the same reporting window, so returning to a tab does not re-fetch
what is already held. A response carrying no `loadedGroups` predates the
parameter and always holds the full set, so nothing is carried over it.

Absence in the payload is ambiguous: a report is missing both when it was out of
scope and when the actor may no longer see it. Only `authorizedGroups` separates
the two, and it is the new one that governs — a role edited mid-session must
take effect on the next answer, not on the next full reload. So carrying
intersects with the new authorized set, and a report withdrawn between two
answers leaves the screen with the answer that withdrew it.

The same ambiguity governs `overview`. Core filters it to the groups it loaded,
so a scoped reply carries a deliberately thinner one, and the fuller unscoped
overview is kept rather than letting a tab visit strip half the panels. That
allowance holds only while the authorized set is unchanged: measured against the
*previous* set a withdrawal looks exactly like a scope, and the retained
overview still names tenants and KPIs drawn from reports that are now refused.
Once the authorized set changes, the new overview wins whether or not it is
thinner.

This is a display-correctness rule, not an access control. The server already
refuses to send what it does not authorize; the client's duty is to stop showing
what it was sent before.


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
