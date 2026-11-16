# Accounting Stage-1 Screen Specifications — Posting Exceptions, Bulk Operations, Recurring Entries & Posting Rules (`P03.T09.S5`)

> **Lead review, 1 November 2026 (P03.T09).** One reference was corrected: a period state change in bulk needs `accounting.period.change_state`. Every route, permission, feature key and scope below was checked against `docs/LLD/accounting-app/02_API_Contracts/02_Endpoint_Catalogue.md` and `04_Static_Data/05_Permissions_and_Features.md`; what the contracts lack stays in the contract gap list for `P03.T11`.

Status: **Stage-1 detailed screen specification — ready for lead review (`P03.T09.S5`)**
Target portal path on merge (`P03.T12`): `tenant-portal/docs/design/specs/accounting-stage1-exceptions-bulk-rules.md`
Owning frontend app: `tenant-portal` (strictly port `5002`; HTTP cookie profile `mutakamel-http-tenant-*`, HTTPS `__Host-mutakamel-tenant-*`)
Owning backend apps: `accounting-app` (`/api/tenant/accounting/v1/*`), `core-app` (`/api/tenant/core/v1/*`), `api-gateway-app` (public browser route contract)
Last source verification: **2026-11-01**

**Binding authorities consumed:**
- Backend Accounting LLD:
  - `backend/docs/LLD/accounting-app/02_API_Contracts/01_Context_Headers_and_Responses.md`
  - `backend/docs/LLD/accounting-app/02_API_Contracts/02_Endpoint_Catalogue.md` (§4 Module 02 lines 284–313; §10 Module 08 lines 1003–1009; §11 Module 09 lines 1057–1072)
  - `backend/docs/LLD/accounting-app/04_Static_Data/01_Enums.md`, `02_DTOs.md` (§3, §5, §12, §13), `03_Interfaces_and_Value_Objects.md`, `04_Errors_and_Constants.md`, `05_Permissions_and_Features.md`
  - `backend/docs/LLD/accounting-app/01_ERD/02_Ledger_Tables.md` (§6 `acc_posting_exceptions`, §7 `acc_recurring_templates` / `lines` / `runs`, §10 `acc_bulk_operations`)
  - `backend/docs/LLD/accounting-app/01_ERD/09_Integration_and_Reliability_Tables.md` (§3 `AccountRole`, §4 `acc_posting_profiles` / `acc_posting_rule_versions` / `acc_posting_rules`, §5 `acc_inbox_events` / `acc_source_document_links`)
  - `backend/docs/LLD/accounting-app/07_Modules/10_MVP/02_ledger_posting.md`, `09_integration_and_posting_rules.md`
- Tenant Portal Design System, Skills & Approved Stage-0 Accounting Specs:
  - `frontend/.agents/skills/ui-ux-pro-max/SKILL.md` & `frontend-design/SKILL.md`
  - `tenant-portal/docs/design/README.md`, `tokens.md`, `typography.md`, `primitives.md`, `patterns.md`, `views.md`, `states.md`, `accessibility.md`, `i18n.md`, `anti-patterns.md`
  - `tenant-portal/docs/architecture/file-architecture.md`, `data-layer.md`
  - `tenant-portal/docs/plans/accounting-screen-inventory.md`
  - `tenant-portal/docs/design/specs/accounting-ia.md` (`P03.T01`)
  - `tenant-portal/docs/design/specs/accounting-home.md` (`P03.T02`)
  - `tenant-portal/docs/design/specs/accounting-status-and-a11y.md` (`P03.T04`)
  - `tenant-portal/docs/design/specs/accounting-patterns-data.md` (`P03.T05`)
  - `tenant-portal/docs/design/specs/accounting-patterns-workflow.md` (`P03.T06`)
  - `tenant-portal/docs/design/specs/accounting-patterns-documents.md` (`P03.T07`)

---

## 0. Governance, `SCR-08` Scope Reconciliation & Non-Negotiable Laws

### 0.1 Scope & `SCR-08` Inventory Reconciliation (Zero Orphaned Endpoints)

Across the planning baselines, two Stage-1 surfaces share the `SCR-08` identifier:
1. `backend/docs/plans/accounting-app-inventory-frontend.md` (line 82), `accounting-app-plan-p03-ux-foundation.md`, and task brief `agy-P03.T09.S5.md` assign **`SCR-08` = Bulk Operations** (`#52` `/accounting/post/bulk-operations`, `#53` `/accounting/post/bulk-operations/[id]`; `bulk-operations` `[P: 3]`).
2. `tenant-portal/docs/plans/accounting-screen-inventory.md` (lines 76 & 79) grouped `#52`–`#53` under `SCR-05` and assigned row **`SCR-08`** (`pending (P03.T09.S5)`) to **Recurring Journal Templates & Execution Runs** (`#46` `/accounting/post/recurring-entries`, `#47` `/accounting/post/recurring-entries/[id]`; `recurring-templates` `[P: 17]` + `recurring-runs` `[P: 2]`). Neither `S3` (`SCR-05`/`SCR-06` manual journals) nor any other `P03.T09.*` brief cites `recurring-templates` or `bulk-operations` in its authoritative `Sources`.

To guarantee **zero unowned routes or endpoints (`42` primary catalogue endpoints across `8` App Router routes)**, this Stage-1 specification designs **all four surfaces completely** and logs the inventory row split as `CG-S5-01` for `P03.T11`/`P03.T12`:

| Spec Section | Screen ID | Inventory Rows | Next.js Routes (`tenant-portal` port `5002`) | Primary Endpoint Count |
| --- | --- | --- | --- | --- |
| **§1** | `SCR-07` | `#3`, `#4` | `/accounting/inbox/posting-exceptions`, `/accounting/inbox/posting-exceptions/[id]` | `5` (`posting-exceptions`) |
| **§2** | `SCR-08A` *(Plan/Brief `SCR-08`)* | `#52`, `#53` | `/accounting/post/bulk-operations`, `/accounting/post/bulk-operations/[id]` | `3` (`bulk-operations`) |
| **§3** | `SCR-08B` *(Inventory Row `SCR-08`)* | `#46`, `#47` | `/accounting/post/recurring-entries`, `/accounting/post/recurring-entries/[id]` | `19` (`recurring-templates` `17` + `recurring-runs` `2`) |
| **§4** | `SCR-10` | `#114`, `#115` | `/accounting/setup/posting-rules`, `/accounting/setup/posting-rules/[id]` | `15` (`posting-profiles` `3` + `posting-rule-versions` `10` + `posting-rules/resolve` `1` + `source-document-links` `1`) |

### 0.2 Design Intelligence Decisions (`ui-ux-pro-max` + Tenant Portal Five Laws)

1. **Operational Triage & Determinism First (`ui-ux-pro-max` Enterprise Financial Backoffice profile):**
   - `SCR-07` treats every posting exception as an **explainable, auditable fact** (`D-068`, `D-119`), never a raw stack trace and never a silent fallback to `SUSPENSE`. The screen leads with severity/deadline triage, displays the exact `determinants` snapshot that caused the miss, provides a single kind-specific deep-link to fix the root cause (rule, role, FX rate, period, tax, draft, or source document), and separates **Retry** (`POST /:id/retry`) from destructive **Discard** (`POST /:id/discard`).
   - `SCR-08A` treats `PARTIAL` (`succeededCount > 0 && failedCount > 0`) as a first-class multi-company/multi-period operational state (`D-164`), enabling one-click retry of failed targets only (`retryOfId` + `targets = failedTargetIds`) with a fresh `UUIDv7` `x-idempotency-key`.
   - `SCR-08B` reuses `<JournalLineGrid variant="recurring">` (`accounting-patterns-documents.md`) with explicit `accountRole` XOR `accountId` (`D-067`) and fixed `amount` XOR closed-grammar `amountExpression` (`D-047`) selectors per line, plus an append-only execution timeline (`acc_recurring_runs`, `D-338`).
   - `SCR-10` makes posting-rule precedence **visibly mathematical** (`company set > platform set`, then stored `specificity` weight `128..1`, then `sequenceNo` tie-break) and enforces full-set authoring on `DRAFT` versions, 6-gate validation (`DRAFT -> TESTED`), and strict two-actor maker != publisher (`TESTED -> PUBLISHED | SCHEDULED`).
2. **Strict Tenant Portal Five Laws:**
   - **Import Discipline:** Feature code imports primitives and patterns **only** from `@/design-system` (`PageHeader`, `FilterBar`, `DataTable`, `Pagination`, `Tabs`, `Card`, `Drawer`, `Dialog`, `ConfirmDialog`, `Alert`, `Badge`, `StatusBadge`, `Button`, `Input`, `Textarea`, `Select`, `Combobox`, `Checkbox`, `Switch`, `Field`, `Skeleton`, `EmptyState`, `ErrorState`, `PermissionGate`, `Money`, `IdentifierText`, `Tooltip`) and approved Accounting shared components from `@/features/accounting/shared`.
   - **Four Chromatic Outcome Roles + Neutral `ink`:** Status badges use only `positive`, `caution`, `negative`, and `neutral` (`ink`). `brand` is reserved for focus rings, active tab/nav indicators, and **at most one `variant="primary"` button per screen** (placed in `PageHeader` or the active modal/drawer commit footer).
   - **Typography & Weights:** Three weights only: `font-normal` (`400`), `font-medium` (`500`), `font-semibold` (`600`). Every `DataTable` body `<td>` is `font-normal` (`400`). No `font-bold`, no arbitrary `text-[Npx]`, no `rounded-xl` or larger (`rounded-md` / `rounded-lg` max).
   - **Bilingual RTL/LTR & Western Digits:** Logical utilities exclusively (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `text-end`, `border-s-*`, `border-e-*`; `pnpm design:rtl` = `0`). Zero language ternaries in TSX. Western numerals (`0–9`, `ar-EG-u-nu-latn` in Arabic, `en-US` in English) everywhere. Codes, entry numbers, UUIDs, stream positions, SHA-256 hashes, ISO dates, rates, and formula tokens wrap in `<IdentifierText>` (`<bdi dir="ltr" className="font-mono tabular-nums">`).
   - **Wire Fidelity & UUIDv7:** Never call `Number()` or `parseFloat()` on `DecimalString` or `FxRateString`; zero client-side financial arithmetic. Never call `crypto.randomUUID()` — every `x-idempotency-key` and client row key uses `generateUUIDv7()` from `src/lib/uuid.ts`. Every response passes a runtime schema validator (`unknown` -> typed DTO) via `src/lib/api/axiosClient.ts`.

### 0.3 Shared Theme Token Matrix (Applied Across All Four Visual Combinations in §§1–4)

| Surface / Element | Light (`html:not(.dark)`) | Dark (`html.dark`) | Contrast & Non-Colour Cue |
| --- | --- | --- | --- |
| Page canvas | `bg-background` (`--ink-50`) | `bg-background` (`--ink-950`) | Base canvas |
| Card / Table / Drawer surface | `bg-card text-card-foreground border-border` (`--ink-0` / `--ink-900` / `--ink-200`) | `bg-card text-card-foreground border-border` (`--ink-900` / `--ink-50` / `--ink-800`) | Text `>= 12:1`, border `>= 3:1` |
| Sticky `<thead>` / `<tfoot>` | `bg-muted/95 border-border text-muted-foreground` | `bg-muted/95 border-border text-muted-foreground` | `>= 4.5:1` |
| `positive` (`RESOLVED`, `COMPLETED`, `POSTED`, `PUBLISHED`, `PASSED`) | `bg-positive-subtle text-positive-foreground border-positive-border` | `bg-positive-subtle text-positive-foreground border-positive-border` | Check icon + localized label (`>= 4.5:1`) |
| `caution` (`OPEN`, `RETRYING`, `QUEUED`, `RUNNING`, `PARTIAL`, `PAUSED`, `TESTED`, `SCHEDULED`, `DRAFTED`, `BLOCKED`) | `bg-caution-subtle text-caution-foreground border-caution-border` | `bg-caution-subtle text-caution-foreground border-caution-border` | Clock/warning/pulse icon + localized label (`>= 4.5:1`) |
| `negative` (`CRITICAL`, `HIGH`, `FAILED`, `UNBALANCED`, `DISCARDED` error cues) | `bg-negative-subtle text-negative-foreground border-negative-border` | `bg-negative-subtle text-negative-foreground border-negative-border` | Octagon/alert icon + localized label (`>= 4.5:1`) |
| `neutral` (`DISCARDED`, `COMPLETED` template, `SKIPPED`, `DRAFT`, `RETIRED`, `LOW`, `MEDIUM`) | `bg-muted text-foreground border-border` | `bg-muted text-foreground border-border` | Neutral icon + localized label (`>= 4.5:1`) |

### 0.4 File & Hook Architecture (`< 300` Lines Per File)

Every screen family enforces strict logic/view separation (`hooks/use<Name>.ts` + pure `.tsx` views under `src/features/accounting/`):

```text
src/features/accounting/
├── exceptions/                                    # SCR-07 (#3, #4)
│   ├── validators/postingExceptionValidators.ts   # Runtime validators for Summary/Detail/Determinants DTOs
│   ├── hooks/usePostingExceptionsQueue.ts         # URL filters, GET + POST /search, tab total badges, row nav
│   ├── hooks/usePostingExceptionDetail.ts         # GET /:id + ETag, retry/redate/discard state, approval lookup
│   ├── PostingExceptionsQueueView.tsx             # #3 list view (< 260 lines)
│   ├── PostingExceptionDetailView.tsx             # #4 detail + determinants + remediation card (< 270 lines)
│   ├── RetryPostingExceptionDialog.tsx            # Standard retry + BACKDATED/RECONCILED redate + POSTING_REDATE picker
│   └── DiscardPostingExceptionDialog.tsx          # Mandatory reason modal + POS/movement lock banner
├── bulk-operations/                               # SCR-08A (#52, #53)
│   ├── validators/bulkOperationValidators.ts      # Runtime validators for BulkOperationSummary/Detail/Result
│   ├── hooks/useBulkOperationsList.ts             # GET /bulk-operations, status filter, launcher drawer state
│   ├── hooks/useBulkOperationLauncher.ts          # Scope/operation wizard, target pickers, companion RBAC, 202 submit
│   ├── hooks/useBulkOperationDetail.ts            # GET /:id polling (Retry-After), outcome filter, retry-failed subset
│   ├── BulkOperationsListView.tsx                 # #52 list + active async summary (< 240 lines)
│   ├── LaunchBulkOperationDrawer.tsx              # Scope -> Operation -> Targets -> Parameters/Approvals drawer (< 280 lines)
│   └── BulkOperationDetailView.tsx                # #53 AsyncProgressCard + BulkTargetResultsTable (< 250 lines)
├── recurring/                                     # SCR-08B (#46, #47)
│   ├── validators/recurringValidators.ts          # Runtime validators for RecurringTemplate & RecurringRun DTOs
│   ├── hooks/useRecurringTemplatesList.ts         # GET, POST /search, POST /count, bulk actions, export 202
│   ├── hooks/useRecurringTemplateForm.ts          # Create/PATCH + If-Match, line XOR guards, formula builder
│   ├── hooks/useRecurringTemplateDetail.ts        # GET /:id + ETag, pause/resume/run-now/delete/restore + runs list
│   ├── RecurringTemplatesListView.tsx             # #46 list + bulk selection bar (< 260 lines)
│   ├── RecurringTemplateEditorDrawer.tsx          # Header + Schedule + <JournalLineGrid variant="recurring"> (< 290 lines)
│   ├── RecurringTemplateDetailView.tsx            # #47 overview + lines + execution runs tab (< 270 lines)
│   └── RecurringRunInspectDrawer.tsx              # GET /recurring-runs/:id receipt, entry/draft/exception drill (< 190 lines)
└── posting-rules/                                 # SCR-10 (#114, #115)
    ├── validators/postingRuleValidators.ts        # Runtime validators for Profile, RuleVersion, RuleRow, GateReport, Resolution
    ├── hooks/usePostingProfilesTab.ts             # GET /posting-profiles, GET/PATCH /:sourceApp + If-Match
    ├── hooks/usePostingRuleVersionsTab.ts         # GET/POST /posting-rule-versions, fork, adopt via bulk-operations
    ├── hooks/usePostingRuleVersionDetail.ts       # GET /:id + ETag, GET/POST /:id/rules, validate, publish, retire
    ├── hooks/usePostingRuleResolver.ts            # POST /posting-rules/resolve dry-run simulator
    ├── hooks/useSourceDocumentLinksTab.ts         # GET /source-document-links cross-app trace
    ├── PostingRulesWorkspaceView.tsx              # #114 4-tab workspace shell (< 220 lines)
    ├── PostingProfileEditorDrawer.tsx             # UpsertPostingProfileDto editor + company read-only mirror (< 240 lines)
    ├── PostingRuleVersionDetailView.tsx           # #115 version header, 6-gate panel, specificity rule table (< 280 lines)
    ├── PostingRuleRowDrawer.tsx                   # Single row determinant + role + formula editor inside DRAFT set (< 275 lines)
    └── PostingRuleResolverPanel.tsx               # Interactive ResolvePostingRuleDto dry-run & winner trace (< 250 lines)
```

---

## 1. `SCR-07` — Posting Exceptions Queue & Retry/Discard Detail

- **Routes:**
  - `#3` `/accounting/inbox/posting-exceptions` — Queue list (`PostingExceptionsQueueView`)
  - `#4` `/accounting/inbox/posting-exceptions/[id]` — Exception workspace (`PostingExceptionDetailView`)
- **Navigation Placement:** Accounting sidebar -> **Inbox (`صندوق المهام`)** -> **Posting Exceptions (`استثناءات الترحيل`)**, carrying an unsettled badge count when `OPEN` + `RETRYING` > 0 (`accounting-ia.md` §2.1). Also reached directly from `SCR-02` Accounting Home KPI/Exception tiles, `SCR-05`/`SCR-06` `BLOCKED` journal drafts, `SCR-08B` `BLOCKED` recurring runs, `SCR-10` `Source Document Links`, and `SCR-24` Close Checklist task `NO_UNPOSTED_DOCUMENTS`.
- **Feature & Permission Gate:**
  - Feature key: `accounting.ledger.core`
  - Read admission: `accounting.posting_exception.read` (`COMPANY_OR_BRANCH` — honours active Company switcher `x-mutakamel-company-id` and optional Branch switcher `x-mutakamel-branch-id`)
  - Action admission:
    - Retry button: `accounting.posting_exception.retry` (`COMPANY` scope; hidden/disabled when actor lacks permission or row is terminal `RESOLVED` / `DISCARDED`)
    - Discard button: `accounting.posting_exception.discard` (`COMPANY` scope; additionally locked out with explanatory tooltip when the exception belongs to an ordered inventory movement stream, POS receipt chain, or POS shift close/cutoff per `D-357` / `02_Ledger_Tables.md` §6)

### 1.1 Layout & Progressive-Disclosure Hierarchy

1. **Queue List (`#3` `/accounting/inbox/posting-exceptions`):**
   - **`PageHeader`:** Title `t.accounting.postingExceptions.title` (`استثناءات الترحيل` / `Posting Exceptions`), subtitle explaining that blocked facts never post to suspense (`D-068`) and block `NO_UNPOSTED_DOCUMENTS` on period close (`D-150`). Zero `primary` creation CTA (exceptions are system-created on posting rollback); top-end holds secondary `[Refresh]` (`تحديث`) button and a link to `/accounting/inbox/exception-board` (`لوحة الاستثناءات الشاملة`).
   - **Status Segment `Tabs`:**
     1. `OPEN` (`مفتوحة` / `Open` — default active tab, sorted by `deadlineAt ASC NULLS LAST, firstSeenAt ASC`)
     2. `RETRYING` (`قيد إعادة المحاولة` / `Retrying`)
     3. `RESOLVED` (`تمت معالجتها` / `Resolved`)
     4. `DISCARDED` (`مستبعدة` / `Discarded`)
     5. `ALL` (`الكل` / `All`)
     - *Count Note:* Because `posting-exceptions` has no `POST /count` endpoint (`CG-S5-02`), the active tab displays its exact `meta.total` from `GET /api/tenant/accounting/v1/posting-exceptions`, and inactive tabs do not fire eager background counts unless visited.
   - **`FilterBar`:**
     - `kind` (`Select` over the 11 MVP `PostingExceptionKind` values; `LOAN_DEDUCTION_UNMATCHED` wave-2 reserved is omitted from the filter dropdown unless encountered on wire)
     - `sourceApp` (`Select` over `SourceApp`: `accounting`, `trade`, `crm`, `pos`, `hr`, `import`, `authority`, `external`)
     - `fiscalDocumentId` / `search` (`Input`, max `120` chars — searches `errorCode`, `sourceId`, `sourceType` via `GET ?search=` or structured `POST /api/tenant/accounting/v1/posting-exceptions/search` when multi-field predicates are active)
   - **`DataTable` (`< 100` rows per page, `limit` `25` / `50` / `100`):**
     - Columns (`font-normal` `400` in `<td>`):
       1. `kind` (`StatusBadge` neutral/caution + localized `t.accounting.enums.postingExceptionKind[kind]`)
       2. `errorCode` (`<IdentifierText>{row.errorCode}</IdentifierText>`)
       3. `source` (`row.source.sourceApp` localized chip + `<IdentifierText>{row.source.sourceType}:{row.source.sourceId}</IdentifierText>`; if `sourceType === 'STREAM_POSITION'`, prefixes a stream badge `[Stream Pos]` / `[موضع التدفق]`)
       4. `determinants` summary (`eventKind` · `accountRole ?? mappingKey ?? currencyCode` · `<IdentifierText>{determinants.postingDate}</IdentifierText>`)
       5. `retryCount` (`tabular-nums`, e.g. `2`)
       6. `deadlineAt` (localized timestamp + relative countdown chip `<SlaDeadlineChip deadlineAt={row.deadlineAt} />` when `status` is `OPEN` or `RETRYING`)
       7. `status` (`StatusBadge` per `accounting-status-and-a11y.md` Group B)
       8. Row action: `Inspect ->` (`فحص <-`) `Link` to `/accounting/inbox/posting-exceptions/${row.id}`.
     - *Summary vs Detail Projection Note (`CG-S5-03`):* `PostingExceptionSummaryDto` (`02_DTOs.md` §5.3) carries `severity`, `ownerRole` and `firstSeenAt` (`D-770`) and `PostingExceptionListQueryDto` filters by `severity?`; it still omits `lastRetryAt`, `errorDetail`, `draftId`, `inboxEventId`, `resolution`, `resolutionNote`, and `resultingEntryId`. The queue table therefore renders only `PostingExceptionSummaryDto` fields and discloses the full record on `#4` Detail (`GET /:id`, which projects `acc_posting_exceptions` + `ETag`).

2. **Exception Detail (`#4` `/accounting/inbox/posting-exceptions/[id]`):**
   - **Breadcrumb & `PageHeader`:**
     - Breadcrumb: `Inbox` -> `Posting Exceptions` -> `<IdentifierText>{shortId}</IdentifierText>`
     - Header badges: `StatusBadge(status)`, `SeverityBadge(detail.severity)` (`LOW` / `MEDIUM` / `HIGH` / `CRITICAL`), `Kind` chip, and `<ETagVersionChip version={detail.version} />`.
     - **Single `variant="primary"` CTA (when `status` is `OPEN` and user has `accounting.posting_exception.retry`):**
       - Standard kinds: `Retry Posting` (`إعادة محاولة الترحيل`) -> opens `RetryPostingExceptionDialog`.
       - `BACKDATED_CARRYING_CONFLICT` / `RECONCILED_RANGE_CONFLICT`: `Re-date & Retry Posting` (`تعديل التاريخ وإعادة الترحيل`) -> opens `RetryPostingExceptionDialog` in re-date mode.
     - **Secondary Header Action (when `status` is `OPEN` and user has `accounting.posting_exception.discard`):**
       - `Discard Fact…` (`استبعاد الواقعة…`) `Button(variant="outline")` (or disabled with inline lock explanation when `isOrderedStreamLocked` is true).
   - **Two-Column Progressive-Disclosure Grid (`lg:grid-cols-12 gap-6`):**
     - **Main Column (`lg:col-span-8`):**
       1. **Diagnostic & Root-Cause Remediation Card (`Card`):**
          - Displays `errorCode` (`<IdentifierText>`), `errorDetail` (single server-sanitized sentence, `02_Ledger_Tables.md` line 548), `ownerRole`, `firstSeenAt`, `lastRetryAt`, `retryCount`, and `deadlineAt`.
          - **Kind-Specific Actionable Remediation Banner** (see §1.3 table) with a direct deep-link button (e.g., `"Open Posting Rules Studio"` pre-seeded with `determinants` for `NO_ACCOUNT_RULE`; `"Add Spot FX Rate"` for `FX_RATE_MISSING`; `"Open Period Calendar"` for `PERIOD_CLOSED`; `"Edit Blocked Journal Draft"` for `draftId !== null`).
       2. **Captured Determinants Snapshot (`Card`):**
          - Renders `detail.determinants` (`PostingExceptionDeterminantsDto`) as a structured two-column key-value grid (never a raw JSON dump by default; an optional `"Copy diagnostic JSON"` button copies `{ id, kind, errorCode, determinants, correlationId }` for support).
          - When `determinants.entries` is present (`BACKDATED_CARRYING_CONFLICT` or `RECONCILED_RANGE_CONFLICT`), renders a dedicated **Per-Entry Conflict Table**: Entry `#`, `accountId` (with `<LedgerDrillDrawer>` link to `conflictingEntryId` when present), `lastReconciledOn` / `conflictingEntryId`, and minimum permissible retry date `<IdentifierText>{entry.conflictingPostingDate}</IdentifierText>`.
     - **Side Column (`lg:col-span-4`):**
       1. **Source & Linked Artifacts Card (`Card`):**
          - `sourceRef` (`determinants.sourceRef` when `sourceType === 'STREAM_POSITION'`, else `{ sourceApp, sourceType, sourceId }` per `D-663`)
          - Stream Position (`<IdentifierText>{detail.sourceId}</IdentifierText>`) when `detail.sourceType === 'STREAM_POSITION'`
          - `fiscalDocumentId` -> link to `/accounting/documents/${fiscalDocumentId}` (`SCR-11`)
          - `draftId` -> link to `/accounting/journals/drafts/${draftId}` (`SCR-05`)
          - `inboxEventId` -> link to `/accounting/setup/integrations/inbox?eventId=${inboxEventId}` (`SCR-23`, noting that inbox replay is blocked with `ACCOUNTING.INBOX.REPLAY_NOT_ALLOWED` while owned by a posting exception)
       2. **Resolution Receipt Card (`Card` — shown when `status` is `RESOLVED` or `DISCARDED`):**
          - `resolution` (`PostingExceptionResolution` localized label), `resolvedAt`, `resolvedBy`, `resolutionNote` (mandatory on `DISCARDED_BY_OPERATOR`), and `resultingEntryId` -> `<IdentifierText>` button opening `<LedgerDrillDrawer>` (`GET /api/tenant/accounting/v1/journal-entries/:resultingEntryId`) when non-null.

### 1.2 Reused Stage-0 Patterns & Design-System Primitives

- From `@/design-system`: `PageHeader`, `Tabs`, `FilterBar`, `DataTable`, `Pagination`, `Card`, `Dialog`, `ConfirmDialog`, `Alert`, `Badge`, `StatusBadge`, `Button`, `Input`, `Textarea`, `Select`, `Field`, `Skeleton`, `EmptyState`, `ErrorState`, `PermissionGate`, `IdentifierText`, `Tooltip`.
- From approved Stage-0 specs:
  - `StatusBadge` mappings for `PostingExceptionStatus` & `ExceptionSeverity` (`accounting-status-and-a11y.md` §2.2 Group B & Group K)
  - `<StaleVersionBanner>` (`409 ACCOUNTING.CONCURRENCY.STALE_VERSION` reload-and-compare pattern, `accounting-patterns-workflow.md` `UX-14`)
  - `<AmbiguousOutcomePanel>` (`CLIENT_REQUEST_TIMEOUT` recovery with `GET /:id` verification before safe retry reusing exact `x-idempotency-key`, `accounting-patterns-workflow.md` `UX-13`)
  - `<MakerCheckerSelfActionBanner>` + `<ApprovalStatusStrip>` (`accounting-patterns-workflow.md` `UX-06`) for cross-period `POSTING_REDATE` approval handoff
  - `<LedgerDrillDrawer>` (`accounting-patterns-data.md` `UX-05`) for `conflictingEntryId` and `resultingEntryId`.

### 1.3 Kind-by-Kind Remediation, Redate & Discard Matrix

| `PostingExceptionKind` | Expected `resolution` on Retry | Root-Cause Remediation Link Rendered in `#4` | Re-Date Inputs Allowed? | Discard (`POST /:id/discard`) Allowed? |
| --- | --- | --- | --- | --- |
| `NO_ACCOUNT_RULE` | `RULE_ADDED` | **1)** `/accounting/setup/posting-rules?tab=resolver` pre-filled with `determinants` (`eventKind`, `sourceApp`, `documentKind`, `itemClass`, `mappingKey`, `itemGroup`, `partyGroup`, `branchId`, `taxStatus`, `direction`, `postingDate`); **2)** `/accounting/setup/account-roles` when `determinants.accountRole` is unassigned | **No** (`400` if date sent) | Only if **not** POS/inventory movement/shift cutoff (`D-357`) |
| `PERIOD_CLOSED` | `PERIOD_REOPENED` or `POSTED_IN_NEXT_PERIOD` | `/accounting/setup/calendar` (inspect `GL`/`AR`/`AP`/`TAX` module state for `determinants.postingDate` or create next fiscal year if `ACCOUNTING.ENTRY.PARTITION_MISSING`) | **No** (late-fact redirect is automatic when an open period exists) | Same rule (`D-357`) |
| `TAX_UNRESOLVED` | `RULE_ADDED` | `/accounting/tax/rules` or Fiscal Document `POST /fiscal-documents/:id/resolve-tax` (`/accounting/documents/${fiscalDocumentId}`) | **No** | Same rule |
| `AWAITING_AUTHORITY` | `AUTHORITY_SETTLED` | `/accounting/documents/${fiscalDocumentId}` (authority status panel; normally settles via callback/poll `settleValid`) | **No** | Same rule |
| `FX_RATE_MISSING` | `RATE_ADDED` | `/accounting/setup/fx-rates?quote=${determinants.currencyCode}&asOf=${determinants.postingDate}` | **No** | Same rule |
| `DIMENSION_REQUIRED` | `DIMENSION_ADDED` or `DOCUMENT_CORRECTED` | If `draftId`: `/accounting/journals/drafts/${draftId}` (`Reopen for correction`); else `/accounting/setup/dimensions` / Posting Rule `dimensionRule` | **No** | Same rule |
| `CONTROL_ACCOUNT_MANUAL` | `DOCUMENT_CORRECTED` | `/accounting/journals/drafts/${draftId}` (remove manual AR/AP/Tax control account line, `D-026`) | **No** | Yes (if draft/bill, not POS/movement) |
| `VALIDATION_RULE` | `DOCUMENT_CORRECTED` | Context-aware on `errorCode`: for `ACCOUNTING.AUTHORITY.ACTIVE_REFERENCES` (held authority cancellation/rejection, `D-674`) or `ACCOUNTING.DOCUMENT.NOTE_EXCEEDS_ORIGINAL` (link over-credit, `D-674`), links to `/accounting/documents/${fiscalDocumentId}` showing referencing notes / ceiling excess | **No** | Yes (records deliberate operator acceptance per `02_Ledger_Tables.md` lines 588–589) |
| `UNBALANCED` | `DOCUMENT_CORRECTED` | If `draftId`: `/accounting/journals/drafts/${draftId}`; if recurring formula imbalance (`D-047`): `/accounting/post/recurring-entries` | **No** | Same rule |
| `BACKDATED_CARRYING_CONFLICT` | `POSTED_ON_LATER_DATE` | Opens `LedgerDrillDrawer` on `determinants.entries[i].conflictingEntryId` + enables **Re-date & Retry** (`postingDate >= conflictingPostingDate` for 1-entry fact, or `entryDates[]` for multi-entry POS shift close) | **Yes** (`postingDate` XOR `entryDates[]` + `approvalRequestId?`) | Refused on POS/inventory movement (`ACCOUNTING.INBOX.DISCARD_NOT_ALLOWED`) |
| `RECONCILED_RANGE_CONFLICT` | `POSTED_ON_LATER_DATE` | Links to `/accounting/banking/reconciliations` (`lastReconciledOn` shown) + enables **Re-date & Retry** (`postingDate >= conflictingPostingDate`) | **Yes** (`postingDate` XOR `entryDates[]` + `approvalRequestId?`) | Refused on POS/inventory movement |
| `LOAN_DEDUCTION_UNMATCHED` *(reserved wave 2)* | `DOCUMENT_CORRECTED` | Read-only compatibility rendering if ever encountered; hidden from MVP filter pickers | **No** | Same rule |

#### Cross-Period Re-Date Two-Step Approval Flow (`D-273`, `D-286`, `02_ledger_posting.md` §8.1 Example 3i)
When retrying `BACKDATED_CARRYING_CONFLICT` or `RECONCILED_RANGE_CONFLICT`:
1. If `determinants.entries.length <= 1`, `RetryPostingExceptionDialog` renders `postingDate` (`ISODate`, constrained `>= conflictingPostingDate`, never `entryDates`). If `determinants.entries.length > 1` (e.g. a POS shift close spanning two periods), it renders one date input per entry (`entryDates[0..n-1]`, never `postingDate`; `02_DTOs.md` §5.2 mutual-exclusion rule).
2. If the chosen date stays inside the entry's original fiscal period, `POST /:id/retry` posts immediately (`200` + `PostingReceiptDto` + chain headers).
3. If the chosen date moves an entry into a **later fiscal period** and no `approvalRequestId` is supplied yet, the backend commits a `PENDING` `POSTING_REDATE` approval request (`acc_approval_requests`) submitted by the current user and returns `ACCOUNTING.APPROVAL.REQUIRED` (`02_ledger_posting.md` line 403).
4. `RetryPostingExceptionDialog` catches `ACCOUNTING.APPROVAL.REQUIRED`, transitions cleanly into a `"Pending Chief Accountant Approval (POSTING_REDATE)"` state, queries `GET /api/tenant/accounting/v1/approval-requests?documentType=POSTING_REDATE&targetId=${exception.id}` (if `accounting.approval.read` is held), and displays:
   - While `PENDING`: `<ApprovalStatusStrip>` with link to `/accounting/inbox/approvals/${requestId}` (`SCR-09`).
   - Once `APPROVED` by a second actor (`maker != approver`): pre-selects `approvalRequestId = approvedRequest.id` in `RetryPostingExceptionDto` and enables **"Complete Approved Retry"** (`إتمام إعادة الترحيل المعتمدة`).

#### Ordered-Stream Discard Lock (`D-071`, `D-317`, `D-357`)
`usePostingExceptionDetail` computes `isDiscardForbiddenByStream = detail.sourceType === 'STREAM_POSITION' || detail.sourceApp === 'pos'`. When true, the `Discard` button is disabled (`aria-disabled="true"`) with an inline explanatory note: *"Inventory movement and POS stream positions cannot be discarded from Posting Exceptions because discarding would break stream sequence / cost-layer continuity (`ACCOUNTING.INBOX.DISCARD_NOT_ALLOWED`). Fix the root cause and retry."* (If an edge case such as a POS shift cutoff without `STREAM_POSITION` hits the server and returns `422/409 ACCOUNTING.INBOX.DISCARD_NOT_ALLOWED`, `DiscardPostingExceptionDialog` surfaces the localized 3-part error banner cleanly.)

### 1.4 1:1 Field-to-DTO & Enum Mapping

#### A. Query & Command DTOs (`02_DTOs.md` §5.1, §5.2)

| UI Control | Screen | DTO & Exact Wire Property | Wire Type / Validation | Enum / Constraint |
| --- | --- | --- | --- | --- |
| Status Tabs | `#3` | `PostingExceptionListQueryDto.status` | `PostingExceptionStatus?` | `OPEN \| RETRYING \| RESOLVED \| DISCARDED` |
| Kind Filter | `#3` | `PostingExceptionListQueryDto.kind` | `PostingExceptionKind?` | 11 MVP values (`NO_ACCOUNT_RULE` .. `RECONCILED_RANGE_CONFLICT`) |
| Source App Filter | `#3` | `PostingExceptionListQueryDto.sourceApp` | `SourceApp?` | `accounting \| trade \| crm \| pos \| hr \| import \| authority \| external` |
| Fiscal Doc Filter | `#3` | `PostingExceptionListQueryDto.fiscalDocumentId` | `UUIDv7?` | Exact UUIDv7 |
| Search Box | `#3` | `PostingExceptionListQueryDto.search` | `string?` (`<= 120` chars) | Trimmed |
| Page / Limit / Sort | `#3` | `FindManyDto.page`, `limit`, `sortBy`, `sortOrder` | `int 1..200`, `int 1..100` | `ASC \| DESC` |
| Single-Entry New Posting Date | `#4` Retry Dialog | `RetryPostingExceptionDto.postingDate` | `ISODate?` (`YYYY-MM-DD`) | Allowed **only** on `BACKDATED_CARRYING_CONFLICT` / `RECONCILED_RANGE_CONFLICT` when single-entry; `>= conflictingPostingDate`; mutually exclusive with `entryDates` |
| Multi-Entry New Posting Dates | `#4` Retry Dialog | `RetryPostingExceptionDto.entryDates` | `ISODate[]?` (`ArrayMinSize(1)`, `ArrayMaxSize(16)`) | Allowed **only** on `BACKDATED_CARRYING_CONFLICT` / `RECONCILED_RANGE_CONFLICT` when multi-entry; `entryDates[i] >= entries[i].conflictingPostingDate` |
| Approved Redate Request | `#4` Retry Dialog | `RetryPostingExceptionDto.approvalRequestId` | `UUIDv7?` | Required when re-dating moves an entry into another fiscal period (`POSTING_REDATE`, `APPROVED`) |
| Discard Reason | `#4` Discard Dialog | `DiscardPostingExceptionDto.reason` | `string` (`MinLength(10)`, `MaxLength(1000)`) | Stored trimmed into `resolution_note`; live character counter `10..1,000` |

#### B. Response DTOs (`PostingExceptionSummaryDto` §5.3 & `PostingExceptionDetailDto` §13.1 over `acc_posting_exceptions`)

| Wire Field | Present on `#3` Summary? | Present on `#4` Detail? | Type | UI Presentation |
| --- | --- | --- | --- | --- |
| `id` | Yes | Yes | `UUIDv7` | `<IdentifierText>` + route param |
| `companyId`, `branchId` | Detail | Yes | `UUIDv7`, `UUIDv7 \| null` | Verified against active context; Branch badge |
| `kind` | Yes | Yes | `PostingExceptionKind` | Localized label (`t.accounting.enums.postingExceptionKind.*`) |
| `status` | Yes | Yes | `PostingExceptionStatus` | `StatusBadge` (`OPEN`/`RETRYING`=`caution`, `RESOLVED`=`positive`, `DISCARDED`=`neutral`) |
| `severity` | Yes (`D-770`) | Yes | `ExceptionSeverity` | `StatusBadge` (`CRITICAL`/`HIGH`=`negative`, `MEDIUM`=`caution`, `LOW`=`neutral`) |
| `source` / `sourceApp`, `sourceType`, `sourceId` | `source: PostingExceptionSourceDto` | Flat columns + `determinants.sourceRef` | `SourceApp`, `string \| null`, `string \| null` | App chip + `<IdentifierText>`; prefers `determinants.sourceRef` when `sourceType === 'STREAM_POSITION'` (`D-663`) |
| `fiscalDocumentId` | Yes | Yes | `UUIDv7 \| null` | Link to `/accounting/documents/${id}` |
| `draftId` | No | Yes | `UUIDv7 \| null` | Link to `/accounting/journals/drafts/${id}` |
| `inboxEventId` | No | Yes | `UUIDv7 \| null` | Link to `/accounting/setup/integrations/inbox?eventId=${id}` |
| `errorCode` | Yes | Yes | `string` | `<IdentifierText>` + 3-part localized explanation |
| `errorDetail` | No | Yes | `string \| null` | Sanitized single-sentence server diagnostic |
| `ownerRole` | Yes (`D-770`) | Yes | `string \| null` | Role badge (`<IdentifierText>`) |
| `firstSeenAt` | Yes (`D-770`) | Yes | `ISO8601` | Relative age plus absolute timestamp; a repeated failure increments `retryCount` on the same row |
| `determinants` | Yes | Yes | `PostingExceptionDeterminantsDto` | `eventKind`, `documentKind`, `itemClass`, `mappingKey`, `itemGroup`, `partyGroup`, `branchId`, `taxStatus`, `direction`, `accountRole`, `postingDate`, `currencyCode`, `sourceRef`, `entries[]` (`accountId`, `conflictingEntryId`, `lastReconciledOn`, `conflictingPostingDate`) |
| `deadlineAt` | Yes | Yes | `ISO8601 \| null` | Localized date-time + SLA countdown chip |
| `retryCount`, `lastRetryAt`, `firstSeenAt` | `retryCount` only | All three | `number`, `ISO8601 \| null`, `ISO8601` | `tabular-nums` attempt counter + timestamps |
| `resolution`, `resolutionNote`, `resultingEntryId`, `resolvedBy`, `resolvedAt` | No | Yes | `PostingExceptionResolution \| null`, `string \| null`, `UUIDv7 \| null`, `UUIDv7 \| null`, `ISO8601 \| null` | Terminal Resolution Receipt card + `<LedgerDrillDrawer>` link on `resultingEntryId` |
| `version` + HTTP `ETag` | No | Yes (`"version"`) | `integer` + strong `ETag` | Sent as `If-Match: "<version>"` on `retry` and `discard` |

### 1.5 Verbatim Endpoint Mapping (`02_Endpoint_Catalogue.md` §4 & §10)

All browser calls replace `/accounting/...` with `/api/tenant/accounting/v1/...`:

| UI Action | Method | Catalogue Path | Canonical Browser Gateway Path | Permission | Feature Key | Scope Target | Idempotency | Concurrency | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Load `#3` queue | `GET` | `/accounting/posting-exceptions` | `/api/tenant/accounting/v1/posting-exceptions` | `accounting.posting_exception.read` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | none | none | `200` (`PostingExceptionSummaryDto[]` + `meta`) |
| Advanced filter search on `#3` | `POST` | `/accounting/posting-exceptions/search` | `/api/tenant/accounting/v1/posting-exceptions/search` | `accounting.posting_exception.read` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | none | none | `200` (`PostingExceptionSummaryDto[]` + `meta`) |
| Load `#4` detail | `GET` | `/accounting/posting-exceptions/:id` | `/api/tenant/accounting/v1/posting-exceptions/:id` | `accounting.posting_exception.read` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | none | none | `200` + `ETag` (`PostingExceptionDetailDto`) |
| Retry / Re-date & Retry | `POST` | `/accounting/posting-exceptions/:id/retry` | `/api/tenant/accounting/v1/posting-exceptions/:id/retry` | `accounting.posting_exception.retry` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` + chain headers (`X-Accounting-Entry-No`, `X-Accounting-Chain-Seq`, `X-Accounting-Entry-Hash`) |
| Discard blocked fact | `POST` | `/accounting/posting-exceptions/:id/discard` | `/api/tenant/accounting/v1/posting-exceptions/:id/discard` | `accounting.posting_exception.discard` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` (`PostingExceptionDetailDto` in `DISCARDED`) |
| Lookup `POSTING_REDATE` approval *(contextual read)* | `GET` | `/accounting/approval-requests` | `/api/tenant/accounting/v1/approval-requests` | `accounting.approval.read` | `accounting.close.approvals` | `COMPANY_OR_BRANCH` | none | none | `200` (gracefully skipped if user lacks `accounting.approval.read` or feature `accounting.close.approvals`) |
| Inspect conflicting / resulting entry *(contextual read)* | `GET` | `/accounting/journal-entries/:id` | `/api/tenant/accounting/v1/journal-entries/:id` | `accounting.journal_entry.read` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | none | none | `200` (`JournalEntryDetailDto` in `<LedgerDrillDrawer>`) |

### 1.6 Complete UI & Boundary States (`SCR-07`)

1. **Loading:** `#3` renders 6-row `DataTable` skeleton preserving header/filter height (`min-h-[420px]`, zero CLS). `#4` renders 2-column card skeletons (`lg:col-span-8` + `lg:col-span-4`).
2. **Empty State (`#3`):**
   - On `OPEN` tab with zero filters: positive operational state (`CheckCircle2` icon, title `لا توجد استثناءات ترحيل مفتوحة` / `Zero open posting exceptions`, body explaining all consumed facts and drafts are clear for `NO_UNPOSTED_DOCUMENTS`).
   - With active filters: `"No matching posting exceptions"` + `[Clear filters]` (`مسح عوامل التصفية`) ghost button.
3. **Permission Denied (`403`):** Missing `accounting.posting_exception.read` renders `<PermissionGate permission="accounting.posting_exception.read" />` (never an empty table). Action buttons (`Retry`, `Discard`) hide or disable per RBAC, and any server `403` renders a non-destructive 3-part `Alert(tone="negative")` with `correlationId`.
4. **Entitlement / Activation / Recovery Mode Boundaries:**
   - `403 ACCOUNTING.FEATURE.NOT_ENTITLED` -> `<FeatureNotEntitledState featureKey="accounting.ledger.core" />`.
   - `409/422` company not activated -> `<CompanyNotActivatedState />` linking to `/accounting/setup/activation` (`SCR-01`).
   - `403 ACCOUNTING.FEATURE.RECOVERY_MODE` -> `<RecoveryModeBanner />` disabling `Retry` and `Discard` while keeping `#3` and `#4` fully readable (`D-242`).
5. **Retry Refused Again (Root Cause Still Unresolved):** When `POST /:id/retry` fails with the same or a new domain error (`422 ACCOUNTING.POSTING.NO_ACCOUNT_RULE`, `422 ACCOUNTING.FX.RATE_MISSING`, `409 ACCOUNTING.PERIOD.CLOSED`, `409 ACCOUNTING.FX.BACKDATED_CARRYING_CONFLICT`, `409 ACCOUNTING.BANK.RECONCILED_RANGE_POSTING`), the hook re-fetches `GET /:id` immediately so the updated `ETag`/`version`, incremented `retryCount`, and refreshed `determinants` replace stale client state, and displays the 3-part error banner with aFresh `UUIDv7` generated for the next retry intent.
6. **`409 ACCOUNTING.CONCURRENCY.STALE_VERSION`:** Renders `<StaleVersionBanner>` showing that another operator retried or resolved the row concurrently, with `[Reload latest version]` fetching `GET /:id` + fresh `ETag`.
7. **`CLIENT_REQUEST_TIMEOUT` (`AmbiguousOutcomePanel`):** Retains the exact `x-idempotency-key` in hook state, disables form editing, and offers `[Check exception status]` (`GET /:id` — if `status === 'RESOLVED'`, shows `resultingEntryId` receipt!) or `[Retry safely with same key]`.
8. **Async Progress (`202`):** Neither `retry` nor `discard` returns `202` (both execute synchronously and return `200`). While `status === 'RETRYING'` is observed on `GET /:id` from another in-flight request, `#4` shows an inline `StatusBadge(tone="caution")` pulse and disables duplicate mutation clicks (`409 ACCOUNTING.IDEMPOTENCY.IN_FLIGHT` safe handling).

### 1.7 Visual Prose & ASCII Mockups — `SCR-07` (All 4 Combinations + `375px` Mobile)

#### 1. `AR-RTL` × `Light` (`dir="rtl"`, `html:not(.dark)`) — `#3` Queue List
- **Visual Prose:** Surface `--ink-50` canvas, `--ink-0` table card (`border-border` `--ink-200`). Right-to-left column flow: `النوع` (Kind) at physical right, followed leftward by `رمز الخطأ` (Error Code in `<bdi dir="ltr">`), `المصدر` (Source), `المحددات المقروءة` (Determinants), `المحاولات` (Retries), `الموعد النهائي` (Deadline), `الحالة` (Status), and `الإجراء` (Action). No primary button in header (system-generated queue).

```text
+----------------------------------------------------------------------------------------------------------+
| [لوحة الاستثناءات <-] [تحديث]                     استثناءات الترحيل · فرع القاهرة (CAI-01) · شركة النيل |
|                                    لا يتم الترحيل أبداً إلى حساب معلق؛ عالج السبب الجذري ثم أعد المحاولة |
+----------------------------------------------------------------------------------------------------------+
|  الكل  |  مستبعدة  |  تمت معالجتها  |  قيد المحاولة  |  [ مفتوحة (3) ]                                  |
+----------------------------------------------------------------------------------------------------------+
| [تصفية متقدمة]  [بحث برمز الخطأ أو المرجع...]  | المصدر: [الكل v] | النوع: [كل الأنواع v]               |
+----------------------------------------------------------------------------------------------------------+
| إجراء   | الحالة   | الموعد النهائي   | محاولات| المحددات المقروءة             | المصدر              | رمز الخطأ                         | النوع                |
+=========+==========+==================+========+===============================+=====================+===================================+======================+
| [فحص<-] | [مفتوحة] | خلال 4 س (18:00) |      1 | SALE_INVOICE · STOCK_ITEM     | trade · BILL_9041   | ACCOUNTING.POSTING.NO_ACCOUNT_RULE| عدم وجود قاعدة حساب  |
| [فحص<-] | [مفتوحة] | 2026-11-05 23:59 |      2 | USD · 2026-10-31              | trade · STREAM_POS  | ACCOUNTING.FX.RATE_MISSING        | نقص سعر الصرف        |
| [فحص<-] | [مفتوحة] | 2026-11-10 23:59 |      0 | USD · تعارض: 2026-10-10       | pos · STREAM_POS    | ACCOUNTING.FX.BACKDATED_CARRYING..| تعارض رصيد عملة مرجعي|
+=========+==========+==================+========+===============================+=====================+===================================+======================+
| [< التالي] [1] [السابق >] · عرض 25 لكل صفحة                                      إجمالي السجلات المفتوحة: 3 |
+----------------------------------------------------------------------------------------------------------+
```

#### 2. `AR-RTL` × `Dark` (`dir="rtl"`, `html.dark`) — `#4` Detail (`BACKDATED_CARRYING_CONFLICT` + Re-date & Stream Discard Lock)
- **Visual Prose:** Surface `--ink-950` canvas, `--ink-900` cards (`border-border` `--ink-800`). Single `variant="primary"` button `[تعديل التاريخ وإعادة الترحيل]` at top-left (inline-end in RTL); `[استبعاد الواقعة]` is disabled (`aria-disabled="true"`) with explicit ordered-stream lock cue (`D-357`).

```text
+----------------------------------------------------------------------------------------------------------+
| [استبعاد الواقعة (مقفل)] [تعديل التاريخ وإعادة الترحيل *]     صندوق المهام / استثناءات الترحيل / 0192f0a8 |
|                                          [الإصدار v3] [خطورة عالية !] [مفتوحة] · تعارض رصيد عملة مرجعي  |
+-----------------------------------+----------------------------------------------------------------------+
| بطاقة المصدر والروابط             | التشخيص والحل الجذري                                                 |
| --------------------------------- | -------------------------------------------------------------------- |
| تطبيق المصدر: pos (نقطة بيع)      | الرمز: ACCOUNTING.FX.BACKDATED_CARRYING_CONFLICT                     |
| موضع التدفق:                      | التفصيل: حركة صادرة بتاريخ 2026-09-05 تغير تقييم حركة لاحقة مرحلة.  |
| <0192..:POS-04:1882>              | الدور المسؤول: chief_accountant · المحاولات: 1 · أول ظهور: 10:12     |
| مرجع الواقعة الأصلي (sourceRef):  | +------------------------------------------------------------------+ |
| pos · SHIFT_CLOSE · 0192e1.. (v1) | | الإجراء المقترح: أعد تأريخ القيد إلى 2026-09-10 أو بعده. إذا انتقل| |
| حدث الوارد: 0192f0a1 [فتح الوارد] | | القيد إلى فترة مالية أخرى سيلزم اعتماد طلب (POSTING_REDATE).     | |
| --------------------------------- | +------------------------------------------------------------------+ |
| قفل الاستبعاد (D-357):            | المحددات المقروءة وتعارض القيود (determinants.entries)               |
| لا يمكن استبعاد وقائع نقاط البيع  | عملة المعاملة: USD · التاريخ الأصلي للواقعة: 2026-09-05              |
| أو حركات المخزون حفاظاً على تسلسل | +----------------------+--------------------+---------------+------+ |
| السلسلة وطبقات التكلفة.           | | أدنى تاريخ مسموح     | القيد المتعارض     | الحساب        | قيد# | |
|                                   | +----------------------+--------------------+---------------+------+ |
|                                   | | 2026-09-10           | [JV-2026-000812<-] | 110205 USD Bnk|    1 | |
|                                   | +----------------------+--------------------+---------------+------+ |
+-----------------------------------+----------------------------------------------------------------------+
```

#### 3. `EN-LTR` × `Light` (`dir="ltr"`, `html:not(.dark)`) — `#4` Detail (`NO_ACCOUNT_RULE` Determinants & Remediation)
- **Visual Prose:** Left-to-right layout on `--ink-50` canvas. Main column (`col-span-8` on left) shows diagnostic card + full 12-field `determinants` grid + deep-link to Posting Rules Resolver; side column (`col-span-4` on right) shows linked Fiscal Document and Inbox Event. Single `primary` button `[Retry Posting]` in `PageHeader`.

```text
+----------------------------------------------------------------------------------------------------------+
| Inbox / Posting Exceptions / 0192f1c4                        [Discard Fact...]  [* Retry Posting]        |
| NO_ACCOUNT_RULE · [Open] · [Critical !] · Version v1                                                     |
+----------------------------------------------------------------------+-----------------------------------+
| Root-Cause Diagnostic & Remediation                                  | Source & Linked Records           |
| -------------------------------------------------------------------- | --------------------------------- |
| Code: ACCOUNTING.POSTING.NO_ACCOUNT_RULE                             | Source App: trade                 |
| Detail: No published posting rule matched PURCHASE_BILL STOCK_ITEM.  | Source Ref: BILLING_REQ:0192e9b1  |
| Deadline: 2026-11-01 18:00 (in 3h 30m) · Retries: 1 · Role: acct_mgr | Fiscal Document:                  |
| +------------------------------------------------------------------+ | [Open Document 0192ea04 ->]       |
| | Fix Root Cause: Open Posting Rules Dry-Run Studio pre-filled     | | Inbox Event:                      |
| | with these determinants, publish the rule, then click Retry.     | | [Inspect Parked Event 0192e9f0->] |
| | [Open Posting Rules Studio with Determinants ->]                 | | (Inbox replay locked: owned here) |
| +------------------------------------------------------------------+ | --------------------------------- |
| Captured Determinants Snapshot (determinants)                        | Audit Timestamps                  |
| +--------------------------+---------------------------------------+ | First Seen: 2026-11-01 14:10      |
| | eventKind: PURCHASE_BILL | documentKind: INVOICE                 | | Last Retry: 2026-11-01 14:22      |
| | sourceApp: trade         | mappingKey: STOCK_ITEM                | | Branch: CAI-01                    |
| | itemClass: --            | itemGroup: RAW_METALS                 | |                                   |
| | partyGroup: FOREIGN_SUPP | taxStatus: STANDARD                   | |                                   |
| | direction: --            | accountRole: GRNI_ACCRUAL             | |                                   |
| | postingDate: 2026-11-01  | currencyCode: EGP                     | | [Copy Diagnostic JSON]            |
| +--------------------------+---------------------------------------+ |                                   |
+----------------------------------------------------------------------+-----------------------------------+
```

#### 4. `EN-LTR` × `Dark` (`dir="ltr"`, `html.dark`) — `RetryPostingExceptionDialog` (Cross-Period `POSTING_REDATE` Approved State)
- **Visual Prose:** Modal `<Dialog>` (`max-w-lg`) over dimmed `--ink-950/80` backdrop on `--ink-900` surface. Shows single-entry `postingDate` moving from `2026-09-30` (Period `2026-09`) to `2026-10-01` (Period `2026-10`), matched `APPROVED` `POSTING_REDATE` request `0192f300`, and single `primary` commit button `[Retry & Post on 2026-10-01]`.

```text
+------------------------------------------------------------------------+
| Re-date & Retry Posting Exception                          [Close Esc] |
+------------------------------------------------------------------------+
| Exception: 0192f0a8 · BACKDATED_CARRYING_CONFLICT                      |
| Original Fact Date: 2026-09-30 · Minimum Allowed Date: 2026-10-01      |
|                                                                        |
| New Posting Date (postingDate) *                                       |
| [ 2026-10-01                                              ] (ISO Date) |
| Helper: Moves entry from period 2026-09 into 2026-10 (originalPeriodId |
|         will record 2026-09; documentDate stays 2026-09-30).           |
|                                                                        |
| Cross-Period Approval (POSTING_REDATE · approvalRequestId) *           |
| +--------------------------------------------------------------------+ |
| | [Approved v] Request 0192f300 · Approved by Sara M. (Chief Acct)   | |
| +--------------------------------------------------------------------+ |
|                                                                        |
| Concurrency Guard: If-Match "3" · Idempotency: UUIDv7 0192f349...      |
+------------------------------------------------------------------------+
|                               [Cancel]  [* Retry & Post on 2026-10-01] |
+------------------------------------------------------------------------+
```

#### 5. Mobile Responsive Notes (`375px` Viewport — `SCR-07`)
- **Queue (`#3`):** Status `Tabs` scroll horizontally with fade edges (`overflow-x-auto`). Each exception renders as a compact stacked card (`rounded-lg p-3 border`) showing `[StatusBadge] + Kind` on row 1, `<IdentifierText>{errorCode}</IdentifierText>` on row 2, `sourceApp:sourceId + deadlineAt` on row 3, and full-width `44px`-tall `Inspect` tap target.
- **Detail (`#4`):** Single-column stack: Header + sticky bottom action bar (`h-16 px-4 bg-card/95 border-t`) holding `[Retry Posting]` (`min-h-11` `44px` touch target) and `[Discard…]`. Determinants collapse secondary `null` keys behind `"Show 5 empty determinants"` toggle.

---

## 2. `SCR-08A` *(Plan/Brief `SCR-08` · Inventory `#52`–`#53`)* — Cross-Target Bulk Operations

- **Routes:**
  - `#52` `/accounting/post/bulk-operations` — Bulk operations monitor & launcher (`BulkOperationsListView` + `LaunchBulkOperationDrawer`)
  - `#53` `/accounting/post/bulk-operations/[id]` — Per-target execution progress & partial-failure retry workspace (`BulkOperationDetailView`)
- **Navigation Placement:** Accounting sidebar -> **Journals & Posting (`اليوميات والترحيل`)** -> **Bulk Operations (`العمليات المجمعة`)**. Also reachable from the global `AccountingJobTrayDrawer` (`accounting-patterns-workflow.md` `UX-10`), `SCR-04` Fiscal Periods (multi-period close/reopen), `SCR-10` Posting Rules (`ADOPT_RULE_SET_VERSION` across companies), and `SCR-24` Close Checklist.
- **Feature & Permission Gate:**
  - Feature key: `accounting.ledger.core`
  - Scope target: **`TENANT`** (the deliberate exception in Module 02 — `acc_bulk_operations` can span up to `500` companies, periods, or rule-set targets in one command, `D-164`; per-target authorization is enforced both at creation and when Worker executes each target, failing unauthorized targets with `ACCOUNTING.SCOPE.TARGET_DENIED` without aborting siblings!)
  - Permissions:
    - Read list & detail: `accounting.bulk_operation.read`
    - Launch / Retry failed targets: `accounting.bulk_operation.create` **plus** the companion permission of the selected `BulkOperationKind` (for `REBUILD_LEDGER_FACTS`, also `accounting.bulk_operation.run` per `02_Endpoint_Catalogue.md` line 313).

### 2.1 Layout & Progressive-Disclosure Hierarchy

1. **Operations List (`#52` `/accounting/post/bulk-operations`):**
   - **`PageHeader`:** Title `t.accounting.bulkOperations.title` (`العمليات المجمعة` / `Bulk Operations`), subtitle explaining independent per-target transactions (`1..500` targets) and safe retry of failed targets only. Single `variant="primary"` CTA: `New Bulk Operation` (`عملية مجمعة جديدة` — gated by `accounting.bulk_operation.create`).
   - **Active Jobs Strip (when any row is `QUEUED` or `RUNNING`):** Compact live banner showing active Worker operations with `Retry-After`-guided auto-refresh (`3s`–`5s` backoff, paused when browser tab is hidden).
   - **`FilterBar`:**
     - `status` (`Select`: `QUEUED`, `RUNNING`, `PARTIAL`, `COMPLETED`, `FAILED`)
     - `operation` (`Select`: the **10 MVP-active** `BulkOperationKind` values — see §2.3; the 11 reserved post-MVP enum members are omitted from filter/launcher pickers, though rendered safely via `t.accounting.enums.bulkOperationKind` if ever returned on wire).
     - *Filter Honesty:* `BulkOperationListQueryDto` (`02_DTOs.md` §5.1) supports **only** `FindManyDto` (`page`, `limit`, `sortBy`, `sortOrder`, `search`) + `operation?` + `status?`. No undeclared `scopeKind` or date-range query param is sent.
   - **`DataTable`:**
     - Columns (`font-normal` `400` in `<td>`):
       1. `operation` (localized `BulkOperationKind` label + `retryOfId` `[Retry]` / `[إعادة]` chip if `retryOfId !== null`)
       2. `scopeKind` (`COMPANY` / `FISCAL_PERIOD` / `RULE_SET` localized badge)
       3. `counts` (`totalCount` total: `succeededCount` succeeded · `failedCount` failed · `skippedCount` skipped, `tabular-nums` + mini segmented progress bar with text counts)
       4. `status` (`StatusBadge` per `accounting-status-and-a11y.md` Group B: `QUEUED`/`RUNNING`/`PARTIAL`=`caution`, `COMPLETED`=`positive`, `FAILED`=`negative`)
       5. `requestedBy` (`System` / `النظام` badge when `requestedBy === null` on auto-queued `REBUILD_LEDGER_FACTS`, else actor ID/name)
       6. `requestedAt` / `completedAt` (localized Western-digit timestamps)
       7. Action: `Open ->` (`فتح <-`) `Link` to `/accounting/post/bulk-operations/${row.id}`.

2. **Launch Bulk Operation Drawer (`LaunchBulkOperationDrawer`, width `640px`):**
   - 3-step progressive disclosure inside one sheet:
     - **Step 1 — Scope & Operation:** Select `scopeKind` (`COMPANY` | `FISCAL_PERIOD` | `RULE_SET`) -> filters `operation` to valid MVP `BulkOperationKind`s for that scope and checks the user's companion permission via `/auth/me` (`adminCan` / tenant RBAC helper), disabling unauthorized operations with an explicit required-permission hint.
     - **Step 2 — Targets (`1..500` UUIDs):** Multi-select picker backed by existing lookup/list endpoints:
       - `COMPANY` -> tenant companies from Core directory (`/api/tenant/core/v1/companies` / workspace company list); for `REBUILD_LEDGER_FACTS`, enforces **exactly `1` target company** (`02_Ledger_Tables.md` line 1006).
       - `FISCAL_PERIOD` -> `GET /api/tenant/accounting/v1/periods` (company fiscal periods).
       - `RULE_SET` -> `GET /api/tenant/accounting/v1/posting-rule-versions?status=PUBLISHED` (`ADOPT_RULE_SET_VERSION`).
       - Displays live counter `<IdentifierText>{selectedIds.length} / 500</IdentifierText>` (`MAX_BULK_TARGETS = 500`).
     - **Step 3 — Typed Operation Parameters & Approvals:** Renders **only** the exact `parameters` keys and `approvals[]` admitted by `acc_bulk_operations.parameters` (`02_Ledger_Tables.md` line 1009) for the chosen `operation` (see §2.3 matrix). Never renders raw JSON!
   - Submitting sends `POST /api/tenant/accounting/v1/bulk-operations` with `x-idempotency-key: generateUUIDv7()`. On `202 Accepted` (`Location` + `Retry-After`), closes the drawer, registers the job in `AccountingJobTrayDrawer`, and navigates to `#53` `/accounting/post/bulk-operations/${createdId}`.

3. **Operation Detail (`#53` `/accounting/post/bulk-operations/[id]`):**
   - **`PageHeader`:** Operation title, `<IdentifierText>{detail.id}</IdentifierText>`, `StatusBadge(detail.status)`, parent link (`Retry of #${retryOfId}`) when `detail.retryOfId !== null`.
   - **Single `variant="primary"` CTA (shown when `detail.status` is `PARTIAL` or `FAILED`, `detail.failedCount > 0`, and user holds `accounting.bulk_operation.create`):**
     - `Retry Failed Targets (${detail.failedCount})` (`إعادة محاولة الأهداف الفاشلة (${detail.failedCount})`) -> opens a pre-filled confirmation dialog that submits `POST /api/tenant/accounting/v1/bulk-operations` with:
       - **Fresh** `x-idempotency-key: generateUUIDv7()` (it is a new child command row, `02_Ledger_Tables.md` line 1047!)
       - `scopeKind: detail.scopeKind`
       - `operation: detail.operation`
       - `targets`: exact array of `results.filter(r => r.outcome === 'FAILED').map(r => r.targetId)`
       - `parameters`: carried forward from `detail.parameters` (with editable `approvals` if a target failed on `ACCOUNTING.APPROVAL.REQUIRED`)
       - *(`BulkOperationDto.retryOfId?: UUID` names the parent operation and follows the parent rules of `acc_bulk_operations.retry_of_id`, `D-771`; the client sends it on a retry.)*
   - **`AsyncProgressCard` (`accounting-patterns-workflow.md` `UX-10`):**
     - Displays `totalCount`, `succeededCount`, `failedCount`, `skippedCount`, `requestedAt`, `startedAt`, `completedAt`, `commandEventId` (`<IdentifierText>`), and read-only `parameters` summary. Polls `GET /:id` respecting `Retry-After` while `status` is `QUEUED` or `RUNNING`.
   - **`BulkTargetResultsTable` (`results[]`):**
     - Filter tabs: `All (${totalCount})` | `Failed (${failedCount})` *(auto-selected when `status === 'PARTIAL'` or `'FAILED'`)* | `Succeeded (${succeededCount})` | `Skipped (${skippedCount})`.
     - Virtualized via `useVirtualWindow` when `results.length >= 100` (up to `500` targets).
     - Columns: `#`, `targetId` (`<IdentifierText>` + resolved company/period/version label when in cache), `outcome` (`SUCCEEDED`=`positive`, `FAILED`=`negative`, `SKIPPED`=`neutral`), `errorCode` (`<IdentifierText>`), `message`, and `resultRef` drill link (e.g. journal entry, close instance, depreciation/deferral run, or report run).

### 2.2 Reused Stage-0 Patterns & Design-System Primitives

- From `@/design-system`: `PageHeader`, `FilterBar`, `DataTable`, `Pagination`, `Tabs`, `Card`, `Drawer`, `ConfirmDialog`, `Alert`, `Badge`, `StatusBadge`, `Button`, `Input`, `Textarea`, `Select`, `Checkbox`, `Field`, `Skeleton`, `EmptyState`, `ErrorState`, `PermissionGate`, `IdentifierText`.
- From approved Stage-0 specs:
  - `<AsyncProgressCard>`, `<BulkTargetResultsTable>`, `<AccountingJobTrayDrawer>`, `<AmbiguousOutcomePanel>` (`accounting-patterns-workflow.md` `UX-10`, `UX-13`).

### 2.3 MVP-Active `BulkOperationKind` Parameter & Companion-Permission Matrix (`D-164`, `D-344`, `D-358`, `D-539`)

Only these **10** `BulkOperationKind` values are selectable in MVP (`02_Ledger_Tables.md` line 1007). The 11 reserved wave 1–3 values (`ADOPT_PACK_VERSION`, `RUN_RECURRING`, `RUN_FX_REVALUATION`, `RETRY_POSTING_EXCEPTIONS`, `YEAR_END_CLOSE`, `ALLOCATION_CYCLE_RUN`, `ALLOCATION_CYCLE_REVERSE`, `REVALUE_ASSET_CLASS`, `RUN_WIP_RECOGNITION`, `POST_INSTRUMENT_ACCRUALS`, `POST_INSTRUMENT_RECLASSIFICATION`) are hidden from creation (`403 ACCOUNTING.FEATURE.NOT_ENTITLED` if submitted):

| `BulkOperationKind` | Allowed `scopeKind` | Target Cardinality | Companion Per-Target Permission | Structured `parameters` Fields Sent | `approvals[]` (`BulkTargetApprovalInput[]`) |
| --- | --- | --- | --- | --- | --- |
| `SOFT_CLOSE_PERIOD` | `FISCAL_PERIOD` | `1..500` | `accounting.period.change_state` | `periodModule` (`PeriodModule`: `GL \| AR \| AP \| INVENTORY \| TAX \| ASSETS \| INTERCOMPANY`), `reason` (`string`, `10..500`) | Omitted (`400` if sent) |
| `CLOSE_PERIOD` | `FISCAL_PERIOD` | `1..500` | `accounting.period.close` | `periodModule`, `reason` | Omitted |
| `REOPEN_PERIOD` | `FISCAL_PERIOD` | `1..500` | `accounting.period.reopen` | `periodModule`, `reason` | **Supported:** `[{ targetId, approvalRequestId }]` (`APPROVED` `PERIOD_REOPEN` per target whose company rule requires approval, `D-358`) |
| `ADOPT_RULE_SET_VERSION` | `COMPANY` or `RULE_SET` | `1..500` | `accounting.posting_rule.update` | `postingRuleVersionId` (when `scopeKind='COMPANY'`), `sourceApp` (`SourceApp`), `effectiveFrom` (`ISODate`), `blastRadiusAck` (`boolean: true`) | Omitted |
| `REBUILD_LEDGER_FACTS` | `COMPANY` | **Exactly `1`** (`targets: [companyId]`) | `accounting.bulk_operation.run` | `ledgerId` (`UUIDv7`), `fiscalYearId` (`UUIDv7`), `generation` (`integer >= 1`) (`02_Ledger_Tables.md` line 1009, `D-344`) | Omitted |
| `POST_DEPRECIATION` | `COMPANY` or `FISCAL_PERIOD` | `1..500` | `accounting.asset.run_depreciation` | `periodId` (when `scopeKind='COMPANY'`), `bookCode` (`'BOOK'`) | Omitted |
| `POST_DEFERRALS` | `COMPANY` or `FISCAL_PERIOD` | `1..500` | `accounting.deferral.run` | `periodId` (when `scopeKind='COMPANY'`), `kind?` (`DeferralKind`) | Omitted |
| `START_CLOSE` | `COMPANY` or `FISCAL_PERIOD` | `1..500` | `accounting.close.start` | `templateId?` (`UUIDv7`), `periodId?` (`UUIDv7`) | Omitted |
| `RUN_CLOSE_TASK` | `FISCAL_PERIOD` or `COMPANY` | `1..500` | `accounting.close.complete_task` | `taskCode` (`string`) | Omitted |
| `RUN_REPORT` | `COMPANY` | `1..500` | `accounting.report.run` | `reportCode` (`string`), `asOf` (`ISODate`), `ledgerId` (`UUIDv7`) | Omitted |

### 2.4 1:1 Field-to-DTO & Enum Mapping (`SCR-08A`)

| Direction | DTO & Wire Field | Type / Constraint | Notes & UI Binding |
| --- | --- | --- | --- |
| Query (`#52`) | `BulkOperationListQueryDto.operation` | `BulkOperationKind?` | Filter dropdown (10 MVP kinds) |
| Query (`#52`) | `BulkOperationListQueryDto.status` | `BulkOperationStatus?` | `QUEUED \| RUNNING \| PARTIAL \| COMPLETED \| FAILED` |
| Query (`#52`) | `FindManyDto.page`, `limit`, `sortBy`, `sortOrder`, `search` | `1..200`, `1..100` | Standard offset list |
| Command (`POST`) | `BulkOperationDto.scopeKind` | `BulkOperationScope` | `COMPANY \| FISCAL_PERIOD \| RULE_SET` in MVP |
| Command (`POST`) | `BulkOperationDto.targets` | `UUIDv7[]` (`1..500`, `ArrayMaxSize(500)`) | Exact target IDs (`1` for `REBUILD_LEDGER_FACTS`) |
| Command (`POST`) | `BulkOperationDto.operation` | `BulkOperationKind` | Selected MVP kind |
| Command (`POST`) | `BulkOperationDto.parameters` | `Record<string, unknown>?` (`<= 64 KiB`) | Typed per-operation form output; decimals as strings |
| Command (`POST`) | `BulkOperationDto.approvals` | `BulkTargetApprovalInput[]?` (`<= 500`) | Sent **only** when `operation === 'REOPEN_PERIOD'`: `{ targetId: UUIDv7, approvalRequestId: UUIDv7 }` |
| Response (`#52`/`#53`) | `BulkOperationSummaryDto` / `DetailDto` (`acc_bulk_operations` §13.1) | `id`, `companyId`, `scopeKind`, `targets`, `operation`, `status`, `parameters`, `results` *(Detail)*, `totalCount`, `succeededCount`, `failedCount`, `skippedCount`, `retryOfId`, `requestedBy`, `requestedAt`, `startedAt`, `completedAt`, `commandEventId`, `version` | `results[]` items: `{ targetId: UUIDv7, outcome: 'SUCCEEDED' \| 'FAILED' \| 'SKIPPED', errorCode?: string, message?: string, resultRef?: string }` |

### 2.5 Verbatim Endpoint Mapping (`02_Endpoint_Catalogue.md` §4 lines 311–313)

| UI Action | Method | Catalogue Path | Canonical Browser Gateway Path | Permission | Feature Key | Scope Target | Idempotency | Concurrency | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Load `#52` list | `GET` | `/accounting/bulk-operations` | `/api/tenant/accounting/v1/bulk-operations` | `accounting.bulk_operation.read` | `accounting.ledger.core` | `TENANT` | none | none | `200` (`BulkOperationSummaryDto[]` + `meta`) |
| Load `#53` detail & poll | `GET` | `/accounting/bulk-operations/:id` | `/api/tenant/accounting/v1/bulk-operations/:id` | `accounting.bulk_operation.read` | `accounting.ledger.core` | `TENANT` | none | none | `200` (per-target `results[]` + counts) |
| Launch operation / Retry failed subset | `POST` | `/accounting/bulk-operations` | `/api/tenant/accounting/v1/bulk-operations` | `accounting.bulk_operation.create` *(+ `accounting.bulk_operation.run` for `REBUILD_LEDGER_FACTS`)* | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | none | `202` + `Location` + `Retry-After` |

### 2.6 Complete UI & Boundary States (`SCR-08A`)

- **Loading / Empty / Error / `403 PermissionGate` / Entitlement / Recovery Mode:** Identical discipline to §1.6. Empty `#52` renders `"No bulk operations recorded yet"` with secondary guidance on multi-company period close and rule-set adoption.
- **`202` Async Polling & `PARTIAL` Terminal State (`D-164`):** While `status` is `QUEUED` or `RUNNING`, `#53` polls `GET /:id` at `Retry-After` (default `3s`, exponential cap `15s`). When `status === 'PARTIAL'`, `<AsyncProgressCard>` renders `tone="caution"` (never generic crash red!) stating `"Completed on X targets; failed on Y targets (independent transactions committed)"` and focuses the `Failed (${failedCount})` tab.
- **Per-Target `ACCOUNTING.SCOPE.TARGET_DENIED` & `ACCOUNTING.APPROVAL.REQUIRED`:** Highlighted inline per row in `BulkTargetResultsTable`; for `REOPEN_PERIOD` targets failing with `ACCOUNTING.APPROVAL.REQUIRED`, the retry dialog lets the user attach the newly approved `PERIOD_REOPEN` `approvalRequestId` per failed `targetId`.
- **`CLIENT_REQUEST_TIMEOUT` on `POST /bulk-operations`:** Renders `<AmbiguousOutcomePanel>` retaining the exact `x-idempotency-key` so clicking `[Retry safely]` replays the stored `202` (`Idempotency-Replayed: true`) instead of dispatching a duplicate batch across 500 targets!
- **Concurrency (`If-Match`):** `acc_bulk_operations` is append-only/Worker-transitioned (`none` concurrency header on `POST`); terminal rows never mutate (`trg_acc_bulk_operations_status_transition`).

### 2.7 Visual Prose & ASCII Mockups — `SCR-08A` (All 4 Combinations + `375px` Mobile)

#### 1. `AR-RTL` × `Light` (`dir="rtl"`, `html:not(.dark)`) — `#52` Bulk Operations List
- **Visual Prose:** `--ink-50` canvas, `--ink-0` table card. Single `primary` CTA `[+ عملية مجمعة جديدة]` at top-left (inline-end in RTL). Active job strip in `caution` subtle surface above filter bar.

```text
+----------------------------------------------------------------------------------------------------------+
| [+ عملية مجمعة جديدة *]                              العمليات المجمعة · نطاق المستأجر (عبر الشركات والفروع) |
|                                      معاملة مستقلة لكل هدف (حتى 500 هدف) مع إعادة محاولة الفاشل فقط     |
+----------------------------------------------------------------------------------------------------------+
| [قيد التنفيذ الآن] إغلاق مبدئي للفترة (24 فترة) · اكتمل 18 / 24 · تحديث تلقائي كل 3 ثوانٍ   [متابعة <-] |
+----------------------------------------------------------------------------------------------------------+
| [بحث...]                                    | الحالة: [الكل v]          | العملية: [كل العمليات v]      |
+----------------------------------------------------------------------------------------------------------+
| إجراء   | وقت الطلب        | الطالب     | الحالة       | النتائج (نجح/فشل/تخطي من الإجمالي) | النطاق        | العملية                  |
+=========+==================+============+==============+====================================+===============+==========================+
| [فتح<-] | 2026-11-01 14:28 | كمال أ.    | [قيد التنفيذ]| 18 نجح · 0 فشل · 0 تخطي / 24       | فترة مالية    | إغلاق مبدئي للفترة       |
| [فتح<-] | 2026-11-01 11:05 | سارة م.    | [جزئي !]     | 37 نجح · 3 فشل · 0 تخطي / 40       | فترة مالية    | إغلاق الفترة المحاسبية   |
| [فتح<-] | 2026-10-31 22:10 | [النظام]   | [مكتملة v]   |  1 نجح · 0 فشل · 0 تخطي / 1        | شركة          | إعادة بناء حقائق الأستاذ |
+=========+==================+============+==============+====================================+===============+==========================+
```

#### 2. `AR-RTL` × `Dark` (`dir="rtl"`, `html.dark`) — `#53` Detail (`PARTIAL` Outcome + Retry Failed Subset)
- **Visual Prose:** `--ink-950` canvas, `--ink-900` cards. `PARTIAL` status renders `caution` tone (`جزئي`) with clear counts (`37` succeeded, `3` failed) and single `primary` button `[إعادة محاولة الأهداف الفاشلة (3) *]`.

```text
+----------------------------------------------------------------------------------------------------------+
| [إعادة محاولة الأهداف الفاشلة (3) *]                    العمليات المجمعة / 0192ee40 · إغلاق الفترة المحاسبية |
|                                                [جزئي !] · النطاق: فترة مالية · الوحدة: GL · 40 هدفاً     |
+----------------------------------------------------------------------------------------------------------+
| ملخص التنفيذ غير المتزامن (AsyncProgressCard)                                                            |
| الإجمالي: 40  |  نجح: 37 [v]  |  فشل: 3 [!]  |  تم تخطيه: 0  |  معرف أمر العامل: <0192ee41-88a1...>      |
| المعاملات الملتزمة: حُفظت الـ 37 فترة الناجحة في معاملات مستقلة ولن تتأثر بإعادة محاولة الـ 3 الفاشلة.  |
+----------------------------------------------------------------------------------------------------------+
|  تم تخطيه (0)  |  نجح (37)  |  [ فشل (3) ]  |  الكل (40)                                                 |
+----------------------------------------------------------------------------------------------------------+
| المرجع / الرابط      | الرسالة التشخيصية                           | رمز الخطأ                       | النتيجة | الهدف (targetId)     | # |
+======================+=============================================+=================================+=========+======================+===+
| [عرض الاستثناءات <-] | توجد 2 استثناءات ترحيل مفتوحة في الفترة     | ACCOUNTING.CLOSE.SYSTEM_CHECK.. | [فشل !] | 0192a110.. (CAI-10)  | 1 |
| --                   | لم تعد لديك صلاحية الإغلاق على هذه الشركة   | ACCOUNTING.SCOPE.TARGET_DENIED  | [فشل !] | 0192a118.. (ALX-10)  | 2 |
| [فتح قائمة الإغلاق<-]| مهمة المطابقة البنكية لم تكتمل بعد          | ACCOUNTING.CLOSE.MODULE_NOT_R.. | [فشل !] | 0192a124.. (ASW-10)  | 3 |
+======================+=============================================+=================================+=========+======================+===+
```

#### 3. `EN-LTR` × `Light` (`dir="ltr"`, `html:not(.dark)`) — `LaunchBulkOperationDrawer` (`REOPEN_PERIOD` with Per-Target Approvals)
- **Visual Prose:** Right-hand `<Drawer>` (`640px`, `--ink-0` surface) over `#52`. Shows typed parameters (`periodModule`, `reason`) and per-target `BulkTargetApprovalInput` (`approvalRequestId`) mapping for `REOPEN_PERIOD` (`D-358`).

```text
+--------------------------------------------------------------------------------+
| New Bulk Operation                                                 [Close Esc] |
+--------------------------------------------------------------------------------+
| 1. Scope & Operation                                                           |
| Scope (scopeKind) *: [ FISCAL_PERIOD v ]   Operation *: [ REOPEN_PERIOD    v ] |
| Required per-target permission: accounting.period.reopen [Granted on 2/2]      |
|                                                                                |
| 2. Target Periods (targets · 2 / 500 selected) *                               |
| [x] FY2026-P09 (2026-09) · Nile Trading Co.      (01929001-...)                |
| [x] FY2026-P09 (2026-09) · Delta Logistics Co.   (01929002-...)                |
|                                                                                |
| 3. Operation Parameters & Approved Requests                                    |
| Module (parameters.periodModule) *: [ GL (General Ledger) v ]                  |
| Reason (parameters.reason · 10..500 chars) *:                                  |
| [ Late customs clearance audit adjustment for September 2026               ]   |
|                                                                                |
| Per-Target PERIOD_REOPEN Approvals (approvals[])                               |
| +-------------------------------+--------------------------------------------+ |
| | Target Period                 | Approved PERIOD_REOPEN Request             | |
| +-------------------------------+--------------------------------------------+ |
| | Nile Trading · FY2026-P09     | [ 0192f102 (Approved by H. Mansour)    v ] | |
| | Delta Logistics · FY2026-P09  | [ 0192f109 (Approved by H. Mansour)    v ] | |
| +-------------------------------+--------------------------------------------+ |
+--------------------------------------------------------------------------------+
| Idempotency: UUIDv7 (202 Accepted async)      [Cancel]  [* Dispatch Operation] |
+--------------------------------------------------------------------------------+
```

#### 4. `EN-LTR` × `Dark` (`dir="ltr"`, `html.dark`) — `#53` Detail (`RUNNING` Live Worker Progress)
- **Visual Prose:** `--ink-950` canvas, `--ink-900` cards. Shows `ADOPT_RULE_SET_VERSION` running across `12` companies (`8 / 12` processed, `Retry-After: 3s` live poll indicator, `prefers-reduced-motion` static progress bar when reduced motion is active).

```text
+----------------------------------------------------------------------------------------------------------+
| Bulk Operations / 0192ef99 · ADOPT_RULE_SET_VERSION                             [Pause Auto-Refresh (3s)]|
| [Running...] · Scope: COMPANY · 12 Targets · Requested by kamal@mersany.ai at 2026-11-01 15:02           |
+----------------------------------------------------------------------------------------------------------+
| Live Execution Progress                                                                                  |
| [====================..........] 8 / 12 processed  |  Succeeded: 8  |  Failed: 0  |  Skipped: 0          |
| Parameters: sourceApp=trade · effectiveFrom=2026-11-01 · blastRadiusAck=true · version=0192ed01...       |
+----------------------------------------------------------------------------------------------------------+
| All (12) | Failed (0) | Succeeded (8) | Pending in Worker (4)                                            |
+----------------------------------------------------------------------------------------------------------+
| #  | Target Company               | Outcome       | Error Code | Diagnostic / Result Ref                 |
+====+==============================+===============+============+=========================================+
|  1 | 01921001.. (Nile Trading)    | [Succeeded v] | --         | Profile updated -> v4                   |
|  2 | 01921002.. (Delta Logistics) | [Succeeded v] | --         | Profile updated -> v4                   |
|  9 | 01921009.. (Sinai Cement)    | [Queued...]   | --         | Waiting for Worker slot...              |
+====+==============================+===============+============+=========================================+
```

#### 5. Mobile Responsive Notes (`375px` Viewport — `SCR-08A`)
- `#52` collapses table rows into stacked job cards showing `operation`, `StatusBadge`, segmented count pill (`37 ok / 3 fail`), and `requestedAt`.
- `LaunchBulkOperationDrawer` renders as a full-viewport sheet (`w-full h-dvh`) with sticky step footer (`44px` buttons).
- `#53` stacks `AsyncProgressCard` 2×2 metric tiles above filter chips (`Failed`, `Succeeded`, `All`) and per-target cards.

---

## 3. `SCR-08B` *(Inventory Row `SCR-08` · `#46`–`#47`)* — Recurring Journal Templates & Execution Runs

- **Routes:**
  - `#46` `/accounting/post/recurring-entries` — Recurring & accrual templates list, bulk actions, export & editor (`RecurringTemplatesListView` + `RecurringTemplateEditorDrawer`)
  - `#47` `/accounting/post/recurring-entries/[id]` — Template detail, line specification & append-only execution runs (`RecurringTemplateDetailView` + `RecurringRunInspectDrawer`)
- **Navigation Placement:** Accounting sidebar -> **Journals & Posting (`اليوميات والترحيل`)** -> **Recurring Entries (`القيود الدورية والاستحقاقات`)**.
- **Feature & Permission Gate:**
  - Feature key: `accounting.ledger.core`
  - Scope target: `COMPANY` (every request carries `x-mutakamel-company-id`)
  - Permissions:
    - Read templates & runs (`GET`, `/search`, `/count`, `/lookup`, `/export`, `recurring-runs`): `accounting.recurring_template.read`
    - Create / Bulk create: `accounting.recurring_template.create`
    - Update / Bulk update / Restore / Bulk restore / Pause / Resume: `accounting.recurring_template.update`
    - Soft delete / Bulk delete: `accounting.recurring_template.delete`
    - Execute `Run Now`: `accounting.recurring_template.run`

### 3.1 Layout & Progressive-Disclosure Hierarchy

1. **Templates List (`#46` `/accounting/post/recurring-entries`):**
   - **`PageHeader`:** Title `t.accounting.recurring.title` (`القيود الدورية والاستحقاقات` / `Recurring Entries & Accruals`), subtitle noting role-based account resolution (`D-067`) and idempotent `(templateId, runOn)` execution (`D-078`).
     - Single `variant="primary"` CTA: `New Recurring Template` (`قالب دوري جديد` — gated by `accounting.recurring_template.create`).
     - Secondary header actions: `Export` (`تصدير` -> `POST /export`, `202` async job in `AccountingJobTrayDrawer`) and `Show Deleted` (`إظهار المحذوفة` `includeDeleted` toggle).
   - **Summary Strip (`POST /count`):** Active templates count + `"Due on or before today"` count (`nextRunBefore = today`, `active = true`).
   - **`FilterBar`:**
     - `active` (`Select`: `All`, `Active` (`true`), `Paused / Completed` (`false`) — maps directly to `RecurringTemplateListQueryDto.active`)
     - `journalId` (`Combobox` via `POST /api/tenant/accounting/v1/journals/lookup`)
     - `nextRunBefore` (`ISODate` input)
     - `search` (`Input`, max `120` chars — `code` or localized `nameI18n`)
     - *Advanced Filter Drawer (`POST /search`):* Adds `status` (`ACTIVE | PAUSED | COMPLETED`) and `templateKind` (`RECURRING | ACCRUAL`) predicates when `FilterSpec` allowlists them (logged as `CG-S5-06` because `RecurringTemplateListQueryDto` lacks direct `status` and `templateKind` query params).
   - **Bulk Selection Action Bar (contextual when `>= 1` rows checked):**
     - `Bulk Pause / Update` (`PATCH /bulk-update`, `200/207`), `Bulk Delete` (`POST /bulk-delete`, `200/207`, gated by `accounting.recurring_template.delete`), or `Bulk Restore` (`POST /bulk-restore`, `200/207`, when `includeDeleted=true`). Renders per-item `207 Multi-Status` results (`BulkOperationResultDto<T>`) inline if any row has existing runs and refuses soft-delete!
   - **`DataTable`:**
     - Columns (`font-normal` `400` in `<td>`):
       1. Selection `Checkbox`
       2. `code` (`<IdentifierText>{row.code}</IdentifierText>`) + localized `nameI18n[locale]`
       3. `templateKind` (`RECURRING` / `ACCRUAL` + `[Auto-Reverse]` chip when `autoReverseNextPeriod === true`)
       4. `schedule` (`frequency` × `interval`, e.g. `Monthly · Day 1` / `شهري · اليوم 1`)
       5. `currencyCode` (`<IdentifierText>`) + `autoPost` badge (`Auto-post` vs `Draft`)
       6. `nextRunOn` (`<IdentifierText>` ISO date; highlighted `caution` when `<= today` and `status === 'ACTIVE'`)
       7. `occurrences` (`${occurrencesDone} / ${occurrencesTotal ?? '∞'}` in `tabular-nums`)
       8. `status` (`StatusBadge` Group B: `ACTIVE`=`positive`, `PAUSED`=`caution`, `COMPLETED`=`neutral`)
       9. Row action: `Open ->` (`فتح <-`) `Link` to `/accounting/post/recurring-entries/${row.id}`.

2. **Create / Edit Template Drawer (`RecurringTemplateEditorDrawer`, width `880px`):**
   - **Section A — Identity & Posting Target:**
     - `code` (`Input` uppercase `^[A-Z0-9_-]{1,32}$`; immutable on `PATCH`), `nameI18n.ar` (required), `nameI18n.en` (optional), `templateKind` (`RECURRING` | `ACCRUAL`), `ledgerId` (defaults to company `PRIMARY` ledger; immutable on `PATCH`), `journalId` (`<JournalPicker>`), `entryKind` (`Select` restricted to **`STANDARD | RECURRING | ACCRUAL` ONLY** per `02_DTOs.md` §5.2 & `ck_acc_recurring_templates_entry_kind`), `branchId?`, `currencyCode` (`3`-char ISO).
     - **Accrual Invariant Lock (`D-078`):** Selecting `templateKind === 'ACCRUAL'` automatically locks `entryKind = 'ACCRUAL'` and `autoReverseNextPeriod = true` (read-only switch with helper text explaining `ck_acc_recurring_templates_accrual_reverses`).
     - **Approval Rule Transparency (`D-346`):** No `requiresApproval` checkbox exists anywhere (`CreateRecurringTemplateDto` forbids it!). An informational note states: *"Approval is governed dynamically at run time by active `MANUAL_JE` approval rules (`SCR-09`). When a rule matches, the run creates a `PENDING_APPROVAL` draft regardless of `autoPost`."*
   - **Section B — Recurrence Schedule (`RecurringScheduleInput`):**
     - `schedule.frequency` (`WEEKLY | MONTHLY | QUARTERLY | ANNUAL`), `schedule.interval` (`integer 1..365`), `schedule.dayOfMonth?` (`1..31`, shown for `MONTHLY`/`QUARTERLY`/`ANNUAL`), `schedule.dayOfWeek?` (`0..6`, shown for `WEEKLY`).
     - `startOn` (`ISODate`), `endOn?` (`ISODate >= startOn`), `occurrencesTotal?` (`integer >= 1`), `autoPost` (`Switch`, default `false`). On `PATCH`, `nextRunOn` cannot be rewound earlier than `lastRunOn` (`trg_acc_recurring_templates_next_run_monotonic`).
   - **Section C — Template Lines (`<JournalLineGrid variant="recurring">`, `2..1,000` lines):**
     - Reuses `<JournalLineGrid variant="recurring">` from `accounting-patterns-documents.md` (`UX-01`):
       - **Account Target (`XOR` toggle per line, `ck_acc_recurring_template_lines_account_target`):**
         - Mode `ROLE` *(recommended default, `D-067`)*: `<Combobox>` over the 116 `AccountRole` values (excluding `SUSPENSE`). Survives chart of accounts changes.
         - Mode `ACCOUNT`: `<AccountPicker postableOnly />` (`accountId`).
       - **Direction:** `DEBIT` | `CREDIT`.
       - **Amount Source (`XOR` toggle per line, `ck_acc_recurring_template_lines_amount_source`):**
         - Mode `FIXED`: `<AccountingMoneyInput>` (`amount: DecimalString >= 0`).
         - Mode `FORMULA` (`D-047`): Structured `FormulaRef` builder (`amountExpression`) over the **closed fact list** (`PERIOD_DAYS`, `CONTRACT_AMOUNT`, `PREVIOUS_BALANCE`) — never free-text script!
       - **Subledger & Dimensions:** `partyId?` (`<PartyPicker>`, required when target account is a control account, `D-026`), `branchId?`, `dimensions?` (`<DimensionInputs>`), `cashFlowCategoryId?`, optional `quantity` + `uom` pair (`ck_acc_recurring_template_lines_quantity_pair`), `description?` (`<= 500` chars).
       - **Balance Footer:** When all lines use fixed `amount`, the server/client equality check verifies fixed debits == fixed credits before submit (`trg_acc_recurring_template_lines_balance`; note: string decimal comparison via canonical minor-unit alignment helper, never float `Number()`, or validated on save). When any line uses `amountExpression`, the footer displays: *"Formula template: balanced at run time; any runtime imbalance halts posting into a `PostingExceptionKind.UNBALANCED` exception."*

3. **Template Detail & Execution Runs (`#47` `/accounting/post/recurring-entries/[id]`):**
   - **`PageHeader`:** `<IdentifierText>{template.code}</IdentifierText>` + `nameI18n[locale]`, `StatusBadge(template.status)`, `<ETagVersionChip version={template.version} />`.
     - **Single `variant="primary"` CTA:** `Run Now` (`تشغيل الآن` -> `POST /:id/run-now` with `If-Match` + `x-idempotency-key`; gated by `accounting.recurring_template.run` and enabled when `status === 'ACTIVE'`).
     - **Secondary Lifecycle Actions:** `Edit` (`تعديل`), `Pause` (`إيقاف مؤقت` -> `POST /:id/pause` when `ACTIVE`) / `Resume` (`استئناف` -> `POST /:id/resume` when `PAUSED`), and `Delete` (`حذف` -> `DELETE /:id` when `runsCount === 0`; once any run exists in `acc_recurring_runs`, `Delete` is disabled with tooltip *"Templates with execution history cannot be deleted (`ON DELETE RESTRICT`); pause the template instead"*).
   - **Workspace `Tabs`:**
     1. **Overview & Lines (`نظرة عامة والسطور`):** Schedule card (`startOn`, `endOn`, `nextRunOn`, `lastRunOn`, `occurrencesDone / occurrencesTotal`, `autoPost`, `autoReverseNextPeriod`) + read-only `<JournalLineGrid variant="recurring" readOnly />`.
     2. **Execution Runs (`سجل التشغيلات` — `GET /api/tenant/accounting/v1/recurring-runs`):**
        - Append-only audit table (`acc_recurring_runs`, `D-338`): `runOn` (`<IdentifierText>`), `executedAt`, `status` (`POSTED`=`positive`, `DRAFTED`/`BLOCKED`=`caution`, `SKIPPED`=`neutral`, `FAILED`=`negative`), `amountTotal` (`<Money>`), `reversesRunId` (`[Accrual Reversal]` badge), `retryOfRunId` (`[Retry]` badge), and outcome artifact link:
          - `POSTED` -> `entryId` opens `<LedgerDrillDrawer>`
          - `DRAFTED` -> `draftId` links to `/accounting/journals/drafts/${draftId}` (`SCR-05`)
          - `BLOCKED` -> `postingExceptionId` links directly to `/accounting/inbox/posting-exceptions/${postingExceptionId}` (`SCR-07` `#4`!)
          - `SKIPPED` -> localized `skipReason` (`TEMPLATE_PAUSED`, `OUT_OF_RANGE`, `OCCURRENCE_CAP_REACHED`, `ALREADY_RUN`)
          - `FAILED` -> `<IdentifierText>{errorCode}</IdentifierText>`
        - Clicking any run row opens `RecurringRunInspectDrawer` (`GET /api/tenant/accounting/v1/recurring-runs/:id`).

### 3.2 1:1 Field-to-DTO & Enum Mapping (`SCR-08B`)

| DTO | Exact Wire Properties | Types & Constraints |
| --- | --- | --- |
| `RecurringTemplateListQueryDto` (`§5.1`) | `page`, `limit`, `sortBy`, `sortOrder`, `search`, `includeDeleted`, `journalId?`, `active?`, `nextRunBefore?` | `UUIDv7?`, `boolean?`, `ISODate?` |
| `CreateRecurringTemplateDto` (`§5.2`) | `code`, `nameI18n` (`{ ar, en? }`), `templateKind` (`RecurringTemplateKind`: `RECURRING \| ACCRUAL`), `ledgerId`, `journalId`, `entryKind` (`'STANDARD' \| 'RECURRING' \| 'ACCRUAL'`), `branchId?`, `currencyCode` (`ISO4217`), `schedule` (`RecurringScheduleInput`), `startOn` (`ISODate`), `endOn?` (`ISODate`), `occurrencesTotal?` (`int >= 1`), `autoPost?` (`boolean`), `autoReverseNextPeriod?` (`boolean`), `description?` (`<= 500`), `lines` (`RecurringTemplateLineInput[]`, `2..1000`) | **Never** send `requiresApproval` (`D-346`) |
| `RecurringScheduleInput` (`§5.2`) | `frequency` (`ScheduleFrequency`: `WEEKLY \| MONTHLY \| QUARTERLY \| ANNUAL`), `interval` (`int 1..365`), `dayOfMonth?` (`int 1..31`), `dayOfWeek?` (`int 0..6`) | Checked by `ck_acc_recurring_templates_schedule_shape` |
| `RecurringTemplateLineInput` (`§5.2`) | `accountRole?` (`AccountRole`) **XOR** `accountId?` (`UUIDv7`), `direction` (`DEBIT \| CREDIT`), `amount?` (`DecimalString >= 0`) **XOR** `amountExpression?` (`FormulaRef`), `partyId?`, `branchId?`, `dimensions?` (`DimensionSetKey`), `cashFlowCategoryId?`, `quantity?` (`DecimalString`) + `uom?` (`<= 16`), `description?` (`<= 500`) | `isStorno` omitted (always `false` in DB, `D-219`) |
| `UpdateRecurringTemplateDto` (`§5.2`) | Partial of `CreateRecurringTemplateDto` **without** `code` or `ledgerId` | Requires `If-Match: "<version>"` |
| `RecurringTemplateSummaryDto` / `DetailDto` (`§13.1` `acc_recurring_templates`) | `id`, `companyId`, `code`, `nameI18n`, `templateKind`, `ledgerId`, `journalId`, `entryKind`, `branchId`, `currencyCode`, `schedule`, `startOn`, `endOn`, `nextRunOn`, `lastRunOn`, `occurrencesTotal`, `occurrencesDone`, `autoPost`, `autoReverseNextPeriod`, `status` (`ACTIVE \| PAUSED \| COMPLETED`), `description`, `version`, `deletedAt` + `lines[]` *(Detail)* | Strong `ETag` on `GET /:id` |
| `RecurringRunSummaryDto` / `DetailDto` (`§13.1` `acc_recurring_runs`) | `id`, `companyId`, `templateId`, `runOn`, `executedAt`, `periodId`, `entryId`, `draftId`, `reversesRunId`, `retryOfRunId`, `status` (`POSTED \| DRAFTED \| SKIPPED \| BLOCKED \| FAILED`), `skipReason` (`TEMPLATE_PAUSED \| OUT_OF_RANGE \| OCCURRENCE_CAP_REACHED \| ALREADY_RUN \| null`), `postingExceptionId`, `errorCode`, `amountTotal`, `commandEventId`, `bulkOperationId`, `createdAt`, `createdBy` | Append-only (`trg_acc_recurring_runs_append_only`) |

### 3.3 Verbatim Endpoint Mapping (`02_Endpoint_Catalogue.md` §4 lines 289–307)

All 19 primary endpoints mapped 1:1 (browser path `/api/tenant/accounting/v1/<suffix>`):

|Method | Catalogue Path | Permission | Feature Key | Scope Target | Idempotency | Concurrency | Response |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET` | `/accounting/recurring-templates` | `accounting.recurring_template.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |
| `POST` | `/accounting/recurring-templates/search` | `accounting.recurring_template.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |
| `POST` | `/accounting/recurring-templates/count` | `accounting.recurring_template.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` (`CountResultDto`) |
| `POST` | `/accounting/recurring-templates/lookup` | `accounting.recurring_template.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` (`LookupItemDto[]`) |
| `GET` | `/accounting/recurring-templates/:id` | `accounting.recurring_template.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` + `ETag` |
| `POST` | `/accounting/recurring-templates` | `accounting.recurring_template.create` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `201` + `Location` |
| `POST` | `/accounting/recurring-templates/bulk` | `accounting.recurring_template.create` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `200/207` |
| `PATCH` | `/accounting/recurring-templates/:id` | `accounting.recurring_template.update` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| `PATCH` | `/accounting/recurring-templates/bulk-update` | `accounting.recurring_template.update` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `200/207` |
| `DELETE` | `/accounting/recurring-templates/:id` | `accounting.recurring_template.delete` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `204` |
| `POST` | `/accounting/recurring-templates/bulk-delete` | `accounting.recurring_template.delete` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `200/207` |
| `POST` | `/accounting/recurring-templates/:id/restore` | `accounting.recurring_template.update` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `200` |
| `POST` | `/accounting/recurring-templates/bulk-restore` | `accounting.recurring_template.update` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `200/207` |
| `POST` | `/accounting/recurring-templates/export` | `accounting.recurring_template.read` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `202` + `Location` |
| `POST` | `/accounting/recurring-templates/:id/pause` | `accounting.recurring_template.update` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| `POST` | `/accounting/recurring-templates/:id/resume` | `accounting.recurring_template.update` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| `POST` | `/accounting/recurring-templates/:id/run-now` | `accounting.recurring_template.run` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` + chain headers |
| `GET` | `/accounting/recurring-runs` | `accounting.recurring_template.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |
| `GET` | `/accounting/recurring-runs/:id` | `accounting.recurring_template.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |

### 3.4 Complete UI & Boundary States (`SCR-08B`)

- **Loading / Empty / Error / `403 PermissionGate` / Entitlement / Recovery Mode:** Standard Stage-0 boundaries. In `RECOVERY_MODE`, all 12 write/run routes disable with `<RecoveryModeBanner />` while templates and runs remain inspectable.
- **`Run Now` Multi-Outcome Toast & Receipt Banner (`POST /:id/run-now`):**
  - Outcome `POSTED`: Shows `StatusBadge(tone="positive")`, `X-Accounting-Entry-No` (`<IdentifierText>`), and `[Inspect Posted Entry]` opening `<LedgerDrillDrawer>`.
  - Outcome `DRAFTED` (`autoPost === false` or matched `MANUAL_JE` approval rule, `D-346`): Shows `StatusBadge(tone="caution")` explaining why a draft was produced instead of direct posting + `[Open Journal Draft ->]`.
  - Outcome `BLOCKED`: Shows `StatusBadge(tone="caution")` with `errorCode` and `[Resolve Posting Exception ->]` (`/accounting/inbox/posting-exceptions/${postingExceptionId}`).
  - Outcome `SKIPPED` (`ALREADY_RUN` / `OCCURRENCE_CAP_REACHED`): Neutral banner naming `skipReason` (`uq_acc_recurring_runs_template_run_on` idempotency guard).
- **`207 Multi-Status` Partial Bulk Result:** Bulk create/update/delete/restore modals render a summary banner (`succeeded` vs `failed`) and keep failed rows selected with their per-row `errorCode` (`ACCOUNTING.VALIDATION.FAILED` or FK restrict on templates with runs).
- **`409 ACCOUNTING.CONCURRENCY.STALE_VERSION` & `CLIENT_REQUEST_TIMEOUT`:** `<StaleVersionBanner>` reloads `GET /:id` + `ETag`; `<AmbiguousOutcomePanel>` checks `GET /recurring-runs` for `(templateId, nextRunOn)` before re-submitting `run-now` with the retained `x-idempotency-key`.
- **`202` Async Export (`POST /export`):** Tracked in `AccountingJobTrayDrawer` (`Location` poll -> signed download URL).

### 3.5 Visual Prose & ASCII Mockups — `SCR-08B` (All 4 Combinations + `375px` Mobile)

#### 1. `AR-RTL` × `Light` (`dir="rtl"`, `html:not(.dark)`) — `#46` Recurring Templates List
- **Visual Prose:** `--ink-50` canvas, `--ink-0` table card. Single `primary` CTA `[+ قالب دوري جديد *]` at top-left (inline-end in RTL); secondary `[تصدير]` next to it. Western numerals (`ar-EG-u-nu-latn`) and `<bdi dir="ltr">` codes (`RNT-CAI-01`, `ACC-UTL-01`).

```text
+----------------------------------------------------------------------------------------------------------+
| [تصدير] [+ قالب دوري جديد *]                            القيود الدورية والاستحقاقات · شركة النيل للتجارة |
|                             إجمالي القوالب النشطة: 12 · مستحقة للتشغيل حتى اليوم (2026-11-01): 2 قوالب  |
+----------------------------------------------------------------------------------------------------------+
| [ ] إظهار المحذوفة | [بحث بالرمز أو الاسم...] | مستحق قبل: [2026-11-30] | اليومية: [الكل v] | الحالة: [نشط v] |
+----------------------------------------------------------------------------------------------------------+
| إجراء   | الحالة   | التنفيذات | التشغيل القادم | العملة / النمط   | الجدول الزمني     | النوع             | الرمز والاسم           | [ ] |
+=========+==========+===========+================+==================+===================+===================+========================+=====+
| [فتح<-] | [نشط v]  |  10 / 12  | 2026-11-01 [!] | EGP · ترحيل آلي  | شهري · اليوم 1    | دوري              | RNT-CAI-01 إيجار المقر | [ ] |
| [فتح<-] | [نشط v]  |   4 / ∞   | 2026-11-01 [!] | EGP · مسودة      | شهري · اليوم 28   | استحقاق [عكس آلي] | ACC-UTL-01 استحقاق كهرباء| [ ] |
| [فتح<-] | [متوقف]  |   2 / 4   | 2026-12-31     | USD · ترحيل آلي  | ربع سنوي · يوم 15 | دوري              | INS-2026 تأمين بحري    | [ ] |
+=========+==========+===========+================+==================+===================+===================+========================+=====+
```

#### 2. `AR-RTL` × `Dark` (`dir="rtl"`, `html.dark`) — `RecurringTemplateEditorDrawer` (`ACCRUAL` Mode + Role/Formula XOR Lines)
- **Visual Prose:** `--ink-900` elevated sheet (`880px`) over `--ink-950` backdrop. Shows `templateKind = ACCRUAL` locking `entryKind = ACCRUAL` and `autoReverseNextPeriod = true`, plus `<JournalLineGrid variant="recurring">` with `AccountRole` (`D-067`) and closed `FormulaRef` (`D-047`).

```text
+----------------------------------------------------------------------------------------------------------+
| [إغلاق Esc]                                                      تعديل القالب الدوري · ACC-UTL-01 (v4)  |
+----------------------------------------------------------------------------------------------------------+
| البيانات الأساسية والجدول الزمني                                                                         |
| الرمز (ثابت): <ACC-UTL-01>  | الاسم (عربي)*: [استحقاق مرافق وكهرباء القاهرة] | الاسم (EN): [Cairo Util.] |
| نوع القالب*: [استحقاق (ACCRUAL) v] | نوع القيد: [ACCRUAL (مقفل)] | عكس تلقائي بالفترة التالية: [مفعل (مقفل)]|
| اليومية*: [GJ-01 اليومية العامة v] | العملة*: [EGP v] | الترحيل التلقائي (autoPost): [ ] (ينشئ مسودة)   |
| التكرار*: [شهري (MONTHLY) v] · كل [1] شهر · يوم الشهر: [28] | البدء*: [2026-07-01] | الانتهاء: [--]     |
| ملاحظة الاعتماد (D-346): تخضع المسودات الناتجة تلقائياً لقواعد اعتماد القيود اليدوية (MANUAL_JE) النشطة. |
+----------------------------------------------------------------------------------------------------------+
| سطور القالب (<JournalLineGrid variant="recurring"> · سطران على الأقل)                    [+ إضافة سطر]   |
| +--------------------+-------------------------+---------+-------------------------------+-------------+ |
| | مركز التكلفة/الفرع | المبلغ أو الصيغة (XOR)  | الجانب  | الهدف المحاسبي (دور أم حساب)  | #           | |
| +--------------------+-------------------------+---------+-------------------------------+-------------+ |
| | CC-OPS · CAI-01    | [صيغة] PREVIOUS_BALANCE | مدين    | [دور حساب] UTILITIES_EXPENSE  | 1           | |
| | CC-OPS · CAI-01    | [صيغة] PREVIOUS_BALANCE | دائن    | [دور حساب] ACCRUED_EXPENSES   | 2           | |
| +--------------------+-------------------------+---------+-------------------------------+-------------+ |
| حالة التوازن: قالب يعتمد على صيغة مغلقة؛ يُتحقق من التوازن وقت التشغيل وأي فرق يسجل استثناء UNBALANCED.  |
+----------------------------------------------------------------------------------------------------------+
| [حفظ التعديلات (PATCH + If-Match "4") *]  [إلغاء]                                                        |
+----------------------------------------------------------------------------------------------------------+
```

#### 3. `EN-LTR` × `Light` (`dir="ltr"`, `html:not(.dark)`) — `#47` Template Detail (`Execution Runs` Tab)
- **Visual Prose:** `--ink-50` canvas, `--ink-0` cards. Shows `Run Now` as the sole `primary` button, `Delete` disabled because runs exist (`occurrencesDone = 3`), and the append-only `acc_recurring_runs` table illustrating `POSTED`, `POSTED` accrual reversal (`reversesRunId`), `BLOCKED` (deep-linking to `SCR-07`), and retry (`retryOfRunId`).

```text
+----------------------------------------------------------------------------------------------------------+
| Recurring Entries / ACC-UTL-01 · Cairo Utilities Accrual   [Pause] [Edit] [Delete (Locked)] [* Run Now]  |
| [Active v] · ACCRUAL · Auto-reverse next period · Next Run: 2026-11-28 · Done: 3 / ∞ · Version v4        |
+----------------------------------------------------------------------------------------------------------+
|   Overview & Template Lines (2)   |  [ Execution Runs History ]                                          |
+----------------------------------------------------------------------------------------------------------+
| Run Date   | Executed At      | Status      | Magnitude (EGP) | Lineage / Chain       | Produced Artifact|
+============+==================+=============+=================+=======================+==================+
| 2026-10-28 | 2026-10-28 09:14 | [Posted v]  |       18,400.00 | Retry of #0192e010    | [JV-2026-000904] |
| 2026-10-28 | 2026-10-28 02:00 | [Blocked !] |              -- | Initial scheduled run | [Excp 0192e011->] |
| 2026-10-01 | 2026-10-01 02:00 | [Posted v]  |       17,950.00 | Reverses #0192d100    | [JV-2026-000801] |
| 2026-09-28 | 2026-09-28 02:00 | [Posted v]  |       17,950.00 | Accrual base run      | [JV-2026-000772] |
+============+==================+=============+=================+=======================+==================+
```

#### 4. `EN-LTR` × `Dark` (`dir="ltr"`, `html.dark`) — `RecurringRunInspectDrawer` (`GET /recurring-runs/:id`)
- **Visual Prose:** Right slide-over `<Drawer>` (`520px`, `--ink-900` surface) showing the immutable append-only receipt of a `BLOCKED` run and its one-click jump to `SCR-07` Posting Exception `#4`.

```text
+----------------------------------------------------------------------+
| Recurring Run Receipt · 0192e010                         [Close Esc] |
+----------------------------------------------------------------------+
| Status: [Blocked !]          Scheduled Date (runOn): 2026-10-28      |
| Executed At: 2026-10-28 02:00:04Z · Actor: Worker Scheduler          |
| Command Event ID: 0192e00f-77c2-7000-8000-112233445566               |
| -------------------------------------------------------------------- |
| Blocking Cause                                                       |
| Error Code: ACCOUNTING.PERIOD.CLOSED                                 |
| Posting Exception: 0192e011 [Open Posting Exception Workspace ->]    |
| -------------------------------------------------------------------- |
| Retry Lineage                                                        |
| Succeeded on later retry run: 0192e099 -> Entry [JV-2026-000904]     |
+----------------------------------------------------------------------+
```

#### 5. Mobile Responsive Notes (`375px` Viewport — `SCR-08B`)
- `#46` renders template cards with `code`, localized name, `StatusBadge`, `nextRunOn`, and overflow action menu.
- `RecurringTemplateEditorDrawer` renders full-screen (`100dvh`); each template line renders as a collapsible vertical card (`Line #1 · DEBIT`) instead of a cramped horizontal table.
- `#47` places `[Run Now]` + `[Pause/Edit]` in a sticky bottom bar (`44px` tap targets).

---

## 4. `SCR-10` — Posting Profiles, Versioned Posting Rules & Dry-Run Resolver

- **Routes:**
  - `#114` `/accounting/setup/posting-rules` — 4-Tab Integration & Posting Rules Workspace (`PostingRulesWorkspaceView`)
  - `#115` `/accounting/setup/posting-rules/[id]` — Posting Rule Version Detail, Full-Set Draft Editor, 6-Gate Validator & Two-Actor Publisher (`PostingRuleVersionDetailView`)
- **Navigation Placement:** Accounting sidebar -> **Setup & Configuration (`الإعدادات والتهيئة`)** -> **Posting Rules (`قواعد الترحيل المحاسبي`)**.
- **Feature & Permission Gate:**
  - Core Tabs (`Posting Profiles`, `Rule Versions`, `Dry-Run Resolver`) & `#115`:
    - Feature key: `accounting.ledger.core`
    - Permissions:
      - Read profiles, versions & rules: `accounting.posting_rule.read`
      - Update profile (`PATCH /posting-profiles/:sourceApp`), edit/validate/fork rule versions (`PATCH /:id`, `POST /:id/rules`, `POST /:id/validate`, `POST /:id/fork`): `accounting.posting_rule.update`
      - Create version (`POST /posting-rule-versions`): `accounting.posting_rule.create`
      - Publish / Schedule / Retire (`POST /:id/publish`, `POST /:id/retire`): `accounting.posting_rule.publish` (**and** current user must differ from `createdBy` — two-actor rule!)
      - Run dry-run resolver (`POST /posting-rules/resolve`): `accounting.posting_rule.resolve`
  - Tab 4 (`Source Document Links`):
    - Feature key: `accounting.integration.trade_posting`
    - Permission: `accounting.fiscal_document.read` (`COMPANY` scope). If the tenant is not entitled to `accounting.integration.trade_posting` or user lacks `accounting.fiscal_document.read`, **only Tab 4** renders `<FeatureNotEntitledState>` / `<PermissionGate>`, leaving Tabs 1–3 fully operational!

### 4.1 Layout & Progressive-Disclosure Hierarchy

1. **Workspace Shell (`#114` `/accounting/setup/posting-rules`):**
   - **`PageHeader`:** Title `t.accounting.postingRules.title` (`قواعد وملفات الترحيل` / `Posting Profiles & Rules`), subtitle explaining deterministic specificity resolution (`company set > platform set`, never `SUSPENSE`, `D-067` / `D-068`).
     - Contextual single `variant="primary"` CTA changes cleanly with active tab:
       - Tab 1 (`Profiles`): none (profiles are per-`SourceApp` upserts edited via row drawer)
       - Tab 2 (`Rule Versions`): `New Draft Version` (`إصدار مسودة جديد` -> `POST /posting-rule-versions`, gated by `accounting.posting_rule.create`)
       - Tab 3 (`Dry-Run Resolver`): `Resolve Simulation` (`اختبار حل القاعدة` -> `POST /posting-rules/resolve`, gated by `accounting.posting_rule.resolve`)
       - Tab 4 (`Source Document Links`): none (read-only audit trace).
   - **Tab 1 — Source-App Posting Profiles (`ملفات الترحيل حسب التطبيق`):**
     - Lists company profiles from `GET /api/tenant/accounting/v1/posting-profiles` (`COMPANY` scope): `sourceApp` (`trade`, `pos`, `crm`, `hr`, `import`, `accounting`), adopted `postingRuleVersionId` (`<IdentifierText>` + link to `#115`), `defaultJournalId`, `cogsRecognition` (`AT_DELIVERY` in MVP; `AT_PURCHASE` reserved wave 3), `inventoryCostMethod` (`WEIGHTED_AVERAGE` | `FIFO`), `isActive`, and event count in `defaultJournalByEvent`.
     - Clicking `Configure` (`تهيئة`) fetches `GET /api/tenant/accounting/v1/posting-profiles/:sourceApp` (capturing strong `ETag`) and opens `PostingProfileEditorDrawer` (`PATCH /api/tenant/accounting/v1/posting-profiles/:sourceApp` with `UpsertPostingProfileDto` + `If-Match`):
       - Editable fields strictly match `UpsertPostingProfileDto` (`02_DTOs.md` §12.2): `sourceApp`, `defaultJournalByEvent` (per-`PostingEventKind` `<JournalPicker>` map), and `cogsRecognition?` (`AT_DELIVERY` only in MVP, mirroring company profile `D-665`).
       - *Adoption Bridge (`CG-S5-08`):* `UpsertPostingProfileDto` accepts `defaultJournalId`, `inventoryCostMethod` (both required on the create of the resolve-or-create), `postingRuleVersionId`, `minSupportedSourceVersion` and `isActive` (`D-771`), so the profile drawer edits them; the bulk-operation path below is not changed by that ruling, and switching a company's adopted rule-set family uses a `"Adopt Rule-Set Version…"` button that dispatches `POST /api/tenant/accounting/v1/bulk-operations` (`operation: 'ADOPT_RULE_SET_VERSION'`, `scopeKind: 'COMPANY'`, `targets: [companyId]`; note that a published successor of the **already adopted** `code` governs automatically from its `effectiveFrom` without re-adoption per `D-055`!).
   - **Tab 2 — Rule Versions (`إصدارات مجموعات القواعد`):**
     - Queries `GET /api/tenant/accounting/v1/posting-rule-versions` (`COMPANY` scope; returns platform/pack versions where `companyId === null` alongside tenant company versions).
     - `FilterBar`: `status` (`DRAFT`, `TESTED`, `SCHEDULED`, `PUBLISHED`, `RETIRED`), `effectiveOn` (`ISODate`), `search`.
     - `DataTable` columns: `code` + `versionNo` (`<IdentifierText>{code} v{versionNo}</IdentifierText>`), localized `nameI18n`, `Scope` badge (`Platform Pack` `companyId === null` vs `Company Override`), `effectiveFrom` -> `effectiveTo ?? 'Open-ended'`, `ruleCount`, `status` (`StatusBadge` Group E: `DRAFT`/`RETIRED`=`neutral`, `TESTED`/`SCHEDULED`=`caution`, `PUBLISHED`=`positive`), `Fork` action (`POST /:id/fork` -> creates editable tenant `DRAFT` copy and redirects to `#115`), and `Open ->` link to `/accounting/setup/posting-rules/${row.id}`.
   - **Tab 3 — Dry-Run Resolver Studio (`معمل اختبار حل القواعد`):**
     - Pre-populates automatically from URL query params when navigated from `SCR-07` (`?tab=resolver&eventKind=...&sourceApp=...&mappingKey=...`).
     - Left pane: `ResolvePostingRuleDto` form (`eventKind`*, `sourceApp`*, `documentKind?`, `itemClass?`, `mappingKey?` with helper chip explaining automatic `STOCK_ITEM` binding on stock lines `D-674`, `itemGroup?`, `partyGroup?`, `branchId?`, `taxStatus?`, `direction?` enabled for inventory movements `ADJUSTMENT | RETURN | TRANSFER`, `asOfDate?`).
     - Right pane: `PostingRuleResolution` result card (`ruleId`, `versionId` link to `#115`, resolved `debitAccountId` + code/name, resolved `creditAccountId` + code/name, resolved `journalId`, and `inputsSnapshot` table showing exact determinants matched). If resolution fails (`422 ACCOUNTING.POSTING.NO_ACCOUNT_RULE` or `ACCOUNTING.POSTING_RULES.CATCH_ALL_HIT`), renders an explainable miss card with `[Fork Active Set to Add Missing Rule]`.
   - **Tab 4 — Source Document Links (`روابط مستندات المصدر`):**
     - Queries `GET /api/tenant/accounting/v1/source-document-links` (`COMPANY` scope) tracing consumed external facts (`sourceApp`, `sourceType`, `sourceId`, `sourceVersion`, `linkKind`) to their produced `fiscalDocumentId` (`/accounting/documents/...`), `journalEntryId` (`<LedgerDrillDrawer>`), or `postingExceptionId` (`/accounting/inbox/posting-exceptions/...`).

2. **Rule Version Detail & Authoring Studio (`#115` `/accounting/setup/posting-rules/[id]`):**
   - **Header & Immutability / Maker-Checker Strip:**
     - Displays `code`, `versionNo`, `status`, `effectiveFrom`, `effectiveTo`, `contentHash` (`<IdentifierText>` SHA-256), `ruleCount`, `createdBy`, `publishedBy`, `publishedAt`, and `<ETagVersionChip />`.
     - **State-Driven Primary & Secondary Actions (at most ONE `variant="primary"` at any state):**
       - When `status === 'DRAFT'` (`companyId !== null`):
         - If unsaved row edits exist in local working set: Primary = `Save Rule Set (${rows.length} rows)` (`POST /:id/rules` + `If-Match` — replaces the full row set of the `DRAFT` version atomically!).
         - Else (clean `DRAFT`): Primary = `Run 6-Gate Validation` (`POST /:id/validate` + `If-Match` -> transitions `DRAFT -> TESTED` when all 6 gates pass). Secondary = `+ Add Rule Row`, `Edit Version Metadata` (`PATCH /:id`).
       - When `status === 'TESTED'`:
         - If `currentUser.id !== version.createdBy` and user has `accounting.posting_rule.publish`: Primary = `Publish / Schedule Version…` (`POST /:id/publish` + `If-Match`, optional `effectiveFrom` in `PublishPostingRuleVersionDto`; sets `PUBLISHED` when `effectiveFrom <= today`, or `SCHEDULED` when `effectiveFrom > today`).
         - If `currentUser.id === version.createdBy`: Primary is omitted and `<MakerCheckerSelfActionBanner>` (`accounting-patterns-workflow.md` `UX-06`) explains: *"You authored this rule version (`createdBy`). A second user with `accounting.posting_rule.publish` must publish it."*
         - Secondary = `Re-run Validation`, `Fork to New Draft`.
       - When `status` is `PUBLISHED` or `SCHEDULED`:
         - Read-only frozen banner (`trg_acc_posting_rules_version_frozen` — `ACCOUNTING.POSTING_RULES.FROZEN`). Primary = `Fork to New Draft` (`POST /:id/fork` — gated by `accounting.posting_rule.update`). Secondary = `Retire Version…` (`POST /:id/retire` + `If-Match` — gated by `accounting.posting_rule.publish`).
       - When `status === 'RETIRED'` or `companyId === null` (Platform Pack):
         - Read-only frozen banner; Primary = `Fork to New Draft` (`POST /:id/fork`).
   - **6-Gate Validation Report Strip (`PostingRuleGateReportDto`):**
     - Six horizontal gate pills (`SCHEMA`, `REFERENCES`, `DETERMINISM`, `OVERLAP`, `GAPS`, `ROLE_RESOLVABILITY`), each showing `PASSED` (`positive`), `FAILED` (`negative`), or `Untested` (`neutral`). Clicking any failed gate filters its `findings[]` (`rowCode`, `code`, `message`) and highlights the offending `rowCode` in the rule table below!
   - **Specificity-Ordered Rule Grid (`GET /:id/rules`):**
     - Grouped/filterable by `eventKind`, ordered exactly as the runtime SQL resolver orders rows (`specificity DESC, sequenceNo ASC`):
     - Columns: `rowCode` (`<IdentifierText>`), `eventKind`, **Determinants Summary** (chips for non-null determinants among the 8 weighted slots), **Computed Specificity Badge** (`Weight: 68` — live preview of `128·itemClass + 64·mappingKey + 32·itemGroup + 16·partyGroup + 8·branchId + 4·documentKind + 2·taxStatus + 1·direction`, labelled `"Server-derived"`), `sequenceNo`, `debitRole` (`<IdentifierText>`), `creditRole` (`<IdentifierText>`), `amountExpression` (`FormulaRef` summary, e.g. `grossAmount + roundingDifference`), `Flags` (`[Catch-All]` / `[Error Trap]` when `catchAllIsError === true`), and row edit/duplicate/delete triggers (active only in `DRAFT`).
   - **`PostingRuleRowDrawer` (Authoring One Row Inside the `DRAFT` Set):**
     - Enforces every DB check constraint locally before `POST /:id/rules`:
       1. **`SUSPENSE` Ban (`ck_acc_posting_rules_no_suspense`, `D-068`):** `SUSPENSE` is excluded from `debitRole` and `creditRole` pickers.
       2. **Role Presence & Distinctness (`ck_acc_posting_rules_roles_present`, `ck_acc_posting_rules_roles_differ`):** At least one of `debitRole` / `creditRole` is set, and `debitRole !== creditRole`.
       3. **Movement Direction Rule (`ck_acc_posting_rules_direction_sided`, `D-674`):** When `eventKind` is `ADJUSTMENT`, `RETURN`, or `TRANSFER`, `direction` (`DEBIT` inbound / `CREDIT` outbound) is **required** unless `isCatchAll && catchAllIsError`; for non-inventory events, `direction` is locked to `null` so the author cannot write an unreachable rule!
       4. **Catch-All Shape (`ck_acc_posting_rules_catch_all_shape`):** Toggling `isCatchAll = true` clears all 8 weighted determinants (`itemClass`..`direction`) to `null` (`specificity = 0`).
       5. **Closed Formula Builder (`amountExpression`):** Structured builder over the frozen fact set (`netAmount`, `taxAmount`, `grossAmount`, `costAmount`, `quantity`, `discountAmount`, `roundingDifference`, `D-006`/`D-379`/`D-380`, `<= 8 KiB`).

### 4.2 1:1 Field-to-DTO & Enum Mapping (`SCR-10`)

| DTO | Exact Wire Properties | Types & Validation |
| --- | --- | --- |
| `UpsertPostingProfileDto` (`§12.2`) | `sourceApp` (`SourceApp`), `defaultJournalByEvent` (`Record<PostingEventKind, UUIDv7>`), `cogsRecognition?` (`CogsRecognition`: `AT_DELIVERY` in MVP), `defaultJournalId?`, `inventoryCostMethod?` (`WEIGHTED_AVERAGE` or `FIFO` in MVP), `postingRuleVersionId?`, `minSupportedSourceVersion?`, `isActive?` | `PATCH /posting-profiles/:sourceApp`; `If-Match` follows the upsert rule of Context §8 and is absent while no live profile exists (`D-771`) |
| `PostingRuleVersionListQueryDto` (`§12.1`) | `page`, `limit`, `sortBy`, `sortOrder`, `search`, `companyId?` (`UUIDv7`), `status?` (`PostingRuleVersionStatus`), `effectiveOn?` (`ISODate`) | `DRAFT \| TESTED \| SCHEDULED \| PUBLISHED \| RETIRED` |
| `PostingRuleListQueryDto` (`§12.1`) | `page`, `limit`, `sortBy`, `sortOrder`, `search`, `eventKind?` (`PostingEventKind`), `sourceApp?` (`SourceApp`) | `GET /posting-rule-versions/:id/rules` |
| `CreatePostingRuleVersionDto` (`§12.2`) | `companyId` (body, because the route is `TENANT`), `code`, `nameI18n`, `effectiveFrom`, `effectiveTo?`, `rows` (`PostingRuleRowInput[]`, `1..MAX_POSTING_RULE_ROWS`); no `comment` (no column holds one) | `POST /posting-rule-versions` (`D-772`) |
| `UpdatePostingRuleVersionDto` (`§12.2`) | `nameI18n?`, `effectiveFrom?`, `effectiveTo?` (`DRAFT` only; `companyId`, `code` and rows never change here) | `PATCH /posting-rule-versions/:id` + `If-Match` (`D-772`) |
| `ReplacePostingRuleRowsDto` (`§12.2`) | `rows` (`PostingRuleRowInput[]`, `1..MAX_POSTING_RULE_ROWS`, unique `rowCode`) | `POST /posting-rule-versions/:id/rules` + `If-Match` (`DRAFT` only, `D-772`) |
| `ForkPostingRuleVersionDto` (`§12.2`) | `effectiveFrom`, `nameI18n?`, `companyId?` (only when forking a platform or pack version) | `POST /posting-rule-versions/:id/fork`; `validate` and `retire` take an empty body (`D-772`) |
| `PostingRuleRowInput` (`§12.2`) | `rowCode` (`<= 48`), `eventKind` (`PostingEventKind`), `sourceApp?`, `documentKind?` (`DocumentKind`), `itemClass?` (`<= 64`), `mappingKey?` (`<= 64`), `itemGroup?` (`<= 64`), `partyGroup?` (`<= 64`), `branchId?` (`UUIDv7`), `taxStatus?` (`TaxStatus`), `direction?` (`DEBIT \| CREDIT`), `sequenceNo` (`int >= 0`), `debitRole?` (`AccountRole`), `creditRole?` (`AccountRole`), `amountExpression` (`FormulaRef`), `dimensionRule?` (`Record<string, string>`), `journalId?` (`UUIDv7`), `isCatchAll?` (`boolean`), `catchAllIsError?` (`boolean`), `description?` (`<= 255`) | Sent as array to `POST /posting-rule-versions/:id/rules` *(see `CG-S5-10` wrapper check)* |
| `PostingRuleRowDto` (`§12.2`) | Extends `PostingRuleRowInput` + `id` (`UUIDv7`), `specificity` (`number`), `version` (`number`) | `specificity` computed by DB trigger |
| `PostingRuleGateReportDto` (`§12.2`) | `versionId` (`UUIDv7`), `passed` (`boolean`), `gates`: `Array<{ gate: 'SCHEMA' \| 'REFERENCES' \| 'DETERMINISM' \| 'OVERLAP' \| 'GAPS' \| 'ROLE_RESOLVABILITY'; passed: boolean; findings: Array<{ rowCode?: string; code: string; message: string }> }>` | Returned by `POST /:id/validate` |
| `PublishPostingRuleVersionDto` (`§12.2`) | `effectiveFrom?` (`ISODate`) | `POST /:id/publish` + `If-Match`; maker != publisher |
| `ResolvePostingRuleDto` (`§12.2`) | `eventKind` (`PostingEventKind`), `sourceApp` (`SourceApp`), `documentKind?`, `itemClass?`, `mappingKey?`, `itemGroup?`, `partyGroup?`, `branchId?`, `taxStatus?`, `direction?`, `asOfDate?` (`ISODate`) | Read-like `POST /posting-rules/resolve` (no `x-idempotency-key`) |
| `PostingRuleResolution` (`03_Interfaces` §4) | `ruleId` (`UUIDv7`), `versionId` (`UUIDv7`), `debitAccountId` (`UUIDv7 \| null`), `creditAccountId` (`UUIDv7 \| null`), `journalId` (`UUIDv7`), `inputsSnapshot` (`Record<string, string \| null>`) | Dry-run resolver output |
| `SourceDocumentLinkSummaryDto` (`§13.1` `acc_source_document_links`) | `id`, `companyId`, `eventId`, `sourceApp`, `sourceType`, `sourceId`, `sourceVersion`, `linkKind` (`BILLING_REQUEST \| DOCUMENT_FACT \| MOVEMENT \| SHIFT \| PAYROLL \| IMPORT \| SETTLEMENT`), `fiscalDocumentId`, `journalEntryId`, `postingExceptionId`, `linkedAt` | `GET /source-document-links` |

### 4.3 Verbatim Endpoint Mapping (`02_Endpoint_Catalogue.md` §11 lines 1058–1072)

All 15 primary endpoints mapped verbatim (browser path `/api/tenant/accounting/v1/<suffix>`):

| Method | Catalogue Path | Permission | Feature Key | Scope Target | Idempotency | Concurrency | Response |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET` | `/accounting/posting-profiles` | `accounting.posting_rule.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |
| `GET` | `/accounting/posting-profiles/:sourceApp` | `accounting.posting_rule.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` + `ETag` |
| `PATCH` | `/accounting/posting-profiles/:sourceApp` | `accounting.posting_rule.update` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| `GET` | `/accounting/posting-rule-versions` | `accounting.posting_rule.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |
| `GET` | `/accounting/posting-rule-versions/:id` | `accounting.posting_rule.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` + `ETag` |
| `GET` | `/accounting/posting-rule-versions/:id/rules` | `accounting.posting_rule.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |
| `POST` | `/accounting/posting-rule-versions` | `accounting.posting_rule.create` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | none | `201` + `Location` |
| `PATCH` | `/accounting/posting-rule-versions/:id` | `accounting.posting_rule.update` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | `If-Match` | `200` |
| `POST` | `/accounting/posting-rule-versions/:id/rules` | `accounting.posting_rule.update` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | `If-Match` | `200` (replaces all rows of a `DRAFT` version) |
| `POST` | `/accounting/posting-rule-versions/:id/validate` | `accounting.posting_rule.update` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | `If-Match` | `200` (`PostingRuleGateReportDto`: schema, references, determinism, overlap, gaps, role resolvability) |
| `POST` | `/accounting/posting-rule-versions/:id/publish` | `accounting.posting_rule.publish` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | `If-Match` | `200` (or schedules via `effectiveFrom`; maker != publisher) |
| `POST` | `/accounting/posting-rule-versions/:id/retire` | `accounting.posting_rule.publish` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | `If-Match` | `200` |
| `POST` | `/accounting/posting-rule-versions/:id/fork` | `accounting.posting_rule.update` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | none | `201` + `Location` (creates a new `DRAFT` version copied from `:id`) |
| `POST` | `/accounting/posting-rules/resolve` | `accounting.posting_rule.resolve` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | none | none | `200` (`PostingRuleResolution` dry-run; never writes) |
| `GET` | `/accounting/source-document-links` | `accounting.fiscal_document.read` | `accounting.integration.trade_posting` | `COMPANY` | none | none | `200` |

### 4.4 Complete UI & Boundary States (`SCR-10`)

- **Loading / Empty / Error / `403 PermissionGate` / Entitlement / Recovery Mode:** Standard Stage-0 patterns. Tab 4 (`Source Document Links`) isolates `accounting.integration.trade_posting` entitlement so non-Trade tenants still manage Posting Profiles, Rule Versions, and Dry-Run Resolver without hindrance.
- **Unsaved Full-Set Row Changes Guard (`#115` `DRAFT`):** Because `POST /:id/rules` replaces all rows of a `DRAFT` version in one atomic request (`If-Match`), `usePostingRuleVersionDetail` tracks a dirty working copy in memory, displays a sticky `"Unsaved changes to 2 rule rows — Save before running 6-gate validation"` bar, and warns on route leave.
- **Frozen Version Attempt (`409 ACCOUNTING.POSTING_RULES.FROZEN`):** Editing controls are never rendered on non-`DRAFT` versions; if a version is published in another tab while open, `POST /:id/rules` / `PATCH /:id` surfaces a clear frozen banner with `[Fork to New Draft]`.
- **6-Gate Failure (`ACCOUNTING.POSTING_RULES.GATE_FAILED` / `passed: false`):** `Publish` remains locked while `status === 'DRAFT'`; failed gates expand inline showing exact `rowCode` and localized remediation (e.g. unassigned `AccountRole` on `ROLE_RESOLVABILITY` -> link to `/accounting/setup/account-roles`).
- **Two-Actor Publish Guard (`maker != publisher`):** Enforced preemptively via `<MakerCheckerSelfActionBanner>` when `user.id === version.createdBy` and handled on server `403 ACCOUNTING.APPROVAL.ACTOR_IS_SUBMITTER`.
- **`409 ACCOUNTING.CONCURRENCY.STALE_VERSION` & `CLIENT_REQUEST_TIMEOUT`:** `<StaleVersionBanner>` reloads `GET /:id` + `ETag` (offering JSON export of unsaved local draft rows before reload so author work is never lost); `<AmbiguousOutcomePanel>` verifies `GET /:id` (`contentHash`, `status`, `version`) before re-sending with the exact `x-idempotency-key`.

### 4.5 Visual Prose & ASCII Mockups — `SCR-10` (All 4 Combinations + `375px` Mobile)

#### 1. `AR-RTL` × `Light` (`dir="rtl"`, `html:not(.dark)`) — `#114` Workspace (`Rule Versions` Tab)
- **Visual Prose:** `--ink-50` canvas, `--ink-0` cards. Four top tabs (`ملفات الترحيل`, `إصدارات القواعد` active, `معمل اختبار الحل`, `روابط مستندات المصدر`). Single `primary` CTA `[+ إصدار مسودة جديد *]` at top-left (inline-end in RTL).

```text
+----------------------------------------------------------------------------------------------------------+
| [+ إصدار مسودة جديد *]                              قواعد وملفات الترحيل المحاسبي · شركة النيل للتجارة   |
|                                   ترتيب الحسم الحتمي: مجموعة الشركة ثم حزمة المنصة · الأعلى وزناً يفوز   |
+----------------------------------------------------------------------------------------------------------+
|   روابط مستندات المصدر   |   معمل اختبار الحل   |  [ إصدارات مجموعات القواعد ]  |   ملفات الترحيل        |
+----------------------------------------------------------------------------------------------------------+
| [بحث بالرمز أو الاسم...]            | ساري في تاريخ: [2026-11-01]          | الحالة: [كل الحالات v]     |
+----------------------------------------------------------------------------------------------------------+
| إجراءات          | الحالة      | القواعد | فترة السريان             | النطاق        | الاسم              | الرمز والإصدار   |
+==================+=============+=========+==========================+===============+====================+==================+
| [فتح<-] [نسخ فرع]| [مختبرة !]  |      44 | 2026-11-01 -> مفتوح      | مخصص للشركة   | قواعد تجارة النيل  | NILE_TRD v3      |
| [فتح<-] [نسخ فرع]| [منشورة v]  |      42 | 2026-01-01 -> 2026-11-01 | مخصص للشركة   | قواعد تجارة النيل  | NILE_TRD v2      |
| [فتح<-] [نسخ فرع]| [منشورة v]  |      68 | 2026-01-01 -> مفتوح      | حزمة المنصة   | الحزمة القياسية EG | EG_STD_2026 v1   |
+==================+=============+=========+==========================+===============+====================+==================+
```

#### 2. `AR-RTL` × `Dark` (`dir="rtl"`, `html.dark`) — `#114` Workspace (`Dry-Run Resolver Studio` Tab)
- **Visual Prose:** `--ink-950` canvas, `--ink-900` dual-pane studio (`POST /posting-rules/resolve`, read-like, zero DB writes). Right pane (inputs in RTL) holds determinants; left pane shows resolved accounts, journal, winning `rowCode`, and `inputsSnapshot`.

```text
+----------------------------------------------------------------------------------------------------------+
| [اختبار حل القاعدة *]                               قواعد وملفات الترحيل · معمل اختبار الحل (قراءة فقط)  |
+----------------------------------------------------------------------------------------------------------+
|   روابط مستندات المصدر   |  [ معمل اختبار الحل ]  |   إصدارات مجموعات القواعد   |   ملفات الترحيل        |
+---------------------------------------------------+------------------------------------------------------+
| نتيجة الحسم الجاف (PostingRuleResolution)         | مدخلات المحاكاة (ResolvePostingRuleDto)              |
| ------------------------------------------------- | ---------------------------------------------------- |
| [تم العثور على قاعدة مطابقة v]                    | نوع الحدث (eventKind)* : [ PURCHASE_BILL         v ] |
| الإصدار الفائز: NILE_TRD v2 [فتح الإصدار <-]      | تطبيق المصدر (sourceApp)*: [ trade               v ] |
| رمز الصف الفائز: PB_STOCK_RAW · الوزن: 96        | نوع المستند (documentKind): [ INVOICE            v ] |
| ------------------------------------------------- | مفتاح التوجيه (mappingKey): [ STOCK_ITEM           ] |
| الحساب المدين (debitAccountId):                   | مجموعة الصنف (itemGroup) : [ RAW_METALS            ] |
| 110605 · وسيط بضاعة مستلمة غير مفوترة (GRNI)      | مجموعة الطرف (partyGroup): [ --                    ] |
| الحساب الدائن (creditAccountId):                  | الحالة الضريبية (taxStatus): [ STANDARD          v ] |
| 210101 · مراقبة الموردين المحليين (AP_CONTROL)    | الاتجاه (direction - للمخزون): [ -- (غير مطبق)     ] |
| اليومية المحسومة: PJ-01 يومية المشتريات           | تاريخ السريان (asOfDate) : [ 2026-11-01            ] |
| ------------------------------------------------- |                                                      |
| لقطة المدخلات المقروءة (inputsSnapshot):          | ملاحظة D-674: بنود المخزون دون مفتاح صريح تأخذ      |
| mappingKey="STOCK_ITEM" (64) + itemGroup (32) = 96| تلقائياً المفتاح STOCK_ITEM (وزن 64).                |
+---------------------------------------------------+------------------------------------------------------+
```

#### 3. `EN-LTR` × `Light` (`dir="ltr"`, `html:not(.dark)`) — `#115` Version Detail (`TESTED` State + 6-Gate Pass + Maker != Publisher Banner)
- **Visual Prose:** `--ink-50` canvas, `--ink-0` cards. Shows `NILE_TRD v3` in `TESTED` state where all 6 validation gates passed (`PostingRuleGateReportDto`), and illustrates `<MakerCheckerSelfActionBanner>` when the logged-in user is the author (`createdBy`), plus specificity badges (`96`, `68`, `4`, `0`).

```text
+----------------------------------------------------------------------------------------------------------+
| Setup / Posting Rules / NILE_TRD v3                             [Re-run Validation]  [* Fork New Draft]  |
| NILE_TRD · v3 · [Tested !] · Effective: 2026-11-01 -> Open · Hash: 9f82c41e... · ETag "5"                |
+----------------------------------------------------------------------------------------------------------+
| [Two-Actor Publish Rule] You created this version (createdBy = kamal@mersany.ai).                        |
| A second user holding `accounting.posting_rule.publish` must publish or schedule it.                     |
+----------------------------------------------------------------------------------------------------------+
| 6-Gate Validation Report: [v SCHEMA] [v REFERENCES] [v DETERMINISM] [v OVERLAP] [v GAPS] [v ROLES]       |
+----------------------------------------------------------------------------------------------------------+
| Event Filter: [All Events (44) v]  |  Search rowCode / role: [________________]                          |
+----------------------------------------------------------------------------------------------------------+
| Row Code        | Event Kind    | Determinants Matched           | Weight | Seq | Debit Role   | Credit Role  | Formula                  |
+=================+===============+================================+========+=====+==============+==============+==========================+
| PB_STOCK_RAW    | PURCHASE_BILL | mappingKey:STOCK_ITEM + itemGrp|     96 |  10 | GRNI_ACCRUAL | AP_CONTROL   | netAmount                |
| PB_STOCK_STD    | PURCHASE_BILL | mappingKey:STOCK_ITEM + INVOICE|     68 |  10 | GRNI_ACCRUAL | AP_CONTROL   | netAmount                |
| PB_EXPENSE_DEF  | PURCHASE_BILL | documentKind:INVOICE           |      4 |  20 | PURCHASE_EXP | AP_CONTROL   | netAmount                |
| ADJ_INBOUND     | ADJUSTMENT    | direction:DEBIT                |      1 |  10 | INVENTORY    | INV_SHRINKAGE| costAmount               |
| ADJ_OUTBOUND    | ADJUSTMENT    | direction:CREDIT               |      1 |  10 | INV_SHRINKAGE| INVENTORY    | costAmount               |
| PB_CATCH_ERR    | PURCHASE_BILL | [Catch-All · Error Trap !]     |      0 | 999 | --           | AP_CONTROL   | grossAmount              |
+=================+===============+================================+========+=====+==============+==============+==========================+
```

#### 4. `EN-LTR` × `Dark` (`dir="ltr"`, `html.dark`) — `#115` `DRAFT` Authoring with Gate Finding & `PostingRuleRowDrawer`
- **Visual Prose:** `--ink-950` canvas with `PostingRuleRowDrawer` (`560px`, `--ink-900`) open on `DRAFT` version `NILE_TRD v4`. Highlights `ROLE_RESOLVABILITY` gate failure on `PB_IMPORT_DUTY` (`CUSTOMS_CLEARING` unassigned in company role assignments) and live specificity weight breakdown (`64 + 4 = 68`).

```text
+---------------------------------------------------+------------------------------------------------------+
| NILE_TRD v4 · [Draft] · Unsaved edits (1 row)     | Edit Rule Row · PB_IMPORT_DUTY           [Close Esc] |
| ------------------------------------------------- | ---------------------------------------------------- |
| Gate Report (Failed 1 of 6):                      | Row Code (rowCode)*: [ PB_IMPORT_DUTY              ] |
| [v SCHEMA] [v REFERENCES] [v DETERMINISM]         | Event Kind*        : [ LANDED_COST               v ] |
| [v OVERLAP] [v GAPS] [! ROLE_RESOLVABILITY (1)]   | Source App         : [ trade                     v ] |
| -> Row PB_IMPORT_DUTY: Credit role                | Document Kind      : [ INVOICE          v ] (+4 wt)  |
|    CUSTOMS_CLEARING has no active account         | Mapping Key        : [ CUSTOMS_DUTY       ] (+64 wt) |
|    assignment. [Assign Role ->]                   | Direction (Mov.only): [ Locked: null on LANDED_COST] |
| ------------------------------------------------- | Live Specificity Preview: 68 (Server-recomputed)     |
| Row Code       | Weight | Roles                   | Sequence Tie-Break*: [ 10                          ] |
| PB_IMPORT_DUTY |     68 | INVENTORY / CUSTOMS_CLR | ---------------------------------------------------- |
| PB_STOCK_STD   |     68 | GRNI_ACCRUAL / AP_CTRL  | Debit Role  : [ INVENTORY                        v ] |
|                                                   | Credit Role : [ CUSTOMS_CLEARING                 v ] |
|                                                   | (Note: SUSPENSE slot is banned by D-068)             |
|                                                   | Amount Formula*: [ netAmount                     v ] |
|                                                   | [ ] Catch-all row (isCatchAll)                       |
+---------------------------------------------------+------------------------------------------------------+
| [* Save Full Rule Set (POST /:id/rules)]          |                         [Cancel]  [Apply Row to Set] |
+---------------------------------------------------+------------------------------------------------------+
```

#### 5. Mobile Responsive Notes (`375px` Viewport — `SCR-10`)
- `#114` renders the 4 workspace tabs as a horizontally scrollable pill strip; `Dry-Run Resolver` stacks the simulation form above the `PostingRuleResolution` output card.
- `#115` stacks the 6 gate badges in a 2×3 compact grid (`min-h-10`) and renders each `PostingRuleRowDto` as an expandable card (`rowCode + eventKind + Weight badge` header -> determinants, roles, and formula inside). Authoring opens `PostingRuleRowDrawer` full-screen (`w-full h-dvh`).

---

## 5. Consolidated Contract & Inventory Gap List (Input to `P03.T11`)

Per task brief rules, no missing filter, DTO member, or endpoint has been invented in the screen contracts above. Every gap discovered while cross-checking `02_Endpoint_Catalogue.md`, `02_DTOs.md`, `01_ERD/*.md`, and `accounting-screen-inventory.md` is recorded here for `P03.T11`:

| Gap ID | Screen | Affected Artifact / Endpoint | Exact Discrepancy Verified Against Source | Frontend Behaviour Until Resolved | Recommended `P03.T11` Resolution |
| --- | --- | --- | --- | --- | --- |
| `CG-S5-01` | `SCR-08A`, `SCR-08B` | `tenant-portal/docs/plans/accounting-screen-inventory.md` lines 76 & 79 vs `backend/docs/plans/accounting-app-inventory-frontend.md` line 82 | Screen inventory placed `#52`–`#53` (`/accounting/post/bulk-operations`) under `SCR-05` and labelled `#46`–`#47` (`/accounting/post/recurring-entries`) as `SCR-08` (`P03.T09.S5`), whereas backend plan & brief name `SCR-08` = Bulk Operations. Also `#115` note in screen inventory wrote `GET/PATCH /posting-profiles/:id` instead of `:sourceApp`. | Both surfaces are fully specified here as `SCR-08A` (`#52`–`#53`) and `SCR-08B` (`#46`–`#47`), and `#114`/`#115` use `:sourceApp` verbatim. | Split inventory IDs cleanly (`SCR-08` Bulk Operations `#52`–`#53` + `SCR-08R` or dedicated ID for Recurring `#46`–`#47`) and fix `:sourceApp` parameter label in `accounting-screen-inventory.md` during `P03.T12`. |
| `CG-S5-02` | `SCR-07` | `posting-exceptions` (`02_Endpoint_Catalogue.md` §4 lines 284–288) | Unlike `journal-drafts` and `recurring-templates`, `posting-exceptions` has no `POST /accounting/posting-exceptions/count` and no `POST /accounting/posting-exceptions/export` (despite `NO_UNPOSTED_DOCUMENTS` close-audit use). | `#3` displays `meta.total` only on the active tab (no multi-tab count fan-out) and omits an Export button. | Decide in `P03.T11` whether to add `POST /accounting/posting-exceptions/count` (for sidebar/tab badges) and/or `POST /accounting/posting-exceptions/export`. |
| `CG-S5-03` | `SCR-07` | `PostingExceptionSummaryDto` (`02_DTOs.md` §5.3 lines 1244–1255) vs `acc_posting_exceptions` (`02_Ledger_Tables.md` §6) | `PostingExceptionSummaryDto` omits `severity`, `firstSeenAt`, `lastRetryAt`, `errorDetail`, `ownerRole`, `draftId`, `inboxEventId`, `resolution`, and `resultingEntryId`, and `PostingExceptionListQueryDto` lacks `severity` filter despite `idx_acc_posting_exceptions_queue_live` indexing `(company_id, status, severity, deadline_at)`. | `#3` list renders only declared `PostingExceptionSummaryDto` fields; `severity`, `firstSeenAt`, `ownerRole`, `draftId`, `inboxEventId`, and `resolution` render on `#4` Detail (`GET /:id`). | Add `severity`, `firstSeenAt`, `ownerRole`, `resolution`, and `resultingEntryId` to `PostingExceptionSummaryDto` and `severity?: ExceptionSeverity` to `PostingExceptionListQueryDto`. |
| `CG-S5-04` | `SCR-07` | `POST /accounting/posting-exceptions/:id/retry` (`02_DTOs.md` §5.2 vs `02_ledger_posting.md` line 403) | Cross-period re-dating requires an `APPROVED` `POSTING_REDATE` `approvalRequestId`, created as a side-effect commit when the first retry attempt fails with `ACCOUNTING.APPROVAL.REQUIRED`, because Catalogue §10 has no standalone `POST /accounting/approval-requests` route for `POSTING_REDATE`. Does the `ACCOUNTING.APPROVAL.REQUIRED` `ErrorResponseDto.details` return the newly created `approvalRequestId`? | Client queries `GET /api/tenant/accounting/v1/approval-requests` to locate the `POSTING_REDATE` request if `details.approvalRequestId` is absent. | Guarantee `details: { approvalRequestId: UUIDv7, status: 'PENDING' }` on `ACCOUNTING.APPROVAL.REQUIRED` responses from `POST /posting-exceptions/:id/retry`. |
| `CG-S5-05` | `SCR-08A` | `BulkOperationDto` (`02_DTOs.md` §5.2 lines 1221–1228) vs `acc_bulk_operations.retry_of_id` (`02_Ledger_Tables.md` line 1015 & 1047) | `02_Ledger_Tables.md` states the retry command creates a new row with `retry_of_id` and only the failed targets, but `BulkOperationDto` only declares `scopeKind`, `targets`, `operation`, `parameters?`, and `approvals?` (omitting `retryOfId?: UUIDv7`). Because `forbidNonWhitelisted` is enabled, sending `retryOfId` would fail `400`! | Client retries failed targets via `POST /bulk-operations` omitting `retryOfId` until added to `BulkOperationDto`. | Add `@IsOptional() @IsUUID('7') retryOfId?: UUIDv7;` to `BulkOperationDto` in `02_DTOs.md` §5.2. |
| `CG-S5-06` | `SCR-08B` | `RecurringTemplateListQueryDto` (`02_DTOs.md` §5.1 lines 1134–1139) | Query DTO has `journalId?`, `active?: boolean`, `nextRunBefore?`, but lacks `status?: RecurringTemplateStatus` (`ACTIVE \| PAUSED \| COMPLETED`) and `templateKind?: RecurringTemplateKind` (`RECURRING \| ACCRUAL`). | `#46` filter bar uses `active` (`boolean`), `journalId`, and `nextRunBefore` on `GET`, and defers `status`/`templateKind` to `POST /search` only if allowlisted. | Add `status?: RecurringTemplateStatus` and `templateKind?: RecurringTemplateKind` to `RecurringTemplateListQueryDto`. |
| `CG-S5-07` | `SCR-08B` | `GET /accounting/recurring-runs` (`02_Endpoint_Catalogue.md` line 306 & `02_DTOs.md` §5.1) | `02_DTOs.md` §5.1 defines no `RecurringRunListQueryDto`! On `#47` (`/recurring-entries/[id]`), filtering `GET /recurring-runs` to a single `templateId` (or `status`, `fromRunOn`, `toRunOn`) has no documented query DTO contract (`forbidNonWhitelisted` risk if unknown query keys are sent). | Until `RecurringRunListQueryDto` is declared, `#47` calls `GET /recurring-runs` with `FindManyDto` only (or `search` if bound) and warns in code comments; full filterable run history awaits `RecurringRunListQueryDto`. | Declare `RecurringRunListQueryDto extends FindManyDto` with `templateId?: UUIDv7`, `status?: RecurringRunStatus`, `fromRunOn?: ISODate`, `toRunOn?: ISODate` (matching `idx_acc_recurring_runs_template_run_on`). |
| `CG-S5-08` | `SCR-10` | `UpsertPostingProfileDto` (`02_DTOs.md` §12.2 lines 3500–3505) vs `acc_posting_profiles` (`09_Integration_and_Reliability_Tables.md` lines 220–236) | `acc_posting_profiles` stores `default_journal_id` (NOT NULL fallback journal), `inventory_cost_method`, `posting_rule_version_id`, `min_supported_source_version` (`09_integration_and_posting_rules.md` line 236), and `is_active`, yet `UpsertPostingProfileDto` only declares `sourceApp`, `defaultJournalByEvent`, and `cogsRecognition?`! | `PostingProfileEditorDrawer` edits only `defaultJournalByEvent` and `cogsRecognition?`, displays the remaining profile columns read-only, and routes rule-version adoption through `POST /bulk-operations` (`ADOPT_RULE_SET_VERSION`). | Expand `UpsertPostingProfileDto` in `02_DTOs.md` §12.2 to include `defaultJournalId: UUIDv7`, `inventoryCostMethod?: InventoryCostMethod`, `postingRuleVersionId?: UUIDv7`, `minSupportedSourceVersion?: string`, and `isActive?: boolean`. |
| `CG-S5-09` | `SCR-10` | `CreatePostingRuleVersionDto` & `PATCH /posting-rule-versions/:id` & `POST /:id/fork` & `POST /:id/retire` (`02_DTOs.md` §12.2 lines 3507–3545) | `acc_posting_rule_versions` (`09_Integration_and_Reliability_Tables.md` lines 253–269) requires `company_id`, `code`, `name_i18n`, `effective_from`, and optional `effective_to`, yet `CreatePostingRuleVersionDto` in `02_DTOs.md` only lists `rows: PostingRuleRowInput[]` and `comment?: string`! Furthermore, `UpdatePostingRuleVersionDto` (`PATCH /:id`), `ForkPostingRuleVersionDto` (`POST /:id/fork`), and `RetirePostingRuleVersionDto` (`POST /:id/retire`) are not explicitly defined in `02_DTOs.md` §12.2, and `POST /posting-rule-versions/*` uses scope `TENANT` (`Catalogue` lines 1064–1070) so `companyId` must either come from header `x-mutakamel-company-id` or body! | UI collects `code`, `nameI18n`, `effectiveFrom`, `effectiveTo` in state ready for `CreatePostingRuleVersionDto` / `UpdatePostingRuleVersionDto` once `P03.T11` finalizes their DTO shapes, and always sends `x-mutakamel-company-id`. | Define complete DTOs in `02_DTOs.md` §12.2 for `CreatePostingRuleVersionDto` (`companyId`, `code`, `nameI18n`, `effectiveFrom`, `effectiveTo?`, `rows`, `comment?`), `UpdatePostingRuleVersionDto`, `ForkPostingRuleVersionDto`, and `RetirePostingRuleVersionDto`. |
| `CG-S5-10` | `SCR-10` | `POST /accounting/posting-rule-versions/:id/rules` (`02_Endpoint_Catalogue.md` line 1066 & `02_DTOs.md` §12.2) | Catalogue says `"replaces all rows of a DRAFT version"`, and `02_DTOs.md` defines `PostingRuleRowInput`, but does not state whether the request body of `POST /:id/rules` is `{ rows: PostingRuleRowInput[] }` (matching `ValidationPipe` class-DTO object requirement) or a bare top-level array. | Validator/hook isolates the wrapper `{ rows: PostingRuleRowInput[] }` in one typed transport adapter (`postingRuleApi.replaceDraftRows`). | Declare `ReplacePostingRuleRowsDto { @IsArray() @ArrayMinSize(1) @ArrayMaxSize(2000) @ValidateNested({ each: true }) rows!: PostingRuleRowInput[]; }` in `02_DTOs.md` §12.2. |
| `CG-S5-11` | `SCR-10` | `GET /accounting/source-document-links` (`02_Endpoint_Catalogue.md` line 1072 & `02_DTOs.md` §12.1) | No `SourceDocumentLinkListQueryDto` is declared in `02_DTOs.md` §12.1, although `LedgerDrillDrawer` (`accounting-patterns-data.md` line 138) and `#114` Tab 4 need to filter links by `sourceApp`, `sourceType`, `sourceId`, `fiscalDocumentId`, or `postingExceptionId`. | Tab 4 uses `FindManyDto` (`page`, `limit`, `search`) until explicit filter keys are whitelisted. | Declare `SourceDocumentLinkListQueryDto extends FindManyDto` with `sourceApp?`, `sourceType?`, `sourceId?`, `linkKind?`, `fiscalDocumentId?`, `journalEntryId?`, `postingExceptionId?`. |

## Contract reconciliation (P03.T11, 1 November 2026)

Reconciles the gaps of this spec against the Endpoint Catalogue and `02_DTOs.md` after `D-770`, `D-771` and `D-772`. The gap list above keeps the original findings; these rulings are final.

| Gap id | Ruling | Where |
| --- | --- | --- |
| `CG-S5-01` | dropped (not contract) | Inventory split of `SCR-08` and the `:id` versus `:sourceApp` label are an inventory-only correction, not a contract change |
| `CG-S5-02` | dropped | No count or export on posting exceptions; the tab reads `meta.total` from the list |
| `CG-S5-03` | closed by D-770 | `PostingExceptionSummaryDto` gains `severity`, `ownerRole`, `firstSeenAt`; `PostingExceptionListQueryDto` gains `severity?` |
| `CG-S5-04` | already in the contract | `GET /accounting/approval-requests` with `documentType=POSTING_REDATE`, `state=PENDING` and `submittedBy`, matched on `targetId` (`ApprovalRequestListQueryDto`) |
| `CG-S5-05` | duplicate of CG-JRN-04 | Closed by D-771: `BulkOperationDto.retryOfId?` |
| `CG-S5-06` | deferred to stage 5 (P26.T01 definition of ready, P32.T02.S4) | `RecurringTemplateListQueryDto` `status?` and `templateKind?`; recurring templates ship with P26 |
| `CG-S5-07` | deferred to stage 5 (P26.T01 definition of ready) | `RecurringRunListQueryDto { templateId?, status?, fromRunOn?, toRunOn? }` |
| `CG-S5-08` | closed by D-771 | `UpsertPostingProfileDto` gains `defaultJournalId`, `inventoryCostMethod`, `postingRuleVersionId`, `isActive` and `minSupportedSourceVersion` |
| `CG-S5-09` | closed by D-772 | `CreatePostingRuleVersionDto` gains `companyId` (body), `code`, `nameI18n`, `effectiveFrom`, `effectiveTo?`; `UpdatePostingRuleVersionDto` and `ForkPostingRuleVersionDto` are declared; retire and validate take empty bodies |
| `CG-S5-10` | closed by D-772 | `ReplacePostingRuleRowsDto { rows }` for `POST /accounting/posting-rule-versions/:id/rules` |
| `CG-S5-11` | deferred to stage 3 (P22.T01 definition of ready, P32.T02) | `SourceDocumentLinkListQueryDto` for the source-document links tab |
