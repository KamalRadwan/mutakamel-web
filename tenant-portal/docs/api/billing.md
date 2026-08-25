# Tenant billing, invoices, and subscription API

> **Contract status:** Current
> **Last verified:** 2026-07-25
> **Backend owner:** Core (`core-app`)
> **Canonical browser prefixes:** `/api/tenant/core/v1/billing`, `/api/tenant/core/v1/subscription`
> **Controller-relative prefixes:** `/tenant/billing`, `/tenant/subscription`
> **Tenant Portal status:** Planned. The legacy billing UI is live for summary/invoice/payment history but only partial for self-serve subscription changes.
> **Documentation:** Hand-written and source-verified; not generated.

Wallet top-up and payment history are documented in [payments-wallet.md](payments-wallet.md). Workspace currencies/taxes are in [finance-configuration.md](finance-configuration.md).

## Source of truth

- Gateway contracts: `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- Billing controller/service: `../backend/mutakamel-apps/core-app/src/tenant/billing`
- Subscription controller: `../backend/mutakamel-apps/core-app/src/tenant/subscription/subscription-self-serve.controller.ts`
- Subscription DTO/service: `../backend/mutakamel-apps/core-app/src/admin/subscriptions`
- Payment DTO/service: `../backend/mutakamel-apps/core-app/src/tenant/payments`
- Historical consolidated client/types reference (absent from the current checkout): `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/billing`

## Owner/security boundary

Every route requires a tenant JWT, verified host matching the token, current session, and `TenantOwnerGuard`. There is no permission-key substitute: Core verifies `tenant_users.is_tenant_owner` in the tenant database. Billing/payment reads and collection actions remain available during dunning so an owner can settle debt. Self-serve plan changes reach the service during dunning but are rejected while collection is in progress.

The browser must not send tenant/owner/internal headers. Financial amount fields are decimal strings; never convert through binary floating point. Core rejects unknown DTO fields. JSON uses the standard success/error envelopes; paginated invoices place items in `data` and pagination in `meta`.

## Billing and invoice routes

| Method and canonical browser path | Body/result |
|---|---|
| `GET /api/tenant/core/v1/billing/payment-input-currencies` | `{walletCurrencyCode,items:[{currencyCode,isBaseCurrency}],total}`; no-store |
| `GET /api/tenant/core/v1/billing/summary` | Current wallet/subscription/collection/invoice summary |
| `GET /api/tenant/core/v1/billing/invoices` | Paginated invoice list |
| `GET /api/tenant/core/v1/billing/invoices/:invoiceId` | Invoice detail |
| `POST /api/tenant/core/v1/billing/invoices/:invoiceId/payment-quote` | `{paymentCurrencyCode}`; creates current quote |
| `GET /api/tenant/core/v1/billing/invoices/:invoiceId/payment-intents/active` | Active intent or null |
| `POST /api/tenant/core/v1/billing/invoices/:invoiceId/payment-intents` | `{paymentQuoteId}` plus UUIDv7 idempotency key |
| `GET /api/tenant/core/v1/billing/payments/:paymentId` | Payment status for polling |

`invoiceId`, `paymentId`, and `paymentQuoteId` are UUIDv7. `paymentCurrencyCode` is exactly three uppercase letters and must be one of `payment-input-currencies`.

Safe payment-intent example:

```http
POST /api/tenant/core/v1/billing/invoices/019f9872-0a1a-7cc0-914d-a57aa437fc41/payment-intents
Cookie: __Host-mutakamel-tenant-access=<redacted>; __Host-mutakamel-tenant-session=<redacted>; __Host-mutakamel-tenant-csrf=<csrf-proof>
X-CSRF-Token: <csrf-proof>
Content-Type: application/json
X-Idempotency-Key: 019f9871-fd40-7680-bfbb-fd535b5880c8

{"paymentQuoteId":"019f9872-1a1a-7cc0-914d-a57aa437fc42"}
```

Only payment-intent creation has an explicit application idempotency requirement in this group. Generate one UUIDv7 per exact request and reuse it only for retrying that payload. Quote creation is not safe for blind retry; refetch active state first.

Payment intent creation may return a hosted checkout/action. Redirect only to the exact server-returned URL after applying the portal's allowed-scheme policy. After return, poll the Core payment route; a browser redirect is not proof of settlement.

Payment settlement is asynchronous even though quote/intent creation returns synchronously. The authenticated payment read is the polling authority.

## Subscription routes

| Method and canonical browser path | Contract |
|---|---|
| `GET /api/tenant/core/v1/subscription` | Current subscription |
| `GET /api/tenant/core/v1/subscription/items` | Active module/tier/seat items |
| `POST /api/tenant/core/v1/subscription/plan-change-previews` | UUIDv7 idempotency key; creates priced preview |
| `POST /api/tenant/core/v1/subscription/plan-change-previews/:previewId/apply` | UUIDv7 idempotency key; `200`, apply exact preview |

Preview DTO wire operation is `ADD|CHANGE|REMOVE`, but the tenant-owner endpoint is intentionally add/upgrade-only:

- `ADD`: add a module with exactly one of `moduleId|moduleKey`, exactly one of `tierId|tierKey`, and `seats`.
- `CHANGE`: requires `itemId`; may increase `seats` and/or upgrade the tier.
- `REMOVE`, seat reduction, and tier downgrade are rejected for self-service.

IDs are UUIDv7; module/tier keys are maximum 64; `seats` is integer 1–100,000. Conflicting/irrelevant fields are rejected, not ignored. Preview/apply are separate because pricing, current items, and collection state can change. Apply only the returned `previewId`; never synthesize it.

## Static wire values

- Subscription status: `TRIAL`, `PENDING_ACTIVATION`, `ACTIVE`, `PAST_DUE`, `CANCELLED`.
- Billing cycle: `MONTHLY`, `ANNUAL`.
- Access mode: `FULL`, `DUNNING`, `READ_ONLY`, `BLOCKED`.
- Invoice status: `DRAFT`, `ISSUED`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`, `VOID`.
- Invoice purpose: `TRIAL_ACTIVATION`, `RENEWAL`, `PRORATION`, `MANUAL`.
- Payment status: `CREATED`, `PENDING`, `SUCCEEDED`, `FAILED`, `EXPIRED`, `REQUIRES_REVIEW`, `REFUND_PENDING`, `REFUNDED`.

The dated consolidated-client types tolerated some older status strings during
migration; that absent workspace is historical evidence only. Current code
must produce and branch on the backend values above.

## Errors, cache, and AI rules

Expected failures include `TENANT_CONTEXT_MISSING`, `TENANT_OWNER_REQUIRED`, `SUBSCRIPTION_NOT_FOUND`, invoice/payment/quote not found, quote stale/mismatch/expired, active intent/collection conflicts, and:

- `SUBSCRIPTION_PLAN_CHANGE_REQUEST_INVALID`
- `SUBSCRIPTION_PLAN_CHANGE_COLLECTION_IN_PROGRESS`
- `SUBSCRIPTION_PLAN_CHANGE_PREVIEW_NOT_FOUND|EXPIRED|ALREADY_APPLIED|STALE`
- `SUBSCRIPTION_PLAN_CHANGE_PRICING_CHANGED`
- `SUBSCRIPTION_PLAN_CHANGE_IDEMPOTENCY_REUSED`
- provisioning/past-due/cancelled state conflicts and self-service downgrade/remove denial.

Treat financial reads as private and rapidly changing; payment-input currencies explicitly use no-store, and payment/collection state should be refetched after commands. Never calculate authoritative totals, proration, exchange rates, or entitlement outcomes in the portal.

Validation is DTO-driven and semantic: Core checks UUIDv7 identifiers, currency format/support, quote linkage/freshness, current collection state, plan tuple shape, and add-only self-service rules.
