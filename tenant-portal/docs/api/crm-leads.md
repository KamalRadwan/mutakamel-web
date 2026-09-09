# CRM — Leads

Status: **verified**

Last source verification: **2026-09-07**

Contact detail/write contract re-verified: **2026-09-07** (scoped update below).

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

Branch guards: `@RequireBranchAccess('body')` on create,
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

Response: `200`, paginated `{ items, meta }` — **raw CRM shape, not a Core
envelope.**

Scoped read narrows results by the actor's own/team/all scope on top of the
branch filter. An empty page is not proof that no leads exist.

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
by DTO validation. The `201` lead response includes the saved `tags` array.

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

Verified 2026-09-07 against all conversion DTO classes in
`crm-app/src/crm/leads/dto/lead.dto.ts`, the complete `LeadsService.convert`
transaction and its validation/helpers, `PartyDirectoryAdapter`, scoped owner
assignment, and Gateway `crm.route-contracts.ts`. Backend files remain read-only.

Promotes the lead's existing Party to a customer profile. Qualification is
required only when tenant settings enable `requireQualifiedStageForConversion`;
the server remains the authority for that condition.

Body: `ConvertLeadDto`. Actual service success **201**:

```json
{
  "lead": { "id": "…", "status": "CONVERTED", "convertedCustomerProfileId": "…", "convertedOpportunityId": "…" },
  "customerProfileId": "…",
  "opportunityId": "…"
}
```

The lead above is abbreviated; the real response carries the complete Lead
detail read model. `opportunityId` is **omitted** when no opportunity is
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

`GET /api/tenant/crm/v1/leads/:id/tags` supplies the read-only tags.
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

- Open activities use `GET /api/tenant/core/v1/activities` with
  `targetApp=CRM`, `targetType=LEAD`, `targetId=<lead.id>`, `status=PLANNED`,
  `sortBy=dueAt`, `sortDir=ASC`, `limit=25` and every page until `hasNext=false`.
  Core returns `{items,total,page,limit,totalPages,hasNext}` inside `data`
  (no `hasPrev`, so no pagination `meta` here). Read remains gated by
  `activities.read`; row writes retain separate `activities.update`,
  `activities.complete`, `activities.cancel` permissions, `If-Match` versions
  and one UUIDv7 idempotency key per attempt. Do not use CRM's DONE activity
  log endpoint for this planned-work list. The modal and rail share the reader
  and `ActivityList` presentation. Their writes re-read the open list.
- Attachments use the raw CRM `GET /api/tenant/crm/v1/attachments` response,
  scoped by `branchId`, `sourceType=LEAD`, `sourceId=<lead.id>`, `limit=50`
  and every page. Unlike Core activities, an empty CRM list has `totalPages=0`.
  Both all-pages readers validate pagination, reject duplicate IDs and never
  present a partial result as the full list; aborts cannot commit stale data.
- Add attachment uses existing `POST /api/tenant/crm/v1/attachments/upload`,
  one file per multipart request, the existing MIME allowlist and **25 MiB**
  cap. Preserve source-owner create/delete capabilities and read-only access
  mode; no permission is granted by selecting a tab. The queued upload and
  ambiguous/applied-unreadable evidence survive tab switches.
- Download uses same-origin navigation to
  `GET /api/tenant/crm/v1/attachments/:id/download`; its attachment stream is
  handled by the browser with session cookies, not the JSON transport. No
  token, file bytes or invented public storage URL is put in the page.

Verified against Core activities controller/service, CRM notes/attachments
controller/service and Gateway route contracts. The visual contract is
[Views → Leads](../design/views.md#leads), with the reusable template described
in [ActivityList](../design/patterns.md#activitylist).

### Existing lead integration

- One Lead's History combines Lead + current company/person Party + current
  contact Parties through the existing Core history endpoint's bounded
  `relatedPartyIds` query. It uses IDs already in the detail response; no
  per-contact fetch or client-side merging of separately paginated logs.
  See [the related history contract](core-directory.md#related-party-history).
- Pass the committed `lead` object as `EntityHistoryCard.refreshToken`, not only
  `lead.updatedAt`: Directory/contact saves can leave the Lead timestamp intact.
  New saves reset History to page one and abort stale page loads. Refresh/reopen
  the detail page to see edits made elsewhere; this is not a realtime push feed.

- Board axis is the **tenant lead-stage catalogue**, ordered by `sortOrder` —
  fetch from `/lead-stages`. Never hardcode stage names or assume a count.
- Stage move is `POST /:id/stage`, never a generic `PATCH`.
- Move optimistically; roll back on failure.
- Every action control is gated by `capabilities`, not by permission strings.
- Status renders through `StatusBadge`; never display the raw wire value.
- `ownerUserId` is a filter, not an authorization mechanism.
- The list screen's search is **one field, one value** — a field picker beside
  a value control whose type follows the field, built in
  `crm/leads/lead-search-contract.ts`. That module is the only place a query
  key is named, and it sends **at most one** filter key: `forbidNonWhitelisted`
  makes an unknown key a `400`, and a blank value would send `status=`, which
  `@IsEnum` also rejects. There is no advanced/operator mode — see
  [OPEN-QUESTIONS Q131](../build/OPEN-QUESTIONS.md).
- `ownerUserId` is offered by no control: nothing lists assignable users by
  name, so the only possible input is a raw UUID — see
  [OPEN-QUESTIONS Q132](../build/OPEN-QUESTIONS.md).

## Portal status

| Capability | Status |
| --- | --- |
| List, branch-scoped, paginated | live |
| Basic search — one field, one value | live |
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
