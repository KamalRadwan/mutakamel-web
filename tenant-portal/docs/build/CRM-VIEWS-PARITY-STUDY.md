# CRM views parity study

Last verified: 2026-09-18

This study defines how the Leads workspace becomes the interaction and data-contract reference for Customer Profiles and Opportunities. The goal is behavioral parity, while keeping each record type's own lifecycle and fields.

## Reference behavior

The Leads workspace establishes these rules:

1. Board, Card and Table are separate read use-cases.
2. Board returns a lightweight projection and an independent first page of 50 records for every stage. Each stage owns its own continuation and Load more action.
3. Card and Table use the richer list/search projection. They are not grouped by stage unless the user selects a stage filter.
4. Basic search is an Odoo-style token input. The user types first, chooses the field/value, and may keep several filters. The default ownership token is `My Leads`.
5. Advanced search remains an explicit-submit filter tree behind one compact toggle. It has no separate free-text box above the condition builder.
6. Card View is compact and has no row-selection controls. Operational data stays pinned to the card footer.
7. Table View is compact. Primary identity cells open the record; inline rating/activity controls perform their own action without opening the row.
8. The detail page uses the lifecycle bar, compact main cards and a 320px end rail with History, Activities and Attachments.

## Implemented result

The implementation now follows the split above:

- Customer Board reads `POST /customer-profiles/board` and loads each status independently through `POST /customer-profiles/board/statuses/:status`, with a fixed 50-record lane size.
- Customer Card and Table read the rich list/search projection. Corporate rows include their primary contact and phone data; local status changes and Board refreshes do not replace those rows with the lightweight Board shape.
- Opportunity Board continues to use the pipeline Board and per-stage continuation routes. Card View now reads `/pipelines/:pipelineId/cards`, while Table reads the rich opportunity list/search projection.
- Customer and Opportunity Basic search use the shared token input, accept several chips, and start with `My Customers` or `My Opportunities`. Advanced search remains an explicit-submit tree with no duplicate text box.
- Customer and Opportunity Card/Table views use compact layouts, direct contact actions, public labels and avatars, source and activity context, and bottom-aligned operational footers.
- Customer rating and card colour are persisted by CRM and available in Board, Card, Table and Advanced Search. Opportunity keeps its existing persisted `importance` as the rank and now persists the same card-colour palette.
- Customer and Opportunity Board cards use Lead-style colour borders, editable three-star rank controls, activity actions and public salesperson identity. Opportunity cards retain amount, currency, probability and expected-close data.
- One Customer and One Opportunity now use the Lead detail composition: lifecycle bar, compact information cards, related-document navigation, and the History/Activities/Attachments side rail.

Lead rating writes were also hardened while applying the same projection rule. A rating/card-colour PATCH now merges only its confirmed fields into the latest rich row. The detail/PATCH projection includes `primaryContact`, and legacy corporate leads fall back to their organization primary relationship only when no lead-scoped contact mapping exists. Changing a rank can therefore no longer erase the company contact or phone from Table View.

## Baseline findings before implementation

| Area | Customer Profiles | Opportunities |
| --- | --- | --- |
| Board source | Reuses the page-numbered list response and therefore sees only the current 25-row page | Has `GET /pipelines/:id/board`, 50 per stage, plus stage cursor endpoints |
| Board paging in UI | Whole-board page controls; no independent status paging | Hook implements stage load-more, but `BoardView` is not wired to expose it |
| Card source | Reuses the same 25-row list | Reuses Board items even though `/pipelines/:id/cards` exists |
| Table source | `GET /customer-profiles` / `POST /search` | `GET /opportunities` / `POST /search` |
| Rich list fields | Party summary only; no address, corporate primary contact, owner name/avatar, source icon or next activity | Generic entity fields only; customer and owner names exist only in the Card endpoint |
| Basic search | One field/value row | One unqualified text input |
| Advanced search | Filter tree plus a separate free-text input | Filter tree plus a separate free-text input |
| Default ownership filter | None | None |
| Customer card state | Rating and colour are browser-local and disappear on reload | Importance is persisted; card colour is browser-local |
| Detail projection | Party summary; no contacts/address projection | Raw opportunity entity; customer/owner display data absent |
| Detail layout | Already close to Leads: lifecycle bar, compact cards, related nav and end rail | Lifecycle bar exists, but header/layout/data are not yet at Leads parity |

## Target API contracts

### Customer Profiles

Customer Profiles needs a real board contract rather than grouping one page of list rows in the browser.

- `POST /api/tenant/crm/v1/customer-profiles/board`
  - Branch-scoped and capability-scoped.
  - Returns every fixed customer status in canonical order.
  - Each status contains at most 50 lightweight cards, total count, current page/cursor and `hasMore`.
  - Accepts the same applied Basic/Advanced filter semantics as list/search, excluding a selected status when assembling all lanes.
- `POST /api/tenant/crm/v1/customer-profiles/board/statuses/:status`
  - Returns the next page for one validated status.
  - Repeats the same filter/sort context and rejects mismatched continuation state.
- `GET /customer-profiles` and read-only `POST /customer-profiles/search`
  - Remain the Card/Table source.
  - Return the customer identity, party address, one primary corporate contact, acquisition-source icon/name, owner display data and next activity.
- `GET /customer-profiles/:id`
  - Returns the detail projection, including address and contacts, so the page does not fabricate empty contact cards after an add/edit.

Board rows must omit expensive detail-only collections. Card/Table rows must not be replaced by a lightweight board or mutation response.

### Opportunities

The existing endpoint split is structurally correct and should be completed rather than replaced.

- `GET /pipelines/:pipelineId/board`
  - Board only; 50 records per stage and independent cursors.
- `GET /pipelines/:pipelineId/stages/:stageId/opportunities`
  - One stage's continuation page.
- `GET /pipelines/:pipelineId/cards`
  - Card View only; rich ungrouped card projection, optionally narrowed by stage.
- `GET /opportunities` and read-only `POST /opportunities/search`
  - Table View; enrich rows with customer and owner display data required by visible columns.
- `GET /opportunities/:id`
  - Detail projection with customer/contact, owner, source and activity display fields needed by the Leads-style page.

Board, Card and Table filters must remain server-side. Card View must never flatten the current Board lanes and call that a complete list.

## Search contract

Basic search for all three workspaces uses the shared token control and applies immediately.

### Customer tokens

- Default: `My Customers` (`ownerUserId = authenticated user`).
- Text choices: Customer, Email, Phone/Mobile. Customer searches both person and
  organization names.
- Catalogue/enum choices: Status, Customer type, Source.
- Repeated structured fields become `IN` filters through the search endpoint.
- Only one semantic text token is active because the wire carries one `search` plus one `searchField`.

### Opportunity tokens

- Default: `My Opportunities` (`ownerUserId = authenticated user`).
- Text choices: Opportunity, Customer, Email, Phone/Mobile.
- Catalogue/enum choices: Tag, Status, Stage flag, Pipeline, Stage.
- Pipeline and Stage tokens remain compatible; the server validates stage membership.
- The token bar accepts several simultaneous filters. Tags may repeat (up to 50); route-owned scalar choices such as Status, Stage flag, Pipeline and Stage replace the earlier chip for that field so Board, Card and Table keep identical semantics.

Advanced search keeps the existing AND-inside-group / OR-between-groups tree and explicit Search button. The free-text input and explanatory sentence above the tree are removed; joined identity text is handled by Basic search.

The Stage/Status bar and Basic tokens are one state:

- selecting a stage/status adds or replaces that field's token;
- selecting All removes only those tokens;
- other tokens, including the default ownership token, remain intact;
- the bar is hidden while Advanced is active so it cannot mutate an unapplied draft.

## View behavior

### Board

- Customer columns use the fixed customer-status order.
- Opportunity columns use the selected pipeline's stage rank.
- Initial lane size is 50.
- Each column shows the server total and its own Load more state.
- Board projections carry only what their compact cards render. Rich phone,
  email, address and document-count fields remain in Card/Table projections.
- Moves remain capability-gated, optimistic and reversible on a definite failure.
- Blacklisted, Won and Lost moves confirm before the write.

### Card

- Compact density and no selection checkbox or Select All.
- Customer cards distinguish individual/company and show photo/logo, status,
  tags, phones/actions, country/city, email/website, primary corporate contact,
  source, salesperson avatar/name and activity state.
- Opportunity cards show title/status, customer and primary contact, phone
  actions, country/city, source, tags, exact amount/currency, probability,
  expected close, owner/avatar, importance, open activity state/count and the
  permission-visible `PQ`/`SO`/`IN` counts.
- Footer content stays bottom-aligned across cards of unequal body content.
- Any rank/importance update merges only the fields confirmed by that mutation and preserves rich list fields.

Customer Profiles persist a bounded `rating` from zero to three and an optional
card colour. Opportunities keep `importance` as their bounded rank and persist
the same optional colour. Colour-only changes are presentation preferences and
do not create business-history noise; rank changes remain business changes.

### Table

- Compact header and rows.
- The first identity cells link to the detail route.
- IDs are never used as the visible owner/customer label when the API can return the public name.
- Phone actions are independent controls and do not activate the row.
- Rating/importance and activity controls are interactive and capability-gated.
- Customer rows preserve bounded tags, both primary-contact position and email,
  country/city and the customer/owner images returned by the API.
- Opportunity rows preserve bounded tags, full primary-contact context,
  country/city and exact amount/currency/probability values.

## Detail-page parity

Both detail pages follow the Leads composition:

1. Related-record navigation in the page action bar.
2. A screen-reader document heading without a duplicate visible title block.
3. The record's status/stage bar with confirmation before mutation.
4. Compact main cards for organization/person/contact identity and record-specific facts.
5. Compact custom fields.
6. A 320px end rail whose equal tabs are History, Activities and Attachments.
7. Public people labels/avatars instead of raw UUIDs; opening a person uses the reusable public-profile modal.
8. Creation history collapses to `Customer created` or `Opportunity created`; later changes retain meaningful diffs and resolve reference names.

Opportunity-specific commercial fields (amount, currency, probability, expected close, win/loss evidence and pipeline transfer) remain present. Parity does not remove domain-specific information.

## Safety and verification

- Preserve tenant, branch, owner and pipeline authorization in every query.
- Compile filters with parameterized SQL and whitelist fields/operators.
- Do not expose storage keys, private user data or raw activity records in board projections.
- Abort stale browser requests and reject duplicate records across pages.
- Validate Arabic RTL and English LTR labels and logical alignment.
- Contract tests cover response shapes and 50-row lane limits.
- Frontend tests cover endpoint selection by view, multi-token search, independent lane paging, rich-field preservation after mutations and detail rail behavior.
- Final verification includes frontend TypeScript/lint/tests/docs and focused CRM/Gateway tests.
