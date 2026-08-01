# Trade API Security Contract

> Contract status: source-verified cross-cutting security contract
> Verification date: 2026-07-25
> Backend owner: Trade, with Core identity and Gateway edge enforcement
> Documentation: hand-written from guards, middleware, services, tests, and Gateway contracts
> Canonical browser prefix: `/api/tenant/trade/v1`
> Controller-relative prefix: `/trade` under upstream `/api/v1`
> Tenant Portal status: replacement Trade client is not implemented; these controls are mandatory for its shared API layer and feature modules.

## Enforcement chain

Trade registers global guards in this order:

1. JWT authentication.
2. Trusted Gateway tenant reconciliation.
3. active tenant-user/session-version/module-seat validation.
4. provisioning maintenance, module subscription, and feature entitlement validation.
5. company/branch/channel scope validation.
6. scoped permission validation.
7. throttling.

Sources:

- `../backend/mutakamel-apps/trade-app/src/common/common.module.ts`
- `../backend/mutakamel-apps/trade-app/src/common/guards/trusted-gateway-tenant.guard.ts`
- `../backend/mutakamel-apps/trade-app/src/common/guards/tenant-user-state.guard.ts`
- `../backend/mutakamel-apps/trade-app/src/common/guards/subscription.guard.ts`
- `../backend/mutakamel-apps/trade-app/src/common/guards/trade-scope.guard.ts`
- `../backend/mutakamel-apps/trade-app/src/common/guards/trade-permissions.guard.ts`

The actor must be an active `TENANT_USER` whose token session version matches the current Core-owned tenant-user row. A non-owner must have a live `trade` or `sales` module assignment. Tenant owners bypass the module-seat check and scoped permission-row lookup; they do not bypass authentication, active-session, module entitlement, feature, scope, validation, or concurrency controls.

Provisioning maintenance fails closed with `TRADE.PROVISIONING.MAINTENANCE_ACTIVE`. Missing/failed entitlement resolution returns a forbidden or dependency-unavailable result; the UI must not reinterpret either as a successful empty state.

## Browser and trusted headers

| Header | Browser use | Rule |
|---|---|---|
| `Authorization` or established authenticated session | Through the shared tenant API client | Follow the portal/Gateway authentication mechanism; never persist access tokens in documentation, logs, URLs, analytics, or static state. |
| `X-Mutakamel-Company-Id` | Allowed when the route scope requires/accepts company context | UUIDv7; must identify an active company authorized for the actor. |
| `X-Mutakamel-Branch-Id` | Allowed for branch context | UUIDv7; requires company and must belong to that active company. |
| `X-Mutakamel-Channel-Id` | Allowed only where execution context uses a channel | UUIDv7; requires company, must be active, and must be assigned to the branch when a branch is present. |
| `X-Idempotency-Key` | Required exactly where the route table says so | Generate one UUIDv7 per user intent and retain it across uncertain retries of the same canonical request. |
| `If-Match` | Required exactly where the route table says so | Send the last server ETag, normally a quoted positive integer. Only company-default price-book creation accepts `"0"`. |
| `X-Correlation-Id` | Optional through the shared client | Use a non-sensitive trace identifier; display returned correlation IDs in support/error UI. |
| `x-mutakamel-tenant-id` | Forbidden in browser code | Trusted Gateway-to-Trade header. |
| `x-mutakamel-tenant-db-name` | Forbidden in browser code | Trusted Gateway-to-Trade database-routing header. |
| `x-internal-gateway-secret` | Forbidden in browser code | Server secret verified with timing-safe comparison when trusted tenant headers are present. |

Never construct direct Trade service URLs. The Gateway owns tenant resolution and canonicalizes `/api/tenant/trade/v1/...` to the upstream `/api/v1/trade/...` shape.

## Scope semantics

| Target | Required authorized context |
|---|---|
| `TENANT` | No company/branch header is required. |
| `COMPANY` | Company header. |
| `BRANCH` | Company and branch headers. |
| `COMPANY_OR_BRANCH` | Branch context when branch is present; otherwise company. |
| `OPERATING_CONTEXT` | Branch, then company, then tenant according to supplied context. |
| `DASHBOARD_CONTEXT` | May start without one company header; dashboard services authorize every resolved company/branch/channel/node target. |

The scope guard rejects missing headers with 400-class context errors, mismatched or inactive masters with 422-class errors, and unauthorized scoped permission grants with 403. Do not pre-authorize by trusting IDs from local storage; rebuild the active context from authorized Core data and still let the server decide.

## Permissions and feature entitlements

Every route page names the controller permission and required feature expression. Exact constants are in [static-data.md](static-data.md).

- UI gating is advisory. A hidden button is not authorization.
- Do not broaden `anyOf` feature requirements into “any Trade feature”.
- Do not reuse a permission from a similarly named document family.
- Dashboard generic permission lookup is intentionally deferred for `DASHBOARD_CONTEXT`; dashboard services authorize every target and share.

## Validation and untrusted content

Trade transforms primitives, whitelists DTO fields, rejects unknown fields, and collects validation failures as `TRADE.VALIDATION_FAILED`. Use [validation-reference.md](validation-reference.md) to build request schemas.

Localized names, reason/evidence text, codes, extension values, dashboard names, webhook metadata, and server error titles are untrusted display data. Render them as text, never as raw HTML. Avoid putting business data in URLs, telemetry labels, or client exception messages.

TypeScript unions without runtime membership validators are not security boundaries. The server service remains authoritative for all referential, transition, policy, financial, inventory, and cross-scope invariants.

## Idempotency and optimistic concurrency

Gateway `idempotent: true` is transport metadata. It is independent from the Trade domain replay contract.

- For a domain command, generate a UUIDv7 once when the intent is created.
- Retry the same uncertain request with the same actor, operation, path, scope, headers, and normalized body.
- Never reuse that key for a changed payload or a new user action.
- A completed exact replay returns the recorded outcome and `Idempotency-Replayed`.
- A changed request under the same key returns `TRADE.IDEMPOTENCY.MISMATCH`.
- A duplicate still in progress conflicts.
- Keep `If-Match` tied to the version the user edited. On stale-version failure, refetch and ask the user/app logic to reconcile; do not silently overwrite.

Sources:

- `../backend/mutakamel-apps/trade-app/src/common/domain-idempotency.service.ts`
- `../backend/mutakamel-apps/trade-app/src/common/http-preconditions.ts`
- `../backend/mutakamel-apps/trade-app/src/common/trade-response.interceptor.ts`

## Async operations and private artifacts

A 202 response means accepted, not completed. Use the returned canonical `Location` or documented status path and respect `Retry-After`. Relevant operations include import preview/execute, webhook test/retry/secret work, PDF rendering, control-tower retry, and some sales-order confirmations.

PDF job results can contain time-limited private artifact URLs. Do not log, persist, prefetch, analytics-track, proxy-cache, or share them. Poll responses are private/no-store. Open or download only after an explicit authorized action.

The browser must never call Worker. Trade owns the public job projection; Worker owns background execution.

## Import upload boundary

`POST /api/tenant/trade/v1/imports/sources` accepts exactly one multipart part named `file`, no additional fields, and a UUIDv7 idempotency key. The maximum stored size is 50 MiB. Trade detects content from bytes:

- UTF-8 non-binary content becomes `text/csv`.
- ZIP-signature content becomes XLSX with media type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

Do not set multipart `Content-Type` manually; the browser must add the boundary. Never accept browser-supplied object references, hashes, file sizes, or storage evidence as preview inputs. The upload response supplies the Trade-owned source ID.

Sources:

- `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/extensions-automation.controller.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/import-source.service.ts`
- `../backend/mutakamel-apps/shared-libs/packages/storage/src/constants/immutable-object.constants.ts`

## Webhook SSRF and secret boundary

Webhook endpoint creation/update is server validated. Accepted endpoints must use HTTPS, contain no credentials or fragment, avoid localhost/`.local`, use the default port or 443/8443, contain no secret-like query parameter names, and resolve only to permitted public addresses. DNS failure is treated as a dependency failure. The service returns projected endpoint origin/path and secret-reference status; it does not return plaintext secrets.

Do not implement a frontend “validation bypass” or assume a syntactically valid URL is accepted. Never place credentials, tokens, signatures, or secrets in endpoint query strings.

Sources:

- `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/webhook-egress.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/extensions-registry.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/webhook-subscriptions.service.ts`

## Error handling and logging

Trade successes use `{ success, data, correlationId, timestamp }`. Trade registers no shared exception filter, so Trade-originated validation, guard, and domain failures retain raw Nest exception bodies such as `{ code, message, details? }`; default Nest failures may instead use `{ statusCode, message, error? }`. The Gateway forwards those upstream status codes, headers, and bodies unchanged.

Only Gateway-originated failures are guaranteed to use Problem Details with fields such as `type`, `title`, `status`, `code`, `instance`, and `correlationId`. The shared client must accept both families, derive status from the HTTP response, use a stable `code` when present, and tolerate a Trade error body with no `correlationId`. Treat all server messages and titles as untrusted display text; do not render raw validation objects directly.

Sources:

- `../backend/mutakamel-apps/trade-app/src/main.ts`
- `../backend/mutakamel-apps/trade-app/src/common/trade-response.interceptor.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/upstream-client.service.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/common/filters/problem-details.filter.ts`

Never log:

- bearer tokens, cookies, trusted Gateway headers, or webhook secret material;
- PDF/private artifact URLs;
- import object references, raw uploaded rows, full webhook payloads, or extension values;
- complete request/response bodies containing customer, supplier, financial, inventory, or legal-document data.

Use route key, safe error code, status, correlation ID, aggregate type, and non-sensitive timing metrics instead.
