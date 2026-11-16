# Accounting Stage-1 Screen Designs — `SCR-09` (Opening Balances — JSON-Lines Mode) & `SCR-11` (Maker-Checker Approval Inbox, Approval Rules & Fiscal Year-End Close Reconciliation)

> **Lead review, 1 November 2026 (P03.T09).** The opening-batch pickers were corrected to their catalogue rows: parties come from `POST /accounting/party-finance-profiles/lookup` (`accounting.party_finance_profile.read`, `accounting.ledger.core`, `COMPANY`), dimension values and asset categories carry `accounting.ledger.core` and `accounting.assets.core`, and a user override is deleted by `/:id`. Every route, permission, feature key and scope below was checked against `docs/LLD/accounting-app/02_API_Contracts/02_Endpoint_Catalogue.md` and `04_Static_Data/05_Permissions_and_Features.md`; what the contracts lack stays in the contract gap list for `P03.T11`.

- **Plan Task:** `P03.T09.S6` (`backend/docs/plans/accounting-app-plan-p03-ux-foundation.md`)
- **Review Gate:** Lead Review (`docs/design/README.md` — Accounting design process)
- **Last Verified Against Contracts:** `2026-11-01`
- **Target Portal:** Tenant Portal (`http://<tenant-host>:5002`, Next.js 16 + Tailwind v4, `@/design-system` barrel only)
- **Screen Inventory Authority:** `frontend/tenant-portal/docs/plans/accounting-screen-inventory.md` — row **`SCR-09`** (`#116`, `#117`; Stage-1 JSON-lines mode `[P: 7]` `opening-balances` (incl. `GET /:id/lines`, `D-771`); multipart file-import mode deferred to `P17.T06` per `D-691`), plan **`SCR-11` / inventory `SCR-38`** (`#7`, `#8`, `#110`, `#111`; `[P: 19]` `approval-requests` + `approval-rules`), and inventory row **`SCR-11`** (`#65`, `#66`; `[P: 19]` `fiscal-years` + `year-end-closings` + `periods` + `user-period-overrides`)
- **Backend Contract Authorities:**
  - `backend/docs/LLD/accounting-app/02_API_Contracts/02_Endpoint_Catalogue.md` (§3 Calendar/Periods/Year-End, §4 Redactions, §10 Approvals, §11 Opening Balances)
  - `backend/docs/LLD/accounting-app/07_Modules/10_MVP/09_integration_and_posting_rules.md` (`UC-INT-4`, Rules 14–15, `VAL-INT-*`)
  - `backend/docs/LLD/accounting-app/07_Modules/10_MVP/08_close_and_reporting.md` (`UC-CLR-1`..`UC-CLR-5`, Rules 5–10, `VAL-CLR-*`)
  - `backend/docs/LLD/accounting-app/07_Modules/10_MVP/01_ledger_foundation.md` (`UC-LFO-2`, `UC-LFO-3`, `UC-LFO-5`, `VAL-LFO-*`)
  - `backend/docs/LLD/accounting-app/04_Static_Data/02_DTOs.md` (§1–§4.3, §11.1–§11.4, §12.1–§12.3, §13.1, §13.2)
  - `backend/docs/LLD/accounting-app/04_Static_Data/01_Enums.md` (§1–§5, §15–§18)
  - `backend/docs/LLD/accounting-app/04_Static_Data/04_Errors_and_Constants.md` (§1–§6.2)
  - `backend/docs/LLD/accounting-app/01_ERD/02_Ledger_Tables.md` (§12 `acc_year_end_closings`), `08_Close_and_Reporting_Tables.md` (§4 `acc_approval_*`), `09_Integration_and_Reliability_Tables.md` (§8 `acc_opening_balance_*`, §10 `acc_idempotency_keys`)
- **Binding UX Foundation Specs (Reused Verbatim — Never Redesigned):**
  - `frontend/tenant-portal/docs/design/specs/accounting-ia.md` (routes `#7`–`#8`, `#65`–`#66`, `#110`–`#111`, `#116`–`#117`; `AccountingScopeBar`; Two-Gate hidden-vs-disabled matrix)
  - `frontend/tenant-portal/docs/design/specs/accounting-home.md` (onboarding readiness deep-link `ACT-13` for opening balances; daily work-queue approval card)
  - `frontend/tenant-portal/docs/design/specs/accounting-status-and-a11y.md` (four outcome hues, non-colour status icons, `<IdentifierText>` `<bdi dir="ltr">`, Western digits `ar-EG-u-nu-latn` / `en-US`, WCAG 2.2 AA)
  - `frontend/tenant-portal/docs/design/specs/accounting-patterns-data.md` (`DataTable`, `AccountingMoneyCell`, `MoneyInput`, `AccountPicker`, `PartyPicker`, `DimensionSetPicker`, `FiscalPeriodPicker`, scaled `10^8` `BigInt` client arithmetic)
  - `frontend/tenant-portal/docs/design/specs/accounting-patterns-workflow.md` (`JournalLineGrid` Variant C, `OpeningBalanceWizard`, `useLocalSheetParser`, `ApprovalPanel`, `ApprovalStepTrack`, `PeriodCloseChecklistPanel`)
  - `frontend/tenant-portal/docs/design/specs/accounting-patterns-documents.md` (`WaitingStateBadge` `WS-01`..`WS-10` Zero-Resend Law, 3-part bilingual error copy, `PermissionGate`, `NotEntitledGate`, `RecoveryModeBanner`, `AmbiguousOutcomePanel`, `ConflictDialog`)

---

## 0. Governance, `ui-ux-pro-max` Design Decisions & Scope Reconciliation

### 0.1 `ui-ux-pro-max` & Tenant Portal Five Laws Applied

Consulted `frontend/.agents/skills/ui-ux-pro-max/SKILL.md`, `frontend-design/SKILL.md`, and `frontend/tenant-portal/docs/design/README.md` before designing layout, density, hierarchy, and interaction states:

1. **Enterprise Ledger Workspace Density & Visual Calm:** `1440px` desktop reference frame (`1152px` net workspace beside the `288px` navigation rail), `44px` (`h-11`) standard control and table row height (`36px` compact dense sub-grids inside opening-balance line tabs; `44px × 44px` minimum touch target on `<768px`), zero decorative gradients, zero arbitrary `text-[Npx]`, zero `font-bold`, and zero `rounded-xl` or larger border radii.
2. **Strict Three-Weight Typography:** Only `400` (`font-normal`), `500` (`font-medium`), and `600` (`font-semibold`). Every `DataTable` body cell renders at `400`; `500` is reserved for column headers, tabs, and field labels; `600` is reserved for `PageHeader` titles and summary KPI totals.
3. **Four Outcome Roles + `ink` Neutral Ramp Only:**
   - `brand`: Strictly at most **one `variant="primary"` button** per screen in `PageHeader` (or active wizard footer step CTA when `PageHeader` holds no competing primary button) plus keyboard focus rings (`focus-visible:ring-2`).
   - `positive`: `VALIDATED` (0 blocking findings), `POSTED`, `APPROVED`, `OPEN` fiscal year/period, balanced (`suspenseAmount = "0.00000000"`).
   - `caution`: `PENDING` approval request, `DRAFT` batch with non-blocking warnings (`nonBlockingFindingsCount > 0`), non-zero `balancingAmount` routed to `OPENING_BALANCE_EQUITY`, `SOFT_CLOSED` period, `CLOSING` fiscal year, second-actor gate required (`D-759`, `D-467`).
   - `negative`: Blocking validation findings (`blockingFindingsCount > 0`), non-zero `suspenseAmount`, `REJECTED` approval request, `EXPIRED` request, `409 PAYLOAD_CHANGED` hash mismatch, irreversible `record-income-tax-filing` warning.
   - `ink` (neutral ramp) + `--swatch-*` category tokens: `DRAFT` (clean), `CANCELLED`, `CLOSED`, `PERMANENTLY_CLOSED`, `FUTURE`, `OpeningBalanceBatchKind` (`OPENING`, `TRADE_ONBOARDING`), `ApprovalDocumentType` chips, `ApproverKind` (`USER`, `ROLE`, `GROUP`). **Document type, batch kind, and step numbers are never mapped to semantic outcome colours.** Every status badge pairs a geometric icon + localized `t.status.*` string (WCAG 1.4.1).
4. **Bilingual Parity (`AR-RTL` / `EN-LTR`) & LTR Technical Islands:**
   - Zero language ternaries (`locale === 'ar' ? ... : ...`) in TSX; every string resolves through `ar` and `en` dictionaries, including `t.status.*` for every enum wire value.
   - Logical CSS properties exclusively (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `text-end`, `border-s`, `border-e`); `pnpm design:rtl` enforces `0` physical directional classes.
   - Every account code, `requestNo` (`APR-2026-000042`), `entryNo`, `DecimalString` (`"125000.00000000"`), `FxRateString` (`"50.125000000000"`), `Sha256Hex` (`payloadHash`, `ruleContentHash`, `uuid`), `ETag`, `ISODate`/`ISO8601`, and `UUIDv7` renders inside `<bdi dir="ltr">` with `tabular-nums` and Western digits (`0–9` via `ar-EG-u-nu-latn` / `en-US`). **`Number()` is never called on a `DecimalString`**; client-side totals use scaled `10^8` `BigInt` helpers from `accounting-patterns-data.md`.
5. **Transport, Idempotency & Concurrency:**
   - Browser requests execute exclusively through `src/lib/api/axiosClient.ts` against canonical Gateway paths `/api/tenant/accounting/v1/<route>` (and `/api/tenant/core/v1/<route>` for Core user/branch lookups). Never raw `fetch`, never controller-relative `/accounting/*`.
   - Every command whose `02_Endpoint_Catalogue.md` `Idempotency` column is `x-idempotency-key` or `x-idempotency-key (7 d)` generates one fresh `UUIDv7` via `generateUUIDv7()` (`src/lib/uuid.ts` — **never `crypto.randomUUID()`**) per user intent, persisted in memory (and in `sessionStorage` keyed by `[companyId, route, intentKey]` for `7 d` opening-balance creation) until a definitive HTTP status returns.
   - Every command whose `Concurrency` column is `If-Match` sends `If-Match: "<version>"` from the latest `ETag` / `version` read.

### 0.2 Scope & Row-ID Collision Reconciliation (`SCR-09`, Plan `SCR-11` / Inventory `SCR-38`, and Inventory Row `SCR-11`)

Between `accounting-app-plan-p03-ux-foundation.md` (`P03.T09.S6`) / `agy-P03.T09.S6.md` and `frontend/tenant-portal/docs/plans/accounting-screen-inventory.md` (`P03.T03`), row ID `SCR-11` was reassigned when the inventory split Maker-Checker Approvals into `SCR-38` and assigned `SCR-11` to Fiscal Years, Period State Machine & Year-End Close (`#65`, `#66`, marked `pending (P03.T09.S6)`), while sibling `P03.T09.S2` (`out/accounting-stage1-chart-calendar.md` §0.2) explicitly deferred `#65`/`#66` Year-End Closing to `P03.T09.S6`.

To guarantee **zero orphaned Stage-1 routes** and complete coverage of both the `P03.T09.S6` brief's `Sources` and `accounting-screen-inventory.md`, this document specifies **all three surfaces** cleanly and logs the row-ID collision as `CG-S6-01` for `P03.T11`:

| Design Section | Plan / Brief ID | Inventory Row ID | Canonical Next.js Routes | Primary Owned Endpoints (`[P]`) | Deferred / Shared Boundaries |
| --- | --- | --- | --- | --- | --- |
| **Section 1** | **`SCR-09`** (JSON-lines mode) | **`SCR-09`** (Stage-1 slice) | `#116` `/accounting/setup/opening-imports`<br>`#117` `/accounting/setup/opening-imports/[id]` | **`[P: 7]`** — `opening-balances` (`GET`, `GET /:id`, `GET /:id/lines`, `POST`, `POST /:id/validate`, `POST /:id/post`, `POST /:id/cancel`) | **Deferred to `P17.T06` (`D-691`):** multipart `imports` (`8` routes) & `migration-presets` (`2` routes) — hidden from Stage-1 UI; client-side TSV/CSV/XLSX clipboard/file parsing (`useLocalSheetParser`) feeds JSON-lines `POST /opening-balances` directly with zero file upload |
| **Section 2** | **`SCR-11`** (Approval Inbox & Rules) | **`SCR-38`** | `#7` `/accounting/inbox/approvals`<br>`#8` `/accounting/inbox/approvals/[id]`<br>`#110` `/accounting/setup/approval-rules`<br>`#111` `/accounting/setup/approval-rules/[id]` | **`[P: 19]`** — `approval-requests` (`7` routes) + `approval-rules` (`12` routes incl. nested `/steps` & `/steps/:stepNo`) | **`[S]` Cross-route handoff:** `PERSONAL_DATA_REDACTION` executes final approval via `POST /accounting/ledger/redactions/:approvalRequestId/approve` (`SCR-17` `[P]`) when the actor holds `accounting.ledger_redaction.approve` |
| **Section 3** | Companion from `P03.T09.S2` | **`SCR-11`** (`pending P03.T09.S6`) | `#65` `/accounting/close/periods`<br>`#66` `/accounting/close/periods/[id]` | **`[P: 19]`** — `fiscal-years` (`7` routes incl. `/close`, `/rerun-requests`, `/record-income-tax-filing`) + `year-end-closings` (`2` routes) + `periods` (`7` routes) + `user-period-overrides` (`3` routes) | Reuses shared `FiscalYearsPanelView`, `PeriodStateMatrixView`, `UserPeriodOverridesPanelView`, and `PeriodReopenLogPanelView` defined in `P03.T09.S2` (`src/features/accounting/calendars/`), adding the Year-End Closing & Tax-Filing Marker suite |

### 0.3 Planned Component & Hook File Split (`< 300` Lines Rule)

Every `.tsx` view holds pure markup + logical Tailwind classes under ~300 lines; state, effects, validators, and API calls live in `hooks/use<Name>.ts`:

- **`SCR-09` (`src/features/accounting/opening-balances/`)**:
  - `OpeningBalancesHubView.tsx` + `hooks/useOpeningBalancesHub.ts` (`#116` batch registry `DataTable`, readiness callouts, `OPENING` vs `TRADE_ONBOARDING` launcher)
  - `components/OpeningBalanceWizardDrawer.tsx` + `hooks/useOpeningBalanceWizard.ts` (4-step `OpeningBalanceWizard` shell, `BigInt` live balance bar, `useLocalSheetParser` local paste/sheet grid mapper)
  - `components/OpeningLedgerLinesStep.tsx` + `hooks/useOpeningLedgerLines.ts` (`balances[]` `JournalLineGrid` Variant C, control-account guard, greenfield empty-batch toggle `D-666`)
  - `components/OpeningSubledgersStep.tsx` + `hooks/useOpeningSubledgers.ts` (`openItems[]` + `sourceDocument` `D-759`, `instruments[]`, `assets[]`, `taxPools[]`)
  - `components/OpeningTradeCutOffStep.tsx` + `hooks/useOpeningTradeCutOff.ts` (`inventoryLayers[]`, `inTransit[]`, `streamHeads[]`, `deviceChainHeads[]` for Trade-entitled / `TRADE_ONBOARDING` batches `D-676`)
  - `OpeningBalanceBatchDetailView.tsx` + `hooks/useOpeningBalanceBatchDetail.ts` (`#117` summary KPIs, `validationFindings` inspector, `Validate`, `Post` with `D-759` second-actor gate, `Cancel` `ReasonDialog`, `PostingReceiptCard`)
- **Plan `SCR-11` / Inventory `SCR-38` (`src/features/accounting/approvals/`)**:
  - `ApprovalInboxView.tsx` + `hooks/useApprovalInbox.ts` (`#7` `FilterBar`, quick presets, `DataTable`, advanced `POST /search` drawer)
  - `ApprovalRequestDetailView.tsx` + `hooks/useApprovalRequestDetail.ts` (`#8` 2-pane split: target snapshot/summary & `requestBody` inspector + `ApprovalPanel`, `ApprovalStepTrack`, `ApprovalActionsTimeline`, `PERSONAL_DATA_REDACTION` handoff)
  - `ApprovalRulesListView.tsx` + `hooks/useApprovalRulesList.ts` (`#110` rule table, `BulkActionBar` `POST /bulk` & `PATCH /bulk-update`, built-in mandatory defaults reference card `D-352`)
  - `components/ApprovalRuleFormDrawer.tsx` + `hooks/useApprovalRuleForm.ts` (`CreateApprovalRuleDto` / `PATCH`, `ConditionRow[]` builder over `APPROVAL` registry keys, initial `steps[]` ladder)
  - `ApprovalRuleDetailView.tsx` + `hooks/useApprovalRuleDetail.ts` (`#111` rule header, `ApprovalRuleStepsEditor` over `GET/POST /steps` and `PATCH/DELETE /steps/:stepNo`, restore/delete)
- **Inventory Row `SCR-11` (`src/features/accounting/close-periods/`)**:
  - `ClosePeriodsWorkspaceView.tsx` + `hooks/useClosePeriodsWorkspace.ts` (`#65` mounts shared `PeriodStateMatrixView`, `FiscalYearsPanelView`, `UserPeriodOverridesPanelView`, `PeriodReopenLogPanelView` + `YearEndClosingsTabView`)
  - `PeriodCloseDetailView.tsx` + `hooks/usePeriodCloseDetail.ts` (`#66` single period module gates, linked close-instance pointer, overrides & reopen history)
  - `components/YearEndCloseModal.tsx` + `hooks/useYearEndClose.ts` (`CloseFiscalYearDto` first-run & approved `YEAR_CLOSE_RERUN` execution, `409 RERUN_NOTHING_TO_CLOSE` abandonment refresh)
  - `components/YearCloseRerunRequestDialog.tsx` + `hooks/useYearCloseRerunRequest.ts` (`RequestYearCloseRerunDto` -> `202` `WaitingStateBadge`)
  - `components/RecordIncomeTaxFilingDialog.tsx` + `hooks/useRecordIncomeTaxFiling.ts` (`RecordIncomeTaxFilingDto` irreversible `FILED` pool freeze confirmation)

---

## 1. Screen `SCR-09` — Opening Balances (Stage-1 JSON-Lines Mode Only)

- **Routes:**
  - `#116` `/accounting/setup/opening-imports` — Opening Balance Batches Hub & JSON-Lines Wizard Launcher
  - `#117` `/accounting/setup/opening-imports/[id]` — Opening Balance Batch Detail, Validation Findings & Posting Screen
- **Navigation Section (`accounting-ia.md` §1):** `Setup` (`الإعدادات والتهيئة`) -> `Opening Balances` (`الأرصدة الافتتاحية`) (in Stage 1; renamed to `Opening Balances & Imports` in `P17.T06` once multipart file imports ship per `D-691`).
- **Two-Gate Navigation Visibility (`accounting-ia.md` §3):**
  - Gate 1 (Feature): `accounting.ledger.core` (if absent -> `NotEntitledGate`, nav link hidden).
  - Gate 2 (Permission): `accounting.import.read` (if absent -> nav link hidden; direct URL visit renders `PermissionGate`).
  - Action-level gates: `Create Batch` / `Validate` / `Cancel` require `accounting.import.run` (**hidden** without it); `Post Batch` requires `accounting.journal_draft.post` (**disabled with lock tooltip** when user holds `accounting.import.run` or `accounting.import.read` without `accounting.journal_draft.post`, or when `D-759` second-actor rule blocks the creator from posting).
- **Stage-1 Scope Rule (`D-691`):** Stage 1 implements **JSON-lines mode exclusively** (`opening-balances` `[P: 7]`). No multipart file upload (`POST /accounting/imports`), no server dry-run job (`POST /imports/:id/dry-run`), and no `migration-presets` routes are called or rendered. Accountants can still paste spreadsheet ranges or load a local `.csv`/`.tsv`/`.xlsx` file **100% in browser memory** via `useLocalSheetParser` (`accounting-patterns-workflow.md` §3.2) to populate the JSON-lines grid before submitting `CreateOpeningBalanceBatchDto` to `POST /api/tenant/accounting/v1/opening-balances`.

### 1.1 Shell, Layout & Reused Approved Patterns

#### A. `#116` Hub (`/accounting/setup/opening-imports`)
1. **`AccountingScopeBar`:** Pinned to active `Company` (`Scope target: COMPANY`). Switching company reloads the company profile (`accountingActivatedOn`, `functionalCurrencyCode`, `chartId`) and batch list. Branch switcher is informational/disabled at header level because opening batches are strictly `COMPANY`-scoped (`uq_acc_opening_balance_batches_company_kind_live`: at most **one live (`DRAFT` | `VALIDATED` | `POSTED`) batch per `(companyId, kind)`**).
2. **`PageHeader`:**
   - Title: `الأرصدة الافتتاحية` / `Opening Balances`.
   - Subtitle: Displays company activation cut-off date `<bdi dir="ltr">{accountingActivatedOn}</bdi>` and functional currency `<bdi dir="ltr">{functionalCurrencyCode}</bdi>`.
   - Single `variant="primary"` CTA:
     - `+ دفعة أرصدة افتتاحية` / `+ New Opening Batch` (`kind = 'OPENING'`), enabled only when no live `OPENING` batch exists and `accounting.import.run` is held. If a live `OPENING` batch exists (`DRAFT`, `VALIDATED`, or `POSTED`), primary CTA changes to `فتح الدفعة الحالية` / `Open Active Batch` linking to `#117`.
   - Secondary `variant="outline"` CTA (shown **only** when tenant has feature `accounting.integration.trade_posting`, company's `OPENING` batch is `POSTED` with `tradePosting === false`, and no live `TRADE_ONBOARDING` batch exists, per `D-676`): `+ دفعة تهيئة المخزون ونقاط البيع` / `+ New Trade Onboarding Batch` (`kind = 'TRADE_ONBOARDING'`).
3. **Readiness & Constraint Strip (`StatStrip` — 3 compact cards):**
   - Card 1: `دفعة التأسيس (OPENING)` / `Activation Batch (OPENING)` — status badge (`غير منشأة` / `Not started` | `DRAFT` | `VALIDATED` | `POSTED`), `asOfDate`, `journalEntryId` link.
   - Card 2: `صافي التسوية لحساب حقوق الملكية الافتتاحية` / `Opening Equity Balancing Residue` — `<AccountingMoneyCell>` showing `balancingAmount` (`OPENING_BALANCE_EQUITY` automatic plug when `totalDebit ≠ totalCredit` and no `SUSPENSE` remains).
   - Card 3: `حالة ترحيل التجارة والمخزون` / `Trade Cut-Off Baseline` — `مفعّل مع التأسيس` / `Seeded at Activation` (`tradePosting = true`), `بانتظار دفعة تهيئة التجارة` / `Awaiting Trade Onboarding` (`D-676`), or `غير مشترك` / `Not Entitled` (neutral badge when `accounting.integration.trade_posting` is absent).
4. **Batches Registry (`DataTable` + `FilterBar`):**
   - Filters mapped to `OpeningBalanceBatchListQueryDto`: `status` (`DRAFT`, `VALIDATED`, `POSTED`, `CANCELLED`), `asOfDate` (`ISODate`), sort (`createdAt:desc` default).
   - Columns: `kind` (`t.status.openingBatchKind.*`), `asOfDate` (`<bdi dir="ltr">`), `status` (icon + `t.status.openingBatchStatus.*`), `totalDebit`, `totalCredit`, `balancingAmount`, `suspenseAmount` (highlighted `negative` if `!== "0.00000000"`), `blockingFindingsCount` / `nonBlockingFindingsCount`, sub-item counts (`openItemsCount`, `instrumentsCount`, `assetsCount`), `version` (`v{n}`), row action `عرض` / `View` -> `#117`.
5. **4-Step JSON-Lines Creation Wizard (`OpeningBalanceWizard` full-height sheet/drawer on `#116`):**
   - Reuses `OpeningBalanceWizard`, `JournalLineGrid` (Variant C), and `useLocalSheetParser` from `accounting-patterns-workflow.md` §§1, 3:
     - **Step 1 — `إعداد الدفعة وتاريخ القطع` / `Batch Kind & Cut-Off`:** Selects `kind` (`OPENING` locks `asOfDate = companyProfile.accountingActivatedOn` read-only; `TRADE_ONBOARDING` selects `asOfDate > accountingActivatedOn` inside an `OPEN` `GL` `NORMAL` period). Includes explicit **"شركة جديدة بدون أرصدة سابقة (دفعة فارغة)" / "Greenfield company with zero prior balances (Empty batch)"** toggle (`D-666`: sends `balances: []` with all optional arrays omitted, skipping Steps 2–3 straight to Step 4 Review).
     - **Step 2 — `أرصدة الأستاذ العام` / `GL Account Balances` (`OPENING` only):** `JournalLineGrid` Variant C (`balances[]`, `0..50,000` rows) + **"لصق من جدول / قراءة ملف محلي" / "Paste from Sheet / Parse Local CSV·TSV"** button (`useLocalSheetParser`, client-only, zero network upload). Control accounts (`controlAccountFor !== null`: `AR`, `AP`, `INVENTORY` where governed by subledger rules) show inline guidance: AR/AP control balances must match `openItems[]` subledger rows, and `SUSPENSE` role lines trigger an amber warning that `suspenseAmount` must be `"0"` before posting. Sticky bottom `BigInt` (`10^8` scale) live bar shows `إجمالي المدين` (`totalDebit`), `إجمالي الدائن` (`totalCredit`), and `رصيد حساب حقوق الملكية الافتتاحية التلقائي` (`projectedBalancingAmount = |totalDebit - totalCredit|`).
     - **Step 3 — `الأرصدة التحليلية والمخزون وسلاسل الترقيم` / `Subledgers, Assets, Tax Pools & Trade Heads`:** Accordions/tabs tailored by `kind` and entitlements:
       - For `OPENING`: (a) `ذمم العملاء والموردين المفتوحة` / `AR & AP Open Items` (`openItems[]`, including optional expandable `sourceDocument` drawer on `side = 'AR'` for legacy invoices that may receive post-go-live credit/debit notes — displays `D-759` banner: *"إدراج مستند أصلي لفاتورة عميل سابقة يتطلب مستخدماً ثانياً مستقلاً عند الترحيل"* / *"Including an AR legacy source document requires an independent second user to post"*), (b) `الأوراق التجارية والشيكات` / `Negotiable Instruments` (`instruments[]` — shown when treasury/cheques accounts exist), (c) `الأصول الثابتة الافتتاحية` / `Fixed Assets` (`assets[]` with `BOOK` & optional `TAX` book rows), (d) `مجمعات الإهلاك الضريبي` / `Pooled Tax Depreciation` (`taxPools[]`, `POOLED` pools only), and — when tenant holds `accounting.integration.trade_posting` — (e) `طبقات تكلفة المخزون والبضاعة بالطريق ورؤوس السلاسل` / `Inventory Layers, In-Transit & Stream/Device Heads` (`inventoryLayers[]`, `inTransit[]`, `streamHeads[]`, `deviceChainHeads[]`).
       - For `TRADE_ONBOARDING` (`D-676`): **Only** `inventoryLayers[]`, `inTransit[]`, `streamHeads[]`, and `deviceChainHeads[]` (with helper note that `deviceChainHeads` are always stated **as at the activation cut-off**, whereas `inventoryLayers`, `inTransit`, and `streamHeads` are at `asOfDate`). `balances` is sent as `[]` and all other arrays are omitted.
     - **Step 4 — `المراجعة والحفظ كمسودة` / `Review & Create Draft Batch`:** Pre-flight summary of row counts, serialized payload byte-caps check (`streamHeads <= 64 KiB`, `deviceChainHeads <= 256 KiB`, `sourceDocument.lines <= 8 KiB`), `BigInt` reconciliation check (`Σ inventoryLayers == net INVENTORY`, `Σ inTransit == net INVENTORY_IN_TRANSIT`), and submit button `إنشاء دفعة المسودة` / `Create Draft Batch` (`POST /api/tenant/accounting/v1/opening-balances` with `x-idempotency-key` cached `7 d` -> navigates to `#117` on `201`).

#### B. `#117` Batch Detail (`/accounting/setup/opening-imports/[id]`)
1. **`PageHeader`:**
   - Breadcrumb: `الأرصدة الافتتاحية` / `Opening Balances` (`#116`) -> `<bdi dir="ltr">{kind} · {asOfDate}</bdi>`.
   - Status badge (`DRAFT` | `VALIDATED` | `POSTED` | `CANCELLED`) + `ETag` version chip `<bdi dir="ltr">v{version}</bdi>`.
   - Contextual Primary CTA (strictly **at most one** `variant="primary"`):
     - When `status === 'DRAFT'`: `التحقق من الدفعة` / `Validate Batch` (`POST /:id/validate`, requires `accounting.import.run`).
     - When `status === 'VALIDATED'` and `blockingFindingsCount === 0` and `suspenseAmount === "0.00000000"`: `ترحيل الأرصدة الافتتاحية` / `Post Opening Batch` (`POST /:id/post`, requires `accounting.journal_draft.post`; disabled with `D-759` second-actor explanation if the batch contains AR `sourceDocument` rows and `currentUser.id === createdBy` or validator).
     - When `status === 'VALIDATED'` and (`blockingFindingsCount > 0` or `suspenseAmount !== "0.00000000"`): Primary button disabled; `إلغاء وإعادة الإنشاء بعد التصحيح` / `Cancel & Recreate Corrected Batch` (`POST /:id/cancel`) promoted to `variant="outline"` (because Catalogue §11 has no `PATCH /opening-balances/:id` — see `CG-S6-05`).
     - When `status === 'POSTED'` and `journalEntryId !== null`: Secondary link `عرض القيد الافتتاحي` / `View Opening Journal Entry` -> `/accounting/journals/entries/{journalEntryId}`.
   - Secondary Action (`DRAFT` or `VALIDATED` with `accounting.import.run`): `إلغاء الدفعة…` / `Cancel Batch…` -> opens `ReasonDialog` (`CancelOpeningBalanceBatchDto.reason`, `10..500` chars).
2. **KPI Summary Cards (`4` cards):**
   - `إجمالي المدين` / `Total Debit` (`totalDebit`, `currencyCode`)
   - `إجمالي الدائن` / `Total Credit` (`totalCredit`, `currencyCode`)
   - `رصيد حقوق الملكية الافتتاحية` / `Balancing Equity Plug` (`balancingAmount`) + `الرصيد المعلق` / `Suspense Amount` (`suspenseAmount` — `negative` alert if non-zero)
   - `نتائج الفحص والأقسام الفرعية` / `Validation & Subledger Counts` (`blockingFindingsCount` blocking, `nonBlockingFindingsCount` warnings; `openItemsCount` open items, `instrumentsCount` instruments, `assetsCount` assets, `costLayersCount` cost layers).
3. **Detail Panels (3 Tabs):**
   - **Tab 1 — `نتائج التحقق والجاهزية` / `Validation Findings & Readiness`:** Renders structured `validationFindings` (`<= 64 KiB` JSONB from `OpeningBalanceBatchDetailDto`) grouped into **Blocking Findings (`negative`)** and **Non-Blocking Warnings (`caution`)** with account/party/item code chips in `<bdi dir="ltr">`. Before first validation (`DRAFT`), shows a prompt to run `POST /:id/validate`. Line-level readback: `OpeningBalanceBatchDetailDto` returns counts, heads, and `validationFindings`, not the raw `balances[]`/`openItems[]` rows; the rows are read with `GET /accounting/opening-balances/:id/lines` (paginated `OpeningBalanceBatchLineDetailDto`, each with its `payload`), so a batch created in an earlier session can be reviewed before it is posted (`D-771`, `CG-S6-05`). No local snapshot preview is needed.
   - **Tab 2 — `رؤوس سلاسل المخزون ونقاط البيع` / `Trade Stream & POS Device Heads`:** Renders `tradePosting` boolean status, `streamHeads` (`Record<UUID, string>` — `fulfillmentNodeId` -> `sequenceNo`) and `deviceChainHeads` (`Record<string, { chainCounter: string; uuid: string }>`) in compact read-only LTR-island tables.
   - **Tab 3 — `إيصال الترحيل والأثر المحاسبي` / `Posting Receipt & Audit Metadata`:** Displays `periodId`, `journalEntryId` (or explicit `"لا يوجد قيد محاسبي — دفعة تأسيس فارغة (D-666)"` / `"لا يوجد قيد محاسبي — دفعة تهيئة التجارة (D-676)"` when `journalEntryId === null` on `POSTED`), `importJobId` (`null` in Stage-1 JSON-lines mode), `createdAt`, `postedAt`, `postedBy`, `cancelledReason`, and — immediately after `POST /:id/post` returns a non-null `posting` (`PostingReceiptDto`) — chain proof metadata (`entryNo`, `chainSeq`, `entryHash` in `<bdi dir="ltr">`).

### 1.2 Complete DTO & Projection Field Mapping (`SCR-09`)

#### A. List Query (`OpeningBalanceBatchListQueryDto` — `02_DTOs.md` §12.1)

| UI Control | DTO Field | Wire Type & Constraints | Notes |
| --- | --- | --- | --- |
| Status filter | `status` | `OpeningBalanceBatchStatus?` (`'DRAFT' \| 'VALIDATED' \| 'POSTED' \| 'CANCELLED'`) | Optional exact filter |
| Cut-Off Date filter | `asOfDate` | `ISODate?` (`YYYY-MM-DD`) | Optional date filter |
| Pagination & Sort | `page`, `limit`, `sort` | `number?` (`1..`), `number?` (`1..100`, default `25`), `string[]?` | Inherited from `FindManyDto` |

#### B. Create Payload (`CreateOpeningBalanceBatchDto` — `02_DTOs.md` §12.2)

| Wizard Step / Field | DTO Member Path | Wire Type & Validation Rules | UI Control & Contract Guard |
| --- | --- | --- | --- |
| Batch Kind | `kind` | `OpeningBalanceBatchKind?` (`'OPENING' \| 'TRADE_ONBOARDING'`, default `'OPENING'`) | Radio card in Step 1; `'TRADE_ONBOARDING'` requires feature `accounting.integration.trade_posting` and posted `OPENING` batch with `tradePosting === false` (`D-676`) |
| Cut-Off Date | `asOfDate` | `ISODate` (`YYYY-MM-DD`) | Read-only `companyProfile.accountingActivatedOn` for `'OPENING'`; `DatePicker` (`> accountingActivatedOn` in an `OPEN` `GL` `NORMAL` period) for `'TRADE_ONBOARDING'` |
| GL Balance Lines | `balances` | `OpeningBalanceLineInput[]` (`0..50,000` — `MAX_OPENING_BALANCE_LINES`) | `[]` on greenfield empty `'OPENING'` batch (`D-666`) and on `'TRADE_ONBOARDING'` (`D-676`) |
| ↳ Account | `balances[].accountId` | `UUID` | `AccountPicker` (`POST /accounting/accounts/lookup`, postable active leaf accounts; blocks AR/AP control accounts from raw `balances[]` without matching subledger) |
| ↳ Side | `balances[].direction` | `DebitCredit` (`'DEBIT' \| 'CREDIT'`) | Segmented toggle (`مدين` / `Debit`, `دائن` / `Credit`) |
| ↳ Functional Amount | `balances[].amountFunctional` | `DecimalString` (`> 0`, scale `<= 8`) | `MoneyInput` (`<bdi dir="ltr">`, `BigInt` scaled `10^8`, never `Number()`) |
| ↳ Txn Currency | `balances[].currencyCode` | `CurrencyCode?` (`ISO 4217`) | Currency picker; omit when equal to company functional currency unless foreign monetary account |
| ↳ Txn Amount | `balances[].amountTxn` | `DecimalString?` (`> 0`, scale `<= 8`) | Enabled/required when `currencyCode` differs from `functionalCurrencyCode` |
| ↳ Dimensions | `balances[].dimensions` | `DimensionSetInput?` | `DimensionSetPicker`; enforces account's mandatory `requiresDimensionTypeCodes` |
| AR/AP Open Items | `openItems` | `OpeningOpenItemInput[]?` (`0..50,000`) | Omitted on `'TRADE_ONBOARDING'` and empty `'OPENING'` batch |
| ↳ Subledger Side | `openItems[].side` | `SubledgerSide` (`'AR' \| 'AP'`) | Segmented toggle (`عملاء AR` / `موردون AP`) |
| ↳ Counterparty | `openItems[].partyId` | `UUID` | `PartyPicker` (`POST /accounting/party-finance-profiles/lookup`) |
| ↳ Document No. | `openItems[].documentNo` | `string` (`1..40` chars) | LTR text input |
| ↳ Document Date | `openItems[].documentDate` | `ISODate` (`<= asOfDate`) | Date input; client-checked `<= asOfDate` |
| ↳ Due Date | `openItems[].dueDate` | `ISODate` | Date input |
| ↳ Currency | `openItems[].currencyCode` | `CurrencyCode` | Currency selector |
| ↳ Original Amount | `openItems[].originalAmount` | `DecimalString` (`> 0`, scale `<= 8`) | `MoneyInput` |
| ↳ Prior Settled | `openItems[].settledAmount` | `DecimalString?` (`>= 0`, `< originalAmount`) | Optional `MoneyInput` (defaults `"0"` on server) |
| ↳ Entry FX Rate | `openItems[].entryFxRate` | `FxRateString?` (`> 0`, scale `<= 12`) | Required when `currencyCode !== functionalCurrencyCode` |
| ↳ Legacy AR Original | `openItems[].sourceDocument` | `OpeningSourceDocumentInput?` (`side === 'AR'` only) | Optional drawer: `{ documentKind: 'COMMERCIAL' \| 'TAX_INVOICE' \| 'EXPORT_INVOICE', documentDatetimeUtc: ISO8601, grossTotal: DecimalString (>= originalAmount), priorCreditedTotal: DecimalString (0..grossTotal), authorityUuid?: string (<=64), lines?: OpeningSourceLineInput[] (1..1000, <=8 KiB: { lineNo, description (1..500), itemRef?: { itemId?: UUID, externalCode?: string }, uom?: string, quantity: DecimalString, unitPrice: DecimalString }) }`. Triggers `D-759` two-actor post rule |
| Negotiable Instruments | `instruments` | `OpeningInstrumentInput[]?` (`0..50,000`) | `{ kind: NegotiableInstrumentKind, instrumentNo: string (<=40), bankCode: string, partyId: UUID, dueDate: ISODate, amount: DecimalString (>0), currencyCode: CurrencyCode }` |
| Opening Fixed Assets | `assets` | `OpeningAssetInput[]?` (`0..50,000`) | `{ categoryId: UUID, nameI18n: I18nText, branchId?: UUID, acquisitionDate: ISODate (<=asOfDate), depreciationStartDate?: ISODate (<=asOfDate), cost: DecimalString (>0), salvageValue?: DecimalString (<cost), quantity?: DecimalString (default "1.00000000"), serialNo?: string (<=64), books: Array<{ bookCode: 'BOOK' \| 'TAX', openingAccumulatedAmount: DecimalString (>=0), openingTaxRecoveredAmount?: DecimalString (>=0, TAX only) }> (1..2) }` |
| Pooled Tax Pools | `taxPools` | `OpeningTaxPoolInput[]?` (`0..50,000`) | `{ poolCode: string (<=32, POOLED method only; INDIVIDUAL refused 400), openingBalance: DecimalString (>=0) }` |
| Movement Stream Heads | `streamHeads` | `OpeningStreamHeadInput[]?` (`0..50,000`, `<= 64 KiB` JSON) | `{ fulfillmentNodeId: UUID, sequenceNo: string (positive integer string) }` — Trade-entitled only |
| POS Device Chain Heads | `deviceChainHeads` | `OpeningDeviceChainHeadInput[]?` (`0..50,000`, `<= 256 KiB` JSON) | `{ deviceSerial: string (1..64), chainCounter: string (positive integer string at activation cut-off), uuid: string (/^[0-9A-Fa-f]{64}$/) }` — Trade-entitled only |
| Inventory Cost Layers | `inventoryLayers` | `OpeningInventoryLayerInput[]?` (`0..50,000`) | `{ fulfillmentNodeId: UUID, itemId: UUID, itemCode: string (<=64), quantity: DecimalString (!= 0; negative only with unitCost="0" deficit row), unitCost: DecimalString (>=0) }` — `Σ(qty × unitCost)` must match net `INVENTORY` balance (`D-676`) |
| Stock In Transit | `inTransit` | `OpeningInTransitInput[]?` (`0..50,000`) | `{ fulfillmentNodeId: UUID, outboundMovementId: UUID, itemId: UUID, quantity: DecimalString (>0), unitCost: DecimalString (>=0) }` — `Σ(qty × unitCost)` must match net `INVENTORY_IN_TRANSIT` balance (`D-676`) |

#### C. Cancel Payload & Read DTOs (`CancelOpeningBalanceBatchDto`, `OpeningBalanceBatchSummaryDto`, `OpeningBalanceBatchDetailDto` — `02_DTOs.md` §12.2, §13.1)

- **`CancelOpeningBalanceBatchDto`:** `{ reason: string }` — mandatory trimmed length `10..500` characters (`VAL-INT` / `02_Endpoint_Catalogue.md` §11 line 1107).
- **`OpeningBalanceBatchSummaryDto`:** `id: UUID`, `kind: OpeningBalanceBatchKind`, `status: OpeningBalanceBatchStatus`, `asOfDate: ISODate`, `totalDebit: DecimalString`, `totalCredit: DecimalString`, `balancingAmount: DecimalString`, `suspenseAmount: DecimalString`, `blockingFindingsCount: number`, `nonBlockingFindingsCount: number`, `openItemsCount: number`, `instrumentsCount: number`, `assetsCount: number`, `cancelledReason: string | null`, `version: number`.
- **`OpeningBalanceBatchDetailDto extends OpeningBalanceBatchSummaryDto`:** adds `periodId: UUID`, `currencyCode: CurrencyCode`, `journalEntryId: UUID | null`, `importJobId: UUID | null`, `costLayersCount: number`, `streamHeads: Record<UUID, string>`, `deviceChainHeads: Record<string, { chainCounter: string; uuid: string }>`, `tradePosting: boolean`, `validationFindings: Record<string, unknown>`, `postedAt: ISO8601 | null`, `postedBy: UUID | null`, `createdAt: ISO8601`. On `POST /:id/post`, response carries `OpeningBalanceBatchSummaryDto & { posting: PostingReceiptDto | null }`.

### 1.3 Verbatim Endpoint & Action Matrix (`SCR-09` — `[P: 7]` + `[S]` Lookups)

Browser path = `/api/tenant/accounting/v1` + `Path`. Every cell below is copied verbatim from `02_Endpoint_Catalogue.md` §11 (lines 1102–1107):

| UI Action | Role | Method | Catalogue Path | Permission | Feature key | Scope target | Idempotency | Concurrency | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Load batch list / filters | `[P]` | `GET` | `/accounting/opening-balances` | `accounting.import.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` (`PaginatedResult<OpeningBalanceBatchSummaryDto>`) |
| Open `#117` detail & findings | `[P]` | `GET` | `/accounting/opening-balances/:id` | `accounting.import.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` + `ETag` (`OpeningBalanceBatchDetailDto`) |
| `#117` Batch lines (read-back before post) | `[P]` | `GET` | `/accounting/opening-balances/:id/lines` | `accounting.import.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` (paginated `OpeningBalanceBatchLineDetailDto` rows with their `payload`, ordered by `(line_kind, line_no)`, filtered by `OpeningBalanceBatchLineListQueryDto`; `D-771`) |
| Wizard Step 4 "Create Draft Batch" | `[P]` | `POST` | `/accounting/opening-balances` | `accounting.import.run` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key (7 d)` | `none` | `201` + `Location` (`OpeningBalanceBatchSummaryDto` in `DRAFT`) |
| `#117` "Validate Batch" | `[P]` | `POST` | `/accounting/opening-balances/:id/validate` | `accounting.import.run` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` + `Location` (`OpeningBalanceBatchSummaryDto`; refetches `GET /:id` for `validationFindings`) |
| `#117` "Post Opening Batch" | `[P]` | `POST` | `/accounting/opening-balances/:id/post` | `accounting.journal_draft.post` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` + chain headers + `Location` (`OpeningBalanceBatchSummaryDto` + `data.posting: PostingReceiptDto \| null`) |
| `#117` "Cancel Batch" (`ReasonDialog`) | `[P]` | `POST` | `/accounting/opening-balances/:id/cancel` | `accounting.import.run` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` + `Location` (`OpeningBalanceBatchSummaryDto` in `CANCELLED`) |
| Read activation date & currency | `[S]` | `GET` | `/accounting/company-profile` | `accounting.profile.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` + `ETag` |
| Account picker in Step 2 | `[S]` | `POST` | `/accounting/accounts/lookup` | `accounting.account.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | `none` | `none` | `200` |
| Party picker in Step 3 (`openItems`, `instruments`) | `[S]` | `POST` | `/accounting/party-finance-profiles/lookup` | `accounting.party_finance_profile.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` |
| Dimension picker in Step 2 | `[S]` | `GET` | `/accounting/dimension-values` | `accounting.dimension.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` |
| Asset category picker in Step 3 (`assets`) | `[S]` | `GET` | `/accounting/asset-categories` | `accounting.asset.read` | `accounting.assets.core` | `COMPANY` | `none` | `none` | `200` |

### 1.4 States & Boundary Behaviour (`SCR-09`)

- **Loading:** Skeleton `StatStrip` (`3` cards) + `6`-row `DataTable` shimmer (`aria-busy="true"`). Wizard pickers render inline spinner inside input end-slot without layout jump.
- **Empty (`#116`):** Calm onboarding card explaining the activation cut-off `<bdi dir="ltr">{accountingActivatedOn}</bdi>`, offering **two clear starting paths**: (1) `+ دفعة أرصدة افتتاحية` / `+ New Opening Batch` (including paste from Excel/CSV via `useLocalSheetParser`), or (2) `بدء دفعة فارغة لشركة جديدة` / `Create Empty Batch (Greenfield Company)` (`D-666` shortcut opening Step 1 with the greenfield toggle pre-checked).
- **`403` Permission Boundary:** Visiting `#116` or `#117` without `accounting.import.read` renders `PermissionGate` naming `accounting.import.read` and active company scope. Holding `accounting.import.read` without `accounting.import.run` renders read-only mode (wizard & validate/cancel hidden); holding `accounting.import.run` without `accounting.journal_draft.post` disables `Post Batch` with tooltip naming `accounting.journal_draft.post`.
- **Entitlement Boundary (`403 ACCOUNTING.FEATURE.NOT_ENTITLED`):**
  - Without `accounting.ledger.core`: full-page `NotEntitledGate`.
  - Without `accounting.integration.trade_posting`: `TRADE_ONBOARDING` option and Trade Step-3 sections (`inventoryLayers`, `inTransit`, `streamHeads`, `deviceChainHeads`) are hidden/locked with calm upsell badge, preventing `403 NOT_ENTITLED`. Subledger Step-3 sections (`assets`, `openItems`) gracefully degrade if `accounting.assets.core` or `accounting.receivables.core` is unentitled.
- **Recovery Mode (`403 ACCOUNTING.FEATURE.RECOVERY_MODE`):** Top `RecoveryModeBanner` locks all write CTAs (`Create`, `Validate`, `Post`, `Cancel`) while keeping `#116` and `#117` readable.
- **7-Day Idempotency & Ambiguous Timeout (`POST /opening-balances` & `POST /:id/post`):** If a network drop/504 occurs during `POST /opening-balances` (`x-idempotency-key (7 d)`) or `POST /:id/post`, `AmbiguousOutcomePanel` appears (`accounting-patterns-documents.md` §4), polling `GET /accounting/opening-balances` for the company's live batch before offering **"إعادة المحاولة بنفس مفتاح عدم التكرار" / "Retry with Same Idempotency Key"**.
- **`409 ACCOUNTING.CONCURRENCY.STALE_VERSION`:** Opens `ConflictDialog` comparing stale `version` vs fresh `GET /:id` `ETag`, refreshing `validationFindings` and status in one click.

### 1.5 Three-Part Bilingual Error Copy (`SCR-09` — Cause · Record State · Safe Next Action)

| Error Code (HTTP) | Arabic Copy (`Cause` · `Record state` · `Safe next action`) | English Copy (`Cause` · `Record state` · `Safe next action`) |
| --- | --- | --- |
| `ACCOUNTING.IMPORT.SECOND_ACTOR_REQUIRED` (`403`) | **السبب:** تتضمن الدفعة مستندات أصلية سابقة لفواتير عملاء (`sourceDocument`)، ولا يجوز لمنشئ الدفعة أو فاحصها ترحيلها بنفسه (`D-759`). **حالة السجل:** الدفعة باقية في حالة `VALIDATED` ولم يُرحّل أي قيد. **الإجراء الآمن:** اطلب من محاسب معتمد آخر يملك صلاحية `accounting.journal_draft.post` فتح الدفعة وترحيلها. | **Cause:** This batch contains legacy AR source documents (`sourceDocument`), so the creator/validator cannot post their own batch (`D-759`). **Record state:** The batch remains `VALIDATED`; no entry was posted. **Safe next action:** Ask an independent user with `accounting.journal_draft.post` to open this batch and click Post. |
| `ACCOUNTING.IMPORT.DRY_RUN_REQUIRED` (`409`) | **السبب:** لم يكتمل فحص التوازن والمطابقة للدفعة أو وُجدت أخطاء مانعة (`blockingFindingsCount > 0` أو رصيد معلق غير صفري). **حالة السجل:** لم يُرحّل أي قيد في الدفتر. **الإجراء الآمن:** شغّل **التحقق من الدفعة** وراجع تبويب **نتائج التحقق**؛ وإن لزم تعديل السطور ألغِ الدفعة وأنشئ دفعة مصححة. | **Cause:** Validation has not passed or blocking findings / non-zero suspense remain on the batch. **Record state:** No journal entry was posted. **Safe next action:** Run **Validate Batch** and inspect **Validation Findings**; if line edits are needed, cancel this batch and create a corrected one. |
| `ACCOUNTING.IMPORT.ALREADY_COMMITTED` (`409`) | **السبب:** تم ترحيل هذه الدفعة مسبقاً أو توجد دفعة حيّة من نفس النوع للشركة. **حالة السجل:** الأرصدة المرحّلة محفوظة ولم تتغير. **الإجراء الآمن:** حدّث الصفحة لعرض الدفعة المرحّلة وإيصال القيد المحاسبي؛ وتتم أي تسويات لاحقة عبر قيود يومية عادية. | **Cause:** This opening batch is already posted (or another live batch of the same kind already exists). **Record state:** Existing posted balances are unchanged. **Safe next action:** Refresh to view the posted batch and receipt; record any subsequent adjustments via standard journal drafts. |
| `ACCOUNTING.PERIOD.CLOSED` / `ACCOUNTING.PERIOD.PERMANENTLY_CLOSED` (`409`) | **السبب:** توجد فترة محاسبية عادية (`NORMAL`) مقفلة للأستاذ العام (`GL`)، مما يمنع إنشاء أو ترحيل دفعة التأسيس (`D-666`). **حالة السجل:** لم يتم إنشاء أو ترحيل الدفعة. **الإجراء الآمن:** إذا كانت الفترة مقفلة قابلة لإعادة الفتح، اطلب إعادة فتحها عبر شاشة إقفال الفترات، وإلا تواصل مع مسؤول النظام. | **Cause:** A `NORMAL` `GL` period of the company is already `CLOSED` or `PERMANENTLY_CLOSED`, blocking opening-balance creation/posting (`D-666`). **Record state:** No batch change was committed. **Safe next action:** Reopen the `CLOSED` period with an approved `PERIOD_REOPEN` request if eligible, or consult your chief accountant. |
| `ACCOUNTING.IMPORT.HEAD_MISMATCH` / `INVENTORY.RECONCILIATION_DIFFERENCE` (`409` / `422`) | **السبب:** قيم طبقات المخزون أو البضاعة بالطريق أو أرقام تسلسل نقاط البيع/المخازن لا تطابق أرصدة الأستاذ أو قراءة نظام التجارة عند نقطة القطع (`D-492`, `D-676`). **حالة السجل:** بقيت الدفعة غير مرحّلة ولم تُنشأ طبقات مخزون. **الإجراء الآمن:** راجع تبويب **نتائج التحقق** وتبويب **رؤوس السلاسل**، ثم ألغِ الدفعة وأعد إنشاءها بالقيم المطابقة. | **Cause:** Inventory layers, in-transit totals, or stream/device chain heads do not match the GL balances or Trade's cut-off state (`D-492`, `D-676`). **Record state:** The batch remains unposted and no cost layers were seeded. **Safe next action:** Inspect **Validation Findings** and **Trade Heads**, then cancel and recreate the batch with reconciled figures. |

### 1.6 ASCII Mockups — `SCR-09` (All 4 Combinations + `<768px` Responsive Stack)

#### 1.6.1 Arabic RTL × Light (`[dir="rtl"][data-theme="light"]` — `#116` Hub + `#117` Detail Split Overview)

```text
+----------------------------------------------------------------------------------------------------------------------+
| [شعار] متكامل · المحاسبة          [الشركة: شركة النيل للتجارة ▾] [العملة: EGP] [تاريخ التأسيس: 2026-01-01]  [☀️|AR] |
+---------------------------------------------------------------------------------------------------------+------------+
| الأرصدة الافتتاحية (#116)                                                                               | القائمة    |
| تهيئة أرصدة التأسيس وتكلفة المخزون عبر الإدخال المباشر أو اللصق المحلي من الجداول (JSON-Lines · D-691)  | الرئيسية   |
| [فتح الدفعة الحالية #117 (أساسي - brand)]  [+ دفعة تهيئة المخزون ونقاط البيع (ثانوي)]                   | ────────── |
+-----------------------------------+-----------------------------------+---------------------------------+ • الرئيسية |
| دفعة التأسيس (OPENING)            | صافي تسوية حقوق الملكية الافتتاحية| حالة ترحيل التجارة والمخزون     | • صندوق    |
| [✓ تم التحقق · VALIDATED]         | EGP 15,000.00000000               | مفعّل مع دفعة التأسيس           |   الاعتماد |
| تاريخ القطع: 2026-01-01 · v3      | المعلق (Suspense): EGP 0.00000000 | عقد المخازن: 2 · أجهزة POS: 3   | • اليومية  |
+-----------------------------------+-----------------------------------+---------------------------------+ • الإقفال  |
| تصفية: [الحالة: الكل ▾]  [تاريخ القطع: YYYY-MM-DD]                              إجمالي الدفعات: 1 دفعة  | ▾ الإعدادات|
+-------------+------------+------------------+-------------------+-------------------+---------+---------+   - الدليل |
| الإجراء     | الإصدار    | الفحص والبنود    | حقوق الملكية/معلق | إجمالي الدائن     | إجمالي المدين | النوع/القطع|  ● الأرصدة|
+-------------+------------+------------------+-------------------+-------------------+---------------+---+   - قواعد  |
| [عرض #117 ←]| v3         | 0 مانع · 1 تنبيه | 15,000.00 / 0.00  | 1,235,000.00 EGP  | 1,250,000.00  | تأسيس      |
|             | [✓ محققة]  | 42 ذمة · 5 أصول  |                   |                   | 2026-01-01    | OPENING    |
+-------------+------------+------------------+-------------------+-------------------+---------------+------------+
| ── معاينة شاشة تفاصيل الدفعة (#117 /accounting/setup/opening-imports/0195f2a0-...) ───────────────────────────────── |
| مسار التنقل: الأرصدة الافتتاحية / OPENING · 2026-01-01 · [✓ تم التحقق · VALIDATED] · [v3]                           |
| [إلغاء الدفعة…]   [🔒 ترحيل الأرصدة الافتتاحية (أساسي معطل: يتطلب مستخدماً ثانياً مستقلاً D-759)]                   |
| ┌─ تنبيه رقابة ثنائية (caution) ───────────────────────────────────────────────────────────────────────────────────┐ |
| │ ! تتضمن هذه الدفعة مستندات أصلية سابقة لفواتير عملاء (AR sourceDocument). يجب أن ينفذ الترحيل مستخدم ثانٍ مستقل.│ |
| └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ |
| تبويبات: [● نتائج التحقق والجاهزية (1)]  [رؤوس سلاسل المخزون ونقاط البيع (5)]  [إيصال الترحيل والأثر المحاسبي]     |
| • أخطاء مانعة (0): ✓ جميع الحسابات الرقابية مطابقة لمجاميع الذمم (AR/AP) وطبقات المخزون (INVENTORY) ورصيد المعلق 0. |
| • تنبيهات غير مانعة (1): ⚠ سيتم ترحيل فرق التوازن EGP 15,000.00000000 تلقائياً إلى حساب OPENING_BALANCE_EQUITY.     |
+----------------------------------------------------------------------------------------------------------------------+
```

#### 1.6.2 Arabic RTL × Dark (`[dir="rtl"][data-theme="dark"]` — `#116` 4-Step `OpeningBalanceWizard` Step 2 GL Grid)

```text
+----------------------------------------------------------------------------------------------------------------------+
| 🌙 [وضع داكن · خلفية ink-950 / بطاقات ink-900 / حدود ink-800]               [الشركة: شركة النيل للتجارة] [العملة: EGP]|
+----------------------------------------------------------------------------------------------------------------------+
| [✕ إغلاق]  معالج إنشاء دفعة الأرصدة الافتتاحية (JSON-Lines)                  الخطوة 2 من 4: أرصدة الأستاذ العام (GL) |
| المسار: [✓ 1. النوع والقطع (OPENING · 2026-01-01)] ── [● 2. أرصدة الأستاذ] ── [○ 3. الذمم والمخزون] ── [○ 4. المراجعة]|
+----------------------------------------------------------------------------------------------------------------------+
| أدوات الإدخال السريع: [📋 لصق من Excel/CSV محلياً (بدون رفع ملف)]  [+ إضافة سطر حساب]        عدد السطور: 4 / 50,000 |
+------+------------------------+-----------+--------------------+-------------+--------------------+------------------+
| حذف  | الأبعاد التحليلية      | العملة/ج.أ| المبلغ بالعملة     | الاتجاه     | المبلغ بعملة الأساس| الحساب (Account) |
+------+------------------------+-----------+--------------------+-------------+--------------------+------------------+
| [🗑] | فرع القاهرة · مبيعات   | USD       | 10,000.00000000    | [مدين ▾]    | 500,000.00000000   | 110102 · بنك CIB |
| [🗑] | فرع القاهرة            | EGP       | —                  | [مدين ▾]    | 450,000.00000000   | 110301 · العملاء |
|      |                        |           | ℹ حساب رقابي AR: يجب مطابقة الإجمالي (450,000.00) في الخطوة 3 (الذمم)   |
| [🗑] | المخزن الرئيسي         | EGP       | —                  | [مدين ▾]    | 300,000.00000000   | 110501 · المخزون |
| [🗑] | الإدارة العامة         | EGP       | —                  | [دائن ▾]    | 1,235,000.00000000 | 210101 · الموردون|
+------+------------------------+-----------+--------------------+-------------+--------------------+------------------+
| شريط التوازن اللحظي (BigInt 10^8): المدين: EGP 1,250,000.00 │ الدائن: EGP 1,235,000.00 │ فرق التسوية: EGP 15,000.00 |
| [التالي: الذمم والأصول والمخزون ← (أساسي - brand)]                                          [→ السابق: النوع والقطع] |
+----------------------------------------------------------------------------------------------------------------------+
```

#### 1.6.3 English LTR × Light (`[dir="ltr"][data-theme="light"]` — `#116` Hub + `#117` Detail Split Overview)

```text
+----------------------------------------------------------------------------------------------------------------------+
| [Logo] Mutakamel · Accounting     [Company: Nile Trading Co. ▾] [Currency: EGP] [Activated On: 2026-01-01]   [☀️|EN] |
+--------------------+-------------------------------------------------------------------------------------------------+
| Main Navigation    | Opening Balances (#116)                                                                         |
| ────────────────── | Seed activation GL balances, subledgers & inventory cut-off via JSON-lines (Stage 1 · D-691)    |
| • Home             | [Open Active Batch #117 (primary - brand)]   [+ New Trade Onboarding Batch (outline)]           |
| • Approval Inbox   +---------------------------------+---------------------------------+-----------------------------+
| • Journals         | Activation Batch (OPENING)      | Opening Equity Balancing Plug   | Trade Cut-Off Baseline      |
| • Period Close     | [✓ VALIDATED]                   | EGP 15,000.00000000             | Seeded at Activation        |
| ▾ Setup            | Cut-off: 2026-01-01 · v3        | Suspense: EGP 0.00000000        | Nodes: 2 · POS Devices: 3   |
|   - Chart of Accts +---------------------------------+---------------------------------+-----------------------------+
|   ● Opening Bal.   | Filter: [Status: All ▾]  [Cut-Off Date: YYYY-MM-DD]                         Total batches: 1    |
|   - Approval Rules +---------------+---------------+-----------------+-----------------+---------------+-----+-------+
|                    | Kind / Cut-Off| Total Debit   | Total Credit    | Equity/Suspense | Checks & Rows | Ver | Action|
|                    +---------------+---------------+-----------------+-----------------+---------------+-----+-------+
|                    | OPENING       | 1,250,000.00  | 1,235,000.00    | 15,000.00 / 0.00| 0 err · 1 warn| v3  | [View |
|                    | 2026-01-01    | EGP           | EGP             |                 | 42 OI · 5 FA  | ✓   |  -> ] |
|                    +---------------+---------------+-----------------+-----------------+---------------+-----+-------+
|                    | ── Batch Detail Preview (#117 /accounting/setup/opening-imports/0195f2a0-...) ───────────────── |
|                    | Breadcrumb: Opening Balances / OPENING · 2026-01-01 · [✓ VALIDATED] · [v3]                      |
|                    | [Post Opening Batch (primary - brand)]   [Cancel Batch…]                                        |
|                    | Tabs: [● Validation Findings (1)]  [Trade Stream & POS Heads (5)]  [Posting Receipt & Audit]    |
|                    | • Blocking Findings (0): ✓ All AR/AP open items & INVENTORY layers reconcile; suspense is 0.00. |
|                    | • Non-Blocking Warnings (1): ⚠ Net difference EGP 15,000.00000000 routes to OPENING_BALANCE_EQ. |
+--------------------+-------------------------------------------------------------------------------------------------+
```

#### 1.6.4 English LTR × Dark (`[dir="ltr"][data-theme="dark"]` — `#116` 4-Step `OpeningBalanceWizard` Step 3 Subledgers & Trade Heads)

```text
+----------------------------------------------------------------------------------------------------------------------+
| 🌙 [Dark Theme · ink-950 canvas / ink-900 elevated sheet / ink-800 hairlines]   [Company: Nile Trading Co.] [EGP]    |
+----------------------------------------------------------------------------------------------------------------------+
| New Opening Balance Batch (JSON-Lines)                                Step 3 of 4: Subledgers, Assets & Trade Heads  |
| [✓ 1. Kind & Cut-Off] ── [✓ 2. GL Balances] ── [● 3. Subledgers & Trade Heads] ── [○ 4. Review & Create Draft]       |
+----------------------------------------------------------------------------------------------------------------------+
| Sub-sections: [● AR/AP Open Items (42)] [Instruments (0)] [Fixed Assets (5)] [Tax Pools (1)] [Trade Cut-Off (5)]     |
| ┌─ Two-Actor Posting Notice (caution · D-759) ─────────────────────────────────────────────────────────────────────┐ |
| │ ! 2 AR open items include Legacy Source Documents (sourceDocument). A second user must execute Post Batch.      │ |
| └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ |
| [📋 Paste Open Items from Sheet]  [+ Add Open Item]                AR Total: EGP 450,000.00 == GL AR Control ✓       |
+------+--------------------+--------------+------------+------------+-----+---------------+------------+--------------+
| Side | Counterparty       | Document No  | Doc Date   | Due Date   | Cur | Original Amt  | Settled    | Legacy Orig. |
+------+--------------------+--------------+------------+------------+-----+---------------+------------+--------------+
| AR   | P-0014 · Delta Co. | INV-2025-881 | 2025-12-18 | 2026-01-17 | EGP | 250,000.00    | 0.00       | [TAX_INV ✓]  |
| AR   | P-0029 · Red Sea   | INV-2025-904 | 2025-12-27 | 2026-01-26 | USD | 4,000.00 @50  | 0.00       | [TAX_INV ✓]  |
+------+--------------------+--------------+------------+------------+-----+---------------+------------+--------------+
| [← Back: GL Balances]                                                   [Next: Review & Create Draft → (primary)]    |
+----------------------------------------------------------------------------------------------------------------------+
```

#### 1.6.5 `<768px` (`375px`) Mobile Stack (`#116` / `#117`)
- `AccountingScopeBar` collapses into a compact single-row company chip + drawer selector (`44px` height).
- `StatStrip` stacks `1` card per row; `#116` `DataTable` switches to stacked summary cards (`kind + status`, `asOfDate`, `totalDebit / totalCredit`, `View ->` `h-11` button).
- On `#117`, desktop editing of `50,000`-line grids displays a calm banner recommending `>=768px` for bulk spreadsheet entry while keeping **Validate**, **Post** (including second-actor sign-off `D-759`!), and **Cancel** `100%` operable with full-width `44px` buttons.

---

## 2. Plan `SCR-11` / Inventory `SCR-38` — Maker-Checker Approval Inbox, Request Detail & Approval Rules

- **Routes (`accounting-ia.md` §1 & `accounting-screen-inventory.md` row `SCR-38`):**
  - `#7` `/accounting/inbox/approvals` — Maker-Checker Approval Inbox (`صندوق الاعتمادات`)
  - `#8` `/accounting/inbox/approvals/[id]` — Approval Request Detail, Payload Verification & Decision Workspace (`تفاصيل طلب الاعتماد`)
  - `#110` `/accounting/setup/approval-rules` — Approval Rules & Mandatory Defaults Matrix (`قواعد وسلاسل الاعتماد`)
  - `#111` `/accounting/setup/approval-rules/[id]` — Approval Rule Detail & Step Ladder Editor (`تفاصيل قاعدة الاعتماد`)
- **Two-Gate Navigation Visibility (`accounting-ia.md` §3):**
  - Gate 1 (Feature): `accounting.close.approvals` on all 19 `[P]` endpoints (if absent -> nav links `#7` and `#110` are hidden; direct URL visit renders `NotEntitledGate`). Note: `PERSONAL_DATA_REDACTION` final approval (`POST /accounting/ledger/redactions/:approvalRequestId/approve`) is gated by `accounting.ledger.core` + `accounting.ledger_redaction.approve`.
  - Gate 2 (Permission): `accounting.approval.read` (if absent -> `#7` and `#110` hidden; direct URL visit renders `PermissionGate`).
  - Action-level Hidden-vs-Disabled rules:
    - `Approve`: **hidden** without `accounting.approval.approve` (or `accounting.ledger_redaction.approve` on `PERSONAL_DATA_REDACTION`); **disabled with explicit reason badge** when `currentUser.id ∈ detail.makerUserIds` (`D-467`), when `currentUser.id` already recorded an `APPROVE` action on this or an earlier step (`D-560`), or when `state !== 'PENDING'`.
    - `Reject`: **hidden** without `accounting.approval.reject`; **disabled with reason** when `currentUser.id ∈ detail.makerUserIds` (`D-467`) or `state !== 'PENDING'`.
    - `Withdraw`: **hidden** unless `currentUser.id === detail.submittedBy` AND user holds `accounting.approval.withdraw`; enabled only while `state === 'PENDING'` (`D-354`).
    - `Create / Edit / Delete / Restore / Step CRUD` on `#110` & `#111`: **hidden** without `accounting.approval.manage_rules`.

### 2.1 Shell, Layout & Reused Approved Patterns

#### A. `#7` Maker-Checker Approval Inbox (`/accounting/inbox/approvals`)
1. **`AccountingScopeBar`:** Supports `Company` + optional `Branch` filter because `GET /approval-requests`, `POST /approval-requests/search`, `GET /:id`, `GET /:id/actions`, and `POST /:id/withdraw` declare `Scope target: COMPANY_OR_BRANCH`, whereas `POST /:id/approve` and `POST /:id/reject` require `COMPANY` scope (`02_Endpoint_Catalogue.md` §10 lines 1003–1009). If a branch-only operator views `#7` or `#8` without company-level `accounting.approval.approve`, `Approve`/`Reject` stay hidden/disabled cleanly without throwing an unexpected `403`.
2. **`PageHeader`:**
   - Title: `صندوق الاعتمادات (الرقابة الثنائية)` / `Approval Inbox (Maker-Checker)`.
   - Secondary link (`accounting.approval.read`): `قواعد الاعتماد ←` / `Approval Rules ->` (`#110`). Zero `variant="primary"` button on `#7` because approval decisions require inspecting the frozen payload hash on `#8` (Zero-Blind-Approve rule).
3. **Quick Filter Tabs & `FilterBar`:**
   - Preset chips mapped strictly to declared query fields (`ApprovalRequestListQueryDto` + `POST /search` filter tree; the "assigned to me" chip sends `assignedToMe`, defined by the qualified-approver set of module 08 rule 10, `D-770`):
     - `معلقة (PENDING)` (`state = 'PENDING'`, default), `طلبات أرسلتها` / `Submitted by Me` (`submittedBy = currentUser.id`), `تنتهي خلال 24 ساعة` / `Expiring < 24h` (`state = 'PENDING'` + `expiresBefore = now + 24h`), `الكل` / `All States`.
   - `FilterBar` controls: `documentType` (`20` live MVP `ApprovalDocumentType` options; `5` reserved wave-2 members omitted from active filter dropdown), `state` (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, `EXPIRED`), `currentStepNo` (`1..10`), `expiresBefore` (`DatePicker`), plus `بحث متقدم` / `Advanced Filter` drawer calling `POST /api/tenant/accounting/v1/approval-requests/search` (`SearchManyDto` over `amount`, `currencyCode`, `branchId`, `requestNo`, `submittedAt`).
4. **Inbox `DataTable`:**
   - Columns: `requestNo` (`<bdi dir="ltr">APR-2026-000042</bdi>`), `documentType` (`t.status.approvalDocType.*` neutral chip), `targetType` + `targetId` short ref (`<bdi dir="ltr">`), `amount` + `currencyCode` (`<AccountingMoneyCell>`, `—` when `amount === null`), `stepProgress` (`<bdi dir="ltr">{currentStepNo}/{totalSteps}</bdi>`), `submittedAt` & `expiresAt` countdown badge (`caution` when `< 24h`), `state` (icon + `t.status.approvalState.*`), action `مراجعة واتخاذ قرار` / `Review & Decide` -> `#8`.

#### B. `#8` Approval Request Detail (`/accounting/inbox/approvals/[id]`)
1. **2-Pane Split Workspace (`1152px` desktop: `720px` Evidence & Snapshot Pane + `408px` Sticky `ApprovalPanel`):**
   - **Start/Main Pane (`720px`) — What Is Being Approved:**
     - **Header Summary Card:** `requestNo`, `documentType` localized badge, `state` badge (`WaitingStateBadge` `WS-06` when `PENDING` — **Zero-Resend Law**: never displays a "Resend request" button), `submittedBy`, `submittedAt`, `expiresAt`, `ruleId` link (or `"القاعدة الافتراضية الإلزامية (خطوة واحدة · D-352)"` / `"Built-in Mandatory 1-Step Default (D-352)"` when `ruleId === null`).
     - **Cryptographic Integrity Strip:** Displays `payloadHash` (`Sha256Hex` in `<bdi dir="ltr">` with copy button) and `ruleContentHash`. Explains that `expectedPayloadHash` is bound automatically to `ApproveRequestDto` / `RejectRequestDto` so any underlying mutation between load and click fails closed (`409 ACCOUNTING.APPROVAL.PAYLOAD_CHANGED`).
     - **Target Payload & Deep-Link Card:**
       - Renders deep link to the owning aggregate (`journal_draft` -> `/accounting/journals/drafts/{targetId}`, `fiscal_document` -> `/accounting/Purchase-or-Sales/{targetId}`, `fiscal_year` -> `/accounting/close/periods`, `journal_entry` -> `/accounting/journals/entries/{targetId}`, `exception_board` -> `/accounting/inbox/exceptions`, `bank_reconciliation` -> `/accounting/treasury/reconciliations/{targetId}`).
       - When `requestBody !== null` (`INBOX_POSITION_LOST` declaration range/stream details `D-673` or `BANK_MATCH_CORRECTION` forward match replacement details `D-677`), renders a structured read-only key-value inspector directly from `detail.requestBody`.
       - Maker-Checker exclusion list (`detail.makerUserIds`): lists all author/submitter UUIDs barred from approving or rejecting (`D-467`).
     - **Append-Only Actions Timeline (`GET /accounting/approval-requests/:id/actions`):** Chronological audit list of `ApprovalActionDto` rows (`stepNo`, `action` badge `APPROVE` / `REJECT` / `COMMENT`, `actorUserId`, `actorRoleKey`, `actedAt`, `payloadHashAtAction`, `comment`).
   - **End/Side Sticky Pane (`408px`) — Reused `ApprovalPanel` & `ApprovalStepTrack` (`accounting-patterns-workflow.md` §2):**
     - Vertical `ApprovalStepTrack` (`1..totalSteps`) highlighting `currentStepNo`, quorum rule, and completed steps.
     - **Decision Controls (when `state === 'PENDING'`):**
       - **Standard path (`documentType !== 'PERSONAL_DATA_REDACTION'`):**
         - Optional comment textarea (`comment`, `0..1,000` chars) + **`اعتماد الطلب` / `Approve Request`** (`variant="primary"`, calls `POST /api/tenant/accounting/v1/approval-requests/:id/approve` with `{ requestId, action: 'APPROVE', comment, expectedPayloadHash: detail.payloadHash }` + `If-Match` + `x-idempotency-key`).
         - **`رفض الطلب…` / `Reject Request…`** (`variant="outline"` negative-intent -> opens `ReasonDialog` requiring `10..1,000` chars -> calls `POST /api/tenant/accounting/v1/approval-requests/:id/reject` with `{ requestId, action: 'REJECT', reason, expectedPayloadHash: detail.payloadHash }`).
       - **Special Ledger Redaction path (`documentType === 'PERSONAL_DATA_REDACTION'`, `D-220`):**
         - Displays statutory notice: *"اعتماد حجب البيانات الشخصية يستبدل نص البيان بـ `[REDACTED]` لمرة واحدة دون المساس بالأرصدة أو بصمة القيد (`entry_hash`)."* / *"Approving personal-data redaction replaces `memo`/`description` with `[REDACTED]` once without altering balances or `entry_hash`."*
         - Primary CTA **`اعتماد وتنفيذ الحجب` / `Approve & Execute Redaction`** calls `POST /api/tenant/accounting/v1/ledger/redactions/:approvalRequestId/approve` (`accounting.ledger_redaction.approve`, `If-Match`, `x-idempotency-key`); `Reject` and `Withdraw` still use `/approval-requests/:id/reject` and `/withdraw`.
       - **Submitter Withdraw CTA (`currentUser.id === detail.submittedBy`):** **`سحب الطلب…` / `Withdraw Request…`** (`ReasonDialog` `10..500` trimmed chars -> `POST /approval-requests/:id/withdraw`).

#### C. `#110` Approval Rules Matrix (`/accounting/setup/approval-rules`) & `#111` Rule Detail (`/accounting/setup/approval-rules/[id]`)
1. **`#110` Layout:**
   - `AccountingScopeBar` (`COMPANY` scope).
   - `PageHeader` with single `variant="primary"` CTA `+ قاعدة اعتماد جديدة` / `+ New Approval Rule` (opens `ApprovalRuleFormDrawer`, gated by `accounting.approval.manage_rules`).
   - **Built-in Mandatory Defaults Reference Strip (`D-352` & `D-288`):** Collapsible info banner listing the `6` live MVP `ACCOUNTING_MANDATORY_APPROVAL_DOCUMENT_TYPES` (`YEAR_CLOSE_RERUN`, `POSTING_REDATE`, `PERSONAL_DATA_REDACTION`, `BANK_MATCH_CORRECTION`, `FX_REVALUATION_REPIN`, `INBOX_POSITION_LOST`) that automatically run a **built-in 1-step maker-checker fallback** when no active tenant rule matches, plus the `D-288` warning that `RESTORED_COPY_UNOBTAINABLE` requires a matched tenant rule with **at least `2` steps**.
   - **Rules `DataTable` + `BulkActionBar`:**
     - Columns (projected from `acc_approval_rules` read model): `code` & `nameI18n` (localized), `documentType` (`t.status.approvalDocType.*`), `priority` (`0..10,000` ascending evaluation order), `conditions` summary (`0..20` rows), `stepsCount`, `active` status badge, `deletedAt` filter toggle (for `POST /:id/restore`), `version`.
     - Multi-row selection opens `BulkActionBar` supporting **Bulk Activate / Deactivate / Priority Update** (`PATCH /accounting/approval-rules/bulk-update` -> `BulkResultPanel` handling `200` & `207 Multi-Status`) and **Bulk Seed Rules** (`POST /accounting/approval-rules/bulk`).
2. **`#111` Rule Detail & Step Ladder Editor (`/accounting/setup/approval-rules/[id]`):**
   - Header card with rule metadata (`documentType`, `priority`, `active`, `ruleContentHash` preview, `Edit Rule` drawer calling `PATCH /approval-rules/:id`, `Delete` `DELETE /:id` / `Restore` `POST /:id/restore`).
   - **`ConditionRow[]` Read/Edit Panel (`0..20` conditions):** Deterministic condition builder restricted strictly to the `6` `APPROVAL` registry keys in `02_DTOs.md` §11.2: `amount`, `currency_code`, `journal_id`, `party_group`, `branch_id`, `tax_status` with operators `EQ`, `NEQ`, `IN`, `NOT_IN`, `GT`, `GTE`, `LT`, `LTE`, `IS_NULL`, `IS_NOT_NULL`.
   - **Nested Step Ladder (`GET /approval-rules/:id/steps`, `POST /steps`, `PATCH /steps/:stepNo`, `DELETE /steps/:stepNo`):**
     - Ordered list `stepNo = 1..10` (`>= 2` enforced client-side when `documentType === 'RESTORED_COPY_UNOBTAINABLE'`).
     - Each step card displays `stepNo`, `approverKind` (`USER` | `ROLE` | `GROUP`), `approverRef` (`<bdi dir="ltr">`), and `quorum` (`ApprovalQuorum`, `ONE` \| `ALL`, default `ONE`, `D-771`), with `If-Match` concurrency protection against the parent rule's `ETag`. Wave-2 amount-band fields (`bandFromAmount`, `bandToAmount`, `D-624`) are hidden in Stage 1.

### 2.2 Complete DTO & Projection Field Mapping (Plan `SCR-11` / Inventory `SCR-38`)

#### A. Request Queries & Action Commands (`02_DTOs.md` §§11.1–11.2)

| DTO Name | Field | Wire Type & Validation | UI Binding |
| --- | --- | --- | --- |
| `ApprovalRequestListQueryDto` | `documentType` | `ApprovalDocumentType?` (20 live MVP values) | `#7` `FilterBar` select |
| ↳ | `state` | `ApprovalRequestState?` (`'PENDING' \| 'APPROVED' \| 'REJECTED' \| 'CANCELLED' \| 'EXPIRED'`) | `#7` quick tabs & select |
| ↳ | `submittedBy` | `UUID?` | "Submitted by Me" toggle / user filter |
| ↳ | `currentStepNo` | `number?` (`1..10`) | Step number filter |
| ↳ | `expiresBefore` | `ISO8601?` | Expiring-soon preset / date-time filter |
| ↳ | `page`, `limit`, `sort` | `FindManyDto` (`limit` `1..100`) | `DataTable` pagination |
| `ApproveRequestDto` | `requestId` | `UUID` (`=== params.id`) | Auto-populated from route `:id` |
| ↳ | `action` | `'APPROVE'` (literal) | Constant `'APPROVE'` |
| ↳ | `comment` | `string?` (`<= 1,000` chars) | `#8` `ApprovalPanel` optional note |
| ↳ | `expectedPayloadHash` | `Sha256Hex` (`64` hex chars) | Auto-bound from `detail.payloadHash` |
| `RejectRequestDto` | `requestId` | `UUID` (`=== params.id`) | Auto-populated from route `:id` |
| ↳ | `action` | `'REJECT'` (literal) | Constant `'REJECT'` |
| ↳ | `reason` | `string` (`10..1,000` chars) | Mandatory `ReasonDialog` textarea with live char counter |
| ↳ | `expectedPayloadHash` | `Sha256Hex` | Auto-bound from `detail.payloadHash` |
| `WithdrawApprovalRequestDto` | `reason` | `string` (`10..500` chars after `.trim()`) | Submitter `ReasonDialog` (`10..500` counter) |

#### B. Approval Request & Action Read Projections (`02_DTOs.md` §13.1 from `acc_approval_requests` & `acc_approval_actions`)

- **`ApprovalRequestSummaryDto`:** `id: UUID`, `companyId: UUID`, `branchId: UUID | null`, `requestNo: string`, `documentType: ApprovalDocumentType`, `targetType: string`, `targetId: UUID`, `ruleId: UUID | null`, `ruleContentHash: Sha256Hex | null`, `payloadHash: Sha256Hex`, `state: ApprovalRequestState`, `currentStepNo: number`, `totalSteps: number`, `bandStepNo: number | null`, `amount: DecimalString | null`, `currencyCode: CurrencyCode | null`, `submittedBy: UUID`, `submittedAt: ISO8601`, `expiresAt: ISO8601 | null`, `decidedAt: ISO8601 | null`, `decidedBy: UUID | null`, `correlationId: UUID | null`, `createdAt: ISO8601`, `updatedAt: ISO8601`, `version: number`.
- **`ApprovalRequestDetailDto extends ApprovalRequestSummaryDto`:** adds `makerUserIds: UUID[]` (`submitted_by` + every aggregate/line author `D-467`), `requestBody: Record<string, unknown> | null` (populated on `INBOX_POSITION_LOST` and `BANK_MATCH_CORRECTION`), `cancellationReason: string | null`, and `actions: ApprovalActionDto[]`.
- **`ApprovalActionDto` (`GET /:id/actions`):** `id: UUID`, `companyId: UUID`, `requestId: UUID`, `stepNo: number`, `actorUserId: UUID`, `action: ApprovalActionKind` (`'APPROVE' | 'REJECT' | 'COMMENT'`; `'DELEGATE'` wave 2), `comment: string | null`, `actedAt: ISO8601`, `payloadHashAtAction: Sha256Hex`, `delegatedFromUserId: UUID | null`, `actorRoleKey: string | null`, `ipHash: string | null`, `createdAt: ISO8601`.

#### C. Approval Rule Authoring DTOs (`CreateApprovalRuleDto` & `ApprovalStepInput` — `02_DTOs.md` §11.2)

| DTO / Sub-DTO | Field | Declared Wire Type (`02_DTOs.md`) | UI Control & Contract Note |
| --- | --- | --- | --- |
| `CreateApprovalRuleDto` | `documentType` | `ApprovalDocumentType` (20 live MVP; 5 reserved rejected `403 NOT_ENTITLED`) | Select (`20` live MVP options) |
| ↳ | `conditions` | `ConditionRow[]` (`0..20`: `{ field, op, value }`) | Deterministic rule builder (`field ∈ {'amount','currency_code','journal_id','party_group','branch_id','tax_status'}`) |
| ↳ | `priority` | `number` (`0..10,000`, integer) | Numeric input (`0` = highest precedence) |
| ↳ | `active` | `boolean?` (default `true`) | Switch toggle |
| ↳ | `steps` | `ApprovalStepInput[]` (`1..10`; `>= 2` for `RESTORED_COPY_UNOBTAINABLE`) | Ordered step list editor |
| `ApprovalStepInput` | `stepNo` | `number` (`1..10`, contiguous `1..N`) | Auto-numbered step badge |
| ↳ | `approverKind` | `ApproverKind` (`'USER' \| 'ROLE' \| 'GROUP'`) | Segmented control |
| ↳ | `approverRef` | `string` (UUID when `'USER'`; role/group key when `'ROLE'` / `'GROUP'`) | User lookup (`USER`) or LTR role/group key input (`CG-S6-07`) |
| ↳ | `quorum` | `ApprovalQuorum` (`'ONE' \| 'ALL'`, optional, default `ONE`; `ApprovalStepInput.quorum`, `D-771`) | UI presents `'ONE' (معتمد واحد)` vs `'ALL' (جميع المعتمدين المؤهلين)`; no numeric quorum is sent |

> **Rule write contract (`CG-S6-03`, closed by `D-771`):** `CreateApprovalRuleDto` in `02_DTOs.md` §11.2 carries `code`, `nameI18n`, `documentType`, `conditions`, `priority`, `active?`, `effectiveFrom`, `effectiveTo?`, `appliesToBranchId?`, `expiresAfterHours?` and `steps`; `UpdateApprovalRuleDto` is `PartialType(CreateApprovalRuleDto)` without `steps` (steps change only through the nested `/steps` routes) and requires `If-Match`; `ApprovalRuleListQueryDto` is declared. The write form therefore collects `code`, `nameI18n`, `effectiveFrom`, `effectiveTo?`, the branch and the expiry as well. Because backend DTO validation enforces `forbidNonWhitelisted`, the form still sends only keys of the declared DTO.

### 2.3 Verbatim Endpoint & Action Matrix (Plan `SCR-11` / Inventory `SCR-38` — `[P: 19]` + `[S]`)

Browser path = `/api/tenant/accounting/v1` + `Path`. Copied verbatim from `02_Endpoint_Catalogue.md` §10 (lines 991–1009) and §4 (line 280):

| UI Action | Role | Method | Catalogue Path | Permission | Feature key | Scope target | Idempotency | Concurrency | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `#7` List approval requests | `[P]` | `GET` | `/accounting/approval-requests` | `accounting.approval.read` | `accounting.close.approvals` | `COMPANY_OR_BRANCH` | `none` | `none` | `200` |
| `#7` Advanced filter search | `[P]` | `POST` | `/accounting/approval-requests/search` | `accounting.approval.read` | `accounting.close.approvals` | `COMPANY_OR_BRANCH` | `none` | `none` | `200` |
| `#8` Load request detail + `ETag` | `[P]` | `GET` | `/accounting/approval-requests/:id` | `accounting.approval.read` | `accounting.close.approvals` | `COMPANY_OR_BRANCH` | `none` | `none` | `200` + `ETag` |
| `#8` Load append-only action log | `[P]` | `GET` | `/accounting/approval-requests/:id/actions` | `accounting.approval.read` | `accounting.close.approvals` | `COMPANY_OR_BRANCH` | `none` | `none` | `200` |
| `#8` Approve request (standard) | `[P]` | `POST` | `/accounting/approval-requests/:id/approve` | `accounting.approval.approve` | `accounting.close.approvals` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| `#8` Reject request (`ReasonDialog`) | `[P]` | `POST` | `/accounting/approval-requests/:id/reject` | `accounting.approval.reject` | `accounting.close.approvals` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| `#8` Withdraw (`submittedBy` only) | `[P]` | `POST` | `/accounting/approval-requests/:id/withdraw` | `accounting.approval.withdraw` | `accounting.close.approvals` | `COMPANY_OR_BRANCH` | `x-idempotency-key` | `If-Match` | `200` |
| `#110` List approval rules | `[P]` | `GET` | `/accounting/approval-rules` | `accounting.approval.read` | `accounting.close.approvals` | `COMPANY` | `none` | `none` | `200` |
| `#111` Load rule detail + `ETag` | `[P]` | `GET` | `/accounting/approval-rules/:id` | `accounting.approval.read` | `accounting.close.approvals` | `COMPANY` | `none` | `none` | `200` + `ETag` |
| `#110` Create approval rule | `[P]` | `POST` | `/accounting/approval-rules` | `accounting.approval.manage_rules` | `accounting.close.approvals` | `COMPANY` | `x-idempotency-key` | `none` | `201` + `Location` |
| `#110` Bulk create rules | `[P]` | `POST` | `/accounting/approval-rules/bulk` | `accounting.approval.manage_rules` | `accounting.close.approvals` | `COMPANY` | `x-idempotency-key` | `none` | `200/207` |
| `#111` Update approval rule | `[P]` | `PATCH` | `/accounting/approval-rules/:id` | `accounting.approval.manage_rules` | `accounting.close.approvals` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| `#110` Bulk update rules | `[P]` | `PATCH` | `/accounting/approval-rules/bulk-update` | `accounting.approval.manage_rules` | `accounting.close.approvals` | `COMPANY` | `x-idempotency-key` | `none` | `200/207` |
| `#111` Soft-delete rule | `[P]` | `DELETE` | `/accounting/approval-rules/:id` | `accounting.approval.manage_rules` | `accounting.close.approvals` | `COMPANY` | `x-idempotency-key` | `If-Match` | `204` |
| `#110`/`#111` Restore deleted rule | `[P]` | `POST` | `/accounting/approval-rules/:id/restore` | `accounting.approval.manage_rules` | `accounting.close.approvals` | `COMPANY` | `x-idempotency-key` | `none` | `200` |
| `#111` List rule steps | `[P]` | `GET` | `/accounting/approval-rules/:id/steps` | `accounting.approval.read` | `accounting.close.approvals` | `COMPANY` | `none` | `none` | `200` |
| `#111` Add step to rule | `[P]` | `POST` | `/accounting/approval-rules/:id/steps` | `accounting.approval.manage_rules` | `accounting.close.approvals` | `COMPANY` | `x-idempotency-key` | `If-Match` | `201` |
| `#111` Update step `:stepNo` | `[P]` | `PATCH` | `/accounting/approval-rules/:id/steps/:stepNo` | `accounting.approval.manage_rules` | `accounting.close.approvals` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| `#111` Remove step `:stepNo` | `[P]` | `DELETE` | `/accounting/approval-rules/:id/steps/:stepNo` | `accounting.approval.manage_rules` | `accounting.close.approvals` | `COMPANY` | `x-idempotency-key` | `If-Match` | `204` |
| `#8` Approve ledger PII redaction | `[S]` | `POST` | `/accounting/ledger/redactions/:approvalRequestId/approve` | `accounting.ledger_redaction.approve` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |

### 2.4 States & Special Maker-Checker Behaviour

- **Loading & Empty States:**
  - `#7` Empty (`state = 'PENDING'`): Calm positive zero-inbox state (`"لا توجد طلبات اعتماد معلقة حالياً"` / `"No pending approval requests"`), with quick button to view all historical states.
  - `#110` Empty: Explains that optional document types post without approval when no rule matches, while the `6` `ACCOUNTING_MANDATORY_APPROVAL_DOCUMENT_TYPES` (`D-352`) remain protected by the built-in 1-step maker-checker rule; offers `+ قاعدة اعتماد جديدة` / `+ New Approval Rule`.
- **`409 ACCOUNTING.APPROVAL.QUORUM_NOT_MET` (`ALL`-Quorum Partial Sign-Off — Critical UX Rule!):**
  - Per `08_close_and_reporting.md` (`ApprovalService.approve`) and `04_Errors_and_Constants.md`, when `quorum === 'ALL'` and more qualified approvers remain on the current step, the server **commits the caller's `APPROVE` action row** and increments `version`, then answers `409 ACCOUNTING.APPROVAL.QUORUM_NOT_MET` (`safeAction: ['READ_LOCATION_OR_POLL']`).
  - **UI Handling:** Never render this as a red failure toast! Immediately refetch `GET /approval-requests/:id` and `GET /:id/actions`, transition the `ApprovalPanel` into a `positive`/`caution` **"تم تسجيل اعتمادك بنجاح — بانتظار بقية المعتمدين في هذه الخطوة" / "Your approval is recorded — awaiting remaining step quorum"** state, and disable the caller's `Approve` button (`D-560`).
- **Self-Approval & Prior-Step Prevention (`D-467`, `D-560`):** Proactively disables `Approve` & `Reject` when `currentUser.id ∈ detail.makerUserIds` (explaining maker-checker separation), and disables `Approve` when `detail.actions` already contains an `APPROVE` by `currentUser.id` on an earlier step.
- **`403` / `NOT_ENTITLED` / `RECOVERY_MODE`:** `PermissionGate` on missing `accounting.approval.read`; `NotEntitledGate` on missing `accounting.close.approvals` (naming subscription add-on); `RecoveryModeBanner` disables all decision and rule-management mutations during `RECOVERY_MODE`.

### 2.5 Three-Part Bilingual Error Copy (Plan `SCR-11` / Inventory `SCR-38`)

| Error Code (HTTP) | Arabic Copy (`Cause` · `Record state` · `Safe next action`) | English Copy (`Cause` · `Record state` · `Safe next action`) |
| --- | --- | --- |
| `ACCOUNTING.APPROVAL.ACTOR_IS_SUBMITTER` (`403`) | **السبب:** أنت مقدم الطلب أو أحد منشئي بنود المستند الأصلي (`makerUserIds`)، وتمنع الرقابة الثنائية اعتماد أو رفض عملك الشخصي (`D-467`). **حالة السجل:** بقي الطلب `PENDING` دون أي تغيير. **الإجراء الآمن:** وجّه الطلب إلى معتمد مستقل يملك صلاحية الاعتماد، أو اسحب الطلب إذا أردت تعديله. | **Cause:** You submitted this request or authored part of its target document (`makerUserIds`); maker-checker rules bar deciding your own work (`D-467`). **Record state:** The request remains `PENDING` unchanged. **Safe next action:** Route this request to an independent approver, or withdraw it if you need to edit the source document. |
| `ACCOUNTING.APPROVAL.PAYLOAD_CHANGED` (`409`) | **السبب:** تغيّرت بصمة بيانات المستند (`payloadHash`) بعد فتحك للشاشة ولم تعد تطابق البيانات المعروضة. **حالة السجل:** رُفض التنفيذ لحمايتك ولم يُسجّل أي قرار. **الإجراء الآمن:** اضغط **تحديث ومراجعة البيانات الجديدة** لإعادة قراءة الطلب والمستند قبل اتخاذ القرار. | **Cause:** The target payload hash (`payloadHash`) changed since you loaded this screen. **Record state:** Your decision was aborted safely; nothing was recorded. **Safe next action:** Click **Refresh & Review Updated Payload** to inspect the latest snapshot before deciding. |
| `ACCOUNTING.APPROVAL.QUORUM_NOT_MET` (`409`) | **السبب:** تتطلب هذه الخطوة إجماع جميع المعتمدين المؤهلين (`ALL`) ولم يكتمل النصاب بعد. **حالة السجل:** **تم حفظ اعتمادك رسمياً** في سجل الإجراءات وبقي الطلب `PENDING` في نفس الخطوة. **الإجراء الآمن:** لا تعِد الإرسال؛ انتظر استكمال توقيع بقية المعتمدين المؤهلين. | **Cause:** This step requires `ALL` qualified approvers and quorum is not yet complete. **Record state:** **Your approval action was committed** to the audit trail and the request stays `PENDING` on this step. **Safe next action:** Do not resend; wait for the remaining qualified approvers to sign off. |
| `ACCOUNTING.APPROVAL.ACTOR_ALREADY_APPROVED` (`409`) | **السبب:** قمت باعتماد هذا الطلب مسبقاً في هذه الخطوة أو في خطوة سابقة (`D-560`). **حالة السجل:** اعتمادك السابق محفوظ والطلب بانتظار معتمد آخر. **الإجراء الآمن:** حدّث الشاشة واطلب من معتمد مؤهل آخر استكمال الخطوة الحالية. | **Cause:** You have already recorded an approval on this request in the current or an earlier step (`D-560`). **Record state:** Your prior approval stands and the request awaits another approver. **Safe next action:** Refresh the screen and ask another qualified approver to complete the current step. |
| `ACCOUNTING.PAYABLES.BANK_CHANGE_MAKER_CONFLICT` / `BILL_SUBMITTER_CONFLICT` (`403`) | **السبب:** تعارض فصل المهام في المدفوعات: لا يجوز لمن عدّل الحساب البنكي للمورد أو أدخل فاتورته اعتماد دفعة السداد أو التغيير البنكي المرتبط به. **حالة السجل:** بقي الطلب `PENDING` دون تغيير. **الإجراء الآمن:** أحِل الطلب إلى معتمد مالي مستقل لم يشارك في إعداد بيانات المورد أو الفاتورة. | **Cause:** Payables Segregation-of-Duties conflict: the user who proposed the vendor bank-account change or submitted the bill cannot approve the related payment/change request. **Record state:** The request remains `PENDING`. **Safe next action:** Assign review to an independent treasury/finance approver. |
| `ACCOUNTING.INBOX.POSITION_NOT_LOST` (`409`) | **السبب:** تغيّرت حالة مواقع سلسلة الرسائل في صندوق التكامل وأصبح أحد المواقع غير مؤهل لإعلان الفقدان (`D-673`). **حالة السجل:** تراجع النظام عن الاعتماد بالكامل ولم يُعدّل مؤشر السلسلة. **الإجراء الآمن:** افتح شاشة **لوحة الاستثناءات / صندوق أحداث التكامل** لمراجعة المواقع المعلقة المحدّثة. | **Cause:** One or more stream positions in this `INBOX_POSITION_LOST` range are no longer eligible to be declared lost (`D-673`). **Record state:** The final approval rolled back cleanly; no watermark moved. **Safe next action:** Open the **Exception Board / Inbox Events** screen to inspect the updated stream state. |
| `ACCOUNTING.ENTRY.REDACTION_LEGAL_HOLD` (`409`) | **السبب:** القيد المحاسبي المستهدف بالحجب خاضع لحجز قانوني فعّال (`Legal Hold`) يمنع طمس النصوص (`D-220`). **حالة السجل:** بقيت نصوص القيد والسطور كما هي دون حجب. **الإجراء الآمن:** انتظر رفع الحجز القانوني المعتمد قبل إعادة طلب أو اعتماد حجب البيانات الشخصية. | **Cause:** The target journal entry is under an active Legal Hold, which forbids PII redaction (`D-220`). **Record state:** Entry `memo` and line `description` values remain intact. **Safe next action:** Keep the entry untouched until the legal hold is formally lifted. |

### 2.6 ASCII Mockups — Plan `SCR-11` / Inventory `SCR-38` (All 4 Combinations + `<768px` Stack)

#### 2.6.1 Arabic RTL × Light (`[dir="rtl"][data-theme="light"]` — `#7` Approval Inbox + `#8` Request Detail Split)

```text
+----------------------------------------------------------------------------------------------------------------------+
| [شعار] متكامل · المحاسبة          [الشركة: شركة النيل للتجارة ▾] [الفرع: كل الفروع ▾]                        [☀️|AR] |
+---------------------------------------------------------------------------------------------------------+------------+
| صندوق الاعتمادات — الرقابة الثنائية (#7)                                         [قواعد الاعتماد #110 ←]| القائمة    |
| شرائح سريعة: [● معلقة PENDING (4)]  [طلبات أرسلتها (1)]  [تنتهي خلال 24 ساعة (1)]  [الكل]               | الرئيسية   |
| تصفية: [نوع المستند: الكل ▾] [الخطوة: الكل ▾] [تنتهي قبل: ────────] [بحث متقدم POST /search]            | ────────── |
+------------------+----------------+-------------+----------+--------------------+----------------+------+ • الرئيسية |
| الإجراء          | الحالة/الانتهاء| الخطوة      | المبلغ   | الهدف              | نوع المستند    | الطلب| ● صندوق    |
+------------------+----------------+-------------+----------+--------------------+----------------+------+   الاعتماد |
| [مراجعة وقرار ←] | ⏳ معلقة · 6 س | خطوة 1 من 2 | 85,000.00| مسودة قيد          | قيد يومية يدوي | APR- | • اليومية  |
|                  |                |             | EGP      | 0195f1b2-…         | MANUAL_JE      | 0042 | • الإقفال  |
| [مراجعة وقرار ←] | ⏳ معلقة · 2 ي | خطوة 1 من 1 | —        | سنة مالية 2025     | إعادة إقفال سنة| APR- | ▾ الإعدادات|
|                  |                |             |          | 0195e800-…         | YEAR_CLOSE_…   | 0041 |   - القواعد|
+------------------+----------------+-------------+----------+--------------------+----------------+------+------------+
| ── شاشة تفاصيل طلب الاعتماد (#8 /accounting/inbox/approvals/0195f2c4-...) ────────────────────────────────────────── |
| ┌─ لوحة قرار الاعتماد (ApprovalPanel · 408px) ─┐  ┌─ تفاصيل الطلب وبصمة البيانات (720px) ──────────────────────────┐ |
| │ مسار الخطوات (ApprovalStepTrack):            │  │ طلب: APR-2026-000042 · [⏳ بانتظار الاعتماد WS-06] · [v2]      │ |
| │  [● 1] الدور: CHIEF_ACCOUNTANT (نصاب: ONE)   │  │ النوع: قيد يومية يدوي (MANUAL_JE) · المبلغ: EGP 85,000.00      │ |
| │   │    الحالة: خطوة حالية بانتظار القرار     │  │ بصمة الحمولة (payloadHash): sha256:9f86d081…4a2c [نسخ]         │ |
| │  [○ 2] الدور: FINANCE_DIRECTOR (نصاب: ONE)   │  │ المستند الهدف: [فتح مسودة القيد 0195f1b2-… في تبويب ↗]         │ |
| │ ──────────────────────────────────────────── │  │ منشئو المستند المستبعدون (makerUserIds · D-467): 1 مستخدم      │ |
| │ ملاحظة المعتمد (اختياري · 0/1000):           │  │ ── سجل الإجراءات غير القابل للتعديل (GET /:id/actions) ─────── │ |
| │ [تمت مطابقة مستند التسوية المرفق...        ] │  │ • 2026-11-01 09:14Z · إرسال الطلب بواسطة U-104 (أحمد منصور)   │ |
| │ [✓ اعتماد الطلب (أساسي - brand)]             │  └────────────────────────────────────────────────────────────────┘ |
| │ [✕ رفض الطلب…]        [سحب الطلب (للمنشئ)]   │                                                                     |
| └──────────────────────────────────────────────┘                                                                     |
+----------------------------------------------------------------------------------------------------------------------+
```

#### 2.6.2 Arabic RTL × Dark (`[dir="rtl"][data-theme="dark"]` — `#110` Approval Rules + `#111` Step Ladder Editor)

```text
+----------------------------------------------------------------------------------------------------------------------+
| 🌙 [وضع داكن · ink-950 / ink-900 / ink-800]                     [الشركة: شركة النيل للتجارة ▾] [النطاق: COMPANY] [AR]|
+----------------------------------------------------------------------------------------------------------------------+
| قواعد وسلاسل الاعتماد (#110)                                                   [+ قاعدة اعتماد جديدة (أساسي - brand)]|
| ℹ الحماية الافتراضية الإلزامية (D-352): الأنواع الستة (YEAR_CLOSE_RERUN, POSTING_REDATE, PERSONAL_DATA_REDACTION,   |
|   BANK_MATCH_CORRECTION, FX_REVALUATION_REPIN, INBOX_POSITION_LOST) تخضع دائماً لاعتماد خطوة واحدة حتى بدون قاعدة.   |
+-------------+----------+-----------+-------------------------------+----------+----------------------+---------------+
| الإجراء     | الحالة   | الخطوات   | الشروط (Conditions)           | الأولوية | نوع المستند          | الكود / الاسم |
+-------------+----------+-----------+-------------------------------+----------+----------------------+---------------+
| [إدارة #111]| ✓ نشطة   | 2 خطوات   | amount >= "50000.00"          | 10       | MANUAL_JE            | R-JE-HIGH     |
| [إدارة #111]| ✓ نشطة   | 2 خطوات   | بدون شروط (شامل · D-288 >=2) | 5        | RESTORED_COPY_UNOBT. | R-TAX-UNOBT   |
+-------------+----------+-----------+-------------------------------+----------+----------------------+---------------+
| ── محرر خطوات القاعدة (#111 /accounting/setup/approval-rules/0195a110-... · ETag v4) ─────────────────────────────── |
| الشروط (APPROVAL registry): [amount] [GTE >=] ["50000.00"]  [+ إضافة شرط (1/20)]         [حفظ تعديلات القاعدة PATCH] |
| سلم الخطوات المتسلسل (/steps/:stepNo):                                                      [+ إضافة خطوة POST /steps]|
|  • خطوة 1 (`stepNo: 1`) │ النوع: ROLE │ المرجع: `CHIEF_ACCOUNTANT`  │ النصاب: ONE │ [تعديل PATCH] [حذف DELETE]       |
|  • خطوة 2 (`stepNo: 2`) │ النوع: ROLE │ المرجع: `FINANCE_DIRECTOR`  │ النصاب: ONE │ [تعديل PATCH] [حذف DELETE]       |
+----------------------------------------------------------------------------------------------------------------------+
```

#### 2.6.3 English LTR × Light (`[dir="ltr"][data-theme="light"]` — `#7` Approval Inbox + `#8` Request Detail Split)

```text
+----------------------------------------------------------------------------------------------------------------------+
| [Logo] Mutakamel · Accounting     [Company: Nile Trading Co. ▾] [Branch: All Branches ▾]                     [☀️|EN] |
+--------------------+-------------------------------------------------------------------------------------------------+
| Main Navigation    | Approval Inbox — Maker-Checker (#7)                                      [Approval Rules #110 ->]|
| ────────────────── | Presets: [● Pending (4)]  [Submitted by Me (1)]  [Expiring < 24h (1)]  [All States]             |
| • Home             | Filter: [Doc Type: All ▾] [Step: All ▾] [Expires Before: ────────] [Advanced POST /search]      |
| ● Approval Inbox   +----------------+------------------+--------------+---------------+----------+----------+--------+
| • Journals         | Request No     | Document Type    | Target       | Amount        | Step     | Status   | Action |
| • Period Close     +----------------+------------------+--------------+---------------+----------+----------+--------+
| ▾ Setup            | APR-2026-000042| Manual Journal   | journal_draft| 85,000.00 EGP | 1 / 2    | ⏳ 6h    | [Open] |
|   - Chart of Accts | APR-2026-000041| Year Close Rerun | fiscal_year  | —             | 1 / 1    | ⏳ 2d    | [Open] |
|   - Opening Bal.   +----------------+------------------+--------------+---------------+----------+----------+--------+
|   - Approval Rules | ── Request Detail Workspace (#8 /accounting/inbox/approvals/0195f2c4-...) ───────────────────── |
|                    | ┌─ Evidence & Payload Integrity (720px) ──────────┐ ┌─ ApprovalPanel (408px · Sticky) ────────┐ |
|                    | │ APR-2026-000042 · [⏳ Pending WS-06] · [ETag v2]│ │ Step Ladder (ApprovalStepTrack):        │ |
|                    | │ Type: Manual Journal (MANUAL_JE) · EGP 85,000.00│ │  [● 1] ROLE: CHIEF_ACCOUNTANT (ONE)     │ |
|                    | │ payloadHash: sha256:9f86d081…4a2c [Copy]        │ │  [○ 2] ROLE: FINANCE_DIRECTOR (ONE)     │ |
|                    | │ Target: [Inspect Journal Draft 0195f1b2-… ↗]    │ │ Comment (optional · 0/1000):            │ |
|                    | │ Excluded Makers (makerUserIds · D-467): 1 user  │ │ [Verified accrual backup schedule...  ] │ |
|                    | │ ── Append-Only Actions (GET /:id/actions) ───── │ │ [✓ Approve Request (primary - brand)]   │ |
|                    | │ • 2026-11-01 09:14Z · Submitted by U-104        │ │ [✕ Reject Request…]   [Withdraw…]       │ |
|                    | └─────────────────────────────────────────────────┘ └─────────────────────────────────────────┘ |
+--------------------+-------------------------------------------------------------------------------------------------+
```

#### 2.6.4 English LTR × Dark (`[dir="ltr"][data-theme="dark"]` — `#8` Special Variants: `PERSONAL_DATA_REDACTION` & Maker Self-Block)

```text
+----------------------------------------------------------------------------------------------------------------------+
| 🌙 [Dark Theme · ink-950 / ink-900 / ink-800]                     [Company: Nile Trading Co.] [Scope: COMPANY]  [EN] |
+----------------------------------------------------------------------------------------------------------------------+
| Breadcrumb: Approval Inbox / APR-2026-000049 · Personal Data Redaction (PERSONAL_DATA_REDACTION) · [⏳ PENDING · v1] |
+----------------------------------------------------------------------+-----------------------------------------------+
| Evidence & Redaction Target (720px)                                  | Maker-Checker Decision Panel (408px)          |
| • Rule: Built-in Mandatory 1-Step Default (ruleId: null · D-352)     | Step 1 of 1 · Built-in Maker-Checker Gate     |
| • Target: Posted Journal Entry JE-2026-004192 (`0195d901-...`)       | ┌─ Maker Exclusion Active (caution · D-467) ─┐|
| • Frozen payloadHash: `sha256:3c91ab04...88e1`                       | │ 🔒 You (`U-104`) requested this redaction. │|
| • Statutory Notice (D-220): Redaction replaces `memo` / line         | │    An independent user holding             │|
|   `description` with `[REDACTED]` once; ledger balances & `entryHash`| │    `accounting.ledger_redaction.approve`   │|
|   remain mathematically unchanged. Refused if under Legal Hold.      | │    must execute final approval.            │|
|                                                                      | └────────────────────────────────────────────┘|
|                                                                      | [🔒 Approve & Redact (disabled - maker)]      |
|                                                                      | [Withdraw My Request… (enabled - submitter)]  |
+----------------------------------------------------------------------+-----------------------------------------------+
```

#### 2.6.5 `<768px` (`375px`) Mobile Stack (`#7`, `#8`, `#110`, `#111`)
- `#7` Inbox rows render as touch-friendly `44px+` cards showing `requestNo`, `documentType`, `amount`, `currentStepNo/totalSteps`, expiry badge, and full-width `Review & Decide` link.
- `#8` stacks **Evidence & `payloadHash` Card first**, followed by the **Actions Timeline**, with a sticky bottom action bar (`Approve` / `Reject`) that scrolls the user through the target summary if not yet viewed, preserving `expectedPayloadHash` protection on mobile.
- `#110`/`#111` rule step cards stack vertically with accessible Move/Edit/Delete buttons (`min-h-11 min-w-11` touch targets; no drag-only reordering).

---

## 3. Inventory Row `SCR-11` Companion — Fiscal Years, Period State Machine, Overrides & Year-End Close (`#65`, `#66`)

- **Routes (`accounting-ia.md` §1 & `accounting-screen-inventory.md` row `SCR-11`):**
  - `#65` `/accounting/close/periods` — Operational Period State Matrix, Overrides, Reopen Log & Year-End Close Workspace
  - `#66` `/accounting/close/periods/[id]` — Single Period Close Gate, Module Lock Status & Override Detail
- **Design Reuse Contract with `P03.T09.S2` (`out/accounting-stage1-chart-calendar.md`):**
  - `FiscalYearsPanelView`, `PeriodStateMatrixView` (`GL` / `AR` / `AP` / `TAX` × `FUTURE` / `OPEN` / `SOFT_CLOSED` / `CLOSED` / `PERMANENTLY_CLOSED`), `UserPeriodOverridesPanelView`, and `PeriodReopenLogPanelView` are **reused verbatim** from `src/features/accounting/calendars/`.
  - `#65` and `#66` mount those shared panels in the `Period Close` (`إقفال الفترات`) operational section and add the **Year-End Closing (`close`, `rerun-requests`, `record-income-tax-filing`, `year-end-closings`)** workflows deferred from `P03.T09.S2`.
- **Two-Gate & Mixed-Entitlement Governance (`accounting-ia.md` §3):**
  - Base `#65` / `#66` admission: Feature `accounting.ledger.core` + Permission `accounting.period.read` (or `accounting.calendar.read`).
  - Mixed feature entitlements inside `#65`:
    - **Period Soft-Close / Reopen / Overrides (`periods/*`, `user-period-overrides/*`) & Open Year / Tax Filing Marker:** `accounting.ledger.core`.
    - **Year-End Close Execution (`POST /fiscal-years/:id/close`) & Closing History (`GET /year-end-closings*`):** Feature `accounting.close.checklist` + permissions `accounting.close.run_year_end` / `accounting.close.read` (if unentitled, the Year-End Close tab renders an inline `NotEntitledCard` without blocking period soft-close/reopen operations).
    - **Year-Close Rerun Request (`POST /fiscal-years/:id/rerun-requests`):** Feature `accounting.close.approvals` + permission `accounting.close.run_year_end`.

### 3.1 Shell, Layout & Year-End Close Components

1. **`#65` Operational Workspace (`/accounting/close/periods`):**
   - `AccountingScopeBar` (`COMPANY` scope) + Fiscal Year selector (`2025`, `2026`, …).
   - `PageHeader` with contextual single `variant="primary"` CTA for the selected fiscal year:
     - When `year.status === 'FUTURE'`: `فتح السنة المالية` / `Open Fiscal Year` (`POST /fiscal-years/:id/open`).
     - When `year.status === 'OPEN'` (or `'CLOSING'` during an approved rerun) and `accounting.close.checklist` + `accounting.close.run_year_end` are held: `إقفال السنة المالية…` / `Close Fiscal Year…` (opens `YearEndCloseModal`).
     - When `year.status === 'CLOSED'` and `incomeTaxFiledAt === null`: Secondary action `طلب إعادة إقفال السنة…` / `Request Year-Close Rerun…` (`POST /fiscal-years/:id/rerun-requests` -> `WaitingStateBadge` `WS-06` linking to `#8`) + Destructive/Irreversible outline action `تسجيل تقديم الإقرار الضريبي السنوي…` / `Record Income-Tax Filing…` (`POST /fiscal-years/:id/record-income-tax-filing`).
   - **4 Workspace Tabs:**
     - **Tab 1 — `مصفوفة حالات الفترات` / `Period State Matrix` (Reused from `S2`):** `PeriodStateMatrixView` (`OPEN <-> SOFT_CLOSED` via `POST /periods/:id/state` & all-or-nothing `POST /periods/bulk-state`; `CLOSED -> OPEN` via `POST /periods/:id/reopen` with mandatory reason & `PERIOD_REOPEN` `approvalRequestId` when required; clear callout that `NORMAL` period `CLOSED` / `PERMANENTLY_CLOSED` transitions are written **only** by `POST /accounting/close-instances/:id/lock`, never by `/periods/:id/state` per `D-150`, `D-474`). Clicking any period row opens `#66`.
     - **Tab 2 — `السنوات المالية وإقفال نهاية السنة` / `Fiscal Years & Year-End Close`:** `FiscalYearsPanelView` + `YearEndClosingsHistoryTable` (`GET /accounting/year-end-closings`) + `YearEndClosingReceiptDrawer` (`GET /accounting/year-end-closings/:id` showing `closingEntryId`, `openingEntryId`, `resultAmount`, `resultDeltaAmount`, `carriedForwardLineCount`, `asOfChainSeq`, `rerunOfId`, `rerunReason`, `carryingCheckpoints`).
     - **Tab 3 — `استثناءات المستخدمين المؤقتة` / `User Period Overrides` (Reused from `S2`):** `GET` and `POST /accounting/user-period-overrides`, `DELETE /accounting/user-period-overrides/:id` (`SOFT_CLOSED` posting window grants with `expiresAt` countdown).
     - **Tab 4 — `سجل إعادة فتح الفترات` / `Period Reopen Audit Log` (Reused from `S2`):** Read-only `GET /accounting/periods/reopen-log`.
2. **`#66` Single Period Close Detail (`/accounting/close/periods/[id]`):**
   - Header with period code, `kind` (`OPENING`, `NORMAL`, `ADJUSTMENT`, `CLOSING`), date range `<bdi dir="ltr">{startDate} .. {endDate}</bdi>`, `ETag` `v{version}`, and `4` module cards (`AR`, `AP`, `TAX`, `GL` in recommended lock order `D-473`) with direct link to the period's Close Checklist Instance (`/accounting/close/checklists` — `SCR-37`) for `CLOSED`/`PERMANENTLY_CLOSED` locking, plus scoped overrides and reopen log for `:id`.

### 3.2 Complete DTO & Projection Field Mapping (Year-End Close & Period Commands)

| DTO Name (`02_DTOs.md` §§4.2–4.3, §11, §13.1) | Field | Wire Type & Validation | UI Control & Contract Guard |
| --- | --- | --- | --- |
| `CloseFiscalYearDto` | `fiscalYearId` | `UUID` (`=== params.id`) | Bound to selected fiscal year |
| ↳ | `closingPeriodId` | `UUID` (`CLOSING` period of `fiscalYearId`) | `FiscalPeriodPicker` filtered to `kind = 'CLOSING'` of `:id` |
| ↳ | `openingPeriodId` | `UUID` (`OPENING` period `0` of `nextFiscalYearId`, must be `OPEN`) | `FiscalPeriodPicker` filtered to next fiscal year's `OPENING` period |
| ↳ | `retainedEarningsAccountId` | `UUID?` | Optional `AccountPicker` (`EQUITY` postable account; defaults to `RETAINED_EARNINGS` role) |
| ↳ | `rerunOfId` | `UUID?` (latest `YearEndClosing` id; required on rerun) | Auto-filled when `year.status === 'CLOSING'` on a rerun |
| ↳ | `approvalRequestId` | `UUID?` (`APPROVED` `YEAR_CLOSE_RERUN` request; required with `rerunOfId`) | Approved request selector / auto-bound from `#8` |
| ↳ | `reason` | `string?` (required with `rerunOfId`; UI enforces `10..500` chars — see `CG-S6-08`) | Mandatory rerun textarea (`<= 500` chars to satisfy `acc_year_end_closings.rerun_reason varchar(500)`) |
| `RequestYearCloseRerunDto` | `reason` | `string` (`10..500` chars after `.trim()`) | `ReasonDialog` on `CLOSED` eligible year (`D-234`) |
| `RecordIncomeTaxFilingDto` | `filedAt` | `ISO8601` (not in future, `>=` latest `YearEndClosing.runAt`) | Date-time input + irreversible confirmation checkbox |
| ↳ | `filingReference` | `string` (`1..80` chars) | LTR authority filing receipt reference |
| `ChangePeriodStateDto` | `module`, `toState`, `reason?` | `PeriodModule`, `'SOFT_CLOSED' \| 'OPEN'`, `string?` (`10..1,000` when `SOFT_CLOSED -> OPEN`) | `PeriodStateMatrixView` cell dialog (`S2`) |
| `BulkPeriodStateDto` | `targets`, `toState`, `reason?` | `Array<{ periodId: UUID, module: PeriodModule }>` (`1..100`), `'SOFT_CLOSED' \| 'OPEN'`, `string?` | Multi-cell bulk bar (`all-or-nothing`, `D-164`) |
| `ReopenPeriodDto` | `module`, `reason`, `approvalRequestId?` | `PeriodModule`, `string` (`10..1,000`), `UUID?` (`PERIOD_REOPEN`) | `ReopenPeriodDialog` (`CLOSED -> OPEN` only) |
| `CreateUserPeriodOverrideDto` | `periodId`, `module`, `userId`, `expiresAt`, `reason` | `UUID`, `PeriodModule`, `UUID`, `ISO8601`, `string` (`10..500`) | `GrantOverrideDrawer` (`SOFT_CLOSED` window) |
| `YearEndClosingDetailDto` (read) | `id`, `fiscalYearId`, `nextFiscalYearId`, `closingPeriodId`, `openingPeriodId`, `closingEntryId`, `openingEntryId`, `resultAmount`, `resultDeltaAmount`, `retainedEarningsAccountId`, `currentYearResultAccountId`, `carriedForwardLineCount`, `carryingCheckpoints`, `asOfChainSeq`, `rerunOfId`, `rerunReason`, `approvalRequestId`, `runBy`, `runAt` | Read-only append-only `acc_year_end_closings` projection (`no ETag / no version`) | `YearEndClosingsHistoryTable` & `YearEndClosingReceiptDrawer` |

### 3.3 Verbatim Endpoint & Action Matrix (Inventory Row `SCR-11` — `[P: 19]`)

Browser path = `/api/tenant/accounting/v1` + `Path`. Copied verbatim from `02_Endpoint_Catalogue.md` §3 (lines 123–141):

| UI Action | Role | Method | Catalogue Path | Permission | Feature key | Scope target | Idempotency | Concurrency | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| List fiscal years | `[P]` | `GET` | `/accounting/fiscal-years` | `accounting.calendar.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` |
| Read fiscal year + `ETag` | `[P]` | `GET` | `/accounting/fiscal-years/:id` | `accounting.calendar.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` + `ETag` |
| Create/roll fiscal year | `[P]` | `POST` | `/accounting/fiscal-years` | `accounting.calendar.create` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `none` | `201` + `Location` |
| Open fiscal year (`FUTURE->OPEN`) | `[P]` | `POST` | `/accounting/fiscal-years/:id/open` | `accounting.calendar.open_year` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` + `ETag` |
| Run year-end close / rerun | `[P]` | `POST` | `/accounting/fiscal-years/:id/close` | `accounting.close.run_year_end` | `accounting.close.checklist` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` + chain headers |
| Request `YEAR_CLOSE_RERUN` | `[P]` | `POST` | `/accounting/fiscal-years/:id/rerun-requests` | `accounting.close.run_year_end` | `accounting.close.approvals` | `COMPANY` | `x-idempotency-key` | `If-Match` | `202` + `Location` |
| Record income-tax filing | `[P]` | `POST` | `/accounting/fiscal-years/:id/record-income-tax-filing` | `accounting.fiscal_year.record_income_tax_filing` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` + `ETag` |
| List year-end closings | `[P]` | `GET` | `/accounting/year-end-closings` | `accounting.close.read` | `accounting.close.checklist` | `COMPANY` | `none` | `none` | `200` |
| Read year-end closing receipt | `[P]` | `GET` | `/accounting/year-end-closings/:id` | `accounting.close.read` | `accounting.close.checklist` | `COMPANY` | `none` | `none` | `200` |
| List periods | `[P]` | `GET` | `/accounting/periods` | `accounting.period.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` |
| Search periods | `[P]` | `POST` | `/accounting/periods/search` | `accounting.period.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` |
| Read single period `#66` | `[P]` | `GET` | `/accounting/periods/:id` | `accounting.period.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` + `ETag` |
| Soft-close / reopen soft-close | `[P]` | `POST` | `/accounting/periods/:id/state` | `accounting.period.change_state` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| Bulk soft-close / open | `[P]` | `POST` | `/accounting/periods/bulk-state` | `accounting.period.change_state` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `none` | `200` |
| Reopen `CLOSED` period | `[P]` | `POST` | `/accounting/periods/:id/reopen` | `accounting.period.reopen` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| Read period reopen log | `[P]` | `GET` | `/accounting/periods/reopen-log` | `accounting.period.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` |
| List user period overrides | `[P]` | `GET` | `/accounting/user-period-overrides` | `accounting.period.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` |
| Grant user period override | `[P]` | `POST` | `/accounting/user-period-overrides` | `accounting.period.override` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `none` | `201` |
| Revoke user period override | `[P]` | `DELETE` | `/accounting/user-period-overrides/:id` | `accounting.period.override` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `204` |

### 3.4 Critical Year-End States & Three-Part Bilingual Error Copy (`#65`, `#66`)

- **Committed Rerun Abandonment (`409 ACCOUNTING.CLOSE.RERUN_NOTHING_TO_CLOSE` — Critical UX Rule!):**
  - Per `02_Endpoint_Catalogue.md` §3 line 127 (`D-217`, `D-233`, `D-359`), when `POST /fiscal-years/:id/close` runs on a `CLOSING` rerun year and zero key movement occurred since the previous closing, the server **commits the abandonment before answering `409`** (re-closing `OPENING`/`ADJUSTMENT`/`CLOSING` period states, moving the fiscal year `CLOSING -> CLOSED`, rewriting `closed_at`, and writing no entry or receipt).
  - **UI Handling:** Immediately refetch `GET /fiscal-years/:id` and `GET /periods` on receiving `ACCOUNTING.CLOSE.RERUN_NOTHING_TO_CLOSE`, close the modal, and show an informational `caution` banner explaining that the year has been returned to `CLOSED` cleanly and any future late adjustment will need a fresh `YEAR_CLOSE_RERUN` request.
- **Irreversible Income-Tax Filing Marker (`POST /fiscal-years/:id/record-income-tax-filing`, `D-234`, `D-251`):**
  - Dialog displays a high-visibility warning: recording the income-tax filing moves the year's tax pools to `FILED` and **permanently disqualifies the fiscal year from any future `YEAR_CLOSE_RERUN`**.

| Error Code (HTTP) | Arabic Copy (`Cause` · `Record state` · `Safe next action`) | English Copy (`Cause` · `Record state` · `Safe next action`) |
| --- | --- | --- |
| `ACCOUNTING.CALENDAR.YEAR_NOT_CLOSABLE` (`409`) | **السبب:** لا تزال إحدى الفترات العادية (`NORMAL`) للسنة غير مقفلة (`CLOSED` أو `PERMANENTLY_CLOSED`) عبر مهام قفل قائمة الإقفال (`LOCK_AR` / `LOCK_AP` / `LOCK_TAX` / `LOCK_GL` · `D-023`, `D-474`). **حالة السجل:** بقيت السنة `OPEN` ولم يُرحّل قيد إقفال. **الإجراء الآمن:** افتح **قوائم مهام إقفال الفترات** وأكمل مهام القفل للفترات المفتوحة قبل إعادة تشغيل إقفال السنة. | **Cause:** At least one `NORMAL` period module is not yet `CLOSED` or `PERMANENTLY_CLOSED` via its close-instance `LOCK` tasks (`D-023`, `D-474`). **Record state:** The fiscal year remains `OPEN` and no closing entry was posted. **Safe next action:** Complete module `LOCK` tasks in **Period Close Checklists** for all `NORMAL` periods first. |
| `ACCOUNTING.CLOSE.RERUN_NOTHING_TO_CLOSE` (`409`) | **السبب:** لم تُرحّل أي قيود جديدة بعد آخر إقفال سنوي لهذه السنة (`D-359`). **حالة السجل:** **أعاد النظام إقفال فترات التسوية والإقفال وأعاد السنة إلى الحالة `CLOSED`** دون إنشاء قيد أو إيصال جديد. **الإجراء الآمن:** تم تحديث الشاشة تلقائياً؛ وإن احتجت قيد تسوية لاحق فاطلب اعتماد `YEAR_CLOSE_RERUN` جديداً. | **Cause:** No ledger movement occurred since the previous year-end close (`D-359`). **Record state:** **The rerun was abandoned and committed: reopened special periods and the fiscal year returned to `CLOSED`** with no new entry. **Safe next action:** The view has refreshed; submit a new `YEAR_CLOSE_RERUN` request only if a late adjustment is still needed. |
| `ACCOUNTING.CALENDAR.RERUN_NOT_ELIGIBLE` (`409` / `422`) | **السبب:** السنة المالية غير مؤهلة لإعادة الإقفال (إما تم تسجيل الإقرار الضريبي السنوي لها، أو تحتوي على فترة مقفلة نهائياً `PERMANENTLY_CLOSED`، أو أن السنة التالية مقفلة · `D-234`). **حالة السجل:** بقيت السنة `CLOSED` ولم يُفتح طلب اعتماد. **الإجراء الآمن:** سجّل أي تسوية مطلوبة كقيد في أول فترة مفتوحة من السنة المالية الحالية. | **Cause:** This fiscal year is ineligible for a close rerun (income-tax filing is already recorded, a period is `PERMANENTLY_CLOSED`, or the next year is closed · `D-234`). **Record state:** The year remains `CLOSED`; no rerun request was opened. **Safe next action:** Post required adjustments in the earliest open period of the current fiscal year. |
| `ACCOUNTING.TAX_RETURN.SNAPSHOT_UNAVAILABLE` (`503`) | **السبب:** تعذّر توليد وحفظ لقطة جدول التسويات الضريبية السنوي حالياً خارج المعاملة (`D-251`). **حالة السجل:** لم يُسجّل تقديم الإقرار الضريبي وبقيت مجمعات الضريبة دون تغيير. **الإجراء الآمن:** انتظر لحظات ثم أعد المحاولة بنفس البيانات. | **Cause:** The annual tax-adjustment schedule snapshot could not be rendered right now (`D-251`). **Record state:** Income-tax filing was not recorded and tax pools remain unchanged. **Safe next action:** Wait briefly and retry recording the filing. |

### 3.5 ASCII Mockups — Inventory Row `SCR-11` (`#65` & `#66` — All 4 Combinations + `<768px` Stack)

#### 3.5.1 Arabic RTL × Light (`[dir="rtl"][data-theme="light"]` — `#65` Year-End Close & Period Matrix)

```text
+----------------------------------------------------------------------------------------------------------------------+
| [شعار] متكامل · المحاسبة          [الشركة: شركة النيل للتجارة ▾] [السنة المالية: FY-2025 (CLOSED) ▾]         [☀️|AR] |
+---------------------------------------------------------------------------------------------------------+------------+
| إقفال الفترات ونهاية السنة المالية (#65)                                                                | القائمة    |
| [تسجيل تقديم الإقرار الضريبي السنوي…]  [طلب إعادة إقفال السنة YEAR_CLOSE_RERUN…]                        | الرئيسية   |
| تبويبات: [مصفوفة حالات الفترات]  [● السنوات المالية وإقفال نهاية السنة]  [استثناءات المستخدمين] [السجل] | ────────── |
+---------------------------------------------------------------------------------------------------------+ • الرئيسية |
| بطاقة السنة FY-2025: [● مقفلة CLOSED · v5] │ من 2025-01-01 إلى 2025-12-31 │ الإقرار الضريبي: غير مسجل   | • صندوق    |
| ── سجل عمليات إقفال نهاية السنة (GET /accounting/year-end-closings) ─────────────────────────────────── |   الاعتماد |
| الإجراء      │ القيد الافتتاحي التالي │ قيد الإقفال   │ صافي النتيجة (EGP) │ سطور مدورة │ تاريخ التنفيذ | • اليومية  |
| [الإيصال ←]  │ JE-2026-000001         │ JE-2025-09941 │ +1,840,250.00000000│ 148 سطراً  │ 2026-01-15    | ● الإقفال  |
+--------------+------------------------+---------------+--------------------+------------+---------------+   - الفترات|
```

#### 3.5.2 Arabic RTL × Dark (`[dir="rtl"][data-theme="dark"]` — `YearEndCloseModal` on `OPEN` / `CLOSING` Year)

```text
+----------------------------------------------------------------------------------------------------------------------+
| 🌙 [وضع داكن · ink-950 / ink-900 / ink-800]  نافذة تنفيذ إقفال السنة المالية (POST /fiscal-years/:id/close)          |
+----------------------------------------------------------------------------------------------------------------------+
| السنة المستهدفة: FY-2026 · الحالة: [OPEN · v2] · كافة الفترات العادية (1..12) مقفلة (CLOSED) عبر قوائم الإقفال ✓     |
| • فترة الإقفال (`closingPeriodId`):     [2026-P13 · CLOSING (2026-12-31) ▾]                                          |
| • الفترة الافتتاحية للسنة التالية (`openingPeriodId`): [2027-P00 · OPENING (2027-01-01 · OPEN) ▾]                    |
| • حساب الأرباح المبقاة (`retainedEarningsAccountId`):  [310201 · الأرباح المرحلة (افتراضي الدور) ▾]                  |
| [تنفيذ إقفال السنة وترحيل الأرصدة (أساسي - brand)]                                                      [إلغاء الأمر]|
+----------------------------------------------------------------------------------------------------------------------+
```

#### 3.5.3 English LTR × Light (`[dir="ltr"][data-theme="light"]` — `#65` Workspace + `#66` Period Detail)

```text
+----------------------------------------------------------------------------------------------------------------------+
| [Logo] Mutakamel · Accounting     [Company: Nile Trading Co. ▾] [Fiscal Year: FY-2025 (CLOSED) ▾]            [☀️|EN] |
+--------------------+-------------------------------------------------------------------------------------------------+
| Main Navigation    | Fiscal Periods & Year-End Close (#65)                                                           |
| ────────────────── | [Request Year-Close Rerun…]   [Record Income-Tax Filing…]                                       |
| • Home             | Tabs: [Period State Matrix] [● Fiscal Years & Year-End Close] [User Overrides] [Reopen Log]     |
| • Approval Inbox   +-------------------------------------------------------------------------------------------------+
| • Journals         | FY-2025 · [● CLOSED · v5] · 2025-01-01 .. 2025-12-31 · Income-Tax Filing: Not recorded          |
| ● Period Close     | Year-End Closing Runs (`GET /accounting/year-end-closings`):                                    |
|   - Periods (#65)  | Run At           | Result Amount (EGP) | Closing Entry  | Next Opening   | Lines | Action       |
|   - Checklists     | 2026-01-15 18:20Z| +1,840,250.00000000 | JE-2025-09941  | JE-2026-000001 | 148   | [Receipt ->] |
|                    +-------------------------------------------------------------------------------------------------+
|                    | ── Single Period Detail Preview (#66 /accounting/close/periods/0195b212-...) ────────────────── |
|                    | Period 2026-03 (`NORMAL` · 2026-03-01 .. 2026-03-31 · v4)  [Open Close Checklist SCR-37 ->]     |
|                    | Module Gates (D-473 order): [AR: CLOSED] -> [AP: CLOSED] -> [TAX: SOFT_CLOSED] -> [GL: OPEN]    |
+--------------------+-------------------------------------------------------------------------------------------------+
```

#### 3.5.4 English LTR × Dark (`[dir="ltr"][data-theme="dark"]` — `RecordIncomeTaxFilingDialog`)

```text
+----------------------------------------------------------------------------------------------------------------------+
| 🌙 [Dark Theme · ink-950 / ink-900 / ink-800]  Record Annual Income-Tax Filing (`POST /record-income-tax-filing`)    |
+----------------------------------------------------------------------------------------------------------------------+
| ┌─ Irreversible Statutory Freeze (negative / caution · D-234, D-251) ──────────────────────────────────────────────┐ |
| │ ! Recording the income-tax filing moves FY-2025 tax pools to `FILED`, pins the annual tax-adjustment schedule,   │ |
| │   and permanently blocks any future `YEAR_CLOSE_RERUN` for FY-2025.                                              │ |
| └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ |
| • Filed At (`filedAt`, >= 2026-01-15T18:20:00Z, not future): [2026-04-28T11:30:00Z        ]                          |
| • Authority Filing Reference (`filingReference`, 1..80):     [ETA-CIT-2025-9984120        ]                          |
| [x] I confirm the annual income-tax return is filed and FY-2025 will never be re-closed.                             |
| [← Cancel]                                                           [Record Income-Tax Filing (primary - brand)]    |
+----------------------------------------------------------------------------------------------------------------------+
```

#### 3.5.5 `<768px` (`375px`) Mobile Stack (`#65`, `#66`)
- Period State Matrix (`#65` Tab 1) collapses each period (`P00`..`P13`) into an expandable card showing the `4` module pills (`AR`, `AP`, `TAX`, `GL`) in a `2×2` grid (`min-h-11` tap targets).
- Year-end close receipts, rerun requests, and override revocations render as single-column drawers with full-width `44px` buttons.

---

## 4. Contract & Screen-Inventory Gaps for `P03.T11`

Every missing or mismatched field, route parameter, filter, or inventory assignment encountered while designing `SCR-09` and `SCR-11` is logged below — **never invented or assumed in wire calls**:

| Gap ID | Severity | Affected Screen & Surface | Exact Source Evidence | Gap Description & Recommended `P03.T11` Resolution |
| --- | --- | --- | --- | --- |
| **`CG-S6-01`** | Medium (Plan / Inventory Alignment) | `SCR-11` vs `SCR-38` (`#7`, `#8`, `#110`, `#111`, `#65`, `#66`) | `accounting-app-plan-p03-ux-foundation.md` (`P03.T09.S6`) & `agy-P03.T09.S6.md` vs `frontend/tenant-portal/docs/plans/accounting-screen-inventory.md` rows `SCR-11` & `SCR-38` | `P03.T09.S6` names `SCR-11` as **Approval Inbox** (`UC-CLR-3`, Catalogue §10 `approval-rules` & `approval-requests`), whereas `accounting-screen-inventory.md` renumbered Approvals to **`SCR-38`** (`design later`) and assigned **`SCR-11`** (`pending P03.T09.S6`) to **Fiscal Years, Period State Machine & Year-End Close** (`#65`, `#66`). Both are fully designed in this spec; update `accounting-screen-inventory.md` in `P03.T11` so both rows (`SCR-11` and `SCR-38`) are marked `designed (P03.T09.S6)` with unambiguous cross-links. |
| **`CG-S6-02`** | Low (Inventory Path Param Typo) | `#111` `/accounting/setup/approval-rules/[id]` | `accounting-screen-inventory.md` row `SCR-38` vs `02_Endpoint_Catalogue.md` §10 lines 1001–1002 | `accounting-screen-inventory.md` writes `PATCH /accounting/approval-rules/:id/steps/:stepId` and `DELETE .../steps/:stepId`, whereas `02_Endpoint_Catalogue.md` §10 authoritatively defines `:stepNo` (`PATCH /accounting/approval-rules/:id/steps/:stepNo`, `DELETE /accounting/approval-rules/:id/steps/:stepNo`). Correct `:stepId` -> `:stepNo` in `accounting-screen-inventory.md`. |
| **`CG-S6-03`** | **High (DTO vs ERD Authoring Gap)** | `#110`, `#111` Approval Rules (`POST` / `PATCH /approval-rules`) | `04_Static_Data/02_DTOs.md` §11.1–§11.2 (lines 3305–3311) vs `01_ERD/08_Close_and_Reporting_Tables.md` §4 (`acc_approval_rules`, lines 322–331) | `acc_approval_rules` defines `code` (`NOT NULL`), `name_i18n` (`NOT NULL`), `applies_to_branch_id`, `expires_after_hours`, `effective_from`, and `effective_to`, but `CreateApprovalRuleDto` only declares `{ documentType, conditions, priority, active?, steps }`, and neither `UpdateApprovalRuleDto` nor `ApprovalRuleListQueryDto` is declared in `02_DTOs.md`. Add `code`, `nameI18n`, `appliesToBranchId?`, `expiresAfterHours?`, `effectiveFrom?`, `effectiveTo?` to `CreateApprovalRuleDto`, and declare `UpdateApprovalRuleDto` & `ApprovalRuleListQueryDto` in `02_DTOs.md`. |
| **`CG-S6-04`** | **High (Enum vs Number Type Mismatch)** | `#110`, `#111` Approval Rule Steps (`ApprovalStepInput.quorum`) | `04_Static_Data/02_DTOs.md` line 3317 vs `04_Static_Data/01_Enums.md` line 3654 & `08_Close_and_Reporting_Tables.md` line 365 | `ApprovalStepInput.quorum` in `02_DTOs.md` is typed `number` (`1..20`), whereas `01_Enums.md` §16 and `acc_approval_steps.quorum` define `ApprovalQuorum` (`'ONE' \| 'ALL'`, default `'ONE'`). Align `ApprovalStepInput.quorum` (and step PATCH DTO) to `ApprovalQuorum` (`'ONE' \| 'ALL'`) in `02_DTOs.md`. |
| **`CG-S6-05`** | Medium (Workflow Ergonomics & Readback — refines `CG-WF-05`) | `SCR-09` `#116`, `#117` (`opening-balances`) | `02_Endpoint_Catalogue.md` §11 (lines 1102–1107) & `02_DTOs.md` §12.2, §13.1 (lines 3738–3771) | (1) `OpeningBalanceBatchDetailDto` returns summary counts, heads, and `validationFindings`, **not** the stored `acc_opening_balance_batch_lines` rows (`balances`, `openItems`, `instruments`, `assets`, `taxPools`, `inventoryLayers`, `inTransit`), preventing another user (e.g., the mandatory second actor under `D-759`!) from inspecting individual lines on `#117` before clicking `Post`. (2) Catalogue §11 has no `PATCH /accounting/opening-balances/:id` to fix a `DRAFT`/`VALIDATED` batch in place (forcing `cancel` + recreate). (3) `09_integration_and_posting_rules.md` mentions `ValidateOpeningBalanceBatchDto`, which is undeclared in `02_DTOs.md` (confirm empty request body `{}`). Recommend adding paginated `GET /accounting/opening-balances/:id/lines` (at minimum for `D-759` second-actor review) and confirming empty body on `POST /:id/validate`. |
| **`CG-S6-06`** | Medium (Inbox Filtering & Target Preview — refines `CG-WF-06`, `CG-WF-07`) | `#7`, `#8` Approval Inbox & Detail (`approval-requests`) | `02_DTOs.md` §11.1 (`ApprovalRequestListQueryDto`) & `08_Close_and_Reporting_Tables.md` (`acc_approval_requests`) | (1) `ApprovalRequestListQueryDto` lacks `assignedToMe?: boolean` (evaluating `ApproverKind` `USER`/`ROLE`/`GROUP` on `currentStepNo` minus `maker_user_ids` and prior-step approvers `D-467`/`D-560`), so approvers cannot filter `#7` strictly to requests actionable by them. (2) `ApprovalRequestSummaryDto`/`DetailDto` exposes `{ targetType, targetId }` without a human-readable `targetDisplayNo` / `targetSummary` on types other than `INBOX_POSITION_LOST` and `BANK_MATCH_CORRECTION`, requiring secondary per-module GETs on `#8`. |
| **`CG-S6-07`** | Low (Cross-App Picker Lookups — refines `CG-WF-08`) | `SCR-09` Step 3 & `#111` Step Editor | `CreateOpeningBalanceBatchDto` (`fulfillmentNodeId`, `itemId`) & `ApprovalStepInput` (`approverKind: 'ROLE' \| 'GROUP'`) | Confirm canonical Trade Gateway lookup path for `fulfillmentNodeId` (`streamHeads` / `inventoryLayers` / `inTransit`) and Core Gateway tenant role/group lookup routes for `ApproverKind = 'ROLE' \| 'GROUP'` so pickers do not fall back to raw UUID/key text inputs. |
| **`CG-S6-08`** | Low (Length Cap Mismatch) | `#65` Year-End Close Rerun (`CloseFiscalYearDto.reason`) | `04_Static_Data/02_DTOs.md` line 294 (`max 1,000`) vs `01_ERD/02_Ledger_Tables.md` line 1296 (`rerun_reason varchar(500)`) | `CloseFiscalYearDto.reason` allows up to `1,000` characters, whereas `acc_year_end_closings.rerun_reason` is `varchar(500)` (and `RequestYearCloseRerunDto.reason` is `10..500`). UI enforces `10..500` chars; tighten `CloseFiscalYearDto.reason` to `10..500` in `02_DTOs.md`. |

## Contract reconciliation (P03.T11, 1 November 2026)

Reconciles the gaps of this spec against the Endpoint Catalogue and `02_DTOs.md` after `D-770`, `D-771` and `D-772`. The gap list above keeps the original findings; these rulings are final.

| Gap id | Ruling | Where |
| --- | --- | --- |
| `CG-S6-01` | dropped (not contract) | Inventory identifier clash between `SCR-11` and `SCR-38` is an inventory-only correction, not a contract change |
| `CG-S6-02` | already in the contract | `PATCH` and `DELETE /accounting/approval-rules/:id/steps/:stepNo` (Endpoint Catalogue §10); the inventory spelling `:stepId` reads as `:stepNo` |
| `CG-S6-03` | closed by D-771 | `CreateApprovalRuleDto` gains `code`, `nameI18n`, `effectiveFrom`, `effectiveTo?`, `appliesToBranchId?`, `expiresAfterHours?`; `UpdateApprovalRuleDto` is declared; `ApprovalRuleListQueryDto` row added; module 08 §6 aligned |
| `CG-S6-04` | closed by D-771 | `ApprovalStepInput.quorum?: ApprovalQuorum` (default `ONE`); the `MAX_APPROVAL_STEPS` text and module 08 §6 follow |
| `CG-S6-05 (1)` | closed by D-771 | New route `GET /accounting/opening-balances/:id/lines` (`accounting.import.read`, `COMPANY`) returning paginated `OpeningBalanceBatchLineDetailDto` rows with their `payload`, plus its query DTO row |
| `CG-S6-05 (2)` | dropped (cancel and recreate) | No `PATCH /opening-balances/:id`; a corrected batch is a cancel and a new create (`D-676`) |
| `CG-S6-05 (3)` | closed by D-771 | `POST /accounting/opening-balances/:id/validate` takes an empty body with `If-Match` |
| `CG-S6-06 (1)` | closed by D-770 | `ApprovalRequestListQueryDto.assignedToMe?`, defined by module 08 rule 10's qualified-approver set |
| `CG-S6-06 (2)` | already in the contract | `ApprovalRequestSummaryDto` carries `targetType`, `targetId`, `amount`, `currencyCode`; the target is read with its own `GET` (a journal draft in stage 1) |
| `CG-S6-07` | dropped (not contract) | Trade-node and Core role or group pickers are frontend composition |
| `CG-S6-08` | deferred to stage 5 (P27.T01 definition of ready) | Tighten `CloseFiscalYearDto.reason` to 10..500 to fit `varchar(500)`; the stage-1 UI already enforces 500 |
