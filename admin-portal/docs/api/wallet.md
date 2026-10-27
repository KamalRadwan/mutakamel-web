# Wallet and Ledger API

Status: **[Verified]**

Last source verification: **2026-08-11**; tenant ledger loader reverified **2026-10-18** (CXADMIN-110); confirmation recovery source reviewed **2026-10-18** (CXADMIN-104).

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

### Unresolved confirmation recovery

Before dispatch, the portal persists only the actor ID, tenant ID, original
quote ID, trimmed audit note and UUIDv7 key in browser local storage. The
actor/tenant storage key survives navigation and reload. It contains no auth
credential, wallet snapshot or FX calculation. A different actor or tenant
cannot load or replay that record through the workspace. Recovery still
requires current `admin.wallet.manage` + `admin.wallet.critical` authority.

An unresolved command blocks replacement previews, draft editing and dismissal.
The bilingual recovery notice remains available even if wallet/currency reads
fail. Explicit recovery submits the identical quote, note and key; it does not
request another quote or accept a changed note. Quote expiry blocks only a
first submission. Core checks for the original wallet/key ledger entry before
quote consumption, so an exact committed replay returns that entry after
expiry without another debit or credit.

Successful exact replay clears the record and refreshes billing data. A Core
`409 FX_QUOTE_EXPIRED` without a session-change outcome marker also clears it:
the replay lookup found no ledger entry and the unconsumed expired quote can
no longer commit. Other failures retain the original record, including auth,
transport, server, in-flight, consumption and key-reuse conflicts. A generic
4xx or a ledger-page refresh alone is not authoritative reconciliation.

Storage read/validation/write failure blocks confirmation before dispatch;
refresh retries the storage read. An invalid record is retained for investigation
and is never silently replaced. Recovery remains browser-local; this is source
integration, with specs added but not run. Automated and authenticated runtime
verification remain lead gates.

| Local error code | Operator feedback (English / Arabic) |
| --- | --- |
| `WALLET_CONFIRM_UNRESOLVED` | Recover the original adjustment before starting another / استعد التعديل الأصلي قبل بدء تعديل آخر |
| `WALLET_RECOVERY_UNAVAILABLE` | Restore browser storage access and refresh; preserve unresolved evidence / أعد إتاحة تخزين المتصفح ثم حدّث الصفحة مع الاحتفاظ بالسجل غير المحسوم |

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

Each ledger load makes one `GET /tenants/:tenantId/wallet/ledger` request.
Core resolves the tenant's canonical wallet before reading its ledger; the
portal validates the envelope, pagination, row shapes and UUIDv7 wallet IDs,
and rejects a page containing different wallet IDs. It does not fetch the
wallet-ID projection to compare independent snapshots. An insertion between
loads can therefore change the entries and totals without a false contract
error. Empty and nonempty pages follow the same single-request path, preserving
page/limit and the caller's abort signal. Regression specs cover these cases
and malformed responses; automated checks and authenticated runtime remain
pending lead verification.

## Source map

- `../backend/mutakamel-apps/core-app/src/admin/wallet/wallet.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/wallet/dto/wallet.dto.ts`
- `../backend/mutakamel-apps/core-app/src/admin/wallet/wallet.service.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
