# Accounting Slice & Stage-4 Completion — Open Items, Settlements, Advances & Subledger Reconciliation (`SCR-23`)

> **Lead review, 1 November 2026 (P03.T10).** Four references were corrected: the two subledger searches are named in full, the integrity monitor is read under `accounting.report.read`, disputes need `accounting.open_item.dispute`, and registering a received certificate needs `accounting.withholding_certificate.create`. Every route, permission, feature key and scope below was checked against `backend/docs/LLD/accounting-app/02_API_Contracts/02_Endpoint_Catalogue.md`, `04_Static_Data/05_Permissions_and_Features.md` and `10_Feature_Tiers.md`; what the contracts lack stays in the contract gap list for `P03.T11`.

- **Plan task:** `P03.T10.S2` — `backend/docs/plans/accounting-app-plan-p03-ux-foundation.md` (`P03.T10`: Slice screen designs beyond stage 1 and the stage-1 admin screen)
- **Target promotion path (Lead pass per `P03.T10.S4`):** `frontend/tenant-portal/docs/design/specs/accounting-slice-open-items-settlements.md`
- **Screen inventory row:** `SCR-23` — *AR/AP Open Items, Settlements, Advances & Subledger Aging Reconciliation* (`frontend/tenant-portal/docs/plans/accounting-screen-inventory.md` §3 Stage 4)
- **Delivery partition (normative):**
  - **`[Slice subset — P19.T08]`** (`19` primary `[P]` endpoints): Routes `#20` `/accounting/post/open-items`, `#21` `/accounting/post/open-items/[id]` (core read + `PATCH` collection fields), `#22` `/accounting/post/settlements` (including `?mode=new` allocation & FX workspace), `#23` `/accounting/post/settlements/[id]` (`confirm`, `unallocate`, `reverse`), and `#60` `/accounting/reconcile/subledgers` (`Aging Report` + `AR/AP Subledger Entries` + `[S]` `SUBLEDGER_EQUALS_CONTROL` integrity banner). Required by the end-to-end Invoice-to-Cash & Purchase-to-Pay slice (`13_Delivery_Plan.md` §3.6, `P19.T08`).
  - **`[Full stage completion — P24.T03]`** (`10` primary `[P]` endpoints): Open-item `dispute`, `resolve-dispute` (`accounting.receivables.credit_control`), `block-dunning`, and `unblock-dunning` (`accounting.receivables.dunning`) actions on `#20`/`#21`; Routes `#24` `/accounting/post/advances` (including `?mode=new`) and `#25` `/accounting/post/advances/[id]` (`apply`, `cancel`); and the **Party Merge Lineage** tab (`GET /accounting/party-merges`) plus `[S]` Party Credit Exposure summary drawer on `#60`.
- **Owning frontend app:** `tenant-portal` (port `5002`, HTTP deployment profile `mutakamel-http-tenant-*` / secure profile `__Host-mutakamel-tenant-*`)
- **Owning backend apps:** `accounting-app` (`/api/tenant/accounting/v1/*`), `core-app` (`/api/tenant/core/v1/*`), `api-gateway-app` (public browser route contract)
- **Last verified against backend LLD & Tenant Portal design system:** `2026-11-01`

**Binding authorities consumed:**
- Backend Accounting LLD (`backend/docs/LLD/accounting-app/`):
  - `01_ERD/05_Subledger_and_Settlement_Tables.md` (§2 group rules, §4 `acc_ar_ledger_entries` & `acc_ap_ledger_entries`, §5 `acc_open_items`, `acc_settlements`, `acc_settlement_allocations`, §5.4 settlement algorithm steps 1–11, §10 `acc_advances` & `acc_advance_applications`, §11 `acc_party_credit_exposures`, §12 `acc_party_merges`, §13 transaction boundaries)
  - `02_API_Contracts/01_Context_Headers_and_Responses.md`, `02_Endpoint_Catalogue.md` (§3 Module 01, §4 Module 02, §6 Module 04, §7 Module 05 lines 573–707, §8 Module 06 lines 708–876, §10 Module 08, §11 Module 09, §12 Cross-module reports lines 1116–1155, §13 Gateway metadata)
  - `04_Static_Data/01_Enums.md` (§2–§6, §13 Module 05 RAP enums, §14 Module 06 Treasury enums, §17 `RetryClass` & `SafeAction`), `02_DTOs.md` (§1–§4, §8 Module 05 DTOs lines 2003–2356, §9.1 Module 06 query DTOs, §11.3 Reporting & Export DTOs lines 3381–3472, §13 Response DTOs & §13.1 entity-projection rules lines 4205–4296), `04_Errors_and_Constants.md` (§3.1–§3.4, §3.9 RAP errors lines 457–510, §3.10 Treasury errors, §3.12 Close/Export errors, §6 `ACCOUNTING_LIMITS` & `ACCOUNTING_INTEGRITY_CHECK_CODES`), `05_Permissions_and_Features.md` (§4.1, §4.2, §4.5, §4.6, §4.7, §5)
  - `05_Flows/06_User_Journey_Invoice_To_Cash.md` (`CASH-01`..`CASH-13`), `07_User_Journey_Purchase_To_Payment.md` (`PAY-01`..`PAY-13`), `08_User_Journey_Month_Close.md` (`CLOSE-07`, `CLOSE-11`, `CLOSE-12`), `10_User_Journey_Failure_Recovery.md`, `11_Journey_Coverage_Matrix.md` (`SCN-007`, `SCN-010`, `SCN-012`, `SCN-015`, `SCN-035`..`SCN-041`, `SCN-051`, `SCN-057`..`SCN-065`, `SCN-075`..`SCN-082`, `SCN-095`)
  - `07_Modules/10_MVP/05_receivables_and_payables.md` (§1–§19, rules 1–11, validation matrix `VAL-RAP-01`..`VAL-RAP-43`), `10_Feature_Tiers.md` (§3–§5, §11 UI rule), `13_Delivery_Plan.md` (§3.6, §6.7.2)
- Tenant Portal Design System & Approved `P03` UX Foundation Specs (`frontend/tenant-portal/`):
  - `docs/design/{README,DESIGN-SYSTEM,tokens,typography,primitives,patterns,views,states,accessibility,i18n,anti-patterns,enforcement}.md`
  - `docs/architecture/{data-layer,file-architecture,security-headers}.md`
  - `docs/plans/accounting-screen-inventory.md` (`SCR-23`, `SCR-04`, `SCR-06`, `SCR-12`, `SCR-16`, `SCR-18`, `SCR-24`, `SCR-25`, `SCR-26`, `SCR-27`, `SCR-35`, `SCR-40`)
  - `docs/design/specs/{accounting-ia,accounting-home,accounting-status-and-a11y,accounting-patterns-data,accounting-patterns-workflow,accounting-patterns-documents,accounting-stage1-journals,accounting-stage1-reports-plan}.md`

---

## 0. `ui-ux-pro-max` Intelligence, Five-Laws Governance & `< 300`-Line Architecture

Before specifying `SCR-23`, the `ui-ux-pro-max` and `frontend-design` guidelines for high-density B2B financial subledger reconciliation, multi-invoice allocation grids, and foreign-exchange settlement workflows were applied alongside the five non-negotiable Tenant Portal laws (`docs/design/README.md`):

1. **Exact Decimal & FX Fidelity (`DecimalString` + Integer-Scaled `BigInt(10^8)`):**
   - Browser code **never** calls `Number()`, `parseFloat()`, or `toFixed()` on `DecimalString` (`numeric(24,8)`) or `FxRateString` (`numeric(24,12)`), and **never** multiplies `amountTxn × fxRate` in JavaScript (`accounting-patterns-data.md` §0 rule 1, `CG-DATA-04`).
   - In the Settlement Allocation Workspace (`#22?mode=new`) and Advance Application Workspace (`#25`), live client-side allocation math parses validated `DecimalString` strings into exact `10^8`-scaled `BigInt` integers (`parseScaledBigInt8` / `formatScaledBigInt8` from `UX-06` `useScaledDecimalBalance`) to compute same-currency `allocatedTxn`, `unallocatedTxn = totalAmount - allocatedTxn`, and per-item `remainingAfterAllocation = remainingAmount - (amountTxn + sum(withholdingsForItem))` with **zero floating-point drift**.
   - Functional-currency equivalents (`totalAmountFunctional`, `amountFunctionalAtEntryRate`, `amountFunctionalAtSettlementRate`) and `realizedFxDifference` are **100% server-authoritative** (`D-010`, `D-407`). Before posting a foreign-currency settlement, the workspace shows the item's pinned `entryFxRate` side-by-side with the resolved settlement-date rate from `<FxRateStrip>` (`POST /accounting/fx-rates/resolve`) and labels functional gain/loss as *"Computed on post at pinned entry vs settlement rate"* rather than approximating `HALF_UP` in browser JS.
2. **Zero Client-Side Grid Footers on Paginated Lists (`CG-DATA-01`):**
   - Open Items (`#20`), Settlements (`#22`), Advances (`#24`), and Subledger Entries (`#60` Tab 2) **never** sum `remainingAmount` or `amountTxn` across the currently loaded page (`1..500` rows), because keyset/offset pages are partial slices and multi-currency rows cannot be added without FX conversion. Authoritative company/party totals are rendered only on the server-computed Aging Report (`GET /accounting/reports/aging` on `#60` Tab 1) and Party Ledger (`GET /accounting/reports/party-ledger` on `#72`).
3. **UUIDv7 Idempotency Lifecycle (`D-768`) & HTTP Safe Generation:**
   - Every mutating command (`PATCH /open-items/:id`, `POST /open-items/export`, `POST /open-items/:id/{dispute,resolve-dispute,block-dunning,unblock-dunning}`, `POST /settlements`, `POST /settlements/:id/{unallocate,reverse,confirm}`, `POST /advances`, `POST /advances/:id/{apply,cancel}`) generates one UUIDv7 `x-idempotency-key` per user intent via `generateUUIDv7()` (`src/lib/uuid.ts`; `crypto.randomUUID()` is unconditionally banned because Tenant Portal runs over HTTP on port `5002`).
   - **Transport ambiguity (`CLIENT_REQUEST_TIMEOUT`, `502`/`503`/`504`)** opens `<AmbiguousOutcomePanel>` and retries with the **exact same** `x-idempotency-key` (`24 h` server TTL). Starting a fresh export run after a previous `202` `ExportRunSummaryDto` reaches terminal `FAILED` generates a **new** UUIDv7 key (`D-768`).
4. **Optimistic Concurrency (`ETag` / `If-Match`):**
   - Every detail read (`GET /open-items/:id`, `GET /settlements/:id`, `GET /advances/:id`) captures strong `ETag: "<version>"`. Every state/metadata command sends `If-Match: "<version>"`. On `409 ACCOUNTING.CONCURRENCY.STALE_VERSION`, `<ConflictDialog>` refetches the fresh row and displays field-by-field diffs (`settledAmount`, `remainingAmount`, `status`, `disputeStatus`, `dunningBlockReason`, `confirmedAt`, `reversedAt`) before the user re-confirms.
5. **Four Semantic Outcome Roles, Three Font Weights & Single Primary CTA:**
   - Chromatic hues are strictly `positive`, `caution`, `negative`, and `neutral` (`ink`), with `brand` reserved for focus rings and the **single** `variant="primary"` button per screen (`PageHeader` or `DetailHeader`). Neither `SubledgerSide` (`AR`/`AP`), nor `OpenItemOrigin`, nor `SettlementInstrumentType`, nor aging bucket index (`Current`, `1–30`, `31–60`, `61–90`, `>90`) is ever assigned decorative rainbow colors (`anti-patterns.md`).
   - Font weights are exclusively `400` (`font-normal`, mandatory on every `DataTable` / `AccountingLedgerGrid` `<td>` cell), `500` (`font-medium`), and `600` (`font-semibold`). Minimum type size is `text-xs` (`12px` / `0.75rem`); no `font-bold`, no `text-[Npx]`, no `rounded-xl`+.
6. **Logical RTL/LTR Parity, Bilingual Dictionaries & Q14 Raw-UUID Discipline:**
   - Only logical Tailwind properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `text-end`, `border-s-*`, `border-e-*`) are permitted (`pnpm design:rtl` = `0`). Zero language ternaries (`locale === 'ar' ? ... : ...`) in `.tsx` or hooks.
   - Numbers and dates format via `Intl` with Western digits (`0-9`) in both `ar-EG-u-nu-latn` and `en-US` (`typography.md`). Every UUID, document/entry code, cursor, ETag, and SHA-256 hash renders inside `<IdentifierText>` (`<bdi dir="ltr" className="font-mono tabular-nums">`).
   - Per `patterns.md` Q14 and `CG-RAP-05`, where a summary/detail DTO returns `partyId`, `fiscalDocumentId`, `journalEntryId`, or `instrumentRef` without a joined human label, the UI resolves cached party labels via `PartyPicker` (`POST /accounting/party-finance-profiles/lookup` + Core party cache) where authorized and otherwise renders `<IdentifierText>` as a deep link — never fabricating `"Customer #1"` or `"INV-???"`.

### 0.1 Shared Theme Token Mapping (Applied Across All Four ASCII Combinations)

| Surface / Semantic Element | Light (`html:not(.dark)`) | Dark (`html.dark`) | Contrast & Non-Color Cue (`WCAG 2.2 AA`) |
| --- | --- | --- | --- |
| App canvas / Surface card / Sticky allocation bar | `bg-background` (`--ink-50`) / `bg-card` (`--ink-0`) / `bg-muted/90` | `bg-background` (`--ink-950`) / `bg-card` (`--ink-900`) / `bg-muted/90` | Body text `text-foreground >= 12:1`; `border-border >= 3:1` |
| Settled / Confirmed / Integrity `PASSED` / Fully allocated | `bg-positive-subtle border-positive-border text-positive-foreground` | `bg-positive-subtle border-positive-border text-positive-foreground` | Check icon + localized status text (`>= 4.5:1`) |
| Partially settled / Provisional / Unapplied remainder / `MANUAL` dunning block | `bg-caution-subtle border-caution-border text-caution-foreground` | `bg-caution-subtle border-caution-border text-caution-foreground` | Clock or warning triangle icon + status text (`>= 4.5:1`) |
| Disputed (`OPEN`/`ESCALATED`) / Over-allocated / Integrity `FAILED` / `LEGAL` block | `bg-negative-subtle border-negative-border text-negative-foreground` | `bg-negative-subtle border-negative-border text-negative-foreground` | Alert octagon / shield icon + explicit cause (`>= 4.5:1`) |
| Open (not overdue) / Written off / Reversed / Cancelled / Merged lineage | `bg-muted border-border text-muted-foreground` | `bg-muted/60 border-border text-muted-foreground` | Neutral circle / strikethrough-ref badge + status text (`>= 4.5:1`) |
| Primary CTA (`1` per screen) & keyboard focus ring | `bg-brand text-brand-foreground` / `focus-visible:ring-2 focus-visible:ring-ring` | `bg-brand text-brand-foreground` / `focus-visible:ring-2 focus-visible:ring-ring` | `>= 4.5:1` label contrast; `2px` ring `>= 3:1` on `>= 24×24px` target (`44×44px` touch) |

### 0.2 Reused `@/design-system` & `P03` Foundation Components (Zero Redesign)

| Layer | Reused Components & Hooks |
| --- | --- |
| `@/design-system` Barrel | `PageHeader`, `DetailHeader`, `DetailSection`, `WorkspaceLayout`, `FilterBar`, `DataTable` (`density="compact"`, `36px` row height), `Tabs`, `Card`, `DescriptionList`, `StatusBadge`, `Badge`, `Button`, `FormField`, `Select`, `DatePicker`, `Checkbox`, `Textarea`, `FormDrawer`, `FormModal`, `ConfirmActionModal`, `ReasonDialog`, `ConflictDialog`, `AmbiguousOutcomePanel`, `EmptyState`, `ErrorState`, `NotFoundState`, `Skeleton`, `PermissionGate`, `ReadOnlyGate`, `Callout`, `Tooltip`, `Timeline`, `AttachmentList`, `useRealtimeResync` |
| `P03.T04` Status & A11y (`accounting-status-and-a11y.md`) | `<AccountingStatusBadge>` for `OpenItemStatus`, `DisputeStatus`, `AdvanceStatus`, and derived Settlement status (`t.accounting.derivedStatus.settlement.*`); `<IdentifierText>` (`<bdi dir="ltr">`); `tabular-nums` alignment rules |
| `P03.T05` Data Patterns (`accounting-patterns-data.md`) | `UX-05` `<AccountingLedgerGrid>` (virtualized keyset cursor grid for Open Items `limit <= 500` & Subledger Entries); `UX-07` `<MoneyInput>`, `<AccountingMoneyCell>`, `<FxRateStrip>`; `UX-08b` `<PartyPicker>`; `UX-08c` `<FiscalPeriodPicker>`; `UX-12` `<AccountingReportViewer>` (for `#60` Aging Report with `asOf` / `asOfChainSeq` freshness banner) |
| `P03.T06` Workflow Patterns (`accounting-patterns-workflow.md`) | `UX-06` `parseScaledBigInt8` / `formatScaledBigInt8` exact integer-scaled decimal arithmetic; `<PostingReceiptBanner>` (`entryNo`, `chainSeq`, `entryHash`, `periodId`, `originalPeriodId`); `UX-13` `useAsyncJobPoller` + `<AccountingJobTrayDrawer>` (for `202` `POST /accounting/open-items/export`) |
| `P03.T07` Document & Boundary Patterns (`accounting-patterns-documents.md`) | `<WaitingStateBadge>` & `<WaitingStateCallout>` (`Zero-Resend Law`); `<AccountingErrorAlert>` (`useAccountingErrorModel`: `Cause + Effect + SafeAction + correlationId`); `<AccountingBoundaryGate>` (`useAccountingBoundaryGate`: entitlement, `403`, `404`, `RECOVERY_MODE`, `ARCHIVED`) |

### 0.3 `< 300`-Line File & Custom Hook Split (`src/features/accounting/open-items-settlements/`)

Per `docs/architecture/file-architecture.md`, every `.ts` hook and `.tsx` view component stays strictly under `300` lines with zero logic inside `.tsx` files:

| Route / Sub-feature | Custom Logic Hooks (`hooks/*.ts` — state, queries, `BigInt` math, mutations) | Pure View Components (`components/*.tsx` — markup & logical Tailwind classes only) |
| --- | --- | --- |
| `#20` Open Items List (`[Slice]` + `[P24.T03]` row badges/actions) | `useOpenItemsList.ts`, `useOpenItemsCount.ts`, `useOpenItemsExport.ts` | `OpenItemsListScreen.tsx`, `OpenItemsFilterBar.tsx`, `OpenItemsGridColumns.tsx` |
| `#21` Open Item Detail (`[Slice]` + `[P24.T03]` dispute/dunning modals) | `useOpenItemDetail.ts`, `useOpenItemSubledgerTrace.ts`, `useOpenItemDisputeActions.ts` (`[P24.T03]`), `useOpenItemDunningBlockActions.ts` (`[P24.T03]`) | `OpenItemDetailScreen.tsx`, `OpenItemTermsSnapshotCard.tsx`, `OpenItemSubledgerTraceTable.tsx`, `OpenItemDisputeModal.tsx` (`[P24.T03]`), `OpenItemDunningBlockModal.tsx` (`[P24.T03]`) |
| `#22` Settlements List & `?mode=new` Workspace (`[Slice]`) | `useSettlementsList.ts`, `useCreateSettlementWorkspace.ts`, `useSettlementAllocationMath.ts`, `useSettlementInstrumentPicker.ts` | `SettlementsScreen.tsx`, `SettlementsFilterBar.tsx`, `CreateSettlementWorkspace.tsx`, `SettlementInstrumentFields.tsx`, `SettlementCandidateItemsGrid.tsx`, `SettlementWithholdingsRepeater.tsx`, `SettlementAllocationStickyBar.tsx` |
| `#23` Settlement Detail (`[Slice]`) | `useSettlementDetail.ts`, `useSettlementAllocations.ts`, `useSettlementLifecycleActions.ts` (`confirm`, `unallocate`, `reverse`) | `SettlementDetailScreen.tsx`, `SettlementAllocationsTable.tsx`, `SettlementCompanionTreeCard.tsx`, `UnallocateSettlementModal.tsx`, `ReverseSettlementModal.tsx`, `ConfirmProvisionalModal.tsx` |
| `#24` & `#25` Advances List, Create & Detail (`[P24.T03]`) | `useAdvancesList.ts`, `useCreateAdvanceForm.ts`, `useAdvanceDetail.ts`, `useApplyAdvanceWorkspace.ts` | `AdvancesScreen.tsx`, `CreateAdvanceDrawer.tsx`, `AdvanceDetailScreen.tsx`, `ApplyAdvanceWorkspaceCard.tsx`, `AdvanceRefundGuidanceCard.tsx` |
| `#60` Subledger & Aging Reconciliation (`[Slice]` + `[P24.T03]` merges/exposure) | `useSubledgerReconcileWorkspace.ts`, `useAgingReportQuery.ts`, `useSubledgerEntriesGrid.ts`, `useSubledgerIntegrityVerdict.ts`, `usePartyMergesLineage.ts` (`[P24.T03]`), `usePartyExposureDrawer.ts` (`[P24.T03]`) | `SubledgerReconcileScreen.tsx`, `SubledgerIntegrityBanner.tsx`, `AgingReportTab.tsx`, `SubledgerEntriesTab.tsx`, `PartyMergesLineageTab.tsx` (`[P24.T03]`), `PartyExposureQuickDrawer.tsx` (`[P24.T03]`) |

---

## 1. Route Allowlist, Delivery Partition & Cross-Screen Boundaries

### 1.1 Allowlisted Routes Owned by `SCR-23` (`accounting-ia.md` §5)

Per `accounting-ia.md` §5 (`FE-02` route allowlist), `SCR-23` owns **seven** canonical Next.js routes. Creation flows on `#22` and `#24` use query state (`?mode=new`) on the list route rather than inventing unlisted `/new` static segments:

| IA # | Canonical Route (`TENANT_ROUTES`) | Nav Group (`accounting-ia.md` §2) | Delivery Stage | Primary Purpose |
| --- | --- | --- | --- | --- |
| `#20` | `/accounting/post/open-items` (`accountingOpenItems`) | `2. Post` (`post`) | **`[Slice subset — P19.T08]`** *(+ dispute/dunning row actions in `[P24.T03]`)* | AR/AP Open Items explorer (`L`, `S`, `C`, async `X`), side switcher (`AR` \| `AP`), due/overdue/dispute/dunning filters, keyset paging up to `500` rows |
| `#21` | `/accounting/post/open-items/[id]` (`accountingOpenItemDetail(id)`) | `2. Post` (`post`) | **`[Slice subset — P19.T08]`** *(+ `dispute`, `resolve-dispute`, `block-dunning`, `unblock-dunning` in `[P24.T03]`)* | Single open-item claim/credit detail: origin trace, frozen `paymentTermsSnapshot`, discount window, subledger/allocation FX audit trail, collection/dispute/dunning actions |
| `#22` | `/accounting/post/settlements` (`accountingSettlements`) + `?mode=new` | `2. Post` (`post`) | **`[Slice subset — P19.T08]`** | Settlements list (`L`, `S`) and `?mode=new` Single/Multi-Item Allocation, Early-Payment Discount, AR Withholding Companion & Foreign-Currency Realized FX Workspace (`POST /accounting/settlements`) |
| `#23` | `/accounting/post/settlements/[id]` (`accountingSettlementDetail(id)`) | `2. Post` (`post`) | **`[Slice subset — P19.T08]`** | Settlement detail (`G` + `ETag`), append-only allocations table (`GET /:id/allocations`), provisional cheque `confirm`, partial/full `unallocate`, and whole-set `reverse` |
| `#24` | `/accounting/post/advances` (`accountingAdvances`) + `?mode=new` | `2. Post` (`post`) | **`[Full stage completion — P24.T03]`** | Customer (`AR`) and supplier (`AP`) advances list (`L`) + `?mode=new` Create Advance drawer (`DEPOSIT`, `PREPAYMENT_INVOICE`, `RETAINER`) |
| `#25` | `/accounting/post/advances/[id]` (`accountingAdvanceDetail(id)`) | `2. Post` (`post`) | **`[Full stage completion — P24.T03]`** | Advance detail (`G` + `ETag`), receipt-source waiting state (`journalEntryId === null`), multi-item `apply` workspace (`POST /:id/apply`), refund cross-links, and unfunded `cancel` |
| `#60` | `/accounting/reconcile/subledgers` (`accountingReconcileSubledgers`) | `3. Reconcile` (`reconcile`) | **`[Slice subset — P19.T08]`** (`Aging` + `AR/AP Subledger Entries` + `Integrity Verdict`) + **`[Full stage completion — P24.T03]`** (`Party Merges` + `Exposure` drawer) | Subledger-to-control reconciliation workspace (`CLOSE-11`/`CLOSE-12`), interactive AR/AP Aging Report (`GET /accounting/reports/aging`), append-only `ar-entries` & `ap-entries`, and `party-merges` lineage |

> **Slice Build Guard (`P19.T08` vs `P24.T03`):** During `P19.T08`, sidebar link `#24` (`Advances`), the `Dispute` / `Block Dunning` action buttons on `#20`/`#21`, and Tab 3 (`Party Merges`) + Exposure drawer on `#60` are withheld behind the Stage-4 completion boundary (`P24.T03`), **never** rendered as dead buttons or simulated mocks. Once `P24.T03` lands, those surfaces activate under their exact feature keys (`accounting.receivables.core`, `accounting.receivables.credit_control`, `accounting.receivables.dunning`).

### 1.2 Strict Cross-Screen Ownership Boundaries (No Duplicate Ownership)

| Adjacent Inventory Row | Route(s) | Exact Handoff Contract with `SCR-23` |
| --- | --- | --- |
| `SCR-06` Posted Journal Entry Detail | `#15` `/accounting/post/journal-entries/[id]` | Every `journalEntryId`, `confirmationEntryId`, and `reversalEntryId` on `#21`, `#23`, `#25`, and `#60` renders as an `<IdentifierText>` deep link to `#15`. `SCR-23` never embeds a second full journal-entry viewer. |
| `SCR-12` Core Ledger & Party Reports | `#70` `/accounting/reports/trial-balance`, `#72` `/accounting/reports/party-ledger` | `GET /accounting/reports/party-ledger` (`PartyLedgerQueryDto`) is `[P]` on `SCR-12` (`#72`) and `[S]` on `SCR-23` (`#60`). `#60` provides a one-click **"Open Party Ledger (`BALANCE_FORWARD`)"** handoff pre-seeded with `{ side, partyId, fromDate, toDate, statementStyle: 'BALANCE_FORWARD' }`, while `GET /accounting/reports/aging` is `[P]` on `SCR-23` (`#60` Tab 1). |
| `SCR-16` Withholding Certificates | `#46` `/accounting/file/withholding-certificates` | Provisional `AR` `WITHHOLDING_CERTIFICATE` companion settlements are **never** confirmed via `POST /settlements/:id/confirm` (`VAL-RAP-39`); `#23` disables/omits `Confirm` on `WITHHOLDING_CERTIFICATE` and links directly to `#46` (`SCR-16`), where registering the customer's certificate confirms the provisional settlement and posts `Dr ADVANCE_INCOME_TAX / Cr WHT_RECEIVABLE_UNCERTIFIED`. |
| `SCR-18` Fiscal Documents | `#17` `/accounting/post/documents/[id]` | Every non-null `fiscalDocumentId` on `#20`, `#21`, `#24`, `#25`, and `#60` links to `#17`. Prepayment invoices (`AdvanceKind.PREPAYMENT_INVOICE`) are registered on `#16`/`#17` first and selected in `#24?mode=new`. |
| `SCR-24` Credit Control, Dunning, Statements, Netting & Write-Offs | `#80`..`#95` | Payment terms, dunning procedures/runs, customer statements, bilateral `NETTING` (`#86`/`#87`), bad-debt `WRITE_OFF` (`#88`/`#89`), credit holds (`#90`), promises-to-pay (`#91`), payment plans (`#92`/`#93`), and full exposure list (`#94`/`#95`) belong to `SCR-24`. On `#23`, reversing a `NETTING` or payment-plan `OFFSET` settlement is refused by contract (`VAL-RAP-37`); the UI replaces `Reverse` with a direct link to `#87` (`/accounting/collections/nettings/[id]`) or `#93` (`/accounting/collections/payment-plans/[id]`). |
| `SCR-25` Treasuries & Custodies | `#26`..`#30` | `CUSTODY` settlements are created only by `POST /accounting/custodies/:id/settle` (`#30`) and can never be created, unallocated, or reversed on `#22`/`#23` (`VAL-RAP-37`, `VAL-RAP-42`). `#23` displays a read-only link to `#30` (`/accounting/post/custodies/[instrumentRef]`). |
| `SCR-26` Payments, Payment Runs & Cheques/PDC | `#31`..`#39` | `CHEQUE` settlements are created only by `POST /accounting/instruments` (`#38` on `SCR-26`), never by `CreateSettlementDto` (`VAL-RAP-42`). Unfunded advances (`journalEntryId === null`) and `AR` customer advance refunds link to `#31`/`#38` on `SCR-26` with `?advanceId=<id>`. |
| `SCR-27` Bank Reconciliation | `#54`..`#57` | Bank statement matching (`POST /bank-statements/:id/lines/:lineId/match`) lives on `SCR-27`; matched bank settlements open `#23` for allocation inspection. |
| `SCR-35` Export Runs & Snapshots | `#74` `/accounting/reports/exports` | `POST /accounting/open-items/export` (`202` + `Location`) polls via `UX-13` `<AccountingJobTrayDrawer>` (`GET /accounting/exports/runs/:id` + `/download`) and links to `#74`. |
| `SCR-40` Integrity Checks | `#61` `/accounting/reconcile/integrity` | `GET /accounting/integrity-checks/latest` is `[P]` on `SCR-40` and `[S]` on `#60` (`SCR-23`) to display the live `SUBLEDGER_EQUALS_CONTROL` verdict banner with a deep link to `#61`. |

---

## 2. Verbatim Endpoint, RBAC, Entitlement, Scope, Idempotency & Concurrency Matrix

Every row below is copied verbatim from `02_API_Contracts/02_Endpoint_Catalogue.md` (§7 Module 05 lines 604–707, §8 Module 06, §10 Module 08, §11 Module 09, §12 Cross-module reports lines 1152–1154) and `04_Static_Data/05_Permissions_and_Features.md`. Browser calls use `/api/tenant/accounting/v1/<controller-subpath>` via `src/lib/api/axiosClient.ts` with `x-mutakamel-company-id` (and `x-mutakamel-branch-id` when branch-scoped).

### 2.1 `[Slice subset — P19.T08]` Primary (`[P]`) Endpoints (`19` Endpoints)

| # | Method | Browser Gateway Path (`/api/tenant/accounting/v1/...`) | Catalogue Controller Path | Permission (`ALL` unless noted) | Feature Key | Scope Target | Idempotency | Concurrency | Status, Headers & Response Projection | Primary UI Surface |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S-01 | `GET` | `/api/tenant/accounting/v1/open-items` | `/accounting/open-items` | `accounting.open_item.read` | `accounting.receivables.core` | `COMPANY_OR_BRANCH` | `none` | `none` | `200`; `limit` `1..500` (`MAX_LEDGER_PAGE_SIZE`); `OpenItemSummaryDto[]` + keyset `pageInfo` / `meta` | `#20` Open Items List & `#22?mode=new` Candidate Picker |
| S-02 | `POST` | `/api/tenant/accounting/v1/open-items/search` | `/accounting/open-items/search` | `accounting.open_item.read` | `accounting.receivables.core` | `COMPANY_OR_BRANCH` | `none` | `none` | `200`; `OpenItemSummaryDto[]` (`OpenItemSearchDto` filter tree <= `20` leaves, depth `3`) | `#20` Advanced Filter Tree & `#22?mode=new` Search |
| S-03 | `POST` | `/api/tenant/accounting/v1/open-items/count` | `/accounting/open-items/count` | `accounting.open_item.read` | `accounting.receivables.core` | `COMPANY_OR_BRANCH` | `none` | `none` | `200`; `CountResultDto` (`{ count: number }`) | `#20` Filter Bar Live Match Badge |
| S-04 | `GET` | `/api/tenant/accounting/v1/open-items/:id` | `/accounting/open-items/:id` | `accounting.open_item.read` | `accounting.receivables.core` | `COMPANY_OR_BRANCH` | `none` | `none` | `200` + `ETag: "<version>"`; `OpenItemDetailDto` (§13.1 `acc_open_items` projection) | `#21` Open Item Detail & `#22?mode=new` Selected Row Terms Enrichment |
| S-05 | `PATCH` | `/api/tenant/accounting/v1/open-items/:id` | `/accounting/open-items/:id` | `accounting.open_item.update` | `accounting.receivables.core` | `COMPANY_OR_BRANCH` | `x-idempotency-key` | `If-Match` | `200`; dunning and collection fields only; amounts are never patched *(see `CG-RAP-01`)* | `#21` Edit Collection Fields Drawer *(gated on `CG-RAP-01`)* |
| S-06 | `POST` | `/api/tenant/accounting/v1/open-items/export` | `/accounting/open-items/export` | `accounting.open_item.export` | `accounting.receivables.core` | `COMPANY` | `x-idempotency-key` | `none` | `202` + `Location` (`/accounting/exports/runs/:id`); `ExportRunSummaryDto` | `#20` Export (`CSV` / `XLSX`) -> `UX-13` Job Tray |
| S-07 | `GET` | `/api/tenant/accounting/v1/subledger/ar-entries` | `/accounting/subledger/ar-entries` | `accounting.open_item.read` | `accounting.receivables.core` | `COMPANY_OR_BRANCH` | `none` | `none` | `200`; `ArLedgerEntrySummaryDto[]` (§13.1 `acc_ar_ledger_entries` projection) | `#60` Tab 2 (`AR` Subledger) & `#21` `AR` Subledger Trace |
| S-08 | `POST` | `/api/tenant/accounting/v1/subledger/ar-entries/search` | `/accounting/subledger/ar-entries/search` | `accounting.open_item.read` | `accounting.receivables.core` | `COMPANY_OR_BRANCH` | `none` | `none` | `200`; `ArLedgerEntrySummaryDto[]` | `#60` Tab 2 (`AR` Advanced Filter) & `#21` `openItemId` Filter |
| S-09 | `GET` | `/api/tenant/accounting/v1/subledger/ap-entries` | `/accounting/subledger/ap-entries` | `accounting.open_item.read` | `accounting.payables.core` | `COMPANY_OR_BRANCH` | `none` | `none` | `200`; `ApLedgerEntrySummaryDto[]` (§13.1 `acc_ap_ledger_entries` projection) | `#60` Tab 2 (`AP` Subledger) & `#21` `AP` Subledger Trace |
| S-10 | `POST` | `/api/tenant/accounting/v1/subledger/ap-entries/search` | `/accounting/subledger/ap-entries/search` | `accounting.open_item.read` | `accounting.payables.core` | `COMPANY_OR_BRANCH` | `none` | `none` | `200`; `ApLedgerEntrySummaryDto[]` | `#60` Tab 2 (`AP` Advanced Filter) & `#21` `openItemId` Filter |
| S-11 | `GET` | `/api/tenant/accounting/v1/settlements` | `/accounting/settlements` | `accounting.settlement.read` | `accounting.receivables.core` | `COMPANY_OR_BRANCH` | `none` | `none` | `200`; `SettlementSummaryDto[]` + `meta` / keyset `cursor` | `#22` Settlements List |
| S-12 | `POST` | `/api/tenant/accounting/v1/settlements/search` | `/accounting/settlements/search` | `accounting.settlement.read` | `accounting.receivables.core` | `COMPANY_OR_BRANCH` | `none` | `none` | `200`; `SettlementSummaryDto[]` | `#22` Settlements Advanced Search |
| S-13 | `GET` | `/api/tenant/accounting/v1/settlements/:id` | `/accounting/settlements/:id` | `accounting.settlement.read` | `accounting.receivables.core` | `COMPANY_OR_BRANCH` | `none` | `none` | `200` + `ETag: "<version>"`; `SettlementDetailDto` (§13.1 `acc_settlements` projection) | `#23` Settlement Detail |
| S-14 | `GET` | `/api/tenant/accounting/v1/settlements/:id/allocations` | `/accounting/settlements/:id/allocations` | `accounting.settlement.read` | `accounting.receivables.core` | `COMPANY_OR_BRANCH` | `none` | `none` | `200`; append-only `SettlementAllocationSummaryDto[]` (`entryFxRate`, `settlementFxRate`, `realizedFxDifference`, `reversalOfAllocationId`) | `#23` Allocations & Realized FX Table |
| S-15 | `POST` | `/api/tenant/accounting/v1/settlements` | `/accounting/settlements` | `accounting.settlement.create` | `accounting.receivables.core` | `COMPANY_OR_BRANCH` | `x-idempotency-key` | `none` | `201` + `Location` + chain headers (`X-Accounting-Chain-Seq`, `X-Accounting-Entry-No`, `X-Accounting-Period`); `SettlementDetailDto` + nested `PostingReceiptDto` | `#22?mode=new` Post Settlement CTA |
| S-16 | `POST` | `/api/tenant/accounting/v1/settlements/:id/unallocate` | `/accounting/settlements/:id/unallocate` | `accounting.settlement.unallocate` | `accounting.receivables.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` + chain headers; appends negative allocation row(s), reopens open item(s), creates/grows `UNAPPLIED_SETTLEMENT` | `#23` Unallocate Modal |
| S-17 | `POST` | `/api/tenant/accounting/v1/settlements/:id/reverse` | `/accounting/settlements/:id/reverse` | `accounting.settlement.reverse` | `accounting.receivables.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` + chain headers; reverses whole settlement set + storno/swap entry *(body `ReverseSettlementDto { reason, reversalDate? }`, `D-772`)* | `#23` Reverse Settlement Modal |
| S-18 | `POST` | `/api/tenant/accounting/v1/settlements/:id/confirm` | `/accounting/settlements/:id/confirm` | `accounting.settlement.confirm` | `accounting.receivables.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200`; confirms provisional `CHEQUE` settlement only *(never `WITHHOLDING_CERTIFICATE`, `VAL-RAP-39`; see `CG-RAP-02`)* | `#23` Confirm Provisional Cheque Modal |
| S-19 | `GET` | `/api/tenant/accounting/v1/reports/aging` | `/accounting/reports/aging` | `accounting.report.read` | `accounting.receivables.core` | `COMPANY_OR_BRANCH` | `none` | `none` | `200`; `AgingQueryDto` -> `AgingReportDto` (party rows, per-currency totals, `asOf` / `asOfChainSeq`, `D-772`) | `#60` Tab 1 (`AR/AP Aging Report`) |

### 2.2 `[Full stage completion — P24.T03]` Primary (`[P]`) Endpoints (`10` Endpoints)

| # | Method | Browser Gateway Path (`/api/tenant/accounting/v1/...`) | Catalogue Controller Path | Permission | Feature Key | Scope Target | Idempotency | Concurrency | Status, Headers & Response Projection | Primary UI Surface |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F-20 | `POST` | `/api/tenant/accounting/v1/open-items/:id/dispute` | `/accounting/open-items/:id/dispute` | `accounting.open_item.dispute` | `accounting.receivables.credit_control` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200`; `OpenDisputeDto` (`OPEN` \| `ESCALATED`, `disputeReason`, `blockDunning?`) -> `OpenItemDetailDto` | `#21` & `#20` Open / Escalate Dispute Modal |
| F-21 | `POST` | `/api/tenant/accounting/v1/open-items/:id/resolve-dispute` | `/accounting/open-items/:id/resolve-dispute` | `accounting.open_item.dispute` | `accounting.receivables.credit_control` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200`; `ResolveDisputeDto` (`note` `10..1000` chars) -> `OpenItemDetailDto` | `#21` & `#20` Resolve Dispute Modal |
| F-22 | `POST` | `/api/tenant/accounting/v1/open-items/:id/block-dunning` | `/accounting/open-items/:id/block-dunning` | `accounting.open_item.block_dunning` | `accounting.receivables.dunning` | `COMPANY_OR_BRANCH` | `x-idempotency-key` | `If-Match` | `200`; `BlockDunningDto` (`reason: 'MANUAL' \| 'LEGAL'`, `note?`) -> `OpenItemDetailDto` | `#21` & `#20` Block Dunning Modal |
| F-23 | `POST` | `/api/tenant/accounting/v1/open-items/:id/unblock-dunning` | `/accounting/open-items/:id/unblock-dunning` | `accounting.open_item.unblock_dunning` | `accounting.receivables.dunning` | `COMPANY_OR_BRANCH` | `x-idempotency-key` | `If-Match` | `200`; empty body (`{}`); clears `MANUAL` or `LEGAL` only (`VAL-RAP-38`) -> `OpenItemDetailDto` | `#21` & `#20` Unblock Dunning Confirm Modal |
| F-24 | `GET` | `/api/tenant/accounting/v1/advances` | `/accounting/advances` | `accounting.advance.read` | `accounting.receivables.core` | `COMPANY` | `none` | `none` | `200`; `AdvanceListQueryDto` -> `AdvanceSummaryDto[]` + `meta` | `#24` Advances List & `#22?mode=new` Advance Lookup |
| F-25 | `GET` | `/api/tenant/accounting/v1/advances/:id` | `/accounting/advances/:id` | `accounting.advance.read` | `accounting.receivables.core` | `COMPANY` | `none` | `none` | `200` + `ETag: "<version>"`; `AdvanceDetailDto` (§13.1 `acc_advances` projection; see `CG-RAP-06`) | `#25` Advance Detail |
| F-26 | `POST` | `/api/tenant/accounting/v1/advances` | `/accounting/advances` | `accounting.advance.create` | `accounting.receivables.core` | `COMPANY` | `x-idempotency-key` | `none` | `201` + `Location` + chain headers *(when receipt posts immediately on `AR` cash/bank)*; `AdvanceDetailDto` | `#24?mode=new` Create Advance Drawer |
| F-27 | `POST` | `/api/tenant/accounting/v1/advances/:id/apply` | `/accounting/advances/:id/apply` | `accounting.advance.apply` | `accounting.receivables.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` + chain headers; `ApplyAdvanceDto` -> creates `ADVANCE_APPLICATION` settlement pair + tax reversal | `#25` Apply Advance Workspace |
| F-28 | `POST` | `/api/tenant/accounting/v1/advances/:id/cancel` | `/accounting/advances/:id/cancel` | `accounting.advance.create` | `accounting.receivables.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200`; unfunded `OPEN` advance (`journalEntryId === null`) only (`VAL-RAP-36`; see `CG-RAP-02`) | `#25` Cancel Unfunded Advance Modal |
| F-29 | `GET` | `/api/tenant/accounting/v1/party-merges` | `/accounting/party-merges` | `accounting.profile.read` | `accounting.receivables.core` | `COMPANY` | `none` | `none` | `200`; `PartyMergeSummaryDto[]` (`fromPartyId`, `intoPartyId`, `mergedAt`, `eventId`) | `#60` Tab 3 (`Party Merge Lineage`) |

### 2.3 Shared (`[S]`) Supporting Pickers, FX Resolver, Export Polling & Cross-Surface Reads

| Method & Browser Gateway Path | Owning `SCR` | Permission & Feature Key | Scope Target | How `SCR-23` Consumes It |
| --- | --- | --- | --- | --- |
| `POST /api/tenant/accounting/v1/party-finance-profiles/lookup` | `[S]` (`SCR-02`) | `accounting.party_finance_profile.read` · `accounting.ledger.core` | `COMPANY` | `<PartyPicker>` (`UX-08b`) in `#20`, `#22`, `#24` (`[P24.T03]`), `#60`, plus batch label hydration for `partyId` (`LookupItemDto`) |
| `POST /api/tenant/accounting/v1/treasuries/lookup` | `[S]` (`SCR-25`) | `accounting.treasury.read` · `accounting.treasury.cash_and_custody` | `COMPANY_OR_BRANCH` | Treasury box / `EWALLET` picker for `AR` `CASH`/`EWALLET` settlements (`#22?mode=new`), `AP` supplier advance cash refund (`#22?mode=new`), and `AR` cash advance (`#24?mode=new` `[P24.T03]`) |
| `POST /api/tenant/accounting/v1/bank-accounts/lookup` | `[S]` (`SCR-27`) | `accounting.bank_account.read` · `accounting.treasury.bank_reconciliation` | `COMPANY` | Bank account picker for `AR` `BANK_TRANSFER`/`CARD`/`EWALLET` settlements (`#22?mode=new`), `AP` supplier advance bank refund (`#22?mode=new`), and `AR` bank advance (`#24?mode=new` `[P24.T03]`) |
| `GET /api/tenant/accounting/v1/payments` | `[S]` (`SCR-26`) | `accounting.payment.read` · `accounting.payables.core` | `COMPANY_OR_BRANCH` | `AP` payment picker (`instrumentRef` on `acc_payments`) when `side = 'AP'` in `#22?mode=new` *(no `POST /payments/lookup` exists today — see `CG-RAP-07`)* |
| `POST /api/tenant/accounting/v1/fx-rates/resolve` | `[S]` (`SCR-02`) | `accounting.fx_rate.resolve` · `accounting.ledger.core` | `COMPANY_OR_BRANCH` | `<FxRateStrip>` (`UX-07`) in `#22?mode=new` when `currencyCode !== functionalCurrency` (`rateDate = settledOn`, `rateType = 'SPOT'`) to obtain `fxRateId` |
| `GET /api/tenant/accounting/v1/periods` | `[S]` (`SCR-02`) | `accounting.period.read` · `accounting.ledger.core` | `COMPANY` | Period state badge & pre-submit guard in `#22?mode=new`, `#23` (`unallocate`/`reverse`), and `#25` (`apply`) verifying `AR`/`AP` and `GL` states for `settledOn`/`reversalDate`/`appliedOn` |
| `GET /api/tenant/accounting/v1/exports/runs/:id` & `/download` | `[S]` (`SCR-35`) | `accounting.export.read` / `accounting.export.download` · `accounting.reporting.snapshots` | `COMPANY` | Polling `202` `Location` from `POST /open-items/export` in `UX-13` `<AccountingJobTrayDrawer>` and fetching `SignedDownloadDto` |
| `GET /api/tenant/accounting/v1/integrity-checks/latest` | `[S]` (`SCR-40`) | `accounting.report.read` · `accounting.ledger.core` | `COMPANY` | Live `SUBLEDGER_EQUALS_CONTROL` verdict banner on `#60` *(silently omitted if actor lacks `accounting.report.read`, never failing `#60`)* |
| `GET /api/tenant/accounting/v1/reports/party-ledger` | `[S]` (`SCR-12`) | `accounting.report.read` · `accounting.receivables.core` | `COMPANY_OR_BRANCH` | Cross-link from `#60` & `#21` to `#72` `/accounting/reports/party-ledger?side=...&partyId=...&statementStyle=BALANCE_FORWARD` |
| `GET /api/tenant/accounting/v1/exposure/parties/:partyId` | `[S]` (`SCR-24`) | `accounting.open_item.read` **AND** `accounting.credit_exposure.read` (`D-545`) · `accounting.receivables.credit_control` | `COMPANY` | `[P24.T03]` Read-only Party Credit Exposure inspector drawer on `#60` (`ExposureSummaryDto` with `no-store, private` & `asOf`) |
| `GET /api/tenant/accounting/v1/attachments` (`?ownerType=...&ownerId=...`) | `[S]` (`SCR-18`) | `accounting.attachment.read` · `accounting.ledger.core` | `COMPANY_OR_BRANCH` | Supporting evidence attachments on `#21` (`OPEN_ITEM`), `#23` (`SETTLEMENT`), and `#25` (`ADVANCE`) |

---

## 3. Screen Group A — Open Items Explorer (`#20`) & Installment Detail (`#21`)

### 3.1 `#20` `/accounting/post/open-items` — Layout & Progressive Disclosure

1. **Boundary & Scope Header:**
   - Wrapped in `<AccountingBoundaryGate feature="accounting.receivables.core" permission="accounting.open_item.read" scope="COMPANY_OR_BRANCH">` (read-only banner when `RECOVERY_MODE` or `ARCHIVED` is active, disabling `Export` and all `[P24.T03]` row mutations).
   - **`PageHeader`:**
     - Title: `t.accounting.openItems.title` (*"البنود المفتوحة للعملاء والموردين"* / *"AR & AP Open Items"*).
     - Primary CTA (`1` filled `variant="primary"` button on screen): **"New Settlement"** / **"تسوية جديدة"** (`Link` to `/accounting/post/settlements?mode=new&side=<activeSide>`, rendered when `can('accounting.settlement.create')` and tenant is writable).
     - Secondary actions (`variant="outline"`):
       - **"Export"** / **"تصدير"** (`POST /accounting/open-items/export`, `format: 'CSV' | 'XLSX'`, visible when `can('accounting.open_item.export')` **and** operating context has company-wide scope (`COMPANY`), disabled with tooltip when user is restricted to a single branch without company-scope `accounting.open_item.export` per `D-550`).
       - **"Aging & Subledger Reconciliation"** / **"تعمير الديون ومطابقة الأستاذ المساعد"** (`Link` to `/accounting/reconcile/subledgers?side=<activeSide>`).
2. **Primary Side Switcher (`Tabs`):**
   - Two top-level tabs bound to `OpenItemListQueryDto.side` (required enum `SubledgerSide`):
     - **`AR` — Receivables (`ذمم العملاء` / `Customer Receivables`)** (default when `?side` is omitted; URL synced to `?side=AR`).
     - **`AP` — Payables (`ذمم الموردين` / `Supplier Payables`)** (`?side=AP`).
   - Switching `side` resets `cursor` and `page` to `1` and updates the live match counter (`POST /accounting/open-items/count`).
3. **Filter Bar (`OpenItemListQueryDto` + Optional Advanced Filter Tree `OpenItemSearchDto`):**
   - **Row 1 (Quick Filters — `GET /accounting/open-items`):**
     - `partyId` (`<PartyPicker side={side} />` — single party filter).
     - `status` (`Select`: All, `OPEN`, `PARTIALLY_SETTLED`, `DISPUTED`, `SETTLED`, `WRITTEN_OFF`).
     - `disputeStatus` (`Select`: All, `NONE`, `OPEN`, `ESCALATED`, `RESOLVED`).
     - `currencyCode` (`Select`: Company currencies / ISO 4217 code).
   - **Row 2 (Collapsible Date & Dunning Filters):**
     - `dueAfter` & `dueBefore` (`DatePicker` pair — pre-populated when drilling down from `#60` Aging buckets!).
     - `agingAsOf` (`DatePicker`, defaults to today's business date — drives overdue day badge display relative to the selected as-of date).
     - `dunningLevel` (`Select`: Any, `0`, `1`, `2`, `3`, `4`, `5`, `6`).
     - **Advanced Search Toggle (`POST /accounting/open-items/search`):** Opens the structured filter-chip builder (`OpenItemSearchDto`, `<= 20` leaves, depth `<= 3`, allowlisted party, document, due-date, and status fields).
   - **Live Match Pill:** Calls `POST /accounting/open-items/count` (debounced `300 ms`) with the identical filter criteria and displays `<Badge variant="neutral">{count} {t.accounting.openItems.matchingItems}</Badge>`.
4. **Compact Ledger-Scale Grid (`UX-05` `<AccountingLedgerGrid>`):**
   - Page size selector: `50` (default), `100`, `250`, `500` (`MAX_LEDGER_PAGE_SIZE = 500`). Beyond page `200`, offset pagination switches automatically to opaque keyset `cursor` navigation (`pageInfo.nextCursor`, `D-153`).
   - **Zero client-side footer sum (`CG-DATA-01`)**: Table footer displays only pagination state, `asOf` read freshness timestamp, and a link to `#60` Aging Report for authoritative totals.
   - **Columns (`OpenItemSummaryDto` — all `<td>` cells `font-normal` `400`):**
     1. **Party (`partyId`):** Hydrated party name from `<PartyPicker>` lookup cache + `<IdentifierText>` fallback (`Q14`, `CG-RAP-05`).
     2. **Source Document & Installment (`fiscalDocumentId`, `installmentNo`):** Links `fiscalDocumentId` (when non-null) to `/accounting/post/documents/[fiscalDocumentId]` via `<IdentifierText>` + badge `#<installmentNo>` (when `fiscalDocumentId === null`, renders `t.accounting.openItems.nonDocumentOrigin` and reveals exact `originKind` on `#21`; see `CG-RAP-05`).
     3. **Due Date & Overdue Cue (`dueDate` vs `agingAsOf`):** Formatted `ISODate` (`tabular-nums`). If `status` is `OPEN` or `PARTIALLY_SETTLED` and `dueDate < agingAsOf`, appends a compact `caution`/`negative` overdue day pill (`+N d`).
     4. **Original Amount (`originalAmount`, `currencyCode`):** `<AccountingMoneyCell>` (`dir="ltr"`, `tabular-nums`, end-aligned).
     5. **Settled Amount (`settledAmount`, `currencyCode`):** `<AccountingMoneyCell>`.
     6. **Remaining Amount (`remainingAmount`, `currencyCode`):** `<AccountingMoneyCell>`.
     7. **Status (`status`):** `<AccountingStatusBadge kind="openItem" value={row.status} />` (`OPEN` -> neutral, `PARTIALLY_SETTLED` -> caution, `SETTLED` -> positive, `WRITTEN_OFF` -> neutral, `DISPUTED` -> negative).
     8. **Dispute & Dunning (`disputeStatus`, `dunningLevel`):** Renders `<AccountingStatusBadge kind="dispute" value={row.disputeStatus} />` when `disputeStatus !== 'NONE'` and level pill `L{dunningLevel}` when `dunningLevel > 0`.
     9. **Row Actions (`...` kebab + primary inline link):**
        - **View Detail** (`Link` to `/accounting/post/open-items/${row.id}`) — always visible.
        - **Settle Item** (`Link` to `/accounting/post/settlements?mode=new&side=${row.side}&partyId=${row.partyId}&openItemId=${row.id}`) — visible when `can('accounting.settlement.create')` and `row.status` in `('OPEN', 'PARTIALLY_SETTLED', 'DISPUTED')` (`[Slice — P19.T08]`).
        - **`[Full stage completion — P24.T03]`** **Open / Escalate Dispute** (`POST /:id/dispute`, gated on `hasFeature('accounting.receivables.credit_control') && can('accounting.open_item.dispute')`; fetches `GET /:id` `ETag` first before submitting `If-Match`).
        - **`[Full stage completion — P24.T03]`** **Resolve Dispute** (`POST /:id/resolve-dispute`, when `disputeStatus` in `('OPEN', 'ESCALATED')`).
        - **`[Full stage completion — P24.T03]`** **Block / Unblock Dunning** (`POST /:id/block-dunning` / `unblock-dunning`, gated on `hasFeature('accounting.receivables.dunning')` and `can('accounting.open_item.block_dunning' | 'unblock_dunning')`).

### 3.2 `#21` `/accounting/post/open-items/[id]` — Installment Detail & Lifecycle Actions

`GET /accounting/open-items/:id` returns `200` + `ETag: "<version>"` with `OpenItemDetailDto` (all non-deleted columns of `acc_open_items` per `02_DTOs.md` §13.1).

1. **`DetailHeader`:**
   - Breadcrumb: `Open Items` (`#20?side=<side>`) -> `<IdentifierText value={item.id} />` (`Installment #${item.installmentNo}`).
   - Status cluster: `<Badge variant="neutral">{t.accounting.enums.SubledgerSide[item.side]}</Badge>`, `<Badge variant="neutral">{t.accounting.enums.OpenItemOrigin[item.originKind]}</Badge>`, `<AccountingStatusBadge kind="openItem" value={item.status} />`, plus `DisputeStatus` badge (if `!== 'NONE'`) and `dunningBlockReason` badge (if `!== null`).
   - **Single Primary CTA (`variant="primary"`):** **"Settle Open Item"** / **"تسوية البند"** (`Link` to `/accounting/post/settlements?mode=new&side=${item.side}&partyId=${item.partyId}&openItemId=${item.id}`), shown when `status` in `('OPEN', 'PARTIALLY_SETTLED', 'DISPUTED')`, `direction` is a claim (`(side === 'AR' && direction === 'DEBIT') || (side === 'AP' && direction === 'CREDIT')`), and `can('accounting.settlement.create')`. If the item is an on-account credit (`originKind === 'UNAPPLIED_SETTLEMENT'` or credit note `CREDIT` on `AR` / debit note `DEBIT` on `AP`), the primary CTA reads **"Apply Credit to Claims"** / **"تطبيق الرصيد الدائن"** (`Link` to `/accounting/post/settlements?mode=new&side=${item.side}&partyId=${item.partyId}&creditOpenItemId=${item.id}&instrumentType=CREDIT_NOTE_APPLICATION`).
   - **Secondary Action Bar (`variant="outline"`):**
     - **`[Slice — P19.T08]`** **Edit Collection Fields (`PATCH /:id`)**: Rendered disabled with a contract-pending tooltip until `CG-RAP-01` declares `UpdateOpenItemDto` fields in `02_DTOs.md` (zero guessed DTO keys under `forbidNonWhitelisted`).
     - **`[Full stage completion — P24.T03]`** **Dispute Actions** (`accounting.receivables.credit_control` + `accounting.open_item.dispute`):
       - **Open Dispute** (`disputeStatus: 'OPEN'`): visible when `status` in `('OPEN', 'PARTIALLY_SETTLED')` and `disputeStatus` in `('NONE', 'RESOLVED')`.
       - **Escalate Dispute** (`disputeStatus: 'ESCALATED'`): visible when `status` in `('DISPUTED', 'SETTLED', 'WRITTEN_OFF')` and `disputeStatus === 'OPEN'` (`D-309`, `D-412`).
       - **Resolve Dispute** (`ResolveDisputeDto`): visible when `disputeStatus` in `('OPEN', 'ESCALATED')` on `DISPUTED`, `SETTLED`, or `WRITTEN_OFF` items (`D-309`).
     - **`[Full stage completion — P24.T03]`** **Dunning Block Actions** (`accounting.receivables.dunning`):
       - **Block Dunning** (`BlockDunningDto`: `reason: 'MANUAL' | 'LEGAL'`, optional `note` `<= 1000` chars): visible when `dunningBlockReason === null` and `can('accounting.open_item.block_dunning')`.
       - **Unblock Dunning** (`POST /:id/unblock-dunning`, empty body `{}`): visible when `dunningBlockReason` in `('MANUAL', 'LEGAL')` and `can('accounting.open_item.unblock_dunning')`. When `dunningBlockReason` is a system-managed block (`DISPUTE`, `PROMISE_TO_PAY`, `PAYMENT_PLAN`, `NETTING_PENDING`, `COLLECTION_IN_FLIGHT`), `Unblock Dunning` is **disabled** (`ReadOnlyGate`) with the exact explanation from `VAL-RAP-38` pointing to the owning record (`Resolve Dispute`, `#91` Promises-to-Pay, `#93` Payment Plan, or `#87` Netting).
2. **Progressive-Disclosure Body Sections (2-Column Responsive Layout):**
   - **Card 1 — Claim & FX Position Summary (`DescriptionList`):**
     - `originalAmount`, `settledAmount`, `remainingAmount` in `currencyCode`; `originalAmountFunctional` and `entryFxRate` (`numeric(24,12)` via `<IdentifierText>`).
     - `documentDate`, `dueDate`, `settledAt` (when settled/written off), `direction` (`DEBIT` \| `CREDIT`), `installmentNo`.
     - **Origin Provenance Links (`ck_acc_open_items_origin`):**
       - `DOCUMENT` -> `fiscalDocumentId` link (`#17`).
       - `OPENING_BALANCE` -> `Opening Balance` badge + optional legacy `fiscalDocumentId` link (`D-759`).
       - `UNAPPLIED_SETTLEMENT` -> `originSettlementId` link (`#23` `/accounting/post/settlements/[originSettlementId]`).
       - `ADVANCE` -> `advanceId` link (`#25` `/accounting/post/advances/[advanceId]` `[P24.T03]`).
       - `PAYMENT_PLAN` -> `paymentPlanId` link (`#93` `/accounting/collections/payment-plans/[paymentPlanId]`).
       - When `status === 'WRITTEN_OFF'` -> `writeOffId` link (`#89` `/accounting/collections/write-offs/[writeOffId]`).
   - **Card 2 — Frozen Payment Terms & Early-Payment Discount Snapshot (`paymentTermsSnapshot`):**
     - Read-only inspection of the immutable `paymentTermsSnapshot` JSON captured at posting (`terms_code`, `seq`, `due_type`, `value`, `days`, `day_rule`, `discount_pct`, `discount_days`, `discount_tax_mode`, `base_date`) alongside `discountDate` and `discountAmount`.
     - Displays an explicit eligibility badge: if `discountDate !== null` and `businessDate <= discountDate` and `remainingAmount > 0`, renders `<Badge variant="positive">` *"Eligible for early-payment discount until {discountDate} ({discountAmount} {currencyCode})"* (`D-143`).
   - **Card 3 — Dispute & Dunning Audit State:**
     - Shows `dunningLevel`, `lastDunnedAt`, `interestChargedThrough`, `dunningBlockReason`, `disputeStatus`, `disputeOpenedAt`, `disputeResolvedAt`, and `disputeReason` (read-only text block when present).
   - **Card 4 — Subledger & Settlement Movement Ledger (`POST /accounting/subledger/ar-entries/search` and `POST /accounting/subledger/ap-entries/search`):**
     - Queries `ar-entries/search` (when `side === 'AR'`) or `ap-entries/search` (when `side === 'AP'`, gated on `accounting.payables.core`) filtered by `openItemId = item.id`.
     - Columns: `entryDate`, `entryKind`, `direction` (`DEBIT`/`CREDIT` + `isStorno` tag), `amountTxn`, `amountFunctional`, `fxRateSnapshot`, `journalEntryId` (link to `#15`), and `settlementAllocationId` *(see `CG-RAP-06` for direct link to owning `settlementId` and `realizedFxDifference`)*.
   - **Card 5 — Supporting Attachments (`AttachmentList`):**
     - Reads `GET /accounting/attachments?ownerType=OPEN_ITEM&ownerId=${item.id}` (`[S]`).

---

## 4. Screen Group B — Settlements List (`#22`), Allocation Workspace (`#22?mode=new`) & Detail (`#23`) `[Slice subset — P19.T08]`

### 4.1 Derived Settlement Lifecycle Badge (Zero Invented Enum)

`04_Static_Data/01_Enums.md` defines **no** `SettlementStatus` enum because `acc_settlements` stores lifecycle facts (`posted_at`, `is_provisional`, `confirmed_at`, `reversed_at`, `unallocated_amount`). Per `accounting-status-and-a11y.md` §1.5, every Settlement row and header renders `<AccountingStatusBadge kind="settlementDerived" />` evaluated deterministically in this exact precedence order:

| Priority | Predicate on `SettlementSummaryDto` / `SettlementDetailDto` | Dictionary Key (`t.accounting.derivedStatus.settlement.*`) | Semantic Tone | Icon + Label (`EN` / `AR`) |
| --- | --- | --- | --- | --- |
| 1 | `reversedAt !== null` | `reversed` | `neutral` (`ink`) | `RotateCcw` · `Reversed` / `معكوسة` |
| 2 | `isProvisional === true && confirmedAt === null` | `provisional` | `caution` | `Clock` · `Provisional` / `مؤقتة (بانتظار التأكيد)` |
| 3 | `parseScaledBigInt8(unallocatedAmount) > 0n` | `unappliedBalance` | `caution` | `AlertCircle` · `Unapplied Remainder` / `رصيد غير مخصص` |
| 4 | Otherwise (`postedAt !== null`) | `applied` | `positive` | `CheckCircle2` · `Applied` / `مطبقة` |

### 4.2 `#22` `/accounting/post/settlements` — List View (`mode` Absent)

1. **`PageHeader`:**
   - Title: `t.accounting.settlements.title` (*"التسويات وتخصيص المقبوضات والمدفوعات"* / *"Settlements & Allocations"*).
   - **Single Primary CTA (`variant="primary"`):** **"New Settlement"** / **"تسوية جديدة"** (`Link` to `/accounting/post/settlements?mode=new`, gated on `can('accounting.settlement.create')` and writable tenant state).
   - Secondary links (`variant="outline"`): **"Open Items"** (`#20`), **"Subledger & Aging"** (`#60`). *(Export and Count buttons are intentionally omitted because `settlements` exposes `L S G N` only — see `CG-RAP-07`.)*
2. **Filter Bar (`SettlementListQueryDto` + `POST /accounting/settlements/search`):**
   - `side` (`Tabs` or `Select`: All, `AR`, `AP`), `partyId` (`<PartyPicker />`), `instrumentType` (`Select` over `SettlementInstrumentType`), `fromSettledOn` & `toSettledOn` (`DatePicker` range), `isProvisional` (`Select`: All, Provisional Only `true`, Final Only `false`), plus Advanced Filter Tree (`POST /settlements/search`).
3. **Compact DataTable (`SettlementSummaryDto` — §13.1 `acc_settlements` projection):**
   - Columns (`font-normal` `400` on all `<td>` cells):
     1. `settledOn` (`ISODate`, `tabular-nums`) + `<IdentifierText value={row.id} />` link to `#23`.
     2. `side` (`AR` \| `AP` neutral badge) + `partyId` (cached party label + `<IdentifierText>`).
     3. `instrumentType` (`t.accounting.enums.SettlementInstrumentType[row.instrumentType]`) + companion tag when `parentSettlementId !== null`.
     4. `totalAmount` (`<AccountingMoneyCell currency={row.currencyCode} />`).
     5. `allocatedAmount` (`<AccountingMoneyCell currency={row.currencyCode} />`).
     6. `unallocatedAmount` (`<AccountingMoneyCell currency={row.currencyCode} />` — highlighted with `caution` text only when `> 0` and `reversedAt === null`).
     7. Derived Status (`<AccountingStatusBadge kind="settlementDerived" />`).
     8. `journalEntryId` (`<IdentifierText>` link to `#15`, or *"Subledger-only (`D-308`)"* when `journalEntryId === null && postedAt !== null`).

### 4.3 `#22?mode=new` — Single/Multi-Item Allocation & Realized FX Workspace (`POST /accounting/settlements`)

Opening `/accounting/post/settlements?mode=new` (optionally pre-seeded with `?side=AR|AP&partyId=<uuid>&openItemId=<uuid>` from `#20`/`#21` or `&supplierAdvanceRefund=true&advanceId=<uuid>` from `#25`) renders `<CreateSettlementWorkspace>` inside `WorkspaceLayout`.

#### Step 1 — Settlement Header, Instrument & FX Resolution (`SettlementInstrumentFields.tsx`)

1. **Core Fields (`CreateSettlementDto`):**
   - `side` (`SubledgerSide`: `AR` \| `AP`, required; changing `side` clears selected `instrumentRef`, `allocations[]`, and `withholdings[]`).
   - `partyId` (`<PartyPicker side={side} />`, required; every allocated item must belong to `partyId`, `VAL-RAP-03`).
   - `settledOn` (`DatePicker`, required `ISODate`; validated live against `GET /accounting/periods` so the user sees immediately if `AR`/`AP` or `GL` is `CLOSED`, `SOFT_CLOSED`, `PERMANENTLY_CLOSED`, or `FUTURE`, or older than company backdate limit).
   - `currencyCode` (`Select`, required; defaults to party's primary open-item currency or company functional currency).
   - `branchId` (optional `UUID`, prefilled from active branch header or selected treasury/bank account).
   - `memo` (optional `Textarea`, `maxLength={1000}`).
2. **Closed `(side, instrumentType, instrumentRefType)` Selector (`VAL-RAP-42` & `ck_acc_settlements_instrument_ref`):**
   - `CreateSettlementDto` accepts **only** the instrument types below. Disallowed enum members are **never** selectable in the dropdown; instead, a compact helper strip beneath `instrumentType` provides 1-click handoffs to their owning commands (`CHEQUE` -> `#38` `SCR-26`; `CUSTODY` -> `#30` `SCR-25`; `NETTING` -> `#86` `SCR-24`; `WRITE_OFF` -> `#88` `SCR-24`; `ADVANCE_APPLICATION` -> `#25` `[P24.T03]`):

   | `side` | Mode | Allowed `instrumentType` | `instrumentRefType` Sent on Wire | `instrumentRef` Picker Endpoint |
   | --- | --- | --- | --- | --- |
   | `AR` | Cash receipt | `CASH` | *Omitted* (server derives `'acc_treasuries'`) | `POST /accounting/treasuries/lookup` (`CASH_BOX` / `PETTY_CASH`, active, matching currency) |
   | `AR` | Bank / Card receipt | `BANK_TRANSFER` \| `CARD` | *Omitted* (server derives `'acc_bank_accounts'`) | `POST /accounting/bank-accounts/lookup` (`ACTIVE` or valid late-receipt window, `D-677`) |
   | `AR` | E-Wallet receipt (`D-460`) | `EWALLET` | **Required:** `'acc_bank_accounts'` \| `'acc_treasuries'` | User picks destination kind (`Bank Account` vs `E-Wallet Treasury`), then picks from the corresponding `/lookup` |
   | `AR` | Apply Credit Note / Unapplied Credit | `CREDIT_NOTE_APPLICATION` | *Omitted* (server derives `'acc_open_items'`) | Candidate `AR` `CREDIT` open items of `partyId` (`GET /accounting/open-items?side=AR&partyId=...`) |
   | `AP` | Allocate Payment | `BANK_TRANSFER` \| `CASH` \| `CARD` \| `EWALLET` | *Omitted* (server derives `'acc_payments'`) | `GET /accounting/payments?side=AP&partyId=...` (`PaymentListQueryDto`; see `CG-RAP-07`) |
   | `AP` | Supplier Advance Refund (`D-445`, `D-535`) | `CASH` \| `BANK_TRANSFER` | **Required:** `'acc_treasuries'` (`CASH`) \| `'acc_bank_accounts'` (`BANK_TRANSFER`) | Receiving `treasuries/lookup` or `bank-accounts/lookup`; allocation targets the supplier's `AP` `ADVANCE` open item |
   | `AP` | Apply Debit Note / Unapplied Debit | `CREDIT_NOTE_APPLICATION` | *Omitted* (server derives `'acc_open_items'`) | Candidate `AP` `DEBIT` open items of `partyId` (`GET /accounting/open-items?side=AP&partyId=...`) |

3. **Instrument Amount & Foreign-Currency `<FxRateStrip>` (`UX-07`):**
   - `totalAmount` (`<MoneyInput currency={currencyCode} scale={8} min="0.00000001" />`): the amount of the named instrument **alone** (`D-535` — excludes withholding companions and early-payment discounts). For `CREDIT_NOTE_APPLICATION`, bounded by the selected credit open item's `remainingAmount`.
   - When `currencyCode !== companyFunctionalCurrency`:
     - `<FxRateStrip>` automatically calls `POST /accounting/fx-rates/resolve` (`fromCurrency = currencyCode`, `toCurrency = functionalCurrency`, `rateDate = settledOn`, `rateType = 'SPOT'`) and binds `CreateSettlementDto.fxRateId` (`required` when `currencyCode !== functionalCurrency`, `VAL-RAP-05`).
     - If no rate exists (`422 ACCOUNTING.FX.RATE_MISSING`) or rate is stale (`422 ACCOUNTING.FX.RATE_STALE`), `<FxRateStrip>` renders an inline `negative` callout with a link to `#103` Exchange Rates (`SCR-02`) and blocks `Post Settlement` before submission.

#### Step 2 — Candidate Open Items Allocation Grid, Discounts & AR Withholdings (`SettlementCandidateItemsGrid.tsx`)

1. **Candidate Loading & Enrichment:**
   - Queries `GET /accounting/open-items` (`side`, `partyId`, `currencyCode`, `limit = 500`, `agingAsOf = settledOn`) for items in `OPEN`, `PARTIALLY_SETTLED`, and `DISPUTED`.
   - When the user checks/focuses a row (or clicks **Auto-Propose Oldest Due**), `useCreateSettlementWorkspace` hydrates `GET /accounting/open-items/:id` (cached by `[id, version]`) to inspect `discountDate`, `discountAmount`, `entryFxRate`, and `dunningBlockReason`, which stay on the detail; `direction`, `originKind`, `documentDate` and the joined `documentNo` are already on `OpenItemSummaryDto` (`CG-RAP-05`, `D-772`).
2. **Auto-Propose Oldest Due (`FIFO by dueDate, id` — `D-154`):**
   - Toolbar button **"Auto-Allocate Oldest Due"** / **"توزيع تلقائي للأقدم استحقاقاً"** distributes `totalAmount` across eligible claim items ordered by `(dueDate ASC, id ASC)` using exact `BigInt(10^8)` subtraction.
   - **Mandatory Exclusions (`D-154`, `SCN-039`):** Auto-propose **skips** every item where `status === 'DISPUTED'` (`disputeStatus` in `'OPEN' | 'ESCALATED'`) or `dunningBlockReason === 'LEGAL'`, displaying an inline `caution` note *"Skipped {N} disputed/legal items — select manually to override."*
   - **Explicit Disputed Override (`D-154`, `D-309`):** A user may still settle a `DISPUTED` item by explicitly checking its row and confirming the inline `Explicit Dispute Allocation` checkbox (`aria-describedby` explaining that full settlement closes the item `SETTLED` while preserving its `disputeStatus` for legal/audit history per `D-309`).
3. **Per-Row Controls (`SettlementAllocationInput` — `0..500` rows, `MAX_ALLOCATIONS_PER_SETTLEMENT = 500`):**
   - `amountTxn` (`<MoneyInput>`): `> 0`, `<= item.remainingAmount - sum(withholdingsForItem)` (`VAL-RAP-01`, `D-535`). Quick button **"Fill Remaining"** sets `amountTxn` to exact `min(unallocatedTxn, itemRemainingAfterWht)`.
   - `takeEarlyPaymentDiscount` (`Checkbox`, strict boolean):
     - Enabled **only** when `item.discountDate !== null && settledOn <= item.discountDate` and `amountTxn + sum(withholdingsForItem) + item.discountAmount >= item.remainingAmount` (`D-143`, `D-408`, `VAL-RAP-09`).
     - Tooltip & sub-caption state the frozen `discountAmount`, `discountDate`, and `paymentTermsSnapshot.discount_tax_mode` (`NEVER` vs `CREDIT_NOTE_ON_PAYMENT`, explaining that the server creates a companion `EARLY_PAYMENT_DISCOUNT` settlement parented to the cash settlement).
   - **Foreign-Currency Rate Comparison Column (Visible when `currencyCode !== functionalCurrency`):**
     - Displays `item.entryFxRate` vs resolved `settlementSpotRate` (`<IdentifierText>`). If they differ, shows a neutral `FX Δ` indicator (*"Realized FX gain/loss posts to `FX_GAIN_LOSS_REALIZED` on submit"*, `SCN-007`, `D-010`, `D-407` — zero browser multiplication).
4. **`AR`-Only Provisional Withholding Companion Repeater (`CreateSettlementDto.withholdings[]` — `SCN-035`, `D-042`, `D-535`):**
   - Visible **only** when `side === 'AR'` (collapsible section **"Customer Withholding Deductions (Uncertified)"** / **"خصم منبع العميل (بانتظار الشهادة)"**).
   - Allows `0..500` rows, each bound to an allocated/open `openItemId` of `partyId` with:
     - `openItemId` (`Select` from the party's candidate open items),
     - `amount` (`<MoneyInput>`, `> 0`; validated so `cashAllocation(openItemId) + sum(withholdings(openItemId)) <= item.remainingAmount`),
     - `taxTypeCode` (`string`, e.g. `EG_WHT`), `authorityTaxCode` (`string`, e.g. `T4`), `authoritySubtype` (`string`, e.g. `W001`) populated from synced tax/authority reference lookups.
   - Displays an informational `caution` banner explaining that each withholding line creates a **separate provisional `WITHHOLDING_CERTIFICATE` companion settlement** (`Dr WHT_RECEIVABLE_UNCERTIFIED / Cr AR_CONTROL`) without inflating `totalAmount` (`D-535`), and remains provisional until the certificate is registered on `SCR-16` (`#46`).
5. **Sticky Live Allocation Bar (`SettlementAllocationStickyBar.tsx` — `BigInt(10^8)` Exact Math):**
   - Displays four aligned figures in `currencyCode` (`tabular-nums`):
     1. **Instrument Total (`totalAmount`)**
     2. **Allocated Cash (`Σ allocations[].amountTxn`)**
     3. **Unallocated Remainder (`totalAmount - Σ allocations[].amountTxn`)**
     4. **Companion Totals (Informational):** `Σ withholdings[].amount` (`AR` only) + eligible `EARLY_PAYMENT_DISCOUNT` sum.
   - **Outcome cues:**
     - `unallocatedTxn === 0n` -> `positive` badge (`Fully Allocated` / `موزع بالكامل`).
     - `unallocatedTxn > 0n` -> `caution` badge (`On-Account Credit Remainder: {unallocatedTxn} {currencyCode}` / `رصيد دائن غير مخصص — سينشئ بند دفعة غير مخصصة UNAPPLIED_SETTLEMENT`). Note: `allocations: []` (zero rows) is explicitly valid and creates an on-account `UNAPPLIED_SETTLEMENT` credit item for the entire `totalAmount` (`02_DTOs.md` line 2037).
     - `unallocatedTxn < 0n` or any item `cash + wht > remainingAmount` -> `negative` badge (`Over-Allocated` / `تجاوز المبلغ المتاح`), disabling the **Post Settlement** primary CTA (`VAL-RAP-01`, `VAL-RAP-02`).
   - Also notes that tiny sub-tolerance differences within `settlement.rounding_tolerance` are absorbed automatically by a server-generated `ROUNDING` companion on `INVOICE_ROUNDING` (`05_Subledger_and_Settlement_Tables.md` §5.4 step 7, `D-416`).
   - **Submit (`POST /accounting/settlements`):** Sends `x-idempotency-key` (`generateUUIDv7()`). On `201 Created`, navigates to `/accounting/post/settlements/${res.data.id}` and displays `<PostingReceiptBanner receipt={res.data.posting} />` (`entryNo`, `chainSeq`, `entryHash`).

### 4.4 `#23` `/accounting/post/settlements/[id]` — Settlement Detail, Allocations & Lifecycle Commands

Loads `GET /accounting/settlements/:id` (`200` + `ETag: "<version>"`) and `GET /accounting/settlements/:id/allocations` (`200`, append-only rows).

1. **`DetailHeader` & Waiting Callouts:**
   - Breadcrumb: `Settlements` (`#22`) -> `<IdentifierText value={settlement.id} />`.
   - Status cluster: `<Badge variant="neutral">{settlement.side}</Badge>`, `<Badge variant="neutral">{t.accounting.enums.SettlementInstrumentType[settlement.instrumentType]}</Badge>`, `<AccountingStatusBadge kind="settlementDerived" />`.
   - If `isProvisional === true && confirmedAt === null && reversedAt === null`: renders `<WaitingStateCallout>` (`WS-RAP-01` for `CHEQUE`; `WS-RAP-02` for `WITHHOLDING_CERTIFICATE` — see §9).
2. **Action Visibility & Guard Matrix on `#23` (Exact Contract Rules):**

   | Action | Endpoint | RBAC & Scope | Enabled Predicate & Disabled/Redirect Reason |
   | --- | --- | --- | --- |
   | **Confirm Provisional** *(Primary CTA when eligible)* | `POST /accounting/settlements/:id/confirm` | `accounting.settlement.confirm` · `COMPANY` | **Enabled ONLY when:** `reversedAt === null && isProvisional === true && confirmedAt === null && instrumentType === 'CHEQUE'`. **Never shown/enabled for `WITHHOLDING_CERTIFICATE` (`VAL-RAP-39`):** renders an outline link **"Register Certificate on WHT Screen"** -> `#46` `/accounting/file/withholding-certificates`. |
   | **Unallocate** (`variant="outline"`) | `POST /accounting/settlements/:id/unallocate` (`UnallocateSettlementDto`) | `accounting.settlement.unallocate` · `COMPANY` | **Enabled when:** `postedAt !== null && reversedAt === null && parseScaledBigInt8(allocatedAmount) > 0n` **AND** settlement is **not** part of a linked/companion/pair/advance-refund set (`parentSettlementId === null`, not `ADVANCE_APPLICATION`, `CREDIT_NOTE_APPLICATION`, `NETTING`, `WRITE_OFF`, `OFFSET`, `CUSTODY`, and not an `AP` supplier-advance refund). If linked (`ACCOUNTING.SETTLEMENT.LINKED_SETTLEMENT`), `ReadOnlyGate` disables `Unallocate` and points to **Reverse Settlement** (or owning screen). |
   | **Reverse Settlement** (`variant="outline"` destructive tone) | `POST /accounting/settlements/:id/reverse` | `accounting.settlement.reverse` · `COMPANY` | **Enabled when:** `postedAt !== null && reversedAt === null` **AND** `instrumentType` is **not** `NETTING`, `CUSTODY`, or payment-plan `OFFSET` (`instrumentRefType === 'acc_payment_plans'`). For `NETTING`, renders link to `#87` (`/accounting/collections/nettings/[instrumentRef]`); for plan `OFFSET`, links to `#93` (`/accounting/collections/payment-plans/[instrumentRef]`); for `CUSTODY`, links to `#30` (`/accounting/post/custodies/[instrumentRef]`) (`VAL-RAP-37`). Reversing a `POSTED` `WRITE_OFF` settlement is explicitly permitted and displays a warning that the write-off moves `POSTED -> CANCELLED` (`D-240`). |

3. **Unallocate Modal (`UnallocateSettlementModal.tsx` — `UnallocateSettlementDto`):**
   - Allows selecting specific live `allocationIds[]` (or leaving all checked = omit `allocationIds` to unallocate every live allocation).
   - `reversalDate` (`DatePicker`, optional, defaults to business date; must be `>= settledOn` and inside an open period, `VAL-RAP-07`).
   - `reason` (`Textarea`, required `10..1000` chars).
   - Explains clearly: *"Appends negative reversal allocation row(s) without reversing the cash/bank receipt; reopens the open item(s) and records the freed amount as an `UNAPPLIED_SETTLEMENT` credit open item."*
4. **Reverse Settlement Modal (`ReverseSettlementModal.tsx` — `POST /:id/reverse`, see `CG-RAP-02`):**
   - Captures reversal `reason` (`ReverseSettlementDto { reason: ReversalReason (MANUAL \| ERROR_CORRECTION \| PERIOD_CORRECTION), reversalDate? }`, `D-772`; there is no free-text comment because no column holds one) and confirms whole-set impact: reverses the settlement, its posted journal entry (`reversalEntryId` via company `reversal_method` `SWAP_SIDES` or `STORNO`), every companion settlement (`EARLY_PAYMENT_DISCOUNT`, `WITHHOLDING_CERTIFICATE`, `ROUNDING`), and any unapplied remainder `UNAPPLIED_SETTLEMENT` open item (`D-426`, `D-452`).
5. **Detail Sections:**
   - **Card 1 — Financial & Instrument Facts:** `totalAmount`, `allocatedAmount`, `unallocatedAmount`, `currencyCode`, `totalAmountFunctional`, `fxRateSnapshot` (`numeric(24,12)`), `instrumentType`, `instrumentRefType` + `instrumentRef` link, `parentSettlementId` link (if companion), `journalEntryId` link (`#15`), `confirmationEntryId` link (`#15`), `reversalEntryId` link (`#15`), `memo`.
   - **Card 2 — Append-Only Allocations & Realized FX Ledger (`GET /settlements/:id/allocations`):**
     - Columns (`font-normal` `400`): `openItemId` (link to `#21`), `amountTxn`, `entryFxRate`, `settlementFxRate`, `amountFunctionalAtEntryRate`, `amountFunctionalAtSettlementRate`, `realizedFxDifference` (with `positive`/`negative`/`neutral` directional label per `side`, `D-010`), `settledOn`, and append-only reversal audit (`reversalOfAllocationId`, `reversedAt`, `reversalReason`). Reversed original rows and their negative reversal rows both remain visible as immutable audit facts (`D-027`).

---

## 5. Screen Group C — Customer & Supplier Advances (`#24` & `#25`) `[Full stage completion — P24.T03]`

> **Stage Tag:** Entire §5 (`#24` `/accounting/post/advances`, `#24?mode=new`, and `#25` `/accounting/post/advances/[id]`) ships in **`[Full stage completion — P24.T03]`** (`F-24`..`F-28`).

### 5.1 `#24` `/accounting/post/advances` — Advances List & `?mode=new` Creation Drawer

1. **`PageHeader` & Filters (`AdvanceListQueryDto`):**
   - Title: `t.accounting.advances.title` (*"الدفعات المقدمة من العملاء وللموردين"* / *"Customer & Supplier Advances"*).
   - Scope: `COMPANY` (`x-mutakamel-company-id` required; branch-only actors without company-level `accounting.advance.read` see `<PermissionGate>`).
   - **Single Primary CTA (`variant="primary"`):** **"New Advance"** / **"دفعة مقدمة جديدة"** (`?mode=new`, gated on `can('accounting.advance.create')`).
   - Filters (`GET /accounting/advances`): `side` (`Tabs`: All, `AR` Customer Advances, `AP` Supplier Advances), `partyId` (`<PartyPicker />`), `kind` (`Select`: All, `DEPOSIT`, `PREPAYMENT_INVOICE`, `RETAINER`), `fullyApplied` (`Select`: All, Open/Partial `false`, Fully Applied `true`). *(Search, Count, and Export are omitted per `CG-RAP-07`.)*
2. **Grid Columns (`AdvanceSummaryDto` — §13.1 `acc_advances` projection):**
   - `advanceNo` (`ADV-{YYYY}-NNNNNN` via `<IdentifierText>`, link to `#25`), `side` (`AR` \| `AP`), `partyId`, `kind` (`AdvanceKind`), `receivedOn`, `amount`, `appliedAmount`, `refundedAmount`, `remainingAmount` (`<AccountingMoneyCell>`), `taxAtReceipt` badge (`Taxed at Receipt` / `Untaxed Deposit`), and `status` (`<AccountingStatusBadge kind="advance" value={row.status} />` — `OPEN`, `PARTIALLY_APPLIED`, `FULLY_APPLIED`, `REFUNDED`, `CANCELLED`, plus `<WaitingStateBadge>` when `status === 'OPEN' && row.journalEntryId === null`).
3. **`#24?mode=new` — Create Advance Form Drawer (`CreateAdvanceDto` — `POST /accounting/advances`):**
   - Fields:
     - `side` (`SubledgerSide`: `AR` \| `AP`, required).
     - `partyId` (`<PartyPicker side={side} />`, required).
     - `kind` (`AdvanceKind`: `DEPOSIT` \| `PREPAYMENT_INVOICE` \| `RETAINER`, required).
     - `currencyCode` (`Select`, required) & `amount` (`<MoneyInput scale={8} />`, `> 0`, required).
     - `receivedOn` (`DatePicker`, required `ISODate`).
     - **4-Way Receipt-Source Selector (`D-180`, `D-322`, `D-425`, `VAL-RAP-35`):**
       - When `side === 'AR'`: radio group **"Receipt Channel"**:
         1. **Cash / E-Wallet Treasury (`treasuryId`)** -> `<TreasuryPicker>` (`POST /treasuries/lookup`); `bankAccountId` omitted. **Posts immediately** (`201` + `PostingReceiptDto` + `ADVANCE` open item).
         2. **Bank Account (`bankAccountId`)** -> `<BankAccountPicker>` (`POST /bank-accounts/lookup`); `treasuryId` omitted (`VAL-RAP-17`). **Posts immediately**.
         3. **Inbound Cheque / PDC (Omit both)** -> creates `OPEN` advance with `journalEntryId = null`, then prompts 1-click navigation to `#38` (`SCR-26` `POST /accounting/instruments` with `advanceId`).
       - When `side === 'AP'`: `treasuryId` and `bankAccountId` are **hidden and omitted** (`VAL-RAP-35` — supplying either on `AP` is refused with `400 ACCOUNTING.VALIDATION.FAILED`). Helper callout explains that creating the `AP` advance records the `OPEN` intent (`journalEntryId = null`), after which the user links a Single Payment (`#31` `CreatePaymentDto.advanceId`) or Outbound Cheque (`#38` `CreateInstrumentDto.advanceId`) on `SCR-26`.
     - `fiscalDocumentId` (optional `UUID` picker linking a registered `PREPAYMENT_INVOICE` from `#16`/`#17`; highlighted when `kind === 'PREPAYMENT_INVOICE'`).
     - `taxTreatmentRuleId` (optional `UUID`; pack rule determining whether VAT is due at receipt, `VAL-RAP-16`).

### 5.2 `#25` `/accounting/post/advances/[id]` — Advance Detail, Multi-Item Application, Refunds & Cancel

1. **Header & Funding Readiness Gate:**
   - Displays `advanceNo`, `side`, `kind`, `status`, `amount`, `appliedAmount`, `refundedAmount`, `remainingAmount`, `taxAmount`, `taxAtReceipt`, `journalEntryId` (`#15`), `openItemId` (`#21`), `paymentId` (`#32`), `instrumentId` (`#39`), `fiscalDocumentId` (`#17`).
   - **When `status === 'OPEN' && journalEntryId === null` (`WS-RAP-03`):**
     - `Apply Advance` is **disabled** (`409 ACCOUNTING.ADVANCE.NOT_RECEIVED`, `VAL-RAP-36`).
     - `<WaitingStateCallout>` names the missing funding step and renders a deep link to `SCR-26` (`Record Inbound Cheque`, `Create Single Payment`, or `Issue Outbound Cheque` carrying `advanceId`).
     - **Cancel Advance (`POST /accounting/advances/:id/cancel`):** Enabled when `can('accounting.advance.create')` **and** `paymentId` is null or its payment is already `FAILED`/`CANCELLED` (if a linked `paymentId` is `DRAFT` or `APPROVED`, the UI warns to cancel the pending payment on `SCR-26` first per `ACCOUNTING.ADVANCE.NOT_CANCELLABLE`).
2. **Apply Advance Workspace (`ApplyAdvanceWorkspaceCard.tsx` — `POST /accounting/advances/:id/apply`):**
   - Active when `journalEntryId !== null && parseScaledBigInt8(remainingAmount) > 0n && can('accounting.advance.apply')`.
   - `appliedOn` (`DatePicker`, required `ISODate` inside an open `AR`/`AP` and `GL` period).
   - Candidate Open Items grid (`GET /accounting/open-items?side=${advance.side}&partyId=${advance.partyId}&currencyCode=${advance.currencyCode}`):
     - User enters `applications[] { openItemId, amount }` (`1..500` items).
     - Exact `BigInt(10^8)` bar validates `Σ applications[].amount <= advance.remainingAmount` (`VAL-RAP-15`) and each `amount <= openItem.remainingAmount`.
     - If `advance.taxAtReceipt === true`, displays an informational note that applying the advance posts the `ADVANCE_APPLICATION` settlement pair and proportionally reverses the receipt-time output/input tax so the final invoice is never taxed twice (`D-180`).
3. **Refund Guidance Card (`AdvanceRefundGuidanceCard.tsx` — `D-445`):**
   - Visible when `journalEntryId !== null && parseScaledBigInt8(remainingAmount) > 0n`:
     - **`AR` Customer Advance Refund:** Links to `SCR-26` `#31` (`/accounting/post/payments?mode=new&side=AR&partyId=${advance.partyId}&advanceId=${advance.id}`), noting that if funded by an inbound cheque, the cheque must be `COLLECTED` first (`ACCOUNTING.ADVANCE.NOT_RECEIVED`).
     - **`AP` Supplier Advance Refund (Money In):** Links directly to **`SCR-23` `#22?mode=new`** (`/accounting/post/settlements?mode=new&side=AP&partyId=${advance.partyId}&openItemId=${advance.openItemId}&supplierAdvanceRefund=true`), which pre-configures `CreateSettlementDto` (`side: 'AP'`, `instrumentType: 'CASH' | 'BANK_TRANSFER'`, `instrumentRefType: 'acc_treasuries' | 'acc_bank_accounts'`) once the original `AP` payment/cheque is `CLEARED`.

---

## 6. Screen Group D — Subledger Entries, Aging Reconciliation & Party Merge Lineage (`#60`)

Route `#60` `/accounting/reconcile/subledgers` (`TENANT_ROUTES.accountingReconcileSubledgers`) is the accountant's daily and month-end (`CLOSE-11` / `CLOSE-12`) subledger-to-GL reconciliation workspace.

### 6.1 Persistent Top Reconciliation Strip (`SubledgerIntegrityBanner.tsx`) `[Slice subset — P19.T08]`

- Calls `[S]` `GET /accounting/integrity-checks/latest` when `can('accounting.report.read')` and extracts the `SUBLEDGER_EQUALS_CONTROL` monitor row (`04_Errors_and_Constants.md` §6.2 line 1152):
  - **`PASSED`:** `positive` compact strip: *"Subledger = Control Account Verified (`SUBLEDGER_EQUALS_CONTROL` · PASSED at chainSeq {pos} · {asOf})"* + outline links **"Open Party Ledger (`#72`)"**, **"Open Trial Balance (`#70`)"**, and **"Integrity Monitors (`#61`)"**.
  - **`FAILED`:** `negative` high-priority callout: *"Subledger vs Control Drift Detected (`SUBLEDGER_EQUALS_CONTROL` · FAILED — {findingsCount} party/account differences)"* + direct CTA to `#61` `/accounting/reconcile/integrity` (`SCR-40`).
  - **`ERROR` / Missing / Stale:** `caution` strip naming the last run timestamp and linking to `#61`.
  - **Without `accounting.report.read`:** Strip omits the monitor query cleanly (zero `403` noise) and renders only the quick links to `#72` Party Ledger and `#70` Trial Balance.

### 6.2 Workspace Tabs on `#60`

| Tab | Key | Delivery Stage | Required Feature & Permission | Backing Endpoint(s) |
| --- | --- | --- | --- | --- |
| **Tab 1 (Default)** | `aging` | **`[Slice subset — P19.T08]`** | `accounting.receivables.core` + `accounting.report.read` | `GET /accounting/reports/aging` (`AgingQueryDto`) |
| **Tab 2** | `entries` | **`[Slice subset — P19.T08]`** | `AR`: `accounting.receivables.core` + `accounting.open_item.read`<br/>`AP`: `accounting.payables.core` + `accounting.open_item.read` | `GET` & `POST .../search` on `/accounting/subledger/ar-entries` and `/accounting/subledger/ap-entries` |
| **Tab 3** | `party-merges` | **`[Full stage completion — P24.T03]`** | `accounting.receivables.core` + `accounting.profile.read` *(COMPANY scope)* | `GET /accounting/party-merges` *(+ optional `[S]` `GET /accounting/exposure/parties/:partyId` drawer)* |

#### Tab 1 — Interactive AR/AP Aging Report (`AgingReportTab.tsx` — `[Slice subset — P19.T08]`)

1. **Parameter Bar (`AgingQueryDto` — `02_Endpoint_Catalogue.md` §12 line 1152):**
   - `side` (`SubledgerSide`: `AR` \| `AP`, **mandatory**).
   - `asOfDate` (`DatePicker`, **mandatory** `ISODate`, defaults to business date or closing period end).
   - `agingBy` (`AgingBasis`: `DUE_DATE` default \| `DOCUMENT_DATE`).
   - `buckets` (Preset selector `[30, 60, 90, 120]` default, `[15, 30, 60, 90]`, `[30, 60, 90, 180, 365]`, or custom ascending integer array `1..8` entries each `1..3650`).
   - `currencyMode` (`CurrencyMode`: `PARTY` default \| `FUNCTIONAL`):
     - Selecting `FUNCTIONAL` displays an inline helper badge explaining `D-540`: *"Converts open items at `entry_fx_rate`, or at the pinned `FX_REVALUATION` `rate_snapshot` when `asOfDate` matches a posted revaluation run — agreeing with the Trial Balance control account on period end."*
   - `partyId` (`<PartyPicker multi max={200} />`, optional `1..MAX_FILTER_IDS`).
   - `includeDisputed` (`Checkbox`, strict boolean, default `false` — when `false`, header notes whether disputed items are excluded so the user knows to toggle `includeDisputed = true` when reconciling total subledger balance against `AR_CONTROL`/`AP_CONTROL`!).
   - `branchId` (optional `UUID` within resolved company).
2. **Report Grid (`UX-12` `<AccountingReportViewer>` over `AgingReportDto`, `D-772`):**
   - Displays `asOf` and `asOfChainSeq` / `asOfChainPositions` freshness banner (`D-153`, `D-165`).
   - Columns: Party (`partyId` + hydrated name + `[P24.T03]` **"Exposure"** quick-drawer icon button), Currency (`currencyCode` under `PARTY` mode; functional currency under `FUNCTIONAL` mode), `Current (Not Yet Due)`, dynamic bucket columns (one per entry of `buckets` plus the amount beyond the last bound, named from the returned `buckets`), and `Total` (server-computed `rows[].total` and per-currency `totals[]`; zero client math; an item of the opposite direction, such as a credit note or an unapplied receipt, subtracts inside the server figures instead of having its own column).
   - **1-Click Cell Drill-Down:** Clicking any party bucket cell navigates to `#20` `/accounting/post/open-items?side=${side}&partyId=${partyId}&agingAsOf=${asOfDate}&dueAfter=...&dueBefore=...` so the accountant can immediately inspect or settle the exact installments inside that bucket. Clicking **"Party Statement"** opens `#72` `/accounting/reports/party-ledger?side=${side}&partyId=${partyId}&toDate=${asOfDate}&statementStyle=BALANCE_FORWARD`.

#### Tab 2 — AR & AP Subledger Entries (`SubledgerEntriesTab.tsx` — `[Slice subset — P19.T08]`)

1. **Subledger Side Sub-Switcher (`AR` vs `AP`):**
   - `AR` sub-tab calls `GET /accounting/subledger/ar-entries` / `POST .../search` (`accounting.receivables.core` + `accounting.open_item.read`).
   - `AP` sub-tab calls `GET /accounting/subledger/ap-entries` / `POST .../search` (`accounting.payables.core` + `accounting.open_item.read`). If `accounting.payables.core` is not entitled (`CG-RAP-08`), the `AP` sub-tab is hidden/gated cleanly per `10_Feature_Tiers.md` §11 without breaking `AR`.
2. **Grid Columns (`ArLedgerEntrySummaryDto` / `ApLedgerEntrySummaryDto` — §13.1 projection of `acc_ar_ledger_entries` / `acc_ap_ledger_entries`):**
   - `entryDate` (`ISODate`), `documentDate` (`ISODate`), `entryKind` (`EntryKind`), `partyId`, `accountId` (`AR_CONTROL` / `AP_CONTROL` / `SALARIES_PAYABLE`), `direction` (`DEBIT` \| `CREDIT` + `STORNO` tag when `isStorno === true`, rendering negative amounts with explicit `-` sign in `dir="ltr"` per `D-219`), `amountTxn` (`currencyCode`), `fxRateSnapshot` (`numeric(24,12)`), `amountFunctional`, `openItemId` (link to `#21`), `journalEntryId` (link to `#15`), `fiscalDocumentId` (link to `#17` when non-null).
   - *(Export button is omitted because `POST /subledger/{ar|ap}-entries/export` is absent from the Endpoint Catalogue table — see `CG-RAP-03`.)*

#### Tab 3 — Party Merge Lineage & Exposure Inspector (`PartyMergesLineageTab.tsx` — `[Full stage completion — P24.T03]`)

1. **Party Merge Lineage Table (`GET /accounting/party-merges` — `SCN-051`, `D-196`):**
   - Explains why open items, subledger entries, and historical documents posted under a retired `fromPartyId` remain immutable on their original rows while folding at read time into the surviving `intoPartyId` across Aging, Statements, Dunning, and Credit Exposure (up to `8` merge hops).
   - Columns: `mergedAt` (`ISO8601`), `fromPartyId` (Retired Identity — `<IdentifierText>` + cached name), Arrow `→` (logical `ArrowEnd` icon that flips in RTL!), `intoPartyId` (Surviving Identity — `<IdentifierText>` + cached name + link to `#20?partyId=${intoPartyId}`), `eventId` (`<IdentifierText>`).
   - Includes a compact info banner noting that attempted merges across distinct tax registrations are refused by Accounting (`422 ACCOUNTING.OPEN_ITEM.MISMATCH`, `D-501`) and surface on the Exception Board (`#6` `SCR-39`) as `PARTY_MERGE_REFUSED`.
2. **Optional Party Credit Exposure Quick Drawer (`PartyExposureQuickDrawer.tsx` — `[S]` `GET /accounting/exposure/parties/:partyId`):**
   - Triggered from a party row on `#60` **only** when `hasFeature('accounting.receivables.credit_control') && canAll(['accounting.open_item.read', 'accounting.credit_exposure.read'])` (`D-545`).
   - Renders `ExposureSummaryDto` (`openAr`, `openAp`, `unpostedExposure`, `pdcExposure`, `unappliedCredits`, `exposureTotal`, `creditLimit`, `available`, `onHold`, `openDisputeCount`, `asOf`, `asOfChainPositions`) with a **"Manage Credit Control (`#94`)"** link to `SCR-24` and a clear boundary note that Accounting computes and publishes exposure while Trade enforces order holds (`D-074`).

---

## 7. Complete Field-to-DTO & Validation Mapping Tables

### 7.1 Query & Export DTO Field Mapping (`04_Static_Data/02_DTOs.md` §8.1, §11.3, §13.2)

| Screen / Control | DTO Name & Field | Wire Type & Validation Constraint | UI Control & Default |
| --- | --- | --- | --- |
| `#20` Side Tabs | `OpenItemListQueryDto.side` | `SubledgerSide` (`'AR' \| 'AP'`), **required** | Top `Tabs`, default `'AR'` |
| `#20` Party Filter | `OpenItemListQueryDto.partyId` | `UUID` optional | `<PartyPicker />` |
| `#20` Status Filter | `OpenItemListQueryDto.status` | `OpenItemStatus` optional (`OPEN`, `PARTIALLY_SETTLED`, `SETTLED`, `WRITTEN_OFF`, `DISPUTED`) | `Select` |
| `#20` Due Window | `OpenItemListQueryDto.dueAfter` / `dueBefore` | `ISODate` optional | `DatePicker` range |
| `#20` Dispute Filter | `OpenItemListQueryDto.disputeStatus` | `DisputeStatus` optional (`NONE`, `OPEN`, `RESOLVED`, `ESCALATED`) | `Select` |
| `#20` Dunning Level | `OpenItemListQueryDto.dunningLevel` | `number` integer `>= 0` optional | `Select` (`0..6`) |
| `#20` Currency | `OpenItemListQueryDto.currencyCode` | `CurrencyCode` (`^[A-Z]{3}$`) optional | `Select` |
| `#20` Aging As-Of | `OpenItemListQueryDto.agingAsOf` | `ISODate` optional | `DatePicker`, default business date |
| `#20` Paging | `OpenItemListQueryDto.limit` / `cursor` | `limit`: `1..500` (`MAX_LEDGER_PAGE_SIZE`); `cursor`: opaque string (`page` & `cursor` mutually exclusive; `cursor` required past page `200`) | `<AccountingLedgerGrid>` |
| `#20` Export | `OpenItemExportQueryDto` (`ExportQueryDto`) | `format: 'CSV' \| 'XLSX'` + `OpenItemListQueryDto` filters (**never** `page`, `limit`, `sort`, `cursor` — §13.2 line 4269) | Export dropdown (`CSV` / `XLSX`) |
| `#22` Filters | `SettlementListQueryDto` | `side?`, `partyId?`, `instrumentType?`, `fromSettledOn?`, `toSettledOn?`, `isProvisional?`, `cursor?` + `FindManyDto` (`limit <= 100`) | `<SettlementsFilterBar>` |
| `#24` Filters (`[P24.T03]`) | `AdvanceListQueryDto` | `side?`, `partyId?`, `kind?` (`AdvanceKind`), `fullyApplied?` (`boolean`) + `FindManyDto` (`limit <= 100`) | `<AdvancesScreen>` filter bar |
| `#60` Aging (`[Slice]`) | `AgingQueryDto` *(inline in Catalogue §12; response `AgingReportDto`, `D-772`)* | `side` (`AR`\|`AP`, required), `asOfDate` (`ISODate`, required), `agingBy?` (`DUE_DATE`\|`DOCUMENT_DATE`), `buckets?` (`number[]`, `1..8` asc, `1..3650`), `partyId?` (`UUID[]`, `<= 200`), `currencyMode?` (`PARTY`\|`FUNCTIONAL`), `includeDisputed?` (`boolean`), `branchId?` (`UUID`) | `<AgingReportTab>` parameter bar |

### 7.2 Command DTO Field Mapping & Forbidden-Field Guard (`forbidNonWhitelisted`)

| Command & Route | DTO Interface (`02_DTOs.md`) | Exact Wire Fields Sent by Client | Server-Derived / Forbidden Fields (**Never** Sent on Wire — §8.4 line 2352) |
| --- | --- | --- | --- |
| Create Settlement (`POST /settlements`) `[Slice]` | `CreateSettlementDto` | `side`, `partyId`, `instrumentType` *(restricted set)*, `instrumentRef?`, `instrumentRefType?` *(only on dual-table pairs)*, `settledOn`, `currencyCode`, `totalAmount`, `fxRateId?`, `allocations: [{ openItemId, amountTxn, takeEarlyPaymentDiscount? }]`, `withholdings?: [{ openItemId, amount, taxTypeCode, authorityTaxCode, authoritySubtype }]` (`AR` only), `branchId?`, `memo?` | `allocatedAmount`, `unallocatedAmount`, `status`, `isProvisional`, `journalEntryId`, `realizedFxDifference`, `amountFunctionalAtEntryRate`, `amountFunctionalAtSettlementRate`, `entryFxRate`, `settlementFxRate`, `postedAt` |
| Unallocate (`POST /settlements/:id/unallocate`) `[Slice]` | `UnallocateSettlementDto` | `settlementId` (`UUID`, equals `:id`), `allocationIds?` (`UUID[]`, `1..500`), `reason` (`10..1000` chars), `reversalDate?` (`ISODate >= settledOn`) + header `If-Match` | `reversedAt`, `journalEntryId`, `unallocatedAmount`, `originSettlementId` |
| Reverse Settlement (`POST /settlements/:id/reverse`) `[Slice]` | `ReverseSettlementDto` | Header `If-Match` + `x-idempotency-key`; body `reason` (`ReversalReason`: `MANUAL`, `ERROR_CORRECTION`, `PERIOD_CORRECTION`), `reversalDate?` (`D-772`) | `reversalEntryId`, `reversedAt`, `status` |
| Confirm Provisional (`POST /settlements/:id/confirm`) `[Slice]` | *Undocumented in `02_DTOs.md` — see `CG-RAP-02`* | Header `If-Match` + `x-idempotency-key` *(provisional `CHEQUE` only; body pending `CG-RAP-02`)* | `confirmedAt`, `confirmedBy`, `confirmationEntryId`, `isProvisional` |
| Open / Escalate Dispute (`POST /open-items/:id/dispute`) `[P24.T03]` | `OpenDisputeDto` | `disputeStatus: 'OPEN' \| 'ESCALATED'`, `disputeReason` (`10..1000` chars), `blockDunning?` (`boolean`, default `true`) + header `If-Match` | `status` (`OpenItemStatus`), `disputeOpenedAt`, `dunningBlockReason` |
| Resolve Dispute (`POST /open-items/:id/resolve-dispute`) `[P24.T03]` | `ResolveDisputeDto` | `note` (`10..1000` chars) + header `If-Match` | `disputeStatus` (`RESOLVED`), `disputeResolvedAt`, `status` |
| Block Dunning (`POST /open-items/:id/block-dunning`) `[P24.T03]` | `BlockDunningDto` | `reason: 'MANUAL' \| 'LEGAL'`, `note?` (`<= 1000` chars) + header `If-Match` | `dunningLevel`, `lastDunnedAt` |
| Unblock Dunning (`POST /open-items/:id/unblock-dunning`) `[P24.T03]` | Empty body | `{}` + header `If-Match` | Clears `MANUAL` or `LEGAL` only (`VAL-RAP-38`) |
| Create Advance (`POST /advances`) `[P24.T03]` | `CreateAdvanceDto` | `side`, `partyId`, `kind` (`AdvanceKind`), `currencyCode`, `amount`, `receivedOn`, `treasuryId?` (`AR` only), `bankAccountId?` (`AR` only, mutually exclusive with `treasuryId`), `fiscalDocumentId?`, `taxTreatmentRuleId?` | `advanceNo`, `appliedAmount`, `refundedAmount`, `remainingAmount`, `taxAmount`, `taxAtReceipt`, `status`, `journalEntryId`, `openItemId` |
| Apply Advance (`POST /advances/:id/apply`) `[P24.T03]` | `ApplyAdvanceDto` | `advanceId` (`UUID`, equals `:id`), `applications: [{ openItemId, amount }]` (`1..500`), `appliedOn` (`ISODate`) + header `If-Match` | `appliedAmount`, `remainingAmount`, `status`, `settlementId`, `taxReversalEntryId` |
| Cancel Advance (`POST /advances/:id/cancel`) `[P24.T03]` | *Undocumented in `02_DTOs.md` — see `CG-RAP-02`* | Header `If-Match` + `x-idempotency-key` *(body pending `CG-RAP-02`)* | `status` (`CANCELLED`) |


---

## 8. Boundary, Empty, Loading, Error, `403`, `404`, Entitlement & Tenant Runtime States

### 8.1 Entitlement, RBAC (`403`), Masked Scope (`404`), `RECOVERY_MODE` & `ARCHIVED` Matrix

| State / Condition | Trigger | Rendering Component & Exact Behavior Across `SCR-23` (`#20`..`#25`, `#60`) |
| --- | --- | --- |
| **Missing `accounting.receivables.core` Entitlement** | `/auth/me` entitlements omit `accounting.receivables.core` (or `403 ACCOUNTING.FEATURE.NOT_ENTITLED`) | Renders `<AccountingEntitlementGate featureKey="accounting.receivables.core" />` on `#20`..`#25` and `#60` Tabs 1 & 3. Displays a calm neutral explanation naming the missing capability (`10_Feature_Tiers.md` §11). **Zero upgrade CTA, pricing card, or commercial copy** (`SCR-36` `/accounting/setup/features` is the sole commercial surface). |
| **Missing `accounting.payables.core` Entitlement (Asymmetric Override)** | `accounting.receivables.core` is active, `accounting.payables.core` is absent (`CG-RAP-08`) | `#60` Tab 2 (`entries`) hides/disables the `AP` sub-tab cleanly while keeping `AR` live. On `#22?mode=new` (`side = 'AP'`), the `Allocate Payment` picker (`GET /accounting/payments`) renders a disabled `ReadOnlyGate` note explaining `accounting.payables.core` is required. |
| **Missing `accounting.receivables.credit_control` Entitlement** | Entitlement omits `accounting.receivables.credit_control` | `#60` hides the per-party **Exposure** drawer trigger completely (`PartyExposureQuickDrawer` is never mounted and `GET /accounting/exposure/parties/:partyId` is never called). |
| **`403 Forbidden` — Missing Route Permission or Scope (`PermissionGate`)** | Missing `accounting.open_item.read`, `accounting.settlement.read`, `accounting.advance.read`, `accounting.report.read`, or `accounting.profile.read`, OR backend returns `403` / `ACCOUNTING.SCOPE.TARGET_DENIED` (e.g., branch-only actor accessing `COMPANY`-scoped `#22`, `#23`, `#24`, `#25`, or `#60` Tab 3) | **Never rendered as an empty table.** Renders `<PermissionGate requiredPermission={...} scopeTarget={...} />` stating whether access requires a missing permission or a `COMPANY`-level grant. Secondary widgets (`GET /integrity-checks/latest` requiring `accounting.report.read`, and `GET /exposure/parties/:id` requiring `accounting.credit_exposure.read` per `D-545`) check `/auth/me` before firing and omit themselves silently when unauthorized. |
| **Missing Write Permission (`ReadOnlyGate`)** | User has `.read` but lacks `accounting.settlement.create`, `.unallocate`, `.reverse`, `.confirm`, `accounting.open_item.update`, `accounting.open_item.dispute`, `accounting.advance.create`, or `.apply` | Primary creation links (`?mode=new`) are hidden; contextual lifecycle actions on `#21`, `#23`, `#25` render disabled inside `<ReadOnlyGate reason={t.accounting.common.insufficientPermission} />`. |
| **`404 Not Found` (`NotFoundState`)** | `GET /open-items/:id`, `GET /settlements/:id`, or `GET /advances/:id` returns `404` (including out-of-scope company/branch records masked as `404` per multi-tenancy security policy) | Renders `<EmptyState variant="notFound" />` with neutral copy (*"Record not found or outside your active company/branch scope"*) and a single outline link back to `#20`, `#22`, or `#24`. |
| **`RECOVERY_MODE` (`403 ACCOUNTING.FEATURE.RECOVERY_MODE`)** | Tenant/company in incident recovery mode | Persistent top `caution` banner across `#20`..`#25` & `#60`. All reads (`GET`, `POST /search`, `POST /count`, `GET /reports/aging`) remain fully operational. Every write (`POST /settlements*`, `PATCH/POST /open-items*`, `POST /advances*`, `POST /open-items/export`) is disabled with `<ReadOnlyGate>` citing active recovery fencing. |
| **`ARCHIVED` Company (`D-609`)** | Company lifecycle state is `ARCHIVED` | Persistent neutral retention banner (*"Archived company books — historical installments, settlements, advances, and aging remain inspectable; posting and lifecycle mutations are permanently disabled"*). |
| **`503` Entitlement / Provisioning Unavailable** | `503 ACCOUNTING.SYSTEM.ENTITLEMENT_UNAVAILABLE` or `PROVISIONING_MAINTENANCE` | Fail-closed `<RetryablePanel>` (`RETRY_AFTER_BACKOFF`) displaying `correlationId` and a manual `Retry` button; zero optimistic caching or fallback bypass. |

### 8.2 Loading Skeletons & Empty States Per Route

| Route | Loading State (`prefers-reduced-motion` safe) | Zero-Data Empty State | Filtered-Zero Empty State |
| --- | --- | --- | --- |
| `#20` `/accounting/post/open-items` | Header + Side tabs live immediately; `4` metric strip skeletons + `10 × 40px` compact table row skeletons (`tabular-nums` placeholder bars). | Neutral icon + *"No {AR\|AP} open items yet — installments appear automatically when customer or supplier fiscal documents, advances, or journals post."* + outline link to `#16` Documents. | *"No open items match the current filters"* + **`[Clear Filters]`** (`variant="outline"`). |
| `#21` `/accounting/post/open-items/[id]` | `DetailHeader` skeleton + `2`-column summary card skeleton + `5`-row subledger movement skeleton. | Handled via `404` `NotFoundState` if `:id` does not exist; Card 4 shows *"No settlement allocations yet — full installment remains open"* when `settledAmount === '0.00000000'`. | N/A |
| `#22` `/accounting/post/settlements` | Filter bar + `10 × 40px` table row skeletons. | *"No settlements posted yet"* + primary CTA **`[New Settlement]`** (when `can('accounting.settlement.create')`). | *"No settlements match the current filters"* + **`[Clear Filters]`**. |
| `#22?mode=new` Allocation Workspace | Step 1 fields interactive immediately; Step 2 shows `"Select a party and currency to load open installments"` placeholder before selection, then `6`-row candidate skeleton while `GET /open-items` resolves. | When selected `partyId` has `0` open items in `currencyCode`: informational callout *"This party has no open {currencyCode} installments. Submitting with 0 allocations will post an on-account `UNAPPLIED_SETTLEMENT` credit balance."* (`02_DTOs.md` line 2037). | Filter search inside candidate grid shows *"No matching installments"* + **`[Reset Filter]`**. |
| `#23` `/accounting/post/settlements/[id]` | `DetailHeader` + Financial card + Allocations ledger skeleton. | When `allocations[]` is empty (`allocatedAmount === '0.00000000'`): *"On-account settlement — no open items allocated (`unallocatedAmount` held as `UNAPPLIED_SETTLEMENT`)."* | N/A |
| `#24` `/accounting/post/advances` `[P24.T03]` | Filter bar + `8 × 40px` row skeletons. | *"No customer or supplier advances recorded"* + primary CTA **`[New Advance]`**. | *"No advances match the current filters"* + **`[Clear Filters]`**. |
| `#25` `/accounting/post/advances/[id]` `[P24.T03]` | `DetailHeader` + Funding card + Candidate application grid skeleton. | Candidate grid empty when party has no open invoices: *"No open {AR\|AP} installments available to apply this advance against yet."* | N/A |
| `#60` `/accounting/reconcile/subledgers` | Integrity strip skeleton + parameter bar + `8`-row Aging / Subledger / Merge table skeleton. | Tab 1: *"No open balances as of {asOfDate}."*; Tab 2: *"No {AR\|AP} subledger entries in range."*; Tab 3 (`[P24.T03]`): *"No party merges recorded for this company."* | **`[Reset Parameters]`** outline button. |

### 8.3 Exhaustive Domain Error Recovery Matrix (`Cause + Effect + Safe Next Action`)

Every API failure preserves `correlationId` (`<IdentifierText>`) and renders `Cause` (what rule tripped) + `Effect` (confirming nothing partially mutated) + `Safe Next Action` (`04_Errors_and_Constants.md` §3.1–§3.4, §3.9, §3.10, §3.12):

| Error Code | HTTP | Retry Class / Safe Action | User-Facing `Cause` + `Effect` + `Safe Next Action` in `SCR-23` |
| --- | --- | --- | --- |
| `ACCOUNTING.OPEN_ITEM.ALREADY_SETTLED` | `409` | `DO_NOT_RETRY` · `REFRESH_RESOURCE` | **Cause:** One or more selected installments were settled concurrently. **Effect:** Settlement was not posted. **Next action:** Click **Refresh Candidate Items** to reload live `remainingAmount` balances (`new UUIDv7` on next submit). |
| `ACCOUNTING.OPEN_ITEM.WRITTEN_OFF` | `409` | `DO_NOT_RETRY` · `SHOW_VALIDATION_MESSAGES` | **Cause:** Installment is `WRITTEN_OFF` and cannot accept allocations, disputes, or dunning blocks. **Effect:** Unchanged. **Next action:** Deselect the written-off item (or inspect write-off `#88` on `SCR-24`). |
| `ACCOUNTING.OPEN_ITEM.CURRENCY_MISMATCH` | `422` | `FIX_INPUT_THEN_RETRY` · `SHOW_VALIDATION_MESSAGES` | **Cause:** Selected open item currency differs from settlement/advance `currencyCode` (`VAL-RAP-04`). **Effect:** Unchanged. **Next action:** Keep only installments matching `currencyCode`. |
| `ACCOUNTING.OPEN_ITEM.PARTY_MISMATCH` / `ACCOUNTING.ADVANCE.PARTY_MISMATCH` | `422` | `FIX_INPUT_THEN_RETRY` · `SHOW_VALIDATION_MESSAGES` | **Cause:** An allocated open item belongs to a different `partyId` (`VAL-RAP-03`). **Effect:** Unchanged. **Next action:** Remove mismatched rows and re-select from the active party's open items. |
| `ACCOUNTING.OPEN_ITEM.DISPUTED` / `ACCOUNTING.SETTLEMENT.ITEM_DISPUTED` | `409` | `DO_NOT_RETRY` · `REFRESH_RESOURCE` | **Cause:** Installment entered `OPEN`/`ESCALATED` dispute or dunning action was attempted while disputed (`VAL-RAP-38`). **Effect:** Unchanged. **Next action:** On `#21`, resolve the dispute via `resolve-dispute` rather than `unblock-dunning`; on `#22?mode=new`, refresh items and confirm explicit override if settling intentionally. |
| `ACCOUNTING.OPEN_ITEM.ILLEGAL_DISPUTE_TRANSITION` | `409` | `DO_NOT_RETRY` · `REFRESH_RESOURCE` | **Cause:** Dispute state changed since `#21` loaded (e.g. already `RESOLVED` or `NONE`). **Effect:** Unchanged. **Next action:** Reload `#21` (`GET /open-items/:id`) to sync `ETag` and `disputeStatus`. |
| `ACCOUNTING.SETTLEMENT.OVER_ALLOCATION` | `422` | `FIX_INPUT_THEN_RETRY` · `SHOW_VALIDATION_MESSAGES` | **Cause:** Allocation + withholding exceeds an item's live `remainingAmount` (`VAL-RAP-01`) or `Σ allocations > totalAmount` (`VAL-RAP-02`). **Effect:** Unchanged. **Next action:** Click **Refresh Balances** and reduce `amountTxn` or `withholdings[].amount`. |
| `ACCOUNTING.SETTLEMENT.DISCOUNT_NOT_ELIGIBLE` | `422` | `FIX_INPUT_THEN_RETRY` · `SHOW_VALIDATION_MESSAGES` | **Cause:** `settledOn > discountDate` or cash + WHT + `discountAmount` does not close the full installment (`VAL-RAP-09`). **Effect:** Unchanged. **Next action:** Uncheck `takeEarlyPaymentDiscount` or adjust `amountTxn` / `settledOn`. |
| `ACCOUNTING.SETTLEMENT.INSTRUMENT_REQUIRED` / `INSTRUMENT_TYPE_UNAVAILABLE` | `422` | `FIX_INPUT_THEN_RETRY` · `SHOW_VALIDATION_MESSAGES` | **Cause:** Missing `instrumentRef`, invalid `(side, instrumentType, instrumentRefType)` tuple (`VAL-RAP-42`), or command-owned instrument type submitted to `POST /settlements`. **Effect:** Unchanged. **Next action:** Select a valid treasury/bank/payment/credit-item reference or use the owning screen link (`SCR-24` / `SCR-25` / `SCR-26`). |
| `ACCOUNTING.SETTLEMENT.LINKED_SETTLEMENT` | `409` | `DO_NOT_RETRY` · `NAVIGATE_TO_OWNER` | **Cause:** `unallocate` or `reverse` was called on a companion/paired settlement (`VAL-RAP-37` / linked set). **Effect:** Unchanged. **Next action:** Use **Reverse Settlement** on the parent settlement (`#23`), or open the owning Netting (`#87`), Payment Plan (`#93`), or Custody (`#30`) record. |
| `ACCOUNTING.SETTLEMENT.PROVISIONAL_NOT_CONFIRMED` | `409` | `DO_NOT_RETRY` · `SHOW_VALIDATION_MESSAGES` | **Cause:** `POST /settlements/:id/confirm` was called on a `WITHHOLDING_CERTIFICATE` provisional settlement (`VAL-RAP-39`) or before cheque clearance. **Effect:** Unchanged. **Next action:** Register the customer tax certificate on `#46` (`SCR-16`) or collect the cheque on `#39` (`SCR-26`). |
| `ACCOUNTING.SETTLEMENT.ALREADY_REVERSED` / `NOT_POSTED` | `409` | `DO_NOT_RETRY` · `REFRESH_RESOURCE` | **Cause:** Settlement was already reversed by another session. **Effect:** Unchanged. **Next action:** Reload `#23` to inspect `reversalEntryId`. |
| `ACCOUNTING.ADVANCE.NOT_RECEIVED` `[P24.T03]` | `409` | `DO_NOT_RETRY` · `NAVIGATE_TO_OWNER` | **Cause:** Advance has not yet posted its receipt/disbursement journal (`journalEntryId === null`, `VAL-RAP-36`) or inbound cheque is not yet `COLLECTED`. **Effect:** Advance was not applied. **Next action:** Complete the payment (`#31`/`#32`) or cheque lifecycle (`#38`/`#39`) on `SCR-26` first. |
| `ACCOUNTING.ADVANCE.FULLY_APPLIED` / `NOT_CANCELLABLE` `[P24.T03]` | `409` | `DO_NOT_RETRY` · `REFRESH_RESOURCE` | **Cause:** Advance has zero `remainingAmount`, or `cancel` was attempted after funds moved / while a linked `DRAFT`/`APPROVED` payment exists. **Effect:** Unchanged. **Next action:** Reload `#25`; cancel any pending payment on `#32` (`SCR-26`) before cancelling an unfunded advance. |
| `ACCOUNTING.ADVANCE.TAX_RULE_MISSING` `[P24.T03]` | `422` | `FIX_INPUT_THEN_RETRY` · `SHOW_VALIDATION_MESSAGES` | **Cause:** Selected `taxTreatmentRuleId` is missing or not configured for advance receipt tax (`VAL-RAP-16`). **Effect:** Unchanged. **Next action:** Pick a valid advance tax rule or inspect Tax Rules (`#42` `SCR-14`). |
| `ACCOUNTING.FX.RATE_MISSING` / `RATE_STALE` / `BACKDATED_CARRYING_CONFLICT` | `422` / `409` | `FIX_INPUT_THEN_RETRY` | **Cause:** No valid `SPOT` rate for `(currencyCode, functionalCurrency, settledOn)` or backdated settlement precedes a later carrying revaluation (`D-540`). **Effect:** Unchanged. **Next action:** Maintain the exchange rate on `#103` (`SCR-02`) or adjust `settledOn`. |
| `ACCOUNTING.PERIOD.CLOSED` / `SOFT_CLOSED` / `PERMANENTLY_CLOSED` / `BACKDATE_LIMIT` / `FUTURE_NOT_OPEN` | `409` / `422` | `FIX_INPUT_THEN_RETRY` | **Cause:** `settledOn`, `reversalDate`, `receivedOn`, or `appliedOn` falls outside an open `AR`/`AP`/`GL` period or exceeds backdate policy. **Effect:** Unchanged. **Next action:** Choose a date in the open period or request period reopen on `#55` (`SCR-19`). |
| `ACCOUNTING.BANK.ACCOUNT_INACTIVE` / `RECONCILED_RANGE_POSTING` / `ACCOUNTING.TREASURY.CLOSED` / `NEGATIVE_BALANCE` | `409` | `FIX_INPUT_THEN_RETRY` | **Cause:** Selected bank account is closed/reconciled past `settledOn`, or treasury session is closed / insufficient cash. **Effect:** Unchanged. **Next action:** Pick an active bank/treasury or adjust `settledOn` into an unreconciled open window. |
| `ACCOUNTING.CONCURRENCY.STALE_VERSION` / `IF_MATCH_REQUIRED` | `409` / `428` | `DO_NOT_RETRY` · `PROMPT_RELOAD_MERGE` | **Cause:** Resource `ETag` changed in another tab/user session. **Effect:** Mutation rejected cleanly before commit. **Next action:** `<StaleVersionModal>` reloads fresh record + `ETag`, highlights changed amounts/statuses, and generates a fresh UUIDv7 key only if the user re-confirms. |
| `ACCOUNTING.IDEMPOTENCY.IN_FLIGHT` or HTTP Timeout / `502` / `503` / `504` | `409` / Net | `RETRY_SAME_KEY` · `POLL_OR_REPLAY_WITH_SAME_KEY` | **Cause:** Original request is still executing or response dropped in transit. **Effect:** Outcome unknown — **never assume failure and never generate a new idempotency key**. **Next action:** `<AmbiguousOutcomePanel>` retains the exact `x-idempotency-key` in hook state and offers **`[Check / Reconcile Outcome]`** (replays with the identical `x-idempotency-key` or checks `#22`/`#24`). |

---

## 9. Waiting States & Post-Bound Compensation Matrix (`Zero-Resend Law`)

Per `accounting-patterns-workflow.md` (`UX-05`) and the brief's non-negotiable rule, **no waiting state in `SCR-23` ever renders a "Resend", "Re-post", or duplicate creation button**. Every waiting state names (1) what is awaited, (2) the deadline / SLA anchor, (3) the responsible owner, (4) the exact safe next action, and (5) the post-bound compensation path if the external event fails:

| ID & Stage | Trigger Predicate & Screens | Deadline / Time Bound | Responsible Owner | Safe Next Action (Zero-Resend) | Post-Bound Failure / Compensation Path |
| --- | --- | --- | --- | --- | --- |
| **`WS-RAP-01`**<br/>Provisional Cheque Settlement<br/>`[Slice — P19.T08]` | `isProvisional === true && confirmedAt === null && reversedAt === null && instrumentType === 'CHEQUE'` on `#22`, `#23` (and referenced on `#21`) | Cheque `maturityDate` + bank collection clearing window on `instrumentRef` (`#39` `SCR-26`) | **Treasury / Collections Accountant** (`accounting.instrument.Clearing` / `accounting.settlement.confirm`) | **1.** Open linked Cheque `#39` (`/accounting/post/instruments/[instrumentRef]`) to track `DEPOSITED -> COLLECTED/CLEARED`; **or** **2.** Execute `POST /accounting/settlements/:id/confirm` (`If-Match` + single UUIDv7) when authorized. **Never** create a second settlement for the same cheque or invoice. | If the cheque **bounces / returns** (`RETURNED` / `BOUNCED` on `SCR-26` `#39`, `SCN-036`), the instrument transition reverses the provisional settlement, restores `acc_open_items.remaining_amount` & `status` (`OPEN`/`PARTIALLY_SETTLED`), unfreezes dunning, and posts any bank return fee separately. |
| **`WS-RAP-02`**<br/>Provisional AR Withholding Companion<br/>`[Slice — P19.T08]` | `isProvisional === true && confirmedAt === null && reversedAt === null && instrumentType === 'WITHHOLDING_CERTIFICATE'` on `#22`, `#23` (`SCN-035`, `D-042`) | Statutory quarterly certificate filing window (e.g., Egypt Form 41 quarterly deadline + grace days configured in country pack) | **AR / Tax Accountant** (`accounting.withholding_certificate.create` on `SCR-16`) | Click **"Register Tax Certificate (`#46`)"** (`/accounting/file/withholding-certificates`) when the customer delivers the official deduction certificate (`Dr WHT_RECEIVABLE_CERTIFIED / Cr WHT_RECEIVABLE_UNCERTIFIED`, setting `confirmedAt`). **`POST /settlements/:id/confirm` is forbidden (`VAL-RAP-39`) and hidden**; **never** re-post the parent receipt. | If the statutory window expires and the customer never remitted/certified the deduction, execute **`POST /accounting/settlements/:id/reverse`** on the provisional WHT companion (`#23`), reopening the deducted slice on `acc_open_items` for collection or dunning. |
| **`WS-RAP-03`**<br/>Unfunded `OPEN` Advance<br/>`[Full stage — P24.T03]` | `Advance.status === 'OPEN' && journalEntryId === null` on `#24`, `#25` (`AP` advances per `VAL-RAP-35`, and `AR` cheque-funded advances per `D-425`) | Planned payment execution date (`#31`/`#32`) or cheque receipt/issue date (`#38`/`#39`) | **Treasury / AP / AR Operator** (`accounting.payment.create` / `accounting.instrument.create`) | Follow the deep link from `#25` to **`SCR-26`** (`#31` Single Payment or `#38` Cheque) pre-seeded with `advanceId = advance.id` so disbursement/receipt posts the advance journal and mints its `ADVANCE` open item. **Never** create a duplicate advance on `#24?mode=new`. | If the commercial deposit/prepayment is abandoned before funds move (and any linked `paymentId` is `CANCELLED`/`FAILED`), click **Cancel Advance** (`POST /accounting/advances/:id/cancel` on `#25`) to close the advance `CANCELLED` with zero GL side effects. |
| **`WS-RAP-04`**<br/>Open / Escalated Installment Dispute<br/>`[Full stage — P24.T03]` | `OpenItem.status === 'DISPUTED'` (`disputeStatus` in `'OPEN' \| 'ESCALATED'`) on `#20`, `#21` (`SCN-039`) | Commercial dispute SLA anchored to `disputeOpenedAt` (age badge rendered in days since `disputeOpenedAt`) | **AR Collections / Dispute Specialist** (`accounting.open_item.dispute`) | Inspect evidence attachments (`AttachmentList` on `#21`), escalate if needed (`POST /open-items/:id/dispute` with `ESCALATED`), or record resolution (`POST /open-items/:id/resolve-dispute`). Auto-propose and dunning skip the item automatically while disputed. | **1.** Valid customer claim -> issue & post a Credit Note (`#16` `SCR-06`), then apply via `CREDIT_NOTE_APPLICATION` on `#22?mode=new` (auto-closing or reducing balance, `D-309`); **2.** Uncollectible -> propose Write-Off (`#88` `SCR-24`); **3.** Claim rejected -> `POST /:id/resolve-dispute` restores `OPEN`/`PARTIALLY_SETTLED` and resumes dunning. |
| **`WS-RAP-05`**<br/>Async Open-Items Export Run<br/>`[Slice — P19.T08]` | `POST /accounting/open-items/export` returns `202 Accepted` (`ExportRunSummaryDto` in `PENDING \| RUNNING`) on `#20` | Worker export execution window (polled with bounded backoff `2s -> 5s -> 10s`, timeout callout at `120s`) | **Background Export Worker** (monitored by requesting user via `GET /accounting/exports/runs/:id`) | `<AsyncExportDrawer>` polls **`GET /accounting/exports/runs/:id`** (`READ_LOCATION_OR_POLL`) and enables **`[Download File]`** once `status === 'COMPLETED'`. While `PENDING`/`RUNNING`, the `Export` button shows *"Export in progress…"* and **never** fires a duplicate `POST /export`. | If `status === 'FAILED'` or `EXPIRED` (`D-768`), `<AsyncExportDrawer>` displays `failureReason` + `correlationId` and offers **`[Start New Export]`** with a fresh UUIDv7 `x-idempotency-key`. |
| **`WS-RAP-06`**<br/>Ambiguous In-Flight Mutation<br/>`[Slice — P19.T08]` | Network timeout / `502`/`503`/`504` / `409 ACCOUNTING.IDEMPOTENCY.IN_FLIGHT` on any `SCR-23` write | Server idempotency lock window (`IDEMPOTENCY_LOCK_TTL`) | **Initiating Operator** (in current browser session) | `<AmbiguousOutcomePanel>` freezes form inputs, displays the correlation/idempotency reference, and provides **`[Verify Outcome]`** which replays with the **exact same `x-idempotency-key`** (or queries `#22`/`#21`/`#25`). **Never** mints a new UUIDv7 until a definitive terminal error is confirmed. | Once server returns either the cached `200`/`201` receipt or a deterministic `4xx` validation/conflict error, hook clears the lock and navigates to the created/updated record or surfaces the exact `4xx` fix instructions. |

---

## 10. Four-Combination ASCII Mockups (`AR-RTL` & `EN-LTR` × `Light` & `Dark` + `375px` Mobile)

All wireframes enforce the Five Laws:
- **Single Primary `[● ...]` CTA** per screen (in `PageHeader`, or the sticky commit bar on `#22?mode=new`). Every other button is `outline` `[ ... ]` or `ghost`.
- **4 Semantic Tones Only:** `[✓ ...]` = `positive`, `[! ...]` = `caution`, `[✕ ...]` = `negative`, `[· ...]` = `neutral` (`ink`). Zero decorative stage colors.
- **3 Font Weights:** Page title `600`, section/column headers `500`, **all table body cells `400`** (`tabular-nums`).
- **Bilingual Numerals & Bidi:** Both `AR-RTL` and `EN-LTR` use **Western digits (`0–9`)** (`ar-EG-u-nu-latn`), and every code, UUID, rate, date, and amount sits inside `<bdi dir="ltr">`.

### 10.1 Combination 1 — `Arabic RTL × Light` (`#20` Open Items Explorer + `#21` Detail Split Overview)

- **Theme Tokens (`Light`):** Canvas `--surface-canvas` (`#F8FAFC` / `ink-25`), Card `--surface-card` (`#FFFFFF`), Border `--border-subtle` (`ink-200`), Primary Text `--ink-950`, Secondary Text `--ink-600`, Brand Fill `--brand-600` (`#FFFFFF` text, contrast `>= 5.2:1`).
- **Direction (`dir="rtl"`):** Sidebar on **right** (`inline-start`); primary CTA at **inline-end (left)**; numeric amounts `text-end` in `<bdi dir="ltr">` with Western digits.

```text
+----------------------------------------------------------------------------------------------------------------------+
| [شريط التنقل العلوي: شركة الأمل للتجارة (EGP) ▾ | الفرع: الكل ▾ | الفترة: 2026-11 مفتوحة]      [المظهر: فاتح | AR] |
+--------------------------------------------------------------------------------------------------+-------------------+
| [ · التسويات (#22) ]  [ · أعمار الديون (#60) ]  [ · تصدير ▾ ]  [● تسوية جديدة (#22?mode=new) ]   | القائمة الجانبية  |
| بنود الذمم المفتوحة والأقساط (#20)                                       الأستاذ والترحيل ‹ المحاسبة | ───────────────── |
+--------------------------------------------------------------------------------------------------+ نظرة عامة         |
| [ ذمم الموردين الدائنة (AP) ]                        [● ذمم العملاء المدينة (AR) — نشط ]         | الترحيل (Post)    |
+--------------------------------------------------------------------------------------------------+  • اليومية        |
| +--------------------+  +----------------------+  +----------------------+  +------------------+ |  • المستندات      |
| | بنود متنازع عليها  |  | متأخرات مستحقة       |  | أرصدة دائنة غير موزعة|  | إجمالي المتبقي   | |  ● الذمم المفتوحة |
| | [P24.T03: 2 بنود]  |  | [! 142,500.00 EGP]   |  | [· -15,000.00 EGP]   |  | 485,200.00 EGP   | |  • التسويات       |
| +--------------------+  +----------------------+  +----------------------+  +------------------+ |  • الدفعات المقدمة|
| [بحث متقدم ⛃] [العملة: الكل ▾] [النزاع: الكل ▾] [الحالة: مفتوح/جزئي ▾] [الطرف: ابحث بالاسم/الكود…] | المطابقة          |
| شريط التحديد الجماعي (الطرف: CUST-00142 · EGP · بندان محددان): [● تسوية المحدد (2) -> #22?mode=new] |  • الأستاذ الفرعي |
+--------------------------------------------------------------------------------------------------+-------------------+
| إجراء     | الحالة والنزاع        | المتبقي (LTR)    | المسدد (LTR)    | الاستحقاق  | القسط / الأصل | الطرف       |☑|
|-----------+-----------------------+------------------+-----------------+------------+---------------+-------------+-|
| [تسوية]   | [! مسدد جزئياً]       |   42,500.00 EGP  |  57,500.00 EGP  | 2026-10-15 | #1/2 · INV    | شركة النور  |☑|
|           | [· تذكير مستوى 1]     |                  |                 | (متأخر 17d)| 0195f2a1…8c10 | CUST-00142  | |
| [تسوية]   | [· مفتوح · خصم مبكر✓] |  100,000.00 EGP  |       0.00 EGP  | 2026-11-10 | #2/2 · INV    | شركة النور  |☑|
|           | خصم حتى 2026-11-05    |                  |                 |            | 0195f2a1…8c11 | CUST-00142  | |
| [عرض #21] | [✕ متنازع عليه · OPEN]|   65,000.00 EGP  |       0.00 EGP  | 2026-09-30 | #1/1 · INV    | مصنع الدلتا |☐|
|           | [· حظر مطالبة: نزاع]  |  (3,250,000 EGP) |    (USD @ 50.0) | (متأخر 32d)| 0195f190…4a02 | CUST-00189  | |
+--------------------------------------------------------------------------------------------------+-------------------+
| [السابق]  عرض 1–50 من 128 بنداً (POST /open-items/count) · مؤشر التمرير: cursor نشط   [التالي ‹] |                   |
+--------------------------------------------------------------------------------------------------+-------------------+
```

### 10.2 Combination 2 — `Arabic RTL × Dark` (`#22?mode=new` Allocation & Realized FX Workspace)

- **Theme Tokens (`Dark`):** Canvas `--surface-canvas` (`#0B0F17` / `ink-950`), Card `--surface-card` (`#111827` / `ink-900`), Elevated Sticky Bar `--surface-overlay` (`#1F2937` / `ink-800`), Border `--border-subtle` (`ink-800`), Primary Text `--ink-50`, Secondary Text `--ink-400`, Caution surface `amber-950/50` + `amber-300` text (`>= 7.1:1`).

```text
+----------------------------------------------------------------------------------------------------------------------+
| [المظهر: داكن | AR]       [شركة الأمل للتجارة (العملة الوظيفية: EGP) | الفرع: القاهرة | الفترة: 2026-11 مفتوحة]     |
+----------------------------------------------------------------------------------------------------------------------+
| [ إلغاء والعودة إلى #22 ]                                   تسوية وتخصيص جديد (#22?mode=new)  ‹  التسويات (#22)     |
+----------------------------------------------------------------------------------------------------------------------+
| الخطوة 1: بيانات أداة القبض / الدفع وسعر الصرف (CreateSettlementDto — [Slice P19.T08])                               |
| +------------------------------------------------------------------------------------------------------------------+ |
| | التاريخ (settledOn): [ 2026-11-01 📅 ]   الطرف (partyId): [ شركة النور · CUST-00142 ✕ ]   الجانب: (● AR) (○ AP) | |
| | الحساب البنكي (instrumentRef): [ CIB-USD-01 · 100204991 ▾ ]    نوع الأداة (instrumentType): [ BANK_TRANSFER ▾ ]  | |
| | إجمالي الأداة فقط (totalAmount): [          2,000.00 USD ]     العملة (currencyCode): [ USD ▾ ]                  | |
| | ℹ شريط سعر الصرف الفوري (<FxRateStrip> · POST /fx-rates/resolve):                                                | |
| |   [✓ SPOT · 2026-11-01: 1 USD = 50.250000000000 EGP · fxRateId: 0195f8b0…1120] (يُرحل فرق العملة المحقق تلقائياً)| |
| |   روابط سريعة للأدوات المملوكة لشاشات أخرى: [شيك -> #38] [مقاصة -> #86] [شطب -> #88] [دفعة مقدمة P24.T03 -> #25]| |
| +------------------------------------------------------------------------------------------------------------------+ |
| الخطوة 2: البنود المفتوحة المرشحة للتخصيص والخصم النقدي المبكر (MAX_ALLOCATIONS = 500)                                |
| [ ↺ تحديث الأرصدة ]   [ التوزيع التلقائي للأقدم استحقاقاً (يتخطى المتنازع عليه والقانوني D-154) ]                    |
| +------------------------------------------------------------------------------------------------------------------+ |
| | المبلغ المخصص (amountTxn) | خصم تعجيل الدفع | سعر القيد مقابل التسوية | المتبقي الحي   | الاستحقاق  | القسط    |☑| |
| |---------------------------+-----------------+-------------------------+----------------+------------+----------+-| |
| | [        1,200.00 USD ]   | [☐ غير مؤهل]    | القيد: 49.80 -> 50.25   |  1,200.00 USD  | 2026-10-10 | #1/1 INV |☑| |
| |   [تعبئة المتبقي]         | انتهى 2026-10-20| [· فرق عملة محقق عند الحفظ] |          | (متأخر 22d)| 0195e0…1 | | |
| | [          780.00 USD ]   | [☑ خصم 20.00]   | القيد: 50.10 -> 50.25   |    800.00 USD  | 2026-11-15 | #1/1 INV |☑| |
| |   (780 نقد + 20 خصم = 800)| صالح لـ 2026-11-05| [· فرق عملة محقق عند الحفظ] |          |            | 0195f4…9 | | |
| | [            0.00 USD ]   | [—]             | القيد: 50.00 -> 50.25   |    500.00 USD  | 2026-09-25 | #1/1 INV |☐| |
| |                           |                 | [! متنازع عليه OPEN — يتطلب تأكيد يدوي للتسوية]       | 0195d1…4 | | |
| +------------------------------------------------------------------------------------------------------------------+ |
| ▾ خصم منبع العميل المؤقت — بانتظار الشهادة (AR withholdings[] · اختياري · لا يُضاف إلى totalAmount حسب D-535)       |
|   [ + إضافة سطر خصم منبع (taxTypeCode / authorityTaxCode / authoritySubtype) ]  (0 أسطر مضافة حالياً)               |
+----------------------------------------------------------------------------------------------------------------------+
| شريط التوازن الدقيق (BigInt 10^8) — السطح المرتفع (--surface-overlay):                                               |
| [● ترحيل التسوية (POST /settlements)]  | غير مخصص (رصيد دائن): [! 20.00 USD] | المخصص: 1,980.00 USD | الإجمالي: 2,000.00 USD |
| (سيُنشئ المتبقي 20.00 USD بند دفعة غير مخصصة UNAPPLIED_SETTLEMENT للعميل + تسوية مرافقة للخصم النقدي 20.00 USD)     |
+----------------------------------------------------------------------------------------------------------------------+
```

### 10.3 Combination 3 — `English LTR × Light` (`#23` Settlement Detail + Provisional Waiting Callout + `#25` `[P24.T03]` Advance Inset)

- **Theme Tokens (`Light`):** Canvas `#F8FAFC`, Card `#FFFFFF`, Caution Callout `amber-50` border `amber-300` text `amber-950`, Positive Badge `emerald-50` text `emerald-800`.
- **Direction (`dir="ltr"`):** Sidebar on **left** (`inline-start`); primary CTA at **inline-end (right)**; numeric columns right-aligned (`text-end tabular-nums`).

```text
+--------------------+-------------------------------------------------------------------------------------------------+
| Sidebar            | Accounting > Post > Settlements (#22) > 0195f8c2-7b10-7000-8112-0049a811c020        [EN | Light]|
| ────────────────── | Settlement 0195f8c2…c020  [· AR] [· WITHHOLDING_CERTIFICATE] [! Provisional]                    |
| Overview           |   Parent Settlement: 0195f8c2…c019 (#23)    [ Reverse Settlement ]  [ Register WHT Cert (#46) ] |
| Post               |   (Note: Confirm Provisional is hidden per VAL-RAP-39; WHT confirms only via SCR-16 #46)        |
|  • Journals        +-------------------------------------------------------------------------------------------------+
|  • Documents       | [! WAITING STATE WS-RAP-02 — Awaiting Customer Withholding Tax Certificate (Zero-Resend)]       |
|  • Open Items      | • Deadline: Statutory Form 41 quarterly window (2027-01-31)   • Owner: AR / Tax Accountant      |
|  ● Settlements     | • Safe Next Action: Register certificate on #46 (/accounting/file/withholding-certificates)     |
|  • Advances [P24]  |   once received. Never re-post the parent receipt. If customer did not deduct WHT, use Reverse. |
| Reconcile          +-------------------------------------------------------------------------------------------------+
|  • Subledgers      | Financial & Audit Summary (ETag: "3")                                                           |
|                    | +-----------------------------------------------+---------------------------------------------+ |
|                    | | Settled On:      2026-11-01                   | Total Amount:               40.00 USD       | |
|                    | | Party:           CUST-00142 · Al-Noor Co.     | Allocated Amount:           40.00 USD       | |
|                    | | FX Snapshot:     50.250000000000 (USD -> EGP) | Unallocated Remainder:       0.00 USD       | |
|                    | | Journal Entry:   JE-2026-000842 (#15)         | Functional Total:        2,010.00 EGP       | |
|                    | +-----------------------------------------------+---------------------------------------------+ |
|                    | Append-Only Settlement Allocations & Realized FX (GET /settlements/:id/allocations)             |
|                    | +---------------+--------------+---------------+---------------+----------------+-------------+ |
|                    | | Open Item     | Allocated    | Entry FX Rate | Settle FX     | Functional @   | Realized FX | |
|                    | | (#21 Link)    | (amountTxn)  | Snapshot      | Snapshot      | Settle Rate    | Difference  | |
|                    | +---------------+--------------+---------------+---------------+----------------+-------------+ |
|                    | | 0195f4…9 (#1) |    40.00 USD | 50.1000000000 | 50.2500000000 |   2,010.00 EGP |  +6.00 EGP  | |
|                    | +---------------+--------------+---------------+---------------+----------------+-------------+ |
|                    +-------------------------------------------------------------------------------------------------+
|                    | [Full stage completion — P24.T03 Inset: #25 /accounting/post/advances/[id] Funding & Apply]     |
|                    | Advance ADV-2026-000019 · [· AP] [· PREPAYMENT_INVOICE] [! OPEN — Unfunded (WS-RAP-03)]         |
|                    | Amount: 50,000.00 EGP | Applied: 0.00 EGP | Remaining: 50,000.00 EGP | Journal: — (Pending)     |
|                    | [! Waiting for AP Disbursement on SCR-26: [ Create Payment (#31) ] [ Issue Cheque (#38) ]       |
|                    |    Apply Advance is disabled until payment clears (VAL-RAP-36). [ Cancel Advance ] available.]  |
+--------------------+-------------------------------------------------------------------------------------------------+
```

### 10.4 Combination 4 — `English LTR × Dark` (`#60` Subledger & Aging Reconciliation Workspace)

- **Theme Tokens (`Dark`):** Canvas `#0B0F17`, Card `#111827`, Positive Integrity Strip `emerald-950/60` border `emerald-800` text `emerald-300`, Table Header `ink-900`, Body `ink-50` weight `400`.

```text
+--------------------+-------------------------------------------------------------------------------------------------+
| Sidebar            | Accounting > Reconcile > Subledgers (#60)                                           [EN | Dark] |
| ────────────────── | Subledger & Aging Reconciliation                                [ Party Ledger (#72) ] [ TB #70]|
| Overview           +-------------------------------------------------------------------------------------------------+
| Post               | [✓ SUBLEDGER_EQUALS_CONTROL: PASSED · Verified at chainSeq 1,842 · 2026-11-01T18:55:00Z] [#61]  |
|  • Open Items      +-------------------------------------------------------------------------------------------------+
|  • Settlements     | [● Tab 1: Aging Report (Slice)]  [ Tab 2: Subledger Entries (Slice)]  [ Tab 3: Merges (P24.T03)]|
|  • Advances [P24]  +-------------------------------------------------------------------------------------------------+
| Reconcile          | Side: (● AR) (○ AP) | As Of: [2026-11-01] | Basis: [DUE_DATE ▾] | Buckets: [30, 60, 90, 120 ▾]  |
|  ● Subledgers      | Currency Mode: [FUNCTIONAL (EGP) ▾]  [☑ Include Disputed (match GL AR_CONTROL)]  [● Run Report ] |
|  • Bank Rec        | ℹ FUNCTIONAL mode uses entry_fx_rate or pinned FX_REVALUATION rate_snapshot on period-end (D-540)|
|  • Integrity (#61) +-------------------------------------------------------------------------------------------------+
| Reports            | Freshness: asOf 2026-11-01 · chainSeq 1,842 (Click any bucket cell to drill into #20 Open Items)|
|  • Trial Balance   | +-------------------+------------+------------+------------+-----------+-----------+----------+ |
|  • Party Ledger    | | Party             | Current    | 1–30 Days  | 31–60 Days | > 60 Days | Unapplied | Net EGP  | |
|                    | +-------------------+------------+------------+------------+-----------+-----------+----------+ |
|                    | | CUST-00142 AlNoor | 100,000.00 |  42,500.00 |       0.00 |      0.00 | -1,005.00 |141,495.00| |
|                    | | [Exposure P24.T03]|            |            |            |           |           |          | |
|                    | | CUST-00189 Delta  |       0.00 |       0.00 |  65,000.00 |      0.00 |      0.00 | 65,000.00| |
|                    | +-------------------+------------+------------+------------+-----------+-----------+----------+ |
|                    | | Grand Total (EGP) | 100,000.00 |  42,500.00 |  65,000.00 |      0.00 | -1,005.00 |206,495.00| |
|                    | +-------------------+------------+------------+------------+-----------+-----------+----------+ |
+--------------------+-------------------------------------------------------------------------------------------------+
```

### 10.5 `375px` Mobile Responsive Card Stack (`#20` & `#22?mode=new` Sticky Bar)

Below `md` (`< 768px`), dense multi-column grids switch cleanly to compact stacked cards (`accounting-patterns-data.md` `UX-01`) with `>= 44×44px` touch targets and zero horizontal page overflow:

```text
+-------------------------------------+
| ☰  بنود الذمم المفتوحة (#20)  [+●] |
| [● ذمم العملاء AR] [ذمم الموردين AP]|
| [تصفية (2) ⛃]  إجمالي: 485,200 EGP  |
+-------------------------------------+
| ☑ شركة النور · CUST-00142           |
|   القسط #1/2 · INV · 0195f2a1…8c10  |
|   الاستحقاق: 2026-10-15 (متأخر 17d) |
|   المتبقي: 42,500.00 EGP            |
|   [! مسدد جزئياً]   [ تسوية البند ] |
+-------------------------------------+
| ☑ شركة النور · CUST-00142           |
|   القسط #2/2 · INV · 0195f2a1…8c11  |
|   الاستحقاق: 2026-11-10             |
|   المتبقي: 100,000.00 EGP           |
|   [✓ خصم مبكر متاح] [ تسوية البند ] |
+-------------------------------------+
| شريط التحديد السفلي الثابت:         |
| محددان (142,500.00 EGP) [● تسوية]   |
+-------------------------------------+
```


---

## 11. Bilingual i18n Dictionary Specification (`ar.ts` & `en.ts` — Zero Language Ternaries)

Every label, column header, action, tooltip, waiting state, boundary state, and enum wire value in `SCR-23` resolves through `useI18n()` (`src/i18n/locales/ar.ts` and `src/i18n/locales/en.ts`). Components **never** branch on `locale === 'ar'` to select text, and **never** render raw enum wire values.

```ts
// Parallel bilingual keys under t.accounting (identical shape in en.ts & ar.ts)
export const accountingOpenItemsSettlementsMessages = {
  en: {
    enums: {
      SubledgerSide: {
        AR: 'Accounts Receivable (AR)',
        AP: 'Accounts Payable (AP)',
      },
      OpenItemStatus: {
        OPEN: 'Open',
        PARTIALLY_SETTLED: 'Partially Settled',
        SETTLED: 'Settled',
        WRITTEN_OFF: 'Written Off',
        DISPUTED: 'Disputed',
      },
      OpenItemOrigin: {
        INVOICE: 'Invoice Installment',
        CREDIT_NOTE: 'Credit Note',
        DEBIT_NOTE: 'Debit Note',
        ADVANCE: 'Advance',
        OPENING_BALANCE: 'Opening Balance',
        MANUAL_ADJUSTMENT: 'Manual Adjustment',
        PAYROLL: 'Payroll Run',
        UNAPPLIED_SETTLEMENT: 'Unapplied Settlement Remainder',
        PAYMENT_PLAN_INSTALLMENT: 'Payment Plan Installment',
        RETENTION: 'Retention',
        INTEREST_NOTE: 'Late-Payment Interest Note',
        FX_REVALUATION: 'FX Revaluation Adjustment',
      },
      SettlementInstrumentType: {
        CASH: 'Cash Treasury',
        BANK_TRANSFER: 'Bank Transfer',
        CHEQUE: 'Cheque / Commercial Paper',
        CARD: 'Payment Card',
        EWALLET: 'E-Wallet',
        ADVANCE_APPLICATION: 'Advance Application',
        CREDIT_NOTE_APPLICATION: 'Credit / Debit Note Application',
        NETTING: 'AR/AP Netting',
        CUSTODY: 'Employee Custody Settlement',
        OFFSET: 'Payment Plan / Offset',
        EARLY_PAYMENT_DISCOUNT: 'Early-Payment Discount Companion',
        WITHHOLDING_CERTIFICATE: 'Withholding Tax Companion',
        WRITE_OFF: 'Bad-Debt Write-Off',
        ROUNDING: 'Rounding Companion',
      },
      DisputeStatus: {
        NONE: 'No Dispute',
        OPEN: 'Dispute Open',
        RESOLVED: 'Dispute Resolved',
        ESCALATED: 'Dispute Escalated',
      },
      DunningBlockReason: {
        MANUAL: 'Manual Collections Hold',
        LEGAL: 'Legal Proceedings Hold',
        DISPUTE: 'Blocked by Active Dispute',
        PAYMENT_PLAN: 'Restructured into Payment Plan',
      },
      AdvanceKind: {
        DEPOSIT: 'Security / Commercial Deposit',
        PREPAYMENT_INVOICE: 'Prepayment Invoice',
        RETAINER: 'Retainer',
      },
      AdvanceStatus: {
        OPEN: 'Open',
        PARTIALLY_APPLIED: 'Partially Applied',
        FULLY_APPLIED: 'Fully Applied',
        REFUNDED: 'Refunded',
        CANCELLED: 'Cancelled',
      },
      AgingBasis: {
        DUE_DATE: 'By Due Date',
        DOCUMENT_DATE: 'By Document Date',
      },
      CurrencyMode: {
        PARTY: 'Transaction / Party Currency',
        FUNCTIONAL: 'Company Functional Currency',
      },
    },
    derivedStatus: {
      settlement: {
        reversed: 'Reversed',
        provisional: 'Provisional (Pending Confirmation)',
        unappliedBalance: 'Unapplied Remainder',
        applied: 'Applied',
      },
    },
    openItems: {
      title: 'Open Items & Installments',
      detailTitle: 'Open Item Installment Detail',
      newSettlementCta: 'New Settlement',
      settleSelectedCta: 'Settle Selected ({count})',
      settleItemAction: 'Settle Item',
      exportCsv: 'Export CSV',
      exportXlsx: 'Export XLSX',
      multiSelectPartyCurrencyHint: 'Multi-item settlement requires the same party and currency.',
      columns: {
        party: 'Party',
        installmentOrigin: 'Installment / Origin',
        dueDate: 'Due Date',
        originalAmount: 'Original',
        settledAmount: 'Settled',
        remainingAmount: 'Remaining',
        statusDispute: 'Status & Dunning',
      },
      discountEligibleBadge: 'Early discount {amount} {currency} until {date}',
      disputeActions: {
        open: 'Open Dispute',
        escalate: 'Escalate Dispute',
        resolve: 'Resolve Dispute',
        blockDunning: 'Block Dunning',
        unblockDunning: 'Unblock Dunning',
        unblockDisputeLockedHint: 'Resolve the active dispute to lift a dispute dunning block.',
      },
    },
    settlements: {
      title: 'Settlements & Allocations',
      createTitle: 'New Settlement & Allocation',
      detailTitle: 'Settlement Detail',
      postCta: 'Post Settlement',
      autoAllocateOldest: 'Auto-Allocate Oldest Due',
      autoAllocateSkippedNote: 'Skipped {count} disputed or legal-hold items — select manually to override.',
      fillRemaining: 'Fill Remaining',
      instrumentTotal: 'Instrument Amount Only',
      allocatedCash: 'Allocated Amount',
      unallocatedRemainder: 'Unallocated Remainder',
      fullyAllocated: 'Fully Allocated',
      onAccountRemainderNote: 'Remainder posts an UNAPPLIED_SETTLEMENT credit open item.',
      overAllocatedError: 'Allocated amount exceeds available instrument or installment balance.',
      fxDeltaIndicator: 'Realized FX gain/loss posts automatically on submit',
      withholdingsSection: 'Customer Withholding Deductions (Provisional)',
      actions: {
        confirmProvisional: 'Confirm Provisional Cheque',
        registerWhtCert: 'Register Tax Certificate',
        unallocate: 'Unallocate Items',
        reverse: 'Reverse Settlement',
      },
    },
    advances: {
      title: 'Customer & Supplier Advances',
      createTitle: 'New Advance',
      detailTitle: 'Advance Detail',
      applyCta: 'Apply Advance to Installments',
      cancelAction: 'Cancel Unfunded Advance',
      apFundingHint: 'AP advances record commercial intent first; link a payment (#31) or cheque (#38) to disburse.',
    },
    subledgerReconcile: {
      title: 'Subledger & Aging Reconciliation',
      integrityPassed: 'Subledger = Control Account Verified ({code})',
      integrityFailed: 'Subledger vs Control Drift Detected ({count} findings)',
      tabs: {
        aging: 'Aging Report',
        entries: 'Subledger Entries',
        partyMerges: 'Party Merge Lineage',
      },
      includeDisputedLabel: 'Include disputed items (match GL control balance)',
      functionalRateNote: 'Uses entry FX rate, or pinned FX revaluation rate on period-end dates.',
    },
    waitingStates: {
      provisionalChequeTitle: 'Awaiting Cheque Clearance Confirmation',
      provisionalWhtTitle: 'Awaiting Customer Withholding Tax Certificate',
      unfundedAdvanceTitle: 'Awaiting Receipt / Disbursement Posting on Treasury & Payments',
      openDisputeTitle: 'Installment Under Active Commercial Dispute',
      exportRunningTitle: 'Generating Open-Items Export File',
      ambiguousMutationTitle: 'Verifying Settlement Outcome — Do Not Resubmit Separately',
    },
  },
  ar: {
    enums: {
      SubledgerSide: {
        AR: 'ذمم العملاء المدينة (AR)',
        AP: 'ذمم الموردين الدائنة (AP)',
      },
      OpenItemStatus: {
        OPEN: 'مفتوح',
        PARTIALLY_SETTLED: 'مسدد جزئياً',
        SETTLED: 'مسدد بالكامل',
        WRITTEN_OFF: 'مشطوب',
        DISPUTED: 'متنازع عليه',
      },
      OpenItemOrigin: {
        INVOICE: 'قسط فاتورة',
        CREDIT_NOTE: 'إشعار دائن',
        DEBIT_NOTE: 'إشعار مدين',
        ADVANCE: 'دفعة مقدمة',
        OPENING_BALANCE: 'رصيد افتتاحي',
        MANUAL_ADJUSTMENT: 'تسوية قيد يدوي',
        PAYROLL: 'مسير رواتب',
        UNAPPLIED_SETTLEMENT: 'رصيد تسوية غير مخصص',
        PAYMENT_PLAN_INSTALLMENT: 'قسط خطة سداد',
        RETENTION: 'محتجز ضمان أعمال',
        INTEREST_NOTE: 'إشعار فوائد تأخير',
        FX_REVALUATION: 'تسوية إعادة تقييم عملة',
      },
      SettlementInstrumentType: {
        CASH: 'خزينة نقدية',
        BANK_TRANSFER: 'تحويل بنكي',
        CHEQUE: 'شيك / ورقة تجارية',
        CARD: 'بطاقة دفع',
        EWALLET: 'محفظة إلكترونية',
        ADVANCE_APPLICATION: 'تطبيق دفعة مقدمة',
        CREDIT_NOTE_APPLICATION: 'تطبيق إشعار دائن / مدين',
        NETTING: 'مقاصة عميل ومورد',
        CUSTODY: 'تسوية عهدة موظف',
        OFFSET: 'مقاصة / خطة سداد',
        EARLY_PAYMENT_DISCOUNT: 'تسوية مرافقة لخصم تعجيل الدفع',
        WITHHOLDING_CERTIFICATE: 'تسوية مرافقة لخصم المنبع',
        WRITE_OFF: 'شطب ديون معدومة',
        ROUNDING: 'فرق تقريب تلقائي',
      },
      DisputeStatus: {
        NONE: 'لا يوجد نزاع',
        OPEN: 'نزاع مفتوح',
        RESOLVED: 'تم حل النزاع',
        ESCALATED: 'نزاع مُصعَّد',
      },
      DunningBlockReason: {
        MANUAL: 'إيقاف مطالبة يدوي',
        LEGAL: 'إيقاف لإجراءات قانونية',
        DISPUTE: 'موقوف بسبب نزاع قائم',
        PAYMENT_PLAN: 'مُجدول ضمن خطة سداد',
      },
      AdvanceKind: {
        DEPOSIT: 'تأمين / عربون تجاري',
        PREPAYMENT_INVOICE: 'فاتورة دفعة مقدمة',
        RETAINER: 'دفعة أتعاب مقدمة',
      },
      AdvanceStatus: {
        OPEN: 'مفتوحة',
        PARTIALLY_APPLIED: 'مطبقة جزئياً',
        FULLY_APPLIED: 'مطبقة بالكامل',
        REFUNDED: 'مستردة',
        CANCELLED: 'ملغاة',
      },
      AgingBasis: {
        DUE_DATE: 'حسب تاريخ الاستحقاق',
        DOCUMENT_DATE: 'حسب تاريخ المستند',
      },
      CurrencyMode: {
        PARTY: 'عملة المعاملة / الطرف',
        FUNCTIONAL: 'العملة الوظيفية للشركة',
      },
    },
    derivedStatus: {
      settlement: {
        reversed: 'معكوسة',
        provisional: 'مؤقتة (بانتظار التأكيد)',
        unappliedBalance: 'رصيد غير مخصص',
        applied: 'مطبقة',
      },
    },
    openItems: {
      title: 'بنود الذمم المفتوحة والأقساط',
      detailTitle: 'تفاصيل القسط المفتوح',
      newSettlementCta: 'تسوية جديدة',
      settleSelectedCta: 'تسوية المحدد ({count})',
      settleItemAction: 'تسوية البند',
      exportCsv: 'تصدير CSV',
      exportXlsx: 'تصدير XLSX',
      multiSelectPartyCurrencyHint: 'تتطلب التسوية المتعددة توحيد الطرف والعملة لكافة البنود المحددة.',
      columns: {
        party: 'الطرف',
        installmentOrigin: 'القسط / المصدر',
        dueDate: 'تاريخ الاستحقاق',
        originalAmount: 'المبلغ الأصلي',
        settledAmount: 'المسدد',
        remainingAmount: 'المتبقي',
        statusDispute: 'الحالة والمطالبة',
      },
      discountEligibleBadge: 'خصم مبكر {amount} {currency} متاح حتى {date}',
      disputeActions: {
        open: 'فتح نزاع',
        escalate: 'تصعيد النزاع',
        resolve: 'حل النزاع',
        blockDunning: 'حظر المطالبة',
        unblockDunning: 'رفع حظر المطالبة',
        unblockDisputeLockedHint: 'يجب حل النزاع القائم أولاً لرفع حظر المطالبة المرتبط بالنزاع.',
      },
    },
    settlements: {
      title: 'التسويات وتخصيص المقبوضات والمدفوعات',
      createTitle: 'تسوية وتخصيص جديد',
      detailTitle: 'تفاصيل التسوية',
      postCta: 'ترحيل التسوية',
      autoAllocateOldest: 'توزيع تلقائي للأقدم استحقاقاً',
      autoAllocateSkippedNote: 'تم تخطي {count} بنداً متنازعاً عليه أو محظوراً قانونياً — حددها يدوياً للتجاوز.',
      fillRemaining: 'تعبئة المتبقي',
      instrumentTotal: 'مبلغ الأداة فقط',
      allocatedCash: 'المبلغ المخصص',
      unallocatedRemainder: 'المتبقي غير المخصص',
      fullyAllocated: 'موزع بالكامل',
      onAccountRemainderNote: 'يُرحَّل المتبقي كبند رصيد دائن غير مخصص (UNAPPLIED_SETTLEMENT).',
      overAllocatedError: 'المبلغ المخصص يتجاوز رصيد الأداة أو الرصيد المتبقي للقسط.',
      fxDeltaIndicator: 'يُحتسب فرق العملة المحقق ويُرحَّل تلقائياً عند الاعتماد',
      withholdingsSection: 'خصم منبع العميل المؤقت (بانتظار الشهادة)',
      actions: {
        confirmProvisional: 'تأكيد تحصيل الشيك المؤقت',
        registerWhtCert: 'تسجيل شهادة خصم المنبع',
        unallocate: 'إلغاء تخصيص البنود',
        reverse: 'عكس التسوية بالكامل',
      },
    },
    advances: {
      title: 'الدفعات المقدمة من العملاء وللموردين',
      createTitle: 'دفعة مقدمة جديدة',
      detailTitle: 'تفاصيل الدفعة المقدمة',
      applyCta: 'تطبيق الدفعة المقدمة على الأقساط',
      cancelAction: 'إلغاء الدفعة غير الممولة',
      apFundingHint: 'تُسجل الدفعة المقدمة للمورد أولاً كالتزام مفتوح؛ اربطها بأمر دفع (#31) أو شيك (#38) للصرف.',
    },
    subledgerReconcile: {
      title: 'مطابقة الأستاذ الفرعي وأعمار الديون',
      integrityPassed: 'تطابق الأستاذ الفرعي مع حساب المراقبة مؤكد ({code})',
      integrityFailed: 'تم رصد فرق بين الأستاذ الفرعي وحساب المراقبة ({count} ملاحظات)',
      tabs: {
        aging: 'تقرير أعمار الديون',
        entries: 'قيود الأستاذ الفرعي',
        partyMerges: 'سجل دمج الأطراف',
      },
      includeDisputedLabel: 'تضمين البنود المتنازع عليها (للمطابقة مع حساب المراقبة في الأستاذ العام)',
      functionalRateNote: 'يستخدم سعر صرف القيد الأصلي أو سعر إعادة التقييم المثبت في تواريخ إقفال الفترات.',
    },
    waitingStates: {
      provisionalChequeTitle: 'بانتظار تأكيد تحصيل ومقاصة الشيك',
      provisionalWhtTitle: 'بانتظار استلام وتسجيل شهادة خصم المنبع الضريبية من العميل',
      unfundedAdvanceTitle: 'بانتظار إثبات حركة القبض أو الصرف في الخزينة والمدفوعات',
      openDisputeTitle: 'القسط خاضع لنزاع تجاري مفتوح',
      exportRunningTitle: 'جاري تجهيز ملف تصدير الذمم المفتوحة',
      ambiguousMutationTitle: 'جاري التحقق من نتيجة العملية — لا تُعد الإرسال بشكل منفصل',
    },
  },
} as const;
```

---

## 12. Contract Gap List for `P03.T11` & Design Review Checklist Verification

### 12.1 Summary Contract Gap Matrix (`CG-RAP-01` .. `CG-RAP-08`)

Every gap below was verified directly against `02_Endpoint_Catalogue.md`, `04_Static_Data/02_DTOs.md`, `04_Static_Data/01_Enums.md`, `04_Static_Data/04_Errors_and_Constants.md`, and `01_ERD/05_Subledger_and_Settlement_Tables.md`. **None** of these missing artifacts are assumed or fabricated in the `SCR-23` UI design above; each has an explicit safe fallback until `P03.T11` freezes the contract amendment.

| Gap ID | Stage Impact | Affected Route(s) | Exact Contract Omission / Contradiction | Safe Design Posture Until `P03.T11` Resolves | Recommended `P03.T11` Resolution |
| --- | --- | --- | --- | --- | --- |
| **`CG-RAP-01`** | `[P24.T03]` (`#21`) | `PATCH /accounting/open-items/:id` (`02_Endpoint_Catalogue.md` §7 line 608) | Catalogue declares `PATCH /accounting/open-items/:id` (*"dunning and collection fields only; amounts are never patched"*), but `04_Static_Data/02_DTOs.md` §8 defines **no `UpdateOpenItemDto`**, and `acc_open_items` (`05_Subledger_and_Settlement_Tables.md` lines 181–230) has no `collection_notes` column (`expected_settlement_date` & `custom_values` are Post-MVP hooks; dispute & dunning-block have dedicated `POST` routes). | `#21` keeps the **Edit Collection Metadata** action disabled behind a contract-pending guard so `forbidNonWhitelisted` is never violated; dispute and dunning-block buttons use their dedicated `POST` endpoints (`F-20`..`F-23`). | Either define `UpdateOpenItemDto` in `02_DTOs.md` §8 against explicit MVP columns on `acc_open_items` (e.g., `collectionNote?: string` if added to ERD, or `expectedSettlementDate?: ISODate | null` if promoted to MVP), **or** remove `PATCH /accounting/open-items/:id` from `02_Endpoint_Catalogue.md` §7 for MVP. |
| **`CG-RAP-02`** | `[Slice — P19.T08]` (`#23`) & `[P24.T03]` (`#25`) | `POST /accounting/settlements/:id/reverse`, `POST /accounting/settlements/:id/confirm`, `POST /accounting/advances/:id/cancel` | `02_Endpoint_Catalogue.md` §7 (lines 618–621, 628) lists all three commands (`If-Match` required), yet `02_DTOs.md` §8 omits **`ReverseSettlementDto`**, **`ConfirmSettlementDto`**, and **`CancelAdvanceDto`**. Meanwhile `acc_settlements.reversal_reason` (`05_Subledger_and_Settlement_Tables.md` line 284) stores `ReversalReason` (`MANUAL \| ERROR_CORRECTION \| PERIOD_CORRECTION`, `01_Enums.md` line 556). | `#23` Reverse & Confirm modals and `#25` Cancel modal isolate their request serializer in a single typed adapter ready to bind the frozen DTO fields without UI rework. | Define in `02_DTOs.md` §8: (1) `ReverseSettlementDto { reason: ReversalReason; reversalDate?: ISODate; memo?: string }`; (2) `ConfirmSettlementDto` (`Record<string, never>` empty `{}` or `{ confirmedOn?: ISODate; memo?: string }`); (3) `CancelAdvanceDto { reason: string }` (`10..1000` chars, matching `CancelNettingDto`). |
| **`CG-RAP-03`** | `[Slice — P19.T08]` & `[P24.T03]` (`#60`) | `GET` / `POST /search` on `/accounting/subledger/{ar\|ap}-entries`; `GET /accounting/party-merges` | **1.** `02_Endpoint_Catalogue.md` §7 resource summary (line 580) marks `subledger/ar-entries, subledger/ap-entries` as `L S X`, yet the endpoint table (lines 610–613) omits `POST /accounting/subledger/{ar\|ap}-entries/export` (`X`). **2.** `02_DTOs.md` §8.1 omits `SubledgerEntryListQueryDto` and `PartyMergeListQueryDto`. | `#60` Tab 2 omits the Export button (following the authoritative endpoint table rather than the summary shorthand) and uses `POST .../search` (`SearchQueryDto`) for structured field filtering on subledger entries. | Reconcile Catalogue §7 line 580 vs lines 610–613 (either add `POST /subledger/{ar\|ap}-entries/export` rows or change summary to `L S`), and declare `SubledgerEntryListQueryDto` (`partyId?`, `openItemId?`, `journalEntryId?`, `fromEntryDate?`, `toEntryDate?`, `currencyCode?`, `cursor?`) and `PartyMergeListQueryDto` (`partyId?`, `fromMergedAt?`, `toMergedAt?`) in `02_DTOs.md` §8.1. |
| **`CG-RAP-04`** | `[Slice — P19.T08]` (`#60` Tab 1) | `GET /accounting/reports/aging` (`02_Endpoint_Catalogue.md` §12 line 1152) | `AgingQueryDto` is sketched inline in `02_Endpoint_Catalogue.md` line 1152 and cited in `01_Enums.md` line 2247 (`AgingQueryDto.currencyMode`), but **neither `AgingQueryDto` nor `AgingReportDto`** is declared in `04_Static_Data/02_DTOs.md` §11.3 (paralleling `CG-RPT-02` on `SCR-12`). | `#60` Tab 1 sends only the inline-documented `AgingQueryDto` parameters and consumes server-computed bucket rows/totals via a strict boundary validator without client arithmetic. | Declare `AgingQueryDto` and `AgingReportDto` (party rows with `partyId`, `partyCode?`, `partyName?`, `currencyCode`, `currentAmount`, `buckets: { label, fromDays, toDays, amount }[]`, `unappliedCreditsAmount`, `netAmount`, grand totals, optional `controlAccountBalance` / `varianceAmount` in `FUNCTIONAL` mode, `asOf`, `asOfChainSeq`) in `02_DTOs.md` §11.3. |
| **`CG-RAP-05`** | `[Slice — P19.T08]` (`#20`, `#21`, `#22?mode=new`) | `GET /accounting/open-items`, `GET /accounting/open-items/:id` | Because `OpenItemSummaryDto` (`02_DTOs.md` §8.3 lines 2282–2297) is explicitly declared, §13.1 rule 5 excludes `direction`, `originKind`, `documentDate`, `discountDate`, `discountAmount`, `entryFxRate`, and `dunningBlockReason` from list rows. In addition, neither summary nor detail DTOs carry human display labels (`partyName`/`partyCode`, `documentNo` — extending `accounting-ia.md` `CG-05`). | `#22?mode=new` hydrates `GET /open-items/:id` (cached by `[id, version]`) for selected/auto-proposed rows to read `direction`, `discountDate`, `discountAmount`, and `entryFxRate`; party names resolve through cached `POST /party-finance-profiles/lookup`. | Extend `OpenItemSummaryDto` with `direction: DebitCredit`, `originKind: OpenItemOrigin`, `documentDate: ISODate`, `discountDate: ISODate \| null`, `discountAmount: DecimalString \| null`, `entryFxRate: RateString`, `dunningBlockReason: string \| null`, plus read-model display projections `partyCode`, `partyDisplayName`, and `documentNo: string \| null`. |
| **`CG-RAP-06`** | `[Slice — P19.T08]` (`#21`) & `[P24.T03]` (`#25`) | `GET /accounting/open-items/:id`, `GET /accounting/advances/:id` | **1.** `GET /settlements/:id/allocations` queries by `settlementId`, whereas `GET /open-items/:id` names no child `allocations[]` (§13.1 rule 3) and `SettlementListQueryDto` lacks `openItemId?`, so `#21` can show `settlementAllocationId` from subledger entries but lacks `settlementId` and `realizedFxDifference` per allocation. **2.** `GET /advances/:id` names no child `applications[]` (`acc_advance_applications`) and has no `GET /advances/:id/applications`. | `#21` renders movement history from `POST /subledger/{ar\|ap}-entries/search` (`openItemId`); `#25` displays aggregate `appliedAmount` / `refundedAmount` / `remainingAmount`. | Include `allocations: OpenItemAllocationSummaryDto[]` (with `settlementId`, `settledOn`, `instrumentType`, `amountTxn`, `realizedFxDifference`, `reversedAt`) on `OpenItemDetailDto` (or add `openItemId?: UUID` to `SettlementListQueryDto`), and include `applications: AdvanceApplicationSummaryDto[]` on `AdvanceDetailDto`. |
| **`CG-RAP-07`** | `[Slice — P19.T08]` (`#22`, `#22?mode=new`) & `[P24.T03]` (`#24`) | `/accounting/payments`, `/accounting/settlements`, `/accounting/advances` | **1.** `CreateSettlementDto` (`side = 'AP'`) requires `instrumentRef` naming an `acc_payments` row, but `payments` (`L S G N`) has no `POST /accounting/payments/lookup` (`K`), forcing `#22?mode=new` to call `GET /accounting/payments` (`accounting.payment.read` + `accounting.payables.core`, cross-module picker class `CG-06`). **2.** `settlements` (`L S G N`) lacks `/count` & `/export`, and `advances` (`L G N`) lacks `/search`, `/count`, & `/export`. | `#22?mode=new` gates the `AP` payment selector on `accounting.payment.read` + `accounting.payables.core`; `#22` and `#24` omit `/count` and `/export` controls cleanly. | Add `POST /accounting/payments/lookup` (`K`, gated on `ANY(accounting.payment.read, accounting.settlement.create)`) returning unallocated/partially-allocated `CLEARED`/`SENT` payments, and confirm whether `settlements` and `advances` intentionally omit `C X` (and `S` on `advances`) or add them for list parity. |
| **`CG-RAP-08`** | `[Slice — P19.T08]` & `[P24.T03]` (`#20`..`#25`, `#60`) | Shared `AR`/`AP` routes in Catalogue §7 & §12 vs `/accounting/subledger/ap-entries` | `open-items*`, `settlements*`, `advances*`, `party-merges`, and `reports/aging` all require `@RequireFeature('accounting.receivables.core')` even when `side = 'AP'`, whereas `/subledger/ap-entries` requires `@RequireFeature('accounting.payables.core')`. Both ship together in `Core` tier (`10_Feature_Tiers.md`), but a per-tenant custom feature override enabling `payables.core` without `receivables.core` would block `AP` open items, settlements, advances, and aging. | UI enforces each route's exact catalogued feature key (`accounting.receivables.core` on shared routes; `accounting.payables.core` on `ap-entries`) without inventing client overrides. | In `P03.T11`, either codify an admin feature-override invariant pairing `accounting.receivables.core` and `accounting.payables.core`, or update shared `AR`/`AP` routes to admit `ANY('accounting.receivables.core', 'accounting.payables.core')` paired with runtime `side` entitlement enforcement. |

---

### 12.2 Accounting Design Review Checklist Verification (`frontend/tenant-portal/docs/design/README.md`)

| # | Mandatory Review Gate | Verification in `SCR-23` (`accounting-slice-open-items-settlements.md`) |
| --- | --- | --- |
| 1 | Every endpoint path, method, permission, feature key, and scope target copied verbatim from `02_Endpoint_Catalogue.md` | **Verified (§2.1–§2.3):** All `19` Slice `[P]` endpoints (`S-01`..`S-19`), `10` Stage-4 `[P]` endpoints (`F-20`..`F-29`), and `[S]` shared lookups/reports match `02_Endpoint_Catalogue.md` §§3, 4, 6, 7, 8, 10, 11, 12, 13 character-for-character. Counts and lookups use `POST /count` and `POST /lookup`; party picker uses `POST /accounting/party-finance-profiles/lookup`. |
| 2 | Slice (`P19.T08`) vs full-stage (`P24.T03`) scope explicitly separated | **Verified (§1.1, §2.1 vs §2.2, §3–§6):** Every route, tab, action button, modal, hook, and waiting state carries an explicit `[Slice subset — P19.T08]` or `[Full stage completion — P24.T03]` boundary tag. |
| 3 | Every form/filter/table field mapped to an exact DTO property (`02_DTOs.md`), with missing contracts isolated as gaps | **Verified (§7.1–§7.2, §12.1):** Zero invented DTO properties or enums; server-derived fields (`allocatedAmount`, `unallocatedAmount`, `realizedFxDifference`, `status`, etc.) are explicitly barred from wire payloads (`forbidNonWhitelisted`), and all `8` contract omissions are isolated in `CG-RAP-01`..`CG-RAP-08`. |
| 4 | Exact decimal preservation (`DecimalString` / `RateString`), zero `Number()` / float FX math | **Verified (§0.1, §4.3, §5.2):** Same-currency allocation bars use `parseScaledBigInt8` (`BigInt` at `10^8`); foreign-currency `fxRateId` resolves via `POST /accounting/fx-rates/resolve` and `realizedFxDifference` is server-computed only (`D-010`, `D-407`). |
| 5 | UUIDv7 only (`generateUUIDv7`), `If-Match` concurrency, and single-key idempotency discipline | **Verified (§2, §4.3, §8.3, §9 `WS-RAP-06`):** Every `WRITE_IDEMPOTENT` command mints one `generateUUIDv7()` per user intent and reuses it across ambiguous network retries; every `:id` lifecycle command sends `If-Match: "<version>"`. |
| 6 | Five Laws of Tenant Portal Design System enforced | **Verified (§0.2–§0.4, §10):** Exclusively `@/design-system` + `P03` `UX-01..UX-12` primitives; `4` outcome tones + `ink` ramp; `3` weights (`400`/`500`/`600`, `400` on all table cells); at most `1` filled `primary` button per screen; logical CSS properties only (`pnpm design:rtl` clean); `< 300` lines per hook/view file (§0.5). |
| 7 | Bilingual (`AR-RTL` + `EN-LTR`), Western digits (`0–9`), `<bdi dir="ltr">` islands, and Dark + Light mockups | **Verified (§10.1–§10.5, §11):** Four complete ASCII mockups (`AR-RTL × Light`, `AR-RTL × Dark`, `EN-LTR × Light`, `EN-LTR × Dark`) + `375px` mobile card stack, plus full parallel `en` and `ar` dictionary trees with zero language ternaries. |
| 8 | Waiting states specify deadline, owner, safe action, and post-bound compensation without ever implying a resend | **Verified (§9 `WS-RAP-01`..`WS-RAP-06`):** Provisional cheque (`WS-RAP-01`), provisional AR WHT (`WS-RAP-02`), unfunded advance (`WS-RAP-03`), active dispute (`WS-RAP-04`), async export (`WS-RAP-05`), and in-flight idempotency (`WS-RAP-06`) all enforce the Zero-Resend Law. |

## Contract reconciliation (P03.T11, 1 November 2026)

Reconciles the gaps of this spec against the Endpoint Catalogue and `02_DTOs.md` after `D-770`, `D-771` and `D-772`. The gap list above keeps the original findings; these rulings are final.

| Gap id | Ruling | Where |
| --- | --- | --- |
| `CG-RAP-01` | deferred to stage 4 (P24.T03 definition of ready) | `PATCH /open-items/:id` has no client-writable MVP column; define the fields or remove the row and `accounting.open_item.update`; the slice keeps the action off |
| `CG-RAP-02 (a)` | closed by D-772 | `ReverseSettlementDto { reason: ReversalReason (MANUAL, ERROR_CORRECTION, PERIOD_CORRECTION), reversalDate? }`; no comment field |
| `CG-RAP-02 (b)` | deferred to stage 4 (P24/P25 freeze change) | `ConfirmSettlementDto` and `CancelAdvanceDto` to be declared as empty bodies (as `assign`, `D-401`); the spec's proposed `CancelAdvanceDto.reason` has no column and is dropped |
| `CG-RAP-03 (a)` | dropped | `settlements` exposes no export; the resource shorthand is corrected to `L S` in the freeze change and the spec keeps the export off |
| `CG-RAP-03 (b)` | already in the contract | Filter through the repository `filter` (`open_item_id`, `party_id`, `entry_date`) or `POST /accounting/subledger/{ar,ap}-entries/search`; no new query DTOs (P19.T03.S4 whitelists the columns) |
| `CG-RAP-04` | closed by D-772 | `AgingReportDto`: party rows with `notDue`, one amount per bucket plus the tail, `total`, per-currency `totals`, `asOf`, `asOfChainSeq`; `buckets` defaults to the query, else the default statement profile, else `[30, 60, 90, 120]` |
| `CG-RAP-05` | closed by D-772 | `OpenItemSummaryDto` gains `direction`, `originKind`, `documentDate` and the joined `documentNo`; discount and FX fields stay on the detail; party labels follow `PartyFinanceProfileLookupItemDto` (`D-770`) |
| `CG-RAP-06` | deferred to stage 4 (P24.T03 definition of ready) | Allocation history on the open-item detail, `openItemId?` on `SettlementListQueryDto`, and `applications[]` on `GET /advances/:id` |
| `CG-RAP-07 (a)` | deferred to stage 4 (P24/P25 definition of ready) | No `POST /accounting/payments/lookup` for the AP instrument picker; the slice hides the AP picker |
| `CG-RAP-07 (b)` | dropped | `settlements` has no count or export and `advances` no search, count or export; the spec omits those controls and no route is added |
| `CG-RAP-08` | deferred to stage 4 (P24 AP breadth definition of ready) | Shared AR/AP routes gate on `accounting.receivables.core` even for `side = AP`; no slice impact because both keys ship together in Basic |
