# Core — Workspace Settings and Catalogues

Status: **verified**

Last source verification: **2026-11-02**

Owning app: **core-app**

Canonical prefixes: `/api/tenant/core/v1/workspace-settings`, `.../currencies`,
`.../taxes`, `.../numbering`, `.../email-config`, `.../notifications`

Portal status: **built** — all six screens ship in MASTER-PLAN Phase 5. Every
route on this page is called except the three alias halves the portal
deliberately does not use (`POST /:id/ack`, `POST /mark-all-read`,
`POST /:id/dismiss`).

Source inspected:
`core-app/src/tenant/workspace-settings/workspace-settings.controller.ts`,
`core-app/src/tenant/currencies/currencies.controller.ts`,
`core-app/src/tenant/taxes/taxes.controller.ts`,
`core-app/src/tenant/numbering-sequences/numbering-sequences.controller.ts`,
`core-app/src/tenant/email-config/tenant-email-config.controller.ts`,
`core-app/src/tenant/notifications/notifications.controller.ts`,
and each module's `dto/` folder.

**33 routes.** Workspace 2 · Currencies 5 · Taxes 4 · Numbering 4 ·
Email config 4 · Notifications 14.

Everything under [core-identity.md § What applies to every route](core-identity.md#what-applies-to-every-route-on-this-page)
applies here too — `TenantGuard`, AND-semantics permissions, `forbidNonWhitelisted`,
UUID v7, the `data` envelope.

## Paginated response envelope and empty-list metadata

Source-verified **2026-11-01** against
`../backend/mutakamel-apps/shared-libs/packages/common/src/interceptors/response-envelope.interceptor.ts`,
`../backend/mutakamel-apps/shared-libs/packages/database/src/repositories/base.repository.ts`,
and `../backend/mutakamel-apps/shared-libs/packages/database/src/query-engine/query-result.helpers.ts`.

Every paginated Core HTTP list endpoint (`GET /api/tenant/core/v1/currencies`,
`GET /api/tenant/core/v1/taxes`, `GET /api/tenant/core/v1/numbering`,
`GET /api/tenant/core/v1/organization/companies`, and
`GET /api/tenant/core/v1/provisioning/updates`) wraps its internal
`PaginatedResult<T>` through `ResponseEnvelopeInterceptor` into the canonical
wire shape:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0,
    "hasNext": false,
    "hasPrev": false
  },
  "correlationId": "01902001-…",
  "timestamp": "2026-11-01T10:00:00.000Z"
}
```

- **Paginated reads MUST use `readCorePage`** (`src/lib/api/envelope.ts`) paired
  with `parseCorePage` or `parseCorePageMeta`
  (`src/app/(tenant)/core/contracts/core-page.ts`). Do not read paginated Core
  endpoints through `coreGet` or `readCoreData`: both unwrap `body.data` (`T[]`)
  and discard `body.meta`. Never mock internal `{ items, total, page, limit }`
  repository shapes at the HTTP client boundary.
- **Singleton reads retain `coreGet`** (`src/app/(tenant)/core/core-api.ts`)
  where response headers or status are required (such as strong `ETag` revisions
  on `GET /api/tenant/core/v1/email-config`), or `readCoreData` where only the
  unwrapped `data` object is needed (`GET /api/tenant/core/v1/branding`).
- **Legitimate zero-total `meta.hasPrev` variance on `page > 1`.** When
  `total === 0` and `page > 1`, Core currently has two live code paths:
  `BaseRepository.envelope` emits `hasPrev: true` (`page > 1`), whereas
  `@mutakamel/database` `emptyPage` (returned when company/branch scope resolves
  to empty in `TaxesService`, `NumberingSequencesService`,
  `OrganizationService`, and `TenantUsersService`) emits `hasPrev: false`.
  `parseCorePageMeta` accepts both booleans **only** when `total === 0 && page > 1`,
  while strictly requiring `hasPrev: false` on `page === 1` and `hasPrev: true`
  whenever `total > 0 && page > 1`
  ([Q141](../build/OPEN-QUESTIONS.md#q141--core-empty-list-pagination-metadata-emits-two-hasprev-values)).
- **Out-of-range pages (`page > totalPages`) are valid only when `data` is empty.**
  `parseCorePageMeta` accepts `page > totalPages` when `itemCount === 0` —
  both when `total > 0` (`hasPrev: true`) and when `total === 0` under either
  documented `hasPrev` variant — so list hooks can recover from stale page
  numbers after deletions or filter changes. Non-empty out-of-range responses
  (`page > totalPages && itemCount > 0`) are rejected.

---

## Email suppression lookup and lift (source verified 2026-10-23)

Workspace email settings includes a separate look-up-and-lift form requiring
tenant-wide `workspace.email.manage`. It works independently of the email
configuration read. Suppressions store only hashes, so there is no address list.

- POST `/api/tenant/core/v1/email-suppressions/lookup` with only `{ address }`.
- POST `/api/tenant/core/v1/email-suppressions/lift` with the same body after
  confirmation and a caller-owned UUIDv7 `x-idempotency-key`.
- Both responses use Core's `success/data` envelope. Lookup returns
  `{ suppressed: false }` or `{ suppressed: true, reasonCode, firstOccurredAt,
  lastOccurredAt }`; reasons are `HARD_BOUNCE` and `COMPLAINT`.
  Lift returns `{ suppressed: false, lifted: boolean }`.

The form uses local DTO types and runtime validators. Address edits clear
previous evidence and confirmation. Requests use no-store caching; addresses
remain only in component memory and request bodies, never URLs, query strings,
logs or browser storage. A failed lift retains its exact key in memory for a
confirmed retry of the same address; edits/unmount discard it. Session changes
remount the form and abort pending requests. Lift success distinguishes a
removed suppression from one already absent; it does not resend mail or remove
platform restrictions.

Arabic/English labels, reason text and locale-formatted dates are provided.
403 renders PermissionGate; 400/422 show the translated address error, 429
asks the user to wait, and network/malformed/other failures show a translated
retry message without rendering server text or claiming success.
Local validation code `INVALID_SUPPRESSION_RESPONSE` maps to the same safe
failure message (`emailSuppression.errors.failed`); it is not a backend code.

Source: Gateway `core-email-suppression.route-contracts.ts`, Core
`tenant/email-suppression/email-suppression.controller.ts` and DTOs.
Typecheck, lint, specs and authenticated live verification remain lead gates.

## Shared company choices for taxes and numbering

Company pickers in taxes and numbering (verified **2026-10-30**) read active
companies sequentially in pages of 100 until the reported total is reached,
up to 1,000 rows. Reads and retries are abortable; a new retry cancels the prior
read and unmount cancels pending work. Options are published only after a
complete bounded read. Failures retain the last successful options and show a
localized inline error with retry, independently of the settings table and
write permission projection. A separate notice explains truncation at 1,000.
Unresolved company names use the localized “Unknown company” label, including
duplicate-code messages, and never expose the company UUID as a name.

## Workspace settings — 2 routes

| Method | Canonical path | Permission | Body |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/workspace-settings` | `workspace.read` | — |
| PUT | `/api/tenant/core/v1/workspace-settings` | `workspace.manage` | `UpdateWorkspaceSettingsDto` |

`UpdateWorkspaceSettingsDto` — every field optional:

| Field | Rule |
| --- | --- |
| `defaultLanguage?` | trim + lowercase, must be one of the supported set, ≤8 |
| `defaultCurrencyCode?` | trim + **uppercase**, exactly 3 characters |
| `timezone?` | trim, non-empty, ≤48 |
| `allowSupport?` | strict boolean — `"true"`/`"false"` accepted, arbitrary truthy strings are not |

**A missing provisioning row answers `TENANT_NOT_READY`.** That is a real state
for a freshly-created tenant, not an error to swallow — render it as "your
workspace is still being prepared", not as a failed save.

The currency must already exist in the tenant catalogue and be active; the
timezone and language are validated server-side. Each is a 422 with its own
code, not a generic failure. When the actor holds `currencies.currency.read`,
`src/app/(tenant)/core/settings/workspace/currency-options.ts` loads active
currencies through `readCorePage` + `parseCorePageMeta` in pages of 100 (up to
500 rows) to populate the default-currency picker.

### Self-service component updates — 3 routes

| Method | Canonical path | Permission | Body / query |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/provisioning/updates` | `workspace.read` (tenant-wide) | `TenantAvailableUpdateQueryDto` |
| POST | `/api/tenant/core/v1/provisioning/updates/apply` | `workspace.manage` (tenant-wide) | `ApplyTenantProvisioningUpdatesDto` |
| GET | `/api/tenant/core/v1/provisioning/operations/:operationId` | `workspace.read` (tenant-wide) | — |

All three endpoints enforce `@RequireTenantWidePermissions` and set
`Cache-Control: private, no-store`. `GET /provisioning/updates` is enveloped by
`ResponseEnvelopeInterceptor` as `{ data: TenantAvailableUpdate[], meta }` and
validated with `readCorePage` + `parseCorePageMeta`; the service-internal
`checkedAt` field is stripped by the paginated envelope and is intentionally not
displayed or fabricated in the portal
([Q142](../build/OPEN-QUESTIONS.md#q142--provisioning-updates-checkedat-is-dropped-by-responseenvelopeinterceptor)).
`POST /provisioning/updates/apply` returns
`202 Accepted` and requires a caller-supplied UUIDv7 `x-idempotency-key`,
revalidating each selected component's current applied release and SHA-256
manifest checksum before enqueueing a tenant provisioning operation.

---

## Currencies — 5 routes

| Method | Canonical path | Permission | Body / query |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/currencies` | `currencies.currency.read` | `CurrencyQueryDto` |
| POST | `/api/tenant/core/v1/currencies` | `currencies.currency.manage` | `CreateCurrencyDto` |
| PATCH | `/api/tenant/core/v1/currencies/:id` | `currencies.currency.manage` | `UpdateCurrencyDto` |
| POST | `/api/tenant/core/v1/currencies/:id/set-default` | `currencies.currency.manage` | — |
| DELETE | `/api/tenant/core/v1/currencies/:id` | `currencies.currency.manage` | — |

`CurrencyQueryDto` extends `PaginationQueryDto` with `status?` and `isDefault?`
(verified **2026-11-02** against
`../backend/mutakamel-apps/shared-libs/packages/database/src/dtos/pagination-query.dto.ts`
and `constants/pagination-defaults.constant.ts`: `page >= 1`, `limit` `1..100`
default `20`). `/core/settings/currencies` offers server-backed `limit` choices
`20`, `50` and `100` (resetting `page` to `1` while preserving active filter,
search and sort) and keeps its independent default-currency lookup fixed at
`page=1&limit=1&isDefault=true`.

### The invariants the UI must reflect, not enforce

Currency creation contract verified **2026-10-18**: selecting “make default”
keeps the rate editable. Enter new-currency units per one current-default unit:
with USD default, creating EGP as default sends `isDefault: true` and
`exchangeRate: 50`. Core rebases USD to `0.02` and stores EGP at `1` in the
same transaction. A supplied rate is validated even when making a default.
Only the first default may omit the rate; the bilingual form explains this
exception. Core decides whether a default exists under its transaction lock,
independently of the portal's current search, filters or page.

Currency update contract verified **2026-10-17**: `UpdateCurrencyDto` accepts
only `name`, `symbol`, `exchangeRate` and `status`. Code and decimal places
are read-only in the edit form and omitted from PATCH; sending `decimalPlaces`
returns a 400 non-whitelisted-field validation error, even if unchanged.
Creation accepts an optional ISO precision echo, but Core derives the actual
precision from the currency code and rejects a mismatched echo with
`CURRENCY_PRECISION_MISMATCH`. Source verified **2026-11-01** against
`common/money/iso4217-minor-units.ts` and `CurrenciesService.create`: the portal
displays this derived precision read-only and omits it from the create body.
Currency writes show dedicated Arabic and English messages for `CURRENCY_DECIMAL_PLACES_IMMUTABLE`,
`CURRENCY_REBASE_OUT_OF_RANGE` and `CURRENCY_NOT_FOUND`.

- **Exactly one default.** `set-default` promotes the target and demotes the
  previous one **in one transaction**. Do not model this as two calls, and do
  not optimistically clear the old default before the response.
- **`DELETE` is a deactivation, not a delete** — it returns **204** and marks
  the row inactive. History is preserved. Label the control accordingly.
- **The default currency cannot be deactivated**, and neither can one referenced
  by workspace settings. Both are 409s naming the reason.
- Exchange rates are **decimal strings**, expressing row-currency units per one
  current-default unit. Preserve them with `formatDecimalString`, independently
  of amount precision; never `Number()` a stored rate for display or rebasing.

---

## Taxes — 4 routes

| Method | Canonical path | Permission | Body / query |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/taxes` | `taxes.tax.read` | `TaxQueryDto` |
| POST | `/api/tenant/core/v1/taxes` | `taxes.tax.manage` | `CreateTaxDto` |
| PATCH | `/api/tenant/core/v1/taxes/:id` | `taxes.tax.manage` | `UpdateTaxDto` |
| DELETE | `/api/tenant/core/v1/taxes/:id` | `taxes.tax.manage` | — |

`TaxQueryDto` extends `PaginationQueryDto` with `status?`, `companyId?`,
`isInclusive?` (verified **2026-11-02**: `limit` `1..100`, default `20`;
`/core/settings/taxes` offers server-backed `20`, `50` and `100`, resetting
`page` to `1` while preserving `companyId`, `status`, `isInclusive`, `search`
and `sort`).

A tax is optionally **company-scoped**, and its `code` is unique **within that
scope** — the same code may exist for two companies. A duplicate is a 409 that
should name the company, otherwise the message is baffling.

Source verified **2026-11-01**: rates accept 0 through 100 with at most four
decimal places. `UpdateTaxDto` accepts `name`, `rate`, `isInclusive` and `status`;
code and company scope are immutable and omitted from PATCH. Reactivation uses
`status: ACTIVE` and remains subject to Core's active-company checks.

`DELETE` is a deactivation returning **204**, for the same reason as currencies:
posted documents must keep resolving their tax.

---

## Numbering sequences — 4 routes

| Method | Canonical path | Permission | Body / query |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/numbering` | `numbering.read` | `NumberingSequenceQueryDto` |
| POST | `/api/tenant/core/v1/numbering` | `numbering.manage` | `CreateNumberingSequenceDto` |
| PATCH | `/api/tenant/core/v1/numbering/:id` | `numbering.manage` | `UpdateNumberingSequenceDto` |
| GET | `/api/tenant/core/v1/numbering/:code/peek` | `numbering.read` | `PeekNumberingSequenceQueryDto` |

**`nextValue` is serialised as a string.** It is a bigint on the server. Never
parse it into a JavaScript number — that is exactly the decimal-string rule, and
a sequence can outrun `Number.MAX_SAFE_INTEGER`.

`:code` is validated against `/^[A-Z0-9][A-Z0-9._:-]{0,63}$/` and **upper-cased**
before lookup, so the URL is case-insensitive but the stored code is not.

### Numbering preview (source verified 2026-10-29)

Prefix validation verified **2026-10-29**: create/update trim surrounding whitespace
and accept at most 16 Unicode letters/numbers or `._:/#-` characters. Whitespace-only
input, internal whitespace, controls and bidi overrides are invalid. An empty
string clears the prefix to SQL `NULL`; omitting it on update preserves its value.
The portal request builders enforce the same rules with Arabic/English guidance.

`GET /numbering/:code/peek` returns `{ code, companyId, nextValue, formatted }`
and **consumes nothing**. Only the edit modal reads and displays this saved
server value. Both forms preview prefix, padding and counter changes with the
local formatter, preserving the counter as a string. The create modal never
probes `peek` while typing; POST reports conflicting codes with HTTP 409
`SEQUENCE_CODE_TAKEN`.

**`nextValue` may never move backward** — a lower value is a **422**, not a
generic failure. Say what the current value is.

---

## Email configuration — 4 routes

SMTP patch serialization verified against source **2026-10-29** (AUDIT28C-CORE-9):
when SMTP is selected, every patch includes the effective `smtpSecure` and
`smtpProtocol` form values, even when unchanged. Null saved settings use
`false` and `"smtp"`, so switching from another provider initializes both
settings explicitly. Other fields retain their existing change-only behavior.

Portal form rules verified against source **2026-10-29** (AUDIT28C-CORE-4):
new provider selections are limited to SMTP and platform-shared. Existing
SES/SendGrid configurations still display their provider and remain readable;
the portal cannot supply the versioned credential reference required to switch
to either provider. Activation is disabled until the saved configuration has
`dkimVerified: true`, and the patch builder rejects an unverified activation.
Switching to SMTP requires a password when `smtpPasswordConfigured` is false;
a blank password preserves an existing stored password. These form stops have
Arabic/English guidance. API `TENANT_EMAIL_CONFIG_INVALID` rejections also map
to translated configuration guidance. Core remains authoritative, including
resetting verification and suspending delivery when its verification tuple changes.

Source updated **2026-10-29** (AUDIT28C-CORE-2): all four routes require the CRM module and `crm.outbound_email`, in addition to their existing permissions. Core returns `403 ACCESS_POLICY_BLOCKED` before reading the configuration or probing SMTP when the entitlement is absent. `503 TENANT_EMAIL_CONFIG_NOT_READY` remains a provisioning failure for an entitled tenant.

The staff-readable `/api/tenant/core/v1/auth/me` response includes `featureEntitlements: { "crm.outbound_email": boolean }`. Configuration queries must not mount when this entitlement is absent; direct navigation renders translated “not included in plan” guidance. Suppression lookup/lift has a separate tenant-wide `workspace.email.manage` admission and no email-config read or outbound entitlement guard; keep its entry independent of the configuration boundary. An API refusal after the page opened is distinct from provisioning errors. Core remains authoritative. Typecheck, lint, specs and live verification remain lead gates.

| Method | Canonical path | Permission | Notes |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/email-config` | `workspace.email.read` | Safe projection — **no secrets** |
| PATCH | `/api/tenant/core/v1/email-config` | `workspace.email.manage` | Idempotency + `If-Match` required |
| POST | `/api/tenant/core/v1/email-config/verify` | `workspace.email.manage` | **No body.** Idempotency + `If-Match` |
| POST | `/api/tenant/core/v1/email-config/verify-connection` | `workspace.email.manage` | **No body.** Idempotency required |

Quota projection source verified **2026-11-01** against
`tenant/email-config/dto/tenant-email-config.dto.ts` and
`TenantEmailConfigService.toDto`: GET includes `planDailyQuota`,
`planRateLimitPerMin`, `planQuotaRevision`, nullable `dailyQuota` and
`rateLimitPerMin`, and their two effective values. PATCH accepts nullable
`dailyQuota` (integer 1–1,000,000) and `rateLimitPerMin` (integer 1–10,000).
`null` inherits the plan; zero is invalid, and overrides cannot exceed the
current plan caps. Plan fields are read-only evidence, never PATCH fields.
The safe GET also includes server-derived `feedbackProfile` (`CRM_FEEDBACK_V1`
or `null`); it is not an editable provider credential or an activation proof.

### This module has the strictest concurrency contract in Core

Writes require an **exact strong** `If-Match: "<n>"`:

| Situation | Status | Code |
| --- | --- | --- |
| Header absent | **428** | `TENANT_EMAIL_CONFIG_PRECONDITION_REQUIRED` |
| Header malformed or stale | **409** | `TENANT_EMAIL_CONFIG_STALE_REVISION` |

Weak etags (`W/"n"`) are **not** accepted here, unlike `activities`. Every
response carries `ETag: "<revision>"` and `Cache-Control: no-store, private`.

428 and 409 need **different** messages: one means "reload and try again", the
other means "someone else changed this while you were editing". Collapsing them
into one error is the mistake this contract exists to prevent — see the
`ConflictDialog` pattern.

**The password and provider references are write-only.** They go up in `PATCH`
and never come back in `GET`. A settings form must therefore show "configured"
rather than a masked value it does not have, and must not clear the stored
secret when the user saves without retyping it.

`verify` checks the saved sender domain's registered DKIM proof at the exact revision;
`verify-connection` runs a bounded TLS-verified SMTP probe. Both return **201**.
The probe result is deliberately vague about network detail — do not present it
as a diagnostic log.

---

## Notifications — 12 routes

| Method | Canonical path | Permission |
| --- | --- | --- |
| GET | `/api/tenant/core/v1/notifications` | `notifications.notification.read` |
| GET | `/api/tenant/core/v1/notifications/config` | `notifications.notification.read` |
| GET | `/api/tenant/core/v1/notifications/unread-count` | `notifications.notification.read` |
| POST | `/api/tenant/core/v1/notifications/:id/read` | `notifications.notification.read` |
| POST | `/api/tenant/core/v1/notifications/:id/acknowledge` | `notifications.notification.read` |
| DELETE | `/api/tenant/core/v1/notifications/:id` | `notifications.notification.read` |
| POST | `/api/tenant/core/v1/notifications/read-all` | `notifications.notification.read` |
| GET | `/api/tenant/core/v1/notifications/preferences` | `notifications.preference.read` |
| PUT | `/api/tenant/core/v1/notifications/preferences` | `notifications.preference.manage` |

### Three of these twelve are aliases — pick one and stay on it

| Prefer | Alias, same behaviour |
| --- | --- |
| `POST /:id/acknowledge` | `POST /:id/ack` (legacy) |
| `POST /mark-all-read` | `POST /read-all` (LLD-aligned) |
| `DELETE /:id` | `POST /:id/dismiss` |

Aliases exist for compatibility. A screen that mixes them is harder to reason
about, not more compatible. The portal currently calls `/read-all` and
`/:id/read`.

### Shape

**This list is cursor-paginated**, not page/limit like the rest of Core:
`limit` (1–50, default 20), `cursor` (opaque), `unreadOnly`. The response is
`{ items, nextCursor }`. **Preserve the cursor exactly** — it is opaque and
must not be parsed, rebuilt or logged as meaningful.

All read/ack/dismiss routes return **204**.

Every route is scoped to the calling user. `dismiss` hides a notification **for
that user only**; it is not a delete for anyone else.

### The realtime interaction

Live updates arrive through `@mutakamel/realtime-app-client` as
`notification.created.v1`, `notification.updated.v1` and
`notification.unread-count.changed.v1`. `src/lib/notifications/tenant-notification-runtime.ts`
already owns this and validates every payload with zod.

**One contract note that is easy to get wrong:** `lastNotificationCursor` in the
realtime handshake may only be a cursor committed after a **fully applied REST
sync page**. A cursor observed on a socket item must never be sent back — doing
so silently skips notifications.

---

## Portal status per screen

| Screen | Plan task | State |
| --- | --- | --- |
| `/core/settings` | 5.14 | live — redirect-only entry resolving the first permitted `CORE_SETTINGS_NAV_ITEMS` route (or `/unavailable`), with no standalone hub page |
| `/core/settings/workspace` | 5.1 | live — single-column layout, actions in `PageActionBar`, dirty draft guarded via `useUnsavedChangesGuard` |
| `/core/settings/currencies` | 5.2 | live — canonical `readCorePage` pagination, actions in `PageActionBar` |
| `/core/settings/taxes` | 5.3 | live — canonical `readCorePage` pagination + bounded company picker, actions in `PageActionBar` |
| `/core/settings/numbering` | 5.4–5.6 | live — canonical `readCorePage` pagination + bounded company picker, actions in `PageActionBar` |
| `/core/settings/email` | 5.7–5.9 | live — DNS panel shows the host only, see below; actions in `PageActionBar`, dirty draft guarded via `useUnsavedChangesGuard` |
| `/core/settings/branding` | 6.x | live — contrast-checked identity & asset upload, actions in `PageActionBar`, dirty draft guarded via `useUnsavedChangesGuard` |
| `/core/settings/updates` | — | live — canonical `readCorePage` discovery + idempotent 202 apply, no `checkedAt` assumption |
| `/core/notifications` | 5.10–5.13 | live — inbox, preferences, devices |
| `/core/notifications/[id]` | 5.19 | live — resolved from the list, no by-id route exists |

Core settings screens (`workspace`, `currencies`, `taxes`, `numbering`, `email`,
`branding`, `updates`, `webphone`) keep `PageHeader` (`className="sr-only"`) so
their primary and secondary actions portal into `PageActionBar` without
repeating a second in-body `SubNav` or redundant page subtitle, retaining short
decision-focused helper copy only where user choices depend on it (currency
rates/rebasing, support-access consent, and DNS verification).

Stateful Core settings forms (`workspace`, `email`, `branding`) pair
`useUnsavedChangesGuard` (`src/hooks/useUnsavedChangesGuard.ts`) with
`ConfirmActionModal`: when a draft is dirty, it intercepts ordinary same-origin
`<a href>` clicks in capture phase (ignoring `#` hash jumps, self-links,
downloads, modified clicks, external origins, and non-`_self` targets),
registers `window` `beforeunload`, and gates explicit in-page `Discard` and
`Reload` actions via `requestDiscard`. Where the browser exposes Navigation API,
it also cancels cancellable same-document Back/Forward traversals and resumes
the original history entry only after confirmation. The browser may permit an
escape traversal; engines without Navigation API retain anchor and unload
protection. No history methods are rewritten. Callers wrap their own direct
imperative navigation in `requestDiscard`.

Conflict overwrite in Workspace sends only fields edited against the original
baseline, preserving unrelated concurrent changes. Branding asset upload merges
clean metadata from the saved response while retaining both dirty values and
their original per-field conflict baseline, including edits made during upload.
Discard uses the latest saved metadata and retains uploaded assets. Upload and
metadata save cannot run together. Email and Branding reject malformed successful
reads as invalid responses, separately from network failures, and fence read
completions after replacement or unmount. Email checks read permission before
mounting its query hook.

### Three things the contract does not give the UI

Recorded so the next reader does not go looking for them:

- **`mark-all-read` / `read-all` answer `200 { updated: n }`, not 204.** The
  "all read/ack/dismiss routes return 204" line above covers the per-id
  commands; the two bulk aliases return a body.
- **The DKIM record's expected value is never projected**, and no SPF record is
  checked at all — `DnsTenantEmailVerificationAdapter` compares against a
  deployment env registry. The screen shows the derived host
  `${dkimSelector}._domainkey.${senderDomain}` and says the value is not
  available. See [Q22](../build/OPEN-QUESTIONS.md#q22--the-email-dns-records-a-tenant-must-publish-are-not-returned-by-the-api).
- **Device tokens cannot be listed**, only registered and revoked. See
  [Q23](../build/OPEN-QUESTIONS.md#q23--device-tokens-can-be-registered-and-revoked-but-never-listed).
