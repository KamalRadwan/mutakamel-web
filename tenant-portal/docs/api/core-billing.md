# Core — Billing, Subscription and Branding

Status: **verified**

Last source verification: **2026-08-31**

Owning app: **core-app**

Canonical prefixes: `/api/tenant/core/v1/billing`, `.../subscription`,
`.../payments`, `.../wallet`, `.../branding`

Portal status: **not-started** — MASTER-PLAN Phase 6. No screen calls any of
these. The one exception is the *idea* of branding: nothing reads it yet
(gap G2).

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
```

**There are no storage keys in it.** The logo and icon are separate binary
routes, streamed through Core so no Storage credential ever reaches the
browser. An earlier draft of MASTER-PLAN invented `logoStorageKey` and
`iconStorageKey` — they do not exist. This is the field list; verify against
`update-branding.dto.ts` before adding to it.

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
| `/core/billing` summary | 6.1 | not started |
| `/core/billing/invoices` + detail | 6.2–6.3 | not started |
| Payment quote / intent / status | 6.4–6.7 | not started |
| Wallet top-up + history | 6.8–6.10 | not started |
| `/core/subscription` | 6.11–6.13, 6.19 | not started |
| Dunning surface | 6.14 | not started |
| `/core/settings/branding` | 6.15–6.16 | not started |
| Branding → tokens | 6.17–6.18 | not started (gap G2) |
