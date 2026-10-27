# CRM — Customer Profiles

Status: **verified**

Last source verification: **2026-10-18**

Owning app: **crm-app**

Canonical prefix: `/api/tenant/crm/v1/customer-profiles`

Portal status: **built** — independently paginated board, rich card and table
views, detail, create, update, status change, rating and card colour, delete
and add-contact. Not exercised against a live session: CRM is blocked twice
over, by P4 and by Q17.

`GET /:id` returns `CustomerProfileReadModel`, including the acquisition
source, Party summary, primary address and the customer's contact
relationships. The registration identifiers (`taxNumber`,
`commercialRegistrationNumber`) live on the joined Party, not on the profile
row.

Source inspected:
`crm-app/src/crm/customer-profiles/customer-profiles.controller.ts`,
`dto/customer-profile.dto.ts`,
`crm-app/src/crm/common/dto/crm-list-query.dto.ts`,
`crm-app/src/common/party-read-model.ts`.

## Routes

Owner-picker capability wiring verified **2026-10-17**: create filters branch
owner options by `customerProfiles.create.ownerUserIds`; list quick edit and
bulk assignment use `customerProfiles.update.ownerUserIds`. An own-scope user
can select only themselves. `null` owner IDs allow all branch options; a
missing action capability or an empty list exposes no owner choices. Create
and bulk filter at render time so changed capability boundaries immediately
apply to already loaded options. Backend authorization remains authoritative.

Read-only access mode suppresses customer create, update, delete and activity
controls. Capability answers are scoped to the selected branch and are cleared
from view while a different branch is loading. A customer-list 403 renders the
CRM scope gate. Notes and attachments use their own branch capability answers;
they do not require customer-profile update permission. Activity scheduling is
read-only for blacklisted profiles.

| Method | Canonical path | Permission | Branch guard |
| --- | --- | --- | --- |
| POST | `/api/tenant/crm/v1/customer-profiles` | `crm.customer_profiles.create` (scoped) | body |
| GET | `/api/tenant/crm/v1/customer-profiles` | `crm.customer_profiles.read` (scoped) | query |
| POST | `/api/tenant/crm/v1/customer-profiles/search` | `crm.customer_profiles.read` (scoped) | body |
| POST | `/api/tenant/crm/v1/customer-profiles/board` | `crm.customer_profiles.read` (scoped) | body |
| POST | `/api/tenant/crm/v1/customer-profiles/board/statuses/:status` | `crm.customer_profiles.read` (scoped) | body |
| GET | `/api/tenant/crm/v1/customer-profiles/capabilities` | **none** — branch membership | query |
| GET | `/api/tenant/crm/v1/customer-profiles/:id/tags` | `crm.customer_profiles.read` (scoped) | record |
| POST | `/api/tenant/crm/v1/customer-profiles/:id/tags` | `crm.customer_profiles.update` (scoped) | record |
| DELETE | `/api/tenant/crm/v1/customer-profiles/:id/tags/:tagId` | `crm.customer_profiles.update` (scoped) | record |
| GET | `/api/tenant/crm/v1/customer-profiles/:id` | `crm.customer_profiles.read` (scoped) | record |
| PATCH | `/api/tenant/crm/v1/customer-profiles/:id` | `crm.customer_profiles.update` (scoped); dedicated manual-status grant planned under D-034 / CRM-CUST-004 | record |
| POST | `/api/tenant/crm/v1/customer-profiles/:id/contacts` | `crm.customer_profiles.update` (scoped) | record |
| DELETE | `/api/tenant/crm/v1/customer-profiles/:id` | `crm.customer_profiles.delete` (scoped) | record |

## GET /customer-profiles — list

`CustomerProfilesQueryDto extends BranchListQueryDto`:

| Parameter | Type | Required |
| --- | --- | --- |
| `branchId` | UUIDv7 | **yes** |
| `page`, `limit`, `sortBy`, `sortDir` | pagination | no — `sortDir` is `ASC`/`DESC`, see [README.md#sort-parameters-differ-per-endpoint](README.md#sort-parameters-differ-per-endpoint) |
| `search`, `searchField` | text plus `customer` \| `email` \| `phone` | no |
| `profileType` | `CrmProfileTypeEnum` | no — `INDIVIDUAL` \| `CORPORATE` |
| `status` | `CustomerStatusEnum` | no — 4 values |
| `acquisitionSourceId` | UUIDv7 | no |
| `ownerUserId` | UUIDv7 | no — **narrows only** |

Response `200` is the flat CRM page
`{ items, total, page, limit, totalPages, hasNext, hasPrev }`. Card/Table rows
are enriched with the customer Party image and contact methods, company
website, primary address, primary corporate contact, owner name/avatar,
acquisition source, next activity, tags, `rating` and `cardColor`. Board rows
intentionally use a smaller projection. Each tag is
`{ id, name, backgroundColor, textColor }` — an upper-case `#RRGGBB` pair or
both `null` (verified 2026-09-24, [catalogues](crm-catalogues.md#tags)).

Advanced search uses `POST /customer-profiles/search`. Its filter tree accepts
`rating` and `cardColor` alongside the existing identity, status, type, source
and owner fields. Those fields are Advanced-search conditions; Basic search
keeps its token input and default **My Customers** scope.

## POST /customer-profiles/board — board

The first request returns every fixed `CustomerStatusEnum` lane with its own
first page. Each lane is limited to **50** rows and has independent continuation
metadata. `POST /customer-profiles/board/statuses/:status` loads the next page
for one lane without reloading the others.

Board items include the compact identity, `primaryContactName`, source, tags,
public owner name/avatar, activity summary, `rating` and `cardColor`. The
primary contact is deliberately a scalar display name here. Address, contact
phones/email and the full primary-contact object belong to the richer
Card/Table list projection and the detail read model.

## POST /customer-profiles/:id/contacts

Adds a contact person to a **corporate** profile. Requires
`crm.customer_profiles.update`, not a separate contacts permission.

Previously documented as not Gateway-exposed. That was wrong — verified
exposed on 2026-08-27 as `crm.customer.profiles.contacts.post`.

## PATCH /customer-profiles/:id

Table inline phone editing (source reviewed **2026-10-17**, FE-CUST-005)
shows and edits the first customer Party phone. Corporate rows send the full
company phone list as `companyPhones`; individual rows send the full list as
`primaryContact.phones`. Only the displayed entry is replaced, preserving
the remaining numbers and their order. No names or email are resent.
Corporate contact-person phones are edited only in the contacts card.

Company-field clearing verified against source **2026-10-18**: the edit
request builder sends only changed fields. Company-phone writes use only
`companyPhones`, replacing the PHONE set once; `[]` clears it. `companyPhone`
remains a response display field. Emptying email, website, tax number or
commercial registration number sends `null`, clearing the Party contact-method
type or registration value. Registration writes use only `taxNumber` and
`commercialRegistrationNumber`. Omitting a key leaves it unchanged. The server
also normalizes blank tax/CR numbers to `null`.
Company name remains non-empty and is omitted when its input is emptied.

Also the board view's drag target. Moving a card between columns sends
`{ status }` — there is no dedicated stage endpoint here, because customer
status is a fixed enum rather than a tenant catalogue.

The same endpoint persists card presentation controls:

```json
{ "rating": 2, "cardColor": "BLUE" }
```

- `rating` is an integer from `0` through `3` and is rendered as three stars.
- `cardColor` accepts the shared CRM palette or `null`; `null` removes the
  colour and an omitted key leaves it unchanged.
- Rating changes are business changes and remain auditable. Card colour is a
  presentation preference and colour-only changes are not written to the
  business audit timeline.

`BLACKLISTED` changes should confirm before sending. It is not an irreversible
state; explicit, authorized re-activation is the decided way to clear it.

### `BLACKLISTED` survives opportunity wins; manual-status protection is planned

**Source reviewed 2026-10-17** against `OpportunitiesService` and
`CustomerProfilesService` (D-034, DOCS-FE-001).

Both automatic promotion paths in `opportunities.service.ts` — creation in a
won stage and a move entering a won stage — promote only a `PROSPECT` to
`ACTIVE_CUSTOMER`. Neither overwrites `BLACKLISTED` or `INACTIVE`. The former
claim that winning an existing deal silently clears a blacklist is stale.
Creating an opportunity for a blacklisted customer is also rejected with
`409 CUSTOMER_PROFILE_BLACKLISTED`.

**Planned — D-034, CRM-CUST-004:** manual status changes, including entering
or leaving `BLACKLISTED`, require the dedicated
`crm.customer_profiles.status.manage` permission through the normal catalogue
and seed, with an explicit status-change audit entry. Only a won opportunity
may set `ACTIVE_CUSTOMER`. Current create/update DTOs still accept status and
the update service saves it under scoped `crm.customer_profiles.update`,
without that dedicated status grant or transition restriction. Portal status
controls still use update access; the new permission gate is planned with the
backend contract, not an enforced guarantee today.

## DELETE /customer-profiles/:id

Returns **`204`** with no body.

## Frontend notes

- Quick-edit write outcomes (source reviewed **2026-10-17**, FE-CUST-006):
  rejected rating and card-colour writes restore their previous values;
  refused status moves retain the saved status. Failed section and contact
  saves, card writes and status moves use translated CRM error feedback.
  Detail loading is keyed by customer ID, so rating/colour updates and list
  refreshes for the same customer preserve open drafts. Blacklisting still
  waits for confirmation; cancellation applies no status change.

- Tag controls (source reviewed **2026-10-17**, FE-CUST-012): detail tag
  creation requires `crm.tags.manage` (or tenant ownership) as well as profile
  edit access. Detail and quick-edit catalogue pickers require `crm.tags.read`
  (or tenant ownership) and profile edit access; hiding the picker does not
  hide attached customer tags. Failed or malformed catalogue responses show
  the existing translated tag-load error toast and close the picker; clicking
  Attach Tag again retries the read.

- Related navigation and quick-edit pills (source reviewed **2026-10-17**,
  FE-CUST-011) accept the base Opportunities read permission or its `.own`,
  `.team` and `.all` variants. Trade pills require the corresponding exact
  quotation, sales-order or invoice read permission; denied pills are hidden
  and no count request is sent. Quick-edit labels use the existing Arabic and
  English related-record dictionary. Pending/unavailable counts show an
  ellipsis/dash, preserving zero for a confirmed empty result. Backend record
  scope remains authoritative.

- Existing corporate contacts (source reviewed **2026-10-17**, FE-CUST-004)
  keep their Core directory identity and communication methods read-only in
  quick edit and the detail Contacts card. Honorific, name, email and phone
  changes belong to Core directory writes; CRM relationship edits retain job
  title and primary-contact controls. Quick edit uses the validated PATCH
  detail response for edits and refreshes detail after adding a contact, so
  draft identities, phone values and client-generated contact IDs never appear
  as saved server data.

- CSV export (source reviewed **2026-10-22**, FE-CUST-013) in Card/Table
  requires `crm.customer_profiles.export`. Export includes only selected rows
  visible in the current view; no selection disables the labelled control.
  Headers, profile types and statuses follow the current language. UTF-8 BOM
  is preserved; every CSV cell is quoted and formula prefixes (`=`, `+`, `-`,
  `@`, tab and carriage return, including after whitespace) receive a leading
  apostrophe. Selections from another page or hidden by the local status
  filter are excluded; the export label counts only selected visible rows.
  The permission is static: it enables exporting data already admitted by
  scoped reads, without widening record access. The normal CRM permission
  catalogue/seed supplies it. The lead confirmed that `crm-app-common` 0.0.7
  and provisioning release 003 have shipped the permission to the dev tenant;
  the earlier package/seed blocker is resolved. The control is hidden without
  the permission, including when it is removed from the active session.

- Quick edit (source reviewed **2026-10-17**, FE-CUST-003) exposes no write
  controls until `GET /:id` validates for the selected customer. Pending reads
  show loading; refused, failed or malformed reads show Retry and Close, with
  the scope-denied surface for HTTP 403. Switching customers immediately
  locks edits and ignores the previous read's late response. List rows never
  supply editable detail defaults, preserving source, description and Party
  tax/registration values when the detail cannot be read. Ctrl/Cmd+S cannot
  save while detail is unavailable.

- Bulk actions (verified **2026-10-17**, FE-CUST-007) submit only customers
  eligible for that action and report eligible, succeeded, skipped and failed
  counts. Skips explain the action scope; API failures use translated CRM
  reasons, including deletion blocked by active opportunities. After refresh,
  successful customers leave the selection; failed and skipped customers stay
  selected. Schedule activity is available only for a single selected customer.

- Phone actions (verified **2026-10-17**) use the shared
  `leads/lead-phone-links.ts` normalizers. WhatsApp and Telegram require an
  international number: local numbers use the supplied country (ISO code or
  country name) and omit their trunk zeroes; without a recognized country,
  chat actions are hidden. An explicit international prefix takes precedence
  over the country. Calling remains available for local numbers.
- Board quick-add leaves the acquisition source empty until the user chooses
  one. If saving the initial rating or tags fails after profile creation, the
  portal keeps the created profile and shows a translated warning. Customer
  profile labels and accessibility text use the Arabic and English dictionaries
  rather than language-specific string branches. This includes the create
  form's Company section, the board's Company mode and missing-phone label,
  and the Basic search Phone field.
- **The board axis is `CustomerStatusEnum`** — a fixed 4-value enum, in this
  order: `PROSPECT`, `ACTIVE_CUSTOMER`, `INACTIVE`, `BLACKLISTED`.
  Unlike leads and opportunities this needs **no catalogue fetch**, and the
  column set never varies by tenant.
- Default view is `board`; Card and Table use the richer list/search projection.
- Status funnel totals (verified **2026-10-17**) load independently in Basic
  Card/Table view through four read-only `POST /customer-profiles/search`
  requests with `limit: 1`, one per status. They preserve the board's search,
  branch and owner scope, excluding the selected status token. "All" sums the
  server totals rather than the visible page. Counts are hidden until all four
  responses validate, and while refreshing, after failure, or after the query
  changes; unknown counts never render as zero. Board pagination stays at 50.
- Core owns the underlying party directory; CRM owns the profile. Do not try
  to join them client-side.
- Card and Table consume the rich list/search projection. Preserve the owner
  avatar, city/country, website, tags and corporate primary contact instead of
  reducing the row to profile ids. The projection also carries the Party
  photo/logo for surfaces that render it; the compact Customer cards use the
  individual/company type icon. Card view loads quotation, sales-order and
  invoice counts through shared bulk count requests and renders them as `PQ`,
  `SO` and `IN`.
- Rating and card colour are persisted server-side and shared by Board, Card
  and Table. Optimistic updates must change only those keys, preserve the rich
  row already on screen and reconcile after an ambiguous response.
- Customer error feedback (reviewed **2026-10-17**, FE-CUST-014) uses
  `useCrmErrorText` for list loads, deletion and inline company, contact and
  profile saves. Deletion blocked by active opportunities shows the translated
  reason. Detail rating/colour write failures show a translated error toast;
  ambiguous or unreadable write responses also reload the detail.
- The list screen's Basic search uses removable tokens in one input. Its
  semantic choices are Customer, Email and Phone/Mobile; there is no Lead
  choice on this screen. Status, Customer type and Source are structured
  choices, and **My Customers** is selected by default. Repeating a structured
  field uses the read-only search endpoint so alternatives are evaluated before
  pagination. Advanced search remains a separate explicit-submit filter-tree
  editor.
- `search` matches the **party's identity**: display name, first name, last
  name, organization name and its contact methods (`partySearchPredicate()`).
  The profile's own `description` is in the repository's `searchableFields` but
  no code path reaches it from this route, so no label may promise it.
- `sortBy` accepts `displayName` and `createdAt` and nothing else. `safeSortBy`
  **throws** on an unlisted value rather than falling back to the default it is
  handed, so an unrecognised sort is a `400`, not a default sort.
- Basic search applies the authenticated user's `ownerUserId` through the
  default **My Customers** chip. The screen does not expose a raw UUID field.

## Portal status

| Capability | Status |
| --- | --- |
| List, branch-scoped, paginated | live |
| Basic search — token input | live — Customer, Email, Phone/Mobile, status, customer type, source |
| Advanced search | live — includes rating and card colour |
| Detail route | live — full action cluster and custom-fields rail |
| Board view | live — `CustomerStatusEnum` axis, 50 rows per independently paginated status, compact read model |
| Card view | live — rich party/contact/source data, PQ/SO/IN, rating and card colour |
| Table view | live — rich read model with interactive rating and activity controls |
| Activities | live 2026-09-24 — the card, board and table activity marks open the shared Core activity modal on the customer (create, with its open activities listed above the form) and reload the view after any write; the detail page's Activities tab is the shared record panel. "Next activity" counts open (`PLANNED` or `IN_PROGRESS`) Core activities. Contract: [Core activities](core-directory.md#activities--12-routes) |
| Capabilities-driven actions | live — edit, status, delete and add-contact |
| Create / update / delete | live — `POST`, `PATCH /:id`, `DELETE /:id` |
| Add contact | live — `POST /:id/contacts`; **this route declares `organizationScopeMode: NONE`, so it must send NO scope headers** |
| Contacts list | live inside `GET /:id` through the detail projection's `contacts[]` |
