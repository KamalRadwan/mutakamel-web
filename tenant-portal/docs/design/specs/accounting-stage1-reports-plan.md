# Accounting Stage-1 Screen Designs — Financial Statements, Trial Balance, Ledgers, Report Definitions & Accounting Plan (`P03.T09.S7`)

> **Lead review, 1 November 2026 (P03.T09).** No correction was needed; The run-artifact download route does not exist and is named only as a contract gap (`CG-DATA-02`, deferred to P27). Every route, permission, feature key and scope below was checked against `docs/LLD/accounting-app/02_API_Contracts/02_Endpoint_Catalogue.md` and `04_Static_Data/05_Permissions_and_Features.md`; what the contracts lack stays in the contract gap list for `P03.T11`.

- **Plan Task:** `P03.T09.S7` — `backend/docs/plans/accounting-app-plan-p03-ux-foundation.md` (`P03.T09` Stage-1 screen designs; lead review)
- **Screen Inventory Rows Covered:**
  - **`SCR-12`** — Financial Statements (six primary EAS/IFRS statements), Trial Balance (`[Slice]`), General Ledger (keyset cursor), Party Ledger (`AR`/`AP`), Ledger Facts & Report Definitions / Line Mappings (`#72`, `#73`, `#112`, `#113`)
  - **`SCR-36`** — Accounting Plan, Feature Entitlements & Wave 1–3 Roadmap (`#118`)
- **Target Portal:** Tenant Portal (`frontend/tenant-portal`, fixed port `5002`, HTTP cookie profile `mutakamel-http-tenant-*` / secure `__Host-mutakamel-tenant-*`, browser Gateway prefix `/api/tenant/accounting/v1`)
- **Last Verified Against Sources:** `2026-11-01`
- **Binding Authorities:**
  - Approved UX Foundation (`frontend/tenant-portal/docs/design/specs/`): `accounting-ia.md` (`P03.T01`), `accounting-home.md` (`P03.T02`), `accounting-status-and-a11y.md` (`P03.T04`), `accounting-patterns-data.md` (`P03.T05`), `accounting-patterns-workflow.md` (`P03.T06`), `accounting-patterns-documents.md` (`P03.T07`), and `docs/plans/accounting-screen-inventory.md` (`P03.T03`)
  - Tenant Portal Design System & Architecture (`frontend/tenant-portal/docs/`): `design/README.md`, `design/tokens.md`, `design/primitives.md`, `design/patterns.md`, `design/views.md`, `design/states.md`, `design/accessibility.md`, `design/i18n.md`, `architecture/data-layer.md`
  - UI/UX Intelligence: `.agents/skills/ui-ux-pro-max/SKILL.md` & `.agents/skills/frontend-design/SKILL.md`
  - Backend Contracts (`backend/docs/LLD/accounting-app/`): `07_Modules/10_MVP/08_close_and_reporting.md` (`UC-CLR-3`, `UC-CLR-4` Stage-1 scope), `07_Modules/10_MVP/02_ledger_posting.md` (`UC-LPO-5`), `10_Feature_Tiers.md` (§5–§11), `02_API_Contracts/02_Endpoint_Catalogue.md` (§4, §10, §12, §13), `02_API_Contracts/01_Context_Headers_and_Responses.md`, `02_API_Contracts/04_Pipes_Guards_Interceptors_and_Middleware.md`, `04_Static_Data/01_Enums.md`, `04_Static_Data/02_DTOs.md` (§5.1, §11.1, §11.3, §13–§13.2), `04_Static_Data/04_Errors_and_Constants.md`, `04_Static_Data/05_Permissions_and_Features.md`, `01_ERD/02_Ledger_Tables.md`, `01_ERD/08_Close_and_Reporting_Tables.md`

---

## 0. Cross-Screen Governance, Design Laws & `< 300`-Line File Architecture

### 0.1 UI/UX Intelligence (`ui-ux-pro-max`) & Tenant Portal Five Laws Enforcement

Every layout, component, token, interaction, and copy string in `SCR-12` and `SCR-36` obeys the approved Tenant Portal design system and `ui-ux-pro-max` enterprise financial workspace rules without redesigning any foundation primitive or pattern:

1. **Barrel-Only Imports & Approved Pattern Reuse:** Feature code imports primitives/patterns exclusively from `@/design-system` (`PageHeader`, `DataTable`, `FilterBar`, `ToolbarSearch`, `FilterChip`, `FilterSelect`, `Button`, `IconButton`, `Badge`, `Tabs`, `Card`, `SectionCard`, `DetailDrawer`, `Modal`, `ConfirmDialog`, `Banner`, `DegradedBanner`, `PermissionGate`, `EmptyState`, `ErrorState`, `Skeleton`, `TableSkeleton`, `Tooltip`, `Switch`, `FormField`, `Select`, `Input`, `DateInput`, `CopyButton`) and approved accounting patterns from `@/features/accounting/patterns` (`AccountingScopeBar`, `AccountingReportViewer`, `StatementTreeTable`, `ReportParameterBar`, `ReportFreshnessBar`, `ReportExportDrawer`, `AccountingLedgerGrid`, `LedgerDrillDrawer`, `Money`, `IdentifierText`, `AccountPicker`, `PartyPicker`, `DimensionFilterPicker`, `FiscalPeriodPicker`, `WaitingStateBadge`, `WaitingStateCallout`, `AccountingBoundaryGate`).
2. **Colour & Typography Discipline:**
   - **Four outcome roles + neutral `ink` ramp:** `brand` (`#0f6cbd` light / `#4ba3f5` dark — focus rings, active tab indicator, and at most **one** `variant="primary"` CTA per screen in `PageHeader` or active toolbar; **never** on a status badge), `positive` (`--status-positive-*`), `caution` (`--status-caution-*`), `negative` (`--status-negative-*`), and `neutral` (`--surface-*` / `--text-*` / `--border-*`).
   - **Three font weights only:** `400` (`font-normal` — mandatory for all `<td>` table body cells including numeric `<Money>` cells), `500` (`font-medium` — labels, column headers, tabs, subtotals), and `600` (`font-semibold` — page titles, section headings, statement `TOTAL` / grand-total footer `<tfoot>`). `font-bold` (`700`), arbitrary `text-[Npx]`, and `rounded-xl`+ are forbidden.
   - **Non-colour cues:** Every status badge pairs its semantic tone with a Lucide icon + `t.status.*` string. Every debit/credit or signed balance renders explicit `DR`/`CR` (`مدين`/`دائن`) or parentheses/sign markers alongside `<Money>` — never colour alone (`accounting-status-and-a11y.md` §1, WCAG 2.2 AA).
3. **Zero Browser Financial Arithmetic:** All opening balances, movements, closing/opening-entry columns (`D-483`), closing balances, running balances, comparatives, variances, statement subtotals/totals, and footer totals come verbatim from server `DecimalString` fields. `Number()`, `parseFloat()`, and client-side `reduce()` over decimal money strings are banned.
4. **Bilingual Parity (`AR-RTL` / `EN-LTR`), Logical Properties & LTR Islands:**
   - Zero language ternaries (`locale === "ar" ? ... : ...`) in JSX; all static copy resolves via `useI18n()` (`t.accounting.reports.*`, `t.accounting.plan.*`, `t.status.*`), and backend `I18nText` (`nameI18n`) resolves via `localizedName(row.nameI18n, locale)` (`ar` fallback when `en` is omitted).
   - Logical CSS properties exclusively (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `text-end`, `border-s`, `border-e`); `pnpm design:rtl` count must stay `0`.
   - Every account code, report/framework code, journal entry number, UUIDv7, SHA-256 hash/checksum, chain sequence (`#4187`), date (`YYYY-MM-DD` / localized `Intl.DateTimeFormat`), and formatted decimal string renders inside `<IdentifierText>` or `<Money>` (`<bdi dir="ltr">`, `unicode-bidi: isolate`, `tabular-nums`, Western digits `0–9` in both `ar-EG-u-nu-latn` and `en-US`).
5. **Transport, UUIDv7 Idempotency & Concurrency:**
   - All requests route through `src/lib/api/axiosClient.ts` (`credentials: "include"`, runtime response validators at the API boundary, `no` `any`).
   - Operating-context headers `x-mutakamel-company-id` (and `x-mutakamel-branch-id` when a branch is selected in `AccountingScopeBar`) attach per Catalogue `Scope target`.
   - Commands declaring `x-idempotency-key` mint one UUIDv7 per user intent via `generateUUIDv7()` (`src/lib/uuid.ts`; never `crypto.randomUUID()`) and reuse that exact key across `CLIENT_REQUEST_TIMEOUT` / `502` / `503` / `504` retries of the same intent.
   - Read-like `POST /api/tenant/accounting/v1/reports/:code/run` declares `Idempotency: none` in Catalogue §10 and sets `{ skipAutoIdempotency: true }` on `axiosClient`.
   - Versioned writes (`POST` / `DELETE` on `/report-definitions/:id/mappings`) send `If-Match: "<definition.version>"` from the latest `ETag` of `GET /report-definitions/:id`.

### 0.2 Delivery Phasing (`[Slice]` vs `[Stage-1 full]`)

| Screen / Route | `P15` Vertical Slice (`[Slice]`) | `P17` Stage-1 Completion (`[Stage-1 full]`) | Stage 2–5 Entitled Extensions |
| --- | --- | --- | --- |
| **`SCR-12` `#72`** `/accounting/close/statements` | Renders `Trial Balance` mode backed by `GET /api/tenant/accounting/v1/reports/trial-balance` (`1` `[P]` endpoint) + drill-down to `SCR-06` (`/accounting/post/journal-entries`). Other `#72` mode tabs are hidden behind Stage-1 completion or only shown once wired in `P17` (never mocked). | Activates `Statements` (`6` primary EAS/IFRS statements via `POST /reports/:code/run` + `GET /reports/runs`), `General Ledger` (`GET /reports/general-ledger` keyset), `Party Ledger` (`GET /reports/party-ledger` when `accounting.receivables.core` entitled), `Ledger Facts` (`GET /ledger-facts`), `Recent Runs` (`GET /reports/runs`), plus `[S]` Snapshot & Export drawers (`SCR-34`). | Domain report shortcuts in `accounting-ia.md` §2.4 (`cash-position`, `cheque-register`, `depreciation-schedule`, `deferrals`) appear **only** when their owning Stage 2–5 feature keys are entitled and wired. |
| **`SCR-12` `#73`** `/accounting/close/statements/[id]` | Async `202` Trial Balance overflow run polling (`GET /reports/runs/:id`) when triggered beyond query budget. | Full `ReportRun` detail & async `202` result viewer for all statement runs + `[S]` `POST /reports/snapshots` & `ReportExportDrawer`. | Unchanged. |
| **`SCR-12` `#112` & `#113`** `/accounting/setup/report-definitions` & `/[id]` | Stage-only (`P17`). | Full Reporting Frameworks (`L G`), Report Definitions (`L G`), Lines (`GET /:id/lines`), Coverage (`GET /:id/coverage`), and Company Line Mappings (`GET`, `POST`, `DELETE`). | Wave 2 (`accounting.reporting.report_builder`): unlocks tenant-authored `CUSTOM` definitions (absent in Basic / MVP). |
| **`SCR-36` `#118`** `/accounting/setup/plan` | Stage-only (`P17`). | Full `GET /api/tenant/accounting/v1/meta/features` plan comparison (`64` keys: `28` Basic MVP + `36` Advanced Waves 1–3) + owner-only `/core/subscription` link. | Live wave status updates automatically from `/meta/features` as Waves 1–3 ship. |

### 0.3 `< 300`-Line File & Hook Split (`docs/architecture/file-architecture.md`)

Every route separates state/API/effects into `hooks/use<Name>.ts` and keeps `.tsx` files strictly declarative and under `~300` lines:

```text
src/app/(tenant)/accounting/
├── close/statements/
│   ├── page.tsx                                        # <45 lines: route metadata + <StatementsWorkspacePage />
│   └── [id]/page.tsx                                   # <45 lines: route params + <ReportRunDetailPage />
└── setup/
    ├── report-definitions/
    │   ├── page.tsx                                    # <45 lines: route metadata + <ReportDefinitionsPage />
    │   └── [id]/page.tsx                               # <45 lines: route params + <ReportDefinitionDetailPage />
    └── plan/
        └── page.tsx                                    # <45 lines: route metadata + <AccountingPlanPage />

src/features/accounting/reports/                        # SCR-12 feature module
├── api/
│   ├── reportsApi.ts                                   # <220 lines: typed axiosClient calls for 16 [P] + [S] snapshot/export routes
│   └── reportsValidators.ts                            # <260 lines: runtime boundary validators (unknown -> typed DTOs, zero Number() on decimals)
├── hooks/
│   ├── useStatementsWorkspace.ts                       # <180 lines: URL-synced mode tab, scope sync, permission/entitlement checks
│   ├── useStatementRunner.ts                           # <240 lines: definitions selector, RunReportDto state, coverage precheck, 200 vs 202 polling
│   ├── useTrialBalanceReport.ts                        # <210 lines: TrialBalanceQueryDto, 200 vs 202 overflow, drill-to-GL handler
│   ├── useGeneralLedgerReport.ts                       # <230 lines: GeneralLedgerQueryDto, keyset cursor stack, LedgerDrillDrawer state
│   ├── usePartyLedgerReport.ts                         # <200 lines: PartyLedgerQueryDto (AR/AP, BALANCE_FORWARD/OPEN_ITEMS), feature gate
│   ├── useLedgerFactsExplorer.ts                       # <170 lines: LedgerFactsQueryDto, asOfChainSeq freshness, isStale banner
│   ├── useReportRunsList.ts                            # <150 lines: ReportRunListQueryDto pagination & status badges
│   ├── useReportRunDetail.ts                           # <220 lines: GET /reports/runs/:id, Retry-After polling, snapshot creation (UUIDv7)
│   ├── useReportDefinitionsList.ts                     # <170 lines: frameworks + definitions queries & filters (#112)
│   └── useReportDefinitionMappings.ts                  # <260 lines: lines tree, coverage check, ETag/If-Match + UUIDv7 mapping create/delete (#113)
└── components/
    ├── StatementsWorkspacePage.tsx                     # <210 lines: PageHeader + mode Tabs + active sub-view mount (#72)
    ├── PrimaryStatementPanel.tsx                       # <240 lines: 6-statement selector + coverage alert + AccountingReportViewer + StatementTreeTable
    ├── TrialBalancePanel.tsx                           # <230 lines: TrialBalanceQueryDto bar + D-483 4-column balance table + server tfoot
    ├── GeneralLedgerPanel.tsx                          # <240 lines: GeneralLedgerQueryDto bar + AccountingLedgerGrid (keyset) + LedgerDrillDrawer
    ├── PartyLedgerPanel.tsx                            # <230 lines: AR/AP toggle + PartyPicker + Open-Items/Balance-Forward grid
    ├── LedgerFactsPanel.tsx                            # <200 lines: period/account/dimension fact table + chain seq + stale indicator
    ├── ReportRunsHistoryPanel.tsx                      # <180 lines: recent acc_report_runs DataTable -> links to #73
    ├── ReportRunDetailPage.tsx                         # <240 lines: #73 async progress / completed statement / failed run + snapshot/export drawers
    ├── CreateSnapshotModal.tsx                         # <170 lines: [S] POST /reports/snapshots modal (optional filedWithReturnPeriodId)
    ├── ReportDefinitionsPage.tsx                       # <220 lines: #112 frameworks strip + definitions DataTable
    ├── ReportDefinitionDetailPage.tsx                  # <250 lines: #113 header + Line Tree | Unmapped Coverage | Mappings tabs
    └── MappingFormDrawer.tsx                           # <230 lines: CreateReportLineMappingDto DetailDrawer (ACCOUNT/SUBTREE/ROLE/TAG)

src/features/accounting/plan/                           # SCR-36 feature module
├── api/
│   ├── planApi.ts                                      # <90 lines: GET /api/tenant/accounting/v1/meta/features
│   └── planValidators.ts                               # <140 lines: runtime validator for meta/features response
├── constants/
│   └── featureCatalogue.ts                             # <260 lines: static bilingual metadata map for the 64 canonical keys (10_Feature_Tiers.md §6)
├── hooks/
│   └── useAccountingPlan.ts                            # <210 lines: /meta/features query, domain/tier/wave filters, downgrade & owner link derivation
└── components/
    ├── AccountingPlanPage.tsx                          # <230 lines: PageHeader + PlanSummaryStrip + FilterBar + FeatureDomainMatrix + AddOnBoundaryNote
    ├── PlanSummaryStrip.tsx                            # <160 lines: Active Tier, Seat Access, Company Activation, Included Keys & Downgrade callout
    └── FeatureDomainMatrix.tsx                         # <240 lines: 9 domain SectionCards rendering all 64 keys with entitlement & wave badges
```

---

## 1. Screen `SCR-12` — Financial Statements, Trial Balance, General Ledger, Party Ledger, Ledger Facts & Report Definitions

### 1.1 Purpose, Routes & Information Architecture Integration

`SCR-12` is the Stage-1 statutory reporting and ledger inspection surface (`UC-LPO-5`, `UC-CLR-3`, `UC-CLR-4` Stage-1 scope; `ACT-13`, `POST-11`, `CLOSE-08`, `CLOSE-12`; `SCN-031`..`SCN-033`, `SCN-076`). Per `accounting-ia.md` §2.4, §5 (`#72`, `#73`, `#112`, `#113`), it spans two IA sections linked by contextual cross-links:

| Route ID & Path (`TENANT_ROUTES`) | IA Section & Nav Item | Screen Role | Route Admission (`Permission` + `Feature key`) |
| --- | --- | --- | --- |
| **`#72`** `/accounting/close/statements` (`accountingStatements`) | `Close / الإقفال والتقارير` → `Statements & Ledgers / القوائم الماليةودفاتر الأستاذ` | Unified reporting workspace with URL-persisted `?view=` mode tabs:<br>1. **`statements`** — Six primary EAS/IFRS financial statements (`POST /reports/:code/run`)<br>2. **`trial-balance`** — Trial Balance (`GET /reports/trial-balance`) **`[Slice default in P15]`**<br>3. **`general-ledger`** — Keyset General Ledger (`GET /reports/general-ledger`)<br>4. **`party-ledger`** — AR/AP Party Ledger (`GET /reports/party-ledger`; tab rendered **only** when `accounting.receivables.core` is entitled)<br>5. **`ledger-facts`** — Period × Account × Dimension projection (`GET /ledger-facts`)<br>6. **`runs`** — Report Run History (`GET /reports/runs`) | Permission: `accounting.report.read`<br>Feature: `accounting.reporting.statements` *(tab `party-ledger` additionally requires `accounting.receivables.core`; absent if unentitled)* |
| **`#73`** `/accounting/close/statements/[id]` | `Close / الإقفال والتقارير` (breadcrumb child of `#72`) | Report Run detail & async `202` job result viewer (`GET /reports/runs/:id`): displays run metadata (`definitionVersion`, `definitionContentHash`, `mappingSetHash`, `asOfChainPositions`, `checksum`, `expiresAt`), live `QUEUED`/`RUNNING` progress, rendered statement result when `COMPLETED`, snapshot link/action, and `ReportExportDrawer`. | Permission: `accounting.report.read`<br>Feature: `accounting.reporting.statements` |
| **`#112`** `/accounting/setup/report-definitions` (`accountingSetupReportDefinitions`) | `Setup / الإعدادات والتهيئة` → `Report Definitions / تعريفات التقارير` | Read-only system Reporting Frameworks strip (`EAS`, `IFRS`, `IFRS_SME`, `SOCPA`, `ZAKAT`, `UNIFORM_EG`, `CUSTOM`) + filterable Report Definitions catalogue (`DRAFT`, `PUBLISHED`, `RETIRED`). Note: In Basic / MVP, `accounting.reporting.report_builder` (Wave 2) is unentitled, so `New Custom Definition` is **absent** (`10_Feature_Tiers.md` §11). | Permission: `accounting.report.read`<br>Feature: `accounting.reporting.statements` |
| **`#113`** `/accounting/setup/report-definitions/[id]` | `Setup / الإعدادات والتهيئة` (breadcrumb child of `#112`; also linked directly from `#72` `422 DEFINITION_INCOMPLETE` alert) | Report Definition inspector with three tabs:<br>1. **`lines`** — Immutable hierarchical `acc_report_lines` tree (`HEADER`, `DETAIL`, `SUBTOTAL`, `TOTAL`, `NOTE_REF`)<br>2. **`coverage`** — Company postable-account coverage check (`GET /:id/coverage`), listing every unmapped postable account with `1`-click `Map Account` action<br>3. **`mappings`** — Company `acc_report_line_mappings` table (`ACCOUNT`, `ACCOUNT_SUBTREE`, `ACCOUNT_ROLE`, `TAG`) + `Add Mapping` drawer (`POST /:id/mappings`) & `Remove Mapping` `ConfirmDialog` (`DELETE /:id/mappings/:mappingId`). | Read: `accounting.report.read`<br>Write actions (`Add` / `Delete` mapping): `accounting.report.manage_definitions`<br>Feature: `accounting.reporting.statements` |

#### The Six Primary Financial Statements on `#72` (`view=statements`)

Per `08_close_and_reporting.md` (`UC-CLR-3`), `02_Endpoint_Catalogue.md` §10 & §12, and `01_Enums.md` (`StatementKind`), the statement selector groups published definitions (`status = 'PUBLISHED'`) of the company's adopted framework (`EAS` for Egypt pack `EG`, `IFRS` / `SOCPA` / etc. per pack) into the **six primary statutory statements** (plus additional published pack audit/analytical definitions when present; Advanced `FLUX` and `EXECUTIVE_SUMMARY` are **absent** from the server response unless `accounting.reporting.flux_executive` [Wave 1] is entitled):

| # | Statutory Statement (`AR` / `EN`) | `StatementKind` Wire Member(s) | Shipped EG Pack Definition `code` Examples (`08_close_and_reporting.md`) | Presentation Variant Toggle |
| --- | --- | --- | --- | --- |
| **1** | **قائمة المركز المالي / Balance Sheet (Statement of Financial Position)** | `BALANCE_SHEET` | `EG_BALANCE_SHEET` (EAS 1) / `IFRS_BALANCE_SHEET` | — |
| **2** | **قائمة الدخل (الأرباح أو الخسائر) / Income Statement (Profit or Loss)** | `INCOME_STATEMENT_NATURE`, `INCOME_STATEMENT_FUNCTION` | `EG_INCOME_STATEMENT_NATURE`, `EG_INCOME_STATEMENT_FUNCTION` | Segmented toggle when both definitions are `PUBLISHED`: `حسب طبيعة المصروف / By Nature` (`INCOME_STATEMENT_NATURE`) vs `حسب وظيفة المصروف / By Function` (`INCOME_STATEMENT_FUNCTION`) |
| **3** | **قائمة الدخل الشامل الآخر / Statement of Other Comprehensive Income** | `COMPREHENSIVE_INCOME` | `EG_COMPREHENSIVE_INCOME` | — |
| **4** | **قائمة التغيرات في حقوق الملكية / Statement of Changes in Equity** | `CHANGES_IN_EQUITY` | `EG_CHANGES_IN_EQUITY` | — |
| **5** | **قائمة التدفقات النقدية / Statement of Cash Flows** | `CASH_FLOW_INDIRECT`, `CASH_FLOW_DIRECT` | `EG_CASH_FLOW_INDIRECT`, `EG_CASH_FLOW_DIRECT` | Segmented toggle when both definitions are `PUBLISHED`: `الطريقة غير المباشرة / Indirect Method` (`CASH_FLOW_INDIRECT`, default) vs `الطريقة المباشرة / Direct Method` (`CASH_FLOW_DIRECT`) |
| **6** | **الإيضاحات المتممة للقوائم المالية / Notes to the Financial Statements** | `NOTES` | `EG_NOTES` | Cross-linked from `NOTE_REF` badges (`إيضاح ١٢` / `Note 12`) on statements 1–5 |

#### Cross-Screen Drill-Through Chain (`SCR-12` ↔ `SCR-06` ↔ `SCR-02`)

1. **Statement `DETAIL` line (`#72` / `#73`) → Trial Balance or General Ledger (`#72`):** Clicking any `DETAIL` row in `StatementTreeTable` navigates to `?view=trial-balance` (or `?view=general-ledger` via row action) pre-filtered by the mapped `accountId[]` / `accountRole[]` and the statement's `fromDate`..`toDate` (`asOfDate = toDate`), preserving Company/Branch scope.
2. **Trial Balance account row (`#72?view=trial-balance`) → General Ledger (`#72?view=general-ledger`):** Clicking an account row or its movement cell switches to `view=general-ledger` pre-filtered to `accountId=[row.accountId]` and the selected fiscal period's `fromDate`..`toDate`.
3. **General Ledger / Party Ledger row (`#72`) → `LedgerDrillDrawer` → `SCR-06` (`#15` `/accounting/post/journal-entries/[id]`):** Clicking a ledger movement opens `LedgerDrillDrawer` (`accounting-patterns-data.md` §1) showing the immutable `JournalEntryDetailDto` (`entryNo`, `chainSeq`, `entryHash`, lines, source link) with a `Link` to full entry detail `#15`.
4. **Coverage warning (`#72` `422 ACCOUNTING.REPORT.DEFINITION_INCOMPLETE`) → `#113` (`?tab=coverage`):** Deep-links directly to `/accounting/setup/report-definitions/[definitionId]?tab=coverage` so an authorized accountant (`accounting.report.manage_definitions`) maps the unmapped postable accounts and re-runs the statement.

---

### 1.2 Approved Pattern & `@/design-system` Component Composition (`SCR-12`)

| Surface / Zone | Reused Component (`@/design-system` or `@/features/accounting/patterns`) | Binding Contract & UX Rules |
| --- | --- | --- |
| **Shell & Operating Scope** | `PageHeader`, `AccountingScopeBar` (`accounting-ia.md` §4) | Displays Company selector (`x-mutakamel-company-id`, mandatory for `COMPANY` / `COMPANY_OR_BRANCH` routes) and Branch selector (`x-mutakamel-branch-id`, `All Branches / كل الفروع` vs specific branch). Ledger selector is **hidden** when `accounting.ledger.multi_ledger` is not entitled (Basic defaults silently to `PRIMARY`, `D-019`). |
| **Primary Statements (`#72?view=statements`, `#73`)** | `AccountingReportViewer`, `ReportParameterBar`, `ReportFreshnessBar`, `StatementTreeTable`, `WaitingStateCallout`, `CreateSnapshotModal`, `ReportExportDrawer` (`accounting-patterns-data.md` §4, `accounting-patterns-workflow.md` §4) | Parameter bar enforces dirty-parameter banner when inputs change after a run; `StatementTreeTable` renders `depth 1..8` logical indentation (`ps-[calc((depth-1)*1.25rem)]`), `HEADER` (`font-semibold`), `DETAIL` (`font-normal`), `SUBTOTAL` (`font-medium border-t`), `TOTAL` (`font-semibold border-t-2 border-b-4 border-double`), `NOTE_REF` (`Badge` link to `NOTES`), and `includeUnposted: true` non-statutory caution watermark. |
| **Trial Balance (`#72?view=trial-balance`)** | `ReportParameterBar`, `ReportFreshnessBar`, `DataTable`, `<Money>`, `<IdentifierText>` | Renders account code (`LTR`), localized account name, `AccountRole` chip, Opening (`DR`/`CR` or signed), Period Movement (`Debit` / `Credit`), Closing/Opening Year-End Entry column (`D-483` so `Opening + Movement + ClosingEntry = Closing` holds visibly on closed years), Closing Balance, and optional `comparativeAsOfDate` column + sticky `<tfoot>` server totals. |
| **General Ledger (`#72?view=general-ledger`)** | `ReportParameterBar`, `ReportFreshnessBar`, `AccountingLedgerGrid` (keyset `cursor`), `LedgerDrillDrawer` (`accounting-patterns-data.md` §1) | Keyset cursor pagination only (`Next` / `Previous` cursor stack; **no** page-number jumper and **no** total row count, `02_DTOs.md` §13 line 4213). Sticky server `openingBalance` row at top and server `closingBalance` row at bottom. Non-dismissible `Banner` (`tone="caution"`) when `includeReversals === false` warning that balances will not reconcile to the Trial Balance (`02_DTOs.md` line 3405). |
| **Party Ledger (`#72?view=party-ledger`)** | `ReportParameterBar`, `PartyPicker` (`accounting-patterns-data.md` §3.2), `AccountingLedgerGrid`, `LedgerDrillDrawer` | Segmented `SubledgerSide` switch (`AR — العملاء` / `AP — الموردون`) + `StatementStyle` switch (`BALANCE_FORWARD` default: opening + chronological movements + running closing balance agreeing with control account vs `OPEN_ITEMS`: unsettled/settled open items with due dates and residual amounts). |
| **Ledger Facts (`#72?view=ledger-facts`)** | `FilterBar`, `FiscalPeriodPicker`, `AccountPicker`, `DimensionFilterPicker`, `ReportFreshnessBar`, `DataTable` | Displays pre-aggregated `acc_ledger_facts` rows (`opening`, `debit`, `credit`, `closing` in `Txn` and `Functional` currencies; `Group` columns hidden unless `accounting.integration.consolidation` Wave 2 is entitled), `lineCount`, `asOfChainSeq`, and a `caution` badge + `Banner` if any row has `isStale === true`. |
| **Definitions & Mappings (`#112`, `#113`)** | `FilterBar`, `DataTable`, `Tabs`, `SectionCard`, `DetailDrawer`, `ConfirmDialog`, `AccountPicker` | `#112` lists system/pack frameworks and definitions. `#113` inspects immutable `acc_report_lines`, runs live `GET /:id/coverage` for the selected company, and edits company-scoped `acc_report_line_mappings` with optimistic concurrency (`ETag` / `If-Match`) and UUIDv7 idempotency. |

---

### 1.3 Verbatim Action & Endpoint Catalogue Mapping (`SCR-12`)

Every route, method, permission, feature key, scope target, idempotency rule, concurrency header, and response contract is copied **verbatim** from `02_Endpoint_Catalogue.md` §4, §10, and §12. No route or key is invented.

#### 1.3.1 Primary Endpoints Owned by `SCR-12` (`[P: 16]`)

| # | UI Action & Surface | Method | Browser Gateway Path (`/api/tenant/accounting/v1/...`) | Catalogue Path | Permission (`05_Permissions`) | Feature Key (`10_Feature_Tiers`) | Scope Target | Idempotency | Concurrency | Response & UI Handling |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **1** | **Run / Refresh Trial Balance** (`#72?view=trial-balance`) **`[Slice]`** | `GET` | `/api/tenant/accounting/v1/reports/trial-balance` | `/accounting/reports/trial-balance` | `accounting.report.read` | `accounting.reporting.statements` | `COMPANY_OR_BRANCH` | `none` | `none` | `200` inline table + `asOf` / `asOfChainSeq`; or `202` + `Location` (`/reports/runs/:id`) + `Retry-After` beyond query budget (`D-165`). |
| **2** | **Load / Page General Ledger** (`#72?view=general-ledger`) | `GET` | `/api/tenant/accounting/v1/reports/general-ledger` | `/accounting/reports/general-ledger` | `accounting.report.read` | `accounting.reporting.statements` | `COMPANY_OR_BRANCH` | `none` | `none` | `200` with keyset paging (`data.items` + `data.pageInfo { nextCursor, hasMore }`) + `asOf` / `asOfChainSeq`. |
| **3** | **Load Party Ledger (`AR`/`AP`)** (`#72?view=party-ledger`) | `GET` | `/api/tenant/accounting/v1/reports/party-ledger` | `/accounting/reports/party-ledger` | `accounting.report.read` | `accounting.receivables.core` | `COMPANY_OR_BRANCH` | `none` | `none` | `200` (`EnvelopeMetaDto` paged list + `asOf`). Tab hidden if `accounting.receivables.core` not entitled (the party ledger sits under that Basic key for both `AR` and `AP`, with the branch from `x-mutakamel-branch-id`). |
| **4** | **Query Ledger Facts Projection** (`#72?view=ledger-facts`) | `GET` | `/api/tenant/accounting/v1/ledger-facts` | `/accounting/ledger-facts` | `accounting.report.read` | `accounting.reporting.statements` | `COMPANY` | `none` | `none` | `200` + `asOfChainSeq` (`EnvelopeMetaDto` paged `LedgerFactSummaryDto[]`). |
| **5** | **List Reporting Frameworks** (`#112`, `#72` filter) | `GET` | `/api/tenant/accounting/v1/reporting-frameworks` | `/accounting/reporting-frameworks` | `accounting.report.read` | `accounting.reporting.statements` | `TENANT` | `none` | `none` | `200` (`ReportingFrameworkSummaryDto[]`). |
| **6** | **Inspect Reporting Framework** (`#112` info drawer) | `GET` | `/api/tenant/accounting/v1/reporting-frameworks/:id` | `/accounting/reporting-frameworks/:id` | `accounting.report.read` | `accounting.reporting.statements` | `TENANT` | `none` | `none` | `200` (`ReportingFrameworkDetailDto`). |
| **7** | **List Report Definitions** (`#112`, `#72` statement picker) | `GET` | `/api/tenant/accounting/v1/report-definitions` | `/accounting/report-definitions` | `accounting.report.read` | `accounting.reporting.statements` | `TENANT` | `none` | `none` | `200` (`ReportDefinitionSummaryDto[]`). |
| **8** | **Load Report Definition Detail** (`#113`, `#73` metadata) | `GET` | `/api/tenant/accounting/v1/report-definitions/:id` | `/accounting/report-definitions/:id` | `accounting.report.read` | `accounting.reporting.statements` | `TENANT` | `none` | `none` | `200` + `ETag: "<version>"` (`ReportDefinitionDetailDto`; `version` captured for mapping `If-Match`). |
| **9** | **Load Definition Line Tree** (`#113?tab=lines`) | `GET` | `/api/tenant/accounting/v1/report-definitions/:id/lines` | `/accounting/report-definitions/:id/lines` | `accounting.report.read` | `accounting.reporting.statements` | `TENANT` | `none` | `none` | `200` (`ReportLineDetailDto[]`, ordered by `sequenceNo`). |
| **10** | **Check Company Account Coverage** (`#113?tab=coverage`, `#72` precheck) | `GET` | `/api/tenant/accounting/v1/report-definitions/:id/coverage` | `/accounting/report-definitions/:id/coverage` | `accounting.report.read` | `accounting.reporting.statements` | `COMPANY` | `none` | `none` | `200` `ReportCoverageDto` naming every postable account still unmapped at `resolutionDate` (`D-104`, `D-770`). |
| **11** | **List Company Line Mappings** (`#113?tab=mappings`) | `GET` | `/api/tenant/accounting/v1/report-definitions/:id/mappings` | `/accounting/report-definitions/:id/mappings` | `accounting.report.read` | `accounting.reporting.statements` | `COMPANY` | `none` | `none` | `200` (`ReportLineMappingSummaryDto[]` for the resolved `COMPANY`). |
| **12** | **Create Company Line Mapping** (`#113` `MappingFormDrawer`) | `POST` | `/api/tenant/accounting/v1/report-definitions/:id/mappings` | `/accounting/report-definitions/:id/mappings` | `accounting.report.manage_definitions` | `accounting.reporting.statements` | `COMPANY` | `x-idempotency-key` (`UUIDv7`) | `If-Match` | `201` (`ReportLineMappingDetailDto`) + refreshes `ETag` & re-runs coverage check. |
| **13** | **Delete Company Line Mapping** (`#113` `ConfirmDialog`) | `DELETE` | `/api/tenant/accounting/v1/report-definitions/:id/mappings/:mappingId` | `/accounting/report-definitions/:id/mappings/:mappingId` | `accounting.report.manage_definitions` | `accounting.reporting.statements` | `COMPANY` | `x-idempotency-key` (`UUIDv7`) | `If-Match` | `204` + refreshes `ETag` & re-runs coverage check. |
| **14** | **Run Financial Statement** (`#72?view=statements`) | `POST` | `/api/tenant/accounting/v1/reports/:code/run` | `/accounting/reports/:code/run` | `accounting.report.run` | `accounting.reporting.statements` | `COMPANY_OR_BRANCH` | `none` (`skipAutoIdempotency: true`) | `none` | `200` inline rendered projection; or `202` + `Location` (`/reports/runs/:id`) + `Retry-After` beyond query budget (`D-165`). Refused `422 ACCOUNTING.REPORT.DEFINITION_INCOMPLETE` if unmapped postable accounts exist (`D-104`). |
| **15** | **List Report Runs** (`#72?view=runs`) | `GET` | `/api/tenant/accounting/v1/reports/runs` | `/accounting/reports/runs` | `accounting.report.read` | `accounting.reporting.statements` | `COMPANY` | `none` | `none` | `200` (`ReportRunSummaryDto[]` + `meta`). |
| **16** | **Poll / View Report Run Detail** (`#73`, inline async banner on `#72`) | `GET` | `/api/tenant/accounting/v1/reports/runs/:id` | `/accounting/reports/runs/:id` | `accounting.report.read` | `accounting.reporting.statements` | `COMPANY` | `none` | `none` | `200` (`ReportRunDetailDto`; polls on `Retry-After` while `QUEUED` or `RUNNING` until `COMPLETED` or `FAILED`). |

#### 1.3.2 Shared `[S]` Endpoints Invoked from `SCR-12` (Owned by `SCR-34`, `SCR-02`, `SCR-03`, `SCR-04`, `SCR-06`, `SCR-15`)

| Shared Action / Picker | Method & Browser Gateway Path | Permission | Feature Key | Scope Target | Idempotency / Concurrency | Primary Owner |
| --- | --- | --- | --- | --- | --- | --- |
| **Freeze Immutable Report Snapshot** (`CreateSnapshotModal`) | `POST /api/tenant/accounting/v1/reports/snapshots` | `accounting.report.snapshot` | `accounting.reporting.snapshots` | `COMPANY` | `x-idempotency-key` (`UUIDv7`) / `none` *(body `CreateReportSnapshotDto { runId, filedWithReturnPeriodId? }`, answered with `ReportSnapshotDetailDto`, `D-770`)* | `SCR-34` |
| **Read Snapshot Metadata & Artifact URL** | `GET /api/tenant/accounting/v1/reports/snapshots/:id` | `accounting.report.read` | `accounting.reporting.snapshots` | `COMPANY` | `none` / `none` | `SCR-34` |
| **List Export Definitions** (`ReportExportDrawer`) | `GET /api/tenant/accounting/v1/export-definitions` | `accounting.export.read` | `accounting.reporting.snapshots` | `TENANT` | `none` / `none` | `SCR-34` |
| **Start Statutory / Inspector Export** (`ReportExportDrawer`) | `POST /api/tenant/accounting/v1/exports/:code/run` | `accounting.export.run` | `accounting.reporting.snapshots` | `COMPANY` | `x-idempotency-key` (`UUIDv7`) / `none` (`202` + `Location` + `Retry-After`) | `SCR-34` |
| **Poll Export Run & Fetch Signed URL** | `GET /api/tenant/accounting/v1/exports/runs/:id`<br>`GET /api/tenant/accounting/v1/exports/runs/:id/download` | `accounting.export.read`<br>`accounting.export.download` | `accounting.reporting.snapshots` | `COMPANY` | `none` / `none` (`SignedDownloadDto`) | `SCR-34` |
| **Account Picker (`AccountPicker`)** | `POST /api/tenant/accounting/v1/accounts/lookup` | `accounting.account.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | `none` / `none` | `SCR-02` |
| **Fiscal Year & Period Picker (`FiscalPeriodPicker`)** | `GET /api/tenant/accounting/v1/fiscal-years`<br>`GET /api/tenant/accounting/v1/periods` | `accounting.calendar.read`<br>`accounting.period.read` | `accounting.ledger.core` | `COMPANY` | `none` / `none` | `SCR-11` |
| **Journal Filter (`GeneralLedgerQueryDto.journalId`)** | `GET /api/tenant/accounting/v1/journals` | `accounting.journal.read` | `accounting.ledger.core` | `COMPANY` | `none` / `none` | `SCR-03` |
| **Dimension Filter (`DimensionFilterPicker`)** | `GET /api/tenant/accounting/v1/dimension-types`<br>`POST /api/tenant/accounting/v1/dimension-values/lookup` | `accounting.dimension.read` | `accounting.ledger.core` | `COMPANY` | `none` / `none` | `SCR-04` |
| **Party Picker (`PartyPicker`)** | `GET /api/tenant/core/v1/directory/parties` *(or `POST /api/tenant/accounting/v1/party-finance-profiles/lookup`, whose `PartyFinanceProfileLookupItemDto` returns `partyId` and a Core-derived `label`, `D-770`)* | `directory.party.read` *(fallback: `accounting.party_finance_profile.read`)* | `accounting.ledger.core` | `TENANT` / `COMPANY` | `none` / `none` | Core / `SCR-04` |
| **Ledger Entry Drill-Down (`LedgerDrillDrawer`)** | `GET /api/tenant/accounting/v1/journal-entries/:id`<br>`GET /api/tenant/accounting/v1/journal-entries/:id/lines` | `accounting.journal_entry.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | `none` / `none` | `SCR-06` |

---

### 1.4 Complete Field & Filter-to-DTO Mapping (`SCR-12`)

> **Contract Honesty Note:** Every request/query field below exists verbatim in `02_DTOs.md` §5.1, §11.1, §11.3. Every table-backed response field follows `02_DTOs.md` §13.1 (`08_Close_and_Reporting_Tables.md` & `02_Ledger_Tables.md`). The computed report and ledger payloads are declared in `02_DTOs.md` (`D-770`: `RenderedReportDto`, `TrialBalanceDto`, `GeneralLedgerPageDto`, `PartyLedgerDto`, `ReportCoverageDto`, `ReportSnapshotDetailDto`), and Section 4 keeps the original findings.

#### Table 1.4A — Primary Financial Statements (`POST /reports/:code/run` & `#73` `GET /reports/runs/:id`)

| Direction | UI Control / Column | Arabic Label (`ar`) | English Label (`en`) | Verbatim DTO & Member | Wire Type / Enum & Validation Bounds | Formatting & UX Rules |
| --- | --- | --- | --- | --- | --- | --- |
| **Path** | Statement Selector + Presentation Toggle | التقرير المالي | Financial Statement | Path `:code` (from `ReportDefinitionSummaryDto.code`) | `string` (`^[A-Z0-9][A-Z0-9._-]{1,63}$`, `status === 'PUBLISHED'`) | Grouped by the 6 primary `StatementKind` families; `By Nature`/`By Function` and `Indirect`/`Direct` switch `:code`. |
| **Body** | Period Range Start | من تاريخ | From Date | `RunReportDto.fromDate` | `ISODate` (`YYYY-MM-DD`), **required** | `FiscalPeriodPicker` quick-fills period `startDate`..`endDate`; `Balance Sheet` defaults `fromDate` to fiscal year start and `toDate` to period end. |
| **Body** | Period Range End | إلى تاريخ | To Date | `RunReportDto.toDate` | `ISODate`, **required**, `>= fromDate`, span `<= 3` fiscal years (`MAX_REPORT_YEARS`) | Validated client-side before submit + server-enforced (`400 ACCOUNTING.VALIDATION.FAILED`). |
| **Body** | Ledger | دفتر الأستاذ | Ledger | `RunReportDto.ledgerId` | `UUID` (optional; defaults to `PRIMARY`) | Hidden when `accounting.ledger.multi_ledger` is unentitled (`10_Feature_Tiers.md` §11). |
| **Body** | Comparative Period | فترة المقارنة | Comparative Period | `RunReportDto.comparativePeriod` | `{ fromDate: ISODate; toDate: ISODate }` (optional; auto-filled with prior period/year when `definition.comparativesRequired === true`) | Preset chips: `Prior Year Same Period / نفس الفترة للعام السابق`, `Prior Period / الفترة السابقة`, `Custom / مخصص`. |
| **Body** | Analytical Dimensions | الأبعاد التحليلية | Dimensions | `RunReportDto.dimensionFilter` | `Array<{ dimensionTypeId: UUID; dimensionValueIds: UUID[] }>` (max `4` types, max `200` values each) | `DimensionFilterPicker` popover. |
| **Body** | Currency Mode | عرض العملة | Currency Mode | `RunReportDto.currencyMode` | `'FUNCTIONAL' \| 'TRANSACTION'` (default `'FUNCTIONAL'`) | `GROUP` is excluded in MVP (`01_Enums.md` line 3707). |
| **Body** | Include Unposted Drafts | تضمين المسودات غير المرحّلة | Include Unposted Drafts | `RunReportDto.includeUnposted` | `boolean` (strict, default `false`; forbidden when `snapshot === true`) | When `true`, renders persistent `caution` banner + print watermark: `مسودة غير قانونية — تتضمن قيوداً غير مرحّلة / Non-Statutory Preview — Includes Unposted Drafts`. |
| **Body** | Freeze Snapshot on Run | حفظ كلقطة غير قابلة للتعديل | Save Immutable Snapshot | `RunReportDto.snapshot` | `boolean` (optional; visible only if `accounting.reporting.snapshots` entitled & `accounting.report.snapshot` held; without a filing it writes an on-demand snapshot and leaves the run's `snapshotId` null, `D-770`) | Disabled when `includeUnposted === true`. |
| **Body** | Pin to Tax Return Period | ربط بفترة إقرار ضريبي | Link to Tax Return Period | `RunReportDto.filedWithReturnPeriodId` | `UUID` (optional; active only when `snapshot === true`) | Populated when freezing a statement as filing evidence (`D-166`). |
| **Query (`#72?view=runs`)** | Run History Filters | تصفية سجل التشغيل | Run History Filters | `ReportRunListQueryDto`: `definitionId?`, `fromGeneratedAt?`, `toGeneratedAt?`, `page?`, `limit?`, `sort?` | `UUID`, `ISO8601`, `FindManyDto` | Renders run audit trail on `#72?view=runs`. |
| **Resp (`#73` & `202`)** | Run Metadata & Freshness | بيانات التشغيل والحداثة | Run Metadata & Freshness | `ReportRunDetailDto` (`§13.1` of `acc_report_runs`): `id`, `definitionId`, `definitionVersion`, `definitionContentHash`, `mappingSetHash`, `ledgerId`, `parameters`, `status` (`ReportRunStatus`), `asOfChainPositions` (`Record<UUID, number>`), `checksum`, `rowCount`, `includeUnposted`, `snapshotId`, `filedWithReturnPeriodId`, `filedWithFiscalYearId`, `errorCode`, `generatedBy`, `queuedAt`, `startedAt`, `completedAt`, `expiresAt`, `version` | `ReportRunStatus`: `QUEUED \| RUNNING \| COMPLETED \| FAILED`; `Sha256Hex` hashes | `ReportFreshnessBar` displays `completedAt`, per-FY `asOfChainPositions` (`<IdentifierText>#seq</IdentifierText>`), and truncated `checksum` with `CopyButton`. `artifact_ref` is withheld per `§13.1`; `GET /reports/runs/:id` answers the run row alone, because `acc_report_runs` stores no lines (`D-770`). |
| **Resp (`200` / `COMPLETED`)** | Rendered Statement Lines | بنود القائمة المالية | Statement Line Rows | `RenderedReportDto` (`200` of `POST /reports/:code/run` within the query budget): `run` (`ReportRunDetailDto`), `snapshotId`, `statementKind`, `currencyCode`, `columns[]` (`key` `CURRENT` or `COMPARATIVE`, `fromDate`, `toDate`), `lines: RenderedReportLine[]` (`lineCode`, `parentLineCode`, `depth` `1..8`, `lineKind`, `nameI18n`, `noteRef`, `isBold`, `hideWhenZero`, `values[]` one `DecimalString \| null` per column), `asOf`, `asOfChainPositions` (`D-770`) | `DecimalString` (scale `<= 8`), `ReportLineKind` | Rendered in `StatementTreeTable`; `hideWhenZero` hides zero `DETAIL` lines unless user toggles `Show hidden zero lines` (when server sends them) or re-queries. Zero browser math. |

#### Table 1.4B — Trial Balance (`GET /reports/trial-balance` — `[Slice]` & `[Stage-1 full]`)

| Direction | UI Control / Column | Arabic Label (`ar`) | English Label (`en`) | Verbatim DTO & Member | Wire Type / Enum & Validation Bounds | Formatting & UX Rules |
| --- | --- | --- | --- | --- | --- | --- |
| **Query** | As-Of Date | كما في تاريخ | As-Of Date | `TrialBalanceQueryDto.asOfDate` | `ISODate` (`YYYY-MM-DD`), **required** | Defaults to current open period end date (or today if inside open period). |
| **Query** | Comparative Date | تاريخ المقارنة | Comparative Date | `TrialBalanceQueryDto.comparativeAsOfDate` | `ISODate` (optional) | Adds `Comparative Closing` column when populated. |
| **Query** | Accounts Filter | الحسابات | Accounts | `TrialBalanceQueryDto.accountId` | `UUID[]` (`1..200`, `MAX_FILTER_IDS`) | Multi-select `AccountPicker`. |
| **Query** | Account Role Filter | دور الحساب | Account Role | `TrialBalanceQueryDto.accountRole` | `AccountRole[]` (`01_Enums.md` §3) | Multi-select `FilterSelect` with localized `t.accounting.accountRole.*`. |
| **Query** | Branch Filter | الفرع | Branch | `TrialBalanceQueryDto.branchId` | `UUID` (optional; re-proved by `@RequireBranchAccess`) | Synchronized with `AccountingScopeBar` branch selector. |
| **Query** | Dimensions Filter | الأبعاد التحليلية | Dimensions | `TrialBalanceQueryDto.dimensionFilter` | `Array<{ dimensionTypeId: UUID; dimensionValueIds: UUID[] }>` (`<= 4` types, `<= 200` values) | `DimensionFilterPicker`. |
| **Query** | Include Zero-Balance Accounts | إظهار الحسابات الصفرية | Include Zero Balances | `TrialBalanceQueryDto.includeZero` | `boolean` (strict, default `false`) | Compact `Switch` in `ReportParameterBar`. |
| **Query** | Currency Mode | عرض العملة | Currency Mode | `TrialBalanceQueryDto.currencyMode` | `'FUNCTIONAL' \| 'TRANSACTION'` (default `'FUNCTIONAL'`) | In `TRANSACTION` mode, groups/displays per `currencyCode` without cross-currency summing. |
| **Query** | Ledger | دفتر الأستاذ | Ledger | `TrialBalanceQueryDto.ledgerId` | `UUID` (`PRIMARY` default; non-primary `422 LEDGER_NOT_PRIMARY` in MVP) | Hidden in Basic (`10_Feature_Tiers.md` §11). |
| **Resp** | Trial Balance Rows & Grand Totals | صفوف وإجماليات ميزان المراجعة | Trial Balance Rows & Grand Totals | `TrialBalanceDto`: `asOfDate`, `fiscalYearId`, `comparativeAsOfDate`, `currencyMode`, `rows[]` (`TrialBalanceRow`: `accountId`, `accountCode`, `accountNameI18n`, `accountType`, `normalBalance`, `currencyCode`, `openingBalance`, `debitMovement`, `creditMovement`, `yearEndEntries` [`D-483`], `closingBalance`, `comparativeClosingBalance`), `totals` (`openingBalance`, `debitMovement`, `creditMovement`, `yearEndEntries`, `closingBalance`; `null` under `TRANSACTION`), `stale`, `asOf`, `asOfChainPositions`, `asOfGeneration`; every balance is signed debit-positive (`D-770`) | `DecimalString` (scale `<= 8`) | `<td>` cells strictly `font-normal` (`400`) `<Money>`; `<tfoot>` sticky grand-total row `font-semibold` (`600`) with `positive` `متوازن / Balanced` or `negative` `غير متوازن / Out of Balance` badge from server proof. Note: `sensitive` accounts omitted silently when caller lacks `accounting.account.view_sensitive` (`D-546`). |

#### Table 1.4C — General Ledger (`GET /reports/general-ledger` — Keyset Paging)

| Direction | UI Control / Column | Arabic Label (`ar`) | English Label (`en`) | Verbatim DTO & Member | Wire Type / Enum & Validation Bounds | Formatting & UX Rules |
| --- | --- | --- | --- | --- | --- | --- |
| **Query** | Date Range | من تاريخ .. إلى تاريخ | From Date .. To Date | `GeneralLedgerQueryDto.fromDate`, `GeneralLedgerQueryDto.toDate` | `ISODate` (**required**), `toDate >= fromDate`, span `<= 3` fiscal years (`MAX_REPORT_YEARS`) | Preset via `FiscalPeriodPicker` or custom date range. |
| **Query** | Accounts | الحسابات | Accounts | `GeneralLedgerQueryDto.accountId` | `UUID[]` (`1..200`) | Multi-select `AccountPicker`. |
| **Query** | Journals | اليوميات | Journals | `GeneralLedgerQueryDto.journalId` | `UUID[]` (`1..200`) | Multi-select from `GET /journals`. |
| **Query** | Entry Kinds | نوع القيد | Entry Kind | `GeneralLedgerQueryDto.entryKind` | `EntryKind[]` (`STANDARD`, `OPENING`, `CLOSING`, `REVERSAL`, `ADJUSTMENT`, etc.; reserved `ALLOCATION`/`COMMITMENT` excluded in Basic) | Multi-select localized enum chips. |
| **Query** | Counterparty | الطرف (عميل/مورد) | Party | `GeneralLedgerQueryDto.partyId` | `UUID` (optional) | Single `PartyPicker`. |
| **Query** | Dimensions | الأبعاد التحليلية | Dimensions | `GeneralLedgerQueryDto.dimensionFilter` | `<= 4` types, `<= 200` values each | `DimensionFilterPicker`. |
| **Query** | Include Reversals | تضمين قيود العكس | Include Reversals | `GeneralLedgerQueryDto.includeReversals` | `boolean` (strict, default `true`) | When `false`, displays non-dismissible `caution` banner: `تم استبعاد قيود العكس — الأرصدة المعروضة لا تطابق ميزان المراجعة / Reversals excluded — balances shown will not agree with the Trial Balance`. |
| **Query** | Keyset Cursor & Page Size | مؤشر الصفحة وحجمها | Keyset Cursor & Limit | `GeneralLedgerQueryDto.cursor`, `limit` (`FindManyDto`) | `cursor?: string` (`<= 512` chars; mutually exclusive with `page`), `limit?: number` (`1..500`, `MAX_LEDGER_PAGE_SIZE`) | `AccountingLedgerGrid` maintains a client cursor stack (`prevCursors[]`) for `Previous` / `Next`; `page` parameter is never sent. |
| **Resp** | GL Lines, Running Balance & Page Info | حركات الأستاذ العام والرصيد المتحرك | GL Movements, Running Balance & Page Info | `GeneralLedgerPageDto` (keyset, `data.items` and `data.pageInfo`, no `meta`): `fromDate`, `toDate`, `items: JournalLineSummaryDto[]` (the posted line with `entryId`, `entryNo`, `journalId`, `entryKind`, `postingDate`, `periodId`, `chainSeq`, `isStorno`), `accounts[]` (`LedgerBalance`: `currencyCode`, `openingBalance`, `debitTotal`, `creditTotal`, `closingBalance`, plus `accountId`, `accountCode`, `accountNameI18n`, over the whole range), `pageInfo { nextCursor, hasMore }`, `asOf`, `asOfChainPositions` (`D-770`) | `DecimalString`, `ISO8601`, `number` | Sticky `Opening Balance` row at top; `isStorno: true` lines carry `[STORNO / قيد عكسي سالب]` badge with negative directional display (`D-219`); clicking any row opens `LedgerDrillDrawer` (`SCR-06`). |

#### Table 1.4D — Party Ledger (`GET /reports/party-ledger` — `AR` & `AP`)

| Direction | UI Control / Column | Arabic Label (`ar`) | English Label (`en`) | Verbatim DTO & Member | Wire Type / Enum & Validation Bounds | Formatting & UX Rules |
| --- | --- | --- | --- | --- | --- | --- |
| **Query** | Subledger Side | جانب الأستاذ المساعد | Subledger Side | `PartyLedgerQueryDto.side` | `SubledgerSide`: `'AR' \| 'AP'` (**required**) | Segmented control: `حسابات العملاء (AR) / Accounts Receivable (AR)` vs `حسابات الموردين (AP) / Accounts Payable (AP)` (both sides gate on `accounting.receivables.core`). |
| **Query** | Date Range | من تاريخ .. إلى تاريخ | From Date .. To Date | `PartyLedgerQueryDto.fromDate`, `PartyLedgerQueryDto.toDate` | `ISODate` (**required**), `toDate >= fromDate`, span `<= 3` fiscal years | `FiscalPeriodPicker` + custom dates. |
| **Query** | Statement Style | نمط كشف الحساب | Statement Style | `PartyLedgerQueryDto.statementStyle` | `StatementStyle`: `'BALANCE_FORWARD' \| 'OPEN_ITEMS'` (default `'BALANCE_FORWARD'`) | `BALANCE_FORWARD`: opening balance + chronological movements + running closing balance agreeing with AR/AP control account (`D-026`). `OPEN_ITEMS`: invoice/note open items with due date, settled amount, and open residual. |
| **Query** | Parties | الأطراف | Parties | `PartyLedgerQueryDto.partyId` | `UUID[]` (`1..200`, optional) | Multi-select `PartyPicker`; the filter value is `partyId` of `PartyFinanceProfileLookupItemDto`. |
| **Query** | Transaction Currency | عملة المعاملة | Transaction Currency | `PartyLedgerQueryDto.currencyCode` | `CurrencyCode` (ISO 4217 `3`-char, optional) | Filters movements/items to one transaction currency and shows `amountTxn` alongside `amountFunctional`. |
| **Query** | Include Settled Items | تضمين البنود المسددة | Include Settled Items | `PartyLedgerQueryDto.includeSettled` | `boolean` (strict, default `true`) | Primarily toggles settled items visibility in `OPEN_ITEMS` style. |
| **Resp** | Party Ledger Rows & Control Proof | حركات وأرصدة كشف الطرف | Party Movements & Control Balance | `PartyLedgerDto`: `side`, `fromDate`, `toDate`, `statementStyle`, `parties[]` (`LedgerBalance` plus `partyId`, `lines: JournalLineSummaryDto[]` under `BALANCE_FORWARD`, `openItems: OpenItemSummaryDto[]` under `OPEN_ITEMS`), `asOf`, `asOfChainPositions`; paged by party with `meta` counting parties; the party name is composed from Core (`D-770`) | `DecimalString`, `SubledgerSide`, `StatementStyle` | Displays server closing balance that reconciles to the `AR_CONTROL` / `AP_CONTROL` account balance (`D-026`). |

#### Table 1.4E — Ledger Facts (`GET /ledger-facts`)

| Direction | UI Control / Column | Arabic Label (`ar`) | English Label (`en`) | Verbatim DTO & Member | Wire Type / Enum & Validation Bounds | Formatting & UX Rules |
| --- | --- | --- | --- | --- | --- | --- |
| **Query** | Fiscal Period | الفترة المالية | Fiscal Period | `LedgerFactsQueryDto.periodId` *(maps to `acc_ledger_facts.fiscal_period_id`)* | `UUID` (optional) | `FiscalPeriodPicker`. |
| **Query** | Account | الحساب | Account | `LedgerFactsQueryDto.accountId` | `UUID` (optional) | Single `AccountPicker`. |
| **Query** | Dimension Set | مجموعة الأبعاد | Dimension Set | `LedgerFactsQueryDto.dimensionSetId` | `UUID` (optional) | Filter by resolved `dimensionSetId`. |
| **Query** | Chain Position Ceiling | حتى تسلسل السلسلة | As-Of Chain Seq | `LedgerFactsQueryDto.asOfChainSeq` | `number` (integer `>= 0`, optional) | Inspector/audit filter to inspect projection at or below a chain sequence. |
| **Query** | Ledger | دفتر الأستاذ | Ledger | `LedgerFactsQueryDto.ledgerId` | `UUID` (optional; `PRIMARY` in Basic) | Hidden in Basic. |
| **Resp** | Fact Projection Columns | أعمدة أرصدة الأستاذ المجمّعة | Aggregated Ledger Fact Columns | `LedgerFactSummaryDto` (`§13.1` of `acc_ledger_facts`): `companyId`, `ledgerId`, `fiscalYearId`, `fiscalPeriodId`, `accountId`, `dimensionSetId`, `branchId`, `currencyCode`, `openingTxn`, `debitTxn`, `creditTxn`, `closingTxn`, `openingFunctional`, `debitFunctional`, `creditFunctional`, `closingFunctional`, `openingGroup`, `debitGroup`, `creditGroup`, `closingGroup`, `lineCount`, `asOfChainSeq`, `isStale`, `updatedAt` | `DecimalString`, `number`, `boolean`, `ISO8601` | `openingGroup`..`closingGroup` hidden unless `accounting.integration.consolidation` (Wave 2) is entitled. If `isStale === true`, row renders `caution` badge `يتطلب التحديث / Stale` and links to Bulk Operations (`SCR-05` `/accounting/post/bulk-operations`) for `REBUILD_LEDGER_FACTS`. |

#### Table 1.4F — Reporting Frameworks, Report Definitions, Lines, Coverage & Mappings (`#112` & `#113`)

| Resource & Route | UI Field / Column | Arabic Label (`ar`) | English Label (`en`) | Verbatim DTO & Member (`02_DTOs.md` §11.1, §11.3, §13.1) | Wire Type / Enum & Validation Bounds |
| --- | --- | --- | --- | --- | --- |
| **Frameworks** (`GET /reporting-frameworks`, `/:id`) | Framework Card / Drawer | إطار التقارير المالية | Reporting Framework | `ReportingFrameworkSummaryDto` / `DetailDto`: `id`, `code`, `nameI18n`, `countryCode`, `packCode`, `isSystem`, `version`, `createdAt`, `updatedAt` | `ReportingFrameworkCode`: `EAS \| IFRS \| IFRS_SME \| SOCPA \| ZAKAT \| UNIFORM_EG \| CUSTOM` |
| **Definitions Filter** (`GET /report-definitions`) | Framework / Statement Kind / Pack | الإطار / نوع القائمة / الحزمة | Framework / Statement Kind / Pack | `ReportDefinitionListQueryDto`: `frameworkId?`, `statementKind?`, `packCode?`, `page?`, `limit?`, `sort?` | `UUID`, `StatementKind`, `string` |
| **Definitions Table & Header** (`GET /report-definitions`, `/:id`) | Definition Metadata | بيانات تعريف التقرير | Report Definition Metadata | `ReportDefinitionSummaryDto` / `DetailDto`: `id`, `code`, `frameworkId`, `statementKind`, `nameI18n`, `packCode`, `status`, `comparativesRequired`, `currencyMode`, `contentHash`, `publishedAt`, `version` (`ETag`), `createdAt`, `updatedAt` | `ReportDefinitionStatus`: `DRAFT \| PUBLISHED \| RETIRED`; `ReportCurrencyMode`: `FUNCTIONAL \| TRANSACTION \| GROUP`; `Sha256Hex` |
| **Line Tree** (`GET /report-definitions/:id/lines`) | Immutable Statement Line | بند القائمة المالية | Statement Line | `ReportLineDetailDto`: `id`, `definitionId`, `lineCode`, `parentLineCode`, `sequenceNo`, `depth` (`1..8`), `lineKind`, `nameI18n`, `signFlip`, `hideWhenZero`, `isBold`, `noteRef`, `formula`, `balanceReclassificationRule`, `cashFlowCategory`, `version` | `ReportLineKind`: `HEADER \| DETAIL \| SUBTOTAL \| TOTAL \| NOTE_REF` (`DETAIL` lines accept mappings; `TOTAL`/`SUBTOTAL` show read-only `formula`) |
| **Coverage Check** (`GET /report-definitions/:id/coverage`) | Unmapped Postable Accounts | الحسابات القابلة للترحيل غير المربوطة | Unmapped Postable Accounts | `ReportCoverageDto` (query `ReportCoverageQueryDto`): `definitionId`, `resolutionDate`, `complete`, `unmappedAccounts[]` (`accountId`, `code`, `nameI18n`), `multiplyMappedAccounts[]` (`accountId`, `code`, `nameI18n`, `lineCodes[]`), `asOf` | `0` unmapped accounts = `positive` `مكتمل التغطية / Coverage Complete`; `> 0` = `caution` banner + `Map to Line` quick button per account (`D-104`). |
| **Create Mapping** (`POST /report-definitions/:id/mappings`) | Target `DETAIL` Line | البند التفصيلي المستهدف | Target Detail Line | `CreateReportLineMappingDto.lineCode` (+ `definitionId` matching `:id`) | `string` (**required**, must reference a `DETAIL` line of `:id`) |
| **Create Mapping** | Mapping Source Kind | نوع مصدر الربط | Mapping Source Kind | `CreateReportLineMappingDto.sourceKind` | `ReportMappingSourceKind`: `'ACCOUNT' \| 'ACCOUNT_SUBTREE' \| 'ACCOUNT_ROLE' \| 'TAG'` (**required**) |
| **Create Mapping** | Conditional Source Target | الحساب / الدور / الوسم | Account / Role / Tag | `accountId?` (required iff `ACCOUNT` or `ACCOUNT_SUBTREE`), `accountRole?` (required iff `ACCOUNT_ROLE`), `tag?` (required iff `TAG`, lowercase `^[a-z0-9_-]+$`), `includeChildren?` (`boolean`, `ACCOUNT_SUBTREE` only, default `false`) | Conditional form fields: unused target keys are **omitted** from JSON payload (`forbidNonWhitelisted`). |
| **Create Mapping** | Sign Flip & Effective Dates | عكس الإشارة وفترة السريان | Sign Flip & Effective Range | `signFlip?: boolean` (default `false`), `effectiveFrom: ISODate` (**required**), `effectiveTo?: ISODate` (`> effectiveFrom`, half-open range `ck_acc_report_line_mappings_range`) | Sent with `x-idempotency-key` (`UUIDv7`) and `If-Match: "<definition.version>"`. |

---

### 1.5 Complete UI State, Permission & Entitlement Matrix (`SCR-12`)

| State Category | Trigger / Condition | Visual & Behavioural Treatment (`accounting-status-and-a11y.md` & `accounting-patterns-documents.md`) |
| --- | --- | --- |
| **1. Initial Loading** | First fetch of `#72`, `#73`, `#112`, or `#113` | `ReportParameterBar` renders skeleton pills (`h-9`); main surface renders `TableSkeleton` (`8` rows, matching numeric right/end column alignment, `aria-busy="true"`). Never flashes `0.00` or "No records". |
| **2. Empty State — No Postings in Period** | `200` on Trial Balance (`includeZero=false`), GL, Party Ledger, or Ledger Facts with `0` rows | `EmptyState` inside table container: `لا توجد حركات مرحّلة في الفترة المحددة / No posted entries in the selected range` + secondary action `تغيير الفترة أو الفلاتر / Adjust Period or Filters` (and `إظهار الحسابات الصفرية / Include Zero Balances` shortcut on Trial Balance). |
| **3. Empty State — No Runs / No Mappings** | `200` on `#72?view=runs` (`0` runs) or `#113?tab=mappings` (`0` custom company mappings) | `#72?view=runs`: `لم يتم تشغيل أي قائمة مالية بعد / No financial statement runs yet` + action switching to `view=statements`. `#113?tab=mappings`: explains that system `ACCOUNT_ROLE` pack mappings apply unless overridden or supplemented, with `إضافة ربط حساب / Add Line Mapping` button (if `accounting.report.manage_definitions` held). |
| **4. Sync `200` Populated** | Within query budget (`< 2s` typical) | Renders `ReportFreshnessBar` (`asOf`, `asOfChainSeq` / `asOfChainPositions`, `checksum`) + data grid/tree. Changing any filter marks the parameter bar `Dirty` (`تم تعديل المحددات — اضغط تحديث لعرض الأرقام الجديدة / Parameters changed — Run to refresh`) while dimming stale results (`opacity-75`) so changed filters are never misread as the active report's parameters. |
| **5. Async `202 Accepted` Waiting State** | `POST /reports/:code/run` or `GET /reports/trial-balance` returns `202` + `Location: .../reports/runs/:id` + `Retry-After` (`D-165`), or `POST /exports/:code/run` returns `202` | Renders `WaitingStateCallout` (`accounting-patterns-documents.md` §1) with `WaitingStateBadge` (`QUEUED — في قائمة الانتظار` or `RUNNING — جاري إعداد التقرير`), elapsed timer, `Location` run ID (`<IdentifierText>`), link to `#73`, and auto-polling strictly respecting `Retry-After` (minimum `2s`, exponential cap `15s`). **Zero-Resend Law:** `Run` button is locked while polling so the user does not spawn duplicate heavy runs. |
| **6. Unmapped Coverage Refusal (`422 DEFINITION_INCOMPLETE`)** | `POST /reports/:code/run` fails with `422 ACCOUNTING.REPORT.DEFINITION_INCOMPLETE` (`D-104`) or precheck `GET /:id/coverage` finds unmapped postable accounts | Structured three-part error banner (`tone="negative"`):<br>• **Cause:** `تعذّر إصدار القائمة المالية لوجود حسابات قابلة للترحيل غير مربوطة ببنود التقرير / Cannot generate statement because postable accounts are not mapped to report lines.`<br>• **Effect on Books:** `لم تتأثر أي أرصدة أو قيود محاسبية؛ لم يتم حفظ تشغيل التقرير / No ledger balances were changed; no report run was saved.`<br>• **Safe Next Action:** Direct `<Link>` button `مراجعة وربط الحسابات غير المربوطة (N) / Map Unmapped Accounts (N)` → `/accounting/setup/report-definitions/[id]?tab=coverage` + `correlationId` copy chip. |
| **7. Projection Behind (`503 PROJECTION_BEHIND`)** | Read model lags required `asOfChainSeq` and returns `503 ACCOUNTING.REPORT.PROJECTION_BEHIND` (`Retry-After`) | `DegradedBanner` (`tone="caution"`) with countdown auto-retry per `Retry-After`: `جاري مزامنة أرصدة الأستاذ المجمّعة مع آخر قيد مرحّل — ستتم إعادة المحاولة تلقائياً / Ledger fact projection is catching up to the latest posted entry — retrying automatically.` |
| **8. Ambiguous Network Timeout on Write** | `CLIENT_REQUEST_TIMEOUT` / `502` / `503` / `504` on `POST /:id/mappings`, `DELETE /:id/mappings/:mappingId`, `POST /reports/snapshots`, or `POST /exports/:code/run` | Preserves the exact in-memory `UUIDv7` `x-idempotency-key` (`accounting-patterns-documents.md` §1.4); disables form edits and offers `إعادة المحاولة بنفس مفتاح العملية / Retry Safely with Same Key` so retries never duplicate rows. |
| **9. Optimistic Concurrency (`409 STALE_VERSION`)** | Mapping `POST` or `DELETE` on `#113` returns `409` (`ETag` mismatch) | Inline conflict `Banner` (`tone="caution"`): explains another user updated this definition's mappings, offers `تحديث البيانات وإعادة المراجعة / Reload Latest Version` (re-fetches `GET /report-definitions/:id` + `/mappings` + `/coverage` with fresh `ETag`). |
| **10. `403` Permission Denial (`PermissionGate`)** | User lacks route read permission `accounting.report.read`, or lacks action permission (`accounting.report.run`, `accounting.report.manage_definitions`, `accounting.report.snapshot`, `accounting.export.run`) | • Missing `accounting.report.read`: full-area `<PermissionGate requiredPermission="accounting.report.read" />` (never rendered as empty table).<br>• Has `accounting.report.read` but lacks `accounting.report.run`: user can view `#72?view=trial-balance`, `general-ledger`, `party-ledger`, `ledger-facts`, `runs`, `#73`, `#112`, `#113`, while `تشغيل القائمة / Run Statement` on `view=statements` is disabled with tooltip naming `accounting.report.run`.<br>• Lacks `accounting.report.manage_definitions`: `#113` renders read-only (`Add` / `Remove` mapping hidden/disabled with reason). |
| **11. Silent Sensitive-Account Redaction (`D-546`)** | Actor lacks `accounting.account.view_sensitive` | Backend silently omits `sensitive = true` accounts and adjusts projection rows per `D-546`; UI **never** renders `[REDACTED ACCOUNT]` placeholders or hints that a hidden account exists. |
| **12. `404` Record Not Found / Out-of-Scope Masking** | `#73` (`runs/:id`) or `#113` (`report-definitions/:id`) returns `404` (including scoped `TARGET_DENIED` masking, `10_Feature_Tiers.md` §10 rule 1) | Renders `EmptyState` (`variant="not-found"`) with back-link to `#72` or `#112` + `correlationId`. |
| **13. Entitlement & Platform Boundary States** | Guard 2–4 refusals (`10_Feature_Tiers.md` §9–§11 & `accounting-patterns-documents.md` §3) | • `403 ACCOUNTING.FEATURE.NOT_ENTITLED`: unentitled tabs (`party-ledger` without `accounting.receivables.core`), actions (`Save Snapshot` / `Export` without `accounting.reporting.snapshots`), and `CUSTOM` builder (`accounting.reporting.report_builder` Wave 2) are **ABSENT** from navigation/menus — zero inline upgrade prompts.<br>• `403 ACCOUNTING.FEATURE.RECOVERY_MODE` (`D-221`): persistent top recovery banner; all `GET` reports and `POST /reports/:code/run` (read-like when `snapshot=false`) remain available for audit inspection, while mutating actions (`Add/Delete Mapping`, `Save Snapshot`, `Run Export`) are disabled with factual recovery reason.<br>• `SEAT_REQUIRED`, `MODULE_DISABLED`, `PROVISIONING_MAINTENANCE`, `503 ENTITLEMENT_UNAVAILABLE`, `PROFILE.NOT_ACTIVATED`, `TenantStatus.ARCHIVED`: handled by `AccountingBoundaryGate` (`accounting-patterns-documents.md` §3). |

---

### 1.6 Four-Combination ASCII Mockups (`SCR-12`)

> **Responsive & Sub-View Note:** The four combinations below illustrate both `#72` (`/accounting/close/statements` — showing `Statements` in Light and `Trial Balance [Slice]` / `General Ledger` + `#113` `Coverage & Mappings` in Dark so every sub-surface is visually specified) across **Arabic RTL Light**, **Arabic RTL Dark**, **English LTR Light**, and **English LTR Dark** at `1440px` desktop (`1152px` net content width, `44px` compact rows, `400` body cells, `600` totals, `<bdi dir="ltr">` Western digits). At **`375px` mobile**, `AccountingScopeBar` collapses into a single scope summary drawer chip, `ReportParameterBar` collapses into a `Filters (N)` bottom sheet, and `StatementTreeTable` / `AccountingLedgerGrid` pins the first label column (`sticky start-0`) with horizontal scroll (`overflow-x-auto`) so multi-column decimal strings never wrap or truncate.

#### 1.6.1 Combination 1 — Arabic RTL × Light Mode (`#72` `/accounting/close/statements?view=statements` — EAS Balance Sheet)

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [B] متكامل · المحاسبة          [الشركة المصرية للتجارة ▾] [الفرع: كل الفروع ▾]          [☀ نهاري] [EN] [أحمد م.] │ 45px Ocean Navy GlobalNav (dir="rtl")
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ الإقفال والتقارير  ◂  القوائم المالية ودفاتر الأستاذ                          [تعريفات التقارير ↗] [تصدير ▾]    │ 48px PageActionBar
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [● القوائم المالية (6)] [ميزان المراجعة] [الأستاذ العام] [أستاذ الأطراف] [أرصدة الأستاذ] [سجل التشغيل (12)]       │ Mode Tabs (brand underline)
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ القائمة: [١. قائمة المركز المالي (EAS · EG_BALANCE_SHEET) ▾]  الفترة: [2026-01-01 ◂▸ 2026-09-30]                 │ ReportParameterBar
│ المقارنة: [2025-01-01 ◂▸ 2025-09-30 ▾]  الأبعاد: [كل الأبعاد ▾]  العملة: [عملة الدفاتر EGP ▾]                    │ (--surface-subtle #f8fafc)
│ [ ] تضمين المسودات غير المرحّلة                    [حفظ كلقطة معتمدة]  [▶ تشغيل القائمة] (1 primary brand CTA)   │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ✓ محدّث كما في ‎2026-10-02 14:20 UTC‎ · تسلسل السلسلة FY-2026: ‎#4187‎ · التغطية: مكتملة (142/142 حساب) · البصمة: ‎9a4f…c12e‎ [نسخ] │ ReportFreshnessBar
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ البند                                      │ إيضاح │       2026-09-30 (EGP) │       2025-09-30 (EGP) │ التغير (EGP)│ thead (font-medium 500)
├────────────────────────────────────────────┼───────┼────────────────────────┼────────────────────────┼─────────────┤
│ الأصول غير المتداولة                       │       │                        │                        │             │ HEADER (font-semibold 600)
│   الأصول الثابتة (بالصافي)                 │ [إ 5] │       ‎4,850,000.00‎ مدين│       ‎4,200,000.00‎ مدين│  ‎+650,000.00‎│ DETAIL (font-normal 400, ps-4)
│   مشروعات تحت التنفيذ                      │ [إ 6] │         ‎320,000.00‎ مدين│         ‎150,000.00‎ مدين│  ‎+170,000.00‎│ DETAIL (click -> drill TB/GL)
│ إجمالي الأصول غير المتداولة                │       │       ‎5,170,000.00‎ مدين│       ‎4,350,000.00‎ مدين│  ‎+820,000.00‎│ SUBTOTAL (font-medium 500, border-t)
│ الأصول المتداولة                           │       │                        │                        │             │ HEADER (font-semibold 600)
│   المخزون                                  │ [إ 8] │       ‎1,940,250.50‎ مدين│       ‎1,610,000.00‎ مدين│  ‎+330,250.50‎│ DETAIL (font-normal 400)
│   العملاء وأوراق القبض (بالصافي)           │ [إ 9] │       ‎2,415,800.00‎ مدين│       ‎2,105,400.00‎ مدين│  ‎+310,400.00‎│ DETAIL (font-normal 400)
│   النقدية بالصندوق ولدى البنوك             │ [إ11] │       ‎1,680,949.50‎ مدين│       ‎1,234,600.00‎ مدين│  ‎+446,349.50‎│ DETAIL (font-normal 400)
│ إجمالي الأصول المتداولة                    │       │       ‎6,037,000.00‎ مدين│       ‎4,950,000.00‎ مدين│‎+1,087,000.00‎│ SUBTOTAL (font-medium 500, border-t)
╞════════════════════════════════════════════╪═══════╪════════════════════════╪════════════════════════╪═════════════╡
│ إجمالي الأصول                              │       │      ‎11,207,000.00‎ مدين│       ‎9,300,000.00‎ مدين│‎+1,907,000.00‎│ TOTAL (font-semibold 600, double border)
│ إجمالي حقوق الملكية والالتزامات            │       │      ‎11,207,000.00‎ دائن│       ‎9,300,000.00‎ دائن│‎+1,907,000.00‎│ TOTAL (✓ متوازن — بدون حسابات متصفح)
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 1.6.2 Combination 2 — Arabic RTL × Dark Mode (`#72?view=trial-balance` `[Slice]` + `#113` Unmapped Coverage Banner)

```text
╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
║ [B] متكامل · المحاسبة          [الشركة المصرية للتجارة ▾] [الفرع: فرع مدينة نصر ▾]       [☾ داكن] [EN] [أحمد م.] ║ Dark Canvas (#0b1220) · dir="rtl"
╠══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣
║ الإقفال والتقارير  ◂  ميزان المراجعة                                          [تعريفات التقارير ↗] [تصدير ▾]    ║ Surface (#111827) · Border (#1f2937)
╠══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣
║ [القوائم المالية (6)] [● ميزان المراجعة] [الأستاذ العام] [أستاذ الأطراف] [أرصدة الأستاذ] [سجل التشغيل (12)]       ║ Active Tab (#4ba3f5)
╠══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣
║ كما في تاريخ: [2026-09-30]  مقارنة: [2025-12-31]  دور الحساب: [الكل ▾]  الأبعاد: [مركز التكلفة: المبيعات ×]     ║ ReportParameterBar (Dark #162033)
║ [✓] إظهار الحسابات الصفرية: لا   العملة: [EGP الدفترية ▾]                                     [↻ تحديث الميزان] ║ Max 1 primary button
╠══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣
║ ✓ كما في ‎2026-10-02 14:22 UTC‎ · تسلسل السلسلة: ‎#4187‎ · الفرع: فرع مدينة نصر · الحالة: [✓ متوازن (مدين = دائن)]   ║ ReportFreshnessBar
╠══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣
║ الكود   │ اسم الحساب               │ الرصيد الافتتاحي │ حركة الفترة (مدين)│ حركة الفترة (دائن)│ قيود الإقفال│ الرصيد الختامي    ║ D-483 4-stage proof
╟─────────┼──────────────────────────┼──────────────────┼───────────────────┼───────────────────┼─────────────┼───────────────────╢
║ ‎110101‎ │ البنك التجاري الدولي EGP │    ‎800,000.00‎ مد │    ‎1,450,000.00‎  │      ‎569,050.50‎  │        ‎0.00‎ │  ‎1,680,949.50‎ مد ║ font-normal (400)
║ ‎120101‎ │ عملاء محليون (حساب رقابة)│  ‎2,105,400.00‎ مد │    ‎3,200,000.00‎  │    ‎2,889,600.00‎  │        ‎0.00‎ │  ‎2,415,800.00‎ مد ║ click -> GL filtered
║ ‎210101‎ │ موردون محليون (رقابة)    │  ‎1,420,000.00‎ دا │    ‎1,980,000.00‎  │    ‎2,310,000.00‎  │        ‎0.00‎ │  ‎1,750,000.00‎ دا ║ explicit مد / دا cue
║ ‎410101‎ │ إيرادات المبيعات المحلية │          ‎0.00‎    │       ‎45,000.00‎  │    ‎6,490,899.00‎  │        ‎0.00‎ │  ‎6,445,899.00‎ دا ║ tabular-nums LTR
╠═════════╪══════════════════════════╪══════════════════╪═══════════════════╪═══════════════════╪═════════════╪═══════════════════╣
║ الإجمالي (من الخادم — بدون تقريب)  │  ‎9,300,000.00‎ =  │   ‎14,820,500.00‎  │   ‎14,820,500.00‎  │        ‎0.00‎ │ ‎11,207,000.00‎ =  ║ tfoot font-semibold (600)
╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝
```

#### 1.6.3 Combination 3 — English LTR × Light Mode (`#72?view=general-ledger` Keyset GL + `LedgerDrillDrawer` Preview)

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [B] Mutakamel · Accounting     [Egyptian Trading Co. ▾] [Branch: All Branches ▾]         [☀ Light] [عربي] [A.M.] │ 45px Ocean Navy GlobalNav (dir="ltr")
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Close & Reporting  ▸  Statements & Ledgers                                    [Report Definitions ↗] [Export ▾]  │ 48px PageActionBar
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [Statements (6)] [Trial Balance] [● General Ledger] [Party Ledger] [Ledger Facts] [Recent Runs (12)]             │ Mode Tabs
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Range: [2026-09-01 -> 2026-09-30]  Account: [110101 · CIB Current EGP ×]  Journal: [All ▾]  Kind: [All ▾]        │ ReportParameterBar
│ Party: [Any ▾]  Dimensions: [All ▾]  [✓] Include Reversals                         [▶ Run Ledger] (primary CTA) │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ✓ As of 2026-10-02 14:25 UTC · Chain Seq: #4187 · Keyset Paging (100 rows/page) · Reversals: Included            │ ReportFreshnessBar
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Posting Date│ Entry No.        │ Seq   │ Kind     │ Counterparty / Memo          │      Debit (EGP)│     Credit (EGP)│ Running Balance │
├─────────────┼──────────────────┼───────┼──────────┼──────────────────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ 2026-09-01  │ — Opening Balance (Server Proof) —                                 │                 │                 │   1,210,500.00 DR│ Sticky Opening Row
│ 2026-09-04  │ BNK-2026-000812  │ #4102 │ STANDARD │ Al-Ahram Retail · Settlement │    320,000.00   │          0.00   │   1,530,500.00 DR│ font-normal (400)
│ 2026-09-12  │ BNK-2026-000845  │ #4140 │ STANDARD │ Nile Packaging · Supplier Pay│          0.00   │    169,550.50   │   1,360,949.50 DR│ click -> DrillDrawer
│ 2026-09-18  │ BNK-2026-000861  │ #4159 │ REVERSAL │ [STORNO] Rev of BNK-000809   │   -120,000.00   │          0.00   │   1,240,949.50 DR│ D-219 Storno badge
│ 2026-09-28  │ BNK-2026-000904  │ #4187 │ STANDARD │ Delta Mart · Wire Receipt    │    440,000.00   │          0.00   │   1,680,949.50 DR│
╞═════════════╪══════════════════╪═══════╪══════════╪══════════════════════════════╪═════════════════╪═════════════════╪═════════════════╡
│ 2026-09-30  │ — Closing Balance & Period Movement Totals —                       │    640,000.00   │    169,550.50   │   1,680,949.50 DR│ tfoot font-semibold
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Keyset Navigation (no page numbers):                                       [◂ Previous Cursor] [Next Cursor ▸]   │ Cursor stack pager
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 1.6.4 Combination 4 — English LTR × Dark Mode (`#113` `/accounting/setup/report-definitions/[id]` — Coverage & Mappings)

```text
╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
║ [B] Mutakamel · Accounting     [Egyptian Trading Co. ▾] [Branch: All Branches ▾]          [☾ Dark] [عربي] [A.M.] ║ Dark Canvas (#0b1220) · dir="ltr"
╠══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣
║ Setup  ▸  Report Definitions  ▸  EG_BALANCE_SHEET · EAS Balance Sheet      [Status: PUBLISHED] [ETag: v4]        ║ #113 Detail Header
║ Framework: EAS (EG Pack v1) · Currency Mode: FUNCTIONAL · Content Hash: 7e31…8b04 [Copy]  [Open in Statements ↗] ║
╠══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣
║ [Line Tree (48)]  [⚠ Coverage Check (1 Unmapped)]  [● Account Mappings (39)]              [+ Add Line Mapping]   ║ Tabs + 1 primary CTA
╠══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣
║ ⚠ Coverage Incomplete for Egyptian Trading Co.: 1 postable account (`110905 · Restricted Margin Cash`) is not    ║ Inline Coverage Alert
║   mapped to any DETAIL line. Statement runs will refuse with `422 DEFINITION_INCOMPLETE` until mapped. [Map Now] ║ (D-104)
╠══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣
║ Line Code    │ Statement Line (DETAIL)     │ Source Kind     │ Target (Account / Role / Tag) │ Flip │ Effective  │ Actions ║
╟──────────────┼─────────────────────────────┼─────────────────┼───────────────────────────────┼──────┼────────────┼─────────╢
║ BS.CA.CASH   │ Cash & Cash Equivalents     │ ACCOUNT_ROLE    │ CASH_AND_BANK                 │ No   │ 2026-01-01 │ [System]║
║ BS.CA.CASH   │ Cash & Cash Equivalents     │ ACCOUNT_SUBTREE │ 110100 · Banks (incl. child)  │ No   │ 2026-01-01 │ [Delete]║ DELETE /:id/mappings/:mappingId
║ BS.CA.AR     │ Trade & Notes Receivable    │ ACCOUNT_ROLE    │ AR_CONTROL                    │ No   │ 2026-01-01 │ [System]║
║ BS.CA.AR     │ Trade & Notes Receivable    │ ACCOUNT         │ 120190 · Allowance Doubtful   │ Yes  │ 2026-01-01 │ [Delete]║ signFlip = true
║ BS.CL.AP     │ Trade & Notes Payable       │ ACCOUNT_ROLE    │ AP_CONTROL                    │ Yes  │ 2026-01-01 │ [System]║
╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 2. Screen `SCR-36` — Accounting Plan, Feature Entitlements & Wave Roadmap

### 2.1 Purpose, Route & Governing Tier-Disclosure Laws (`10_Feature_Tiers.md` §5–§11)

`SCR-36` (`#118` `/accounting/setup/plan`, `TENANT_ROUTES.accountingSetupPlan`, IA section `Setup / الإعدادات والتهيئة` → `Accounting Plan & Capabilities / باقة المحاسبة والمزايا المتاحة`) is the **single factual plan-comparison and capability-roadmap surface** in the Accounting application (`ACT-01`, `ACT-14`; `SCN-001`, `SCN-095`; `10_Feature_Tiers.md` §11).

1. **Zero Upsell Noise Elsewhere (`10_Feature_Tiers.md` §11):** No modal, toast, sidebar teaser, or locked-screen upsell banner appears anywhere else under `/accounting/*`. Unentitled pages and report kinds are **absent** from navigation; an Advanced option inside a Basic form is disabled with a one-line factual reason; `#118` is the **only** place that compares `Basic` (`accounting.basic`) and `Advanced` (`accounting.advanced`).
2. **Authoritative `64`-Key Count Reconciliation:** An earlier draft summary in `accounting-screen-inventory.md` wrote `"28 Basic + 24 Advanced"`. The binding authority `10_Feature_Tiers.md` §6 & §6.10 defines **`64` canonical keys = `28` Basic (`MVP`-active) + `36` Advanced (`9` Wave 1 + `17` Wave 2 + `10` Wave 3)**. `SCR-36` renders all **`64`** keys verbatim and records the inventory summary string fix in `CG-PLAN-01`.
3. **Superset Guarantee (`10_Feature_Tiers.md` §7):** `accounting.advanced` is a strict superset of `accounting.basic` (`64 / 64` keys). Upgrading flips entitlement snapshot membership with zero DDL migration, zero backfill, and zero downtime (`10_Feature_Tiers.md` §4–§5).
4. **Honesty Between "Not Entitled" vs "Entitled · Scheduled Wave" (`10_Feature_Tiers.md` §6.10 & §10 rule 5):** At MVP exit, all `28` Basic keys are live, while the `36` Advanced keys ship across `Wave 1`, `Wave 2`, and `Wave 3`. An Advanced tenant therefore sees `مشمول بالباقة · مجدول (الإصدار N) / Entitled · Scheduled (Wave N)` (`neutral`/`caution` informational chip) on unshipped wave keys — **never** `Active Now` before the wave ships, and **never** `Not in Plan`.
5. **Seat Access Control Only (`D-222`):** The summary strip displays the current user's accounting seat state (`مقعد وصول مفعّل / Seat Assigned`) strictly as an **access-control fact**. No copy on `SCR-36` states or assumes a per-seat or per-company billing unit (`D-222`).
6. **Non-Destructive Downgrade Rule (`10_Feature_Tiers.md` §5 & §11):** Downgrading from `Advanced` to `Basic` deletes zero database rows; historical Advanced data remains readable in read-only mode while new writes to Advanced capabilities are refused.
7. **Vertical Add-Ons Are Not Tiers (`10_Feature_Tiers.md` §8, `D-204`, `D-552`):** `accounting.realestate`, `accounting.contracting`, and `accounting.manufacturing` are Core vertical add-ons, **not** a third tier and **not** entries in the 64-key table. A dedicated read-only boundary note at the bottom of `#118` states this structural distinction clearly (noting that `accounting.projects.contracting` and `accounting.integration.manufacturing` remain tier keys on `acc_*` tables alongside any installed vertical add-on).
8. **Owner-Only Outbound Subscription Link (`accounting-ia.md` §3 & `SCR-36`):** The outbound `<Link href="/core/subscription">` (`إدارة الاشتراك في المنصة / Manage Subscription`) renders in `PageHeader` **if and only if `user.isTenantOwner === true`** (from Core `/api/tenant/core/v1/auth/me`). When `user.isTenantOwner === false`, no button or link to `/core/subscription` is rendered anywhere on the page; a calm one-line subtitle states: `تتم إدارة ترقية أو تعديل الباقة بواسطة مالك الحساب فقط / Plan changes are managed exclusively by the tenant account owner.`

---

### 2.2 Approved Pattern & `@/design-system` Component Composition (`SCR-36`)

| Surface / Zone | Reused Component (`@/design-system` or `@/features/accounting/patterns`) | Binding Contract & UX Rules |
| --- | --- | --- |
| **Page Header & Scope** | `PageHeader`, `AccountingScopeBar`, `Link` (`next/link`) | Shows resolved `OPERATING_CONTEXT` (`Company` / `Branch`); renders at most **one** primary action (`<Button asChild variant="primary"><Link href="/core/subscription">...</Link></Button>`) **only** when `user.isTenantOwner === true`. |
| **Plan Summary Strip** | `Card` (`4`-column responsive metric grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3`), `Badge`, `<IdentifierText>` | Displays (1) Active Tier (`Basic` / `Advanced`), (2) Active & Entitled Capabilities (`28 / 64` or `64 / 64` with `28 Live · 36 Wave 1–3`), (3) Current User Seat Access (`D-222` access-only status), and (4) Company Activation State (`accountingActivatedOn` / `Ready` vs `Not Activated`). |
| **Downgrade Retention Banner** | `Banner` (`tone="caution"`, conditional) | `AccountingFeaturesDto` carries no downgrade or retained-history flag (`D-770`), so the banner is a collapsible factual rule disclosure only (`10_Feature_Tiers.md` §11), never driven by response data. |
| **Filter & Search Bar** | `FilterBar`, `ToolbarSearch`, `FilterChip`, `FilterSelect` | Instant client-side filter over the 64-key catalogue: text search (matches localized title, description, or `<IdentifierText>` key), Tier/Status chips (`All 64`, `Included in Plan`, `Basic · MVP (28)`, `Advanced (36)`, `Wave 1 (9)`, `Wave 2 (17)`, `Wave 3 (10)`), and `Domain` select (`9` groups). |
| **9-Domain Capability Matrix** | `SectionCard`, `DataTable` (compact `44px` rows), `Badge`, `<IdentifierText>` | Groups all `64` keys into the exact `9` sections of `10_Feature_Tiers.md` §6.1–§6.9. `<td>` cells use `font-normal` (`400`); key identifiers render in `<IdentifierText>`; `config` bounds (`webhooks`, `report_builder`) render as inline structured pills. |
| **Vertical Add-On Boundary Card** | `SectionCard` (subtle neutral footer card) | Explains `10_Feature_Tiers.md` §8 (`accounting.realestate`, `accounting.contracting`, `accounting.manufacturing` live in Core add-ons, outside the two-tier `Basic` / `Advanced` model). |

---

### 2.3 Verbatim Action & Endpoint Catalogue Mapping (`SCR-36`)

| # | UI Action & Surface | Method | Browser Path | Catalogue Path | Permission (`05_Permissions`) | Feature Key (`10_Feature_Tiers`) | Scope Target | Idempotency | Concurrency | Response & UI Handling |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **1 `[P]`** | **Load Entitled Features, Tier, Seat & Scope Activation** (`#118` mount & scope switch) | `GET` | `/api/tenant/accounting/v1/meta/features` | `/accounting/meta/features` | `accounting.setting.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | `none` | `none` | `200` (`SuccessResponseDto<AccountingFeaturesDto>` — `tier`, `enabledFeatures`, `keys[]`, `seatAssigned`, `activation` and `asOf` for the resolved scope; `Cache-Control: no-store, private`; every seeded role template holds `accounting.setting.read`, the `accounting_cashier` template included, `D-770`). |
| **2 `[S]`** | **Read Session `isTenantOwner` & Permissions** (workspace bootstrap) | `GET` | `/api/tenant/core/v1/auth/me` | Core `/auth/me` | Authenticated tenant user | — | `TENANT` | `none` | `none` | `200` — gates route admission (`accounting.setting.read`) and owner-only visibility of `<Link href="/core/subscription">`. |
| **3 `[S]`** | **Navigate to Platform Subscription** (`user.isTenantOwner === true` ONLY) | `GET` (Client route) | `/core/subscription` | Core Tenant Portal route | `user.isTenantOwner === true` | — | `TENANT` | — | — | Standard `next/link` navigation; completely omitted from DOM when `user.isTenantOwner !== true`. |

---

### 2.4 Field & Filter-to-DTO Mapping (`SCR-36`)

> **Contract note (`CG-PLAN-01`, closed by `D-770`):** `02_DTOs.md` §4.6 declares `AccountingFeaturesDto` for `GET /accounting/meta/features`: `tier` (`'BASIC' | 'ADVANCED'`), `enabledFeatures`, `keys[]` (`key`, `tier`, `entitled`, `wave`; all `64` keys in declaration order), `seatAssigned`, `activation` (`companyId`, `profileExists`, `activated`, `accountingActivatedOn`, `firstPostingAt`, or `null` at `TENANT`) and `asOf`. The route is open to every role template because each holds `accounting.setting.read`. Per-key `config` payloads, `downgradedReadOnlyKeys` and recovery flags are not in the DTO and are not rendered. Static descriptive metadata (bilingual title, gated scope summary, section grouping) comes from the typed frontend constant `featureCatalogue.ts` mirroring `10_Feature_Tiers.md` §6 verbatim, **never** inferring entitlement from data presence (`10_Feature_Tiers.md` §11 line 396).

| Zone | UI Element | Arabic Label (`ar`) | English Label (`en`) | Source / DTO Member (`GET /meta/features` · `AccountingFeaturesDto`) | Wire Values & Formatting Rules |
| --- | --- | --- | --- | --- | --- |
| **Summary Card 1** | Current Accounting Tier | الباقة الحالية | Current Tier | `data.tier` (`'BASIC' \| 'ADVANCED'`) | `Badge` (`neutral` for `Basic — الباقة الأساسية`; `positive` for `Advanced — الباقة المتقدمة`). Never uses `brand` on a badge. |
| **Summary Card 2** | Entitled Capabilities Count | المزايا المشمولة بالباقة | Included Capabilities | `data.enabledFeatures: AccountingFeatureKey[]` and `data.keys[]` (all `64` keys, each with `entitled`) | `<IdentifierText>28 / 64</IdentifierText>` (Basic) or `<IdentifierText>64 / 64</IdentifierText>` with sub-caption `28 متاحة الآن · 36 مجدولة (الإصدارات 1–3) / 28 Live Now · 36 Scheduled (Waves 1–3)`. |
| **Summary Card 3** | Seat Access Status (`D-222`) | حالة مقعد الوصول | Seat Access Status | `data.seatAssigned` (literal `true`; without a seat the guard answers `403 ACCOUNTING.FEATURE.SEAT_REQUIRED` and no body is built, `D-222`) | `positive` `مقعد وصول مفعّل / Seat Assigned` (access control only; zero pricing/billing unit copy per `D-222`). |
| **Summary Card 4** | Scope Activation Status | حالة تفعيل الشركة | Company Activation | `data.activation` (`companyId`, `profileExists`, `activated`, `accountingActivatedOn`, `firstPostingAt`; `null` when the read resolves at `TENANT`) | Shows `مفعّلة منذ 2026-01-01 / Activated 2026-01-01` or `غير مفعّلة بعد / Not Activated Yet` with `<Link href="/accounting/setup/company">` (`SCR-01`). |
| **Snapshot Freshness** | Snapshot Timestamp | وقت التحقق من الصلاحيات | Entitlement Snapshot As-Of | `data.asOf` (`ISO8601`) | Rendered in header caption via `Intl.DateTimeFormat` (`ar-EG-u-nu-latn` / `en-US`). |
| **Filter Bar** | Search Input | بحث بالاسم أو المفتاح البرمجي... | Search capability or feature key... | Client UI state `query: string` | Matches `titleAr`, `titleEn`, `gatesAr`, `gatesEn`, or exact `accounting.*` key. |
| **Filter Bar** | Release / Tier Filter Chips | تصفية حسب الباقة والإصدار | Filter by Tier & Wave | Client UI state `filter: 'ALL' \| 'ENTITLED' \| 'BASIC' \| 'ADVANCED' \| 'WAVE_1' \| 'WAVE_2' \| 'WAVE_3'` | Counts displayed in `<IdentifierText>`: `64`, `28` / `64`, `28`, `36`, `9`, `17`, `10`. |
| **Filter Bar** | Domain Selector | المجال المحاسبي | Accounting Domain | Client UI state `section: 'ALL' \| '6.1'..'6.9'` | Filters across the `9` canonical domains of `10_Feature_Tiers.md` §6.1–§6.9. |
| **Matrix Column 1** | Capability & Key | الميزة والمفتاح البرمجي | Capability & Feature Key | Static `featureCatalogue[key]` (`titleI18n`, `gatesI18n`) + `key` | Localized title (`font-medium` `500`), 1-line factual scope (`text-secondary`), and `<IdentifierText>{key}</IdentifierText>` (`text-xs font-mono`). |
| **Matrix Column 2** | Minimum Tier | الباقة | Tier | Static `tier` (`'BASIC' \| 'ADVANCED'`) | `Basic / الأساسية` (`neutral`) vs `Advanced / المتقدمة` (`neutral` outline). |
| **Matrix Column 3** | Release Wave | الإصدار | Release Wave | `data.keys[].wave` (static `wave` as fallback) (`'MVP' \| 'WAVE_1' \| 'WAVE_2' \| 'WAVE_3'`) | `MVP — متاح حالياً / MVP Release` vs `Wave 1 — الإصدار ١`, `Wave 2 — الإصدار ٢`, `Wave 3 — الإصدار ٣`. |
| **Matrix Column 4** | Tenant Entitlement Status & Quota | الحالة في حسابك | Your Status & Limits | Derived strictly from `data.keys[].entitled` + `wave` (`AccountingFeaturesDto`; the DTO carries no per-key config and no downgrade-history flag, so neither is rendered) | **3 deterministic badge states:**<br>1. Entitled + `MVP`: `positive` (`✓ مفعّلة الآن / Active Now`)<br>2. Entitled + `Wave 1..3` not yet live: `caution` (`◷ مشمولة · قادمة في الإصدار N / Entitled · Scheduled Wave N`)<br>3. Not entitled: `neutral` (`— غير مشمولة بالباقة الحالية / Not in Current Plan`) |

---

### 2.5 Complete Verbatim `64`-Key Bilingual Feature Catalogue (`10_Feature_Tiers.md` §6.1–§6.10)

Every one of the **`64`** keys (`28` Basic `MVP` + `36` Advanced across `Wave 1` [`9`], `Wave 2` [`17`], `Wave 3` [`10`]) is rendered in `FeatureDomainMatrix.tsx` in the exact 9-group order of `10_Feature_Tiers.md` §6.1–§6.9:

| # | Section | Verbatim Feature Key (`accounting.*`) | Tier | Domain (`§6`) | Wave | Arabic Capability Title (`ar`) | English Capability Title (`en`) | Gated Capabilities & Config Summary (`10_Feature_Tiers.md` §6 & §7) |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `§6.1` | `accounting.ledger.core` | Basic | `ledger` | `MVP` | نواة دفتر الأستاذ العام وقواعد الترحيل | Core General Ledger & Posting Rules | Chart, accounts, journals, dimensions, calendars, periods, FX rates, drafts, posting, reversal, recurring templates, and posting rules of all source apps (`D-723`). |
| 2 | `§6.1` | `accounting.ledger.multi_ledger` | Advanced | `ledger` | `Wave 2` | دفاتر الأستاذ المتعددة والموازية | Multi-Ledger (`PARALLEL` / `EXTENSION`) | Creating a `PARALLEL` or `EXTENSION` ledger and posting a second accounting principle (`D-151`, `D-009`). |
| 3 | `§6.1` | `accounting.ledger.allocations` | Advanced | `ledger` | `Wave 1` | قواعد ودورات التوزيع التحليلي | Cost Allocations & Statistical Cycles | Allocation rules, allocation cycles, statistical dimensions, and `EntryKind.ALLOCATION` (`D-160`). |
| 4 | `§6.1` | `accounting.ledger.budgets` | Advanced | `ledger` | `Wave 1` | الموازنات التقديرية والارتباطات المالية | Budgets, Commitments & Variance | Budget versions, budget lines, commitment entries, and budget-vs-actual reporting (`D-161`). |
| 5 | `§6.2` | `accounting.tax.engine` | Basic | `tax` | `MVP` | محرك الضرائب وسجل المستندات الضريبية | 5-Step Tax Engine & Fiscal Document Registry | 5-step tax engine, rule sets, publish gates, adoptions, overrides, decision receipts, tax subledger, and fiscal-document registry (`D-723`). |
| 6 | `§6.2` | `accounting.tax.returns` | Basic | `tax` | `MVP` | الإقرارات الضريبية الدورية | Periodic Tax Returns & Filing | Return definitions, box mappings, return periods, and filing for any adopted pack (EG Forms 10, 41, 11; `D-723`). |
| 7 | `§6.2` | `accounting.tax.withholding` | Basic | `tax` | `MVP` | ضريبة الخصم والتحصيل والشهادات | Withholding Tax, Accumulators & Certificates | Withholding accumulators, certificates, and non-resident remittance workflow (`D-040`, `D-041`). |
| 8 | `§6.2` | `accounting.tax.partial_recovery` | Basic | `tax` | `MVP` | الخصم النسبي لضريبة المدخلات والتسوية السنوية | Partial Input-Tax Recovery & Annual Adjustment | Input-tax attribution, monthly recovery ratio, and annual adjustment runs (`D-044`, `D-099`). |
| 9 | `§6.2` | `accounting.tax.tax_groups` | Advanced | `tax` | `Wave 2` | المجموعات الضريبية والإقرار الموحد | Tax Groups & Representative Filing | Group tax registration, representative company, and group-level returns (`D-038`). |
| 10 | `§6.3` | `accounting.documents.einvoice_eg` | Basic | `documents` | `MVP` | الفاتورة الإلكترونية المصرية (ETA) | Egypt e-Invoice Authority Integration (ETA) | ETA connections, signing certificates, submit/resubmit/poll, cancel/reject, reconciliation, and EGS/GPC item codes (`D-723`). |
| 11 | `§6.3` | `accounting.documents.ereceipt_eg` | Basic | `documents` | `MVP` | الإيصال الإلكتروني المصري (نقاط البيع) | Egypt e-Receipt Profile & Device Chains | POS device enrolment, per-device hash chain, batch queue, return receipts, and late submission (`D-094`..`D-096`). |
| 12 | `§6.3` | `accounting.documents.inbound_matching` | Basic | `documents` | `MVP` | استلام ومطابقة فواتير المشتريات الواردة | Inbound Authority Documents & 3-Way Matching | Inbound authority documents, buyer rejection window, purchase matching, and input-tax evidence (`D-108`..`D-110`). |
| 13 | `§6.3` | `accounting.documents.ocr_intake` | Advanced | `documents` | `Wave 3` | الاستخلاص الضوئي بالذكاء الاصطناعي والبريد | OCR & Email Document Intake Assistant | Email and scanned document intake, model-proposed matches, and capture assistant (`D-155`, `D-202`). |
| 14 | `§6.3` | `accounting.documents.zatca` | Advanced | `documents` | `Wave 2` | الفوترة الإلكترونية السعودية (فاتورة ZATCA) | Saudi ZATCA Phase-2 Stamping & Clearance | Saudi standard/simplified profiles, cryptographic stamping, and clearance/reporting (`D-084`, `D-172`). |
| 15 | `§6.3` | `accounting.documents.peppol` | Advanced | `documents` | `Wave 3` | الفوترة الإلكترونية الإماراتية (Peppol PINT AE) | UAE Peppol PINT Access-Point Profile | UAE Peppol PINT access-point e-invoicing profile (`D-084`, `D-200`). |
| 16 | `§6.4` | `accounting.receivables.core` | Basic | `receivables-payables` | `MVP` | نواة حسابات العملاء والتسويات وأستاذ الأطراف | Core Accounts Receivable, Settlements & Party Ledger | AR subledger, open items, settlement allocations, payment terms, instalments, discounts, advances, and party ledger (`D-026`). |
| 17 | `§6.4` | `accounting.receivables.dunning` | Basic | `receivables-payables` | `MVP` | المطالبات وإشعارات التأخير | Dunning Procedures, Notices & Capped Interest | Dunning procedures, levels, runs, notices, fees, and statutory capped interest (`D-141`). |
| 18 | `§6.4` | `accounting.receivables.statements` | Basic | `receivables-payables` | `MVP` | كشوف حسابات العملاء وأعمار الديون | Customer Statements & Aging Reports | Statement profiles, open-item & balance-forward customer statements, and aging (`D-142`). |
| 19 | `§6.4` | `accounting.receivables.netting` | Basic | `receivables-payables` | `MVP` | المقاصة القانونية والتعاقدية (AR / AP) | AR / AP Legal & Contractual Netting | Legal and contractual set-off between receivable and payable positions (`D-147`). |
| 20 | `§6.4` | `accounting.receivables.credit_control` | Basic | `receivables-payables` | `MVP` | إدارة الائتمان والنزاعات وإعدام الديون | Credit Limits, Holds, Disputes & Write-Offs | Credit limits, holds, promises to pay, payment plans, disputes, write-offs, and exposure read model (`D-185`). |
| 21 | `§6.4` | `accounting.receivables.ecl` | Advanced | `receivables-payables` | `Wave 1` | مخصص الخسائر الائتمانية المتوقعة (ECL) | Expected Credit Loss (IFRS 9 / EAS 47 ECL) | ECL aging buckets, loss rates as data, and monthly provision runs (`D-185`). |
| 22 | `§6.4` | `accounting.receivables.collections_worklist` | Advanced | `receivables-payables` | `Wave 2` | قوائم عمل التحصيل وتوزيع المحصلين | Strategy-Driven Collections Worklists | Collection strategies, prioritized collector queues, and collector assignment (`D-185`). |
| 23 | `§6.5` | `accounting.payables.core` | Basic | `receivables-payables` | `MVP` | نواة حسابات الموردين والرقابة الثنائية للحسابات البنكية | Core Accounts Payable & Dual-Control Payee Banks | AP subledger, supplier open items, dual-control party bank accounts, and single payments (`D-026`, `D-183`). |
| 24 | `§6.5` | `accounting.payables.payment_runs` | Basic | `treasury` | `MVP` | دورات الدفع المجمعة للموردين | Batch Payment Proposals, Approvals & Execution | Payment proposals, approval workflow, execution, bank file generation, and bank acknowledgement (`D-144`). |
| 25 | `§6.6` | `accounting.treasury.cash_and_custody` | Basic | `treasury` | `MVP` | الخزائن والعهد النقدية وورديات نقاط البيع | Cash Boxes, Petty Cash, Custodies & POS Shifts | Treasuries, petty cash, employee custodies, cash transfers, and POS shift summaries (`D-182`). |
| 26 | `§6.6` | `accounting.treasury.cheques_pdc` | Basic | `treasury` | `MVP` | الشيكات وأوراق القبض والدفع المؤجلة | Cheques, Post-Dated Instruments & Cheque Books | Inbound/outbound cheques & PDCs with endorsement, collection, bounce, recourse, and cheque books (`D-181`). |
| 27 | `§6.6` | `accounting.treasury.bank_reconciliation` | Basic | `treasury` | `MVP` | التسوية البنكية وقواعد المطابقة | Bank Statement Import & Reconciliation Sessions | Statement import by template, matching rules, reconciliation sessions, and difference handling (`D-118`). |
| 28 | `§6.6` | `accounting.treasury.bank_files` | Basic | `treasury` | `MVP` | قوالب وملفات التحويلات البنكية | Bank Transfer File Formats & Generation | Bank file formats and supplier transfer file generation; salary formats from Wave 2 (`D-144`, `D-192`). |
| 29 | `§6.6` | `accounting.treasury.liquidity` | Advanced | `treasury` | `Wave 1` | توقعات السيولة وتواريخ السداد المتوقعة | Liquidity Forecasting & Cash Forecast Categories | Expected settlement dates on open items, account cash forecast categories, and liquidity forecast (`D-157`). |
| 30 | `§6.6` | `accounting.treasury.bank_connectivity` | Advanced | `treasury` | `Wave 2` | الربط البنكي المباشر (Open Banking API) | Direct Bank API Connectivity & Auto-Statements | Direct bank API connections and automated bank statement retrieval (`D-156`). |
| 31 | `§6.6` | `accounting.treasury.payment_gateway` | Advanced | `treasury` | `Wave 1` | بوابات الدفع الإلكتروني وروابط التحصيل | Payment Gateways, Payment Links & Settlements | Payment provider connections, payment links, provider settlement files, and fee rules (`D-187`). |
| 32 | `§6.6` | `accounting.treasury.instruments` | Advanced | `treasury` | `Wave 2` | التسهيلات والقروض وخطابات الضمان والتمويل | Loans, Facilities (Wave 2) & Trade Finance (Wave 3) | Loans, facilities, overdrafts, deposits, IC loans (Wave 2); LCs, guarantees, factoring, Islamic finance & FX forwards (Wave 3) (`D-184`). |
| 33 | `§6.7` | `accounting.assets.core` | Basic | `assets` | `MVP` | سجل الأصول الثابتة وإهلاك الدفاتر المحاسبية | Fixed Asset Register & Accounting Book Depreciation | Asset categories, asset register, `BOOK` depreciation runs, additions, splits/merges, and disposals (`D-149`). |
| 34 | `§6.7` | `accounting.assets.tax_book_eg` | Basic | `assets` | `MVP` | الدفتر الضريبي للأصول الثابتة ومجمعات الإهلاك | Tax Depreciation Book & Pooled Basis (EG Law 91) | `TAX` book, Egyptian pooled tax depreciation groups, and 30% accelerated first-year claim (`D-102`). |
| 35 | `§6.7` | `accounting.assets.revaluation` | Advanced | `assets` | `Wave 2` | إعادة تقييم الأصول والاضمحلال والنقل بين الشركات | Asset Revaluation, Impairment & IC Transfers | Revaluation model, impairment, impairment reversal, and inter-company asset transfers (`D-189`). |
| 36 | `§6.7` | `accounting.assets.auc` | Advanced | `assets` | `Wave 3` | مشروعات تحت التنفيذ وتسوية الرأسمالية | Assets Under Construction (AuC) Settlement | Settling accumulated construction cost items onto target capitalized assets (`D-149`). |
| 37 | `§6.7` | `accounting.projects.contracting` | Advanced | `close-reporting` | `Wave 3` | عقود المقاولات والمستخلصات والاستقطاعات | Project Contracts, Progress Billing & Retentions | Project contracts, schedule of values, progress billing, retentions, and WIP recognition (`D-188`). |
| 38 | `§6.7` | `accounting.schedules.subscriptions_stored_value` | Advanced | `assets` | `Wave 2` | جداول الاشتراكات والقسائم والحوافز المستحقة | Subscription Schedules, Stored Value & Incentives | Subscription billing schedules, stored-value liabilities/breakage, and incentive accruals (`D-186`). |
| 39 | `§6.7` | `accounting.treasury.direct_debit` | Advanced | `treasury` | `Wave 2` | تفويضات الخصم المباشر ودورات التحصيل | Direct Debit Mandates & Collection Runs | Direct debit mandates (`EG_DD`, `SADAD`, `UAEDDS`) and automated collection runs (`D-187`, `D-202`). |
| 40 | `§6.7` | `accounting.assets.physical_inventory` | Advanced | `assets` | `Wave 3` | الجرد الفعلي للأصول الثابتة ومطابقتها | Physical Asset Tags, Counts & Reconciliation | Asset tags, physical count sessions, and register reconciliation (`D-189`). |
| 41 | `§6.7` | `accounting.expenses.claims` | Advanced | `documents` | `Wave 3` | مطالبات مصروفات الموظفين واعتمادها | Employee Expense Claims & Reimbursement | `EXPENSE_CLAIM` fiscal documents with approval workflow and employee settlement (`D-168`). |
| 42 | `§6.7` | `accounting.reporting.sustainability` | Advanced | `close-reporting` | `Wave 3` | وسوم الاستدامة وتقارير الانبعاثات | Sustainability Tags & Emissions Reporting | Sustainability tags on accounts/items and ledger-derived emissions reporting (`D-201`). |
| 43 | `§6.7` | `accounting.assets.leases` | Advanced | `assets` | `Wave 3` | عقود الإيجار وأصول حق الانتفاع (EAS 49 / IFRS 16) | Lease Contracts & Right-of-Use Assets | Lessee/lessor lease contracts, schedules, remeasurements, and `RIGHT_OF_USE` assets (`D-190`). |
| 44 | `§6.7` | `accounting.schedules.deferrals` | Basic | `assets` | `MVP` | جداول الإيرادات والمصروفات المؤجلة والمقدمة | Deferred Revenue & Prepaid Expense Schedules | Deferral templates, schedules, and periodic recognition lines (`D-145`). |
| 45 | `§6.7` | `accounting.schedules.provisions` | Advanced | `assets` | `Wave 2` | المخصصات والضرائب المؤجلة | Provisions Roll-Forward & Deferred Tax | Provision formation, utilization, unwinding, reversal, and temporary-difference deferred tax (`D-191`). |
| 46 | `§6.8` | `accounting.close.checklist` | Basic | `close-reporting` | `MVP` | قوائم مهام الإقفال الشهري والسنوي وتقويم الامتثال | Period Close Checklists, Locks & Compliance Calendar | Close templates, instances, system checks, module locking, year-end close, and compliance calendar (`D-150`). |
| 47 | `§6.8` | `accounting.close.approvals` | Basic | `close-reporting` | `MVP` | قواعد وطلبات الاعتماد وفصل المُعد عن المُعتمد | Multi-Step Approvals & Maker-Checker Control | Approval rules, steps, requests, and actions enforcing `maker_user_ids` separation (`D-146`, `D-467`). |
| 48 | `§6.8` | `accounting.close.journal_analyzer` | Advanced | `close-reporting` | `Wave 1` | محلل القيود واكتشاف الحركات غير المعتادة | Journal Anomaly Rules & Review Queue | Data-driven anomaly rules over posted entries, review queue, and dismissal audit trail (`D-193`). |
| 49 | `§6.8` | `accounting.close.sod_certification` | Advanced | `close-reporting` | `Wave 2` | تعارض الصلاحيات (SoD) ومصادقة الحسابات | Segregation of Duties, Account Certification & Bands | SoD rules/scans, balance-sheet account certification, approval delegations, and banded limit chains (`D-193`, `D-618`). |
| 50 | `§6.8` | `accounting.reporting.statements` | Basic | `close-reporting` | `MVP` | القوائم المالية وميزان المراجعة والأستاذ العام | Financial Statements, Trial Balance & General Ledger | Reporting frameworks, statement layouts, line mappings, standard statements, Trial Balance, and GL (`D-723`). |
| 51 | `§6.8` | `accounting.reporting.snapshots` | Basic | `close-reporting` | `MVP` | اللقطات المرجعية المعتمدة وحزم التصدير | Immutable Filing Snapshots & Statutory Exports | Immutable report snapshots bound to filings with SHA-256 checksum and archived export artifacts (`D-166`). |
| 52 | `§6.8` | `accounting.reporting.report_builder` | Advanced | `close-reporting` | `Wave 2` | مصمم التقارير المخصصة وتصدير التحليلات | Custom Report Builder & Read-Replica BI Export | Tenant-authored report definitions and BI exports; carries config `{ maxDefinitions, maxRowsPerExport }` (`D-165`). |
| 53 | `§6.8` | `accounting.reporting.flux_executive` | Advanced | `close-reporting` | `Wave 1` | تحليل الانحرافات والملخص التنفيذي | Flux Variance Analysis & Executive Summary | `FLUX` and `EXECUTIVE_SUMMARY` statement kinds (`D-194`, `D-165`). |
| 54 | `§6.9` | `accounting.integration.trade_posting` | Basic | `integration` | `MVP` | الترحيل التلقائي مع المبيعات والمخزون (Trade) | Trade Operational Posting & Inventory Valuation | Trade event consumers, source-document links, FIFO / Weighted-Average cost layers, valuation & reconciliation runs (`D-723`). |
| 55 | `§6.9` | `accounting.integration.payroll_import` | Basic | `integration` | `MVP` | استيراد ملخص الرواتب والأجور | Fixed-Schema Payroll Summary Import | `PAYROLL_IMPORT` fiscal document import with branch clearing split (`D-115`, `D-192`). |
| 56 | `§6.9` | `accounting.integration.payroll_bridge` | Advanced | `integration` | `Wave 2` | الربط التفصيلي للرواتب والسلف ومكافأة نهاية الخدمة | Detailed Payroll Bridge, Loans, EOS & WPS Rows | Per-department payroll, employee loan schedules, EOS/leave provisions, and `WPS_SIF` salary layout rows (`D-192`). |
| 57 | `§6.9` | `accounting.integration.manufacturing` | Advanced | `integration` | `Wave 3` | أحداث تكاليف التصنيع والتكلفة المعيارية | Manufacturing & Consignment Posting Events | `MO_CONSUME`, `MO_OUTPUT`, `VARIANCE`, `CONSIGNMENT_OWNERSHIP` posting events & standard costing (`D-179`). |
| 58 | `§6.9` | `accounting.integration.intercompany` | Advanced | `integration` | `Wave 2` | المعاملات والمطابقة بين الشركات الشقيقة | Intercompany Rules, Mirrored Docs & Matching | Intercompany rules, mirrored documents, and cross-company match keys (`D-163`, `D-170`). |
| 59 | `§6.9` | `accounting.integration.consolidation` | Advanced | `integration` | `Wave 2` | القوائم المالية المجمعة واستبعادات المجموعة | Group Structures, Eliminations & Group Currency | Ownership hierarchies, intercompany eliminations, and `amount_group` consolidated reporting (`D-163`). |
| 60 | `§6.9` | `accounting.platform.custom_fields` | Advanced | `integration` | `Wave 1` | الحقول الإضافية وقواعد التحقق المخصصة | Tenant Custom Fields & Validation Rules | Tenant-defined custom fields and tenant-authored validation rules (`D-195`). |
| 61 | `§6.9` | `accounting.platform.alerts` | Advanced | `integration` | `Wave 1` | التنبيهات التلقائية وجدولة التقارير | Alert Rules, Channels & Scheduled Reports | Configurable alert rules, recipient channels, and scheduled report delivery (`D-198`). |
| 62 | `§6.9` | `accounting.platform.webhooks` | Advanced | `integration` | `Wave 3` | إشعارات الويب الصادرة (Webhooks) | Outbound Accounting Event Webhooks | Outbound subscriptions on `accounting.events`; carries config `{ maxSubscriptions, maxDeliveriesPerDay }` (`D-174`). |
| 63 | `§6.9` | `accounting.platform.multi_country` | Advanced | `integration` | `Wave 2` | تعدد الدول والحزم الضريبية داخل نفس المستأجر | Multi-Country Pack Adoption & Cross-Jurisdiction | Adopting a second country pack in the same tenant and multi-jurisdiction reporting (`D-172`, `D-173`). |
| 64 | `§6.9` | `accounting.platform.accounting_firms` | Advanced | `integration` | `Wave 2` | وصول مكاتب المحاسبة والمراجعين الخارجيين | External Accountant & Auditor Time-Boxed Access | Cross-tenant consented temporary access and `INTERMEDIARY` authority credentials (`D-116`, `D-117`). |

---

### 2.6 Complete UI State, Permission & Entitlement Matrix (`SCR-36`)

| State Category | Trigger / Condition | Visual & Behavioural Treatment |
| --- | --- | --- |
| **1. Initial Loading** | `GET /api/tenant/accounting/v1/meta/features` in flight | Renders `4` metric `Skeleton` cards (`h-24`) + `FilterBar` skeleton + `3` domain `SectionCard` `TableSkeleton` blocks (`aria-busy="true"`). Never flashes `Basic` or `Not in Plan` before the server snapshot resolves. |
| **2. Populated — `Basic` Tenant (`isTenantOwner === true`)** | `tier === 'accounting.basic'`, `28` keys entitled, `user.isTenantOwner === true` | Summary strip shows `Basic / الباقة الأساسية`, `28 / 64` active keys, `Seat Assigned`. `PageHeader` renders single primary `<Link href="/core/subscription">` (`إدارة الاشتراك ↗ / Manage Subscription ↗`). All `28` Basic keys show `✓ مفعّلة الآن / Active Now`; `36` Advanced keys show `— غير مشمولة بالباقة الحالية / Not in Current Plan` with their `Wave 1/2/3` badge. |
| **3. Populated — `Basic` Tenant (`isTenantOwner === false`)** | Same as above, but `user.isTenantOwner === false` | Identical factual matrix, **zero** `/core/subscription` button or link in DOM, replaced in header meta by calm text: `تتم إدارة الباقة بواسطة مالك الحساب فقط / Plan changes are managed by the tenant account owner.` |
| **4. Populated — `Advanced` Tenant** | `tier === 'accounting.advanced'`, all `64` keys entitled | Summary strip shows `Advanced / الباقة المتقدمة` (`positive` badge), `64 / 64` entitled (`28 Live · 36 Wave 1–3`). `28` MVP keys show `✓ مفعّلة الآن / Active Now`; `36` unshipped wave keys show `◷ مشمولة · مجدولة (الإصدار N) / Entitled · Scheduled (Wave N)` (`caution` chip) + `config` quota pills on `report_builder` and `webhooks`. |
| **5. Downgraded Tenant (`Read-Only History Retained`)** | Tenant previously wrote Advanced rows and downgraded to `Basic` (`10_Feature_Tiers.md` §5 & §11) | Top informational `Banner` (`tone="caution"`): `تم الاحتفاظ بكافة السجلات التاريخية للمزايا المتقدمة بوضع القراءة فقط — لا يتم حذف أي بيانات عند تخفيض الباقة / Historical Advanced data is preserved in read-only mode — downgrading never deletes accounting records.` Affected keys display `👁 قراءة فقط للبيانات السابقة / Read-Only History`. |
| **6. Empty Filter Match** | Search string or chip combination matches `0` of `64` keys | Compact `EmptyState`: `لا توجد مزايا تطابق معايير البحث / No capabilities match the current filter` + `إعادة ضبط الفلاتر / Reset Filters` button. (Server `0`-key payload is never an empty state — a malformed/empty authority snapshot fails closed on the backend with `503 ENTITLEMENT_UNAVAILABLE`). |
| **7. `403` Missing `accounting.setting.read`** | Guard 6 refuses `/meta/features` with `403 ACCOUNTING.SCOPE.TARGET_DENIED` / missing `accounting.setting.read` | Renders `<PermissionGate requiredPermission="accounting.setting.read" />` with `correlationId`. |
| **8. `503 ENTITLEMENT_UNAVAILABLE` (Fail-Closed Authority)** | Control-plane snapshot cannot be built or `config` schema validation failed (`10_Feature_Tiers.md` §7 & §9) | Full-surface `ErrorState` (`Cause`: temporary inability to verify subscription entitlement snapshot; `Effect`: zero accounting data changed, commands fail closed for safety; `Safe Action`: `إعادة التحقق / Retry Verification` button + `correlationId`). **Never** guesses `Basic` and **never** renders an upgrade link while `503`. |
| **9. Seat / Module / Maintenance / Recovery / Archived Boundaries** | `SEAT_REQUIRED`, `MODULE_DISABLED`, `PROVISIONING_MAINTENANCE`, `RECOVERY_MODE`, `TenantStatus.ARCHIVED` | • `SEAT_REQUIRED` / `MODULE_DISABLED` / `PROVISIONING_MAINTENANCE`: rendered by `AccountingBoundaryGate` (`accounting-patterns-documents.md` §3).<br>• `RECOVERY_MODE` (`D-221`) & `TenantStatus.ARCHIVED`: `GET /meta/features` is a read and continues to render `#118` under the persistent global recovery / archived read-only banner; outbound subscription mutation link is hidden while archived. |

---

### 2.7 Four-Combination ASCII Mockups (`SCR-36`)

> **Responsive Behaviour (`375px` Mobile):** The `4`-card `PlanSummaryStrip` stacks `1`-per-row (`grid-cols-1`), filter chips scroll horizontally (`overflow-x-auto no-scrollbar`), and each row inside `FeatureDomainMatrix` collapses from a `4`-column table row into a compact stacked card (`Title + Status Badge` on row 1, `1-line description` on row 2, `<IdentifierText>accounting.*</IdentifierText> + Tier + Wave` chips on row 3).

#### 2.7.1 Combination 1 — Arabic RTL × Light Mode (`Basic` Plan · `user.isTenantOwner === true`)

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [B] متكامل · المحاسبة          [الشركة المصرية للتجارة ▾] [الفرع: كل الفروع ▾]          [☀ نهاري] [EN] [أحمد م.] │ 45px Ocean Navy GlobalNav (dir="rtl")
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ الإعدادات والتهيئة  ◂  باقة المحاسبة والمزايا المتاحة                                   [إدارة الاشتراك في المنصة ↗] │ Owner-only primary Link (/core/subscription)
│ مرجع واقعي لمزايا باقتك الحالية وخارطة الإصدارات ١–٣ · التحقق: ‎2026-10-02 14:30 UTC‎                              │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────┐ ┌──────────────────────────┐ ┌──────────────────────────┐ ┌────────────────────────┐ │
│ │ الباقة الحالية          │ │ المزايا المشمولة بالباقة │ │ حالة مقعد الوصول (D-222) │ │ حالة تفعيل الشركة      │ │ PlanSummaryStrip
│ │ [الباقة الأساسية Basic] │ │ ‎28 / 64‎ ميزة             │ │ [✓ مقعد وصول مفعّل]      │ │ [✓ مفعّلة · EG Pack]   │ │ (4 equal cards)
│ │ شاملة كافة مهام MVP     │ │ ‎28‎ مفعّلة الآن           │ │ صلاحية وصول فقط          │ │ منذ ‎2026-01-01‎         │ │
│ └─────────────────────────┘ └──────────────────────────┘ └──────────────────────────┘ └────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [🔍 بحث بالاسم أو المفتاح...]  [● الكل ‎64‎] [المشمولة ‎28‎] [الأساسية ‎28‎] [المتقدمة ‎36‎] [إصدار ١ (‎9‎)] [إصدار ٢ (‎17‎)] [إصدار ٣ (‎10‎)] [المجال: الكل ▾] │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ▾ ١. دفتر الأستاذ العام (Ledger · ‎1 / 4‎ مشمولة)                                                                 │ SectionCard §6.1
│ الميزة والمفتاح البرمجي                                      │ الباقة   │ الإصدار │ الحالة في حسابك              │
│ ────────────────────────────────────────────────────────────┼──────────┼─────────┼────────────────────────────── │
│ نواة دفتر الأستاذ العام وقواعد الترحيل                       │ الأساسية │ MVP     │ [✓ مفعّلة الآن]              │ positive badge
│ الدليل والحسابات واليوميات والفترات والعملات · ‎accounting.ledger.core‎                                            │ LTR IdentifierText
│ دفاتر الأستاذ المتعددة والموازية (PARALLEL / EXTENSION)      │ المتقدمة │ إصدار 2 │ [— غير مشمولة بالباقة]       │ neutral badge
│ مبدأ محاسبي ثانٍ وعملة المجموعة · ‎accounting.ledger.multi_ledger‎                                                  │
│ قواعد ودورات التوزيع التحليلي                                │ المتقدمة │ إصدار 1 │ [— غير مشمولة بالباقة]       │
│ التوزيع الإحصائي وقيود ALLOCATION · ‎accounting.ledger.allocations‎                                                 │
│ الموازنات التقديرية والارتباطات المالية                      │ المتقدمة │ إصدار 1 │ [— غير مشمولة بالباقة]       │
│ نسخ الموازنة ومقارنة الفعلي بالمخطط · ‎accounting.ledger.budgets‎                                                   │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ℹ حدود الملحقات القطاعية (Vertical Add-Ons): باقات العقارات (‎accounting.realestate‎) والمقاولات (‎accounting.contracting‎) │ §8 Structural Note
│   والتصنيع (‎accounting.manufacturing‎) تُدار كملحقات مستقلة في المنصة وليست فئة ثالثة ضمن باقتي المحاسبة.         │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 2.7.2 Combination 2 — Arabic RTL × Dark Mode (`Advanced` Plan · `user.isTenantOwner === false` · Wave & Quota Honesty)

```text
╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
║ [B] متكامل · المحاسبة          [الشركة المصرية للتجارة ▾] [الفرع: كل الفروع ▾]           [☾ داكن] [EN] [سارة ع.] ║ Dark Canvas (#0b1220) · dir="rtl"
╠══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣
║ الإعدادات والتهيئة  ◂  باقة المحاسبة والمزايا المتاحة          (تتم إدارة تعديل الباقة بواسطة مالك الحساب فقط)   ║ Non-owner: NO /core/subscription CTA
╠══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣
║ ┌─────────────────────────┐ ┌──────────────────────────┐ ┌──────────────────────────┐ ┌────────────────────────┐ ║
║ │ الباقة الحالية          │ │ المزايا المشمولة بالباقة │ │ حالة مقعد الوصول (D-222) │ │ حالة تفعيل الشركة      │ ║
║ │ [✓ المتقدمة Advanced]   │ │ ‎64 / 64‎ ميزة (شاملة)     │ │ [✓ مقعد وصول مفعّل]      │ │ [✓ مفعّلة · EG Pack]   │ ║ Superset: 64/64
║ │ تشمل كل مزايا الأساسية  │ │ ‎28‎ نشطة · ‎36‎ مجدولة      │ │ صلاحية وصول للمحاسبة     │ │ منذ ‎2026-01-01‎         │ ║
║ └─────────────────────────┘ └──────────────────────────┘ └──────────────────────────┘ └────────────────────────┘ ║
╠══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣
║ [🔍 بحث...]  [● الكل ‎64‎] [المفعّلة حالياً ‎28‎] [المجدولة ‎36‎] [إصدار ١ (‎9‎)] [إصدار ٢ (‎17‎)] [إصدار ٣ (‎10‎)] [المجال: الإقفال والتقارير ▾] ║
╠══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣
║ ▾ ٨. الإقفال والتقارير المالية (Close & Reporting · ‎8 / 8‎ مشمولة)                                               ║ SectionCard §6.8
║ الميزة والمفتاح البرمجي                                      │ الباقة   │ الإصدار │ الحالة وحدود الاستخدام       ║
╟──────────────────────────────────────────────────────────────┼──────────┼─────────┼──────────────────────────────╢
║ القوائم المالية وميزان المراجعة والأستاذ العام                │ الأساسية │ MVP     │ [✓ مفعّلة الآن]              ║
║ ‎accounting.reporting.statements‎                               │          │         │                              ║
║ اللقطات المرجعية المعتمدة وحزم التصدير                       │ الأساسية │ MVP     │ [✓ مفعّلة الآن]              ║
║ ‎accounting.reporting.snapshots‎                                │          │         │                              ║
║ محلل القيود واكتشاف الحركات غير المعتادة                     │ المتقدمة │ إصدار 1 │ [◷ مشمولة · قادمة في إصدار 1]║ Honest Wave badge
║ ‎accounting.close.journal_analyzer‎                             │          │         │                              ║ (10_Feature_Tiers §10.5)
║ مصمم التقارير المخصصة وتصدير التحليلات                       │ المتقدمة │ إصدار 2 │ [◷ مشمولة · قادمة في إصدار 2]║
║ ‎accounting.reporting.report_builder‎ · الحد: ‎50‎ تعريف / ‎250,000‎ صف للتصدير                                      ║ Config payload pill (§7)
╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝
```

#### 2.7.3 Combination 3 — English LTR × Light Mode (`Basic` Plan with Downgrade Read-Only Retention Callout)

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [B] Mutakamel · Accounting     [Egyptian Trading Co. ▾] [Branch: All Branches ▾]         [☀ Light] [عربي] [A.M.] │ 45px Ocean Navy GlobalNav (dir="ltr")
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Setup  ▸  Accounting Plan & Capabilities                                           [Manage Subscription ↗]       │ Owner-only primary Link
│ Factual overview of your active tier, all 64 accounting feature keys, and Wave 1–3 delivery schedule.            │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ⚠ Non-Destructive Downgrade Active: Your workspace is currently on `Basic`. Previously recorded `Advanced`       │ 10_Feature_Tiers.md §5 & §11
│   records remain intact and readable in read-only mode; creating or editing Advanced items is disabled.          │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────┐ ┌──────────────────────────┐ ┌──────────────────────────┐ ┌────────────────────────┐ │
│ │ Current Tier            │ │ Included Capabilities    │ │ Seat Access (D-222)      │ │ Company Activation     │ │
│ │ [Basic Plan]            │ │ 28 / 64 Keys             │ │ [✓ Seat Assigned]        │ │ [✓ Active · EG Pack]   │ │
│ │ All 28 MVP capabilities │ │ 28 Active · 0 Lost       │ │ Access control status    │ │ Since 2026-01-01       │ │
│ └─────────────────────────┘ └──────────────────────────┘ └──────────────────────────┘ └────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [🔍 Search key or capability...]  [● All 64] [Included 28] [Basic 28] [Advanced 36] [Wave 1 (9)] [Wave 2 (17)] [Wave 3 (10)] │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ▾ 9. Integration & Platform (2 / 11 Included in Current Plan)                                                    │ SectionCard §6.9
│ Capability & Feature Key                                     │ Tier     │ Wave    │ Your Status & Limits         │
│ ────────────────────────────────────────────────────────────┼──────────┼─────────┼────────────────────────────── │
│ Trade Operational Posting & Inventory Valuation              │ Basic    │ MVP     │ [✓ Active Now]               │
│ accounting.integration.trade_posting                         │          │         │                              │
│ Fixed-Schema Payroll Summary Import                          │ Basic    │ MVP     │ [✓ Active Now]               │
│ accounting.integration.payroll_import                        │          │         │                              │
│ Tenant Custom Fields & Validation Rules                      │ Advanced │ Wave 1  │ [👁 Read-Only History]        │ Downgrade retained
│ accounting.platform.custom_fields                            │          │         │                              │
│ Outbound Accounting Event Webhooks                           │ Advanced │ Wave 3  │ [— Not in Current Plan]      │
│ accounting.platform.webhooks · Schema bound: maxSubscriptions / maxDeliveriesPerDay                              │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ℹ Vertical Add-Ons Are Separate From Tiers: `accounting.realestate`, `accounting.contracting`, and               │ 10_Feature_Tiers.md §8
│   `accounting.manufacturing` are Core platform add-ons, not a third Accounting tier and not part of these 64 keys.│
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 2.7.4 Combination 4 — English LTR × Dark Mode (`503 ACCOUNTING.FEATURE.ENTITLEMENT_UNAVAILABLE` Fail-Closed State)

```text
╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
║ [B] Mutakamel · Accounting     [Egyptian Trading Co. ▾] [Branch: All Branches ▾]          [☾ Dark] [عربي] [A.M.] ║ Dark Canvas (#0b1220) · dir="ltr"
╠══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣
║ Setup  ▸  Accounting Plan & Capabilities                                                                         ║ No upgrade CTA when 503!
╠══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                                  ║
║          ┌────────────────────────────────────────────────────────────────────────────────────────────┐          ║
║          │  ⚠ Entitlement Verification Temporarily Unavailable (`503 ENTITLEMENT_UNAVAILABLE`)        │          ║ Fail-closed per
║          │  ────────────────────────────────────────────────────────────────────────────────────────  │          ║ 10_Feature_Tiers.md §9
║          │  • Cause: Accounting could not verify the current subscription entitlement snapshot        │          ║ & §12
║          │    from the platform control plane.                                                        │          ║
║          │  • Effect on Your Books: No ledger balances, settings, or historical records were changed. │          ║
║          │    Commands fail closed rather than guessing a fallback tier.                              │          ║
║          │  • Safe Next Action: Retry verification in a moment. If this persists, share the           │          ║
║          │    correlation ID below with support.                                                      │          ║
║          │                                                                                            │          ║
║          │  Correlation ID: 019f4a82-7c10-7000-8a12-00155d049c01 [Copy]        [↻ Retry Verification] │          ║ 1 primary retry CTA
║          └────────────────────────────────────────────────────────────────────────────────────────────┘          ║
║                                                                                                                  ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 3. Bilingual `i18n` Dictionary Keys & Enum Wire-Label Map (`ar.ts` & `en.ts`)

Zero raw enum strings (`INCOME_STATEMENT_NATURE`, `BALANCE_FORWARD`, `ACCOUNT_SUBTREE`, etc.) may ever render in the DOM (`AGENTS.md` — Bilingual & theming). Both `src/i18n/locales/ar.ts` and `src/i18n/locales/en.ts` define complete parity keys for every enum wire value exercised by `SCR-12` and `SCR-36`:

| Enum (`01_Enums.md`) | Wire Member | Arabic Dictionary Value (`ar.ts`) | English Dictionary Value (`en.ts`) |
| --- | --- | --- | --- |
| `ReportingFrameworkCode` | `EAS` / `IFRS` / `IFRS_SME` / `SOCPA` / `ZAKAT` / `UNIFORM_EG` / `CUSTOM` | معايير المحاسبة المصرية (EAS) / المعايير الدولية (IFRS) / المعايير الدولية للمنشآت الصغيرة (IFRS SME) / الهيئة السعودية (SOCPA) / الزكاة والدخل (ZAKAT) / النظام المحاسبي الموحد المصري / إطار مخصص | Egyptian Accounting Standards (EAS) / IFRS / IFRS for SMEs / SOCPA (Saudi) / Zakat Framework / Egyptian Uniform Accounting System / Custom Framework |
| `StatementKind` *(Stage-1 primary & ledgers)* | `BALANCE_SHEET` / `INCOME_STATEMENT_NATURE` / `INCOME_STATEMENT_FUNCTION` / `COMPREHENSIVE_INCOME` / `CHANGES_IN_EQUITY` / `CASH_FLOW_INDIRECT` / `CASH_FLOW_DIRECT` / `NOTES` / `TRIAL_BALANCE` / `GENERAL_LEDGER` / `PARTY_LEDGER` / `JOURNAL_AUDIT` / `AUDIT_TRAIL` / `IMMUTABILITY` | قائمة المركز المالي / قائمة الدخل (حسب طبيعة المصروف) / قائمة الدخل (حسب وظيفة المصروف) / قائمة الدخل الشامل الآخر / قائمة التغيرات في حقوق الملكية / قائمة التدفقات النقدية (غير المباشرة) / قائمة التدفقات النقدية (المباشرة) / الإيضاحات المتممة / ميزان المراجعة / الأستاذ العام / أستاذ الأطراف / سجل مراجعة اليومية / سجل التدقيق / إثبات عدم القابلية للتعديل | Balance Sheet / Income Statement (By Nature) / Income Statement (By Function) / Statement of Comprehensive Income / Statement of Changes in Equity / Cash Flow Statement (Indirect) / Cash Flow Statement (Direct) / Notes to Financial Statements / Trial Balance / General Ledger / Party Ledger / Journal Audit / Audit Trail / Immutability Proof |
| `ReportDefinitionStatus` | `DRAFT` / `PUBLISHED` / `RETIRED` | مسودة / منشور ومعتمد / متقاعد | Draft / Published / Retired |
| `ReportLineKind` | `HEADER` / `DETAIL` / `SUBTOTAL` / `TOTAL` / `NOTE_REF` | عنوان رئيسي / بند تفصيلي / مجموع فرعي / إجمالي نهائي / إحالة إيضاح | Section Header / Detail Line / Subtotal / Total / Note Reference |
| `ReportMappingSourceKind` | `ACCOUNT` / `ACCOUNT_SUBTREE` / `ACCOUNT_ROLE` / `TAG` | حساب محدد / حساب وفروعه الشجرية / دور حساب قياسي / وسم تحليلي | Single Account / Account Subtree / Account Role / Account Tag |
| `ReportCurrencyMode` | `FUNCTIONAL` / `TRANSACTION` / `GROUP` | عملة الدفاتر الأساسية / عملة المعاملة / عملة المجموعة (مجمّعة) | Functional Currency / Transaction Currency / Group Currency |
| `ReportRunStatus` | `QUEUED` / `RUNNING` / `COMPLETED` / `FAILED` | في قائمة الانتظار / جاري إعداد التقرير / مكتمل / فشل التشغيل | Queued / Running / Completed / Failed |
| `SubledgerSide` | `AR` / `AP` | حسابات العملاء (AR) / حسابات الموردين (AP) | Accounts Receivable (AR) / Accounts Payable (AP) |
| `StatementStyle` | `BALANCE_FORWARD` / `OPEN_ITEMS` | رصيد مرحّل وحركات تفصيلية / بنود مفتوحة حسب الاستحقاق | Balance Forward / Open Items |

---

## 4. Contract Gap List for `P03.T11` (Contract Reconciliation Gate)

Every missing DTO declaration, route gap, or parameter mismatch discovered while mapping `SCR-12` and `SCR-36` against `02_Endpoint_Catalogue.md`, `02_DTOs.md`, `01_Enums.md`, `08_close_and_reporting.md`, and `10_Feature_Tiers.md` is recorded below for resolution in **`P03.T11`** (never papered over by inventing fields or routes):

| Gap ID | Screen | Upstream Source Citations | Exact Contract Gap | Safe Stage-1 UI Handling Until Resolved & Recommended `P03.T11` Fix |
| --- | --- | --- | --- | --- |
| **`CG-RPT-01`** *(extends `CG-DATA-02`)* | `SCR-12` (`#72`, `#73`, `#113`) | `02_DTOs.md` §11.3 & §13.1 rule 5 (`lines 4250–4256`); `02_Endpoint_Catalogue.md` §10 (`lines 1015, 1019, 1021`) & §12 (`lines 1122–1124`) | Under `02_DTOs.md` §13.1 rule 5, computed/joined fields exist **only** if declared in `02_DTOs.md`. Five read responses lack explicit DTO interfaces in `02_DTOs.md`:<br>1. `RenderedReportResultDto` / `RenderedStatementLineDto` for `200 POST /accounting/reports/:code/run` and `COMPLETED` `GET /accounting/reports/runs/:id` (`acc_report_runs` stores run metadata only, not rendered line amounts).<br>2. `TrialBalanceResponseDto` (`GET /accounting/reports/trial-balance` — joined `accountCode`, `accountNameI18n`, `accountRole`, opening, movement, `D-483` year-end closing/opening-entry column, closing, comparative closing, server grand-total footer, `isBalanced`, `asOf`, `asOfChainSeq`).<br>3. `GeneralLedgerResponseDto` (`GET /accounting/reports/general-ledger` — keyset `items[]` + `pageInfo { nextCursor, hasMore }`, server `openingBalance`, `totalDebit`, `totalCredit`, `closingBalance`, per-line `runningBalance`, joined entry/account/party fields).<br>4. `PartyLedgerResponseDto` (`GET /accounting/reports/party-ledger` — `BALANCE_FORWARD` vs `OPEN_ITEMS` row union, server `openingBalance`/`closingBalance`, control-account agreement metadata).<br>5. `ReportCoverageQueryDto` (optional `asOfDate` / `fromDate`..`toDate` range named in Catalogue §10 line 1015 *"for the range"*) and `ReportCoverageDto` (`complete`, `unmappedPostableAccounts[]`) for `GET /accounting/report-definitions/:id/coverage`. | **Recommendation for `P03.T11`:** Declare all five explicit response/query DTO interfaces in `04_Static_Data/02_DTOs.md` §11.3 / §13 and export them from `accounting-app-common` before `P15` / `P17` implementation. |
| **`CG-RPT-02`** | `SCR-12` (`#72`, `#73`) & `SCR-34` | `02_Endpoint_Catalogue.md` §10 (`lines 1022–1024`); `08_close_and_reporting.md` §5; `01_ERD/08_Close_and_Reporting_Tables.md` (`ck_acc_report_runs_snapshot_requires_filing`); `02_DTOs.md` §11.3 (`RunReportDto`) | Three snapshot contract inconsistencies:<br>1. `POST /accounting/reports/snapshots` has **no** declared `CreateReportSnapshotDto` in `02_DTOs.md` (e.g., `{ runId: UUID; artifactFormat?: ExportFormat; filedWithReturnPeriodId?: UUID; filedWithFiscalYearId?: UUID }`), nor a declared `ReportSnapshotDetailDto` for `GET /reports/snapshots/:id` (whose signed artifact URL exceeds §13.1 table projection).<br>2. `08_close_and_reporting.md` §5 lists `If-Match` on `POST /reports/snapshots`, whereas `02_Endpoint_Catalogue.md` §10 line 1022 declares `Concurrency: none`.<br>3. `acc_report_runs` constraint `ck_acc_report_runs_snapshot_requires_filing` requires a filing ID whenever `snapshot_id IS NOT NULL`, whereas `RunReportDto.snapshot?: boolean` allows `filedWithReturnPeriodId` to be omitted and `acc_report_snapshots` permits standalone snapshots. | **UI rule:** Follow Catalogue authority (`x-idempotency-key` UUIDv7, `Concurrency: none`) and require/supply filing binding when creating a filing snapshot.<br>**Recommendation for `P03.T11`:** Declare `CreateReportSnapshotDto` & `ReportSnapshotDetailDto` in `02_DTOs.md`, reconcile `08_close_and_reporting.md` §5 to `Concurrency: none`, and align `ck_acc_report_runs_snapshot_requires_filing` with standalone snapshots (`D-166`). |
| **`CG-RPT-03`** *(aligns with `CG-DATA-02`)* | `SCR-12` (`#73`) | `02_DTOs.md` §13 (`line 4217`) & §13.1 (`line 4252`); `02_Endpoint_Catalogue.md` §10 (`lines 1019–1032`) | `02_DTOs.md` §13.1 withholds `acc_report_runs.artifact_ref` stating artifact bytes are read only via `SignedDownloadDto`, yet `02_Endpoint_Catalogue.md` §10 defines `GET /accounting/exports/runs/:id/download` without a corresponding `GET /accounting/reports/runs/:id/download` (or inline rendered payload contract on `GET /accounting/reports/runs/:id`) for async `202` report runs. | **Recommendation for `P03.T11`:** Either embed the structured `RenderedReportResultDto` inside `GET /accounting/reports/runs/:id` when `status === 'COMPLETED'` (preferred for interactive tree rendering on `#73`) and/or add `GET /accounting/reports/runs/:id/download` returning `SignedDownloadDto`. |
| **`CG-RPT-04`** | `SCR-12` (`#72?view=party-ledger` & `general-ledger` & `statements`) | `02_Endpoint_Catalogue.md` §10 (`line 1019`) & §12 (`lines 1122–1124`); `02_DTOs.md` §11.3 (`lines 3390–3432`) | 1. `GET /accounting/reports/party-ledger` declares single feature key `accounting.receivables.core` even when `PartyLedgerQueryDto.side === 'AP'` (owned conceptually by `accounting.payables.core`, though both are Basic in MVP).<br>2. `TrialBalanceQueryDto` includes explicit `branchId?: UUID`, whereas `GeneralLedgerQueryDto`, `PartyLedgerQueryDto`, and `RunReportDto` omit `branchId?: UUID` and rely solely on `x-mutakamel-branch-id` (`COMPANY_OR_BRANCH` scope header), which changes `AccountingScopeGuard` target evaluation from `COMPANY` to `BRANCH`. | **UI rule:** Send `x-mutakamel-branch-id` from `AccountingScopeBar` when branch-scoped and gate Party Ledger tab on `accounting.receivables.core` per Catalogue.<br>**Recommendation for `P03.T11`:** Confirm whether `GeneralLedgerQueryDto`, `PartyLedgerQueryDto`, and `RunReportDto` should accept optional `branchId?: UUID` (matching `TrialBalanceQueryDto` and `AgingQueryDto`) and confirm `anyOf(receivables.core, payables.core)` vs `receivables.core` on `/reports/party-ledger`. |
| **`CG-RPT-05`** | `SCR-12` (`#72?view=ledger-facts`) | `02_DTOs.md` §5.1 (`line 618`) vs `01_ERD/02_Ledger_Tables.md` (`acc_ledger_facts`) & `02_DTOs.md` §13.1 | `LedgerFactsQueryDto` names filter field `periodId?`, whereas the `acc_ledger_facts` column (and its §13.1 read projection) is `fiscalPeriodId` (`fiscal_period_id`), and `LedgerFactsQueryDto` lacks `fiscalYearId?`, `branchId?`, and `isStale?: boolean` filters as well as joined `accountCode` / `periodCode` display fields on `LedgerFactSummaryDto`. | **UI rule:** Send `periodId` verbatim per `LedgerFactsQueryDto` (`02_DTOs.md` §5.1) and resolve account/period codes from cached `AccountPicker` / `FiscalPeriodPicker` lookups.<br>**Recommendation for `P03.T11`:** Reconcile `periodId` vs `fiscalPeriodId` and add optional `fiscalYearId?`, `branchId?`, `isStale?` to `LedgerFactsQueryDto`. |
| **`CG-RPT-06`** *(aligns with `CG-DATA-05`)* | `SCR-12` (`PartyPicker` on `GL` & `Party Ledger`) | `02_Endpoint_Catalogue.md` §3 (`POST /accounting/party-finance-profiles/lookup`); `02_DTOs.md` §13.2 (`LookupItemDto`) | `GeneralLedgerQueryDto.partyId` and `PartyLedgerQueryDto.partyId[]` expect Core `partyId` (`UUID`), while `POST /accounting/party-finance-profiles/lookup` queries `acc_party_finance_profiles` (which has both `id` and `party_id` and stores no party display name locally). | **Recommendation for `P03.T11`:** Specify in `02_DTOs.md` §4 / §13.2 that `party-finance-profiles/lookup` returns `id = party_id` (Core Party UUID) with localized Core party label so users holding `accounting.report.read` + `accounting.party_finance_profile.read` without `directory.party.read` can still filter Party/General Ledgers by party. |
| **`CG-PLAN-01`** | `SCR-36` (`#118` `/accounting/setup/plan`) | `02_Endpoint_Catalogue.md` §12 (`line 1134`); `10_Feature_Tiers.md` §6.10, §7, §10, §11; `02_DTOs.md`; `accounting-screen-inventory.md` (`lines 14, 84`) | 1. `02_DTOs.md` declares **no** `AccountingMetaFeaturesDto` interface for `GET /accounting/meta/features` (needed for exact property names of `tier`, `enabledFeatures[]`, `seatState`, `activation`, per-key `featureConfigs` for `webhooks` & `report_builder`, per-key `wave` release status, and `downgradedReadOnlyKeys` / historical data presence).<br>2. `accounting-screen-inventory.md` lines 14 & 84 contain a stale summary count (`"28 Basic + 24 Advanced"`), whereas `10_Feature_Tiers.md` §6.10 defines **`28` Basic + `36` Advanced = `64` keys**. | **Recommendation for `P03.T11`:** Declare `AccountingMetaFeaturesDto` in `04_Static_Data/02_DTOs.md` §13 with `{ tier, enabledFeatures, featureConfigs, featureWaves, seatState, activation, hasRetainedAdvancedHistory, asOf }` and update `accounting-screen-inventory.md` lines 14 & 84 to `"28 Basic + 36 Advanced (64 total)"`. |

## Contract reconciliation (P03.T11, 1 November 2026)

Reconciles the gaps of this spec against the Endpoint Catalogue and `02_DTOs.md` after `D-770`, `D-771` and `D-772`. The gap list above keeps the original findings; these rulings are final.

| Gap id | Ruling | Where |
| --- | --- | --- |
| `CG-RPT-01` | closed by D-770 | `RenderedReportDto` with `RenderedReportLine`, `TrialBalanceDto` with `TrialBalanceRow`, `GeneralLedgerPageDto`, `PartyLedgerDto` with `LedgerBalance`, `ReportCoverageQueryDto` and `ReportCoverageDto`; `GET /accounting/reports/runs/:id` answers the run row alone |
| `CG-RPT-02 (1)` | closed by D-770 | `CreateReportSnapshotDto { runId, filedWithReturnPeriodId? }` and `ReportSnapshotDetailDto`; an on-demand snapshot leaves `run.snapshot_id` null (`ck_acc_report_runs_snapshot_requires_filing`) |
| `CG-RPT-02 (2)` | already in the contract | Endpoint Catalogue §10 and module 08 §5 give snapshot create no `If-Match` and no `definitionId`; the module 08 use-case prose that says otherwise is corrected to `D-739` |
| `CG-RPT-02 (3)` | closed by D-770 | `RunReportDto.snapshot` without a filing writes an on-demand snapshot; `filedWithReturnPeriodId` is accepted only with `snapshot: true` and then pins and freezes the run |
| `CG-RPT-03` | duplicate of CG-RPT-01 | The rendered result is `RenderedReportDto`; the artifact download is P17 |
| `CG-RPT-04` | dropped (false) | The party ledger sits under `accounting.receivables.core`, a Basic key, for `AR` and `AP`; the branch comes from `x-mutakamel-branch-id` on the `COMPANY_OR_BRANCH` rows |
| `CG-RPT-05` | already in the contract | `LedgerFactsQueryDto.periodId` is the declared name; `acc_ledger_facts` has no branch column, so none is sent |
| `CG-RPT-06` | closed by D-770 | `PartyFinanceProfileLookupItemDto extends LookupItemDto { partyId }`; `label` is the Core display name read in one batched `PartyDirectoryPort` call, `partyId` as fallback |
| `CG-PLAN-01 (1)` | closed by D-770 | `AccountingFeaturesDto` (`02_DTOs.md` §4.6); the `accounting_cashier` template gains `accounting.setting.read` (count-changing template grant) |
| `CG-PLAN-01 (2)` | dropped (not contract) | The inventory summary string "28 + 24 keys" is stale; the binding count is 28 Basic + 36 Advanced = 64 (Feature Tiers §6) |
