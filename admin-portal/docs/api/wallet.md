# Wallet and Ledger API

Status: **[Verified]**

Last source verification: **2026-08-11**

Owner: **Core**

## Routes

| Method and canonical browser path | Permissions | Success |
| --- | --- | ---: |
| `GET /api/admin/core/v1/wallet/input-currencies` | `admin.wallet.read` | `200` |
| `GET /api/admin/core/v1/tenants/:tenantId/wallet` | `admin.wallet.read` | `200` |
| `GET /api/admin/core/v1/tenants/:tenantId/wallet/ledger` | `admin.wallet.read` | `200` |
| `POST /api/admin/core/v1/tenants/:tenantId/wallet/adjustments/preview` | `admin.wallet.manage` | `201` |
| `POST /api/admin/core/v1/tenants/:tenantId/wallet/adjustments` | `admin.wallet.manage` + `admin.wallet.critical` | `201` |
| `GET /api/admin/core/v1/wallets/:walletId/ledger` | `admin.wallet.read` | `200` |

The confirmation permission pair uses ALL semantics.

## Preview request

```ts
interface PreviewWalletAdjustmentDto {
  direction: "CREDIT" | "DEBIT";
  sourceAmount: string;
  sourceCurrencyCode: string;
  reasonCode: "MANUAL_CREDIT" | "MANUAL_DEBIT";
}
```

`sourceAmount`:

```regex
^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$
```

The server returns the authoritative currency conversion and quote. Never
calculate wallet FX in the browser.

## Confirmation request

```ts
interface ConfirmWalletAdjustmentDto {
  quoteId: string; // UUIDv7
  note: string;    // 1..255
}
```

Preview and confirmation are separate exact intents and receive separate
UUIDv7 idempotency keys.

## Ledger

Ledger reads accept page/limit and optional currency filters. Rows are under
`data`; pagination uses `meta.total`. Preserve decimal strings for balances,
amounts, FX, and running totals.

```ts
type WalletStatus = "ACTIVE" | "FROZEN" | "CLOSED";
type LedgerDirection = "CREDIT" | "DEBIT";
type LedgerReason =
  | "TOP_UP"
  | "SUBSCRIPTION_CHARGE"
  | "PRORATION_CREDIT"
  | "REFUND"
  | "PROMO"
  | "ADJUSTMENT";
```

Unknown additive values require a safe fallback.

## Current frontend integration

The tenant billing tab uses the server preview and confirmation routes with
separate stable UUIDv7 intents. It displays input currencies from the safe
catalogue, preserves every financial value as a decimal string, exposes the
paginated ledger, and refetches authoritative wallet state after confirmation.
There are no local credit/debit endpoints or browser-side FX calculations.

## Source map

- `../backend/mutakamel-apps/core-app/src/admin/wallet/wallet.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/wallet/dto/wallet.dto.ts`
- `../backend/mutakamel-apps/core-app/src/admin/wallet/wallet.service.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
