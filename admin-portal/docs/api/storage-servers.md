# Storage Servers API Contract Verification

Status: **[Verified]**
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
| PATCH | `/api/admin/core/v1/storage-servers/:id` | `useStorageServerDetail` (handleUpdate) | DONE |
| POST | `/api/admin/core/v1/storage-servers/:id/activate` | `useStorageServerDetail` (handleActivate) | DONE |
| POST | `/api/admin/core/v1/storage-servers/:id/offline` | `useStorageServerDetail` (handleOffline) | DONE |
| DELETE | `/api/admin/core/v1/storage-servers/:id` | `useStorageServerDetail` (handleDelete) | DONE |

## Permissions
- **Read:** `admin.storage_servers.read`
- **Create:** `admin.storage_servers.create` + `admin.storage_servers.critical`
- **Update:** `admin.storage_servers.update` + `admin.storage_servers.critical`
- **Delete:** `admin.storage_servers.delete` + `admin.storage_servers.critical`

## Enums
- `StorageServerStatus`: DRAFT | ACTIVE | OFFLINE
- `StorageConnectionTestStatus`: PASSED | FAILED | NOT_TESTED

## Notes
- The architecture has moved from "Garage Topology" to standalone S3-compatible servers.
- Strict adherence to idempotency keys is managed internally via `axiosClient` interceptors (or wrapper).
- Destructive actions (offline, delete) are strictly gated by `.critical` permissions in the hooks using `adminCanAll`.
- Connection testing happens implicitly during activation. `lastConnectionTestErrorCode` provides feedback on failures.


## DTOs (Migrated from dtos.md)

Storage Server registration, base update, full routing-profile replacement,
principal-reference rotation, verification, lifecycle, attestation-key, and
source-bound recovery-evidence DTOs are documented in the verified
[Storage Servers Frontend Contract](../api/storage-servers.md).

Important shared constraints:

- all Storage Server and attestation-key mutations require UUIDv7
  `x-idempotency-key`;
- create/update endpoint URLs are absolute and credential-free, and the public
  endpoint is HTTPS;
- routing profile is a full replacement with an
  `expectedBindingRevision`, four distinct mandatory class buckets, nine
  principal references, and six attestation key IDs;
- principal references match exact `env:S3_<PREFIX>_<PRINCIPAL>_<ROLE>`
  suffixes and are never secret material;
- rotation, verification, lifecycle, key promotion, and delete requests have
  no body where the API contract says none;
- recovery-destination registration accepts a write-only
  `env:STORAGE_RECOVERY_*` locator, while policy verification is
  revision-fenced and requires a trusted source-bound evidence package;
- recovery evidence uses canonical millisecond UTC timestamps, distinct
  lowercase SHA-256 digests, and three distinct administration boundaries;
- no DTO accepts an access key, secret key, Ed25519 private key, raw
  fingerprint, or force-activation flag.

---
