# Trade Imports and Webhooks API

> Contract status: source-verified backend contract; replacement frontend not implemented
> Verification date: 2026-07-25
> Backend owner: Trade
> Documentation: source-generated from verified Gateway routes, Trade controllers/DTOs/services/tests, and legacy frontend evidence
> Canonical browser prefix: `/api/tenant/trade/v1`
> Controller-relative prefixes: `/trade/import-mappings`, `/trade/imports`, `/trade/webhooks`
> Tenant Portal status: `tenant-portal` replaces the legacy tenant Trade UI; Legacy `mutakamel-web-app` has live import and webhook clients/panels. The replacement `tenant-portal` is not implemented.

## Capability

Import mapping governance, immutable source upload, asynchronous preview/execute/results, webhook subscription secret operations, delivery logs, and replay.

- Controller feature requirements: extension/webhook routes require all of `trade.automation` and any of `trade.catalog`, `trade.sales`, `trade.purchasing`, or `trade.inventory`; import mapping/source/run routes override this with all of `trade.automation` and `trade.catalog`.
- Gateway routes assigned to this page: **21**.
- These are browser contracts. The Trade upstream remains `/api/v1/trade/...`; the browser must use the canonical prefix above.

## Source evidence

Backend source references below are relative to `C:\mutakamel.ai\frontend`.

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/trade.route-contracts.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/extensions-automation.controller.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/import-mappings.service.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/import-source.service.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/webhook-subscriptions.service.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/extensions-registry.ts`
- `../backend/mutakamel-apps/worker-app/src/modules/trade-import/trade-import.consumer.ts`
- `../backend/mutakamel-apps/worker-app/src/modules/trade-webhook/webhook.consumer.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/trade/trade-automation-api.ts`

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
| GET | `/api/tenant/trade/v1/import-mappings` | `/trade/import-mappings` | `trade.import.manage` | `OPERATING_CONTEXT` | `query: ImportMappingListQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/import-mappings/:id` | `/trade/import-mappings/:id` | `trade.import.manage` | `OPERATING_CONTEXT` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/import-mappings` | `/trade/import-mappings` | `trade.import.manage` | `OPERATING_CONTEXT` | `body: CreateImportMappingDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| PATCH | `/api/tenant/trade/v1/import-mappings/:id` | `/trade/import-mappings/:id` | `trade.import.manage` | `OPERATING_CONTEXT` | `body: UpdateImportMappingDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/imports/sources` | `/trade/imports/sources` | `trade.import.execute` | `OPERATING_CONTEXT` | — | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/imports` | `/trade/imports` | `trade.import.execute` | `OPERATING_CONTEXT` | `query: ImportRunListQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/imports/preview` | `/trade/imports/preview` | `trade.import.execute` | `OPERATING_CONTEXT` | `body: PreviewImportDto` | `X-Idempotency-Key` | 202 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/imports/:runId/execute` | `/trade/imports/:runId/execute` | `trade.import.execute` | `OPERATING_CONTEXT` | — | `X-Idempotency-Key`, `If-Match` | 202 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/imports/:runId` | `/trade/imports/:runId` | `trade.import.execute` | `OPERATING_CONTEXT` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/imports/:runId/results` | `/trade/imports/:runId/results` | `trade.import.execute` | `OPERATING_CONTEXT` | `query: ImportResultListQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/webhooks/events` | `/trade/webhooks/events` | `trade.webhooks.manage` | `OPERATING_CONTEXT` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/webhooks/subscriptions` | `/trade/webhooks/subscriptions` | `trade.webhooks.manage` | `OPERATING_CONTEXT` | `query: WebhookSubscriptionListQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/webhooks/subscriptions/:id` | `/trade/webhooks/subscriptions/:id` | `trade.webhooks.manage` | `OPERATING_CONTEXT` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/webhooks/subscriptions` | `/trade/webhooks/subscriptions` | `trade.webhooks.manage` | `OPERATING_CONTEXT` | `body: CreateWebhookSubscriptionDto` | `X-Idempotency-Key` | 201 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| PATCH | `/api/tenant/trade/v1/webhooks/subscriptions/:id` | `/trade/webhooks/subscriptions/:id` | `trade.webhooks.manage` | `OPERATING_CONTEXT` | `body: UpdateWebhookSubscriptionDto` | `X-Idempotency-Key`, `If-Match` | 200 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/webhooks/subscriptions/:id/rotate-secret` | `/trade/webhooks/subscriptions/:id/rotate-secret` | `trade.webhooks.manage` | `OPERATING_CONTEXT` | `body: RotateWebhookSecretDto` | `X-Idempotency-Key`, `If-Match` | 202 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/webhooks/subscriptions/:id/revoke-secret` | `/trade/webhooks/subscriptions/:id/revoke-secret` | `trade.webhooks.manage` | `OPERATING_CONTEXT` | — | `X-Idempotency-Key`, `If-Match` | 202 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/webhooks/subscriptions/:id/test` | `/trade/webhooks/subscriptions/:id/test` | `trade.webhooks.manage` | `OPERATING_CONTEXT` | — | `X-Idempotency-Key` | 202 | `WRITE_SENSITIVE`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/webhooks/deliveries` | `/trade/webhooks/deliveries` | `trade.webhooks.manage` | `OPERATING_CONTEXT` | `query: WebhookDeliveryListQueryDto` | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| GET | `/api/tenant/trade/v1/webhooks/deliveries/:id` | `/trade/webhooks/deliveries/:id` | `trade.webhooks.manage` | `OPERATING_CONTEXT` | — | — | 200 | `AUTHENTICATED`; gateway-idempotent=true |
| POST | `/api/tenant/trade/v1/webhooks/deliveries/:id/retry` | `/trade/webhooks/deliveries/:id/retry` | `trade.webhooks.replay` | `OPERATING_CONTEXT` | `body: RetryWebhookDeliveryDto` | `X-Idempotency-Key`, `If-Match` | 202 | `WRITE_SENSITIVE`; gateway-idempotent=true |

`gateway-idempotent` is Gateway transport metadata. `X-Idempotency-Key` in the header column is the independent Trade domain replay contract.

## Validation and enum wire values

The global validation pipe transforms primitive query values, whitelists declared fields, rejects unknown fields, accumulates validation failures, and returns `TRADE.VALIDATION_FAILED`. Exact property decorators are in [validation-reference.md](validation-reference.md).

- Import source is exactly one multipart file field named `file`, with no text fields/extra parts. Allowed types are CSV and XLSX; maximum stored size is 50 MiB.
- Mapping fields are unique, bounded and registry validated. Preview references a stored source and mapping; execute uses `If-Match` on the run.
- Webhook URLs must be HTTPS, have no credentials/fragment/secret-like query parameter, use port 443 or 8443, and pass private/loopback/link-local address rejection and runtime egress checks.
- Secret plaintext is returned only by the permitted create/rotate flow; never persist it in client logs or state beyond the user handoff.

- Import target: `CATALOG_COMPANY_PROFILE`, `CATALOG_BRANCH_ASSIGNMENT`; scope: `COMPANY`, `BRANCH`; execution: `PER_ROW`.
- Import result: `VALID`, `INVALID`, `SUCCEEDED`, `FAILED`, `SKIPPED`. Run status filter: `PENDING`, `PREVIEWING`, `PREVIEWED`, `EXECUTING`, `COMPLETED`, `COMPLETED_WITH_ERRORS`, `FAILED`.
- Webhook scope: `TENANT`, `COMPANY`; retry policy: `EXPONENTIAL_STANDARD`, `EXPONENTIAL_CONSERVATIVE`; subscription status filter: `DRAFT`, `ACTIVE`, `DISABLED` (updates accept `ACTIVE` or `DISABLED`).

## Response, errors, security, idempotency and async behavior

- Normal non-204 success: `{ success: true, data, correlationId, timestamp }`. A versioned object also sets `ETag: "<version>"`; a domain replay sets `Idempotency-Replayed`. A 204 has no body.
- A required idempotency key is a UUIDv7. Reusing it with a different canonical request returns an idempotency mismatch; an in-flight duplicate conflicts. A required `If-Match` accepts a positive quoted integer ETag unless the route explicitly documents create sentinel `"0"`.
- Common failures: 400 validation/missing precondition; 401 absent, stale or invalidated tenant session; 403 missing seat/entitlement/feature/permission; 404 missing scoped resource; 409 stale aggregate or in-flight duplicate; 422 semantic/scope/idempotency mismatch; 503 entitlement or dependency unavailable. Gateway-originated failures use Problem Details. Trade-originated validation, guard, and domain errors remain raw Nest exception bodies and are passed through unchanged by the Gateway; successes use the envelope above.
- Domain error codes observed in the owning module: `TRADE.APPROVAL.MAKER_CHECKER_REQUIRED`, `TRADE.AUTH.TARGET_DENIED`, `TRADE.CONCURRENCY.STALE_VERSION`, `TRADE.DEPENDENCY.TIMEOUT`, `TRADE.EXTENSION.DEFINITION_INVALID`, `TRADE.EXTENSION.PROFILE_INCOMPATIBLE`, `TRADE.EXTENSION.RESERVED_FIELD`, `TRADE.EXTENSION.VALUE_INVALID`, `TRADE.IDEMPOTENCY.KEY_REQUIRED`, `TRADE.IDEMPOTENCY.MISMATCH`, `TRADE.IMPORT.FILE_UNSAFE`, `TRADE.IMPORT.MAPPING_INVALID`, `TRADE.IMPORT.SCOPE_MISMATCH`, `TRADE.WEBHOOK.DELIVERY_NOT_RETRYABLE`, `TRADE.WEBHOOK.ENDPOINT_FORBIDDEN`, `TRADE.WEBHOOK.PAYLOAD_FORBIDDEN`, `TRADE.WEBHOOK.SECRET_VERSION_INVALID`.

- Upload returns 201. Preview and execute return 202; poll `GET /imports/:runId` and paged results. Worker owns parsing/execution, but browser calls only the Trade projection routes.
- Secret rotate/revoke/test and delivery retry return 202. Poll subscription/delivery detail or list; do not assume dispatch success from acceptance.
- All writes require UUIDv7 idempotency; updates/execute/secret mutations/replay require `If-Match` where shown. The Gateway explicitly disables transport retry for multipart upload.

## Safe example

Use the tenant portal's authenticated same-origin API client; it owns the session/cookie behavior. This read example contains only browser-authorized scope headers:

```ts
const result = await tenantTradeApi.request(
  "/api/tenant/trade/v1/import-mappings/019f98a0-1234-7abc-8def-1234567890ab",
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

- There is no browser endpoint to read uploaded file bytes. Import and webhook worker internals are not Tenant Portal APIs.
- Never infer writable fields from response entities. Use only the DTO named in the route table.
- Never call Trade directly from the browser and never call Worker. Use the canonical Gateway path.
- See [examples.md](examples.md) for safe request patterns and [route-coverage.md](route-coverage.md) for the complete 226-route assignment.
