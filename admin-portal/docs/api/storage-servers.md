# Storage Servers API Contract Verification

**Status:** `DONE` (Frontend implementation complete)
**Owning Backend App:** `core-app`
**Owning Controller:** `storage-servers.controller.ts`
**Frontend App:** `admin-portal`
**Public Gateway Path:** `/api/admin/core/v1/storage-servers`
**Last Verification Date:** 2026-08-01

## Endpoints Implemented

| Method | Route | Frontend Hook | Status |
|--------|-------|---------------|--------|
| POST | `/api/admin/core/v1/storage-servers` | `useStorageServers` (handleCreate) | DONE |
| GET | `/api/admin/core/v1/storage-servers` | `useStorageServers` | DONE |
| GET | `/api/admin/core/v1/storage-servers/:id` | `useStorageServerDetail` | DONE |
| GET | `/api/admin/core/v1/storage-servers/:id/history` | `useStorageServerDetail` | DONE |
| PATCH | `/api/admin/core/v1/storage-servers/:id` | `useStorageServerDetail` (handleUpdate) | DONE |
| POST | `/api/admin/core/v1/storage-servers/:id/verification-runs` | `useStorageServerDetail` (handleVerify) | DONE |
| GET | `/api/admin/core/v1/storage-servers/:id/verification-runs/:runId` | `storageServersApi.ts` (getVerificationRun) | DONE |
| PATCH | `/api/admin/core/v1/storage-servers/:id/routing-profile` | `useStorageServerDetail` (handleSetRouting) | DONE |
| POST | `/api/admin/core/v1/storage-servers/:id/activate` | `useStorageServerDetail` (handleActivate) | DONE |
| POST | `/api/admin/core/v1/storage-servers/:id/drain` | `useStorageServerDetail` (handleDrain) | DONE |
| POST | `/api/admin/core/v1/storage-servers/:id/offline` | `useStorageServerDetail` (handleOffline) | DONE |
| DELETE | `/api/admin/core/v1/storage-servers/:id` | `useStorageServerDetail` (handleDelete) | DONE |

## Permissions
- **Read:** `admin.storage_servers.read`
- **Create:** `admin.storage_servers.create` + `admin.storage_servers.critical`
- **Update:** `admin.storage_servers.update` + `admin.storage_servers.critical`
- **Delete:** `admin.storage_servers.delete` + `admin.storage_servers.critical`

## Enums
- `StoragePlacementRole`: GENERAL | BACKUP_ONLY
- `StorageServerStatus`: DRAFT | ACTIVE | DRAINING | OFFLINE

## Notes
- Strict adherence to idempotency keys is managed internally via `axiosClient` interceptors (or wrapper).
- Destructive actions (drain, offline, delete) are strictly gated by `.critical` permissions in the hooks using `adminCanAll`.
