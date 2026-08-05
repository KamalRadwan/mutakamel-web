# Feature Documentation Template

Status: **[Verified]**

Last source verification: **YYYY-MM-DD**

Owner: **Core / Worker**

Frontend status: **DONE / PARTIAL / BROKEN / MISSING / GATED / REFACTOR**

## Scope

Name the operator capability and what is explicitly outside scope.

## Route matrix

| Method and canonical browser path | Route class | Permissions | Success | Idempotency |
| --- | --- | --- | --- | --- |
| `GET /api/admin/core/v1/example` | `AUTHENTICATED` | `admin.example.read` | `200` | No |

State ALL/ANY permission mode explicitly.

## Request contract

Document exact DTO fields, validation, enums, headers, and safe example.

## Response contract

Document envelope, projection, pagination, decimal/byte fields, and `204`
behavior.

## States and errors

Cover loading, refreshing, empty, forbidden, unavailable, validation, conflict,
stale, transport, idempotency, and terminal asynchronous behavior as applicable.

## Security and operator safety

Name secret fields, redaction, critical confirmations, and any gated controls.

## Current frontend evidence

List source files and explain whether behavior is real, partial, mock, or
blocked.

## Tests

List success and negative regression cases.

## Source map

Use paths relative to `C:\mutakamel.ai\frontend`.
