# Accounting Stage-1 Screen Designs — `SCR-02` (Chart of Accounts, Groups, Roles, Mappings & Merge) & `SCR-03` (Fiscal Calendars, Periods, Journals & Number Sequences)

> **Lead review, 1 November 2026 (P03.T09).** No correction was needed; `DELETE /fiscal-years/:id` and `DELETE /account-roles/:role` are named only as absent. Every route, permission, feature key and scope below was checked against `docs/LLD/accounting-app/02_API_Contracts/02_Endpoint_Catalogue.md` and `04_Static_Data/05_Permissions_and_Features.md`; what the contracts lack stays in the contract gap list for `P03.T11`.

- **Plan Task:** `P03.T09.S2` (`backend/docs/plans/accounting-app-plan-p03-ux-foundation.md`)
- **Review Gate:** Lead Review (`docs/design/README.md` — Accounting design process)
- **Last Verified Against Contracts:** `2026-11-01`
- **Target Portal:** Tenant Portal (`http://<tenant-host>:5002`, Next.js 16 + Tailwind v4, `@/design-system` barrel only)
- **Screen Inventory Authority:** `frontend/tenant-portal/docs/plans/accounting-screen-inventory.md` — rows **`SCR-02`** (`#89`, `#90`; `[P: 39]`) and **`SCR-03`** (`#91`; `[P: 15]` + `[S]` / `SCR-11` fiscal years, periods, reopen-log, and user-period-overrides)
- **Backend Contract Authorities:**
  - `backend/docs/LLD/accounting-app/02_API_Contracts/02_Endpoint_Catalogue.md` (§1–§3 Module `01 LFO`)
  - `backend/docs/LLD/accounting-app/07_Modules/10_MVP/01_ledger_foundation.md` (`UC-LFO-2`..`UC-LFO-4`, `VAL-LFO-01`..`VAL-LFO-35`)
  - `backend/docs/LLD/accounting-app/04_Static_Data/02_DTOs.md` (§1–§4.7, §13.1, §13.2)
  - `backend/docs/LLD/accounting-app/04_Static_Data/01_Enums.md` (§2, §3, §6, §17)
  - `backend/docs/LLD/accounting-app/04_Static_Data/04_Errors_and_Constants.md` (§2–§7)
  - `backend/docs/LLD/accounting-app/01_ERD/01_Foundation_Tables.md` (§5–§7)
- **Binding UX Foundation Specs (Reused Verbatim — Never Redesigned):**
  - `frontend/tenant-portal/docs/design/specs/accounting-ia.md` (routes `#89`–`#91`, `#65`–`#66`; `AccountingScopeBar`; hidden-vs-disabled matrix)
  - `frontend/tenant-portal/docs/design/specs/accounting-home.md` (onboarding readiness deep-links `ACT-05`..`ACT-08`, `ACT-11`, `ACT-14`)
  - `frontend/tenant-portal/docs/design/specs/accounting-status-and-a11y.md` (four outcome hues, non-colour status icons, `<IdentifierText>`, RTL/LTR rules, `ar-EG-u-nu-latn` Western digits)
  - `frontend/tenant-portal/docs/design/specs/accounting-patterns-data.md` (`UX-05` `LedgerDataGrid`, `UX-06` `MoneyDisplay`/`MoneyInput`, `UX-07` `AccountPicker`, `UX-08` `FiscalPeriodPicker`)
  - `frontend/tenant-portal/docs/design/specs/accounting-patterns-workflow.md` (`UX-10` `ApprovalActionPanel`, `UX-11` `TwoPhaseImportWizard` & `AsyncJobProgressBanner`, `UX-13` `PeriodCloseChecklistPanel`)
  - `frontend/tenant-portal/docs/design/specs/accounting-patterns-documents.md` (`UX-16` waiting states, `UX-17` `useAccountingErrorModel` 3-part error copy, `UX-18` `AccountingBoundaryGate`, `UX-19` `AmbiguousOutcomePanel` & `ConflictDialog`)

---

## 0. Governance, `ui-ux-pro-max` Design Decisions & Scope Reconciliation

### 0.1 `ui-ux-pro-max` & Tenant Portal Five Laws Applied

Consulted `frontend/.agents/skills/ui-ux-pro-max/SKILL.md`, `frontend-design/SKILL.md`, and `frontend/tenant-portal/docs/design/README.md` before designing layout, density, hierarchy, and interaction states:

1. **Enterprise Ledger Workspace Density & Visual Calm:** Compact `44px` (`h-11`) control/row rhythm on desktop (`36px` compact dense sub-grids where needed, `44px × 44px` minimum touch target on `<768px`), `1440px` reference frame (`1152px` net workspace width beside the `288px` sidebar), zero decorative gradients, zero arbitrary `text-[Npx]`, zero `font-bold`, and zero `rounded-xl` or larger radii.
2. **Strict Three-Weight Typography:** Only `400` (`font-normal`), `500` (`font-medium`), and `600` (`font-semibold`). Every `DataTable` body cell renders at `400`; `500` is reserved for column headers, tabs, and field labels; `600` is reserved for `PageHeader` titles and summary KPI counts.
3. **Four Outcome Roles + `ink` Neutral Ramp Only:**
   - `brand`: Solely on the **at most one `variant="primary"` CTA** in `PageHeader` and active keyboard focus rings (`focus-visible:ring-2`).
   - `positive`: Active/postable, `OPEN` fiscal year/period, `108/108` role completeness, `COMPLETED` jobs.
   - `caution`: `SOFT_CLOSED` period, `CLOSING` year, `LIMITED` tax deductibility, `hasPostedLines = true` structural freeze notice, unassigned optional slots, live temporary override.
   - `negative`: Soft-deleted/deprecated exclusion warnings, blocking errors, `FAILED` bulk/import rows, unassigned required operating roles (`< 108/108`).
   - `ink` (neutral ramp) + `--swatch-*` category tokens: `FUTURE`, `CLOSED`, `PERMANENTLY_CLOSED`, `AccountType` (`ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`, `OFF_BALANCE`, `STATISTICAL`), `JournalKind`, and `PeriodKind`. **Account type, journal kind, and hierarchy depth are never mapped to semantic outcome colours.** Every status badge pairs an icon + localized `t.status.*` string (WCAG 1.4.1 non-colour cue).
4. **Bilingual Parity (`AR-RTL` / `EN-LTR`) & LTR Technical Islands:**
   - Zero language ternaries (`locale === 'ar' ? ... : ...`) in TSX; every label, hint, badge, empty state, and 3-part error message comes from `ar` and `en` dictionaries.
   - Logical CSS properties exclusively (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `text-end`, `border-s`, `border-e`); `pnpm design:rtl` enforces `0` physical directional classes.
   - Every account code (`1101.01`), group prefix (`11`), materialized `path` (`1000/1100/1101`), `Journal.code` (`SALES`), `sequencePolicy.prefixPattern` (`{JOURNAL}-{YYYY}-`), `DecimalString` (`deductiblePct` `"50.00"`), `Sha256Hex`, `ETag`, `ISO8601`/`ISODate`, and `UUIDv7` renders inside `<IdentifierText>` (`<bdi dir="ltr">` with `tabular-nums` and Western digits `0–9` via `ar-EG-u-nu-latn` / `en-US`). **`Number()` is never called on a `DecimalString`.**
5. **Transport, Idempotency & Concurrency:**
   - All browser calls route through `src/lib/api/axiosClient.ts` to canonical Gateway URLs `/api/tenant/accounting/v1/<path>` (never raw `fetch`, never controller-relative `/accounting/*` without the Gateway prefix).
   - Every command whose `02_Endpoint_Catalogue.md` `Idempotency` cell is `x-idempotency-key` or `x-idempotency-key (7 d)` generates one fresh `UUIDv7` via `generateUUIDv7()` (`src/lib/uuid.ts` — **never `crypto.randomUUID()`**) per user intent and reuses that exact key only when retrying the same intent.
   - Every command whose `Concurrency` cell is `If-Match` sends `If-Match: "<version>"` from the latest loaded `ETag` / `version`.

### 0.2 Scope & Ownership Reconciliation (`SCR-02`, `SCR-03`, and `SCR-11`)

Per `accounting-screen-inventory.md` §2 and the `P03.T09.S2` brief:

| Screen Row | Canonical Next.js Route(s) | Primary Owned Endpoints (`[P]`) | Shared / Cross-Surface Endpoints (`[S]`) |
| --- | --- | --- | --- |
| **`SCR-02`** | `#89` `/accounting/setup/chart-of-accounts`<br>`#90` `/accounting/setup/chart-of-accounts/[id]` | **`[P: 39]`** — `charts` (`6`), `chart-templates` (`2`), `account-groups` (`6`), `accounts` (`17`), `account-merges` (`1`), `account-roles` (`3`), `account-mappings` (`4`) | **`[S]`** `GET /accounting/company-profile` (resolves active company's `chart.id`, `countryCode`, `functionalCurrencyCode`), `GET /accounting/dimension-types` (populates `requiresDimensionTypeCodes` picker when `accounting.dimension.read` is held) |
| **`SCR-03`** | `#91` `/accounting/setup/calendars-journals` | **`[P: 15]`** — `fiscal-calendars` (`6`), `journals` (`7`), `number-sequences` (`2`) | **`[S]`** Onboarding & setup access to `fiscal-years` (`GET`, `GET /:id`, `POST`, `POST /:id/open`), `periods` (`GET`, `POST /search`, `GET /:id`, `POST /:id/state`, `POST /bulk-state`, `POST /:id/reopen`, `GET /reopen-log`), and `user-period-overrides` (`GET`, `POST`, `DELETE /:id`) — whose primary operational close owner is **`SCR-11`** (`#65` `/accounting/close/periods`, `#66` `/accounting/close/periods/[id]`), plus `GET /accounting/company-profile` and `GET /accounting/settings` (`numbering.*_series` cross-link) |

> **Design Unity Rule:** To prevent duplicate UI implementations between `#91` (`SCR-03`, Setup) and `#65`/`#66` (`SCR-11`, Close), all Fiscal Year, Period Module State Matrix (`GL`/`AR`/`AP`/`TAX`), Reopen Log, and User Period Override components live in shared domain modules under `src/features/accounting/calendars/` and are mounted in `#91` Tabs 2–3 (for onboarding & setup administration) and reused by `SCR-11` (`P03.T09.S6`) alongside Year-End Closing (`POST /fiscal-years/:id/close`, `POST /fiscal-years/:id/rerun-requests`, `POST /fiscal-years/:id/record-income-tax-filing`, `year-end-closings`). Section 2 below specifies **both** all `[P: 15]` routes of `SCR-03` **and** the complete Fiscal Year, Period State, Reopen Log, and User Period Override contracts required by the `P03.T09.S2` brief.

### 0.3 Planned Component & Hook File Split (`< 300` Lines Rule)

Every file stays strictly under ~300 lines with pure `.tsx` views and logic isolated in `hooks/use*.ts`:

- **`SCR-02` (`src/features/accounting/chart-of-accounts/`)**:
  - `ChartOfAccountsWorkspaceView.tsx` + `hooks/useChartOfAccountsWorkspace.ts` (`#89` shell, `PageHeader`, `AccountingScopeBar`, `StatStrip`, tab router)
  - `components/AccountsTabView.tsx` + `hooks/useAccountsTab.ts` (split group rail + `DataTable` + advanced search + bulk bar + export)
  - `components/AccountFormDrawer.tsx` + `hooks/useAccountForm.ts` (`CreateAccountDto` / `UpdateAccountDto` + freeze/control guards)
  - `components/AccountGroupsTabView.tsx` + `hooks/useAccountGroupsTab.ts` (`depth 1..8` hierarchy + `AccountGroupFormDrawer`)
  - `components/AccountRolesTabView.tsx` + `hooks/useAccountRolesTab.ts` (`116` role slots grouped into `7` sections + inline/bulk assignment)
  - `components/AccountMappingsTabView.tsx` + `hooks/useAccountMappingsTab.ts` (`UNIFORM_EG` / `GROUP` / `STATUTORY` CRUD)
  - `components/ChartsAndTemplatesTabView.tsx` + `hooks/useChartsAndTemplates.ts` (`charts` CRUD + read-only `chart-templates` preview drawer)
  - `components/AccountMergesLogTabView.tsx` + `hooks/useAccountMergesLog.ts` (append-only `acc_account_merges` table)
  - `AccountDetailView.tsx` + `hooks/useAccountDetail.ts` (`#90` detail sections, `DeprecateAccountDialog`, `MergeAccountModal`)
- **`SCR-03` (`src/features/accounting/calendars/`)**:
  - `CalendarsJournalsWorkspaceView.tsx` + `hooks/useCalendarsJournalsWorkspace.ts` (`#91` shell, `PageHeader`, `AccountingScopeBar`, tab router)
  - `components/FiscalCalendarsTabView.tsx` + `hooks/useFiscalCalendarsTab.ts` (`fiscal-calendars` CRUD + `CalendarFormDrawer`)
  - `components/FiscalYearsPanelView.tsx` + `hooks/useFiscalYearsPanel.ts` (`fiscal-years` list, `CreateFiscalYearDrawer`, `OpenFiscalYearDialog` — shared with `SCR-11`)
  - `components/PeriodStateMatrixView.tsx` + `hooks/usePeriodStateMatrix.ts` (`GL`/`AR`/`AP`/`TAX` matrix, `ChangePeriodStateDialog`, `ReopenPeriodDialog`, `BulkPeriodStateBar` — shared with `SCR-11`)
  - `components/UserPeriodOverridesPanelView.tsx` + `hooks/useUserPeriodOverrides.ts` (`user-period-overrides` list, `GrantOverrideDrawer`, revoke — shared with `SCR-11`)
  - `components/PeriodReopenLogPanelView.tsx` + `hooks/usePeriodReopenLog.ts` (`periods/reopen-log` read-only audit grid — shared with `SCR-11`)
  - `components/JournalsTabView.tsx` + `hooks/useJournalsTab.ts` (`journals` list/search + `JournalFormDrawer` with live sequence token preview)
  - `components/NumberSequencesTabView.tsx` + `hooks/useNumberSequencesTab.ts` (read-only `number-sequences` list + detail drawer)

---

## 1. Screen `SCR-02` — Chart of Accounts, Templates, Groups, Roles, Mappings & Merge

- **Routes:**
  - `#89` `/accounting/setup/chart-of-accounts` (`accountingSetupChartOfAccounts`) — Master Multi-Tab Workspace
  - `#90` `/accounting/setup/chart-of-accounts/[id]` — Single Account Detail, Governance, Deprecate & Merge Screen
- **Navigation Section:** `Setup` (`الإعدادات والتهيئة`) -> `Chart of Accounts` (`دليل الحسابات`)
- **Use Case & Journey Steps:** `UC-LFO-2` · `JRN-ACT` steps `ACT-05`, `ACT-06`, `ACT-11` (`SCN-002`, `SCN-008`..`SCN-010`)
- **Feature Entitlement Gate:** `accounting.ledger.core` (Basic — required for entire route; unentitled renders `AccountingBoundaryGate` / absent from nav per `accounting-ia.md` §3)
- **Route Admission Permission:** `accounting.account.read` OR `accounting.chart.read` (each sub-tab gates its own `.read` query independently so an actor with `accounting.chart.read` only can still inspect Charts, Templates, and Groups while Accounts renders `PermissionGate`, and vice versa)

### 1.1 Layout & Progressive-Disclosure Hierarchy

#### A. Route `#89` (`/accounting/setup/chart-of-accounts`) — 4-Band Vertical Layout

1. **Band 1 — `AccountingScopeBar` + Active Chart Selector Bar:**
   - Displays active `Company` (`X-Company-Id` operating context from `AccountingScopeBar`) and a **Target Chart Selector** (`Select` populated from `GET /accounting/charts`, defaulting to `companyProfile.chart.id` when `accounting.profile.read` is held).
   - Displays chart ownership pill next to the selected chart:
     - `shared === false`: `[خاص بالشركة · Company chart]` (`ink` neutral badge).
     - `shared === true`: `[دليل مشترك بين الشركات · Shared tenant chart]` (`caution` badge with info tooltip explaining `D-064`: mutations affect every company attached to this chart and require tenant-wide chart authority, otherwise `403 ACCOUNTING.CHART.SHARED_MUTATION_FORBIDDEN`).
2. **Band 2 — `PageHeader` (Single `variant="primary"` CTA Law):**
   - **Title:** `دليل الحسابات والأدوار` / `Chart of Accounts & Roles`
   - **Subtitle:** `إدارة الحسابات والمجموعات الهرمية وأدوار الترحيل الـ 116 والربط المرجعي` / `Manage accounts, hierarchy groups, 116 posting role slots, and external mappings`
   - **Primary CTA (at most 1 `variant="primary"` on screen, context-switched by active tab & permission):**
     - Tab `accounts` (`accounting.account.create`): `+ حساب جديد` / `+ New account` -> opens `AccountFormDrawer`.
     - Tab `groups` (`accounting.chart.create`): `+ مجموعة جديدة` / `+ New group` -> opens `AccountGroupFormDrawer`.
     - Tab `roles` (`accounting.account.assign_role`): `حفظ التعديلات المجمعة (N)` / `Save role changes (N)` (enabled when dirty drafts > 0 -> calls `PATCH /accounting/account-roles/bulk-update`).
     - Tab `mappings` (`accounting.account.map`): `+ ربط خارجي جديد` / `+ New mapping` -> opens `AccountMappingDrawer`.
     - Tab `charts` (`accounting.chart.create`): `+ دليل حسابات جديد` / `+ New chart` -> opens `CreateChartDrawer`.
     - Tab `merges`: **No primary CTA** (append-only evidence log; merges are initiated from `#90` or row action `Merge into...` on a specific source account).
   - **Secondary Utility Actions (`variant="secondary"` / `DropdownMenu` on `accounts` tab):**
     - `تصدير` / `Export` (`CSV` / `XLSX` -> `POST /accounting/accounts/export`, `accounting.account.read`).
     - `استيراد` / `Import` (`accounting.account.create`):
       - **Stage 1 (`P15`, pre-`P17.T06` per `D-691` / `CG-18`):** Disabled menu item with factual one-line note (`يتاح استيراد الملفات عند تفعيل محرك الاستيراد المرحلي` / `File import activates with the two-phase import service`).
       - **Stage 1 Full (`P17.T06+`):** Opens `TwoPhaseImportWizard` (`POST /accounting/accounts/import` with `x-idempotency-key (7 d)`).
3. **Band 3 — Compact `StatStrip` (4 KPI Cards):**
   - Powered by `POST /accounting/accounts/count` (for active `chartId`) and `GET /accounting/account-roles`:
     1. **Total Live Accounts (`إجمالي الحسابات النشطة`)**: `POST /accounts/count` (`{ chartId, includeDeprecated: false }`) — `ink`.
     2. **Postable Leaf Accounts (`حسابات قابلة للترحيل`)**: `POST /accounts/count` (`{ chartId, isPostable: true, includeDeprecated: false }`) — `positive`.
     3. **Control Accounts (`حسابات رقابية`)**: `POST /accounts/count` (`{ chartId, isControl: true }`) — `ink`.
     4. **Operating Role Coverage (`تغطية الأدوار التشغيلية`)**: Resolved operating slots `/ 108` from `GET /accounting/account-roles` (`positive` when `108 / 108`, `negative` with jump-link to Tab 3 when `< 108 / 108` because `ACT-14` readiness gate `account roles resolved` blocks first document posting).
4. **Band 4 — 6-Tab Progressive-Disclosure Workspace (`Tabs`):**
   - **Tab 1 — `Accounts` (`الحسابات`):**
     - **2-Pane Desktop Split (`>= 1024px`):**
       - **Start Rail (`280px` width, collapsible; `Select` filter on `< 1024px`):** Account Group hierarchy tree (`GET /accounting/account-groups?chartId=...`, `depth 1..8`) with `"All accounts"` root node plus each group's `<IdentifierText>{code}</IdentifierText>`, localized `nameI18n`, and optional `codePrefix` chip (`11*`). Clicking a group sets `AccountListQueryDto.groupId`.
       - **Main Pane (`flex-1`):**
         - Filter toolbar: `FilterSearchInput` (`search`), `Select` filters for `accountType`, `classification`, `isPostable`, `isControl`, `role` (`AccountRole`), toggle chips for `includeDeprecated` (`إظهار المتوقفة`) and `withDeleted` (`إظهار المحذوفة`), plus `بحث متقدم` / `Advanced search` button toggling `CrmAdvancedSearchCard` (`POST /accounting/accounts/search` over allowlisted fields `code`, `name_i18n`, `account_type`, `classification`, `tags`, `path` only).
         - `DataTable` over `AccountSummaryDto[]` with row selection checkboxes. Selecting `>= 1` rows reveals sticky `BulkActionBar` (`PATCH /accounts/bulk-update` for batch `classification`/`groupId`/`tags`, `POST /accounts/bulk-delete` for unreferenced accounts, `POST /accounts/bulk-restore` when viewing `withDeleted=true`, and `POST /accounts/bulk` paste-rows modal).
         - Clicking a row's code/name navigates via `Link` to `#90` (`/accounting/setup/chart-of-accounts/[id]`). Row overflow menu offers `View (#90)`, `Quick Edit Drawer`, `Deprecate`, `Merge into...`, `Delete` (enabled only when unreferenced), or `Restore` (when soft-deleted).
   - **Tab 2 — `Account Groups` (`مجموعات الحسابات`):**
     - Indented hierarchy table (`depth 1..8`) over `GET /accounting/account-groups?chartId=...` displaying `<IdentifierText>{code}</IdentifierText>`, localized `nameI18n`, `codePrefix` badge (drives automatic prefix membership per `D-176`), `depth`, parent group, and row actions (`Add child group` when `depth < 8`, `Edit`, `Delete`, `Restore`).
   - **Tab 3 — `Account Roles (116)` (`أدوار الحسابات — 116`):**
     - Filter bar: `FilterSearchInput` (filters role key or localized label), `Resolution filter` (`All`, `Unassigned operating`, `Company overrides`, `Chart defaults`, `Reserved wave slots`).
     - Accordion / sectioned table grouped into the **7 canonical `01_Enums.md` §6 categories**:
       1. `Assets / الأصول` (`35` slots)
       2. `Liabilities / الالتزامات` (`30` slots)
       3. `Equity / حقوق الملكية` (`7` slots)
       4. `Revenue / الإيرادات` (`8` slots)
       5. `Expenses / المصروفات` (`17` slots)
       6. `Neutral, Clearing & Differences / التسويات والفروق المحايدة` (`11` slots — including `FX_POSITION` with `D-229` system badge)
       7. `Reserved Wave Slots / أدوار الإصدارات القادمة` (`8` slots — `ZERO_BALANCE_CLEARING`, `POS_CLEARING`, `NETTING_CLEARING`, `ALLOCATION_CLEARING`, `WORK_IN_PROGRESS`, `PRODUCTION_VARIANCE`, `CONTINGENT_EXPOSURE`, `CONTINGENT_EXPOSURE_CONTRA` — collapsed by default with neutral `[محجوز لموجة لاحقة · Reserved wave slot]` badge).
     - Each row displays: Role localized name + `<IdentifierText>{accountRole}</IdentifierText>`, Resolution Source badge (`[تخصيص الشركة · Company override]` vs `[افتراضي الدليل · Chart default]` vs `[غير معيّن · Unassigned]`), inline `AccountPicker` (`POST /accounting/accounts/lookup` with `chartId` + `postableOnly: true`), Scope target toggle (`Company override` `companyId = activeCompanyId` vs `Chart default` `companyId = undefined`), and per-row `Save` (`PATCH /accounting/account-roles/:role` with `If-Match`) or multi-row dirty batch commit (`PATCH /accounting/account-roles/bulk-update`).
   - **Tab 4 — `External Mappings` (`الربط المرجعي الخارجي`):**
     - `DataTable` over `GET /accounting/account-mappings` showing Account, `scheme` (`UNIFORM_EG`, `GROUP`, `STATUTORY`), `<IdentifierText>{targetCode}</IdentifierText>`, `effectiveFrom`, `effectiveTo`, and actions (`Edit` `PATCH /:id`, `Delete` `DELETE /:id`).
   - **Tab 5 — `Charts & Pack Templates` (`أدلة الحسابات وقوالب الحزم`):**
     - Top section: Tenant Charts table (`GET /accounting/charts`) with `code`, `nameI18n`, `countryCode`, `templateCode`, `shared`, `effectiveFrom`, and actions (`Edit`, `Delete` when unused, `Restore`).
     - Bottom section: Read-only **System Pack Chart Templates** (`GET /accounting/chart-templates`). Clicking `Inspect template` opens a wide `DetailDrawer` calling `GET /accounting/chart-templates/:id` to preview `packCode`, `packVersion`, `contentHash`, and the template's seeded `rows[]` (`code`, `nameI18n`, `accountType`, `normalBalance`, `roles[]`) plus a `"Create chart from this template"` shortcut that pre-fills `CreateChartDto.templateCode` and `countryCode` (when `accounting.chart.create` is held).
   - **Tab 6 — `Merge Redirect Log` (`سجل دمج الحسابات`):**
     - Read-only append-only audit `DataTable` (`GET /accounting/account-merges`) showing `fromAccount` -> `intoAccount`, `effectiveFrom`, `reason` (see `CG-S2-06`), `approvalRequestId`, `createdAt`, and `createdBy`, with an informational callout explaining `D-176`: posted historical journal lines stay untouched on `fromAccountId`; financial reports redirect balances from `effectiveFrom` onward.

#### B. Route `#90` (`/accounting/setup/chart-of-accounts/[id]`) — Account Detail & Lifecycle Screen

1. **Breadcrumb & `DetailHeader`:**
   - Breadcrumb: `الإعدادات` / `Setup` -> `دليل الحسابات` / `Chart of Accounts` (`Link` to `#89`) -> `<IdentifierText>{account.code}</IdentifierText>`.
   - Header badges: `AccountType` (`ink`), `NormalBalance` (`DEBIT` / `CREDIT`), `isPostable` (`قابلة للترحيل · Postable` `positive` vs `حساب تجميعي · Header` `ink`), `isControl` (`حساب رقابي · Control` `ink` + lock icon), `deprecatedAt` (`متوقف منذ YYYY-MM-DD · Deprecated` `caution` when non-null).
   - Primary CTA (`variant="primary"`, `accounting.account.update`): `تعديل الحساب` / `Edit account` -> opens `AccountFormDrawer` in edit mode.
   - Secondary Actions (`variant="secondary"` / `DropdownMenu`):
     - `إيقاف الاستخدام` / `Deprecate` (`POST /accounting/accounts/:id/deprecate`, `accounting.account.deprecate`, `If-Match`, visible when `deprecatedAt === null`).
     - `دمج في حساب آخر…` / `Merge into account…` (`POST /accounting/accounts/:id/merge`, `accounting.account.merge`, `If-Match`, visible when `isPostable === true`).
     - `حذف` / `Delete` (`DELETE /accounting/accounts/:id`, `accounting.account.delete`, `If-Match`, disabled with tooltip when `hasPostedLines === true` or `roles.length > 0`).
2. **Conditional Governance Banners (`AlertBanner`):**
   - **Posted-Activity Structural Freeze (`hasPostedLines === true`):** `caution` banner stating that `chartId`, `code`, `accountType`, `normalBalance`, and `isControl` are permanently locked because posted journal lines exist (`VAL-LFO-09`, `D-065`); display names (`nameI18n`), `groupId`, `taxDeductibility`, `fxTreatment`, `requiresDimensionTypeCodes`, and `tags` remain editable.
   - **Control Account Manual-Entry Fence (`isControl === true`):** `ink` informational banner stating `allowManualJournal` is forced `false` (`D-028`); only subledger engines (AR, AP, Treasury, Payroll) may post to this account.
3. **2-Column `DetailSection` Grid:**
   - **Card 1 — Identity & Hierarchy (`الهوية والتسلسل الهرمي`):** `code`, `nameI18n.ar`, `nameI18n.en`, `chartId`, `parentId` (link to parent `#90`), materialized `path` (`<IdentifierText>`), `groupId`, `classification` (`CURRENT` / `NON_CURRENT` / `NOT_APPLICABLE`).
   - **Card 2 — Posting, Currency & Control (`ضوابط الترحيل والعملة`):** `accountType`, `normalBalance`, `isPostable`, `isControl`, `allowManualJournal`, `allowReconciliation`, `currencyCode` (`"Any transaction currency"` when `null`, or strict ISO-4217 currency badge), `hasPostedLines`.
   - **Card 3 — Tax Deductibility & FX Revaluation (`الخصم الضريبي وإعادة تقييم العملة`):** `taxDeductibility` (`YES` / `NO` / `LIMITED`), `deductiblePct` (`DecimalString` `%` shown iff `LIMITED`), `fxTreatment` (`MONETARY` / `NON_MONETARY` / `NONE`).
   - **Card 4 — Dimensions, Roles & Tags (`الأبعاد الإلزامية والأدوار والوسوم`):** `requiresDimensionTypeCodes[]` (max 4 badges), `roles[]` (all `AccountRole` slots currently resolving to this account, linking to `#89?tab=roles`), `tags[]` (max 20 chips).
   - **Card 5 — External Mappings & Cross-Links (`الربط الخارجي والاختصارات`):** Filtered mappings for this `accountId` + quick outbound `Link`s to Trial Balance (`#72` `/accounting/close/statements?accountId=...`) and General Ledger Lines (`#14` `/accounting/post/journal-entries?accountId=...`) when `accounting.report.read` / `accounting.journal_entry.read` is held.

---

### 1.2 Components Reused from Approved Patterns (`@/design-system` & `P03` Specs)

| Component / Pattern | Source (`@/design-system` or `P03` Spec) | Exact Role on `SCR-02` (`#89` & `#90`) |
| --- | --- | --- |
| `PageHeader`, `DetailHeader`, `DetailSection` | `@/design-system` (`docs/design/views.md`) | Screen headers, single `primary` CTA placement, breadcrumb trail, and structured read cards on `#90`. |
| `AccountingScopeBar` | `accounting-ia.md` §6 | Displays active `Company` context (`X-Company-Id`), gates `COMPANY` calls (`account-roles`), and clarifies `TENANT` vs `COMPANY` blast radius on shared charts (`D-064`). |
| `StatStrip` / `MetricCard` | `@/design-system` | 4-metric header strip on `#89` fed by `POST /accounting/accounts/count` and `GET /accounting/account-roles`. |
| `Tabs` | `@/design-system` | 6-tab workspace switcher synced to URL `?tab=accounts\|groups\|roles\|mappings\|charts\|merges`. |
| `DataTable` + `BulkActionBar` | `@/design-system` (`docs/design/patterns.md`) | Server-paginated tables for Accounts, Groups, Roles, Mappings, Charts, and Merges; sticky multi-row selection bar on Accounts. |
| `FilterSearchInput` + `CrmAdvancedSearchCard` | `@/design-system` | Toolbar search (`FindManyDto.search`) and structured filter-tree builder (`POST /accounting/accounts/search` allowlist). |
| `AccountPicker` (`UX-07`) | `accounting-patterns-data.md` §3 | Searchable combobox backed by `POST /accounting/accounts/lookup` (`chartId`, `postableOnly`) for `parentId`, `intoAccountId` (merge), `account-roles` assignment, and `account-mappings`. |
| `IdentifierText` & `StatusBadge` | `accounting-status-and-a11y.md` §2–§4 | `<bdi dir="ltr">` `tabular-nums` wrapper for codes/paths/UUIDs/hashes/percentages; icon + `t.status.*` badges. |
| `FormDrawer` / `EditDrawer` | `@/design-system` | Side drawers for Create/Edit Account, Account Group, Account Mapping, Chart, and Read-Only Chart Template inspection. |
| `Modal` / `ReasonDialog` | `@/design-system` & `accounting-patterns-workflow.md` | `MergeAccountModal` (`MergeAccountsDto` with `10..1,000` char `reason` + compatibility pre-check) and Deprecate/Delete confirmations. |
| `TwoPhaseImportWizard` & `AsyncJobProgressBanner` (`UX-11`) | `accounting-patterns-workflow.md` §4–§5 | Handles `202 + Location` polling (`Retry-After`) for `POST /accounting/accounts/export` and (`P17.T06+`) `POST /accounting/accounts/import`. |
| `PermissionGate`, `AccountingBoundaryGate`, `ConflictDialog`, `AmbiguousOutcomePanel` | `@/design-system` & `accounting-patterns-documents.md` (`UX-17`..`UX-19`) | `403` access boundary, feature entitlement / `RECOVERY_MODE` fence, `409 STALE_VERSION` diff/reload modal, and write-timeout recovery panel. |

---

### 1.3 Complete Field-to-DTO & Enum Mapping (`SCR-02`)

#### 1.3.1 Query & Filter Fields (`02_DTOs.md` §1 & §4.1)

| Surface | UI Control (`AR` / `EN`) | DTO & Exact Member | Wire Type / Enum (`01_Enums.md`) | Validation / Behaviour |
| --- | --- | --- | --- | --- |
| Accounts Toolbar | الدليل النشط / Active Chart | `AccountListQueryDto.chartId` | `UUID` (required) | Defaults to `companyProfile.chart.id`, or first row of `GET /accounting/charts`. |
| Accounts Toolbar | بحث سريع / Quick Search | `AccountListQueryDto.search` (inherited `FindManyDto`) | `string` | Trimmed query string; debounced `300ms`. |
| Accounts Toolbar | نوع الحساب / Account Type | `AccountListQueryDto.accountType` | `AccountType` (`ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`, `OFF_BALANCE`, `STATISTICAL`) | Optional exact enum filter. |
| Accounts Toolbar | التصنيف / Classification | `AccountListQueryDto.classification` | `AccountClassification` (`CURRENT`, `NON_CURRENT`, `NOT_APPLICABLE`) | Optional exact enum filter. |
| Accounts Toolbar | قابلية الترحيل / Postable | `AccountListQueryDto.isPostable` | `boolean` (`strictBooleanTransform`) | `All` (`undefined`), `Postable` (`true`), `Header only` (`false`). |
| Accounts Toolbar | حساب رقابي / Control | `AccountListQueryDto.isControl` | `boolean` (`strictBooleanTransform`) | `All` (`undefined`), `Control` (`true`), `Non-control` (`false`). |
| Accounts Start Rail | المجموعة / Group | `AccountListQueryDto.groupId` | `UUID` | Selected node in Account Groups tree (`undefined` for root `"All"`). |
| Accounts Toolbar | الحساب الأب / Parent Account | `AccountListQueryDto.parentId` | `UUID` | Optional `AccountPicker` (`postableOnly: false`) filter. |
| Accounts Toolbar | الدور المحاسبي / Account Role | `AccountListQueryDto.role` | `AccountRole` (`116` members) | Optional filter showing accounts assigned to a specific role. |
| Accounts Toolbar | تضمين المتوقفة / Include Deprecated | `AccountListQueryDto.includeDeprecated` | `boolean` | Default `false`; `true` includes rows where `deprecatedAt !== null`. |
| Accounts / Groups / Charts | إظهار المحذوفة / Show Deleted | `FindManyDto.withDeleted` | `boolean` | Visible when `.restore` permission is held; enables `Restore` actions. |
| Accounts Advanced Search | شروط البحث المتقدم / Advanced Filter Tree | `AccountSearchDto.filterTree` (`SearchManyDto`) | Allowlisted columns: `code`, `name_i18n`, `account_type`, `classification`, `tags`, `path` | Calls `POST /accounting/accounts/search`; non-allowlisted columns are never offered. |
| Account Picker (`UX-07`) | بحث الحساب / Lookup Search | `AccountLookupQueryDto` | `{ chartId: UUID; search?: string (1..80); postableOnly?: boolean; limit?: number (1..100, default 50) }` | Calls `POST /accounting/accounts/lookup` -> `LookupItemDto[]` (`{ id, label, disabled? }`). |
| Account Export | صيغة التصدير / Export Format | `AccountExportQueryDto` (`extends ExportQueryDto` + `AccountListQueryDto` filters) | `format: ExportFormat` (`CSV` \| `XLSX`) | `page`, `limit`, `sort`, `cursor` omitted (`422` if sent, `02_DTOs.md` §13.2). |
| Account Groups Tab | فلتر الدليل والأب / Chart & Parent | `AccountGroupListQueryDto` | `{ chartId: UUID (required); parentId?: UUID }` + `FindManyDto` | Loads group hierarchy for selected `chartId`. |
| Charts Tab | فلاتر الأدلة / Chart Filters | `ChartListQueryDto` | `{ countryCode?: CountryCode; templateCode?: string; shared?: boolean }` + `FindManyDto` | Filters tenant chart registry. |

#### 1.3.2 Account Create / Edit Form & Detail Fields (`CreateAccountDto`, `UpdateAccountDto`, `AccountSummaryDto`, `AccountDetailDto`)

| Field (`AR` / `EN`) | Request DTO Member (`CreateAccountDto` / `UpdateAccountDto`) | Read DTO Member (`AccountSummaryDto` [S] / `AccountDetailDto` [D]) | Type / Enum & Bounds | Freeze / Conditional Rule |
| --- | --- | --- | --- | --- |
| الدليل المحاسبي / Chart | `chartId` (required on create) | `[D] chartId` | `UUID` | **Frozen** on edit once `hasPostedLines === true` (`409 ACCOUNTING.ACCOUNT.FROZEN`). |
| كود الحساب / Account Code | `code` (required) | `[S, D] code` | `string`, `^[0-9A-Z][0-9A-Z._-]{0,31}$`, unique per chart | Rendered in `<IdentifierText>`; **frozen** when `hasPostedLines === true`. |
| الاسم بالعربية / Name (Arabic) | `nameI18n.ar` (required) | `[S, D] nameI18n.ar` | `string`, `1..200` chars, trimmed | Always mutable under `accounting.account.update`. |
| الاسم بالإنجليزية / Name (English) | `nameI18n.en` (optional) | `[S, D] nameI18n.en` | `string`, `1..200` chars | Optional unless country pack requires `en`. |
| نوع الحساب / Account Type | `accountType` (required) | `[S, D] accountType` | `AccountType`: `ASSET` \| `LIABILITY` \| `EQUITY` \| `REVENUE` \| `EXPENSE` \| `OFF_BALANCE` \| `STATISTICAL` | **Frozen** when `hasPostedLines === true`; changing away from type required by live `AR_CONTROL`/`AP_CONTROL`/`SALARIES_PAYABLE` role refused (`422 ACCOUNTING.ACCOUNT.ROLE_TYPE_INCOMPATIBLE`, `D-731`). |
| الطبيعة المحاسبية / Normal Balance | `normalBalance` (required) | `[S, D] normalBalance` | `NormalBalance`: `DEBIT` \| `CREDIT` | Stored explicitly, never silently derived (`D-065`); UI pre-suggests default on create only; **frozen** when `hasPostedLines === true`. |
| تصنيف الميزانية / Classification | `classification` (required) | `[S, D] classification` | `AccountClassification`: `CURRENT` \| `NON_CURRENT` \| `NOT_APPLICABLE` | Drives EAS 1 / IFRS current vs non-current split (`D-104`). |
| الحساب الأب / Parent Account | `parentId` (optional) | `[S] parentId`, `[S] depth`, `[D] path` *(`AccountSummaryDto` carries `parentId` and `depth` so the tree builds from the list; `path` stays on the detail, `D-770`)* | `UUID \| null` (same chart; max depth `1..8`) | Picker excludes postable accounts (`isPostable = true` cannot have children, `VAL-LFO-11`) and descendants (no cycles, `VAL-LFO-12`). |
| مجموعة الحسابات / Account Group | `groupId` (optional) | `[D] groupId` | `UUID \| null` (same chart) | Optional group assignment (`acc_account_groups`). |
| قابل للترحيل / Postable Account | `isPostable` (required) | `[S, D] isPostable` | `boolean` | Cannot be set `true` if account has child accounts (`VAL-LFO-11`); cannot be set `false` once `hasPostedLines === true`. |
| حساب رقابي / Control Account | `isControl` (optional, default `false`) | `[S, D] isControl` | `boolean` | Checking `isControl = true` automatically sets & locks `allowManualJournal = false` (`D-028`); **frozen** when `hasPostedLines === true`. |
| السماح بالقيد اليدوي / Allow Manual Journal | `allowManualJournal` (optional, default `true`) | `[D] allowManualJournal` | `boolean` | Disabled and forced `false` when `isControl === true` (`422 ACCOUNTING.ACCOUNT.CONTROL_MANUAL_JOURNAL`). |
| قابل للتسوية / Allow Reconciliation | `allowReconciliation` (optional, default `false`) | `[D] allowReconciliation` | `boolean` | Enables open-item / account reconciliation workflows (`D-176`). |
| عملة الحساب المقيدة / Account Currency | `currencyCode` (optional) | `[D] currencyCode` | `CurrencyCode \| null` (`^[A-Z]{3}$`) | Empty = accepts any currency; set = rejects postings in other transaction currencies. |
| القابلية للخصم الضريبي / Tax Deductibility | `taxDeductibility` (optional) | `[D] taxDeductibility` | `TaxDeductibility`: `YES` \| `NO` \| `LIMITED` | Selecting `LIMITED` reveals required `deductiblePct`; changing away from `LIMITED` omits `deductiblePct` (server clears to `NULL`, `D-646`). |
| نسبة الخصم المسموحة (%) / Deductible % | `deductiblePct` (conditional) | `[D] deductiblePct` | `DecimalString`, scale `<= 2`, `0 < val < 100` | **Required iff `taxDeductibility === 'LIMITED'`**; **forbidden** (`forbidNonWhitelisted` / `ck_acc_accounts_deductible_pct`) otherwise. Never `Number()`. |
| معالجة فروق العملة / FX Treatment | `fxTreatment` (optional, default `NONE`) | `[D] fxTreatment` | `FxTreatment`: `MONETARY` \| `NON_MONETARY` \| `NONE` | Controls period-end FX revaluation inclusion (`D-010`). |
| فئة التدفقات النقدية / Cash-Flow Category | `cashFlowCategoryId` (optional) | `[D] cashFlowCategoryId` *(returned by `AccountDetailDto`, `D-770`)* | `UUID` | Optional cash-flow statement category (`D-104`). |
| حساب حساس / Sensitive Account | `sensitive` (optional, default `false`) | `[D] sensitive` *(returned by `AccountDetailDto`, `D-770`)* | `boolean` | When `true`, account is invisible to actors lacking `accounting.account.view_sensitive` (`D-546`). |
| الأبعاد التحليلية الإلزامية / Required Dimension Types | `requiresDimensionTypeCodes` (optional) | `[D] requiresDimensionTypeCodes` | `string[]`, max `4`, unique | Multi-select from `GET /accounting/dimension-types` (`code`) or manual code chips (`D-025`, `D-326`). |
| الوسوم / Tags | `tags` (optional) | `[D] tags` | `string[]`, max `20` items × max `32` chars | Free-form classification chips. |
| حالة الترحيل والأدوار والتوقف / Derived Metadata | *(Forbidden in request)* | `[S, D] id`, `[S, D] deprecatedAt`, `[S, D] version`, `[D] roles`, `[D] hasPostedLines`, `[D] createdAt`, `[D] updatedAt` | Read-only server fields | `version` / `ETag` drives `If-Match`; never sent in body. |

#### 1.3.3 Supporting `SCR-02` Resource DTOs (`Charts`, `ChartTemplates`, `AccountGroups`, `AccountRoles`, `AccountMappings`, `MergeAccountsDto`, `AccountMerges`)

| Resource / Modal | Field (`AR` / `EN`) | DTO & Exact Member (`02_DTOs.md` §4.4 & §13.1) | Type / Enum & Constraints |
| --- | --- | --- | --- |
| **Chart (`CreateChartDto` / `UpdateChartDto` / `ChartDetailDto` §13.1)** | كود الدليل / Chart Code | `code` | `string`, `^[A-Z0-9][A-Z0-9_-]{1,31}$`, unique per tenant |
| | الاسم (عربي / إنجليزي) / Name | `nameI18n` (`ar`, `en?`) | `I18nText` (`ar` required `1..200`) |
| | الدولة / Country | `countryCode` | `CountryCode` (ISO 3166-1 alpha-2, e.g. `EG`, `SA`, `AE`, `KW`) |
| | كود القالب المرجعي / Seed Template Code | `templateCode?` | `string`, max `32` chars (seeds accounts & roles from pack template on create; read-only `[D] templateVersion: number \| null`) |
| | مشاركة بين شركات المستأجر / Shared Across Companies | `shared?` | `boolean` (default `false`, `D-064`) |
| | سريان الدليل والنسخة / Effective Dates & Version | `[D] effectiveFrom`, `[D] effectiveTo`, `[D] version` | Read projections from `acc_charts` (§13.1); `version` feeds `If-Match`. |
| **Chart Template (`ChartTemplateSummaryDto` / `ChartTemplateDetailDto` §13.1 — Read-Only)** | الحزمة والإصدار والقالب / Pack, Version & Template | `[S, D] packCode`, `packVersion`, `templateCode`, `countryCode`, `nameI18n`, `contentHash` | `Sha256Hex` `contentHash` in `<IdentifierText>`; `[D]` adds `rows[]` (`code`, `nameI18n`, `accountType`, `normalBalance`, `classification`, `taxDeductibility`, `deductiblePct`, `fxTreatment`, `parentCode`, `groupPath`, `isControl`, `roles`, `tags`, `statementLines`). |
| **Account Group (`CreateAccountGroupDto` / `UpdateAccountGroupDto` / `AccountGroupDetailDto` §13.1)** | الدليل والأب / Chart & Parent Group | `chartId` (required), `parentId?` | `UUID`; `depth` `1..8` (`[D] path` `text` on Detail only; the group tree builds from `parentId` and `depth`, which the summary keeps; no `sortOrder` in stage 1, `CG-S2-03`). |
| | كود المجموعة وبادئة الترقيم / Code & Code Prefix | `code` (required), `codePrefix?` | `code`: `^[A-Z0-9][A-Z0-9._-]{0,31}$`; `codePrefix`: max `16` chars (`D-176`). |
| | الاسم (عربي / إنجليزي) / Name | `nameI18n` | `I18nText` (`ar` required). |
| **Account Role Assignment (`AssignAccountRoleDto`)** | الدور المحاسبي / Account Role | `accountRole` (also `:role` path param) | `AccountRole` (`116` slots: `108` operating + `8` reserved, `01_Enums.md` §6). |
| | الحساب المعيّن / Assigned Account | `accountId` | `UUID` (postable account of company's chart, compatible `AccountType`). |
| | نطاق التعيين / Assignment Scope | `companyId?` | `UUID` (`activeCompanyId` for company-level override; omitted for chart-level default), `effectiveFrom` (required) and `effectiveTo?` (`AssignAccountRoleDto`, `D-771`): the covering row is closed at `effectiveFrom`, and `effectiveTo` is how a company override ends and the slot returns to the chart default. The matrix reads `AccountRoleSlotDto` (`source`: `COMPANY` \| `CHART_DEFAULT` \| `UNRESOLVED`, `D-770`). |
| **Account Mapping (`CreateAccountMappingDto` / `UpdateAccountMappingDto` / `AccountMappingDetailDto` §13.1)** | الحساب ومنظومة الربط والكود المقابل / Account, Scheme & Target Code | `accountId`, `scheme`, `targetCode`, `effectiveFrom`, `effectiveTo?` | `scheme`: `AccountMappingScheme` (`UNIFORM_EG` \| `GROUP` \| `STATUTORY`); `targetCode`: max `32` chars; `effectiveTo >= effectiveFrom`; `countryCode?` is required for `UNIFORM_EG` and `STATUTORY` (`ck_acc_account_mappings_country_by_scheme`); list filters `accountId?`, `scheme?`, `countryCode?`, `effectiveOn?` (`AccountMappingListQueryDto`, `D-771`). |
| **Merge Accounts (`MergeAccountsDto`)** | من حساب -> إلى حساب / Source -> Target Account | `fromAccountId`, `intoAccountId` | Both `UUID`, postable, same chart, identical `accountType` & `normalBalance`, no redirect cycle (`VAL-LFO-13`..`15`). |
| | تاريخ السريان وسبب الدمج / Effective Date & Reason | `effectiveFrom`, `reason` | `effectiveFrom`: `ISODate` inside an `OPEN` period; `reason`: `string` `10..1,000` chars (`D-176`). |
| **Account Merge Log (`AccountMergeSummaryDto` §13.1 — Read-Only)** | سجل التحويل / Redirect Evidence Row | `[S] id`, `chartId`, `companyId`, `fromAccountId`, `intoAccountId`, `effectiveFrom`, `reason`, `approvalRequestId`, `createdAt`, `createdBy` | Append-only (`acc_account_merges`); no `version`, never edited or deleted. `reason` is in the summary because the resource has no `GET /:id` (`AccountMergeSummaryDto`, `D-770`); filter with `chartId?`, `fromAccountId?`, `intoAccountId?` (`AccountMergeListQueryDto`). |

---

### 1.4 Complete Verbatim Action & Endpoint Matrix (`SCR-02` — `[P: 39]` + `[S]`)

Every column below is copied verbatim from `02_Endpoint_Catalogue.md` §3 (lines 86, 146–184, 194). Browser calls prefix `/accounting/*` with `/api/tenant/accounting/v1/*`.

| UI Action | Method | Catalogue Path | Permission | Feature Key | Scope Target | Idempotency | Concurrency | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Charts (`6` `[P]`)** | | | | | | | | |
| List tenant charts | `GET` | `/accounting/charts` | `accounting.chart.read` | `accounting.ledger.core` | `TENANT` | none | none | `200` |
| Read chart detail | `GET` | `/accounting/charts/:id` | `accounting.chart.read` | `accounting.ledger.core` | `TENANT` | none | none | `200` + `ETag` |
| Create chart | `POST` | `/accounting/charts` | `accounting.chart.create` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | none | `201` + `Location` |
| Update chart | `PATCH` | `/accounting/charts/:id` | `accounting.chart.update` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | `If-Match` | `200` |
| Soft-delete unused chart | `DELETE` | `/accounting/charts/:id` | `accounting.chart.delete` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | `If-Match` | `204` |
| Restore soft-deleted chart | `POST` | `/accounting/charts/:id/restore` | `accounting.chart.restore` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | none | `200` |
| **Chart Templates (`2` `[P]`)** | | | | | | | | |
| List pack chart templates | `GET` | `/accounting/chart-templates` | `accounting.chart.read` | `accounting.ledger.core` | `TENANT` | none | none | `200` |
| Inspect template rows | `GET` | `/accounting/chart-templates/:id` | `accounting.chart.read` | `accounting.ledger.core` | `TENANT` | none | none | `200` |
| **Account Groups (`6` `[P]`)** | | | | | | | | |
| List account groups | `GET` | `/accounting/account-groups` | `accounting.chart.read` | `accounting.ledger.core` | `TENANT` | none | none | `200` |
| Read account group detail | `GET` | `/accounting/account-groups/:id` | `accounting.chart.read` | `accounting.ledger.core` | `TENANT` | none | none | `200` + `ETag` |
| Create account group | `POST` | `/accounting/account-groups` | `accounting.chart.create` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | none | `201` + `Location` |
| Update account group | `PATCH` | `/accounting/account-groups/:id` | `accounting.chart.update` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | `If-Match` | `200` |
| Soft-delete account group | `DELETE` | `/accounting/account-groups/:id` | `accounting.chart.delete` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | `If-Match` | `204` |
| Restore account group | `POST` | `/accounting/account-groups/:id/restore` | `accounting.chart.restore` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | none | `200` |
| **Accounts (`17` `[P]`)** | | | | | | | | |
| List accounts (`#89` grid) | `GET` | `/accounting/accounts` | `accounting.account.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | none | none | `200` |
| Advanced filter-tree search | `POST` | `/accounting/accounts/search` | `accounting.account.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | none | none | `200` |
| KPI strip counts | `POST` | `/accounting/accounts/count` | `accounting.account.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | none | none | `200` (`CountResultDto`) |
| Combobox lookup (`UX-07`) | `POST` | `/accounting/accounts/lookup` | `accounting.account.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | none | none | `200` (`LookupItemDto[]`) |
| Read account detail (`#90`) | `GET` | `/accounting/accounts/:id` | `accounting.account.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | none | none | `200` + `ETag` |
| Create single account | `POST` | `/accounting/accounts` | `accounting.account.create` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | none | `201` + `Location` |
| Bulk create accounts | `POST` | `/accounting/accounts/bulk` | `accounting.account.create` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | none | `200/207` |
| Update account | `PATCH` | `/accounting/accounts/:id` | `accounting.account.update` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | `If-Match` | `200` |
| Bulk update accounts | `PATCH` | `/accounting/accounts/bulk-update` | `accounting.account.update` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | none | `200/207` |
| Soft-delete unreferenced account | `DELETE` | `/accounting/accounts/:id` | `accounting.account.delete` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | `If-Match` | `204` (only while unreferenced) |
| Bulk soft-delete accounts | `POST` | `/accounting/accounts/bulk-delete` | `accounting.account.delete` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | none | `200/207` |
| Restore soft-deleted account | `POST` | `/accounting/accounts/:id/restore` | `accounting.account.restore` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | none | `200` |
| Bulk restore accounts | `POST` | `/accounting/accounts/bulk-restore` | `accounting.account.restore` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | none | `200/207` |
| Import accounts (`P17.T06+`, `D-691`) | `POST` | `/accounting/accounts/import` | `accounting.account.create` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key (7 d)` | none | `202` + `Location` |
| Export accounts (`CSV`/`XLSX`) | `POST` | `/accounting/accounts/export` | `accounting.account.read` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | none | `202` + `Location` |
| Deprecate account | `POST` | `/accounting/accounts/:id/deprecate` | `accounting.account.deprecate` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | `If-Match` | `200` (body `DeprecateAccountDto { effectiveFrom }`, stored as `deprecated_at`, `D-176`, `D-771`) |
| Merge account into target | `POST` | `/accounting/accounts/:id/merge` | `accounting.account.merge` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | `If-Match` | `200` (appends `acc_account_merges`) |
| **Account Merges (`1` `[P]`)** | | | | | | | | |
| List merge redirect log | `GET` | `/accounting/account-merges` | `accounting.account.read` | `accounting.ledger.core` | `TENANT` | none | none | `200` |
| **Account Roles (`3` `[P]`)** | | | | | | | | |
| List 116 role slots & resolved accounts | `GET` | `/accounting/account-roles` | `accounting.account.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` (116 slots with resolved account) |
| Assign single role slot | `PATCH` | `/accounting/account-roles/:role` | `accounting.account.assign_role` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| Bulk assign role slots | `PATCH` | `/accounting/account-roles/bulk-update` | `accounting.account.assign_role` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `200/207` |
| **Account Mappings (`4` `[P]`)** | | | | | | | | |
| List external mappings | `GET` | `/accounting/account-mappings` | `accounting.account.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |
| Create external mapping | `POST` | `/accounting/account-mappings` | `accounting.account.map` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `201` |
| Update external mapping | `PATCH` | `/accounting/account-mappings/:id` | `accounting.account.map` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| Delete external mapping | `DELETE` | `/accounting/account-mappings/:id` | `accounting.account.map` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `204` |
| **Shared Context Reads (`[S]`)** | | | | | | | | |
| Read active company's default chart | `GET` | `/accounting/company-profile` | `accounting.profile.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` + `ETag` (skipped gracefully if `accounting.profile.read` not held) |
| Read dimension type codes for form | `GET` | `/accounting/dimension-types` | `accounting.dimension.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` (skipped gracefully if `accounting.dimension.read` not held) |

---

### 1.5 States, Boundaries & 3-Part Domain Error Copy (`SCR-02`)

1. **Loading State (`TableSkeleton` / `DetailSkeleton`):**
   - `#89` renders 4-card `StatStrip` shimmer + start-rail tree skeleton (`6` rows) + `10`-row `DataTable` skeleton preserving `44px` row height (zero CLS). `#90` renders `DetailHeader` skeleton + 4 `DetailSection` skeletons.
2. **Empty States (`EmptyState` — per tab & filter state):**
   - **No chart exists yet (`charts = []`):**
     - AR: `لا يوجد دليل حسابات مهيأ بعد. أنشئ دليلاً من قالب الحزمة المعتمدة أو فعّل محاسبة الشركة أولاً.`
     - EN: `No chart of accounts exists yet. Create a chart from an adopted pack template or activate company accounting first.`
     - Action: `Link` to `#88` (`/accounting/setup/company`) or `+ New chart` drawer (if `accounting.chart.create` held).
   - **Zero accounts matching filter (`total === 0` with active filters):** Shows `"Clear all filters"` (`مسح الفلاتر`).
   - **Empty External Mappings / Empty Merge Log:** Calm factual explanation (`لم يتم تسجيل أي عمليات دمج حسابات حتى الآن` / `No account merges have been recorded yet`).
3. **`403` Permission State (`PermissionGate` — `403` is NEVER rendered as an empty table):**
   - If the actor lacks both `accounting.account.read` and `accounting.chart.read`, the route renders `PermissionGate` naming the missing permission key in `<IdentifierText>`.
   - If the actor holds `accounting.chart.read` without `accounting.account.read`, Tabs 2 (`Groups`) & 5 (`Charts & Templates`) render live while Tabs 1, 3, 4, 6 render inline `PermissionGate` (`accounting.account.read`).
   - Write buttons (`+ New account`, `Edit`, `Deprecate`, `Merge`, `Assign role`, `Delete`) are hidden when the corresponding verb permission is absent from `/auth/me`.
4. **Sensitive Account Server Filtering (`accounting.account.view_sensitive`, `D-546`):**
   - Rows with `sensitive = true` are omitted server-side for actors without `accounting.account.view_sensitive`; direct navigation to `#90` for a masked account returns `404` and renders standard `NotFoundState` without leaking existence. In `AccountFormDrawer`, the `sensitive` toggle is disabled with a factual hint unless the actor also holds `accounting.account.view_sensitive` (so an operator never creates an account they immediately lose sight of).
5. **Entitlement, Unactivated Company & `RECOVERY_MODE` States (`UX-18` `AccountingBoundaryGate`):**
   - `accounting` not in `enabledModules` or `accounting.ledger.core` unentitled -> route absent from sidebar; direct URL renders `AccountingBoundaryGate` (zero upgrade prompts; links tenant owners to `#118` `/accounting/setup/plan`).
   - `company-profile` `404 ACCOUNTING.PROFILE.NOT_ACTIVATED` -> `TENANT`-scoped tabs (`Charts`, `Templates`, `Groups`, `Accounts`) still function if a chart exists, while `COMPANY`-scoped Tab 3 (`Account Roles`) renders a calm setup banner linking to `#88` (`/accounting/setup/company`) to activate the company first.
   - Active restore incident (`RECOVERY_MODE` from `GET /api/tenant/core/v1/restore-incidents/current`) or `TenantStatus.ARCHIVED` -> persistent top `AlertBanner` locks all write actions (`POST`/`PATCH`/`DELETE`) into read-only mode.
6. **`409` Optimistic Concurrency (`ConflictDialog` `UX-19`) & Ambiguous Write (`AmbiguousOutcomePanel` `UX-19`):**
   - `409 ACCOUNTING.CONCURRENCY.STALE_VERSION` opens `ConflictDialog` (`Refresh latest version` vs `Cancel`), replacing the stored `ETag` before any re-edit.
   - Network timeout / `502`/`504` on an idempotent write (`POST`/`PATCH`/`DELETE`) opens `AmbiguousOutcomePanel`, retaining the exact `UUIDv7` `x-idempotency-key` in hook state so `"Retry safely with same key"` never double-creates or double-merges.
7. **`207 Multi-Status` Partial Bulk Outcome (`BulkOperationResultDto<T>`):**
   - On `POST /accounts/bulk`, `PATCH /accounts/bulk-update`, `POST /accounts/bulk-delete`, `POST /accounts/bulk-restore`, or `PATCH /account-roles/bulk-update`, a `207` response opens a structured summary modal (`succeeded` vs `failed`) listing each failed item's `<IdentifierText>{id}</IdentifierText>`, `errorCode`, and localized message, keeping failed rows selected for immediate correction.
8. **Domain Error Copy Table (`useAccountingErrorModel` — Cause + Effect + Safe Action + `<IdentifierText>{correlationId}</IdentifierText>`):**

| `errorCode` (`04_Errors_and_Constants.md`) | HTTP | Arabic (`AR` — السبب · الأثر · الإجراء الآمن) | English (`EN` — Cause · Effect · Safe Action) |
| --- | --- | --- | --- |
| `ACCOUNTING.ACCOUNT.FROZEN` | `409` | **السبب:** يحتوي الحساب على سطور قيود مرحّلة بالفعل. **الأثر:** لم يتم تعديل الكود أو النوع أو الطبيعة أو خاصية الحساب الرقابي. **الإجراء:** حدّث البيانات الوصفية فقط (الاسم أو المجموعة أو الضريبة) أو أنشئ حساباً جديداً وادمجه اعتباراً من فترة مفتوحة. | **Cause:** This account already has posted journal lines. **Effect:** Code, account type, normal balance, and control flag were not changed. **Safe action:** Edit descriptive attributes only, or create a new account and merge from an open period. |
| `ACCOUNTING.ACCOUNT.IN_USE` | `409` | **السبب:** الحساب مرتبط بعمليات أو أدوار ترحيل أو حسابات فرعية نشطة. **الأثر:** تعذّر حذف الحساب. **الإجراء:** استخدم «إيقاف الاستخدام» لمنع الترحيل الجديد مع الحفاظ على سلامة السجل التاريخي. | **Cause:** The account is referenced by postings, role assignments, or child accounts. **Effect:** The account was not deleted. **Safe action:** Use **Deprecate** instead to block new postings while preserving history. |
| `ACCOUNTING.ACCOUNT.CONTROL_MANUAL_JOURNAL` | `422` | **السبب:** الحسابات الرقابية لا تقبل القيود اليدوية المباشرة (`D-028`). **الأثر:** لم يُحفظ الحساب. **الإجراء:** عطّل خيار «السماح بالقيد اليدوي» أو ألغِ تحديد «حساب رقابي». | **Cause:** Control accounts cannot allow manual journal entries (`D-028`). **Effect:** Changes were not saved. **Safe action:** Disable **Allow manual journal** or uncheck **Control account**. |
| `ACCOUNTING.ACCOUNT.HIERARCHY_INVALID` / `HIERARCHY_CYCLE` | `422` | **السبب:** الحساب الأب المختار قابل للترحيل أو يتجاوز العمق الأقصى (8 مستويات) أو ينشئ حلقة دائرية. **الأثر:** لم يُحفظ التسلسل الهرمي. **الإجراء:** اختر حساباً تجميعياً (غير قابل للترحيل) أعلى في نفس الدليل. | **Cause:** The selected parent account is postable, exceeds max depth (`8`), or creates a cycle. **Effect:** Hierarchy changes were not saved. **Safe action:** Select a non-postable header account higher in the same chart. |
| `ACCOUNTING.ACCOUNT.MERGE_INCOMPATIBLE` / `MERGE_CYCLE` | `422` | **السبب:** يختلف الحساب الهدف في النوع أو الطبيعة المحاسبية، أو أن أحد الحسابين غير قابل للترحيل، أو ينشئ الدمج حلقة تحويل دائرية. **الأثر:** لم يتم تنفيذ الدمج. **الإجراء:** اختر حساباً هدفاً قابلاً للترحيل يطابق نوع الحساب المصدر وطبيعته تماماً. | **Cause:** Source and target accounts differ in type or normal balance, are non-postable, or form a redirect cycle. **Effect:** No merge was recorded. **Safe action:** Choose a postable target account in the same chart with identical type and normal balance. |
| `ACCOUNTING.ACCOUNT.ROLE_TYPE_INCOMPATIBLE` | `422` | **السبب:** نوع الحساب لا يتوافق مع متطلبات الدور المحاسبي المختار (`D-731`). **الأثر:** لم يتم حفظ تعيين الدور. **الإجراء:** اختر حساباً قابلاً للترحيل يطابق الفئة المحاسبية للدور (مثل أصل أو التزام). | **Cause:** The selected account's type is incompatible with this `AccountRole` (`D-731`). **Effect:** Role assignment was not saved. **Safe action:** Choose a postable account matching the role's required account type. |
| `ACCOUNTING.ACCOUNT.ROLE_ASSIGNMENT_OVERLAP` | `422` | **السبب:** يتقاطع نطاق سريان تعيين الدور مع تعيين نشط آخر لنفس الدور والشركة. **الأثر:** لم يُحفظ التعيين. **الإجراء:** حدّث الصفحة لمراجعة التعيين الحالي وعدّل التعيين القائم بدلاً من تكراره. | **Cause:** Role assignment effective dates overlap an existing assignment for the same role and scope. **Effect:** Assignment was not saved. **Safe action:** Refresh to inspect the current slot assignment and update it in place. |
| `ACCOUNTING.CHART.IN_USE` | `409` | **السبب:** الدليل مرتبط حالياً بملف شركة مفعّلة واحدة على الأقل. **الأثر:** لم يتم حذف الدليل. **الإجراء:** لا يمكن حذف دليل مستخدم؛ يمكنك إيقاف الحسابات غير المطلوبة داخله. | **Cause:** At least one company profile currently points to this chart. **Effect:** The chart was not deleted. **Safe action:** Charts in active company use cannot be deleted; deprecate individual unused accounts instead. |
| `ACCOUNTING.CHART.SHARED_MUTATION_FORBIDDEN` | `403` | **السبب:** هذا الدليل مشترك بين عدة شركات (`shared = true`) ويتطلب صلاحية على مستوى المستأجر لتعديله (`D-064`). **الأثر:** رُفض التعديل لحماية بقية الشركات. **الإجراء:** تواصل مع مسؤول المحاسبة على مستوى المستأجر لإجراء التعديل. | **Cause:** This chart is shared across multiple companies (`shared = true`) and requires tenant-wide authority to mutate (`D-064`). **Effect:** The change was refused to protect sibling companies. **Safe action:** Request a tenant-scoped accounting administrator to apply the change. |

---

### 1.6 ASCII Mockups — `SCR-02` (All 4 Combinations + `375px` Mobile)

#### Combination 1: Arabic RTL × Light (`dir="rtl"`, `data-theme="light"`) — `#89` Workspace (`Accounts` Tab)

```text
+------------------------------------------------------------------------------------------------------+
| [Light · bg-surface-canvas #F8FAFC · ink #0F172A]                                                    |
| الشريط النطاقي: الشركة: شركة النيل للتجارة (EGP) [▾] | الدليل: [EAS-STD-2026 · دليل مشترك ⚠] [▾]      |
+------------------------------------------------------------------------------------------------------+
| [+ حساب جديد (Primary)] [تصدير ▾] [استيراد (قريباً)]        دليل الحسابات والأدوار                     |
|                                                             إدارة الحسابات والمجموعات وأدوار الـ 116   |
+------------------------------------------------------------------------------------------------------+
| [✓ تغطية الأدوار: 106/108 !] | [رقابية: 12] | [قابلة للترحيل: 184] | [إجمالي الحسابات النشطة: 218]     |
+------------------------------------------------------------------------------------------------------+
| [سجل الدمج] [الأدلة والقوالب] [الربط الخارجي] [أدوار الحسابات (2!)] [المجموعات] [*الحسابات*]          |
+-------------------------------------------------------------------------+----------------------------+
| شريط الفلاتر: [بحث متقدم] [النوع: الكل ▾] [قابل للترحيل ▾] [🔍 بحث...] | مجموعات الحسابات (عمق 1..8) |
+-------------------------------------------------------------------------+----------------------------+
| إجراءات٠ | الحالة      | رقابي | للترحيل | الطبيعة | النوع | الاسم       | الكود   | [x] الكل (218)  |
|----------+-------------+-------+---------+--------+-------+-------------+---------+ • 10 الأصول (1*) |
| [⋯]      | [● نشط]     | —     | — (أب)  | مدين   | أصل   | النقدية     | 1100    |   • 11 النقدية*  |
| [⋯]      | [● نشط]     | [🔒]  | [✓ نعم] | مدين   | أصل   | العملاء     | 1102.01 |   • 12 المخزون   |
| [⋯]      | [◐ متوقف]   | —     | [✓ نعم] | مدين   | أصل   | عهد قديمة   | 1109.99 | • 20 الالتزامات  |
| [⋯]      | [● نشط]     | [🔒]  | [✓ نعم] | دائن   | التزام| الموردون    | 2101.01 | • 30 الملكية     |
| [⋯]      | [● نشط]     | —     | [✓ نعم] | دائن   | إيراد | مبيعات محلية| 4101.01 | • 40 الإيرادات   |
+-------------------------------------------------------------------------+----------------------------+
| [< السابق] صفحة 1 من 5 [التالي >]                          عرض 1–50 من 218 حساب (الأرقام: 0-9 LTR)   |
+------------------------------------------------------------------------------------------------------+
```

#### Combination 2: Arabic RTL × Dark (`dir="rtl"`, `data-theme="dark"`) — `#89` (`Account Roles — 116 Slots` Tab)

```text
+------------------------------------------------------------------------------------------------------+
| [Dark · bg-surface-canvas #0B1120 · ink #F1F5F9 · border #1E293B]                                    |
| الشريط النطاقي: الشركة: شركة النيل للتجارة (EGP) [▾] | الدليل: [EAS-STD-2026 · دليل مشترك ⚠]          |
+------------------------------------------------------------------------------------------------------+
| [حفظ التعديلات المجمعة (2) (Primary)]                       دليل الحسابات والأدوار                     |
|                                                             تعيين أدوار الترحيل على مستوى الشركة     |
+------------------------------------------------------------------------------------------------------+
| [✕ أدوار تشغيلية غير معينة: 2 / 108 — تمنع تفعيل أول مستند (ACT-14)]                                 |
+------------------------------------------------------------------------------------------------------+
| [سجل الدمج] [الأدلة والقوالب] [الربط الخارجي] [*أدوار الحسابات (116)*] [المجموعات] [الحسابات]         |
+------------------------------------------------------------------------------------------------------+
| الفلتر: [غير معيّن تشغيلي ▾] [النطاق: تخصيص الشركة ▾]                        [🔍 ابحث باسم الدور...] |
+------------------------------------------------------------------------------------------------------+
| ▾ 1. الأصول — Assets (35 دوراً · 34 مكتمل · 1 غير معيّن)                                              |
| إجراء  | مصدر الحل          | الحساب المعيّن (POST /accounts/lookup) | الكود البرمجي (LTR)  | الدور   |
|--------+--------------------+----------------------------------------+----------------------+---------|
| [حفظ]  | [★ تخصيص الشركة]   | [1101.01 — الصندوق الرئيسي EGP     ▾] | CASH_ON_HAND         | الصندوق |
| [حفظ]  | [○ افتراضي الدليل] | [1102.01 — حساب رقابة العملاء       ▾] | AR_CONTROL           | العملاء |
| [حفظ*] | [! غير معيّن]      | [اختر حساباً قابلاً للترحيل (أصل)... ▾] | ASSET_DISPOSAL_CLEARING| تسوية استبعاد|
| ▸ 2. الالتزامات (30) · ▸ 3. الملكية (7) · ▸ 4. الإيرادات (8) · ▸ 5. المصروفات (17) · ▸ 6. التسويات (11)|
| ▸ 7. أدوار محجوزة لموجات قادمة — Reserved Wave Slots (8 · اختيارية في MVP: POS_CLEARING, ...)         |
+------------------------------------------------------------------------------------------------------+
```

#### Combination 3: English LTR × Light (`dir="ltr"`, `data-theme="light"`) — `#90` Account Detail + `MergeAccountModal`

```text
+------------------------------------------------------------------------------------------------------+
| [Light · bg-surface-canvas #F8FAFC · ink #0F172A]                                                    |
| Setup  /  Chart of Accounts  /  1102.01                                        Company: Nile Trade   |
+------------------------------------------------------------------------------------------------------+
| 1102.01 · Trade Receivables Control                  [Edit account (Primary)] [Deprecate] [Merge ▾]  |
| [ASSET] [DEBIT] [✓ Postable] [🔒 Control account] [ETag: "4"]                                        |
+------------------------------------------------------------------------------------------------------+
| [⚠ Structural fields locked: Posted journal lines exist (hasPostedLines = true). Code, Account Type, |
|    Normal Balance, Chart, and Control flag cannot be modified (VAL-LFO-09).]                         |
+--------------------------------------------------+---------------------------------------------------+
| Identity & Hierarchy                             | Posting, Tax & FX Governance                      |
| Code:            1102.01                         | Allow Manual Journal:  No (Forced by Control)     |
| Name (AR):       حساب رقابة العملاء              | Allow Reconciliation:  Yes                        |
| Name (EN):       Trade Receivables Control       | Account Currency:      Any transaction currency   |
| Materialized:    1000/1100/1102/1102.01          | Tax Deductibility:     NOT_APPLICABLE / YES       |
| Classification:  CURRENT                         | FX Treatment:          MONETARY                   |
| Assigned Roles:  [AR_CONTROL]                    | Required Dimensions:   [COST_CENTER]              |
+--------------------------------------------------+---------------------------------------------------+
|   +--- Modal: Merge Account Redirect (POST /accounting/accounts/:id/merge · If-Match: "4") ------+   |
|   | Source Account (fromAccountId):  1102.09 — Legacy Domestic Receivables (ASSET · DEBIT)       |   |
|   | Target Account (intoAccountId)*: [1102.01 — Trade Receivables Control (ASSET · DEBIT)     ▾] |   |
|   | Effective From (Open Period)*:   [2026-11-01]                                                |   |
|   | Audit Reason (10..1,000 chars)*: [Consolidating duplicate legacy AR sub-account after audit] |   |
|   | ℹ Historical posted lines remain untouched; reports redirect from 2026-11-01 onward (D-176). |   |
|   |                                                         [Cancel]  [Confirm Merge (Secondary)]|   |
|   +----------------------------------------------------------------------------------------------+   |
+------------------------------------------------------------------------------------------------------+
```

#### Combination 4: English LTR × Dark (`dir="ltr"`, `data-theme="dark"`) — `#89` + `AccountFormDrawer` (`LIMITED` Tax Deductibility)

```text
+------------------------------------------------------------------------------------------------------+
| [Dark · bg-surface-canvas #0B1120 · ink #F1F5F9 · Drawer surface #111827]                            |
| Chart of Accounts & Roles                            |+-- Drawer: New Account (POST /accounts) -----+|
| [218 Active] [184 Postable] [12 Control] [108/108 ✓] || Chart*:            [EAS-STD-2026         ▾] ||
|------------------------------------------------------|| Account Code*:     [5204.02               ] ||
| [*Accounts*] [Groups] [Roles] [Mappings] [Templates] || Name (Arabic)*:    [مصروفات ضيافة واستقبال] ||
|------------------------------------------------------|| Name (English):    [Hospitality Expense   ] ||
| [ ] Code     Name                Type     Postable   || Account Type*:     [EXPENSE              ▾] ||
| [ ] 5201.01  Salaries & Wages    EXPENSE  [✓ Yes]    || Normal Balance*:   (•) DEBIT   ( ) CREDIT   ||
| [ ] 5204.01  Travel & Lodging    EXPENSE  [✓ Yes]    || Classification*:   [NOT_APPLICABLE       ▾] ||
| [ ] 5204.02  Hospitality Expense EXPENSE  [✓ Yes]    || [✓] Postable       [ ] Control Account      ||
|                                                      || [✓] Allow Manual   [ ] Allow Reconciliation ||
|                                                      || Tax Deductibility: [LIMITED              ▾] ||
|                                                      || Deductible %*:     [50.00] % (0 < pct < 100)||
|                                                      || FX Treatment:      [NONE                 ▾] ||
|                                                      || Dimensions (<=4):  [COST_CENTER ×] [+ Add]  ||
|                                                      || [ ] Sensitive (requires view_sensitive)     ||
|                                                      ||              [Cancel] [Create Account (Save)]||
+------------------------------------------------------+----------------------------------------------+
```

#### Responsive `< 768px` (`375px` Mobile Viewport) Behaviour (`SCR-02`)

- Start-rail Account Group tree collapses into a single full-width `"Group: All (▾)"` filter sheet trigger (`min-h-11` `44px` touch target).
- `StatStrip` reflows to a `2 × 2` compact grid; `Tabs` becomes a horizontally scrollable logical pill bar (`overflow-x-auto`).
- `DataTable` switches to `MobileCardList` cards showing `<IdentifierText>{code}</IdentifierText>` + `nameI18n`, `AccountType` + `NormalBalance`, and `isPostable`/`isControl` badges, with `44px × 44px` overflow action triggers; `FormDrawer` renders as a full-height bottom/side sheet.

---

## 2. Screen `SCR-03` — Fiscal Calendars, Years, Periods, Journals & Number Sequences

- **Route:** `#91` `/accounting/setup/calendars-journals` (`accountingSetupCalendarsJournals`)
  *(Shared Fiscal Year, Period State Matrix, Reopen Log, and User Period Override components also power `SCR-11` `#65` `/accounting/close/periods` and `#66` `/accounting/close/periods/[id]`; see §0.2 reconciliation)*
- **Navigation Section:** `Setup` (`الإعدادات والتهيئة`) -> `Calendars & Journals` (`التقويمات واليوميات`)
- **Use Case & Journey Steps:** `UC-LFO-3` · `JRN-ACT` steps `ACT-07`, `ACT-08` (`SCN-011`..`SCN-014`)
- **Feature Entitlement Gate:** `accounting.ledger.core` (Basic — required for entire route)
- **Route Admission Permission:** Any of `accounting.calendar.read` OR `accounting.period.read` OR `accounting.journal.read` (each tab gates its own read query via inline `PermissionGate` if the actor holds only a subset of those `.read` keys)

### 2.1 Layout & Progressive-Disclosure Hierarchy (`#91`)

1. **Band 1 — `AccountingScopeBar` (`COMPANY` Scope):**
   - Resolves active `Company` (`X-Company-Id` required on every `SCR-03` route).
   - Displays active company calendar chip (`companyProfile.fiscalCalendar.code` + `calendarType` when `accounting.profile.read` is held) and `maxBackdateDays` indicator (`حد الترحيل بأثر رجعي: N يوم` / `Backdate window: N days`, linking to `#88` `/accounting/setup/company`).
2. **Band 2 — `PageHeader` (Single `variant="primary"` CTA Law):**
   - **Title:** `التقويمات والفترات واليوميات` / `Calendars, Periods & Journals`
   - **Subtitle:** `إعداد التقويم المالي والسنوات وحالات الفترات ودفاتر اليومية وتسلسلات الترقيم` / `Configure fiscal calendars, years, module period states, journals, and gapless sequences`
   - **Primary CTA (at most 1 `variant="primary"` on screen, switched by active tab & permission):**
     - Tab 1 (`calendars`, `accounting.calendar.create`): `+ تقويم مالي جديد` / `+ New calendar` -> opens `CalendarFormDrawer`.
     - Tab 2 (`years`, `accounting.calendar.create`): `+ سنة مالية جديدة` / `+ New fiscal year` -> opens `CreateFiscalYearDrawer`.
     - Tab 3 (`periods`, `accounting.period.override` when Overrides sub-view active): `+ منح استثناء لمستخدم` / `+ Grant user override` -> opens `GrantOverrideDrawer` (no page-level primary CTA on Matrix/Reopen-Log sub-views because transitions are contextual per period/module).
     - Tab 4 (`journals`, `accounting.journal.create`): `+ دفتر يومية جديد` / `+ New journal` -> opens `JournalFormDrawer`.
     - Tab 5 (`sequences`): **No CTA** (strictly read-only under `D-014` / `D-015` / `D-329`).
3. **Band 3 — 5-Tab Workspace (`Tabs` synced to `?tab=calendars|years|periods|journals|sequences`):**
   - **Tab 1 — `Fiscal Calendars` (`التقويمات المالية` · `[P]`):**
     - `DataTable` over `GET /accounting/fiscal-calendars` (`FiscalCalendarListQueryDto`: `calendarType?`, `periodPattern?`, `withDeleted?`).
     - Columns: `<IdentifierText>{code}</IdentifierText>`, localized `nameI18n`, `calendarType`, `periodPattern`, Year Start (`yearStartMonth / yearStartDay`), Active Company Default badge, and row actions (`Edit`, `Delete` when unused, `Restore`).
     - `CalendarFormDrawer` (`CreateFiscalCalendarDto` / `UpdateFiscalCalendarDto`):
       - **MVP Disabled-Option Disclosure (`accounting-ia.md` §3 & `D-705`):** `calendarType` offers `GREGORIAN` active, while `HIJRI` and `RETAIL_4_4_5` render disabled with a factual one-line note (`يتوفر التقويم الهجري وتقويم التجزئة في موجة لاحقة` / `Hijri and 4-4-5 generators ship in a later wave`). Similarly, `periodPattern` offers `MONTHLY` and `QUARTERLY` active, while `FOUR_FOUR_FIVE`, `FOUR_FIVE_FOUR`, and `FIVE_FOUR_FOUR` render disabled with the same factual note.
       - **In-Use Freeze:** Once any fiscal year exists for the calendar, `calendarType` and `yearStartMonth` render `readOnly` in `UpdateFiscalCalendarDto` (`409 ACCOUNTING.CALENDAR.IN_USE`).
   - **Tab 2 — `Fiscal Years` (`السنوات المالية` · `[S]` Onboarding Setup on `#91`, `[P]` Close Operations on `SCR-11` `#65`):**
     - Toolbar: Calendar selector (`calendarId`), `status` filter (`FUTURE` | `OPEN` | `CLOSING` | `CLOSED`), `fromDate` / `toDate`.
     - `DataTable` over `GET /accounting/fiscal-years` showing `<IdentifierText>{code}</IdentifierText>`, `startDate` -> `endDate`, `status` (`StatusBadge` with shape/icon cue), `partitionCreated` indicator, `incomeTaxFiledAt` badge, and row actions:
       - **`فتح السنة المالية` / `Open fiscal year`** (`POST /accounting/fiscal-years/:id/open`, `accounting.calendar.open_year`, `If-Match`, visible when `status === 'FUTURE'`): Opens confirmation modal explaining `D-030` + `D-336` + `D-217` (creates the yearly `acc_journal_lines` partition and transitions period `0` `OPENING`, every `NORMAL`, `ADJUSTMENT`, and `CLOSING` period across all 4 active modules `GL`, `AR`, `AP`, `TAX` from `FUTURE` -> `OPEN` in one transaction; refused with `409 ACCOUNTING.CALENDAR.PRIOR_YEAR_NOT_CLOSED` if two years of the calendar are already `OPEN` or `CLOSING`).
       - **Outbound Link to Period Close & Year-End (`SCR-11` `#65`):** Rows in `OPEN`, `CLOSING`, or `CLOSED` display `إدارة إقفال العام ->` / `Manage year-end close ->` (`Link` to `/accounting/close/periods?fiscalYearId=...`) for `POST /:id/close`, `POST /:id/rerun-requests`, `POST /:id/record-income-tax-filing`, and `year-end-closings` receipts. *(Note: `02_Endpoint_Catalogue.md` §3 exposes no `DELETE /accounting/fiscal-years/:id` route — see `CG-S2-09`.)*
   - **Tab 3 — `Periods, Overrides & Reopen Log` (`الفترات والاستثناءات وسجل الفتح` · `[S]` on `#91`, `[P]` on `SCR-11` `#65`/`#66`):**
     - Segmented sub-switcher (`SegmentedControl`): **`1. مصفوفة حالات الوحدات (Module State Matrix)`** · **`2. استثناءات المستخدمين المؤقتة (User Overrides)`** · **`3. سجل إعادة الفتح (Reopen Audit Log)`**.
     - **Sub-view 3A — Period Module State Matrix (`GET /accounting/periods` / `POST /accounting/periods/search`):**
       - Filter bar: `FiscalYear` selector (`fiscalYearId` — defaults to current `OPEN` year), `periodKind` (`NORMAL` | `OPENING` | `ADJUSTMENT` | `CLOSING`), `module` (`GL` | `AR` | `AP` | `TAX`), `state` (`FUTURE` | `OPEN` | `SOFT_CLOSED` | `CLOSED` | `PERMANENTLY_CLOSED`), `onDate` (`ISODate`).
       - **Matrix Grid:** One row per `FiscalPeriodSummaryDto` (`periodNo 0` `OPENING`, `1..12` [or `1..4`] `NORMAL`, `13` [or `5`] `ADJUSTMENT`, `14` [or `6`] `CLOSING`), displaying `periodNo`, `periodKind` badge, `<IdentifierText>{startDate} -> {endDate}</IdentifierText>`, and **4 interactive module cells (`GL`, `AR`, `AP`, `TAX`)**:
         - `FUTURE` (`○ مستقبلي`, `ink`): Read-only cell; tooltip explains only `POST /accounting/fiscal-years/:id/open` transitions `FUTURE -> OPEN` (`D-336`).
         - `OPEN` (`● مفتوح`, `positive`): Clicking cell (when `accounting.period.change_state` held) offers **`إغلاق مبدئي (Soft-Close)`** (`POST /accounting/periods/:id/state` with `{ periodId, module, toState: 'SOFT_CLOSED' }`, `If-Match`).
         - `SOFT_CLOSED` (`◐ مغلق مبدئياً`, `caution` — blocks operators unless they hold a live `user-period-override`): Clicking cell offers **`إعادة فتح (Reopen to OPEN)`** via `ReasonDialog` (`10..1,000` chars mandatory `reason`, `POST /accounting/periods/:id/state` with `{ periodId, module, toState: 'OPEN', reason }`, `If-Match`; mirrored in `acc_period_reopen_log`, `D-022`). For locking to `CLOSED`, cell displays outbound `Link` to Close Checklists (`#63` `/accounting/close/checklists?periodId=...`, `D-474`).
         - `CLOSED` (`■ مقفل`, `ink`): Clicking cell (when `accounting.period.reopen` held) opens **`ReopenPeriodDialog`** (`POST /accounting/periods/:id/reopen` with `ReopenPeriodDto`: `{ periodId, module, reason (10..1,000), approvalRequestId? }`, `If-Match`).
         - `PERMANENTLY_CLOSED` (`🔒 مقفل نهائياً`, `ink` + hard-lock icon): Strictly immutable (`422 ACCOUNTING.CLOSE.LOCK_IRREVERSIBLE`, `D-150`); zero transition actions offered.
       - **Multi-Cell Selection & `BulkActionBar`:** Selecting multiple `OPEN` or `SOFT_CLOSED` `(periodId, module)` cells reveals `BulkActionBar` (`Soft-close selected` or `Reopen selected to OPEN with reason`) calling `POST /accounting/periods/bulk-state` (all-or-nothing `200`, `D-164`) with `BulkChangePeriodStateDto { targets: [{ periodId, module }], toState, reason? }` (`reason` `10..1,000` chars when `toState = OPEN`; no per-target version, `D-771`).
     - **Sub-view 3B — User Period Overrides (`GET /accounting/user-period-overrides`):**
       - Lists active & historical grants allowing a specific `userId` to post into a `SOFT_CLOSED` `(periodId, module)` window or past `maxBackdateDays` (`D-193`, `D-325`).
       - `GrantOverrideDrawer` (`POST /accounting/user-period-overrides`, `accounting.period.override`): selects `userId` (excluding current actor in UI with SoD notice `ACCOUNTING.APPROVAL.ACTOR_IS_SUBMITTER`), `periodId`, `module` (`GL` | `AR` | `AP` | `TAX`), `until` (`ISO8601 <= now + 30 days`), and `reason` (`10..1,000` chars).
       - Row action `إلغاء الاستثناء` / `Revoke` calls `DELETE /accounting/user-period-overrides/:id` (`If-Match`, `x-idempotency-key`).
     - **Sub-view 3C — Period Reopen Audit Log (`GET /accounting/periods/reopen-log`):**
       - Strictly read-only `DataTable` over `PeriodReopenLogEntryDto[]` showing `reopenedAt`, `periodId`, `module`, `fromState -> toState` (`SOFT_CLOSED/CLOSED -> OPEN`), `actorUserId`, `approvalRequestId` (link to `#6` `/accounting/inbox/approvals/[id]` when non-null), and full `reason`.
   - **Tab 4 — `Journals` (`دفاتر اليومية` · `[P]`):**
     - Toolbar: `FilterSearchInput` (`search`), `kind` (`JournalKind`), `currencyCode`, `withDeleted` toggle, plus `Advanced search` (`POST /accounting/journals/search`). *(No count/lookup/export buttons — `CG-10`.)*
     - `DataTable` over `GET /accounting/journals` showing `<IdentifierText>{code}</IdentifierText>`, localized `nameI18n`, `kind` badge, `currencyCode` (`"Multi-currency"` when `null`), `<IdentifierText>{sequencePolicy.prefixPattern}</IdentifierText>`, `padding`, read-only `[✓ سلسلة تجزئة مفعلة · Hash chain active]` badge (`hashChainEnabled = true` always, `D-017`), and actions (`Edit`, `Delete`, `Restore`).
     - `JournalFormDrawer` (`CreateJournalDto` / `UpdateJournalDto`):
       - Fields: `code` (`^[A-Z0-9][A-Z0-9_-]{1,15}$`), `nameI18n`, `kind` (`JournalKind`), `currencyCode?`, `allowedAccountRoles?` (multi-select of `AccountRole` with permanent read-only chip `FX_POSITION — مسموح دائماً D-229`), `defaultAccountRoles.DEBIT?` & `defaultAccountRoles.CREDIT?`, `sequencePolicy` (`prefixPattern` supporting `{YYYY}`, `{YY}`, `{JOURNAL}` only + live sample preview e.g. `SALES-2026-000001`; `reset` locked to `YEARLY` in MVP with `NEVER`/`MONTHLY` disabled per `D-329`; `padding` `3..12`), optional `noteSequences.PAYMENT` (`SequencePolicyInput` toggle), and `emailAlias?`.
       - **Legal Series Callout (`D-758`, `D-759`):** Inside the Sequence section, an informational callout explains that `SALES_INVOICE`, `CREDIT_NOTE`, and `DEBIT_NOTE` legal series are company/branch settings (`numbering.*_series` on `#88` `/accounting/setup/company`), never journal `noteSequences` keys.
       - **Sequence Freeze:** Once a journal has posted entries, `sequencePolicy.prefixPattern` and `sequencePolicy.reset` lock against edits (`409 ACCOUNTING.JOURNAL.SEQUENCE_FROZEN`).
   - **Tab 5 — `Number Sequences` (`تسلسلات الترقيم` · `[P]` — Strictly Read-Only):**
     - Callout banner: `تُنشأ العدادات تلقائياً وتُحجز أرقامها تسلسلياً بدون فجوات عند الترحيل؛ لا يُسمح بتعديل العداد يدوياً (D-014, D-015, D-329)` / `Counters are created automatically and allocate gapless numbers under transaction lock at posting; manual counter edits are prohibited (D-014, D-015, D-329)` + outbound `Link` to `#88` (`/accounting/setup/company`) for company/branch legal series patterns (`numbering.*_series`).
     - Filter bar: `journalId` (`Select` from loaded journals), `fiscalYearId` (`Select` from loaded fiscal years), `sequenceKind` (`SequenceKind` enum — `28` members; `AUTHORITY_COUNTER` annotated Wave-2 reserved).
     - `DataTable` over `GET /accounting/number-sequences` + read-only detail drawer (`GET /accounting/number-sequences/:id`) showing `sequenceKind`, `journalId`, `fiscalYearId`, `branchId`, `prefix`, `lastAssignedAt`, and (detail) `periodKey`, `connectionId`, `updatedAt` (`NumberSequenceSummaryDto` / `NumberSequenceDetailDto` withhold `nextValue`, so the read is never a preview, `D-770`; the padding and reset policy are read from the journal's `sequencePolicy`).

---

### 2.2 Components Reused from Approved Patterns (`@/design-system` & `P03` Specs)

| Component / Pattern | Source (`@/design-system` or `P03` Spec) | Exact Role on `SCR-03` (`#91`) |
| --- | --- | --- |
| `PageHeader`, `AccountingScopeBar`, `Tabs`, `SegmentedControl` | `@/design-system` & `accounting-ia.md` §6 | `COMPANY` scope bar, context-aware single `primary` CTA, 5 top-level tabs, and 3 sub-views inside `Periods`. |
| `DataTable` + `BulkActionBar` | `@/design-system` | Tables for Calendars, Fiscal Years, User Overrides, Reopen Log, Journals, and Number Sequences; multi-cell `BulkActionBar` for `POST /periods/bulk-state`. |
| `FiscalPeriodPicker` (`UX-08`) | `accounting-patterns-data.md` §3 | Selects target `(periodId, module)` inside `GrantOverrideDrawer` with state badges (`OPEN` / `SOFT_CLOSED`). |
| `IdentifierText` & `StatusBadge` | `accounting-status-and-a11y.md` §2–§4 | LTR islands for codes, `ISODate`/`ISO8601`, `prefixPattern` (`{JOURNAL}-{YYYY}-`), UUIDs; icon + `t.status.*` badges for `FiscalYearStatus` and `FiscalPeriodState`. |
| `FormDrawer` / `DetailDrawer` | `@/design-system` | Drawers for Calendar create/edit, Fiscal Year create, Grant User Override, Journal create/edit, and read-only Number Sequence inspection. |
| `ReasonDialog` / `Modal` | `@/design-system` & `accounting-patterns-workflow.md` | Mandatory `10..1,000` char `reason` capture for `SOFT_CLOSED -> OPEN` (`POST /periods/:id/state`) and `CLOSED -> OPEN` (`POST /periods/:id/reopen`), plus `Open Fiscal Year` confirmation modal. |
| `PermissionGate`, `AccountingBoundaryGate`, `ConflictDialog`, `AmbiguousOutcomePanel` | `@/design-system` & `accounting-patterns-documents.md` (`UX-17`..`UX-19`) | Per-tab `403` isolation, entitlement/recovery fences, `409 STALE_VERSION` reload dialog, and idempotent retry panel. |

---

### 2.3 Complete Field-to-DTO & Enum Mapping (`SCR-03`)

#### 2.3.1 Query DTOs (`02_DTOs.md` §4.1)

| Surface | UI Filter (`AR` / `EN`) | DTO & Exact Member | Wire Type / Enum (`01_Enums.md`) |
| --- | --- | --- | --- |
| Calendars Tab | نوع التقويم · نمط الفترات / Calendar Type · Pattern | `FiscalCalendarListQueryDto`: `calendarType?`, `periodPattern?` (+ `FindManyDto`) | `CalendarType`, `PeriodPattern` |
| Fiscal Years Tab | التقويم · الحالة · من/إلى تاريخ / Calendar · Status · Date Range | `FiscalYearListQueryDto`: `calendarId?`, `status?`, `fromDate?`, `toDate?` (+ `FindManyDto`) | `UUID`, `FiscalYearStatus`, `ISODate` |
| Periods Matrix | السنة · نوع الفترة · الوحدة · الحالة · في تاريخ | `FiscalPeriodListQueryDto`: `fiscalYearId?`, `periodKind?`, `module?`, `state?`, `onDate?` (+ `FindManyDto`) | `UUID`, `PeriodKind`, `PeriodModule`, `FiscalPeriodState`, `ISODate` |
| Periods Search | بحث متقدم في الفترات / Period Search | `POST /accounting/periods/search` (`SearchManyDto`) | Repository-allowlisted period fields |
| Journals Tab | نوع اليومية · العملة · بحث / Kind · Currency · Search | `JournalListQueryDto`: `kind?`, `currencyCode?` (+ `FindManyDto` / `POST /journals/search` `SearchManyDto`) | `JournalKind`, `CurrencyCode` |
| Number Sequences Tab | اليومية · السنة المالية · نوع التسلسل | `NumberSequenceListQueryDto`: `journalId?`, `fiscalYearId?`, `sequenceKind?` (+ `FindManyDto`) | `UUID`, `UUID`, `SequenceKind` |

#### 2.3.2 Command & Read Projection DTOs (`02_DTOs.md` §4.3, §4.4 & §13.1)

| Resource / Command | Field (`AR` / `EN`) | Request DTO Member | Read Projection (`<E>SummaryDto` / `<E>DetailDto`) | Type / Enum, Bounds & Domain Rules |
| --- | --- | --- | --- | --- |
| **Fiscal Calendar (`CreateFiscalCalendarDto` / `UpdateFiscalCalendarDto`)** | كود التقويم / Code | `code` (required) | `id`, `companyId`, `code`, `version` (§13.1 `acc_fiscal_calendars`) | `^[A-Z0-9][A-Z0-9_-]{1,31}$`, unique per company among live rows. |
| | الاسم (عربي / إنجليزي) / Name | `nameI18n` (`ar`, `en?`) | `nameI18n` | `I18nText` (`ar` mandatory). |
| | نوع التقويم / Calendar Type | `calendarType` (required) | `calendarType` | `CalendarType`: **`GREGORIAN` only in MVP**; `HIJRI` & `RETAIL_4_4_5` disabled in UI (`400` if sent, `D-705`); **frozen** once a year exists. |
| | نمط الفترات / Period Pattern | `periodPattern` (required) | `periodPattern` | `PeriodPattern`: **`MONTHLY` \| `QUARTERLY` in MVP**; `4-4-5` patterns disabled (`D-705`). |
| | شهر ويوم بداية السنة / Year Start Month & Day | `yearStartMonth`, `yearStartDay` | `yearStartMonth`, `yearStartDay` | Integers `1..12` and `1..31` (valid for month); `yearStartMonth` **frozen** once a year exists (`409 ACCOUNTING.CALENDAR.IN_USE`). |
| **Fiscal Year (`CreateFiscalYearDto` & `POST /:id/open`)** | التقويم المالي / Calendar | `calendarId` (required) | `id`, `companyId`, `calendarId` (§13.1 `acc_fiscal_years`) | `UUID` of company's calendar. |
| | كود السنة / Year Code | `code` (required) | `code` | `^[A-Z0-9][A-Z0-9_-]{1,15}$`, unique per calendar (e.g. `"2027"`). |
| | تاريخ البداية والنهاية / Start & End Date | `startDate`, `endDate` (required) | `startDate`, `endDate` | `ISODate`; continues prior year with zero gap/overlap (`YEAR_GAP` / `YEAR_OVERLAP`); `endDate <= startDate + 18 months` (`D-332`). |
| | حالة السنة والبيانات المشتقة / Year Status & Derived | *(Empty body on `POST /:id/open` with `If-Match`)* | `status` (`FUTURE`\|`OPEN`\|`CLOSING`\|`CLOSED`), `partitionCreated`, `closedAt`, `incomeTaxFiledAt`, `incomeTaxFiledBy`, `incomeTaxFilingReference`, `version` | `POST /fiscal-years` creates `FUTURE` + periods `0..N+2`; `POST /:id/open` creates partition + moves all active module states `FUTURE -> OPEN` (`D-030`, `D-336`). |
| **Period Matrix & State Commands (`FiscalPeriodSummaryDto`, `ChangePeriodStateDto`, `ReopenPeriodDto`)** | بيانات الفترة / Period Row | *(Server generated)* | Declared `FiscalPeriodSummaryDto`: `id`, `fiscalYearId`, `periodNo`, `periodKind`, `startDate`, `endDate`, `code`, `states: Array<{ module, state, changedAt, version }>` *(`code` and the per-module state `version` were added by `D-770`; a module transition sends that `version` as `If-Match`, `D-771`)* | `PeriodKind`: `OPENING` (`0`), `NORMAL` (`1..N`), `ADJUSTMENT` (`N+1`), `CLOSING` (`N+2`). Active `PeriodModule`s in MVP: `GL`, `AR`, `AP`, `TAX` (`D-021`). |
| | تغيير الحالة (`OPEN <-> SOFT_CLOSED`) | `ChangePeriodStateDto`: `periodId`, `module`, `toState`, `reason?` | Returns updated state (`200`) | `toState`: `SOFT_CLOSED` (from `OPEN`) or `OPEN` (from `SOFT_CLOSED`, `reason` `10..1,000` chars mandatory, `D-022`). `CLOSED` & `PERMANENTLY_CLOSED` refused (`D-150`, `D-474`). |
| | إعادة فتح فترة مقفلة (`CLOSED -> OPEN`) | `ReopenPeriodDto`: `periodId`, `module`, `reason`, `approvalRequestId?` | Returns updated state (`200`) + writes `acc_period_reopen_log` | `reason`: `10..1,000` chars mandatory; `approvalRequestId` required when a `PERIOD_REOPEN` approval rule matches (`D-146`). |
| **Period Reopen Log (`PeriodReopenLogEntryDto`)** | سجل إعادة الفتح / Reopen Audit Row | *(Append-only, never accepted)* | `id`, `companyId`, `periodId`, `module`, `fromState`, `toState` (`OPEN`), `reason`, `actorUserId`, `approvalRequestId`, `reopenedAt`, `createdAt`, `createdBy` | Paginated read-only evidence (`GET /accounting/periods/reopen-log`, `D-022`, `D-737`). |
| **User Period Override (`CreateUserPeriodOverrideDto`)** | المستخدم والفترة والوحدة والصلاحية الزمنية والسبب | `userId`, `periodId`, `module`, `until`, `reason` | §13.1 `acc_user_period_overrides`: `id`, `companyId`, `userId`, `periodId`, `module`, `until`, `reason`, `grantedBy`, `revokedAt`, derived `active`, `createdAt`, `version` *(`UserPeriodOverrideSummaryDto` keeps `reason`; filters `periodId?`, `userId?`, `module?`, `activeOnly?`; `D-770`)* | `until`: `ISO8601 <= now + 30 days`; `reason`: `10..1,000` chars (`D-193`); self-grant refused (`ACCOUNTING.APPROVAL.ACTOR_IS_SUBMITTER`). |
| **Journal (`CreateJournalDto` / `UpdateJournalDto` / `JournalDetailDto` §13.1)** | كود واسم ونوع اليومية / Code, Name & Kind | `code`, `nameI18n`, `kind` | `id`, `companyId`, `code`, `nameI18n`, `kind`, `version` | `code`: `^[A-Z0-9][A-Z0-9_-]{1,15}$`; `kind`: `JournalKind` (`SALES`, `PURCHASE`, `BANK`, `CASH`, `CARD`, `MISC`, `PAYROLL`, `TAX`, `ASSETS`, `CLOSING`). |
| | العملة والأدوار المسموحة والافتراضية / Currency & Roles | `currencyCode?`, `allowedAccountRoles?`, `defaultAccountRoles?` | `[S, D] currencyCode`; `[D] allowedAccountRoles`, `defaultAccountRoles` | `allowedAccountRoles`: max `116` unique `AccountRole[]` (`FX_POSITION` always permitted, `D-229`); `defaultAccountRoles`: `{ DEBIT?: AccountRole; CREDIT?: AccountRole }`. |
| | سياسة ترقيم القيود وإشعارات الدفع / Sequence Policies | `sequencePolicy: { prefixPattern, reset, padding }`, `noteSequences?: { PAYMENT?: SequencePolicyInput }` | `[D] sequencePolicy`, `noteSequences`, `[S, D] hashChainEnabled` (`true` always) | `prefixPattern`: max `32` chars, tokens `{YYYY}`, `{YY}`, `{JOURNAL}` only; `reset`: `YEARLY` only in MVP (`D-329`); `padding`: integer `3..12`. `CREDIT_NOTE`/`DEBIT_NOTE` keys refused (`400`, `D-759`). `prefixPattern` & `reset` freeze after first posted entry. |
| | البريد المخصص للإدخال / Email Alias | `emailAlias?` | `[S, D] emailAlias` | Valid email local part, max `64` chars; `hashChainEnabled` is **forbidden** in request (`D-017`). |
| **Number Sequence (`NumberSequenceSummaryDto` / `DetailDto` — Read-Only)** | عداد الترقيم / Sequence Counter | *(No write DTO exists — `D-014`)* | `id`, `journalId`, `branchId`, `fiscalYearId`, `sequenceKind`, `prefix`, `lastAssignedAt`, `version`; detail adds `periodKey`, `connectionId`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` *(`nextValue` is withheld, `D-770`)* | Strictly read-only under `accounting.journal.read`; `SequenceKind` (`28` members). |

---

### 2.4 Complete Verbatim Action & Endpoint Matrix (`SCR-03` — `[P: 15]` + `[S]` / `SCR-11` Period & Year Routes)

Every row below is copied verbatim from `02_Endpoint_Catalogue.md` §3 (lines 86, 117–141, 185–193, 229). Ownership column marks **`[P: SCR-03]`** (`15` primary routes of `#91`) vs **`[S / P: SCR-11]`** (shared onboarding/setup surface on `#91`, primary operational close owner `#65`/`#66`).

| Ownership | UI Action | Method | Catalogue Path | Permission | Feature Key | Scope Target | Idempotency | Concurrency | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **`[P: SCR-03]`** | List fiscal calendars | `GET` | `/accounting/fiscal-calendars` | `accounting.calendar.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |
| **`[P: SCR-03]`** | Read fiscal calendar detail | `GET` | `/accounting/fiscal-calendars/:id` | `accounting.calendar.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` + `ETag` |
| **`[P: SCR-03]`** | Create fiscal calendar | `POST` | `/accounting/fiscal-calendars` | `accounting.calendar.create` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `201` + `Location` |
| **`[P: SCR-03]`** | Update fiscal calendar | `PATCH` | `/accounting/fiscal-calendars/:id` | `accounting.calendar.update` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| **`[P: SCR-03]`** | Soft-delete fiscal calendar | `DELETE` | `/accounting/fiscal-calendars/:id` | `accounting.calendar.delete` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `204` |
| **`[P: SCR-03]`** | Restore fiscal calendar | `POST` | `/accounting/fiscal-calendars/:id/restore` | `accounting.calendar.restore` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `200` |
| **`[P: SCR-03]`** | List journals | `GET` | `/accounting/journals` | `accounting.journal.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |
| **`[P: SCR-03]`** | Advanced search journals | `POST` | `/accounting/journals/search` | `accounting.journal.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |
| **`[P: SCR-03]`** | Read journal detail | `GET` | `/accounting/journals/:id` | `accounting.journal.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` + `ETag` |
| **`[P: SCR-03]`** | Create journal | `POST` | `/accounting/journals` | `accounting.journal.create` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `201` + `Location` |
| **`[P: SCR-03]`** | Update journal | `PATCH` | `/accounting/journals/:id` | `accounting.journal.update` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| **`[P: SCR-03]`** | Soft-delete journal | `DELETE` | `/accounting/journals/:id` | `accounting.journal.delete` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `204` |
| **`[P: SCR-03]`** | Restore journal | `POST` | `/accounting/journals/:id/restore` | `accounting.journal.restore` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `200` |
| **`[P: SCR-03]`** | List number sequences | `GET` | `/accounting/number-sequences` | `accounting.journal.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |
| **`[P: SCR-03]`** | Read number sequence detail | `GET` | `/accounting/number-sequences/:id` | `accounting.journal.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` + `ETag` |
| **`[S / P: SCR-11]`** | List fiscal years | `GET` | `/accounting/fiscal-years` | `accounting.calendar.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |
| **`[S / P: SCR-11]`** | Read fiscal year detail | `GET` | `/accounting/fiscal-years/:id` | `accounting.calendar.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` + `ETag` |
| **`[S / P: SCR-11]`** | Create `FUTURE` fiscal year | `POST` | `/accounting/fiscal-years` | `accounting.calendar.create` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `201` + `Location` |
| **`[S / P: SCR-11]`** | Open fiscal year & partition | `POST` | `/accounting/fiscal-years/:id/open` | `accounting.calendar.open_year` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` + `ETag` |
| **`[S / P: SCR-11]`** | List fiscal periods & states | `GET` | `/accounting/periods` | `accounting.period.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |
| **`[S / P: SCR-11]`** | Search fiscal periods | `POST` | `/accounting/periods/search` | `accounting.period.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |
| **`[S / P: SCR-11]`** | Read period detail | `GET` | `/accounting/periods/:id` | `accounting.period.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` + `ETag` |
| **`[S / P: SCR-11]`** | Transition `OPEN <-> SOFT_CLOSED` | `POST` | `/accounting/periods/:id/state` | `accounting.period.change_state` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| **`[S / P: SCR-11]`** | Bulk transition period states | `POST` | `/accounting/periods/bulk-state` | `accounting.period.change_state` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `200` (all-or-nothing) |
| **`[S / P: SCR-11]`** | Reopen `CLOSED` period | `POST` | `/accounting/periods/:id/reopen` | `accounting.period.reopen` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| **`[S / P: SCR-11]`** | List period reopen audit log | `GET` | `/accounting/periods/reopen-log` | `accounting.period.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |
| **`[S / P: SCR-11]`** | List user period overrides | `GET` | `/accounting/user-period-overrides` | `accounting.period.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |
| **`[S / P: SCR-11]`** | Grant temporary user override | `POST` | `/accounting/user-period-overrides` | `accounting.period.override` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `201` |
| **`[S / P: SCR-11]`** | Revoke user period override | `DELETE` | `/accounting/user-period-overrides/:id` | `accounting.period.override` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `204` |
| **`[S: Context]`** | Read active company profile | `GET` | `/accounting/company-profile` | `accounting.profile.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` + `ETag` |
| **`[S: Context]`** | Read `numbering.*_series` settings | `GET` | `/accounting/settings` | `accounting.setting.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |

*(Note: Year-end closing routes `POST /accounting/fiscal-years/:id/close` [`accounting.close.checklist`], `POST /accounting/fiscal-years/:id/rerun-requests` [`accounting.close.approvals`], `POST /accounting/fiscal-years/:id/record-income-tax-filing`, and `GET /accounting/year-end-closings*` are owned by `SCR-11` `#65` and linked from Tab 2 without duplicating year-close execution modals inside Setup.)*

---

### 2.5 States, Boundaries & 3-Part Domain Error Copy (`SCR-03`)

1. **Loading State (`TableSkeleton`):**
   - Renders `AccountingScopeBar` + `Tabs` bar + `10`-row table skeleton (or `15 × 5` matrix skeleton on Tab 3A) with fixed `44px` row heights.
2. **Empty States (`EmptyState`):**
   - **Company Not Yet Activated (`404 ACCOUNTING.PROFILE.NOT_ACTIVATED` or `0` calendars):**
     - AR: `لم يتم تفعيل محاسبة الشركة بعد. ينشئ التفعيل التقويم المالي الأول والسنة الافتتاحية ودفاتر اليومية القياسية تلقائياً.`
     - EN: `Company accounting is not activated yet. Activation automatically seeds the primary calendar, first fiscal year, and pack journals.`
     - Action: `Link` to `#88` (`/accounting/setup/company`).
   - **No User Overrides / Empty Reopen Log:** Calm informational empty state (`لا توجد استثناءات فتح فترات نشطة حالياً` / `No temporary user period overrides are active`).
   - **Empty Number Sequences (before first posting in year):** Explains that sequence counters materialize automatically when the first entry or numbered document of the fiscal year is allocated (`D-014`).
3. **`403` Permission State (`PermissionGate`):**
   - Tab-level granular `PermissionGate`: e.g., a treasury or journal clerk holding `accounting.journal.read` without `accounting.calendar.read` or `accounting.period.read` lands cleanly on Tabs 4–5 (`Journals` & `Number Sequences`) while Tabs 1–2 show `PermissionGate(accounting.calendar.read)` and Tab 3 shows `PermissionGate(accounting.period.read)`.
4. **Entitlement & `RECOVERY_MODE` States (`UX-18` `AccountingBoundaryGate`):**
   - Identical to `SCR-02`: unentitled `accounting.ledger.core` renders `AccountingBoundaryGate`; active `RECOVERY_MODE` or `TenantStatus.ARCHIVED` freezes every write action (`Open year`, `Soft-close`, `Reopen`, `Grant override`, `Create/Edit calendar or journal`) with a top read-only `AlertBanner`.
5. **`409` Optimistic Concurrency (`ConflictDialog`) & Ambiguous Write (`AmbiguousOutcomePanel`):**
   - `409 ACCOUNTING.CONCURRENCY.STALE_VERSION` on `PATCH /calendars/:id`, `POST /fiscal-years/:id/open`, `POST /periods/:id/state`, `POST /periods/:id/reopen`, `DELETE /user-period-overrides/:id`, or `PATCH /journals/:id` opens `ConflictDialog` to reload fresh `ETag` state.
   - Network timeout on `POST /fiscal-years/:id/open` or `POST /periods/*` opens `AmbiguousOutcomePanel` preserving the exact `UUIDv7` `x-idempotency-key` so safe replay returns the committed result without duplicate side effects.
6. **Domain Error Copy Table (`useAccountingErrorModel` — Cause + Effect + Safe Action + `<IdentifierText>{correlationId}</IdentifierText>`):**

| `errorCode` (`04_Errors_and_Constants.md`) | HTTP | Arabic (`AR` — السبب · الأثر · الإجراء الآمن) | English (`EN` — Cause · Effect · Safe Action) |
| --- | --- | --- | --- |
| `ACCOUNTING.CALENDAR.IN_USE` | `409` | **السبب:** يحتوي التقويم المالي على سنة مالية مسجلة بالفعل. **الأثر:** لم يتم تعديل نوع التقويم أو شهر البداية أو حذف التقويم. **الإجراء:** يمكنك تعديل اسم التقويم فقط، أو إنشاء تقويم جديد لشركة غير مفعلة. | **Cause:** This fiscal calendar already has at least one fiscal year. **Effect:** Calendar type, start month, and deletion were refused. **Safe action:** Edit the display name only, or create a new calendar for an unactivated company. |
| `ACCOUNTING.CALENDAR.YEAR_GAP` / `YEAR_OVERLAP` | `422` | **السبب:** يجب أن تبدأ السنة المالية الجديدة في اليوم التالي مباشرة لنهاية آخر سنة مالية بدون فجوة أو تداخل، وبحد أقصى 18 شهراً (`D-332`). **الأثر:** لم يتم إنشاء السنة المالية. **الإجراء:** اضبط تاريخ البداية والنهاية ليكملا السنة السابقة مباشرة. | **Cause:** A new fiscal year must start immediately after the latest year's `endDate` with no gap or overlap and span at most 18 months (`D-332`). **Effect:** Fiscal year was not created. **Safe action:** Adjust `startDate` and `endDate` to continue the prior year contiguously. |
| `ACCOUNTING.CALENDAR.PRIOR_YEAR_NOT_CLOSED` | `409` | **السبب:** يوجد بالفعل سنتان ماليتان في حالة «مفتوحة» أو «قيد الإقفال» لهذا التقويم (`D-217`). **الأثر:** لم يتم فتح السنة الجديدة. **الإجراء:** أتمم إقفال السنة الأقدم من شاشة «إقفال الفترات والسنوات» (`#65`) أولاً. | **Cause:** Two fiscal years of this calendar are already `OPEN` or `CLOSING` (`D-217`). **Effect:** The new year remained `FUTURE`. **Safe action:** Complete year-end close for the oldest open year on `#65` (`/accounting/close/periods`) first. |
| `ACCOUNTING.PERIOD.FUTURE_NOT_OPEN` | `409` | **السبب:** لا يمكن فتح فترة في حالة «مستقبلية» بشكل منفرد (`D-336`). **الأثر:** بقيت الفترة `FUTURE`. **الإجراء:** افتح السنة المالية بالكامل من تبويب «السنوات المالية» (`POST /fiscal-years/:id/open`). | **Cause:** A `FUTURE` period cannot be opened individually (`D-336`). **Effect:** Period state remained `FUTURE`. **Safe action:** Open the parent fiscal year from the **Fiscal Years** tab (`POST /fiscal-years/:id/open`). |
| `ACCOUNTING.CLOSE.MODULE_NOT_READY` | `409` | **السبب:** الإقفال الرسمي (`CLOSED`) لوحدات `GL` و`AR` و`AP` و`TAX` يتم حصراً عبر مهمة القفل في قائمة مهام إقفال الفترة أو إقفال العام (`D-474`). **الأثر:** لم تتغير حالة الفترة. **الإجراء:** استخدم «إغلاق مبدئي» (`SOFT_CLOSED`) هنا، أو انتقل إلى «قوائم مهام الإقفال» (`#63`) لإقفال الوحدة رسمياً. | **Cause:** Formal `CLOSED` state for `GL`, `AR`, `AP`, and `TAX` is written only by a close-checklist `LOCK` task or year-end close (`D-474`). **Effect:** Period state was not changed. **Safe action:** Use **Soft-close** (`SOFT_CLOSED`) here, or open **Close Checklists** (`#63`) to lock the module. |
| `ACCOUNTING.CLOSE.LOCK_IRREVERSIBLE` | `422` | **السبب:** القفل النهائي (`PERMANENTLY_CLOSED`) غير قابل للتراجع ولا يُنفذ إلا عبر الإقفال النهائي لقائمة الإقفال (`D-150`). **الأثر:** رُفض الطلب. **الإجراء:** نفّذ القفل النهائي من شاشة قائمة مهام الإقفال (`#64`) إذا كان ذلك مقصوداً. | **Cause:** `PERMANENTLY_CLOSED` is irreversible and is written only by the hard-close lock command (`D-150`). **Effect:** Request was refused. **Safe action:** Execute hard close from the close checklist detail screen (`#64`) when intended. |
| `ACCOUNTING.PERIOD.REOPEN_REASON_REQUIRED` / `REOPEN_NOT_ALLOWED` | `409` / `422` | **السبب:** إعادة فتح فترة تتطلب سبباً موثقاً (`10..1,000` حرف)، ولا تُسمح بعد القفل النهائي أو تسجيل إقرار ضريبة الدخل للسنة (`D-022`, `D-234`). **الأثر:** بقيت الفترة مقفلة. **الإجراء:** أدخل سبباً تفصيلياً صالحاً، أو سجّل قيد تسوية في الفترة المفتوحة الحالية إذا كانت السنة مقفلة نهائياً. | **Cause:** Reopening requires a `10..1,000` character reason and is prohibited once permanently closed or after income-tax filing is recorded (`D-022`, `D-234`). **Effect:** Period remained closed. **Safe action:** Supply a valid audit reason, or post a current-period adjustment if the prior year is locked. |
| `ACCOUNTING.APPROVAL.REQUIRED` / `ACTOR_IS_SUBMITTER` | `403` / `409` | **السبب:** تتطلب العملية موافقة مسبقة (`PERIOD_REOPEN`) أو أن المستخدم يحاول منح استثناء لنفسه بالمخالفة لفصل المهام (`D-146`, `D-467`). **الأثر:** لم تُنفذ العملية. **الإجراء:** أرفق طلب موافقة معتمد أو اطلب من مسؤول محاسبة آخر منح الاستثناء. | **Cause:** A matching `PERIOD_REOPEN` approval rule requires an approved `approvalRequestId`, or the actor attempted a self-grant (`D-146`, `D-467`). **Effect:** Command was not executed. **Safe action:** Provide an approved request ID or ask an independent authorized user to grant the override. |
| `ACCOUNTING.JOURNAL.SEQUENCE_PATTERN_INVALID` | `422` | **السبب:** يحتوي نمط البادئة على رموز غير مدعومة (الرموز المسموحة فقط: `{YYYY}` و`{YY}` و`{JOURNAL}`). **الأثر:** لم يُحفظ دفتر اليومية. **الإجراء:** صحّح نمط البادئة ليستخدم الرموز المعتمدة فقط وبحد أقصى 32 حرفاً. | **Cause:** `prefixPattern` contains unsupported placeholders (only `{YYYY}`, `{YY}`, and `{JOURNAL}` are valid). **Effect:** Journal was not saved. **Safe action:** Update `prefixPattern` (max `32` chars) to use supported tokens only. |
| `ACCOUNTING.JOURNAL.SEQUENCE_FROZEN` | `409` | **السبب:** تم ترحيل قيود فعلية في دفتر اليومية هذا، مما يجمّد نمط البادئة وسياسة إعادة الضبط حفاظاً على تسلسل السلسلة. **الأثر:** لم يتم تعديل إعدادات الترقيم. **الإجراء:** عدّل الاسم أو الأدوار فقط، أو أنشئ دفتر يومية جديداً للعمليات المستقبلية. | **Cause:** Entries have already been posted to this journal, freezing `prefixPattern` and `reset` to protect gapless numbering. **Effect:** Sequence changes were not saved. **Safe action:** Update non-sequence fields only, or create a new journal for future postings. |

---

### 2.6 ASCII Mockups — `SCR-03` (All 4 Combinations + `375px` Mobile)

#### Combination 1: Arabic RTL × Light (`dir="rtl"`, `data-theme="light"`) — `#91` Tab 3A (`Period Module State Matrix`)

```text
+------------------------------------------------------------------------------------------------------+
| [Light · bg-surface-canvas #F8FAFC · ink #0F172A]                                                    |
| الشريط النطاقي: الشركة: شركة النيل للتجارة (EGP) [▾] | التقويم: [CAL-EG-JAN · ميلادي] | الرجعي: 5 أيام|
+------------------------------------------------------------------------------------------------------+
|                                                             التقويمات والفترات واليوميات               |
|                                                             إدارة التقويم وحالات الفترات واليوميات    |
+------------------------------------------------------------------------------------------------------+
| [تسلسلات الترقيم] [دفاتر اليومية] [*الفترات والاستثناءات*] [السنوات المالية] [التقويمات المالية]       |
+------------------------------------------------------------------------------------------------------+
| عرض فرعي: [سجل إعادة الفتح] [استثناءات المستخدمين (1 نشط)] [*مصفوفة حالات الوحدات (GL/AR/AP/TAX)*]   |
| الفلتر: السنة: [2026 (● مفتوحة) ▾] | نوع الفترة: [الكل ▾] | الحالة: [الكل ▾]    [رابط: قوائم الإقفال] |
+------------------------------------------------------------------------------------------------------+
| الضرائب TAX   | الموردون AP   | العملاء AR    | الأستاذ GL    | النطاق الزمني (LTR)     | النوع  | # |
|---------------+---------------+---------------+---------------+-------------------------+--------+---|
| [■ مقفل ▾]    | [■ مقفل ▾]    | [■ مقفل ▾]    | [■ مقفل ▾]    | 2026-01-01 -> 2026-01-01| افتتاح | 0 |
| [🔒 نهائي]    | [🔒 نهائي]    | [🔒 نهائي]    | [🔒 نهائي]    | 2026-01-01 -> 2026-01-31| عادية  | 1 |
| [◐ مبدئي ▾]   | [■ مقفل ▾]    | [■ مقفل ▾]    | [◐ مبدئي ▾]   | 2026-09-01 -> 2026-09-30| عادية  | 9 |
| [● مفتوح ▾]   | [● مفتوح ▾]   | [◐ مبدئي ▾]   | [● مفتوح ▾]   | 2026-10-01 -> 2026-10-31| عادية  |10 |
| [● مفتوح ▾]   | [● مفتوح ▾]   | [● مفتوح ▾]   | [● مفتوح ▾]   | 2026-11-01 -> 2026-11-30| عادية  |11 |
| [● مفتوح ▾]   | [● مفتوح ▾]   | [● مفتوح ▾]   | [● مفتوح ▾]   | 2026-12-31 -> 2026-12-31| تسوية  |13 |
| [● مفتوح ▾]   | [● مفتوح ▾]   | [● مفتوح ▾]   | [● مفتوح ▾]   | 2026-12-31 -> 2026-12-31| إقفال  |14 |
+------------------------------------------------------------------------------------------------------+
| [شريط جماعي: محدد 3 خلايا OPEN -> إغلاق مبدئي جماعي (POST /periods/bulk-state)]          [إلغاء التحديد]|
+------------------------------------------------------------------------------------------------------+
```

#### Combination 2: Arabic RTL × Dark (`dir="rtl"`, `data-theme="dark"`) — `#91` Tab 3B (`User Overrides` + `GrantOverrideDrawer`)

```text
+------------------------------------------------------------------------------------------------------+
| [Dark · bg-surface-canvas #0B1120 · ink #F1F5F9 · Drawer #111827]                                    |
| [+ منح استثناء لمستخدم (Primary)]                           التقويمات والفترات واليوميات               |
|------------------------------------------------------------------------------------------------------|
| [تسلسلات الترقيم] [دفاتر اليومية] [*الفترات والاستثناءات*] [السنوات المالية] [التقويمات المالية]       |
| [سجل إعادة الفتح] [*استثناءات المستخدمين المؤقتة*] [مصفوفة حالات الوحدات]                             |
+------------------------------------------------------+-----------------------------------------------+
| +-- درج: منح استثناء فترة مؤقت (POST /overrides) --+ | إجراء   | ينتهي في (LTR)   | الوحدة| الفترة|مستخدم|
| | المستخدم المستفيد* (لا يقبل مانح الطلب نفسه):    | |---------+------------------+------+------+-----|
| | [أحمد محمود — محاسب أول (019f...81)           ▾] | | [إلغاء] | 2026-11-05 18:00 | AR   | P-10 | سارة|
| | الفترة المالية*: [فترة 10 · 2026-10 (◐ مبدئي) ▾] | |                                               |
| | الوحدة المحاسبية*: ( ) GL  (•) AR  ( ) AP  ( ) TAX| | ℹ يسمح الاستثناء بالترحيل في فترة مغلقة مبدئياً |
| | صالح حتى (أقصى حد 30 يوماً)*: [2026-11-08 17:00] | |   أو تجاوز نافذة الترحيل الرجعي للمستخدم المحدد|
| | سبب المنح الموثق (10..1,000 حرف)*:               | |   فقط حتى تاريخ الانتهاء (D-193, D-325).       |
| | [تسجيل إشعار تسوية عميل متأخر بعد مطابقة أكتوبر] | |                                               |
| |                       [منح الاستثناء]  [إلغاء]   | |                                               |
| +--------------------------------------------------+ |                                               |
+------------------------------------------------------+-----------------------------------------------+
```

#### Combination 3: English LTR × Light (`dir="ltr"`, `data-theme="light"`) — `#91` Tab 4 (`Journals` + `JournalFormDrawer`)

```text
+------------------------------------------------------------------------------------------------------+
| [Light · bg-surface-canvas #F8FAFC · ink #0F172A]                                                    |
| Company: Nile Trade Co. (EGP) [▾]                          [+ New journal (Primary)]                 |
| Calendars, Periods & Journals                                                                        |
+------------------------------------------------------------------------------------------------------+
| [Fiscal Calendars] [Fiscal Years] [Periods & Overrides] [*Journals*] [Number Sequences]              |
+------------------------------------------------------+-----------------------------------------------+
| [🔍 Search journals...] [Kind: All ▾] [Currency ▾]   |+-- Drawer: Edit Journal (PATCH /journals/:id)+|
|------------------------------------------------------|| Code*:         [SALES          ] (🔒 Frozen) ||
| Code    Name             Kind      Prefix Pattern    || Name (AR)*:    [يومية المبيعات            ] ||
|------------------------------------------------------|| Name (EN):     [Sales Journal             ] ||
| SALES   Sales Journal    SALES     {JOURNAL}-{YYYY}- || Kind*:         [SALES                    ▾] ||
| PURCH   Purchase Journal PURCHASE  {JOURNAL}-{YYYY}- || Currency:      [Any currency (Multi-FX)  ▾] ||
| BANK-1  CIB EGP Bank     BANK      BNK-{YYYY}-       || Allowed Roles: [AR_CONTROL ×] [SALES_REV ×] ||
| CASH-1  Main Treasury    CASH      CSH-{YYYY}-       ||                [🔒 FX_POSITION always D-229]||
| MISC    General Journal  MISC      JV-{YYYY}-        || Sequence Policy (🔒 Frozen after 1st post): ||
| CLOSE   Year-End Close   CLOSING   CLS-{YYYY}-       ||   Pattern*:    [{JOURNAL}-{YYYY}-]          ||
|                                                      ||   Preview:     SALES-2026-000001            ||
|                                                      ||   Reset*:      [YEARLY (MVP)             ▾] ||
|                                                      ||   Padding*:    [6] (3..12)                  ||
|                                                      || [✓] Hash chain enabled (Immutable D-017)    ||
|                                                      || ℹ Invoice/CN/DN legal series live on #88.   ||
|                                                      ||                 [Cancel]  [Save Journal]    ||
+------------------------------------------------------+-----------------------------------------------+
```

#### Combination 4: English LTR × Dark (`dir="ltr"`, `data-theme="dark"`) — `#91` Tab 2 (`Fiscal Years` + `Open Year` Modal) & Tab 5 (`Number Sequences`)

```text
+------------------------------------------------------------------------------------------------------+
| [Dark · bg-surface-canvas #0B1120 · ink #F1F5F9]                                                     |
| Company: Nile Trade Co. (EGP) [▾]                          [+ New fiscal year (Primary)]             |
| [Fiscal Calendars] [*Fiscal Years*] [Periods & Overrides] [Journals] [Number Sequences (Read-Only)]  |
+------------------------------------------------------------------------------------------------------+
| Year   Start -> End               Status       Partition   Tax Filing    Actions                     |
|------------------------------------------------------------------------------------------------------|
| 2025   2025-01-01 -> 2025-12-31   [■ CLOSED]   [✓ Ready]   [✓ Filed]     [Year-end receipt (#65) ->] |
| 2026   2026-01-01 -> 2026-12-31   [● OPEN]     [✓ Ready]   —             [Manage close (#65) ->]     |
| 2027   2027-01-01 -> 2027-12-31   [○ FUTURE]   [Pending]   —             [Open fiscal year]          |
+------------------------------------------------------------------------------------------------------+
|   +--- Modal: Open Fiscal Year 2027 (POST /accounting/fiscal-years/:id/open · If-Match: "1") ----+   |
|   | Opening fiscal year 2027 executes in one atomic transaction (D-030, D-336):                  |   |
|   |  1. Creates the yearly ledger partition for acc_journal_lines.                               |   |
|   |  2. Moves Period 0 (OPENING), Periods 1..12 (NORMAL), Period 13 (ADJUSTMENT), and Period 14  |   |
|   |     (CLOSING) across GL, AR, AP, and TAX from FUTURE -> OPEN.                                |   |
|   | ⚠ Precondition: At most 2 fiscal years may be OPEN or CLOSING simultaneously (D-217).        |   |
|   |                                                                [Cancel]  [Open Year 2027]    |   |
|   +----------------------------------------------------------------------------------------------+   |
|------------------------------------------------------------------------------------------------------|
| [Tab 5 Preview — Number Sequences (Strictly Read-Only · D-014 / D-015 / D-329 · Zero Edit CTAs)]     |
| Kind            Journal   Fiscal Year   Prefix        Padding   Reset    Status                      |
| ENTRY           SALES     2026          SALES-2026-   6         YEARLY   [🔒 Gapless row-lock]       |
| SALES_INVOICE   — (Legal) 2026          INV-2026-     6         YEARLY   [Configure pattern on #88 ->]|
+------------------------------------------------------------------------------------------------------+
```

#### Responsive `< 768px` (`375px` Mobile Viewport) Behaviour (`SCR-03`)

- On `< 768px`, the **Period Module State Matrix** (Tab 3A) transforms from a 7-column wide table into stacked **Period Cards** (`1` card per period `0..14`), each containing a compact `2 × 2` tap grid (`min-h-11` `44px` per module pill for `GL`, `AR`, `AP`, `TAX`) so operators never horizontally scroll to tap a module state cell.
- `Tabs` and `SegmentedControl` scroll horizontally with logical `ps-4 pe-4` padding; drawers (`CalendarFormDrawer`, `GrantOverrideDrawer`, `JournalFormDrawer`) render as full-screen mobile sheets.

---

## 3. Consolidated Contract Gap List for `P03.T11`

Per `agy-P03.T09.S2.md` Rule 3 (*"A field, filter, action or route the screen needs that the contracts lack goes in the contract gap list, named as a gap, never written as if it existed"*), the table below consolidates both the pre-existing inventory/foundation gaps (`CG-10`, `CG-18`, `CG-DATA-03`) and **12 newly surfaced DTO/projection/scope gaps (`CG-S2-01`..`CG-S2-12`)** discovered while mapping every field and action of `SCR-02` and `SCR-03`:

| Gap ID | Screen(s) | Authoritative Source Citation | Exact Contract Gap & Recommended `P03.T11` Resolution |
| --- | --- | --- | --- |
| **`CG-10`** *(Existing)* | `SCR-03` (`#91`) | `accounting-screen-inventory.md` §6.5; `02_Endpoint_Catalogue.md` §3 (`journals`, `number-sequences`) | `journals` (`L S G N U D R`) exposes no `/count`, `/lookup`, or `/export` route (journal pickers use paginated `GET /accounting/journals`); `number-sequences` (`L G`) is strictly read-only by design (`D-014`, `D-015`, `D-329`). UI omits those buttons cleanly. |
| **`CG-18` / `CG-WF-01`** *(Existing)* | `SCR-02` (`#89`) | `accounting-screen-inventory.md` §6.5 (`D-691`); `accounting-patterns-workflow.md` §8 | `POST /accounting/accounts/import` (`x-idempotency-key (7 d)`, `202 + Location`) activates when `P17.T06` lands (`D-691`), and `02_DTOs.md` does not yet declare the multipart body schema of `POST /accounting/accounts/import` vs Mode A `POST /accounting/imports` (`ImportEntity.ACCOUNTS`). Until `P17.T06`, `#89` renders the `Import` menu item disabled with a one-line factual note. |
| **`CG-DATA-03` / `CG-S2-01`** | `SCR-02` (`#89`) | `02_DTOs.md` §4.4 lines 423–434 (`AccountSummaryDto`) & `accounting-patterns-data.md` §7 | Declared `AccountSummaryDto` includes only `id`, `code`, `nameI18n`, `accountType`, `normalBalance`, `classification`, `isPostable`, `isControl`, `deprecatedAt`, `version` — omitting `parentId`, `groupId`, `path`, `allowManualJournal`, `currencyCode`, and `requiresDimensionTypeCodes` (which appear only on `AccountDetailDto`), and `AccountLookupQueryDto` returns flat `LookupItemDto` (`{ id, label, disabled? }`). Consequently, `#89` cannot indent accounts into a parent-child tree from `GET /accounting/accounts` without adding `parentId`, `groupId`, and `path` (or `depth`) to `AccountSummaryDto` in `P03.T11`. |
| **`CG-S2-02`** | `SCR-02` (`#89`, `#90`) | `02_DTOs.md` §4.4 lines 413–414 vs 436–453 (`CreateAccountDto` vs `AccountDetailDto`) | `CreateAccountDto` / `UpdateAccountDto` accept `sensitive?: boolean` and `cashFlowCategoryId?: UUID` (both stored on `acc_accounts`), but declared `AccountDetailDto` omits both `sensitive` and `cashFlowCategoryId` (and under §13.1 rule 5, a declared DTO replaces the ERD column rule completely). Without them in `AccountDetailDto`, `EditAccountDrawer` on `#90` cannot display or preserve current `sensitive` / `cashFlowCategoryId` values. Add `sensitive: boolean` and `cashFlowCategoryId: UUID \| null` to `AccountDetailDto` in `P03.T11`. |
| **`CG-S2-03`** | `SCR-02` (`#89` Tab 2) | `02_DTOs.md` §4.4 lines 388–394 & §13.1 rule 4; `01_Foundation_Tables.md` `acc_account_groups` | (a) `acc_account_groups.path` is typed `text`, so §13.1 rule 4 strips `path` from `AccountGroupSummaryDto` (`GET /accounting/account-groups`), leaving `parentId` and `depth` only; (b) `acc_account_groups.sort_order` (`int NOT NULL DEFAULT 0`) is absent from `CreateAccountGroupDto` / `UpdateAccountGroupDto`, preventing custom sibling group ordering. Confirm in `P03.T11` whether `sortOrder?: number` should be added to `CreateAccountGroupDto` and `path` retained in `AccountGroupSummaryDto`. |
| **`CG-S2-04`** | `SCR-02` (`#89` Tab 3) | `02_Endpoint_Catalogue.md` §3 lines 178–180; `02_DTOs.md` §4.4 lines 455–459; `01_Foundation_Tables.md` `acc_account_role_assignments` | (a) `GET /accounting/account-roles` returns *"116 slots with resolved account"*, which is a synthesized slot-resolution read model rather than raw `acc_account_role_assignments` rows, yet no `AccountRoleSlotDto` (`accountRole`, `accountId \| null`, `accountCode`, `accountNameI18n`, `source: 'COMPANY_OVERRIDE' \| 'CHART_DEFAULT' \| 'UNASSIGNED'`, `effectiveFrom`, `effectiveTo`, `version`) is declared in `02_DTOs.md`; (b) `AssignAccountRoleDto` lacks `effectiveFrom` / `effectiveTo` even though `acc_account_role_assignments` enforces `effective_from NOT NULL` and overlap check `VAL-LFO-17`; (c) there is no `DELETE /accounting/account-roles/:role` route to revert a company override back to the chart default. Reconcile in `P03.T11`. |
| **`CG-S2-05`** | `SCR-02` (`#89` Tab 4) | `02_Endpoint_Catalogue.md` §3 lines 181–184; `02_DTOs.md` §4.1 & §4.4 lines 468–474; `01_Foundation_Tables.md` `acc_account_mappings` | Three mismatches on `account-mappings`: (a) `acc_account_mappings` has `ck_acc_account_mappings_country_by_scheme` requiring `country_code IS NOT NULL` whenever `scheme <> 'GROUP'` (`UNIFORM_EG` or `STATUTORY`), yet `CreateAccountMappingDto` omits `countryCode?: CountryCode`; (b) `02_Endpoint_Catalogue.md` marks `account-mappings` `Scope target = TENANT`, whereas `acc_account_mappings.company_id` is `uuid NOT NULL`; (c) `02_DTOs.md` §4.1 declares no `AccountMappingListQueryDto` (`accountId?`, `scheme?`). Reconcile in `P03.T11`. |
| **`CG-S2-06`** | `SCR-02` (`#89` Tab 6, `#90`) | `02_DTOs.md` §4.1, §4.4 lines 461–466 & §13.1 rule 4; `01_Foundation_Tables.md` `acc_account_merges` | (a) `acc_account_merges.reason` is `varchar(1000)` (`> 255` chars) and `account-merges` has `GET /accounting/account-merges` (`L`) only with no `GET /:id`, so strict §13.1 rule 4 would omit `reason` from `AccountMergeSummaryDto`, making the audit reason unreadable in the UI; (b) `02_DTOs.md` §4.1 declares no `AccountMergeListQueryDto` (`chartId?`, `fromAccountId?`, `intoAccountId?`); (c) `MergeAccountsDto` omits optional `approvalRequestId?: UUID` even though `acc_account_merges.approval_request_id` exists (`UC-LFO-4`); (d) `POST /accounting/accounts/:id/deprecate` declares no request DTO in `02_DTOs.md` (confirm empty body). |
| **`CG-S2-07`** | `SCR-02` & `SCR-03` | `02_Endpoint_Catalogue.md` §3 lines 136, 166, 168, 180; `02_DTOs.md` §4.3–§4.4 & §13.2 | `02_DTOs.md` §13.2 declares `BulkIdsDto` (for `/bulk-delete` and `/bulk-restore`), but §4.3–§4.4 do not explicitly declare the TypeScript interfaces of `BulkCreateAccountsDto` (`POST /accounts/bulk`), `BulkUpdateAccountsDto` (`PATCH /accounts/bulk-update`), `BulkUpdateAccountRolesDto` (`PATCH /account-roles/bulk-update`), or `BulkChangePeriodStateDto` (`POST /periods/bulk-state`). Declare their exact item wrapper shapes in `02_DTOs.md` during `P03.T11`. |
| **`CG-S2-08`** | `SCR-03` (`#91` Tab 3A) & `SCR-11` (`#65`) | `02_DTOs.md` §4.3 lines 341–349 (`FiscalPeriodSummaryDto`) vs `02_Endpoint_Catalogue.md` §3 lines 135, 137 | Declared `FiscalPeriodSummaryDto` omits `acc_fiscal_periods.code` (e.g. `"2026-10"`) and omits `version` both on the period and inside `states: Array<{ module, state, changedAt }>`, whereas `POST /accounting/periods/:id/state` and `POST /accounting/periods/:id/reopen` require `If-Match` (`acc_fiscal_period_states.version`). Without per-module `version` in `states[]`, the Period State Matrix would need a separate `GET` before every cell transition, and even `GET /accounting/periods/:id` has one `ETag` while `4` module state rows carry independent `version` counters. Add `code: string` and `states[].version: number` to `FiscalPeriodSummaryDto` / `FiscalPeriodDetailDto` in `P03.T11`. |
| **`CG-S2-09`** | `SCR-03` (`#91` Tab 2) & `SCR-11` (`#65`) | `01_ledger_foundation.md` §5 vs `02_Endpoint_Catalogue.md` §3 lines 62, 123–129 | `01_ledger_foundation.md` prose mentions soft-deleting an unopened `FUTURE` fiscal year, whereas `02_Endpoint_Catalogue.md` §3 (`fiscal-years`: `L G N + commands`, `7` routes) registers no `DELETE /accounting/fiscal-years/:id`. Per route authority, no delete action is rendered on Fiscal Years; `P03.T11` should confirm prose alignment. |
| **`CG-S2-10`** | `SCR-03` (`#91` Tab 3B/3C) & `SCR-11` | `02_DTOs.md` §4.1, §4.3 & §13.1; `01_Foundation_Tables.md` `acc_user_period_overrides` | (a) Neither `UserPeriodOverrideListQueryDto` (`periodId?`, `userId?`, `module?`, `activeOnly?`) nor `PeriodReopenLogListQueryDto` (`periodId?`, `module?`, `fromDate?`, `toDate?`) is declared in `02_DTOs.md` §4.1; (b) `user-period-overrides` has `GET /` (`L`) and no `GET /:id`, while `acc_user_period_overrides.reason` is `varchar(1000)` (`> 255`), so §13.1 rule 4 would omit `reason` from `UserPeriodOverrideSummaryDto`; (c) resolving `userId` / `actorUserId` to display names depends on Core tenant-member lookup (`OPEN-QUESTIONS` `Q14`). |
| **`CG-S2-11`** | `SCR-03` (`#91` Tab 5) | `01_ledger_foundation.md` §5 line 215 vs `02_DTOs.md` §13.1 rule 1; `01_Foundation_Tables.md` `acc_number_sequences` | `01_ledger_foundation.md` §5 states `number-sequences` *"never previews `nextValue`"*, whereas `02_DTOs.md` §13.1 projects every ERD column of `acc_number_sequences` (which includes `next_value bigint`) unless explicitly declared/withheld. Declare `NumberSequenceSummaryDto` / `NumberSequenceDetailDto` in `02_DTOs.md` explicitly omitting `nextValue` so DTO spec and module prose match. |
| **`CG-S2-12`** | `SCR-03` (`#91`) & `SCR-11` (`#65`) | `accounting-app-plan-p03-ux-foundation.md` `P03.T09.S2` vs `accounting-screen-inventory.md` rows `SCR-03` & `SCR-11` | Plan prose (`P03.T09.S2`) titled `SCR-03` *"fiscal calendars and periods"*, while `accounting-screen-inventory.md` partitioned `[P: 15]` (`fiscal-calendars`, `journals`, `number-sequences`) + `[S]` onboarding year/period setup onto `SCR-03` (`#91`) and `[P: 19]` close/reopen/override/year-end operations onto `SCR-11` (`#65`/`#66`). This specification designs both sets in full and shares the React/hook components across `#91` and `#65` so `P03.T09.S6` (`SCR-11`) only needs to add Year-End Close, Rerun Requests, and Income-Tax Filing (`UC-CLR-2`). |

---

## 4. Self-Verification Against Lead Review Gate (`docs/design/README.md`)

- [x] `ui-ux-pro-max` and `frontend-design` skills consulted and enforced (compact `44px` rhythm, `400/500/600` weights only, 4 outcome roles + `ink` neutral ramp, non-colour icon + `t.status.*` cues, `< 300`-line hook/view split, `@/design-system` barrel only).
- [x] Every route, HTTP method, permission key, feature key (`accounting.ledger.core`), scope target (`TENANT`, `COMPANY`, `OPERATING_CONTEXT`), `Idempotency` marker (`x-idempotency-key`, `x-idempotency-key (7 d)`, `none`), and `Concurrency` marker (`If-Match`, `none`) copied verbatim from `02_Endpoint_Catalogue.md` §3 (`[P: 39]` on `SCR-02` + `[P: 15]` and `[S: 14]` on `SCR-03` — `0` invented routes, permissions, DTO fields, or enum values).
- [x] Counts and lookups use `POST /accounting/accounts/count` and `POST /accounting/accounts/lookup`.
- [x] Bilingual (`AR` / `EN`) labels throughout, logical CSS properties only, Western digits (`ar-EG-u-nu-latn` / `en-US`) and `<IdentifierText>` (`<bdi dir="ltr">`) for all codes, paths, dates, UUIDv7s, hashes, and `DecimalString`s (`Number()` never called).
- [x] Empty, loading, 3-part domain error copy, `403` `PermissionGate`, sensitive-account masking, posted/in-use freeze states, `409` `ConflictDialog`, `AmbiguousOutcomePanel`, `207` partial bulk outcome, `RECOVERY_MODE`, and feature entitlement states specified for both screens.
- [x] Four ASCII mockups (`AR-RTL × Light`, `AR-RTL × Dark`, `EN-LTR × Light`, `EN-LTR × Dark`) + `< 768px` (`375px`) mobile layout behaviour provided for both `SCR-02` and `SCR-03`.
- [x] Every missing DTO field, projection, filter, or scope discrepancy isolated in §3 (`CG-10`, `CG-18`, `CG-DATA-03`, `CG-S2-01`..`CG-S2-12`) for `P03.T11`.

## Contract reconciliation (P03.T11, 1 November 2026)

Reconciles the gaps of this spec against the Endpoint Catalogue and `02_DTOs.md` after `D-770`, `D-771` and `D-772`. The gap list above keeps the original findings; these rulings are final.

| Gap id | Ruling | Where |
| --- | --- | --- |
| `CG-10` | dropped (constraint, not a gap) | The screen already omits count, lookup and export on journals and number sequences; journal pickers use `GET /accounting/journals` (`JournalListQueryDto`, which gained `isActive?`, `D-770`) |
| `CG-18 / CG-WF-01` | closed by D-772 | `POST /accounting/accounts/import` takes `ImportCollectionDto` with `companyId` (the route is `TENANT`), one multipart request with `file` and `body` parts; the commit additionally proves `accounting.account.create` at `TENANT`; file import ships with P17.T06 |
| `CG-DATA-03 / CG-S2-01` | closed by D-770 | `AccountSummaryDto` gains `parentId`, `depth`, `groupId`, `allowManualJournal`, `currencyCode`, `requiresDimensionTypeCodes`; `deprecatedAt` is an `ISODate` |
| `CG-S2-02` | closed by D-770 | `AccountDetailDto` gains `cashFlowCategoryId` and `sensitive` |
| `CG-S2-03 (a)` | already in the contract | `AccountGroupSummaryDto` keeps `parentId` and `depth` (`02_DTOs.md` §13.1 rule 4); the tree builds from them |
| `CG-S2-03 (b)` | deferred to P32 (post-MVP backlog intake, P32.T01) | No `sortOrder` on group create or update; the stage-1 tree orders by code |
| `CG-S2-04 (a)` | closed by D-770 | `AccountRoleSlotDto` (116 items; `source` `COMPANY` \\| `CHART_DEFAULT` \\| `UNRESOLVED`) and `AccountRoleSlotQueryDto { onDate? }` for `GET /accounting/account-roles` |
| `CG-S2-04 (b)` | closed by D-771 | `AssignAccountRoleDto` gains `effectiveFrom` (required) and `effectiveTo?`; the upsert `If-Match` rule is Context §8 item 3 |
| `CG-S2-04 (c)` | dropped (no delete route) | A company override ends with `effectiveTo` (`D-067`, `D-771`); nothing deletes an assignment |
| `CG-S2-05 (a)` | closed by D-771 | `CreateAccountMappingDto.countryCode?`, required for `UNIFORM_EG` and `STATUTORY` |
| `CG-S2-05 (b)` | closed by D-771 | The four `account-mappings` routes and `accounting.account.map` are `COMPANY` scope (Endpoint Catalogue §3) |
| `CG-S2-05 (c)` | closed by D-771 | `AccountMappingListQueryDto` (`accountId?`, `scheme?`, `countryCode?`, `effectiveOn?`) |
| `CG-S2-06 (a)(b)` | closed by D-770 | `AccountMergeSummaryDto` keeps `reason`; `AccountMergeListQueryDto { chartId?, fromAccountId?, intoAccountId? }` |
| `CG-S2-06 (c)` | dropped (hook column, nothing to send) | `MergeAccountsDto` has no `approvalRequestId`; the column is a hook and the client sends nothing |
| `CG-S2-06 (d)` | closed by D-771 | `DeprecateAccountDto { effectiveFrom }` for `POST /accounting/accounts/:id/deprecate` (the route is `TENANT`, so no company calendar can default the date) |
| `CG-S2-07 (a)` | already in the contract | API Blueprint §6: `BulkCreate<E>Dto { items }`, `BulkUpdate<E>Dto { ids, patch }` |
| `CG-S2-07 (b)` | closed by D-771 | `BulkChangePeriodStateDto { targets[{ periodId, module }], toState, reason? }` and `BulkAssignAccountRolesDto { items: AssignAccountRoleDto[] }` |
| `CG-S2-08` | closed by D-770 and D-771 | `FiscalPeriodSummaryDto` gains `code` and `states[].version` (D-770); the `If-Match` target is the module state row, named in the Endpoint Catalogue (D-771) |
| `CG-S2-09` | dropped (no route by design) | No `DELETE /accounting/fiscal-years/:id`; the screen offers no delete action |
| `CG-S2-10 (a)(b)` | closed by D-770 | `UserPeriodOverrideListQueryDto`, `PeriodReopenLogListQueryDto` and `UserPeriodOverrideSummaryDto` (keeps `reason`, derived `active`) |
| `CG-S2-10 (c)` | dropped (not contract) | User display names are composed in the frontend with an `IdentifierText` fallback |
| `CG-S2-11` | closed by D-770 | `NumberSequenceSummaryDto` and `NumberSequenceDetailDto` are declared without `nextValue` |
| `CG-S2-12` | dropped (not contract) | Plan title versus inventory split of `SCR-03` and `SCR-11` is an inventory-only correction, not a contract change |
