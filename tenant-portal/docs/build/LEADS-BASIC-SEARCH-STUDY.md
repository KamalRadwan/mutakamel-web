# Leads basic search study

Studied: **2026-09-14**. Implemented through **2026-09-16**. Scope: Basic
search, while the separate Advanced filter-tree builder remains available.

## Reference behavior

[Odoo 19 search documentation](https://github.com/odoo/documentation/blob/19.0/content/applications/essentials/search.rst)
describes typing a value, selecting its search field from suggestions, and
turning that selection into a removable filter. Catalogue fields can expand
to choose an actual record. Multiple filters remain visible inside the search
control. Related alternatives use OR; independent criteria use AND.

[Odoo CRM's My Leads filter](https://github.com/odoo/odoo/blob/19.0/addons/crm/views/crm_lead_views.xml)
matches the assigned salesperson to the current user. In this portal the
equivalent is `ownerUserId = /auth/me.id`, not creator, team membership, or a
filter over the currently loaded page.

## Verified server support

- Gateway contracts: `crm.leads.get` and `crm.leads.search.post`.
- `LeadsController` applies `crm.leads.read` and branch access to both reads.
- `LeadsQueryDto`: branch, source, profile type, status, stage flag, stage,
  owner, plus inherited text/pagination/sort fields.
- `LeadSearchDto` inherits the filter tree grammar. `LeadsService.search` and
  `findAll` call the same scoped `LeadsRepository.searchReadModels`.
- Same-field structured values can use an `in` leaf; different fields are
  joined by AND. The read-only POST route provides this without changing the
  Advanced editor or inventing new query parameters.
- Party identity and contact values are projections rather than filterable Lead
  columns. Both endpoints accept one `search` plus a `searchField` of `lead`,
  `customer`, `email` or `phone`. Basic therefore exposes four field-specific
  suggestions but keeps one replaceable semantic text token. Splitting requests
  and merging pages in the browser would make pagination incorrect.
- Tag is backed by the existing catalogue and read-only search route. Selected
  tags travel as `tagIds`, whose server semantics are ANY/OR.

## Implementation decisions

1. Replace the separate Basic key/value controls with one input containing
   removable key/value tokens and field/value suggestions.
2. Start with a removable **My Leads** token. Resolve its owner from the live
   authenticated actor on every read, and never send an unfiltered request
   while that identity is unavailable. Removing it reveals only server-permitted
   results; it does not expand authorization.
3. Typing builds suggestions locally. Commit a token only after an explicit
   option selection or Enter; then reset to page 1 and use the existing debounce.
4. Deduplicate identical tokens; OR structured values for the same field and
   AND different fields. A new semantic text token replaces the previous text.
5. Keep a GET for filters the list DTO represents; use the existing read-only
   POST for repeated structured values, with replay-safe read settings.
6. Stage-strip selection replaces only the stage tokens, preserving My Leads
   and the other Basic filters. Automatic branch/recovery resets restore My
   Leads, and branch changes clear unfinished text/field drafts; explicit chip
   removal and Clear All may remove the default token.
7. Use the existing design tokens, bilingual labels, RTL logical properties,
   portalled suggestions, combobox/listbox semantics, arrow/Enter/Escape support,
   removable chips, and composition-safe keyboard handling.

## Verification

### Screenshot review — 2026-09-14

The user's Odoo screenshots clarify the desired interaction, beyond merely
supporting the request grammar. Keep one bordered control with a leading search
icon, a removable **My Leads** chip with a filter icon, the editable value, and
a trailing disclosure button. Typed suggestions should read `Search <field>
for: <value>`, visually distinguish the field and typed value, and show a small
disclosure arrow for fields that require selecting a catalogue/enum value.
Rows stay compact; avoid repeating a second instructional line on every row.

The Basic implementation has server-backed multi-value structured filters, Tag,
four semantic text scopes, and the default actor filter. Advanced remains a
separate explicit-submit AND/OR filter-tree builder. The single-text constraint
remains explicit, including when a new text selection replaces the previous one.

Check default and removed My Leads, unknown/changed actor identity, combined
fields, repeated values, duplicate removal, stage-strip synchronization,
pagination reset, Advanced draft isolation, keyboard selection and chip removal,
Arabic/English labels, RTL, catalogue failures, and the existing search tests.

### Implementation verification — 2026-09-16

- 76 focused tests pass across the Basic contract, semantic search fields, Tag
  POST requests, lead request lifecycle, bilingual combobox interactions,
  keyboard behavior, chip presentation, and default My Leads resets.
- TypeScript and targeted ESLint pass. RTL, identifier, and sibling-key guards
  pass across the workspace.
- An authenticated browser session was not available, so live lead results and
  authenticated visual verification are not claimed.
