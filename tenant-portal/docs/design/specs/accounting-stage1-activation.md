# Stage-1 Screen Specification — `SCR-01` Company Activation Wizard & Readiness Gates

> **Lead review, 1 November 2026 (P03.T09).** Three references were corrected: the tax rule read is `accounting.tax_rule_set.read`, and the e-invoice and e-receipt features are `accounting.documents.einvoice_eg` and `accounting.documents.ereceipt_eg`. Every route, permission, feature key and scope below was checked against `docs/LLD/accounting-app/02_API_Contracts/02_Endpoint_Catalogue.md` and `04_Static_Data/05_Permissions_and_Features.md`; what the contracts lack stays in the contract gap list for `P03.T11`.

- **Plan task:** `P03.T09.S1` (`backend/docs/plans/accounting-app-plan-p03-ux-foundation.md`)
- **Inventory row:** `SCR-01` (`frontend/tenant-portal/docs/plans/accounting-screen-inventory.md`, route `#88`)
- **Route & constant:** `/accounting/setup/company` (`TENANT_ROUTES.accountingSetupCompany`)
- **IA section:** `Setup` (`الإعدادات والتهيئة`) — Module `01` Ledger Foundation (`LFO`)
- **Primary feature gate:** `accounting.ledger.core` (sub-surface `company-tax-regimes` additionally gated by `accounting.tax.engine`; Wave-2 ledger creation gated by `accounting.ledger.multi_ledger`; second-country pack adoption gated by `accounting.platform.multi_country`)
- **Scope target:** `COMPANY` primary (`TENANT` on country-pack catalogue reads and shared-chart reads; `COMPANY_OR_BRANCH` on branch-fiscal-profile list; `BRANCH` on branch-fiscal-profile detail/create/update)
- **Verification & design baseline:** `2026-11-01` — verified against `02_Endpoint_Catalogue.md` §3, `02_DTOs.md` §4 & §13.1, `01_Enums.md`, `04_Errors_and_Constants.md`, `01_Foundation_Tables.md`, `01_User_Journey_Company_Activation.md` (`ACT-01`..`ACT-14`), `01_ledger_foundation.md` (`UC-LFO-1`), `16_Regulatory_Requirements_EG.md` §11.3, and approved foundation specs (`accounting-ia.md`, `accounting-home.md`, `accounting-status-and-a11y.md`, `accounting-patterns-data.md`, `accounting-patterns-workflow.md`, `accounting-patterns-documents.md`).

---

## 1. Screen Identity, Lifecycle Modes & URL State

`/accounting/setup/company` is the single entry and governance workspace for a Core company's accounting books (`UC-LFO-1`). Per `accounting-ia.md` §5, it introduces **no child sub-routes**; instead, its presentation transitions deterministically between two server-driven modes based on `GET /api/tenant/accounting/v1/company-profile`:

| Mode | Entry Condition (`GET /company-profile`) | User Journey Coverage | URL Query State | Primary Header Action (sole `primary` button on screen) |
| --- | --- | --- | --- | --- |
| **Mode A — Pre-Activation Guided Wizard** | `404` with `errorCode === 'ACCOUNTING.PROFILE.NOT_FOUND'` (`D-508`). Treated as the **unactivated company state**, never `NotFoundState`. | `ACT-01`..`ACT-06` (pack selection, functional currency & calendar, chart/ledger defaults, tax regime & statutory profile, atomic activation review). | `?step=1\|2\|3\|4\|5` (defaults to `1`; guarded so Step `N` requires Steps `1..N-1` valid in wizard draft state). | Steps `1..4`: `t.accounting.activation.nextStep` (`primary` in `PageHeader`); Step `5`: `t.accounting.activation.activateCta` (`primary` in `PageHeader`, gated by `accounting.profile.activate`). |
| **Mode B — Post-Activation Readiness Gates & Company Workspace** | `200 OK` returning `CompanyProfileDetailDto` + weak representation `ETag`. The edit version is `data.version`. | `ACT-06`..`ACT-14` (10 readiness gates with handoff links, profile updates & post-posting freeze visibility, tax regimes, branch fiscal profiles, primary ledger, country pack adoptions, effective-dated settings & legal interim policy acknowledgements). | `?tab=readiness\|profile\|tax-regimes\|branches\|ledgers\|country-packs\|settings` (defaults to `readiness`). | Contextual to active tab in `PageHeader` (at most one `primary` button visible at once; omitted when the active tab has no top-level create/save CTA or user lacks write permission). |

### 1.1 Architectural Invariants Enforced on `SCR-01`

1. **Zero Premature Writes (`ACT-01`, `ACT-02`, `D-508`):** Browsing `/accounting/setup/company`, advancing through Wizard Steps `1..4`, or clicking **Cancel** writes **zero** Accounting rows. Only confirming Step `5` (`POST /api/tenant/accounting/v1/company-profile/activate`) runs the 10-step single-transaction activation (`01_ledger_foundation.md` §8 rule 9).
2. **Company-Pinned Context (`accounting-ia.md` §2):** `AccountingScopeBar` renders with Company selector active; switching Company in `AccountingScopeBar` re-runs `GET /company-profile` for the newly selected `x-mutakamel-company-id` and resets unsaved wizard/form state (after `ConfirmActionModal` if dirty). On Tab `4` (`branches`), selecting a row or opening the create/edit drawer binds the explicit `branchId` into `TenantApiRequestConfig.branchId` (`x-mutakamel-branch-id`) as required by `BRANCH`-scoped routes (`D-550`).
3. **Post-Posting Structural & Currency Freeze (`D-007`, `D-510`, `01_Foundation_Tables.md` lines 81–82):** Once `profile.firstPostingAt !== null` (or `profile.currencyFrozen === true`), `functionalCurrencyCode`, `timezone`, `chart.id`, `fiscalCalendar.id`, and `accountingActivatedOn` render as `<Field readOnly>` with full contrast and an inline localized freeze reason — never unexplained `disabled` controls (`accessibility.md` line 220). `countryCode` is always `<Field readOnly>` because Core `companies.country_code` is authoritative (`D-073`).
4. **Role-Free Predicates (`accounting-ia.md` §3 Rule 1):** Visibility and editability test exact permission strings from `/auth/me` (`adminCan` / tenant permission helper) and tenant feature keys — never role names.
5. **Hidden vs Disabled Discipline (`accounting-ia.md` §3 Rules 2–6):**
   - Unentitled `accounting.tax.engine` hides the `tax-regimes` tab trigger; navigating directly to `?tab=tax-regimes` renders an inline entitlement boundary card (`ACCOUNTING.FEATURE.NOT_ENTITLED`) inside the tab panel.
   - Wave-2 reserved capabilities (`POST /ledgers` under `accounting.ledger.multi_ledger`, `CalendarType.HIJRI` / `RETAIL_4_4_5`, `PeriodPattern.FOUR_FOUR_FIVE` / `FOUR_FIVE_FOUR` / `FIVE_FOUR_FOUR`, `CogsRecognition.AT_PURCHASE`, Wave-2 settings `assets.revaluation_election.*` and `direct_debit.*`) follow `accounting-ia.md` §3 Rule 3: Wave-2 enum options that the MVP backend rejects (`D-665`, `D-705`) are rendered as non-selectable/disabled items with a one-line Wave-2 reason, and `+ Add Ledger` renders as a disabled `secondary` button with a visible one-line Advanced Wave 2 reason (`t.accounting.ledgers.multiLedgerWave2Reason`).
6. **Zero Client Arithmetic & Strict Wire Fidelity:** Every identifier (`id`, `companyId`, `packVersionId`, `contentHash`, `registryVersion`, `policyTextHash`, `correlationId`, `code`, `timezone`, `ISODate`) renders inside `<IdentifierText>` (`<bdi dir="ltr">`) or inputs with `dir="ltr"`. Decimal settings (`settlement.rounding_tolerance`) use `<MoneyInput>` / `DecimalString` without `Number()` conversion. Every write generates a fresh UUIDv7 `x-idempotency-key` via `generateUUIDv7` (`src/lib/uuid.ts`, never `crypto.randomUUID()`) per user intent and reuses it across retries of that exact intent (`D-768`).

---

## 2. File & Custom Hook Decomposition (`< 300` Lines Rule)

Following `docs/architecture/file-architecture.md` (logic in `hooks/use<Name>.ts`, `.tsx` views strictly markup + Tailwind logical utilities, `< 300` lines per file, named exports except `page.tsx`):

```text
src/app/(tenant)/accounting/setup/company/
  page.tsx                                    # Route entry (~60 lines): AccountingBoundaryGate + CompanySetupScreen
src/features/accounting/company-setup/
  CompanySetupScreen.tsx                      # Mode switch (Wizard vs Workspace), PageHeader, ScopeBar (~190 lines)
  validators/
    company-setup-validators.ts               # Runtime boundary validators for all SCR-01 DTOs (unknown -> typed DTO)
  hooks/
    useCompanySetupMode.ts                    # GET /company-profile probe, 404 PROFILE.NOT_FOUND -> Wizard, data.version for edits
    useCompanyActivationWizard.ts             # 5-step state, step validation, UUIDv7 idempotency, POST /activate, timeout recovery
    useCompanyReadinessGates.ts               # GET /company-profile/readiness, handoff link builder, manual refresh
    useCompanyProfileForm.ts                  # PATCH /company-profile + If-Match + 409 ConflictDialog + freeze predicates
    useCompanyTaxRegimesTab.ts                # GET/POST/PATCH /company-tax-regimes + LAW_6_2025 lock/exit validation
    useBranchFiscalProfilesTab.ts             # GET/POST/PATCH /branch-fiscal-profiles + BRANCH header injection
    useCompanyLedgersTab.ts                   # GET/PATCH /ledgers + Wave-2 multi_ledger gate state
    useCountryPacksTab.ts                     # GET packs/versions/manifest/adoptions + POST /:versionId/adopt
    useCompanySettingsTab.ts                  # GET/PATCH /settings/:key + POST interim-policy acknowledge/withdraw
  components/
    ActivationWizardView.tsx                  # Stepper + no-op banner + step router (~180 lines)
    WizardStepCountryPack.tsx                 # Step 1: Core company summary + pack/version selector + manifest sheet trigger
    WizardStepCurrencyCalendar.tsx            # Step 2: functionalCurrencyCode, timezone, accountingActivatedOn, calendar
    WizardStepChartAndDefaults.tsx            # Step 3: chartTemplateCode vs shared chartId, cogsRecognition, reversalMethod, maxBackdateDays
    WizardStepTaxAndStatutory.tsx             # Step 4: CreateCompanyTaxRegimeDto + legalForm, activityCode, taxOfficeCode, flags
    WizardStepReviewActivate.tsx              # Step 5: 10-step atomic summary, freeze ack checkbox, AmbiguousOutcomePanel slot
    ReadinessGatesTabView.tsx                 # Tab 1: ready summary card + 10 ACT-14 gate rows with fix & Link handoffs
    CompanyProfileTabView.tsx                 # Tab 2: post-activation profile form + CurrencyFreezeBanner + ConflictDialog
    CompanyTaxRegimesTabView.tsx              # Tab 3: TableView + Create/Edit FormDrawer + LAW_6_2025 lock notice
    BranchFiscalProfilesTabView.tsx           # Tab 4: TableView + Branch selector + 10-field AuthorityAddressInput drawer
    CompanyLedgersTabView.tsx                 # Tab 5: PRIMARY ledger TableView + EditDrawer + disabled Wave-2 CTA
    CountryPacksTabView.tsx                   # Tab 6: Adoptions table + Pack catalogue + 14-component ManifestSheet + AdoptModal
    CompanySettingsTabView.tsx                # Tab 7A: Typed setting cards/drawers (rounding, cooling, cutoff, series, tax_return)
    LegalInterimPoliciesSection.tsx           # Tab 7B: L-READY-03/04/05/07 ack/withdraw cards + L-READY-08 info row
```

---

## 3. Reused Design-System & Accounting Foundation Components

All UI primitives and patterns are imported exclusively from `@/design-system` and the approved Stage-0 accounting foundation modules (`src/features/accounting/shared/`):

| Component | Source | Usage on `SCR-01` |
| --- | --- | --- |
| `AccountingBoundaryGate` / `useAccountingBoundaryGate` | `accounting-patterns-documents.md` | Wraps `/accounting/setup/company` for `NOT_ENTITLED` (`accounting.ledger.core`), `RECOVERY_MODE` (`403 ACCOUNTING.FEATURE.RECOVERY_MODE`), `TENANT_MAINTENANCE` (`503`), `DUNNING` / `READ_ONLY` access modes, and missing `accounting.profile.read` (`PermissionGate`). |
| `AccountingScopeBar` | `accounting-ia.md` §2 | Sticky sub-header displaying active Core Company (`countryCode` badge, functional currency badge once activated) and fiscal year/period indicator (shows `Unactivated / غير مفعّلة` badge in Mode A). |
| `PageHeader` | `@/design-system` (`patterns.md`) | Breadcrumb (`Accounting / Setup / Company Setup`), screen title, status badge (`Activated` / `Unactivated` / `Readiness: 7/10`), secondary actions, and **at most one** `primary` CTA. |
| `Stepper` | `@/design-system` (`patterns.md`) | Mode A 5-step horizontal progress indicator (`neutral` active step, `positive` completed steps, `ink` upcoming steps — never multi-hue stage colors). Collapses to compact `"Step X of 5"` pill + progress bar at `375px`. |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | `@/design-system` | Mode B 7-tab workspace wired through `DirectionBridge` so `ArrowRight`/`ArrowLeft` reverse automatically in RTL (`accessibility.md` line 112). |
| `DetailSection`, `Field`, `FieldGroup` | `@/design-system` (`patterns.md`) | Structured 2-column (`lg:grid-cols-2`, single-column `< md`) form and read-only inspection groups with inline `error`, `hint`, and `readOnly` reason lines. |
| `TableView`, `DataTable`, `FilterBar` | `@/design-system` (`views.md`, `patterns.md`) | Used on `tax-regimes`, `branches`, `ledgers`, `country-packs` (adoptions & versions), and `settings`. `FilterBar` sets `hideSearch` on resources whose Endpoint Catalogue row has no server `POST /search` or `q` query (`company-tax-regimes`, `branch-fiscal-profiles`, `ledgers`, `country-packs`, `settings`). |
| `FormDrawer`, `EditDrawer` | `@/design-system` (`patterns.md`) | Slide-over sheet from logical `end` (`inset-inline-end-0`) for creating/editing tax regimes, branch fiscal profiles, ledger metadata, country pack manifest inspection, and typed settings. |
| `ConfirmActionModal` | `@/design-system` (`patterns.md`) | Confirms Step 5 atomic company activation, superseding country pack adoption, legal interim policy acknowledgement, and legal interim policy withdrawal (`caution`/`destructive` consequence copy). |
| `ConflictDialog` | `@/design-system` (`accounting-patterns-workflow.md`) | Handles `409` optimistic concurrency (numeric `If-Match` version mismatch) on `PATCH /company-profile`, `PATCH /company-tax-regimes/:id`, `PATCH /branch-fiscal-profiles/:id`, `PATCH /ledgers/:id`, and `PATCH /settings/:key`, showing latest server values vs local edits. |
| `AmbiguousOutcomePanel` & `WaitingStateBadge` | `accounting-patterns-workflow.md`, `accounting-patterns-documents.md` | Shown when an idempotent command (`POST /company-profile/activate`, `POST /country-packs/:versionId/adopt`, `PATCH` writes) hits `CLIENT_REQUEST_TIMEOUT` or network drop; preserves the exact UUIDv7 `x-idempotency-key` for safe retry or state verification (`GET /company-profile`). |
| `FunctionalCurrencyFreezeBanner` | `accounting-patterns-data.md` | Persistent `info`/`caution` callout in Step 2, Step 5, and Tab 2 explaining that `functionalCurrencyCode`, `timezone`, `chartId`, `fiscalCalendarId`, and `accountingActivatedOn` freeze permanently upon the first posted journal entry (`firstPostingAt !== null`). |
| `StatusBadge`, `IdentifierText`, `Money`, `MoneyInput` | `@/design-system`, `accounting-status-and-a11y.md`, `accounting-patterns-data.md` | Outcome-role badges (`positive`, `caution`, `negative`, `pending`, `neutral`), `<bdi dir="ltr">` isolation for all codes/hashes/UUIDs/dates, and string-exact decimal editing (`settlement.rounding_tolerance`). |
| `PermissionGate`, `ReadOnlyGate`, `EmptyState`, `ErrorState`, `NotFoundState`, `DegradedBanner` | `@/design-system` (`states.md`) | Covers every non-happy state without ad-hoc alert markup. |

---

## 4. Complete Endpoint & Action Contract Matrix

Every browser call targets the Tenant Portal Gateway prefix `/api/tenant/accounting/v1/...` through `src/lib/api/axiosClient.ts` (`credentials: "include"`, HttpOnly cookie auth, `SuccessResponseDto<T>` envelope `{ success, data, meta?, correlationId, timestamp }`). **Never** call controller-relative `/accounting/...` paths directly.

### 4.1 Primary `[P]` Accounting Endpoints Owned by `SCR-01` (25 Catalogue Rows)

| # | Method | Browser Gateway Path | Permission | Feature Key | Scope Target | Idempotency | Concurrency | Request DTO / Query | Response (`data` + Status) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `GET` | `/api/tenant/accounting/v1/company-profile` | `accounting.profile.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | — | `200` + weak representation `ETag` (`CompanyProfileDetailDto`); bodyless `304` for a matching conditional request; `404 ACCOUNTING.PROFILE.NOT_FOUND` pre-activation |
| 2 | `PATCH` | `/api/tenant/accounting/v1/company-profile` | `accounting.profile.update` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `UpdateCompanyProfileDto` | `200` + `ETag` (`CompanyProfileDetailDto`) |
| 3 | `POST` | `/api/tenant/accounting/v1/company-profile/activate` | `accounting.profile.activate` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `none` | `ActivateCompanyProfileDto` | `200` + `Location` + `ETag` (`CompanyActivationResultDto`) |
| 4 | `GET` | `/api/tenant/accounting/v1/company-profile/readiness` | `accounting.profile.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | — | `200` (`CompanyReadinessDto`: 10 ordered `ACT-14` gates) |
| 5 | `GET` | `/api/tenant/accounting/v1/company-tax-regimes` | `accounting.profile.read` | `accounting.tax.engine` | `COMPANY` | `none` | `none` | `FindManyDto` (`page`, `limit`, `sort`) | `200` (`CompanyTaxRegimeSummaryDto[]` + `meta`) |
| 6 | `GET` | `/api/tenant/accounting/v1/company-tax-regimes/:id` | `accounting.profile.read` | `accounting.tax.engine` | `COMPANY` | `none` | `none` | — | `200` + `ETag` (`CompanyTaxRegimeDetailDto`) |
| 7 | `POST` | `/api/tenant/accounting/v1/company-tax-regimes` | `accounting.profile.update` | `accounting.tax.engine` | `COMPANY` | `x-idempotency-key` | `none` | `CreateCompanyTaxRegimeDto` | `201` + `Location` (`CompanyTaxRegimeDetailDto`) |
| 8 | `PATCH` | `/api/tenant/accounting/v1/company-tax-regimes/:id` | `accounting.profile.update` | `accounting.tax.engine` | `COMPANY` | `x-idempotency-key` | `If-Match` | `UpdateCompanyTaxRegimeDto` | `200` + `ETag` (`CompanyTaxRegimeDetailDto`) |
| 9 | `GET` | `/api/tenant/accounting/v1/branch-fiscal-profiles` | `accounting.profile.read` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | `none` | `none` | `FindManyDto` | `200` (`BranchFiscalProfileSummaryDto[]` + `meta`; omits `jsonb` `addressSnapshot` per `02_DTOs.md` §13.1 R4) |
| 10 | `GET` | `/api/tenant/accounting/v1/branch-fiscal-profiles/:id` | `accounting.profile.read` | `accounting.ledger.core` | `BRANCH` | `none` | `none` | Requires `x-mutakamel-branch-id` | `200` + `ETag` (`BranchFiscalProfileDetailDto` incl. `addressSnapshot`) |
| 11 | `POST` | `/api/tenant/accounting/v1/branch-fiscal-profiles` | `accounting.profile.update` | `accounting.ledger.core` | `BRANCH` | `x-idempotency-key` | `none` | `CreateBranchFiscalProfileDto` (`x-mutakamel-branch-id` = `branchId`) | `201` + `Location` (`BranchFiscalProfileDetailDto`) |
| 12 | `PATCH` | `/api/tenant/accounting/v1/branch-fiscal-profiles/:id` | `accounting.profile.update` | `accounting.ledger.core` | `BRANCH` | `x-idempotency-key` | `If-Match` | `UpdateBranchFiscalProfileDto` (`x-mutakamel-branch-id` = row `branchId`) | `200` + `ETag` (`BranchFiscalProfileDetailDto`) |
| 13 | `GET` | `/api/tenant/accounting/v1/ledgers` | `accounting.profile.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `LedgerListQueryDto` (`kind?`, `accountingPrinciple?`) | `200` (`LedgerSummaryDto[]` + `meta`) |
| 14 | `GET` | `/api/tenant/accounting/v1/ledgers/:id` | `accounting.profile.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | — | `200` + `ETag` (`LedgerDetailDto`) |
| 15 | `POST` | `/api/tenant/accounting/v1/ledgers` | `accounting.profile.update` | `accounting.ledger.multi_ledger` `(A)` | `COMPANY` | `x-idempotency-key` | `none` | `CreateLedgerDto` (**Reserved Wave 2 — never invoked in MVP UI**) | `reserved (wave 2)` — button rendered `disabled` with Wave-2 reason |
| 16 | `PATCH` | `/api/tenant/accounting/v1/ledgers/:id` | `accounting.profile.update` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `UpdateLedgerDto` | `200` + `ETag` (`LedgerDetailDto`) |
| 17 | `GET` | `/api/tenant/accounting/v1/country-packs` | `accounting.country_pack.read` | `accounting.ledger.core` | `TENANT` | `none` | `none` | `CountryPackListQueryDto` (`countryCode?`, `status?`) | `200` (`CountryPackSummaryDto[]` + `meta`) |
| 18 | `GET` | `/api/tenant/accounting/v1/country-packs/:packCode/versions` | `accounting.country_pack.read` | `accounting.ledger.core` | `TENANT` | `none` | `none` | `FindManyDto` | `200` (`CountryPackVersionSummaryDto[]` + `meta`) |
| 19 | `GET` | `/api/tenant/accounting/v1/country-packs/versions/:versionId` | `accounting.country_pack.read` | `accounting.ledger.core` | `TENANT` | `none` | `none` | — | `200` + `ETag` (`CountryPackVersionDetailDto` incl. `manifest`, `gateResults`, `fxRateProviderCode`) |
| 20 | `POST` | `/api/tenant/accounting/v1/country-packs/:versionId/adopt` | `accounting.country_pack.adopt` | `accounting.ledger.core` (+ `accounting.platform.multi_country` when adopting a 2nd distinct `COUNTRY` pack) | `COMPANY` | `x-idempotency-key` | `none` | `AdoptCountryPackDto` | `201` + `Location` (`CountryPackAdoptionDetailDto`) |
| 21 | `GET` | `/api/tenant/accounting/v1/country-packs/adoptions` | `accounting.country_pack.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `FindManyDto` | `200` (`CountryPackAdoptionSummaryDto[]` + `meta`) |
| 22 | `GET` | `/api/tenant/accounting/v1/settings` | `accounting.setting.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | `SettingListQueryDto` (`scopeTarget?`, `key?`, `effectiveOn?`) | `200` (`SettingSummaryDto[]` + `meta`; omits `jsonb` `value` per §13.1 R4) |
| 23 | `GET` | `/api/tenant/accounting/v1/settings/:key` | `accounting.setting.read` | `accounting.ledger.core` | `COMPANY` | `none` | `none` | — | `200` + `ETag` (`SettingDetailDto` incl. `value`) |
| 24 | `PATCH` | `/api/tenant/accounting/v1/settings/:key` | `accounting.setting.update` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `UpsertSettingDto` | `200` + `ETag` (`SettingDetailDto`; `legal.interim_policy_ack.*` refused `422`) |
| 25 | `POST` | `/api/tenant/accounting/v1/settings/legal-interim-policies/:code/acknowledge` | `accounting.setting.manage` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `none` | `AcknowledgeLegalInterimPolicyDto` (`policyVersion`, `policyTextHash`) | `200` (`SettingDetailDto` for `legal.interim_policy_ack.<code>`) |
| 26 | `POST` | `/api/tenant/accounting/v1/settings/legal-interim-policies/:code/withdraw` | `accounting.setting.manage` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `none` | Empty body `{}` | `204 No Content` |

*(Note: Row 15 `POST /ledgers` is the reserved Wave-2 row in Endpoint Catalogue §3 line 144; Rows 1–14 and 16–26 are the 25 active `[P]` endpoints reconciled in `accounting-screen-inventory.md` for `SCR-01`.)*

### 4.2 Shared `[S]` Accounting & Core Reference Reads Consumed by `SCR-01`

| Method | Browser Gateway Path | Permission | Feature Key | Scope Target | Purpose on `SCR-01` |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/tenant/accounting/v1/charts` | `accounting.chart.read` | `accounting.ledger.core` | `TENANT` | Wizard Step 3 & Tab 2 pre-posting picker for joining an existing shared chart (`shared=true`, `countryCode` matching Core company) via `chartId`. |
| `GET` | `/api/tenant/accounting/v1/fiscal-calendars` | `accounting.calendar.read` | `accounting.ledger.core` | `COMPANY` | Tab 2 pre-posting `fiscalCalendarId` picker and calendar detail display (`yearStartMonth`, `yearStartDay`, `periodPattern`). |
| `GET` | `/api/tenant/accounting/v1/account-roles` | `accounting.account.read` | `accounting.ledger.core` | `COMPANY` | Tab 1 (`readiness`) Gate #3 (`account roles resolved`) count badge and quick unresolved-slot preview before jumping to `SCR-02`. |
| `GET` | `/api/tenant/core/v1/companies/:id` | Core company read (session scope) | Core | `COMPANY` | Authoritative `company.name`, `company.countryCode` (`D-073`), and default display metadata shown read-only in Step 1 and `AccountingScopeBar`. |
| `GET` | `/api/tenant/core/v1/branches` | Core branch read (session scope) | Core | `COMPANY` | Populates the Core Branch selector (`branchId`) in Tab 4 (`BranchFiscalProfilesTabView`). |
| `GET` | `/api/tenant/core/v1/currencies` | Core currency read | Core | `TENANT` | Populates ISO 4217 `functionalCurrencyCode` selector (`CurrencyCode`) in Step 2 and Tab 2 (pre-posting). |

---

## 5. Mode A — Pre-Activation Wizard (`ACT-01`..`ACT-06`, `UC-LFO-1`)

### 5.1 Wizard Layout & Chrome

- **Top bar:** `AccountingScopeBar` pinned to the selected Core Company, displaying `<StatusBadge tone="neutral">` `غير مفعّلة / Not activated`.
- **PageHeader:**
  - Title: `تفعيل المحاسبة للشركة / Activate Company Accounting`
  - Subtitle: Names the active Core Company and its authoritative ISO country code (`<IdentifierText>{company.countryCode}</IdentifierText>`).
  - Secondary action (`Button variant="secondary"`): `إلغاء والعودة / Cancel` -> navigates to `/accounting` (`SCR-00`) with zero server writes (`ACT-02`). If the operator has entered draft inputs in Steps `1..4`, prompts `ConfirmActionModal` ("Discard unsaved setup choices? Nothing has been created on the server.").
  - Primary action (`Button variant="primary"` — **sole `primary` button on screen**):
    - Steps `1..4`: `الخطوة التالية / Next step` (validates current step client-side and advances `?step=N+1`).
    - Step `5`: `تفعيل المحاسبة الآن / Activate accounting now` (opens final irreversible-freeze `ConfirmActionModal` and dispatches `POST /api/tenant/accounting/v1/company-profile/activate`; hidden via `ReadOnlyGate` / disabled if actor lacks `accounting.profile.activate`).
- **Pre-Activation No-Op Banner (`ACT-01`, `ACT-02`):** Compact `info` callout directly below `PageHeader`: *"لا يتم إنشاء أي دفاتر أو سنوات مالية أو قيود أثناء التنقل بين الخطوات. يتم الحفظ والتفعيل دفعةً واحدة عند التأكيد في الخطوة 5." / "No ledgers, fiscal years, or journals are created while stepping through this wizard. Activation runs atomically only when confirmed in Step 5."*
- **Stepper (`@/design-system`):** 5 clickable/completed steps (`1. Country Pack`, `2. Currency & Calendar`, `3. Chart & Ledger Rules`, `4. Tax Regime & Statutory Profile`, `5. Review & Activate`). Bottom wizard bar contains only `Button variant="ghost"` (`السابق / Previous`) and a step counter (`1/5`) so `PageHeader` holds the single `primary` button on the viewport.

### 5.2 Complete Wizard Field-to-DTO Mapping (`ActivateCompanyProfileDto`)

Every field below maps 1:1 to `ActivateCompanyProfileDto` (`02_DTOs.md` §4.2 lines 116–139). Forbidden fields (`companyId`, `countryCode`, `tenantId`, `id`, `version`, `primaryLedgerId`, `firstPostingAt`) are **never** sent in the request payload (`02_DTOs.md` §4.7).

#### Step 1 — Country Pack & Legislative Baseline (`ACT-02`)

Reads `GET /api/tenant/accounting/v1/country-packs?status=PUBLISHED` and `GET /api/tenant/accounting/v1/country-packs/:packCode/versions`, plus `GET /api/tenant/accounting/v1/country-packs/versions/:versionId` for the selected version.

| UI Control | DTO Path | Type & Constraints | Default & Domain Rule |
| --- | --- | --- | --- |
| Core Company Name | *(Core read-only)* | `string` (`<Field readOnly>`) | From Core `companies` context (`x-mutakamel-company-id`). |
| Company Country (`countryCode`) | *(Core read-only, never sent)* | `CountryCode` (`ISO 3166-1 alpha-2`, `<IdentifierText>`) | Copied server-side from Core `companies.country_code` (`D-073`). Displayed with a lock explanation. |
| Country Pack & Version | `packVersionId` | `UUID` (**required**) | Filters published, non-retired versions where `pack.countryCode === company.countryCode`; if **no** published country pack is in force on `accountingActivatedOn`, offers the `BASE` pack (`packKind = 'BASE'`, `countryCode = null`) (`D-507`, `D-722`, `D-750`). Selecting `BASE` when a country pack exists is blocked in UI and refused by server (`ACCOUNTING.PACK.COUNTRY_PACK_AVAILABLE`). |
| Exchange-Rate Provider Chain Head | *(Derived from pack version)* | `FxRateProvider` (`<IdentifierText>`) | Read-only display from `CountryPackVersionDetailDto.fxRateProviderCode` (e.g. `CBE` for `EG` v1 with `MID` side disclosure `L-READY-08`; `MANUAL` for `BASE`, `D-756`, `D-757`). |
| Inspect 14-Component Manifest | *(Drawer trigger)* | Read-only `FormDrawer` | Opens `CountryPackVersionDetailDto.manifest` (`JURISDICTION_TREE` .. `ACCEPTANCE_TESTS`), `legislativeSourceRef`, `contentHash`, and `gateResults` (`G1_SCHEMA`..`G12_TENANT_FORK_ISOLATION`). |
| Blast-Radius / Adoption Acknowledgement | `blastRadiusAck` | Literal `true` (**required**) | Checkbox required to proceed; on initial activation (`0` prior documents), `replayDiffRef` is omitted (server records `documentsAffected: 0, replayDiffRef: null`, `D-061`, `D-668`). |

#### Step 2 — Functional Currency, Timezone & Fiscal Calendar (`ACT-03`)

Renders `FunctionalCurrencyFreezeBanner` (`accounting-patterns-data.md`) at the top of the card.

| UI Control | DTO Path | Type & Constraints | Default & Domain Rule |
| --- | --- | --- | --- |
| Functional Currency | `functionalCurrencyCode` | `CurrencyCode` (`^[A-Z]{3}$`, **required**) | Defaults to pack/country currency (e.g. `EGP` for `EG`). **Irreversible** after first posted entry (`ACCOUNTING.PROFILE.CURRENCY_FROZEN`, `D-007`). |
| Company Timezone | `timezone` | `IanaTimezone` (max `64` chars, `dir="ltr"`, **required**) | Searchable IANA picker (defaults to `Africa/Cairo` for `EG`). Frozen after first posting (`ACCOUNTING.PROFILE.STRUCTURE_FROZEN`, `D-510`). |
| Accounting Activation Date (Opening Date) | `accountingActivatedOn` | `ISODate` (`YYYY-MM-DD`, `dir="ltr"`, **required**) | Opening-balance date (`period 0 OPENING`) and start of the first `FUTURE` fiscal year; **must** fall on a `NORMAL`-period boundary of `calendar` (`D-077`, `D-332`), else `422 ACCOUNTING.PROFILE.ACTIVATION_DATE_IN_PERIOD`. Client helper previews the computed `NORMAL` period boundaries for the chosen `yearStartMonth`/`yearStartDay`/`periodPattern` so invalid dates are flagged inline before Step 5. |
| Calendar Code | `calendar.code` | `string` (`^[A-Z0-9][A-Z0-9_-]{1,31}$`, `dir="ltr"`, **required**) | Normalized uppercase on blur; default `MAIN_CAL` (or `EG_CAL`). |
| Calendar Name (Arabic) | `calendar.nameI18n.ar` | `string` (non-empty, **required**) | Default `التقويم المالي الرئيسي`. |
| Calendar Name (English) | `calendar.nameI18n.en` | `string` (optional, trimmed) | Default `Main Fiscal Calendar`. |
| Calendar Type | `calendar.calendarType` | `CalendarType` (**required**) | `GREGORIAN` selected. `HIJRI` and `RETAIL_4_4_5` render disabled with Wave-2 badge & explanation (`D-705`). |
| Period Pattern | `calendar.periodPattern` | `PeriodPattern` (**required**) | Radio/Select: `MONTHLY` (default) or `QUARTERLY`. Retail `FOUR_FOUR_FIVE`, `FOUR_FIVE_FOUR`, `FIVE_FOUR_FOUR` render disabled with Wave-2 explanation (`D-705`, `D-764`). |
| Fiscal Year Start Month | `calendar.yearStartMonth` | `number` (integer `1..12`, **required**) | Default from pack (`1` January or `7` July; any month `1..12` allowed, `D-705`). |
| Fiscal Year Start Day | `calendar.yearStartDay` | `number` (integer `1..31`, **required**) | Validated against `yearStartMonth` (default `1`). |

#### Step 3 — Chart of Accounts & Ledger Defaults (`ACT-03`, `ACT-04`)

| UI Control | DTO Path | Type & Constraints | Default & Domain Rule |
| --- | --- | --- | --- |
| Chart Provisioning Mode | *(UI radio: `TEMPLATE` vs `SHARED_CHART`)* | Mutually exclusive (`chartTemplateCode` XOR `chartId`) | Enforces `02_DTOs.md` lines 120–121 (`excludes chartId` / `excludes chartTemplateCode`). |
| Pack Chart Template Code | `chartTemplateCode` | `string` (optional, max `64` chars, `dir="ltr"`) | Active when mode = `TEMPLATE`. Selects a template shipped by the chosen pack version (list them with `GET /accounting/chart-templates`, filtered client-side by the chosen pack's `packCode` and `packVersion`; `CG-SCR01-03` is an existing route). Omitted when mode = `SHARED_CHART`. |
| Existing Shared Tenant Chart | `chartId` | `UUID` (optional) | Active when mode = `SHARED_CHART` (requires `accounting.chart.read`). Populated from `GET /api/tenant/accounting/v1/charts?shared=true&countryCode=<company.countryCode>`. Joins the shared chart and seeds company-level role rows (`D-064`, `D-067`). |
| COGS Recognition Timing | `cogsRecognition` | `CogsRecognition` (**required**) | `AT_DELIVERY` selected (`D-179`, `D-665`). `AT_PURCHASE` renders disabled with one-line Wave-2 note (`ck_acc_company_profiles_cogs_recognition_mvp`). |
| Reversal Method | `reversalMethod` | `ReversalMethod` (optional, default `SWAP_SIDES`) | Radio cards with accounting explanation: `SWAP_SIDES` (swaps debit/credit sides) vs `STORNO` (negative-amount / red-ink storno reversal, `D-219`). |
| Max Backdate Window (Days) | `maxBackdateDays` | `number` (integer `0..3650`, optional, default `5`) | Numeric input (`dir="ltr"`, `0..MAX_BACKDATE_DAYS_CEILING`); postings into an `OPEN` `NORMAL` period older than `businessDate - maxBackdateDays` require a period override (`D-022`, `D-325`). |
| Group Reporting Currency *(Wave 2)* | `groupCurrencyCode` | `CurrencyCode` (optional) | **Hidden** when `accounting.ledger.multi_ledger` is unentitled (`accounting-ia.md` §3 Rule 2); when entitled, optional ISO 4217 picker (`D-009`). |

#### Step 4 — Tax Regime & Statutory Company Profile (`ACT-04`)

| UI Control | DTO Path | Type & Constraints | Default & Domain Rule |
| --- | --- | --- | --- |
| Tax Regime | `taxRegime.taxRegime` | `TaxRegime` (`STANDARD \| LAW_152_2020 \| LAW_6_2025`, **required**) | Default `STANDARD`. Selecting `LAW_6_2025` displays a `caution` commitment banner explaining that the server computes `lockedUntil = effectiveFrom + small_taxpayer_regime_lock_years` and blocks early exit without authority `exitEvidenceRef` (`D-120`, `D-327`, `D-651`). |
| Regime Effective From | `taxRegime.effectiveFrom` | `ISODate` (`dir="ltr"`, **required**) | Defaults to `accountingActivatedOn`. |
| Regime Effective To | `taxRegime.effectiveTo` | `ISODate` (optional, `> effectiveFrom`) | Optional half-open end date (`ck_acc_company_tax_regimes_range`). |
| Regime Evidence Reference | `taxRegime.evidenceRef` | `string` (max `256` chars, **required**) | Tax card, authority registration letter, or gazette reference (`D-120`). |
| Exempt from WHT as Payee | `taxRegime.exemptAsPayee` | `boolean` (optional, strict boolean, default `false`) | Checkbox (`D-120`): company is exempt from withholding deduction when paid by customers. |
| WHT Collection Duty as Payer | `taxRegime.withholdingDutyAsPayer` | `boolean` (optional, strict boolean, default `true`) | Checkbox: company must withhold tax when paying suppliers. |
| Legal Form | `legalForm` | `LegalForm` (enum, **required**) | Selectable from `LegalForm` (`LLC`, `JOINT_STOCK`, `SOLE_PROPRIETORSHIP`, `PARTNERSHIP`, `BRANCH_OF_FOREIGN`, `PUBLIC_ENTITY`, `OTHER`); the DTO is typed `LegalForm` and the column is `varchar(32)` (`D-101`, `D-770`; `CG-SCR01-02` closed). |
| Authority Activity Code (ISIC) | `activityCode` | `string` (max `16` chars, `dir="ltr"`, **required**) | ISIC v4 code matching `ACTIVITY_CODES` (`D-112`). Options come from `GET /accounting/authority/reference-tables/:tableCode/entries` (`tableCode = ACTIVITY_CODES`, feature `accounting.documents.einvoice_eg`, delivered with P22); until then, or when the key is not entitled, the field stays a validated text input (`CG-SCR01-04`, existing route). |
| Tax Office Code | `taxOfficeCode` | `string` (optional, max `16` chars, `dir="ltr"`) | Optional authority tax office code (`02_DTOs.md` line 132 caps at `16` chars). |
| Professional Syndicate License No. | `syndicateLicenseNumber` | `string` (optional, max `40` chars, `dir="ltr"`) | Printed on professional e-receipts where applicable (`D-112`). |
| Statutory Auditor Required | `auditorRequired` | `boolean` (optional, default `false`) | Strict boolean toggle. |
| WHT Advance-Payment Scheme | `advancePaymentScheme` | `AdvancePaymentScheme` (optional, enum `NONE` \| `ENROLLED`, default `NONE`) | Toggle that sends `ENROLLED` when on and `NONE` when off (`D-100`, `D-770`; the engine disables `ENROLLED` while the current regime is `LAW_6_2025`). |
| VAT Registration Threshold Watch | `registrationThresholdWatch` | `boolean` (optional, default `true`) | Alerts when turnover approaches statutory VAT threshold. |
| Sandbox / Test Authority Mode | `sandboxFlag` | `boolean` (optional, default `false`) | When toggled `true`, displays `caution` callout (`VAL-DOC-17`): production authority connections will warn/block if `sandboxFlag` mismatches live environment. |

#### Step 5 — Atomic Review, Freeze Confirmation & Activation (`ACT-05`, `ACT-06`)

- Renders four compact read-only `DetailSection` summary cards matching Steps `1..4` with `تعديل / Edit` jump buttons (`?step=1..4`), plus an **Atomic Seed Preview** card listing the exact artifacts `01_ledger_foundation.md` §8 rule 9 will create in one database transaction:
  1. `acc_company_profiles` row (`countryCode` from Core)
  2. `acc_company_tax_regimes` row
  3. `acc_country_pack_adoptions` row (`blastRadiusAck`)
  4. Chart of accounts instantiation (or shared chart join) + `acc_account_role_assignments`
  5. `PRIMARY` ledger (`acc_ledgers`)
  6. Fiscal calendar + first `FUTURE` fiscal year starting on `accountingActivatedOn` + `OPENING` (`period 0`), `NORMAL`, `ADJUSTMENT`, and `CLOSING` periods (all `FUTURE` until `POST /fiscal-years/:id/open` on `SCR-04`)
  7. Empty dimension set (`ACC_EMPTY_DIMENSION_SET`) + `COST_CENTER` dimension type at hot slot `1`
  8. Default pack journals (`GL`, `GJ`, `SJ`, `PJ`, `CB`, `FX`, `FA`, `CL`, `OP`) with `hashChainEnabled = true`
- **Irreversible Freeze Confirmation Checkbox (UI guard before enabling Step 5 `primary` CTA):** Operator checks *"أقرّ بأن عملة الدفاتر والمنطقة الزمنية وتاريخ التفعيل ودليل الحسابات والتقويم المالي ستُجمّد نهائياً بمجرد ترحيل أول قيد."*
- **Submission & Transition (`POST /api/tenant/accounting/v1/company-profile/activate`):**
  - Generates one `x-idempotency-key` via `generateUUIDv7()` when the user opens/confirms activation; stores `{ companyId, idempotencyKey, payloadHash, startedAt }` in `sessionStorage` until resolved (`D-768`).
  - While in flight: button shows `aria-busy="true"` + `<WaitingStateBadge>` (`جاري تفعيل الدفاتر المحاسبية... / Activating company accounting...`); all step inputs lock.
  - On `200 OK` (`CompanyActivationResultDto`): clears pending attempt evidence, stores `ETag` (`profile.version`), displays a dismissible **Activation Receipt Banner** showing created IDs (`primaryLedgerId`, `chartId`, `fiscalCalendarId`, `firstFiscalYearId`, `openingPeriodId`, and `journalIds.length` seeded journals in `<IdentifierText>`), and transitions immediately to **Mode B (`?tab=readiness`)** (`ACT-06`).
  - On `CLIENT_REQUEST_TIMEOUT` / network drop: renders `<AmbiguousOutcomePanel>` with two safe actions: **Verify Company Status** (`GET /company-profile` — if `200`, activation succeeded and UI transitions cleanly to Mode B!) and **Retry Safely with Same Key** (re-POSTs `/company-profile/activate` reusing the exact UUIDv7 `x-idempotency-key`, returning the stored `CompanyActivationResultDto` on replay per `D-508`).

---

## 6. Mode B — Post-Activation Readiness Gates & 7-Tab Workspace (`ACT-06`..`ACT-14`)

Once `GET /api/tenant/accounting/v1/company-profile` returns `200`, `SCR-01` renders a persistent company summary strip (`DetailHeader` pattern: `countryCode`, `functionalCurrencyCode` + freeze lock icon if `currencyFrozen`, `timezone`, `accountingActivatedOn`, `currentTaxRegime`, `readiness` pill `X/10`) above a 7-tab Radix `Tabs` workspace.

### 6.1 Tab 1 — Readiness Gates (`?tab=readiness`, `ACT-14`)

Calls `GET /api/tenant/accounting/v1/company-profile/readiness` (`CompanyReadinessDto`) in parallel with `GET /api/tenant/accounting/v1/account-roles` (if `accounting.account.read` is held, to enrich Gate #3 with resolved/116 count).

- **Summary Banner:**
  - When `ready === true`: `<StatusBadge tone="positive">` `جاهزة لإصدار المستندات والترحيل / Ready for live posting & documents`, timestamp `asOf` formatted via `Intl.DateTimeFormat(LOCALE[lang])`.
  - When `ready === false`: `<StatusBadge tone="caution">` `استكمال التهيئة مطلوب ({passedCount}/10) / Setup incomplete ({passedCount}/10 gates passed)`. Uses **`caution` (amber)**, never `negative` (red), because unfulfilled setup gates on a newly activated company are expected onboarding steps, not system failures (`states.md`, `accounting-status-and-a11y.md`).
- **Ordered 10-Row Gate Checklist (`02_DTOs.md` line 186, `ACT-14` order):**

| # | `gate` Wire Identifier (`ACT-14` Order) | Bilingual Gate Title (`ar` / `en`) | Passing Badge | Failing Badge & `fix` Text | Handoff Destination (`next/link`) & Gate |
| --- | --- | --- | --- | --- | --- |
| 1 | `FUNCTIONAL_CURRENCY` *(functional currency)* | العملة الوظيفية محددة / Functional currency set | `positive` (`مكتمل / Passed`) | `caution` (`مطلوب / Action needed`) + `localizedI18nText(fix, lang)` | `?tab=profile` (`SCR-01` Tab 2, `accounting.profile.read`) |
| 2 | `CHART_COMPLETE` *(chart complete)* | دليل الحسابات مكتمل / Chart of accounts complete | `positive` | `caution` + `fix` | `/accounting/setup/charts` (`SCR-02`, gated by `accounting.chart.read` / `accounting.account.read`) |
| 3 | `ACCOUNT_ROLES_RESOLVED` *(account roles resolved)* | أدوار الحسابات مربوطة / Account roles resolved | `positive` | `caution` + `fix` (shows resolved count from `[S] GET /account-roles` when permitted) | `/accounting/setup/charts?tab=roles` (`SCR-02`, `accounting.account.read`) |
| 4 | `CURRENT_PERIOD_OPEN` *(current period OPEN for GL/AR/AP/TAX)* | الفترة الحالية مفتوحة (GL/AR/AP/TAX) / Current period OPEN for GL/AR/AP/TAX | `positive` | `caution` + `fix` (`ACT-09`: open fiscal year partitions `FUTURE -> OPEN`) | `/accounting/periods` (`SCR-04`, `accounting.calendar.read` / `accounting.period.read`) |
| 5 | `FX_RATE_FOR_TODAY` *(rate for today)* | سعر الصرف لليوم متوفر / Exchange rate available for today | `positive` | `caution` + `fix` (`ACT-10`: sync CBE or import `MANUAL` rate) | `/accounting/setup/fx-rates` (`SCR-03`, `accounting.fx_rate.read`) |
| 6 | `TAX_REGISTRATION_VALID` *(tax registration valid today)* | التسجيل الضريبي ساري اليوم / Tax registration valid today | `positive` | `caution` + `fix` (`ACT-07`) | `/accounting/tax/setup` (`SCR-09`, gated by `accounting.tax.engine` + `accounting.tax_registration.read`) |
| 7 | `TAX_RULE_SET_ADOPTED` *(adopted rule-set version effective today)* | نسخة قواعد الضرائب معتمدة وسارية / Adopted tax rule-set effective today | `positive` | `caution` + `fix` (`ACT-07`) | `/accounting/tax/rules` (`SCR-10`, gated by `accounting.tax.engine` + `accounting.tax_rule_set.read`) |
| 8 | `POSTING_RULE_PUBLISHED` *(published posting-rule version)* | نسخة قواعد الترحيل منشورة / Published posting-rule version active | `positive` | `caution` + `fix` | `/accounting/posting-rules` (`SCR-18` Stage-2; if unentitled/unbuilt or lacking `accounting.posting_rule.read`, renders plain text instruction without broken link per `accounting-ia.md` §3) |
| 9 | `OPENING_BATCH_POSTED` *(opening balance batch posted)* | دفعة الأرصدة الافتتاحية مرحّلة / Opening balance batch posted | `positive` | `caution` + `fix` (`ACT-11`: post balanced opening journal into period `0 OPENING`) | `/accounting/journals/new` (`SCR-06`, gated by `accounting.journal_draft.create`) |
| 10 | `AUTHORITY_CONNECTION_PRODUCTION` *(connection in production where document keys entitled)* | ربط الفوترة الإلكترونية في وضع الإنتاج / E-invoice connection in production | `positive` (auto-passes when `accounting.documents.einvoice_eg` & `accounting.documents.ereceipt_eg` are not entitled) | `caution` + `fix` (`ACT-08`) | `/accounting/einvoice` (`SCR-13`, gated by `accounting.documents.einvoice_eg` + `accounting.einvoice_connection.read`) |

*(Defensive rendering rule: `CompanyReadinessDto.gates[i].gate` is matched against a dictionary lookup map with `wireLabel` fallback so even if a gate code string varies slightly in casing, all 10 rows render in exact server array order with `localizedI18nText(gate.fix, lang)` and zero raw wire tokens.)*

### 6.2 Tab 2 — Company Profile (`?tab=profile`)

- **Reads:** `GET /api/tenant/accounting/v1/company-profile` (`CompanyProfileDetailDto` + weak representation `ETag`), plus `[S] GET /charts` and `[S] GET /fiscal-calendars` only while `firstPostingAt === null`.
- **Writes:** `PATCH /api/tenant/accounting/v1/company-profile` (`UpdateCompanyProfileDto`) with `If-Match: "<version>"` from the read's `data.version` and `x-idempotency-key` (UUIDv7). Sole `primary` button in `PageHeader`: `حفظ التعديلات / Save changes` (enabled only when form is dirty and actor holds `accounting.profile.update`).
- **Field Mutability & Post-Posting Freeze Matrix:**

| Field | DTO Member (`Detail` / `Update`) | Pre-First-Posting (`firstPostingAt === null`) | Post-First-Posting (`firstPostingAt !== null` / `currencyFrozen === true`) |
| --- | --- | --- | --- |
| Country Code | `countryCode` (read-only) | `<Field readOnly>` — copied from Core (`D-073`) | `<Field readOnly>` — copied from Core (`D-073`) |
| Activation Date | `accountingActivatedOn` (read-only on PATCH) | `<Field readOnly>` — fixed at activation (`UpdateCompanyProfileDto` omits it) | `<Field readOnly>` — frozen (`ACCOUNTING.PROFILE.ACTIVATION_DATE_FROZEN`) |
| Primary Ledger ID | `primaryLedgerId` (read-only) | `<Field readOnly>` (`<IdentifierText>`) | `<Field readOnly>` (`<IdentifierText>`) |
| Current Tax Regime | `currentTaxRegime` (read-only summary) | `<StatusBadge>` + link to `?tab=tax-regimes` | `<StatusBadge>` + link to `?tab=tax-regimes` |
| Functional Currency | `functionalCurrencyCode` | Editable ISO 4217 Select + `caution` warning | `<Field readOnly>` + lock reason (`ACCOUNTING.PROFILE.CURRENCY_FROZEN`, `D-007`) |
| Timezone | `timezone` | Editable IANA Select (`dir="ltr"`) | `<Field readOnly>` + lock reason (`ACCOUNTING.PROFILE.STRUCTURE_FROZEN`, `D-510`) |
| Chart of Accounts | `chart` (`Detail`) / `chartId` (`Update`) | Editable shared-chart picker | `<Field readOnly>` + lock reason (`ACCOUNTING.PROFILE.STRUCTURE_FROZEN`, `D-176`) |
| Fiscal Calendar | `fiscalCalendar` (`Detail`) / `fiscalCalendarId` (`Update`) | Editable company calendar picker | `<Field readOnly>` + lock reason (`ACCOUNTING.PROFILE.STRUCTURE_FROZEN`) |
| COGS Recognition | `cogsRecognition` | `<Field readOnly>` (`AT_DELIVERY` MVP only, `D-665`) | `<Field readOnly>` (`AT_DELIVERY` MVP only, `D-665`) |
| Max Backdate Days | `maxBackdateDays` | Editable integer `0..3650` | Editable integer `0..3650` |
| Activity Code | `activityCode` | Editable string (`max 16`, `dir="ltr"`) | Editable string (`max 16`, `dir="ltr"`) |
| Tax Office Code | `taxOfficeCode` | Editable string (`max 16`, `dir="ltr"`) | Editable string (`max 16`, `dir="ltr"`) |
| Syndicate License No. | `syndicateLicenseNumber` | Editable string (`max 40`, `dir="ltr"`) | Editable string (`max 40`, `dir="ltr"`) |
| `legalForm`, `reversalMethod`, `auditorRequired`, `advancePaymentScheme`, `registrationThresholdWatch`, `sandboxFlag` | Accepted on `UpdateCompanyProfileDto` and returned by `CompanyProfileDetailDto` (`D-770`; `groupCurrencyCode` stays out, reserved wave 2, `D-009`). | Editable, pre-filled from `GET /company-profile`; `PATCH` sends only changed fields with `If-Match`. `legalForm` and `advancePaymentScheme` use the enum controls of the activation wizard. | Same (`CG-SCR01-01`, closed). |

### 6.3 Tab 3 — Company Tax Regimes (`?tab=tax-regimes`)

- **Feature Gate:** `accounting.tax.engine` (`accounting-ia.md` §3 Rule 2). Tab trigger hidden if unentitled.
- **List (`TableView`):** `GET /api/tenant/accounting/v1/company-tax-regimes` (`FilterBar` with `hideSearch`, sort by `effectiveFrom DESC`). Columns (7 max, respecting `views.md`):
  1. `taxRegime` (`t.status.taxRegime.*` badge)
  2. `effectiveFrom` (`<IdentifierText>` formatted date)
  3. `effectiveTo` (formatted date or `مفتوح / Open-ended`)
  4. `lockedUntil` (`LAW_6_2025` commitment date or `—`)
  5. `exemptAsPayee` / `withholdingDutyAsPayer` (compact yes/no text pills)
  6. `evidenceRef` (`<IdentifierText>`)
  7. Row action: `تعديل / Edit` (opens `EditDrawer`, fetches `GET /company-tax-regimes/:id` + `ETag`).
- **Create (`FormDrawer`, `PageHeader` `primary` button `+ إضافة نظام ضريبي / + Add tax regime` gated by `accounting.profile.update`):** Submits `POST /api/tenant/accounting/v1/company-tax-regimes` (`CreateCompanyTaxRegimeDto` + `x-idempotency-key`).
- **Update (`EditDrawer`):** Submits `PATCH /api/tenant/accounting/v1/company-tax-regimes/:id` (`UpdateCompanyTaxRegimeDto` + `If-Match` + `x-idempotency-key`). Displays server-derived `lockedUntil` and `graceYearFlag` as `<Field readOnly>`. When `row.taxRegime === 'LAW_6_2025'` and the operator enters `effectiveTo < row.lockedUntil`, `exitEvidenceRef` (`max 255` chars) switches dynamically to **required** inline (`ACCOUNTING.PROFILE.REGIME_LOCKED`, `D-120`, `D-327`).

### 6.4 Tab 4 — Branch Fiscal Profiles (`?tab=branches`)

- **List (`TableView`):** `GET /api/tenant/accounting/v1/branch-fiscal-profiles` (`COMPANY_OR_BRANCH` scope — called with company context to list all configured branches of the company). Columns:
  1. Branch Name & Code (joined client-side against Core `GET /api/tenant/core/v1/branches` by `branchId`)
  2. `authorityBranchCode` (`<IdentifierText>`)
  3. `countryCode` (`<IdentifierText>`)
  4. `activityCodeOverride` (`<IdentifierText>` or `افتراضي الشركة / Company default`)
  5. `ereceiptEnrolled` (`StatusBadge` `positive` Enrolled / `neutral` Not enrolled)
  6. `updatedAt`
  7. Row action: `عرض وتعديل / View & Edit` (fetches `GET /api/tenant/accounting/v1/branch-fiscal-profiles/:id` with **`branchId: row.branchId`** so `axiosClient` sends `x-mutakamel-branch-id`, loading `addressSnapshot` + `ETag`).
- **Create (`FormDrawer`, `PageHeader` `primary` button `+ ربط فرع ضريبياً / + Add branch fiscal profile` gated by `accounting.profile.update`):**
  - Core `branchId` Select (filters out Core branches that already have a live row, preventing `uq_acc_branch_fiscal_profiles_branch_id_live` collision).
  - `authorityBranchCode` (`required`, max `16` chars per `02_DTOs.md` line 204, `dir="ltr"`). Helper text adapts to adopted pack: ETA registered branch code (e.g. `0` for HQ) when pack has `EINVOICE_PROFILE = PRESENT`, or internal branch code when `NOT_APPLICABLE` (`D-111`, `D-749`).
  - Structured `addressSnapshot` (`AuthorityAddressInput`, `02_DTOs.md` lines 212–223): `country` (`readOnly` = `company.countryCode`), `governate` (`required`, max `64`), `regionCity` (`required`, max `64`), `street` (`required`, max `128`), `buildingNumber` (`required`, max `32`), `postalCode?` (max `16`, `dir="ltr"`), `floor?` (max `16`), `room?` (max `16`), `landmark?` (max `128`), `additionalInformation?` (max `256`).
  - `activityCodeOverride?` (max `16` chars, `dir="ltr"`), `ereceiptEnrolled?` (boolean toggle, `D-138`), `posDefaultDeviceId?` (optional UUID input / device selector fed by `GET /accounting/einvoice-connections` when `accounting.documents.einvoice_eg` is entitled — `CG-SCR01-04`, existing route).
  - Dispatches `POST /api/tenant/accounting/v1/branch-fiscal-profiles` with `branchId` set in both DTO body and `TenantApiRequestConfig.branchId` (`x-mutakamel-branch-id`).
- **Update (`EditDrawer`):** `PATCH /api/tenant/accounting/v1/branch-fiscal-profiles/:id` with `If-Match`, `x-idempotency-key`, and `x-mutakamel-branch-id` (`branchId` itself is `<Field readOnly>` on edit).

### 6.5 Tab 5 — Ledgers (`?tab=ledgers`)

- **Header Action (`accounting-ia.md` §3 Rule 3):** Renders `<Button variant="secondary" disabled>` `+ إضافة دفتر موازٍ / + Add parallel ledger` accompanied by visible inline helper text: *"الدفاتر الموازية والامتدادية محجوزة للمرحلة المتقدمة الثانية (multi_ledger)." / "Parallel and extension ledgers are reserved for Advanced Wave 2 (multi_ledger)."* `POST /api/tenant/accounting/v1/ledgers` is **never** called.
- **List (`TableView`):** `GET /api/tenant/accounting/v1/ledgers` (`LedgerSummaryDto[]`). Shows the seeded `PRIMARY` ledger (`code`, localized `nameI18n`, `kind = PRIMARY`, `accountingPrinciple` e.g. `EAS` / `IFRS`, `isActive`, `updatedAt`).
- **Edit (`EditDrawer`, gated by `accounting.profile.update`):** Fetches `GET /api/tenant/accounting/v1/ledgers/:id` (`ETag`) and submits `PATCH /api/tenant/accounting/v1/ledgers/:id` (`If-Match`, `x-idempotency-key`) for mutable metadata (`nameI18n.ar`, `nameI18n.en`, `accountingPrinciple` from `ReportingFrameworkCode`). `code`, `kind` (`PRIMARY`), and `isActive` (`PRIMARY` cannot be deactivated/deleted per `ck_acc_ledgers_primary_not_deleted`) render `<Field readOnly>`.

### 6.6 Tab 6 — Country Packs & Adoptions (`?tab=country-packs`)

Split into two vertical `DetailSection` panels:

1. **Company Adoption Timeline (`GET /api/tenant/accounting/v1/country-packs/adoptions`, gated by `accounting.country_pack.read`):**
   - `DataTable` sorted by `effectiveFrom DESC`: Pack Code & Version, `effectiveFrom`, `effectiveTo` (`ساري / Active` when `null`), `adoptedAt`, `blastRadiusAck.documentsAffected`, `blastRadiusAck.replayDiffRef` (`<IdentifierText>` or `—`), and `فحص البيان / Inspect manifest` button.
   - Note shown under table: *"لا يمكن حذف اعتماد دخل حيز النفاذ؛ يتم التصحيح باعتماد نسخة لاحقة." / "Active adoptions are append-only; supersede an adoption by adopting a newer version."* (`trg_acc_country_pack_adoptions_no_soft_delete`).
2. **Published Country Pack Catalogue & Manifest Inspector (`GET /country-packs`, `GET /country-packs/:packCode/versions`, `GET /country-packs/versions/:versionId`):**
   - Displays eligible packs (`countryCode === profile.countryCode`, or `BASE` if no country pack exists; other countries' packs carry a lock note if `accounting.platform.multi_country` is unentitled, `D-722`).
   - Clicking `فحص البيان / Inspect manifest` opens a wide `FormDrawer` rendering:
     - Metadata: `packCode`, `version`, `fxRateProviderCode` (`<IdentifierText>`), `legislativeSourceRef`, `effectiveFrom`, `effectiveTo`, `contentHash` (`<IdentifierText>`), `registryVersion` (`<IdentifierText>`).
     - **14-Component Manifest Table (`CountryPackComponent`):** Lists all 14 keys (`JURISDICTION_TREE` through `ACCEPTANCE_TESTS`) with localized component name, `<StatusBadge>` (`PRESENT` -> `positive`, `NOT_APPLICABLE` -> `neutral`), `rowCount`, `reason` (for `NOT_APPLICABLE`), and truncated `contentHash` with copy button.
     - **Publish Gates Summary (`PublishGate` `G1`..`G12`):** Compact grid showing `PASS` status and `checkedAt`.
   - **Adopt New Version (`ConfirmActionModal` / `FormDrawer`, `PageHeader` `primary` CTA `اعتماد نسخة حزمة / Adopt pack version` gated by `accounting.country_pack.adopt`):**
     - Fields (`AdoptCountryPackDto`, `02_DTOs.md` lines 565–573): `packVersionId` (`required`), `effectiveFrom` (`ISODate >= businessDate`), optional `components` subset multi-select (defaults to all `PRESENT` components), `replayDiffRef` (`max 256` chars — the replay report that produces it has no route yet: `CG-SCR01-05`, deferred to P20, see the reconciliation section), and `blastRadiusAck: true` checkbox (`D-061`). Submits `POST /api/tenant/accounting/v1/country-packs/:versionId/adopt` with UUIDv7 `x-idempotency-key`.

### 6.7 Tab 7 — Company Settings & Legal Interim Policies (`?tab=settings`)

Contains two clearly separated sections governed by distinct permissions (`accounting.setting.read` + `accounting.setting.update` for operational settings; `accounting.setting.manage` for legal interim policy acknowledgements):

#### Section 7A — Operational Effective-Dated Settings (`ACCOUNTING_SETTING_KEYS`)

Reads `GET /api/tenant/accounting/v1/settings` (`SettingSummaryDto[]`) and fetches `GET /api/tenant/accounting/v1/settings/:key` (`SettingDetailDto` + `ETag`) on row inspection/edit (because `value` is `jsonb` and omitted from `SummaryDto` per `02_DTOs.md` §13.1 Rule 4). Never exposes raw `jsonb` textareas — each of the **9 MVP registered keys** (`04_Errors_and_Constants.md` lines 1225–1236) renders a purpose-built typed editor in `EditDrawer` (`PATCH /api/tenant/accounting/v1/settings/:key` with `UpsertSettingDto`, `If-Match`, `x-idempotency-key`):

| Setting Key (`<IdentifierText>`) | Registered `SettingValueType` | Allowed `scopeTarget` | Structured Form Controls in `EditDrawer` |
| --- | --- | --- | --- |
| `settlement.rounding_tolerance` | `DECIMAL` (`scale <= 8`) | `COMPANY` | `<MoneyInput>` decimal string (`>= 0`, scale `<= 8`), `effectiveFrom`, `effectiveTo?`. |
| `treasury.bank_details_cooling_hours` | `INTEGER` | `COMPANY` (`TENANT` pack default read-only) | Integer hours input (`>= 0`, `dir="ltr"`), `effectiveFrom`, `effectiveTo?`. |
| `treasury.pos_shift_cutoff_hours` | `INTEGER` | `COMPANY` or `BRANCH` *(see `CG-SCR01-07`)* | Integer hours input (`>= 0`, `dir="ltr"`), `scopeTarget` radio, `effectiveFrom`, `effectiveTo?`. |
| `numbering.sales_invoice_series` | `JSON` | `COMPANY` or `BRANCH` *(see `CG-SCR01-07`)* | Structured 3-field series editor (`VAL-LFO-35`, `D-758`): `prefixPattern` (`max 32`, `dir="ltr"`, tokens `{YYYY}`, `{YY}`, `{BRANCH}`), `padding` (integer `3..12`), `startAt?` (positive integer), plus live formatted preview (e.g. `INV-2026-000001`). |
| `numbering.credit_note_series` | `JSON` | `COMPANY` or `BRANCH` *(see `CG-SCR01-07`)* | Same structured `{ prefixPattern, padding, startAt? }` editor (`D-758`, `D-759`). |
| `numbering.debit_note_series` | `JSON` | `COMPANY` or `BRANCH` *(see `CG-SCR01-07`)* | Same structured `{ prefixPattern, padding, startAt? }` editor (`D-758`, `D-759`). |
| `tax_return.frequency` | `STRING` (`TaxReturnFrequency`) | `COMPANY` | Select of `TaxReturnFrequency` (`MONTHLY`, `QUARTERLY`, `ANNUAL`, `PER_PAYMENT`) for `company_set_terms` returns (`D-749`). |
| `tax_return.due_rule` | `JSON` | `COMPANY` | Structured 3-field editor (`02_DTOs.md` line 588): `offset` (integer `>= 0`), `unit` (`DAYS \| MONTH_END \| YEAR_END_MONTH_END`), `anchor` (`PERIOD_END \| EVENT`). |
| `tax_return.amendment_window_months` | `INTEGER` (`1..120`) | `COMPANY` | Integer months input (`1..120`, `dir="ltr"`). |

*(Wave-2 reserved keys `assets.revaluation_election.<category_code>`, `direct_debit.failure_threshold`, and `direct_debit.in_flight_alarm_days` are omitted from the MVP edit list per `01_Foundation_Tables.md` line 1078.)*

#### Section 7B — Legal Readiness & Interim Policy Register (`16_Regulatory_Requirements_EG.md` §11.3, `D-270`)

Visible when `profile.countryCode === 'EG'` (or when `legal.interim_policy_ack.*` rows exist). Probes current acknowledgement status via `GET /api/tenant/accounting/v1/settings/legal.interim_policy_ack.<code>` (`404` = unacknowledged / fail-closed; `200` with `effectiveTo === null` and matching `policyVersion` & `policyTextHash` = active acknowledgement; see `CG-SCR01-06`).

| Register Code | Mode | Gated Accounting Path (Fail-Closed Default) | Actions (`accounting.setting.manage`) |
| --- | --- | --- | --- |
| `L-READY-03` | `INTERIM_POLICY` | Small-balance bad-debt VAT/CIT relief claim during year-end / deduction check | **Acknowledge** (`POST .../L-READY-03/acknowledge` sending `{ policyVersion, policyTextHash }`) · **Withdraw** (`POST .../L-READY-03/withdraw` -> `204`) |
| `L-READY-04` | `INTERIM_POLICY` | Credit-note VAT adjustment beyond statutory window | **Acknowledge** · **Withdraw** |
| `L-READY-05` | `INTERIM_POLICY` | Non-resident services reverse-charge / Form 11 interim treatment | **Acknowledge** · **Withdraw** |
| `L-READY-07` | `INTERIM_POLICY` | Law 6/2025 simplified regime transitional deduction boundary | **Acknowledge** · **Withdraw** |
| `L-READY-08` | `PARAMETER_DEFAULT` | CBE official `MID` exchange-rate side (`EAS 13` / `IAS 21.21-22`, `D-754`) | **Read-only informational row** — no button (`POST .../L-READY-08/acknowledge` is refused with `422 ACCOUNTING.SETTING.KEY_UNKNOWN`, `02_DTOs.md` line 309). |

---

## 7. Complete UI State, Boundary & Domain Error Matrix

### 7.1 All 11 Standard States (`docs/design/states.md`) + Accounting Boundary States (`accounting-patterns-documents.md`)

| State | Trigger on `SCR-01` | Rendered Component & UX Behavior |
| --- | --- | --- |
| **1. Initial Loading** | First `GET /company-profile` or tab data fetch in flight | Deterministic skeleton matching `PageHeader` + `AccountingScopeBar` + neutral card frame (`aria-busy="true"`). Never flashes Mode A before Mode B resolves. |
| **2. Empty State** | Mode A (`404 ACCOUNTING.PROFILE.NOT_FOUND`) OR Mode B sub-table with `0` rows (`branch-fiscal-profiles`, `settings` overrides) | Mode A renders the **5-Step Activation Wizard** (never `NotFoundState`). Empty sub-tables render `<EmptyState>` with explanation and permission-gated secondary trigger (e.g. `"No branch fiscal profiles registered yet"`). |
| **3. Load / Mutation Error + Retry** | `5xx`, network error, or `4xx` domain refusal | Load failures render `<ErrorState>` with localized message, `<IdentifierText>{correlationId}</IdentifierText>`, and `Retry` button. Form/command errors render inline field errors (`aria-invalid`, `aria-describedby`) + top error summary following the **Cause / Effect on Books / Safe Next Action** formula (`useAccountingErrorModel`). |
| **4. `403` Permission Denied** | Missing `accounting.profile.read` on route, or missing `accounting.country_pack.read` / `accounting.setting.read` on a specific tab | Route-level: `<PermissionGate permission="accounting.profile.read">` (never `EmptyState`). Tab-level: renders `<PermissionGate>` inside that `TabsContent` while keeping permitted tabs usable. |
| **5. Read-Only Mode** | Tenant `AccessMode` is `READ_ONLY` or `DUNNING`, or actor holds `.read` without `.activate` / `.update` / `.adopt` / `.manage`, or post-posting frozen fields | `<ReadOnlyGate>` hides/disables mutation CTAs with explicit reason banner; post-posting frozen fields render `<Field readOnly>` with full contrast (`ink-900` / dark `ink-100`) and freeze reason text. |
| **6. Offline** | Browser `navigator.onLine === false` | Global offline strip + disables network command buttons (`Activate`, `Save`, `Adopt`, `Acknowledge`) while preserving in-memory wizard/form draft inputs. |
| **7. Optimistic / In-Flight Pending** | `POST /activate`, `PATCH`, `POST /adopt`, `POST /acknowledge` in flight | Accounting setup writes are **never** optimistically faked as committed; button enters `aria-busy="true"` + `<WaitingStateBadge>` (`prefers-reduced-motion` static indicator) until server confirms `200`/`201`/`204`. |
| **8. Rollback / Rejection** | Validation (`400`) or domain rule (`422`/`409`) rejects write | Form keeps every user-typed character intact, focuses first invalid control (`accessibility.md` line 208), and states `"No changes were written to the company books."` |
| **9. `409` Optimistic Concurrency Conflict** | `PATCH` with stale numeric `If-Match` version | Opens `<ConflictDialog>` comparing the operator's unsaved field edits against freshly re-fetched server values (`Reload latest` vs `Re-apply on new version` with a fresh UUIDv7 `x-idempotency-key`). |
| **10. `404` Stale Child Resource** | Deep-linked/open drawer for `:id` (`company-tax-regimes/:id`, `branch-fiscal-profiles/:id`) deleted/missing | Closes or replaces drawer body with `<NotFoundState>` and refreshes parent `DataTable`. (`404 ACCOUNTING.PROFILE.NOT_FOUND` on `/company-profile` always routes to Mode A Wizard.) |
| **11. Partial Failure** | Mode B loads `company-profile` (`200`) while `readiness` or `[S] account-roles` fails (`Promise.allSettled`) | Renders `<DegradedBanner>` inside the affected section with a targeted `Retry` button while keeping the rest of `SCR-01` interactive. |
| **12. Ambiguous Timeout (`D-768`)** | `CLIENT_REQUEST_TIMEOUT` / dropped connection on `POST /activate` or `POST /:versionId/adopt` | Renders `<AmbiguousOutcomePanel>` retaining the exact UUIDv7 `x-idempotency-key`; offers **Check Status** (`GET /company-profile` or `GET /country-packs/adoptions`) and **Safe Replay** with the identical key. |
| **13. Entitlement Boundary** | `403 ACCOUNTING.FEATURE.NOT_ENTITLED` (`accounting.ledger.core` on screen, `accounting.tax.engine` on Tab 3, `accounting.platform.multi_country` on 2nd country pack) | Full-page entitlement boundary via `AccountingBoundaryGate` when `accounting.ledger.core` is unentitled; inline entitlement card when a specific feature-gated tab/action is unentitled. |
| **14. Recovery / Maintenance Fence** | `403 ACCOUNTING.FEATURE.RECOVERY_MODE` or `503` maintenance fence | `AccountingBoundaryGate` renders the non-dismissible `RECOVERY_MODE` / Maintenance boundary (`W-01` contract: all mutations fenced, books untouched). |

### 7.2 Domain Error Code Mapping (`useAccountingErrorModel`: Cause · Effect on Books · Safe Next Action)

Client logic branches strictly on `statusCode` + `errorCode` (`04_Errors_and_Constants.md`), never on message text (`i18n.md` line 360):

| `errorCode` (`statusCode`) | Cause (`ar` / `en`) | Effect on Books | Safe Next Action |
| --- | --- | --- | --- |
| `ACCOUNTING.PROFILE.ALREADY_ACTIVATED` (`409`) | تم تفعيل المحاسبة لهذه الشركة مسبقاً. / Company accounting is already activated. | لم يُنشأ ملف مكرر؛ الدفاتر الحالية سليمة. / No duplicate created; existing books untouched. | الانتقال مباشرةً إلى لوحة الجاهزية. / Switch directly to Mode B Readiness tab (`GET /company-profile`). |
| `ACCOUNTING.PROFILE.ACTIVATION_DATE_IN_PERIOD` (`422`) | تاريخ التفعيل يقع داخل فترة عادية وليس على بدايتها. / Activation date falls inside a normal period rather than on a period boundary. | لم يتم التفعيل ولم تُنشأ أي سجلات. / Activation aborted; zero rows written. | اختر تاريخ بداية فترة متوافقاً مع نمط التقويم في الخطوة 2. / Pick a valid period-start boundary in Step 2. |
| `ACCOUNTING.PROFILE.CURRENCY_FROZEN` (`422`) | لا يمكن تغيير العملة الوظيفية بعد ترحيل أول قيد. / Functional currency cannot change after the first posted entry. | بقيت العملة الوظيفية كما هي دون تغيير. / Functional currency unchanged. | أعد تحميل الملف لتحديث حالة التجميد. / Reload profile (`GET /company-profile`) to refresh freeze state. |
| `ACCOUNTING.PROFILE.STRUCTURE_FROZEN` (`409`) | المنطقة الزمنية ودليل الحسابات والتقويم المالي مجمّدة بعد أول ترحيل. / Timezone, chart, and fiscal calendar are frozen after first posting. | لم يُحفظ التعديل الهيكلي. / Structural edit rejected; books unchanged. | استخدم دمج الحسابات أو ربط الحسابات في شاشة الدليل (`SCR-02`). / Use account merges/mappings on `SCR-02`. |
| `ACCOUNTING.PROFILE.REGIME_PARAMETER_UNPUBLISHED` (`422`) | معاملات النظام الضريبي المختار (`LAW_6_2025`) غير منشورة لتاريخ السريان. / Authority parameters for `LAW_6_2025` are not published on `effectiveFrom`. | لم يُحفظ النظام الضريبي. / Regime row not saved. | راجع حزمة الدولة المعتمدة أو اختر تاريخ سريان مغطى. / Check adopted pack version or adjust `effectiveFrom`. |
| `ACCOUNTING.PROFILE.REGIME_LOCKED` (`422`) | إنهاء التزام قانون 6 لسنة 2025 قبل تاريخ الإلزام يتطلب مرجع قرار الجهة الضريبية. / Ending a `LAW_6_2025` commitment before `lockedUntil` requires `exitEvidenceRef`. | بقي سجل النظام الضريبي مفتوحاً كما هو. / Regime commitment remains unchanged. | أدخل مرجع قرار الخروج الضريبي (`exitEvidenceRef`). / Populate `exitEvidenceRef` and resubmit with a new key. |
| `ACCOUNTING.PACK.COUNTRY_MISMATCH` (`422`) | رمز دولة الحزمة لا يطابق دولة الشركة في النظام الأساسي. / Pack country code does not match the Core company country. | لم يتم اعتماد الحزمة. / Pack not adopted. | اختر حزمة تطابق دولة الشركة (`countryCode`). / Select a pack matching `company.countryCode`. |
| `ACCOUNTING.PACK.COUNTRY_PACK_AVAILABLE` (`422`) | لا يجوز اعتماد الحزمة الأساسية (`BASE`) مع وجود حزمة منشورة لدولة الشركة. / Cannot adopt `BASE` pack when a published country pack exists for this country. | لم يتم الاعتماد. / Pack not adopted. | اختر حزمة الدولة المنشورة بدلاً من `BASE`. / Select the published country pack version. |
| `ACCOUNTING.PACK.VERSION_RETIRED` (`422`) | نسخة الحزمة المختارة متقاعدة ولا تقبل اعتماداً جديداً. / Selected pack version is retired (`effectiveTo` passed). | لم يتم الاعتماد. / Pack not adopted. | اختر أحدث نسخة منشورة وسارية من الحزمة. / Pick the current active pack version. |
| `ACCOUNTING.PACK.REGISTRY_INCOMPATIBLE` (`422`) | نسخة سجل العوامل في الحزمة غير متوافقة مع إصدار النظام الحالي. / Pack `registryVersion` is incompatible with current application build. | لم يتم الاعتماد. / Pack not adopted. | تواصل مع مسؤول المنصة لتحديث حزمة الدولة. / Escalate correlation ID to platform support. |
| `ACCOUNTING.PACK.SEPARATION_OF_DUTIES` (`403`) | ناشر نسخة الحزمة المستأجرة لا يمكنه اعتمادها لنفس الشركة. / Tenant author/publisher of a forked pack version cannot also adopt it (`D-061`). | لم يتم الاعتماد. / Pack not adopted. | اطلب من مستخدم مخوّل آخر تنفيذ الاعتماد. / Have a second user with `accounting.country_pack.adopt` adopt it. |
| `ACCOUNTING.CHART.TEMPLATE_NOT_FOUND` (`404`) | رمز قالب دليل الحسابات غير موجود في نسخة الحزمة المختارة. / `chartTemplateCode` was not found in the selected pack version. | لم يتم التفعيل. / Activation aborted; zero rows written. | اختر قالباً صالحاً أو انضم لدليل مشترك في الخطوة 3. / Pick a valid template or shared chart in Step 3. |
| `ACCOUNTING.TAX_RULES.REPLAY_DIFFERENCE_UNACKNOWLEDGED` (`422`) | تقرير إعادة الاحتساب يُظهر مستندات متأثرة ويتطلب مرجع التقرير (`replayDiffRef`). / Replay found affected documents and requires `replayDiffRef`. | لم يتم اعتماد النسخة الجديدة. / Adoption not committed. | أدخل مرجع تقرير الفروق (`replayDiffRef`) وأكّد الإقرار. / Provide `replayDiffRef` and confirm acknowledgement. |
| `ACCOUNTING.SETTING.KEY_UNKNOWN` (`422`) | مفتاح الإعداد غير مسجّل أو قيمة الإعداد تخالف النوع المسموح (`VAL-LFO-35`). / Setting key unknown, policy is `PARAMETER_DEFAULT`, or `value` violates schema. | بقي الإعداد السابق سارياً. / Existing setting remains in effect. | صحّح صيغة الحقل (مثل نمط الترقيم) وأعد المحاولة. / Fix structured field inputs and retry. |
| `ACCOUNTING.APPROVAL.PAYLOAD_CHANGED` (`409`) | تغيّرت نسخة السياسة المؤقتة أو بصمتها النصية (`policyTextHash`) في السجل القانوني. / Legal interim policy version or `policyTextHash` changed since screen load. | لم يُسجّل الإقرار. / Policy remains unacknowledged (fail-closed). | أعد تحميل نص السياسة المحدّث ثم أقرّ به من جديد. / Refresh policy text and re-acknowledge. |
| `ACCOUNTING.SCOPE.TARGET_DENIED` (`403`) | نطاق الطلب (`BRANCH` / `TENANT`) غير مصرح به أو ينقصه ترويسة الفرع. / Scope target denied or `x-mutakamel-branch-id` does not match authorized branch. | لم يُحفظ السجل. / Nothing written. | اختر فرعاً يقع ضمن صلاحياتك ثم أعد المحاولة. / Select an authorized branch in Tab 4. |

---

## 8. Bilingual Copy & Enum Dictionary Specification (`ar.ts` & `en.ts`)

Zero inline `lang === "ar" ?` ternaries (`i18n.md`). All numbers, dates, and counters format via `LOCALE = { ar: "ar-EG-u-nu-latn", en: "en-US" }` (Western digits `0-9` in both languages).

### 8.1 Core Screen & Section Labels (`t.accounting.companySetup.*`)

| Dictionary Key | Arabic (`ar.ts`) | English (`en.ts`) |
| --- | --- | --- |
| `titleWizard` | تفعيل المحاسبة للشركة | Activate Company Accounting |
| `titleWorkspace` | إعدادات الشركة وجاهزية الدفاتر | Company Setup & Readiness Gates |
| `noOpBanner` | يمكنك مراجعة جميع الخطوات أو الإلغاء بأمان؛ لا يتم إنشاء أي دفاتر أو سنوات مالية إلا عند تأكيد التفعيل في الخطوة 5. | Browse all steps or cancel safely; no ledgers, fiscal years, or journals are created until you confirm activation in Step 5. |
| `freezeWarningBanner` | تنبيه هيكلي: تُجمّد العملة الوظيفية والمنطقة الزمنية ودليل الحسابات والتقويم المالي وتاريخ التفعيل نهائياً فور ترحيل أول قيد محاسبي. | Structural notice: functional currency, timezone, chart of accounts, fiscal calendar, and activation date freeze permanently after the first posted journal entry. |
| `frozenFieldReason` | مجمّد نهائياً لوجود قيود مرحّلة بتاريخ {date}. | Permanently frozen because journal entries exist since {date}. |
| `coreCountryReadOnlyReason` | يُنسخ رمز الدولة تلقائياً من سجل الشركة في النظام الأساسي ولا يُعدّل من المحاسبة. | Country code is inherited from Core Company and cannot be modified in Accounting. |
| `step1Title` | 1. حزمة الدولة والمرجعية التشريعية | 1. Country Pack & Legislation |
| `step2Title` | 2. العملة والتقويم المالي | 2. Currency & Fiscal Calendar |
| `step3Title` | 3. دليل الحسابات وقواعد الدفتر | 3. Chart & Ledger Defaults |
| `step4Title` | 4. النظام الضريبي والبيانات القانونية | 4. Tax Regime & Statutory Profile |
| `step5Title` | 5. المراجعة والتفعيل الذرّي | 5. Atomic Review & Activate |
| `activateCta` | تفعيل المحاسبة الآن | Activate accounting now |
| `nextStep` | الخطوة التالية | Next step |
| `prevStep` | الخطوة السابقة | Previous step |
| `tabReadiness` | بوابات الجاهزية (10) | Readiness Gates (10) |
| `tabProfile` | ملف الشركة المحاسبي | Company Profile |
| `tabTaxRegimes` | الأنظمة الضريبية | Tax Regimes |
| `tabBranches` | الملفات الضريبية للفروع | Branch Fiscal Profiles |
| `tabLedgers` | دفاتر الأستاذ | Ledgers |
| `tabCountryPacks` | حزم الدول والاعتمادات | Country Packs |
| `tabSettings` | الإعدادات والسياسات المؤقتة | Settings & Interim Policies |
| `multiLedgerWave2Reason` | الدفاتر الموازية والامتدادية متاحة في المرحلة المتقدمة الثانية (multi_ledger). | Parallel and extension ledgers ship in Advanced Wave 2 (multi_ledger). |
| `wave2OptionReason` | محجوز للمرحلة الثانية — غير مفعّل في الإصدار الحالي. | Reserved for Wave 2 — not enabled in current release. |
| `interimPolicyFailClosedHint` | السياسات غير المقرّ بها تفشل بأمان (Fail-Closed) وتمنع تطبيق المعالجة المؤقتة حتى يعتمدها مفوّض الشركة. | Unacknowledged interim policies fail closed until explicitly acknowledged by an authorized company officer. |

### 8.2 Enum Wire-to-Label Entries (`t.status.*`, resolved via `wireLabel`)

| Enum (`01_Enums.md`) | Wire Member | Arabic Label (`ar.ts`) | English Label (`en.ts`) |
| --- | --- | --- | --- |
| `TaxRegime` | `STANDARD` | النظام الضريبي العام | Standard tax regime |
| `TaxRegime` | `LAW_152_2020` | قانون المشروعات الصغيرة 152 لسنة 2020 | SME Law 152/2020 |
| `TaxRegime` | `LAW_6_2025` | النظام المبسط — قانون 6 لسنة 2025 | Simplified regime — Law 6/2025 |
| `CogsRecognition` | `AT_DELIVERY` | عند التسليم (إذن الصرف) | At delivery |
| `CogsRecognition` | `AT_PURCHASE` | عند الشراء (المرحلة الثانية) | At purchase (Wave 2) |
| `ReversalMethod` | `SWAP_SIDES` | عكس طرفي القيد (مدين/دائن) | Swap debit/credit sides |
| `ReversalMethod` | `STORNO` | عكس سالب في نفس الطرف (Storno) | Negative-amount storno |
| `CalendarType` | `GREGORIAN` | ميلادي (غريغوري) | Gregorian |
| `CalendarType` | `HIJRI` | هجري (المرحلة الثانية) | Hijri (Wave 2) |
| `CalendarType` | `RETAIL_4_4_5` | تجزئة 4-4-5 (المرحلة الثانية) | Retail 4-4-5 (Wave 2) |
| `PeriodPattern` | `MONTHLY` | شهري (12 فترة عادية) | Monthly (12 normal periods) |
| `PeriodPattern` | `QUARTERLY` | ربع سنوي (4 فترات عادية) | Quarterly (4 normal periods) |
| `PeriodPattern` | `FOUR_FOUR_FIVE` / `FOUR_FIVE_FOUR` / `FIVE_FOUR_FOUR` | نمط أسابيع التجزئة 4-4-5 / 4-5-4 / 5-4-4 | Retail week pattern (4-4-5 / 4-5-4 / 5-4-4) |
| `LedgerKind` | `PRIMARY` | دفتر أساسي | Primary ledger |
| `LedgerKind` | `PARALLEL` | دفتر موازٍ | Parallel ledger |
| `LedgerKind` | `EXTENSION` | دفتر امتدادي | Extension ledger |
| `ReportingFrameworkCode` | `EAS` · `IFRS` · `IFRS_SME` · `SOCPA` · `ZAKAT` · `UNIFORM_EG` · `CUSTOM` | معايير المحاسبة المصرية (EAS) · المعايير الدولية (IFRS) · IFRS للشركات الصغيرة · SOCPA · الزكاة · النظام المحاسبي الموحد · مخصص | EAS · IFRS · IFRS for SMEs · SOCPA · Zakat · Egyptian Uniform Chart · Custom |
| `CountryPackKind` | `COUNTRY` · `BASE` | حزمة دولة تشريعية · حزمة أساسية محايدة | Country statutory pack · Country-neutral base pack |
| `CountryPackStatus` | `DRAFT` · `PUBLISHED` · `DEPRECATED` | مسودة · منشورة · متقاعدة | Draft · Published · Deprecated |
| `ManifestComponentStatus` | `PRESENT` · `NOT_APPLICABLE` | متضمّن · غير منطبق | Included · Not applicable |
| `LegalForm` | `SOLE_PROPRIETORSHIP` · `PARTNERSHIP` · `LLC` · `JOINT_STOCK` · `BRANCH_OF_FOREIGN` · `PUBLIC_ENTITY` · `OTHER` | منشأة فردية · شركة أشخاص · ذات مسؤولية محدودة · شركة مساهمة · فرع شركة أجنبية · جهة عامة · أخرى | Sole proprietorship · Partnership · Limited liability (LLC) · Joint-stock (JSC) · Foreign branch · Public entity · Other |
| `SettingValueType` | `STRING` · `INTEGER` · `DECIMAL` · `BOOLEAN` · `JSON` · `DATE` | نص · عدد صحيح · رقم عشري · منطقي · كائن مهيكل · تاريخ | Text · Integer · Decimal · Boolean · Structured object · Date |
| `TaxReturnFrequency` | `MONTHLY` · `QUARTERLY` · `ANNUAL` · `PER_PAYMENT` | شهري · ربع سنوي · سنوي · لكل دفعة | Monthly · Quarterly · Annual · Per payment |

---

## 9. ASCII Mockups (4 Theme × Direction Combinations + `375px` Mobile)

All four combinations adhere strictly to the Tenant Portal token system (`tokens.md`), single `primary` CTA law (`README.md`), logical properties (`ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`), Western numerals (`0-9`), and `<bdi dir="ltr">` isolation on codes, hashes, dates, and IANA timezones.

### 9.1 Combination 1 — Arabic RTL · Light (`html[lang="ar"][dir="rtl"].light`)

- **Surface tokens:** Canvas `bg-ink-50`, cards `bg-white border-ink-200`, primary text `text-ink-900`, secondary text `text-ink-600`, sole primary CTA `bg-brand-600 text-white`, setup-gap badge `bg-caution-50 text-caution-800 border-caution-200`, passed badge `bg-positive-50 text-positive-800 border-positive-200`.

#### Mode A (Pre-Activation Wizard — Step 2 of 5)

```text
+------------------------------------------------------------------------------------------------------+
| [شريط النطاق المحاسبي]  الحالة: [غير مفعّلة ○]   الدولة: <bdi>EG</bdi>   الشركة: شركة مرساني للتجارة ▾ |
+------------------------------------------------------------------------------------------------------+
| [الخطوة التالية ← (Primary)]  [إلغاء والعودة]                تفعيل المحاسبة للشركة                    |
|                                                              المحاسبة / الإعدادات والتهيئة / الشركة    |
+------------------------------------------------------------------------------------------------------+
| [i] لا يتم إنشاء أي دفاتر أو سنوات مالية أثناء التنقل؛ يتم التفعيل ذرّياً عند التأكيد في الخطوة 5.    |
+------------------------------------------------------------------------------------------------------+
|  (5) المراجعة والتفعيل ── (4) النظام الضريبي ── (3) الدليل والدفتر ── [● 2. العملة والتقويم] ── (✓ 1) |
+------------------------------------------------------------------------------------------------------+
|  [!] تنبيه هيكلي: تُجمّد العملة الوظيفية والمنطقة الزمنية والتقويم وتاريخ التفعيل بعد أول ترحيل.     |
|                                                                                                      |
|  +--- العملة الوظيفية والمنطقة الزمنية -----------------------------------------------------------+  |
|  |  المنطقة الزمنية للشركة *                          العملة الوظيفية للدفاتر *                   |  |
|  |  [▾ <bdi>Africa/Cairo</bdi>                 ]      [▾ <bdi>EGP</bdi> — الجنيه المصري        ]  |  |
|  |  تاريخ التفعيل والأرصدة الافتتاحية *               دولة الشركة (من النظام الأساسي — للقراءة)   |  |
|  |  [  <bdi>2026-01-01</bdi>                   ]      <bdi>EG</bdi> — جمهورية مصر العربية (مجمّد) |  |
|  +------------------------------------------------------------------------------------------------+  |
|  +--- التقويم المالي الأول (`CreateFiscalCalendarDto`) -------------------------------------------+  |
|  |  الاسم بالعربية *                                  رمز التقويم *                               |  |
|  |  [ التقويم المالي الرئيسي                    ]      [ <bdi>MAIN_CAL</bdi>                    ]  |  |
|  |  نمط الفترات المحاسبية *                           نوع التقويم *                               |  |
|  |  (●) شهري (12 فترة)  ( ) ربع سنوي (4 فترات)       (●) ميلادي   (×) هجري — محجوز للمرحلة 2     |  |
|  |  يوم بداية السنة *          شهر بداية السنة *      الاسم بالإنجليزية (اختياري)                 |  |
|  |  [ <bdi>1</bdi>         ]   [ 1 — يناير    ▾ ]     [ <bdi>Main Fiscal Calendar</bdi>        ]  |  |
|  +------------------------------------------------------------------------------------------------+  |
|  الخطوة 2 من 5                                                             [→ الخطوة السابقة (Ghost)]|
+------------------------------------------------------------------------------------------------------+
```

#### Mode B (Post-Activation Workspace — Tab 1 `readiness`, `ACT-14`)

```text
+------------------------------------------------------------------------------------------------------+
| [شريط النطاق]  السنة: <bdi>FY2026</bdi> (مستقبلية) | العملة: <bdi>EGP</bdi> | الشركة: مرساني للتجارة ▾|
+------------------------------------------------------------------------------------------------------+
| [تحديث الفحص ↻ (Secondary)]             [استكمال التهيئة: 6/10 ▲]  إعدادات الشركة وجاهزية الدفاتر     |
+------------------------------------------------------------------------------------------------------+
| [الإعدادات والسياسات] [حزم الدول] [دفاتر الأستاذ] [الفروع] [الأنظمة الضريبية] [ملف الشركة] [● الجاهزية]|
+------------------------------------------------------------------------------------------------------+
| [▲ تنبيه جاهزية] 6 من 10 بوابات مكتملة — أكمل المتطلبات الـ 4 المتبقية قبل إصدار أول مستند رسمي.    |
| آخر فحص: <bdi>2026-11-01 17:30</bdi>                                                                 |
+------------------------------------------------------------------------------------------------------+
| الإجراء التصحيحي                                  | الحالة          | بوابة الجاهزية (`ACT-14`)   | # |
|---------------------------------------------------+-----------------+-----------------------------+---|
| —                                                 | [✓ مكتمل]       | العملة الوظيفية محددة       | 1 |
| —                                                 | [✓ مكتمل]       | دليل الحسابات مكتمل         | 2 |
| — (108/108 دور مربوط)                             | [✓ مكتمل]       | أدوار الحسابات مربوطة       | 3 |
| [فتح الفترات المالية ←] (`/accounting/periods`)   | [▲ مطلوب إجراء] | الفترة الحالية مفتوحة       | 4 |
| [إدارة أسعار الصرف ←] (`/accounting/setup/fx-rates`)| [▲ مطلوب إجراء] | سعر الصرف لليوم متوفر     | 5 |
| [إكمال التسجيل الضريبي ←] (`/accounting/tax/setup`)| [▲ مطلوب إجراء] | التسجيل الضريبي ساري اليوم | 6 |
| —                                                 | [✓ مكتمل]       | نسخة قواعد الضرائب معتمدة   | 7 |
| —                                                 | [✓ مكتمل]       | نسخة قواعد الترحيل منشورة   | 8 |
| [قيد رصيد افتتاحي ←] (`/accounting/journals/new`) | [▲ مطلوب إجراء] | دفعة الأرصدة الافتتاحية     | 9 |
| — (مستندات الفوترة الإلكترونية غير مفعّلة بالباقة)| [✓ مكتمل]       | ربط الفوترة بوضع الإنتاج    |10 |
+------------------------------------------------------------------------------------------------------+
```

---

### 9.2 Combination 2 — Arabic RTL · Dark (`html[lang="ar"][dir="rtl"].dark`)

- **Surface tokens:** Canvas `bg-ink-950`, elevated cards `bg-ink-900 border-ink-800`, primary text `text-ink-50`, muted text `text-ink-400`, sole primary CTA `bg-brand-500 text-white`, `caution` badge `bg-caution-950/60 text-caution-300 border-caution-800`, `positive` badge `bg-positive-950/60 text-positive-300 border-positive-800`, read-only frozen values keep full `text-ink-100` contrast (`accessibility.md` line 220).

#### Mode A (Step 5 Atomic Review & Freeze Confirmation — Dark) + Mode B (Tab 7 Settings & Legal Interim Policies — Dark)

```text
+------------------------------------------------------------------------------------------------------+
| [dark:bg-ink-900 border-ink-800]  الحالة: [غير مفعّلة ○]   الدولة: <bdi>EG</bdi>   مرساني للتجارة ▾   |
+------------------------------------------------------------------------------------------------------+
| [تفعيل المحاسبة الآن ✓ (Primary bg-brand-500)] [إلغاء]              تفعيل المحاسبة للشركة (الخطوة 5) |
+------------------------------------------------------------------------------------------------------+
|  [● 5. المراجعة والتفعيل] ── (✓ 4) ── (✓ 3) ── (✓ 2) ── (✓ 1. حزمة الدولة)                          |
+------------------------------------------------------------------------------------------------------+
|  +--- ملخص التفعيل الذرّي (معاملة قاعدة بيانات واحدة — 10 خطوات) ----------------------------------+  |
|  | [تعديل 1] الحزمة: <bdi>EG v1</bdi> (مزود الصرف: <bdi>CBE / MID</bdi>) | [تعديل 2] العملة: <bdi>EGP</bdi> |  |
|  | المنطقة الزمنية: <bdi>Africa/Cairo</bdi> | تاريخ الافتتاح: <bdi>2026-01-01</bdi> | التقويم: شهري |  |
|  | [تعديل 3] الدليل: قالب <bdi>EG_EAS_STD</bdi> | تكلفة المبيعات: عند التسليم | العكس: عكس الطرفين |  |
|  | [تعديل 4] النظام الضريبي: قانون 6 لسنة 2025 (ساري من <bdi>2026-01-01</bdi> — التزام مقفل)       |  |
|  | المخرجات التلقائية: دفتر <bdi>PRIMARY</bdi> + سنة <bdi>FUTURE</bdi> + فترة <bdi>OPENING</bdi> + 9 يوميات |  |
|  +------------------------------------------------------------------------------------------------+  |
|  [✓] أقرّ بأن العملة الوظيفية والمنطقة الزمنية والدليل والتقويم ستُجمّد نهائياً بعد ترحيل أول قيد.   |
+======================================================================================================+
| [Mode B · Dark · Tab 7: ?tab=settings — الإعدادات والسياسات المؤقتة (`accounting.setting.manage`)]   |
+------------------------------------------------------------------------------------------------------+
| +--- 7A. إعدادات الشركة المؤرخة (`acc_settings`) -------------------------------------------------+ |
| | إجراء        | ساري من            | النطاق    | القيمة الحالية             | مفتاح الإعداد      | |
| |--------------+--------------------+-----------+----------------------------+--------------------| |
| | [تعديل]      | <bdi>2026-01-01</bdi> | `COMPANY` | <bdi>0.05</bdi> <bdi>EGP</bdi> | <bdi>settlement.rounding_tolerance</bdi> | |
| | [تعديل]      | <bdi>2026-01-01</bdi> | `COMPANY` | <bdi>INV-{YYYY}-</bdi> (6) | <bdi>numbering.sales_invoice_series</bdi>| |
| +--------------------------------------------------------------------------------------------------+ |
| +--- 7B. سجل الجاهزية القانونية والسياسات المؤقتة (`16_Regulatory_Requirements_EG.md` §11.3) -----+ |
| | الإجراء (`setting.manage`) | الحالة              | بصمة النص (`SHA-256`)    | الرمز              | |
| |----------------------------+---------------------+--------------------------+--------------------| |
| | [إقرار السياسة]            | [▲ غير مقرّ — مغلق] | <bdi>a3f9...81c2 (v1)</bdi>| <bdi>L-READY-03</bdi>| |
| | [سحب الإقرار]              | [✓ مقرّ وساري]      | <bdi>7c12...09be (v1)</bdi>| <bdi>L-READY-07</bdi>| |
| | — (قيمة معيارية لا تقرّ)   | [○ افتراضي الحزمة]  | جانب السعر الوسطي `CBE MID`| <bdi>L-READY-08</bdi>| |
| +--------------------------------------------------------------------------------------------------+ |
+------------------------------------------------------------------------------------------------------+
```

---

### 9.3 Combination 3 — English LTR · Light (`html[lang="en"][dir="ltr"].light`)

- **Surface tokens:** Canvas `bg-ink-50`, cards `bg-white border-ink-200`, primary text `text-ink-900`, sole primary CTA `bg-brand-600 text-white` at inline-end of `PageHeader`.

#### Mode A (Pre-Activation Wizard — Step 1 of 5)

```text
+------------------------------------------------------------------------------------------------------+
| [Accounting Scope Bar]  Company: Mersany Trading Co. ▾   Country: EG   Status: [○ Not activated]     |
+------------------------------------------------------------------------------------------------------+
| Accounting / Setup / Company Setup                                                                   |
| Activate Company Accounting                                    [Cancel]  [Next step -> (Primary)]    |
+------------------------------------------------------------------------------------------------------+
| [i] Browse all steps or cancel safely; no ledgers, years, or journals are created until Step 5.      |
+------------------------------------------------------------------------------------------------------+
|  [● 1. Country Pack] ── (2) Currency & Calendar ── (3) Chart & Ledger ── (4) Tax ── (5) Review       |
+------------------------------------------------------------------------------------------------------+
|  +--- Core Company & Statutory Country Pack (`ActivateCompanyProfileDto`) ------------------------+  |
|  |  Core Company (Read-only)                         Company Country Code (Core — Read-only)      |  |
|  |  Mersany Trading Co.                              EG — Egypt (Inherited from Core, D-073)      |  |
|  |                                                                                                |  |
|  |  Published Country Pack Version *                 FX Rate Provider Chain Head (Derived)        |  |
|  |  [ EG — Egypt Statutory Pack · v1 (2026-01-01) ▾] CBE (Central Bank of Egypt · MID rate side)  |  |
|  |  Legislative ref: Official Gazette — VAT Law 67/2016, Income Tax Law 91/2005, Law 6/2025       |  |
|  |  [Inspect 14-Component Manifest & G1..G12 Gates]                                               |  |
|  |                                                                                                |  |
|  |  [x] I acknowledge adopting pack version EG v1 for this company (`blastRadiusAck = true`).     |  |
|  +------------------------------------------------------------------------------------------------+  |
|  Step 1 of 5                                                                                         |
+------------------------------------------------------------------------------------------------------+
```

#### Mode B (Post-Activation Workspace — Tab 2 `profile` with Post-Posting Freeze Active)

```text
+------------------------------------------------------------------------------------------------------+
| [Accounting Scope Bar]  Company: Mersany Trading Co. ▾ | Country: EG | Currency: EGP 🔒 | FY2026     |
+------------------------------------------------------------------------------------------------------+
| Company Setup & Readiness Gates  [✓ Ready: 10/10]                     [Save changes (Primary)]       |
+------------------------------------------------------------------------------------------------------+
| [Readiness (10)] [● Company Profile] [Tax Regimes] [Branch Profiles] [Ledgers] [Country Packs] [Settings]
+------------------------------------------------------------------------------------------------------+
| [🔒 Structural Freeze Active] First journal entry posted at 2026-01-02 10:14 UTC. Functional         |
|     currency, timezone, chart of accounts, fiscal calendar, and activation date are permanently      |
|     read-only (`D-007`, `D-510`). Operational fields below remain editable with `If-Match: "3"`.     |
+------------------------------------------------------------------------------------------------------+
|  +--- Frozen Structural Foundation (`<Field readOnly>` — full contrast, never greyed disabled) ---+  |
|  |  Functional Currency:  EGP                         Timezone:          Africa/Cairo             |  |
|  |  Reason: Frozen after first posting (2026-01-02)   Reason: Frozen after first posting          |  |
|  |  Chart of Accounts:    EG_STD — Egyptian Chart     Fiscal Calendar:   MAIN_CAL (GREGORIAN)     |  |
|  |  Activation Date:      2026-01-01                  COGS Recognition:  At delivery (MVP)        |  |
|  +------------------------------------------------------------------------------------------------+  |
|  +--- Editable Operational & Statutory Parameters (`UpdateCompanyProfileDto`) --------------------+  |
|  |  Max Backdate Window (Days) *                      Authority Activity Code (ISIC) *            |  |
|  |  [ 5                                          ]    [ 4690                                    ] |  |
|  |  Tax Office Code (max 16 chars)                    Syndicate License Number (max 40 chars)     |  |
|  |  [ CAI-014                                    ]    [                                         ] |  |
|  +------------------------------------------------------------------------------------------------+  |
+------------------------------------------------------------------------------------------------------+
```

---

### 9.4 Combination 4 — English LTR · Dark (`html[lang="en"][dir="ltr"].dark`)

- **Surface tokens:** Canvas `bg-ink-950`, cards/drawers `bg-ink-900 border-ink-800`, text `text-ink-50`, subtle borders `border-ink-800`, sole primary CTA `bg-brand-500 text-white`.

#### Mode A (Ambiguous Timeout Recovery Panel on Step 5 — Dark) & Mode B (Tab 4 Branch Fiscal Profiles + Tab 5 Wave-2 Disabled Ledger CTA — Dark)

```text
+------------------------------------------------------------------------------------------------------+
| [Mode A · Dark · Step 5 Timeout State: `<AmbiguousOutcomePanel>` (`D-768`)]                          |
| +--------------------------------------------------------------------------------------------------+ |
| | [▲ Outcome Pending Verification] The activation request timed out before a response arrived.     | |
| | Cause: Network timeout (`CLIENT_REQUEST_TIMEOUT`).                                               | |
| | Effect on books: Activation runs in a single atomic transaction — it either completed in full    | |
| | or wrote zero rows. Retained Idempotency Key: <bdi>019a409e-7b21-7d40-9f12-8a31bc0491e2</bdi>    | |
| | [Check company status (`GET /company-profile`)]   [Retry safely with same key (Primary)]         | |
| +--------------------------------------------------------------------------------------------------+ |
+======================================================================================================+
| [Mode B · Dark · Tab 4 `?tab=branches` + Tab 5 `?tab=ledgers` Preview]                               |
+------------------------------------------------------------------------------------------------------+
| Company Setup & Readiness Gates                        [+ Add branch fiscal profile (Primary)]       |
+------------------------------------------------------------------------------------------------------+
| [Readiness] [Company Profile] [Tax Regimes] [● Branch Profiles] [Ledgers] [Country Packs] [Settings] |
+------------------------------------------------------------------------------------------------------+
| Core Branch        | Authority Code | Country | Activity Override | E-Receipt     | Updated    | Act |
|--------------------+----------------+---------+-------------------+---------------+------------+-----|
| Cairo HQ (`BR-01`) | `0`            | `EG`    | Company (`4690`)  | [✓ Enrolled]  | 2026-10-15 | [✎] |
| Alex (`BR-02`)     | `1`            | `EG`    | `4719`            | [○ Not enrol] | 2026-10-20 | [✎] |
+------------------------------------------------------------------------------------------------------+
| [Tab 5 `?tab=ledgers` Strip — Wave-2 Disabled Pattern (`accounting-ia.md` §3 Rule 3)]                |
| [+ Add parallel ledger (Disabled Secondary)]  Parallel & extension ledgers ship in Advanced Wave 2.  |
| Code      | Name                  | Kind      | Principle | Status     | Version | Actions           |
| `PRIMARY` | Primary General Ledger| `PRIMARY` | `EAS`     | [✓ Active] | `v1`    | [Edit metadata]   |
+------------------------------------------------------------------------------------------------------+
```

---

### 9.5 Mobile Responsive Viewport (`375px` Width — Arabic RTL & English LTR)

- **Responsive mechanics (`accessibility.md`):** Zero horizontal page scroll at `375px` and `200%` zoom. Form grids collapse from `grid-cols-2` to `grid-cols-1`. Text inputs enforce a `16px` mobile font-size floor on `< sm` so mobile Safari/Chrome never auto-zooms on focus (`accessibility.md` line 217). `Stepper` collapses to a compact header pill (`الخطوة 2 من 5`), and Mode B `TabsList` scrolls horizontally with snap points while `FormDrawer` expands to full-width bottom/side sheet (`w-full sm:max-w-lg`).

```text
+-------------------------------------+   +-------------------------------------+
| [الشركة: مرساني ▾] [غير مفعّلة ○]   |   | [Co: Mersany ▾]   [✓ Ready: 10/10]  |
| تفعيل المحاسبة للشركة               |   | Company Setup & Readiness           |
| [إلغاء]      [الخطوة التالية ← (P)] |   | [< Readiness | ● Branches | Ledgers]|
+-------------------------------------+   +-------------------------------------+
| [الخطوة 2 من 5: العملة والتقويم]    |   | [+ Add branch fiscal profile (P)]   |
| ████████░░░░░░░░░░░░  40%           |   +-------------------------------------+
+-------------------------------------+   | Cairo HQ (`BR-01`)     [✓ Enrolled] |
| العملة الوظيفية *                   |   | Authority Branch Code: `0` · `EG`   |
| [▾ EGP — الجنيه المصري            ] |   | Activity: Company default (`4690`)  |
| المنطقة الزمنية *                   |   | [View & Edit address (`BRANCH`)]    |
| [▾ Africa/Cairo                   ] |   +-------------------------------------+
| تاريخ التفعيل *                     |   | Alex Branch (`BR-02`)  [○ Not enr.] |
| [  2026-01-01                     ] |   | Authority Branch Code: `1` · `EG`   |
| رمز التقويم *                       |   | [View & Edit address (`BRANCH`)]    |
| [  MAIN_CAL                       ] |   +-------------------------------------+
+-------------------------------------+
```

---

## 10. Lead Review Verification Checklist (`docs/design/README.md`)

- [x] **Catalogue Fidelity:** Every method, browser Gateway path (`/api/tenant/accounting/v1/...`), permission key, feature key, scope target, idempotency header, and `If-Match` concurrency rule matches `02_Endpoint_Catalogue.md` §3 verbatim.
- [x] **Single Primary CTA:** At most one filled `primary` button appears on any wizard step or workspace tab (`PageHeader`), with drawer submit taking precedence only when modal focus is trapped.
- [x] **Four Outcome Hues Only:** `brand` (primary CTA/focus), `positive` (passed gate / active / enrolled), `caution` (incomplete readiness gate / `LAW_6_2025` lock notice / `sandboxFlag` / freeze warning), `negative` (destructive withdraw / error summary), plus `ink` neutral ramp (`Stepper` active step is `ink` neutral, never a stage hue).
- [x] **Bilingual & Zero Ternaries:** Every string resolves via `t.*`; tenant/pack bilingual payloads (`nameI18n`, `gate.fix`) resolve via shared `localizedI18nText(val, lang)` helper; every enum wire member has a `t.status.*` entry resolved via `wireLabel`.
- [x] **LTR Islands & Western Digits:** `<IdentifierText>` (`<bdi dir="ltr">`) wraps all UUIDs, SHA-256 hashes, ISO dates, currency/country/pack/branch/setting codes, and correlation IDs; `ar-EG-u-nu-latn` enforces Western digits.
- [x] **WCAG 2.2 AA & Logical CSS:** `DirectionBridge` feeds `dir` to Radix `Tabs`/`Select`/`Dialog`; `focus-visible` ring on every control; `24x24px` minimum web target with invisible hit-area expansion; `<Field readOnly>` keeps full contrast and never poses as `disabled`.

---

## 11. Contract Gaps for `P03.T11` (Frozen Contract Reconciliation)

In strict compliance with the brief rules (*"A field, filter, action or route the screen needs that the contracts lack goes in the contract gap list, named as a gap, never written as if it existed"*), `SCR-01` identifies **8 concrete contract gaps** across `02_DTOs.md`, `01_Enums.md`, `01_Foundation_Tables.md`, `02_Endpoint_Catalogue.md`, and `accounting-screen-inventory.md`:

| Gap ID | Affected Surface | Authoritative Source Citations | Exact Discrepancy / Missing Contract | Safe `SCR-01` Design Behavior Today | Recommended `P03.T11` Contract Fix |
| --- | --- | --- | --- | --- | --- |
| **`CG-SCR01-01`** | Tab 2 (`CompanyProfileDetailDto` vs `UpdateCompanyProfileDto`) | `02_DTOs.md` §4.2 lines 129–138, 152, 164–179; `02_DTOs.md` §13.1 Rule 5 (line 4227); `01_Foundation_Tables.md` lines 55–66 | `ActivateCompanyProfileDto` and `UpdateCompanyProfileDto` (`PATCH /company-profile`) accept `legalForm`, `reversalMethod`, `auditorRequired`, `advancePaymentScheme`, `registrationThresholdWatch`, `sandboxFlag`, and (Wave-2) `groupCurrencyCode`, and `acc_company_profiles` stores all 7 columns. However, `CompanyProfileDetailDto` is explicitly declared without them, and §13.1 Rule 5 forbids falling back to ERD columns when a DTO is explicitly declared. Thus `GET /company-profile` **never returns** those 7 fields! | Wizard Step 3 & Step 4 collect and submit them on `POST /activate`; Tab 2 (`profile`) omits them from the post-activation edit form so `PATCH` never blindly overwrites unseen server values. | Add `legalForm`, `reversalMethod`, `auditorRequired`, `advancePaymentScheme`, `registrationThresholdWatch`, `sandboxFlag`, and `groupCurrencyCode: CurrencyCode \| null` to `CompanyProfileDetailDto` in `02_DTOs.md` §4.2. |
| **`CG-SCR01-02`** | Step 4 & Tab 2 (`advancePaymentScheme`, `legalForm`, string max lengths) | `01_Enums.md` lines 119 (`LegalForm`), 134 (`AdvancePaymentScheme`); `01_Foundation_Tables.md` lines 55, 57, 58, 61, 126; `02_DTOs.md` lines 130, 132, 133, 135, 204 | 1) `advancePaymentScheme` is `AdvancePaymentScheme` (`'NONE' \| 'ENROLLED'`, `varchar(32)`) in `01_Enums.md` & `01_Foundation_Tables.md`, but typed `boolean` (`strict boolean, default false`) in `02_DTOs.md` line 135. 2) `legalForm` is closed enum `LegalForm` in `01_Enums.md`, but typed `string // max 64 chars` in `02_DTOs.md` line 130. 3) Max-length tightening in DTO vs ERD: `taxOfficeCode` (`16` vs `varchar(32)`), `syndicateLicenseNumber` (`40` vs `varchar(64)`), `authorityBranchCode` (`16` vs `varchar(32)`). | UI sends strict `boolean` for `advancePaymentScheme`, restricts `legalForm` options to `LegalForm` members (valid strings `<= 64`), and enforces the stricter DTO max lengths (`16`, `40`, `16`) so `forbidNonWhitelisted` / DTO validators never reject. | Align `02_DTOs.md` and `01_Foundation_Tables.md`/`01_Enums.md` on a single type for `advancePaymentScheme` and `legalForm`, and reconcile column vs DTO max lengths. |
| **`CG-SCR01-03`** | Wizard Step 3 (`chartTemplateCode` picker) | `02_DTOs.md` line 120; `03_Interfaces_and_Value_Objects.md` line 475 (`CountryPackManifest`); `02_Endpoint_Catalogue.md` line 152 (`GET /accounting/chart-templates`); `accounting-screen-inventory.md` row `SCR-01` | `ActivateCompanyProfileDto.chartTemplateCode` names an `acc_chart_templates.template_code` of the chosen pack version. Yet `CountryPackVersionDetailDto.manifest.CHART_AND_STATEMENTS` only exposes `{ ref, contentHash, rowCount, status }`, not template codes, and `GET /accounting/chart-templates` is owned by `SCR-02` and omitted from `SCR-01`'s `[S]` endpoints in `accounting-screen-inventory.md`. | Step 3 allows typing `chartTemplateCode` (`max 64`) or joining a shared chart via `[S] GET /charts`, without calling un-inventoried `GET /chart-templates`. | Add `[S] GET /accounting/chart-templates` (`accounting.chart.read`, `TENANT`, with `packCode` filter in `ChartTemplateListQueryDto`) to `SCR-01`'s `[S]` list, or include `chartTemplates: Array<{ templateCode: string; nameI18n: I18nText }>` on `CountryPackVersionDetailDto`. |
| **`CG-SCR01-04`** | Step 4 (`activityCode`) & Tab 4 (`activityCodeOverride`, `posDefaultDeviceId`) | `02_DTOs.md` lines 131, 207, 209; `01_Foundation_Tables.md` lines 60, 128, 130; `02_Endpoint_Catalogue.md` §3 & §6 | 1) `activityCode` and `activityCodeOverride` must match `ACTIVITY_CODES` in `acc_authority_reference_tables` (`D-112`), but **no Endpoint Catalogue route** exposes searching/listing `acc_authority_reference_tables` (`ACTIVITY_CODES`). 2) `CreateBranchFiscalProfileDto.posDefaultDeviceId` references `acc_einvoice_connections.id` (`SCR-13`), which is not in `SCR-01`'s `[S]` list. | Renders validated `dir="ltr"` text inputs (`max 16` chars for ISIC code; optional UUID input for `posDefaultDeviceId`). | 1) Add a read/lookup endpoint `POST /accounting/authority-reference-tables/:tableCode/lookup` (or `GET`) in Module 04/01. 2) Add `[S] GET /accounting/einvoice-connections` (when `accounting.documents.einvoice_eg` is entitled) to `SCR-01` `[S]`. |
| **`CG-SCR01-05`** | Tab 6 (`AdoptCountryPackDto.replayDiffRef`) | `02_DTOs.md` lines 565–573; `02_Endpoint_Catalogue.md` lines 224–228; `01_Foundation_Tables.md` line 1064 (`D-060`, `D-061`) | Post-activation superseding pack adoption (`POST /accounting/country-packs/:versionId/adopt`) requires `replayDiffRef` whenever the replay report has `documentsAffected > 0` (`422 ACCOUNTING.TAX_RULES.REPLAY_DIFFERENCE_UNACKNOWLEDGED`). While Module 03 has `POST /accounting/tax/rule-set-versions/:id/replay`, Endpoint Catalogue §3 has **no** replay preview route on `/accounting/country-packs/versions/:versionId` to generate `replayDiffRef`, `documentsAffected`, and `moneyDelta` prior to adoption! | Adoption modal provides an optional `replayDiffRef` input (`max 256`) and surfaces `ACCOUNTING.TAX_RULES.REPLAY_DIFFERENCE_UNACKNOWLEDGED` clearly if the server demands a replay reference. | Add `POST /accounting/country-packs/versions/:versionId/replay` (`accounting.country_pack.adopt`, `COMPANY`) returning `{ replayDiffRef, documentsAffected, moneyDelta }` (or document how Module 03's tax rule-set replay supplies it). |
| **`CG-SCR01-06`** | Tab 7B (`LegalInterimPoliciesSection`) | `02_Endpoint_Catalogue.md` lines 229–233; `02_DTOs.md` lines 308–313 & §13.1 Rule 4; `04_Errors_and_Constants.md` lines 1217–1223; `16_Regulatory_Requirements_EG.md` §11.3 | `POST /accounting/settings/legal-interim-policies/:code/acknowledge` requires `{ policyVersion, policyTextHash }` matching `ACCOUNTING_LEGAL_READINESS_REGISTER`, while `GET /accounting/settings` omits `jsonb` `value` (§13.1 R4) and returns no rows for unacknowledged policies. | Frontend bundles the shared `ACCOUNTING_LEGAL_READINESS_REGISTER` metadata for display/hash submission and probes `GET /accounting/settings/legal.interim_policy_ack.<code>` for the 4 `INTERIM_POLICY` codes (`L-READY-03`, `04`, `05`, `07`). | Add `GET /accounting/settings/legal-interim-policies` (`accounting.setting.read`, `COMPANY`) returning all register entries (`code`, `mode`, `policyVersion`, `policyTextHash`, `behaviourI18n`, and active company acknowledgement state) in one call. |
| **`CG-SCR01-07`** | Tab 7A (`BRANCH`-scoped settings on `/accounting/settings`) | `02_Endpoint_Catalogue.md` lines 229–231; `02_DTOs.md` lines 109, 575–581; `04_Errors_and_Constants.md` lines 1226–1229; `01_Foundation_Tables.md` lines 1097–1105 | `ACCOUNTING_SETTING_KEYS` allows `BRANCH` scope on `treasury.pos_shift_cutoff_hours` and `numbering.{sales_invoice,credit_note,debit_note}_series`, and `UpsertSettingDto.scopeTarget` accepts `'COMPANY' \| 'BRANCH'`. However: 1) Endpoint Catalogue §3 lines 229–231 fix Scope target of `GET /settings`, `GET /settings/:key`, and `PATCH /settings/:key` to **`COMPANY`** (not `COMPANY_OR_BRANCH`), and 2) `GET /settings/:key` & `PATCH /settings/:key` address by `:key` alone without `scopeTarget`/`branchId`/`effectiveFrom` disambiguation when both `COMPANY` and `BRANCH` rows (or scheduled future rows) exist for the same key! | Tab 7A edits `COMPANY`-scoped effective settings cleanly and disables `BRANCH` scope selection when the route rejects `BRANCH` target, surfacing `ACCOUNTING.SCOPE.TARGET_DENIED` safely if returned. | Change `/accounting/settings` and `/accounting/settings/:key` scope target in Catalogue §3 to `COMPANY_OR_BRANCH`, and add `scopeTarget?` / `effectiveOn?` query params to `GET /accounting/settings/:key` (or address updates by setting row `:id` / composite key). |
| **`CG-SCR01-08`** | Tab 5 (`UpdateLedgerDto` declaration) | `02_Endpoint_Catalogue.md` line 145 (`PATCH /accounting/ledgers/:id`); `02_DTOs.md` §4.4 lines 372–378 & §13.1 | `CreateLedgerDto` is declared in `02_DTOs.md` §4.4, whereas `UpdateLedgerDto` (the body of `PATCH /accounting/ledgers/:id`) is not explicitly written in §4.4 (`§13.1` only auto-derives `*SummaryDto` and `*DetailDto` read projections, not command DTOs). | Tab 5 `EditDrawer` restricts `PATCH /ledgers/:id` to partial non-structural fields (`nameI18n`, `accountingPrinciple`) and locks `code`, `kind`, and `baseLedgerId` as `<Field readOnly>`. | Explicitly declare `interface UpdateLedgerDto` in `02_DTOs.md` §4.4 specifying exact mutable fields (`nameI18n?`, `accountingPrinciple?`) on `PRIMARY` ledgers. |

## Contract reconciliation (P03.T11, 1 November 2026)

Reconciles the gaps of this spec against the Endpoint Catalogue and `02_DTOs.md` after `D-770`, `D-771` and `D-772`. The gap list above keeps the original findings; the rulings are final.

| Gap id | Ruling | Where |
| --- | --- | --- |
| `CG-SCR01-01` | closed by D-770 | `CompanyProfileDetailDto` (`02_DTOs.md` §4.2) returns `legalForm`, `reversalMethod`, `auditorRequired`, `advancePaymentScheme`, `registrationThresholdWatch` and `sandboxFlag`; `groupCurrencyCode` stays out (reserved wave 2, `D-009`) |
| `CG-SCR01-02` | closed by D-770 | `ActivateCompanyProfileDto.legalForm: LegalForm` and `advancePaymentScheme?: AdvancePaymentScheme` (default `NONE`); `UpdateCompanyProfileDto` inherits both; the shorter DTO lengths of the other fields are stricter than their columns and stay |
| `CG-SCR01-03` | already in the contract | `GET /accounting/chart-templates` and `GET /accounting/chart-templates/:id` (Endpoint Catalogue §3, `accounting.chart.read`, `TENANT`); filter client-side by `packCode` and `packVersion` |
| `CG-SCR01-04` | already in the contract | `GET /accounting/authority/reference-tables/:tableCode/entries` (Endpoint Catalogue §6, P22) and `GET /accounting/einvoice-connections` (§6), both gated on `accounting.documents.einvoice_eg`; validated text and UUID inputs until then |
| `CG-SCR01-05` | deferred to stage 2 (P20) | Stage 1 has no fiscal documents, so `documentsAffected` is `0` and `replayDiffRef` stays null; the route that yields the replay report is a P20 definition-of-ready item |
| `CG-SCR01-06` | already in the contract | `ACCOUNTING_LEGAL_READINESS_REGISTER` (`04_Errors_and_Constants.md` §6.2) for the metadata plus `GET /accounting/settings/:key` per code; Tab 7B itself ships with P20.T10 |
| `CG-SCR01-07` | already in the contract | `accounting.setting.update` writes a `BRANCH` row when `x-branch-id` accompanies a `COMPANY` target; reads disambiguate with `GET /accounting/settings` (`SettingListQueryDto`: `key?`, `scopeTarget?`, `effectiveOn?`); the first-row `If-Match` rule is `D-771` (`CG-S3-08`) |
| `CG-SCR01-08` | already in the contract | `PATCH /accounting/ledgers/:id` takes `PartialType(CreateLedgerDto)` (Blueprint §6); `code`, `kind` and `baseLedgerId` are immutable on `PRIMARY` ledgers (`D-151`) |
