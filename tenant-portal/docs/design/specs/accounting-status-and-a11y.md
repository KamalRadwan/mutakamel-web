# Accounting Tokens, Status Mapping, Accessibility, and RTL Specification (`P03.T04`)

- **Tracker ID:** `P03.T04` (`S1`–`S5`)
- **Target Destination (after lead review):** `frontend/tenant-portal/docs/design/specs/accounting-status-and-a11y.md`
- **Status:** Specification
- **Governing Sources:**
  - `backend/docs/plans/accounting-app-plan-p03-ux-foundation.md` (`P03.T04`)
  - `frontend/tenant-portal/docs/design/specs/accounting-ia.md` (`P03.T01`)
  - `frontend/tenant-portal/docs/design/{README,tokens,accessibility,i18n,typography,anti-patterns,enforcement,primitives,patterns,motion,theming}.md`
  - `frontend/tenant-portal/src/app/globals.css`, `src/design-system/patterns/status-badge/{StatusBadge.tsx,tone-map.ts}`, `src/design-system/patterns/chart/chart-palette.ts`, `src/design-system/primitives/{IdentifierText.tsx,Money.tsx}`, `src/lib/format/{localized.ts,wire-label.ts}`
  - `backend/docs/LLD/accounting-app/04_Static_Data/{01_Enums,02_DTOs,04_Errors_and_Constants}.md`
  - `backend/docs/LLD/accounting-app/02_API_Contracts/01_Context_Headers_and_Responses.md`
  - `backend/docs/LLD/accounting-app/01_ERD/{02_Ledger_Tables,05_Subledger_and_Settlement_Tables}.md`
  - `backend/docs/LLD/accounting-app/12_Platform_Changes.md` (`§4.9` `D-079`, `§4.10.1`–`§4.10.2`)
- **UI/UX Intelligence Consultation (`ui-ux-pro-max`):**
  - Grounded in `ux-guidelines.csv` rules `color-contrast` (`>= 4.5:1` text, `>= 3:1` non-text), `color-not-only-indicator` (hue always paired with icon/sign/column/label), `focus-states` (`focus-visible` ring + `scroll-margin` against sticky chrome), `keyboard-navigation` (zero keyboard traps, logical `Tab` + cell navigation), `aria-labels` & `live-regions` (`polite` debounced running balance vs `assertive` blocked submit), `reduced-motion` (static `.dot-pending` at `0.45` opacity, `isAnimationActive={false}`), and `colors.csv` Financial/Enterprise Ledger guidance (high-trust cool slate/cobalt chrome, strict restraint of red/green to semantic outcomes rather than debit/credit sides).

---

## 1. S1 — Status, Severity, and Chart Role Mapping

### 1.1 Law 1 and the Role Token Architecture

Accounting inherits **Law 1** of the Tenant Portal design system (`docs/design/README.md` §1, `docs/design/tokens.md` §"The four roles"): **the portal ships four chromatic ramps plus `ink`, and a workflow stage is never a colour.**

| Design Role | Token Ramp (`globals.css`) | Semantic Tokens (`:root` / `.dark`) | `StatusRole` Key (`tone-map.ts`) | Meaning in Accounting | Mandatory Non-Colour Cue |
| --- | --- | --- | --- | --- | --- |
| **Positive** | `positive-50..950` | `--success`, `--success-subtle`, `--success-vivid` | `"positive"` | Posted, valid at authority, settled, balanced, matched, filed, reconciled, completed, active & healthy | Translated label + leading check/verified icon (`CheckCircle2`, `ShieldCheck`, `FileCheck2`) where iconified |
| **Caution** | `caution-50..950` | `--warning`, `--warning-subtle`, `--warning-vivid` | `"caution"` | Needs accountant attention: blocked, soft-closed, disputed, overdue, partially rejected, differences found, expiring, parked, stale | Translated label + leading warning/hold/clock-alert icon (`AlertTriangle`, `PauseCircle`, `ClockAlert`, `LockOpen`) |
| **Negative** | `negative-50..950` | `--destructive`, `--destructive-subtle`, `--destructive-vivid` | `"negative"` | Failed, rejected by authority or approver, invalid, bounced, dead-lettered, unbalanced, defaulted, integrity error, revoked | Translated label + leading error/octagon/slash icon (`XCircle`, `AlertOctagon`, `Ban`); terminal void/discarded states add `line-through` where row context benefits |
| **Neutral — Active ("In progress")** | `ink-25..1000` | `--muted`, `--muted-foreground`, `--border` + `.dot-pending` | `"pending"` | Work currently in flight with no outcome yet: `POSTING`, `SENDING`, `RUNNING`, `QUEUED`, `PENDING`, `PENDING_APPROVAL`, `AWAITING_AUTHORITY`, `UNDER_COLLECTION`, `VALIDATING`, `APPLYING`, `GENERATING`, `RETRYING` | Translated label + **pulsing `6px` dot** (`.dot-pending` `bg-ink-400`; static `opacity: 0.45` under `prefers-reduced-motion: reduce`) + `border-dashed` on pending queue rows |
| **Neutral — Static (Dormant / Structural / Closed)** | `ink-25..1000` | `--muted`, `--muted-foreground`, `--border` | `"neutral"` | Non-outcome static state: `DRAFT`, `FUTURE`, routine `CLOSED` / `PERMANENTLY_CLOSED`, `ARCHIVED`, `RETIRED`, `SKIPPED`, `NOT_APPLICABLE`, `NONE`, `SUPERSEDED`, routine operator `CANCELLED` / `VOID` | Translated label + static contextual icon (`FileEdit` for draft, `Calendar` for future, `Lock` for closed/hard-closed, `Archive` for retired/archived, `Ban` + `text-muted-foreground` for routine cancelled/void) — **never** a pulsing dot |
| **Brand *(Reserved — never a status)*** | `brand-50..950` | `--primary`, `--ring`, `--selected`, `--info-*` | *(forbidden in `StatusBadge`)* | Interactive primary CTA (at most one per screen in `PageActionBar`), links, active nav/filter selection, focus rings, and chart sequential ramps | **Never assigned to an enum status member.** Using `brand` for `"OPEN"` or `"SUBMITTED"` makes a status pill compete visually with buttons and links |

> **Why `"neutral"` (static `ink`) is distinguished from `"pending"` (`ink + motion`):** In CRM (`tone-map.ts`), every neutral lifecycle value (`OPEN`, `NEW`, `IN_PROGRESS`, `PROVISIONING`) is an active open pipeline item, so `StatusRole` needed only `"pending"`. Accounting has **permanent dormant and historical states** (`FiscalPeriodState.PERMANENTLY_CLOSED`, `JournalDraftStatus.DRAFT`, `AssetStatus.DISPOSED`, `RuleVersionStatus.RETIRED`, `FiscalDocumentStatus.SUPERSEDED`). Rendering a pulsing `.dot-pending` on a permanently closed fiscal period or a disposed asset falsely signals background execution. Extending `StatusRole` in `src/design-system/patterns/status-badge/tone-map.ts` to `"positive" | "negative" | "caution" | "pending" | "neutral"` keeps both variants on the neutral `ink` ramp (`Badge tone="neutral"`) while restricting `.dot-pending` strictly to `"pending"`.

### 1.2 `StatusBadge`, Dictionary Keys, and Non-Colour Cue Rules

1. **Canonical dictionary path (`t.status.<EnumName>.<MEMBER>`):**
   - Every Accounting enum member rendered on screen lives in `src/i18n/dictionaries/ar.ts` and `src/i18n/dictionaries/en.ts` under `status.<EnumName>.<MEMBER>`, where `<EnumName>` and `<MEMBER>` match `@mutakamel/accounting-app-common` (`04_Static_Data/01_Enums.md`) character-for-character.
   - `ar.ts` defines `export type Dictionary = typeof ar` and `en.ts` is typed as `const en: Dictionary`, making any missing Arabic or English enum label a **compile-time TypeScript error**.
   - **Adapter bridge in `StatusBadge.tsx`:** Existing CRM/Core callers store flat keys in `t.statusValues["<Kind>.<MEMBER>"]`. `StatusBadge` resolves Accounting's nested `t.status[kind]?.[value]` first, falls back to `t.statusValues[\`${kind}.${value}\`]` for legacy CRM/Core kinds, and routes any unseen runtime wire value through `wireLabel(..., value, t.common.unknownCode, \`status.${kind}\`)` + `<IdentifierText>` — **never** `label ?? value` (`docs/design/i18n.md` §"`labels[value] ?? value` is the bug, not the safety net").
2. **Non-colour redundancy (`ui-ux-pro-max`: `color-not-only-indicator`):**
   - A status dot or tinted border **never** appears without its translated text label in the same visual unit.
   - Inside `StatusBadge`, the non-colour cue is:
     - **Label wording** (always visible, never truncated below readability; `whitespace-nowrap`).
     - **Leading `12px` (`size-3`) Lucide icon** (`aria-hidden="true"`, `strokeWidth={2}`) or `.dot-pending` (`size-1.5`) as specified in §1.5. To keep dense 36px/40px ledger tables scannable, table cells render `[icon/dot + label]` inside `Badge`, never multiple competing icons per cell.
     - **Typographic treatment** on terminal non-error withdrawals (`CANCELLED`, `VOID`, `DISCARDED`, `SUPERSEDED`, `WITHDRAWN`): optional `line-through decoration-ink-400` on the document/draft identifier cell when displayed alongside active rows, while keeping text contrast `>= 4.5:1`.

### 1.3 Chart Palette Rules for Accounting (`docs/design/tokens.md` §Charts)

Accounting dashboards, aging summaries, cash-position views, and reconciliation widgets must obey `src/design-system/patterns/chart/chart-palette.ts` without exception:

| Chart Category | Accounting Examples | Allowed Palette & Order | Accessibility & Fallback Rules |
| --- | --- | --- | --- |
| **1. Status / Outcome Breakdown** | Open items by `OpenItemStatus`; Aged receivables/payables risk buckets (`Current`, `1–30d`, `31–60d`, `60d+ / Overdue`); Authority documents by `AuthorityDocumentStatus`; Close tasks by `CloseTaskStatus`; Bank lines by `BankStatementLineStatus` | `STATUS_FILL` (`var(--color-positive-600)`, `var(--color-caution-600)`, `var(--color-brand-600)`, `var(--color-negative-600)`), sorted strictly via `orderStatusRoles()` into `STATUS_DRAW_ORDER = ["positive", "caution", "brand", "negative"]`. | **`caution` and `negative` (~30° apart) must never touch edge-to-edge.** If a chart has only `{caution, negative}` slices (`hasAdjacentCautionNegative(roles) === true`), apply `stroke="var(--card)"` (`SEGMENT_SEPARATOR`, `strokeWidth={2}`) between segments. |
| **2. Qualitative / Ranking Breakdown** | Expenses by account group; Revenue by branch or cost-center dimension; Top customers/suppliers by open balance; Cash balances by bank account | Single-hue sequential `QUALITATIVE_RAMP` (`var(--color-brand-800)` darkest down to `var(--color-brand-200)` lightest) via `topNWithOther(data, t.common.other, 6)` — **maximum 6 categories + `"Other"` (7 slices total)**. | **Order and luminance carry meaning, not hue.** If an accounting breakdown requires inspecting `> 6` distinct accounts/parties without collapsing to `"Other"`, **render a `DataTable`, not a chart.** |
| **3. Multi-Hue Qualitative Tokens** | `--chart-qualitative-1..6` in `globals.css` | **Forbidden in Tenant Portal feature code.** | Retained in `globals.css` solely for Admin Portal CSS parity (`tokens.md` §Charts). Never reference in `/accounting/*`. |
| **4. Dual-Series Directional Comparison** | Cash inflow vs outflow; Budget vs actual (Wave 1) | Inflow / Actual within budget = `var(--color-positive-600)` solid bar; Outflow = `var(--color-ink-500)` neutral bar (outflow is normal business activity, **not** an error, so never vermilion `negative`!); Over-budget / deficit variance callout = `var(--color-negative-600)` with pattern/hatch or explicit `+/-` label. | Every chart sets `isAnimationActive={false}` when `prefers-reduced-motion: reduce` matches (and defaults to `false` on dense accounting workspaces), includes direct legend/axis labels (`>= 4.5:1` via `--chart-axis`), and pairs with a keyboard-accessible `WidgetDataTable` view. |

### 1.4 Derived Display States Where No Wire Status Enum Exists

Per the strict contract rule (**never invent an enum or member**), two core MVP ledger entities do **not** have a status enum in `04_Static_Data/01_Enums.md` because their persistence model is append-only / fact-driven. Screens must derive their badge from documented DTO fields using `t.accounting.derivedStatus.*` rather than inventing fake `JournalEntryStatus` or `SettlementStatus` enums:

| Entity & Screen | Why No Enum Exists in `01_Enums.md` | Factual Wire Condition (`01_ERD` & `04_Static_Data/02_DTOs.md`) | Role Token | Non-Colour Cue | Dictionary Key & Labels (`EN` / `AR`) |
| --- | --- | --- | --- | --- | --- |
| **Posted Journal Entry** (`acc_journal_entries`, `SCR-06`) | Every row in `acc_journal_entries` is already posted and immutable (`BaseLedgerEntity`; pre-post lifecycle lives on `acc_journal_drafts` via `JournalDraftStatus`). | Default row: `reversesEntryId === null` and no reversal entry points to `id` | `positive` | `CheckCircle2` + text | `t.accounting.derivedStatus.journalEntry.posted` — `Posted` / `مرحَّل` |
| **Posted Journal Entry — Reversed Target** (`SCR-06`) | Original entry remains immutable in the chain; reversal is recorded by a later entry referencing `reverses_entry_id`. | Referenced by a posted reversal entry (`reversedByEntryId !== null` in detail/list projection) | `neutral` | `RotateCcw` + text + link to reversing `entryNo` | `t.accounting.derivedStatus.journalEntry.reversed` — `Reversed` / `معكوس` |
| **Posted Journal Entry — Reversal Entry** (`SCR-06`) | Identified by `EntryKind` (`REVERSAL`, `CANCELLATION`, `ACCRUAL_REVERSAL`) and `reversesEntryId !== null`. | `reversesEntryId !== null` (paired with `EntryKind` & `ReversalReason` badges) | `neutral` | `CornerUpLeft` + text + link to original `entryNo` | `t.accounting.derivedStatus.journalEntry.reversal` — `Reversal entry` / `قيد عكسي` |
| **Posted Journal Entry — Redirected Period** (`SCR-06`) | When source date fell in a closed period and posted into the next open period (`02_Ledger_Tables.md` `original_period_id`). | `originalPeriodId !== null && originalPeriodId !== periodId` | `caution` | `CalendarClock` + secondary pill beside `Posted` | `t.accounting.derivedStatus.journalEntry.redirectedPeriod` — `Redirected from closed period` / `موجَّه من فترة مقفلة` |
| **Settlement** (`acc_settlements`, `SCR-23`) | `05_Subledger_and_Settlement_Tables.md` models settlements with timestamps and flags (`posted_at`, `reversed_at`, `is_provisional`, `confirmed_at`, `unallocated_amount`), not a status column. | `reversedAt !== null` | `neutral` | `RotateCcw` + `line-through` on `settlementNo` | `t.accounting.derivedStatus.settlement.reversed` — `Reversed` / `معكوس` |
| **Settlement — Provisional Instrument** (`SCR-23`) | Cheque / under-collection settlement before bank clearance (`D-083`). | `reversedAt === null && isProvisional === true && confirmedAt === null` | `pending` | `.dot-pending` + `Clock` | `t.accounting.derivedStatus.settlement.provisional` — `Provisional (awaiting clearance)` / `مؤقت (بانتظار التحصيل)` |
| **Settlement — Unapplied / Partially Applied** (`SCR-23`) | On-account receipt/payment carrying remaining `unallocatedAmount > "0"`. | `reversedAt === null && (!isProvisional \|\| confirmedAt !== null) && unallocatedAmount !== "0.00"` (exact decimal non-zero check) | `caution` | `CircleDashed` + text | `t.accounting.derivedStatus.settlement.unappliedBalance` — `Unapplied balance` / `رصيد غير موزَّع` |
| **Settlement — Posted & Fully Applied** (`SCR-23`) | Settled and allocated with zero residual. | `reversedAt === null && (!isProvisional \|\| confirmedAt !== null) && unallocatedAmount === "0"` (zero minor units) | `positive` | `CheckCircle2` + text | `t.accounting.derivedStatus.settlement.applied` — `Posted` / `مرحَّل وموزَّع` |
| **Close Instance — Hard-Closed Modifier** (`acc_close_instances`, `SCR-33`) | `CloseInstanceStatus` stops at `COMPLETED`; `hard_closed` (`boolean`) is a separate column on `acc_close_instances`. | `status === "COMPLETED" && hardClosed === true` | `neutral` | `ShieldAlert` / `Lock` pill beside `COMPLETED` | `t.accounting.derivedStatus.closeInstance.hardClosed` — `Hard-closed` / `إقفال نهائي غير قابل للفتح` |
| **Exception Board — Overdue SLA Modifier** (`acc_exception_board_items`, `SCR-19`) | Overdue is stored as `expired_at` (`timestamptz`), **never** as a member of `ExceptionBoardStatus` (`D-401`), preserving audit history after resolution. | `expiredAt !== null` (when `status !== "RESOLVED"` -> `negative`; when `status === "RESOLVED"` -> `neutral` historical tag) | `negative` *(open)* / `neutral` *(resolved)* | `AlarmClockOff` + text | `t.accounting.derivedStatus.exceptionBoard.overdue` — `Past deadline` / `متجاوز للمهلة` |

---

### 1.5 Exhaustive MVP Status, Outcome, Severity, and Exception Mapping (`04_Static_Data/01_Enums.md`)

Every enum name and member below is copied verbatim from `backend/docs/LLD/accounting-app/04_Static_Data/01_Enums.md`. Role values refer to the five `StatusRole` keys defined in §1.1 (`positive`, `caution`, `negative`, `pending` = `ink + motion`, `neutral` = static `ink`).

#### Group A — Fiscal Calendar, Fiscal Years, and Period Locks (`01_Enums.md` §2)

| Enum | Member (exact) | Role Token | Non-Colour Cue | Dictionary Key | English Label | Arabic Label |
| --- | --- | --- | --- | --- | --- | --- |
| `FiscalYearStatus` | `FUTURE` | `neutral` | `Calendar` + text | `t.status.FiscalYearStatus.FUTURE` | Future | سنة مستقبلية |
| `FiscalYearStatus` | `OPEN` | `positive` | `LockOpen` + text | `t.status.FiscalYearStatus.OPEN` | Open | مفتوحة |
| `FiscalYearStatus` | `CLOSING` | `pending` | `.dot-pending` + text | `t.status.FiscalYearStatus.CLOSING` | Closing | قيد الإقفال |
| `FiscalYearStatus` | `CLOSED` | `neutral` | `Lock` + text | `t.status.FiscalYearStatus.CLOSED` | Closed | مقفلة |
| `FiscalPeriodState` | `FUTURE` | `neutral` | `Calendar` + text | `t.status.FiscalPeriodState.FUTURE` | Future | مستقبلية |
| `FiscalPeriodState` | `OPEN` | `positive` | `LockOpen` + text | `t.status.FiscalPeriodState.OPEN` | Open | مفتوحة |
| `FiscalPeriodState` | `SOFT_CLOSED` | `caution` | `ShieldAlert` + text | `t.status.FiscalPeriodState.SOFT_CLOSED` | Soft-closed | إقفال جزئي (بصلاحية) |
| `FiscalPeriodState` | `CLOSED` | `neutral` | `Lock` + text | `t.status.FiscalPeriodState.CLOSED` | Closed | مقفلة |
| `FiscalPeriodState` | `PERMANENTLY_CLOSED` | `neutral` | `LockKeyhole` + double-border pill | `t.status.FiscalPeriodState.PERMANENTLY_CLOSED` | Permanently closed | مقفلة نهائياً |
| `PeriodKind` | `NORMAL` | `neutral` | Text tag | `t.status.PeriodKind.NORMAL` | Normal period | فترة عادية |
| `PeriodKind` | `OPENING` | `neutral` | `Play` + text tag | `t.status.PeriodKind.OPENING` | Opening period | فترة افتتاحية |
| `PeriodKind` | `ADJUSTMENT` | `caution` | `SlidersHorizontal` + text tag | `t.status.PeriodKind.ADJUSTMENT` | Adjustment period | فترة تسويات |
| `PeriodKind` | `CLOSING` | `neutral` | `Flag` + text tag | `t.status.PeriodKind.CLOSING` | Closing period | فترة إقفال |
| `AdvancePaymentScheme` | `NONE` | `neutral` | `MinusCircle` + text | `t.status.AdvancePaymentScheme.NONE` | Not enrolled | غير مسجَّل |
| `AdvancePaymentScheme` | `ENROLLED` | `positive` | `CheckCircle2` + text | `t.status.AdvancePaymentScheme.ENROLLED` | Enrolled (advance tax) | مسجَّل بنظام الدفعات المقدمة |

#### Group B — Journal Drafts, Entry Kinds, Reversals, Recurring, Intercompany, and Opening Balances (`01_Enums.md` §3, §5, §17)

| Enum | Member (exact) | Role Token | Non-Colour Cue | Dictionary Key | English Label | Arabic Label |
| --- | --- | --- | --- | --- | --- | --- |
| `JournalDraftStatus` | `DRAFT` | `neutral` | `FileEdit` + text | `t.status.JournalDraftStatus.DRAFT` | Draft | مسودة |
| `JournalDraftStatus` | `PENDING_APPROVAL` | `pending` | `.dot-pending` + `border-dashed` | `t.status.JournalDraftStatus.PENDING_APPROVAL` | Pending approval | بانتظار الاعتماد |
| `JournalDraftStatus` | `APPROVED` | `positive` | `Check` + text | `t.status.JournalDraftStatus.APPROVED` | Approved | معتمدة |
| `JournalDraftStatus` | `POSTING` | `pending` | `.dot-pending` + text | `t.status.JournalDraftStatus.POSTING` | Posting | جارٍ الترحيل |
| `JournalDraftStatus` | `POSTED` | `positive` | `CheckCircle2` + text | `t.status.JournalDraftStatus.POSTED` | Posted | مرحَّلة |
| `JournalDraftStatus` | `BLOCKED` | `caution` | `AlertTriangle` + text | `t.status.JournalDraftStatus.BLOCKED` | Blocked | معلَّقة لمانع |
| `JournalDraftStatus` | `REJECTED` | `negative` | `XCircle` + text | `t.status.JournalDraftStatus.REJECTED` | Rejected | مرفوضة |
| `JournalDraftStatus` | `CANCELLED` | `neutral` | `Ban` + `line-through` on draft no. | `t.status.JournalDraftStatus.CANCELLED` | Cancelled | ملغاة |
| `EntryKind` | `STANDARD` | `neutral` | Text tag | `t.status.EntryKind.STANDARD` | Standard | قيد يومية عادي |
| `EntryKind` | `OPENING` | `neutral` | Text tag | `t.status.EntryKind.OPENING` | Opening balance | قيد افتتاحي |
| `EntryKind` | `CLOSING` | `neutral` | Text tag | `t.status.EntryKind.CLOSING` | Year-end closing | قيد إقفال |
| `EntryKind` | `REVERSAL` | `neutral` | `RotateCcw` + text | `t.status.EntryKind.REVERSAL` | Reversal | قيد عكسي |
| `EntryKind` | `ADJUSTMENT` | `neutral` | `SlidersHorizontal` + text | `t.status.EntryKind.ADJUSTMENT` | Adjustment | قيد تسوية |
| `EntryKind` | `CANCELLATION` | `neutral` | `Ban` + text | `t.status.EntryKind.CANCELLATION` | Cancellation | قيد إلغاء |
| `EntryKind` | `ACCRUAL` | `neutral` | Text tag | `t.status.EntryKind.ACCRUAL` | Accrual | قيد استحقاق |
| `EntryKind` | `ACCRUAL_REVERSAL` | `neutral` | `RotateCcw` + text | `t.status.EntryKind.ACCRUAL_REVERSAL` | Accrual reversal | عكس استحقاق |
| `EntryKind` | `RECURRING` | `neutral` | `Repeat` + text | `t.status.EntryKind.RECURRING` | Recurring | قيد دوري |
| `EntryKind` | `REVALUATION` | `neutral` | `RefreshCw` + text | `t.status.EntryKind.REVALUATION` | FX revaluation | إعادة تقييم عملات |
| `EntryKind` | `DEPRECIATION` | `neutral` | Text tag | `t.status.EntryKind.DEPRECIATION` | Depreciation | قيد إهلاك |
| `EntryKind` | `DEFERRAL` | `neutral` | Text tag | `t.status.EntryKind.DEFERRAL` | Deferral recognition | قيد تأجيل/إطفاء |
| `EntryKind` | `SETTLEMENT` | `neutral` | Text tag | `t.status.EntryKind.SETTLEMENT` | Settlement | قيد سداد/تسوية |
| `EntryKind` | `SUMMARY` | `neutral` | Text tag | `t.status.EntryKind.SUMMARY` | Summary | قيد تجميعي |
| `EntryKind` | `PAYROLL_IMPORT` | `neutral` | Text tag | `t.status.EntryKind.PAYROLL_IMPORT` | Payroll import | استيراد رواتب |
| `EntryKind` | `ALLOCATION` | `neutral` | Text tag *(Wave 2)* | `t.status.EntryKind.ALLOCATION` | Cost allocation | توزيع تكاليف |
| `EntryKind` | `COMMITMENT` | `neutral` | Text tag *(Wave 2)* | `t.status.EntryKind.COMMITMENT` | Commitment | التزام مالي |
| `ReversalReason` | `MANUAL` | `neutral` | Text tag | `t.status.ReversalReason.MANUAL` | Manual reversal | عكس يدوي |
| `ReversalReason` | `ERROR_CORRECTION` | `caution` | `AlertTriangle` + text | `t.status.ReversalReason.ERROR_CORRECTION` | Error correction | تصحيح خطأ |
| `ReversalReason` | `AUTHORITY_CANCELLED` | `caution` | `FileX2` + text | `t.status.ReversalReason.AUTHORITY_CANCELLED` | Cancelled at tax authority | ملغى لدى مصلحة الضرائب |
| `ReversalReason` | `AUTHORITY_REJECTED` | `negative` | `XCircle` + text | `t.status.ReversalReason.AUTHORITY_REJECTED` | Rejected by tax authority | مرفوض من مصلحة الضرائب |
| `ReversalReason` | `ACCRUAL_AUTO` | `neutral` | `Repeat` + text | `t.status.ReversalReason.ACCRUAL_AUTO` | Automatic accrual reversal | عكس استحقاق تلقائي |
| `ReversalReason` | `DOCUMENT_CANCELLED` | `neutral` | `Ban` + text | `t.status.ReversalReason.DOCUMENT_CANCELLED` | Source document cancelled | إلغاء المستند الأصلي |
| `ReversalReason` | `PERIOD_CORRECTION` | `caution` | `CalendarClock` + text | `t.status.ReversalReason.PERIOD_CORRECTION` | Period correction | تصحيح فترة محاسبية |
| `ReversalMethod` | `SWAP_SIDES` | `neutral` | `ArrowLeftRight` + text | `t.status.ReversalMethod.SWAP_SIDES` | Opposite-side reversal | عكس بتبديل المدين والدائن |
| `ReversalMethod` | `STORNO` | `neutral` | `RotateCcw` + `[-]` cue | `t.status.ReversalMethod.STORNO` | Storno (negative same-side) | عكس ستورنو (سالب في نفس الجانب) |
| `RecurringTemplateStatus` | `ACTIVE` | `positive` | `PlayCircle` + text | `t.status.RecurringTemplateStatus.ACTIVE` | Active | نشط |
| `RecurringTemplateStatus` | `PAUSED` | `caution` | `PauseCircle` + text | `t.status.RecurringTemplateStatus.PAUSED` | Paused | متوقف مؤقتاً |
| `RecurringTemplateStatus` | `COMPLETED` | `neutral` | `CheckCircle2` + text | `t.status.RecurringTemplateStatus.COMPLETED` | Completed | مكتمل |
| `RecurringRunStatus` | `POSTED` | `positive` | `CheckCircle2` + text | `t.status.RecurringRunStatus.POSTED` | Posted | مرحَّل |
| `RecurringRunStatus` | `DRAFTED` | `neutral` | `FileEdit` + text | `t.status.RecurringRunStatus.DRAFTED` | Draft created | أُنشئت مسودة |
| `RecurringRunStatus` | `SKIPPED` | `neutral` | `SkipForward` + text | `t.status.RecurringRunStatus.SKIPPED` | Skipped | تم التخطي |
| `RecurringRunStatus` | `BLOCKED` | `caution` | `AlertTriangle` + text | `t.status.RecurringRunStatus.BLOCKED` | Blocked | معلَّق لمانع |
| `RecurringRunStatus` | `FAILED` | `negative` | `XCircle` + text | `t.status.RecurringRunStatus.FAILED` | Failed | فشل التنفيذ |
| `RecurringSkipReason` | `TEMPLATE_PAUSED` | `neutral` | Text tag | `t.status.RecurringSkipReason.TEMPLATE_PAUSED` | Template paused | القالب متوقف مؤقتاً |
| `RecurringSkipReason` | `OUT_OF_RANGE` | `neutral` | Text tag | `t.status.RecurringSkipReason.OUT_OF_RANGE` | Outside schedule dates | خارج نطاق التواريخ |
| `RecurringSkipReason` | `OCCURRENCE_CAP_REACHED` | `neutral` | Text tag | `t.status.RecurringSkipReason.OCCURRENCE_CAP_REACHED` | Maximum occurrences reached | اكتمل الحد الأقصى للتكرار |
| `RecurringSkipReason` | `ALREADY_RUN` | `neutral` | Text tag | `t.status.RecurringSkipReason.ALREADY_RUN` | Already executed for period | تم التنفيذ مسبقاً للفترة |
| `IntercoGroupStatus` | `OPEN` | `pending` | `.dot-pending` + text | `t.status.IntercoGroupStatus.OPEN` | Open | مفتوحة |
| `IntercoGroupStatus` | `BALANCED` | `positive` | `CheckCircle2` + text | `t.status.IntercoGroupStatus.BALANCED` | Balanced | متوازنة |
| `IntercoGroupStatus` | `UNBALANCED` | `negative` | `AlertOctagon` + text | `t.status.IntercoGroupStatus.UNBALANCED` | Unbalanced | غير متوازنة |
| `IntercoGroupStatus` | `CLOSED` | `neutral` | `Lock` + text | `t.status.IntercoGroupStatus.CLOSED` | Closed | مقفلة |
| `OpeningBalanceBatchStatus` | `DRAFT` | `neutral` | `FileEdit` + text | `t.status.OpeningBalanceBatchStatus.DRAFT` | Draft | مسودة |
| `OpeningBalanceBatchStatus` | `VALIDATED` | `caution` | `FileCheck` + text *(ready to post)* | `t.status.OpeningBalanceBatchStatus.VALIDATED` | Validated (unposted) | تم التحقق (بانتظار الترحيل) |
| `OpeningBalanceBatchStatus` | `POSTED` | `positive` | `CheckCircle2` + text | `t.status.OpeningBalanceBatchStatus.POSTED` | Posted | مرحَّلة |
| `OpeningBalanceBatchStatus` | `CANCELLED` | `neutral` | `Ban` + `line-through` | `t.status.OpeningBalanceBatchStatus.CANCELLED` | Cancelled | ملغاة |

#### Group C — Posting Exceptions (`01_Enums.md` §5)

| Enum | Member (exact) | Role Token | Non-Colour Cue | Dictionary Key | English Label | Arabic Label |
| --- | --- | --- | --- | --- | --- | --- |
| `PostingExceptionStatus` | `OPEN` | `caution` | `AlertTriangle` + text | `t.status.PostingExceptionStatus.OPEN` | Open | مفتوح |
| `PostingExceptionStatus` | `RETRYING` | `pending` | `.dot-pending` + text | `t.status.PostingExceptionStatus.RETRYING` | Retrying | جارٍ إعادة المحاولة |
| `PostingExceptionStatus` | `RESOLVED` | `positive` | `CheckCircle2` + text | `t.status.PostingExceptionStatus.RESOLVED` | Resolved | تم الحل |
| `PostingExceptionStatus` | `DISCARDED` | `neutral` | `Ban` + `line-through` | `t.status.PostingExceptionStatus.DISCARDED` | Discarded | مستبعد |
| `PostingExceptionKind` | `NO_ACCOUNT_RULE` | `caution` | `FileQuestion` + text | `t.status.PostingExceptionKind.NO_ACCOUNT_RULE` | Missing posting rule | قاعدة الترحيل مفقودة |
| `PostingExceptionKind` | `PERIOD_CLOSED` | `caution` | `Lock` + text | `t.status.PostingExceptionKind.PERIOD_CLOSED` | Period closed | الفترة المحاسبية مقفلة |
| `PostingExceptionKind` | `TAX_UNRESOLVED` | `caution` | `Percent` + text | `t.status.PostingExceptionKind.TAX_UNRESOLVED` | Tax unresolved | الضريبة غير محسومة |
| `PostingExceptionKind` | `AWAITING_AUTHORITY` | `pending` | `.dot-pending` + text | `t.status.PostingExceptionKind.AWAITING_AUTHORITY` | Awaiting tax authority | بانتظار مصلحة الضرائب |
| `PostingExceptionKind` | `FX_RATE_MISSING` | `caution` | `Coins` + text | `t.status.PostingExceptionKind.FX_RATE_MISSING` | Missing FX rate | سعر الصرف مفقود |
| `PostingExceptionKind` | `DIMENSION_REQUIRED` | `caution` | `Tags` + text | `t.status.PostingExceptionKind.DIMENSION_REQUIRED` | Required dimension missing | مركز التكلفة/البعد مطلوب |
| `PostingExceptionKind` | `CONTROL_ACCOUNT_MANUAL` | `negative` | `ShieldOff` + text | `t.status.PostingExceptionKind.CONTROL_ACCOUNT_MANUAL` | Manual line on control account | قيد يدوي على حساب رقابي |
| `PostingExceptionKind` | `VALIDATION_RULE` | `negative` | `XCircle` + text | `t.status.PostingExceptionKind.VALIDATION_RULE` | Validation rule blocked | مرفوض بقاعدة تحقق |
| `PostingExceptionKind` | `UNBALANCED` | `negative` | `Scale` + text | `t.status.PostingExceptionKind.UNBALANCED` | Unbalanced entry | القيد غير متوازن |
| `PostingExceptionKind` | `BACKDATED_CARRYING_CONFLICT` | `caution` | `History` + text | `t.status.PostingExceptionKind.BACKDATED_CARRYING_CONFLICT` | Backdated carrying-value conflict | تعارض قيمة دفترية لتاريخ سابق |
| `PostingExceptionKind` | `RECONCILED_RANGE_CONFLICT` | `caution` | `FileLock2` + text | `t.status.PostingExceptionKind.RECONCILED_RANGE_CONFLICT` | Reconciled bank range conflict | تعارض مع فترة بنكية مسوّاة |
| `PostingExceptionKind` | `LOAN_DEDUCTION_UNMATCHED` | `caution` | `Unlink` + text | `t.status.PostingExceptionKind.LOAN_DEDUCTION_UNMATCHED` | Unmatched loan deduction | استقطاع سلفة غير مطابق |
| `PostingExceptionResolution` | `RULE_ADDED` | `positive` | `Check` + text | `t.status.PostingExceptionResolution.RULE_ADDED` | Posting rule added | أُضيفت قاعدة الترحيل |
| `PostingExceptionResolution` | `PERIOD_REOPENED` | `positive` | `LockOpen` + text | `t.status.PostingExceptionResolution.PERIOD_REOPENED` | Period reopened | أُعيد فتح الفترة |
| `PostingExceptionResolution` | `RATE_ADDED` | `positive` | `Check` + text | `t.status.PostingExceptionResolution.RATE_ADDED` | FX rate added | أُضيف سعر الصرف |
| `PostingExceptionResolution` | `DIMENSION_ADDED` | `positive` | `Check` + text | `t.status.PostingExceptionResolution.DIMENSION_ADDED` | Dimension supplied | تم استكمال البعد المحاسبي |
| `PostingExceptionResolution` | `DOCUMENT_CORRECTED` | `positive` | `Check` + text | `t.status.PostingExceptionResolution.DOCUMENT_CORRECTED` | Source document corrected | تم تصحيح المستند الأصلي |
| `PostingExceptionResolution` | `AUTHORITY_SETTLED` | `positive` | `ShieldCheck` + text | `t.status.PostingExceptionResolution.AUTHORITY_SETTLED` | Authority status settled | حُسمت حالة مصلحة الضرائب |
| `PostingExceptionResolution` | `POSTED_IN_NEXT_PERIOD` | `caution` | `CalendarClock` + text | `t.status.PostingExceptionResolution.POSTED_IN_NEXT_PERIOD` | Redirected to next open period | رُحِّل في الفترة المفتوحة التالية |
| `PostingExceptionResolution` | `POSTED_ON_LATER_DATE` | `caution` | `CalendarClock` + text | `t.status.PostingExceptionResolution.POSTED_ON_LATER_DATE` | Posted on later date | رُحِّل بتاريخ لاحق |
| `PostingExceptionResolution` | `DISCARDED_BY_OPERATOR` | `neutral` | `Ban` + text | `t.status.PostingExceptionResolution.DISCARDED_BY_OPERATOR` | Discarded by operator | استُبعد بواسطة المحاسب |

#### Group D — Fiscal Documents, Authority E-Invoicing, Receipt Batches, and Authority Reconciliation (`01_Enums.md` §8, §10, §11, §14)

| Enum | Member (exact) | Role Token | Non-Colour Cue | Dictionary Key | English Label | Arabic Label |
| --- | --- | --- | --- | --- | --- | --- |
| `FiscalDocumentStatus` | `REGISTERED` | `pending` | `.dot-pending` + text | `t.status.FiscalDocumentStatus.REGISTERED` | Registered | مسجَّل |
| `FiscalDocumentStatus` | `TAX_RESOLVED` | `pending` | `.dot-pending` + text | `t.status.FiscalDocumentStatus.TAX_RESOLVED` | Tax resolved | تم احتساب الضريبة |
| `FiscalDocumentStatus` | `AWAITING_AUTHORITY` | `pending` | `.dot-pending` + `border-dashed` | `t.status.FiscalDocumentStatus.AWAITING_AUTHORITY` | Awaiting authority | بانتظار مصلحة الضرائب |
| `FiscalDocumentStatus` | `POSTED` | `positive` | `CheckCircle2` + text | `t.status.FiscalDocumentStatus.POSTED` | Posted | مرحَّل |
| `FiscalDocumentStatus` | `REVERSED` | `neutral` | `RotateCcw` + text | `t.status.FiscalDocumentStatus.REVERSED` | Reversed | معكوس |
| `FiscalDocumentStatus` | `REJECTED` | `negative` | `XCircle` + text | `t.status.FiscalDocumentStatus.REJECTED` | Rejected | مرفوض |
| `FiscalDocumentStatus` | `CANCELLED` | `neutral` | `Ban` + `line-through` | `t.status.FiscalDocumentStatus.CANCELLED` | Cancelled | ملغى |
| `FiscalDocumentStatus` | `SUPERSEDED` | `neutral` | `Replace` + `line-through` | `t.status.FiscalDocumentStatus.SUPERSEDED` | Superseded | مستبدل بمستند أحدث |
| `AuthorityDocumentStatus` | `PENDING` | `pending` | `.dot-pending` + text | `t.status.AuthorityDocumentStatus.PENDING` | Pending submission | قيد الإرسال |
| `AuthorityDocumentStatus` | `SUBMITTED` | `pending` | `.dot-pending` + text | `t.status.AuthorityDocumentStatus.SUBMITTED` | Submitted to authority | مُرسَل للمصلحة |
| `AuthorityDocumentStatus` | `VALID` | `positive` | `ShieldCheck` + text | `t.status.AuthorityDocumentStatus.VALID` | Valid | صحيح ومعتمد |
| `AuthorityDocumentStatus` | `INVALID` | `negative` | `XCircle` + text | `t.status.AuthorityDocumentStatus.INVALID` | Invalid | غير صحيح (مرفوض فنياً) |
| `AuthorityDocumentStatus` | `CANCEL_REQUESTED` | `caution` | `ClockAlert` + text | `t.status.AuthorityDocumentStatus.CANCEL_REQUESTED` | Cancellation requested | طُلب إلغاؤه |
| `AuthorityDocumentStatus` | `CANCELLED` | `neutral` | `Ban` + `line-through` | `t.status.AuthorityDocumentStatus.CANCELLED` | Cancelled at authority | ملغى لدى المصلحة |
| `AuthorityDocumentStatus` | `REJECT_REQUESTED` | `caution` | `ClockAlert` + text | `t.status.AuthorityDocumentStatus.REJECT_REQUESTED` | Buyer rejection requested | طُلب رفضه من المشتري |
| `AuthorityDocumentStatus` | `REJECTED` | `negative` | `XCircle` + text | `t.status.AuthorityDocumentStatus.REJECTED` | Rejected | مرفوض |
| `AuthorityDocumentStatus` | `SUPERSEDED` | `neutral` | `Replace` + text | `t.status.AuthorityDocumentStatus.SUPERSEDED` | Superseded | مستبدل |
| `AuthorityDocumentStatus` | `NOT_TRANSMITTED` | `neutral` | `CloudOff` + text | `t.status.AuthorityDocumentStatus.NOT_TRANSMITTED` | Not transmitted (local only) | غير خاضع للإرسال الإلكتروني |
| `AuthorityFreezeStatus` | `NONE` | `positive` | `CheckCircle2` + text | `t.status.AuthorityFreezeStatus.NONE` | Active (not frozen) | غير مجمَّد |
| `AuthorityFreezeStatus` | `FROZEN_TYPE` | `caution` | `Snowflake` + text | `t.status.AuthorityFreezeStatus.FROZEN_TYPE` | Document type frozen | مجمَّد لنوع المستند |
| `AuthorityFreezeStatus` | `FROZEN_SCOPE` | `negative` | `OctagonPause` + text | `t.status.AuthorityFreezeStatus.FROZEN_SCOPE` | Authority scope frozen | تجميد شامل لنطاق الربط |
| `ConnectionStatus` | `NOT_CONNECTED` | `neutral` | `Unplug` + text | `t.status.ConnectionStatus.NOT_CONNECTED` | Not connected | غير متصل |
| `ConnectionStatus` | `PREPROD_VERIFIED` | `caution` | `FlaskConical` + text | `t.status.ConnectionStatus.PREPROD_VERIFIED` | Pre-production verified | مفعَّل على البيئة التجريبية |
| `ConnectionStatus` | `PRODUCTION` | `positive` | `ShieldCheck` + text | `t.status.ConnectionStatus.PRODUCTION` | Production active | متصل بالبيئة الفعلية |
| `ConnectionEnvironment` | `PREPROD` | `caution` | `FlaskConical` + text | `t.status.ConnectionEnvironment.PREPROD` | Pre-production | البيئة التجريبية |
| `ConnectionEnvironment` | `PRODUCTION` | `positive` | `Globe` + text | `t.status.ConnectionEnvironment.PRODUCTION` | Production | البيئة الفعلية |
| `CertificateStatus` | `ACTIVE` | `positive` | `KeyRound` + text | `t.status.CertificateStatus.ACTIVE` | Active | شهادة نشطة |
| `CertificateStatus` | `EXPIRING` | `caution` | `ClockAlert` + text | `t.status.CertificateStatus.EXPIRING` | Expiring soon | قاربت على الانتهاء |
| `CertificateStatus` | `EXPIRED` | `negative` | `AlertOctagon` + text | `t.status.CertificateStatus.EXPIRED` | Expired | منتهية الصلاحية |
| `CertificateStatus` | `REVOKED` | `negative` | `ShieldOff` + text | `t.status.CertificateStatus.REVOKED` | Revoked | ملغاة أمنياً |
| `LateSubmissionStatus` | `REQUESTED` | `pending` | `.dot-pending` + text | `t.status.LateSubmissionStatus.REQUESTED` | Window requested | قيد طلب مهلة تأخير |
| `LateSubmissionStatus` | `APPROVED` | `positive` | `CheckCircle2` + text | `t.status.LateSubmissionStatus.APPROVED` | Window approved | تمت الموافقة على المهلة |
| `LateSubmissionStatus` | `EXPIRED` | `negative` | `AlarmClockOff` + text | `t.status.LateSubmissionStatus.EXPIRED` | Window expired | انتهت المهلة |
| `LateSubmissionStatus` | `CLOSED` | `neutral` | `Lock` + text | `t.status.LateSubmissionStatus.CLOSED` | Closed | مغلق |
| `ReceiptBatchStatus` | `QUEUED` | `pending` | `.dot-pending` + text | `t.status.ReceiptBatchStatus.QUEUED` | Queued | في قائمة الانتظار |
| `ReceiptBatchStatus` | `SENDING` | `pending` | `.dot-pending` + text | `t.status.ReceiptBatchStatus.SENDING` | Sending | جارٍ الإرسال |
| `ReceiptBatchStatus` | `ACCEPTED` | `positive` | `CheckCircle2` + text | `t.status.ReceiptBatchStatus.ACCEPTED` | Accepted | مقبولة بالكامل |
| `ReceiptBatchStatus` | `PARTIALLY_REJECTED` | `caution` | `AlertTriangle` + text | `t.status.ReceiptBatchStatus.PARTIALLY_REJECTED` | Partially rejected | مرفوضة جزئياً |
| `ReceiptBatchStatus` | `REJECTED` | `negative` | `XCircle` + text | `t.status.ReceiptBatchStatus.REJECTED` | Rejected | مرفوضة |
| `ReceiptBatchStatus` | `LATE` | `caution` | `ClockAlert` + text | `t.status.ReceiptBatchStatus.LATE` | Submitted late | مُرسَلة بعد المهلة |
| `ReceiptBatchItemStatus` | `QUEUED` | `pending` | `.dot-pending` + text | `t.status.ReceiptBatchItemStatus.QUEUED` | Queued | بالانتظار |
| `ReceiptBatchItemStatus` | `ACCEPTED` | `positive` | `CheckCircle2` + text | `t.status.ReceiptBatchItemStatus.ACCEPTED` | Accepted | مقبول |
| `ReceiptBatchItemStatus` | `REJECTED` | `negative` | `XCircle` + text | `t.status.ReceiptBatchItemStatus.REJECTED` | Rejected | مرفوض |
| `ReceiptOutcome` | `TAXED` | `positive` | `Check` + text | `t.status.ReceiptOutcome.TAXED` | Tax computed | تم احتساب الضريبة |
| `ReceiptOutcome` | `NO_TAX` | `neutral` | `Minus` + text | `t.status.ReceiptOutcome.NO_TAX` | Non-taxable | غير خاضع للضريبة |
| `ReceiptOutcome` | `ERROR` | `negative` | `XCircle` + text | `t.status.ReceiptOutcome.ERROR` | Tax error | خطأ في الاحتساب |
| `ComputationSite` | `SERVER` | `neutral` | `Server` + text | `t.status.ComputationSite.SERVER` | Server | احتساب الخادم |
| `ComputationSite` | `POS_OFFLINE` | `caution` | `WifiOff` + text | `t.status.ComputationSite.POS_OFFLINE` | POS offline | احتساب نقطة بيع دون اتصال |
| `WithheldReceiptCause` | `RECEIPT_NO_TAKEN` | `negative` | `AlertOctagon` + text | `t.status.WithheldReceiptCause.RECEIPT_NO_TAKEN` | Receipt number conflict | رقم الإيصال مستخدم مسبقاً |
| `WithheldReceiptCause` | `CURRENCY_NOT_SHIFT` | `caution` | `Coins` + text | `t.status.WithheldReceiptCause.CURRENCY_NOT_SHIFT` | Currency differs from shift | عملة الإيصال تخالف الوردية |
| `WithheldReceiptCause` | `CORRECTION_TOTAL_DIFFERS` | `caution` | `Scale` + text | `t.status.WithheldReceiptCause.CORRECTION_TOTAL_DIFFERS` | Correction total mismatch | إجمالي التصحيح لا يطابق الأصل |
| `WithheldReceiptCause` | `NEGATIVE_AMOUNT` | `negative` | `AlertOctagon` + text | `t.status.WithheldReceiptCause.NEGATIVE_AMOUNT` | Invalid negative amount | مبلغ سالب غير مسموح |
| `WithheldReceiptCause` | `CORRECTION_TARGET_UNKNOWN` | `caution` | `FileQuestion` + text | `t.status.WithheldReceiptCause.CORRECTION_TARGET_UNKNOWN` | Unknown original receipt | الإيصال الأصلي غير معروف |
| `WithheldReceiptCause` | `CORRECTION_TARGET_SETTLED` | `caution` | `Lock` + text | `t.status.WithheldReceiptCause.CORRECTION_TARGET_SETTLED` | Original receipt already settled | الإيصال الأصلي مسوّى مسبقاً |
| `WithheldReceiptCause` | `LOST_CASH_UNPLACED` | `caution` | `AlertTriangle` + text | `t.status.WithheldReceiptCause.LOST_CASH_UNPLACED` | Unplaced cash from lost receipt | نقدية إيصال مفقود غير موجَّهة |
| `WithheldReceiptCause` | `OPERATOR_RELEASE` | `positive` | `Check` + text | `t.status.WithheldReceiptCause.OPERATOR_RELEASE` | Released by operator | تم الإفراج بواسطة المشغِّل |
| `WithheldReceiptCause` | `CORRECTION_TARGET_UNDECIDED` | `caution` | `HelpCircle` + text | `t.status.WithheldReceiptCause.CORRECTION_TARGET_UNDECIDED` | Original receipt undecided | الإيصال الأصلي قيد البت |
| `WithheldReceiptCause` | `FIELDS_UNREADABLE` | `negative` | `FileWarning` + text | `t.status.WithheldReceiptCause.FIELDS_UNREADABLE` | Unreadable receipt fields | بيانات الإيصال غير مقروءة |
| `WithheldReceiptCause` | `DECLARED_LOST` | `negative` | `FileX2` + text | `t.status.WithheldReceiptCause.DECLARED_LOST` | Declared lost | معلَن عن فقده |
| `PosShiftSummaryStatus` | `RECEIVED` | `pending` | `.dot-pending` + text | `t.status.PosShiftSummaryStatus.RECEIVED` | Received | مستلم |
| `PosShiftSummaryStatus` | `POSTED` | `positive` | `CheckCircle2` + text | `t.status.PosShiftSummaryStatus.POSTED` | Posted | مرحَّل |
| `PosShiftSummaryStatus` | `BLOCKED` | `caution` | `AlertTriangle` + text | `t.status.PosShiftSummaryStatus.BLOCKED` | Blocked | معلَّق لمانع |
| `NotificationStatus` | `RECEIVED` | `pending` | `.dot-pending` + text | `t.status.NotificationStatus.RECEIVED` | Received | مستلم |
| `NotificationStatus` | `PARKED` | `caution` | `PauseCircle` + text | `t.status.NotificationStatus.PARKED` | Parked | معلَّق للمراجعة |
| `NotificationStatus` | `PROCESSED` | `positive` | `CheckCircle2` + text | `t.status.NotificationStatus.PROCESSED` | Processed | تمت المعالجة |
| `AttemptOutcome` | `ACCEPTED` | `positive` | `CheckCircle2` + text | `t.status.AttemptOutcome.ACCEPTED` | Accepted | مقبول |
| `AttemptOutcome` | `REJECTED` | `negative` | `XCircle` + text | `t.status.AttemptOutcome.REJECTED` | Rejected | مرفوض |
| `AttemptOutcome` | `DUPLICATE` | `caution` | `Copy` + text | `t.status.AttemptOutcome.DUPLICATE` | Duplicate submission | مكرر لدى المصلحة |
| `AttemptOutcome` | `TIMEOUT` | `caution` | `ClockAlert` + text | `t.status.AttemptOutcome.TIMEOUT` | Timed out | انتهت مهلة الاتصال |
| `AttemptOutcome` | `TRANSPORT_ERROR` | `negative` | `WifiOff` + text | `t.status.AttemptOutcome.TRANSPORT_ERROR` | Transport error | خطأ اتصال بالشبكة |
| `AttemptOutcome` | `RESOLVED_BY_QUERY` | `positive` | `SearchCheck` + text | `t.status.AttemptOutcome.RESOLVED_BY_QUERY` | Confirmed by status query | تم التأكيد بالاستعلام |
| `ItemCodeRequestStatus` | `DRAFT` | `neutral` | `FileEdit` + text | `t.status.ItemCodeRequestStatus.DRAFT` | Draft | مسودة |
| `ItemCodeRequestStatus` | `REQUESTED` | `pending` | `.dot-pending` + text | `t.status.ItemCodeRequestStatus.REQUESTED` | Submitted to authority | مرفوع للمصلحة |
| `ItemCodeRequestStatus` | `APPROVED` | `positive` | `Check` + text | `t.status.ItemCodeRequestStatus.APPROVED` | Approved | معتمد |
| `ItemCodeRequestStatus` | `REJECTED` | `negative` | `XCircle` + text | `t.status.ItemCodeRequestStatus.REJECTED` | Rejected | مرفوض |
| `ItemCodeRequestStatus` | `SYNCED` | `positive` | `CheckCircle2` + text | `t.status.ItemCodeRequestStatus.SYNCED` | Synced to catalog | متزامن مع الأصناف |
| `ItemCodeRequestStatus` | `CANCELLED` | `neutral` | `Ban` + `line-through` | `t.status.ItemCodeRequestStatus.CANCELLED` | Cancelled | ملغى |
| `ReconciliationRunStatus` | `DRAFT` | `neutral` | `FileEdit` + text | `t.status.ReconciliationRunStatus.DRAFT` | Draft | مسودة |
| `ReconciliationRunStatus` | `RUNNING` | `pending` | `.dot-pending` + text | `t.status.ReconciliationRunStatus.RUNNING` | Running | قيد التشغيل |
| `ReconciliationRunStatus` | `COMPLETED` | `positive` | `CheckCircle2` + text | `t.status.ReconciliationRunStatus.COMPLETED` | Completed | مكتمل |
| `ReconciliationRunStatus` | `FAILED` | `negative` | `XCircle` + text | `t.status.ReconciliationRunStatus.FAILED` | Failed | فشل التشغيل |
| `ReconciliationDifferenceKind` | `MISSING_LOCALLY` | `negative` | `FileQuestion` + text | `t.status.ReconciliationDifferenceKind.MISSING_LOCALLY` | Missing in Mutakamel | غير موجود بالدفاتر المحلية |
| `ReconciliationDifferenceKind` | `MISSING_AT_AUTHORITY` | `caution` | `CloudOff` + text | `t.status.ReconciliationDifferenceKind.MISSING_AT_AUTHORITY` | Missing at tax authority | غير موجود لدى مصلحة الضرائب |
| `ReconciliationDifferenceKind` | `AMOUNT_MISMATCH` | `negative` | `Scale` + text | `t.status.ReconciliationDifferenceKind.AMOUNT_MISMATCH` | Amount mismatch | اختلاف في المبلغ |
| `ReconciliationDifferenceKind` | `STATUS_MISMATCH` | `caution` | `AlertTriangle` + text | `t.status.ReconciliationDifferenceKind.STATUS_MISMATCH` | Status mismatch | اختلاف في الحالة |
| `ReconciliationDifferenceStatus` | `OPEN` | `caution` | `AlertTriangle` + text | `t.status.ReconciliationDifferenceStatus.OPEN` | Open | مفتوح |
| `ReconciliationDifferenceStatus` | `EXPLAINED` | `neutral` | `MessageSquareText` + text | `t.status.ReconciliationDifferenceStatus.EXPLAINED` | Explained | مفسَّر بمذكرة |
| `ReconciliationDifferenceStatus` | `RESOLVED` | `positive` | `CheckCircle2` + text | `t.status.ReconciliationDifferenceStatus.RESOLVED` | Resolved | تم الحل |
| `ReconciliationDifferenceStatus` | `IGNORED` | `neutral` | `EyeOff` + text | `t.status.ReconciliationDifferenceStatus.IGNORED` | Ignored | متجاهَل |
| `SelfInvoiceStatus` | `POSTED` | `positive` | `Check` + text | `t.status.SelfInvoiceStatus.POSTED` | Posted | مرحَّلة |
| `SelfInvoiceStatus` | `SETTLED` | `positive` | `CheckCircle2` + text | `t.status.SelfInvoiceStatus.SETTLED` | Settled | مسدَّدة |
| `SelfInvoiceStatus` | `CANCELLED` | `neutral` | `Ban` + `line-through` | `t.status.SelfInvoiceStatus.CANCELLED` | Cancelled | ملغاة |

#### Group E — Tax Engine, Tax Returns, Certificates, Refunds, and Tax Recovery (`01_Enums.md` §3, §7, §8, §9)

| Enum | Member (exact) | Role Token | Non-Colour Cue | Dictionary Key | English Label | Arabic Label |
| --- | --- | --- | --- | --- | --- | --- |
| `TaxReturnPeriodStatus` | `OPEN` | `pending` | `.dot-pending` + text | `t.status.TaxReturnPeriodStatus.OPEN` | Open | مفتوحة للإعداد |
| `TaxReturnPeriodStatus` | `FILED` | `positive` | `FileCheck2` + text | `t.status.TaxReturnPeriodStatus.FILED` | Filed | تم تقديم الإقرار |
| `TaxReturnPeriodStatus` | `AMENDED` | `caution` | `FilePenLine` + text | `t.status.TaxReturnPeriodStatus.AMENDED` | Amended | إقرار معدَّل |
| `RegistrationStatus` | `REGISTERED` | `positive` | `ShieldCheck` + text | `t.status.RegistrationStatus.REGISTERED` | Tax registered | مسجَّل ضريبياً |
| `RegistrationStatus` | `NOT_REGISTERED` | `neutral` | `MinusCircle` + text | `t.status.RegistrationStatus.NOT_REGISTERED` | Not registered | غير مسجَّل ضريبياً |
| `CardStatus` | `PERMANENT` | `positive` | `BadgeCheck` + text | `t.status.CardStatus.PERMANENT` | Permanent tax card | بطاقة ضريبية دائمة |
| `CardStatus` | `TEMPORARY` | `caution` | `Clock` + text | `t.status.CardStatus.TEMPORARY` | Temporary tax card | بطاقة ضريبية مؤقتة |
| `TaxDeductibility` | `YES` | `positive` | `Check` + text | `t.status.TaxDeductibility.YES` | Deductible | قابل للخصم الضريبي |
| `TaxDeductibility` | `NO` | `neutral` | `Ban` + text | `t.status.TaxDeductibility.NO` | Non-deductible | غير قابل للخصم |
| `TaxDeductibility` | `LIMITED` | `caution` | `Percent` + text | `t.status.TaxDeductibility.LIMITED` | Partially deductible | قابل للخصم جزئياً |
| `WithholdingCertificateDirection` | `ISSUED` | `neutral` | `ArrowUpRight` (`mirrorInRtl`) + text | `t.status.WithholdingCertificateDirection.ISSUED` | Issued to supplier | صادر للمورِّد |
| `WithholdingCertificateDirection` | `RECEIVED` | `neutral` | `ArrowDownLeft` (`mirrorInRtl`) + text | `t.status.WithholdingCertificateDirection.RECEIVED` | Received from customer | وارد من العميل |
| `WithholdingCertificateStatus` | `DRAFT` | `neutral` | `FileEdit` + text | `t.status.WithholdingCertificateStatus.DRAFT` | Draft | مسودة |
| `WithholdingCertificateStatus` | `ISSUED` | `positive` | `FileCheck` + text | `t.status.WithholdingCertificateStatus.ISSUED` | Issued | صادر |
| `WithholdingCertificateStatus` | `REMITTED` | `positive` | `CheckCircle2` + text | `t.status.WithholdingCertificateStatus.REMITTED` | Remitted to authority | مورَّد للمصلحة |
| `WithholdingCertificateStatus` | `CANCELLED` | `neutral` | `Ban` + `line-through` | `t.status.WithholdingCertificateStatus.CANCELLED` | Cancelled | ملغى |
| `RefundClaimStatus` | `DRAFT` | `neutral` | `FileEdit` + text | `t.status.RefundClaimStatus.DRAFT` | Draft | مسودة |
| `RefundClaimStatus` | `FILED` | `pending` | `.dot-pending` + text | `t.status.RefundClaimStatus.FILED` | Filed with authority | مقدَّم للمصلحة |
| `RefundClaimStatus` | `APPROVED` | `positive` | `Check` + text | `t.status.RefundClaimStatus.APPROVED` | Approved | معتمد للاسترداد |
| `RefundClaimStatus` | `PAID` | `positive` | `CheckCircle2` + text | `t.status.RefundClaimStatus.PAID` | Refund paid | تم صرف الاسترداد |
| `RefundClaimStatus` | `REJECTED` | `negative` | `XCircle` + text | `t.status.RefundClaimStatus.REJECTED` | Rejected | مرفوض |
| `RefundClaimStatus` | `WITHDRAWN` | `neutral` | `Undo2` + `line-through` | `t.status.RefundClaimStatus.WITHDRAWN` | Withdrawn | مسحوب |
| `VatRefundWithdrawalStatus` | `PENDING` | `pending` | `.dot-pending` + text | `t.status.VatRefundWithdrawalStatus.PENDING` | Withdrawal pending | طلب السحب قيد المراجعة |
| `VatRefundWithdrawalStatus` | `CONFIRMED` | `positive` | `CheckCircle2` + text | `t.status.VatRefundWithdrawalStatus.CONFIRMED` | Withdrawal confirmed | تم تأكيد السحب |
| `VatRefundWithdrawalStatus` | `REJECTED` | `negative` | `XCircle` + text | `t.status.VatRefundWithdrawalStatus.REJECTED` | Withdrawal rejected | رُفض طلب السحب |
| `TaxIdValidationResult` | `VALID` | `positive` | `ShieldCheck` + text | `t.status.TaxIdValidationResult.VALID` | Valid tax ID | رقم ضريبي صحيح |
| `TaxIdValidationResult` | `INVALID` | `negative` | `XCircle` + text | `t.status.TaxIdValidationResult.INVALID` | Invalid tax ID | رقم ضريبي غير صحيح |
| `TaxIdValidationResult` | `NOT_FOUND` | `negative` | `SearchX` + text | `t.status.TaxIdValidationResult.NOT_FOUND` | Not found at authority | غير مسجَّل لدى المصلحة |
| `TaxIdValidationResult` | `ERROR` | `caution` | `AlertTriangle` + text | `t.status.TaxIdValidationResult.ERROR` | Lookup error | تعذَّر التحقق مؤقتاً |
| `TaxIdValidationResult` | `NOT_VERIFIABLE` | `neutral` | `HelpCircle` + text | `t.status.TaxIdValidationResult.NOT_VERIFIABLE` | Offline / not verifiable | تحقق شكلي فقط (دون اتصال رسمي) |
| `RuleVersionStatus` | `DRAFT` | `neutral` | `FileEdit` + text | `t.status.RuleVersionStatus.DRAFT` | Draft | مسودة |
| `RuleVersionStatus` | `TESTED` | `caution` | `FlaskConical` + text | `t.status.RuleVersionStatus.TESTED` | Tested | تم اختباره |
| `RuleVersionStatus` | `APPROVED` | `positive` | `Check` + text | `t.status.RuleVersionStatus.APPROVED` | Approved | معتمد للنشر |
| `RuleVersionStatus` | `PUBLISHED` | `positive` | `CheckCircle2` + text | `t.status.RuleVersionStatus.PUBLISHED` | Published | منشور ونشط |
| `RuleVersionStatus` | `SCHEDULED` | `pending` | `.dot-pending` + `CalendarClock` | `t.status.RuleVersionStatus.SCHEDULED` | Scheduled | مجدوَل للنشر |
| `RuleVersionStatus` | `RETIRED` | `neutral` | `Archive` + text | `t.status.RuleVersionStatus.RETIRED` | Retired | متقاعد |
| `RuleSeverity` | `ERROR` | `negative` | `AlertOctagon` + text | `t.status.RuleSeverity.ERROR` | Blocking error | خطأ مانع |
| `RuleSeverity` | `WARNING` | `caution` | `AlertTriangle` + text | `t.status.RuleSeverity.WARNING` | Warning | تحذير |
| `RestorationHoldReason` | `UNCOVERED` | `negative` | `AlertOctagon` + text | `t.status.RestorationHoldReason.UNCOVERED` | Uncovered post-backup gap | فجوة غير مغطاة بعد النسخة الاحتياطية |
| `RestorationHoldReason` | `AMBIGUOUS_IDENTITY` | `caution` | `HelpCircle` + text | `t.status.RestorationHoldReason.AMBIGUOUS_IDENTITY` | Ambiguous document identity | هوية مستند ملتبسة |
| `RestorationHoldReason` | `AUTHORITY_UNRESOLVED` | `caution` | `ClockAlert` + text | `t.status.RestorationHoldReason.AUTHORITY_UNRESOLVED` | Authority verdict unresolved | قرار المصلحة غير محسوم |
| `RestorationCoverageStatus` | `PENDING` | `pending` | `.dot-pending` + text | `t.status.RestorationCoverageStatus.PENDING` | Coverage check pending | قيد التحقق من التغطية |
| `RestorationCoverageStatus` | `CONFIRMED` | `positive` | `CheckCircle2` + text | `t.status.RestorationCoverageStatus.CONFIRMED` | Coverage confirmed | التغطية مؤكدة بالكامل |
| `RestorationCoverageStatus` | `CONFIRMED_WITH_GAP` | `caution` | `AlertTriangle` + text | `t.status.RestorationCoverageStatus.CONFIRMED_WITH_GAP` | Confirmed with known gap | مؤكدة مع وجود فجوة مسجَّلة |
| `RestorationCoverageStatus` | `AUTHORITY_UNRESOLVED` | `caution` | `ClockAlert` + text | `t.status.RestorationCoverageStatus.AUTHORITY_UNRESOLVED` | Authority unresolved | غير محسومة لدى المصلحة |
| `RestoredCopyUnobtainableOutcome` | `AUTHORITY_STATEMENT` | `caution` | `FileCheck` + text | `t.status.RestoredCopyUnobtainableOutcome.AUTHORITY_STATEMENT` | Substituted by authority statement | مُثبَت بكشف رسمي من المصلحة |
| `RestoredCopyUnobtainableOutcome` | `UNRECOVERABLE` | `negative` | `FileX2` + text | `t.status.RestoredCopyUnobtainableOutcome.UNRECOVERABLE` | Unrecoverable document copy | نسخة مستند متعذِّر استرجاعها |
| `RecoveryRunStatus` | `DRAFT` | `neutral` | `FileEdit` + text | `t.status.RecoveryRunStatus.DRAFT` | Draft | مسودة استرداد |
| `RecoveryRunStatus` | `COMPUTED` | `caution` | `Calculator` + text | `t.status.RecoveryRunStatus.COMPUTED` | Computed (awaiting post) | محتسَب (بانتظار الترحيل) |
| `RecoveryRunStatus` | `POSTED` | `positive` | `CheckCircle2` + text | `t.status.RecoveryRunStatus.POSTED` | Posted | مرحَّل |
| `RecoveryRunStatus` | `CANCELLED` | `neutral` | `Ban` + `line-through` | `t.status.RecoveryRunStatus.CANCELLED` | Cancelled | ملغى |

#### Group F — Supplier Document Intake, Purchase Matching, and Exception Board (`01_Enums.md` §12)

> **`ExceptionBoardKind` hue discipline (Law 1):** On `SCR-19` (`ExceptionBoard`), every item carries **three** orthogonal enums: `ExceptionBoardStatus` (`OPEN` / `ACKNOWLEDGED` / `RESOLVED`), `ExceptionSeverity` (`LOW` / `MEDIUM` / `HIGH` / `CRITICAL`), and `ExceptionBoardKind` (45 members: 36 MVP + 9 wave-reserved). Per Law 1, **`ExceptionBoardKind` is a domain category, not an outcome** — its chip renders neutral (`ink` / `neutral`) with a contextual domain icon and translated text label, while outcome colour belongs strictly to `ExceptionBoardStatus` and urgency colour belongs strictly to `ExceptionSeverity` (plus `expiredAt` deadline badge from §1.4). Never invent 45 distinct kind colours.

| Enum | Member (exact) | Role Token | Non-Colour Cue | Dictionary Key | English Label | Arabic Label |
| --- | --- | --- | --- | --- | --- | --- |
| `IntakeStatus` | `RECEIVED` | `pending` | `.dot-pending` + text | `t.status.IntakeStatus.RECEIVED` | Received | مستلم |
| `IntakeStatus` | `EXTRACTED` | `pending` | `.dot-pending` + text | `t.status.IntakeStatus.EXTRACTED` | Extracted | مستخرَج البيانات |
| `IntakeStatus` | `UNDECIDED` | `caution` | `ClockAlert` + text | `t.status.IntakeStatus.UNDECIDED` | Awaiting buyer decision | بانتظار قرار القبول/الرفض |
| `IntakeStatus` | `ACCEPTED` | `positive` | `Check` + text | `t.status.IntakeStatus.ACCEPTED` | Accepted | مقبول |
| `IntakeStatus` | `REJECTED` | `negative` | `XCircle` + text | `t.status.IntakeStatus.REJECTED` | Rejected | مرفوض |
| `IntakeStatus` | `MATCHED` | `positive` | `CheckCircle2` + text | `t.status.IntakeStatus.MATCHED` | Matched to purchase | مطابق لمستند شراء |
| `IntakeStatus` | `DISCARDED` | `neutral` | `Ban` + `line-through` | `t.status.IntakeStatus.DISCARDED` | Discarded | مستبعد |
| `MatchStatus` | `UNMATCHED` | `caution` | `Unlink` + text | `t.status.MatchStatus.UNMATCHED` | Unmatched | غير مطابق |
| `MatchStatus` | `PROPOSED` | `pending` | `.dot-pending` + `Sparkles` | `t.status.MatchStatus.PROPOSED` | Match proposed | مطابقة مقترحة |
| `MatchStatus` | `MATCHED` | `positive` | `Link2` + text | `t.status.MatchStatus.MATCHED` | Matched | مطابق |
| `MatchStatus` | `DISPUTED` | `caution` | `AlertTriangle` + text | `t.status.MatchStatus.DISPUTED` | Disputed | محل اعتراض |
| `MatchStatus` | `IGNORED` | `neutral` | `EyeOff` + text | `t.status.MatchStatus.IGNORED` | Ignored | متجاهَل |
| `PurchaseMatchReasonCode` | `AMOUNT_OUT_OF_TOLERANCE` | `caution` | `Scale` + text | `t.status.PurchaseMatchReasonCode.AMOUNT_OUT_OF_TOLERANCE` | Amount outside tolerance | فرق المبلغ يتجاوز الحد المسموح |
| `PurchaseMatchReasonCode` | `DUPLICATE_SUPPLIER_DOCUMENT` | `negative` | `Copy` + text | `t.status.PurchaseMatchReasonCode.DUPLICATE_SUPPLIER_DOCUMENT` | Duplicate supplier document | مستند مورِّد مكرر |
| `PurchaseMatchReasonCode` | `NOT_OUR_PURCHASE` | `negative` | `FileX2` + text | `t.status.PurchaseMatchReasonCode.NOT_OUR_PURCHASE` | Not our purchase | لا يخص مشتريات المنشأة |
| `ExceptionBoardStatus` | `OPEN` | `caution` | `AlertCircle` + text | `t.status.ExceptionBoardStatus.OPEN` | Open | مفتوح |
| `ExceptionBoardStatus` | `ACKNOWLEDGED` | `pending` | `.dot-pending` + `UserCheck` | `t.status.ExceptionBoardStatus.ACKNOWLEDGED` | Acknowledged | قيد المتابعة |
| `ExceptionBoardStatus` | `RESOLVED` | `positive` | `CheckCircle2` + text | `t.status.ExceptionBoardStatus.RESOLVED` | Resolved | تم الحل |
| `ExceptionSeverity` | `LOW` | `neutral` | `ArrowDown` + text | `t.status.ExceptionSeverity.LOW` | Low | منخفضة |
| `ExceptionSeverity` | `MEDIUM` | `caution` | `Minus` + text | `t.status.ExceptionSeverity.MEDIUM` | Medium | متوسطة |
| `ExceptionSeverity` | `HIGH` | `caution` | `AlertTriangle` + text | `t.status.ExceptionSeverity.HIGH` | High | مرتفعة |
| `ExceptionSeverity` | `CRITICAL` | `negative` | `AlertOctagon` + text | `t.status.ExceptionSeverity.CRITICAL` | Critical | حرجة |
| `ExceptionBoardResolution` | `CONDITION_CLEARED` | `positive` | `CheckCircle2` + text | `t.status.ExceptionBoardResolution.CONDITION_CLEARED` | Condition cleared | زال سبب الاستثناء تلقائياً |
| `ExceptionBoardResolution` | `ACCOUNTANT_DECISION` | `neutral` | `FileSignature` + text | `t.status.ExceptionBoardResolution.ACCOUNTANT_DECISION` | Accountant decision | بقرار مسبَّب من المحاسب |
| `ExceptionBoardResolution` | `SUPERSEDED` | `neutral` | `Replace` + text | `t.status.ExceptionBoardResolution.SUPERSEDED` | Superseded by newer version | استُبدل بنسخة مستند أحدث |
| `ExceptionBoardKind` | `UNPOSTED_DOCUMENT` | `neutral` | `FileClock` + category tag | `t.status.ExceptionBoardKind.UNPOSTED_DOCUMENT` | Unposted fiscal document | مستند مالي غير مرحَّل |
| `ExceptionBoardKind` | `AUTHORITY_PENDING_TIMEOUT` | `neutral` | `ClockAlert` + category tag | `t.status.ExceptionBoardKind.AUTHORITY_PENDING_TIMEOUT` | Authority verdict timed out | تأخُّر رد مصلحة الضرائب |
| `ExceptionBoardKind` | `AUTHORITY_INVALID` | `neutral` | `FileX2` + category tag | `t.status.ExceptionBoardKind.AUTHORITY_INVALID` | Authority rejected as invalid | مستند مرفوض فنياً من المصلحة |
| `ExceptionBoardKind` | `RECEIVER_REJECTED` | `neutral` | `UserX` + category tag | `t.status.ExceptionBoardKind.RECEIVER_REJECTED` | Rejected by buyer | مستند مرفوض من المشتري |
| `ExceptionBoardKind` | `CANCELLATION_PENDING` | `neutral` | `Ban` + category tag | `t.status.ExceptionBoardKind.CANCELLATION_PENDING` | Authority cancellation pending | طلب إلغاء معلق لدى المصلحة |
| `ExceptionBoardKind` | `INBOUND_UNDECIDED` | `neutral` | `Inbox` + category tag | `t.status.ExceptionBoardKind.INBOUND_UNDECIDED` | Inbound supplier doc undecided | فاتورة مشتريات واردة بانتظار القرار |
| `ExceptionBoardKind` | `INBOUND_UNMATCHED` | `neutral` | `Unlink` + category tag | `t.status.ExceptionBoardKind.INBOUND_UNMATCHED` | Accepted inbound doc unmatched | مستند وارد مقبول غير مربوط بمشتريات |
| `ExceptionBoardKind` | `RECEIPT_DEADLINE` | `neutral` | `Receipt` + category tag | `t.status.ExceptionBoardKind.RECEIPT_DEADLINE` | E-receipt submission deadline | اقتراب/فوات مهلة إرسال الإيصالات |
| `ExceptionBoardKind` | `ITEM_CODE_PENDING` | `neutral` | `Barcode` + category tag | `t.status.ExceptionBoardKind.ITEM_CODE_PENDING` | Authority item code pending | تكويد الصنف معلق لدى المصلحة |
| `ExceptionBoardKind` | `POSTING_EXCEPTION` | `neutral` | `AlertTriangle` + category tag | `t.status.ExceptionBoardKind.POSTING_EXCEPTION` | Posting exception | استثناء ترحيل محاسبي |
| `ExceptionBoardKind` | `BANK_UNMATCHED` | `neutral` | `Landmark` + category tag | `t.status.ExceptionBoardKind.BANK_UNMATCHED` | Unmatched bank statement line | حركة كشف بنكي غير مطابقة |
| `ExceptionBoardKind` | `PAYMENT_FILE_RECALL` | `neutral` | `FileWarning` + category tag | `t.status.ExceptionBoardKind.PAYMENT_FILE_RECALL` | Payment file recall / payee review | استدعاء ملف دفع لتغيُّر بيانات المستفيد |
| `ExceptionBoardKind` | `RECOVERY_DATA_GAP` | `neutral` | `DatabaseZap` + category tag | `t.status.ExceptionBoardKind.RECOVERY_DATA_GAP` | Post-restore data gap | فجوة بيانات بعد استعادة النسخة الاحتياطية |
| `ExceptionBoardKind` | `DUPLICATE_BANK_EXECUTION` | `neutral` | `Copy` + category tag | `t.status.ExceptionBoardKind.DUPLICATE_BANK_EXECUTION` | Duplicate bank execution | تنفيذ بنكي مزدوج لدفعة ملغاة/فاشلة |
| `ExceptionBoardKind` | `SUPPLY_NOT_EVIDENCED` | `neutral` | `FileQuestion` + category tag | `t.status.ExceptionBoardKind.SUPPLY_NOT_EVIDENCED` | Period-end supply unevidenced | توريد بنهاية الفترة بلا إثبات استحقاق |
| `ExceptionBoardKind` | `INTERIM_POLICY_PENDING` | `neutral` | `Scale` + category tag | `t.status.ExceptionBoardKind.INTERIM_POLICY_PENDING` | Interim tax policy acknowledgement pending | معالجة ضريبية بانتظار إقرار السياسة |
| `ExceptionBoardKind` | `REVALUATION_STALE` | `neutral` | `RefreshCw` + category tag | `t.status.ExceptionBoardKind.REVALUATION_STALE` | Stale FX revaluation | إعادة تقييم العملات بحاجة لتحديث |
| `ExceptionBoardKind` | `CREDIT_EVIDENCE_PENDING` | `neutral` | `FileSearch` + category tag | `t.status.ExceptionBoardKind.CREDIT_EVIDENCE_PENDING` | VAT credit evidence pending | رصيد دائن ضريبي بانتظار مستند الإثبات |
| `ExceptionBoardKind` | `RESTORED_CREDIT_UNKNOWN` | `neutral` | `HelpCircle` + category tag | `t.status.ExceptionBoardKind.RESTORED_CREDIT_UNKNOWN` | Restored VAT credit unknown | رصيد ضريبي مستعاد غير محدَّد القيمة |
| `ExceptionBoardKind` | `JOURNAL_ANOMALY` | `neutral` | `SearchAlert` + category tag *(Wave 1)* | `t.status.ExceptionBoardKind.JOURNAL_ANOMALY` | Journal anomaly finding | ملاحظة فحص قيود غير معتادة |
| `ExceptionBoardKind` | `CASH_DIFFERENCE_UNEXPLAINED` | `neutral` | `Coins` + category tag | `t.status.ExceptionBoardKind.CASH_DIFFERENCE_UNEXPLAINED` | Unexplained POS cash difference | عجز/فائض نقدية وردية غير مفسَّر |
| `ExceptionBoardKind` | `CLOSED_BOX_CASH` | `neutral` | `Lock` + category tag | `t.status.ExceptionBoardKind.CLOSED_BOX_CASH` | Cash movement on closed treasury | رصيد نقدي على خزينة مقفلة |
| `ExceptionBoardKind` | `RETURN_REFERENCE_UNMATCHED` | `neutral` | `Undo2` + category tag | `t.status.ExceptionBoardKind.RETURN_REFERENCE_UNMATCHED` | POS return reference unmatched | إيصال مرتجع بلا مرجع أصلي صالح |
| `ExceptionBoardKind` | `RECEIPT_CONTENT_DEFECT` | `neutral` | `FileWarning` + category tag | `t.status.ExceptionBoardKind.RECEIPT_CONTENT_DEFECT` | POS receipt arithmetic defect | خلل حسابي في بنود إيصال نقطة بيع |
| `ExceptionBoardKind` | `AUC_COST_UNASSIGNED` | `neutral` | `HardHat` + category tag | `t.status.ExceptionBoardKind.AUC_COST_UNASSIGNED` | Unassigned construction cost | تكلفة مشروعات تحت التنفيذ غير مربوطة بأصل |
| `ExceptionBoardKind` | `ASSET_SOURCE_CHANGED` | `neutral` | `Building2` + category tag | `t.status.ExceptionBoardKind.ASSET_SOURCE_CHANGED` | Capitalized asset source changed | تغيُّر مستند الشراء المرسمل للأصل |
| `ExceptionBoardKind` | `AUTHORITY_REQUEST` | `neutral` | `Stamp` + category tag | `t.status.ExceptionBoardKind.AUTHORITY_REQUEST` | Authority amendment request required | تعديل إقرار يتطلب موافقة المصلحة |
| `ExceptionBoardKind` | `INTEGRITY_CHECK_FAILED` | `neutral` | `ShieldAlert` + category tag | `t.status.ExceptionBoardKind.INTEGRITY_CHECK_FAILED` | Ledger integrity check failed | فشل فحص سلامة وتطابق الدفاتر |
| `ExceptionBoardKind` | `PROFILE_COUNTRY_MISMATCH` | `neutral` | `GlobeLock` + category tag | `t.status.ExceptionBoardKind.PROFILE_COUNTRY_MISMATCH` | Company country mismatch | تعارض دولة الشركة مع الملف المحاسبي المجمَّد |
| `ExceptionBoardKind` | `CHEQUE_BOUNCED` | `neutral` | `FileX2` + category tag | `t.status.ExceptionBoardKind.CHEQUE_BOUNCED` | Returned / bounced cheque | شيك مرتد بدون رصيد |
| `ExceptionBoardKind` | `PARTY_MERGE_REFUSED` | `neutral` | `GitMerge` + category tag | `t.status.ExceptionBoardKind.PARTY_MERGE_REFUSED` | Party merge refused (tax ID conflict) | رفض دمج جهات لاختلاف الرقم الضريبي |
| `ExceptionBoardKind` | `INVENTORY_RECON_DIFFERENCE` | `neutral` | `Boxes` + category tag | `t.status.ExceptionBoardKind.INVENTORY_RECON_DIFFERENCE` | Inventory reconciliation difference | فروق مطابقة المخزون مع الأستاذ العام |
| `ExceptionBoardKind` | `INBOX_PARK_STALLED` | `neutral` | `PauseCircle` + category tag | `t.status.ExceptionBoardKind.INBOX_PARK_STALLED` | Stalled parked integration event | توقُّف رسائل واردة معلَّقة بالصندوق |
| `ExceptionBoardKind` | `RECEIPT_WITHHELD` | `neutral` | `HandStop` + category tag | `t.status.ExceptionBoardKind.RECEIPT_WITHHELD` | Withheld POS receipt | إيصال نقطة بيع محتجَز دون ترحيل |
| `ExceptionBoardKind` | `SHIFT_CLOSE_MISSING` | `neutral` | `ClockAlert` + category tag | `t.status.ExceptionBoardKind.SHIFT_CLOSE_MISSING` | Missing POS shift close | إقفال وردية نقطة بيع مفقود |
| `ExceptionBoardKind` | `INBOX_POSITION_LOST` | `neutral` | `Unplug` + category tag | `t.status.ExceptionBoardKind.INBOX_POSITION_LOST` | Declared lost stream positions | مواقع متسلسلة معلَن عن فقدها للمطابقة |
| `ExceptionBoardKind` | `REFERENCE_CODE_WITHDRAWN` | `neutral` | `BookX` + category tag | `t.status.ExceptionBoardKind.REFERENCE_CODE_WITHDRAWN` | Authority reference code withdrawn | إلغاء رمز مرجعي مستخدم لدى المصلحة |
| `ExceptionBoardKind` | `PROVIDER_CHARGEBACK` | `neutral` | `RotateCcw` + category tag *(Wave 1)* | `t.status.ExceptionBoardKind.PROVIDER_CHARGEBACK` | Payment gateway chargeback | استرداد قسري (Chargeback) من بوابة الدفع |
| `ExceptionBoardKind` | `GATEWAY_AMOUNT_MISMATCH` | `neutral` | `Scale` + category tag *(Wave 1)* | `t.status.ExceptionBoardKind.GATEWAY_AMOUNT_MISMATCH` | Gateway callback amount mismatch | اختلاف مبلغ إشعار بوابة الدفع |
| `ExceptionBoardKind` | `EXTERNAL_ACCESS_DIVERGED` | `neutral` | `UserCog` + category tag *(Wave 2)* | `t.status.ExceptionBoardKind.EXTERNAL_ACCESS_DIVERGED` | External auditor access diverged | تعارض صلاحية المحاسب/المراجع الخارجي |
| `ExceptionBoardKind` | `COLLECTION_RETURNED` | `neutral` | `Undo2` + category tag *(Wave 2)* | `t.status.ExceptionBoardKind.COLLECTION_RETURNED` | Direct debit collection returned | ارتداد تحصيل خصم مباشر |
| `ExceptionBoardKind` | `MANDATE_SUSPENDED` | `neutral` | `PauseCircle` + category tag *(Wave 2)* | `t.status.ExceptionBoardKind.MANDATE_SUSPENDED` | Direct debit mandate suspended | تعليق تفويض الخصم المباشر |
| `ExceptionBoardKind` | `COLLECTION_IN_FLIGHT_OVERDUE` | `neutral` | `ClockAlert` + category tag *(Wave 2)* | `t.status.ExceptionBoardKind.COLLECTION_IN_FLIGHT_OVERDUE` | In-flight direct debit overdue | تأخر تسوية تحصيل خصم مباشر |
| `ExceptionBoardKind` | `INTAKE_EXTRACTION_FAILED` | `neutral` | `ScanLine` + category tag *(Wave 3)* | `t.status.ExceptionBoardKind.INTAKE_EXTRACTION_FAILED` | Document OCR extraction failed | فشل استخراج بيانات المستند آلياً |
| `ExceptionBoardKind` | `INSTRUMENT_EXPOSURE_UNRELEASED` | `neutral` | `ShieldAlert` + category tag *(Wave 3)* | `t.status.ExceptionBoardKind.INSTRUMENT_EXPOSURE_UNRELEASED` | Expired guarantee/LC unreleased | خطاب ضمان/اعتماد منتهٍ لم يُفرَج عنه |

#### Group G — Receivables, Payables, Open Items, Credit Holds, Disputes, Dunning, and Write-Offs (`01_Enums.md` §13)

| Enum | Member (exact) | Role Token | Non-Colour Cue | Dictionary Key | English Label | Arabic Label |
| --- | --- | --- | --- | --- | --- | --- |
| `OpenItemStatus` | `OPEN` | `pending` | `.dot-pending` + text | `t.status.OpenItemStatus.OPEN` | Open | مفتوح |
| `OpenItemStatus` | `PARTIALLY_SETTLED` | `caution` | `PieChart` + text | `t.status.OpenItemStatus.PARTIALLY_SETTLED` | Partially settled | مسدَّد جزئياً |
| `OpenItemStatus` | `SETTLED` | `positive` | `CheckCircle2` + text | `t.status.OpenItemStatus.SETTLED` | Settled | مسدَّد بالكامل |
| `OpenItemStatus` | `WRITTEN_OFF` | `neutral` | `FileMinus2` + text | `t.status.OpenItemStatus.WRITTEN_OFF` | Written off | مشطوب كدين معدوم |
| `OpenItemStatus` | `DISPUTED` | `caution` | `AlertTriangle` + text | `t.status.OpenItemStatus.DISPUTED` | Disputed | محل نزاع |
| `OpenItemOrigin` | `DOCUMENT` | `neutral` | `FileText` + text | `t.status.OpenItemOrigin.DOCUMENT` | Fiscal document | مستند مالي |
| `OpenItemOrigin` | `OPENING_BALANCE` | `neutral` | `Play` + text | `t.status.OpenItemOrigin.OPENING_BALANCE` | Opening balance | رصيد افتتاحي |
| `OpenItemOrigin` | `UNAPPLIED_SETTLEMENT` | `caution` | `CircleDashed` + text | `t.status.OpenItemOrigin.UNAPPLIED_SETTLEMENT` | Unapplied receipt/payment | دفعة غير موزَّعة |
| `OpenItemOrigin` | `ADVANCE` | `neutral` | `FastForward` + text | `t.status.OpenItemOrigin.ADVANCE` | Advance / prepayment | دفعة مقدمة |
| `OpenItemOrigin` | `PAYMENT_PLAN` | `neutral` | `CalendarRange` + text | `t.status.OpenItemOrigin.PAYMENT_PLAN` | Payment plan installment | قسط خطة سداد |
| `SettlementInstrumentType` | `CASH` | `neutral` | `Banknote` + text | `t.status.SettlementInstrumentType.CASH` | Cash | نقدي |
| `SettlementInstrumentType` | `BANK_TRANSFER` | `neutral` | `Landmark` + text | `t.status.SettlementInstrumentType.BANK_TRANSFER` | Bank transfer | تحويل بنكي |
| `SettlementInstrumentType` | `CARD` | `neutral` | `CreditCard` + text | `t.status.SettlementInstrumentType.CARD` | Card | بطاقة دفع |
| `SettlementInstrumentType` | `CHEQUE` | `neutral` | `FileCheck` + text | `t.status.SettlementInstrumentType.CHEQUE` | Cheque / negotiable instrument | شيك / ورقة تجارية |
| `SettlementInstrumentType` | `EWALLET` | `neutral` | `Smartphone` + text | `t.status.SettlementInstrumentType.EWALLET` | E-wallet | محفظة إلكترونية |
| `SettlementInstrumentType` | `WITHHOLDING_CERTIFICATE` | `neutral` | `Stamp` + text | `t.status.SettlementInstrumentType.WITHHOLDING_CERTIFICATE` | Withholding tax certificate | إشعار خصم وتحصيل ضريبي |
| `SettlementInstrumentType` | `OFFSET` | `neutral` | `ArrowLeftRight` + text | `t.status.SettlementInstrumentType.OFFSET` | Account offset | مقاصة داخلية |
| `SettlementInstrumentType` | `NETTING` | `neutral` | `GitCompareArrows` + text | `t.status.SettlementInstrumentType.NETTING` | AR/AP netting | مقاصة عميل ومورِّد |
| `SettlementInstrumentType` | `WRITE_OFF` | `neutral` | `FileMinus2` + text | `t.status.SettlementInstrumentType.WRITE_OFF` | Write-off | إعدام دين |
| `SettlementInstrumentType` | `EARLY_PAYMENT_DISCOUNT` | `neutral` | `Percent` + text | `t.status.SettlementInstrumentType.EARLY_PAYMENT_DISCOUNT` | Early payment discount | خصم تعجيل الدفع |
| `SettlementInstrumentType` | `ADVANCE_APPLICATION` | `neutral` | `FastForward` + text | `t.status.SettlementInstrumentType.ADVANCE_APPLICATION` | Advance application | تسوية دفعة مقدمة |
| `SettlementInstrumentType` | `CREDIT_NOTE_APPLICATION` | `neutral` | `FileMinus` + text | `t.status.SettlementInstrumentType.CREDIT_NOTE_APPLICATION` | Credit note application | تسوية إشعار دائن |
| `SettlementInstrumentType` | `RETENTION_RELEASE` | `neutral` | `Unlock` + text | `t.status.SettlementInstrumentType.RETENTION_RELEASE` | Retention release | إفراج تأمين أعمال |
| `SettlementInstrumentType` | `FX_DIFFERENCE` | `neutral` | `Coins` + text *(reserved)* | `t.status.SettlementInstrumentType.FX_DIFFERENCE` | FX difference | فروق عملة |
| `SettlementInstrumentType` | `ROUNDING` | `neutral` | `Diff` + text | `t.status.SettlementInstrumentType.ROUNDING` | Rounding adjustment | فروق تقريب |
| `SettlementInstrumentType` | `CUSTODY` | `neutral` | `Briefcase` + text | `t.status.SettlementInstrumentType.CUSTODY` | Employee custody | تسوية عهدة موظف |
| `DunningRunStatus` | `DRAFT` | `neutral` | `FileEdit` + text | `t.status.DunningRunStatus.DRAFT` | Draft | مسودة |
| `DunningRunStatus` | `PROPOSED` | `pending` | `.dot-pending` + text | `t.status.DunningRunStatus.PROPOSED` | Proposed | مقترحة للمراجعة |
| `DunningRunStatus` | `APPROVED` | `positive` | `Check` + text | `t.status.DunningRunStatus.APPROVED` | Approved | معتمدة |
| `DunningRunStatus` | `ISSUED` | `positive` | `Send` + text | `t.status.DunningRunStatus.ISSUED` | Notices issued | تم إرسال المطالبات |
| `DunningRunStatus` | `CANCELLED` | `neutral` | `Ban` + `line-through` | `t.status.DunningRunStatus.CANCELLED` | Cancelled | ملغاة |
| `DunningRunItemStatus` | `PROPOSED` | `pending` | `.dot-pending` + text | `t.status.DunningRunItemStatus.PROPOSED` | Proposed | مقترح |
| `DunningRunItemStatus` | `EXCLUDED` | `neutral` | `MinusCircle` + text | `t.status.DunningRunItemStatus.EXCLUDED` | Excluded | مستثنى بسبب مبرَّر |
| `DunningRunItemStatus` | `ISSUED` | `positive` | `CheckCircle2` + text | `t.status.DunningRunItemStatus.ISSUED` | Notice issued | أُرسلت المطالبة |
| `DunningRunItemStatus` | `FAILED` | `negative` | `XCircle` + text | `t.status.DunningRunItemStatus.FAILED` | Delivery failed | فشل الإرسال |
| `NettingStatus` | `DRAFT` | `neutral` | `FileEdit` + text | `t.status.NettingStatus.DRAFT` | Draft | مسودة |
| `NettingStatus` | `APPROVED` | `positive` | `Check` + text | `t.status.NettingStatus.APPROVED` | Approved | معتمدة |
| `NettingStatus` | `POSTED` | `positive` | `CheckCircle2` + text | `t.status.NettingStatus.POSTED` | Posted | مرحَّلة |
| `NettingStatus` | `REVERSED` | `neutral` | `RotateCcw` + text | `t.status.NettingStatus.REVERSED` | Reversed | معكوسة |
| `NettingStatus` | `CANCELLED` | `neutral` | `Ban` + `line-through` | `t.status.NettingStatus.CANCELLED` | Cancelled | ملغاة |
| `AdvanceStatus` | `OPEN` | `pending` | `.dot-pending` + text | `t.status.AdvanceStatus.OPEN` | Open (unapplied) | مفتوحة (غير مستنفدة) |
| `AdvanceStatus` | `PARTIALLY_APPLIED` | `caution` | `PieChart` + text | `t.status.AdvanceStatus.PARTIALLY_APPLIED` | Partially applied | مستخدمة جزئياً |
| `AdvanceStatus` | `FULLY_APPLIED` | `positive` | `CheckCircle2` + text | `t.status.AdvanceStatus.FULLY_APPLIED` | Fully applied | مستخدمة بالكامل |
| `AdvanceStatus` | `REFUNDED` | `neutral` | `Undo2` + text | `t.status.AdvanceStatus.REFUNDED` | Refunded | مستردة نقداً/بنكياً |
| `AdvanceStatus` | `CANCELLED` | `neutral` | `Ban` + `line-through` | `t.status.AdvanceStatus.CANCELLED` | Cancelled | ملغاة |
| `CreditHoldStatus` | `ACTIVE` | `negative` | `OctagonPause` + text | `t.status.CreditHoldStatus.ACTIVE` | On credit hold | إيقاف ائتماني نشط |
| `CreditHoldStatus` | `RELEASED` | `positive` | `Unlock` + text | `t.status.CreditHoldStatus.RELEASED` | Hold released | تم رفع الإيقاف الائتماني |
| `CreditHoldReason` | `LIMIT_EXCEEDED` | `caution` | `TrendingUp` + text | `t.status.CreditHoldReason.LIMIT_EXCEEDED` | Credit limit exceeded | تجاوز الحد الائتماني |
| `CreditHoldReason` | `OVERDUE` | `caution` | `ClockAlert` + text | `t.status.CreditHoldReason.OVERDUE` | Overdue balance | متأخرات سداد |
| `CreditHoldReason` | `DISPUTE` | `caution` | `AlertTriangle` + text | `t.status.CreditHoldReason.DISPUTE` | Active dispute | نزاع قائم |
| `CreditHoldReason` | `BOUNCED_CHEQUE` | `negative` | `FileX2` + text | `t.status.CreditHoldReason.BOUNCED_CHEQUE` | Bounced cheque | شيك مرتد |
| `CreditHoldReason` | `MANUAL` | `neutral` | `HandStop` + text | `t.status.CreditHoldReason.MANUAL` | Manual credit hold | إيقاف يدوي |
| `DisputeStatus` | `NONE` | `neutral` | `Minus` + text | `t.status.DisputeStatus.NONE` | No dispute | لا يوجد نزاع |
| `DisputeStatus` | `OPEN` | `caution` | `AlertTriangle` + text | `t.status.DisputeStatus.OPEN` | Dispute open | نزاع مفتوح |
| `DisputeStatus` | `RESOLVED` | `positive` | `CheckCircle2` + text | `t.status.DisputeStatus.RESOLVED` | Dispute resolved | تم حل النزاع |
| `DisputeStatus` | `ESCALATED` | `negative` | `AlertOctagon` + text | `t.status.DisputeStatus.ESCALATED` | Escalated | مصعَّد قانونياً/إدارياً |
| `WriteOffStatus` | `REQUESTED` | `pending` | `.dot-pending` + text | `t.status.WriteOffStatus.REQUESTED` | Requested | قيد طلب الاعتماد |
| `WriteOffStatus` | `APPROVED` | `positive` | `Check` + text | `t.status.WriteOffStatus.APPROVED` | Approved | معتمد للشطب |
| `WriteOffStatus` | `POSTED` | `positive` | `CheckCircle2` + text | `t.status.WriteOffStatus.POSTED` | Posted | مرحَّل |
| `WriteOffStatus` | `CANCELLED` | `neutral` | `Ban` + `line-through` | `t.status.WriteOffStatus.CANCELLED` | Cancelled | ملغى |
| `WriteOffDeductionStatus` | `NOT_CLAIMED` | `neutral` | `Minus` + text | `t.status.WriteOffDeductionStatus.NOT_CLAIMED` | Tax deduction not claimed | لم يُطلَب خصمه ضريبياً |
| `WriteOffDeductionStatus` | `PROVISIONAL` | `caution` | `Clock` + text | `t.status.WriteOffDeductionStatus.PROVISIONAL` | Provisional (awaiting year cap) | مبدئي (بانتظار سقف نهاية السنة) |
| `WriteOffDeductionStatus` | `CONFIRMED` | `positive` | `ShieldCheck` + text | `t.status.WriteOffDeductionStatus.CONFIRMED` | Tax deduction confirmed | مقبول للخصم الضريبي |
| `WriteOffDeductionStatus` | `DENIED` | `negative` | `XCircle` + text | `t.status.WriteOffDeductionStatus.DENIED` | Denied (tax add-back) | مرفوض ضريبياً (يُرد للوعاء) |
| `PromiseToPayStatus` | `PENDING` | `pending` | `.dot-pending` + `Handshake` | `t.status.PromiseToPayStatus.PENDING` | Active promise | وعد بالسداد قائم |
| `PromiseToPayStatus` | `KEPT` | `positive` | `CheckCircle2` + text | `t.status.PromiseToPayStatus.KEPT` | Promise kept | تم الوفاء بالوعد |
| `PromiseToPayStatus` | `BROKEN` | `negative` | `XCircle` + text | `t.status.PromiseToPayStatus.BROKEN` | Promise broken | تم الإخلال بالوعد |
| `PromiseToPayStatus` | `CANCELLED` | `neutral` | `Ban` + `line-through` | `t.status.PromiseToPayStatus.CANCELLED` | Cancelled | ملغى |
| `PaymentPlanStatus` | `DRAFT` | `neutral` | `FileEdit` + text | `t.status.PaymentPlanStatus.DRAFT` | Draft | مسودة |
| `PaymentPlanStatus` | `ACTIVE` | `positive` | `CalendarCheck` + text | `t.status.PaymentPlanStatus.ACTIVE` | Active | نشطة |
| `PaymentPlanStatus` | `COMPLETED` | `positive` | `CheckCircle2` + text | `t.status.PaymentPlanStatus.COMPLETED` | Completed | مكتملة السداد |
| `PaymentPlanStatus` | `DEFAULTED` | `negative` | `AlertOctagon` + text | `t.status.PaymentPlanStatus.DEFAULTED` | Defaulted | متعثرة |
| `PaymentPlanStatus` | `CANCELLED` | `neutral` | `Ban` + `line-through` | `t.status.PaymentPlanStatus.CANCELLED` | Cancelled | ملغاة |

#### Group H — Treasury, Bank Accounts, Payment Runs & Files, Instruments, and Bank Reconciliation (`01_Enums.md` §14)

| Enum | Member (exact) | Role Token | Non-Colour Cue | Dictionary Key | English Label | Arabic Label |
| --- | --- | --- | --- | --- | --- | --- |
| `PaymentStatus` | `DRAFT` | `neutral` | `FileEdit` + text | `t.status.PaymentStatus.DRAFT` | Draft | مسودة |
| `PaymentStatus` | `APPROVED` | `caution` | `Check` + text *(unreleased)* | `t.status.PaymentStatus.APPROVED` | Approved (awaiting dispatch) | معتمدة (بانتظار الصرف/الإرسال) |
| `PaymentStatus` | `SENT` | `pending` | `.dot-pending` + `Send` | `t.status.PaymentStatus.SENT` | Sent to bank / payee | مُرسَلة للبنك/المستفيد |
| `PaymentStatus` | `CLEARED` | `positive` | `CheckCircle2` + text | `t.status.PaymentStatus.CLEARED` | Cleared | محصَّلة ومسوّاة بنكياً |
| `PaymentStatus` | `FAILED` | `negative` | `XCircle` + text | `t.status.PaymentStatus.FAILED` | Failed | فاشلة |
| `PaymentStatus` | `CANCELLED` | `neutral` | `Ban` + `line-through` | `t.status.PaymentStatus.CANCELLED` | Cancelled | ملغاة |
| `PaymentRunStatus` | `DRAFT` | `neutral` | `FileEdit` + text | `t.status.PaymentRunStatus.DRAFT` | Draft | مسودة |
| `PaymentRunStatus` | `PROPOSED` | `pending` | `.dot-pending` + text | `t.status.PaymentRunStatus.PROPOSED` | Proposed | مقترحة للمراجعة |
| `PaymentRunStatus` | `APPROVED` | `caution` | `Check` + text | `t.status.PaymentRunStatus.APPROVED` | Approved (unposted) | معتمدة (بانتظار الترحيل) |
| `PaymentRunStatus` | `POSTED` | `positive` | `CheckCircle2` + text | `t.status.PaymentRunStatus.POSTED` | Posted | مرحَّلة |
| `PaymentRunStatus` | `FILE_CREATED` | `positive` | `FileSpreadsheet` + text | `t.status.PaymentRunStatus.FILE_CREATED` | Payment file generated | تم إصدار ملف الدفع |
| `PaymentRunStatus` | `CANCELLED` | `neutral` | `Ban` + `line-through` | `t.status.PaymentRunStatus.CANCELLED` | Cancelled | ملغاة |
| `PaymentRunItemStatus` | `PROPOSED` | `pending` | `.dot-pending` + text | `t.status.PaymentRunItemStatus.PROPOSED` | Proposed | مقترح |
| `PaymentRunItemStatus` | `EXCLUDED` | `neutral` | `MinusCircle` + text | `t.status.PaymentRunItemStatus.EXCLUDED` | Excluded | مستثنى |
| `PaymentRunItemStatus` | `APPROVED` | `caution` | `Check` + text | `t.status.PaymentRunItemStatus.APPROVED` | Approved | معتمد للصرف |
| `PaymentRunItemStatus` | `PAID` | `positive` | `CheckCircle2` + text | `t.status.PaymentRunItemStatus.PAID` | Paid | مدفوع |
| `PaymentRunItemStatus` | `FAILED` | `negative` | `XCircle` + text | `t.status.PaymentRunItemStatus.FAILED` | Failed | فشل الدفع |
| `PaymentRunItemStatus` | `CANCELLED` | `neutral` | `Ban` + `line-through` | `t.status.PaymentRunItemStatus.CANCELLED` | Cancelled | ملغى |
| `PaymentFileStatus` | `GENERATED` | `caution` | `FileCode` + text *(not yet downloaded)* | `t.status.PaymentFileStatus.GENERATED` | Generated (awaiting download) | تم إنشاؤه (بانتظار التنزيل) |
| `PaymentFileStatus` | `DOWNLOADED` | `pending` | `.dot-pending` + `Download` | `t.status.PaymentFileStatus.DOWNLOADED` | Downloaded (in transit to bank) | تم تنزيله (قيد التنفيذ البنكي) |
| `PaymentFileStatus` | `ACKNOWLEDGED` | `positive` | `CheckCircle2` + text | `t.status.PaymentFileStatus.ACKNOWLEDGED` | Bank acknowledged | مؤكد التنفيذ من البنك |
| `PaymentFileStatus` | `REJECTED` | `negative` | `XCircle` + text | `t.status.PaymentFileStatus.REJECTED` | Rejected by bank | مرفوض من البنك |
| `PaymentFileStatus` | `INVALIDATED` | `neutral` | `FileX` + `line-through` | `t.status.PaymentFileStatus.INVALIDATED` | Invalidated | مُبطَل قبل الإرسال |
| `PaymentFileStatus` | `RECALL_REQUESTED` | `caution` | `AlertTriangle` + text | `t.status.PaymentFileStatus.RECALL_REQUESTED` | Recall / bank check required | مطلوب إيقاف/استعلام من البنك |
| `PaymentFileStatus` | `CANCELLED_BY_BANK` | `neutral` | `Ban` + `line-through` | `t.status.PaymentFileStatus.CANCELLED_BY_BANK` | Cancelled by bank | مؤكد الإلغاء من البنك |
| `BankEvidenceKind` | `BANK_REJECTION` | `negative` | `XCircle` + text | `t.status.BankEvidenceKind.BANK_REJECTION` | Bank rejection notice | إشعار رفض بنكي |
| `BankEvidenceKind` | `BANK_CANCELLATION_CONFIRMED` | `neutral` | `Ban` + text | `t.status.BankEvidenceKind.BANK_CANCELLATION_CONFIRMED` | Bank cancellation confirmation | تأكيد بنكي بإلغاء التعليمات |
| `BankEvidenceKind` | `INSTRUCTION_EXPIRED` | `caution` | `AlarmClockOff` + text | `t.status.BankEvidenceKind.INSTRUCTION_EXPIRED` | Instruction validity expired | انتهاء صلاحية تعليمات الدفع |
| `BankEvidenceKind` | `NOT_RECEIVED` | `caution` | `HelpCircle` + text *(non-releasing)* | `t.status.BankEvidenceKind.NOT_RECEIVED` | Not on bank record yet | غير مسجل لدى البنك حتى تاريخه |
| `BankFileFormatStatus` | `DRAFT` | `neutral` | `FileEdit` + text | `t.status.BankFileFormatStatus.DRAFT` | Draft | مسودة |
| `BankFileFormatStatus` | `PUBLISHED` | `positive` | `CheckCircle2` + text | `t.status.BankFileFormatStatus.PUBLISHED` | Published | منشور ونشط |
| `BankFileFormatStatus` | `RETIRED` | `neutral` | `Archive` + text | `t.status.BankFileFormatStatus.RETIRED` | Retired | متقاعد |
| `BankAccountStatus` | `ACTIVE` | `positive` | `CheckCircle2` + text | `t.status.BankAccountStatus.ACTIVE` | Active | نشط |
| `BankAccountStatus` | `BLOCKED` | `caution` | `OctagonPause` + text | `t.status.BankAccountStatus.BLOCKED` | Blocked | محظور مؤقتاً |
| `BankAccountStatus` | `CLOSED` | `neutral` | `Lock` + text | `t.status.BankAccountStatus.CLOSED` | Closed | مقفل |
| `PartyBankAccountStatus` | `DRAFT` | `neutral` | `FileEdit` + text | `t.status.PartyBankAccountStatus.DRAFT` | Draft | مسودة |
| `PartyBankAccountStatus` | `PENDING_CONFIRMATION` | `pending` | `.dot-pending` + `UserCheck` | `t.status.PartyBankAccountStatus.PENDING_CONFIRMATION` | Pending dual-control confirmation | بانتظار تأكيد المراجع الثاني |
| `PartyBankAccountStatus` | `ACTIVE` | `positive` | `ShieldCheck` + text | `t.status.PartyBankAccountStatus.ACTIVE` | Active (payable) | نشط ومعتمد للصرف |
| `PartyBankAccountStatus` | `BLOCKED` | `negative` | `OctagonPause` + text | `t.status.PartyBankAccountStatus.BLOCKED` | Blocked | محظور |
| `PartyBankAccountStatus` | `ARCHIVED` | `neutral` | `Archive` + text | `t.status.PartyBankAccountStatus.ARCHIVED` | Archived | مؤرشف |
| `TreasuryStatus` | `ACTIVE` | `positive` | `CheckCircle2` + text | `t.status.TreasuryStatus.ACTIVE` | Active | نشطة |
| `TreasuryStatus` | `SUSPENDED` | `caution` | `PauseCircle` + text | `t.status.TreasuryStatus.SUSPENDED` | Suspended | موقوفة مؤقتاً |
| `TreasuryStatus` | `CLOSED` | `neutral` | `Lock` + text | `t.status.TreasuryStatus.CLOSED` | Closed | مقفلة |
| `CustodyStatus` | `ISSUED` | `pending` | `.dot-pending` + text | `t.status.CustodyStatus.ISSUED` | Issued (open) | منصرفة (مفتوحة) |
| `CustodyStatus` | `PARTIALLY_SETTLED` | `caution` | `PieChart` + text | `t.status.CustodyStatus.PARTIALLY_SETTLED` | Partially settled | مسوّاة جزئياً |
| `CustodyStatus` | `SETTLED` | `positive` | `CheckCircle2` + text | `t.status.CustodyStatus.SETTLED` | Settled | مسوّاة بالكامل |
| `CustodyStatus` | `RETURNED` | `neutral` | `Undo2` + text | `t.status.CustodyStatus.RETURNED` | Returned in cash | مردودة للخزينة |
| `CustodyStatus` | `WRITTEN_OFF` | `negative` | `FileMinus2` + text | `t.status.CustodyStatus.WRITTEN_OFF` | Written off | مشطوبة |
| `CashTransferStatus` | `SENT` | `pending` | `.dot-pending` + `ArrowRight` (`mirrorInRtl`) | `t.status.CashTransferStatus.SENT` | In transit (sent) | قيد النقل (مرسَلة) |
| `CashTransferStatus` | `RECEIVED` | `positive` | `Check` + text | `t.status.CashTransferStatus.RECEIVED` | Received | مستلمة |
| `CashTransferStatus` | `RECONCILED` | `positive` | `CheckCircle2` + text | `t.status.CashTransferStatus.RECONCILED` | Reconciled | مطابقة ومسوّاة |
| `CashTransferStatus` | `CANCELLED` | `neutral` | `Ban` + `line-through` | `t.status.CashTransferStatus.CANCELLED` | Cancelled | ملغاة |
| `InboundInstrumentStatus` | `RECEIVED` | `neutral` | `Inbox` + text *(in portfolio)* | `t.status.InboundInstrumentStatus.RECEIVED` | Received (in portfolio) | مستلم بالمحفظة |
| `InboundInstrumentStatus` | `ENDORSED` | `neutral` | `Forward` (`mirrorInRtl`) + text | `t.status.InboundInstrumentStatus.ENDORSED` | Endorsed to supplier | مظهَّر لمورِّد |
| `InboundInstrumentStatus` | `DEPOSITED` | `pending` | `.dot-pending` + text | `t.status.InboundInstrumentStatus.DEPOSITED` | Deposited at bank | مودَع بالبنك |
| `InboundInstrumentStatus` | `UNDER_COLLECTION` | `pending` | `.dot-pending` + text | `t.status.InboundInstrumentStatus.UNDER_COLLECTION` | Under collection | برسم التحصيل |
| `InboundInstrumentStatus` | `COLLECTED` | `positive` | `CheckCircle2` + text | `t.status.InboundInstrumentStatus.COLLECTED` | Collected | محصَّل |
| `InboundInstrumentStatus` | `BOUNCED` | `negative` | `AlertOctagon` + text | `t.status.InboundInstrumentStatus.BOUNCED` | Bounced / dishonoured | مرتد بدون تحصيل |
| `InboundInstrumentStatus` | `RETURNED` | `neutral` | `Undo2` + text | `t.status.InboundInstrumentStatus.RETURNED` | Returned to drawer | مردود للساحب |
| `InboundInstrumentStatus` | `RECOURSE_RECEIVED` | `negative` | `RotateCcw` + text | `t.status.InboundInstrumentStatus.RECOURSE_RECEIVED` | Endorsement recourse received | رجوع على المظهِّر لعدم التحصيل |
| `OutboundInstrumentStatus` | `ISSUED` | `neutral` | `FileEdit` + text | `t.status.OutboundInstrumentStatus.ISSUED` | Issued | محرَّر |
| `OutboundInstrumentStatus` | `PRINTED` | `neutral` | `Printer` + text | `t.status.OutboundInstrumentStatus.PRINTED` | Printed | مطبوع |
| `OutboundInstrumentStatus` | `DELIVERED` | `pending` | `.dot-pending` + text | `t.status.OutboundInstrumentStatus.DELIVERED` | Delivered to payee | مسلَّم للمستفيد |
| `OutboundInstrumentStatus` | `PRESENTED` | `pending` | `.dot-pending` + text | `t.status.OutboundInstrumentStatus.PRESENTED` | Presented at bank | مقدَّم للصرف بالبنك |
| `OutboundInstrumentStatus` | `CLEARED` | `positive` | `CheckCircle2` + text | `t.status.OutboundInstrumentStatus.CLEARED` | Cleared | مصروف ومحصَّل |
| `OutboundInstrumentStatus` | `VOID` | `neutral` | `Ban` + `line-through` | `t.status.OutboundInstrumentStatus.VOID` | Voided | لاغٍ (ملغى قبل التسليم) |
| `OutboundInstrumentStatus` | `STOP_PAYMENT` | `caution` | `OctagonPause` + text | `t.status.OutboundInstrumentStatus.STOP_PAYMENT` | Stop-payment ordered | موقوف الصرف بأمر للبنك |
| `BounceReason` | `INSUFFICIENT_FUNDS` | `negative` | `AlertOctagon` + text | `t.status.BounceReason.INSUFFICIENT_FUNDS` | Insufficient funds | عدم كفاية الرصيد |
| `BounceReason` | `ACCOUNT_CLOSED` | `negative` | `Lock` + text | `t.status.BounceReason.ACCOUNT_CLOSED` | Bank account closed | الحساب البنكي مغلق |
| `BounceReason` | `SIGNATURE_MISMATCH` | `negative` | `PenOff` + text | `t.status.BounceReason.SIGNATURE_MISMATCH` | Signature mismatch | عدم مطابقة التوقيع |
| `BounceReason` | `STOPPED` | `caution` | `OctagonPause` + text | `t.status.BounceReason.STOPPED` | Payment stopped by drawer | أمر إيقاف صرف من الساحب |
| `BounceReason` | `STALE_DATED` | `caution` | `CalendarX2` + text | `t.status.BounceReason.STALE_DATED` | Stale-dated instrument | تقادم تاريخ الشيك |
| `BounceReason` | `POST_DATED` | `caution` | `CalendarClock` + text | `t.status.BounceReason.POST_DATED` | Presented before due date | مقدَّم قبل تاريخ الاستحقاق |
| `BounceReason` | `AMOUNT_MISMATCH` | `negative` | `Scale` + text | `t.status.BounceReason.AMOUNT_MISMATCH` | Words and figures differ | اختلاف المبلغ بالأرقام عن الحروف |
| `BounceReason` | `TECHNICAL` | `caution` | `Wrench` + text | `t.status.BounceReason.TECHNICAL` | Technical clearing defect | سبب شكلي/فني بالمقاصة |
| `ChequeBookStatus` | `ACTIVE` | `positive` | `BookOpenCheck` + text | `t.status.ChequeBookStatus.ACTIVE` | Active | نشط |
| `ChequeBookStatus` | `EXHAUSTED` | `neutral` | `Archive` + text | `t.status.ChequeBookStatus.EXHAUSTED` | Exhausted | مستنفد الأوراق |
| `ChequeBookStatus` | `CANCELLED` | `neutral` | `Ban` + `line-through` | `t.status.ChequeBookStatus.CANCELLED` | Cancelled | ملغى |
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

#### Group I — Fixed Assets and Accrual / Deferral Schedules (`01_Enums.md` §15)

| Enum | Member (exact) | Role Token | Non-Colour Cue | Dictionary Key | English Label | Arabic Label |
| --- | --- | --- | --- | --- | --- | --- |
| `AssetStatus` | `DRAFT` | `neutral` | `FileEdit` + text | `t.status.AssetStatus.DRAFT` | Draft | مسودة أصل |
| `AssetStatus` | `ACTIVE` | `positive` | `CheckCircle2` + text | `t.status.AssetStatus.ACTIVE` | Active (in service) | نشط بالخدمة |
| `AssetStatus` | `FULLY_DEPRECIATED` | `neutral` | `CheckCheck` + text | `t.status.AssetStatus.FULLY_DEPRECIATED` | Fully depreciated | مهلك بالكامل دفترياً |
| `AssetStatus` | `DISPOSED` | `neutral` | `Archive` + text | `t.status.AssetStatus.DISPOSED` | Disposed | مستبعد / مباع |
| `AssetTaxPoolStatus` | `OPEN` | `pending` | `.dot-pending` + text | `t.status.AssetTaxPoolStatus.OPEN` | Open | مفتوح للسنة |
| `AssetTaxPoolStatus` | `COMPUTED` | `caution` | `Calculator` + text | `t.status.AssetTaxPoolStatus.COMPUTED` | Computed | محتسَب الإهلاك الضريبي |
| `AssetTaxPoolStatus` | `FILED` | `positive` | `Lock` + text | `t.status.AssetTaxPoolStatus.FILED` | Filed & frozen | مقدَّم بالإقرار ومجمَّد |
| `ScheduleLineStatus` | `PLANNED` | `neutral` | `Calendar` + text | `t.status.ScheduleLineStatus.PLANNED` | Planned | مجدوَل |
| `ScheduleLineStatus` | `POSTED` | `positive` | `CheckCircle2` + text | `t.status.ScheduleLineStatus.POSTED` | Posted | مرحَّل |
| `ScheduleLineStatus` | `CANCELLED` | `neutral` | `Ban` + `line-through` | `t.status.ScheduleLineStatus.CANCELLED` | Cancelled | ملغى |
| `DeferralScheduleStatus` | `ACTIVE` | `positive` | `PlayCircle` + text | `t.status.DeferralScheduleStatus.ACTIVE` | Active | نشط |
| `DeferralScheduleStatus` | `COMPLETED` | `neutral` | `CheckCircle2` + text | `t.status.DeferralScheduleStatus.COMPLETED` | Completed | مكتمل الإطفاء |
| `DeferralScheduleStatus` | `CANCELLED` | `neutral` | `Ban` + `line-through` | `t.status.DeferralScheduleStatus.CANCELLED` | Cancelled | ملغى |

#### Group J — Period Close, Approvals, Reports, Exports, and Compliance Calendar (`01_Enums.md` §16)

| Enum | Member (exact) | Role Token | Non-Colour Cue | Dictionary Key | English Label | Arabic Label |
| --- | --- | --- | --- | --- | --- | --- |
| `CloseInstanceStatus` | `NOT_STARTED` | `neutral` | `Circle` + text | `t.status.CloseInstanceStatus.NOT_STARTED` | Not started | لم يبدأ |
| `CloseInstanceStatus` | `IN_PROGRESS` | `pending` | `.dot-pending` + text | `t.status.CloseInstanceStatus.IN_PROGRESS` | In progress | قيد الإقفال |
| `CloseInstanceStatus` | `COMPLETED` | `positive` | `CheckCircle2` + text *(pair with `hardClosed` pill if true)* | `t.status.CloseInstanceStatus.COMPLETED` | Completed | مكتمل |
| `CloseInstanceStatus` | `CANCELLED` | `neutral` | `Ban` + `line-through` | `t.status.CloseInstanceStatus.CANCELLED` | Cancelled | ملغى |
| `CloseTaskStatus` | `PENDING` | `neutral` | `Circle` + text | `t.status.CloseTaskStatus.PENDING` | Pending | بالانتظار |
| `CloseTaskStatus` | `BLOCKED` | `caution` | `AlertTriangle` + text | `t.status.CloseTaskStatus.BLOCKED` | Blocked by prerequisite | معلَّقة لشرط غير مستوفى |
| `CloseTaskStatus` | `RUNNING` | `pending` | `.dot-pending` + text | `t.status.CloseTaskStatus.RUNNING` | Running | قيد الفحص/التشغيل |
| `CloseTaskStatus` | `DONE` | `positive` | `CheckCircle2` + text | `t.status.CloseTaskStatus.DONE` | Done | مكتملة |
| `CloseTaskStatus` | `FAILED` | `negative` | `XCircle` + text | `t.status.CloseTaskStatus.FAILED` | Check failed | فشل التحقق |
| `CloseTaskStatus` | `SKIPPED` | `caution` | `SkipForward` + text *(manual reason)* | `t.status.CloseTaskStatus.SKIPPED` | Skipped with reason | تم تخطيها بمبرِّر |
| `CloseTaskStatus` | `NOT_APPLICABLE` | `neutral` | `Minus` + text | `t.status.CloseTaskStatus.NOT_APPLICABLE` | Not applicable | غير منطبقة على الفترة |
| `AccrualSupplyDecisionStatus` | `ACTIVE` | `positive` | `CheckCircle2` + text | `t.status.AccrualSupplyDecisionStatus.ACTIVE` | Active decision | قرار ساري المفعول |
| `AccrualSupplyDecisionStatus` | `VOIDED` | `neutral` | `Ban` + `line-through` | `t.status.AccrualSupplyDecisionStatus.VOIDED` | Voided | ملغى |
| `ApprovalRequestState` | `PENDING` | `pending` | `.dot-pending` + `border-dashed` | `t.status.ApprovalRequestState.PENDING` | Pending approval | بانتظار الاعتماد |
| `ApprovalRequestState` | `APPROVED` | `positive` | `CheckCircle2` + text | `t.status.ApprovalRequestState.APPROVED` | Approved | معتمد |
| `ApprovalRequestState` | `REJECTED` | `negative` | `XCircle` + text | `t.status.ApprovalRequestState.REJECTED` | Rejected | مرفوض |
| `ApprovalRequestState` | `CANCELLED` | `neutral` | `Ban` + `line-through` | `t.status.ApprovalRequestState.CANCELLED` | Cancelled | ملغى |
| `ApprovalRequestState` | `EXPIRED` | `caution` | `AlarmClockOff` + text | `t.status.ApprovalRequestState.EXPIRED` | Expired | منتهي الصلاحية |
| `ReportDefinitionStatus` | `DRAFT` | `neutral` | `FileEdit` + text | `t.status.ReportDefinitionStatus.DRAFT` | Draft | مسودة |
| `ReportDefinitionStatus` | `PUBLISHED` | `positive` | `CheckCircle2` + text | `t.status.ReportDefinitionStatus.PUBLISHED` | Published | منشور |
| `ReportDefinitionStatus` | `RETIRED` | `neutral` | `Archive` + text | `t.status.ReportDefinitionStatus.RETIRED` | Retired | متقاعد |
| `ReportRunStatus` | `QUEUED` | `pending` | `.dot-pending` + text | `t.status.ReportRunStatus.QUEUED` | Queued | في قائمة الانتظار |
| `ReportRunStatus` | `RUNNING` | `pending` | `.dot-pending` + text | `t.status.ReportRunStatus.RUNNING` | Generating report | جارٍ إعداد التقرير |
| `ReportRunStatus` | `COMPLETED` | `positive` | `CheckCircle2` + text | `t.status.ReportRunStatus.COMPLETED` | Ready | جاهز للعرض |
| `ReportRunStatus` | `FAILED` | `negative` | `XCircle` + text | `t.status.ReportRunStatus.FAILED` | Failed | فشل الإعداد |
| `ExportDefinitionStatus` | `DRAFT` | `neutral` | `FileEdit` + text | `t.status.ExportDefinitionStatus.DRAFT` | Draft | مسودة |
| `ExportDefinitionStatus` | `PUBLISHED` | `positive` | `CheckCircle2` + text | `t.status.ExportDefinitionStatus.PUBLISHED` | Published | منشور |
| `ExportDefinitionStatus` | `RETIRED` | `neutral` | `Archive` + text | `t.status.ExportDefinitionStatus.RETIRED` | Retired | متقاعد |
| `ExportRunStatus` | `QUEUED` | `pending` | `.dot-pending` + text | `t.status.ExportRunStatus.QUEUED` | Queued | في قائمة الانتظار |
| `ExportRunStatus` | `RUNNING` | `pending` | `.dot-pending` + text | `t.status.ExportRunStatus.RUNNING` | Exporting | جارٍ التصدير |
| `ExportRunStatus` | `COMPLETED` | `positive` | `Download` + text | `t.status.ExportRunStatus.COMPLETED` | Export ready | جاهز للتنزيل |
| `ExportRunStatus` | `FAILED` | `negative` | `XCircle` + text | `t.status.ExportRunStatus.FAILED` | Export failed | فشل التصدير |
| `ComplianceItemStatus` | `OPEN` | `pending` | `.dot-pending` + text | `t.status.ComplianceItemStatus.OPEN` | Upcoming / open | مستحق قادم |
| `ComplianceItemStatus` | `DONE` | `positive` | `CheckCircle2` + text | `t.status.ComplianceItemStatus.DONE` | Satisfied | مستوفى |
| `ComplianceItemStatus` | `OVERDUE` | `negative` | `AlarmClockOff` + text | `t.status.ComplianceItemStatus.OVERDUE` | Overdue | متأخر عن الموعد القانوني |
| `ComplianceItemStatus` | `DISMISSED` | `neutral` | `EyeOff` + text | `t.status.ComplianceItemStatus.DISMISSED` | Reminder dismissed | تم إخفاء التنبيه |
| `ComplianceSeverity` | `INFO` | `neutral` | `Info` + text | `t.status.ComplianceSeverity.INFO` | Informational | إرشادي |
| `ComplianceSeverity` | `WARNING` | `caution` | `AlertTriangle` + text | `t.status.ComplianceSeverity.WARNING` | Warning | تحذير |
| `ComplianceSeverity` | `CRITICAL` | `negative` | `AlertOctagon` + text | `t.status.ComplianceSeverity.CRITICAL` | Critical obligation | التزام قانوني حرج |

#### Group K — Imports, Bulk Operations, Inbox Reliability, Country Packs, Valuation, Integrity, Exit Packages, and Platform Archive (`01_Enums.md` §17 + `D-079`)

| Enum | Member (exact) | Role Token | Non-Colour Cue | Dictionary Key | English Label | Arabic Label |
| --- | --- | --- | --- | --- | --- | --- |
| `ImportJobStatus` | `QUEUED` | `pending` | `.dot-pending` + text | `t.status.ImportJobStatus.QUEUED` | Queued | في قائمة الانتظار |
| `ImportJobStatus` | `VALIDATING` | `pending` | `.dot-pending` + text | `t.status.ImportJobStatus.VALIDATING` | Validating rows | جارٍ فحص الصفوف |
| `ImportJobStatus` | `DRY_RUN_COMPLETED` | `caution` | `FileCheck` + text *(awaiting commit)* | `t.status.ImportJobStatus.DRY_RUN_COMPLETED` | Dry-run passed (awaiting commit) | نجح الفحص التجريبي (بانتظار الاعتماد) |
| `ImportJobStatus` | `APPLYING` | `pending` | `.dot-pending` + text | `t.status.ImportJobStatus.APPLYING` | Committing import | جارٍ تطبيق الاستيراد |
| `ImportJobStatus` | `COMPLETED` | `positive` | `CheckCircle2` + text | `t.status.ImportJobStatus.COMPLETED` | Completed | مكتمل |
| `ImportJobStatus` | `FAILED` | `negative` | `XCircle` + text | `t.status.ImportJobStatus.FAILED` | Failed | فشل الاستيراد |
| `ImportJobStatus` | `CANCELLED` | `neutral` | `Ban` + `line-through` | `t.status.ImportJobStatus.CANCELLED` | Cancelled | ملغى |
| `ImportJobStatus` | `PARTIALLY_APPLIED` | `caution` | `AlertTriangle` + text *(Wave 2 payroll)* | `t.status.ImportJobStatus.PARTIALLY_APPLIED` | Partially applied | مطبَّق جزئياً |
| `ImportJobStatus` | `REVERSED` | `neutral` | `RotateCcw` + text *(Wave 2 payroll)* | `t.status.ImportJobStatus.REVERSED` | Reversed | معكوس |
| `BulkOperationStatus` | `QUEUED` | `pending` | `.dot-pending` + text | `t.status.BulkOperationStatus.QUEUED` | Queued | في قائمة الانتظار |
| `BulkOperationStatus` | `RUNNING` | `pending` | `.dot-pending` + text | `t.status.BulkOperationStatus.RUNNING` | Running | قيد التنفيذ |
| `BulkOperationStatus` | `PARTIAL` | `caution` | `AlertTriangle` + text | `t.status.BulkOperationStatus.PARTIAL` | Partially completed | مكتمل جزئياً (بأخطاء فرعية) |
| `BulkOperationStatus` | `COMPLETED` | `positive` | `CheckCircle2` + text | `t.status.BulkOperationStatus.COMPLETED` | Completed | مكتمل بالكامل |
| `BulkOperationStatus` | `FAILED` | `negative` | `XCircle` + text | `t.status.BulkOperationStatus.FAILED` | Failed | فشل التنفيذ |
| `InboxEventStatus` | `RECEIVED` | `pending` | `.dot-pending` + text | `t.status.InboxEventStatus.RECEIVED` | Received | مستلم |
| `InboxEventStatus` | `PROCESSED` | `positive` | `CheckCircle2` + text | `t.status.InboxEventStatus.PROCESSED` | Processed | تمت المعالجة |
| `InboxEventStatus` | `PARKED` | `caution` | `PauseCircle` + text | `t.status.InboxEventStatus.PARKED` | Parked | معلَّق لحين زوال السبب |
| `InboxEventStatus` | `FAILED` | `negative` | `AlertTriangle` + text *(retrying)* | `t.status.InboxEventStatus.FAILED` | Failed | فشل المعالجة |
| `InboxEventStatus` | `DEAD` | `negative` | `Skull` / `AlertOctagon` + text | `t.status.InboxEventStatus.DEAD` | Dead-lettered | متوقف نهائياً (يتطلب تدخلاً) |
| `InboxParkReason` | `OUT_OF_ORDER` | `caution` | `ListOrdered` + text | `t.status.InboxParkReason.OUT_OF_ORDER` | Waiting for earlier sequence | بانتظار حدث سابق بالترتيب |
| `InboxParkReason` | `UNKNOWN_ENUM` | `negative` | `FileQuestion` + text | `t.status.InboxParkReason.UNKNOWN_ENUM` | Unrecognized contract code | قيمة عقد غير معروفة |
| `InboxParkReason` | `DEPENDENCY_MISSING` | `caution` | `Unlink` + text | `t.status.InboxParkReason.DEPENDENCY_MISSING` | Prerequisite dependency missing | سجل مرجعي/اعتماد مفقود |
| `InboxParkReason` | `SOURCE_VERSION_TOO_OLD` | `caution` | `History` + text | `t.status.InboxParkReason.SOURCE_VERSION_TOO_OLD` | Source app below contract floor | إصدار التطبيق المصدر أقدم من الحد الأدنى |
| `InboxParkReason` | `REFERENCE_NOT_CORRECTABLE` | `negative` | `Ban` + text | `t.status.InboxParkReason.REFERENCE_NOT_CORRECTABLE` | Target receipt not correctable | الإيصال المرجعي غير قابل للتصحيح |
| `InboxParkReason` | `POSTING_EXCEPTION` | `caution` | `AlertTriangle` + text | `t.status.InboxParkReason.POSTING_EXCEPTION` | Held by open posting exception | محتجز باستثناء ترحيل مفتوح |
| `InboxParkReason` | `RECOVERY_MODE` | `caution` | `DatabaseBackup` + text | `t.status.InboxParkReason.RECOVERY_MODE` | Held during recovery mode | محتجز مؤقتاً لوضع الاستعادة |
| `IdempotencyStatus` | `IN_PROGRESS` | `pending` | `.dot-pending` + text | `t.status.IdempotencyStatus.IN_PROGRESS` | In progress | قيد التنفيذ |
| `IdempotencyStatus` | `COMPLETED` | `positive` | `CheckCircle2` + text | `t.status.IdempotencyStatus.COMPLETED` | Completed | مكتمل |
| `IdempotencyStatus` | `FAILED` | `negative` | `XCircle` + text | `t.status.IdempotencyStatus.FAILED` | Failed (retryable) | فشل (قابل لإعادة المحاولة) |
| `CountryPackStatus` | `DRAFT` | `neutral` | `FileEdit` + text | `t.status.CountryPackStatus.DRAFT` | Draft | مسودة |
| `CountryPackStatus` | `PUBLISHED` | `positive` | `CheckCircle2` + text | `t.status.CountryPackStatus.PUBLISHED` | Published | منشورة |
| `CountryPackStatus` | `DEPRECATED` | `caution` | `Archive` + text | `t.status.CountryPackStatus.DEPRECATED` | Deprecated | متقادمة |
| `ValuationRunStatus` | `QUEUED` | `pending` | `.dot-pending` + text | `t.status.ValuationRunStatus.QUEUED` | Queued | في قائمة الانتظار |
| `ValuationRunStatus` | `RUNNING` | `pending` | `.dot-pending` + text | `t.status.ValuationRunStatus.RUNNING` | Valuing inventory | جارٍ تقييم المخزون |
| `ValuationRunStatus` | `COMPLETED` | `positive` | `CheckCircle2` + text | `t.status.ValuationRunStatus.COMPLETED` | Completed | مكتمل |
| `ValuationRunStatus` | `FAILED` | `negative` | `XCircle` + text | `t.status.ValuationRunStatus.FAILED` | Failed | فشل التقييم |
| `InventoryReconciliationRunStatus` | `MATCHED` | `positive` | `CheckCircle2` + text | `t.status.InventoryReconciliationRunStatus.MATCHED` | Matched | متطابق مع الأستاذ العام |
| `InventoryReconciliationRunStatus` | `DIFFERENCES` | `caution` | `AlertTriangle` + text | `t.status.InventoryReconciliationRunStatus.DIFFERENCES` | Differences found | توجد فروق مطابقة |
| `InventoryReconciliationRunStatus` | `FAILED` | `negative` | `XCircle` + text | `t.status.InventoryReconciliationRunStatus.FAILED` | Check failed | تعذَّر تشغيل المطابقة |
| `IntegrityCheckStatus` | `PASSED` | `positive` | `ShieldCheck` + text | `t.status.IntegrityCheckStatus.PASSED` | Passed | سليم ومتطابق |
| `IntegrityCheckStatus` | `FAILED` | `negative` | `ShieldAlert` + text | `t.status.IntegrityCheckStatus.FAILED` | Integrity failure | خلل في التطابق/السلامة |
| `IntegrityCheckStatus` | `ERROR` | `caution` | `AlertTriangle` + text | `t.status.IntegrityCheckStatus.ERROR` | Monitor error | خطأ تشغيلي أثناء الفحص |
| `ExitPackageStatus` | `REQUESTED` | `pending` | `.dot-pending` + text | `t.status.ExitPackageStatus.REQUESTED` | Requested | مطلوب الإصدار |
| `ExitPackageStatus` | `GENERATING` | `pending` | `.dot-pending` + text | `t.status.ExitPackageStatus.GENERATING` | Generating archive | جارٍ تجهيز حزمة الخروج |
| `ExitPackageStatus` | `COMPLETED` | `positive` | `PackageCheck` + text | `t.status.ExitPackageStatus.COMPLETED` | Ready for download | جاهزة للتنزيل |
| `ExitPackageStatus` | `FAILED` | `negative` | `XCircle` + text | `t.status.ExitPackageStatus.FAILED` | Generation failed | فشل التجهيز |
| `ExitPackageStatus` | `EXPIRED` | `neutral` | `AlarmClockOff` + text | `t.status.ExitPackageStatus.EXPIRED` | Download link expired | انتهت صلاحية رابط التنزيل |
| `ValidationRuleAction` | `BLOCK` | `negative` | `OctagonPause` + text | `t.status.ValidationRuleAction.BLOCK` | Block posting | منع الترحيل |
| `ValidationRuleAction` | `WARN` | `caution` | `AlertTriangle` + text | `t.status.ValidationRuleAction.WARN` | Warn only | تنبيه دون منع |
| `TenantStatus` *(Core `D-079` addition)* | `ARCHIVED` | `neutral` | `Archive` + `Lock` *(retention read-only)* | `t.status.TenantStatus.ARCHIVED` *(+ `t.statusValues["TenantStatus.ARCHIVED"]`)* | Archived (retention read-only) | مؤرشف (قراءة فقط لفترة الحفظ القانوني) |

---

### 1.6 Post-MVP Wave-Reserved Status Enums in `01_Enums.md` and Neutral Configuration Enums

1. **Wave-reserved status enums already exported by `@mutakamel/accounting-app-common` (`01_Enums.md` §5, §11, §14–§17):**
   Although no MVP screen renders these Wave 1–3 entities (`accounting-ia.md` §3 hides unentitled sections completely), `@mutakamel/accounting-app-common` exports their TypeScript enums from release `0.0.1`. Whenever a shared `StatusKind` map imports them, their roles and `t.status.<Enum>.<MEMBER>` keys are pre-assigned so nobody invents ad-hoc hues later:
   - **`BudgetVersionStatus` *(Wave 1)*:** `DRAFT` (`neutral`, `مسودة` / `Draft`), `APPROVED` (`caution`, `معتمدة` / `Approved`), `ACTIVE` (`positive`, `نشطة` / `Active`), `ARCHIVED` (`neutral`, `مؤرشفة` / `Archived`).
   - **`PaymentProviderConnectionStatus` *(Wave 1)*:** `NOT_CONNECTED` (`neutral`, `غير متصل` / `Not connected`), `PREPROD_VERIFIED` (`caution`, `مفعَّل تجريبياً` / `Pre-production verified`), `PRODUCTION` (`positive`, `متصل فعلياً` / `Production`), `SUSPENDED` (`negative`, `موقوف` / `Suspended`).
   - **`PaymentLinkStatus` *(Wave 1)*:** `CREATED` (`neutral`, `تم إنشاؤه` / `Created`), `SENT` (`pending`, `مُرسَل` / `Sent`), `VIEWED` (`pending`, `تم استعراضه` / `Viewed`), `PAID` (`positive`, `مدفوع` / `Paid`), `EXPIRED` (`caution`, `منتهي الصلاحية` / `Expired`), `CANCELLED` (`neutral`, `ملغى` / `Cancelled`).
   - **`ProviderSettlementStatus` *(Wave 1)*:** `IMPORTED` (`caution`, `مستورَد` / `Imported`), `MATCHED` (`positive`, `مطابق` / `Matched`), `POSTED` (`positive`, `مرحَّل` / `Posted`), `DISPUTED` (`caution`, `محل نزاع` / `Disputed`).
   - **`TreasuryInstrumentStatus` *(Wave 2/3)*:** `DRAFT` (`neutral`, `مسودة` / `Draft`), `ACTIVE` (`positive`, `نشط` / `Active`), `MATURED` (`caution`, `مستحق الأجل` / `Matured`), `SETTLED` (`positive`, `مسدَّد` / `Settled`), `CANCELLED` (`neutral`, `ملغى` / `Cancelled`).
   - **`DirectDebitMandateStatus` *(Wave 2)*:** `DRAFT` (`neutral`, `مسودة` / `Draft`), `ACTIVE` (`positive`, `نشط` / `Active`), `SUSPENDED` (`caution`, `معلَّق` / `Suspended`), `REVOKED` (`negative`, `ملغى التفويض` / `Revoked`), `EXPIRED` (`neutral`, `منتهي الصلاحية` / `Expired`).
   - **`PositivePayExportStatus` *(Wave 2)*:** `GENERATED` (`caution`, `تم إصداره` / `Generated`), `SENT` (`pending`, `مُرسَل للبنك` / `Sent`), `ACKNOWLEDGED` (`positive`, `مؤكد من البنك` / `Acknowledged`), `REJECTED` (`negative`, `مرفوض من البنك` / `Rejected`).
   - **`StoredValueStatus` *(Wave 2)*:** `ACTIVE` (`positive`, `نشط` / `Active`), `BLOCKED` (`negative`, `محظور` / `Blocked`), `REDEEMED` (`neutral`, `مستبدل بالكامل` / `Redeemed`), `EXPIRED` (`neutral`, `منتهي الصلاحية` / `Expired`), `VOID` (`neutral`, `ملغى ومردود` / `Void`).
   - **`BillingScheduleStatus` *(Wave 2)*:** `DRAFT` (`neutral`, `مسودة` / `Draft`), `ACTIVE` (`positive`, `نشط` / `Active`), `PAUSED` (`caution`, `متوقف مؤقتاً` / `Paused`), `ENDED` (`neutral`, `منتهٍ` / `Ended`), `CANCELLED` (`neutral`, `ملغى` / `Cancelled`).
   - **`IncentiveAccrualStatus` *(Wave 2)*:** `PROPOSED` (`pending`, `مقترح` / `Proposed`), `POSTED` (`positive`, `مرحَّل` / `Posted`), `SETTLED` (`positive`, `مسوّى` / `Settled`), `REVERSED` (`neutral`, `معكوس` / `Reversed`).
   - **`ProvisionStatus` *(Wave 2)*:** `ACTIVE` (`positive`, `مخصَّص قائم` / `Active`), `SETTLED` (`neutral`, `مسوّى` / `Settled`), `REVERSED` (`neutral`, `معكوس` / `Reversed`).
   - **`SodSeverity` *(Wave 2)*:** `WARN` (`caution`, `تحذير تعارض` / `Warning`), `BLOCK` (`negative`, `منع تعارض صلاحيات` / `Blocking`).
   - **`SodFindingStatus` *(Wave 2)*:** `OPEN` (`caution`, `مفتوح` / `Open`), `OVERRIDDEN` (`caution`, `متجاوَز باستثناء معتمد` / `Overridden`), `RESOLVED` (`positive`, `تم الحل` / `Resolved`).
   - **`CertificationStatus` *(Wave 2)*:** `PENDING` (`pending`, `بانتظار الإعداد` / `Pending`), `PREPARED` (`caution`, `مُعَد بانتظار التصديق` / `Prepared`), `CERTIFIED` (`positive`, `مصدَّق` / `Certified`), `REJECTED` (`negative`, `مرفوض` / `Rejected`).
   - **`ExternalAccessConsentStatus` *(Wave 2)*:** `ACTIVE` (`positive`, `نشط` / `Active`), `EXPIRED` (`neutral`, `منتهي الصلاحية` / `Expired`), `REVOKED` (`negative`, `ملغى` / `Revoked`).
   - **`AucSettlementStatus` *(Wave 3)*:** `DRAFT` (`neutral`, `مسودة` / `Draft`), `POSTED` (`positive`, `مرحَّل` / `Posted`), `CANCELLED` (`neutral`, `ملغى` / `Cancelled`).
   - **`LeaseContractStatus` *(Wave 3)*:** `DRAFT` (`neutral`, `مسودة` / `Draft`), `ACTIVE` (`positive`, `ساري` / `Active`), `MODIFIED` (`caution`, `معدَّل ومُعاد قياسه` / `Modified`), `TERMINATED` (`neutral`, `منهى` / `Terminated`), `EXPIRED` (`neutral`, `منتهي المدة` / `Expired`).
   - **`ProjectContractStatus` *(Wave 3)*:** `DRAFT` (`neutral`, `مسودة` / `Draft`), `ACTIVE` (`positive`, `نشط` / `Active`), `SUSPENDED` (`caution`, `موقوف مؤقتاً` / `Suspended`), `COMPLETED` (`positive`, `مكتمل` / `Completed`), `CANCELLED` (`neutral`, `ملغى` / `Cancelled`).
   - **`AssetCountStatus` *(Wave 3)*:** `DRAFT` (`neutral`, `مسودة` / `Draft`), `COUNTING` (`pending`, `جرد جاري` / `Counting`), `REVIEW` (`caution`, `قيد المراجعة` / `In review`), `PENDING_APPROVAL` (`pending`, `بانتظار الاعتماد` / `Pending approval`), `APPROVED` (`positive`, `معتمد` / `Approved`), `POSTED` (`positive`, `مرحَّل` / `Posted`), `CANCELLED` (`neutral`, `ملغى` / `Cancelled`).
   - **`AssetCountOutcome` *(Wave 3)*:** `EXPECTED` (`pending`, `متوقع جرده` / `Expected`), `FOUND` (`positive`, `موجود` / `Found`), `MISSING` (`negative`, `مفقود` / `Missing`), `UNREGISTERED` (`caution`, `غير مسجل بالسجل` / `Unregistered`), `RELOCATED` (`caution`, `بموقع مختلف` / `Relocated`).
   - **`WebhookSubscriptionStatus` *(Wave 3)*:** `DRAFT` (`neutral`, `مسودة` / `Draft`), `ACTIVE` (`positive`, `نشط` / `Active`), `DISABLED` (`caution`, `معطَّل` / `Disabled`).

2. **Structural and configuration enums stay neutral (`ink` / plain text):**
   Following `docs/design/tokens.md` (§"Structured category & entity palettes vs generic enums"), structural/configuration enums in `01_Enums.md` (`AccountingScopeTarget`, `LedgerKind`, `CalendarType`, `PeriodPattern`, `PeriodModule`, `LegalForm`, `TaxRegime`, `AccountType`, `AccountSubtype`, `NormalBalance`, `ControlAccountKind`, `CashFlowCategory`, `AccountRole`, `DimensionCode`, `JournalType`, `SequenceResetPolicy`, `FxRateType`, `FxRateSource`, `TaxKind`, `TaxDirection`, `PartyTaxClassification`, `SupplyType`, `PlaceOfSupplyBasis`, `ExemptionKind`, `ReverseChargeMechanism`, `InputTaxRecoveryMethod`, `DocumentDirection`, `DocumentKind`, `EinvoiceProfile`, `SigningMode`, `TreasuryKind`, `NegotiableInstrumentKind`, `SubledgerSide`, `AssetKind`, `AssetBookCode`, `DepreciationMethod`, `ClosingType`, `CloseTaskKind`, `ApprovalDocumentType`, `ReportingFrameworkCode`, `StatementKind`, `ExportFormat`, `ComplianceCalendarKind`, `SourceApp`, `ImportEntity`, `MigrationPreset`, `DataClassification`, `CountryPackKind`, `BulkOperationKind`, `OpeningBalanceBatchKind`, `OpeningBalanceLineKind`, `ExitPackageKind`, etc.) are **never** coloured with outcome hues (`positive`, `caution`, `negative`). They render as translated plain text or `Badge tone="neutral"` via `t.status.<EnumName>.<MEMBER>` (or `t.accounting.enums.<EnumName>.<MEMBER>`), except where `DataClassification.SENSITIVE_PERSONAL` / `FINANCIAL_SENSITIVE` shows a static `Lock` icon cue on privacy metadata.

---

## 2. S2 — Debit, Credit, and Negative-Amount Cues Without Colour

Accounting is used all day by bookkeepers, chief accountants, and auditors across both LTR (`en`) and RTL (`ar`). Encoding debit vs credit or positive vs negative balances by green/red text alone fails colour-blind operators, reverses intuition across asset vs liability accounts (a credit increases revenue and payables while decreasing cash), and collapses in monochrome printouts (`src/app/globals.css` `@media print`).

### 2.1 Four Mandatory Non-Colour Mechanisms

Every Accounting surface combines **column position**, **explicit localized side label**, **directionally isolated sign**, and **reversal/storno tagging** — never hue alone:

| Surface Class | Primary Non-Colour Cue | Secondary Cue | Forbidden Pattern |
| --- | --- | --- | --- |
| **1. Journal, General Ledger, Subledger & Trial Balance Grids** (`SCR-05`, `SCR-06`, `SCR-09`, `SCR-12`) | **Two separate unsigned positional columns:** `Debit` (`مدين`) followed in reading order by `Credit` (`دائن`). Each line populates one column; the unused side renders an em-dash `—` (`text-muted-foreground`, `aria-label={t.accounting.direction.zeroSide}`) in read-only grids or a blank placeholder `0.00` in editable cells. | Column header carries localized text (`t.accounting.columns.debit` = `Debit` / `مدين`, `t.accounting.columns.credit` = `Credit` / `دائن`) and footer `<tfoot>` carries server-computed `Total Debit` and `Total Credit` cells. | Collapsing debit and credit into a single `+ / -` or green/red `Amount` column; leaving the empty opposite column completely blank with no `—` anchor. |
| **2. Single-Column Net Balances** (Account picker balance preview, Trial Balance net column, Party Ledger running balance, KPI tiles, Aging summary headers) | **Explicit localized side suffix/pill** adjacent to `<Money>`: `Dr` / `Cr` in English (`t.accounting.balanceSide.DEBIT` = `"Dr"`, `CREDIT` = `"Cr"`), `مدين` / `دائن` in Arabic (`"مدين"`, `"دائن"`), rendered in `Badge tone="neutral"` or `text-xs font-medium text-muted-foreground ms-1.5`. Zero balance (`"0.00"`) omits `Dr`/`Cr` and renders `—` or `0.00` without side tag. | When an account's net side contradicts its `NormalBalance` (`01_Enums.md` §3 — e.g. a `NormalBalance.DEBIT` cash/receivable account carrying a net `CREDIT` balance), append `AlertTriangle` + `t.accounting.balanceSide.abnormal` (`Abnormal Cr` / `رصيد دائن شاذ`) in `Badge tone="caution"`. | Colouring `Dr` green and `Cr` red; using accounting parentheses `(1,250.00)` as the sole credit/negative indicator (parentheses are ambiguous between "credit normal balance" and "loss/deficit"). |
| **3. Reversals: `SWAP_SIDES` vs `STORNO`** (`01_Enums.md` §3 `ReversalMethod`; `02_Ledger_Tables.md` `is_storno`, `D-013`, `D-219`) | **`SWAP_SIDES`:** Positive `DecimalString` placed in the opposite column (`DEBIT <-> CREDIT`), entry row tagged with `EntryKind` (`REVERSAL` / `CANCELLATION` / `ACCRUAL_REVERSAL`) + `RotateCcw` icon.<br>**`STORNO` (`line.isStorno === true`):** Negative `DecimalString` (`"-1500.00"`) stays in the **original** `DEBIT` or `CREDIT` column so period debit/credit turnover is not inflated (`D-013`). Rendered via `<Money value="-1500.00" />` (`<bdi dir="ltr">-1,500.00</bdi>`) **plus** an explicit inline `[Storno]` / `[ستورنو]` neutral micro-badge (`RotateCcw` icon + `t.accounting.stornoTag`). | Clicking the reversal badge navigates to `reversesEntryId` (`#JE-...` in `<IdentifierText>`). | Stripping `-` via `Math.abs()`, auto-moving a `STORNO` negative debit into the Credit column in the UI, or painting negative storno numbers red without the `[Storno]` / `[ستورنو]` tag. |
| **4. Credit Notes, Unapplied Credits, and Variances** (`SCR-17`, `SCR-23`, `SCR-26`, `SCR-15`) | **Credit notes / return receipts:** `DocumentKind` badge (`CREDIT_NOTE` = `Credit note` / `إشعار دائن`; `RETURN_RECEIPT` = `Return receipt` / `إيصال مرتجع`) + explicit `-` sign inside `<bdi dir="ltr">` when netted in subledger aging.<br>**Variances / differences** (journal editor out-of-balance bar, bank reconciliation difference, POS cash shortage/overage): explicit `+` / `-` sign inside `<bdi dir="ltr">` **plus** directional prose (`t.accounting.variance.debitExceedsCredit`, `t.accounting.variance.shortage` = `Shortage` / `عجز`, `t.accounting.variance.overage` = `Overage` / `فائض`). | `caution` or `negative` tint/icon (`Scale`, `AlertTriangle`) reinforces an unresolved variance, never replaces the wording. | Showing a bare signed or unsigned number under `"Difference"` without naming which side is higher (`Dr > Cr` vs `Cr > Dr`, `Book > Bank` vs `Bank > Book`). |

### 2.2 Bidirectional Rendering Matrix (`en` LTR vs `ar` RTL)

In HTML `<table>` layout, column order automatically follows document `dir` (`ltr` flows left-to-right; `rtl` flows right-to-left). Therefore, declaring columns in logical order `[Line #, Account, Debit, Credit, Running Balance]` produces the natural accounting book layout in **both** languages without any conditional column-reordering code:

| Aspect | English (`html[lang="en"][dir="ltr"]`) | Arabic (`html[lang="ar"][dir="rtl"]`) | Why It Works Without Colour |
| --- | --- | --- | --- |
| **Visual column order (left -> right on screen)** | `#` \| `Account` \| `Debit` \| `Credit` \| `Balance` | `الرصيد` \| `دائن` \| `مدين` \| `الحساب` \| `#` *(read right -> left: `#` -> `الحساب` -> `مدين` -> `دائن` -> `الرصيد`)* | `Debit` (`مدين`) is always the **first** amount column encountered in the reader's scan direction; `Credit` (`دائن`) is always the **second**. |
| **Cell text alignment (`align: "end"` -> `text-end`)** | Aligns to the **right** cell edge | Aligns to the **left** cell edge (trailing edge in RTL) | Decimal points of Western-digit numbers align vertically down every column; `<th className="text-end">` matches `<td className="text-end">` so header and digits share the exact same anchor edge. |
| **Ordinary Debit line (`1250.50` `EGP`)** | Debit: `<bdi>1,250.50</bdi>` · Credit: `—` | `مدين`: `<bdi>1,250.50</bdi>` · `دائن`: `—` | Column placement + `—` on opposite side carries 100% of the meaning in monochrome. |
| **Storno Debit line (`isStorno: true`, `"-1250.50"` `EGP`)** | Debit: `[Storno] <bdi>-1,250.50</bdi>` · Credit: `—` | `مدين`: `[ستورنو] <bdi>-1,250.50</bdi>` · `دائن`: `—` | `<bdi>` keeps `-` pinned to the left of `1,250.50` in RTL (never migrating to `1,250.50-`), and `[ستورنو]` explains why a Debit cell is negative (`D-013`). |
| **Running balance cell (`"4800.00"`, side `CREDIT`)** | `<bdi>4,800.00</bdi> Cr` | `<bdi>4,800.00</bdi> دائن` | `<bdi>` isolates the Latin-digit number from the trailing Arabic word `دائن`, preventing bidi reordering between digits, punctuation, and Arabic letters. |

---

## 3. S3 — Token Collision Rule and Computed-Style Verification

### 3.1 Why Tailwind CSS v4 Token Collisions Happen Silently

In Tailwind CSS v4 (`src/app/globals.css`), a single utility prefix maps multiple CSS custom-property namespaces declared across `@theme` and `@theme inline`:

| Tailwind Utility Prefix | Intended Non-Colour Theme Token | Competing Colour Theme Token | Silent Failure Mode When Stems Match |
| --- | --- | --- | --- |
| `text-<stem>` | `--text-<stem>` (`font-size` + `--text-<stem>--line-height` + `--text-<stem>--letter-spacing`) | `--color-<stem>` (`color`) | **`--color-<stem>` wins silently.** Writing `className="text-nav"` applies `color: var(--nav)` and **drops `font-size` completely**, with zero build, PostCSS, or ESLint error. *(Recorded precedent: `globals.css` line 281 & `tokens.md` line 539 renamed `--text-nav` -> `--text-tab` because `--color-nav` exists at `globals.css` line 1143; `--text-card-title` at line 285 avoided `--color-card` at line 1068.)* |
| `shadow-<stem>` | `--shadow-<stem>` (`box-shadow`) | `--color-<stem>` (`--tw-shadow-color`) | Writing `shadow-<stem>` where `--shadow-<stem>` was omitted from `@theme inline`—or where `<stem>` matches a `--color-<stem>` token—either paints a shadow colour override on no shadow or renders **completely flat** (`globals.css` line 1247). |
| `rounded-<stem>` | `--radius-<stem>` (`border-radius`) | *(none directly, but collides with Tailwind size keywords `xs..3xl`, `full`, `none`)* | Overriding an existing `--radius-*` step alters all primitives (`Button`, `Input`, `Dialog`) sharing that step; forgetting `@theme` registration makes `rounded-<stem>` emit zero CSS. |
| `border-<stem>` | *(width / style tokens)* | `--color-<stem>` (`border-color`) | A custom `--border-width-<stem>` sharing `<stem>` with `--color-<stem>` resolves to `border-color` instead of `border-width`. |

### 3.2 Mandatory Pre-Addition Search Protocol for `src/app/globals.css`

> **Default rule for Accounting (`P03`–`P29`):** **Accounting introduces zero new `--color-*`, `--text-*`, `--shadow-*`, or `--radius-*` tokens.** Every Accounting screen, ledger grid, journal editor, and statement viewer consumes the existing design-system tokens in `src/app/globals.css`.

If a future design-system revision ever proposes adding `--text-<X>`, `--shadow-<X>`, or `--radius-<X>`, the author **must execute all four checks before editing `src/app/globals.css`**:

1. **Search `src/app/globals.css` across every token zone for `<X>`:**
   - Zone 2 (`@theme` ramps, type steps, radii): check `--color-<X>`, `--color-<X>-*`, `--text-<X>`, `--radius-<X>`.
   - Zone 3 (`:root` and `.dark` semantic variables): check `--<X>` and `--<X>-*`.
   - Zone 4 (`@theme inline` semantic bridges): check `--color-<X>`, `--color-<X>-*`, `--shadow-<X>`.
   - Zone 5 (The theme flip): check all 22 stock Tailwind palette overrides (`slate`, `gray`, `zinc`, `neutral`, `stone`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `emerald`, `teal`, `cyan`, `sky`, `blue`, `indigo`, `violet`, `purple`, `fuchsia`, `pink`, `rose`) plus CSS keywords (`inherit`, `current`, `transparent`, `black`, `white`).
2. **Occupied `--color-*` stems in `src/app/globals.css` that are permanently off-limits for `--text-<X>` and `--shadow-<X>`:**
   - **Role & chrome ramps:** `brand`, `chrome`, `positive`, `caution`, `negative`, `ink`, `accent`, `aqua`, `ember`, `navy`, `action`, `success`, `warn`, `danger`, `surface`, `channel-*`, `swatch-*`.
   - **Bridged semantic stems (`@theme inline`):** `background`, `foreground`, `foreground-secondary`, `canvas`, `card` *(note: `--text-card` is forbidden; use `--text-card-title`)*, `popover`, `surface-column`, `surface-column-header`, `surface-toolbar`, `surface-subtle`, `surface-selected`, `control-border`, `line-column`, `line-card`, `line-control`, `line-divider`, `primary`, `secondary`, `muted`, `selected`, `info`, `warning`, `destructive`, `border`, `input`, `ring`, `row-zebra`, `chart-*`, `sidebar*`, `nav*` *(why `--text-nav` is forbidden)*, `activity-*`, `star-*`, `kpi-*`, `entity-*`, `count-*`, `chip-*`.
3. **Suffix disambiguation convention:**
   - Any new typography step must carry a role-specific compound noun that cannot name a colour (e.g. `--text-ledger-numeral` or `--text-statement-total`, **never** `--text-muted`, `--text-primary`, `--text-card`, `--text-sidebar`, `--text-nav`, or `--text-info`).
   - Any new elevation token must declare `--elevation-<name>` in `:root` and `.dark` and bridge `--shadow-<name>: var(--elevation-<name>)` in `@theme inline` using a surface-elevation stem distinct from colour tokens.

### 3.3 Verification-Time Computed-Style and Contrast Gate

Static regex checks alone cannot prove what Tailwind v4 emitted into CSS. Every PR that touches `src/app/globals.css` or introduces a new token utility must pass two verification-time checks:

1. **`pnpm design:contrast` (`scripts/design/contrast.mjs`):** Parses both `:root` and `.dark` in `src/app/globals.css`, verifies sRGB gamut bounds, and asserts `>= 4.5:1` text contrast and `>= 3:1` non-text contrast across every semantic pair.
2. **Computed-style assertion (`getComputedStyle` in component/Playwright verification):** Render a probe element carrying each added `text-<X>`, `shadow-<X>`, and `rounded-<X>` utility in **both** light (`:root`) and dark (`.dark`) themes and assert:
   - For `text-<X>`: `getComputedStyle(el).fontSize` equals the expected pixel size (both `html[lang="en"]` and lifted `html[lang="ar"]`) **and** `getComputedStyle(el).color` equals the inherited `--foreground` (proving `text-<X>` did **not** silently overwrite `color` with a `--color-<X>` token!).
   - For `shadow-<X>`: `getComputedStyle(el).boxShadow !== "none"` in `:root` and equals the expected `inset 0 1px 0 0 ...` hairline in `.dark`.
   - For `rounded-<X>`: `getComputedStyle(el).borderTopLeftRadius` equals the expected pixel radius (`> 0px`).

---

## 4. S4 — Accessibility Rules for Accounting (`WCAG 2.2 AA`)

Accounting screens are keyboard-intensive workspaces. Every rule below extends and is cross-checked against `frontend/tenant-portal/docs/design/accessibility.md`.

### 4.1 Grid Keyboard Model (Read-Only Ledgers vs Editable Line Grids)

Accounting uses two distinct tabular interaction patterns; they must never be conflated:

#### A. Read-Only Ledger, Trial Balance, Open-Item, and Exception Grids (`SCR-06`, `SCR-07`, `SCR-12`, `SCR-17`, `SCR-19`, `SCR-23`)
- **Semantic markup first (`accessibility.md` §"Semantics before ARIA"):** Render a native `<table>` with `<thead>`, `<tbody>`, and (when server totals exist) `<tfoot>`. Column headers use `<th scope="col">`; total/subtotal labels in `<tfoot>` and hierarchical statement group headers use `<th scope="row">`. Do **not** put `role="grid"` on a read-only table unless full 2D roving `gridcell` focus is implemented; native `<table>` lets screen readers (`NVDA`, `JAWS`, `VoiceOver` in Arabic & English) navigate cells with standard table-reading commands while keeping `Tab` stops concise.
- **Tab sequence:** Toolbar search/filters -> sortable `<th scope="col"><button>` triggers -> per-row primary identifier link (`entryNo` / `documentNo` / `code`) -> per-row action menu trigger (`...` with translated `aria-label`, e.g. `t.accounting.actionsForRow` interpolating `{code}`) -> pagination / keyset `"Load next rows"` button.
- **Virtualized keyset grids (`SCR-12` General Ledger — 7M-line reference tenant):** Set `aria-rowcount={totalCount ?? -1}` on `<table>` and `aria-rowindex={absoluteIndex + 1}` on each rendered `<tr>` so screen readers announce position accurately across virtualized slices.
- **Focus never obscured (`WCAG 2.2 AA 2.4.11`, `accessibility.md` line 181):** Accounting tables frequently pin sticky `<thead>` (`block-start`), sticky server-totals `<tfoot>` (`block-end`), sticky account/code first column (`inline-start`), and sticky row-actions column (`inline-end`). Every focusable element inside `<tbody>` must inherit CSS `scroll-margin-block-start`, `scroll-margin-block-end`, `scroll-margin-inline-start`, and `scroll-margin-inline-end` sized to those exact sticky dimensions (`>= 40px` block, `>= 180px` / `>= 56px` inline) so tabbing never hides the focus ring behind a sticky header, sticky total row, or pinned column.

#### B. Editable Journal-Line & Allocation Grids (`SCR-05` Journal Draft Editor, `SCR-09` Opening Balance Lines, `SCR-10` Recurring Lines, `SCR-23` Settlement Allocation Grid)
- **Zero keyboard trap (`WCAG 2.1.2`, `accessibility.md` line 93):** `Tab` and `Shift+Tab` **always** move through interactive controls in logical order (`Account picker` -> `Debit input` -> `Credit input` -> `Currency/FX` -> `Party picker` -> `Dimension pickers` -> `Line memo` -> `Remove line button` -> next line) and exit the table cleanly into `+ Add line` (`إضافة سطر`) and the form footer. `Tab` is **never** hijacked to stay trapped inside the grid.
- **Fast spreadsheet-style vertical/cell movement:**
  - When focus is in a plain text/amount `<input>`: `ArrowUp` / `ArrowDown` moves focus to the **same column** in the previous/next line (`lines[row - 1]` / `lines[row + 1]`), selecting its text for rapid data entry.
  - When focus is on a combobox/select trigger (`Account`, `Party`, `Tax Code`, `Dimension`): `Enter`, `Space`, or `ArrowDown` opens the listbox; while closed, `Alt+ArrowUp` / `Alt+ArrowDown` jumps to the same column in the previous/next line.
  - **Mutual-exclusion Debit/Credit UX:** Entering a non-zero value in `Debit` automatically clears `Credit` on that same line (and vice versa) only when the other field was empty or `"0.00"`; if the user tabs from a populated `Debit` cell, `Credit` remains focusable via `Tab` (never dynamically `disabled` mid-tab, which swallows keyboard focus) or uses predictable `readOnly` until `Debit` is cleared.
  - **Layered `Escape` handling:** Pressing `Escape` inside an open cell combobox/popover closes **only** that cell's popover (`event.stopPropagation()`) and returns focus to the cell input — it must **never** accidentally close a parent `FormDrawer` or `Dialog` and discard 30 typed journal lines!
  - **Keyboard row addition & removal:**
    - Pressing `Ctrl+Enter` (`Cmd+Enter` on macOS) from any cell in the grid, or activating the visible `+ Add line` (`إضافة سطر`) button below `<tbody>`, appends a new line and moves focus directly to the new line's `Account` picker.
    - Every row's `Remove line` (`حذف السطر {lineNo}`) icon button has a translated `aria-label` + `Tooltip`, meets the `24×24 CSS px` target floor (`.ds-hit-target`), and when activated moves focus to the `Account` picker of the next row (or previous row when deleting the last row), announcing `"Line {n} removed"` / `"تم حذف السطر {n}"` politely.

### 4.2 Announced Running Balance in the Journal Editor (`SCR-05`, `SCR-09`)

1. **Exact arithmetic:** Client-side running totals (`totalDebit`, `totalCredit`, `difference`) are summed using scaled `BigInt` minor-unit integer arithmetic over validated `DecimalString` inputs — **never** `Number()` or floating-point addition.
2. **Persistent visual bar:** Pinned at the bottom of the journal-line grid, displaying:
   - `Total Debit` (`إجمالي المدين`): `<Money value={totalDebit} currency={currency} />`
   - `Total Credit` (`إجمالي الدائن`): `<Money value={totalCredit} currency={currency} />`
   - `Difference` (`الفرق`): `<Money value={absDifference} currency={currency} />` paired with explicit status badge:
     - When `totalDebit === totalCredit && totalDebit > 0`: `Badge tone="positive"` with `CheckCircle2` + `t.accounting.journalEditor.balanced` (`Balanced` / `القيد متوازن`).
     - When `totalDebit !== totalCredit`: `Badge tone="caution"` (while editing) or `Badge tone="negative"` (after a submit/post attempt) with `Scale` + `t.accounting.journalEditor.debitExceedsBy` / `creditExceedsBy` (`Unbalanced: Debit exceeds Credit by {amount}` / `غير متوازن: المدين يزيد عن الدائن بمقدار {amount}`).
3. **Screen-reader announcement (`aria-live` discipline, `accessibility.md` §"Announcements"):**
   - Render a dedicated polite live region: `<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{debouncedAnnouncement}</div>`.
   - **Debounce rule (`400ms` after blur or line add/remove):** Update `debouncedAnnouncement` on input `blur`, line deletion, or `400ms` after typing pauses — **never** on every single digit keystroke (otherwise typing `"1250.00"` interrupts the user seven times).
   - **Assertive reserve:** Use `role="alert"` (`aria-live="assertive"`) **only** when the user activates `Post` (`ترحيل`) or `Submit for approval` (`إرسال للاعتماد`) while unbalanced or invalid.

### 4.3 Focus Return After Dialogs, Drawers, and Confirmations

1. **Standard return (`accessibility.md` line 75):** Every `Dialog`, `AlertDialog`, `Sheet`, `FormDrawer`, and `ReasonDialog` (e.g. mandatory 10–1,000-character dismissal reason on `SCR-19`, reversal reason on `SCR-06`, period reopen/close confirmation on `SCR-03`/`SCR-33`, approval/rejection comment on `SCR-11`) traps focus while open, closes on `Escape` (except while a non-cancellable request is in flight), and restores focus to the trigger button when the trigger remains mounted.
2. **Disappearing-trigger fallback (mandatory in Accounting action queues):**
   In Accounting, completing a modal action frequently removes the originating row from the current filtered list (for example: dismissing an `OPEN` exception on `SCR-19`, approving a `PENDING` request on `SCR-11`, resolving/discarding a posting exception on `SCR-07`, or deleting/cancelling a `DRAFT` journal on `SCR-05`). If Radix attempts to focus an unmounted trigger, focus silently falls to `document.body`, stranding keyboard and screen-reader users at the top of the document.
   - **Rule:** Every queue mutation hook captures `(triggerRef, rowIndex)` before opening the dialog. In `onCloseAutoFocus(event)`:
     1. If `triggerRef.current && document.contains(triggerRef.current)`, allow normal focus restoration.
     2. Otherwise, call `event.preventDefault()` and focus the primary link/action button of the row now occupying `Math.min(rowIndex, remainingRows.length - 1)`.
     3. If `remainingRows.length === 0` (the queue is now empty!), move focus to the page's `<h1 ref={headingRef} tabIndex={-1} className="outline-none">` in `PageHeader`, while a polite `role="status"` region announces completion (e.g. `"Exception dismissed. 0 open exceptions remaining."` / `"تم استبعاد الاستثناء. لا توجد استثناءات مفتوحة متبقية."`).

### 4.4 Focus to the First Invalid Field on `422` and `400` Validation Errors

1. **Backend wire-contract precision (`01_Context_Headers_and_Responses.md` §4 & `04_Errors_and_Constants.md` §3):**
   Accounting endpoints return field- and line-level validation failures across **two** HTTP statuses that must share one focus-and-error-binding pipeline:
   - **HTTP `400` (`errorCode: "ACCOUNTING.VALIDATION.FAILED"`):** Emitted by NestJS `ValidationPipe` (`whitelist: true, forbidNonWhitelisted: true`). `error.details` is a flat `Record<string, string[]>` keyed directly by **dotted DTO property path** with **no** `details.fields` wrapper — e.g. `{"entryDate": ["..."], "lines.0.accountId": ["..."], "lines.2.debitAmount": ["..."]}`.
   - **HTTP `422` (Domain / business-rule rejections — e.g. `ACCOUNTING.ENTRY.UNBALANCED`, `ACCOUNTING.ACCOUNT.NOT_POSTABLE`, `ACCOUNTING.ACCOUNT.CONTROL_MANUAL_FORBIDDEN`, `ACCOUNTING.DIMENSION.REQUIRED`, `ACCOUNTING.FX.RATE_NOT_FOUND`, `ACCOUNTING.PERIOD.CLOSED`, `ACCOUNTING.TAX.CODE_INACTIVE`):** Emitted when DTO syntax is valid but accounting semantics reject the command. `error.details` carries structured pointers such as `field`, `lineIndex` / `lineNo`, `dimensionCode`, `accountId`, or `fields: string[]` (and `409 ACCOUNTING.CONCURRENCY.ALREADY_EXISTS` carries `details.fields`).
2. **Deterministic client focus & announcement sequence (never a toast — `accessibility.md` line 132):**
   - **Step 1 — Normalize to canonical field keys:** Convert both `400` dotted keys (`"lines.2.accountId"`) and `422` structured `details` (`{ lineIndex: 2, dimensionCode: "COST_CENTER" }` -> `"lines.2.dimensions.COST_CENTER"`, `{ field: "entryDate" }` -> `"entryDate"`) into a single ordered map sorted by **DOM reading order**: header fields first (top-to-bottom, `start`-to-`end`), followed by line items sorted by `(lineIndex ASC, columnOrder ASC)`.
   - **Step 2 — Bind inline `Field` state:** Every matched control receives `aria-invalid="true"` and `aria-describedby="{fieldId}-error"` pointing to its inline translated error message below the control (`text-xs text-destructive` with leading `AlertCircle` icon).
   - **Step 3 — Reveal hidden/virtualized targets before focusing:** If the **first** invalid control resides in a collapsed section, an inactive `TabsContent` (e.g. a secondary tab in `SCR-01` Company Activation or `SCR-04` Master Data), or an off-screen virtualized row in `SCR-05` / `SCR-09`, programmatically expand the section / activate the tab / call `virtualizer.scrollToIndex(firstInvalidLineIndex, { align: "center" })`, then inside `requestAnimationFrame` call `.focus({ preventScroll: false })` on that first invalid control.
   - **Step 4 — Multi-error / form-level summary banner:** Whenever `>= 2` fields/lines fail, **or** when a `422` error has no single field target (such as `ACCOUNTING.ENTRY.UNBALANCED` or `ACCOUNTING.PERIOD.CLOSED`), render an inline `FormErrorSummary` card (`role="alert"`, `tabIndex={-1}`) at the top of the form naming the translated cause and providing keyboard-activatable anchor buttons that jump directly to each invalid line/field. When at least one specific field is invalid, keyboard focus still lands directly on **the first invalid field** (`accessibility.md` line 208); when no specific field owns the `422` (form-wide domain rule), keyboard focus lands on `FormErrorSummary`.

### 4.5 `aria-sort` on Sortable Columns (`accessibility.md` line 101 & 213)

1. **Every sortable `<th scope="col">` declares `aria-sort` explicitly:**
   - Active ascending column -> `aria-sort="ascending"`
   - Active descending column -> `aria-sort="descending"`
   - All other sortable columns -> **`aria-sort="none"`** *(never omit `aria-sort` on an unsorted sortable column — `accessibility.md` line 213).*
   - Non-sortable columns (e.g. `Memo`, `Dimensions`, `Actions`) -> **omit `aria-sort` completely** and render plain text, never a `<button>`.
2. **Accessible button inside `<th>`:**
   - Render `<button type="button" className="inline-flex items-center gap-1 ... focusRing">` inside `<th scope="col" aria-sort={...}>`.
   - Append a visual sort indicator icon (`ArrowUp` for ascending, `ArrowDown` for descending, `ArrowUpDown` at `opacity-50` for `none`, all `aria-hidden="true"`), and wire the accessible description/tooltip from `t.views.sortAscending`, `t.views.sortDescending`, and `t.views.notSorted`.
   - When sorting triggers a server refetch (`DataTable` server-sorted ledger/document lists), keep `<th>` mounted with `aria-busy="true"` on the table body container so focus remains on the clicked sort `<button>` across the reload!

### 4.6 Cross-Check Against `docs/design/accessibility.md`

| `accessibility.md` Requirement | Accounting Specification Coverage |
| --- | --- |
| **Contrast (`>= 4.5:1` text, `>= 3:1` non-text)** | Verified in §1.1 & §3.3; no custom unverified colours permitted; `positive-700` on white (`5.02:1`) and `--muted-foreground` (`4.76:1` light / `7.78:1` dark) preserved untouched. |
| **Colour is never the only signal** | Verified in §1.2 (all 80+ status/severity/kind enums carry text + icon/dot), §1.3 (charts), and §2.1–§2.2 (Debit/Credit columns, `Dr`/`Cr` & `مدين`/`دائن` labels, `[Storno]` tag). |
| **Typography floor (`13px` EN / `14px` AR, no `text-[Npx]`, `text-2xs` Latin-only)** | Verified in §3.1 & §5.3; dense ledger cells use `text-xs` (`12.5px` base / lifted in `ar`), never arbitrary `text-[10px]` or `text-2xs` on Arabic text. |
| **Reduced motion (`prefers-reduced-motion: reduce`)** | `.dot-pending` becomes static `opacity: 0.45`; spinners freeze with `aria-busy="true"` + visible label; Recharts sets `isAnimationActive={false}` (§1.1, §1.3). |
| **Keyboard reachability & zero traps** | Verified in §4.1 (read-only `<table>` + editable journal grid where `Tab` never traps and `Escape` closes cell popovers before parent drawers). |
| **Dragging alternative (`WCAG 2.2 AA 2.5.7`)** | Accounting MVP uses structured tables/checklists rather than drag-only Kanban boards; if any column-reordering or bank-line matching drag gesture is offered in `SCR-26`, an explicit single-click `"Match with…"` / `"Move"` button/menu is mandatory. |
| **Focus visible & not obscured (`WCAG 2.2 AA 2.4.11`)** | Verified in §4.1 (`focusRing` on all controls + `scroll-margin-block/inline` matching sticky `thead`, `tfoot`, and pinned columns). |
| **Web target size (`WCAG 2.2 AA 2.5.8` — `>= 24×24 CSS px`)** | Default `32px` controls clear it; compact `24px` (`xs`) table/line-item icon buttons carry `.ds-hit-target` (`44×44px` on `@media (pointer: coarse)`). |
| **Direction wired into Radix (`DirectionBridge`)** | Verified in §5.3 — all `Tabs`, `DropdownMenu`, `Select`, `Popover`, and `Dialog` primitives inherit `DirectionProvider dir={dir}`. |
| **Live announcements (`polite` vs `assertive`)** | Verified in §4.2 (debounced `polite` journal balance, pagination/filter count announcements; `assertive` strictly for blocked submissions). |
| **Inline field errors, `403 PermissionGate`, `ErrorState` retry** | Verified in §4.4 (`400` + `422` inline `Field` binding + focus); `403` renders `PermissionGate` (or entitlement boundary in `P03.T07.S5`), never `EmptyState`. |
| **Read-only vs disabled (`accessibility.md` line 219)** | Posted `acc_journal_entries`, frozen `functionalCurrency`, locked fiscal periods, and `ARCHIVED` tenant views render as semantic description lists or `readOnly` inputs with **full `--foreground` contrast (`>= 4.5:1`)** and copyable `IdentifierText` — never washed-out `disabled` opacity. |

---

## 5. S5 — RTL and Bilingual Rules

### 5.1 `IdentifierText` (`<bdi dir="ltr">`) and LTR Form Controls

Per `docs/design/accessibility.md` (§"Bidirectional text") and `src/design-system/primitives/IdentifierText.tsx`, rendering a Latin/digit/hyphenated identifier bare inside an Arabic RTL layout causes the Unicode bidirectional algorithm to permute leading/trailing segments (e.g. `JE-2026-00014` or `EG38-0019...` or `-1250.00`), producing a **data-correctness defect** when an accountant reads or copies the value.

1. **Mandatory `<IdentifierText>` inventory across Accounting (enforced by `scripts/design/identifier-guard.mjs`):**

| Domain Category | Accounting Fields That MUST Render Inside `<IdentifierText>` | `selectAll` Prop | Editable Input Rule |
| --- | --- | --- | --- |
| **Tax & Statutory Numbers** | Egyptian ETA Registration Number (`RIN`, 9 digits), Saudi ZATCA VAT `TIN` (15 digits), UAE `TRN`, Kuwait tax/retention ref, commercial registration number (`CRN`), national ID, tax card number, withholding `certificateNo`, VAT return `filingReference`, authority `authorityReference` | `selectAll={true}` | `<Input dir="ltr" className="font-mono" />` |
| **Banking & Payment Identifiers** | `iban` (`EG...`, `SA...`, `AE...`, `KW...`), `swiftBic`, `accountNumber`, `paymentFile.fileNo`, `bankInstructionRef`, `paymentObligationRef`, negotiable `instrumentNo`, cheque serial prefix & range (`fromSerial`..`toSerial`), POS `shiftCode` / `deviceCode` | `selectAll={true}` on `iban`, `bankInstructionRef`, `fileNo` | `<Input dir="ltr" className="font-mono" />` |
| **System, Audit & Authority IDs** | Every UUIDv7 (`id`, `companyId`, `branchId`, `journalEntryId`, `openItemId`, `restoreRunId`), `correlationId`, `x-idempotency-key`, keyset `cursor`, `ETag` / `version`, authority `uuid`, `longId`, `submissionId`, `internalId`, SHA-256 tamper-chain hashes (`entryHash`, `prevEntryHash`, `payloadHash`, `checksum`), `chainSeq` | `selectAll={true}` | Read-only (or `<Input dir="ltr" />` in search/filter boxes) |
| **Accounting Codes & Gapless Sequences** | Chart of Accounts `code` & `accountCodeSnapshot` (e.g. `110101`), `accountGroup.code`, `journal.code` (`GEN`, `SAL`), `entryNo` (`JE-2026-000142`), `draftNo`, `documentNo`, `settlementNo`, `paymentRunNo`, `dunningRunNo`, `nettingNo`, `assetCode`, `dimension.code` & `dimensionValue.code`, `taxCode`, `ruleSet.code`, `parameterCode`, `settingKey`, ISO `currencyCode` (`EGP`, `SAR`, `AED`, `KWD`) when standalone | `selectAll={false}` *(allow partial prefix selection where helpful, or `true` on `entryNo`/`documentNo` detail headers)* | `<Input dir="ltr" className="font-mono" />` |

2. **Special sentinel exception — `ACC_REDACTION_TOKEN` (`"[REDACTED]"`):**
   Per `01_ERD/02_Ledger_Tables.md` (`D-220`), personal-data redaction replaces `memo` / `description` with the exact wire sentinel `"[REDACTED]"`. Do **not** render the literal English string `"[REDACTED]"` through `IdentifierText` in an Arabic UI: detect `value === "[REDACTED]"` in the display adapter and render a neutral badge with `EyeOff` + `t.accounting.redacted` (`"بيانات محجوبة قانونياً"` / `"Redacted"`).

### 5.2 Amounts, Western Digits (`ar-EG-u-nu-latn`), Decimal Precision, and Alignment

1. **Exact decimal-string pipeline (`Money.tsx`, `AGENTS.md`):**
   - Wire fields (`DecimalString`, `FxRateString`) remain `string` from `axiosClient` -> Zod/runtime validator -> React state -> `<Money value={...} />`.
   - **Never call `Number(amount)` or `parseFloat(amount)`** (`Number("9007199254740993.15")` silently corrupts cents; `Money.tsx` passes `trimmed as \`${number}\`` directly to `Intl.NumberFormat.prototype.format`).
2. **Settled Western digits in both languages (`docs/design/typography.md` §"The digit decision — settled"):**
   - Every number, amount, percentage, basis-point rate (`_bp` / 100), FX rate, quantity, and date passes explicit `INTL_LOCALE[lang]`:
     - Arabic: **`"ar-EG-u-nu-latn"`** (Arabic month/currency names and RTL conventions, with **Western digits `0–9`**).
     - English: **`"en-US"`** (Western digits `0–9`).
   - Never call `.toLocaleString()` without an explicit locale (`design:census` gates `localeUnawareFormatting: 0` and `arabicIndicDigits: 0`).
3. **Currency minor units and FX rates:**
   - Pass explicit `minimumFractionDigits` and `maximumFractionDigits` matching the currency's ISO 4217 minor units from company/currency metadata: **`2`** for `EGP`, `SAR`, `AED`, `USD`, `EUR`; **`3`** for `KWD`, `BHD`, `OMR`, `JOD`; **`0`** for zero-decimal currencies.
   - Exchange rates (`FxRateString`, up to 12 decimal places in `02_DTOs.md`) render with `minimumFractionDigits: 2, maximumFractionDigits: 12` inside `<Money>` (no `currency` prop) + `font-mono tabular-nums`, preserving exact pinned trailing precision (`D-540`, `D-712`).
4. **Numeric alignment and tabular figures:**
   - Every monetary, rate, percentage, and quantity column sets `align: "end"` (`text-end` on both `<th>` and `<td>`) and `tabular-nums` (`font-variant-numeric: tabular-nums`, built into `Money.tsx` + `Plus Jakarta Sans` / `JetBrains Mono`).
   - Because `<Money>` wraps its formatted output in `<bdi className="tabular-nums">`, negative signs (`-1,250.000 KWD`) and currency markers never flip across the number in RTL paragraphs.

### 5.3 Logical CSS Properties, Icon Mirroring, and Arabic Optical Scale

1. **Logical properties exclusively (`pnpm design:rtl` = `0` violations):**
   - Use **only** logical Tailwind v4 utilities across every Accounting component:
     - Margin & padding: `ms-*`, `me-*`, `ps-*`, `pe-*`, `mbs-*`, `mbe-*`
     - Positioning: `start-*`, `end-*`, `inset-inline-*`, `inset-block-*`
     - Alignment: `text-start`, `text-end`
     - Borders & radii: `border-s`, `border-e`, `border-s-*`, `border-e-*`, `rounded-s-*`, `rounded-e-*`
     - Flex/Grid flow: rely on native `flex` / `grid` inheritance from `<html dir="rtl" | "ltr">`; never apply `flex-row-reverse` to simulate RTL!
   - Physical directional classes (`ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, `right-*`, `text-left`, `text-right`, `border-l-*`, `border-r-*`, `rounded-l-*`, `rounded-r-*`) fail `pnpm design:rtl` in CI.
2. **Directional icon mirroring (`docs/design/icons.md`):**
   - Apply `rtl:-scale-x-100` (`mirrorInRtl`) **only** to directional navigation/flow icons: `ArrowRight`, `ArrowLeft`, `ChevronRight`, `ChevronLeft`, `ChevronsRight`, `ChevronsLeft`, `CornerDownRight`, `Forward`, `Reply`, `Send` (when pointing inline).
   - **Never mirror** asymmetrical semantic icons whose shape has a universal orientation: `Check`, `CheckCircle2`, `RotateCcw` (reversal/storno), `Clock`, `ClockAlert`, `Lock`, `Search`, `Calculator`, `Percent`, `Scale`, `Slash`, or text/currency glyphs.
3. **Arabic typography & optical legibility (`src/app/globals.css` `html[lang="ar"]`):**
   - `globals.css` automatically lifts Arabic steps by `+1px` with matching line-height and `letter-spacing: 0em` so Cairo's diacritics and descenders never clip in 36px/40px ledger rows.
   - Any uppercase Latin micro-header (`uppercase tracking-wider`) MUST pair with `rtl:normal-case rtl:tracking-normal` — positive letter-spacing breaks joined Arabic cursive script!
   - Never apply `text-2xs` to Arabic strings (`accessibility.md` line 49); use `text-xs` (`12.5px` EN / `13.5px` AR) as the floor for bilingual badges and table headers.

### 5.4 Zero Language Ternaries (`docs/design/i18n.md`)

1. **Absolute prohibition in components and hooks (`languageTernaries: 0`):**
   - Feature code under `src/app/(tenant)/accounting/**` and `src/features/accounting/**` **never** branches on `lang === "ar"`, `language === "en"`, or `isRtl` to choose a UI string, placeholder, `aria-label`, tooltip, or error message. Every UI string lives in both `src/i18n/dictionaries/ar.ts` and `src/i18n/dictionaries/en.ts`.
   - Never assemble sentences by string concatenation (`t.a + " " + count + " " + t.b`); use complete sentence templates with named `{placeholders}` (`formatTemplate`) and `Intl.PluralRules(INTL_LOCALE[lang])` where Arabic's six plural categories (`zero`, `one`, `two`, `few`, `many`, `other`) apply (`docs/design/i18n.md` §"Plurals").
2. **The single bilingual data helper (`I18nText` in Accounting DTOs):**
   - Whereas CRM entities store `{ nameAr, nameEn }`, Accounting entities (`04_Static_Data/02_DTOs.md` `I18nText`, enforced in PostgreSQL by `ck_<table>_name_i18n_shape`) return `nameI18n: { ar: string; en?: string }` on accounts, account groups, journals, dimensions, dimension values, tax codes, close tasks, report definitions, and country-pack rows (`ar` is always non-empty; `en` is optional).
   - Extend **`src/lib/format/localized.ts`** — the **sole** file in the repository permitted to select between Arabic and English data fields (`docs/design/i18n.md` §"The one exemption: bilingual data fields") — with:
     ```ts
     export interface AccountingI18nText {
       ar: string;
       en?: string | null;
     }

     export function localizedI18nText(
       value: AccountingI18nText | null | undefined,
       lang: Language,
     ): string {
       if (!value) return "";
       return localizedValue(value.ar, value.en, lang);
     }
     ```
   - **Historical ledger snapshot fallback (`D-069`):** On `acc_journal_lines` (`SCR-06`, `SCR-12`), `account_name_snapshot` freezes a single string at posting time while the joined account carries `nameI18n`. Render `account ? localizedI18nText(account.nameI18n, lang) : line.accountNameSnapshot`, exposing `line.accountNameSnapshot` in the line detail popover when it differs from the current renamed account.
3. **Never inspect localized server `message` text:**
   - Client logic branches **exclusively** on immutable wire identifiers: `errorCode` (`ACCOUNTING.*`), `details.safeAction` (`SafeAction`), `details.retryClass` (`RetryClass`), and `status` enums — never on substring checks against `error.message`.
