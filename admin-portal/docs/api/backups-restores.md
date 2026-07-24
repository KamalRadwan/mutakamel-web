# Backups & Restores API

Browser prefix: `/api/admin/worker/v1`

These routes are served by `worker-app` through API Gateway. The `/admin/...`
forms below are Worker controller-relative paths, not browser request URLs.

## Backups — `/admin/backups`

Base Path: `admin/backups`
Guard: `AdminGuard`

---

### GET `/admin/backups/policies` — List Backup Policies
**Permission**: `admin.backups.read`

### GET `/admin/backups/policies/:databaseServerId` — Get Policy
**Permission**: `admin.backups.read`

### PUT `/admin/backups/policies/:databaseServerId` — Upsert Policy
**Permission**: `admin.backups.manage`

### GET `/admin/backups/policies/:databaseServerId/databases` — List Databases
**Permission**: `admin.backups.read`

### PUT `/admin/backups/policies/:databaseServerId/databases/:tenantId` — Upsert Override
**Permission**: `admin.backups.manage`

### DELETE `/admin/backups/policies/:databaseServerId/databases/:tenantId` — Remove Override
**Permission**: `admin.backups.manage`

### POST `/admin/backups/runs` — Start Backup Run
**Permission**: `admin.backups.manage`

### GET `/admin/backups/runs` — List Backup Runs
**Permission**: `admin.backups.read`

### GET `/admin/backups/runs/:runId` — Get Run
**Permission**: `admin.backups.read`

### DELETE `/admin/backups/runs/:runId` — Delete Run
**Permission**: `admin.backups.delete`

### GET `/admin/backups/artifacts` — List Artifacts
**Permission**: `admin.backups.read`

### DELETE `/admin/backups/artifacts/:artifactId` — Delete Artifact
**Permission**: `admin.backups.delete`

---

## Restores — `/admin/restores`

Base Path: `admin/restores`
Guard: `AdminGuard`

### POST `/admin/restores/runs` — Start Restore
**Permission**: `admin.backups.restore`

### GET `/admin/restores/runs` — List Restores
**Permission**: `admin.backups.read`

### GET `/admin/restores/runs/:runId` — Get Restore
**Permission**: `admin.backups.read`

### POST `/admin/restores/runs/:runId/promote` — Promote Restore
**Permission**: `admin.backups.restore`
