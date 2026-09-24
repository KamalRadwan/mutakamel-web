# Core — Directory, Activities and Audit

Status: **verified**

Last source verification: **2026-08-31**

One Lead contact-edit integration re-verified: **2026-09-07**. Its per-person
modal uses existing Directory routes under the read/party-manage/contact-manage
permissions, preserving contact-method IDs. The contact-method service also
checks party write scope. See [the integration contract](crm-leads.md#contacts-on-the-one-lead-screen)
for the split Core/CRM save and partial-outcome handling.

Activity hub re-verified: **2026-09-24** — the twelve activity routes below,
their bodies, filters, lifecycle and error codes.

Owning app: **core-app**

Canonical prefixes: `/api/tenant/core/v1/directory`, `.../activities`,
`.../activity-types`, `.../audit`

Portal status: **built** — MASTER-PLAN Phase 7, tasks 7.1-7.9, 7.20-7.22.

Source inspected:
`core-app/src/tenant/directory/directory.controller.ts`,
`core-app/src/tenant/directory/dto/*.dto.ts`,
`core-app/src/tenant/activities/activities.controller.ts`,
`core-app/src/tenant/activities/dto/activity.dto.ts`,
`core-app/src/tenant/activities/dto/activity-response.dto.ts`,
`core-app/src/tenant/activities/activity.rules.ts`,
`core-app/src/tenant/activities/activity.errors.ts`,
`core-app/src/tenant/audit/tenant-audit.controller.ts`,
`core-app/src/tenant/audit/audit-query.dto.ts`.

**35 routes.** Directory 21 · Activities 11 · Activity types 1 · Audit 2.

Everything under [core-identity.md § What applies to every route](core-identity.md#what-applies-to-every-route-on-this-page)
applies here too.

---

## Directory — 21 routes

The **party** is Core's master record for a person or an organization. CRM's
customers and contacts, and Trade's commercial accounts, are all projections of
it — they do not own the identity. Changing a party here propagates by event.

| Method | Canonical path | Permission |
| --- | --- | --- |
| GET | `/api/tenant/core/v1/directory/parties` | `directory.party.read` |
| POST | `/api/tenant/core/v1/directory/parties` | `directory.party.manage` |
| GET | `/api/tenant/core/v1/directory/parties/:id` | `directory.party.read` |
| PATCH | `/api/tenant/core/v1/directory/parties/:id` | `directory.party.manage` |
| DELETE | `/api/tenant/core/v1/directory/parties/:id` | `directory.party.manage` |
| GET | `/api/tenant/core/v1/directory/parties/:id/contacts` | `directory.party.read` |
| POST | `/api/tenant/core/v1/directory/parties/:id/image` | `directory.party.manage` |
| GET | `/api/tenant/core/v1/directory/parties/:id/image` | `directory.party.read` |
| DELETE | `/api/tenant/core/v1/directory/parties/:id/image` | `directory.party.manage` |
| POST | `/api/tenant/core/v1/directory/parties/:id/contact-methods` | `directory.contact.manage` |
| PATCH | `/api/tenant/core/v1/directory/contact-methods/:methodId` | `directory.contact.manage` |
| DELETE | `/api/tenant/core/v1/directory/contact-methods/:methodId` | `directory.contact.manage` |
| POST | `/api/tenant/core/v1/directory/parties/:id/addresses` | `directory.address.manage` |
| PATCH | `/api/tenant/core/v1/directory/addresses/:addressId` | `directory.address.manage` |
| DELETE | `/api/tenant/core/v1/directory/addresses/:addressId` | `directory.address.manage` |
| POST | `/api/tenant/core/v1/directory/parties/:id/roles` | `directory.role.manage` |
| DELETE | `/api/tenant/core/v1/directory/party-roles/:roleId` | `directory.role.manage` |
| POST | `/api/tenant/core/v1/directory/relationships` | `directory.relationship.manage` |
| DELETE | `/api/tenant/core/v1/directory/relationships/:relationshipId` | `directory.relationship.manage` |
| GET | `/api/tenant/core/v1/directory/settings` | `directory.settings.manage` |
| PATCH | `/api/tenant/core/v1/directory/settings` | `directory.settings.manage` |

**Five different permissions across one screen.** A party detail page can show
the record while refusing to edit its addresses, because `directory.party.read`
and `directory.address.manage` are independent grants. Gate each section, not
the page.

**`directory.settings` uses `.manage` for the GET as well** — there is no
separate read grant. A user who cannot manage settings cannot see them.

### The child routes do not nest under the party

Note the asymmetry: you **create** through the party
(`/parties/:id/contact-methods`) but **edit and delete by the child's own id**
(`/contact-methods/:methodId`). The same holds for addresses and roles. Keep
the child ids in your list state; you cannot reconstruct these URLs from the
party alone.

### Request bodies

| DTO | Fields |
| --- | --- |
| `CreatePartyDto` | `partyType` **required**, `displayName` (≤200) **required**, `legalName?` (≤240), `firstName?`/`lastName?` (≤120), `honorificTitle?` (≤40), `organizationName?` (≤200), `taxNumber?`/`commercialRegistrationNumber?` (≤80), `branchId?`, `ownerUserId?`, plus nested `roles?` (≤200), `contactMethods?` (≤200), `addresses?` (≤200) |
| `UpdatePartyDto` | Same scalars, all optional, **plus `status?`** — and **no** `partyType`, `roles`, `contactMethods` or `addresses`. Those move through their own routes |
| `PartyQueryDto` | `PaginationQueryDto` + `partyType?`, `status?`, `roleType?`, `branchId?`, `ownerUserId?` |
| `CreatePartyContactMethodDto` | `methodType`, `value` (≤255), `label?` (≤80), `isPrimary?` |
| `CreatePartyAddressDto` | `addressType`, `label?`, `country?`/`city?`/`area?` (≤120), `street?` (≤160), `buildingNo?`/`floor?`/`apartment?` (≤80), `landmark?` (≤160), `postalCode?` (≤40), `isPrimary?` |
| `CreatePartyRoleDto` | `roleType`, `branchId?`, `appSource?` (≤64), `metadata?` |
| `CreatePartyRelationshipDto` | `fromPartyId`, `toPartyId`, `relationshipType`, `label?` (≤120), `isPrimary?` |
| `UpdateDirectorySettingsDto` | `duplicateScope?`, `preventDuplicateEmail?`/`preventDuplicatePhone?`/`preventDuplicateWhatsapp?`, `maxContactMethodsPerParty?` (1–200), `maxAddressesPerParty?` (1–200), `partyCacheTtlSeconds?` (0–86400) |

`GET /parties/:id/contacts` takes **no filters** — deliberately. It returns the
organization → person contact relationships and nothing else.

### Party images

`POST /parties/:id/image` is multipart, ≤2 MB, and the server **decodes and
re-normalises the image with sharp** before storing. That means a file can be
the right MIME and the right size and still be rejected as
`PARTY_IMAGE_INVALID` (**415**) because it is not a decodable image.

Three distinct failures again: `PARTY_IMAGE_REQUIRED` (400),
`PARTY_IMAGE_INVALID` (415), `PARTY_IMAGE_TOO_LARGE` (413).

`GET /parties/:id/image` is `private, no-store` + `nosniff` — it is authorised
per request, so it cannot be cached or used as a public avatar URL.

### Duplicate prevention is a setting, not a constant

`directory/settings` controls whether duplicate email, phone or WhatsApp values
are refused, and at what scope. A create that fails on a duplicate is therefore
a **configured** outcome — surface which setting caused it, not just "duplicate".

---

## Activities — 12 routes

Core's **activity hub**: one record per call, meeting, visit or task, booked
against a CRM, Core or Trade record. Every portal surface that shows activities
reads it — the Activities workspaces at `/core/activities` (every app) and
`/crm/activities` (CRM records only), the shared activity modal and the
activity panel on each CRM record's detail page.

| Method | Canonical path | Permission | Headers |
| --- | --- | --- | --- |
| POST | `/api/tenant/core/v1/activities` | `activities.create` — plus `activities.update` for `status: IN_PROGRESS`, `activities.complete` for `status: DONE` | `x-idempotency-key` |
| GET | `/api/tenant/core/v1/activities` | `activities.read` | — |
| GET | `/api/tenant/core/v1/activities/summary` | `activities.read` | — |
| GET | `/api/tenant/core/v1/activities/calendar` | `activities.read` | — |
| GET | `/api/tenant/core/v1/activities/targets` | `activities.create` | — |
| GET | `/api/tenant/core/v1/activities/assignees` | `activities.assign` | — |
| GET | `/api/tenant/core/v1/activities/:id` | `activities.read` | returns `ETag` |
| PATCH | `/api/tenant/core/v1/activities/:id` | `activities.update` | `If-Match` + `x-idempotency-key` |
| POST | `/api/tenant/core/v1/activities/:id/status` | `activities.update` | `If-Match` + `x-idempotency-key` |
| POST | `/api/tenant/core/v1/activities/:id/complete` | `activities.complete` | `If-Match` + `x-idempotency-key` |
| POST | `/api/tenant/core/v1/activities/:id/cancel` | `activities.cancel` | `If-Match` + `x-idempotency-key` |
| GET | `/api/tenant/core/v1/activity-types` | `activities.read` | — |

Every response is the Core envelope (`{ success, data }`) with
`Cache-Control: no-store, private`. A single-activity response also carries
`ETag: "<version>"`, and a replayed idempotent write `Idempotency-Replayed: true`.

Activities are **cross-app**: an activity targets a CRM, Core or Trade record,
and the service authorises against that target as well as against the activity
itself. A user who may read activities can still be refused a specific one
because they cannot see its target.

### Who may act on which activity

The route permission opens the route; the service then decides per activity.
The base key acts on activities the actor is **assigned to or created**; the
`.all` key acts **branch-wide** in an authorised branch; the tenant owner may do
anything.

| Action | Own | Branch-wide |
| --- | --- | --- |
| read | `activities.read` | `activities.read.all` |
| update, start, move back to scheduled | `activities.update` | `activities.update.all` |
| complete | `activities.complete` | `activities.complete.all` |
| cancel | `activities.cancel` | `activities.cancel.all` |
| create | `activities.create` in the target's branch | — |
| assign to someone else | `activities.assign` | — |

`@RequirePermissions` is an exact match, so every route still needs its **base**
key — `activities.read.all` alone opens nothing. The portal's admission mirrors
this table per activity and is advisory; see
[permissions.md](../reference/permissions.md#core-tenant-permissions).

### Statuses and transitions

`PLANNED` and `IN_PROGRESS` are **open**; `DONE` and `CANCELLED` are terminal
and never change again.

| From → to | Command |
| --- | --- |
| (new) → `PLANNED` | `POST /activities` — the default `status` |
| (new) → `IN_PROGRESS` | `POST /activities` with `status: "IN_PROGRESS"` |
| (new) → `DONE` | `POST /activities` with `status: "DONE"` — logs a past activity |
| `PLANNED` ↔ `IN_PROGRESS` | `POST /activities/:id/status` with `{ "status": "PLANNED" \| "IN_PROGRESS" }` |
| open → `DONE` | `POST /activities/:id/complete` with an optional `outcome` (≤2000) |
| open → `CANCELLED` | `POST /activities/:id/cancel` with an optional `reason` (≤2000) |
| open, fields | `PATCH /activities/:id` |

A create with a status other than `PLANNED` is stored as a planned activity plus
its transition in one transaction, so the `CREATED` event always carries
`PLANNED`. `POST /:id/status` with the current status is a **no-op**: the
current view comes back with no save, no event and no version bump. Any write on
a terminal activity is **409 `ACTIVITY_TERMINAL`**. `status`, `complete` and
`cancel` return **200**, not 201 — they are `@HttpCode(200)`;
`POST /activities` returns **201**.

### The activity view

Create, get, update, every lifecycle command, and each item of the list and the
calendar return the same shape:

```jsonc
{
  "id": "uuid", "type": "MEETING", "subject": "Product demo", "description": null,
  "direction": null, "priority": "HIGH", "status": "IN_PROGRESS",
  "dueAt": "ISO", "endsAt": "ISO | null", "location": "string | null", "meetingUrl": "string | null",
  "completedAt": null, "cancelledAt": null, "outcome": null,
  "assigneeUserId": "uuid", "assigneeName": "string | null",
  "createdByUserId": "uuid", "createdByName": "string | null",
  "branchId": "uuid", "companyId": "uuid", "version": 3,
  "createdAt": "ISO", "updatedAt": "ISO",
  "targets": [{ "id": "uuid", "role": "PRIMARY | CONTEXT", "targetApp": "CRM", "targetType": "LEAD",
                "targetId": "uuid", "label": "string", "route": "string",
                "targetVersion": "string | null", "unavailableAt": "ISO | null" }]
}
```

`outcome` holds the completion note or the cancellation reason. A target's
`route` addresses another application's UI and is never followed — the portal
links only to detail routes it built itself.

### Create and update bodies

| Field | Create | Update | Rule |
| --- | --- | --- | --- |
| `target` `{ app, type, id }` | required | — fixed | `type` must be one of the app's target types |
| `type` | required | optional | `TODO` `CALL` `MEETING` `EMAIL` `VISIT` `FOLLOW_UP` `OTHER` |
| `subject` | required | optional | trimmed, non-blank, ≤180 |
| `description` | optional | optional, `null` clears | ≤4000; blank is stored as `null` |
| `direction` | optional | optional, `null` clears | `INBOUND` `OUTBOUND` `INTERNAL` |
| `priority` | optional, `NORMAL` | optional | `LOW` `NORMAL` `HIGH` `URGENT` |
| `dueAt` | required | optional | ISO instant |
| `endsAt` | optional | optional, `null` clears | after `dueAt`, at most 14 days after it |
| `location` | optional | optional, `null` clears | ≤180; blank is stored as `null` |
| `meetingUrl` | optional | optional, `null` clears | ≤2048, a full `http://` or `https://` link |
| `assigneeUserId` | optional, the actor | optional | someone else needs `activities.assign` |
| `status` | optional, `PLANNED` | — | `PLANNED` `IN_PROGRESS` `DONE` |
| `outcome` | optional | — | ≤2000, only with `status: "DONE"` |

Each rule below fails as **422 `ACTIVITY_INVALID`** with a plain message:

- `status: PLANNED` needs a future `dueAt`; `DONE` needs a `dueAt` no later than
  five minutes from now; `IN_PROGRESS` has no due constraint.
- An update needs at least one field and applies only to an open activity. The
  window is checked as it will be stored — a new `endsAt` against the stored
  `dueAt`, and the reverse — and a changed `dueAt` must lie ahead only while the
  activity is `PLANNED`.

Both bodies are whitelisted with `forbidNonWhitelisted`: an unknown key is a 400.
Status changes are never a `PATCH` field.

### List — `GET /activities`

`page`, `limit` (≤100), `sortBy` (`dueAt` only), `sortDir`, `search` (≤200,
matched against the subject), plus:

| Filter | Shape |
| --- | --- |
| `branchId`, `assigneeUserId` | UUIDv7 |
| `targetApp`, `targetType`, `targetId` | one record's activities; `targetType` and `targetId` need `targetApp`, `targetId` needs `targetType` |
| `statuses`, `types`, `priorities` | comma-separated and unique, e.g. `statuses=PLANNED,IN_PROGRESS` |
| `dueFrom`, `dueTo` | ISO instants, `dueFrom` before `dueTo`; keeps `dueFrom ≤ dueAt < dueTo` |
| `overdue` | `true` or `false` — open, and its end (or its due time, without an end) has passed |

The page is `data: { items, total, page, limit, totalPages, hasNext }` — **no
`hasPrev`** and no `meta`; derive the previous-page state from `page`.

### Summary — `GET /activities/summary`

The list's filters except `statuses`, `overdue`, pagination and sort, plus the
**required** `dayStart` and `dayEnd`: the viewer's local day as ISO instants,
`dayEnd` after `dayStart`, at most 48 hours apart.

```json
{ "overdue": 4, "today": 6, "upcoming": 18, "completedToday": 3,
  "byStatus": [
    { "status": "PLANNED", "total": 20, "overdue": 3, "today": 5, "upcoming": 12 },
    { "status": "IN_PROGRESS", "total": 8, "overdue": 1, "today": 1, "upcoming": 6 },
    { "status": "DONE", "total": 31, "overdue": 0, "today": 0, "upcoming": 0 },
    { "status": "CANCELLED", "total": 1, "overdue": 0, "today": 0, "upcoming": 0 } ] }
```

All four statuses, in enum order, zero-filled. An open activity is **overdue**
when its end (or due time) has passed, **today** when it is not overdue and is
due before `dayEnd`, and **upcoming** otherwise. `completedToday` counts `DONE`
activities completed in `[dayStart, dayEnd)`. The top-level three are sums over
the open statuses, and visibility is exactly the list's.

### Calendar — `GET /activities/calendar`

The list's filters — including `statuses`, `overdue` and `search` — except
pagination, sort and `dueFrom`/`dueTo`, plus the **required** `from` and `to`:
`to` after `from`, at most 62 days apart. It returns every activity whose
`[dueAt, endsAt]` overlaps `[from, to)`, ordered by `dueAt` then `id`, **at most
500**, as `data: { items, truncated }`. `truncated: true` means more exist:
narrow the filters, there is no next page.

### Record picker — `GET /activities/targets`

`targetApp` and `targetType` are required (the type must belong to the app),
with `branchId?` and `search?` (≤100, matched against the label). It returns up
to **20** `[{ targetApp, targetType, targetId, label, branchId }]`, ordered by
label — only records the caller could create an activity on right now: write
entitlement for the app, current read access to the record, and
`activities.create` in its branch. Authorisation runs **before** the limit, so
twenty rows are twenty usable rows. An application the tenant may not write
answers an empty list, not a 403.

### Assignees — `GET /activities/assignees`

`targetApp`, `targetType` and `targetId` are all required, with `search?`
(≤100). It returns only users eligible for assignment **inside the authorised
target company**. It is not a general user picker — do not reuse it as one.

### Concurrency here is looser than email-config — do not copy one to the other

`parseIfMatch` in this controller accepts `W/"n"`, `"n"` **and** bare `n`.
`email-config` accepts only the strong `"n"` form and answers **428** when the
header is absent. Two different contracts in the same app; read the controller
before assuming. Here a missing or malformed `If-Match` is **428
`ACTIVITY_VERSION_REQUIRED`**, and a version that moved is **409
`ACTIVITY_VERSION_CONFLICT`**.

`GET /activity-types` is the canonical catalogue `[{ key, label, icon,
defaultPriority }]` — the same seven keys `@IsIn` accepts on the bodies.

### Errors

| Code | HTTP | Meaning |
| --- | --- | --- |
| `ACTIVITY_NOT_FOUND` | 404 | the activity or its target does not exist, or is outside the caller's sight |
| `ACTIVITY_ACCESS_DENIED` | 403 | the activity is outside the caller's authority |
| `ACTIVITY_INVALID` | 422 | a body, filter or schedule rule failed — the message names it |
| `ACTIVITY_VERSION_REQUIRED` | 428 | `If-Match` missing or malformed |
| `ACTIVITY_VERSION_CONFLICT` | 409 | the activity changed since it was read — reload it |
| `ACTIVITY_TERMINAL` | 409 | the activity is already `DONE` or `CANCELLED` |
| `ACTIVITY_TARGET_RESOLVER_UNAVAILABLE` | 503 | the target's application did not answer |
| `ACTIVITY_IDEMPOTENCY_IN_FLIGHT` | 409 | the same key is still being processed |
| `ACTIVITY_IDEMPOTENCY_MISMATCH` | 422 | the key was already used for a different body |
| `ACTIVITY_IDEMPOTENCY_KEY_INVALID` | 422 | `x-idempotency-key` is missing or not a UUIDv7 |

The portal translates each under `t.activities.errors` and falls back to the
generic message; [error-codes.md](../reference/error-codes.md#core-activities)
lists the same set, generated from source.

---

## Audit — 2 routes

| Method | Canonical path | Permission |
| --- | --- | --- |
| GET | `/api/tenant/core/v1/audit` | `audit.read` |
| GET | `/api/tenant/core/v1/audit/entities/:entityType/:entityId` | `audit.read` |

Both are `Cache-Control: no-store`.

The ledger is **append-only**. Each row unpacks a `_audit` metadata block
carrying `sourceApp`, `sourceKind`, `outcome`, `requestId`, `operationId`,
`idempotencyKey` and `reason`. Surface `outcome` and `reason` — a row that only
shows "user X updated Y" throws away the half that matters during an incident.

`/audit/entities/:entityType/:entityId` is the per-record history. Embed it on
every detail screen that has one, via the `Timeline` pattern (task 7.21).

### Related Party history

The same entity route accepts optional `relatedPartyIds`, a comma-separated
list of 1–21 unique UUIDv7 IDs. One Lead passes `[lead.partyId,
...lead.contacts.map(contact => contact.partyId)]` from its detail response.
There is one HTTP request and one set-based Core query, not one per contact.
Omitting the parameter preserves the original exact-entity reader. It is not
accepted on the tenant-wide audit list.

Related mode includes `Lead`/`LeadEntity`, `party`/`PartyEntity`, contact-method,
address and mutual-relationship aliases for the selected Parties, including
soft-deleted child records. It does not discover unrelated company contacts or
read CRM tables. `audit.read` is the existing **tenant-wide** ledger permission;
all results still bind the active tenant.

Domain events are grouped by recorded request ID (otherwise correlation ID,
otherwise individual audit ID), actor and source app. Requests are grouped
**before pagination**; duplicate changes are removed within a group, never
across unrelated requests or different contact entities. `items` contains
`id`, `action`, `createdAt`, `actorLabel`, `actorType`, `outcome`, `reason` and
`diff: [{ field, before, after, subjectId?, subjectLabel? }]`. A phone replacement
written as remove + create becomes one transition of old/new value arrays.
Only stored, redacted evidence supplies values. `[NOT_RECORDED]` means an older
writer omitted the value; the current Party value must not fill that gap.

### One pagination detail that will bite

This endpoint returns `{ items, total, page, limit, totalPages }` — **no
`hasNext` / `hasPrev`**, unlike the repository-backed lists elsewhere in Core.
Derive them from `page` and `totalPages`, or the pager renders wrong at the
last page.

---

## Portal status per screen

| Screen | Plan task | State |
| --- | --- | --- |
| `/core/directory` list, three views | 7.1 | built |
| `/core/directory/[id]` detail | 7.2–7.3 | built |
| Contact methods · addresses · relationships | 7.4, 7.5, 7.7 | built |
| Party roles | 7.6 | built, tenant-wide only — see below |
| Party image | 7.8 | built |
| `/core/directory/settings` | 7.9 | built |
| `/core/audit` | 7.20 | built |
| Entity history on detail screens | 7.21 | built on party and template detail |
| `/core/activities` — the Activities workspace, every app | 7.22 | rebuilt 2026-09-24 on the activity hub |
| `/crm/activities` — the same workspace, CRM records only | — | built 2026-09-24; admitted by `activities.read` and a read on some CRM record type |
| Activity modal and record panels on lead, customer and opportunity screens | — | built 2026-09-24 |

### What the portal does not offer

**Branch-scoped party roles.** `CreatePartyRoleDto` accepts an optional
`branchId`, but `DirectoryService` re-checks it against the actor's branch scope
and answers `BRANCH_PERMISSION_DENIED`. The directory screen has no branch
picker, so offering a branch id would only produce a refusal — roles are
assigned tenant-wide until one exists.

**`GET /parties/:id/contacts` is read on organization parties only.** It returns
`emptyPage` for a `PERSON`, so the section is not rendered there.
