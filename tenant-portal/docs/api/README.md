# API Rules

Status: **verified**

Last source verification: **2026-08-27**

Inventory and Application/Addon read additions refreshed **2026-09-08** from
the generated Gateway source inventory and the separately dated domain pages.

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

Current inventory: **618 tenant routes** — Core207, CRM160, Trade231, WebPhone20. Full
table in [../generated/tenant-api-routes.md](../generated/tenant-api-routes.md);
machine-readable in the sibling `.json`. Regenerate with `pnpm docs:routes`.

## Route classes

Every Gateway route declares one. It determines transport policy.

| Class | Count | Meaning |
| --- | --- | --- |
| `AUTHENTICATED` | 233 | Standard authenticated read |
| `WRITE_SENSITIVE` | 347 | Mutation; idempotency and retry policy apply |
| `READ_HEAVY` | 23 | Larger payload/timeout allowance |
| `PUBLIC` | 15 | No session required |

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

CRM returns the payload directly. Lists are **flat** — every pagination field
sits at the top level, and there is **no `meta` wrapper anywhere in crm-app**:

```json
{
  "items": [ ],
  "total": 143,
  "page": 1,
  "limit": 25,
  "totalPages": 6,
  "hasNext": true,
  "hasPrev": false
}
```

This example said `{ items, meta }` until 2026-08-31, and it cost a real
defect: `useOpportunitiesList.ts` required `payload.meta` and threw
`"Invalid opportunities response."` on every genuine response, while its own
test fed the same wrong shape back and passed. `meta` is **Core's** shape.
Mixing the two is standing rule S1, and this page was the source of the mix.

Note `totalPages` is **0**, not 1, when `total` is 0 — `paginatedReadModels`
short-circuits before the divide.

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
| `sortDir` | `ASC` \| `DESC` | **uppercase** — see below |
| **`branchId`** | UUIDv7 | **required on every CRM list** |

`branchId` is `@IsUUID('7')` and **not optional**. A CRM list request without
it is a 422. The branch selector must resolve before the first fetch.

Pagination is server-side. Never slice a client array.

### Sort parameters differ per endpoint

There is no single sort dialect. **Verify every paginated call against its own
controller, not against the shared DTO** — this is gap G13, closed by
MASTER-PLAN task 3.37. Three forms exist today:

| Dialect | Parameters | Where | Source |
| --- | --- | --- | --- |
| **Shared** | `sortBy` + `sortDir` = `ASC` \| `DESC` | Every endpoint extending `PaginationQueryDto` — all CRM lists, Core directory | `@mutakamel/database` `dtos/pagination-query.dto`, `SortDirectionEnum` |
| **Template definitions** | `sortBy` + `sortDirection` = `asc` \| `desc` | `GET /api/tenant/core/v1/templates`, `POST /api/tenant/core/v1/templates/search` | `core-app/src/tenant/template-platform/dto/template-platform.dto.ts`, `TemplateListRequestDto` |
| **Template assets** | one combined `sort` token | `GET /api/tenant/core/v1/templates/assets` | same file, `ListTemplateAssetsQueryDto` |

The combined token is an exact enum, not a free-form `field:direction` pair —
only these four values are accepted:

```text
createdAt:desc   createdAt:asc   fileName:asc   fileName:desc
```

Two traps this closes:

- **`sortOrder` is not a query parameter anywhere.** It is an *entity field*
  on lead stages and acquisition sources — the tenant-defined display order.
  Four pages of this documentation used it as the sort direction; no code ever
  did (`useCustomerProfiles` has always sent `sortDir=DESC`).
- **Case is protocol.** `sortDir` is `ASC`/`DESC`; `sortDirection` is
  `asc`/`desc`. The wrong case is a `400`, and because the backend runs
  `forbidNonWhitelisted`, so is the wrong parameter *name*.

### `search` is per endpoint, not universal

Enumerated from service and repository source on **2026-08-31** for MASTER-PLAN
13.21. `PaginationQueryDto` carries an optional `search` (`@MaxLength(200)`),
so **every** endpoint extending it accepts the parameter — but accepting it and
honouring it are different things, and there is no way to tell from the DTO.

| Endpoint | Honours it? | Matched columns |
| --- | --- | --- |
| `GET /core/v1/directory/parties` | yes | `displayName`, `legalName`, `firstName`, `lastName`, `organizationName`, `taxNumber`, `commercialRegistrationNumber` |
| `GET /crm/v1/leads` | yes | party `display_name` / `first_name` / `last_name` / `organization_name`, **and** any `party_contact_methods.value` |
| `GET /crm/v1/customer-profiles` | yes | the same party predicate |
| `GET /crm/v1/opportunities` | yes | **`title` only** |
| `GET /crm/v1/activities` | yes | `subject` |
| `GET /crm/v1/tasks` | yes | `title` |
| `GET /crm/v1/calendar-events` | yes | `title` |
| `GET /crm/v1/reminders` | **no — accepted and ignored** | none |
| `GET /trade/v1/items` | no field | — |
| `POST /trade/v1/items/search` | exact match only | `canonical_code` / `status` / `item_kind`, compared with `=` |
| `GET|POST /trade/v1/quotations`, `sales-orders`, `purchase-orders`, `purchase-quotations`, `invoices`, `contracts` | no field | — |

Three consequences worth stating separately:

- **Leads and opportunities do not search alike.** Leads reach the party's
  contact methods; opportunities read one column. An opportunity found by its
  customer's name is not a result that route can return, and a screen that
  implies otherwise teaches users the data is missing.
- **Reminders is the dangerous one.** `RemindersQueryDto extends
  BranchListQueryDto`, so `?search=` validates — and
  `ActivitiesService.listScopedReminders` passes `undefined` where every sibling
  passes a search tuple. No `400`, no filtering, and a caller cannot tell an
  ignored term from one that matched everything. Recorded as
  [Q113](../build/OPEN-QUESTIONS.md#q113--crm-reminders-accepts-a-search-term-and-silently-ignores-it).
- **A missing field is a `400`, not a no-op.** `DocumentListQueryDto` and
  `CatalogListQueryDto` declare no `search` at all, so under
  `forbidNonWhitelisted` a speculative one is rejected outright
  ([Q110](../build/OPEN-QUESTIONS.md#q110--trade-items-cannot-be-text-searched-the-search-route-is-an-exact-code-lookup),
  [Q111](../build/OPEN-QUESTIONS.md#q111--no-commercial-document-list-accepts-a-search-term)).

`POST` on a `/search` path is not evidence of a richer query. Both Trade
document search routes bind the **same** `DocumentListQueryDto` as their `GET`
list and call the same service method; only `POST /core/v1/templates/search`
and `POST /trade/v1/items/search` take a different DTO from their `GET`.

### There is no export route

Also established 2026-08-31, for 13.22. Of the 573 Gateway routes, exactly one
matches export/csv/xlsx/download — `GET /crm/v1/attachments/:id/download`,
which streams a stored attachment. Every other CSV/XLSX reference in the three
services is **ingest**. Twelve routes render a PDF and all twelve render a
Trade *document*; nothing renders a dashboard. Recorded as
[Q114](../build/OPEN-QUESTIONS.md#q114--there-is-no-export-route-anywhere-for-any-list-or-any-dashboard).

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

Re-measured **2026-08-31** by `pnpm docs:audit-api`, which parses the
controllers directly rather than trusting the inventory alone:

| | |
| --- | ---: |
| Gateway routes | 569 |
| Route-level documented (generated pages) | **569 — 100%** |
| Semantically documented | **473** |
| **Route-level only** | **27** — 26 CRM, 1 Core |
| Permission omissions on a documented route | **0** |

**The 26 is not the same 26 the CRM audit reported, even though the number is
identical.** The audit's reading was taken before `crm-dashboards.md` landed, and
the expectation was that the count would have dropped since. It did not, and the
reason matters: **the 40 dashboard and widget routes were never among the 26.**
They are all semantically documented. The 26 are these, and they have not moved:

| Owning controller | Routes | Portal screens |
| --- | ---: | --- |
| `crm/activities/activities.controller.ts` | 11 — activities, tasks, calendar events, reminders | `/crm/activities`, `/crm/tasks`, `/crm/calendar`, `/crm/reminders` |
| `crm/notes-attachments/notes-attachments.controller.ts` | 9 — notes, attachments, upload, download | The notes and attachments panels on every CRM detail screen |
| `crm/outbound-emails/outbound-emails.controller.ts` | 6 — options, preview, create, list, detail, retry | `/crm/outbound-emails` |

**This paragraph used to say these families had "no portal screen", and that is
the part that was wrong.** It was true on 2026-08-28 and stopped being true when
Phase 8B built them. Every one of the 26 now has a screen calling it with no
hand-written contract page behind it — which is the same condition that produced
[D23](../build/DEFECTS.md#d23--editing-a-widgets-name-can-destroy-its-query-spec--fixed-2026-08-31):
a screen reconstructing a request body from what its form happened to model,
with nothing written down to contradict it.

The 1 Core entry is `GET /public/tenant-host/status`, which is public and
transport-level; `core-reference.md` covers it and no semantic page is owed.

**Stated, not closed.** Writing three contract pages is a phase of work, not a
task inside one. What is recorded here is the honest number, which families it
covers, and why it is a live risk rather than a scope decision.

**One product decision is parked on the missing activities page.** The CRM audit
review's open question 5 — reminder recipient and lifecycle — was decided:

> The recipient is the **owner of the source record at fire time, re-resolved at
> delivery**, not at creation. The reminder auto-cancels when its source task or
> activity reaches `DONE` or `CANCELLED`, and a delivery failure is a durable
> recorded fact rather than a silent drop.

Resolving the recipient at *creation* time is exactly what makes a reassignment
misdeliver, and "re-check at the moment it matters" is the same rule the email
module already applies to its final scope check — one rule, two places.

It is recorded **here** rather than in the document that owns it because that
document is one of the three above and does not exist yet. Whoever writes
`crm-activities.md` should move this into it. Leaving a decision in a coverage
note is how decisions get re-litigated, so this is a placement to fix, not a
place to add more.

## Two different questions, two different words

Every page answers both, and they are independent:

**Contract status** — does this page match backend source? `verified` means
someone opened the controllers and DTOs it describes, on the date given.

**Portal status** — what does the app actually do with these routes?

| Word | Means |
| --- | --- |
| `not built` | No screen calls these routes |
| `partial` | Some routes have screens, some do not; the page says which |
| `built` | Screens exist and every gate is green — typecheck, lint, RTL, census, contrast, unit tests, docs. **Not exercised against a live session** |
| `verified` | Driven against a real authenticated session, and observed to work |

**Nothing in this product is `verified` yet, and that is not a wording
choice.** P4 in [MANUAL-TEST-PLAN.md](../build/MANUAL-TEST-PLAN.md) is blocked:
the one tenant user is `INVITED` and both invite tokens have expired, so no
authenticated session exists to drive. Phases 4 through 8 each closed with some
form of *"nothing here has been exercised against a real authenticated
session"*. `built` is the honest ceiling until that clears.

The exception is the unauthenticated half of `core-auth`, which **has** been
driven — login screen, wrong-password, the forgot-password field binding,
`branding/public`, and `auth/me` answering 401 — recorded as runs 1 and 2 in
the manual test plan. The authenticated half has not.

## Domain pages

Target addition, aligned **2026-09-08**: [Application Addons](application-addons-target.md)
retains a planned broader consumer contract with thirteen separately verified
read endpoints. The linked domain pages identify exactly what is implemented;
the remaining target tables are not proof of callable commands. Commercial V2,
user seats and Company/Branch activation remain separate from base-only behavior.

| Page | Contract | Portal |
| --- | --- | --- |
| [application-addons-target.md](application-addons-target.md) | target; partial implementation | thirteen verified GETs, including retained invoices and assignment options; new writes remain gated |
| [application-access.md](application-access.md) | source-verified | seven scoped reads, directory/navigation/detail UI; no authenticated acceptance |
| [addon-assignments.md](addon-assignments.md) | source-verified | exact-user allocation and precondition tabs with independent seat permissions; no authenticated acceptance |
| [subscription-addons.md](subscription-addons.md) | source-verified | negotiated detail/items and accepted App/Addon prices; no authenticated acceptance |
| [subscription-offers.md](subscription-offers.md) | source-verified | owner-only published Tier/Addon explorer with independent dynamic ladders; no authenticated acceptance |
| [core-auth.md](core-auth.md) | verified | **partial** — the unauthenticated paths are verified; the authenticated half is built only |
| [core-identity.md](core-identity.md) | verified | built — Phase 4, all 50 routes called |
| [core-settings.md](core-settings.md) | verified | built — Phase 5, 30 of 33 routes |
| [core-billing.md](core-billing.md) | verified | built — Phase 6 baseline plus retained V2 invoice detail; payment DTOs unchanged |
| [core-directory.md](core-directory.md) | verified | built — Phase 7 |
| [core-templates.md](core-templates.md) | verified | **partial** — Phase 7; the layout-document editor is not buildable, see 7.12 |
| [core-notifications.md](core-notifications.md) | verified | **partial** — 9 of 14 routes unused |
| [crm-leads.md](crm-leads.md) | verified | built — Phase 8A |
| [crm-customer-profiles.md](crm-customer-profiles.md) | verified | built — Phase 8A |
| [crm-opportunities.md](crm-opportunities.md) | verified | built — Phase 8A |
| [crm-catalogues.md](crm-catalogues.md) | verified | built — Phase 8B |
| [crm-dashboards.md](crm-dashboards.md) | verified | built — Phase 9 · 40 routes |
| [trade-foundation.md](trade-foundation.md) | verified | not built — Phase 10 · 42 routes |
| [trade-documents.md](trade-documents.md) | verified | not built — Phase 11 · 60 routes |
| [trade-advanced.md](trade-advanced.md) | verified | not built — Phase 12 · 129 routes |
| [core-reference.md](core-reference.md) | **generated** — all 199 Core routes |
| [crm-reference.md](crm-reference.md) | **generated** — all 143 CRM routes |
| [trade-reference.md](trade-reference.md) | **generated** — all 231 Trade routes; no portal screen |

The three `*-reference.md` pages are generated from
[../generated/tenant-api-routes.json](../generated/tenant-api-routes.json) by
`scripts/docs/generate-api-reference.mjs`. They are the exhaustive
method-and-path index; the hand-written pages carry the semantic contract.
Regenerate with `pnpm docs:api-reference`. **Never hand-edit them.**
