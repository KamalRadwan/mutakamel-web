# Core — Billing, Subscription and Branding

Status: **verified**

Last source verification: **2026-08-31**

Owning app: **core-app**

Canonical prefixes: `/api/tenant/core/v1/billing`, `.../subscription`,
`.../payments`, `.../wallet`, `.../branding`

Portal status: **built** — MASTER-PLAN Phase 6, 2026-08-31. Screens exist for
every route except `GET /wallet`, which is not called because
`GET /billing/summary` already returns the identical `WalletView`. Gap G2 is
closed: `BrandingProvider` reads `GET /branding/public` from the **root**
layout, so the tenant brand reaches the login screen as well as the shell.

A green `pnpm verify` does **not** prove this works against a real
authenticated session. Nothing here has been exercised against a live tenant,
a live payment provider or a real `primaryColor`.

Source inspected:
`core-app/src/tenant/billing/tenant-billing.controller.ts`,
`core-app/src/tenant/subscription/subscription-self-serve.controller.ts`,
`core-app/src/tenant/payments/payments.controller.ts`,
`core-app/src/tenant/branding/branding.controller.ts`,
`core-app/src/tenant/branding/dto/update-branding.dto.ts`,
`core-app/src/admin/subscriptions/dto/subscription-item.dto.ts`,
`core-app/src/common/swagger/swagger.examples.ts`.

**23 routes.** Billing 8 · Subscription 4 · Branding 7 · Payments 2 · Wallet 2.

---

## The two rules that shape every screen here

**1. These routes are owner-only, and they carry no permission strings.**

`TenantBillingController` and `SubscriptionSelfServeController` are both
`@UseGuards(TenantGuard, TenantOwnerGuard)` with **no `@RequirePermissions`**
anywhere. Access is `tenant_users.is_tenant_owner`, full stop. No role grant
can substitute for it.

So the nav predicate for every billing and subscription screen is
`user.isTenantOwner`, not a permission lookup — and a non-owner reaching the
URL gets a **403 `TENANT_OWNER_REQUIRED`** that must render `PermissionGate`,
never an empty state (task 6.20).

**2. Every money value is a decimal string.**

Render through the `Money` primitive. `Number()`, `parseFloat`, `+value` and
plain arithmetic are all forbidden — the standing rule S5. A total that is
wrong in the last decimal place is worse than no total.

---

## Billing — 8 routes

| Method | Canonical path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/billing/summary` | owner | Subscription, wallet, invoice and collection state |
| GET | `/api/tenant/core/v1/billing/invoices` | owner | `PaginationQueryDto` |
| GET | `/api/tenant/core/v1/billing/invoices/:invoiceId` | owner | One invoice, only if it belongs to the tenant |
| POST | `/api/tenant/core/v1/billing/invoices/:invoiceId/payment-quote` | owner | **201.** Immutable, short-lived |
| POST | `/api/tenant/core/v1/billing/invoices/:invoiceId/payment-intents` | owner | **201.** Idempotency-required |
| GET | `/api/tenant/core/v1/billing/invoices/:invoiceId/payment-intents/active` | owner | The authoritative hold, or `null` |
| GET | `/api/tenant/core/v1/billing/payments/:paymentId` | owner | Safe status projection |
| GET | `/api/tenant/core/v1/billing/payment-input-currencies` | owner | Currencies usable for a quote |

All carry `Cache-Control: private, no-store`.

### The two shapes the quote form needs

`GET /api/tenant/core/v1/billing/payment-input-currencies` returns
`{walletCurrencyCode,items:[{currencyCode,isBaseCurrency}],total}`.
`walletCurrencyCode` is typed `typeof BASE_CURRENCY` — it is **always USD**,
which is the same "one wallet, always USD" rule stated above, expressed in the
payload. `total` is `items.length`, not a page count; this route is not paged.

`paymentCurrencyCode` on the quote body is `@Matches(/^[A-Z]{3}$/u)` after an
upper-case trim — exactly three uppercase letters — and
must be one of `payment-input-currencies`.
The regex is a *shape* check only: a well-formed
code that is not on the list is still refused, so populate the picker from the
route rather than from any currency list you already hold.

### The payment flow, and the one thing that must not be got wrong

```text
payment-quote  →  payment-intent  →  hosted checkout  →  poll active/status
```

- The **quote** freezes a collection currency and rate for a short window. Show
  the expiry, and render the **lapsed** state as its own outcome — the user has
  to re-quote, and a silently dead button is the failure mode (task 6.21).
- The **intent** reserves the collection against that quote. It is
  `@IdempotencyRequired()`, so a replay returns the same intent with
  `Idempotency-Replayed: true`. **Render a replay as success, not as a
  duplicate.**
- **A URL success is never settlement authority.** The user comes back from the
  hosted checkout with whatever the provider put in the query string; the only
  truth is `GET .../payment-intents/active` and `GET /billing/payments/:id`.
  Poll them. Never mark an invoice paid because a redirect said so.
- The provider webhook (`POST /public/payments/webhook`) is HMAC-authenticated
  and marked `EXTERNAL_CALLBACK_DO_NOT_CALL`. **The portal never calls it.**

### Wallet and payments

| Method | Canonical path | Access |
| --- | --- | --- |
| GET | `/api/tenant/core/v1/wallet` | owner |
| GET | `/api/tenant/core/v1/wallet/ledger` | owner |
| GET | `/api/tenant/core/v1/payments` | owner |
| POST | `/api/tenant/core/v1/payments/topup` | owner, `@AllowedDuringDunning()`, idempotency-required |

**There is exactly one wallet per tenant and it is always USD.** Non-USD
amounts anywhere in this module are *display and collection* values backed by
immutable FX evidence — they are **not** a second balance. A UI that shows
"EGP balance" is wrong.

`topup` is `@AllowedDuringDunning()` on purpose: paying is exactly what a
past-due tenant needs to be able to do.

Its result cannot be read back per payment, though.
`GET /billing/payments/:paymentId` requires `purpose === INVOICE_SETTLEMENT`
and a non-null `invoiceId`, so it answers `PAYMENT_NOT_FOUND` for a top-up. The
only readback is the paginated `GET /payments` —
[Q26](../build/OPEN-QUESTIONS.md#q26--a-wallet-top-ups-status-cannot-be-read-back).

---

## Subscription — 4 routes

| Method | Canonical path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/subscription` | owner | Current subscription + lifecycle |
| GET | `/api/tenant/core/v1/subscription/items` | owner | Modules, tiers, seats, accepted prices |
| POST | `/api/tenant/core/v1/subscription/plan-change-previews` | owner | **201.** Idempotency-required |
| POST | `/api/tenant/core/v1/subscription/plan-change-previews/:previewId/apply` | owner | **200.** Idempotency-required |

### Add-or-increase only

`CreateSubscriptionPlanChangePreviewDto` takes an `operation`, and the service
**rejects fields that do not belong to the chosen operation**. `seats` is
required for `ADD` and must be ≥1; `itemId` is required for everything except
`ADD`.

**The API has no downgrade path.** A UI that offers "reduce seats" or "remove
module" and then surfaces a rejection is a worse experience than not offering
it. Show the ceiling honestly and route reductions to support.

**And no upgrade path it can drive, either.** `ADD` needs a module *and* a tier
identifier, and there is no tenant-facing route that enumerates either — the
catalogues are behind `AdminGuard`. The portal therefore expresses only
`operation: CHANGE` with `itemId` + `seats`, and says plainly that adding a
module or moving to a higher tier goes through support. See
[Q25](../build/OPEN-QUESTIONS.md#q25--no-tenant-facing-module--tier-catalogue-for-a-plan-change).

The preview is **durable, owner-bound and price-frozen**, and it expires.
`apply` revalidates collection, price and wallet before committing, so a stale
preview fails at apply time — show the countdown on the preview screen.

### Subscription status has **five** values, not four

`PENDING_ACTIVATION` · `TRIAL` · `ACTIVE` · `PAST_DUE` · `CANCELLED`

An earlier draft of the plan listed four. The access mode each maps to comes
from `SubscriptionEnforcementGuard`, **not** from the status name:

| Status | Access mode |
| --- | --- |
| `TRIAL`, `ACTIVE` (period valid) | `FULL` |
| `TRIAL`, `ACTIVE` (period expired) | `READ_ONLY` |
| `PAST_DUE` | `DUNNING` — writes blocked except `@AllowedDuringDunning()` |
| `CANCELLED` | `READ_ONLY` |
| `PENDING_ACTIVATION` | `BLOCKED` |

**While `PAST_DUE`, only the tenant owner can sign in at all** — the login path
itself refuses everyone else with `SUBSCRIPTION_PAST_DUE`. That is a login-screen
state, not just a banner (task 6.14).

---

## Branding — 7 routes

| Method | Canonical path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/branding/public` | **`@Public()`** | Pre-auth projection |
| GET | `/api/tenant/core/v1/branding/public/logo` | **`@Public()`** | Binary, `public, max-age=300` |
| GET | `/api/tenant/core/v1/branding/public/icon` | **`@Public()`** | Binary, same headers |
| GET | `/api/tenant/core/v1/branding` | `branding.read` | Full settings |
| PUT | `/api/tenant/core/v1/branding` | `branding.manage` | `UpdateBrandingDto` |
| POST | `/api/tenant/core/v1/branding/logo` | `branding.manage` | multipart, idempotency-required |
| POST | `/api/tenant/core/v1/branding/icon` | `branding.manage` | multipart, idempotency-required |

### The public payload — exactly these fields

```text
primaryColor · secondaryColor · fontFamily · appName · tabTitle · loginHtml
logoUrl · iconUrl
```

**There are no storage keys in it.** An earlier draft of MASTER-PLAN invented
`logoStorageKey` and `iconStorageKey`; they do not exist.

`logoUrl` and `iconUrl` do — corrected 2026-08-31 against
`BrandingService.getPublic()`, which returns **eight** fields, and against the
Swagger example in `branding.controller.ts`. They are same-origin **paths** to
the two public binary routes (`/api/tenant/core/v1/branding/public/logo` and
`.../icon`), or `null` when no asset is stored or storage is unavailable. The
bytes stream through Core, so no Storage credential ever reaches the browser —
which is the property the "no storage keys" rule was protecting, and it still
holds. The portal validates both fields against those two exact constants
rather than treating them as free-form URLs. See
[Q27](../build/OPEN-QUESTIONS.md#q27--publicbrandingview-carries-two-fields-the-contract-page-omits).

The three public routes are the ones the **login screen** needs, because they
resolve from the host before anyone has authenticated.

### Upload limits, and their distinct failures

2 MB, `png`/`jpeg`/`webp`. Three separate outcomes, three separate messages:

| Code | Status | Means |
| --- | --- | --- |
| `BRANDING_FILE_REQUIRED` | 400 | No file part in the multipart body |
| `BRANDING_FILE_TYPE_UNSUPPORTED` | **415** | Wrong MIME |
| `BRANDING_FILE_TOO_LARGE` | **413** | Over 2 MB |

### Wiring branding into the token layer — the guard that must not be skipped

Task 6.17 makes `--color-brand-*` tenant data at runtime. **Three** semantic
tokens consume that ramp: `--primary`, `--ring` and `--sidebar-active`.

A tenant's `primaryColor` must not be allowed to break contrast. Derive the
ramp the way Phase 0 does — hold lightness, fit chroma to the sRGB gamut — then
**re-check the fill pair before applying**. If it cannot reach 4.5:1, fall back
to the system brand and say so in the settings screen.

Note what this costs: from the moment branding is live, `scripts/design/contrast.mjs`
proves nothing about what a real tenant sees. It is a build-time Node script
over static tokens. The runtime checker (task 13.26) is not optional.

---

## Portal status per screen

| Screen | Plan task | State |
| --- | --- | --- |
| `/core/billing` summary | 6.1 | built |
| `/core/billing/invoices` + detail | 6.2–6.3 | built |
| Payment quote / intent / status | 6.4–6.7 | built |
| Wallet top-up + history | 6.8–6.10 | built |
| `/core/subscription` | 6.11–6.13, 6.19 | built; seat increase only (Q25) |
| Dunning surface | 6.14 | built |
| `/core/settings/branding` | 6.15–6.16 | built |
| Branding → tokens | 6.17–6.18 | built (G2 closed) |

### The runtime contrast guard, measured

`src/lib/branding/brand-ramp.ts` derives the ramp the way Phase 0 does — hold
each step's OKLCH lightness, keep the tenant's hue, bisect chroma to the sRGB
gamut — then re-measures all six token pairs before applying anything.

The guard is not decorative. Scanning all 360 hues, the light primary fill
(`white` on `brand-600`) bottoms out at **4.32:1 around hue 143**, so an
ordinary brand green such as `#16a34a` is refused at 4.34:1 and falls back to
the system brand, with the reason stated on the settings screen. Every other
pair clears its threshold at every hue.
