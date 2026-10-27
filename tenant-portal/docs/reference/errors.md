# Errors

Status: **verified**

Last source verification: **2026-08-27**

## The catalogue

### Trade channel list limit (2026-10-26)

`ChannelPageLimitError` is a portal-local loading failure, not a backend HTTP
code. Both channel administration and the operating-context provider map it
to `trade.channelPageLimit` in Arabic and English. A complete-list walk stops
after 20 pages of 100 rows; it reports an incomplete list instead of exposing
partial rows or selector choices as a successful load.

### Inventory serial selection (2026-10-26)

`INVENTORY_FORM_SERIAL_SELECTION` is a local validation code, not a backend
HTTP code. It maps to `tradeInventory.serialSelectionInvalid` in Arabic and
English for duplicate, blank, reserved (`none`), overlong or count-mismatched
serial inputs. The same validation covers movement tracking, reservation
release subsets and reversal line subsets. Server eligibility remains governed
by `TRADE.INVENTORY.TRACKING_REQUIRED` and the existing inventory error mapping.

### Inventory unresolved writes (2026-10-24)

`INVENTORY_UNRESOLVED_WRITE` is a portal-local guard, mapped directly to
`tradeInventory.unresolvedWrite` in both dictionaries. It blocks another payload
or scope while the mounted page retains an unresolved movement request. Retry
the unchanged original operation to recover its response using the same keys.

### Inventory single-serial validation (2026-10-24)

`INVENTORY_FORM_SERIAL_UNIT` is a portal-local builder rejection, not an HTTP
error code. It maps to `tradeInventory.serialUnitHint` in Arabic and English:
one serial number with quantity 1, posting each serial separately. Forms show
the same guidance next to the serial and locked quantity inputs. Invalid stock
expiry dates use the existing `INVENTORY_FORM_DATE` validation message.

### Email MFA (2026-10-23)

The MFA screens map stable Core/Gateway codes to the bilingual `mfa.errors`
dictionary. `AUTH_MFA_INVALID_CHALLENGE` (401) means invalid, expired, consumed
or mismatched proof; it does not disclose the exact cause. `AUTH_MFA_THROTTLED`
and Gateway 429s preserve the resend/verify delay from `Retry-After` or
`details.retryAfterSeconds`. `AUTH_MFA_UNAVAILABLE` (503) fails closed.
`CURRENT_PASSWORD_INVALID` (422) reports the profile password refusal.
Local `INVALID_MFA_RESPONSE` and `INVALID_MFA_SETTINGS` denote failed runtime
validation, never backend codes or raw user-facing prose. Local expiry and
six-digit validation use `mfa.errors.expired` and `codeFormat`; unknown/lost
verification replies use `ambiguous` and require restart without resubmission.

### Partial authentication scope lists (2026-10-18)

`authScopeNotice.branches`, `authScopeNotice.companies` and
`authScopeNotice.teamMemberships` are Arabic/English client status messages,
not backend error codes. The persistent banner identifies each `/auth/me`
collection whose corresponding `accessScope` truncation flag is true. Missing
or malformed scope projections use the existing local `INVALID_AUTH_PROFILE`
validation failure.

### CRM configuration feedback (2026-10-18)

Settings, acquisition-source creation/deletion/reordering/icon upload and
custom-field creation pass only HTTP status and stable code to `useCrmErrorText`.
Server messages and field-error prose are excluded from these surfaces. Load
failures retain their status for the permission boundary and table error state.
The `crmSettings.loadFailed`, `saveFailed`, `manageForbidden` and
`crmAcquisitionSources.createFailed`, `deleteFailed`, `createUncertain`,
`createUncertainStale`, `deleteUncertain`, `deleteUncertainStale` dictionary keys
provide Arabic/English client feedback, not backend error codes.
Portal-local parser/builder codes are `INVALID_CRM_SETTINGS_RESPONSE`,
`CRM_SETTINGS_RETENTION_INVALID`, `INVALID_CRM_ACQUISITION_SOURCES_RESPONSE`
and `CRM_ACQUISITION_SOURCE_NAMES_INVALID`. Retention validation uses
`crmSettings.retentionHelp`; source-name validation uses
`crmAcquisitionSources.invalidNames`. Unknown parser failures use localized
fallbacks, never their exception text.

### Financial evidence client validation (2026-10-17)

`tradeDocuments.lineEditor` contains local validation messages, not HTTP codes:
`decimalInvalid` identifies missing, malformed, negative or out-of-range amounts;
`quantityInvalid` requires a positive quantity; `taxRateInvalid` requires 0–100
percent representable in integer basis points; `calculationInvalid` identifies
discount or total calculation failures and overflow. The calculator returns the
field and line index with each error. Draft submission is blocked, totals are
hidden, and authored inputs remain available for correction. Both dictionaries
provide the same keys; backend financial errors continue through the existing
Trade outcome handling.

### Client request deadline (2026-10-17)

`CLIENT_REQUEST_TIMEOUT` is a portal-local outcome with local status 504,
not a backend response code. `errors.requestTimedOut` and `errors.writeTimedOut`
provide bilingual recovery messages. A timed-out mutation may have committed;
its original `idempotencyKey` is retained by `normalizeApiError`. Refresh to
reconcile, or explicitly retry the same body with that same key. The transport
never automatically retries a deadline failure.

**[error-codes.md](error-codes.md) lists all 95 error
codes the built screens can receive**, with the HTTP status each is thrown
with — generated from the `throw new *Exception` sites, so it cannot drift.

This page is the *handling policy*; that page is the *vocabulary*.

### Notification shell feedback (2026-10-17)

`errors.notificationLoadFailed` is Arabic/English client feedback for an initial
or subsequent REST reconciliation failure, including exhausted bounded retries.
It retains the prior notification cache and offers Retry; an unsuccessful load
never renders the empty-inbox message. This dictionary key is not a backend
error code.

## The rule

**Branch on HTTP status and the stable error code. Never on message text.**

The backend localizes messages by request language, so message text is not a
stable contract. It may be *displayed*; it must never be *parsed*.

## Normalized shape

`src/lib/api/errors.ts`'s `normalizeApiError()` flattens all four failure
shapes into one, built on top of what `axiosClient` throws:

```ts
interface NormalizedApiError {
  status: number;
  code?: string;              // errorCode (Core/CRM) or code (Gateway)
  message?: string;           // localized, display-only
  correlationId?: string;     // never discard this
  fieldErrors?: Record<string, string[]>;
}
```

`correlationId` is the only way to trace a user report to a server log. Carry
it into every error surface — `toast.errorFromApi` puts it in the message.

**Corrected 2026-08-28, verified against source.** This page previously said
DTO-shape validation returns 422 with a `fieldErrors` key on the wire.
Neither half is true:

- **Status is 400, not 422**, for a class-validator/`ValidationPipe` failure.
  `core-app/src/main.ts` and `crm-app/src/main.ts` configure `ValidationPipe`
  with no custom `errorHttpStatusCode`, so Nest's default (400) applies. The
  95 codes in [error-codes.md](error-codes.md) that show `422` are a
  *different* thing entirely — specific, manually-thrown business-rule
  exceptions (`LEAD_CONTACT_NAME_REQUIRED`, `CUSTOM_FIELD_LIMIT_EXCEEDED`),
  each its own single error code, not a bag of field errors.
- **The wire key is `details`, not `fieldErrors`.** `fieldErrors` is this
  app's normalized name for it, built by `normalizeApiError()` — it does not
  appear in any response body.
- **Core does not provide a real per-field breakdown.** Its `ValidationPipe`
  has no custom `exceptionFactory`, so Nest's default handler collapses every
  constraint violation into a flat array of strings with the field name
  already lost. The shared `AllExceptionsFilter`
  (`shared-libs/packages/common/src/filters/all-exceptions.filter.ts`)
  buckets that array under the literal key `"_"`:
  `{ "details": { "_": ["email must be an email", "name should not be empty"] } }`.
  A `Field` cannot be targeted from this — render it as a single in-body
  `ErrorState`-style summary instead of trying to map onto individual fields.
- **CRM does provide real per-field breakdown.** `crm-app/src/main.ts` sets a
  custom `exceptionFactory` that keeps `ValidationError[]`, and the filter's
  `flattenValidation` recurses `property`/`constraints`/`children` into
  genuine dot-path keys: `{ "details": { "email": ["Invalid value"],
  "profile.age": ["Invalid value"] } }`. This *is* safe to map onto `Field`s
  by path.

Consequence for `normalizeApiError()`: read `fieldErrors` from
`body.details`, and treat a details object whose only key is `"_"` as
**not** field-mappable — surface those messages as a single in-body error
instead of pretending they target a field.

## Failure shapes by producer

| Producer | Key | Example |
| --- | --- | --- |
| Core | `errorCode` | `INVALID_CREDENTIALS` |
| CRM | `errorCode` | `CRM_VALIDATION_FAILED` |
| Trade | `errorCode` | `TRADE.VALIDATION_FAILED` |
| Gateway | `code` (RFC 7807 Problem Details) | rate limit, circuit breaker, upstream timeout |

Core and CRM use the shared application error filter. Trade uses its Nest
exception bodies, so its shape differs — do not assume Trade matches Core.

## Status handling

| Status | Meaning | Required handling |
| --- | --- | --- |
| **400** | DTO-shape validation failed (`ValidationPipe`) | CRM: map `fieldErrors` onto their `Field`s, never a toast. Core: no real field breakdown (see below) — render as a single in-body message instead |
| **401** | No or stale session | **Transport handles it.** Feature code does nothing |
| **403** | Authenticated, not permitted | **Transport already raises a toast** — do not raise a second |
| **404** | Not found, or outside scope | In-body not-found with a route back |
| **409** | State conflict | Toast via `errorFromApi`, then refetch to show current state |
| **422** | A specific business rule was violated (its own single error code — not a field-error bag) | Toast via `errorFromApi` with the code's dictionary message, unless the code names one specific field, in which case that `Field` |
| **429** | Rate limited | Toast; disable the action briefly. Do not auto-retry in a loop |
| **5xx** | Server or upstream failure | `ErrorState` with retry |
| network / timeout | Unknown outcome | See [ambiguous outcomes](#ambiguous-outcomes) |

### The 403 double-fire

`dispatchForbiddenToast()` in `axiosClient.ts` fires on **every** non-public
403. A `toast.error(...)` in the same `catch` block double-fires and the user
sees two stacked toasts.

```ts
// ❌
catch (error) {
  if (error.status === 403) toast.error("Access denied");   // already fired
}

// ✅
catch (error) {
  if (error.status === 403) return;                          // transport owns it
  toast.errorFromApi(t.errors.saveFailed, error);
}
```

Lint flags `toast.error` inside a `catch` that also references `403` or
`AUTHORIZATION`.

## Validation errors

Verified **2026-10-17**: the CRM client refusal `CRM_AMOUNT_SCALE_INVALID`
identifies an opportunity amount exceeding its selected currency's decimal
scale. Both dictionaries provide the sentence used by create/edit/conversion
amount validation and by the request-builder refusal catalogue. Writes that
cannot survive the numeric JSON round trip still refuse with
`CRM_AMOUNT_OUT_OF_SAFE_RANGE`.

`ValidationPipe` runs with `stopAtFirstError: false`, so **expect multiple
field errors** and map all of them.

`forbidNonWhitelisted: true` means an unknown key is a 422, not a silent
ignore. If you get a validation failure on a field you did not intend to send,
you are sending a UI-only property — check the request body.

CRM and Trade **hide the rejected value**. You get the field path and a
message, never the offending input echoed back, so do not try to display
"you sent X".

## Quotation conversion client validation

Verified **2026-10-17**. These are local request-builder refusals, not backend
error codes. Both dictionaries translate their messages under
`tradeDocuments.quotationConversion`.

| Local refusal | Message key | Meaning |
| --- | --- | --- |
| `QUOTATION_CONVERSION_SOURCE` | `sourceInvalid` | The current revision is not accepted, priced lines do not match its subtotal, or original non-empty terms are missing. Reload/check the accepted revision. |
| `QUOTATION_CONVERSION_EVIDENCE` | `evidenceInvalid` | Missing/duplicate/foreign line evidence, invalid amounts or rate, discount above the line subtotal, or inconsistent tax treatment. Correct the evidence before review. |

## Ambiguous outcomes

A write that times out, or fails after the request left the browser, **may or
may not have applied**. This is the highest-consequence error case in the app.

Required handling:

1. Do **not** show a success or a plain failure — neither is known to be true.
2. Render an in-body, **persistent** panel. Not a toast; a 4-second toast
   destroys the only evidence.
3. Show the operation, the **idempotency key**, and the `correlationId`.
4. Offer retry-exact, reusing the **same** idempotency key, so a retry cannot
   double-apply.
5. Keep it until the user resolves it.

This is why `axiosClient` separates `nonReplayable` from `replayAfterRefresh` —
see [../architecture/data-layer.md](../architecture/data-layer.md#request-options).

## Response validation failures

If a response fails its runtime validator, that is a **contract drift bug**,
not a user error. Surface `ErrorState`, log the `correlationId`, and record the
drift — do not silently render partial data.

The one exception: an **unknown enum value** must not throw. Render it through
the fallback label so one new backend value cannot take a screen down. See
[enums.md](enums.md#rules).

## Messages come from the dictionary

Every error string the user sees is a `t.errors.*` entry in both dictionaries.
The server's localized message may be shown as supporting detail, but the
headline is ours and is translated.

The transport's own forbidden toast is currently hardcoded English — that is
[DEFECTS.md](../build/DEFECTS.md#d9--transports-forbidden-toast-is-hardcoded-english) D9, and it is the one permitted i18n fix
inside `axiosClient.ts`.

## Never

- Never parse a message string.
- Never retry a non-idempotent write automatically.
- Never swallow an error into a `console.log` and render an empty state.
- Never show a raw error code as the entire user-facing message.
- Never discard `correlationId`.
