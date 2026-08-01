# Tenant business letters API

> **Contract status:** Partial: create/detail/update/issue/render routes are current; list is implemented in Core but missing from Gateway
> **Last verified:** 2026-07-25
> **Backend owner:** Core template platform
> **Canonical browser prefix:** `/api/tenant/core/v1/business-letters`
> **Controller-relative prefix:** `/business-letters`
> **Tenant Portal status:** Planned; no confirmed legacy business-letter client.
> **Documentation:** Hand-written and source-verified; not generated.

## Source of truth

- Gateway routes: `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- Controller/DTO/service: `../backend/mutakamel-apps/core-app/src/tenant/template-platform/business-letter`
- Closed source schema: `../backend/mutakamel-apps/core-app/src/tenant/template-platform/registry/core-business-letter-print-v1.schema.ts`
- Template runtime: `../backend/mutakamel-apps/core-app/src/tenant/template-platform`

## Security and routing status

All routes require tenant JWT, matching verified host, current session/subscription, feature `core.template_designer`, listed permission, and **branch-required** organization scope. `companyId` and `branchId` must be related, active, and authorized. Gateway/Core derive and validate trusted scope; the browser must not manufacture scope headers.

| Method and canonical browser path | Permission | Status |
|---|---|---|
| `POST /api/tenant/core/v1/business-letters` | `business_letters.create` | Current |
| `GET /api/tenant/core/v1/business-letters` | `business_letters.read` | **Unavailable through Gateway** |
| `GET /api/tenant/core/v1/business-letters/:letterId` | `business_letters.read` | Current; ETag/no-store |
| `PATCH /api/tenant/core/v1/business-letters/:letterId` | `business_letters.update` | Current |
| `POST /api/tenant/core/v1/business-letters/:letterId/issue` | `business_letters.issue` | Current |
| `POST /api/tenant/core/v1/business-letters/:letterId/render-pdf` | `business_letters.render` | Current; `202` |
| `GET /api/tenant/core/v1/business-letters/:letterId/render-jobs/:renderJobId` | `business_letters.read` | Current; poll/no-store |

The Core controller implements GET collection, but the typed Gateway contract has no GET collection route. Tenant Portal must not ship a list screen against this route until Gateway exposure is added and verified. Calling a controller path directly from the browser is not an acceptable workaround.

## Content and validation

Create requires `companyId` and `branchId` UUIDv7 plus:

| Field | Validation |
|---|---|
| `number` | optional string, max 100 |
| `reference` | optional string, max 160 |
| `issueDate` | required strict date string |
| `replyByDate` | optional strict date string |
| `subject` | string, max 1,000 |
| `body` | string, max 100,000 |
| `confidentiality` | optional string, max 100 |
| `recipient` | object validated again by the closed V1 source schema |
| `paragraphs` | array, max 500, closed-schema rows |
| `signatories` | array, max 20, closed-schema rows |
| `ccRecipients` | array, max 100, closed-schema rows |

Do not invent nested recipient/paragraph/signatory fields. Build them only from the registry schema or a server-provided form contract; Core rejects content that does not satisfy its closed V1 schema.

Safe detail-read example:

```http
GET /api/tenant/core/v1/business-letters/019f9872-0a1a-7cc0-914d-a57aa437fc41
Authorization: Bearer <tenant-access-token>
```

No create-body example is provided because inventing the closed nested V1 fields would be unsafe. Generate a create payload only from the referenced registry schema or a future server-provided form contract.

Draft replacement sends the complete content again plus positive integer `expectedSourceVersion`. Issue accepts only `{expectedSourceVersion}`. There is no partial patch and no delete route.

The Core list DTO (currently Gateway-blocked) requires `companyId` and `branchId`, optional `status=DRAFT|ISSUED`, search max 100, and limit 1–100.

## Versioning, idempotency, and issue semantics

Every command requires a UUIDv7 `X-Idempotency-Key`. Reuse it only for an identical command; a replay may return `Idempotency-Replayed: true`.

Detail returns an ETag like `"business-letter:<id>:v<sourceVersion>"`, but draft update/issue concurrency is carried in `expectedSourceVersion` rather than `If-Match`. If the draft changed or is already issued, Core returns `CORE.BUSINESS_LETTER.SOURCE_STALE`.

Issuing creates an immutable source snapshot/checksum. Later PDF jobs render a specific issued `sourceVersion`; editing is no longer allowed.

## PDF rendering

Render body:

- `sourceVersion`: positive integer.
- optional `templateVersionId`: UUIDv7.
- optional `locale`: valid language tag, maximum 35.
- optional `timeZone`: `UTC` or supported IANA-style form, maximum 64; Core verifies it with `Intl`.
- `purpose`: literal `BUSINESS_LETTER`.

`202` returns a job projection with IDs, source checksum/version, status, attempts, template version, requested/retry times, safe failure code, and status URL. Use the returned job/status URL as opaque and poll with backoff. The Worker result is accepted only when its evidence matches the immutable request.

PDF rendering is asynchronous. Draft create/replace/issue are synchronous from the client contract.

## Envelopes, cache, errors, and AI rules

Core rejects unknown fields. JSON uses standard Core envelopes. Detail/list/job reads are private/no-store. Commands use the template domain replay contract.

Expected errors include `CORE.BUSINESS_LETTER.NOT_FOUND`, `CORE.BUSINESS_LETTER.SOURCE_STALE`, `CORE.BUSINESS_LETTER.TEMPLATE_INCOMPATIBLE`, `CORE.BUSINESS_LETTER.PDF.BUNDLE_UNAVAILABLE`, PDF input-expired/render-failed/result-conflict, template idempotency mismatch, feature/permission denial, and organization-scope failures.

- Do not bypass the missing Gateway list contract.
- Keep source version/checksum immutable in render polling state.
- Never display a generated PDF as final until Core reports successful evidence.
- Treat recipient/body/rendered output as sensitive tenant content and never send it to analytics or an external AI service without explicit product authorization.
