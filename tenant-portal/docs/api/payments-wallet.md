# Tenant wallet and payments API

> **Contract status:** Current; tenant routes do not expose refunds or manual adjustments
> **Last verified:** 2026-07-25
> **Backend owner:** Core (`core-app`)
> **Canonical browser prefixes:** `/api/tenant/core/v1/wallet`, `/api/tenant/core/v1/payments`
> **Controller-relative prefixes:** `/tenant/wallet`, `/tenant/payments`
> **Tenant Portal status:** Planned. The legacy billing area has a live partial payment-history client.
> **Documentation:** Hand-written and source-verified; not generated.

## Source of truth

- Gateway routes: `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- Wallet controller/service: `../backend/mutakamel-apps/core-app/src/admin/wallet/wallet.controller.ts`, `../backend/mutakamel-apps/core-app/src/admin/wallet/wallet.service.ts`, and `../backend/mutakamel-apps/core-app/src/admin/wallet/ledger.service.ts`
- Payment controller/service/DTO: `../backend/mutakamel-apps/core-app/src/tenant/payments`
- Database enums: `../backend/mutakamel-apps/core-app/packages/database/src/entities/control-plane`
- Legacy client: `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/billing`

## Security and routes

All routes require a tenant JWT, matching verified host, current session, and `TenantOwnerGuard`. They are allowed during dunning so an owner can fund the wallet and inspect settlement. No permission key or client claim can replace database owner status.

| Method and canonical browser path | Contract |
|---|---|
| `GET /api/tenant/core/v1/wallet` | Wallet projection |
| `GET /api/tenant/core/v1/wallet/ledger` | Paginated ledger; optional currency filter |
| `POST /api/tenant/core/v1/payments/topup` | UUIDv7 idempotency key; create hosted top-up |
| `GET /api/tenant/core/v1/payments` | Paginated tenant payment history |

All standard JSON responses use the Core envelope. Paginated item arrays are `data`, with `meta`. Unknown DTO fields are rejected.

Top-up accepts exactly:

Safe top-up body example (use only with a server-listed input currency):

```json
{"amount":"250.0000","currencyCode":"EGP"}
```

- `amount`: positive decimal string, maximum 1,000,000,000 and at most four decimal places; configured provider limits may be lower.
- `currencyCode`: exactly three uppercase letters and must be a supported payment input currency.
- `X-Idempotency-Key`: required UUIDv7. Reuse it only for retrying the identical request.

The server response may contain a hosted checkout URL. Apply scheme/host policy and do not mark the wallet funded from the redirect. Settlement is asynchronous; poll payment/billing state and use webhook-backed Core status as authority.

## Static wire values

- Wallet status: `ACTIVE`, `FROZEN`, `CLOSED`.
- Ledger direction: `CREDIT`, `DEBIT`.
- Ledger reason: `TOP_UP`, `SUBSCRIPTION_CHARGE`, `PRORATION_CREDIT`, `REFUND`, `PROMO`, `ADJUSTMENT`.
- Payment purpose: `WALLET_TOP_UP`, `INVOICE_SETTLEMENT`.
- Payment provider: `PAYMOB`, `INTERNAL`, `OFFLINE`.
- Payment status: `CREATED`, `PENDING`, `SUCCEEDED`, `FAILED`, `EXPIRED`, `REQUIRES_REVIEW`, `REFUND_PENDING`, `REFUNDED`.

Amount/balance/exchange values are decimal strings. Keep them as strings or use an exact decimal library.

## Scope exclusions, errors, and AI rules

Refund, offline-payment, reconciliation, and wallet-adjustment endpoints are admin-only Core routes and are not Tenant Portal capabilities. A payment row can have refund-related status, but the tenant must not call an admin route to act on it.

| Method and exact canonical browser path | Portal use |
|---|---|
| `POST /api/tenant/core/v1/public/payments/webhook` | **DO_NOT_CALL**; external payment-provider callback only |

The webhook is public at the session layer but authenticated by the payment provider's `hmac` query signature. Core validates the raw provider payload/signature and performs idempotent settlement. Tenant Portal must never create, proxy, replay, simulate, cache, or log webhook calls or their secrets. Browser return flows poll the authenticated Core payment read instead.

Expected failures include `TENANT_OWNER_REQUIRED`, wallet not found/status conflicts, unsupported input currency, amount/provider configuration limits, idempotency reuse/mismatch/in-progress, and payment-provider/dependency failures.

Validation combines DTO amount/currency rules with provider limits, wallet status, owner scope, and settlement state. Standard JSON envelopes apply; the external webhook also returns Core's HTTP result but is not a portal contract.

- Treat wallet and ledger data as private/no shared cache.
- Refresh wallet, ledger, and payment after settlement; never increment balances locally.
- Show provider pending/review states without converting them to success.
- Never log checkout tokens, provider payloads, or full payment metadata.
