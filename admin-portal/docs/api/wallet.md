# Wallet API

Browser prefix: `/api/admin/core/v1`. The `/admin/...` forms below are Core
controller-relative paths, not browser request URLs.

Base Path: Multiple routes
Guard: `AdminGuard`

---

## GET `/admin/wallet/input-currencies` — List Input Currencies

**Permission**: `admin.wallet.read`
**HTTP Status**: 200
**Cache**: `private, no-store`

---

## GET `/admin/tenants/:tenantId/wallet` — Get Tenant Wallet

**Permission**: `admin.wallet.read`
**HTTP Status**: 200

---

## GET `/admin/tenants/:tenantId/wallet/ledger` — Get Tenant Wallet Ledger

**Permission**: `admin.wallet.read`
**HTTP Status**: 200

### Query Parameters — `LedgerQueryDto`
```typescript
{
  page?: number;
  limit?: number;
  currencyCode?: string;
}
```

---

## POST `/admin/tenants/:tenantId/wallet/adjustments/preview` — Preview Adjustment

**Permission**: `admin.wallet.manage`
**HTTP Status**: 200
**Idempotency**: Required

### Request Body — `PreviewWalletAdjustmentDto`
Preview details for a wallet balance adjustment.

---

## POST `/admin/tenants/:tenantId/wallet/adjustments` — Confirm Adjustment

**Permission**: `admin.wallet.manage`
**HTTP Status**: 200
**Idempotency**: Required

### Request Body — `ConfirmWalletAdjustmentDto`
Confirmed adjustment with reason and amount.

---

## GET `/admin/wallets/:walletId/ledger` — Get Wallet Ledger By ID

**Permission**: `admin.wallet.read`
**HTTP Status**: 200

### Query Parameters — `LedgerQueryDto`
Same as tenant wallet ledger query.
