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

`axiosClient` flattens all four failure shapes into one:

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
| **400** | Malformed request | `Field` inline if `fieldErrors`, else `ErrorState` |
| **401** | No or stale session | **Transport handles it.** Feature code does nothing |
| **403** | Authenticated, not permitted | **Transport already raises a toast** — do not raise a second |
| **404** | Not found, or outside scope | In-body not-found with a route back |
| **409** | State conflict | Toast via `errorFromApi`, then refetch to show current state |
| **422** | Validation failed | Map `fieldErrors` onto their `Field`s. **Never a toast** |
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
