# Accounting UX Specification — `SCR-33` Close Checklist, Module Locks & Hard-Close Acknowledgement (`P03.T10.S5`)

> **Lead review, 1 November 2026 (P03.T10).** One reference was corrected: year-end close runs `POST /accounting/fiscal-years/:id/close` (`accounting.close.run_year_end`); `/year-end-closings` is read only. Every route, permission, feature key and scope below was checked against `backend/docs/LLD/accounting-app/02_API_Contracts/02_Endpoint_Catalogue.md`, `04_Static_Data/05_Permissions_and_Features.md` and `10_Feature_Tiers.md`; what the contracts lack stays in the contract gap list for `P03.T11`.

- **Plan Task ID:** `P03.T10.S5`
- **Inventory Row:** `SCR-33` (`frontend/tenant-portal/docs/plans/accounting-screen-inventory.md`)
- **Stage & Slice Classification:** `Slice -> S5` (`P19.T09` Vertical Slice subset · `P27.T05` Stage 5 full completion)
- **Covered Next.js Routes (`accounting-ia.md` §5):**
  1. `#63` `/accounting/close/checklists` (`TENANT_ROUTES.accountingCloseChecklists`) — Close checklist instances list & `Start Close` launcher
  2. `#64` `/accounting/close/checklists/[id]` (`TENANT_ROUTES.accountingCloseChecklistDetail`) — Close checklist execution workspace, sequential module lock strip (`AR` -> `AP` -> `TAX` -> `GL`), task evidence drawer, two-step irreversible hard-close acknowledgement, and `[Stage 5]` accrual supply decisions tab
  3. `#108` `/accounting/setup/close-templates` (`TENANT_ROUTES.accountingSetupCloseTemplates`) — Country-pack & tenant-cloned close templates list
  4. `#109` `/accounting/setup/close-templates/[id]` (`TENANT_ROUTES.accountingSetupCloseTemplateDetail`) — Close template DAG inspector (`[Slice]`) & cloned-template manual-task editor (`[Stage 5]`)
- **Governing Sources Verified:**
  - UX & Design System: `frontend/tenant-portal/docs/design/README.md`, `accounting-ia.md` (`P03.T01`), `accounting-home.md` (`P03.T02` widget `W-10`), `accounting-status-and-a11y.md` (`P03.T03` Group A & Group J), `accounting-patterns-data.md` (`P03.T04`), `accounting-patterns-workflow.md` (`P03.T05`), `accounting-patterns-documents.md` (`P03.T06`), `accounting-stage1-opening-approvals.md` (`SCR-11` boundary), `.agents/skills/ui-ux-pro-max/SKILL.md`, `.agents/skills/frontend-design/SKILL.md`
  - Backend LLD Contracts: `02_API_Contracts/02_Endpoint_Catalogue.md` (§3, §4, §9, §10, §11), `04_Static_Data/01_Enums.md` (§3, §16), `04_Static_Data/02_DTOs.md` (§3, §11, §13.1), `04_Static_Data/04_Errors_and_Constants.md` (§3.3, §3.10, §3.12, §6), `04_Static_Data/05_Permissions_and_Features.md` (§3–§8), `01_ERD/08_Close_and_Reporting_Tables.md` (§1–§3), `05_Flows/08_User_Journey_Month_Close.md` (`CLOSE-01`..`CLOSE-14`), `07_Modules/10_MVP/08_close_and_reporting.md` (`UC-CLR-1`..`UC-CLR-5`, `VAL-CLR-01`..`VAL-CLR-37`), `12_Platform_Changes.md` (§4.10 `RECOVERY_MODE`), `13_Delivery_Plan.md` (§3.6)
- **Last Verified:** `2026-11-01`

---

## 1. Scope, Sibling Boundaries & Delivery Split (`P19.T09` Slice vs `P27.T05` Stage 5)

### 1.1 Architectural Purpose & Sibling Screen Boundaries

`SCR-33` is the **operational close gatekeeper** of the Accounting workspace (`Inbox -> Post -> Reconcile -> Close -> File`). A close checklist **never stores a duplicate copy of accounting facts** (`D-150`): every task queries its canonical module owner (`acc_posting_exceptions`, `acc_authority_documents`, `acc_exception_board_items`, `acc_bank_reconciliation_sessions`, `acc_asset_book_periods`, `acc_deferral_lines`, `acc_fx_revaluation_runs`, `acc_tax_return_periods`, `acc_integrity_check_runs`) and persists only bounded audit evidence (`result` JSON <= `16 KiB`: `checkedAt`, `asOfChainSeq`, `blockingCount`, `blockingRefs[]`, and `unrevaluedDifferences[]` on `LOCK_GL`).

Inside a `NORMAL` fiscal period, `POST /api/tenant/accounting/v1/close-instances/:id/lock` (`CloseTaskService.lockModule`, setting `accounting.close_lock_gate`) is the **only command in the application** permitted to transition `AR`, `AP`, `TAX`, and `GL` in `acc_fiscal_period_states` to `CLOSED` (`D-021`, `D-474`), and setting `hardClosed = true` (`acknowledgeIrreversible: true`) is the **only writer** of `PERMANENTLY_CLOSED` (`trg_acc_close_instances_hard_close_final`).

| Sibling Screen / Surface | Owned Route(s) | Exact Boundary with `SCR-33` |
| --- | --- | --- |
| **`SCR-11` — Fiscal Calendar, Periods & Overrides** (`accounting-stage1-opening-approvals.md`) | `/accounting/close/periods`, `/accounting/setup/fiscal-calendars` | Owns `OPEN <-> SOFT_CLOSED` transitions, `CLOSED -> OPEN` reopens (`PERIOD_REOPEN` approval), and `acc_user_period_overrides` CRUD. `SCR-11` **cannot** transition `AR`/`AP`/`TAX`/`GL` of a `NORMAL` period to `CLOSED` (`409 ACCOUNTING.CLOSE.MODULE_NOT_READY`) or `PERMANENTLY_CLOSED` — it deep-links to `/accounting/close/checklists?periodId=<id>`. Conversely, `SCR-33` reads `periods`, `periods/:id`, and `user-period-overrides` (`[S]`) to display live module states and pre-lock override warnings, and links back to `/accounting/close/periods?periodId=<id>` when a `CLOSED` module must be reopened (`CLOSE-12`). |
| **`SCR-19` — Exception Board** (`accounting-patterns-documents.md`) | `/accounting/inbox/exceptions` | Surfaces `UNPOSTED_DOCUMENT`, `RECEIPT_WITHHELD`, `INBOX_POSITION_LOST`, `SUPPLY_NOT_EVIDENCED`, `REVALUATION_STALE`, and `INTEGRITY_CHECK_FAILED`. `SCR-33` links every `FAILED` task's `blockingRefs[]` directly to its owning screen or `/accounting/inbox/exceptions?kind=<kind>`. In Stage 5 (`P27.T05`), `SUPPLY_NOT_EVIDENCED` items deep-link into `#64` Tab 2 (`/accounting/close/checklists/[id]?tab=supply-decisions&fiscalDocumentId=<id>`), because `SUPPLY_NOT_EVIDENCED` is non-dismissible and clears only when an `ACTIVE` `acc_accrual_supply_decisions` row is recorded (`D-276`). |
| **`SCR-34` — Snapshots, Statutory Exports & Compliance Calendar** | `/accounting/close/snapshots`, `/accounting/close/compliance-calendar`, `/accounting/file/exports` | Reads `acc_compliance_calendar_items` (generated from `EG_*` statutory manual tasks on close templates) and `acc_report_snapshots`. `SCR-33` edits/runs the close tasks themselves and never duplicates report snapshot rendering. |
| **`SCR-32` — Year-End Close** | `/accounting/close/year-end` | Runs `POST /accounting/fiscal-years/:id/close` (`OPENING`, `ADJUSTMENT`, `CLOSING` periods under `accounting.year_close_gate`), which requires every `NORMAL` period of the fiscal year to have already reached `CLOSED` or `PERMANENTLY_CLOSED` through `SCR-33`'s `LOCK_*` tasks (`409 ACCOUNTING.CALENDAR.YEAR_NOT_CLOSABLE`). |
| **`SCR-35` — Bulk Operations** | `/accounting/ops/bulk-operations` | Owns multi-company `POST /accounting/bulk-operations` (`START_CLOSE`, `RUN_CLOSE_TASK` across up to `500` companies, `US-CLR-04`). When `CloseInstanceDetailDto.bulkOperationId` or `CloseTaskDetailDto.bulkOperationId` is non-null, `SCR-33` renders an `<IdentifierText>` chip linking to `/accounting/ops/bulk-operations/[bulkOperationId]`. |
| **`W-10` — Home Close Progress Widget** (`accounting-home.md`) | `/accounting` | Polls `GET /api/tenant/accounting/v1/close-instances?status=IN_PROGRESS&page=1&limit=3` and deep-links to `#63` (`/accounting/close/checklists`) and `#64` (`/accounting/close/checklists/[id]`). |

---

### 1.2 Explicit Delivery Split: Vertical Slice (`P19.T09`) vs Full Stage Completion (`P27.T05`)

Per `13_Delivery_Plan.md` §3.6 (*"close template read, close instance start/list/detail/cancel, task list/run/complete/skip/assign, module lock and hard-close acknowledgement"*), `SCR-33`'s **24 primary `[P]` endpoints** split cleanly into **12 `[P]` endpoints in the Vertical Slice (`P19.T09`)** and **12 `[P]` endpoints in Stage 5 (`P27.T05`)**:

| Route / Capability Surface | Vertical Slice Subset (`P19.T09` — 12 `[P]` Routes) | Full Stage Completion (`P27.T05`, Stage 5 — +12 `[P]` Routes = 24 Total) |
| --- | --- | --- |
| **`#63` `/accounting/close/checklists`** | **LIVE:** List instances (`GET /close-instances`), filter by `periodId` / `closingType` / `status`, launch `Start Close` modal (`POST /close-instances`) selecting a pack template (`GET /close-templates`), optional per-task `assignments[]` override when `GET /close-templates/:id/tasks` becomes available in Stage 5 (in `P19.T09`, `Start Close` submits `{ periodId, closingType, templateId }` using template default `ownerRole` assignments unless tasks are already returned on `CloseTemplateDetailDto`). | **ENHANCED:** Pre-start per-task assignee override table inside `Start Close` drawer backed by `GET /close-templates/:id/tasks`, plus tenant-cloned templates selectable alongside pack templates. |
| **`#64` `/accounting/close/checklists/[id]` — Checklist, Locks & Hard Close** | **LIVE (Core Close Loop):** Instance header (`GET /close-instances/:id` + `ETag`), task DAG table (`GET /close-instances/:id/tasks`), run `SYSTEM_CHECK` & `DEPRECIATION_POSTED`/`DEFERRALS_POSTED` (`POST .../tasks/:taskId/run`), complete `MANUAL` task (`POST .../tasks/:taskId/complete`), skip non-`LOCK` task with mandatory reason (`POST .../tasks/:taskId/skip`), reassign task (`POST .../tasks/:taskId/assign`), sequential module locks `LOCK_AR` -> `LOCK_AP` -> `LOCK_TAX` -> `LOCK_GL` (`POST /close-instances/:id/lock`), two-step irreversible hard-close acknowledgement (`POST /close-instances/:id/lock` with `acknowledgeIrreversible: true`), and cancel instance (`POST /close-instances/:id/cancel`). | **UNCHANGED CORE + TAB 2 LIVE:** Adds **Tab 2 — `قرارات التوريد للاستحقاقات` / `Accrual supply decisions`** (`GET /close/accrual-supply-decisions`, `POST /close/accrual-supply-decisions`, `POST /close/accrual-supply-decisions/:id/void`) so accountants resolve `SUPPLY_NOT_EVIDENCED` (`D-276`) with `NO_SUPPLY_IN_PERIOD` or balanced `MANUAL_ACCRUAL` lines directly inside the close workspace. *(In `P19.T09`, Tab 2 is not mounted; if `NO_PENDING_AUTHORITY_DOCUMENTS` reports `SUPPLY_NOT_EVIDENCED`, the evidence drawer links to `/accounting/inbox/exceptions` and renders a factual Stage-5 boundary note — zero mocked mutations.)* |
| **`#108` `/accounting/setup/close-templates`** | **LIVE (Read-Only Pack Catalogue):** Lists country-pack & base-pack templates (`GET /close-templates`), filters by `closingType` and `packCode`, navigates to `#109`. No `Clone`, `Delete`, or `Restore` buttons rendered. | **FULL CRUD / CLONE:** Adds `نسخ القالب للتخصيص` / `Clone template` (`POST /close-templates` & `POST /close-templates/:id/clone`), soft-delete (`DELETE /close-templates/:id` with `If-Match`), and restore (`POST /close-templates/:id/restore`). |
| **`#109` `/accounting/setup/close-templates/[id]`** | **LIVE (Read-Only Metadata Inspector):** Reads `GET /close-templates/:id` (`ETag`, `code`, `closingType`, `packCode`, `countryCode`, `templateVersion`, `isDefault`, `autoStartOnPeriodEnd`, `effectiveFrom`, `effectiveTo`, `contentHash`). *(Task list table mounts once `GET /close-templates/:id/tasks` lands in `P27.T05`, unless projected inline on `CloseTemplateDetailDto`.)* | **FULL CLONE & MANUAL TASK AUTHORING:** Adds `GET /close-templates/:id/tasks` DAG table, read-only pack banner with `Clone template` CTA (`packCode !== null`), template header update (`PATCH /close-templates/:id` on `packCode === null`), add tenant `MANUAL` task (`POST /close-templates/:id/tasks`), edit task metadata (`PATCH /close-templates/:id/tasks/:taskId`), and delete tenant-added leaf `MANUAL` task (`DELETE /close-templates/:id/tasks/:taskId`). |

---

## 2. Design-System Governance, File Split & Custom Hooks Architecture

### 2.1 Non-Negotiable Tenant Portal Five Laws & `ui-ux-pro-max` Rules

1. **Barrel-Only Design System Imports:** Every component under `src/app/(NavigationGroup)/accounting/**` and `src/features/accounting/close/**` imports UI primitives and patterns **exclusively** from `@/design-system` (`PageHeader`, `DataTable`, `FilterBar`, `StatusBadge`, `Card`, `Tabs`, `Drawer`, `Modal`, `Button`, `Input`, `Textarea`, `Select`, `Checkbox`, `Alert`, `Skeleton`, `EmptyState`, `PermissionGate`, `Tooltip`, `DescriptionList`, `IdentifierText`). Deep imports into `src/design-system/*` are forbidden.
2. **Outcome Hue Discipline (Law 1 & Law 2):**
   - Only the four semantic outcome roles (`brand`, `positive`, `caution`, `negative`) plus the `ink` neutral ramp (`bg-surface`, `bg-surface-muted`, `border-line`, `text-ink`, `text-ink-muted`).
   - **Never colour alone:** Every `CloseInstanceStatus`, `CloseTaskStatus`, `FiscalPeriodState`, `AccrualSupplyDecisionStatus`, and `hardClosed` badge pairs a semantic tone, a Lucide icon (`14px` inline, `strokeWidth={1.75}`), and a localized `t.status.*` string (`accounting-status-and-a11y.md` §1.1 & §1.10).
   - **Pipeline / kind neutrality:** `ClosingType` (`MONTH`, `QUARTER`, `YEAR`), `CloseTaskKind` (`SYSTEM_CHECK`, `SYSTEM_JOB`, `MANUAL`, `LOCK`), and `PeriodModule` (`AR`, `AP`, `TAX`, `GL`) are structural classifications, **never outcomes** — they render strictly in `neutral` (`ink`) chips (`tokens.md`).
3. **Typography, Weights & Single Primary CTA (Law 3):**
   - Font weights restricted to `400` (`font-normal` — mandatory on all `DataTable` body cells), `500` (`font-medium` — labels, tabs, secondary buttons), and `600` (`font-semibold` — section titles, KPI numerals, modal titles). Zero `font-bold`, zero `text-[Npx]`, zero `rounded-xl` or larger.
   - **At most one filled `primary` button per screen, placed in `PageHeader`:**
     - `#63`: `بدء إقفال فترة` / `Start period close` (`variant="primary"`, gated by `accounting.close.start`).
     - `#64`: Single contextual `primary` CTA in `PageHeader` advancing the current close stage:
       - While `status ∈ {NOT_STARTED, IN_PROGRESS}` and the next unlocked module (`AR` -> `AP` -> `TAX` -> `GL`) has zero pending blocking tasks: `قفل وحدة <Module>` / `Lock <Module>` (`accounting.period.close`).
       - When `status === 'COMPLETED' && !hardClosed`: `إقفال نهائي غير قابل للعكس` / `Hard close period` (`accounting.period.close` **AND** `accounting.period.lock`; inside the confirmation modal, the destructive confirm button uses `variant="destructive"` / `negative` semantic styling, never a second `brand` primary button).
       - Otherwise (`IN_PROGRESS` with tasks still blocking next lock, `CANCELLED`, or `hardClosed === true`): **zero** filled `primary` buttons in `PageHeader` (all row actions and header `Refresh` / `Cancel close` use `outline` or `ghost`).
     - `#108`: `P19.T09` renders **zero** filled `primary` buttons; `P27.T05` renders `نسخ قالب إقفال` / `Clone close template` (`variant="primary"`, gated by `accounting.close.configure`).
     - `#109`: `P27.T05` renders `نسخ القالب للتخصيص` / `Clone to customize` (`packCode !== null`, `accounting.close.configure`) **or** `إضافة مهمة يدوية` / `Add manual task` (`packCode === null`, `accounting.close.manage_templates`).
4. **Logical RTL/LTR Properties & Numeric/LTR Islands:**
   - Physical classes (`ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, `right-*`, `text-left`, `text-right`) are banned (`pnpm design:rtl` = `0`). Use `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `text-end`, and directional arrow mirroring (`rtl:rotate-180` on `ArrowRight`/`ChevronRight`).
   - All numerals (`taskDone/taskTotal`, counts, `attempts`, `offsetDays`, `DecimalString` amounts, dates, timestamps) format through `Intl` with Western digits (`ar-EG-u-nu-latn` in Arabic, `en-US` in English) + `tabular-nums`. `DecimalString` values are **never** passed to `Number()`.
   - Task codes (`LOCK_GL`, `NO_UNPOSTED_DOCUMENTS`), template codes (`EG_MONTH_CLOSE`), SHA-256 hashes (`templateContentHash`, `contentHash`), UUIDs, `asOfChainSeq`, and error codes wrap in `<IdentifierText>` (`<bdi dir="ltr" className="font-mono tabular-nums">`).
5. **Zero Role Checks & Strict UUIDv7:**
   - Zero inspection of role names (`accounting_chief_accountant`, etc.) in UI code; every gate evaluates `user.featureEntitlements['accounting.close.checklist']` and `user.permissions`.
   - Every `x-idempotency-key` header and client row key (`accrualLines` editor rows, `assignments` rows) is generated via `generateUUIDv7()` from `@/lib/uuid` (**never** `crypto.randomUUID()`).

### 2.2 File Tree & `< 300` Lines Responsibility Split

Every logic/markup file stays strictly under `300` lines (`file-architecture.md`):

```text
src/
├── app/(NavigationGroup)/accounting/
│   ├── close/checklists/
│   │   ├── page.tsx                                   # Thin route entry (<60 lines) -> CloseChecklistsPageView
│   │   └── [id]/
│   │       └── page.tsx                               # Thin route entry (<60 lines) -> CloseChecklistDetailPageView
│   └── setup/close-templates/
│       ├── page.tsx                                   # Thin route entry (<60 lines) -> CloseTemplatesPageView
│       └── [id]/
│           └── page.tsx                               # Thin route entry (<60 lines) -> CloseTemplateDetailPageView
└── features/accounting/close/
    ├── api/
    │   ├── closeChecklistsApi.ts                      # Typed axiosClient calls + runtime response validators (Slice 12 [P])
    │   ├── closeTemplatesApi.ts                       # Template CRUD/clone/task calls + validators (Slice read + Stage 5 write)
    │   └── accrualSupplyDecisionsApi.ts               # Stage 5 supply-decision list/create/void calls + validators
    ├── types/
    │   └── closeChecklist.types.ts                    # Verbatim DTOs, enums, runtime schema guards, ETag wrapper
    ├── utils/
    │   ├── closeTaskRouting.ts                        # Maps blockingRefs / check codes to canonical deep-link URLs
    │   └── closeLockReadiness.ts                      # Pure DAG & module-lock readiness derivation (AR -> AP -> TAX -> GL)
    ├── hooks/
    │   ├── useCloseChecklistsList.ts                  # List query, URL filter sync, period lookup join (#63)
    │   ├── useStartCloseModal.ts                      # StartCloseDto form state, UUIDv7 idempotency intent, 409 handling (#63)
    │   ├── useCloseChecklistWorkspace.ts              # Instance + tasks + period states + active overrides + ETag sync (#64)
    │   ├── useCloseTaskActions.ts                     # Run / Complete / Skip / Assign mutations + 202 job Location polling (#64)
    │   ├── useModuleLockAndHardClose.ts               # LockModuleDto + two-step Hard Close state, dual-permission & override check (#64)
    │   ├── useCancelCloseInstance.ts                  # Cancel instance ReasonDialog mutation + If-Match (#64)
    │   ├── useAccrualSupplyDecisions.ts               # [Stage 5] Supply decisions list, balanced lines builder, void flow (#64 Tab 2)
    │   ├── useCloseTemplatesList.ts                   # Templates list query, Clone/Delete/Restore mutations (#108)
    │   └── useCloseTemplateDetail.ts                  # Template + DAG tasks query, header PATCH, manual task add/edit/delete (#109)
    └── components/
        ├── CloseChecklistsPageView.tsx                # #63 pure view: PageHeader, KPI strip, FilterBar, DataTable
        ├── StartCloseDrawer.tsx                       # #63 pure view: Period, ClosingType, Template & assignments[] form
        ├── CloseChecklistDetailPageView.tsx           # #64 pure view: DetailHeader, ModuleLockStrip, Tabs shell
        ├── PeriodModuleLockStrip.tsx                  # #64 pure view: 4-card sequential lock bar (AR, AP, TAX, GL) + overrides alert
        ├── CloseChecklistTaskTable.tsx                # #64 pure view: Dependency-aware task DataTable + filter chips
        ├── CloseTaskEvidenceDrawer.tsx                # #64 pure view: Task result JSON evidence, unrevaluedDifferences[], run/complete/skip/assign forms
        ├── LockModuleModal.tsx                        # #64 pure view: Module lock confirmation + LOCK_GL integrity status panel
        ├── HardCloseIrreversibleModal.tsx             # #64 pure view: Two-step permanent lock modal with override & auto-skip summary
        ├── AccrualSupplyDecisionsTab.tsx              # #64 [Stage 5] pure view: Supply decisions table + DecideAccrualSupplyDrawer
        ├── CloseTemplatesPageView.tsx                 # #108 pure view: Pack vs Tenant templates table + Clone modal
        ├── CloseTemplateDetailPageView.tsx            # #109 pure view: Template metadata card + DAG tasks table + read-only pack banner
        └── CloseTemplateTaskDrawer.tsx                # #109 [Stage 5] pure view: Add/Edit MANUAL task form (code/kind/dependsOn locked on edit)
```

---

## 3. Verbatim Endpoint & Action Catalogue Mapping (`24` `[P]` + `8` `[S]` Routes)

Every browser call routes through `/api/tenant/accounting/v1/<path>` via `axiosClient` (`credentials: "include"`), attaching `x-mutakamel-company-id` from `AccountingScopeBar`. All `[P]` routes below carry **`Feature key` = `accounting.close.checklist`** and **`Scope target` = `COMPANY`** (`02_Endpoint_Catalogue.md` §10, lines 967–990).

### 3.1 Vertical Slice Primary `[P]` Routes (`P19.T09` — 12 Routes)

| # | Screen | UI Action / Trigger | Method & Verbatim Browser Gateway Path | Permission(s) (`ALL` unless noted) | Feature Key | Scope | Idempotency | Concurrency | Status & Response |
| :-: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `P-01` | `#108`, `#63` | Load close templates list / template picker in `Start Close` | `GET /api/tenant/accounting/v1/close-templates` | `accounting.close.read` | `accounting.close.checklist` | `COMPANY` | `none` | `none` | `200` `PaginatedData<CloseTemplateSummaryDto>` |
| `P-02` | `#109` | Load single close template detail | `GET /api/tenant/accounting/v1/close-templates/:id` | `accounting.close.read` | `accounting.close.checklist` | `COMPANY` | `none` | `none` | `200` `CloseTemplateDetailDto` + `ETag` |
| `P-03` | `#63` | Load close checklist instances list | `GET /api/tenant/accounting/v1/close-instances` | `accounting.close.read` | `accounting.close.checklist` | `COMPANY` | `none` | `none` | `200` `PaginatedData<CloseInstanceSummaryDto>` |
| `P-04` | `#64` | Load close checklist instance header & progress | `GET /api/tenant/accounting/v1/close-instances/:id` | `accounting.close.read` | `accounting.close.checklist` | `COMPANY` | `none` | `none` | `200` `CloseInstanceDetailDto` + `ETag` |
| `P-05` | `#64` | Load instantiated checklist tasks (`seq` / DAG) | `GET /api/tenant/accounting/v1/close-instances/:id/tasks` | `accounting.close.read` | `accounting.close.checklist` | `COMPANY` | `none` | `none` | `200` `PaginatedData<CloseTaskDetailDto>` |
| `P-06` | `#63` | Submit `Start Period Close` drawer | `POST /api/tenant/accounting/v1/close-instances` | `accounting.close.start` | `accounting.close.checklist` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `none` | `201` `CloseInstanceDetailDto` + `Location` |
| `P-07` | `#64` | Click `تشغيل الفحص` / `Run check` (`SYSTEM_CHECK`) or `تشغيل الدفعة` / `Run job` (`DEPRECIATION_POSTED`, `DEFERRALS_POSTED`) | `POST /api/tenant/accounting/v1/close-instances/:id/tasks/:taskId/run` | `accounting.close.complete_task` **+** (`accounting.asset.run_depreciation` on `DEPRECIATION_POSTED`; `accounting.deferral.run` on `DEFERRALS_POSTED` — `D-660`) | `accounting.close.checklist` *(+ `accounting.assets.core` or `accounting.schedules.deferrals` when running those jobs)* | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` *(task `version`)* | `200` `CloseTaskDetailDto` (`SYSTEM_CHECK` pass) · `422` (`SYSTEM_CHECK` fail, committed) · `202` + `Location` + `CloseTaskDetailDto` (`SYSTEM_JOB` started) |
| `P-08` | `#64` | Submit `إنجاز المهمة` / `Complete task` (`MANUAL` task only) | `POST /api/tenant/accounting/v1/close-instances/:id/tasks/:taskId/complete` | `accounting.close.complete_task` | `accounting.close.checklist` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` *(task `version`)* | `200` `CloseTaskDetailDto` |
| `P-09` | `#64` | Submit `تخطّي المهمة` / `Skip task` `ReasonDialog` (non-`LOCK` task) | `POST /api/tenant/accounting/v1/close-instances/:id/tasks/:taskId/skip` | `accounting.close.complete_task` | `accounting.close.checklist` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` *(task `version`)* | `200` `CloseTaskDetailDto` |
| `P-10` | `#64` | Submit `تعيين مسؤول` / `Assign owner` drawer | `POST /api/tenant/accounting/v1/close-instances/:id/tasks/:taskId/assign` | `accounting.close.complete_task` | `accounting.close.checklist` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` *(task `version`)* | `200` `CloseTaskDetailDto` |
| `P-11` | `#64` | Submit `قفل الوحدة` / `Lock module` (`toState: 'CLOSED'`) **OR** two-step `إقفال نهائي` / `Hard close` (`acknowledgeIrreversible: true`, `toState: 'PERMANENTLY_CLOSED'`) | `POST /api/tenant/accounting/v1/close-instances/:id/lock` | Module lock: `accounting.period.close`<br>Hard close: `accounting.period.close` **AND** `accounting.period.lock` (`UC-CLR-5`) | `accounting.close.checklist` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` *(instance `ETag` / `version`)* | `200` `CloseInstanceDetailDto` |
| `P-12` | `#64` | Submit `إلغاء الإقفال` / `Cancel close` `ReasonDialog` (`NOT_STARTED` or `IN_PROGRESS` only) | `POST /api/tenant/accounting/v1/close-instances/:id/cancel` | `accounting.close.start` | `accounting.close.checklist` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` *(instance `ETag` / `version`)* | `200` `CloseInstanceDetailDto` |

### 3.2 Full-Stage Completion Primary `[P]` Routes (`P27.T05`, Stage 5 — +12 Routes)

| # | Screen | UI Action / Trigger | Method & Verbatim Browser Gateway Path | Permission(s) | Feature Key | Scope | Idempotency | Concurrency | Status & Response |
| :-: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `P-13` | `#108` | Create close template from pack (`sourceTemplateId`) | `POST /api/tenant/accounting/v1/close-templates` | `accounting.close.configure` | `accounting.close.checklist` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `none` | `201` `CloseTemplateDetailDto` + `Location` |
| `P-14` | `#109` | Save edited tenant template header (`packCode === null`) | `PATCH /api/tenant/accounting/v1/close-templates/:id` | `accounting.close.manage_templates` | `accounting.close.checklist` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` *(template `ETag`)* | `200` `CloseTemplateDetailDto` + `ETag` |
| `P-15` | `#108`, `#109` | Soft-delete unused tenant template (`packCode === null`) | `DELETE /api/tenant/accounting/v1/close-templates/:id` | `accounting.close.manage_templates` | `accounting.close.checklist` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` *(template `ETag`)* | `204` Empty body |
| `P-16` | `#108`, `#109` | Restore soft-deleted tenant template | `POST /api/tenant/accounting/v1/close-templates/:id/restore` | `accounting.close.manage_templates` | `accounting.close.checklist` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `none` | `200` `CloseTemplateDetailDto` |
| `P-17` | `#108`, `#109` | Click `نسخ القالب للتخصيص` / `Clone template` on pack row | `POST /api/tenant/accounting/v1/close-templates/:id/clone` | `accounting.close.configure` | `accounting.close.checklist` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `none` | `201` `CloseTemplateDetailDto` + `Location` |
| `P-18` | `#109`, `#63` | Load template DAG tasks table (and `Start Close` assignment preview) | `GET /api/tenant/accounting/v1/close-templates/:id/tasks` | `accounting.close.read` | `accounting.close.checklist` | `COMPANY` | `none` | `none` | `200` `PaginatedData<CloseTemplateTaskDetailDto>` |
| `P-19` | `#109` | Add tenant `MANUAL` task to cloned template | `POST /api/tenant/accounting/v1/close-templates/:id/tasks` | `accounting.close.manage_templates` | `accounting.close.checklist` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` *(template `ETag`)* | `201` `CloseTemplateTaskDetailDto` |
| `P-20` | `#109` | Edit mutable fields of task on cloned template | `PATCH /api/tenant/accounting/v1/close-templates/:id/tasks/:taskId` | `accounting.close.manage_templates` | `accounting.close.checklist` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` *(template `ETag`)* | `200` `CloseTemplateTaskDetailDto` |
| `P-21` | `#109` | Delete tenant-added leaf `MANUAL` task (`clonedFromTaskId === null`) | `DELETE /api/tenant/accounting/v1/close-templates/:id/tasks/:taskId` | `accounting.close.manage_templates` | `accounting.close.checklist` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` *(template `ETag`)* | `204` Empty body |
| `P-22` | `#64` Tab 2 | Load accrual supply decisions for closing period | `GET /api/tenant/accounting/v1/close/accrual-supply-decisions` | `accounting.close.read` | `accounting.close.checklist` | `COMPANY` | `none` | `none` | `200` `PaginatedData<AccrualSupplyDecisionDto>` |
| `P-23` | `#64` Tab 2 | Record `NO_SUPPLY_IN_PERIOD` or `MANUAL_ACCRUAL` decision | `POST /api/tenant/accounting/v1/close/accrual-supply-decisions` | `accounting.close.complete_task` | `accounting.close.checklist` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `none` | `201` `AccrualSupplyDecisionDto` + `Location` |
| `P-24` | `#64` Tab 2 | Void active supply decision (`GL` still open) | `POST /api/tenant/accounting/v1/close/accrual-supply-decisions/:id/void` | `accounting.close.complete_task` | `accounting.close.checklist` | `COMPANY` | `x-idempotency-key` (UUIDv7) | `If-Match` *(decision `version`)* | `200` `AccrualSupplyDecisionDto` |

### 3.3 Shared `[S]` Context, Verification & Polling Routes Consumed by `SCR-33`

| # | Used On | Purpose in `SCR-33` | Method & Verbatim Browser Gateway Path | Permission | Feature Key | Scope | Idempotency / Concurrency |
| :-: | --- | --- | --- | --- | --- | --- | --- |
| `S-01` | `#63` | Populate period filter & `Start Close` period selector (`NORMAL` / `ADJUSTMENT` periods) | `GET /api/tenant/accounting/v1/periods` | `accounting.period.read` | `accounting.ledger.core` | `COMPANY` | `none` / `none` |
| `S-02` | `#64` | Read live `states[]` (`AR`, `AP`, `TAX`, `GL` `FiscalPeriodState`) for `PeriodModuleLockStrip` | `GET /api/tenant/accounting/v1/periods/:id` | `accounting.period.read` | `accounting.ledger.core` | `COMPANY` | `none` / `none` |
| `S-03` | `#64` | List live `acc_user_period_overrides` grants on the closing period before `Lock` & `Hard Close` (`D-193`, `UC-CLR-5`) | `GET /api/tenant/accounting/v1/user-period-overrides?periodId=<id>` | `accounting.period.read` | `accounting.ledger.core` | `COMPANY` | `none` / `none` |
| `S-04` | `#64` | Inspect latest integrity verdicts & freshness for `LOCK_GL` (`D-667`) and poll auto-started integrity run | `GET /api/tenant/accounting/v1/integrity-checks/latest` | `accounting.report.read` | `accounting.ledger.core` | `COMPANY` | `none` / `none` |
| `S-05` | `#64` | Trigger on-demand integrity check run when operator repairs a `FAILED` integrity monitor before `LOCK_GL` | `POST /api/tenant/accounting/v1/integrity-checks/run` | `accounting.report.run` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` / `none` (`202` + `Location`) |
| `S-06` | `#64` | Poll `202` `Location` returned when `DEPRECIATION_POSTED` task `run` starts a depreciation run | `GET /api/tenant/accounting/v1/depreciation-runs/:id` | `accounting.asset.read` | `accounting.assets.core` | `COMPANY` | `none` / `none` |
| `S-07` | `#64` | Poll `202` `Location` returned when `DEFERRALS_POSTED` task `run` starts a deferral recognition run | `GET /api/tenant/accounting/v1/deferral-runs/:id` | `accounting.deferral.read` | `accounting.schedules.deferrals` | `COMPANY` | `none` / `none` |
| `S-08` | `#64` Tab 2 | Resolve candidate `SUPPLY_NOT_EVIDENCED` items & inspect fiscal document header in `[Stage 5]` | `GET /api/tenant/accounting/v1/exception-board?kind=SUPPLY_NOT_EVIDENCED` & `GET /api/tenant/accounting/v1/fiscal-documents/:id` | `accounting.exception_board.read` / `accounting.fiscal_document.read` | `accounting.ledger.core` / `accounting.tax.engine` | `COMPANY_OR_BRANCH` | `none` / `none` |

---

## 4. Screen-by-Screen UX, Layout & Verbatim DTO Field Mappings

> **ERD Projection Rule (`02_DTOs.md` §13.1):** Where `02_DTOs.md` §11/§13 does not write a standalone interface (`CloseTemplateSummaryDto`, `CloseTemplateDetailDto`, `CloseTemplateTaskDetailDto`, `CloseInstanceSummaryDto`, `CloseInstanceDetailDto`, `CloseTaskSummaryDto`), the response DTO projects the camelCase columns of its owning table in `08_Close_and_Reporting_Tables.md` §3 (`id`, `version`, `createdAt`, `updatedAt`, plus entity columns; `deletedAt` omitted on live summaries). Zero fields outside those exact columns and declared §13 interfaces are assumed.

### 4.1 Screen `#63` — Close Checklists List (`/accounting/close/checklists`)

#### A. Layout Structure
1. **`PageHeader`:**
   - Breadcrumb: `المحاسبة` / `Accounting` -> `الإقفال` / `Close` -> `قوائم إقفال الفترات` / `Close checklists`.
   - Title (`text-lg font-semibold`): `قوائم إقفال الفترات` / `Period close checklists`.
   - Actions:
     - `outline` `القوالب` / `Templates` (`Link` to `/accounting/setup/close-templates`, visible when `accounting.close.read` held).
     - `outline` `تحديث` / `Refresh` (`RefreshCw`).
     - Single `primary` CTA: `بدء إقفال فترة` / `Start period close` (opens `StartCloseDrawer`; enabled when `hasPermission('accounting.close.start') && !isRecoveryMode`, else shown & disabled with one-line permission/recovery reason per `accounting-ia.md` §3 Rule 5).
2. **Compact Summary Strip (`3` `Card` tiles, `grid-cols-1 sm:grid-cols-3 gap-3`):**
   - Tile 1: `قيد التنفيذ` / `In progress` — count from `meta.total` of `status=IN_PROGRESS` query (`caution` accent icon `Clock` when `> 0`, `ink` when `0`).
   - Tile 2: `بانتظار الإقفال النهائي` / `Completed (soft/module-locked, awaiting hard close)` — count of loaded/queried `COMPLETED` rows with `hardClosed === false` (`positive` icon `CheckCircle2`).
   - Tile 3: `مقفلة نهائياً` / `Permanently hard-closed` — count of `hardClosed === true` rows (`LockKeyhole` icon).
3. **`FilterBar` (URL-synced `?periodId=&closingType=&status=&page=&limit=`):**

| Filter Control | Query DTO (`CloseInstanceListQueryDto`, `02_DTOs.md` §11.1) | Wire Type & Allowed Values | Default |
| --- | --- | --- | --- |
| Fiscal Period selector | `periodId` | `UUID` (populated from `GET /periods`; displays `periodCode` + `startDate..endDate`) | `undefined` (`All periods`) |
| Closing Type select | `closingType` | `ClosingType`: `'MONTH' \| 'QUARTER' \| 'YEAR'` | `undefined` (`All types`) |
| Instance Status chips | `status` | `CloseInstanceStatus`: `'NOT_STARTED' \| 'IN_PROGRESS' \| 'COMPLETED' \| 'CANCELLED'` | `undefined` (`All`) |
| Sort & Pagination | `page`, `limit`, `sortBy`, `sortOrder` (`FindManyDto`) | `page >= 1`, `limit <= 100` (`default 25`), `sortBy = 'keyDate'`, `sortOrder = 'DESC'` | `page=1&limit=25` |

4. **`DataTable` Columns (`CloseInstanceSummaryDto` — `acc_close_instances` camelCase projection):**

| Column (`AR` / `EN`) | DTO Member(s) (`CloseInstanceSummaryDto` + joined `PeriodDto`) | Rendering & Alignment |
| --- | --- | --- |
| `الفترة المحاسبية` / `Fiscal period` | `periodId` (joined client-side with `GET /periods` cache -> `period.code`, `period.startDate`, `period.endDate`) + `keyDate` | `Link` (`font-normal text-ink hover:underline`) to `/accounting/close/checklists/[id]`; subline `<IdentifierText>{keyDate}</IdentifierText>` |
| `نوع الإقفال` / `Closing type` | `closingType` (`ClosingType`) | Neutral `ink` badge via `t.enums.ClosingType[closingType]` (`شهري` / `Monthly`, `ربع سنوي` / `Quarterly`, `سنوي` / `Yearly`) |
| `الحالة` / `Status` | `status` (`CloseInstanceStatus`) + `hardClosed` (`boolean`) | `StatusBadge` (`accounting-status-and-a11y.md` Group J): `NOT_STARTED` (`neutral`, `CircleDashed`), `IN_PROGRESS` (`caution`, `Loader2`), `COMPLETED` (`positive`, `CheckCircle2`), `CANCELLED` (`neutral` muted, `Ban`). When `hardClosed === true`, appends inline `LockKeyhole` modifier pill `مقفل نهائياً` / `Hard-closed` |
| `التقدّم` / `Progress` | `taskDone` (`number`), `taskTotal` (`number`) | Compact progress bar (`h-1.5 w-20 bg-surface-muted`) + `<span className="tabular-nums">{taskDone} / {taskTotal}</span>` |
| `المهمة الحاجزة الحالية` / `Blocking task` | `blockingTaskCode` (`string \| null`) | When non-null: localized task title + `<IdentifierText>{blockingTaskCode}</IdentifierText>` chip; when `null`: `—` |
| `تاريخ البدء / الإتمام` / `Started / Completed` | `startedAt` (`ISODateTime \| null`), `completedAt` (`ISODateTime \| null`), `hardClosedAt` (`ISODateTime \| null`) | Formatted in company timezone (`Intl.DateTimeFormat`, `tabular-nums`) |
| `إجراء` / `Action` | `id` | `outline` `size="sm"` `فتح مساحة الإقفال` / `Open workspace` -> `/accounting/close/checklists/[id]` |

5. **`StartCloseDrawer` (`POST /api/tenant/accounting/v1/close-instances` — `StartCloseDto`, `02_DTOs.md` §11.2 lines 3251–3256):**

| Form Field (`AR` / `EN`) | `StartCloseDto` Property | Validation & Behaviour |
| --- | --- | --- |
| `الفترة المحاسبية` / `Fiscal period` *(required)* | `periodId: UUID` | Select from `GET /periods` (`NORMAL` periods for `MONTH`/`QUARTER`, closing fiscal period for `YEAR`); pre-selected when `?periodId=` URL param is present (e.g., deep-link from `SCR-11`). Warns inline if an active (`NOT_STARTED`/`IN_PROGRESS`/`COMPLETED`) instance already exists for `(periodId, closingType)` (`409 ACCOUNTING.CLOSE.INSTANCE_OPEN`). |
| `نوع الإقفال` / `Closing type` *(required)* | `closingType: ClosingType` | Radio/segmented control: `MONTH`, `QUARTER`, `YEAR` (defaults to `MONTH`). Filtering `templateId` options automatically by `closingType`. |
| `قالب قائمة الإقفال` / `Close template` *(optional)* | `templateId?: UUID` | Select from `GET /close-templates?closingType=<closingType>`. Pre-selects the row with `isDefault === true` (company default overrides pack default per `D-172`); omitting sends `undefined` so server resolves default (`VAL-CLR-01`). Displays `packCode` / `templateVersion` badge. |
| `تخصيص المسؤولين عن المهام` / `Task owner overrides` *(optional, collapsible — `[Stage 5]` when `GET /close-templates/:id/tasks` is live)* | `assignments?: Array<{ taskCode: string; assigneeUserId: UUID }>` | Lists template tasks (`code`, `nameI18n`, default `ownerRole`) and lets the starter pick a specific tenant user UUID (`assigneeUserId`; see `CG-CLR-08`) for any subset of tasks. Unchanged rows are omitted from `assignments[]`. |

---

### 4.2 Screen `#64` — Close Checklist Workspace (`/accounting/close/checklists/[id]`)

#### A. Workspace Anatomy (`CloseChecklistDetailPageView`)
1. **Top `DetailHeader` (`CloseInstanceDetailDto` — `acc_close_instances` projection + `ETag`):**
   - **Title row:** Fiscal period `nameI18n` / `code` (`<IdentifierText>2026-03</IdentifierText>`) · `ClosingType` chip · `CloseInstanceStatus` `StatusBadge` · when `hardClosed === true`, prominent `LockKeyhole` permanent seal badge (`مقفل نهائياً — غير قابل للعكس` / `Permanently hard-closed — irreversible`).
   - **Metadata bar (`DescriptionList` compact 5-cell strip):**
     - `تاريخ الأساس` / `Key date`: `keyDate` (`LocalDate`, `tabular-nums`)
     - `تقدّم المهام` / `Tasks completed`: `taskDone / taskTotal` (`tabular-nums`) + percentage
     - `المهمة الحاجزة` / `Blocking task`: `blockingTaskCode` (clickable button scrolling/filtering to that task row) or `لا يوجد` / `None`
     - `بصمة القالب المثبّتة` / `Pinned template hash`: `<IdentifierText>{templateContentHash.slice(0, 12)}…</IdentifierText>` with copy button (`contentHash` immutability proof, `D-069`)
     - `عملية جماعية` / `Bulk operation` *(shown iff `bulkOperationId !== null`)*: `<IdentifierText>` link to `/accounting/ops/bulk-operations/[bulkOperationId]`
   - **Audit banner when `status === 'CANCELLED'`:** Neutral `Alert` showing `cancelledReason` and `updatedAt`.
   - **Audit banner when `hardClosed === true`:** Neutral-locked `Alert` (`LockKeyhole`) showing `hardClosedAt`, `hardClosedBy` (`<IdentifierText>` / user display), and `hardCloseReason`. All mutating buttons across the entire page are hidden/omitted because `trg_acc_close_instances_hard_close_final` rejects every write with `409 ACCOUNTING.CLOSE.HARD_CLOSED`.
   - **`PageHeader` Actions (Law 3 — at most ONE `primary` button):**
     - `outline` `تحديث` / `Refresh` (`RefreshCw`, re-fetches instance + tasks + period states + overrides concurrently).
     - `outline` `إلغاء الإقفال` / `Cancel close` — rendered only when `status ∈ {'NOT_STARTED', 'IN_PROGRESS'} && !hardClosed`; enabled when `hasPermission('accounting.close.start') && !isRecoveryMode` (opens `ReasonDialog` -> `POST /close-instances/:id/cancel` with `If-Match` and `CancelCloseInstanceDto { reason }`, `10..500` chars to fit `cancelled_reason varchar(500)`, `D-772`). Note: if any `LOCK_*` task already closed a module before cancellation, the dialog warns factually that cancelling the checklist releases the instance slot (`uq_acc_close_instances_company_period_type_live`) while already-closed period modules stay `CLOSED` until reopened on `/accounting/close/periods`.
     - **Contextual `primary` CTA (mutually exclusive):**
       1. When `status ∈ {'NOT_STARTED', 'IN_PROGRESS'}` and the earliest unlocked module in sequence `['AR', 'AP', 'TAX', 'GL']` has its `LOCK_<module>` task in `PENDING` (all `dependsOn` and `blocksLock` tasks satisfied): **`قفل وحدة <Module>` / `Lock <Module>`** -> opens `LockModuleModal`. Enabled iff `hasPermission('accounting.period.close') && !isRecoveryMode`.
       2. When `status === 'COMPLETED' && !hardClosed`: **`إقفال نهائي للفترة` / `Hard close period`** -> opens `HardCloseIrreversibleModal`. Enabled iff `hasPermission('accounting.period.close') && hasPermission('accounting.period.lock') && !isRecoveryMode` (if only one of the two permissions is held, button is shown & disabled naming the missing permission key).

2. **Sequential Period Module Lock Strip (`PeriodModuleLockStrip` — always visible above Tabs):**
   - Renders `4` connected horizontal cards in closing sequence (`1. AR` -> `2. AP` -> `3. TAX` -> `4. GL`; arrow icons mirror in RTL via `rtl:rotate-180`).
   - Each card combines:
     - **Module code & localized name:** `ذمم العملاء (AR)` / `Receivables (AR)`, `ذمم الموردين (AP)` / `Payables (AP)`, `الضرائب (TAX)` / `Tax (TAX)`, `الأستاذ العام (GL)` / `General Ledger (GL)`.
     - **Live `FiscalPeriodState` badge** from `GET /periods/:periodId` (`states[]`): `OPEN` (`neutral`), `SOFT_CLOSED` (`caution`), `CLOSED` (`positive`, `Lock`), `PERMANENTLY_CLOSED` (`positive` + `LockKeyhole`).
     - **Gate readiness counter:** Derived from `CloseTaskDetailDto[]` (`LOCK_<module>` task `status`, `dependsOn` satisfaction, and count of incomplete tasks where `task.module === module && task.blocksLock === true`).
     - **Card footer action:**
       - If module state is `OPEN` or `SOFT_CLOSED` and `LOCK_<module>` is ready: `outline` `قفل <Module>` / `Lock <Module>` (or matches header `primary` CTA).
       - If blocked: `تصفية المهام الحاجزة (N)` / `Filter blocking (N)` ghost link filtering the task table below.
       - If `CLOSED` and `!hardClosed`: link `إدارة إعادة الفتح ↗` / `Manage reopen ↗` -> `/accounting/close/periods?periodId=<periodId>&module=<module>` (`CLOSE-12`).
   - **Active Period Overrides Warning Strip (`D-193`):**
     - Queries `GET /api/tenant/accounting/v1/user-period-overrides?periodId=<periodId>`. Whenever one or more live grants (`revokedAt === null && expiresAt > now`) exist for the period, renders a `caution` `Alert` directly beneath the 4 module cards listing the count, covered `module`, `userId`, and `expiresAt`, explaining: *"تظل استثناءات الترحيل سارية فقط أثناء الإقفال المبدئي (SOFT_CLOSED)، وتتوقف تلقائياً فور قفل الوحدة (CLOSED)، وتُلغى نهائياً عند الإقفال النهائي."* / *"User period overrides apply only while a module is SOFT_CLOSED, cease taking effect once CLOSED, and are permanently revoked on Hard Close."*

3. **Workspace Tabs:**
   - **Tab 1 (`tasks` — `[Vertical Slice P19.T09]`):** `مهام قائمة الإقفال (taskDone/taskTotal)` / `Checklist tasks (taskDone/taskTotal)`
   - **Tab 2 (`supply-decisions` — `[Stage 5 P27.T05]`):** `قرارات التوريد للاستحقاقات` / `Accrual supply decisions` *(displays count badge when `NO_PENDING_AUTHORITY_DOCUMENTS` or `SUPPLY_NOT_EVIDENCED` reports undecided documents)*

---

#### B. Tab 1 — Checklist Tasks Table & Task Evidence Drawer (`CloseTaskDetailDto`, `02_DTOs.md` §13 lines 4227–4244 + `acc_close_tasks` §13.1)

1. **Task Filter Bar (`CloseTaskListQueryDto`, `02_DTOs.md` §11.1):**
   - `status?: CloseTaskStatus` (`All`, `PENDING`, `BLOCKED`, `RUNNING`, `FAILED`, `DONE`, `SKIPPED`, `NOT_APPLICABLE`)
   - `assigneeUserId?: UUID` (`All`, `Assigned to me` = `currentUser.id`)
   - `dueBefore?: ISODateTime` (`Overdue now` quick chip setting `dueBefore = new Date().toISOString()`)
   - Client-side module quick-filter chip (`All`, `AR`, `AP`, `TAX`, `GL`, `Cross-module (—)`).

2. **Task `DataTable` Columns (sorted by `seq ASC`):**

| Column (`AR` / `EN`) | DTO Member (`CloseTaskDetailDto` / `acc_close_tasks`) | Rendering & Interaction Rules |
| --- | --- | --- |
| `#` (`seq`) | `seq: number` | `font-normal tabular-nums text-ink-muted` (`1..100`) |
| `المهمة والاعتماديات` / `Task & dependencies` | `code: string`, `nameI18n` *(from joined template/pack catalogue or task projection)*, `dependsOn: string[]`, `isMandatory: boolean`, `blocksLock: boolean` | Localized task title + `<IdentifierText>{code}</IdentifierText>`. Subline renders `dependsOn[]` chips (green check when dependency is `DONE`/`SKIPPED`/`NOT_APPLICABLE`, muted lock when unmet) + `إلزامية` / `Mandatory` or `اختيارية` / `Optional` tag + `تحجز القفل` / `Blocks lock` indicator |
| `النوع والوحدة` / `Kind & module` | `kind: CloseTaskKind`, `module: PeriodModule \| null` | Two neutral `ink` badges: `t.enums.CloseTaskKind[kind]` (`فحص آلي` / `System check`, `دفعة آلية` / `System job`, `يدوية` / `Manual`, `قفل وحدة` / `Module lock`) + `module ? t.enums.PeriodModule[module] : t.close.crossModule` |
| `المسؤول` / `Assignee` | `assigneeUserId: UUID \| null`, `ownerRole: string` | User display name (or `<IdentifierText>` short UUID, `CG-CLR-08`) + subline role key `<IdentifierText>{ownerRole}</IdentifierText>`. `ghost` edit icon opens `Assign` drawer when `!hardClosed && status ∉ {'DONE','NOT_APPLICABLE'}` |
| `الموعد النهائي` / `Due deadline` | `dueAt: ISODateTime` | Formatted in **company timezone** (`acc_company_profiles.timezone`, `D-073`), `tabular-nums`. Shows `caution`/`negative` `AlertTriangle` overdue tag when `now > dueAt && status ∉ {'DONE','SKIPPED','NOT_APPLICABLE'}` |
| `الحالة والمحاولات` / `Status & attempts` | `status: CloseTaskStatus`, `attempts: number`, `errorCode: string \| null` | `StatusBadge` (`accounting-status-and-a11y.md` Group J):<br>• `PENDING` (`neutral`, `Clock`)<br>• `BLOCKED` (`caution`, `Lock`)<br>• `RUNNING` (`caution`, `Loader2` spin)<br>• `DONE` (`positive`, `CheckCircle2`)<br>• `FAILED` (`negative`, `XCircle` + `<IdentifierText>{errorCode}</IdentifierText>`)<br>• `SKIPPED` (`neutral`, `SkipForward`)<br>• `NOT_APPLICABLE` (`neutral`, `MinusCircle` — system verdict only, `D-224`)<br>Subline: `attempts` (`tabular-nums`) |
| `الإجراء` / `Action` | Contextual per `(kind, status)` | All row buttons use `variant="outline"` or `variant="ghost"`, `size="sm"` (respecting Law 3):<br>• **`SYSTEM_CHECK` (`PENDING` \| `FAILED` \| `DONE` re-check while module open):** `تشغيل الفحص` / `Run check` (`POST .../tasks/:taskId/run`).<br>• **`SYSTEM_JOB` (`code ∈ {'DEPRECIATION_POSTED','DEFERRALS_POSTED'}`, `PENDING` \| `FAILED`):** `تشغيل الدفعة` / `Run job` (`POST .../tasks/:taskId/run`; requires companion asset/deferral run permission).<br>• **`SYSTEM_JOB` (other codes: `UNBILLED_REVENUE_ACCRUED`, `ACCRUALS_REVERSED`, `FX_REVALUATION_POSTED`):** `فتح شاشة التشغيل ↗` / `Open batch runner ↗` (`POST .../run` refuses these with `403 SYSTEM_TASK_MANUAL` per `D-660`; links to FX Revaluation / Recurring / Close batch monitor).<br>• **`MANUAL` (`PENDING` \| `FAILED`):** `إنجاز` / `Complete` (`POST .../complete`) + `تخطّي` / `Skip` (`POST .../skip`).<br>• **`LOCK` (`PENDING`):** `قفل الوحدة…` / `Lock module…` (opens `LockModuleModal` -> `POST /close-instances/:id/lock`). **Never** shows `Complete`, `Run`, or `Skip` (`D-474`).<br>• **Any row:** `التفاصيل والأدلة` / `Evidence` (`ghost` button opening `CloseTaskEvidenceDrawer`). |

3. **`CloseTaskEvidenceDrawer` (`480px` logical end slide-over):**
   - **Header:** Task localized name, `<IdentifierText>{code}</IdentifierText>`, `CloseTaskStatus` badge, `version` (`ETag`/`If-Match` source), `lastRunAt`, `completedAt`, `completedBy`.
   - **Section 1 — Execution Evidence (`result: Record<string, unknown>` <= `16 KiB` & `resultRef: string | null`):**
     - Renders `checkedAt` (timestamp), `asOfChainSeq` (`<IdentifierText>`), and `blockingCount` (`tabular-nums`).
     - When `status === 'NOT_APPLICABLE'` (e.g., `TAX_RETURN_FILED` in a non-filing month, `D-224`): displays `result.reason` (`NO_RETURN_PERIOD_ENDS_IN_PERIOD`) and `result.evaluatedDefinitionCodes[]` as neutral informational chips.
     - When `status === 'FAILED'`: displays `errorCode` (`<IdentifierText>`) and maps every entry in `result.blockingRefs[]` to a clickable deep-link (`closeTaskRouting.ts`):
       - `NO_UNPOSTED_DOCUMENTS` -> `/accounting/inbox/posting-exceptions?periodId=<periodId>`, `/accounting/post/documents?periodId=<periodId>`, `/accounting/inbox/exceptions?kind=RECEIPT_WITHHELD` / `INBOX_POSITION_LOST`
       - `NO_PENDING_AUTHORITY_DOCUMENTS` -> `/accounting/inbox/exceptions?kind=CANCELLATION_PENDING` and `#64` Tab 2 (`?tab=supply-decisions`)
       - `BANK_RECONCILED` -> `/accounting/reconcile/bank`
       - `DEPRECIATION_POSTED` -> `/accounting/post/assets` / depreciation runs
       - `DEFERRALS_POSTED` -> `/accounting/post/deferrals`
       - `FX_REVALUATION_POSTED` -> `/accounting/reconcile/fx-revaluation?periodId=<periodId>`
       - `INTERCOMPANY_TAGGED` -> `/accounting/reconcile/intercompany?periodId=<periodId>`
       - `TAX_RETURN_FILED` -> `/accounting/file/tax-returns?periodId=<periodId>`
     - **Special `LOCK_GL` Reconciling Disclosure (`CLOSE-12`, `D-657`):** When `code === 'LOCK_GL'` and `result.unrevaluedDifferences` is non-empty (because a `FILED` or `AMENDED` tax return blocked reopening `AR` or `AP`), renders a dedicated `caution` table (`حساب` / `Account` `accountId`, `العملة` / `Currency` `currencyCode`, `عدد البنود` / `Open items` `openItemCount`, `فروق غير مقوّمة` / `Unrevalued amount` `amount`, `الإجمالي` / `Gross` `grossAmount` — all formatted as `DecimalString` without `Number()`), explaining that `LOCK_GL` recorded these reconciling items and the next open period's revaluation re-measures them.
     - When `status === 'SKIPPED'`: displays `skipReason` verbatim in a bordered audit quote box.
   - **Section 2 — Task Mutation Forms (gated by `accounting.close.complete_task`, `!hardClosed`, `!isRecoveryMode`):**
     - **Complete (`MANUAL` only):** Optional `resultRef` (`varchar(255)` storage/working-paper reference) -> `POST .../tasks/:taskId/complete` (`CompleteCloseTaskDto { resultRef? }`, the task is the path `:taskId`, `If-Match: "<version>"`, `x-idempotency-key`, `D-772`).
     - **Skip (`SYSTEM_CHECK`, `SYSTEM_JOB`, or `MANUAL` — forbidden on `LOCK`):** Mandatory `reason` (`Textarea`, `10..1,000` trimmed chars, live character counter) -> `POST .../tasks/:taskId/skip` (`SkipCloseTaskDto { reason }`, `If-Match: "<version>"`, `x-idempotency-key`, `D-772`).
     - **Reassign (`Assign`):** User picker (`AssignCloseTaskDto { assigneeUserId: UUID }`, required, so there is no unassign) -> `POST .../tasks/:taskId/assign` (`If-Match: "<version>"`, `x-idempotency-key`, `D-772`; user names stay a UUID fallback, `CG-CLR-08`).

---

#### C. Module Lock Modal (`LockModuleModal`) & Two-Step Irreversible Hard-Close Modal (`HardCloseIrreversibleModal`)

1. **`LockModuleModal` (`POST /api/tenant/accounting/v1/close-instances/:id/lock` — Soft/Standard Module Close):**
   - **Payload (`LockModuleDto`, `02_DTOs.md` §11.2; the period comes from the close instance `:id`):**
     - `module`: `'AR' | 'AP' | 'TAX' | 'GL'` (required with `CLOSED`; locked to selected module)
     - `toState`: `'CLOSED'`
     - `acknowledgeIrreversible`: omitted / `false`
     - `reason`: `string` (`10..1,000` characters, required for `CLOSED` and `PERMANENTLY_CLOSED`)
   - **Headers:** `x-idempotency-key: <UUIDv7>`, `If-Match: <instance ETag>`.
   - **Pre-Lock Inspection Panel:**
     - Lists any live `acc_user_period_overrides` for this `module` (`GET /user-period-overrides?periodId=<id>`), noting they stop applying as soon as the module reaches `CLOSED` (`D-193`).
     - **Additional `LOCK_GL` Rule-17 Verification Strip (`D-666`, `D-667`):** Displays live status of `GET /integrity-checks/latest` across the 10 `ACCOUNTING_INTEGRITY_CHECK_CODES` (`PASSED` & fresh vs `STALE` / `ERROR` / `FAILED`). If `POST .../lock` returns `422 ACCOUNTING.CLOSE.SYSTEM_CHECK_FAILED`:
       - Renders every failed check in `err.details.check[]` (`DEPRECIATION_POSTED`, `DEFERRALS_POSTED`, `BANK_RECONCILED`, `FX_REVALUATION_POSTED`, `UNBILLED_REVENUE_ACCRUED`, `OPENING_BALANCES_SETTLED` with `batchId` link to `/accounting/setup/opening-imports`, or integrity check codes).
       - When `err.details.integrityRun ∈ {'STARTED', 'IN_PROGRESS'}` (server automatically started an in-process integrity check run because stale/`ERROR` integrity verdicts were the only failure, `D-667`/`D-677`), switches the modal into the **Waiting State banner** (§6.2) polling `GET /integrity-checks/latest` — **never** auto-retrying `lock` in a blind loop.

2. **`HardCloseIrreversibleModal` (`CLOSE-14`, `UC-CLR-5` — Two-Step Permanent Period Closure):**
   - **Admission Gate:** Rendered only when `instance.status === 'COMPLETED' && !instance.hardClosed`. Requires **both** `accounting.period.close` **AND** `accounting.period.lock` (`UC-CLR-5` §6 line 570).
   - **Step 1 — Impact & Precondition Review:**
     - **Permanent State Table:** Shows all modules of the period (`GL`, `AR`, `AP`, `TAX`, `INVENTORY`, `ASSETS`, `TREASURY`, `PAYROLL`) transitioning irreversibly to `PERMANENTLY_CLOSED` (`مقفل نهائياً للأبد`).
     - **Live Overrides Revocation List (`UC-CLR-5` alternate flow, `D-193`):** Lists every active `acc_user_period_overrides` row for the period (`userId`, `module`, `expiresAt`, `reason`) that will be **immediately and permanently revoked** in the hard-close transaction. If zero exist, displays `لا توجد استثناءات ترحيل نشطة لهذه الفترة` / `0 active user period overrides on this period`.
     - **Optional Tasks Auto-Skip Summary (`D-476`):** Lists any remaining non-mandatory (`isMandatory === false`) tasks still in `PENDING`/`BLOCKED`/`FAILED` that the server will automatically mark `SKIPPED` in the hard-close transaction.
     - CTA: `متابعة إلى الإقرار النهائي` / `Continue to final acknowledgement` (`outline`).
   - **Step 2 — Explicit Irreversible Acknowledgement & Reason:**
     - High-contrast `negative` `Alert` (`LockKeyhole` + `AlertOctagon`):
       - **AR:** `تحذير قانوني ومحاسبي قاطع: الإقفال النهائي يحوّل جميع وحدات الفترة إلى «مقفلة نهائياً» (PERMANENTLY_CLOSED) ويلغي كافة استثناءات المستخدمين. لا يمكن التراجع عن هذا الإجراء بواسطة أي مستخدم أو صلاحية (بما في ذلك صلاحية إعادة فتح الفترات) أو عبر الدعم الفني — وأي تعديل لاحق يتم حصراً بقيد تسوية في فترة مفتوحة تالية.`
       - **EN:** `Irreversible accounting control: Hard close sets every module of this period to PERMANENTLY_CLOSED and revokes all user overrides. Neither accounting.period.reopen, tenant owner privileges, nor platform support can ever undo this transition — any subsequent adjustment must post in a later open period.`
     - **Mandatory `reason` (`Textarea`):** `10..1,000` trimmed chars (`ck_acc_close_instances_hard_close_fields`, `VAL-CLR-36`).
     - **Mandatory Checkbox (`acknowledgeIrreversible: true`):** `أُقرّ بأن الإقفال النهائي للفترة <periodCode> نهائي ولا رجعة فيه تحت أي ظرف` / `I acknowledge that permanently closing period <periodCode> is irreversible and can never be undone`.
     - **Submit Button (`variant="destructive"`):** Remains **disabled** until `!isLoadingOverrides && reason.trim().length >= 10 && reason.trim().length <= 1000 && acknowledgeIrreversible === true`. Sends `POST /api/tenant/accounting/v1/close-instances/:id/lock` with `acknowledgeIrreversible: true`, `toState: 'PERMANENTLY_CLOSED'`, **no `module`** (the hard close moves every module of the period, each already `CLOSED`; a module sent with `PERMANENTLY_CLOSED`, or none with `CLOSED`, is `400 ACCOUNTING.VALIDATION.FAILED` keyed `module`; `CG-CLR-04`, closed by `D-772`), `reason`, `If-Match: <instance ETag>`, and `x-idempotency-key: <UUIDv7>`.

---

#### D. Tab 2 (`[Stage 5 — P27.T05]`) — Accrual Supply Decisions (`AccrualSupplyDecisionsTab`, `D-276`)

Mounted in `P27.T05` when `GET /close/accrual-supply-decisions` is active. Solves `SUPPLY_NOT_EVIDENCED` (`08_close_and_reporting.md` Rule 17): when an accrued-kind fiscal document has `economic_event_at === null` and no final entry dated by `period.endDate`, `NO_PENDING_AUTHORITY_DOCUMENTS` and `LOCK_GL` refuse until an `ACTIVE` `acc_accrual_supply_decisions` row exists for `(companyId, fiscalDocumentId, periodId)`.

1. **Recorded Decisions `DataTable` (`AccrualSupplyDecisionDto`, `02_DTOs.md` §13 lines 4355–4369):**
   - Columns:
     - `المستند الضريبي` / `Fiscal document`: `<IdentifierText>{fiscalDocumentId}</IdentifierText>` (joined with `GET /fiscal-documents/:id` for document number, party, currency & net amount; links to `/accounting/post/documents/[fiscalDocumentId]`)
     - `القرار` / `Decision`: `t.enums.AccrualSupplyDecision[decision]` (`لا يوجد توريد في الفترة` / `No supply in period` · `استحقاق يدوي` / `Manual accrual`)
     - `قيد الاستحقاق` / `Accrual entry`: `journalEntryId` (`<IdentifierText>` link to `/accounting/post/journal-entries/[journalEntryId]` when `decision === 'MANUAL_ACCRUAL'`, else `—`)
     - `الحالة` / `Status`: `StatusBadge` (`ACTIVE` = `positive` `CheckCircle2`; `VOIDED` = `neutral` `Ban` + `voidReason` tooltip)
     - `المُقرّر والتاريخ` / `Decided by & at`: `decidedBy`, `decidedAt` (`tabular-nums`), `reason`
     - `الإجراء` / `Action`: When `status === 'ACTIVE'` and period `GL` state `∉ {'CLOSED', 'PERMANENTLY_CLOSED'}`: `outline` `إلغاء القرار` / `Void decision` -> opens `VoidAccrualSupplyDecisionModal` (`VoidAccrualSupplyDecisionDto { reason: string }`, `10..1,000` chars, `POST /close/accrual-supply-decisions/:id/void` with `If-Match: "<version>"` and `x-idempotency-key`). Note: for `MANUAL_ACCRUAL`, the modal warns that the posted `ACCRUAL` entry (`journalEntryId`) must be reversed in the period first or the server refuses with `409 ACCOUNTING.CLOSE.SUPPLY_DECISION_VOID_REFUSED` (`D-276`).
2. **`DecideAccrualSupplyDrawer` (`POST /api/tenant/accounting/v1/close/accrual-supply-decisions` — `DecideAccrualSupplyDto`, `02_DTOs.md` §11.2 lines 3272–3283):**
   - `fiscalDocumentId: UUID` (pre-filled when launched from an undecided `SUPPLY_NOT_EVIDENCED` banner row, or selected via document picker)
   - `periodId: UUID` (locked to `instance.periodId`)
   - `decision: AccrualSupplyDecision` (`'NO_SUPPLY_IN_PERIOD' | 'MANUAL_ACCRUAL'`)
   - `reason: string` (`10..1,000` trimmed chars, mandatory)
   - **Conditional `accrualLines` Balanced Line Grid** (rendered iff `decision === 'MANUAL_ACCRUAL'`, `2..MAX_LINES_PER_ENTRY` rows; forbidden when `NO_SUPPLY_IN_PERIOD`, `VAL-CLR-35`):
     - Columns per row: `AccountRole` select (`accountRole: AccountRole`), `LineDirection` select (`direction: 'DEBIT' | 'CREDIT'`), `Amount` decimal input (`amount: DecimalString` > `0`, functional currency, string arithmetic sum check), optional `dimensionSetId?: UUID` (hidden/disabled until `CG-CLR-05` exposes dimension-set resolution).
     - Live footer balance check: Total `DEBIT` vs Total `CREDIT` (`tabular-nums`, exact string-decimal comparison). Submit enabled only when `sum(DEBIT) === sum(CREDIT)` and `accrualLines.length >= 2`.

---

### 4.3 Screen `#108` — Setup Close Templates List (`/accounting/setup/close-templates`)

1. **`PageHeader`:**
   - Breadcrumb: `المحاسبة` / `Accounting` -> `الإعدادات` / `Setup` -> `قوالب قوائم الإقفال` / `Close templates`.
   - Single `primary` CTA:
     - **`[Slice P19.T09]`:** None (read-only catalogue).
     - **`[Stage 5 P27.T05]`:** `نسخ قالب إقفال` / `Clone close template` (`variant="primary"`, gated by `accounting.close.configure` && `!isRecoveryMode`).
2. **`FilterBar` (`CloseTemplateListQueryDto`, `02_DTOs.md` §11.1):**
   - `closingType?: ClosingType` (`All`, `MONTH`, `QUARTER`, `YEAR`)
   - `packCode?: string` (`All`, `EG` pack, `Base` pack, `Tenant custom` client chip where `packCode === null`)
3. **`DataTable` Columns (`CloseTemplateSummaryDto` — `acc_close_templates` projection):**
   - `الكود والاسم` / `Code & name`: `<IdentifierText>{code}</IdentifierText>` + `nameI18n[locale] || nameI18n.ar` (`Link` to `/accounting/setup/close-templates/[id]`)
   - `المصدر` / `Source`: `packCode !== null` -> neutral `حزمة الدولة (${packCode}) — للقراءة فقط` / `Country pack (${packCode}) — read-only` (`ShieldCheck` icon); `packCode === null` -> `مخصّص للشركة` / `Company clone`
   - `نوع الإقفال` / `Closing type`: `closingType` (`MONTH` / `QUARTER` / `YEAR`)
   - `الإصدار والافتراضي` / `Version & default`: `v{templateVersion}` (`tabular-nums`) + `isDefault` (`positive` `Check` chip `افتراضي` / `Default`) + `autoStartOnPeriodEnd` (`تشغيل تلقائي نهاية الفترة` / `Auto-start`)
   - `فترة السريان` / `Validity`: `effectiveFrom` -> `effectiveTo ?? '∞'` (`tabular-nums`)
   - `الإجراءات` / `Actions`:
     - `[Slice P19.T09]`: `عرض` / `Inspect` (`Link` to `#109`).
     - `[Stage 5 P27.T05]`: On pack row (`packCode !== null`): `نسخ للتخصيص` / `Clone` (`POST /close-templates/:id/clone`, `accounting.close.configure`). On company row (`packCode === null`): `تعديل` / `Edit` (`Link` to `#109`) + `حذف` / `Delete` (`DELETE /close-templates/:id` with `If-Match`, `accounting.close.manage_templates`; refused by server if a live close instance references it). When a row has `deletedAt !== null` (see `CG-CLR-07`): `استعادة` / `Restore` (`POST /close-templates/:id/restore`).

---

### 4.4 Screen `#109` — Setup Close Template Detail & Task DAG (`/accounting/setup/close-templates/[id]`)

1. **Read-Only Pack Immutability Banner (`packCode !== null`, `D-172`):**
   - Renders a neutral/info `Alert` (`Shield`) at top of `#109`:
     - **AR:** `هذا القالب مُورّد ضمن حزمة الدولة (${packCode}) ومحمّي ضد التعديل المباشر. لتخصيص المواعيد أو إضافة مهام مراجعة يدوية لشركتك، انسخ القالب أولاً.`
     - **EN:** `This template is shipped by country pack (${packCode}) and is immutable. Clone it to customize offsets, owners, or add company manual sign-off tasks.`
   - In `P27.T05`, `PageHeader` `primary` CTA is `نسخ القالب للتخصيص` / `Clone to customize` (`POST /close-templates/:id/clone`). All edit/delete controls are **absent** on pack rows (never teasing an illegal `403 ACCOUNTING.CLOSE.TEMPLATE_READ_ONLY` action).
2. **Template Metadata Card (`CloseTemplateDetailDto`):**
   - Displays `code`, `nameI18n.ar` / `nameI18n.en`, `closingType`, `packCode`, `countryCode`, `templateVersion`, `isDefault`, `autoStartOnPeriodEnd`, `effectiveFrom`, `effectiveTo`, `isActive`, and `<IdentifierText>{contentHash}</IdentifierText>`.
   - On company clones (`packCode === null`) in `P27.T05`: `outline` `تعديل بيانات القالب` / `Edit header` opens inline/drawer form (`PATCH /close-templates/:id` with `If-Match: <ETag>`, gated by `accounting.close.manage_templates`; see `CG-CLR-02`).
3. **Template Task Graph Table (`GET /api/tenant/accounting/v1/close-templates/:id/tasks` — `[Stage 5 P27.T05]`):**
   - Ordered by `seq ASC`. Columns:
     - `seq` (`#`), `code` (`<IdentifierText>`) + `nameI18n`, `kind` (`CloseTaskKind`), `module` (`PeriodModule | null`), `dependsOn[]` DAG chips, `Deadline rule` (`deadlineParameterCode` statutory badge e.g. `return_due_days` overriding `offsetDays`, else `+${offsetDays}d`, `0..60`, `D-087`/`D-536`), `ownerRole` (`<IdentifierText>`), `isMandatory` & `blocksLock` flags, `Origin` (`clonedFromTaskId !== null || packCode !== null` -> `مهمة الحزمة الأساسية` / `Pack task` vs `مهمة مضافة للشركة` / `Tenant manual task`).
   - **Stage 5 Task Authoring Rules (`D-709`, `D-762` — enforced in UI & DB triggers):**
     - **Add Manual Task (`POST /close-templates/:id/tasks`, `PageHeader` `primary` CTA on company clone):** Locks `kind = 'MANUAL'` (`ck_acc_close_template_tasks_cloned_manual`) and omits `dependsOn` (`[]` — tenant tasks in MVP carry no DAG edges and gate module locks through `module` and `blocksLock`, `08_close_and_reporting.md` §5 line 155; see `CG-CLR-03`). Validates uppercase `code` (`<= 48` chars, not colliding with `ACCOUNTING_CLOSE_TASK_CODES`), `nameI18n.ar` (required), `nameI18n.en` (optional), `offsetDays` (`0..60`), `deadlineParameterCode?`, `ownerRole` (`<= 64` chars), `module?`, `isMandatory`, `blocksLock`.
     - **Edit Task (`PATCH /close-templates/:id/tasks/:taskId`):** Available on any task of a company clone, **with `code`, `kind`, and `dependsOn` rendered strictly read-only** (`08_close_and_reporting.md` §5 line 156); allows adjusting `nameI18n`, `descriptionI18n`, `ownerRole`, `offsetDays` (`0..60`), `deadlineParameterCode`, `isMandatory`, `blocksLock`, `seq`.
     - **Delete Task (`DELETE /close-templates/:id/tasks/:taskId`):**
       - On tasks copied from the pack (`clonedFromTaskId !== null`) or referenced in another live task's `dependsOn[]`: Delete button is **disabled** with factual tooltip: `مهام الحزمة المنسوخة والمهام المرتبطة باعتماديات لا تُحذف؛ يمكنك تخطّي المهمة غير المنطبقة مع ذكر السبب أثناء الإقفال (D-762)` / `Copied pack tasks and tasks with dependents cannot be deleted; skip non-applicable tasks with a written reason during close (D-762)`.
       - Enabled **only** when `clonedFromTaskId === null` and zero tasks reference `task.code` in `dependsOn[]`.

---

## 5. Empty, Loading, Error (3-Part Copy), `403`, Entitlement & Recovery States

### 5.1 Loading (`Skeleton`) & Empty States (`EmptyState`)

| Surface | Loading Skeleton (`Skeleton`) | Server-Backed Empty State (`EmptyState` — zero mock rows) |
| --- | --- | --- |
| **`#63` `/accounting/close/checklists`** | 3 KPI card skeletons (`h-20`) + `FilterBar` skeleton + 6-row `DataTable` skeleton (`h-11` per row) | • **No instances in company (`meta.total === 0`, no active filters):** Icon `CalendarCheck2`; Title `لم يبدأ أي إقفال فترة بعد` / `No period close checklists started yet`; Body explains that monthly/quarterly/yearly checklists verify reconciliations and subledgers before locking `AR`, `AP`, `TAX`, and `GL`; CTA `بدء إقفال فترة` / `Start period close` (if `accounting.close.start` held).<br>• **Filtered empty (`meta.total === 0`, filters active):** `لا توجد قوائم إقفال مطابقة للتصفية الحالية` / `No close checklists match current filters` + `مسح التصفية` / `Clear filters`. |
| **`#64` `/accounting/close/checklists/[id]` Tab 1** | `DetailHeader` skeleton + 4-card `PeriodModuleLockStrip` skeleton + 10-row task DAG table skeleton | • **Filtered task empty:** `لا توجد مهام مطابقة لحالة التصفية` / `No tasks match the selected filter` + `إظهار كل المهام` / `Show all tasks`. *(An unfiltered live instance always contains `>= 1` task per `VAL-CLR-04`.)* |
| **`#64` Tab 2 (`[Stage 5]` Supply Decisions)** | 4-row `DataTable` skeleton | `لا توجد قرارات توريد مسجّلة لهذه الفترة` / `No accrual supply decisions recorded for this period` (sub-caption confirms `0` open `SUPPLY_NOT_EVIDENCED` items when clean). |
| **`#108` `/accounting/setup/close-templates`** | `FilterBar` + 5-row `DataTable` skeleton | • **No country pack adopted yet:** Title `لا تتوفر قوالب إقفال معتمدة لهذه الشركة` / `No close templates available for this company`; links to `/accounting/setup/company` (`Adopt country pack`). |

---

### 5.2 Three-Part Error Copy (`Cause` · `Effect on Books` · `Safe Next Action` + `correlationId`)

Every command failure renders through the shared Accounting error presenter (`accounting-patterns-documents.md` §3), preserving `err.correlationId` (`<IdentifierText>`) and strictly distinguishing `COMMITTED` vs `UNCHANGED` transaction states (`04_Errors_and_Constants.md` §3.12):

| Error Code & HTTP | Trigger Surface | Bilingual 3-Part Copy (`1. السبب / Cause` · `2. الأثر على الدفاتر / Effect on Books` · `3. الإجراء الآمن التالي / Safe Next Action`) |
| --- | --- | --- |
| **`ACCOUNTING.CLOSE.SYSTEM_CHECK_FAILED` (`422`) — on `POST .../tasks/:taskId/run`** (`Transaction: COMMITTED` on task row) | Running a `SYSTEM_CHECK` task (`NO_UNPOSTED_DOCUMENTS`, `BANK_RECONCILED`, `TAX_RETURN_FILED`, etc.) | • **AR:** **السبب:** فشل الفحص الآلي `<taskCode>` لوجود `<blockingCount>` عنصر مانع (`details.check`). **الأثر على الدفاتر:** لم يُرحّل أي قيد، وتم حفظ حالة المهمة «فشلت» (`FAILED`) مع سجل الأدلة برقم السلسلة `<asOfChainSeq>`. **الإجراء التالي:** افتح روابط العناصر المانعة في لوحة الأدلة لمعالجتها، ثم أعد تشغيل الفحص.<br>• **EN:** **Cause:** Automated check `<taskCode>` found `<blockingCount>` blocking item(s) (`details.check`). **Effect on Books:** No ledger entry was written; the task row was saved as `FAILED` with audit evidence at `<asOfChainSeq>`. **Safe Next Action:** Open the blocking references in the Evidence drawer, resolve them at source, then click `Run check` again. |
| **`ACCOUNTING.CLOSE.SYSTEM_CHECK_FAILED` (`422`) — on `POST /close-instances/:id/lock` (`LOCK_GL`)** (`Transaction: UNCHANGED`, except optional background integrity start) | Locking `GL` when Rule-17 re-verification fails (`D-666`, `D-667`, `D-677`) | • **AR:** **السبب:** تعذّر قفل الأستاذ العام (`GL`) لأن الفحوصات الإلزامية (`details.check`) غير مستوفاة أو أن فحص سلامة الدفاتر بحاجة لتحديث. **الأثر على الدفاتر:** لم تتغير حالة فترة الأستاذ العام وبقيت غير مقفلة (`UNCHANGED`). *(إذا كانت `details.integrityRun` = `STARTED` أو `IN_PROGRESS`: بدأ النظام تلقائياً تشغيل فحص السلامة في الخلفية).* **الإجراء التالي:** انتظر اكتمال شريط فحص السلامة أدناه (أو عالج البنود المانعة المذكورة)، ثم أعد نقر «قفل الأستاذ العام».<br>• **EN:** **Cause:** `GL` lock refused because Rule-17 gate checks (`details.check`) failed or integrity verdicts were stale/`ERROR`. **Effect on Books:** Period `GL` state is completely unchanged. *(When `details.integrityRun` is `STARTED`/`IN_PROGRESS`, an on-demand integrity run has started automatically.)* **Safe Next Action:** Wait for the integrity monitor status strip below to report `PASSED` (or clear the named blocking items), then retry `Lock GL`. |
| **`ACCOUNTING.CLOSE.DEPENDENCY_UNMET` (`409`)** (`UNCHANGED`) | Running/completing/skipping a task while a `dependsOn` code is still `PENDING`/`BLOCKED`/`FAILED` | • **AR:** **السبب:** تعتمد هذه المهمة على مهام سابقة لم تكتمل بعد (`dependsOn`). **الأثر على الدفاتر:** لم يحدث أي تغيير. **الإجراء التالي:** أنجز المهام السابقة المميزة في عمود الاعتماديات أولاً.<br>• **EN:** **Cause:** Prerequisite task(s) in `dependsOn` are not yet `DONE`, `SKIPPED`, or `NOT_APPLICABLE`. **Effect on Books:** Unchanged. **Safe Next Action:** Complete the prerequisite tasks highlighted in the Dependencies column first. |
| **`ACCOUNTING.CLOSE.TASKS_PENDING` (`409`)** (`UNCHANGED`) | Locking module `<M>` while a `blocksLock = true` task of `<M>` is incomplete, or Hard Closing before `COMPLETED` | • **AR:** **السبب:** لا تزال هناك مهام حاجزة معلّقة لوحدة `<M>`. **الأثر على الدفاتر:** بقيت حالة الوحدة دون تغيير. **الإجراء التالي:** صفِّ الجدول على المهام الحاجزة لوحدة `<M>` وأنجزها أو تخطَّ غير المنطبق منها مع كتابة السبب.<br>• **EN:** **Cause:** One or more `blocksLock` tasks for module `<M>` remain incomplete. **Effect on Books:** Module state unchanged. **Safe Next Action:** Filter the checklist to `<M>` blocking tasks and complete or skip them with a written reason. |
| **`ACCOUNTING.CLOSE.INSTANCE_OPEN` (`409`)** (`UNCHANGED`) | `POST /close-instances` when a non-`CANCELLED` instance already exists for `(companyId, periodId, closingType)` | • **AR:** **السبب:** توجد قائمة إقفال نشطة بالفعل لهذه الفترة ونوع الإقفال. **الأثر على الدفاتر:** لم تُنشأ قائمة مكررة. **الإجراء التالي:** افتح قائمة الإقفال الحالية لمتابعة العمل عليها.<br>• **EN:** **Cause:** An active close checklist already exists for this period and closing type. **Effect on Books:** No duplicate instance created. **Safe Next Action:** Open the existing checklist workspace. |
| **`ACCOUNTING.CLOSE.LOCK_IRREVERSIBLE` (`422`)** (`UNCHANGED`) | Hard-close request missing `acknowledgeIrreversible: true` | • **AR:** **السبب:** يتطلب الإقفال النهائي تأكيد الإقرار الصريح بعدم قابلية التراجع. **الأثر على الدفاتر:** لم يتغير شيء. **الإجراء التالي:** راجع التحذير وحدّد مربع الإقرار وسبب الإقفال النهائي.<br>• **EN:** **Cause:** Permanent closure requires explicit `acknowledgeIrreversible: true`. **Effect on Books:** Unchanged. **Safe Next Action:** Complete Step 2 acknowledgement checkbox and reason. |
| **`ACCOUNTING.CLOSE.HARD_CLOSED` (`409`)** (`UNCHANGED`) | Any mutation against an already hard-closed instance | • **AR:** **السبب:** تم إقفال هذه الفترة إقفالاً نهائياً غير قابل للعكس. **الأثر على الدفاتر:** لم يتغير شيء؛ جميع الوحدات `PERMANENTLY_CLOSED`. **الإجراء التالي:** حدّث الصفحة لعرض سجل الإقفال النهائي، وسجّل أي تسوية في فترة مفتوحة لاحقة.<br>• **EN:** **Cause:** This close checklist is permanently hard-closed. **Effect on Books:** Unchanged; all modules remain `PERMANENTLY_CLOSED`. **Safe Next Action:** Refresh to view the read-only seal; post any adjustment in a subsequent open period. |
| **`ACCOUNTING.CLOSE.SUPPLY_DECISION_EXISTS` (`409`) / `SUPPLY_DECISION_VOID_REFUSED` (`409`)** (`UNCHANGED`) | `[Stage 5]` Duplicate active supply decision or voiding when `GL` is closed / manual accrual entry unreversed | • **AR:** **السبب:** إما أن للمستند قراراً نشطاً بالفعل، أو تعذّر إلغاء القرار لأن الأستاذ العام مقفل أو أن قيد الاستحقاق اليدوي لم يُعكس بعد في نفس الفترة. **الأثر على الدفاتر:** لم يتغير شيء. **الإجراء التالي:** اعكس قيد الاستحقاق اليدوي `<journalEntryId>` داخل الفترة أولاً ثم ألغِ القرار، أو افتح الأستاذ العام قبل التعديل.<br>• **EN:** **Cause:** Either an `ACTIVE` decision already covers this document/period, or voiding was refused because `GL` is closed or the `MANUAL_ACCRUAL` entry has not been reversed in the period (`D-276`). **Effect on Books:** Unchanged. **Safe Next Action:** Reverse accrual entry `<journalEntryId>` within the period first (while `GL` is open), then void and record the new decision. |
| **`ACCOUNTING.CONCURRENCY.STALE_VERSION` (`409`)** (`UNCHANGED`) | Stale `If-Match` on task, lock, cancel, template, or void | • **AR:** **السبب:** قام مستخدم آخر أو دفعة خلفية بتحديث السجل بعد فتحك للشاشة. **الأثر على الدفاتر:** لم يُطبّق تعديلك. **الإجراء التالي:** انقر «تحديث البيانات» لقراءة أحدث حالة ونسخة (`ETag`) ثم أعد المحاولة بمعرّف عملية جديد.<br>• **EN:** **Cause:** Another user or background job updated this record since you loaded it. **Effect on Books:** Unchanged. **Safe Next Action:** Click `Refresh` to load the latest state and `ETag`, then re-apply your action. |
| **Network Timeout / `502` / `504` (`CLIENT_REQUEST_TIMEOUT`)** | Any idempotent `POST` / `PATCH` / `DELETE` (`x-idempotency-key` sent) | Renders **`AmbiguousOutcomePanel`** (`accounting-patterns-documents.md` §3.3): retains the **exact UUIDv7 `x-idempotency-key`** in hook state, disables form editing, and offers (1) `التحقق من الحالة الفعلية` / `Re-check server state` (`GET`) and (2) `إعادة المحاولة بنفس مفتاح عدم التكرار` / `Retry safely with same idempotency key`. |

---

### 5.3 Authorization (`403 PermissionGate`), Entitlement (`NotEntitledGate`) & `RECOVERY_MODE` Fence

1. **Feature Entitlement (`accounting.close.checklist` — included in both `accounting.basic` and `accounting.advanced`, `10_Feature_Tiers.md` §6):**
   - If `user.featureEntitlements['accounting.close.checklist'] !== true`: route entry renders `NotEntitledGate` (`accounting-ia.md` §3 Rule 2).
   - If Gateway/Accounting returns `503 ACCOUNTING.FEATURE.ENTITLEMENT_UNAVAILABLE`: renders fail-closed service banner with `Retry` (`AFTER_DEPENDENCY_RECOVERY`), never falling back to permissive UI.
2. **Route & Scope RBAC (`PermissionGate` — `403` is never an empty state):**
   - Direct URL entry without `accounting.close.read` renders full-page `PermissionGate` naming `accounting.close.read`.
   - Every `SCR-33` route is `COMPANY`-scoped: if the actor holds only `BRANCH` grants on the selected company (e.g., `accounting_cashier`), `403 ACCOUNTING.SCOPE.TARGET_DENIED` renders `PermissionGate` instructing the user to switch company in `AccountingScopeBar` or request a `COMPANY`-level grant.
   - **Action-level dual-permission gates (shown & disabled with one-line reason when missing, `accounting-ia.md` §3 Rule 5):**
     - `Run` on `DEPRECIATION_POSTED`: requires `accounting.close.complete_task` **AND** `accounting.asset.run_depreciation` (plus `accounting.assets.core` entitlement; if unentitled to assets, task will not have planned rows or `Run` explains missing feature/permission).
     - `Run` on `DEFERRALS_POSTED`: requires `accounting.close.complete_task` **AND** `accounting.schedules.deferrals` + `accounting.deferral.run`.
     - `Hard close period`: requires `accounting.period.close` **AND** `accounting.period.lock` (`UC-CLR-5`).
3. **Company Profile Not Activated (`409 ACCOUNTING.PROFILE.NOT_FOUND` / `NOT_ACTIVATED`):**
   - Renders `SetupRequiredState` linking to `/accounting/setup/company`.
4. **`RECOVERY_MODE` & Restored `PERMANENTLY_CLOSED` Periods (`12_Platform_Changes.md` §4.10.1, `D-674`):**
   - While `isRecoveryMode === true` (`useAccountingBoundaryGate`), the persistent `RECOVERY_MODE` fence banner mounts at the top of `AccountingScopeBar`; all reads on `#63`, `#64`, `#108`, `#109` stay **live**, and every mutating button (`Start close`, `Run`, `Complete`, `Skip`, `Assign`, `Lock`, `Hard close`, `Cancel`, template edits, supply decisions) is **shown & disabled** with reason `النظام في وضع الاستعادة` / `Disabled while restore recovery is active`.
   - **Post-Recovery Restored Lock Nuance (`08_Close_and_Reporting_Tables.md` lines 218 & 271):** After a declared data-loss incident exits `RECOVERY_MODE`, `acc_fiscal_period_states` may already hold `PERMANENTLY_CLOSED` written by the restore while a newly started close instance runs its `LOCK_*` and `hard_closed` verification. `PeriodModuleLockStrip` handles this explicitly: when a module is already `CLOSED` or `PERMANENTLY_CLOSED` on `GET /periods/:id` while its `LOCK_<module>` task on the new instance is still `PENDING`, the card displays `حالة الفترة مستعادة — شغّل قفل الوحدة لإثبات التحقق` / `Period state restored — run Lock to verify checklist gate` (`trg_acc_close_tasks_lock_gate` re-verifies blocking tasks and Rule 17 and marks the `LOCK` task `DONE` without failing on state transition).
5. **Archived Tenant (`ARCHIVED`):** Read-only inspection banner across all four routes; all mutating buttons omitted.

---

## 6. Waiting States Specification (Deadline · Owner · Next Allowed Action — Zero-Resend Law)

Per `accounting-patterns-documents.md` §2 (`WS-01`..`WS-07`) and the **Zero-Resend Law**, no waiting banner, badge, or button in `SCR-33` ever implies resending an already-queued job or authority submission. Every waiting state displays **three mandatory fields**: **(1) Deadline / SLA**, **(2) Current Owner**, and **(3) Next Allowed Action**.

| Wait ID | Surface & Trigger Condition in `SCR-33` | Visual Indicator (`StatusBadge` / Banner) | 1. Deadline (`dueAt` / SLA) | 2. Current Owner | 3. Next Allowed Action (**Zero-Resend Law**) |
| --- | --- | --- | --- | --- | --- |
| **`CW-01`** | **Async `SYSTEM_JOB` Task `RUNNING` (`DEPRECIATION_POSTED` or `DEFERRALS_POSTED`)** — after `POST .../tasks/:taskId/run` returns `202 Accepted` + `Location` (`/depreciation-runs/:id` or `/deferral-runs/:id`) & `bulkOperationId` | Task `StatusBadge`: `caution` + spinning `Loader2` (`قيد التشغيل في الخلفية` / `Batch job running`); `Run job` button **disabled** while `status === 'RUNNING'` | Task `dueAt` (company TZ, `tabular-nums`) + `startedAt` elapsed timer | **System Worker** (`accounting-worker` executing `bulkOperationId`, initiated by `assigneeUserId` / `ownerRole`) | **Poll only — never re-dispatch:** `useCloseTaskActions` polls `GET <Location>` (`S-06`/`S-07`) and `GET /close-instances/:id/tasks` every `4s` (backoff to `15s`) + manual `تحديث الحالة` / `Refresh status` (`GET`). `CloseTaskService.onJobCompleted` transitions the task to `DONE` or `FAILED` automatically when the run finishes (`D-660`). |
| **`CW-02`** | **Other `SYSTEM_JOB` Tasks Waiting on Scheduled/Module Batch (`UNBILLED_REVENUE_ACCRUED`, `ACCRUALS_REVERSED`, `FX_REVALUATION_POSTED`)** in `PENDING` or `RUNNING` | `PENDING` (`Clock`) or `RUNNING` (`Loader2` spin) | Task `dueAt` (`period.endDate + offsetDays` in company TZ) | Module batch owner (`assigneeUserId` / `ownerRole`, e.g. Treasury / GL Accountant + Worker) | **Inspect or run in owning module (`D-660`):** `POST .../tasks/:taskId/run` is **not** called (refused with `403`). While `RUNNING`: `Refresh status` (`GET`) only. While `PENDING`/`FAILED`: `فتح شاشة التشغيل المختصة ↗` / `Open owning batch screen ↗` (`/accounting/reconcile/fx-revaluation`, recurring runs, or bulk operations). |
| **`CW-03`** | **`LOCK_GL` Auto-Started In-Process Integrity Monitor (`details.integrityRun = 'STARTED' \| 'IN_PROGRESS'`)** — after `POST /close-instances/:id/lock` (`GL`) returns `422 SYSTEM_CHECK_FAILED` solely on stale/`ERROR` integrity verdicts (`D-667`, `D-677`) | `caution` `WaitingStateCallout` inside `LockModuleModal` (`فحص سلامة الدفاتر قيد التنفيذ` / `Ledger integrity check in progress`) | Immediate interactive lease (`GET /integrity-checks/latest` `startedAt` elapsed; expected `< 1–2 min`) | **System Integrity Monitor** (`IntegrityMonitorService`, company lease held; `409 INTEGRITY_RUN_IN_PROGRESS` blocks duplicate triggers) | **Wait & re-read verdicts (`GET /integrity-checks/latest` every `5s`):** `POST /integrity-checks/run` is **disabled** while lease is active (Zero-Resend). Once all 10 `ACCOUNTING_INTEGRITY_CHECK_CODES` show `PASSED` and fresh for the period, `Lock GL` button re-enables with a fresh UUIDv7 `x-idempotency-key`. |
| **`CW-04`** | **Upstream Authority Verdict / Cancellation / Receiver-Rejection Wait (`WS-01`, `WS-02`, `WS-03`)** surfaced inside `NO_PENDING_AUTHORITY_DOCUMENTS` or `NO_UNPOSTED_DOCUMENTS` `blockingRefs[]` | `caution` `WaitingStateBadge` inside `CloseTaskEvidenceDrawer` per blocking authority document | Statutory parameter deadline from `acc_authority_parameters` (`decline_deadline_at` / `decision_deadline_at` / `receipt_submission_hours` in company TZ) | **External Tax Authority (ETA) / Counterparty Receiver** (monitored by `submission_polling` Worker job) | **Never re-submit authority document:** Deep-links to `/accounting/inbox/exceptions` or `/accounting/post/documents/[id]` to inspect `submission_polling` status (`GET`), or — if the statutory window expired — execute the documented post-expiry transition. |
| **`CW-05`** | **Undecided `SUPPLY_NOT_EVIDENCED` Accrual Wait (`D-276`)** blocking `NO_PENDING_AUTHORITY_DOCUMENTS` & `LOCK_GL` | `caution` banner at top of `#64` (`مستندات بلا إثبات توريد تحتاج قرار محاسبي` / `Documents awaiting supply decision`) | Task `dueAt` of `NO_PENDING_AUTHORITY_DOCUMENTS` / `LOCK_GL` | **Assigned Accountant** (`accounting.close.complete_task`) | **`[Stage 5]`:** Click `تسجيل قرار التوريد` / `Record supply decision` -> switches to `#64` Tab 2 (`DecideAccrualSupplyDrawer`: choose `NO_SUPPLY_IN_PERIOD` or balanced `MANUAL_ACCRUAL`), then click `Run check` on `NO_PENDING_AUTHORITY_DOCUMENTS`. |
| **`CW-06`** | **Period Reopen Maker-Checker Approval Wait (`WS-06` — `PERIOD_REOPEN`)** when `CLOSED` `AR` or `AP` needs reopening before `LOCK_GL` (`CLOSE-12`) | `caution` pill on `PeriodModuleLockStrip` (`طلب إعادة فتح قيد الاعتماد` / `Reopen approval pending`) | Approval rule `expiresAt` (`acc_approval_requests.expires_at` or `No expiry`) | **Independent Checker** (`accounting.approval.approve`, `user.id ∉ makerUserIds`) | Navigate to `/accounting/inbox/approvals` (`GET`) so an independent approver decides, or maker withdraws (`POST /approval-requests/:id/withdraw`). Never re-submits a duplicate reopen request (`409 REQUEST_PENDING`). |

---

## 7. Four-Combination ASCII Mockups (`AR-RTL` & `EN-LTR` × `Light` & `Dark`) + `375px` Mobile

> **Token Parity Note (`tokens.md`):** Light mode uses `bg-canvas` (`#F8FAFC`), `bg-surface` (`#FFFFFF`), `border-line` (`#E2E8F0`), `text-ink` (`#0F172A`), `text-ink-muted` (`#475569`). Dark mode uses `bg-canvas` (`#090D16`), `bg-surface` (`#111827`), `border-line` (`#1F2937`), `text-ink` (`#F8FAFC`), `text-ink-muted` (`#94A3B8`). Layout geometry is 100% identical across Light and Dark; RTL mirrors the entire shell, scope bar, module lock flow (`AR <- AP <- TAX <- GL` reading right-to-left), table column order, and slide-over drawer anchor (`start`/`end`), while keeping codes, hashes, dates, and Western digits (`ar-EG-u-nu-latn`) inside `<bdi dir="ltr">` islands.

### 7.1 Combination 1 — Arabic RTL · Light Mode (`dir="rtl"`, `theme="light"`, `1440px` Desktop)
**Surface shown:** `#64` `/accounting/close/checklists/[id]` (Active monthly close `2026-03`, `LOCK_AR` & `LOCK_AP` `CLOSED`, `LOCK_TAX` ready as single `primary` CTA, `FAILED` task evidence drawer open on logical end = physical left).

```text
+----------------------------------------------------------------------------------------------------------------------+
| [Light: bg-surface #FFF | border-line #E2E8F0]                                                                       |
|  [حسابي] [EN] [☀ فاتح]          الإعدادات | الإقرارات | [الإقفال v] | التسويات | الترحيل | الوارد | نظرة عامة | المحاسبة |
+----------------------------------------------------------------------------------------------------------------------+
|  نطاق العمل:  الفرع: [كل الفروع v]   |   الشركة: [شركة النيل للتجارة ش.م.م (EGP) v]       (صلاحية: على مستوى الشركة) |
+----------------------------------------------------------------------------------------------------------------------+
|  [■ قفل وحدة الضرائب (TAX)] [إلغاء الإقفال] [↻ تحديث]       قائمة إقفال الفترة: مارس 2026  [قيد التنفيذ ⟳]  ← الإقفال |
|  (CTA وحيد مملوء في الصفحة)                                تاريخ الأساس: 2026-03-31 | التقدّم: 9 / 12 (75%)          |
|                                                             المهمة الحاجزة: LOCK_TAX | بصمة القالب: a94f8c12e03b…   |
+----------------------------------------------------------------------------------------------------------------------+
|  شريط قفل وحدات الفترة المحاسبية (التسلسل الإلزامي من اليمين إلى اليسار: AR ← AP ← TAX ← GL)                         |
|  +-------------------------+   +-------------------------+   +-------------------------+   +-----------------------+ |
|  | 4. الأستاذ العام (GL)   | ← | 3. الضرائب (TAX)        | ← | 2. ذمم الموردين (AP)    | ← | 1. ذمم العملاء (AR)   | |
|  | الحالة: [مقفلة مبدئياً !]|   | الحالة: [مقفلة مبدئياً !]|   | الحالة: [مقفلة 🔒 ✓]     |   | الحالة: [مقفلة 🔒 ✓]   | |
|  | محجوزة بـ 2 مهام        |   | كل المهام الحاجزة مكتملة|   | اكتملت LOCK_AP          |   | اكتملت LOCK_AR        | |
|  | [عرض المهام الحاجزة (2)]|   | [قفل الضرائب (TAX)…]    |   | [إدارة إعادة الفتح ↗]   |   | [إدارة إعادة الفتح ↗] | |
|  +-------------------------+   +-------------------------+   +-------------------------+   +-----------------------+ |
|  [! تنبيه استثناءات الترحيل (1): يوجد استثناء نشط للمستخدم usr_0195… على وحدة GL ينتهي 2026-04-05 — يتوقف فور القفل] |
+-----------------------------------------------+----------------------------------------------------------------------+
|  [درج الأدلة والإجراء — يفتح في الطرف المنطقي] |  التبويبات: [قرارات التوريد (0)]  [* مهام قائمة الإقفال (9 / 12) *] |
|  ✕  فحص: اكتمال ترحيل الإهلاك                 |  تصفية: [الحالة: الكل v] [المسؤول: الكل v] [متأخرة فقط] [الوحدة: الكل]|
|     الكود: DEPRECIATION_POSTED  | النسخة: v4  |  +------------------------------------------------------------------+|
|  -------------------------------------------- |  | إجراء        | الحالة     | الموعد     | المسؤول | النوع  | المهمة ||
|  الحالة: [✕ فشلت]  | المحاولات: 2             |  |--------------+------------+------------+---------+--------+-------||
|  كود الخطأ: ACCOUNTING.CLOSE.SYSTEM_CHECK_…   |  | [الأدلة]     | [✓ مكتملة] | 2026-04-02 | أ. كمال | فحص آلي| 1. لا ||
|  وقت الفحص: 2026-04-04 14:20 (توقيت القاهرة)  |  | [إعادة فحص]  | محاولات: 1 |            |         |  —     | مستند ||
|  رقم سلسلة القيود: chainSeq #18,442           |  |--------------+------------+------------+---------+--------+-------||
|  العناصر المانعة المكتشفة: 3 سطور مخططة       |  | [الأدلة]     | [— غير     | 2026-04-30 | النظام  | فحص آلي| 8. إقـ||
|   • دفتر BOOK — أصل AST-2026-000114 [فتح ↗]   |  |              |  منطبقة]   | (معامل)    | تلقائي  |  TAX   | رار   ||
|   • دفتر BOOK — أصل AST-2026-000119 [فتح ↗]   |  |--------------+------------+------------+---------+--------+-------||
|  -------------------------------------------- |  | [قفل الوحدة] | [◷ بانتظار]| 2026-04-05 | د. منى  | قفل    |10.قفل ||
|  الإجراءات المتاحة (صلاحية الإنجاز + الإهلاك):|  | [الأدلة]     | محاولات: 0 |            |         |  TAX   | TAX   ||
|   [▶ تشغيل دفعة الإهلاك الآن (202 Worker)]    |  |--------------+------------+------------+---------+--------+-------||
|   [تخطّي المهمة مع كتابة السبب…]              |  | [*الأدلة*]   | [✕ فشلت !] | 2026-04-05 | م. طارق | دفعة   |11.ترحـ||
|   [تعيين مسؤول آخر…]                          |  | [تشغيل دفعة] | محاولات: 2 |            |         |  GL    | إهلاك ||
+-----------------------------------------------+----------------------------------------------------------------------+
```

---

### 7.2 Combination 2 — Arabic RTL · Dark Mode (`dir="rtl"`, `theme="dark"`, `1440px` Desktop)
**Surface shown:** `#64` `/accounting/close/checklists/[id]` with `status = 'COMPLETED'`, `!hardClosed`, and the **Two-Step Irreversible Hard-Close Modal (`HardCloseIrreversibleModal` — Step 2)** open over the dimmed dark canvas.

```text
+----------------------------------------------------------------------------------------------------------------------+
| [Dark: bg-canvas #090D16 | bg-surface #111827 | border-line #1F2937 | text-ink #F8FAFC | text-ink-muted #94A3B8]      |
|  [■ إقفال نهائي للفترة] [↻ تحديث]                            قائمة إقفال الفترة: مارس 2026  [مكتملة ✓]    ← الإقفال  |
|  التقدّم: 12 / 12 (100%) | AR: [مقفلة 🔒] ← AP: [مقفلة 🔒] ← TAX: [مقفلة 🔒] ← GL: [مقفلة 🔒] (فروق غير مقوّمة: 1)    |
+----------------------------------------------------------------------------------------------------------------------+
|                                                                                                                      |
|        +====================================================================================================+        |
|        |  [Modal: bg-surface #111827 | border-negative/50 | shadow-lg]                        ✕ إغلاق       |        |
|        |  🔒 إقفال نهائي غير قابل للعكس — الفترة المحاسبية: 2026-03 (الخطوة 2 من 2)                         |        |
|        |----------------------------------------------------------------------------------------------------|        |
|        |  [!! تنبيه قاطع — دلالة سلبية عالية التباين (Negative Semantic Alert)]                              |        |
|        |  سيؤدي هذا الإجراء فوراً وبشكل نهائي إلى تحويل جميع وحدات الفترة (GL, AR, AP, TAX, ASSETS, …)      |        |
|        |  إلى الحالة «مقفلة نهائياً» (PERMANENTLY_CLOSED). لا يمكن لأي مستخدم أو مالك حساب أو صلاحية        |        |
|        |  (accounting.period.reopen) أو فريق الدعم التراجع عن هذا القفل مطلقاً.                              |        |
|        |                                                                                                    |        |
|        |  ملخص الآثار الفورية التي تم التحقق منها في الخطوة 1:                                              |        |
|        |   • استثناءات المستخدمين النشطة التي ستُلغى فوراً (D-193): 1 استثناء (usr_0195… — وحدة GL)          |        |
|        |   • المهام الاختيارية غير المكتملة التي ستُتخطّى تلقائياً (D-476): 0 مهمة                          |        |
|        |   • متطلب الصلاحيات المزدوجة: accounting.period.close ✓  +  accounting.period.lock ✓               |        |
|        |                                                                                                    |        |
|        |  سبب الإقفال النهائي (إلزامي: 10 إلى 1,000 حرف — يُحفظ في سجل المراجعة الدائم): *                  |        |
|        |  +----------------------------------------------------------------------------------------------+  |        |
|        |  | اعتماد القوائم المالية لشهر مارس 2026 وتقديم إقرار القيمة المضافة النهائي ومطابقة البنوك.   |  |        |
|        |  +----------------------------------------------------------------------------------------------+  |        |
|        |  عدد الأحرف: 91 / 1,000                                                                            |        |
|        |                                                                                                    |        |
|        |  [✓] أُقرّ بأن الإقفال النهائي للفترة 2026-03 نهائي ولا رجعة فيه تحت أي ظرف (acknowledgeIrreversible)|       |
|        |----------------------------------------------------------------------------------------------------|        |
|        |  [🔒 تأكيد الإقفال النهائي الدائم (Destructive)]                         [رجوع للخطوة 1]  [إلغاء]  |        |
|        +====================================================================================================+        |
|                                                                                                                      |
+----------------------------------------------------------------------------------------------------------------------+
```

---

### 7.3 Combination 3 — English LTR · Light Mode (`dir="ltr"`, `theme="light"`, `1440px` Desktop)
**Surface shown:** `#64` `/accounting/close/checklists/[id]` during `LOCK_GL` waiting on auto-started Integrity Monitor (`CW-03`) + `[Stage 5]` Tab 2 (`Accrual supply decisions`) badge visible.

```text
+----------------------------------------------------------------------------------------------------------------------+
| [Light: bg-surface #FFF | border-line #E2E8F0 | text-ink #0F172A]                                                    |
|  Accounting | Overview | Inbox | Post | Reconcile | [Close v] | File | Setup          [☀ Light] [العربية] [My Profile]|
+----------------------------------------------------------------------------------------------------------------------+
|  Scope:  Company: [Nile Trading Co. S.A.E. (EGP) v]   |   Branch: [All branches v]          (Scope target: COMPANY)  |
+----------------------------------------------------------------------------------------------------------------------+
|  Close -> Period Close Checklist: March 2026  [⟳ In progress]            [↻ Refresh] [Cancel close] [■ Lock GL]     |
|  Key date: 2026-03-31 | Progress: 11 / 12 (92%) | Blocking task: LOCK_GL | Pinned template hash: a94f8c12e03b…       |
+----------------------------------------------------------------------------------------------------------------------+
|  Sequential Period Module Lock Strip (Mandatory order: 1. AR -> 2. AP -> 3. TAX -> 4. GL)                            |
|  +-----------------------+   +-------------------------+   +-------------------------+   +-------------------------+ |
|  | 1. Receivables (AR)   | ->| 2. Payables (AP)        | ->| 3. Tax (TAX)            | ->| 4. General Ledger (GL)  | |
|  | State: [🔒 Closed ✓]  |   | State: [🔒 Closed ✓]    |   | State: [🔒 Closed ✓]    |   | State: [! Soft-closed]  | |
|  | LOCK_AR Done          |   | LOCK_AP Done            |   | LOCK_TAX Done           |   | 0 blocking tasks left   | |
|  | [Manage reopen ↗]     |   | [Manage reopen ↗]       |   | [Manage reopen ↗]       |   | [Lock GL…]              | |
|  +-----------------------+   +-------------------------+   +-------------------------+   +-------------------------+ |
|  [⟳ Waiting State CW-03 — Integrity Monitor Running]: LOCK_GL started an on-demand ledger integrity check because    |
|  2 monitor verdicts were stale for 2026-03. Owner: System Integrity Monitor | Elapsed: 00:18 | Next action: Wait for |
|  automatic status refresh (every 5s) or click [Refresh verdicts]; do NOT re-trigger integrity run (lease active).    |
+----------------------------------------------------------------------------------------------------------------------+
|  Tabs: [* Checklist tasks (11 / 12) *]   [Accrual supply decisions (2 active) — Stage 5]                             |
|  Filters: [Status: All v]  [Assignee: All v]  [Overdue only]  [Module: All | AR | AP | TAX | GL]                     |
|  +------------------------------------------------------------------------------------------------------------------+|
|  | #  | Task & dependencies                   | Kind & module      | Assignee     | Due (Cairo TZ)   | Status & act ||
|  |----+---------------------------------------+--------------------+--------------+------------------+--------------||
|  | 1  | No unposted documents                 | System check · —   | K. Hassan    | 2026-04-02 00:00 | [✓ Done] (1) ||
|  |    | NO_UNPOSTED_DOCUMENTS · Mandatory     |                    | accountant   |                  | [Evidence]   ||
|  |----+---------------------------------------+--------------------+--------------+------------------+--------------||
|  | 6  | Post book depreciation                | System job · GL    | T. Mansour   | 2026-04-05 00:00 | [✓ Done] (2) ||
|  |    | DEPRECIATION_POSTED · dep: #1         |                    | accountant   |                  | [Evidence]   ||
|  |----+---------------------------------------+--------------------+--------------+------------------+--------------||
|  | 8  | Tax returns filed in period           | System check · TAX | System       | 2026-04-30 00:00 | [— N/A] (1)  ||
|  |    | TAX_RETURN_FILED · dep: #3            |                    | tax_officer  | return_due_days  | [Evidence]   ||
|  |----+---------------------------------------+--------------------+--------------+------------------+--------------||
|  | 12 | Lock General Ledger                   | Module lock · GL   | M. Adel      | 2026-04-07 00:00 | [◷ Pending]  ||
|  |    | LOCK_GL · dep: LOCK_AR, LOCK_AP, …    |                    | chief_acct   |                  | [Lock GL…]   ||
|  +------------------------------------------------------------------------------------------------------------------+|
+----------------------------------------------------------------------------------------------------------------------+
```

---

### 7.4 Combination 4 — English LTR · Dark Mode (`dir="ltr"`, `theme="dark"`, `1440px` Desktop)
**Surface shown:** `#109` `/accounting/setup/close-templates/[id]` in `[Stage 5 — P27.T05]` inspecting a **Company-Cloned Close Template** (`packCode === null`), with the **Add Manual Close Task Drawer** open on the logical end (right edge).

```text
+----------------------------------------------------------------------------------------------------------------------+
| [Dark: bg-canvas #090D16 | bg-surface #111827 | border-line #1F2937 | text-ink #F8FAFC | text-ink-muted #94A3B8]      |
|  Setup -> Close Templates -> NILE_MONTH_CLOSE_V1  [Company clone]     [Edit header] [Delete] [■ + Add manual task]   |
|  Closing type: Monthly (MONTH) | Version: v1 | Default: [✓ Yes] | Auto-start on period end: [✓ Yes]                  |
|  Validity: 2026-01-01 -> ∞ | Content SHA-256: 7d31b804fa19… (Pinned per instance at startClose — D-069)              |
+-----------------------------------------------------------------------+----------------------------------------------+
|  Template Task Graph (13 tasks · Max 100 · DAG verified by trigger)   |  [Drawer: bg-surface #111827 | w-[440px]]    |
|  +-------------------------------------------------------------------+|  Add Manual Close Task                  ✕    |
|  | #  | Code & Title               | Kind / Mod | Rule    | Actions  ||  ------------------------------------------  |
|  |----+----------------------------+------------+---------+----------||  Info: Tenant-added tasks are always MANUAL  |
|  | 1  | NO_UNPOSTED_DOCUMENTS      | Check · —  | +2d     | [Edit]   ||  with no DAG edges and gate module locks via |
|  |    | Pack task (copied)         | Mandatory  |         | [Del 🔒] ||  Module + Blocks lock (D-709, D-762).        |
|  |----+----------------------------+------------+---------+----------||                                              |
|  | 9  | EG_VAT_RETURN_SUBMIT       | Manual·TAX | Param:  | [Edit]   ||  Task code (UPPERCASE, <= 48 chars) *        |
|  |    | Statutory pack reminder    | Mandatory  | return_ | [Del 🔒] ||  [ CFO_MARGIN_SIGN_OFF                    ]  |
|  |----+----------------------------+------------+---------+----------||  Arabic title (nameI18n.ar) *                |
|  | 12 | LOCK_GL                    | Lock · GL  | +7d     | [Edit]   ||  [ مراجعة واعتماد هامش الربح الشهري        ]  |
|  |    | Pack lock task             | Blocks lock|         | [Del 🔒] ||  English title (nameI18n.en)                 |
|  |----+----------------------------+------------+---------+----------||  [ Monthly gross margin review sign-off   ]  |
|  | 13 | TREASURY_SAFE_CERTIFY      | Manual · GL| +4d     | [Edit]   ||  Gated module (PeriodModule, optional)       |
|  |    | Tenant manual task (added) | Blocks lock|         | [Delete] ||  [ GL — General Ledger                  v ]  |
|  +-------------------------------------------------------------------+|  Due offset days after period end (0..60) *  |
|  Note: [Del 🔒] on rows #1..#12 is disabled with tooltip explaining   |  [ 5                                      ]  |
|  copied pack tasks cannot be deleted; skip non-applicable tasks       |  Owner role key (<= 64 chars) *              |
|  with a written reason during period close (D-762).                   |  [ accounting_chief_accountant            ]  |
|                                                                       |  [✓] Mandatory task   [✓] Blocks module lock |
|                                                                       |  ------------------------------------------  |
|                                                                       |  [Cancel]              [Save task (If-Match)]|
+-----------------------------------------------------------------------+----------------------------------------------+
```

---

### 7.5 Compact Overview of `#63` & `#108` Lists + `375px` Phone Layout Rules

1. **`#63` (`/accounting/close/checklists`) & `#108` (`/accounting/setup/close-templates`) Desktop `1440px` Rhythm:**
   - Both list screens follow the standard `accounting-patterns-data.md` list template: `PageHeader` (`48px`) -> `#63` 3-tile KPI strip (`76px`) -> `FilterBar` (`44px`) -> `DataTable` (`44px` compact row height, `font-normal` cells, pagination footer `25 / 50 / 100`).
2. **`375px` Mobile Responsive Layout (RTL & LTR):**
   - **`PageHeader`:** Title wraps cleanly above a full-width action row; single `primary` CTA takes `flex-1`, secondary actions (`Refresh`, `Cancel close`) collapse into an accessible `MoreHorizontal` overflow sheet.
   - **`PeriodModuleLockStrip` (`#64`):** Switches from `4`-column horizontal bar (`lg:grid-cols-4`) to a `2×2` compact grid (`grid-cols-2 gap-2`) preserving numerical step prefixes (`1. AR`, `2. AP`, `3. TAX`, `4. GL`) so closing order remains unmistakable without horizontal scroll.
   - **Checklist & Template Tables (`#63`, `#64`, `#108`, `#109`):** Switch below `md` (`768px`) to stacked `DataCard` rows (`accounting-patterns-data.md` §2.4) showing `#seq + localized title + CloseTaskStatus badge` on row 1, `<IdentifierText>{code}</IdentifierText> · module · dueAt` on row 2, and full-width `min-h-11` (`44px` touch target) `Evidence` / contextual action buttons on row 3.
   - **Drawers & Modals (`StartCloseDrawer`, `CloseTaskEvidenceDrawer`, `HardCloseIrreversibleModal`):** Render as full-width bottom sheets (`max-h-[92dvh] overflow-y-auto`) with sticky footer action bars and safe-area bottom padding.

---

## 8. Contract Gap List for `P03.T11` & Bilingual Dictionary Namespace

### 8.1 Contract Gaps Discovered Against Frozen LLD (`P03.T11` Input)

No field, query parameter, or endpoint below is assumed to exist until `P03.T11` amends the frozen contracts; where a gap affects runtime payloads, `SCR-33` degrades safely as noted in the **UI Mitigation** column.

| Gap ID | Severity | Frozen Contract Citation | Exact Contract Gap | Recommended `P03.T11` Resolution & Current UI Mitigation |
| --- | --- | --- | --- | --- |
| **`CG-CLR-01`** | **High** *(blocks Stage 5 `#64` Tab 2 filtering)* | `02_Endpoint_Catalogue.md` §10 line 988 vs `02_DTOs.md` §11.1 lines 3189–3203 | `GET /accounting/close/accrual-supply-decisions` states `(filter by periodId, fiscalDocumentId, status)` in the Endpoint Catalogue, **but `02_DTOs.md` §11.1 omits `AccrualSupplyDecisionListQueryDto`**. Under `forbidNonWhitelisted`, passing `?periodId=` would be rejected unless the DTO class is declared. | Declare `AccrualSupplyDecisionListQueryDto extends FindManyDto { periodId?: UUID; fiscalDocumentId?: UUID; status?: AccrualSupplyDecisionStatus }` in `02_DTOs.md` §11.1. |
| **`CG-CLR-02`** | **High** *(blocks strict DTO typing on 6 write routes)* | `02_Endpoint_Catalogue.md` §10 lines 974–985 vs `02_DTOs.md` §11.2 lines 3229–3292 & `08_close_and_reporting.md` §5 lines 151–168 | `02_DTOs.md` §11.2 omits standalone command DTO interfaces for:<br>1. `POST .../tasks/:taskId/assign` (narrative §5 line 162 names owner `assigneeUserId`)<br>2. `POST /close-instances/:id/cancel` (narrative §5 line 168 requires `reason`; ERD `cancelled_reason` is `varchar(500)` while `MAX_REASON_CHARS` is `1,000`)<br>3. `PATCH /close-templates/:id` (narrative §5 line 151: `nameI18n`, `autoStartOnPeriodEnd`, `isDefault`, `effectiveTo`, `isActive`)<br>4. `PATCH /close-templates/:id/tasks/:taskId` (narrative §5 line 156: mutable fields excluding `code`, `kind`, `dependsOn`).<br>Additionally, `CompleteCloseTaskDto` (`{ taskId, outcome: 'DONE' \| 'SKIPPED', resultRef?, reason? }`) bundles `/complete` and `/skip` and repeats `taskId` in body alongside `:taskId` in URL. | Declare explicit whitelisted DTOs (`CompleteCloseTaskBodyDto`, `SkipCloseTaskDto`, `AssignCloseTaskDto`, `CancelCloseInstanceDto` with explicit `500` vs `1,000` max length, `UpdateCloseTemplateDto`, `UpdateCloseTemplateTaskDto`) in `02_DTOs.md` §11.2. UI restricts `cancel` reason input to `10..500` chars so both bounds pass. |
| **`CG-CLR-03`** | **High** *(blocks Stage 5 manual task lock-gating on `#109`)* | `02_DTOs.md` §11.2 lines 3229–3238 vs `08_close_and_reporting.md` §5 line 155 & `08_Close_and_Reporting_Tables.md` lines 51, 141, 150–151 | Narrative §5 line 155 states that a tenant-added `MANUAL` task on a cloned template *"gates the lock through its `module` and `blocks_lock`"*, yet `CloseTemplateTaskInput` in `02_DTOs.md` §11.2 omits `module?: PeriodModule \| null`, `seq?: number`, `isMandatory?: boolean`, and `blocksLock?: boolean`. | Add `module?: PeriodModule \| null`, `seq?: number`, `isMandatory?: boolean`, and `blocksLock?: boolean` to `CloseTemplateTaskInput` (and `UpdateCloseTemplateTaskDto`) in `02_DTOs.md` §11.2. |
| **`CG-CLR-04`** | **Medium** *(Hard-close request body contract)* | `02_DTOs.md` §11.2 lines 3264–3270 (`LockModuleDto`) vs `08_close_and_reporting.md` §6 `UC-CLR-5` line 569 | `LockModuleDto` marks `module: PeriodModule` as **required**, whereas `UC-CLR-5` (`Hard close`) transitions **every** module of the period to `PERMANENTLY_CLOSED` via `POST /close-instances/:id/lock` and lists inputs as `{ acknowledgeIrreversible: true, reason }` without naming a single `module`. | Clarify in `02_DTOs.md` §11.2 whether `module` is optional when `toState === 'PERMANENTLY_CLOSED' && acknowledgeIrreversible === true`, or confirm `module: PeriodModule.GL` is passed as the sentinel. Until resolved, `useModuleLockAndHardClose` sends `module: PeriodModule.GL, toState: FiscalPeriodState.PERMANENTLY_CLOSED, acknowledgeIrreversible: true, reason`. |
| **`CG-CLR-05`** | **Medium** *(Stage 5 `MANUAL_ACCRUAL` dimensions)* | `02_DTOs.md` §11.2 lines 3276–3281 (`DecideAccrualSupplyDto`) vs `02_DTOs.md` §4.2 (`DimensionSetInput`) & `02_Endpoint_Catalogue.md` §3 | `DecideAccrualSupplyDto.accrualLines[]` accepts `dimensionSetId?: UUID`, whereas `JournalDraftLineInput` accepts `dimensions?: DimensionSetInput` (`members: Array<{ dimensionTypeId, dimensionValueId }>`), and Accounting exposes no endpoint to resolve/create an `acc_dimension_sets.id` UUID from dimension values. | Replace `dimensionSetId?: UUID` on `DecideAccrualSupplyDto.accrualLines[]` with `dimensions?: DimensionSetInput`. Until resolved, UI omits `dimensionSetId` on manual accrual lines. |
| **`CG-CLR-06`** | **Low** *(Query pipe vs URL param)* | `02_DTOs.md` §11.1 line 3194 (`CloseTaskListQueryDto`) vs `02_Endpoint_Catalogue.md` §10 line 971 | `CloseTaskListQueryDto` marks `instanceId: UUID` as **required** in query DTO while route path is `GET /accounting/close-instances/:id/tasks`. | Remove `instanceId` from query DTO (take `:id` from `@Param('id')`) in `02_DTOs.md` §11.1. |
| **`CG-CLR-07`** | **Low** *(Stage 5 template restore discoverability)* | `02_Endpoint_Catalogue.md` §10 line 979 (`POST /close-templates/:id/restore`) vs `CloseTemplateListQueryDto` (`02_DTOs.md` §11.1) | `POST /close-templates/:id/restore` exists, but `CloseTemplateListQueryDto` has no `includeDeleted?: boolean` / `onlyDeleted?: boolean` filter to list soft-deleted templates on `#108`. | Add `includeDeleted?: boolean` to `CloseTemplateListQueryDto` (or confirm restore is in-session undo only). |
| **`CG-CLR-08`** | **Medium** *(Cross-screen `Q14` user/role labels)* | `CloseTaskSummaryDto.assigneeUserId`, `ownerRole`, `hardClosedBy`, `decidedBy` | Accounting stores Core user UUIDs and role keys (`varchar(64)`) without display names. | Shared with `P03` cross-screen `Q14` (Core `/api/tenant/core/v1/...` user/role directory batch lookup); degrades gracefully to `<IdentifierText>` UUID prefix / role key when unavailable. |
| **`CG-CLR-09`** | **Medium** *(Stage 5 template clone body)* | `02_Endpoint_Catalogue.md` §10 lines 975 & 980 vs `02_DTOs.md` §11.2 lines 3240–3249 (`CreateCloseTemplateDto`) | `CreateCloseTemplateDto` requires `tasks: CloseTemplateTaskInput[]` (`1..MAX_CLOSE_TASKS`), yet `08_close_and_reporting.md` §5 line 150 states cloning a pack template via `POST /close-templates` (`sourceTemplateId`) or `POST /close-templates/:id/clone` copies the pack's tasks server-side. | Declare `CloneCloseTemplateDto { code: string; nameI18n: I18nText; isDefault?: boolean; autoStartOnPeriodEnd?: boolean; effectiveFrom: LocalDate; effectiveTo?: LocalDate }` (without requiring `tasks[]`) for `POST /close-templates/:id/clone` and `sourceTemplateId` clones. |

---

### 8.2 Bilingual Dictionary Namespace (`src/lib/i18n/locales/{ar,en}/accountingClose.ts`)

Zero language ternaries appear in JSX (`i18n.md`). All copy resolves from `t.accountingClose.*` and shared `t.enums.*`:
- `t.enums.ClosingType.{MONTH,QUARTER,YEAR}`
- `t.enums.CloseInstanceStatus.{NOT_STARTED,IN_PROGRESS,COMPLETED,CANCELLED}` + `t.accountingClose.badges.hardClosed`
- `t.enums.CloseTaskKind.{SYSTEM_CHECK,SYSTEM_JOB,MANUAL,LOCK}`
- `t.enums.CloseTaskStatus.{PENDING,BLOCKED,RUNNING,DONE,FAILED,SKIPPED,NOT_APPLICABLE}`
- `t.enums.AccrualSupplyDecision.{NO_SUPPLY_IN_PERIOD,MANUAL_ACCRUAL}`
- `t.enums.AccrualSupplyDecisionStatus.{ACTIVE,VOIDED}`
- `t.accountingClose.taskCodes.<CODE>` — localized titles & descriptions for all 18 `ACCOUNTING_CLOSE_TASK_CODES` and 9 `ACCOUNTING_EG_CALENDAR_TASK_CODES` (with `nameI18n[locale] || nameI18n.ar` used for tenant-authored `MANUAL` tasks).

## Contract reconciliation (P03.T11, 1 November 2026)

Reconciles the gaps of this spec against the Endpoint Catalogue and `02_DTOs.md` after `D-770`, `D-771` and `D-772`. The gap list above keeps the original findings; these rulings are final.

| Gap id | Ruling | Where |
| --- | --- | --- |
| `CG-CLR-01` | deferred to stage 5 (P27 definition of ready) | `AccrualSupplyDecisionListQueryDto extends FindManyDto { periodId?, fiscalDocumentId?, status?: AccrualSupplyDecisionStatus }` in DTOs §11.1 |
| `CG-CLR-02 (a)` | closed by D-772 | `CompleteCloseTaskDto { resultRef? }`, `SkipCloseTaskDto { reason }` and `AssignCloseTaskDto { assigneeUserId }` replace the bundled body; the route fixes the outcome and `taskId` leaves the body |
| `CG-CLR-02 (b)` | closed by D-772 | `CancelCloseInstanceDto { reason: 10..500 }` |
| `CG-CLR-02 (c)` | deferred to stage 5 (P27 definition of ready) | `UpdateCloseTemplateDto` (header columns) and the task update (`PartialType(CloseTemplateTaskInput)` minus `code`, `kind`, `dependsOn`) |
| `CG-CLR-03` | deferred to stage 5 (P27 definition of ready) | `CloseTemplateTaskInput` gains `module`, `seq`, `isMandatory`, `blocksLock` |
| `CG-CLR-04` | closed by D-772 | `LockModuleDto.module` is optional: required with `CLOSED`, absent with `PERMANENTLY_CLOSED`; the GL sentinel goes |
| `CG-CLR-05` | deferred to stage 5 (P27 definition of ready) | Replace `dimensionSetId?` with `dimensions?: DimensionSetInput` on `DecideAccrualSupplyDto.accrualLines[]` |
| `CG-CLR-06` | duplicate of CG-SLICE-DOC-09 | Closed by D-772: `CloseTaskListQueryDto` drops `instanceId`, because the path `:id` is the instance |
| `CG-CLR-07` | already in the contract | `withDeleted=true` (inherited `FindManyDto` field, `@SoftDeleteVisibility`); no `includeDeleted?` |
| `CG-CLR-08` | duplicate of the cross-screen `Q14` user and role directory question | Display names for `assigneeUserId`, `ownerRole`, `hardClosedBy` and `decidedBy` resolve centrally in the Core directory lookup, outside the Accounting contract; the spec keeps the UUID or role-key fallback |
| `CG-CLR-09` | already in the contract | `CreateCloseTemplateDto = { sourceTemplateId, nameI18n? }` as declared (a `tasks`, `closingType` or `packCode` field is refused, `D-709`, `D-762`); the proposed `CloneCloseTemplateDto` is dropped |
