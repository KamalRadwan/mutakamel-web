# 09: Record module pattern

A **record** is one business object that users list, search, create, open and edit: a lead, a customer, an opportunity, a trade item. A **record module** is the full set of screens for one record type.

Every record module follows this pattern, so a user who knows one module knows them all. **CRM Leads is the reference implementation.** Paths below are under `frontend/tenant-portal/src/app/` unless they start with `public/` or `design-system/`.

This chapter adds no new tokens. It combines the components of `03-components.md`, the views of `04-views.md`, the platform rules of `07-platform.md` and the screens of `08-additional-screens.md`. It also lists the approved exception rows in `AGENTS.md` that the pattern depends on (§6).

---

## 1. Anatomy

| Screen | Purpose | Leads reference |
|---|---|---|
| **List page** | Find, scan and act on many records (Table / Cards / Board) | `features/crm/leads/leads-page/` |
| **Quick modal** | Create, view and edit one record without leaving the list. One component for all three (rule 5). | `features/crm/leads/lead-modal/` |
| **Full page** | The same record with room for its related work (Activities, Calls, Attachments, History) | `features/crm/leads/lead-page/` |
| **Form sections** | The fields, shared by the modal and the full page through a `layout` input (`'modal'` or `'page'`) | `features/crm/leads/lead-form/` |

The record's data access lives in one file, `<record>.api.ts` (Leads: `features/crm/leads/leads.api.ts`), with its fake (`leads.fake.ts`) and types (`leads.model.ts`). Components never call the server directly (AGENTS.md, file rules).

---

## 2. The list page

### 2.1 Toolbar
One card (`rounded-10 bg-surface p-8 shadow-card`), one row, gap 8, in this order:
1. **Primary "New {record}"** (`uiButton`, `tablerPlus`). It opens the quick modal in create mode.
2. **Batch update menu.** It appears only in the Table view when at least one row is selected; it shows the count and only the actions the user may run (§2.5).
3. **Facet search** (`ui-facet-search`, fills the space; §3.1). While the advanced builder has an unapplied draft, the facet search is disabled with the title "Apply or clear the advanced search first".
4. A 1px divider, then the **Advanced search toggle**: an icon button with `tablerAdjustmentsHorizontal`, `aria-pressed`, `aria-expanded`, and `aria-controls` pointing at the builder panel (§3.2).
5. A divider, then the **view switcher** (`ui-view-switcher`): Board / Cards / Table. The chosen view is kept in the URL and in the user's preferences.

Reference: `leads-page/leads-page.html:1-57`.

### 2.2 Stage (status) filter bar
- **Component:** `ui-step-filter` (`shared/ui/step-filter/`). It shows "All" and then every stage in order, each with its count.
- **Shown in:** Cards and Table. The Board already shows the stages as columns.
- **Look:** filled arrow steps, 28 high, 12/500, overlapping by the arrow.
  - Chosen step: `bg-brand text-on-brand`; other steps: `bg-brand-soft`.
  - A negative stage uses the danger family and a won/converted stage the success family, through the step `tone`.
- **Exception:** AGENTS.md row "Leads, Cards and Table views".
- **Reference:** `leads-page.html:72-80`.

### 2.3 The three views

| Rule | Board | Cards | Table |
|---|---|---|---|
| Unit | Column per stage, record cards inside | Grid of record cards | One row per record |
| Card | Same record card component (`lead-card/`) | Same | — |
| Equal heights | The title block always reserves two lines (`min-h-card-title`) | Grid `auto-rows-fr`; footer pinned to the bottom; every card in a row the same height | Rows 40 (`h-table-row`) |
| Shadow / gap | `shadow-popover`, gap 12 | `shadow-popover`, gap 12 | Rows as cards per `07-platform.md` tables |
| Scrolling | Columns never scroll on their own. Each column is at least as tall as the page (measured at runtime, `[style.min-height.px]`). The page scrolls, and the horizontal scrollbar is always shown. | Page scroll | Page scroll |
| Paging | **Load more** at the end of every column ("Load more ({{shown}} of {{total}})") | **Pagination** (`ui-pagination`) at the end of the page | **Pagination** at the end of the page |
| Page size | Backend page size per column | Sizes and default from the backend; the user's choice is remembered; page and size in the URL | Same |
| Create | "+" in a column header opens the quick modal with that stage chosen | "New" | "New" |
| Selection | — | — | Checkbox column (§2.5) |

- **Exceptions:** AGENTS.md rows "Lead card (board and Cards view)", "Leads board" and "Leads Cards and Table".
- **References:** `lead-board/lead-board.html:14,116`, `lead-cards/lead-cards.html:29`, `lead-table/lead-table.ts:64-191`.

**The record card:**
- Type tile and name, with a second line for the main contact.
- A colour stripe on the start edge (the user's card colour).
- Footer: rating stars, due badge (opens the activities window), owner avatar, and the "…" menu.
- The menu has both "Open" and "Edit"; they open the same record. Menu rows show the icon tile and the title only (AGENTS.md row "Actions menu of a record").

### 2.4 Phone actions in rows and cards
Every phone number shows the call / WhatsApp / Telegram icons after it, using `app-phone-actions` (`shared/widgets/phone-actions/`). A number that is empty shows no actions and gives no accessible name. AGENTS.md row "Every phone number".

### 2.5 Selection and batch actions
- **Selection is a store, not row state.** It survives paging, sorting and view refreshes:
  - "Select page" and "Select all N matching" are separate;
  - the header checkbox shows the indeterminate state;
  - the count is shown in the toolbar.
  - Leads: `lead-bulk/lead-selection.ts`, `lead-bulk/selection-bar/`.
- **Every batch action is a worker job** (AGENTS.md / memory rule "batches go to the worker"). It is never a loop of browser requests.
  1. A modal per action collects the input: assign owner, change stage, schedule an activity, delete.
  2. The job is submitted to the backend.
  3. Progress shows in the shared jobs tracker in the top bar (`layout/bulk-jobs-indicator/`, `shared/bulk-jobs/bulk-jobs-tracker.ts`).
  4. When it finishes, the job report (`shared/bulk-jobs/job-report/`) lists the succeeded, skipped and failed records, with reasons.
  - Only one job per record list runs at a time; the menu is disabled with a reason while one runs.
- **Leads:** `lead-bulk/bulk-menu/`, `lead-bulk/run-modal/`, `lead-bulk/bulk-runner.ts`, `lead-bulk/leads-bulk.descriptor.ts` (registered in `shared/bulk-jobs/bulk-job-modules.ts`).

---

## 3. Search

### 3.1 Facet search (`ui-facet-search`, `shared/ui/facet-search/`)
- One input that turns typed text into **chips** ("Stage: New", "Owner: Me"). Presets are offered as chips ("My leads").
- **Behaviour:**
  - Clicking a chip opens its value editor.
  - **Removing a chip (×) keeps focus in the box but does NOT open the suggestion list.** Removing a chip is not a request to search (owner 2026-11-21).
  - "Clear all" clears the chips and the text.
- Facets are kept in the URL, so a search can be shared and survives a reload.
- **Per record:** a fields file and a chip mapper. Leads: `lead-search/lead-search.fields.ts`, `lead-search/lead-search.chips.ts`, `lead-search/lead-search.store.ts`.

### 3.2 Advanced query builder (`ui-query-builder`, `shared/query-builder/`)
- **Groups:** nested **AND / OR** groups of conditions (`query.model.ts`, `kind: 'group'`, `op: 'AND' | 'OR'`).
- **Operators depend on the field type** (`query-operators.ts`):
  - text: contains / starts with / ends with / equals / any of;
  - enum and lookup: is / is not / in / not in;
  - number and rating: = ≠ ≥ ≤ between in;
  - date: on / before / after / between / relative;
  - boolean: is;
  - tags: has any.
  - Every field also gets "is empty" and "is not empty".
- **States:**
  - Expanded: a panel with max height 360 and its own scroll.
  - Collapsed: a **one-line summary** of the applied query (`query-summary.ts`).
  - Apply and Clear are explicit. A dirty draft locks the facet search (§2.1).
- **Exception:** AGENTS.md row "Advanced search builder".
- **Per record:** the same fields file feeds both search surfaces. The query compiles to the backend filter in `lead-search/lead-search.compile.ts`.

---

## 4. The quick modal: create, view and edit in one

### 4.1 Frame
- **Size:** 980 × 760, two columns. The main column scrolls; the side column (320) scrolls on its own. Only these two scroll; the dialog itself never does.
  - On smaller screens the modal height is capped to the viewport.
  - AGENTS.md row "Lead quick modal and full page" (E1–E4; sizes pending owner approval).
  - Tokens: `--modal-lead-w`, `--modal-lead-h`, `--lead-side-w`.
- **Header: no data and no inputs.** It holds the type tile, the record type title, the record name as a sub-title, and:
  - in view/edit only, **‹ n of N ›**: the order of the current list (board column, cards or table, with its search and stage filter);
  - **Close**.
- **Footers:**
  - **Create:** "Create {record}" (primary), "Save and add another", "Continue in full page", "Undo changes" + "Unsaved changes" (E7).
  - **View/edit:** Save (disabled until dirty), "Continue in full page", Close, and Delete at the far end.
- **Toasts** live in a `popover="manual"` region, re-shown on every change, so they are always above modals (`shared/ui/toast/toast-host.ts`). They sit at the bottom start corner (AGENTS.md row "Web phone dial input and toasts").

### 4.2 Section bars
- **Look:** every section starts with a **36 colourful bar**, like a table header: `h-table-head rounded-10 px-10`, 13/500, `text-on-nav`, with a 14 icon before the title.
- **Colours by role:**

| Section role | Bar |
|---|---|
| Classification (the side column) | Navy gradient (`bg-nav-gradient`) |
| The main entity group (Company / Contact details) | `bg-icon-navy` |
| Contacts | `bg-icon-blue` |
| Custom fields | `bg-icon-violet` |
| More details | `bg-icon-blue` in both the modal and the page (owner 2026-11-21; orange fails dark-mode contrast). |

- **Exceptions:** AGENTS.md rows "Lead quick modal and full page, section headers" and "Workspace Home".
- **Reference:** `lead-form/lead-form.html`.

### 4.3 Side column: "{Record} classification"
The fields users change most, top to bottom:
1. **Company** and **Branch.** The defaults are the company and branch chosen in the session (top bar). They are read-only after create, shown as read-only inputs so the label and hint stay linked.
2. **Owner.** Default: the current user. Read-only when the user may assign only to themself.
3. **Stage.**
4. **Source.**
5. **Tags:** the shared `ui-tag-picker`, which can create a tag inline when the user has the tag permission.
6. **Expected value:** currency + amount.
7. **Required custom fields** (e.g. Budget range), under Expected value.
8. **Rating** (0–3 stars) and **Colour.**

- **Instant save:** rating, colour and stage save at once in view/edit (optimistic, with rollback and a toast on failure). Every other field needs Save.
- **Reference:** `lead-form/sections/classification-section/`, `value-section/`.

### 4.4 Main column order
1. **Record type** (segmented, e.g. Individual / Company). It is locked after create; changing it in create mode asks first because type-only fields are cleared.
2. **The entity group** for that type:
   - Company: name; phones on the start side; email and website stacked on the end side.
   - Individual: Title, First, Last, Mobile, Email.
3. **Contacts** (§4.5).
4. **Custom fields:** the non-required ones, shown directly, never hidden in More details.
5. **More details, always last:** address (country → state → city → district from the geography module), legal details, and the long texts (description, interest, need).
6. A **duplicate strip** sits inside the body, under the identity fields. It is a live suggestion list with actions ("Open lead"), not an error banner (E6).

### 4.5 Contacts
- **In create mode,** each contact is a "Contact N" form card: Title + Job title, First* + Last, Mobile (+ Add phone) + Email, delete, a Primary badge or "Make primary", then "+ Add contact".
- **In view/edit mode,** each contact is a **compact read card**: Title + name — Job title; phone | email; with Edit and Delete at the top.
  - **Edit** turns that one card into the form and the icon becomes **Save** (+ Cancel). Only one card edits at a time.
  - A contact is a party, so it **saves on its own** (toast "Contact saved"). It never touches the record's draft.
  - **Make primary** also saves on its own. Its accessible name is "Make {{name}} the primary contact".
  - A conflict (409) opens the conflict dialog.
- **Linked identity:** the name fields of a contact that is linked to an existing party are read-only. Email and phones stay editable.
- **Suggestion lists:** **Title** offers 10 common titles; **Job title** offers 50 common job titles, ordered from Owner down. Free text is always allowed (a combobox with `aria-activedescendant`). The hint says "Pick from the list or type your own, up to N characters."
- **Phones:**
  - Every phone input is country code + number (`ui-phone-input`), followed by the call / WhatsApp / Telegram actions.
  - The actions are disabled while the number is empty, then become `tel:` / `wa.me` / `t.me` links.
  - "+ Add phone" sits under each phone group.
- **Reference:** `lead-form/sections/contacts-section/`, `reach-section/`, `company-section/`.

### 4.6 Unsaved guard
- **When it asks:** in view/edit, with unsaved changes, on Close, Escape, an outside click, ‹ ›, or a route change.
- **The dialog:** "Save changes?" with **Save / Discard / Cancel** (`shared/ui/unsaved-dialog/`).
- **What counts:** a contact being edited counts as unsaved.
- **Undo** restores the last saved state.

---

## 5. The full page

Route: `/<app>/<records>/:id`, and `/<app>/<records>/new` for create.

- **Entry points:** "Continue in full page" from the modal (the draft and the ‹ › list are carried along), a deep link, or a reload.
  - A deep link or reload must load on its own.
  - Every translation scope the page uses (including the list's scope) must be provided by the page itself.
- **No aside and no left section nav.**

### 5.1 Header card
One card with two rows: identity, then tabs.
- **Identity row:**
  - back icon, type tile 28, the name 15/500;
  - a sub line 12 muted: primary contact · branch · created date;
  - the stage badge, owner avatar + name;
  - ‹ n of N › (only when the page was opened from a list);
  - the primary related action ("Log activity");
  - **Save / Undo / "Unsaved", shown only when dirty;**
  - "…" (Change colour, Move to, a divider, then **Delete**).
- Delete is an action, never the title.

### 5.2 Tabs
- **The tabs:** Overview / Activities / Calls / Attachments / History, as underline tabs with an icon and a counter.
  - **Overview** gets a red dot with sr-only text "This tab has errors".
  - **Activities** shows the open count.
  - **Calls** shows the total, plus "N missed" in red. It is loaded with the page, not when the tab opens.
  - **Attachments** shows the count.
- **Behaviour:**
  - The tab is in the URL (`?tab=`).
  - Create mode shows Overview only.
  - A tab stays mounted once visited, so an unsaved Overview edit survives tab switches.
  - Save with errors selects Overview, scrolls to the first bad section and focuses the first bad field.
  - Tabs use a roving tabindex, with arrow keys mirrored in RTL.
- **The tab panels:**
  - **Activities:** a day-grouped timeline with an Open / Completed / All filter and due badges. Create, complete and cancel all happen in the shared activities window. Core activities, target `<APP>/<RECORD>`.
  - **Calls:** `app-party-calls` with `partyType`, `[partyId]`, `[partyLabel]`, `[reloadToken]`, `(total)` and `(missed)`, inside a bounded height.
  - **Attachments:**
    - a drop zone plus a rows-as-cards table;
    - the 25 MB limit and the allowed types are checked on the client;
    - each upload gets one idempotency key, kept for retries;
    - controls are gated by the record's attachment permissions (create / delete), with a no-access state;
    - after a delete, focus moves to the next row.
  - **History:**
    - a day-grouped change log of the record and its contacts, filtered All / Details / Contacts / Activities;
    - sentences plus before → after rows, with values shown through their labels (never raw enums);
    - a failure reads "tried to …" with the reason;
    - users without audit access see a designed no-access state;
    - the party ids are taken only from the record that is currently loaded.

### 5.3 Overview
- **The order:** the same sections, colours and order as the modal, except that **Classification comes first**, full width.
- **The canvas:** the design width (1366), centred.
- **The page grid:** `grid-cols-2` below 1024, `3` from 1024, `4` from 1280. No field is wider than about 330, except long lines (street, landmark), which span 2 columns.
- **Density:** Regular 24 fields in 4 columns (exception L1, pending owner approval).
- **More details** is always open on the page.

### 5.4 Shared section components
Each section is ONE component with `layout: 'modal' | 'page'`:
- `classification-section`, `value-section`;
- `basics-section` (type and individual identity), `company-section`, `reach-section` (phones and email);
- `contacts-section`, `custom-fields-section`, `more-section`.

The modal places them in two columns; the page places them in the page grid. Never fork a section for the page.

---

## 6. Cross-cutting rules
- **Hints.** Every field label is a `ui-field` with a non-empty `[hint]` in English and Arabic, and the "!" icon is not a tab stop.
  - The hint is linked by `aria-describedby` to the real control. For a group control, give the `ui-field` `[for]` so the ids match. Read-only values are rendered as read-only inputs, never as text in a div.
  - Labels stay on one line.
  - Switches and filter toggles follow the same rule.
  - A missing or unlinked hint is a blocker in review.
- **Language.** Every text in English and Modern Standard Arabic (فصحى), never colloquial. Keys match in both files. Plural forms are used where Arabic needs them.
- **Themes.** Light and dark are checked for every screen. Section bars must reach 4.5:1 with white text in both themes.
- **RTL.** Logical properties only (`ps-`, `start-`, `text-start`). Phone numbers, amounts, counters and the keypad are LTR-isolated (`dir="ltr"` / `<bdi>`). User text that may be English gets `dir="auto"`. Arrows and the back icon are mirrored.
- **Approved exceptions this pattern uses** (`AGENTS.md`, Approved exceptions):
  - "Every phone number";
  - "Actions menu of a record";
  - "Activities modal";
  - "Leads, Cards and Table views";
  - "Lead card (board and Cards view)";
  - "Leads board";
  - "Leads Cards and Table";
  - "Lead quick modal and full page" (E1–E4, E6, E7);
  - "Advanced search builder";
  - "Workspace Home" (bar colours);
  - "Lead quick modal and full page, section headers".
  - A new record module reuses these rows by reference. Any new deviation needs its own row and owner approval.

---

## 7. Checklist: build a new record module (example: Customers)

**Reuse as is:**
- `ui-step-filter`, `ui-view-switcher`, `ui-facet-search`, `ui-query-builder`, `ui-pagination`;
- `ui-modal`, `ui-unsaved-dialog`, `ui-confirm-dialog`, `ui-tag-picker`, `ui-address-fields`, `ui-phone-input`, `ui-file-drop`, `ui-actions-menu`;
- `app-phone-actions`, `app-party-calls`, `app-record-activities`;
- `shared/bulk-jobs/**`, `shared/query-builder/**`, `shared/ui/toast`.

1. **Model and API.** Create `customers.model.ts`, `customers.api.ts` (the only server file) and `customers.fake.ts` with the exact backend contract: list (paged, with filter and sort), detail, create, patch with `If-Match`, delete, contacts patch, stage move, capabilities.
2. **Routes.** Add `/crm/customers` (the list), `/crm/customers/new` and `/crm/customers/:id` (the page), with the module guard.
3. **Search config.** Add `customer-search.fields.ts` (field id, type, options source, chip label) and the compile-to-filter function. The facet search and the builder need no code.
4. **List views.**
   - The card content: which second line, which badges.
   - The table columns.
   - The stage source (customer statuses), with tones for negative and positive.
   - Board "+" per column, if the record has stages.
5. **Selection and batch.** Register a `BulkDescriptor` (the actions, the permission per action, the job kind) in `shared/bulk-jobs/bulk-job-modules.ts`. The backend must offer the job endpoint first.
6. **Form sections.**
   - Choose the record types (if any).
   - Map the side column fields.
   - Reuse the contacts, phones, custom fields (`entity = CUSTOMER`) and address sections.
   - Write only the record-specific sections, each with `layout: 'modal' | 'page'`.
7. **Modal.** Set the title and icon, the instant fields (rating, colour, stage or status), the footer variants, the ‹ › list source and the duplicate check endpoint.
8. **Page.** Set the header sub line, the primary action, the tabs (drop the ones the record does not have) and the targets: activities `CRM/CUSTOMER`, attachments `sourceType=CUSTOMER`, history entity `Customer` and party ids, calls `partyType=CUSTOMER`.
9. **i18n.** Add the scopes `customers`, `customer-form`, `customer-modal` and `customer-page` in `public/i18n/<scope>/en.json` + `ar.json`, with a hint for every field. Provide every scope the page needs on the page itself.
10. **Exceptions.** Reuse the rows in §6 by reference, and add rows only for real differences.
11. **Review gate.** Run the browser checks for en/ar × light/dark and 1440 / 1100:
    - hint audit (0 unlinked);
    - deep link and reload;
    - tab switch keeps the draft;
    - validation jump;
    - ‹ ›;
    - batch job report;
    - phone actions.

**Record-specific (never shared):**
- the fields, their validation and limits;
- the stage or status semantics;
- the card second line and badges;
- the table columns;
- the search fields;
- the batch actions;
- the tabs a record does not need.

---

## 8. Reference file map (CRM Leads)

| Piece | Path |
|---|---|
| List page, toolbar | `features/crm/leads/leads-page/leads-page.html`, `.ts` |
| Board / Cards / Table | `features/crm/leads/lead-board/`, `lead-cards/`, `lead-table/` |
| Record card | `features/crm/leads/lead-card/` |
| Selection and batch | `features/crm/leads/lead-bulk/` (`lead-selection.ts`, `bulk-menu/`, `selection-bar/`, `run-modal/`, `*-modal/`, `bulk-runner.ts`, `leads-bulk.descriptor.ts`); `shared/bulk-jobs/`; `layout/bulk-jobs-indicator/` |
| Search | `features/crm/leads/lead-search/`; `shared/ui/facet-search/`; `shared/query-builder/` + `shared/ui/query-builder/` |
| Stage filter, view switch | `shared/ui/step-filter/`, `shared/ui/view-switcher/` |
| Quick modal | `features/crm/leads/lead-modal/` (`lead-header/`) |
| Form and sections | `features/crm/leads/lead-form/lead-form.html`, `sections/*`, `duplicate-strip/` |
| Full page | `features/crm/leads/lead-page/` (`lead-page.ts/.html`, `lead-page-nav.ts`, `lead-page.guard.ts`) |
| Page tabs | `lead-page/lead-activities-tab/`, `lead-attachments-tab/`, `lead-history-tab/`; `shared/widgets/party-calls/` |
| Phones | `shared/ui/phone-input/`, `shared/widgets/phone-actions/` |
| Toasts above modals | `shared/ui/toast/toast-host.ts` |
| Data | `features/crm/leads/leads.api.ts`, `leads.fake.ts`, `leads.model.ts`, `leads.routes.ts` |
| i18n | `public/i18n/leads`, `lead-form`, `lead-form-side`, `lead-modal`, `lead-page`, `lead-dup`, `lead-activities-tab`, `lead-attachments-tab`, `lead-history-tab`, `lead-bulk*` |

Pieces still named "lead" that should become shared record components before the next module are tracked by the frontend coordinator. Until each is extracted, a new module reuses the Leads piece as its model, not as a copy-paste with renamed identifiers.
