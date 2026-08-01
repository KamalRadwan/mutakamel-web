# Tenant Portal Trade API Documentation

> Contract status: source-verified replacement implementation contract
> Verification date: 2026-07-25
> Backend owner: Trade
> Documentation: hand-written index over source-generated contract pages
> Canonical browser prefix: `/api/tenant/trade/v1`
> Controller-relative prefix: `/trade` under upstream `/api/v1`
> Tenant Portal status: `tenant-portal` replaces the legacy tenant Trade UI; no Trade API client, state layer, or screen exists in the replacement frontend yet.

This folder is the implementation contract for rebuilding the tenant Trade portal. It documents API behavior, validation, authorization, static values, asynchronous workflows, errors, safe examples, and cross-app ownership. It intentionally contains no visual or interaction design.

## Contract result

- The typed Gateway registry contains **226 Trade routes**.
- All 226 routes match a Trade controller by HTTP method and upstream path.
- Every Gateway route is assigned exactly once in [route-coverage.md](route-coverage.md).
- Four controller-only UOM CRUD routes are classified as internal/unrouted; only `GET /api/tenant/trade/v1/catalog/uoms` is a browser contract.
- The canonical browser path is always `/api/tenant/trade/v1/...`. `/api/v1/trade/...` is the Gateway-to-Trade upstream form, not a frontend base URL.

Authoritative route sources:

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/trade.route-contracts.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/gateway-api-path.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/**/*.controller.ts`

## Success and error wire shapes

Trade success responses pass through `TradeResponseInterceptor` and use `{ success, data, correlationId, timestamp }`, with relevant transport headers such as `ETag` preserved. Trade does not register a shared exception filter: validation, guard, and domain failures therefore retain their Nest exception bodies, commonly `{ code, message, details? }`, while default Nest failures may use `{ statusCode, message, error? }`.

The Gateway forwards an upstream Trade status, headers, and body unchanged. Only failures created by the Gateway itself are guaranteed to use its Problem Details shape. The replacement client must normalize both error families and take the HTTP status from the response; it must not assume every non-2xx Trade call has Problem Details fields or an error-body `correlationId`.

Sources:

- `../backend/mutakamel-apps/trade-app/src/common/trade-response.interceptor.ts`
- `../backend/mutakamel-apps/trade-app/src/main.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/upstream-client.service.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/common/filters/problem-details.filter.ts`

## Capability pages

| Capability | Routes | Contract |
|---|---:|---|
| Catalog, UOM catalogue, channels | 19 | [catalog.md](catalog.md) |
| Commercial accounts and credit | 10 | [commercial-accounts.md](commercial-accounts.md) |
| Configuration definitions and assignments | 6 | [configuration-scope.md](configuration-scope.md) |
| Control tower exceptions | 4 | [control-tower.md](control-tower.md) |
| Dashboard definitions and execution | 20 | [dashboards.md](dashboards.md) |
| Dashboard widget resources | 11 | [dashboard-widgets.md](dashboard-widgets.md) |
| Document profiles and publication | 5 | [document-platform.md](document-platform.md) |
| Customer quotations and sales orders | 22 | [documents.md](documents.md) |
| Extension profiles and values | 9 | [extension-profiles.md](extension-profiles.md) |
| Imports, webhooks, and automation | 21 | [extensions-automation.md](extensions-automation.md) |
| Invoices and contracts | 10 | [financial-documents.md](financial-documents.md) |
| Inventory operations and governance | 26 | [inventory.md](inventory.md) |
| Policy sets, versions, and decisions | 13 | [policy-studio.md](policy-studio.md) |
| Price books, versions, and evaluation | 10 | [pricing-price-books.md](pricing-price-books.md) |
| Purchase quotations | 6 | [purchase-quotations.md](purchase-quotations.md) |
| Purchase orders | 10 | [purchasing.md](purchasing.md) |
| Workflow definitions and versions | 12 | [workflow-versions.md](workflow-versions.md) |
| PDF render jobs across six document families | 12 | [pdf-render-jobs.md](pdf-render-jobs.md) |
| **Total** | **226** | [complete assignment](route-coverage.md) |

[inventory-pricing.md](inventory-pricing.md) is a compatibility overview for the former combined page; the authoritative route tables are now split between Inventory and Pricing.

## Cross-cutting references

- [security.md](security.md): authentication chain, scope headers, permissions, features, idempotency, concurrency, uploads, webhooks, and private artifacts.
- [validation-reference.md](validation-reference.md): source-extracted DTO properties, defaults, transforms, validators, inheritance, and runtime closed lists.
- [static-data.md](static-data.md): exact feature keys, permissions, declared enums, and shared limits.
- [examples.md](examples.md): safe read, create, update, async polling, upload, and error-handling patterns.
- [ai-implementation-guide.md](ai-implementation-guide.md): deterministic rules for AI-generated clients, schemas, state transitions, tests, and ownership boundaries.

## System ownership

| Concern | Owner | Tenant Portal rule |
|---|---|---|
| Tenant identity, users, sessions, tenant/company/branch masters, roles, module seats, subscriptions, provisioning | Core | Consume authenticated and authorized Core context; never recreate these masters in Trade state. |
| Public browser routing, path canonicalization, edge policy, Gateway-originated Problem Details | API Gateway | Call only canonical same-origin `/api/tenant/...` paths and preserve upstream Trade error bodies. |
| Trade aggregates, projections, permissions, scopes, validation, concurrency, and command replay | Trade | Treat Trade responses and ETags as authoritative for Trade workflows. |
| Party/customer/contact/opportunity references used by Trade | CRM | Store and send only identifiers accepted by Trade DTOs; CRM remains owner of CRM records. |
| Import execution, webhook delivery, and PDF rendering work | Worker | Start and observe work through Trade projection routes; never call Worker from the browser. |

## Source precedence

When documentation and code differ, stop implementation and re-audit in this order:

1. Typed Gateway route contract for browser reachability, canonical path, route class, and transport retry policy.
2. Trade controller decorators for permission, feature, scope, request DTO, required headers, and status.
3. DTO validators for the transport schema.
4. Service code and tests for semantic invariants, state transitions, response projection, error codes, and asynchronous behavior.
5. Legacy frontend only as migration evidence; it is not the authority for the replacement contract.

Do not infer endpoints, request fields, enums, or write permissions from entity models, old screens, response payloads, or naming symmetry.
