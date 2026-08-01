# Tenant template platform API

> **Contract status:** Current except the two production-readiness routes explicitly marked unavailable below
> **Last verified:** 2026-07-25
> **Backend owner:** Core (`core-app`)
> **Canonical browser prefix:** `/api/tenant/core/v1/templates`
> **Controller-relative prefix:** `/templates`
> **Tenant Portal status:** Planned. The legacy template designer is live and extensive under `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/template-designer`.
> **Documentation:** Hand-written and source-verified; not generated.

Business letters are a separate consumer documented in [business-letters.md](business-letters.md).

## Source of truth

- Gateway routes: `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- Controller: `../backend/mutakamel-apps/core-app/src/tenant/template-platform/template-platform.controller.ts`
- DTOs/service/errors: `../backend/mutakamel-apps/core-app/src/tenant/template-platform`
- Registry/schema: `../backend/mutakamel-apps/core-app/src/tenant/template-platform/registry`
- Legacy clients: `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/template-designer/api`

## Security and shared command protocol

Every route requires:

- tenant JWT and a verified host matching its tenant;
- current session/subscription;
- feature entitlement `core.template_designer`;
- the listed permission;
- authorized tenant/company/branch scope. Gateway classifies template scope as optional company/branch and Core re-authorizes the resource.

All IDs are UUIDv7. Core rejects unknown fields. Cursor values are opaque and query-bound. Reads return the standard Core JSON envelope; cursor pages remain inside `data`. Sensitive/draft/preview reads use `Cache-Control: no-store, private` where set by the controller.

Every command (create/update/archive/publish/asset/assignment/PDF) requires `X-Idempotency-Key` UUIDv7 through Gateway/Core. Reuse a key only for the identical payload and preconditions. Replays can include `Idempotency-Replayed: true`. The browser must not send the internal fingerprint header; Gateway creates it.

Commands that mutate an existing revision also require the exact strong ETag returned by the corresponding GET, for example `If-Match: "4"`. Asset retirement uses its namespaced asset ETag. Missing precondition returns `428 CORE.TEMPLATE.CONCURRENCY.PRECONDITION_REQUIRED`; stale/malformed returns `CORE.TEMPLATE.CONCURRENCY.STALE_REVISION`.

## Static wire values

- Document type: `QUOTATION|CRM_OUTBOUND_EMAIL`.
- Output: `PRINT|EMAIL`.
- Layout: `HYBRID_DOCUMENT|EMAIL_FLOW`.
- Direction: `AUTO|LTR|RTL`.
- Definition scope: `TENANT|COMPANY`; assignment/runtime scope: `TENANT|COMPANY|BRANCH`.
- Locale: `ar-EG|en-US`.
- Adapter: `TRADE_QUOTATION_PRINT_V1`, `CRM_LEAD_OUTBOUND_EMAIL_V1`, `CRM_CUSTOMER_OUTBOUND_EMAIL_V1`, `CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1`.
- Definition lifecycle: `ACTIVE|ARCHIVED`; version lifecycle: `PUBLISHED|RETIRED`; assignment: `ACTIVE|INACTIVE`.
- Asset type: `IMAGE|LOGO|BACKGROUND`; delivery: `PRIVATE_ONLY|EMAIL_PUBLIC`; asset lifecycle: `ACTIVE|RETIRED`.

These catalogues are closed and case-sensitive in the current API.

## Discovery and definitions

| Method and canonical browser path | Permission | Contract |
|---|---|---|
| `GET /api/tenant/core/v1/templates` | `templates.read` | Query/cursor template list |
| `POST /api/tenant/core/v1/templates/search` | `templates.read` | Same read model via body; `200`, read-like |
| `GET /api/tenant/core/v1/templates/starters` | `templates.create` | Required tuple query; no-store |
| `GET /api/tenant/core/v1/templates/creation-scopes` | `templates.read` **and** `templates.create` | Authorized scopes; no-store |
| `POST /api/tenant/core/v1/templates` | `templates.create` | Create |
| `GET /api/tenant/core/v1/templates/:templateId` | `templates.read` | Detail + ETag |
| `PATCH /api/tenant/core/v1/templates/:templateId` | `templates.update` | ETag + idempotency |
| `POST /api/tenant/core/v1/templates/:templateId/duplicate` | `templates.create` | Idempotency |
| `POST /api/tenant/core/v1/templates/:templateId/archive` | `templates.archive` | Empty body, ETag + idempotency |
| `POST /api/tenant/core/v1/templates/:templateId/restore` | `templates.archive` | Empty body, ETag + idempotency |
| `DELETE /api/tenant/core/v1/templates/:templateId` | `templates.archive` | `204`, ETag + idempotency |

Create fields:

- `code`: uppercased, 1–100, `^[A-Z0-9][A-Z0-9_-]{0,99}$`.
- `name`: non-empty, maximum 200; optional `description` maximum 1,000.
- required document/output/layout/adapter/locale/direction enums above.
- `scope`: `{type:"TENANT"}` or `{type:"COMPANY",companyId:UUIDv7}`.
- optional `starterKey`: 1–120, `^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$`.
- optional page: preset `A4|A5|LETTER|CUSTOM`, orientation `PORTRAIT|LANDSCAPE`, custom width 50–500 and height 50–1,000, margins `top|end|bottom|start` each 0–100.

Safe create example:

```http
POST /api/tenant/core/v1/templates
Authorization: Bearer <tenant-access-token>
Content-Type: application/json
X-Idempotency-Key: 019f9871-fd40-7680-bfbb-fd535b5880c8

{
  "code":"QUOTE_STANDARD",
  "name":"Standard quotation",
  "documentType":"QUOTATION",
  "outputChannel":"PRINT",
  "layoutMode":"HYBRID_DOCUMENT",
  "dataSourceKey":"TRADE_QUOTATION_PRINT_V1",
  "locale":"en-US",
  "direction":"LTR",
  "scope":{"type":"TENANT"}
}
```

Update accepts `name`, nullable `description`, `direction`, and—when direction changes—the required positive `expectedDraftRevision`.

Duplicate requires a source discriminator: `{kind:"CURRENT_DRAFT",expectedDraftRevision}` or `{kind:"VERSION",versionId}`, plus new `code`, `name`, optional description/locale/direction, scope, and literal `copyAssignments:false`.

List/search supports assignment scope tuple, search/code/type/output/layout/lifecycle/locale, definition scope, date range, created-by UUIDv7, strict `hasPublishedVersion`, whitelisted sorting, opaque cursor max 2,048, and limit 1–100. Use the DTO source for conditional tuple rules; never submit branch without company.

## Draft, validation, versions, and preview

| Method/path | Permission | Precondition/behavior |
|---|---|---|
| `GET /api/tenant/core/v1/templates/:templateId/draft` | `templates.read` + `templates.update` | ETag, no-store |
| `PATCH /api/tenant/core/v1/templates/:templateId/draft` | `templates.update` | ETag + idempotency |
| `GET /api/tenant/core/v1/templates/:templateId/draft/recovery-snapshots` | `templates.read` + `templates.update` | Cursor |
| `POST /api/tenant/core/v1/templates/:templateId/draft/recovery-snapshots/:snapshotId/restore` | `templates.restore` + `templates.update` | ETag + idempotency |
| `POST /api/tenant/core/v1/templates/:templateId/validate` | `templates.update` | ETag + idempotency, `200` |
| `GET /api/tenant/core/v1/templates/:templateId/validation-runs/:validationRunId` | `templates.update` | Read validation |
| `POST /api/tenant/core/v1/templates/:templateId/publish` | `templates.publish` | ETag + idempotency |
| `GET /api/tenant/core/v1/templates/:templateId/versions` | `templates.read` | Cursor/filter |
| `GET /api/tenant/core/v1/templates/:templateId/versions/:versionId` | `templates.read` | Immutable version |
| `POST /api/tenant/core/v1/templates/:templateId/versions/:versionId/restore` | `templates.restore` + `templates.update` | ETag + idempotency |
| `POST /api/tenant/core/v1/templates/:templateId/versions/:versionId/retire` | `templates.publish` | Empty body, ETag + idempotency |
| `POST /api/tenant/core/v1/templates/:templateId/preview/html` | `templates.preview` | Read-like, no-store |
| `POST /api/tenant/core/v1/templates/:templateId/preview/email` | `templates.preview` | Read-like, no-store |
| `POST /api/tenant/core/v1/templates/:templateId/preview/pdf` | `templates.preview` | Idempotent async job |
| `GET /api/tenant/core/v1/templates/preview-jobs/:jobId` | `templates.preview` | Poll, no-store |

Key DTOs:

- Draft save: `document` object, `clientMutationId` UUIDv7, optional `changeSummary` max 300.
- Validate: positive `draftRevision`, exactly two unique requested formats from `HTML|PDF|EMAIL_HTML|EMAIL_TEXT`, optional fixture key max 100.
- Publish: positive `definitionRevision` and `draftRevision`, validation-run UUIDv7, optional change note max 500, literal `setAsDefinitionPublished:true`.
- Restore version: non-empty `reason` max 500 and `discardCurrentDraft` boolean.
- Restore snapshot: 64-char lowercase SHA-256, reason 1–500, literal `discardCurrentDraft:true`.
- Preview: source `{kind:"DRAFT",draftRevision}` or `{kind:"VERSION",versionId}`, fixture key 1–100, locale, timezone 1–64, optional three-uppercase-letter currency, optional viewport `DESKTOP|MOBILE`.

PDF preview is asynchronous; poll its returned job. HTML/email preview returns untrusted rendered output: use a sandboxed preview surface and never inject it into the portal document.

## Data sources and assets

| Method/path | Permission | Contract |
|---|---|---|
| `GET /api/tenant/core/v1/templates/data-sources` | `templates.read` | Authorized adapters for scope tuple |
| `GET /api/tenant/core/v1/templates/data-sources/:adapterKey/schema` | `templates.read` | `schemaVersion=1` plus scope tuple |
| `GET /api/tenant/core/v1/templates/assets` | `templates.read` | Cursor/filter list |
| `POST /api/tenant/core/v1/templates/assets` | `templates.assets.manage` | Strict multipart upload |
| `GET /api/tenant/core/v1/templates/assets/:assetId` | `templates.read` | ETag, private/no-store |
| `DELETE /api/tenant/core/v1/templates/assets/:assetId` | `templates.assets.manage` | `204`, namespaced ETag + idempotency |

Asset upload contains exactly two parts: one `file` and one string `metadata`. File limit is 5 MiB; accepted declared metadata MIME is `image/png|image/jpeg`. Metadata JSON is maximum 16,384 UTF-8 bytes and allows only:

`definitionId?`, `assetType`, `deliveryClass`, `fileName` (1–255), `declaredMimeType`, `expectedRawSha256` (64 lowercase hex), and `confirmPublicEmailDelivery?`.

`EMAIL_PUBLIC` requires literal `confirmPublicEmailDelivery:true`; it must not be sent for `PRIVATE_ONLY`. Content is verified server-side. Expected upload errors include `CORE.TEMPLATE.ASSET.UPLOAD_INVALID` and `CORE.TEMPLATE.ASSET.EMAIL_PUBLIC_NOT_ALLOWED`.

## Assignments

| Method/path | Permission | Contract |
|---|---|---|
| `GET /api/tenant/core/v1/templates/assignments` | `templates.read` | Cursor/filter |
| `POST /api/tenant/core/v1/templates/assignments` | `templates.assignments.manage` | Idempotency |
| `POST /api/tenant/core/v1/templates/assignments/resolve` | `templates.read` | Read-like, no-store |
| `GET /api/tenant/core/v1/templates/assignments/:assignmentId` | `templates.read` | ETag |
| `PATCH /api/tenant/core/v1/templates/assignments/:assignmentId` | `templates.assignments.manage` | ETag + idempotency |
| `DELETE /api/tenant/core/v1/templates/assignments/:assignmentId` | `templates.assignments.manage` | `204`, ETag + idempotency; deactivates |

Create requires version UUIDv7, adapter/document/output tuple, nullable locale max 35, assignment scope, integer priority 0–1,000, `isDefault`, ISO `effectiveFrom`, and optional nullable ISO `effectiveTo`. When both exist, `effectiveTo` must be later than `effectiveFrom`. Update accepts version, priority, default, dates, and `status=ACTIVE|INACTIVE`.

Resolution requires document/output/adapter/locale/scope and optional ISO `businessTime`. Resolution is server-authoritative; do not reproduce priority/scope fallback logic in the client.

### Verified unavailable routes

Gateway currently declares:

- `GET /api/tenant/core/v1/templates/assignments/production-readiness`
- `POST /api/tenant/core/v1/templates/assignments/production-readiness/remediate`

No matching Core controller handlers exist as of the verification date. These routes are **unavailable/stale contract declarations** and Tenant Portal must not call them until Gateway and Core are reconciled and tested.

## Errors and AI rules

Important errors include `CORE.TEMPLATE.NOT_FOUND`, `CORE.TEMPLATE.PERMISSION.DENIED`, `CORE.TEMPLATE.SCHEMA.INVALID`, `CORE.TEMPLATE.CURSOR.INVALID`, concurrency errors, tuple/scope/entitlement failures, draft/validation/publish conflicts, asset errors, assignment overlap/compatibility errors, idempotency mismatch/in-progress errors, recovery snapshot expiry, and preview dependency failures.

- Use server creation scopes, starters, data sources, and schemas; do not hard-code capabilities beyond wire parsing.
- Keep ETag, draft revision, client mutation ID, and idempotency key as distinct values.
- Never replay a key with a changed `If-Match` or body.
- Treat cursors, document JSON, rendered HTML, asset URLs, and job error details as untrusted/opaque.
