# Project Index

Last source verification: **2026-08-05**

## Documentation

- [Documentation contract](../DOCUMENTATION_CONTRACT.md)
- [API index](../api/README.md)
- [Backup and Restore contract](../api/backups-restores.md)
- [Generated 235-route inventory](../generated/admin-core-api-routes.md)
- [Frontend capability matrix](../audit/frontend-capability-matrix.md)
- [Documentation coverage](../audit/documentation-coverage.md)
- [HTTP/error contract](../architecture/http-and-error-contract.md)
- [Permissions/idempotency/state](../architecture/permissions-idempotency-and-state.md)
- [Frontend integration guide](../frontend-integration-guide.md)
- [DTO reference](../models/dtos.md)
- [Enum reference](../models/enums.md)
- [Interface reference](../models/interfaces.md)
- [RBAC reference](../rbac/permissions.md)

## Frontend foundations

| Concern | Current source |
| --- | --- |
| HTTP/session client | `src/lib/api/axiosClient.ts` |
| Auth provider | `src/context/AuthContext.tsx` |
| Session refresh | `src/lib/auth/sessionRefresh.ts` |
| RBAC helpers | `src/lib/auth/rbac.ts` |
| Permission component | `src/components/auth/RequirePermission.tsx` |
| UUID helpers | `src/lib/utils/uuid.ts` |
| Shared types | `src/types/` |
| Feature routes | `src/app/` |

## Infrastructure and Backup ownership

| Frontend module | Current source ownership |
| --- | --- |
| `/database-servers` | Registry, TLS/connectivity, constrained PostgreSQL security-admin posture, lifecycle, `mutakamel_provisioner`, and per-Application principals under `src/features/admin/database-servers/` |
| `/storage-servers` | Registry, write-only Garage/S3 registration, lifecycle, durable safe probes, connection-evidence freshness, and placement policy under `src/features/admin/storage-servers/` |
| `/backup` | Overview, fixed `mutakamel_backup` access, Worker policies, runs, artifacts, and restores under `src/features/admin/backup/` |

The modules share no feature imports. Storage route files are routing-only;
their API, state, validation, and screens live in the feature directory.
Database Servers consumes only aggregate
Backup readiness and links to `/backup/access`. Worker safe response DTOs and
durable actor/intent-bound command identity are source-integrated. Package/schema
adoption plus authenticated runtime and deployment evidence remain release
gates.

Storage Server list/detail reads are abortable and generation-fenced. Every
write has a caller-owned stable UUIDv7 intent. The UI separates lifecycle from
connection evidence: manual probes do not change lifecycle, evidence is valid
for 24 hours, and the displayed automatic cadence is the Worker-owned 12-hour
schedule. Tenant-create placement strips endpoint, bucket, and credentials.

## Backend authorities

Paths are relative to `C:\mutakamel.ai\frontend`:

| Concern | Source |
| --- | --- |
| Core Gateway routes | `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts` |
| Admin canonical path logic | `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/gateway-api-path.ts` |
| Core Admin composition | `../backend/mutakamel-apps/core-app/src/admin/admin.module.ts` |
| Core Admin domains | `../backend/mutakamel-apps/core-app/src/admin/` |
| Worker routes | `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/worker.route-contracts.ts` |

## Validation scripts

| Command | Purpose |
| --- | --- |
| `npm run docs:routes` | Regenerate the source-derived Core Admin inventory |
| `npm run docs:check` | Check inventory drift and documentation links/contracts |
| `npx vitest run` | Run unit/regression tests |
| `npx tsc --noEmit` | Type validation |
| `npm run lint -- --max-warnings=0` | Strict lint validation |
| `npm run build` | Production source build |
