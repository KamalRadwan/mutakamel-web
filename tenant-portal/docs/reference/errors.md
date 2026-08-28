# Errors

Status: **verified**

Last source verification: **2026-08-27**

## The catalogue

**[error-codes.md](error-codes.md) lists all 95 error
codes the built screens can receive**, with the HTTP status each is thrown
with — generated from the `throw new *Exception` sites, so it cannot drift.

This page is the *handling policy*; that page is the *vocabulary*.

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

`ValidationPipe` runs with `stopAtFirstError: false`, so **expect multiple
field errors** and map all of them.

`forbidNonWhitelisted: true` means an unknown key is a 422, not a silent
ignore. If you get a validation failure on a field you did not intend to send,
you are sending a UI-only property — check the request body.

CRM and Trade **hide the rejected value**. You get the field path and a
message, never the offending input echoed back, so do not try to display
"you sent X".

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
[DEFECTS.md](../build/DEFECTS.md#d9) D9, and it is the one permitted i18n fix
inside `axiosClient.ts`.

## Never

- Never parse a message string.
- Never retry a non-idempotent write automatically.
- Never swallow an error into a `console.log` and render an empty state.
- Never show a raw error code as the entire user-facing message.
- Never discard `correlationId`.
