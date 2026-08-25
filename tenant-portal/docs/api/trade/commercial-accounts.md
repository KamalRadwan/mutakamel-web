# Trade Commercial Accounts and Credit API

> Contract status: source-verified backend contract; replacement frontend not implemented
> Verification date: 2026-07-25
> Backend owner: Trade
> Documentation: source-generated from verified Gateway routes, Trade controllers/DTOs/services/tests, and dated historical frontend evidence
> Canonical browser prefix: `/api/tenant/trade/v1`
> Controller-relative prefixes: `/trade/commercial-accounts`
> Tenant Portal status: The standalone `tenant-portal` replacement is not implemented. The consolidated `mutakamel-web-app` references below are dated 2026-07-25 historical evidence; that workspace is absent from the current checkout and does not prove a live frontend.

## Capability

Customer/supplier account projections, branch narrowing rules, credit evaluation, and account block transitions.

- Controller feature requirement: none declared; Trade module entitlement, seat, permission, and scope still apply.
- Gateway routes assigned to this page: **10**.
- These are browser contracts. The Trade upstream remains `/api/v1/trade/...`; the browser must use the canonical prefix above.

## Source evidence

Current backend source references below are relative to
`C:\mutakamel.ai\frontend`. Consolidated frontend paths are explicitly dated
historical references; their absent workspace is not current runtime evidence.

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/trade.route-contracts.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/commercial-accounts/commercial-accounts.controller.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/commercial-accounts/commercial-account-lookups.controller.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/commercial-accounts/dto/commercial-account.dto.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/commercial-accounts/commercial-accounts.service.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/commercial-accounts/credit-exposure-projection.service.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/commercial-accounts/commercial-accounts.service.spec.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/trade/trade-management-api.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/trade/commercial-accounts-management-section.tsx`

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
| GET | `/api/tenant/trade/v1/commercial-accounts` | `/trade/commercial-accounts` | `trade.commercial_accounts.read` | `COMPANY_OR_BRANCH` | `query: CommercialAccountListQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/commercial-accounts` | `/trade/commercial-accounts` | `trade.commercial_accounts.manage` | `COMPANY` | `body: CreateCommercialAccountDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/commercial-accounts/lookups` | `/trade/commercial-accounts/lookups` | `trade.commercial_accounts.read` | `COMPANY_OR_BRANCH` | `query: CommercialAccountLookupQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/commercial-accounts/:id` | `/trade/commercial-accounts/:id` | `trade.commercial_accounts.read` | `COMPANY_OR_BRANCH` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| PATCH | `/api/tenant/trade/v1/commercial-accounts/:id` | `/trade/commercial-accounts/:id` | `trade.commercial_accounts.manage` | `COMPANY` | `body: UpdateCommercialAccountDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/commercial-accounts/:id/branch-rules` | `/trade/commercial-accounts/:id/branch-rules` | `trade.commercial_accounts.manage` | `BRANCH` | `body: CreateAccountBranchRuleDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| PATCH | `/api/tenant/trade/v1/commercial-accounts/:id/branch-rules/:branchId` | `/trade/commercial-accounts/:id/branch-rules/:branchId` | `trade.commercial_accounts.manage` | `BRANCH` | `body: UpdateAccountBranchRuleDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/commercial-accounts/:id/evaluate-credit` | `/trade/commercial-accounts/:id/evaluate-credit` | `trade.credit.view` | `COMPANY_OR_BRANCH` | `body: CreditEvaluationDto` | `X-Idempotency-Key` | 200 | `READ_HEAVY`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/commercial-accounts/:id/block` | `/trade/commercial-accounts/:id/block` | `trade.commercial_accounts.manage` | `COMPANY` | `body: AccountTransitionDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/commercial-accounts/:id/unblock` | `/trade/commercial-accounts/:id/unblock` | `trade.commercial_accounts.manage` | `COMPANY` | `body: AccountTransitionDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |

`gateway-idempotent` is Gateway transport metadata. `X-Idempotency-Key` in the header column is the independent Trade domain replay contract.

## Validation and enum wire values

The global validation pipe transforms primitive query values, whitelists declared fields, rejects unknown fields, accumulates validation failures, and returns `TRADE.VALIDATION_FAILED`. Exact property decorators are in [validation-reference.md](validation-reference.md).

- Account roles are enum-validated. Party and policy references use UUIDv7. Currency is exactly three uppercase letters.
- Credit amounts are decimal strings with up to 16 integer digits and 8 fractional digits; never send JSON numbers for monetary amounts.
- Branch `status` is typed as `ACTIVE | RETIRED` but validated only as a string; service rules remain authoritative.

- `CommercialAccountRole`: `CUSTOMER`, `SUPPLIER`.

## Response, errors, security, idempotency and async behavior

- Normal non-204 success: `{ success: true, data, correlationId, timestamp }`. A versioned object also sets `ETag: "<version>"`; a domain replay sets `Idempotency-Replayed`. A 204 has no body.
- A required idempotency key is a UUIDv7. Reusing it with a different canonical request returns an idempotency mismatch; an in-flight duplicate conflicts. A required `If-Match` accepts a positive quoted integer ETag unless the route explicitly documents create sentinel `"0"`.
- Common failures: 400 validation/missing precondition; 401 absent, stale or invalidated tenant session; 403 missing seat/entitlement/feature/permission; 404 missing scoped resource; 409 stale aggregate or in-flight duplicate; 422 semantic/scope/idempotency mismatch; 503 entitlement or dependency unavailable. Gateway-originated failures use Problem Details. Trade-originated validation, guard, and domain errors remain raw Nest exception bodies and are passed through unchanged by the Gateway; successes use the envelope above.
- Domain error codes observed in the owning module: `TRADE.ACCOUNT.ALREADY_EXISTS`, `TRADE.ACCOUNT.BLOCK_TRANSITION_INVALID`, `TRADE.ACCOUNT.BRANCH_RULE_ALREADY_EXISTS`, `TRADE.ACCOUNT.BRANCH_RULE_NOT_FOUND`, `TRADE.ACCOUNT.BRANCH_RULE_WEAKENS_POLICY`, `TRADE.ACCOUNT.CREDIT_LIMIT_INVALID`, `TRADE.ACCOUNT.NOT_FOUND`, `TRADE.ACCOUNT.PARTY_ROLE_INVALID`, `TRADE.ACCOUNT.TERM_INVALID`, `TRADE.AUTH.TARGET_DENIED`, `TRADE.CONCURRENCY.STALE_VERSION`, `TRADE.CONTEXT.BRANCH_COMPANY_MISMATCH`, `TRADE.CREDIT.EXPOSURE_UNAVAILABLE`.

- Credit evaluation is a read-heavy POST but still requires a UUIDv7 idempotency key in the controller. It may depend on Accounting-owned exposure projections.
- Block/unblock and updates use optimistic concurrency. Branch rules can only narrow at branch scope.

## Safe example

Use the tenant portal's authenticated same-origin API client; it owns the session/cookie behavior. This read example contains only browser-authorized scope headers:

```ts
const result = await tenantTradeApi.request(
  "/api/tenant/trade/v1/commercial-accounts/019f98a0-1234-7abc-8def-1234567890ab",
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

- The DTO does not close the general account `status` query or branch-rule status at runtime. Use values returned by the service and handle unknown values.
- Never infer writable fields from response entities. Use only the DTO named in the route table.
- Never call Trade directly from the browser and never call Worker. Use the canonical Gateway path.
- See [examples.md](examples.md) for safe request patterns and [route-coverage.md](route-coverage.md) for the complete 226-route assignment.
