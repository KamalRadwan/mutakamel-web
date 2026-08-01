# Trade Extension Profiles API

> Contract status: source-verified backend contract; replacement frontend not implemented
> Verification date: 2026-07-25
> Backend owner: Trade
> Documentation: source-generated from verified Gateway routes, Trade controllers/DTOs/services/tests, and legacy frontend evidence
> Canonical browser prefix: `/api/tenant/trade/v1`
> Controller-relative prefixes: `/trade/extensions/targets`, `/trade/extensions/profiles`
> Tenant Portal status: `tenant-portal` replaces the legacy tenant Trade UI; Legacy `mutakamel-web-app` has live extension profile clients/editor. The replacement `tenant-portal` is not implemented.

## Capability

Extension target registry reads plus governed profile definitions, versions, validation, and publication.

- Controller feature requirement: all of `trade.automation` and any of `trade.catalog`, `trade.sales`, `trade.purchasing`, or `trade.inventory`.
- Gateway routes assigned to this page: **9**.
- These are browser contracts. The Trade upstream remains `/api/v1/trade/...`; the browser must use the canonical prefix above.

## Source evidence

Backend source references below are relative to `C:\mutakamel.ai\frontend`.

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/trade.route-contracts.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/extensions-automation.controller.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/extension-profiles.service.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/extension-profile-queries.service.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/extensions-registry.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/extension-profile.controller.spec.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/trade/trade-automation-api.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/trade/extension-automation-panel.tsx`

## Authorization and scope

Every route requires an authenticated active `TENANT_USER`, a current session version, a Trade/Sales module seat unless the actor is the tenant owner, an enabled Trade entitlement, the feature gate above when declared, the exact permission in the table, and an authorized company/branch context. Tenant owners bypass permission-row lookup, not session, entitlement, feature, or scope validation. Dashboard-context exceptions are called out below.

- `COMPANY`: send an authorized `X-Mutakamel-Company-Id`.
- `BRANCH`: send both company and branch UUIDv7 headers.
- `COMPANY_OR_BRANCH`: branch wins when present; otherwise company is required.
- `OPERATING_CONTEXT`: resolves branch, then company, then tenant from supplied context.
- `DASHBOARD_CONTEXT`: may begin without one company header; service authorization validates every resolved target.
- A channel header always requires company and must belong to the company; with a branch it must be assigned and active. Browser code must never forge trusted tenant/database/internal-secret headers.

## Routes

| Method | Canonical browser path | Controller-relative path | Permission | Scope target | Validated input | Required command headers | Success | Gateway contract |
|---|---|---|---|---|---|---|---|---|
| GET | `/api/tenant/trade/v1/extensions/targets` | `/trade/extensions/targets` | `trade.extensions.read` | `OPERATING_CONTEXT` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/extensions/profiles` | `/trade/extensions/profiles` | `trade.extensions.read` | `OPERATING_CONTEXT` | `query: ExtensionProfileListQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/extensions/profiles/:id/versions/:versionId` | `/trade/extensions/profiles/:id/versions/:versionId` | `trade.extensions.read` | `OPERATING_CONTEXT` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/extensions/profiles/:id/versions` | `/trade/extensions/profiles/:id/versions` | `trade.extensions.read` | `OPERATING_CONTEXT` | `query: ExtensionProfileVersionListQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/extensions/profiles/:id` | `/trade/extensions/profiles/:id` | `trade.extensions.read` | `OPERATING_CONTEXT` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/extensions/profiles` | `/trade/extensions/profiles` | `trade.extensions.manage` | `OPERATING_CONTEXT` | `body: CreateExtensionProfileDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| PATCH | `/api/tenant/trade/v1/extensions/profiles/:id` | `/trade/extensions/profiles/:id` | `trade.extensions.manage` | `OPERATING_CONTEXT` | `body: UpdateExtensionProfileDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/extensions/profiles/:id/validate` | `/trade/extensions/profiles/:id/validate` | `trade.extensions.manage` | `OPERATING_CONTEXT` | — | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/extensions/profiles/:id/publish` | `/trade/extensions/profiles/:id/publish` | `trade.extensions.publish` | `OPERATING_CONTEXT` | — | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |

`gateway-idempotent` is Gateway transport metadata. `X-Idempotency-Key` in the header column is the independent Trade domain replay contract.

## Validation and enum wire values

The global validation pipe transforms primitive query values, whitelists declared fields, rejects unknown fields, accumulates validation failures, and returns `TRADE.VALIDATION_FAILED`. Exact property decorators are in [validation-reference.md](validation-reference.md).

- Target/profile/version IDs use UUIDv7. Field keys, counts, schema kinds, defaults, constraints, and executable-content checks are enforced by the DTO plus extension registry.
- Profile status filters and target codes use closed `IsIn` sets shown below. Profile version detail reads are explicit routed endpoints.

- Target: `CATALOG_ITEM`, `QUOTATION`, `SALES_ORDER`, `PURCHASE_ORDER`. Profile scope: `TENANT`, `COMPANY`.
- Field value kind: `SCALAR`, `OBJECT`, `COLLECTION`; data type: `STRING`, `BOOLEAN`, `DECIMAL`, `DATE`, `UUID`, `ENUM`; visibility: `INTERNAL`, `USER`, `EXTERNAL_SAFE`.
- Profile status: `DRAFT`, `ACTIVE`, `RETIRED`; version status: `DRAFT`, `TESTED`, `PUBLISHED`, `SUPERSEDED`, `RETIRED`.

## Response, errors, security, idempotency and async behavior

- Normal non-204 success: `{ success: true, data, correlationId, timestamp }`. A versioned object also sets `ETag: "<version>"`; a domain replay sets `Idempotency-Replayed`. A 204 has no body.
- A required idempotency key is a UUIDv7. Reusing it with a different canonical request returns an idempotency mismatch; an in-flight duplicate conflicts. A required `If-Match` accepts a positive quoted integer ETag unless the route explicitly documents create sentinel `"0"`.
- Common failures: 400 validation/missing precondition; 401 absent, stale or invalidated tenant session; 403 missing seat/entitlement/feature/permission; 404 missing scoped resource; 409 stale aggregate or in-flight duplicate; 422 semantic/scope/idempotency mismatch; 503 entitlement or dependency unavailable. Gateway-originated failures use Problem Details. Trade-originated validation, guard, and domain errors remain raw Nest exception bodies and are passed through unchanged by the Gateway; successes use the envelope above.
- Domain error codes observed in the owning module: `TRADE.APPROVAL.MAKER_CHECKER_REQUIRED`, `TRADE.AUTH.TARGET_DENIED`, `TRADE.CONCURRENCY.STALE_VERSION`, `TRADE.DEPENDENCY.TIMEOUT`, `TRADE.EXTENSION.DEFINITION_INVALID`, `TRADE.EXTENSION.PROFILE_INCOMPATIBLE`, `TRADE.EXTENSION.RESERVED_FIELD`, `TRADE.EXTENSION.VALUE_INVALID`, `TRADE.IDEMPOTENCY.KEY_REQUIRED`, `TRADE.IDEMPOTENCY.MISMATCH`, `TRADE.IMPORT.FILE_UNSAFE`, `TRADE.IMPORT.MAPPING_INVALID`, `TRADE.IMPORT.SCOPE_MISMATCH`, `TRADE.WEBHOOK.DELIVERY_NOT_RETRYABLE`, `TRADE.WEBHOOK.ENDPOINT_FORBIDDEN`, `TRADE.WEBHOOK.PAYLOAD_FORBIDDEN`, `TRADE.WEBHOOK.SECRET_VERSION_INVALID`.

- Create/patch/validate/publish require domain idempotency; patch/validate/publish also require `If-Match`. Reads are synchronous.
- Extension values are server-validated and size bounded; never render stored extension strings as HTML or executable content.

## Safe example

Use the tenant portal's authenticated same-origin API client; it owns the session/cookie behavior. This read example contains only browser-authorized scope headers:

```ts
const result = await tenantTradeApi.request(
  "/api/tenant/trade/v1/extensions/targets",
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

- `GET /extensions/targets` is the current target registry. Static target values in this document are verified today but clients should tolerate registry growth.
- Never infer writable fields from response entities. Use only the DTO named in the route table.
- Never call Trade directly from the browser and never call Worker. Use the canonical Gateway path.
- See [examples.md](examples.md) for safe request patterns and [route-coverage.md](route-coverage.md) for the complete 226-route assignment.
