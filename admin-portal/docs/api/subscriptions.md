# Subscriptions API

Status: **[Verified]**

Last source verification: **2026-08-11**

Owner: **Core**

## Routes

| Method and canonical browser path | Permissions | Purpose |
| --- | --- | --- |
| `GET /api/admin/core/v1/subscriptions` | `admin.subscriptions.read` | Paginated cross-tenant list |
| `POST /api/admin/core/v1/subscriptions/:tenantId/cancel` | `admin.subscriptions.cancel` + `admin.subscriptions.critical` | Schedule/apply cancellation |
| `GET /api/admin/core/v1/tenants/:tenantId/subscription` | `admin.subscriptions.read` | Tenant subscription detail |
| `GET /api/admin/core/v1/tenants/:tenantId/subscription/items` | `admin.subscriptions.read` | Item/entitlement lines |
| `POST /api/admin/core/v1/tenants/:tenantId/subscription` | `admin.subscriptions.create` + `admin.subscriptions.critical` | Seed tenant subscription |
| `POST /api/admin/core/v1/subscriptions/quote` | `admin.catalog.read` | Server-priced quote |
| `POST /api/admin/core/v1/subscriptions/:id/plan-change-previews` | `admin.subscriptions.update` | Preview plan change |
| `POST /api/admin/core/v1/subscriptions/:id/plan-change-previews/:previewId/apply` | `admin.subscriptions.update` + `admin.subscriptions.critical` | Apply reviewed preview |

Permission pairs use ALL semantics.

## Wire values

```ts
type BillingCycle = "MONTHLY" | "ANNUAL";

type SubscriptionStatus =
  | "TRIAL"
  | "PENDING_ACTIVATION"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELLED";
```

There is no `YEARLY` billing cycle and no `CANCELED` status.

## Quote

```ts
interface QuoteSubscriptionDto {
  billingCycle?: BillingCycle;
  currencyCode?: "USD";
  items: Array<{
    moduleId: string;
    tierId: string;
    seats: number;
  }>;
}
```

Use the server quote as authoritative. Keep prices as decimal strings and do
not calculate totals in the browser.

## List/detail behavior

Rows are under `data`; pagination total is `meta.total`. Full items and tenant
detail are independently permissioned resources. Do not infer a full
subscription from the nested tenant summary.

## Plan changes and cancellation

- Preview and apply are separate user intents with separate UUIDv7 keys.
- Display the exact server preview before apply.
- Apply uses the preview ID and can fail as stale/expired/conflicting.
- Cancellation uses
  `POST /api/admin/core/v1/subscriptions/:tenantId/cancel`, not a tenant-nested
  `/subscription/cancel` path.
- Refresh subscription, items, billing summary, and effective access after an
  authoritative change.

## Current frontend status

The tenant billing tab loads detail and canonical items independently, supports
initial subscription seed, displays the exact server-priced plan-change
preview before apply, and uses the canonical cancellation route. Every command
has a caller-owned UUIDv7 intent and refreshes subscription, collection, and
effective state after success. `/subscriptions` also provides the exact
cross-tenant directory with server pagination, permission/resource states,
bilingual copy, and focused tests.

## Source map

- `../backend/mutakamel-apps/core-app/src/admin/subscriptions/subscriptions.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/subscriptions/subscription-v1.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/subscriptions/subscription-items.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/subscriptions/dto/`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
