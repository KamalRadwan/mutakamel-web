# Accounting Vertical-Slice & Stage-3 Screen Designs — `SCR-17` Fiscal Documents, Attachments & Self-Invoices · `SCR-19A` (`SCR-19`) Authority Documents, Notifications & Late-Submission Grants · `SCR-19B` (`SCR-22`) Unified Exception Board (`P03.T10.S1`)

> **Lead review, 1 November 2026 (P03.T10).** No correction was needed. Every route, permission, feature key and scope below was checked against `backend/docs/LLD/accounting-app/02_API_Contracts/02_Endpoint_Catalogue.md`, `04_Static_Data/05_Permissions_and_Features.md` and `10_Feature_Tiers.md`; what the contracts lack stays in the contract gap list for `P03.T11`.

- **Plan task:** `backend/docs/plans/accounting-app-plan-p03-ux-foundation.md` — `P03.T10.S1` (*SCR-17 fiscal and authority documents (validity, cancel and reject windows) and SCR-19 exception board*)
- **Output path (brief deliverable):** `backend/.omc/artifacts/ask/accounting/out/accounting-slice-documents-exceptions.md`
- **Target promotion path (post lead review):** `frontend/tenant-portal/docs/design/specs/accounting-slice-documents-exceptions.md`
- **Last verified against backend & frontend sources:** `2026-11-01`
- **Design & UX intelligence consulted first:**
  - `frontend/.agents/skills/ui-ux-pro-max/SKILL.md` (dense B2B financial workspace hierarchy, WCAG AA `>= 4.5:1` contrast, keyboard/focus discipline, countdown & irreversible-action safeguards)
  - `frontend/.agents/skills/frontend-design/SKILL.md` (`1440px` shell, `44px` interactive targets, `36px–40px` dense ledger rows, RTL/LTR symmetry)
  - `frontend/tenant-portal/docs/design/README.md` (Five Laws + Accounting design process)
- **Binding approved Tenant Portal accounting specs (reused verbatim, never redesigned):**
  - `frontend/tenant-portal/docs/design/specs/accounting-ia.md` (`118`-route allowlist `#2`, `#16`–`#19`, `#78`–`#79`, 7-section navigation, hidden-vs-disabled entitlement & permission rules)
  - `frontend/tenant-portal/docs/design/specs/accounting-home.md` (`SCR-00` exception & authority KPI cross-links)
  - `frontend/tenant-portal/docs/design/specs/accounting-status-and-a11y.md` (`StatusBadge` 4 outcome roles + `ink`, `aria-live`, focus restoration, zero raw enum strings)
  - `frontend/tenant-portal/docs/design/specs/accounting-patterns-data.md` (`UX-05` `DataTable` / `AccountingLedgerGrid`, `UX-07` `Money`, `MoneyInput`, `FxRateStrip`, `UX-08` `PartyPicker`, `AccountPicker`, `TaxCodePicker`)
  - `frontend/tenant-portal/docs/design/specs/accounting-patterns-workflow.md` (`UX-09` `AsyncProgressCard`, `UX-10` `ApprovalPanel`, `ReasonDialog`, `ConflictDialog`)
  - `frontend/tenant-portal/docs/design/specs/accounting-patterns-documents.md` (`DocumentViewer`, `AuthorityTimeline`, `WaitingStateBadge`, `WaitingStateCallout`, `AttachmentList`, `AmbiguousOutcomePanel`, `WS-01`..`WS-07`)
  - `frontend/tenant-portal/docs/design/specs/accounting-stage1-exceptions-bulk-rules.md` & `accounting-stage1-journals.md` (cross-screen handoffs to `SCR-05`, `SCR-06`, `SCR-08A`)
- **Binding screen inventory & backend LLD authorities:**
  - `frontend/tenant-portal/docs/plans/accounting-screen-inventory.md` (rows `SCR-17`, `SCR-19`, `SCR-22`, §5 route coverage, §6 `CG-01`..`CG-18`)
  - `backend/docs/LLD/accounting-app/13_Delivery_Plan.md` (§3.6 Vertical Slice boundary; `P18` slice vs `P22` stage-3 completion)
  - `backend/docs/LLD/accounting-app/02_API_Contracts/01_Context_Headers_and_Responses.md` & `02_Endpoint_Catalogue.md` (§1–§6, §10–§11 — sole route, permission, feature-key, scope, idempotency, and concurrency authority)
  - `backend/docs/LLD/accounting-app/04_Static_Data/01_Enums.md`, `02_DTOs.md` (§1, §5, §6, §7, §13), `04_Errors_and_Constants.md` (§1–§8)
  - `backend/docs/LLD/accounting-app/01_ERD/04_Documents_and_Authority_Tables.md` (§1–§5, §10–§11)
  - `backend/docs/LLD/accounting-app/07_Modules/10_MVP/04_fiscal_documents_and_authority.md` (`UC-DOC-1`..`UC-DOC-6`, §8 rule 17 `D-724`)
  - `backend/docs/LLD/accounting-app/05_Flows/02_User_Journey_Sales_Invoice_To_Posting.md` & `03_User_Journey_Authority_Clearance.md`

---

## 0. Governance, Scope Reconciliation & Vertical-Slice Partition

### 0.1 Identifier Reconciliation (`SCR-17`, `SCR-19A` / Inventory `SCR-19`, `SCR-19B` / Inventory `SCR-22`)

Across the UX plan (`accounting-app-plan-p03-ux-foundation.md` `P03.T10.S1`), the frontend inventory (`accounting-app-inventory-frontend.md`), and the 35-screen catalogue-reconciled matrix (`accounting-screen-inventory.md`), Fiscal Documents, Authority Documents, and the Unified Exception Board shifted row numbers when `P03.T03` split Fiscal Documents from Authority Documents:

1. **`SCR-17` (`accounting-screen-inventory.md` row `SCR-17`, `[P: 21]`):** Fiscal Documents (`#16`, `#17`), polymorphic Attachments (`acc_attachments`), and `[Full-stage]` Reverse-Charge Self-Invoices (`#18`, `#19`).
2. **`SCR-19A` (`accounting-screen-inventory.md` row `SCR-19`, `[P: 19]` + `1` non-UI `PUBLIC` callback):** Authority Documents (`#78`, `#79`), Submission Attempts timeline, Validity / Cancel / Decline / Reject countdown windows, plus `[Full-stage]` Authority Callback Notifications & Late-Submission Requests (originally grouped into `SCR-17` in `accounting-app-plan-p03-ux-foundation.md`).
3. **`SCR-19B` (`accounting-app-plan-p03-ux-foundation.md` `SCR-19` / `accounting-screen-inventory.md` row `SCR-22`, `[P: 4]`):** Unified Accounting Exception Board (`#2` `/accounting/inbox/exceptions`), which `13_Delivery_Plan.md` §3.6 explicitly includes in the vertical slice (`P18`) alongside `SCR-17` and `SCR-19A`.

Following the approved `SCR-08A` / `SCR-08B` precedent from `P03.T09`, **this specification designs all three screen families (`SCR-17`, `SCR-19A`, and `SCR-19B`) completely** (`44` primary `[P]` UI routes + `1` documented `PUBLIC` webhook non-UI endpoint = `45` catalogue rows) and records the `SCR-19` / `SCR-22` status alignment in **§4 (`CG-SLICE-DOC-01`)** for `P03.T11`.

### 0.2 Master Route & Vertical-Slice (`P18`) vs Full-Stage (`P22` / `P20..P27`) Partition

Every capability, route, tab, and modal in this document carries an explicit delivery tag:
- **`[Slice subset — P18]`** (`13_Delivery_Plan.md` §3.6): Egyptian services company **without Trade installed**, issuing an Accounting sales invoice (`sourceRef.sourceApp = 'accounting'`, `D-724`, `D-692`, `D-758`), deriving `TAX_INVOICE` (`D-082`), resolving 14% VAT + WHT (`D-039`), submitting to ETA (`ETA_INVOICE`), handling `PENDING` / `SUBMITTED` / `VALID` / `INVALID` / `CANCEL_REQUESTED` / `REJECT_REQUESTED` windows, posting automatically on `VALID` (`D-107`), managing legal/supporting attachments (`D-148`), and triaging slice exceptions on `#2`.
- **`[Full stage completion — P22 / P20..P27]`**: Reverse-charge Self-Invoices (`#18`, `#19`, `P22.T06`), attachment `legal-hold` (`TENANT` scope, `P22.T06`), inbound `request-reject` (`P22.T04`), Authority Callback Notifications inbox & replay (`P22.T04`), Late-Submission Requests & 48h grant countdowns (`P22.T04`),Accounting-registered supplier bills & credit/debit notes (`D-724`, `D-759`, `P22.T06`), and the remaining 29 non-slice MVP `ExceptionBoardKind` variants including `AUTHORITY_REQUEST` (`D-544`), `SHIFT_CLOSE_MISSING` (`D-675`), and POS `settlement` dismissals (`D-671`, `D-673`, `P22.T02`..`P27`).

| Screen Family | Route `#` (`accounting-ia.md` §5) | Frozen Next.js App Router Path | Nav Section & Key | Primary `[P]` Routes | `[Slice subset — P18]` | `[Full stage completion — P22]` |
| --- | --- | --- | --- | --- | --- | --- |
| **`SCR-17`** | `#16` | `/accounting/post/fiscal-documents` | `Post` (`accountingFiscalDocuments`) | `fiscal-documents` (`L S C R X`, `5`) | List, search, status tab counts, export, and **`?mode=new` Issue Sales Invoice** (`sourceApp='accounting'`, `sourceType='SALES_INVOICE'`, service lines only, `D-724`) | `?mode=new` extended to `CREDIT_NOTE`, `DEBIT_NOTE`, `PURCHASE_BILL`, `SUPPLIER_CREDIT_NOTE` (`D-724`, `D-759`), foreign-currency `amountSold` / `fxRateId` lines, `deferral` & `constructionAssetId` hints |
| **`SCR-17`** | `#17` | `/accounting/post/fiscal-documents/[id]` | *(detail of `#16`)* | `fiscal-documents` (`G`, `GET /lines`, `derive-kind`, `resolve-tax`, `post`, `cancel`, `6`) + `attachments` (`L G download create delete`, `5` slice + `legal-hold`, `1` full) | Header, lines, frozen `derivationReceipt`, `resolve-tax`, `post` (non-submitted kinds), `cancel`, `attachments` (`create`, `download`, `delete`), cross-link to `#79` & `#15` | `POST /attachments/:id/legal-hold` (`TENANT` scope), `source-document-links` Trade/CRM provenance badge, supersession chain (`supersededById`), `approval_request_id` (`UX-10`) |
| **`SCR-17`** | `#18` | `/accounting/post/self-invoices` | `Post` (`accountingSelfInvoices`) | `self-invoices` (`GET`, `POST`, `2`) | *(Not mounted in slice nav; route renders Stage-3 boundary if visited before `P22.T06`)* | Reverse-charge self-invoices register (`reverse_charge_due_days` countdown) + manual registration drawer |
| **`SCR-17`** | `#19` | `/accounting/post/self-invoices/[id]` | *(detail of `#18`)* | `self-invoices` (`GET /:id`, `POST /:id/settle`, `2`) | *(Same as `#18`)* | Paired `REVERSE_CHARGE_OUTPUT_VAT` / `REVERSE_CHARGE_INPUT_VAT` tax rows, journal link, and `POST /:id/settle` remittance date dialog |
| **`SCR-19A`** *(Inv. `SCR-19`)* | `#78` | `/accounting/file/authority-documents` | `File` (`accountingAuthorityDocuments`) | `authority-documents` (`L S`, `2`) + `[Full-stage]` `authority/notifications` (`3`) + `late-submission-requests` (`5`) | Outbound `ETA_INVOICE` list & search, status/freeze filters, countdown chips | `INBOUND` & `ETA_RECEIPT` (`ledgerWithheld`) filters, **Callback Notifications** tab (`replay`), **Late-Submission Grants** tab (`create`, `record-approval`, `close`, yearly quota meter) |
| **`SCR-19A`** *(Inv. `SCR-19`)* | `#79` | `/accounting/file/authority-documents/[id]` | *(detail of `#78`)* | `authority-documents` (`G`, `attempts`, `download`, `submit`, `resubmit`, `poll`, `request-cancel`, `decline`, `8` slice + `request-reject`, `1` full) | `DocumentViewer` + `AuthorityTimeline` (`D-518` synthetic head), `submit`, `poll` (`D-395`), `resubmit` (`INVALID` invoice only), `request-cancel` (72h window), `decline` (72h window), signed `INVOICE_LEGAL` `download` | `POST /:id/request-reject` (`INBOUND` 72h window + deemed-acceptance warning `D-108`), `withheld_facts` / `uuidAsserted` / `ledgerSettledAt` POS inspector (`D-671`, `D-673`) |
| **`SCR-19B`** *(Plan `SCR-19` / Inv. `SCR-22`)* | `#2` | `/accounting/inbox/exceptions` | `Home & Inbox` (`accountingExceptions`) | `exception-board` (`GET`, `POST /search`, `POST /:id/assign`, `POST /:id/dismiss`, `4`) | Unified deadline-sorted queue + slide-over `Sheet` inspector, `assign`, `REASON_ONLY` & `NEVER_DISMISSIBLE` handling for slice kinds (`UNPOSTED_DOCUMENT`, `AUTHORITY_PENDING_TIMEOUT`, `AUTHORITY_INVALID`, `CANCELLATION_PENDING`, `RECEIVER_REJECTED`, `POSTING_EXCEPTION`, `BANK_UNMATCHED`) | All 36 MVP `ExceptionBoardKind` variants, `AUTHORITY_REQUEST` (`authorityReference` + `authorityDecision`), `SHIFT_CLOSE_MISSING` (`entryDates` + `POSTING_REDATE`), `CLOSED_BOX_CASH`, and POS `settlement: PosSaleSettlementInput[]` + `leftOutPlaceholderIds` |

> **Allowlist Creation Rule (Zero `/new` Route Segments):** `accounting-ia.md` §5 fixes the 118 App Router paths and forbids `/accounting/post/fiscal-documents/new` or `/accounting/post/self-invoices/new`. Issuing or registering a fiscal document opens `#16` in workspace mode (`/accounting/post/fiscal-documents?mode=new`), and manual self-invoice creation opens a `Drawer` on `#18` (`/accounting/post/self-invoices?drawer=create`).

### 0.3 `ui-ux-pro-max` & Tenant Portal Five-Laws Design Rules

1. **Barrel-Only Design System Consumption:** Feature files import exclusively from `@/design-system` — never from deep `src/design-system/*` paths and never with ad-hoc inline styles.
2. **Four Outcome Color Roles + `ink` Neutral Ramp (`accounting-status-and-a11y.md`):**
   - `positive`: `POSTED`, `VALID`, `SETTLED`, `APPROVED`, `PROCESSED`, `ACCEPTED`, `RESOLVED`.
   - `caution`: `TAX_RESOLVED`, `AWAITING_AUTHORITY`, `PENDING`, `SUBMITTED`, `CANCEL_REQUESTED`, `REJECT_REQUESTED`, `PARKED`, `REQUESTED`, `OPEN` / `ACKNOWLEDGED` (`MEDIUM` / `HIGH`), active window countdowns (`<= 24h` remaining), `FROZEN_TYPE` / `FROZEN_SCOPE` warning callout.
   - `negative`: `INVALID`, `REJECTED` (when an outbound invoice was refused or rejected), `EXPIRED` / `expiredAt != null` overdue stamp, `CRITICAL` severity, `LEGAL_HOLD` active lock badge, `ATTEMPT_OUTCOME: REJECTED | TIMEOUT | TRANSPORT_ERROR`.
   - `neutral` (`ink` ramp): `REGISTERED`, `CANCELLED` (finalized historical), `REVERSED` (retired original), `SUPERSEDED`, `NOT_TRANSMITTED`, `CLOSED`, `LOW` severity, `DUPLICATE` / `RESOLVED_BY_QUERY` informational pills.
   - `brand`: Strictly reserved for active nav/tab indicator, focus ring, and the **at most one filled `primary` button per screen** (in `PageHeader` or `DetailHeader`). Never used on a status badge or pipeline state.
3. **Typography & Density:** Three weights only: `400` (`font-normal`, mandatory on all table/grid body cells), `500` (`font-medium`, field labels, column headers, buttons), `600` (`font-semibold`, screen title, legal total figure). Zero `font-bold`, zero `text-[Npx]`, zero `rounded-xl` or larger (`rounded-md` / `rounded-lg` tokens only).
4. **Logical CSS & Strict Bilingual Parity:** Only `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `text-end`, `border-s-*`, `border-e-*`. **Zero language ternaries** in JSX or hooks; every label, enum value (`t.accounting.enums.<Enum>.<MEMBER>`), waiting-state explanation, and error recovery cue lives in both `ar` and `en` dictionaries.
5. **LTR Islands, Western Digits & Exact Decimal Integrity:** Every `documentNo`, `internalId`, `uuid`, `longId`, `submissionUuid`, `sha256`, `payloadHash`, `certificateThumbprint`, `authorityReference`, ISO date/timestamp, countdown (`HH:MM:SS`), FX rate, and money amount renders inside `<bdi dir="ltr" className="tabular-nums">` formatted via `Intl` with `ar-EG-u-nu-latn` (Arabic) or `en-US` (English). **Never pass a `DecimalString` or `FxRateString` through `Number()` or `parseFloat()`**; client-side line arithmetic uses `BigInt` scaled by `10^8` (`DECIMAL_SCALE = 8`), and every client-generated UUID (`x-idempotency-key`, `sourceRef.sourceId`, `lines[].sourceLineId`) calls `generateUUIDv7()` from `@/lib/uuid` (**never** `crypto.randomUUID()`, which emits v4 and throws over HTTP on `http://<tenant-host>:5002`).

### 0.4 Semantic Theme Token Matrix Referenced in Four-Combination Mockups

| Semantic Token | Light Mode (`light`) | Dark Mode (`dark`) | Surface / Element Role |
| --- | --- | --- | --- |
| `--bg-canvas` / `--bg-surface` | `#F8FAFC` / `#FFFFFF` | `#0B0F17` / `#111827` | Viewport canvas, table surface, `DocumentViewer` panes, `Sheet` / `Drawer` body |
| `--bg-subtle` / `--bg-elevated` | `#F1F5F9` / `#FFFFFF` | `#1E293B` / `#1F2937` | Sticky table headers, `WaitingStateCallout` neutral header, Tax/Totals summary card, modal surface |
| `--ink-primary` / `--ink-secondary` / `--ink-muted` | `#0F172A` / `#475569` / `#64748B` | `#F8FAFC` / `#94A3B8` / `#64748B` | Primary cell values (`400`), labels (`500`), secondary hashes & parameter captions |
| `--border-subtle` / `--border-strong` | `#E2E8F0` / `#CBD5E1` | `#1E293B` / `#334155` | `1px` table dividers, split-pane border, input outlines |
| `--status-positive-{bg,fg,border}` | `#ECFDF5` / `#065F46` / `#A7F3D0` | `#064E3B` / `#6EE7B7` / `#065F46` | `POSTED`, `VALID`, `SETTLED`, `SHA-256 Verified` |
| `--status-caution-{bg,fg,border}` | `#FFFBEB` / `#92400E` / `#FDE68A` | `#451A03` / `#FCD34D` / `#78350F` | `WaitingStateCallout` (`WS-01`..`WS-04`), 72h cancel/reject/decline countdowns, `FROZEN_*` banner |
| `--status-negative-{bg,fg,border}` | `#FEF2F2` / `#991B1B` / `#FECACA` | `#450A0A` / `#FCA5A5` / `#7F1D1D` | `INVALID` findings, `CRITICAL` / `expiredAt` overdue badge, `LEGAL_HOLD`, `AccountingErrorAlert` |
| `--brand-solid` / `--brand-fg` | `#0284C7` / `#FFFFFF` | `#38BDF8` / `#0B0F17` | Single `variant="primary"` CTA, active tab underline, `:focus-visible` ring |

### 0.5 Reused Approved Pattern Components (Never Redesigned)

| Approved Component | Source Spec | Reuse across `SCR-17`, `SCR-19A`, `SCR-19B` |
| --- | --- | --- |
| `PageHeader`, `DetailHeader`, `FilterBar`, `DataTable`, `Sheet`, `Drawer`, `Tabs`, `Card`, `Callout`, `EmptyState`, `Skeleton`, `PermissionGate` | `@/design-system` + `accounting-ia.md` | List/detail shells, status filter tabs, `#2` slide-over inspector (`Sheet`), creation/action drawers |
| `DocumentViewer` + `AuthorityTimeline` | `accounting-patterns-documents.md` §1 | `#79` Authority Document split inspector (`7/12` document/validation summary + `5/12` append-only attempts & synthetic `PENDING` head node `D-518`) |
| `WaitingStateBadge` + `WaitingStateCallout` | `accounting-patterns-documents.md` §2 | Mandatory 4-element strip (`What we wait on`, `Deadline + frozen parameter snapshot`, `Owner`, `Safe next action — never resend`) across `#17`, `#79`, `#2` |
| `AttachmentList` | `accounting-patterns-documents.md` §3 | `#17` & `#79` legal/supporting attachments with client-side WebCrypto SHA-256 pre-hash, `retentionUntil` badge, `protectedAfterPosting` lock, and `[Full-stage]` `legalHold` toggle |
| `AccountingErrorAlert` + `AmbiguousOutcomePanel` + `ConflictDialog` | `accounting-patterns-documents.md` §4 & `accounting-patterns-workflow.md` | 3-part `Cause + Effect + SafeAction` error banner with copyable `correlationId`; `503 DEPENDENCY_UNAVAILABLE` / client-timeout recovery without resending; `409 STALE_VERSION` reload diff |
| `ReasonDialog` | `accounting-patterns-workflow.md` | Mandatory trimmed `reason` (`10..1,000` chars; `10..500` on `CreateLateSubmissionRequestDto`) with live character counter and consequence callout |
| `Money`, `MoneyInput`, `FxRateStrip` | `accounting-patterns-data.md` `UX-07` | Exact `DecimalString` display/input, 5-decimal authority truncation preview (`max_precision_decimals`), pinned `fxRateId` resolution via `POST /accounting/fx-rates/resolve` |
| `PartyPicker`, `AccountPicker`, `FiscalPeriodPicker` | `accounting-patterns-data.md` `UX-08` | `PartyPicker` -> `POST /accounting/party-finance-profiles/lookup` (**never** Core `/parties`); `AccountPicker` -> `POST /accounting/accounts/lookup` |
| `ApprovalPanel`, `AsyncProgressCard`, `LedgerDrillDrawer` | `accounting-patterns-workflow.md` `UX-09`, `UX-10` | `approval_request_id` gate on `#17` (`D-393`); `POST /fiscal-documents/export` `202` progress card; inline journal preview for `postedEntryId` / `reversalEntryId` |

### 0.6 Feature-Folder File & Hook Architecture (`< 300` Lines per File)

```text
src/features/accounting-documents/
├── api/
│   ├── fiscalDocumentsApi.ts        # /api/tenant/accounting/v1/fiscal-documents*, self-invoices*, attachments*
│   ├── authorityDocumentsApi.ts     # /api/tenant/accounting/v1/authority-documents*, authority/notifications*, late-submission-requests*
│   ├── exceptionBoardApi.ts         # /api/tenant/accounting/v1/exception-board*
│   └── validators.ts                # Runtime validators (SuccessResponseDto<T>, ETag extraction, SignedDownloadDto, PollResult)
├── hooks/
│   ├── useFiscalDocumentsList.ts    # #16 list, search, POST /count tabs, async export
│   ├── useIssueFiscalDocument.ts    # #16?mode=new D-724 form, BigInt(10^8) line math, POST /tax/evaluate preview, UUIDv7 intent/idempotency
│   ├── useFiscalDocumentDetail.ts   # #17 detail + ETag, lines, derive-kind dry-run, resolve-tax, post, cancel, attachments
│   ├── useSelfInvoices.ts           # [Full-stage P22.T06] #18 list/create & #19 detail/settle
│   ├── useAuthorityDocumentsList.ts # #78 list/search + [Full-stage P22.T04] Notifications & Late-Submission tabs
│   ├── useAuthorityDocumentDetail.ts# #79 detail + ETag, attempts (+ D-518 head), submit, poll (D-395), resubmit, cancel/decline/reject windows, download
│   └── useExceptionBoard.ts         # #2 list/search, Sheet inspector state, assign, 5 dismissibility archetypes & 409 conflict handler
└── components/
    ├── FiscalDocumentsListView.tsx
    ├── IssueFiscalDocumentWorkspace.tsx
    ├── FiscalDocumentDetailView.tsx
    ├── FiscalDocumentTaxReceiptTab.tsx
    ├── SelfInvoicesListView.tsx
    ├── SelfInvoiceDetailView.tsx
    ├── AuthorityDocumentsListView.tsx
    ├── AuthorityDocumentDetailView.tsx
    ├── AuthorityActionDialogs.tsx   # SubmitDialog, ResubmitDialog, WindowReasonDialog
    ├── AuthorityNotificationsTab.tsx
    ├── LateSubmissionRequestsTab.tsx
    ├── ExceptionBoardView.tsx
    ├── ExceptionInspectorSheet.tsx
    └── ExceptionPosSettlementForm.tsx
```

---

## 1. `SCR-17` — Fiscal Documents (`#16`, `#17`), Shared Attachments & `[Full-Stage]` Self-Invoices (`#18`, `#19`)

### 1.1 Purpose, Traceability & Delivery Split

- **Screen ID:** `SCR-17` (`accounting-screen-inventory.md` row `SCR-17`, `[P: 21]`)
- **Allowlisted Routes:**
  - `#16` `/accounting/post/fiscal-documents` (`?mode=new` opens the Accounting-Issued / Registered Document Workspace, `D-724`)
  - `#17` `/accounting/post/fiscal-documents/[id]`
  - `#18` `/accounting/post/self-invoices` **`[Full stage completion — P22.T06]`**
  - `#19` `/accounting/post/self-invoices/[id]` **`[Full stage completion — P22.T06]`**
- **Traceability:** `UC-DOC-1` (`04_fiscal_documents_and_authority.md` §9), §8 rule 1 (`D-082`, `D-138` 7-rule `DocumentKind` derivation), rule 2 (`D-083`, `D-087` national ID threshold), rule 3 & 10 (`D-123`, `D-759` note guards & cumulative `credited_to_date` ceiling), rule 6 (`D-107` content freeze at `TAX_RESOLVED`; submitted kinds post only on `VALID`), rule 7 (`D-393` approval gate), rule 13 (`D-109`, `D-121` input-tax evidence & reverse-charge self-invoice), rule 14 (`D-081`, `D-148` legal attachment retention & hold), rule 17 (`D-724`, `D-692`, `D-758` Accounting-issued sales documents & supplier bills); Journey `02_User_Journey_Sales_Invoice_To_Posting.md` & `03_User_Journey_Authority_Clearance.md`.

| Capability | `[Slice subset — P18.T07]` | `[Full stage completion — P22.T06]` |
| --- | --- | --- |
| `#16` Fiscal Documents Register | `GET /fiscal-documents`, `POST /search`, `POST /count` status tabs, `POST /export` (`CSV`/`XLSX`) | Filter by `sourceApp` (`trade`, `crm`, `hr`, `import`), `SELF_INVOICE` / `RECEIPT` / `RETURN_RECEIPT` kinds |
| `#16?mode=new` Issue / Register Workspace (`D-724`) | **Accounting Sales Invoice** (`sourceRef.sourceApp = 'accounting'`, `sourceType = 'SALES_INVOICE'`), server-assigned `SIN-{YYYY}-NNNNNN` (`documentNo` omitted), EGP & FX (`POST /fx-rates/resolve`), service lines (`trackInventory: false`, `taxStatus` required, Egypt pack `itemRef` + `uom`), live preview via `POST /tax/evaluate` (`taxFinal: false`) | Sales `CREDIT_NOTE` (`SCN-`) & `DEBIT_NOTE` (`SDN-`) with `references[]` + `referencedLineNo`; Accounting-registered `PURCHASE_BILL` & `SUPPLIER_CREDIT_NOTE` (supplier `documentNo` required + `inputTaxEvidence` + `evidenceRef`); line `deferral` & `constructionAssetId` |
| `#17` Fiscal Document Detail | Header + `ETag`, `GET /:id/lines`, frozen `derivationReceipt` + dry-run `POST /:id/derive-kind`, `POST /:id/resolve-tax` (when `REGISTERED`), `POST /:id/post` (only non-submitted kinds in `TAX_RESOLVED`, e.g. `COMMERCIAL`), `POST /:id/cancel`, CTA to `#79` for authority submission (`SubmitAuthorityDocumentDto`), `LedgerDrillDrawer` for `postedEntryId` / `reversalEntryId` | `ApprovalPanel` (`UX-10`) when `approvalRequestId != null` (`D-393`), `GET /source-document-links` upstream badge, supersession chain (`supersededById` / `sourceVersion`), `originalPeriodId` late-posting redirection badge |
| Shared `AttachmentList` (`#17` & `#79`) | `GET /attachments`, `GET /attachments/:id`, `GET /attachments/:id/download` (`SignedDownloadDto` + SHA-256 display), `POST /attachments` (multipart + client SHA-256), `DELETE /attachments/:id` (`If-Match`, blocked when `protectedAfterPosting` or `legalHold`) | `POST /attachments/:id/legal-hold` (`TENANT` scope, `accounting.attachment.legal_hold`; see `CG-SLICE-DOC-02` for DTO body) |
| `#18` & `#19` Self-Invoices | Not active in slice (renders Stage-3 feature boundary if navigated directly) | `#18` list + manual `POST /self-invoices` drawer; `#19` detail + `POST /self-invoices/:id/settle` (`SettleSelfInvoiceDto`) |

### 1.2 Layout & Progressive Disclosure

#### A. `#16` `/accounting/post/fiscal-documents` — Register View
1. **`PageHeader`:**
   - Title: `المستندات الضريبية والمحاسبية` / `Fiscal Documents`.
   - Subtitle: Active Company + Branch scope pill (`COMPANY_OR_BRANCH`).
   - **Single `primary` CTA:** `+ إصدار مستند ضريبي` / `+ Issue Fiscal Document` (navigates to `/accounting/post/fiscal-documents?mode=new`; visible when `hasPermission('accounting.fiscal_document.register')`; disabled with Recovery Mode tooltip when `recoveryMode === true`).
   - Secondary header action (`outline`): `تصدير` / `Export` -> opens format popover (`CSV` | `XLSX`) calling `POST /api/tenant/accounting/v1/fiscal-documents/export` (`202` -> mounts `AsyncProgressCard`).
2. **Status Filter Tabs (`Tabs` + `POST /fiscal-documents/count` badges):**
   - `الكل` / `All` · `مسجل (ضريبة معلقة)` / `Registered` (`REGISTERED`) · `تم احتساب الضريبة` / `Tax Resolved` (`TAX_RESOLVED`) · `بانتظار مصلحة الضرائب` / `Awaiting Authority` (`AWAITING_AUTHORITY`) · `مرحّل` / `Posted` (`POSTED`) · `ملغى / معكوس / مرفوض` / `Cancelled & Rejected` (`CANCELLED`, `REVERSED`, `REJECTED`, `SUPERSEDED`).
   - Tab counts call `POST /api/tenant/accounting/v1/fiscal-documents/count` with the active filter subset.
3. **`FilterBar`:**
   - Search box (`POST /fiscal-documents/search` on `documentNo`, `sourceRef.sourceId`, `intentKey`; debounced `300ms`).
   - Structured filters (`FiscalDocumentListQueryDto`): `documentKind` multi-select (`DocumentKind`), `partyId` (`PartyPicker`), `branchId` (when operating at `COMPANY` scope), `receiverType` (`B | P | F`), `sourceApp` (`accounting | trade | crm | hr | import`), `fromIssueDate`..`toIssueDate` date-range picker.
4. **`DataTable` (`38px` compact row height, keyset `cursor` pagination):**
   - Columns (all body cells `font-normal` `400`, numbers/IDs in `<bdi dir="ltr" className="tabular-nums">`):
     1. `رقم المستند` / `Document No.` (`documentNo`, link to `#17` `/accounting/post/fiscal-documents/${id}`; shows `v${sourceVersion}` pill when `sourceVersion > 1`).
     2. `النوع القانوني المستنتج` / `Derived Kind` (`documentKind` localized badge via `t.accounting.enums.DocumentKind.*` — never raw wire text).
     3. `الطرف` / `Party` (`partyId` resolved display label + `receiverType` chip `B`/`P`/`F`).
     4. `تاريخ الإصدار` / `Issue Date` (`issueDate`, LTR ISO date).
     5. `المصدر / القناة` / `Source & Channel` (`sourceApp` + `issuanceChannel`).
     6. `الإجمالي قبل الضريبة` / `Excl. Tax` (`grossTotalExcludingTax` + `currencyCode`, end-aligned `Money`).
     7. `الضريبة` / `Tax Total` (`taxTotal`, end-aligned `Money`).
     8. `الصافي القانوني` / `Legal Total` (`legalTotalRounded`, end-aligned `Money` `font-medium` only in footer summary, `400` in body).
     9. `الحالة` / `Status` (`FiscalDocumentStatus` `StatusBadge` + `WaitingStateBadge` clock icon when `AWAITING_AUTHORITY`).

#### B. `#16?mode=new` — Accounting-Issued / Registered Fiscal Document Workspace (`D-724`)
- Replaces the list body with a two-column responsive form (`8/12` document & line editor + `4/12` sticky **Live Statutory Derivation & Tax Preview Rail**):
  - **Document Class Selector (UI intent -> `sourceRef.sourceType`, never `documentKind`):**
    - **`[Slice subset — P18]`:** `فاتورة مبيعات خدمية` / `Sales Service Invoice` (`sourceType = 'SALES_INVOICE'`). `documentNo` input is **hidden and omitted from payload** (displays read-only helper badge: `يُرقّم تلقائياً من السلسلة القانونية عند الحفظ (مثال: SIN-2026-000001)` / `Auto-numbered from the legal series on registration (e.g. SIN-2026-000001)`, `D-758`).
    - **`[Full stage completion — P22.T06]`:** Adds segmented choices for `إشعار دائن مبيعات` / `Sales Credit Note` (`CREDIT_NOTE`), `إشعار مدين مبيعات` / `Sales Debit Note` (`DEBIT_NOTE`) — both auto-numbered (`SCN-`, `SDN-`) and revealing the mandatory **Referenced Originals (`references[]`)** picker — plus `فاتورة مشتريات مورد` / `Supplier Bill` (`PURCHASE_BILL`) and `إشعار دائن مورد` / `Supplier Credit Note` (`SUPPLIER_CREDIT_NOTE`), which **require** supplier `documentNo` (`max 40 chars`), `inputTaxEvidence` (`ETA_INVOICE | CUSTOMS_DECLARATION | REVERSE_CHARGE_SELF_INVOICE | NONE`), and `evidenceRef`.
  - **Callout Banner (`D-724` Non-Stock Invariant):** Informative subtle callout stating that Accounting-issued documents cover **services, expenses, and fixed-asset lines only** (`trackInventory` is strictly `false`; goods/inventory invoices belong to Trade).
  - **Header Card:** `branchId` selector, `partyId` (`PartyPicker` via `POST /accounting/party-finance-profiles/lookup`), `documentDatetimeUtc` (company-timezone datetime picker that deterministically derives `issueDate` in company local time so `ISSUE_DATE_MISMATCH` cannot occur, `D-126`, `D-386`), `economicEventAt` (optional supply completion timestamp for period-end accrual, `D-248`), `issuanceChannel` (`ERP` default in slice), `isExport` switch, `currencyCode` + `FxRateStrip` (resolves `fxRateId` via `POST /accounting/fx-rates/resolve` when `currencyCode !== functionalCurrency`, checking `scale <= 5` for authority-submitted kinds, `D-385`), optional `contractDate`, and pre-upload `attachments[]` (`AttachmentList` staging).
  - **Service Lines Grid (`lines: FiscalDocumentLineInput[]`):**
    - Columns: `#` (`lineNo`), `البند / الكود المعتمد` / `Item / Authority Code` (`itemRef`: `itemType` `EGS|GS1`, `itemCode`, `internalCode`, `unitType`), `الوحدة` / `UoM` (`uom` when `itemRef.unitType` is absent, `D-753`), `الوصف` / `Description`, `الكمية` / `Qty` (`quantity`), `سعر الوحدة` / `Unit Price` (`unitPrice`), `خصم البند` / `Item Discount` (`itemsDiscount`), `المعاملة الضريبية` / `Tax Category` (`taxStatus`: `STANDARD | ZERO_RATED | EXEMPT | OUT_OF_SCOPE | REVERSE_CHARGE`, mandatory on `sourceApp = 'accounting'` lines, `D-724`), `الحساب` / `Account Hint` (`accountId` via `AccountPicker`), `الصافي` / `Net Amount` (`netAmount` exact `BigInt(10^8)`).
    - Expandable row drawer `[Full-stage P22.T06]`: `referencedLineNo` (for single-reference notes), `valueDifference`, `deferral` (`templateId`, `serviceFrom`, `serviceTo`), `constructionAssetId`.
  - **Sticky Right/End Preview Rail (`4/12`):**
    - **1. Derived Legal Kind Card (`D-082`):** Shows the expected `DocumentKind` (`TAX_INVOICE`, `EXPORT_INVOICE`, `COMMERCIAL`, `SELF_INVOICE`) and receiver/registration facts, explicitly noting: *Derived by statutory rule ladder — never manually selected*. Also warns immediately if `receiverType === 'P'` and EGP gross reaches `national_id_threshold_invoice` (`D-087`).
    - **2. Live Tax Engine Preview (`POST /accounting/tax/evaluate`):** Button `معاينة الضريبة` / `Preview Tax` (and auto-refresh on blur) runs the exact Module 03 pipeline (`taxFinal: false`, `D-131`), displaying the 5-tier Egyptian tax breakdown (Schedule Tax -> VAT 14% -> WHT `REDUCES_SETTLEMENT` -> Stamp Duty) and computed `grossTotalExcludingTax`, `taxTotal`, `grossTotal`, `settlementTotal`, and `legalTotalRounded`.
    - **Single `primary` CTA in `DetailHeader`:** `تسجيل المستند واعتماد الضريبة` / `Register Document` -> `POST /api/tenant/accounting/v1/fiscal-documents` (`201 Created` -> redirects to `#17` `/accounting/post/fiscal-documents/${data.id}`).

#### C. `#17` `/accounting/post/fiscal-documents/[id]` — Fiscal Document Detail View
1. **`DetailHeader`:**
   - Breadcrumb: `المستندات الضريبية` / `Fiscal Documents` -> `<bdi dir="ltr">{documentNo}</bdi>`.
   - Badges: `FiscalDocumentStatus` `StatusBadge` + `DocumentKind` badge + `Frozen after TAX_RESOLVED` lock pill (`taxResolvedAt != null`, `D-107`).
   - **Context-Sensitive Single `primary` CTA** (at most one rendered at any status):
     - Status `REGISTERED` (`TAX_UNRESOLVED` exception open): **`إعادة احتساب الضريبة` / `Resolve Tax`** (`POST /fiscal-documents/:id/resolve-tax`, `If-Match`).
     - Status `TAX_RESOLVED` **and** submittable authority kind (`TAX_INVOICE`, `SIMPLIFIED_TAX_INVOICE`, `EXPORT_INVOICE`, `PREPAYMENT_INVOICE`, `CREDIT_NOTE`, `DEBIT_NOTE` under `EG` pack) **and** (`approvalRequestId == null` or approved): **`إرسال لمصلحة الضرائب` / `Submit to Authority`** (opens `SubmitAuthorityDocumentDialog` -> `POST /fiscal-documents/:id/submit`, `If-Match` = the fiscal document's `version`; the command inserts the outbound authority document and its `Location` names it, `CG-SLICE-DOC-03`, closed by `D-772`).
     - Status `TAX_RESOLVED` **and** non-submitted kind (`COMMERCIAL` or purchase bill) **and** (`approvalRequestId == null` or approved): **`ترحيل للأستاذ العام` / `Post to Ledger`** (`POST /fiscal-documents/:id/post`, `If-Match`).
     - Status `AWAITING_AUTHORITY` or `POSTED` with `authorityDocumentId != null`: **`فتح مستند مصلحة الضرائب` / `Open Authority Document`** (`Link` to `#79` `/accounting/file/authority-documents/${authorityDocumentId}`).
   - **Secondary (`outline` / `destructive` overflow) actions:**
     - `معاينة استنتاج النوع` / `Verify Kind Derivation` (`POST /fiscal-documents/:id/derive-kind`, read-like dry run).
     - `عرض قيد اليومية` / `View Journal Entry` (opens `LedgerDrillDrawer` or navigates to `#15` `/accounting/post/journal-entries/${postedEntryId}` when `postedEntryId != null`; also shows `reversalEntryId` chip when reversed/cancelled).
     - `إلغاء المستند محلياً` / `Cancel Document` (`POST /fiscal-documents/:id/cancel`, `accounting.fiscal_document.reverse`, `If-Match`; hidden/disabled when `authorityDocumentId != null` and authority status is `VALID`/`SUBMITTED`/`CANCEL_REQUESTED`, directing operator to `#79` `Request Cancel` or Credit Note per `D-110`).
2. **Conditional Top Banners:**
   - `WaitingStateCallout` (`WS-01` / `WS-02` / `WS-03`) when `status === 'AWAITING_AUTHORITY'` or `approvalRequestId` is pending (`D-393`).
   - Legacy Original read-only banner when `isLegacyOriginal === true` (`D-759`: *"مستند أصلي مرحّل قبل بدء التشغيل لضبط سقف الإشعارات؛ لا يقبل الترحيل أو الإرسال أو الإلغاء"* / *"Pre-go-live legacy original bounding credit/debit notes; commands are disabled"*).
3. **Summary Strip (`Card` 4-metric bar):** `Excl. Tax` (`grossTotalExcludingTax`), `Tax Total` (`taxTotal`), `Gross Total` (`grossTotal` + `roundingDifference`), and **`Settlement Total` (`settlementTotal` = `grossTotal − WHT`, `D-129`)** in document currency + `fxRateSnapshot` strip when foreign currency.
4. **Five Progressive-Disclosure `Tabs`:**
   - **Tab 1 — `البنود والإجماليات` / `Lines & Totals`:** Read-only `DataTable` from `GET /fiscal-documents/:id/lines` (`lineNo`, `itemType:itemCode` / `internalCode`, `description`, `quantity`, `unitType`, `unitPrice`, `itemsDiscount`, `extraDiscountShare`, `taxableAmount`, `taxTotal`, `withholdingTotal`, `lineTotal`, foreign-currency `amountSold`/`currencySold`/`currencyExchangeRate`).
   - **Tab 2 — `إيصال استنتاج النوع والضريبة` / `Kind & Tax Receipt`:** Displays frozen `derivationRuleCode` + structured `derivationReceipt` JSON inspector (issuer RIN, card status, receiver type, channel, e-receipt enrolment, `isExport`, national ID threshold snapshot) + Dry-Run Compare button (`POST /:id/derive-kind`), alongside `GET /accounting/tax/decision-receipts` (4 deterministic SHA-256 hashes: `ruleSetContentHash`, `factSchemaHash`, `engineVersion`, `inputSnapshotHash`).
   - **Tab 3 — `مصلحة الضرائب والمصدر` / `Authority & Provenance`:** Summary card linking `authorityDocumentId` -> `#79`, `postedEntryId` -> `#15`, `reversalEntryId` -> `#15`, `originalPeriodId` redirection badge, `sourceRef` triple (`sourceApp:sourceType:sourceId v{sourceVersion}`), `payloadHash` copy pill, and `[Full-stage]` `GET /source-document-links` + `supersededById` link.
   - **Tab 4 — `المرفقات والحفظ القانوني` / `Attachments & Retention` (`AttachmentList`):** Lists `GET /accounting/attachments?resType=fiscal_document&resId=${id}`. Shows `fileName`, `docClass` (`INVOICE_LEGAL | SUPPORTING | GENERAL`), `sizeBytes`, `sha256` copy chip, `retentionUntil` (`5 years` snapshot `retentionYearsSnapshot`, `D-148`), `protectedAfterPosting` lock icon, `legalHold` badge (`D-081`), `Upload` button (`POST /attachments`), `Download` (`GET /attachments/:id/download`), `Delete` (`DELETE /attachments/:id`, disabled when `protectedAfterPosting && status === 'POSTED'` or `legalHold`), and `[Full-stage P22.T06]` `Place / Lift Legal Hold` (`POST /attachments/:id/legal-hold`, `TENANT` scope).

#### D. `[Full stage completion — P22.T06]` `#18` `/accounting/post/self-invoices` & `#19` `/accounting/post/self-invoices/[id]`
- **`#18` Self-Invoices List:** `PageHeader` (`الفواتير الذاتية للتكليف العكسي` / `Reverse-Charge Self-Invoices`, single `primary` CTA `+ تسجيل فاتورة ذاتية` / `+ Register Self-Invoice` opening create drawer when `hasPermission('accounting.fiscal_document.register')`), `FilterBar`, and `DataTable` (`GET /accounting/self-invoices`) showing `fiscalDocumentId` link (`#17`), `sourceFiscalDocumentId` purchase link (`#17`), `supplierPartyId` (`F` without SRR), `taxPointDate`, **`dueDate` (`taxPointDate + reverseChargeDueDaysSnapshot`, 30-day statutory per-transaction deadline, `D-121`)**, `taxableBase`, `taxAmount`, `currencyCode`, `status` (`POSTED | SETTLED | CANCELLED`), `settledAt`.
- **`#19` Self-Invoice Detail:** `DetailHeader` with single `primary` CTA **`إثبات سداد ضريبة التكليف العكسي` / `Record Tax Remittance`** (visible when `status === 'POSTED'` and `hasPermission('accounting.fiscal_document.post')`), opening `SettleSelfInvoiceDialog` (`settledAt: ISODate`, `>= taxPointDate` and `<= today`, calling `POST /accounting/self-invoices/:id/settle` with `If-Match`). Body cards show the paired tax transactions (`outputTaxTransactionId` `REVERSE_CHARGE_OUTPUT_VAT` and `inputTaxTransactionId` `REVERSE_CHARGE_INPUT_VAT`, `D-070`), `journalEntryId` (`#15`), `complianceItemId` (`REVERSE_CHARGE_DUE`), and `authorityDocumentId` (when `submittedToAuthority === true`).

### 1.3 Complete Field-to-DTO Mapping (`SCR-17`)

#### 1.3.1 Query & Search DTOs (`#16` & Attachments)

| UI Control (`AR` / `EN`) | DTO & Member (`02_DTOs.md` §7.1) | Type & Validation | Notes |
| --- | --- | --- | --- |
| بحث نصي / Search | `FiscalDocumentSearchDto.query` (`SearchManyDto`) | `string` | Allowlisted header fields + `sourceApp`, `sourceType`, `sourceId`, `document_no` |
| تطبيق المصدر / Source App | `FiscalDocumentListQueryDto.sourceApp` | `SourceApp?` (`accounting \| trade \| crm \| hr \| manufacturing \| import`) | Slice uses `accounting` |
| نوع المصدر / Source Type | `FiscalDocumentListQueryDto.sourceType` | `string?` | e.g. `SALES_INVOICE`, `CREDIT_NOTE`, `PURCHASE_BILL` |
| النوع القانوني / Document Kind | `FiscalDocumentListQueryDto.documentKind` | `DocumentKind?` | All 11 enum members localized |
| الحالة / Status | `FiscalDocumentListQueryDto.status` | `FiscalDocumentStatus?` | `REGISTERED \| TAX_RESOLVED \| AWAITING_AUTHORITY \| POSTED \| REVERSED \| REJECTED \| CANCELLED \| SUPERSEDED` |
| الطرف / Party | `FiscalDocumentListQueryDto.partyId` | `UUID?` | Selected via `POST /accounting/party-finance-profiles/lookup` |
| الفرع / Branch | `FiscalDocumentListQueryDto.branchId` | `UUID?` | Scoped to active company |
| من تاريخ — إلى تاريخ / Issue Date Range | `fromIssueDate`, `toIssueDate` | `ISODate?` | `YYYY-MM-DD` |
| فئة المتلقي / Receiver Type | `FiscalDocumentListQueryDto.receiverType` | `ReceiverType?` (`B \| P \| F`) | Business/Gov (`B`), Person (`P`), Foreigner (`F`) |
| مؤشر التصفح / Keyset Cursor | `FiscalDocumentListQueryDto.cursor` | `string?` | Keyset pagination |
| فلتر المرفقات / Attachment Query | `AttachmentListQueryDto` | `{ resType: string, resId: UUID, docClass?: AttachmentClass, legalHold?: boolean }` | `resType = 'fiscal_document'` on `#17` |

#### 1.3.2 Registration Request (`#16?mode=new` -> `RegisterFiscalDocumentDto`, `02_DTOs.md` §7.2)

| UI Field (`AR` / `EN`) | Exact DTO Path | Type & Constraints | Slice vs Full-Stage & Server Rules |
| --- | --- | --- | --- |
| فئة المستند / Document Class | `sourceRef.sourceApp`, `sourceRef.sourceType`, `sourceRef.sourceId`, `sourceRef.sourceVersion` | `TripleReference` (`sourceApp: 'accounting'`, `sourceId: UUIDv7`, `sourceVersion: 1`) | `[Slice]`: `sourceType = 'SALES_INVOICE'`. `[Full-stage]`: adds `CREDIT_NOTE`, `DEBIT_NOTE`, `PURCHASE_BILL`, `SUPPLIER_CREDIT_NOTE` (`D-724`) |
| مفتاح القصد المستقر / Intent Key | `intentKey` | `string`, `^[A-Za-z0-9:_.-]{1,160}$` | Generated once per form open (`accounting:${sourceType}:${sourceId}:v1`), preserved across retries |
| رقم المستند المورد / Supplier Document No. | `documentNo` | `string?`, `max 40 chars` | **MUST be omitted** on Accounting sales invoices/notes (`400 VALIDATION.FAILED` if sent; server assigns `SIN-`/`SCN-`/`SDN-`, `D-758`). **Required** on Accounting supplier bills/notes (`D-724`) |
| تاريخ ووقت الإصدار / Issue Datetime | `documentDatetimeUtc` + `issueDate` | `ISO8601` (UTC, `<= now`) + `ISODate` | `issueDate` MUST equal company-local date of `documentDatetimeUtc` (`ISSUE_DATE_MISMATCH`, `D-126`) |
| تاريخ تحقق التوريد / Supply Event Time | `economicEventAt` | `ISO8601 \| null?` (`<= now`) | Optional; governs period-end unbilled accrual (`D-248`) |
| العميل / المورد / Counterparty | `partyId` | `UUID` | Picked from `POST /accounting/party-finance-profiles/lookup` |
| الفرع المُصدر / Issuing Branch | `branchId` | `UUID` | Branch with configured `branch_fiscal_profiles` |
| قناة الإصدار / Issuance Channel | `issuanceChannel` | `IssuanceChannel` (`ERP \| POS \| API \| IMPORT \| PORTAL`) | Default `ERP` on `#16?mode=new` |
| عملية تصدير / Export Supply | `isExport` | `boolean?` (strict boolean) | Derivation fact (`EXPORT_INVOICE` when foreign + export, `D-388`) |
| العملة وسعر الصرف / Currency & FX Pin | `currencyCode`, `fxRateId` | `CurrencyCode`, `UUID?` | `fxRateId` required when `currencyCode !== functionalCurrency` (`D-122`); `<= 5` decimals on authority kinds (`D-385`) |
| تاريخ العقد الانتقالي / Contract Date | `contractDate` | `ISODate?` | Optional transitional-rule tax fact |
| المستندات المرجعية / Referenced Originals | `references[]` | `DocumentReferenceInput[]?` (`1..20`: `referencedDocumentId?`, `referencedAuthorityUuid?`, `reason?`) | `[Full-stage]`: Required on `CREDIT_NOTE` & `DEBIT_NOTE` (`D-123`, `D-759`) |
| مستند إثبات ضريبة المدخلات / Input Tax Evidence | `inputTaxEvidence`, `evidenceRef` | `InputTaxEvidence?`, `string?` (`max 255`) | `[Full-stage]`: Purchases only (`D-109`); `evidenceRef` required unless `NONE` |
| المرفقات المبدئية / Staged Attachments | `attachments[]` | `UUID[]?` (`max 20`) | IDs returned by `POST /accounting/attachments` |
| إجماليات البنود / Header Totals | `totals.{netTotal, itemsDiscountTotal, extraDiscountAmount, grossTotalExcludingTax}` | `DecimalString` (`scale <= 8`, `>= 0`) | Computed client-side via `BigInt(10^8)` and re-verified by server (`D-124`) |
| رقم السطر وهويته / Line No. & Identity | `lines[].lineNo`, `lines[].sourceLineId` | `number` (`1..MAX_LINES_PER_DOCUMENT`), `UUID` (`generateUUIDv7()`) | Dense `1..N` |
| سطر المستند الأصلي / Referenced Line No. | `lines[].referencedLineNo` | `number?` | `[Full-stage]`: Single-reference notes when item identity is absent (`D-759`) |
| مرجع الصنف والكود المعتمد / Item Reference | `lines[].itemRef` | `ItemReferenceInput?` (`{ itemType?, itemCode?, unitType?, internalCode?, itemId?, itemClass?, mappingKey? }`) | Required under `EG` statutory rules (`EGS`/`GS1` + `itemCode` + `unitType`, `D-090`, `D-753`) |
| وحدة القياس / UoM | `lines[].uom` | `string?` (`^[A-Z0-9_]{1,16}$`) | Required when `itemRef` is absent or omits `unitType`; forbidden alongside `itemRef.unitType` (`D-753`) |
| المعاملة الضريبية للسطر / Line Tax Status | `lines[].taxStatus` | `TaxStatus` (`STANDARD \| REDUCED \| ZERO_RATED \| EXEMPT \| OUT_OF_SCOPE \| REVERSE_CHARGE \| NOT_SUBJECT \| DEFERRED`) | **Required** on every `sourceApp = 'accounting'` line (`D-724`) |
| البيان، الكمية، السعر، الخصم / Line Amounts | `lines[].{description?, quantity, unitPrice, netAmount, itemsDiscount?, valueDifference?}` | `string?` (`max 512`), `DecimalString` (`scale <= 8`) | `quantity > 0`; `trackInventory` MUST remain omitted or `false` (`D-724`) |
| مبالغ العملة الأجنبية للسطر / Foreign Line Pin | `lines[].{amountSold?, currencySold?, currencyExchangeRate?}` | `DecimalString?`, `CurrencyCode?`, `FxRateString?` | Present together when `currencyCode !== 'EGP'` (`D-122`, `D-385`) |
| الحساب / التأجيل / أصل تحت الإنشاء | `lines[].{accountId?, deferral?, constructionAssetId?}` | `UUID?`, `DeferralLineHintInput?`, `UUID?` | `accountId` in slice; `deferral` & `constructionAssetId` in `[Full-stage P22.T06]` |

> **Forbidden Request Fields (`forbidNonWhitelisted`, `02_DTOs.md` §7.4):** Never send `documentKind`, `derivationReceipt`, `taxTotal`, `grossTotal`, `settlementTotal`, `legalTotalRounded`, `roundingDifference`, `nationalIdRequired`, `payloadHash`, `status`, `postedEntryId`, `reversalEntryId`, or `trackInventory: true` (when `sourceApp = 'accounting'`).

#### 1.3.3 Read Projections & Command Payloads (`#17`, Attachments, `#18`/`#19` Self-Invoices)

- **`FiscalDocumentDetailDto` & `FiscalDocumentSummaryDto` (`02_DTOs.md` §13.1 over `acc_fiscal_documents`):**
  `id`, `companyId`, `branchId`, `sourceApp`, `sourceType`, `sourceId`, `sourceVersion`, `isLegacyOriginal`, `legacyAuthorityUuid`, `priorCreditedTotal`, `intentKey`, `documentNo`, `documentKind`, `derivationRuleCode`, `derivationReceipt` *(Detail only)*, `issuanceChannel`, `isExport`, `registrationId`, `partyId`, `receiverType`, `receiverCountry`, `receiverTaxId`, `receiverNationalId` *(masked unless sensitive-field permission, `D-128`)*, `nationalIdRequired`, `issueDate`, `documentDatetimeUtc`, `taxPointDate`, `economicEventAt`, `contractDate`, `currencyCode`, `fxRateId`, `fxRateSnapshot`, `netTotal`, `itemsDiscountTotal`, `extraDiscountAmount`, `grossTotalExcludingTax`, `taxTotal`, `withholdingTotal`, `grossTotal`, `settlementTotal`, `legalTotalRounded`, `roundingDifference`, `posTenders` *(Detail only)*, `onAccountAmount`, `inputTaxEvidence`, `evidenceRef`, `references` *(Detail only)*, `status`, `authorityDocumentId`, `postedEntryId`, `reversalEntryId`, `approvalRequestId`, `postingGroupId`, `originalPeriodId`, `supersededById`, `payloadHash`, `taxResolvedAt`, `postedAt`, `correlationId`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `version` (+ `ETag` response header).
- **`FiscalDocumentLineDto` (`GET /fiscal-documents/:id/lines` over `acc_fiscal_document_lines`):**
  `id`, `fiscalDocumentId`, `lineNo`, `sourceLineId`, `referencedLineNo`, `itemId`, `internalCode`, `itemType`, `itemCode`, `unitType`, `description`, `quantity`, `unitPrice`, `netAmount`, `itemsDiscount`, `extraDiscountShare`, `valueDifference`, `taxableAmount`, `taxTotal`, `withholdingTotal`, `lineTotal`, `amountSold`, `currencySold`, `currencyExchangeRate`, `taxDecisionReceiptId`, `accountId`, `dimensionSetId`, `deferralScheduleId`, `constructionAssetId`, `trackInventory`, `mappingKey`.
- **Lifecycle Command Bodies (`#17`):**
  - `POST /fiscal-documents/:id/derive-kind`: empty `{}` body (`02_DTOs.md` L1577) -> returns `DocumentKindDerivationReceipt`.
  - `POST /fiscal-documents/:id/resolve-tax`: `ResolveDocumentTaxDto { registrationId?: UUID, force?: boolean }` *(the document is the path `:id`; the `fiscalDocumentId` of the declared DTO is set from the path and a body copy is refused with `400 ACCOUNTING.VALIDATION.FAILED`, `CG-SLICE-DOC-09`, closed by `D-772`)*.
  - `POST /fiscal-documents/:id/post`: `PostFiscalDocumentDto { journalId?: UUID, postingDate?: ISODate }` *(the document is the path `:id`, never a body field; only non-submitted kinds in `TAX_RESOLVED`, `D-107`)*.
  - `POST /fiscal-documents/:id/cancel`: *(See `CG-SLICE-DOC-02` — `reason` (`10..1,000` chars) per Module 04 §6 L282; DTO interface not yet declared in `02_DTOs.md` §7)*.
- **Attachments (`UploadAttachmentDto`, `AttachmentDetailDto`, `SignedDownloadDto`):**
  - Upload (`POST /attachments`, `multipart/form-data`): `file` binary + `UploadAttachmentDto { resType, resId, fileName, mime, sizeBytes, sha256, docClass, dataClassification?, legalHold? }`.
  - Projection (`acc_attachments` §13.1 — `storageKey` withheld per §13.1 rule 1): `id`, `companyId`, `resType`, `resId`, `sha256`, `storageApplication`, `fileName`, `mime`, `sizeBytes`, `docClass`, `protectedAfterPosting`, `taxPeriodEnd`, `retentionUntil`, `retentionYearsSnapshot`, `legalHold`, `legalHoldReason` *(Detail only)*, `legalHoldSetBy`, `legalHoldSetAt`, `dataClassification`, `uploadedBy`, `uploadedAt`, `version`.
  - Download (`GET /attachments/:id/download`): `SignedDownloadDto { url: string, expiresAt: ISO8601, fileName: string, mime: string, sizeBytes: number, sha256: Sha256Hex }`.
- **`[Full-stage P22.T06]` Self-Invoices (`SelfInvoiceSummaryDto` / `SelfInvoiceDetailDto` & `SettleSelfInvoiceDto`):**
  - Projection (`acc_self_invoices` §13.1): `id`, `companyId`, `fiscalDocumentId`, `sourcePurchaseRef` *(Detail only)*, `sourceFiscalDocumentId`, `supplierPartyId`, `supplierSrrNumber`, `taxPointDate`, `dueDate`, `reverseChargeDueDaysSnapshot`, `taxableBase`, `taxAmount`, `currencyCode`, `outputTaxTransactionId`, `inputTaxTransactionId`, `journalEntryId`, `submittedToAuthority`, `authorityDocumentId`, `status` (`POSTED | SETTLED | CANCELLED`), `settledAt`, `complianceItemId`, `version`.
  - Settle (`POST /self-invoices/:id/settle`): `SettleSelfInvoiceDto { settledAt: ISODate }` (`settledAt >= taxPointDate` and `<= today`).

### 1.4 Action-to-Route, Permission, Feature Key, Scope, Concurrency & Idempotency Matrix (`SCR-17`)

Every browser request prefixes `/api/tenant/accounting/v1` onto the catalogue path (`02_Endpoint_Catalogue.md` §1, §6):

| Role | Slice / Stage | UI Action (`AR` / `EN`) | Method & Browser Gateway Path | Exact Permission | Feature Key | Scope Target | Idempotency | Concurrency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `[P]` | `[Slice P18]` | تحميل سجل المستندات / Load Register | `GET /api/tenant/accounting/v1/fiscal-documents` | `accounting.fiscal_document.read` | `accounting.tax.engine` | `COMPANY_OR_BRANCH` | `none` | `none` |
| `[P]` | `[Slice P18]` | بحث في المستندات / Search Documents | `POST /api/tenant/accounting/v1/fiscal-documents/search` | `accounting.fiscal_document.read` | `accounting.tax.engine` | `COMPANY_OR_BRANCH` | `none` | `none` |
| `[P]` | `[Slice P18]` | عدّ تبويبات الحالة / Count Status Tabs | `POST /api/tenant/accounting/v1/fiscal-documents/count` | `accounting.fiscal_document.read` | `accounting.tax.engine` | `COMPANY_OR_BRANCH` | `none` | `none` |
| `[P]` | `[Slice P18]` | تصدير السجل / Export Register | `POST /api/tenant/accounting/v1/fiscal-documents/export` | `accounting.fiscal_document.read` | `accounting.tax.engine` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `none` (`202 + Location`) |
| `[P]` | `[Slice P18]` | فتح تفاصيل المستند / Load Detail | `GET /api/tenant/accounting/v1/fiscal-documents/:id` | `accounting.fiscal_document.read` | `accounting.tax.engine` | `COMPANY_OR_BRANCH` | `none` | Returns `ETag` |
| `[P]` | `[Slice P18]` | تحميل البنود / Load Lines | `GET /api/tenant/accounting/v1/fiscal-documents/:id/lines` | `accounting.fiscal_document.read` | `accounting.tax.engine` | `COMPANY_OR_BRANCH` | `none` | `none` |
| `[P]` | `[Slice P18]` | إصدار / تسجيل مستند / Register Document | `POST /api/tenant/accounting/v1/fiscal-documents` | `accounting.fiscal_document.register` | `accounting.tax.engine` | `COMPANY_OR_BRANCH` | `x-idempotency-key` (UUIDv7) | `none` (`201 + Location`) |
| `[P]` | `[Slice P18]` | فحص استنتاج النوع / Dry-Run Derive Kind | `POST /api/tenant/accounting/v1/fiscal-documents/:id/derive-kind` | `accounting.fiscal_document.register` | `accounting.tax.engine` | `COMPANY_OR_BRANCH` | `none` | `none` (stores nothing) |
| `[P]` | `[Slice P18]` | إعادة احتساب الضريبة / Resolve Tax | `POST /api/tenant/accounting/v1/fiscal-documents/:id/resolve-tax` | `accounting.fiscal_document.resolve_tax` | `accounting.tax.engine` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` (`ETag`) |
| `[P]` | `[Slice P18]` | ترحيل للأستاذ العام / Post Non-Submitted Doc | `POST /api/tenant/accounting/v1/fiscal-documents/:id/post` | `accounting.fiscal_document.post` | `accounting.tax.engine` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` (`ETag`) |
| `[P]` | `[Slice P18]` | إلغاء / عكس المستند / Cancel Document | `POST /api/tenant/accounting/v1/fiscal-documents/:id/cancel` | `accounting.fiscal_document.reverse` | `accounting.tax.engine` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` (`ETag`) |
| `[P]` | `[Slice P18]` | عرض قائمة المرفقات / List Attachments | `GET /api/tenant/accounting/v1/attachments` | `accounting.attachment.read` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | `none` | `none` |
| `[P]` | `[Slice P18]` | تفاصيل المرفق / Get Attachment | `GET /api/tenant/accounting/v1/attachments/:id` | `accounting.attachment.read` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | `none` | Returns `ETag` |
| `[P]` | `[Slice P18]` | تنزيل موقّع للمرفق / Download Attachment | `GET /api/tenant/accounting/v1/attachments/:id/download` | `accounting.attachment.download` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | `none` | `none` |
| `[P]` | `[Slice P18]` | رفع مرفق جديد / Upload Attachment | `POST /api/tenant/accounting/v1/attachments` | `accounting.attachment.create` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | `x-idempotency-key` (UUIDv7) | `none` (`201 + Location`) |
| `[P]` | `[Slice P18]` | حذف مرفق غير محمي / Delete Attachment | `DELETE /api/tenant/accounting/v1/attachments/:id` | `accounting.attachment.delete` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` (`ETag`) |
| `[P]` | `[Full P22.T06]` | فرض / رفع التحفظ القانوني / Legal Hold | `POST /api/tenant/accounting/v1/attachments/:id/legal-hold` | `accounting.attachment.legal_hold` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` (UUIDv7) | `If-Match` (`ETag`) |
| `[P]` | `[Full P22.T06]` | عرض الفواتير الذاتية / List Self-Invoices | `GET /api/tenant/accounting/v1/self-invoices` | `accounting.fiscal_document.read` | `accounting.documents.inbound_matching` | `COMPANY` | `none` | `none` |
| `[P]` | `[Full P22.T06]` | تفاصيل فاتورة ذاتية / Get Self-Invoice | `GET /api/tenant/accounting/v1/self-invoices/:id` | `accounting.fiscal_document.read` | `accounting.documents.inbound_matching` | `COMPANY` | `none` | *(See `CG-SLICE-DOC-07`)* |
| `[P]` | `[Full P22.T06]` | تسجيل فاتورة ذاتية / Create Self-Invoice | `POST /api/tenant/accounting/v1/self-invoices` | `accounting.fiscal_document.register` | `accounting.documents.inbound_matching` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `none` (`201 + Location`) |
| `[P]` | `[Full P22.T06]` | إثبات سداد ضريبة عكسية / Settle Self-Invoice | `POST /api/tenant/accounting/v1/self-invoices/:id/settle` | `accounting.fiscal_document.post` | `accounting.documents.inbound_matching` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` (`ETag`) |
| `[S]` | `[Slice P18]` | منتقي الأطراف المالية / Party Picker | `POST /api/tenant/accounting/v1/party-finance-profiles/lookup` | `accounting.party_finance_profile.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` |
| `[S]` | `[Slice P18]` | منتقي الحسابات / Account Picker | `POST /api/tenant/accounting/v1/accounts/lookup` | `accounting.account.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | `none` | `none` |
| `[S]` | `[Slice P18]` | تثبيت سعر الصرف / Resolve FX Rate | `POST /api/tenant/accounting/v1/fx-rates/resolve` | `accounting.fx_rate.resolve` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | `none` | `none` |
| `[S]` | `[Slice P18]` | معاينة احتساب الضريبة / Preview Tax | `POST /api/tenant/accounting/v1/tax/evaluate` | `accounting.tax_transaction.evaluate` | `accounting.tax.engine` | `COMPANY_OR_BRANCH` | `none` | `none` (`taxFinal: false`) |
| `[S]` | `[Slice P18]` | إيصالات قرار الضريبة / Tax Decision Receipts | `GET /api/tenant/accounting/v1/tax/decision-receipts` | `accounting.tax_transaction.read` | `accounting.tax.engine` | `COMPANY` | `none` | `none` |
| `[S]` | `[Slice P18]` | معاينة قيد اليومية / Drill to Journal Entry | `GET /api/tenant/accounting/v1/journal-entries/:id` | `accounting.journal_entry.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | `none` | `none` |
| `[S]` | `[Full P22.T06]` | روابط المستند المصدر / Source Document Links | `GET /api/tenant/accounting/v1/source-document-links` | `accounting.fiscal_document.read` | `accounting.integration.trade_posting` | `COMPANY` | `none` | `none` |


### 1.5 Screen States (`SCR-17`: Empty, Loading, Error, `403`, Entitlement, Recovery, `409` Conflict, Timeout)

| State Category | Trigger / Condition | Reused Component (`@/design-system` / Approved Pattern) | Exact Bilingual UX Behavior & Safe Action |
| --- | --- | --- | --- |
| **Empty (Unfiltered `#16`)** | `GET /fiscal-documents` returns `items: []` with no active query/filter | `EmptyState` | Heading: `لا توجد مستندات ضريبية مسجلة بعد` / `No fiscal documents registered yet`. Body explains that service invoices issued in Accounting (`D-724`) and upstream Trade documents appear here. Single `primary` CTA `+ إصدار مستند ضريبي` / `+ Issue Fiscal Document` shown only when `hasPermission('accounting.fiscal_document.register')`. |
| **Empty (Filtered `#16`)** | `items: []` while `status`, `documentKind`, `partyId`, `branchId`, or search query is active | `EmptyState` (filtered variant) | Heading: `لا توجد مستندات تطابق عوامل التصفية الحالية` / `No documents match the current filters`. Secondary `outline` button `مسح الفلاتر` / `Clear filters` resets URL params without a full reload. |
| **Empty (`AttachmentList` on `#17` & `#18` Self-Invoices)** | `GET /attachments` returns `[]` or `GET /self-invoices` returns `[]` | `EmptyState` (compact card) | `#17` Tab 4 shows drag-and-drop upload card noting automatic client-side SHA-256 verification and `5-year` statutory retention (`D-148`). `#18` (`[Full P22.T06]`) explains reverse-charge foreign service bills (`D-121`) with `+ تسجيل فاتورة ذاتية` / `+ Register Self-Invoice`. |
| **Loading** | Initial route fetch, tab switch, or `300 ms` debounced `POST /tax/evaluate` | `Skeleton` (`DataTable` 8×`40px` rows; `#17` `DetailHeader` + 4-metric `Card` shimmer; `Spinner` in tax preview rail) | Preserves table column geometry and `DetailHeader` height so zero layout shift occurs; keeps prior tax preview dimmed (`opacity-60`) with `جاري تحديث المعاينة...` / `Updating preview...` indicator while debouncing. |
| **Domain & Validation Errors (`400` / `422` / `503`)** | Server returns structured error envelope (`errorCode`, `details`, `correlationId`) | `AccountingErrorAlert` (`Cause + Effect + Safe Action + correlationId` copy chip) | Never renders raw wire codes alone. Maps exact domain codes (`04_Errors_and_Constants.md` §3):<br>• `ACCOUNTING.DOCUMENT.KIND_UNDERIVABLE`: Missing branch fiscal profile, tax registration, or party profile -> deep-links to `#65` Tax Setup or `#27` Party Finance Profile.<br>• `ACCOUNTING.DOCUMENT.ISSUE_DATE_MISMATCH`: `issueDate` ≠ local date of `documentDatetimeUtc` (`D-126`) -> inline field error with one-click `مزامنة التاريخ المحلي` / `Sync local issue date`.<br>• `ACCOUNTING.DOCUMENT.NATIONAL_ID_REQUIRED`: Person (`P`) invoice `>= 50,000 EGP` lacks national ID (`D-128`) -> highlights counterparty card with link to `#27`.<br>• `ACCOUNTING.DOCUMENT.STATUTORY_FIELD_MISSING` / `ITEM_CODE_NOT_APPROVED`: Missing statutory address/activity code or unapproved `EGS`/`GS1` code (`D-090`) -> highlights offending line `lineNo`.<br>• `ACCOUNTING.DOCUMENT.FX_RATE_PRECISION`: Authority document FX rate exceeds 5 decimals (`D-385`) -> highlights FX pin picker.<br>• `[Full P22.T06]` `NOTE_EXCEEDS_ORIGINAL` / `NOTE_LINES_NOT_SUBSET` / `REFERENCE_INVALID` / `REFERENCE_REJECTED`: Highlights `references[]` ceiling breakdown (`priorCreditedTotal` vs original).<br>• `ATTACHMENT_PROTECTED` / `RETENTION_ACTIVE` / `LEGAL_HOLD`: Explains `D-148`/`D-081` immutability (`retentionUntil` date shown) and blocks delete.<br>• `STORAGE_UNAVAILABLE` (`503`): Keeps staged form intact; offers retry of attachment upload/download without losing invoice lines. |
| **`403` Permission Denied** | User lacks `accounting.fiscal_document.read` (route) or action permission (`register`, `resolve_tax`, `post`, `reverse`, `attachment.*`) | `PermissionGate` (full-page on route; disabled control + `Tooltip` on action) | **Never rendered as an empty table.** Route `403` renders `PermissionGate` naming `accounting.fiscal_document.read` and active `companyId`/`branchId` scope. Missing sensitive-field permission masks `receiverNationalId` as `<bdi dir="ltr">••••••••••1234</bdi>` (`D-128`) inline without blocking `#17`. |
| **Feature Entitlement (`403 NOT_ENTITLED`)** | `errorCode === 'ACCOUNTING.FEATURE.NOT_ENTITLED'` or capability check false | `FeatureEntitlementGate` (`EmptyState` locked variant) | Names exact feature key: `accounting.tax.engine` on `#16`/`#17`, or `accounting.documents.inbound_matching` on `#18`/`#19` Self-Invoices (`[Full P22.T06]`). Provides link to tenant subscription administrator; zero write controls rendered. |
| **Recovery Mode (`403 RECOVERY_MODE`)** | `errorCode === 'ACCOUNTING.FEATURE.RECOVERY_MODE'` or company recovery flag active | `Alert` (`caution` persistent top banner) | Banner: `النظام في وضع الاسترداد — القراءة والتنزيل متاحان فقط، وتم إيقاف الإصدار والترحيل مؤقتاً` / `Recovery mode active — read and download remain available; registration, posting, and uploads are paused`. All `[P]` `GET`/`search`/`count`/`download` routes continue working; mutating CTAs are disabled. |
| **`409` Concurrency & State Conflicts** | `409 ACCOUNTING.CONCURRENCY.STALE_VERSION` (stale `If-Match`), `DUPLICATE_SOURCE`, `FROZEN`, `IN_FLIGHT`, `ACTIVE_REFERENCES`, `APPROVAL.REQUIRED` | `StaleVersionBanner` / `AccountingErrorAlert` | • `STALE_VERSION`: Prompts `تحديث ومراجعة التغييرات` / `Reload & Review Changes` (`GET /fiscal-documents/:id` capturing new `ETag`), flashing changed badges (`status`, `authorityDocumentId`, `postedEntryId`) before operator re-submits.<br>• `DUPLICATE_SOURCE`: Shows link to the existing `fiscalDocumentId` registered for `(sourceApp, sourceType, sourceId, sourceVersion)` or `intentKey`.<br>• `FROZEN` / `IN_FLIGHT` / `ACTIVE_REFERENCES`: Explains why local cancel/mutation is blocked (`D-107`, `D-110`) and links directly to `#79` Authority Document or referencing Credit/Debit Notes.<br>• `ACCOUNTING.APPROVAL.REQUIRED`: Links to `#62` Approval Request (`approvalRequestId`, `D-393`). |
| **Timeout / Ambiguous Outcome (`502`/`504`/Network Drop)** | Client timeout or gateway drop during `POST /fiscal-documents`, `resolve-tax`, `post`, `cancel`, or `attachments` | `AmbiguousOutcomePanel` (`accounting-patterns-workflow.md`) | **Strict non-duplication contract:** Locks the form against generating a new `sourceRef.sourceId`, `intentKey`, or `x-idempotency-key`. Step 1 (`تحقق من حالة العملية` / `Check Operation Outcome`) queries `POST /fiscal-documents/search` by `sourceId` (or `GET /fiscal-documents/:id` on existing docs). Only if unrecorded may the operator click `إعادة المحاولة بنفس المفتاح` / `Retry with Same Idempotency Key`, replaying the **identical** `x-idempotency-key` + `intentKey` + `sourceRef`. |

### 1.6 Waiting States on `SCR-17` (Deadline, Owner, Next Safe Action — Never Implying a Resend)

Whenever a fiscal document or self-invoice is waiting on an external authority, an internal approver, or a background worker, `SCR-17` renders `WaitingStateCallout` (`accounting-patterns-documents.md` §7) and **suppresses every submit/register/resend button**:

| Waiting Code & Slice Tag | `SCR-17` Condition | What We Wait On (`AR` / `EN`) | Deadline & Frozen Snapshot | Owner | Next Safe Action (Resend Strictly Forbidden) |
| --- | --- | --- | --- | --- | --- |
| **`WS-01`** `[Slice P18]` | `status = 'AWAITING_AUTHORITY'` and linked Authority Doc `status = 'PENDING'` | حسم نتيجة الإرسال الجاري لمصلحة الضرائب / Transport & duplicate-window outcome resolution at ETA | `duplicateWindowExpiresAt` (`submittedAt + duplicate_submission_window_minutes`, `10 min` snapshot, `D-136`) | عامل التسوية الآلي / محاسب الضرائب (`Authority Reconciliation Worker` / `Tax Accountant`) | **Navigate to `#79` and click `استعلام عن الحالة` / `Poll Status` (`POST /authority-documents/:id/poll`).** Callout explicitly warns: *"لا تُعد إنشاء المستند أو إرساله؛ الاستعلام يحسم النتيجة بأمان دون ازدواج"* / *"Do not recreate or resend; polling safely resolves outcome without duplicate submission."* |
| **`WS-02`** `[Slice P18]` | `status = 'AWAITING_AUTHORITY'` and linked Authority Doc `status = 'SUBMITTED'` | التحقق الفني واعتماد مصلحة الضرائب المصرية / Authority validation (`VALID` vs `INVALID`) | Escalates to Exception Board `AUTHORITY_PENDING_TIMEOUT` after `submission_pending_timeout_hours` (`4 h` default) | مصلحة الضرائب المصرية / محاسب الضرائب (`Tax Authority` / `Tax Accountant`) | Passive callback wait or **`Poll Status` on `#79`**. On `VALID`, server auto-posts the GL & tax entry (`POSTED`) with zero manual re-post or resend (`D-107`, `D-392`). |
| **`WS-03`** `[Slice P18]` | `status = 'POSTED'` while linked Authority Doc is `CANCEL_REQUESTED` or `REJECT_REQUESTED` | مهلة اعتراض الطرف المقابل على الإلغاء أو الرفض / Counterparty decline window at ETA | `declineDeadlineAt` (`request_at + declineWindowHoursSnapshot`, `72 h` frozen snapshot, `D-110`, `D-520`) | الطرف المقابل / مصلحة الضرائب (`Counterparty` / `ETA`) | **Keep ledger untouched (`D-110`).** View live countdown or execute `Decline` (if receiver/issuer contesting) on `#79`. Local `Cancel Document` is disabled so no premature reversal entry is created before final `CANCELLED`/`REJECTED`. |
| **`WS-APPR`** `[Slice P18]` | `status = 'TAX_RESOLVED'` with `approvalRequestId != null` not yet `APPROVED` (`D-393`) | اعتماد المسؤول المفوض للمستند عالي القيمة / Internal threshold approval decision | Approval SLA on `ApprovalRequest` (`#62`) | المعتمد المالي (`Approver` role) | **`فتح طلب الاعتماد` / `Open Approval Request` (`#62`).** `Submit to Authority` and `Post to Ledger` remain locked with reason badge until approved; never duplicate the fiscal document. |
| **`WS-06`** `[Slice P18]` | `POST /fiscal-documents/export` returned `202 Accepted` | تجهيز ملف التصدير في الخلفية / Background register export generation | Polled via `Location` header honoring `Retry-After` | عامل التصدير بالخلفية (`Export Worker`) | **`تحديث حالة التصدير` / `Check Export Status` (`GET Location`).** Export button switches to progress pill until signed download link is ready. |
| **`WS-RC`** `[Full P22.T06]` | `#18`/`#19` `SelfInvoice.status = 'POSTED'` (`settledAt == null`) | سداد ضريبة القيمة المضافة للتكليف العكسي وتثبيت تاريخ السداد / Statutory reverse-charge VAT remittance | **`dueDate`** (`taxPointDate + reverseChargeDueDaysSnapshot`, `30 days` per transaction, `D-121`) | محاسب الضرائب / الخزانة (`Tax Accountant` / `Treasury`) | **`إثبات سداد ضريبة التكليف العكسي` / `Record Tax Remittance` (`POST /self-invoices/:id/settle`)** once treasury payment settles. Never register a second self-invoice for the same `sourcePurchaseRef`. |

### 1.7 Four-Combination ASCII Mockups (`SCR-17`)

#### 1.7.1 `AR-RTL · Light` — `#16?mode=new` Issue Sales Service Invoice (`D-724`) + Live Tax Preview Rail
`dir="rtl"` · Theme: `Light` (`--bg-canvas: #F8FAFC`, `--bg-surface: #FFFFFF`, `--text-primary: #0F172A`, `--border-subtle: #E2E8F0`, `--brand-solid: #0F766E`) · Single `primary` CTA in `PageHeader`:

```text
+----------------------------------------------------------------------------------------------------------------------+
| [Light: #F8FAFC / #FFFFFF]  المستندات الضريبية  <  إصدار فاتورة خدمات ضريبية جديدة (#16?mode=new)             dir=rtl |
| [إصدار وتسجيل المستند (Primary)]   [إلغاء والعودة للسجل]                  الفرع: فرع القاهرة الرئيسي (CAI-01) · EGP |
+----------------------------------------------------------------------------------------------------------------------+
| +--- معاينة استنتاج النوع والضريبة (Sticky End-Rail 340px) ---+  +--- بيانات رأس المستند وبنود الخدمة (Main 1fr) ---+ |
| | [معاينة غير نهائية · taxFinal: false]                       |  | فئة المستند: [فاتورة مبيعات خدمية SALES_INVOICE v] | |
| | النوع القانوني المتوقع: [فاتورة ضريبية TAX_INVOICE]         |  | رقم المستند: يُخصَّص تلقائياً عند الحفظ (SIN-...)  | |
| | قاعدة الاستنتاج: <bdi>EG_B2B_TAX_INVOICE_V1</bdi>           |  | العميل (Party): [شركة النيل للاستشارات الهندسية Q] | |
| | فئة المتلقي: أعمال مسجل (B) · ر.ض: <bdi>310-445-889</bdi>   |  | تاريخ الإصدار: <bdi>2026-11-01 14:30 UTC</bdi>     | |
| | الرقمنة الإلزامية: إرسال لمصلحة الضرائب (ETA e-Invoice)    |  | العملة: [EGP v]   تصدير خارج البلاد: [ ] لا       | |
| |-------------------------------------------------------------|  |---------------------------------------------------| |
| | الصافي قبل الخصم:          <bdi>100,000.00 EGP</bdi>        |  | بنود الخدمة (يُحظر تتبع المخزون trackInventory=0) | |
| | إجمالي خصم البنود:            <bdi>0.00 EGP</bdi>           |  | #1 | كود EGS: <bdi>EG-310445889-SRV01</bdi>       | |
| | الوعاء الخاضع للضريبة:     <bdi>100,000.00 EGP</bdi>        |  |    | البيان: استشارات مراجعة نظم مالية — أكتوبر   | |
| | ضريبة القيمة المضافة (14%): <bdi>14,000.00 EGP</bdi>        |  |    | الكمية: <bdi>1</bdi> EA · السعر: <bdi>100,000.00</bdi> | |
| | خصم تحت حساب الضريبة (3%):  <bdi>-3,000.00 EGP</bdi>        |  |    | الضريبة: [خاضع بالسعر العام STANDARD v]     | |
| | الإجمالي القانوني للفاتورة: <bdi>114,000.00 EGP</bdi>       |  |    | حساب الإيراد: <bdi>410100</bdi> إيرادات خدمات | |
| |=============================================================|  | [+ إضافة سطر خدمة]                                | |
| | صافي التسوية المستحق (D-129): <bdi>111,000.00 EGP</bdi>     |  |---------------------------------------------------| |
| | مفتاح القصد: <bdi>accounting:SALES_INVOICE:0192e8...:v1</bdi>|  | المرفقات (0/20): [رفع عقد أو محضر استلام PDF/XML] | |
| +-------------------------------------------------------------+  +---------------------------------------------------+ |
+----------------------------------------------------------------------------------------------------------------------+
```

#### 1.7.2 `AR-RTL · Dark` — `#17` Fiscal Document Detail (`AWAITING_AUTHORITY` with `WS-02` Waiting State)
`dir="rtl"` · Theme: `Dark` (`--bg-canvas: #0B0F17`, `--bg-surface: #111827`, `--text-primary: #F8FAFC`, `--border-subtle: #1F2937`, `--caution-surface: #451A03`) · Single `primary` CTA opens `#79`:

```text
+----------------------------------------------------------------------------------------------------------------------+
| [Dark: #0B0F17 / #111827]   المستندات الضريبية  <  تفاصيل المستند <bdi>SIN-2026-000184</bdi> (#17)            dir=rtl |
| [فتح مستند مصلحة الضرائب #79 (Primary)] [فحص استنتاج النوع]   الحالة: [بانتظار مصلحة الضرائب] [TAX_INVOICE] [مجمّد]  |
+----------------------------------------------------------------------------------------------------------------------+
| [!] حالة انتظار (WS-02): المستند مُرسل لمصلحة الضرائب (SUBMITTED) وبانتظار نتيجة التحقق الفني.                       |
|     المسؤول: مصلحة الضرائب المصرية / محاسب الضرائب · مهلة التنبيه: <bdi>4h</bdi> (قبل تصعيد استثناء تأخر الرد).      |
|     الإجراء الآمن: افتح مستند مصلحة الضرائب (#79) للاستعلام الآمن. لا تُعد الإرسال مطلقاً؛ سيرحَّل القيد آلياً فور VALID.|
+----------------------------------------------------------------------------------------------------------------------+
| [صافي التسوية D-129: <bdi>111,000.00 EGP</bdi>] [الإجمالي: <bdi>114,000.00 EGP</bdi>] [الضريبة: <bdi>14,000.00</bdi>] [قبل الضريبة: <bdi>100,000.00</bdi>] |
+----------------------------------------------------------------------------------------------------------------------+
| (البنود والإجماليات)  [*إيصال استنتاج النوع والضريبة*]  (مصلحة الضرائب والمصدر)  (المرفقات والحفظ القانوني <bdi>2</bdi>) |
| +------------------------------------------------------------------------------------------------------------------+ |
| | قاعدة استنتاج النوع المجمّدة: <bdi>EG_B2B_TAX_INVOICE_V1</bdi> · وقت التجميد: <bdi>2026-11-01T14:31:04Z</bdi>    | |
| | الرقم الضريبي للمُصدر: <bdi>204-991-112</bdi> · المتلقي: شركة النيل (<bdi>B · 310-445-889</bdi>) · القناة: ERP    | |
| | بصمة حزمة القواعد الضريبية (ruleSetContentHash): <bdi>sha256:9f4c2a...81e0</bdi> [نسخ] · ETag: <bdi>"v3"</bdi>    | |
| | بصمة مدخلات القرار (inputSnapshotHash):          <bdi>sha256:41b7d0...22c9</bdi> [نسخ] · المصدر: <bdi>accounting</bdi> | |
| +------------------------------------------------------------------------------------------------------------------+ |
+----------------------------------------------------------------------------------------------------------------------+
```

#### 1.7.3 `EN-LTR · Light` — `#16?mode=new` Issue Sales Service Invoice (`D-724`) + Live Tax Preview Rail
`dir="ltr"` · Theme: `Light` (`--bg-canvas: #F8FAFC`, `--bg-surface: #FFFFFF`, `--text-primary: #0F172A`, `--border-subtle: #E2E8F0`, `--brand-solid: #0F766E`) · Mirrored LTR geometry (`340px` sticky end-rail on visual right):

```text
+----------------------------------------------------------------------------------------------------------------------+
| [Light: #F8FAFC / #FFFFFF]  Fiscal Documents  >  Issue New Service Tax Invoice (#16?mode=new)                dir=ltr |
| Branch: Cairo HQ (CAI-01) · Currency: EGP                  [Cancel & Back to Register]   [Issue Document (Primary)]  |
+----------------------------------------------------------------------------------------------------------------------+
| +--- Document Header & Service Lines (Main 1fr) ---+  +--- Kind & Live Tax Preview (Sticky End-Rail 340px) --------+ |
| | Document Class: [Sales Service Invoice         v] |  | [Non-final preview · taxFinal: false]                     | |
| | Document No.:   Assigned on save (SIN-...)        |  | Expected Legal Kind: [TAX_INVOICE]                        | |
| | Counterparty:   [Nile Engineering Consult.     Q] |  | Derivation Rule:     EG_B2B_TAX_INVOICE_V1                | |
| | Issue Datetime: 2026-11-01 14:30 UTC (Local sync) |  | Receiver Class:      Business (B) · TIN: 310-445-889      | |
| | Currency: [EGP v]   Export Supply: [ ] No         |  | Statutory Filing:    ETA e-Invoice Required               | |
| |---------------------------------------------------|  |-----------------------------------------------------------| |
| | Service Lines (Inventory tracking forbidden D-724)|  | Net Before Discount:                     100,000.00 EGP   | |
| | #1 | EGS Code: EG-310445889-SRV01                 |  | Line Discounts Total:                          0.00 EGP   | |
| |    | Desc: Financial Systems Audit — Oct          |  | Taxable Base (Excl. Tax):                100,000.00 EGP   | |
| |    | Qty: 1 EA · Unit Price: 100,000.00           |  | VAT Output (14%):                         14,000.00 EGP   | |
| |    | Tax Status: [STANDARD                     v] |  | WHT Deducted at Source (3%):              -3,000.00 EGP   | |
| |    | Revenue Account: 410100 Consulting Revenue   |  | Legal Invoice Gross Total:               114,000.00 EGP   | |
| | [+ Add Service Line]                              |  |===========================================================| |
| |---------------------------------------------------|  | Net Settlement Receivable (D-129):       111,000.00 EGP   | |
| | Attachments (0/20): [Upload Contract/Acceptance]  |  | Intent Key: accounting:SALES_INVOICE:0192e8...:v1         | |
| +---------------------------------------------------+  +-----------------------------------------------------------+ |
+----------------------------------------------------------------------------------------------------------------------+
```

#### 1.7.4 `EN-LTR · Dark` — `#17` Fiscal Document Detail (`AWAITING_AUTHORITY` with `WS-02` Waiting State)
`dir="ltr"` · Theme: `Dark` (`--bg-canvas: #0B0F17`, `--bg-surface: #111827`, `--text-primary: #F8FAFC`, `--border-subtle: #1F2937`, `--caution-surface: #451A03`) · Single `primary` CTA opens `#79`:

```text
+----------------------------------------------------------------------------------------------------------------------+
| [Dark: #0B0F17 / #111827]   Fiscal Documents  >  Document SIN-2026-000184 (#17)                              dir=ltr |
| Status: [AWAITING_AUTHORITY] [TAX_INVOICE] [Frozen D-107]  [Verify Kind]  [Open Authority Document #79 (Primary)]    |
+----------------------------------------------------------------------------------------------------------------------+
| [!] Waiting State (WS-02): Submitted to Tax Authority (SUBMITTED); awaiting technical validation outcome.            |
|     Owner: Egyptian Tax Authority (ETA) / Tax Accountant · Timeout escalation: 4h -> AUTHORITY_PENDING_TIMEOUT.      |
|     Safe Next Action: Open Authority Document (#79) to Poll Status safely. Never resend; GL auto-posts on VALID.     |
+----------------------------------------------------------------------------------------------------------------------+
| [Excl. Tax: 100,000.00 EGP]  [Tax Total: 14,000.00 EGP]  [Gross Total: 114,000.00 EGP]  [Settlement: 111,000.00 EGP] |
+----------------------------------------------------------------------------------------------------------------------+
| (Lines & Totals)   [*Kind & Tax Receipt*]   (Authority & Provenance)   (Attachments & Retention 2)                   |
| +------------------------------------------------------------------------------------------------------------------+ |
| | Frozen Derivation Rule: EG_B2B_TAX_INVOICE_V1 · Tax Frozen At: 2026-11-01T14:31:04Z · Version ETag: "v3"         | |
| | Issuer TIN: 204-991-112 · Counterparty: Nile Engineering Consult. (B · TIN 310-445-889) · Channel: ERP           | |
| | Tax RuleSet Hash (ruleSetContentHash): sha256:9f4c2a...81e0 [Copy] · Engine Version: tax-engine-1.0.0            | |
| | Input Snapshot Hash (inputSnapshotHash): sha256:41b7d0...22c9 [Copy] · Source Ref: accounting:SALES_INVOICE:v1   | |
| +------------------------------------------------------------------------------------------------------------------+ |
+----------------------------------------------------------------------------------------------------------------------+
```

---
## 2. `SCR-19A` (Inventory Row `SCR-19`) — Authority Documents, Attempts, Statutory Windows, Callback Notifications & Late-Submission Grants

### 2.1 Purpose, Traceability & Slice vs Full-Stage Boundary

`SCR-19A` (screen inventory row `SCR-19`, filing workspace `/accounting/file/authority-documents`) governs the statutory e-Invoice and e-Receipt lifecycle with the Egyptian Tax Authority (`ETA_INVOICE`, `ETA_RECEIPT`, and reserved wave profiles): cryptographic submission, append-only attempt evidence, idempotent status polling, technical-only invoice resubmission (`document_no || '-' || attempt_no`), statutory `72h` cancel / reject / decline windows where **the ledger remains untouched until final authority outcome (`D-110`, `D-399`, `D-520`)**, signed `INVOICE_LEGAL` archive download, callback notification replay, and annual late-submission grant management (`D-400`).

| Capability Area | `[Slice subset — P18.T07]` (`13_Delivery_Plan.md` §3.6) | `[Full stage completion — P22.T04]` |
| --- | --- | --- |
| **Routes & Views** | `#78` `/accounting/file/authority-documents` (Tab 1: Authority Documents list & search) and `#79` `/accounting/file/authority-documents/[id]` (`DocumentViewer` + `AuthorityTimeline`). | Adds Tab 2 (`إشعارات الربط الفوري` / `Callback Notifications`) and Tab 3 (`مهل التقديم المتأخر` / `Late-Submission Grants`) on `#78`, plus Inbound Receiver Decision workflow on `#79`. |
| **Profiles & Directions** | `OUTBOUND` `ETA_INVOICE` (`TAX_INVOICE`, `SIMPLIFIED_TAX_INVOICE`, `EXPORT_INVOICE`, `PREPAYMENT_INVOICE`). | Adds `OUTBOUND` Credit/Debit Note freeze tracking (`FROZEN_BY_CREDIT`, `FROZEN_BY_DEBIT`, `SUPERSEDED`), `INBOUND` supplier authority documents (`accounting.documents.inbound_matching`), and `OUTBOUND` POS `ETA_RECEIPT` (`ledgerWithheld`, `uuidAsserted`, `ledgerSettledAt`, `withheldFacts`, `deviceSerial`, `chainCounter`). |
| **Authority Lifecycle Commands** | `submit`, `poll` (with `sourceStatus: 'UNAVAILABLE'` graceful banner `D-395`), `resubmit` (`INVALID` invoice profiles only, `D-139`), `request-cancel` (`OUTBOUND` `VALID` inside `issuer_cancel_window_hours`), `decline` (`CANCEL_REQUESTED`/`REJECT_REQUESTED` inside `declineDeadlineAt`), `download` (`INVOICE_LEGAL` signed URL + SHA-256). | Adds `request-reject` (`INBOUND` `VALID` inside `receiver_reject_window_hours`, deemed acceptance in law on silence `D-108`), `POST /authority/notifications/:id/replay`, and `POST /late-submission-requests` (`create`, `record-approval`, `close`). |

### 2.2 Layout, Progressive Disclosure & Reused Components

**Reused Components (Zero Redesign):**
- `@/design-system`: `PageHeader`, `FilterBar`, `DataTable`, `Tabs`, `Card`, `Badge`, `Button`, `Sheet`, `Dialog`, `Alert`, `Skeleton`, `EmptyState`, `Tooltip`.
- Approved accounting specs: `DocumentViewer` (`7/12`) + `AuthorityTimeline` (`5/12`) + `WaitingStateCallout` (`accounting-patterns-documents.md` §3, §4, §7), `StatusBadge` (`accounting-status-and-a11y.md`), `LedgerDrillDrawer` (`accounting-stage1-journals.md`), `AccountingErrorAlert`, `StaleVersionBanner`, `AmbiguousOutcomePanel`, `PermissionGate`.

#### A. `#78` `/accounting/file/authority-documents` — Authority Filing Workspace
1. **`PageHeader`:** Title `مستندات مصلحة الضرائب والربط الإلكتروني` / `Authority Documents & Electronic Filing`.
   - Tab 1 (`Authority Documents`) and Tab 2 (`Callback Notifications`) render **zero** filled `primary` buttons in `PageHeader` (outbound authority documents are initiated from `TAX_RESOLVED` fiscal documents on `#17`, and inbound ones arrive via webhook/sync).
   - `[Full-stage P22.T04]` Tab 3 (`Late-Submission Grants`) renders the single `primary` CTA `+ طلب مهلة تقديم متأخر` / `+ Request Late-Submission Grant` when `hasPermission('accounting.receipt_batch.request_late_submission')` and entitled to `accounting.documents.ereceipt_eg`.
2. **Tab 1 — `مستندات مصلحة الضرائب` / `Authority Documents` (`[Slice P18]`):**
   - **Quick Status Filter Strip:** `الكل / All`, `معلّق فني PENDING`, `مُرسل SUBMITTED`, `معتمد VALID`, `مرفوض فنياً INVALID`, `طلب إلغاء CANCEL_REQUESTED`, `طلب رفض REJECT_REQUESTED`, `ملغى/مرفوض CANCELLED & REJECTED`, plus toggle chip `محجوب عن الأستاذ ledgerWithheld` (`[Full-stage]` POS).
   - **`FilterBar`:** Search input (`POST /authority-documents/search`) + `direction` (`OUTBOUND | INBOUND`), `profile` (`ETA_INVOICE | ETA_RECEIPT`), `connectionId` (`GET /einvoice-connections`), `freezeStatus`, `fromSubmittedAt`..`toSubmittedAt`, and `declineDeadlineBefore` (surfaces expiring 72h windows first).
   - **`DataTable` (`40px` compact rows):**
     - `<bdi dir="ltr">{internalId}</bdi>` (monospace primary link to `#79`)
     - `direction` + `profile` pills (`صادر · فاتورة` / `Outbound · Invoice`)
     - `<bdi dir="ltr">{uuid ?? '—'}</bdi>` (truncated authority UUID with copy chip)
     - `status` (`StatusBadge` — icon + localized label)
     - `freezeStatus` badge (hidden when `NONE`; `مجمّد بإشعار دائن` / `Frozen by Credit` etc.)
     - `<bdi dir="ltr">{submittedAt}</bdi>` & active statutory deadline countdown (`declineDeadlineAt` or `receiverDecisionDeadlineAt`)
     - Ledger state chip (`مرحّل` `#15` link when `postedEntryId != null`, `عُكس القيد` when `reversalEntryId != null`, `محجوب مؤقتاً` when `ledgerWithheld === true`, `بانتظار الاعتماد` otherwise).
3. **`[Full stage completion — P22.T04]` Tab 2 — `إشعارات الربط الفوري` / `Callback Notifications` (`COMPANY` scope):**
   - `FilterBar` (`connectionId`, `status`: `RECEIVED | PARKED | PROCESSED`, `fromReceivedAt`..`toReceivedAt`) + `DataTable` (`GET /authority/notifications`) showing `deliveryId`, `connectionId`, `messageCount`, `status`, `parkedReason`, `attempts`, `receivedAt`, `processedAt`.
   - Clicking a row opens a `Sheet` (`GET /authority/notifications/:id`) showing append-only `payloadHash`, raw callback JSON viewer, `parkedReason`, `correlationId`, and `إعادة تطبيق الإشعار` / `Replay Notification` (`POST /authority/notifications/:id/replay`, permission `accounting.authority_document.reconcile`).
4. **`[Full stage completion — P22.T04]` Tab 3 — `مهل التقديم المتأخر` / `Late-Submission Grants` (`COMPANY` scope, `accounting.documents.ereceipt_eg`):**
   - Top quota meter card per connection (`quotaUsed / quotaLimit` grants in the current calendar year, warning at `quotaLimit - 1`, `D-400`).
   - `DataTable` (`GET /late-submission-requests`) + detail `Sheet` (`GET /late-submission-requests/:id`, `ETag`) with `Record Authority Approval` (`POST /:id/record-approval`, `If-Match`) and `Close Grant` (`POST /:id/close`, `If-Match`).

#### B. `#79` `/accounting/file/authority-documents/[id]` — Authority Document Detail (`DocumentViewer` + `AuthorityTimeline`)
1. **`DetailHeader`:**
   - Breadcrumb (`مستندات مصلحة الضرائب` / `Authority Documents` -> `<bdi dir="ltr">{internalId}</bdi>`), `AuthorityDocumentStatus` `StatusBadge`, `direction`, `profile`, `freezeStatus` pill, and link pill to `#17` Fiscal Document (`fiscalDocumentId`).
   - **Single Context-Sensitive `primary` CTA (Strict Law 5 — max 1 `primary` button):**
     - *(No first-submission control on this page: an authority document has no `DRAFT` status and does not exist until `POST /fiscal-documents/:id/submit`, started from `#17`, inserts it as `PENDING`, `D-772`.)*
     - `status === 'PENDING' || status === 'SUBMITTED'`: **`استعلام آمن عن الحالة` / `Poll Status`** (`POST /authority-documents/:id/poll` — **never** a resend button).
     - `status === 'INVALID' && profile === 'ETA_INVOICE' && direction === 'OUTBOUND'`: **`إعادة إرسال تقني برقم محاولة جديد` / `Resubmit Technical Attempt`** (`ResubmitAuthorityDialog` -> `POST /authority-documents/:id/resubmit`, `If-Match`). *(Strictly omitted when `profile === 'ETA_RECEIPT'` per `D-139`, or when `supersededById != null`.)*
     - `(status === 'CANCEL_REQUESTED' || status === 'REJECT_REQUESTED') && declineRequestedAt == null && now < declineDeadlineAt` (when operator holds counterparty role): **`الاعتراض على الطلب` / `Decline Request`** (`DeclineRequestDialog` -> `POST /authority-documents/:id/decline`, `If-Match`, permission `accounting.authority_document.reject`).
     - `[Full P22.T04]` `status === 'VALID' && direction === 'INBOUND' && freezeStatus === 'NONE' && now < receiverDecisionDeadlineAt`: **`طلب رفض المستند الوارد` / `Request Rejection`** (`RequestRejectDialog` -> `POST /authority-documents/:id/request-reject`, `If-Match`, feature `accounting.documents.inbound_matching`).
     - `status === 'VALID'` (default when no urgent statutory response action applies): **`تنزيل الأرشيف القانوني الموقّع` / `Download Legal Archive`** (`GET /authority-documents/:id/download` -> verifies `SignedDownloadDto.sha256` receipt).
   - **Secondary (`outline` / `destructive` outline) Actions:**
     - `طلب إلغاء خلال المهلة القانونية` / `Request Cancellation` (`RequestCancelDialog` -> `POST /authority-documents/:id/request-cancel`, `If-Match`; shown only when `direction === 'OUTBOUND' && status === 'VALID' && freezeStatus === 'NONE'` and within `issuer_cancel_window_hours`). When window expired or `freezeStatus !== 'NONE'`, replaced by `إصدار إشعار دائن تصحيحي` / `Issue Credit Note` (`Link` to `#16?mode=new&sourceType=CREDIT_NOTE&ref=${fiscalDocumentId}`, `D-110`).
     - `عرض قيد اليومية` / `View Journal Entry` (`#15` `postedEntryId` and, after final `CANCELLED`/`REJECTED`, `reversalEntryId`).
     - `فتح رابط التحقق العام` / `Open Authority Public Link` (external link to `publicUrl` when populated, `rel="noopener noreferrer"`).
2. **Conditional Top Callouts:**
   - `WaitingStateCallout` (`WS-01`, `WS-02`, `WS-03`, `WS-04`) whenever `status` is `PENDING`, `SUBMITTED`, `CANCEL_REQUESTED`, `REJECT_REQUESTED`, or `INBOUND` `VALID` inside `receiverDecisionDeadlineAt`.
   - Degraded Authority Poll Banner (`Alert` `caution`) when `POST /:id/poll` returns `sourceStatus: 'UNAVAILABLE'` (`D-395`): *"مصلحة الضرائب غير متاحة مؤقتاً؛ البيانات المعروضة أدناه هي آخر حالة محفوظة محلياً دون أي تعديل"* / *"Tax authority temporarily unavailable; displaying last persisted local state without modification."*
3. **Asymmetric 12-Column Workspace (`gap-6`):**
   - **Start `7/12` — `DocumentViewer`:**
     - **Statutory Identity & Signature Card:** `internalId`, `uuid` (`uuidAsserted` badge if POS offline-computed), `longId`, `submissionUuid`, `documentTypeCode` + `documentTypeVersion` (`v1.0` / `v1.2`), `connectionId`, `certificateThumbprint`, `signingTime`, `creditedToDate`.
     - **Validation Results Inspector (`validationResults` JSON):** Renders step-by-step authority validation rows (`status`, `stepName`, `<bdi dir="ltr">{propertyPath}</bdi>`, `<bdi dir="ltr">{errorCode}</bdi>`, message). On `INVALID`, explicitly separates:
       - *Technical / connectivity / transient schema faults* -> eligible for `Resubmit Technical Attempt` (`internalId = document_no || '-' || attempt_no`, `D-397`).
       - *Content / amount / party / tax faults* -> **not** fixable via resubmit (`D-139`); operator must issue a superseding `sourceVersion` (`supersededById` link shown once superseded).
     - **`[Full-stage P22.T04]` POS Withheld Facts Card** (visible only when `profile === 'ETA_RECEIPT'`): `deviceSerial`, `chainCounter`, `ledgerWithheld`, `ledgerSettledAt`, `withheldFacts` reason list.
   - **End `5/12` — `AuthorityTimeline` (`GET /authority-documents/:id/attempts`):**
     - **Synthetic Head Node Rule (`D-518`):** Whenever `AuthorityDocumentDetailDto.status === 'PENDING'` and `attempts` does not yet contain a finalized row for the in-flight attempt, `AuthorityTimeline` prepends a synthetic `PENDING` head step (`محاولة جارية قيد الحسم — لا تُعد الإرسال` / `In-Flight Attempt Awaiting Resolution — Do Not Resend`) showing `duplicateWindowExpiresAt` (`10 min` duplicate window `D-136`).
     - **Persisted Attempt Nodes (`attemptNo` descending):** Each node displays `attemptNo`, `<bdi dir="ltr">{internalId}</bdi>`, `outcome` (`ACCEPTED | REJECTED | DUPLICATE | TIMEOUT | TRANSPORT_ERROR | RESOLVED_BY_QUERY`), `httpStatus`, `submittedAt`, `submissionUuid`, `duplicateWindowExpiresAt`, `errorCode`, `resolutionQueryAt`, `payloadHash` / `serializedHash`, `lateSubmissionRequestId`, and `correlationId`.
     - **Statutory Window Footer Card:** Shows frozen window snapshots (`declineDeadlineAt`, `declineRequestedAt`, and `[Full-stage]` `receiverDecisionDeadlineAt` with deemed-acceptance-in-law legal notice `D-108`).

### 2.3 Complete Field-to-DTO Mapping (`SCR-19A`)

#### 2.3.1 List Query & Detail Projection (`02_DTOs.md` §7.1, §7.2 L1952–1990 & §13.1)

| Surface | UI Element (`AR` / `EN`) | Exact DTO & Member | Type & Notes |
| --- | --- | --- | --- |
| `#78` Filter | الاتجاه / Direction | `AuthorityDocumentListQueryDto.direction` | `AuthorityDirection?` (`OUTBOUND \| INBOUND`) |
| `#78` Filter | الملف الضريبي / Profile | `AuthorityDocumentListQueryDto.profile` | `AuthorityProfile?` (`ETA_INVOICE \| ETA_RECEIPT \| PEPPOL_BIS3 \| ZATCA_FATOORA \| FTA_UAE`) — `EG` uses first two |
| `#78` Filter | نقطة الربط / Connection | `AuthorityDocumentListQueryDto.connectionId` | `UUID?` |
| `#78` Filter | الحالة / Status | `AuthorityDocumentListQueryDto.status` | `AuthorityDocumentStatus?` (`DRAFT \| PENDING \| SUBMITTED \| VALID \| INVALID \| CANCEL_REQUESTED \| REJECT_REQUESTED \| CANCELLED \| REJECTED`) |
| `#78` Filter | حالة التجميد / Freeze Status | `AuthorityDocumentListQueryDto.freezeStatus` | `FreezeStatus?` (`NONE \| FROZEN_BY_CREDIT \| FROZEN_BY_DEBIT \| SUPERSEDED`) |
| `#78` Filter | فترة الإرسال / Submitted Range | `fromSubmittedAt`, `toSubmittedAt` | `ISO8601?` |
| `#78` Filter | مهلة الاعتراض قبل / Decline Before | `declineDeadlineBefore` | `ISO8601?` |
| `#78` Filter | محجوب عن الأستاذ / Ledger Withheld | `ledgerWithheld` | `boolean?` |
| `#79` Detail | معرفات المستند / Identifiers | `AuthorityDocumentDetailDto.{id, fiscalDocumentId, connectionId, internalId, uuid, uuidAsserted, longId, submissionUuid}` | `UUID` / `string \| null` / `boolean`; `ETag` returned from `version` |
| `#79` Detail | التصنيف والحالة / Profile & State | `direction`, `profile`, `documentTypeCode`, `documentTypeVersion`, `status`, `freezeStatus` | Exact wire enums rendered via `StatusBadge` |
| `#79` Detail | حجب وتسوية الأستاذ / Ledger Gate | `ledgerWithheld`, `ledgerSettledAt`, `creditedToDate`, `postedEntryId`, `reversalEntryId`, `postingGroupId`, `supersededById` | `DecimalString` (`creditedToDate`), `UUID \| null` links to `#15` / `#79` |
| `#79` Detail | التوقيع والتحقق / Signing & Validation | `certificateThumbprint`, `signingTime`, `publicUrl`, `validationResults` | `validationResults: Record<string, unknown> \| null` |
| `#79` Detail | التوقيتات والمهل / Timestamps & Deadlines | `submittedAt`, `validAt`, `declineDeadlineAt`, `declineRequestedAt`, `version` | *(`AuthorityDocumentDetailDto` carries `errorCode` and `attemptNo` (`D-772`); `receiverDecisionDeadlineAt`, `lateSubmissionRequestId` and the other statutory-window columns stay deferred to P22.T02, `CG-SLICE-DOC-05 (b)`)* |
| `#79` Timeline | سجل المحاولات المدمج والمفصل / Attempts | `AuthorityDocumentDetailDto.attempts[]` + `GET /:id/attempts` (`AuthorityDocumentAttemptSummaryDto`) | `id`, `authorityDocumentId`, `sourceRef`, `attemptNo`, `internalId`, `payloadHash`, `serializedHash`, `submittedAt`, `submissionUuid`, `duplicateWindowExpiresAt`, `httpStatus`, `outcome`, `errorCode`, `resolutionQueryAt`, `lateSubmissionRequestId`, `correlationId`, `createdAt`, `createdBy` |

#### 2.3.2 Command Payloads (`#79` & `#78` Sub-Tabs, `02_DTOs.md` §7.2)

| Command Dialog / Action | DTO Name | Exact Request Fields & Constraints | Forbidden / Critical Rules |
| --- | --- | --- | --- |
| Submit (`POST /fiscal-documents/:id/submit`) | `SubmitAuthorityDocumentDto` | `connectionId: UUID`, `certificateId?: UUID`, `lateSubmissionRequestId?: UUID` (the fiscal document is the path `:id`) | Requires `If-Match` (the fiscal document's `version`) & `x-idempotency-key` (`202 + Location + Retry-After`; `Location` names `/authority-documents/:newId`, whose id and `version` every later command takes). Refused with `409 ACCOUNTING.APPROVAL.REQUIRED` if `approvalRequestId` unapproved (`D-520`) and with `409 ACCOUNTING.AUTHORITY.NOT_SUBMITTABLE` for any other fiscal status (`D-772`). |
| Resubmit (`POST /authority-documents/:id/resubmit`) | `ResubmitDto` | `certificateId?: UUID`, `reason: string` (`10..1,000` chars) | Only `INVALID` invoice profiles (`D-139`). Server assigns `internalId = document_no || '-' || attempt_no` (`D-397`). **Never** sends edited lines/amounts. |
| Poll (`POST /:id/poll`) | *(empty `{}` body)* | Path `:id` + `x-idempotency-key` | Returns `200` `AuthorityPollResultDto` = `AuthorityDocumentDetailDto` + `sourceStatus: 'AVAILABLE' \| 'UNAVAILABLE'` (`D-395`, `D-772`); no `lastPolledAt` exists, because no column or field records a poll instant. |
| Request Cancel (`POST /:id/request-cancel`) | `RequestCancelDto` | `reason: string` (`10..1,000` chars) | `OUTBOUND` `VALID` inside `issuer_cancel_window_hours`, `freezeStatus === 'NONE'`. Ledger untouched until final `CANCELLED` (`D-110`). |
| Decline (`POST /:id/decline`) | `DeclineRequestDto` | `reason: string` (`10..1,000` chars) | Valid on `CANCEL_REQUESTED` or `REJECT_REQUESTED` before `declineDeadlineAt`. Sets `declineRequestedAt`; status stays `*_REQUESTED` until authority ack (`D-520`). |
| `[Full P22.T04]` Request Reject (`POST /:id/request-reject`) | `RequestRejectDto` | `reason: string` (`10..1,000` chars) | `INBOUND` `VALID` inside `receiver_reject_window_hours`; feature `accounting.documents.inbound_matching` (`D-108`). |
| Download Archive (`GET /:id/download`) | — -> `SignedDownloadDto` | Response: `{ url, expiresAt, fileName, mime, sizeBytes, sha256 }` | Streams signed `INVOICE_LEGAL` archive (`5-year` retention `D-148`). |
| `[Full P22.T04]` Notifications (`GET /authority/notifications`, `/:id`, `/:id/replay`) | `AuthorityNotificationListQueryDto` | Query: `connectionId?`, `status?: 'RECEIVED' \| 'PARKED' \| 'PROCESSED'`, `fromReceivedAt?`, `toReceivedAt?`. Replay body: `{}` | Detail includes `deliveryId`, `payload`, `payloadHash`, `messageCount`, `parkedReason`, `attempts`, `correlationId`. |
| `[Full P22.T04]` Late-Submission Grants (`POST /late-submission-requests`, `record-approval`, `close`) | `CreateLateSubmissionRequestDto` / `RecordLateSubmissionApprovalDto` | Create: `{ connectionId: UUID, kind: 'INVOICE' \| 'RECEIPT', reason: string (10..500) }`. Record approval: `{ authorityReference: string (1..120), approvedAt: ISO8601 }`. Close: `{}` | Summary/Detail (`02_DTOs.md` L1992–2023): `id`, `connectionId`, `kind`, `calendarYear`, `sequenceInYear`, `quotaUsed`, `quotaLimit`, `status` (`REQUESTED \| APPROVED \| EXPIRED \| REJECTED \| CLOSED`), `authorityReference`, `requestedAt`, `approvedAt`, `expiresAt`, `version` (+ `reason`, `documentsCount`, `grantHoursSnapshot`, `closedAt`, `exceptionItemId` on Detail). |

### 2.4 Action-to-Route, Permission, Feature Key, Scope, Concurrency & Idempotency Matrix (`SCR-19A`)

| Role | Slice / Stage | UI Action (`AR` / `EN`) | Method & Browser Gateway Path | Exact Permission | Feature Key | Scope Target | Idempotency | Concurrency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `[P]` | `[Slice P18]` | عرض سجل مصلحة الضرائب / List Authority Docs | `GET /api/tenant/accounting/v1/authority-documents` | `accounting.authority_document.read` | `accounting.documents.einvoice_eg` | `COMPANY_OR_BRANCH` | `none` | `none` |
| `[P]` | `[Slice P18]` | بحث في مستندات المصلحة / Search Authority Docs | `POST /api/tenant/accounting/v1/authority-documents/search` | `accounting.authority_document.read` | `accounting.documents.einvoice_eg` | `COMPANY_OR_BRANCH` | `none` | `none` |
| `[P]` | `[Slice P18]` | تفاصيل مستند المصلحة / Get Authority Detail | `GET /api/tenant/accounting/v1/authority-documents/:id` | `accounting.authority_document.read` | `accounting.documents.einvoice_eg` | `COMPANY_OR_BRANCH` | `none` | Returns `ETag` |
| `[P]` | `[Slice P18]` | عرض سجل المحاولات / List Submission Attempts | `GET /api/tenant/accounting/v1/authority-documents/:id/attempts` | `accounting.authority_document.read` | `accounting.documents.einvoice_eg` | `COMPANY_OR_BRANCH` | `none` | `none` |
| `[P]` | `[Slice P18]` | تنزيل الأرشيف القانوني / Download Legal Archive | `GET /api/tenant/accounting/v1/authority-documents/:id/download` | `accounting.authority_document.read` | `accounting.documents.einvoice_eg` | `COMPANY_OR_BRANCH` | `none` | `none` |
| `[P]` | `[Slice P18]` | إرسال لمصلحة الضرائب / Submit to Authority | `POST /api/tenant/accounting/v1/fiscal-documents/:id/submit` | `accounting.authority_document.submit` | `accounting.documents.einvoice_eg` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` on the fiscal document (`202 + Location + Retry-After`) |
| `[P]` | `[Slice P18]` | إعادة إرسال تقني (`INVALID`) / Resubmit Attempt | `POST /api/tenant/accounting/v1/authority-documents/:id/resubmit` | `accounting.authority_document.resubmit` | `accounting.documents.einvoice_eg` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` (`202 + Location`) |
| `[P]` | `[Slice P18]` | استعلام آمن عن الحالة / Poll Authority Status | `POST /api/tenant/accounting/v1/authority-documents/:id/poll` | `accounting.authority_document.poll` | `accounting.documents.einvoice_eg` | `COMPANY_OR_BRANCH` | `x-idempotency-key` (UUIDv7) | `none` (row-locked server-side) |
| `[P]` | `[Slice P18]` | طلب إلغاء مستند صادر / Request Cancel | `POST /api/tenant/accounting/v1/authority-documents/:id/request-cancel` | `accounting.authority_document.cancel` | `accounting.documents.einvoice_eg` | `COMPANY_OR_BRANCH` | `x-idempotency-key` (UUIDv7) | `If-Match` (`202 + Location + Retry-After`) |
| `[P]` | `[Slice P18]` | الاعتراض على إلغاء أو رفض / Decline Request | `POST /api/tenant/accounting/v1/authority-documents/:id/decline` | `accounting.authority_document.reject` | `accounting.documents.einvoice_eg` | `COMPANY_OR_BRANCH` | `x-idempotency-key` (UUIDv7) | `If-Match` (`202 + Location + Retry-After`) |
| `[P]` | `[Full P22.T04]` | طلب رفض مستند وارد / Request Reject (Inbound) | `POST /api/tenant/accounting/v1/authority-documents/:id/request-reject` | `accounting.authority_document.reject` | `accounting.documents.inbound_matching` | `COMPANY_OR_BRANCH` | `x-idempotency-key` (UUIDv7) | `If-Match` (`202 + Location + Retry-After`) |
| `[P]` | `[Full P22.T04]` | عرض إشعارات الربط / List Callback Notifications | `GET /api/tenant/accounting/v1/authority/notifications` | `accounting.authority_document.read` | `accounting.documents.einvoice_eg` | `COMPANY` | `none` | `none` |
| `[P]` | `[Full P22.T04]` | تفاصيل إشعار الربط / Get Notification Detail | `GET /api/tenant/accounting/v1/authority/notifications/:id` | `accounting.authority_document.read` | `accounting.documents.einvoice_eg` | `COMPANY` | `none` | `none` |
| `[P]` | `[Full P22.T04]` | إعادة تطبيق إشعار معلّق / Replay Notification | `POST /api/tenant/accounting/v1/authority/notifications/:id/replay` | `accounting.authority_document.reconcile` | `accounting.documents.einvoice_eg` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `none` |
| `[P]` | `[Full P22.T04]` | عرض مهل التقديم المتأخر / List Late Grants | `GET /api/tenant/accounting/v1/late-submission-requests` | `accounting.authority_document.read` | `accounting.documents.ereceipt_eg` | `COMPANY` | `none` | `none` |
| `[P]` | `[Full P22.T04]` | تفاصيل مهلة تقديم متأخر / Get Late Grant | `GET /api/tenant/accounting/v1/late-submission-requests/:id` | `accounting.authority_document.read` | `accounting.documents.ereceipt_eg` | `COMPANY` | `none` | Returns `ETag` |
| `[P]` | `[Full P22.T04]` | إنشاء طلب مهلة متأخرة / Request Late Grant | `POST /api/tenant/accounting/v1/late-submission-requests` | `accounting.receipt_batch.request_late_submission` | `accounting.documents.ereceipt_eg` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `none` (`201 + Location`) |
| `[P]` | `[Full P22.T04]` | تثبيت موافقة المصلحة / Record Grant Approval | `POST /api/tenant/accounting/v1/late-submission-requests/:id/record-approval` | `accounting.receipt_batch.request_late_submission` | `accounting.documents.ereceipt_eg` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` (`ETag`) |
| `[P]` | `[Full P22.T04]` | إغلاق مهلة التقديم / Close Late Grant | `POST /api/tenant/accounting/v1/late-submission-requests/:id/close` | `accounting.receipt_batch.request_late_submission` | `accounting.documents.ereceipt_eg` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` (`ETag`) |
| *(Webhook)* | *(Non-UI)* | استقبال إشعار مصلحة الضرائب / Inbound Authority Callback | `PUT /api/public/accounting/eta/callback/:connectionToken/notifications/documents` *(internal `POST /accounting/authority/callbacks/:connectionToken`)* | `PUBLIC` (`x-eta-api-key` secret; `1 MiB` max; deduped on `deliveryId`) | `accounting.documents.einvoice_eg` | `PUBLIC` (resolved via `connectionToken`) | `deliveryId` dedupe | `503 CALLBACK_FENCED` in recovery |
| `[S]` | `[Slice P18]` | منتقي نقاط الربط / Connections Picker | `GET /api/tenant/accounting/v1/einvoice-connections` | `accounting.einvoice_connection.read` | `accounting.documents.einvoice_eg` | `COMPANY` | `none` | `none` |
| `[S]` | `[Slice P18]` | منتقي شهادات التوقيع / Certificates Picker | `GET /api/tenant/accounting/v1/signing-certificates` | `accounting.signing_certificate.read` | `accounting.documents.einvoice_eg` | `COMPANY` | `none` | `none` |
| `[S]` | `[Slice P18]` | الانتقال للمستند الضريبي وقيد اليومية / Drill Links | `GET /fiscal-documents/:id` (`#17`) & `GET /journal-entries/:id` (`#15`) | `accounting.fiscal_document.read` / `accounting.journal_entry.read` | `accounting.tax.engine` / `accounting.ledger.core` | `COMPANY_OR_BRANCH` / `OPERATING_CONTEXT` | `none` | `none` |

### 2.5 Screen States (`SCR-19A`: Empty, Loading, Error, `403`, Entitlement, Recovery, `409` Conflict, Timeout)

| State Category | Trigger / Condition | Reused Component | Exact Bilingual UX Behavior & Safe Action |
| --- | --- | --- | --- |
| **Empty (`#78` Tabs 1–3)** | `GET /authority-documents`, `/authority/notifications`, or `/late-submission-requests` returns `[]` | `EmptyState` | • Tab 1 (unfiltered): `لا توجد مستندات مرسلة أو واردة من مصلحة الضرائب بعد` / `No outbound or inbound authority documents yet`, with secondary link `الانتقال إلى سجل المستندات الضريبية (#16)` / `Go to Fiscal Documents (#16)`.<br>• Tab 2 (`[Full]`): `لا توجد إشعارات ربط فوري مسجلة` / `No callback notifications recorded`.<br>• Tab 3 (`[Full]`): Explains annual late-submission grant quota (`D-400`) + `+ طلب مهلة تقديم متأخر` / `+ Request Late-Submission Grant`. |
| **Loading** | Route fetch or `AuthorityTimeline` attempts load | `Skeleton` | `#78`: 8×`40px` `DataTable` skeleton rows. `#79`: `7/12` `DocumentViewer` card skeleton + `5/12` 3-step `AuthorityTimeline` shimmer. |
| **Domain & Authority Errors (`400`/`409`/`422`/`503`)** | `ACCOUNTING.AUTHORITY.*` or `ACCOUNTING.APPROVAL.REQUIRED` (`04_Errors_and_Constants.md` §3) | `AccountingErrorAlert` (`Cause + Effect + Safe Action + correlationId`) | • `NOT_CONNECTED` / `SUBMISSION_DISABLED` / `CERTIFICATE_EXPIRED` / `SANDBOX_PRODUCTION_FORBIDDEN`: Deep-links to `#80`/`#81` e-Invoice Connection & Signing Certificate setup.<br>• `UNAVAILABLE` / `DEPENDENCY_UNAVAILABLE` (`503`): Safe action `READ_LOCATION_OR_POLL` — explains authority outage, keeps document safely queued/persisted, and surfaces `Poll Status` (`POST /:id/poll`) without resend.<br>• `DUPLICATE_SUBMISSION`: Explains `duplicate_submission_window_minutes` (`10 min` `D-136`) guard prevented double filing; directs operator to `Poll Status`.<br>• `WINDOW_EXPIRED`: `72h` cancel/reject/decline window elapsed -> replaces cancel action with `Issue Credit Note` (`#16?mode=new`, `D-110`).<br>• `FROZEN` / `ACTIVE_REFERENCES`: Document already credited/debited/superseded -> links to referencing Credit/Debit Note.<br>• `RESUBMIT_NOT_ALLOWED` / `INVALID_DOCUMENT`: Explains `D-139` (`ETA_RECEIPT` or non-`INVALID` state cannot resubmit; content fixes require superseding `sourceVersion`).<br>• `LATE_SUBMISSION_REQUIRED` / `LATE_SUBMISSION_QUOTA_EXHAUSTED`: Links to `#78` Tab 3 Late-Submission Grants or Exception Board (`LATE_SUBMISSION_QUOTA`). |
| **Non-Fatal Degraded Poll (`200` + `sourceStatus: 'UNAVAILABLE'`)** | `POST /authority-documents/:id/poll` succeeds locally while ETA API is down (`D-395`) | `Alert` (`caution` inline banner) | Renders the stored `AuthorityDocumentDetailDto` fields of the `AuthorityPollResultDto` without error-crashing the page and advises waiting before polling again; no poll instant is stored or shown. |
| **`403` Permission Denied** | Missing `accounting.authority_document.read` (route) or `submit`/`resubmit`/`poll`/`cancel`/`reject`/`reconcile`/`request_late_submission` | `PermissionGate` / disabled CTA + `Tooltip` | **403 is never rendered as an empty table.** Route `403` renders `PermissionGate` naming `accounting.authority_document.read`. Note exact permission pairing: `Decline` requires `accounting.authority_document.reject` even on `OUTBOUND` documents (`02_Endpoint_Catalogue.md` L507). |
| **Feature Entitlement (`403 NOT_ENTITLED`)** | Tenant lacks `accounting.documents.einvoice_eg`, `accounting.documents.inbound_matching`, or `accounting.documents.ereceipt_eg` | `FeatureEntitlementGate` | • `#78`/`#79` base: gates on `accounting.documents.einvoice_eg`.<br>• Inbound `Request Reject` button: gates on `accounting.documents.inbound_matching`.<br>• `#78` Tab 3 (`Late-Submission Grants`): gates on `accounting.documents.ereceipt_eg` without hiding Tab 1/2. |
| **Recovery Mode (`403 RECOVERY_MODE` / `503 CALLBACK_FENCED`)** | Company in recovery mode | `Alert` (`caution` top banner) | `#78`/`#79` remain readable and `Download Legal Archive` (`GET /:id/download`) remains active; `submit`, `resubmit`, `poll`, `request-cancel`, `decline`, `request-reject`, `replay`, and `late-submission` mutations are paused (and inbound webhooks fence with `503 CALLBACK_FENCED` so ETA retries cleanly after recovery). |
| **`409` Concurrency Conflict (`STALE_VERSION`)** | Asynchronous ETA callback updated `status` / `version` while `#79` was open (`safeAction: ['REFRESH_AND_REVIEW']`) | `StaleVersionBanner` | Very common on `#79` because webhooks arrive concurrently! Banner explains: *"تغيّرت حالة المستند من قِبل إشعار مصلحة الضرائب أثناء فتح الصفحة"* / *"Document state was updated by an authority notification while open."* Clicking `تحديث ومراجعة الحالة` / `Reload & Review` refetches `GET /:id` (new `ETag`) + `GET /:id/attempts` and re-evaluates which action is legal. |
| **Timeout / Ambiguous Outcome (`202` Drop / `504`)** | Network drop during `submit`, `resubmit`, `request-cancel`, `decline`, or `request-reject` | `AmbiguousOutcomePanel` | **Zero blind re-submission:** Displays synthetic/persisted state, instructs operator to refresh `GET /authority-documents/:id` + `GET /:id/attempts` or click `Poll Status` (`POST /:id/poll`). If retrying the exact HTTP command before server receipt is confirmed, reuses the **identical** `x-idempotency-key` and `If-Match`. |

### 2.6 Waiting States on `SCR-19A` (Deadline, Owner, Next Safe Action — Never Implying a Resend)

| Waiting Code & Slice Tag | `SCR-19A` Condition | What We Wait On (`AR` / `EN`) | Deadline & Frozen Snapshot | Owner | Next Safe Action (Resend Strictly Forbidden) |
| --- | --- | --- | --- | --- | --- |
| **`WS-01`** `[Slice P18]` | `status = 'PENDING'` (synthetic top node active when current attempt row not yet finalized, `D-518`) | حسم حالة النقل أو نافذة منع الازدواج لدى المصلحة / Transport & duplicate-window resolution at ETA | `duplicateWindowExpiresAt` (`submittedAt + 10 min` `duplicate_submission_window_minutes`, `D-136`) | عامل التسوية الآلي / محاسب الضرائب (`Reconciliation Worker` / `Tax Accountant`) | **Click `استعلام آمن عن الحالة` / `Poll Status` (`POST /:id/poll`).** `Submit` and `Resubmit` buttons are completely absent (`Resubmit` is illegal on `PENDING` per `D-139`). |
| **`WS-02`** `[Slice P18]` | `status = 'SUBMITTED'` (`submissionUuid` recorded, awaiting `VALID` / `INVALID`) | نتيجة الفحص الفني والتوقيع من مصلحة الضرائب / ETA validation callback or poll result | `submission_pending_timeout_hours` (`4 h` default before `AUTHORITY_PENDING_TIMEOUT` board item opens) | مصلحة الضرائب المصرية / محاسب الضرائب (`ETA` / `Tax Accountant`) | **Wait for webhook or click `Poll Status` (`POST /:id/poll`).** Callout states that GL & tax ledger post automatically upon `VALID` (`D-107`, `D-392`) — never resend. |
| **`WS-03`** `[Slice P18]` | `status = 'CANCEL_REQUESTED'` or `'REJECT_REQUESTED'` with `declineRequestedAt == null` | انتهاء مهلة اعتراض الطرف المقابل أو تأكيد المصلحة النهائي / Counterparty decline window expiry or final ETA transition (`CANCELLED` / `REJECTED`) | **`declineDeadlineAt`** (`request_at + declineWindowHoursSnapshot`, `72 h` frozen snapshot, `D-110`, `D-520`) | الطرف المقابل / مصلحة الضرائب (`Counterparty` / `ETA`) | **Ledger stays `POSTED` and untouched (`D-110`).** Counterparty operator may click `Decline Request` (`POST /:id/decline`) before `declineDeadlineAt`; initiating side uses `Poll Status` only — never re-requests cancel/reject. |
| **`WS-03D`** `[Slice P18]` | `status = 'CANCEL_REQUESTED'` or `'REJECT_REQUESTED'` **and** `declineRequestedAt != null` (`D-520`) | تأكيد مصلحة الضرائب لطلب الاعتراض وإعادة المستند إلى `VALID` / ETA acknowledgement of submitted `Decline` reverting status to `VALID` | `declineDeadlineAt` preserved (`D-520`) until authority ack | مصلحة الضرائب المصرية (`ETA`) | **`Poll Status` (`POST /:id/poll`) only.** `Decline` button is locked showing `<bdi dir="ltr">{declineRequestedAt}</bdi>` so operator does not re-send decline. |
| **`WS-04`** `[Full P22.T04]` | `direction = 'INBOUND'` and `status = 'VALID'` while `now < receiverDecisionDeadlineAt` (`D-108`) | قرار المنشأة المتلقية (قبول ضمني أو طلب رفض قانوني) / Receiver statutory review window (**silence = deemed acceptance in law**) | **`receiverDecisionDeadlineAt`** (`receivedAt + receiverDecisionWindowHoursSnapshot`, `72 h` frozen snapshot, `D-108`) | محاسب المشتريات / محاسب الضرائب (`AP / Tax Accountant`) | Match to supplier bill (`#16`) or execute **`Request Rejection` (`POST /:id/request-reject`)** before `receiverDecisionDeadlineAt`. Urgent `caution` countdown warns that silence past the deadline constitutes irreversible legal acceptance (`D-108`). |
| **`WS-LATE`** `[Full P22.T04]` | `LateSubmissionRequest.status = 'REQUESTED'` or `'APPROVED'` (`#78` Tab 3) | موافقة المصلحة على المهلة أو إرسال المستندات المتأخرة قبل انتهاء المهلة / ETA grant approval (`REQUESTED`) or filing late docs before `expiresAt` (`APPROVED`) | On `APPROVED`: **`expiresAt`** (`approvedAt + grantHoursSnapshot`, `D-400`) | محاسب الضرائب (`Tax Accountant`) | On `REQUESTED`: `Record Grant Approval` (`POST /:id/record-approval`) once ETA reference arrives (1 active request per connection — never create a second). On `APPROVED`: select `lateSubmissionRequestId` inside `Submit` before `expiresAt`, then `Close Grant`. |

### 2.7 Four-Combination ASCII Mockups (`SCR-19A`)

#### 2.7.1 `AR-RTL · Light` — `#79` Authority Document Detail (`CANCEL_REQUESTED` + `WS-03` 72h Countdown + `DocumentViewer` & `AuthorityTimeline`)
`dir="rtl"` · Theme: `Light` (`--bg-canvas: #F8FAFC`, `--bg-surface: #FFFFFF`, `--text-primary: #0F172A`, `--border-subtle: #E2E8F0`, `--caution-surface: #FEF3C7`) · Single `primary` CTA (`Poll Status`):

```text
+----------------------------------------------------------------------------------------------------------------------+
| [Light: #F8FAFC / #FFFFFF]  مستندات مصلحة الضرائب (#78)  <  مستند <bdi>SIN-2026-000179</bdi> (#79)           dir=rtl |
| [استعلام آمن عن الحالة (Primary)] [تنزيل الأرشيف القانوني] [عرض القيد #15]   [طلب إلغاء قيد المهلة] [صادر · فاتورة] |
+----------------------------------------------------------------------------------------------------------------------+
| [!] حالة انتظار قانونية (WS-03): طلب الإلغاء مُسجّل لدى مصلحة الضرائب؛ يبقى قيد الأستاذ العام مرحّلاً دون مساس (D-110)|
|     مهلة اعتراض المشتري (72 ساعة مجمّدة): تنتهي في <bdi>2026-11-04 11:20 UTC</bdi> (المتبقي: <bdi>58h 14m</bdi>).    |
|     المسؤول: الطرف المقابل / مصلحة الضرائب · الإجراء الآمن: استخدم "استعلام آمن عن الحالة" فقط؛ لا تُكرر طلب الإلغاء. |
+----------------------------------------------------------------------------------------------------------------------+
| +--- السجل الزمني والمحاولات AuthorityTimeline (5/12) ---+  +--- عارض المستند والتحقق DocumentViewer (7/12) -------+ |
| | ● [طلب إلغاء CANCEL_REQUESTED]                         |  | المعرف الداخلي: <bdi>SIN-2026-000179</bdi>           | |
| |   مهلة الاعتراض حتى: <bdi>2026-11-04T11:20:00Z</bdi>   |  | معرف المصلحة UUID: <bdi>8F92A1C0...44E19B20</bdi>    | |
| |   حالة الاعتراض: لم يُسجّل اعتراض بعد                  |  | معرف حزمة الإرسال: <bdi>SUB-7710B...992A</bdi>       | |
| |--------------------------------------------------------|  | نوع وإصدار المستند: <bdi>I · v1.0</bdi> (ETA_INVOICE) | |
| | ● محاولة #<bdi>2</bdi> — [مقبول ACCEPTED · HTTP 202]    |  | بصمة شهادة التوقيع: <bdi>A4:9E:11:...7C</bdi>        | |
| |   المعرف المرسل: <bdi>SIN-2026-000179-2</bdi>          |  | وقت التوقيع: <bdi>2026-11-01T11:18:02Z</bdi>         | |
| |   بصمة الحزمة: <bdi>sha256:7d1e...90a4</bdi>           |  | حالة التجميد: [غير مجمّد NONE] · مخصوم: <bdi>0.00</bdi>| |
| |--------------------------------------------------------|  | المستند الضريبي المرتبط: <bdi>SIN-2026-000179</bdi> (#17)| |
| | ○ محاولة #<bdi>1</bdi> — [مهلة اتصال TIMEOUT · 504]     |  |------------------------------------------------------| |
| |   حُسمت بالاستعلام الآمن دون ازدواج (D-136 / 10m)      |  | نتائج فحص مصلحة الضرائب (validationResults):         | |
| |   نافذة منع الازدواج: <bdi>2026-11-01T11:15:00Z</bdi>  |  | [✓] <bdi>Validations / Signature</bdi> — صالح        | |
| |   معرف التتبع: <bdi>0192e8a1-77c0-7b12-...</bdi>       |  | [✓] <bdi>TaxTotals / EGS-Code</bdi> — مطابق          | |
| +--------------------------------------------------------+  +------------------------------------------------------+ |
+----------------------------------------------------------------------------------------------------------------------+
```

#### 2.7.2 `AR-RTL · Dark` — `#78` Authority Documents Filing Workspace (List + `[Full-stage]` Operational Tabs)
`dir="rtl"` · Theme: `Dark` (`--bg-canvas: #0B0F17`, `--bg-surface: #111827`, `--text-primary: #F8FAFC`, `--border-subtle: #1F2937`) · Zero resend actions in list rows:

```text
+----------------------------------------------------------------------------------------------------------------------+
| [Dark: #0B0F17 / #111827]  مستندات مصلحة الضرائب والربط الإلكتروني (#78)                                     dir=rtl |
| [*مستندات مصلحة الضرائب*]   (إشعارات الربط الفوري [Full P22])   (مهل التقديم المتأخر <bdi>1/3</bdi> [Full P22])     |
+----------------------------------------------------------------------------------------------------------------------+
| [الكل] [معلّق PENDING] [مُرسل SUBMITTED] [معتمد VALID] [مرفوض فنياً INVALID] [طلب إلغاء/رفض]   [بحث بالمعرف/UUID Q] |
| الفلاتر: [الاتجاه: الكل v] [الملف: ETA_INVOICE v] [نقطة الربط: إنتاج القاهرة v] [التجميد: الكل v] [مهلة الاعتراض v]  |
+----------------------------------------------------------------------------------------------------------------------+
| حالة الأستاذ     | المهلة القانونية        | الحالة               | UUID المصلحة        | التصنيف      | المعرف الداخلي |
|------------------|-------------------------|----------------------|---------------------|--------------|----------------|
| محجوب بانتظار رد | نافذة 10د: <bdi>06m</bdi>| [⟳ معلّق فني PENDING]| <bdi>—</bdi>        | صادر · فاتورة| <bdi>SIN-000185</bdi> |
| غير مرحّل (خطأ)  | يتطلب مراجعة السبب      | [✕ مرفوض INVALID]    | <bdi>3C11...8A02</bdi>| صادر · فاتورة| <bdi>SIN-000182</bdi> |
| مرحّل (#15) ثابت | متبقي <bdi>58h 14m</bdi>| [! طلب إلغاء]        | <bdi>8F92...9B20</bdi>| صادر · فاتورة| <bdi>SIN-000179</bdi> |
| مرحّل (#15)      | [مجمّد بإشعار دائن]     | [✓ معتمد VALID]      | <bdi>1A77...00F4</bdi>| صادر · فاتورة| <bdi>SIN-000171</bdi> |
+----------------------------------------------------------------------------------------------------------------------+
```

#### 2.7.3 `EN-LTR · Light` — `#79` Authority Document Detail (`CANCEL_REQUESTED` + `WS-03` 72h Countdown + `DocumentViewer` & `AuthorityTimeline`)
`dir="ltr"` · Theme: `Light` (`--bg-canvas: #F8FAFC`, `--bg-surface: #FFFFFF`, `--text-primary: #0F172A`, `--border-subtle: #E2E8F0`, `--caution-surface: #FEF3C7`) · Mirrored LTR `7/12` + `5/12` layout:

```text
+----------------------------------------------------------------------------------------------------------------------+
| [Light: #F8FAFC / #FFFFFF]  Authority Documents (#78)  >  Document SIN-2026-000179 (#79)                     dir=ltr |
| [CANCEL_REQUESTED] [OUTBOUND · ETA_INVOICE]     [View Entry #15] [Download Legal Archive] [Poll Status (Primary)]    |
+----------------------------------------------------------------------------------------------------------------------+
| [!] Statutory Waiting State (WS-03): Cancellation requested at ETA; GL & tax ledger remain POSTED untouched (D-110). |
|     Counterparty Decline Deadline (72h frozen snapshot): 2026-11-04 11:20 UTC (Remaining: 58h 14m).                  |
|     Owner: Counterparty / Tax Authority · Safe Next Action: Use "Poll Status" only; never re-submit cancel request.  |
+----------------------------------------------------------------------------------------------------------------------+
| +--- DocumentViewer (Start 7/12) ---------------------+  +--- AuthorityTimeline & Attempts (End 5/12) -------------+ |
| | Internal ID:         SIN-2026-000179                |  | ● [CANCEL_REQUESTED]                                    | |
| | Authority UUID:      8F92A1C0...44E19B20 [Copy]     |  |   Decline Deadline: 2026-11-04T11:20:00Z (72h snapshot) | |
| | Submission UUID:     SUB-7710B...992A               |  |   Decline Requested At: None                            | |
| | Type & Version:      I · v1.0 (ETA_INVOICE)         |  |---------------------------------------------------------| |
| | Cert Thumbprint:     A4:9E:11:...7C                 |  | ● Attempt #2 — [ACCEPTED · HTTP 202]                    | |
| | Signing Time:        2026-11-01T11:18:02Z           |  |   Submitted Internal ID: SIN-2026-000179-2              | |
| | Freeze Status:       [NONE] · Credited: 0.00 EGP    |  |   Serialized Hash: sha256:7d1e...90a4                   | |
| | Fiscal Document:     SIN-2026-000179 (#17)          |  |---------------------------------------------------------| |
| |-----------------------------------------------------|  | ○ Attempt #1 — [TIMEOUT · HTTP 504]                     | |
| | Authority Validation Steps (validationResults):     |  |   Resolved safely via Poll Status without duplicate     | |
| | [✓] Signature & Certificate Chain — Valid           |  |   10m Duplicate Window Ended: 2026-11-01T11:15:00Z      | |
| | [✓] TaxTotals & Approved EGS Item Code — Valid      |  |   Correlation ID: 0192e8a1-77c0-7b12-...                | |
| +-----------------------------------------------------+  +---------------------------------------------------------+ |
+----------------------------------------------------------------------------------------------------------------------+
```

#### 2.7.4 `EN-LTR · Dark` — `#78` Authority Documents Filing Workspace (List + `[Full-stage]` Operational Tabs)
`dir="ltr"` · Theme: `Dark` (`--bg-canvas: #0B0F17`, `--bg-surface: #111827`, `--text-primary: #F8FAFC`, `--border-subtle: #1F2937`) · Zero resend actions in list rows:

```text
+----------------------------------------------------------------------------------------------------------------------+
| [Dark: #0B0F17 / #111827]  Authority Documents & Electronic Filing (#78)                                     dir=ltr |
| [*Authority Documents*]   (Callback Notifications [Full P22])   (Late-Submission Grants 1/3 [Full P22])              |
+----------------------------------------------------------------------------------------------------------------------+
| [All] [PENDING] [SUBMITTED] [VALID] [INVALID] [CANCEL/REJECT_REQUESTED]                  [Search Internal ID/UUID Q] |
| Filters: [Direction: All v] [Profile: ETA_INVOICE v] [Connection: Cairo Prod v] [Freeze: All v] [Decline Before   v] |
+----------------------------------------------------------------------------------------------------------------------+
| Internal ID   | Direction & Profile | Authority UUID  | Status                | Statutory Window    | Ledger State   |
|---------------|---------------------|-----------------|-----------------------|---------------------|----------------|
| SIN-000185    | OUTBOUND · INVOICE  | —               | [⟳ PENDING]           | 10m guard: 06m left | Held awaiting  |
| SIN-000182    | OUTBOUND · INVOICE  | 3C11...8A02     | [✕ INVALID]           | Inspect validation  | Unposted       |
| SIN-000179    | OUTBOUND · INVOICE  | 8F92...9B20     | [! CANCEL_REQUESTED]  | 58h 14m remaining   | Posted (#15)   |
| SIN-000171    | OUTBOUND · INVOICE  | 1A77...00F4     | [✓ VALID]             | [FROZEN_BY_CREDIT]  | Posted (#15)   |
+----------------------------------------------------------------------------------------------------------------------+
```

---
## 3. `SCR-19B` (Plan `SCR-19` / Inventory Row `SCR-22`) — Unified Exception Board (`#2`)

### 3.1 Purpose, Traceability & Slice vs Full-Stage Boundary

`SCR-19B` (`/accounting/exceptions`, inventory `#2`) is the unified deadline-driven operational triage queue across Accounting (`acc_exception_board_items`, `D-401`). Every unresolved anomaly — unposted fiscal documents, timed-out or rejected authority submissions, expiring statutory windows, posting failures, and unmatched bank lines — surfaces here with an explicit `severity`, `ownerRole`, `deadlineAt`, and deterministic deep link (`targetRef`) to the owning operational workspace.

> **Absolute Row-by-Row Governance (`accounting-stage1-exceptions-bulk-rules.md` & `D-401`):**
> 1. **Zero Bulk Actions:** Bulk select checkboxes, bulk acknowledge, and bulk dismiss are **strictly forbidden** on `#2`. Every item must be inspected individually.
> 2. **Expiry Never Auto-Closes (`D-401`):** Passing `deadlineAt` stamps `expiredAt` and escalates visual urgency (`متجاوز المهلة` / `Overdue`), **never** auto-resolving or hiding the item.
> 3. **Primary Resolution vs Exceptional Dismissal:** Normal resolution happens automatically when the underlying domain action succeeds on the target screen (e.g., `Poll Status` resolves `AUTHORITY_PENDING_TIMEOUT`; `Post` resolves `UNPOSTED_DOCUMENT`). `POST /exception-board/:id/dismiss` is an audited exception-handling override governed by 5 strict dismissibility archetypes.

| Scope Tier | Active `ExceptionKind` Values (`01_Enums.md` L176–224) | Delivery Phase |
| --- | --- | --- |
| **`[Slice subset — P18]`** (`7` kinds, `13_Delivery_Plan.md` §3.6) | `UNPOSTED_DOCUMENT`, `AUTHORITY_PENDING_TIMEOUT`, `AUTHORITY_INVALID`, `RECEIVER_REJECTED`, `CANCELLATION_PENDING`, `POSTING_EXCEPTION`, `BANK_UNMATCHED` | `P18.T04` (backend) / `P18.T07` (frontend vertical slice) |
| **`[Full stage completion — P20..P27]`** (`29` remaining MVP kinds) | `TAX_UNRESOLVED`, `INBOUND_UNDECIDED`, `RECEIPT_DEADLINE`, `RECEIPT_WITHHELD`, `RECEIPT_BATCH_FAILED`, `LATE_SUBMISSION_QUOTA`, `SUPPLY_NOT_EVIDENCED`, `REVERSE_CHARGE_DUE`, `WHT_REMITTANCE_DUE`, `AUTHORITY_REQUEST`, `APPROVAL_OVERDUE`, `DEPOSIT_UNALLOCATED`, `CLEARING_UNMATCHED`, `CASH_RECONCILIATION_VARIANCE`, `CASH_DIFFERENCE_UNEXPLAINED`, `SHIFT_CLOSE_MISSING`, `CLOSED_BOX_CASH`, `EXCHANGE_RATE_MISSING`, `PERIOD_CLOSE_BLOCKED`, `YEAR_CLOSE_PROVISIONAL`, `INBOX_PARK_STALLED`, `INBOX_POSITION_LOST`, `OUTBOX_STALLED`, `PROJECTION_LAGGING`, `UNBILLED_REVENUE_AGED`, `WORK_IN_PROGRESS_AGED`, `POSTING_REDATE` *(plus `9` post-MVP wave hooks gated by wave feature entitlements)* | `P22.T02` (Documents/Tax kinds) & `P20..P27` domain stages |

### 3.2 Layout, Progressive Disclosure, Dismissibility Archetypes & Deep-Link Matrix

**Reused Components (Zero Redesign):**
- `@/design-system`: `PageHeader`, `FilterBar`, `DataTable`, `Card`, `Badge`, `Button`, `Sheet`, `Alert`, `Skeleton`, `EmptyState`, `Tooltip`.
- Approved accounting specs: `StatusBadge` + focus-return contract (`accounting-status-and-a11y.md`), row-by-row guardrails (`accounting-stage1-exceptions-bulk-rules.md`), `WaitingStateCallout` (`accounting-patterns-documents.md`), `AccountingErrorAlert`, `StaleVersionBanner`, `AmbiguousOutcomePanel`, `PermissionGate`.

#### A. `#2` `/accounting/exceptions` — Queue Workspace Layout
1. **`PageHeader`:** Title `لوحة الاستثناءات والمهام العاجلة` / `Exception Board & Urgent Deadlines`. **Zero filled `primary` buttons in `PageHeader`** (exceptions are raised exclusively by domain services).
2. **Urgency Metric Strip (4 clickable filter cards):** `حرج CRITICAL` (`negative`), `مرتفع HIGH` (`caution`), `متجاوز المهلة Overdue` (`expiredAt != null`), and `تنتهي خلال 24 ساعة Due < 24h`.
3. **`FilterBar`:** Search input (`POST /exception-board/search`) + `severity` (`CRITICAL | HIGH | WARNING | INFO`), `kind` (grouped by Slice / Tax & Authority / Cash & POS / Close & Integration; wave-only kinds omitted unless entitled), `ownerRole`, and `deadlineBefore` (`ISO8601` quick presets: `Overdue`, `< 24h`, `< 72h`, `This Week`). *(`status`, `acknowledgedBy` and `severity` filter through the repository `filter` whitelist or `POST /exception-board/search`; there is no `cursor`, `CG-SLICE-DOC-08 (b)`.)*
4. **Compact `DataTable` (`40px` rows, zero selection checkboxes):**
   - `severity` (`StatusBadge`: icon + localized label `حرج` / `Critical`, `مرتفع` / `High`, `تحذير` / `Warning`, `معلومة` / `Info`)
   - Localized `kind` label + `<bdi dir="ltr">{summary / source code}</bdi>`
   - Target chip (e.g. `<bdi dir="ltr">SIN-2026-000185</bdi>`)
   - `ownerRole` + `status` pill (`مفتوح OPEN` vs `قيد المتابعة ACKNOWLEDGED` + assignee avatar/name)
   - `deadlineAt` live countdown (`<bdi dir="ltr">14h 22m</bdi>`, switching to `متجاوز المهلة منذ ...` / `Overdue by ...` badge when `expiredAt != null`)
   - Single row action button: `مراجعة ومعالجة` / `Inspect & Resolve` (opens `ExceptionInspectorSheet`).

#### B. `ExceptionInspectorSheet` (`Sheet` Slide-Over, `520px` Logical End) & 5 Dismissibility Archetypes
Opening a row slides in `ExceptionInspectorSheet` while keeping `#2` mounted underneath:
1. **Sheet Header & Target Deep-Link Card:**
   - Displays `severity`, `status`, `kind`, `openedAt`, `deadlineAt`, `expiredAt`, `acknowledgedBy`/`acknowledgedAt`, and structured `details` key-value facts.
   - **Single `primary` CTA inside the Sheet:** **`فتح السجل الأساسي للمعالجة` / `Open Source Record to Resolve`** — navigates via `next/link` to the authoritative screen mapped from `targetRef`:
     - `[Slice P18]` `UNPOSTED_DOCUMENT`, `POSTING_EXCEPTION` (doc-scoped) -> `#17` `/accounting/post/fiscal-documents/${id}`
     - `[Slice P18]` `AUTHORITY_PENDING_TIMEOUT`, `AUTHORITY_INVALID`, `RECEIVER_REJECTED`, `CANCELLATION_PENDING` -> `#79` `/accounting/file/authority-documents/${id}`
     - `[Slice P18]` `BANK_UNMATCHED` -> `#39` `/accounting/reconcile/bank-accounts/${bankAccountId}/reconcile?lineId=${id}`
     - `[Full-stage]` `TAX_UNRESOLVED` -> `#17`; `INBOUND_UNDECIDED` -> `#79`; `REVERSE_CHARGE_DUE` -> `#19` `/accounting/post/self-invoices/${id}`; `LATE_SUBMISSION_QUOTA` -> `#78?tab=late-grants`; `AUTHORITY_REQUEST` / `WHT_REMITTANCE_DUE` -> `#76` Tax Returns; `APPROVAL_OVERDUE` -> `#62` Approvals; `SHIFT_CLOSE_MISSING` / `CLOSED_BOX_CASH` / `CASH_DIFFERENCE_UNEXPLAINED` -> POS/Cash Shift workspace; `INBOX_PARK_STALLED` / `INBOX_POSITION_LOST` / `OUTBOX_STALLED` -> `#67` Integration Health; `PERIOD_CLOSE_BLOCKED` / `YEAR_CLOSE_PROVISIONAL` -> `#8` Fiscal Periods.
2. **Ownership Action (`outline` button):**
   - When `status === 'OPEN'` and `hasPermission('accounting.exception_board.assign')`: **`استلام المتابعة` / `Acknowledge & Assign to Me`** (`POST /exception-board/:id/assign`, empty `{}` body, `If-Match`).
3. **Progressive-Disclosure Dismissal Section (`POST /exception-board/:id/dismiss`, `If-Match`):**
   Dynamically switches across the **5 Contract Archetypes** (`02_DTOs.md` L1628–1706):

| Archetype | Applicable `ExceptionKind`s | Form Controls & Required Permissions |
| --- | --- | --- |
| **A. `NEVER_DISMISSIBLE`** `[Full]` | Always: `SUPPLY_NOT_EVIDENCED`.<br>Conditionally: active `INBOX_PARK_STALLED`; parked-reissue `RECEIPT_DEADLINE`; `RECEIPT_WITHHELD` & POS `INBOX_POSITION_LOST` before `late_submission_days` elapses; multi-period straddle `CASH_DIFFERENCE_UNEXPLAINED`. | **Dismiss button disabled & form hidden.** Info callout explains exact resolution prerequisite (e.g. issue invoice for `SUPPLY_NOT_EVIDENCED`, or wait until `<bdi dir="ltr">{dismissibleAt}</bdi>` after `late_submission_days`). Server also enforces `409 ACCOUNTING.DOCUMENT.BOARD_ITEM_NOT_DISMISSIBLE`. |
| **B. `REASON_ONLY`** `[Slice + Full]` | **All `7` `[Slice P18]` kinds** + standard `[Full-stage]` kinds (`TAX_UNRESOLVED`, `INBOUND_UNDECIDED`, `RECEIPT_BATCH_FAILED`, `LATE_SUBMISSION_QUOTA`, `REVERSE_CHARGE_DUE`, `WHT_REMITTANCE_DUE`, `APPROVAL_OVERDUE`, `DEPOSIT_UNALLOCATED`, `CLEARING_UNMATCHED`, `CASH_RECONCILIATION_VARIANCE`, `EXCHANGE_RATE_MISSING`, `PERIOD_CLOSE_BLOCKED`, `YEAR_CLOSE_PROVISIONAL`, `OUTBOX_STALLED`, `PROJECTION_LAGGING`, `UNBILLED_REVENUE_AGED`, `WORK_IN_PROGRESS_AGED`, `POSTING_REDATE`, recovered `INBOX_PARK_STALLED`, non-POS `INBOX_POSITION_LOST`). | Permission: `accounting.exception_board.dismiss`.<br>Fields: `reason` (`textarea`, `10..1,000` chars, live counter) + conditional `approvalRequestId` (`UUID` picker when cross-period `POSTING_REDATE`) + conditional `leftOutPlaceholderIds` (`UUID[]` `1..20` multi-select when placeholder docs are left out). |
| **C. `AUTHORITY_DECISION`** `[Full]` | `AUTHORITY_REQUEST` (`D-739`) | Permissions (**ALL**): `accounting.exception_board.dismiss` **+** `accounting.tax_return.amend`.<br>Fields: `authorityDecision` (`ALLOWED \| REFUSED` radio), `authorityReference` (`1..120` chars), `reason` (`10..1,000` chars). |
| **D. `SHIFT_CUTOFF_POSTING`** `[Full]` | `SHIFT_CLOSE_MISSING`, `CLOSED_BOX_CASH` (`D-734`) | Permissions: `accounting.exception_board.dismiss` (**+ `accounting.journal_draft.post`** on `CLOSED_BOX_CASH`).<br>Fields: `reason` (`10..1,000` chars); on `SHIFT_CLOSE_MISSING`, strictly ascending `entryDates: ISODate[]` (`1..31` inside `[shiftOpenedDate, min(cutoffDate, today)]`) + optional `approvalRequestId`. |
| **E. `POS_JOURNAL_SETTLEMENT`** `[Full]` | `RECEIPT_WITHHELD` (after `late_submission_days`), POS `INBOX_POSITION_LOST` (after `late_submission_days`), single-period `CASH_DIFFERENCE_UNEXPLAINED` (`D-734`) | Permissions (**ALL**): `accounting.exception_board.dismiss` **+** `accounting.journal_draft.post`.<br>Fields: `reason` (`10..1,000` chars) + structured `settlement: PosSaleSettlementInput[]` grid (`1..200` sales: `posSaleId`, `saleTimestamp`, `entryDate`, `branchId`, `currencyCode`, `fxRateId?`, `tenders[]`, `lines[]`, `untaxedLines?`, `extraDiscountAmount?`, `roundingDifference?`, `partyId?`, `onAccountAmount?`). |

### 3.3 Complete Field-to-DTO Mapping (`SCR-19B`)

| Surface | UI Element (`AR` / `EN`) | Exact DTO & Member (`02_DTOs.md` §7.1, §7.2 & ERD `acc_exception_board_items`) | Type & Constraints |
| --- | --- | --- | --- |
| `#2` Filter | نوع الاستثناء / Exception Kind | `ExceptionBoardListQueryDto.kind` | `ExceptionKind?` |
| `#2` Filter | درجة الخطورة / Severity | `ExceptionBoardListQueryDto.severity` | `ExceptionSeverity?` (`CRITICAL \| HIGH \| WARNING \| INFO`) |
| `#2` Filter | الدور المسؤول / Owner Role | `ExceptionBoardListQueryDto.ownerRole` | `string?` (`max 64`) |
| `#2` Filter | المهلة قبل / Deadline Before | `ExceptionBoardListQueryDto.deadlineBefore` | `ISO8601?` |
| `#2` Search | بحث نصي / Search | `SearchManyDto.query` (`POST /exception-board/search`) | `string` |
| `#2` Row & Sheet | حقول عنصر الاستثناء / Item Projection | `ExceptionBoardItemSummaryDto` (`id`, `companyId`, `branchId`, `kind`, `severity`, `status`, `targetRef`, `titleKey`, `details`, `deadlineAt`, `deadlineParameterCode`, `deadlineValueSnapshot`, `expiredAt`, `ownerRole`, `openedAt`, `lastSeenAt`, `sourceGeneration`, `acknowledgedBy`, `acknowledgedAt`, `resolvedBy`, `resolvedAt`, `resolutionCode`, `resolutionNote`, `authorityReference`, `authorityDecision`, audit columns, `version`) | `status`: `ExceptionBoardStatus` (`OPEN \| ACKNOWLEDGED \| RESOLVED`). `version` is the `If-Match` value of `assign` and `dismiss`; `targetRef`, `details` and `resolutionNote` are included (`D-772`, `CG-SLICE-DOC-08`). |
| Assign CTA | استلام المتابعة / Acknowledge | `POST /exception-board/:id/assign` | **Empty `{}` body** (`D-401`); uses authenticated operator identity |
| Dismiss Form | مبرر الاستبعاد / Dismissal Reason | `DismissExceptionBoardItemDto.reason` | `string` (`10..1,000` chars, required across all dismissible archetypes) |
| Dismiss (Arch D) | تواريخ قيود الوردية / Shift Entry Dates | `DismissExceptionBoardItemDto.entryDates` | `ISODate[]?` (`1..31`, strictly ascending) |
| Dismiss (Cross-Period) | طلب اعتماد الفترة المغلقة / Approval ID | `DismissExceptionBoardItemDto.approvalRequestId` | `UUID?` |
| Dismiss (Arch C) | قرار ومرجع مصلحة الضرائب / Authority Decision | `DismissExceptionBoardItemDto.{authorityDecision, authorityReference}` | `'ALLOWED' \| 'REFUSED'`, `string` (`1..120`) |
| Dismiss (Arch B) | معرفات العناصر المستثناة / Left-Out Placeholders | `DismissExceptionBoardItemDto.leftOutPlaceholderIds` | `UUID[]?` (`1..20`) |
| Dismiss (Arch E) | تسوية مبيعات نقاط البيع / POS Settlement | `DismissExceptionBoardItemDto.settlement[]` (`PosSaleSettlementInput`) | `1..200` items; each has `posSaleId`, `saleTimestamp`, `entryDate`, `branchId`, `currencyCode`, `fxRateId?`, `tenders[]` (`PosSettlementTenderInput`), `lines[]` (`PosSettlementLineInput`), `untaxedLines?` (`PosSettlementUntaxedLineInput`), `extraDiscountAmount?`, `roundingDifference?`, `partyId?`, `onAccountAmount?` (`DecimalString` exact) |

### 3.4 Action-to-Route, Permission, Feature Key, Scope, Concurrency & Idempotency Matrix (`SCR-19B`)

| Role | Slice / Stage | UI Action (`AR` / `EN`) | Method & Browser Gateway Path | Exact Permission(s) | Feature Key | Scope Target | Idempotency | Concurrency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `[P]` | `[Slice P18]` | عرض لوحة الاستثناءات / Load Queue | `GET /api/tenant/accounting/v1/exception-board` | `accounting.exception_board.read` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | `none` | `none` *(items carry `version`, the `If-Match` of `assign` and `dismiss`)* |
| `[P]` | `[Slice P18]` | بحث في الاستثناءات / Search Queue | `POST /api/tenant/accounting/v1/exception-board/search` | `accounting.exception_board.read` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | `none` | `none` |
| `[P]` | `[Slice P18]` | استلام المتابعة / Acknowledge Item | `POST /api/tenant/accounting/v1/exception-board/:id/assign` | `accounting.exception_board.assign` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | `x-idempotency-key` (UUIDv7) | `If-Match` (`version` / `ETag`) |
| `[P]` | `[Slice P18]` | استبعاد مبرر (قياسي) / Dismiss (Archetype B) | `POST /api/tenant/accounting/v1/exception-board/:id/dismiss` | `accounting.exception_board.dismiss` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | `x-idempotency-key` (UUIDv7) | `If-Match` (`version` / `ETag`) |
| `[P]` | `[Full P22.T02]` | استبعاد طلب مصلحة الضرائب / Dismiss `AUTHORITY_REQUEST` | `POST /api/tenant/accounting/v1/exception-board/:id/dismiss` | `accounting.exception_board.dismiss` **AND** `accounting.tax_return.amend` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | `x-idempotency-key` (UUIDv7) | `If-Match` (`version` / `ETag`) |
| `[P]` | `[Full P22.T02]` | استبعاد بتسوية قيد يومية / Dismiss `CLOSED_BOX_CASH` or `settlement[]` | `POST /api/tenant/accounting/v1/exception-board/:id/dismiss` | `accounting.exception_board.dismiss` **AND** `accounting.journal_draft.post` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | `x-idempotency-key` (UUIDv7) | `If-Match` (`version` / `ETag`) |
| `[S]` | `[Slice + Full]` | الانتقال للسجل الهدف / Navigate to `targetRef` | Client `Link` to `#17`, `#79`, `#39`, `#19`, `#62`, `#67`, `#76`, `#8` | Target screen read permission | Target screen feature key | Inherited context | `none` | `none` |

### 3.5 Screen States, Deterministic `409` Order & Focus-Return Contract (`SCR-19B`)

| State Category | Trigger / Condition | Reused Component | Exact Bilingual UX Behavior & Safe Action |
| --- | --- | --- | --- |
| **Empty (Zero Open Exceptions)** | `GET /exception-board` returns `[]` with no active filter | `EmptyState` (`positive` calm state) | Heading: `لا توجد استثناءات مفتوحة حالياً` / `Zero open exceptions right now`. Subtitle notes last refresh timestamp and confirms background reconciliation is healthy; zero celebratory confetti or non-semantic colors. |
| **Empty (Filtered)** | `[]` with active `severity`/`kind`/`ownerRole`/`deadlineBefore` | `EmptyState` (filtered) | `لا توجد استثناءات تطابق الفلاتر المحددة` / `No exceptions match the selected filters` + `مسح الفلاتر` / `Clear filters`. |
| **Loading** | Initial queue load or filter change | `Skeleton` | 4 metric card skeletons + 8×`40px` `DataTable` skeleton rows. |
| **`403` Permission Denied** | Missing `accounting.exception_board.read` (route) or `assign` / `dismiss` / companion `tax_return.amend` / `journal_draft.post` | `PermissionGate` / disabled CTA + `Tooltip` | **Never rendered as "Zero open exceptions"!** Route `403` renders `PermissionGate` naming `accounting.exception_board.read`. Inside `ExceptionInspectorSheet`, missing companion permissions (`accounting.tax_return.amend` on `AUTHORITY_REQUEST` or `accounting.journal_draft.post` on `CLOSED_BOX_CASH` / `settlement[]`) disables `Dismiss` and names both required keys. |
| **Feature Entitlement (`403 NOT_ENTITLED`)** | Tenant lacks `accounting.ledger.core` (or submits a reserved wave `ExceptionKind`) | `FeatureEntitlementGate` | Names `accounting.ledger.core` on route entry; wave kinds remain hidden until wave entitlement is active. |
| **Recovery Mode (`403 RECOVERY_MODE`)** | Company in recovery mode | `Alert` (`caution` top banner) | Queue list, search, and `Open Source Record` navigation remain live; `Acknowledge` (`assign`) and `Dismiss` (`dismiss`) are disabled until recovery exits. |
| **Deterministic `409` Evaluation Order (`02_DTOs.md` L1703–1705)** | `POST /exception-board/:id/assign` or `dismiss` fails | `StaleVersionBanner` / `AccountingErrorAlert` | UI handles errors in the exact backend evaluation sequence:<br>1. **`400` / `403` Shape & Permission:** Field-level highlight (`reason`, `entryDates`, `authorityReference`, `settlement[]`) or permission alert.<br>2. **`409 ACCOUNTING.CONCURRENCY.STALE_VERSION`:** Checked **before** status (`RESOLVED` items with stale `If-Match` still return `STALE_VERSION`!). Renders `StaleVersionBanner` -> `Reload Queue & Item`; if reload reveals `status === 'RESOLVED'`, announces *"تمت معالجة هذا الاستثناء بالفعل بواسطة النظام أو مستخدم آخر"* / *"Already resolved by system or another operator"* and advances focus to next open row.<br>3. **`409 ACCOUNTING.DOCUMENT.BOARD_ITEM_NOT_DISMISSIBLE`:** Explains the exact unsatisfied precondition (e.g. `late_submission_days` not yet elapsed, stream still parked, or `SUPPLY_NOT_EVIDENCED`).<br>4. **Under-Lock Posting/Date Refusals (`409`):** `RECONCILED_RANGE_POSTING`, `BACKDATED_CARRYING_CONFLICT`, `FISCAL_PERIOD.CLOSED_PERIOD`, or `APPROVAL.REQUIRED` -> highlights `entryDate` / `approvalRequestId` picker without losing typed `settlement[]` rows. |
| **Timeout / Ambiguous Outcome** | Network drop during `assign` or `dismiss` | `AmbiguousOutcomePanel` | Re-queries `GET /exception-board` before allowing exact idempotent replay with the **same** `x-idempotency-key` and `If-Match` (critical on Archetype D/E where `dismiss` posts journals!). |
| **Focus-Return A11y** | Opening/closing `Sheet` or resolving an item | `Sheet` focus manager + `aria-live="polite"` | Esc / close returns focus to the triggering row's `Inspect & Resolve` button. When an item transitions to `RESOLVED`, focus moves to the next open row's `Inspect & Resolve` button (or `EmptyState` heading if `0` remain). |

### 3.6 Waiting States on `SCR-19B` (Deadline, Owner, Next Safe Action — Never Implying a Resend)

| Exception Kind & Tier | What We Wait On (`AR` / `EN`) | Deadline & Overdue Behavior (`D-401`) | Owner (`ownerRole`) | Next Safe Action (Resend Strictly Forbidden) |
| --- | --- | --- | --- | --- |
| **`AUTHORITY_PENDING_TIMEOUT`** `[Slice P18]` | رد مصلحة الضرائب بعد تجاوز `submission_pending_timeout_hours` (`4 h`) / Delayed ETA response on `PENDING` or `SUBMITTED` doc | `deadlineAt` -> stamps `expiredAt` if breached; stays `OPEN`/`ACKNOWLEDGED` | محاسب الضرائب (`TAX_ACCOUNTANT`) | **Open `#79` and click `Poll Status` (`POST /authority-documents/:id/poll`).** Sheet explicitly warns: *"لا تُعد إنشاء المستند أو إرساله؛ الاستعلام يحسم النتيجة بأمان"* / *"Never recreate or resend; polling resolves safely."* |
| **`CANCELLATION_PENDING`** `[Slice P18]` | انتهاء مهلة 72 ساعة لاعتراض الطرف المقابل على طلب الإلغاء / Counterparty `72 h` decline window on `CANCEL_REQUESTED` | `deadlineAt = declineDeadlineAt` (`72 h` frozen snapshot, `D-110`) | محاسب الضرائب (`TAX_ACCOUNTANT`) | **Wait for `declineDeadlineAt` or `Poll Status` on `#79`.** Ledger stays `POSTED` until final `CANCELLED`; never cancel locally. |
| **`RECEIVER_REJECTED`** `[Slice P18]` | معالجة طلب رفض المشتري (`REJECT_REQUESTED`) أو نتيجة الرفض النهائي (`REJECTED`) / Buyer rejection review or replacement issuance | `deadlineAt = declineDeadlineAt` while `REJECT_REQUESTED` | محاسب الضرائب / حسابات العملاء (`TAX_ACCOUNTANT` / `AR`) | While `REJECT_REQUESTED`: open `#79` to `Decline` (if contesting) or wait for expiry. Once `REJECTED`: issue replacement via superseding `sourceVersion` on `#16`. |
| **`INBOUND_UNDECIDED`** `[Full P22.T02]` | مراجعة فاتورة مورد واردة قبل القبول القانوني الضمني / Supplier e-Invoice review before **deemed acceptance in law (`D-108`)** | `deadlineAt = receiverDecisionDeadlineAt` (`72 h` frozen snapshot) | محاسب المشتريات / الضرائب (`AP` / `TAX_ACCOUNTANT`) | **Match to supplier bill (`#16`) or `Request Rejection` (`#79`) before `deadlineAt`.** Silence past `deadlineAt` = legal acceptance. |
| **`RECEIPT_WITHHELD` / POS `INBOX_POSITION_LOST`** `[Full P22.T02]` | استرجاع إيصال نقطة البيع أو انقضاء `late_submission_days` قبل السماح بالتسوية الدفترية / POS receipt recovery or `late_submission_days` statutory hold | Non-dismissible (`Archetype A`) until `saleTimestamp + late_submission_days`, then unlocks `Archetype E` (`settlement[]`) | رئيس الحسابات / محاسب الضرائب (`CHIEF_ACCOUNTANT`) | Recover POS batch/grant on `#78` first; only after `late_submission_days` elapses may operator post fallback `settlement[]` via `Dismiss`. Never re-upload duplicate POS sales. |

### 3.7 Four-Combination ASCII Mockups (`SCR-19B`)

#### 3.7.1 `AR-RTL · Light` — `#2` Exception Board + Open `ExceptionInspectorSheet` (`AUTHORITY_PENDING_TIMEOUT` `[Slice P18]`)
`dir="rtl"` · Theme: `Light` (`--bg-canvas: #F8FAFC`, `--bg-surface: #FFFFFF`, `--text-primary: #0F172A`, `--border-subtle: #E2E8F0`) · Zero bulk checkboxes · Single `primary` CTA inside `Sheet` navigates to `#79`:

```text
+----------------------------------------------------------------------------------------------------------------------+
| [Light: #F8FAFC / #FFFFFF]  لوحة الاستثناءات والمهام العاجلة (#2)                                            dir=rtl |
| [حرج CRITICAL: <bdi>2</bdi>]  [مرتفع HIGH: <bdi>4</bdi>]  [متجاوز المهلة: <bdi>1</bdi>]  [تنتهي < 24س: <bdi>3</bdi>] |
+----------------------------------------------------------------------------------------------------------------------+
| +--- تفاصيل ومعالجة الاستثناء Sheet (520px End) ---+  +--- طابور الاستثناءات المرتب بالمهلة (Main Queue) ---------+ |
| | [مرتفع HIGH] [مفتوح OPEN] · <bdi>ETag: "v1"</bdi> |  | الفلاتر: [الخطورة: الكل v] [النوع: شريحة P18 v] [بحث Q]  | |
| | تأخر رد مصلحة الضرائب (AUTHORITY_PENDING_TIMEOUT) |  |----------------------------------------------------------| |
| | السجل الهدف: مستند مصلحة الضرائب <bdi>SIN-000185</bdi>| | إجراء          | المهلة           | المسؤول  | الاستثناء   | |
| | نشأ في: <bdi>2026-11-01 10:15 UTC</bdi>           |  |----------------|------------------|----------|-------------| |
| | المهلة: متبقي <bdi>01h 45m</bdi> (لا يُغلق آلياً) |  | [مراجعة]       | متجاوز <bdi>3h</bdi>| ضرائب  | [حرج] مرفوض | |
| |---------------------------------------------------|  | [*مفتوح الآن*] | متبقي <bdi>1h45m</bdi>| ضرائب | [مرتفع] تأخر| |
| | [!] انتظار آمن: لا تُعد إرسال المستند مطلقاً.      |  | [مراجعة]       | متبقي <bdi>58h</bdi>| ضرائب   | [تحذير] إلغاء| |
| | [فتح مستند مصلحة الضرائب #79 للاستعلام (Primary)] |  | [مراجعة]       | متبقي <bdi>5d</bdi> | خزانة   | [تحذير] بنك | |
| | [استلام المتابعة (Assign to Me)]                  |  |----------------------------------------------------------| |
| |---------------------------------------------------|  | * يُحظر التحديد الجماعي أو الإغلاق الجماعي (D-401)       | |
| | استبعاد استثنائي مبرر (Archetype B — Reason Only) |  +----------------------------------------------------------+ |
| | السبب الإلزامي (<bdi>10..1000</bdi> حرف):         |                                                               |
| | [تم التحقق عبر بوابة المصلحة وجاري ربط الإشعار..] |                                                               |
| | [تأكيد الاستبعاد المبرر]                          |                                                               |
| +---------------------------------------------------+                                                               |
+----------------------------------------------------------------------------------------------------------------------+
```

#### 3.7.2 `AR-RTL · Dark` — `#2` Exception Board + Open `ExceptionInspectorSheet` (`AUTHORITY_REQUEST` `[Full P22.T02]`)
`dir="rtl"` · Theme: `Dark` (`--bg-canvas: #0B0F17`, `--bg-surface: #111827`, `--text-primary: #F8FAFC`, `--border-subtle: #1F2937`, `--negative-surface: #450A0A`):

```text
+----------------------------------------------------------------------------------------------------------------------+
| [Dark: #0B0F17 / #111827]   لوحة الاستثناءات والمهام العاجلة (#2)                                            dir=rtl |
| [حرج CRITICAL: <bdi>2</bdi>]  [مرتفع HIGH: <bdi>4</bdi>]  [متجاوز المهلة: <bdi>1</bdi>]  [تنتهي < 24س: <bdi>3</bdi>] |
+----------------------------------------------------------------------------------------------------------------------+
| +--- تفاصيل ومعالجة الاستثناء Sheet (520px End) ---+  +--- طابور الاستثناءات المرتب بالمهلة (Main Queue) ---------+ |
| | [حرج CRITICAL] [قيد المتابعة] · متجاوز المهلة!    |  | الفلاتر: [الخطورة: حرج/مرتفع v] [النوع: الكل v] [بحث Q]   | |
| | طلب مصلحة الضرائب لتعديل إقرار (AUTHORITY_REQUEST)|  |----------------------------------------------------------| |
| | السجل الهدف: إقرار ضريبي <bdi>VAT-2026-09</bdi>   |  | إجراء          | المهلة           | المسؤول  | الاستثناء   | |
| | تجاوز المهلة منذ: <bdi>03h 12m</bdi> (expiredAt)  |  |----------------|------------------|----------|-------------| |
| | المتابع الحالي: سارة محمود                        |  | [*مفتوح الآن*] | متجاوز <bdi>3h</bdi>| ضرائب  | [حرج] طلب مصلحة|
| |---------------------------------------------------|  | [مراجعة]       | متبقي <bdi>1h45m</bdi>| ضرائب | [مرتفع] تأخر| |
| | [فتح الإقرار الضريبي #76 للمراجعة (Primary)]     |  | [مراجعة]       | غير قابل للاستبعاد| ضرائب   | [حرج] توريد | |
| |---------------------------------------------------|  |----------------------------------------------------------| |
| | قرار مصلحة الضرائب (Archetype C · يتطلب صلاحيتين):|  | الصلاحيات المطلوبة للاستبعاد هنا:                        | |
| | الصلاحيات: dismiss + accounting.tax_return.amend  |  | exception_board.dismiss + tax_return.amend (D-739)       | |
| | القرار: (*) قبول ALLOWED   ( ) رفض REFUSED        |  +----------------------------------------------------------+ |
| | مرجع المصلحة: [<bdi>ETA-AMD-2026-88412</bdi>    ] |                                                               |
| | المبرر: [صدرت موافقة المأمورية على تعديل الإقرار] |                                                               |
| | [تثبيت قرار المصلحة وإغلاق الاستثناء]             |                                                               |
| +---------------------------------------------------+                                                               |
+----------------------------------------------------------------------------------------------------------------------+
```

#### 3.7.3 `EN-LTR · Light` — `#2` Exception Board + Open `ExceptionInspectorSheet` (`AUTHORITY_PENDING_TIMEOUT` `[Slice P18]`)
`dir="ltr"` · Theme: `Light` (`--bg-canvas: #F8FAFC`, `--bg-surface: #FFFFFF`, `--text-primary: #0F172A`, `--border-subtle: #E2E8F0`) · Mirrored LTR layout (`Sheet` anchored at logical end / visual right):

```text
+----------------------------------------------------------------------------------------------------------------------+
| [Light: #F8FAFC / #FFFFFF]  Exception Board & Urgent Deadlines (#2)                                          dir=ltr |
| [CRITICAL: 2]   [HIGH: 4]   [Overdue (expiredAt): 1]   [Due < 24h: 3]                                                |
+----------------------------------------------------------------------------------------------------------------------+
| +--- Deadline-Sorted Exception Queue (Main) --------+  +--- ExceptionInspectorSheet (520px Logical End) -----------+ |
| | Filters: [Severity: All v] [Kind: Slice P18 v] [Q]|  | [HIGH] [OPEN] · Version ETag: "v1"                        | |
| |---------------------------------------------------|  | Authority Submission Timeout (AUTHORITY_PENDING_TIMEOUT)  | |
| | Exception          | Owner | Deadline    | Action |  | Target Record: Authority Doc SIN-000185 (#79)             | |
| |--------------------|-------|-------------|--------|  | Raised At: 2026-11-01 10:15 UTC                           | |
| | [CRIT] Invalid Doc | Tax   | Overdue 3h  | [Open] |  | Deadline: 01h 45m left (Never auto-closes on expiry)      | |
| | [HIGH] ETA Timeout | Tax   | 1h 45m left | [*On*] |  |-----------------------------------------------------------| |
| | [WARN] Cancel Wait | Tax   | 58h left    | [Open] |  | [!] Safe Wait: Never recreate or resend this invoice.     | |
| | [WARN] Bank Unmatch| Treas | 5d left     | [Open] |  | [Open Authority Document #79 to Poll (Primary)]           | |
| |---------------------------------------------------|  | [Acknowledge & Assign to Me]                              | |
| | * Bulk select/dismiss strictly prohibited (D-401) |  |-----------------------------------------------------------| |
| +---------------------------------------------------+  | Audited Override Dismiss (Archetype B — Reason Only)      | |
|                                                        | Mandatory Reason (10..1,000 chars):                       | |
|                                                        | [Verified on ETA portal; webhook sync queued...         ] | |
|                                                        | [Confirm Audited Dismissal]                               | |
|                                                        +-----------------------------------------------------------+ |
+----------------------------------------------------------------------------------------------------------------------+
```

#### 3.7.4 `EN-LTR · Dark` — `#2` Exception Board + Open `ExceptionInspectorSheet` (`AUTHORITY_REQUEST` `[Full P22.T02]`)
`dir="ltr"` · Theme: `Dark` (`--bg-canvas: #0B0F17`, `--bg-surface: #111827`, `--text-primary: #F8FAFC`, `--border-subtle: #1F2937`, `--negative-surface: #450A0A`):

```text
+----------------------------------------------------------------------------------------------------------------------+
| [Dark: #0B0F17 / #111827]   Exception Board & Urgent Deadlines (#2)                                          dir=ltr |
| [CRITICAL: 2]   [HIGH: 4]   [Overdue (expiredAt): 1]   [Due < 24h: 3]                                                |
+----------------------------------------------------------------------------------------------------------------------+
| +--- Deadline-Sorted Exception Queue (Main) --------+  +--- ExceptionInspectorSheet (520px Logical End) -----------+ |
| | Filters: [Severity: Crit/High v] [Kind: All v] [Q]|  | [CRITICAL] [ACKNOWLEDGED] · [OVERDUE +03h 12m]            | |
| |---------------------------------------------------|  | Tax Authority Amendment Request (AUTHORITY_REQUEST)       | |
| | Exception          | Owner | Deadline    | Action |  | Target Record: Tax Return VAT-2026-09 (#76)               | |
| |--------------------|-------|-------------|--------|  | Expired At: 2026-11-01 15:00 UTC · Assignee: Sara M.      | |
| | [CRIT] Auth Req.   | Tax   | Overdue 3h  | [*On*] |  |-----------------------------------------------------------| |
| | [HIGH] ETA Timeout | Tax   | 1h 45m left | [Open] |  | [Open Tax Return #76 to Review (Primary)]                 | |
| | [CRIT] Unbilled Ev.| Tax   | Non-dismiss | [Open] |  |-----------------------------------------------------------| |
| |---------------------------------------------------|  | Authority Decision Override (Archetype C — Dual RBAC):    | |
| | Dual RBAC required on AUTHORITY_REQUEST:          |  | Requires: exception_board.dismiss + tax_return.amend      | |
| | exception_board.dismiss + tax_return.amend (D-739)|  | Decision: (*) ALLOWED   ( ) REFUSED                       | |
| +---------------------------------------------------+  | Authority Ref: [ETA-AMD-2026-88412                      ] | |
|                                                        | Reason: [Written ETA tax office approval received...    ] | |
|                                                        | [Record Authority Decision & Resolve]                     | |
|                                                        +-----------------------------------------------------------+ |
+----------------------------------------------------------------------------------------------------------------------+
```

---

## 4. Consolidated Contract & Inventory Gap List for `P03.T11`

Nothing in §§1–3 invents an undocumented endpoint, field, enum, or permission. All contract and inventory discrepancies discovered while designing `SCR-17`, `SCR-19A`, and `SCR-19B` are isolated below for formal resolution in **`P03.T11`**:

| Gap ID | Severity | Affected Screen(s) & Endpoint(s) | Exact Citation in Upstream Docs | Gap Description & Recommended `P03.T11` Resolution |
| --- | --- | --- | --- | --- |
| **`CG-SLICE-DOC-01`** | **Medium (Plan/Inventory Sync)** | `SCR-17`, `SCR-19`, `SCR-22` | `accounting-app-plan-p03-ux-foundation.md` (`P03.T10.S1`) vs `accounting-screen-inventory.md` rows `SCR-17`, `SCR-19`, `SCR-22` & `13_Delivery_Plan.md` §3.6 | Plan `P03.T10.S1` bundled Fiscal + Authority Documents under `SCR-17` and named Exception Board `SCR-19`; `accounting-screen-inventory.md` split Authority Documents into `SCR-19` (`[P: 19]`) and shifted Exception Board to `SCR-22` with status `design later (P22.T02)` even though `13_Delivery_Plan.md` §3.6 includes Exception Board in the `P18` vertical slice. Update `accounting-screen-inventory.md` row `SCR-22` status from `design later (P22.T02)` to `slice-designed in P03.T10.S1 (full completion P22.T02)` and cross-link `SCR-17` / `SCR-19` / `SCR-22`. |
| **`CG-SLICE-DOC-02`** | **High (Missing Request DTOs)** | `SCR-17` (`#17` Cancel, Attachments Legal Hold, `#18` Create Self-Invoice) | `02_Endpoint_Catalogue.md` L495 (`POST /fiscal-documents/:id/cancel`), L562 (`POST /attachments/:id/legal-hold`), L570 (`POST /self-invoices`); `04_Static_Data/02_DTOs.md` §7 | `02_DTOs.md` §7 does not declare explicit TypeScript interfaces for `CancelFiscalDocumentDto` (Module 04 §6 L282 specifies `reason`), `SetAttachmentLegalHoldDto` (ERD `acc_attachments` has `legal_hold: boolean` + `legal_hold_reason: varchar(500)`), or `CreateSelfInvoiceDto` (`sourcePurchaseRef`, `sourceFiscalDocumentId`, `supplierPartyId`, `supplierSrrNumber?`, `taxPointDate`, `taxableBase`, `taxAmount`, `currencyCode`, `submittedToAuthority?`). Declare all three interfaces explicitly in `02_DTOs.md` §7.2 before `forbidNonWhitelisted` implementation. |
| **`CG-SLICE-DOC-03`** | **High (First-Submit Path/ETag)** | `SCR-17` (`#17`) -> `SCR-19A` (`POST /authority-documents/:id/submit`) | `02_Endpoint_Catalogue.md` L503 (`POST /accounting/authority-documents/:id/submit`, `If-Match`) vs `02_DTOs.md` L1591 (`SubmitAuthorityDocumentDto.fiscalDocumentId`) & Module 04 §7 (`AuthorityDocumentService.prepare`) | On initial submission from a `TAX_RESOLVED` fiscal document (`#17`), `FiscalDocumentDetailDto.authorityDocumentId` is `null` until `AuthorityDocumentService.prepare` creates the `DRAFT` `acc_authority_documents` row and emits its `ETag`. Clarify in `02_Endpoint_Catalogue.md` & `02_DTOs.md` whether (a) transitioning to `TAX_RESOLVED` pre-creates the `DRAFT` `authorityDocumentId` on submittable kinds, or (b) a `POST /authority-documents/prepare` (or `POST /authority-documents/submit` without `:id`) endpoint creates + submits in one step. |
| **`CG-SLICE-DOC-04`** | **Low (List Parity)** | `SCR-19A` (`#78`) | `02_Endpoint_Catalogue.md` L498–511 vs L486–489 (`fiscal-documents/count` & `export`) | `fiscal-documents` provides `/count` (for status-tab badges) and `/export` (`202` async export), whereas `authority-documents` has `GET` and `POST /search` only. Confirm in `P03.T11` that `#78` omits tab badge counts and register export in MVP, or add `/authority-documents/count` and `/authority-documents/export`. |
| **`CG-SLICE-DOC-05`** | **High (Detail DTO Omissions)** | `SCR-19A` (`#79` Detail & Windows) | `02_DTOs.md` L1952–1990 (`AuthorityDocumentDetailDto`) vs `01_ERD/04_Documents_and_Authority_Tables.md` L387–436 (`acc_authority_documents`) | Declared `AuthorityDocumentDetailDto` omits ERD columns required by `#79` statutory workflows: `errorCode`, `receiverDecisionDeadlineAt` (`D-108` 72h inbound reject window!), `receiverDecisionWindowHoursSnapshot`, `declineWindowHoursSnapshot`, `cancelRequestedAt`, `cancelledAt`, `rejectRequestedAt`, `rejectedAt`, `receivedAt`, `lateSubmissionRequestId`, `deviceSerial`, `chainCounter`, `authorityTotalAmount`, and `withheldFacts`. Extend `AuthorityDocumentDetailDto` with these read-only fields. |
| **`CG-SLICE-DOC-06`** | **Medium (Query Filters & Cursor)** | `SCR-17` & `SCR-19A` | `02_DTOs.md` L1523–1547 (`AuthorityDocumentListQueryDto`, `AttachmentListQueryDto`) & `02_Endpoint_Catalogue.md` L568 (`GET /self-invoices`) | (1) `AuthorityDocumentListQueryDto` lacks `fiscalDocumentId?: UUID` and `branchId?: UUID` (needed to filter `#78` by branch or jump from `#16`). (2) `AttachmentListQueryDto` lacks pagination `cursor?: string`. (3) `SelfInvoiceListQueryDto` (`status?`, `supplierPartyId?`, `dueBefore?`, `cursor?`) is not declared in `02_DTOs.md` §7.1. |
| **`CG-SLICE-DOC-07`** | **Medium (Missing ETag Contract)** | `SCR-17` (`#19` Self-Invoice Settle) | `02_Endpoint_Catalogue.md` L569 (`GET /self-invoices/:id` -> `200`, no `+ ETag`) vs L571 (`POST /self-invoices/:id/settle` -> requires `If-Match`) | `POST /self-invoices/:id/settle` mandates `If-Match`, so `GET /self-invoices/:id` MUST emit `ETag` (matching `acc_self_invoices.version`). Update `02_Endpoint_Catalogue.md` L569 to `200 + ETag`. |
| **`CG-SLICE-DOC-08`** | **High (Exception Board Read/ETag/JSONB — reinforces `CG-DOC-01`)** | `SCR-19B` (`#2` Exception Board) | `02_Endpoint_Catalogue.md` L564–567; `02_DTOs.md` L1536–1541 & §13.1 rule 4 | (1) No `GET /exception-board/:id` (`200 + ETag`) exists, yet `assign` and `dismiss` require `If-Match` — confirm list/search items expose `version` as the `If-Match` token or add `GET /exception-board/:id` (`200 + ETag`). (2) `ExceptionBoardListQueryDto` lacks `status?: ExceptionStatus` (`OPEN \| ACKNOWLEDGED \| RESOLVED`), `acknowledgedBy?: UUID`, `branchId?: UUID`, and `cursor?: string`, and there is no `POST /exception-board/count` for header severity counters. (3) Applying §13.1 rule 4 (*exclude jsonb and long text > 512 in SummaryDto*) to `acc_exception_board_items` would strip `targetRef` (`jsonb`), `details` (`jsonb`), and `resolutionNote` (`varchar(1000)`), breaking `#2` deep links and `ExceptionInspectorSheet`! Explicitly declare `ExceptionBoardItemDto` including `targetRef`, `details`, `resolutionNote`, and `version`. |
| **`CG-SLICE-DOC-09`** | **Low (Redundant Body IDs)** | `SCR-17` & `SCR-19A` | `02_DTOs.md` L1579–1620 (`ResolveDocumentTaxDto`, `PostFiscalDocumentDto`, `ResubmitDto`, `RequestCancelDto`, `RequestRejectDto`, `DeclineRequestDto`) | Six `POST .../:id/<action>` DTOs require `fiscalDocumentId` or `authorityDocumentId` in the JSON body in addition to path `:id`. Frontend sends the exact matching UUID in both places today; `P03.T11` should document that server rejects path/body mismatch with `400 ACCOUNTING.VALIDATION.FAILED` (or make the body ID optional). |
| **`CG-SLICE-DOC-10`** | **Low (Poll Degraded Field)** | `SCR-19A` (`#79` `POST /authority-documents/:id/poll`) | `02_Endpoint_Catalogue.md` L505 (`returns cached state with sourceStatus = UNAVAILABLE when authority down, D-395`) vs `02_DTOs.md` L1952 (`AuthorityDocumentDetailDto`) | Add `sourceStatus?: 'LIVE' \| 'UNAVAILABLE'` and `lastPolledAt?: ISO8601` to the `POST /authority-documents/:id/poll` response DTO so the degraded authority banner on `#79` passes strict runtime response validation without ad-hoc casting. |

## Contract reconciliation (P03.T11, 1 November 2026)

Reconciles the gaps of this spec against the Endpoint Catalogue and `02_DTOs.md` after `D-770`, `D-771` and `D-772`. The gap list above keeps the original findings; these rulings are final.

| Gap id | Ruling | Where |
| --- | --- | --- |
| `CG-SLICE-DOC-01` | already in the contract | The exception board ships in the slice (P18.T13.S5, board routes P18.T11.S6); the stale `design later (P22.T02)` status of inventory row `SCR-22` is an inventory-only correction, not a contract change |
| `CG-SLICE-DOC-02` | deferred to stage 3 (P22.T02 spec; DTOs for P22.T04, T06, T09) | `CancelFiscalDocumentDto`, the attachment legal-hold body (`legalHold`, `reason` 10..500) and `CreateSelfInvoiceDto` are declared in DTOs §7 as definition of ready |
| `CG-SLICE-DOC-03` | closed by D-772 | `POST /accounting/fiscal-documents/:id/submit` (`:id` and `If-Match` are the `TAX_RESOLVED` fiscal document's); the command inserts the authority document, and resubmit, poll, cancel, reject and decline keep the authority-document id |
| `CG-SLICE-DOC-04` | dropped | No `/authority-documents/count` or `/export`; badges read `meta.total` of `GET /authority-documents?status=...` |
| `CG-SLICE-DOC-05 (a)` | closed by D-772 | `AuthorityDocumentDetailDto.errorCode` (column `error_code`) |
| `CG-SLICE-DOC-05 (b)` | deferred to stage 3 (P22.T02 freeze change) | Cancel, reject and inbound-window columns, `lateSubmissionRequestId`, `deviceSerial`, `chainCounter` and `authorityTotals`; the slice screens show none of these windows |
| `CG-SLICE-DOC-06 (a)` | already in the contract | Navigate `#17` to `#79` by `authorityDocumentId` (in the fiscal document detail); the branch filter comes from the scope header `x-mutakamel-branch-id` |
| `CG-SLICE-DOC-06 (b)` | dropped | Attachments use `page` and `limit`; no `cursor` |
| `CG-SLICE-DOC-06 (c)` | deferred to stage 3 (P22.T06 definition of ready) | `SelfInvoiceListQueryDto` (`status?`, `supplierPartyId?`, `dueBefore?`) in DTOs §7.1 |
| `CG-SLICE-DOC-07` | already in the contract | DTOs §13: a versioned detail carries `ETag: "<version>"`; the P22 freeze change corrects the Endpoint Catalogue cell to `200` + `ETag` |
| `CG-SLICE-DOC-08 (a)` | duplicate of CG-DOC-01 | No `GET /exception-board/:id`: `ExceptionBoardItemSummaryDto` keeps `version`, the `If-Match` token of `assign` and `dismiss` (`D-772`) |
| `CG-SLICE-DOC-08 (b)` | already in the contract | `ExceptionBoardListQueryDto` plus the repository `filter` whitelist and `POST /accounting/exception-board/search`; counters come from `meta.total`; the enum is `ExceptionBoardStatus` |
| `CG-SLICE-DOC-08 (c)` | duplicate of CG-DOC-01 | Closed by D-772: `ExceptionBoardItemSummaryDto` carries `targetRef`, `details` and `resolutionNote` |
| `CG-SLICE-DOC-09` | closed by D-772 | DTOs §2 path-identifier rule: the path is the only source of the row a route acts on; a body copy is refused with `400 ACCOUNTING.VALIDATION.FAILED` keyed by the field (`fiscalDocumentId`, `authorityDocumentId`, `connectionId`, `matchId`, ...) |
| `CG-SLICE-DOC-10` | closed by D-772 | `AuthorityPollResultDto` = the detail + `sourceStatus: 'AVAILABLE' \| 'UNAVAILABLE'`; `lastPolledAt` has no column and is dropped |
