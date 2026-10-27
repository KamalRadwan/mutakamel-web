# CRM — Leads

Status: **verified**

Optimistic lead edits source-reviewed: **2026-10-26** (CRM-LEADS-027).
`PATCH /api/tenant/crm/v1/leads/:id` accepts optional `expectedUpdatedAt`: the
loaded lead's `updatedAt`, as an ISO timestamp with timezone and at most three
fractional digits. The server compares at millisecond precision inside the
update transaction. A stale timestamp returns `409 CRM.LEAD.CONCURRENT_UPDATE`
before any related writes; both languages instruct the user to reload before
saving again. Omission retains last-write-wins and contacts still replace the
whole set. Detail drafts retain their opening timestamp across refreshes.
Contact-list actions that preflight a fresh list send that read's timestamp,
protecting the gap between the preflight and the replacement PATCH.

Detail conflict recovery source-reviewed: **2026-10-26** (AUD26-FE-TENANT-04).
Rating/colour, details, individual contacts and company edits automatically
reload the lead after `CRM.LEAD.CONCURRENT_UPDATE` or HTTP 409 and retain the
existing translated conflict notice. Details and contact drafts are discarded;
the user re-applies changes against the refreshed timestamp. Company saves
stay blocked until the user closes and reopens the editor after the fresh
read, discarding its old draft. Closing/reopening before the read completes
cannot unlock a stale retry. Other definite failures keep their drafts.
Conflict notices also use a persistent, dismissible translated warning toast
with a **Refresh lead** action wired to the same reconciliation read:
the automatic reload unmounts the cards and company modal, so an inline error
alone would disappear before the user could read it.

Quick-edit custom-field preservation source-reviewed: **2026-10-24**
(AUD24-FE-TENANT-01). Failed or malformed custom-field value reads are tracked
separately from definition failures. Quick-edit omits custom-field controls and
writes until values have loaded successfully for the current record; unrelated
qualification edits remain available. Successful reads submit only edited fields
whose values differ from the loaded values, including intentional text clears.

Lead existence handling source-reviewed: **2026-10-18** (CRM-LEADS-026).
After route admission, missing, deleted and out-of-scope leads all return
`404 LEAD_NOT_FOUND` from detail, tag and mutation routes. Bulk operations also
conceal record scope with that 404 and retain the submitted `details.leadId`.
`useLeadDetail` clears any previously loaded record and the detail workspace
renders the same Arabic/English `NotFoundState`, with a link back to Leads and
no retry. Route-level and dataset permission failures retain 403 and their
permission boundaries; a lead-detail 404 never explains record scope.

Shared lead reads source-reviewed: **2026-10-18** (FE-LEADS-044).
Detail, quick-edit, contact-modal preflights/readbacks and Board cards use
`leads/lead-requests.ts`'s `fetchLeadDetail`, which validates the requested
lead ID and keeps optional card-field failures separate from lead detail.
Stage setup, the Leads workspace (including board catalogue refresh), detail
and CRM settings reference labels use
`shared/lead-stage-catalogue.ts`'s `readLeadStageCatalogue`. Both helpers own
their no-store request, abort signal, response limit and runtime validation;
callers retain their loading, error and stage-degradation behavior.

Shared lead UI helpers source-reviewed: **2026-10-18** (FE-LEADS-042).
Detail, quick-edit and Card avatars use `leadNameInitials`, preserving Unicode
characters and the `LD` empty-name fallback. Card/Table countries resolve
through `leadCountryIso`; unknown names have no guessed country code.
Quick-edit phone flags come from the country catalogue, with a globe for
calling codes shared by multiple countries. Lead rating parsers and controls
share the CRM rating range and star sequence. Card colors use the design-system
catalogue and border tokens, preserving all eleven distinct swatches on Board
cards. Lead and stage API base paths live in their respective contracts.

Phone validation source-reviewed: **2026-10-18** (CRM-LEADS-017).
Supplied lead phone numbers require at least five digits after normalization
(formatting removed, an initial `00` replaced by `+`). `abc`, `1` and `001234`
return `422 LEAD_PHONE_INVALID`; create/edit phone-array validation mirrors
this rule with Arabic/English field feedback. Blank form rows remain optional
and are omitted from requests.

Disabled-action accessibility source-reviewed: **2026-10-18** (FE-LEADS-024).
Disabled lead stage controls remain keyboard-focusable and include the reason
in their accessible name; activation cannot open a stage change. Lead-stage
setup actions retain native disabled buttons inside named, focusable wrappers
that announce the action, stage and reason and expose the same tooltip on focus.
Card/table rating stars have translated names. Read-only table phones render
as text, with an em dash for a missing phone rather than an Add phone action.

Search-body cleanup source-reviewed: **2026-10-18** (CRM-LEADS-DEAD-006).
All lead search bodies reject `withDeleted`, `relations`, `select` and
`addSelect` with HTTP 400. List search accepts sorting and pagination;
the initial board accepts sorting and a fixed limit of 50, with no `page`.
Stage board reads retain `page` for loading more. KPI requests contain only
search predicates and reject `sort`, `page` and `limit`. Portal builders omit
these unsupported options while preserving Basic/Advanced filters and presets.

Last source verification: **2026-10-26** (board/grid card-face reconciliation).

Owner-decision alignment source-reviewed: **2026-10-17** (DOCS-FE-001).
Planned items below describe decisions still absent from the current code.

Contact detail/write contract re-verified: **2026-10-17** (scoped update below).

Lead contact-name projection source-reviewed: **2026-10-18**
(CRM-LEADS-DEAD-003). List, search and board rows use the lead's own
`primaryContact.displayName` for corporate contact headings and fallbacks.
There is no separate `primaryContactName` field or organization-contact
fallback on leads. A missing lead contact leaves the contact heading empty.
Customer-profile contracts and consumers keep their existing field.

Lead input cleanup source-reviewed: **2026-10-18** (CRM-LEADS-DEAD-002, D-025).
Create uses `phones`, `companyPhones`, `contacts[].phones` and
`contacts[].honorificTitle`; singular phone aliases and contact `title` are
rejected. Create/update addresses use `state`, `street1` and `street2`, with
Street 2 as the sole suite/apartment input. There is no separate `apartment`
form field. Detail responses retain Directory names (`area`, `street`,
`apartment`), and editors send those values back through the canonical keys.
`primaryMobile` remains supported on update only.

Basic search GET/POST, semantic text scopes, Tag, owner filtering and pagination
re-verified: **2026-09-16**.

Board/grid card faces verified: **2026-10-26** against [CRM Leads v3](../design/specs/crm-leads-v3.md). Board/Card/Table projections verified: **2026-10-16** (board lanes carry the list row; Card and Table are built on the design-system `CardView`/`TableView`). Card bulk document counts verified: **2026-09-16**.

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

Capability response budget source-reviewed: **2026-10-18** (CXCRM-PLAT-102).
The current response carries ten action boundaries, each supporting up to 500
owner UUIDs. All consumers of `/leads/capabilities` (list, create, detail, and
attached records) use a shared finite limit of **211,384 bytes**: ten actions ×
500 owners × 39 JSON bytes per UUID, plus 16 KiB for structure. The transport
rejects larger UTF-8 bodies with `API_RESPONSE_TOO_LARGE`; the capability parser
also rejects owner arrays above 500. Valid 200- and 500-owner teams retain
their action boundaries. The existing wire shape is retained without a package
release; unavailable actions remain `null`.

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
| POST | `/leads/kpis` | `crm.leads.kpis.post` | AUTHENTICATED, non-idempotent | `crm.leads.read` (scoped) |
| POST | `/leads/document-counts` | `crm.leads.document.counts.post` | AUTHENTICATED, non-idempotent | `crm.leads.read` (scoped) |
| POST | `/leads/duplicate-check` | `crm.leads.duplicate.check.post` | AUTHENTICATED, non-idempotent | `crm.leads.create` (scoped) |
| POST | `/leads/bulk-stage` | `crm.leads.bulk.stage.post` | WRITE_SENSITIVE, non-idempotent | `crm.leads.update` (scoped) |
| POST | `/leads/bulk-update` | `crm.leads.bulk.update.post` | WRITE_SENSITIVE, non-idempotent | `crm.leads.update` (scoped) |
| POST | `/leads/bulk-delete` | `crm.leads.bulk.delete.post` | WRITE_SENSITIVE, non-idempotent | `crm.leads.delete` (scoped) |

Branch guards: `@RequireBranchAccess('body')` on create, search, both Board reads,
KPIs, the duplicate check and the three bulk routes,
`@RequireBranchAccess('query')` on the list and both option routes,
`@RequireRecordBranchAccess('LEAD')` on every `:id` route.

## Idempotency headers on lead update and delete

Source-reviewed **2026-10-18** (FE-LEADS-031): `PATCH /leads/:id` and
`DELETE /leads/:id` are `WRITE_SENSITIVE` with `idempotent: false` in the
Gateway CRM route contract. Sending `x-idempotency-key` on these routes is
accepted, but supplies no Gateway deduplication or replay guarantee.

`GatewayIdempotencyService.reserve` returns `undefined` for these routes
before reading or validating the header or accessing the idempotency store.
The proxy therefore has no reservation to replay, commit or release, and
`UpstreamClientService.maxAttempts` permits only one upstream attempt for
these route policies, regardless of the supplied key. The header is still
forwarded upstream and may be recorded as bounded Gateway audit metadata;
it is ignored for Gateway idempotency, rather than stripped from the request.

The calls in `useLeadContactsEdit.ts`, `useLeadContactModal.ts` and
`lead-detail-workspace.tsx` retain `runIdempotentWrite` for outcome
classification. They reconcile ambiguous or applied-but-unreadable results
through a lead read instead of offering a same-key replay. The helper name
and the presence of a key do not make these routes replayable. The separate
lead create and conversion contracts retain their idempotency policies.

Evidence: Gateway `src/routing-proxy/route-contracts/crm.route-contracts.ts`,
`src/idempotency/gateway-idempotency.service.ts`,
`src/routing-proxy/routing-proxy.controller.ts`,
`src/routing-proxy/upstream-client.service.ts` and
`src/common/middleware/gateway-audit.middleware.ts`. Existing
`gateway-idempotency.service.spec.ts` covers the non-idempotent route bypass;
the three callers' specs cover reconciliation after uncertain outcomes.
This confirmation is based on source and spec review; checks were not run.

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

Board lanes carry the same row `POST /leads/search` returns (2026-10-15), so a
card is complete as delivered and the board never issues a follow-up search to
fill it. The initial route returns every
active stage in `sortOrder`, each with its own page of exactly 50 cards, total
and `hasNext`. The stage route returns the requested next page only, so the
column's More button does not reload another stage. Both routes accept the same
basic/advanced filter body as `/leads/search`; the server adds each lane's
stage constraint after scoped access.

If the active stage catalogue changes while the Board is open, the client
reloads `/lead-stages` and retries the board read once against the current
stage ids. The refreshed catalogue also replaces the displayed lane axis.

Source reviewed **2026-10-17** (CRM-LEADS-029): search, board, board-stage and
KPI bodies accept the optional boolean `hasOverdueActivity`. True selects leads
with at least one open Core activity (`PLANNED` or `IN_PROGRESS`) targeting the
lead and due before `now()`; false selects leads without one, and omission
applies no activity filter. Strings and numbers are rejected by DTO validation.
Completed, cancelled, deleted, undated and future activities do not match.
The server applies this predicate before counts and pagination, ANDed with all
branch, owner, text, tag and advanced filters; multiple activities count one lead.

Board rows include identity/type, stage, `stageEnteredAt`, owner, rating,
colour, next activity, primary-contact name and tags. `stageEnteredAt` (on every
lead shape since 2026-10-14) is when the lead entered its current stage;
board and grid card faces no longer display time-in-stage. Stage age remains
available on lead and opportunity detail pages. Each tag is `{ id, name, backgroundColor,
textColor }` — the colour pair is upper-case `#RRGGBB` or both `null`
(2026-09-24, [catalogues](crm-catalogues.md#tags)). They also carry the address,
primary-contact details, email and phone aggregates of the list row. Card and
Table remain global paginated list/search reads and become stage-filtered only
when the user selects a stage.

## POST /leads/kpis — the KPI strip (2026-10-14)

Body: the `POST /leads/search` body (`buildLeadBoardRequest` builds it; the
backend ignores `sort`, `page` and `limit`). Response
`{ totalLeads, newStageLeads, newTodayLeads, hotLeads, overdueActivityLeads,
qualifiedLeads }` over **every**
lead the filters and scoped read access select — not the loaded page. "Today"
uses the tenant's civil date. "Overdue" uses `due_at < now()`, including earlier
today, matching `hasOverdueActivity: true`; the card's display classification
follows [decision 9](../design/specs/crm-leads-v3.md), using a parseable
`activityAt` before the server `bucket`. `useLeadKpis` reads it after every search and
data revision, keyed on the serialized body. The strip displays an unknown count
and disables its filter buttons when no KPI response is available; it never
substitutes counts of loaded rows.
Parser: `parseLeadKpisResponse` (`lead-bulk-contract.ts`).

Re-verified **2026-10-17** against `page.tsx`, `LeadKpiStrip`,
`LeadStageFunnelBar`, `LeadSearchDto` and `LeadInsightsService`. All four
filterable presets send server predicates before counting and pagination:
New uses `stageFlag = NEW`, Rated 3 stars uses `rating = 3`, and Qualified uses
`stageFlag = QUALIFIED`; Overdue activity sends `hasOverdueActivity: true`.
They are ANDed with the existing Basic or submitted
Advanced search, including its owner, text and tag filters. Basic uses POST
search while a preset is active; board and stage paging use the same compiler.
Selecting a preset resets list paging to one. Selecting Total or pressing the
active pill again removes only the preset. An Advanced draft stays unapplied
when selecting a pill. The strip counts the base search without the preset,
so each pill's count describes the result total obtained by selecting it.

**CRM-LEADS-029 (2026-10-17):** Overdue activity uses the same localized,
keyboard-operable toggle button and pressed state as the other pills. It
retains its filter in Card/Table paging and board-stage More reads. Selecting
Total or pressing the active pill clears it. The stage funnel still counts
its supplied rows.

**Source-reviewed 2026-10-18 — D-027, CRM-LEADS-DEAD-014:** the KPI response
and parser expose only the six headline counts above. The backend aggregates
them directly without grouping by stage. For per-stage server counts, use board
lane totals. List rows do not supply `contactsCount`; the list parser and card
do not read or display an additional-contact count.

## POST /leads/document-counts — Card view counters (2026-10-14)

Body `{ branchId, partyIds: UUIDv7[1..100] }`. Response
`{ countsByPartyId: { [partyId]: { opportunities, quotations, salesOrders,
invoices } } }` — all four `OPP · PQ · SO · IN` counters in **one** request per
100 cards, replacing the four `counts-by-party` calls the Card view used to
make. Each counter is `null` when the user may not see it (scoped
`crm.opportunities.read`; `trade.quotations.read`, `trade.sales_orders.read`,
`trade.invoices.read` in the branch) or when the tenant has no Trade; the card
renders `—` for `null`, never `0`. `useLeadDocumentCounts` reads it and
derives each kind's visibility from whether any card got a number;
`parseLeadDocumentCountsResponse` (`lead-bulk-contract.ts`) requires one entry
per requested Party.

## POST /leads/duplicate-check — create form (2026-10-14)

Body `{ branchId, name?, phones?[≤10], email?, taxNumber?,
commercialRegistrationNumber?, excludePartyId? }` — a POST because the probes
are personal data. At least one probe, else `422 LEAD_DUPLICATE_CHECK_EMPTY`.
Response `{ matches: [{ partyId, displayName|null, partyType, matchTypes[],
leads[], restricted }] }`, at most 20, exact matches only (registration
numbers, normalized phone, lower-cased email, case-insensitive name) under the
Directory's `duplicate_scope`. `displayName` is `null` for a Party of another
branch and `leads` holds only leads the user may read; `restricted` says that
something was withheld. `useLeadDuplicateCheck` sends it 500 ms after typing
stops, skips it when the form reuses an existing company, and swallows
failures — the warning never blocks saving. `CreateLeadsModal` renders the
matches inline under the existing company-name suggestion. The page mounts the
modal only while it is open (2026-10-16), so the duplicate check, the company,
custom-field, tag and acquisition-source reads all belong to an actual create.

## Bulk actions — POST /leads/bulk-stage · bulk-update · bulk-delete (2026-10-14)

Body `{ branchId, leadIds: UUIDv7[1..100] }` plus `stageId` (bulk-stage) or at
least one of `rating`, `ownerUserId`, `cardColor` (`null` clears),
`acquisitionSourceId` (`null` clears) (bulk-update). Responses
`{ stageId, updatedIds, unchangedIds }`, `{ updatedIds, unchangedIds }`,
`{ deletedIds }`. Each request is **all or nothing**: the first refused lead —
`404 LEAD_NOT_FOUND` (including records outside branch/owner scope),
`409 LEAD_ALREADY_CONVERTED` — rolls the batch back and is named in
`details.leadId`. `useLeads` pre-filters the selection by the capabilities it
read, excludes converted-stage leads from bulk field updates, sends one request
per 100 ids (`leadIdBatches`), and refetches the list
whatever the outcome. The Card/Table bar (`LeadBulkActionsBar`, the
design-system `BulkActionBar`) offers Move stage (never to `CONVERTED`), Set
rating and Delete. Each one opens a `BulkConfirmDialog` that names the selection
size and holds the stage or rating picker. `useLeadsWorkspaceBulk` clears the
selection only after a successful write (2026-10-16).

Converted-lead controls reviewed **2026-10-17**: Board/Card/Table stars,
colour and inline phone fields are read-only for converted-stage leads, and
single-lead field writers refuse those records before sending a request. Detail
stage controls also remain disabled after conversion. Bulk failures include the
server's `details.leadId` in the displayed error so a record converted since the
last read can be identified.

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

**Planned — D-022, CRM-LEADS-023:** reject creation into a `DISQUALIFIED`
stage and conversion of a disqualified lead. The current create service rejects
`CONVERTED` with `LEAD_CONVERSION_REQUIRED`, but does not reject
`DISQUALIFIED`; conversion likewise has no disqualified-state guard. These are
decided preconditions, not enforced guarantees or new error codes yet.

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

Conversion target types re-verified **2026-10-17** against the conversion DTOs,
`LeadsService.convert` and LLD `06_leads.md` (CRM-LEADS-002 / FE-LEADS-046).
Other conversion fields verified 2026-09-18 against all conversion DTO classes in
`crm-app/src/crm/leads/dto/lead.dto.ts`, the complete `LeadsService.convert`
transaction and its validation/helpers, `PartyDirectoryAdapter`, scoped owner
assignment, and Gateway `crm.route-contracts.ts`.

Creates or links a customer profile for the selected target Party. Qualification is
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
| `profileType` | Required `INDIVIDUAL \| CORPORATE`; defaults to the lead type, and the modal allows either target |
| `displayName`, `companyName` | Optional non-empty strings, max 180; a new corporate destination requires at least one nonblank name. `companyName` is corporate-only; omitted `displayName` preserves the selected existing Party's name |
| `legalName` | Optional corporate-only string/null, max 180; never inferred from company/display name. The modal omits it |
| `primaryContact` | Corporate target only; optional nested **new person**, not an existing-contact update |
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

For a corporate target, omitting `primaryContact` reuses the lead's existing primary
contact if present, or the original person when creating a company from an individual.
Supplying it **creates another person and relationship**.
The modal defaults that toggle off and never prefills company identity as a
person. An individual target uses the selected person as its contact and sends no nested
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
The conversion modal's optional opportunity owner options still use
branch-visible ACTIVE users from Core `GET /users`
(`users.user.read`, page/limit 100, all pages), narrowed by the creation
capability's owner IDs. The active authenticated actor can also be a verified
candidate. Missing directory permission does not invent names or raw-ID inputs;
inheritance remains available. Custom fields reuse the shared create definition
reader and wait for its request; unavailable definitions show a degraded
notice, with the server retaining required-field authority.

**Planned — D-015:** migrate this remaining conversion opportunity-owner
picker to `GET /api/tenant/crm/v1/assignable-owners` with
`resource=opportunities&action=create&branchId=...`, without `users.user.read`.
This is distinct from the lead create/update pickers already migrated below.

### Target profile type and Party identity

The modal defaults to the lead's type and offers both Individual and Company.
Switching types clears destination name fields and turns off new-contact creation;
switching back restores the source names. Fields are disabled during review or
an unresolved write, preserving the reviewed request and idempotency key.

- **INDIVIDUAL → CORPORATE:** creates a new organization, even if the person is
  already linked to companies. The user must explicitly enter a company name or
  display name; both are checked client-side for nonblank content and the existing
  180-character limit. The original person becomes a contact on the new company;
  personal phones, email and addresses stay on the person. The optional new-contact
  toggle can create a different primary person while retaining the original as a
  secondary contact.
- **CORPORATE → INDIVIDUAL:** uses this lead's existing primary contact mapping.
  The dialog names that person and blocks review if no primary contact is mapped;
  the user must select one on the lead before converting. The backend checks that
  the selected Party is an active person in this branch or shared across branches.
  An omitted display name preserves that person's name. Company fields and a new
  primary contact are never sent for this target.

Existing Party types, company relationships and the lead's original `partyId` and
`leadProfileType` remain unchanged. If the selected destination already has a live
customer profile in the lead branch, the backend links it. The returned customer
profile ID identifies the destination in every case.

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

Errors include 404 `LEAD_NOT_FOUND` for missing, deleted or out-of-scope leads
(including insufficient delete scope with `keepLead: false`), 403 for independent
checks such as Directory edit authority or opportunity-create scope, 409
`LEAD_ALREADY_CONVERTED`, and 422 conversion,
contact-name, pipeline-stage, nested-opportunity or required-custom-field
validation. Preserve the draft on a definite rejection and refresh on conflict.
The modal maps `LEAD_CONVERSION_COMPANY_NAME_REQUIRED`,
`LEAD_CONVERSION_CONTACT_REQUIRED`, `LEAD_CONVERSION_CONTACT_INVALID`,
`LEAD_CONVERSION_INDIVIDUAL_FIELDS_INVALID` and `PARTY_NOT_FOUND` to Arabic and
English messages rather than displaying raw backend text. The backend remains
authoritative when a contact becomes invalid after the lead was loaded.
An uncertain outcome freezes the body/key even across modal close/reopen and
offers explicit same-request retry plus refresh. Applied-but-unreadable 2xx
permits refresh, never another write. See the
[modal behavior](../design/detail-screens.md#lead-conversion).

## PATCH /leads/:id · DELETE /leads/:id

**Inline primary-phone edits** (the Table view's phone cell only — the board
and Card view show the number but have no editor) send `{ primaryPhone }`
through `leadPrimaryPhonePatch` (`lead-phone-patch.ts`, 2026-10-14). The
backend replaces only the first mobile of the person the lead is about — the
individual, or a corporate lead's primary contact — and keeps every other
number; `leadEditablePrimaryPhone` shows that same number. Clearing an
individual's number sends the remaining `phones` list; a contact's number is
never cleared from a card. `primaryPhone` cannot travel with `phones`,
`primaryMobile`, `companyPhones` or `contacts` (`422 LEAD_PRIMARY_PHONE_CONFLICT`),
and a corporate lead without a contact answers `422 LEAD_PRIMARY_CONTACT_REQUIRED`.

Update returns `200` with the updated lead (`404`, `409`, `422`).
Delete is a **soft delete**, returns **`204` with no body** (`404`, `409`).
Deleting a converted lead does not delete its Party, customer profile, contact
relationships, or converted opportunity.

### Detail-page deletion (2026-10-17)

A definite delete rejection (including 409) keeps the confirmation open with
localized CRM error text and allows retry or cancel. An uncertain or
applied-but-unreadable outcome closes the confirmation, shows a persistent
localized notice that deletion could not be confirmed, and reloads the lead;
no automatic delete retry is sent. A successful delete closes the dialog and
uses client router navigation to `/crm/leads`.

### Contacts on the One Lead screen

Source: `crm-app/src/crm/leads/dto/lead.dto.ts`, the lead detail read model,
`LeadsService.update` and `PartyDirectoryAdapter`. Verified 2026-10-17.

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

The detail card's **Set Primary** and **Add Contact** actions use
`useLeadContactModal` and the builders in `contact-modal-contract.ts`, with no
separate component-owned writer. Both read the latest lead before replacing
its contacts, retaining all current people and untouched relationship titles.
Set Primary sends only `contactPartyId`, `jobTitle` and `isPrimary` for each
existing person. Add Contact appends one new row using `fullName` (or a name
composed from first/last name), supported identity fields, email and phones;
the new row has no `contactPartyId`. Neither action sends the response keys
`partyId`, `displayName` or `relationshipId` in the replacement payload.
The first contact is primary automatically; choosing a new primary clears the
other primary flags. The add form validates CRM's name, email and phone limits.
Both actions require update capability and an unconverted corporate lead.
Confirmed saves use the validated PATCH response. Definite failures retain
the add draft; uncertain or applied-but-unreadable outcomes discard that
submitted draft and block further actions until an explicit Retry reads the
lead again, preventing accidental duplicate person creation.

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

Quick-edit contact saves use these same Core write builders (verified
2026-10-17). Existing-person name/email/phone changes require the three
Directory grants; job-title and primary relationship changes still use CRM
without those grants. Method IDs are read before saving, unchanged phone
methods keep their IDs/types, and unrelated method types are preserved. The
handler reads the latest lead before replacing relationships and uses only
existing `contactPartyId` rows for existing people. Add Contact sends a new
person without a client-generated Party ID. Quick edit ends contact edit mode
only after a validated lead reload, displaying the server's saved values.
Definite write failures retain the draft; partial, uncertain and unreadable
results retire the submitted draft and show the existing Retry/Close read
boundary. Retry reads current data without replaying writes.

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
The corporate quick editor validates a non-empty company email before building
the PATCH and keeps the draft visible with a localized field error when invalid;
it does not update the displayed detail as if the value had been saved.

## One Lead Details editor

Verified 2026-09-07 against `UpdateLeadDto`, Lead detail/tags read models,
Core tenant-users controller/service and Gateway route contracts.

Owner write validation source-reviewed **2026-10-17** (CRM-LEADS-010): create
and update reject explicit `ownerUserId: null` with HTTP 400. Supply a UUIDv7
to assign an owner or omit the field to retain the default/current owner.
The quick editor offers owner assignments without an Unassigned action;
an empty owner draft sends no owner change.

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

`GET /api/tenant/crm/v1/leads/:id/tags` supplies the attached tags — full
catalogue items, `{ id, name, backgroundColor, textColor, createdAt, updatedAt }`
(re-verified 2026-09-24, see [catalogues](crm-catalogues.md#tags)).
The backend permits attach/detach through the standalone tag routes under scoped
`crm.leads.update` even after conversion (D-024, CRM-LEADS-014); this is an
exception to the converted-lead field lock. The current detail tag controls use
the Details editor's `editable` gate, which still excludes converted leads.
**Planned — D-024:** separate that tag gate so converted leads with update
access can attach/detach tags in the portal too.
Owner/creator names use the authenticated actor when IDs match; otherwise
`GET /api/tenant/core/v1/users/:id` requires `users.user.read`. Lead owner pickers
were re-verified **2026-10-17** against the Gateway route contract and CRM's
`AssignableOwnersController`, DTO and service. Full create uses
`GET /api/tenant/crm/v1/assignable-owners?resource=leads&action=create&branchId=...`;
detail and quick-edit reassignment use `action=update`. These reads require the
corresponding CRM capability, without `users.user.read`. CRM supplies active,
branch-eligible CRM users within that action's owner scope. The raw response is
`{ items: [{ id, displayName, avatarUrl }], nextCursor }`; readers follow every
cursor with the same branch/resource/action, validate every page, and fail the
whole read on a malformed or failed page. Display names remain intact; the
existing picker renders initials rather than requesting avatars. Reassignment
also narrows candidates to the loaded update capability's owner IDs (`null`
means all). It never adds the actor when CRM omitted them. Aborted branch
responses cannot replace current candidates. A missing permission or
failed request must not invent names or impersonate the current actor.

Scope handling source-reviewed **2026-10-17** (CLXAPP-124): full-create,
bulk reassignment and detail owner lookups wait for
`useOrganizationScopeHeaders("BRANCH_REQUIRED", branchId).ready`. Every cursor
request carries both `x-mutakamel-company-id` and `x-mutakamel-branch-id`,
resolved for the same branch as the query. A branch query alone does not
satisfy the Gateway's scope policy; unresolved scope sends no owner request.

## Company options

Full-create scope re-verified **2026-10-17** (FE-LEADS-007): opening the modal
loads `GET /leads/capabilities?branchId=...` for each accessible branch, with
that branch's company/branch headers. Only branches with non-null
`leads.create` appear in the branch choices. The requested branch is retained
when allowed; otherwise the first permitted branch is selected. The selected
branch's CRM assignable owners are additionally filtered by
`leads.create.ownerUserIds` (`null` permits all returned candidates). The actor
is the default only when present in these candidates; no synthetic owner is
added. Changing branch clears the explicit owner selection. Submission waits
for an allowed branch and owner, and sends the displayed branch and owner.
Closing/reopening or changing the actor discards old capability answers;
aborted owner reads cannot repopulate a new scope. Capability denials render a
scope boundary when no branch is allowed; failed or malformed reads show
degradation and never grant create access.

Verified **2026-10-17** (CRM-PARTY-001). For linking a corporate lead to an
existing organization party:

- `GET /leads/company-options?branchId=&search=&limit=50` → `[{ id, displayName, legalName, branchId }]`
- `GET /leads/company-options/:companyPartyId/contacts?branchId=` → active
  contact people for that party

The company-options query accepts optional `search` (trimmed, max 180 characters)
and `limit` (integer 1-50, default 50). It returns at most fifty active,
non-deleted organizations in the branch or with a tenant-wide NULL branch,
ordered by case-insensitive display name and ID. Search is a case-insensitive
literal substring of display, legal or organization name, applied before the
SQL limit. The raw array carries no total. Full create and board quick-create
use the shared hook's 300 ms debounced server search, discard aborted results,
and retain the selected company label across searches. Type a name to find a
company outside the initial fifty; the new-company route stays available.
The contacts route is unchanged.

Both require `crm.leads.create`. Both are Gateway-exposed (previously
documented otherwise — that was wrong).

**Planned — D-028, FE-LEADS-038:** board quick-create must leave a new
corporate contact's name empty until entered by the user. The current
`page.tsx` quick-create adapter still substitutes `payload.companyName` for
an omitted contact first name. Do not describe that fallback as an entered
contact identity.

## Frontend notes

### Shared notes and attachments read admission (verified 2026-10-18)

`RecordNotesSection` and `RecordAttachmentsSection` check `crm.notes.read` and
`crm.attachments.read` respectively through the scoped `PermissionGate` before
mounting their data hooks. Missing read grants show the standard localized
permission-missing state and send no list request. The gate accepts the existing
`own`, `team` and `all` suffixes using `hasPermission(..., true)`. A list request
that returns 403 after this admission still renders `CrmScopeGate` to explain
record scope. This shared behavior also applies to customer and opportunity
screens; write capabilities do not substitute for a read grant.

### Per-note action admission (source-verified 2026-10-17)

CRM note list rows and create/update receipts include required boolean `canEdit`
and `canDelete` fields. The server combines the matching note route permission
in the stored branch with authorship or source-resource `update.all` moderation
(CRM-NOTES-002). Source reassignment does not transfer authorship. Missing authors
require moderation. Forbidden checks produce false flags; lookup failures remain
errors. The portal validates both fields and shows Edit/Delete only from those
flags, subject to its existing read-only boundary. Creation still uses the
source-owner create capability; no `notes.update` capability is added. This
shared section serves lead, customer-profile and opportunity screens.

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
- The quick-edit Notes and Attachments sections use read-only access mode and
  converted-record state for their `readOnly` boundary. Their create/delete
  controls use the source-owner capabilities for creation and attachment deletion;
  existing note edit/delete controls use the per-note response flags above.
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

- **Lead UI copy (2026-10-18, FE-LEADS-021):** the executive Board, Card and
  Table views, quick editor, bulk actions, stage funnel and detail identity/company
  cards resolve their formerly inline Arabic/English labels, accessible names,
  validation messages and interpolated counts from `crmLeads` in both dictionaries. Tenant-authored stage
  and source names still use the localized data helpers. The quick editor uses
  the shared explicit date locales, including Western digits in Arabic.

- **User-facing copy (2026-10-18, FE-LEADS-041):** the detail dossier status
  uses the existing Arabic/English `LeadStatus` labels rather than the wire
  enum. Board and Card views omit the former implementation captions and
  unsupported undo promise; no static card-density caption is shown.

- **Quick-edit write feedback (2026-10-17):** inline updates and single-lead
  stage moves return an explicit outcome and normalized API error. The modal
  renders translated failures in its own alert, keeps rejected section drafts
  open, and restores rejected rating, card colour and stage changes. Writes are
  serialized so a pending optimistic value cannot become another write's
  rollback baseline. Late outcomes from a previous lead/branch do not alter the
  new selection. Successful stage changes stay in the editor without replacing
  the selected list row and restarting its detail read. Unknown outcomes retain
  the hooks' existing reconciliation reads and are never treated as success.

- **Detail stage control (2026-10-17):** the detail workspace renders one
  visible stage track, with no additional hidden stage control. Selecting a
  destination opens the workspace's confirmation before moving. The track
  remains disabled without update access, while moving, and for converted
  records; current and converted destinations are disabled too.

- **Disabled action accessibility (2026-10-18):** rating stars in Card and
  Table views have localized names that include the lead and target rating.
  Disabled stage-track destinations remain keyboard-focusable with a localized
  reason in their accessible name. Disabled lead-stage management controls use
  a focusable tooltip trigger so protected-stage and terminal-stage reasons are
  reachable without a pointer. Read-only phone cells render as text rather than
  an inert edit affordance.
  Table stage actions also remain keyboard-focusable when updates are unavailable
  or the lead is converted, announce a localized reason, and refuse activation.

- **Quick-edit conversion admission (2026-10-17):** Convert appears only when
  the convert capability allows the loaded lead's owner, access mode permits
  writes, and the lead is not converted. Update access does not grant conversion.
  The CTA opens the conversion modal; denied conversion has no fallback CTA
  navigating to the detail page.

- **Branch read denial (2026-10-17):** a 403 from Card/Table list/search or
  the active Board read renders `CrmScopeGate`, without a retryable load error
  or supporting-source degradation banners. The branch picker remains available
  so the member can select another branch. A capabilities 403 leaves all action
  capabilities unavailable without an outage banner; network/server failures
  and invalid capability responses still show the degradation notice.

- **Bulk assignment and rating (2026-10-17):** the selected-lead bar reads all
  CRM assignable-owner pages for `resource=leads&action=update` and intersects
  them with a freshly loaded `update.ownerUserIds` boundary (`null` means all).
  Loading, empty and failed reads disable assignment; reopening the selection
  retries. Selecting a salesperson sends `bulkUpdateLeads(ids, { ownerUserId })`
  for selected visible leads, with the existing write hook excluding converted
  leads and rechecking source-owner access. Successful assignment refreshes the
  views and clears selection; failure preserves selection and reports the error.
  Rating is labelled "Set rating"; the unsupported campaign control is removed.

- **Card toolbar bulk actions (2026-10-17):** card selection feeds the page's
  `LeadBulkActionsBar`, whose update/delete controls use eligible selected leads
  on the visible page. The card toolbar contains selection, CSV export and sort
  controls; it has no duplicate stage-move, salesperson or tag write controls,
  and no selection action opens only the first lead's quick editor.
- **Stage move menus (2026-10-17):** card view and both collapsed and expanded
  board cards supply move targets and the move callback only when the branch
  update capability allows updating that lead and its stage is not `CONVERTED`.
  An own-scope user sees no move items on another representative's card;
  converted cards also have no move items, matching the board's drag gate.
- **Quick-edit detail boundary (2026-10-17):** the modal shows its editor only
  after `GET /leads/:id` passes runtime validation for the requested lead. It
  never synthesizes writable detail or a contact replacement list from a list
  row's primary-contact summary. Loading exposes only close; failed reads,
  including malformed responses, expose retry and close without any write
  controls. A 403 uses the permission boundary. Retry re-reads the detail, and
  navigating to another lead or branch removes the previous editor immediately;
  aborted requests cannot supply stale detail to the next lead. Conversion hook
  state survives reloads, preserving its receipt when the detail read recovers.
- **Bulk delete (2026-10-17):** the list bulk bar opens the existing destructive
  confirmation before sending a request. The bar and dialog show the number of
  selected leads that are on the current visible page and allowed by the
  branch's delete capability, the total selection and the skipped count.
  Cancel sends nothing. Confirm sends only those eligible IDs to the existing
  branch-scoped bulk-delete route; the write hook rechecks owner access.
  Completion reports skipped leads in a localized toast. Selection clears only
  after all delete batches succeed, or when page, branch, search, sort or the
  KPI preset changes. A failed delete retains selection and confirmation;
  earlier successful batches may still have applied, so the existing reload on
  failure remains. Changing the result scope dismisses a stale confirmation,
  and an older in-flight delete cannot clear a new scope's selection.
- **Phone actions (2026-10-17):** the board, card, table, quick-edit phone pills
  and detail cards use `LeadPhoneActionsRow`, backed by
  `lead-phone-links.ts`. WhatsApp and Telegram use the same international
  digits: local numbers take the lead's country calling code (ISO code or
  Arabic/English country name from the country catalogue), removing leading
  local trunk zeros. Explicit `+`/`00` international numbers keep their supplied
  calling code and national digits, regardless of the lead's country. A local
  number without a recognized country has no chat links; calling keeps the
  stored local number. Empty/non-numeric numbers have no actions. Compact icons
  and labelled pills share the same links and localized accessible names, and
  activating them does not open the surrounding lead card.
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
  `/leads/board/stages/:stageId` for that stage only. Card/Table use the same
  list/search row with normal global pagination.
- Editing a lead happens on its detail page, `/crm/leads/:id`; no list view opens
  an edit modal. Activating a card, or a name or contact cell in the table,
  navigates there.
- Card and Table are the design-system `CardView` and `TableView` (compact
  density, server paging and sorting by `createdAt` or `displayName`), with
  row selection feeding the bulk bar. The Card toolbar also has a CSV action.
  Source reviewed **2026-10-17** (CRM-PERM-001): the card export requires
  `crm.leads.export` and is disabled without selected visible rows. It exports
  only those rows, never the unselected page or off-page IDs; there is no lead
  export route. A UTF-8 BOM preserves Arabic. Every header and data cell uses
  the CSV escaping helper shared with customer and opportunity exports: quotes
  are doubled and spreadsheet formula prefixes (`=`, `+`, `-`, `@`, tab, CR
  and LF, including after whitespace) receive an apostrophe prefix. The
  permission is in the normal catalogue and seed (bound 103); scoped reads
  still bound exported data. Deploy the approved common package and seed grants
  before enabling the portal gate.
- A card shows, from the list row: the heading (a corporate lead is filed under
  its company with the primary contact's name and position below; an individual
  lead is the person), an Individual/Company label, the stage badge, the Party
  country and city, tax and commercial-registration numbers, the interest or
  need text, and tags. Its pressable footer holds the primary number through the
  shared `LeadPhoneActionsRow` (call, WhatsApp, Telegram), a `mailto:` email, the
  source catalogue avatar and name, the
  `OPP`/`PQ`/`SO`/`IN` counters, the star rating, the next-activity mark and the
  salesperson. The overflow menu opens the lead, moves its stage (never to or
  from a `CONVERTED` stage), sets the card colour and deletes, each gated by
  `capabilities`.
- Board and grid card faces omit the **stage-age** badge. `stageEnteredAt`
  remains in the API for stage age on detail pages, measured from entry into
  the current stage rather than `updatedAt` or `createdAt`.
- Board-card expansion is the **Expand card** item in `LeadCardMenu`; the
  separate expand-card square no longer appears on the card face.
- Board and grid activity marks say **No activities** when there is no next
  activity. Per [decision 9](../design/specs/crm-leads-v3.md), with
  `startOfToday` at local midnight: `OVERDUE` means `due < startOfToday`,
  `TODAY` means `startOfToday <= due <= now`, `FUTURE` means `due > now`, and
  `NONE` means no next activity. A parseable `activityAt` wins over the server
  `bucket`, which is only the fallback. The server's Overdue Activity KPI
  continues to count `due < now`, including earlier today.
- The Table has columns for name (linking to the lead), contact, phone, country,
  stage, source, salesperson, follow-up and a delete action. The phone cell is
  the one place a number is edited in place (`useLeadInlinePhone`: Enter saves,
  Escape cancels; it starts from `leadEditablePrimaryPhone` and the page owns the
  PATCH). Stage is changed from the stage cell's menu; rating and the activity
  mark are the same controls as on the card.
- The country flag comes from `leadCountryIso`, which returns `null` for an
  unknown country so no flag is drawn rather than a default; `leadNameInitials`
  and `leadOwnerInitials` supply avatar initials.
- The `OPP`, `PQ`, `SO` and `IN` counters come from the single
  [`POST /leads/document-counts`](#post-leadsdocument-counts--card-view-counters-2026-10-14)
  read for the page. A kind the backend answered for no card is hidden; a card
  without its own answer shows `—`, never zero.
- Stage move is `POST /:id/stage`, never a generic `PATCH`.
- Move optimistically; reconcile against the server after every outcome,
  including definite rejections such as 409. The move remains pending until
  the active board reload finishes, bypassing the filter-change debounce.
  A failed board reload clears stale lanes and exposes the existing read error.
  Source reviewed **2026-10-17** (FE-LEADS-020).
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
  Apply action applies it. The Advanced toolbar has no saved-preset controls or
  result count; its Apply button submits the current filter tree. Re-entering
  Advanced reapplies its last submitted query without promoting later draft
  edits.
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

## Capability freshness

Access-mode controls reviewed **2026-10-18** (FE-LEADS-030): the Leads page,
all three Executive views and lead-stage management intersect write capability
with `useAccessMode().canMutate`. Restricted modes hide create, delete, bulk
writes, activity creation, inline phone/stage editing and card-menu writes;
rating stars remain visible as static icons. Board dragging and quick-add are
unavailable, including drafts opened before the mode changed. Open write
dialogs and stage popovers are withdrawn when access becomes read-only.
Read navigation, filtering, selection and authorized local CSV export remain
available. The shared unresolved-mode policy is unchanged: a mode absent from
the auth projection still follows the existing helper policy (OPEN-QUESTIONS Q16).

Verified **2026-10-17** (FE-LEADS-014): list and detail action capabilities
are tagged with the requested branch and organization scope. A branch switch
immediately hides the previous branch's actions while capabilities reload.
Window focus and the transport's structured `CRM_SCOPED_PERMISSION_DENIED`
403 event invalidate the mounted list, detail and create capability readers, including denials
from notes, attachments and other write hooks. Reloading clears action grants;
aborted or superseded reads cannot restore them. Capability-read denials do
not trigger another reload. The existing global 403 toast is unchanged; the
separate permission event carries the error code, endpoint, method and request
company/branch headers without request bodies or credentials. The backend
remains authoritative. This does not refresh `/auth/me` route admission.

## Portal status

Error feedback source-reviewed **2026-10-17** (FE-LEADS-019): list and board
reads and lead/lead-stage writes use `useCrmErrorText`, including translated
rate-limit and offline outcomes. Bulk failures retain their HTTP status and
append the refused lead ID after the translated message. Ambiguous writes keep
their existing reconciliation and duplicate-prevention notices. Definite create
rejections pass normalized field errors to the modal's existing inline fields,
including nested contacts, addresses and custom fields. Phone indexes map back
to the displayed rows after blank rows are omitted from the request. Editing or
resetting the submitted form clears its server field errors; client validation
continues to gate submission so corrected fields can be resubmitted.

| Capability | Status |
| --- | --- |
| List, branch-scoped, paginated | live |
| Basic search — field suggestions, multiple tokens, default My Leads | live |
| Advanced search — typed AND/OR filter-tree builder with explicit submit | live |
| Create | live |
| Tags during create | live — multi-select catalogue ids in the single atomic, idempotent create request |
| Delete | live |
| Stage move + board | live |
| Card view | live — selected visible-row CSV gated by crm.leads.export, BOM and shared formula protection |
| Table view | live — detail links and inline primary-phone edit; protected selected-row CSV planned under D-014 / FE-LEADS-026 |
| Capabilities-driven actions | live — every control on the list and the detail screen |
| Detail route | live — `/crm/leads/[id]`; **the proxy does not admit the path yet, see OPEN-QUESTIONS.md Q40** |
| Update | live — `PATCH /:id`, changed keys only |
| Convert flow | centered Small modal with review; immutable body/key per attempt; full verified DTO and flat-ID receipt |
| Company options | live — both routes, in the create drawer |
