# Response Validation

Status: **verified current per-application response contracts**

Last verified: **2026-07-25**

## No universal success parser

Select response handling from the canonical Gateway namespace:

| Namespace | Ordinary JSON success |
| --- | --- |
| `/api/tenant/core/v1/*` | Core success envelope; shared page metadata can be top-level `meta` |
| `/api/tenant/crm/v1/*` | Raw controller/service projection; page fields are normally in the returned page object |
| `/api/tenant/trade/v1/*` | Trade success envelope; page objects remain inside `data` |

Do not detect the owning app from payload shape. Empty objects and domain
objects can legitimately contain a `success` property.

## Core

```ts
type CoreSuccess<T, TMeta = never> = {
  success: true;
  data: T | null;
  meta?: TMeta;
  correlationId: string;
  timestamp: string;
};
```

For Core shared pagination, `data` is the item array and `meta` is:

```ts
type CorePageMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};
```

Core feature-specific cursor pages can instead remain inside `data`; follow the
route guide.

## CRM

CRM does not install a global success-envelope interceptor. A common page is:

```ts
type CrmPage<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};
```

Entities, arrays, `202` projections, cursor pages, and streams are likewise raw
handler results. Never unwrap CRM `data` unless that endpoint's response model
itself declares a `data` field.

## Trade

```ts
type TradeSuccess<T> = {
  success: true;
  data: T;
  correlationId: string | null;
  timestamp: string;
};
```

The Trade interceptor preserves domain pagination under `data`, sets ETag when
the result exposes a numeric version, and can emit
`Idempotency-Replayed`. A handler result already containing `success` is passed
through, so route-specific documentation remains authoritative.

## Non-JSON and no-body routes

Some routes:

- return `204 No Content`;
- stream images, attachments, or signed files;
- return private artifact/download URLs;
- use multipart upload;
- expose polling metadata and `Location`/`Retry-After`.

Select the response mode from the exact endpoint. Never feed binary data
through a JSON/envelope parser.

## Client boundary

The shared API client should:

- bind an explicit Core, CRM, or Trade parser to every canonical path;
- preserve status, headers, ETag, Location, replay flags, cache directives,
  and correlation identifiers;
- validate required fields without rejecting harmless additive server fields;
- parse `204` as no body;
- reject a Core/Trade `success:false` body even if an intermediary returns
  `2xx`;
- never turn malformed data into a domain success;
- keep route-specific raw/stream handling explicit.

## Runtime schemas

Use runtime validation for:

- authentication/session and tenant-host admission;
- permissions, scopes, features, and access mode;
- financial/payment state;
- provisioning/update pins and operations;
- template/document schemas;
- complex external or plugin-defined payloads;
- any response used for security-sensitive navigation or capability.

For a simple internal row, a narrow type guard can be sufficient if failure is
closed and observable.

## Unknown and additional fields

Responses can add fields without breaking clients. Runtime schemas should
usually allow additional server fields while requiring the fields the feature
uses.

Unknown enum values must remain serializable, render through a neutral
fallback, and disable unsafe transitions that require known semantics. Record
only safe structural diagnostics.

## Exact values and stale data

Do not convert decimal strings to floating point, decode opaque cursors, turn
UUIDs into numbers, or overwrite version/checksum evidence.

- Keep the query/context that produced a cursor or page.
- Reset page/cursor when its filters change.
- Reject out-of-order responses from an obsolete session or scope generation.
- After mutation, re-read or update cache only from an authoritative result.
- Do not manufacture totals from the current page.

## Source evidence

```text
../backend/mutakamel-apps/core-app/src/common/common.module.ts
../backend/mutakamel-apps/shared-libs/packages/common/src/interceptors/response-envelope.interceptor.ts
../backend/mutakamel-apps/shared-libs/packages/common/src/dtos/success-response.dto.ts
../backend/mutakamel-apps/shared-libs/packages/common/src/dtos/envelope-meta.dto.ts
../backend/mutakamel-apps/crm-app/src/common/common.module.ts
../backend/mutakamel-apps/trade-app/src/common/common.module.ts
../backend/mutakamel-apps/trade-app/src/common/trade-response.interceptor.ts
```
