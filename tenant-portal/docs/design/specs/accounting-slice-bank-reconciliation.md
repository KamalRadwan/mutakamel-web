# Accounting Vertical Slice UX Specification — Bank Statement Import, Matching & Reconciliation Session (`SCR-26`)

> **Lead review, 1 November 2026 (P03.T10).** Five references were corrected: bank accounts carry `accounting.treasury.bank_reconciliation`, journals are picked with `GET /accounting/journals` (there is no journal lookup), bank feeds are `accounting.treasury.bank_connectivity`, and approvals are `accounting.close.approvals`. Every route, permission, feature key and scope below was checked against `backend/docs/LLD/accounting-app/02_API_Contracts/02_Endpoint_Catalogue.md`, `04_Static_Data/05_Permissions_and_Features.md` and `10_Feature_Tiers.md`; what the contracts lack stays in the contract gap list for `P03.T11`.

> **Document ID:** `P03.T10.S3` (`accounting-slice-bank-reconciliation.md`)
> **Status:** Draft for Lead Review (`P03.T12` promotion target: `frontend/tenant-portal/docs/design/specs/accounting-slice-bank-reconciliation.md`)
> **Tracker / Inventory Row:** `SCR-26` — Bank statement import, matching and reconciliation session (`13_Delivery_Plan.md` §3.6 vertical slice + Stage 4 `P25.T08` full-stage completions)
> **Primary IA Routes:**
> - `#54` `/accounting/reconcile/bank` — Bank Reconciliation Hub (Reconciliation Sessions, Bank Statements & Inline Split-Pane Statement Matching Workspace per `CG-16`, Matching Rules, Statement Templates)
> - `#55` `/accounting/reconcile/bank/[id]` — Reconciliation Session Proof, Readiness Gate & Lifecycle Workspace
> - Supporting Slice Prerequisite Subset on `#100` `/accounting/setup/banking` & `#101` `/accounting/setup/banking/[id]` (`P19.T05.S1` company bank account creation & lookup)
> **Feature Key:** `accounting.treasury.bank_reconciliation` (Slice prerequisite `bank-accounts`: `accounting.treasury.bank_reconciliation`)
> **Target Scope:** `COMPANY` (`bank-statements`, `bank-matching-rules`, `bank-reconciliations`, `bank-accounts`); `TENANT` (`bank-statement-templates`, surfaced with an explicit tenant-scope banner inside Tab 4)
> **Binding Governance:**
> - Tenant Portal Five Laws (`docs/design/README.md`, `docs/design/anti-patterns.md`)
> - Approved `P03` Foundation Specs: `accounting-ia.md`, `accounting-home.md`, `accounting-status-and-a11y.md`, `accounting-patterns-data.md`, `accounting-patterns-workflow.md`, `accounting-patterns-documents.md`, `accounting-stage1-journals.md`
> - Authoritative Backend Contracts: `02_Endpoint_Catalogue.md` §8 & §11–§12, `02_DTOs.md` §9 & §11–§13, `01_Enums.md` §14 & §16–§17, `04_Errors_and_Constants.md` §3.9–§3.10 & §6, `05_Permissions_and_Features.md` §4.6, `06_Treasury_Tables.md` §1 & §7, `06_treasury_and_banking.md` (`UC-TRS-2`, `UC-TRS-2a`, `UC-TRS-2b`, `UC-TRS-2c`), `06_User_Journey_Invoice_To_Cash.md` (`CASH-12`..`CASH-14`), `13_Delivery_Plan.md` §3.6

---

## 0. Governance, Inventory Alignment, Slice vs Stage-4 Boundary & Hook Architecture

### 0.1 Screen Inventory Alignment Note (`SCR-26` ↔ `SCR-29` & `SCR-25` Slice Prerequisite)

Cross-checking `backend/docs/plans/accounting-app-plan-p03-ux-foundation.md` (`P03.T10.S3`), `backend/docs/plans/accounting-app-inventory-frontend.md`, `backend/docs/plans/accounting-app-plan-p19-slice-cash-return-close.md` (`P19.T02.S2`, `P19.T05`, `P19.T06`, `P19.T10.S3`–`S4`), `backend/docs/plans/accounting-app-plan-p25-treasury-banking.md` (`P25.T08`, `P25.T09`, `P25.T11.S5`), `13_Delivery_Plan.md` §3.6, and `06_User_Journey_Invoice_To_Cash.md` (`CASH-12`..`CASH-14`) establishes two clerical discrepancies in `frontend/tenant-portal/docs/plans/accounting-screen-inventory.md` (logged as **`CG-BNK-01`** in §8 for `P03.T11`):

1. **Transposed row IDs (`SCR-26` ↔ `SCR-29`):** In `accounting-screen-inventory.md`, row `SCR-26` (line 98) carries the outbound payment-runs routes (`#34`–`#37`, Stage 4 `P25.T09` / `P25.T11.S5`), while row `SCR-29` (line 120, also mislabeled `UC-TRS-5` instead of `UC-TRS-2`, `2a`, `2b`, `2c`) carries the `[P: 27]` bank-reconciliation routes (`#54` `/accounting/reconcile/bank`, `#55` `/accounting/reconcile/bank/[id]`). Per `P03.T10.S3` and `13_Delivery_Plan.md` §3.6, **this specification designs the authoritative `SCR-26` bank-reconciliation screen family (`#54` and `#55` over the 27 `[P: 27]` routes)**. Outbound payments and payment runs belong to Stage 4 (`P25`).
2. **Company Bank Account slice prerequisite (`SCR-25` `#100`/`#101` `/accounting/setup/banking`):** Statement import (`ImportBankStatementDto.bankAccountId`) and reconciliation session creation (`CreateReconciliationSessionDto.bankAccountId`) require at least one company bank account (`acc_bank_accounts` linked `1:1` to a `BANK`-role GL account with `allowManualJournal = false`). `P19.T05.S1` builds `bank-accounts` in the vertical slice, whereas `accounting-screen-inventory.md` marked `SCR-25` `stage-only`. Section 1.7 specifies the minimal `[Slice]` company bank account setup subset on `/accounting/setup/banking` (`[S]` supporting routes) and the zero-account onboarding empty state on `#54`.

### 0.2 Delivery Partition — Vertical Slice (`P19`) vs Full Stage (`Stage 4` / `P25`)

Every feature, field, target type, and command in this specification carries an explicit **`[Slice]`** (`13_Delivery_Plan.md` §3.6, `P19.T05`–`P19.T06`, `P19.T10.S3`–`S4`) or **`[Stage 4]`** (`P25.T08`, `P25.T11.S2`–`S4`) delivery badge:

| Capability Area | **`[Slice]` Vertical Slice (`P19` — Invoice-to-Cash-to-Close)** | **`[Stage 4]` Full Treasury & Banking (`P25.T08`)** |
| --- | --- | --- |
| **Company Bank Account Context (`[S]`)** | List, lookup, detail, create, update (`ACTIVE`, `BLOCKED`, `CLOSED`), IBAN mod-97 validation (`VAL-TRS-01`), `1:1` `BANK`-role GL account link, masked `iban` / `accountNo` (`accounting.bank_account.view_sensitive` gate). | Authorized signatories CRUD & dual-signature thresholds (`accounting.payables.payment_runs`, `P25.T02`); Wave-2 bank feed connections (`accounting.treasury.bank_connectivity`). |
| **Statement Templates (`TENANT` scope)** | List & inspect Egypt-pack `PLATFORM` templates (`EG_CIB_CSV`, `EG_BM_XLSX`, `EG_NBE_CSV`, `EG_QNB_CSV`) + **Upload Your Bank's Template** 3-step wizard (`POST /accounting/bank-statement-templates`, `owner = TENANT`). | Same routes; template versioning (`version` column vs `version_lock` concurrency column) when cloning/retiring tenant templates. |
| **Statement Import & Lifecycle** | CSV/XLSX import against template (`POST /accounting/bank-statements/import`, `202 + Location`), optional two-phase `dryRun: true` preview + `POST /accounting/imports/:id/commit` (`D-498`), SHA-256 file/line deduplication (`D-459`), continuity check (`openingBalance == lastStatementClosingBalance`, `VAL-TRS-20`), list & paginated keyset lines (`1..500`). | **Discard Statement** (`POST /accounting/bank-statements/:id/discard` with `DiscardBankStatementDto`, `P25.T08.S1`) when `0` lines are `MATCHED` and all `bookingDate > lastReconciledOn`. |
| **Rule-Based Auto-Match & Rules CRUD** | `POST /accounting/bank-statements/:id/auto-match` (`202 + Location`, **proposals only — never auto-confirms**, `D-118`); Matching Rules list, detail, create, single `PATCH` (`L G N U`). | Matching Rules bulk priority/active update (`PATCH /accounting/bank-matching-rules/bulk-update` `200/207` `BulkResultPanel`), soft-delete (`DELETE`), and restore (`POST /:id/restore`) (`P25.T08.S2`). |
| **Human Match Confirmation (`ConfirmMatchDto`)** | Single-target confirmation (`allocations.length === 1`, or `SETTLEMENT` + fee/FX `DIRECT_POSTING` tolerance split) for **`SETTLEMENT`** (`AR` customer receipt clearing `UNDEPOSITED_FUNDS -> BANK` or direct bank receipt proof, `CASH-12`..`CASH-13`) and standalone **`DIRECT_POSTING`** (bank charges `BANK_CHARGES`, interest `INTEREST_INCOME` / `INTEREST_EXPENSE`, realized FX `FX_GAIN_LOSS_REALIZED`, `SUSPENSE`, `VAT_SETTLEMENT_CLEARING`). Tolerance reason required above `MAX_BANK_MATCH_TOLERANCE = "1.00000000"`. | Full 6-target confirmation (`PAYMENT` `SENT -> CLEARED`, `INSTRUMENT` `DEPOSITED/UNDER_COLLECTION -> COLLECTED` or `PRESENTED -> CLEARED` + `CLOSED`-account `paidStatementLineId` flow per `D-677`, `CASH_TRANSFER` `SENT/RECEIVED -> RECONCILED`, `JOURNAL_ENTRY` posted `BANK` line) and `1..N` (`<= 500`) multi-allocation splits (`P25.T08.S3`). |
| **Unmatch & Exclude** | `POST .../lines/:lineId/unmatch` (`UnmatchDto`, reverses match-created fee/posting journal entry in same command, refused on completed session range) and `POST .../lines/:lineId/exclude` (`ExcludeStatementLineDto`, closed `ExclusionReason` + mandatory reason `10..1,000` chars). | Same routes, plus instrument-allocation refusal (`ACCOUNTING.BANK.MATCH_CORRECTION_NOT_ALLOWED`) and refunded-AP-advance refusal (`ACCOUNTING.ADVANCE.NOT_CANCELLABLE`) recovery guidance. |
| **Reconciliation Session (`#55`)** | Create (`POST /accounting/bank-reconciliations`), proof equation banner (`difference == "0"`), readiness checklist, `submit-review` (`OPEN -> IN_REVIEW`), `reopen` (`IN_REVIEW -> OPEN`), `complete` (`OPEN | IN_REVIEW -> COMPLETED`, advances `lastReconciledOn`, satisfies `BANK_RECONCILED` period-close task, `CASH-14`), `cancel` (`OPEN | IN_REVIEW -> CANCELLED`, matched lines stay `MATCHED` per `D-290`). | **Forward Match Correction** on frozen completed sessions (`POST /accounting/bank-reconciliations/:id/correct-match` -> `201` `BANK_MATCH_CORRECTION` approval request + `<ApprovalPanel>` `UX-10` maker-checker execution, `UC-TRS-2c`, `D-297`, `D-677`, `P25.T08.S4`), plus `CLOSED`-account post-closure completeness rules. |

### 0.3 Non-Negotiable Tenant Portal Design & Accounting Laws Applied

1. **Outcome Colour Roles & Non-Colour Cues (`accounting-status-and-a11y.md` Group H, J, K):** Only `positive`, `caution`, `negative`, `pending`, and `neutral` (`ink`) tokens appear on badges, banners, and proof strips. `brand` is never used as a status badge. Every status pairs an icon/dot cue with its localized `t.status.<Enum>.<MEMBER>` string.
2. **Typography & Single Primary CTA:** Strictly weights `400` / `500` / `600` (`400` on all table body cells; `600` only on headers and KPI proof totals; zero `font-bold`, zero `text-[Npx]`, zero `rounded-xl`+). Each screen renders **at most one `Button variant="primary"`** in `PageHeader` / `DetailHeader`.
3. **Bilingual RTL/LTR & Logical CSS Only:** Zero physical directional utilities (`ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, `right-*`, `text-left`, `text-right` are banned; `pnpm design:rtl` enforces `0`). Zero language ternaries in JSX. Every number and date formats through `Intl` using Western digits (`ar-EG-u-nu-latn` in Arabic, `en-US` in English) with `tabular-nums`. Every IBAN, masked account number, statement ref, session number, journal entry number, SHA-256 prefix, ISO date, and signed decimal amount renders inside `<IdentifierText>` (`<bdi dir="ltr">`).
4. **DecimalString & UUIDv7 Invariants:** Client code **never** calls `Number()` or `parseFloat()` on `DecimalString` amounts or FX rates. Sign-closure and remaining-to-allocate checks in `useMatchAllocationBuilder` use exact integer-scaled `BigInt` (`scale = 8`, matching `NUMERIC(20,8)`) for advisory UI validation only; server figures remain authoritative. All idempotency keys (`x-idempotency-key`) and client allocation row keys come from `generateUUIDv7()` (`@/lib/uuid`), never `crypto.randomUUID()`.
5. **Split-Pane Inline Matching Workspace (`CG-16`):** Per `accounting-ia.md` (`CG-16`), bank statement detail and line matching do **not** occupy a separate URL route; selecting a statement row on `#54` `/accounting/reconcile/bank` opens the full-height split-pane Statement Matching Workspace inline (`?bankAccountId=<uuid>&tab=statements&statementId=<uuid>`), keeping the accountant in keyboard-driven flow (`↑`/`↓` line navigation, `Enter` inspect, `Alt+C` confirm, `Alt+E` exclude, `Alt+U` unmatch).

### 0.4 File & Custom Hooks Architecture (`<= 300` Lines per File)

All state, effects, polling, idempotency-key lifecycle, `ETag` concurrency tracking, and API validators live in dedicated hooks under `src/features/accounting/bank-reconciliation/hooks/`; `.tsx` views contain purely declarative markup and `@/design-system` imports:

| Hook / View Module | Responsibility (Each File `< 300` Lines) |
| --- | --- |
| `hooks/useBankReconciliationHub.ts` | Manages selected `bankAccountId` (persisted in URL search params), active tab (`sessions` \| `statements` \| `rules` \| `templates`), `POST /accounting/bank-accounts/lookup`, active bank account detail (`GET /accounting/bank-accounts/:id`), and `useAccountingBoundaryGate` / `PermissionGate` admission. |
| `hooks/useBankStatementImportWizard.ts` | Drives `FileImportWizard` (`UX-14` Mode B): template selection, header balance/date inputs, UUIDv7 `x-idempotency-key` per intent, `POST /accounting/bank-statements/import` (`202 + Location`), `AsyncProgressCard` polling (`GET /accounting/imports/:id`, `GET /accounting/imports/:id/errors`), and two-phase `POST /accounting/imports/:id/commit` / `cancel`. |
| `hooks/useStatementMatchingWorkspace.ts` | Loads statement header + `ETag` (`GET /accounting/bank-statements/:id`), keyset-paginated lines (`GET /accounting/bank-statements/:id/lines`, `limit = 100`, max `500`), line filter chips (`UNMATCHED`, `PROPOSED`, `MATCHED`, `EXCLUDED`), `POST /:id/auto-match` (`202 + Location` -> `GET /accounting/bulk-operations/:id`), keyboard navigation, and `[Stage 4]` `POST /:id/discard`. |
| `hooks/useMatchAllocationBuilder.ts` | Manages candidate search (`POST /accounting/settlements/search` in `[Slice]`; `payments`, `instruments`, `cash-transfers`, `journal-entries` in `[Stage 4]`), `AccountPicker` (`postingAccountRole`), `BigInt(scale=8)` exact signed `DecimalString` allocation sum vs line `amount`, `MAX_BANK_MATCH_TOLERANCE = "1.00000000"` `toleranceReason` gate, and `ConfirmMatchDto` / `UnmatchDto` / `ExcludeStatementLineDto` commands with `If-Match`. |
| `hooks/useBankMatchingRules.ts` | Drives Tab 3 Matching Rules list, detail + `ETag`, closed-grammar `conditions` builder (`CreateBankMatchingRuleDto` / `PATCH`), and `[Stage 4]` `bulk-update` (`200/207` `BulkResultPanel`), `DELETE`, and `restore`. |
| `hooks/useBankTemplateWizard.ts` | Drives Tab 4 `TENANT`-scope templates list (`GET /accounting/bank-statement-templates`) and the 3-step **Upload Your Bank's Template** wizard (`POST /accounting/bank-statement-templates`), encoding preview (`UTF-8` / `UTF-8-BOM` / `windows-1256`), `AmountMode` (`SIGNED` / `SPLIT` / `DIRECTION`), and closed 12-target column mapper. |
| `hooks/useReconciliationSessionWorkspace.ts` | Drives `#55` `/accounting/reconcile/bank/[id]`: `GET /accounting/bank-reconciliations/:id` + `ETag`, proof equation display, readiness checklist evaluation, and lifecycle transitions (`submit-review`, `reopen`, `complete`, `cancel`) with `If-Match` + UUIDv7 `x-idempotency-key`. |
| `hooks/useCorrectBankMatchDrawer.ts` | `[Stage 4]` Drives frozen-line forward match correction (`POST /accounting/bank-reconciliations/:id/correct-match`) on the account's `OPEN` session and wires `<ApprovalPanel>` (`UX-10`) to `BANK_MATCH_CORRECTION` approval actions (`approve`, `reject`, `withdraw`). |
| `hooks/useSliceBankAccountSetup.ts` | Drives the `[Slice]` company bank account setup prerequisite (`GET` and `POST /accounting/bank-accounts`, `PATCH /accounting/bank-accounts/:id` on `#100`/`#101` `/accounting/setup/banking`) and sensitive identifier reveal audit notice (`accounting.bank_account.view_sensitive`). |

---

## 1. Screen `#54` — `/accounting/reconcile/bank` (Bank Reconciliation Hub & Inline Statement Matching Workspace)

### 1.1 Route, Scope & Admission Gates

- **URL:** `/accounting/reconcile/bank?bankAccountId=<uuid>&tab=sessions|statements|rules|templates&statementId=<uuid>`
- **Shell Placement:** Accounting workspace -> **Reconcile** (`التسويات والمطابقة`) -> **Bank Reconciliation** (`التسوية البنكية`).
- **Scope (`AccountingScopeBar`):** `COMPANY` scope (`companyId` required; switching company resets `bankAccountId` and `statementId`). When `tab=templates`, a compact `TENANT`-scope info strip (`Alert variant="neutral"`) informs the user that statement templates belong to the whole tenant (`owner = PLATFORM | TENANT`).
- **Entitlement Gate (`useAccountingBoundaryGate`):** Requires `accounting.treasury.bank_reconciliation`. If unentitled, renders `<EntitledFeatureGate feature="accounting.treasury.bank_reconciliation" />` (never an empty table).
- **Route Permission Gate (`PermissionGate`):** Requires `accounting.bank_statement.read`. On `403`, renders `<PermissionGate permission="accounting.bank_statement.read" />` (`403` is never rendered as an empty state).

### 1.2 Persistent Header & Bank Account Context Strip

1. **`PageHeader`:**
   - **Title:** `t.accounting.bankReconciliation.hub.title` (`Bank Reconciliation` / `التسوية البنكية`)
   - **Subtitle:** `t.accounting.bankReconciliation.hub.subtitle`
   - **Single Primary Button (`variant="primary"` — Law 3):** Context-sensitive to the active tab so there is **never more than one filled primary button on screen**:
     - `tab=sessions` (or `tab=statements` when no statement exists yet): **Import Statement** (`استيراد كشف بنكي`) — visible/enabled when `can('accounting.bank_statement.import')` and selected bank account is not blocked from import; if `tab=sessions` and an imported statement has `UNMATCHED = 0` with no `OPEN` session, secondary button offers **New Reconciliation Session** (`جلسة تسوية جديدة`, `can('accounting.bank_statement.reconcile')`) — or when `tab=sessions` is focused and statements are already imported, **New Reconciliation Session** takes the single `variant="primary"` slot while **Import Statement** renders as `variant="secondary"`. *(Deterministic rule: `tab=sessions` -> primary = `New Reconciliation Session` [if `can('accounting.bank_statement.reconcile')`], secondary = `Import Statement`; `tab=statements` -> primary = `Import Statement` [if `can('accounting.bank_statement.import')`], or when inside the inline matching workspace with a selected `UNMATCHED`/`PROPOSED` line -> primary = `Confirm Match` [if `can('accounting.bank_statement.match')`]; `tab=rules` -> primary = `New Matching Rule` [if `can('accounting.bank_statement.manage_rules')`]; `tab=templates` -> primary = `Upload Bank Template` [if `can('accounting.bank_statement.configure')`]. At most ONE `variant="primary"` button exists in the DOM at any instant.)*
   - **Utility Actions (`variant="ghost"`):** `AccountingJobTrayTrigger` (`UX-13` async job tray badge showing running statement imports / auto-match runs) + Link to `/accounting/setup/banking` (`Manage Bank Accounts` / `إدارة الحسابات البنكية`, when `can('accounting.bank_account.read')`).
2. **Bank Account Context Bar (`Card` compact strip directly below `PageHeader`):**
   - **Bank Account Picker (`Combobox` backed by `POST /accounting/bank-accounts/lookup` + selected `GET /accounting/bank-accounts/:id`):** Displays `code` (`<IdentifierText>`), localized `nameI18n`, `bankName`, `currencyCode` pill, masked `iban` / `accountNo` (`<IdentifierText>` — full value shown only when user holds `accounting.bank_account.view_sensitive`, with tooltip noting sensitive-access audit).
   - **Account Status Badge:** `StatusBadge` for `BankAccountStatus` (`ACTIVE` / `BLOCKED` / `CLOSED`).
   - **Continuity & Freeze Anchors (read-only metadata pills):**
     - `openedOn` (`تاريخ فتح الحساب`)
     - `lastReconciledOn` (`آخر تاريخ مسوّى ومجمَّد` — `Lock` icon; tooltip explains that ledger postings and unmatches on or before this date are frozen by completed session evidence, `D-297`)
     - `lastStatementClosingBalance` (`آخر رصيد ختامي مستورد` via `<AccountingMoneyCell currency={account.currencyCode} amount={account.lastStatementClosingBalance} />`)
     - **Active Session Quick-Jump Pill:** When an `OPEN` or `IN_REVIEW` session exists for this `bankAccountId`, shows `<StatusBadge enum="ReconciliationSessionStatus" value={session.status} />` + `Link` to `/accounting/reconcile/bank/${session.id}` (`Open Session #${sessionNo}`).
   - **`CLOSED` Account Banner (`[Stage 4]` / `D-677`):** When `account.status === 'CLOSED'`, renders a `caution` banner stating `closedOn`, explaining that new outbound instructions and statements starting after `closedOn` are refused, while final closing-range reconciliation and post-closure late clearing records remain open until the closing session completes.

### 1.3 Tab 1 — Reconciliation Sessions (`جلسات التسوية البنكية`) `[Slice]`

- **`FilterBar`:** Status filter (`ALL`, `OPEN`, `IN_REVIEW`, `COMPLETED`, `CANCELLED`), Date range (`fromDate`, `toDate`). *(Note: `ReconciliationSessionListQueryDto` filter contract logged in `CG-BNK-03`.)*
- **`DataTable` (`GET /accounting/bank-reconciliations`):**
  - Columns (all body cells `font-normal` `400`, numbers `tabular-nums` in `<IdentifierText>`):
    1. `sessionNo` (`رقم الجلسة` — `Link` to `/accounting/reconcile/bank/${row.id}`)
    2. `fromDate` → `toDate` (`نطاق التسوية` — `<IdentifierText>2026-03-01 → 2026-03-31</IdentifierText>`)
    3. `statementClosingBalance` (`رصيد الكشف الختامي` — `—` with `Pending completion` hint while `null` before completion, or the live figure of `GET /accounting/bank-reconciliations/:id/proof` while `OPEN` or `IN_REVIEW`, `CG-BNK-04`, closed by `D-772`)
    4. `ledgerBalance` (`الرصيد الدفتري`)
    5. `difference` (`الفرق` — `0.00` `positive` pill when `COMPLETED`; `unmatchedLineCount` chip when `OPEN`/`IN_REVIEW`)
    6. `unmatchedLineCount` (`بنود غير مطابقة` — `caution` pill if `> 0`, `positive` `0` if ready)
    7. `status` (`الحالة` — `<StatusBadge enum="ReconciliationSessionStatus" />`)
    8. `completedAt` (`تاريخ الاعتماد`)
    9. Row action: `Open Workspace` (`فتح الجلسة` -> `#55`)
- **`New Reconciliation Session` Modal (`CreateReconciliationSessionDto` -> `POST /accounting/bank-reconciliations`, `201 + Location`):**
  - Requires `accounting.bank_statement.reconcile` + `x-idempotency-key` (UUIDv7).
  - Fields:
    - `bankAccountId` (read-only preselected from context bar, or `BankAccountPicker` if opened without one).
    - `fromDate` (`ISO Date`): **Auto-prefilled and locked-by-guidance** to `addDays(account.lastReconciledOn, 1)` when `account.lastReconciledOn !== null`, or `account.openedOn` for the account's very first session (`VAL-TRS-30` / `trg_acc_bank_reconciliation_sessions_sequence`). Inline helper explains why gaps or overlaps with `lastReconciledOn` are rejected (`422 ACCOUNTING.BANK.RECONCILIATION_SEQUENCE_INVALID`).
    - `toDate` (`ISO Date`, `>= fromDate`): Defaults to the `toDate` of the latest non-`DISCARDED` imported statement on this account. Shows an inline readiness hint if no imported statement ends on `toDate` yet (session creation still allowed so the accountant can open the session and import/match statements, while completion will require gapless coverage ending on `toDate`).
  - On `201 Created`, navigates via `router.push` to `/accounting/reconcile/bank/${created.id}`.

### 1.4 Tab 2 — Bank Statements & Inline Split-Pane Matching Workspace (`كشوف الحساب والمطابقة`)

Tab 2 has two views controlled by `?statementId=<uuid>` (per `CG-16`, avoiding a separate page route while giving full screen width to matching):

#### View 2A — Statements Register (`statementId` absent) `[Slice + Stage 4 discard]`

- **`FilterBar`:** `fromDate`, `toDate` (`BankStatementListQueryDto`, scoped to selected `bankAccountId`).
- **Exception Callout (`WS-07` / `BANK_UNMATCHED`):** If any statement on the selected account has lines `UNMATCHED` or `PROPOSED` older than `bank_unmatched_days` (`30` days default, `04_Errors_and_Constants.md` §6.1), renders `<WaitingStateCallout code="WS-07" />` highlighting the count of aged unmatched lines and a button to filter directly to the oldest affected statement.
- **`DataTable` (`GET /accounting/bank-statements`):**
  - Columns: `statementRef` (`مرجع الكشف`), `fromDate` → `toDate` (`الفترة`), `openingBalance` (`الرصيد الافتتاحي`), `closingBalance` (`الرصيد الختامي`), `lineCount` / `matchedCount` / `unmatchedCount` (`البنود: إجمالي / مطابق / متبقٍ`), `source` (`CSV_UPLOAD` \| `XLSX_UPLOAD` \| `MANUAL` \| `BANK_FEED`), `importedAt` (`تاريخ الاستيراد`), `status` (`<StatusBadge enum="BankStatementStatus" />`), and row actions:
    - **Match Lines** (`مطابقة البنود` -> sets `?statementId=${row.id}`) `[Slice]`
    - **`[Stage 4]` Discard Statement** (`استبعاد الكشف` -> opens `ReasonDialog` `10..200` chars -> `POST /accounting/bank-statements/:id/discard` with `If-Match` & `x-idempotency-key`): Enabled only when `row.status` is `IMPORTED` or `IN_RECONCILIATION`, `matchedCount === 0`, and `row.fromDate > account.lastReconciledOn` (`can('accounting.bank_statement.import')`).

#### Modal / Drawer — Bank Statement Import Wizard (`FileImportWizard` `UX-14` Mode B) `[Slice]`

Triggered by **Import Statement** (`can('accounting.bank_statement.import')`):

1. **Step 1 — Template, Statement Header & File Upload (`ImportBankStatementDto`):**
   - `bankAccountId` (locked to selected bank account; displays `lastStatementClosingBalance` as the expected `openingBalance` continuity anchor!).
   - `templateId` (`Combobox` over `GET /accounting/bank-statement-templates` filtered to `isActive = true` and compatible with `account.bankCode` + generic templates; includes inline ghost link `+ Upload your bank's template` if the tenant's bank format isn't listed).
   - `statementRef` (`Input`, required, `1..64` chars, e.g., `CIB-2026-03`).
   - `fromDate` & `toDate` (`DatePicker`, `fromDate <= toDate`; warns immediately if `fromDate <= account.lastReconciledOn` because `trg_acc_bank_statement_lines_reconciled_range` refuses lines inside a completed reconciliation range).
   - `openingBalance` (`MoneyInput`, signed `DecimalString`, auto-prefilled from `account.lastStatementClosingBalance` when non-null; if edited away from `lastStatementClosingBalance`, displays an immediate inline continuity warning per `VAL-TRS-20`).
   - `closingBalance` (`MoneyInput`, signed `DecimalString`, required).
   - `file` (`CSV` or `XLSX` dropzone, `<= 10 MB` / `<= 50,000` rows per `04_Errors_and_Constants.md` §5; the statement is the multipart `file` part and `ImportBankStatementDto` is the JSON `body` part; there is no `fileRef` field, `CG-BNK-02`, closed by `D-772`).
   - `dryRun` toggle (`Switch`, **default `true`** per `D-498`): Runs full template parsing, SHA-256 duplicate check (`D-459`), `opening + sum(movements) == closing` verification (`VAL-TRS-19`), and reconciled-range boundary check without committing rows until the user inspects the dry-run summary.
2. **Step 2 — Async Validation & Dry-Run Preview (`202 Accepted` + `Location`):**
   - Renders `AsyncProgressCard` (`UX-13` Tier 3) polling `GET /accounting/imports/:id` (`ImportJobSummaryDto`: `QUEUED` -> `VALIDATING` -> `DRY_RUN_COMPLETED` or `FAILED`).
   - **On `FAILED` / Row Errors:** Renders `ImportSafeErrorTable` (`GET /accounting/imports/:id/errors` -> `ImportResultDto.errors[]`: `rowNumber`, `column`, `code`, `message` — safe structured codes only, never echoing raw sensitive counterparty strings indiscriminately). Specific banners handle `ACCOUNTING.BANK.STATEMENT_DUPLICATE` (naming the colliding statement/line) and `ACCOUNTING.BANK.STATEMENT_BALANCE_MISMATCH` (showing declared closing vs `opening + movements`).
   - **On `DRY_RUN_COMPLETED`:** Displays `totalRows`, `validRows`, parsed opening/closing proof (`✓ Balanced`), and two actions: **Commit Import** (`POST /accounting/imports/:id/commit` with `{ importJobId }` + `x-idempotency-key`, `can('accounting.import.execute')`) or **Cancel Dry-Run** (`POST /accounting/imports/:id/cancel`). *(If user unchecked `dryRun`, `202` progresses directly to `COMPLETED` and opens the imported statement in View 2B.)*

#### View 2B — Inline Split-Pane Statement Matching Workspace (`?statementId=<uuid>`) `[Slice + Stage 4]`

- **Workspace Sub-Header (`StatementContextStrip`):**
  - Breadcrumb back button `← All Statements` (`كل الكشوف`), `statementRef` (`<IdentifierText>`), `fromDate → toDate`, `<StatusBadge enum="BankStatementStatus" />`, `openingBalance` → `closingBalance`, progress meter (`matchedCount / lineCount` + `excludedCount`), and **FX Snapshot Strip (`FxRateStrip` read-only)** when `statement.currencyCode !== company.functionalCurrencyCode`.
  - Secondary action buttons in strip:
    - **Run Auto-Match** (`تشغيل المطابقة الآلية المقترحة` -> `POST /accounting/bank-statements/:id/auto-match` with `If-Match` & UUIDv7 `x-idempotency-key`, `202 + Location` polled via `AsyncProgressCard` / `GET /accounting/bulk-operations/:jobId`, `can('accounting.bank_statement.match')`). Tooltip & helper banner explicitly state: *"Rules generate `PROPOSED` matches only; every line still requires human confirmation (`D-118`)."*
    - **`[Stage 4]` Discard Statement** (if eligible).
- **Responsive Two-Pane Split Layout (`grid-cols-1 lg:grid-cols-12 gap-4`):**
  - **Inline-Start Pane (`lg:col-span-7`) — Statement Lines Grid (`AccountingLedgerGrid` `mode="BANK_STATEMENT_LINES"`):**
    - Status quick-filter pills: `All` | `Unmatched` (`UNMATCHED`) | `Proposed` (`PROPOSED`) | `Matched` (`MATCHED`) | `Excluded` (`EXCLUDED`), plus value-date & min/max amount filter popover (`BankStatementLineListQueryDto`) and page-size selector (`limit`: `100` default, up to `500`, keyset `cursor`).
    - Columns (`font-normal` `400`, clickable row selection with active `border-s-2 border-brand` indicator):
      1. `lineNo` (`#`)
      2. `bookingDate` (`تاريخ القيد` — `<IdentifierText>`, with `Lock` icon if `bookingDate <= account.lastReconciledOn`)
      3. `valueDate` (`تاريخ الحق`)
      4. `description` / `reference` / `counterpartyText` (`البيان والمرجع` — `reference` & `counterpartyIban` in `<IdentifierText>`; `BankStatementLineSummaryDto` keeps `description`, `D-772`)
      5. `direction` + `amount` (`المبلغ` — signed `<AccountingMoneyCell>`: `CREDIT` inflow `+` vs `DEBIT` outflow `-`, never relying on colour alone; paired with `ArrowDownLeft` inflow / `ArrowUpRight` outflow icon)
      6. `status` (`<StatusBadge enum="BankStatementLineStatus" />`; when `PROPOSED`, displays confidence badge e.g. `95%` from `confidenceBp = 9500`)
    - Honest Grid Footer (`<tfoot>` per `CG-DATA-01`): Displays server-returned statement `openingBalance`, `closingBalance`, and loaded line count (`Showing N lines`) — **never sums paginated rows on the client**.
  - **Inline-End Pane (`lg:col-span-5`) — Line Inspector & Human Confirmation Builder (`MatchInspectorPanel`):**
    Adapts cleanly to the selected line's `status` and `bookingDate <= account.lastReconciledOn` freeze state:

    1. **Selected Line Summary Card:** Shows `lineNo`, `bookingDate`, `valueDate`, `direction`, `amount` (always positive; the sign lives in `direction`, `<AccountingMoneyCell>`), `reference`, `counterpartyText`, `counterpartyIban` (`<IdentifierText>`), `bankTransactionCode`, and raw statement attributes disclosure.
    2. **Case A — Line is `PROPOSED` (Rule Proposal Pending Human Confirmation) `[Slice]`:**
       - Renders a `pending` Proposal Callout naming the matched rule (`ruleCode`), confidence (`confidenceBp / 100`%), proposed target (`SETTLEMENT #SET-...` or `DIRECT_POSTING -> BANK_CHARGES`, etc.), and any proposed tolerance difference.
       - Actions: **Confirm Proposal** (`Button variant="primary"` — single primary CTA on screen when a matchable line is focused -> `POST .../lines/:lineId/match` with `{ statementLineId, acceptProposalId, allocations }` + `If-Match` + `x-idempotency-key`), **Edit Allocation Manually** (`variant="secondary"`), **Reject Proposal to Unmatched** (`POST .../lines/:lineId/unmatch` with `UnmatchDto`), or **Exclude Line** (`ReasonDialog` -> `POST .../lines/:lineId/exclude`).
    3. **Case B — Line is `UNMATCHED` (Allocation Builder) `[Slice + Stage 4]`:**
       - **Mode Switcher (`SegmentedControl`):**
         - **`[Slice]` Tab `SETTLEMENT` (`تسوية عميل / مقبوضات`):** Searches open/unreconciled settlements (`POST /accounting/settlements/search`, `CASH-12`..`CASH-13`) matching currency and bank/undeposited-funds context. Selecting a candidate pre-fills `allocations[0] = { refType: 'SETTLEMENT', refId, amount }`. If `abs(line.amount) !== abs(settlement.amount)` (e.g., bank deducted a transfer fee or FX rounding difference), an inline **Add Fee / Difference Split (`+ DIRECT_POSTING`)** button adds a second `BankMatchAllocationDto` row (`refType: 'DIRECT_POSTING'`, `postingAccountRole: 'BANK_CHARGES' | 'FX_GAIN_LOSS_REALIZED' | ...`, signed `amount` equal to the exact `BigInt(scale=8)` remainder) so `sum(allocations.amount) === line.amount` (`VAL-TRS-25` / `D-300`)!
         - **`[Slice]` Tab `DIRECT_POSTING` (`قيد مباشر من الكشف`):** Posts a balanced GL entry directly from the statement line (`refType: 'DIRECT_POSTING'`, `refId` omitted) against a closed `postingAccountRole` selector (`AccountPicker` restricted to `BANK_CHARGES`, `INTEREST_INCOME`, `INTEREST_EXPENSE`, `FX_GAIN_LOSS_REALIZED`, `SUSPENSE`, `VAT_SETTLEMENT_CLEARING`). Displays the balanced Dr/Cr preview (`BANK` account vs role-mapped GL account).
         - **`[Stage 4]` Additional Target Tabs (`P25.T08.S3`):**
           - `PAYMENT` (`دفعة مورد` — `POST /accounting/payments/search`, transitions `SENT -> CLEARED`; never rendered in `[Slice]` build).
           - `INSTRUMENT` (`شيك / ورقة تجارية` — `POST /accounting/instruments/search`, transitions `DEPOSITED | UNDER_COLLECTION -> COLLECTED` or `PRESENTED -> CLEARED`; on a `CLOSED` account, offers `Record Paid Outbound Cheque on Statement Line` flow supplying `paidStatementLineId` per `D-677`).
           - `CASH_TRANSFER` (`تحويل خزينة/بنك` — `GET /accounting/cash-transfers`, transitions `SENT | RECEIVED -> RECONCILED`).
           - `JOURNAL_ENTRY` (`قيد يومية مرحَّل` — `POST /accounting/journal-entries/search` for an existing posted `BANK` line).
           - **Multi-Allocation Split (`1..500` rows):** `[Stage 4]` unlocks `+ Add Target Allocation` across multiple invoices/settlements/payments on a single bulk bank movement.
       - **Exact Sign & Remainder Bar (`BigInt` scale-8 advisory check):**
         - Shows `Line Amount` (`مبلغ البند`), `Allocated Total` (`إجمالي التوزيع`), and `Remaining` (`المتبقي للتوزيع`).
         - **Confirm Match** (`POST /accounting/bank-statements/:id/lines/:lineId/match`) is disabled until `Remaining === "0.00000000"`, every allocation is non-zero, and sign rules hold (`+` on `DEBIT`, `-` on `CREDIT`, except a `DIRECT_POSTING` beside an object allocation which may carry either sign per `02_DTOs.md` line 2678).
       - **Tolerance Reason Gate (`MAX_BANK_MATCH_TOLERANCE = "1.00000000"`):** Whenever the tolerated difference across allocations exceeds `"1.00000000"` in account currency, `toleranceReason` (`Textarea`, `10..1,000` chars) becomes required on every difference-carrying allocation before submission (`422 ACCOUNTING.BANK.MATCH_AMOUNT_TOLERANCE`).
       - **Exclude Line Action (`variant="secondary"`):** Opens `ExcludeLineDialog` (`ExcludeStatementLineDto`: `exclusionReason` select over `NOT_OUR_MOVEMENT`, `OPENING_BALANCE_LINE`, `DUPLICATE_LINE`, `PRIOR_PERIOD`, `MANUAL` + mandatory `reason` `10..1,000` chars -> `POST .../lines/:lineId/exclude`, `can('accounting.bank_statement.exclude')`).
    4. **Case C — Line is `MATCHED` or `EXCLUDED`:**
       - Displays the immutable confirmed allocation list (`refType`, clickable link to target document/journal entry `createdJournalEntryId`, `amount`, `matchedBy`, `matchedAt`, `toleranceReason`) or exclusion details (`exclusionReason`, `reason`).
       - **If `bookingDate > account.lastReconciledOn` (Unfrozen `[Slice]`):** Renders **Unmatch Line** (`إلغاء المطابقة` -> `ReasonDialog` `10..1,000` chars -> `POST .../lines/:lineId/unmatch`, `can('accounting.bank_statement.unmatch')`). Dialog warns explicitly if unmatching will automatically reverse a match-created `DIRECT_POSTING` journal entry or return a `CLEARED` Stage-4 payment to `SENT`. (If an allocation is an `INSTRUMENT`, button is disabled with tooltip citing `D-437`: instrument clearings reverse through the instrument bounce/dishonour lifecycle, not `unmatch`.)
       - **If `bookingDate <= account.lastReconciledOn` (Frozen by Completed Session Evidence):**
         - `Unmatch` is permanently hidden/replaced by a `Lock` evidence notice (`D-290`, `D-297`: *"Completed reconciliation sessions are immutable audit evidence."*).
         - **`[Stage 4]` Request Forward Match Correction (`تصحيح مطابقة سابقة باعتماد ثنائي`):** Enabled when `can('accounting.bank_statement.reconcile')`, the allocation is not an `INSTRUMENT`, and the bank account currently has an `OPEN` reconciliation session (or offers a 1-click prompt to open the current reconciliation session on `#55` and launch `CorrectBankMatchDrawer`). If a `BANK_MATCH_CORRECTION` approval is already `PENDING` on this line, renders `<WaitingStateCallout code="WS-06" />` linking directly to the open session `#55`.

### 1.5 Tab 3 — Matching Rules (`قواعد المطابقة الآلية`) `[Slice: L G N U | Stage 4: BU D R]`

- **Zero Auto-Confirm Governance Callout (`Alert variant="neutral"`):** Always visible at top of Tab 3: *"Matching rules only rank and propose matches (`PROPOSE_MATCH`, `PROPOSE_POSTING`, `PROPOSE_EXCLUSION`). No rule ever posts or confirms a statement line without human confirmation (`D-118`)."*
- **`DataTable` (`GET /accounting/bank-matching-rules`):**
  - Ordered by deterministic `priority ASC`.
  - Columns: `priority` (`الأولوية`), `code` (`الكود`), localized `nameI18n` (`الاسم`), scope (`All Bank Accounts` or specific `bankAccountCode`), `direction` (`DEBIT` / `CREDIT` / `Any`), `targetKinds[]` chips, `action` (`MatchingRuleAction`), `confidenceBp` (`درجة الثقة %`), `isActive` (`نشط`), and row actions:
    - `[Slice]` **Edit Rule** (`تعديل` -> `Drawer` fetching `GET /accounting/bank-matching-rules/:id` for `conditions` + `ETag`, saving via `PATCH /accounting/bank-matching-rules/:id` with `If-Match` & `x-idempotency-key`, `can('accounting.bank_statement.manage_rules')`).
    - `[Stage 4]` Row selection checkboxes + **Bulk Reorder / Toggle Active** (`PATCH /accounting/bank-matching-rules/bulk-update` -> `200/207` `BulkResultPanel` `UX-13` Tier 2), **Delete** (`DELETE /:id` with `If-Match`), and **Restore** (`POST /:id/restore` when viewing deleted rows).
- **Rule Drawer (`CreateBankMatchingRuleDto` / `UpdateBankMatchingRuleDto`):**
  - Strictly closed condition builder (**zero free-form regex or script expressions**, `D-047` / `VAL-TRS-23`):
    - Identity & Scope: `code` (`<= 40`), `nameI18n.ar` & `nameI18n.en`, `bankAccountId?` (optional account filter), `priority` (`int >= 1`), `direction?` (`DEBIT` \| `CREDIT` \| `ALL`), `confidenceBp` (`0..10000`, rendered as `0.00%..100.00%` input mapped to basis points).
    - Action & Targets: `action` (`PROPOSE_MATCH` \| `PROPOSE_POSTING` \| `PROPOSE_EXCLUSION`), `targetKinds` multi-select (`SETTLEMENT`, `DIRECT_POSTING` in `[Slice]`; all 6 `MatchTargetKind` members in `[Stage 4]`). When `action === 'PROPOSE_POSTING'` or `targetKinds` includes `DIRECT_POSTING`, requires `postingAccountRole` (`AccountRole` subset) and `postingJournalId` (`GET /accounting/journals` filtered to `BANK` / general journals).
    - Closed `conditions` fieldset: `amountToleranceAbs` (`MoneyInput` >= 0), `amountToleranceBp` (`0..500` bp = `0%..5%`), `dateWindowDays` (`0..30` days), `referenceMatch` (`EXACT` \| `CONTAINS` \| `NONE`), `counterpartyMatch` (`IBAN` \| `NORMALIZED_NAME` \| `NONE`), `partyResolution` (`PARTY_BANK_ACCOUNT` \| `COUNTERPARTY_TEXT` \| `NONE`), `bankTransactionCodes` tag input (`0..50` codes, each `<= 32` chars).

### 1.6 Tab 4 — Statement Templates (`قوالب كشوف البنوك`) `[Slice]`

- **`TENANT` Scope Banner:** Explains that templates registered here (`scope: TENANT`) are shared across all companies in the tenant, while Egypt-pack templates (`owner = PLATFORM`: `EG_CIB_CSV`, `EG_BM_XLSX`, `EG_NBE_CSV`, `EG_QNB_CSV`) are read-only platform baselines (`409 ACCOUNTING.PACK.ROW_IMMUTABLE` if modified; clone to customize).
- **`DataTable` (`GET /accounting/bank-statement-templates`):**
  - Columns: `code`, `nameI18n`, `bankCode`, `format` (`CSV` \| `XLSX`), `amountMode` (`SIGNED` \| `SPLIT` \| `DIRECTION`), `encoding` (`UTF-8` \| `UTF-8-BOM` \| `windows-1256`), `owner` (`PLATFORM` \| `TENANT`), `version`, `isActive`, and **Inspect** drawer (`GET /accounting/bank-statement-templates/:id`, concurrency header derived from `version_lock`).
- **3-Step Modal Wizard — "Upload Your Bank's Template" (`رفع قالب البنك الخاص بك` -> `POST /accounting/bank-statement-templates`, `201 + Location`, `can('accounting.bank_statement.configure')`):**
  - **Step 1 (Sample File & Format):** Upload sample CSV/XLSX from the user's bank (client-side preview parser reads first 25 rows locally without mutating books; optional `sampleFileRef`), enter `code`, `nameI18n.ar`, `nameI18n.en`, `bankCode`, `format` (`CSV` \| `XLSX`), `encoding` (`UTF-8`, `UTF-8-BOM`, `windows-1256` for Arabic bank exports), `delimiter` (CSV), `sheetName` (XLSX), `headerRow` (`>= 1`), `firstDataRow` (`> headerRow`).
  - **Step 2 (Closed 12-Target Column Mapping & Amount/Date Rules):** Map sample columns onto the closed target dictionary (`bookingDate` [required], `valueDate`, `amount` [when `SIGNED`/`DIRECTION`], `debitAmount` & `creditAmount` [when `SPLIT`], `direction` + `directionMap` [when `DIRECTION`], `currencyCode`, `bankReference`, `counterpartyName`, `counterpartyIban`, `description`, `runningBalance`, `bankTransactionCode`), plus `dateFormat` (e.g. `dd/MM/yyyy`, `yyyy-MM-dd`), `decimalSeparator` (`.` \| `,`), `thousandsSeparator`, `negativeStyle` (`MINUS` \| `PARENTHESES` \| `TRAILING_MINUS`).
  - **Step 3 (Balance Locators, Skip Patterns & Effective Date):** Configure optional header cell/row locators (`openingBalanceLocator`, `closingBalanceLocator`), closed `skipRowPatterns` (e.g., footer summary rows), and `effectiveFrom` (`ISO Date`). Submits with UUIDv7 `x-idempotency-key`.

### 1.7 Supporting Slice Prerequisite — Company Bank Accounts (`#100` `/accounting/setup/banking` & `#101` `/accounting/setup/banking/[id]`) `[Slice Subset: P19.T05.S1]`

When `#54` loads for a company that has zero bank accounts (`GET /accounting/bank-accounts` returns `total = 0`), `#54` renders a guided onboarding `EmptyState` with a direct CTA to `/accounting/setup/banking` (or inline creation drawer when `can('accounting.bank_account.create')`):

- **Slice Subset (`[S]` routes under `accounting.treasury.bank_reconciliation`):**
  - List (`GET /accounting/bank-accounts`), Detail (`GET /accounting/bank-accounts/:id` + `ETag`), Create (`POST /accounting/bank-accounts`, `CreateBankAccountDto`), Update (`PATCH /accounting/bank-accounts/:id`, `UpdateBankAccountDto` + `If-Match`).
  - **Key Form Fields & Validations:** `code` (`<= 32`), `nameI18n` (`ar`/`en`), `bankCode` (`<= 16`), `bankName` (`<= 200`), `branchName?`, `accountNo` (`<= 64`), `iban?` (`<= 34`, validated against ISO 13616 country length + mod-97, `422 ACCOUNTING.BANK.IBAN_INVALID`), `swiftBic?` (`8` or `11` chars), `currencyCode` (`ISO 4217`), `glAccountId` (`AccountPicker` restricted to postable `BANK`-role accounts not yet claimed by another bank account or cash box; UI explains `allowManualJournal = false` enforcement), `openedOn` (`ISO Date` — anchors the first reconciliation session's `fromDate`!).
  - **Sensitive Identifier Protection:** `accountNo` and `iban` render masked (`EG38••••••••••••1234`) unless `/auth/me` includes `accounting.bank_account.view_sensitive`.
  - **`[Stage 4]` Deferred Tabs on `#101`:** Authorized Signatories & Mandate Thresholds (`signatories[]`, `signatoryPolicy`, `requiresSecondSignatureAbove` under `accounting.payables.payment_runs`, `P25.T02`) and Bank Feed Connections (Wave 2 `accounting.treasury.bank_connectivity`) are hidden behind their respective feature gates during the vertical slice.

---

## 2. Screen `#55` — `/accounting/reconcile/bank/[id]` (Reconciliation Session Proof & Lifecycle Workspace)

### 2.1 Route, Scope & Admission Gates

- **URL:** `/accounting/reconcile/bank/[id]`
- **Shell Placement:** Breadcrumb `Accounting` -> `Bank Reconciliation` (`/accounting/reconcile/bank?bankAccountId=...&tab=sessions`) -> `Session #{sessionNo}` (`<IdentifierText>`).
- **Scope (`AccountingScopeBar`):** `COMPANY` (`companyId` must match `session.companyId`; switching company navigates back to `/accounting/reconcile/bank`).
- **Gates:** Feature `accounting.treasury.bank_reconciliation` (`useAccountingBoundaryGate`) + Permission `accounting.bank_statement.read` (`PermissionGate`).

### 2.2 `DetailHeader` & Deterministic Single Primary Action (`Law 3`)

- **Identity:** `sessionNo` (`<IdentifierText>`), Bank Account pill (`code` + `nameI18n` + `currencyCode`), Date Range `<IdentifierText>{fromDate} → {toDate}</IdentifierText>`, Fiscal Period chip (`periodId`), `<StatusBadge enum="ReconciliationSessionStatus" value={session.status} />`, and concurrency version badge (`v{session.version}`).
- **Action Bar (At most ONE `variant="primary"` button at any state, gated on `can('accounting.bank_statement.reconcile')`):**

| `session.status` | Readiness (`canComplete`) | Single `variant="primary"` Button | `variant="secondary"` / `variant="ghost"` Actions |
| --- | --- | --- | --- |
| `OPEN` | `false` (unmatched lines, statement gap, difference `!= 0`, or pending correction) | **Go to Statement Matching** (`متابعة مطابقة الكشف` -> navigates to `#54` `?bankAccountId=...&tab=statements&statementId=...`) | `Complete Reconciliation` (rendered `disabled` with popover listing exact unmet gate items), `Submit for Review` (`disabled` until `unmatchedLineCount === 0`), `Cancel Session` (`ghost` destructive -> `ReasonDialog`), `[Stage 4]` `Correct Prior Frozen Match` (`secondary`). |
| `OPEN` | `true` (all gates green, `difference === "0.00000000"`) | **Complete Reconciliation** (`اعتماد وإتمام التسوية` -> confirmation modal -> `POST /accounting/bank-reconciliations/:id/complete`) | `Submit for Review` (`إحالة للمراجعة` -> `POST /:id/submit-review`), `Cancel Session` (`إلغاء الجلسة` -> `ReasonDialog` -> `POST /:id/cancel`), `[Stage 4]` `Correct Prior Frozen Match`. |
| `IN_REVIEW` | `true` | **Complete Reconciliation** (`اعتماد وإتمام التسوية` -> `POST /:id/complete`) | `Reopen Session` (`إعادة فتح الجلسة` -> `ReasonDialog` `10..1,000` chars -> `POST /:id/reopen`), `Cancel Session` (`POST /:id/cancel`). |
| `IN_REVIEW` | `false` | **Reopen Session** (`إعادة فتح الجلسة` -> `POST /:id/reopen`) | `Complete Reconciliation` (`disabled` with gate explanation), `Cancel Session`. |
| `COMPLETED` | Terminal immutable evidence (`D-290`) | *(None — zero primary mutation buttons on terminal evidence)* | `Back to Sessions` (`secondary`), `Download Reconciliation Report` (`secondary` — gated on `CG-BNK-06` signed download route; shows `completedBy`, `completedAt`, `reconciledUntil`). |
| `CANCELLED` | Terminal | *(None)* | `Back to Sessions` (`secondary`), `Cancelled Reason` disclosure (`session.cancelledReason`). |

### 2.3 Reconciliation Proof Equation Banner (`VAL-TRS-31`, Zero Client Float Math)

Directly beneath `DetailHeader`, a full-width 6-column mathematical proof card (`Card` with `tabular-nums` `<AccountingMoneyCell>` values in `session.currencyCode`) renders the exact `06_Treasury_Tables.md` §7.2 step 9 equation:

$$\text{Statement Closing} + \text{Outstanding Deposits} - \text{Outstanding Cheques / Payments} - \text{Ledger Balance (as at } \texttt{toDate}\text{)} - \text{Posted After } \texttt{toDate}\text{ (Carried)} = \text{Difference}$$

| Column | DTO Field (`ReconciliationSessionDetailDto`) | Operator | Visual & Null-Before-Completion Handling (`CG-BNK-04`) |
| --- | --- | --- | --- |
| 1. Statement Closing Balance (`رصيد الكشف الختامي`) | `statementClosingBalance` | — | Server `DecimalString`. *(The session row stores these terms only at completion; while `OPEN` or `IN_REVIEW` the banner reads `ReconciliationProofDto` from `GET /accounting/bank-reconciliations/:id/proof` (`live: true`, computed by the completion's rules without its lock and stored nowhere), and on `COMPLETED` or `CANCELLED` the stored figures. A term that is still `null` shows the `Computed on completion` badge, never a client-side sum; `D-772`.)* |
| 2. Outstanding Deposits (`إيداعات بالطريق غير ظاهرة بالكشف`) | `outstandingDeposits` | `$+$` | Unmatched `DEBIT` ledger entries on `BANK` GL account dated `<= toDate`. |
| 3. Outstanding Cheques / Outflows (`شيكات ومدفوعات لم تُصرف`) | `outstandingCheques` | `$-$` | Unmatched `CREDIT` ledger entries on `BANK` GL account dated `<= toDate`. |
| 4. GL Ledger Balance (`الرصيد الدفتري في تاريخ النهاية`) | `ledgerBalance` | `$-$` | Posted `BANK` GL balance up to `toDate`. |
| 5. Carried After-`toDate` Postings (`قيود مرحَّلة بعد تاريخ النهاية ومحمولة بالجلسة`) | `postedAfterToDateAmount` | `$-$` | Net (`DEBIT - CREDIT`) ledger lines dated `> toDate` whose clearing was confirmed onto a statement line `<= toDate` (`D-285`, `D-290`). Always non-null (`default 0`). |
| 6. **Reconciliation Difference (`فرق التسوية`)** | `difference` | `$=$` | **`"0.00000000"`:** `positive` surface + `CheckCircle2` `Proved (0.00) / متطابق تماماً`. **Non-zero:** `negative` surface + `Scale` `Unproved — Zero-override law: difference must be 0.00 to complete` (`D-118`, `D-285`). |

### 2.4 Session Readiness Gate Checklist (`VAL-TRS-30`)

A compact horizontal/collapsible readiness checklist explains **why** `Complete Reconciliation` is enabled or disabled before the user clicks:

1. **Statement Continuity (`تغطية الكشوف بدون فجوات`):** Live non-`DISCARDED` statements cover `fromDate..toDate` without date gaps, and a statement ends exactly on `toDate`.
2. **All Statement Lines Resolved (`حسم جميع بنود الكشف`):** `unmatchedLineCount === 0` (`0` `UNMATCHED` and `0` `PROPOSED` lines across the session range; every line is `MATCHED` or `EXCLUDED`).
3. **Zero Proof Difference (`تصفير فرق التسوية`):** `difference === "0.00000000"` (zero accepted-difference override).
4. **`[Stage 4]` Match Corrections Approved (`اعتماد تصحيحات المطابقة`):** Zero `BANK_MATCH_CORRECTION` requests recorded on this session remain `PENDING` (`D-677`).
5. **`[Stage 4]` Closed-Account Post-Closure Completeness (`اكتمال قيود ما بعد إقفال الحساب`):** Shown only when `bankAccount.status === 'CLOSED'` (`D-677`): every non-reversed late record or correction target dated `> closedOn` is carried by a live statement allocation.

### 2.5 Session Workspace Tabs (`#55` Body)

1. **Tab A — Statement Lines in Session Range (`بنود الكشف ضمن الجلسة`) `[Slice]`:**
   - Read-only / quick-jump view of statements covering `session.fromDate..session.toDate` (`GET /accounting/bank-statements` + `GET /accounting/bank-statements/:statementId/lines`), defaulting filter to `UNMATCHED` + `PROPOSED` when `unmatchedLineCount > 0` so the operator sees blockers immediately, with a 1-click `Resolve in Matching Workspace` link into `#54` View 2B.
2. **Tab B — Unmatched Ledger & Carried After-`toDate` Items (`بنود الدفاتر المعلقة والمحمولة`) `[Slice]`:**
   - Displays `unmatchedLedgerCount` summary (`outstandingDeposits` and `outstandingCheques` that remain open in the GL for future statements — informational, does *not* block completion when `difference == 0`) alongside `postedAfterToDateAmount` explanation (`D-285`: e.g. a match-created bank charge journal entry posted in the current open period after `toDate` because `toDate`'s fiscal period was soft-closed). *(Itemized by `GET /accounting/bank-reconciliations/:id/outstanding-items`: `ReconciliationOutstandingItemDto` rows with `side` `DEPOSIT` or `CHEQUE`, filter `side`, `D-772`.)*
3. **`[Stage 4]` Tab C — Forward Match Corrections & Approvals (`تصحيحات المطابقات المعتمدة سابقاً`) (`UC-TRS-2c`, `D-297`, `D-677`, `P25.T08.S4`):**
   - Explains the forward-correction rule: completed sessions (`<= lastReconciledOn`) are never reopened; instead, a wrong non-instrument allocation on a frozen line is corrected forward inside the bank account's current `OPEN` session under two-person maker-checker approval (`BANK_MATCH_CORRECTION`).
   - **Record Match Correction Drawer (`CorrectBankMatchDto` -> `POST /accounting/bank-reconciliations/:id/correct-match`, `201 + Location`, `If-Match`, `x-idempotency-key`):**
     - Available only while `session.status === 'OPEN'` and `can('accounting.bank_statement.reconcile')`.
     - Step 1: Pick the frozen statement line (`bookingDate <= account.lastReconciledOn`) and its live non-instrument allocation (`wrongMatchId`).
     - Step 2: Pick the replacement target (`correctRefType`: `PAYMENT` \| `INSTRUMENT` \| `SETTLEMENT` \| `CASH_TRANSFER` \| `JOURNAL_ENTRY` \| `DIRECT_POSTING`, `correctRefId?`, `postingAccountRole?` when `DIRECT_POSTING`, `differencePostingAccountRole?` when target amount differs within `MAX_BANK_MATCH_TOLERANCE = "1.00000000"` — note any difference above tolerance is refused outright on corrections per `04_Errors_and_Constants.md` line 523!).
     - Step 3: Mandatory `reason` (`10..1,000` chars). Submitting creates a `PENDING` `BANK_MATCH_CORRECTION` approval request (`201`).
   - **Embedded `<ApprovalPanel>` (`UX-10` from `accounting-patterns-workflow.md`):**
     - Lists every `BANK_MATCH_CORRECTION` approval request associated with this session (`POST /accounting/approval-requests/search`, detail `GET /accounting/approval-requests/:id`, history `GET /accounting/approval-requests/:id/actions`).
     - Renders the **frozen `requestBody` snapshot** (`wrongMatchId` -> `correctRefType` / `correctRefId`, amounts, `differencePostingAccountRole`, `reason` per `D-677`) alongside `<ApprovalStepTrack>`.
     - **Maker-Checker SoD Enforcement (`D-146`):** If `currentUser.id` is in `makerUserIds` (the user who recorded `correct-match`), `Approve` is hidden/disabled with explicit SoD explanation (`403 ACCOUNTING.APPROVAL.MAKER_IS_APPROVER`); the maker sees **Withdraw** (`POST /accounting/approval-requests/:reqId/withdraw`, `can('accounting.approval.withdraw')`). A second authorized actor (`can('accounting.approval.approve')` / `can('accounting.approval.reject')`) sees **Approve Correction** (`POST .../approve` with `If-Match` & `x-idempotency-key`) and **Reject** (`POST .../reject` + `ReasonDialog`).

### 2.6 Complete Confirmation Modal (`CompleteReconciliationDto`) `[Slice]`

Clicking **Complete Reconciliation** opens a high-clarity confirmation dialog (`AlertDialog`) before calling `POST /accounting/bank-reconciliations/:id/complete` (`If-Match` + UUIDv7 `x-idempotency-key`):
- Payload: `{ sessionId: session.id, reconciledUntil: session.toDate }`. *(Note: `reconciledUntil` is locked to `session.toDate` so the user cannot accidentally submit a mismatched date.)*
- Explicit Irreversibility Notice:
  1. Advances `bankAccount.lastReconciledOn` to `<IdentifierText>{session.toDate}</IdentifierText>`.
  2. Permanently freezes all statement lines and `BANK` GL postings on or before `{session.toDate}` (`COMPLETED` sessions can never be reopened; future corrections require two-person `correct-match` in a later open session).
  3. Satisfies the `BANK_RECONCILED` period-close checklist task once every active bank account of the company is reconciled through the period end (`CASH-14`).

---

## 3. Verbatim Field-to-DTO Mapping Tables

Every field rendered or submitted by `#54`, `#55`, and the `#100`/`#101` slice prerequisite maps 1:1 to `02_DTOs.md` §9 & §13.1 and `06_Treasury_Tables.md` §1 & §7. Unknown keys are never sent (`forbidNonWhitelisted`).

### 3.1 Statement Import & Discard DTOs (`#54` Tab 2)

| UI Element | DTO & Property | Wire Type & Validation Bounds (`02_DTOs.md` §9.3) | Delivery |
| --- | --- | --- | --- |
| Bank Account | `ImportBankStatementDto.bankAccountId` | `string` (`UUIDv7`, required) | `[Slice]` |
| Statement Reference | `ImportBankStatementDto.statementRef` | `string` (`1..64` chars, required) | `[Slice]` |
| Statement Template | `ImportBankStatementDto.templateId` | `string` (`UUIDv7`, required) | `[Slice]` |
| Statement File | multipart part `file` (no `fileRef` field) | `CSV` or `XLSX`; the server stores the bytes and derives key, hash, type and size (`D-772`) | `[Slice]` |
| Period From Date | `ImportBankStatementDto.fromDate` | `string` (`ISO Date`, required, `> lastReconciledOn`) | `[Slice]` |
| Period To Date | `ImportBankStatementDto.toDate` | `string` (`ISO Date`, required, `>= fromDate`) | `[Slice]` |
| Opening Balance | `ImportBankStatementDto.openingBalance` | `DecimalString` (`SIGNED_DECIMAL_REGEX`, matches `lastStatementClosingBalance`) | `[Slice]` |
| Closing Balance | `ImportBankStatementDto.closingBalance` | `DecimalString` (`SIGNED_DECIMAL_REGEX`, `== opening + sum(lines)`) | `[Slice]` |
| Dry-Run Preview Toggle | `ImportBankStatementDto.dryRun` | `boolean?` (optional, UI defaults `true` per `D-498`) | `[Slice]` |
| Commit Dry-Run Job ID | `CommitImportDto.importJobId` | `string` (`UUIDv7`, matches `:id` on `POST /accounting/imports/:id/commit`) | `[Slice]` |
| Discard Statement Reason | `DiscardBankStatementDto.reason` | `string` (`10..200` chars, required on `POST /:id/discard`) | `[Stage 4]` |

### 3.2 Statement Header, Line & Match Confirmation / Unmatch / Exclude DTOs (`#54` View 2B)

| UI Element | DTO & Property | Wire Type & Validation / Projection (`02_DTOs.md` §9.1, §9.3, §13.1) | Delivery |
| --- | --- | --- | --- |
| Statement Summary/Detail | `BankStatementSummaryDto` / `DetailDto` | `id`, `companyId`, `bankAccountId`, `statementRef`, `source` (`StatementSource`), `templateId`, `fromDate`, `toDate`, `currencyCode`, `openingBalance`, `closingBalance`, `lineCount`, `matchedCount`, `unmatchedCount`, `status` (`BankStatementStatus`), `importedAt`, `version` (`ETag` on detail; `file_ref` withheld per §13.1 rule 1) | `[Slice]` |
| Line Query Filters | `BankStatementLineListQueryDto` | `statementId` (`UUID`), `status?` (`BankStatementLineStatus`), `fromValueDate?`, `toValueDate?`, `minAmount?`, `maxAmount?`, `cursor?`, `limit?` (`1..500`, default `100`) | `[Slice]` |
| Statement Line Row | `BankStatementLineSummaryDto` (`D-772`) | `id`, `companyId`, `statementId`, `bankAccountId`, `lineNo`, `valueDate`, `bookingDate`, `direction` (`LineDirection`: `DEBIT` \| `CREDIT`), `amount` (`DecimalString`, `> 0`), `currencyCode`, `fxRateSnapshot`, `runningBalance`, `reference`, `normalizedReference`, `counterpartyText`, `counterpartyIban`, `bankTransactionCode`, `description`, `partyId`, `status` (`BankStatementLineStatus`), `proposedRefType`, `proposedRef`, `matchRuleId`, `matchProposalId`, `matchConfidence`, `matchedBy`, `matchedAt`, `exclusionReason`, `exclusionNote`, `excludedBy`, `excludedAt`, `reconciliationSessionId`, `rowHash`, `allocations[]` (live match rows: `matchedRefType`, `matchedRef`, `postingAccountRole`, `matchedEntryId`, `amount`, `postedAfterToDate`, `correctionId`), audit columns, `version` | `[Slice]` |
| Confirm — Line ID | route `:lineId` | not a body field: the controller sets `ConfirmMatchDto.statementLineId` from the path and a body copy is refused with `400` (DTOs §2, `D-772`) | `[Slice]` |
| Confirm — Proposal ID | `ConfirmMatchDto.acceptProposalId` | `string?` (`UUIDv7`, supplied when accepting a `PROPOSED` match) | `[Slice]` |
| Allocation — Target Kind | `BankMatchAllocationDto.refType` | `MatchTargetKind`: `'SETTLEMENT' \| 'DIRECT_POSTING'` in `[Slice]`; adds `'PAYMENT' \| 'INSTRUMENT' \| 'CASH_TRANSFER' \| 'JOURNAL_ENTRY'` in `[Stage 4]` | `[Slice]` / `[Stage 4]` |
| Allocation — Target ID | `BankMatchAllocationDto.refId` | `string?` (`UUIDv7`; required when `refType !== 'DIRECT_POSTING'`, omitted on `DIRECT_POSTING`) | `[Slice]` |
| Allocation — Signed Amount | `BankMatchAllocationDto.amount` | `DecimalString` (`SIGNED_DECIMAL_REGEX`, non-zero; `+` on `DEBIT`, `-` on `CREDIT`, either sign on `DIRECT_POSTING` beside object; `sum == line.amount`) | `[Slice]` |
| Allocation — Posting Role | `BankMatchAllocationDto.postingAccountRole` | `AccountRole?` (`'BANK_CHARGES' \| 'INTEREST_INCOME' \| 'INTEREST_EXPENSE' \| 'FX_GAIN_LOSS_REALIZED' \| 'SUSPENSE' \| 'VAT_SETTLEMENT_CLEARING'`; required when `refType === 'DIRECT_POSTING'`) | `[Slice]` |
| Allocation — Tolerance Note | `BankMatchAllocationDto.toleranceReason` | `string?` (`10..1,000` chars; required when line tolerated difference `> "1.00000000"`) | `[Slice]` |
| Unmatch — Line ID & Reason | `UnmatchDto.statementLineId`, `.reason` | `statementLineId`: `UUIDv7` (`== :lineId`); `reason`: `string` (`10..1,000` chars) | `[Slice]` |
| Exclude — Line, Code, Note | `ExcludeStatementLineDto` | `statementLineId`: `UUIDv7` (`== :lineId`); `exclusionReason`: `'NOT_OUR_MOVEMENT' \| 'OPENING_BALANCE_LINE' \| 'DUPLICATE_LINE' \| 'PRIOR_PERIOD' \| 'MANUAL'`; `reason`: `string` (`10..1,000` chars) | `[Slice]` |

### 3.3 Matching Rules & Statement Templates DTOs (`#54` Tabs 3 & 4)

| UI Element | DTO & Property | Wire Type & Validation Bounds (`02_DTOs.md` §9.3 & `06_Treasury_Tables.md` §7.1) | Delivery |
| --- | --- | --- | --- |
| Rule Identity & Scope | `CreateBankMatchingRuleDto` | `code` (`1..40`), `nameI18n` (`LocalizedText`), `bankAccountId?` (`UUID`), `priority` (`int >= 1`), `direction?` (`DEBIT` \| `CREDIT`) | `[Slice]` |
| Rule Targets & Action | `CreateBankMatchingRuleDto` | `targetKinds`: `MatchTargetKind[]` (`1..6`), `action`: `'PROPOSE_MATCH' \| 'PROPOSE_POSTING' \| 'PROPOSE_EXCLUSION'`, `postingAccountRole?`, `postingJournalId?` (`UUID`), `confidenceBp` (`int 0..10000`) | `[Slice]` |
| Rule Conditions (Closed) | `BankMatchingRuleConditionsDto` | `amountToleranceAbs` (`DecimalString`), `amountToleranceBp` (`int 0..500`), `dateWindowDays` (`int 0..30`), `referenceMatch` (`EXACT` \| `CONTAINS` \| `NONE`), `counterpartyMatch` (`IBAN` \| `NORMALIZED_NAME` \| `NONE`), `bankTransactionCodes` (`string[]`, `0..50` × `<=32`), `partyResolution` (`PARTY_BANK_ACCOUNT` \| `COUNTERPARTY_TEXT` \| `NONE`) | `[Slice]` |
| Template Summary/Detail | `BankStatementTemplateSummaryDto` / `DetailDto` | `id`, `tenantId`, `owner` (`PLATFORM` \| `TENANT`), `packCode?`, `code`, `nameI18n`, `bankCode`, `version` (template version), `format` (`CSV` \| `XLSX`), `amountMode` (`SIGNED` \| `SPLIT` \| `DIRECTION`), `dateFormat`, `decimalSeparator`, `thousandsSeparator?`, `negativeStyle` (`MINUS` \| `PARENTHESES` \| `TRAILING_MINUS`), `headerRow`, `firstDataRow`, `sheetName?`, `delimiter?`, `encoding`, `effectiveFrom`, `effectiveTo?`, `isActive`, `versionLock` (`ETag` source); Detail adds `columns`, `directionMap`, `openingBalanceLocator`, `closingBalanceLocator`, `skipRowPatterns` *(Create DTO logged in `CG-BNK-03`)* | `[Slice]` |

### 3.4 Reconciliation Session & Forward Match Correction DTOs (`#55`)

| UI Element | DTO & Property | Wire Type & Validation Bounds (`02_DTOs.md` §9.3–§9.4) | Delivery |
| --- | --- | --- | --- |
| Create Session | `CreateReconciliationSessionDto` | `bankAccountId` (`UUID`), `fromDate` (`ISO Date` == `lastReconciledOn + 1d` or `openedOn`), `toDate` (`ISO Date >= fromDate`) | `[Slice]` |
| Session Detail & Proof | `ReconciliationSessionDetailDto` | `id`, `companyId`, `bankAccountId`, `statementId?`, `sessionNo`, `periodId`, `fromDate`, `toDate`, `currencyCode`, `statementClosingBalance` (`DecimalString \| null`), `ledgerBalance` (`DecimalString \| null`), `outstandingDeposits` (`DecimalString \| null`), `outstandingCheques` (`DecimalString \| null`), `postedAfterToDateAmount` (`DecimalString`), `difference` (`DecimalString \| null`), `reconciledUntil` (`string \| null`), `unmatchedLineCount` (`number`), `unmatchedLedgerCount` (`number`), `status` (`ReconciliationSessionStatus`), `completedBy`, `completedAt`, `cancelledReason`, `version` (`number` / `ETag`) *(live pre-completion proof in `CG-BNK-04`)* | `[Slice]` |
| Reopen Session | `ReopenReconciliationSessionDto.reason` | `string` (`10..1,000` chars, `IN_REVIEW -> OPEN`) | `[Slice]` |
| Complete Session | `CompleteReconciliationDto` | `sessionId` (`UUID == :id`), `reconciledUntil` (`ISO Date == session.toDate`) | `[Slice]` |
| Cancel Session | `CancelReconciliationSessionDto.reason` | `string` (`10..200` chars per `cancelled_reason varchar(200)`; `CancelReconciliationSessionDto`, `D-772`) | `[Slice]` |
| Forward Match Correction | `CorrectBankMatchDto` | `statementLineId` (`UUID`), `wrongMatchId` (`UUID`), `correctRefType` (`PAYMENT` \| `INSTRUMENT` \| `SETTLEMENT` \| `CASH_TRANSFER` \| `JOURNAL_ENTRY` \| `DIRECT_POSTING`), `correctRefId?` (`UUID`), `postingAccountRole?`, `differencePostingAccountRole?`, `reason` (`10..1,000` chars) | `[Stage 4]` |

### 3.5 Supporting Slice Prerequisite — Company Bank Account DTOs (`#100`/`#101`)

| UI Element | DTO & Property | Wire Type & Validation Bounds (`02_DTOs.md` §9.1–§9.2) | Delivery |
| --- | --- | --- | --- |
| Account List Filters | `BankAccountListQueryDto` | `currencyCode?` (`ISO 4217`), `status?` (`BankAccountStatus`), `bankCode?` (`<= 16`) | `[Slice]` |
| Create Bank Account | `CreateBankAccountDto` | `code` (`<= 32`), `nameI18n`, `bankCode` (`<= 16`), `bankName` (`<= 200`), `branchName?` (`<= 200`), `accountNo` (`<= 64`), `iban?` (`<= 34`, mod-97), `swiftBic?` (`8 \| 11`), `currencyCode` (`ISO 4217`), `glAccountId` (`UUID`, `BANK` role), `openedOn` (`ISO Date`); *(Stage 4 adds `signatoryPolicy?`, `requiresSecondSignatureAbove?`, `signatories?`)* | `[Slice]` |
| Update Bank Account | `UpdateBankAccountDto` | `nameI18n?`, `branchName?`, `status?` (`ACTIVE` \| `BLOCKED` \| `CLOSED`), `closedOn?` (`ISO Date`, required when `status === 'CLOSED'`) | `[Slice]` |

---

## 4. Verbatim Endpoint, Permission, Feature & Concurrency Matrix

All browser requests go through `src/lib/api/axiosClient.ts` to `/api/tenant/accounting/v1/...` (mapping catalogue `/accounting/...` without duplicating `/accounting`). Every column below is copied verbatim from `02_Endpoint_Catalogue.md` §8, §7, §1, §5, §11, and §12.

### 4.1 Primary `[P: 29]` Endpoints Owned by `SCR-26` (`02_Endpoint_Catalogue.md` §8, lines 816–842; rows 28 and 29 added by `D-772`)

| # | Method & Catalogue Path | Browser Gateway Path | Permission | Feature Key | Scope | Idempotency | Concurrency | Status | Delivery |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `GET /accounting/bank-statements` | `/api/tenant/accounting/v1/bank-statements` | `accounting.bank_statement.read` | `accounting.treasury.bank_reconciliation` | `COMPANY` | `none` | `none` | `200` | `[Slice]` |
| 2 | `GET /accounting/bank-statements/:id` | `/api/tenant/accounting/v1/bank-statements/:id` | `accounting.bank_statement.read` | `accounting.treasury.bank_reconciliation` | `COMPANY` | `none` | `none` | `200` + `ETag` | `[Slice]` |
| 3 | `GET /accounting/bank-statements/:id/lines` | `/api/tenant/accounting/v1/bank-statements/:id/lines` | `accounting.bank_statement.read` | `accounting.treasury.bank_reconciliation` | `COMPANY` | `none` | `none` | `200` (`1..500`) | `[Slice]` |
| 4 | `POST /accounting/bank-statements/import` | `/api/tenant/accounting/v1/bank-statements/import` | `accounting.bank_statement.import` | `accounting.treasury.bank_reconciliation` | `COMPANY` | `x-idempotency-key` (`7 d`) | `none` | `202` + `Location` | `[Slice]` |
| 5 | `POST /accounting/bank-statements/:id/discard` | `/api/tenant/accounting/v1/bank-statements/:id/discard` | `accounting.bank_statement.import` | `accounting.treasury.bank_reconciliation` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` | `[Stage 4]` |
| 6 | `POST /accounting/bank-statements/:id/auto-match` | `/api/tenant/accounting/v1/bank-statements/:id/auto-match` | `accounting.bank_statement.match` | `accounting.treasury.bank_reconciliation` | `COMPANY` | `x-idempotency-key` | `If-Match` | `202` + `Location` | `[Slice]` |
| 7 | `POST /accounting/bank-statements/:id/lines/:lineId/match` | `/api/tenant/accounting/v1/bank-statements/:id/lines/:lineId/match` | `accounting.bank_statement.match` | `accounting.treasury.bank_reconciliation` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` (+ chain hdrs) | `[Slice]` (`SETTLEMENT`, `DIRECT_POSTING`) / `[Stage 4]` (all 6 + split) |
| 8 | `POST /accounting/bank-statements/:id/lines/:lineId/unmatch` | `/api/tenant/accounting/v1/bank-statements/:id/lines/:lineId/unmatch` | `accounting.bank_statement.unmatch` | `accounting.treasury.bank_reconciliation` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` (+ chain hdrs) | `[Slice]` |
| 9 | `POST /accounting/bank-statements/:id/lines/:lineId/exclude` | `/api/tenant/accounting/v1/bank-statements/:id/lines/:lineId/exclude` | `accounting.bank_statement.exclude` | `accounting.treasury.bank_reconciliation` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` | `[Slice]` |
| 10 | `GET /accounting/bank-statement-templates` | `/api/tenant/accounting/v1/bank-statement-templates` | `accounting.bank_statement.read` | `accounting.treasury.bank_reconciliation` | `TENANT` | `none` | `none` | `200` | `[Slice]` |
| 11 | `GET /accounting/bank-statement-templates/:id` | `/api/tenant/accounting/v1/bank-statement-templates/:id` | `accounting.bank_statement.read` | `accounting.treasury.bank_reconciliation` | `TENANT` | `none` | `none` | `200` + `ETag` | `[Slice]` |
| 12 | `POST /accounting/bank-statement-templates` | `/api/tenant/accounting/v1/bank-statement-templates` | `accounting.bank_statement.configure` | `accounting.treasury.bank_reconciliation` | `TENANT` | `x-idempotency-key` | `none` | `201` + `Location` | `[Slice]` |
| 13 | `GET /accounting/bank-matching-rules` | `/api/tenant/accounting/v1/bank-matching-rules` | `accounting.bank_statement.read` | `accounting.treasury.bank_reconciliation` | `COMPANY` | `none` | `none` | `200` | `[Slice]` |
| 14 | `GET /accounting/bank-matching-rules/:id` | `/api/tenant/accounting/v1/bank-matching-rules/:id` | `accounting.bank_statement.read` | `accounting.treasury.bank_reconciliation` | `COMPANY` | `none` | `none` | `200` + `ETag` | `[Slice]` |
| 15 | `POST /accounting/bank-matching-rules` | `/api/tenant/accounting/v1/bank-matching-rules` | `accounting.bank_statement.manage_rules` | `accounting.treasury.bank_reconciliation` | `COMPANY` | `x-idempotency-key` | `none` | `201` + `Location` | `[Slice]` |
| 16 | `PATCH /accounting/bank-matching-rules/:id` | `/api/tenant/accounting/v1/bank-matching-rules/:id` | `accounting.bank_statement.manage_rules` | `accounting.treasury.bank_reconciliation` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` | `[Slice]` |
| 17 | `PATCH /accounting/bank-matching-rules/bulk-update` | `/api/tenant/accounting/v1/bank-matching-rules/bulk-update` | `accounting.bank_statement.manage_rules` | `accounting.treasury.bank_reconciliation` | `COMPANY` | `x-idempotency-key` | `none` | `200/207` | `[Stage 4]` |
| 18 | `DELETE /accounting/bank-matching-rules/:id` | `/api/tenant/accounting/v1/bank-matching-rules/:id` | `accounting.bank_statement.manage_rules` | `accounting.treasury.bank_reconciliation` | `COMPANY` | `x-idempotency-key` | `If-Match` | `204` | `[Stage 4]` |
| 19 | `POST /accounting/bank-matching-rules/:id/restore` | `/api/tenant/accounting/v1/bank-matching-rules/:id/restore` | `accounting.bank_statement.manage_rules` | `accounting.treasury.bank_reconciliation` | `COMPANY` | `x-idempotency-key` | `none` | `200` | `[Stage 4]` |
| 20 | `GET /accounting/bank-reconciliations` | `/api/tenant/accounting/v1/bank-reconciliations` | `accounting.bank_statement.read` | `accounting.treasury.bank_reconciliation` | `COMPANY` | `none` | `none` | `200` | `[Slice]` |
| 21 | `GET /accounting/bank-reconciliations/:id` | `/api/tenant/accounting/v1/bank-reconciliations/:id` | `accounting.bank_statement.read` | `accounting.treasury.bank_reconciliation` | `COMPANY` | `none` | `none` | `200` + `ETag` | `[Slice]` |
| 22 | `POST /accounting/bank-reconciliations` | `/api/tenant/accounting/v1/bank-reconciliations` | `accounting.bank_statement.reconcile` | `accounting.treasury.bank_reconciliation` | `COMPANY` | `x-idempotency-key` | `none` | `201` + `Location` | `[Slice]` |
| 23 | `POST /accounting/bank-reconciliations/:id/submit-review` | `/api/tenant/accounting/v1/bank-reconciliations/:id/submit-review` | `accounting.bank_statement.reconcile` | `accounting.treasury.bank_reconciliation` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` | `[Slice]` |
| 24 | `POST /accounting/bank-reconciliations/:id/reopen` | `/api/tenant/accounting/v1/bank-reconciliations/:id/reopen` | `accounting.bank_statement.reconcile` | `accounting.treasury.bank_reconciliation` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` | `[Slice]` |
| 25 | `POST /accounting/bank-reconciliations/:id/complete` | `/api/tenant/accounting/v1/bank-reconciliations/:id/complete` | `accounting.bank_statement.reconcile` | `accounting.treasury.bank_reconciliation` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` | `[Slice]` |
| 26 | `POST /accounting/bank-reconciliations/:id/cancel` | `/api/tenant/accounting/v1/bank-reconciliations/:id/cancel` | `accounting.bank_statement.reconcile` | `accounting.treasury.bank_reconciliation` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` | `[Slice]` |
| 27 | `POST /accounting/bank-reconciliations/:id/correct-match` | `/api/tenant/accounting/v1/bank-reconciliations/:id/correct-match` | `accounting.bank_statement.reconcile` | `accounting.treasury.bank_reconciliation` | `COMPANY` | `x-idempotency-key` | `If-Match` | `201` + `Location` | `[Stage 4]` |
| 28 | `GET /accounting/bank-reconciliations/:id/proof` | `/api/tenant/accounting/v1/bank-reconciliations/:id/proof` | `accounting.bank_statement.read` | `accounting.treasury.bank_reconciliation` | `COMPANY` | `none` | `none` | `200` (`ReconciliationProofDto`) | `[Slice]` |
| 29 | `GET /accounting/bank-reconciliations/:id/outstanding-items` | `/api/tenant/accounting/v1/bank-reconciliations/:id/outstanding-items` | `accounting.bank_statement.read` | `accounting.treasury.bank_reconciliation` | `COMPANY` | `none` | `none` | `200` (paginated `ReconciliationOutstandingItemDto`, filter `side`) | `[Slice]` |

### 4.2 Supporting `[S]` Endpoints Called by Pickers, Async Polling, Candidate Search & Approvals

| Purpose | Method & Catalogue Path | Permission | Feature Key | Scope | Idempotency / Concurrency | Delivery |
| --- | --- | --- | --- | --- | --- | --- |
| Bank Account selector & `#100`/`#101` slice prerequisite | `GET /accounting/bank-accounts`, `POST /accounting/bank-accounts/lookup`, `GET /accounting/bank-accounts/:id` | `accounting.bank_account.read` (full IBAN/accountNo gated by `accounting.bank_account.view_sensitive`) | `accounting.treasury.bank_reconciliation` | `COMPANY` | `none` (`ETag` on `:id`) | `[Slice]` |
| Bank Account slice create / edit (`P19.T05.S1`) | `POST /accounting/bank-accounts`, `PATCH /accounting/bank-accounts/:id` | `accounting.bank_account.create` / `accounting.bank_account.update` | `accounting.treasury.bank_reconciliation` | `COMPANY` | `x-idempotency-key` (`If-Match` on `PATCH`) | `[Slice]` |
| Import job dry-run status & row errors (`D-498`) | `GET /accounting/imports/:id`, `GET /accounting/imports/:id/errors` | `accounting.import.read` | `accounting.ledger.core` | `COMPANY` | `none` | `[Slice]` |
| Commit / cancel dry-run statement import | `POST /accounting/imports/:id/commit`, `POST /accounting/imports/:id/cancel` | `accounting.import.execute` (`commit`) / `accounting.import.create` (`cancel`) | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `[Slice]` |
| Poll async `auto-match` job (`202 + Location`) | `GET /accounting/bulk-operations/:id` | `accounting.bulk_operation.read` | `accounting.ledger.core` | `COMPANY` | `none` | `[Slice]` |
| Candidate search — Settlements (`CASH-12`..`13`) | `POST /accounting/settlements/search`, `GET /accounting/settlements/:id` | `accounting.settlement.read` | `accounting.receivables.core` | `COMPANY` | `none` | `[Slice]` |
| GL Account & Journal lookups (rules & bank setup) | `POST /accounting/accounts/lookup` (`accounting.account.read`), `GET /accounting/journals` (`accounting.journal.read`) | `accounting.account.read` / `accounting.journal.read` | `accounting.ledger.core` | `COMPANY` | `none` | `[Slice]` |
| Party lookup (`Q14` Core-owned parties) | `POST /accounting/party-finance-profiles/lookup` | `accounting.profile.read` | `accounting.receivables.core` | `COMPANY` | `none` | `[Slice]` |
| Candidate search — Stage-4 targets | `POST /accounting/payments/search` (`accounting.payment.read`, `accounting.payables.core`); `POST /accounting/instruments/search` (`accounting.instrument.read`, `accounting.treasury.cheques_pdc`); `GET /accounting/cash-transfers` (`accounting.treasury.read`, `accounting.treasury.cash_and_custody`); `POST /accounting/journal-entries/search` (`accounting.journal_entry.read`, `accounting.ledger.core`) | Per target resource | Per target feature | `COMPANY` | `none` | `[Stage 4]` |
| `BANK_MATCH_CORRECTION` approval (`UX-10`) | `POST /accounting/approval-requests/search`, `GET /accounting/approval-requests/:id`, `GET /accounting/approval-requests/:id/actions` (`accounting.approval.read`); `POST .../approve` (`accounting.approval.approve`), `POST .../reject` (`accounting.approval.reject`), `POST .../withdraw` (`accounting.approval.withdraw`) | `accounting.approval.*` | `accounting.close.approvals` | `COMPANY` | `x-idempotency-key` + `If-Match` on `approve` / `reject` / `withdraw` | `[Stage 4]` |

---

## 5. Complete UI States, Worked Error-Copy Matrix, Boundaries & Waiting States

### 5.1 Screen & Sub-View Lifecycle States (`#54` & `#55`)

| State | Trigger | Component & Exact UX Behaviour |
| --- | --- | --- |
| **Loading (Initial)** | Route or bank-account switch | Renders `PageHeader` + `BankAccountContextStrip` skeleton (`h-14`) + `DataTableSkeleton` (`8` rows, `44px` row height) or `#55` `ProofEquationSkeleton` (`6` metric tiles). Never flashes an empty state while `isLoading`. |
| **Empty — Zero Bank Accounts (`#54`)** | `GET /accounting/bank-accounts` returns `total === 0` | Renders `<EmptyState icon={Landmark} />`: *"No company bank accounts configured yet / لم يتم إعداد حسابات بنكية للشركة بعد"*. Single primary CTA: `Set Up Company Bank Account` (`إعداد حساب بنكي` -> `/accounting/setup/banking`) if `can('accounting.bank_account.create')`, or read-only admin-request guidance otherwise. |
| **Empty — Zero Statements (`#54` Tab 2)** | Selected bank account has `0` statements | `<EmptyState icon={FileSpreadsheet} />` displaying `openedOn` as the expected first statement `fromDate`, with `Import Statement` (`استيراد كشف بنكي`) CTA (`can('accounting.bank_statement.import')`) and secondary `View Bank Templates` link. |
| **Empty — Zero Sessions (`#54` Tab 1)** | Selected bank account has `0` reconciliation sessions | `<EmptyState icon={Scale} />` explaining the two-step workflow (`1. Import & confirm statement lines -> 2. Open & complete reconciliation session`). |
| **Empty — Zero Unmatched Lines (`#54` View 2B)** | Filter `status=UNMATCHED` returns `0` rows while `statement.lineCount > 0` | Positive completion callout (`CheckCircle2`): *"All lines on statement `{statementRef}` are matched or excluded / تمت مطابقة أو استثناء جميع بنود الكشف"*, offering a direct link to open or create the covering reconciliation session on `#55`. |
| **403 Forbidden (`PermissionGate`)** | Missing `accounting.bank_statement.read` (route) or `403` on action | Full-screen `<PermissionGate permission="accounting.bank_statement.read" />` on route load (`403` is **never** rendered as an empty table). Action-level permissions hide/disable unauthorized mutation buttons and surface structured `403` banners if revoked mid-session. |
| **Not Entitled (`EntitledFeatureGate`)** | `ACCOUNTING.FEATURE.NOT_ENTITLED` (`403`, `details.feature = "accounting.treasury.bank_reconciliation"`) | Renders `<EntitledFeatureGate feature="accounting.treasury.bank_reconciliation" />` naming the missing plan capability without broken controls. |
| **Recovery / Fence / Archive Boundary** | `useAccountingBoundaryGate` detects `RECOVERY_MODE` (`503`), `WRITE_FENCE`, or `COMPANY_ARCHIVED` | Switches `#54` and `#55` into strict read-only inspection mode with top `<BoundaryBanner>` (`accounting-patterns-documents.md`); all write CTAs (`Import`, `Auto-Match`, `Confirm`, `Unmatch`, `Exclude`, `Complete`) are suppressed. |
| **404 Not Found (`#55`)** | Unknown `:id` or cross-company session ID | Renders `<ResourceNotFoundState backHref="/accounting/reconcile/bank" />` with `correlationId`. |
| **Ambiguous Write Timeout (`<AmbiguousOutcomePanel>`)** | Network timeout / `502` / `504` on any `x-idempotency-key` write (`match`, `unmatch`, `exclude`, `complete`, `import`) | Retains the **exact UUIDv7 `x-idempotency-key`** in hook memory (`useMatchAllocationBuilder` / `useReconciliationSessionWorkspace`), blocks fresh intent generation, and renders `<AmbiguousOutcomePanel>`: *"Outcome unconfirmed — books may or may not have updated. Refresh state or retry safely with the same idempotency key."* |

### 5.2 Status Badge Mapping (`accounting-status-and-a11y.md` Group H, J, K — Verbatim)

| Enum | Member | Role Token | Non-Colour Cue | Dictionary Key | EN Label | AR Label |
| --- | --- | --- | --- | --- | --- | --- |
| `BankAccountStatus` | `ACTIVE` | `positive` | `CheckCircle2` + text | `t.status.BankAccountStatus.ACTIVE` | Active | نشط |
| `BankAccountStatus` | `BLOCKED` | `caution` | `OctagonPause` + text | `t.status.BankAccountStatus.BLOCKED` | Blocked | محظور مؤقتاً |
| `BankAccountStatus` | `CLOSED` | `neutral` | `Lock` + text | `t.status.BankAccountStatus.CLOSED` | Closed | مقفل |
| `BankStatementStatus` | `IMPORTED` | `caution` | `FileDown` + text | `t.status.BankStatementStatus.IMPORTED` | Imported (unreconciled) | مستورَد (بانتظار التسوية) |
| `BankStatementStatus` | `IN_RECONCILIATION` | `pending` | `.dot-pending` + text | `t.status.BankStatementStatus.IN_RECONCILIATION` | In reconciliation | قيد التسوية |
| `BankStatementStatus` | `RECONCILED` | `positive` | `CheckCircle2` + text | `t.status.BankStatementStatus.RECONCILED` | Reconciled | مسوّى بالكامل |
| `BankStatementStatus` | `DISCARDED` | `neutral` | `Ban` + `line-through` | `t.status.BankStatementStatus.DISCARDED` | Discarded | مستبعد |
| `BankStatementLineStatus` | `UNMATCHED` | `caution` | `Unlink` + text | `t.status.BankStatementLineStatus.UNMATCHED` | Unmatched | غير مطابق |
| `BankStatementLineStatus` | `PROPOSED` | `pending` | `.dot-pending` + `Sparkles` | `t.status.BankStatementLineStatus.PROPOSED` | Proposed match | مطابقة مقترحة |
| `BankStatementLineStatus` | `MATCHED` | `positive` | `Link2` + text | `t.status.BankStatementLineStatus.MATCHED` | Matched | مطابق |
| `BankStatementLineStatus` | `EXCLUDED` | `neutral` | `MinusCircle` + text | `t.status.BankStatementLineStatus.EXCLUDED` | Excluded | مستثنى بمبرِّر |
| `ReconciliationSessionStatus` | `OPEN` | `pending` | `.dot-pending` + text | `t.status.ReconciliationSessionStatus.OPEN` | Open | جلسة مفتوحة |
| `ReconciliationSessionStatus` | `IN_REVIEW` | `caution` | `Eye` + text | `t.status.ReconciliationSessionStatus.IN_REVIEW` | In review | قيد المراجعة |
| `ReconciliationSessionStatus` | `COMPLETED` | `positive` | `CheckCircle2` + text | `t.status.ReconciliationSessionStatus.COMPLETED` | Completed | مكتملة ومعتمدة |
| `ReconciliationSessionStatus` | `CANCELLED` | `neutral` | `Ban` + `line-through` | `t.status.ReconciliationSessionStatus.CANCELLED` | Cancelled | ملغاة |
| `ImportJobStatus` | `DRY_RUN_COMPLETED` | `caution` | `FileCheck` + text | `t.status.ImportJobStatus.DRY_RUN_COMPLETED` | Dry-run passed (awaiting commit) | نجح الفحص التجريبي (بانتظار الاعتماد) |
| `ApprovalRequestState` | `PENDING` | `pending` | `.dot-pending` + `border-dashed` | `t.status.ApprovalRequestState.PENDING` | Pending approval | بانتظار الاعتماد |

### 5.3 Waiting States & Exception-Board Alignment (`Zero-Resend Law`, `accounting-patterns-documents.md`)

External bank clearing and two-person match-correction approvals are asynchronous real-world states. Per `accounting-patterns-documents.md` §3, waiting banners **never** render a "Resend to Bank" or "Force Complete" button; every waiting callout names the **Deadline / Threshold**, **Owner**, **Effect on Books**, and **Safe Next Action**:

| Waiting / Exception Code | Surface | Deadline / Threshold | Owner | Effect on Books | Safe Next Action (Never Implies Resend) |
| --- | --- | --- | --- | --- | --- |
| **`WS-07` / `BANK_UNMATCHED`** (`NEVER_DISMISSIBLE` board item, `D-217`) | `#54` Tab 2 Callout & Line Age Pill | `bank_unmatched_days` (`30` days default from `bookingDate`, `04_Errors_and_Constants.md` §6.1) | Treasury / GL Accountant (`accounting.bank_statement.match` \| `.exclude`) | Bank movement is imported on the statement, but no clearing or GL fee entry is confirmed yet; blocks `BANK_RECONCILED` close task. | Filter to aged `UNMATCHED` / `PROPOSED` lines and confirm allocation (`match`) or exclude with documented reason (`exclude`). Cleared automatically by state change, never dismissed manually. |
| **`WS-06` / `BANK_MATCH_CORRECTION` Pending Approval** (`[Stage 4]`, `D-297`, `D-677`) | `#54` Frozen Line Inspector & `#55` Tab C `<ApprovalPanel>` | Before completing the bank account's open reconciliation session (`ACCOUNTING.BANK.RECONCILIATION_INCOMPLETE` blocks session completion while `PENDING`) | Second Reviewer / Finance Manager (`accounting.approval.approve`, distinct from `makerUserIds`) | Frozen session and ledger remain unchanged until approved; on approval, posts reversal + replacement in the current open period. | Independent reviewer inspects the frozen `requestBody` snapshot on `#55` Tab C and clicks `Approve` or `Reject` (or maker clicks `Withdraw`). |
| **`DUPLICATE_BANK_EXECUTION` Context** (`[Stage 4]`, `REASON_ONLY` board item) | `#54` View 2B Duplicate Movement Alert | Immediate before period close | Treasury Controller | Bank statement shows two debits for one payment obligation; books hold only one `SENT`/`CLEARED` payment. | Do **not** re-issue or duplicate payment entries. Match the primary debit to the `PAYMENT`, post the bank's erroneous duplicate debit to `SUSPENSE` / bank claim receivable (`DIRECT_POSTING`), and record bank recovery reference on the exception board. |
| **Async Import / Auto-Match Job In Flight** (`ImportJobStatus` / `BulkOperationStatus`) | `#54` Import Wizard & `AccountingJobTrayDrawer` (`UX-13`) | Server worker completion (`Location` poll) | Accounting Worker (no user action required until `DRY_RUN_COMPLETED` / `COMPLETED` / `FAILED`) | Unchanged until `COMPLETED` (or until `POST /imports/:id/commit` after `DRY_RUN_COMPLETED`). | Keep working in other tabs or wait for `AsyncProgressCard` completion; clicking `Commit Import` is enabled once `DRY_RUN_COMPLETED`. |

### 5.4 Worked Error-Copy Matrix (`useAccountingErrorModel`: Cause + Effect on Books + Safe Next Action + `correlationId`)

Every error banner displays `<IdentifierText>{error.correlationId}</IdentifierText>` with a copy icon and maps verbatim `04_Errors_and_Constants.md` codes to bilingual four-part recovery copy:

| Error Code (`HTTP`) | Retryable | Cause (EN / AR Summary) | Effect on Books | Safe Next Action |
| --- | --- | --- | --- | --- |
| `ACCOUNTING.BANK.STATEMENT_DUPLICATE` (`409`) | `NEVER` | File SHA-256, line hash, or date window overlaps a live statement on this bank account (`D-459`). / الملف أو أحد بنوده أو فترته مستورد مسبقاً في كشف نشط لهذا الحساب. | **Unchanged** (entire import refused; zero lines committed). | Open the existing statement named in `details` (`Open Existing Statement` link), or upload the next period's statement file. |
| `ACCOUNTING.BANK.STATEMENT_BALANCE_MISMATCH` (`422`) | `AFTER_CORRECTION` | `openingBalance` + sum of parsed movements does not equal `closingBalance` (`VAL-TRS-19`). / الرصيد الافتتاحي مضافاً إليه صافي الحركات لا يساوي الرصيد الختامي المصرَّح به. | **Unchanged** (no statement rows written). | Verify header `openingBalance` / `closingBalance`, check template `amountMode` / `skipRowPatterns` for summary rows, and re-run dry-run. |
| `ACCOUNTING.BANK.TEMPLATE_MISMATCH` (`422`) | `AFTER_CORRECTION` | Uploaded CSV/XLSX columns, date format, or numeric separators do not match the selected template (`D-118`). / أعمدة الملف أو تنسيق التاريخ/الأرقام لا تطابق القالب المختار. | **Committed (failed import job record only)**; zero bank statement lines created. | Inspect row/column diagnostics in `ImportSafeErrorTable`, select the matching bank template (or upload a custom tenant template in Tab 4), and re-import. |
| `ACCOUNTING.BANK.LINE_ALREADY_MATCHED` (`409`) | `AFTER_REFRESH` | Another user confirmed or excluded this statement line concurrently. / قام مستخدم آخر بمطابقة هذا البند أو استثنائه بالتزامن. | **Unchanged** by your request (prior match stands). | Click `Refresh Statement` to reload the current `ETag` and allocations; use `Unmatch` first if replacement is intended. |
| `ACCOUNTING.BANK.MATCH_ALLOCATION_INVALID` (`422`) | `AFTER_CORRECTION` | Allocations contain zero, carry the wrong sign for the line's `direction`, fail to sum to `line.amount`, or clear an already-cleared target (`D-300`). / مبالغ التوزيع لا تساوي مبلغ البند، أو تحمل إشارة خاطئة، أو تستهدف مستنداً مسوّى مسبقاً. | **Unchanged**. | Adjust allocation amounts until `Remaining = 0.00` (add a `DIRECT_POSTING` fee/FX split row if needed) and re-confirm with a new intent. |
| `ACCOUNTING.BANK.MATCH_AMOUNT_TOLERANCE` (`422`) | `AFTER_CORRECTION` | Tolerated difference exceeds `MAX_BANK_MATCH_TOLERANCE` (`1.00000000`) without `toleranceReason`, or (`[Stage 4]` `correct-match`) exceeds tolerance outright. / الفرق يتجاوز حد السماح (`1.00`) بدون سبب موثق، أو يتجاوز الحد المسموح به في تصحيح المطابقة. | **Unchanged**. | Enter a `toleranceReason` (`10..1,000` chars) on `ConfirmMatchDto` (or split the excess to an explicit `DIRECT_POSTING` fee role; on `correct-match`, choose a target within tolerance). |
| `ACCOUNTING.BANK.RECONCILIATION_INCOMPLETE` (`409`) | `AFTER_CORRECTION` | Session still has `UNMATCHED` or `PROPOSED` lines, a statement gap between `fromDate..toDate`, no statement ending on `toDate`, or (`[Stage 4]`) a `PENDING` `BANK_MATCH_CORRECTION` / uncarried post-closure record (`D-677`). / توجد بنود غير مطابقة، أو فجوة في تغطية الكشوف، أو طلب تصحيح معلَّق. | **Unchanged** (session stays `OPEN` / `IN_REVIEW`). | Follow the highlighted red item in the Readiness Gate Checklist (§2.4): match/exclude remaining lines, import missing statement dates, or resolve pending correction approvals. |
| `ACCOUNTING.BANK.RECONCILIATION_DIFFERENCE` (`422`) | `MANUAL_RECONCILIATION` | Computed reconciliation `difference` is non-zero; zero accepted-difference override exists (`D-118`, `D-285`). / فرق معادلة التسوية لا يساوي صفراً؛ لا يُسمح بتجاوز الفرق آلياً. | **Unchanged** (session is not completed). | Inspect statement opening continuity, missing/duplicate ledger entries on the `BANK` account, or excluded movements until `difference == 0.00`. |
| `ACCOUNTING.BANK.RECONCILIATION_SEQUENCE_INVALID` (`422`) | `AFTER_CORRECTION` | New session `fromDate` does not equal `lastReconciledOn + 1 day` (or `openedOn` for the first session). / تاريخ بداية الجلسة لا يبدأ من اليوم التالي لآخر تسوية معتمدة (أو تاريخ فتح الحساب). | **Unchanged**. | Click `Use Expected Start Date` in the New Session modal to snap `fromDate` to the exact required date. |
| `ACCOUNTING.BANK.RECONCILIATION_SESSION_COMPLETED` (`409`) | `NEVER` | Attempted to `unmatch` a line or import a movement dated `<= lastReconciledOn` inside a completed session (`D-290`, `D-297`). / البند يقع ضمن جلسة تسوية مكتملة ومجمَّدة كدليل مراجعة لا يُعاد فتحه. | **Unchanged**. | `[Stage 4]` Open the bank account's current `OPEN` reconciliation session on `#55` and submit a two-person `Correct Prior Match` request (`correct-match`). |
| `ACCOUNTING.BANK.RECONCILED_RANGE_POSTING` (`409`) | `AFTER_CORRECTION` | Confirming the match would post a GL entry dated `<= lastReconciledOn` (`D-297`). / تاريخ القيد الناتج يقع في أو قبل آخر تاريخ تسوية معتمد ومجمَّد. | **Unchanged**. | Post in an open date after `lastReconciledOn` (`D-285` carries after-`toDate` entries cleanly in the session proof). |
| `ACCOUNTING.BANK.MATCH_CORRECTION_NOT_ALLOWED` (`409`) | `AFTER_CORRECTION` | `unmatch` or `correct-match` targeted an `INSTRUMENT` allocation (`D-437`), a line outside a completed session, a reversed target, or lacked an `OPEN` session. / لا يُسمح بإلغاء أو تصحيح مطابقة شيك/ورقة تجارية من هنا أو بدون جلسة مفتوحة. | **Unchanged**. | For cheques/instruments, record bounce/dishonour from the Instruments workspace; for non-instrument frozen matches, ensure an `OPEN` session exists first. |
| `ACCOUNTING.ADVANCE.NOT_CANCELLABLE` (`409`) | `AFTER_CORRECTION` | Unmatching or correcting a `CLEARED` `AP` advance payment failed because the supplier advance already has a posted refund settlement (`refunded_amount > 0`, `D-445`). / الدفعة المقدمة للمورد مرتبطة باسترداد نقدي/بنكي مرحَّل. | **Unchanged**. | Reverse the supplier advance refund settlement (`POST /accounting/settlements/:id/reverse`) first, then retry `unmatch` / `correct-match`. |
| `ACCOUNTING.BANK.ACCOUNT_INACTIVE` (`409`) | `AFTER_CORRECTION` | Bank account is `BLOCKED` or `CLOSED` and the command violates post-closure rules (`D-451`, `D-677`). / الحساب البنكي محظور أو مقفل ولا يقبل هذه العملية بعد تاريخ الإقفال. | **Unchanged**. | Select an `ACTIVE` bank account, or review `closedOn` boundary rules in the Context Bar banner. |
| `ACCOUNTING.BANK.IBAN_INVALID` (`422`) | `AFTER_CORRECTION` | IBAN failed ISO 13616 length, structure, or mod-97 check (`VAL-TRS-01`). / رقم الآيبان (`IBAN`) غير صحيح وفق معيار التحقق القياسي. | **Unchanged**. | Correct the IBAN characters (spaces stripped automatically, rendered LTR) or clear IBAN if the bank country issues no IBAN. |
| `ACCOUNTING.APPROVAL.MAKER_IS_APPROVER` (`403`) | `INDEPENDENT_ACTOR` | Current user recorded the `BANK_MATCH_CORRECTION` request and cannot approve their own request (`D-146`). / لا يجوز لمُنشئ طلب تصحيح المطابقة اعتماده بنفسه (فصل المهام). | **Unchanged** (request stays `PENDING`). | Ask a second authorized reviewer with `accounting.approval.approve` to review and approve on `#55` Tab C. |
| `COMMON.CONCURRENCY.STALE_VERSION` / `412 Precondition Failed` | `AFTER_REFRESH` | `If-Match` `ETag` is stale because another command updated the statement, rule, or session. / تغيرت نسخة السجل بواسطة عملية أخرى قبل الحفظ. | **Unchanged**. | Click `Reload Latest State` to fetch the fresh `ETag` and re-apply your decision if still needed. |

---

## 6. Bilingual & Dual-Theme ASCII Mockups (`AR-RTL` / `EN-LTR` × `Light` / `Dark` + `375px` Mobile)

All mockups enforce:
- **Single filled primary CTA (`[■ ...]`)** per screen; all other buttons are secondary `[ ... ]` or ghost.
- **Logical layout mirroring (`dir="rtl"` vs `dir="ltr"`)**: In `AR-RTL`, the Statement Lines Grid sits on the **right (`inline-start`)** and the Match Inspector sits on the **left (`inline-end`)**; in `EN-LTR`, the Statement Lines Grid sits on the **left (`inline-start`)** and the Match Inspector sits on the **right (`inline-end`)**.
- **LTR Islands (`<bdi dir="ltr">`) & Western Digits (`0-9`)** on every IBAN, statement ref, date, session number, and `tabular-nums` decimal amount.
- **Non-colour status cues** (`⚠ Unlink`, `●✦ Proposed`, `🔗 Matched`, `⊖ Excluded`, `✓ Proved`, `🔒 Frozen`).

### 6.1 Combination 1 — `AR-RTL × Light` (`#54` Split-Pane Statement Matching Workspace — `[Slice]`)

- **Theme Tokens:** Canvas `--bg` (`ink-50`), Cards `--surface` (`#FFFFFF`), Inspector header `--surface-2` (`ink-100`), Borders `--border` (`ink-200`), Text `--ink` (`ink-950`) / `--ink-2` (`ink-600`), Primary CTA `--brand`, Proposed badge `--pending`, Matched `--positive`, Unmatched `--caution`.

```text
+----------------------------------------------------------------------------------------------------------------------+
| [شريط النطاق: شركة النيل للتجارة ش.م.م (EGP) ▾]                     [🔔 المهام غير المتزامنة (0)] [إدارة البنوك ↗] |
|----------------------------------------------------------------------------------------------------------------------|
| [■ تأكيد المطابقة للبند #14]   [تشغيل المطابقة المقترحة ✦]        التسوية البنكية  ←  كشوف الحساب والمطابقة (#54) |
|----------------------------------------------------------------------------------------------------------------------|
| [نشط ✓]  البنك التجاري الدولي - جاري جنيه  |  كود: <BNK-CIB-01>  |  IBAN: <EG38•••••••0091>  |  العملة: <EGP>      |
| آخر تاريخ مسوّى ومجمَّد 🔒: <2026-02-28>  |  آخر رصيد ختامي: <1,240,500.00>  |  جلسة مفتوحة: [● #REC-2026-03 ↗]    |
|----------------------------------------------------------------------------------------------------------------------|
|   (4) قوالب البنوك [نطاق المستأجر]   |   (3) قواعد المطابقة   |  [(2) كشوف الحساب والمطابقة ●]  |   (1) جلسات التسوية |
|======================================================================================================================|
| شريط الكشف: <CIB-2026-03> | <2026-03-01 → 2026-03-31> | [● قيد التسوية] | مطابق: <18 / 20> | [→ العودة لكل الكشوف]  |
|------------------------------------------------------+---------------------------------------------------------------|
| لوحة الفحص وتأكيد المطابقة (Inline-End: يسار RTL)   | شبكة بنود الكشف البنكي (Inline-Start: يمين RTL)              |
|------------------------------------------------------| تصفية: [الكل 20] [غير مطابق 1] [●✦ مقترح 1] [مطابق 17] [⊖ 1] |
| البند المحدد: <#14>  |  تاريخ القيد: <2026-03-18>    |---------------------------------------------------------------|
| المبلغ: <+49,950.00 EGP> (↙ إيداع دائن CREDIT)       | الحالة       | المبلغ (EGP)   | البيان والمرجع  | القيد      |# |
| المرجع البنكي: <TRF-CUST-88412>                      |--------------+----------------+-----------------+------------+--|
| الطرف المقابل: شركة الدلتا للتوريدات                 | [🔗 مطابق]   |  <+120,000.00> | <TRF-88390>     |<2026-03-15>|13|
|------------------------------------------------------| [●✦ مقترح]   |   <+49,950.00> | <TRF-CUST-88412>|<2026-03-18>|14|◀
| ✦ اقتراح القاعدة <RULE-AR-IBAN> (ثقة <92%>):         | [⚠ غير مطابق]|      <-350.00> | <BNK-FEE-MAR>   |<2026-03-29>|19|
| تسوية مقبوضات عميل <#SET-2026-0412> بمبلغ <50,000.00>| [⊖ مستثنى]   |        <+0.00> | <INFO-ROW>      |<2026-03-31>|20|
| مع فرق عمولة بنكية <-50.00 EGP> (قيد مباشر).         |--------------+----------------+-----------------+------------+--|
|------------------------------------------------------| التوزيع وتأكيد المحاسب البشري (ConfirmMatchDto):              |
| نوع الهدف: [تسوية مقبوضات SETTLEMENT ●] [قيد مباشر]  |                                                               |
| 1) مستند التسوية: <#SET-2026-0412> (الدلتا للتوريدات)|                                                               |
|    المبلغ الموزَّع:            <-50,000.00 EGP>       |                                                               |
| 2) قيد فرق/عمولة (DIRECT_POSTING):                   |                                                               |
|    دور الحساب: [مصروفات وعمولات بنكية BANK_CHARGES ▾]|                                                               |
|    مبلغ التسوية المباشرة:         <+50.00 EGP>       |                                                               |
|------------------------------------------------------|---------------------------------------------------------------|
| صافي البند: <-49,950.00> | الموزَّع: <-49,950.00>     | إحصاء الخادم (بدون جمع محلي): افتتاحي <1,240,500.00>         |
| المتبقي للتوزيع: <0.00 EGP ✓ جاهز للتأكيد>           | ختامي الكشف: <1,410,100.00> | معروض <20> بنداً                |
| [استثناء البند بمبرِّر...]  [رفض الاقتراح]            | اختصارات: [↑/↓] تنقل  [Alt+C] تأكيد  [Alt+E] استثناء         |
+------------------------------------------------------+---------------------------------------------------------------+
```

### 6.2 Combination 2 — `AR-RTL × Dark` (`#55` Reconciliation Session Proof & Stage-4 Match Correction `<ApprovalPanel>`)

- **Theme Tokens:** Canvas `--bg` (`ink-950` `#090D16`), Elevated Cards `--surface` (`ink-900` `#111827`), Proof tiles `--surface-2` (`ink-850`), Borders `--border` (`ink-800`), Text `--ink` (`ink-50`) / `--ink-2` (`ink-300`), Zero-difference tile `--positive` subtle dark tint + `CheckCircle2`, Pending approval `--pending` dashed border.

```text
+----------------------------------------------------------------------------------------------------------------------+
| [الوضع الداكن ☾] [شريط النطاق: شركة النيل للتجارة ش.م.م (EGP) ▾]               [العودة إلى التسوية البنكية ←]       |
|----------------------------------------------------------------------------------------------------------------------|
| [■ اعتماد وإتمام التسوية]  [إحالة للمراجعة]  [إلغاء الجلسة]     جلسة التسوية <#REC-2026-03>  [● جلسة مفتوحة] (v4)   |
| الحساب: البنك التجاري الدولي <BNK-CIB-01> (<EGP>)  |  النطاق: <2026-03-01 → 2026-03-31>  |  الفترة: <2026-M03>       |
|======================================================================================================================|
| معادلة إثبات التسوية البنكية المعتمدة من الخادم (VAL-TRS-31 — بدون أي تقريب عشري بالمتصفح):                         |
| +-------------------+   +-------------------+   +-------------------+   +-------------------+   +------------------+ |
| | فرق التسوية (=)   | = | قيود بعد النهاية  | - | الرصيد الدفتري    | - | شيكات/دفعات معلقة | + | إيداعات بالطريق  | |
| | [✓ متطابق تماماً]  |   | محمولة (-):       |   | في <2026-03-31>:  |   | لم تُصرف (-):     |   | غير ظاهرة (+):   | |
| |    <0.00 EGP>     |   |    <-350.00>      |   |  <1,395,450.00>   |   |   <18,000.00>     |   |   <3,000.00>     | |
| +-------------------+   +-------------------+   +-------------------+   +-------------------+   +------------------+ |
|                                                                           رصيد الكشف الختامي الأساسي: <1,410,100.00> |
|----------------------------------------------------------------------------------------------------------------------|
| قائمة التحقق من الجاهزية (VAL-TRS-30):                                                                               |
| [✓] تغطية الكشوف متصلة حتى <2026-03-31>   [✓] بنود غير مطابقة: <0>   [✓] الفرق: <0.00>   [✓ Stage 4] تصحيحات معلقة: 0|
|----------------------------------------------------------------------------------------------------------------------|
|  [(ج) تصحيحات المطابقات السابقة (Stage 4) (1 معتمد)]  |  (ب) بنود الدفاتر المعلقة (<4>)  |  (أ) بنود الكشف (<20>)   |
|----------------------------------------------------------------------------------------------------------------------|
| لوحة الاعتماد الثنائي لتصحيح مطابقة مجمَّدة (<ApprovalPanel> UX-10 — BANK_MATCH_CORRECTION):                         |
| +------------------------------------------------------------------------------------------------------------------+ |
| | الطلب: <#APR-2026-0089> | الحالة: [✓ معتمد APPROVED] | أُنشئ بواسطة: أ. سارة حسن | اعتُمد بواسطة: م. طارق عادل   | |
| | البند المجمَّد الأصلي: كشف <CIB-2026-02> بند <#09> بتاريخ <2026-02-14> (ضمن نطاق مقفل 🔒 <= <2026-02-28>)        | |
| | لقطة القرار المجمَّدة (requestBody snapshot):                                                                    | |
| |   • إلغاء التوجيه الخاطئ: تسوية <#SET-2026-0190>  ←  التوجيه الصحيح: تسوية <#SET-2026-0194> (<+25,000.00 EGP>)   | |
| |   • الأثر المحاسبي: قيد عكسي وإعادة توجيه بتاريخ الفترة المفتوحة الحالية دون المساس بجلسة فبراير المعتمدة.        | |
| +------------------------------------------------------------------------------------------------------------------+ |
| [تصحيح مطابقة سابقة جديدة... (Stage 4)]                                        معرّف التتبع: <0195f2a0-7c10-7b32>    |
+----------------------------------------------------------------------------------------------------------------------+
```

### 6.3 Combination 3 — `EN-LTR × Light` (`#54` Split-Pane Statement Matching Workspace — `[Slice]`)

- **Theme Tokens:** Canvas `--bg` (`ink-50`), Cards `--surface` (`#FFFFFF`), Borders `--border` (`ink-200`), Text `--ink` (`ink-950`), Inline-Start = Left (Lines Grid), Inline-End = Right (Match Inspector).

```text
+----------------------------------------------------------------------------------------------------------------------+
| [Scope: Nile Trading Co. SAE (EGP) ▾]                                     [Manage Bank Accounts ↗] [🔔 Async Jobs (0)]|
|----------------------------------------------------------------------------------------------------------------------|
| Bank Reconciliation  ->  Statements & Matching (#54)            [✦ Run Auto-Match]   [■ Confirm Match for Line #19] |
|----------------------------------------------------------------------------------------------------------------------|
| [✓ Active] CIB - Corporate Current EGP | Code: <BNK-CIB-01> | IBAN: <EG38•••••••0091> | Currency: <EGP>              |
| Frozen Reconciled Until 🔒: <2026-02-28> | Last Closing: <1,240,500.00> | Active Session: [● Open #REC-2026-03 ↗]   |
|----------------------------------------------------------------------------------------------------------------------|
| (1) Reconciliation Sessions | [(2) Statements & Matching ●] | (3) Matching Rules | (4) Templates [Tenant Scope]      |
|======================================================================================================================|
| [← All Statements] | Statement <CIB-2026-03> | <2026-03-01 → 2026-03-31> | [● In reconciliation] | Matched: <18 / 20>|
|---------------------------------------------------------------+------------------------------------------------------|
| Statement Lines Grid (Inline-Start: Left LTR)                 | Match Inspector & Confirmation (Inline-End: Right)   |
| Filter: [All 20] [⚠ Unmatched 1] [●✦ Proposed 1] [🔗 17] [⊖ 1]|------------------------------------------------------|
|---------------------------------------------------------------| Selected Line: <#19> | Booking Date: <2026-03-29>    |
| # | Booking    | Reference & Description| Amount (EGP) |Status| Amount: <-350.00 EGP> (↗ Outflow DEBIT)              |
|---+------------+------------------------+--------------+------| Bank Ref: <BNK-FEE-MAR> | Tx Code: <CHG>             |
| 13|<2026-03-15>| <TRF-88390> Delta Co.  | <+120,000.00>|[🔗]  |------------------------------------------------------|
| 14|<2026-03-18>| <TRF-CUST-88412>       |  <+49,950.00>|[●✦]  | Human Confirmation Builder (ConfirmMatchDto):        |
|▶19|<2026-03-29>| <BNK-FEE-MAR> Monthly  |     <-350.00>|[⚠]   | Target Mode: [Customer Settlement] [● Direct Posting]|
| 20|<2026-03-31>| <INFO-ROW> Stamp note  |       <+0.00>|[⊖]   |                                                      |
|---+------------+------------------------+--------------+------| Posting Account Role (Closed AccountRole subset):    |
|                                                               | [Bank Charges & Fees (BANK_CHARGES)               ▾] |
|                                                               | Allocation Signed Amount (+ on DEBIT):               |
|                                                               | [+350.00                                        EGP] |
|                                                               | Balanced GL Entry Preview (on confirm):              |
|                                                               |   Dr Bank Charges (6104)              <350.00 EGP>   |
|                                                               |   Cr CIB Current EGP (1102)           <350.00 EGP>   |
|---------------------------------------------------------------|------------------------------------------------------|
| Server Totals (no client sum): Opening <1,240,500.00>         | Line: <+350.00> | Allocated: <+350.00> | Left: <0.00>|
| Statement Closing: <1,410,100.00> | Loaded: <20> lines        | [✓ Exact balance closure]     [Exclude with Reason…] |
+---------------------------------------------------------------+------------------------------------------------------+
```

### 6.4 Combination 4 — `EN-LTR × Dark` (`#55` Reconciliation Session Proof — Unproved / Blocked Readiness State)

- **Theme Tokens:** Canvas `--bg` (`ink-950`), Cards `--surface` (`ink-900`), Difference non-zero tile `--negative` dark surface + `Scale` icon, Primary CTA automatically shifts to **[■ Go to Statement Matching]** while `Complete Reconciliation` is disabled with explicit gate reasons.

```text
+----------------------------------------------------------------------------------------------------------------------+
| [☾ Dark] [Scope: Nile Trading Co. SAE (EGP) ▾]                                     [← Back to Bank Reconciliation]   |
|----------------------------------------------------------------------------------------------------------------------|
| Reconciliation Session <#REC-2026-03>  [● Open] (v3)   [■ Go to Statement Matching] [Complete (Blocked)] [Cancel…]   |
| Account: CIB Corporate Current <BNK-CIB-01> (<EGP>)  |  Range: <2026-03-01 → 2026-03-31>  |  Period: <2026-M03>      |
|======================================================================================================================|
| Server Reconciliation Proof Equation (VAL-TRS-31 — Zero Accepted-Difference Override):                               |
| +------------------+   +------------------+   +------------------+   +------------------+   +----------------------+ |
| | Statement Closing| + | Outstanding      | - | Outstanding      | - | GL Ledger Balance| - | Carried After-toDate | |
| | (<2026-03-31>)   |   | Deposits (+)     |   | Cheques/Pmts (-) |   | (<2026-03-31>)   |   | Postings (-)         | |
| |  <1,410,100.00>  |   |    <3,000.00>    |   |   <18,000.00>    |   |  <1,395,100.00>  |   |       <0.00>         | |
| +------------------+   +------------------+   +------------------+   +------------------+   +----------------------+ |
|  =>  DIFFERENCE (=):  [⚖ Unproved: <-350.00 EGP>]  — Completion refused until difference == <0.00> (D-118, D-285).  |
|----------------------------------------------------------------------------------------------------------------------|
| Session Readiness Gate Checklist (VAL-TRS-30):                                                                       |
| [✓] Gapless statements ending <2026-03-31>   [⚠] Unmatched lines: <1> remaining   [✕] Difference: <-350.00 EGP != 0> |
|----------------------------------------------------------------------------------------------------------------------|
| [(A) Unresolved Statement Lines (1) ●]  |  (B) Outstanding GL & Carried Items (4)  |  (C) Match Corrections [Stage 4]|
|----------------------------------------------------------------------------------------------------------------------|
| Line #19 | Booking <2026-03-29> | <BNK-FEE-MAR> Monthly Maintenance Fee | <-350.00 EGP> | [⚠ Unmatched] | [Match ↗]  |
+----------------------------------------------------------------------------------------------------------------------+
```

### 6.5 Mobile `375px` Responsive Behaviour (`#54` & `#55`)

On viewports `< 1024px` (`375px` baseline):
- `#54` View 2B collapses from side-by-side split panes into a compact statement-line card list; tapping any line opens `MatchInspectorPanel` inside a full-height bottom `Sheet` (`max-h-[90dvh]`) with sticky bottom confirmation bar (`Remaining: 0.00` + single `[■ Confirm Match]`).
- `#55` Proof Equation Banner stacks into a vertical 2-column ledger equation receipt card with the `Difference (=)` row pinned at the bottom in `font-semibold` `tabular-nums`.

```text
+-------------------------------------+
| [≡] التسوية البنكية (#54)    [🔔 0] |
|-------------------------------------|
| <BNK-CIB-01> جاري جنيه  [نشط ✓]    |
| مقفل حتى 🔒: <2026-02-28>           |
|-------------------------------------|
| كشف <CIB-2026-03> | مطابق <18/20>   |
| [غير مطابق 1 ●] [مقترح 1] [الكل 20] |
|-------------------------------------|
| +---------------------------------+ |
| | #19 • <2026-03-29>  [⚠ غير مطابق]| |
| | <BNK-FEE-MAR> عمولة شهرية       | |
| | المبلغ: <-350.00 EGP> (مدين ↗)  | |
| | [فتح لوحة المطابقة والتأكيد ▴]  | |
| +---------------------------------+ |
+-------------------------------------+
```

---

## 7. Bilingual Dictionary Keys (`ar.ts` & `en.ts` — Zero Language Ternaries)

All UI copy lives under `t.accounting.bankReconciliation.*` (complementing global `t.status.*` keys already frozen in `accounting-status-and-a11y.md` Group H/J/K):

```ts
// en.ts (excerpt — exact mirror required in ar.ts)
bankReconciliation: {
  hub: {
    title: "Bank Reconciliation",
    subtitle: "Import bank statements, confirm line allocations, and prove period-end bank balances.",
    manageBankAccounts: "Manage Bank Accounts",
    tabs: {
      sessions: "Reconciliation Sessions",
      statements: "Statements & Matching",
      rules: "Matching Rules",
      templates: "Bank Templates",
    },
    contextBar: {
      selectAccountPlaceholder: "Select company bank account…",
      openedOn: "Opened",
      lastReconciledOn: "Frozen Reconciled Until",
      lastReconciledTooltip: "Completed reconciliation sessions freeze bank postings and matches on or before this date.",
      lastClosingBalance: "Last Statement Closing",
      openActiveSession: "Open Active Session #{sessionNo}",
      closedAccountNotice: "This bank account was closed on {closedOn}. Only closing-range reconciliation and permitted post-closure clearing records remain available.",
    },
  },
  importWizard: {
    trigger: "Import Statement",
    title: "Import Bank Statement",
    statementRef: "Statement Reference",
    template: "Bank Statement Template",
    uploadOwnTemplateLink: "Upload your bank's template",
    fromDate: "Statement Start Date",
    toDate: "Statement End Date",
    openingBalance: "Declared Opening Balance",
    openingContinuityHint: "Expected to equal previous closing balance ({expected}).",
    closingBalance: "Declared Closing Balance",
    dryRunLabel: "Validate in dry-run preview before committing rows (Recommended)",
    commitCta: "Commit Validated Statement",
    cancelDryRunCta: "Discard Dry-Run",
  },
  matching: {
    backToStatements: "All Statements",
    runAutoMatch: "Run Auto-Match",
    autoMatchZeroConfirmHint: "Rules create PROPOSED matches only. Every statement line requires human confirmation.",
    confirmMatchCta: "Confirm Match",
    confirmProposalCta: "Confirm Proposed Match",
    unmatchCta: "Unmatch Line",
    excludeCta: "Exclude Line",
    discardStatementCta: "Discard Statement",
    frozenLineNotice: "Frozen by completed session through {reconciledUntil}. Reopen is prohibited; use Forward Match Correction in an open session.",
    modes: {
      SETTLEMENT: "Customer Settlement",
      DIRECT_POSTING: "Direct GL Posting",
      PAYMENT: "Supplier Payment",
      INSTRUMENT: "Cheque / Instrument",
      CASH_TRANSFER: "Cash Transfer",
      JOURNAL_ENTRY: "Posted Journal Line",
    },
    addFeeSplitCta: "Add Bank Fee / FX Difference Split",
    postingAccountRole: "Posting Account Role",
    toleranceReasonLabel: "Tolerance Explanation (required above 1.00)",
    allocationSummary: {
      lineAmount: "Statement Line",
      allocated: "Allocated",
      remaining: "Remaining",
      balancedReady: "Exact balance closure",
    },
  },
  rules: {
    newRuleCta: "New Matching Rule",
    governanceBanner: "Matching rules only rank and propose candidates. No rule ever confirms or posts without human confirmation.",
  },
  templates: {
    uploadTemplateCta: "Upload Bank Template",
    tenantScopeBanner: "Bank statement templates are shared across your tenant. Platform country-pack templates are read-only; clone to customize.",
  },
  session: {
    newSessionCta: "New Reconciliation Session",
    expectedStartDateHint: "Automatically anchored to the day after your last completed session ({expectedDate}).",
    goToMatchingCta: "Go to Statement Matching",
    submitReviewCta: "Submit for Review",
    reopenCta: "Reopen Session",
    completeCta: "Complete Reconciliation",
    cancelCta: "Cancel Session",
    correctPriorMatchCta: "Correct Prior Frozen Match",
    proof: {
      title: "Reconciliation Proof Equation",
      statementClosing: "Statement Closing Balance",
      outstandingDeposits: "Outstanding Deposits (+)",
      outstandingCheques: "Outstanding Cheques & Outflows (−)",
      ledgerBalance: "GL Ledger Balance at End Date (−)",
      postedAfterToDate: "Carried Postings After End Date (−)",
      difference: "Reconciliation Difference (=)",
      provedBadge: "Proved (0.00)",
      unprovedBadge: "Unproved — Must equal 0.00 to complete",
    },
    completeModal: {
      title: "Complete & Freeze Reconciliation Session #{sessionNo}?",
      irreversibleWarning: "Completing this session advances the bank account freeze boundary to {toDate}, permanently locks matched lines in this range as audit evidence, and updates the BANK_RECONCILED period-close gate.",
    },
  },
}
```

```ts
// ar.ts (exact key parity — Arabic RTL, Western digits formatted via ar-EG-u-nu-latn)
bankReconciliation: {
  hub: {
    title: "التسوية البنكية",
    subtitle: "استيراد كشوف الحسابات البنكية، وتأكيد مطابقة البنود بشرياً، وإثبات مطابقة الرصيد البنكي للدفاتر.",
    manageBankAccounts: "إدارة الحسابات البنكية",
    tabs: {
      sessions: "جلسات التسوية",
      statements: "كشوف الحساب والمطابقة",
      rules: "قواعد المطابقة",
      templates: "قوالب البنوك",
    },
    contextBar: {
      selectAccountPlaceholder: "اختر الحساب البنكي للشركة…",
      openedOn: "تاريخ الفتح",
      lastReconciledOn: "مجمَّد ومسوّى حتى",
      lastReconciledTooltip: "جلسات التسوية المكتملة تجمِّد القيود والمطابقات البنكية في هذا التاريخ أو قبله كدليل مراجعة.",
      lastClosingBalance: "آخر رصيد ختامي مستورد",
      openActiveSession: "فتح الجلسة النشطة #{sessionNo}",
      closedAccountNotice: "أُقفل هذا الحساب البنكي بتاريخ {closedOn}. يُسمح فقط بإتمام تسوية نطاق الإقفال وقيود المقاصة المتأخرة المسموح بها نظاماً.",
    },
  },
  importWizard: {
    trigger: "استيراد كشف بنكي",
    title: "استيراد كشف حساب بنكي",
    statementRef: "مرجع الكشف البنكي",
    template: "قالب كشف البنك",
    uploadOwnTemplateLink: "رفع قالب البنك الخاص بك",
    fromDate: "تاريخ بداية الكشف",
    toDate: "تاريخ نهاية الكشف",
    openingBalance: "الرصيد الافتتاحي المصرَّح به",
    openingContinuityHint: "يُتوقع مطابقته لآخر رصيد ختامي مستورد ({expected}).",
    closingBalance: "الرصيد الختامي المصرَّح به",
    dryRunLabel: "فحص تجريبي مسبق قبل اعتماد حفظ البنود بالدفاتر (موصى به)",
    commitCta: "اعتماد وحفظ الكشف المفحوص",
    cancelDryRunCta: "إلغاء الفحص التجريبي",
  },
  matching: {
    backToStatements: "كل الكشوف",
    runAutoMatch: "تشغيل المطابقة المقترحة",
    autoMatchZeroConfirmHint: "تُنشئ القواعد مطابقات مقترحة فقط، ويتطلب كل بند تأكيداً بشرياً صريحاً من المحاسب.",
    confirmMatchCta: "تأكيد المطابقة",
    confirmProposalCta: "تأكيد المطابقة المقترحة",
    unmatchCta: "إلغاء المطابقة",
    excludeCta: "استثناء البند",
    discardStatementCta: "استبعاد الكشف",
    frozenLineNotice: "مجمَّد ضمن جلسة تسوية مكتملة حتى {reconciledUntil}. لا يُعاد فتح الجلسات المكتملة؛ استخدم طلب تصحيح مطابقة سابقة في جلسة مفتوحة.",
    modes: {
      SETTLEMENT: "تسوية مقبوضات عميل",
      DIRECT_POSTING: "قيد مباشر من الكشف",
      PAYMENT: "دفعة مورد",
      INSTRUMENT: "شيك / ورقة تجارية",
      CASH_TRANSFER: "تحويل خزينة أو بنك",
      JOURNAL_ENTRY: "سطر قيد يومية مرحَّل",
    },
    addFeeSplitCta: "إضافة سطر عمولة بنكية / فرق عملة",
    postingAccountRole: "دور الحساب المحاسبي للقيد المباشر",
    toleranceReasonLabel: "سبب قبول الفرق (إلزامي فوق 1.00)",
    allocationSummary: {
      lineAmount: "مبلغ البند",
      allocated: "الموزَّع",
      remaining: "المتبقي",
      balancedReady: "توازن تام وجاهز للتأكيد",
    },
  },
  rules: {
    newRuleCta: "قاعدة مطابقة جديدة",
    governanceBanner: "تقتصر قواعد المطابقة على ترتيب واقتراح المرشحين فقط، ولا تقوم بترحيل أو تأكيد أي بند تلقائياً دون اعتماد بشري.",
  },
  templates: {
    uploadTemplateCta: "رفع قالب بنكي",
    tenantScopeBanner: "قوالب كشوف البنوك مشتركة على مستوى المستأجر بالكامل. قوالب حزمة الدولة للقراءة فقط ويمكن نسخها للتخصيص.",
  },
  session: {
    newSessionCta: "جلسة تسوية جديدة",
    expectedStartDateHint: "محددة تلقائياً باليوم التالي لآخر جلسة مكتملة ({expectedDate}).",
    goToMatchingCta: "متابعة مطابقة الكشف",
    submitReviewCta: "إحالة للمراجعة",
    reopenCta: "إعادة فتح الجلسة",
    completeCta: "اعتماد وإتمام التسوية",
    cancelCta: "إلغاء الجلسة",
    correctPriorMatchCta: "تصحيح مطابقة سابقة مجمَّدة",
    proof: {
      title: "معادلة إثبات التسوية البنكية",
      statementClosing: "رصيد الكشف الختامي",
      outstandingDeposits: "إيداعات بالطريق (+)",
      outstandingCheques: "شيكات ومدفوعات معلقة (−)",
      ledgerBalance: "الرصيد الدفتري في تاريخ النهاية (−)",
      postedAfterToDate: "قيود مرحَّلة بعد تاريخ النهاية ومحمولة (−)",
      difference: "فرق التسوية (=)",
      provedBadge: "متطابق تماماً (0.00)",
      unprovedBadge: "غير متطابق — يلزم تصفير الفرق للإتمام",
    },
    completeModal: {
      title: "اعتماد وتجميد جلسة التسوية #{sessionNo}؟",
      irreversibleWarning: "يؤدي إتمام الجلسة إلى رفع حد التجميد البنكي إلى {toDate}، وتثبيت المطابقات ضمن هذا النطاق كدليل مراجعة نهائي، واستيفاء شرط BANK_RECONCILED لإقفال الفترة.",
    },
  },
}
```

---

## 8. Contract Gaps List for `P03.T11` (LLD & Inventory Reconciliation)

Nothing below has been invented or assumed as already live in wire contracts; each item is isolated for resolution in `P03.T11` before `P04` / `P19` implementation:

| Gap ID | Severity | Contract / Inventory Location | Exact Discrepancy & Required `P03.T11` Resolution |
| --- | --- | --- | --- |
| **`CG-BNK-01`** | Documentation / Plan Alignment | `frontend/tenant-portal/docs/plans/accounting-screen-inventory.md` rows `SCR-25` (line 117), `SCR-26` (line 98), `SCR-29` (line 120) | **Row transposition & missing slice prerequisite tag:** `SCR-26` and `SCR-29` swapped route sets in `accounting-screen-inventory.md` (`SCR-29` also mislabeled `UC-TRS-5` instead of `UC-TRS-2, 2a, 2b, 2c`), and `SCR-25` (`/accounting/setup/banking` `#100`/`#101`) is marked `stage-only` although `P19.T05.S1` builds `bank-accounts` in the vertical slice. Update `accounting-screen-inventory.md` so `SCR-26` = Bank Reconciliation (`#54`–`#55`, `slice`), `SCR-29` = Outbound Payments & Payment Runs (`#34`–`#37`, `stage 4`), and `SCR-25` notes the `slice` company bank account subset. |
| **`CG-BNK-02`** | **High (Wire Contract)** | `02_Endpoint_Catalogue.md` §8 line 819 (`POST /accounting/bank-statements/import`) vs `02_DTOs.md` §9.3 line 2645 (`ImportBankStatementDto`) | **Statement upload transport mismatch:** Catalogue line 819 states `"Import a bank statement (multipart CSV/XLSX against a template)"` (`ACCOUNTING_IMPORT_MULTIPART` rate limit), whereas `ImportBankStatementDto` declares `fileRef: string` (`"a storage key uploaded before the call"`) and no pre-upload storage-key mint endpoint exists for unattached import files (`POST /accounting/attachments` requires an existing `resId`). `P03.T11` must freeze whether `POST /accounting/bank-statements/import` accepts `multipart/form-data` (`file` + DTO fields, matching `POST /accounting/imports` line 1096) or adds a dedicated `POST /accounting/imports/upload-url` intent. |
| **`CG-BNK-03`** | **Medium (Missing DTO Shapes)** | `02_DTOs.md` §9.1 & §9.3 vs `02_Endpoint_Catalogue.md` §8 lines 816–841 | **Undeclared command, update, and list-query DTOs:** `02_DTOs.md` §9 omits explicit class declarations for: (a) `CreateBankStatementTemplateDto` (`POST /accounting/bank-statement-templates`), (b) `CancelReconciliationSessionDto` (`POST /accounting/bank-reconciliations/:id/cancel` — `{ reason: string }` `10..200` chars matching `acc_bank_reconciliation_sessions.cancelled_reason varchar(200)`), (c) `UpdateBankMatchingRuleDto` (`PATCH /accounting/bank-matching-rules/:id`) & `BulkUpdateBankMatchingRulesDto` (`PATCH .../bulk-update`), and (d) list query DTOs `ReconciliationSessionListQueryDto` (`bankAccountId?`, `status?`, `periodId?`, `fromDate?`, `toDate?`), `BankMatchingRuleListQueryDto` (`bankAccountId?`, `isActive?`, `action?`), `BankStatementTemplateListQueryDto` (`bankCode?`, `format?`, `owner?`, `isActive?`), plus adding `status?: BankStatementStatus` to `BankStatementListQueryDto`. |
| **`CG-BNK-04`** | **High (Session Proof UX & Zero-Float Law)** | `02_DTOs.md` §9.4 lines 2720–2725 (`ReconciliationSessionDetailDto`) & `06_Treasury_Tables.md` §7.1 lines 1512–1517 | **Proof equation figures are `null` until `COMPLETED`, and itemized outstanding GL rows have no read projection:** On an `OPEN` or `IN_REVIEW` session, `statementClosingBalance`, `ledgerBalance`, `outstandingDeposits`, `outstandingCheques`, and `difference` are stored as `NULL` until `complete` runs, yet the accountant cannot diagnose a `422 ACCOUNTING.BANK.RECONCILIATION_DIFFERENCE` refusal (and the frontend is forbidden from computing client-side float sums!). `P03.T11` should add a live server-computed `computedProof` block on `GET /accounting/bank-reconciliations/:id` while `OPEN`/`IN_REVIEW` and a paginated read sub-projection (or `GET /accounting/bank-reconciliations/:id/unmatched-ledger-lines`) for the `unmatchedLedgerCount` & `postedAfterToDateAmount` items. |
| **`CG-BNK-05`** | **High (Line Matching Projection)** | `02_Endpoint_Catalogue.md` §8 line 818 (`GET /accounting/bank-statements/:id/lines`), `02_DTOs.md` §13.1 rules 3–4, `06_Treasury_Tables.md` §7.1 | **Statement line `description` (`text`), live `allocations[]` (`wrongMatchId`), and `PROPOSED` details omitted by default §13.1 summary rules:** Because `acc_bank_statement_lines.description` is `text` (not `varchar(<=255)`) and there is no `GET /accounting/bank-statements/:id/lines/:lineId` detail route, strict §13.1 `SummaryDto` rules would strip `description`, `allocations[]` (`acc_bank_statement_line_matches`, including `id` needed as `wrongMatchId` in `CorrectBankMatchDto` and `acceptProposalId` in `ConfirmMatchDto`!). `P03.T11` must explicitly declare `BankStatementLineItemDto` on `GET /accounting/bank-statements/:id/lines` carrying bounded `description`, `allocations[]` (live & proposed), and active correction request summary. |
| **`CG-BNK-06`** | **Low (Report Download Route)** | `06_Treasury_Tables.md` §7.1 lines 1524–1525 (`report_ref`, `report_sha256`) & `02_DTOs.md` §13.1 rule 1 vs `02_Endpoint_Catalogue.md` §8 | **Missing signed download route for completed reconciliation report:** Completing a session renders and stores `report_ref` + `report_sha256`, and §13.1 rule 1 withholds `report_ref` behind `SignedDownloadDto`, yet §8 has no `GET /accounting/bank-reconciliations/:id/report/download` endpoint. `P03.T11` should add this download route (or confirm export via `report-runs`). |
| **`CG-BNK-07`** | **Low (Path/Body Duplicate UUIDs)** | `02_DTOs.md` §9.3 (`ConfirmMatchDto.statementLineId`, `UnmatchDto.statementLineId`, `ExcludeStatementLineDto.statementLineId`, `CompleteReconciliationDto.sessionId`) | **Path parameter repeated in request body:** Each DTO requires the same UUID already present in `:lineId` or `:id` (`POST .../imports/:id/commit` has the same pattern with `CommitImportDto.importJobId`). Frontend sends the exact route UUID in both path and body; `P03.T11` should confirm controller equality validation (`param === body`) or make the body copy optional. |

## Contract reconciliation (P03.T11, 1 November 2026)

Reconciles the gaps of this spec against the Endpoint Catalogue and `02_DTOs.md` after `D-770`, `D-771` and `D-772`. The gap list above keeps the original findings; these rulings are final.

| Gap id | Ruling | Where |
| --- | --- | --- |
| `CG-BNK-01` | already in the contract | Bank accounts ship in the slice (P19.T05.S1); the transposed inventory rows `SCR-26` and `SCR-29` and the stage-only mark of `SCR-25` are an inventory-only correction, not a contract change |
| `CG-BNK-02` | duplicate of CG-WF-01 | Closed by D-772: the bank-statement import is one multipart request (`file` part plus the `ImportBankStatementDto` `body` part); no `fileRef` |
| `CG-BNK-03 (a)` | closed by D-772 | `CreateBankStatementTemplateDto` (ERD columns; `companyId` in the body because the route is `TENANT`) and `CancelReconciliationSessionDto { reason: 10..200 }` |
| `CG-BNK-03 (b)` | already in the contract | `UpdateBankMatchingRuleDto = PartialType(CreateBankMatchingRuleDto)` and `BulkUpdateBankMatchingRulesDto { ids, patch }` (Blueprint §6); `code` is immutable |
| `CG-BNK-03 (c)` | already in the contract | List filters go through the repository `filter` on whitelisted columns (`status`, `bank_account_id`, `is_active`); `BankStatementListQueryDto` is declared; no new DTOs for the slice |
| `CG-BNK-04` | closed by D-772 | New routes `GET /accounting/bank-reconciliations/:id/proof` (`ReconciliationProofDto`: live while `OPEN` or `IN_REVIEW`, stored once `COMPLETED` or `CANCELLED`) and `GET /accounting/bank-reconciliations/:id/outstanding-items` (`ReconciliationOutstandingItemDto`) |
| `CG-BNK-05` | closed by D-772 (correct-match part deferred to P25) | `BankStatementLineSummaryDto` (every column but `raw`, `description` kept, plus live `allocations[]`); the correct-match summary and `wrongMatchId` part belongs to the P25 correct-match screen (stage 4) |
| `CG-BNK-06` | deferred to stage 4 (P25 definition of ready) | `GET /bank-reconciliations/:id/report/download` (`accounting.bank_statement.read`, `SignedDownloadDto`); the slice shows the proof without the file |
| `CG-BNK-07` | duplicate of CG-SLICE-DOC-09 | Closed by D-772: the path `:lineId` and `:id` are the only source for `ConfirmMatchDto`, `UnmatchDto`, `ExcludeStatementLineDto` and `CompleteReconciliationDto`; `CorrectBankMatchDto.statementLineId` names another row and stays |
