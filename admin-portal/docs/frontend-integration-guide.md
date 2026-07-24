# Admin Portal Frontend Integration Guide

This is the starting point for UI developers and AI coding agents working in
`admin-portal`. It records what the frontend currently implements, which data
is mocked, how browser routes map to backend applications, and where to find
the validated DTO and enum details.

Last source verification: **2026-07-24**

## Backend ownership

The Admin Portal is a control-plane application:

| Backend app | Admin Portal responsibility |
|:---|:---|
| `core-app` | Primary backend: auth, dashboard, admin users and roles, tenants, provisioning, database servers, catalogue, subscriptions, invoices, wallets, reports, settings, logging, and notifications |
| `api-gateway-app` | The only public routing contract the browser should use; it maps canonical public paths to upstream applications |
| `worker-app` | Admin backup and restore APIs |
| `crm-app` | Tenant product API; not a direct Admin Portal API source today |
| `trade-app` | Tenant product API; not a direct Admin Portal API source today |

Do not invent Admin Portal calls under `/api/admin/crm/...` or
`/api/admin/trade/...`. The gateway currently assigns CRM and Trade routes to
the tenant master, not the admin master.

## Public URL rules

Browser code must use canonical API Gateway paths:

```text
Core admin:   /api/admin/core/v1/<route>
Worker admin: /api/admin/worker/v1/<route>
```

Examples:

```text
POST /api/admin/core/v1/auth/login
GET  /api/admin/core/v1/dashboard
GET  /api/admin/core/v1/database-servers
GET  /api/admin/core/v1/tenants
GET  /api/admin/worker/v1/backups/runs
```

Paths such as `/admin/tenants`, `/admin/system-settings`, and
`/api/v1/admin/dashboard` are upstream/controller paths. They are useful when
reading backend code, but browser code must not call them directly.

### Local and production routing

- The portal runs on fixed port `5001`.
- In development, `next.config.ts` rewrites same-origin `/api/*` requests to
  `DEV_API_TARGET` (default gateway target `http://localhost:9000`).
- In production, there is no Next rewrite. `NEXT_PUBLIC_API_URL` must be the API
  Gateway origin, or requests must already be routed to the gateway by the
  deployment ingress.
- Prefer relative `/api/...` URLs in browser code when same-origin routing is
  available. This keeps refresh cookies same-origin.

## Source-of-truth order

When documentation and code disagree, use this order:

1. `api-gateway-app/src/routing-proxy/route-contracts/*.route-contracts.ts`
   for the browser-visible method and path.
2. The owning app controller for guards, permissions, parameters, and HTTP
   behavior.
3. The owning app DTOs and response/service types for validation and data
   shape.
4. The markdown documents in this folder.
5. Frontend mock objects only as design fixtures, never as API contracts.

Backend paths in this guide are written relative to
`C:\mutakamel.ai\frontend`, whose backend sibling is
`../backend/mutakamel-apps/`.

## Current frontend route inventory

| Frontend route | Screen | Current data state | Primary API documentation |
|:---|:---|:---|:---|
| `/` | Redirect | Redirects to `/dashboard` | — |
| `/login` | Admin login | Live login, refresh, `/me`, and logout calls; forgot-password modal is simulated | [Auth](api/auth.md) |
| `/dashboard` | Control-plane dashboard | **Mock** in `useDashboard.ts` | [Dashboard](api/dashboard.md) |
| `/database-servers` | Server list and actions | **Mock** | [Database servers](api/database-servers.md) |
| `/database-servers/new` | Server registration | **Mock submit/connectivity** | [Database servers](api/database-servers.md) |
| `/database-servers/[id]` | Server detail, tenants, history | **Mock** | [Database servers](api/database-servers.md) |
| `/tenants` | Tenant list and lifecycle actions | **Mock** | [Tenants](api/tenants.md) |
| `/tenants/new` | Tenant registration/provisioning wizard | **Mock** | [Tenants](api/tenants.md) |
| `/tenants/[id]` | Tenant, subscription, wallet, FQDN, users, operations | **Mock** | [Tenants](api/tenants.md), [Tenant users](api/tenant-users.md), [Operations](api/tenant-operations.md), [Wallet](api/wallet.md) |
| `/modules` | Module catalogue | **Mock** | [Catalogue](api/catalog.md) |
| `/modules/[id]` | Module tiers, features, grants, pricing | **Mock** | [Catalogue](api/catalog.md) |
| `/users` | Admin staff list | **Mock** | [Admin users](api/users.md) |
| `/users/[id]` | Admin staff detail and roles | **Mock** | [Admin users](api/users.md), [Roles](api/roles-permissions.md) |
| `/roles` | Admin role list | **Mock** | [Roles](api/roles-permissions.md) |
| `/roles/[id]` | Role permissions | **Mock** | [Roles](api/roles-permissions.md) |
| `/settings` | Settings index | Static navigation | [System settings](api/system-settings.md) |
| `/settings/platform` | Platform and tenant defaults | Backend attempt with local fallback | [System settings](api/system-settings.md) |
| `/settings/auth` | Auth TTL settings | Backend attempt with local fallback | [System settings](api/system-settings.md) |
| `/settings/billing` | Billing settings | Backend attempt with local fallback | [System settings](api/system-settings.md) |
| `/settings/asterisk` | Asterisk/WebRTC settings | Backend attempt with local fallback | [System settings](api/system-settings.md) |
| `/settings/notifications` | Notification channel settings | Backend attempt with local fallback | [System settings](api/system-settings.md), [Notifications](api/notifications.md) |
| `/settings/smtp` | Platform SMTP config and audit | Backend attempt with simulated success fallback | [System settings](api/system-settings.md) |

Legacy compatibility routes:

- `/module` redirects to `/modules`.
- `/tenant` and `/tenant/[id]` redirect to `/tenants`.
- `/database-server`, `/database-server/new`, and
  `/database-server/[id]` redirect to the plural route family.
- `src/app/admin/database-servers/` contains duplicate hook/component code but
  no page route. Use `src/app/database-servers/` as the active screen source.

## Known integration hazards

These are current-code facts that a UI developer must know before wiring APIs:

1. Only authentication uses the shared `axiosClient` and canonical gateway
   paths today.
2. Dashboard, tenants, database servers, modules, admin users, and roles are
   client-side mock implementations even where comments name real endpoints.
3. General settings and SMTP hooks call `/admin/system-settings...` instead of
   `/api/admin/core/v1/system-settings...`.
4. Those settings hooks use raw `fetch`, do not share the coordinated 401
   refresh behavior, and currently fall back to preview data or simulated
   success when requests fail.
5. The settings fallback base URL is `http://localhost:5001`, which points back
   to the frontend rather than the gateway when `NEXT_PUBLIC_API_URL` is absent.
6. Several links still target non-existent frontend paths:
   `/admin/users/me/profile`, `/admin/roles`, `/admin/tenants`, and
   `/admin/reports`.
7. The notification dropdown and WebRTC phone UI are presentation fixtures;
   do not assume they are hydrated by their documented APIs.
8. Frontend mock status values are not always backend enum values. Examples
   include tenant `"FAILED"` instead of `PROVISIONING_FAILED`, operation
   `"COMPLETED"` instead of `SUCCEEDED`, and subscription `"CANCELED"` instead
   of `CANCELLED`.
9. The modules prototype links by module key, uses `YEARLY`, and invents
   catalogue fields and bulk operations that are absent from the API. Use
   UUIDv7 IDs, `ANNUAL`, and the exact replacement contracts documented in
   [Modules and Catalogue](api/catalog.md).
10. The tenant prototypes invent summary/detail fields, calculate provisioning
    and billing values locally, use invalid operation/user states, and perform
    local-only mutations. Tenant creation must use a server quote, every
    Gateway mutation needs one UUIDv7 idempotency key per intent, deleted
    tenant users use visibility rather than a `DELETED` status, and
    provisioning completion must be polled from the operation API. Use
    [Tenants](api/tenants.md), [Tenant Users](api/tenant-users.md), and
    [Tenant Operations](api/tenant-operations.md).

Do not hide these failures behind permanent mock fallbacks when converting a
screen to production data. Use explicit loading, empty, permission-denied, and
error states.

## Authentication and request behavior

The current auth flow is intentionally cookie-and-token based:

- Send `credentials: "include"` so the HttpOnly refresh cookie is available.
- Send `x-auth-cookie-mode: 1` to admin auth endpoints.
- Login may send `x-auth-remember: 1` or `0`.
- Store the access token only in `sessionStorage`; the refresh token remains in
  the HttpOnly cookie.
- Protected calls send `Authorization: Bearer <accessToken>`.
- On a protected `401`, the shared client coordinates one refresh attempt
  across callers and retries the original request once.
- If refresh fails, clear local auth state and redirect to `/login`.
- Core’s global response interceptor wraps successful handler payloads in
  `{ success, data, correlationId, timestamp }`; paginated responses also have
  `meta`. The Gateway streams that envelope unchanged. The current auth client
  still accepts a legacy direct token object as a compatibility fallback, but
  new feature clients should type and unwrap the canonical envelope.
- Core errors use the canonical envelope’s `errorCode`; errors produced by the
  Gateway itself use RFC 9457-style Problem Details with `code`. Normalize both
  shapes and preserve `correlationId` for support.
- Gateway routes classified as `WRITE_SENSITIVE` with `idempotent: true`
  require an `x-idempotency-key` UUIDv7 header. Generate one key for each user
  intent and reuse it only for an exact retry of that request.

Public auth routes are login, refresh, accept-invite, forgot-password,
reset-password, and logout. `/auth/me` and `/auth/logout-all` require an
authenticated admin session.

## Global DTO and validation rules

`core-app` installs a global Nest `ValidationPipe` with:

```ts
{
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true }
}
```

Frontend consequences:

- Send only documented DTO fields. Extra body, query, or parameter keys can
  produce HTTP `400`.
- Do not submit empty strings for optional typed fields unless the DTO
  explicitly transforms them.
- Treat IDs documented with `@IsUUID("7")` as UUIDv7; placeholder IDs such as
  `"1"` and `"new-role-id"` are not valid API inputs.
- Query booleans using DTOs with the strict boolean transform accept
  `true`, `false`, `"true"`, `"false"`, `"1"`, and `"0"`. Other strings fail
  boolean validation.
- Dates use ISO date strings. Prefer `YYYY-MM-DD` for calendar filters and full
  ISO timestamps for event timestamps.
- Enum values are case-sensitive transport values. Translate labels in the UI,
  but send the raw uppercase value.
- Pagination defaults and allowed `sortBy` fields vary by endpoint. Do not
  create one global sort-field list.
- Error `message` may be a string or a validation-message array, and custom
  domain errors may also include a stable `code`.

Selected shared DTOs are in [models/dtos.md](models/dtos.md); each API page
contains its domain DTOs and validation notes.

## Enum rules

Use [models/enums.md](models/enums.md) as the transport-value reference.

- Keep enum values separate from translated labels.
- Always include an unknown-value fallback so a newly added backend enum does
  not crash rendering.
- `ratio` and `percent` fields in dashboard responses are normalized decimal
  values unless a specific API document says otherwise.
- Destructive actions must be derived from status and permission together, not
  status alone.

## RBAC and navigation

- Fetch `/api/admin/core/v1/auth/me` before showing protected portal content.
- Treat the `permissions` array from `/auth/me` as the source for navigation
  visibility and action availability.
- Hiding a button is not authorization; the backend guard remains authoritative.
- Dashboard visibility requires `admin.reports.read`.
- See [rbac/permissions.md](rbac/permissions.md) for the permission catalogue
  and [guides/sidebar-navigation.md](guides/sidebar-navigation.md) for the
  proposed module mapping.

The current top navigation is not yet permission-gated. Add permission checks
when each module becomes server-backed.

## Backend capability snapshot

At the verification date, the API Gateway contains **202** Core admin route
contracts and **16** Worker admin route contracts.

Core route groups:

| Group | Routes | Existing frontend doc |
|:---|---:|:---|
| Auth | 8 | [auth.md](api/auth.md) |
| Dashboard | 1 | [dashboard.md](api/dashboard.md) |
| Admin users | 15 | [users.md](api/users.md) |
| Roles and permissions | 7 | [roles-permissions.md](api/roles-permissions.md) |
| Tenants and nested tenant resources | 58 | [tenants.md](api/tenants.md), [tenant-users.md](api/tenant-users.md), [tenant-operations.md](api/tenant-operations.md) |
| Provisioning control plane | 32 | [tenants.md](api/tenants.md), [tenant-operations.md](api/tenant-operations.md) |
| Database servers | 10 | [database-servers.md](api/database-servers.md) |
| Catalogue: modules, tiers, features, grants, pricing | 18 | [catalog.md](api/catalog.md) |
| Subscriptions | 5 | [subscriptions.md](api/subscriptions.md) |
| Invoices | 7 | [invoices.md](api/invoices.md) |
| Wallet and ledger | 2 direct groups plus nested tenant routes | [wallet.md](api/wallet.md) |
| Reports | 5 | [reports.md](api/reports.md) |
| System settings | 6 | [system-settings.md](api/system-settings.md) |
| Logging | 6 | [logging.md](api/logging.md) |
| Notifications | 14 | [notifications.md](api/notifications.md) |
| Billing rates | 3 | [catalog.md](api/catalog.md) |
| Payments/reconciliation | 4 plus nested tenant routes | Domain coverage is partial in current frontend docs |

All 16 Worker admin routes belong to backup policies, backup runs/artifacts,
and restore runs. Their canonical browser prefix is
`/api/admin/worker/v1`, as detailed in
[backups-restores.md](api/backups-restores.md).

Counts are an inventory aid, not a stable API promise. Re-run the gateway route
inventory when backend contracts change.

## Recommended integration order

1. Keep all requests on the shared client and canonical gateway paths.
2. Replace the dashboard mock using the adapter notes in
   [api/dashboard.md](api/dashboard.md).
3. Wire permission-gated navigation from `/auth/me`.
4. Integrate database servers, tenants, catalogue, admin users, and roles.
5. Replace settings fail-open/simulated-success behavior with real error states.
6. Add notifications and WebPhone only after their session and secret-handling
   contracts are implemented.
7. Add Worker backup/restore screens when they enter the Admin Portal
   navigation.

For every screen, complete loading, empty, validation, forbidden, conflict,
rate-limit, and retry behavior before marking the integration production-ready.
