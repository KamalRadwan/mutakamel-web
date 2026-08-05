# Payments, Refunds, and Reconciliation API

Status: **[Verified]**

Last source verification: **2026-07-30**

Owner: **Core**

## Routes

| Method and canonical browser path | Permissions | Purpose |
| --- | --- | --- |
| `GET /api/admin/core/v1/tenants/:tenantId/payments` | `admin.wallet.read` | Paginated tenant payment history |
| `POST /api/admin/core/v1/payments/:paymentId/refunds` | `admin.wallet.manage` + `admin.billing.critical` | Create refund command |
| `GET /api/admin/core/v1/payments/:paymentId/reconciliations` | `admin.billing.reconcile` | Read proposals/decisions |
| `POST /api/admin/core/v1/payments/:paymentId/reconciliations` | `admin.billing.reconcile` | Propose reconciliation |
| `POST /api/admin/core/v1/payments/:paymentId/reconciliations/:reconciliationId/decision` | `admin.billing.reconcile` + `admin.billing.critical` | Apply/reject a reconciliation decision |

The four write/read reconciliation/refund routes plus the tenant payment list
form the five-route `core.admin.payments` Gateway domain.

## Wire values

```ts
type PaymentStatus =
  | "CREATED"
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "EXPIRED"
  | "REQUIRES_REVIEW"
  | "REFUND_PENDING"
  | "REFUNDED";

type PaymentReconciliationStatus = "PROPOSED" | "APPLIED" | "REJECTED";

type PaymentReconciliationAction =
  | "CONFIRM_SUCCEEDED"
  | "CONFIRM_FAILED"
  | "CONFIRM_REFUNDED"
  | "CONFIRM_REFUND_FAILED";
```

## Frontend rules

- Keep all payment/refund amounts as decimal strings.
- Never infer gateway/provider success from a local action.
- Reconciliation decisions are critical and require explicit confirmation.
- Refresh the payment and reconciliation projections after an accepted command.
- Keep correlation/provider references safe; do not expose secrets or raw
  provider payloads.
- Unknown additive status/action values require a visible fallback.

## Current frontend status

No payments/refunds/reconciliation Admin screen or typed domain client exists.
The tenant detail prototype does not implement these routes.

## Source map

- `../backend/mutakamel-apps/core-app/src/admin/payments/`
- `../backend/mutakamel-apps/core-app/src/admin/payments/dto/`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
