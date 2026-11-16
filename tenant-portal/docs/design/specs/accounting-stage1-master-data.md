# Stage-1 Master Data Screen Designs (`SCR-04` + Companion Master-Data Tabs)

> **Lead review, 1 November 2026 (P03.T09).** Two references were corrected: party merges and tax-id validations are read under `accounting.profile.read`. Every route, permission, feature key and scope below was checked against `docs/LLD/accounting-app/02_API_Contracts/02_Endpoint_Catalogue.md` and `04_Static_Data/05_Permissions_and_Features.md`; what the contracts lack stays in the contract gap list for `P03.T11`.

Status: **Draft for Lead Review (`P03.T09.S3`)**
Plan task: `backend/docs/plans/accounting-app-plan-p03-ux-foundation.md` — `P03.T09.S3`
Screen inventory owner: `SCR-04` (`[P: 51]` primary routes) + `P03.T09.S3` companion Stage-1 master-data tabs (`journals` `[7]`, `number-sequences` `[2]`, `settings` `[5]`) = **65 endpoints designed**
Last contract verification: **2026-11-01** against `02_Endpoint_Catalogue.md` §3, `01_ledger_foundation.md` §5 & UC-LFO-5, `01_Foundation_Tables.md` §§3, 6–10, `02_DTOs.md` §§4 & 13, `01_Enums.md`, `03_Interfaces_and_Value_Objects.md` §§2–7, and `04_Errors_and_Constants.md` §§3–6

---

## 0. Scope Reconciliation, Design Intelligence & Binding Architecture

### 0.1 Route & Inventory Reconciliation (`SCR-04` + `P03.T09.S3` Brief)

Per `accounting-screen-inventory.md` (`SCR-04`), `accounting-ia.md` §3 (`#88`, `#91`–`#94`), and `agy-P03.T09.S3.md`, Stage-1 Master Data spans four route groups in the Tenant Portal (`/api/tenant/accounting/v1/*` -> Accounting App `/accounting/*`, see `CG-S3-11`):

| Surface | IA Route(s) | Inventory Row | Resource Families (`02_Endpoint_Catalogue.md` §3) | Route Count | Feature Gate(s) |
| --- | --- | --- | --- | --- | --- |
| **Surface 1 — Dimensions, Journals & Sequences** | `#91` `/accounting/setup/calendars-journals` (tabs: `dimensions`, `journals`, `sequences`) | `SCR-04` `[P: 21]` + `SCR-03` companion `[9]` | `dimension-types` (6), `dimension-values` (15), `journals` (7), `number-sequences` (2) | **30** | `accounting.ledger.core` |
| **Surface 2 — FX Rate Providers & Exchange Rates** | `#92` `/accounting/setup/fx-rates` | `SCR-04` `[P: 9]` | `fx-rate-providers` (2), `fx-rates` (7) | **9** | `accounting.ledger.core` |
| **Surface 3 — Party Finance Profiles & Tax Regimes** | `#93` `/accounting/setup/parties`, `#94` `/accounting/setup/parties/[id]` | `SCR-04` `[P: 19]` (+ `[S]` Stage-4 tabs) | `party-finance-profiles` (15), `party-tax-regimes` (4) | **19** | `accounting.ledger.core` (`#93`/`#94` shell); `accounting.tax.engine` (`Tax Regimes` tab) |
| **Surface 4 — Validation Rules & Effective-Dated Settings** | `#88` `/accounting/setup/company` (tabs: `validation-rules`, `settings`) | `SCR-04` `[P: 2]` + `SCR-01` companion `[5]` | `validation-rules` (2), `settings` (3), `settings/legal-interim-policies` (2) | **7** | `accounting.ledger.core` |
| **Total** | **`#88`, `#91`, `#92`, `#93`, `#94`** | **`SCR-04` `[P: 51]` + `[14]`** | **9 resource families** | **65** | — |

> **Ownership note (`CG-S3-01`):** `accounting-screen-inventory.md` counts `dimension-types` (6), `dimension-values` (15), and `validation-rules` (2) inside `SCR-04` `[P: 51]` while listing only `#92, #93, #94` in its `Route` cell, and places `journals` (7) + `number-sequences` (2) under `SCR-03` (`#91`) and `settings` (5) under `SCR-01` (`#88`). Because `agy-P03.T09.S1.md` and `agy-P03.T09.S2.md` omit those three families from their `Sources` while `agy-P03.T09.S3.md` explicitly assigns `dimensions, journals, sequences, FX, party profiles, settings`, this specification designs all **65** routes completely so zero Stage-1 master-data endpoints are orphaned.

### 0.2 `ui-ux-pro-max` & Tenant Design System Binding Decisions

Consulted `ui-ux-pro-max` (`SKILL.md` — Enterprise Financial / Accounting Ledger & Configuration Workspace profile, WCAG 2.2 AA contrast & target sizing, RTL/LTR cognitive load control, progressive disclosure) and `tenant-portal/docs/design/` (`README.md`, `patterns.md`, `states.md`, `anti-patterns.md`):

1. **Visual Density & Typography:** `1440px` shell (`1152px` net workspace width), `44px` standard `DataTable` rows (`36px` opt-in `density="compact"` only on append-only FX rate history and sequence counters), strictly three font weights (`400` body & all table cells, `500` field/tab labels, `600` headers/KPI counts), zero `font-bold`, zero `text-[Npx]`, zero `rounded-xl` or larger.
2. **Outcome Palette Only:** Semantic tokens `brand` (exclusively on the single `PageHeader` primary CTA and focus ring), `positive` (active/synced/acknowledged/unblocked), `caution` (scheduled/blocked-from-future/frozen-slot/interim-policy-pending/read-only), `negative` (credit-hold/inactive-provider/block-rule/conflict/error), and `ink` neutral ramp (`bg-canvas`, `bg-card`, `bg-surface-subtle`, `border-border`). Every status badge pairs an icon + translated `t.status.*` string — never colour alone, and never a raw wire enum.
3. **Bilingual & Bidirectional Fidelity (`ar` RTL / `en` LTR):**
   - Logical CSS properties exclusively (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `text-end`, `border-s`, `border-e`).
   - Zero language ternaries in `.tsx`; all strings resolve from `ar` and `en` dictionaries; `I18nText` (`{ ar, en? }`) renders `nameI18n[locale] ?? nameI18n.ar` via a shared `formatLocalizedName(nameI18n, locale)` helper, and edits through a paired bilingual `<I18nNameFields>` group (`ar` required `1..200`, `en` optional `1..200`, trimmed non-empty per `D-668`).
   - All codes, UUIDs, ISO currency codes, cron expressions, SHA-256 hashes, decimal strings (`numeric(24,8)`), FX rate strings (`numeric(24,12)`), and dates render inside `<IdentifierText>` (`<bdi dir="ltr" className="tabular-nums">`) with Western digits (`ar-EG-u-nu-latn` / `en-US`). **Never call `Number()` on `DecimalString`, `FxRateString`, or `bigint` strings.**
4. **Data Layer, Validation, Idempotency & Concurrency (`data-layer.md`):**
   - Every HTTP call goes through `src/lib/api/axiosClient.ts` against `/api/tenant/accounting/v1/<route>` with runtime response parsers (`parseDimensionType`, `parseFxRate`, `parsePartyFinanceProfile`, etc.) co-located in `hooks/use<SurfaceName>.ts`. Unknown future enum values fall back to a neutral unknown badge rather than throwing.
   - Unsafe writes carry `x-idempotency-key` generated via `generateUUIDv7()` (`src/lib/uuid.ts` — never `crypto.randomUUID()`). Retries of an ambiguous/timed-out intent reuse the exact saved key via `AmbiguousOutcomePanel`.
   - Routes marked `If-Match` send the exact integer `version` / `ETag` captured from `GET /:id` (or list `SummaryDto.version`). On `409 ACCOUNTING.CONCURRENCY.STALE_VERSION` (or `412`), `ConflictDialog` refetches the live server record and displays current vs. local values side-by-side.
   - `x-mutakamel-company-id` is attached from the shell `CompanyContextSwitcher` on all `COMPANY` and `COMPANY_OR_BRANCH` routes (`x-mutakamel-branch-id` added when a branch scope is selected on `COMPANY_OR_BRANCH` routes). `TENANT`-scoped routes (`fx-rate-providers`, `fx-rates/export`) execute without requiring an activated company profile.
5. **300-Line Module Split Architecture (`file-architecture.md`):**
   Each route splits markup (`.tsx` `< 300` lines, zero hooks/handlers) from logic (`hooks/use<Screen>.ts` `< 300` lines):
   - `#91` master-data tabs: `DimensionsTabView.tsx` + `hooks/useDimensionTypes.ts` + `hooks/useDimensionValues.ts`; `JournalsTabView.tsx` + `hooks/useJournals.ts`; `NumberSequencesTabView.tsx` + `hooks/useNumberSequences.ts`.
   - `#92`: `FxRatesWorkspaceView.tsx`, `FxProviderStrip.tsx`, `FxRateResolverDrawer.tsx`, `FxManualRateModal.tsx` + `hooks/useFxProviders.ts`, `hooks/useFxRates.ts`, `hooks/useFxResolver.ts`.
   - `#93` & `#94`: `PartyProfilesListView.tsx` + `hooks/usePartyProfilesList.ts`; `PartyProfileDetailView.tsx`, `PartyCreditOverviewTab.tsx`, `PartyTaxRegimesTab.tsx` + `hooks/usePartyProfileDetail.ts`, `hooks/usePartyTaxRegimes.ts`.
   - `#88` master-data tabs: `ValidationRulesTabView.tsx` + `hooks/useValidationRules.ts`; `AccountingSettingsTabView.tsx`, `LegalInterimPoliciesSection.tsx` + `hooks/useAccountingSettings.ts`, `hooks/useLegalInterimPolicies.ts`.

---

## 1. Surface 1 — Analytical Dimensions, Journals & Number Sequences (`#91`)

### 1.1 Layout & Navigation Placement

- **Canonical Route:** `/accounting/setup/calendars-journals` (`#91` in `accounting-ia.md` §3, Section 7 **Setup -> Accounting Setup**).
- **Admission Gate:** Feature `accounting.ledger.core` AND ANY of `{ accounting.calendar.read, accounting.period.read, accounting.journal.read, accounting.dimension.read }`.
- **Workspace Tab Bar (URL-synced `?tab=`):**
  1. `calendars` (`SCR-03`, `P03.T09.S2`) — visible when `accounting.calendar.read` or `accounting.period.read`.
  2. `dimensions` (**`SCR-04` primary `[P: 21]`**) — visible when `accounting.dimension.read`; hidden otherwise (`accounting-ia.md` §4: missing read permission hides tab; direct `?tab=dimensions` renders `PermissionGate`).
  3. `journals` (**`P03.T09.S3` companion `[7]`**) — visible when `accounting.journal.read`.
  4. `sequences` (**`P03.T09.S3` companion `[2]`, read-only per `CG-10`**) — visible when `accounting.journal.read`.
- **Single Primary Action Rule (`PageHeader` `end` slot, dynamically bound to active tab):**
  - `tab=dimensions`: `+ New Dimension Value` (`+ قيمة بُعد جديدة`) — filled `primary`, visible when `accounting.dimension.create` and at least one live `DimensionType` exists (when zero `DimensionType` rows exist, switches to `+ New Dimension Type` / `+ نوع بُعد جديد`).
  - `tab=journals`: `+ New Journal` (`+ دفتر يومية جديد`) — filled `primary`, visible when `accounting.journal.create`.
  - `tab=sequences`: **No primary button** (`CG-10` strictly read-only; `PageHeader` `end` slot holds only an `outline` `Refresh` button).
- **Dimensions Tab Two-Pane Master-Detail Layout (`1152px` net width):**
  - **Start Pane (`320px` fixed on `lg+`, collapsible selector card below `lg`):** `DimensionTypesRail` listing company `acc_dimension_types` (`MAX_DIMENSIONS_PER_SET = 10`, hot slots `1..4` highlighted with `Slot 1..4` chip and lock icon when frozen by `acc_dimension_sets` usage), with inline `+ Add Type` (`outline` `sm`, gated by `accounting.dimension.create`) and row overflow `Edit` / `Delete` / `Restore`.
  - **End Pane (`flex-1`, `808px` on `lg+`):** `DimensionValuesWorkspace` scoped to the selected `dimensionTypeId` (`DimensionValueListQueryDto.dimensionTypeId` is **required**). Provides a view-mode segmented switch (`Tree` WBS hierarchy when `selectedType.isHierarchical === true` vs `Table` flat paginated grid), `FilterSearchInput` + `AdvancedSearchCard` (`POST /dimension-values/search` + `POST /dimension-values/count`), `BulkActionBar` (`bulk-update`, `bulk-delete`, `bulk-restore`), `Export` (`POST /dimension-values/export` -> `AsyncJobState`), and `Import` (`POST /dimension-values/import`, hidden until `P17.T06` per `CG-18`).

### 1.2 Consumed `@/design-system` & Approved Accounting Patterns

| Pattern / Component | Source | Role on Surface 1 |
| --- | --- | --- |
| `PageHeader`, `Tabs` | `@/design-system` | Route title, active company context pill, URL-synced workspace tabs, single `primary` CTA |
| `DataTable`, `Pagination` | `@/design-system` (`patterns.md`) | `44px` rows (`36px` `compact` on `sequences`), server sort/paging, sticky end actions, checkbox selection |
| `FilterBar`, `FilterSearchInput`, `CrmAdvancedSearchCard` | `@/design-system` | `dimension-values` and `journals` search/filter trees (`FilterGroup` -> `POST /search`, live badge count via `POST /dimension-values/count`) |
| `HierarchyTreeGrid` (COA/WBS tree pattern) | `accounting-patterns-data.md` §1 | Expandable `parentId` / `path` tree view for hierarchical dimensions (`PROJECT` WBS, `DEPARTMENT`), capped at `ACCOUNTING_LIMITS.MAX_DIMENSION_TREE_DEPTH = 10` |
| `AccountRolePicker`, `DimensionValuePicker` | `accounting-patterns-data.md` §4 | Used inside `JournalFormDrawer` (`allowedAccountRoles`, `defaultAccountRoles`) and `DimensionValueFormDrawer` (`parentId` via `POST /dimension-values/lookup`) |
| `FormDrawer`, `EditDrawer` | `@/design-system` | Create (`FormDrawer`) and versioned `If-Match` update (`EditDrawer`) for Dimension Types, Dimension Values, and Journals |
| `BulkActionBar`, `BulkConfirmDialog`, `BulkResultPanel` | `@/design-system` | Multi-row create/update/delete/restore on `dimension-values` (`MAX_BULK_ITEMS = 100`), handling `200` and partial `207` `BulkOperationResultDto` |
| `ConfirmActionModal`, `DeletionBlockerDialog`, `ConflictDialog`, `AmbiguousOutcomePanel` | `@/design-system` | Soft-delete confirmation, `409` active-reference blocker (`acc_dimension_sets` / posted `acc_journal_entries`), `409 STALE_VERSION` diff, timeout idempotency recovery |
| `AsyncJobState` | `@/design-system` & `accounting-patterns-workflow.md` §4 | Tracks `202 Accepted` `POST /dimension-values/export` (and `P17.T06` `/import`) via `Location` job polling |
| `ReadOnlyGate`, `PermissionGate`, `EmptyState`, `ErrorState` | `@/design-system` | Enforces `CG-10` read-only explainers on `number-sequences`, `RECOVERY_MODE` banner, `403` in-body gate, and setup/filter empty states |

### 1.3 Complete DTO & Enum Field Mapping

#### 1.3.1 Dimension Types (`acc_dimension_types` — `02_DTOs.md` §4.5 & §13.1, `01_Enums.md` §2)

| UI Field (`en` / `ar`) | Read DTO (`DimensionTypeSummaryDto` / `DetailDto`) | Write DTO (`CreateDimensionTypeDto` / `UpdateDimensionTypeDto`) | Type / Constraints / Enum | UI Control & Validation Rules |
| --- | --- | --- | --- | --- |
| Code / الرمز | `code` | `code` | `string` (`1..32`, uppercase `^[A-Z0-9_]{1,32}$`) | `<IdentifierText>` mono input; auto-uppercased; immutable display style after creation if sets exist |
| Dimension Category / تصنيف البُعد | `typeCode` *(see `CG-S3-06`)* | `dimensionTypeCode` *(see `CG-S3-06`)* | `DimensionTypeCode`: `COST_CENTER` · `PROJECT` · `DEPARTMENT` · `CUSTOM_1` · `CUSTOM_2` · `CUSTOM_3` · `CUSTOM_4` | Translated `Select` (`مركز تكلفة`, `مشروع`, `إدارة`, `بُعد مخصص ١..٤`) |
| Name (Arabic) / الاسم بالعربية | `nameI18n.ar` | `nameI18n.ar` | `string` (`1..200`, required, trimmed non-empty) | Primary RTL text input |
| Name (English) / الاسم بالإنجليزية | `nameI18n.en` | `nameI18n.en` | `string?` (`1..200`, optional) | Secondary LTR text input |
| Balancing Dimension / بُعد توازن | `isBalancing` | `isBalancing` | `boolean` (default `false`) | `Switch` + helper note: debits must equal credits per value of this dimension inside every journal entry (`D-029`) |
| Hot Reporting Slot / خانة الفهرسة السريعة | `hotSlot` | `hotSlot` | `number \| null` (`@IsInt @Min(1) @Max(4)`) | Optional `Select` (`None`, `Slot 1`..`Slot 4`); unique per company; frozen once any `acc_dimension_sets` row exists (`409 ACCOUNTING.DIMENSION.SLOT_FROZEN`, `D-029`) |
| Required by Default / إلزامي افتراضياً | `isRequiredDefault` | `isRequiredDefault` | `boolean` (default `false`) | `Switch` |
| Hierarchical (WBS/Tree) / هيكلي (شجري) | `isHierarchical` | `isHierarchical` | `boolean` (default `false`) | `Switch`; enables `parentId` picker and Tree view on `DimensionValuesWorkspace` |
| Concurrency Token | `version` (+ `ETag` on `GET /:id`) | `If-Match` header on `PATCH`/`DELETE` | `integer >= 1` | Hidden state managed by `useDimensionTypes` |
| Audit Timestamps | `createdAt`, `updatedAt` | — (server-owned) | `ISO8601` | Read-only metadata footer in `EditDrawer` |

#### 1.3.2 Dimension Values (`acc_dimension_values` — `02_DTOs.md` §4.1, §4.5 & §13.1)

| UI Field (`en` / `ar`) | Read DTO (`SummaryDto` / `DetailDto`) | Write DTO (`CreateDimensionValueDto` / `UpdateDimensionValueDto`) | Type / Constraints | UI Control & Validation Rules |
| --- | --- | --- | --- | --- |
| Dimension Type / نوع البُعد | `dimensionTypeId` | `dimensionTypeId` | `UUID` (required) | Pre-bound to active rail selection; read-only badge in drawer |
| Value Code / رمز القيمة | `code` | `code` | `string` (`1..32`, unique per `(companyId, dimensionTypeId)`) | `<IdentifierText>` mono input |
| Name (`ar` / `en`) | `nameI18n` | `nameI18n` | `I18nText` (`ar` req `1..200`, `en?` `1..200`) | `<I18nNameFields>` |
| Parent Value / القيمة الأب | `parentId` | `parentId` | `UUID?` | `DimensionValuePicker` (`POST /dimension-values/lookup`); rendered only when `selectedType.isHierarchical === true`; max depth `10` (`ACCOUNTING.DIMENSION.DEPTH_EXCEEDED`) |
| Materialized Path / المسار الهيكلي | `path` *(on `DetailDto` only; omitted on `SummaryDto` per §13.1 `text` rule)* | — (server-computed) | `string` (`/`-delimited UUID path) | Breadcrumb trail inside `EditDrawer` |
| Valid From / صالح من | `validFrom` | `validFrom` | `ISODate?` (`YYYY-MM-DD`) | Date picker; `validTo >= validFrom` (`ck_acc_dimension_values_validity`) |
| Valid To / صالح حتى | `validTo` | `validTo` | `ISODate?` (`YYYY-MM-DD`, inclusive) | Date picker; expired values show `caution` `Expired` badge |
| Blocked From / محظور من تاريخ | `blockedFrom` | `blockedFrom` | `ISODate?` (`YYYY-MM-DD`) | Date picker; postings on/after `blockedFrom` reject with `422 ACCOUNTING.DIMENSION.VALUE_BLOCKED` while historical reports remain intact |
| Version | `version` | `If-Match` (or `BulkUpdateItemDto.version` in `PATCH /bulk-update`) | `integer >= 1` | Concurrency guard |

- **List & Lookup Query DTOs:**
  - `DimensionTypeListQueryDto`: `code?: string`, `hotSlot?: 1|2|3|4`, `isRequiredDefault?: boolean`, plus `PaginationQueryDto` (`page`, `limit`, `cursor`, `sort`).
  - `DimensionValueListQueryDto`: `dimensionTypeId: UUID` (**required**), `parentId?: UUID`, `validOn?: ISODate`, `includeBlocked?: boolean`.
  - `LookupQueryDto` (`POST /dimension-values/lookup`): `q?: string` (`max 120`), `ids?: UUID[]` (`max 100`), `limit?: number` (`1..50`, default `20`), `includeInactive?: boolean` -> returns `LookupItemDto[]` (`{ id, code, nameI18n, isActive }`).

#### 1.3.3 Journals & Read-Only Number Sequences (`acc_journals`, `acc_number_sequences` — `02_DTOs.md` §4.1, §4.4 & §13.1, `01_Enums.md` §§2, 5)

| UI Field (`en` / `ar`) | Read DTO (`JournalSummaryDto` / `JournalDetailDto`) | Write DTO (`CreateJournalDto` / `UpdateJournalDto`) | Type / Enum | UI Control & Rules |
| --- | --- | --- | --- | --- |
| Journal Code / رمز الدفتر | `code` | `code` | `string` (`1..16`, `^[A-Z0-9_]{1,16}$`) | `<IdentifierText>` mono input (`GEN`, `SAL`, `PUR`, `BNK`, `CSH`, `FA`, `TAX`, `OPN`, `CL`) |
| Name (`ar` / `en`) | `nameI18n` | `nameI18n` | `I18nText` | `<I18nNameFields>` |
| Journal Kind / نوع الدفتر | `kind` | `kind` | `JournalKind` (12 members): `GENERAL` · `SALES` · `PURCHASE` · `CASH` · `BANK` · `INVENTORY` · `PAYROLL` · `FIXED_ASSET` · `TAX` · `OPENING` · `CLOSING` · `REVALUATION` | Translated `Select` (`دفتر عام`, `مبيعات`, `مشتريات`, `نقدية`, `بنوك`, `مخزون`, `رواتب`, `أصول ثابتة`, `ضرائب`, `افتتاحي`, `إقفال`, `إعادة تقييم`) |
| Fixed Currency / عملة الدفتر | `currencyCode` | `currencyCode` | `CurrencyCode?` (`char(3)`) | Optional currency picker (`BANK`/`CASH` single-currency journals); `null` = multi-currency |
| Allowed Account Roles / أدوار الحسابات المسموحة | `allowedAccountRoles` | `allowedAccountRoles` | `AccountRole[]` (default `[]` = all roles allowed) | Multi-select `AccountRole` chips (42 members from `01_Enums.md` §2) |
| Default Account Roles / الحسابات الافتراضية | `defaultAccountRoles` *(`DetailDto` only — `jsonb`)* | `defaultAccountRoles` | `Partial<Record<'DEBIT' \| 'CREDIT', AccountRole>>` | Two optional `AccountRole` pickers (`Default Debit Role`, `Default Credit Role`) |
| Entry Sequence Policy / سياسة ترقيم القيود | `sequencePolicy` *(`DetailDto` only — `jsonb`)* | `sequencePolicy` | `SequencePolicyInput`: `{ prefixPattern: string (1..24), padding: int (3..12), resetScope: SequenceResetScope ('FISCAL_YEAR' \| 'NEVER'), startAt?: int >= 1 }` | Structured policy group + live preview chip (e.g. `<bdi>GEN-2026-000001</bdi>`); **frozen after first posted entry** (`trg_acc_journals_sequence_policy_frozen` -> `409 ACCOUNTING.JOURNAL.SEQUENCE_FROZEN`) |
| Dedicated Payment Counter / عداد مستقل للمدفوعات | `noteSequences` *(`DetailDto` only — `jsonb`)* | `noteSequences` | `Partial<Record<'PAYMENT', SequencePolicyInput>>` | Optional toggle + `SequencePolicyInput` for `CASH`/`BANK` journals only (`CREDIT_NOTE` / `DEBIT_NOTE` keys forbidden per `D-759`, governed by `numbering.*_series` settings) |
| Inbound Email Alias / بريد الاستلام | `emailAlias` | `emailAlias` | `string?` (`max 64` in DTO) | Optional `<IdentifierText>` input (`ap-bills@tenant...`) |
| Hash Chain / سلسلة التجزئة | `hashChainEnabled` | — (always `true`, `ck_acc_journals_hash_chain_mandatory`) | `boolean` (`true`) | Read-only `positive` lock badge (`Mandatory SHA-256 Chain` / `سلسلة تدقيق إلزامية`) — never a toggle |
| Active Status / الحالة | `isActive` | `isActive?` (`UpdateJournalDto`, `D-770`) | `boolean` | `StatusBadge` (`Active` / `Inactive`) |

- **Read-Only Number Sequences (`NumberSequenceSummaryDto` / `NumberSequenceDetailDto` — `CG-10`):**
  - Columns from `acc_number_sequences`: `id`, `journalId` (nullable — `NULL` for company-wide & statutory document series), `branchId` (nullable — non-null when branch legal series setting resolves), `fiscalYearId` (nullable — `NULL` when `resetScope = NEVER`), `periodKey` (`varchar(16)` nullable), `connectionId` (nullable — POS offline range), `sequenceKind` (`SequenceKind` — 27 members: `ENTRY`, `SALES_INVOICE`, `PURCHASE_BILL`, `CREDIT_NOTE`, `DEBIT_NOTE`, `EXPORT_INVOICE`, `SELF_INVOICE`, `PREPAYMENT_INVOICE`, `PAYMENT`, `RECEIPT`, `WITHHOLDING_CERTIFICATE`, `DUNNING_LETTER`, `ASSET`, `CLOSE_RUN`, `TAX_RETURN_RUN`, `NETTING_PROPOSAL`, `CONSOLIDATION_RUN`, `STATUTORY_DOCUMENT`, `PAYMENT_RUN`, `CHEQUE_REGISTER`, `DIRECT_DEBIT_MANDATE`, `DIRECT_DEBIT_COLLECTION`, `WRITE_OFF`, `PROVISION_RUN`, `REVALUATION_RUN`, `DEPRECIATION_RUN`, `YEAR_END_CLOSE`), `prefix` (`varchar(32)`), `lastAssignedAt` (`ISO8601 | null`), `version`.
  - Query filters (`NumberSequenceListQueryDto`): `journalId?: UUID`, `fiscalYearId?: UUID`, `sequenceKind?: SequenceKind`.
  - **Mandatory `CG-10` Read-Only Callout:** Persistent `ReadOnlyGate` banner at top of `sequences` tab stating in `ar`/`en` that gapless counters advance exclusively inside posting/issuance transactions (`D-026`, `D-758`); `nextValue` is withheld from `NumberSequenceSummaryDto` and `NumberSequenceDetailDto` (`D-770`), so the screen never shows a figure that could be mistaken for a reserved number.

### 1.4 Action & Endpoint Mapping (`30` Routes — Verbatim from `02_Endpoint_Catalogue.md` §3)

| UI Action | Method | Catalogue Path (Browser: `/api/tenant/accounting/v1...`) | Permission | Feature Key | Scope | Idempotency | Concurrency | Success |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Load dimension types rail | `GET` | `/accounting/dimension-types` | `accounting.dimension.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` |
| Open dimension type edit drawer | `GET` | `/accounting/dimension-types/:id` | `accounting.dimension.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` + `ETag` |
| Create dimension type | `POST` | `/accounting/dimension-types` | `accounting.dimension.create` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `none` | `201` + `Location` |
| Save dimension type edits | `PATCH` | `/accounting/dimension-types/:id` | `accounting.dimension.update` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| Soft-delete dimension type | `DELETE` | `/accounting/dimension-types/:id` | `accounting.dimension.delete` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `204` |
| Restore deleted dimension type | `POST` | `/accounting/dimension-types/:id/restore` | `accounting.dimension.restore` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `none` | `200` |
| List dimension values (table/tree) | `GET` | `/accounting/dimension-values` | `accounting.dimension.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` |
| Run advanced filter search | `POST` | `/accounting/dimension-values/search` | `accounting.dimension.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` |
| Count matching dimension values | `POST` | `/accounting/dimension-values/count` | `accounting.dimension.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` |
| Parent value combobox lookup | `POST` | `/accounting/dimension-values/lookup` | `accounting.dimension.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` |
| Inspect dimension value detail | `GET` | `/accounting/dimension-values/:id` | `accounting.dimension.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` + `ETag` |
| Create single dimension value | `POST` | `/accounting/dimension-values` | `accounting.dimension.create` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `none` | `201` + `Location` |
| Bulk-create values (paste/grid) | `POST` | `/accounting/dimension-values/bulk` | `accounting.dimension.create` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `none` | `200/207` |
| Update single dimension value | `PATCH` | `/accounting/dimension-values/:id` | `accounting.dimension.update` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| Bulk-update values (block/dates) | `PATCH` | `/accounting/dimension-values/bulk-update` | `accounting.dimension.update` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `none` | `200/207` |
| Soft-delete single value | `DELETE` | `/accounting/dimension-values/:id` | `accounting.dimension.delete` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `204` |
| Bulk soft-delete values | `POST` | `/accounting/dimension-values/bulk-delete` | `accounting.dimension.delete` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `none` | `200/207` |
| Restore single deleted value | `POST` | `/accounting/dimension-values/:id/restore` | `accounting.dimension.restore` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `none` | `200` |
| Bulk restore deleted values | `POST` | `/accounting/dimension-values/bulk-restore` | `accounting.dimension.restore` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `none` | `200/207` |
| Async import dimension values *(sealed until `P17.T06`, `CG-18`)* | `POST` | `/accounting/dimension-values/import` | `accounting.dimension.create` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key (7 d)` | `none` | `202` + `Location` |
| Async export dimension values | `POST` | `/accounting/dimension-values/export` | `accounting.dimension.read` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `none` | `202` + `Location` |
| List company journals | `GET` | `/accounting/journals` | `accounting.journal.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` |
| Search company journals | `POST` | `/accounting/journals/search` | `accounting.journal.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` |
| Open journal detail / edit drawer | `GET` | `/accounting/journals/:id` | `accounting.journal.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` + `ETag` |
| Create journal | `POST` | `/accounting/journals` | `accounting.journal.create` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `none` | `201` + `Location` |
| Update journal | `PATCH` | `/accounting/journals/:id` | `accounting.journal.update` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| Soft-delete unused journal | `DELETE` | `/accounting/journals/:id` | `accounting.journal.delete` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `204` |
| Restore soft-deleted journal | `POST` | `/accounting/journals/:id/restore` | `accounting.journal.restore` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `none` | `200` |
| List number sequence counters | `GET` | `/accounting/number-sequences` | `accounting.journal.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` |
| Open counter detail modal | `GET` | `/accounting/number-sequences/:id` | `accounting.journal.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` + `ETag` |

### 1.5 Complete UI States (`states.md` 11-State Contract + Accounting Boundaries)

1. **Loading:** Start rail renders 4 `Skeleton` cards (`56px` height); End pane renders `DataTableSkeleton` matching column widths (`Code`, `Name`, `Hierarchy/Parent`, `Validity`, `Status`, `Actions`). Never flashes `EmptyState`.
2. **Empty (No Dimension Types / No Values / No Sequence Rows Yet):**
   - Zero `dimension-types`: `EmptyState` explaining that activation seeds standard dimensions when defined by the pack, with `+ New Dimension Type` CTA (`accounting.dimension.create`).
   - Selected `DimensionType` has zero values: `EmptyState` titled *"No values in Cost Center yet / لا توجد قيم في مركز التكلفة بعد"* with `+ New Dimension Value`.
   - `sequences` tab before first posting/issuance: `EmptyState` explaining that counters materialize lazily on the first posted entry or issued fiscal document (`INSERT … ON CONFLICT` at assignment time, `01_Foundation_Tables.md` §11).
   - Filtered empty: *"No matching results / لا توجد نتائج مطابقة"* + `Clear filters` (`outline`).
3. **Error + Retry:** `ErrorState` replaces empty state inside `DataTable` / rail (`Promise.allSettled` keeps `journals` or `dimension-types` usable if a secondary `count` call fails, surfacing `DegradedBanner`). Domain errors map through `useAccountingErrorModel`:
   - `409 ACCOUNTING.DIMENSION.SLOT_FROZEN`: *"Hot slot cannot be changed after dimension sets have been recorded / لا يمكن تعديل خانة الفهرسة السريعة بعد استخدام الأبعاد في القيود"*.
   - `422 ACCOUNTING.DIMENSION.DEPTH_EXCEEDED`: *"Maximum hierarchy depth (10 levels) reached / تم بلوغ الحد الأقصى لعمق الشجرة (10 مستويات)"*.
   - `409 ACCOUNTING.JOURNAL.SEQUENCE_FROZEN`: *"Entry numbering policy is locked because entries have already been posted to this journal / سياسة ترقيم القيود مقفلة لوجود قيود مرحلة في هذا الدفتر"*.
4. **`403` Forbidden:** `PermissionGate` in-body explaining required permission (`accounting.dimension.read` or `accounting.journal.read`) and active Company scope — never rendered as `EmptyState`.
5. **Entitlement & Activation Boundaries:**
   - Missing `accounting.ledger.core` (`403 ACCOUNTING.FEATURE.NOT_ENTITLED`): full-page `NotEntitledBoundary` (`accounting-patterns-documents.md` §3).
   - Company not yet activated (`409`/`404` company profile): `CompanyNotActivatedBoundary` linking to `/accounting/setup/company`.
   - `503 ACCOUNTING.TENANT.RECOVERY_MODE`: `ReadOnlyGate` banner across `#91` disabling all write/bulk/export triggers while keeping `GET` inspection open.
6. **Conflict (`409 STALE_VERSION`), Deletion Blocker (`409` referenced in `acc_dimension_sets` / `acc_journal_entries`), Partial Bulk (`207` `BulkResultPanel`), and Ambiguous Timeout (`504 CLIENT_REQUEST_TIMEOUT` -> `AmbiguousOutcomePanel`):** All wired per `patterns.md`.

### 1.6 Four-Combination ASCII Mockups (`#91` Dimensions, Journals & Sequences)

#### 1.6.1 Arabic RTL — Light (`dir="rtl"`, `--bg-canvas: #F8FAFC`, `--bg-card: #FFFFFF`)

```text
+------------------------------------------------------------------------------------------------------------------+
| [شركة النيل للتجارة ش.م.م (EGP) v]                      الإعدادات > إعدادات المحاسبة > التقويم والدفاتر والأبعاد |
| التقويم والدفاتر والأبعاد                                                           [+ قيمة بُعد جديدة (Primary)] |
| [ التقويم والفترات ]  [ الأبعاد التحليلية (نشط) ]  [ دفاتر اليومية (9) ]  [ تسلسلات الترقيم (للقراءة فقط) ]      |
+-------------------------------------------------------------------+----------------------------------------------+
| قيم البُعد: مركز التكلفة (COST_CENTER)     [شجري | جدول] [تصدير]  | أنواع الأبعاد (3 / 10)          [+ نوع بُعد] |
| [بحث: الرمز أو الاسم...                 ] [تصفية متقدمة] (١٤ قيمة)| -------------------------------------------- |
| ----------------------------------------------------------------- | * [COST_CENTER] مركز التكلفة                 |
| [ ] الإجراءات | الحالة      | الصلاحية            | الاسم  | الرمز |   [خانة سريعة #1 - مقفلة] [إلزامي افتراضياً] |
| ----------------------------------------------------------------- | -------------------------------------------- |
| [ ] [...]     | [نشط ●]     | مفتوح - 2026-01-01 | الإدارة| CC-10 |   [PROJECT] المشروعات (هيكلي WBS)            |
| [ ] [...]     | [نشط ●]     | مفتوح - 2026-01-01 | مبيعات | CC-20 |   [خانة سريعة #2 - مقفلة] [متوازن]           |
| [ ] [...]     | [محظور ▲]   | محظور من 2026-10-01| قديم   | CC-99 | -------------------------------------------- |
| ----------------------------------------------------------------- |   [DEPARTMENT] الإدارات (هيكلي)              |
| صفحة 1 من 1 (14 سجلاً)                          [< السابق] [التالي >] |   [بدون خانة سريعة]                          |
+-------------------------------------------------------------------+----------------------------------------------+
```

#### 1.6.2 Arabic RTL — Dark (`dir="rtl"`, `--bg-canvas: #090D16`, `--bg-card: #111827` — `tab=journals` + `sequences` callout)

```text
+------------------------------------------------------------------------------------------------------------------+
| [وضع داكن ☾] [شركة النيل للتجارة ش.م.م (EGP) v]         الإعدادات > إعدادات المحاسبة > التقويم والدفاتر والأبعاد |
| التقويم والفترات والأبعاد                                                            [+ دفتر يومية جديد (Primary)] |
| [ التقويم والفترات ]  [ الأبعاد التحليلية ]  [ دفاتر اليومية (نشط) ]  [ تسلسلات الترقيم (للقراءة فقط) ]          |
+------------------------------------------------------------------------------------------------------------------+
| [بحث في الدفاتر...] [النوع: الكل v] [العملة: الكل v]                                        إجمالي الدفاتر: 9   |
| ---------------------------------------------------------------------------------------------------------------- |
| الإجراءات | سلسلة التدقيق | حالة السياسة | نمط الترقيم              | العملة | النوع       | الاسم          | الرمز|
| ---------------------------------------------------------------------------------------------------------------- |
| [...]     | [مفعّلة 🔒]   | [مقفلة ▲]    | GEN-{YYYY}-000001 (سنوي) | متعدد  | دفتر عام    | اليومية العامة | GEN  |
| [...]     | [مفعّلة 🔒]   | [مقفلة ▲]    | BNK-{YYYY}-000001 (+دفع) | EGP    | بنوك        | بنك مصر جاري   | BNK1 |
| [...]     | [مفعّلة 🔒]   | [قابلة للتعديل]| FA-{YYYY}-000001 (سنوي) | متعدد  | أصول ثابتة  | يومية الأصول   | FA   |
+------------------------------------------------------------------------------------------------------------------+
```

#### 1.6.3 English LTR — Light (`dir="ltr"`, `--bg-canvas: #F8FAFC`, `--bg-card: #FFFFFF`)

```text
+------------------------------------------------------------------------------------------------------------------+
| Setup > Accounting Setup > Calendars, Journals & Dimensions               [Nile Trading Co. SAE (EGP) v]         |
| Calendars, Journals & Dimensions                                              [+ New Dimension Value (Primary)]  |
| [ Calendars & Periods ]  [ Analytical Dimensions (Active) ]  [ Journals (9) ]  [ Number Sequences (Read-Only) ]  |
+----------------------------------------------+-------------------------------------------------------------------+
| Dimension Types (3 / 10)        [+ Add Type] | Values: Projects (PROJECT)          [Tree | Table] [Export CSV]   |
| -------------------------------------------- | [Search code or name...           ] [Advanced Filter] (8 values)  |
|   [COST_CENTER] Cost Center                  | ----------------------------------------------------------------- |
|   [Hot Slot #1 - Frozen] [Required Default]  | [ ] Code       | Name (WBS Tree)     | Validity         | Status  |
| -------------------------------------------- | ----------------------------------------------------------------- |
| * [PROJECT] Projects (Hierarchical)          | [ ] PRJ-100    | v Cairo Metro Ph-1  | 2026-01-01..Open | [● Act] |
|   [Hot Slot #2 - Frozen] [Balancing]         | [ ]   PRJ-110  |   +-- Civil Works   | 2026-01-01..Open | [● Act] |
| -------------------------------------------- | [ ]   PRJ-120  |   +-- Signalling    | Blocked 2026-11  | [▲ Blk] |
|   [DEPARTMENT] Departments (Hierarchical)    | ----------------------------------------------------------------- |
|   [No Hot Slot]                              | Showing 1-3 of 8                             [< Prev]  [Next >]   |
+----------------------------------------------+-------------------------------------------------------------------+
```

#### 1.6.4 English LTR — Dark (`dir="ltr"`, `--bg-canvas: #090D16`, `--bg-card: #111827` — `tab=sequences` `CG-10` Read-Only)

```text
+------------------------------------------------------------------------------------------------------------------+
| Setup > Accounting Setup > Calendars, Journals & Dimensions        [☾ Dark] [Nile Trading Co. SAE (EGP) v]       |
| Calendars, Journals & Dimensions                                                               [Refresh (Outline)]|
| [ Calendars & Periods ]  [ Analytical Dimensions ]  [ Journals (9) ]  [ Number Sequences (Active - Read-Only) ]  |
+------------------------------------------------------------------------------------------------------------------+
| [i] Gapless counters are strictly read-only (D-026). Numbers are assigned atomically inside posting/issuance     |
|     transactions; "Next Value" is observational telemetry and never reserves a sequence number.                  |
+------------------------------------------------------------------------------------------------------------------+
| [Journal: All v] [Fiscal Year: FY2026 v] [Sequence Kind: All (27) v]                                             |
| ---------------------------------------------------------------------------------------------------------------- |
| Sequence Kind      | Journal | Branch | Fiscal Year | Prefix      | Next Value | Last Assigned (Cairo) | Inspect |
| ---------------------------------------------------------------------------------------------------------------- |
| Journal Entry      | GEN     | —      | FY2026      | GEN-2026-   |        149 | 2026-11-01 14:22:09   | [View]  |
| Sales Invoice      | —       | CAI-01 | FY2026      | SIN-2026-   |      1,042 | 2026-11-01 16:05:41   | [View]  |
| Payment Voucher    | BNK1    | —      | FY2026      | PAY-2026-   |         88 | 2026-10-31 11:10:00   | [View]  |
+------------------------------------------------------------------------------------------------------------------+
```

- **Mobile (`375px`) Responsive Rules:** `Tabs` scrolls horizontally with snap indicators; `DimensionTypesRail` collapses into a full-width top `Select` selector (`Active Dimension: COST_CENTER (Slot #1)`) with a secondary `Manage Types` sheet trigger; `DataTable` scrolls horizontally inside its own bordered container without causing document-level overflow (`patterns.md` line 195).

---

## 2. Surface 2 — FX Rate Providers & Dated Exchange Rates (`#92`)

### 2.1 Layout & Navigation Placement

- **Canonical Route:** `/accounting/setup/fx-rates` (`#92` in `accounting-ia.md` §3, Section 7 **Setup -> Accounting Setup**).
- **Admission Gate:** Feature `accounting.ledger.core` AND permission `accounting.fx_rate.read` (resolved at `TENANT` or `OPERATING_CONTEXT` per `01_Context_Headers_and_Responses.md` §3).
- **Three-Zone Vertical Workspace (`1152px` net width):**
  1. **PageHeader + Adopted Chain Banner:**
     - Single `primary` CTA in `PageHeader` `end` slot: `+ Add Manual Rate` (`+ إضافة سعر صرف يدوي`), visible when `accounting.fx_rate.create` holds on the selected `COMPANY` (disabled with tooltip if no activated company is selected in `CompanyContextSwitcher`).
     - Secondary header actions (`outline`): `Test Rate Resolution` (`اختبار احتساب السعر`, opens `FxRateResolverDrawer` when `accounting.fx_rate.resolve` holds on `COMPANY_OR_BRANCH`) and `Export Rates` (`تصدير الأسعار`, `POST /fx-rates/export` when `accounting.fx_rate.read` holds at `TENANT`). (`Import Rates` remains hidden until `P17.T06` per `CG-18`.)
     - **Context Strip:** Displays the selected company's functional currency (`EGP`, frozen after first posting `D-007`) and its pack-adopted provider chain (`CBE -> MANUAL`, `D-718`, `D-756`), explaining clearly that on any date where both exist, the tenant-wide chain head (`CBE`) takes precedence over a company `MANUAL` fallback row (`01_Foundation_Tables.md` §8).
  2. **Collapsible Tenant Provider Strip (`FxProviderStrip` — `GET /accounting/fx-rate-providers`, `TENANT` scope):**
     - Compact horizontal strip of the 6 seeded providers (`CBE`, `SAMA`, `CBUAE`, `CBK`, `ECB`, `MANUAL`) showing `code`, `countryCode`, `baseCurrency`, `schedule` cron (`null` on `MANUAL`), `lastRunAt`, and `isActive` `StatusBadge`.
     - Operators holding `accounting.fx_rate.create` at **`TENANT`** scope see an `outline` `Configure` button on each card opening `FxProviderEditDrawer` (`PATCH /accounting/fx-rate-providers/:code` with `If-Match`). Company-only operators see the strip read-only (`ReadOnlyGate` inline hint).
  3. **Append-Only Dated FX Rate Grid (`FxRatesTable` — `GET /accounting/fx-rates` / `POST /accounting/fx-rates/search`, `OPERATING_CONTEXT`):**
     - Toolbar pair bar: `From Currency` (`CurrencyPicker`, required on `GET /fx-rates`, defaults to first recent foreign currency or `USD` when functional currency is `EGP`; see `CG-S3-05`), `Swap Pair` (`⇄` icon button), `To Currency` (defaults to company `functionalCurrencyCode` when `companyId` is active), `Rate Type` (`ALL` | `SPOT` | `AVERAGE` | `CLOSING` | `BUDGET`), `Provider` (`ALL` | `CBE`..`MANUAL`), and `Date Range` (`fromDate`..`toDate`), plus `Advanced Search` (`POST /fx-rates/search`).
     - **Append-Only Rule (`D-008`, `trg_acc_fx_rates_append_only`):** Zero `Edit` or `Delete` row actions exist. Instead, a `MANUAL` row offers `Post New Revision` (`إصدار مراجعة مصححة`), which opens `FxManualRateModal` pre-filled with `(fromCurrencyCode, toCurrencyCode, rateType, effectiveFrom)` and requires `sourceRef` + `supersededReason` (`POST /accounting/fx-rates` -> `201` with incremented `revision`). Clicking any row opens `FxRateInspectDrawer` (`GET /accounting/fx-rates/:id`) showing full provenance (`sourceRef`, `revision`, `supersededReason`, `createdBy` vs `Worker Sync`).

### 2.2 Consumed `@/design-system` & Approved Accounting Patterns

| Pattern / Component | Source | Role on Surface 2 |
| --- | --- | --- |
| `PageHeader`, `DegradedBanner`, `ReadOnlyGate` | `@/design-system` | Header actions, adopted-chain precedence explainer, `TENANT`-scope read-only notice on provider cards |
| `DataTable` (`density="compact"`), `Pagination` | `@/design-system` | High-density `36px` append-only rate ledger with `tabular-nums` 12-decimal `FxRateCell` |
| `FxRateCell` & `CurrencyPicker` | `accounting-patterns-data.md` §§2, 4 | Renders `numeric(24,12)` `FxRateString` without float conversion (`1 USD = 49.250000000000 EGP`, trailing-zero subtle dimming while keeping full copyable precision) |
| `FormModal` (`FxManualRateModal`), `EditDrawer` (`FxProviderEditDrawer`) | `@/design-system` | Append-only manual rate creation (`POST /fx-rates`) and versioned provider schedule/active update (`PATCH /fx-rate-providers/:code`) |
| `FxRateResolverDrawer` (`Sheet`) | `accounting-patterns-data.md` + `03_Interfaces_and_Value_Objects.md` §5 | Interactive diagnostic calculator calling `POST /fx-rates/resolve` (`Idempotency: none`) and visualizing direct pin vs 2-leg functional-currency triangulation (`FxPin.legs`) |
| `AsyncJobState`, `ConflictDialog`, `AmbiguousOutcomePanel`, `PermissionGate` | `@/design-system` | `202` export job progress, `409` provider version conflict, timeout recovery, `403` state |

### 2.3 Complete DTO & Enum Field Mapping

#### 2.3.1 FX Rate Providers (`acc_fx_rate_providers` — `02_DTOs.md` §4.6 & §13.1, `01_Enums.md` §8)

| UI Field (`en` / `ar`) | Read DTO (`FxRateProviderSummaryDto` / `DetailDto`) | Write DTO (`UpdateFxRateProviderDto`) | Type / Enum | UI Control & Rules |
| --- | --- | --- | --- | --- |
| Provider Code / رمز المزود | `code` | `:code` path param | `FxRateProvider`: `CBE` · `SAMA` · `CBUAE` · `CBK` · `ECB` · `MANUAL` | `<IdentifierText>` + localized name (`البنك المركزي المصري`, `البنك المركزي السعودي`, `مصرف الإمارات المركزي`, `بنك الكويت المركزي`, `البنك المركزي الأوروبي`, `إدخال يدوي موثق`) |
| Country / الدولة | `countryCode` | — | `CountryCode \| null` (`null` on `ECB`, `MANUAL`) | Read-only ISO badge |
| Quote Base / عملة الأساس | `baseCurrency` | — | `CurrencyCode` (`EGP` for `CBE`) | Read-only `<IdentifierText>` |
| Sync Cron Schedule / جدول المزامنة | `schedule` | `schedule` | `string \| null` (`max 64`) | Cron `<IdentifierText>` input; **read-only `null` on `MANUAL`** (`ck_acc_fx_rate_providers_manual_no_schedule`) |
| Last Successful Sync / آخر مزامنة ناجحة | `lastRunAt` | — | `ISO8601 \| null` | Formatted in company/user timezone + relative staleness indicator |
| Active / نشط | `isActive` | `isActive` | `boolean` | `Switch` inside `FxProviderEditDrawer` |
| Version | `version` | `If-Match` header | `integer >= 1` | Optimistic concurrency token |

#### 2.3.2 Dated FX Rates & Rate Resolver (`acc_fx_rates`, `FxPin` — `02_DTOs.md` §4.1, §4.6 & §13.1, `03_Interfaces_and_Value_Objects.md` §5)

| UI Field (`en` / `ar`) | Read DTO (`FxRateSummaryDto` / `FxRateDetailDto`) | Write / Query DTO (`FxRateRowInput` / `ResolveFxRateDto` / `FxPinDto`) | Type / Enum | UI Control & Rules |
| --- | --- | --- | --- | --- |
| Scope / النطاق | `companyId` (`null` = tenant-wide sync; `UUID` = company `MANUAL`) | `x-mutakamel-company-id` header | `UUID \| null` | Badge: `Central Bank (Tenant)` vs `Company Manual` |
| Provider / المصدر | `providerCode` | Server-derived `'MANUAL'` on `POST /fx-rates` (`D-756`) | `FxRateProvider` | Read-only `MANUAL` badge inside `FxManualRateModal` (tenants never write provider rows) |
| From Currency / من عملة | `fromCurrency` *(see `CG-S3-04`)* | `fromCurrencyCode` (`FxRateRowInput`, `FxRateListQueryDto`, `ResolveFxRateDto`, `FxPinDto`) | `CurrencyCode` (`char(3)`) | `CurrencyPicker`; must differ from `toCurrencyCode` (`ck_acc_fx_rates_distinct_currencies`) |
| To Currency / إلى عملة | `toCurrency` *(see `CG-S3-04`)* | `toCurrencyCode` | `CurrencyCode` (`char(3)`) | `CurrencyPicker` (defaults to functional currency) |
| Rate Type / نوع السعر | `rateType` | `rateType` | `FxRateType`: `SPOT` · `AVERAGE` · `CLOSING` · `BUDGET` | Translated `Select` (`فوري للمعاملات`, `متوسط للتقارير`, `إقفال لإعادة التقييم`, `موازنة`) |
| Effective Date / تاريخ السريان | `effectiveFrom` | `effectiveFrom` (write/pin) / `transactionDate` (`ResolveFxRateDto`) | `ISODate` (`YYYY-MM-DD`) | Date picker in company timezone |
| Revision / رقم المراجعة | `revision` | — (server-incremented `>= 1`; `number \| null` on `FxPinDto`) | `integer` | `<IdentifierText>` chip (`Rev 1`, `Rev 2`) |
| Exchange Rate / سعر الصرف | `rate` | `rate` (write) / `rateValue` (`FxPinDto`, `FxPinLeg`) | `FxRateString` (`numeric(24,12)`, `> 0`) | `<FxRateCell>` / decimal string input (`^(?:0\|[1-9]\d{0,11})(?:\.\d{1,12})?$`); never parsed as `number` |
| Proof Reference / مرجع الإثبات | `sourceRef` *(`varchar(256)` — omitted on `SummaryDto` per §13.1 `>255` rule, shown on `DetailDto`!)* | `sourceRef` (`1..256`, required on `POST /fx-rates`) | `string` | Required input in `FxManualRateModal` (bulletin number, bank slip ref, or attachment ID) |
| Pegged Pair / زوج مربوط | `pegged` | `pegged` (optional on write; boolean on `FxPinDto`) | `boolean` | Badge (`Pegged` / `سعر ربط ثابت` for `SAR`/`AED` vs `USD`) |
| Revision Reason / سبب التصحيح | `supersededReason` | `supersededReason?` (`CreateFxRateDto`, required from revision `2`, `D-771`) | `string \| null` (`max 255`) | Shown when `revision > 1` |
| Triangulation Legs / مسار التثليث | — | `FxPinDto.legs: FxPinLeg[] \| null` | `FxPinLeg[]` (2 legs when `rateId === null`: `from -> functional`, `functional -> to`) | Rendered as a 2-step formula breakdown card inside `FxRateResolverDrawer` |

### 2.4 Action & Endpoint Mapping (`9` Routes — Verbatim from `02_Endpoint_Catalogue.md` §3)

| UI Action | Method | Catalogue Path (Browser: `/api/tenant/accounting/v1...`) | Permission | Feature Key | Scope | Idempotency | Concurrency | Success |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Load provider strip | `GET` | `/accounting/fx-rate-providers` | `accounting.fx_rate.read` | `accounting.ledger.core` | `TENANT` | `none` | `none` | `200` |
| Update provider schedule / active state | `PATCH` | `/accounting/fx-rate-providers/:code` | `accounting.fx_rate.create` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | `If-Match` | `200` |
| List dated rates for currency pair | `GET` | `/accounting/fx-rates` | `accounting.fx_rate.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | `none` | `none` | `200` |
| Search dated rates (`FilterGroup`) | `POST` | `/accounting/fx-rates/search` | `accounting.fx_rate.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | `none` | `none` | `200` |
| Inspect rate row provenance (`sourceRef`) | `GET` | `/accounting/fx-rates/:id` | `accounting.fx_rate.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | `none` | `none` | `200` |
| Test / preview rate pin resolution | `POST` | `/accounting/fx-rates/resolve` | `accounting.fx_rate.resolve` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | `none` | `none` | `200` |
| Record manual rate / new revision | `POST` | `/accounting/fx-rates` | `accounting.fx_rate.create` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `none` | `201` |
| Async import manual rates *(sealed until `P17.T06`, `CG-18`)* | `POST` | `/accounting/fx-rates/import` | `accounting.fx_rate.import` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key (7 d)` | `none` | `202` + `Location` |
| Async export FX rate history | `POST` | `/accounting/fx-rates/export` | `accounting.fx_rate.read` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | `none` | `202` + `Location` |

### 2.5 Complete UI States (`states.md` + FX Domain Boundaries)

1. **Loading:** 6 compact `Skeleton` provider tiles (`68px` height) + `DataTableSkeleton` (`compact` `36px` rows).
2. **Empty States:**
   - No pair chosen yet (when `companyId` absent at `TENANT` operating context): prompt card guiding user to select `From` and `To` currencies (or run `Advanced Search`).
   - Selected pair has zero rows: `EmptyState` explaining whether the active provider sync (`CBE`) has not yet published that currency or offering `+ Add Manual Rate` (`accounting.fx_rate.create` on `COMPANY`).
3. **Error + Retry & Resolver Domain Errors:**
   - `422 ACCOUNTING.FX.RATE_MISSING` inside `FxRateResolverDrawer`: renders structured `caution` diagnostic card naming the missing leg (`e.g. EUR -> EGP on or before 2026-11-01 in chain CBE -> MANUAL`) and a one-click `Add Manual Fallback Rate` button pre-filling `FxManualRateModal`.
   - Same-date `MANUAL` vs `CBE` precedence warning: when user enters a `MANUAL` rate for a date that already holds a `CBE` row for that pair/type, `FxManualRateModal` displays an inline `caution` alert that `CBE` remains authoritative on that date (`idx_acc_fx_rates_lookup` orders `(company_id IS NULL) DESC`).
4. **`403` Forbidden & Scope Distinctions:**
   - Actor lacks `accounting.fx_rate.read` everywhere -> `PermissionGate`.
   - Actor holds `accounting.fx_rate.read` & `accounting.fx_rate.create` on `COMPANY` only (not `TENANT`) -> `GET /fx-rate-providers` returns `403` if ungranted at `TENANT`: handled via `Promise.allSettled` so `FxProviderStrip` collapses into a compact read-only chain badge from company context instead of failing the `#92` screen! Similarly, `Export` (`TENANT` scope) is hidden unless `accounting.fx_rate.read` is held at `TENANT`.
5. **Entitlement & `RECOVERY_MODE`:** Missing `accounting.ledger.core` -> `NotEntitledBoundary`; `503 ACCOUNTING.TENANT.RECOVERY_MODE` -> `ReadOnlyGate` keeps `GET` and `POST /fx-rates/resolve` (`read-like`, `Idempotency: none`) available while disabling `PATCH /fx-rate-providers/:code`, `POST /fx-rates`, and `POST /fx-rates/export`.

### 2.6 Four-Combination ASCII Mockups (`#92` FX Providers & Exchange Rates)

#### 2.6.1 Arabic RTL — Light (`dir="rtl"`, `--bg-canvas: #F8FAFC`, `--bg-card: #FFFFFF`)

```text
+------------------------------------------------------------------------------------------------------------------+
| [شركة النيل للتجارة ش.م.م | عملة الدفاتر: EGP (مقفلة) v]                 الإعدادات > إعدادات المحاسبة > أسعار الصرف |
| أسعار الصرف ومزودو النشرات               [تصدير CSV] [اختبار احتساب السعر] [+ إضافة سعر صرف يدوي (Primary)]       |
| [i] سلسلة الاعتماد النشطة للشركة (حزمة EG v1): البنك المركزي المصري (CBE - متوسط MID) ثم اليدوي الموثق (MANUAL).   |
+------------------------------------------------------------------------------------------------------------------+
| مزودو الأسعار على مستوى المستأجر (6)                                                       [طي الشريط ^]         |
| +--------------------------+ +--------------------------+ +--------------------------+ +-----------------------+ |
| | [● نشط] CBE (مصر - EGP)  | | [● نشط] SAMA (السعودية)  | | [● نشط] ECB (أوروبا-EUR) | | [● نشط] MANUAL (يدوي) | |
| | الجدول: 0 16 * * 0-4     | | الجدول: 0 15 * * 0-4     | | الجدول: 0 16 * * 1-5     | | بدون مزامنة آلية      | |
| | آخر مزامنة: 2026-11-01   | | آخر مزامنة: 2026-11-01   | | آخر مزامنة: 2026-10-30   | | خاص بكل شركة مع إثبات | |
| +--------------------------+ +--------------------------+ +--------------------------+ +-----------------------+ |
+------------------------------------------------------------------------------------------------------------------+
| [من عملة: USD v] [⇄] [إلى عملة: EGP v] [النوع: الكل v] [المصدر: الكل v] [التاريخ: 2026-10-01 .. 2026-11-01]     |
| ---------------------------------------------------------------------------------------------------------------- |
| الإجراءات        | النطاق      | المراجعة | سعر الصرف (12 خانة) | النوع | تاريخ السريان | الزوج     | المصدر     |
| ---------------------------------------------------------------------------------------------------------------- |
| [عرض الإثبات]    | عام للمستأجر| Rev 1    |     49.250000000000 | SPOT  | 2026-11-01    | USD->EGP  | CBE        |
| [عرض الإثبات]    | عام للمستأجر| Rev 1    |     49.250000000000 | CLOS  | 2026-11-01    | USD->EGP  | CBE        |
| [مراجعة مصححة +] | خاص بالشركة | Rev 2    |     49.180000000000 | SPOT  | 2026-10-29    | USD->EGP  | MANUAL     |
+------------------------------------------------------------------------------------------------------------------+
```

#### 2.6.2 Arabic RTL — Dark (`dir="ltr"` islands inside `dir="rtl"`, `--bg-canvas: #090D16` — `FxRateResolverDrawer` Open)

```text
+------------------------------------------------------------------------------------------------------------------+
| [درج جانبي: اختبار احتساب وتثبيت سعر الصرف (FxPin) - POST /fx-rates/resolve]          | خلفية الجدول معتمة (☾)   |
| ------------------------------------------------------------------------------------- |                          |
| الشركة: شركة النيل للتجارة (EGP)        الفرع: الفرع الرئيسي - القاهرة                 | أسعار الصرف              |
| [من عملة: EUR v]   [إلى عملة: SAR v]   [النوع: SPOT v]   [تاريخ المعاملة: 2026-11-01] |                          |
|                                                                [احتساب السعر (Outline)]| 49.250000000000          |
| ------------------------------------------------------------------------------------- | 49.180000000000          |
| النتيجة: [● تم الاحتساب عبر التثليث بعملة الدفاتر EGP] (Triangulated - rateId: null)  |                          |
| السعر المركب النهائي (12 خانة):                         1 EUR = 5.794117647059 SAR    |                          |
| تاريخ السريان الفعلي: 2026-11-01                       مربوط (Pegged): لا            |                          |
| ------------------------------------------------------------------------------------- |                          |
| مسار التثليث (FxPin.legs):                                                             |                          |
|   1) المسار الأول (EUR -> EGP):  53.480000000000  | CBE | 2026-11-01 | Rev 1          |                          |
|   2) المسار الثاني (EGP -> SAR):  0.108341736695  | CBE | 2026-11-01 | Rev 1          |                          |
+---------------------------------------------------------------------------------------+--------------------------+
```

#### 2.6.3 English LTR — Light (`dir="ltr"`, `--bg-canvas: #F8FAFC`, `--bg-card: #FFFFFF`)

```text
+------------------------------------------------------------------------------------------------------------------+
| Setup > Accounting Setup > FX Rates                          [Nile Trading Co. SAE | Functional: EGP (Frozen) v] |
| FX Rates & Bulletin Providers                  [Export CSV] [Test Rate Resolution] [+ Add Manual Rate (Primary)] |
| [i] Active Company Provider Chain (EG Pack v1): Central Bank of Egypt (CBE - MID side) -> Company MANUAL.        |
+------------------------------------------------------------------------------------------------------------------+
| Tenant Rate Providers (6)                                                                   [Collapse Strip ^]   |
| +--------------------------+ +--------------------------+ +--------------------------+ +-----------------------+ |
| | [● Active] CBE (EG-EGP)  | | [● Active] SAMA (SA-SAR) | | [● Active] ECB (EU-EUR)  | | [● Active] MANUAL     | |
| | Cron: 0 16 * * 0-4       | | Cron: 0 15 * * 0-4       | | Cron: 0 16 * * 1-5       | | Schedule: None        | |
| | Synced: 2026-11-01 16:02 | | Synced: 2026-11-01 15:01 | | Synced: 2026-10-30 16:04 | | Proof-backed per Co.  | |
| | [Configure]              | | [Configure]              | | [Configure]              | | [Configure]           | |
| +--------------------------+ +--------------------------+ +--------------------------+ +-----------------------+ |
+------------------------------------------------------------------------------------------------------------------+
| [From: USD v] [⇄] [To: EGP v] [Type: All v] [Provider: All v] [Dates: 2026-10-01 .. 2026-11-01] [Adv. Search]    |
| ---------------------------------------------------------------------------------------------------------------- |
| Provider | Pair      | Effective Date | Type    | Rate (numeric 24,12)  | Rev   | Scope           | Actions      |
| ---------------------------------------------------------------------------------------------------------------- |
| CBE      | USD->EGP  | 2026-11-01     | SPOT    |       49.250000000000 | Rev 1 | Tenant Sync     | [Inspect]    |
| CBE      | USD->EGP  | 2026-11-01     | CLOSING |       49.250000000000 | Rev 1 | Tenant Sync     | [Inspect]    |
| MANUAL   | USD->EGP  | 2026-10-29     | SPOT    |       49.180000000000 | Rev 2 | Company Manual  | [+ Revision] |
+------------------------------------------------------------------------------------------------------------------+
```

#### 2.6.4 English LTR — Dark (`dir="ltr"`, `--bg-canvas: #090D16`, `--bg-card: #111827` — `FxManualRateModal` Open)

```text
+------------------------------------------------------------------------------------------------------------------+
| [☾ Dark] FX Rates & Bulletin Providers (dimmed backdrop)                                                         |
|        +------------------------------------------------------------------------------------------------+        |
|        | Record Manual Exchange Rate (Append-Only)                                                  [X] |        |
|        | Company: Nile Trading Co. SAE (EGP) · Provider: MANUAL (Proof-Backed)                          |        |
|        | ---------------------------------------------------------------------------------------------- |        |
|        | From Currency *        To Currency *          Rate Type *             Effective Date *         |        |
|        | [ USD              v]  [ EGP              v]  [ SPOT (Posting)    v]  [ 2026-10-29          ]  |        |
|        |                                                                                                |        |
|        | Rate (units of EGP per 1 USD, up to 12 decimals) *                    Pegged Pair              |        |
|        | [ 49.210000000000                                  ]                  [ ] Fixed Peg            |        |
|        |                                                                                                |        |
|        | Source Proof Reference (Bulletin ID, Bank Advice URL, or Attachment ID) *                      |        |
|        | [ CIB-FX-DEAL-2026-10-29-88412                                                               ] |        |
|        |                                                                                                |        |
|        | Correction / Superseding Reason (creating Revision 3 over Revision 2)                          |        |
|        | [ Corrected bank deal ticket rate after treasury confirmation                                ] |        |
|        | ---------------------------------------------------------------------------------------------- |        |
|        |                                                      [Cancel (Ghost)]  [Append Rate (Primary)] |        |
|        +------------------------------------------------------------------------------------------------+        |
+------------------------------------------------------------------------------------------------------------------+
```

- **Mobile (`375px`) Responsive Rules:** Provider cards stack in a single collapsible accordion (`6 providers · CBE Active`); currency pair controls stack two-per-row (`From` / `To`, then `Type` / `Dates`); `FxRateResolverDrawer` opens as a full-width bottom sheet.

---

## 3. Surface 3 — Party Finance Profiles & Party Tax Regimes (`#93`, `#94`)

### 3.1 Layout & Navigation Placement

- **Canonical Routes:**
  - `#93` `/accounting/setup/parties` — **Party Finance Profiles Directory** (Section 7 **Setup -> Accounting Setup** in `accounting-ia.md` §3).
  - `#94` `/accounting/setup/parties/[id]` — **Party Finance Profile Detail Workspace** (`:id` = `acc_party_finance_profiles.id` UUIDv7; navigated via `Link` from `#93` rows and cross-linked from AR/AP subledger party headers).
- **Admission Gates:**
  - `#93` & `#94` shell: Feature `accounting.ledger.core` AND permission `accounting.party_finance_profile.read` on `COMPANY`.
  - `#94` Tab Visibility (`accounting-ia.md` §4 hidden-vs-disabled law):
    1. `overview` (**Overview, Tax Identity & Credit Controls** — `SCR-04` primary): always visible when `#94` loads.
    2. `tax-regimes` (**Dated Counterparty Tax Regimes** — `SCR-04` primary `[P: 4]`): visible **only** when tier includes `accounting.tax.engine` **and** actor holds `accounting.profile.read` on `COMPANY`. Hidden when `accounting.tax.engine` is unentitled; direct URL `?tab=tax-regimes` renders `NotEntitledBoundary` / `PermissionGate` inside the tab body without taking down `#94`.
    3. `bank-accounts` (`[S]` `SCR-25`, `P03.T10` Stage-4): visible only when `accounting.payables.core` + `accounting.party_bank_account.read`.
    4. `tax-id-validations` (`[S]` `SCR-24`, `P03.T10` Stage-4): visible only when `accounting.receivables.core` + `accounting.profile.read`.
    5. `merge-history` (`[S]` `SCR-23`, `P03.T10` Stage-4): visible only when `accounting.receivables.core` + `accounting.profile.read`.
    - *(Wave-3 `custom-fields` and Wave-2 `credit_insurance_*` controls are strictly excluded in MVP per `CG-17` and `01_Foundation_Tables.md` §3.)*
- **Single Primary Action Rule (`PageHeader` / `DetailHeader` `end` slot):**
  - On `#93`: `+ Create Finance Profile` (`+ إنشاء ملف مالي لطرف`) — filled `primary` opening `PartyProfileCreateDrawer` (`POST /accounting/party-finance-profiles`, gated by `accounting.party_finance_profile.create`).
  - On `#94` (`tab=overview`): `Edit Profile` (`تعديل الملف المالي`) — filled `primary` opening `PartyProfileEditDrawer` (`PATCH /accounting/party-finance-profiles/:id` with `If-Match`, gated by `accounting.party_finance_profile.update`).
  - On `#94` (`tab=tax-regimes`): `+ Add Tax Regime` (`+ إضافة نظام ضريبي مؤرخ`) — filled `primary` opening `PartyTaxRegimeDrawer` (`POST /accounting/party-tax-regimes`, gated by `accounting.profile.update`).

### 3.2 Consumed `@/design-system` & Approved Accounting Patterns

| Pattern / Component | Source | Role on Surface 3 |
| --- | --- | --- |
| `PageHeader`, `DetailHeader`, `DetailSection`, `Tabs` | `@/design-system` | `#93` list header, `#94` party summary header with `ReceiverType` & `DataClassification` badges, labelled detail sections |
| `DataTable`, `FilterBar`, `FilterSearchInput`, `CrmAdvancedSearchCard`, `Pagination` | `@/design-system` | `#93` server-paged directory (`GET /party-finance-profiles`, `POST /search`, `POST /count`) + `#94` dated tax regime table |
| `MoneyCell`, `PartyFinancePicker` | `accounting-patterns-data.md` §§2, 4 | Renders `creditLimit` in company `functionalCurrencyCode` (`NULL` -> `No Limit` / `بدون سقف`); `POST /party-finance-profiles/lookup` serves downstream AR/AP/Journal pickers |
| `FormDrawer`, `EditDrawer` | `@/design-system` | Create (`FormDrawer`) binding a Core Party (`partyId`) once per company (`uq_acc_party_finance_profiles_party_company_live`) and versioned `If-Match` update (`EditDrawer`) |
| `BulkActionBar`, `BulkConfirmDialog`, `BulkResultPanel` | `@/design-system` | `#93` multi-row create/update/delete/restore (`POST /bulk`, `PATCH /bulk-update`, `POST /bulk-delete`, `POST /bulk-restore`) |
| `SensitiveFieldMask` & Audit Notice | `01_Foundation_Tables.md` §3 (`D-128`, `D-183`) | Masks `kyc.nationalId` when `dataClassification = SENSITIVE_PERSONAL`; never writes KYC identifiers to `localStorage`/`sessionStorage`; displays inline notice that `creditLimit` and tax-ID edits record an immutable `acc_sensitive_field_changes` entry |
| `AsyncJobState`, `ConflictDialog`, `DeletionBlockerDialog`, `NotFoundState`, `PermissionGate` | `@/design-system` | `202` export tracking, `409` concurrency/overlap resolution, `404` deleted-link boundary (no retry), `403` gate |

### 3.3 Complete DTO & Enum Field Mapping

#### 3.3.1 Party Finance Profiles (`acc_party_finance_profiles` — `02_DTOs.md` §4.1, §4.7 & §13.1, `01_Enums.md` §§4, 17)

| UI Field (`en` / `ar`) | Read DTO (`SummaryDto` / `DetailDto`) | Write DTO (`CreatePartyFinanceProfileDto` / `UpdatePartyFinanceProfileDto`) | Type / Enum | UI Control & Domain Rules |
| --- | --- | --- | --- | --- |
| Core Party / الطرف الأساسي | `partyId` *(see `CG-S3-09` for display name hydration)* | `partyId` (create only; immutable per `(partyId, companyId)`) | `UUID` | Core Party combobox on create; read-only link + `<IdentifierText>` UUID on `#94` |
| Receiver Classification / تصنيف المتلقي | `partyType` | `partyType` | `ReceiverType`: `B` · `P` · `F` (`Business`, `Natural Person`, `Foreigner`; gov bodies use `B`, `D-138`) | Translated `Select` (`منشأة أعمال (B)`, `شخص طبيعي (P)`, `أجنبي / غير مقيم (F)`) |
| Tax Resident / مقيم ضريبياً | `residentFlag` | `residentFlag` | `boolean` (default `true`) | `Switch`; `false` flags supplier for non-resident Form 11 reporting (`D-101`) |
| Tax Office Name / مأمورية الضرائب | `taxOfficeName` | `taxOfficeName` | `string \| null` (`1..160`) | Text input (required operationally for Egypt Form 41 supplier reporting) |
| Tax Office Code / رمز المأمورية | `taxOfficeCode` | `taxOfficeCode` | `string \| null` (`1..32`) | `<IdentifierText>` mono input |
| SRR Number / رقم التسجيل المبسط | `srrNumber` | `srrNumber` | `string \| null` (`1..64`) | `<IdentifierText>` input; when `partyType = 'F'` and `srrNumber` is empty, displays `caution` hint: *"Triggers Reverse-Charge SELF_INVOICE derivation (D-121)"* |
| Treaty Country / دولة اتفاقية منع الازدواج | `treatyCountry` | `treatyCountry` | `CountryCode \| null` (`char(2)`) | ISO country picker (enabled/highlighted when `residentFlag = false`) |
| Related Party Group / مجموعة الأطراف ذات العلاقة | `relatedPartyGroup` | `relatedPartyGroup` | `string \| null` (`1..64`) | Disclosure tag input (`IAS 24` note grouping, `D-196`) |
| Credit Limit / الحد الائتماني | `creditLimit` | `creditLimit` | `DecimalString \| null` (`numeric(24,8) >= 0` in company `functionalCurrencyCode`) | `<MoneyInput>` (`null` = unlimited); audited in `acc_sensitive_field_changes` (`D-183`) |
| Credit Days / أيام الائتمان | `creditDays` | `creditDays` | `number \| null` (`@IsInt 0..3650`) | Integer input (`<IdentifierText>`) |
| Payment Terms / شروط السداد | `paymentTermsId` | `paymentTermsId` | `UUID \| null` (`FK -> acc_payment_terms.id`) | Async reference picker (`CG-S3-09`) |
| Statement Profile / ملف كشف الحساب واللغة | `statementProfileId` | `statementProfileId` | `UUID \| null` (`FK -> acc_statement_profiles.id`; governs issued document locale `D-702`) | Async reference picker |
| Dunning Procedure / إجراء المطالبات | `dunningProcedureId` | `dunningProcedureId` | `UUID \| null` (`FK -> acc_dunning_procedures.id`) | Async reference picker |
| Preferred Payment Method / طريقة الدفع المفضلة | `preferredPaymentMethodId` | `preferredPaymentMethodId` | `UUID \| null` (`FK -> acc_payment_methods.id` of same company, `D-648`) | Async reference picker |
| Net AR/AP in Payment Runs / مقاصة بدفعات السداد | `netInPaymentRuns` | `netInPaymentRuns` | `boolean` (default `false`) | `Switch` (`D-147`) |
| Net Before Dunning / مقاصة قبل المطالبة | `netInDunning` | `netInDunning` | `boolean` (default `false`) | `Switch` (`D-147`) |
| KYC Verification / بيانات التحقق (KYC) | `kyc` *(`DetailDto` only; omitted on `SummaryDto` per §13.1 `jsonb` rule)* | `kyc` (`KycPayloadDto`: `{ verifiedAt?: ISO8601, documents?: string[] (max 20), riskClass?: 'LOW'\|'MEDIUM'\|'HIGH', nationalId?: string (1..32) }`) | `KycPayloadDto` | Structured `DetailSection` on `#94`; `nationalId` auto-sets `dataClassification = SENSITIVE_PERSONAL` (`D-128`) and renders masked (`••••••••••14`) |
| Data Classification / تصنيف سرية البيانات | `dataClassification` | `dataClassification` | `DataClassification`: `NONE` · `PERSONAL` · `SENSITIVE_PERSONAL` · `FINANCIAL_SENSITIVE` | `StatusBadge` + `Select` |
| Reserved Hooks (`SummaryDto`/`DetailDto` read-only) | `creditGrade`, `creditInsuranceRef`, `creditInsuranceLimit` (`creditInsuredLimit`), `customValues` (`DetailDto`) | — (omitted from MVP write DTO) | `null` / `{}` in MVP | Hidden from forms; never editable in Stage 1 |

- **Query Filters (`PartyFinanceProfileListQueryDto` — `02_DTOs.md` §4.1):** `partyType?: ReceiverType`, `residentFlag?: boolean`, `onCreditHold?: boolean` *(see `CG-S3-10`)*, `paymentTermsId?: UUID`, `dunningProcedureId?: UUID`.

#### 3.3.2 Party Tax Regimes (`acc_party_tax_regimes` — `02_DTOs.md` §4.7 & §13.1, `01_Enums.md` §3)

| UI Field (`en` / `ar`) | Read DTO (`PartyTaxRegimeSummaryDto` / `DetailDto`) | Write DTO (`CreatePartyTaxRegimeDto` / `UpdatePartyTaxRegimeDto`) | Type / Enum | UI Control & Domain Rules |
| --- | --- | --- | --- | --- |
| Counterparty / الطرف | `partyId` | `partyId` | `UUID` | Pre-bound to `#94` profile's `partyId` (hidden/read-only) |
| Tax Jurisdiction / الاختصاص الضريبي | `jurisdictionId` | `jurisdictionId` | `UUID` (`FK -> acc_tax_jurisdictions.id`) | Jurisdiction picker (`EG`, `SA`, `AE`, etc., `CG-S3-09`) |
| Tax Regime / النظام الضريبي | `taxRegime` | `taxRegime` | `TaxRegime`: `STANDARD` · `LAW_152_2020` · `LAW_6_2025` | Translated `Select` (`النظام العام`, `قانون ١٥٢ لسنة ٢٠٢٠ - مشروعات صغيرة`, `قانون ٦ لسنة ٢٠٢٥ - مبسط`); helper note: supplier under `LAW_6_2025` is exempt from WHT deduction when paid (`D-120`) |
| Effective From / سارٍ من | `effectiveFrom` | `effectiveFrom` | `ISODate` (inclusive) | Date picker; non-overlapping `[effectiveFrom, effectiveTo)` per `(partyId, companyId)` (`ex_acc_party_tax_regimes_no_overlap_live`) |
| Effective To / سارٍ حتى | `effectiveTo` | `effectiveTo` | `ISODate \| null` (exclusive; `null` = open-ended) | Optional date picker (`effectiveTo > effectiveFrom`) |
| Authority Proof Reference / مرجع مستند الإثبات | `evidenceRef` *(`varchar(256)`; kept by `PartyTaxRegimeSummaryDto`, because the resource has no `GET /:id`, `D-770`)* | `evidenceRef` | `string` (`1..256`, **required**) | Required `<IdentifierText>` input (certificate number or attachment ID) |
| Version | `version` | `If-Match` header on `PATCH` / `DELETE` | `integer >= 1` | Concurrency guard |

### 3.4 Action & Endpoint Mapping (`19` Routes — Verbatim from `02_Endpoint_Catalogue.md` §3)

| UI Action | Method | Catalogue Path (Browser: `/api/tenant/accounting/v1...`) | Permission | Feature Key | Scope | Idempotency | Concurrency | Success |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| List party finance profiles (`#93`) | `GET` | `/accounting/party-finance-profiles` | `accounting.party_finance_profile.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` |
| Run advanced search (`#93`) | `POST` | `/accounting/party-finance-profiles/search` | `accounting.party_finance_profile.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` |
| Count matching profiles (`#93`) | `POST` | `/accounting/party-finance-profiles/count` | `accounting.party_finance_profile.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` |
| Party combobox lookup (pickers) | `POST` | `/accounting/party-finance-profiles/lookup` | `accounting.party_finance_profile.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` |
| Load party finance profile (`#94`) | `GET` | `/accounting/party-finance-profiles/:id` | `accounting.party_finance_profile.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` + `ETag` |
| Create party finance profile | `POST` | `/accounting/party-finance-profiles` | `accounting.party_finance_profile.create` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `none` | `201` + `Location` |
| Bulk create party profiles | `POST` | `/accounting/party-finance-profiles/bulk` | `accounting.party_finance_profile.create` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `none` | `200/207` |
| Update party finance profile (`#94`) | `PATCH` | `/accounting/party-finance-profiles/:id` | `accounting.party_finance_profile.update` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| Bulk update profiles (`#93`) | `PATCH` | `/accounting/party-finance-profiles/bulk-update` | `accounting.party_finance_profile.update` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `none` | `200/207` |
| Soft-delete profile (`#94` / `#93`) | `DELETE` | `/accounting/party-finance-profiles/:id` | `accounting.party_finance_profile.delete` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `204` |
| Bulk soft-delete profiles (`#93`) | `POST` | `/accounting/party-finance-profiles/bulk-delete` | `accounting.party_finance_profile.delete` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `none` | `200/207` |
| Restore soft-deleted profile | `POST` | `/accounting/party-finance-profiles/:id/restore` | `accounting.party_finance_profile.restore` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `none` | `200` |
| Bulk restore profiles (`#93`) | `POST` | `/accounting/party-finance-profiles/bulk-restore` | `accounting.party_finance_profile.restore` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `none` | `200/207` |
| Async import profiles *(sealed until `P17.T06`, `CG-18`)* | `POST` | `/accounting/party-finance-profiles/import` | `accounting.party_finance_profile.create` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key (7 d)` | `none` | `202` + `Location` |
| Async export profiles (`#93`) | `POST` | `/accounting/party-finance-profiles/export` | `accounting.party_finance_profile.read` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `none` | `202` + `Location` |
| List party tax regimes (`#94` tab) | `GET` | `/accounting/party-tax-regimes` | `accounting.profile.read` | `accounting.tax.engine` | `COMPANY` | `none` | `none` | `200` |
| Add dated party tax regime | `POST` | `/accounting/party-tax-regimes` | `accounting.profile.update` | `accounting.tax.engine` | `COMPANY` | `x-idempotency-key` | `none` | `201` |
| Edit dated party tax regime | `PATCH` | `/accounting/party-tax-regimes/:id` | `accounting.profile.update` | `accounting.tax.engine` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| Soft-delete dated party tax regime | `DELETE` | `/accounting/party-tax-regimes/:id` | `accounting.profile.update` | `accounting.tax.engine` | `COMPANY` | `x-idempotency-key` | `If-Match` | `204` |

### 3.5 Complete UI States (`#93` & `#94`)

1. **Loading:** `#93` renders `DataTableSkeleton` (`44px` rows); `#94` renders `DetailHeader` skeleton + 2-column `DetailSection` skeletons.
2. **Empty:**
   - `#93` zero profiles: `EmptyState` explaining that Core parties require a company finance profile before subledger posting, credit checking, or statutory tax derivation, with `+ Create Finance Profile`.
   - `#94` `tax-regimes` zero rows: `EmptyState` explaining that absent an explicit dated regime row, the tax engine treats a domestic counterparty under standard rules, with `+ Add Tax Regime`.
3. **Error + Retry & Domain Validation:**
   - Duplicate `(partyId, companyId)` on create -> inline field error on `partyId` with direct `Link` to the existing profile.
   - Overlapping `PartyTaxRegime` dates (`409` / `422` exclusion `ex_acc_party_tax_regimes_no_overlap_live`) -> highlights conflicting row range inside `PartyTaxRegimeDrawer` and suggests closing the open-ended row's `effectiveTo` to `newEffectiveFrom` first.
   - Cross-company inactive payment method (`trg_acc_party_finance_profiles_payment_method` -> `422 ACCOUNTING.VALIDATION.FAILED`) -> field error on `preferredPaymentMethodId`.
4. **`403` (`PermissionGate`), `404` (`NotFoundState` without retry on stale `#94` URL), `NOT_ENTITLED` (`accounting.tax.engine` hides `tax-regimes` tab; missing `accounting.ledger.core` gates `#93`/`#94`), and `RECOVERY_MODE` (`ReadOnlyGate`):** All enforced per `states.md`.

### 3.6 Four-Combination ASCII Mockups (`#93` Directory & `#94` Detail Workspace)

#### 3.6.1 Arabic RTL — Light (`#93` Directory — `dir="rtl"`, `--bg-canvas: #F8FAFC`)

```text
+------------------------------------------------------------------------------------------------------------------+
| [شركة النيل للتجارة ش.م.م (EGP) v]                             الإعدادات > إعدادات المحاسبة > الملفات المالية للأطراف |
| الملفات المالية للأطراف                                       [تصدير CSV] [+ إنشاء ملف مالي لطرف (Primary)]      |
+------------------------------------------------------------------------------------------------------------------+
| [بحث بالطرف أو المأمورية...     ] [التصنيف: الكل v] [الإقامة: الكل v] [تصفية متقدمة]           الإجمالي: 128 ملفاً |
| ---------------------------------------------------------------------------------------------------------------- |
| [ ] الإجراءات | سرية البيانات | أيام السداد | الحد الائتماني (EGP) | الإقامة  | التصنيف        | الطرف (Core ID) |
| ---------------------------------------------------------------------------------------------------------------- |
| [ ] [...]     | مالية حساسة   |      30 يوم |     250,000.00000000 | مقيم ●   | منشأة أعمال B  | شركة الدلتا     |
| [ ] [...]     | شخصية حساسة   |       0 يوم |            بدون سقف  | مقيم ●   | شخص طبيعي P    | أ. محمد كامل    |
| [ ] [...]     | عادية         |      45 يوم |     500,000.00000000 | غير مقيم | أجنبي F (ذاتي) | Global Tech Ltd |
+------------------------------------------------------------------------------------------------------------------+
```

#### 3.6.2 Arabic RTL — Dark (`#94` Detail `tab=tax-regimes` — `dir="rtl"`, `--bg-canvas: #090D16`)

```text
+------------------------------------------------------------------------------------------------------------------+
| [وضع داكن ☾] [شركة النيل للتجارة ش.م.م (EGP) v]       الملفات المالية للأطراف > شركة الدلتا للتوريدات (منشأة B) |
| شركة الدلتا للتوريدات                                          [حذف] [+ إضافة نظام ضريبي مؤرخ (Primary)]        |
| المعرف الأساسي: <bdi>019a4010-7b00-7000-8000-000000000211</bdi> | [● مقيم ضريبياً] | [مالية حساسة]               |
| [ نظرة عامة والائتمان ] [ الأنظمة الضريبية المؤرخة (نشط) ] [ الحسابات البنكية ] [ التحقق الضريبي ] [ الدمج ]    |
+------------------------------------------------------------------------------------------------------------------+
| [i] يعتمد محرك الخصم والتحصيل والدمغة على السجل الساري في تاريخ المعاملة. المورد الخاضع لقانون 6/2025 لا يُخصم منه.|
| ---------------------------------------------------------------------------------------------------------------- |
| الإجراءات       | مرجع مستند الإثبات         | سارٍ حتى   | سارٍ من    | النظام الضريبي              | الاختصاص   |
| ---------------------------------------------------------------------------------------------------------------- |
| [تعديل] [حذف]   | ETA-LAW6-CERT-2026-99812   | مفتوح      | 2026-01-01 | قانون 6 لسنة 2025 (مبسط)    | مصر (EG)   |
| [تعديل] [حذف]   | ETA-REG-2023-44110         | 2026-01-01 | 2023-01-01 | النظام العام (STANDARD)     | مصر (EG)   |
+------------------------------------------------------------------------------------------------------------------+
```

#### 3.6.3 English LTR — Light (`#93` Directory with `BulkActionBar` — `dir="ltr"`, `--bg-canvas: #F8FAFC`)

```text
+------------------------------------------------------------------------------------------------------------------+
| Setup > Accounting Setup > Party Finance Profiles                             [Nile Trading Co. SAE (EGP) v]     |
| Party Finance Profiles                                        [Export CSV] [+ Create Finance Profile (Primary)]  |
+------------------------------------------------------------------------------------------------------------------+
| [2 selected]   [Bulk Update Credit/Terms]   [Bulk Soft-Delete]   [Clear Selection]                               |
+------------------------------------------------------------------------------------------------------------------+
| [Search party or tax office... ] [Receiver: All v] [Residency: All v] [Advanced Search]          Total: 128 rows |
| ---------------------------------------------------------------------------------------------------------------- |
| [x] Party (Core Ref)     | Receiver       | Residency    | Credit Limit (EGP)   | Days | Classification | Action |
| ---------------------------------------------------------------------------------------------------------------- |
| [x] Delta Supplies SAE   | Business (B)   | [● Resident] |     250,000.00000000 |   30 | Fin. Sensitive | [...]  |
| [ ] Mohamed Kamel        | Person (P)     | [● Resident] |             No Limit |    0 | Sens. Personal | [...]  |
| [x] Global Tech Ltd      | Foreigner (F)  | [▲ Non-Res.] |     500,000.00000000 |   45 | Standard       | [...]  |
+------------------------------------------------------------------------------------------------------------------+
```

#### 3.6.4 English LTR — Dark (`#94` Detail `tab=overview` — `dir="ltr"`, `--bg-canvas: #090D16`)

```text
+------------------------------------------------------------------------------------------------------------------+
| [☾ Dark] Party Finance Profiles > Global Tech Ltd                              [Nile Trading Co. SAE (EGP) v]    |
| Global Tech Ltd                                                       [Delete] [Edit Profile (Primary)]          |
| Core Party ID: 019a4010-7b00-7000-8000-000000000309 · [Foreigner (F)] · [▲ Non-Resident] · [Standard Privacy]    |
| [ Overview & Credit (Active) ]  [ Dated Tax Regimes (1) ]  [ Bank Accounts ]  [ Tax ID Checks ]  [ Merges ]      |
+-------------------------------------------------------------------+----------------------------------------------+
| Tax & Statutory Identity                                          | Credit & Subledger Settlement                |
| ----------------------------------------------------------------- | -------------------------------------------- |
| Receiver Type:         Foreigner (F)                              | Credit Limit (EGP):         500,000.00000000 |
| Tax Resident:          No (Feeds Form 11 Non-Resident Return)     | Credit Days:                         45 days |
| SRR Number:            — [▲ Triggers Reverse-Charge SELF_INVOICE] | Net AR/AP in Payment Runs:               Yes |
| Treaty Country:        GB (United Kingdom)                        | Net Before Dunning:                       No |
| Tax Office Name / Code:— / —                                      | KYC Risk Class / Verified:  LOW / 2026-09-14 |
+-------------------------------------------------------------------+----------------------------------------------+
```

- **Mobile (`375px`) Responsive Rules:** `#93` collapses `BulkActionBar` into a sticky bottom bar above safe-area inset; `#94` two-column `DetailSection` grid stacks vertically into single-column cards (`gap-4`), and horizontal `Tabs` scrolls smoothly without clipping badges.

---

## 4. Surface 4 — Validation Rules & Effective-Dated Accounting Settings (`#88` Tabs)

### 4.1 Layout & Navigation Placement

- **Canonical Route:** `/accounting/setup/company` (`#88` in `accounting-ia.md` §3, Section 7 **Setup -> Accounting Setup**).
- **Host Workspace Integration:** `#88` hosts `SCR-01` tabs (`Company Profile`, `Tax Regimes`, `Branch Fiscal Profiles`, `Ledgers`, `Country Packs` — designed in `P03.T09.S1`) alongside the two `P03.T09.S3` tabs gated by `accounting.ledger.core` + `accounting.setting.read` on `COMPANY`:
  1. `settings` (**Settings & Legal Interim Policies** — `5` routes: `GET /settings`, `GET /settings/:key`, `PATCH /settings/:key`, `POST /settings/legal-interim-policies/:code/acknowledge`, `POST /settings/legal-interim-policies/:code/withdraw`).
  2. `validation-rules` (**Posting Validation Rules** — `SCR-04` primary `[P: 2]`: `GET /validation-rules`, `GET /validation-rules/:id`).
- **Single Primary Action Rule (`PageHeader` `end` slot):**
  - `tab=validation-rules`: **Zero primary CTA** — MVP allows only pack-shipped `PLATFORM` rules (`ck_acc_validation_rules_owner_mvp`, `D-195`); tenant rule authoring is Post-MVP Wave 1 and **never** rendered as fake or disabled buttons.
  - `tab=settings`: **Zero global save button** — each setting key is an independent effective-dated immutable publication (`acc_settings`, `D-055`) edited via its own row `Update Effective Value` (`outline`) opening `SettingUpsertDrawer` (`PATCH /accounting/settings/:key` with `If-Match`), and each of the 4 `INTERIM_POLICY` Legal Readiness items carries its own `Acknowledge Policy` (`outline`, gated by `accounting.setting.manage`) or `Withdraw` (`ghost` -> `ConfirmActionModal`).

### 4.2 Consumed `@/design-system` & Approved Accounting Patterns

| Pattern / Component | Source | Role on Surface 4 |
| --- | --- | --- |
| `DetailSection`, `DataTable`, `ReadOnlyGate`, `EmptyState` | `@/design-system` | Grouped setting cards (Settlement, Treasury, Statutory Numbering, Company-Set Return Terms), Legal Readiness Register cards, and read-only Validation Rules grid |
| `ConditionGrammarInspector` (`ConditionRow[]` viewer) | `03_Interfaces_and_Value_Objects.md` §7 | Read-only drawer (`GET /validation-rules/:id`) rendering `factor`, `op`, `value`, `action` (`BLOCK` \| `WARN`), `priority`, and `messageKey` |
| `EditDrawer` (`SettingUpsertDrawer`) | `@/design-system` | Schema-driven typed form per `ACCOUNTING_SETTING_KEYS` key (`INTEGER`, `STRING`, structured `JSON`) with `effectiveFrom` / `effectiveTo` and `scopeTarget`; `If-Match` follows the upsert rule of Context §8: the version of the live row the command closes or updates, and no header while none exists (`D-771`) |
| `ConfirmActionModal` (`LegalPolicyAckModal` / `WithdrawModal`) | `@/design-system` | Displays exact `policyVersion` (`v2`/`v3`) and SHA-256 `policyTextHash` before calling `POST .../acknowledge`, or warns that gated paths fail closed again on `POST .../withdraw` |
| `ConflictDialog`, `AmbiguousOutcomePanel`, `PermissionGate` | `@/design-system` | Handles `409 STALE_VERSION` / `409 NUMBER_SERIES_IN_USE` / `409 PAYLOAD_CHANGED`, timeout replay, and `403` |

### 4.3 Complete DTO, Closed-Catalogue & Enum Field Mapping

#### 4.3.1 Posting Validation Rules (`acc_validation_rules` — `01_Foundation_Tables.md` §10, `02_DTOs.md` §13.1, `01_Enums.md` §§16, 17)

| UI Field (`en` / `ar`) | Read DTO (`ValidationRuleSummaryDto` / `ValidationRuleDetailDto`) | Type / Enum | UI Presentation |
| --- | --- | --- | --- |
| Rule Code / رمز القاعدة | `code` | `string` (`1..48`) | `<IdentifierText>` mono |
| Target Object / الكائن المستهدف | `object` | `string` (`journal_draft`, `fiscal_document`, `settlement`, …) | Translated resource badge |
| Jurisdiction / الدولة | `countryCode` | `CountryCode \| null` (`null` on base pack) | ISO badge |
| Rule Owner / المصدر | `owner` | `ContentOwner`: `PLATFORM` (`TENANT` reserved Wave 1) | `StatusBadge` (`Pack-Shipped` / `حزمة المنصة`) |
| Action / الإجراء عند المخالفة | `action` | `ValidationRuleAction`: `BLOCK` · `WARN` | `negative` `Block Posting` (`منع الترحيل` -> `PostingExceptionKind.VALIDATION_RULE`) vs `caution` `Warning` (`تنبيه`) |
| Priority / الأولوية | `priority` | `integer` (lower runs first, default `100`) | `<IdentifierText>` |
| Message Key / مفتاح الرسالة | `messageKey` | `string` (`1..128`) | Localized preview + `<IdentifierText>` key |
| Validity / فترة السريان | `effectiveFrom`, `effectiveTo` | `ISODate`, `ISODate \| null` | Date range |
| Active / الحالة | `isActive` | `boolean` | `StatusBadge` |
| Conditions / الشروط | `conditions` *(`DetailDto` only — omitted on `SummaryDto` per §13.1 `jsonb` rule)* | `ConditionRow[]` (`{ factor, op, value }`, `AND`-joined) | Structured read-only list in `ValidationRuleInspectDrawer` |

#### 4.3.2 Effective-Dated Settings & Legal Readiness Register (`acc_settings` — `02_DTOs.md` §4.8 & §13.1, `04_Errors_and_Constants.md` §6.2)

- **Read DTO (`SettingSummaryDto` / `SettingDetailDto`):** `id`, `companyId`, `branchId`, `scopeTarget` (`AccountingScopeTarget`: `TENANT` · `COMPANY` · `BRANCH`), `settingKey`, `valueType` (`SettingValueType`: `STRING` · `INTEGER` · `DECIMAL` · `BOOLEAN` · `JSON` · `DATE`), `value` *(`DetailDto` via `GET /settings/:key` — `jsonb`)*, `effectiveFrom`, `effectiveTo`, `contentHash` (`Sha256Hex`), `publishedAt`, `publishedBy`, `version`.
- **Write DTO (`UpsertSettingDto` on `PATCH /accounting/settings/:key`):** `scopeTarget: AccountingScopeTarget`, `valueType: SettingValueType`, `value: unknown` (validated per closed key schema below — **never** a raw JSON textarea!), `effectiveFrom: ISODate`, `effectiveTo?: ISODate`.
- **Closed Schema-Driven Editor Mapping for All 9 Mutable MVP Keys (`04_Errors_and_Constants.md` §6.2):**
  1. `settlement.rounding_tolerance` (`COMPANY`, `JSON`): structured Tolerance Amount (`DecimalString`) input (`D-416`).
  2. `treasury.bank_details_cooling_hours` (`COMPANY` | `TENANT`, `INTEGER`): integer input `1..168` hours (seeded default `24`, `D-183`).
  3. `treasury.pos_shift_cutoff_hours` (`BRANCH` | `COMPANY` | `TENANT`, `INTEGER`): integer input `1..48` hours (seeded default `6`, `D-452`).
  4. `numbering.sales_invoice_series` (`BRANCH` | `COMPANY`, `JSON`): `{ prefixPattern: string, padding: int 3..12, startAt?: int >= 1 }` (`SIN-{YYYY}-`, pad `6`, `VAL-LFO-35`, `D-724`, `D-758`).
  5. `numbering.credit_note_series` (`BRANCH` | `COMPANY`, `JSON`): `{ prefixPattern, padding, startAt? }` (`SCN-{YYYY}-`, pad `6`).
  6. `numbering.debit_note_series` (`BRANCH` | `COMPANY`, `JSON`): `{ prefixPattern, padding, startAt? }` (`SDN-{YYYY}-`, pad `6`).
  7. `tax_return.frequency` (`COMPANY`, `STRING`): `Select` of `TaxReturnFrequency` (`MONTHLY` · `BI_MONTHLY` · `QUARTERLY` · `ANNUAL`, `D-749`).
  8. `tax_return.due_rule` (`COMPANY`, `JSON`): `{ offset: int, unit: 'DAYS' | 'MONTHS', anchor: 'PERIOD_END' }` (`D-749`).
  9. `tax_return.amendment_window_months` (`COMPANY`, `INTEGER`): integer input `1..120` months (`D-749`).
  *(10th key family `legal.interim_policy_ack.<code>` is read-only in the settings list and refused on `PATCH /settings/:key` with `422 ACCOUNTING.SETTING.KEY_UNKNOWN`, mutated solely via the two Legal Readiness commands below.)*
- **Legal Interim Policy Acknowledgement DTO (`AcknowledgeLegalInterimPolicyDto` — `02_DTOs.md` §4.8, `04_Errors_and_Constants.md` §6.2 `D-245`, `D-270`, `D-754`):**
  - Acknowledgeable `INTERIM_POLICY` codes (**4 cards**):
    - `L-READY-03` (`policyVersion: 'v2'`) — Art. 28(3) small-debt exception vs Art. 52 Law 91/2005 (`SMALL_DEBT_EXCEPTION` write-offs).
    - `L-READY-04` (`policyVersion: 'v2'`) — Art. 28 `2 %` annual small-debt cap base & excess handling (`capCheck`).
    - `L-READY-05` (`policyVersion: 'v2'`) — Subsequent VAT adjustment on an uncollected bad debt after statutory period.
    - `L-READY-07` (`policyVersion: 'v3'`) — Tax-return amendment after statutory window & prior-year correction schedule treatment.
  - Non-acknowledgeable register items (`L-READY-01`, `L-READY-02` `BLOCKED_UNTIL_APPROVED`; `L-READY-06` `PLATFORM_TARGET`; `L-READY-08` `PARAMETER_DEFAULT` CBE mid-rate) are shown in a collapsed informational disclosure with **no** acknowledge button (`D-754`).
  - Request body on `POST .../acknowledge`: `{ policyVersion: string (1..32), policyTextHash: Sha256Hex, note?: string (max 500) }`.

### 4.4 Action & Endpoint Mapping (`7` Routes — Verbatim from `02_Endpoint_Catalogue.md` §3)

| UI Action | Method | Catalogue Path (Browser: `/api/tenant/accounting/v1...`) | Permission | Feature Key | Scope | Idempotency | Concurrency | Success |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| List active/scheduled company settings | `GET` | `/accounting/settings` | `accounting.setting.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` |
| Load typed setting value + `ETag` | `GET` | `/accounting/settings/:key` | `accounting.setting.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` + `ETag` |
| Publish effective-dated setting row | `PATCH` | `/accounting/settings/:key` | `accounting.setting.update` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| Acknowledge `INTERIM_POLICY` item | `POST` | `/accounting/settings/legal-interim-policies/:code/acknowledge` | `accounting.setting.manage` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `none` | `200` |
| Withdraw `INTERIM_POLICY` acknowledgement | `POST` | `/accounting/settings/legal-interim-policies/:code/withdraw` | `accounting.setting.manage` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `none` | `204` |
| List pack-shipped validation rules | `GET` | `/accounting/validation-rules` | `accounting.setting.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` |
| Inspect validation rule `conditions[]` | `GET` | `/accounting/validation-rules/:id` | `accounting.setting.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `200` |

### 4.5 Complete UI States (`#88` `validation-rules` & `settings` Tabs)

1. **Loading:** Grouped `DetailSection` skeletons on `settings`; `DataTableSkeleton` on `validation-rules`.
2. **Honest MVP Empty State on `validation-rules` (`03_Interfaces_and_Value_Objects.md` §7.1 line 226):**
   - Because `CONDITION_FACT_REGISTRY_V1.VALIDATION` ships zero facts in MVP (`"the MVP ships no validation-rule row"`), `GET /accounting/validation-rules` legitimately returns `[]` for every MVP company! `EmptyState` explicitly states: *"No pack-shipped posting validation rules are active for this company's country pack. Mandatory accounting checks are enforced natively by Ledger & Tax rules." / "لا توجد قواعد تحقق إضافية مرفقة بحزمة الدولة الحالية؛ يتم تطبيق ضوابط التوازن والفترات والضرائب تلقائياً بواسطة محرك القيود."* — never rendered as an error and with zero fake "Create Rule" CTA.
3. **Settings Domain Errors (`useAccountingErrorModel`):**
   - `409 ACCOUNTING.SETTING.NUMBER_SERIES_IN_USE` (`D-758`): explains that a counter has already issued numbers in or after the fiscal year of `effectiveFrom` (`details.nextValue` shown), guiding the user to pick the start date of the next unopened fiscal year or raise `startAt >= nextValue`.
   - `409 ACCOUNTING.APPROVAL.PAYLOAD_CHANGED` on `acknowledge`: policy text hash/version changed in a newer release — refetches register metadata and prompts re-review.
4. **`403` (`PermissionGate`), `NOT_ENTITLED`, and `RECOVERY_MODE` (`ReadOnlyGate`):** Users with `accounting.setting.read` but without `accounting.setting.update` / `accounting.setting.manage` see full-contrast read-only values and policy statuses (`Field readOnly`), never low-contrast disabled inputs.

### 4.6 Four-Combination ASCII Mockups (`#88` Settings, Interim Policies & Validation Rules)

#### 4.6.1 Arabic RTL — Light (`#88` `tab=settings` — `dir="rtl"`, `--bg-canvas: #F8FAFC`)

```text
+------------------------------------------------------------------------------------------------------------------+
| [شركة النيل للتجارة ش.م.م (EGP) v]                                   الإعدادات > إعدادات المحاسبة > ملف الشركة |
| ملف الشركة والسياسات المحاسبية                                                                                   |
| [ ملف الشركة ] [ الأنظمة الضريبية ] [ الفروع ] [ الدفاتر ] [ حزم الدول ] [ الإعدادات والسياسات (نشط) ] [ التحقق ] |
+------------------------------------------------------------------------------------------------------------------+
| الإعدادات المؤرخة القابلة للتخصيص (9 مفاتيح مغلقة - التوريث: فرع <- شركة <- مستأجر)                              |
| ---------------------------------------------------------------------------------------------------------------- |
| الإجراء         | سارٍ من    | النطاق الفعلي | القيمة الحالية                     | الإعداد                      |
| ---------------------------------------------------------------------------------------------------------------- |
| [تحديث مؤرخ]    | 2026-01-01 | شركة          | 24 ساعة                            | فترة تهدئة تعديل حساب البنك  |
| [تحديث مؤرخ]    | 2026-01-01 | شركة          | 6 ساعات                            | مهلة إقفال وردية نقاط البيع  |
| [تحديث مؤرخ]    | 2026-01-01 | شركة          | SIN-{YYYY}- (6 خانات)              | سلسلة ترقيم فواتير المبيعات  |
+------------------------------------------------------------------------------------------------------------------+
| سجل الجاهزية القانونية والسياسات المرحلية (يتطلب صلاحية إدارة الإعدادات accounting.setting.manage)              |
| +-------------------------------------------------------+ +----------------------------------------------------+ |
| | [● مُقرّ بها] L-READY-04 (الإصدار v2)                 | | [▲ غير مُقرّ بها - إيقاف آمن] L-READY-03 (v2)      | |
| | سقف ٢٪ للديون المعدومة الصغيرة ومعالجة الزيادة        | | استثناء الديون الصغيرة بموجب المادة ٢٨(٣)          | |
| | التجزئة: 8f3a...91c2 | أُقرّت في: 2026-02-10          | | المسارات المرتبطة تتوقف بأمان حتى تسجيل الإقرار     | |
| |                                      [سحب الإقرار]    | |                             [مراجعة وإقرار السياسة] | |
| +-------------------------------------------------------+ +----------------------------------------------------+ |
+------------------------------------------------------------------------------------------------------------------+
```

#### 4.6.2 Arabic RTL — Dark (`#88` `tab=validation-rules` MVP Honest Empty State — `dir="rtl"`, `--bg-canvas: #090D16`)

```text
+------------------------------------------------------------------------------------------------------------------+
| [وضع داكن ☾] [شركة النيل للتجارة ش.م.م (EGP) v]                      الإعدادات > إعدادات المحاسبة > ملف الشركة |
| ملف الشركة والسياسات المحاسبية                                                                                   |
| [ ملف الشركة ] [ الأنظمة الضريبية ] [ الفروع ] [ الدفاتر ] [ حزم الدول ] [ الإعدادات والسياسات ] [ قواعد التحقق ] |
+------------------------------------------------------------------------------------------------------------------+
| [i] تعرض هذه الشاشة قواعد التحقق عند الترحيل المرفقة بحزمة الدولة المعتمدة (للقراءة فقط في الإصدار الحالي).     |
| +--------------------------------------------------------------------------------------------------------------+ |
| |                                        [أيقونة درع التحقق المحاسبي]                                          | |
| |                        لا توجد قواعد تحقق إضافية مرفقة بحزمة الدولة المعتمدة حالياً                          | |
| |     يتم إنفاذ ضوابط توازن القيود، حالة الفترات المالية، إلزامية الأبعاد، وقواعد الضرائب تلقائياً في النظام.   | |
| +--------------------------------------------------------------------------------------------------------------+ |
+------------------------------------------------------------------------------------------------------------------+
```

#### 4.6.3 English LTR — Light (`#88` `tab=settings` — `dir="ltr"`, `--bg-canvas: #F8FAFC`)

```text
+------------------------------------------------------------------------------------------------------------------+
| Setup > Accounting Setup > Company Profile & Policies                         [Nile Trading Co. SAE (EGP) v]     |
| Company Profile & Accounting Policies                                                                            |
| [ Profile ] [ Tax Regimes ] [ Branches ] [ Ledgers ] [ Country Packs ] [ Settings & Policies (Active) ] [ Rules ]|
+------------------------------------------------------------------------------------------------------------------+
| Effective-Dated Operational Settings (Resolution Order: BRANCH -> COMPANY -> TENANT)                             |
| ---------------------------------------------------------------------------------------------------------------- |
| Setting                                  | Current Value              | Resolved Scope | Effective  | Action     |
| ---------------------------------------------------------------------------------------------------------------- |
| Bank Details Cooling Period              | 24 hours                   | COMPANY        | 2026-01-01 | [Schedule] |
| POS Shift Cutoff Window                  | 6 hours                    | COMPANY        | 2026-01-01 | [Schedule] |
| Sales Invoice Numbering Series           | SIN-{YYYY}- (pad 6)        | COMPANY        | 2026-01-01 | [Schedule] |
| Credit / Debit Note Numbering Series     | SCN-{YYYY}- / SDN-{YYYY}-  | COMPANY        | 2026-01-01 | [Schedule] |
+------------------------------------------------------------------------------------------------------------------+
| Legal Readiness Interim Policy Register (`accounting.setting.manage`)                                            |
| +-------------------------------------------------------+ +----------------------------------------------------+ |
| | [● Acknowledged] L-READY-04 (Version v2)              | | [▲ Unacknowledged - Fails Closed] L-READY-03 (v2)  | |
| | Art. 28 2% Small-Debt Cap Base & Excess Treatment     | | Art. 28(3) Small-Debt Write-Off Exception          | |
| | SHA-256: 8f3a...91c2 · Signed 2026-02-10              | | Small-debt write-offs refuse until acknowledged    | |
| | [Withdraw Acknowledgement]                            | | [Review & Acknowledge Policy]                      | |
| +-------------------------------------------------------+ +----------------------------------------------------+ |
+------------------------------------------------------------------------------------------------------------------+
```

#### 4.6.4 English LTR — Dark (`#88` `tab=validation-rules` Populated Pack Row + Inspector — `dir="ltr"`, `--bg-canvas: #090D16`)

```text
+------------------------------------------------------------------------------------------------------------------+
| [☾ Dark] Company Profile & Accounting Policies                                [Nile Trading Co. SAE (EGP) v]     |
| [ Profile ] [ Tax Regimes ] [ Branches ] [ Ledgers ] [ Country Packs ] [ Settings ] [ Validation Rules (Active) ]|
+-------------------------------------------------------------------+----------------------------------------------+
| Pack-Shipped Posting Validation Rules (Read-Only in MVP)          | Rule Inspector: VR_DOC_MEMO_REQ          [X] |
| ----------------------------------------------------------------- | -------------------------------------------- |
| Code             | Target Object   | Action    | Priority | State | Owner:          PLATFORM (EG Pack)           |
| ----------------------------------------------------------------- | Action:         [■ BLOCK] -> Exception Queue |
| VR_DOC_MEMO_REQ  | journal_draft   | [■ BLOCK] |       10 | [Act] | Effective:      2026-01-01 .. Open           |
| VR_SETTLE_WARN   | settlement      | [▲ WARN]  |       50 | [Act] | Message Key:    acc.rule.memo_required       |
| ----------------------------------------------------------------- | Conditions (AND-joined closed grammar):      |
| Showing 1-2 of 2                                                  |  1. draft.kind  IN  ["ADJUSTMENT"]           |
+-------------------------------------------------------------------+----------------------------------------------+
```

- **Mobile (`375px`) Responsive Rules:** Settings rows render as stacked cards (`Setting title` -> `Current value + Scope badge` -> full-width `Schedule New Value` outline button); Legal Readiness policy cards stack 1-per-row with truncated `<IdentifierText>` SHA-256 hash + copy button.

---

## 5. Master Endpoint Reconciliation & Contract Gap Register for `P03.T11`

### 5.1 Endpoint Coverage Proof (`65 / 65` Routes Accounted For)

- **`SCR-04` Primary `[P: 51]`:** `dimension-types` (`6/6`), `dimension-values` (`15/15`), `fx-rate-providers` (`2/2`), `fx-rates` (`7/7`), `party-finance-profiles` (`15/15`), `party-tax-regimes` (`4/4`), `validation-rules` (`2/2`) = **`51/51`**.
- **Companion `P03.T09.S3` Stage-1 Master-Data Tabs `[14]`:** `journals` (`7/7`), `number-sequences` (`2/2` read-only `CG-10`), `settings` (`3/3`), `settings/legal-interim-policies` (`2/2`) = **`14/14`**.
- **Zero invented routes, permissions, feature keys, DTO properties, or enum members.**

### 5.2 Contract Gaps for `P03.T11` Reconciliation

| Gap ID | Affected Surface & Route(s) | Exact LLD Evidence Checked | Concrete UX / Integration Gap & Recommended `P03.T11` Resolution |
| --- | --- | --- | --- |
| **`CG-S3-01`** | `#88`, `#91` (`SCR-04` vs `SCR-01`/`SCR-03` inventory table) | `accounting-screen-inventory.md` row `SCR-04` vs `accounting-ia.md` §3 (`#88`, `#91`) & `agy-P03.T09.S3.md` | `SCR-04` `Route` cell lists only `#92, #93, #94`, omitting `#91` (`dimension-types`, `dimension-values`) and `#88` (`validation-rules`), while `journals`, `number-sequences`, and `settings` sit in `SCR-03`/`SCR-01` in the inventory but in `S3`'s brief. Update `SCR-04` `Route` cell to cross-link `#91` and `#88`. |
| **`CG-S3-02`** | `#94` `GET /accounting/party-tax-regimes` | `02_DTOs.md` §4.1 & §4.7; `02_Endpoint_Catalogue.md` line 113; `01_Foundation_Tables.md` line 205 | `02_DTOs.md` §4.1 defines no `PartyTaxRegimeListQueryDto`. `#94` requires `partyId: UUID` (plus optional `jurisdictionId?`, `taxRegime?`, `effectiveOn?`) on `GET /accounting/party-tax-regimes` so the detail tab does not scan company-wide regimes. Also note `evidence_ref` is `varchar(256)`, which §13.1 `varchar(>255)` strips from `PartyTaxRegimeSummaryDto` while there is **no** `GET /accounting/party-tax-regimes/:id` route in the catalogue! Either include `evidenceRef` on `PartyTaxRegimeSummaryDto` (`varchar(255)` or explicit field) or add `GET /party-tax-regimes/:id`. |
| **`CG-S3-03`** | `#88` `GET /accounting/validation-rules` | `02_DTOs.md` §4.1; `02_Endpoint_Catalogue.md` line 234 | `02_DTOs.md` §4.1 defines no `ValidationRuleListQueryDto`. Add optional `object?: string`, `action?: ValidationRuleAction`, and `isActive?: boolean` filters alongside `PaginationQueryDto`. |
| **`CG-S3-04`** | `#92` `POST /accounting/fx-rates` & `GET /accounting/fx-rates` | `02_DTOs.md` §4.6 & §13.1; `01_Foundation_Tables.md` lines 947–955 | (1) `02_DTOs.md` §4.6 declares `ImportFxRatesDto` (`FxRateRowInput[]`) but names no standalone `CreateFxRateDto` for `POST /accounting/fx-rates`, and `FxRateRowInput` lacks `supersededReason?: string` (`max 255`) needed when posting a corrective `revision > 1`. (2) `acc_fx_rates` columns are `from_currency`/`to_currency` (`fromCurrency`/`toCurrency` under §13.1), whereas `FxRateRowInput`, `FxRateListQueryDto`, and `FxPinDto` use `fromCurrencyCode`/`toCurrencyCode`. Align field names and export `CreateFxRateDto`. Also note `source_ref` is `varchar(256)` (stripped from `FxRateSummaryDto` by §13.1 `>255`, requiring `GET /fx-rates/:id` to view `sourceRef`). |
| **`CG-S3-05`** | `#92` `GET /accounting/fx-rates` | `02_DTOs.md` §4.1 (`FxRateListQueryDto`) | `fromCurrencyCode` and `toCurrencyCode` are both **required** on `FxRateListQueryDto`, preventing an unfiltered "recent rates across all foreign currencies" initial load on `#92` without falling back to `POST /accounting/fx-rates/search`. Make `fromCurrencyCode`/`toCurrencyCode` optional on `GET /fx-rates` or codify `POST /fx-rates/search` as the default initial query. |
| **`CG-S3-06`** | `#91` `dimension-types` (`GET`, `POST`, `PATCH`) | `02_DTOs.md` §4.5 & §13.1; `01_Foundation_Tables.md` line 775 | `CreateDimensionTypeDto` uses `dimensionTypeCode: DimensionTypeCode`, whereas `acc_dimension_types` column `type_code` projects as `typeCode` on `DimensionTypeSummaryDto`/`DetailDto`. Also `DimensionTypeDetailDto` lacks a `hasDimensionSets: boolean` flag (analogous to `AccountDetailDto.hasPostedLines`) to pre-indicate a frozen `hotSlot` before `PATCH` fails with `409 ACCOUNTING.DIMENSION.SLOT_FROZEN`. |
| **`CG-S3-07`** | `#91` `journals` (`PATCH /accounting/journals/:id`, pickers) | `02_Endpoint_Catalogue.md` lines 185–191; `02_DTOs.md` §4.4; `01_Foundation_Tables.md` line 480 | (1) `journals` has `GET /journals` and `POST /journals/search` but no `POST /accounting/journals/lookup` (unlike `accounts`, `dimension-values`, `party-finance-profiles`). (2) `acc_journals` has `is_active boolean DEFAULT true`, and posted journals cannot be soft-deleted (`D-486`), but `CreateJournalDto` omits `isActive` — confirm `UpdateJournalDto` exposes `isActive?: boolean` and align `emailAlias` max length (`64` in DTO vs `varchar(160)` in ERD). |
| **`CG-S3-08`** | `#88` `GET/PATCH /accounting/settings` | `02_Endpoint_Catalogue.md` lines 229–231 vs `02_DTOs.md` §4.1 & §4.8, `01_Foundation_Tables.md` §9, `04_Errors_and_Constants.md` §6.2 | Catalogue lines 229–231 mark `settings` Scope as `COMPANY` and `PATCH /settings/:key` Concurrency as `If-Match`, whereas `UpsertSettingDto` and `ACCOUNTING_SETTING_KEYS` allow `TENANT`, `COMPANY`, and `BRANCH` rows (`D-055`) and publish a **new** immutable effective-dated `acc_settings` row. When publishing a first `BRANCH` override (or first `COMPANY` row where only pack/default existed), no prior row `ETag` exists at that scope. Reconcile Catalogue scope (`COMPANY_OR_BRANCH` / `OPERATING_CONTEXT`) and make `If-Match` conditional or scope-specific. |
| **`CG-S3-09`** | `#93`, `#94` (`party-finance-profiles`, `party-tax-regimes`) | `01_Foundation_Tables.md` lines 151, 165–170, 201; `02_DTOs.md` §13.1 | `PartyFinanceProfileSummaryDto`/`DetailDto` carry UUIDs only (`partyId`, `paymentTermsId`, `statementProfileId`, `dunningProcedureId`, `preferredPaymentMethodId`) without Core Party display name/code/tax-ID hydration. Confirm batch Core Party lookup (`/api/tenant/core/v1/parties/lookup` by `ids[]`) or server-hydrated summary fields, plus Stage-1 availability of lookup endpoints for `payment-terms`, `statement-profiles`, `dunning-procedures`, `payment-methods`, and `tax-jurisdictions` when only `accounting.ledger.core` is entitled. |
| **`CG-S3-10`** | `#93` `PartyFinanceProfileListQueryDto` & `#91` `NumberSequenceSummaryDto` | `02_DTOs.md` §4.1 & §13.1; `01_Foundation_Tables.md` lines 148–178 & 545 | (1) `PartyFinanceProfileListQueryDto` exposes `onCreditHold?: boolean`, but `acc_party_finance_profiles` has no `on_credit_hold` column — clarify whether `onCreditHold` is joined from subledger/collections or should be added/removed. (2) `acc_number_sequences.next_value` is PostgreSQL `bigint`; codify `string` wire serialization in `02_DTOs.md` §13.1 so `parseNumberSequence` validates it without `Number()` precision loss. |
| **`CG-S3-11`** | All Accounting Tenant Browser Routes & Master-Data Imports | `tenant-portal/docs/architecture/data-layer.md` lines 38–41; `accounting-screen-inventory.md` `CG-18` (`D-691`) | (1) Register `/api/tenant/accounting/v1/*` -> `/accounting/*` in Gateway route contracts and `data-layer.md`. (2) Per `CG-18` (`D-691`), `POST /dimension-values/import`, `POST /fx-rates/import`, and `POST /party-finance-profiles/import` (`202`, `7 d` idempotency) land in `P17.T06`; Stage-1 screens keep Import triggers hidden/sealed until `P17.T06` is deployed. |

## Contract reconciliation (P03.T11, 1 November 2026)

Reconciles the gaps of this spec against the Endpoint Catalogue and `02_DTOs.md` after `D-770`, `D-771` and `D-772`. The gap list above keeps the original findings; these rulings are final.

| Gap id | Ruling | Where |
| --- | --- | --- |
| `CG-S3-01` | dropped (not contract) | Inventory route cells for `SCR-04` are an inventory-only correction, not a contract change |
| `CG-S3-02` | closed by D-770 | `PartyTaxRegimeListQueryDto`; `PartyTaxRegimeSummaryDto` keeps `evidenceRef`; the missing module 01 §5 `GET` row is added. Still open and outside this gap: the source of `jurisdiction_id` on `CreatePartyTaxRegimeDto` (no document states it) |
| `CG-S3-03` | closed by D-770 | `ValidationRuleListQueryDto { object?, action?, isActive? }` |
| `CG-S3-04` | closed by D-771 | `CreateFxRateDto extends FxRateRowInput { supersededReason? }`, required from revision 2 (`varchar(255)`) |
| `CG-S3-05` | already in the contract | `POST /accounting/fx-rates/search` (`accounting.fx_rate.read`) serves the unfiltered recent-rates load |
| `CG-S3-06` | already in the contract | `CreateDimensionTypeDto.dimensionTypeCode` maps to the read field `typeCode` (`02_DTOs.md` §13.1 rule 1); the frozen-slot refusal is `409 ACCOUNTING.DIMENSION.SLOT_FROZEN` |
| `CG-S3-07 (1)` | dropped (false) | No lookup route: `GET /accounting/journals` with `JournalListQueryDto` serves the picker; `isActive?` was added to the query (`D-770`) |
| `CG-S3-07 (2)` | closed by D-770 | `UpdateJournalDto = PartialType(CreateJournalDto)` plus `isActive?`, with the documented `SEQUENCE_FROZEN` rule |
| `CG-S3-07 (3)` | dropped (false) | `emailAlias` at 64 characters is stricter than its `varchar(160)` column, which DTOs §1 allows |
| `CG-S3-08` | closed by D-771 | One upsert `If-Match` rule (Context §8 item 3) for settings, role assignments and posting profiles; marker `@IfMatchRequired({ upsert: true })` |
| `CG-S3-09` | deferred to stage 4 (P24/P25 definition of ready) | Payment-terms, statement, dunning and payment-method pickers stay disabled in stage 1; the party display label is covered by `PartyFinanceProfileLookupItemDto` (`D-770`, `CG-RPT-06`) |
| `CG-S3-10 (1)` | already in the contract | `onCreditHold` is derived from the active `acc_credit_holds` row; meaningful only after P24 |
| `CG-S3-10 (2)` | duplicate of CG-S2-11 | `nextValue` is withheld from the number-sequence DTOs (`D-770`) |
| `CG-S3-11` | already in the contract | Gateway row per route (`D-210`) ships with the controllers (P13.T03.S6, P13.T04.S8); import routes arrive with P17.T06.S3 |
| `CG-17` | dropped (constraint, not a gap) | Custom fields and credit insurance stay excluded from the MVP screens |
