# Accounting UX Foundation — Workflow Patterns Specification (`UX-06`, `UX-10`, `UX-13`, `UX-14`)

> **Lead review, 1 November 2026 (P03.T06).** Every route, permission, feature key and scope below was checked against `docs/LLD/accounting-app/02_API_Contracts/02_Endpoint_Catalogue.md` and `04_Static_Data/05_Permissions_and_Features.md`: 67 keys and 64 routes match; the four routes the catalogue lacked (an opening-balance batch edit, the per-entity file-import family, an approval-request comment route and an approval-request count route) appear only in the gap list and the reconciliation section as `CG-WF-01`, `CG-WF-07` and `CG-WF-08` (`P03.T11`: the file imports are `D-772`, the other three are not added).

- **Plan task:** `P03.T06` (`P03.T06.S1` – `P03.T06.S5`) — `backend/docs/plans/accounting-app-plan-p03-ux-foundation.md`
- **Target promotion path (Lead pass per `P03.T08.S3`):** `frontend/tenant-portal/docs/design/specs/accounting-patterns-workflow.md`
- **Status:** Complete specification ready for lead review (`P03.T06.S1`–`S5`) and contract reconciliation (`P03.T11`)
- **Owning frontend app:** `tenant-portal` (port `5002`, HTTP profile `mutakamel-http-tenant-*` / HTTPS `__Host-mutakamel-tenant-*`)
- **Owning backend apps:** `accounting-app` (`/api/tenant/accounting/v1/*`), `core-app` (`/api/tenant/core/v1/*`), `api-gateway-app` (public browser route contract)
- **Last verified against backend LLD & Tenant Portal design system:** `2026-11-01`
- **Screen inventory cross-reference note:** In `tenant-portal/docs/plans/accounting-screen-inventory.md`, **Approvals Inbox & Rules** is `SCR-38` (routes `#7` `/accounting/inbox/approvals`, `#8` `/accounting/inbox/approvals/[id]`, `#110` `/accounting/setup/approval-rules`, `#111` `/accounting/setup/approval-rules/[id]`), whereas `accounting-app-plan-p03-ux-foundation.md` (`P03.T09.S6`) refers to the approval inbox shorthand as `SCR-11`. Both identifiers bind Section 2 (`UX-10`) below.

**Binding authorities consumed:**
- Backend Accounting LLD (`backend/docs/LLD/accounting-app/`):
  - `02_API_Contracts/01_Context_Headers_and_Responses.md`, `02_Endpoint_Catalogue.md` (§3 Module 01, §4 Module 02, §5 Module 03, §6 Module 04, §7 Module 05, §8 Module 06, §9 Module 07, §10 Module 08, §11 Module 09, §12 Reports, §13 Gateway metadata)
  - `04_Static_Data/01_Enums.md`, `02_DTOs.md`, `04_Errors_and_Constants.md`, `05_Permissions_and_Features.md`
  - `01_ERD/02_Ledger_Tables.md`, `08_Close_and_Reporting_Tables.md`, `09_Integration_and_Reliability_Tables.md`
  - `05_Flows/11_Journey_Coverage_Matrix.md` (`SCN-004`, `SCN-042`–`046`, `SCN-060`, `SCN-075`–`082`, `SCN-092`, `SCN-093`, `SCN-095`)
  - `07_Modules/10_MVP/02_ledger_posting.md` (`UC-LPO-1`, `UC-LPO-3`), `08_close_and_reporting.md`, `09_integration_and_posting_rules.md` (`UC-INT-4`)
  - `10_Feature_Tiers.md`, `13_Delivery_Plan.md` (§6.7.2), `backend/docs/plans/accounting-app-implementation-plan.md` (`OD-13` / `D-691`)
- Tenant Portal Design System & Approved Accounting UX Foundation Specs (`frontend/tenant-portal/`):
  - `docs/design/{README,tokens,typography,primitives,patterns,views,states,accessibility,i18n,anti-patterns}.md`
  - `docs/architecture/{data-layer,file-architecture}.md`
  - `docs/design/specs/{accounting-ia,accounting-home,accounting-status-and-a11y,accounting-patterns-data,accounting-patterns-documents}.md`

---

## 0. Cross-Pattern Invariants, `ui-ux-pro-max` Intelligence & Hook Split

Before specifying `UX-06` (Journal Editor), `UX-10` (Approval Panel & Inbox), `UX-14` (Import Wizard), and `UX-13` (Bulk & Async Progress), `ui-ux-pro-max` and `frontend-design` rules for high-density financial B2B workflows were applied alongside the five Tenant Portal design laws:

1. **Exact Decimal & Balance Fidelity (`DecimalString` + Integer-Scaled `BigInt`):**
   - Browser code **never** calls `Number()` or `parseFloat()` on `DecimalString` (`numeric(24,8)`) or `FxRateString` (`numeric(24,12)`), **never** multiplies `amountTxn × fxRate` in JavaScript, and **never** rounds `HALF_UP` (`accounting-patterns-data.md` §0 rule 1, `CG-DATA-04`).
   - For **unsaved line editing** in `UX-06` (and its recurring / opening-balance variants), the live balance indicator parses validated `DecimalString` inputs (`^-?(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$`) into exact `10^8`-scaled `BigInt` minor units (`parseScaledBigInt8` / `formatScaledBigInt8`) to compute exact per-currency `totalDebitTxn`, `totalCreditTxn`, and `differenceTxn` with **zero floating-point error and zero FX multiplication**.
   - Functional-currency line amounts (`amountFunctional`), cross-currency `FX_POSITION` auto-lines (`D-229`), and weighted-average foreign cash/bank carrying amounts (`D-237`) come exclusively from the server (`POST`/`PATCH`/`GET /accounting/journal-drafts`). Whenever unsaved foreign-currency lines are dirty, functional totals show a stale-preview badge requiring `Save` before `Submit` or `Post`.
2. **UUIDv7 Idempotency Lifecycle (`D-768`):**
   - Every `WRITE_SENSITIVE` command generates one `x-idempotency-key` via `generateUUIDv7()` (`src/lib/uuid.ts`; `crypto.randomUUID()` is banned unconditionally).
   - Standard mutations retain `24 h` server TTL; import and opening-balance creation/execution commands marked `x-idempotency-key (7 d)` in `02_Endpoint_Catalogue.md` retain `7 d` server TTL.
   - **Retry rule (`D-768`):** Replaying an *ambiguous transport outcome* (`CLIENT_REQUEST_TIMEOUT`, `502`/`503`/`504`) reuses the **exact same** `x-idempotency-key` through `<AmbiguousOutcomePanel>`. Starting a **new attempt** after an async `202` run reaches terminal `FAILED` (or `PARTIAL` failed-subset retry) issues a **fresh** UUIDv7 `x-idempotency-key` because replaying the failed run's key returns the original `202` receipt rather than starting a new job.
3. **Optimistic Concurrency (`ETag` / `If-Match`):**
   - Every mutable aggregate read (`GET /:id`) captures strong `ETag: "<version>"`. Every guarded write sends `If-Match: "<version>"`.
   - `409 ACCOUNTING.CONCURRENCY.STALE_VERSION` opens `<ConflictDialog>` (`patterns.md`), refetching the server row and presenting field/line diffs rather than silently overwriting or discarding user work.
4. **Canonical Browser Gateway Paths & Operating Context:**
   - All requests route through `src/lib/api/axiosClient.ts` (`credentials: "include"`) under `/api/tenant/accounting/v1/<route>` (and `/api/tenant/core/v1/<route>` for Core directory lookups), carrying `x-mutakamel-company-id` and optional `x-mutakamel-branch-id`.
5. **Four Semantic Outcome Roles, Three Font Weights & Single Primary CTA:**
   - Chromatic roles are restricted to `positive`, `caution`, `negative`, and `neutral` (`ink`), reserving `brand` for focus rings and the **single** `variant="primary"` button per screen (`PageHeader` or `DetailHeader`).
   - Font weights are `400` (`font-normal`, mandatory on all `DataTable` body cells), `500` (`font-medium`), and `600` (`font-semibold`). No `font-bold`, no `text-[Npx]`, no `rounded-xl`+.
6. **Logical RTL/LTR Parity, LTR Islands & Q14 ID-Without-Name Rule:**
   - Zero physical directional utilities (`ml-*`/`mr-*`/`pl-*`/`pr-*`/`left-*`/`right-*`/`text-left`/`text-right`) and zero language ternaries in `.tsx`.
   - Western digits (`0-9`) in both locales (`ar-EG-u-nu-latn` and `en-US`) with `tabular-nums`. All codes, entry numbers, UUIDs, ETags, cursors, and SHA-256 hashes render inside `<IdentifierText>` (`<bdi dir="ltr" className="font-mono tabular-nums">`).
   - Per `patterns.md` Q14, when an API returns a raw UUID without a display name (e.g., `submittedBy`, `makerUserIds`, `targetId` — see `CG-WF-06`), the UI renders `<IdentifierText>` (linked when navigable) and **never** fabricates placeholder names.
7. **Reuse of Approved Design-System & Accounting Primitives (Zero Redesign):**
   - From `@/design-system`: `PageHeader`, `DetailHeader`, `DetailSection`, `DataTable` (`density="compact"`, `36px` rows), `FilterBar`, `FormModal`, `FormDrawer`, `ConfirmActionModal`, `ReasonDialog`, `ConflictDialog`, `AmbiguousOutcomePanel`, `AsyncJobState`, `BulkActionBar`, `BulkConfirmDialog`, `BulkResultPanel`, `StatusBadge`, `EmptyState`, `ErrorState`, `NotFoundState`, `PermissionGate`, `ReadOnlyGate`, `Timeline`, `AttachmentList`, `useRealtimeResync`.
   - From `P03.T04` / `P03.T05` / `P03.T07`: `<MoneyInput>`, `<Money>`, `<FxRateStrip>`, `<AccountPicker>`, `<PartyPicker>`, `<DimensionSetPicker>`, `<FiscalPeriodPicker>`, `<WaitingStateBadge>` / `<WaitingStateCallout>` (`WS-06`, Zero-Resend Law), `<AccountingErrorAlert>` (`useAccountingErrorModel`), and `<AccountingBoundaryGate>`.

### 0.1 Shared Theme Token Mapping (Applied to All Four ASCII Combinations)

| Surface / Cue | Light (`html:not(.dark)`) | Dark (`html.dark`) | Contrast / Non-Color Cue |
| --- | --- | --- | --- |
| Canvas / Card / Sticky Bar | `bg-background` (`--ink-50`) / `bg-card` (`--ink-0`) / `bg-muted/90` | `bg-background` (`--ink-950`) / `bg-card` (`--ink-900`) / `bg-muted/90` | Text `>= 12:1`, `border-border >= 3:1` |
| Balanced indicator (`diff === 0`) | `bg-positive-subtle border-positive-border text-positive-foreground` | `bg-positive-subtle border-positive-border text-positive-foreground` | Check icon + `Balanced` / `متوازن` (`>= 4.5:1`) |
| Unbalanced / Stale / Payload-changed | `bg-caution-subtle border-caution-border text-caution-foreground` | `bg-caution-subtle border-caution-border text-caution-foreground` | Warning triangle + delta string (`>= 4.5:1`) |
| Maker-checker block / Hard error / Storno | `bg-negative-subtle border-negative-border text-negative-foreground` | `bg-negative-subtle border-negative-border text-negative-foreground` | Shield/X icon + explicit cause (`>= 4.5:1`) |
| Frozen / Read-only / Locked row | `bg-muted/60 border-border text-muted-foreground` | `bg-muted/40 border-border text-muted-foreground` | Lock icon + `ReadOnlyGate` tooltip |
| Focus ring (`WCAG 2.2 AA`) | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` | `>= 3:1` on `24×24px` desktop / `44×44px` touch |

### 0.2 Logic / View File Architecture (`< 300` Lines Per File)

| Slice (`src/features/accounting/`) | Custom Hook (`hooks/*.ts`) | Pure View (`components/*.tsx`) |
| --- | --- | --- |
| `journal-editor/` (`UX-06`) | `useJournalEditor`, `useJournalLineGrid`, `useScaledDecimalBalance`, `useReverseEntryModal` | `JournalEditorScreen`, `JournalHeaderFields`, `JournalLineGrid`, `JournalBalanceBar`, `PostJournalModal`, `ReverseJournalModal` |
| `approvals/` (`UX-10`) | `useApprovalPanel`, `useApprovalInbox`, `useApprovalDecisionDialog`, `useApprovalRuleEditor` | `ApprovalPanel`, `ApprovalStepTrack`, `ApprovalInboxScreen`, `ApprovalRequestInspector`, `ApprovalDecisionModal`, `ApprovalRuleEditor` |
| `imports/` (`UX-14`) | `useOpeningBalanceWizard`, `useLocalSheetParser`, `useFileImportWizard`, `useImportErrorTable` | `OpeningBalanceWizard`, `OpeningBalanceSubledgerTabs`, `FileImportWizard`, `ColumnMappingStep`, `ImportDryRunGatePanel`, `ImportSafeErrorTable` |
| `async-jobs/` (`UX-13`) | `useAsyncJobPoller`, `useBulkOperationsRunner`, `useSyncBulkMutation`, `useAccountingJobTray` | `AsyncProgressCard`, `BulkTargetResultsTable`, `AccountingJobTrayDrawer` |

---

## 1. Journal Editor & Shared Line-Grid Variants (`P03.T06.S1` · `UX-06`)

### 1.1 Scope & Screen Reuse
- **Primary screens:**
  - `SCR-05` Journal Draft Create / Edit / Lifecycle: `/accounting/journals/drafts/new`, `/accounting/journals/drafts/[id]` (`accounting.journal_draft.read`, `accounting.ledger.core`, `COMPANY_OR_BRANCH`).
  - `SCR-06` Posted Journal Entry Detail & Reverse / Redact: `/accounting/journals/entries/[id]` (`accounting.journal_entry.read`, `accounting.ledger.core`, `OPERATING_CONTEXT`).
- **Shared `<JournalLineGrid>` variants:**
  - **Variant A — Standard Journal Draft (`SCR-05`):** `CreateJournalDraftDto` / `UpdateJournalDraftDto` (`JournalDraftLineInput[]`).
  - **Variant B — Recurring Journal Template (`SCR-08`, `/accounting/journals/recurring/[id]`):** `CreateRecurringTemplateDto` (`RecurringTemplateLineInput[]`).
  - **Variant C — Opening-Balance Batch `balances[]` (`SCR-09`, `/accounting/setup/opening-balances`):** `CreateOpeningBalanceBatchDto.balances` (`OpeningBalanceLineInput[]`).

### 1.2 Draft State Machine, Freeze Trigger & Action Matrix
Per `01_Enums.md` (`JournalDraftStatus`), `02_Ledger_Tables.md` (`trg_acc_journal_drafts_payload_frozen`, `ck_acc_journal_drafts_delete_state`), and `D-107` / `D-315` / `D-316` / `D-354`:
- `PATCH /accounting/journal-drafts/:id` is admitted **only** in `DRAFT` or `REJECTED` (`REJECTED` edit returns row to `DRAFT` or saves revised lines before re-submit).
- `trg_acc_journal_drafts_payload_frozen` freezes `payload_hash`, totals, dates, `period_id`, `journal_id`, `ledger_id`, `currency_code`, `fx_rate_id`, and `fx_rate_snapshot` whenever `status IN ('PENDING_APPROVAL','APPROVED','POSTING','BLOCKED','POSTED')` (any mutation attempt fails `409 ACCOUNTING.ENTRY.DRAFT_FROZEN`).
- Soft delete (`DELETE /accounting/journal-drafts/:id`) is admitted **only** when `status IN ('DRAFT','REJECTED','CANCELLED')`.

| Draft / Entry State | Editable Grid? | Primary CTA (`PageHeader` `variant="primary"`) | Secondary / Overflow Actions (`outline` / `ghost` / `ReasonDialog`) |
| --- | --- | --- | --- |
| `Unsaved New` | Yes | **Save Draft** (`POST /accounting/journal-drafts`) | Discard local draft (confirm if dirty) |
| `DRAFT` (dirty) | Yes | **Save Changes** (`PATCH /accounting/journal-drafts/:id`, `If-Match`) | Discard unsaved edits |
| `DRAFT` (clean, balanced) | Yes | **Post** (`POST /:id/post` if `accounting.journal_draft.post` & no mandatory approval rule known) OR **Submit for Approval** (`POST /:id/submit` if `accounting.journal_draft.submit`) | Submit / Post (whichever is secondary), Cancel (`POST /:id/cancel`), Delete (`DELETE /:id`) |
| `REJECTED` | Yes | **Save & Resubmit** (`PATCH /:id` then `POST /:id/submit`) | Cancel (`POST /:id/cancel`), Delete (`DELETE /:id`) |
| `PENDING_APPROVAL` | **Frozen** (`ReadOnlyGate`) | *(Approver not in `makerUserIds`)*: **Approve** (`POST /:id/approve` or `/approval-requests/:reqId/approve`); *(Submitter)*: none (`outline` **Withdraw**) | Reject (`POST /:id/reject`, mandatory reason), Withdraw (`POST /accounting/approval-requests/:reqId/withdraw`, submitter only, `10..500` chars -> returns draft to `DRAFT`, `D-354`) |
| `APPROVED` | **Frozen** (`ReadOnlyGate`) | **Post Entry** (`POST /:id/post`, `If-Match`, FX override disabled per `D-315`) | **Reopen to Draft** (`POST /:id/reopen`, `accounting.journal_draft.update`, mandatory `reason` `10..1,000` chars; releases approval request, `D-316`), Cancel (`POST /:id/cancel`) |
| `BLOCKED` | **Frozen** (`ReadOnlyGate`) | **Reopen to Draft** (`POST /:id/reopen`, mandatory `reason` `10..1,000`; open `acc_posting_exceptions` stay linked until resolved on post, `D-316`) | View linked Posting Exception (`/accounting/inbox/posting-exceptions`), Cancel (`POST /:id/cancel`) |
| `CANCELLED` | **Frozen** | None | Delete (`DELETE /:id`, soft delete) |
| `POSTED` (`SCR-06` Entry) | **Immutable** (no `ETag`) | None (read-only ledger truth) | **Reverse Entry** (`POST /accounting/journal-entries/:id/reverse`, `accounting.journal_entry.reverse`), **Request PII Redaction** (`POST /accounting/ledger/redactions`, `accounting.ledger_redaction.request`), **Chain Proof** (`GET /:id/chain-proof`), **Export** (`POST /accounting/journal-entries/export`) |

### 1.3 Header & Line Grid Contract (`CreateJournalDraftDto` / `JournalDraftLineInput`)
- **Header fields (`DetailSection` compact 3-column grid on desktop, 1-column on mobile):**
  1. `journalId` (required `UUID` via lookup on `GET /accounting/journals` / `POST /accounting/journals/search`; filters manual-eligible journals).
  2. `postingDate` & `documentDate` (required `ISODate` `YYYY-MM-DD`; `<FiscalPeriodPicker>` badge resolves period state: `OPEN` neutral, `SOFT_CLOSED` `caution` banner noting `accounting.period.override` requirement, `CLOSED`/`PERMANENTLY_CLOSED`/`FUTURE` `negative` inline blocker).
  3. `branchId` (optional `UUID`; defaults from operating context `x-mutakamel-branch-id`).
  4. `currencyCode` (`ISO 4217`, defaults to company `functionalCurrency` from `CompanyProfileDto`) + `<FxRateStrip>` (`POST /accounting/fx-rates/resolve` read-like preview; pins `fxRateId` on save).
  5. `reference` (optional string `<= 120` chars) & `memo` (optional string; DTO `UpdateJournalDraftDto` / `CreateJournalDraftDto` validated against `MAX_REASON_CHARS` / `acc_journal_drafts.memo` `<= 2,000` chars; counter shown from `80%`).
  6. `attachmentIds` (`UUID[]`, `0..50` via `<AttachmentList>` backed by `/accounting/attachments`).
- **Line grid (`JournalDraftLineInput`, `2..2,000` lines, `ACCOUNTING_LIMITS.MAX_LINES_PER_ENTRY = 2,000`):**
  - Virtualized via `useVirtualWindow` once `lines.length > 50` so a `2,000`-line draft maintains `< 16ms` keystroke latency.
  - Columns (logical start-to-end):
    1. `#` (`line_no` `1..N`, monochrome drag/menu handle; single-pointer `Move Up` / `Move Down` / `Insert Below` / `Duplicate` / `Remove` menu satisfies `WCAG 2.2 AA 2.5.7 Dragging Movements`).
    2. **Account** (`accountId`: `<AccountPicker>` filtered to `isPostable = true`, `status = 'ACTIVE'`; warns/blocks with `422 ACCOUNTING.ENTRY.CONTROL_ACCOUNT_MANUAL` copy if `allowManualJournal = false` — AR/AP control or cash/bank GL accounts).
    3. **Debit** (`direction = 'DEBIT'` -> `amountTxn` `<MoneyInput>`; typing into Debit clears Credit or flips `direction` cleanly; mutually exclusive cell pair mapped to `{ direction: 'DEBIT' | 'CREDIT', amountTxn: DecimalString }`).
    4. **Credit** (`direction = 'CREDIT'` -> `amountTxn` `<MoneyInput>`).
    5. **Currency** (`currencyCode`, defaults to header `currencyCode`; editable per line only when multi-currency journal lines are enabled).
    6. **Party** (`partyId`: `<PartyPicker>`, required badge when selected account has `requiresParty = true`, else optional).
    7. **Dimensions** (`dimensionSetId`: `<DimensionSetPicker>` compact chip summary; required badge when account `dimensionPolicy` requires a dimension type, else `422 ACCOUNTING.DIMENSION.REQUIRED_MISSING`).
    8. **Tax Code** (`taxCode`: optional lookup chip; note manual reverse is blocked later if tax lines are generated).
    9. **Line Description** (`description`: optional `<= 500` chars, `MAX_DESCRIPTION_CHARS`).
    10. **Progressive-disclosure drawer/popover per row** (kept out of primary columns unless active):
        - **Statistical Account Mode:** When selected account has `accountType = 'STATISTICAL'`, `amountTxn` locks to `"0"` (`0.00`) and reveals `quantity` (`DecimalString`) + `unitCode` (`<= 16` chars).
        - **Intercompany Fields:** `icCounterpartyCompanyId` + `icMatchKey` (`<= 80` chars), visible only when intercompany accounts are selected.

### 1.4 Exact Balance Indicator (`useScaledDecimalBalance`) & Keyboard Ergonomics
- **Integer-scaled `BigInt` algorithm (zero `Number()`, zero float, zero FX math):**
  1. Each valid `DecimalString` splits on `.` into `(sign, wholeDigits, fracDigitsPaddedTo8)` -> `BigInt(sign + wholeDigits + fracDigits.padEnd(8, "0"))`.
  2. Group non-statistical lines by `currencyCode`. Within each currency group `c`:
     - `debitSum[c] = Σ amountScaled(DEBIT)`
     - `creditSum[c] = Σ amountScaled(CREDIT)`
     - `diff[c] = debitSum[c] - creditSum[c]`
  3. Format back to exact `DecimalString` at the currency's minor-unit display precision (`2` for `EGP`/`USD`/`EUR`, `3` for `KWD`/`BHD`, preserving any non-zero trailing fractional digits up to `8` places).
  4. **Single-currency functional draft (`c === functionalCurrency`, clean or dirty):** Sticky `<JournalBalanceBar>` shows exact `Total Debit`, `Total Credit`, and `Out of balance by <diff>` (`caution` when `diff !== 0n`, `positive` `Balanced · 0.00` when `diff === 0n && lines >= 2`). `Submit` and `Post` are disabled while `diff !== 0n` or `lines < 2` or `lines > 2000`.
  5. **Foreign / Mixed-currency draft:** Sticky bar shows exact per-currency `amountTxn` subtotals plus the **server-computed** functional totals (`JournalDraftDetailDto.totalDebit` / `totalCredit`) from the last `POST`/`PATCH`. If lines are dirty, badge reads `Save required to compute functional FX balance` / `يلزم الحفظ لاحتساب التوازن بعملة الدفاتر` (`FX_POSITION` auto-lines `D-229` and foreign cash/bank carrying cost `D-237` are server-only).
- **Keyboard ergonomics:**
  - `Tab` / `Shift+Tab` moves across editable cells; pressing `Tab` on the last cell of the last row appends a new row inheriting `currencyCode` and (if `diff !== 0n` in single currency) pre-suggests the balancing `direction` (`DEBIT` if `diff < 0n`, `CREDIT` if `diff > 0n`) without auto-submitting.
  - `ArrowUp` / `ArrowDown` moves vertically in the same column when no combobox popover is open; `Alt+ArrowUp` / `Alt+ArrowDown` reorders rows; `Escape` closes cell popovers first, never discarding the draft.
  - Polite `aria-live="polite"` region announces balance transitions (`Balanced` vs `Out of balance by ...`) debounced by `400ms` so screen readers are not flooded per keystroke.

### 1.5 Post, FX Override, Mandatory Reverse & Conflict Recovery (`SCN-082`)
- **Post Confirmation (`PostJournalDraftDto` -> `POST /accounting/journal-drafts/:id/post`):**
  - Requires saved/clean state (`!isDirty`), `ETag` -> `If-Match`, UUIDv7 `x-idempotency-key`, and sends `{ expectedTotalDebit, expectedTotalCredit }` copied verbatim from the current `JournalDraftDetailDto`.
  - **FX Override section (collapsed by default):** Rendered only when `currencyCode !== functionalCurrency`, user holds companion permission `accounting.journal_entry.override_fx`, **and** `draft.approvalRequestId === null` (`D-315`: once an approval request covers the draft, FX override is frozen and hidden with lock note; sending one returns `409 ACCOUNTING.ENTRY.DRAFT_FROZEN`). Requires `overrideFxRateId` (`UUID`) + `overrideReason` (`10..500` chars).
- **Mandatory Reverse Modal (`ReverseJournalEntryDto` -> `POST /accounting/journal-entries/:id/reverse`):**
  - Triggered from `SCR-06` (`/accounting/journals/entries/[id]`). No `If-Match` (entries are immutable); sends UUIDv7 `x-idempotency-key`.
  - Required fields:
    1. `reversalDate` (`ISODate`, defaults to today if in an `OPEN` period, `>= entry.postingDate`; `< entry.postingDate` blocked client-side and server-side with `422 ACCOUNTING.ENTRY.REVERSAL_DATE_BEFORE_ORIGINAL`).
    2. `reason` (required `ReversalReason` radio/select: `MANUAL` · `ERROR_CORRECTION` · `PERIOD_CORRECTION` — localized via `t.accounting.enums.reversalReason.*`, never raw wire strings).
    3. `comment` (`<= 1,000` chars; **UI enforces mandatory `10..1,000` char operator explanation** when `reason` is `ERROR_CORRECTION` or `PERIOD_CORRECTION`, and strongly prompts on `MANUAL`, satisfying audit traceability).
  - **Read-only Method Preview Banner:** Reads `companyProfile.reversalMethod` (`SWAP_SIDES` vs `STORNO`, `D-013`/`D-219`):
    - `SWAP_SIDES`: explains that `DEBIT` and `CREDIT` sides swap with positive amounts.
    - `STORNO`: explains that original `DEBIT`/`CREDIT` sides stay unchanged with negative amounts and `isStorno = true` (`[Storno]` / `[ستورنو]`).
  - **Guardrail errors handled inline inside modal:**
    - `422 ACCOUNTING.ENTRY.SOURCE_OWNED` (`D-361`, `D-670`, `D-672`): entry belongs to a fiscal document, tax line, or live asset/cost item — displays a direct link to the owning document/asset so the user cancels/reverses at the source.
    - `409 ACCOUNTING.ENTRY.ALREADY_REVERSED` (links to existing reversal entry) and `422 ACCOUNTING.ENTRY.IS_A_REVERSAL`.
- **Concurrency & Totals Mismatch (`SCN-082`):**
  - `409 ACCOUNTING.CONCURRENCY.STALE_VERSION`: opens `<ConflictDialog>` comparing local draft vs refetched `GET /accounting/journal-drafts/:id` (with new `ETag`). User chooses **Reload Latest Server Draft** or **Copy My Unsaved Lines to Clipboard & Reload**.
  - `409 ACCOUNTING.ENTRY.TOTALS_MISMATCH`: occurs on `POST /:id/post` if `expectedTotalDebit`/`expectedTotalCredit` differ from server recomputation; refetches `GET /:id`, highlights the changed total delta in `<PostJournalModal>`, and requires explicit re-confirmation with a fresh UUIDv7 `x-idempotency-key`.
  - `CLIENT_REQUEST_TIMEOUT` / `502` / `503` / `504`: renders `<AmbiguousOutcomePanel>` preserving the exact `x-idempotency-key` until resolved.

### 1.6 Shared Line-Grid Reuse (`SCR-08` Recurring & `SCR-09` Opening Balances)

| Capability | Variant A: Journal Draft (`SCR-05`) | Variant B: Recurring Template (`SCR-08`) | Variant C: Opening Balances `balances[]` (`SCR-09`) |
| --- | --- | --- | --- |
| DTO Line Type | `JournalDraftLineInput` | `RecurringTemplateLineInput` | `OpeningBalanceLineInput` |
| Account Column | `accountId: UUID` (`<AccountPicker>`) | Mode toggle per row: **Specific Account** (`accountId`) XOR **Account Role** (`accountRole` from 116 `AccountRole` slots) | `accountId: UUID` (`<AccountPicker>`) |
| Amount Column | `direction` + `amountTxn: DecimalString` | Mode toggle per row: **Fixed Amount** (`amount: DecimalString`) XOR **Formula** (`amountExpression` `<= 500` chars, closed `formula.ts` grammar, `D-347`) | `direction` + `amountTxn` + `currencyCode` + `amountFunctional` + optional `fxRate` |
| Balance Bar Rule | Exact per-currency `BigInt` sum; must equal `0` | Exact sum when all rows use Fixed Amount; switches to `Formula — balanced at run time` (`tone="neutral"`) when any row uses `amountExpression` | Exact sum of `amountFunctional`; non-zero residual previews auto-plug to `OPENING_BALANCE_EQUITY` (`balancingAmount`), while any balance on `SUSPENSE` shows `negative` blocker (`suspense_amount = 0` required before post) |
| Lifecycle Note | `Save` -> `Submit` / `Post` | `autoPost = true` still evaluates `MANUAL_JE` approval rules at run time (`D-346`, landing in `PENDING_APPROVAL` if matched) | Feeds Mode A Import Wizard (`§3.2`) |

### 1.7 Four-Combination & Mobile ASCII Wireframes (`UX-06`)

#### 1.7.1 `EN-LTR` × `Light` (`bg-background` `--ink-50`, `bg-card` `--ink-0`) — `SCR-05` Draft Editor
```text
+--------------------------------------------------------------------------------------------------+
| Breadcrumb: Accounting / Journals & Entries / Draft JD-2026-00418       [DRAFT]  ETag: "3"       |
| Journal Draft JD-2026-00418                              [Cancel Draft] [Submit] [*Post Entry*]  |
+--------------------------------------------------------------------------------------------------+
| HEADER (bg-card border-border)                                                                   |
| Journal: [GJ - General Journal v]   Posting Date: [2026-11-01] [Nov 2026 · OPEN]  Branch: [HQ v] |
| Currency: [EGP v] (Functional)      Doc Date:     [2026-11-01]                    Ref: [ADJ-11]  |
| Memo: [Monthly utilities accrual for Cairo HQ                                         46 / 2000] |
+--------------------------------------------------------------------------------------------------+
| LINES (2 / 2,000)                                                    [+ Add Line] [Paste Rows]   |
| #  | Account (LTR bdi)              | Debit (EGP)    | Credit (EGP)   | Party | Dim     | Act    |
|----|--------------------------------|----------------|----------------|-------|---------|--------|
| 1  | 520401 · Utilities Expense     |      18,500.00 |              — | —     | CC-100  | [···]  |
| 2  | 210305 · Accrued Expenses      |              — |      18,500.00 | —     | CC-100  | [···]  |
+--------------------------------------------------------------------------------------------------+
| STICKY BALANCE BAR (bg-positive-subtle border-positive-border)                                   |
| [✓ Balanced]  Total Debit: EGP 18,500.00  |  Total Credit: EGP 18,500.00  |  Difference: 0.00    |
+--------------------------------------------------------------------------------------------------+
```

#### 1.7.2 `AR-RTL` × `Light` (`dir="rtl"`, logical `start`/`end`, `<bdi dir="ltr">` codes & Western digits)
```text
+--------------------------------------------------------------------------------------------------+
| [*ترحيل القيد*] [إرسال للاعتماد] [إلغاء المسودة]     "ETag: "3  [مسودة]  JD-2026-00418 / القيود   |
| مسودة قيد يومية JD-2026-00418                                                                    |
+--------------------------------------------------------------------------------------------------+
| بيانات الرأس (bg-card border-border)                                                             |
| الفرع: [المركز الرئيسي v]  [نوفمبر 2026 · مفتوحة] [2026-11-01] :تاريخ الترحيل  [GJ - يومية عامة v] |
| المرجع: [ADJ-11]           [2026-11-01] :تاريخ المستند          (عملة الدفاتر) [EGP v] :العملة     |
| البيان: [استحقاق مرافق شهر نوفمبر للمقر الرئيسي بالقاهرة                              46 / 2000] |
+--------------------------------------------------------------------------------------------------+
| [لصق صفوف] [+ إضافة سطر]                                                    السطور (2 / 2,000)  |
| إجراءات | الأبعاد | الطرف | دائن (EGP)     | مدين (EGP)     | الحساب (bdi LTR)             | #   |
|---------|---------|-------|----------------|----------------|------------------------------|-----|
|  [···]  | CC-100  | —     |              — |      18,500.00 | 520401 · مصروف المرافق       | 1   |
|  [···]  | CC-100  | —     |      18,500.00 |              — | 210305 · مصروفات مستحقة      | 2   |
+--------------------------------------------------------------------------------------------------+
| شريط التوازن المثبت (bg-positive-subtle border-positive-border)                                  |
| الفرق: 0.00  |  إجمالي الدائن: EGP 18,500.00  |  إجمالي المدين: EGP 18,500.00       [✓ متوازن]  |
+--------------------------------------------------------------------------------------------------+
```

#### 1.7.3 `EN-LTR` × `Dark` (`html.dark`, `bg-background` `--ink-950`) — `SCR-06` Reverse Entry Modal
```text
+--------------------------------------------------------------------------------------------------+
| DARK MODAL (bg-card --ink-900 border-border --ink-800) · Reverse Entry JE-2026-00981        [X]  |
+--------------------------------------------------------------------------------------------------+
| [i] Company Reversal Method: STORNO (keeps original Dr/Cr sides with negative amounts &          |
|     [Storno] badge; append-only new entry linked via reversesEntryId).                           |
|                                                                                                  |
| Original Entry: <bdi>JE-2026-00981</bdi> · Posted 2026-10-28 · EGP 18,500.00                     |
| Reversal Date * : [2026-11-01]  (Must be >= 2026-10-28 and in an OPEN GL period)                 |
| Reversal Reason *: (•) Error Correction   ( ) Period Correction   ( ) Manual Reversal            |
| Audit Explanation * (10..1,000 chars):                                                           |
| [Accrual posted twice for October invoice; reversing duplicate accrual in Nov open period.     ] |
|                                                                                     93 / 1,000   |
|                                                         [Cancel]  [*Post Reversal Entry*]        |
+--------------------------------------------------------------------------------------------------+
```

#### 1.7.4 `AR-RTL` × `Dark` (`html.dark`, `dir="rtl"`) — `409 STALE_VERSION` Conflict Dialog (`SCN-082`)
```text
+--------------------------------------------------------------------------------------------------+
| [X]        تعارض في نسخة المسودة (409 ACCOUNTING.CONCURRENCY.STALE_VERSION) · وضع داكن (--ink-900)|
+--------------------------------------------------------------------------------------------------+
| [!] تعذر حفظ تعديلاتك لأن مستخدماً آخر قام بتحديث المسودة JD-2026-00418 إلى النسخة "4".         |
|     لم يتم الكتابة فوق تعديلات الخادم، وتعديلاتك المحلية محفوظة مؤقتاً في هذه النافذة.            |
|                                                                                                  |
| المقارنة:                        نسختك المحلية ("3")            نسخة الخادم الحالية ("4")       |
| إجمالي المدين / الدائن:          EGP 18,500.00                   EGP 19,200.00                   |
| حالة المسودة:                    مسودة (DRAFT)                   بانتظار الاعتماد (PENDING)      |
|                                                                                                  |
| [*تحميل نسخة الخادم الأحدث*]  [نسخ سطوري المحلية للحافظة وتحديث]                 corr: 0192e8... |
+--------------------------------------------------------------------------------------------------+
```

#### 1.7.5 Mobile `375px` Compact Line-Card Layout (`< 768px`, `44×44px` Touch Targets)
```text
+-------------------------------------+
| < Draft JD-2026-00418       [DRAFT] |
| Journal: GJ · 2026-11-01 · EGP      |
+-------------------------------------+
| Line #1                       [···] |
| Account: 520401 · Utilities Expense |
| [Debit *] [Credit  ]  18,500.00 EGP |
| Dim: CC-100 · Party: None           |
+-------------------------------------+
| Line #2                       [···] |
| Account: 210305 · Accrued Expenses  |
| [Debit  ] [Credit *]  18,500.00 EGP |
| Dim: CC-100 · Party: None           |
+-------------------------------------+
| [+ Add Line]                        |
+-------------------------------------+
| ✓ Balanced · Dr/Cr: EGP 18,500.00   |
| [Submit]            [*Post Entry*]  |
+-------------------------------------+
```

---

## 2. Approval Panel & Approval Inbox (`P03.T06.S2` · `UX-10` · `SCR-38` / `SCR-11`)

### 2.1 Scope, Routes & Exact Catalogue Permissions
- **Surfaces:**
  1. **Inline `<ApprovalPanel>`:** Embedded on target document/workflow detail screens whenever `approvalRequestId` is present or an approval rule governs the transition.
  2. **Approval Inbox (`SCR-38` / `SCR-11`, inventory `#7` & `#8`):** `/accounting/inbox/approvals` and `/accounting/inbox/approvals/[id]` (`accounting.approval.read` · `accounting.close.approvals` · `COMPANY_OR_BRANCH`).
  3. **Approval Rules Setup (`SCR-38`, inventory `#110` & `#111`):** `/accounting/setup/approval-rules` and `/accounting/setup/approval-rules/[id]` (`accounting.approval.read` for viewing, `accounting.approval.manage_rules` for create/update/delete/restore/steps · `accounting.close.approvals` · `COMPANY`).
- **20 Live MVP `ApprovalDocumentType` Members (`01_Enums.md`):**
  - `VENDOR_BILL`, `MANUAL_JE`, `PAYMENT_RUN`, `NETTING`, `CREDIT_NOTE`, `DUNNING_RUN`, `BANK_DETAILS_CHANGE`, `WRITE_OFF`, `PERIOD_REOPEN`, `ASSET_DISPOSAL`, `RULE_SET_VERSION`, `CREDIT_HOLD_RELEASE`, `PAYMENT_PLAN`, `YEAR_CLOSE_RERUN`, `PERSONAL_DATA_REDACTION`, `POSTING_REDATE`, `RESTORED_COPY_UNOBTAINABLE` (`>= 2` steps + owner ack, `D-288`), `FX_REVALUATION_REPIN`, `BANK_MATCH_CORRECTION`, `INBOX_POSITION_LOST`.
  - **5 Reserved Members (`403 ACCOUNTING.FEATURE.NOT_ENTITLED` in MVP, `D-571` — hidden from rule-builder picker):** `BUDGET_VERSION` (wave 1), `FACILITY_LIMIT_CHANGE` (wave 2), `TREASURY_INSTRUMENT_REVISION` (wave 2), `EXPENSE_CLAIM` (wave 3), `ASSET_COUNT` (wave 3).
  - **Mandatory default-rule types (`ACCOUNTING_MANDATORY_APPROVAL_DOCUMENT_TYPES`, `D-352`):** `YEAR_CLOSE_RERUN`, `POSTING_REDATE`, `PERSONAL_DATA_REDACTION`, `BANK_MATCH_CORRECTION`, `FX_REVALUATION_REPIN`, `INBOX_POSITION_LOST` always run a 1-step default approval even when no custom tenant rule matches; UI displays an informational lock pill on `/accounting/setup/approval-rules`.

### 2.2 Maker ≠ Checker, Multi-Step Quorum (`D-560`) & Waiting-State SLA (`WS-06`)
1. **Maker ≠ Checker & SoD Pre-Check + Authoritative Trigger Enforcement (`D-146`, `D-227`, `D-467`, `D-560`):**
   - `ApprovalRequestSummaryDto.makerUserIds` (`UUID[]`) lists `submittedBy` **plus every human user (`created_by` / `updated_by`) who authored or edited any row covered by the frozen payload**.
   - **Client pre-check:** When `currentUser.id ∈ request.makerUserIds`, `<ApprovalPanel>` and `<ApprovalRequestInspector>` **disable** `Approve` and `Reject` and display a neutral/caution governance banner:
     - EN: *"Segregation of duties: you authored or submitted this record, so another authorized approver must decide it."*
     - AR: *"فصل الصلاحيات: لقد قمت بإعداد هذا السجل أو إرساله، لذا يجب أن يبتّ فيه معتمِد آخر مخوّل."*
   - **Multi-step distinct-actor check (`D-560`):** When `actions[]` shows `currentUser.id` already recorded `APPROVE` on an earlier step of the same request, `Approve` is disabled (`409 ACCOUNTING.APPROVAL.ACTOR_ALREADY_APPROVED`).
   - **Payment-run & domain SoD errors rendered via `<AccountingErrorAlert>`:**
     - `403 ACCOUNTING.APPROVAL.ACTOR_IS_SUBMITTER`
     - `403 ACCOUNTING.APPROVAL.NOT_ASSIGNED` (current step `ApproverKind` `USER | ROLE | GROUP` does not match caller)
     - `403 ACCOUNTING.PAYMENT_RUN.BANK_CHANGE_MAKER_CONFLICT` (approver edited/confirmed a payee bank account in the run)
     - `403 ACCOUNTING.PAYMENT_RUN.BILL_SUBMITTER_CONFLICT` (approver registered/submitted a bill in the run)
     - `403 ACCOUNTING.PAYMENT_RUN.SIGNATORY_LIMIT` (exceeds bank-account signatory limit)
2. **Step Track, Quorum (`ONE` vs `ALL`) & SLA Countdown (`WS-06`):**
   - `<ApprovalStepTrack>` renders `1..totalSteps` (`MAX_APPROVAL_STEPS = 10`), showing per-step `approverKind` (`USER`, `ROLE`, `GROUP`), `quorum` (`ONE` vs `ALL`, `quorumCount <= 20`), and recorded `ApprovalActionDto` stamps.
   - While `state === 'PENDING'`, `<WaitingStateBadge state="WS-06">` (`accounting-patterns-documents.md`) renders current step owner, remaining `slaHours` (`1..720` display countdown) and `expiresAt` (`expires_after_hours` Worker expiry deadline -> `EXPIRED`), enforcing the **Zero-Resend Law** (never render a "Resend notification" button).

### 2.3 Frozen `payloadHash` Verification & `PAYLOAD_CHANGED` Warning
- Every approval decision (`ApproveRequestDto` / `RejectRequestDto`, and `ApproveLedgerRedactionDto` on `/accounting/ledger/redactions/:approvalRequestId/approve`) **must** send:
  - Header `If-Match: "<version>"` (from `GET /accounting/approval-requests/:id`)
  - Header `x-idempotency-key: <UUIDv7>`
  - Body `expectedPayloadHash: request.payloadHash` (SHA-256 hex digest displayed in `<IdentifierText>`).
- **If the server returns `409 ACCOUNTING.APPROVAL.PAYLOAD_CHANGED`:**
  - `<ApprovalPanel>` / `<ApprovalRequestInspector>` halts the decision modal immediately, renders a high-visibility `caution` banner (*"The underlying document changed since you opened this request (`PAYLOAD_CHANGED`). Review the updated values and new payload hash before deciding."* / *"تغيّرت بيانات المستند الأصلية منذ فتح الطلب. راجع القيم المحدّثة وبصمة الحمولة الجديدة قبل اتخاذ القرار."*), refetches both `GET /accounting/approval-requests/:id` and the target resource, highlights the new `payloadHash` + `ETag`, and requires the checker to explicitly click `Approve` / `Reject` again with a new UUIDv7 key.
- **Special `requestBody` inspection (`D-673`, `D-677`):**
  - When `documentType === 'INBOX_POSITION_LOST'` or `'BANK_MATCH_CORRECTION'`, `ApprovalRequestDetailDto.requestBody` carries the exact submitted declaration/correction JSON snapshot; `<ApprovalRequestInspector>` renders a structured read-only key-value summary of `requestBody` right above the decision bar so the checker verifies the exact positions or match lines covered by `payloadHash`.
- **Ledger PII Redaction routing (`D-220`, `SCN-093`):**
  - When `documentType === 'PERSONAL_DATA_REDACTION'`, approving from `SCR-06` or the Approval Inbox routes to `POST /accounting/ledger/redactions/:approvalRequestId/approve` (`accounting.ledger_redaction.approve`, `If-Match`, `{ approvalRequestId, expectedPayloadHash }`), warning that `[REDACTED]` irreversibly replaces `memo`/`description` while preserving balances and `entry_hash` (`409 ACCOUNTING.ENTRY.REDACTION_LEGAL_HOLD` if under legal hold).

### 2.4 Decision Dialogs & Reason Rules

| Action | Route & Method | Permission | Reason / Comment Rule | DTO Body Sent |
| --- | --- | --- | --- | --- |
| **Approve** | `POST /accounting/approval-requests/:id/approve` *(or `/journal-drafts/:id/approve` with the same body: `requestId` = the draft's `approvalRequestId`, `If-Match` = that request's `version`, `D-771`)* | `accounting.approval.approve` | Optional `comment` (`0..1,000` chars) | `{ requestId, action: "APPROVE", expectedPayloadHash, comment? }` |
| **Approve Redaction** | `POST /accounting/ledger/redactions/:approvalRequestId/approve` | `accounting.ledger_redaction.approve` | Read-only irreversible `[REDACTED]` confirmation | `{ approvalRequestId, expectedPayloadHash }` |
| **Reject** | `POST /accounting/approval-requests/:id/reject` | `accounting.approval.reject` | **Mandatory `reason` (`10..1,000` chars; `10..500` on a journal-draft target, which stores it as `rejection_reason`, `D-771`)**; live character counter; trimmed `< 10` blocks submit | `{ requestId, action: "REJECT", reason, expectedPayloadHash }` |
| **Withdraw** | `POST /accounting/approval-requests/:id/withdraw` | `accounting.approval.withdraw` (`submittedBy === currentUser.id` & `PENDING` only) | **Mandatory `reason` (`10..500` chars)**; returns `MANUAL_JE` draft to `DRAFT` (`D-354`); emits `APPROVAL_REFUSED` outbox on `fiscal_document` (`D-393`) | `{ reason }` |

> **Contract Honesty Note (`CG-WF-08`):** Although `ApprovalActionKind` (`01_Enums.md`) includes `'COMMENT'` (and wave-2 reserved `'DELEGATE'`), `02_Endpoint_Catalogue.md` §10 exposes **no** standalone comment endpoint (`approve`, `reject`, `withdraw` only). The timeline renders `COMMENT` rows if present in `GET /:id/actions`, and omits standalone "Add Comment" / "Delegate" buttons in MVP.

### 2.5 Approval Inbox (`SCR-38` / `SCR-11`) & Rule Builder (`#110`–`#111`) Layout
- **Inbox layout (`Master-Detail` split on `>= 1280px` or `DataTable` + `Drawer` inspector on `768..1279px`):**
  - Filter tabs: **Actionable by Me** (client filter excluding `currentUser.id ∈ makerUserIds`, `state = 'PENDING'`) · **All Pending** · **Submitted by Me** · **Decided / Expired**.
  - `FilterBar` (`POST /accounting/approval-requests/search`): `documentType` (20 live enum options), `state` (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, `EXPIRED`), `submittedFrom` / `submittedTo`.
  - Columns: Request ID (`<IdentifierText>`), Document Type (`t.accounting.enums.approvalDocumentType.*`, neutral icon — Law 1), Target Link (`<IdentifierText>` + deep link to target route; see `CG-WF-06`), Step (`currentStep / totalSteps`), Waiting / SLA (`<WaitingStateBadge>`), State (`<StatusBadge>`), Submitted At.
- **Approval Rule Builder (`/accounting/setup/approval-rules/[id]`):**
  - Header: `documentType` (20 live options), `priority` (`1..10,000`), `isActive`, structured `conditions[]` (`0..20` rows, `MAX_CONDITIONS_PER_RULE_ROW = 20`: `field`, `op`, `value` — zero free-form scripts, `D-195`).
  - Steps list (`GET/POST/PATCH/DELETE /accounting/approval-rules/:id/steps/:stepNo`, `1..10` steps): `stepNo`, `approverKind` (`USER | ROLE | GROUP`), `approverRef`, `quorum` (`ONE | ALL`), `slaHours` (`1..720`).

### 2.6 Four-Combination & Mobile ASCII Wireframes (`UX-10`)

#### 2.6.1 `EN-LTR` × `Light` — Approval Inbox Split View (`/accounting/inbox/approvals`)
```text
+--------------------------------------------------------------------------------------------------+
| Approval Inbox                                                           [Approval Rules Setup]  |
| Tabs: [*Actionable (4)*] [All Pending (6)] [Submitted by Me (2)] [History]                       |
| Filters: [Doc Type: All v] [State: PENDING v] [Search...]                                        |
+-------------------------------------------+------------------------------------------------------+
| REQUESTS (DataTable compact, 400 weight)  | INSPECTOR: Req <bdi>0192e8a1-7c40...</bdi>  ETag:"2" |
| Doc Type      | Step | SLA / Expires      | Target: MANUAL_JE · <bdi>0192e89f...</bdi> [Open ->] |
|---------------|------|--------------------| Payload Hash: <bdi>sha256:9f4a...81c2</bdi>          |
| *Manual JE    | 1/2  | [⏱ 3h left · Role] | Step Track: [● Step 1: Chief Acct (ONE)] -> [○ 2:CFO]|
|  Payment Run  | 2/2  | [⏱ 18h left · CFO] | Waiting (WS-06): Role FINANCE_MGR · Expires Nov 03   |
|  Vendor Bill  | 1/1  | [! Maker = You]    |                                                      |
|  Period Reopen| 1/1  | [⏱ 6h left · CFO]  | Comment (optional, <= 1,000): [Verified supporting ] |
|               |      |                    |                     [Reject...]  [*Approve Step 1*]  |
+-------------------------------------------+------------------------------------------------------+
```

#### 2.6.2 `AR-RTL` × `Light` — Inline `<ApprovalPanel>` When Viewer Is in `makerUserIds`
```text
+--------------------------------------------------------------------------------------------------+
| لوحة الاعتماد (ApprovalPanel) · حالة الطلب: [بانتظار الاعتماد PENDING]           ETag: "1"      |
+--------------------------------------------------------------------------------------------------+
| المسار: [● الخطوة 1 من 2: مدير الحسابات (نصاب: واحد ONE)] <─── [○ الخطوة 2 من 2: المدير المالي]  |
| حالة الانتظار (WS-06): بانتظار دور FINANCE_MGR · المهلة المتبقية: 4 ساعات · ينتهي: 2026-11-03    |
| بصمة الحمولة المجمّدة: <bdi dir="ltr">9f4a7c2e...108b81c2</bdi>                                  |
|                                                                                                  |
| [!] فصل الصلاحيات (Maker ≠ Checker): أنت مُعدّ أو مُرسِل هذا السجل (makerUserIds)، لذلك لا يمكنك |
|     اعتماده أو رفضه. يمكنك فقط سحب الطلب لإرجاع المسودة إلى حالة "مسودة" وتعديلها.              |
|                                                                                                  |
| [سحب طلب الاعتماد... (يتطلب سبباً 10..500 حرف)]            [اعتماد (معطّل)] [رفض (معطّل)]        |
+--------------------------------------------------------------------------------------------------+
```

#### 2.6.3 `EN-LTR` × `Dark` (`html.dark`) — `409 PAYLOAD_CHANGED` Warning & Reject Modal
```text
+--------------------------------------------------------------------------------------------------+
| DARK MODAL (bg-card --ink-900) · Reject Approval Request <bdi>0192e8a1...</bdi>             [X]  |
+--------------------------------------------------------------------------------------------------+
| [▲ CAUTION · bg-caution-subtle] PAYLOAD CHANGED SINCE OPENED (409)                               |
| The underlying record's payload hash changed from <bdi>9f4a...81c2</bdi> to                      |
| <bdi>3b12...e904</bdi>. Latest data has been reloaded. Confirm you reviewed the updated values.  |
|                                                                                                  |
| Rejection Reason * (Mandatory: 10..1,000 characters):                                            |
| [Cost center CC-100 on line 1 should be split 60/40 with Alexandria branch CC-205.             ] |
|                                                                                     82 / 1,000   |
| Effect: Marks request REJECTED; returns Manual JE to REJECTED (or emits APPROVAL_REFUSED).       |
|                                                                   [Cancel]  [*Confirm Reject*]   |
+--------------------------------------------------------------------------------------------------+
```

#### 2.6.4 `AR-RTL` × `Dark` (`html.dark`, `dir="rtl"`) — Approval Inbox & `INBOX_POSITION_LOST` Snapshot
```text
+--------------------------------------------------------------------------------------------------+
| صندوق الاعتمادات · وضع داكن (--ink-950 / --ink-900)                     [إعداد قواعد الاعتماد]   |
+------------------------------------------------------+-------------------------------------------+
| تفاصيل الطلب <bdi>0192e8d4...</bdi>       ETag: "1"  | الطلبات المعلّقة                          |
| النوع: إعلان فقدان موضع وارد (INBOX_POSITION_LOST)   | النوع            | الخطوة | المهلة        |
| بصمة الحمولة: <bdi>7d01...44aa</bdi>                 |------------------|--------|---------------|
| ملخص الطلب المجمّد (requestBody):                    | *فقدان موضع وارد | 1 / 1  | [⏱ ساعتان]    |
|  • نطاق المواضع: <bdi>1042 .. 1044</bdi> (3 مواضع)   |  دفعة سداد       | 2 / 2  | [⏱ 18 ساعة]   |
|  • تأكيد التجارة (tradeConfirmedLost): نعم           |  قيد يومية يدوي  | 1 / 2  | [! مُعدّ السجل]|
| [*اعتماد الإعلان*]  [رفض الطلب...]                   |                                           |
+------------------------------------------------------+-------------------------------------------+
```

#### 2.6.5 Mobile `375px` Stacked Approval Inspector (`44×44px` Touch Targets)
```text
+-------------------------------------+
| < Approval Inbox          [PENDING] |
| Manual JE · Step 1 of 2 (Quorum: 1) |
| ⏱ 3h SLA left · Expires 2026-11-03  |
+-------------------------------------+
| Target: <bdi>0192e89f-...</bdi> [>] |
| Hash:   <bdi>9f4a7c2e...81c2</bdi>  |
+-------------------------------------+
| Step 1: ● Chief Accountant (Pending)|
| Step 2: ○ CFO (Waiting)             |
+-------------------------------------+
| [Reject (Reason)...]   [*Approve*]  |
+-------------------------------------+
```

---

## 3. Import Wizard in Two Modes (`P03.T06.S3` · `UX-14` · `OD-13` / `D-691`)

### 3.1 Architectural Phasing Rule (`OD-13` / `D-691`)
Per `accounting-app-implementation-plan.md` (`OD-13`, `D-691`) and `accounting-app-plan-p03-ux-foundation.md` (`P03.T06.S3`):
1. **Mode A — Stage 1 (`P15`, zero `@mutakamel/storage` dependency):** Opening Balances (`SCR-09`, `/accounting/setup/opening-balances`) submits pure JSON batch payloads (`CreateOpeningBalanceBatchDto` -> `POST /accounting/opening-balances`). To give accountants spreadsheet speed in Stage 1 **without uploading or storing any file**, `<OpeningBalanceWizard>` includes an optional **100% client-side in-browser CSV/TSV/XLSX parser & clipboard paste mapper** (`useLocalSheetParser`) whose `File` / `ArrayBuffer` never leaves browser memory and never touches the network as a file.
2. **Mode B — From `P17.T06` (`@mutakamel/storage` `0.0.22` adopted):** Full multipart file imports (`BodyLimitClass.ACCOUNTING_IMPORT_MULTIPART`, `x-idempotency-key (7 d)`) power the Migration & Import Hub (`SCR-35`, `/accounting/setup/imports` & `/accounting/setup/imports/[id]`), **Chart / Accounts Import by File** (`POST /accounting/accounts/import` launched from `SCR-02` `/accounting/setup/chart-of-accounts` or `SCR-35`), entity-specific `/import` routes, Payroll Import (`SCR-36`, `POST /accounting/payroll-imports`), and Bank Statement Import (`SCR-25`, `POST /accounting/bank-statements/import`). Every generic file import enforces **mandatory dry-run before commit** (`D-197`).

---

### 3.2 Mode A Specification — Stage-1 Opening-Balance JSON Wizard (`SCR-09`)

#### 3.2.1 Batch Kinds, Uniqueness & Guardrails (`D-077`, `D-493`, `D-666`, `D-676`, `D-759`)
- **One live batch per `(company_id, kind)`** (`uq_acc_opening_balance_batches_company_kind_live` where `status <> 'CANCELLED'`).
- **Two `OpeningBalanceBatchKind` modes (`CreateOpeningBalanceBatchDto.kind`):**
  1. `OPENING` (default): `asOfDate` **must equal** `companyProfile.accountingActivatedOn` (`D-077`; locked read-only to activation date). Refused with `409 ACCOUNTING.PERIOD.CLOSED` or `409 ACCOUNTING.PERIOD.PERMANENTLY_CLOSED` if any `NORMAL` period of the company is already `CLOSED` / `PERMANENTLY_CLOSED` for `GL` (`D-666`). Empty `balances: []` is explicitly valid for a greenfield company with zero opening position (`D-666`: posts no entry, `data.posting = null`, satisfies `LOCK_GL` readiness).
  2. `TRADE_ONBOARDING` (`D-676`): Enabled only when company's `OPENING` batch is already `POSTED` without Trade posting and tenant holds `accounting.integration.trade_posting` (else `403 ACCOUNTING.FEATURE.NOT_ENTITLED`). `asOfDate > accountingActivatedOn` in an `OPEN` `GL` period. Accepts **only** `inventoryLayers[]`, `inTransit[]`, `streamHeads[]`, and activation-cutoff `deviceChainHeads[]` (hides GL `balances`, `openItems`, `instruments`, `assets`, `taxPools`); posts no journal entry; verifies inventory/in-transit sums against ledger `INVENTORY` & `INVENTORY_IN_TRANSIT` balances at cut-off and releases parked Trade movements/receipts. Never created by file import.

#### 3.2.2 Mode A Four-Step Stepper Flow
1. **Step 1 — Batch Kind, Ledger & Cut-off Date:**
   - Selects `kind` (`OPENING` vs `TRADE_ONBOARDING`), `ledgerId` (primary ledger), and `asOfDate`.
   - Displays pre-flight checklist: fiscal year `OPEN` (`period 0 OPENING` for `OPENING`), `OPENING_BALANCE_EQUITY` role mapped, `SUSPENSE` rule explained (`suspense_amount` must reach `0` before posting).
2. **Step 2 — Balances Grid & Optional In-Browser Local Parse (Zero Upload):**
   - **Tab 1 (`balances[]`, `0..50,000` lines, `MAX_OPENING_BALANCE_LINES = 50,000`):** Reuses `<JournalLineGrid variant="openingBalance">` (`§1.6`) with `accountId`, `direction` (`DEBIT`/`CREDIT`), `amountTxn`, `currencyCode`, `amountFunctional`, optional `fxRate`, `branchId`, `dimensionSetId`, `partyId`, `note` (`<= 500` chars).
   - **Optional Local File / Clipboard Helper (`useLocalSheetParser`):**
     - Dropzone / button clearly labeled: **Load Local CSV / XLSX in Browser (No file uploaded)** / **قراءة ملف CSV / XLSX محلياً في المتصفح (دون رفع الملف)**.
     - Parses sheet rows strictly inside a Web Worker / browser memory, maps columns (`Account Code` -> resolved `accountId` via `/accounting/accounts/lookup` / cached chart, `Debit`, `Credit`, `Currency`, `Functional Amount`, `Branch`, `Party`, `Note`), flags unmapped account codes or invalid `DecimalString` cells inline before populating `CreateOpeningBalanceBatchDto.balances[]`, and discards the local `File` buffer on unmount.
   - **Optional Subledger & Baseline Tabs (for `OPENING`; tabs 6–7 for `TRADE_ONBOARDING`):**
     - `openItems[]` (`OpeningOpenItemInput`), `instruments[]` (`OpeningInstrumentInput`), `assets[]` (`OpeningAssetInput`), `taxPools[]` (`OpeningTaxPoolInput`), `inventoryLayers[]` (`OpeningInventoryLayerInput` — allows negative `quantity` only with `unitCost = "0"` for Trade deficit), `inTransit[]` (`OpeningInTransitInput`), `streamHeads[]` (`OpeningStreamHeadInput`), `deviceChainHeads[]` (`OpeningDeviceChainHeadInput`).
   - Saves batch via `POST /accounting/opening-balances` (`accounting.import.run`, `x-idempotency-key (7 d)`) -> `201` `OpeningBalanceBatchSummaryDto` (`status = 'DRAFT'`, `ETag` captured via `GET /:id`).
3. **Step 3 — Server Validation & Findings (`POST /accounting/opening-balances/:id/validate`):**
   - Calls `POST /accounting/opening-balances/:id/validate` (`accounting.import.run`, `If-Match`, `x-idempotency-key` `24 h`) -> `200` summary with blocking and non-blocking counts (`D-493`), followed immediately by `GET /accounting/opening-balances/:id` to render full findings, `balancingAmount` (`OPENING_BALANCE_EQUITY` plug), and `suspenseAmount`.
   - Any blocking finding or `suspenseAmount !== "0"` disables Step 4 **Post**.
   - **Editing a `DRAFT` / `VALIDATED` batch in Stage 1 (`CG-WF-07`):** Because `02_Endpoint_Catalogue.md` §11 has no `PATCH /accounting/opening-balances/:id`, clicking **Revise Lines** preserves the current payload in client wizard state, runs `POST /accounting/opening-balances/:id/cancel` (`CancelOpeningBalanceBatchDto.reason`, `10..500` chars, releasing `uq_acc_opening_balance_batches_company_kind_live`), and lets the user edit and submit a clean `POST /accounting/opening-balances` (cancel and recreate is the contract; `CG-WF-07`).
4. **Step 4 — Post Opening Batch (`POST /accounting/opening-balances/:id/post`):**
   - Calls `POST /accounting/opening-balances/:id/post` (`accounting.journal_draft.post`, `If-Match`, `x-idempotency-key`) -> `200` + chain headers (`data.posting: PostingReceiptDto`, or `null` for an empty/`TRADE_ONBOARDING` batch).
   - **Dual-actor guardrail (`D-759`):** If `openItems[]` contains `AR` rows carrying `sourceDocument` and `currentUser.id` authored the batch, the UI warns upfront and handles `403 ACCOUNTING.IMPORT.SECOND_ACTOR_REQUIRED` by instructing a second user with `accounting.journal_draft.post` to post the validated batch.

---

### 3.3 Mode B Specification — Multipart File Import Wizard (`P17.T06` · `SCR-35`, `SCR-02`, `SCR-36`, `SCR-25`)

#### 3.3.1 Supported `ImportEntity` Catalogue & Entry Points (`01_Enums.md`, `D-713`, `D-759`)
- **15 `ImportEntity` members via `/accounting/imports` (`SCR-35`):**
  - `ACCOUNTS` (also launched contextually from **Chart of Accounts `SCR-02`** `/accounting/setup/chart-of-accounts` via `POST /accounting/accounts/import` or pre-selected `entity=ACCOUNTS` on `SCR-35`), `PARTIES`, `ITEMS`, `OPENING_BALANCES`, `OPEN_ITEMS`, `CHEQUES`, `ASSETS`, `FX_RATES`, `JOURNAL_ENTRIES`, `BANK_STATEMENT`, `PARTY_FINANCE_PROFILES`, `DIMENSION_VALUES`, `PAYMENT_TERMS`, `PARTY_BANK_ACCOUNTS` (commits rows into `PENDING_CONFIRMATION` dual control, `D-183`), `LEGACY_DOCUMENTS` (requires second actor at commit: `403 ACCOUNTING.IMPORT.SECOND_ACTOR_REQUIRED`, `D-759`).
  - *Explicitly excluded from file import (`D-713`):* Company `bank-accounts`, `recurring-templates`, and `TRADE_ONBOARDING` opening batches.
- **Dedicated domain import workflows reusing the `<AsyncProgressCard>` & `<ImportSafeErrorTable>` primitives:**
  - **Entity-specific `202 + Location` shortcuts:** `POST /accounting/accounts/import` (`accounting.account.create`, `TENANT`), `POST /accounting/party-finance-profiles/import` (`accounting.party_finance_profile.create`, `COMPANY`), `POST /accounting/dimension-values/import` (`accounting.dimension.create`, `COMPANY`), `POST /accounting/fx-rates/import` (`accounting.fx_rate.import`, `COMPANY`, max `5,000` rows `MAX_FX_RATE_IMPORT_ROWS` — see `CG-WF-01`), `POST /accounting/payment-terms/import` (`accounting.payment_terms.create`, `COMPANY`), `POST /accounting/party-bank-accounts/import` (`accounting.party_bank_account.update`, `COMPANY`), `POST /accounting/assets/import` (`accounting.asset.create`, `COMPANY`). Each is one multipart request: the `file` part plus a JSON `body` part validated as `ImportCollectionDto` (`companyId` only on the `TENANT` accounts import, whose commit also proves `accounting.account.create`); the path fixes the entity, no `fileRef` exists, and the fx-rates import is a file whose rows carry `FxRateRowInput` (`D-772`, `D-700`).
  - **Bank Statement Import (`SCR-25`):** `POST /accounting/bank-statements/import` (`accounting.bank_statement.import` · `accounting.treasury.bank_reconciliation` · `COMPANY` · `x-idempotency-key (7 d)` -> `202 + Location`; multipart CSV/XLSX against `bankStatementTemplateId`, `D-118`).
  - **Payroll Import (`SCR-36`):** `POST /accounting/payroll-imports` (`accounting.import.run` · `accounting.integration.payroll_import` · `COMPANY` · `x-idempotency-key (7 d)` -> `202 + Location`; fixed 5-column schema v1, `D-115`) -> inspect `branchSplit` preview on `GET /accounting/payroll-imports/:id` -> `POST /accounting/payroll-imports/:id/post` (`accounting.journal_draft.post`, `If-Match`, `200` + chain headers).

#### 3.3.2 Mode B Five-Step Mandatory Dry-Run Wizard (`/accounting/imports`)
1. **Step 1 — Entity, Migration Preset & Official Template:**
   - Selects `entity` (`ImportEntity`), optional `preset` (`GET /accounting/migration-presets`: `ODOO`, `QUICKBOOKS`, `DAFTRA`, `QOYOD`, `GENERIC`), and offers **Download Template** (`GET /accounting/imports/templates/:entity` -> short-lived `SignedDownloadDto`).
   - When correcting a prior job (`D-498`), links `correctsJobId` so already-committed business keys are skipped cleanly.
2. **Step 2 — Multipart Upload & Column Mapping Override:**
   - Validates file extension (`.csv`, `.xlsx`), row ceiling (`MAX_IMPORT_ROWS = 100,000`, `5,000` for FX rates), and Gateway `ACCOUNTING_IMPORT_MULTIPART` size limit before upload.
   - Optional column-mapping override editor over preset's `columnMap` and closed `transforms` (`TRIM`, `UPPERCASE`, `DATE_DMY`, `DECIMAL_COMMA`, `NEGATE`).
   - Submits `POST /accounting/imports` (`accounting.import.create`, `x-idempotency-key (7 d)`) -> `201 + Location` (`ImportJobSummaryDto` + `ETag`). The request is one multipart call: the `file` part plus a JSON `body` part validated as `ImportDto`; there is no `fileRef` field, because the server stores the bytes and derives key, hash, type and size (`CG-WF-01`, closed by `D-772`).
3. **Step 3 — Mandatory Dry-Run Execution (queued by the create; `POST /accounting/imports/:id/dry-run` repeats it):**
   - No client call starts the first dry run: creating the job queues it (`D-772`). The same step offers **Re-run Dry Run** (`POST /accounting/imports/:id/dry-run`, `accounting.import.create`, `If-Match`, `x-idempotency-key (7 d)` -> `202 + Location`), valid on a `DRY_RUN_COMPLETED` job and repeating the dry run on the stored file through the edge `DRY_RUN_COMPLETED -> VALIDATING`.
   - Polls `GET /accounting/imports/:id` (`QUEUED` -> `VALIDATING` -> `DRY_RUN_COMPLETED` or `FAILED`). **Commit button does not exist / remains locked until `status === 'DRY_RUN_COMPLETED'` and error count is `0` (`422 ACCOUNTING.IMPORT.DRY_RUN_REQUIRED` / `422 ACCOUNTING.IMPORT.ROW_ERRORS`).**
   - User may cancel via `POST /accounting/imports/:id/cancel` (`accounting.import.create`, `If-Match`) at any point before `APPLYING` / `COMPLETED`.
4. **Step 4 — Safe Error Report (Zero PII) & Row-Count Acknowledgement:**
   - If `errorRows > 0`, fetches `GET /accounting/imports/:id/errors` (`ImportResultDto.errors[]`) and renders `<ImportSafeErrorTable>`:
     - Columns: `Row #` (`rowNo`, Western digits), `Field` (`field` in `<IdentifierText>`), `Error Code & Localized Cause` (`code` mapped through `t.accounting.errors.*`), `Owner Ref` (`ownerRef` `<IdentifierText>`).
     - **Privacy invariant:** Raw cell values from the uploaded file are **never** returned by the server or echoed in DOM/logs (`02_Endpoint_Catalogue.md` §11 line 1094).
     - Recovery CTA: **Upload Corrected File (`correctsJobId`)** or **Cancel Job**.
   - When `errorRows === 0` (`DRY_RUN_COMPLETED`), displays `resultCounts` (`totalRows`, `validRows`, `insertedRows`, `skippedRows`) and an explicit confirmation checkbox that binds `CommitImportDto.acknowledgeRowCounts = resultCounts.validRows`.
5. **Step 5 — Commit & Async Apply (`POST /accounting/imports/:id/commit`):**
   - Calls `POST /accounting/imports/:id/commit` (`accounting.import.execute`, `If-Match`, `x-idempotency-key (7 d)`, `{ acknowledgeRowCounts }`) -> `202 + Location`.
   - Polls `GET /accounting/imports/:id` (`APPLYING` -> `COMPLETED` or `FAILED`).
   - Handles `409 ACCOUNTING.IMPORT.DRY_RUN_STALE` (underlying accounts/periods changed since dry-run -> one-click **Re-run Dry Run** with fresh UUIDv7 key) and `403 ACCOUNTING.IMPORT.SECOND_ACTOR_REQUIRED` (`LEGACY_DOCUMENTS` `D-759` -> shows Waiting Banner for a second user with `accounting.import.execute` to click Commit).

### 3.4 Four-Combination & Mobile ASCII Wireframes (`UX-14`)

#### 3.4.1 `EN-LTR` × `Light` — Mode A (`SCR-09` Stage-1 Opening Balances JSON + Local Parse)
```text
+--------------------------------------------------------------------------------------------------+
| Opening Balances Wizard (Stage 1 JSON Mode)                              [Cancel Batch]          |
| Stepper: [✓ 1. Kind & Cut-off] ──> [● 2. Balances & Subledgers] ──> [○ 3. Validate] ──> [○ 4.Post]|
+--------------------------------------------------------------------------------------------------+
| Batch Kind: OPENING · Cut-off (Activation Date): 2026-01-01 [Locked] · Ledger: Primary (EGP)     |
| Tabs: [*GL Balances (4)*] [Open Items (12)] [Cheques (0)] [Assets (3)] [Inventory Layers (0)]    |
+--------------------------------------------------------------------------------------------------+
| [Load Local CSV/XLSX in Browser (No file uploaded)]  [Paste from Clipboard]      [+ Add Account] |
| # | Account (bdi)             | Dir    | Txn Amount    | Ccy | Functional EGP | Party   | Note   |
|---|---------------------------|--------|---------------|-----|----------------|---------|--------|
| 1 | 110101 · CIB Main EGP     | DEBIT  |    250,000.00 | EGP |     250,000.00 | —       | Open   |
| 2 | 120100 · Trade Receivable | DEBIT  |     90,000.00 | EGP |      90,000.00 | Multiple| AR sub |
| 3 | 210100 · Trade Payable    | CREDIT |    140,000.00 | EGP |     140,000.00 | Multiple| AP sub |
+--------------------------------------------------------------------------------------------------+
| Functional Dr: EGP 340,000.00 | Cr: EGP 140,000.00 | Plug -> OPENING_BALANCE_EQUITY: 200,000.00  |
| Suspense Account Balance: EGP 0.00 [✓ Clear]              [Save Draft]  [*Save & Validate ->*]   |
+--------------------------------------------------------------------------------------------------+
```

#### 3.4.2 `AR-RTL` × `Light` — Mode B (`P17.T06` Multipart File Import: Step 4 Dry-Run & Safe Errors)
```text
+--------------------------------------------------------------------------------------------------+
| [إلغاء المهمة]                                    معالج استيراد الملفات · دليل الحسابات (ACCOUNTS)|
| المسار: [✓ 1. الكيان والقالب] <── [✓ 2. رفع الملف] <── [✓ 3. الفحص التجريبي] <── [● 4. النتائج]   |
+--------------------------------------------------------------------------------------------------+
| الوظيفة: <bdi>0192e8f0-1120...</bdi> · القالب: Daftra (دفترة) · الحالة: [اكتمل الفحص بوجود أخطاء] |
| ملخص الصفوف: الإجمالي: 420  |  صالح: 418  |  مرفوض: 2  |  اعتماد الحفظ مغلق حتى تصحيح الأخطاء    |
+--------------------------------------------------------------------------------------------------+
| جدول الأخطاء الآمن (لا يعرض القيم النصية الخام حفاظاً على الخصوصية):                             |
| مرجع المالك (bdi) | رمز الخطأ والسبب                                    | الحقل (bdi)   | رقم الصف|
|-------------------|-----------------------------------------------------|---------------|---------|
| 110299            | ACCOUNTING.ACCOUNT.PARENT_POSTABLE (الأب يقبل ترحيل)| parentCode    |      47 |
| 410105            | ACCOUNTING.VALIDATION.FAILED (عملة غير صالحة)       | currencyCode  |     183 |
+--------------------------------------------------------------------------------------------------+
| [*رفع ملف مصحّح (يرتبط بـ correctsJobId)*]  [تنزيل القالب الرسمي CSV]                            |
+--------------------------------------------------------------------------------------------------+
```

#### 3.4.3 `EN-LTR` × `Dark` (`html.dark`) — Mode B Clean Dry-Run Ready to Commit (`acknowledgeRowCounts`)
```text
+--------------------------------------------------------------------------------------------------+
| DARK CARD (--ink-900) · Import Job <bdi>0192e8f9-88a1...</bdi> · Entity: LEGACY_DOCUMENTS         |
| Stepper: [✓ 1. Preset] -> [✓ 2. Upload] -> [✓ 3. Dry Run] -> [● 4. Acknowledge & Commit]         |
+--------------------------------------------------------------------------------------------------+
| [✓ DRY_RUN_COMPLETED · 0 Errors]  Preset: ODOO  |  ETag: "2"  |  Idempotency TTL: 7 days         |
| Total Rows: 1,240   |   Valid to Insert: 1,240   |   Already Committed (Skipped): 0              |
|                                                                                                  |
| [i] Dual-Control Notice (D-759): LEGACY_DOCUMENTS requires a second authorized user              |
|     (accounting.import.execute) different from the uploader (<bdi>0192d001...</bdi>) to commit.   |
|                                                                                                  |
| [x] I acknowledge committing 1,240 validated rows (`acknowledgeRowCounts: 1240`).                |
|                                                        [Re-run Dry Run]  [*Commit 1,240 Rows*]   |
+--------------------------------------------------------------------------------------------------+
```

#### 3.4.4 `AR-RTL` × `Dark` (`html.dark`, `dir="rtl"`) — Mode A `TRADE_ONBOARDING` Batch (`D-676`)
```text
+--------------------------------------------------------------------------------------------------+
| معالج الأرصدة الافتتاحية · وضع داكن (--ink-950) · النوع: إلحاق المخزون والتجارة (TRADE_ONBOARDING)|
+--------------------------------------------------------------------------------------------------+
| تاريخ القطع: [2026-06-30] (فترة يونيو 2026 مفتوحة · لا ينشئ قيد يومية؛ يطابق رصيد المخزون بالدفتر)|
| التبويبات المتاحة فقط: [*طبقات تكلفة المخزون (85)*] [بضاعة بالطريق (4)] [مؤشرات التدفق والأجهزة]  |
+--------------------------------------------------------------------------------------------------+
| الإجراء | تكلفة الوحدة | الكمية    | المستودع (bdi) | الصنف (bdi)                       | #       |
|---------|--------------|-----------|----------------|-----------------------------------|---------|
|  [···]  |       145.50 |    120.00 | WH-CAI-01      | ITM-009412                        | 1       |
|  [···]  |         0.00 |     -5.00 | WH-CAI-01      | ITM-004110 (عجز مسموح بتكلفة صفر) | 2       |
+--------------------------------------------------------------------------------------------------+
| مطابقة حساب المخزون (INVENTORY): مطابق لرصيد الأستاذ  |  [*ترحيل الدفعة وإطلاق الحركات المعلّقة*] |
+--------------------------------------------------------------------------------------------------+
```

#### 3.4.5 Mobile `375px` Import Status & Safe Error View (`< 768px`)
```text
+-------------------------------------+
| < Import ACCOUNTS    [DRY_RUN_DONE] |
| Job: <bdi>0192e8f0-1120...</bdi>    |
| Rows: 420 Total · 418 Valid · 2 Err |
+-------------------------------------+
| Error Row #47 · Field: parentCode   |
| Parent account 110299 is postable.  |
+-------------------------------------+
| Error Row #183 · Field: currencyCode|
| Invalid ISO 4217 currency code.     |
+-------------------------------------+
| [*Upload Corrected File*]           |
| [Cancel Import Job]                 |
+-------------------------------------+
```

---

## 4. Bulk & Async Job Progress (`P03.T06.S4` · `UX-13`)

### 4.1 Three-Tier Bulk & Long-Running Execution Taxonomy
Accounting endpoints fall into **three distinct execution contracts**; `<BulkActionBar>` / `<AsyncProgressCard>` adapts strictly to the endpoint's exact class and **never** conflates them:

| Tier | HTTP Contract | Representative Catalogue Routes | UI Pattern & Failure Semantics |
| --- | --- | --- | --- |
| **Tier 1 — Sync All-or-Nothing** | `200 OK` (single DB tx) | `POST /accounting/journal-drafts/bulk-post` (+ chain headers), `POST /accounting/periods/bulk-state` | `<BulkConfirmDialog>` -> inline spinner -> single success toast with chain receipt OR atomic rollback alert naming the offending target (`zero` partial writes). |
| **Tier 2 — Sync Partial-Success** | `200 OK` (all succeeded) or `207 Multi-Status` (`BulkOperationResultDto<T>`) | Master `/bulk`, `/bulk-update`, `/bulk-delete`, `/bulk-restore` on `accounts`, `account-roles/bulk-update`, `party-finance-profiles`, `dimension-values`, `recurring-templates`, `payment-terms`, `bank-accounts`, `party-bank-accounts`, `bank-matching-rules/bulk-update`, `instruments/bulk`, `assets`, `deferral-templates/bulk`, `approval-rules` (`<= 100` rows, `MAX_SYNC_BULK_ITEMS` / DTO array max) | `<BulkResultPanel>` (`@/design-system`): shows `succeeded.length` vs `failed.length`, lists `failed[]` (`index`, `code`, `message`, `details`), keeps failed rows selected so the operator fixes and retries **only** the failed rows with a fresh UUIDv7 key. |
| **Tier 3 — Async `202 Accepted` Jobs** | `202 Accepted` + `Location` + optional `Retry-After` | `POST /accounting/bulk-operations`, `/imports/*`, `.../import`, `.../export`, `/exports/:code/run`, `/reports/:code/run` & `/reports/trial-balance` (over budget), `/depreciation-runs`, `/asset-tax-pools/roll-forward`, `/deferral-runs`, `/fx-revaluation-runs`, `/inventory/valuation-runs`, `/inventory/reconciliation-runs`, `/reconciliations/authority/run`, `/tax/rule-set-versions/:id/replay`, `/input-tax/recovery-runs`, `/integrity-checks/run`, `/payment-runs/:id/propose` & `generate-file`, `/dunning-runs/:id/propose` & `issue`, `/statements/issue`, `/bank-statements/:id/auto-match`, `/fiscal-documents/:id/submit`, `/authority-documents/:id/{resubmit,request-cancel,decline,request-reject}`, `/receipt-batches/{flush,:id/submit}`, `/authority/reference-tables/:tableCode/sync`, `/item-code-requests/:id/submit` | `<AsyncProgressCard>` (wrapping `@/design-system` `AsyncJobState`) + persistent `<AccountingJobTrayDrawer>` so the user can navigate away without losing polling or download links. |

### 4.2 Cross-Target `POST /accounting/bulk-operations` (`1..500` Targets)
- **Endpoint:** `POST /accounting/bulk-operations` (`accounting.bulk_operation.create` · `accounting.ledger.core` · `TENANT` · `x-idempotency-key` -> `202 + Location + Retry-After`) polled via `GET /accounting/bulk-operations/:id` (`accounting.bulk_operation.read` · `TENANT`).
- **Scope & Active MVP Kinds (`01_Enums.md`, `MAX_BULK_TARGETS = 500`):**
  - Live `BulkOperationScope`: `COMPANY`, `FISCAL_PERIOD`, `RULE_SET` *(reserved hidden: `ALLOCATION_RULE` w1, `ASSET` w2, `PROJECT_CONTRACT` w3)*.
  - **10 Live `BulkOperationKind`s:**
    1. `CLOSE_PERIOD`
    2. `SOFT_CLOSE_PERIOD`
    3. `REOPEN_PERIOD` — `<BulkConfirmDialog>` collects per-period approved `PERIOD_REOPEN` request mapping in `parameters.approvals: Record<targetId, approvalRequestId>` (`D-358`).
    4. `ADOPT_RULE_SET_VERSION`
    5. `REBUILD_LEDGER_FACTS` — requires companion permission `accounting.bulk_operation.run` in addition to `accounting.bulk_operation.create`.
    6. `POST_DEPRECIATION`
    7. `POST_DEFERRALS`
    8. `START_CLOSE` — re-checked per target company for `accounting.close.start`.
    9. `RUN_CLOSE_TASK` — re-checked per target company for `accounting.close.complete_task` (plus `accounting.asset.run_depreciation` / `accounting.deferral.run` for `DEPRECIATION_POSTED` / `DEFERRALS_POSTED`, `D-660`).
    10. `RUN_REPORT` — re-checked per target company for `accounting.report.run`.
  - *11 Reserved `BulkOperationKind`s (`ADOPT_PACK_VERSION`, `RUN_RECURRING`, `RUN_FX_REVALUATION`, `RETRY_POSTING_EXCEPTIONS`, `YEAR_END_CLOSE`, `ALLOCATION_CYCLE_RUN`, `ALLOCATION_CYCLE_REVERSE`, `REVALUE_ASSET_CLASS`, `RUN_WIP_RECOGNITION`, `POST_INSTRUMENT_ACCRUALS`, `POST_INSTRUMENT_RECLASSIFICATION`):* never offered in MVP UI (`403 ACCOUNTING.FEATURE.NOT_ENTITLED`).
- **Terminal Outcomes & Per-Target Scope Isolation:**
  - `BulkOperationStatus`: `QUEUED` -> `RUNNING` -> `COMPLETED` (all succeeded), **`PARTIAL`** (`caution` badge — `succeededCount > 0 && failedCount > 0`), or `FAILED` (`negative` badge — `succeededCount === 0`).
  - A target where the caller lacks company/task permission fails individually in `results[]` with `errorCode: "ACCOUNTING.SCOPE.TARGET_DENIED"` **without aborting sibling targets**.
  - **Retry Failed Targets Only:** When `status` is `PARTIAL` or `FAILED`, `<BulkTargetResultsTable>` enables **Retry Failed Targets (N)**, which submits a **new** `POST /accounting/bulk-operations` with **only** the failed `targetIds` and a **fresh UUIDv7 `x-idempotency-key`** (`D-768`; backend records `retry_of_id`).

### 4.3 Domain-Specific `202` Polling & Edge-Case Rules (`useAsyncJobPoller`)
1. **Polling Cadence & Realtime Resync (`01_Context_Headers_and_Responses.md`):**
   - Reads `Location` (canonicalized through `/api/tenant/accounting/v1/...`) and `Retry-After` seconds from the `202` response.
   - Polls at `max(Retry-After, 2s)` with bounded exponential backoff (`2s -> 3s -> 5s -> 8s -> 15s` max + `±15%` jitter), pauses polling while `document.visibilityState === 'hidden'`, resumes immediately on tab focus, and subscribes to `useRealtimeResync(reload)` (`accounting.batch.completed.v1` where emitted).
2. **Honest Progress Law (Zero Fake Percentages):**
   - Determinate progress bar (`completedTargets / targetCount`) renders **only** when the polled DTO exposes real counters (`BulkOperationDetailDto`: `succeededCount + failedCount` over `targetCount`; `ImportJobSummaryDto.resultCounts`).
   - When the polled resource exposes status only (`ReportRunSummaryDto`, `ExportRunSummaryDto`, `GateReportDto.G10_REPLAY`, `IntegrityCheckLatestDto`), `<AsyncProgressCard>` shows an indeterminate pulse track + elapsed wall-clock timer (`00:14`) + current status badge (`QUEUED` / `RUNNING`) — **never** a fabricated `45%` spinner.
3. **Special Status Resources & Quirks Verified from Catalogue:**
   - **Exports (`POST /accounting/*/export` & `POST /accounting/exports/:code/run`):** Polls `GET /accounting/exports/runs/:id`. On `COMPLETED`, enables **Download File** (`GET /accounting/exports/runs/:id/download` -> short-lived `SignedDownloadDto` + `checksum`). If `expiresAt` has passed (`410` / expired artifact), `AsyncJobState` switches to `artifact-expired` with **Run Export Again** (fresh UUIDv7 key).
   - **Reports (`GET /accounting/reports/trial-balance` & `POST /accounting/reports/:code/run`):** Handles **dual `200` / `202` response** seamlessly — renders inline immediately on `200`, or mounts `<AsyncProgressCard>` polling `GET /accounting/reports/runs/:id` on `202` (`D-165`).
   - **Tax Rule-Set `G10` Replay (`POST /accounting/tax/rule-set-versions/:id/replay`):** `Location` points to `GET /accounting/tax/rule-set-versions/:id/gate-results` (`G10_REPLAY` entry is `RUNNING` -> `PASS` / `FAIL`; runs in `accounting-app` read chunks with **no** `accounting.batch.completed.v1` event, so HTTP polling is mandatory, `D-499`).
   - **Integrity Checks (`POST /accounting/integrity-checks/run`):** `Location` points to `GET /accounting/integrity-checks/latest` (`D-667`). If another run holds the company lease, `POST .../run` returns `409 ACCOUNTING.REPORT.INTEGRITY_RUN_IN_PROGRESS` — UI treats `409` non-destructively by attaching the poller directly to `GET /accounting/integrity-checks/latest`!
   - **Inventory Reconciliation (`POST /accounting/inventory/reconciliation-runs`):** Returns `200 { tradePosting: false }` (no `Location`, no run created) when the company still awaits its `OPENING` or `TRADE_ONBOARDING` baseline batch (`D-676`) — UI displays an informational callout linking to `SCR-09` Opening Balances instead of polling.
   - **Zero-work Depreciation / Deferral Runs (`D-660`):** When a run ends `FAILED` with `results[].errorCode` equal to `ACCOUNTING.ASSET.DEPRECIATION_ALREADY_POSTED` or `ACCOUNTING.DEFERRAL.RECOGNITION_ALREADY_RUN`, `<AsyncProgressCard>` renders a calm informational summary (*"Nothing left planned for this period — already posted"*), whereas `ACCOUNTING.POSTING.RETRY_LATER` offers **Retry Run** with a fresh UUIDv7 key.

### 4.4 Four-Combination & Mobile ASCII Wireframes (`UX-13`)

#### 4.4.1 `EN-LTR` × `Light` — Cross-Company Bulk Operation (`PARTIAL` Outcome + Retry Failed Subset)
```text
+--------------------------------------------------------------------------------------------------+
| Bulk Operation <bdi>0192e910-4b22...</bdi> · SOFT_CLOSE_PERIOD            [PARTIAL · 3/4 Done]   |
+--------------------------------------------------------------------------------------------------+
| Scope: FISCAL_PERIOD  |  Determinate Progress: [██████████████████░░░░░░] 3 Succeeded · 1 Failed |
| Started: 2026-11-01 16:20:04  |  Finished: 16:20:09  |  [*Retry 1 Failed Target (New Key)*]      |
+--------------------------------------------------------------------------------------------------+
| Filter: [All (4)] [*Failed Only (1)*] [Succeeded (3)]                                            |
| Target Period ID (bdi)       | Status      | Error Code & Safe Action                            |
|------------------------------|-------------|-----------------------------------------------------|
| 0192a100-0001... (Oct · Co A)| [FAILED]    | ACCOUNTING.SCOPE.TARGET_DENIED — Request period     |
|                              |             | permission on Company A or exclude from retry.      |
| 0192a100-0002... (Oct · Co B)| [COMPLETED] | Transitioned OPEN -> SOFT_CLOSED                    |
| 0192a100-0003... (Oct · Co C)| [COMPLETED] | Transitioned OPEN -> SOFT_CLOSED                    |
+--------------------------------------------------------------------------------------------------+
```

#### 4.4.2 `AR-RTL` × `Light` — Persistent Background Job Tray (`<AccountingJobTrayDrawer>`)
```text
+--------------------------------------------------------------------------------------------------+
| [X]                                                 مركز العمليات غير المتزامنة (3 مهام نشطة/حديثة)|
+--------------------------------------------------------------------------------------------------+
| 1. تصدير دفتر الأستاذ العام (POST /accounting/journal-lines/export)             [مكتمل COMPLETED]|
|    المعرّف: <bdi>0192e922...</bdi> · البصمة: <bdi>sha256:41c8...90a1</bdi> · صالح حتى 17:30       |
|    [تنزيل الملف الموقّع CSV]                                                                      |
+--------------------------------------------------------------------------------------------------+
| 2. فحص سلامة الدفاتر العشرة (GET /accounting/integrity-checks/latest)         [قيد التشغيل RUNNING]|
|    [░░░░░░░░░▓▓▓▓▓▓░░░░░░░░░] (مؤشر غير محدد النسبة · الزمن المنقضي: 00:18 · التحديث كل 3 ثوانٍ)  |
+--------------------------------------------------------------------------------------------------+
| 3. إهلاك الأصول لشهر أكتوبر (POST /accounting/depreciation-runs)                [في الصف QUEUED]  |
|    [إلغاء التشغيل قبل البدء (POST /:id/cancel)]                                                   |
+--------------------------------------------------------------------------------------------------+
```

#### 4.4.3 `EN-LTR` × `Dark` (`html.dark`) — Tier 2 Sync `207 Multi-Status` `<BulkResultPanel>`
```text
+--------------------------------------------------------------------------------------------------+
| DARK PANEL (--ink-900) · Bulk Account Update Result (HTTP 207 Multi-Status)                 [X]  |
+--------------------------------------------------------------------------------------------------+
| [▲ PARTIAL] 18 accounts updated · 2 accounts failed (kept selected in table for quick fix).      |
|                                                                                                  |
| Row # | Account (bdi) | Error Code                         | Cause & Action                      |
|-------|---------------|------------------------------------|-------------------------------------|
| 4     | 110101        | ACCOUNTING.ACCOUNT.SYSTEM_LOCKED   | System role account cannot change   |
|       |               |                                    | normal balance side. Deselect row.  |
| 11    | 210400        | ACCOUNTING.CONCURRENCY.ALREADY_... | Duplicate code in chart. Edit code. |
|                                                [Close]  [*Retry 2 Selected Rows (Fresh Key)*]    |
+--------------------------------------------------------------------------------------------------+
```

#### 4.4.4 `AR-RTL` × `Dark` (`html.dark`, `dir="rtl"`) — Expired Export Artifact State
```text
+--------------------------------------------------------------------------------------------------+
| بطاقة التصدير · وضع داكن (--ink-950 / --ink-900) · <bdi>0192e701-99c0...</bdi>  [منتهي الصلاحية] |
+--------------------------------------------------------------------------------------------------+
| [i] انتهت صلاحية رابط التنزيل المؤقت لهذا التصدير (2026-10-30). سجلات المحاسبة الأصلية محفوظة    |
|     بالكامل؛ أعد تشغيل التصدير بمفتاح عدم تكرار جديد (UUIDv7) لتوليد ملف محدّث.                   |
|                                                                        [*إعادة تشغيل التصدير*]    |
+--------------------------------------------------------------------------------------------------+
```

#### 4.4.5 Mobile `375px` Async Progress & Target Summary (`< 768px`)
```text
+-------------------------------------+
| < Bulk Soft-Close        [PARTIAL]  |
| [██████████████░░░░] 3 OK · 1 Fail  |
+-------------------------------------+
| ✗ Co A · Oct 2026                   |
|   ACCOUNTING.SCOPE.TARGET_DENIED    |
+-------------------------------------+
| ✓ Co B · Oct 2026 (SOFT_CLOSED)     |
| ✓ Co C · Oct 2026 (SOFT_CLOSED)     |
+-------------------------------------+
| [*Retry 1 Failed Target*]           |
+-------------------------------------+
```

---

## 5. Verbatim Endpoint Mapping, Bilingual Keys & Contract Gaps (`P03.T06.S5`)

### 5.1 Verbatim Endpoint & Idempotency Matrix (`02_Endpoint_Catalogue.md` Authority)

Every browser call prefixes `/api/tenant/accounting/v1` to the `Path` below. Every column is copied **verbatim** from `02_Endpoint_Catalogue.md` (zero composed permission or feature keys):

| Pattern | Method | Path | Permission | Feature key | Scope target | Idempotency | Concurrency | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `UX-06` | `GET` | `/accounting/journal-drafts` | `accounting.journal_draft.read` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | none | none | `200` |
| `UX-06` | `POST` | `/accounting/journal-drafts/search` | `accounting.journal_draft.read` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | none | none | `200` |
| `UX-06` | `POST` | `/accounting/journal-drafts/count` | `accounting.journal_draft.read` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | none | none | `200` |
| `UX-06` | `GET` | `/accounting/journal-drafts/:id` | `accounting.journal_draft.read` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | none | none | `200` + `ETag` |
| `UX-06` | `POST` | `/accounting/journal-drafts` | `accounting.journal_draft.create` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | `x-idempotency-key` | none | `201` + `Location` |
| `UX-06` | `PATCH` | `/accounting/journal-drafts/:id` | `accounting.journal_draft.update` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | `x-idempotency-key` | `If-Match` | `200` |
| `UX-06` | `DELETE` | `/accounting/journal-drafts/:id` | `accounting.journal_draft.delete` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | `x-idempotency-key` | `If-Match` | `204` |
| `UX-06` | `POST` | `/accounting/journal-drafts/:id/submit` | `accounting.journal_draft.submit` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | `x-idempotency-key` | `If-Match` | `200` |
| `UX-06`/`10` | `POST` | `/accounting/journal-drafts/:id/approve` | `accounting.approval.approve` | `accounting.close.approvals` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| `UX-06`/`10` | `POST` | `/accounting/journal-drafts/:id/reject` | `accounting.approval.reject` | `accounting.close.approvals` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| `UX-06` | `POST` | `/accounting/journal-drafts/:id/post` | `accounting.journal_draft.post` *(+ `accounting.journal_entry.override_fx` on FX override)* | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` + chain headers |
| `UX-06` | `POST` | `/accounting/journal-drafts/:id/cancel` | `accounting.journal_draft.cancel` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | `x-idempotency-key` | `If-Match` | `200` |
| `UX-06` | `POST` | `/accounting/journal-drafts/:id/reopen` | `accounting.journal_draft.update` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | `x-idempotency-key` | `If-Match` | `200` |
| `UX-06`/`13` | `POST` | `/accounting/journal-drafts/bulk-post` | `accounting.journal_draft.post` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `200` (all-or-nothing) |
| `UX-06` | `GET` | `/accounting/journal-entries/:id` | `accounting.journal_entry.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | none | none | `200` (no `ETag`) |
| `UX-06` | `GET` | `/accounting/journal-entries/:id/lines` | `accounting.journal_entry.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | none | none | `200` |
| `UX-06` | `GET` | `/accounting/journal-entries/:id/chain-proof` | `accounting.journal_entry.chain_proof` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |
| `UX-06` | `POST` | `/accounting/journal-entries/:id/reverse` | `accounting.journal_entry.reverse` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `200` + chain headers |
| `UX-06`/`13` | `POST` | `/accounting/journal-entries/export` | `accounting.journal_entry.export` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `202` + `Location` |
| `UX-06`/`10` | `POST` | `/accounting/ledger/redactions` | `accounting.ledger_redaction.request` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `202` + `Location` |
| `UX-06`/`10` | `POST` | `/accounting/ledger/redactions/:approvalRequestId/approve` | `accounting.ledger_redaction.approve` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| `UX-06` | `GET` | `/accounting/recurring-templates/:id` | `accounting.recurring_template.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` + `ETag` |
| `UX-06` | `POST` | `/accounting/recurring-templates` | `accounting.recurring_template.create` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `201` + `Location` |
| `UX-06` | `PATCH` | `/accounting/recurring-templates/:id` | `accounting.recurring_template.update` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| `UX-06` | `POST` | `/accounting/recurring-templates/:id/run-now` | `accounting.recurring_template.run` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` + chain headers |
| `UX-06` | `POST` | `/accounting/fx-rates/resolve` | `accounting.fx_rate.resolve` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | none | none | `200` |
| `UX-10` | `GET` | `/accounting/approval-requests` | `accounting.approval.read` | `accounting.close.approvals` | `COMPANY_OR_BRANCH` | none | none | `200` |
| `UX-10` | `POST` | `/accounting/approval-requests/search` | `accounting.approval.read` | `accounting.close.approvals` | `COMPANY_OR_BRANCH` | none | none | `200` |
| `UX-10` | `GET` | `/accounting/approval-requests/:id` | `accounting.approval.read` | `accounting.close.approvals` | `COMPANY_OR_BRANCH` | none | none | `200` + `ETag` |
| `UX-10` | `GET` | `/accounting/approval-requests/:id/actions` | `accounting.approval.read` | `accounting.close.approvals` | `COMPANY_OR_BRANCH` | none | none | `200` |
| `UX-10` | `POST` | `/accounting/approval-requests/:id/approve` | `accounting.approval.approve` | `accounting.close.approvals` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| `UX-10` | `POST` | `/accounting/approval-requests/:id/reject` | `accounting.approval.reject` | `accounting.close.approvals` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| `UX-10` | `POST` | `/accounting/approval-requests/:id/withdraw` | `accounting.approval.withdraw` | `accounting.close.approvals` | `COMPANY_OR_BRANCH` | `x-idempotency-key` | `If-Match` | `200` |
| `UX-10` | `GET` | `/accounting/approval-rules` | `accounting.approval.read` | `accounting.close.approvals` | `COMPANY` | none | none | `200` |
| `UX-10` | `GET` | `/accounting/approval-rules/:id` | `accounting.approval.read` | `accounting.close.approvals` | `COMPANY` | none | none | `200` + `ETag` |
| `UX-10` | `POST` | `/accounting/approval-rules` | `accounting.approval.manage_rules` | `accounting.close.approvals` | `COMPANY` | `x-idempotency-key` | none | `201` + `Location` |
| `UX-10` | `PATCH` | `/accounting/approval-rules/:id` | `accounting.approval.manage_rules` | `accounting.close.approvals` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| `UX-10` | `DELETE` | `/accounting/approval-rules/:id` | `accounting.approval.manage_rules` | `accounting.close.approvals` | `COMPANY` | `x-idempotency-key` | `If-Match` | `204` |
| `UX-10` | `POST` | `/accounting/approval-rules/:id/restore` | `accounting.approval.manage_rules` | `accounting.close.approvals` | `COMPANY` | `x-idempotency-key` | none | `200` |
| `UX-10` | `GET` | `/accounting/approval-rules/:id/steps` | `accounting.approval.read` | `accounting.close.approvals` | `COMPANY` | none | none | `200` |
| `UX-10` | `POST` | `/accounting/approval-rules/:id/steps` | `accounting.approval.manage_rules` | `accounting.close.approvals` | `COMPANY` | `x-idempotency-key` | `If-Match` | `201` |
| `UX-10` | `PATCH` | `/accounting/approval-rules/:id/steps/:stepNo` | `accounting.approval.manage_rules` | `accounting.close.approvals` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| `UX-10` | `DELETE` | `/accounting/approval-rules/:id/steps/:stepNo` | `accounting.approval.manage_rules` | `accounting.close.approvals` | `COMPANY` | `x-idempotency-key` | `If-Match` | `204` |
| `UX-14A` | `GET` | `/accounting/opening-balances` | `accounting.import.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |
| `UX-14A` | `GET` | `/accounting/opening-balances/:id` | `accounting.import.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` + `ETag` |
| `UX-14A` | `POST` | `/accounting/opening-balances` | `accounting.import.run` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key (7 d)` | none | `201` + `Location` |
| `UX-14A` | `POST` | `/accounting/opening-balances/:id/validate` | `accounting.import.run` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` + `Location` |
| `UX-14A` | `POST` | `/accounting/opening-balances/:id/post` | `accounting.journal_draft.post` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` + chain headers + `Location` |
| `UX-14A` | `POST` | `/accounting/opening-balances/:id/cancel` | `accounting.import.run` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` + `Location` |
| `UX-14B` | `GET` | `/accounting/imports` | `accounting.import.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |
| `UX-14B` | `GET` | `/accounting/imports/:id` | `accounting.import.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` + `ETag` |
| `UX-14B` | `GET` | `/accounting/imports/:id/errors` | `accounting.import.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |
| `UX-14B` | `GET` | `/accounting/imports/templates/:entity` | `accounting.import.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |
| `UX-14B` | `POST` | `/accounting/imports` | `accounting.import.create` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key (7 d)` | none | `201` + `Location` |
| `UX-14B` | `POST` | `/accounting/imports/:id/dry-run` | `accounting.import.create` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key (7 d)` | `If-Match` | `202` + `Location` |
| `UX-14B` | `POST` | `/accounting/imports/:id/commit` | `accounting.import.execute` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key (7 d)` | `If-Match` | `202` + `Location` |
| `UX-14B` | `POST` | `/accounting/imports/:id/cancel` | `accounting.import.create` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` |
| `UX-14B` | `GET` | `/accounting/migration-presets` | `accounting.import.read` | `accounting.ledger.core` | `TENANT` | none | none | `200` |
| `UX-14B` | `GET` | `/accounting/migration-presets/:id` | `accounting.import.read` | `accounting.ledger.core` | `TENANT` | none | none | `200` |
| `UX-14B` | `POST` | `/accounting/accounts/import` | `accounting.account.create` | `accounting.ledger.core` | `TENANT` | `x-idempotency-key (7 d)` | none | `202` + `Location` |
| `UX-14B` | `POST` | `/accounting/party-finance-profiles/import` | `accounting.party_finance_profile.create` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key (7 d)` | none | `202` + `Location` |
| `UX-14B` | `POST` | `/accounting/dimension-values/import` | `accounting.dimension.create` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key (7 d)` | none | `202` + `Location` |
| `UX-14B` | `POST` | `/accounting/fx-rates/import` | `accounting.fx_rate.import` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key (7 d)` | none | `202` + `Location` |
| `UX-14B` | `POST` | `/accounting/payment-terms/import` | `accounting.payment_terms.create` | `accounting.receivables.core` | `COMPANY` | `x-idempotency-key (7 d)` | none | `202` + `Location` |
| `UX-14B` | `POST` | `/accounting/party-bank-accounts/import` | `accounting.party_bank_account.update` | `accounting.payables.core` | `COMPANY` | `x-idempotency-key (7 d)` | none | `202` + `Location` |
| `UX-14B` | `POST` | `/accounting/bank-statements/import` | `accounting.bank_statement.import` | `accounting.treasury.bank_reconciliation` | `COMPANY` | `x-idempotency-key (7 d)` | none | `202` + `Location` |
| `UX-14B` | `POST` | `/accounting/assets/import` | `accounting.asset.create` | `accounting.assets.core` | `COMPANY` | `x-idempotency-key (7 d)` | none | `202` + `Location` |
| `UX-14B` | `GET` | `/accounting/payroll-imports` | `accounting.import.read` | `accounting.integration.payroll_import` | `COMPANY` | none | none | `200` |
| `UX-14B` | `GET` | `/accounting/payroll-imports/:id` | `accounting.import.read` | `accounting.integration.payroll_import` | `COMPANY` | none | none | `200` + `ETag` |
| `UX-14B` | `POST` | `/accounting/payroll-imports` | `accounting.import.run` | `accounting.integration.payroll_import` | `COMPANY` | `x-idempotency-key (7 d)` | none | `202` + `Location` |
| `UX-14B` | `POST` | `/accounting/payroll-imports/:id/post` | `accounting.journal_draft.post` | `accounting.integration.payroll_import` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` + chain headers |
| `UX-13` | `POST` | `/accounting/periods/bulk-state` | `accounting.period.change_state` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `200` (all-or-nothing) |
| `UX-13` | `GET` | `/accounting/bulk-operations` | `accounting.bulk_operation.read` | `accounting.ledger.core` | `TENANT` | none | none | `200` |
| `UX-13` | `GET` | `/accounting/bulk-operations/:id` | `accounting.bulk_operation.read` | `accounting.ledger.core` | `TENANT` | none | none | `200` |
| `UX-13` | `POST` | `/accounting/bulk-operations` | `accounting.bulk_operation.create` *(+ per-target / `accounting.bulk_operation.run` per §4.2)* | `accounting.ledger.core` | `TENANT` | `x-idempotency-key` | none | `202` + `Location` + `Retry-After` |
| `UX-13` | `POST` | `/accounting/exports/:code/run` | `accounting.export.run` | `accounting.reporting.snapshots` | `COMPANY` | `x-idempotency-key` | none | `202` + `Location` + `Retry-After` |
| `UX-13` | `GET` | `/accounting/exports/runs/:id` | `accounting.export.read` | `accounting.reporting.snapshots` | `COMPANY` | none | none | `200` |
| `UX-13` | `GET` | `/accounting/exports/runs/:id/download` | `accounting.export.download` | `accounting.reporting.snapshots` | `COMPANY` | none | none | `200` (`SignedDownloadDto`) |
| `UX-13` | `POST` | `/accounting/reports/:code/run` | `accounting.report.run` | `accounting.reporting.statements` | `COMPANY_OR_BRANCH` | none | none | `200` inline, or `202` + `Location` |
| `UX-13` | `GET` | `/accounting/reports/runs/:id` | `accounting.report.read` | `accounting.reporting.statements` | `COMPANY` | none | none | `200` |
| `UX-13` | `POST` | `/accounting/depreciation-runs` | `accounting.asset.run_depreciation` | `accounting.assets.core` | `COMPANY` | `x-idempotency-key` | none | `202` + `Location` + `Retry-After` |
| `UX-13` | `POST` | `/accounting/depreciation-runs/:id/cancel` | `accounting.asset.run_depreciation` | `accounting.assets.core` | `COMPANY` | `x-idempotency-key` | `If-Match` | `200` (`QUEUED` only) |
| `UX-13` | `POST` | `/accounting/deferral-runs` | `accounting.deferral.run` | `accounting.schedules.deferrals` | `COMPANY` | `x-idempotency-key` | none | `202` + `Location` |
| `UX-13` | `POST` | `/accounting/fx-revaluation-runs` | `accounting.journal_draft.post` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `202` + `Location` |
| `UX-13` | `POST` | `/accounting/inventory/valuation-runs` | `accounting.journal_draft.post` | `accounting.integration.trade_posting` | `COMPANY` | `x-idempotency-key` | none | `202` + `Location` |
| `UX-13` | `POST` | `/accounting/inventory/reconciliation-runs` | `accounting.report.run` | `accounting.integration.trade_posting` | `COMPANY` | `x-idempotency-key` | none | `202` + `Location` (or `200 { tradePosting: false }`) |
| `UX-13` | `POST` | `/accounting/reconciliations/authority/run` | `accounting.authority_document.reconcile` | `accounting.documents.einvoice_eg` | `COMPANY` | `x-idempotency-key` | none | `202` + `Location` |
| `UX-13` | `POST` | `/accounting/tax/rule-set-versions/:id/replay` | `accounting.tax_rule_set.test` | `accounting.tax.engine` | `TENANT` | `x-idempotency-key` | `If-Match` | `202` + `Location` + `Retry-After` |
| `UX-13` | `GET` | `/accounting/tax/rule-set-versions/:id/gate-results` | `accounting.tax_rule_set.read` | `accounting.tax.engine` | `TENANT` | none | none | `200` (`GateReportDto`) |
| `UX-13` | `POST` | `/accounting/integrity-checks/run` | `accounting.report.run` | `accounting.ledger.core` | `COMPANY` | `x-idempotency-key` | none | `202` + `Location` (`/accounting/integrity-checks/latest`) |
| `UX-13` | `GET` | `/accounting/integrity-checks/latest` | `accounting.report.read` | `accounting.ledger.core` | `COMPANY` | none | none | `200` |

*Note on Tier-2 Master Sync Bulk Routes (`200/207` with `x-idempotency-key`, `Concurrency: none`):* Every master `/bulk`, `/bulk-update`, `/bulk-delete`, and `/bulk-restore` route uses the exact permission, feature key, and scope target of its single-record verb in `02_Endpoint_Catalogue.md` (§3, §4, §7, §8, §9, §10 — noting specifically that `/recurring-templates/bulk-restore` uses `accounting.recurring_template.update`, `/bank-accounts/bulk-restore` uses `accounting.bank_account.update`, and `/party-bank-accounts/bulk-delete` & `/bulk-restore` use `accounting.party_bank_account.update`).

---

### 5.2 Bilingual Dictionary Keys (`t.accounting.workflow.*` — `en.ts` & `ar.ts`)

Zero language ternaries appear in JSX; components read strictly from `useI18n()`:

| Dictionary Key | English (`en.ts`) | Arabic (`ar.ts`) |
| --- | --- | --- |
| `journalEditor.balance.balanced` | `Balanced` | `متوازن` |
| `journalEditor.balance.outOfBalance` | `Out of balance by {amount}` | `غير متوازن بفارق {amount}` |
| `journalEditor.balance.saveForFx` | `Save required to recalculate functional balance` | `يلزم الحفظ لإعادة احتساب التوازن بعملة الدفاتر` |
| `journalEditor.actions.saveDraft` | `Save Draft` | `حفظ المسودة` |
| `journalEditor.actions.submitApproval` | `Submit for Approval` | `إرسال للاعتماد` |
| `journalEditor.actions.postEntry` | `Post Entry` | `ترحيل القيد` |
| `journalEditor.actions.reopenDraft` | `Reopen to Draft` | `إعادة فتح كمسودة` |
| `journalEditor.reverse.title` | `Reverse Posted Journal Entry` | `عكس قيد يومية مرحّل` |
| `journalEditor.reverse.methodSwap` | `Swap Sides: reverses Dr/Cr with positive amounts` | `عكس الجانبين: يبدّل المدين والدائن بمبالغ موجبة` |
| `journalEditor.reverse.methodStorno` | `Storno: keeps Dr/Cr sides with negative amounts` | `ستورنو: يبقي جانب المدين والدائن بمبالغ سالبة` |
| `journalEditor.enums.reversalReason.MANUAL` | `Manual Reversal` | `عكس يدوي` |
| `journalEditor.enums.reversalReason.ERROR_CORRECTION` | `Error Correction` | `تصحيح خطأ` |
| `journalEditor.enums.reversalReason.PERIOD_CORRECTION` | `Period Correction` | `تصحيح فترة محاسبية` |
| `approvals.makerCheckerBlocked` | `Segregation of duties: you authored or submitted this record, so another authorized approver must decide it.` | `فصل الصلاحيات: لقد قمت بإعداد هذا السجل أو إرساله، لذا يجب أن يبتّ فيه معتمِد آخر مخوّل.` |
| `approvals.payloadChangedBanner` | `The underlying record changed since you opened this request. Review the updated values and new hash before deciding.` | `تغيّرت بيانات السجل الأصلي منذ فتح الطلب. راجع القيم المحدّثة وبصمة الحمولة الجديدة قبل اتخاذ القرار.` |
| `approvals.actions.approve` | `Approve` | `اعتماد` |
| `approvals.actions.reject` | `Reject` | `رفض` |
| `approvals.actions.withdraw` | `Withdraw Request` | `سحب الطلب` |
| `imports.modeA.localParseButton` | `Load Local CSV / XLSX in Browser (No file uploaded)` | `قراءة ملف CSV / XLSX محلياً في المتصفح (دون رفع الملف)` |
| `imports.modeB.dryRunRequired` | `Clean dry run required before commit` | `يلزم اجتياز الفحص التجريبي بدون أخطاء قبل الاعتماد النهائي` |
| `imports.modeB.acknowledgeRows` | `I acknowledge committing {count} validated rows` | `أقرّ باعتماد وحفظ عدد {count} من الصفوف المفحوصة` |
| `imports.modeB.safeErrorsNote` | `Row values are omitted from this error report to protect confidential data.` | `لا تُعرض القيم النصية الخام للصفوف في هذا التقرير حفاظاً على سرية البيانات.` |
| `asyncJobs.trayTitle` | `Background Operations` | `العمليات غير المتزامنة` |
| `asyncJobs.retryFailedSubset` | `Retry Failed Targets ({count})` | `إعادة محاولة العناصر الفاشلة ({count})` |
| `asyncJobs.artifactExpired` | `Download link expired — re-run export to generate a fresh file.` | `انتهت صلاحية رابط التنزيل — أعد تشغيل التصدير لتوليد ملف جديد.` |

---

### 5.3 Consolidated Contract Gap List for `P03.T11` (`CG-WF-01` .. `CG-WF-08`)

Every gap below was verified directly against `02_Endpoint_Catalogue.md`, `02_DTOs.md`, `01_Enums.md`, and `01_ERD/*.md`. None is papered over in UI design; `P03.T11` resolves each item cleanly before implementation:

| Gap ID | Affected Pattern & Route(s) | Exact Discrepancy Verified in Backend LLD | Recommended `P03.T11` Contract Resolution |
| --- | --- | --- | --- |
| **`CG-WF-01`** | `UX-14` Mode B — `POST /accounting/imports`, `POST /accounting/{accounts,party-finance-profiles,dimension-values,payment-terms,party-bank-accounts,assets}/import`, `POST /accounting/fx-rates/import` | 1) `02_Endpoint_Catalogue.md` §11 line 1096 & §13 line 1169 declare `POST /accounting/imports` as `ACCOUNTING_IMPORT_MULTIPART` (`multipart file plus entity and optional preset`, `201 + Location`) followed by `POST /:id/dry-run` (`202`), whereas `02_DTOs.md` §12.2 `ImportDto` declares `fileRef: string // a storage key uploaded before the call` (with no pre-upload endpoint in the catalogue) and states that creating the job immediately runs its dry run.<br>2) Entity `/import` routes (`202 + Location`) have no multipart DTOs in `02_DTOs.md`, while `ImportFxRatesDto` (`02_DTOs.md` §4.7) is a JSON `rates: FxRateRowInput[]` (`<= 5,000`) body even though `POST /accounting/fx-rates/import` in the catalogue (`§3` line 222) returns `202 + Location` with `7 d` idempotency. | Unify `ImportDto` and entity `/import` contracts around `ACCOUNTING_IMPORT_MULTIPART` (`file` part + JSON/form fields `entity`, `preset?`, `columnMapOverride?`, `correctsJobId?`), clarify whether `POST /accounting/imports` queues dry-run automatically or stays `QUEUED` until `POST /:id/dry-run`, and confirm whether `POST /accounting/fx-rates/import` accepts both multipart CSV/XLSX and `ImportFxRatesDto` JSON or one canonical shape. |
| **`CG-WF-02`** | `UX-06` / `UX-13` Tier 1 — `POST /accounting/journal-drafts/bulk-post` | `02_Endpoint_Catalogue.md` §4 line 269 declares `POST /accounting/journal-drafts/bulk-post` (`200`, all-or-nothing, `Concurrency: none`), but `02_DTOs.md` §5.2 defines no `BulkPostJournalDraftsDto` (`BulkIdsDto` in §13.2 covers only `bulk-delete` / `bulk-restore` and carries neither per-draft `version` nor `expectedTotalDebit` / `expectedTotalCredit` guards). | Define `BulkPostJournalDraftsDto` (`items: { draftId: UUID; version: number; expectedTotalDebit: DecimalString; expectedTotalCredit: DecimalString }[]`, `1..100`) so bulk posting enforces the same `SCN-082` `STALE_VERSION` and `TOTALS_MISMATCH` safety as single-draft `PostJournalDraftDto`. |
| **`CG-WF-03`** | `UX-06` / `UX-10` — `POST /accounting/journal-drafts/:id/approve` & `POST /accounting/journal-drafts/:id/reject` | `02_Endpoint_Catalogue.md` §4 lines 264–265 expose draft-centric `/journal-drafts/:id/approve` and `/reject` (`If-Match` on draft `:id`), whereas `02_DTOs.md` §11.2 `ApproveRequestDto` / `RejectRequestDto` require `requestId: UUID` and `action: ApprovalActionKind` in the body and §5.2 declares no draft-specific wrapper DTO. | Either specify that `/journal-drafts/:id/approve` and `/reject` accept `ApproveRequestDto` / `RejectRequestDto` (with `If-Match` matching the draft's `ETag` or `approvalRequest` `ETag` explicitly stated) or add `ApproveJournalDraftDto` / `RejectJournalDraftDto` (`expectedPayloadHash`, `comment` / `reason`). |
| **`CG-WF-04`** | `UX-06` — `POST /accounting/journal-drafts/:id/cancel` | `02_Endpoint_Catalogue.md` §4 line 267 declares `POST /accounting/journal-drafts/:id/cancel` (`If-Match`, `x-idempotency-key`), but `02_DTOs.md` §5.2 defines no `CancelJournalDraftDto` (unlike `CancelOpeningBalanceBatchDto` or `ReopenJournalDraftDto`), leaving unspecified whether `reason` is required, optional, or forbidden (`forbidNonWhitelisted`). | Add `CancelJournalDraftDto` (`reason?: string` `10..500` chars or mandatory `reason` consistent with `acc_journal_drafts` audit log) in `02_DTOs.md` §5.2. |
| **`CG-WF-05`** | `UX-13` Tier 1 — `POST /accounting/periods/bulk-state` | `02_Endpoint_Catalogue.md` §3 line 136 declares `POST /accounting/periods/bulk-state` (`200`, all-or-nothing, `Concurrency: none`), while `02_DTOs.md` §4.3 defines only single-period `ChangePeriodStateDto` (`module`, `toState`, `reason?`). | Add `BulkChangePeriodStateDto` (`periodIds: UUID[]`, `module: PeriodModule`, `toState: PeriodState`, `reason?: string` mandatory `10..1,000` chars when `toState = 'OPEN'` from `'SOFT_CLOSED'`, plus optional per-period `versions`). |
| **`CG-WF-06`** | `UX-10` (`SCR-38` / `SCR-11`) — `GET /accounting/approval-requests` & `GET /accounting/approval-requests/:id` | `ApprovalRequestSummaryDto`, `ApprovalRequestDetailDto`, and `ApprovalActionDto` (`02_DTOs.md` §13.1) return only raw UUIDs (`submittedBy`, `makerUserIds`, `decidedBy`, `actorUserId`, `targetId`) with no human-readable `targetRef` (e.g. `JD-2026-00418`, `PR-2026-0012`, amount/currency summary) and no actor display-name projection. Under `patterns.md` Q14, the Inbox otherwise displays raw UUIDs unless hydrated. | Add read-only `targetLabel: string \| null` (document/draft/run code) and optional `amountSummary: { amount: DecimalString; currencyCode: string } \| null` to `ApprovalRequestSummaryDto`, and confirm Core user-directory batch lookup (`/api/tenant/core/v1/users/...`) for actor UUID hydration. |
| **`CG-WF-07`** | `UX-14` Mode A (`SCR-09`) — Opening-Balance Batch Incremental Edit | `02_Endpoint_Catalogue.md` §11 lines 1102–1107 expose `POST /accounting/opening-balances`, `GET /:id`, `POST /:id/validate`, `POST /:id/post`, and `POST /:id/cancel`, with **no** `PATCH /accounting/opening-balances/:id` (even though `09_Integration_and_Reliability_Tables.md` `trg_acc_opening_balance_batch_lines_batch_open` contemplates line edits on `DRAFT` / `VALIDATED` batches returning the batch to `DRAFT`). Currently, fixing a finding in Mode A requires `POST /:id/cancel` + re-POSTing `POST /accounting/opening-balances`. | Add `PATCH /accounting/opening-balances/:id` (`accounting.import.run`, `If-Match`, `x-idempotency-key (7 d)`) for `DRAFT` / `VALIDATED` batches (transitioning `VALIDATED -> DRAFT`), or explicitly confirm cancel-and-recreate as the intended Stage-1 contract. |
| **`CG-WF-08`** | `UX-10` — `ApprovalActionKind.COMMENT` & Approval Inbox Badge Count | 1) `01_Enums.md` (`ApprovalActionKind`) and `08_Close_and_Reporting_Tables.md` (`ck_acc_approval_actions_kind_mvp`) include `'COMMENT'`, but `02_Endpoint_Catalogue.md` §10 has no `POST /accounting/approval-requests/:id/comment` route or DTO.<br>2) Unlike `journal-drafts/count` and `fiscal-documents/count`, `approval-requests` has no `POST /accounting/approval-requests/count` route for navigation/home pending-approval badges. | Either add `POST /accounting/approval-requests/count` (`accounting.approval.read`) and `POST /accounting/approval-requests/:id/comment` (if standalone non-decision comments are desired in MVP), or confirm count comes from `meta.total` on `POST /accounting/approval-requests/search` (`limit: 1`) and comments live only on `ApproveRequestDto.comment` / `RejectRequestDto.reason`. |

## Contract reconciliation (P03.T11, 1 November 2026)

Reconciles the gaps of this spec against the Endpoint Catalogue and `02_DTOs.md` after `D-770`, `D-771` and `D-772`. The gap list above keeps the original findings; these rulings are final.

| Gap id | Ruling | Where |
| --- | --- | --- |
| `CG-WF-01` | closed by D-772 | One transport for files: multipart under `ACCOUNTING_IMPORT_MULTIPART` with a `file` part and a JSON `body` part (`ImportDto`, `ImportCollectionDto`); no `fileRef`; create queues the first dry run and `POST /accounting/imports/:id/dry-run` repeats it (edge `DRY_RUN_COMPLETED -> VALIDATING`); the fx-rates import is a file (`D-700`) |
| `CG-WF-02` | duplicate of CG-JRN-03 | Closed by D-771: `BulkPostJournalDraftsDto { items: PostJournalDraftDto[] }` (1..100); a per-item `version` is refused because `version` is a forbidden body field |
| `CG-WF-03` | duplicate of CG-JRN-03 | Closed by D-771: draft approve and reject reuse `ApproveRequestDto` and `RejectRequestDto`, `requestId` = the draft's `approval_request_id`, `If-Match` = the request's `version`; a reject reason on a draft is 10..500 |
| `CG-WF-04` | duplicate of CG-JRN-03 | Closed by D-771: `POST /accounting/journal-drafts/:id/cancel` takes an empty body with `If-Match`; no reason column is added |
| `CG-WF-05` | duplicate of CG-S2-07 (b) | Closed by D-771: `BulkChangePeriodStateDto { targets[{ periodId, module }], toState, reason? }` |
| `CG-WF-06` | already in the contract | `ApprovalRequestSummaryDto` carries `requestNo`, `documentType`, `targetType`, `targetId`, `amount`, `currencyCode`; deep-link by `targetType` and `targetId`; actor names come from Core users |
| `CG-WF-07` | already in the contract | No `PATCH /accounting/opening-balances/:id`; cancel and recreate is the stage-1 contract (`D-676`) |
| `CG-WF-08 (a)` | already in the contract | `GET /accounting/approval-requests?state=PENDING&limit=1` and read `meta.total` |
| `CG-WF-08 (b)` | dropped | No standalone comment route in the MVP; `COMMENT` rows render only if present |
