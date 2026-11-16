# Accounting UX Foundation — Document, Exception, Waiting-State, Error-Copy & Entitlement Patterns (`P03.T07`)

> **Lead review, 1 November 2026 (P03.T07).** Ten references were corrected to their catalogue names: the wave feature keys (`accounting.close.journal_analyzer`, `accounting.treasury.payment_gateway`, `accounting.platform.accounting_firms`, `accounting.treasury.direct_debit`, `accounting.documents.ocr_intake`, `accounting.treasury.instruments`), the decision-receipt read (`accounting.tax_transaction.read`), the bank import (`accounting.bank_statement.import`), the activation action (`accounting.profile.activate`) and the revaluation route (`POST /accounting/fx-revaluation-runs`). The exception board has no `GET /:id`, as the spec states; that is contract gap `CG-DOC-01`. Every route, permission, feature key and scope below was checked against `docs/LLD/accounting-app/02_API_Contracts/02_Endpoint_Catalogue.md` and `04_Static_Data/05_Permissions_and_Features.md`; open contract gaps stay listed for `P03.T11`.

- **Plan task:** `P03.T07` (`P03.T07.S1` – `P03.T07.S5`) — `backend/docs/plans/accounting-app-plan-p03-ux-foundation.md`
- **Target promotion path (Lead pass per `P03.T08.S3`):** `frontend/tenant-portal/docs/design/specs/accounting-patterns-documents.md`
- **Status:** Complete specification ready for lead review (`P03.T07.S1`–`S5`) and contract reconciliation (`P03.T11`)
- **Last verified against backend LLD & Tenant Portal design system:** `2026-11-01`
- **Upstream binding specs:**
  - `frontend/tenant-portal/docs/design/README.md` (Five Design Laws & Accounting Design Process)
  - `frontend/tenant-portal/docs/design/specs/accounting-ia.md` (`P03.T01` — canonical routes, RBAC matrix, hidden-vs-disabled boundary rules)
  - `frontend/tenant-portal/docs/design/specs/accounting-home.md` (`P03.T02` — `W-02` Documents & Authority widget, `W-04` Exception Board widget)
  - `frontend/tenant-portal/docs/design/specs/accounting-status-and-a11y.md` (`P03.T04` — semantic status grammar, `<Money>`, `<IdentifierText>`, RTL/a11y rules, dialog focus-return fallback)
  - `frontend/tenant-portal/docs/design/{tokens,primitives,patterns,views,states,accessibility,i18n}.md` & `docs/architecture/data-layer.md`
  - `backend/docs/LLD/accounting-app/02_API_Contracts/{01_Context_Headers_and_Responses,02_Endpoint_Catalogue}.md`
  - `backend/docs/LLD/accounting-app/04_Static_Data/{01_Enums,02_DTOs,04_Errors_and_Constants,05_Permissions_and_Features}.md`
  - `backend/docs/LLD/accounting-app/01_ERD/{03_Tax_Tables,04_Documents_and_Authority_Tables}.md`
  - `backend/docs/LLD/accounting-app/05_Flows/{00_Overview,03_User_Journey_Authority_Clearance,10_User_Journey_Failure_Recovery}.md`
  - `backend/docs/LLD/accounting-app/07_Modules/10_MVP/04_fiscal_documents_and_authority.md`
  - `backend/docs/LLD/accounting-app/{10_Feature_Tiers,12_Platform_Changes,13_Delivery_Plan}.md`

---

## 0. Architectural & Design-System Foundations

### 0.1 UI/UX Design Intelligence (`ui-ux-pro-max` & `frontend-design`)

Before specifying any surface in this document, `ui-ux-pro-max` guidelines for dense B2B financial SaaS interfaces, accessibility (`WCAG 2.2 AA`), error recovery, progressive disclosure, and status communication were applied alongside the five Tenant Portal laws:

1. **Law 1 — Four Semantic Outcome Roles Only:** Color encodes **actionability / outcome** (`positive`, `caution`, `negative`, `neutral` on `StatusBadge` / `Banner` / `InlineAlert`, plus `brand` for interactive focus/CTAs and the `ink` ramp for hierarchy). **Categories never receive status colors:** `DocumentKind` (14 members) and `ExceptionBoardKind` (45 members) render with neutral monochrome `lucide-react` icons (`text-muted-foreground`) and localized text labels — never colored pills or stage rainbows.
2. **Law 2 — Three Font Weights & Strict Scale:** Only `400` (`font-normal`), `500` (`font-medium`), and `600` (`font-semibold`) are permitted. Table body cells are strictly `400`; `font-bold`, arbitrary `text-[Npx]`, and `rounded-xl`+ are prohibited.
3. **Law 3 — One Primary CTA Per Screen:** At most one filled `variant="primary"` `Button` appears per screen, anchored in `PageHeader` or `DetailHeader`. Secondary actions use `outline` or `ghost`; destructive/irreversible mutations (`cancel`, `request-cancel`, `request-reject`, `decline`, `dismiss`) require a `ConfirmDialog` or `ReasonDialog`.
4. **Law 4 — Logical Properties & Bilingual Parity:** Zero physical directional utilities (`ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, `right-*`, `text-left`, `text-right`). Every layout uses `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `text-end`. Zero language ternaries in `.tsx` files; all copy resolves from `ar.ts` and `en.ts`. Both locales render **Western digits (`0-9`)** (`ar-EG-u-nu-latn` and `en-US`) with `tabular-nums`.
5. **Law 5 — Exact Monetary & Cryptographic Fidelity:** Every `DecimalString` (`numeric(24,8)`) and `FxRateString` (`numeric(24,12)`) stays an exact string from `axiosClient` validation to `<Money>` rendering — **`Number()` / `parseFloat()` is forbidden**. Every UUID, SHA-256 hex digest, document number, `internalId`, `submissionUuid`, `correlationId`, and `x-idempotency-key` renders inside `<IdentifierText>` (`<bdi dir="ltr" className="font-mono tabular-nums">`). Client-generated idempotency keys use `generateUUIDv7()` from `@/lib/uuid` (**never** `crypto.randomUUID()`).

### 0.2 Logic / View Separation (Custom Hooks Contract)

Every pattern in `P03.T07` strictly separates state, timers, API calls, `ETag` concurrency tracking, and idempotency-key lifecycle into dedicated hooks under `features/accounting/**/hooks/`, leaving `.tsx` components as pure markup importing exclusively from `@/design-system`:

| Hook | Owning Feature Slice | Responsibility |
| --- | --- | --- |
| `useFiscalDocumentViewer(documentId)` | `features/accounting/documents/hooks/useFiscalDocumentViewer.ts` | Parallel query orchestration (`fiscal-documents/:id`, `/lines`, conditional `authority-documents/:id`, `tax/decision-receipts`, `source-document-links`), `ETag` state, action eligibility gates, Accounting-only (`sourceApp = 'accounting'`) & non-EG base-pack (`authorityDocumentId = null`) adaptations |
| `useAuthorityTimeline(authorityDocumentId)` | `features/accounting/documents/hooks/useAuthorityTimeline.ts` | Fetches `authority-documents/:id` + `/attempts`, synthesizes the head `PENDING` node when an attempt is in flight (`D-518`), computes live countdowns (`declineDeadlineAt`, `receiverDecisionDeadlineAt`, cancel/reject windows from `acc_authority_parameters`), owns `submit`, `resubmit`, `poll`, `request-cancel`, `request-reject`, `decline`, and legal `SignedDownloadDto` |
| `useDocumentAttachments(resType, resId, documentPosted)` | `features/accounting/documents/hooks/useDocumentAttachments.ts` | Lists, uploads (`<= 25 MiB`, `<= 50` files), downloads (`SignedDownloadDto`), deletes (`If-Match`, gated by `protectedAfterPosting`, `retentionUntil`, `legalHold`), and toggles `TENANT`-scoped `legalHold` |
| `useExceptionBoard(filters)` | `features/accounting/exception-board/hooks/useExceptionBoard.ts` | Paginated cursor/filter state over `GET /accounting/exception-board` & `POST .../search`, row selection for split/sheet inspector, optimistic/verified `assign` (`If-Match` + UUIDv7 `x-idempotency-key`), `409` conflict recovery, and dialog focus-return target management |
| `useDismissExceptionDialog(item)` | `features/accounting/exception-board/hooks/useDismissExceptionDialog.ts` | Validates `10..1,000` char `reason` + kind-specific conditional schema (`AUTHORITY_REQUEST` decision fields, `SHIFT_CLOSE_MISSING` `entryDates`, `RECEIPT_WITHHELD` / `INBOX_POSITION_LOST` / `CASH_DIFFERENCE_UNEXPLAINED` `PosSaleSettlementInput[]` + `leftOutPlaceholderIds`), manages UUIDv7 `x-idempotency-key` + `If-Match`, handles `409 STALE_VERSION` vs `BOARD_ITEM_NOT_DISMISSIBLE` |
| `useWaitingStateBadge(descriptor)` | `features/accounting/shared/hooks/useWaitingStateBadge.ts` | Computes remaining SLA/statutory window against server timestamps, owner label, permitted single safe action, and post-deadline compensation copy; enforces the **Zero-Resend Law** |
| `useAccountingErrorModel(error, intentContext)` | `features/accounting/shared/hooks/useAccountingErrorModel.ts` | Normalizes Accounting error envelopes + Gateway Problem Details + `CLIENT_REQUEST_TIMEOUT` into `{ cause, effect, safeAction, fieldErrors, correlationId, preservedIdempotencyKey }` per `13_Delivery_Plan.md` §6.7.2 |
| `useAccountingBoundaryGate()` | `features/accounting/shared/hooks/useAccountingBoundaryGate.ts` | Evaluates bootstrap `/accounting/meta/features` + runtime `403`/`409`/`503` `ACCOUNTING.FEATURE.*`, `ACCOUNTING.PROFILE.*`, and `TenantStatus.ARCHIVED` states; wires `RECOVERY_MODE` shell banner + Core `/api/tenant/core/v1/restore-incidents/*` active sign-off exception |

---

## 1. Document Viewer & Authority Timeline Specification (`P03.T07.S1`)

### 1.1 Canonical Route, Admission & Backend Contract Matrix

- **Frontend route (`SCR-17`):** `/accounting/documents/[id]` (nested under `/accounting/documents`, `accounting-ia.md` §3).
- **Route admission:** Permission `accounting.fiscal_document.read` (`COMPANY_OR_BRANCH` scope) + feature key `accounting.tax.engine` (`Basic`).
- **Canonical Gateway base:** `/api/tenant/accounting/v1/*` (**Core wraps responses in `data`; Accounting follows the canonical blueprint envelope `{ success, status, statusCode, code, message, data, meta, correlationId, timestamp }` — validate at boundary via runtime schema before reaching UI**).

| Operation | Canonical Gateway Method & Path | Feature Key | Permission & Scope | Concurrency & Idempotency | Response / Notes |
| --- | --- | --- | --- | --- | --- |
| Read fiscal document header | `GET /api/tenant/accounting/v1/fiscal-documents/:id` | `accounting.tax.engine` | `accounting.fiscal_document.read` (`COMPANY_OR_BRANCH`) | Emits `ETag` (`version`) | `200 FiscalDocumentDetailDto` (`02_DTOs.md` §13.1 projection of `acc_fiscal_documents`) |
| Read fiscal document lines | `GET /api/tenant/accounting/v1/fiscal-documents/:id/lines` | `accounting.tax.engine` | `accounting.fiscal_document.read` (`COMPANY_OR_BRANCH`) | — | `200 FiscalDocumentLineSummaryDto[]` |
| Dry-run kind derivation | `POST /api/tenant/accounting/v1/fiscal-documents/:id/derive-kind` | `accounting.tax.engine` | `accounting.fiscal_document.register` (`COMPANY_OR_BRANCH`) | Safe dry-run (no mutation, `D-082`) | `200 DocumentKindDerivationReceipt` (evidence preview only; never overwrites frozen `derivationReceipt`) |
| Resolve tax | `POST /api/tenant/accounting/v1/fiscal-documents/:id/resolve-tax` | `accounting.tax.engine` | `accounting.fiscal_document.resolve_tax` (`COMPANY`) | `x-idempotency-key` + `If-Match` | `200` (`REGISTERED -> TAX_RESOLVED`; creates immutable `acc_tax_decision_receipts` row) |
| Post non-authority document | `POST /api/tenant/accounting/v1/fiscal-documents/:id/post` | `accounting.tax.engine` | `accounting.fiscal_document.post` (`COMPANY`) | `x-idempotency-key` + `If-Match` | `200` + `X-Accounting-Chain-Seq`, `X-Accounting-Entry-No`, `X-Accounting-Period` + `PostingReceiptDto` (**only** non-authority kinds in `TAX_RESOLVED`, `D-107`) |
| Cancel / reverse document | `POST /api/tenant/accounting/v1/fiscal-documents/:id/cancel` | `accounting.tax.engine` | `accounting.fiscal_document.reverse` (`COMPANY`) | `x-idempotency-key` + `If-Match` | `200` (`409 ACCOUNTING.AUTHORITY.ACTIVE_REFERENCES` if live referencing credit/debit note exists; `422 ILLEGAL_TRANSITION` on `OPENING_DOCUMENT`) |
| Read tax decision receipt(s) | `GET /api/tenant/accounting/v1/tax/decision-receipts?fiscalDocumentId=:id` & `GET .../tax/decision-receipts/:receiptId` | `accounting.tax.engine` | `accounting.tax_transaction.read` (`COMPANY`) | Immutable (`L`) | `200 TaxDecisionReceiptDetailDto`; if `403` (e.g., branch accountant without `tax_rule.read`), render inline compact `PermissionGate` card (see `CG-DOC-02`) |
| Read source document links | `GET /api/tenant/accounting/v1/source-document-links?fiscalDocumentId=:id` | `accounting.integration.trade_posting` | `accounting.fiscal_document.read` (`COMPANY`) | — | `200`; when Trade is not installed (`D-721`/`D-724`) or `403`, fall back cleanly to header `(sourceApp, sourceType, sourceId, sourceVersion)` |
| Read posted / reversal journal | `GET /api/tenant/accounting/v1/journal-entries/:entryId` | `accounting.ledger.core` | `accounting.journal_entry.read` (`COMPANY_OR_BRANCH`) | Immutable (`L`) | `200 JournalEntryDetailDto` for `postedEntryId` and `reversalEntryId` |
| Read authority document | `GET /api/tenant/accounting/v1/authority-documents/:id` | `accounting.documents.einvoice_eg` | `accounting.authority_document.read` (`COMPANY_OR_BRANCH`) | Emits `ETag` (`version`) | `200 AuthorityDocumentDetailDto` (present when `fiscalDocument.authorityDocumentId !== null`) |
| Read authority attempts | `GET /api/tenant/accounting/v1/authority-documents/:id/attempts` | `accounting.documents.einvoice_eg` | `accounting.authority_document.read` (`COMPANY_OR_BRANCH`) | Append-only (`L`) | `200 AuthorityDocumentAttemptSummaryDto[]` (ordered ascending/descending by `attemptNo`) |
| Download legal artefact | `GET /api/tenant/accounting/v1/authority-documents/:id/download` | `accounting.documents.einvoice_eg` | `accounting.authority_document.read` (`COMPANY_OR_BRANCH`) | — | `200 SignedDownloadDto { url, expiresAt, checksum }` (never streams/redirects directly) |
| Submit to authority | `POST /api/tenant/accounting/v1/fiscal-documents/:id/submit` | `accounting.documents.einvoice_eg` | `accounting.authority_document.submit` (`COMPANY`) | `x-idempotency-key` + `If-Match` | `202 Accepted` + `Location` (`/authority-documents/:newId`) + `Retry-After` (`SubmitAuthorityDocumentDto`; `:id` and `If-Match` are the `TAX_RESOLVED` fiscal document's id and `version`, and the command inserts the outbound authority document, `D-772`) |
| Resubmit `INVALID` invoice | `POST /api/tenant/accounting/v1/authority-documents/:id/resubmit` | `accounting.documents.einvoice_eg` | `accounting.authority_document.resubmit` (`COMPANY`) | `x-idempotency-key` + `If-Match` | `202 Accepted` (`ResubmitDto` with `reason` `10..1,000` chars; **invoices in `INVALID` only**, never `PENDING`, never `ETA_RECEIPT`, `D-136`) |
| Poll authority status | `POST /api/tenant/accounting/v1/authority-documents/:id/poll` | `accounting.documents.einvoice_eg` | `accounting.authority_document.poll` (`COMPANY_OR_BRANCH`) | `x-idempotency-key` (**no `If-Match`**) | `200` (returns `sourceStatus: 'UNAVAILABLE'` banner rather than failing when authority is unreachable, `D-395`) |
| Request issuer cancellation | `POST /api/tenant/accounting/v1/authority-documents/:id/request-cancel` | `accounting.documents.einvoice_eg` | `accounting.authority_document.cancel` (`COMPANY_OR_BRANCH`) | `x-idempotency-key` + `If-Match` | `200` (`RequestCancelDto` `reason` `10..1,000` chars; `OUTBOUND` + `VALID` + `freezeStatus === 'NONE'` + inside `issuer_cancel_window_hours`) |
| Request receiver rejection | `POST /api/tenant/accounting/v1/authority-documents/:id/request-reject` | `accounting.documents.inbound_matching` | `accounting.authority_document.reject` (`COMPANY_OR_BRANCH`) | `x-idempotency-key` + `If-Match` | `200` (`RequestRejectDto` `reason` `10..1,000` chars; `INBOUND` + `VALID` + inside `receiver_reject_window_hours`) |
| Decline cancel / reject request | `POST /api/tenant/accounting/v1/authority-documents/:id/decline` | `accounting.documents.einvoice_eg` | `accounting.authority_document.reject` (`COMPANY_OR_BRANCH`) | `x-idempotency-key` + `If-Match` | `200` (`DeclineRequestDto` `reason` `10..1,000` chars; inside `declineDeadlineAt`; stamps `declineRequestedAt`, `D-520`) |
| List / upload / download / delete / hold attachments | `GET/POST /api/tenant/accounting/v1/attachments`, `GET .../:id/download`, `DELETE .../:id`, `POST .../:id/legal-hold` | `accounting.ledger.core` | `.read` / `.create` / `.download` (`COMPANY_OR_BRANCH`), `.delete` (`COMPANY`), `.legal_hold` (`TENANT`) | `If-Match` on `DELETE` & `legal-hold` | `SignedDownloadDto` on download; `<= 25 MiB` (`MAX_ATTACHMENT_BYTES`), `<= 50` files (`MAX_ATTACHMENTS_PER_RESOURCE`) |

### 1.2 Screen Layout & Progressive-Disclosure Hierarchy

`SCR-17` uses the Tenant Portal **Record Detail Inspector** pattern (`views.md` §4): a sticky `DetailHeader` over a responsive 12-column two-pane grid (`lg:grid-cols-12 gap-6`: **8 columns** primary fiscal & accounting content on the inline-start side; **4 columns** sticky authority, linked-evidence, and retention rail on the inline-end side; stacked single-column below `lg`).

1. **`DetailHeader` (Top Bar):**
   - Breadcrumb (`Link` to `/accounting/documents` -> `<IdentifierText value={documentNo} />`).
   - Neutral monochrome category chip for derived `DocumentKind` (`FileText` / `Receipt` / `FileMinus` / `FilePlus` + `t.accounting.documents.kinds[documentKind]`, **never** colored per Law 1).
   - Dual status badges (`accounting-status-and-a11y.md` §2):
     - Fiscal lifecycle `StatusBadge` (`FiscalDocumentStatus`: `REGISTERED` `neutral`, `TAX_RESOLVED` `neutral`, `SUBMITTED` `caution`, `VALID` `positive`, `POSTED` `positive`, `REJECTED` `negative`, `CANCELLED` `neutral`, `REVERSED` `neutral`).
     - Authority lifecycle `StatusBadge` when `authorityDocumentId !== null` (`AuthorityDocumentStatus`: `NOT_REQUIRED`/`DRAFT`/`QUEUED` `neutral`, `SENDING`/`PENDING`/`CANCEL_REQUESTED`/`REJECT_REQUESTED` `caution`, `VALID` `positive`, `INVALID` `negative`, `CANCELLED`/`REJECTED`/`NOT_TRANSMITTED` `neutral`), plus `AuthorityFreezeStatus` warning chip (`FROZEN_TYPE` / `FROZEN_SCOPE` -> `caution` with `Lock` icon) when `freezeStatus !== 'NONE'`.
   - **Single Primary CTA Slot (Law 3 — at most one `variant="primary"` button):** Computed deterministically from `(fiscalDocument.status, authorityDocument?.status, direction, permissions, recoveryMode)` — see §1.7 Action Matrix. All secondary actions (`Poll Status`, `Download Legal Copy`, `Dry-Run Derive Kind`, `Request Cancel`, `Request Reject`, `Decline Request`, `Cancel Document`) sit as `outline` buttons or inside an overflow `DropdownMenu`.
2. **Active Waiting-State or Freeze Callout Strip (Conditional, directly below `DetailHeader`):**
   - Renders `WaitingStateCallout` (§3) whenever the document is in one of the waiting states (`PENDING`, `QUEUED`/`SENDING`, `CANCEL_REQUESTED`, `INBOUND` `VALID` undecided, or `approvalRequestId` `PENDING`), or an `InlineAlert` (`negative`) when `authorityDocument.status === 'INVALID'` surfacing the authority `errorCode` and `late_submission_days` deadline, or an `InlineAlert` (`caution`) when `ledgerWithheld === true` explaining `withheldFacts`.
3. **Inline-Start Main Column (`lg:col-span-8`):**
   - **Section A — Fiscal Header & Counterparty Summary (`Card`):**
     - `documentNo` (`<IdentifierText copyable />`), `issueDate`, `taxPointDate`, `economicEventAt`, `documentDatetimeUtc`, `contractDate` (if present), `issuanceChannel` (`POS | ERP | PORTAL | API`), `isExport`, `registrationId`.
     - Counterparty block: `partyId` link to `/accounting/master-data?tab=parties`, `receiverType` (`BUSINESS | CONSUMER | FOREIGNER | GOVERNMENT | DIPLOMATIC`), `nationalIdRequired` indicator, and `nationalId` rendered as masked personal data (`••••••••••1234`, `SENSITIVE_PERSONAL` per `D-128`) unless the server returns it unmasked for an elevated role — never cached in `localStorage`.
     - Currency & FX snapshot: `currencyCode`; when `currencyCode !== functionalCurrency`, displays exact `fxRateSnapshot` (`FxRateString` `numeric(24,12)` via `<IdentifierText>`).
   - **Section B — Derived `DocumentKind` & Frozen `derivationReceipt` Disclosure (`Collapsible` inside `Card`):**
     - Headline rule: *"Document kind is derived from transaction facts, never chosen manually (`D-082`)."*
     - Displays `documentKind` + `derivationRuleCode` (`<IdentifierText />`) + frozen `derivationReceipt` JSON projection as a clean 2-column `DefinitionList`:
       - Input facts: `channel`, `counterpartyClassification`, `grossTotalLcy` (`<Money>`), `isReturnOrAdjustment`, `isAdvanceReceipt`, `isSelfBilled`.
       - Threshold evaluation: when `thresholdApplied` is non-null, renders `parameterKey` (`consumer_simplified_invoice_threshold`), `thresholdValue` (`<Money>`), `currencyCode`, and `effectiveDate` (e.g., explaining why a consumer sale >= EGP 25,000 derived `TAX_INVOICE` and required `nationalIdRequired = true`, `D-125`).
     - Secondary `ghost` button `Inspect Live Derivation` (`POST .../derive-kind`, shown only when `accounting.fiscal_document.register` is held) opens a read-only comparison modal clearly labeled *"Dry-run simulation — does not alter the frozen derivation receipt"*.
   - **Section C — Document Lines & Egyptian Tax Breakdown (`Tabs`: `Lines` | `Tax Breakdown & Receipt` | `POS Tenders & References`):**
     - **Tab 1 (`Lines`):** Dense `DataTable` (`44px` row height, `font-normal` cells) over `FiscalDocumentLineSummaryDto[]`:
       - Columns: `lineNo` (and `referencedLineNo` badge on credit/debit/return lines), `itemNameSnapshot` + `itemType` (`GS1 | EGS | INTERNAL`) + `<IdentifierText value={itemCode} />`, `quantity` + `unitType`, `unitPrice` (`<Money>`), `itemsDiscount` (`<Money>`), `valueDifference` (`<Money>`), `taxableBase` (`<Money>`), `lineTotal` (`<Money>`).
       - Expandable row drawer reveals foreign-sale fields (`amountSold`, `currencySold`, `currencyExchangeRate`), `serviceDeliveryDate`, `constructionAssetId` (link to `/accounting/assets`), `mappingKey`, and inventory receipt linkage (`trackInventory`, `receiptMovementId`, `receiptQuantity`).
     - **Tab 2 (`Tax Breakdown & Receipt`):**
       - Displays the statutory Egyptian 5-tier calculation order (`04_fiscal_documents_and_authority.md` & `03_Tax_Tables.md`): specific/schedule taxes (`T5..T12`) -> table tax (`T3`) -> VAT (`T1` / `T2` on cumulative base) -> withholding tax (`T4`, subtracted from payable settlement, never from VAT base).
       - Totals Reconciliation Footer (`DefinitionList` right/inline-end aligned with `<Money>`):
         - `netTotal` -> minus `itemsDiscountTotal` -> minus `extraDiscountAmount` -> plus/minus `taxTotal` -> **`grossTotal`** -> **`settlementTotal`** (net of WHT `T4`) -> **`legalTotalRounded`** + explicit **`roundingDifference`** row (`D-093`, `D-133`), plus `onAccountAmount` where applicable.
       - **Tax Decision Receipt Card:** Links to `acc_tax_decision_receipts` (`taxResolvedAt`, `engineVersion`, and the **four SHA-256 hex fingerprints** `factsHash`, `rulesVersionHash`, `parametersHash`, `outputHash` rendered via `<IdentifierText copyable />`). If `GET /accounting/tax/decision-receipts` returns `403` because the viewer lacks `accounting.tax_transaction.read`, renders a compact inline `PermissionGate` notice (*"Tax decision fingerprints require `accounting.tax_transaction.read`"* — never crashes the page).
     - **Tab 3 (`POS Tenders & Document References`):**
       - Renders `posTenders` breakdown when `issuanceChannel === 'POS'` (`CASH`, `CARD`, etc.).
       - Renders `references[]` (original invoices cited by a `CREDIT_NOTE` / `DEBIT_NOTE` / `RETURN_RECEIPT`), `legacyAuthorityUuid` (`<IdentifierText copyable />` when referencing a pre-migration document), `priorCreditedTotal` (`<Money>`), `supersededById` (clickable `Link` to superseding `/accounting/documents/[supersededById]`), and `inputTaxEvidence` (`AUTHORITY_VALID | CUSTOMS_DECLARATION | REVERSE_CHARGE_MEMO | PAPER_STATUTORY | NONE`) + `evidenceRef`.
4. **Inline-End Sticky Inspector Rail (`lg:col-span-4`, stacked cards):**
   - **Card 1 — Linked Ledger & Source Trail (`Card`):**
     - **Source Document:** Displays `(sourceApp, sourceType, sourceId, sourceVersion)`. When `sourceApp === 'accounting'` (`D-724`, Accounting-issued invoice/bill without Trade), badges *"Issued in Accounting"*. When `sourceApp === 'trading'` and `accounting.integration.trade_posting` is entitled, enriches via `GET /accounting/source-document-links` with a deep link to the Trade document.
     - **Posted Journal Entry:**
       - When `postedEntryId !== null`: clickable `Link` to `/accounting/journals/entries/[postedEntryId]` showing entry number and `postedAt`.
       - When `postingGroupId !== null` and `postedEntryId === null` (`ETA_RECEIPT` POS document): displays *"Posts via POS Shift Summary Group"* with `<IdentifierText value={postingGroupId} />` (`D-216`: consumer receipts post N:1 at shift close, never 1:1 on `VALID`).
       - **Late-Posting Period Redirection Badge (`originalPeriodId`):** When `originalPeriodId !== null` and differs from the posted entry's period (`D-228` — e.g., an invoice whose `VALID` callback arrived after its original period locked and redirected to the first open period), displays a `caution` `InlineAlert` naming both `originalPeriodId` and the actual posting period so auditors immediately see why tax-point period and GL period differ.
     - **Reversal Journal Entry:** When `reversalEntryId !== null`, clickable `Link` to `/accounting/journals/entries/[reversalEntryId]`.
     - **Approval Link:** When `approvalRequestId !== null`, clickable `Link` to `/accounting/inbox/approvals?request=[approvalRequestId]`.
   - **Card 2 — Authority Status, Windows & Append-Only Attempts Timeline (`Card` — detailed in §1.3 & §1.4):**
     - Hidden cleanly (replaced by a compact *"No external tax-authority submission required"* info card) when `authorityDocumentId === null` (e.g., `COMMERCIAL`, `INTERNAL`, `PAYROLL_IMPORT`, `OPENING_BALANCE`, `OPENING_DOCUMENT`, or non-Egyptian base-pack company per `SCN-096` / `D-722`).
   - **Card 3 — Attachments & Statutory Retention (`Card` — detailed in §1.5).**

### 1.3 Authority Status Machine, Freeze Semantics & Statutory Countdown Windows

When `authorityDocumentId !== null`, `useAuthorityTimeline` renders the `AuthorityDocumentDetailDto` state and live statutory windows:

1. **Identity & Cryptographic Seal Summary:**
   - Profile & type: `direction` (`OUTBOUND | INBOUND`), `profile` (`ETA_INVOICE | ETA_RECEIPT`), `documentTypeCode` (`I | C | D` or receipt equivalent) + `documentTypeVersion` (`1.0` / `1.2`).
   - Authority identifiers (all `<IdentifierText copyable />`): `uuid` (with `uuidAsserted` caution tag if asserted on a lost POS placeholder), `longId`, `submissionUuid`, `internalId` (**format rule `D-136`:** invoices format `internalId` as `<document_no>-<attempt_no>`; POS receipts format `internalId` as `<document_no>` and track `previousUuid` + `chainCounter` + `deviceSerial`).
   - Signing & integrity: `certificateThumbprint`, `signingTime`, `serializedHash` (`Sha256Hex`), `sourcePayloadHash`, `authorityTotalAmount` (`<Money>`), `creditedToDate` (`<Money>` ceiling meter showing remaining creditable balance `authorityTotalAmount - creditedToDate`), `publicUrl` (external verification link with `ExternalLink` icon, `rel="noopener noreferrer"`), and `Download Legal Copy` (`GET .../download` -> `SignedDownloadDto` showing `checksum` verification tooltip).
2. **`AuthorityFreezeStatus` Enforcement (`NONE | FROZEN_TYPE | FROZEN_SCOPE`):**
   - If `freezeStatus === 'FROZEN_TYPE'` or `'FROZEN_SCOPE'` (`D-110`), a prominent `caution` `InlineAlert` renders inside the Authority Card:
     - **AR:** `تم تجميد نوع المستند أو نطاقه لدى مصلحة الضرائب؛ لا يُسمح بطلب الإلغاء الإلكتروني ويجب التسوية عبر إشعار دائن أو مدين.`
     - **EN:** `This document type or scope is frozen by the tax authority; electronic cancellation is disabled and adjustments must use a credit or debit note.`
   - The `Request Cancel` button is **disabled** (`disabled` + tooltip citing `ACCOUNTING.AUTHORITY.DOCUMENT_FROZEN`).
3. **Live Statutory Countdown Windows (Anchored to Server Timestamps & Snapshots):**
   - **Issuer Cancellation Window (`OUTBOUND` + `status === 'VALID'`):**
     - Window = `validAt + issuer_cancel_window_hours` (Egypt pack initial value: **`72` hours**, `acc_authority_parameters` §10).
     - While remaining > 0 and `freezeStatus === 'NONE'` and no active referencing notes exist: renders live countdown (`e.g., 49h 18m remaining to request cancellation`) and enables `Request Cancel` (`POST .../request-cancel`, `ReasonDialog` `10..1,000` chars).
     - Once expired (`now >= validAt + 72h`): countdown chip switches to neutral *"Issuer cancellation window closed (72h elapsed) — issue a Credit Note instead"*; `Request Cancel` is hidden/disabled (`ACCOUNTING.AUTHORITY.CANCEL_WINDOW_CLOSED`).
   - **Receiver Rejection / Inbound Decision Window (`INBOUND` + `status === 'VALID'`):**
     - Window = `receiverDecisionDeadlineAt` (`validAt + receiverDecisionWindowHoursSnapshot`, Egypt pack initial value: **`72` hours**).
     - **Critical Legal Rule (`D-108`):** Displays explicit warning *"Silence is deemed acceptance once the 72-hour window expires"*. Enables `Request Reject` (`POST .../request-reject`, `ReasonDialog` `10..1,000` chars) or links directly to `/accounting/documents/matching` (`POST /accounting/purchase-matches/:id/decide`).
   - **Counterparty Decline Window (`status === 'CANCEL_REQUESTED'` or `'REJECT_REQUESTED'`):**
     - Window = `declineDeadlineAt` (`cancelRequestedAt / rejectRequestedAt + declineWindowHoursSnapshot`, Egypt pack initial value: **`72` hours**).
     - **Critical Accounting Truth (`D-110`, `D-399`):** Displays *"Posted ledger entry remains active while cancellation/rejection awaits finality. Reversal and tax storno post only when the authority confirms `CANCELLED`/`REJECTED`."*
     - When the tenant is the counterparty who may object (`INBOUND` on `CANCEL_REQUESTED`, or `OUTBOUND` on `REJECT_REQUESTED`) and `declineRequestedAt === null` and `now < declineDeadlineAt`: enables `Decline Request` (`POST .../decline`, `ReasonDialog` `10..1,000` chars). Once `declineRequestedAt !== null`, shows *"Decline submitted at `<timestamp>` — awaiting authority sync (`D-520`)"*.
   - **Validation Results (`status === 'INVALID'`):**
     - Renders `validationResults` array verbatim in an structured table: authority step code, localized message, and exact `propertyPath` rendered inside `<IdentifierText />` so the accountant can pinpoint the offending tax ID, item code (`GS1`/`EGS`), or arithmetic field before invoking `Resubmit` (invoices) or issuing a correcting receipt (`ETA_RECEIPT`).

### 1.4 Append-Only Authority Attempts Timeline (`acc_authority_document_attempts`)

Rendered using the `@/design-system` `Timeline` pattern (`patterns.md`), ordered newest-first (`attemptNo` descending) with strict fidelity to `D-136` and `D-518`:

1. **Synthetic In-Flight Head Node (`D-518` Rule):**
   - `acc_authority_document_attempts` (`L`) commits a row **only once an attempt's outcome is known**. Therefore, whenever `authorityDocument.status` is `'SENDING'` or `'PENDING'` and `authorityDocument.attemptNo` exceeds the highest `attemptNo` in `attempts[]`, `useAuthorityTimeline` prepends a synthetic live head node:
     - Title: `Attempt #{attemptNo}` · `StatusBadge` `caution` (`PENDING` / `SENDING`).
     - Metadata: `internalId` (`<IdentifierText />`), `submissionUuid` (if assigned), `submittedAt`.
     - Body: `WaitingStateBadge` (State 1 — *Submitted to authority*, §3) + `Poll Status` button (`POST .../poll`). **Zero resubmit button is ever rendered on an in-flight node.**
2. **Committed Historical Attempt Nodes (`AuthorityDocumentAttemptSummaryDto`):**
   - Each row displays:
     - `attemptNo` + `AttemptOutcome` `StatusBadge` (`ACCEPTED` `positive`, `DUPLICATE` `positive`, `VALID` `positive`; `TIMEOUT` `caution`, `TRANSIENT_ERROR` `caution`, `UNAVAILABLE` `caution`; `REJECTED_SCHEMA` `negative`, `REJECTED_AUTH` `negative`, `INVALID` `negative`).
     - `internalId` (`<IdentifierText copyable />`), `submissionUuid` (`<IdentifierText copyable />`), `httpStatus` (`e.g., HTTP 202 / 400 / 504`), `submittedAt`, and `resolutionQueryAt` (proving when a `TIMEOUT` or `DUPLICATE` was reconciled via status search).
     - `duplicateWindowExpiresAt` (when `outcome === 'DUPLICATE'`), `serializedHash` (`<IdentifierText copyable />`), `errorCode`, `lateSubmissionRequestId` (link if present), and `correlationId` (`<IdentifierText selectAll />`).

### 1.5 Attachments & Statutory Retention Panel (`acc_attachments`)

1. **Upload Constraints:** Drag-and-drop / file picker (`AttachmentUpload` from `@/design-system`) accepting `docClass` (`SUPPORTING` or `GENERAL`; `INVOICE_LEGAL` is system-generated by the authority serializer), enforcing client-side pre-validation of `MAX_ATTACHMENT_BYTES = 26,214,400` (`25 MiB`) and `MAX_ATTACHMENTS_PER_RESOURCE = 50` before calling `POST /api/tenant/accounting/v1/attachments`. Disabled in `RECOVERY_MODE` and `TenantStatus.ARCHIVED`.
2. **Row Metadata & Download:** Each row shows `fileName`, `mimeType`, formatted `byteSize`, `docClass` neutral tag, `checksum` (`Sha256Hex` `<IdentifierText />`), `retentionUntil` date (`retentionYearsSnapshot`, minimum **5 years** from tax period per `D-148`), `protectedAfterPosting` lock icon, and `legalHold` `StatusBadge` (`caution` when `true`, with `legalHoldReason` tooltip). Clicking `Download` invokes `GET /api/tenant/accounting/v1/attachments/:id/download` (`accounting.attachment.download`) and opens the time-limited `SignedDownloadDto.url`.
3. **Delete Protection Rules (`DELETE .../attachments/:id` with `If-Match`):**
   - Hidden if caller lacks `accounting.attachment.delete` (`COMPANY`).
   - **Disabled with explicit reason tooltip** (never silently clickable) when ANY of the three statutory locks holds:
     1. `legalHold === true` -> *"Cannot delete: attachment is under active legal hold (`ACCOUNTING.DOCUMENT.ATTACHMENT_PROTECTED`)."*
     2. `protectedAfterPosting === true` and `fiscalDocument.status` is `VALID | POSTED | CANCELLED | REVERSED` -> *"Cannot delete: statutory attachment is protected after posting (`D-148`)."*
     3. `retentionUntil !== null && today < retentionUntil` -> *"Cannot delete before statutory retention expiry `<retentionUntil>` (`ACCOUNTING.DOCUMENT.RETENTION_ACTIVE`)."*
4. **Legal Hold Toggle (`POST .../attachments/:id/legal-hold` with `If-Match`):**
   - Rendered **only** when caller holds `accounting.attachment.legal_hold` (`TENANT` scope — Chief Accountant / Legal Admin). Setting `legalHold: true` opens `ReasonDialog` requiring `legalHoldReason`; releasing `legalHold: false` requires `ConfirmDialog`.

### 1.6 All 11 UI States for `SCR-17`

| # | State | Trigger | Rendering Behaviour |
| --- | --- | --- | --- |
| 1 | **Loading** | Initial route transition | Structural `Skeleton` matching `DetailHeader` + 8/4 two-column cards + 5-row line table (`aria-busy="true"`). Never a full-page spinner. |
| 2 | **Populated (Authority Invoice)** | `authorityDocumentId !== null`, `profile = 'ETA_INVOICE'` | Full 8/4 layout with derivation card, lines/tax tabs, linked ledger card, live windows + attempts timeline, and attachments. |
| 3 | **Populated (POS Receipt)** | `profile = 'ETA_RECEIPT'` | Shows `deviceSerial`, `chainCounter`, `previousUuid`, `posTenders`, N:1 `postingGroupId` shift-summary note; never shows `Resubmit` (corrected only via new receipt / return receipt, `D-095`). |
| 4 | **Populated (Accounting-only / Base-Pack Non-Authority)** | `authorityDocumentId === null` (`COMMERCIAL`, `OPENING_BALANCE`, or base-pack `SCN-096`) | Primary CTA in `TAX_RESOLVED` is `Post Document` (`POST .../fiscal-documents/:id/post`); Authority rail card collapses into clean non-authority summary. |
| 5 | **Withheld Ledger (`ledgerWithheld = true`)** | POS receipt registered withheld (`LOST_CASH_UNPLACED`, `RECEIPT_NO_TAKEN`, etc.) | `caution` banner naming `withheldFacts` and linking directly to the open `RECEIPT_WITHHELD` item on `/accounting/inbox/exceptions`. |
| 6 | **Not Found (`404`)** | Unknown `id` or wrong company context | `EmptyState` (*"Document not found in the active company"*) with `Switch Company` / `Back to Documents` actions. |
| 7 | **Permission Denied (`403`)** | Missing `accounting.fiscal_document.read` or branch mismatch | Full-page `PermissionGate` naming `accounting.fiscal_document.read` (or branch scope mismatch). Sub-card `403` on `tax/decision-receipts` stays scoped to that card. |
| 8 | **Feature / Recovery Boundary** | `403 ACCOUNTING.FEATURE.*` or `RECOVERY_MODE` | Delegates to `useAccountingBoundaryGate` (§5): persistent `RECOVERY_MODE` banner disables all mutation buttons while keeping read + legal downloads live. |
| 9 | **Authority Down on Poll** | `POST .../poll` returns `sourceStatus: 'UNAVAILABLE'` (`D-395`) | Inline `caution` `Banner` inside Authority Card (*"Tax authority status service is temporarily unreachable; scheduled background polling remains active"*); HTTP `200`, zero crash. |
| 10 | **Storage Unavailable (`503`)** | `ACCOUNTING.DOCUMENT.STORAGE_UNAVAILABLE` on upload/download | Scoped `InlineAlert` inside Attachments / Legal Download card with `Retry` button; rest of viewer remains usable. |
| 11 | **Concurrent Edit (`409 STALE_VERSION`)** | `If-Match` mismatch on command | Preserves user's typed reason in modal memory, displays error-copy standard (§4.3 Example 2), and offers one-click `Refresh & Review`. |

### 1.7 Primary CTA Selection Matrix (Law 3 — Max One Primary Button)

| Fiscal `status` | Authority `status` | Direction / Kind | Single `variant="primary"` CTA in `DetailHeader` | Secondary (`outline` / Menu) Actions |
| --- | --- | --- | --- | --- |
| `REGISTERED` | `null` / `DRAFT` | Any | **Resolve Tax** (`POST .../resolve-tax`, `accounting.fiscal_document.resolve_tax`) | `Dry-Run Derive Kind`, `Cancel Document` |
| `TAX_RESOLVED` | `null` / `NOT_REQUIRED` | Non-authority kind | **Post to Ledger** (`POST .../post`, `accounting.fiscal_document.post`) | `Re-resolve Tax (force)`, `Cancel Document` |
| `TAX_RESOLVED` | `DRAFT` | `ETA_INVOICE` (`OUTBOUND`) | **Submit to Authority** (`POST .../submit`, `accounting.authority_document.submit`) | `Dry-Run Derive Kind`, `Cancel Document` |
| `SUBMITTED` | `PENDING` / `SENDING` | `OUTBOUND` | **None** (`Poll Status` rendered as `outline` — **never** `Submit`/`Resubmit`, Law 3 + §3) | `Poll Status` (`POST .../poll`) |
| `SUBMITTED` / `REJECTED` | `INVALID` | `ETA_INVOICE` (`OUTBOUND`) | **Resubmit to Authority** (`POST .../resubmit`, `ReasonDialog` `10..1,000` chars) | `Download Payload`, `Cancel Document` |
| `VALID` / `POSTED` | `VALID` | `OUTBOUND` (inside 72h, `freezeStatus = NONE`) | **None** (settled happy path; `Download Legal Copy` is `outline`) | `Download Legal Copy`, `Request Cancel` (`ReasonDialog`) |
| `VALID` / `POSTED` | `VALID` | `INBOUND` (undecided inside 72h) | **Review & Decide Match** (`Link` to `/accounting/documents/matching`) | `Request Reject` (`ReasonDialog`), `Download Legal Copy` |
| `VALID` / `POSTED` | `CANCEL_REQUESTED` (`INBOUND`) or `REJECT_REQUESTED` (`OUTBOUND`) | Counterparty inside `declineDeadlineAt` | **Decline Request** (`POST .../decline`, `ReasonDialog` `10..1,000` chars) | `Poll Status`, `Download Legal Copy` |

### 1.8 Four-Combination ASCII Wireframes — Document Viewer (`SCR-17`)

#### 1.8.1 Arabic RTL — Light (`dir="rtl"`, `theme="light"`, `--canvas: #FAFAFA`, `--surface-1: #FFFFFF`, `--ink-900: #111827`)

```text
+------------------------------------------------------------------------------------------------------+
| [مسار التنقل: المستندات الضريبية / INV-2026-00418]                                                   |
| [إجراءات أخرى v] [تنزيل النسخة القانونية]  |  (مُرحَّل ●) (صالح لدى المصلحة ●) [📄 فاتورة ضريبية]   |
|                                                             INV-2026-00418  ·  شركة النيل للتوريدات |
+------------------------------------------------------------------------------------------------------+
| +----------------------------------+  +------------------------------------------------------------+ |
| | القيد والمصدر المرتبط            |  | بيانات المستند والطرف المقابل                              | |
| | -------------------------------- |  | ---------------------------------------------------------- | |
| | المصدر: المحاسبة (إصدار مباشر)   |  | تاريخ الإصدار: 2026-10-29   | نقطة الضريبة: 2026-10-29    | |
| | قيد اليومية: JE-2026-00912  [↗]  |  | نوع المتلقي: شركة (B2B)     | العملة: EGP (سعر: 1.000000) | |
| | قيد العكس:   —                   |  | الرقم الضريبي للمتلقي: 204-891-332                         | |
| +----------------------------------+  +------------------------------------------------------------+ |
| | حالة مصلحة الضرائب والنافذة      |  | إيصال اشتقاق نوع المستند (مُجمَّد عند التسجيل · D-082) [v] | |
| | -------------------------------- |  | ---------------------------------------------------------- | |
| | الحالة: صالح (VALID ●)           |  | القاعدة: EG_B2B_STANDARD_INVOICE · القناة: PORTAL         | |
| | التجميد: غير مُجمَّد (NONE)      |  | الحد المطبق: consumer_simplified_invoice_threshold (25,000)| |
| | UUID: 8f91c2a0-...-44e12b   [📋] |  +------------------------------------------------------------+ |
| | نافذة طلب الإلغاء (72 ساعة):     |  | [ البنود (2) ]  [ تفصيل الضرائب وإيصال القرار ]  [ المراجع ]| |
| | متبقٍ 49 س 18 د (تنتهي 11-01)    |  | ---------------------------------------------------------- | |
| | [طلب إلغاء المستند...]           |  | الإجمالي الصافي              |          10,000.00 EGP      | |
| | -------------------------------- |  | ضريبة القيمة المضافة (14%)   |           1,400.00 EGP      | |
| | سجل المحاولات (للقراءة فقط):     |  | ضريبة الخصم والتحصيل (1%-)   |            -100.00 EGP      | |
| | ● محاولة #2 · مقبولة (VALID)     |  | إجمالي المستند (Gross)       |          11,400.00 EGP      | |
| |   INV-2026-00418-2 · HTTP 202    |  | صافي التسوية المستحق         |          11,300.00 EGP      | |
| | ○ محاولة #1 · انتهاء مهلة        |  | الإجمالي القانوني وفروق التقريب | 11,400.00 (فرق: 0.00)   | |
| |   INV-2026-00418-1 · استعلام تم  |  | بصمة إيصال الضريبة: sha256:9b3e...c41d [📋] [عرض الإيصال] | |
| +----------------------------------+  +------------------------------------------------------------+ |
| | المرفقات والحفظ القانوني (2/50)  |                                                                 |
| | 🔒 نسخة قانونية · حفظ حتى 2031   |                                                                 |
| | ⚖️ عقد التوريد.pdf (تجميد قانوني)|                                                                 |
+------------------------------------+-----------------------------------------------------------------+
```

#### 1.8.2 Arabic RTL — Dark (`dir="rtl"`, `theme="dark"`, `--canvas: #0B0F17`, `--surface-1: #111827`, `--ink-900: #F9FAFB`)

```text
+------------------------------------------------------------------------------------------------------+
| [مسار التنقل: المستندات الضريبية / INV-2026-00419]                              [الوضع الداكن: نشط] |
| [إجراءات أخرى v] [إعادة الإرسال للمصلحة (Primary)] | (مرفوض ●) (غير صالح INVALID ●) [📄 فاتورة ضريبية]|
+------------------------------------------------------------------------------------------------------+
| [! تنبيه سلبي: رفضت المصلحة المستند (ERR_ITEM_CODE_EXPIRED). متبقٍ 23 يوماً ضمن مهلة التقديم المتأخر] |
+------------------------------------------------------------------------------------------------------+
| +----------------------------------+  +------------------------------------------------------------+ |
| | حالة مصلحة الضرائب والمحاولات    |  | أخطاء التحقق الواردة من المصلحة (validationResults)        | |
| | -------------------------------- |  | ---------------------------------------------------------- | |
| | الحالة: غير صالح (INVALID ●)     |  | المسار (LTR)                    | سبب الرفض                | |
| | القيد المحاسبي: لم يُرحَّل بعد   |  | invoiceLines[0].itemCode        | كود الصنف EGS منتهي الصلاحية|
| | -------------------------------- |  +------------------------------------------------------------+ |
| | ● محاولة #1 · غير صالح (INVALID) |  | البنود (1)                      | الإجمالي القانوني         | |
| |   INV-2026-00419-1 · HTTP 400    |  | 1 · خدمة استشارية · EGS-99182   |          28,500.00 EGP   | |
| |   معرّف التتبع: 0195f2a1-... [📋]|  | (الأرقام والمعرّفات في جزر LTR بأرقام غربية واضحة التباين) | |
| +----------------------------------+  +------------------------------------------------------------+ |
+------------------------------------------------------------------------------------------------------+
```

#### 1.8.3 English LTR — Light (`dir="ltr"`, `theme="light"`, `--canvas: #FAFAFA`, `--surface-1: #FFFFFF`, `--ink-900: #111827`)

```text
+------------------------------------------------------------------------------------------------------+
| Breadcrumb: Fiscal Documents / INV-2026-00418                                                        |
| [📄 Tax Invoice] (● Posted) (● Authority Valid)    |    [Download Legal Copy] [More Actions v]       |
| Nile Supplies SAE · INV-2026-00418                                                                   |
+------------------------------------------------------------------------------------------------------+
| +------------------------------------------------------------+  +----------------------------------+ |
| | Fiscal Header & Counterparty                               |  | Linked Ledger & Source Trail     | |
| | ---------------------------------------------------------- |  | -------------------------------- | |
| | Issue Date: 2026-10-29      | Tax Point: 2026-10-29        |  | Source: Accounting (Direct Issue)| |
| | Receiver: BUSINESS (B2B)    | Currency: EGP (FX: 1.000000) |  | Posted Entry: JE-2026-00912  [↗] | |
| | Tax Registration (RIN): 204-891-332                        |  | Reversal Entry: —                | |
| +------------------------------------------------------------+  +----------------------------------+ |
| | Frozen Kind Derivation Receipt (D-082)                 [v] |  | Authority Status & Windows       | |
| | ---------------------------------------------------------- |  | -------------------------------- | |
| | Rule: EG_B2B_STANDARD_INVOICE · Channel: PORTAL            |  | Status: Valid (● VALID)          | |
| | Threshold: consumer_simplified_invoice_threshold (25,000)  |  | Freeze: NONE                     | |
| | [Inspect Live Derivation (Dry Run)]                        |  | UUID: 8f91c2a0-...-44e12b   [📋] | |
| +------------------------------------------------------------+  | Cancel Window (72h statutory):   | |
| | [ Lines (2) ]  [ Tax Breakdown & Receipt ]  [ References ] |  | 49h 18m left (closes Nov 01)     | |
| | ---------------------------------------------------------- |  | [Request Cancellation...]        | |
| | Net Total                                  10,000.00 EGP   |  | -------------------------------- | |
| | VAT (T1 · 14%)                              1,400.00 EGP   |  | Attempts Timeline (Append-Only): | |
| | Withholding Tax (T4 · -1%)                   -100.00 EGP   |  | ● Attempt #2 · VALID (HTTP 202)  | |
| | Gross Total                                11,400.00 EGP   |  |   internalId: INV-2026-00418-2   | |
| | Payable Settlement Total                   11,300.00 EGP   |  | ○ Attempt #1 · TIMEOUT           | |
| | Legal Rounded Total / Rounding Diff   11,400.00 / 0.00 EGP |  |   Reconciled via status query    | |
| | Tax Receipt Hash: sha256:9b3e...c41d [📋] [View Receipt ↗] |  +----------------------------------+ |
| +------------------------------------------------------------+  | Attachments & Retention (2/50)   | |
|                                                                 | 🔒 Legal JSON · Keep until 2031  | |
|                                                                 | ⚖️ Contract.pdf (Legal Hold ●)   | |
+-----------------------------------------------------------------+------------------------------------+
```

#### 1.8.4 English LTR — Dark (`dir="ltr"`, `theme="dark"`, `--canvas: #0B0F17`, `--surface-1: #111827`, `--ink-900: #F9FAFB`)

```text
+------------------------------------------------------------------------------------------------------+
| Breadcrumb: Fiscal Documents / INV-2026-00419                                     [Dark Theme: Active]|
| [📄 Tax Invoice] (● Rejected) (● Authority Invalid) | [More v] [Resubmit to Authority (Primary CTA)] |
+------------------------------------------------------------------------------------------------------+
| [! Negative Alert: Authority rejected document (ERR_ITEM_CODE_EXPIRED). 23d left in 25d late window] |
+------------------------------------------------------------------------------------------------------+
| +------------------------------------------------------------+  +----------------------------------+ |
| | Authority Validation Results (Verbatim Property Paths)     |  | Authority Attempts Timeline      | |
| | ---------------------------------------------------------- |  | -------------------------------- | |
| | Property Path                   | Authority Error          |  | Status: INVALID (● Negative)     | |
| | invoiceLines[0].itemCode        | EGS item code expired    |  | Ledger Entry: Not posted (D-107) | |
| +------------------------------------------------------------+  | -------------------------------- | |
| | Lines (1)                       | Legal Total              |  | ● Attempt #1 · INVALID (HTTP 400)| |
| | 1 · Advisory Service · EGS-99182|          28,500.00 EGP   |  |   internalId: INV-2026-00419-1   | |
| | (High-contrast ink-900 numerals on surface-1 #111827)      |  |   Corr ID: 0195f2a1-...     [📋] | |
| +------------------------------------------------------------+  +----------------------------------+ |
+------------------------------------------------------------------------------------------------------+
```

---

## 2. Exception Board Specification (`P03.T07.S2`)

### 2.1 Canonical Route, Endpoints & Inspector Architecture

- **Primary screen (`SCR-19`):** `/accounting/inbox/exceptions` (`accounting-ia.md` §3).
- **Home summary surface (`W-04`):** Top-severity open items card on `/accounting` (`accounting-home.md`), deep-linking to `/accounting/inbox/exceptions?severity=CRITICAL,HIGH` or opening a pre-selected item `/accounting/inbox/exceptions?selected=[id]`.
- **Route admission:** Permission `accounting.exception_board.read` (`COMPANY_OR_BRANCH`) + feature key `accounting.ledger.core` (`Basic`).

| Operation | Canonical Gateway Method & Path | Permission & Scope | Headers | Notes |
| --- | --- | --- | --- | --- |
| List exception items | `GET /api/tenant/accounting/v1/exception-board` | `accounting.exception_board.read` (`COMPANY_OR_BRANCH`) | Query filters: `status`, `severity`, `kind`, `ownerRole`, `assignedUserId`, `overdueOnly`, cursor pagination | Returns `ExceptionBoardItemSummaryDto[]` + `meta` (each row carries `version`) |
| Complex multi-kind filter | `POST /api/tenant/accounting/v1/exception-board/search` | `accounting.exception_board.read` (`COMPANY_OR_BRANCH`) | Safe search body | Used when filtering across multiple `ExceptionBoardKind` chips simultaneously |
| Claim / acknowledge item | `POST /api/tenant/accounting/v1/exception-board/:id/assign` | `accounting.exception_board.assign` (`COMPANY_OR_BRANCH`) | `x-idempotency-key` (UUIDv7) + `If-Match` (`version`) | Empty body (`02_DTOs.md` §7.3). Moves `OPEN -> ACKNOWLEDGED` and assigns caller |
| Dismiss / settle item | `POST /api/tenant/accounting/v1/exception-board/:id/dismiss` | `accounting.exception_board.dismiss` (`COMPANY_OR_BRANCH`) + kind-specific permissions | `x-idempotency-key` (UUIDv7) + `If-Match` (`version`) | Body: `DismissExceptionBoardItemDto` (`reason` `10..1,000` chars + conditional fields) |

> **Architectural Rule (No `GET /exception-board/:id` Endpoint):** Catalogue §6 defines list/search, `assign`, and `dismiss` without a single-item `GET /exception-board/:id`. Therefore `SCR-19` uses a **Queue + Slide-Over `Sheet` Inspector** driven by the selected list row's `version` (`ETag`), paired with targeted enrichment queries to the referenced target resource (`targetRef.type` + `targetRef.id`) when the operator opens the drawer. `ExceptionBoardItemSummaryDto` (`D-772`, closing `CG-DOC-01`) carries every board column, `targetRef`, `details` and `resolutionNote` included, so specialized dismissals (`reachedPlaceholderIds`, `withheldFacts`, `checkCode`, `conflictingRunId`) have server-backed evidence without extra round-trips; there is still no board `GET /:id`.

### 2.2 Status, Severity, Overdue & Resolution Grammar

Per Law 1 and `accounting-status-and-a11y.md` §2:

1. **`ExceptionBoardStatus` (`OPEN | ACKNOWLEDGED | RESOLVED`):**
   - `OPEN`: `StatusBadge` `caution` — `مفتوح` / `Open`
   - `ACKNOWLEDGED`: `StatusBadge` `neutral` — `قيد المتابعة` / `Acknowledged` (shows `assignedUserId` + `acknowledgedAt`)
   - `RESOLVED`: `StatusBadge` `positive` — `تمت المعالجة` / `Resolved` (shows `resolvedAt` + `ExceptionBoardResolution`)
2. **Overdue Escalation (`expiredAt` — Never a Fourth Status, `D-119`):**
   - When `deadlineAt !== null && expiredAt !== null` while `status !== 'RESOLVED'`, the item **remains** `OPEN` or `ACKNOWLEDGED`, its `severity` has been raised by the alerts job, and an explicit secondary `StatusBadge` (`negative`, icon `ClockAlert`) renders beside the deadline:
     - **AR:** `متجاوز للمهلة منذ <duration>` · **EN:** `Overdue by <duration>`
   - Even after the item resolves, `expiredAt` remains visible in the audit metadata of the inspector drawer (*"Resolved after deadline breach at `<expiredAt>`"*).
3. **`ExceptionSeverity` (`CRITICAL | HIGH | MEDIUM | LOW`):**
   - `CRITICAL`: `StatusBadge` `negative` + `OctagonAlert` — `حرج` / `Critical`
   - `HIGH`: `StatusBadge` `caution` + `TriangleAlert` — `مرتفع` / `High`
   - `MEDIUM`: `StatusBadge` `neutral` + `AlertCircle` — `متوسط` / `Medium`
   - `LOW`: `StatusBadge` `neutral` + `Info` — `منخفض` / `Low`
4. **`ExceptionBoardResolution` (`CONDITION_CLEARED | ACCOUNTANT_DECISION | SUPERSEDED`):**
   - `CONDITION_CLEARED`: `زوال السبب تلقائياً` / `Condition Cleared`
   - `ACCOUNTANT_DECISION`: `قرار محاسبي مُسبَّب` / `Accountant Decision` (displays `resolvedBy` + `resolutionNote`)
   - `SUPERSEDED`: `استُبدل بمستند أحدث` / `Superseded`

### 2.3 Exhaustive 45-Member `ExceptionBoardKind` Specification (`P03.T07.S2`)

Every one of the **45** `ExceptionBoardKind` enum literals (`04_Static_Data/01_Enums.md` §12 & `01_ERD/04_Documents_and_Authority_Tables.md` §10 — **36 MVP** + **9 Wave-Reserved**) is specified below. Per **Law 1**, `kind` is a **category**, never an outcome: it renders with a neutral monochrome `lucide-react` icon (`text-muted-foreground`) and bilingual text, while urgency is carried solely by `ExceptionSeverity` and `expiredAt`.

**Dismissibility Classes:**
- **`NEVER_DISMISSIBLE`**: `Dismiss` button is **disabled** (`aria-disabled="true"` with explanatory helper text naming the exact clearing workflow; server returns `409 ACCOUNTING.DOCUMENT.BOARD_ITEM_NOT_DISMISSIBLE`).
- **`REASON_ONLY`**: Dismissible via `ReasonDialog` (`reason`: `10..1,000` trimmed chars) with `accounting.exception_board.dismiss`.
- **`CONDITIONAL_GATE`**: Non-dismissible while an active statutory/chain condition holds; once the gate opens, dismissible with `reason` (and optional/required specialized DTO fields).
- **`SPECIALIZED_FORM`**: Resolved through `POST .../dismiss` carrying mandatory/conditional extra fields (`authorityReference` + `authorityDecision`, `entryDates`, or `settlement: PosSaleSettlementInput[]` + `leftOutPlaceholderIds`) and additional RBAC permissions.
- **`WAVE_HOOK`**: Enum member shipped in baseline (`D-203`); zero rows raised in MVP, but fully mapped in UI dictionaries and safe-rendered if encountered.

| # | `ExceptionBoardKind` | Arabic Label (`ar`) | English Label (`en`) | Neutral Icon | Typical / Escalated Severity | Deadline Source (`deadlineAt`) | `targetRef.type` (`target_ref`) | Dismissibility Class & Extra DTO / Permission Rules | Target Screen & Primary Resolution Action |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `UNPOSTED_DOCUMENT` | مستند ضريبي غير مُرحَّل | Unposted Fiscal Document | `FileClock` | `MEDIUM` -> `HIGH` at close | Period close date | `acc_fiscal_documents` | `REASON_ONLY` (or clears `CONDITION_CLEARED` / `SUPERSEDED` on post, cancel, or new `source_version`) | `/accounting/documents/[targetId]` — Resolve tax, submit, or post document |
| 2 | `SUPPLY_NOT_EVIDENCED` | توريد مستحق بلا مستند ضريبي | Supply Not Evidenced | `FileQuestion` | `HIGH` -> `CRITICAL` at close | Period close date | `acc_fiscal_documents` + `periodId` | **`NEVER_DISMISSIBLE`** (`D-276`: never cleared by board `dismiss`) | `/accounting/close` (`SCR-33`) — Record explicit accrual supply decision (`POST /accounting/close/accrual-supply-decisions`) or post document |
| 3 | `AUTHORITY_PENDING_TIMEOUT` | تأخر رد مصلحة الضرائب | Authority Pending Timeout | `Clock` | `MEDIUM` -> `HIGH` | `submittedAt + authority_pending_timeout_minutes` (EG: `60m`) | `acc_authority_documents` | **`NEVER_DISMISSIBLE`** while `PENDING` (`CONDITION_CLEARED` when poll/callback settles outcome) | `/accounting/documents/[fiscalDocId]` — Run `Poll Status` (`POST .../poll`); **never resend** |
| 4 | `AUTHORITY_INVALID` | مستند مرفوض من المصلحة | Authority Rejected (Invalid) | `FileX2` | `HIGH` -> `CRITICAL` near window end | `issueDate + late_submission_days` (EG: `25d` inv / `30d` rcpt) | `acc_authority_documents` | `CONDITIONAL_GATE` (clears `CONDITION_CLEARED` / `SUPERSEDED` on `resubmit`, new `source_version`, or correcting receipt; dismissible only when cancelled/abandoned) | `/accounting/documents/[fiscalDocId]` — Fix master/code defect and `Resubmit` (invoice) or issue correcting receipt |
| 5 | `RECEIVER_REJECTED` | اعتراض المتلقي على مستند صادر | Receiver Rejection Requested | `UserX` | `HIGH` -> `CRITICAL` | `declineDeadlineAt` (`rejectRequestedAt + 72h`) | `acc_authority_documents` (`OUTBOUND`) | `CONDITIONAL_GATE` (clears on `decline` acceptance or finality + credit/re-issue) | `/accounting/documents/[fiscalDocId]` — `Decline Request` (`POST .../decline`) within 72h or let rejection finalize & re-issue |
| 6 | `CANCELLATION_PENDING` | طلب إلغاء بانتظار مهلة الاعتراض | Cancellation Pending Finality | `Ban` | `MEDIUM` | `declineDeadlineAt` (`cancelRequestedAt + 72h`) | `acc_authority_documents` (`OUTBOUND`) | **`NEVER_DISMISSIBLE`** (`CONDITION_CLEARED` automatically when status leaves `CANCEL_REQUESTED`, `D-399`) | `/accounting/documents/[fiscalDocId]` — Monitor 72h window or `Poll Status` |
| 7 | `INBOUND_UNDECIDED` | مستند مورد وارد بانتظار القرار | Inbound Document Undecided | `Inbox` | `HIGH` -> `CRITICAL` (< 12h left) | `receiverDecisionDeadlineAt` (`validAt + 72h`) | `acc_authority_documents` (`INBOUND`) | **`NEVER_DISMISSIBLE`** (`D-108`: silence = deemed acceptance at 72h; clears via match decision) | `/accounting/documents/matching` — Decide `ACCEPT`, `DISPUTE`, or `REQUEST_REJECT` (`POST /accounting/purchase-matches/:id/decide`) |
| 8 | `INBOUND_UNMATCHED` | مستند مورد مقبول غير مطابق | Accepted Inbound Unmatched | `Unlink` | `HIGH` | Period close date | `acc_document_intake` | **`NEVER_DISMISSIBLE`** (`D-760`: clears `CONDITION_CLEARED` when matched, ignored, billed, or cancelled) | `/accounting/documents/matching` — Match to supplier bill (`POST /accounting/intake/:id/match`), register bill, or `ignore` |
| 9 | `RECEIPT_DEADLINE` | تجاوز أو اقتراب مهلة إيصالات نقاط البيع | POS Receipt Submission / Chain Issue | `Receipt` | `HIGH` -> `CRITICAL` | `issuedAt + receipt_submission_hours` (EG: `24h`, alert `18h`; none on chain-break) | `acc_receipt_batches` / `acc_fiscal_documents` / `acc_inbox_events` | `CONDITIONAL_GATE` (parked correction is **`NEVER_DISMISSIBLE`** -> replay inbox event; reissue/chain-break dismissible after repair) | `/accounting/documents/receipts` — `Flush Receipt Batches`, file `Late Submission Request`, or `Replay Inbox Event` |
| 10 | `RETURN_REFERENCE_UNMATCHED` | إيصال مرتجع بمرجع بيع غير مطابق | Return Receipt Reference Unmatched | `Undo2` | `MEDIUM` | None | `acc_fiscal_documents` (`RETURN_RECEIPT`) | `REASON_ONLY` (`10..1,000` chars, `D-402`; or clears `CONDITION_CLEARED` when authority accepts/cancels) | `/accounting/documents/[targetId]` — Verify original sale reference or dismiss with audit reason |
| 11 | `RECEIPT_CONTENT_DEFECT` | خلل حسابي أو حجمي في إيصال نقاط البيع | POS Receipt Content Defect | `FileWarning` | `HIGH` | None | `acc_fiscal_documents` | `REASON_ONLY` (`D-663`; or clears `SUPERSEDED` when corrected receipt naming `correctsReceiptUuid` registers) | `/accounting/documents/[targetId]` — Issue correcting POS receipt or dismiss with audit reason |
| 12 | `RECEIPT_WITHHELD` | إيصال محتجز عن الترحيل الدفتري | POS Receipt Withheld from Ledger | `PauseCircle` | `HIGH` -> `CRITICAL` at close | Period close date (blocks `NO_UNPOSTED_DOCUMENTS`) | `acc_authority_documents` | **`SPECIALIZED_FORM`** (`D-671`: non-dismissible while correcting receipt can still resolve inside `late_submission_days`; once gate opens, `reason` + conditional `settlement: [PosSaleSettlementInput]` + optional `leftOutPlaceholderIds` + `approvalRequestId`; requires `accounting.journal_draft.post` when `settlement` present) | `/accounting/inbox/exceptions` (Settlement Drawer) or `/accounting/documents/[fiscalDocId]` — Issue resolving receipt or post single-item settlement on dismiss |
| 13 | `SHIFT_CLOSE_MISSING` | إقفال وردية نقاط بيع مفقود | POS Shift Close Missing | `Store` | `HIGH` | None (raised 7d past shift cutoff) | `acc_pos_shift_summaries` | **`SPECIALIZED_FORM`** (`D-675`: clears if Trade shift close arrives; or dismiss with `reason` + optional `entryDates: YYYY-MM-DD[]` + `approvalRequestId` [`POSTING_REDATE`], posting accumulated receipts) | `/accounting/cash/shifts` or `/accounting/inbox/exceptions` — Close shift in POS or dismiss to post accumulated shift receipts |
| 14 | `INBOX_POSITION_LOST` | فجوة تسلسل مفقودة ومعتمدة في الوارد | Approved Lost Stream Position | `GitCommitHorizontal` | `CRITICAL` | None (POS placeholders block `NO_UNPOSTED_DOCUMENTS`) | `acc_approval_requests` | **`SPECIALIZED_FORM`** (`D-673`: movement loss = `REASON_ONLY` after Trade stock adjustment + manual reclass journal; POS loss = non-dismissible inside `late_submission_days` for unresolved placeholders, then `reason` + `settlement` [`1..20` items] + optional `leftOutPlaceholderIds`, requires `accounting.journal_draft.post`) | `/accounting/inbox/exceptions` (Lost-Position Settlement Drawer) — Reconcile stock/cash and submit settlement journal |
| 15 | `REFERENCE_CODE_WITHDRAWN` | سحب كود مرجعي رسمي قيد الاستخدام | Authority Reference Code Withdrawn | `BookX` | `HIGH` | None | `reference_table` (`code_table` + `code`) | **`NEVER_DISMISSIBLE`** (`D-710`, `D-761`: clears `CONDITION_CLEARED` once zero unsubmitted docs & live config rows cite the code) | `/accounting/master-data` & `/accounting/documents` — Remap affected items/tax profiles and unsubmitted drafts |
| 16 | `ITEM_CODE_PENDING` | كود صنف بانتظار اعتماد المصلحة | Authority Item Code Pending | `Barcode` | `MEDIUM` -> `HIGH` | `submittedAt + item_code_decision_days` (EG: `7d` operational bound) | `acc_item_code_requests` | **`NEVER_DISMISSIBLE`** while `REQUESTED` (`CONDITION_CLEARED` when authority sync records approval/rejection) | `/accounting/documents/item-codes` — Sync item-code requests or replace wrong GS1/EGS code |
| 17 | `POSTING_EXCEPTION` | استثناء ترحيل محاسبي | Posting Rule / Engine Exception | `AlertOctagon` | `HIGH` -> `CRITICAL` at close | Period close date | `acc_posting_exceptions` | **`NEVER_DISMISSIBLE`** on board (resolved on `/accounting/journals/exceptions` via `POST .../retry` or `POST .../discard`) | `/accounting/journals/exceptions` (`SCR-07`) — Add missing posting rule / unlock period and `Retry`, or `Discard` |
| 18 | `AUC_COST_UNASSIGNED` | تكلفة مشروعات تحت التنفيذ غير مخصصة | Unassigned AUC Line Cost | `HardHat` | `MEDIUM` -> `HIGH` at close | Period close date | `acc_fiscal_document_lines` | **`NEVER_DISMISSIBLE`** (`D-478`: clears `CONDITION_CLEARED` when full line balance is captured to an asset/project) | `/accounting/assets` — Capture cost item (`POST /accounting/asset-cost-items`) |
| 19 | `ASSET_SOURCE_CHANGED` | تغير مستند المصدر لأصل ثابت مسجل | Fixed Asset Source Document Changed | `Building2` | `HIGH` | Period close date | `asset_source_change` | `REASON_ONLY` (`D-672`: clears `CONDITION_CLEARED` via `ADDITION` / `REDUCTION` / negative cost item, or `REASON_ONLY` dismiss when re-issued at identical amount) | `/accounting/assets` — Record `REDUCTION` / `ADDITION` asset event, or dismiss when net carrying amount already matches |
| 20 | `INTEGRITY_CHECK_FAILED` | فشل فحص سلامة الدفاتر اليومي | Ledger Integrity Check Failed | `ShieldAlert` | Always `CRITICAL` | Immediate (blocks `LOCK_GL`) | `integrity_check` (`checkCode`) | **`NEVER_DISMISSIBLE`** (`D-345`, `D-667`: clears `CONDITION_CLEARED` **only** when a later-started run of that `checkCode` finishes `PASSED`) | `/accounting/close/integrity` — Inspect failing invariant and trigger on-demand integrity verification (`POST /accounting/integrity-checks/run`) |
| 21 | `BANK_UNMATCHED` | سطور كشف حساب بنكي غير مطابقة | Unmatched Bank Statement Lines | `Landmark` | `MEDIUM` -> `HIGH` | `statementDate + bank_unmatched_days` (`30d` operational bound) | `acc_bank_statement_lines` | **`NEVER_DISMISSIBLE`** on board (clears `CONDITION_CLEARED` when bank line is matched or excluded in reconciliation) | `/accounting/cash/reconciliation` (`SCR-26`) — Match line to payment/journal or record bank fee |
| 22 | `PAYMENT_FILE_RECALL` | استدعاء ملف دفع أو تغير حساب مستفيد | Payment File Recall / Payee Bank Change | `ArrowLeftRight` | `HIGH` -> `CRITICAL` | Period close date | `acc_payment_files` | `REASON_ONLY` (`D-238`: after recording recall confirmation or reviewing beneficiary bank-account change) | `/accounting/payables/payment-runs` — Confirm bank recall outcome or review payee bank change |
| 23 | `RECOVERY_DATA_GAP` | فجوة بيانات ناتجة عن حادث استعادة | Post-Recovery Data Gap | `DatabaseBackup` | `CRITICAL` | None | `recovery_incident` (company gap / `snapshot_missing`) | `REASON_ONLY` (`D-242`, `D-257`: never auto-closed by rebuild; dismissed with audit `reason` after attaching filed copies & reconciling gap) | `/accounting/tax/returns` & `/accounting/inbox/exceptions` — Attach/confirm `AUTHORITY_COPY` / `AUTHORITY_STATEMENT`, then dismiss with reason |
| 24 | `DUPLICATE_BANK_EXECUTION` | تنفيذ بنكي مكرر لمحاولة دفع ملغاة | Duplicate Bank Execution | `CopySlash` | `CRITICAL` | Period close date | `acc_bank_statement_lines` | `REASON_ONLY` (`D-254`: after external funds recovery / debit-note settlement and bank line matching) | `/accounting/cash/reconciliation` (`SCR-26`) — Record recovery receivable/settlement and match statement line |
| 25 | `INTERIM_POLICY_PENDING` | سياسة ضريبية انتقالية بانتظار التطبيق | Interim Tax Policy Pending | `Scale` | `HIGH` | None | `interim_policy` (`L-READY-05` / `L-READY-07`) | **`NEVER_DISMISSIBLE`** (`D-277`: clears `CONDITION_CLEARED` once acknowledged policy effect is applied or income-tax filing recorded) | `/accounting/tax/returns` — Apply interim policy under acknowledgement or record filing |
| 26 | `CREDIT_EVIDENCE_PENDING` | رصيد ضريبي دائن مستعاد بلا مستند مؤيد | Restored Tax Credit Evidence Pending | `FileCheck2` | `HIGH` | None | `acc_tax_return_periods` / refund claim | **`NEVER_DISMISSIBLE`** (`D-289`: clears `CONDITION_CLEARED` when authority copy/declaration is confirmed and open-period compute runs) | `/accounting/tax/returns` (`SCR-15`) — Upload & dual-confirm `AUTHORITY_COPY` (`FILED_COPY_SAME_ACTOR` enforced) or approve `UNRECOVERABLE` declaration |
| 27 | `REVALUATION_STALE` | إعادة تقييم عملات أجنبية متقادمة | Stale FX Revaluation Run | `Coins` | `HIGH` | Period close date | `acc_fx_revaluation_runs` + `periodId` | **`NEVER_DISMISSIBLE`** (`D-283`: clears `CONDITION_CLEARED` when supplementary FX revaluation run posts for the period) | `/accounting/close` — Run supplementary FX revaluation (`POST /accounting/fx-revaluation-runs`) |
| 28 | `RESTORED_CREDIT_UNKNOWN` | رصيد دائن مستعاد غير قابل للإثبات | Unrecoverable Restored Credit Balance | `HelpCircle` | `CRITICAL` | None | `acc_tax_return_periods` | **`NEVER_DISMISSIBLE`** (`D-288`, `D-292`: held rows stay `AUTHORITY_UNRESOLVED` until superseding `AUTHORITY_STATEMENT` coverage is confirmed) | `/accounting/tax/returns` — Record & confirm official `AUTHORITY_STATEMENT` |
| 29 | `AUTHORITY_REQUEST` | طلب تعديل إقرار ضريبي لدى المصلحة | Tax Return Authority Amendment Request | `Stamp` | `HIGH` | None | `acc_tax_return_periods` (`FILED` / `AMENDED`) | **`SPECIALIZED_FORM`** (`D-544`: resolved **only** via `POST .../dismiss` carrying `reason` `10..1,000` chars + **mandatory `authorityReference` (`1..120` chars) + `authorityDecision` (`'ALLOWED' \| 'REFUSED'`)**; caller must also hold `accounting.tax_return.amend`) | `/accounting/inbox/exceptions` (Authority Decision Drawer) — Record official authority reference and `ALLOWED` / `REFUSED` verdict |
| 30 | `CASH_DIFFERENCE_UNEXPLAINED` | عجز أو زيادة نقدية غير مفسرة بالوردية | Unexplained POS Cash Difference | `Banknote` | `HIGH` | None | `acc_pos_shift_summaries` | **`SPECIALIZED_FORM`** (`D-446`, `D-674`: straddle close with unresolved chain run is non-dismissible; otherwise clears on corrected close or dismiss with `reason` + optional 1-item `settlement: [PosSaleSettlementInput]` requiring `accounting.journal_draft.post`) | `/accounting/cash/shifts` or `/accounting/inbox/exceptions` — Post cash difference adjustment or accept shortage/overage with reason |
| 31 | `CLOSED_BOX_CASH` | رصيد نقدي متبقٍ في خزينة مغلقة | Non-Zero Cash in Closed Treasury Box | `Vault` | `HIGH` | Period close date | `acc_treasuries` (`CLOSED`) | **`SPECIALIZED_FORM`** (`D-677`: clears `CONDITION_CLEARED` if transferred to 0; or dismiss by caller holding `accounting.journal_draft.post` — posts automatic `STANDARD` clearing entry with **no `settlement` body**) | `/accounting/cash/treasuries` or `/accounting/inbox/exceptions` — Transfer remaining cash or confirm automatic clearing post on dismiss |
| 32 | `PROFILE_COUNTRY_MISMATCH` | تعارض دولة الشركة مع الملف الضريبي | Company Country Profile Mismatch | `Globe` | `HIGH` | None | `acc_company_profiles` | `REASON_ONLY` (`D-331`: resolved only via `dismiss` with `reason` `10..1,000` chars after reviewing Core `companies.country_code` vs fiscal profile) | `/accounting/settings` (`SCR-04`) & `/accounting/inbox/exceptions` — Verify jurisdiction alignment and dismiss with documented reason |
| 33 | `INVENTORY_RECON_DIFFERENCE` | فروق مطابقة المخزون مع الأستاذ العام | Inventory-to-GL Reconciliation Difference | `PackageSearch` | `HIGH` -> `CRITICAL` at close | Period close date | `inventory_reconciliation` | **`NEVER_DISMISSIBLE`** (`D-179`, `D-664`: clears `CONDITION_CLEARED` only when a subsequent inventory reconciliation run ends `MATCHED`) | `/accounting/close` — Resolve parked inventory movements / valuation differences and rerun inventory reconciliation |
| 34 | `INBOX_PARK_STALLED` | توقف طابور الرسائل الواردة (Inbox) | Stalled Integration Inbox Stream / Event | `TrafficCone` | `HIGH` -> `CRITICAL` | None | `inbox_stream` / `inbox_company_wait` / `acc_inbox_events` | `CONDITIONAL_GATE` (`D-663`: stream-level item `inbox_stream` is **`NEVER_DISMISSIBLE`** while stalled; clears `CONDITION_CLEARED` on replay, discard, baseline activation, or lost-position approval) | `/accounting/inbox/events` — Replay event (`POST /accounting/inbox-events/:id/replay`), activate company profile, or request lost-position declaration |
| 35 | `CHEQUE_BOUNCED` | شيك مرتد بدون رصيد أو لحساب مغلق | Inbound Cheque Bounced | `FileBadge2` | `HIGH` | None | `acc_negotiable_instruments` (`BOUNCED`) | `REASON_ONLY` (`D-185`: dismissible with `reason` once replacement instrument, cash collection, or legal recovery transfer is recorded) | `/accounting/cash/cheques` — Record replacement collection / legal action, then dismiss with reason |
| 36 | `PARTY_MERGE_REFUSED` | رفض دمج طرفين لاختلاف التسجيل الضريبي | Party Merge Refused (Tax ID Conflict) | `Users` | `MEDIUM` | None | `party_merge` (`core.tenant.party_merged.v1`) | `REASON_ONLY` (`D-501`: dismissible with `reason` once conflicting tax registrations in Core/Accounting party profiles are reconciled) | `/accounting/master-data?tab=parties` — Reconcile party tax registrations, then dismiss with reason |
| 37 | `JOURNAL_ANOMALY` *(Wave 1 Hook)* | شذوذ مكتشف في قيود اليومية | Journal Analyzer Anomaly | `Sparkles` | `MEDIUM` | Period close date | `acc_journal_analyzer_findings` | `WAVE_HOOK` (`D-193`: clears `CONDITION_CLEARED` when finding is reviewed/explained in Wave 1 `accounting.close.journal_analyzer`) | `/accounting/journals/entries` *(Wave 1)* — Review journal analyzer finding |
| 38 | `PROVIDER_CHARGEBACK` *(Wave 1 Hook)* | طلب استرداد مدفوعات إلكترونية (Chargeback) | Payment Gateway Chargeback | `CreditCard` | `HIGH` | Provider dispute `deadlineAt` | `acc_provider_settlements` | `WAVE_HOOK` (`D-187`: `REASON_ONLY` after dispute evidence submission or chargeback write-off in Wave 1 `accounting.treasury.payment_gateway`) | `/accounting/receivables` *(Wave 1)* — Contest chargeback or record fee/loss |
| 39 | `GATEWAY_AMOUNT_MISMATCH` *(Wave 1 Hook)* | اختلاف مبلغ تحصيل بوابة الدفع | Payment Link Amount Mismatch | `Diff` | `MEDIUM` | None | `acc_payment_links` | `WAVE_HOOK` (`D-187`: `REASON_ONLY` after allocating overpayment to customer advance or refund in Wave 1) | `/accounting/receivables` *(Wave 1)* — Allocate overpayment or refund |
| 40 | `EXTERNAL_ACCESS_DIVERGED` *(Wave 2 Hook)* | تباين صلاحية مكتب المحاسبة الخارجي | External Firm Consent Diverged | `UserCog` | `HIGH` | None | `external_firm_access` | `WAVE_HOOK` (`D-117`: `CONDITION_CLEARED` on Core role-expiry sweep reconciliation in Wave 2 `accounting.platform.accounting_firms`) | `/accounting/settings` *(Wave 2)* — Re-sync external firm access expiry |
| 41 | `COLLECTION_RETURNED` *(Wave 2 Hook)* | ارتداد تحصيل خصم مباشر | Direct Debit Collection Returned | `RotateCcw` | `HIGH` | None | `acc_direct_debit_mandates` / run item | `WAVE_HOOK` (`D-202`: `REASON_ONLY` after re-presenting mandate or switching collection method in Wave 2 `accounting.treasury.direct_debit`) | `/accounting/receivables` *(Wave 2)* — Re-collect returned direct debit |
| 42 | `MANDATE_SUSPENDED` *(Wave 2 Hook)* | تعليق تفويض الخصم المباشر | Direct Debit Mandate Suspended | `PauseOctagon` | `MEDIUM` | None | `acc_direct_debit_mandates` | `WAVE_HOOK` (`D-202`: `CONDITION_CLEARED` when mandate leaves `SUSPENDED` or is replaced in Wave 2) | `/accounting/receivables` *(Wave 2)* — Reinstate or replace mandate |
| 43 | `COLLECTION_IN_FLIGHT_OVERDUE` *(Wave 2 Hook)* | تأخر تسوية تحصيل خصم مباشر قيد التنفيذ | In-Flight Direct Debit Overdue | `TimerOff` | `HIGH` | None | `acc_direct_debit_mandates` / run item | `WAVE_HOOK` (`D-202`: `CONDITION_CLEARED` when bank confirms settlement or return in Wave 2) | `/accounting/cash/reconciliation` *(Wave 2)* — Import bank confirmation |
| 44 | `INTAKE_EXTRACTION_FAILED` *(Wave 3 Hook)* | فشل استخراج بيانات المستند الوارد آلياً | Document Intake OCR Extraction Failed | `ScanLine` | `MEDIUM` | None | `acc_document_intake` (`OCR` / `EMAIL`) | `WAVE_HOOK` (`D-643`: `CONDITION_CLEARED` when intake row leaves `RECEIVED` via manual keying or retry in Wave 3 `accounting.documents.ocr_intake`) | `/accounting/documents/matching` *(Wave 3)* — Key header fields manually |
| 45 | `INSTRUMENT_EXPOSURE_UNRELEASED` *(Wave 3 Hook)* | خطاب ضمان أو اعتماد مستندي منتهٍ غير مُحرَّر | Expired LC / Bank Guarantee Unreleased | `FileLock2` | `HIGH` | None (raised past `expiry_date`) | `acc_treasury_instruments` (`LC` / `BANK_GUARANTEE`) | `WAVE_HOOK` (`D-441`: `CONDITION_CLEARED` when released to `MATURED` in Wave 3 `accounting.treasury.instruments`) | `/accounting/cash` *(Wave 3)* — Record bank release to `MATURED` |

### 2.4 `assign` & `dismiss` Workflows (`ReasonDialog` & Specialized Settlement Sub-Forms)

1. **`Assign to Me / Acknowledge` (`POST /api/tenant/accounting/v1/exception-board/:id/assign`):**
   - Visible on `OPEN` rows when caller holds `accounting.exception_board.assign` (`COMPANY_OR_BRANCH`) and tenant is not in `RECOVERY_MODE` / `ARCHIVED`.
   - Sends empty JSON `{}` with `If-Match: "<version>"` and a fresh UUIDv7 `x-idempotency-key`. Transitions `OPEN -> ACKNOWLEDGED`, updates `version`, and announces via polite `aria-live` toast.
2. **`Dismiss / Resolve by Decision` (`POST /api/tenant/accounting/v1/exception-board/:id/dismiss`):**
   - Rendered only when the kind's Dismissibility Class (§2.3) permits dismissal and caller holds `accounting.exception_board.dismiss` **plus** any extra permission required by that kind:
     - `AUTHORITY_REQUEST` also requires `accounting.tax_return.amend`.
     - `CLOSED_BOX_CASH` also requires `accounting.journal_draft.post`.
     - `RECEIPT_WITHHELD`, `INBOX_POSITION_LOST`, and `CASH_DIFFERENCE_UNEXPLAINED` require `accounting.journal_draft.post` whenever `settlement` is populated (if caller lacks `accounting.journal_draft.post`, the settlement journal toggle is disabled with an inline permission explanation).
   - **Base Mandatory Field (All Dismissals):**
     - `reason` (`Textarea`, trimmed length **`10..1,000` characters**, `02_DTOs.md` §7.3).
     - Live character counter (`<current> / 1,000` with `min 10` hint) rendered in `tabular-nums`; Submit button stays disabled until `reason.trim().length >= 10 && reason.trim().length <= 1000`.
   - **Conditional Specialized Sections inside `DismissExceptionModal`:**
     - **Variant A — `AUTHORITY_REQUEST` (`D-544`):**
       - `authorityDecision`: `RadioGroup` (`ALLOWED` — `موافقة المصلحة على التعديل` / `Authority Allowed Amendment` | `REFUSED` — `رفض المصلحة للتعديل` / `Authority Refused Amendment`).
       - `authorityReference`: `Input` (`1..120` trimmed chars, `<IdentifierText>` LTR input) for the official tax-authority letter/protocol number.
     - **Variant B — `SHIFT_CLOSE_MISSING` (`D-675`):**
       - Explains that dismissing posts the shift's accumulated `VALID` receipts per touched period.
       - Optional `entryDates` (`YYYY-MM-DD[]`, one per locked period redirected to an open period) + `approvalRequestId` (`POSTING_REDATE` approval picker when redating across periods).
     - **Variant C — POS Settlement Builder (`RECEIPT_WITHHELD`, `INBOX_POSITION_LOST`, `CASH_DIFFERENCE_UNEXPLAINED` — `D-671`, `D-673`, `D-674`):**
       - Embeds a balanced `PosSaleSettlementInput[]` sub-table (`1` element for `RECEIPT_WITHHELD` / `CASH_DIFFERENCE_UNEXPLAINED`; `1..20` elements for `INBOX_POSITION_LOST`):
         - Per settlement entry: `currencyCode`, optional `postingDate` (used e.g. when resolving `409 ACCOUNTING.FX.BACKDATED_CARRYING_CONFLICT`), optional `shiftSummaryId`, optional `memo`, and >= 2 balanced `DraftLineInput` rows (`debit` == `credit` verified live with exact decimal-string addition — never floating point).
       - Optional `leftOutPlaceholderIds` multi-select (`UUID[]` drawn from `details.placeholderIds` / `details.reachedPlaceholderIds`) allowing the accountant to explicitly leave an inner lost placeholder open for a pending device correction (`D-673`).
     - **Variant D — `CLOSED_BOX_CASH` (`D-677`):**
       - Displays read-only preview of the closed box's remaining balance and warns that confirmation will automatically post the `STANDARD` clearing journal entry (sends `{ reason }` only — **never** `settlement`).

### 2.5 Concurrent Resolution (`409`) Evaluation Order & Focus-Return Accessibility

Per `02_DTOs.md` §7.3 (line 1703), the backend evaluates `dismiss` and `assign` conflicts in a strict deterministic order, and `useDismissExceptionDialog` / `useExceptionBoard` must surface two distinct recovery banners without losing the accountant's typed `reason`:

| Backend Evaluation Step | HTTP & Error Code | Exact Meaning | Required UI Recovery Behaviour |
| --- | --- | --- | --- |
| **Step 2 (`If-Match` version check runs FIRST)** | `409 ACCOUNTING.CONCURRENCY.STALE_VERSION` | Another accountant, a background poller, a POS correction walk, or a shift close modified or resolved this board item since it was opened (even if the item is now `RESOLVED`!). | Keep modal/sheet open with the user's draft `reason` preserved in read-only copyable memory; fetch fresh list/row; if the fresh row is now `RESOLVED`, switch modal header to a `positive`/`neutral` notice (*"Already resolved by `<resolvedBy / system>` (`<resolution>`)"*) with a single `Close & Refresh Queue` button. If still `OPEN`/`ACKNOWLEDGED` (e.g., `details.reachedPlaceholderIds` updated), highlight the changed fields and enable `Review Updated Item & Retry` with a **new** UUIDv7 `x-idempotency-key` and the new `ETag`. |
| **Step 3 (`If-Match` matched, status/gate check failed)** | `409 ACCOUNTING.DOCUMENT.BOARD_ITEM_NOT_DISMISSIBLE` | Caller's `ETag` matched, but the item's `kind` or current gate forbids dismissal (e.g., `RECEIPT_WITHHELD` still within `late_submission_days` while resolvable). | Display inline `negative` alert inside the modal explaining the exact blocking gate and offering the primary resolution deep-link CTA instead. |
| **Step 4 (Under-lock posting conflict during specialized settlement)** | `409 ACCOUNTING.FX.BACKDATED_CARRYING_CONFLICT` / `409 ACCOUNTING.BANK.RECONCILED_RANGE_POSTING` / `409 ACCOUNTING.APPROVAL.REQUIRED` / `422 ACCOUNTING.ENTRY.UNBALANCED` | The settlement journal rolled back cleanly; the board item remains open at the **same** `version`. | Keep modal open, highlight `settlement[i].postingDate` (showing `details.conflictingPostingDate` so the accountant can pick a later open date, `CAS-61`) or `approvalRequestId`, and mint a **new** UUIDv7 `x-idempotency-key` once the user edits the payload. |

- **Dialog Focus-Return Fallback (`accounting-status-and-a11y.md` §4.3):** When an item is dismissed (or discovered `RESOLVED` after `409`) while the queue filter is `status=OPEN,ACKNOWLEDGED`, the resolved row leaves the DOM. Before closing `DismissExceptionModal`, `useExceptionBoard` resolves focus deterministically to: **(1) the next row's action trigger**, else **(2) the previous row's action trigger**, else **(3) the `PageHeader` queue heading (`tabIndex={-1}`)** — never allowing focus to fall to `document.body`.

### 2.6 All 11 UI States for `SCR-19` (`/accounting/inbox/exceptions`)

1. **Loading:** Table `Skeleton` (8 rows x `44px`) + filter chip bar skeleton (`aria-busy="true"`).
2. **Populated Queue:** Dense `DataTable` sorted by `(overdue desc, severity desc, deadlineAt asc)` with split `Sheet` inspector on row click.
3. **Filtered Zero Results:** `EmptyState` (*"No exceptions match the active filters"*) with `Reset Filters` button.
4. **True Zero Inbox (All Clear):** Calm `EmptyState` (`CheckCircle2` neutral/positive mark: *"No open accounting exceptions for this company"*).
5. **Overdue Escalation State:** Rows with `expiredAt !== null` show the `negative` `Overdue` badge alongside `OPEN`/`ACKNOWLEDGED` status.
6. **Specialized Settlement Drawer State:** Expanded `Sheet` (`max-w-2xl`) hosting the balanced `PosSaleSettlementInput` editor for `RECEIPT_WITHHELD` / `INBOX_POSITION_LOST` / `CASH_DIFFERENCE_UNEXPLAINED`.
7. **Concurrent Resolution (`409`):** Non-destructive conflict banner inside `Sheet`/`Modal` preserving typed text + focus-safe close.
8. **Permission Denied (`403`):** Full-page `PermissionGate` if `accounting.exception_board.read` is absent; action buttons hidden/disabled individually if `.assign` / `.dismiss` / `.journal_draft.post` / `.tax_return.amend` are absent.
9. **Recovery Mode (`RECOVERY_MODE`):** Persistent top banner (§5.4); queue stays 100% readable/filterable, while `Assign` and `Dismiss` buttons are disabled via `ReadOnlyGate`.
10. **Wave-Reserved Kind Encountered:** Safe fallback rendering using the row's dictionary entry (#37–#45) + neutral badge without crashing enum validators.
11. **Network / `503` Error:** Scoped `ErrorState` with `correlationId` (`<IdentifierText>`) and `Retry` button; preserves URL filter query params.

### 2.7 Four-Combination ASCII Wireframes — Exception Board (`SCR-19`)

#### 2.7.1 Arabic RTL — Light (`dir="rtl"`, `theme="light"`)

```text
+------------------------------------------------------------------------------------------------------+
| لوحة الاستثناءات المحاسبية (14 مفتوح · 3 متجاوز للمهلة)                    [تحديث القائمة (Outline)] |
| الفلاتر: [الحالة: مفتوح، قيد المتابعة v] [الخطورة: الكل v] [النوع: الكل (45) v] [× متجاوز للمهلة فقط]|
+------------------------------------------------------------------------------------------------------+
| الإجراء          | المهلة المتبقية        | المسؤول   | الحالة       | الخطورة  | النوع والمرجع      |
| ---------------- | ---------------------- | --------- | ------------ | -------- | ------------------ |
| [معالجة ↗] [استلام] | متجاوز منذ 2 س (●) | محاسب     | (مفتوح ●)    | (حرج ●)  | 🕒 تأخر رد المصلحة |
|                  |                        |           |              |          | INV-2026-00412     |
| [تسوية واستبعاد] | إقفال الفترة (3 أيام)  | كبير محاسبين| (متابعة ○) | (مرتفع ●)| ⏸ إيصال محتجز      |
|                  |                        |           |              |          | RCP-POS02-00891    |
| [فحص السلامة ↗]  | فوري (يمنع إقفال الأستاذ)| نظام/محاسب| (مفتوح ●)  | (حرج ●)  | 🛡 فشل فحص السلامة |
|                  |                        |           |              |          | HASH_CHAIN_VERIFY  |
+------------------------------------------------------------------------------------------------------+
| [درج جانبي مفتوح: استبعاد "طلب تعديل إقرار ضريبي" · AUTHORITY_REQUEST · النسخة ETag: "4"]            |
| قرار المصلحة*: (●) موافقة المصلحة (ALLOWED)   ( ) رفض المصلحة (REFUSED)                              |
| رقم مرجع المصلحة* (LTR): [ ETA-AMD-2026-88412                    ] (18 / 120)                        |
| سبب القرار المحاسبي* (10..1,000 حرف):                                                                |
| [ تم استلام خطاب موافقة المأمورية رقم 88412 بتعديل إقرار سبتمبر 2026.          ] (71 / 1,000 حرف)   |
| [تأكيد القرار والاستبعاد]  [إلغاء]                                                                   |
+------------------------------------------------------------------------------------------------------+
```

#### 2.7.2 Arabic RTL — Dark (`dir="rtl"`, `theme="dark"`)

```text
+------------------------------------------------------------------------------------------------------+
| لوحة الاستثناءات المحاسبية                                                       [الوضع الداكن: نشط] |
+------------------------------------------------------------------------------------------------------+
| [نافذة استبعاد مفتوحة · تعارض تزامن 409 ACCOUNTING.CONCURRENCY.STALE_VERSION]                        |
| +--------------------------------------------------------------------------------------------------+ |
| | [! تنبيه تعارض: تم تحديث هذا البند أو معالجته بواسطة مستخدم آخر أو مهمة خلفية أثناء المراجعة.]  | |
| | الأثر: لم يتم حفظ قرارك ولم يُنشأ أي قيد محاسبي (UNCHANGED).                                     | |
| | الحالة الجديدة للبند: تمت المعالجة تلقائياً (RESOLVED · CONDITION_CLEARED).                       | |
| | النص الذي كتبته محفوظ للنسخ: "تمت مراجعة الإيصال مع أمين الصندوق..." [نسخ النص 📋]              | |
| | معرّف التتبع: 0195f2c0-77b1-7a00-8112-440199a0cc12 [📋]                                          | |
| | [إغلاق وتحديث القائمة]  (يعود التركيز البرمجي تلقائياً إلى الصف التالي في الجدول · §2.5)          | |
| +--------------------------------------------------------------------------------------------------+ |
+------------------------------------------------------------------------------------------------------+
```

#### 2.7.3 English LTR — Light (`dir="ltr"`, `theme="light"`)

```text
+------------------------------------------------------------------------------------------------------+
| Exception Board (14 Open · 3 Overdue)                                        [Refresh Queue (Outline)]|
| Filters: [Status: Open, Acknowledged v] [Severity: All v] [Kind: All (45) v] [x Overdue Only]        |
+------------------------------------------------------------------------------------------------------+
| Kind & Target Ref               | Severity     | Status         | Owner      | Deadline / SLA | Action|
| ------------------------------- | ------------ | -------------- | ---------- | -------------- | ----- |
| 🕒 Authority Pending Timeout    | (● Critical) | (● Open)       | Accountant | (● Overdue 2h) | [Open]|
|    INV-2026-00412               |              |                |            |                | [Claim]|
| ⏸ POS Receipt Withheld          | (● High)     | (○ Acknowledged)| Chief Acct| Period Close   | [Settle]|
|    RCP-POS02-00891              |              |                |            | (3d left)      |       |
| 🛡 Ledger Integrity Check Failed| (● Critical) | (● Open)       | Chief Acct | Immediate      | [Run ↗]|
|    HASH_CHAIN_VERIFY            |              |                | *(Dismiss disabled: run must PASS)* |
+------------------------------------------------------------------------------------------------------+
| [Slide-Over Sheet: Dismiss "Tax Return Authority Request" · AUTHORITY_REQUEST · ETag: "4"]           |
| Authority Verdict*: (●) Allowed (ALLOWED)    ( ) Refused (REFUSED)                                   |
| Official Authority Reference* (1..120): [ ETA-AMD-2026-88412                   ] (18 / 120)          |
| Accountant Audit Reason* (10..1,000 chars):                                                          |
| [ Tax office approval letter #88412 received authorizing Sep 2026 VAT amendment. ] (79 / 1,000)      |
| [Cancel]  [Confirm Decision & Dismiss]                                                               |
+------------------------------------------------------------------------------------------------------+
```

#### 2.7.4 English LTR — Dark (`dir="ltr"`, `theme="dark"`)

```text
+------------------------------------------------------------------------------------------------------+
| Exception Board                                                                  [Dark Theme: Active]|
+------------------------------------------------------------------------------------------------------+
| [Dismiss Modal · Concurrent Resolution 409 ACCOUNTING.CONCURRENCY.STALE_VERSION]                     |
| +--------------------------------------------------------------------------------------------------+ |
| | [! Conflict: Another user or background job updated this exception while you were reviewing it.] | |
| | Effect: Nothing was written and no settlement entry posted (transactionState: UNCHANGED).        | |
| | Latest Server State: RESOLVED (CONDITION_CLEARED) at 2026-11-01 14:22 UTC.                       | |
| | Your draft note (preserved): "Reviewed POS drawer count with cashier..." [Copy Draft 📋]         | |
| | Correlation ID: 0195f2c0-77b1-7a00-8112-440199a0cc12 [📋]                                        | |
| | [Close & Refresh Queue]   (Focus moves deterministically to next queue row -> heading · §2.5)   | |
| +--------------------------------------------------------------------------------------------------+ |
+------------------------------------------------------------------------------------------------------+
```

---

## 3. Waiting-State Badge & Callout Specification (`P03.T07.S3`)

### 3.1 The Zero-Resend Law & Component Anatomy

Every asynchronous wait in Accounting (`05_Flows/00_Overview.md` §5) has an explicit **statutory or operational bound**, a **named owner**, a **single safe next action**, and a **defined post-bound compensation**.

> **LOCKED UX RULE — NEVER IMPLY A RESEND (`D-136`, `D-518`, `P03.T07` Acceptance):**
> Across all seven waiting states, **no badge, tooltip, callout, or button may ever display or imply `Resend`, `Submit Again`, `Retry Submission`, or `Re-transmit`**. Sending an already-in-flight document a second time risks duplicate legal issuance or authority duplicate-window lockouts; `POST .../resubmit` is restricted strictly to `INVALID` invoices (`409 ACCOUNTING.AUTHORITY.RESUBMIT_NOT_ALLOWED` on `PENDING`). When an operator wants fresh certainty during a wait, the **only** permitted interactive refresh is status inspection (`Poll Status`, `Flush Queue`, `Sync Item Codes`, or viewing the approval/bank record).

Two paired `@/design-system` compositions render waiting states via `useWaitingStateBadge`:

1. **`WaitingStateBadge` (Compact Inline Pill for `DataTable` cells & `DetailHeader`):**
   - Renders `StatusBadge` (`caution` before bound; `negative` once bound elapsed if operator action is overdue, or `caution` with `Overdue` tag if system compensation is polling) + `Clock` icon + localized short label + live countdown in `tabular-nums` (`<bdi dir="ltr">48h 12m</bdi>`).
2. **`WaitingStateCallout` (4-Slot Structured Banner on Detail Screens & Inspector Drawers):**
   - **Slot 1 — Waiting State & Live Deadline:** Localized title + exact timestamp bound (`deadlineAt` in company timezone + remaining duration).
   - **Slot 2 — Current Owner:** Who currently holds the ball (`Tax Authority`, `POS Device / System Queue`, `Counterparty Receiver`, `Accountant`, `Designated Approver`, or `Bank / Treasury Accountant`).
   - **Slot 3 — Safe Next Action (Single Outline CTA):** Exact permitted non-duplicating action (or explicit read-only reassurance when no manual action is needed yet).
   - **Slot 4 — What Happens If the Deadline Passes:** Plain-language disclosure of the system's automatic compensation (`AUTHORITY_PENDING_TIMEOUT`, deemed acceptance `D-108`, late-submission request, escalation/expiry, or `BANK_UNMATCHED`).

### 3.2 Complete Specification Matrix for All Seven Waiting States (`05_Flows/00_Overview.md` §5)

| ID | Waiting State (`05_Flows/00_Overview.md` §5) | Trigger Condition | Badge Label (`ar` / `en`) | Statutory / Operational Bound (`acc_authority_parameters` / SLA) | Current Owner | Permitted Safe Next Action (Zero Resend!) | Automatic Compensation When Bound Passes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **`WS-01`** | **1. Submitted to the authority** | `AuthorityDocumentStatus` in `PENDING` / `SENDING` (`FiscalDocumentStatus = SUBMITTED`) | `بانتظار رد المصلحة` / `Awaiting Authority Verdict` | `authority_pending_timeout_minutes` (EG initial: **`60` minutes** from `submittedAt`, operational bound) | System Poller (`submission_polling`) -> Accountant once timeout raises | **`Poll Status`** (`POST /api/tenant/accounting/v1/authority-documents/:id/poll`). **Never `Submit` or `Resubmit`.** Ledger is **not** posted yet (`D-107`). | Raises `AUTHORITY_PENDING_TIMEOUT` on Exception Board; poller searches authority by `(internalId, submissionUuid)` before any other step (`D-136`, `D-518`). |
| **`WS-02`** | **2. Receipt in the device queue** | POS `ETA_RECEIPT` in `QUEUED` / `SENDING` in offline/batch queue | `في طابور جهاز البيع` / `Queued on POS Device` | `receipt_submission_hours` (EG initial: **`24` hours** from `issuedAt`; proactive alert at `receipt_submission_alert_hours` = **`18` hours**) | POS Device / `receipt_queue_check` -> Accountant at 18h alert | Before 24h: **`Flush Receipt Queue`** (`POST /api/tenant/accounting/v1/receipt-batches/flush`). After 24h: **`Request Late Submission`** (`POST /api/tenant/accounting/v1/late-submission-requests`, within `30d`). **Never re-create receipt.** | Raises `RECEIPT_DEADLINE` on Exception Board at 18h (`HIGH`) and escalates at 24h (`CRITICAL`); late window requires authority late-submission request (`D-095`, `D-140`). |
| **`WS-03`** | **3. Cancellation requested** | `AuthorityDocumentStatus = CANCEL_REQUESTED` (`OUTBOUND` or `INBOUND`) | `طلب إلغاء قيد المهلة` / `Cancellation Pending Window` | `declineDeadlineAt` = `validAt + issuer_cancel_window_hours` (EG initial: **`72` hours**, frozen in `declineWindowHoursSnapshot`) | `OUTBOUND`: Counterparty Receiver & Authority · `INBOUND`: Tenant Accountant | `OUTBOUND`: **`Poll Status`** (`POST .../poll`); **original journal entry stays posted** (`D-110`). `INBOUND`: **`Decline Cancellation`** (`POST .../decline`) if objecting within deadline. | Once `declineDeadlineAt` passes, `submission_polling` reads final status (`D-399`): if `CANCELLED`, posts reversal + tax storno; if `VALID` (declined), returns to `VALID` and clears `CANCELLATION_PENDING`. |
| **`WS-04`** | **4. Inbound supplier document undecided** | `INBOUND` `AuthorityDocumentStatus = VALID` with purchase match `UNDECIDED` | `مستند وارد بانتظار القرار` / `Inbound Decision Window` | `receiverDecisionDeadlineAt` = `validAt + receiver_reject_window_hours` (EG initial: **`72` hours**, frozen in `receiverDecisionWindowHoursSnapshot`) | Tenant Accountant (`accounting.intake.decide`) | **`Review & Decide`** (`POST /api/tenant/accounting/v1/purchase-matches/:id/decide`: `ACCEPT`, `DISPUTE`, or `REQUEST_REJECT`). | **Silence is statutory acceptance (`D-108`):** at `receiverDecisionDeadlineAt`, `submission_polling` applies deemed acceptance (`decision = ACCEPT`, `decidedBy = null`) and runs matching, raising `INBOUND_UNMATCHED` if unlinked (`D-391`, `D-760`). |
| **`WS-05`** | **5. Item awaiting its authority code** | `acc_item_code_requests.status = REQUESTED` | `كود الصنف قيد الاعتماد` / `Item Code Pending Approval` | `item_code_decision_days` (EG initial: **`7` days** from `submittedAt`, operational bound) | Tax Authority -> Accountant monitors | **`View / Sync Requests`** (`GET /api/tenant/accounting/v1/item-code-requests`). **Never submit duplicate EGS code request for the same item.** | Raises/escalates `ITEM_CODE_PENDING` on Exception Board; Trade keeps tax-invoice issuance for that item blocked until approved (`D-090`, `D-567`). |
| **`WS-06`** | **6. Approval step pending** | `ApprovalRequestStatus = PENDING` on current `acc_approval_steps` row | `بانتظار اعتماد المراجع` / `Awaiting Approver Decision` | `acc_approval_steps.sla_hours` (`expiresAt` timestamp on active step) | Designated Approver (distinct from maker — `trg_acc_approval_actions_maker_checker`, `D-467`) | Approver: **`Approve` / `Reject`** (`/accounting/inbox/approvals`). Submitter: **`Withdraw Request`** (`POST /api/tenant/accounting/v1/approvals/:id/withdraw`) if modifying. **Never submit duplicate approval.** | Escalates to escalation role or transitions request to `EXPIRED` (for vendor bills/notes, emits `APPROVAL_REFUSED` and leaves document in `TAX_RESOLVED` with `UNPOSTED_DOCUMENT`, `D-146`, `D-393`). |
| **`WS-07`** | **7. Payment run awaiting bank confirmation** | Payment run / file `SUBMITTED` or `ACKNOWLEDGED` before bank statement execution match | `بانتظار تأكيد البنك` / `Awaiting Bank Confirmation` | **Immediate / No fixed timer** (file generated immediately; operational bank-statement match tracked within `bank_unmatched_days` = **`30` days** & period close) | Bank -> Treasury Accountant (`accounting.bank_statement.import`) | **`Import & Match Bank Statement`** (`/accounting/cash/reconciliation`) or record recall outcome (`PAYMENT_FILE_RECALL`). **Never re-export/re-pay the run as a new payment file.** | Unreconciled statement lines raise `BANK_UNMATCHED`; beneficiary bank edits after file creation raise `PAYMENT_FILE_RECALL` (`D-238`); execution of a failed attempt raises `DUPLICATE_BANK_EXECUTION` (`D-254`). |

### 3.3 Four-Combination ASCII Wireframes — Waiting-State Badge & Callout (`WS-01` & `WS-04`)

#### 3.3.1 Arabic RTL — Light (`dir="rtl"`, `theme="light"`)

```text
+------------------------------------------------------------------------------------------------------+
| [شارة مضغوطة في الجداول]:  (⏳ بانتظار رد المصلحة · متبقٍ 41 د)                                      |
+------------------------------------------------------------------------------------------------------+
| [بطاقة حالة الانتظار التفصيلية · WS-01 · أُرسل إلى مصلحة الضرائب]                                    |
| ⏳ المستند قيد المراجعة لدى مصلحة الضرائب (المحاولة #1 · INV-2026-00421-1)                            |
| • المهلة التشغيلية: 60 دقيقة (يتبقى 41 د · الموعد: 15:30 بتوقيت القاهرة)                              |
| • الجهة المسؤولة حالياً: خدمة الاستعلام الآلي بالمصلحة (لم يُرحَّل قيد اليومية بعد · D-107)          |
| • عند انقضاء المهلة: يُفتح بند متابعة في لوحة الاستثناءات مع استعلام آلي بالمعرّف المرجعي دون تكرار.  |
| [استعلام عن الحالة الآن (Poll Status)]    (ملاحظة: لا يُعاد إرسال المستند أثناء انتظار الرد · D-136) |
+------------------------------------------------------------------------------------------------------+
```

#### 3.3.2 Arabic RTL — Dark (`dir="rtl"`, `theme="dark"`)

```text
+------------------------------------------------------------------------------------------------------+
| [بطاقة حالة الانتظار التفصيلية · WS-04 · مستند مورد وارد بانتظار القرار · الوضع الداكن]              |
| ⏳ فاتورة مورد واردة بانتظار قرار القبول أو الرفض (يتبقى 11 س 05 د من مهلة 72 ساعة)                  |
| • الجهة المسؤولة حالياً: محاسب المشتريات (`accounting.intake.decide`)                                 |
| • تنبيه قانوني هام (D-108): عدم اتخاذ قرار قبل 2026-11-02 03:00 يُعد قبولاً ضمنياً نهائياً للمستند.  |
| [مراجعة واتخاذ القرار (قبول / اعتراض / رفض)]                                                         |
+------------------------------------------------------------------------------------------------------+
```

#### 3.3.3 English LTR — Light (`dir="ltr"`, `theme="light"`)

```text
+------------------------------------------------------------------------------------------------------+
| [Compact Table Cell Badge]:  (⏳ Awaiting Authority Verdict · 41m left)                              |
+------------------------------------------------------------------------------------------------------+
| [Expanded WaitingStateCallout · WS-01 · Submitted to the Authority]                                  |
| ⏳ Document is awaiting the tax authority's verdict (Attempt #1 · INV-2026-00421-1)                  |
| • Operational Bound: 60 minutes (41m remaining · bound at 15:30 Africa/Cairo)                        |
| • Current Owner: System background poller (GL journal entry is held until VALID · D-107)             |
| • If Bound Passes: Raises AUTHORITY_PENDING_TIMEOUT on Exception Board and reconciles by internalId. |
| [Poll Authority Status Now]        (Note: In-flight submissions are never sent a second time · D-136)|
+------------------------------------------------------------------------------------------------------+
```

#### 3.3.4 English LTR — Dark (`dir="ltr"`, `theme="dark"`)

```text
+------------------------------------------------------------------------------------------------------+
| [Expanded WaitingStateCallout · WS-04 · Inbound Supplier Document Undecided · Dark Theme]            |
| ⏳ Inbound supplier invoice awaits your decision (11h 05m left of statutory 72h window)              |
| • Current Owner: Payables Accountant (`accounting.intake.decide`)                                    |
| • Statutory Consequence (D-108): Silence past 2026-11-02 03:00 UTC+2 becomes deemed acceptance.      |
| [Review & Decide (Accept / Dispute / Request Reject)]                                                |
+------------------------------------------------------------------------------------------------------+
```

---

## 4. Error-Copy Standard & Worked Catalogue Examples (`P03.T07.S4`)

### 4.1 Mandatory Three-Part Error-Copy Formula (`13_Delivery_Plan.md` §6.7.2)

Stage 6 usability gate `13_Delivery_Plan.md` §6.7.2 mandates: *"Every exception message is checked to state its cause, its effect and the allowed action."* Every error rendered in Accounting (`InlineAlert`, `FormErrorSummary`, `AmbiguousOutcomePanel`, or `ErrorState`) is produced by `useAccountingErrorModel` with **three mandatory labeled lines** plus a copyable `correlationId` footer:

1. **Line 1 — Cause (`السبب` / `Cause`):** Resolved strictly from `t.accounting.errors[errorCode]` interpolated with whitelisted safe fields from `details` (e.g., `conflictingPostingDate`, `parameterKey`, `requiredPermission`, `wave`). **Never render raw server `message` strings, stack traces, SQL constraint names, or unlocalized enum literals.**
2. **Line 2 — Effect on the Books (`الأثر على الدفاتر` / `Effect on Books`):** Mapped deterministically from the catalogue's `transactionState` (`04_Errors_and_Constants.md` §2) so an accountant never guesses whether a journal entry, tax receipt, or authority intent was saved:
   - `UNCHANGED`: *"No ledger entry, document status, or balance was changed."* / `لم يتغير أي قيد محاسبي أو رصيد أو حالة مستند.`
   - `COMMITTED`: *"The request did not post to the ledger, **and** an auditable exception record was saved so you can track and resolve it."* / `لم يُرحَّل القيد إلى الأستاذ العام، وتم حفظ سجل استثناء موثق لمتابعته ومعالجته.`
   - `INTENT_COMMITTED`: *"Your request was durably recorded in Accounting before the external service became unavailable; background synchronization will complete it without resending."* / `تم حفظ طلبك بأمان داخل النظام قبل تعذر الاتصال بالخدمة الخارجية؛ ستُستكمل المزامنة آلياً دون إعادة إرسال.`
   - `AMBIGUOUS` (client/network timeout): *"The browser lost connection before receiving the server's confirmation; the operation may still be finishing or may have succeeded."* / `انقطع الاتصال قبل استلام تأكيد الخادم؛ قد تكون العملية قيد التنفيذ أو اكتملت بالفعل.`
3. **Line 3 — Safe Next Action (`الإجراء الآمن المتاح` / `Safe Next Action`):** Driven by `(RetryClass, SafeAction)` (`04_Errors_and_Constants.md` §2):
   - Renders the exact recovery button (`Refresh & Review`, `Retry with Same Key`, `Poll Status`, `Open Posting Rules`, etc.) and explicitly states whether retrying as-is is safe or blocked.
4. **Traceability Footer:** `معرّف التتبع` / `Correlation ID:` `<IdentifierText selectAll copyable value={correlationId} />`.

### 4.2 HTTP Status, Concurrency & Idempotent Timeout Routing Matrix

| HTTP / Failure Class | Canonical `errorCode` Family | `RetryClass` & `SafeAction` | UI Surface & Idempotency-Key (`x-idempotency-key`) Lifecycle |
| --- | --- | --- | --- |
| **`400` Validation** | `ACCOUNTING.VALIDATION.FAILED` (`details` is a **flat dotted-path map**, e.g. `{"lines.1.debit": "...", "reason": "..."}`) | `AFTER_CORRECTION` · `CORRECT_AND_RESEND` | Map each dotted key in `details` to its inline `<Field error={...} />`; render `<FormErrorSummary>` at top of form/modal with clickable anchor links to each invalid input (`aria-invalid="true"`). Mint a **new** UUIDv7 key when user edits and re-submits. |
| **`409` Stale Version** | `ACCOUNTING.CONCURRENCY.STALE_VERSION` | `AFTER_REFRESH` · `REFRESH_AND_REVIEW` | Non-destructive conflict banner inside form/drawer; preserve user's unsaved inputs for inspection/copy; fetch latest `ETag`; mint a **new** UUIDv7 key only after user reviews refreshed state. |
| **`409` Idempotency In-Flight** | `ACCOUNTING.IDEMPOTENCY.IN_FLIGHT` | `AFTER_BACKOFF` · `READ_STATUS` | Another request with the same key is still executing on the server. Keep form locked (`aria-busy="true"`), **keep the exact UUIDv7 key**, and offer `Check Status` after short backoff. |
| **`409` Key Reused w/ Diff Payload** | `ACCOUNTING.IDEMPOTENCY.KEY_REUSED_DIFFERENT_PAYLOAD` | `NONE` · `DO_NOT_RETRY` | Client state bug guard: `useIdempotentMutation` prevents this by minting a fresh UUIDv7 whenever serialized request body mutates while no timeout is pending. |
| **`422` Unchanged Domain Rule** | `ACCOUNTING.ENTRY.UNBALANCED`, `ACCOUNTING.PERIOD.CLOSED`, `ACCOUNTING.DOCUMENT.ILLEGAL_TRANSITION`, etc. | `AFTER_CORRECTION` · `CORRECT_AND_RESEND` | Inline `negative` `InlineAlert` above submit bar (`transactionState: UNCHANGED`). Mint a **new** UUIDv7 key after user adjusts inputs. |
| **`422` Committed Exception** | `ACCOUNTING.POSTING.NO_ACCOUNT_RULE`, `ACCOUNTING.POSTING.BLOCKED` | `AFTER_CORRECTION` · `CORRECT_AND_RESEND` | Structured `caution`/`negative` `InlineAlert` explicitly disclosing `transactionState: COMMITTED` (an `acc_posting_exceptions` row + Exception Board item now exist) with deep-link CTA to `/accounting/posting-rules` or `/accounting/journals/exceptions`. |
| **`429` Rate Limited** | Gateway / Accounting `RATE_LIMITED` + `Retry-After` header | `AFTER_BACKOFF` · `WAIT_RETRY_AFTER` | Inline `caution` alert with live countdown (`Retry available in 12s`, `tabular-nums`); submit button auto-enables at `0s` and re-sends with the **exact same** UUIDv7 `x-idempotency-key` if payload was not edited. |
| **`503` Intent Committed** | `ACCOUNTING.AUTHORITY.DEPENDENCY_UNAVAILABLE` (`D-520`) | `AFTER_BACKOFF` · `READ_LOCATION_OR_POLL` | `caution` banner disclosing `transactionState: INTENT_COMMITTED` (e.g., `declineRequestedAt` or submission row is saved); replaces submit CTA with `Poll Status` / `Refresh Document` — **never resends**. |
| **Client / Network Timeout (`502` / `504` / `CLIENT_REQUEST_TIMEOUT`)** | `CLIENT_REQUEST_TIMEOUT` on any idempotent write (`x-idempotency-key` sent) | `SAME_KEY` · `RETRY_SAME_KEY` or `READ_STATUS` | **CRITICAL RULE (`P03.T07` Output):** `useIdempotentMutation` **locks the form fields** and **preserves the exact UUIDv7 `x-idempotency-key`** in hook state (and session-scoped recovery map keyed by `(route, resourceId)`). Renders `<AmbiguousOutcomePanel>` with two buttons: **(1) `Check Current Status`** (re-reads `GET` resource) and **(2) `Retry Safely (Same Key)`** (re-sends identical payload + **identical** `x-idempotency-key` + `If-Match` so backend deduplicates if already committed!). Editing the form requires clicking `Unlock & Discard Pending Key`, which first refreshes the resource `ETag` to confirm the prior attempt did not commit. *(Routes documented as non-idempotent/non-replayable opt out of automatic replay and offer `Check Current Status` only.)* |

### 4.3 Four Worked Catalogue Examples (`04_Errors_and_Constants.md`)

#### Worked Example 1 — `400 ACCOUNTING.VALIDATION.FAILED` (Flat Dotted Field Map on Exception Dismissal)

- **Triggering call:** `POST /api/tenant/accounting/v1/exception-board/0195f290-1120-7000-8000-000000000041/dismiss` (`RECEIPT_WITHHELD` settlement with a 6-char reason and unbalanced settlement lines).
- **Catalogue row (`04_Errors_and_Constants.md` §3.1):** HTTP `400` · `transactionState: UNCHANGED` · `RetryClass: AFTER_CORRECTION` · `SafeAction: CORRECT_AND_RESEND`.
- **Server wire response:**
  ```json
  {
    "success": false,
    "status": "ERROR",
    "statusCode": 400,
    "errorCode": "ACCOUNTING.VALIDATION.FAILED",
    "message": "Request validation failed.",
    "details": {
      "reason": "LENGTH_OUT_OF_RANGE_10_1000",
      "settlement.0.lines": "DEBIT_CREDIT_MISMATCH"
    },
    "errorCategory": "VALIDATION",
    "correlationId": "0195f2d1-4a10-7b12-9001-1a2b3c4d5e01",
    "timestamp": "2026-11-01T13:10:04.120Z"
  }
  ```
- **Rendered UI Copy (Summary + Inline Fields):**
  - **English (`en`):**
    - **Cause:** `2 fields require correction before this exception can be dismissed: Audit reason must be between 10 and 1,000 characters, and Settlement #1 debit and credit lines must balance.`
    - **Effect on Books:** `Nothing was saved; the exception remains Open and no journal entry was posted.`
    - **Safe Next Action:** `Correct the highlighted fields below and submit again.` · `Correlation ID: 0195f2d1-4a10-7b12-9001-1a2b3c4d5e01`
  - **Arabic (`ar`):**
    - **السبب:** `يوجد حقلان يتطلبان التصحيح قبل استبعاد الاستثناء: يجب أن يتراوح سبب القرار بين 10 و1,000 حرف، ويجب توازن إجمالي المدين والدائن في قيد التسوية رقم 1.`
    - **الأثر على الدفاتر:** `لم يتم حفظ أي تعديل؛ ما زال الاستثناء مفتوحاً ولم يُرحَّل أي قيد يومية.`
    - **الإجراء الآمن المتاح:** `صحّح الحقول الموضحة أدناه ثم أعد الإرسال.` · `معرّف التتبع: 0195f2d1-4a10-7b12-9001-1a2b3c4d5e01`

#### Worked Example 2 — `409 ACCOUNTING.CONCURRENCY.STALE_VERSION` (`ETag` Mismatch on Document / Board Command)

- **Triggering call:** `POST /api/tenant/accounting/v1/fiscal-documents/0195f200-88a1-7000-8000-000000000109/resolve-tax` with `If-Match: "2"` after another user already resolved tax (`version = 3`).
- **Catalogue row (`04_Errors_and_Constants.md` §3.1):** HTTP `409` · `transactionState: UNCHANGED` · `RetryClass: AFTER_REFRESH` · `SafeAction: REFRESH_AND_REVIEW`.
- **Server wire response:**
  ```json
  {
    "success": false,
    "status": "ERROR",
    "statusCode": 409,
    "errorCode": "ACCOUNTING.CONCURRENCY.STALE_VERSION",
    "message": "Resource version does not match If-Match.",
    "details": { "expectedVersion": 2, "currentVersion": 3 },
    "errorCategory": "CONFLICT",
    "correlationId": "0195f2d4-99c2-7d00-8221-8899aabbcc02",
    "timestamp": "2026-11-01T13:14:22.408Z"
  }
  ```
- **Rendered UI Copy:**
  - **English (`en`):**
    - **Cause:** `This document was updated to version 3 by another user or background process while you had version 2 open.`
    - **Effect on Books:** `Your tax-resolution request made no changes; the server's newer version (v3) remains intact.`
    - **Safe Next Action:** `Click "Refresh & Review" to load version 3 and verify whether tax is already resolved before acting.` · `[Refresh & Review]` · `Correlation ID: 0195f2d4-99c2-7d00-8221-8899aabbcc02`
  - **Arabic (`ar`):**
    - **السبب:** `تم تحديث هذا المستند إلى النسخة 3 بواسطة مستخدم آخر أو مهمة خلفية أثناء فتحك للنسخة 2.`
    - **الأثر على الدفاتر:** `لم يُجرِ طلبك أي تغيير؛ ما زالت النسخة الأحدث على الخادم (النسخة 3) معتمدة كما هي.`
    - **الإجراء الآمن المتاح:** `اضغط "تحديث ومراجعة" لتحميل النسخة 3 والتحقق مما إذا كان قد تم احتساب الضريبة بالفعل.` · `[تحديث ومراجعة]` · `معرّف التتبع: 0195f2d4-99c2-7d00-8221-8899aabbcc02`

#### Worked Example 3 — `422 ACCOUNTING.POSTING.NO_ACCOUNT_RULE` (`transactionState: COMMITTED` Exception Row)

- **Triggering call:** `POST /api/tenant/accounting/v1/fiscal-documents/0195f210-33b0-7000-8000-000000000215/post` when no active posting rule maps `(eventKind: 'COMMERCIAL_INVOICE', mappingKey: 'CONSULTING_EXPORT')`.
- **Catalogue row (`04_Errors_and_Constants.md` §3.9):** HTTP `422` · **`transactionState: COMMITTED`** · `RetryClass: AFTER_CORRECTION` · `SafeAction: CORRECT_AND_RESEND`. *(Crucial nuance: unlike ordinary `422` errors, the posting engine commits a durable `acc_posting_exceptions` row + `POSTING_EXCEPTION` board item naming the missing determinants!)*
- **Server wire response:**
  ```json
  {
    "success": false,
    "status": "ERROR",
    "statusCode": 422,
    "errorCode": "ACCOUNTING.POSTING.NO_ACCOUNT_RULE",
    "message": "No posting rule matched the document determinants.",
    "details": {
      "postingExceptionId": "0195f2d8-1100-7e11-8440-ccddeeff0003",
      "eventKind": "COMMERCIAL_INVOICE",
      "mappingKey": "CONSULTING_EXPORT"
    },
    "errorCategory": "UNPROCESSABLE",
    "correlationId": "0195f2d8-1101-7e11-8440-ccddeeff0004",
    "timestamp": "2026-11-01T13:18:50.005Z"
  }
  ```
- **Rendered UI Copy:**
  - **English (`en`):**
    - **Cause:** `No active account-mapping rule matched event "COMMERCIAL_INVOICE" with mapping key "CONSULTING_EXPORT".`
    - **Effect on Books:** `No journal entry was posted to the General Ledger, and Posting Exception #0195f2d8… was saved to the Exception Queue so this gap is tracked.`
    - **Safe Next Action:** `Add or activate the matching rule in Posting Rules, then retry from Posting Exceptions (or re-post this document).` · `[Open Posting Rules ↗]` `[View Exception ↗]` · `Correlation ID: 0195f2d8-1101-7e11-8440-ccddeeff0004`
  - **Arabic (`ar`):**
    - **السبب:** `لا توجد قاعدة توجيه محاسبي نشطة تطابق الحدث "COMMERCIAL_INVOICE" ومفتاح التوجيه "CONSULTING_EXPORT".`
    - **الأثر على الدفاتر:** `لم يُرحَّل أي قيد إلى الأستاذ العام، وتم حفظ سجل استثناء الترحيل رقم #0195f2d8… في طابور الاستثناءات لمتابعة المعالجة.`
    - **الإجراء الآمن المتاح:** `أضف قاعدة التوجيه المطابقة أو فعّلها في شاشة قواعد الترحيل، ثم أعد المحاولة من استثناءات الترحيل.` · `[فتح قواعد الترحيل ↗]` `[عرض الاستثناء ↗]` · `معرّف التتبع: 0195f2d8-1101-7e11-8440-ccddeeff0004`

#### Worked Example 4 — `503 ACCOUNTING.AUTHORITY.DEPENDENCY_UNAVAILABLE` (`INTENT_COMMITTED`) & `CLIENT_REQUEST_TIMEOUT` (Preserved UUIDv7 Key)

- **Part 4A — `503 ACCOUNTING.AUTHORITY.DEPENDENCY_UNAVAILABLE` (`04_Errors_and_Constants.md` §3.4, `D-520`):**
  - **Triggering call:** `POST /api/tenant/accounting/v1/authority-documents/0195f220-5500-7000-8000-000000000301/decline` when the Egyptian Tax Authority gateway is unreachable after `declineRequestedAt` is committed locally.
  - **Catalogue row:** HTTP `503` · **`transactionState: INTENT_COMMITTED`** · `RetryClass: AFTER_BACKOFF` · `SafeAction: READ_LOCATION_OR_POLL`.
  - **English (`en`):**
    - **Cause:** `The Egyptian Tax Authority service was temporarily unreachable while forwarding your decline notice.`
    - **Effect on Books:** `Your decline intent (declineRequestedAt) is safely saved in Accounting; no ledger reversal occurred.`
    - **Safe Next Action:** `Do not submit the decline again. Background polling will forward it within the statutory window, or click "Poll Status" later to verify.` · `[Poll Authority Status]`
  - **Arabic (`ar`):**
    - **السبب:** `تعذر الاتصال المؤقت ببوابة مصلحة الضرائب المصرية أثناء تمرير إشعار الاعتراض.`
    - **الأثر على الدفاتر:** `تم حفظ طلب الاعتراض بأمان داخل النظام (declineRequestedAt)؛ ولم يُعكس القيد المحاسبي.`
    - **الإجراء الآمن المتاح:** `لا تُعد إرسال الاعتراض؛ ستتولى خدمة المزامنة الخلفية استكماله ضمن المهلة القانونية، أو يمكنك الضغط على "استعلام عن الحالة" لاحقاً.` · `[استعلام عن الحالة]`
- **Part 4B — `CLIENT_REQUEST_TIMEOUT` on Idempotent Write (Preserving Exact UUIDv7 `x-idempotency-key`):**
  - **Triggering call:** `POST /api/tenant/accounting/v1/fiscal-documents/0195f210-33b0-7000-8000-000000000215/post` with `x-idempotency-key: 0195f2df-7c40-7a88-9b12-001122334455` times out at 30s (`AMBIGUOUS`).
  - **English (`en`):**
    - **Cause:** `The connection timed out before Accounting confirmed whether posting finished.`
    - **Effect on Books:** `Outcome is not yet confirmed — the journal entry may already have posted on the server or may have stopped before committing.`
    - **Safe Next Action:** `Form inputs are locked to protect idempotency key 0195f2df-7c40-7a88-9b12-001122334455. Click "Check Document Status" first, or click "Retry Safely (Same Key)" to replay without risk of double posting.` · `[Check Document Status]` `[Retry Safely (Same Key)]`
  - **Arabic (`ar`):**
    - **السبب:** `انتهت مهلة الاتصال قبل استلام تأكيد إتمام عملية الترحيل من الخادم.`
    - **الأثر على الدفاتر:** `النتيجة غير مؤكدة بعد — قد يكون القيد قد رُحِّل بالفعل على الخادم أو توقف قبل الاعتماد.`
    - **الإجراء الآمن المتاح:** `تم قفل حقول النموذج للاحتفاظ بمفتاح عدم التكرار 0195f2df-7c40-7a88-9b12-001122334455. اضغط "التحقق من حالة المستند" أولاً، أو اضغط "إعادة المحاولة بأمان (بنفس المفتاح)" دون خطر تكرار الترحيل.` · `[التحقق من حالة المستند]` `[إعادة المحاولة بأمان (بنفس المفتاح)]`

---

## 5. Entitlement & Recovery Boundary Screens (`P03.T07.S5`)

### 5.1 Guard Precedence & Bootstrap Architecture (`10_Feature_Tiers.md` §3, §9–§11)

Accounting evaluates admission in strict order (`0..7`):
`0` Valid JWT -> `1` `PROVISIONING_MAINTENANCE` (`403`) -> `2` `SEAT_REQUIRED` (`403`) -> `3` `MODULE_DISABLED` (`403`) -> `4` `RECOVERY_MODE` (`403` on writes) -> `5` Feature Entitlement (`403 NOT_ENTITLED` | `503 ENTITLEMENT_UNAVAILABLE`) -> `6` RBAC Permission (`403`) -> `7` Company/Branch Context & Profile (`409 PROFILE.NOT_FOUND` | `NOT_ACTIVATED`).

`useAccountingBoundaryGate` hydrates from `GET /api/tenant/accounting/v1/meta/features` on Accounting shell entry (invalidating whenever tenant plan/company context changes or any `403`/`503` `ACCOUNTING.FEATURE.*` response arrives) and renders a dedicated, unmistakable boundary experience for **every** code:

### 5.2 Complete Boundary Code Specification Matrix

| Boundary Code & HTTP | Trigger & Guard Step | Surface Pattern | Primary / Secondary CTAs | Critical UX & Data-Safety Rules |
| --- | --- | --- | --- | --- |
| **`403 ACCOUNTING.FEATURE.PROVISIONING_MAINTENANCE`** | Guard 1: Tenant database is inside a brief provisioning / relocation maintenance fence | Full-section `ServiceMaintenanceState` (`caution` tone, `Wrench` icon) | Primary: **`Check Availability Now`** (re-queries `/accounting/meta/features`) · Secondary: `Back to Workspace` | Explicitly reassure operator: *"Scheduled schema/server maintenance is active for a few moments; all posted entries are safe."* Never mislabel as permission denial. |
| **`403 ACCOUNTING.FEATURE.SEAT_REQUIRED`** | Guard 2: Authenticated user has no assigned Accounting seat | Full-section `EntitlementGate` (`UserCheck` icon, `neutral` tone) | Primary (if Tenant Admin): **`Manage Accounting Seats`** (`/settings/users`) · Non-admin: **`Copy Seat Request Reference`** | Clearly distinguishes **user seat assignment** from role permissions (`403` RBAC) and module subscription (`MODULE_DISABLED`). |
| **`403 ACCOUNTING.FEATURE.MODULE_DISABLED`** | Guard 3: Tenant subscription does not include the `accounting` root module | Full-section `ModuleUpsellGate` (`BookOpenCheck` icon) | Primary (if Owner/Billing Admin): **`View Plan & Activate Accounting`** (`/accounting/settings/plan` / Core billing) · Non-admin: **`Contact Workspace Owner`** | Never renders mock financial KPIs or fake ledger rows behind a blur. |
| **`403 ACCOUNTING.FEATURE.NOT_ENTITLED` — Variant A: Commercial Tier (`details.requiredTier = 'ADVANCED'`, no `wave`)** | Guard 5: Shipped Advanced capability accessed by a `Basic`-bundle tenant | Route or action `TierUpgradeGate` (`Sparkles` icon) + **Downgraded-Tenant Read-Only Mode** (`10_Feature_Tiers.md` §10) | Primary: **`Compare Basic vs Advanced Plan`** (`/accounting/settings/plan` `SCR-36`) | **Downgrade Safety (`10_Feature_Tiers.md` §10):** If a formerly Advanced tenant downgraded to Basic, historical records stay **readable** (`GET` allowed where documented) while create/execute buttons show a disabled `Upgrade to Advanced` lock tooltip. |
| **`403 ACCOUNTING.FEATURE.NOT_ENTITLED` — Variant B: Post-MVP Wave (`details.wave = 1 \| 2 \| 3`)** | Guard 5: Reserved wave capability (`13_Delivery_Plan.md` §4) accessed before its wave ships | Full-section `ScheduledCapabilityState` (`CalendarClock` icon, `neutral` tone) | Primary: **`Back to Accounting Home`** · Secondary: **`View Capability Roadmap (`SCR-36`)`** | **Honesty Rule:** Never tell a customer to "Upgrade your subscription now" for an unshipped `WAVE-1`/`WAVE-2`/`WAVE-3` capability; state clearly that it is part of Advanced Wave `<wave>` and not yet enabled for this environment. |
| **`503 ACCOUNTING.FEATURE.ENTITLEMENT_UNAVAILABLE`** | Guard 5 fail-closed: Core entitlement cache/service temporarily unreachable (`Retry-After` present) | Full-section `TemporaryVerificationState` (`CloudOff` icon, `caution` tone — **never `403` upsell!**) | Primary: **`Retry Verification`** (respects `Retry-After` countdown) + copyable `correlationId` | **Critical Distinction:** Explicitly state *"We could not verify your subscription entitlements right now (HTTP 503). Your plan has NOT changed and no data was lost."* |
| **`403 ACCOUNTING.FEATURE.RECOVERY_MODE`** | Guard 4: Declared data-loss incident recovery mode (`12_Platform_Changes.md` §4.10.1 step 3) | **Persistent Top Shell `Banner`** (`negative`/`caution` high-attention bar across every `/accounting/*` screen) + **`ReadOnlyGate`** on all `/api/tenant/accounting/v1/*` writes + **Active Incident Sign-Off Drawer** | Banner CTA (for Tenant Owner or `accounting.recovery_incident.approve_correction` holder): **`Review & Sign Off Recovery Incident`** (calls Core `/api/tenant/core/v1/restore-incidents/*`) | See §5.4 below: all Accounting reads, statements, attachments, and legal downloads stay live; all `/api/tenant/accounting/v1/*` `POST`/`PATCH`/`PUT`/`DELETE` buttons are disabled with tooltip; **Core incident routes remain active** (`D-557`). |
| **`403 ACCOUNTING.FEATURE.RECOVERY_OPERATION_NOT_ALLOWED`** | Recovery-only operation invoked outside active recovery or by non-recovery principal | Focused `InlineAlert` / `BoundaryState` (`ShieldBan` icon, `negative` tone) | Primary: **`Return to Accounting Home`** (or **`Open Active Recovery Incident`** if in recovery) | Explains that the requested recovery command is restricted to active incident execution by authorized recovery operators + copyable `correlationId`. |
| **Companion: `409 ACCOUNTING.PROFILE.NOT_FOUND` / `NOT_ACTIVATED`** | Guard 7: Selected company has not completed Accounting activation (`ACT-01..07`) | Guided `CompanyActivationGate` (`Building2` icon) | Primary (if `accounting.profile.activate`): **`Start Company Activation Wizard`** (`/accounting/setup` `SCR-01`) · Otherwise: **`Switch Company`** | Prevents confusing blank tables on unactivated companies (`accounting-ia.md`). |
| **Companion: `TenantStatus.ARCHIVED` (`12_Platform_Changes.md` §4.9, `D-079`)** | Statutory 5-year retention archive mode | Persistent `neutral`/`caution` top `Banner` (*"Workspace Archived — Statutory Read-Only Retention"*) | Primary: **`Download Exit Packages`** (`/accounting/settings/exit-packages` -> `GET .../exit-packages/:id/download`) | Disables all write controls across the workspace while keeping every ledger report, fiscal document, attachment download, and exit-package download available. |

### 5.3 Bilingual Copy Dictionary for Every Boundary Screen (`ar` & `en`)

| Boundary Key | Arabic Headline & Body (`ar`) | English Headline & Body (`en`) |
| --- | --- | --- |
| `PROVISIONING_MAINTENANCE` | **جاري تنفيذ صيانة مجدولة لقاعدة البيانات** — تتوقف العمليات مؤقتاً لبضع لحظات أثناء تحديث البنية التحتية؛ جميع القيود والأرصدة محفوظة بالكامل. | **Scheduled Database Maintenance in Progress** — Accounting operations are paused briefly while infrastructure updates complete; all posted entries and balances remain intact. |
| `SEAT_REQUIRED` | **يتطلب الوصول مقعد مستخدم في المحاسبة** — حسابك لا يحمل حالياً مقعداً مخصصاً لتطبيق المحاسبة. اطلب من مسؤول النظام تخصيص مقعد لحسابك. | **Accounting User Seat Required** — Your user account does not currently have an assigned Accounting seat. Ask your workspace administrator to assign a seat to your profile. |
| `MODULE_DISABLED` | **تطبيق المحاسبة غير مُفعَّل في باقتك الحالية** — فعّل وحدة المحاسبة لإدارة الأستاذ العام والضرائب والفواتير الإلكترونية وإقفال الفترات. | **Accounting Module Is Not Active on Your Plan** — Activate the Accounting module to manage your General Ledger, tax compliance, electronic invoicing, and period close. |
| `NOT_ENTITLED` *(Tier)* | **هذه الميزة متاحة ضمن الباقة المتقدمة (Advanced)** — تظل السجلات التاريخية متاحة للقراءة والمراجعة، بينما يتطلب إنشاء عمليات جديدة الترقية إلى الباقة المتقدمة. | **Available on the Accounting Advanced Plan** — Existing historical records remain open for read-only inspection; creating or running new operations requires upgrading to Advanced. |
| `NOT_ENTITLED` *(Wave N)* | **ميزة مجدولة ضمن المرحلة المتقدمة (الموجة `<wave>`)** — هذه الإمكانية محجوزة معمارياً وغير مفعّلة في الإصدار الحالي، ولا تتطلب أي إجراء على اشتراكك الآن. | **Scheduled for Advanced Wave `<wave>`** — This capability's data hooks are reserved, and the workflow is not yet enabled in this release; no subscription action is needed today. |
| `ENTITLEMENT_UNAVAILABLE` | **تعذر التحقق المؤقت من صلاحيات الباقة (503)** — لم تتغير باقتك ولم تُفقد أي بيانات، ولكن يتعذر الوصول لخدمة التحقق حالياً. أعد المحاولة بعد لحظات. | **Subscription Verification Temporarily Unavailable (503)** — Your plan has not changed and no data was affected, but entitlement verification could not be reached. Retry in a few moments. |
| `RECOVERY_MODE` | **وضع الاستعادة النشط (للقراءة فقط مؤقتاً)** — تم تجميد الإدخال والترحيل في المحاسبة لحين مراجعة واعتماد حادث استعادة البيانات؛ جميع التقارير والتنزيلات القانونية متاحة. | **Recovery Mode Active (Accounting Temporarily Read-Only)** — Accounting writes and postings are frozen until the data-loss restore incident is reviewed and signed off; all reports and legal downloads remain available. |
| `RECOVERY_OPERATION_NOT_ALLOWED` | **عملية استعادة غير مسموح بها في الحالة الحالية** — يُسمح بتنفيذ هذا الإجراء فقط ضمن حادث استعادة نشط وبصلاحية الاستعادة المعتمدة. | **Recovery Operation Not Permitted in Current State** — This command is restricted to an active restore incident executed by an authorized recovery role. |

### 5.4 `RECOVERY_MODE` Persistent Banner & Active Core Restore-Incident Sign-Off Exception (`12_Platform_Changes.md` §4.10.2, `D-557`)

When a tenant enters declared data-loss recovery mode (`12_Platform_Changes.md` §4.10.1 step 3):

1. **Global Accounting Read-Only Fence (`/api/tenant/accounting/v1/*`):**
   - Every `GET` (plus read-only `/search`, `/count`, and `SignedDownloadDto` downloads) continues working normally so accountants and auditors can inspect trial balances, fiscal documents, and tax periods.
   - Every mutation control across Accounting (`Post`, `Submit`, `Resubmit`, `Cancel`, `Assign`, `Dismiss`, `Upload Attachment`, `Create Draft`) is wrapped in `ReadOnlyGate` (`disabled` + tooltip citing `ACCOUNTING.FEATURE.RECOVERY_MODE`).
2. **Active Core Gateway Sign-Off Exception (`/api/tenant/core/v1/restore-incidents/*`):**
   - Because `/api/tenant/accounting/v1/*` refuses every `POST` during `RECOVERY_MODE`, the Persistent Recovery Banner exposes **`Review & Sign Off Incident`**, opening the **Incident Sign-Off Drawer** backed **exclusively by Core Gateway routes** (`D-557`):
     - **Read Active Incident:** `GET /api/tenant/core/v1/restore-incidents/current` (admitted for **Tenant Owner** OR any user holding `accounting.recovery_incident.approve_correction`). Displays `incidentId`, `itemsHash` (`<IdentifierText />`), checkpoint coverage timestamp, and the list of regressed / `UNKNOWN` marks (`NO_REGRESSION | REGRESSION | UNKNOWN`) and correction drafts (`draftRef`).
     - **Action 1 — Tenant Owner Acknowledgement:** `POST /api/tenant/core/v1/restore-incidents/:incidentId/acknowledge` (visible **strictly** when `user.isTenantOwner === true`; body `{ itemsHash, itemIds }` with UUIDv7 `x-idempotency-key`).
     - **Action 2 — Dual-Operator Correction Approval:** `POST /api/tenant/core/v1/restore-incidents/:incidentId/corrections/:draftRef/approve` (visible when caller holds `accounting.recovery_incident.approve_correction` on that correction's company and is not the first approver — enforces the **two-distinct-users** rule).
     - **Stale Marks Guard (`WORKER.RESTORE.INCIDENT_MARKS_CHANGED`):** If `itemsHash` changed since the drawer opened, displays a non-destructive refresh alert, reloads `GET /api/tenant/core/v1/restore-incidents/current`, and requires the operator to re-confirm the updated mark list before acknowledging.

### 5.5 Four-Combination ASCII Wireframes — Entitlement & `RECOVERY_MODE` Boundaries

#### 5.5.1 Arabic RTL — Light (`dir="rtl"`, `theme="light"` — `RECOVERY_MODE` Banner + Core Incident Drawer)

```text
+------------------------------------------------------------------------------------------------------+
| [! وضع الاستعادة النشط: المحاسبة للقراءة فقط لحين اعتماد حادث الاستعادة · التقارير والتنزيلات متاحة]  |
| [مراجعة واعتماد حادث الاستعادة (Core API)]                            معرّف الحادث: INC-2026-0004    |
+------------------------------------------------------------------------------------------------------+
| المستندات الضريبية / INV-2026-00418                  [🔒 طلب الإلغاء معطّل مؤقتاً في وضع الاستعادة]  |
+------------------------------------------------------------------------------------------------------+
| [درج اعتماد حادث الاستعادة · GET /api/tenant/core/v1/restore-incidents/current · D-557]             |
| بصمة البنود (itemsHash): sha256:44a1...88f0 [📋]  ·  آخر نقطة تغطية: 2026-11-01 11:45 UTC           |
| 1. إقرار ق.م سبتمبر 2026 · الحالة: UNKNOWN (يتطلب إقرار مالك الحساب + موافقة مراجعين مختلفين: 1/2)   |
| [اعتماد مسودة التصحيح (المراجع الثاني)]   [إقرار مالك الحساب بقائمة الفجوات (Tenant Owner)]          |
+------------------------------------------------------------------------------------------------------+
```

#### 5.5.2 Arabic RTL — Dark (`dir="rtl"`, `theme="dark"` — `503 ENTITLEMENT_UNAVAILABLE` vs `403 NOT_ENTITLED`)

```text
+------------------------------------------------------------------------------------------------------+
| [حالة 503 ACCOUNTING.FEATURE.ENTITLEMENT_UNAVAILABLE · الوضع الداكن · فشل تحقق مؤقت وليس ترقية!]     |
| +--------------------------------------------------------------------------------------------------+ |
| | ☁️ تعذر التحقق المؤقت من صلاحيات الباقة (HTTP 503)                                               | |
| | السبب: خدمة التحقق من الاشتراكات غير متاحة مؤقتاً.                                               | |
| | الأثر: لم تتغير باقتك الحالية ولم يتأثر أي قيد أو رصيد محاسبي.                                   | |
| | [إعادة المحاولة خلال 5 ثوانٍ]        معرّف التتبع: 0195f2e9-0012-7a00-8000-998877665544 [📋]     | |
| +--------------------------------------------------------------------------------------------------+ |
+------------------------------------------------------------------------------------------------------+
```

#### 5.5.3 English LTR — Light (`dir="ltr"`, `theme="light"` — `RECOVERY_MODE` Banner + Core Incident Drawer)

```text
+------------------------------------------------------------------------------------------------------+
| [! Recovery Mode Active: Accounting writes are frozen pending restore-incident sign-off (Read-Only)] |
| Incident: INC-2026-0004                              [Review & Sign Off Incident (Core Gateway API)] |
+------------------------------------------------------------------------------------------------------+
| Fiscal Documents / INV-2026-00418                     [🔒 Request Cancel disabled in Recovery Mode]  |
+------------------------------------------------------------------------------------------------------+
| [Restore-Incident Sign-Off Sheet · GET /api/tenant/core/v1/restore-incidents/current · D-557]        |
| Items Hash: sha256:44a1...88f0 [📋]  ·  Verified Checkpoint Coverage: 2026-11-01 11:45 UTC           |
| 1. Sep 2026 VAT Return · Mark: UNKNOWN (Requires Tenant Owner Ack + 2 Distinct Approvers: 1/2 done)  |
| [Acknowledge Gap List (Tenant Owner)]   [Approve Correction Draft (2nd Approver)]                    |
+------------------------------------------------------------------------------------------------------+
```

#### 5.5.4 English LTR — Dark (`dir="ltr"`, `theme="dark"` — `403 NOT_ENTITLED` Wave Hook vs Commercial Tier)

```text
+------------------------------------------------------------------------------------------------------+
| [403 ACCOUNTING.FEATURE.NOT_ENTITLED · Variant B: details.wave = 1 · Dark Theme]                     |
| +--------------------------------------------------------------------------------------------------+ |
| | 🗓 Scheduled for Accounting Advanced — Wave 1                                                    | |
| | Cause: Feature key "accounting.controls.journal_analyzer" is scheduled for Post-MVP Wave 1.      | |
| | Effect: No subscription upgrade is required right now; your current Basic ledger is unaffected.  | |
| | [Back to Accounting Home]   [View Feature & Wave Roadmap (SCR-36)]                               | |
| +--------------------------------------------------------------------------------------------------+ |
+------------------------------------------------------------------------------------------------------+
```

---

## 6. Contract Gaps for `P03.T11` & Bilingual Dictionary Namespace Handoff

### 6.1 Contract Gaps Discovered During `P03.T07` Reconciliation (`P03.T11` Queue)

Every screen above works strictly within existing backend routes without inventing fields or endpoints, while recording five exact projection/permission gaps for `P03.T11`:

| Gap ID | Affected Surface | Verified Current LLD State | Exact Reconciliation Needed in `P03.T11` |
| --- | --- | --- | --- |
| **`CG-DOC-01`** | `SCR-19` Exception Board Inspector & Specialized Dismissals | `02_Endpoint_Catalogue.md` §6 exposes `GET /accounting/exception-board` and `POST .../search` (no `GET .../:id`), and `02_DTOs.md` §13.1 rule 4 omits `jsonb` (`details`) and `varchar(>255)` (`resolutionNote`, `varchar(1000)`) from `<E>SummaryDto` unless explicitly overridden. | Explicitly whitelist `details` (`jsonb` — needed for `reachedPlaceholderIds`, `placeholderIds`, `withheldFacts`, `checkCode`, `conflictingRunId`) and `resolutionNote` on `ExceptionBoardItemSummaryDto` (or add `GET /accounting/exception-board/:id` returning `ExceptionBoardItemDetailDto`). |
| **`CG-DOC-02`** | `SCR-17` Document Viewer — Tax Decision Receipt Card | `GET /accounting/tax/decision-receipts` (`02_Endpoint_Catalogue.md` §5) requires `accounting.tax_transaction.read` (`COMPANY`), which `accounting-ia.md` assigns to Chief Accountant / Auditor, whereas `accounting_accountant` (`COMPANY_OR_BRANCH`) holds `accounting.fiscal_document.read`. | Either grant `accounting.tax_transaction.read` (or widen `GET /accounting/tax/decision-receipts?fiscalDocumentId=` admission to `ANY(accounting.tax_rule.read, accounting.fiscal_document.read)` within document scope) so branch/standard accountants can inspect a document's tax receipt, or confirm the inline `PermissionGate` fallback in §1.2. |
| **`CG-DOC-03`** | `SCR-17` Document Viewer — Tax Breakdown Per Line | `GET /accounting/fiscal-documents/:id/lines` returns `FiscalDocumentLineSummaryDto[]` (`02_DTOs.md` §13.1), while per-line resolved tax sub-rows live in `acc_tax_decision_receipts` / `acc_tax_transactions`. | Confirm in `02_DTOs.md` §7 whether `FiscalDocumentLineSummaryDto` includes a read-only `taxes[]` summary array or whether `SCR-17` Tab 2 hydrates line-by-line `T1..T12` amounts exclusively from `TaxDecisionReceiptDetailDto`. |
| **`CG-DOC-04`** | `SCR-17` Synthetic In-Flight Attempt Node (`D-518`) | `acc_authority_document_attempts` inserts a row only once an attempt's outcome is known (`D-518`). While `status = 'PENDING'`, `AuthorityDocumentDetailDto` holds `attemptNo`, `internalId`, `submissionUuid`, and `submittedAt`. | Confirm `AuthorityDocumentDetailDto` always populates `(attemptNo, internalId, submissionUuid, submittedAt)` synchronously before `202 Accepted` returns so `useAuthorityTimeline` can render the synthetic head `PENDING` node with zero missing fields. |
| **`CG-DOC-05`** | `SCR-19` & `W-04` Target Deep-Link Resolution | `acc_exception_board_items` stores polymorphic `(targetType, targetId)`. For `acc_authority_documents` targets (`AUTHORITY_PENDING_TIMEOUT`, `AUTHORITY_INVALID`, `RECEIVER_REJECTED`, `CANCELLATION_PENDING`), navigating to `SCR-17` (`/accounting/documents/[fiscalDocumentId]`) needs `fiscalDocumentId`. | Include `fiscalDocumentId` inside `details` on `acc_authority_documents`-targeted board items (alongside `CG-DOC-01`) so `SCR-19` and Home widget `W-04` link directly to `/accounting/documents/[fiscalDocumentId]` in one click without an extra `GET /authority-documents/:targetId` lookup. |

### 6.2 `i18n` Dictionary Namespace Handoff (`ar.ts` & `en.ts`, Zero Language Ternaries)

All strings introduced by `P03.T07` reside under `t.accounting` with 100% key parity between `src/i18n/locales/ar.ts` and `src/i18n/locales/en.ts`:
- `t.accounting.documents.kinds.*` (all 14 `DocumentKind` literals)
- `t.accounting.documents.fiscalStatus.*` (all 8 `FiscalDocumentStatus` literals)
- `t.accounting.documents.authorityStatus.*` (all 11 `AuthorityDocumentStatus` literals)
- `t.accounting.documents.freezeStatus.*` (all 3 `AuthorityFreezeStatus` literals)
- `t.accounting.documents.attemptOutcome.*` (all 9 `AttemptOutcome` literals)
- `t.accounting.documents.inputTaxEvidence.*` (all 5 `InputTaxEvidence` literals)
- `t.accounting.documents.attachmentClass.*` (all 3 `AttachmentClass` literals)
- `t.accounting.exceptionBoard.kinds.*` (all **45** `ExceptionBoardKind` literals)
- `t.accounting.exceptionBoard.status.*`, `.severity.*`, `.resolution.*`, `.dismissModal.*`
- `t.accounting.waitingStates.WS_01..WS_07.{badge,title,bound,owner,action,compensation}`
- `t.accounting.errors.{codes.*,transactionState.*,safeAction.*,timeoutPanel.*}`
- `t.accounting.boundaries.{PROVISIONING_MAINTENANCE,SEAT_REQUIRED,MODULE_DISABLED,NOT_ENTITLED_TIER,NOT_ENTITLED_WAVE,ENTITLEMENT_UNAVAILABLE,RECOVERY_MODE,RECOVERY_OPERATION_NOT_ALLOWED,PROFILE_NOT_ACTIVATED,TENANT_ARCHIVED}`

## Contract reconciliation (P03.T11, 1 November 2026)

Reconciles the gaps of this spec against the Endpoint Catalogue and `02_DTOs.md` after `D-770`, `D-771` and `D-772`. The gap list above keeps the original findings; these rulings are final.

| Gap id | Ruling | Where |
| --- | --- | --- |
| `CG-DOC-01` | closed by D-772 | `ExceptionBoardItemSummaryDto` declared with every column, `targetRef`, `details`, `resolutionCode` and `resolutionNote`; no board `GET /:id` |
| `CG-DOC-02` | already in the contract | `accounting_accountant` and the other seeded templates hold `accounting.tax_transaction.read` (Permissions and Features §7); only the cashier lacks it, so the scoped `PermissionGate` card stays |
| `CG-DOC-03` | closed by D-772 | `TaxTransactionListQueryDto` gains `fiscalDocumentId?` and `fiscalDocumentLineId?` (the latter only with the former); the line DTO gets no `taxes[]` |
| `CG-DOC-04` | closed by D-772 (half false) | `AuthorityDocumentDetailDto` gains `attemptNo`; `submissionUuid` and `submittedAt` are null at `202` (`D-520`), so the spec renders them as pending and no document changes |
| `CG-DOC-05` | duplicate of CG-DOC-01 | No `details.fiscalDocumentId`: an authority-document target links to `GET /accounting/authority-documents/:id`, whose detail carries `fiscalDocumentId` |
