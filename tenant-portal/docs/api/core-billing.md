# Core — Billing, Subscription and Branding

Status: **verified**

Last source verification: **2026-10-29** (subscription authority and preview flow;
other domains retain their separately dated evidence).

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

**29 routes.** Billing 8 · Subscription 10 · Branding 7 · Payments 2 · Wallet 2.

---

## The two rules that shape every screen here

**1. Financial access requires the owner; pure definition adoption has separate authority.**

Billing, wallet, payments and subscription detail/items remain owner-only.
Subscription commands and history authorize the actual or retained original
purpose: ordinary purchases require the current owner; pure definition adoption
admits the owner or a tenant-wide `applications.addon_definitions.adopt` grant,
with affected-Company checks at the boundaries described below. Company- or
Branch-scoped grants alone do not admit adoption. Branding has its own public
and permissioned routes.

Keep owner predicates on financial screens and use `canAdoptDefinitions(user)`
for adoption entry and hooks. Actual server 403 renders `PermissionGate`, never
an empty state. Adoption must neither expose owner-only money reads nor inherit
an owner-only UI gate.

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

### Negotiated invoice detail — accepted cutover

Last source verification for this addition: **2026-09-09**. Existing detail route
`core.tenant.billing.invoices.get` uses the same closed canonical `InvoiceRead`
evidence as Admin, without a commercial version header or payload discriminator.
Owner authority is checked again by the retained reader; Company/Branch
authority is not a substitute. The heading anchor is retained for existing links.

Source: `tenant/billing/tenant-invoice-read.{service,transport,openapi}.ts`,
`admin/invoices/invoice-commercial-read.{contract,openapi}.ts`,
`admin/invoices/accepted-invoice-source.ts`. The response is bounded to4MiB,
has no query/body/idempotency or Company/Branch selectors, and preserves exact
recorded identity, accepted seat and complete pricing evidence. Only genuine
MANUAL invoices may contain homogeneous lines with null source identity/pricing;
their quantity and original amount arithmetic still must match. Missing retained
commercial evidence fails closed. No current catalogue reconstruction is allowed.
Original invoice amounts and nullable USD settlement amounts are distinct;
no outstanding amount is returned by this projection.

Prior Core/Gateway image and test handoffs belong to their dated source snapshots.
The existing invoice fetch now uses the canonical adapter and retained evidence
card. Payment contracts remain unchanged. Current verification limits are in
[the canonical delivery record](catalogue-canonical-delivery.md); no authenticated
Tenant browser or current control-plane state is asserted here.

TenantUserProfile/AuthContext exposes no independent tenantId. Live parsing pins
the exact invoice selector and validates the persisted tenant UUID structurally;
the accepted owner-scoped server enforces tenant isolation. Never manufacture an
expected tenantId from the response itself. An independently supplied tenantId
must match exactly. The hook fences actor/session, owner/auth state, target and
refresh; actual403 replaces stale facts with the owner-denial boundary.

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

Top-up retry behaviour updated **2026-10-18**: while the billing screen remains
mounted, a failed submission retains its UUIDv7 idempotency key and exact trimmed
amount/currency payload. Retrying the same values recovers the original payment
and hosted checkout even when the creation response was lost. Changing either
value starts a new intent; a confirmed success clears the retained request, so
submitting again after dismissing that checkout starts a new intent too.
Concurrent submissions are ignored while a request is in flight.

Its result cannot be read back per payment, though.
`GET /billing/payments/:paymentId` requires `purpose === INVOICE_SETTLEMENT`
and a non-null `invoiceId`, so it answers `PAYMENT_NOT_FOUND` for a top-up. The
only readback is the paginated `GET /payments` —
[Q26](../build/OPEN-QUESTIONS.md#q26--a-wallet-top-ups-status-cannot-be-read-back).

---

## Subscription — 10 routes

**Canonical flow update, 2026-10-29:** [Subscription/Addons](subscription-addons.md)
supplies detail/items and complete retained parent/Addon prices in the subscription workspace.
[Published offer enumeration](subscription-offers.md) is also implemented as a read-only owner explorer.
[Canonical delivery](catalogue-canonical-delivery.md) documents the mounted purchase
preparation, quote, apply and recovery flow. [Definition adoption](definition-adoption.md)
uses price-free discovery and shared purpose-aware command/history routes.

| Method | Canonical path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/subscription` | owner | Current subscription + lifecycle |
| GET | `/api/tenant/core/v1/subscription/items` | owner | Modules, tiers, seats, accepted prices |
| GET | `/api/tenant/core/v1/subscription/definition-adoption-selections` | adoption admission | Price-free selections; optional `after` cursor |
| GET | `/api/tenant/core/v1/subscription/definition-adoption-selections/:addonSelectionId/targets` | adoption admission | Published candidates; optional `after` cursor; no apply authority |
| GET | `/api/tenant/core/v1/subscription/operations/:operationId` | retained-purpose authority | Current progress; adoption status exposes no Company/configuration data |
| GET | `/api/tenant/core/v1/subscription/plan-change-previews/:previewId/receipt` | retained-purpose authority + adoption Company checks | Original immutable receipt; progress read separately |
| POST | `/api/tenant/core/v1/subscription/preparations` | command-purpose authority | **202.** Retained operation; idempotency-required |
| POST | `/api/tenant/core/v1/subscription/plan-change-previews` | command-purpose authority + adoption Company checks | **201.** Exact prepared request; idempotency-required |
| POST | `/api/tenant/core/v1/subscription/plan-change-previews/:previewId/apply` | retained-purpose authority + adoption Company checks | **200.** Empty `{}` body; idempotency-required |
| POST | `/api/tenant/core/v1/subscription/operations/:operationId/recovery` | retained-purpose authority + adoption recovery Company checks | **202.** Expected revision, action and reason; idempotency-required |

All ten routes use `TenantGuard`. Detail/items additionally use `TenantOwnerGuard`
and `SubscriptionCommercialReadGuard`. The other eight declare
`@RequireTenantWidePermissions('applications.addon_definitions.adopt')`: the
current owner is the administrative exception; non-owners need a genuine TENANT
grant. Domain guards/services authorize the complete command or retained original
purpose, so that grant never permits an ordinary financial purchase.

Adoption admission means owner or that tenant-wide grant with current session
checks. PREPARE independently checks the target, source and required authority.
Adoption preview, apply and full receipt require current authority over the
complete affected-Company manifest; dispatching recovery checks every Company
already discovered. Operation status needs Tenant adoption authority without
exposing Company data. Authorization is rechecked on replay and history reads;
saved commands and receipts do not grant current operational access.

### Add-or-increase only

Accessibility update **2026-10-29** (AUDIT29-TP-5): purchase and definition
adoption keep a stable page-heading focus destination when preparation, quote,
apply or starting another change removes its trigger. Confirmed preparation,
quote and receipt outcomes update a persistent polite status region in Arabic
and English. An aborted operation or unresolved request is not announced as an
applied change.

The canonical preparation body is `{expectedSubscriptionRevision,changes,reason?}`.
The preview body adds the actual `preparationId`; apply sends exactly `{}`.
Ordered change rows use the actual Application/Addon ADD or CHANGE selectors.
The removed flat single-item DTO and seat-only browser adapter are not supported.

Presentation update, source reviewed **2026-10-29** (AUDIT29-TP-4): purchase
review and quotes show `Application · Tier` or `Application · Addon` names.
The subscription's retained Application/tier names and validated published
catalogue names are transient display evidence; selected cart offer names remain
available through preparation and quote. UUIDs and command keys are grouped in
collapsed, keyboard-operable **Technical identifiers** disclosures (Arabic and
English). Prices and confirmation eligibility still come from the retained quote.
Names never enter the command payload or persisted intent journal.

Optional name discovery is owner-only, aborts on session change, and reads at
most ten catalogue pages of 100 offers. Missing catalogue matches or failed
discovery use known subscription/discovery keys, then a translated resource
label, so a restored intent remains readable without exposing UUIDs as names.
Non-owner definition adoption keeps its existing scoped reads and key fallback;
it does not call the owner-only catalogue for labels.

**The API has no downgrade path.** A UI that offers "reduce seats" or "remove
module" and then surfaces a rejection is a worse experience than not offering
it. Show the ceiling honestly and route reductions to support.

The `/core/subscription/change` editor supports new Application/Addon purchases,
existing quantity increases and Application tiers with nondecreasing actual rank.
It consumes the real preparation and quote before explicit apply. Published
PREPARATION_REQUIRED is discovery only; the complete retained quote supplies
every displayed financial total. Current owner, subscription, readiness and
wallet checks remain authoritative. See [canonical purchase flow](catalogue-canonical-delivery.md#mounted-ordinary-purchase-editor).

The preview is **durable, owner-bound and price-frozen**, and it expires.
The preview screen displays priced-at and expiry timestamps. Local expiry
tracking disables confirmation when it expires; the display has no live countdown.
Purchase `apply` revalidates collection, price and wallet before committing, so
a stale preview can still fail at apply time. Pure definition adoption preserves
accepted prices and has no wallet settlement. Only the actual
`SUBSCRIPTION_PLAN_CHANGE_PREVIEW_EXPIRED` apply rejection permits a new preview
of the same preparation; uncertain apply retains its original key/body.

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

Shell update verified **2026-10-17**: successful settings saves and logo/icon
uploads publish their validated response to the root `BrandingProvider`. The
existing shell name and contrast-checked color tokens update immediately;
reset or rejected colors restore system tokens. Local UUIDv7 asset query keys
receive `no-cache` from the public routes for the shared logo and tab icon.
A late initial public-branding read cannot overwrite a successful local write.

Settings form serialization reviewed **2026-10-30**: saves compare the four editable
fields with the loaded settings. Unchanged fields are omitted; clearing a stored
value sends `null`, which Core persists as a reset. `fontFamily` and `loginHtml`
are always omitted, preserving their stored values. The form has no font input:
the portal uses its bundled bilingual fonts. App name and tab title are limited to 120 characters and
overlong values fail inline validation before a request; no text is truncated.
Both colors accept only supported hex values (up to 9 characters), or a reset.

| Method | Canonical path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/branding/public` | **`@Public()`** | Pre-auth projection |
| GET | `/api/tenant/core/v1/branding/public/logo` | **`@Public()`** | Binary; matching key hash `v` is immutable for one year, otherwise `no-cache` |
| GET | `/api/tenant/core/v1/branding/public/icon` | **`@Public()`** | Binary, same headers |
| GET | `/api/tenant/core/v1/branding` | `branding.read` | Full settings |
| PUT | `/api/tenant/core/v1/branding` | `branding.manage` | `UpdateBrandingDto` |
| POST | `/api/tenant/core/v1/branding/logo` | `branding.manage` | multipart, idempotency-required |
| POST | `/api/tenant/core/v1/branding/icon` | `branding.manage` | multipart, idempotency-required |

### The public payload — exactly these fields

The portal projection ignores `loginHtml`; it is neither parsed nor carried in
the shared branding context. The backend payload still includes it.

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
`.../icon`), followed by `?v=<hash>`, or `null` when no storage key is set. The
bytes stream through Core, so no Storage credential ever reaches the browser —
which is the property the "no storage keys" rule was protecting, and it still
holds. Source verified **2026-10-29**: the hash is the first 16 lowercase hex
characters of SHA-256 of the storage key and changes on key replacement. The
binary response emits that hash as a quoted `ETag`; only an exactly matching
`v` receives `public, max-age=31536000, immutable`. Missing, malformed and stale
versions receive `no-cache`. The portal validates both fields against the exact
paths, optionally followed by only `?v=<16 lowercase hex>`, rather than treating
them as free-form URLs. See
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
| `/core/billing/invoices` + detail | 6.2–6.3 | list unchanged; detail uses canonical InvoiceRead with complete retained App/Addon evidence |
| Payment quote / intent / status | 6.4–6.7 | built |
| Wallet top-up + history | 6.8–6.10 | built |
| `/core/subscription` | 6.11–6.13, 6.19 | canonical retained App/Addon read; links to the canonical preparation/quote/apply editor at `/core/subscription/change` |
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
