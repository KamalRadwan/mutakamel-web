# Trade Policy Studio API

> Contract status: source-verified backend contract; replacement frontend not implemented
> Verification date: 2026-07-25
> Backend owner: Trade
> Documentation: source-generated from verified Gateway routes, Trade controllers/DTOs/services/tests, and dated historical frontend evidence
> Canonical browser prefix: `/api/tenant/trade/v1`
> Controller-relative prefixes: `/trade/policies`, `/trade/policy-versions`, `/trade/decisions`
> Tenant Portal status: The standalone `tenant-portal` replacement is not implemented. The consolidated `mutakamel-web-app` references below are dated 2026-07-25 historical evidence; that workspace is absent from the current checkout and does not prove a live frontend.

## Capability

Policy definition/version lifecycle and decision trace reads.

- Controller feature requirement: none declared; Trade module entitlement, seat, permission, and scope still apply.
- Gateway routes assigned to this page: **13**.
- These are browser contracts. The Trade upstream remains `/api/v1/trade/...`; the browser must use the canonical prefix above.

## Source evidence

Current backend source references below are relative to
`C:\mutakamel.ai\frontend`. Consolidated frontend paths are explicitly dated
historical references; their absent workspace is not current runtime evidence.

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/trade.route-contracts.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/policy-studio/policy-studio.controller.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/policy-studio/dto/policy-studio.dto.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/policy-studio/policy-studio.service.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/policy-studio/policy-registry.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/policy-studio/policy-runtime.service.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/policy-studio/policy-studio.service.spec.ts`
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
| GET | `/api/tenant/trade/v1/policies` | `/trade/policies` | `trade.policy.read` | `OPERATING_CONTEXT` | `query: GovernanceListQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/policies` | `/trade/policies` | `trade.policy.manage` | `OPERATING_CONTEXT` | `body: CreatePolicyDefinitionDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/policies/:id/versions` | `/trade/policies/:id/versions` | `trade.policy.manage` | `OPERATING_CONTEXT` | `body: CreateGovernedVersionDto` | `X-Idempotency-Key`, `If-Match` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| PATCH | `/api/tenant/trade/v1/policy-versions/:id` | `/trade/policy-versions/:id` | `trade.policy.manage` | `OPERATING_CONTEXT` | `body: UpdateGovernedVersionDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/policy-versions/:id/validate` | `/trade/policy-versions/:id/validate` | `trade.policy.test` | `OPERATING_CONTEXT` | `body: GovernanceActionDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/policy-versions/:id/test` | `/trade/policy-versions/:id/test` | `trade.policy.test` | `OPERATING_CONTEXT` | `body: GovernanceActionDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/policy-versions/:id/submit` | `/trade/policy-versions/:id/submit` | `trade.policy.manage` | `OPERATING_CONTEXT` | `body: GovernanceActionDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/policy-versions/:id/approve` | `/trade/policy-versions/:id/approve` | `trade.policy.approve` | `OPERATING_CONTEXT` | `body: GovernanceActionDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/policy-versions/:id/reject` | `/trade/policy-versions/:id/reject` | `trade.policy.approve` | `OPERATING_CONTEXT` | `body: GovernanceActionDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/policy-versions/:id/publish` | `/trade/policy-versions/:id/publish` | `trade.policy.publish` | `OPERATING_CONTEXT` | `body: GovernanceActionDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/policy-versions/:id/retire` | `/trade/policy-versions/:id/retire` | `trade.policy.publish` | `OPERATING_CONTEXT` | `body: GovernanceActionDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/policy-versions/:id/rollback` | `/trade/policy-versions/:id/rollback` | `trade.policy.publish` | `OPERATING_CONTEXT` | `body: GovernanceActionDto` | `X-Idempotency-Key`, `If-Match` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/decisions/:id` | `/trade/decisions/:id` | `trade.policy.read` | `OPERATING_CONTEXT` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |

`gateway-idempotent` is Gateway transport metadata. `X-Idempotency-Key` in the header column is the independent Trade domain replay contract.

## Validation and enum wire values

The global validation pipe transforms primitive query values, whitelists declared fields, rejects unknown fields, accumulates validation failures, and returns `TRADE.VALIDATION_FAILED`. Exact property decorators are in [validation-reference.md](validation-reference.md).

- Definition codes use uppercase governed-code patterns. Kinds are closed by DTO `IsIn`. Scope is enum validated.
- Version content and synthetic tests are objects/arrays at transport level; registry compilation and lifecycle service enforce kind-specific schemas, deterministic tests, limits, and safe content.
- All effective timestamps are strict ISO-8601; service enforces interval and lifecycle compatibility.

- Policy kind: `CREDIT`, `PRICING_GUARD`, `ORDER_CONFIRMATION`, `PURCHASE_APPROVAL`, `INVENTORY_NEGATIVE`, `INVENTORY_RESERVATION`, `INVENTORY_OVER_RECEIPT`.
- Version lifecycle: `DRAFT`, `TESTED`, `APPROVAL_PENDING`, `SCHEDULED`, `PUBLISHED`, `SUPERSEDED`, `RETIRED`.
- Decision type/output kinds are listed in `static-data.md`.

## Response, errors, security, idempotency and async behavior

- Normal non-204 success: `{ success: true, data, correlationId, timestamp }`. A versioned object also sets `ETag: "<version>"`; a domain replay sets `Idempotency-Replayed`. A 204 has no body.
- A required idempotency key is a UUIDv7. Reusing it with a different canonical request returns an idempotency mismatch; an in-flight duplicate conflicts. A required `If-Match` accepts a positive quoted integer ETag unless the route explicitly documents create sentinel `"0"`.
- Common failures: 400 validation/missing precondition; 401 absent, stale or invalidated tenant session; 403 missing seat/entitlement/feature/permission; 404 missing scoped resource; 409 stale aggregate or in-flight duplicate; 422 semantic/scope/idempotency mismatch; 503 entitlement or dependency unavailable. Gateway-originated failures use Problem Details. Trade-originated validation, guard, and domain errors remain raw Nest exception bodies and are passed through unchanged by the Gateway; successes use the envelope above.
- Domain error codes observed in the owning module: `TRADE.APPROVAL.MAKER_CHECKER_REQUIRED`, `TRADE.AUTH.TARGET_DENIED`, `TRADE.CONCURRENCY.STALE_VERSION`, `TRADE.POLICY.CODE_TAKEN`, `TRADE.POLICY.DECISION_UNAVAILABLE`, `TRADE.POLICY.DEFINITION_INVALID`, `TRADE.POLICY.DEFINITION_NOT_FOUND`, `TRADE.POLICY.EFFECTIVE_OVERLAP`, `TRADE.POLICY.EXPRESSION_INVALID`, `TRADE.POLICY.OUTPUT_INVALID`, `TRADE.POLICY.PUBLISH_NOT_ALLOWED`, `TRADE.POLICY.TEST_FAILED`, `TRADE.WORKFLOW.DEFINITION_INVALID`.

- Every lifecycle command requires UUIDv7 idempotency and `If-Match`. Rollback creates a new version and returns 201.
- Validate/test use `trade.policy.test`; approve/reject use `trade.policy.approve`; publish/retire/rollback use `trade.policy.publish`.
- Decision reads use the operating context and redact sensitive facts unless separately authorized by the service.

## Safe example

Use the tenant portal's authenticated same-origin API client; it owns the session/cookie behavior. This read example contains only browser-authorized scope headers:

```ts
const result = await tenantTradeApi.request(
  "/api/tenant/trade/v1/decisions/019f98a0-1234-7abc-8def-1234567890ab",
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

- The list `status` filter accepts only `ACTIVE` or `INACTIVE`, while governed version status is a different enum. Do not mix them.
- Never infer writable fields from response entities. Use only the DTO named in the route table.
- Never call Trade directly from the browser and never call Worker. Use the canonical Gateway path.
- See [examples.md](examples.md) for safe request patterns and [route-coverage.md](route-coverage.md) for the complete 226-route assignment.
