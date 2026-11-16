# Accounting Vertical-Slice Screen Specification — `SCR-15`: VAT Return Workspace, Tax Registers & VAT Refund Claims (`P03.T10.S4`)

> **Lead review, 1 November 2026 (P03.T10).** No correction was needed; the return-to-ledger comparison read and a refund claim detail route are named only as gaps. Every route, permission, feature key and scope below was checked against `backend/docs/LLD/accounting-app/02_API_Contracts/02_Endpoint_Catalogue.md`, `04_Static_Data/05_Permissions_and_Features.md` and `10_Feature_Tiers.md`; what the contracts lack stays in the contract gap list for `P03.T11`.

- **Plan Task:** `P03.T10.S4` — `SCR-15` VAT return workspace (two reconciliations, official-column export, filing reference) *(lead review)*
- **Screen Inventory Row:** `SCR-15` (`frontend/tenant-portal/docs/plans/accounting-screen-inventory.md` §3, line 94)
- **Covered Next.js Routes (`accounting-ia.md` §2.5 & §5 — Section `5. File / الإقرارات والامتثال`):**
  1. **`#76` `/accounting/file/tax-returns`** (`TENANT_ROUTES.accountingTaxReturns`) — Tax Returns list, Open Return Period modal (`[Slice subset — P19.T09]`), and VAT Refund Claims register tab (`[Full stage completion — P20.T07]`)
  2. **`#77` `/accounting/file/tax-returns/[id]`** — VAT Return Workspace: header readiness strip, computed boxes & formula bar, **Reconciliation 1 (Return-to-Ledger, `RET-07`)**, **Reconciliation 2 (Authority Package, `RET-08`)**, **Official-Column Export drawer (`RET-09`)**, **File Return & Acknowledgement Reference (`RET-10`–`RET-12`)** (`[Slice subset — P19.T09]`), plus **Amendments / Corrections**, **Post-Restore Filing Gap & Held-Transactions Recovery**, and **Period VAT Refund Claims & Dual-Control Withdrawals** (`[Full stage completion — P20.T07 / P21]`)
  3. **`#84` `/accounting/file/tax-registers`** (`TENANT_ROUTES.accountingTaxRegisters`) — Tax Transactions keyset ledger, Aggregated Tax Report, Sales Register, Purchase Register (`[Slice subset — P19.T09]`), plus `[S]` Decision Receipts list and entitled `[S]` Withholding Register view
  4. **`#85` `/accounting/file/tax-registers/[id]`** — Single Tax Transaction Detail, `baseComposition` breakdown & immutable Decision Receipt inspector (`[Slice subset — P19.T09]`)
- **Primary Endpoint Ownership:** **`[P: 35]`** (`20` `[Slice subset — P19.T09]` + `15` `[Full stage completion — P20.T07 / P21]`) + **`18` `[S]`** shared supporting endpoints
- **Authoritative Sources Verified (`2026-11-01`):**
  - `frontend/tenant-portal/docs/design/README.md` ("Accounting design process" & Lead Review Checklist)
  - `frontend/tenant-portal/docs/design/specs/{accounting-ia,accounting-home,accounting-status-and-a11y,accounting-patterns-data,accounting-patterns-workflow,accounting-patterns-documents,accounting-stage1-reports-plan}.md`
  - `frontend/tenant-portal/docs/plans/accounting-screen-inventory.md` (`SCR-15`)
  - `frontend/.agents/skills/ui-ux-pro-max/SKILL.md` & `frontend/.agents/skills/frontend-design/SKILL.md`
  - `backend/docs/LLD/accounting-app/05_Flows/09_User_Journey_Tax_Return_Filing.md` (`RET-01`..`RET-12`)
  - `backend/docs/LLD/accounting-app/07_Modules/10_MVP/03_tax_engine_and_returns.md` (`UC-TAX-4`, §8.6–§8.11, §11 `VAL-TAX-01`..`VAL-TAX-48`)
  - `backend/docs/LLD/accounting-app/01_ERD/03_Tax_Tables.md` (`acc_tax_transactions` .. `acc_vat_refund_claim_withdrawals`)
  - `backend/docs/LLD/accounting-app/02_API_Contracts/02_Endpoint_Catalogue.md` (§5, §6, §10, §11, §12)
  - `backend/docs/LLD/accounting-app/04_Static_Data/{01_Enums,02_DTOs,04_Errors_and_Constants,05_Permissions_and_Features}.md`
  - `backend/docs/LLD/accounting-app/13_Delivery_Plan.md` (§3.6 Vertical Slice)

---

## 0. Governance, Design Laws, Phasing & `< 300`-Line File Architecture

### 0.1 Binding Tenant Portal & Accounting Design Laws (`docs/design/README.md`, `ui-ux-pro-max`)

1. **Zero Invention & Verbatim Contract Fidelity:** Every HTTP method, canonical browser path (`/api/tenant/accounting/v1/<route>`), permission string, feature key, `AccountingScopeTarget`, idempotency requirement, optimistic-concurrency header (`If-Match`), DTO property, enum literal, and error code is copied verbatim from `02_Endpoint_Catalogue.md`, `02_DTOs.md`, `01_Enums.md`, and `04_Errors_and_Constants.md`. Where a screen capability from `09_User_Journey_Tax_Return_Filing.md` or `03_tax_engine_and_returns.md` lacks a server route or DTO member today, this spec documents the **exact honest degraded boundary** and records the requirement in **§8 Contract Gap List for `P03.T11` (`CG-VAT-01`..`CG-VAT-09`)** — never inventing a route or computing statutory numbers in JavaScript.
2. **Design System Barrel Only (`@/design-system`):** Feature code imports exclusively from `@/design-system` and approved `src/features/accounting/shared/` pattern primitives (`AccountingScopeBar`, `DocumentHeaderBand`, `StatusHistoryDrawer`, `AsyncProgressCard`, `EvidenceAttachmentPanel`, `MakerCheckerBanner`, `RecoveryModeBanner`, `ExceptionItemCard`, `Money`, `IdentifierText`, `DateText`).
3. **Color & Non-Color Status Discipline:**
   - Strictly four semantic outcome hues (`brand`, `positive`, `caution`, `negative`) plus the `ink` neutral ramp (`bg-surface`, `bg-surface-subtle`, `border-line`, `text-ink`, `text-ink-muted`).
   - `brand` is **never** used on status badges (`anti-patterns.md`). Every status pill pairs a semantic tone + Lucide icon + localized `t.accounting.taxReturns.status.*` string (never a raw wire enum).
4. **Typography & Numeric Precision:**
   - Three font weights only: `font-normal` (`400`, mandatory in all `<td>` body cells), `font-medium` (`500`, labels/tabs/buttons), `font-semibold` (`600`, KPI figures/section headers/return totals). Zero `font-bold`, zero `text-[Npx]`, zero `rounded-xl` or larger.
   - Zero `Number()` / `parseFloat()` on `DecimalString`. Every box base, tax total, ledger balance, reconciling item, carry-forward credit, and refund claim amount renders via `<Money value={decimalString} currency={currencyCode} />` (`tabular-nums`, `dir="ltr"` `<bdi>`, Western numerals `0–9` in both `ar-EG-u-nu-latn` and `en-US`).
   - Official template column headers (e.g. `DOC_TYP`, `TAX_TYP`, `TYP_SCH`, `COMM_TYPE`, `TAX_CAT`), box codes (`BOX_01`..`BOX_15`), TRNs, filing references, UUIDs, ETags, and SHA-256 checksums wrap in `<IdentifierText>` (`font-mono dir="ltr"`).
5. **Single Primary CTA Law:** At most **one** `Button variant="primary"` appears on any screen at one time, placed in `PageActionBar` and resolved deterministically from return state, preconditions, feature entitlements, and permissions (§2.1, §3.1, §4.1). All secondary toolbar, tab, drawer, and row actions use `variant="outline"` or `variant="ghost"`.
6. **UUIDv7 & Idempotency Persistence:** Every mutating command (`POST`, `PATCH`, `DELETE`, excluding `{ skipAutoIdempotency: true }` read-only `POST /search`, `POST /count`, `POST /lookup`) generates a client **UUIDv7** via `generateUUIDv7()` from `@/lib/uuid` (never `crypto.randomUUID()`). One key is created per user intent and **preserved in hook memory across `408` / `502` / `503` / `504` / network timeouts** until a definitive `2xx` or non-transient `4xx` arrives (`accounting-status-and-a11y.md` §3.4).
7. **Zero-Role & Zero-Language-Ternary Rules:** Authorization inspects only `user.featureEntitlements[featureKey]`, `user.permissions.includes(permissionKey)`, and `user.isTenantOwner` (strictly for `POST /:id/acknowledge-copy-unobtainable` where the catalogue mandates tenant-owner admission). Components never branch on `locale === "ar"` for copy; every label lives in `ar.ts` and `en.ts`, and layout direction uses Tailwind logical utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `text-end`).

---

### 0.2 Explicit Phasing Boundary: `[Slice subset — P19.T09]` vs `[Full stage completion — P20.T07 / P21]`

Per `13_Delivery_Plan.md` §3.6 (*Collect-to-Close-to-VAT Vertical Slice*) and `accounting-screen-inventory.md` row `SCR-15`, `SCR-15` ships in two explicit delivery waves:

| Delivery Wave | Plan Task(s) | Scope Delivered on `#76`, `#77`, `#84`, `#85` | Primary `[P]` Endpoints |
| --- | --- | --- | --- |
| **`[Slice subset — P19.T09]`** | `P19.T09` | • **`#76`:** Tax Returns list + filter bar + `POST /search` + Open Return Period modal (`POST /tax/returns`). *(VAT Refund Claims tab hidden behind stage build gate until `P20.T07`; zero dead links or mock rows.)*<br>• **`#77`:** Full Form 10 VAT Return Workspace: Precondition Readiness Strip (`TAX` soft-close check, partial-recovery check, carry-forward banners), **Tab 1 Computed Return Boxes & Server Formula Bar** (`POST /:id/compute`, `GET /:id/lines`), **Tab 2 Reconciliation 1: Return-to-Ledger (`RET-07`)**, **Tab 3 Reconciliation 2: Authority Package (`RET-08`)**, **Official-Column Export Drawer (`RET-09`, `POST /:id/export`)**, **File Return Modal & Acknowledgement Reference (`RET-10`–`RET-12`, `POST /:id/file`)**, and post-restore **Attach Filed Copy (`POST /:id/attach-filed-copy`)** recorder drawer.<br>• **`#84` & `#85`:** Tax Transactions keyset table + `POST /count` + `POST /search` + `POST /export`, Aggregated Tax Report (`GET /reports/tax-report`), Sales Register (`GET /reports/sales-register`), Purchase Register (`GET /reports/purchase-register`), Decision Receipts list (`[S]`), conditional Withholding Register (`[S]`), and `#85` Transaction Detail + Decision Receipt inspector. | **`19` `[P]`** (`#1`–`#19` in §1.1) |
| **`[Full stage completion — P20.T07 / P21]`** | `P20.T07` *(Mod 03 Tax Engine & Returns)* & `P21` *(Post-restore & exception edge flows)* | • **`#76`:** Top-level `?tab=refund-claims` VAT Refund Claims register (`GET /tax/vat-refund-claims`).<br>• **`#77` Tab 4 (`amendments`):** Cause-1 vs Cause-2 amendment decision wizard, `POST /:id/corrections` (`RegisterTaxCorrectionDto`), `POST /:id/amend` (`AmendTaxReturnDto`), POS settlement pair adjustment (`D-671`), and `AUTHORITY_REQUEST` resolution (`POST /exception-board/:id/dismiss`).<br>• **`#77` Tab 5 (`restoration`):** Second-user confirmation of attached filed copy (`POST /:id/confirm-filed-copy`), `carriedForwardAdjustmentSources` split editor, unobtainable-copy declaration + 2-step approval + owner acknowledgement (`POST /:id/declare-copy-unobtainable`, `POST /:id/acknowledge-copy-unobtainable`), and held-transactions dual-control assignment/release/gap closure (`POST /:id/assign-restored-transactions`, `POST /:id/confirm-restored-transactions`, `POST /:id/close-coverage-gap`).<br>• **`#77` Tab 6 (`refund-claims`):** Create (`POST`), transition (`PATCH /:id`: `FILED` / `APPROVED` / `PAID` / `REJECTED`), delete draft (`DELETE /:id`), partial-approval remainder banner, and dual-control withdrawal attempts (`POST /:id/withdraw`, `POST .../confirm`, `POST .../reject`). | **`15` `[P]`** (`#20`–`#34` in §1.2) |

---

### 0.3 Logic/View Separation & `< 300`-Line File Architecture (`file-architecture.md`)

Every `.tsx` view holds strictly markup and Tailwind logical classes (`< 300` lines); every state machine, query, mutation, ETag lock, and UUIDv7 idempotency slot lives in a dedicated `hooks/use*.ts` file (`< 300` lines):

```text
src/app/(tenant)/accounting/file/
├── tax-returns/
│   ├── page.tsx                                      # Route #76 entry (< 60 lines)
│   └── [id]/
│       └── page.tsx                                  # Route #77 entry (< 60 lines)
└── tax-registers/
    ├── page.tsx                                      # Route #84 entry (< 60 lines)
    └── [id]/
        └── page.tsx                                  # Route #85 entry (< 60 lines)

src/features/accounting/tax-returns/
├── validators/
│   ├── tax-return.validators.ts                      # Runtime boundary validators for return definitions, periods, lines, ledger comparison
│   └── vat-refund-claim.validators.ts                # Runtime boundary validators for VAT refund claims & withdrawals [Full stage]
├── hooks/
│   ├── useTaxReturnListScreen.ts                     # #76 URL filters, GET /tax/returns, POST /search, tab state
│   ├── useOpenTaxReturnModal.ts                      # #76 POST /tax/returns (UUIDv7 key, definition & registration selectors)
│   ├── useTaxReturnWorkspace.ts                      # #77 GET /tax/returns/:id (+ ETag), GET /:id/lines, readiness strip queries
│   ├── useComputeTaxReturnAction.ts                  # #77 POST /:id/compute (If-Match + UUIDv7, sync 200 vs async 202 polling)
│   ├── useTaxReturnLedgerReconciliation.ts           # #77 Tab 2 RET-07 comparison query (GET /tax/returns/:id/ledger-comparison)
│   ├── useTaxReturnAuthorityReconciliation.ts        # #77 Tab 3 RET-08 GET/POST /reconciliations/authority + differences
│   ├── useTaxReturnOfficialExport.ts                 # #77 RET-09 POST /:id/export -> GET /exports/runs/:id -> signed download
│   ├── useFileTaxReturnModal.ts                      # #77 RET-10..12 POST /:id/file (If-Match + UUIDv7 + precondition gate)
│   ├── useTaxReturnAmendments.ts                     # #77 Tab 4 [Full stage P20.T07] POST /:id/corrections, POST /:id/amend, dismiss AUTHORITY_REQUEST
│   ├── useTaxReturnRestorationRecovery.ts            # #77 Tab 5 [Slice attach-filed-copy + Full stage P21 confirm/unobtainable/held rows]
│   └── useVatRefundClaims.ts                         # #76/#77 Tab 6 [Full stage P20.T07] CRUD + transitions + dual-control withdrawals
└── components/
    ├── TaxReturnsListView.tsx                        # #76 shell, tabs, FilterBar, DataTable
    ├── OpenTaxReturnModal.tsx                        # #76 modal view
    ├── TaxReturnWorkspaceView.tsx                    # #77 header band, readiness strip, workspace tabs, single-CTA bar
    ├── TaxReturnReadinessStrip.tsx                   # #77 precondition gates (TAX soft-close, recovery run, carry-forward, interim policy)
    ├── TaxReturnBoxesTab.tsx                         # #77 Tab 1 boxes table + server formula summary bar + generation selector
    ├── TaxReturnLedgerReconciliationTab.tsx          # #77 Tab 2 RET-07 per-box return vs ledger + 7 reconciling item kinds
    ├── TaxReturnAuthorityReconciliationTab.tsx       # #77 Tab 3 RET-08 matchedUntil gate + 4 difference cards + Run reconciliation
    ├── TaxReturnOfficialExportDrawer.tsx             # #77 RET-09 official column header preview + AsyncProgressCard + SHA-256 download
    ├── FileTaxReturnModal.tsx                        # #77 RET-10..12 precondition summary + filingReference form + post-filing bank hint
    ├── TaxReturnAmendmentsTab.tsx                    # #77 Tab 4 [Full stage] Cause 1/2 guide + corrections + amend + AUTHORITY_REQUEST
    ├── TaxReturnRestorationTab.tsx                   # #77 Tab 5 [Full stage + Slice attach drawer] snapshot gap & held transactions
    └── VatRefundClaimsPanel.tsx                      # #76/#77 Tab 6 [Full stage] claims table, transition modal, withdrawal dual-control

src/features/accounting/tax-registers/
├── validators/
│   └── tax-register.validators.ts                    # Runtime validators for tax transactions, decision receipts, and §12 register reports
├── hooks/
│   ├── useTaxRegistersScreen.ts                      # #84 ?view= router, shared filter state, party lookup
│   ├── useTaxTransactionsTab.ts                      # #84 keyset GET /tax/transactions, POST /count, POST /search, POST /export
│   ├── useTaxRegisterReportsTab.ts                   # #84 GET /reports/{tax-report,sales-register,purchase-register,withholding-register}
│   ├── useTaxDecisionReceiptsTab.ts                  # #84 [S] GET /tax/decision-receipts & POST /search
│   └── useTaxTransactionDetail.ts                    # #85 GET /tax/transactions/:id + GET /tax/decision-receipts/:id
└── components/
    ├── TaxRegistersScreenView.tsx                    # #84 PageActionBar, view tabs, active tab mount
    ├── TaxTransactionsTablePanel.tsx                 # #84 keyset DataTable + total count pill + async export trigger
    ├── TaxReportPanel.tsx                            # #84 aggregated Tax Report (groupBy BOX | TAX_TYPE | PARTY)
    ├── SalesPurchaseRegisterPanel.tsx                # #84 Sales Register & Purchase Register views
    ├── TaxDecisionReceiptsPanel.tsx                  # #84 [S] Decision Receipts list view
    └── TaxTransactionDetailView.tsx                  # #85 transaction summary + baseComposition table + 6-step Decision Receipt inspector
```

---

## 1. Complete Endpoint & Action Catalogue (`35` `[P]` + `18` `[S]`; `P-35` added by `D-772`)

> **Canonical Browser Prefix Rule:** Every catalogue path `/accounting/<subpath>` is called from `axiosClient` as **`/api/tenant/accounting/v1/<subpath>`** with `x-mutakamel-company-id` (and `x-mutakamel-branch-id` when selected in `AccountingScopeBar`). No controller-relative path is ever called.

### 1.1 Primary `[P]` Endpoints — `[Slice subset — P19.T09]` (`19` Endpoints)

| # | Method & Catalogue Path *(Browser: `/api/tenant/accounting/v1/...`)* | Permission Key | Feature Key | Scope Target | Idempotency | Concurrency | Request / Query DTO & Response Contract | Routes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `P-01` | `GET /accounting/tax/return-definitions` | `accounting.tax_return.read` | `accounting.tax.returns` | `TENANT` | `none` | `none` | Query: `FindManyDto` (`page?`, `limit?`, `sort?`). `200` paginated `TaxReturnDefinitionSummaryDto[]` (`code`, `nameI18n`, `taxTypeCode`, `countryCode`, `cadence`, `filingOffsetDays`, `currentVersion`, `isActive`). | `#76`, `#77` |
| `P-02` | `GET /accounting/tax/return-definitions/:id` | `accounting.tax_return.read` | `accounting.tax.returns` | `TENANT` | `none` | `none` | `200` `TaxReturnDefinitionDetailDto` + active/pinned `acc_tax_return_definition_versions` (`boxes[]`, `templateColumns[]`, `authorityCode`, `effectiveFrom`, `effectiveTo`) — see `CG-VAT-05`. | `#76`, `#77` |
| `P-03` | `GET /accounting/tax/returns` | `accounting.tax_return.read` | `accounting.tax.returns` | `COMPANY` | `none` | `none` | Query: `TaxReturnPeriodListQueryDto` (`definitionId?`, `registrationId?`, `status?`, `fromDate?`, `toDate?`, `page?`, `limit?`, `sort?`). `200` paginated `TaxReturnPeriodSummaryDto[]`. | `#76`, `#77` |
| `P-04` | `POST /accounting/tax/returns/search` | `accounting.tax_return.read` | `accounting.tax.returns` | `COMPANY` | `none` (`skipAutoIdempotency`) | `none` | Body: `SearchManyDto` (`page?`, `limit?`, `sort?`, `filters?`, `search?`). `200` paginated `TaxReturnPeriodSummaryDto[]` — see `CG-VAT-08`. | `#76` |
| `P-05` | `GET /accounting/tax/returns/:id` | `accounting.tax_return.read` | `accounting.tax.returns` | `COMPANY` | `none` | `ETag` emitted | `200` `TaxReturnPeriodDetailDto` (`acc_tax_return_periods` projection per `02_DTOs.md` §13.1 + `version` ETag). | `#77` |
| `P-06` | `GET /accounting/tax/returns/:id/lines` | `accounting.tax_return.read` | `accounting.tax.returns` | `COMPANY` | `none` | `none` | `200` `TaxReturnLineDto[]` (`id`, `companyId`, `returnPeriodId`, `generation`, `boxCode`, `baseAmount`, `taxAmount`, `sourceCount`, `computedValue`, `computedAt`, `createdAt`, `createdBy`) — see `CG-VAT-05`. | `#77` |
| `P-07` | `POST /accounting/tax/returns` | `accounting.tax_return.compute` | `accounting.tax.returns` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `none` | Body: `CreateTaxReturnPeriodDto` (`definitionId`, `registrationId`, `periodStart`, `periodEnd`; opens the period and computes nothing). `201` + `Location` (`TaxReturnPeriodDetailDto`, `status = 'OPEN'`, pins latest effective `definitionVersionId` per `VAL-TAX-22`) (`CG-VAT-04`, closed by `D-772`). | `#76` |
| `P-08` | `POST /accounting/tax/returns/:id/compute` | `accounting.tax_return.compute` | `accounting.tax.returns` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` | Body: `ComputeTaxReturnDto` (`recompute?: boolean`; the period is the path `:id`, `D-772`). `200` synchronous `TaxReturnPeriodDetailDto` (`status = 'COMPUTED'`), or `202` async job when computation exceeds synchronous budget (`02_DTOs.md` §6.4). | `#77` |
| `P-09` | `POST /accounting/tax/returns/:id/file` | `accounting.tax_return.file` | `accounting.tax.returns` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` | Body: `FileTaxReturnDto` (`filingReference`, `filedAt`, `payableAmount?`, `snapshotReportRunId?`; the period is the path `:id` and the server pins `export_run_id` to the latest `COMPLETED` export run of the filed generation, `NULL` when none ran, `D-772`). `200` + chain headers (`x-mutakamel-entry-hash`, `x-mutakamel-chain-sequence`, `x-mutakamel-ledger-id`); atomically sets `status = 'FILED'`, `snapshotId`, `declarationEntryId` / `declarationEntryIds`, `filedGeneration`, and advances registration `lockedUntil`. | `#77` |
| `P-10` | `POST /accounting/tax/returns/:id/export` | `accounting.tax_return.export` | `accounting.tax.returns` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `none` | Body: empty (the definition version's official template fixes the format; the run records `{ returnPeriodId, generation }` in `acc_export_runs.parameters`, `D-772`). `202 Accepted` + `Location` returning `ExportRunSummaryDto` (`id`, `exportType`, `format`, `status`, `rowCount`, `fileSizeBytes`, `fileSha256`, `createdAt`, `completedAt`, `expiresAt`). | `#77` |
| `P-11` | `POST /accounting/tax/returns/:id/attach-filed-copy` | `accounting.tax_return.file` | `accounting.tax.returns` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` | Body: `AttachFiledReturnCopyDto` (`amendmentNo`, `attachmentId`, `filingReference`, `totals { boxes, outputTax, inputTax, payableAmount, carriedForwardBalance }`, `carriedForwardAdjustmentSources?[]`, `reason`). `200` `TaxReturnPeriodDetailDto` (`filedCopyStatus = 'PENDING_CONFIRMATION'`). *(In `13_Delivery_Plan.md` §3.6 slice list; second-user confirmation `P-22` lands in `P21`.)* | `#77` |
| `P-35` | `GET /accounting/tax/returns/:id/ledger-comparison` | `accounting.tax_return.read` | `accounting.tax.returns` | `COMPANY` | `none` | `none` | `200` `TaxReturnLedgerComparisonDto` (box by box: `returnAmount`, `ledgerAmount`, `difference`, `reconcilingItems[]`, `unexplainedAmount`; `asOf`, `asOfChainPositions`; computed on read, `D-772`). | `#77` |
| `P-12` | `GET /accounting/tax/transactions` | `accounting.tax_transaction.read` | `accounting.tax.engine` | `COMPANY_OR_BRANCH` | `none` | `none` | Query: `TaxTransactionListQueryDto` (`registrationId?`, `taxTypeCode?`, `direction?`, `taxStatus?`, `fromTaxPointDate?`, `toTaxPointDate?`, `returnPeriodId?`, `partyId?`, `cursor?`, `limit?` `1..500`). `200` keyset page `{ items, meta: { limit, nextCursor, hasMore } }`. | `#84`, `#77` |
| `P-13` | `POST /accounting/tax/transactions/search` | `accounting.tax_transaction.read` | `accounting.tax.engine` | `COMPANY_OR_BRANCH` | `none` (`skipAutoIdempotency`) | `none` | Body: `SearchManyDto`. `200` keyset/filtered `TaxTransactionSummaryDto[]`. | `#84` |
| `P-14` | `POST /accounting/tax/transactions/count` | `accounting.tax_transaction.read` | `accounting.tax.engine` | `COMPANY_OR_BRANCH` | `none` (`skipAutoIdempotency`) | `none` | Body: filter subset matching `TaxTransactionListQueryDto`. `200` `CountResultDto { count: number }`. | `#84` |
| `P-15` | `GET /accounting/tax/transactions/:id` | `accounting.tax_transaction.read` | `accounting.tax.engine` | `COMPANY_OR_BRANCH` | `none` | `none` | `200` `TaxTransactionDetailDto` (`acc_tax_transactions` projection + `baseComposition[]`, `decisionReceiptId`, provenance refs). | `#85` |
| `P-16` | `POST /accounting/tax/transactions/export` | `accounting.tax_transaction.export` | `accounting.tax.engine` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `none` | Body: `TaxTransactionExportQueryDto` (`format: 'CSV' | 'XLSX'` + `TaxTransactionListQueryDto` filters minus pagination). `202 Accepted` + `Location` (`ExportRunSummaryDto`). | `#84` |
| `P-17` | `GET /accounting/reports/tax-report` | `accounting.report.read` | `accounting.tax.returns` | `COMPANY` | `none` | `none` | Query: `TaxReportQueryDto` (`fromDate`, `toDate`, `registrationId?`, `taxTypeCode?[]`, `direction?`, `taxStatus?[]`, `returnPeriodId?`, `groupBy?: 'BOX' | 'TAX_TYPE' | 'PARTY'`). `200` aggregated `TaxReportResultDto` (`CG-VAT-07`). | `#84` |
| `P-18` | `GET /accounting/reports/sales-register` | `accounting.report.read` | `accounting.tax.engine` | `COMPANY_OR_BRANCH` | `none` | `none` | Query: `SalesRegisterQueryDto` (`fromDate`, `toDate`, `documentKind?[]`, `branchId?`, `partyId?`, `authorityStatus?[]`, `includeCancelled?`). `200` `SalesRegisterResultDto` (`CG-VAT-07`). | `#84` |
| `P-19` | `GET /accounting/reports/purchase-register` | `accounting.report.read` | `accounting.tax.engine` | `COMPANY_OR_BRANCH` | `none` | `none` | Query: `PurchaseRegisterQueryDto` (`fromDate`, `toDate`, `documentKind?[]`, `partyId?`, `inputTaxEvidence?[]`, `matchStatus?[]`, `attributionClass?[]`). `200` `PurchaseRegisterResultDto` (`CG-VAT-07`). | `#84` |

---

### 1.2 Primary `[P]` Endpoints — `[Full stage completion — P20.T07 / P21]` (`15` Endpoints)

| # | Method & Catalogue Path *(Browser: `/api/tenant/accounting/v1/...`)* | Permission Key | Feature Key | Scope Target | Idempotency | Concurrency | Request / Query DTO & Response Contract | Stage Task |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `P-20` | `POST /accounting/tax/returns/:id/corrections` | `accounting.tax_return.amend` *(+ `accounting.journal_draft.post` when correcting a POS settlement row, `D-671`)* | `accounting.tax.returns` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` | Body: `RegisterTaxCorrectionDto` (`corrections: Array<{ taxTransactionId, correctedFacts }>`, `reason` `10..1000` chars). `201` created storno `-X` & replacement `+X'` tax transaction pairs (`correctionOfPeriodId = :id`). | `P20.T07` |
| `P-21` | `POST /accounting/tax/returns/:id/amend` | `accounting.tax_return.amend` *(+ `accounting.journal_draft.post` when declaring a POS settlement pair, `D-671`)* | `accounting.tax.returns` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` | Body: `AmendTaxReturnDto` (`correctionTaxTransactionIds`, `reason`, `filingReference`, `filedAt`, `payableAmount?`, `snapshotReportRunId?`). `200` + chain headers; creates delta declaration entry, pins `amendedSnapshotId`, sets `status = 'AMENDED'`, `amendmentCount += 1`. | `P20.T07` |
| `P-22` | `POST /accounting/tax/returns/:id/confirm-filed-copy` | `accounting.tax_return.file` *(second human user `!= filedCopyRecordedBy`)* | `accounting.tax.returns` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` | Body: `ConfirmFiledReturnCopyDto` (`carriedForwardAdjustmentSources?[]`, `comment?`). `200` (`filedCopyStatus = 'CONFIRMED'`, `snapshotMissing = false` when all generations covered). | `P21` |
| `P-23` | `POST /accounting/tax/returns/:id/assign-restored-transactions` | `accounting.tax_return.file` | `accounting.tax.returns` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` | Body: `AssignRestoredTransactionsDto` (`pageNo` `1..100`, `heldSetHash?`, `action: 'ASSIGN' | 'RELEASE'`, `selector { rowIds? | taxPointDateFrom?/To? | fiscalDocumentIds? | beforePeriodStart? | all? }`, `authorityAnswerAttachmentId?`, `authorityAnswerDate?`, `reason`). `200` returns/pins `heldSetHash`. | `P21` |
| `P-24` | `POST /accounting/tax/returns/:id/confirm-restored-transactions` | `accounting.tax_return.file` *(second human user `!= recorder`)* | `accounting.tax.returns` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` | Body: `ConfirmRestoredTransactionsDto` (`comment?`). `200` + chain headers; commits batch assignment/release and posts net tax delta when reconciling. | `P21` |
| `P-25` | `POST /accounting/tax/returns/:id/close-coverage-gap` | `accounting.tax_return.file` *(dual-call: 1st user records -> 2nd user confirms)* | `accounting.tax.returns` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` | Body: `CloseCoverageGapDto` — Call 1: `{ attachmentId, reason }` -> returns `{ gapHash }`; Call 2 (different user): `{ gapHash }` -> `200` + chain headers, closes `SNAPSHOT_MISSING` gap. | `P21` |
| `P-26` | `POST /accounting/tax/returns/:id/declare-copy-unobtainable` | `accounting.tax_return.file` | `accounting.tax.returns` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` | Body: `DeclareCopyUnobtainableDto` (`amendmentNo`, `outcome: 'AUTHORITY_STATEMENT' | 'UNRECOVERABLE'`, `supersedesDeclarationVersion?: 1`, `attachmentId`, `statementTotals?`, `reason`). `200`; opens 2-step approval request. | `P21` |
| `P-27` | `POST /accounting/tax/returns/:id/acknowledge-copy-unobtainable` | `accounting.tax_return.file` *(**tenant owner only**; non-owner -> `403 ACCOUNTING.SCOPE.TARGET_DENIED`)* | `accounting.tax.returns` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` | Body: `AcknowledgeCopyUnobtainableDto` (`declarationVersion: 1 | 2`). `200`; records `copyUnobtainableOwnerAckAt` & `By`, lifts `UNRECOVERABLE` subsequent-filing block. | `P21` |
| `P-28` | `GET /accounting/tax/vat-refund-claims` | `accounting.tax_return.read` | `accounting.tax.returns` | `COMPANY` | `none` | `none` | Query: `FindManyDto` (+ `VatRefundClaimListQueryDto` per `CG-VAT-06`). `200` paginated `VatRefundClaimSummaryDto[]`. | `P20.T07` |
| `P-29` | `POST /accounting/tax/vat-refund-claims` | `accounting.tax_return.file` | `accounting.tax.returns` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `none` | Body: `CreateVatRefundClaimDto` (`returnPeriodId`, `basis: VatRefundBasis`, `amount`). `201` + `Location` (`status = 'DRAFT'`). | `P20.T07` |
| `P-30` | `PATCH /accounting/tax/vat-refund-claims/:id` | `accounting.tax_return.file` | `accounting.tax.returns` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` | Body: `TransitionVatRefundClaimDto` (`status: 'FILED' | 'APPROVED' | 'PAID' | 'REJECTED'`, `filingReference?`, `filedAt?`, `approvedAmount?`, `paidAt?`). `200`. | `P20.T07` |
| `P-31` | `DELETE /accounting/tax/vat-refund-claims/:id` | `accounting.tax_return.file` | `accounting.tax.returns` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` | `204 No Content` (`DRAFT` claims only; `409` otherwise). | `P20.T07` |
| `P-32` | `POST /accounting/tax/vat-refund-claims/:id/withdraw` | `accounting.tax_return.amend` | `accounting.tax.returns` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` | Body: `WithdrawVatRefundClaimDto` (`evidenceRef`, `attachmentId?`). `201` + `Location` creating `acc_vat_refund_claim_withdrawals` (`status = 'PENDING_CONFIRMATION'`). | `P20.T07` |
| `P-33` | `POST /accounting/tax/vat-refund-claims/:id/withdrawals/:attemptId/confirm` | `accounting.tax_return.amend` *(second human user `!= recordedBy`)* | `accounting.tax.returns` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` | Body: `ConfirmVatRefundWithdrawalDto` (`comment?`). `200`; transitions claim `FILED -> WITHDRAWN` and restores refundable credit pool. | `P20.T07` |
| `P-34` | `POST /accounting/tax/vat-refund-claims/:id/withdrawals/:attemptId/reject` | `accounting.tax_return.amend` | `accounting.tax.returns` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` | Body: `RejectVatRefundWithdrawalDto` (`reason` `10..1000` chars; `CLAIM_DECIDED` & `SUPERSEDED_BY_RESTORE` reserved for system). `200`; marks attempt `REJECTED`, claim stays `FILED`. | `P20.T07` |

---

### 1.3 Shared Supporting `[S]` Endpoints Consumed by `SCR-15` (`18` Endpoints)

| # | Method & Catalogue Path *(Browser: `/api/tenant/accounting/v1/...`)* | Permission Key | Feature Key | Scope Target | Idempotency / Concurrency | Purpose in `SCR-15` & Primary Owner Screen |
| --- | --- | --- | --- | --- | --- | --- |
| `S-01` | `GET /accounting/tax/registrations` | `accounting.tax_registration.read` | `accounting.tax.engine` | `COMPANY` | `none` / `none` | Populate registration filter (`#76`, `#84`), Open Return registration selector (`#76`), and `registrationNumber` + `lockedUntil` header badge (`#77`). *(Owner: `SCR-13`)* |
| `S-02` | `GET /accounting/tax/types` | `accounting.tax_rule_set.read` | `accounting.tax.engine` | `TENANT` | `none` / `none` | Populate `taxTypeCode` filter options on `#84` (`VAT`, `TABLE_TAX`, `WHT`, `STAMP`, `PAYROLL_INFO`). *(Owner: `SCR-13`)* |
| `S-03` | `GET /accounting/tax/authority-parameters` | `accounting.tax_rule_set.read` | `accounting.tax.engine` | `COMPANY` | `none` / `none` | Display `CREDIT_EVIDENCE_CUTOFF_DAYS` & `LATE_ADJUSTMENT_WINDOW` context in readiness/amendment hints (`#77`). *(Owner: `SCR-13`)* |
| `S-04` | `GET /accounting/tax/decision-receipts` | `accounting.tax_transaction.read` | `accounting.tax.engine` | `COMPANY` | `none` / `none` | `#84` `?view=decision-receipts` list tab (`[S]`). *(Owner: `SCR-14`)* |
| `S-05` | `POST /accounting/tax/decision-receipts/search` | `accounting.tax_transaction.read` | `accounting.tax.engine` | `COMPANY` | `none` (`skipAutoIdempotency`) | `#84` `?view=decision-receipts` structured search (`[S]`). *(Owner: `SCR-14`)* |
| `S-06` | `GET /accounting/tax/decision-receipts/:id` | `accounting.tax_transaction.read` | `accounting.tax.engine` | `COMPANY` | `none` / `none` | `#85` embedded 6-step Decision Receipt inspector (`contentHash`, `factSchemaHash`, `engineVersion`, `geoHash`, `matchedRows`). *(Owner: `SCR-14`)* |
| `S-07` | `GET /accounting/reports/withholding-register` | `accounting.report.read` | `accounting.tax.withholding` | `COMPANY` | `none` / `none` | `#84` `?view=withholding-register` tab — **rendered iff** `user.featureEntitlements["accounting.tax.withholding"] === true`. *(Owner: `SCR-16`)* |
| `S-08` | `GET /accounting/reconciliations/authority` | `accounting.authority_document.read` | `accounting.documents.einvoice_eg` | `COMPANY` | `none` / `none` | `#77` **Tab 3 Reconciliation 2 (`RET-08`)**: load latest authority reconciliation run covering `periodStart..periodEnd` and check `matchedUntil >= periodEnd`. *(Owner: `SCR-21`)* |
| `S-09` | `GET /accounting/reconciliations/authority/:id` | `accounting.authority_document.read` | `accounting.documents.einvoice_eg` | `COMPANY` | `none` / `none` | `#77` Tab 3 poll/inspect active authority reconciliation run summary (`CG-10`). *(Owner: `SCR-21`)* |
| `S-10` | `GET /accounting/reconciliations/authority/:id/differences` | `accounting.authority_document.read` | `accounting.documents.einvoice_eg` | `COMPANY` | `none` / `none` | `#77` Tab 3 list unresolved authority differences (`MISSING_LOCALLY`, `MISSING_AT_AUTHORITY`, `AMOUNT_MISMATCH`, `STATUS_MISMATCH`). *(Owner: `SCR-21`)* |
| `S-11` | `POST /accounting/reconciliations/authority/run` | `accounting.authority_document.reconcile` | `accounting.documents.einvoice_eg` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `#77` Tab 3 inline "Run authority reconciliation" (`202` async job) for `[periodStart, periodEnd]`. *(Owner: `SCR-21`)* |
| `S-12` | `GET /accounting/periods` | `accounting.period.read` | `accounting.ledger.core` | `COMPANY` | `none` / `none` | `#77` Readiness Strip Gate 1: check covered fiscal period(s) `TAX` domain status (`SOFT_CLOSED` / `CLOSED` vs `OPEN`). *(Owner: `SCR-04`)* |
| `S-13` | `GET /accounting/input-tax/recovery-runs` | `accounting.tax_return.read` | `accounting.tax.partial_recovery` | `COMPANY` | `none` / `none` | `#77` Readiness Strip Gate 3 *(entitled only when `accounting.tax.partial_recovery` is active)*: verify monthly `PROVISIONAL` / annual `TRUE_UP` run status. *(Owner: `SCR-14`)* |
| `S-14` | `GET /accounting/exports/runs/:id` | `accounting.export.read` | `accounting.reporting.snapshots` | `COMPANY` | `none` / `none` | `#77` (`RET-09`) & `#84`: poll `ExportRunDetailDto` (`QUEUED -> RUNNING -> COMPLETED | FAILED`, `fileSha256`, `rowCount`). *(Owner: `SCR-11`)* |
| `S-15` | `GET /accounting/exports/runs/:id/download` | `accounting.export.download` | `accounting.reporting.snapshots` | `COMPANY` | `none` / `none` | `#77` (`RET-09`) & `#84`: obtain short-lived `SignedDownloadDto` (`url`, `expiresAt`, `fileName`, `contentType`, `fileSizeBytes`, `fileSha256`). *(Owner: `SCR-11`)* |
| `S-16` | `GET /accounting/reports/snapshots/:id` | `accounting.report.read` | `accounting.reporting.snapshots` | `COMPANY` | `none` / `none` | `#77` inspect pinned immutable filing `snapshotId` / `amendedSnapshotId`. *(Owner: `SCR-11`)* |
| `S-17` | `GET /accounting/journal-entries/:id` | `accounting.journal_entry.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | `none` / `none` | `#77` link/drawer preview of posted `declarationEntryId` / `declarationEntryIds[]`, and `#85` source journal entry link. *(Owner: `SCR-06`)* |
| `S-18` | `GET /accounting/exception-board` · `POST /accounting/exception-board/:id/dismiss` · `POST /accounting/attachments` · `GET /accounting/attachments/:id/download` · `POST /accounting/party-finance-profiles/lookup` | Respective `.read` / `.dismiss` (+ `accounting.tax_return.amend` for `AUTHORITY_REQUEST`) / `.create` / `.download` / `party_finance_profile.read` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` / `COMPANY` | `x-idempotency-key` on `POST /dismiss` & `POST /attachments`; `none` on `POST /lookup` | `#77` readiness exception badges (`CREDIT_EVIDENCE_PENDING`, `INTERIM_POLICY_PENDING`, `RESTORED_CREDIT_UNKNOWN`, `RECOVERY_DATA_GAP`) + `[Full stage]` `AUTHORITY_REQUEST` dismissal + filed-copy / authority-answer attachment upload + `#84` party picker. |

---

## 2. Route `#76` — `/accounting/file/tax-returns` (`accountingTaxReturns`)

### 2.1 Shell, Scope Bar, URL State & Single Primary CTA Resolution

1. **Shell Placement:** `GlobalNav` (`المحاسبة` / `Accounting` -> `5. الإقرارات والامتثال` / `5. File` -> `الإقرارات الضريبية` / `Tax returns`) + `PageActionBar` + `AccountingScopeBar` (`COMPANY` scope required; branch selector set to read-only informational `كل الفروع (إقرار على مستوى الشركة)` / `All branches (company-level return)` because tax registrations and returns are `COMPANY`-scoped per `02_Endpoint_Catalogue.md` §5.3).
2. **URL State (`useTaxReturnListScreen`):**
   - `?tab=returns` *(default, `[Slice — P19.T09]`)* | `?tab=refund-claims` *(`[Full stage — P20.T07]`; tab hidden in `P19.T09` slice build)*.
   - Filter params synced cleanly to URL search params: `definitionId`, `registrationId`, `status`, `fromDate`, `toDate`, `q` (routes to `POST /accounting/tax/returns/search` when free-text `q` is non-empty, else `GET /accounting/tax/returns`), `page` (`1`), `limit` (`25`), `sort` (`periodEnd:DESC`).
3. **`PageActionBar` Single Primary CTA (`Law 3`):**
   - **On `?tab=returns` (`[Slice — P19.T09]`):**
     - Primary button: **`فتح فترة إقرار` / `Open return period`** (`Plus` icon, opens `OpenTaxReturnModal` -> `POST /accounting/tax/returns`).
     - **Enabled** when `hasFeature("accounting.tax.returns") && hasPermission("accounting.tax_return.compute") && !isRecoveryMode`.
     - **Shown & disabled with one-line reason** (`accounting-ia.md` §3 Rule 5) when `accounting.tax_return.compute` is absent (`يتطلب صلاحية احتساب الإقرار الضريبي (accounting.tax_return.compute)` / `Requires permission accounting.tax_return.compute`) or when `isRecoveryMode` is active (`النظام في وضع الاستعادة` / `Disabled while restore recovery is active`).
   - **On `?tab=refund-claims` (`[Full stage — P20.T07]`):**
     - Primary button switches to **`طلب استرداد ضريبي جديد` / `New VAT refund claim`** (enabled iff `hasPermission("accounting.tax_return.file") && !isRecoveryMode`).
   - Secondary `outline` toolbar actions: `السجلات الضريبية` / `Tax registers` (`Link` to `/accounting/file/tax-registers`) and `تحديث` / `Refresh`.

### 2.2 Filter Bar (`TaxReturnPeriodListQueryDto` & `SearchManyDto`) — `[Slice — P19.T09]`

| Filter Control | Label (`AR` / `EN`) | Query / Body Member (`02_DTOs.md` §6.3) | Options Source & Validation |
| --- | --- | --- | --- |
| Return definition `Select` | `نموذج الإقرار` / `Return definition` | `TaxReturnPeriodListQueryDto.definitionId?: UUID` | `GET /accounting/tax/return-definitions` (`P-01`); displays localized `nameI18n[locale]` + `<IdentifierText>{code}</IdentifierText>` (`EG_VAT_FORM_10`, `BASE_VAT_RETURN`, etc.). |
| Tax registration `Select` | `التسجيل الضريبي` / `Tax registration` | `TaxReturnPeriodListQueryDto.registrationId?: UUID` | `GET /accounting/tax/registrations` (`S-01`) when `hasPermission("accounting.tax_registration.read")`; displays `<IdentifierText>{registrationNumber}</IdentifierText>` + `taxTypeCode`. |
| Return status `Select` | `الحالة` / `Status` | `TaxReturnPeriodListQueryDto.status?: TaxReturnPeriodStatus` | Closed enum `TaxReturnPeriodStatus` (`OPEN`, `COMPUTED`, `FILED`, `AMENDED`, `CANCELLED`) rendered via `t.accounting.taxReturns.status.*`. |
| Period from / to `DateRangePicker` | `نطاق الفترة (من – إلى)` / `Period range (from – to)` | `fromDate?: ISODate`, `toDate?: ISODate` | ISO calendar dates (`YYYY-MM-DD`); client validates `fromDate <= toDate` before firing query. |
| Search `Input` (`300ms` debounce) | `بحث برقم الإيصال أو الفترة...` / `Search filing ref or period...` | `SearchManyDto.search?: string` (`POST /accounting/tax/returns/search`, `P-04`) | Trims whitespace; `<= 200` chars; switches list hook from `GET` (`P-03`) to `POST /search` (`P-04`, `{ skipAutoIdempotency: true }`). *(Field allowlist tracked in `CG-VAT-08`.)* |

### 2.3 Tax Returns `DataTable` Columns (`acc_tax_return_periods` / `TaxReturnPeriodSummaryDto`) — `[Slice — P19.T09]`

All body cells use `font-normal` (`400`); monetary columns right-align in LTR / end-align logically (`text-end`) with `<Money />`; click on row or period link navigates to `/accounting/file/tax-returns/[id]`.

| Col # | Header (`AR` / `EN`) | DTO Member(s) (`03_Tax_Tables.md` §2.6 / `02_DTOs.md` §13.1) | Rendering & Badges |
| --- | --- | --- | --- |
| `1` | `الفترة الضريبية` / `Return period` | `periodStart`, `periodEnd`, `amendsPeriodId`, `amendmentCount` | `<Link href="/accounting/file/tax-returns/{id}">` with `<DateText value={periodStart} /> – <DateText value={periodEnd} />`. Appends subtle neutral pill `تعديل #{amendmentCount}` / `Amended ×{amendmentCount}` when `amendmentCount > 0`. |
| `2` | `النموذج والتسجيل` / `Form & TRN` | `definitionId` (joined `code` / `nameI18n`), `registrationId` (joined `registrationNumber`), `definitionVersionId` | Localized definition name + `<IdentifierText>{registrationNumber}</IdentifierText>` (`CG-VAT-05` summary join). |
| `3` | `الموعد القانوني` / `Filing due date` | `dueDate`, `status` | `<DateText value={dueDate} />`. When `status ∈ {'OPEN','COMPUTED'}` and `dueDate < today`, appends `caution`/`negative` overdue chip (`متأخر` / `Overdue` + `AlertTriangle` icon). |
| `4` | `الحالة` / `Status` | `status`, `snapshotMissing`, `filedCopyStatus`, `restorationHoldCount` | Semantic `<Badge>` (`OPEN` -> neutral `CircleDashed`; `COMPUTED` -> caution `Calculator`; `FILED` -> positive `CheckCircle2`; `AMENDED` -> positive `FileCheck2`; `CANCELLED` -> neutral `Ban`). If `snapshotMissing === true` or `restorationHoldCount > 0` (`CG-VAT-05`), renders secondary `negative` chip `فجوة استعادة` / `Restore gap` (`ShieldAlert`). |
| `5` | `ضريبة المخرجات` / `Output VAT` | `outputTaxTotal`, `currencyCode` *(from company profile)* | `<Money value={outputTaxTotal} currency={currencyCode} />` (`—` when `status === 'OPEN'` and `computedAt === null`). |
| `6` | `ضريبة المدخلات المخصومة` / `Deductible input VAT` | `inputTaxTotal` | `<Money value={inputTaxTotal} currency={currencyCode} />` (`—` before first compute). |
| `7` | `الصافي المستحق / الرصيد الدائن` / `Net payable / credit` | `payableAmount`, `carriedForwardBalance` | Signed `<Money value={payableAmount} currency={currencyCode} />`: positive `> 0` labelled `مستحق السداد` / `Payable`, `< 0` labelled `رصيد دائن مرحّل` / `Net credit`, `0.00` labelled `صفري` / `Nil`. |
| `8` | `رقم إيصال التقديم` / `Filing reference` | `filingReference`, `filedAt` | `<IdentifierText>{filingReference}</IdentifierText>` + sub-caption `<DateText value={filedAt} />` when `FILED` / `AMENDED`; `—` otherwise. |
| `9` | `إجراءات` / `Actions` | `id`, `status` | `Button variant="ghost" size="sm"` -> `فتح مساحة العمل` / `Open workspace` (`ArrowUpRight`, RTL-mirrored). |

### 2.4 Open Return Period Modal (`OpenTaxReturnModal` -> `POST /accounting/tax/returns`, `P-07`) — `[Slice — P19.T09]`

- **Trigger:** `فتح فترة إقرار` / `Open return period` in `#76` `PageActionBar`.
- **Idempotency & Concurrency:** Generates a fresh UUIDv7 `x-idempotency-key` when the modal opens (reset only when inputs change or modal closes after completion; **reused** across timeout retries). No `If-Match` (`201 Created`).
- **Form Fields (verbatim `CreateTaxReturnPeriodDto`, `02_DTOs.md` §6.3; `CG-VAT-04`, closed by `D-772`):**
  1. **`definitionId`** (`UUID`, required): `Select` populated from active `GET /accounting/tax/return-definitions` (`isActive === true`, e.g. `EG_VAT_FORM_10` — `إقرار ضريبة القيمة المضافة المصري — نموذج 10` / `Egypt Monthly VAT Return — Form 10`). Displays read-only cadence (`MONTHLY` / `QUARTERLY` / `ANNUAL`), `filingOffsetDays`, and `currentVersion` (`VAL-TAX-22`: server pins the active `definitionVersionId` at open time).
  2. **`registrationId`** (`UUID`, required): `Select` populated from `GET /accounting/tax/registrations` filtered to matching `taxTypeCode` and active status (`effectiveTo === null || effectiveTo >= periodStart`). Displays `lockedUntil` date so the user immediately sees the last filed boundary (`VAL-TAX-21`).
  3. **`periodStart`** (`ISODate`, required) & **`periodEnd`** (`ISODate`, required): Calendar month/quarter quick-preset selector (e.g. `أكتوبر 2026: 2026-10-01 – 2026-10-31` / `Oct 2026: 2026-10-01 – 2026-10-31`) plus manual ISO date inputs. Client validates `periodStart <= periodEnd` and warns if `periodEnd <= registration.lockedUntil`.
- **Post-Success Transition:** On `201 Created`, invalidates `['accounting', tenantId, companyId, 'tax-returns']` and navigates immediately to `/accounting/file/tax-returns/${created.id}` (`#77`) where the return opens in `OPEN` state ready for readiness verification and `Compute`.

### 2.5 `[Full stage completion — P20.T07]` Top-Level `?tab=refund-claims` (`VatRefundClaimsPanel`, `P-28`)

- Mounted on `#76` when `?tab=refund-claims` is selected in Stage 2 (`P20.T07`).
- Calls `GET /accounting/tax/vat-refund-claims` (`P-28`, `accounting.tax_return.read`, `accounting.tax.returns`, `COMPANY`).
- Columns map verbatim to `acc_vat_refund_claims` (`03_Tax_Tables.md` §2.9):
  - `returnPeriodId` (`Link` to `/accounting/file/tax-returns/[returnPeriodId]?tab=refund-claims`),
  - `basis` (`VatRefundBasis`: `EXPORT_ZERO_RATED` | `SIX_CONSECUTIVE_PERIODS` | `MACHINERY_CAPITAL` | `DEREGISTRATION`),
  - `status` (`VatRefundClaimStatus`: `DRAFT` | `FILED` | `APPROVED` | `PAID` | `REJECTED` | `WITHDRAWN`, plus badge when a child withdrawal attempt is `PENDING_CONFIRMATION`),
  - `amount` (`<Money />`),
  - `approvedAmount` (`<Money />` or `—`),
  - `filingReference` (`<IdentifierText />` or `—`),
  - `filedAt` / `paidAt` (`<DateText />`),
  - Row action: `عرض في مساحة الإقرار` / `Manage in return workspace` -> `/accounting/file/tax-returns/${returnPeriodId}?tab=refund-claims` (§3.9).

---

## 3. Route `#77` — `/accounting/file/tax-returns/[id]` (VAT Return Workspace)

### 3.1 Workspace Header Band, Single Primary CTA Resolution & Precondition Readiness Strip

#### 3.1.1 `DocumentHeaderBand` & Metadata (`GET /accounting/tax/returns/:id`, `P-05`)

`useTaxReturnWorkspace` fetches `GET /accounting/tax/returns/:id` (`P-05`) and captures the HTTP **`ETag`** response header (mapping to `acc_tax_return_periods.version`) in ref state. Every mutating action on `#77` (`compute`, `file`, `attach-filed-copy`, `corrections`, `amend`, `confirm-*`, `close-coverage-gap`, `declare-*`, `acknowledge-*`) sends `If-Match: <ETag>`.

| Header Slot | DTO Member(s) (`TaxReturnPeriodDetailDto` / `acc_tax_return_periods`) | Presentation |
| --- | --- | --- |
| Breadcrumb | — | `الإقرارات الضريبية` / `Tax returns` (`Link` -> `#76`) `/` `<DateText value={periodStart} /> – <DateText value={periodEnd} />` |
| Title & Form Badge | `definitionId` (joined `nameI18n`, `code`), `definitionVersionId` (joined `version`, `authorityCode`) | `إقرار ضريبة القيمة المضافة المصري — نموذج 10` / `Egypt Monthly VAT Return — Form 10` + `<IdentifierText>EG_VAT_FORM_10 · v{version}</IdentifierText>` (`CG-VAT-05`) |
| Status Pill | `status` | Semantic `<Badge>` (`OPEN`, `COMPUTED`, `FILED`, `AMENDED`, `CANCELLED`) with icon + `t.accounting.taxReturns.status.*` |
| Registration & Lock Strip | `registrationId` (joined `registrationNumber`, `lockedUntil`), `dueDate` | `رقم التسجيل الضريبي` / `TRN`: `<IdentifierText>{registrationNumber}</IdentifierText>` · `مقفل حتى` / `Locked until`: `<DateText value={lockedUntil} />` · `آخر موعد للتقديم` / `Filing due`: `<DateText value={dueDate} />` |
| Pinned Filing Artefacts *(visible when `status ∈ {'FILED','AMENDED'}`)* | `filingReference`, `filedAt`, `snapshotId`, `amendedSnapshotId`, `declarationEntryId`, `declarationEntryIds`, `exportRunId` | • `رقم إيصال المصلحة` / `Authority filing ref`: `<IdentifierText>{filingReference}</IdentifierText>` (<DateText value={filedAt} />)<br>• `لقطة الإقرار المجمّدة` / `Pinned snapshot`: `<Link>` drawer via `GET /reports/snapshots/:id` (`S-16`)<br>• `قيد إثبات الإقرار` / `Declaration journal entry`: `<Link href="/accounting/post/journal-entries/{declarationEntryId}">` (plus `declarationEntryIds[]` delta list when `AMENDED`) |

#### 3.1.2 Deterministic Single Primary CTA Resolution in `PageActionBar` (`Law 3`)

Only **one** `Button variant="primary"` renders in `PageActionBar`; all other actions sit as `variant="outline"` buttons in `PageActionBar` (`تصدير بالأعمدة الرسمية` / `Official-column export`, `إعادة الاحتساب` / `Recompute`, `السجلات الضريبية للفترة` / `Period tax registers`, `سجل الحالات` / `History`):

| Current `status` & Workspace Condition | Single `variant="primary"` Button in `PageActionBar` | Enabled Predicate *(else Disabled with One-Line Factual Reason)* | Secondary `variant="outline"` Buttons |
| --- | --- | --- | --- |
| `status === 'OPEN'` | **`احتساب الإقرار` / `Compute return`** (`POST /:id/compute`, `P-08`) | `hasPermission("accounting.tax_return.compute") && !isRecoveryMode` *(Note: per `09_User_Journey_Tax_Return_Filing.md` `RET-06`, computation is permitted before or after `TAX` soft-close for preview; filing requires `TAX` `SOFT_CLOSED` / `CLOSED`.)* | `السجلات الضريبية للفترة` / `Period tax registers` (`#84?returnPeriodId={id}`) |
| `status === 'COMPUTED'` | **`تسجيل تقديم الإقرار` / `Record filing`** (`Opens FileTaxReturnModal` -> `POST /:id/file`, `P-09`) | `hasPermission("accounting.tax_return.file") && !isRecoveryMode && readiness.canFile === true` *(Disabled with explicit gate reason when `TAX` period is `OPEN`, when `RET-07` has `unexplainedDifference !== "0"`, when `RET-08` `matchedUntil < periodEnd` for `EG_VAT_FORM_10` with `einvoice_eg`, when `INTERIM_POLICY_PENDING` exists, or when `snapshotMissing` / held rows exist on prior periods.)* | `إعادة الاحتساب` / `Recompute` (`P-08`, `{ recompute: true }`), `تصدير بالأعمدة الرسمية` / `Official-column export` (`P-10`), `السجلات الضريبية` / `Tax registers` |
| `status ∈ {'FILED', 'AMENDED'}` and `snapshotMissing === true` | **`إرفاق نسخة الإقرار المقدّم` / `Attach filed copy`** (`Opens Tab 5 / Recorder Drawer` -> `P-11`) *(or `تأكيد النسخة المرفقة` / `Confirm filed copy` `P-22` in `P21` when `filedCopyStatus === 'PENDING_CONFIRMATION'` and `currentUser.id !== filedCopyRecordedBy`)* | `hasPermission("accounting.tax_return.file") && !isRecoveryMode` | `تصدير بالأعمدة الرسمية` / `Official-column export` (`P-10`), `عرض قيد الإقرار` / `View declaration entry` |
| `status ∈ {'FILED', 'AMENDED'}` and `snapshotMissing === false` *(Slice `P19.T09`)* | **Zero `primary` buttons** *(return is terminal & immutable in Slice)* | — | `تصدير بالأعمدة الرسمية` / `Official-column export` (`P-10`), `عرض اللقطة المجمّدة` / `View pinned snapshot`, `السجلات الضريبية` / `Tax registers` |
| `status ∈ {'FILED', 'AMENDED'}` and `snapshotMissing === false` *(Full Stage `P20.T07`)* | **`تقديم إقرار معدّل` / `File amended return`** *(when pending `correctionOfPeriodId === id` pairs exist on Tab 4; `P-21`)* | `hasPermission("accounting.tax_return.amend") && !isRecoveryMode` | `تسجيل تصحيح ضريبي` / `Register correction` (`P-20`), `طلب استرداد ضريبي` / `New refund claim` (`P-29`), `تصدير بالأعمدة الرسمية` / `Official-column export` (`P-10`) |
| `status === 'CANCELLED'` | **Zero `primary` buttons** | — | `السجلات الضريبية` / `Tax registers` (`#84`) |

#### 3.1.3 Precondition & Readiness Strip (`TaxReturnReadinessStrip` — `RET-01`..`RET-05`, `VAL-TAX-23`..`VAL-TAX-48`)

Mounted directly beneath `DocumentHeaderBand` across all tabs so the accountant sees every statutory prerequisite before clicking `Record filing`:

| Gate ID | Gate Card (`AR` / `EN`) | Authoritative Source (`[P]` / `[S]`) | Pass State (`positive`) | Blocking / Warning State (`caution` / `negative`) & Action Link |
| --- | --- | --- | --- | --- |
| `G-01` | `إقفال الفترة الضريبية (TAX)` / `Fiscal period TAX domain` | `GET /accounting/periods` (`S-12`) covering `[periodStart, periodEnd]` (`VAL-TAX-23`, `RET-01`) | `مقفلة مبدئياً / مقفلة` / `Soft-closed / Closed` (`CheckCircle2`) | `negative` **Blocks filing** (`ACCOUNTING.TAX.PERIOD_NOT_SOFT_CLOSED` if `OPEN`): `الفترة الضريبية لا تزال مفتوحة — يُسمح بالاحتساب التجريبي فقط` / `TAX domain is still OPEN — preview compute allowed, filing blocked` + `<Link href="/accounting/setup/periods">` (`SCR-04`). |
| `G-02` | `مطابقة الإقرار مع الأستاذ العام` / `1. Return-to-Ledger (RET-07)` | Tab 2 comparison (`CG-VAT-01`, `D-772` / `03_tax_engine_and_returns.md` §8.10) | `متطابق (فرق غير مفسّر = 0.00)` / `Reconciled (unexplained = 0.00)` (`CheckCircle2`) | `negative` readiness finding (resolve before filing) when any box of `TaxReturnLedgerComparisonDto` has `unexplainedAmount !== "0"`. Click focuses **Tab 2**. |
| `G-03` | `مطابقة حزمة مصلحة الضرائب (ETA)` / `2. Authority package (RET-08)` | `GET /accounting/reconciliations/authority` (`S-08`) when `definition.code === 'EG_VAT_FORM_10'` and `hasFeature("accounting.documents.einvoice_eg")` | `متطابق حتى {matchedUntil}` / `Matched through {matchedUntil}` (`matchedUntil >= periodEnd` and `unresolvedCount === 0`) | `negative` **Blocks filing** (`ACCOUNTING.TAX.AUTHORITY_RECON_INCOMPLETE`) when `matchedUntil < periodEnd` or unresolved differences > `0`. Click focuses **Tab 3**. Rendered as neutral `غير منطبق` / `Not applicable` for `BASE_VAT_RETURN` or when `einvoice_eg` is unentitled. |
| `G-04` | `نسبة الخصم الجزئي للمدخلات` / `Partial input-tax recovery` *(hidden unless `hasFeature("accounting.tax.partial_recovery")`)* | `GET /accounting/input-tax/recovery-runs` (`S-13`) (`RET-04`) | `تم تشغيل التسوية الشهرية ({provisionalRatio}%)` / `Provisional run complete ({provisionalRatio}%)` *(+ `annualRecoveryAdjustment` pill on year-end period)* | `caution` / `negative` (`RECOVERY_DATA_GAP` on exception board or missing monthly run for `[periodStart, periodEnd]`) + `<Link href="/accounting/setup/tax-rules">` (`SCR-14`). |
| `G-05` | `بنود معلّقة وسياسات انتقالية` / `Pending tax exceptions` | `GET /accounting/exception-board` (`S-18`) filtered to period | `لا توجد بنود مانعة` / `0 blocking items` | • `negative` **Blocks filing** (`ACCOUNTING.TAX.INTERIM_POLICY_UNRESOLVED`, `L-READY-05`) if any `INTERIM_POLICY_PENDING` item exists.<br>• `negative` **Blocks filing** (`ACCOUNTING.TAX.RESTORATION_HOLD_UNRESOLVED` / `SNAPSHOT_GAP_OPEN`) if `restorationHoldCount > 0` or prior-period `snapshotMissing` is open.<br>• `caution` informational count for `CREDIT_EVIDENCE_PENDING` (`RET-03`: input tax deferred until supplier ETA e-invoice arrives within `CREDIT_EVIDENCE_CUTOFF_DAYS`, never blocking current filing). |

---

### 3.2 Tab 1 (`?tab=boxes`) — Computed Return Boxes, Generation Selector & Server Formula Bar (`[Slice — P19.T09]`)

#### 3.2.1 Workspace Tab Strip (`#77`)

1. **`boxes` (`[Slice — P19.T09]`):** `خانات الإقرار المحتسبة` / `Return boxes` *(badge: box count)*
2. **`ledger-reconciliation` (`[Slice — P19.T09]`):** `1. مطابقة الأستاذ العام` / `1. Return-to-ledger` *(status dot + icon)*
3. **`authority-reconciliation` (`[Slice — P19.T09]`):** `2. مطابقة مصلحة الضرائب` / `2. Authority package` *(status dot + icon; shows `N/A` pill when `BASE_VAT_RETURN`)*
4. **`amendments` (`[Full stage — P20.T07 / P21]`):** `التصحيحات والإقرارات المعدّلة` / `Corrections & amendments` *(hidden in `P19.T09` slice build)*
5. **`restoration` (`[Slice recorder drawer when snapshotMissing + Full stage P21]`):** `فجوات الاستعادة والمعاملات المعلّقة` / `Post-restore recovery` *(mounted only when `snapshotMissing === true` or `restorationHoldCount > 0` or `copyUnobtainableDeclaredAt !== null`)*
6. **`refund-claims` (`[Full stage — P20.T07]`):** `طلبات استرداد الضريبة` / `VAT refund claims` *(hidden in `P19.T09` slice build)*

#### 3.2.2 Server Formula Summary Bar (`acc_tax_return_periods` — Zero Client Math)

Displayed at the top of Tab 1 using **only** server-persisted `DecimalString` columns from `TaxReturnPeriodDetailDto` (`03_Tax_Tables.md` lines 1173–1182 & `03_tax_engine_and_returns.md` §8.6):

```text
outputTaxTotal − inputTaxTotal − carriedForwardBalance + carriedForwardAdjustment + annualRecoveryAdjustment = payableAmount
```

| Formula Term Card | Bilingual Label (`AR` / `EN`) | Verbatim DTO Member (`TaxReturnPeriodDetailDto`) | Conditional Visibility & Provenance Note |
| --- | --- | --- | --- |
| `1` | `إجمالي ضريبة المخرجات` / `Output VAT total` | `outputTaxTotal: DecimalString` | Always shown (`—` when `status === 'OPEN'` before first compute). |
| `2` | `(−) ضريبة المدخلات القابلة للخصم` / `(−) Deductible input VAT` | `inputTaxTotal: DecimalString` | Always shown. Excludes `NON_DEDUCTIBLE` and `DEFERRED` rows lacking valid ETA evidence (`RET-03`). |
| `3` | `(−) الرصيد الدائن المرحّل من الفترة السابقة` / `(−) Opening carried-forward credit` | `carriedForwardBalance: DecimalString` | Always shown (`0.00` when none). Server-derived from prior filed return net of `acc_credit_compensation_entries`. |
| `4` | `(+) تسوية الرصيد المرحّل` / `(+) Carried-forward adjustment` | `carriedForwardAdjustment: DecimalString` | Highlighted when `!== "0"` (non-zero after post-restore filed-copy attachment `P-11` / `P-22` or prior-period amendment). |
| `5` | `(+) تسوية الخصم السنوي (True-up)` / `(+) Annual recovery true-up` | `annualRecoveryAdjustment: DecimalString` | Shown when `!== "0"` or `hasFeature("accounting.tax.partial_recovery")` on the annual adjustment period (`RET-04`). |
| `= 6` | `(=) صافي الضريبة المستحقة / (الرصيد الدائن)` / `(=) Net payable / (credit carried forward)` | `payableAmount: DecimalString` | `font-semibold` KPI emphasis (`positive` credit caption when `< 0`, `caution` payable caption when `> 0`, neutral `Nil` when `"0"`). |

#### 3.2.3 Generation Selector & Return Boxes Table (`GET /accounting/tax/returns/:id/lines`, `P-06`)

- **Generation Selector:** Displays `الجيل الحالي: #{currentGeneration}` / `Generation #{currentGeneration}` (`computedAt` timestamp). When `status === 'AMENDED'` and `amendedGeneration !== filedGeneration`, offers a read-only segmented toggle between `الإقرار الأصلي المقدّم (جيل #{filedGeneration})` / `Original filed (gen #{filedGeneration})` and `الإقرار المعدّل (جيل #{amendedGeneration})` / `Amended (gen #{amendedGeneration})` (`CG-VAT-05`).
- **Boxes `DataTable` Columns (`acc_tax_return_lines` + joined `acc_tax_return_definition_versions.boxes` per `CG-VAT-05`):**

| Col # | Header (`AR` / `EN`) | Verbatim DTO Member(s) | Presentation & Drill-Through |
| --- | --- | --- | --- |
| `1` | `رمز الخانة` / `Box code` | `boxCode: string` | `<IdentifierText>{boxCode}</IdentifierText>` (e.g. `BOX_01_STD_SALES_14`, `BOX_02_TABLE_TAX`, `BOX_03_EXPORTS_0`, `BOX_04_EXEMPT`, `BOX_05_SALES_ADJ`, `BOX_06_LOCAL_INPUTS`, `BOX_07_IMPORTS`, `BOX_08_REVERSE_CHARGE`, `BOX_09_NON_DEDUCTIBLE`, `BOX_10_NET_PAYABLE`). |
| `2` | `بيان الخانة (نموذج 10)` / `Official box description` | `boxLabelI18n` (`ar` / `en`), `boxKind` (`DETAIL` \| `FORMULA` \| `PERIOD_FIELD`) | Localized statutory box title (`CG-VAT-05`); `FORMULA` / `PERIOD_FIELD` subtotal rows styled with `bg-surface-subtle` and top `border-line`. |
| `3` | `الوعاء الضريبي` / `Taxable base` | `baseAmount: DecimalString` | `<Money value={baseAmount} currency={currencyCode} />` (`—` on pure formula/carry-forward summary rows). |
| `4` | `قيمة الضريبة / الخانة` / `Tax / box value` | `taxAmount: DecimalString`, `computedValue: DecimalString` | `<Money value={computedValue} currency={currencyCode} />` (`DETAIL` boxes show `taxAmount`; `FORMULA` / `PERIOD_FIELD` boxes show `computedValue`). |
| `5` | `عدد المعاملات` / `Source rows` | `sourceCount: number` | Western integer `tabular-nums` (`0` on `PERIOD_FIELD` rows). |
| `6` | `التفاصيل` / `Drill-through` | `returnPeriodId`, `boxCode` | When `sourceCount > 0` and `hasPermission("accounting.tax_transaction.read")`: `<Link href="/accounting/file/tax-registers?view=transactions&returnPeriodId={id}&boxCode={boxCode}">` (`عرض السجل` / `Inspect rows` — see `CG-VAT-08` for `boxCode` query filter; falls back to `?view=tax-report&returnPeriodId={id}&groupBy=BOX` until `CG-VAT-08` lands). |

---

### 3.3 Tab 2 (`?tab=ledger-reconciliation`) — Reconciliation 1: Return-to-Ledger Comparison (`RET-07`, `03_tax_engine_and_returns.md` §8.10) (`[Slice — P19.T09]`)

#### 3.3.1 Domain Contract (`03_tax_engine_and_returns.md` §8.10 & `09_User_Journey_Tax_Return_Filing.md` `RET-07`)

Reconciliation 1 proves that the VAT return boxes (`acc_tax_return_periods.output_tax_total` & `input_tax_total`) reconcile to the posted General Ledger VAT control account movements (`acc_journal_lines` on Output VAT Payable and Deductible Input VAT accounts across `[periodStart, periodEnd]`) down to **zero unexplained difference**:

1. **Per-Box Comparison Table (`TaxReturnLedgerComparisonDto`, `GET /accounting/tax/returns/:id/ledger-comparison`, `D-772`):** One row per entry of `boxes[]` (a box the definition version maps to tax control accounts) for the compared `generation` (the latest computed generation while the period is `OPEN`, the filed or latest amended generation once submitted), all amounts in `currencyCode` (the functional currency):
   - `boxCode` (`<IdentifierText>`).
   - `returnAmount` (the box's `tax_amount`, or `computed_value` for a computed box).
   - `ledgerAmount` (the functional movement of the posted lines dated inside the period window on the tax control accounts the box maps to).
   - `difference` (`returnAmount − ledgerAmount`, signed).
   - `reconcilingItems[]` (`kind`: `TaxReturnReconcilingItemKind`, signed `amount`, `count`).
   - **`unexplainedAmount`** (`difference − Σ reconcilingItems.amount`) — `positive` badge (`0.00 — متطابق` / `0.00 — Reconciled`) when `"0"`, `negative` finding (`فرق غير مفسّر — يُعالج قبل التقديم` / `Unexplained variance — resolve before filing`) otherwise.
   - Footer caption: `asOf` and `asOfChainPositions` freshness. There is no separate output-VAT and input-VAT card, because the response is per box.

#### 3.3.2 Closed 7-Kind Reconciling Items Table (`03_tax_engine_and_returns.md` §8.10)

Every reconciling row belongs to the closed server enum `TaxReturnReconcilingItemKind` (never invented client labels, never editable manual plugs):

| # | Reconciling Item Kind (`TaxReturnReconcilingItemKind`) | Bilingual Label (`AR` / `EN`) | Side | Bilingual "Clears When" Guidance (`AR` / `EN` — verbatim from §8.10) | Drill-Through Link |
| --- | --- | --- | --- | --- | --- |
| `1` | `LATE_DOCUMENT_ORIGINAL_PERIOD` | `مستند متأخر مسجّل بتاريخ توريد سابق ومُدرج في الفترة المفتوحة` / `Late document posted in prior GL period, tax-declared in current open return` | Output / Input | `يزول عند مقارنة الإقرار التراكمي للفترات مع الأستاذ التراكمي` / `Clears when cumulative return periods are compared to cumulative GL` | `#84?view=transactions&returnPeriodId={id}` |
| `2` | `UNBILLED_ACCRUAL_NET_OF_TAX` | `استحقاق إيراد/مصروف غير مفوتر (صافي بدون ضريبة — D-234)` / `Unbilled revenue/expense accrual posted net of VAT (D-234)` | Output / Input | `لا يظهر في حسابات الضريبة أصلاً؛ يزول عند صدور الفاتورة وعكس الاستحقاق` / `Accrual carries zero VAT control line; clears when invoice posts and accrual reverses` | `/accounting/close/checklists` (`SCR-33`) |
| `3` | `CARRY_FORWARD_ADJUSTMENT` | `رصيد دائن مرحّل من فترات سابقة / مستهلك بالاسترداد` / `Opening carried-forward VAT credit & refund compensations` | Payable / Balance | `رصيد دفتري مرحّل في حساب تسوية الضريبة يقابل خانة الرصيد المرحّل بالإقرار` / `Opening balance on VAT clearing account matching return carried-forward box` | `#77?tab=boxes` |
| `4` | `PRIOR_PERIOD_CORRECTION` | `تصحيح فترة سابقة (إقرار معدّل أم تسوية بالفترة التالية)` / `Prior-period tax correction (amended return vs next-period adjustment)` | Output / Input | `يزول عند تقديم الإقرار المعدّل أو ترحيل قيد الإقرار للفترة الحالية` / `Clears once amended return or current-period declaration entry is posted` | `#77?tab=amendments` |
| `5` | `ANNUAL_RECOVERY_ADJUSTMENT` | `تسوية النسبة السنوية للخصم الجزئي (True-up)` / `Annual partial input-tax recovery true-up adjustment` | Input | `يزول بترحيل قيد التسوية السنوية في فترة نهاية السنة الضريبية` / `Clears with the year-end annual recovery journal entry and annual adjustment box` | `/accounting/setup/tax-rules` (`SCR-14`) |
| `6` | `RETURN_ROUNDING` | `فروق تقريب خانات الإقرار وفق قواعد المصلحة` / `Statutory authority box-level rounding difference` | Payable | `يُرحّل تلقائياً إلى حساب فروق تقريب الضريبة ضمن قيد إثبات الإقرار عند التقديم` / `Posted automatically to VAT rounding account inside the declaration journal entry at filing` | `#77?tab=boxes` |
| `7` | `POS_BUSINESS_DATE` | `فرق توقيت يوم العمل لنقاط البيع (قبل منتصف الليل / إغلاق الوردية)` / `POS business-date vs shift-close posting boundary` | Output | `يزول بانتهاء ترحيل ملخصات ورديات البيع للفترة` / `Clears once all POS shift summaries for the calendar boundary are posted` | `/accounting/post/treasuries` (`SCR-25`) |

- **Unexplained Difference Row (`UNEXPLAINED_VARIANCE`):** Rendered for every box whose `unexplainedAmount !== "0"` in a `negative` callout banner with `AlertOctagon` icon, instructing the accountant to inspect manual journals posted directly to VAT control accounts (`/accounting/reports/general-ledger` `SCR-09`) or unposted posting exceptions (`/accounting/inbox/posting-exceptions` `SCR-07`).

#### 3.3.3 Contract (`CG-VAT-01`, closed by `D-772`)

`GET /accounting/tax/returns/:id/ledger-comparison` (`accounting.tax_return.read`, `accounting.tax.returns`, `COMPANY`) answers `TaxReturnLedgerComparisonDto`. It is a separate read because it is a read model with `asOf`, computed on read and stored nowhere. The browser never computes the comparison (no summing of `GET /reports/trial-balance` with `Number()`): `useTaxReturnLedgerReconciliation` renders the response as returned, and keeps deep links to `GET /accounting/reports/general-ledger` (`SCR-09`, pre-filtered to `[periodStart, periodEnd]`) and `GET /accounting/reports/tax-report` (`#84?view=tax-report&returnPeriodId={id}`) for inspection.

---

### 3.4 Tab 3 (`?tab=authority-reconciliation`) — Reconciliation 2: Authority Package Reconciliation (`RET-08`) (`[Slice — P19.T09]`)

Consumes the shared `[S]` authority reconciliation endpoints (`S-08`..`S-11`, `02_Endpoint_Catalogue.md` §6.4):

1. **Applicability & Entitlement Gate:**
   - When `definition.code !== 'EG_VAT_FORM_10'` (e.g. `BASE_VAT_RETURN`) **or** `user.featureEntitlements["accounting.documents.einvoice_eg"] !== true`: Tab 3 renders a clean neutral informational state (`مطابقة البوابة الإلكترونية غير مطلوبة لهذا النموذج` / `Authority portal package reconciliation is not required for this return definition`) and `G-03` does not block filing.
   - When `einvoice_eg` is entitled, user holds `accounting.tax_return.read`, **lacks** `accounting.authority_document.read`: Tab 3 renders a scoped `PermissionGate` naming `accounting.authority_document.read` (`states.md` — never a fake empty state).
2. **Coverage Summary Banner (`GET /accounting/reconciliations/authority`, `S-08`):**
   - Displays latest reconciliation run `id` (`<IdentifierText />`), `completedAt` (`<DateText />`), **`matchedUntil`** (`<DateText />`), vs return `periodEnd` (`<DateText />`).
   - **Rule (`RET-08`):** Filing requires `matchedUntil >= periodEnd` **and** `0` unresolved differences across `[periodStart, periodEnd]`.
3. **Four Difference Category KPI Cards (`GET /accounting/reconciliations/authority/:id/differences`, `S-10`):**
   - `مفقود محلياً (موجود لدى المصلحة فقط)` / `Missing locally (at ETA only)` (`MISSING_LOCALLY`)
   - `مفقود لدى المصلحة (مرحّل محلياً غير مقبول)` / `Missing at authority (local only)` (`MISSING_AT_AUTHORITY`)
   - `اختلاف في القيمة أو الضريبة` / `Amount / VAT mismatch` (`AMOUNT_MISMATCH`)
   - `اختلاف في حالة المستند (ملغى / مرفوض)` / `Document status mismatch` (`STATUS_MISMATCH`)
4. **Inline Actions & Deep-Link:**
   - **`تشغيل مطابقة المصلحة للفترة` / `Run authority reconciliation`** (`Button variant="outline"`, calls `POST /accounting/reconciliations/authority/run` `S-11` with UUIDv7 `x-idempotency-key` for `[periodStart, periodEnd]`): enabled iff `hasPermission("accounting.authority_document.reconcile") && !isRecoveryMode`; transitions into `AsyncProgressCard` (`WS-RET-03`) polling `GET /accounting/reconciliations/authority/:id` (`S-09`).
   - **`فتح شاشة مطابقة مصلحة الضرائب` / `Open authority reconciliation workspace`**: `<Link href="/accounting/reconcile/authority?fromDate={periodStart}&toDate={periodEnd}">` (`SCR-21`) to resolve individual document discrepancies, or `<Link href="/accounting/file/authority-documents">` (`SCR-19`).

---

### 3.5 Official-Column Export Drawer (`TaxReturnOfficialExportDrawer` — `RET-09`, `POST /accounting/tax/returns/:id/export`, `P-10`) (`[Slice — P19.T09]`)

Opened from `تصدير بالأعمدة الرسمية` / `Official-column export` (`Button variant="outline"` in `#77` `PageActionBar`, available in `COMPUTED`, `FILED`, and `AMENDED` states):

1. **Statutory Purpose (`RET-09`, `03_tax_engine_and_returns.md` §8.7):** Produces the official Egypt ETA Form 10 upload/working workbook (`CSV` / `XLSX`) whose columns follow `acc_tax_return_definition_versions.template_columns` verbatim so the accountant can upload directly to the ETA portal before recording the ETA acknowledgement receipt in `RET-10`.
2. **Official Column Schema Preview (`templateColumns` from `GET /accounting/tax/return-definitions/:id`, `P-02`):**
   - Displays a compact read-only preview table of the pinned definition version's official columns, keeping every statutory column code in `<IdentifierText>` (`dir="ltr"` even in Arabic UI) paired with its localized meaning:
     - `DOC_TYP` — `نوع المستند` / `Document type`
     - `TAX_TYP` — `نوع الضريبة` / `Tax type`
     - `TYP_SCH` — `جدول / فئة السلع` / `Schedule / table category`
     - `INV_NO` / `UUID` — `رقم الفاتورة / الرقم الفريد بالبوابة` / `Invoice number / ETA UUID`
     - `TAX_REG_NO` — `رقم التسجيل الضريبي للطرف` / `Counterparty TRN`
     - `INV_DT` — `تاريخ الفاتورة` / `Invoice tax-point date`
     - `COMM_TYPE` — `طبيعة السلعة أو الخدمة` / `Commodity / service type`
     - `TAX_CAT` — `فئة المعاملة الضريبية` / `Tax treatment category`
     - `NET_AMT` / `TAX_AMT` / `TOT_AMT` — `الصافي / الضريبة / الإجمالي` / `Net / Tax / Total`
3. **Async Execution & Signed Download Flow:**
   - **Step 1 — Trigger:** Clicking `توليد ملف التصدير الرسمي` / `Generate official export` calls `POST /accounting/tax/returns/:id/export` (`P-10`, `accounting.tax_return.export`, UUIDv7 `x-idempotency-key`, empty body: the official template fixes the format, `CG-VAT-02`, closed by `D-772`).
   - **Step 2 — `AsyncProgressCard` (`WS-RET-02`):** On `202 Accepted`, renders `ExportRunSummaryDto` (`QUEUED` -> `RUNNING`) and polls `GET /accounting/exports/runs/:id` (`S-14`) every `3s` (backoff to `8s` after `30s`) without showing any "Resend" button.
   - **Step 3 — Verified Download & SHA-256 Evidence:** When `status === 'COMPLETED'`, displays `rowCount`, formatted `fileSizeBytes`, `expiresAt`, and copyable `<IdentifierText>{fileSha256}</IdentifierText>`, plus **`تنزيل الملف الرسمي` / `Download official file`** (`GET /accounting/exports/runs/:id/download` `S-15` -> opens `SignedDownloadDto.url`, gated by `accounting.export.download`). The filing command itself pins the latest `COMPLETED` export run of the filed generation (`CG-VAT-03`, `D-772`), so the workspace only displays that run as read-only evidence in `FileTaxReturnModal` and sends no export run id.

---

### 3.6 File Return Modal, Acknowledgement Reference & Atomic Snapshot Pin (`FileTaxReturnModal` — `RET-10`–`RET-12`, `POST /:id/file`, `P-09`) (`[Slice — P19.T09]`)

#### 3.6.1 Pre-Filing Summary & Irreversibility Callout

`FileTaxReturnModal` opens only when `status === 'COMPUTED'` and `readiness.canFile === true`:
1. **Irreversible Lock Warning (`caution` alert, `Lock` icon):** Explains clearly in Arabic/English that recording filing:
   - Pins an immutable filing snapshot (`snapshotId`) and computes generation `#${currentGeneration}`;
   - Atomically posts the VAT declaration journal entry (`declarationEntryId`), transferring Output VAT, Deductible Input VAT, and carried-forward credits into VAT Payable / VAT Refundable (`RET-11`); and
   - Advances the tax registration's `lockedUntil` to `<DateText value={periodEnd} />` (`VAL-TAX-21`), preventing backdated tax-point postings into `[periodStart, periodEnd]`.
2. **Read-Only Totals Summary:** Displays `periodStart – periodEnd`, `<IdentifierText>{registrationNumber}</IdentifierText>`, `outputTaxTotal`, `inputTaxTotal`, `carriedForwardBalance`, and **`payableAmount`** (`<Money />`), plus latest `exportRunId` & `fileSha256` if exported in `RET-09`.

#### 3.6.2 Verbatim `FileTaxReturnDto` Fields (`02_DTOs.md` §6.3; `CG-VAT-03`, closed by `D-772`)

| Field Control | Label (`AR` / `EN`) | Verbatim DTO Member (`FileTaxReturnDto`) | Validation & Wire Rules |
| --- | --- | --- | --- |
| Bound period | — | route `:id` (no `returnPeriodId` body field) | The period is the path value; a body copy is refused with `400 ACCOUNTING.VALIDATION.FAILED` (DTOs §2, `D-772`). |
| Authority filing reference `Input` | `رقم إيصال / مرجع التقديم بمصلحة الضرائب` / `Authority filing acknowledgement reference` | `filingReference: string` | **Required**, trimmed non-empty string (`1..120` chars), rendered inside `<IdentifierText>` input (`dir="ltr"`), e.g. ETA Form 10 submission receipt number (`RET-10`). |
| Filed timestamp `DateTimePicker` | `تاريخ ووقت التقديم الفعلي` / `Actual filed date & time` | `filedAt: ISODateTime` | **Required** ISO-8601 UTC timestamp (`<= now`; defaults to current timestamp truncated to minute, editable to match the exact ETA portal receipt timestamp). |
| Payable confirmation `DecimalInput` *(optional cross-check)* | `تأكيد صافي المبلغ بالبوابة (اختياري للمطابقة)` / `Portal payable amount cross-check (optional)` | `payableAmount?: DecimalString` | Defaults to server `returnPeriod.payableAmount` (exact `DecimalString`, never `Number()`). Server rejects with `422` / `409` if portal figure diverges from computed `payableAmount`. |
| Pinned report snapshot run *(optional)* | `مرجع لقطة التقرير` / `Snapshot report run (optional)` | `snapshotReportRunId?: UUID` | Auto-populated only when an existing report snapshot run ID is present; omitted otherwise (`forbidNonWhitelisted` safe). The body has no `exportRunId`: the server chooses the export run (`D-772`). |

- **Headers Sent:** `If-Match: <ETag>` + `x-idempotency-key: <UUIDv7>`.
- **Response Handling (`200 OK`):** Refreshes `#77` workspace (`status = 'FILED'`), displays toast with `filingReference` and link to `declarationEntryId`.

#### 3.6.3 Post-Filing Authority Remittance Guidance (`RET-12` — Bank-Statement `DIRECT_POSTING` Settlement)

When `status ∈ {'FILED', 'AMENDED'}` and `payableAmount > 0`, `#77` displays an informational `PostFilingSettlementBanner` (`bg-surface-subtle border-line`, `Landmark` icon):
- **Never renders a fake "Mark paid" button on `#77`** (`acc_tax_return_periods` has no `PAID` status; tax liability lives on the VAT Payable GL account created by `declarationEntryId`).
- **Exact Workflow Links (`09_User_Journey_Tax_Return_Filing.md` `RET-12`):**
  1. Remit via treasury outgoing payment (`/accounting/post/payments`, `SCR-26`) **or** match the ETA bank debit directly during Bank Reconciliation (`/accounting/reconcile/bank`, `SCR-29`) using `DIRECT_POSTING` against the VAT Payable account; and
  2. Inspect the live VAT Payable account ledger balance in General Ledger (`/accounting/reports/general-ledger`, `SCR-09`).

---

### 3.7 `[Full stage completion — P20.T07 / P21]` Tab 4 (`?tab=amendments`) — Corrections, Amended Returns & `AUTHORITY_REQUEST`

Hidden in `P19.T09`; activated in `P20.T07` / `P21` when `status ∈ {'FILED', 'AMENDED'}` (`03_tax_engine_and_returns.md` §8.8):

1. **Statutory Two-Cause Decision Guide (`03_tax_engine_and_returns.md` §8.8):**
   - **Cause 1 — Subsequent Supply Event (`حدث لاحق للتوريد` / `Subsequent supply event`):** Credit/debit notes, sales returns, volume discounts, or post-supply bad-debt adjustments. **No amended return is filed** (`NEXT_PERIOD_ADJUSTMENT`): the user posts a credit/debit note in `SCR-17` (`/accounting/post/fiscal-documents`), and the tax engine automatically includes it in the current open return period (`BOX_05` / adjustments).
   - **Cause 2 — Original Return Error (`خطأ في بيانات الإقرار الأصلي` / `Error in original filed return`):** Wrong tax rate, wrong exemption/zero-rating classification, omitted tax invoice within the closed period, or POS settlement tax-code correction. Handled through the 2-step **Register Correction -> File Amended Return** flow below:
2. **Step 1 — Register Tax Correction Drawer (`POST /accounting/tax/returns/:id/corrections`, `P-20`):**
   - **Admission:** `accounting.tax_return.amend` + `accounting.tax.returns` (`COMPANY`), **plus `accounting.journal_draft.post`** whenever a selected `taxTransactionId` originates from a POS settlement row (`D-671` — button disabled with explicit permission notice if `accounting.journal_draft.post` is missing).
   - **Payload (`RegisterTaxCorrectionDto`):**
     - `corrections`: array of `{ taxTransactionId: UUID, correctedFacts: Record<string, unknown> }` selected via searchable picker from the period's `FILED` tax transactions (`#84` data);
     - `reason`: `string` (`10..1000` chars, mandatory audit explanation).
   - **Outcome (`201 Created`):** Server writes immutable storno `-X` and corrected `+X'` rows in `acc_tax_transactions` with `correctionOfPeriodId = :id` without mutating historical `FILED` lines.
3. **Step 2 — File Amended Return Modal (`POST /accounting/tax/returns/:id/amend`, `P-21`):**
   - **Payload (`AmendTaxReturnDto`):**
     - `correctionTaxTransactionIds: UUID[]` (checked pending correction pairs for `:id`; if a POS settlement pair is included, server enforces **pair completeness** so both storno and replacement are selected together);
     - `reason: string` (`10..1000` chars);
     - `filingReference: string` (`1..120` chars — ETA amended Form 10 receipt number);
     - `filedAt: ISODateTime`;
     - `payableAmount?: DecimalString`;
     - `snapshotReportRunId?: UUID`.
   - **Outcome (`200 OK`):** Increments `amendmentCount`, pins `amendedSnapshotId` & `amendedGeneration`, appends delta declaration entry to `declarationEntryIds[]`, and sets `status = 'AMENDED'`.
4. **Outside-Window `AUTHORITY_REQUEST` Exception Resolution (`POST /accounting/exception-board/:id/dismiss`, `S-18`):**
   - When a correction falls outside `LATE_ADJUSTMENT_WINDOW` (`03_tax_engine_and_returns.md` §8.8 case 5), the backend places an `AUTHORITY_REQUEST` item on the Exception Board. Tab 4 lists period-linked `AUTHORITY_REQUEST` items and provides the resolution modal (`DismissExceptionBoardItemDto`: `reason`, `authorityReference`, `authorityDecision: 'ALLOWED' | 'REFUSED'`, requiring both `accounting.exception_board.dismiss` and `accounting.tax_return.amend`).

---

### 3.8 `[Slice Recorder + Full stage P21]` Tab 5 (`?tab=restoration`) — Post-Restore Filing Gap & Held-Transactions Recovery

Mounted whenever `snapshotMissing === true`, `filedCopyStatus !== null`, `copyUnobtainableDeclaredAt !== null`, or `restorationHoldCount > 0` (`03_tax_engine_and_returns.md` §8.8 cases 9–13 & `12_Platform_Changes.md` §4.10):

1. **Track A — Missing Filed Snapshot (`snapshotMissing === true`):**
   - **Path A1 — Attach Authority-Stamped Filed Copy (`POST /:id/attach-filed-copy` `P-11` `[Slice — P19.T09]` -> `POST /:id/confirm-filed-copy` `P-22` `[Full stage — P21]`):**
     1. Recorder uploads the PDF/XML ETA return copy via `POST /accounting/attachments` (`S-18`) -> obtains `attachmentId`.
     2. Submits `AttachFiledReturnCopyDto`: `amendmentNo` (`0` for original, `1..N` for amendments), `attachmentId`, `filingReference`, `totals: { boxes: Record<string, DecimalString>, outputTax, inputTax, payableAmount, carriedForwardBalance }`, optional `carriedForwardAdjustmentSources[]` (`{ kind: 'AMENDED_RETURN' | 'REFUND_CLAIM' | 'MANUAL_RECONCILIATION' | 'UNEXPLAINED_VARIANCE', amount, reference?, note? }` — required whenever reconstructed `carriedForwardBalance` differs from ledger carry-forward), and `reason` (`10..1000` chars).
     3. Status becomes `filedCopyStatus = 'PENDING_CONFIRMATION'`. `MakerCheckerBanner` enforces Segregation of Duties: **a second human user (`currentUser.id !== filedCopyRecordedBy`)** reviews the side-by-side totals & PDF and submits `ConfirmFiledReturnCopyDto` (`P-22`, `P21`).
   - **Path A2 — Copy Unobtainable Escalation (`P-26` & `P-27`, `[Full stage — P21]`):**
     1. Accountant submits `DeclareCopyUnobtainableDto` (`P-26`): `amendmentNo`, `outcome: 'AUTHORITY_STATEMENT' | 'UNRECOVERABLE'`, `attachmentId` (official ETA account statement or loss memo), optional `statementTotals` (when `AUTHORITY_STATEMENT`), `reason`.
     2. Backend opens a 2-step approval request (`WS-RET-08` -> `/accounting/inbox/approvals` `SCR-07`).
     3. Once approved, if `outcome === 'UNRECOVERABLE'`, subsequent period filing stays blocked until the **Tenant Owner** (`user.isTenantOwner === true` + `accounting.tax_return.file`) clicks **`إقرار المالك بعدم إمكانية استخراج النسخة` / `Tenant owner acknowledgement`** (`POST /:id/acknowledge-copy-unobtainable` `P-27`, `AcknowledgeCopyUnobtainableDto { declarationVersion: 1 | 2 }`). Non-owners see the button disabled with reason `يتطلب مالك الحساب (Tenant Owner)` / `Requires Tenant Owner`.
   - **Path A3 — Close Coverage Gap (`POST /:id/close-coverage-gap`, `P-25`, `[Full stage — P21]`):**
     - First user submits `{ attachmentId, reason }` -> server returns `gapHash`; second distinct user reviews evidence and submits `{ gapHash }` to close the gap (`WS-RET-07`).
2. **Track B — Restored Held Transactions Dual-Control (`P-23` & `P-24`, `[Full stage — P21]`):**
   - Lists tax transactions held in `restorationHoldPeriodId = :id` (`IN_FILED_PERIOD` / `SNAPSHOT_MISSING` / `AUTHORITY_ANSWER_REQUIRED`) in deterministic pages of `1..100` rows (`pageNo`).
   - First user selects rows and submits `AssignRestoredTransactionsDto` (`P-23`: `pageNo`, `heldSetHash`, `action: 'ASSIGN' | 'RELEASE'`, `selector`, optional `authorityAnswerAttachmentId` + `authorityAnswerDate`, `reason`).
   - Second distinct human user verifies `heldSetHash` and clicks **`تأكيد معالجة المعاملات المستعادة` / `Confirm restored transactions`** (`POST /:id/confirm-restored-transactions` `P-24`, `ConfirmRestoredTransactionsDto { comment? }`).

---

### 3.9 `[Full stage completion — P20.T07]` Tab 6 (`?tab=refund-claims`) — Period VAT Refund Claims & Dual-Control Withdrawals

Mounted in `P20.T07` for `FILED` / `AMENDED` returns with net credit (`payableAmount < 0` or `carriedForwardBalance > 0`):

1. **Credit Pool Header (`CG-VAT-06`):** Displays period net credit, `acc_credit_compensation_entries` consumed by refund claims vs carried forward to later periods, and remaining refundable credit (read from server DTO per `CG-VAT-06` — never subtracted in JS).
2. **Create Refund Claim Modal (`POST /accounting/tax/vat-refund-claims`, `P-29`):**
   - `returnPeriodId`: bound to `:id` (`UUID`);
   - `basis`: `Select` over closed `VatRefundBasis` (`EXPORT_ZERO_RATED`, `SIX_CONSECUTIVE_PERIODS`, `MACHINERY_CAPITAL`, `DEREGISTRATION`);
   - `amount`: `DecimalInput` (`> 0`, `<= availableRefundCredit`). Creates `DRAFT` claim (`201`).
3. **Lifecycle Transitions (`PATCH /accounting/tax/vat-refund-claims/:id` `P-30`, `DELETE /:id` `P-31`):**
   - `DRAFT` -> **File claim** (`status: 'FILED'`, requires `filingReference` & `filedAt`; server locks credit via `acc_credit_compensation_entries`) **or** **Delete draft** (`DELETE /:id` `P-31`, `204`).
   - `FILED` -> **Record approval** (`status: 'APPROVED'`, requires `approvedAmount: DecimalString` `<= amount`). **Partial-approval rule (`03_tax_engine_and_returns.md` §8.9):** when `approvedAmount < amount`, UI displays an explicit confirmation note that the unapproved remainder (`amount − approvedAmount`, server-computed) automatically returns to the carried-forward credit pool.
   - `FILED` -> **Record rejection** (`status: 'REJECTED'`; full claimed credit returns to carried-forward pool).
   - `APPROVED` -> **Record payout** (`status: 'PAID'`, requires `paidAt: ISODateTime`).
4. **Dual-Control Claim Withdrawal (`P-32` -> `P-33` / `P-34`):**
   - Only when `claim.status === 'FILED'` and no `PENDING_CONFIRMATION` withdrawal exists: User A (`accounting.tax_return.amend`) submits `WithdrawVatRefundClaimDto` (`P-32`: `evidenceRef`, optional `attachmentId`) -> creates attempt in `PENDING_CONFIRMATION` (`WS-RET-09`).
   - `MakerCheckerBanner` shows pending `:attemptId`: User B (`currentUser.id !== recordedBy`, holding `accounting.tax_return.amend`) clicks **`تأكيد سحب طلب الاسترداد` / `Confirm withdrawal`** (`POST .../withdrawals/:attemptId/confirm` `P-33`, `ConfirmVatRefundWithdrawalDto { comment? }`) -> claim transitions to `WITHDRAWN`, **or** any authorized user clicks **`رفض محاولة السحب` / `Reject withdrawal attempt`** (`POST .../withdrawals/:attemptId/reject` `P-34`, `RejectVatRefundWithdrawalDto { reason }` `10..1000` chars; client validation blocks reserved tokens `CLAIM_DECIDED` and `SUPERSEDED_BY_RESTORE`).

---

## 4. Routes `#84` (`/accounting/file/tax-registers`) & `#85` (`/accounting/file/tax-registers/[id]`) — `[Slice subset — P19.T09]`

### 4.1 Route `#84` Shell, Scope Target, URL `?view=` Tabs & Single Primary CTA

1. **Shell Placement:** `GlobalNav` -> `5. الإقرارات والامتثال` / `5. File` -> `السجلات الضريبية` / `Tax registers`.
2. **Scope Target Adaptation (`AccountingScopeBar`):**
   - `transactions` (`P-12`..`P-15`), `sales-register` (`P-18`), and `purchase-register` (`P-19`) accept `COMPANY_OR_BRANCH` (honoring branch filter when selected in `AccountingScopeBar`).
   - `POST /tax/transactions/export` (`P-16`), `tax-report` (`P-17`), `decision-receipts` (`S-04`..`S-05`), and `withholding-register` (`S-07`) require `COMPANY` scope (`AccountingScopeBar` displays an inline badge `تقرير على مستوى الشركة` / `Company-wide view` when switched to those views).
3. **URL-Persisted `?view=` Sub-Views (`useTaxRegistersScreen`):**

| `?view=` Param | Bilingual Tab Label (`AR` / `EN`) | Endpoint(s) | Required Feature + Permission | Delivery Tag |
| --- | --- | --- | --- | --- |
| `transactions` *(default)* | `دفتر المعاملات الضريبية` / `Tax transactions` | `P-12`, `P-13`, `P-14`, `P-16` | `accounting.tax.engine` + `accounting.tax_transaction.read` | `[Slice — P19.T09]` |
| `tax-report` | `التقرير الضريبي المجمّع` / `Aggregated tax report` | `P-17` (`GET /reports/tax-report`) | `accounting.tax.returns` + `accounting.report.read` | `[Slice — P19.T09]` |
| `sales-register` | `سجل المبيعات الضريبي` / `Sales VAT register` | `P-18` (`GET /reports/sales-register`) | `accounting.tax.engine` + `accounting.report.read` | `[Slice — P19.T09]` |
| `purchase-register` | `سجل المشتريات الضريبي` / `Purchase VAT register` | `P-19` (`GET /reports/purchase-register`) | `accounting.tax.engine` + `accounting.report.read` | `[Slice — P19.T09]` |
| `decision-receipts` | `إيصالات القرار الضريبي` / `Tax decision receipts` | `S-04`, `S-05` (`[S]`) | `accounting.tax.engine` + `accounting.tax_transaction.read` | `[Slice — P19.T09]` (`[S]`) |
| `withholding-register` | `سجل ضريبة الخصم والتحصيل` / `Withholding register` | `S-07` (`[S]`) | **Rendered iff** `hasFeature("accounting.tax.withholding")` && `hasPermission("accounting.report.read")` | `[Slice — P19.T09]` (`[S]`) |

4. **Single Primary CTA in `#84` `PageActionBar` (`Law 3`):**
   - On `?view=transactions`: **`تصدير المعاملات (CSV / XLSX)` / `Export transactions`** (`Button variant="primary"`, opens `TaxTransactionsExportPopover` -> `POST /accounting/tax/transactions/export` `P-16`, enabled iff `hasPermission("accounting.tax_transaction.export") && !isRecoveryMode`, else disabled with one-line reason).
   - On `?view=tax-report`, `sales-register`, `purchase-register`, `withholding-register`: **`تشغيل التقرير` / `Run report`** (`Button variant="primary"`, submits validated `fromDate`..`toDate` query).
   - Secondary `outline` button across all `#84` views: `الإقرارات الضريبية` / `Tax returns` (`<Link href="/accounting/file/tax-returns">`).

---

### 4.2 `#84` `?view=transactions` — Filter Bar, Keyset Pagination, Count & Columns

#### 4.2.1 Filter Bar (Verbatim `TaxTransactionListQueryDto`, `02_DTOs.md` line 901 + `SearchManyDto`)

| Filter Control | Label (`AR` / `EN`) | Verbatim DTO Member | Source / Wire Contract |
| --- | --- | --- | --- |
| Registration `Select` | `التسجيل الضريبي` / `Tax registration` | `registrationId?: UUID` | `GET /accounting/tax/registrations` (`S-01`). |
| Tax type `Select` | `نوع الضريبة` / `Tax type` | `taxTypeCode?: string` | `GET /accounting/tax/types` (`S-02`: `VAT`, `TABLE_TAX`, `WHT`, `STAMP`, `PAYROLL_INFO`). |
| Direction `Select` | `الاتجاه` / `Direction` | `direction?: TaxDirection` | `OUTPUT` \| `INPUT` \| `WITHHOLDING` \| `REVERSE_CHARGE` (`01_Enums.md` §6). |
| Tax status `Select` | `حالة المعاملة الضريبية` / `Tax status` | `taxStatus?: TaxTransactionStatus` | `POSTED` \| `DEFERRED` \| `FILED` \| `VOIDED` (`01_Enums.md` §6). |
| Tax-point date range | `تاريخ الواقعة الضريبية (من – إلى)` / `Tax-point date (from – to)` | `fromTaxPointDate?: ISODate`, `toTaxPointDate?: ISODate` | ISO calendar dates (`YYYY-MM-DD`). |
| Return period `Select` | `فترة الإقرار` / `Return period` | `returnPeriodId?: UUID` | `GET /accounting/tax/returns` (`P-03`); pre-populated when drilling in from `#77`. |
| Party async `Combobox` | `العميل / المورد` / `Counterparty` | `partyId?: UUID` | **`POST /accounting/party-finance-profiles/lookup`** (`S-18`, `{ skipAutoIdempotency: true }`) — never Core `/parties` directly. |
| Free-text search | `بحث في السجل...` / `Search register...` | `SearchManyDto.search` (`POST /tax/transactions/search`, `P-13`) | Switches query to `P-13`. *(Additional drill-through filters `boxCode?`, `restorationHoldPeriodId?`, `correctionOfPeriodId?` tracked in `CG-VAT-08`.)* |

- **Total Count Pill (`POST /accounting/tax/transactions/count`, `P-14`):** Fires in parallel with `P-12` using the active filter object (`{ skipAutoIdempotency: true }`) and displays `إجمالي السجلات المطابقة: {count}` / `Matching rows: {count}` (`tabular-nums`), while the table itself pages strictly via keyset cursor (`cursor`, `limit: 50`, `Next` / `Reset to start` — never offset page numbers).

#### 4.2.2 Tax Transactions `DataTable` Columns (`acc_tax_transactions` / `TaxTransactionSummaryDto`)

| Col # | Header (`AR` / `EN`) | Verbatim DTO Member(s) (`03_Tax_Tables.md` §2.1) | Presentation |
| --- | --- | --- | --- |
| `1` | `تاريخ الواقعة` / `Tax-point date` | `taxPointDate`, `taxPointBasis` | `<DateText value={taxPointDate} />` + subtle caption (`t.accounting.taxRegisters.basis[taxPointBasis]`). |
| `2` | `المستند / القيد` / `Source document` | `documentKind`, `fiscalDocumentId`, `journalLineId` | Localized `FiscalDocumentKind` label + `<Link href="/accounting/post/fiscal-documents/{fiscalDocumentId}">` when non-null (`CG-VAT-08` summary number). |
| `3` | `الطرف والتسجيل` / `Counterparty & TRN` | `partyId`, `partyTaxId`, `partyClassification` | Party display name (`CG-05` / `CG-VAT-08`) + `<IdentifierText>{partyTaxId}</IdentifierText>`. |
| `4` | `الضريبة والاتجاه` / `Tax & direction` | `taxTypeCode`, `direction`, `authorityTaxCode`, `authoritySubtype` | Localized direction pill + `<IdentifierText>{authorityTaxCode}/{authoritySubtype}</IdentifierText>` (`T1/V009`, `T2/Tbl01`, `T4/W001`). |
| `5` | `الوعاء الضريبي` / `Taxable base` | `taxableBase`, `currencyCode` | `<Money value={taxableBase} currency={currencyCode} />` (`text-end font-normal`). |
| `6` | `النسبة` / `Rate` | `rateApplied`, `rateKind` | Formatted `DecimalString` percentage (`14%`) or fixed amount (`FIXED_PER_UNIT`). |
| `7` | `قيمة الضريبة` / `Tax amount` | `taxAmount`, `deductibleAmount`, `nonDeductibleAmount` | `<Money value={taxAmount} currency={currencyCode} />` (sub-caption shows `deductibleAmount` when `direction === 'INPUT'` and `nonDeductibleAmount !== "0"`). |
| `8` | `الحالة والدليل` / `Status & evidence` | `taxStatus`, `inputTaxEvidence`, `restorationHoldReason` | `<Badge>` (`POSTED`, `DEFERRED`, `FILED`, `VOIDED`) + `caution` icon when `inputTaxEvidence === 'PENDING'` or `negative` hold pill when `restorationHoldReason !== null`. |
| `9` | `التفاصيل` / `Inspect` | `id` | `<Link href="/accounting/file/tax-registers/{id}">` (`عرض الإيصال` / `Receipt & detail`). |

---

### 4.3 `#84` Statutory Register & Report Views (`P-17`, `P-18`, `P-19`, `S-04`, `S-07` — see `CG-VAT-07`)

1. **`?view=tax-report` (`GET /accounting/reports/tax-report`, `P-17`):**
   - **Mandatory filters (`TaxReportQueryDto`):** `fromDate: ISODate`, `toDate: ISODate`.
   - **Optional filters:** `registrationId?: UUID`, `taxTypeCode?: string[]`, `direction?: TaxDirection`, `taxStatus?: TaxTransactionStatus[]`, `returnPeriodId?: UUID`, `groupBy?: 'BOX' | 'TAX_TYPE' | 'PARTY'` (segmented selector defaulting to `'BOX'`).
   - **Layout:** Summary totals strip (`totalBase`, `totalOutputTax`, `totalInputTax`, `netTax`) + grouped `DataTable` (`groupKey`, `groupLabel`, `transactionCount`, `taxableBase`, `taxAmount`, `deductibleAmount`, `nonDeductibleAmount` — exact DTO contract tracked in `CG-VAT-07`) with row click drilling into `?view=transactions`.
2. **`?view=sales-register` (`GET /accounting/reports/sales-register`, `P-18`):**
   - **Mandatory filters (`SalesRegisterQueryDto`):** `fromDate`, `toDate`.
   - **Optional filters:** `documentKind?: FiscalDocumentKind[]` (`TAX_INVOICE`, `SIMPLIFIED_TAX_INVOICE`, `CREDIT_NOTE_SALES`, `DEBIT_NOTE_SALES`, `EXPORT_INVOICE`, `POS_RECEIPT_SUMMARY`), `branchId?: UUID`, `partyId?: UUID` (`POST /party-finance-profiles/lookup`), `authorityStatus?: AuthorityDocumentStatus[]`, `includeCancelled?: boolean`.
   - **Columns (`CG-VAT-07`):** Document date, document number (`<IdentifierText />`), kind, buyer name & TRN (`<IdentifierText />`), ETA UUID & `authorityStatus` badge, net base, table tax, VAT (`14%` / `0%` / exempt), total invoice amount, and link to `SCR-17` (`/accounting/post/fiscal-documents/[id]`).
3. **`?view=purchase-register` (`GET /accounting/reports/purchase-register`, `P-19`):**
   - **Mandatory filters (`PurchaseRegisterQueryDto`):** `fromDate`, `toDate`.
   - **Optional filters:** `documentKind?: FiscalDocumentKind[]`, `partyId?: UUID`, `inputTaxEvidence?: InputTaxEvidenceStatus[]` (`AUTHORITY_VALID`, `CUSTOMS_RELEASE`, `REVERSE_CHARGE_SELF`, `PAPER_ALLOWED`, `PENDING`, `REJECTED`), `matchStatus?: InboundMatchStatus[]`, `attributionClass?: InputTaxAttribution[]` (`TAXABLE_ONLY`, `EXEMPT_ONLY`, `RESIDUAL_SHARED`, `NON_BUSINESS`).
   - **Columns (`CG-VAT-07`):** Supplier invoice date, document number, supplier name & TRN, `inputTaxEvidence` badge, `attributionClass` badge, `matchStatus` badge, taxable base, gross VAT, `deductibleAmount`, `nonDeductibleAmount`, and link to `SCR-17`.
4. **`?view=decision-receipts` (`GET /accounting/tax/decision-receipts` `S-04`, `POST /search` `S-05`):**
   - Read-only audit register displaying `id` (`<IdentifierText />`), `createdAt`, `engineVersion`, `contentHash` (`8`-char prefix + copy), `factSchemaHash`, `geoHash`, `taxFinal` badge, and deep-link to `#85` or `SCR-14`.
5. **`?view=withholding-register` (`GET /accounting/reports/withholding-register`, `S-07`):**
   - Mounted **only** when `user.featureEntitlements["accounting.tax.withholding"] === true`. Filters: `fromDate`, `toDate`, `partyId?`, `remittanceId?`. Links remittance actions to `SCR-16` (`/accounting/file/withholding`).

---

### 4.4 Route `#85` — `/accounting/file/tax-registers/[id]` (Tax Transaction Detail & Decision Receipt Inspector) — `[Slice — P19.T09]`

Loads `GET /accounting/tax/transactions/:id` (`P-15`) and `GET /accounting/tax/decision-receipts/:decisionReceiptId` (`S-06`) in parallel (`Promise.allSettled`):

1. **Header & Provenance Band (`acc_tax_transactions`):**
   - Breadcrumb: `السجلات الضريبية` / `Tax registers` (`#84`) `/` `<IdentifierText>{id}</IdentifierText>`.
   - Status badges: `taxStatus` (`POSTED` / `DEFERRED` / `FILED` / `VOIDED`), `direction`, `inputTaxEvidence`, and (if present) `restorationHoldReason` + `restorationHoldPeriodId` link.
   - Zero `primary` buttons (`#85` is an immutable audit record; `PageActionBar` carries `outline` links: `عرض المستند الضريبي` / `Open fiscal document` -> `/accounting/post/fiscal-documents/{fiscalDocumentId}`, `عرض قيد اليومية` / `Open journal entry`, and `فتح فترة الإقرار` / `Open return period` -> `/accounting/file/tax-returns/{returnPeriodId}`).
2. **Panel 1 — Statutory Tax Figures & Counterparty Snapshot (`2 × col-span-6`):**
   - Left card: `taxTypeCode`, `authorityTaxCode` / `authoritySubtype` (`<IdentifierText />`), `taxPointDate`, `taxPointBasis`, `rateKind`, `rateApplied`, `taxableBase`, `taxAmount`, `deductibleAmount`, `nonDeductibleAmount`, `recoveryRatioApplied`, `exemptionReasonCode`.
   - Right card: `partyClassification`, `partyTaxId` (`<IdentifierText />`), `placeOfSupplyCountry`, `supplyNature`, `itemTaxCategory`, `isCapitalGood`, `reversalOfId` / `correctionOfPeriodId` links (for storno `-X` and replacement `+X'` audit chains).
3. **Panel 2 — Multi-Stage `baseComposition` Breakdown Table (`acc_tax_transactions.base_composition`):**
   - Renders each element of `baseComposition[]` (`{ component: 'NET_LINE' | 'DISCOUNT' | 'CHARGE' | 'PRIOR_STAGE_TAX', taxTypeCode?, amount: DecimalString }`) — essential for Egypt Schedule / Table Tax (`T2`) cascading into standard `14%` VAT (`T1`).
4. **Panel 3 — Immutable 6-Step Tax Decision Receipt Inspector (`acc_tax_decision_receipts`, `S-06`):**
   - **Four Determinism Fingerprints Strip (`<IdentifierText>` copy pills):**
     1. `contentHash` (`SHA-256` of matched rule set version)
     2. `factSchemaHash` (`SHA-256` of input fact schema)
     3. `engineVersion` (`semver`)
     4. `geoHash` (`supply geography fingerprint`) + `taxFinal: true` lock badge (`Lock` icon — `قرار ضريبي مختوم غير قابل لإعادة التقييم` / `Sealed tax decision — never re-evaluated`).
   - **Steps `0..5` Accordion / Timeline (`matchedRows[]`):**
     - Step `0`: Applicability & registration match;
     - Step `1`: Place of supply & cross-border classification;
     - Step `2`: Exemption / zero-rating / schedule tax rule;
     - Step `3`: Rate & cascading base (`priorStageTaxes`);
     - Step `4`: Input-tax evidence & partial-recovery attribution;
     - Step `5`: Return box mapping (`acc_box_mapping_rules` -> `boxCode`) + expandable read-only JSON viewer (`dir="ltr"`) for `inputFacts` and `computedLines`.

---

## 5. All 11 UI States, RBAC/Entitlements, 3-Part Error Matrix & Waiting States

### 5.1 Complete 11-State Coverage (`accounting-status-and-a11y.md` & `states.md`)

| # | UI State | Behaviour Across `#76`, `#77`, `#84`, `#85` |
| --- | --- | --- |
| `1` | **Loading (Initial)** | Geometry-matched skeletons (`PageActionBar` + `FilterBar` + `8` table rows on `#76`/`#84`; header band + `5`-gate readiness strip + `10`-box table skeleton on `#77`). Zero layout shift (`CLS = 0`). |
| `2` | **Refreshing / Background Refetch** | Existing rows stay visible; subtle spinner on `تحديث` / `Refresh` button and `aria-busy="true"` on updated panel. |
| `3` | **Empty (Zero Records — Unfiltered)** | `#76`: `EmptyState` (`FileSpreadsheet` icon) explaining how periodic Form 10 VAT returns work + `فتح فترة إقرار` / `Open return period` trigger (if permitted). `#84`: explains tax transactions populate automatically when fiscal documents (`SCR-17`) or tax-bearing journals post. |
| `4` | **Filtered Empty (Zero Matches)** | Preserves FilterBar values + `لا توجد نتائج مطابقة للفلاتر الحالية` / `No records match current filters` + `مسح الفلاتر` / `Clear filters` `outline` button. |
| `5` | **Populated (`200 OK`)** | Full keyboard-navigable `DataTable` / workspace tabs (`font-normal` cells, `<Money />` & `<IdentifierText />` LTR islands). |
| `6` | **Unentitled Feature (`featureEntitlements[key] !== true`)** | • Missing `accounting.tax.returns`: nav item `#76` absent; direct URL to `#76`/`#77` renders `FeatureEntitlementGate` (factual, zero upsell marketing).<br>• Missing `accounting.tax.engine`: nav item `#84` absent; direct URL to `#84`/`#85` renders `FeatureEntitlementGate`.<br>• Missing `accounting.tax.withholding`: `?view=withholding-register` tab omitted cleanly on `#84`.<br>• Missing `accounting.tax.partial_recovery`: Gate `G-04` omitted cleanly on `#77`.<br>• Missing `accounting.documents.einvoice_eg`: Tab 3 (`RET-08`) shows `Not applicable` on `#77`. |
| `7` | **Forbidden (`403` / Missing `.read` Permission)** | **Never rendered as empty.** Renders `PermissionGate` naming the exact missing key (`accounting.tax_return.read`, `accounting.tax_transaction.read`, `accounting.report.read`, or `accounting.authority_document.read`) and active scope (`COMPANY` / `BRANCH`). |
| `8` | **Read-Only / Missing Write Permission (e.g. Auditor / Approver)** | Data loads normally; mutating buttons (`Compute`, `Record filing`, `Official-column export`, `Open return period`) remain visible in `Basic` workflows, **disabled with a one-line factual tooltip/caption** naming the required permission (`accounting-ia.md` §3 Rule 5). |
| `9` | **Segregation of Duties (`Maker == Checker`)** | On dual-control panels (`confirm-filed-copy` `P-22`, `confirm-restored-transactions` `P-24`, `close-coverage-gap` call 2 `P-25`, `withdrawals/:attemptId/confirm` `P-33`), when `currentUser.id === recordedBy`, `MakerCheckerBanner` disables `Confirm` with `لا يمكن لمسجّل الإجراء تأكيده بنفسه — يلزم مستخدم ثانٍ مستقل` / `Recorder cannot self-confirm — a second authorized user is required`. |
| `10` | **Tenant `RECOVERY_MODE` (`403 ACCOUNTING.FEATURE.RECOVERY_MODE`)** | `RecoveryModeBanner` mounts below `AccountingScopeBar`; all read tabs/exports remain readable while mutating commands disable with `النظام في وضع الاستعادة` / `Disabled while restore recovery is active` (`accounting-ia.md` §3 Rule 9). |
| `11` | **Validation / Conflict / Network Error (`4xx` / `5xx` / Timeout)** | Rendered via the **3-Part Bilingual Error Banner** (§5.2) with copyable `correlationId` (`<IdentifierText />`) and preserved UUIDv7 `x-idempotency-key` on timeout retry. |

---

### 5.2 Three-Part Bilingual Error Matrix (`Cause + Effect + Safe Next Action + correlationId`)

Every error banner (`04_Errors_and_Constants.md` §3.3 + HTTP concurrency/gateway statuses) renders three explicit lines (**1. What happened**, **2. Effect on books/return**, **3. Safe action**) plus `correlationId`:

| Error Code / HTTP Status | 1. Cause (`AR` / `EN`) | 2. Effect (`AR` / `EN`) | 3. Safe Next Action (`AR` / `EN`) |
| --- | --- | --- | --- |
| `ACCOUNTING.TAX.PERIOD_NOT_SOFT_CLOSED` (`409`) | `نطاق الضرائب (TAX) للفترة المحاسبية لا يزال مفتوحاً.` / `The fiscal period's TAX domain is still OPEN.` | `لم يتم تقديم الإقرار ولم يُنشأ قيد إثبات الضريبة.` / `The return was not filed and no declaration entry was posted.` | `انتقل إلى شاشة الفترات المحاسبية لإقفال نطاق الضرائب مبدئياً (Soft-close) ثم أعد المحاولة.` / `Open Fiscal Periods (/accounting/setup/periods), soft-close the TAX domain, then retry filing.` |
| `ACCOUNTING.TAX.AUTHORITY_RECON_INCOMPLETE` (`409`) | `مطابقة حزمة مصلحة الضرائب لا تغطي نهاية الفترة أو تحتوي على فروق غير محلولة.` / `Authority package reconciliation does not cover periodEnd or has unresolved differences.` | `ظل الإقرار في حالة محتسب (COMPUTED) دون تقديم.` / `The return remains COMPUTED; nothing was filed.` | `افتح تبويب "مطابقة مصلحة الضرائب" لتشغيل المطابقة ومعالجة الفروق أولاً.` / `Open Tab 3 (Authority package) to run reconciliation and clear differences.` |
| `ACCOUNTING.TAX.RETURN_ALREADY_FILED` (`409`) | `تم تسجيل تقديم هذا الإقرار مسبقاً.` / `This tax return period has already been filed.` | `لم يتم تعديل الإقرار المقدّم أو تكرار القيد.` / `The filed return and declaration entry were not duplicated.` | `قم بتحديث الصفحة لعرض رقم الإيصال واللقطة المجمّدة؛ وللتصحيح استخدم مسار الإقرار المعدّل.` / `Refresh workspace to view the filed snapshot; use Amended Return for Cause-2 errors.` |
| `ACCOUNTING.TAX.PERIOD_LOCKED` (`409`) | `تاريخ الواقعة الضريبية يقع ضمن فترة ضريبية مقفلة حتى {lockedUntil}.` / `Tax-point date falls inside a locked tax registration period.` | `لم يُفتح الإقرار أو تُرحّل المعاملة في الفترة المقفلة.` / `No change was written to the locked period.` | `تحقق من تاريخ بداية ونهاية الفترة أو استخدم مسار التصحيحات للفترة المقدّمة.` / `Select an unlocked period range or register a formal tax correction.` |
| `ACCOUNTING.TAX.INTERIM_POLICY_UNRESOLVED` (`409`, `L-READY-05`) | `توجد معاملات معلّقة بسياسة ضريبية انتقالية (INTERIM_POLICY_PENDING) لم تُحسم.` / `Unresolved INTERIM_POLICY_PENDING items exist for this period.` | `توقف تقديم الإقرار لحماية صحة الضريبة المحتسبة.` / `Filing was blocked; books are unchanged.` | `افتح لوحة الاستثناءات لحسم السياسة الانتقالية ثم أعد احتساب الإقرار.` / `Resolve interim policy items on the Exception Board, recompute, then file.` |
| `ACCOUNTING.TAX.RESTORATION_HOLD_UNRESOLVED` / `SNAPSHOT_GAP_OPEN` (`409`) | `توجد فجوة نسخة إقرار مفقودة أو معاملات مستعادة قيد التعليق بعد استعادة قاعدة البيانات.` / `An open post-restore snapshot gap or held tax transactions block filing.` | `ظل الإقرار غير مقدّم لمنع ترحيل أرصدة دائنة غير موثقة.` / `Return was not filed; carry-forward chain protected.` | `انتقل إلى تبويب "فجوات الاستعادة" لإرفاق النسخة الرسمية أو حسم المعاملات المعلّقة بموافقة ثنائية.` / `Open the Post-Restore Recovery tab to complete dual-control recovery first.` |
| `ACCOUNTING.TAX.REFUND_EXCEEDS_CREDIT` (`422`) | `مبلغ طلب الاسترداد يتجاوز الرصيد الدائن المتاح للاسترداد في هذه الفترة.` / `Requested refund exceeds available unallocated VAT credit.` | `لم يتم إنشاء أو تعديل طلب الاسترداد.` / `No refund claim was created.` | `أدخل مبلغاً لا يتجاوز الرصيد المتاح الموضح في رأس التبويب.` / `Enter an amount within the server-verified available credit.` |
| `412 Precondition Failed` / `409 ETag Mismatch` | `تم تحديث هذا الإقرار بواسطة مستخدم آخر أو عملية خلفية منذ فتح الشاشة.` / `This return was modified by another session since you loaded it.` | `تم إيقاف طلبك لمنع الكتابة فوق التحديث الأحدث.` / `Your request was rejected to prevent overwriting newer data.` | `اضغط "تحديث البيانات" لتحميل أحدث جيل ونسخة (ETag) ثم راجع الأرقام وأعد الإجراء.` / `Click Reload return to fetch the latest ETag and review updated figures.` |
| `408` / `502` / `503` / `504` / Network Timeout | `انتهت مهلة الاتصال بالخادم قبل استلام تأكيد العملية.` / `Connection timed out before the server confirmed the outcome.` | `قد تكون العملية قيد التنفيذ أو اكتملت؛ مفتاح عدم التكرار محفوظ بأمان.` / `The request may still be completing; your UUIDv7 idempotency key is preserved.` | `اضغط "التحقق من الحالة / إعادة المحاولة بنفس المفتاح" — لن يُنشئ ذلك قيداً مكرراً.` / `Click Check status / Retry with same key — safe against duplicate posting.` |

---

### 5.3 Waiting States Catalogue (`WS-RET-01`..`WS-RET-09` — Zero-Resend Law)

Per `accounting-status-and-a11y.md` §4 and the `P03.T10.S4` brief, **every waiting state names (a) what is in progress, (b) deadline / expected budget, (c) owner, and (d) safe next action, and NEVER renders a "Resend" button that could imply re-emitting a mutation:**

| ID | Waiting State (`#77` / `#84`) | Deadline / Poll Cadence | Owner | Safe Next Action *(Zero-Resend Law)* |
| --- | --- | --- | --- | --- |
| `WS-RET-01` | **Async Return Computation (`POST /:id/compute` -> `202`)** | Sync budget `<= 5s`; if `202`, polls `GET /tax/returns/:id` every `3s` (expected `< 60s`). | System (`accounting-app` worker) | `تحديث الحالة` / `Refresh status` (`GET /:id` only — `Compute` button stays locked while job is active). |
| `WS-RET-02` | **Official-Column Export Run (`POST /:id/export` -> `202`)** | Polls `GET /exports/runs/:id` every `3s` -> `8s`; download link valid until `expiresAt`. | System (`accounting-app` export runner) | Wait for `COMPLETED` then click `تنزيل الملف الرسمي` / `Download official file` (`GET .../download`). Never re-POSTs while `QUEUED` / `RUNNING`. |
| `WS-RET-03` | **Authority Package Reconciliation Run (`POST /reconciliations/authority/run` -> `202`)** | Polls `GET /reconciliations/authority/:id` every `4s` (expected `< 2 min`). | System (`accounting-app` authority reconciler) | `تحديث حالة المطابقة` / `Refresh run status` or inspect details in `SCR-21`. |
| `WS-RET-04` | **Deferred Input VAT Awaiting Supplier ETA Document (`CREDIT_EVIDENCE_PENDING`)** | Statutory cutoff: `CREDIT_EVIDENCE_CUTOFF_DAYS` from `GET /tax/authority-parameters` (`S-03`) before return `dueDate`. | Counterparty Supplier / Buyer Accountant | Track inbound ETA document in `SCR-19` / `SCR-20`; if received after cutoff, engine automatically claims it in the next open return period. |
| `WS-RET-05` | **Tax Transactions Register Export (`POST /tax/transactions/export` -> `202`)** | Polls `GET /exports/runs/:id` every `3s` -> `8s`. | System (`accounting-app` export runner) | Click `تنزيل السجل` / `Download register` once `COMPLETED`. |
| `WS-RET-06` | **Attached Filed Copy Pending Confirmation (`filedCopyStatus = 'PENDING_CONFIRMATION'`)** *(`[Slice recorder -> P21 checker]`)* | Before next return period `dueDate` (`filing blocked` until confirmed). | Second Authorized Accountant / Chief Accountant (`!= filedCopyRecordedBy`) | Second user opens `#77?tab=restoration`, inspects PDF & box totals, and clicks `تأكيد النسخة المرفقة` / `Confirm filed copy` (`P-22`). |
| `WS-RET-07` | **Held Restored Transactions / Coverage Gap Pending Confirmation** *(`[Full stage — P21]`)* | Before filing current/subsequent return period. | Second Authorized User (`!= recorder`) | Second user verifies `heldSetHash` / `gapHash` on `#77?tab=restoration` and confirms (`P-24` / `P-25`). |
| `WS-RET-08` | **Copy-Unobtainable Declaration Pending Approval / Owner Ack** *(`[Full stage — P21]`)* | Before subsequent return `dueDate`. | Approvers (`/accounting/inbox/approvals`) then **Tenant Owner** (`isTenantOwner`) | Complete 2-step approval in `SCR-07`, then Tenant Owner executes `acknowledge-copy-unobtainable` (`P-27`). |
| `WS-RET-09` | **VAT Refund Claim Withdrawal Pending Confirmation (`PENDING_CONFIRMATION`)** *(`[Full stage — P20.T07]`)* | Before authority issues final decision on claim. | Second Authorized User holding `accounting.tax_return.amend` (`!= recordedBy`) | Second user confirms (`P-33`) or rejects (`P-34`) withdrawal attempt on `#77?tab=refund-claims`. |

---

## 6. Bilingual Dictionary Keys (`ar` / `en`), Status Badge Mapping & RTL/LTR Rules

### 6.1 Closed Enum Badge & Tone Mapping (Zero `brand` Status Badges, Zero Raw Wire Strings)

| Domain Enum & Wire Literal | Tone (`tokens.md`) | Lucide Icon | Arabic (`ar.ts`) | English (`en.ts`) |
| --- | --- | --- | --- | --- |
| `TaxReturnPeriodStatus.OPEN` | `neutral` (`ink`) | `CircleDashed` | `مفتوح (لم يُحتسب)` | `Open` |
| `TaxReturnPeriodStatus.COMPUTED` | `caution` | `Calculator` | `محتسب — جاهز للمراجعة` | `Computed` |
| `TaxReturnPeriodStatus.FILED` | `positive` | `CheckCircle2` | `مقدّم ومقفل` | `Filed` |
| `TaxReturnPeriodStatus.AMENDED` | `positive` | `FileCheck2` | `معدّل ومقفل` | `Amended` |
| `TaxReturnPeriodStatus.CANCELLED` | `neutral` (`ink`) | `Ban` | `ملغى` | `Cancelled` |
| `TaxTransactionStatus.POSTED` | `positive` | `Check` | `مرحّل` | `Posted` |
| `TaxTransactionStatus.DEFERRED` | `caution` | `Clock` | `مؤجّل لحين اكتمال الدليل` | `Deferred` |
| `TaxTransactionStatus.FILED` | `positive` | `Lock` | `مُدرج بإقرار مقدّم` | `Filed` |
| `TaxTransactionStatus.VOIDED` | `neutral` (`ink`) | `XCircle` | `ملغى (عكس ضريبي)` | `Voided` |
| `VatRefundClaimStatus.DRAFT` | `neutral` (`ink`) | `FileEdit` | `مسودة` | `Draft` |
| `VatRefundClaimStatus.FILED` | `caution` | `Send` | `مقدّم للمصلحة` | `Filed with authority` |
| `VatRefundClaimStatus.APPROVED` | `positive` | `BadgeCheck` | `معتمد من المصلحة` | `Approved` |
| `VatRefundClaimStatus.PAID` | `positive` | `Banknote` | `تم الصرف` | `Paid` |
| `VatRefundClaimStatus.REJECTED` | `negative` | `OctagonX` | `مرفوض` | `Rejected` |
| `VatRefundClaimStatus.WITHDRAWN` | `neutral` (`ink`) | `Undo2` | `مسحوب` | `Withdrawn` |
| `VatRefundBasis.EXPORT_ZERO_RATED` | `neutral` | `Globe` | `صادرات خاضعة لسعر الصفر` | `Zero-rated exports` |
| `VatRefundBasis.SIX_CONSECUTIVE_PERIODS` | `neutral` | `CalendarRange` | `رصيد دائن لست فترات متتالية` | `Six consecutive credit periods` |
| `VatRefundBasis.MACHINERY_CAPITAL` | `neutral` | `Cog` | `آلات ومعدات رأسمالية للإنتاج` | `Capital machinery & equipment` |
| `VatRefundBasis.DEREGISTRATION` | `neutral` | `UserX` | `إلغاء التسجيل الضريبي` | `Tax deregistration` |

### 6.2 Canonical i18n Namespace Skeleton (`t.accounting.taxReturns.*` & `t.accounting.taxRegisters.*`)

- `t.accounting.taxReturns.list.{title, openPeriodCta, tabs.{returns, refundClaims}, filters.*, columns.*, empty.*}`
- `t.accounting.taxReturns.workspace.{readiness.{taxPeriod, ledgerRecon, authorityRecon, partialRecovery, exceptions}, formula.{outputVat, deductibleInputVat, carriedForward, cfAdjustment, annualAdjustment, netPayable, netCredit}, tabs.{boxes, ledgerRecon, authorityRecon, amendments, restoration, refundClaims}}`
- `t.accounting.taxReturns.reconcileLedger.{boxCode, returnAmount, ledgerAmount, difference, reconcilingItems, unexplainedAmount, items.{LATE_DOCUMENT_ORIGINAL_PERIOD, UNBILLED_ACCRUAL_NET_OF_TAX, CARRY_FORWARD_ADJUSTMENT, PRIOR_PERIOD_CORRECTION, ANNUAL_RECOVERY_ADJUSTMENT, RETURN_ROUNDING, POS_BUSINESS_DATE}, contractPendingNotice}`
- `t.accounting.taxReturns.reconcileAuthority.{matchedThrough, runCta, openWorkspaceLink, notApplicable, differences.{MISSING_LOCALLY, MISSING_AT_AUTHORITY, AMOUNT_MISMATCH, STATUS_MISMATCH}}`
- `t.accounting.taxReturns.officialExport.{drawerTitle, schemaPreviewTitle, generateCta, downloadCta, sha256Label}`
- `t.accounting.taxReturns.fileModal.{title, irreversibleNotice, filingReferenceLabel, filedAtLabel, payableConfirmLabel, submitCta, postFilingBankNotice}`
- `t.accounting.taxRegisters.{title, views.{transactions, taxReport, salesRegister, purchaseRegister, decisionReceipts, withholdingRegister}, countBadge, exportCta, receiptInspector.{title, sealedBadge, fingerprints.*, steps.*}}`

---

## 7. Four-Combination ASCII Mockups (`AR-RTL` / `EN-LTR` × `Light` / `Dark` + `375px` Mobile)

> **Mockup Verification Notes:**
> - All four combinations strictly use **Western numerals (`0–9`)**, `<Money>` LTR islands (`EGP 142,800.00`), `<IdentifierText>` LTR islands (`EG_VAT_FORM_10`, `310-445-892`, `DOC_TYP`, `ETA-F10-202610-009841`), icon + text status badges (zero color-only cues, zero `brand` status badges), and **at most one `[● Primary]` CTA** in `PageActionBar`.

### 7.1 Combination 1 — `AR-RTL × Light` (`dir="rtl"`, `theme="light"` — `#77` Workspace in `COMPUTED` Ready-to-File State + Official Export & Reconciliations)

```text
+----------------------------------------------------------------------------------------------------------------------+
| [تبديل التطبيق] المحاسبة  |  نظرة عامة  1.الوارد  2.القيود  3.المطابقة  4.الإقفال  [5.الإقرارات والامتثال*]  6.الإعداد |
+----------------------------------------------------------------------------------------------------------------------+
| [● تسجيل تقديم الإقرار] [تصدير بالأعمدة الرسمية] [إعادة الاحتساب]     إقرار ضريبة القيمة المضافة (نموذج 10) < الإقرارات |
+----------------------------------------------------------------------------------------------------------------------+
| نطاق العمل: الشركة [شركة مرساني للتجارة ش.م.م v]  |  الفرع: [كل الفروع — إقرار على مستوى الشركة]  |  العملة: EGP       |
+----------------------------------------------------------------------------------------------------------------------+
| [⚠ محتسب — جاهز للمراجعة]  الفترة: 2026-10-01 – 2026-10-31  |  النموذج: EG_VAT_FORM_10 · v2                         |
| رقم التسجيل الضريبي: 310-445-892  |  مقفل حتى: 2026-09-30  |  آخر موعد للتقديم: 2026-11-30  |  الجيل: #3             |
+----------------------------------------------------------------------------------------------------------------------+
| شريط الجاهزية للتقديم (5 ضوابط إلزامية):                                                                             |
| [✓ نطاق الضرائب TAX: مقفل مبدئياً] [✓ 1.الأستاذ العام: فرق غير مفسّر EGP 0.00] [✓ 2.بوابة المصلحة: متطابق حتى 2026-10-31] |
| [✓ الخصم الجزئي: شهرية 85.00%]     [ℹ بنود مؤجلة الدليل CREDIT_EVIDENCE_PENDING: 2 (لا تمنع التقديم)]                |
+----------------------------------------------------------------------------------------------------------------------+
| معادلة الإقرار المعتمدة من الخادم (بدون عمليات حسابية بالمتصفح):                                                     |
| صافي المستحق EGP 84,350.00 = + تسوية سنوية EGP 0.00 + تسوية مرحّل EGP 0.00 - رصيد مرحّل EGP 12,450.00                 |
|                              - مدخلات مخصومة EGP 46,000.00 + مخرجات EGP 142,800.00                                  |
+----------------------------------------------------------------------------------------------------------------------+
| التبويبات: [خانات الإقرار (10)]  [*1. مطابقة الأستاذ العام ✓*]  [2. مطابقة مصلحة الضرائب ✓]                           |
+----------------------------------------------------------------------------------------------------------------------+
| +--------------------------------------------------------+ +--------------------------------------------------------+ |
| | مطابقة ضريبة المدخلات القابلة للخصم مع الأستاذ العام   | | مطابقة ضريبة المخرجات مع الأستاذ العام                 | |
| | إجمالي المدخلات بالإقرار:            EGP 46,000.00     | | إجمالي المخرجات بالإقرار:           EGP 142,800.00     | |
| | صافي حركة حساب ضريبة المدخلات:       EGP 48,100.00     | | صافي حركة حساب ضريبة المخرجات:      EGP 140,000.00     | |
| | إجمالي الفرق الدفتري:                EGP -2,100.00     | | إجمالي الفرق الدفتري:                EGP +2,800.00     | |
| | المفسّر ببنود تسوية مسمّاة:          EGP -2,100.00     | | المفسّر ببنود تسوية مسمّاة:          EGP +2,800.00     | |
| | [✓ الفرق غير المفسّر: EGP 0.00 — متطابق]              | | [✓ الفرق غير المفسّر: EGP 0.00 — متطابق]              | |
| +--------------------------------------------------------+ +--------------------------------------------------------+ |
| بنود التسوية المسمّاة (قائمة مغلقة من 7 أنواع — §8.10):                                                               |
| | إجراء        | متى يزول الفرق                                    | القيمة          | الجانب   | بند التسوية       | |
| |--------------|---------------------------------------------------|-----------------|----------|-------------------| |
| | [عرض السجل]  | يزول عند مقارنة الإقرار التراكمي مع الأستاذ       | EGP +2,800.00   | المخرجات | مستند متأخر مسجّل | |
| | [عرض السجل]  | يزول باكتمال دليل الفاتورة الإلكترونية للمورد     | EGP -2,100.00   | المدخلات | تصحيح فترة سابقة  | |
+----------------------------------------------------------------------------------------------------------------------+
```

---

### 7.2 Combination 2 — `AR-RTL × Dark` (`dir="rtl"`, `theme="dark"` — `#77` Official-Column Export Drawer `RET-09` & Filed State `RET-10`–`RET-12`)

```text
+----------------------------------------------------------------------------------------------------------------------+
| [bg-ink-950 / text-ink-50]  المحاسبة > 5. الإقرارات والامتثال > إقرار ضريبة القيمة المضافة — أكتوبر 2026             |
+----------------------------------------------------------------------------------------------------------------------+
| [تصدير بالأعمدة الرسمية] [عرض اللقطة المجمّدة] [السجلات الضريبية]             (لا يوجد زر رئيسي — الإقرار مقدّم ومقفل) |
+----------------------------------------------------------------------------------------------------------------------+
| [✓ مقدّم ومقفل]  الفترة: 2026-10-01 – 2026-10-31  |  رقم التسجيل: 310-445-892  |  مقفل حتى: 2026-10-31                |
| رقم إيصال التقديم بالمصلحة: ETA-F10-202610-009841 (2026-11-14 14:22 UTC)  |  قيد الإقرار: JE-2026-004912 [فتح القيد]  |
+----------------------------------------------------------------------------------------------------------------------+
| [🏛 إرشاد سداد الضريبة المستحقة (RET-12 — EGP 84,350.00)]: لا توجد حالة "مدفوع" على سجل الإقرار؛ يتم إثبات السداد عبر |
| [إنشاء دفعة صادرة] أو عبر [مطابقة كشف البنك — DIRECT_POSTING] مباشرة على حساب التزام ضريبة القيمة المضافة.           |
+----------------------------------------------------------------------------------------------------------------------+
| +-------------------------------------------------[ درج جانبي: التصدير بالأعمدة الرسمية (RET-09) ]-----------------+ |
| | النموذج المثبّت: EG_VAT_FORM_10 · v2  |  الأعمدة الرسمية المعتمدة (تُحفظ رموزها الإنجليزية حرفياً دون ترجمة):    | |
| |  • DOC_TYP (نوع المستند)   • TAX_TYP (نوع الضريبة)   • TYP_SCH (جدول السلع)   • TAX_REG_NO (تسجيل الطرف)         | |
| |  • INV_DT (تاريخ الفاتورة) • COMM_TYPE (طبيعة السلعة) • TAX_CAT (فئة المعاملة) • NET_AMT / TAX_AMT / TOT_AMT      | |
| |------------------------------------------------------------------------------------------------------------------| |
| | حالة التشغيل (GET /exports/runs/01932a90-...): [✓ مكتمل — COMPLETED]  |  عدد الصفوف: 418  |  الحجم: 184 KB       | |
| | البصمة الرقمية SHA-256: e3b0c44298fc1c149afbf4c8996fb924... [نسخ]     |  صالح حتى: 2026-11-15 14:30 UTC          | |
| | [تنزيل الملف الرسمي (XLSX)]   [إغلاق]                                                                            | |
| +------------------------------------------------------------------------------------------------------------------+ |
+----------------------------------------------------------------------------------------------------------------------+
```

---

### 7.3 Combination 3 — `EN-LTR × Light` (`dir="ltr"`, `theme="light"` — `#77` Tab 3 Authority Reconciliation `RET-08` & `FileTaxReturnModal` `RET-10`)

```text
+----------------------------------------------------------------------------------------------------------------------+
| [AppSwitcher] Accounting  |  Overview  1.Inbox  2.Post  3.Reconcile  4.Close  [5.File*]  6.Setup                     |
+----------------------------------------------------------------------------------------------------------------------+
| Tax returns / 2026-10-01 – 2026-10-31 — Egypt Monthly VAT Return (Form 10)                                           |
|                                      [Tax registers] [Recompute] [Official-column export] [● Record filing]          |
+----------------------------------------------------------------------------------------------------------------------+
| Scope: Company [Mersany Trading SAE v]  |  Branch: [All branches — company-level return]  |  Currency: EGP           |
+----------------------------------------------------------------------------------------------------------------------+
| [⚠ Computed]  Form: EG_VAT_FORM_10 · v2  |  TRN: 310-445-892  |  Locked until: 2026-09-30  |  Due: 2026-11-30        |
+----------------------------------------------------------------------------------------------------------------------+
| Readiness Gates: [✓ TAX Soft-closed] [✓ 1.Return-to-ledger: EGP 0.00] [✓ 2.Authority package: 2026-10-31] [✓ 0 Blk]  |
+----------------------------------------------------------------------------------------------------------------------+
| Tabs: [Return boxes (10)]  [1. Return-to-ledger ✓]  [*2. Authority package (RET-08) ✓*]                              |
+----------------------------------------------------------------------------------------------------------------------+
| Latest Authority Reconciliation Run: 01932a7f-88b1-...  |  Matched through: 2026-10-31 (>= periodEnd 2026-10-31) [✓] |
| +-------------------------+ +-------------------------+ +-------------------------+ +------------------------------+ |
| | Missing locally (ETA)   | | Missing at authority    | | Amount / VAT mismatch   | | Document status mismatch     | |
| | 0 documents         [✓] | | 0 documents         [✓] | | 0 documents         [✓] | | 0 documents              [✓] | |
| +-------------------------+ +-------------------------+ +-------------------------+ +------------------------------+ |
| [Run authority reconciliation]   [Open full authority reconciliation workspace (/accounting/reconcile/authority) ->] |
|                                                                                                                      |
|   +-----------------------------------[ Modal: Record VAT Return Filing (RET-10) ]-------------------------------+   |
|   | [🔒 Irreversible Lock]: Recording filing pins snapshot gen #3, posts the VAT declaration journal entry,      |   |
|   | and advances TRN 310-445-892 lockedUntil to 2026-10-31.                                                      |   |
|   | Output VAT: EGP 142,800.00  |  Input VAT: EGP 46,000.00  |  CF Credit: EGP 12,450.00  |  Net: EGP 84,350.00  |   |
|   | Authority filing acknowledgement reference * : [ ETA-F10-202610-009841                ]                      |   |
|   | Actual filed date & time (UTC) *             : [ 2026-11-14T14:22:00Z                 ]                      |   |
|   | Portal payable amount cross-check (optional) : [ 84350.00                             ] (EGP)                |   |
|   |                                                                    [Cancel]  [Confirm & lock return filing]  |   |
|   +--------------------------------------------------------------------------------------------------------------+   |
+----------------------------------------------------------------------------------------------------------------------+
```

---

### 7.4 Combination 4 — `EN-LTR × Dark` (`dir="ltr"`, `theme="dark"` — `#84` Tax Registers Keyset Ledger & `#85` Decision Receipt Inspector)

```text
+----------------------------------------------------------------------------------------------------------------------+
| [bg-ink-950 / text-ink-50]  Accounting > 5. File > Tax registers (?view=transactions&returnPeriodId=01932a10-...)    |
|                                                                           [Tax returns]  [● Export transactions v]   |
+----------------------------------------------------------------------------------------------------------------------+
| Scope: Company [Mersany Trading SAE v]  |  Branch: [Cairo Main Branch v]  |  Matching rows (POST /count): 418        |
+----------------------------------------------------------------------------------------------------------------------+
| Views: [*Tax transactions*] [Aggregated tax report] [Sales VAT register] [Purchase VAT register] [Decision receipts] |
+----------------------------------------------------------------------------------------------------------------------+
| Filters: [TRN: 310-445-892 v] [Type: VAT v] [Dir: All v] [Status: All v] [2026-10-01..2026-10-31] [Party lookup...]  |
+----------------------------------------------------------------------------------------------------------------------+
| Tax-point  | Source doc     | Counterparty & TRN      | Tax & code | Taxable base  | Rate | Tax amount   | Status    |
|------------|----------------|-------------------------|------------|---------------|------|--------------|-----------|
| 2026-10-29 | INV-2026-01942 | Delta Pharma · 402-119  | OUTPUT T1  | EGP 50,000.00 | 14%  | EGP 7,000.00 | [✓ Posted]|
| 2026-10-28 | PINV-2026-0881 | Nile Pack · 518-220     | INPUT  T1  | EGP 15,000.00 | 14%  | EGP 2,100.00 | [⏱ Defer] |
| Keyset cursor navigation:                                                       [Reset to first]  [Next 50 rows ->]  |
+----------------------------------------------------------------------------------------------------------------------+
| Route #85 Preview (/accounting/file/tax-registers/01932a55-...) — Immutable Decision Receipt Inspector:              |
| [🔒 Sealed tax decision — taxFinal: true]  Engine: 1.4.0  |  contentHash: 9f86d081...  |  factSchemaHash: 4b227777... |
| Step 0 Registration: Matched 310-445-892  ->  Step 1 Place of supply: EG  ->  Step 2 Exemption: NONE                 |
| Step 3 Cascading base: NET_LINE EGP 50,000.00 (14%)  ->  Step 4 Evidence: AUTHORITY_VALID  ->  Step 5 Box: BOX_01    |
+----------------------------------------------------------------------------------------------------------------------+
```

---

### 7.5 Mobile `375px` Single-Column Responsive Stack (`#77` & `#84`)

```text
+---------------------------------------+
| [=] المحاسبة · نموذج 10 — أكتوبر 2026 |
| [● تسجيل تقديم الإقرار]   [المزيد v] |
+---------------------------------------+
| الشركة: مرساني للتجارة · EGP          |
| [⚠ محتسب] TRN: 310-445-892           |
| الجاهزية: 4/4 ضوابط مكتملة [✓]        |
+---------------------------------------+
| الصافي المستحق:         EGP 84,350.00 |
| المخرجات: EGP 142,800.00              |
| المدخلات: EGP 46,000.00               |
| الرصيد المرحّل: EGP 12,450.00         |
+---------------------------------------+
| [خانات الإقرار v] (قائمة تبويب مدمجة) |
|---------------------------------------|
| BOX_01_STD_SALES_14 — مبيعات 14%     |
| الوعاء: EGP 1,020,000.00              |
| الضريبة: EGP 142,800.00 · 312 معاملة  |
|                          [عرض السجل]  |
+---------------------------------------+
```

---

## 8. Reconciled Contract Gap List for `P03.T11` (`CG-VAT-01`..`CG-VAT-09`)

Every missing route, request/response DTO, enum, or filter uncovered while reconciling `09_User_Journey_Tax_Return_Filing.md`, `03_tax_engine_and_returns.md`, `03_Tax_Tables.md`, `02_Endpoint_Catalogue.md`, and `02_DTOs.md` is catalogued below for resolution in **`P03.T11`** before `P19.T09` / `P20.T07` / `P21` implementation starts:

| Gap ID | Severity & Blocking Wave | Authoritative LLD Demand vs Current Contract State | Exact Contract Addition Requested in `P03.T11` |
| --- | --- | --- | --- |
| **`CG-VAT-01`** | **High — Blocks `RET-07` live hydration in `P19.T09`** | `09_User_Journey_Tax_Return_Filing.md` (`RET-07`, line 162) & `03_tax_engine_and_returns.md` §8.10 mandate Return-to-Ledger comparison with the 7 closed reconciling item kinds and a zero-unexplained-difference filing gate, and explicitly note *"no route"* exists in `02_Endpoint_Catalogue.md` §5.3. | Add `GET /accounting/tax/returns/:id/ledger-comparison` (`accounting.tax_return.read`, `accounting.tax.returns`, `COMPANY`, `200`) returning `TaxReturnLedgerComparisonDto` (`outputTaxTotal`, `glOutputVatMovement`, `grossOutputVariance`, `explainedOutputVariance`, `unexplainedOutputDiff`, `inputTaxTotal`, `glInputVatMovement`, `grossInputVariance`, `explainedInputVariance`, `unexplainedInputDiff`, `items: TaxReturnReconcilingItemDto[]`) + closed enum `TaxReturnReconcilingItemKind` in `01_Enums.md` (`LATE_DOCUMENT_ORIGINAL_PERIOD`, `UNBILLED_ACCRUAL_NET_OF_TAX`, `CARRY_FORWARD_ADJUSTMENT`, `PRIOR_PERIOD_CORRECTION`, `ANNUAL_RECOVERY_ADJUSTMENT`, `RETURN_ROUNDING`, `POS_BUSINESS_DATE`). |
| **`CG-VAT-02`** | **Medium — `P19.T09` (`RET-09`)** | `POST /accounting/tax/returns/:id/export` (`02_Endpoint_Catalogue.md` §5.3) returns `202` `ExportRunSummaryDto`, but `02_DTOs.md` §6.3 omits its request body DTO (`CSV` vs `XLSX` format selection and optional `generation?: number`). | Declare `ExportTaxReturnDto` (`format?: 'CSV' | 'XLSX'`, `generation?: number`) in `02_DTOs.md` §6.3 so `forbidNonWhitelisted` validation is explicit. |
| **`CG-VAT-03`** | **Medium — `P19.T09` (`RET-10`)** | `acc_tax_return_periods.export_run_id` (`03_Tax_Tables.md` line 1186) pins the official export run filed in `RET-09`, yet `FileTaxReturnDto` (`02_DTOs.md` line 1175) omits `exportRunId?: UUID` and redundantly requires `returnPeriodId: UUID` alongside path `:id`. | Add `exportRunId?: UUID` to `FileTaxReturnDto` (and `AmendTaxReturnDto`) and make `returnPeriodId` either path-derived or strictly validated `=== :id`. |
| **`CG-VAT-04`** | **Low — `P19.T09` DTO Hygiene** | `02_DTOs.md` line 1166 uses one `ComputeTaxReturnDto` (`definitionId`, `registrationId`, `periodStart`, `periodEnd`, `recompute?`) for both `POST /accounting/tax/returns` (`201` open period) and `POST /accounting/tax/returns/:id/compute` (`200` compute `:id`). | Split into `OpenTaxReturnPeriodDto` (`definitionId`, `registrationId`, `periodStart`, `periodEnd`) and `ComputeTaxReturnPeriodDto` (`recompute?: boolean`) in `02_DTOs.md` §6.3. |
| **`CG-VAT-05`** | **Medium — `P19.T09` (`#76` / `#77`)** | `GET /accounting/tax/returns/:id/lines` lacks a `generation?: number` query DTO for inspecting `filedGeneration` vs `amendedGeneration`, and `TaxReturnPeriodSummaryDto` / `DetailDto` / `LineDto` need explicit §13.1 joined summary fields (`definitionCode`, `definitionNameI18n`, `registrationNumber`, `lockedUntil`, `boxLabelI18n`, `boxKind`, `restorationHoldCount`). | Add `TaxReturnLineListQueryDto { generation?: number }` and document the explicit joined fields on `TaxReturnPeriodSummaryDto`, `TaxReturnPeriodDetailDto`, and `TaxReturnLineDto` in `02_DTOs.md` §6.3 & §13.1. |
| **`CG-VAT-06`** | **Medium — `P20.T07` (`#76` / `#77` Tab 6)** | `tax/vat-refund-claims` (`02_Endpoint_Catalogue.md` §5.3) lacks a list filter DTO (`returnPeriodId?`, `registrationId?`, `status?`, `basis?`), lacks `GET /accounting/tax/vat-refund-claims/:id` (`200` + `ETag` + child `withdrawals[]` with `attemptId` & `recordedBy` for maker-checker SoD), and needs server-computed `availableRefundCredit` + `creditCompensationEntries[]`. | Add `VatRefundClaimListQueryDto`, `GET /accounting/tax/vat-refund-claims/:id` (`VatRefundClaimDetailDto` including `withdrawals[]`), and `availableRefundCredit: DecimalString` on `TaxReturnPeriodDetailDto` / refund summary. |
| **`CG-VAT-07`** | **Medium — `P19.T09` (`#84` §12 Reports)** | `02_Endpoint_Catalogue.md` §12 prose names query parameters for `GET /reports/{tax-report,sales-register,purchase-register,withholding-register}`, but `02_DTOs.md` §11.3 omits their TypeScript request & response DTO interfaces. | Declare `TaxReportQueryDto` / `TaxReportResultDto`, `SalesRegisterQueryDto` / `SalesRegisterResultDto`, `PurchaseRegisterQueryDto` / `PurchaseRegisterResultDto`, and `WithholdingRegisterQueryDto` / `WithholdingRegisterResultDto` in `02_DTOs.md` §11.3. |
| **`CG-VAT-08`** | **Medium — `P19.T09` / `P21` (`#77` <-> `#84` Drill-Through)** | `TaxTransactionListQueryDto` (`02_DTOs.md` line 901) omits `boxCode?`, `inputTaxEvidence?`, `restorationHoldPeriodId?`, and `correctionOfPeriodId?` needed for `#77` box drill-through, Tab 5 held-row listing, and Tab 4 pending corrections; `02_DTOs.md` §6.1 omits `SearchManyDto` field allowlists for returns/transactions/receipts; `#85` needs summary display numbers for `fiscalDocumentId`, `journalLineId`, and `partyId`. | Extend `TaxTransactionListQueryDto`, publish the three `SearchDto` allowlists in `02_DTOs.md` §6.1, and include document/entry/party summary refs on `TaxTransactionSummaryDto` / `DetailDto` (aligned with foundation gap `CG-05`). |
| **`CG-VAT-09`** | **Doc Alignment + Shared Foundation Gaps** | `accounting-screen-inventory.md` row `SCR-15` (line 94) cites `UC-TAX-5` (`Manage Withholding Tax`) whereas `03_tax_engine_and_returns.md` §9 assigns VAT returns to **`UC-TAX-4`** (as already corrected in `agy-P03.T10.S4.md`); also reuses foundation gaps `CG-01` (scope header switching), `CG-02` (actor display names for `filedBy` / `recordedBy`), and `CG-10` (explicit `AuthorityReconciliationRunSummaryDto` / `DifferenceDto` in `02_DTOs.md` §7.3). | Update `SCR-15` UC label to `UC-TAX-4` during `P03.T11` inventory reconciliation and close `CG-01`, `CG-02`, `CG-05`, and `CG-10` centrally. |

---

## 9. Lead Review Self-Verification Checklist (`docs/design/README.md` lines 239–258)

- [x] **Every route, permission, feature key, scope target, DTO field, enum, and error code traced verbatim** to `02_Endpoint_Catalogue.md`, `02_DTOs.md`, `01_Enums.md`, `03_Tax_Tables.md`, and `04_Errors_and_Constants.md` (`34` `[P]` + `18` `[S]` endpoints).
- [x] **`[Slice subset — P19.T09]` (`19` `[P]`) and `[Full stage completion — P20.T07 / P21]` (`15` `[P]`) explicitly partitioned** across routes `#76`, `#77`, `#84`, and `#85`.
- [x] **Both statutory reconciliations (`RET-07` Return-to-Ledger with 7 closed reconciling items + `RET-08` Authority Package), Official-Column Export (`RET-09` with `<IdentifierText>` official column headers & SHA-256 verification), and Filing Acknowledgement Reference (`RET-10`–`RET-12` + bank `DIRECT_POSTING` settlement guidance)** specified end-to-end.
- [x] **Four ASCII mockups (`AR-RTL × Light`, `AR-RTL × Dark`, `EN-LTR × Light`, `EN-LTR × Dark`) + `375px` mobile layout** verified with Western digits (`0–9`), LTR islands, logical properties, four outcome hues (zero `brand` status badges), icon + text badges, and at most one `primary` button per screen.
- [x] **Waiting states (`WS-RET-01`..`WS-RET-09`)** record deadline, owner, and safe next action, never implying a resend.
- [x] **3-part error messages** (`Cause + Effect + Safe Next Action + correlationId`) preserve client UUIDv7 `x-idempotency-key` across timeouts.
- [x] **Zero invented routes or client-side statutory math;** all `9` contract gaps (`CG-VAT-01`..`CG-VAT-09`) isolated cleanly for `P03.T11`.

## Contract reconciliation (P03.T11, 1 November 2026)

Reconciles the gaps of this spec against the Endpoint Catalogue and `02_DTOs.md` after `D-770`, `D-771` and `D-772`. The gap list above keeps the original findings; these rulings are final.

| Gap id | Ruling | Where |
| --- | --- | --- |
| `CG-VAT-01` | closed by D-772 | New route `GET /accounting/tax/returns/:id/ledger-comparison` (`TaxReturnLedgerComparisonDto`, box by box) and the closed enum `TaxReturnReconcilingItemKind` (the seven items of module 03 §8.10); a separate read, not a block of the period detail |
| `CG-VAT-02` | closed by D-772 | `POST /accounting/tax/returns/:id/export` takes an empty body; the run records `{ returnPeriodId, generation }` in `acc_export_runs.parameters` |
| `CG-VAT-03` | closed by D-772 | `FileTaxReturnDto` drops `returnPeriodId` (the path) and carries no export run id: `file` pins the latest `COMPLETED` run of the filed generation, or `NULL` |
| `CG-VAT-04` | closed by D-772 | `CreateTaxReturnPeriodDto` (definition, registration, window) for `POST /tax/returns`; `ComputeTaxReturnDto { recompute? }` for `/:id/compute` |
| `CG-VAT-05` | deferred to stage 2 (P20 definition of ready) | `generation?` query on the lines read and joined definition or registration names; the slice reads the latest generation and joins names client-side from the cached lists |
| `CG-VAT-06` | deferred to stage 2 (P20 definition of ready) | `VatRefundClaimListQueryDto`, a detail read with `withdrawals[]`, and `availableRefundCredit` |
| `CG-VAT-07` | deferred to P20 (definition of ready) | Result DTOs of the tax report and the three statutory registers (DTOs §11.3); `#84` shows the tax-transaction register only in the slice |
| `CG-VAT-08` | deferred to P20/P21 (definition of ready) | `TaxTransactionListQueryDto` filters `boxCode?`, `inputTaxEvidence?`, `restorationHoldPeriodId?`, `correctionOfPeriodId?` and the `TaxTransactionSearchDto` allowlist; display refs follow foundation `CG-05`. (`fiscalDocumentId?` and `fiscalDocumentLineId?` were added by D-772 under `CG-DOC-03`.) |
| `CG-VAT-09` | already in the contract | The slice cites `UC-TAX-4` (module 03 §9), not the inventory's `UC-TAX-5`; the foundation parts duplicate `CG-01`, `CG-02`, `CG-05` and `CG-10` |
