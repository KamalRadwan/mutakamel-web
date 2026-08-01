# Tenant currencies, taxes, and numbering API

> **Contract status:** Current
> **Last verified:** 2026-07-25
> **Backend owner:** Core (`core-app`)
> **Canonical browser prefixes:** `/api/tenant/core/v1/currencies`, `/api/tenant/core/v1/taxes`, `/api/tenant/core/v1/numbering`
> **Controller-relative prefixes:** `/tenant/currencies`, `/tenant/taxes`, `/tenant/numbering`
> **Tenant Portal status:** Planned. The legacy tenant settings page has a live partial client for these resources.
> **Documentation:** Hand-written and source-verified; not generated.

## Source of truth

- Gateway route contracts: `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- Currency controller/DTO/service: `../backend/mutakamel-apps/core-app/src/tenant/currencies`
- Tax controller/DTO/service: `../backend/mutakamel-apps/core-app/src/tenant/taxes`
- Numbering controller/DTO/service: `../backend/mutakamel-apps/core-app/src/tenant/numbering-sequences`
- Legacy client/page: `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/settings`

## Common contract and pagination

All routes require a tenant JWT, matching verified host, active session/subscription, and the listed permission. Company-scoped tax/numbering data is further filtered by the actor's authorized company/branch scope.

List routes accept common pagination: `page` (default 1), `limit` (default 20, maximum 100), `search` (maximum 200), endpoint-whitelisted `sortBy`, and `sortDir=ASC|DESC`. A paginated success has `data` as the item array and:

```json
{"meta":{"page":1,"limit":20,"total":1,"totalPages":1,"hasNext":false,"hasPrev":false}}
```

Core strips/rejects unknown request fields. Errors use the standard Core error envelope. None of these commands declares application-level idempotency; do not blindly replay an ambiguous create/update.

Security is tenant/session/permission plus company-scope authorization. Reads are private tenant configuration; do not place them in a shared cache. All documented commands are synchronous and return the resulting resource or `204`; there is no client-polled async job.

## Currencies

| Method and canonical path | Permission | Notes |
|---|---|---|
| `POST /api/tenant/core/v1/currencies` | `currencies.currency.manage` | Create |
| `GET /api/tenant/core/v1/currencies` | `currencies.currency.read` | Paginated; filters `status`, strict `isDefault` |
| `PATCH /api/tenant/core/v1/currencies/:id` | `currencies.currency.manage` | Update |
| `POST /api/tenant/core/v1/currencies/:id/set-default` | `currencies.currency.manage` | Make active currency the default |
| `DELETE /api/tenant/core/v1/currencies/:id` | `currencies.currency.manage` | `204`, deactivate |

All IDs are UUIDv7. Create accepts `code` (exactly 3, uppercased, runtime-recognized ISO-4217), `name` (maximum 80), `symbol` (maximum 8), `decimalPlaces` (integer 0–8), `exchangeRate` (positive, maximum 8 decimal places), and optional `isDefault`. The first currency becomes default. A non-default currency requires an exchange rate; the default rate is `1`.

Update accepts `name`, `symbol`, `decimalPlaces`, `exchangeRate`, and `status`. Status wire values are `ACTIVE` and `INACTIVE`.

Expected errors: `CURRENCY_CODE_INVALID`, `CURRENCY_CODE_TAKEN`, `CURRENCY_NOT_FOUND`, `CURRENCY_EXCHANGE_RATE_REQUIRED`, `CURRENCY_DEFAULT_DELETE`, `CURRENCY_INACTIVE_DEFAULT`, and `CURRENCY_IN_USE`.

## Taxes

| Method and canonical path | Permission | Notes |
|---|---|---|
| `POST /api/tenant/core/v1/taxes` | `taxes.tax.manage` | Create |
| `GET /api/tenant/core/v1/taxes` | `taxes.tax.read` | Paginated; filters `status`, `companyId`, strict `isInclusive` |
| `PATCH /api/tenant/core/v1/taxes/:id` | `taxes.tax.manage` | Update |
| `DELETE /api/tenant/core/v1/taxes/:id` | `taxes.tax.manage` | `204`, deactivate |

Create accepts `code` (trimmed/uppercased, maximum 32), `name` (maximum 120), `rate` (0–100, maximum 4 decimal places), `isInclusive` (boolean), and optional `companyId` (UUIDv7). Update accepts `name`, `rate`, `isInclusive`, and `status`; status is `ACTIVE|INACTIVE`.

Expected errors: `TAX_NOT_FOUND`, `TAX_CODE_TAKEN`, `TAX_IN_USE`, `COMPANY_INVALID`, and `PERMISSION_SCOPE_UNAVAILABLE`.

## Numbering sequences

| Method and canonical path | Permission | Notes |
|---|---|---|
| `POST /api/tenant/core/v1/numbering` | `numbering.manage` | Create |
| `GET /api/tenant/core/v1/numbering` | `numbering.read` | Paginated; filters `companyId`, exact `code` |
| `PATCH /api/tenant/core/v1/numbering/:id` | `numbering.manage` | Update |
| `GET /api/tenant/core/v1/numbering/:code/peek?companyId=...` | `numbering.read` | Preview only; does not reserve or consume |

Create accepts:

- `code`: uppercased, 1–64, pattern `^[A-Z0-9][A-Z0-9._:-]{0,63}$`.
- `prefix`: optional string, maximum 16.
- `padding`: integer 1–12.
- `startValue`: integer at least 1.
- `companyId`: optional UUIDv7.

Update accepts `prefix`, `padding`, and `nextValue` (integer at least 1). Core rejects attempts to move the sequence behind an already-issued value. `peek` takes the sequence code in the path and optional UUIDv7 `companyId`.

Expected errors: `SEQUENCE_NOT_FOUND`, `SEQUENCE_VALUE_INVALID`, `SEQUENCE_CODE_TAKEN`, `COMPANY_INVALID`, and `PERMISSION_SCOPE_UNAVAILABLE`.

Safe read example:

```http
GET /api/tenant/core/v1/currencies?page=1&limit=20&sortBy=code&sortDir=ASC
Authorization: Bearer <tenant-access-token>
```

Validation is performed by the DTOs listed above and by database/domain checks. Non-paginated JSON uses `{success:true,data,correlationId,timestamp}`; errors use the standard Core error envelope.

## AI implementation rules

- Use decimal strings exactly as returned; do not convert money/exchange rates through binary floating point.
- Populate currency pickers from tenant currency APIs, not a client-authored allowlist.
- Treat enum values as case-sensitive wire values.
- Never use `peek` to promise uniqueness; only the owning server transaction may consume a sequence.
