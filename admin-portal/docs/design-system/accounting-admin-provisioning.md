# ADM-02 — Admin Portal: Accounting Catalogue Rollout, Tenant Component Addition & Fenced Provisioning Watcher

> **Lead review, 1 November 2026 (P03.T10).** The example feature keys of the Basic and Advanced tiers were replaced by keys of 10_Feature_Tiers.md §6; the seed step keys `accounting.seed.<pack>` follow Platform Changes §4.3. Every route, permission, feature key and scope below was checked against `backend/docs/LLD/accounting-app/02_API_Contracts/02_Endpoint_Catalogue.md`, `04_Static_Data/05_Permissions_and_Features.md` and `10_Feature_Tiers.md`; what the contracts lack stays in the contract gap list for `P03.T11`.

- **Plan Task:** `P03.T10.S6` (`backend/docs/plans/accounting-app-plan-p03-ux-foundation.md`)
- **Screen Inventory Row:** `ADM-02` (`frontend/tenant-portal/docs/plans/accounting-screen-inventory.md`)
- **Target Application:** `frontend/admin-portal` (Port `5001` strictly; Ocean Navy v3 / Cold-Blue Enterprise Design System `@/design-system`)
- **Primary Journey & LLD Authorities:**
  - `backend/docs/LLD/accounting-app/05_Flows/01_User_Journey_Company_Activation.md` (`ACT-01`, `ACT-02`, handoff to `ACT-03`)
  - `backend/docs/LLD/accounting-app/12_Platform_Changes.md` (§4.1–§4.6, §6.2, §10.2, §11 `D-209`, `D-553`, `D-556`, `D-674`, `D-682`–`D-686`)
  - `backend/docs/LLD/accounting-app/08_App_Packages/02_Database_Package.md` (§11 complete 27-pack seed inventory) & `03_Contracts_Package.md` (§3 release & database permission manifests)
  - `backend/docs/LLD/accounting-app/10_Feature_Tiers.md` (`accounting.basic` 28 keys; `accounting.advanced` 64 keys)
  - `backend/docs/LLD/accounting-app/13_Delivery_Plan.md` (§3.4 Stage rollout & §3.6 Vertical Slice `P15`)
  - `frontend/tenant-portal/docs/design/specs/accounting-ia.md` §4, `accounting-status-and-a11y.md`, `accounting-patterns-documents.md`
  - `frontend/admin-portal/docs/design-system/{README.md, operational-ux.md, shell-and-navigation.md, patterns.md, tokens.md}` & `docs/api/{catalog.md, database-servers.md, subscriptions.md, tenants.md, tenant-operations.md}`
- **Browser API Boundary:** Exclusively `core-app` via canonical Gateway prefix `/api/admin/core/v1/...`. `accounting-app` exposes `allowedMasters: ['tenant']` only (`/api/tenant/accounting/v1/*`, `12_Platform_Changes.md` §6.2); Admin Portal never calls `accounting-app` or `worker-app` for `ADM-02`.

---

## 1. Architectural Scope: Vertical Slice (`P15`) vs Full-Stage Additions

### 1.1 Control-Plane Rollout Order & Critical Onboarding Guardrail

Enabling `accounting` for a tenant spans five existing Admin Portal touchpoints in strict causal order (`12_Platform_Changes.md` §10.2):

```
[1] /database-servers (+ /[id])           Stage-0 role ensure (mutakamel_accounting_app +
                                          mutakamel_accounting_recovery NOLOGIN) & Stage-1 server bind
        │
        ▼
[2] /applications-catalogue/accounting    Verify seeded application + readiness + permission manifest,
                                          author Basic/Advanced tiers & USD ladders, Publish → Activate → Bind DB servers
        │
        ▼
[3] /provisioning                         Inspect active component 'accounting', release
                                          AccountingTenantBaseline1800000000200, and 27 seed-pack pins
        │
        ▼
[4] /subscriptions | /tenants/new |       Entitle tenant to 'accounting' (Basic or Advanced tier)
    /tenants/[id]?tab=billing             via Initial Quote/Seed or Commercial Preparation → Preview → Apply
        │
        ▼
[5] /tenants/[id]?tab=provisioning        ACT-01: Dispatch add-application (or watch commercial/initial
                                          operation), monitor fenced steps accounting.schema →
                                          accounting.seed.<pack> → accounting.verify, and recover named failures
        │
        ▼ (Handoff across portal boundary — D-508)
[Tenant Portal :5002 SCR-01]              ACT-02 records core.tenant.org_company_changed.v1 as a processed no-op;
                                          Chief Accountant executes ACT-03..ACT-14 (pack adoption, activation, opening balances)
```

> **CRITICAL ONBOARDING GUARDRAIL (`D-209`, `D-682`, `12_Platform_Changes.md` §4.2):**
> Operators **must never** register `accounting` through `POST /api/admin/core/v1/applications/onboarding` (`/applications/onboarding`). Core's onboarding command derives `primaryComponentKey: 'app.<key>'` (`app.accounting`), whereas `accounting` uses the bare provisioning component key **`accounting`** (matching `crm` and `trade`). `accounting` enters the control plane **exclusively via platform seed** (`APPLICATION_CATALOGUE_ROOT_DEFINITIONS` + `CATALOG_SEED`) as `lifecycleStatus: "DRAFT"`, `publicationStatus: "UNPUBLISHED"`, `databaseAccessMode: "TENANT_DATABASE"`, `databaseDeployment: "ON_DEMAND"`, `enableOnNewServers: false`, `databasePrincipal: "mutakamel_accounting_app"`.
> **UI Enforcement:** In `/applications/onboarding`, typing `key === "accounting"` immediately triggers a client-side inline refusal alert pointing the operator to `/applications-catalogue/accounting` (`Link` from `next/link`).

### 1.2 Vertical Slice (`13_Delivery_Plan.md` §3.6 / `P15`) vs Full-Stage Matrix

Every `ADM-02` surface participates in the Vertical Slice (`P15`). The table below separates what ships and is exercised in the **Vertical Slice subset** from **Full-Stage additions** (`Stage 0`, `Stage 1 Full`, `Stage 2`, `Stage 6`):

| Surface / Capability | Vertical Slice Subset (`13_Delivery_Plan.md` §3.6 / `P15`) | Full-Stage Additions (`Stage 0`, `Stage 1 Full`, `Stage 2`, `Stage 6`) |
| --- | --- | --- |
| **Database Server Roles (`/database-servers`, `/database-servers/[id]`)** | Bind at least one eligible `ACTIVE` PostgreSQL server to `accounting` via `/applications-catalogue/accounting` (`POST .../database-servers/bind`) or per-server bootstrap (`POST /database-servers/:id/applications/accounting/bootstrap`), issuing `LOGIN` credentials for `mutakamel_accounting_app` while `mutakamel_accounting_recovery` remains `NOLOGIN`. | **Stage 0 (`CG-15`):** Fleet-wide `POST /api/admin/core/v1/database-servers/application-roles/accounting/ensure` (`recoveryLogin: false`) across all `DRAFT`/`ACTIVE`/`DRAINING` servers before `accounting` activation.<br>**Stage 2 (`ADM-03`):** Re-run role ensure with `recoveryLogin: true` + `accounting_recovery` credential vaulting before backup restore drills.<br>**Stage 1+:** Per-server credential reconcile/regenerate (`POST .../credential/reconcile`, `.../regenerate`) and `enableOnNewServers` policy toggle. |
| **Catalogue & Commercial Setup (`/applications-catalogue/accounting`)** | Read seeded `accounting` (`DRAFT` + `UNPUBLISHED`), verify `GET .../technical-provisioning` (`READY`) and `GET .../database-manifests` (`ACCOUNTING_APPLICATION_DATABASE_PERMISSION_MANIFEST_V1`), verify the seeded `accounting.basic` tier (28 MVP keys — `accounting.ledger.core` + `accounting.receivables.core` exercised in slice; `CATALOG_SEED` carries the 64 feature keys and the tier grants, `12_Platform_Changes.md` §4.1 change 23 and §4.2) and set the USD price ladder, run `Publish` → `Activate` → `Bind Database Servers` (`<= 5` servers/batch). | **Stage 1 Full / Stage 4–5:** Full `accounting.advanced` tier (all 64 feature keys = 28 Basic + 36 Advanced) + multi-bracket monthly/annual ladders, `Adopt technical package`, `Update database policy` (rotation window), `Deprecate` / `Disable` lifecycle controls, and `CatalogueAuditPageView` history tab. *(No commercial Addons exist for `accounting` in MVP; Addons tab shows empty state.)* |
| **Provisioning Governance (`/provisioning`)** | Read-only verification in **Components** & **Releases** tabs that component `accounting` (`kind: "MODULE"`, `ownerApp: "accounting"`, `requiredComponents: { "core.foundation": [MUTAKAMEL_APP_VERSION] }`) and release `AccountingTenantBaseline1800000000200` are `ACTIVE` / `PUBLISHED`. | **Stage 1+ Ops:** Release Draft validation/publish (`release-drafts`), Fleet Rollout Previews & Rollouts (`fleet-rollouts` for future schema/seed updates), Discovery Runs (`discovery-runs` drift scan across fleet), and Worker Event Verification Keys. |
| **Commercial Entitlement (`/subscriptions`, `/tenants/new`, `/tenants/[id]?tab=billing`)** | Enable `accounting` (`accounting.basic`) on one existing pilot tenant via `POST /subscriptions/:id/preparations` → `plan-change-previews` → `apply` (or on a newly created tenant via `POST /subscriptions/quote` + `POST /tenants`). Verify `accounting` requires **no** `trade` subscription (`D-683`). | **Stage 1 Full+:** Zero-migration tier upgrade/downgrade between `accounting.basic` (28 keys) and `accounting.advanced` (64 keys) on live tenants; seat-bracket adjustments; `/subscriptions/[tenantId]` narrow-permission billing view; commercial operation recovery (`RECONCILE` / `CANCEL_PREPARATION`). |
| **Tenant Provisioning & Failing-Step Watcher (`/tenants/[id]?tab=provisioning`)** | **Core `ACT-01` slice proof:** Dispatch `POST .../provisioning/operations/add-application` with `applicationKey: "accounting"` (or watch the operation spawned by commercial apply / tenant creation). Live-watch `OperationDetail` + `OperationTimeline` across:<br>1. `accounting.schema` (`AccountingTenantBaseline1800000000200`)<br>2. All **27** declared `accounting.seed.<pack>` steps carrying slice content (`accounting.permissions`, `accounting.role-templates`, `accounting.settings`, `accounting.fx-rate-providers`, `accounting.iban-registry`, `accounting.neutral-reporting`, `accounting.eg.*` [12 packs], `accounting.base.*` [9 packs] — see `02_Database_Package.md` §11 & `CG-ADM02-03`)<br>3. `accounting.verify` (`manifestChecksum` + `acc_create_journal_lines_partition(integer)` grant + `L`-table `UPDATE`/`DELETE` `DENY` check)<br>Surface **named failing step** (`stepKey`, `kind`, `attemptCount`, `safeError`, `stall`, `correlationId`) and execute `Re-provision` (`retry`), `Resync`, or `Request cancel`. | **Stage 1 Full:** Full statutory content populated inside all 12 `accounting.eg.*` and 9 `accounting.base.*` seed packs; `State` sub-tab `PATCH_IF_UNMODIFIED` seed conflict resolution (`POST .../seed-conflicts/:seedStateId/resolve` with `KEEP_TENANT_VALUE` / `APPLY_RELEASE_VALUE_IF_UNMODIFIED` / `SKIP_THIS_RELEASE`); component `Repair` (`POST .../operations/repair`); component `Updates` (`POST .../updates/apply`) + backup/maintenance `Prerequisites` recovery (`resend-release` / `close-failed`).<br>**Stage 6 (`ADM-06`):** Retained `Decommission` (`POST .../operations/decommission` running `accounting.decommission-retained` -> `DISABLED_RETAINED`, revoking writes without `DROP`, `D-079`). |

### 1.3 Post-Provisioning Handoff to Tenant Portal (`ACT-01` → `ACT-02` → `ACT-03`)

1. **`ACT-01` completes in Admin Portal** when operation status reaches `SUCCEEDED`, `TenantComponentInstallation` for `componentKey: "accounting"` transitions to `state: "READY"`, and all 27 `TenantSeedState` rows reach `APPLIED` (or `NOOP`).
2. **`ACT-02` is invisible by design (`D-508`):** Core's `core.tenant.org_company_changed.v1` (`action: "created"`) event is consumed by `accounting.core-organization` as a **processed no-op** in `acc_inbox_events`. Admin Portal creates **zero** `acc_company_profiles` rows and never chooses functional currency, fiscal calendar, chart of accounts, tax regime, or activation date.
3. **Operator Completion Callout on `SUCCEEDED`:** When an `ADD_APPLICATION` (or `INITIAL_PROVISION`) operation containing `accounting` transitions to `SUCCEEDED`, `/tenants/[id]?tab=provisioning` renders a non-blocking informational handoff banner (`Badge tone="success"` + `Card` note) stating that database schema, seed packs, and privilege verification succeeded, and that the tenant's Chief Accountant must now complete Company Activation (`SCR-01`, `ACT-03..ACT-14`) in the Tenant Portal.

---

## 2. Surface-by-Surface Layout, Custom Hooks & `@/design-system` Composition

All views strictly follow the Admin Portal **Separation of Logic and HTML View** contract (`AGENTS.md`):
- **Hooks (`hooks/use*.ts`)** own HTTP calls via `axiosClient`, response envelope unwrapping (`extractCoreData`, `extractCoreMeta`), runtime reader validation (`model/readers.ts`), UUIDv7 idempotency-key lifecycle (`generateUUIDv7`), Disruption Guard polling (`3 s → 15 s → 60 s`), and modal confirmation state.
- **View components (`*.tsx`)** import UI primitives and patterns **exclusively from `@/design-system`** (`PageHeader`, `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `Tabs`, `TabsList`, `TabsTrigger`, `DataTable`, `Table`, `FilterBar`, `Button`, `Badge`, `StatusBadge`, `Progress`, `Field`, `Input`, `Textarea`, `Select`, `Checkbox`, `Dialog`, `ConfirmActionModal`, `AmbiguousOutcomePanel`, `PermissionGate`, `EmptyState`, `ErrorState`, `Skeleton`) and `Link` from `next/link`.

### 2.1 Surface A — Database Servers (`/database-servers` & `/database-servers/[id]`)

- **Custom Hooks:** `useDatabaseServers` (fleet list + Stage-0 role-ensure command state) and `useDatabaseServerDetail` (per-server application bindings, bootstrap, and credential reconcile/regenerate).
- **Layout & Component Composition:**
  1. **Fleet Header (`/database-servers` — Stage-0 Addition, gated on `CG-15`):**
     - `PageHeader` with primary `Register Server` CTA (`admin.database_servers.create`) and secondary `Ensure Application Roles` (`ضمان أدوار التطبيقات`) outline button gated by `adminCanAll(user, ADMIN_RBAC_CRITICAL.DATABASE_SERVERS_UPDATE)`.
     - **Contract-Gap Honesty Rule:** Until P05.T05 ships `POST /api/admin/core/v1/database-servers/application-roles/accounting/ensure` (`12_Platform_Changes.md` §4.1 change 35 and §4.6; `CG-15`), the button is **not wired to a fake endpoint**; instead, in Stage 1 Slice, operators bind servers via `/applications-catalogue/accounting` (`POST .../database-servers/bind`) or per-server bootstrap below. Once `CG-15` lands, clicking `Ensure Application Roles → accounting` opens a `Dialog` with `reason` (`Input`, required `1..256` chars) and Stage-2 `recoveryLogin` (`Checkbox`, default `false` in Stage 0 so both `mutakamel_accounting_app` and `mutakamel_accounting_recovery` are created `NOLOGIN`).
  2. **Server Detail Application Bindings Card (`/database-servers/[id]` — Vertical Slice & Stage 1):**
     - Mounted inside `/database-servers/[id]` under the **Application Bindings** (`ربط التطبيقات`) `Card` reading `GET /api/admin/core/v1/database-servers/:id/applications`.
     - Displays the `accounting` row with `databasePrincipal: "mutakamel_accounting_app"`, `bindingStatus` (`READY` | `PENDING` | `DEGRADED` | `UNBOUND`), `credentialRevision`, `safeFailureCode`, and row actions:
       - **Slice action:** `Bootstrap accounting` (`تهيئة المحاسبة`) → `POST /api/admin/core/v1/database-servers/:id/applications/accounting/bootstrap` (`ConfirmActionModal`, `ADMIN_RBAC_CRITICAL.DATABASE_SERVERS_UPDATE`).
       - **Full-Stage actions:** `Reconcile Credential` (`مطابقة الاعتماد`) → `POST .../credential/reconcile` and `Regenerate Credential` (`إعادة توليد الاعتماد`) → `POST .../credential/regenerate` (`ADMIN_RBAC_CRITICAL.DATABASE_SERVERS_CREDENTIALS_ROTATE`).

### 2.2 Surface B — Applications Catalogue Detail (`/applications-catalogue/accounting`)

- **Custom Hooks:** `useApplicationDetail("accounting")`, `useApplicationTechnicalProvisioning("accounting")`, `useApplicationTiersAndPricing(applicationId)`, and `useApplicationDatabaseBind("accounting")`.
- **Layout & Component Composition (`max-w-[1600px]`, dense 2-column executive header + 5-tab workspace):**
  1. **`PageHeader` & Authority Rail:**
     - Title: `Accounting` / `المحاسبة` + immutable key badge `<bdi dir="ltr" class="font-mono">accounting</bdi>`.
     - Status badges (`Badge` with icon + label): `lifecycleStatus` (`DRAFT` → `ACTIVE`), `publicationStatus` (`UNPUBLISHED` → `PUBLISHED`), `databaseDeployment` (`ON_DEMAND`), `commercialMode` (`SUBSCRIPTION`), `catalogueVisibility` (`PUBLIC`).
     - Action bar (gated by `adminCanAll(user, ADMIN_RBAC_CRITICAL.APPLICATIONS_UPDATE)`):
       - `Publish` (`نشر التطبيق`) — enabled when `publicationStatus === "UNPUBLISHED"` or `hasPendingDraft === true`; opens `ConfirmActionModal` with `reason` input (`PublishApplicationDto`).
       - `Activate` (`تفعيل التطبيق`) — enabled when `lifecycleStatus === "DRAFT"` and `technicalReadiness.activationAllowed === true`; opens `ConfirmActionModal` with `reason` input (`ApplicationLifecycleCommandDto`).
       - `Bind Database Servers` (`ربط خوادم قواعد البيانات`) — gated by `adminCanAll(user, ADMIN_RBAC_CRITICAL.DATABASE_SERVERS_UPDATE)`; opens `ApplicationDatabaseBindDialog` (`<= 5` servers per batch, `MAX_BULK_APPLICATION_BIND_SERVERS = 5`).
  2. **Tab 1 — `Technical Readiness & Manifests` (`الجاهزية التقنية والبيانات`) — *Vertical Slice*:**
     - **Readiness Checklist `Card`** (`GET /applications/accounting/technical-provisioning`): 6 boolean gates (`runtimeTarget: "accounting-app"`, `componentBinding: "accounting"`, `activeComponents`, `publishedReleases: "AccountingTenantBaseline1800000000200"`, `minimumReleases`, `databasePermissionManifest`), plus `selectionBlockers[]` & `reasons[]` rendered with Cause/Effect/Action hints if `BLOCKED`.
     - **Database Permission Manifest `Card`** (`GET /applications/accounting/database-manifests`): displays active `ACCOUNTING_APPLICATION_DATABASE_PERMISSION_MANIFEST_V1` (`version`, `checksum` SHA-256 in `dir="ltr"`, `contractPackage: "@mutakamel/accounting-contracts"`, `publicationSource`, `publishedAt`), summarizing the verified grants (`mutakamel_accounting_app` table CRUD without `UPDATE`/`DELETE` on `L` ledger tables, `EXECUTE` on `acc_create_journal_lines_partition(integer)`, `DENY` on `SET session_replication_role`, and `mutakamel_accounting_recovery` role definition, `D-553`/`D-674`).
     - **Database Server Coverage `Card`** (`ApplicationView.serverSummary` + `GET /applications/accounting/database-servers`): KPI strip (`eligible`, `ready`, `pending`, `degraded`, `coveragePercent%`) + candidate server `Table` with multi-select checkboxes capped at `5` rows (`BindApplicationDatabaseServersDto`).
  3. **Tab 2 — `Tiers, Features & Price Ladders` (`الباقات والميزات وسلالم الأسعار`) — *Slice (`Basic`) + Full-Stage (`Advanced`)*:**
     - **Features Catalogue (`GET/POST /applications/:applicationId/features`):** Lists the 64 immutable `accounting.*` feature keys from `10_Feature_Tiers.md` (28 Basic + 36 Advanced).
     - **Tiers & Grants (`GET/POST /applications/:applicationId/tiers`, `GET/PATCH /tiers/:tierId/features`):**
       - `accounting.basic` (`Basic` / `الأساسية`, `rank: 1`): 28 MVP feature keys (`accounting.ledger.core`, `accounting.receivables.core`, `accounting.payables.core`, `accounting.tax.engine`, `accounting.documents.einvoice_eg`, `accounting.treasury.bank_reconciliation`, etc.).
       - `accounting.advanced` (`Advanced` / `المتقدمة`, `rank: 2` — *Full-Stage*): all 28 Basic keys + 36 Advanced keys (64 total: `accounting.ledger.multi_ledger`, `accounting.ledger.budgets`, `accounting.treasury.payment_gateway`, `accounting.integration.intercompany`, `accounting.platform.multi_country`, etc.).
     - **Price Ladders (`GET/PATCH /tiers/:tierId/price-tiers`):** Per-cycle (`MONTHLY` / `ANNUAL`) marginal user-seat brackets (`minUsers`, `maxUsers`, `unitPrice` decimal USD string preserved verbatim, `expectedPricingRevision`, `reason`).
  4. **Tab 3 — `Database Policy` (`سياسة قاعدة البيانات`) — *Full-Stage*:** `PATCH /applications/accounting/database-policy` (`enableOnNewServers`, `rotationEnabled`, `rotationIntervalHours`, `maintenanceWindowStartUtc`, `maintenanceWindowHours`, `expectedPolicyRevision`, `reason`).
  5. **Tab 4 — `Audit History` (`سجل التدقيق`) — *Full-Stage*:** `GET /applications/:applicationId/audit` paginated `DataTable`.

### 2.3 Surface C — Provisioning Governance Hub (`/provisioning`)

- **Custom Hook:** `useProvisioningGovernance` (`src/features/admin/provisioning-governance/`).
- **Layout & Component Composition:**
  - **Vertical Slice Tabs (`Components` & `Releases`):**
    - `Components` `DataTable` (`GET /api/admin/core/v1/provisioning/components`, permission `admin.tenants.read`): displays row `key: "accounting"`, `ownerApp: "accounting"`, `kind: "MODULE"`, `status: "ACTIVE"`, `required: false`, `activationRequired: true`, `requiredComponents: core.foundation`. Selecting `accounting` filters the `Releases` drawer/table (`GET /provisioning/components/:componentId/releases`).
    - `Releases` `DataTable` & Detail Drawer (`GET /api/admin/core/v1/provisioning/releases` & `/:releaseId`, permission `admin.provisioning.releases.read`): shows `schemaTarget: "AccountingTenantBaseline1800000000200"`, `manifestChecksum` (64-hex `dir="ltr"`), `riskLevel`, `requiresBackup`, `requiresMaintenance`, and the ordered 27 seed-pack manifest definitions.
  - **Full-Stage Tabs (`Release Drafts`, `Fleet Rollouts`, `Discovery Runs`, `Verification Keys`):** Used when shipping post-baseline schema/seed updates across existing Accounting tenants or auditing fleet schema drift (`POST /provisioning/discovery-runs`).

### 2.4 Surface D — Commercial Enablement (`/subscriptions`, `/tenants/new`, `/tenants/[id]?tab=billing`)

- **Custom Hooks:** `useInitialCommercialQuote` (`/tenants/new` & initial seed) and `useCommercialChangeWorkspace` (`/tenants/[id]?tab=billing` & `/subscriptions/[tenantId]`).
- **Layout & Component Composition:**
  1. **Existing Tenant Enablement (`/tenants/[id]?tab=billing` — Primary Commercial Path in Slice):**
     - Mounts `CommercialChangeWorkspace` (`src/features/admin/subscriptions/commercial-change/CommercialChangeWorkspace.tsx`).
     - Operator clicks `+ Add Application` (`+ إضافة تطبيق`), selects `Accounting` (`المحاسبة`), picks tier `Basic` (`accounting.basic` — Vertical Slice) or `Advanced` (`accounting.advanced` — Full-Stage), and enters `seats` (`1..100000`).
     - **Independence Notice (`D-683`):** Unlike add-ons, `accounting` is a standalone base Application (`requiredComponents: { "core.foundation": [...] }`). If `trade` is not subscribed, the card displays a calm informational note: *"Accounting operates standalone; Trade automatic posting activates only when Trade is also subscribed and meets floor compatibility"* / *"تعمل المحاسبة باستقلالية؛ ولا يعمل الترحيل الآلي من التجارة إلا عند الاشتراك في التجارة واستيفاء الحد الأدنى للتوافق"*.
     - **3-Step Governed Commercial Commit:**
       1. `Prepare` (`تحضير التغيير`) → `POST /api/admin/core/v1/subscriptions/:id/preparations` (`202` durable preparation). If an existing component lags its current release, Core returns `409 TENANT_PROVISIONING_RELEASE_UPGRADE_REQUIRED` and the banner renders a direct CTA switching to `/tenants/[id]?tab=provisioning` (`Updates` section).
       2. `Price Preview` (`معاينة التسعير`) → `POST /api/admin/core/v1/subscriptions/:id/plan-change-previews` (`201`, 5-minute quote expiry `<time dateTime=...>`).
       3. `Apply` (`اعتماد وتطبيق`) → `POST /api/admin/core/v1/subscriptions/:id/plan-change-previews/:previewId/apply` (`200` original 9-field receipt, `ADMIN_RBAC_CRITICAL.SUBSCRIPTIONS_UPDATE`).
     - **Zero-Migration Tier Upgrade (`Basic` ↔ `Advanced`):** Changing `accounting` between `accounting.basic` and `accounting.advanced` updates `accessPolicyRevision` and feature entitlements (`28` vs `64` keys) with **zero** tenant database migration (`10_Feature_Tiers.md` §1).
  2. **New Tenant Creation (`/tenants/new`):** Step 2 (`Commercial Selection`) includes `Accounting` once `accounting` is `ACTIVE` + `PUBLISHED` + bound to at least one eligible database server in the selected placement region (`GET /tenants/database-placement-options`), previews the plan via `POST /tenants/provisioning-plans`, quotes via `POST /subscriptions/quote`, and submits `POST /tenants` (spawning `INITIAL_PROVISION` containing `accounting.schema` → 27 `accounting.seed.*` → `accounting.verify`).

### 2.5 Surface E — Tenant Workspace Provisioning Tab (`/tenants/[id]?tab=provisioning` — Primary `ACT-01` Screen)

- **Custom Hooks:** `useTenantProvisioning` + `useTenantProvisioningWorkspace` (`src/features/admin/tenant-workspace/provisioning/hooks/`), extended with `useAccountingTargetPrefill` (reads `GET /provisioning/components` + `GET /provisioning/components/:componentId/releases` so operators never hand-type UUIDv7s or 64-char SHA-256 checksums).
- **5-Section Workspace Architecture (`Tabs` inside `TenantProvisioningWorkspaceView`):**
  1. **`Operations` (`العمليات`) — *Vertical Slice Primary View*:**
     - **Start-side Master Rail (`19rem` on `xl`):** Newest-first list of `TenantOperationSummary` cards (`ADD_APPLICATION`, `INITIAL_PROVISION`, `RETRY`, `UPDATE`, `REPAIR`, `DECOMMISSION`) with `generation`, `requestedAt`, `StatusBadge`, `currentPhase` localized via `provisioningStepLabel`, and `LoadMoreFooter` (`Showing {shown} of {total}`).
     - **End-side Detail Pane (`minmax(0,1fr)`):**
       - **Header Card:** Operation `type` + `generation`, localized `currentPhase`, `StatusBadge` (spinner only when `status === "RUNNING"` and `!operation.stall`), `StalledBadge` (amber `Hourglass` naming `stall.stepKey` and `ageSeconds`), weighted `Progress` bar (`completedSteps/totalSteps`, `failedSteps`, `accessPolicyRevision`, `planDigest` short hex, `requestedAt`), and `exits`-gated operator buttons:
         - `Re-provision` (`إعادة التهيئة`) — `variant="primary"`, calls `POST .../operations/:operationId/retry` when `exits.retry.allowed`.
         - `Request cancel` (`طلب الإلغاء`) — `variant="destructive"`, calls `POST .../operations/:operationId/cancel` when `exits.cancel.allowed`.
         - `Resync` (`مزامنة التقدم`) — `variant="outline"`, calls `POST .../operations/:operationId/resync` when `exits.resync.allowed`.
       - **Prominent Named Failing-Step Alert Callout (`FailingStepCallout` — *ADM-02 Required Enhancement*):**
         Whenever `operation.progress.failedSteps > 0` or any step in `operation.steps` has `status === "FAILED" | "CONFLICT"` (even if the step is row #19 of 29 in the table below), a dedicated `role="alert"` callout card renders **above** the step table naming every failing step explicitly:
         - Localized step name (`المحاسبة — قواعد الضرائب (مصر)` / `Accounting — Tax rules (Egypt)`) + LTR monospace `stepKey` (`accounting.seed.accounting.eg.tax-rules`).
         - Step metadata strip: `kind` (`SYSTEM_SEED`), `producer` (`accounting-app`), `attemptCount` + retryability (`Attempt 2 · Retryable` / `المحاولة 2 · قابلة لإعادة المحاولة` vs `Terminal / Manual recovery`), `targetVersion` (`1.0.0`), and `finishedAt`.
         - Safe error block: `<bdi dir="ltr" class="font-mono">safeError.code</bdi>` + `safeError.message` + localized **Cause / Effect / Safe Next Action** guidance from `provisioningSafeCodeHint` + `correlationId` when surfaced from a command error, plus a `Jump to step row` (`الانتقال إلى صف الخطوة`) anchor link (`#step-row-<step.id>`).
       - **Ordered Fenced Step Table (`Table`):** Displays every `TenantOperationStep` in plan order:
         - Row 1: `accounting.schema` (`SCHEMA`, `producer: "accounting-app"`)
         - Rows 2–28: The **27** `accounting.seed.<pack>` steps (`CONFIG` for `accounting.settings`; `SYSTEM_SEED` for the other 26 packs)
         - Row 29: `accounting.verify` (`VERIFICATION`, `producer: "accounting-app"`)
         - *(When `INITIAL_PROVISION`, preceded by `database.create` and `core.foundation.*` and followed by `tenant.activate`.)*
         - Failed/conflicted rows receive `bg-destructive-subtle/40 border-s-2 border-s-destructive` plus `AlertTriangle` `StepBadge` so they are visually unmistakable without relying on colour alone.
       - **Operation Event Timeline (`ol`):** Chronological/reverse-chronological `TenantOperationTimelineEvent` stream (`OPERATION_PLANNED`, `STEP_STARTED`, `STEP_FAILED`, `STEP_SUCCEEDED`, `OPERATION_SUCCEEDED`) with `#sequence`, `occurredAt`, `actor`, and `LoadMoreFooter`.
  2. **`Managed actions` (`إجراءات مُدارة`) — *Vertical Slice (`Add Application`) + Full-Stage (`Repair`, `Decommission`)*:**
     - **`Add Application` Command Card (`إضافة تطبيق`):**
       - Replaces raw UUID/checksum typing with an **Evidence-Prefilled Application Selector**:
         - `Application` `Select` (`applicationKey`): selecting `"accounting"` reads the tenant's latest `accessPolicyRevision` (from `latestOperation.accessPolicyRevision` or subscription detail) and resolves the active `accounting` component + latest published release (`componentId`, `targetReleaseId`, `targetReleaseVersion`, `targetManifestChecksum`) from `GET /provisioning/components` & `GET /provisioning/components/:componentId/releases`.
         - Displays a read-only **Pinned Target Evidence** summary box (`componentKey: accounting`, `releaseVersion`, `schemaTarget: AccountingTenantBaseline1800000000200`, `manifestChecksum` in `dir="ltr"`), with an optional `Override pinned evidence` disclosure for break-glass testing.
         - `Reason code` `Input` (`reasonCode`, pattern `^[A-Z][A-Z0-9._-]{2,95}$`, e.g. `ENABLE_ACCOUNTING_PILOT`, with quick-preset chips `ENABLE_ACCOUNTING_SUBSCRIPTION`, `OPS_PROVISION_ACCOUNTING`).
         - Submitting opens `ConfirmActionModal`, dispatches `POST /api/admin/core/v1/tenants/:tenantId/provisioning/operations/add-application` with `x-idempotency-key` (UUIDv7), automatically switches `model.section` to `"operations"`, and selects the newly returned `operationId` for live watching!
     - **`Repair Component` Card (`إصلاح مكوّن` — *Full-Stage*):** Selects `accounting` from `TenantComponentInstallation` and posts `CreateRepairOperationDto` (`POST .../operations/repair`).
     - **`Retained Decommission` Card (`إيقاف مع الاحتفاظ بالبيانات` — *Stage 6 / `ADM-06`*):** Selects `accounting`, requires ticking `retentionAcknowledged` + `DestructiveActionModal` name-typing confirmation, and posts `CreateDecommissionOperationDto` (`POST .../operations/decommission`), executing `accounting.decommission-retained` (`DISABLED_RETAINED`, never `DROP`, `D-079`).
  3. **`State` (`الحالة`) — *Vertical Slice Read + Full-Stage Seed Conflict Resolution*:**
     - **Installed Components `Table`:** Shows `accounting` (`ownerApp: "accounting"`, `selectionSource: "ENTITLEMENT"`, `state: "READY" | "INSTALLING" | "FAILED" | "DISABLED_RETAINED"`, `desired.releaseVersion`, `applied.releaseVersion`).
     - **Seed States List (`27` `accounting` packs):** Filterable by `componentKey = "accounting"` and `status`. Any `PATCH_IF_UNMODIFIED` pack in `status === "CONFLICT"` exposes the inline conflict-resolution bar (`decision`: `KEEP_TENANT_VALUE` | `APPLY_RELEASE_VALUE_IF_UNMODIFIED` | `SKIP_THIS_RELEASE` + `reasonCode` + `Resolve Conflict` button calling `POST .../seed-conflicts/:seedStateId/resolve` gated by `seed.revision !== null`).
  4. **`Updates` (`التحديثات`) — *Full-Stage*:** Lists `TenantAvailableUpdate` cards when a newer `accounting` release is published and dispatches `POST .../provisioning/updates/apply`.
  5. **`Prerequisites` (`المتطلبات`) — *Full-Stage*:** Displays backup and maintenance-fence evidence (`GET .../prerequisite-evidence`) and recovery controls (`Resend release` / `Close failed`) when an `accounting` update or repair requires a backup or maintenance fence.

### 2.6 Authoritative Bilingual Step Dictionary for `step-labels.ts` (All 30 `accounting` Keys)

`src/features/admin/tenant-workspace/provisioning/model/step-labels.ts` must add `accounting: ["Accounting", "المحاسبة"]` to `COMPONENTS` and the exact 28 non-generic step keys below to `STEPS` (`accounting.schema` and `accounting.verify` resolve automatically via `SUFFIXES` to `"Accounting — schema"` / `"المحاسبة — المخطط"` and `"Accounting — verification"` / `"المحاسبة — التحقق"`):

| # | Wire `stepKey` (`02_Database_Package.md` §11 & `12_Platform_Changes.md` §4.3) | `kind` | Seed Policy | English UI Label (`compose`) | Arabic UI Label (`compose`) |
| ---: | --- | --- | --- | --- | --- |
| 1 | `accounting.schema` | `SCHEMA` | — | `Accounting — schema` | `المحاسبة — المخطط` |
| 2 | `accounting.seed.accounting.permissions` | `SYSTEM_SEED` | `SYSTEM_MANAGED` | `Accounting — Permissions` | `المحاسبة — الصلاحيات` |
| 3 | `accounting.seed.accounting.role-templates` | `SYSTEM_SEED` | `PATCH_IF_UNMODIFIED` | `Accounting — Role templates` | `المحاسبة — قوالب الأدوار` |
| 4 | `accounting.seed.accounting.settings` | `CONFIG` | `PATCH_IF_UNMODIFIED` | `Accounting — Accounting settings` | `المحاسبة — إعدادات المحاسبة` |
| 5 | `accounting.seed.accounting.fx-rate-providers` | `SYSTEM_SEED` | `PATCH_IF_UNMODIFIED` | `Accounting — Exchange-rate providers` | `المحاسبة — مزوّدو أسعار الصرف` |
| 6 | `accounting.seed.accounting.iban-registry` | `SYSTEM_SEED` | `SYSTEM_MANAGED` | `Accounting — IBAN country registry` | `المحاسبة — سجل دول الآيبان (IBAN)` |
| 7 | `accounting.seed.accounting.neutral-reporting` | `SYSTEM_SEED` | `SYSTEM_MANAGED` | `Accounting — Neutral reporting definitions` | `المحاسبة — تعريفات التقارير المحايدة` |
| 8 | `accounting.seed.accounting.eg.country-pack` | `SYSTEM_SEED` | `SYSTEM_MANAGED` | `Accounting — Egypt country pack` | `المحاسبة — حزمة دولة مصر` |
| 9 | `accounting.seed.accounting.eg.reference-tables` | `SYSTEM_SEED` | `SYSTEM_MANAGED` | `Accounting — Egypt reference tables` | `المحاسبة — الجداول المرجعية (مصر)` |
| 10 | `accounting.seed.accounting.eg.authority-parameters` | `SYSTEM_SEED` | `SYSTEM_MANAGED` | `Accounting — Egypt tax authority parameters` | `المحاسبة — معلمات مصلحة الضرائب (مصر)` |
| 11 | `accounting.seed.accounting.eg.statutory-document-rules` | `SYSTEM_SEED` | `SYSTEM_MANAGED` | `Accounting — Egypt statutory document rules` | `المحاسبة — قواعد المستندات الإلزامية (مصر)` |
| 12 | `accounting.seed.accounting.eg.tax-rules` | `SYSTEM_SEED` | `SYSTEM_MANAGED` | `Accounting — Egypt tax rules` | `المحاسبة — قواعد الضرائب (مصر)` |
| 13 | `accounting.seed.accounting.eg.return-definitions` | `SYSTEM_SEED` | `SYSTEM_MANAGED` | `Accounting — Egypt tax return definitions` | `المحاسبة — تعريفات الإقرارات الضريبية (مصر)` |
| 14 | `accounting.seed.accounting.eg.chart` | `SYSTEM_SEED` | `CREATE_ONCE` | `Accounting — Egypt chart templates` | `المحاسبة — قوالب دليل الحسابات (مصر)` |
| 15 | `accounting.seed.accounting.eg.report-definitions` | `SYSTEM_SEED` | `PATCH_IF_UNMODIFIED` | `Accounting — Egypt financial statements` | `المحاسبة — القوائم المالية (مصر)` |
| 16 | `accounting.seed.accounting.eg.payment-terms` | `SYSTEM_SEED` | `PATCH_IF_UNMODIFIED` | `Accounting — Egypt payment terms` | `المحاسبة — شروط السداد (مصر)` |
| 17 | `accounting.seed.accounting.eg.dunning-templates` | `SYSTEM_SEED` | `PATCH_IF_UNMODIFIED` | `Accounting — Egypt dunning templates` | `المحاسبة — قوالب المطالبات (مصر)` |
| 18 | `accounting.seed.accounting.eg.bank-formats` | `SYSTEM_SEED` | `PATCH_IF_UNMODIFIED` | `Accounting — Egypt bank statement formats` | `المحاسبة — صيغ كشوف البنوك (مصر)` |
| 19 | `accounting.seed.accounting.eg.close-templates` | `SYSTEM_SEED` | `PATCH_IF_UNMODIFIED` | `Accounting — Egypt period-close checklists` | `المحاسبة — قوائم إقفال الفترات (مصر)` |
| 20 | `accounting.seed.accounting.base.country-pack` | `SYSTEM_SEED` | `SYSTEM_MANAGED` | `Accounting — Base country pack` | `المحاسبة — الحزمة الأساسية المحايدة` |
| 21 | `accounting.seed.accounting.base.tax-rules` | `SYSTEM_SEED` | `SYSTEM_MANAGED` | `Accounting — Base tax rules` | `المحاسبة — قواعد الضرائب الأساسية` |
| 22 | `accounting.seed.accounting.base.return-definitions` | `SYSTEM_SEED` | `SYSTEM_MANAGED` | `Accounting — Base tax return definitions` | `المحاسبة — تعريفات الإقرارات الأساسية` |
| 23 | `accounting.seed.accounting.base.chart` | `SYSTEM_SEED` | `CREATE_ONCE` | `Accounting — Base chart templates` | `المحاسبة — قوالب دليل الحسابات الأساسي` |
| 24 | `accounting.seed.accounting.base.report-definitions` | `SYSTEM_SEED` | `PATCH_IF_UNMODIFIED` | `Accounting — Base financial statements` | `المحاسبة — القوائم المالية الأساسية` |
| 25 | `accounting.seed.accounting.base.payment-terms` | `SYSTEM_SEED` | `PATCH_IF_UNMODIFIED` | `Accounting — Base payment terms` | `المحاسبة — شروط السداد الأساسية` |
| 26 | `accounting.seed.accounting.base.dunning-templates` | `SYSTEM_SEED` | `PATCH_IF_UNMODIFIED` | `Accounting — Base dunning templates` | `المحاسبة — قوالب المطالبات الأساسية` |
| 27 | `accounting.seed.accounting.base.bank-formats` | `SYSTEM_SEED` | `PATCH_IF_UNMODIFIED` | `Accounting — Base bank statement formats` | `المحاسبة — صيغ كشوف البنوك الأساسية` |
| 28 | `accounting.seed.accounting.base.close-templates` | `SYSTEM_SEED` | `PATCH_IF_UNMODIFIED` | `Accounting — Base period-close checklists` | `المحاسبة — قوائم إقفال الفترات الأساسية` |
| 29 | `accounting.verify` | `VERIFICATION` | — | `Accounting — verification` | `المحاسبة — التحقق` |
| 30 | `accounting.decommission-retained` *(Stage 6)* | `CONFIG` | — | `Accounting — retained write revocation` | `المحاسبة — سحب صلاحية الكتابة مع الاحتفاظ` |

---

## 3. Authoritative Field-to-DTO Mapping Tables

Every field displayed or submitted across `ADM-02` maps 1-to-1 to a verified Core DTO or Admin Portal runtime-validated view interface (`src/features/admin/applications/types/index.ts`, `src/features/admin/tenant-workspace/provisioning/types.ts`, `docs/api/{catalog,database-servers,subscriptions,tenants,tenant-operations}.md`). **Zero fields are invented.** Identifiers, step keys, digests, revisions, prices, and timestamps render inside `<bdi dir="ltr">` or `dir="ltr"` containers using Western digits (`0-9`) and `tabular-nums` / `font-mono`.

### 3.1 Surface A & B — Catalogue, Readiness, Server Binding & Commercial Tiers

| Surface / Control | Label (EN / AR) | Authoritative DTO / View Interface & Member | Type & Validation / Wire Rules | Slice vs Stage |
| --- | --- | --- | --- | --- |
| Catalogue Header | Application key / مفتاح التطبيق | `ApplicationView.key` | `string` (`"accounting"`, `dir="ltr" font-mono`) | Slice |
| Catalogue Header | Lifecycle status / حالة دورة الحياة | `ApplicationView.lifecycleStatus` | `"DRAFT" \| "ACTIVE" \| "DEPRECATED" \| "DISABLED"` | Slice |
| Catalogue Header | Publication status / حالة النشر | `ApplicationView.publicationStatus` | `"UNPUBLISHED" \| "PUBLISHED"` | Slice |
| Catalogue Header | Pending draft flag / مسودة معلّقة | `ApplicationView.hasPendingDraft` | `boolean \| undefined` | Slice |
| Catalogue Header | Runtime target / هدف التشغيل | `ApplicationView.runtimeTarget` | `string \| null` (`"accounting-app"`, `dir="ltr" font-mono`) | Slice |
| Catalogue Header | Database deployment / نمط نشر القاعدة | `ApplicationView.databaseDeployment` | `"ON_DEMAND"` (`ApplicationDatabaseDeployment`) | Slice |
| Catalogue Header | Database principal / دور قاعدة البيانات | `ApplicationView.databasePrincipal` | `string \| null` (`"mutakamel_accounting_app"`, `dir="ltr" font-mono`) | Slice |
| Catalogue Header | Catalogue / Publication / Policy revisions | `ApplicationView.{catalogueRevision, publicationRevision, databasePolicy.policyRevision, technicalDefinitionRevision}` | Decimal integer `string` (optimistic concurrency fences; never `Number()`) | Slice |
| Readiness Card | Readiness status / حالة الجاهزية التقنية | `ApplicationTechnicalReadinessView.status` | `"READY" \| "NOT_REQUIRED" \| "BLOCKED"` | Slice |
| Readiness Card | Activation & selection flags | `ApplicationTechnicalReadinessView.{activationAllowed, selectionAllowed}` | `boolean` | Slice |
| Readiness Card | Blockers & reasons | `ApplicationTechnicalReadinessView.{selectionBlockers, reasons}` | `ApplicationSelectionBlocker[]`, `ApplicationTechnicalReadinessReason[]` | Slice |
| Readiness Card | Six readiness checks | `ApplicationTechnicalReadinessView.checks.{runtimeTarget, componentBinding, activeComponents, publishedReleases, minimumReleases, databasePermissionManifest}` | `boolean` (all `true` required before `Activate`) | Slice |
| Readiness Card | Bound component & release | `ApplicationTechnicalReadinessView.components[].{id, key, ownerApp, kind, status, latestPublishedRelease.{id, releaseVersion, manifestVersion, manifestChecksum, publishedAt}}` | `UUIDv7`, `"accounting"`, `SHA-256` hex (`dir="ltr"`) | Slice |
| Manifest Card | Permission manifest evidence | `ApplicationManifestEvidenceView.{id, version, checksum, schemaVersion, contractPackage, contractVersion, publicationSource, publishedAt, active}` | Active `ACCOUNTING_APPLICATION_DATABASE_PERMISSION_MANIFEST_V1` | Slice |
| Server Coverage | Fleet coverage KPIs | `ApplicationView.serverSummary.{eligible, ready, pending, degraded, coveragePercent, rolloutRequired}` | `number` (`tabular-nums`) | Slice |
| Bind Servers Dialog | Candidate server row | `ApplicationDatabaseServerCandidateView.{databaseServerId, name, host, port, serverStatus, countryIsoCode, currentTenants, maxTenants, bindingStatus, credentialRevision, safeFailureCode, bound, bindable, blockedReason}` | Multi-select `Checkbox` disabled when `!bindable \|\| bound`; max `5` IDs | Slice |
| Bind Servers Submit | Bind request payload | `BindApplicationDatabaseServersDto.{databaseServerIds, expectedCatalogueRevision, expectedPolicyRevision, reason}` | `databaseServerIds`: `1..5` UUIDv7s; `reason`: trimmed `1..256` chars | Slice |
| Bind Servers Receipt | Per-server bind outcome | `ApplicationDatabaseServerBindReceipt.{requested, bound, alreadyBound, failed, results[].{databaseServerId, outcome, credentialRevision, bindingStatus, code, message}}` | `outcome`: `"BOUND" \| "ALREADY_BOUND" \| "FAILED"` | Slice |
| Publish Dialog | Publish request payload | `PublishApplicationDto.{expectedCatalogueRevision, expectedPublicationRevision, reason}` | Exact revision strings from `ApplicationView`; `reason`: `1..256` chars | Slice |
| Activate Dialog | Activate request payload | `ApplicationLifecycleCommandDto.{expectedCatalogueRevision, reason}` | Exact `catalogueRevision`; `reason`: `1..256` chars | Slice |
| Tiers & Features | Tier definition | `CreateTierDto.{key, name, color?, isActive?}` / `TierView.{id, key, name, rank, color, isActive}` | `key`: `"accounting.basic"` (`rank: 1`, Slice) & `"accounting.advanced"` (`rank: 2`, Full-Stage) | Slice + Stage 1 |
| Tiers & Features | Feature definition & grants | `CreateFeatureDto.{key, name, description?, rank?, isActive?}` / `SetTierFeaturesDto.{features: Array<{featureId, config?}>}` | 28 Basic keys (Slice) + 36 Advanced keys = 64 keys (`10_Feature_Tiers.md`) | Slice + Stage 1 |
| Price Ladders | Marginal USD bracket | `SetPriceTiersDto.{expectedPricingRevision, reason, billingCycle, brackets: Array<{minUsers, maxUsers?, unitPrice}>}` | `billingCycle`: `"MONTHLY" \| "ANNUAL"`; `unitPrice`: decimal USD string (never `Number()`) | Slice + Stage 1 |
| Stage-0 Role Ensure *(Gap `CG-15`)* | Ensure roles request *(pending Core route)* | *Proposed `EnsureApplicationDatabaseRolesDto.{reason, recoveryLogin?}` (`12_Platform_Changes.md` §4.1 #35 & §4.6)* | *Not yet in Gateway route inventory — recorded in §10 `CG-15`* | Stage 0 / Stage 2 |

### 3.2 Surface D — Commercial Subscription & Tenant Creation

| Surface / Control | Label (EN / AR) | Authoritative DTO / View Interface & Member | Type & Validation / Wire Rules | Slice vs Stage |
| --- | --- | --- | --- | --- |
| `/tenants/[id]?tab=billing` | Current subscription snapshot | `SubscriptionCommercialDetail.{subscription, subscriptionRevision, baseItems, addonSelections, baseAllowance, totals, projection}` | `subscriptionRevision`: decimal bigint string; `baseItems[].tierRank`: int32 | Slice |
| Commercial Change | Prepare change set | `CreateSubscriptionPreparationDto.{expectedSubscriptionRevision, changes}` | Adds `accounting` (`Basic` or `Advanced`) + `seats` (`1..100000`); no client price math | Slice |
| Commercial Change | Price preview | `CreatePlanChangePreviewDto.{preparationId, expectedSubscriptionRevision, changes}` → 13-field preview (`canApply`, `expiresAt` +5m, `before`/`after` brackets) | Preserves decimal USD strings verbatim; `<time dateTime={expiresAt}>` | Slice |
| Commercial Change | Apply reviewed preview | `POST .../plan-change-previews/:previewId/apply` body `{}` → 9-field original receipt | Empty JSON `{}` strictly; binds reviewed preview & wallet settlement | Slice |
| Commercial Recovery | Recover stuck commercial op | `RecoverSubscriptionOperationDto.{expectedOperationRevision, action, reason}` | `action`: `"RECONCILE" \| "CANCEL_PREPARATION"`; `reason`: `1..256` chars | Full-Stage |
| `/tenants/new` | Initial quote & create | `InitialTerms.{billingCycle, currencyCode: "USD", trialDays?, applications[].{selectionKey, applicationId, tierId, seats, addons: []}}` | `selectionKey`: `generateUUIDv7()`; `quoteId` bound into `POST /tenants` | Slice |

### 3.3 Surface E — Tenant Provisioning Tab & Failing-Step Watcher (`/tenants/[id]?tab=provisioning`)

| Control / Region | Label (EN / AR) | Authoritative DTO / View Interface & Member | Type & Validation / Wire Rules | Slice vs Stage |
| --- | --- | --- | --- | --- |
| Add Application Card | Application key / مفتاح التطبيق | `CreateAddApplicationOperationDto.applicationKey` | `"accounting"` (`^[a-z][a-z0-9_-]{0,63}$`, `commands.ts:180`) | Slice |
| Add Application Card | Expected access-policy revision / مراجعة سياسة الوصول المتوقعة | `CreateAddApplicationOperationDto.expectedAccessPolicyRevision` | Integer `1..2147483647` (auto-prefilled from latest tenant operation/subscription) | Slice |
| Add Application Card | Target component & release pin / بيانات الإصدار المثبّت | `CreateAddApplicationOperationDto.targetSelection[].{componentKey, componentId, targetReleaseId, targetReleaseVersion, targetManifestChecksum}` | Prefilled from `GET /provisioning/components` + `/releases`: `componentKey: "accounting"`, UUIDv7 IDs, 64-hex SHA-256 checksum | Slice |
| Add Application Card | Reason code / رمز السبب | `CreateAddApplicationOperationDto.reasonCode` | `SAFE_CODE_PATTERN` (`^[A-Z][A-Z0-9._-]{2,95}$`, e.g. `ENABLE_ACCOUNTING_PILOT`) | Slice |
| Add Application Result | Created operation receipt | `ManagedProvisioningOperation.{operationId, tenantId, type, status, generation, planDigest, replayed}` | `type: "ADD_APPLICATION"`, `202 Accepted`; selects `operationId` immediately | Slice |
| Operations Rail | Operation summary card | `TenantOperationSummary.{id, generation, type, status, currentPhase, requestedAt, safeError}` | Paginated (`limit: 100`) + `LoadMoreFooter` (`meta.{total, hasNext}`) | Slice |
| Operation Detail Header | Lifecycle, generation & phase | `TenantOperationDetail.{id, generation, type, status, currentPhase, accessPolicyRevision, planDigest, requestedAt, startedAt, heartbeatAt, completedAt}` | `planDigest` shown as 12-char short hex with full 64-hex in `<bdi dir="ltr">` tooltip/copy | Slice |
| Operation Detail Header | Weighted progress bar | `TenantOperationDetail.progress.{percent, completedSteps, totalSteps, failedSteps, completedWeight, totalWeight}` | `percent`: `0..100` (`tabular-nums`); `29` steps for standalone `ADD_APPLICATION` of `accounting` | Slice |
| Operation Detail Header | Stall badge & notice | `TenantOperationDetail.stall.{stepKey, since, ageSeconds, reason}` | `reason`: `"NO_PROGRESS" \| "DISPATCH_LEASE_EXPIRED" \| "CANCEL_PENDING"` | Slice |
| Operation Detail Header | Operator exits & block reasons | `TenantOperationDetail.exits.{cancel, retry, repair, resync}.{allowed, reasonCode}` | `reasonCode`: `TenantOperationExitReasonCode` (7 closed values) | Slice |
| **Failing-Step Callout & Step Row** | **Step name & machine key / اسم الخطوة ومفتاح الخطة** | `TenantOperationStep.stepKey` + `provisioningStepLabel(step.stepKey, ar)` | Both shown together: localized title + `<span dir="ltr" class="font-mono">{step.stepKey}</span>` | **Slice (Core)** |
| **Failing-Step Callout & Step Row** | **Step kind & owner producer / النوع والمالك** | `TenantOperationStep.{kind, componentKey, producer}` | `kind`: `"SCHEMA" \| "CONFIG" \| "SYSTEM_SEED" \| "VERIFICATION"`; `producer`: `"accounting-app"` | **Slice (Core)** |
| **Failing-Step Callout & Step Row** | **Status, attempts & retryability / الحالة والمحاولات** | `TenantOperationStep.{status, attemptCount, retryable, startedAt, heartbeatAt, finishedAt}` | `status`: `TenantOperationStepStatus`; `attemptCount` + `↻` badge when `retryable === true` | **Slice (Core)** |
| **Failing-Step Callout & Step Row** | **Version & checksum evidence / نسخة وبصمة الإصدار** | `TenantOperationStep.{fromVersion, targetVersion, appliedVersion, targetChecksum, appliedChecksum}` | `dir="ltr" font-mono` | **Slice (Core)** |
| **Failing-Step Callout & Step Row** | **Safe failure code & message / رمز ورسالة الخطأ الآمنة** | `TenantOperationStep.safeError.{code, message}` + `Operation.safeError.{code, message}` | Projected safe code (`ACCOUNTING_PROVISIONING_*` / `ACCOUNTING.PROVISIONING.*`) + localized hint | **Slice (Core)** |
| Timeline Stream | Event sequence & message | `TenantOperationTimelineEvent.{id, sequence, eventType, componentKey, stepId, status, actor, message, occurredAt}` | Ordered by `sequence`, `#sequence` in `dir="ltr" tabular-nums` | Slice |
| State Tab — Components | Component installation row | `TenantComponentInstallation.{id, componentKey, ownerApp, selectionSource, state, desired, applied, updateAvailable, lastOperationId, readyAt, lastVerifiedAt}` | `componentKey: "accounting"`, `state: "READY" \| "INSTALLING" \| "FAILED" \| "DISABLED_RETAINED"` | Slice |
| State Tab — Seeds | Seed pack state & conflict resolve | `TenantSeedState.{id, componentKey, seedKey, policy, status, revision, conflictCode, desiredChecksum, appliedChecksum}` → `ResolveTenantSeedConflictDto.{decision, reasonCode, expectedConflictRevision, expectedStatus: "CONFLICT", expectedAppliedChecksum, expectedDesiredChecksum}` | Fails closed (`disabled`) when `seed.revision === null` (`commands.ts:128`) | Slice Read + Stage 1 Write |
| Managed — Repair | Repair component payload | `CreateRepairOperationDto.{componentKey, currentDesiredReleaseId, currentDesiredManifestChecksum, currentAppliedReleaseId?, currentAppliedManifestChecksum?, targetReleaseId, targetManifestChecksum, reasonCode, conflictResolutionIds?}` | Built from live `TenantComponentInstallation` via `buildRepairOperationDto` | Full-Stage |
| Managed — Decommission | Retained decommission payload | `CreateDecommissionOperationDto.{componentKey, currentDesiredReleaseId, currentDesiredManifestChecksum, currentAppliedReleaseId, currentAppliedManifestChecksum, retentionAcknowledged: true, reasonCode}` | Requires `retentionAcknowledged === true` + name-typed `DestructiveActionModal` | Stage 6 (`ADM-06`) |

---

## 4. Action, Canonical Gateway Route, Idempotency & RBAC Matrix

Every route below is verified verbatim against `frontend/admin-portal/docs/generated/admin-core-api-routes.md` (generated `2026-10-27`) and `src/lib/auth/rbac.ts`. No `accounting-app` (`/api/tenant/accounting/v1/*`) or controller-relative (`/admin/*`) path is ever called.

- **Idempotency Law:** For every route with `Idempotent = yes` and `Class = WRITE_SENSITIVE`, the hook generates **one** UUIDv7 (`generateUUIDv7()`) per operator intent, attaches it in `headers["x-idempotency-key"]`, and retains that **exact** UUIDv7 across automatic `401` session-refresh replay and manual `Retry with Same Key` inside `AmbiguousOutcomePanel`. Routes marked `Idempotent = no` (`POST .../features`, `POST .../tiers`, `POST /subscriptions/quote`) opt out of automatic idempotency injection and `401` refresh replay (`replayAfterRefresh: false`).

| Surface | Operator Action | Method & Canonical Gateway Path | Route Class | Idempotent (`x-idempotency-key`) | Mode | Immutable Permission Keys (`rbac.ts`) | Slice / Stage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **A. DB Servers** | List database servers | `GET /api/admin/core/v1/database-servers` | `AUTHENTICATED` | — (Safe GET) | `ALL` | `admin.database_servers.read` | Slice |
| **A. DB Servers** | Read server application bindings | `GET /api/admin/core/v1/database-servers/:id/applications` | `AUTHENTICATED` | — (Safe GET) | `ALL` | `admin.database_servers.read` | Slice |
| **A. DB Servers** | Bootstrap `accounting` on server | `POST /api/admin/core/v1/database-servers/:id/applications/:applicationKey/bootstrap` | `WRITE_SENSITIVE` | **Yes** (UUIDv7) | `ALL` | `admin.database_servers.update` + `admin.database_servers.critical` | Slice |
| **A. DB Servers** | Reconcile / regenerate app credential | `POST /api/admin/core/v1/database-servers/:id/applications/:applicationKey/credential/{reconcile\|regenerate}` | `WRITE_SENSITIVE` | **Yes** (UUIDv7) | `ALL` | `admin.database_servers.credentials.rotate` + `admin.database_servers.critical` | Stage 1+ |
| **A. DB Servers** | Stage-0/2 fleet role ensure *(Gap `CG-15`)* | *`POST /api/admin/core/v1/database-servers/application-roles/accounting/ensure` (missing in Gateway — see §10 `CG-15`)* | *`WRITE_SENSITIVE`* | *Yes (UUIDv7)* | *`ALL`* | *`admin.database_servers.update` + `admin.database_servers.critical`* | Stage 0 / 2 |
| **B. Catalogue** | Read `accounting` detail | `GET /api/admin/core/v1/applications/:applicationKey` | `AUTHENTICATED` | — (Safe GET) | `ALL` | `admin.applications.read` | Slice |
| **B. Catalogue** | Read technical readiness & manifests | `GET /api/admin/core/v1/applications/:applicationKey/{technical-provisioning\|database-manifests}` | `AUTHENTICATED` | — (Safe GET) | `ALL` | `admin.applications.read` | Slice |
| **B. Catalogue** | Adopt technical package / bind primary | `POST /api/admin/core/v1/applications/:applicationKey/technical-provisioning/{adopt\|primary-component}` | `WRITE_SENSITIVE` | **Yes** (UUIDv7) | `ALL` | `admin.applications.update` + `admin.applications.critical` | Stage 1+ |
| **B. Catalogue** | List features & tiers | `GET /api/admin/core/v1/applications/:applicationId/{features\|tiers}` | `AUTHENTICATED` | — (Safe GET) | `ALL` | `admin.catalog.read` | Slice |
| **B. Catalogue** | Create feature / create tier | `POST /api/admin/core/v1/applications/:applicationId/{features\|tiers}` | `WRITE_SENSITIVE` | **No** (`replayAfterRefresh: false`) | `ALL` | `admin.catalog.manage` | Slice |
| **B. Catalogue** | Update tier feature grants | `PATCH /api/admin/core/v1/tiers/:tierId/features` | `WRITE_SENSITIVE` | **Yes** (UUIDv7) | `ALL` | `admin.catalog.manage` + `admin.catalog.critical` | Slice |
| **B. Catalogue** | Set USD price ladder brackets | `PATCH /api/admin/core/v1/tiers/:tierId/price-tiers` | `WRITE_SENSITIVE` | **Yes** (UUIDv7) | `ALL` | `admin.catalog.manage` + `admin.catalog.critical` | Slice |
| **B. Catalogue** | Publish `accounting` | `POST /api/admin/core/v1/applications/:applicationKey/publish` | `WRITE_SENSITIVE` | **Yes** (UUIDv7) | `ALL` | `admin.applications.update` + `admin.applications.critical` | Slice |
| **B. Catalogue** | Activate `accounting` | `POST /api/admin/core/v1/applications/:applicationKey/activate` | `WRITE_SENSITIVE` | **Yes** (UUIDv7) | `ALL` | `admin.applications.update` + `admin.applications.critical` | Slice |
| **B. Catalogue** | List candidate DB servers for bind | `GET /api/admin/core/v1/applications/:applicationKey/database-servers` | `AUTHENTICATED` | — (Safe GET) | `ALL` | `admin.database_servers.read` | Slice |
| **B. Catalogue** | Bulk bind DB servers (`<= 5`) | `POST /api/admin/core/v1/applications/:applicationKey/database-servers/bind` | `WRITE_SENSITIVE` | **Yes** (UUIDv7) | `ALL` | `admin.database_servers.update` + `admin.database_servers.critical` | Slice |
| **B. Catalogue** | Update DB rotation policy | `PATCH /api/admin/core/v1/applications/:applicationKey/database-policy` | `WRITE_SENSITIVE` | **Yes** (UUIDv7) | `ALL` | `admin.applications.update` + `admin.applications.critical` | Stage 1+ |
| **C. Governance** | List components & component releases | `GET /api/admin/core/v1/provisioning/components` & `.../components/:componentId/releases` | `AUTHENTICATED` | — (Safe GET) | `ALL` | `admin.tenants.read` | Slice |
| **C. Governance** | List / read published releases | `GET /api/admin/core/v1/provisioning/releases` & `.../releases/:releaseId` | `READ_HEAVY` | — (Safe GET) | `ALL` | `admin.provisioning.releases.read` | Slice |
| **C. Governance** | Run fleet discovery drift scan | `POST /api/admin/core/v1/provisioning/discovery-runs` | `WRITE_SENSITIVE` | **Yes** (UUIDv7) | `ALL` | `admin.provisioning.discovery.run` + `admin.provisioning.critical` | Stage 1+ |
| **D. Commercial** | Read subscriptions / tenant subscription | `GET /api/admin/core/v1/subscriptions` & `GET .../tenants/:tenantId/subscription` | `AUTHENTICATED` | — (Safe GET) | `ALL` | `admin.subscriptions.read` | Slice |
| **D. Commercial** | Prepare commercial change | `POST /api/admin/core/v1/subscriptions/:id/preparations` | `WRITE_SENSITIVE` | **Yes** (UUIDv7) | `ALL` | `admin.subscriptions.update` | Slice |
| **D. Commercial** | Price commercial preview | `POST /api/admin/core/v1/subscriptions/:id/plan-change-previews` | `WRITE_SENSITIVE` | **Yes** (UUIDv7) | `ALL` | `admin.subscriptions.update` | Slice |
| **D. Commercial** | Apply commercial preview | `POST /api/admin/core/v1/subscriptions/:id/plan-change-previews/:previewId/apply` | `WRITE_SENSITIVE` | **Yes** (UUIDv7) | `ALL` | `admin.subscriptions.update` + `admin.subscriptions.critical` | Slice |
| **D. Commercial** | Read commercial op / receipt | `GET .../tenants/:tenantId/subscription/operations/:operationId` & `GET .../plan-change-previews/:previewId/receipt` | `AUTHENTICATED` | — (Safe GET) | `ALL` | `admin.subscriptions.read` | Slice |
| **D. Commercial** | Recover commercial operation | `POST /api/admin/core/v1/tenants/:tenantId/subscription/operations/:operationId/recovery` | `WRITE_SENSITIVE` | **Yes** (UUIDv7) | `ALL` | `admin.subscriptions.update` + `admin.subscriptions.critical` | Stage 1+ |
| **D. New Tenant** | Quote initial subscription | `POST /api/admin/core/v1/subscriptions/quote` | `AUTHENTICATED` | **No** (`replayAfterRefresh: false`) | `ANY` | `admin.catalog.read` **OR** `admin.tenants.create` | Slice |
| **D. New Tenant** | Preview provisioning plan & create tenant | `POST /api/admin/core/v1/tenants/provisioning-plans` & `POST /api/admin/core/v1/tenants` | `AUTHENTICATED` / `WRITE_SENSITIVE` | Plan: No · Create: **Yes** (UUIDv7) | `ALL` | `admin.tenants.create` | Slice |
| **E. Provisioning** | List operations / read detail / timeline | `GET /api/admin/core/v1/tenants/:tenantId/operations`, `.../:operationId`, `.../:operationId/timeline` | `AUTHENTICATED` | — (Safe GET) | `ALL` | `admin.tenants.read` | **Slice (Core)** |
| **E. Provisioning** | Read component & seed states | `GET /api/admin/core/v1/tenants/:tenantId/provisioning-state/{components\|seeds}` | `AUTHENTICATED` | — (Safe GET) | `ALL` | `admin.tenants.read` | **Slice (Core)** |
| **E. Provisioning** | **Add `accounting` application** | `POST /api/admin/core/v1/tenants/:tenantId/provisioning/operations/add-application` | `WRITE_SENSITIVE` | **Yes** (UUIDv7) | `ALL` | `admin.provisioning.add-application` + `admin.provisioning.critical` | **Slice (Core)** |
| **E. Provisioning** | **Re-provision (`retry`) / Cancel / Resync** | `POST /api/admin/core/v1/tenants/:tenantId/operations/:operationId/{retry\|cancel\|resync}` | `WRITE_SENSITIVE` | **Yes** (UUIDv7) | `ALL` | `admin.tenants.read` + `admin.tenants.reprovision` + `admin.tenants.critical` | **Slice (Core)** |
| **E. Provisioning** | Resolve seed conflict | `POST /api/admin/core/v1/tenants/:tenantId/provisioning/seed-conflicts/:seedStateId/resolve` | `WRITE_SENSITIVE` | **Yes** (UUIDv7) | `ALL` | `admin.provisioning.conflicts.resolve` + `admin.provisioning.critical` | Stage 1 Full |
| **E. Provisioning** | Repair `accounting` component | `POST /api/admin/core/v1/tenants/:tenantId/provisioning/operations/repair` | `WRITE_SENSITIVE` | **Yes** (UUIDv7) | `ALL` | `admin.provisioning.repair` + `admin.provisioning.critical` | Stage 1 Full |
| **E. Provisioning** | Apply component updates | `POST /api/admin/core/v1/tenants/:tenantId/provisioning/updates/apply` | `WRITE_SENSITIVE` | **Yes** (UUIDv7) | `ALL` | `admin.tenants.reprovision` + `admin.tenants.critical` + `admin.provisioning.critical` | Stage 1+ |
| **E. Provisioning** | Read / request / resend prerequisite | `GET .../prerequisite-evidence` (`admin.provisioning.prerequisites.read`) · `POST .../prerequisite-requests` & `.../prerequisite-releases/resend` | `READ_HEAVY` / `WRITE_SENSITIVE` | POST: **Yes** (UUIDv7) | `ALL` | `admin.provisioning.prerequisites.request` + `admin.provisioning.critical` | Stage 1+ |
| **E. Provisioning** | Close failed operation recovery | `POST /api/admin/core/v1/tenants/:tenantId/provisioning/operations/close-failed` | `WRITE_SENSITIVE` | **Yes** (UUIDv7) | `ALL` | `admin.tenants.reprovision` + `admin.tenants.critical` + `admin.provisioning.critical` | Stage 1+ |
| **E. Provisioning** | Retained decommission (`ADM-06`) | `POST /api/admin/core/v1/tenants/:tenantId/provisioning/operations/decommission` | `WRITE_SENSITIVE` | **Yes** (UUIDv7) | `ALL` | `admin.provisioning.decommission` + `admin.provisioning.critical` | Stage 6 |

---

## 5. Complete Operational State Matrix

| State | Trigger / Condition | UI Presentation (`@/design-system`) | Permitted Operator Action |
| --- | --- | --- | --- |
| **1. Initial Loading (`isLoading`)** | `resource.status === "loading" \| "idle"` on first mount (no cached snapshot). | `Skeleton` geometry matching the 2-pane `Operations` layout (3 summary cards on start rail + detail header + 6 step rows) or compact `RefreshCw` `loadingLabel` inside `ResourceBoundary`. No layout jump on hydrate. | Wait for initial read; navigation tabs remain interactive. |
| **2. Background Refresh & Live Polling (`isRefreshing`)** | Open operation (`REQUESTED`, `PLANNING`, `QUEUED`, `RUNNING`, `WAITING_RETRY`, `CANCEL_REQUESTED`) polled on `3 s → 15 s → 60 s` adaptive back-off. | Existing operation detail, step table, and open `ConfirmActionModal` / `Select` menus **remain mounted** (`aria-busy="true"` on `<section>`). Header shows `Badge tone="info"` (`Live polling · 3s` / `تحديث تلقائي · 3 ث`). **Disruption Guard:** pauses auto-polling (`Badge tone="neutral"` `Polling paused` / `التحديث متوقف مؤقتاً`) whenever a dialog is open, an input has focus, or `document.visibilityState === "hidden"`. | Manual `Refresh` button remains available; editing inputs is never clobbered. |
| **3. Loaded Empty** | `operations.data.items.length === 0` or `updates.data.items.length === 0` or `prerequisites.data.length === 0`. | `EmptyState` (`icon={CircleDashed}`) with calm bilingual title (`No provisioning operations recorded yet` / `لا توجد عمليات تهيئة مسجّلة بعد`). Never styled as an error. | Switch to `Managed actions` to dispatch `Add Application` (if entitled & permitted). |
| **4. Filtered Empty** | Search/filter in `State` (`selectionSource`, `componentKey`, `status`) or `/provisioning` matches 0 rows while unfiltered total > 0. | `EmptyState` naming the active filter with a `Clear filters` (`مسح عوامل التصفية`) secondary `Button`. | Reset filter to restore full component/seed list. |
| **5. `403` Unauthorized (`PermissionGate`)** | Missing read permission (`admin.tenants.read`, `admin.applications.read`, `admin.subscriptions.read`, `admin.provisioning.prerequisites.read`) or missing write/critical pair. | **Never rendered as an empty state.** Read `403` renders `PermissionGate` / `ResourceBoundary` `forbidden` notice naming the required capability; write controls without `adminCanAll` are disabled or hidden with explicit permission explanation, and server `403` displays `Alert` with `correlationId`. | Request required RBAC role from Super Admin. |
| **6. Validation / Guard Failure (`400` / `422`)** | Invalid `reasonCode`, stale `expectedAccessPolicyRevision`, or `accounting` not yet entitled in tenant's access policy. | Inline `Field` error or top focusable `role="alert"` banner (`errorRef.current?.focus()`) with 3-part Cause / Effect / Safe Next Action copy + `correlationId`. | Entitle `accounting` in `Billing` tab first, refresh revision, or fix `reasonCode` and submit a fresh intent. |
| **7. Lagging Release Conflict (`409`)** | `TENANT_PROVISIONING_RELEASE_UPGRADE_REQUIRED` returned by commercial `preparations` or `add-application` because `core.foundation` / `crm` / `trade` lags its current release. | Destructive-subtle `role="alert"` banner with localized guidance and inline secondary CTA `Open Updates` (`فتح التحديثات`) switching straight to `section = "updates"`. | Apply pending component update in `Updates`, wait for `SUCCEEDED`, then retry adding `accounting`. |
| **8. Active Maintenance Fence Conflict (`409`)** | `PROVISIONING_MAINTENANCE_FENCE_OPEN` or `ACCOUNTING.PROVISIONING.MAINTENANCE_FENCE_OPEN` during restore/relocation/maintenance. | Banner + step hint explaining the tenant database is fenced under a higher `accessPolicyRevision` or active restore/maintenance lease. | Inspect `Prerequisites` / Backup Restore status; wait for fence release, then click `Re-provision`. |
| **9. Degraded / Stalled Open Operation** | `operation.stall !== null` (`NO_PROGRESS`, `DISPATCH_LEASE_EXPIRED`, `CANCEL_PENDING`). | Spinner **stops** (`live={!operation.stall}`) so the UI never fakes liveness. Amber `StalledBadge` (`Hourglass`) on header and stalled step row + `StallNotice` naming the stalled `stepKey`, measured duration, **Resync** first (when `exits.resync.allowed`), and cancellation/await-worker guidance. | Click `Resync` first to replay retained Worker progress without mutating state; or `Request cancel` if `exits.cancel.allowed`. |
| **10. Named Step Failure — Retryable (`FAILED_RETRYABLE`)** | Step fails transiently (`CONNECTION_TIMEOUT`, `LOCK_NOT_AVAILABLE`, `WORKER.PROVISIONING.OWNER_RESULT_TIMEOUT`, `ACCOUNTING.PROVISIONING.FENCE_NOT_READY`) after bounded retries. | `StatusBadge` `danger` (`AlertTriangle`) + **`FailingStepCallout`** above step table naming exact `stepKey`, localized label, `attemptCount`, `safeError.code`, hint, and `Re-provision` primary CTA (`exits.retry.allowed === true`). | Verify DB server health if needed, then click `Re-provision` (creates generation `G + 1`; completed idempotent steps settle cleanly). |
| **11. Named Step Failure — Terminal (`MANUAL_RECOVERY_REQUIRED` / `CONFLICT`)** | Non-retryable step failure (`ACCOUNTING_PROVISIONING_CORE_SCHEMA_MISSING`, `ACCOUNTING_PROVISIONING_SEED_CATALOGUE_DRIFT`, or `PATCH_IF_UNMODIFIED` seed `CONFLICT`). | `StatusBadge` `danger` + **`FailingStepCallout`** naming exact `stepKey` and root cause: e.g., Core schema prerequisite missing (`D-556`) or seed conflict requiring decision in `State` tab. | Resolve seed conflict in `State` tab + run `Repair` / `Re-provision`, or update `core.foundation` release first, or `Close failed` when prerequisite recovery is exhausted. |
| **12. Ambiguous Write Outcome (`AmbiguousOutcomePanel`)** | Network drop, Gateway `502`/`504`, client timeout, or `409 GW.IDEM.IN_FLIGHT` on `add-application`, `retry`, `cancel`, `resync`, `publish`, `activate`, `bind`, or commercial `apply`. | Renders `AmbiguousOutcomePanel` preserving `mutation.intentKey` (the exact UUIDv7 `x-idempotency-key`) and session-scoped non-secret attempt metadata (`actor`, `tenantId`, `route`, `intentHash`). Blocks starting a competing mutation. | **1.** Click `Refresh Status` (`GET` operations / catalogue / receipt) to verify if Core already committed.<br>**2.** Only if unconfirmed, click `Retry Exact Request` reusing the **exact same UUIDv7 `x-idempotency-key`**. |
| **13. Commercial Tier Entitlement States (`Basic` vs `Advanced`)** | Tenant subscribed to `accounting.basic` (28 keys) vs `accounting.advanced` (64 keys) vs unsubscribed. | Both tiers install the **identical** physical `accounting` component (`AccountingTenantBaseline1800000000200` + all 27 seed packs). `Billing` tab shows active tier badge (`Basic` / `Advanced`) and seat count; upgrading/downgrading updates `accessPolicyRevision` without running schema migrations. If unsubscribed, `Add Application` for `accounting` is blocked until commercial entitlement exists. | Entitle or change tier in `Billing` tab (`preparations` → `plan-change-previews` → `apply`). |

---

## 6. Waiting States Specification (Strict Zero-Resend Law)

In compliance with `accounting-patterns-documents.md` and `agy-P03.T10.S6.md`, **every asynchronous or waiting state in `ADM-02` declares its bounded deadline, current system/human owner, single permitted safe operator inspection action, and automatic post-bound system compensation — and NEVER implies or offers resending an in-flight command.**

| # | Waiting State | Bounded Deadline | Current Owner | What the Operator Sees | Permitted Safe Action (Zero-Resend Law) | Automatic Post-Bound Compensation |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | **Fenced Step Execution In Flight** (`accounting.schema`, `accounting.seed.<pack>`, or `accounting.verify` in `RUNNING`) | **Lease:** `5 min` Worker step lease (`1 min` heartbeat cadence).<br>**Transient DB lane:** up to `25 min` inside `accounting-app`.<br>**Hard owner bound:** `45 min` from claim (`tenant-operations.md` §Stall signal). | **`accounting-app`** (`accounting.tenant-provisioning.step-execute.v1` consumer) supervised by **`worker-app`** | Active step row shows `RUNNING` badge + elapsed timer + last `heartbeatAt`. At `> 3 min` silent: amber `NO_PROGRESS` badge. At `> 10 min` silent (`2×` lease): amber `DISPATCH_LEASE_EXPIRED` notice stating Worker is waiting for the owner's result without re-sending. | **Inspect / `Resync` progress** (`POST .../resync` asks Worker to re-deliver retained event records under original event IDs — **never** re-dispatches the step to `accounting-app`) or `Request cancel`. | Worker **never** re-sends an unconfirmed owner step during lease expiry; at **`45 min`**, Worker fails the step retryably with `WORKER.PROVISIONING.OWNER_RESULT_TIMEOUT` and settles the operation `FAILED_RETRYABLE` (fencing token rejects any late stale owner reply). |
| 2 | **Scheduled Step Back-Off (`WAITING_RETRY`)** | Up to **`24 h`** maximum retry schedule; Worker heartbeats held schedule every **`1 min`** (`NO_PROGRESS` flagged if silent `> 10 min`). | **`worker-app`** orchestrator | Static amber `RotateCcw` `Waiting retry` / `بانتظار إعادة المحاولة` badge (no spinner) + attempt counter (`attemptCount`) and latest transient `safeError.code`. | **Wait or `Request cancel`** (`POST .../cancel` if operator chooses to abort). If `NO_PROGRESS` appears (`> 10 min` without Worker heartbeat), click **`Resync`**. | When the scheduled timer elapses, Worker automatically executes the next fenced attempt (`attempt + 1`). If retry budget exhausts, operation settles `FAILED_RETRYABLE`. |
| 3 | **Pending Stop / Cancellation (`CANCEL_REQUESTED` or `RUNNING` in `PREREQUISITE_FAILED` / `PREREQUISITE_EXPIRED`)** | **`10 min`** before `CANCEL_PENDING` stall notice surfaces; bounded by active step's `45 min` owner timeout. | **`worker-app`** | Static amber `Ban` `Cancel requested` / `طُلب الإلغاء` badge; `Re-provision` and `Request cancel` buttons are disabled with `CANCELLATION_PENDING` explanation: *"Only the Worker's confirmation moves this operation on."* | **`Refresh` or `Resync`** (`exits.resync.allowed`) to pull Worker's stop confirmation. **No duplicate cancel or re-send button.** | Once the current step drains or hits owner timeout, Worker emits signed `OPERATION_CANCELLED` / `OPERATION_FAILED` and releases the generation lock. |
| 4 | **Backup / Maintenance Prerequisite Window (`AWAITING_PREREQUISITES`)** *(Full-Stage updates/repairs)* | **`2 hours`** (`expiresAt` on `TenantPrerequisiteRequest`). | **`worker-app`** (backup runner) & **`core-app`** (maintenance fence) | `Prerequisites` tab shows `REQUESTED` status, `expiresAt` timestamp, `maintenanceFence.status`, and `recovery.attempts`. | **Read `Prerequisite Evidence`** (`GET .../prerequisite-evidence`). Never re-requests prerequisites while open. *(Post-failure fence release recovery uses dedicated `recovery.canCloseFailed` / `canResendRelease` only when `recovery.stuck`.)* | At `expiresAt`, Core expires the prerequisite (`PREREQUISITE_EXPIRED`), stops the operation, and releases/recovers the maintenance fence. |
| 5 | **Commercial Preparation & 5-Minute Price Preview (`preparations` → `plan-change-previews`)** | Preparation: bounded durable Core job; Price Preview: **`5 min`** (`expiresAt`). | **`core-app`** commercial engine | `Billing` tab locks draft edits, displays preparation progress or reviewed price table with exact `<time dateTime={expiresAt}>` countdown/timestamp. | **`Refresh` operation status** (`GET .../subscription/operations/:operationId`) or read original receipt (`GET .../receipt`). Never blindly re-submits financial commit. | After `5 min` preview expiry, `Apply` is refused; operator requests a fresh 5-minute preview from the same preparation (or runs `CANCEL_PREPARATION` recovery). |
| 6 | **Post-Provisioning Company Activation Handoff (`ACT-01` Done → Awaiting `ACT-03..ACT-14`)** | Unbounded operational handoff (no background job running; zero resources leased). | **Tenant Chief Accountant** (`tenant-portal` `:5002`, `SCR-01`) | Green `SUCCEEDED` operation + `accounting` component `state: "READY"` + calm handoff banner explaining `acc_company_profiles` is intentionally absent until Tenant Chief Accountant activates each company (`D-508`). | **None required in Admin Portal** (no "re-run provisioning" CTA shown because provisioning is complete). | All tenant accounting writes remain safely gated behind `ACCOUNTING.PROFILE.NOT_ACTIVATED` and `READINESS_BLOCKED` until `ACT-04..ACT-14` complete (`01_User_Journey_Company_Activation.md` §6–§7). |

---

## 7. Three-Part Error-Copy Catalogue & Accounting Safe-Code Extensions

### 7.1 Required Extension to `model/code-text.ts`

`src/features/admin/tenant-workspace/provisioning/model/code-text.ts` currently defines `ProvisioningCodeOwner = "CORE" | "CRM" | "TRADE"`. Adding `accounting` requires widening:
- `ProvisioningCodeOwner = "CORE" | "CRM" | "TRADE" | "ACCOUNTING"`
- `OWNER_CODE_PREFIXES`: append `["ACCOUNTING.PROVISIONING.", "ACCOUNTING"]` and `["ACCOUNTING_PROVISIONING_", "ACCOUNTING"]`
- `provisioningOwners.ACCOUNTING`: EN `"Accounting"` · AR `"المحاسبة"`

This automatically gives `accounting` localized hints for all 19 shared `TRANSIENT_DATABASE_CODES` (`CONNECTION_TIMEOUT`, `LOCK_NOT_AVAILABLE`, `TOO_MANY_CONNECTIONS`, etc.) and shared owner suffixes (`FENCE_NOT_READY`, `MAINTENANCE_FENCE_OPEN`, `PLACEMENT_UNAVAILABLE`, `COMMAND_STALE`, `INTERNAL_FAILURE`).

### 7.2 Worked Three-Part Error Messages (Cause · Effect · Safe Next Action)

Every error alert and `FailingStepCallout` renders **1. What happened (Cause)**, **2. What was affected (Effect)**, **3. Safe Next Action**, plus `<bdi dir="ltr" class="font-mono">{code} · {correlationId}</bdi>`:

| Code (`safeError.code` / `errorCode`) | English Copy (Cause · Effect · Safe Next Action) | Arabic Copy (السبب · الأثر · الإجراء الآمن التالي) |
| --- | --- | --- |
| `ACCOUNTING_PROVISIONING_CORE_SCHEMA_MISSING` *(Terminal on `accounting.schema`, `D-556`)* | **Cause:** Required Core foundation tables or columns (such as `companies.country_code`, `branches`, `currencies`, or `users`) are missing from this tenant database.<br>**Effect:** `accounting.schema` stopped cleanly before creating Accounting tables; existing tenant data is untouched (`MANUAL_RECOVERY_REQUIRED`).<br>**Next action:** Open **Updates** or **State**, upgrade/repair `core.foundation` to the current release, then click **Re-provision**. | **السبب:** جداول أو أعمدة أساسية مطلوبة من النواة (مثل `companies.country_code` أو `branches` أو `currencies` أو `users`) غير موجودة في قاعدة بيانات هذا المستأجر.<br>**الأثر:** توقفت خطوة `accounting.schema` بأمان قبل إنشاء جداول المحاسبة؛ ولم تتأثر بيانات المستأجر الحالية (`MANUAL_RECOVERY_REQUIRED`).<br>**الإجراء التالي:** افتح تبويب **التحديثات** أو **الحالة** لترقية أو إصلاح `core.foundation` إلى الإصدار الحالي، ثم اضغط **إعادة التهيئة**. |
| `ACCOUNTING_PROVISIONING_SEED_CATALOGUE_DRIFT` *(Terminal on `accounting.seed.<pack>` or `accounting.verify`)* | **Cause:** A seeded pack key or SHA-256 checksum reported by `accounting-app` does not match Core's published release manifest.<br>**Effect:** Provisioning halted before `accounting.verify` could mark the component `READY`; partial seed rows remain uncommitted for the failing pack.<br>**Next action:** Verify `accounting-app` container version sync and `/applications-catalogue/accounting` technical package adoption, then click **Re-provision**. | **السبب:** مفتاح حزمة البذور أو بصمة `SHA-256` المُبلّغ عنها من `accounting-app` لا تطابق بيان الإصدار المنشور في النواة.<br>**الأثر:** توقفت التهيئة قبل وصول `accounting.verify` إلى حالة الجاهزية `READY`؛ ولم يُعتمد الجزء المتعارض.<br>**الإجراء التالي:** تحقّق من تطابق إصدار حاوية `accounting-app` واعتماد الحزمة التقنية في `/applications-catalogue/accounting`، ثم اضغط **إعادة التهيئة**. |
| `ACCOUNTING.PROVISIONING.FENCE_NOT_READY` *(Retryable on any `accounting.*` step)* | **Cause:** The tenant database credentials or access-policy fence for `mutakamel_accounting_app` had not finished propagating to the target PostgreSQL server.<br>**Effect:** No schema or seed changes were written on this attempt; the operation settled `FAILED_RETRYABLE`.<br>**Next action:** Confirm the server binding is `READY` in `/applications-catalogue/accounting`, then click **Re-provision**. | **السبب:** لم يكتمل وصول اعتمادات قاعدة البيانات أو حاجز سياسة الوصول لدور `mutakamel_accounting_app` إلى خادم PostgreSQL المستهدف.<br>**الأثر:** لم تُكتب أي تغييرات على المخطط أو البذور في هذه المحاولة؛ واستقرت العملية على `FAILED_RETRYABLE`.<br>**الإجراء التالي:** تأكد من أن حالة ربط الخادم `READY` في `/applications-catalogue/accounting`، ثم اضغط **إعادة التهيئة**. |
| `WORKER.PROVISIONING.OWNER_RESULT_TIMEOUT` *(Retryable after `45 min` silent claim)* | **Cause:** `accounting-app` did not return a signed step result within the 45-minute execution bound.<br>**Effect:** Worker closed the stalled attempt safely; the fencing token blocks any late stale write.<br>**Next action:** Check `accounting-app` and `core.domain` broker health, click **Resync** if open, or click **Re-provision** to start a fresh fenced generation. | **السبب:** لم يُرجع تطبيق المحاسبة `accounting-app` نتيجة خطوة موقّعة خلال المهلة القصوى البالغة 45 دقيقة.<br>**الأثر:** أغلق العامل المحاولة المتوقفة بأمان؛ ويمنع رمز الحماية (Fence) أي كتابة متأخرة قديمة.<br>**الإجراء التالي:** تحقّق من سلامة `accounting-app` ووسيط الرسائل، ثم اضغط **إعادة التهيئة** لبدء جيل جديد محمي. |
| `TENANT_PROVISIONING_RELEASE_UPGRADE_REQUIRED` *(`409` on commercial prepare or `add-application`)* | **Cause:** One or more components already installed on this tenant lag their current published release.<br>**Effect:** The Accounting addition was not started; current subscription and database state are unchanged.<br>**Next action:** Click **Open Updates** to bring existing components to their current release, then add Accounting again. | **السبب:** يوجد مكوّن واحد أو أكثر مثبّت لدى هذا المستأجر متأخر عن إصداره المنشور الحالي.<br>**الأثر:** لم يبدأ طلب إضافة المحاسبة؛ ولم تتغير حالة الاشتراك أو قاعدة البيانات.<br>**الإجراء التالي:** اضغط **فتح التحديثات** لترقية المكوّنات الحالية أولاً، ثم أعد طلب إضافة المحاسبة. |
| `GW.IDEM.IN_FLIGHT` / Network Timeout *(Ambiguous Write)* | **Cause:** The request is still processing or the connection dropped before Core returned a definitive receipt.<br>**Effect:** The command may have succeeded or may still be running; sending a new key could create a duplicate intent.<br>**Next action:** Click **Refresh Status** first. Only if no new operation appears, click **Retry Exact Request** (reuses the same UUIDv7 key). | **السبب:** لا يزال الطلب قيد المعالجة أو انقطع الاتصال قبل استلام إيصال نهائي من النواة.<br>**الأثر:** قد يكون الأمر قد نجح أو لا يزال قيد التنفيذ؛ وإرسال مفتاح جديد قد يُنشئ طلباً مكرراً.<br>**الإجراء التالي:** اضغط **تحديث الحالة** أولاً. وإذا لم تظهر العملية، اضغط **إعادة المحاولة بنفس المفتاح** (يُعيد استخدام مفتاح `UUIDv7` ذاته). |

---

## 8. ASCII Wireframes in Four Combinations (`AR-RTL` / `EN-LTR` × `Light` / `Dark`)

All four wireframes adhere to the Admin Portal Ocean Navy v3 / Cold-Blue token system (`frontend/admin-portal/docs/design-system/tokens.md`), compact 44px/36px row rhythm, maximum one filled `variant="primary"` CTA in the active region, non-colour-alone status badges (Icon + Label), logical RTL mirroring (`start` = right in `ar`, left in `en`), and `<bdi dir="ltr">` Western-digit islands (`0-9`) for all machine keys, versions, checksums, durations, and correlation IDs.

### 8.1 Combination 1 — Arabic RTL · Light Theme (`dir="rtl"` · `theme="light"`)
**Scenario:** Watching live `ADD_APPLICATION` (`generation 4`, `RUNNING`) on `/tenants/[id]?tab=provisioning` as `accounting.schema` and the generic packs complete and `accounting.seed.accounting.eg.tax-rules` executes.
**Light Tokens:** Canvas `bg-background` (`#F7FAFC`) · Surface `bg-card` (`#FFFFFF`) · Border `border-border` (`#E2E8F0`) · Info badge `bg-info-subtle` (`#EBF5FF` / `#1D4ED8`) · Success badge `bg-success-subtle` (`#ECFDF5` / `#047857`).

```text
+----------------------------------------------------------------------------------------------------------------------+
| [بحث ⌘K]  [☀ فاتح] [EN] [📞] [🔔] [كمال (مشرف عام)]                     لوحة تحكم المنصة · المتكامل (منفذ 5001) 🏛️ |
+--------------------------------------------------------------------------------------------------+-------------------+
| مسار التنقل: المستأجرون ‹ شركة مرساني للتجارة (mersany) ‹ التهيئة                               | القائمة الرئيسية  |
|                                                                                                  | ----------------- |
| [تحديث الحالة ↻]                     [⟳ تحديث تلقائي · 3 ث]  مساحة عمل المستأجر: شركة مرساني     | • لوحة المتابعة   |
| ------------------------------------------------------------------------------------------------ | • المستأجرون   ◀  |
| التبويبات:  [التخزين]   [الفوترة]   [الوصول]   [*التهيئة*]   [نظرة عامة]                         | • الاشتراكات      |
| ================================================================================================ | • دليل التطبيقات  |
| أقسام التهيئة: [إجراءات مُدارة 🔧] [المتطلبات 🛡] [الحالة 📦] [التحديثات ↺] [*العمليات 🕓*]      | • التهيئة العامة  |
| +-----------------------------------------------------------------------+----------------------+ | • خوادم البيانات  |
| | تفاصيل العملية المحددة (الجيل 4)                                      | سجل العمليات (الأحدث)| |                   |
| | +-------------------------------------------------------------------+ | +------------------+ | |                   |
| | | [مزامنة التقدم] [طلب الإلغاء] [⟳ قيد التنفيذ]  إضافة تطبيق · جيل 4| | | *إضافة تطبيق*    | | |                   |
| | | المرحلة الحالية: المحاسبة — قواعد الضرائب (مصر)                   | | | [⟳ قيد التنفيذ]  | | |                   |
| | | التقدم المرجّح: [████████████████░░░░░░░░░░░░░░] 52%              | | | الجيل 4 · 19:14  | | |                   |
| | | 11/29 خطوات مكتملة  ·  0 فاشلة  ·  مراجعة سياسة الوصول: 7         | | | ‹ قواعد الضرائب  | | |                   |
| | | بصمة الخطة: [ltr: 9f4c2a81e03b] · طُلبت: 01/11/2026, 07:14 PM     | | +------------------+ | |                   |
| | +-------------------------------------------------------------------+ | +------------------+ | |                   |
| |                                                                       | | تهيئة أولية      | | |                   |
| | خطوات العملية المحمية (Fenced Steps — 29 خطوة لمكوّن accounting)     | | [✓ نجحت]         | | |                   |
| | +------+---------+----------+----------+-------------+--------------+ | | الجيل 3 · 12/09  | | |                   |
| | |محاولة| المدة   | الانتهاء | البدء    | الحالة      | الخطوة / النوع| | | ‹ مكتملة         | | |                   |
| | +------+---------+----------+----------+-------------+--------------+ | +------------------+ | |                   |
| | | 1 ↻  | 4s      | 19:14:06 | 19:14:02 | [✓ نجحت]    | المحاسبة — المخطط                     | |                   |
| | |      |         |          |          |             | [ltr: accounting.schema] · المخطط     | |                   |
| | | 1 ↻  | 1s      | 19:14:08 | 19:14:07 | [✓ نجحت]    | المحاسبة — الصلاحيات                  | |                   |
| | |      |         |          |          |             | [ltr: accounting.seed.accounting.permissions] |             |
| | | ...  | ...     | ...      | ...      | [✓ نجحت]    | (حزم البذور العامة وحزم مصر 2..10 مكتملة)    |             |
| | | 1 ↻  | 6s      | —        | 19:14:21 | [⟳ قيد      | المحاسبة — قواعد الضرائب (مصر)        | |                   |
| | |      |         |          |          |    التنفيذ] | [ltr: accounting.seed.accounting.eg.tax-rules]|             |
| | | 0 ↻  | —       | —        | —        | [◌ انتظار]  | المحاسبة — تعريفات الإقرارات (مصر)    | |                   |
| | |      |         |          |          |             | [ltr: accounting.seed.accounting.eg.return-definitions]     |
| | | ...  | ...     | ...      | ...      | [◌ انتظار]  | (بقية حزم مصر والحزمة الأساسية 13..27)| |                   |
| | | 0 ↻  | —       | —        | —        | [◌ انتظار]  | المحاسبة — التحقق                     | |                   |
| | |      |         |          |          |             | [ltr: accounting.verify] · التحقق     | |                   |
| | +------+---------+----------+----------+-------------+--------------+ | عرض 2 من 2           | |                   |
| +-----------------------------------------------------------------------+----------------------+ +-------------------+
```

---

### 8.2 Combination 2 — Arabic RTL · Dark Theme (`dir="rtl"` · `theme="dark"`)
**Scenario:** **Named Failing Step (`FAILED_RETRYABLE`)** — Step #12 (`accounting.seed.accounting.eg.tax-rules`) failed after transient PostgreSQL connection exhaustion; `FailingStepCallout` names the exact step, code, attempt count, and `Re-provision` exit above the table while keeping downstream steps `PENDING`.
**Dark Tokens:** Canvas `bg-background` (`#0B111B`) · Surface `bg-card` (`#111A27`) · Border `border-border` (`#1E293B`) · Destructive subtle `bg-destructive-subtle` (`#2C1219` / `#FCA5A5`) · Primary button `bg-primary` (`#3B82F6`).

```text
+----------------------------------------------------------------------------------------------------------------------+
| [بحث ⌘K]  [🌙 داكن] [EN] [📞] [🔔] [كمال (مشرف عام)]                     لوحة تحكم المنصة · المتكامل (منفذ 5001) 🏛️ |
+--------------------------------------------------------------------------------------------------+-------------------+
| مسار التنقل: المستأجرون ‹ شركة مرساني للتجارة (mersany) ‹ التهيئة                               | القائمة الرئيسية  |
|                                                                                                  | ----------------- |
| [تحديث الحالة ↻]                                         مساحة عمل المستأجر: شركة مرساني         | • لوحة المتابعة   |
| ------------------------------------------------------------------------------------------------ | • المستأجرون   ◀  |
| التبويبات:  [التخزين]   [الفوترة]   [الوصول]   [*التهيئة*]   [نظرة عامة]                         | • الاشتراكات      |
| ================================================================================================ | • دليل التطبيقات  |
| أقسام التهيئة: [إجراءات مُدارة 🔧] [المتطلبات 🛡] [الحالة 📦] [التحديثات ↺] [*العمليات 🕓*]      | • التهيئة العامة  |
| +-----------------------------------------------------------------------+----------------------+ | • خوادم البيانات  |
| | تفاصيل العملية المحددة (الجيل 4 — توقفت عند خطوة مسمّاة)              | سجل العمليات (الأحدث)| |                   |
| | +-------------------------------------------------------------------+ | +------------------+ | |                   |
| | | [*إعادة التهيئة*]  [⚠ فشل قابل للإعادة]        إضافة تطبيق · جيل 4| | | *إضافة تطبيق*    | | |                   |
| | | المرحلة الحالية: المحاسبة — قواعد الضرائب (مصر)                   | | | [⚠ فشل قابل      | | |                   |
| | | التقدم المرجّح: [███████████████░░░░░░░░░░░░░░░] 48%              | | |    للإعادة]      | | |                   |
| | | 11/29 خطوات مكتملة  ·  1 فاشلة  ·  مراجعة سياسة الوصول: 7         | | | الجيل 4 · 19:40  | | |                   |
| | | مزامنة التقدم: أُغلقت العملية نهائياً؛ استخدم إعادة التهيئة لجيل 5| | +------------------+ | |                   |
| | +-------------------------------------------------------------------+ |                      | |                   |
| |                                                                       |                      | |                   |
| | +===================================================================+ |                      | |                   |
| | | ⚠ تنبيه الخطوة الفاشلة (1 خطوة فاشلة)               [الانتقال ↓] | |                      | |                   |
| | | الخطوة: المحاسبة — قواعد الضرائب (مصر)                            | |                      | |                   |
| | | مفتاح الخطة: [ltr: accounting.seed.accounting.eg.tax-rules]       | |                      | |                   |
| | | النوع: بيانات النظام · المالك: [ltr: accounting-app] · المحاولة: 2| |                      | |                   |
| | | الرمز: [ltr: ACCOUNTING.PROVISIONING.CONNECTION_TIMEOUT]          | |                      | |                   |
| | | السبب: انتهت مهلة اتصال المحاسبة بخادم PostgreSQL أثناء البذر.    | |                      | |                   |
| | | الأثر: أُلغيت معاملة هذه الحزمة بأمان؛ الحزم 1..11 محفوظة وسليمة. | |                      | |                   |
| | | الإجراء التالي: تحقّق من استقرار الخادم ثم اضغط «إعادة التهيئة».  | |                      | |                   |
| | +===================================================================+ |                      | |                   |
| |                                                                       |                      | |                   |
| | +------+---------+----------+----------+-------------+--------------+ |                      | |                   |
| | |محاولة| المدة   | الانتهاء | البدء    | الحالة      | الخطوة / النوع| |                      | |                   |
| | +------+---------+----------+----------+-------------+--------------+ |                      | |                   |
| | | 1 ↻  | 4s      | 19:14:06 | 19:14:02 | [✓ نجحت]    | المحاسبة — المخطط [ltr: accounting.schema]          |       |
| | |▌2 ↻  | 25m 04s | 19:39:25 | 19:14:21 | [⚠ فشلت]    | المحاسبة — قواعد الضرائب (مصر)        | |                   |
| | |▌     |         |          |          |             | [ltr: accounting.seed.accounting.eg.tax-rules]      |       |
| | |▌     |         |          |          |             | [ltr: ACCOUNTING.PROVISIONING.CONNECTION_TIMEOUT]   |       |
| | | 0 ↻  | —       | —        | —        | [◌ انتظار]  | المحاسبة — التحقق [ltr: accounting.verify]          |       |
| | +------+---------+----------+----------+-------------+--------------+ |                      | |                   |
| +-----------------------------------------------------------------------+----------------------+ +-------------------+
```

---

### 8.3 Combination 3 — English LTR · Light Theme (`dir="ltr"` · `theme="light"`)
**Scenario:** Two-part LTR Light operational flow on `/tenants/[id]?tab=provisioning`: **(Top)** Evidence-Prefilled `Add Application` card in `Managed actions` (`applicationKey: "accounting"`), and **(Bottom)** Completed `SUCCEEDED` `Operations` view showing the `ACT-02 → ACT-03` Chief Accountant handoff notice (plus how a `StalledBadge` with `Resync` renders before completion without implying a resend).
**Light Tokens:** Canvas `bg-background` (`#F7FAFC`) · Surface `bg-card` (`#FFFFFF`) · Border `border-border` (`#E2E8F0`) · Warning subtle `bg-warning-subtle` (`#FFFBEB` / `#B45309`).

```text
+-------------------+--------------------------------------------------------------------------------------------------+
| 🏛️ Mutakamel :5001| Platform Admin · Breadcrumb: Tenants › Mersany Trading Co. (mersany) › Provisioning              |
+-------------------+--------------------------------------------------------------------------------------------------+
| MAIN NAVIGATION   | Tenant Workspace: Mersany Trading Co.                   [⟳ Live polling · 15s]  [↻ Refresh]      |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| • Dashboard       | Tabs:  [Overview]   [*Provisioning*]   [Access]   [Billing]   [Storage]                          |
| • Tenants       ▶ | ================================================================================================ |
| • Subscriptions   | Sub-tabs: [🕓 Operations] [↺ Updates] [📦 State] [🛡 Prerequisites] [*🔧 Managed actions*]       |
| • Apps Catalogue  | +--------------------------------------------------------------+-------------------------------+ |
| • Provisioning    | | Add Application (Server-Pinned Evidence)                     | Repair / Decommission         | |
| • DB Servers      | | Select an entitled application to provision on tenant DB.    |                               | |
|                   | | Application *:        [ Accounting (accounting)          ▾ ] | Component: [ accounting · — ] | |
|                   | | Access Policy Rev *:  [ 7                         (locked) ] | (Available after installation | |
|                   | | Reason Code *:        [ ENABLE_ACCOUNTING_PILOT            ] |  reaches READY or FAILED.)    | |
|                   | | Presets: [ENABLE_ACCOUNTING_SUBSCRIPTION] [OPS_PROVISION]    |                               | |
|                   | | +----------------------------------------------------------+ |                               | |
|                   | | | Pinned Target Release Evidence (Read-Only from Core)     | |                               | |
|                   | | | Component:  accounting · UUID: 0195f2a0-7b1c-7000-8123…  | |                               | |
|                   | | | Release:    1.0.0 (AccountingTenantBaseline1800000000200)| |                               | |
|                   | | | Checksum:   a48e19c07d2f...91b4 (27 seed packs + verify) | |                               | |
|                   | | +----------------------------------------------------------+ |                               | |
|                   | | [*Create Add-Application Operation*]                         |                               | |
|                   | +--------------------------------------------------------------+-------------------------------+ |
|                   |                                                                                                  |
|                   | --- AFTER AUTOMATIC SWITCH TO [🕓 Operations] ON 202 ACCEPTED → COMPLETION (ACT-01 → ACT-02) --- |
|                   | +----------------------------------------------------------------------------------------------+ |
|                   | | ✓ Accounting Provisioning Succeeded — Ready for Tenant Company Activation (SCR-01)           | |
|                   | | Schema, 27 seed packs, and role privilege checks (accounting.verify) are READY. Per D-508,   | |
|                   | | no company profile was created here; the tenant Chief Accountant now completes activation    | |
|                   | | (currency, calendar, country/base pack, opening balances) in the Tenant Portal.              | |
|                   | +----------------------------------------------------------------------------------------------+ |
|                   | | (Note — When stalled mid-run >3m: [⏳ Stalled at Accounting — verification · 4m] [Resync]     | |
|                   | |  asks Worker to re-deliver retained events under original IDs; it NEVER resends the step.)   | |
|                   | +----------------------------------------------------------------------------------------------+ |
+-------------------+--------------------------------------------------------------------------------------------------+
```

---

### 8.4 Combination 4 — English LTR · Dark Theme (`dir="ltr"` · `theme="dark"`)
**Scenario:** **Named Failing Step (`MANUAL_RECOVERY_REQUIRED`)** — Step #1 (`accounting.schema`) failed deterministically with `ACCOUNTING_PROVISIONING_CORE_SCHEMA_MISSING` (`D-556`) because `core.foundation` lacked a required table/column. Shows non-retryable terminal diagnosis, `FailingStepCallout`, step table, and `OperationTimeline` event `#3`.
**Dark Tokens:** Canvas `bg-background` (`#0B111B`) · Surface `bg-card` (`#111A27`) · Border `border-border` (`#1E293B`) · Destructive subtle `bg-destructive-subtle` (`#2C1219` / `#FCA5A5`).

```text
+-------------------+--------------------------------------------------------------------------------------------------+
| 🏛️ Mutakamel :5001| Platform Admin · Breadcrumb: Tenants › Mersany Trading Co. (mersany) › Provisioning  [🌙 Dark]   |
+-------------------+--------------------------------------------------------------------------------------------------+
| MAIN NAVIGATION   | Tenant Workspace: Mersany Trading Co.                                            [↻ Refresh]     |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| • Dashboard       | Tabs:  [Overview]   [*Provisioning*]   [Access]   [Billing]   [Storage]                          |
| • Tenants       ▶ | ================================================================================================ |
| • Subscriptions   | Sub-tabs: [*🕓 Operations*] [↺ Updates] [📦 State] [🛡 Prerequisites] [🔧 Managed actions]       |
| • Apps Catalogue  | +----------------------+-----------------------------------------------------------------------+ |
| • Provisioning    | | Operations (Newest)  | Selected Operation Detail (Generation 4)                              | |
| • DB Servers      | | +------------------+ | +-------------------------------------------------------------------+ | |
|                   | | | *Add application*| | | Add application · generation 4   [⚠ Manual recovery] [*Re-prov.*] | | |
|                   | | | [⚠ Manual recov.]| | | Current phase: Accounting — schema                                | | |
|                   | | | Gen 4 · 19:50    | | | Weighted progress: [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0%            | | |
|                   | | | › Accounting —   | | | 0/29 steps  ·  1 failed  ·  Access policy revision: 7             | | |
|                   | | |   schema       › | | | Plan digest: 9f4c2a81e03b  ·  Requested: Nov 1, 2026, 7:50 PM     | | |
|                   | | +------------------+ | +-------------------------------------------------------------------+ | |
|                   | |                      |                                                                       | |
|                   | |                      | +===================================================================+ | |
|                   | |                      | | ⚠ NAMED FAILING STEP (1 of 29)                  [Jump to row ↓]   | | |
|                   | |                      | | Step:      Accounting — schema                                    | | |
|                   | |                      | | Plan key:  accounting.schema  ·  Kind: Schema  ·  Owner: accounting-app |
|                   | |                      | | Attempt:   1 (Non-retryable terminal prerequisite check)          | | |
|                   | |                      | | Safe code: ACCOUNTING_PROVISIONING_CORE_SCHEMA_MISSING            | | |
|                   | |                      | | Cause:     Required Core foundation tables/columns (e.g.          | | |
|                   | |                      | |            companies.country_code) are absent on this tenant DB.  | | |
|                   | |                      | | Effect:    Stopped cleanly before creating acc_* tables; 27 seed  | | |
|                   | |                      | |            packs & accounting.verify stayed PENDING.              | | |
|                   | |                      | | Action:    Upgrade/repair core.foundation in [Updates], then      | | |
|                   | |                      | |            click [Re-provision] to run Generation 5.              | | |
|                   | |                      | +===================================================================+ | |
|                   | |                      |                                                                       | |
|                   | |                      | +------------------------------+--------+-------------+-----+-------+ | |
|                   | |                      | | Step                         | Kind   | Status      | Elp | Att.  | | |
|                   | |                      | +------------------------------+--------+-------------+-----+-------+ | |
|                   | |                      | |▌Accounting — schema          | Schema | [⚠ Failed]  | 1s  | 1     | | |
|                   | |                      | |▌accounting.schema            |        |             |     |       | | |
|                   | |                      | |▌ACCOUNTING_PROVISIONING_CORE_SCHEMA_MISSING         |     |       | | |
|                   | |                      | | Accounting — Permissions     | System | [◌ Pending] | —   | 0 ↻   | | |
|                   | |                      | | accounting.seed.accounting.permissions              |     |       | | |
|                   | |                      | | ... (26 remaining seed packs)| System | [◌ Pending] | —   | 0 ↻   | | |
|                   | |                      | | Accounting — verification    | Verif. | [◌ Pending] | —   | 0 ↻   | | |
|                   | |                      | +------------------------------+--------+-------------+-----+-------+ | |
|                   | |                      | Timeline (3)                                                          | |
|                   | |                      | ● Step failed · #3 · Nov 1, 2026, 7:50:03 PM — accounting.schema      | |
|                   | |                      | ● Step started · #2 · Nov 1, 2026, 7:50:02 PM — accounting.schema     | |
|                   | |                      | ● Operation planned · #1 · Nov 1, 2026, 7:50:01 PM                    | |
|                   | +----------------------+-----------------------------------------------------------------------+ |
+-------------------+--------------------------------------------------------------------------------------------------+
```

---

## 9. Bilingual, RTL, Accessibility & Design-System Compliance Checklist

1. **Zero Language Ternaries in JSX Markup:** All English and Arabic strings live in `src/i18n/dictionaries/{en,ar}.ts` (`tenantProvisioning`, `applicationsCatalogue`, `commercialWorkspace`) and `model/step-labels.ts`.
2. **Logical CSS Properties Exclusively:** `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `border-s-*`, `text-start`, `text-end`, and `rtl:rotate-180` on directional chevrons (`ChevronRight`). Zero `ml-*`/`mr-*`/`pl-*`/`pr-*`/`left-*`/`right-*`.
3. **LTR Islands & Western Digits (`0-9`):** All UUIDv7s, `stepKey`s (`accounting.seed.*`), SHA-256 digests, error codes, SQL role names (`mutakamel_accounting_app`), revision integers, USD amounts, and timestamps use `dir="ltr"` / `<bdi>` with `font-mono` or `tabular-nums` and `ar-EG-u-nu-latn` / `en-US` formatting.
4. **7-Step Typography & 3-Weight Policy:** Never smaller than `text-xs` (`13px`), never `text-[Npx]`, weights strictly `400` / `500` / `600` (`font-normal`, `font-medium`, `font-semibold`), zero `font-bold`, zero `uppercase tracking-wide` on Arabic text (`rtl:normal-case rtl:tracking-normal`).
5. **WCAG 2.1 AA Non-Colour Status & Focus Management:**
   - Every operation/step status pairs semantic tone + distinct Lucide icon + translated text (`CheckCircle2` `SUCCEEDED`, `LoaderCircle` `RUNNING` spinning only when `!stall` and `motion-reduce:animate-none`, `Hourglass` `StalledBadge`, `RotateCcw` `WAITING_RETRY`, `AlertTriangle` `FAILED`/`CONFLICT`, `CircleSlash` `SKIPPED`, `Ban` `CANCEL_REQUESTED`).
   - Action errors move focus deterministically (`errorRef.current?.focus()` on `role="alert" tabIndex={-1}`). `StallNotice` intentionally omits `aria-live` so `ageSeconds` refreshes do not spam screen readers every 3 seconds.

---

## 10. Contract Gap List for `P03.T11` Reconciliation

Per `agy-P03.T10.S6.md`, nothing missing from verified contracts was invented above. The following **6 concrete contract/documentation gaps** require reconciliation in `P03.T11` (and Stage-0/Stage-1 Core/Admin-Portal implementation):

| Gap ID | Severity | Affected Artefacts | Exact Discrepancy Verified | Required Reconciliation in `P03.T11` |
| --- | --- | --- | --- | --- |
| **`CG-15`** | **High (Stage-0 Blocker)** | `12_Platform_Changes.md` §4.1 #35 & §4.6 vs `admin-core-api-routes.md` & `docs/api/database-servers.md` | `12_Platform_Changes.md` §4.6 specifies `POST /api/admin/core/v1/database-servers/application-roles/accounting/ensure` (`admin.database_servers.update + admin.database_servers.critical`, body `{ reason: string, recoveryLogin?: boolean }`) to pre-create `mutakamel_accounting_app` and `mutakamel_accounting_recovery` (`NOLOGIN` in Stage 0; `recoveryLogin: true` in Stage 2) across all `DRAFT`/`ACTIVE`/`DRAINING` PostgreSQL servers before `accounting` is activated. **This route does not exist yet in Gateway route contracts (`admin-core-api-routes.md`) or Core controller.** *(Note: Stage-1 Vertical Slice can still bind individual `ACTIVE` servers via `POST /applications/accounting/database-servers/bind` or `POST /database-servers/:id/applications/accounting/bootstrap` once Core's `DatabaseServerCredentialsService` registers `accounting`.)* | Add Core controller + Gateway route contract `core.admin.database-servers.application-roles.ensure` (`WRITE_SENSITIVE`, `idempotent: true`, `ALL`: `admin.database_servers.update + admin.database_servers.critical`), request DTO `{ reason, recoveryLogin? }`, and receipt DTO before wiring the Stage-0 fleet role-ensure dialog in `/database-servers`. |
| **`CG-ADM02-01`** | **Medium (Inventory RBAC Drift)** | `frontend/tenant-portal/docs/plans/accounting-screen-inventory.md` row `ADM-02` vs `admin-core-api-routes.md` & `rbac.ts` | Row `ADM-02` in `accounting-screen-inventory.md` lists `admin.catalog.update + admin.catalog.critical` for `/applications/:applicationKey/publish` and `/activate`, and `admin.provisioning.read` for `/provisioning`. Verified against `admin-core-api-routes.md` & `rbac.ts`:<br>• `/applications/:applicationKey/publish` & `/activate` actually require **`admin.applications.update` + `admin.applications.critical`**.<br>• Tier/feature/price writes require **`admin.catalog.manage`** (`+ admin.catalog.critical` on `PATCH`), never `admin.catalog.update` (key does not exist).<br>• `/provisioning/components` requires **`admin.tenants.read`** and `/provisioning/releases` requires **`admin.provisioning.releases.read`** (`admin.provisioning.read` does not exist). | Update `accounting-screen-inventory.md` row `ADM-02` Permission column to the exact Gateway-verified RBAC keys listed in §4 of this spec. |
| **`CG-ADM02-02`** | **Low (Stale Admin Doc DTO Field)** | `frontend/admin-portal/docs/api/tenant-operations.md` §Managed commands (line 860) vs `provisioning/types.ts:540` & `commands.ts:172` | `docs/api/tenant-operations.md` still documents `CreateAddModuleProvisioningOperationDto { moduleKey: string, ... }`, whereas the live Core route `/provisioning/operations/add-application` and Admin Portal validator (`validateAddApplicationInput`) strictly require **`applicationKey: string`** (rejecting `moduleKey` via `hasOnlyKeys`). | Refresh `frontend/admin-portal/docs/api/tenant-operations.md` §Managed commands from `moduleKey` to `applicationKey` (`CreateAddApplicationOperationDto`). |
| **`CG-ADM02-03`** | **Medium (Plan Prose Seed Count Drift: 15 vs 27)** | `accounting-app-plan-p03-ux-foundation.md` (`P03.T10`) & `agy-P03.T10.S6.md` vs `12_Platform_Changes.md` §4.3 & `02_Database_Package.md` §11 | Plan prose refers to *"the 15 `accounting.seed.<pack>`"*, reflecting an earlier pre-`D-722`/`D-751`/`D-752`/`D-756` count (`3` generic + `12` Egypt = `15`). Authoritative LLD (`02_Database_Package.md` §11 & `12_Platform_Changes.md` §4.3) now declares **27** seed packs (`6` generic + `12` `accounting.eg.*` + `9` `accounting.base.*`), all 27 registered in Stage-1 release identity (carrying slice content in `P15`). | Align plan prose in `P03.T11` to **27** `accounting.seed.<pack>` steps (`29` steps total including `accounting.schema` and `accounting.verify`, plus Stage-6 `accounting.decommission-retained`). |
| **`CG-ADM02-04`** | **Medium (Admin Portal Owner Code & Step Labels Missing `accounting`)** | `tenant-workspace/provisioning/model/code-text.ts` & `model/step-labels.ts` | `code-text.ts` restricts `ProvisioningCodeOwner` to `"CORE" \| "CRM" \| "TRADE"` and omits `"ACCOUNTING"`, `ACCOUNTING.PROVISIONING.*`, `ACCOUNTING_PROVISIONING_CORE_SCHEMA_MISSING`, and `ACCOUNTING_PROVISIONING_SEED_CATALOGUE_DRIFT`. `step-labels.ts` maps only `core.foundation`, `crm`, and `trade`, causing all 30 `accounting.*` steps to fall back to raw English machine keys in both EN and AR. | Implement the exact `ProvisioningCodeOwner` (§7.1) and 30-step bilingual `COMPONENTS`/`STEPS` dictionary (§2.6) in `admin-portal` during Stage-1 frontend implementation. |
| **`CG-ADM02-05`** | **Low (Catalogue Seed vs Manual Tier Authoring Boundary)** | `12_Platform_Changes.md` §4.1 #23 & §4.2 vs `frontend/admin-portal/docs/api/catalog.md` §Seeded catalogue | `catalog.md` notes Core's `CATALOG_SEED` currently seeds only the root Application row (`DRAFT` + `UNPUBLISHED`) while tiers (`accounting.basic`, `accounting.advanced`), 64 features, tier-feature grants, and USD price ladders are administrator-authored via `/applications-catalogue/accounting` unless `12_Platform_Changes.md` §4.1 #23 seeds the tier/feature definitions in Core. | Confirm in `P03.T11` / Core Stage-1 task whether `CATALOG_SEED` pre-populates the 64 `Feature` rows and 2 `Tier` rows (`accounting.basic`, `accounting.advanced`) leaving only USD `price-tiers` + `Publish`/`Activate` to the operator, or whether operators create features/tiers via UI/seed script. Surface B (§2.2) supports both cleanly. |

## Contract reconciliation (P03.T11, 1 November 2026)

Reconciles the gaps of this spec against the Endpoint Catalogue, `02_DTOs.md` and `12_Platform_Changes.md` after `D-770`, `D-771` and `D-772`. None of the three rulings touches the admin contract. The gap list above keeps the original findings; these rulings are final.

| Gap id | Ruling | Where |
| --- | --- | --- |
| `CG-15` | already in the contract | `12_Platform_Changes.md` §4.1 change 35 and §4.6 specify the `ensure` route (`admin.database_servers.update` + `admin.database_servers.critical`, `reason`, `recoveryLogin?`); the delivering task is P05.T05 (stage 0, `recoveryLogin` with P21.T04.S6). The generated route inventory lists it only once that task ships, so it is not a contract gap |
| `CG-ADM02-01` | already in the contract | The generated route inventory and `rbac.ts` give the real keys (`admin.applications.update` + `admin.applications.critical` for publish and activate, `admin.catalog.manage` for tier writes); the stale keys of inventory row `ADM-02` are an inventory-only correction, not a contract change |
| `CG-ADM02-02` | already in the contract | The live route and validator use `applicationKey`; the stale `moduleKey` text lives in `admin-portal/docs/api/tenant-operations.md` and is refreshed there, with no backend contract change |
| `CG-ADM02-03` | already in the contract | `12_Platform_Changes.md` §4.3 `seedPacks` lists 27 entries; this spec keeps 27 seed steps (29 with schema and verify); no plan prose needs changing |
| `CG-ADM02-04` | dropped (planned implementation, not a contract gap) | P12.T12.S2 owns the bilingual `accounting.*` step labels and the `ACCOUNTING` owner code; the codes already exist in the Database Package §11 and the dependency document |
| `CG-ADM02-05` | already in the contract | `CATALOG_SEED` carries the sixty-four feature keys and seeds the tier grants (28 Basic, 64 Advanced; `12_Platform_Changes.md` §4.1 change 23 and §4.2); the operator sets prices and publishes and activates |
