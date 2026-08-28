# API Rules

Status: **verified**

Last source verification: **2026-08-27**

Source: `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/`,
`core-app/src/tenant/`, `crm-app/src/crm/`.

## Canonical paths

```text
/api/tenant/core/v1/*   ->  Gateway  ->  core-app
/api/tenant/crm/v1/*    ->  Gateway  ->  crm-app
/api/tenant/trade/v1/*  ->  Gateway  ->  trade-app
```

The Gateway is the only browser-facing edge. Upstream paths
(`/api/v1/crm/leads`, `/tenant/auth/login`) are backend implementation detail
and must never appear in browser code. `worker-app` has **no** tenant browser
API — its results are read through Core, CRM or Trade projections.

Current inventory: **573 tenant routes** — core 199, CRM 143, Trade 231. Full
table in [../generated/tenant-api-routes.md](../generated/tenant-api-routes.md);
machine-readable in the sibling `.json`. Regenerate with `pnpm docs:routes`.

## Route classes

Every Gateway route declares one. It determines transport policy.

| Class | Count | Meaning |
| --- | --- | --- |
| `AUTHENTICATED` | 209 | Standard authenticated read |
| `WRITE_SENSITIVE` | 328 | Mutation; idempotency and retry policy apply |
| `READ_HEAVY` | 23 | Larger payload/timeout allowance |
| `PUBLIC` | 13 | No session required |

A route that is `WRITE_SENSITIVE` **and** `idempotent: true` requires an
`x-idempotency-key` (UUIDv7). `axiosClient` attaches one automatically.

## Envelopes — the three apps differ

This is the most common source of frontend bugs. Do not assume uniformity.

### Core — wrapped

```json
{
  "success": true,
  "data": { },
  "meta": { },
  "correlationId": "…",
  "timestamp": "…"
}
```

Unwrap with `unwrapCoreData<T>()`. Failures carry `errorCode`.

### CRM — raw

CRM returns the payload directly. Lists are:

```json
{ "items": [ ], "meta": { "page": 1, "limit": 25, "total": 143, "totalPages": 6 } }
```

**Do not run a CRM response through `unwrapCoreData`** — there is no `data`
key and you will get `undefined`.

Validation failures use the code `CRM_VALIDATION_FAILED`.

### Trade — wrapped

Envelope, with `TRADE.VALIDATION_FAILED` on validation failure. Trade uses its
Nest exception bodies rather than the shared application error filter, so its
error shape differs from Core's. Not yet exercised by this portal.

### Gateway — Problem Details

Gateway-level failures (rate limit, circuit breaker, upstream timeout) return
RFC 7807 Problem Details with `code`, not `errorCode`.

Normalize all four without discarding `correlationId`.

## Backend validation

Core, CRM and Trade all run Nest `ValidationPipe` with:

```text
whitelist: true
forbidNonWhitelisted: true      <- unknown fields are REJECTED, not ignored
transform: true
enableImplicitConversion: true
stopAtFirstError: false          <- expect MULTIPLE field errors
```

Consequences:

- Send **only** documented DTO keys. A stray `id` or UI-only flag is a 422.
- Enum values are **case-sensitive**. See [../reference/enums.md](../reference/enums.md).
- Expect more than one field error; map them all onto their `Field`s.
- CRM and Trade **hide the rejected value** in validation errors — you get the
  field path and a message, never the offending input echoed back.

## Pagination

CRM list endpoints extend `PaginationQueryDto` via `BranchListQueryDto`:

| Parameter | Type | Notes |
| --- | --- | --- |
| `page` | integer ≥ 1 | |
| `limit` | integer | endpoint-bounded |
| `sortBy` | string | allowed set is per-endpoint |
| `sortOrder` | `ASC` \| `DESC` | |
| **`branchId`** | UUIDv7 | **required on every CRM list** |

`branchId` is `@IsUUID('7')` and **not optional**. A CRM list request without
it is a 422. The branch selector must resolve before the first fetch.

Pagination is server-side. Never slice a client array.

## Scoped permissions

CRM uses two permission shapes:

- **Static** — `crm.settings.read`, `crm.lead_stages.manage`. Exact match.
- **Scoped** — a base plus one of `.own` / `.team` / `.all`. Holding
  `crm.leads.read.team` satisfies a `crm.leads.read` requirement.

Scope narrows *which records* are visible; it is enforced server-side. An
owner filter in a query **narrows** results — it never grants access.

Full catalogue: [../reference/permissions.md](../reference/permissions.md).

## Capabilities endpoints

CRM exposes per-branch action capabilities. **Use these to drive action
visibility** rather than inferring from `/auth/me` permission strings.

```text
GET /api/tenant/crm/v1/leads/capabilities?branchId=…
GET /api/tenant/crm/v1/customer-profiles/capabilities?branchId=…
GET /api/tenant/crm/v1/opportunities/capabilities?branchId=…
```

Shape:

```json
{
  "branchId": "018f…",
  "leads": {
    "create": { "scope": "team", "ownerUserIds": ["018f…"] },
    "update": { "scope": "own",  "ownerUserIds": ["018f…"] },
    "delete": null,
    "convert": { "scope": "all", "ownerUserIds": null }
  },
  "activities": { "create": { … } },
  "notes": { "create": { … }, "delete": null },
  "attachments": { "create": { … }, "delete": null },
  "opportunities": { "create": { … } }
}
```

Reading it:

- **`null` means the action is unavailable.** Hide or disable the control.
- `ownerUserIds: null` with `scope: "all"` means no owner boundary.
- A non-null `ownerUserIds` is the explicit owner boundary for `own`/`team`
  scope — an action is only offered on records owned by one of those users.
- The leads capabilities route requires **no Leads read permission**, only
  branch membership, so it is safe to call before the list resolves.

> All three were previously documented as *not Gateway-exposed*. That was
> wrong — verified exposed on 2026-08-27 as
> `crm.leads.capabilities.get`, `crm.customer.profiles.capabilities.get`,
> `crm.opportunities.capabilities.get`.

## Branch access

CRM guards branch access three ways, visible in controller decorators:

| Decorator | Meaning |
| --- | --- |
| `@RequireBranchAccess('query')` | `branchId` in the query must be one the actor can access |
| `@RequireBranchAccess('body')` | same, from the request body |
| `@RequireRecordBranchAccess('LEAD')` | the *record's* branch must be accessible |

The frontend mirrors this by always sending a branch the user actually has —
`accessibleBranches` from `/auth/me`.

## Async work

`202 Accepted` is **not** completion. Poll the operation route documented by
the command's owner. Never call a Worker route; never rely on broker details.

## Errors

Branch on **status and code**, never on message text. Full table in
[../reference/errors.md](../reference/errors.md).

## Controller routes the Gateway does not expose

The owning controllers declare **52 routes that no Gateway contract exposes**.
They are unreachable from the browser and calling one produces a Gateway 404,
not an upstream response. Largest groups:

| Group | Count | Note |
| --- | ---: | --- |
| `core /templates/public-assets/*` | 20 | Template authoring platform; no Gateway contract |
| `core /admin/*` | 4 | Admin-master routes; not tenant-reachable |
| others | 28 | See `pnpm docs:audit-api` for the full list |

A route existing in a controller is **not** evidence it is callable. The
Gateway contract is the authority — see [../CONTRACT.md](../CONTRACT.md#source-precedence).
Never work around a missing Gateway route by calling an owning service
directly; record it in [../build/OPEN-QUESTIONS.md](../build/OPEN-QUESTIONS.md).

## Coverage

Verified 2026-08-28 by `pnpm docs:audit-api`, which parses the controllers
directly rather than trusting the inventory alone:

| | |
| --- | ---: |
| Gateway routes | 573 |
| Route-level documented (generated pages) | **573 — 100%** |
| Semantically documented | 92 |
| Semantic gaps **inside a family the portal builds** | **0** |
| Permission omissions on a documented route | **0** |

The 412 route-level-only routes are all in families with no portal screen —
dashboards, widgets, outbound email, notes, attachments, tasks, calendar,
reminders, Core organization/users/billing/templates, and all of Trade. That is
a scope decision, not an omission: documenting a contract for a screen nobody
is building would rot before it was read.

## Domain pages

| Page | Status |
| --- | --- |
| [core-auth.md](core-auth.md) | verified — live in portal |
| [core-notifications.md](core-notifications.md) | verified — live in portal |
| [crm-leads.md](crm-leads.md) | verified — live, needs 3-view work |
| [crm-customer-profiles.md](crm-customer-profiles.md) | verified — live, needs 3-view work |
| [crm-opportunities.md](crm-opportunities.md) | verified — live, needs 3-view work |
| [crm-catalogues.md](crm-catalogues.md) | verified — live |
| [core-reference.md](core-reference.md) | **generated** — all 199 Core routes |
| [crm-reference.md](crm-reference.md) | **generated** — all 143 CRM routes |
| [trade-reference.md](trade-reference.md) | **generated** — all 231 Trade routes; no portal screen |

The three `*-reference.md` pages are generated from
[../generated/tenant-api-routes.json](../generated/tenant-api-routes.json) by
`scripts/docs/generate-api-reference.mjs`. They are the exhaustive
method-and-path index; the hand-written pages carry the semantic contract.
Regenerate with `pnpm docs:api-reference`. **Never hand-edit them.**
