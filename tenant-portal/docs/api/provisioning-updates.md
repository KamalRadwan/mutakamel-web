# Tenant provisioning updates API

> **Contract status:** Current V2 tenant self-service surface
> **Last verified:** 2026-07-25
> **Backend owner:** Core control plane; Worker executes the asynchronous operation
> **Canonical browser prefixes:** `/api/tenant/core/v1/provisioning/updates`, `/api/tenant/core/v1/provisioning/operations`
> **Controller-relative prefixes:** `/tenant/provisioning/updates`, `/tenant/provisioning/operations`
> **Tenant Portal status:** Planned. A live legacy settings implementation exists and is the reference for polling semantics.
> **Documentation:** Hand-written and source-verified; not generated.

## Source of truth

- Gateway contracts: `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- Controllers/DTO/read model/command service: `../backend/mutakamel-apps/core-app/src/admin/tenants/provisioning`
- Legacy client/types: `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/settings/tenant-provisioning-updates-api.ts` and `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/settings/tenant-provisioning-updates-types.ts`
- Worker execution contracts: `../backend/mutakamel-apps/worker-app`

## Security and routes

All routes require a tenant JWT, verified host matching the token, current session/subscription, and permission. Tenant scope is resolved server-side.

| Method and canonical browser path | Permission | Contract |
|---|---|---|
| `GET /api/tenant/core/v1/provisioning/updates` | `workspace.read` | Paginated available-update projection; `private, no-store` |
| `POST /api/tenant/core/v1/provisioning/updates/apply` | `workspace.manage` | `202`, UUIDv7 idempotency key, starts exact pinned update |
| `GET /api/tenant/core/v1/provisioning/operations/:operationId` | `workspace.read` | Poll operation; `private, no-store` |

Core rejects unknown DTO fields. IDs are UUIDv7. JSON uses the Core envelopes; the list returns items in `data` and normal page metadata in `meta`.

## List filters and response

Common pagination applies (`page` 1, `limit` 20/max 100, `search` max 200). Additional filters:

- `componentKey`: maximum 96, `^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9_-]*)*$`.
- `riskLevel`: `LOW|MEDIUM|HIGH`.
- `requiresBackup`, `requiresMaintenance`: strict booleans.
- `sortBy`: `componentKey|publishedAt|riskLevel`; `sortDir=ASC|DESC`.

Each item contains component identity/owner, `installationState=READY|OUTDATED`, exact current release evidence, optional desired release, whether an update is already planned, and an `availableRelease`. Available releases include release/manifest/schema identifiers, risk, backup/maintenance flags, compatibility contract version, and publication time. Only server-returned releases with `selfServiceAllowed: true` appear in this surface.

## Apply validation and idempotency

Body is `{selections:[...]}` with 1–100 entries unique by `componentKey`. Every selection must copy the exact values from the no-store list response:

| Field | Validation |
|---|---|
| `componentKey` | component pattern above |
| `targetReleaseId` | UUIDv7 |
| `targetReleaseVersion` | string 1–120 |
| `targetManifestChecksum` | exactly 64 lowercase hexadecimal characters |
| `currentAppliedReleaseId` | UUIDv7 |
| `currentAppliedManifestChecksum` | exactly 64 lowercase hexadecimal characters |

Safe pinned-apply example:

```http
POST /api/tenant/core/v1/provisioning/updates/apply
Authorization: Bearer <tenant-access-token>
Content-Type: application/json
X-Idempotency-Key: 019f9871-fd40-7680-bfbb-fd535b5880c8

{
  "selections":[{
    "componentKey":"crm.schema",
    "targetReleaseId":"019f9872-0a1a-7cc0-914d-a57aa437fc41",
    "targetReleaseVersion":"2.3.0",
    "targetManifestChecksum":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "currentAppliedReleaseId":"019f9872-1a1a-7cc0-914d-a57aa437fc42",
    "currentAppliedManifestChecksum":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  }]
}
```

The pin prevents approving one release and silently installing another. Stale current/target evidence fails; refetch and ask the user to consent again.

The key must be UUIDv7. Reusing it for the identical body returns the original operation; another payload fails. Do not create a new key merely because a request timed out—first retry the exact command with its original key.

## Asynchronous operation

Apply returns `{replayed,operation}`. The operation includes:

- `id`, `generation`, `type:"UPDATE"`.
- `status`: `REQUESTED|PLANNING|QUEUED|RUNNING|WAITING_RETRY|CANCEL_REQUESTED|SUCCEEDED|FAILED_RETRYABLE|MANUAL_RECOVERY_REQUIRED|CANCELLED`.
- `currentPhase`, requested/updated timestamps.
- `progress`: total/completed/failed steps and percentage.
- Optional sanitized `safeError` with nullable code/message.

Poll the returned operation ID with backoff. Terminal states are `SUCCEEDED`, `MANUAL_RECOVERY_REQUIRED`, and `CANCELLED`; `FAILED_RETRYABLE` describes server orchestration state and is not permission to resubmit the apply command.

## Errors, cache, and AI rules

Expected errors include `TENANT_PROVISIONING_UPDATE_SELECTION_INVALID`, `TENANT_PROVISIONING_PLAN_STALE`, `TENANT_PROVISIONING_OPERATION_STATE_INVALID`, `TENANT_PROVISIONING_OPERATION_SUPERSEDED`, `TENANT_OPERATION_NOT_FOUND`, `IDEMPOTENCY_KEY_REQUIRED`, `INVALID_IDEMPOTENCY_KEY`, and `IDEMPOTENCY_KEY_REUSED`.

- Never cache update inventories or operation status.
- Never let the portal choose a release not present in the current response.
- Warn clearly for `HIGH` risk and required backup/maintenance.
- Do not expose internal Worker events; render only the Core safe read model.
- The old discovery/reconcile V1 flow is not a Tenant Portal API and must not be reintroduced.
