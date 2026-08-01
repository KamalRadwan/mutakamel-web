# Request Validation

Status: **Verified conventions; endpoint DTO pages remain authoritative**

Last verified: **2026-07-25**

## Object shape

- Omit optional fields when the user did not provide a value.
- Do not send UI-only fields such as labels, selected-row state, derived totals,
  permission booleans, or display colors unless the DTO explicitly declares
  them.
- Unknown fields are rejected rather than silently removed.
- Distinguish omitted, `null`, empty string, empty array, and zero. They are not
  interchangeable.
- For PATCH, send only intended mutable fields and never entity snapshots.

## Identifiers

- Most platform identifiers are UUIDv7 strings.
- Validate the exact DTO decorator; do not assume every string ID accepts any
  UUID version.
- Do not use display keys, array indexes, slugs, or mock IDs where an ID is
  required.
- URL-encode path segments with framework/path helpers.
- Tenant ID is derived from trusted context and should not be accepted from a
  form unless a documented route explicitly needs it.

## Strings

- Apply the DTO's min/max length before submit.
- Preserve meaningful Unicode.
- Do not trim a value unless the backend DTO transforms or the feature contract
  requires trimming.
- Email normalization and case handling must follow the owning DTO/service.
- Never normalize passwords, tokens, signatures, idempotency keys, or opaque
  cursors.

## Booleans

Implicit conversion can make generic string coercion dangerous. Use the exact
DTO transform.

Where the shared strict boolean transform is used, accepted query inputs are:

```text
true
false
"true"
"false"
"1"
"0"
```

Do not send `"yes"`, `"on"`, or arbitrary non-empty strings.

## Numbers and decimal values

- Use JavaScript numbers only for bounded integer/count fields proven safe.
- Keep money, rates, quantities, and other exact decimals as strings.
- Do not format transport decimals with locale separators.
- Validate scale, precision, sign, and min/max from the exact DTO.
- Never calculate authoritative invoice totals, proration, balance, tax, or
  exchange conversion in the browser.

## Dates and time

- Use full ISO-8601 timestamps for instants.
- Use `YYYY-MM-DD` only when the DTO represents a date rather than an instant.
- Preserve the user's selected timezone separately when the API requires it.
- Do not submit locale-formatted dates.
- Validate effective ranges and end-after-start rules locally for feedback, then
  handle backend conflicts.

## Enums

- Send exact case-sensitive values.
- Map translated labels separately.
- Use an unknown-value fallback when reading.
- Never derive enum values by uppercasing labels.

See [Static data](../static-data.md).

## Arrays and nested input

- Respect `ArrayMinSize`, `ArrayMaxSize`, uniqueness, and nested DTO validation.
- Preserve line identity when editing ordered documents.
- Avoid sending empty arrays for replacement semantics unless the user intends
  to clear all values.
- For bulk requests, document whether failure is atomic, partial, or per-item.

## Query parameters

- Use endpoint-specific page/limit defaults and limits.
- Treat `sortBy` as an allowlisted field, not arbitrary entity/property input.
- Use `ASC`/`DESC` only where the DTO accepts those values.
- Do not combine incompatible cursor and page pagination.
- Preserve opaque cursors exactly.
- Omit empty filters rather than sending `undefined` or UI placeholder text.

## Headers

- `Authorization` is owned by the shared auth client.
- `x-idempotency-key` must be a UUIDv7 and be retained for an exact retry.
- `x-correlation-id` may be sent only in the accepted UUIDv7 format; otherwise
  the platform generates one.
- Never allow feature code or user input to set trusted identity, tenant,
  organization, service, or forwarded-host headers.
- Send language through the shared client using the platform's accepted header.

## Files

- Validate name, declared MIME, actual allowed type where feasible, and size.
- Treat browser MIME as a hint, not proof.
- Do not base64-wrap binary files unless the API explicitly requires it.
- Use `FormData` without manually setting a multipart boundary.
- Clear file inputs and object URLs when no longer needed.

## Source evidence

```text
../backend/mutakamel-apps/{core-app,crm-app,trade-app}/src/main.ts
../backend/mutakamel-apps/{core-app,crm-app,trade-app}/src/**/dto/
../backend/mutakamel-apps/shared-libs/packages/common/
../backend/mutakamel-apps/shared-libs/packages/database/src/dtos/
```
