# Logging Overrides and Live Stream API

Status: **[Verified]**

Last source verification: **2026-08-12**

Owner: **Core**

## Routes

| Method and canonical browser path | Permissions | Protocol |
| --- | --- | --- |
| `GET /api/admin/core/v1/logging/level-overrides` | `admin.logging.read` | JSON |
| `GET /api/admin/core/v1/logging/level-overrides/effective` | `admin.logging.read` | JSON |
| `GET /api/admin/core/v1/logging/level-overrides/history` | `admin.logging.read` | JSON |
| `GET /api/admin/core/v1/logging/level-overrides/live` | `admin.logging.read` + `admin.logging.critical` | SSE |
| `PUT /api/admin/core/v1/logging/level-overrides` | `admin.logging.update` + `admin.logging.critical` | JSON |
| `DELETE /api/admin/core/v1/logging/level-overrides/:id` | `admin.logging.update` + `admin.logging.critical` | `204` |

Permission pairs use ALL semantics.

## Override DTO

```ts
interface UpsertLoggingLevelOverrideDto {
  scope: "GLOBAL" | "APP" | "TENANT" | "TENANT_APP";
  appName?: string;
  tenantId?: string;
  level: "debug" | "info" | "warn" | "error" | "fatal";
  reason: string;
  expiresAt: string; // no more than 24 hours in the future
}
```

`trace` can be read/filtered where supported but is not a writable override
level.

Scope precedence:

```text
TENANT_APP > TENANT > APP > GLOBAL
```

Validate required/forbidden `appName` and `tenantId` combinations from the
scope-specific DTO rules.

## Live stream

Use a credential-compatible SSE implementation through Gateway. Preserve
cookie authentication, query filters, connection/reconnection state, and
correlation/support detail. Do not silently downgrade critical permission
failures into an empty stream.

Logs can contain sensitive data. Apply safe rendering, bounded buffering, and
export/copy restrictions; never deliberately surface secrets.

## Current frontend status

`/logging` source-integrates all six routes: override list/upsert/delete,
effective state, history, and the authorized SSE live stream. The module has
exact permission gates, validated override controls, destructive confirmation,
bounded reconnect/stale/error states, bilingual copy, and focused tests.
Authenticated runtime and deployment verification remain separate gates.

## Source map

- `../backend/mutakamel-apps/core-app/src/admin/logging/logging-level-overrides.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/logging/dto/`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
