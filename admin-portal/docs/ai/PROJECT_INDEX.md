# Project Index

Last source verification: **2026-08-04**

## Documentation

- [Documentation contract](../DOCUMENTATION_CONTRACT.md)
- [API index](../api/README.md)
- [Backup and Restore contract](../api/backups-restores.md)
- [Generated 243-route inventory](../generated/admin-core-api-routes.md)
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

## Database and Backup ownership

| Frontend module | Current source ownership |
| --- | --- |
| `/database-servers` | Registry, TLS/connectivity, lifecycle, `mutakamel_provisioner`, and per-Application principals under `src/features/admin/database-servers/` |
| `/backup` | Overview, fixed `mutakamel_backup` access, Worker policies, runs, artifacts, and restores under `src/features/admin/backup/` |

The modules share no feature imports. Database Servers consumes only aggregate
Backup readiness and links to `/backup/access`. Backup source integration is
release-blocked until Worker returns explicit safe response DTOs and exposes
durable recovery identity for non-idempotent start commands.

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
