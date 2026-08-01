# Validation Guide

Status: **Verified cross-application conventions**

Last verified: **2026-07-25**

## Principle

Frontend validation improves feedback. Backend DTO, guard, and domain
validation remain authoritative.

Tenant Portal must validate four distinct layers:

1. transport input before sending;
2. response structure before feature use;
3. business state/capability before offering an action;
4. localized form state without changing transport values.

## Documents

- [Request validation](request-validation.md)
- [Response validation](response-validation.md)
- [Error handling](error-handling.md)
- [State and concurrency validation](state-and-concurrency.md)
- [DTO reference](../dtos.md)
- [Static transport values](../static-data.md)

## Backend global validation

Core, CRM, and Trade currently use Nest `ValidationPipe` with:

```text
whitelist: true
forbidNonWhitelisted: true
transform: true
enableImplicitConversion: true
stopAtFirstError: false
```

CRM and Trade hide rejected target/value data in validation errors. CRM uses
the explicit code `CRM_VALIDATION_FAILED`; Trade uses
`TRADE.VALIDATION_FAILED`. Core and CRM use the shared application error
filter; Trade currently uses its Nest/exception error bodies.

Consequences:

- send only documented fields;
- never serialize UI-only state into a request DTO;
- treat enum values as case-sensitive;
- verify endpoint-specific transformations rather than relying on JavaScript
  coercion;
- expect more than one field error;
- do not echo rejected values into logs.

## Validation ownership

| Concern | Frontend | Backend |
| --- | --- | --- |
| Required/format feedback | Yes | Authoritative |
| Permission | Advisory projection | Authoritative |
| Tenant/organization ownership | Never trusted | Authoritative |
| Uniqueness | Optional hint | Authoritative |
| Financial calculation | Display only | Authoritative |
| Lifecycle transition | Capability hint | Authoritative |
| Optimistic concurrency | Preserve evidence | Authoritative |
| File type/size | Early feedback | Authoritative |
| Response shape | Runtime defensive parse | Producer authority |

## Localization

Keep field paths and wire values stable. Translate labels and safe messages,
not enum payloads, permission strings, error codes, IDs, or decimal values.

The backend may localize messages using request language. Client behavior must
branch on HTTP status and a stable code/category when present—not message text.
