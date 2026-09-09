# Core — Directory, Activities and Audit

Status: **verified**

Last source verification: **2026-08-31**

One Lead contact-edit integration re-verified: **2026-09-07**. Its per-person
modal uses existing Directory routes under the read/party-manage/contact-manage
permissions, preserving contact-method IDs. The contact-method service also
checks party write scope. See [the integration contract](crm-leads.md#contacts-on-the-one-lead-screen)
for the split Core/CRM save and partial-outcome handling.

Owning app: **core-app**

Canonical prefixes: `/api/tenant/core/v1/directory`, `.../activities`,
`.../activity-types`, `.../audit`

Portal status: **built** — MASTER-PLAN Phase 7, tasks 7.1-7.9, 7.20-7.22.

Source inspected:
`core-app/src/tenant/directory/directory.controller.ts`,
`core-app/src/tenant/directory/dto/*.dto.ts`,
`core-app/src/tenant/activities/activities.controller.ts`,
`core-app/src/tenant/activities/dto/activity.dto.ts`,
`core-app/src/tenant/audit/tenant-audit.controller.ts`,
`core-app/src/tenant/audit/audit-query.dto.ts`.

**31 routes.** Directory 21 · Activities 7 · Activity types 1 · Audit 2.

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

## Activities — 8 routes

| Method | Canonical path | Permission | Headers |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/activities` | `activities.read` | — |
| POST | `/api/tenant/core/v1/activities` | `activities.create` | `x-idempotency-key` |
| GET | `/api/tenant/core/v1/activities/:id` | `activities.read` | returns `ETag` |
| PATCH | `/api/tenant/core/v1/activities/:id` | `activities.update` | `If-Match` + `x-idempotency-key` |
| POST | `/api/tenant/core/v1/activities/:id/complete` | `activities.complete` | `If-Match` + `x-idempotency-key` |
| POST | `/api/tenant/core/v1/activities/:id/cancel` | `activities.cancel` | `If-Match` + `x-idempotency-key` |
| GET | `/api/tenant/core/v1/activities/assignees` | `activities.assign` | — |
| GET | `/api/tenant/core/v1/activity-types` | `activities.read` | — |

Activities are **cross-app**: an activity targets a CRM or Trade record, and the
service authorises against that target as well as against the activity itself.
A user who may read activities can still be refused a specific one because they
cannot see its target.

### Concurrency here is looser than email-config — do not copy one to the other

`parseIfMatch` in this controller accepts `W/"n"`, `"n"` **and** bare `n`.
`email-config` accepts only the strong `"n"` form and answers **428** when the
header is absent. Two different contracts in the same app; read the controller
before assuming.

`complete` and `cancel` return **200**, not 201 — they are `@HttpCode(200)`.
`POST /activities` returns **201**.

`GET /activities/assignees` requires `targetApp`, `targetType` and `targetId`,
and returns only users eligible for assignment **inside the authorised target
company**. It is not a general user picker — do not reuse it as one.

`GET /activity-types` is the catalogue for the activity form. Use it; do not
hardcode types.

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
| `/core/activities` | 7.22 | built |

### What the portal does not offer

**Branch-scoped party roles.** `CreatePartyRoleDto` accepts an optional
`branchId`, but `DirectoryService` re-checks it against the actor's branch scope
and answers `BRANCH_PERMISSION_DENIED`. The directory screen has no branch
picker, so offering a branch id would only produce a refusal — roles are
assigned tenant-wide until one exists.

**`GET /parties/:id/contacts` is read on organization parties only.** It returns
`emptyPage` for a `PERSON`, so the section is not rendered there.
