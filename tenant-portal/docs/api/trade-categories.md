# Trade Categories

Status: **implemented in source; release verification pending**.

Last source verification: **2026-09-27**. Backend and frontend source implemented; authenticated
browser and assistive-technology release verification remain pending.

Owning sources, relative to `backend/mutakamel-apps/`:

- `api-gateway-app/src/routing-proxy/route-contracts/trade.route-contracts.ts` and the Category route policy tests.
- `trade-app/src/modules/catalog/category.controller.ts`, `dto/category.dto.ts`,
  `category-command.service.ts`, `category-query.service.ts` and `category.repository.ts`.
- `trade-app/packages/contracts/src/category.contracts.ts` and
  `trade-app/packages/common/src/constants/category-policy.ts`.

The canonical domain specification is
[`02a_categories.md`](../../../../backend/docs/LLD/trade-app/en/07_Modules/10_MVP/02a_categories.md).

## Authority and transport

All routes require `trade.catalog`. Management reads require `trade.items.read`
at TENANT; writes require `trade.catalog_master.manage` at TENANT. Manage does
not imply read. Management sends no company, branch or channel headers.
The options projection alone uses the current operating context and the
server's existing Item visibility rules before counting and pagination.
An Item master form explicitly selects TENANT options; a contextual consumer
may select OPERATING_CONTEXT. A 403 renders a permission boundary, never an
empty catalog.

| Method | Canonical route | Request / purpose |
| --- | --- | --- |
| GET | `/api/tenant/trade/v1/categories` | `page`, `limit`, `locale`, `status`, `parentId` (UUID or ROOT), `search` |
| POST | `/api/tenant/trade/v1/categories/search` | Read-only search; list fields plus `ancestorId` or `moveSourceId`; no idempotency key |
| GET | `/api/tenant/trade/v1/categories/tree` | One direct-child page; omitted `parentId` means roots |
| GET | `/api/tenant/trade/v1/categories/:id` | Fresh names, path, usage and row/tree versions |
| POST | `/api/tenant/trade/v1/categories` | `code`, `displayName`, `localizedNames`, `parentId`, optional `beforeId`, `expectedTreeVersion` |
| PATCH | `/api/tenant/trade/v1/categories/:id` | `displayName` and/or complete replacement `localizedNames` |
| POST | `/api/tenant/trade/v1/categories/:id/move` | `parentId`, optional `beforeId`, `expectedTreeVersion` |
| POST | `/api/tenant/trade/v1/categories/:id/reorder` | `beforeId` (null appends), `expectedTreeVersion` |
| POST | `/api/tenant/trade/v1/categories/:id/status` | `status`, `reason`, `expectedTreeVersion` |
| POST | `/api/tenant/trade/v1/categories/:id/delete` | `reason`, `expectedTreeVersion`; soft-delete receipt with HTTP 200 |
| GET | `/api/tenant/trade/v1/catalog/categories` | Active, scope-filtered options with breadcrumbs |

Each write captures one UUIDv7 `x-idempotency-key`. Existing-node commands also
send the original `If-Match`. Row and tree versions are separate opaque tokens.
Transport replay is disabled; explicit recovery retains identical body, key,
path and preconditions. A confirmed receipt followed by a failed GET is saved;
Retry performs reads only. Network/5xx/unknown outcomes retain the original
request and block a new intent until recovered. Reasons stay in the request
and restricted audit; browser code does not persist or log them.

## Data and validation

Trade wraps responses in `{success,data,correlationId,timestamp}`. Pages carry
`items,total,page,limit,treeVersion,asOf`; tree pages additionally carry nullable
`parentId`. The frontend derives page navigation. Page size is 50 (API maximum
100), offset maximum 9,999, response maximum 1 MiB. Write receipts are limited
to 16 KiB and contain no names or usage.

Category paths include root through self. Management path segments additionally
carry absolute `siblingPosition`/`siblingTotal`; options and Item summaries omit
those counts. Runtime validators reject malformed UUIDs, path/depth/parent
inconsistency, mismatched response IDs/pages, and contradictory delete eligibility.
They do not treat receipts as fresh details.

The server normalizes uppercase ASCII codes and NFC plain names. A code is
immutable and lifetime-unique. Names allow 1–160 Unicode scalars. Locale keys
use `^[a-z]{2}(?:-[A-Z]{2})?$`; maps contain 1–20 entries. Forms preserve existing
translations and permit editing all of them. Status/reason/delete and structural
validation remain authoritative on the server. Own INACTIVE and inactive through
an ancestor are separate display states. A future status is labelled unknown.

## Item assignment

`ItemFormValues.category` is explicit intent: unresolved, none, or selected UUID.
Create cannot submit unresolved intent. None sends `categoryId:null`.
An unchanged edit omits `categoryId`, including when the options request fails
or the current assignment has become inactive. Clear is explicit null. Options
request state never changes intent. Raw UUID entry is removed from Create/Edit.

Authorized Item reads carry `categorySummary` (null iff `categoryId` is null):
`id,code,name,path,effectiveActive,treeVersion`. The Item parser validates the
summary ID against the assignment. Detail renders the fresh breadcrumb and
inactive explanation, without needing Category management authority.

## Tree, navigation and verification

`/trade/categories` offers a paginated List and a lazy Tree. Search, own status,
list page, view and selection use URL query state. `/trade/categories/:id` opens
the same workspace with that initial selection. Desktop shows explorer/detail;
smaller screens show the selected detail with Back navigation.
Search and status switch to List; returning to Tree clears these list-only
filters. Own/inherited status is announced on tree nodes. Unknown future
statuses remain readable but do not offer an inferred status transition.

Conflict review identifies the original and current server versions, retains
the user's draft and requires a separate resubmission after review. Client
validation and structured API field errors are linked to the affected fields.
Write access is rechecked while an editor remains open. An unknown-outcome toast
offers the original-request recovery action; an obsolete toast cannot replay a
later command or bypass changed permissions.

The reusable design-system Tree uses real roving focus and separate selection,
following the [WAI-ARIA Tree View pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/).
Physical Right/Left expand/collapse in both LTR and RTL. It supports Up/Down,
Home/End, Enter/Space and typeahead. Absolute sibling positions remain unchanged
on middle pages. Page controls are outside the tree/group roles. A late response
cannot reopen a collapsed branch; changed tree tokens reset cached pages.
After confirmed deletion and refresh, focus returns to the workspace heading,
including when deleting the final root removes every tree item.

Retained nodes are capped at 2,000. Collapsed pages are evicted, and a fully
expanded cache refuses another page with an explanation. Show in tree reads
only each ancestor's known sibling page, refreshes detail once on snapshot
mismatch, and never scans earlier pages. The current implementation is paged
and non-virtual. Unit DOM tests do **not** establish screen-reader compatibility.

Tests cover contracts, all six write transports, explicit Item intent, stale
reads, same-key recovery, keyboard behavior in both directions, middle-page
reveal and cache capacity. Live authenticated CRUD, bilingual/theme/reflow
visual inspection and the assistive-technology matrix remain release gates.
