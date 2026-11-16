# Accounting Stage-1 Screen Designs — `SCR-05` Journal Drafts & Bulk Operations · `SCR-06` Posted Journal Entries, Chain Proof, Reversal & Redactions (`P03.T09.S4`)

> **Lead review, 1 November 2026 (P03.T09).** No correction was needed; the `accounting.journals.*` names are dictionary keys, not permissions. Every route, permission, feature key and scope below was checked against `docs/LLD/accounting-app/02_API_Contracts/02_Endpoint_Catalogue.md` and `04_Static_Data/05_Permissions_and_Features.md`; what the contracts lack stays in the contract gap list for `P03.T11`.

- **Plan task:** `backend/docs/plans/accounting-app-plan-p03-ux-foundation.md` — `P03.T09.S4` (Stage-1 screen designs: `SCR-05` & `SCR-06`, lead review)
- **Target repository path:** `frontend/tenant-portal/docs/design/specs/accounting-stage1-journals.md`
- **Last verified against backend & frontend sources:** `2026-11-01`
- **Binding upstream UX authorities (reused verbatim, never redesigned):**
  - `frontend/tenant-portal/docs/design/README.md` (Five Laws + Accounting design process)
  - `frontend/tenant-portal/docs/plans/accounting-screen-inventory.md` (`SCR-05`, `SCR-06`, §6 `CG-01`..`CG-18`)
  - `frontend/tenant-portal/docs/design/specs/accounting-ia.md` (118-route allowlist `#12`–`#15`, `#52`–`#53`, 7-section nav, hidden-vs-disabled entitlement rules)
  - `frontend/tenant-portal/docs/design/specs/accounting-home.md` (`SCR-00` cross-links)
  - `frontend/tenant-portal/docs/design/specs/accounting-status-and-a11y.md` (`StatusVocabulary`, 4 outcome roles + `ink`, `aria-live`, keyboard contract)
  - `frontend/tenant-portal/docs/design/specs/accounting-patterns-data.md` (`UX-05` `AccountingLedgerGrid`, `UX-07` `MoneyCell`/`MoneyInput`/`FxRateStrip`, `UX-08` `AccountPicker`/`FiscalPeriodPicker`/`DimensionSetPicker`/`PartyPicker`)
  - `frontend/tenant-portal/docs/design/specs/accounting-patterns-workflow.md` (`UX-06` `JournalEditorScreen`, `UX-10` `ApprovalPanel`, `UX-09`/`UX-13` `AsyncProgressCard` & `BulkActionBar`)
  - `frontend/tenant-portal/docs/design/specs/accounting-patterns-documents.md` (`WS-01`..`WS-07` waiting states, `AccountingErrorAlert` `Cause + Effect + SafeAction`, boundary gates)
- **Binding backend LLD contracts:**
  - `backend/docs/LLD/accounting-app/02_API_Contracts/02_Endpoint_Catalogue.md` (§1–§4, §6, §10–§13 — sole route, permission, feature-key, scope, idempotency, and concurrency authority)
  - `backend/docs/LLD/accounting-app/04_Static_Data/02_DTOs.md` (§1–§5, §13–§15)
  - `backend/docs/LLD/accounting-app/04_Static_Data/01_Enums.md` (§1–§5, §16–§18)
  - `backend/docs/LLD/accounting-app/04_Static_Data/04_Errors_and_Constants.md` (§1–§6)
  - `backend/docs/LLD/accounting-app/01_ERD/02_Ledger_Tables.md` (§3, §4, §5, §6, §8, §10)
  - `backend/docs/LLD/accounting-app/07_Modules/10_MVP/02_ledger_posting.md` (`UC-LPO-1`, `UC-LPO-2`, `UC-LPO-3`, `UC-LPO-5`)
  - `backend/docs/LLD/accounting-app/05_Flows/02_User_Journey_Sales_Invoice_To_Posting.md` (`ACT-12c`, `ACT-13`, `POST-06`..`POST-12`, `ETA-03`, `IN-12`, `CASH-04`, `PAY-08`, `CLOSE-04`, `CLOSE-09`, `FAIL-03`, `FAIL-09`)

---

## 0. Foundation, Design-System Governance & Route Architecture

### 0.1 Reconciled Scope & Allowlist Alignment (`SCR-05` & `SCR-06`)

Per `accounting-screen-inventory.md` rows **`SCR-05`** (`[P: 17]`) and **`SCR-06`** (`[P: 16]`) and `accounting-ia.md` §5 (`118` frozen Next.js App Router paths), this specification governs six allowlisted routes under section **`Post` (`القيود والعمليات`)**:

| Screen ID | Route `#` (`accounting-ia.md` §5) | App Router Path | Nav Key | Primary Endpoints Owned (`[P]`) | Slice vs Full Stage-1 Boundary (`accounting-screen-inventory.md`) |
| --- | --- | --- | --- | --- | --- |
| **`SCR-05`** | `#12` | `/accounting/post/journal-drafts` | `accountingJournalDrafts` | `journal-drafts` list/search/count/create/bulk-post (`6` of `14`) | **`[Slice — P15]`:** `#12` list + `?mode=new` create + `#13` edit/delete/cancel/post (`DRAFT -> POSTED`).<br>**`[Stage-1 full — P17]`:** Maker-checker `submit`/`approve`/`reject`/`withdraw`, `BLOCKED` exception banner + `reopen`, `POST /bulk-post`, `attachments`, and `#52`/`#53` `bulk-operations`. |
| **`SCR-05`** | `#13` | `/accounting/post/journal-drafts/[id]` | *(detail of `#12`)* | `journal-drafts` detail/patch/delete/submit/approve/reject/post/cancel/reopen (`8` of `14`) | Same split as `#12` above. |
| **`SCR-05`** | `#52` | `/accounting/post/bulk-operations` | `accountingBulkOperations` | `bulk-operations` list & launch (`GET`, `POST` — `2` of `3`) | **`[Stage-1 full — P17]`:** Cross-target batch operations (`COMPANY`, `FISCAL_PERIOD`, `RULE_SET`). |
| **`SCR-05`** | `#53` | `/accounting/post/bulk-operations/[id]` | *(detail of `#52`)* | `bulk-operations` run detail (`GET /:id` — `1` of `3`) | **`[Stage-1 full — P17]`:** Per-target results & failed-target retry launch. |
| **`SCR-06`** | `#14` | `/accounting/post/journal-entries` | `accountingJournalEntries` | `journal-entries` (`L S C X` + `POST /verify-chain`, `5`), `journal-lines` (`L S X`, `3`), `interco-groups` (`L G`, `2`) — `10` of `16` | **`[Slice — P15]`:** `Entries` & `Ledger Lines` tabs, keyset paging, async `export`.<br>**`[Stage-1 full — P17]`:** `POST /verify-chain` range modal, `Intercompany Groups` tab & detail drawer (`interco-groups`). |
| **`SCR-06`** | `#15` | `/accounting/post/journal-entries/[id]` | *(detail of `#14`)* | `journal-entries` (`GET /:id`, `GET /:id/lines`, `GET /:id/chain-proof`, `POST /:id/reverse`, `4`), `ledger/redactions` (`POST`, `POST /:approvalRequestId/approve`, `2`) — `6` of `16` | **`[Slice — P15]`:** Immutable detail, posted lines (`SWAP_SIDES` & `STORNO`), live `chain-proof`, `reverse`.<br>**`[Stage-1 full — P17]`:** PII redaction request/approve, `source-document-links` provenance chip, `attachments`. |

> **Allowlist Creation Rule (`#12?mode=new`, zero `/new` segment):** `accounting-ia.md` §5 prohibits any static `/accounting/post/journal-drafts/new` segment (`118` routes fixed). Clicking **+ New Journal Draft / + مسودة قيد جديدة** on `#12` opens `#12` in creation workspace mode (`/accounting/post/journal-drafts?mode=new`), mounting the shared `JournalEditorScreen` (`UX-06`) over an empty `CreateJournalDraftDto` state. On `201 Created`, the router replaces the URL with `/accounting/post/journal-drafts/${data.id}` (`#13`). Direct navigation to `/accounting/post/journal-drafts/new` fails UUID param validation on `[id]` and renders `NotFoundState` (`404`) with a direct link to `/accounting/post/journal-drafts?mode=new`.

### 0.2 `ui-ux-pro-max` & Tenant Portal Five-Laws Design Profile

Consulted against `.agents/skills/ui-ux-pro-max/SKILL.md` and `.agents/skills/frontend-design/SKILL.md` for dense enterprise accounting ledgers:

1. **Five Laws Compliance (`docs/design/README.md`):**
   - **Four semantic outcome roles + `ink`:** `positive` (posted, balanced, chain `INTACT`, `COMPLETED`), `caution` (pending approval, `PARTIAL`, stale/reopened, prior-period redirection, `UNBALANCED` intercompany), `negative` (rejected, `BLOCKED`, `FAILED`, chain `BROKEN`, `isStorno` negative adjustments, unbalanced draft delta), and `neutral`/`pending` on `ink` (`DRAFT`, `CANCELLED`, `QUEUED`, `RUNNING`, `Reversed` retired original, `[REDACTED]`). `brand` is reserved strictly for active navigation, focus rings, and the single primary button — **never** on a status badge.
   - **Three font weights only:** `400` (`font-normal`, mandatory on all table/grid body cells), `500` (`font-medium`, labels/headers/controls), `600` (`font-semibold`, page title, KPI/balance strip totals). Zero `font-bold`, zero `text-[Npx]`, zero `rounded-xl` or larger.
   - **At most one filled `primary` button per screen:** Located in `PageHeader` (list views) or `DetailHeader` (detail/editor views). Secondary workflow commands (`Save Draft`, `Cancel Draft`, `Reopen`, `Reject`, `Verify Hash Chain`, `Export`, `Request PII Redaction`) use `secondary`, `outline`, or `destructive` inside overflow/confirm modals.
   - **Logical CSS & Bilingual Parity:** Exclusively `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `text-end`. Zero language ternaries (`lang === 'ar' ? ... : ...`); every label, status enum, empty state, and error recovery cue resolves from `src/lib/i18n/locales/{ar,en}.ts`.
   - **LTR Islands & Exact Decimal Integrity:** Every `entryNo`, `groupRef`, account `code`, UUID, `chainSeq`, `entryHash`, `prevEntryHash`, ISO date, `fxRateSnapshot`, and `DecimalString` renders inside `<IdentifierText>` / `<MoneyCell>` (`<bdi dir="ltr" className="tabular-nums">`) with Western digits (`ar-EG-u-nu-latn` in Arabic, `en-US` in English). **Never call `Number()` or `parseFloat()` on a `DecimalString`**; client-side draft balance preview uses `BigInt` scaled by `10^8` (`DECIMAL_SCALE = 8`), and UUIDs (including `x-idempotency-key` and client row keys) use `generateUUIDv7()` from `@/lib/uuid` (never `crypto.randomUUID()`).

### 0.3 Theme Token Reference Used in Four-Combination Mockups

All ASCII mockups in §1.7 and §2.7 bind to the semantic CSS custom properties of `frontend/tenant-portal/src/app/globals.css` (`docs/design/tokens.md`):

| Semantic Token | Light Mode Surface / Ink | Dark Mode Surface / Ink | Usage on `SCR-05` & `SCR-06` |
| --- | --- | --- | --- |
| `--bg-canvas` / `--bg-surface` | `#F8FAFC` / `#FFFFFF` | `#0B0F17` / `#111827` | Page background, cards, `AccountingLedgerGrid`, `JournalLineGrid`, modals/drawers |
| `--bg-subtle` / `--bg-elevated` | `#F1F5F9` / `#FFFFFF` | `#1E293B` / `#1F2937` | Sticky grid headers, `JournalBalanceBar`, `FxRateStrip`, Provenance & Hash-Chain strip |
| `--ink-primary` / `--ink-secondary` | `#0F172A` / `#475569` | `#F8FAFC` / `#94A3B8` | Primary data (`400`), column headers (`500`), metadata captions |
| `--border-subtle` / `--border-strong` | `#E2E8F0` / `#CBD5E1` | `#1E293B` / `#334155` | Hairline `1px` grid borders, pinned balance bar top border |
| `--status-positive-{bg,fg}` | Soft emerald tint / dark emerald (`>= 4.5:1`) | Muted deep emerald / light emerald (`>= 4.5:1`) | `APPROVED`, `POSTED`, `COMPLETED`, `BALANCED` (`0.00`), `ChainProof: INTACT` |
| `--status-caution-{bg,fg}` | Soft amber tint / dark amber (`>= 4.5:1`) | Muted deep amber / light amber (`>= 4.5:1`) | `PENDING_APPROVAL`, `PARTIAL`, `OPEN`/`UNBALANCED` intercompany, `Redirected from closed period` |
| `--status-negative-{bg,fg}` | Soft rose tint / dark rose (`>= 4.5:1`) | Muted deep rose / light rose (`>= 4.5:1`) | `BLOCKED`, `REJECTED`, `FAILED`, `Unbalanced Δ ≠ 0`, `isStorno = true`, `ChainProof: BROKEN` |
| `--brand-solid` / `--brand-fg` | Brand primary / `#FFFFFF` | Brand primary (dark-tuned) / `#FFFFFF` | Single `variant="primary"` CTA in `PageHeader` / `DetailHeader`, active tab indicator, focus ring |

### 0.4 Feature-Folder File Architecture (`< 300` Lines & Hook/View Split)

All feature code imports UI primitives/patterns exclusively from `@/design-system`, keeps `.tsx` view files pure markup + Tailwind logical classes (`< 300` lines each), and isolates state, runtime response validators, `If-Match` `ETag` tracking, and `generateUUIDv7()` idempotency keys inside `hooks/`:

```text
src/features/accounting-journals/
├── api/
│   ├── journalDraftsApi.ts          # /api/tenant/accounting/v1/journal-drafts*
│   ├── bulkOperationsApi.ts         # /api/tenant/accounting/v1/bulk-operations*
│   ├── journalEntriesApi.ts         # /api/tenant/accounting/v1/journal-entries*, journal-lines*, interco-groups*, ledger/redactions*
│   └── validators.ts                # Runtime schema validators for SuccessResponseDto<T>, keyset pageInfo, ChainProofDto, PostingReceiptDto
├── hooks/
│   ├── useJournalDraftsList.ts      # #12 list, status counts (POST /count), search, Tier-1 bulk-post state & idempotency key
│   ├── useJournalEditor.ts          # #12?mode=new & #13 header/line state, BigInt(10^8) balance, FX resolve, ETag/If-Match, lifecycle commands
│   ├── useBulkOperationsList.ts     # #52 list, filters & launch drawer (202 + Retry-After)
│   ├── useBulkOperationDetail.ts    # #53 polling (WS-06), per-target results filter & failed-target retry prefill
│   ├── useJournalEntriesExplorer.ts # #14 3-tab state (Entries, Lines, Interco Groups), keyset cursor stack, verify-chain & async export
│   └── useJournalEntryDetail.ts     # #15 detail, lines, on-demand/auto chain-proof, ReverseJournalModal & PII redaction workflows
└── components/
    ├── JournalDraftsListView.tsx
    ├── JournalEditorWorkspace.tsx
    ├── PostJournalModal.tsx
    ├── BulkOperationsListView.tsx
    ├── BulkOperationLaunchDrawer.tsx
    ├── BulkOperationDetailView.tsx
    ├── JournalEntriesExplorerView.tsx
    ├── VerifyChainModal.tsx
    ├── IntercoGroupDetailDrawer.tsx
    ├── JournalEntryDetailView.tsx
    ├── ReverseJournalModal.tsx
    └── LedgerRedactionDrawer.tsx
```

---

## 1. `SCR-05` — Journal Drafts, Journal Editor & Bulk Posting Operations

### 1.1 Inventory & Use-Case Traceability

- **Screen ID & Title:** `SCR-05` — Journal Drafts, Journal Editor & Bulk Posting Operations (`مسودات القيود ومحرر اليومية والترحيل الجماعي`)
- **Routes:**
  - `#12` `/accounting/post/journal-drafts` (`?mode=new` opens creation workspace)
  - `#13` `/accounting/post/journal-drafts/[id]`
  - `#52` `/accounting/post/bulk-operations`
  - `#53` `/accounting/post/bulk-operations/[id]`
- **Use Cases & Journey Steps:** `UC-LPO-1` (`02_ledger_posting.md` §3.1); Journey steps `ACT-13`, `POST-06`, `POST-07`, `CLOSE-04`, `FAIL-03`; Scenarios `SCN-019` (balanced manual draft -> post), `SCN-020` (FX rate resolution & functional conversion), `SCN-021` (maker-checker approval & `ACTOR_IS_SUBMITTER`), `SCN-022` (prior-period adjustment with `originalPeriodId`), `SCN-082` (`409 STALE_VERSION` & `TOTALS_MISMATCH` concurrent edit recovery).
- **Legal Numbering Rule (`D-014`):** `acc_journal_drafts` intentionally has **no `draftNo` column**. Gap-free legal sequence numbers (`entryNo`) are assigned exclusively at posting inside `acc_journal_entries`. On `#12` and `#13`, drafts are identified by `memo` / `reference` (`reference?`, max `64`, editable on create and update, `D-771`) + short `<IdentifierText>` UUID prefix (`id.slice(0, 8)`) with full UUID copy, and link to `postedEntryId` once `status === 'POSTED'`.

### 1.2 Layout & Progressive Disclosure Architecture

#### A. Route `#12` — `/accounting/post/journal-drafts` (Drafts Queue & Tier-1 Bulk Post)
1. **`AccountingScopeBar` (inherited from `/accounting` layout):** Active `Company` (`X-Company-Id`, mandatory for posting) + optional `Branch` (`X-Branch-Id` for `COMPANY_OR_BRANCH` reads/drafts), plus global `RECOVERY_MODE` banner if active.
2. **`PageHeader`:**
   - Title: `Journal Drafts` / `مسودات القيود`
   - Subtitle: `Prepare, review, and post manual and adjustment journals.` / `إعداد ومراجعة وترحيل القيود اليدوية وقيود التسوية.`
   - Secondary header link (`outline`): `Bulk Operations` / `العمليات الجماعية` (`Link` to `/accounting/post/bulk-operations`, rendered only when `hasPerm('accounting.bulk_operation.read')`).
   - **Single `primary` CTA:** `+ New Journal Draft` / `+ مسودة قيد جديدة` (`Link` to `/accounting/post/journal-drafts?mode=new`; hidden if `!hasPerm('accounting.journal_draft.create')`, disabled with read-only tooltip in `RECOVERY_MODE`).
3. **Status Segmented Tabs (`Tabs` + `POST /accounting/journal-drafts/count`):**
   - Tabs: `All` · `Draft` (`DRAFT`) · `Pending Approval` (`PENDING_APPROVAL`) · `Approved` (`APPROVED`) · `Blocked` (`BLOCKED`) · `Rejected` (`REJECTED`) · `Cancelled` (`CANCELLED`) · `Posted` (`POSTED`).
   - Counts fetched via `POST /accounting/journal-drafts/count` (`CountResultDto.count`) for `DRAFT`, `PENDING_APPROVAL`, and `BLOCKED` attention badges.
4. **Compact `FilterBar` + `AdvancedSearchDrawer`:**
   - Inline filters (`GET /accounting/journal-drafts` via `JournalDraftListQueryDto`): `Journal` (`journalId`), `Entry Kind` (`entryKind`), `Posting Date From/To` (`fromDate`, `toDate`), `Approval State` (`approvalState`), `Created By` (`createdBy`), `Search` (`search`).
   - `Advanced Filters` button opens `FilterDrawer` bound to `POST /accounting/journal-drafts/search` (`JournalDraftSearchDto`: structured `FilterGroup` up to `MAX_FILTER_LEAVES = 20`, depth `3`, including `sourceRef` components `sourceApp`, `sourceType`, `sourceId`).
5. **`AccountingLedgerGrid` (`UX-05`):**
   - Multi-select checkboxes enabled only when `hasPerm('accounting.journal_draft.post')` and active `X-Company-Id` is selected; rows not in `DRAFT` or `APPROVED` have disabled checkboxes (`aria-disabled="true"`) with tooltip explaining only `DRAFT` (when no approval rule requires submission) or `APPROVED` drafts can bulk-post.
   - Columns (all body cells `font-normal` `400`):
     1. Selection checkbox (`40px`)
     2. `Draft ID / Reference` (`id` short `<IdentifierText>` + `reference` if non-null)
     3. `Journal` (`journalId` -> cached journal `code` + localized `nameI18n`)
     4. `Kind` (`entryKind` `Badge` via `t.accounting.enums.entryKind.*`)
     5. `Posting Date` (`postingDate`, `<IdentifierText>` ISO `YYYY-MM-DD`)
     6. `Document Date` (`documentDate`, `<IdentifierText>`)
     7. `Currency` (`currencyCode`, `<IdentifierText>`)
     8. `Total Debit` (`totalDebit`, `<MoneyCell>` right/end-aligned `tabular-nums`)
     9. `Total Credit` (`totalCredit`, `<MoneyCell>` right/end-aligned `tabular-nums`)
     10. `Status` (`status`, semantic `StatusBadge` — `DRAFT` neutral, `PENDING_APPROVAL` caution, `APPROVED` positive, `BLOCKED` negative, `REJECTED` negative, `CANCELLED` neutral, `POSTED` positive)
     11. `Updated` (`updatedAt` relative/timestamp) + row chevron `Link` to `/accounting/post/journal-drafts/[id]`.
   - Note on `memo` & `rejectionReason`: Omitted from list columns because `JournalDraftSummaryDto` omits `varchar > 255` (`02_DTOs.md` §13.1 rule 4); inspected on `#13`.
6. **Tier-1 `BulkActionBar` (`UX-13`, sticky bottom bar when `1..100` rows selected, `MAX_BULK_POST_DRAFTS`):**
   - Displays selected count + summed transaction totals per currency + action **`Post Selected Drafts` (`ترحيل المسودات المحددة`)**.
   - Opens confirmation dialog explaining **all-or-nothing transactional semantics** (`POST /accounting/journal-drafts/bulk-post` returns `200` when every selected draft posts, or rolls back the entire batch on the first validation/approval/period refusal — never `207`, `02_DTOs.md` §13; body `BulkPostJournalDraftsDto { items: PostJournalDraftDto[] }`, answered with `data.postings[]` in item order, `D-771`).

#### B. Route `#12?mode=new` & Route `#13` — `/accounting/post/journal-drafts/[id]` (`JournalEditorScreen` `UX-06`)
Composes `JournalEditorScreen` (`accounting-patterns-workflow.md` §1) with strict status-driven editability:
- **Editable states:** `NEW` (`#12?mode=new`), `DRAFT`, and `REJECTED` (only when `hasPerm('accounting.journal_draft.update')` / `.create`). In `PENDING_APPROVAL`, `APPROVED`, `BLOCKED`, `POSTED`, and `CANCELLED`, all header inputs and `JournalLineGrid` cells switch to read-only inspection mode (`aria-readonly="true"`).
- **Zone 1 — `DetailHeader` & Single Primary Action Rule:**
  - Breadcrumb: `Post` -> `Journal Drafts` -> `Draft #0195f2a4` (or `New Journal Draft`).
  - Badges: `StatusBadge(status)`, `EntryKind` badge, `Version v{version}` chip (`ETag`), and when `postedEntryId !== null`, a prominent `<Link href="/accounting/post/journal-entries/${postedEntryId}">` pill (`Posted Entry ->`).
  - **Single `variant="primary"` button per state** (respecting permissions & `X-Company-Id` scope):
    - `NEW`: **`Create Draft` (`إنشاء المسودة`)** -> `POST /accounting/journal-drafts` (`201`).
    - `DRAFT` / `REJECTED`:
      - Primary: **`Post Journal` (`ترحيل القيد`)** -> opens `PostJournalModal` (`POST /:id/post`) when `hasPerm('accounting.journal_draft.post')` and `isBalanced && lines.length >= 2` (if an approval rule triggers at post time, backend answers `409 ACCOUNTING.APPROVAL.REQUIRED` and cues `Submit for Approval`); if user holds `accounting.journal_draft.submit` without `.post`, Primary becomes **`Submit for Approval` (`إرسال للاعتماد`)**.
      - Secondary (`outline` / `secondary`): `Save Changes` (`PATCH /:id`), `Submit for Approval` (`POST /:id/submit`), overflow menu (`Cancel Draft` `POST /:id/cancel`, `Delete Draft` `DELETE /:id`).
    - `PENDING_APPROVAL`:
      - When `accounting.close.approvals` is entitled, `hasPerm('accounting.approval.approve')`, and `!approvalRequest.makerUserIds.includes(currentUser.id)`: Primary is **`Approve` (`اعتماد`)** inside `ApprovalPanel` (`POST /:id/approve`), paired with `outline` **`Reject` (`رفض`)** (`POST /:id/reject`).
      - When `currentUser.id === draft.submittedBy` and `hasPerm('accounting.approval.withdraw')`: `outline` **`Withdraw Submission` (`سحب الطلب`)** (`POST /accounting/approval-requests/:approvalRequestId/withdraw`, `D-354`).
    - `APPROVED`:
      - Primary: **`Post Approved Journal` (`ترحيل القيد المعتمد`)** -> opens `PostJournalModal` (`POST /:id/post`).
      - Secondary (`outline`): `Reopen to Draft` (`POST /:id/reopen` with mandatory reason `10..1,000` chars; warns user that reopening clears `approvalRequestId`, `D-316`) + `Cancel Draft`.
    - `BLOCKED`:
      - Renders top `Alert` (`negative` tone) citing `postingExceptionId` with deep-link `View Posting Exception -> /accounting/inbox/posting-exceptions/${postingExceptionId}`.
      - Primary: **`Reopen to Fix` (`إعادة فتح للتصحيح`)** (`POST /:id/reopen`, `accounting.journal_draft.update`, keeps `postingExceptionId` trace while returning status to `DRAFT`, `D-316`).
    - `CANCELLED`: Secondary `outline` `Delete Draft` (`DELETE /:id`, soft-delete allowed on `DRAFT | REJECTED | CANCELLED`, `ck_acc_journal_drafts_delete_state`).
    - `POSTED`: Read-only; Primary `Link` button **`Open Posted Entry` (`فتح القيد المرحّل`)** -> `/accounting/post/journal-entries/${postedEntryId}`.
- **Zone 2 — Contextual Alert Banners (Conditional):**
  - `REJECTED` banner (`negative`): Displays `rejectionReason` (`varchar(500)`) so the maker sees why the checker refused the draft before editing and resubmitting.
  - `409 STALE_VERSION` / `TOTALS_MISMATCH` banner (`caution`, `SCN-082`): Side-by-side diff of local edits vs latest server `version` + `Reload Latest Version` action (never silently overwrites).
  - `AmbiguousOutcomePanel` (`caution`): Shown on `502`/`504`/network drop during `POST /:id/post` or `POST /bulk-post`; retains the exact UUIDv7 `x-idempotency-key` in hook memory so clicking `Retry Same Request` replays safely without double-posting.
- **Zone 3 — Compact Header Form Card (`2` rows × `4` columns on desktop):**
  - `Journal` (`journalId`, `Select` filtered to manual-eligible active journals; `MANUAL`, `ADJUSTMENT`, `ACCRUAL`, `OPENING`, `INTERCOMPANY`), `Entry Kind` (`entryKind`: `STANDARD | ADJUSTMENT | ACCRUAL | INTERCOMPANY`; `REVERSAL` & `CANCELLATION` excluded per DTO rule; `ALLOCATION` & `COMMITMENT` hidden while unentitled per `accounting-ia.md` §3), `Document Date` (`documentDate`), `Posting Date` (`postingDate`).
  - `Fiscal Period` (`FiscalPeriodPicker` `UX-08`: resolves open `NORMAL` period from `postingDate`; exposes explicit `periodId` selector **only** when selecting an `ADJUSTMENT` period whose `startDate === endDate === postingDate`, `D-355`), `Prior-Period Target` (`originalPeriodId`: progressive disclosure field shown **only** when `entryKind === 'ADJUSTMENT'` for correcting a `CLOSED` fiscal year whose income-tax filing is recorded, `D-234`), `Tax Point Date` (`taxPointDate`, optional), `Currency & FX Strip` (`currencyCode` + `FxRateStrip` `UX-07` calling `POST /accounting/fx-rates/resolve` when `currencyCode !== companyProfile.functionalCurrencyCode`, pinning `fxRateId` & previewing `fxRateSnapshot`).
  - Full-width `Memo` (`memo`, `Textarea` `maxLength={1000}`, character counter `0 / 1,000`). Read-only badges for `sourceApp:sourceType:sourceId`, `fiscalDocumentId`, `recurringTemplateId`, and `reference` when populated.
- **Zone 4 — `JournalLineGrid` (`UX-06`, Virtualized `2..2,000` Lines):**
  - Keyboard-first spreadsheet ergonomics (`Tab`/`Shift+Tab` cell traversal, `Enter` commits/advances, `Insert` or `Tab` on last cell appends row up to `MAX_LINES_PER_ENTRY = 2,000`, `Alt+Delete` removes row while `lines.length > 2`).
  - Columns: `#` (`lineNo`) · `Account` (`AccountPicker` `UX-08` via `POST /accounting/accounts/lookup`, enforcing `isPostable === true && allowManualJournal === true` and blocking deprecated/control accounts inline) · `Party` (`PartyPicker` `UX-08` via `POST /accounting/party-finance-profiles/lookup`; highlighted required when account `requiresParty`) · `Branch` (`branchId`) · `Dimensions` (`DimensionSetPicker` popover `UX-08` via `POST /accounting/dimension-values/lookup`; auto-opens or flags required badge when account `requiresDimensionTypeCodes` is non-empty) · `Debit (Txn)` (`MoneyInput` mapped to `direction: 'DEBIT', amountTxn`) · `Credit (Txn)` (`MoneyInput` mapped to `direction: 'CREDIT', amountTxn` — typing into Debit clears Credit on the same row and vice versa, because each DTO line carries one `direction` + positive `amountTxn`) · `Functional Equiv.` (read-only computed preview or optional `amountFunctional` override when foreign currency) · `More` drawer/popover (`cashFlowCategoryId`, `quantity`, `uom`, line `description` `<= 500` chars) · `Remove` icon.
- **Zone 5 — Sticky `JournalBalanceBar` (`UX-06`):**
  - Pinned to bottom of editor viewport (`bg-subtle border-t border-strong`): displays `Line Count` (`N / 2,000`), `Total Debit` (`totalDebit`), `Total Credit` (`totalCredit`), `Difference Δ` (`|Dr - Cr|` via `BigInt` `10^8` integer arithmetic), functional-currency equivalent totals when `currencyCode !== functionalCurrency`, and balanced status pill (`Balanced 0.00` in `positive` vs `Out of Balance Δ ...` in `negative`). Disables `Post Journal` and `Submit for Approval` while `Δ !== 0n` or `lines.length < 2`.
- **Zone 6 — Collapsible `ApprovalPanel` (`UX-10`) & `AttachmentList`:**
  - `ApprovalPanel` (`accounting-patterns-workflow.md` §2): Mounted when `approvalRequestId !== null` (and `accounting.close.approvals` + `accounting.approval.read` held; if unentitled/denied, shows compact read-only `Approval Status` chip from `JournalDraftDetailDto.status`). Enforces `maker ≠ checker` (`approvalRequest.makerUserIds.includes(currentUser.id)` disables Approve/Reject and explains `403 ACCOUNTING.APPROVAL.ACTOR_IS_SUBMITTER`) and binds `expectedPayloadHash: draft.payloadHash` so tampering fails closed (`409 ACCOUNTING.APPROVAL.PAYLOAD_CHANGED`).
  - `AttachmentList`: Calls `GET /accounting/attachments` (filtered to owner draft), `POST /accounting/attachments` (multipart upload, disabled in `RECOVERY_MODE`, `D-301`), `GET /accounting/attachments/:id/download` (short-lived signed URL), and `DELETE /accounting/attachments/:id` (`If-Match`, disabled once `protectedAfterPosting || legalHold`).

#### C. Routes `#52` & `#53` — `/accounting/post/bulk-operations` & `/accounting/post/bulk-operations/[id]`
- **`#52` List & Launch Drawer:**
  - `TENANT`-scoped operational monitor (`GET /accounting/bulk-operations` via `BulkOperationListQueryDto`: `scopeKind`, `operation`, `status`, `requestedBy`).
  - `PageHeader` single `primary` CTA: **`+ Launch Bulk Operation` (`+ تشغيل عملية جماعية`)** (visible when `hasPerm('accounting.bulk_operation.create')`; opens `BulkOperationLaunchDrawer`).
  - `BulkOperationLaunchDrawer` authors `BulkOperationDto` (`POST /accounting/bulk-operations` -> `202 Accepted` + `Location` + `Retry-After`):
    1. `Scope Kind` (`scopeKind`: MVP-active `COMPANY | FISCAL_PERIOD | RULE_SET`; Wave-1 `ALLOCATION_RULE` hidden while unentitled per `accounting-ia.md` §3).
    2. `Operation` (`operation`: MVP-active members filtered by `scopeKind` — `CLOSE_PERIOD`, `REOPEN_PERIOD`, `SOFT_CLOSE_PERIOD`, `ADOPT_RULE_SET_VERSION`, `REBUILD_LEDGER_FACTS`, `POST_DEPRECIATION`, `POST_DEFERRALS`, `START_CLOSE`, `RUN_CLOSE_TASK`, `RUN_REPORT`; reserved Wave 1–3 members never shown in dropdown).
    3. `Targets` (`targets: UUID[]`, multi-select picker `1..500` `MAX_BULK_ITEMS`).
    4. `Per-Target Approvals` (`approvals?: BulkTargetApprovalInput[]` — progressive disclosure step rendered **only** when `operation === 'REOPEN_PERIOD'`, pairing each `targetId` with its approved `PERIOD_REOPEN` `approvalRequestId`, `D-358`).
    5. `Continue on Error` (`continueOnError`, `Switch`, default `true`).
  - Submitting navigates to `#53` `/accounting/post/bulk-operations/${data.id}` (or registers in `AccountingJobTrayDrawer`).
- **`#53` Run Detail (`/accounting/post/bulk-operations/[id]`):**
  - Renders `AsyncProgressCard` (`UX-09`) + `WS-06` `WaitingStateCallout` while `status` is `QUEUED` or `RUNNING` (honoring `Retry-After` / `POLL_INTERVAL_SECONDS = 3`, pausing when tab hidden).
  - KPI Strip (`4` counters): `Total Targets` (`totalCount`), `Succeeded` (`succeededCount`, `positive`), `Failed` (`failedCount`, `negative`), `Skipped` (`skippedCount`, `neutral`).
  - `BulkTargetResultsTable` over `BulkOperationDetailDto.results[]`: `Target` (`targetId` + resolved display label), `Outcome` (`SUCCEEDED | FAILED | SKIPPED`), `Error Explanation` (localized `errorCode` + `message` when `FAILED`), `Result Link` (`resultRef` deep-link when present).
  - Header action when `status === 'PARTIAL' || status === 'FAILED'` and `failedCount > 0`: **`Retry Failed Targets` (`إعادة محاولة الأهداف الفاشلة`)** (`variant="primary"`, `hasPerm('accounting.bulk_operation.create')`) — opens `BulkOperationLaunchDrawer` prefilled with the failed `targetId`s, `scopeKind`, `operation`, and `parameters` (`BulkOperationDto.retryOfId` names the parent operation and follows the `acc_bulk_operations.retry_of_id` rules, `D-771`).

---

### 1.3 Field-to-DTO Mapping Tables (`SCR-05`)

#### Table 1.3.1 — Journal Draft Header & Read Metadata (`CreateJournalDraftDto` / `UpdateJournalDraftDto` / `JournalDraftDetailDto`)

| UI Field (EN / AR) | Control | Request DTO Member (`Create` / `Update`) | Read Projection Member (`Summary` / `Detail` via §13.1) | Validation & Domain Rules |
| --- | --- | --- | --- | --- |
| Draft Identifier / معرّف المسودة | `<IdentifierText>` + Copy | *(server-assigned UUIDv7)* | `id: UUID` | No `draftNo` exists (`D-014`); legal `entryNo` assigned only at post. |
| Journal / اليومية | `Select` (`GET /journals`) | `journalId: UUID` | `journalId: UUID` | Required. Active journal of `X-Company-Id`. |
| Ledger / الدفتر المحاسبي | Read-only chip (MVP) | `ledgerId?: UUID` | `ledgerId: UUID` | Defaults to company `PRIMARY` ledger; multi-ledger creation is Wave 2 (`D-006`). |
| Entry Kind / نوع القيد | `Select` | `entryKind: EntryKind` | `entryKind: EntryKind` | Required. Allowed on manual create: `STANDARD`, `ADJUSTMENT`, `ACCRUAL`, `OPENING`, `INTERCOMPANY`. `REVERSAL` & `CANCELLATION` forbidden (`400`); `ALLOCATION` & `COMMITMENT` reserved (`403 NOT_ENTITLED`). |
| Document Date / تاريخ المستند | `DatePicker` (ISO) | `documentDate: ISODate` | `documentDate: ISODate` | Required `YYYY-MM-DD`. |
| Posting Date / تاريخ الترحيل | `DatePicker` (ISO) | `postingDate: ISODate` | `postingDate: ISODate` | Required `YYYY-MM-DD`; checked against period `OPEN`/`SOFT_CLOSED` state and `maxBackdateDays`. |
| Adjustment Period / فترة التسوية | `FiscalPeriodPicker` | `periodId?: UUID` | `periodId: UUID`, `fiscalYearId: UUID` | Sent **only** to target an `ADJUSTMENT` period whose `startDate === endDate === postingDate` (`D-355`). |
| Prior Closed Period / الفترة الأصلية المغلقة | `FiscalPeriodPicker` | `originalPeriodId?: UUID` | `originalPeriodId: UUID \| null` | Shown & accepted **only** when `entryKind === 'ADJUSTMENT'` for correcting a `CLOSED` year (`D-234`). |
| Tax Point Date / تاريخ الاستحقاق الضريبي | `DatePicker` (ISO) | `taxPointDate?: ISODate` | `taxPointDate: ISODate \| null` | Optional; defaults to `documentDate` when tax applies. |
| Currency / العملة | `Select` (ISO-4217) | `currencyCode: CurrencyCode` | `currencyCode: CurrencyCode` | Required `^[A-Z]{3}$`; defaults to `companyProfile.functionalCurrencyCode`. |
| Pinned FX Rate / سعر الصرف المثبّت | `FxRateStrip` (`POST /fx-rates/resolve`) | `fxRateId?: UUID` | `fxRateId: UUID \| null`, `fxRateSnapshot: DecimalString \| null` | Required when `currencyCode !== functionalCurrencyCode` (`422 FX.RATE_NOT_FOUND` if missing). |
| Memo / البيان | `Textarea` | `memo?: string` | `Detail`: `memo: string \| null` *(omitted in `SummaryDto` per §13.1 `>255` rule)* | `maxLength: 1000` in `CreateJournalDraftDto`. |
| Reference / المرجع | `TextInput` (`dir="ltr"`) | `reference?: string` (max `64`; `CreateJournalDraftDto`, inherited by `UpdateJournalDraftDto`, `D-771`) | `reference: string \| null` (`varchar(64)`) | Optional external reference, editable while the draft is editable; hashed into `payload_hash`. |
| Source Reference / مرجع المصدر | Read-only chip | `sourceRef?: TripleReference` | `sourceApp`, `sourceType`, `sourceId` | `{ sourceApp, sourceType, sourceId }`; read-only for manual operator drafts. |
| Linked Fiscal Document / المستند الضريبي | Read-only `Link` | `fiscalDocumentId?: UUID` | `fiscalDocumentId: UUID \| null` | Deep-links to `/accounting/post/fiscal-documents/[id]` when non-null. |
| Totals & Status / الإجماليات والحالة | `JournalBalanceBar` + `StatusBadge` | *(computed by server)* | `totalDebit: DecimalString`, `totalCredit: DecimalString`, `status: JournalDraftStatus` | `totalDebit === totalCredit > 0` required before `submit` or `post`. |
| Workflow & Concurrency / سير العمل والنسخة | `ApprovalPanel` / Banners | `If-Match: "<version>"` | `version: number`, `payloadHash: Sha256Hex \| null`, `approvalRequestId: UUID \| null`, `rejectionReason: string \| null` (`Detail`), `postedEntryId: UUID \| null`, `postingExceptionId: UUID \| null`, `submittedBy`, `submittedAt` | `ETag` / `version` guards every state transition (`409 STALE_VERSION`). |

#### Table 1.3.2 — Journal Draft Line Grid (`JournalDraftLineInput` / `JournalDraftDetailDto.lines[]`)

| Grid Column (EN / AR) | Control | Request DTO Member (`lines[]`) | Read Projection Member (`lines[]`) | Validation & Domain Rules |
| --- | --- | --- | --- | --- |
| `#` / م | Read-only `<IdentifierText>` | `lineNo: number` | `lineNo: number` | `1..2,000` (`MAX_LINES_PER_ENTRY = 2,000`; min `2` lines). |
| Account / الحساب | `AccountPicker` (`POST /accounts/lookup`) | `accountId: UUID` | `accountId: UUID` | Must satisfy `isPostable && allowManualJournal && !deprecatedAt`. |
| Party / الطرف | `PartyPicker` (`POST /party-finance-profiles/lookup`) | `partyId?: UUID` | `partyId: UUID \| null` | Mandatory when selected account `requiresParty === true` (`422 ACCOUNT.PARTY_REQUIRED`). |
| Branch / الفرع | `Select` | `branchId?: UUID` | `branchId: UUID \| null` | Defaults to active `X-Branch-Id` if set. |
| Dimensions / الأبعاد | `DimensionSetPicker` (`POST /dimension-values/lookup`) | `dimensions?: DimensionTupleInput` (`{ members: { dimensionTypeId, dimensionValueId }[] }`) | `dimensionSetId: UUID \| null` | Mandatory for each code in account `requiresDimensionTypeCodes` (`422 ACCOUNT.DIMENSION_REQUIRED`). |
| Debit / مدين · Credit / دائن | Dual `MoneyInput` cells | `direction: DebitCredit`, `amountTxn: DecimalString` | `direction: DebitCredit`, `amountTxn: DecimalString`, `currencyCode: CurrencyCode` | Strictly positive `DecimalString` (`> 0`, up to `8` fractional digits; `isStorno` is system-only on reversals). |
| Functional Amount / المعادل بالعملة الأساسية | `MoneyInput` / Read-only preview | `amountFunctional?: DecimalString` | `amountFunctional: DecimalString \| null` | Computed from `amountTxn × fxRateSnapshot`; editable only within rounding tolerance when foreign currency. |
| Quantity & UoM / الكمية والوحدة | `More` popover inputs | `quantity?: DecimalString`, `uom?: string` | `quantity: DecimalString \| null`, `uom: string \| null` | Optional statistical quantity (`uom <= 16` chars). |
| Cash-Flow Category / فئة التدفق النقدي | `More` popover `Select` | `cashFlowCategoryId?: UUID` | `cashFlowCategoryId: UUID \| null` | Optional override for Direct Cash-Flow classification. |
| Line Description / شرح السطر | `TextInput` | `description?: string` | `description: string \| null` *(`JournalDraftLineDetailDto`, returned with the lines and their dimension members by `JournalDraftDetailDto`, `D-771`)* | `maxLength: 500`. |

#### Table 1.3.3 — Workflow Modals & Bulk Operations (`SCR-05` Command DTOs)

| Action Surface | DTO Name (`02_DTOs.md`) | Exact Payload Fields | Notes & Constraints |
| --- | --- | --- | --- |
| Submit for Approval Modal | `SubmitJournalDraftDto` | `comment?: string` (`<= 1,000` chars) | Freezes `payloadHash` & opens `ApprovalRequest` (`D-146`). |
| Approve / Reject (`ApprovalPanel`) | `ApproveRequestDto` / `RejectRequestDto` (`requestId` = the draft's `approvalRequestId`; `If-Match` = that request's `version`, never the draft's, `D-771`) | Approve: `requestId`, `action`, `expectedPayloadHash: Sha256Hex`, `comment?: string` (`<= 1,000`).<br>Reject: `requestId`, `action`, `expectedPayloadHash`, `reason: string` (`10..500` chars on a draft target, because it becomes `rejection_reason`). | Requires `accounting.close.approvals` + `accounting.approval.approve`/`.reject`; `maker ≠ checker` (`D-467`). |
| Post Journal Modal | `PostJournalDraftDto` | `draftId: UUID`, `expectedTotalDebit: DecimalString`, `expectedTotalCredit: DecimalString`, `overrideFxRateId?: UUID`, `overrideReason?: string` (`10..1,000` chars) | `overrideFxRateId` & `overrideReason` rendered **only** when `currencyCode !== functionalCurrencyCode && draft.approvalRequestId === null` (`409 FX_OVERRIDE_ON_APPROVED` if approved, `D-339`). Response includes `PostingReceiptDto` (`entryId`, `entryNo`, `chainSeq`, `entryHash`, `prevEntryHash`, `periodId`, `fiscalYearId`, `postedAt`). |
| Reopen Draft Modal (`APPROVED` / `BLOCKED`) | `ReopenJournalDraftDto` | `reason: string` (`10..1,000` chars) | Clears `approvalRequestId`; preserves `postingExceptionId` (`D-316`). |
| Bulk Post Bar (`#12`) | `BulkPostJournalDraftsDto` (`D-771`) | `items: PostJournalDraftDto[]` (`1..100`, unique `draftId`; each item carries the expected totals and no version) | All-or-nothing `200` with `data.postings[]` (`Concurrency: none`, `x-idempotency-key` required). |
| Launch Bulk Operation Drawer (`#52`) | `BulkOperationDto` | `scopeKind: BulkOperationScope`, `targets: UUID[]` (`1..500`), `operation: BulkOperationKind`, `parameters?: Record<string, unknown>`, `approvals?: Array<{ targetId: UUID; approvalRequestId: UUID }>`, `continueOnError?: boolean` | `approvals` sent **only** for `REOPEN_PERIOD` (`D-358`). Returns `202` + `Location` + `Retry-After`. |

---

### 1.4 Verbatim Endpoint & Permission Matrix (`SCR-05`)

Every row is copied verbatim from `02_Endpoint_Catalogue.md` (§3, §4, §6, §10). Browser requests prefix paths with `/api/tenant/accounting/v1` via `src/lib/api/axiosClient.ts`.

| Role | Method | Gateway Path (`/api/tenant/accounting/v1/...`) | Permission | Feature Key | Scope Target | Idempotency | Concurrency | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `[P]` | `GET` | `/accounting/journal-drafts` | `accounting.journal_draft.read` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | none | none | `200` |
| `[P]` | `POST` | `/accounting/journal-drafts/search` | `accounting.journal_draft.read` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | none | none | `200` |
| `[P]` | `POST` | `/accounting/journal-drafts/count` | `accounting.journal_draft.read` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | none | none | `200` |
| `[P]` | `GET` | `/accounting/journal-drafts/:id` | `accounting.journal_draft.read` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | none | none | `200` + `ETag` |
| `[P]` | `POST` | `/accounting/journal-drafts` | `accounting.journal_draft.create` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | `x-idempotency-key` | none | `201` + `Location` |
| `[P]` | `PATCH` | `/accounting/journal-drafts/:id` | `accounting.journal_draft.update` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | `x-idempotency-key` | `If-Match` | `200` (`DRAFT` and `REJECTED` only) |
| `[P]` | `DELETE` | `/accounting/journal-drafts/:id` | `accounting.journal_draft.delete` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | `x-idempotency-key` | `If-Match` | `204` (`DRAFT`, `REJECTED` or `CANCELLED`) |
| `[P]` | `POST` | `/accounting/journal-drafts/:id/submit` | `accounting.journal_draft.submit` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | `x-idempotency-key` | `If-Match` | `200` |
| `[P]` | `POST` | `/accounting/journal-drafts/:id/approve` | `accounting.approval.approve` | `accounting.close.approvals` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| `[P]` | `POST` | `/accounting/journal-drafts/:id/reject` | `accounting.approval.reject` | `accounting.close.approvals` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| `[P]` | `POST` | `/accounting/journal-drafts/:id/post` | `accounting.journal_draft.post` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` + chain headers |
| `[P]` | `POST` | `/accounting/journal-drafts/:id/cancel` | `accounting.journal_draft.cancel` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | `x-idempotency-key` | `If-Match` | `200` |
| `[P]` | `POST` | `/accounting/journal-drafts/:id/reopen` | `accounting.journal_draft.update` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | `x-idempotency-key` | `If-Match` | `200` (`APPROVED` and `BLOCKED` only) |
| `[P]` | `POST` | `/accounting/journal-drafts/bulk-post` | `accounting.journal_draft.post` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `200` (all-or-nothing) |
| `[P]` | `GET` | `/accounting/bulk-operations` | `accounting.bulk_operation.read` | `accounting.ledger.core` | `TENANT` | none | none | `200` |
| `[P]` | `GET` | `/accounting/bulk-operations/:id` | `accounting.bulk_operation.read` | `accounting.ledger.core` | `TENANT` | none | none | `200` |
| `[P]` | `POST` | `/accounting/bulk-operations` | `accounting.bulk_operation.create` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | none | `202` + `Location` + `Retry-After` |
| `[S]` | `GET` | `/accounting/company-profile` | `accounting.profile.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` + `ETag` |
| `[S]` | `POST` | `/accounting/accounts/lookup` | `accounting.account.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | none | none | `200` |
| `[S]` | `POST` | `/accounting/party-finance-profiles/lookup` | `accounting.party_finance_profile.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |
| `[S]` | `GET` | `/accounting/journals` | `accounting.journal.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |
| `[S]` | `GET` | `/accounting/periods` | `accounting.period.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |
| `[S]` | `POST` | `/accounting/dimension-values/lookup` | `accounting.dimension.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |
| `[S]` | `POST` | `/accounting/fx-rates/resolve` | `accounting.fx_rate.resolve` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | none | none | `200` |
| `[S]` | `GET` | `/accounting/approval-requests/:id` | `accounting.approval.read` | `accounting.close.approvals` | `COMPANY_OR_BRANCH` | none | none | `200` + `ETag` |
| `[S]` | `POST` | `/accounting/approval-requests/:id/withdraw` | `accounting.approval.withdraw` | `accounting.close.approvals` | `COMPANY_OR_BRANCH` | `x-idempotency-key` | `If-Match` | `200` |
| `[S]` | `GET` | `/accounting/attachments` | `accounting.attachment.read` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | none | none | `200` |
| `[S]` | `POST` | `/accounting/attachments` | `accounting.attachment.create` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | `x-idempotency-key` | none | `201` + `Location` |
| `[S]` | `GET` | `/accounting/attachments/:id/download` | `accounting.attachment.download` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | none | none | `200` |
| `[S]` | `DELETE` | `/accounting/attachments/:id` | `accounting.attachment.delete` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `204` |

---

### 1.5 Empty, Loading, Error, `403`, `404` & Entitlement States (`SCR-05`)

1. **Empty States (`EmptyState` from `@/design-system`):**
   - **First-use on `#12` (`total === 0` with no active filters):** Title `No journal drafts yet` / `لا توجد مسودات قيود بعد`, body explaining manual and adjustment drafts stage entries safely before legal numbering, and primary CTA `+ New Journal Draft` (hidden if `!hasPerm('accounting.journal_draft.create')`).
   - **Filtered-empty on `#12` or `#52`:** Title `No matching records` / `لا توجد نتائج مطابقة`, secondary button `Reset Filters` / `إعادة تعيين الفلاتر`.
   - **First-use on `#52`:** Explains cross-company / multi-period batch operations (`CLOSE_PERIOD`, `POST_DEPRECIATION`, `REBUILD_LEDGER_FACTS`) + CTA `+ Launch Bulk Operation` when permitted.
2. **Loading States (`Skeleton`):**
   - `#12` & `#52` render a header skeleton + status tab pills + `8` deterministic table row skeletons matching column widths (`tabular-nums` shimmer blocks on Debit/Credit).
   - `#13` renders header metadata card skeleton + `4` line skeletons + pinned `JournalBalanceBar` skeleton (`aria-busy="true"`).
   - `#53` while `QUEUED` or `RUNNING` renders `AsyncProgressCard` (`WS-06`) — never a blocking full-page spinner.
3. **Error States (`AccountingErrorAlert` — `Cause + Effect + SafeAction + correlationId`):**
   - `422 ACCOUNTING.ENTRY.UNBALANCED` / `422 ACCOUNTING.ACCOUNT.NOT_POSTABLE` / `422 ACCOUNTING.ACCOUNT.MANUAL_JOURNAL_FORBIDDEN` / `422 ACCOUNTING.ACCOUNT.DIMENSION_REQUIRED` / `422 ACCOUNTING.ACCOUNT.PARTY_REQUIRED`: Inline banner + cell-level red ring focusing the exact `lineNo` from `details`, stating that nothing was posted (`Effect`), and prompting `CORRECT_AND_RESEND`.
   - `409 ACCOUNTING.PERIOD.CLOSED` / `409 ACCOUNTING.PERIOD.SOFT_CLOSED`: Explains the target GL period is closed/soft-closed, nothing was posted, and offers `Select an Open Posting Date` or link to `/accounting/close/periods` (`SCR-11`).
   - `409 ACCOUNTING.CONCURRENCY.STALE_VERSION` / `409 ACCOUNTING.ENTRY.TOTALS_MISMATCH` (`SCN-082`): Renders the non-destructive diff banner (`Refresh & Review`, `SafeAction.REFRESH_AND_REVIEW`).
   - `409 ACCOUNTING.APPROVAL.REQUIRED`: Explains a company approval rule governs this draft (`Effect`: draft remains unposted) and switches focus to `Submit for Approval` (`SafeAction.REQUEST_APPROVAL`).
   - `403 ACCOUNTING.APPROVAL.ACTOR_IS_SUBMITTER`: Explains segregation of duties (`maker ≠ checker`) requires an independent approver (`RetryClass.INDEPENDENT_ACTOR`).
   - Every error footer exposes copyable `correlationId` (`<IdentifierText>`).
4. **`403` Permission Denied (`PermissionGate` — never an empty state):**
   - Missing `accounting.journal_draft.read` on `#12`/`#13` or missing `accounting.bulk_operation.read` on `#52`/`#53`: Renders full-page `PermissionGate` naming the missing permission domain.
   - Missing `COMPANY` scope (`X-Company-Id` unset on `TENANT` overview) when invoking `COMPANY`-scoped actions (`post`, `bulk-post`, `approve`, `reject`): Disables the `COMPANY` button with inline cue `Select a company in the scope bar to post or approve`.
5. **`404` & Lifecycle Boundary Gates (`accounting-patterns-documents.md` §3):**
   - Unknown `:id` on `#13` or `#53` -> `NotFoundState` (`404`).
   - `404 ACCOUNTING.PROFILE.NOT_FOUND` or `409 ACCOUNTING.PROFILE.NOT_ACTIVATED` -> Onboarding gate card linking to `/accounting/setup/company` (`SCR-01`).
   - **Entitlements (`accounting-ia.md` §3):**
     - Module `accounting` or `accounting.ledger.core` unentitled -> `/accounting/*` routes render module entitlement boundary (`SCR-36` `/accounting/setup/plan` is the sole plan comparison link; **zero upgrade prompts** on `SCR-05`).
     - `accounting.close.approvals` (`Basic` feature key, or tenant lacking it) -> `Approve` / `Reject` controls and `ApprovalPanel` detail fetch do not fire; `#13` remains fully usable for direct draft edit/post.
     - Wave-reserved `EntryKind` (`ALLOCATION`, `COMMITMENT`) and Wave-reserved `BulkOperationKind` (`RUN_RECURRING`, `RETRY_POSTING_EXCEPTIONS`, `YEAR_END_CLOSE`, `ALLOCATION_CYCLE_*`, etc.) are **hidden** from pickers (`accounting-ia.md` §3).
   - **`RECOVERY_MODE` (`403 ACCOUNTING.FEATURE.RECOVERY_MODE`) & `ARCHIVED` Tenant:** Global `AccountingScopeBar` banner active; `#12`, `#13`, `#52`, `#53` remain 100% readable, while every mutating button (`+ New Journal Draft`, `Save`, `Submit`, `Approve`, `Post`, `Bulk Post`, `Upload Attachment`, `+ Launch Bulk Operation`) is disabled with factual tooltip explaining writes are paused until recovery/archive hold rules apply.

---

### 1.6 ASCII Mockups — Four Combinations + Mobile (`SCR-05`)

#### Combination 1 — Arabic RTL × Light (`#13` `/accounting/post/journal-drafts/[id]` — `JournalEditorScreen`)
*Tokens: `dir="rtl"`, `--bg-canvas: #F8FAFC`, `--bg-surface: #FFFFFF`, `--bg-subtle: #F1F5F9`, `--ink-primary: #0F172A`, single filled `primary` button `[ترحيل القيد]`.*

```text
+------------------------------------------------------------------------------------------------------+
| [شريط النطاق: شركة النيل للتجارة (EGP) v] [الفرع: المركز الرئيسي v]         [AR | فاتح] [بحث Ctrl+K] |
+------------------------------------------------------------------------------------------------------+
| [ترحيل القيد (Primary)] [إرسال للاعتماد] [حفظ التغييرات] [⋯]    مسودات القيود / مسودة #0195f2a4  <- |
|                                                [النسخة v3] [قيد تسوية] [مسودة ● (Neutral)]          |
+------------------------------------------------------------------------------------------------------+
| بيانات رأس القيد                                                                                     |
| +----------------------+----------------------+------------------------+---------------------------+ |
| | تاريخ الترحيل *      | تاريخ المستند *      | نوع القيد *            | اليومية *                 | |
| | [ 2026-10-31      ]  | [ 2026-10-31      ]  | [ تسوية (ADJUSTMENT) v]| [ JV-GEN اليومية العامة v]| |
| +----------------------+----------------------+------------------------+---------------------------+ |
| | سعر الصرف المثبّت (POST /fx-rates/resolve)  | العملة *               | الفترة المحاسبية          | |
| | [ 1 USD = 48.75000000 EGP · CBE · مثبّت ✓ ] | [ USD               v] | [ 2026-P10 (مفتوحة)     ] | |
| +---------------------------------------------+------------------------+---------------------------+ |
| | البيان (Memo)                                                                         (48 / 1,000) | |
| | [ إثبات تسوية مصروفات استشارية مستحقة لشهر أكتوبر 2026                                          ] | |
| +--------------------------------------------------------------------------------------------------+ |
+------------------------------------------------------------------------------------------------------+
| سطور القيد (3 سطور · حد أقصى 2,000)                                        [+ إضافة سطر (Insert)]   |
| +----+-------------+--------------------+---------------+------------+---------------+----+--------+ |
| |  # | المعادل EGP | دائن (USD)         | مدين (USD)    | الأبعاد    | الطرف         |فرع | الحساب | |
| +----+-------------+--------------------+---------------+------------+---------------+----+--------+ |
| |  1 | 48,750.00   |               0.00 |      1,000.00 | CC-10 · إدا| —             | HQ | 520100 | |
| |    |             |                    |               |            |               |    | استشارات| |
| |  2 | 24,375.00   |               0.00 |        500.00 | CC-20 · مبي| —             | HQ | 520100 | |
| |  3 | 73,125.00   |           1,500.00 |          0.00 | —          | P-00492 مورد  | HQ | 210400 | |
| |    |             |                    |               |            |               |    | مستحقات | |
| +----+-------------+--------------------+---------------+------------+---------------+----+--------+ |
| > المرفقات (1): contract-oct-2026.pdf [تنزيل] [حذف]                                                  |
+======================================================================================================+
| [متوازن ✓ Δ 0.00 USD (Positive)] | المعادل: 73,125.00 EGP | دائن: 1,500.00 | مدين: 1,500.00 | سطور:3|
+======================================================================================================+
```

#### Combination 2 — Arabic RTL × Dark (`#12` `/accounting/post/journal-drafts` — Drafts List & Tier-1 `BulkActionBar`)
*Tokens: `dir="rtl"`, `--bg-canvas: #0B0F17`, `--bg-surface: #111827`, `--bg-subtle: #1E293B`, `--ink-primary: #F8FAFC`, single filled `primary` button `[+ مسودة قيد جديدة]`.*

```text
+------------------------------------------------------------------------------------------------------+
| [الوضع الليلي · #0B0F17] [شركة النيل للتجارة (EGP) v] [كل الفروع v]                    [AR | داكن]  |
+------------------------------------------------------------------------------------------------------+
| [+ مسودة قيد جديدة (Primary)] [العمليات الجماعية]                                    مسودات القيود  |
|                                                         إعداد ومراجعة وترحيل القيود اليدوية والتسويات |
+------------------------------------------------------------------------------------------------------+
| [المرحّلة] [الملغاة] [المرفوضة] [المعلّقة (2) !] [المعتمدة (4)] [بانتظار الاعتماد (3)] [مسودة (7)] [الكل] |
+------------------------------------------------------------------------------------------------------+
| [فلاتر متقدمة] [إلى: 2026-10-31] [من: 2026-10-01] [النوع: الكل v] [اليومية: الكل v] [بحث...       ] |
+------------------------------------------------------------------------------------------------------+
| +---+---------------+--------------+--------------+-----+------------+------------+---------+------+ |
| |   | الحالة        | إجمالي دائن  | إجمالي مدين  |عملة | ت. الترحيل | النوع      | اليومية |معرّف | |
| +---+---------------+--------------+--------------+-----+------------+------------+---------+------+ |
| |[x]| [معتمدة ✓]    |    73,125.00 |    73,125.00 | EGP | 2026-10-31 | ADJUSTMENT | JV-GEN  |0195f2| |
| |[x]| [مسودة ●]     |    12,400.00 |    12,400.00 | EGP | 2026-10-30 | STANDARD   | JV-GEN  |0195ef| |
| |[-]| [بانتظار ⏳]  |   250,000.00 |   250,000.00 | EGP | 2026-10-29 | ACCRUAL    | JV-ACC  |0195ea| |
| |[-]| [معلّقة ✕]    |     8,000.00 |     8,000.00 | USD | 2026-10-28 | STANDARD   | JV-FX   |0195e1| |
| +---+---------------+--------------+--------------+-----+------------+------------+---------+------+ |
+======================================================================================================+
| [ترحيل المسودات المحددة (2)] [إلغاء التحديد]      تم تحديد 2 مسودة (الإجمالي: 85,525.00 EGP · الكل أو لا شيء)|
+======================================================================================================+
```

#### Combination 3 — English LTR × Light (`#13` `/accounting/post/journal-drafts/[id]` — `PENDING_APPROVAL` Maker-Checker View)
*Tokens: `dir="ltr"`, `--bg-canvas: #F8FAFC`, `--bg-surface: #FFFFFF`, `--status-caution-bg`, single filled `primary` button `[Approve Draft]` for non-maker checker.*

```text
+------------------------------------------------------------------------------------------------------+
| [Scope: Nile Trading Co. (EGP) v] [Branch: Cairo HQ v]                        [Search Ctrl+K] [EN|☀] |
+------------------------------------------------------------------------------------------------------+
| <- Journal Drafts / Draft #0195ea90              [Pending Approval ⏳] [ACCRUAL] [v2] [Reject] [Approve Draft (Primary)] |
+------------------------------------------------------------------------------------------------------+
| APPROVAL GOVERNANCE PANEL (UX-10 · Rule: Manual Journals >= 100,000.00 EGP · Step 1 of 1)            |
| Submitted by: Sara Mahmoud (2026-10-29 14:22) · Payload SHA-256: 9f4c2a1e...88b1 (Verified Match ✓)  |
| Note from submitter: "October warehouse rent & utility accrual per signed lease."                    |
| Maker-Checker Check: You (Ahmed Hassan) are NOT in makerUserIds — eligible to approve or reject.     |
+------------------------------------------------------------------------------------------------------+
| HEADER SUMMARY (Read-Only while PENDING_APPROVAL)                                                    |
| Journal: JV-ACC (Accruals)  | Kind: Accrual  | Posting Date: 2026-10-31 | Period: 2026-P10 (OPEN)    |
| Document Date: 2026-10-29   | Currency: EGP  | FX Rate: 1.00000000 (Functional)                      |
| Memo: October 2026 warehouse rent and electricity accrual — 10th of Ramadan facility                 |
+------------------------------------------------------------------------------------------------------+
| JOURNAL LINES (2 lines · Read-Only)                                                                  |
| +----+------------------------+----------------+--------+--------------+--------------+------------+ |
| | #  | Account                | Party          | Branch | Dimensions   | Debit (EGP)  |Credit (EGP)| |
| +----+------------------------+----------------+--------+--------------+--------------+------------+ |
| | 1  | 510800 Warehouse Rent  | —              | CAI-HQ | CC-30 · WH   |   250,000.00 |       0.00 | |
| | 2  | 210500 Accrued Expense | P-00118 Landlord| CAI-HQ | —            |         0.00 | 250,000.00 | |
| +----+------------------------+----------------+--------+--------------+--------------+------------+ |
+======================================================================================================+
| Lines: 2 | Total Debit: 250,000.00 EGP | Total Credit: 250,000.00 EGP | [Balanced ✓ Δ 0.00 EGP]      |
+======================================================================================================+
```

#### Combination 4 — English LTR × Dark (`#53` `/accounting/post/bulk-operations/[id]` — Run Detail & Failed-Target Retry)
*Tokens: `dir="ltr"`, `--bg-canvas: #0B0F17`, `--bg-surface: #111827`, `--status-caution-fg` (`PARTIAL`), single filled `primary` button `[Retry Failed Targets (1)]`.*

```text
+------------------------------------------------------------------------------------------------------+
| [Dark · #0B0F17] [Scope: Tenant-Wide Batch Monitor · Nile Group]                              [EN|☾] |
+------------------------------------------------------------------------------------------------------+
| <- Bulk Operations / Run #0195f810           [PARTIAL ⚠] [FISCAL_PERIOD · SOFT_CLOSE_PERIOD]         |
| Requested: 2026-10-31 18:05 by Omar Adel · Completed: 18:05     [Retry Failed Targets (1) (Primary)] |
+------------------------------------------------------------------------------------------------------+
| +----------------------+ +----------------------+ +----------------------+ +-----------------------+ |
| | Total Targets        | | Succeeded (Positive) | | Failed (Negative)    | | Skipped (Neutral)     | |
| | 4                    | | 3                    | | 1                    | | 0                     | |
| +----------------------+ +----------------------+ +----------------------+ +-----------------------+ |
+------------------------------------------------------------------------------------------------------+
| PER-TARGET EXECUTION RESULTS (BulkOperationDetailDto.results[])          [Filter: All Outcomes (4) v]|
| +--------------------------+--------------+-------------------------------------------+------------+ |
| | Target Period ID         | Outcome      | Failure / Diagnostic Summary              | Result Ref | |
| +--------------------------+--------------+-------------------------------------------+------------+ |
| | 019410a1... (Nile · P10) | [SUCCEEDED ✓]| —                                         | View Period| |
| | 019410a2... (Delta · P10)| [SUCCEEDED ✓]| —                                         | View Period| |
| | 019410a3... (Sinai · P10)| [FAILED ✕]   | Period is FUTURE; open fiscal year first. | Fix Period | |
| | 019410a4... (Alex · P10) | [SUCCEEDED ✓]| —                                         | View Period| |
| +--------------------------+--------------+-------------------------------------------+------------+ |
+------------------------------------------------------------------------------------------------------+
```

#### Mobile `375px` Responsive Layout (`SCR-05` `#13` Draft Inspection & Approval)
On `< 768px`, multi-line spreadsheet authoring (`2..2,000` columns) shows a non-blocking banner recommending desktop for bulk line entry while keeping existing draft inspection, maker-checker approval, reopen, and single-tap posting 100% operable via stacked line cards and a sticky bottom balance summary:

```text
+-------------------------------------+
| <- Draft #0195ea90    [Pending ⏳]  |
| JV-ACC · 2026-10-31 · EGP           |
+-------------------------------------+
| Approval Step 1/1 · Match SHA-256 ✓ |
| [Approve Draft (Primary)]  [Reject] |
+-------------------------------------+
| Line 1 · 510800 Warehouse Rent      |
| Dim: CC-30 · Dr:     250,000.00 EGP |
|-------------------------------------|
| Line 2 · 210500 Accrued Expense     |
| Party: P-00118 · Cr: 250,000.00 EGP |
+=====================================+
| Dr 250,000.00 = Cr 250,000.00 [✓]   |
+=====================================+
```

---

## 2. `SCR-06` — Posted Journal Entries, Ledger Lines, Reversal, Chain Proof & Redactions

### 2.1 Inventory & Use-Case Traceability

- **Screen ID & Title:** `SCR-06` — Posted Journal Entries, Ledger Lines, Reversal, Chain Proof & Redactions (`القيود المرحّلة وسطور الأستاذ والعكس وإثبات السلسلة`)
- **Routes:**
  - `#14` `/accounting/post/journal-entries` (`accountingJournalEntries`)
  - `#15` `/accounting/post/journal-entries/[id]`
- **Use Cases & Journey Steps:** `UC-LPO-2` (`02_ledger_posting.md` §3.2), `UC-LPO-3` (recurring run outputs), `UC-LPO-5` (ledger line drill-through); Journey steps `ACT-12c` (opening entry), `ACT-13`, `POST-08`..`POST-12`, `ETA-03`, `IN-12`, `CASH-04`, `PAY-08`, `CLOSE-09`, `FAIL-09`; Scenarios `SCN-024` (`SWAP_SIDES` vs `STORNO` reversal), `SCN-025` (SHA-256 hash-chain proof & range verification), `SCN-026` (dual-control PII redaction preserving `entryHash`), `SCN-027` (intercompany correlation group `OPEN` -> `BALANCED` / `UNBALANCED`), `SCN-089` (`BROKEN` chain proof incident escalation).
- **Append-Only Immutability Invariant (`D-012`, `D-017`):** `acc_journal_entries` and `acc_journal_lines` have **no `version` column**, **no `ETag`**, **no `PATCH`**, and **no `DELETE`**. Corrections occur exclusively by posting a new reversing entry (`POST /:id/reverse`), and privacy erasure occurs exclusively by replacing `memo` / `description` with `'[REDACTED]'` under dual control (`POST /ledger/redactions` -> `POST /ledger/redactions/:approvalRequestId/approve`).

### 2.2 Layout & Progressive Disclosure Architecture

#### A. Route `#14` — `/accounting/post/journal-entries` (3-Tab Ledger Explorer)
1. **`AccountingScopeBar`:** `OPERATING_CONTEXT` (`X-Company-Id` + optional `X-Branch-Id`). Note that `Verify Hash Chain`, `Export`, and `Intercompany Groups` require an active `X-Company-Id` (`COMPANY` scope target); when viewing tenant-wide context without `X-Company-Id`, those `COMPANY`-scoped actions/tab show an inline scope prompt (`Select a company to run company-scoped chain verification, export, or intercompany correlation`).
2. **`PageHeader`:**
   - Title: `Journal Entries` / `القيود المرحّلة`
   - Subtitle: `Immutable general ledger entries, line explorer, cryptographic hash-chain proof, and intercompany groups.` / `سجل القيود المرحّلة غير القابل للتعديل، مستكشف السطور، إثبات سلسلة التجزئة، والمجموعات البينية.`
   - Secondary actions (`outline`):
     - `Verify Hash Chain` / `فحص سلامة السلسلة` (opens `VerifyChainModal` -> `POST /accounting/journal-entries/verify-chain`; visible when `hasPerm('accounting.journal_entry.verify_chain')`).
     - `Export` / `تصدير` (dropdown `CSV` / `XLSX` -> `POST /accounting/journal-entries/export` on Tab 1 or `POST /accounting/journal-lines/export` on Tab 2 via `ExportQueryDto`; returns `202` + `Location` tracked in `AccountingJobTrayDrawer`; visible when `hasPerm('accounting.journal_entry.export')`).
   - **Single `primary` CTA (`Link`):** `+ New Journal Draft` / `+ مسودة قيد جديدة` -> `/accounting/post/journal-drafts?mode=new` (visible when `hasPerm('accounting.journal_draft.create')`, disabled in `RECOVERY_MODE` / `ARCHIVED`).
3. **Segmented Explorer Tabs (`Tabs`):**
   - **Tab 1 — `Entries` (`القيود المرحّلة`):**
     - Count chip via `POST /accounting/journal-entries/count`.
     - `FilterBar` (`JournalEntryListQueryDto`): `Journal` (`journalId`), `Ledger` (`ledgerId`), `Fiscal Year` (`fiscalYearId`), `Period` (`periodId`), `Entry Kind` (`entryKind`), `Posting Date From/To` (`fromPostingDate`, `toPostingDate`), `Account` (`accountId` via `AccountPicker`), `Party` (`partyId` via `PartyPicker`), `Search` (`search`), plus `Advanced Filters` drawer (`POST /accounting/journal-entries/search` via `JournalEntrySearchDto`).
     - `AccountingLedgerGrid` (`UX-05`) columns (`font-normal` `400` body cells):
       1. `Entry No.` (`entryNo` `<IdentifierText>` link to `/accounting/post/journal-entries/[id]`)
       2. `Chain #` (`chainSeq` `<IdentifierText>`)
       3. `Posting Date` (`postingDate` `<IdentifierText>`)
       4. `Document Date` (`documentDate` `<IdentifierText>`)
       5. `Journal` (`journalId` -> journal `code` + localized name)
       6. `Kind` (`entryKind` localized badge)
       7. `Currency` (`currencyCode` `<IdentifierText>`)
       8. `Total Debit` (`totalDebit` `<MoneyCell>`)
       9. `Total Credit` (`totalCredit` `<MoneyCell>`)
       10. `Ledger State` (`StatusBadge` derived from `reversed: boolean` — `Posted` [`positive`] when `false`, `Reversed` [`neutral`] when `true`; the detail also returns `branchId`, `functionalCurrencyCode`, `draftId` and `reversedByEntryId`, `D-770`).
     - **Keyset Pagination Discipline (`UX-05`):** Uses offset up to page `200` within a single fiscal year and keyset `cursor` (`JournalEntryListQueryDto.cursor`) beyond page `200` or across multi-year ranges (`02_Endpoint_Catalogue.md` §4 line 270). **Never renders a client-computed `<tfoot>` sum over partial cursor pages.**
   - **Tab 2 — `Ledger Lines` (`سطور الأستاذ`):**
     - Flat line-level analysis (`GET /accounting/journal-lines` via `JournalLineListQueryDto`, `limit` `1..500` `MAX_LEDGER_PAGE_SIZE`, keyset response `data.items` + `data.pageInfo { nextCursor, hasMore }` with **no `meta`**; `POST /accounting/journal-lines/search`, `CG-JRN-06`).
     - Inline filters: `Account` (`accountId`), `Party` (`partyId`), `Branch` (`branchId`), `Dimension Set` (`dimensionSetId`), `Posting Date From/To` (`fromPostingDate`, `toPostingDate`), `Entry ID` (`entryId`).
     - Columns: `Entry` (`entryId` `<IdentifierText>` link -> `#15`; `JournalLineSummaryDto` returns `entryNo`, `entryKind`, `journalId`, `periodId` and `chainSeq` with the line, `D-770`) · `Line #` (`lineNo`) · `Posting Date` (`postingDate`) · `Account` (`accountCodeSnapshot` + localized `accountNameSnapshot`) · `Party` (`partyId`) · `Branch` (`branchId`) · `Debit (Txn)` / `Credit (Txn)` (`direction`, `amountTxn`, `currencyCode`, rendering negative signed `--status-negative-fg` + `[Storno]` chip when `isStorno === true`) · `Functional Amount` (`amountFunctional`).
   - **Tab 3 — `Intercompany Groups` (`المجموعات البينية`):**
     - Read-only correlation monitor (`GET /accounting/interco-groups`, `COMPANY` scope, `accounting.journal_entry.read`).
     - Columns (`IntercoGroupSummaryDto` via §13.1): `Group Ref` (`groupRef`, e.g., `IC-2026-000123`) · `Kind` (`kind`: `TRANSFER | SERVICE_CHARGE | COST_ALLOCATION | LOAN | SETTLEMENT | OTHER`) · `Initiating Company` (`initiatingCompanyId`) · `Counterparty` (`counterpartyCompanyId` or `Multi-company`) · `Currency` (`currencyCode`) · `Member Entries` (`entryCount`) · `Signed Net Amount` (`netAmount` `<MoneyCell>`) · `Status` (`OPEN` `caution`, `BALANCED` `positive`, `UNBALANCED` `caution`, `CLOSED` `neutral`) · `Reconciled At` (`reconciledAt`).
     - Row click opens `IntercoGroupDetailDrawer` (`GET /accounting/interco-groups/:id`), displaying `description` (`varchar(500)`), balancing rule explanation (`D-347`), and correlated entries (`GET /accounting/journal-entries` with `intercoGroupId`, `D-771`).
4. **`VerifyChainModal` (`POST /accounting/journal-entries/verify-chain`):**
   - Inputs: `Fiscal Year` (`fiscalYearId`, `Select` from `GET /accounting/fiscal-years`), optional `From Chain Seq` (`fromChainSeq`), optional `To Chain Seq` (`toChainSeq`) (`VerifyChainDto`; the result is `VerifyChainResultDto`, `D-771`).
   - Displays deterministic verification summary (`verified === true` -> `positive` card confirming unbroken SHA-256 linkage from `fromSeq` to `toSeq`; `verified === false` -> `negative` alert naming the broken sequence & escalating to `SCR-40`).

#### B. Route `#15` — `/accounting/post/journal-entries/[id]` (Immutable Entry Detail, Chain Proof, Reversal & Redaction)
1. **Zone 1 — `DetailHeader` & Derived Ledger Badges:**
   - Breadcrumb: `Post` -> `Journal Entries` -> `<IdentifierText>{entryNo}</IdentifierText>`.
   - Derived Status & Classification Pills (`accounting-status-and-a11y.md` §1.2):
     - `Posted` (`positive`) when `!entry.reversed`, or `Reversed` (`neutral` retired) when `entry.reversed === true` (the forward `reversedByEntryId` pointer is on `JournalEntryDetailDto`, `D-770`).
     - `Reversal` (`neutral`) + clickable `<Link href="/accounting/post/journal-entries/${entry.reversesEntryId}">` + `reversalReason` pill when `entry.reversesEntryId !== null`.
     - `Redirected from closed period` (`caution`) when `entry.originalPeriodId !== null` (`originalPeriodId -> periodId`, `D-021`).
     - `EntryKind` badge (`t.accounting.enums.entryKind[entry.entryKind]`).
     - `[Storno]` (`negative` subtle badge) when `entry.lines.some(l => l.isStorno)`.
   - **Single `primary` CTA (Eligibility-Guarded):**
     - **`Reverse Entry` (`عكس القيد`)** (`variant="primary"`) rendered when `hasPerm('accounting.journal_entry.reverse')`, `X-Company-Id` is active, tenant is not in `RECOVERY_MODE`/`ARCHIVED`, and the entry passes client-visible eligibility (`!entry.reversed && entry.reversesEntryId === null && entry.fiscalDocumentId === null && !entry.lines.some(l => l.taxTransactionId !== null)`).
     - When `entry.fiscalDocumentId !== null` or `entry.sourceRef !== null` (Trade/POS/Asset/Tax source-owned entry, `D-361`), `Reverse Entry` is replaced by an `outline` `Link` button **`Open Source Fiscal Document` (`فتح المستند الضريبي الأصلي`)** -> `/accounting/post/fiscal-documents/${entry.fiscalDocumentId}` with an inline hint explaining source-owned entries reverse only through a credit/debit note or owning subledger command (`422 ACCOUNTING.ENTRY.SOURCE_OWNED`).
   - **Secondary Actions (`outline` / Overflow Menu):**
     - `Re-verify Chain Proof` (`GET /accounting/journal-entries/:id/chain-proof`, `hasPerm('accounting.journal_entry.chain_proof')`).
     - `Request PII Redaction` (opens `LedgerRedactionDrawer`, `hasPerm('accounting.ledger_redaction.request')`).
     - `Approve Pending Redaction` (shown inside banner/drawer when `redactionRequestId` is active and `hasPerm('accounting.ledger_redaction.approve')`).
2. **Zone 2 — Provenance & Cryptographic Hash-Chain Card (`2` balanced panels):**
   - **Panel A — Accounting Context & Upstream Provenance:**
     - `Ledger` (`ledgerId`), `Journal` (`journalId`), `Fiscal Year` (`fiscalYearId`), `Period` (`periodId`), `Original Closed Period` (`originalPeriodId` if non-null), `Posting Date` (`postingDate`), `Document Date` (`documentDate`), `Tax Point Date` (`taxPointDate`), `Currency` (`currencyCode`), `FX Rate Snapshot` (`fxRateSnapshot` `<IdentifierText>`), `Posted At` (`postedAt`), `Posted By` (`postedBy`).
     - Provenance chips: `Source Reference` (`sourceRef: sourceApp · sourceType · sourceId` + `GET /accounting/source-document-links` link badge when `accounting.integration.trade_posting` & `accounting.fiscal_document.read` are held), `Fiscal Document` (`fiscalDocumentId`), `Intercompany Group` (`intercoGroupId` -> opens `IntercoGroupDetailDrawer`), `Posting Rule Version` (`postingRuleVersionId` -> `/accounting/setup/posting-rules/[id]`), `Country-Pack Adoption` (`adoptionId`).
     - `Memo`: Renders `entry.memo` (or neutral `[REDACTED]` / `[محجوب لحماية البيانات]` token badge when `entry.memo === '[REDACTED]'`).
   - **Panel B — Per-Year SHA-256 Hash-Chain & `ChainProofDto` Evidence (`D-017`, `D-018`):**
     - Displays `Chain Sequence` (`#chainSeq`), `Hash Schema` (`v{hashSchemaVersion}`), `Entry Hash (SHA-256)` (`entryHash` `<IdentifierText>` truncated `12..8` hex with copy button), `Previous Entry Hash` (`prevEntryHash` `<IdentifierText>` with `GENESIS (0000…0000)` indicator when `chainSeq === 1`).
     - Live `ChainProofDto` badge (`GET /accounting/journal-entries/:id/chain-proof`, gated on `accounting.journal_entry.chain_proof`):
       - `INTACT` -> `positive` pill `Cryptographic Proof: INTACT` (`إثبات السلسلة: سليم ✓`).
       - `BROKEN` -> `negative` `Alert` `Cryptographic Proof: BROKEN` (`إثبات السلسلة: منكسر ✕`) with `SafeAction.CONTACT_OPERATOR`, full hash diagnostic block, and link to `/accounting/reconcile/integrity`.
3. **Zone 3 — Immutable Posted Lines Grid (`JournalLineDetailDto[]`):**
   - Columns (`font-normal` `400` body cells): `#` (`lineNo`) · `Account Snapshot` (`<IdentifierText>{accountCodeSnapshot}</IdentifierText>` + localized `accountNameSnapshot`, with subtle link to current account `#90`) · `Party` (`partyId`) · `Branch` (`branchId`) · `Dimensions` (`dim1..dim4` / `dimensionSetId`) · `Debit (Txn)` (`direction === 'DEBIT'` -> `amountTxn`; negative signed in `negative` token + `[Storno]` badge when `isStorno === true`) · `Credit (Txn)` (`direction === 'CREDIT'` -> `amountTxn`; negative signed in `negative` token + `[Storno]` badge when `isStorno === true`) · `Functional Equiv.` (`amountFunctional` — signed matching `isStorno`) · `Line Description & Metadata` (`description` or `[REDACTED]` pill + expandable `quantity`/`uom`, `cashFlowCategoryId`, `taxTransactionId`, `postingRuleId`).
   - Sticky/footer summary row (`font-semibold` `600`): Exact `entry.totalDebit` and `entry.totalCredit` from `JournalEntryDetailDto` (since all lines of one entry are loaded in full on `#15`).
4. **Zone 4 — Read-Only `AttachmentList`:**
   - Lists supporting attachments via `GET /accounting/attachments` and signed downloads via `GET /accounting/attachments/:id/download`. Delete button is disabled with lock icon (`protectedAfterPosting = true`, `02_Endpoint_Catalogue.md` §6 line 562).
5. **Modals & Drawers on `#15`:**
   - **`ReverseJournalModal` (`POST /accounting/journal-entries/:id/reverse`):** Binds `ReverseJournalEntryDto` (`reason`, `reversalDate`, `reverseSettlements`, `comment`), previews `SWAP_SIDES` vs `STORNO` effect from `companyProfile.reversalMethod`, generates one UUIDv7 `x-idempotency-key` per intent, and navigates to the newly created reversal entry on `200`.
   - **`LedgerRedactionDrawer` (`POST /accounting/ledger/redactions` & `POST /accounting/ledger/redactions/:approvalRequestId/approve`):** Authors `RequestLedgerRedactionDto` (`targets[]` over `acc_journal_entries.memo` and `acc_journal_lines.description` of `:id`, plus PII-free `reason` `10..1,000` chars -> `202` + `Location`) and executes second-actor `ApproveLedgerRedactionDto` (`expectedPayloadHash`, `comment?`, `If-Match` of `approvalRequestId` -> `200`).

---

### 2.3 Field-to-DTO Mapping Tables (`SCR-06`)

#### Table 2.3.1 — Posted Journal Entry Header & Chain Proof (`JournalEntrySummaryDto` / `JournalEntryDetailDto` / `ChainProofDto`)

| UI Field (EN / AR) | Surface | DTO & Member (`02_DTOs.md` §5.3) | Type & Rendering Rules |
| --- | --- | --- | --- |
| Entry Number / رقم القيد القانوني | `#14` & `#15` | `JournalEntrySummaryDto.entryNo` | `string` inside `<IdentifierText>`; gap-free per `(journalId, fiscalYearId)`. |
| Chain Sequence / تسلسل السلسلة | `#14` & `#15` | `JournalEntrySummaryDto.chainSeq` | `number` (`bigint` integer) inside `<IdentifierText>`. |
| Journal & Ledger / اليومية والدفتر | `#14` & `#15` | `journalId` (`Summary`), `ledgerId` (`Detail`) | `UUID` resolved against cached journals/ledgers. |
| Entry Kind / نوع القيد | `#14` & `#15` | `JournalEntrySummaryDto.entryKind` | `EntryKind` (`STANDARD`, `ADJUSTMENT`, `REVERSAL`, `OPENING`, `CLOSING`, `FX_REVALUATION`, `TAX`, etc.) via `t.accounting.enums.entryKind.*`. |
| Posting / Document / Tax Dates | `#14` & `#15` | `postingDate`, `documentDate` (`Summary`); `taxPointDate` (`Detail`) | `ISODate` (`YYYY-MM-DD`) in `<IdentifierText>`. |
| Fiscal Year & Periods / السنة والفترة | `#15` | `fiscalYearId`, `periodId`, `originalPeriodId` (`Detail` — see `CG-JRN-07`) | `originalPeriodId !== null` renders `Redirected from closed period` (`caution`). |
| Currency & FX Snapshot / العملة وسعر الصرف | `#14` & `#15` | `currencyCode` (`Summary`); `fxRateSnapshot` (`Detail`) | `CurrencyCode` + `DecimalString \| null` (`8`-dp snapshot rate). |
| Total Debit & Credit / إجمالي مدين ودائن | `#14` & `#15` | `totalDebit`, `totalCredit` (`Summary`) | `DecimalString` in `<MoneyCell>` (`tabular-nums`, never `Number()`). |
| Reversal State & Linkage / حالة العكس | `#14` & `#15` | `reversed: boolean` (`Summary`); `reversesEntryId: UUID \| null`, `reversalReason: ReversalReason \| null` (`Detail`) | `reversed === true` -> `Reversed` badge; `reversesEntryId !== null` -> `Reversal` badge + link to original entry (forward link `reversedByEntryId` on the detail, `D-770`). |
| Upstream Provenance / مراجع المصدر | `#15` | `sourceRef: TripleReference \| null`, `fiscalDocumentId: UUID \| null`, `intercoGroupId: UUID \| null`, `adoptionId: UUID \| null`, `postingRuleVersionId: UUID \| null` (`Detail`) | Deep-links to owning fiscal document, intercompany drawer, or posting-rule version. |
| Audit & Memo / الترحيل والبيان | `#15` | `postedAt: ISODateTime`, `postedBy: UUID \| null`, `memo: string \| null` (`Detail`) | `memo === '[REDACTED]'` renders neutral `[REDACTED]` badge. |
| Stored Hash Chain / البصمة الرقمية | `#15` | `hashSchemaVersion: number`, `entryHash: Sha256Hex`, `prevEntryHash: Sha256Hex` (`Detail`) | `64`-char hex `<IdentifierText>` with copy action; excluded from `memo`/`description` edits (`D-018`). |
| Recomputed Chain Verdict / نتيجة فحص السلسلة | `#15` | `ChainProofDto`: `entryId`, `fiscalYearId`, `chainSeq`, `entryHash`, `prevEntryHash`, `hashSchemaVersion`, `verdict: 'INTACT' \| 'BROKEN'` | `GET /accounting/journal-entries/:id/chain-proof` (`accounting.journal_entry.chain_proof`). |

#### Table 2.3.2 — Posted Lines, Reversal, Redaction, Export & Intercompany DTOs (`SCR-06`)

| Surface | DTO Name (`02_DTOs.md`) | Exact Members Bound in UI | Domain & Validation Notes |
| --- | --- | --- | --- |
| `#15` Posted Lines Grid | `JournalLineDetailDto` | `id`, `lineNo`, `accountId`, `accountCodeSnapshot`, `accountNameSnapshot`, `direction`, `amountTxn`, `currencyCode`, `amountFunctional`, `isStorno`, `partyId`, `branchId`, `dimensionSetId`, `dim1`, `dim2`, `dim3`, `dim4`, `quantity`, `uom`, `cashFlowCategoryId`, `taxTransactionId`, `postingRuleId`, `description` | Snapshot code/name preserved forever; `isStorno === true` renders negative amount in same `direction` column (`D-029`). |
| `#14` Tab 2 Ledger Lines | `JournalLineListQueryDto` -> `JournalLineSummaryDto` (`CG-JRN-08`) | Query: `entryId?`, `accountId?`, `partyId?`, `branchId?`, `dimensionSetId?`, `fromPostingDate?`, `toPostingDate?`, `cursor?`, `limit?` (`1..500`). | Keyset envelope `data.items` + `data.pageInfo { nextCursor, hasMore }` (no `meta`). |
| `#14` Tab 3 Intercompany | `IntercoGroupSummaryDto` / `IntercoGroupDetailDto` (§13.1 over `acc_interco_groups`) | `id`, `groupRef`, `kind` (`IntercoGroupKind`), `initiatingCompanyId`, `counterpartyCompanyId`, `currencyCode`, `status` (`IntercoGroupStatus`), `entryCount`, `netAmount`, `description` (`Detail` only, `<=500`), `reconciledAt`, `reconciledBy`, `version` | Strictly read-only in MVP (`L G`); `CLOSED` reserved for Wave 2 (`D-347`). Member entries come from `JournalEntryListQueryDto.intercoGroupId?` (`D-771`). |
| `#14` Export Dropdown | `ExportQueryDto` | `format: 'CSV' \| 'XLSX'` + active filter fields of `JournalEntryListQueryDto` or `JournalLineListQueryDto` | Strips `page`, `limit`, `sort`, `cursor` (`400` if sent);Wave-2 `PARQUET` hidden. |
| `#14` Verify Chain Modal | `VerifyChainDto` / `VerifyChainResultDto` (`D-771`) | Request `{ fiscalYearId, fromChainSeq?, toChainSeq? }`; result `{ fiscalYearId, fromChainSeq, toChainSeq, entriesVerified, verdict: 'INTACT' \| 'BROKEN', firstBrokenChainSeq, firstBrokenEntryId, failedStep, verifiedAt }` | Read-like `POST` (`Idempotency: none`, `Concurrency: none`). |
| `#15` Reverse Entry Modal | `ReverseJournalEntryDto` | `reason: 'MANUAL' \| 'ERROR_CORRECTION' \| 'PERIOD_CORRECTION'`, `reversalDate: ISODate`, `comment?: string` (`<= 1,000`), `reverseSettlements?: boolean` (default `true`) | Returns `JournalEntrySummaryDto & { posting: PostingReceiptDto }` + chain headers. |
| `#15` Request Redaction | `RequestLedgerRedactionDto` | `targets: Array<{ table: 'acc_journal_entries' \| 'acc_journal_lines'; rowId: UUID; column: 'memo' \| 'description' }>` (`1..500`), `reason: string` (`10..1,000`) | Single entry scope; returns `202` + `Location` of `PERSONAL_DATA_REDACTION` request (`D-220`). |
| `#15` Approve Redaction | `ApproveLedgerRedactionDto` | `expectedPayloadHash: Sha256Hex`, `comment?: string` (`<= 1,000`) | Requires `If-Match` of `approvalRequestId` + distinct actor (`403 ACTOR_IS_SUBMITTER`); `409 REDACTION_LEGAL_HOLD` if held. |

---

### 2.4 Verbatim Endpoint & Permission Matrix (`SCR-06`)

Copied verbatim from `02_Endpoint_Catalogue.md` (§4, §6, §10, §11):

| Role | Method | Gateway Path (`/api/tenant/accounting/v1/...`) | Permission | Feature Key | Scope Target | Idempotency | Concurrency | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `[P]` | `GET` | `/accounting/journal-entries` | `accounting.journal_entry.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | none | none | `200`; keyset beyond page `200` |
| `[P]` | `POST` | `/accounting/journal-entries/search` | `accounting.journal_entry.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | none | none | `200` |
| `[P]` | `POST` | `/accounting/journal-entries/count` | `accounting.journal_entry.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | none | none | `200` |
| `[P]` | `GET` | `/accounting/journal-entries/:id` | `accounting.journal_entry.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | none | none | `200` (no `ETag`; no `version`) |
| `[P]` | `GET` | `/accounting/journal-entries/:id/lines` | `accounting.journal_entry.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | none | none | `200` |
| `[P]` | `GET` | `/accounting/journal-entries/:id/chain-proof` | `accounting.journal_entry.chain_proof` | `accounting.ledger.core` | `COMPANY` | none | none | `200` (`ChainProofDto`) |
| `[P]` | `POST` | `/accounting/journal-entries/verify-chain` | `accounting.journal_entry.verify_chain` | `accounting.ledger.core` | `COMPANY` | none | none | `200` (fiscal-year range check) |
| `[P]` | `POST` | `/accounting/journal-entries/:id/reverse` | `accounting.journal_entry.reverse` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `200` + chain headers |
| `[P]` | `POST` | `/accounting/journal-entries/export` | `accounting.journal_entry.export` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `202` + `Location` |
| `[P]` | `POST` | `/accounting/ledger/redactions` | `accounting.ledger_redaction.request` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `202` + `Location` |
| `[P]` | `POST` | `/accounting/ledger/redactions/:approvalRequestId/approve` | `accounting.ledger_redaction.approve` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| `[P]` | `GET` | `/accounting/journal-lines` | `accounting.journal_entry.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | none | none | `200`; `limit` `1..500` |
| `[P]` | `POST` | `/accounting/journal-lines/search` | `accounting.journal_entry.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | none | none | `200` |
| `[P]` | `POST` | `/accounting/journal-lines/export` | `accounting.journal_entry.export` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `202` + `Location` |
| `[P]` | `GET` | `/accounting/interco-groups` | `accounting.journal_entry.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |
| `[P]` | `GET` | `/accounting/interco-groups/:id` | `accounting.journal_entry.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |
| `[S]` | `GET` | `/accounting/source-document-links` | `accounting.fiscal_document.read` | `accounting.integration.trade_posting` | `COMPANY` | none | none | `200` |
| `[S]` | `GET` | `/accounting/attachments` | `accounting.attachment.read` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | none | none | `200` |
| `[S]` | `GET` | `/accounting/attachments/:id/download` | `accounting.attachment.download` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | none | none | `200` |
| `[S]` | `GET` | `/accounting/exports/runs/:id` | `accounting.export.read` | `accounting.reporting.snapshots` | `COMPANY` | none | none | `200` |
| `[S]` | `GET` | `/accounting/exports/runs/:id/download` | `accounting.export.download` | `accounting.reporting.snapshots` | `COMPANY` | none | none | `200` |
| `[S]` | `GET` | `/accounting/approval-requests` | `accounting.approval.read` | `accounting.close.approvals` | `COMPANY_OR_BRANCH` | none | none | `200` *(see `CG-JRN-10`)* |

---

### 2.5 Empty, Loading, Error, `403`, `404` & Entitlement States (`SCR-06`)

1. **Empty States (`EmptyState`):**
   - **First-use on `#14` Tab 1 (`Entries`) / Tab 2 (`Ledger Lines`):** `No posted journal entries yet` / `لا توجد قيود مرحّلة بعد`, explaining that entries appear once opening balances (`SCR-09`), manual drafts (`SCR-05`), or fiscal documents (`SCR-17`) post, with secondary link `Go to Opening Balances` and primary `+ New Journal Draft` (when permitted).
   - **First-use on `#14` Tab 3 (`Intercompany Groups`):** `No intercompany correlation groups` / `لا توجد مجموعات مطابقة بينية`, explaining groups are created automatically when intercompany entries post across group companies (`D-347`).
   - **Filtered-empty:** `No matching ledger records` + `Reset Filters` button.
2. **Loading States (`Skeleton`):**
   - `#14`: Tab bar + filter bar + `10` dense `AccountingLedgerGrid` row skeletons (`tabular-nums` shimmer on `entryNo`, `chainSeq`, `totalDebit`, `totalCredit`).
   - `#15`: `DetailHeader` skeleton + 2-column Provenance/Hash-Chain skeleton + `4` line skeletons; `ChainProofDto` badge shows a subtle inline `Verifying SHA-256 chain…` pulse without blocking the entry or lines from rendering immediately.
   - Async `Export` (`202`): Tracked non-blockingly in `AccountingJobTrayDrawer` (`WS-05`).
3. **Error States (`AccountingErrorAlert` — `Cause + Effect + SafeAction + correlationId`):**
   - `409 ACCOUNTING.ENTRY.ALREADY_REVERSED`: Explains this entry has already been reversed (`Effect`: no duplicate reversal created) and prompts `REFRESH_AND_REVIEW` to reload the entry.
   - `422 ACCOUNTING.ENTRY.IS_A_REVERSAL`: Explains a reversal entry cannot itself be reversed; post a new manual entry instead.
   - `422 ACCOUNTING.ENTRY.SOURCE_OWNED`: Explains this entry belongs to a fiscal document, asset, POS settlement, or subledger transaction and must be reversed from its owning document (`SafeAction.CORRECT_AND_RESEND` with direct link to `fiscalDocumentId` when present).
   - `422 ACCOUNTING.ENTRY.PRIOR_PERIOD_CORRECTION_INVALID` / `409 ACCOUNTING.PERIOD.CLOSED` / `422 ACCOUNTING.PERIOD.BACKDATE_LIMIT`: Highlights `reversalDate` in `ReverseJournalModal`, explains the period/backdate constraint, and prompts selecting an open period date (`reason = 'PERIOD_CORRECTION'`).
   - `409 ACCOUNTING.BANK.RECONCILED_RANGE_POSTING` / `409 ACCOUNTING.FX.BACKDATED_CARRYING_CONFLICT`: Displays `conflictingPostingDate` from `details` and sets the date picker minimum to `conflictingPostingDate`.
   - `409 ACCOUNTING.ENTRY.REDACTION_LEGAL_HOLD`: Explains an active legal hold suspends personal-data erasure (`D-081`, `D-220`; nothing changed).
   - `403 ACCOUNTING.APPROVAL.ACTOR_IS_SUBMITTER`: Explains redaction approval must be performed by an independent user other than the requester (`maker ≠ checker`).
   - `ACCOUNTING.CHAIN.BROKEN` / `ChainProofDto.verdict === 'BROKEN'`: Renders persistent `negative` alert banner (`SafeAction.CONTACT_OPERATOR`) with copyable `correlationId`, `entryId`, `chainSeq`, and `entryHash`.
4. **`403` Permission Denied (`PermissionGate`):**
   - Missing `accounting.journal_entry.read` on `#14` or `#15`: Full-page `PermissionGate` (never an empty state).
   - Scoped sub-permission hiding/gating on `#14`/`#15`:
     - `!hasPerm('accounting.journal_entry.chain_proof')`: Hides live `ChainProof` recomputation call on `#15` while still displaying the stored `entryHash` & `prevEntryHash` from `JournalEntryDetailDto`.
     - `!hasPerm('accounting.journal_entry.verify_chain')`: Hides `Verify Hash Chain` button on `#14`.
     - `!hasPerm('accounting.journal_entry.export')`: Hides `Export` button on `#14`.
     - `!hasPerm('accounting.journal_entry.reverse')`: Hides `Reverse Entry` button on `#15`.
     - `!hasPerm('accounting.ledger_redaction.request')` / `.approve`: Hides redaction request/approve actions on `#15`.
5. **`404` & Entitlement / Lifecycle Boundaries:**
   - Unknown `:id` on `#15` -> `NotFoundState` (`404`).
   - **Feature Entitlements (`accounting-ia.md` §3):**
     - `accounting.integration.trade_posting` (`Advanced` or unentitled `Basic` tenant) **or** `!hasPerm('accounting.fiscal_document.read')`: `#15` **never calls** `GET /accounting/source-document-links` (avoiding noisy background `403`s) and renders the raw `sourceRef` (`sourceApp · sourceType · sourceId`) from `JournalEntryDetailDto` cleanly without a broken drill-link.
     - `accounting.reporting.snapshots` unentitled: `#14` `POST /export` still returns `202` + `Location` (`accounting.ledger.core`), and polling uses the `Location` resource when entitled or shows standard export job notification.
   - **`RECOVERY_MODE` & `ARCHIVED` Tenant:** `#14` and `#15` (including `GET /:id/chain-proof` and `POST /verify-chain` read-only checks) remain **100% accessible for audit and continuity inspection** (`SCR-37` cross-links directly into `#14`/`#15` during `RECOVERY_MODE`!), while mutating commands (`Reverse Entry`, `Request/Approve Redaction`, `+ New Journal Draft`) are disabled with read-only recovery/archive tooltips.

---

### 2.6 ASCII Mockups — Four Combinations + Mobile (`SCR-06`)

#### Combination 1 — Arabic RTL × Light (`#15` `/accounting/post/journal-entries/[id]` — Posted Entry, `INTACT` Chain Proof & `STORNO` Lines)
*Tokens: `dir="rtl"`, `--bg-canvas: #F8FAFC`, `--bg-surface: #FFFFFF`, `--status-positive-bg` (`INTACT`), `--status-negative-fg` (`isStorno = true`), single filled `primary` CTA `[عكس القيد]`.*

```text
+------------------------------------------------------------------------------------------------------+
| [شريط النطاق: شركة النيل للتجارة (EGP) v] [الفرع: المركز الرئيسي v]         [AR | فاتح] [بحث Ctrl+K] |
+------------------------------------------------------------------------------------------------------+
| [عكس القيد (Primary)] [طلب حجب بيانات شخصية] [إعادة فحص السلسلة]    القيود المرحّلة / JV-GEN-2026-000142 <- |
|                           [التسلسل #142] [موجه من فترة مغلقة: 2026-P09 ⚠] [قيد تسوية] [مرحّل ✓]       |
+------------------------------------------------------------------------------------------------------+
| +--------------------------------------------------+ +---------------------------------------------+ |
| | إثبات سلسلة التجزئة (SHA-256 Chain Proof · v1)   | | البيانات المحاسبية ومصدر القيد              | |
| | النتيجة الحية: [إثبات السلسلة: سليم ✓ (INTACT)]  | | الدفتر: PRIMARY · اليومية: JV-GEN           | |
| | التسلسل في السنة: #142 (السنة المالية 2026)      | | تاريخ الترحيل: 2026-10-31 · المستند: 10-31  | |
| | بصمة القيد (entryHash):      [نسخ] a8f3c912…4d0e | | الفترة: 2026-P10 (الأصلية المغلقة: 2026-P09)| |
| | بصمة القيد السابق (prev):    [نسخ] 71b0e44a…99c2 | | العملة: EGP · سعر الصرف: 1.00000000         | |
| | ملاحظة: حجب النص الشخصي لا يغيّر بصمة القيد.     | | رُحّل بواسطة: سارة محمود · 2026-10-31 16:40 | |
| +--------------------------------------------------+ +---------------------------------------------+ |
| البيان (Memo): تسوية مصروفات استشارية مرحّلة من شهر سبتمبر المغلق — [محجوب لحماية البيانات] (مثال)   |
+------------------------------------------------------------------------------------------------------+
| سطور القيد المرحّلة (لقطة غير قابلة للتعديل · تعرض السطور العادية وسطور العكس السالب [Storno])       |
| +----+--------------------+----------------+---------------+------------+--------+-----------------+ |
| |  # | شرح السطر          | دائن (EGP)     | مدين (EGP)    | الأبعاد    | الطرف  | لقطة الحساب     | |
| +----+--------------------+----------------+---------------+------------+--------+-----------------+ |
| |  1 | عكس استحقاق سابق   |           0.00 | -10,000.00    | CC-10 · إدا| —      | 520100 استشارات | |
| |    |                    |                | [عكس سالب !]  |            |        |                 | |
| |  2 | إثبات القيمة الصحيحة|          0.00 |  12,500.00    | CC-10 · إدا| —      | 520100 استشارات | |
| |  3 | صافي التزام المورد |       2,500.00 |          0.00 | —          |P-00492 | 210400 مستحقات  | |
| +----+--------------------+----------------+---------------+------------+--------+-----------------+ |
| | الإجمالي المحفوظ بالقيد |       2,500.00 |      2,500.00 | (الأثر الصافي متوازن بالعملة EGP ✓)   | |
| +-------------------------+----------------+---------------+---------------------------------------+ |
+------------------------------------------------------------------------------------------------------+
```

#### Combination 2 — Arabic RTL × Dark (`#14` `/accounting/post/journal-entries` — 3-Tab Ledger Explorer & Keyset Paging)
*Tokens: `dir="rtl"`, `--bg-canvas: #0B0F17`, `--bg-surface: #111827`, `--bg-subtle: #1E293B`, `--ink-primary: #F8FAFC`, single filled `primary` CTA `[+ مسودة قيد جديدة]`.*

```text
+------------------------------------------------------------------------------------------------------+
| [الوضع الليلي · #0B0F17] [شركة النيل للتجارة (EGP) v] [الفرع: الكل v]                  [AR | داكن]   |
+------------------------------------------------------------------------------------------------------+
| [+ مسودة قيد جديدة (Primary)] [تصدير v] [فحص سلامة السلسلة]                          القيود المرحّلة |
|                                          سجل القيود غير القابل للتعديل وسطور الأستاذ والمجموعات البينية|
+------------------------------------------------------------------------------------------------------+
|          [المجموعات البينية (Interco)]   [سطور الأستاذ (Ledger Lines)]   [* القيود المرحّلة (1,482) *]|
+------------------------------------------------------------------------------------------------------+
| [فلاتر متقدمة] [إلى: 2026-10-31] [من: 2026-10-01] [الفترة: P10 v] [اليومية: الكل v] [حساب / طرف...] |
+------------------------------------------------------------------------------------------------------+
| +--------------+--------------+--------------+-----+------------+---------+------------+------+--------------------+ |
| | حالة القيد   | إجمالي دائن  | إجمالي مدين  |عملة | النوع      | اليومية | ت. الترحيل |تسلسل | رقم القيد القانوني | |
| +--------------+--------------+--------------+-----+------------+---------+------------+------+--------------------+ |
| | [مرحّل ✓]    |    73,125.00 |    73,125.00 | USD | ADJUSTMENT | JV-GEN  | 2026-10-31 | #142 | JV-GEN-2026-000142 | |
| | [معكوس ●]    |    18,000.00 |    18,000.00 | EGP | STANDARD   | JV-GEN  | 2026-10-30 | #141 | JV-GEN-2026-000141 | |
| | [مرحّل ✓]    |    18,000.00 |    18,000.00 | EGP | REVERSAL   | JV-GEN  | 2026-10-30 | #143 | JV-GEN-2026-000143 | |
| | [مرحّل ✓]    |   114,000.00 |   114,000.00 | EGP | STANDARD   | JV-SLS  | 2026-10-29 | #140 | JV-SLS-2026-000891 | |
| +--------------+--------------+--------------+-----+------------+---------+------------+------+--------------------+ |
| [الصفحة التالية (Cursor) <-] [-> الصفحة السابقة]   عرض 50 قيداً · تنقّل بالمؤشر بدون جمع جزئي مضلل   |
+------------------------------------------------------------------------------------------------------+
```

#### Combination 3 — English LTR × Light (`#14` `/accounting/post/journal-entries` — Tab 3 `Intercompany Groups` + Detail Drawer)
*Tokens: `dir="ltr"`, `--bg-canvas: #F8FAFC`, `--bg-surface: #FFFFFF`, `--status-positive-bg` (`BALANCED`), `--status-caution-bg` (`UNBALANCED`), single `primary` CTA `[+ New Journal Draft]`.*

```text
+------------------------------------------------------------------------------------------------------+
| [Scope: Nile Trading Co. (EGP) v] [Branch: All Branches v]                    [Search Ctrl+K] [EN|☀] |
+------------------------------------------------------------------------------------------------------+
| Journal Entries                                [Verify Hash Chain] [Export v] [+ New Journal Draft (Primary)] |
| [Entries (1,482)]   [Ledger Lines]   [* Intercompany Groups (3) *]                                   |
+------------------------------------------------------------------------------------------------------+
| +------------------+----------------+---------------+---------------+-----+-------+-------------+--+ |
| | Group Ref        | Kind           | Initiating Co | Counterparty  | Ccy |Entries| Net Amount  |St| |
| +------------------+----------------+---------------+---------------+-----+-------+-------------+--+ |
| | IC-2026-000123   | SERVICE_CHARGE | Nile Trading  | Delta Retail  | EGP |     2 |        0.00 |✓ | |
| | IC-2026-000124   | TRANSFER       | Nile Trading  | Sinai Logistics| EGP|     1 |  +45,000.00 |⏳ | |
| | IC-2026-000125   | COST_ALLOCATION| Nile Trading  | Multi-company | EGP |     3 |   +3,200.00 |⚠ | |
| +------------------+----------------+---------------+---------------+-----+-------+-------------+--+ |
|                                                                                                      |
| +-- INTERCOMPANY GROUP DRAWER: IC-2026-000123 (GET /accounting/interco-groups/:id) ----------------+ |
| | Status: [BALANCED ✓] · Kind: Service Charge · Currency: EGP · Reconciled: 2026-10-30 15:12       | |
| | Net Intercompany Balance: 0.00 EGP across 2 member entries (>= 2 companies, netAmount = 0, D-347)| |
| | Description: Shared IT infrastructure & ERP hosting recharge — October 2026                      | |
| +--------------------------------------------------------------------------------------------------+ |
+------------------------------------------------------------------------------------------------------+
```

#### Combination 4 — English LTR × Dark (`#15` `/accounting/post/journal-entries/[id]` — `ReverseJournalModal` & PII Redaction Banner)
*Tokens: `dir="ltr"`, `--bg-canvas: #0B0F17`, `--bg-surface: #111827`, `--bg-elevated: #1F2937`, single `primary` CTA inside modal `[Confirm & Post Reversal]`.*

```text
+------------------------------------------------------------------------------------------------------+
| [Dark · #0B0F17] <- Journal Entries / JV-GEN-2026-000142    [Posted ✓] [Chain #142: INTACT ✓] [EN|☾] |
+------------------------------------------------------------------------------------------------------+
| [i] Pending PII Redaction Request #0195f9c0 (Frozen SHA-256: 4c19...e02a)     [Approve Redaction]    |
+------------------------------------------------------------------------------------------------------+
|          +================ REVERSE JOURNAL ENTRY (POST /:id/reverse) ================+               |
|          | Reversing Entry: JV-GEN-2026-000142 · Total: 73,125.00 EGP (1,500.00 USD) |               |
|          | Company Reversal Method: STORNO (Negative amounts on original Dr/Cr sides)|               |
|          |---------------------------------------------------------------------------|               |
|          | Reversal Reason *                                                         |               |
|          | [ PERIOD_CORRECTION — Prior closed period adjustment                   v] |               |
|          |                                                                           |               |
|          | Reversal Posting Date *                 Target Open Period                |               |
|          | [ 2026-11-01                         ]  [ 2026-P11 (OPEN · original=P10)] |               |
|          |                                                                           |               |
|          | [x] Reverse linked subledger settlements (reverseSettlements = true)      |               |
|          |                                                                           |               |
|          | Comment (optional · 0 / 1,000)                                            |               |
|          | [ Correcting October consulting accrual amount; re-booking in Nov 2026  ] |               |
|          |---------------------------------------------------------------------------|               |
|          | Idempotency: UUIDv7 pinned · Append-only new entry                        |               |
|          |                                   [Cancel] [Confirm & Post Reversal (Pri)]|               |
|          +===========================================================================+               |
+------------------------------------------------------------------------------------------------------+
```

#### Mobile `375px` Responsive Layout (`SCR-06` `#15` Immutable Entry & Chain Proof)
```text
+-------------------------------------+
| <- JV-GEN-2026-000142   [Posted ✓]  |
| Chain #142 · [Proof: INTACT ✓]      |
+-------------------------------------+
| Posting: 2026-10-31 · Period: P10   |
| Hash: a8f3c912…4d0e [Copy]          |
| [Reverse Entry (Primary)]     [⋯]   |
+-------------------------------------+
| #1 · 520100 Consulting Expense      |
| [Storno !] Dr:       -10,000.00 EGP |
|-------------------------------------|
| #2 · 520100 Consulting Expense      |
| Dr:                   12,500.00 EGP |
|-------------------------------------|
| #3 · 210400 Accrued Liabilities     |
| Party P-00492 · Cr:    2,500.00 EGP |
+=====================================+
| Total Dr 2,500.00 = Cr 2,500.00 EGP |
+=====================================+
```

---

## 3. Bilingual Dictionary Keys (`ar.ts` & `en.ts` — Zero Language Ternaries)

All strings on `SCR-05` and `SCR-06` resolve from `t.accounting.journals.*` and shared `t.accounting.enums.*` (`ar-EG-u-nu-latn` / `en-US`):

| Dictionary Key Path | English (`en.ts`) | Arabic (`ar.ts`) |
| --- | --- | --- |
| `accounting.journals.drafts.title` | `Journal Drafts` | `مسودات القيود` |
| `accounting.journals.drafts.newCta` | `New Journal Draft` | `مسودة قيد جديدة` |
| `accounting.journals.drafts.bulkPostCta` | `Post Selected Drafts` | `ترحيل المسودات المحددة` |
| `accounting.journals.drafts.bulkPostAllOrNothing` | `All selected drafts post together in one transaction; any failure rolls back the batch.` | `تُرحّل جميع المسودات المحددة معاً في معاملة واحدة؛ وأي خطأ يلغي الدفعة بالكامل.` |
| `accounting.journals.editor.postCta` | `Post Journal` | `ترحيل القيد` |
| `accounting.journals.editor.submitCta` | `Submit for Approval` | `إرسال للاعتماد` |
| `accounting.journals.editor.reopenCta` | `Reopen to Draft` | `إعادة فتح كمسودة` |
| `accounting.journals.editor.balanced` | `Balanced` | `متوازن` |
| `accounting.journals.editor.unbalanced` | `Out of Balance` | `غير متوازن` |
| `accounting.journals.bulkOps.title` | `Bulk Operations` | `العمليات الجماعية` |
| `accounting.journals.bulkOps.launchCta` | `Launch Bulk Operation` | `تشغيل عملية جماعية` |
| `accounting.journals.bulkOps.retryFailedCta` | `Retry Failed Targets` | `إعادة محاولة الأهداف الفاشلة` |
| `accounting.journals.entries.title` | `Journal Entries` | `القيود المرحّلة` |
| `accounting.journals.entries.tabs.entries` | `Entries` | `القيود المرحّلة` |
| `accounting.journals.entries.tabs.lines` | `Ledger Lines` | `سطور الأستاذ` |
| `accounting.journals.entries.tabs.interco` | `Intercompany Groups` | `المجموعات البينية` |
| `accounting.journals.entries.verifyChainCta` | `Verify Hash Chain` | `فحص سلامة السلسلة` |
| `accounting.journals.entries.reverseCta` | `Reverse Entry` | `عكس القيد` |
| `accounting.journals.entries.chainIntact` | `Cryptographic Proof: INTACT` | `إثبات السلسلة: سليم` |
| `accounting.journals.entries.chainBroken` | `Cryptographic Proof: BROKEN` | `إثبات السلسلة: منكسر` |
| `accounting.journals.entries.redirectedPeriod` | `Redirected from closed period` | `موجّه من فترة مغلقة` |
| `accounting.journals.entries.stornoBadge` | `Storno` | `عكس سالب` |
| `accounting.journals.redaction.requestCta` | `Request PII Redaction` | `طلب حجب بيانات شخصية` |
| `accounting.journals.redaction.approveCta` | `Approve Redaction` | `اعتماد الحجب` |
| `accounting.journals.redaction.redactedToken` | `Redacted for privacy` | `محجوب لحماية البيانات` |
| `accounting.journals.redaction.noPiiWarning` | `Never repeat personal data in the reason; the reason is permanently stored in the audit trail.` | `لا تكرر البيانات الشخصية داخل سبب الحجب؛ إذ يُحفظ السبب بشكل دائم في سجل المراجعة.` |

---

## 4. Contract Gap List for `P03.T11` (`SCR-05` & `SCR-06`)

Nowhere in §1 or §2 is any missing field, filter, or DTO treated as if it already existed. The ten gaps below (cross-referencing prior pattern gaps `CG-DATA-01..06` and `CG-WF-01..04`) are handed off to **`P03.T11` (Backend Contract Reconciliation)** before `P15`/`P17` implementation:

| Gap ID | Screen & Route | Authoritative Evidence Cited | Exact Contract Gap | Recommended `P03.T11` Resolution |
| --- | --- | --- | --- | --- |
| **`CG-JRN-01`** | `SCR-05` (`#12?mode=new`, `#13`) | `01_ERD/02_Ledger_Tables.md` §3 (`acc_journal_drafts.reference`, `varchar(64)`, hashed in `payload_hash`) vs `04_Static_Data/02_DTOs.md` §5.2 `CreateJournalDraftDto` (lines 624–639) | `acc_journal_drafts` persists and hashes `reference`, yet `CreateJournalDraftDto` omits `reference?: string`. Under `forbidNonWhitelisted`, browser clients cannot author `reference` on manual drafts. | Add `reference?: string` (`@MaxLength(64)`) to `CreateJournalDraftDto` (inherited by `UpdateJournalDraftDto`). |
| **`CG-JRN-02`** | `SCR-05` (`#13` `GET /journal-drafts/:id`) | `04_Static_Data/02_DTOs.md` §13.1 rules 3–4 (lines 4107–4113) vs `01_ERD/02_Ledger_Tables.md` §3 (`acc_journal_draft_lines.description` `varchar(500)`) | Under §13.1 rule 3, `JournalDraftDetailDto.lines` defaults to `JournalDraftLineSummaryDto[]`, and rule 4 omits `varchar > 255` from `SummaryDto` — which would strip `description` (`varchar(500)`) when reopening a draft on `#13`! | Explicitly type `JournalDraftDetailDto.lines` as `JournalDraftLineDetailDto[]` (including `description`, `dimensionSet` members, and `quantity`/`uom`). |
| **`CG-JRN-03`** *(extends `CG-WF-02..04`)* | `SCR-05` (`#12`, `#13`) | `02_Endpoint_Catalogue.md` §4 lines 264–269 vs `04_Static_Data/02_DTOs.md` §5.2 & §13 line 4214 | `POST /journal-drafts/bulk-post` lacks `BulkPostJournalDraftsDto` and response receipt type; `POST /journal-drafts/:id/cancel` lacks `CancelJournalDraftDto`; `POST /journal-drafts/:id/approve` & `/reject` do not state whether `If-Match` compares the draft `version` or the `ApprovalRequest` `version` alongside `ApproveRequestDto` / `RejectApprovalRequestDto`. | Declare `BulkPostJournalDraftsDto` (`items: { draftId, version, expectedTotalDebit, expectedTotalCredit }[]` -> `{ postedCount, highestChainSeq, entries: PostingReceiptDto[] }`), `CancelJournalDraftDto` (`{ reason?: string }`), and document the `If-Match` target on `/journal-drafts/:id/{approve,reject}`. |
| **`CG-JRN-04`** | `SCR-05` (`#52`, `#53` `POST /bulk-operations`) | `01_ERD/02_Ledger_Tables.md` §10 (`acc_bulk_operations.retry_of_id`, line 1015) vs `04_Static_Data/02_DTOs.md` §5.2 `BulkOperationDto` (lines 741–748) | `acc_bulk_operations` has `retry_of_id` for retrying failed targets of a `PARTIAL`/`FAILED` run, but `BulkOperationDto` omits `retryOfId?: UUID`. | Add optional `retryOfId?: UUID` to `BulkOperationDto`. |
| **`CG-JRN-05`** | `SCR-06` (`#14` `POST /journal-entries/verify-chain`) | `02_Endpoint_Catalogue.md` §4 line 276 & `07_Modules/10_MVP/02_ledger_posting.md` §5 line 273 vs `04_Static_Data/02_DTOs.md` §5 | Catalogue names `POST /accounting/journal-entries/verify-chain` (`200 ({fiscalYearId, fromSeq, toSeq, verified})`), but `02_DTOs.md` declares neither `VerifyChainDto` nor `VerifyChainResultDto` (nor failure detail fields `brokenAtSeq` / `brokenEntryId`). | Declare `VerifyChainDto` (`{ fiscalYearId: UUID; fromSeq?: number; toSeq?: number }`) and `VerifyChainResultDto` in `02_DTOs.md` §5. |
| **`CG-JRN-06`** | `SCR-06` (`#14` `POST /journal-lines/search`) | `02_Endpoint_Catalogue.md` §4 line 282 vs `04_Static_Data/02_DTOs.md` §5.1 (lines 612–618) | Catalogue exposes `POST /accounting/journal-lines/search`, but `02_DTOs.md` §5.1 defines `JournalLineListQueryDto` only and omits `JournalLineSearchDto`. | Declare `JournalLineSearchDto extends SearchManyDto` with allowlisted filter/sort fields and keyset `cursor` support. |
| **`CG-JRN-07`** *(extends `CG-DATA-06`)* | `SCR-06` (`#14`, `#15`) | `04_Static_Data/02_DTOs.md` §5.3 `JournalEntrySummaryDto` & `JournalEntryDetailDto` (lines 771–806) vs `01_ERD/02_Ledger_Tables.md` §4 | Explicit `JournalEntrySummaryDto` omits `originalPeriodId` and `hasStornoLines`; explicit `JournalEntryDetailDto` omits `reversedByEntryId`/`reversedByEntryNo` (so a reversed original entry cannot link forward to its reversal entry without a search), `draftId`, `branchId`, and `functionalCurrencyCode`. | Add `originalPeriodId` to `JournalEntrySummaryDto`, and add `reversedByEntryId`, `reversedByEntryNo`, `draftId`, `branchId`, and `functionalCurrencyCode` to `JournalEntryDetailDto`. |
| **`CG-JRN-08`** *(extends `CG-DATA-01`, `CG-DATA-06`)* | `SCR-06` (`#14` Tab 2 `GET /journal-lines`) | `04_Static_Data/02_DTOs.md` §13.1 rules 1 & 4 vs `01_ERD/02_Ledger_Tables.md` §4 (`acc_journal_lines`) | Default `JournalLineSummaryDto` omits parent `entryNo`, `journalId`, and `entryKind`, and omits `description` (`varchar(500) > 255`), degrading the flat `Ledger Lines` explorer tab. | Declare `JournalLineSummaryDto` explicitly in `02_DTOs.md` §5.3 with `entryNo`, `journalId`, `entryKind`, and `description`. |
| **`CG-JRN-09`** | `SCR-06` (`#14` Tab 3 `GET /interco-groups/:id`) | `02_Endpoint_Catalogue.md` §4 lines 308–309 & `01_ERD/02_Ledger_Tables.md` §8 (`acc_interco_groups`, `D-347`, `D-350`) | `IntercoGroupDetailDto` (via §13.1) has no correlated `memberEntries[]` summary across companies, and `JournalEntryListQueryDto` lacks `intercoGroupId?: UUID`. | Declare `IntercoGroupDetailDto` with safe `memberEntries[]` (`companyId`, `entryId`, `entryNo`, `postingDate`, `netIntercoAmount`) and add `intercoGroupId?: UUID` to `JournalEntryListQueryDto`. |
| **`CG-JRN-10`** | `SCR-06` (`#15` PII Redaction approval discovery) | `02_Endpoint_Catalogue.md` §4 lines 279–280 (`accounting.ledger.core`) vs §10 line 1003 (`GET /approval-requests`, `accounting.close.approvals`) | Requesting and approving ledger PII redactions use `accounting.ledger.core`, whereas listing pending approval requests requires `accounting.close.approvals` + `accounting.approval.read`. Users with `accounting.ledger_redaction.approve` alone cannot discover a pending redaction's `approvalRequestId`, `version` (`If-Match`), and `payloadHash` from `#15`. | Include `pendingRedactionRequest: { approvalRequestId: UUID; version: number; payloadHash: Sha256Hex; requestedBy: UUID; requestedAt: ISODateTime; targets: LedgerRedactionTargetInput[] } \| null` on `JournalEntryDetailDto` when caller holds `accounting.ledger_redaction.request` or `.approve`. |

## Contract reconciliation (P03.T11, 1 November 2026)

Reconciles the gaps of this spec against the Endpoint Catalogue and `02_DTOs.md` after `D-770`, `D-771` and `D-772`. The gap list above keeps the original findings; these rulings are final.

| Gap id | Ruling | Where |
| --- | --- | --- |
| `CG-JRN-01` | closed by D-771 | `CreateJournalDraftDto.reference?` (max 64); `UpdateJournalDraftDto` inherits it |
| `CG-JRN-02` | closed by D-771 | The scalar fields (`reference`, `rejectionReason`, `approvalRequestId`, `postingExceptionId`) were already in the undeclared detail; the lines were not, so `JournalDraftDetailDto` and `JournalDraftLineDetailDto` are declared |
| `CG-JRN-03` | closed by D-771 | `BulkPostJournalDraftsDto { items }` (1..100) answering `data.postings[]`; draft approve and reject reuse `ApproveRequestDto` and `RejectRequestDto` with `requestId` = the draft's `approval_request_id`, `If-Match` = the request's `version`, reject reason 10..500; cancel takes an empty body and refuses `PENDING_APPROVAL` with `REQUEST_PENDING` |
| `CG-JRN-04` | closed by D-771 | `BulkOperationDto.retryOfId?` with the parent rules of `acc_bulk_operations.retry_of_id` |
| `CG-JRN-05` | closed by D-771 | `VerifyChainDto { fiscalYearId, fromChainSeq?, toChainSeq? }` and `VerifyChainResultDto` for `POST /accounting/journal-entries/verify-chain` |
| `CG-JRN-06` | closed by D-771 | `JournalLineSearchDto` row (allowlist, one-fiscal-year rule, sensitive filter) for `POST /accounting/journal-lines/search` |
| `CG-JRN-07` | closed by D-770 | `JournalEntryDetailDto` gains `branchId`, `functionalCurrencyCode`, `draftId` and the derived `reversedByEntryId`; `hasStornoLines` is not needed because every line carries `isStorno` |
| `CG-JRN-08` | closed by D-770 | `JournalLineSummaryDto extends JournalLineDetailDto` with `entryId`, `entryNo`, `journalId`, `entryKind`, `postingDate`, `periodId`, `chainSeq`; `description` comes back; the module 02 §5 `GET /journal-lines` row is added |
| `CG-JRN-09` | closed by D-771 | `JournalEntryListQueryDto.intercoGroupId?`; without a company header it lists the group's entries in every company the actor may read |
| `CG-JRN-10` | deferred to stage 5 (P27.T01 definition of ready) | A redaction approver discovering the pending request; filed under P32.T02.S4 |
