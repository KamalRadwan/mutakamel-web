# CRM — Leads

Status: **verified**

Last source verification: **2026-09-07**

Contact detail/write contract re-verified: **2026-09-07** (scoped update below).

Basic search GET/POST, semantic text scopes, Tag, owner filtering and pagination
re-verified: **2026-09-16**.

Board/Card/Table projections and Card bulk document counts verified: **2026-09-16**.

Related quotation/sales-order count scope re-verified: **2026-09-14**.

Activity panel and card activity modal moved to Core's activity hub:
**2026-09-24** ([frontend notes](#one-lead-side-panel-contract-2026-09-07)).

Owning app: **crm-app**

Canonical prefix: `/api/tenant/crm/v1/leads`

Upstream: `/api/v1/crm/leads` (`@Controller({ path: 'crm/leads', version: '1' })`)

Portal status: **built** — list, create (including atomic multi-tag assignment),
delete, stage move, detail, update and conversion are all server-backed. Not exercised against a live session:
CRM is blocked twice over, by P4 and by Q17.

`GET /leads/capabilities` is `BRANCH_REQUIRED` in the Gateway route contract:
it needs `x-mutakamel-company-id` and `x-mutakamel-branch-id` as well as the
`branchId` query parameter. Without them `RouteContextMiddleware` answers
`400 GW.REQUEST.INVALID` before crm-app sees the request, which reads exactly
like "no capabilities" and is not a permission answer.

The company header comes from `/auth/me.accessibleBranchCompanies`, with
branch-specific team memberships used only when an older Core response omits
that field. This supports owners and role grants without a matching team
membership. The shared scope hook preserves header identity until the company,
branch, or route mode changes, so loading and error state updates do not restart
the list or detail capabilities requests. A failed list retains its error and
correlation reference; retries are explicit, and selecting another branch
starts one new load.

The related-record counts in a Lead detail page send **both company and branch
headers on all three Trade reads** (quotations, sales orders, invoices), using
the Lead's own branch. Quotation and sales-order Gateway rows omit
`organizationScopeMode`; this is legacy owning-app validation, not an explicit
`NONE` policy. `QuotationsController.list` and `SalesOrdersController.list`
require `TradeScopeTarget.BRANCH`. Sending them without the selectors fails
`TRADE.CONTEXT.MISSING_COMPANY`. `partyId` remains the document query filter;
it does not supply organization context.

When the verified branch/company mapping is unavailable, Trade count requests
wait and render an unknown count, while CRM opportunity counts can still load.
When the mapping arrives or changes, requests use the new scope and late
responses from the previous request are discarded. CRM opportunity search
continues to send its `branchId` in the body, without Trade selector headers.

Source inspected:
`crm-app/src/crm/leads/leads.controller.ts`,
`crm-app/src/crm/leads/dto/lead.dto.ts`,
`crm-app/src/crm/common/dto/crm-list-query.dto.ts`,
`api-gateway-app/src/routing-proxy/route-contracts/crm.route-contracts.ts`.

## Routes

| Method | Canonical path | Route key | Class | Permission |
| --- | --- | --- | --- | --- |
| POST | `/leads` | `crm.leads.post` | WRITE_SENSITIVE | `crm.leads.create` (scoped) |
| GET | `/leads` | `crm.leads.get` | AUTHENTICATED | `crm.leads.read` (scoped) |
| POST | `/leads/search` | `crm.leads.search.post` | READ_HEAVY | `crm.leads.read` (scoped) |
| POST | `/leads/board` | `crm.leads.board.post` | READ_HEAVY | `crm.leads.read` (scoped) |
| POST | `/leads/board/stages/:stageId` | `crm.leads.board.stages.by.stage.id.post` | READ_HEAVY | `crm.leads.read` (scoped) |
| GET | `/leads/capabilities` | `crm.leads.capabilities.get` | AUTHENTICATED | **none** — branch membership only |
| GET | `/leads/company-options` | `crm.leads.company.options.get` | AUTHENTICATED | `crm.leads.create` (scoped) |
| GET | `/leads/company-options/:companyPartyId/contacts` | — | AUTHENTICATED | `crm.leads.create` (scoped) |
| GET | `/leads/:id` | `crm.leads.by.id.get` | AUTHENTICATED | `crm.leads.read` (scoped) |
| GET | `/leads/:id/tags` | `crm.leads.by.id.tags.get` | AUTHENTICATED | `crm.leads.read` (scoped) |
| PATCH | `/leads/:id` | `crm.leads.by.id.patch` | WRITE_SENSITIVE | `crm.leads.update` (scoped) |
| POST | `/leads/:id/tags` | `crm.leads.by.id.tags.post` | WRITE_SENSITIVE, non-idempotent | `crm.leads.update` (scoped) |
| DELETE | `/leads/:id/tags/:tagId` | `crm.leads.by.id.tags.by.tag.id.delete` | WRITE_SENSITIVE, non-idempotent | `crm.leads.update` (scoped) |
| POST | `/leads/:id/stage` | `crm.leads.by.id.stage.post` | WRITE_SENSITIVE | `crm.leads.update` (scoped) |
| POST | `/leads/:id/convert` | `crm.leads.by.id.convert.post` | WRITE_SENSITIVE | `crm.leads.convert` (scoped) |
| DELETE | `/leads/:id` | `crm.leads.by.id.delete` | WRITE_SENSITIVE | `crm.leads.delete` (scoped) |

Branch guards: `@RequireBranchAccess('body')` on create, search and both Board reads,
`@RequireBranchAccess('query')` on the list and both option routes,
`@RequireRecordBranchAccess('LEAD')` on every `:id` route.

## GET /leads — list

Query (`LeadsQueryDto extends BranchListQueryDto extends PaginationQueryDto`):

| Parameter | Type | Required | Notes |
| --- | --- | --- | --- |
| `branchId` | UUIDv7 | **yes** | `@IsUUID('7')`, not optional |
| `page` | integer ≥ 1 | no | |
| `limit` | integer | no | endpoint-bounded |
| `sortBy` | string | no | **`displayName` or `createdAt` only.** Default `createdAt`. Anything else is a `400` — the service does **not** fall back |
| `sortDir` | `ASC` \| `DESC` | no | Uppercase. **Not** `sortOrder`, which is a lead-stage *field* — see [README.md#sort-parameters-differ-per-endpoint](README.md#sort-parameters-differ-per-endpoint) |
| `search` | string ≤ 200 | no | Free text over the party's **display name, first name, last name, organization name and contact methods** (phone/email). **Not** the lead's `description`, despite `LeadsRepository.searchableFields` — the list path is a hand-written query that never reads that array |
| `leadProfileType` | `CrmProfileTypeEnum` | no | `INDIVIDUAL` \| `CORPORATE` |
| `status` | `LeadStatusEnum` | no | `OPEN` \| `CONVERTED` \| `DISQUALIFIED` \| `ON_HOLD` |
| `stageFlag` | `LeadStageFlagEnum` | no | 8 values — see [enums](../reference/enums.md#leadstageflagenum) |
| `stageId` | UUIDv7 | no | tenant lead-stage catalogue id |
| `acquisitionSourceId` | UUIDv7 | no | |
| `ownerUserId` | UUIDv7 | no | **narrows only — never grants access** |

Response: `200`, top-level pagination fields (`items`, `total`, `page`,
`limit`, `totalPages`, `hasNext`, `hasPrev`) — **raw CRM shape, not a Core
envelope.** Card/Table rows include `leadProfileType`, the lead Party's primary
`address`, and `primaryContact` with `partyId`, `displayName`, `jobTitle`,
`email`, `phones[]` and `isPrimary`. `acquisitionSourceIconUrl` is the
authenticated, cache-versioned public route for the source avatar, or `null`.
The Party address means an individual gets the person's country while a
corporate Lead gets the company's country.

Scoped read narrows results by the actor's own/team/all scope on top of the
branch filter. An empty page is not proof that no leads exist.

## POST /leads/board · /leads/board/stages/:stageId

Board uses a separate lightweight projection. The initial route returns every
active stage in `sortOrder`, each with its own page of exactly 50 cards, total
and `hasNext`. The stage route returns the requested next page only, so the
column's More button does not reload another stage. Both routes accept the same
basic/advanced filter body as `/leads/search`; the server adds each lane's
stage constraint after scoped access.

Board cards include identity/type, stage, owner, rating, colour, next activity,
primary-contact name and tags. Each tag is `{ id, name, backgroundColor,
textColor }` — the colour pair is upper-case `#RRGGBB` or both `null`
(2026-09-24, [catalogues](crm-catalogues.md#tags)). They omit address, primary-contact details,
email and phone aggregates. Card and Table remain global paginated list/search
reads and become stage-filtered only when the user selects a stage.

## GET /leads/capabilities

Query: `branchId` (required). **No leads permission required** — branch
membership is enough, so it is safe to call before the list resolves.

Response `200`:

```json
{
  "branchId": "018f0000-0000-7000-8000-000000000001",
  "leads": {
    "create":  { "scope": "team", "ownerUserIds": ["018f…101"] },
    "update":  { "scope": "own",  "ownerUserIds": ["018f…101"] },
    "delete":  null,
    "convert": { "scope": "all",  "ownerUserIds": null }
  },
  "activities":    { "create": { "scope": "team", "ownerUserIds": ["018f…101"] } },
  "notes":         { "create": { … }, "delete": null },
  "attachments":   { "create": { … }, "delete": null },
  "opportunities": { "create": { "scope": "all", "ownerUserIds": null } }
}
```

**This drives every action control on the screen.** `null` = unavailable.
`ownerUserIds: null` with `scope: "all"` = no owner boundary; a non-null array
is the explicit owner boundary for `own`/`team`.

Do not infer action availability from `/auth/me` permission strings when this
endpoint exists — it already accounts for branch and owner scope.

## POST /leads — create

Body: `CreateLeadDto` (`crm-app/src/crm/leads/dto/lead.dto.ts`). Must include
the branch, since `@RequireBranchAccess('body')` reads it from the payload.

Success `201` with the created lead. Errors: `409` conflict, `422` validation.

`forbidNonWhitelisted` is on — send only documented keys.

### Tags during creation

`CreateLeadDto.tagIds` is an optional array of up to 50 unique UUIDv7 ids from
the tenant tag catalogue. Omit it or send `[]` to create a lead without tags.
The modal sends all selected ids inside the single `POST /leads` body:

```json
{
  "branchId": "018f0000-0000-7000-8000-000000000001",
  "leadProfileType": "INDIVIDUAL",
  "displayName": "New prospect",
  "tagIds": [
    "0192b7ea-7c4f-7a7d-9c9f-51c7f2b3ab01",
    "0192b7ea-7c4f-7a7d-9c9f-51c7f2b3ab02"
  ]
}
```

The lead, its Party changes, custom fields and tag links share the creation
transaction. An unknown or deleted tag returns `422 CRM_TAG_UNKNOWN` and rolls
back the complete creation; malformed, duplicate or over-limit ids are rejected
by DTO validation. The `201` lead response includes the saved `tags` array of
`{ id, name, backgroundColor, textColor }`.

The picker's **Create tag** modal posts `{ name }` or
`{ name, backgroundColor, textColor }` to `/tags` (`crm.tags.manage`), and the
created tag joins the picker with its colour.

Initial tag assignment uses the existing scoped `crm.leads.create` authority;
it does not require `crm.leads.update` or `crm.tags.manage`. The picker requires
exact `crm.tags.read` to load catalogue choices. The create request keeps its
existing idempotency key, so a retry replays the whole creation result. The
modal does not call the separate tag-attachment endpoint after creation.

Changing tags on an existing lead still uses `/leads/:id/tags` and requires
scoped `crm.leads.update`; those standalone writes remain non-idempotent.

Roll out the backend contract before this portal version: older CRM builds
reject `tagIds` as an unknown create field. Existing clients that omit it remain
compatible. This change adds no schema migration; the tenant must already have
the existing CRM tags migration (`1801000000130-crm-tags-v1`).

## POST /leads/:id/stage — move stage

The board view's drag-and-drop target.

Body: `MoveLeadStageDto` — the destination tenant lead-stage id.

Success **`201`** (not 200) with the lead after movement. Errors: `404`, `422`.

The backend derives lifecycle `status` from the destination stage's semantic
flag. **Do not set `status` yourself** — moving into a stage flagged
`CONVERTED` or `DISQUALIFIED` is what changes the status, server-side.

Both of those are terminal and require confirmation before the request — see
[../design/views.md](../design/views.md#board-view).

## POST /leads/:id/convert

Verified 2026-09-18 against all conversion DTO classes in
`crm-app/src/crm/leads/dto/lead.dto.ts`, the complete `LeadsService.convert`
transaction and its validation/helpers, `PartyDirectoryAdapter`, scoped owner
assignment, and Gateway `crm.route-contracts.ts`.

Promotes the lead's existing Party to a customer profile. Qualification is
required only when tenant settings enable `requireQualifiedStageForConversion`;
the server remains the authority for that condition.

Body: `ConvertLeadDto`. Actual service success **201**:

```json
{
  "lead": { "id": "…", "status": "CONVERTED", "convertedCustomerProfileId": "…", "convertedOpportunityId": "…" },
  "leadId": "…",
  "leadDeleted": false,
  "customerProfileId": "…",
  "opportunityId": "…"
}
```

The lead above is abbreviated; when retained, the real response carries the
complete Lead detail read model. With `keepLead: false`, the response carries
`lead: null`, the original `leadId`, and `leadDeleted: true`. `opportunityId`
is **omitted** when no opportunity is
created; otherwise it matches `lead.convertedOpportunityId`.
`customerProfileId` matches `lead.convertedCustomerProfileId`.
These are **flat UUIDv7 IDs**, not the outdated Swagger
`customerProfile: {…}, opportunity: {…}` example (tracked in Q135).
The frontend validates both references, the requested lead ID and converted
status before displaying the receipt links.

### Complete conversion input

| Field | DTO / service contract |
| --- | --- |
| `profileType` | Required `INDIVIDUAL \| CORPORATE`; must match the lead's existing Party type |
| `displayName`, `companyName` | Optional non-empty strings, max 180; omission retains the existing name/fallback |
| `primaryContact` | Optional nested **new person**, not an existing-contact update |
| `createOpportunity` | Optional strict boolean |
| `keepLead` | Optional strict boolean; omission preserves the previous behavior (`true`). The portal asks and sends the choice explicitly |
| `opportunity` | Required when the switch is true; forbidden when it is false/omitted |

`LeadConversionContactPersonDto`:

| Field | Contract |
| --- | --- |
| `fullName` | Optional non-empty string, max 180; absent name is composed from first/last name; an empty resulting name is rejected |
| `firstName`, `lastName` | Optional strings, max 80 each |
| `jobTitle` | Optional string, max 120 |
| `email` | Optional valid email, max 180 |
| `contactMethods` | Optional array, at most 20; no silent truncation |
| `contactMethods[].methodType` | Required `PHONE \| MOBILE \| EMAIL \| WHATSAPP \| WEBSITE \| OTHER` |
| `contactMethods[].value` | Required non-empty string, max 255 |
| `contactMethods[].label` | Optional string, max 80 |

For a corporate lead, omitting `primaryContact` reuses its existing primary
contact if present. Supplying it **creates another person and relationship**.
The modal defaults that toggle off and never prefills company identity as a
person. An individual uses its own Party as its contact and sends no nested
`primaryContact`. Duplicate methods are checked using the adapter's
normalization, including an email repeated in the email field and method list.

`ConvertLeadOpportunityDto`:

| Field | Contract |
| --- | --- |
| `pipelineId` | Required UUIDv7 of an active pipeline accessible to the actor |
| `stageId` | Required UUIDv7 of that pipeline's **membership** (`CrmPipelineStage.id`), not the master stage ID |
| `title` | Required non-empty string, max 180 |
| `importance` | Optional integer 0–3; server default 0 |
| `amount` | Optional finite number >= 0, at most two decimal places; UI retains a decimal string until the tested money wire conversion |
| `description` | Optional string, max 2000 |
| `currencyCode` | Optional string, length 3 after trim/uppercase |
| `ownerUserId` | Optional UUIDv7; inherits lead owner, or actor if lead is unassigned |
| `expectedCloseDate` | Optional ISO date string; this modal uses a date-only picker |
| `probabilityPercent` | Optional integer 0–100 |
| `customFields` | Optional object; CREATE requirements for OPPORTUNITY are enforced |

Only active memberships appear; `WON`/`LOST` are forbidden for conversion.
Changing pipeline clears the selected membership. The switch defaults off and
requires the independent `opportunities.create` capability returned with
`GET /leads/capabilities?branchId=…`. The server separately validates owner
assignment and branch eligibility.

Reference reads: `GET /pipelines` requires `crm.pipelines.read`.
Owner options use branch-visible ACTIVE users from Core `GET /users`
(`users.user.read`, page/limit 100, all pages), narrowed by the creation
capability's owner IDs. The active authenticated actor can also be a verified
candidate. Missing directory permission does not invent names or raw-ID inputs;
inheritance remains available. Custom fields reuse the shared create definition
reader and wait for its request; unavailable definitions show a degraded
notice, with the server retaining required-field authority.

### Conversion cannot change a Party from a person into an organization

The service passes the lead's existing `partyId` to
`PartyDirectoryAdapter.ensureParty`. A mismatched type produces
**409 PARTY_TYPE_IMMUTABLE**. The modal displays a read-only profile type.
A genuine individual-to-company promotion would require a new organization and
relationship; that is not part of this operation.

### Writes and failures

Gateway contract: `WRITE_SENSITIVE`, idempotent, operation
`CRM.LEAD.CONVERT`, fingerprint `crm.lead.convert.v1`, transport retry
`NEVER`, replay response limit 131072 bytes. The UI uses the canonical
`/api/tenant/crm/v1/leads/:id/convert` path, one UUIDv7
`x-idempotency-key` and one immutable request body per submitted attempt.
No automatic conversion is triggered on open, field change or review.

With `keepLead: false`, conversion creates the customer profile and optional
opportunity first, then soft-deletes only the CRM Lead and its lead-owned
contact/tag/custom-field mappings in the same transaction. The shared Party,
customer profile, Party contact relationships and opportunity remain. A later
`DELETE /leads/:id` of a retained converted lead likewise deletes only the
Lead aggregate; it never cascades into the converted customer or Party.

Errors include 403 scoped access/owner denial, 404 missing lead, 409
`LEAD_ALREADY_CONVERTED` / `PARTY_TYPE_IMMUTABLE`, and 422 conversion,
contact-name, pipeline-stage, nested-opportunity or required-custom-field
validation. Preserve the draft on a definite rejection and refresh on conflict.
An uncertain outcome freezes the body/key even across modal close/reopen and
offers explicit same-request retry plus refresh. Applied-but-unreadable 2xx
permits refresh, never another write. See the
[modal behavior](../design/detail-screens.md#lead-conversion).

## PATCH /leads/:id · DELETE /leads/:id

Update returns `200` with the updated lead (`404`, `409`, `422`).
Delete is a **soft delete**, returns **`204` with no body** (`404`, `409`).
Deleting a converted lead does not delete its Party, customer profile, contact
relationships, or converted opportunity.

### Contacts on the One Lead screen

Source: `crm-app/src/crm/leads/dto/lead.dto.ts`, the lead detail read model,
`LeadsService.update` and `PartyDirectoryAdapter`. Verified 2026-09-07.

`GET /leads/:id` returns `contacts[]` with `partyId`, `relationshipId`,
`displayName`, `firstName`, `lastName`, `honorificTitle`, `jobTitle`,
`isPrimary`, `email` and `phones[]`. This list belongs to the lead, not the
company's entire Directory. `primaryContactName` is only a list/card summary.
Company and Contacts consume this one validated response; no Directory lookup
is needed to render either card.

For a corporate lead, PATCH `contacts` is a **replacement list**, maximum 20:
each existing person is identified by `contactPartyId` (the read model's
`partyId`). The contact modal's CRM write sends only that ID, `jobTitle`
and `isPrimary` for each person. All people and untouched job titles must remain
in the list; an empty job title clears the relationship label. Exactly one
contact is selected as primary by this editor. It does not add/remove people.

When `contactPartyId` is supplied, identity/contact inputs do **not** update
that existing person. Omitting the ID takes the create-person path and must
never be used as an edit workaround. `relationshipId` is read-only and is not
a PATCH key. A single atomic contact update remains the boundary recorded in
[OPEN-QUESTIONS Q133](../build/OPEN-QUESTIONS.md#q133--existing-corporate-contact-identity-is-not-editable-through-lead-patch).

The per-person modal supports full identity editing through **Core Directory**,
not by widening `UpdateLeadDto`: permission-gated GET/PATCH
`/api/tenant/core/v1/directory/parties/:partyId`, and POST under
`/parties/:partyId/contact-methods` or PATCH/DELETE
`/directory/contact-methods/:methodId`. It requires `directory.party.read`,
`directory.party.manage` and `directory.contact.manage`; server branch checks
remain authoritative. Read the selected person on open to obtain actual method
IDs. Preserve existing `PHONE`/`MOBILE` types, all other people, and unrelated
methods; edit only the selected email. Clearing that email removes that method
only; another stored email remains and may become the displayed email after
refresh. No ID-free person creation is used.

These operations are **not atomic**. Stop at the first failure, retain the
modal, distinguish partial/uncertain outcomes, and require explicit reload
before retrying after any applied or uncertain operation. A fresh lead read
before the relationship replacement preserves other contact rows. Re-read
the lead after completion; never simulate a successful response.

For an individual lead, the same card PATCHes only changed supported fields:
`displayName` (nonempty, max 180), `firstName`/`lastName` (max 80),
`honorificTitle` (max 40), `email` (max 180) and `phones` (max 10 strings,
max 32 each). Email and honorific can be cleared with `null`; a changed phone
list is sent whole. The read projection includes `MOBILE` and `PHONE`, while
individual `phones` writes sync `MOBILE` only: removing a Directory `PHONE`
entry through this route is not guaranteed. Do not claim cross-kind deletion.

Both profile types require the lead update capability and a non-converted lead.
The editor sends no request on cancel/no change, keeps drafts on definite
failure, and re-reads after an uncertain or applied-but-unreadable result rather
than presenting simulated success or retrying with a fresh write automatically.

## One Lead Details editor

Verified 2026-09-07 against `UpdateLeadDto`, Lead detail/tags read models,
Core tenant-users controller/service and Gateway route contracts.

The Details card PATCHes only changed `acquisitionSourceId`, `ownerUserId`,
`interestSummary`, `expectedNeed` and `description`. Created by, creation date
and last update are response-only. The owner defaults to the current actor only
in an unassigned lead's edit draft; opening the page never writes an assignment.
`ownerUserId` is validated by the service's assignment/branch rules.

The Details form is immediately editable when the lead update capability allows
it and the lead is not converted. Save is explicit; typing or mounting never
sends a PATCH. Save/cancel keep the form open. Clean fields follow fresh reads,
dirty drafts retain their original comparison baseline, and ambiguous or
applied-but-unreadable writes require reconciliation before another write.
The one-lead page no longer mounts its standalone notes-ledger card; Notes in
Details remains `description`. This removes no stored ledger notes and makes
no notes-ledger create/delete call.

`GET /api/tenant/crm/v1/leads/:id/tags` supplies the read-only tags — full
catalogue items, `{ id, name, backgroundColor, textColor, createdAt, updatedAt }`
(re-verified 2026-09-24, see [catalogues](crm-catalogues.md#tags)).
Owner/creator names use the authenticated actor when IDs match; otherwise
`GET /api/tenant/core/v1/users/:id` requires `users.user.read`. The owner picker
uses the same permission-gated `/users` list filtered by branch and ACTIVE
status, paginated fully, then narrowed to the CRM update capability's owner IDs
(`null` means all, not an empty list). Neither user response exposes an avatar
URL; use initials until a real image contract exists. A missing permission or
failed request must not invent names or impersonate the current actor.

## Company options

For linking a corporate lead to an existing organization party:

- `GET /leads/company-options?branchId=` → `[{ id, displayName, legalName, branchId }]`
- `GET /leads/company-options/:companyPartyId/contacts?branchId=` → active
  contact people for that party

Both require `crm.leads.create`. Both are Gateway-exposed (previously
documented otherwise — that was wrong).

## Frontend notes

### One Lead side-panel contract (2026-09-07)

History is the default of three icon tabs; Activities and Attachments load on
first selection and keep their state when hidden. These tabs do not change the
Lead GET/PATCH DTO or add another main-column attachments section.

- The Activities tab is the shared `RecordActivitiesPanel`. It lists the lead's
  **open** activities with `GET /api/tenant/core/v1/activities` —
  `targetApp=CRM`, `targetType=LEAD`, `targetId=<lead.id>`,
  `statuses=PLANNED,IN_PROGRESS`, `sortBy=dueAt`, `sortDir=ASC`, `limit=25` —
  and every page until `hasNext=false`; a failed page fails the read rather than
  showing a partial list. Core returns `{items,total,page,limit,totalPages,hasNext}`
  inside `data` (no `hasPrev`, so no pagination `meta` here). Read is gated by
  `activities.read`; complete and cancel per row, and create, view and edit
  through the shared activity modal, each carry their own Core permission, an
  `If-Match` version and one UUIDv7 idempotency key per attempt — the contract
  is [Core activities](core-directory.md#activities--12-routes). Every write
  re-reads the open list. "View all activities" opens `/crm/activities`
  filtered to this lead, on its table and across every branch. CRM's own activity log routes are not read anywhere.
- A card's or a table row's activity mark opens the same modal on the lead,
  creating with the lead's open activities listed above the form; any write
  reloads the list, board or table it came from so the next-activity mark
  follows.
- Attachments use the raw CRM `GET /api/tenant/crm/v1/attachments` response,
  scoped by `branchId`, `sourceType=LEAD`, `sourceId=<lead.id>`, `limit=50`
  and every page. Unlike Core activities, an empty CRM list has `totalPages=0`.
  Both all-pages readers validate pagination, reject duplicate IDs and never
  present a partial result as the full list; aborts cannot commit stale data.
  Attachment byte counts accept canonical positive integer strings on persisted
  reads as well as numeric upload receipts: `CrmAttachmentEntity.sizeBytes` is
  a PostgreSQL `bigint` without a transformer. The client converts only exact
  integer byte counts within the **25 MiB** cap to its numeric display model.
  Unreadable attachment responses retain their HTTP status and correlation ID;
  only failures without an HTTP response use the offline message.
- Add attachment uses existing `POST /api/tenant/crm/v1/attachments/upload`,
  one file per multipart request, the existing MIME allowlist and **25 MiB**
  cap. Preserve source-owner create/delete capabilities and read-only access
  mode; no permission is granted by selecting a tab. The queued upload and
  ambiguous/applied-unreadable evidence survive tab switches.
- Download uses same-origin navigation to
  `GET /api/tenant/crm/v1/attachments/:id/download`; its attachment stream is
  handled by the browser with session cookies, not the JSON transport. No
  token, file bytes or invented public storage URL is put in the page.

Attachment read handling reverified **2026-09-14** against the CRM attachment
entity, notes/attachments controller/service and Gateway route contracts.
The activity panel and modal re-verified **2026-09-24** against the Core
activities controller, DTOs and service. The visual contract is
[Views → Leads](../design/views.md#leads), with the shared panel and modal
described in [the activity template](../design/patterns.md#the-activity-template).

### Existing lead integration

- One Lead's History combines Lead + current company/person Party + current
  contact Parties through the existing Core history endpoint's bounded
  `relatedPartyIds` query. It uses IDs already in the detail response; no
  per-contact fetch or client-side merging of separately paginated logs.
  See [the related history contract](core-directory.md#related-party-history).
- History user references (including salesperson and activity assignee) resolve
  names through the shared authorized user reader. Both before and after names
  open the reusable contact modal. Branch and acquisition-source references
  resolve to authorized names; existing stage labels remain catalogue-backed.
  The current user response has name/email only, so the card shows initials
  and an unavailable phone rather than guessing a Party relationship. See
  [the shared user projection](core-identity.md#shared-user-contact-projection)
  and [the reusable template](../design/patterns.md#personprofilelink).
- Pass the committed `lead` object as `EntityHistoryCard.refreshToken`, not only
  `lead.updatedAt`: Directory/contact saves can leave the Lead timestamp intact.
  New saves reset History to page one and abort stale page loads. Refresh/reopen
  the detail page to see edits made elsewhere; this is not a realtime push feed.
- **History presentation, verified 2026-09-14:** successful Lead creation shows
  only the localized “Lead created” message beneath the actor and timestamp.
  Related Core history takes its action from the first child event, so grouped
  creation is also recognized from the initial `leadProfileType`, `branchId`
  and `stageId` changes belonging to this Lead's subject id. Later contact
  additions, ordinary updates, failures and their reasons retain their details.
  This changes presentation only; stored audit evidence and pagination remain.
- Lead `rating` transitions render three read-only stars on each side: the
  recorded count in gold and the remainder in silver, including three silver
  stars for zero. Before/after labels are accessible in Arabic and English.
  Missing or invalid recorded values keep their text marker rather than being
  shown as zero. Other entity types retain their existing value rendering.

- Board axis is the **tenant lead-stage catalogue**, ordered by `sortOrder` —
  fetch from `/lead-stages`. Never hardcode stage names or assume a count.
- Board data comes from `POST /leads/board`, 50 records per stage. More calls
  `/leads/board/stages/:stageId` for that stage only. Card/Table use the richer
  list/search response and normal global pagination.
- Card View has no row selection: it renders neither per-card checkboxes nor a
  Select All toolbar. Table selection remains available.
- Lead cards show an explicit Individual/Company badge and matching icon. The
  rich Card View adds the correct Party country and flag, company/person contact
  lines, call/WhatsApp/Telegram actions, and the source catalogue avatar. The
  `PQ`/`SO`/`IN`, the salesperson full name, rating and activity controls form
  one bottom-anchored block so cards in the same row keep those controls aligned.
  Corporate cards show the primary contact's name, position, email and phones
  with a compact Primary badge when `isPrimary` is true; the type badges use
  the same compact treatment.
- Quotation, sales-order and invoice counters use three permission-scoped bulk
  Trade reads for the whole page and render as `PQ`, `SO` and `IN`. Missing
  permission hides that counter; a failed permitted read remains unknown (`—`)
  and is never presented as zero.
- Stage move is `POST /:id/stage`, never a generic `PATCH`.
- Move optimistically; roll back on failure.
- Every action control is gated by `capabilities`, not by permission strings.
- Status renders through `StatusBadge`; never display the raw wire value.
- `ownerUserId` is a filter, not an authorization mechanism.
- Basic search uses removable field/value tokens inside one input. Typing
  suggests Lead, Email and Phone/Mobile semantic text scopes plus
  structured fields; enum and catalogue fields then offer valid values. The
  default **My Leads** token resolves `ownerUserId` from `/auth/me.id`, so the
  initial read includes only leads assigned to the actor. Removing it removes
  that filter while retaining server authorization and branch scope. Changing
  branch restores My Leads and clears unfinished search text/field selection.
- `crm/leads/lead-basic-search-contract.ts` compiles different fields as AND
  and repeated structured values as OR (`in`). A single value per field uses
  GET; repeated values and Tag use the existing read-only `POST /leads/search`
  with `filterTree` and/or `tagIds`. Both paths filter before server
  count/pagination. Empty values are omitted, enum values and catalogue UUIDv7
  ids are validated, and My Leads cannot issue a read without the current actor
  id.
- Semantic Party search sends one `search` term with `searchField` equal to
  `lead`, `email` or `phone`. Adding another semantic text token replaces the
  previous one while retaining structured tokens. The API still accepts the
  `customer` scope for compatibility, but the Leads UI does not offer the
  overlapping choice; customer-profile search keeps its single Customer scope.
  See [the study](../build/LEADS-BASIC-SEARCH-STUDY.md) and
  [OPEN-QUESTIONS Q137](../build/OPEN-QUESTIONS.md#q137--multiple-party-text-search-terms-are-not-supported-by-the-leads-search-contract).
- Basic is the default when the single compact `Advanced` toggle is unpressed;
  pressing it opens Advanced and pressing it again returns to Basic. Each row visibly reads
  `AND/OR | Key | Operator | Value`; changing AND to OR splits the filter tree
  at that row, and changing OR back to AND merges it into the previous group.
  A new row starts with a blank Key and reveals its remaining controls only
  after the field is selected. Editing retains a draft; only the explicit
  Search action applies it. Re-entering Advanced reapplies its last submitted
  query without promoting later draft edits.
- The Advanced field catalogue mirrors every repository-filterable Lead column
  except `branchId`, which already scopes the request. This includes `rating`
  and nullable `cardColor`. Operator choices follow a per-field UX policy
  rather than exposing the database grammar wholesale: the two-value Lead Type
  is always equality and therefore hides its operator; references and broader
  enums keep equality, inequality and list membership; rating and timestamps
  expose useful comparisons and ranges; text keeps exact, case-sensitive and
  case-insensitive matching. Null checks appear only on nullable columns.
  Advanced starts directly with these condition rows and sends no separate
  free-text `search` value. Lead, Email and Phone/Mobile semantic text scopes
  remain in Basic search.

## Portal status

| Capability | Status |
| --- | --- |
| List, branch-scoped, paginated | live |
| Basic search — field suggestions, multiple tokens, default My Leads | live |
| Advanced search — typed AND/OR filter-tree builder with explicit submit | live |
| Create | live |
| Tags during create | live — multi-select catalogue ids in the single atomic, idempotent create request |
| Delete | live |
| Stage move + board | live |
| Card view | live |
| Table view | live — `DataTable`, first column links to the detail screen |
| Capabilities-driven actions | live — every control on the list and the detail screen |
| Detail route | live — `/crm/leads/[id]`; **the proxy does not admit the path yet, see OPEN-QUESTIONS.md Q40** |
| Update | live — `PATCH /:id`, changed keys only |
| Convert flow | centered Small modal with review; immutable body/key per attempt; full verified DTO and flat-ID receipt |
| Company options | live — both routes, in the create drawer |
