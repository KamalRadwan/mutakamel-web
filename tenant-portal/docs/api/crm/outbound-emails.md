# CRM outbound emails

> Status: `verified-current`
> Last source verification: `2026-07-25`
> Owner: CRM (`crm-app`)
> Canonical browser prefix: `/api/tenant/crm/v1`
> Controller-relative prefix: `/api/v1/crm`
> Tenant Portal replacement: `not-started`
> Historical consolidated frontend: `absent-from-current-checkout`
> Authorship: hand-written from current backend source; historical frontend evidence is non-authoritative

Outbound email resolves an approved CRM recipient and compatible template, creates an auditable activity/email intent, and delivers asynchronously through Worker infrastructure.

All six routes require the `crm.outbound_email` feature in addition to normal CRM module/seat/subscription checks.

## Endpoint catalogue

| Method | Canonical browser path | Controller/upstream path | Permission | Success |
|---|---|---|---|---|
| `POST` | `/api/tenant/crm/v1/outbound-emails/options` | `/api/v1/crm/outbound-emails/options` | `crm.email.send.{own|team|all}` | `200`, options |
| `POST` | `/api/tenant/crm/v1/outbound-emails/preview` | `/api/v1/crm/outbound-emails/preview` | `crm.email.send.{own|team|all}` | `200`, preview |
| `POST` | `/api/tenant/crm/v1/outbound-emails` | `/api/v1/crm/outbound-emails` | `crm.email.send.{own|team|all}` | `202`, accepted |
| `GET` | `/api/tenant/crm/v1/outbound-emails` | `/api/v1/crm/outbound-emails` | `crm.activities.read.{own|team|all}` | `200`, cursor page |
| `GET` | `/api/tenant/crm/v1/outbound-emails/:outboundEmailId` | `/api/v1/crm/outbound-emails/:outboundEmailId` | `crm.activities.read.{own|team|all}` | `200`, detail |
| `POST` | `/api/tenant/crm/v1/outbound-emails/:outboundEmailId/retry` | `/api/v1/crm/outbound-emails/:outboundEmailId/retry` | `crm.email.send.{own|team|all}` | `202`, accepted retry |

Send permission is source/branch/owner scoped. List/detail use activity-read scope. Being able to read a historical email does not grant permission to send or retry.

## Options request

Body:

| Field | Contract |
|---|---|
| `sourceType` | `LEAD`, `CUSTOMER_PROFILE`, or `OPPORTUNITY` |
| `sourceId` | required UUID; source and scope are revalidated |
| `locale` | optional, maximum 35, BCP-47-like locale regex |

The no-store response contains:

- resolved source/locale;
- approved recipient options with reference, display name, masked address, and primary flag;
- compatible template options with IDs, code/name/version/locale/direction and selection reason;
- effective assigned template version, if any;
- `availability`: `NO_APPROVED_RECIPIENT` and/or `NO_COMPATIBLE_TEMPLATE`.

Never use a displayed/masked email address as the recipient input. Submit the server-issued reference.

## Recipient, preview, and create

Recipient:

```json
{ "kind": "SOURCE_PRIMARY_CONTACT" }
```

or:

```json
{
  "kind": "PARTY_CONTACT",
  "partyId": "<uuid>",
  "contactId": "<uuid>"
}
```

`PARTY_CONTACT` requires both UUIDs. Create/preview extend the options request with required `recipient` and optional UUID `templateVersionId`.

Preview is side-effect free: it does not create an email intent, activity, recipient snapshot, or outbox event. It returns source, masked recipient, immutable template/version/checksum metadata, locale/direction, `subject`, nullable `preheader`, `bodyHtml`, `bodyText`, and content checksum.

Treat `bodyHtml` as untrusted rich content. Render it in a sandboxed/non-privileged preview and never inject it into trusted portal markup.

Create requires UUIDv7 `x-idempotency-key`. Its raw `202` response contains:

```text
outboundEmailId
activityId
sourceType, sourceId
templateDefinitionId, templateVersionId, templateVersionNumber
templateContentChecksum, compiledChecksum
resolvedLocale, direction
recipient { displayName, maskedAddress }
status = QUEUED
requestedAt
location
```

The HTTP response also sets `Location` and `Cache-Control: no-store, private`. `202` means accepted/queued, not sent.

## List and detail

Optional list filters:

| Query | Contract |
|---|---|
| `sourceType`, `sourceId` | optional only as a pair |
| `status` | `QUEUED`, `DISPATCHING`, `SENT`, `FAILED` |
| `templateVersionId`, `requestedBy` | UUID |
| `requestedFrom`, `requestedTo` | strict ISO 8601 |
| `cursor` | opaque string, maximum 512 |
| `limit` | integer `1..100`, default `25` |

When both dates are supplied, `requestedFrom < requestedTo` and the range cannot exceed 366 days. The DTO allows either bound alone. Response:

```json
{
  "items": [],
  "nextCursor": null,
  "hasNext": false,
  "limit": 25
}
```

Treat `nextCursor` as opaque and bound to filters/actor. Detail includes template snapshot, masked recipient/sender, content availability, status/revision/provider/failure/feedback, timeline timestamps, retention data, and retry linkage as applicable.

Retained body content is either `AVAILABLE` or `REDACTED_BY_RETENTION`. The UI must handle redacted content as expected policy, not data corruption.

## Retry

Path ID is UUIDv7. Body:

```json
{ "reason": "Transient provider failure was resolved" }
```

`reason` is required, nonempty, maximum 500; control characters are rejected by service policy. Retry creates a linked new email intent rather than mutating history.

Retry requires a new logical-operation UUIDv7 `x-idempotency-key`. Preserve it only for exact transport replay of that retry.

## Idempotency, asynchronous state, and security

Create and retry have both Gateway replay protection and durable domain idempotency. Gateway transport retries are disabled. On an ambiguous connection:

1. retry the exact request only with its original key;
2. never create a new key merely because the first response was lost;
3. use the returned/location ID to poll detail;
4. never infer send success from `202`.

Worker/outbox processing advances `QUEUED -> DISPATCHING -> SENT|FAILED`. A retention job can redact stored content later while preserving audit metadata.

No-store applies to options, preview, create, and retry. Keep rendered bodies, recipient/sender metadata, provider failures, keys, and template content out of logs/analytics.

## Domain errors

```text
CRM.EMAIL.SOURCE_NOT_FOUND
CRM.EMAIL.SOURCE_INELIGIBLE
CRM.EMAIL.RECIPIENT_INVALID
CRM.EMAIL.RECIPIENT_SUPPRESSED
CRM.EMAIL.SENDER_UNVERIFIED
CRM.EMAIL.TEMPLATE_NOT_SENDABLE
CRM.EMAIL.TEMPLATE_RENDER_FAILED
CRM.EMAIL.DEPENDENCY_UNAVAILABLE
CRM.EMAIL.CONTENT_LIMIT_EXCEEDED
CRM.EMAIL.IDEMPOTENCY_MISMATCH
CRM.EMAIL.RETENTION_POLICY_UNAVAILABLE
CRM.EMAIL.RETRY_ALREADY_CREATED
CRM.EMAIL.RETRY_NOT_ALLOWED
CRM.EMAIL.PLAN_QUOTA_UNSYNCHRONIZED
CRM.EMAIL.INVALID_CURSOR
```

Gateway idempotency errors are listed in the [common contract](./common-contract.md#idempotency-and-retry).

## Safe create example

```http
POST /api/tenant/crm/v1/outbound-emails
Cookie: __Host-mutakamel-tenant-access=<redacted>; __Host-mutakamel-tenant-session=<redacted>; __Host-mutakamel-tenant-csrf=<csrf-proof>
X-CSRF-Token: <csrf-proof>
x-idempotency-key: 0191e9a8-7f51-7b32-8d72-19f9217a41b3
Content-Type: application/json

{
  "sourceType": "LEAD",
  "sourceId": "0191e9a8-7f51-7b32-8d72-19f9217a41b4",
  "recipient": {
    "kind": "SOURCE_PRIMARY_CONTACT"
  }
}
```

## Sources

- `../backend/mutakamel-apps/crm-app/src/crm/outbound-emails/outbound-emails.controller.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/outbound-emails/dto/outbound-email.dto.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/outbound-emails/outbound-emails.service.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/outbound-emails/outbound-emails.service.spec.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/outbound-emails/outbound-email-lifecycle.service.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/outbound-emails/outbound-email-content-redaction.job.spec.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/crm.route-contracts.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/idempotency/gateway-idempotency.service.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/crm/outbound-emails/crm-outbound-email-api.ts`
