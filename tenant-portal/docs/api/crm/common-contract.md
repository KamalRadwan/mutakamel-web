# CRM common browser contract

> Status: `verified-current`
> Last source verification: `2026-07-25`
> Auth/session boundary reverified: `2026-08-10`
> Owner: CRM (`crm-app`)
> Canonical browser prefix: `/api/tenant/crm/v1`
> Controller-relative prefix: `/api/v1/crm`
> Tenant Portal replacement: `partial-source`
> Historical consolidated frontend: `absent-from-current-checkout`
> Authorship: hand-written from current backend source; historical frontend evidence is non-authoritative

This page defines behavior shared by all 137 Gateway-exposed CRM routes. A domain page overrides it only where explicitly stated.

## Routing boundary

Browser code calls:

```text
/api/tenant/crm/v1/{resource}
```

The Gateway proxies that to the CRM controller:

```text
/api/v1/crm/{resource}
```

For example, browser `GET /api/tenant/crm/v1/leads` maps to controller `GET /api/v1/crm/leads`. Never call `crm-app` directly and never use controller paths in browser code.

All 137 routes are tenant-authenticated. None is public or intentionally internal. Five controller-only routes are unreachable through the tenant Gateway; see the [index](./README.md#known-gateway-gaps).

## Authentication and tenant trust

Requests use the portal's canonical tenant session. The Gateway establishes trusted tenant and actor context before forwarding. Browser code must not set or copy:

- `x-mutakamel-*`
- `x-internal-gateway-secret`
- `x-tenant`
- forwarded tenant, user, permission, branch, team, or entitlement headers

CRM accepts a tenant user actor only with `identityId`, `tenantId`, UUIDv7
`sid`, and positive safe-integer `securityEpoch`, `authorizationVersion`,
`profileVersion`, and `sessionEpoch`. It rechecks all of them against the active
database identity/session. A non-owner also needs an active CRM seat. Typical
access failures include:

- `SESSION_CONTEXT_REQUIRED`
- `SESSION_IDENTITY_INACTIVE`
- `SESSION_INVALIDATED`
- `CRM_MODULE_SEAT_REQUIRED`
- `CRM_PROVISIONING_MAINTENANCE_ACTIVE`
- `ENTITLEMENT_UNAVAILABLE`
- `CRM_SUBSCRIPTION_BLOCKED`
- `CRM_SUBSCRIPTION_READ_ONLY`
- `CRM_MODULE_DISABLED`
- `CRM_FEATURE_DISABLED`
- `ENTITLEMENT_POLICY_INVALID`

A tenant owner is granted the effective CRM permission set. Other actors are evaluated from assigned permissions, branches, managed teams, module seats, subscription mode, and feature flags.

## Permissions and scopes

Static permissions do not have a scope suffix:

```text
crm.settings.read
crm.settings.update
crm.settings.manage
crm.lead_stages.read
crm.lead_stages.manage
crm.acquisition_sources.read
crm.acquisition_sources.manage
crm.pipelines.read
crm.pipelines.manage
crm.custom_fields.read
crm.custom_fields.manage
crm.dashboards.create
crm.dashboards.update
crm.dashboards.delete
crm.dashboards.share
crm.widgets.read
crm.widgets.create
crm.widgets.update
crm.widgets.delete
crm.widgets.share
```

Scoped permission bases append `.own`, `.team`, or `.all`:

```text
crm.customer_profiles.{read|create|update|delete}
crm.leads.{read|create|update|convert|delete}
crm.opportunities.{read|create|update|delete}
crm.activities.{read|create|update|delete}
crm.notes.{read|create|update|delete}
crm.attachments.{read|create|delete}
crm.dashboards.read
crm.email.send
```

Scope precedence is `all > team > own`.

- `all` permits records inside the actor's authorized branch set.
- `team` permits records owned by the actor or by members of teams the actor manages.
- `own` permits records owned by the actor.
- `branchId` is still required wherever the DTO says it is required. A supplied owner filter only narrows visibility; it never expands it.
- Detail/update/delete services re-check the stored record's branch and scope. Possessing an ID does not bypass access.
- Pipeline assignment can further restrict pipeline and board access.

Clients may use capability data to decide what to render, but the API remains the authorization authority.

## Validation

CRM uses a global validation pipe with transform enabled, implicit primitive conversion, whitelist enforcement, and unknown-field rejection. DTO failures return `CRM_VALIDATION_FAILED`. Do not send UI-only properties or rely on the server silently discarding them.

Unless a route says otherwise:

- IDs are UUIDv7.
- date-time values are ISO 8601 strings.
- booleans must be real JSON booleans; fields marked strict do not accept `"true"` or `1`.
- enum values are uppercase wire strings and are case-sensitive.
- omitted optional fields and explicit `null` are not interchangeable unless the DTO/service explicitly supports `null`.
- arrays are bounded and validated item-by-item where their schema is defined.

Common offset pagination:

| Query | Contract |
|---|---|
| `page` | integer, minimum `1`, default `1` |
| `limit` | integer, `1..100`, default `20` |
| `sortBy` | string, maximum 100 characters; domain allowlist still applies |
| `sortDir` | exact `ASC` or `DESC` |
| `search` | string, maximum 200 characters |

The common result is:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "limit": 20,
  "totalPages": 0,
  "hasNext": false,
  "hasPrev": false
}
```

Outbound email and board-card endpoints instead use opaque cursor pagination as documented on their pages. Treat cursors as unparsed, context-bound tokens.

## Success and error payloads

CRM currently returns controller/service payloads directly. There is no CRM-wide success envelope interceptor. Therefore:

- do not expect `{ "success": true, "data": ... }`;
- collection and entity shapes are the raw service projections documented per domain;
- `204 No Content` has no response body;
- icon, upload/download, and attachment routes may return streams or upload projections;
- outbound create/retry return `202 Accepted`;
- create endpoints otherwise generally return `201 Created`.

CRM application errors use:

```json
{
  "success": false,
  "statusCode": 422,
  "errorCode": "CRM_VALIDATION_FAILED",
  "errorCategory": "VALIDATION",
  "message": "Request validation failed",
  "details": {},
  "correlationId": "…",
  "timestamp": "2026-07-25T12:00:00.000Z",
  "path": "/api/v1/crm/leads"
}
```

`details` is optional. Gateway-originated errors use RFC 7807-style Problem Details and may have a different shape. Client error parsing must preserve the HTTP status, machine code, correlation/request identifier, and any field details without exposing sensitive internals to end users.

Common statuses include `400` validation, `401` unauthenticated/session invalid, `403` permission/branch/seat/subscription/feature denial, `404` inaccessible or absent records, `409` state/revision/idempotency conflict, `413` body/file too large, `415` unsupported media, `422` semantic validation or idempotency mismatch, `429` throttling, and `5xx` dependency failure. A `404` can intentionally conceal an inaccessible record.

## Idempotency and retry

The Gateway requires `x-idempotency-key` containing a UUIDv7 on exactly these 14 routes:

| Method | Canonical browser path |
|---|---|
| `PUT` | `/api/tenant/crm/v1/dashboards/from-template/:templateKey` |
| `PUT` | `/api/tenant/crm/v1/dashboards/:id/default` |
| `PUT` | `/api/tenant/crm/v1/dashboards/:id/favorite` |
| `PUT` | `/api/tenant/crm/v1/dashboards/:id/layout` |
| `POST` | `/api/tenant/crm/v1/dashboards/:id/shares` |
| `POST` | `/api/tenant/crm/v1/widgets/:id/shares` |
| `PATCH` | `/api/tenant/crm/v1/lead-stages/reorder` |
| `PATCH` | `/api/tenant/crm/v1/acquisition-sources/reorder` |
| `PUT` | `/api/tenant/crm/v1/opportunities/:id/pipeline` |
| `PUT` | `/api/tenant/crm/v1/pipelines/:id/default` |
| `PUT` | `/api/tenant/crm/v1/pipelines/:id/assignments` |
| `PATCH` | `/api/tenant/crm/v1/pipelines/:id/stages/reorder` |
| `POST` | `/api/tenant/crm/v1/outbound-emails` |
| `POST` | `/api/tenant/crm/v1/outbound-emails/:outboundEmailId/retry` |

Generate one key when the user begins a logical operation and retain it through transport retries of that same method, path, actor, and body. Never reuse it for edited input or a different operation. `crypto.randomUUID()` produces UUIDv4 and does not satisfy the UUIDv7 contract.

Gateway idempotency failures:

| Code | HTTP | Meaning |
|---|---:|---|
| `GW.IDEM.MISSING` | 400 | header absent |
| `GW.IDEM.BAD_VALUE` | 400 | not an accepted UUIDv7 |
| `GW.IDEM.IN_FLIGHT` | 409 | same operation still executing |
| `GW.IDEM.MISMATCH` | 422 | key reused with a different request fingerprint |

A replayed response includes `idempotency-replayed: true`. Mutations not listed above have no Gateway replay guarantee; do not automatically retry them after an ambiguous transport failure. Outbound create/retry also implement durable domain idempotency and disable transport retries.

## Concurrency, caching, and asynchronous work

- Dashboard definitions, widgets, and layout mutations use optimistic `revision` checks.
- Opaque board/outbound cursors can become invalid if filters or context change.
- Private attachment/icon/email-option/email-preview responses use restrictive cache behavior where set by the controller. The portal should default CRM authenticated data to `no-store`.
- Reminder creation is synchronous, but delivery is asynchronous.
- Outbound email create/retry is accepted synchronously and delivered by Worker/outbox processing. Poll list/detail; do not infer delivery from `202`.

## Security implementation rules

1. Use same-origin browser routes and session credentials.
2. Never trust UI state as proof of permission, branch membership, entitlement, or record visibility.
3. Never log access tokens, trusted headers, attachment bytes, rendered email bodies, SIP details, or full error internals.
4. Render user-provided rich/plain content safely. Email preview HTML is untrusted content even when server-rendered.
5. Use server-provided filenames and `Content-Disposition` defensively for downloads.
6. Do not expose storage keys; use returned URLs/download endpoints.
7. Keep idempotency keys out of analytics and error messages.
8. Re-fetch after revision conflicts and require the user to reconcile changes.

## Sources

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/crm.route-contracts.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/idempotency/gateway-idempotency.service.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/common/filters/problem-details.filter.ts`
- `../backend/mutakamel-apps/crm-app/src/main.ts`
- `../backend/mutakamel-apps/crm-app/src/common/common.module.ts`
- `../backend/mutakamel-apps/crm-app/src/common/crm-scoped-access.service.ts`
- `../backend/mutakamel-apps/crm-app/src/common/guards/permissions.guard.ts`
- `../backend/mutakamel-apps/crm-app/src/common/guards/branch-access.guard.ts`
- `../backend/mutakamel-apps/crm-app/src/common/guards/subscription.guard.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/common/dto/crm-list-query.dto.ts`
- `../backend/mutakamel-apps/crm-app/packages/common/src/enums/crm.enums.ts`
