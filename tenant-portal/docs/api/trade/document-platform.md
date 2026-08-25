# Trade Document Profile Platform API

> Contract status: source-verified backend contract; replacement frontend not implemented
> Verification date: 2026-07-25
> Backend owner: Trade
> Documentation: source-generated from verified Gateway routes, Trade controllers/DTOs/services/tests, and dated historical frontend evidence
> Canonical browser prefix: `/api/tenant/trade/v1`
> Controller-relative prefixes: `/trade/document-profiles`, `/trade/document-profile-versions`
> Tenant Portal status: The standalone `tenant-portal` replacement is not implemented. The consolidated `mutakamel-web-app` references below are dated 2026-07-25 historical evidence; that workspace is absent from the current checkout and does not prove a live frontend.

## Capability

Governed document-profile definitions, draft versions, validation cases, and publication.

- Controller feature requirement: none declared; Trade module entitlement, seat, permission, and scope still apply.
- Gateway routes assigned to this page: **5**.
- These are browser contracts. The Trade upstream remains `/api/v1/trade/...`; the browser must use the canonical prefix above.

## Source evidence

Current backend source references below are relative to
`C:\mutakamel.ai\frontend`. Consolidated frontend paths are explicitly dated
historical references; their absent workspace is not current runtime evidence.

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/trade.route-contracts.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/document-platform/document-profile.controller.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/document-platform/dto/document-profile.dto.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/document-platform/document-profile.service.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/document-platform/document-profile-registry.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/document-platform/document-profile.service.spec.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/trade/trade-governance-api.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/trade/governance-management-section.tsx`

## Authorization and scope

Every route requires an authenticated active `TENANT_USER`, an active unexpired
`sid` with all four exact Auth epochs, a Trade/Sales module seat unless the actor
is the tenant owner, an enabled Trade entitlement, the feature gate above when
declared, the exact permission in the table, and an authorized company/branch
context. Tenant owners bypass permission-row lookup, not session, entitlement,
feature, or scope validation. Dashboard-context exceptions are called out below.

- `COMPANY`: send an authorized `X-Mutakamel-Company-Id`.
- `BRANCH`: send both company and branch UUIDv7 headers.
- `COMPANY_OR_BRANCH`: branch wins when present; otherwise company is required.
- `OPERATING_CONTEXT`: resolves branch, then company, then tenant from supplied context.
- `DASHBOARD_CONTEXT`: may begin without one company header; service authorization validates every resolved target.
- A channel header always requires company and must belong to the company; with a branch it must be assigned and active. Browser code must never forge trusted tenant/database/internal-secret headers.

## Routes

| Method | Canonical browser path | Controller-relative path | Permission | Scope target | Validated input | Required command headers | Success | Gateway contract |
|---|---|---|---|---|---|---|---|---|
| GET | `/api/tenant/trade/v1/document-profiles` | `/trade/document-profiles` | `trade.document_profiles.read` | `OPERATING_CONTEXT` | `query: DocumentProfileListQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/document-profiles` | `/trade/document-profiles` | `trade.document_profiles.manage` | `OPERATING_CONTEXT` | `body: CreateDocumentProfileDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/document-profiles/:id/versions` | `/trade/document-profiles/:id/versions` | `trade.document_profiles.manage` | `OPERATING_CONTEXT` | `body: CreateDocumentProfileVersionDto` | `X-Idempotency-Key`, `If-Match` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/document-profile-versions/:id/validate` | `/trade/document-profile-versions/:id/validate` | `trade.document_profiles.validate` | `OPERATING_CONTEXT` | — | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/document-profile-versions/:id/publish` | `/trade/document-profile-versions/:id/publish` | `trade.document_profiles.publish` | `OPERATING_CONTEXT` | `body: PublishDocumentProfileVersionDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |

`gateway-idempotent` is Gateway transport metadata. `X-Idempotency-Key` in the header column is the independent Trade domain replay contract.

## Validation and enum wire values

The global validation pipe transforms primitive query values, whitelists declared fields, rejects unknown fields, accumulates validation failures, and returns `TRADE.VALIDATION_FAILED`. Exact property decorators are in [validation-reference.md](validation-reference.md).

- Profile code uses an uppercase governed-code pattern. Document family and scope are enum validated. Version timestamps are strict ISO-8601.
- Version `content` and required cases are structurally compiled by `document-profile-registry.ts`: whitelisted fields/components/modes/evidence, bounded depth/length, and rejection of executable/remote/SQL-like content.
- Required profile fields and modes differ by document family; do not reuse one family payload for another.

- The list filter accepts the shared family enum: `QUOTATION`, `SALES_ORDER`, `PURCHASE_ORDER`, `SALES_RETURN`, `PURCHASE_RETURN`, `POS_SALE`. Profile creation is explicitly restricted to `QUOTATION`, `SALES_ORDER`, or `PURCHASE_ORDER`.
- `versionStatus` is a string capped at 24 characters, not a runtime-closed request enum. Profile scope is `TENANT`, `COMPANY`, or `BRANCH`.

## Response, errors, security, idempotency and async behavior

- Normal non-204 success: `{ success: true, data, correlationId, timestamp }`. A versioned object also sets `ETag: "<version>"`; a domain replay sets `Idempotency-Replayed`. A 204 has no body.
- A required idempotency key is a UUIDv7. Reusing it with a different canonical request returns an idempotency mismatch; an in-flight duplicate conflicts. A required `If-Match` accepts a positive quoted integer ETag unless the route explicitly documents create sentinel `"0"`.
- Common failures: 400 validation/missing precondition; 401 absent, stale or invalidated tenant session; 403 missing seat/entitlement/feature/permission; 404 missing scoped resource; 409 stale aggregate or in-flight duplicate; 422 semantic/scope/idempotency mismatch; 503 entitlement or dependency unavailable. Gateway-originated failures use Problem Details. Trade-originated validation, guard, and domain errors remain raw Nest exception bodies and are passed through unchanged by the Gateway; successes use the envelope above.
- Domain error codes observed in the owning module: `TRADE.CONCURRENCY.STALE_VERSION`, `TRADE.DOCUMENT_PROFILE.COMPATIBILITY_FAILED`, `TRADE.DOCUMENT_PROFILE.IDENTITY_TAKEN`, `TRADE.DOCUMENT_PROFILE.NOT_FOUND`, `TRADE.DOCUMENT_PROFILE.PUBLICATION_UNAVAILABLE`, `TRADE.DOCUMENT_PROFILE.PUBLISH_NOT_READY`, `TRADE.DOCUMENT_PROFILE.REQUIRED_CASES_FAILED`, `TRADE.DOCUMENT_PROFILE.SCHEMA_INVALID`, `TRADE.DOCUMENT_PROFILE.SCOPE_NOT_ALLOWED`, `TRADE.DOCUMENT_PROFILE.VALIDATION_LIMIT_EXCEEDED`.

- Every mutation/validation/publication requires idempotency. Version creation, validation, and publication also require `If-Match`.
- Publication is synchronous but activates a governed runtime snapshot; a 200 response is the contract result, not a PDF render.

## Safe example

Use the tenant portal's authenticated same-origin API client; it owns the session/cookie behavior. This read example contains only browser-authorized scope headers:

```ts
const result = await tenantTradeApi.request(
  "/api/tenant/trade/v1/document-profiles",
  {
    method: "GET",
  headers: {
    "X-Mutakamel-Company-Id": "019f98a1-1234-7abc-8def-1234567890ab"
  }
  },
);
```

Do not add `x-mutakamel-tenant-id`, `x-mutakamel-tenant-db-name`, or `x-internal-gateway-secret`. Replace illustrative UUIDv7 values with IDs from authorized Core/Trade projections.

## Ambiguities and AI rules

- The DTO accepts all `TradeDocumentFamily` values, but the current registry defines compatibility only for quotation, sales order, and purchase order. Unsupported families fail service validation.
- Never infer writable fields from response entities. Use only the DTO named in the route table.
- Never call Trade directly from the browser and never call Worker. Use the canonical Gateway path.
- See [examples.md](examples.md) for safe request patterns and [route-coverage.md](route-coverage.md) for the complete 226-route assignment.
