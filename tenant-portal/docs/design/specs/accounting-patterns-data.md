# Accounting — Data Patterns Specification (`UX-05`, `UX-07`, `UX-08`, `UX-12`)

> **Lead review, 1 November 2026 (P03.T05).** Two cells were corrected: the tax-subledger preview reads under `accounting.tax_transaction.read`, and `GET /source-document-links` is `accounting.fiscal_document.read` · `accounting.integration.trade_posting` · `COMPANY`. The run-artifact download route does not exist yet; it is contract gap `CG-DATA-02` (deferred to P27). Every route, permission, feature key and scope below was checked against `docs/LLD/accounting-app/02_API_Contracts/02_Endpoint_Catalogue.md` and `04_Static_Data/05_Permissions_and_Features.md`; open contract gaps stay listed for `P03.T11`.

Status: **authoritative UX & frontend contract specification (`P03.T05`)**
Target portal path on merge (`P03.T12`): `tenant-portal/docs/design/specs/accounting-patterns-data.md`
Owning frontend app: `tenant-portal` (port `5002`, HTTP profile `mutakamel-http-tenant-*` / HTTPS `__Host-mutakamel-tenant-*`)
Owning backend apps: `accounting-app` (`/api/tenant/accounting/v1/*`), `core-app` (`/api/tenant/core/v1/*`), `api-gateway-app` (public browser route contract)
Last source verification: **2026-11-01**

**Binding authorities consumed:**
- Backend Accounting LLD:
  - `backend/docs/LLD/accounting-app/02_API_Contracts/01_Context_Headers_and_Responses.md`
  - `backend/docs/LLD/accounting-app/02_API_Contracts/02_Endpoint_Catalogue.md` (§3 Module 01, §4 Module 02, §5 Module 03, §7 Module 05, §8 Module 06, §10 Module 08, §12 Cross-module read models & reports, §13 Gateway metadata)
  - `backend/docs/LLD/accounting-app/04_Static_Data/01_Enums.md`, `02_DTOs.md`, `03_Interfaces_and_Value_Objects.md`, `04_Errors_and_Constants.md`
  - `backend/docs/LLD/accounting-app/01_ERD/02_Ledger_Tables.md`, `08_Close_and_Reporting_Tables.md`
  - `backend/docs/LLD/accounting-app/07_Modules/10_MVP/08_close_and_reporting.md`, `13_Delivery_Plan.md` (§6.2.1 7M-line reference tenant)
- Tenant Portal Design System & Architecture:
  - `tenant-portal/docs/design/README.md`, `tokens.md`, `typography.md`, `primitives.md`, `patterns.md`, `views.md`, `states.md`, `accessibility.md`, `i18n.md`, `anti-patterns.md`
  - `tenant-portal/docs/architecture/data-layer.md`, `file-architecture.md`
  - `tenant-portal/docs/api/core-reference.md`, `core-directory.md`, `core-settings.md`
- Approved P03 Accounting UX Foundation Specs:
  - `tenant-portal/docs/design/specs/accounting-ia.md` (`P03.T01`)
  - `tenant-portal/docs/design/specs/accounting-home.md` (`P03.T02`)
  - `tenant-portal/docs/design/specs/accounting-status-and-a11y.md` (`P03.T04`)

---

## 0. Cross-Pattern Invariants & Design-System Binding

Every data pattern in this specification (`UX-05` Ledger Grid, `UX-07` Money Input & Display, `UX-08` Account / Party / Dimension / Period Pickers, and `UX-12` Report Viewer) obeys twelve non-negotiable platform invariants:

1. **Zero Client-Side Financial Arithmetic:** Browser code never sums monetary rows, never computes running balances, never multiplies `amountTxn × fxRate` to fabricate `amountFunctional`, never rounds `HALF_UP`, never computes tax or aging buckets, and never calls `Number()` or `parseFloat()` on a `DecimalString` or `FxRateString` (`data-layer.md`). Every total, subtotal, balance, FX conversion, and variance rendered in the UI arrives pre-computed and string-serialized from the backend. Where an endpoint returns rows without an aggregate summary, the UI omits monetary sum cells rather than summing loaded rows in JavaScript (see `CG-DATA-01`, `CG-DATA-04`).
2. **Exact Wire Preservation:** `DecimalString` (`^-?(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$`), `FxRateString` (`^(?:0|[1-9]\d{0,11})(?:\.\d{1,12})?$`, `> 0`), UUIDv7 identifiers, opaque keyset `cursor` tokens (`<= 512` chars), numeric `ETag` (`"<version>"`) or the Company-profile read's opaque weak representation `ETag`, and SHA-256 `entryHash` / `checksum` hex strings pass through state, URL params, and validators unmodified.
3. **UUIDv7 Only:** Every client-generated identifier — `x-idempotency-key` on `WRITE_SENSITIVE` commands, client draft line keys, correlation ids — uses `generateUUIDv7` from `src/lib/uuid.ts`. `crypto.randomUUID()` is banned unconditionally (throws over plain HTTP on `<tenant>.mutakamel.ai:5002` and emits v4).
4. **Canonical Browser Gateway Paths & Operating Context:** All requests go through `src/lib/api/axiosClient.ts` (`credentials: "include"`, `Cache-Control: no-store` handling) using `/api/tenant/accounting/v1/<route>` and `/api/tenant/core/v1/<route>`. Every Accounting request carries `x-mutakamel-company-id: <companyId>` from the mandatory Company switcher (`accounting-ia.md` §3.1) and, when a single branch is active in context, `x-mutakamel-branch-id: <branchId>`. Switching Company or Branch cancels in-flight queries, resets keyset cursors, and invalidates Accounting caches.
5. **Runtime Boundary Validation:** No `any`. Every `/accounting/*` response unwraps `SuccessResponseDto<T>` (`{ success: true, data, meta?, correlationId, timestamp }`) through a typed validator before entering React state.
6. **Barrel-Only Design System Imports & 300-Line Split Discipline:** Feature code imports primitives and patterns exclusively from `@/design-system` (`DataTable`, `Pagination`, `useVirtualWindow`, `Money`, `IdentifierText`, `Input`, `Select`, `Combobox`, `Popover`, `Drawer`, `Dialog`, `Button`, `StatusBadge`, `Badge`, `Field`, `Tabs`, `Skeleton`, `EmptyState`, `ErrorState`, `PermissionGate`, `PageHeader`, `FilterBar`). Logic lives in `hooks/use<PatternName>.ts` and markup in `<PatternName>.tsx`, each file `< 300` lines.
7. **Four Outcome Chromatic Roles + Neutral `ink`:** Semantic status surfaces use only `positive`, `caution`, `negative`, and `neutral` (`ink`). `brand` is reserved for focus rings, active navigation indicators, and the single `PageHeader` `variant="primary"` CTA — never on a status badge (`accounting-status-and-a11y.md` §1). No arbitrary hex colors, no `rounded-xl` or larger, no `text-[Npx]`.
8. **Three Font Weights (`400` / `500` / `600`) & Table Body `400`:** Only `font-normal` (`400`), `font-medium` (`500`), and `font-semibold` (`600`) exist. `font-bold` (`700`) and `font-black` (`900`) are forbidden. All `DataTable` body `<td>` cells are `font-normal` (`400`) unconditionally (`typography.md`); `<thead>`, `<tfoot>`, and report `HEADER`/`SUBTOTAL`/`TOTAL` rows (`isBold: true`) use `font-medium` (`500`) or `font-semibold` (`600`).
9. **Logical CSS Properties & Zero Language Ternaries:** Layouts use logical Tailwind utilities exclusively (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `text-end`, `border-s-*`, `border-e-*`) so `pnpm design:rtl` stays at `0` violations. Every string comes from `t.accounting.*` dictionaries (`ar` / `en`); every enum wire value maps through `t.status.*` or `t.accounting.enums.*`.
10. **Bilingual Bidirectional Islands & Western Digits:** Account codes (`110101`), legal entry numbers (`JV-2026-000142`), tax IDs, IBANs, UUIDs, keyset cursors, and SHA-256 hashes always render inside `<IdentifierText>` (`<bdi dir="ltr" className="font-mono tabular-nums">`). Monetary amounts, rates, quantities, and dates format via `Intl` using Western digits in both locales (`ar-EG-u-nu-latn` in Arabic, `en-US` in English).
11. **Honest Authorization & Availability Boundaries:** `403` renders `<PermissionGate>` (never an empty table); `403 ACCOUNTING.FEATURE.NOT_ENTITLED` renders `<FeatureNotEntitledState>`; `503 ACCOUNTING.REPORT.PROJECTION_BEHIND` renders an inline retryable projection-lag banner with `Retry-After` countdown; `404` out-of-scope IDs render not-found without leaking existence.
12. **WCAG 2.2 AA & Keyboard Completeness:** Minimum interactive target `24×24px` on desktop (`>= 1024px`) and `44×44px` on touch/mobile (`< 768px`), visible focus ring `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`, `4.5:1` text contrast and `3:1` non-text contrast in both light and dark themes, and `prefers-reduced-motion: reduce` compliance.

### 0.1 Shared Theme Token Matrix (Applied Across All Four Visual Combinations)

All ASCII wireframes in Sections 1–4 share this exact token mapping across `(AR-RTL, EN-LTR) × (Light, Dark)`:

| Surface / Element | Light Theme Token (`html:not(.dark)`) | Dark Theme Token (`html.dark`) | Contrast Guarantee |
| --- | --- | --- | --- |
| Page canvas | `bg-background` (`--ink-50`) | `bg-background` (`--ink-950`) | Base canvas |
| Card / Grid / Picker popover | `bg-card text-card-foreground border-border` (`--ink-0` / `--ink-900` / `--ink-200`) | `bg-card text-card-foreground border-border` (`--ink-900` / `--ink-50` / `--ink-800`) | Text `>= 12:1`, border `>= 3:1` |
| Sticky `<thead>` & `<tfoot>` | `bg-muted/90 backdrop-blur-xs border-border text-muted-foreground` | `bg-muted/90 backdrop-blur-xs border-border text-muted-foreground` | Opaque scroll occlusion, `>= 4.5:1` |
| Row hover / Combobox active option | `hover:bg-muted/60` / `data-[active=true]:bg-accent` | `hover:bg-muted/40` / `data-[active=true]:bg-accent` | Non-colour indicator + outline |
| Storno / negative reversal cue | `text-negative-foreground` + `[Storno]` / `[ستورنو]` `StatusBadge(tone="negative")` | `text-negative-foreground` + `[Storno]` / `[ستورنو]` `StatusBadge(tone="negative")` | Sign `-` + badge text + `>= 4.5:1` |
| Pinned / Frozen / Snapshot banner | `bg-muted border-border text-foreground` (`tone="neutral"`) | `bg-muted border-border text-foreground` (`tone="neutral"`) | Lock icon + text label |
| Soft-closed / Credit-hold / Lag warning | `bg-caution-subtle border-caution-border text-caution-foreground` | `bg-caution-subtle border-caution-border text-caution-foreground` | Warning icon + text `>= 4.5:1` |
| Focus ring | `ring-2 ring-ring ring-offset-2 ring-offset-background` | `ring-2 ring-ring ring-offset-2 ring-offset-background` | `>= 3:1` against adjacent surface |

---

## 1. S1 — Ledger Grid (`UX-05`)

### 1.1 Purpose & Consuming Screens

`AccountingLedgerGrid` (`src/features/accounting/patterns/ledger-grid/`) is the single high-density, keyboard-navigable, virtualized tabular pattern for append-only ledger, subledger, tax-register, and statement-line collections up to the **7,000,000-line reference tenant** (`13_Delivery_Plan.md` §6.2.1).

| Screen ID | Route | Dataset Mode | Backing Endpoint | Paging Contract |
| --- | --- | --- | --- | --- |
| `SCR-JRN-ENTRIES` | `/accounting/journals/entries` | `JOURNAL_ENTRIES` | `GET /api/tenant/accounting/v1/journal-entries` / `POST .../search` | Offset `page` `1..200` (`limit` `1..100`, default `25`); **keyset `cursor` mandatory beyond page `200` or multi-year date span** |
| `SCR-JRN-LINES` | `/accounting/journals/lines` | `JOURNAL_LINES` | `GET /api/tenant/accounting/v1/journal-lines` | Keyset `cursor` (`limit` `1..500`, default `100`, `MAX_LEDGER_PAGE_SIZE = 500`) |
| `SCR-JRN-ENTRY-DETAIL` | `/accounting/journals/entries/[id]` | `ENTRY_LINES_EMBEDDED` | `GET /api/tenant/accounting/v1/journal-entries/:id` | Bounded array `1..1,000` (`MAX_LINES_PER_ENTRY = 1000`); virtualized when `lines.length >= 100` |
| `SCR-RPT-GL` | `/accounting/reports/general-ledger` | `GENERAL_LEDGER_REPORT` | `GET /api/tenant/accounting/v1/reports/general-ledger` | Keyset `cursor` (`limit` `1..100` via `FindManyDto`, span `<= 3` fiscal years) + `asOf` / `asOfChainSeq` |
| `SCR-AR-OPEN`, `SCR-AP-OPEN` | `/accounting/receivables/open-items`, `/accounting/payables/open-items` | `OPEN_ITEMS` | `GET /api/tenant/accounting/v1/open-items` | Keyset `cursor` (`limit` `1..500`, default `100`, mandatory `side=AR\|AP`) |
| `SCR-TAX-TXNS` | `/accounting/tax/transactions` | `TAX_TRANSACTIONS` | `GET /api/tenant/accounting/v1/tax/transactions` | Keyset `cursor` (`limit` `1..500`, default `100`) |
| `SCR-BNK-STMT-DETAIL` | `/accounting/banking/statements/[id]` | `BANK_STATEMENT_LINES` | `GET /api/tenant/accounting/v1/bank-statements/:id/lines` | Keyset `cursor` (`limit` `1..500`, default `100`) |

### 1.2 Architecture & File Split (`< 300` Lines Per File)

- `hooks/useAccountingLedgerGrid.ts`: Manages URL-synced filter state, mutual exclusion between `page` and `cursor` (`400 ACCOUNTING.VALIDATION.FAILED` if both sent), cursor history stack (`prevCursors: string[]`) for deterministic "Previous chunk" navigation without offset math, optional opt-in `POST /.../count` request, row selection/focus index, and `@tanstack/react-virtual` (`useVirtualWindow` from `@/design-system`) windowing.
- `AccountingLedgerGrid.tsx`: Semantic `<table>` wrapper with sticky `<FilterBar>`, sticky `<thead>`, virtualized `<tbody>` with top/bottom `<tr aria-hidden="true">` spacer rows, sticky `<tfoot>`, and responsive `<768px` compact row cards.
- `LedgerDrillDrawer.tsx`: Non-destructive slide-over `<Drawer>` inspecting `JournalEntryDetailDto` (`GET /api/tenant/accounting/v1/journal-entries/:id`), receipts (`fxRateSnapshot`, `adoptionId`, `postingRuleVersionId`, `chainSeq`, `entryHash`), and drill links without losing the user's scroll offset or keyset cursor in the grid behind it.

### 1.3 Pagination, Keyset Cursor & Fiscal-Year Span Rules

1. **Two Distinct Server Envelopes (`02_DTOs.md` §3 & §13):**
   - **Offset mode (`page` + `limit` `1..100`):** Used on `GET /accounting/journal-entries` for pages `1..200` within a single fiscal year. Unwraps `data: T[]` + `meta: { page, limit, total, totalPages, hasNext, hasPrev }`. When `meta.page === 200 && meta.hasNext`, the pagination footer replaces the "Next page" offset button with `"Continue with cursor"` (`متابعة عبر المؤشر`) which switches to `cursor` paging cleanly before hitting the server's page-200 ceiling (`02_Endpoint_Catalogue.md` line 270).
   - **Single-Fiscal-Year Date Guard (`JournalEntryListQueryDto`):** If the user selects `fromPostingDate` and `toPostingDate` spanning two fiscal years on `journal-entries`, `useAccountingLedgerGrid` automatically omits `page` and switches the request into keyset mode (`cursor` flow) so `JournalEntryListQueryDto`'s single-year offset rule (`02_DTOs.md` §5.1) is respected without a `400` round-trip.
   - **Ledger-Scale Keyset Mode (`limit` `1..500`, `cursor` opaque `<= 512` chars):** Used on `journal-lines`, `open-items`, `tax/transactions`, `bank-statements/:id/lines`, and `reports/general-ledger`. Unwraps `data: { items: T[], pageInfo: { nextCursor: string | null, hasMore: boolean } }` (`meta` is omitted).
   - **Cursor Stack Navigation (No Infinite-Scroll Memory Leak):** Rather than appending 50,000 rows into browser RAM on a 7M-line tenant, keyset mode loads **chunks of `100`, `250`, or `500` rows** (`limit` selector in footer) and virtualizes the active chunk in the DOM (`useVirtualWindow`). Clicking **Next (`التالي`)** pushes the current `cursor` onto an in-memory `cursorStack` and fetches `cursor = pageInfo.nextCursor`; clicking **Previous (`السابق`)** pops the previous cursor; clicking **First (`البداية`)** clears `cursor` and `cursorStack`. Changing any filter, sort, Company, or Branch resets `cursor = undefined` and `cursorStack = []`.
   - **Exact Count on Demand:** Keyset endpoints omit `total` to avoid full-partition `COUNT(*)` scans on every scroll. Where the resource exposes `POST /accounting/<resource>/count` (e.g. `journal-entries/count`), a subtle `"Show exact count"` (`إظهار العدد الدقيق`) ghost button in `<tfoot>` fetches `{ total }` on demand and caches it against the serialized filter key.

### 1.4 Virtualization & Sticky Table Mechanics (`useVirtualWindow`)

- **Activation Threshold:** Virtualization activates automatically whenever `rows.length >= 100` (`views.md` rule) — covering `250`- and `500`-row keyset chunks and `1,000`-line `JournalEntryDetailDto` views. Below `100` rows, rows render directly with zero spacer overhead.
- **Native `<table>` Preservation:** Virtualization **never** replaces `<table>`/`<thead>`/`<tbody>`/`<tfoot>` with `div` flex rows (which breaks screen-reader table navigation and column alignment). Instead, `<tbody>` renders:
  1. `<tr aria-hidden="true" style={{ height: topSpacerPx }}><td colSpan={colCount} className="p-0 border-0" /></tr>` (inline height on spacer `<tr>` is the documented `@tanstack/react-virtual` mechanism in `useVirtualWindow` inside `@/design-system`, never ad-hoc styling).
  2. Visible slice `rows.slice(startIndex, endIndex)` with `aria-rowindex={rowOffset + index + 2}` (`1` is header row) and fixed compact row height `h-10` (`40px` desktop dense ledger row) or `h-11` (`44px` comfortable).
  3. `<tr aria-hidden="true" style={{ height: bottomSpacerPx }}><td colSpan={colCount} className="p-0 border-0" /></tr>`.
- **Table ARIA Attributes:** `<table aria-rowcount={totalKnown ? total + 1 : -1} aria-colcount={colCount}>`. `aria-rowcount="-1"` is the WAI-ARIA 1.2 standard for keyset tables whose total row count is unknown until counted.
- **Sticky Regions:**
  - `<thead>`: `sticky top-0 z-10 bg-muted/95 backdrop-blur-xs border-b border-border`.
  - `<tfoot>`: `sticky bottom-0 z-10 bg-muted/95 backdrop-blur-xs border-t-2 border-border`.
  - Horizontal overflow (`min-w-[960px]` inside `overflow-x-auto`): the leading identifier column (`entryNo` / `lineNo` + `postingDate`) pins with `sticky start-0 z-10 bg-card` so horizontal scrolling across multi-currency and dimension columns never detaches the row's identity in either RTL or LTR.

### 1.5 Column Specification, Multi-Currency & Storno Presentation

Every `<td>` uses `font-normal` (`400`) and `py-2 px-3 text-sm`. Column order mirrors automatically with document direction (`dir="rtl"` places col 1 at physical right; `dir="ltr"` places col 1 at physical left):

| # | Column | Width | Alignment | Formatting & Wire Source |
| --- | --- | --- | --- | --- |
| 1 | Posting Date (`postingDate`) | `108px` | `text-start` | `Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit" })` (`tabular-nums`, `YYYY-MM-DD` / localized Western digits). If `originalPeriodId !== null` (late-fact redirect, D-076), appends a compact `[Late]` / `[متأخر]` `Badge(tone="caution")` with tooltip naming the economic period. |
| 2 | Entry / Line Ref (`entryNo` or `entryId` + `lineNo`) | `156px` | `text-start` | `<IdentifierText>` clickable drill button opening `LedgerDrillDrawer` (`JV-2026-000142 #3`). `JournalLineSummaryDto` returns `entryNo`, `entryKind`, `journalId`, `periodId` and `chainSeq` with the line (`CG-DATA-06`, closed by `D-770`), so the cell renders `entryNo #lineNo` with no extra read. |
| 3 | Account (`accountCodeSnapshot` + `accountNameSnapshot`) | `min 220px` | `text-start` | `<IdentifierText>{accountCodeSnapshot}</IdentifierText>` + `ms-2 truncate` localized account name (reads snapshot so historical lines survive renumbering/merges, D-069, D-176). |
| 4 | Party / Branch / Hot Dim (`partyId`, `branchId`, `dim1`) | `180px` | `text-start` | Party display name (or `<IdentifierText>` UUID fallback per `Q14`), Branch code chip when `"All branches"` is active, and `dim1` (`COST_CENTER`) chip. |
| 5 | Txn Amount (`amountTxn` + `currencyCode`) | `144px` | `text-end` | Shown when multi-currency toggle is on or any visible row has `currencyCode !== functionalCurrencyCode`. Rendered via `<AccountingMoneyCell>` (`dir="ltr"`, `tabular-nums`, currency ISO code `USD` / `KWD` beside digits). Muted `--` when `currencyCode === functionalCurrencyCode` in compact mode, or exact amount in full audit mode. |
| 6 | Debit (`DEBIT` `amountFunctional`) | `144px` | `text-end` | When `direction === 'DEBIT'`, renders `<AccountingMoneyCell amount={amountFunctional} currency={functionalCurrencyCode} isStorno={isStorno} />`; empty cell renders `--` (`text-muted-foreground`, `aria-label={t.accounting.ledger.zeroSide}`). |
| 7 | Credit (`CREDIT` `amountFunctional`) | `144px` | `text-end` | When `direction === 'CREDIT'`, renders `<AccountingMoneyCell amount={amountFunctional} currency={functionalCurrencyCode} isStorno={isStorno} />`; else `--`. |
| 8 | Running Balance / Status (`runningBalance` or `entryKind`) | `148px` | `text-end` / `text-start` | Shown **only** on `reports/general-ledger` and `reports/party-ledger` (`BALANCE_FORWARD`) where the server computes `runningBalance` + side (`Dr`/`Cr`). On `journal-entries` / `journal-lines`, renders `EntryKind` badge (`STANDARD`, `REVERSAL`, `ADJUSTMENT`, etc.) + Storno indicator. |

**Storno & Reversal Clarity (`D-013`, `D-219`):**
- Under `SWAP_SIDES` (ordinary reversal), `isStorno = false` and amounts are positive (`>= 0`) on the opposite `direction`; the row carries `EntryKind = REVERSAL` (`StatusBadge` `tone="neutral"`).
- Under `STORNO` (`acc_company_profiles.reversal_method = 'STORNO'`), `isStorno = true` and `amountTxn` / `amountFunctional` arrive negative (`< 0`, e.g. `"-1000.00"`) on the **original** `direction` so gross turnover decreases rather than inflates. `AccountingLedgerGrid` NEVER strips the minus sign or moves a negative `DEBIT` into the `CREDIT` column! It renders `"-1,000.00 EGP"` inside `<bdi dir="ltr">` in the `DEBIT` column alongside a non-colour `[Storno]` / `[ستورنو]` `StatusBadge(tone="negative")` so screen readers, colour-blind operators, and SAF-T/FEC auditors see identical direction and sign semantics.

### 1.6 Sticky `<tfoot>` Server-Totals Rule (Zero Client Summation)

- **When Server Totals Exist** (`JournalEntryDetailDto` -> `totalDebit`, `totalCredit`; `reports/general-ledger` / `reports/party-ledger` -> `openingBalance`, `totalDebit`, `totalCredit`, `closingBalance`): `<tfoot>` renders two rows (`Opening / Period Totals` and `Closing Balance`) using `font-semibold` (`600`), right/end-aligned directly beneath the `Debit`, `Credit`, and `Running Balance` columns, all in `functionalCurrencyCode`. If `JournalEntryDetailDto` has storno lines and `totalDebit < 0`, the negative signed sum renders verbatim with `[Storno]`.
- **When Server Totals Are Absent** (`GET /accounting/journal-lines`, `GET /accounting/open-items`, `GET /accounting/tax/transactions`, `GET /accounting/bank-statements/:id/lines` — see `CG-DATA-01`): `<tfoot>` renders **no monetary sum cells**. Instead, `<tfoot>` displays the honest chunk status bar:
  - Start side: `"Showing 100 lines in current chunk · Sorted by posting date, line #"` (`عرض 100 سطر في الدفعة الحالية · مرتبة حسب تاريخ الترحيل ورقم السطر`) + `"View totals in General Ledger Report ->"` (`عرض الإجماليات في تقرير الأستاذ العام <-`) deep-link carrying the current `accountId`, `partyId`, `fromPostingDate`, and `toPostingDate` filters!
  - End side: Chunk size `Select` (`100` / `250` / `500`) + `First` / `Previous` / `Next` cursor controls.

### 1.7 Drill-Through Graph (`LedgerDrillDrawer`)

Activating (`Enter` or click) any row or `<IdentifierText>` reference opens `LedgerDrillDrawer` (`width: 560px` desktop, full-screen sheet `< 768px`) without unmounting the grid:
1. **Line -> Entry Header:** Calls `GET /api/tenant/accounting/v1/journal-entries/:entryId` (`accounting.journal_entry.read`) showing `entryNo`, `entryKind`, `postingDate`, `documentDate`, `taxPointDate`, `periodId` (and `originalPeriodId` if redirected), `totalDebit` = `totalCredit`, `memo` (showing localized `[REDACTED]` notice if `memo === '[REDACTED]'`, D-081), and all sibling lines.
2. **Entry -> Fiscal Document:** When `fiscalDocumentId !== null`, renders `"Open Fiscal Document"` (`فتح المستند الضريبي`) linking to `/accounting/documents/${fiscalDocumentId}` (`accounting.fiscal_document.read`).
3. **Entry -> Cross-App Source (`sourceRef: TripleReference`):** When `sourceApp !== 'accounting'` and `sourceId !== null`, queries `GET /api/tenant/accounting/v1/source-document-links?sourceApp=...&sourceType=...&sourceId=...` or resolves known internal portal routes (`/trade/...`, `/crm/...`), never following untrusted external URLs (`core-directory.md` rule).
4. **Line -> Tax Subledger Row:** When `taxTransactionId !== null`, opens inline preview from `GET /api/tenant/accounting/v1/tax/transactions/:taxTransactionId` (`accounting.tax_transaction.read`).
5. **Entry -> Reversal Pair & Cryptographic Chain Proof:** When `reversesEntryId !== null`, links to the reversed entry (`reversalReason` badge). Includes `"Verify Hash Chain"` (`التحقق من سلسلة التجزئة`) calling `GET /api/tenant/accounting/v1/journal-entries/:id/chain-proof` (`chainSeq`, `entryHash`, `prevEntryHash`, `hashSchemaVersion`).

### 1.8 Keyboard Model & TypeScript Interface

- **Grid Keyboard Shortcuts:** `ArrowDown` / `ArrowUp` move active row focus (`roving tabindex`); `PageDown` / `PageUp` jump 10 rows (scrolling the virtual window via `virtualizer.scrollToIndex`); `Home` / `End` jump to first/last row of loaded chunk; `Enter` or `Space` opens `LedgerDrillDrawer` on the focused row; `Escape` closes `LedgerDrillDrawer` and restores focus to the exact originating row `<tr>`.

```ts
export type LedgerGridMode =
  | "JOURNAL_ENTRIES"
  | "JOURNAL_LINES"
  | "ENTRY_LINES_EMBEDDED"
  | "GENERAL_LEDGER_REPORT"
  | "OPEN_ITEMS"
  | "TAX_TRANSACTIONS"
  | "BANK_STATEMENT_LINES";

export interface ServerLedgerTotals {
  functionalCurrencyCode: string;
  openingBalance?: { amount: string; side: "DEBIT" | "CREDIT" };
  totalDebit: string;      // DecimalString from server only — never client-summed
  totalCredit: string;     // DecimalString from server only — never client-summed
  closingBalance?: { amount: string; side: "DEBIT" | "CREDIT" };
}

export interface AccountingLedgerGridProps<TRow> {
  mode: LedgerGridMode;
  rows: readonly TRow[];
  functionalCurrencyCode: string;
  currencyMinorUnits: Readonly<Record<string, 0 | 2 | 3>>;
  serverTotals?: ServerLedgerTotals;          // Undefined on raw keyset lists (CG-DATA-01)
  asOf?: string;                              // ISO8601 freshness stamp on report modes
  asOfChainSeq?: number;                      // Ledger hash-chain anchor
  paging:
    | { kind: "OFFSET"; page: number; limit: 25 | 50 | 100; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean; onPageChange: (page: number) => void; onSwitchToCursor?: () => void }
    | { kind: "KEYSET"; limit: 100 | 250 | 500; hasPrev: boolean; hasMore: boolean; exactCount?: number; countLoading?: boolean; onRequestCount?: () => void; onFirst: () => void; onPrev: () => void; onNext: () => void; onLimitChange: (limit: 100 | 250 | 500) => void }
    | { kind: "EMBEDDED" };
  showTransactionCurrency: boolean;
  loading: boolean;
  error?: NormalizedApiError | null;
  onRetry?: () => void;
  onInspectEntry: (entryId: string, triggerElement: HTMLElement) => void;
  generalLedgerReportHref?: string;           // Deep-link when serverTotals is absent
}
```

### 1.9 Visual Prose & ASCII Wireframes — All Four Combinations + `375px` Mobile

#### Combination 1: `AR-RTL` × `Light` (`dir="rtl"`, `html:not(.dark)`)
- **Visual Prose:** Canvas `--ink-50`; grid card `--ink-0` with `1px` `--ink-200` border (`rounded-lg`). Column flow runs **right-to-left**: Posting Date (`التاريخ`) pinned at inline-start (right edge), followed leftward by Entry/Line Ref (`رقم القيد`), Account (`الحساب`), Party/Cost Center (`الطرف / مركز التكلفة`), Transaction Amount (`مبلغ المعاملة`), Debit (`مدين`), Credit (`دائن`), and Running Balance (`الرصيد المتحرك`). Sticky header and footer use `--ink-100/95` (`bg-muted/95`). All body cells use `font-normal` (`400`, IBM Plex Sans Arabic + tabular Western digits `ar-EG-u-nu-latn`); identifiers (`JV-2026-000142`, `110201`) sit inside `<bdi dir="ltr">` monospace islands. Row 3 illustrates a `STORNO` reversal line with `StatusBadge(tone="negative")` (`[ستورنو]`) and `-1,250.00` in the `مدين` column.

```text
+----------------------------------------------------------------------------------------------------------+
| [تحديث] آخر تحديث: 2026-11-01 14:30 · تسلسل السلسلة #18,420   | عملة المعاملة [x] | حساب: 110201 البنك   |
+----------------------------------------------------------------------------------------------------------+
| الرصيد المتحرك |      دائن EGP |      مدين EGP |  مبلغ المعاملة | الطرف / المركز | الحساب          | رقم القيد        | التاريخ    |
+================+===============+===============+================+================+=================+==================+============+
|  120,000.00 Dr |           --  |  120,000.00   |            --  | الرصيد الافتتاحي للسنة المالية 2026 (محسوب من الخادم)              |
+----------------+---------------+---------------+----------------+----------------+-----------------+------------------+------------+
|  170,500.00 Dr |           --  |   50,500.00   |  1,000.00 USD  | شركة النيل · C1| البنك التجاري 110201 | JV-2026-000141 #1| 2026-10-12 |
|  169,250.00 Dr |           --  |   -1,250.00   |   -1,250.00 EGP| [ستورنو] C1    | البنك التجاري 110201 | JV-2026-000142 #1| 2026-10-14 |
|  154,250.00 Dr |   15,000.00   |           --  |            --  | مورد الدلتا· C2| البنك التجاري 110201 | PV-2026-000089 #2| 2026-10-19 |
|                |               |               |  ... نافذة افتراضية (صفوف 1-100 من الدفعة) ...                          |            |
+================+===============+===============+================+================+=================+==================+============+
|  154,250.00 Dr |   15,000.00   |   49,250.00   | إجمالي الفترة (من الخادم)       | [التالي >] [< السابق] [البداية] · 100 سطر       |
+----------------------------------------------------------------------------------------------------------+
```

#### Combination 2: `AR-RTL` × `Dark` (`dir="rtl"`, `html.dark`)
- **Visual Prose:** Canvas `--ink-950`; grid container `--ink-900` with `--ink-800` borders; sticky `<thead>` and `<tfoot>` `--ink-800/95` with `--ink-200` labels (`>= 7:1` contrast). Active keyboard-focused row uses `bg-accent/50` plus a `2px` inline-start `border-s-2 border-ring` indicator. Here the wireframe shows **raw `GET /accounting/journal-lines` keyset mode**, demonstrating the **honest no-client-sum `<tfoot>`** (`CG-DATA-01`) with the deep-link to General Ledger Report.

```text
+----------------------------------------------------------------------------------------------------------+
| [الفرع: كل الفروع] [الفترة: 2026-10] [بحث السطور...]          | عملة الشركة: EGP  | عرض الدفعة: [250 v]  |
+----------------------------------------------------------------------------------------------------------+
| النوع / الحالة |      دائن EGP |      مدين EGP |  مبلغ المعاملة | الطرف / الفرع  | الحساب          | مرجع السطر       | التاريخ    |
+================+===============+===============+================+================+=================+==================+============+
| [قيد قياسي]    |           --  |   50,500.00   |  1,000.00 USD  | النيل · CAI-01 | البنك 110201    | #1 · 0192e4a1... | 2026-10-12 |
|> [عكس · ستورنو]|           --  |   -1,250.00   |            --  | النيل · CAI-01 | البنك 110201    | #1 · 0192e5b8... | 2026-10-14<|
| [تسوية]        |   15,000.00   |           --  |            --  | الدلتا · ALX-02| الموردون 210101 | #2 · 0192e7c0... | 2026-10-19 |
+================+===============+===============+================+================+=================+==================+============+
| [التالي >] [< السابق] [البداية]  |  معروض 250 سطراً (مؤشر نشط) · [عرض الإجماليات في تقرير الأستاذ العام <-]        |
+----------------------------------------------------------------------------------------------------------+
```

#### Combination 3: `EN-LTR` × `Light` (`dir="ltr"`, `html:not(.dark)`)
- **Visual Prose:** Column flow runs **left-to-right**: `Posting Date` pinned at inline-start (left edge), then `Entry / Line`, `Account`, `Party / Dim`, `Txn Amount`, `Debit (EGP)`, `Credit (EGP)`, `Running Bal`. Numeric columns right-align (`text-end`) with `tabular-nums` so decimal points align vertically to the pixel across normal, foreign-currency, and negative `STORNO` rows.

```text
+----------------------------------------------------------------------------------------------------------+
| Account: 110201 Commercial Bank | [x] Txn Currency | As of 2026-11-01 14:30 · Chain #18,420 [Refresh]    |
+----------------------------------------------------------------------------------------------------------+
| Date       | Entry / Line      | Account              | Party / Dim    | Txn Amount    |   Debit (EGP) |  Credit (EGP) |  Running Bal  |
+============+===================+======================+================+===============+===============+===============+===============+
| Opening Balance for FY2026 (server-computed)                                           |   120,000.00  |           --  | 120,000.00 Dr |
+------------+-------------------+----------------------+----------------+---------------+---------------+---------------+---------------+
| 2026-10-12 | JV-2026-000141 #1 | 110201 Comm. Bank    | Nile Co · CC1  | 1,000.00 USD  |    50,500.00  |           --  | 170,500.00 Dr |
| 2026-10-14 | JV-2026-000142 #1 | 110201 Comm. Bank    | [Storno] · CC1 | -1,250.00 EGP |    -1,250.00  |           --  | 169,250.00 Dr |
| 2026-10-19 | PV-2026-000089 #2 | 110201 Comm. Bank    | Delta Sup · CC2|           --  |           --  |    15,000.00  | 154,250.00 Dr |
+============+===================+======================+================+===============+===============+===============+===============+
| Period Totals (server-computed) · 100 rows loaded                      |               |    49,250.00  |    15,000.00  | 154,250.00 Dr |
|                                                                        | Rows: [100 v] | [First] [< Prev] [Next >]                     |
+----------------------------------------------------------------------------------------------------------+
```

#### Combination 4: `EN-LTR` × `Dark` (`dir="ltr"`, `html.dark`)
- **Visual Prose:** Shows `AccountingLedgerGrid` with `LedgerDrillDrawer` open over the right (`inline-end`) edge on `--ink-900` elevated sheet (`border-s border-border`), preserving the underlying virtualized scroll offset and active cursor while inspecting `JV-2026-000142` (`REVERSAL`, `STORNO`, `chainSeq: 18412`, `entryHash` verified).

```text
+----------------------------------------------------------+-----------------------------------------------+
| Date       | Entry / Line      | Account        | Debit  | Entry JV-2026-000142             [Close Esc]  |
+============+===================+================+========+-----------------------------------------------+
| 2026-10-12 | JV-2026-000141 #1 | 110201 Bank    | 50,500 | Kind: [REVERSAL] [Storno] · Period: 2026-P10  |
|>2026-10-14 | JV-2026-000142 #1 | 110201 Bank    | -1,250<| Reverses: JV-2026-000139 (ERROR_CORRECTION)   |
| 2026-10-19 | PV-2026-000089 #2 | 110201 Bank    |     -- | Posting Date: 2026-10-14 · FX: 1.000000000000 |
+============+===================+================+========+ Chain: #18,412 · Hash: 9f4c...81e2 [Verify]   |
| 100 rows · [First] [< Prev] [Next >]                     |-----------------------------------------------|
|                                                          | #1 110201 Bank        Dr  -1,250.00 EGP [Sto] |
|                                                          | #2 410101 Sales Rev   Cr  -1,250.00 EGP [Sto] |
|                                                          |-----------------------------------------------|
|                                                          | Total Dr: -1,250.00 EGP | Cr: -1,250.00 EGP   |
|                                                          | [Open Reversed Entry]  [Open Fiscal Doc ->]   |
+----------------------------------------------------------+-----------------------------------------------+
```

#### Mobile `< 768px` (`375px` Viewport) Responsive Treatment
- Below `md` (`768px`), Users can toggle between **Compact Stacked Ledger Cards** (default on `375px`, zero horizontal scroll) and **Horizontal Scroll Table** (`overflow-x-auto` with pinned date/ref). Each stacked card (`min-h-11`, `p-3`, `border-b border-border`) renders Line 1: `<IdentifierText>{entryNo}</IdentifierText>` + `postingDate`; Line 2: Account code + name; Line 3: Side badge (`Dr`/`Cr` + `[Storno]`) + `<AccountingMoneyCell>` (`tabular-nums`). Tapping opens `LedgerDrillDrawer` as a bottom/full-height sheet with `44×44px` close and drill buttons.

---

## 2. S2 — Money Input and Display (`UX-07`)

### 2.1 Purpose & Consuming Screens

`MoneyInput`, `FxRateStrip`, and `AccountingMoneyCell` (`src/features/accounting/patterns/money/`) govern every monetary field, FX rate pin, company functional-currency lock, and table/statement cell across all Accounting screens (`SCR-JRN-DRAFT-FORM`, `SCR-DOC-FORM`, `SCR-AR-SETTLE`, `SCR-AP-PAY`, `SCR-TRS-TRANSFER`, `SCR-TRS-COUNT`, `SCR-AST-CREATE`, `SCR-OB-FORM`, and all `UX-05` / `UX-12` read surfaces).

### 2.2 Minor Units, Storage Scale & Rounding Law (`D-003`, `D-133`, `D-013`, `D-219`)

1. **Currency Catalogue Minor Units (`GET /api/tenant/core/v1/currencies`, permission `currencies.currency.read`):**
   - Cached per tenant session via `readCorePage` + `parseCorePageMeta` (`core-settings.md` § Workspace settings, pages of `100` up to `500` active currencies).
   - Standard minor-unit profiles supported natively:
     - **`0` decimals:** `JPY`, `KRW` (`12,500 JPY`).
     - **`2` decimals:** `EGP`, `SAR`, `AED`, `USD`, `EUR`, `GBP`, `QAR` (`12,500.50 EGP`).
     - **`3` decimals:** `KWD`, `BHD`, `OMR`, `JOD`, `TND` (`1,250.500 KWD`).
   - If the actor lacks `currencies.currency.read`, fallback minor-unit resolution uses standard ISO 4217 minor units (`Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions().maximumFractionDigits`) so `<AccountingMoneyCell>` and `<MoneyInput>` never crash or guess `2` for `KWD`.
2. **Wire Validation & Scale Rules:**
   - **Client Input (`MoneyInput`):** Emits canonical unsigned `DecimalString` (`^(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$`, `@IsDecimalString({ maxScale: 8, min: "0" })`). Client input is **never negative**: debit/credit side is carried exclusively on `direction: 'DEBIT' | 'CREDIT'` (`LineDirection`), and document reversal/credit-note semantics live in `DocumentKind` / `reverse` commands (`D-013`, `04_Errors_and_Constants.md` §4 rule 2).
   - **Legal Totals vs Unit/Line Precision:** Header/settlement/payment amounts enforce `maxScale = currency.decimalPlaces` (`0`, `2`, or `3`) so an operator cannot type `10.125 EGP` on a cash count or payment (`HALF_UP` legal scale, `D-003`, `D-133`). Unit prices, cost layers, and explicit high-precision line modes allow `maxScale = 8` (`decimalScaleMode: "CURRENCY_MINOR" | "STORAGE_8"`).
   - **Display (`AccountingMoneyCell`):** Parses the `DecimalString` **lexically** (splitting sign, integer digits, and fractional digits as strings — never `Number(amount)`, which loses precision above `2^53 - 1` on `numeric(24,8)`!). Formats integer group separators via `Intl.NumberFormat` (`ar-EG-u-nu-latn` / `en-US`) and pads fractional digits to `minFractionDigits = currency.decimalPlaces`, preserving any non-zero trailing digits up to scale `8` (e.g. `"1250.5"` in `KWD` renders `"1,250.500"`, while `"1250.50250000"` renders `"1,250.5025"`).

### 2.3 Input Ergonomics, Paste Normalization & Mobile Keyboard (`ui-ux-pro-max`)

- **DOM Element:** `<input type="text" inputMode="decimal" dir="ltr" autoComplete="off" autoCorrect="off" spellCheck={false}>` (`type="number"` is strictly banned: it strips trailing zeros, mutates values on mousewheel scroll, allows `"1e5"`, and coerces through IEEE-754 `double`).
- **Font Size on Touch:** Uses `text-base sm:text-sm font-normal tabular-nums text-end` (`16px` below `sm` prevents iOS Safari viewport auto-zoom on focus; `14px` dense desktop).
- **Bilingual Paste & Keystroke Normalization (`normalizeDecimalInput`):**
  - Translates Eastern Arabic digits (`٠١٢٣٤٥٦٧٨٩` -> `0123456789`), Extended Arabic-Indic digits (`۰۱۲۳۴۵۶۷۸۹` -> `0123456789`), and Arabic decimal separator (`٫` U+066B -> `.`).
  - Strips grouping commas/spaces/Arabic thousands separator (`٬` U+066C, `,`, ` `, `\u00A0`) on paste (so pasting `"1,250,000.75"` or `"١٬٢٥٠٫٧٥"` from Excel cleanly yields `"1250000.75"` / `"1250.75"`).
  - If pasted text contains `-`, `(100.00)`, `+`, scientific notation `e`/`E`, currency words, or multiple decimal points, `MoneyInput` **does not silently discard digits** — it sets inline field validation error explaining why (e.g., *"Amounts cannot be negative; choose Debit or Credit instead"* / *"لا تقبل المبالغ إشارة سالبة؛ اختر مدين أو دائن لتحديد الاتجاه"*).
  - On `blur`, trims leading zeros (`"0012.5"` -> `"12.50"` formatted in view, `"12.5"` or `"12.50"` canonical `DecimalString` on wire; trailing `.` `"12."` -> `"12"`).

### 2.4 Functional Currency, Transaction Currency & FX Pinning (`FxRateStrip`)

1. **Company Functional Currency & Freeze Banner (`D-007`):**
   - Read from `GET /api/tenant/accounting/v1/company-profile` (`CompanyProfileDetailDto`: `functionalCurrencyCode`, `currencyFrozen`, `firstPostingAt`).
   - On Company Profile settings (`SCR-SET-COMPANY`), when `currencyFrozen === true`, the `functionalCurrencyCode` field renders `readOnly` with a lock icon and persistent neutral notice: *"Functional currency (EGP) is permanently locked after the company's first ledger posting on 2026-01-02."* (`العملة الوظيفية (EGP) مقفلة نهائياً بعد أول قيد مرحّل للشركة بتاريخ 2026-01-02` — prevents `422 ACCOUNTING.PROFILE.CURRENCY_FROZEN`).
2. **Automatic Date-Effective FX Resolution (`POST /api/tenant/accounting/v1/fx-rates/resolve`, `D-008`, `D-058`):**
   - Triggered automatically (debounced `250ms`, abortable) whenever `currencyCode !== functionalCurrencyCode` AND `onDate` (`postingDate` / `documentDate` / `settledOn`) is valid. **Never sends browser wall-clock today's date (`new Date()`)** unless that date is the user's explicit transaction date!
   - Request body (`ResolveFxRateQueryDto`): `{ fromCurrencyCode: currencyCode, toCurrencyCode: functionalCurrencyCode, rateType: "SPOT", onDate }`. Permission: `accounting.fx_rate.resolve`.
   - Response (`FxPinDto`): `{ rateId, rateValue, revision, rateType, effectiveFrom, providerCode, pegged, legs }`.
   - `FxRateStrip` pins `fxRateId = data.rateId` into the form state and renders:
     - Rate value (`<bdi dir="ltr">1 USD = 50.500000 EGP</bdi>`, full significant scale up to `12` decimals on hover/expand), `providerCode` (`CBE`, `ECB`, `SAMA`, `CBUAE`, `MANUAL`), `rateType` (`SPOT`), and `effectiveFrom`.
     - **Triangulation Disclosure:** When `legs.length === 2` (cross-rate triangulated through an intermediate currency), expands a subtle pill: `"Triangulated via EUR (2 legs)"` (`مُثلّث عبر EUR على مرحلتين`).
     - **Pegged Pair Lock:** When `pegged === true` (e.g., `USD/SAR` or `USD/AED` official peg), renders `[Pegged]` / `[مربوط رسمياً]` lock badge and **hides/disables FX override** (`422 ACCOUNTING.FX.PEGGED_OVERRIDE_FORBIDDEN`).
     - **Missing Rate (`422 ACCOUNTING.FX.RATE_NOT_FOUND`):** Renders inline caution banner with Cause + Effect + Action and a permission-gated (`accounting.fx_rate.create`) `"Add FX Rate"` (`إضافة سعر صرف`) quick link to `/accounting/masters/fx-rates`.
3. **Pre-Save vs Post-Save `amountFunctional` Honesty (`CG-DATA-04`):**
   - Because client-side FX multiplication/rounding is forbidden (`data-layer.md`), `CreateJournalDraftDto` / `UpdateJournalDraftDto` omits `amountFunctional` on foreign-currency lines and sends `{ amountTxn, currencyCode }` with header/line `fxRateId`. Before draft save, the functional column displays `"Calculated on save (rate 50.50)"` (`يُحتسب عند الحفظ (بسعر 50.50)`); immediately after draft save, it displays the server's exact `amountFunctional`.
4. **Authorized FX Override (`PostJournalDraftDto`):**
   - Shown only when: (a) actor holds `accounting.journal_entry.override_fx`, (b) `pegged === false`, and (c) draft `status` is not frozen by an active approval (`PENDING_APPROVAL` / `APPROVED`, `409 ACCOUNTING.ENTRY.DRAFT_FROZEN`).
   - Selecting an alternate `overrideFxRateId` immediately reveals a mandatory `overrideReason` `<Textarea>` (`10..1,000` trimmed chars, live character counter `10 / 1000`).

### 2.5 Direction, Sign & Storno Cues (Non-Colour Accessibility)

| Context | Wire Shape | Visual & Screen-Reader Rendering |
| --- | --- | --- |
| Entry / Draft Debit | `direction: "DEBIT"`, `amount: "1500.00"`, `isStorno: false` | `<bdi dir="ltr">1,500.00 EGP</bdi>` + `Dr` / `مدين` label (`text-foreground`, `font-normal`) |
| Entry / Draft Credit | `direction: "CREDIT"`, `amount: "1500.00"`, `isStorno: false` | `<bdi dir="ltr">1,500.00 EGP</bdi>` + `Cr` / `دائن` label (`text-foreground`, `font-normal`) |
| Storno Reversal Line | `direction: "DEBIT"`, `amount: "-1500.00"`, `isStorno: true` | `<bdi dir="ltr">-1,500.00 EGP</bdi>` + `StatusBadge(tone="negative", label=t.accounting.storno)` (`[Storno]` / `[ستورنو]`) |
| Revaluation Storno (`D-229`) | `amountTxn: "0"`, `amountFunctional: "-420.00"`, `isStorno: true` | Txn cell: `0.00 USD`; Functional cell: `-420.00 EGP` + `[Storno]` badge |
| Statement Negative / Contra | Server-computed negative `DecimalString` (`"-8500.00"`) | Accounting parentheses `(8,500.00)` OR leading minus `-8,500.00` inside `<bdi dir="ltr">` (`aria-label` announces negative amount explicitly) |

### 2.6 TypeScript Interfaces (`UX-07`)

```ts
export interface MoneyInputProps {
  id?: string;
  value: string;                              // Canonical unsigned DecimalString ("" when empty)
  onValueChange: (next: string) => void;
  currencyCode: string;                       // ISO 4217 uppercase 3-char
  onCurrencyChange?: (nextCurrency: string) => void;
  allowedCurrencies?: readonly CurrencyOption[];
  minorUnits: 0 | 2 | 3;                      // From Core currencies.decimal_places
  scaleMode?: "CURRENCY_MINOR" | "STORAGE_8"; // Default "CURRENCY_MINOR"
  allowZero?: boolean;                        // true on draft lines (with revaluation rules), false on payments
  directionBadge?: "DEBIT" | "CREDIT";        // Optional explicit side indicator inside field addon
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  onBlur?: () => void;
}

export interface FxRateStripProps {
  fromCurrencyCode: string;
  functionalCurrencyCode: string;
  onDate: string;                             // YYYY-MM-DD transaction/posting date (never wall clock)
  resolvedPin: FxPinDto | null;
  loading: boolean;
  error?: NormalizedApiError | null;
  canOverrideFx: boolean;                     // hasPermission('accounting.journal_entry.override_fx')
  draftFrozenByApproval: boolean;
  overrideFxRateId?: string;
  overrideReason?: string;
  onOverrideChange?: (rateId: string | undefined, reason: string) => void;
  onRetryResolve: () => void;
}
```

### 2.7 Visual Prose & ASCII Wireframes — All Four Combinations

#### Combination 1: `AR-RTL` × `Light` (`dir="rtl"`, `html:not(.dark)`)
- **Visual Prose:** Field label (`المبلغ بعملة المعاملة *`) aligns inline-start (right). Inside the composite input (`bg-card border-border rounded-md h-9`), the currency selector (`KWD · 3 منازل`) sits on the inline-start (right) addon while the numeric `<input dir="ltr">` aligns its Western digits to the left/decimal-aligned end with `3` minor places (`1,250.500`). Below it, `FxRateStrip` (`bg-muted/60 border-border rounded-md p-2.5`) displays the pinned `CBE` `SPOT` rate as of `2026-10-15` and the honest pre-save functional note.

```text
+------------------------------------------------------------------------------------+
| المبلغ بعملة المعاملة *                                                [مدين Dr]   |
| +--------------------------------------------------------------+-----------------+ |
| |                                                    1,250.500 | [v KWD · 3 خانات]| |
| +--------------------------------------------------------------+-----------------+ |
| +--------------------------------------------------------------------------------+ |
| | سعر الصرف المثبّت (2026-10-15 · CBE · SPOT):  1 KWD = 158.420000 EGP           | |
| | المقابل بالعملة الوظيفية (EGP): يُحتسب عند حفظ المسودة بالسعر المثبّت          | |
| | [تجاوز سعر الصرف...] (يتطلب سبب التجاوز 10-1000 حرف)                          | |
| +--------------------------------------------------------------------------------+ |
+------------------------------------------------------------------------------------+
```

#### Combination 2: `AR-RTL` × `Dark` (`dir="rtl"`, `html.dark`)
- **Visual Prose:** Surface `--ink-900`, input `--ink-950` with `border-destructive` (`--negative-500`) illustrating a **paste validation refusal** when the user pasted `"-500.00"` into a client input, plus a **Pegged Pair (`USD -> SAR`)** `FxRateStrip` where override is locked (`pegged: true`).

```text
+------------------------------------------------------------------------------------+
| المبلغ بعملة المعاملة *                                                [دائن Cr]   |
| +--------------------------------------------------------------+-----------------+ |
| | !                                                    -500.00 | [v USD · خانتان] | |
| +--------------------------------------------------------------+-----------------+ |
| ! لا تقبل مبالغ الإدخال إشارة سالبة. أزل الإشارة (-) وحدد الاتجاه (مدين أو دائن).  |
| +--------------------------------------------------------------------------------+ |
| | [قفل: مربوط رسمياً] 1 USD = 3.750000 SAR · SAMA · 2026-10-15                   | |
| | لا يمكن تجاوز سعر الصرف للأزواج المربوطة رسمياً (PEGGED_OVERRIDE_FORBIDDEN).   | |
| +--------------------------------------------------------------------------------+ |
+------------------------------------------------------------------------------------+
```

#### Combination 3: `EN-LTR` × `Light` (`dir="ltr"`, `html:not(.dark)`)
- **Visual Prose:** Currency selector (`USD · 2 dec`) sits on inline-start (left); `<input dir="ltr">` right-aligns `1,000.00`. Below, `FxRateStrip` shows an **active FX override** (`canOverrideFx = true`, `pegged = false`) with the required `overrideReason` textarea and live character counter (`42 / 1,000`).

```text
+------------------------------------------------------------------------------------+
| Transaction Amount *                                                   [Debit Dr]  |
| +---------------+----------------------------------------------------------------+ |
| | [USD · 2d  v] |                                                       1,000.00 | |
| +---------------+----------------------------------------------------------------+ |
| +--------------------------------------------------------------------------------+ |
| | Pinned FX (2026-10-15 · CBE · SPOT): 1 USD = 50.500000 EGP  [Triangulated: No] | |
| | Override FX Rate: [Manual Rate rev #4 · 1 USD = 50.650000 EGP              v]  | |
| | Override Reason * (min 10 chars)                                    42 / 1,000 | |
| | +----------------------------------------------------------------------------+ | |
| | | Per bank deal ticket #FX-88412 agreed for export proceeds settlement.      | | |
| | +----------------------------------------------------------------------------+ | |
| +--------------------------------------------------------------------------------+ |
+------------------------------------------------------------------------------------+
```

#### Combination 4: `EN-LTR` × `Dark` (`dir="ltr"`, `html.dark`)
- **Visual Prose:** Shows **Saved Draft Line + Missing FX Rate Error State** on `--ink-900` dark card: top row shows a saved line whose server-computed `amountFunctional` (`50,500.00 EGP`) is now locked in; bottom row shows `422 ACCOUNTING.FX.RATE_NOT_FOUND` in a `caution` banner (`bg-caution-subtle border-caution-border text-caution-foreground`) with Cause + Effect + Action.

```text
+------------------------------------------------------------------------------------+
| Saved Line #1:  1,000.00 USD  ->  Server Functional: 50,500.00 EGP (Pinned #0192a) |
+------------------------------------------------------------------------------------+
| Line #2 Transaction Amount *                                          [Credit Cr]  |
| +---------------+----------------------------------------------------------------+ |
| | [GBP · 2d  v] |                                                         750.00 | |
| +---------------+----------------------------------------------------------------+ |
| +--------------------------------------------------------------------------------+ |
| | ! No SPOT exchange rate found for GBP -> EGP on 2026-10-15.                    | |
| |   This draft cannot be saved or posted until a rate is available for this date.| |
| |   [Retry Resolution]   [Open FX Rates Master ->]                               | |
| +--------------------------------------------------------------------------------+ |
+------------------------------------------------------------------------------------+
```

---

## 3. S3 — Account, Party, Dimension, and Period Pickers (`UX-08`)

All four Accounting pickers (`src/features/accounting/patterns/pickers/`) wrap the `@/design-system` `Combobox` (`modal` Radix `Popover`, ARIA 1.2 `role="combobox"` on the search `<Input>`, `aria-activedescendant`, `300ms` debounced remote search, explicit `loadingLabel`, `emptyLabel`, and `errorContent` retry slot). Zero browser-side array filtering over partial pages: every query dispatches to the server with abortable `AbortSignal`, and `selectedLabel` preserves the committed item's human label when the current search page does not contain it.

### 3.1 `AccountPicker` (`UX-08a`)

#### Backing Endpoints & Selection Flow
1. **Option List & Search:**
   - Primary rich list: `GET /api/tenant/accounting/v1/accounts` (`AccountListQueryDto`: `chartId` required, `accountType?`, `classification?`, `isPostable?`, `isControl?`, `groupId?`, `parentId?`, `role?`, `includeDeprecated?`) or `POST /api/tenant/accounting/v1/accounts/search` (`AccountSearchDto` with `search` `1..80` chars on allowlisted `code`, `name_i18n`, `tags`). Permission: `accounting.account.read`; Feature: `accounting.ledger.core`; Scope: `OPERATING_CONTEXT`.
   - Group hierarchy breadcrumbs: `GET /api/tenant/accounting/v1/account-groups?chartId=<chartId>` (`accounting.chart.read`, cached per chart).
   - Lightweight fast lookup (filter bars only): `POST /api/tenant/accounting/v1/accounts/lookup` (`AccountLookupQueryDto`).
2. **Eligibility Fields (`CG-DATA-03`, closed by `D-770`):**
   - `AccountSummaryDto` (`02_DTOs.md` §4.4) carries `parentId`, `depth`, `groupId`, `allowManualJournal`, `currencyCode` and `requiresDimensionTypeCodes`, so options from the rich list or `POST /accounts/search` already hold them and `AccountLookupQueryDto.manualJournalOnly?` filters server-side. Only an option chosen from the lightweight lookup (`LookupItemDto`) resolves `GET /api/tenant/accounting/v1/accounts/:id` (`AccountDetailDto`, cached in-memory per `(companyId, accountId)`) before use:
     - If `mode === "MANUAL_JOURNAL_LINE"` and `detail.allowManualJournal === false` (true on all `AR_CONTROL`, `AP_CONTROL`, cash, and bank accounts, `02_Ledger_Tables.md` line 186), blocks commitment with inline explanation preventing `422 ACCOUNTING.ENTRY.CONTROL_ACCOUNT_MANUAL`.
     - If `detail.currencyCode !== null`, emits `lockedCurrencyCode` to the sibling `MoneyInput` so transaction currency locks to the account's single currency.
     - Emits `detail.requiresDimensionTypeCodes` (`string[]`) to the sibling `DimensionSetPicker` (`D-326`).

#### Context Modes & Disabled-Option Rules
| Picker Mode | Query Defaults | Visible-Disabled Rows (`disabled: true` + Reason Subtitle) |
| --- | --- | --- |
| `MANUAL_JOURNAL_LINE` | `isPostable=true`, `includeDeprecated=false` | Group/header accounts (`isPostable=false`: *"Header account — choose a postable child"*); Control/Cash/Bank accounts (`isControl=true` or `allowManualJournal=false`: *"Control/System account — post via subledger/treasury"*); Deprecated accounts (`deprecatedAt !== null`: *"Deprecated — historical read only"*). |
| `ROLE_OR_MAPPING` | `isPostable=true` (or `false` for `ACCOUNT_SUBTREE`), `accountType?` | Accounts of incompatible `AccountType` for the slot (`ck_acc_asset_categories_account_roles_shape`). |
| `REPORT_OR_GRID_FILTER` | `includeDeprecated=true` (toggleable), multi-select `<= 200` (`MAX_FILTER_IDS`) | None disabled — deprecated and merged accounts remain selectable so historical ledger lines can be audited (`D-176`). |

### 3.2 `PartyPicker` (`UX-08b`)

#### Multi-Endpoint Composition & `Q14` Permission Boundary
Accounting stores `partyId` (Core Party UUIDv7) and owns financial terms, credit holds, and tax-ID verification, while Core Directory owns `displayName`, `legalName`, and `CUSTOMER`/`SUPPLIER` role assignments (`accounting-ia.md` Q14, `CG-DATA-05`):

1. **When `hasPermission('directory.party.read')` is true (Standard Path):**
   - Queries `GET /api/tenant/core/v1/directory/parties` (`PartyQueryDto`: `roleType = "CUSTOMER"` when `side === "AR"`, `roleType = "SUPPLIER"` when `side === "AP"`, `status = "ACTIVE"` on entry forms).
   - Parallel enrichment (when `hasPermission('accounting.party_finance_profile.read')`): `GET /api/tenant/accounting/v1/party-finance-profiles` joins by `partyId` to attach:
     - `partyType: ReceiverType` (`B` Business, `P` Natural Person, `F` Foreign),
     - `onCreditHold: boolean` -> renders `StatusBadge(tone="caution")` (`[Credit Hold]` / `[إيقاف ائتماني]`),
     - `defaultCurrencyCode` & `paymentTermsId` (pre-fills document currency and due-date calculation inputs).
   - Tax-ID risk badge (on `AP` purchase bills when `hasPermission('accounting.profile.read')`): reads `GET /api/tenant/accounting/v1/tax-id-validations` for the selected party; if status is `INVALID` or `EXPIRED`, displays a non-blocking `caution` pill (`Tax ID unverified — input tax deduction may be at risk`, `D-196`).
2. **When `hasPermission('directory.party.read')` is false (`Q14` Fallback Path):**
   - Never renders a blocking `403` crash inside a journal or open-item filter!
   - Falls back to `POST /api/tenant/accounting/v1/party-finance-profiles/lookup` (when `accounting.party_finance_profile.read` is held; `PartyFinanceProfileLookupItemDto` returns `partyId` and a `label` read from Core in one batched call, `partyId` when Core does not answer, `D-770`) plus direct UUIDv7 paste/entry (`<Input dir="ltr" font-mono>`) displaying `<IdentifierText>{partyId}</IdentifierText>` with helper text: *"Directory name read is not granted for your role; referencing party by verified ID."* (`صلاحية قراءة أسماء الدليل غير ممنوحة لدورك؛ يتم المرجع بمعرّف الطرف`).

### 3.3 `DimensionSetPicker` (`UX-08c`)

#### Backing Endpoints & Slot Architecture
- Loads active company dimension types once per `(companyId)` via `GET /api/tenant/accounting/v1/dimension-types` (`accounting.dimension.read`).
- Each dimension slot queries `GET /api/tenant/accounting/v1/dimension-values?dimensionTypeId=<id>&validOn=<postingDate>&includeBlocked=false` (or `POST /api/tenant/accounting/v1/dimension-values/lookup` for type-ahead when a dimension has `> 50` values).
- **Two-Tier Slot Layout (`D-025`, `ACCOUNTING_LIMITS.MAX_DIMENSIONS_PER_SET = 8`):**
  1. **Inline Hot Slots (`hotSlot` `1..4`, e.g. `1 = COST_CENTER`):** Rendered inline in the form/line drawer so the accountant never opens an extra modal for Cost Center.
  2. **Overflow Dimension Popover (`slots 5..8`):** If the company defines additional dimension types without a hot slot (up to `8` total members per set), renders an `"Additional Dimensions (N/M)"` (`أبعاد إضافية`) trigger button; if any overflow dimension is required by the selected account, the popover badge switches to `tone="caution"` (`Required *`) and auto-expands on validation failure.
- **Dynamic Requiredness & Missing-Type Guard (`D-326`):**
  - Slot `T` is mandatory when `T.isRequiredDefault === true` OR `selectedAccount.requiresDimensionTypeCodes.includes(T.code)`.
  - If `selectedAccount.requiresDimensionTypeCodes` contains a code absent from the company's live `dimension-types`, renders an inline `negative` alert naming the missing code (`ACCOUNTING.ENTRY.DIMENSION_REQUIRED`).
- **Date-Validity Re-validation:** Changing header `postingDate` re-validates every selected `dimensionValueId` against `[validFrom, validTo]` and `blockedFrom`; any value invalid on the new `postingDate` highlights `aria-invalid="true"` with `"Value CC-09 expired on 2026-09-30 for posting date 2026-10-15"` (`القيمة CC-09 انتهت صلاحيتها في 2026-09-30 لتاريخ الترحيل 2026-10-15`).
- **Report Filter Variant (`DimensionFilterPicker`):** Enforces `<= 4` dimension types and `<= 200` (`MAX_FILTER_IDS`) values per type (`includeBlocked=true` enabled for historical reporting).

### 3.4 `FiscalPeriodPicker` (`UX-08d`)

#### Backing Endpoints & Module-State Gating
- Reads `GET /api/tenant/accounting/v1/fiscal-years` (`FiscalYearListQueryDto`), `GET /api/tenant/accounting/v1/periods` (`FiscalPeriodListQueryDto`), and (on posting screens) `GET /api/tenant/accounting/v1/user-period-overrides`.
- **Two-Stage Coordinated Control:**
  1. **Fiscal Year `<Select>`:** Displays `code` (`FY2026`), date span (`2026-01-01 – 2026-12-31`), and `FiscalYearStatus` `StatusBadge` (`OPEN` `positive`, `CLOSING` `caution`, `FUTURE`/`CLOSED`/`LOCKED` `neutral`).
  2. **Fiscal Period `<Combobox>` / `<Select>`:** Lists periods ordered by `periodNo` (`P00 OPENING`, `P01..P12 NORMAL`, `P13 ADJUSTMENT`, `P14 CLOSING`). Each row displays:
     - `<IdentifierText>P{periodNo}</IdentifierText>` + localized `PeriodKind` badge (`افتتاحية` / `عادية` / `تسويات` / `إقفال`),
     - Date range (`startDate – endDate` in Western digits),
     - Module state `StatusBadge` for the caller's `targetModule: PeriodModule` (`GL`, `AR`, `AP`, or `TAX`).
- **Selection Eligibility Matrix (`mode: "POSTING" | "REPORT_FILTER"`):**
  - In `REPORT_FILTER` mode: **every** period (`FUTURE`, `OPEN`, `SOFT_CLOSED`, `CLOSED`, `PERMANENTLY_CLOSED`) and **every** `PeriodKind` is selectable.
  - In `POSTING` mode:
    - `OPEN`: selectable.
    - `SOFT_CLOSED`: selectable **only** when a live `user-period-overrides` grant matches `(userId, periodId, targetModule)` and `expiresAt > now` (shows `[Override active]` / `[تصريح استثنائي نشط]`); otherwise `disabled: true` with subtitle `"Soft-closed for GL — override required"` (`مقفلة مبدئياً للأستاذ العام — يتطلب تصريحاً`).
    - `FUTURE`, `CLOSED`, `PERMANENTLY_CLOSED`: `disabled: true` with exact state reason (`"Future year not opened"`, `"Closed"`, `"Permanently closed — irreversible"`).
    - `OPENING` and `CLOSING` kinds: disabled on ordinary manual drafts (`"Reserved for opening batch / year-end close"`, `D-355`).

### 3.5 TypeScript Interfaces (`UX-08`)

```ts
export interface AccountPickerProps {
  chartId: string;
  mode: "MANUAL_JOURNAL_LINE" | "ROLE_OR_MAPPING" | "REPORT_OR_GRID_FILTER";
  value?: string;
  selectedAccount?: AccountSummaryDto | AccountDetailDto | null;
  onSelect: (account: AccountDetailDto | null) => void;
  accountTypeFilter?: AccountType;
  roleFilter?: AccountRole;
  disabled?: boolean;
  invalid?: boolean;
}

export interface PartyPickerProps {
  side: "AR" | "AP" | "ANY";
  mode: "ENTRY_FORM" | "FILTER";
  value?: string;
  onSelect: (selection: {
    partyId: string;
    displayName: string | null;       // null under Q14 UUID fallback
    financeProfile?: PartyFinanceProfileSummaryDto | null;
    taxIdStatus?: TaxIdValidationStatus | null;
  } | null) => void;
  disabled?: boolean;
  invalid?: boolean;
}

export interface DimensionSetPickerProps {
  postingDate: string;                // YYYY-MM-DD — drives validOn
  requiredTypeCodes: readonly string[]; // Merged from account.requiresDimensionTypeCodes + isRequiredDefault
  value: DimensionSetInput;           // { members: [{ dimensionTypeId, dimensionValueId }] }
  onChange: (next: DimensionSetInput) => void;
  disabled?: boolean;
}

export interface FiscalPeriodPickerProps {
  mode: "POSTING" | "REPORT_FILTER";
  targetModule: PeriodModule;         // "GL" | "AR" | "AP" | "TAX"
  fiscalYearId?: string;
  periodId?: string;
  allowAdjustmentPeriodsOnly?: boolean;
  onChange: (next: { fiscalYearId: string; periodId: string; period: FiscalPeriodSummaryDto }) => void;
  disabled?: boolean;
}
```

### 3.6 Visual Prose & ASCII Wireframes — All Four Combinations

#### Combination 1: `AR-RTL` × `Light` — `AccountPicker` Open Popover (`MANUAL_JOURNAL_LINE`)
- **Visual Prose:** Trigger and modal popover (`bg-card border-border shadow-md rounded-md`) align inline-start (right). Search `<Input role="combobox">` sits pinned at top (`border-b border-border`). Group headers (`1 الأصول > 11 الأصول المتداولة`) render as non-selectable `text-xs font-medium text-muted-foreground` rows; `110101 العملاء` (`isControl = true`) appears muted (`opacity-60 cursor-not-allowed`) with explicit reason preventing `CONTROL_ACCOUNT_MANUAL`; `110301 مصروفات مدفوعة مقدماً` is highlighted active (`bg-accent`) with `[مدين Dr]` normal-balance badge and `[يتطلب: مركز تكلفة]` pill.

```text
+--------------------------------------------------------------------------------+
| الحساب *                                                                       |
| [v  110301 · مصروفات مدفوعة مقدماً                                           ] |
+--------------------------------------------------------------------------------+
  | [بحث بالكود أو الاسم: 110...                                  ] (combobox) |
  +----------------------------------------------------------------------------+
  | 1 الأصول > 11 الأصول المتداولة (مجموعة رئيسية)                             |
  |   [مقفل] 110101 · إجمالي العملاء (حساب رقابي — يُرحّل عبر الذمم المدينة)    |
  |   [مقفل] 110201 · البنك التجاري USD (حساب بنكي — يُرحّل عبر الخزينة)       |
  | > [✓]    110301 · مصروفات مدفوعة مقدماً        [طبيعة: مدين] [يتطلب: CC] < |
  |          110402 · عهد موظفين تشغيلية           [طبيعة: مدين]               |
  +----------------------------------------------------------------------------+
```

#### Combination 2: `AR-RTL` × `Dark` — `PartyPicker` (`side="AR"`, Credit Hold + `Q14` Fallback Note)
- **Visual Prose:** Dark popover (`--ink-900`, border `--ink-800`). Shows active `CUSTOMER` results from Core Directory enriched with `PartyFinanceProfile` badges: row 2 (`شركة الدلتا للتوريدات`) carries `StatusBadge(tone="caution")` (`[إيقاف ائتماني]`) + `[أعمال B]` + `<bdi dir="ltr">TAX: 204-891-332</bdi>`, keeping the warning unmistakable before the user creates an invoice or settlement.

```text
+--------------------------------------------------------------------------------+
| العميل (الذمم المدينة AR) *                                                    |
| [v  شركة الدلتا للتوريدات · B · 204-891-332                [إيقاف ائتماني !] ] |
+--------------------------------------------------------------------------------+
  | [بحث باسم العميل أو الرقم الضريبي...                          ] (combobox) |
  +----------------------------------------------------------------------------+
  |   شركة النيل للصناعات الحديثة          [أعمال B] · TAX: 100-442-819 · EGP |
  | > شركة الدلتا للتوريدات     [إيقاف ائتماني !] [أعمال B] · TAX: 204-891-332< |
  |   أحمد محمود عبد الرحمن               [فرد P]   · EGP                     |
  +----------------------------------------------------------------------------+
  | تنبيه استشاري: العميل خاضع لإيقاف ائتماني نشط. يُسمح بتسجيل التحصيلات والإشعارات.|
  +----------------------------------------------------------------------------+
```

#### Combination 3: `EN-LTR` × `Light` — `DimensionSetPicker` (Hot Slots `1..2` + Overflow Popover)
- **Visual Prose:** Compact inline bar inside a journal draft line (`bg-muted/40 border-border rounded-md p-2`). `Cost Center *` (`hotSlot = 1`, required by account `510101`) and `Project` (`hotSlot = 2`) sit inline; `"More Dimensions (1/2) *"` button opens a `Popover` for slots `5..8`, flagging an expired value when `postingDate` moved to `2026-10-15`.

```text
+--------------------------------------------------------------------------------+
| Analytical Dimensions (valid on Posting Date: 2026-10-15)                      |
| +-------------------------------+ +---------------------------+ +------------+ |
| | Cost Center *                 | | Project                   | | +2 Dims *  | |
| | [CC-102 · Cairo Ops        v] | | [PRJ-04 · ERP Rollout  v] | | [1/2 Set v]| |
| +-------------------------------+ +---------------------------+ +------------+ |
|   └─ Popover (Slots 3..8, max 8 total):                                        |
|      Sales Channel *: [! CH-OLD · Legacy Retail (Expired 2026-09-30)       v]  |
|      ! Selected value is not valid on 2026-10-15. Pick an active channel.      |
+--------------------------------------------------------------------------------+
```

#### Combination 4: `EN-LTR` × `Dark` — `FiscalPeriodPicker` (`mode="POSTING"`, `targetModule="GL"`)
- **Visual Prose:** Dark surface (`--ink-900`). Coordinated `FiscalYear` (`FY2026 · OPEN`) + `FiscalPeriod` dropdown showing `PeriodKind` and `GL` module state badges: `P09` is `CLOSED` (`disabled`, `tone="neutral"`), `P10` is `SOFT_CLOSED` (`tone="caution"`, **enabled** for this operator because `user-period-overrides` returned a live grant expiring `2026-11-03`), `P11` is `OPEN` (`tone="positive"`), and `P13 ADJUSTMENT` is clearly labeled for year-end adjustments.

```text
+--------------------------------------------------------------------------------+
| Fiscal Year *              | Accounting Period (Module: GL) *                  |
| [FY2026 (Open)          v] | [P10 · 2026-10-01..2026-10-31 [Soft Closed]    v] |
+----------------------------+---------------------------------------------------+
                               | [Search period...                             ] |
                               +-------------------------------------------------+
                               | [Locked] P09 · Normal · 2026-09-01..30 [Closed] |
                               |> [✓]     P10 · Normal · 2026-10-01..31 [Soft]  <|
                               |          └─ Override active until 2026-11-03    |
                               |          P11 · Normal · 2026-11-01..30 [Open]   |
                               |          P13 · Adjust · 2026-12-31     [Open]   |
                               | [Locked] P14 · Closing· 2026-12-31 (System only)|
                               +-------------------------------------------------+
```

---

## 4. S4 — Report Viewer (`UX-12`)

### 4.1 Purpose & Unified Dual-Path Architecture

`AccountingReportViewer` (`src/features/accounting/patterns/report-viewer/`) is the single interactive financial statement, register, and audit-schedule workspace for all Accounting report screens (`SCR-RPT-*`):

1. **Path A — Read-Model Reports (`GET /api/tenant/accounting/v1/reports/<slug>`, `02_Endpoint_Catalogue.md` §12):**
   - Covers the 12 typed read models: `trial-balance`, `general-ledger`, `party-ledger`, `aging`, `cash-position`, `tax-report`, `sales-register`, `purchase-register`, `withholding-register`, `cheque-register`, `depreciation-schedule`, and `deferrals`.
   - `general-ledger` mounts `AccountingLedgerGrid` (`UX-05`, keyset mode) inside the `AccountingReportViewer` header/parameter/freshness chrome.
   - `trial-balance` returns `200` inline within the synchronous query budget, or `202 Accepted` + `Location` (`/api/tenant/accounting/v1/reports/runs/:id`) + `Retry-After` when the requested span/granularity exceeds budget (`D-165`, `D-166`).
2. **Path B — Definition-Driven Statements (`POST /api/tenant/accounting/v1/reports/:code/run`, `RunReportDto`, `02_Endpoint_Catalogue.md` §10 & §12):**
   - Covers all `PUBLISHED` definitions in `acc_report_definitions`: `EG_BALANCE_SHEET`, `EG_INCOME_STATEMENT_NATURE`, `EG_INCOME_STATEMENT_FUNCTION`, `EG_COMPREHENSIVE_INCOME`, `EG_CHANGES_IN_EQUITY`, `EG_CASH_FLOW_INDIRECT`, `EG_CASH_FLOW_DIRECT`, `EG_NOTES`, `EG_TAX_ADJUSTMENT_SCHEDULE`, `JOURNAL_AUDIT`, `ASSET_REGISTER`, `UNREALIZED_FX`, `NON_DEDUCTIBLE`, `AUDIT_TRAIL`, `IMMUTABILITY`, `ANALYTICAL`, and `MARGIN`.
   - Read-like `POST` (`idempotent: none`, no `x-idempotency-key`); returns `200` inline within budget or `202` + `Location` + `Retry-After` beyond budget.

### 4.2 File Split (`< 300` Lines Per File)

- `hooks/useAccountingReportViewer.ts`: Manages parameter state, `<= 3` fiscal-year span validation (`MAX_REPORT_YEARS = 3`), sync `200` vs async `202` `Retry-After` polling loop (`GET /api/tenant/accounting/v1/reports/runs/:id`), preflight coverage check (`GET /api/tenant/accounting/v1/report-definitions/:id/coverage`), snapshot creation (`POST /api/tenant/accounting/v1/reports/snapshots`), and export job lifecycle (`POST /api/tenant/accounting/v1/exports/:code/run` -> `GET .../runs/:id` -> `GET .../runs/:id/download`).
- `AccountingReportViewer.tsx`: Composes `PageHeader` (housing the single `variant="primary"` `"Run Report"` / `"تشغيل التقرير"` button), `ReportFreshnessBar`, `ReportParameterBar`, `ReportCoverageAlert`, `StatementTreeTable`, and `ReportExportDrawer`.
- `StatementTreeTable.tsx`: Semantic hierarchical statement table (`depth` `1..8`) with keyboard tree navigation, comparative columns, note badges, and parameterized drill-through links.

### 4.3 Parameter Bar, Coverage Preflight & Unposted Watermark Rules

1. **Parameter Controls (`ReportParameterBar`):**
   - **Range vs Point-in-Time:** Renders `FiscalPeriodPicker` (`mode="REPORT_FILTER"`) + custom `fromDate` / `toDate` (`YYYY-MM-DD`, enforcing `toDate >= fromDate` and span `<= 3` fiscal years) for movement/range reports, or `asOfDate` for position reports (`trial-balance`, `aging`, `cash-position`, `deferrals`).
   - **Comparative Period (`D-104`, EAS 1):** When `definition.comparativesRequired === true`, defaults `comparativePeriod` to the prior fiscal year's matching dates (with presets: `"Prior Year"`, `"Prior Period"`, `"Custom"`). On `trial-balance`, binds `comparativeAsOfDate`.
   - **Scope & Analytical Filters:** Branch selector (within actor's authorized branches), `DimensionFilterPicker` (`<= 4` types, `<= 200` values each), and `currencyMode` (`FUNCTIONAL` default, `TRANSACTION` optional; `PARTY | FUNCTIONAL` on `aging`; `GROUP` hidden in MVP per `D-009`).
   - **Statutory Purity Toggles:**
     - `includeZero` (default `false`; hides zero-movement/zero-balance leaf lines when `hideWhenZero` or `includeZero === false`).
     - `includeUnposted` (default `false` on `RunReportDto`). Enabling `includeUnposted = true` displays a persistent `caution` banner across the top of the report canvas: *"Provisional Preview (Includes Unposted Drafts) — Cannot be snapshotted or filed."* (`معاينة أولية تشمل مسودات غير مرحلة — لا يمكن تثبيتها كإقرار رسمي`), and disables `"Save Filing Snapshot"`.
     - `includeReversals` (default `true` on `GeneralLedgerQueryDto`). Unchecking warns inline: *"Hiding reversals causes General Ledger totals to differ from the statutory Trial Balance."*
2. **Definition Coverage Preflight (`GET /api/tenant/accounting/v1/report-definitions/:id/coverage`):**
   - Checked automatically when opening a Path B statement definition (and parsed from `err.details` if a run returns `422 ACCOUNTING.REPORT.DEFINITION_INCOMPLETE`, `D-466`).
   - If postable accounts in the company chart are unmapped or resolve to `> 1` `DETAIL` line on the resolution date (`toDate`, `D-472`), renders an expandable `negative` / `caution` coverage alert listing the exact account codes and linking (when `hasPermission('accounting.report.manage_definitions')` or `accounting.account.map`) to the mapping editor.

### 4.4 Sync `200` vs Async `202` Execution & Freshness Stamp (`UX-13`)

- **State Machine:**
  - `IDLE`: Parameter bar ready; shows prompt to run (or auto-loads cached/default run if URL carries `runId`).
  - `RUNNING_SYNC`: Shows structured statement skeleton (`<Skeleton>` rows matching statement hierarchy).
  - `POLLING_ASYNC` (`HTTP 202` + `Location` + `Retry-After`): Renders `<AsyncJobState>` (`accounting-status-and-a11y.md` §3) with `.dot-pending` indicator (static under `prefers-reduced-motion: reduce`), elapsed timer in Western digits, `ReportRunStatus` (`QUEUED` -> `RUNNING`), and **zero fabricated percentage bars**. Polls `GET /api/tenant/accounting/v1/reports/runs/:id` respecting `Retry-After` (default `2s -> 4s -> 8s` backoff).
  - `COMPLETED`: Renders `ReportFreshnessBar` + `StatementTreeTable` (or `AccountingLedgerGrid`).
  - `FAILED`: Maps `errorCode` (`ACCOUNTING.REPORT.DEFINITION_INCOMPLETE`, `ACCOUNTING.REPORT.PROJECTION_BEHIND`, `ACCOUNTING.SCOPE.LEDGER_NOT_PRIMARY`) to a `SafeAction` Cause + Effect + Action banner with `[Retry Run]`.
- **Freshness & Reproducibility Stamp (`ReportFreshnessBar`, `D-017`, `D-166`, `D-310`, `D-468`):**
  - Displays: `Generated: <asOf>` · `Anchor: <fiscalYearCode> Chain #<asOfChainSeq>` · `Currency: <currencyCode>`.
  - An `"Audit Proof"` (`إثبات المرجعية`) info popover reveals all `asOfChainPositions` (`Record<fiscalYearId, chainSeq>` across current, comparative, and dynamic opening years), `definitionVersion`, `definitionContentHash`, and `mappingSetHash` inside `<IdentifierText>` copyable rows.
  - When `snapshotId !== null` (or viewing `GET /api/tenant/accounting/v1/reports/snapshots/:id`), replaces the live freshness bar with a locked **Immutable Snapshot Banner** (`tone="neutral"` + lock icon) showing `filedWithReturnPeriodId` / `filedWithFiscalYearId` and `checksum` (`SHA-256`).

### 4.5 Hierarchical Statement Tree, Typography Law & Drill-Through (`StatementTreeTable`)

1. **Strict Typography & Zero-Client-Math Compliance:**
   - Every monetary cell renders the exact `DecimalString` returned by the server (`signFlip`, `balanceReclassificationRule`, `NORMAL`/`ADJUSTMENT` movement isolation vs `CLOSING`/`OPENING` columns per `D-483`, and bottom-up `TOTAL` formulas are 100% server-evaluated).
   - **Reconciling `acc_report_lines.is_bold` with the 3-Weight Law (`400`/`500`/`600`):**
     - `DETAIL` rows (`lineKind === 'DETAIL'`): **always `font-normal` (`400`)** on every `<td>` cell (`typography.md` rule: table body cells are `400`).
     - `HEADER` rows (`lineKind === 'HEADER'`): `<th colSpan={...} scope="rowgroup">` in `font-semibold` (`600`), `text-foreground bg-muted/30`.
     - `SUBTOTAL` rows (`lineKind === 'SUBTOTAL'`): `<th scope="row">` + summary cells in `font-medium` (`500`), `border-t border-border`.
     - `TOTAL` rows (`lineKind === 'TOTAL'` or `isBold === true` on summary lines): `<th scope="row">` + summary cells in `font-semibold` (`600` — never `font-bold` `700`), `border-t border-b-2 border-border bg-muted/20`.
     - `NOTE_REF` rows: `font-normal` (`400`) with clickable badge linking to the referenced note in `EG_NOTES`.
2. **Indentation & Reclassification Disclosure:**
   - Tree `depth` (`1..8`) maps to logical start padding (`ps-2` at depth 1 up to `ps-16` at depth 8) with chevron collapse/expand buttons on parent lines (`aria-expanded`).
   - When a `DETAIL` line carries a server-applied `balanceReclassificationRule` notice (e.g. credit bank balance reclassified to overdrafts, or credit customer balance to customer advances, `D-066`), displays a compact `[Reclass]` / `[إعادة تبويب]` info badge explaining the report-time presentation rule (confirming no ledger entry was posted).
3. **Parameterized Drill-Through:**
   - Clicking any `DETAIL` monetary cell (current or comparative column) navigates via Next `<Link>` (or opens a preview tab) to:
     - `/accounting/reports/trial-balance?asOfDate=<colToDate>&accountId=<resolvedIds>...` for position lines (`BALANCE_SHEET`), or
     - `/accounting/reports/general-ledger?fromDate=<colFromDate>&toDate=<colToDate>&accountId=<resolvedIds>...` for movement lines (`INCOME_STATEMENT_*`, `CASH_FLOW_*`), preserving active `branchId` and `dimensionFilter`.
   - On `TrialBalance` (`SCR-RPT-TB`), clicking an account row drills into `general-ledger` for that `accountId`; on `Aging` / `PartyLedger`, clicking a party row drills into `open-items?side=<AR|AP>&partyId=<id>`.

### 4.6 Snapshot & Checksummed Export Flows

1. **Save Filing Snapshot (`POST /api/tenant/accounting/v1/reports/snapshots`):**
   - Permission: `accounting.report.snapshot`; Feature: `accounting.reporting.snapshots`; Header: `x-idempotency-key` (`generateUUIDv7()`).
   - Modal prompts for optional `filedWithReturnPeriodId` (from `GET /api/tenant/accounting/v1/tax/return-periods`), explains that snapshots are permanent audit records (`trg_acc_report_runs_snapshot_immutable`), and upon `200`/`201` pins `snapshotId` + `checksum`.
2. **Statutory & Audit Export (`ReportExportDrawer`):**
   - Loads available definitions from `GET /api/tenant/accounting/v1/export-definitions` (`accounting.export.read`; `EG_JOURNAL_EXPORT`, `EG_INVENTORY_EXPORT` in MVP supporting `CSV` and `XLSX`; `SAF_T_V2`, `FEC_FR`, `XBRL_QAWAEM` shown only when `PUBLISHED` in later waves).
   - Submitting calls `POST /api/tenant/accounting/v1/exports/:code/run` (`accounting.export.run`, `RunExportDto` + `x-idempotency-key`) -> receives `202` `ExportRunSummaryDto` + `Location` + `Retry-After` -> polls `GET /api/tenant/accounting/v1/exports/runs/:id` (`ExportRunDetailDto`) -> when `status === 'COMPLETED'`, displays `checksum` (`SHA-256`), `rowCount`, `fileCount`, `sizeBytes`, and `expiresAt`, and enables `"Download File"` calling `GET /api/tenant/accounting/v1/exports/runs/:id/download` (`accounting.export.download` -> `SignedDownloadDto { url, expiresAt, checksum }`).

### 4.7 TypeScript Interfaces (`UX-12`)

```ts
export interface RenderedStatementColumn {
  key: string;                              // "current" | "comparative_1" | "opening" | "movement" | "closing_entries" | "closing"
  labelKey: string;                         // i18n dictionary key
  fromDate?: string;                        // YYYY-MM-DD
  toDate: string;                           // YYYY-MM-DD
  currencyCode: string;
}

export interface RenderedStatementLine {
  lineCode: string;
  parentLineCode: string | null;
  depth: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  lineKind: "HEADER" | "DETAIL" | "SUBTOTAL" | "TOTAL" | "NOTE_REF";
  nameI18n: { ar: string; en?: string };
  noteRef: string | null;
  isBold: boolean;                          // Mapped to font-semibold (600) on summary rows, never 700
  hideWhenZero: boolean;
  reclassifiedFromLineCode?: string | null;
  valuesByColumn: Readonly<Record<string, string | null>>; // Exact server DecimalStrings
  drillHrefByColumn?: Readonly<Record<string, string>>;
}

export interface AccountingReportViewerProps {
  executionMode:
    | { kind: "READ_MODEL"; slug: string; statementKind: StatementKind }
    | { kind: "DEFINITION_RUN"; definition: ReportDefinitionSummaryDto };
  columns: readonly RenderedStatementColumn[];
  lines: readonly RenderedStatementLine[];
  runStatus: "IDLE" | "RUNNING_SYNC" | "POLLING_ASYNC" | "COMPLETED" | "FAILED";
  activeRun?: ReportRunDetailDto | null;
  asOf?: string;
  asOfFiscalYearCode?: string;
  asOfChainSeq?: number;
  asOfChainPositions?: Readonly<Record<string, number>>;
  includeUnposted: boolean;
  canRunReport: boolean;
  canSnapshot: boolean;                     // feature accounting.reporting.snapshots && perm accounting.report.snapshot
  canExport: boolean;                       // perm accounting.export.run
  canViewSensitive: boolean;                // perm accounting.account.view_sensitive
  coverageMissingAccounts?: readonly { id: string; code: string; nameAr: string; nameEn?: string }[];
  error?: NormalizedApiError | null;
  onRun: () => void;
  onCreateSnapshot: (filedWithReturnPeriodId?: string) => void;
  onOpenExportDrawer: () => void;
}
```

### 4.8 Visual Prose & ASCII Wireframes — All Four Combinations + `375px` Mobile

#### Combination 1: `AR-RTL` × `Light` — `EG_INCOME_STATEMENT_NATURE` (`COMPLETED`, EAS 1 Comparative)
- **Visual Prose:** Canvas `--ink-50`; `PageHeader` places report title (`قائمة الدخل حسب طبيعة المصروف — EAS`) at inline-start (right) and the **single** `variant="primary"` button (`[تشغيل التقرير]`) plus `variant="outline"` actions (`[حفظ لقطة إقرار]`, `[تصدير]`) at inline-end (left). Parameter bar (`bg-card border-border rounded-lg p-3`) sits above the freshness bar (`asOfChainSeq #18,420`). Statement table flows right-to-left: Line Caption (`البند`) + Note (`إيضاح`) on the right, Current Period (`2026`) then Comparative (`2025`) on the left. `DETAIL` rows use `font-normal` (`400`); `SUBTOTAL`/`TOTAL` rows use `font-medium`/`font-semibold` (`500`/`600`) with top/double-bottom borders.

```text
+------------------------------------------------------------------------------------------------------+
| [تصدير] [حفظ لقطة إقرار] [تشغيل التقرير (Primary)]      قائمة الدخل حسب طبيعة المصروف (EG_INCOME_NATURE) |
+------------------------------------------------------------------------------------------------------+
| الفترة: [2026-01-01 .. 2026-10-31] | المقارنة: [2025-01-01 .. 2025-10-31] | العملة: [الوظيفية EGP v] |
| آخر تحديث: 2026-11-01 14:32 · سلسلة FY2026 #18,420 · نسخة التعريف v1 [إثبات المرجعية]               |
+------------------------------------------------------------------------------------------------------+
|       المقارنة 2025 EGP |        الفترة 2026 EGP | إيضاح | البند                                      |
+=========================+========================+=======+===========================================+
|                         |                        |       | ▼ إيرادات النشاط الجاري (HEADER · 600)    |
|            8,400,000.00 |          10,250,000.00 |   (4) |     صافي مبيعات البضائع (DETAIL · 400 ->) |
|             (150,000.00)|            (200,000.00)|       |     مردودات ومسموحات المبيعات (DETAIL ->)  |
|-------------------------+------------------------+-------+-------------------------------------------|
|            8,250,000.00 |          10,050,000.00 |       |   صافي الإيرادات (SUBTOTAL · 500)          |
|           (5,100,000.00)|          (6,300,000.00)|   (5) |     تكلفة المبيعات (DETAIL · 400 ->)      |
+=========================+========================+=======+===========================================+
|            3,150,000.00 |           3,750,000.00 |       | مجمل الربح (TOTAL · 600 · صيغة الخادم)     |
+=========================+========================+=======+===========================================+
```

#### Combination 2: `AR-RTL` × `Dark` — Async `202` Background Execution (`POLLING_ASYNC`) + Unposted Warning
- **Visual Prose:** Dark canvas `--ink-950`, card `--ink-900`. Demonstrates two critical honest states together: (1) `includeUnposted = true` caution watermark (`bg-caution-subtle border-caution-border text-caution-foreground`) disabling `[حفظ لقطة إقرار]`, and (2) `202 Accepted` `<AsyncJobState>` (`dot-pending`, elapsed seconds, `Retry-After: 4s`, **no fake progress bar**).

```text
+------------------------------------------------------------------------------------------------------+
| [تصدير] [حفظ لقطة (مقفل)] [قيد التشغيل...]              ميزان المراجعة التفصيلي (TRIAL_BALANCE)      |
+------------------------------------------------------------------------------------------------------+
| ! معاينة أولية (تشمل مسودات غير مرحلة) — هذه الأرقام غير صالحة للإقرار الضريبي ولا يمكن تثبيت لقطة لها.|
+------------------------------------------------------------------------------------------------------+
|                                                                                                      |
|          ● جاري إعداد التقرير في الخلفية (الحالة: RUNNING · معرّف التشغيل: 0192e8f1...)               |
|          تجاوز النطاق ميزانية الاستعلام الفوري (3 سنوات مالية). يتم الفحص كل 4 ثوانٍ تلقائياً.       |
|          الزمن المنقضي: 00:12 · لا حاجة لإبقاء الصفحة مفتوحة.                                        |
|          [فتح سجل تشغيل التقارير ->]                                                                 |
|                                                                                                      |
+------------------------------------------------------------------------------------------------------+
```

#### Combination 3: `EN-LTR` × `Light` — `TRIAL_BALANCE` 4-Column Statutory Layout (`D-483`) + Snapshot Banner
- **Visual Prose:** Light surface `--ink-0` with locked **Immutable Filing Snapshot Banner** (`bg-muted border-border`) at top (`snapshotId` pinned to `2026-Q3` VAT return). Shows the exact `D-483` Trial Balance column structure where `Opening` + `Period Movement (Normal + Adjustment)` + `Closing/Opening Entries` = `Closing Balance`, all `400` weight in `<tbody>` and `600` weight in `<tfoot>`.

```text
+----------------------------------------------------------------------------------------------------------+
| Trial Balance (TRIAL_BALANCE)                            [Export] [Snapshot Locked] [Run New Copy (Pri)] |
+----------------------------------------------------------------------------------------------------------+
| [LOCK] Immutable Filing Snapshot #0192c012 · Filed with VAT Return 2026-Q3 · SHA-256: 8a41...d902        |
| Anchor: FY2026 Chain #16,904 (2026-09-30) · Currency: EGP (Functional) · Sensitive accounts: Included    |
+----------------------------------------------------------------------------------------------------------+
| Account                  |    Opening Bal | Period Movement | Year-End Entries |     Closing Bal         |
+==========================+================+=================+==================+=========================+
| 110201 Commercial Bank   |  120,000.00 Dr |   +34,250.00 Dr |          0.00    |   154,250.00 Dr  [Drill]|
| 210101 Trade Payables    |   80,000.00 Cr |   +15,000.00 Cr |          0.00    |    95,000.00 Cr  [Drill]|
| 210405 Customer Advances |        0.00    |    +4,200.00 Cr |          0.00    |     4,200.00 Cr [Reclas]|
+==========================+================+=================+==================+=========================+
| Server Totals (Balanced) | 5,400,000.00   | 1,240,000.00    |          0.00    | 6,640,000.00 (Dr = Cr)  |
+----------------------------------------------------------------------------------------------------------+
```

#### Combination 4: `EN-LTR` × `Dark` — Coverage Incomplete (`422 DEFINITION_INCOMPLETE`) + Export Drawer
- **Visual Prose:** Dark canvas `--ink-950` showing (left) the actionable `ACCOUNTING.REPORT.DEFINITION_INCOMPLETE` coverage alert naming unmapped account `530901`, and (right) `ReportExportDrawer` (`--ink-900`) displaying a `COMPLETED` `EG_JOURNAL_EXPORT` (`XLSX`) with `SHA-256` checksum and signed download button.

```text
+--------------------------------------------------------+-------------------------------------------------+
| Balance Sheet (EG_BALANCE_SHEET)                       | Statutory & Audit Export            [Close Esc] |
+--------------------------------------------------------+-------------------------------------------------+
| ! Statement mapping is incomplete (422)                | Definition: [EG_JOURNAL_EXPORT (EAS Audit)   v] |
|   Postable account 530901 (Packaging Waste) is not     | Format:     (•) XLSX   ( ) CSV                  |
|   mapped to any DETAIL line on 2026-10-31.             | Range:      2026-01-01 -> 2026-10-31            |
|   Totals cannot be computed until every postable       |-------------------------------------------------|
|   account resolves to exactly one statement line.      | Latest Run #0192e910 · Status: [COMPLETED]      |
|   [Open Line Mappings ->]   [Re-check Coverage]        | Rows: 48,912 · Files: 1 · Size: 11.4 MB         |
|                                                        | Anchor: FY2026 Chain #18,420                    |
|                                                        | SHA-256: 3c91f0a2...77b41e09 [Copy Hash]        |
|                                                        | Signed URL expires: 2026-11-01 15:00            |
|                                                        | [Download Verified XLSX]                        |
+--------------------------------------------------------+-------------------------------------------------+
```

#### Mobile `< 768px` (`375px` Viewport) Responsive Treatment
- Parameter bar collapses into a single summary bar (`"2026-01-01..2026-10-31 · vs 2025 · EGP [Edit Filters]"`), opening a full-height filter `<Drawer>` so the statement itself stays immediately visible above the fold.
- Statement table pins the `Line Caption` column (`max-w-[180px] truncate` with tap-to-expand full caption) on `inline-start` while `Current` and `Comparative` columns scroll horizontally inside `overflow-x-auto`, or switches via a compact segmented control (`[2026 | 2025 | Δ]`) to view one monetary column at full width on `375px` screens without horizontal scrolling.

---

## 5. S5 — Endpoint & Query-Parameter Matrix + Contract Gaps (`P03.T11`)

### 5.1 Complete Canonical Endpoint & Query-Parameter Matrix (`S1`–`S4`)

Every `/api/tenant/accounting/v1/*` request requires `x-mutakamel-company-id` (`COMPANY`, `COMPANY_OR_BRANCH`, `BRANCH`, or `OPERATING_CONTEXT`) and, when branch-scoped, `x-mutakamel-branch-id`. All responses use `Cache-Control: private, no-store`.

| Pattern | Method | Canonical Browser Gateway Path | Permission Key | Feature Key | Scope Target | Headers | DTO / Mandatory & Optional Parameters | Response Envelope & Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `S1` | `GET` | `/api/tenant/accounting/v1/journal-entries` | `accounting.journal_entry.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | Context | `JournalEntryListQueryDto`: opt `page` (`1..200`), `limit` (`1..100`, def `25`), `cursor`, `journalId`, `ledgerId`, `fiscalYearId`, `periodId`, `entryKind`, `fromPostingDate`, `toPostingDate` (1 FY unless `cursor`), `partyId`, `accountId` | `200` `SuccessResponseDto<JournalEntrySummaryDto[]>` + `meta` (or keyset `pageInfo` with `cursor`) |
| `S1` | `POST` | `/api/tenant/accounting/v1/journal-entries/search` | `accounting.journal_entry.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | Context | `JournalEntrySearchDto`: `search`, `filters[]` (`<= 12`: `entry_no`, `entry_kind`, `posting_date`, `source_app`, `source_type`, `currency_code`, `total_debit`) | `200` paginated `JournalEntrySummaryDto[]` |
| `S1` | `POST` | `/api/tenant/accounting/v1/journal-entries/count` | `accounting.journal_entry.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | Context | Same filter predicate as `JournalEntrySearchDto` | `200` `{ data: { total: number } }` |
| `S1` | `GET` | `/api/tenant/accounting/v1/journal-entries/:id` | `accounting.journal_entry.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | Context | Path `:id` (UUIDv7) | `200` `JournalEntryDetailDto` (includes `lines[]`, `totalDebit`, `totalCredit`, receipts) |
| `S1` | `GET` | `/api/tenant/accounting/v1/journal-entries/:id/chain-proof` | `accounting.journal_entry.read` | `accounting.ledger.core` | `COMPANY` | Context | Path `:id` (UUIDv7) | `200` `{ chainSeq, entryHash, prevEntryHash, hashSchemaVersion }` |
| `S1` | `GET` | `/api/tenant/accounting/v1/journal-lines` | `accounting.journal_entry.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | Context | `JournalLineListQueryDto`: opt `limit` (`1..500`, def `100`), `cursor` (`<= 512` chars), `entryId`, `accountId`, `partyId`, `branchId`, `dimensionSetId`, `fromPostingDate`, `toPostingDate` | `200` `{ data: { items: JournalLineSummaryDto[], pageInfo: { nextCursor, hasMore } } }` (no `meta`, no server `totals`) |
| `S1` | `GET` | `/api/tenant/accounting/v1/open-items` | `accounting.open_item.read` | `accounting.receivables.core` / `accounting.payables.core` | `COMPANY_OR_BRANCH` | Context | `OpenItemListQueryDto`: **req** `side` (`AR\|AP`); opt `limit` (`1..500`), `cursor`, `partyId`, `status`, `dueBefore`, `dueAfter`, `disputeStatus`, `dunningLevel`, `currencyCode`, `agingAsOf` | `200` keyset `{ items: OpenItemSummaryDto[], pageInfo }` |
| `S1` | `GET` | `/api/tenant/accounting/v1/tax/transactions` | `accounting.tax_transaction.read` | `accounting.tax.engine` | `COMPANY_OR_BRANCH` | Context | `TaxTransactionListQueryDto`: opt `limit` (`1..500`), `cursor`, `registrationId`, `taxTypeCode`, `direction`, `taxStatus`, `fromTaxPointDate`, `toTaxPointDate`, `returnPeriodId`, `partyId` | `200` keyset `{ items: TaxTransactionSummaryDto[], pageInfo }` |
| `S1` | `GET` | `/api/tenant/accounting/v1/bank-statements/:id/lines` | `accounting.bank_statement.read` | `accounting.treasury.bank_reconciliation` | `COMPANY` | Context | Path `:id`; `BankStatementLineListQueryDto`: opt `limit` (`1..500`), `cursor`, `status` | `200` keyset `{ items, pageInfo }` |
| `S1` | `GET` | `/api/tenant/accounting/v1/source-document-links` | `accounting.fiscal_document.read` | `accounting.integration.trade_posting` | `COMPANY` | Context | `sourceApp`, `sourceType`, `sourceId` | `200` cross-module source link metadata |
| `S2` | `GET` | `/api/tenant/core/v1/currencies` | `currencies.currency.read` | Core | Tenant | Cookie | `CurrencyQueryDto`: `page`, `limit` (`<= 100`), `status?`, `isDefault?` | `200` Core `data: CurrencyDto[]` (`decimalPlaces`: `0\|2\|3`) + `meta` |
| `S2` | `GET` | `/api/tenant/accounting/v1/company-profile` | `accounting.profile.read` | `accounting.ledger.core` | `COMPANY` | Context | None | `200` `CompanyProfileDetailDto` (`functionalCurrencyCode`, `currencyFrozen`, `maxBackdateDays`) + weak representation `ETag`, or bodyless `304` for a matching conditional request. Use `data.version` for numeric `If-Match`. |
| `S2` | `POST` | `/api/tenant/accounting/v1/fx-rates/resolve` | `accounting.fx_rate.resolve` | `accounting.ledger.core` | `COMPANY_OR_BRANCH` | Context | `ResolveFxRateQueryDto`: **req** `fromCurrencyCode`, `toCurrencyCode`, `rateType` (`SPOT\|CLOSING\|AVERAGE\|HISTORICAL\|CUSTOMS\|TAX`), `onDate` (`YYYY-MM-DD`) | `200` `FxPinDto` (`rateId`, `rateValue`, `revision`, `providerCode`, `pegged`, `legs`) |
| `S3` | `GET` | `/api/tenant/accounting/v1/account-groups` | `accounting.chart.read` | `accounting.ledger.core` | `TENANT` | Context | `AccountGroupListQueryDto`: **req** `chartId`; opt `parentId`, `page`, `limit` | `200` `AccountGroupSummaryDto[]` + `meta` |
| `S3` | `GET` | `/api/tenant/accounting/v1/accounts` | `accounting.account.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | Context | `AccountListQueryDto`: **req** `chartId`; opt `accountType`, `classification`, `isPostable`, `isControl`, `groupId`, `parentId`, `role`, `includeDeprecated`, `page`, `limit` | `200` `AccountSummaryDto[]` + `meta` |
| `S3` | `POST` | `/api/tenant/accounting/v1/accounts/search` | `accounting.account.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | Context | `AccountSearchDto`: `search` (`1..80`), `filters[]` (`code`, `name_i18n`, `account_type`, `classification`, `is_postable`, `is_control`, `tags`) | `200` `AccountSummaryDto[]` + `meta` |
| `S3` | `POST` | `/api/tenant/accounting/v1/accounts/lookup` | `accounting.account.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | Context | `AccountLookupQueryDto`: **req** `chartId`; opt `search` (`1..80`), `postableOnly`, `limit` (`1..100`, def `50`) | `200` `LookupItemDto[]` (`{ id, label, disabled? }`) |
| `S3` | `GET` | `/api/tenant/accounting/v1/accounts/:id` | `accounting.account.read` | `accounting.ledger.core` | `OPERATING_CONTEXT` | Context | Path `:id` | `200` + `ETag` `AccountDetailDto` (`allowManualJournal`, `currencyCode`, `requiresDimensionTypeCodes`, `roles`) |
| `S3` | `GET` | `/api/tenant/core/v1/directory/parties` | `directory.party.read` | Core | Tenant | Cookie | `PartyQueryDto`: `page`, `limit`, `partyType?`, `status?`, `roleType?` (`CUSTOMER\|SUPPLIER`), `branchId?`, `ownerUserId?` | `200` Core `data: PartyDto[]` + `meta` |
| `S3` | `GET` | `/api/tenant/core/v1/directory/parties/:id` | `directory.party.read` | Core | Tenant | Cookie | Path `:id` | `200` Core `PartyDto` |
| `S3` | `GET` | `/api/tenant/accounting/v1/party-finance-profiles` | `accounting.party_finance_profile.read` | `accounting.ledger.core` | `COMPANY` | Context | `PartyFinanceProfileListQueryDto`: `partyType?` (`B\|P\|F`), `residentFlag?`, `onCreditHold?`, `paymentTermsId?`, `dunningProcedureId?` | `200` `PartyFinanceProfileSummaryDto[]` + `meta` |
| `S3` | `POST` | `/api/tenant/accounting/v1/party-finance-profiles/lookup` | `accounting.party_finance_profile.read` | `accounting.ledger.core` | `COMPANY` | Context | Lookup query (`search?`, `limit?`) | `200` `LookupItemDto[]` (`Q14` fallback) |
| `S3` | `GET` | `/api/tenant/accounting/v1/tax-id-validations` | `accounting.profile.read` | `accounting.receivables.core` | `COMPANY` | Context | `partyId?`, `status?`, `page`, `limit` | `200` `TaxIdValidationSummaryDto[]` |
| `S3` | `GET` | `/api/tenant/accounting/v1/exposure/parties/:partyId` | `accounting.open_item.read` | `accounting.receivables.credit_control` | `COMPANY` | Context | Path `:partyId` | `200` `PartyExposureDto` + `asOfChainPositions` (advisory) |
| `S3` | `GET` | `/api/tenant/accounting/v1/dimension-types` | `accounting.dimension.read` | `accounting.ledger.core` | `COMPANY` | Context | `DimensionTypeListQueryDto`: `code?`, `hotSlot?` (`1..4`), `isRequiredDefault?` | `200` `DimensionTypeSummaryDto[]` + `meta` |
| `S3` | `GET` | `/api/tenant/accounting/v1/dimension-values` | `accounting.dimension.read` | `accounting.ledger.core` | `COMPANY` | Context | `DimensionValueListQueryDto`: **req** `dimensionTypeId`; opt `parentId`, `validOn` (`YYYY-MM-DD`), `includeBlocked` (def `false`) | `200` `DimensionValueSummaryDto[]` + `meta` |
| `S3` | `POST` | `/api/tenant/accounting/v1/dimension-values/lookup` | `accounting.dimension.read` | `accounting.ledger.core` | `COMPANY` | Context | `dimensionTypeId`, `search?`, `validOn?`, `limit?` | `200` `LookupItemDto[]` |
| `S3` | `GET` | `/api/tenant/accounting/v1/fiscal-years` | `accounting.calendar.read` | `accounting.ledger.core` | `COMPANY` | Context | `FiscalYearListQueryDto`: `calendarId?`, `status?`, `fromDate?`, `toDate?` | `200` `FiscalYearSummaryDto[]` + `meta` |
| `S3` | `GET` | `/api/tenant/accounting/v1/periods` | `accounting.period.read` | `accounting.ledger.core` | `COMPANY` | Context | `FiscalPeriodListQueryDto`: `fiscalYearId?`, `periodKind?`, `module?`, `state?`, `onDate?` | `200` `FiscalPeriodSummaryDto[]` (`states[]` per `PeriodModule`) |
| `S3` | `GET` | `/api/tenant/accounting/v1/user-period-overrides` | `accounting.period.read` | `accounting.ledger.core` | `COMPANY` | Context | `periodId?`, `userId?`, `module?` | `200` live `SOFT_CLOSED` override grants |
| `S4` | `GET` | `/api/tenant/accounting/v1/report-definitions` | `accounting.report.read` | `accounting.reporting.statements` | `OPERATING_CONTEXT` | Context | `ReportDefinitionListQueryDto`: `frameworkId?`, `statementKind?`, `packCode?` | `200` `ReportDefinitionSummaryDto[]` |
| `S4` | `GET` | `/api/tenant/accounting/v1/report-definitions/:id/coverage` | `accounting.report.read` | `accounting.reporting.statements` | `COMPANY` | Context | Path `:id` | `200` unmapped / duplicate-mapped postable accounts |
| `S4` | `POST` | `/api/tenant/accounting/v1/reports/:code/run` | `accounting.report.run` (+ `requires_permission` e.g. `accounting.account.view_sensitive`) | `accounting.reporting.statements` | `COMPANY_OR_BRANCH` | Context | Path `:code`; body `RunReportDto`: **req** `fromDate`, `toDate` (`<= 3` FY); opt `ledgerId`, `comparativePeriod`, `dimensionFilter` (`<= 4` types × `200`), `currencyMode` (`FUNCTIONAL\|TRANSACTION`), `includeUnposted`, `snapshot`, `filedWithReturnPeriodId` | `200` inline rendered projection OR `202` + `Location` + `Retry-After` (`ReportRunSummaryDto`) |
| `S4` | `GET` | `/api/tenant/accounting/v1/reports/runs/:id` | `accounting.report.read` | `accounting.reporting.statements` | `COMPANY_OR_BRANCH` | Context | Path `:id` | `200` `ReportRunDetailDto` (`QUEUED\|RUNNING\|COMPLETED\|FAILED`, `asOfChainPositions`; the run row alone, because the figures are not stored, `D-770`) |
| `S4` | `GET` | `/api/tenant/accounting/v1/reports/trial-balance` | `accounting.report.read` | `accounting.reporting.statements` | `COMPANY_OR_BRANCH` | Context | `TrialBalanceQueryDto`: **req** `asOfDate`; opt `ledgerId`, `accountId[]`, `accountRole[]`, `dimensionFilter`, `includeZero`, `branchId`, `comparativeAsOfDate`, `currencyMode` | `200` inline OR `202` + `Location` beyond budget |
| `S4` | `GET` | `/api/tenant/accounting/v1/reports/general-ledger` | `accounting.report.read` | `accounting.reporting.statements` | `COMPANY_OR_BRANCH` | Context | `GeneralLedgerQueryDto`: **req** `fromDate`, `toDate`; opt `accountId[]`, `journalId[]`, `entryKind[]`, `partyId`, `dimensionFilter`, `cursor`, `includeReversals` | `200` keyset ledger rows + `asOf` + `asOfChainSeq` |
| `S4` | `GET` | `/api/tenant/accounting/v1/reports/party-ledger` | `accounting.report.read` | `accounting.receivables.core` | `COMPANY_OR_BRANCH` | Context | `PartyLedgerQueryDto`: **req** `side` (`AR\|AP`), `fromDate`, `toDate`; opt `partyId[]`, `currencyCode`, `includeSettled`, `statementStyle` (`OPEN_ITEMS\|BALANCE_FORWARD`) | `200` party statement rows + server balances |
| `S4` | `GET` | `/api/tenant/accounting/v1/reports/aging` | `accounting.report.read` | `accounting.receivables.core` | `COMPANY_OR_BRANCH` | Context | `AgingQueryDto`: **req** `side`, `asOfDate`; opt `agingBy` (`DUE_DATE\|DOCUMENT_DATE`), `buckets[]` (`<= 8`), `partyId[]`, `currencyMode` (`PARTY\|FUNCTIONAL`), `includeDisputed`, `branchId` | `200` bucketed aging rows + server totals |
| `S4` | `GET` | `/api/tenant/accounting/v1/reports/cash-position` | `accounting.report.read` | `accounting.treasury.cash_and_custody` | `COMPANY_OR_BRANCH` | Context | `CashPositionQueryDto`: **req** `asOfDate`; opt `bankAccountId[]`, `treasuryId[]`, `includeInTransit`, `includePdc`, `currencyMode` | `200` bank/treasury balances + `asOf` |
| `S4` | `GET` | `/api/tenant/accounting/v1/reports/tax-report` | `accounting.report.read` | `accounting.tax.returns` | `COMPANY` | Context | `TaxReportQueryDto`: **req** `fromDate`, `toDate`; opt `registrationId`, `taxTypeCode[]`, `direction` (`OUTPUT\|INPUT`), `taxStatus[]`, `returnPeriodId`, `groupBy` (`BOX\|TAX_TYPE\|PARTY`) | `200` grouped tax boxes/totals |
| `S4` | `GET` | `/api/tenant/accounting/v1/reports/sales-register` | `accounting.report.read` | `accounting.tax.engine` | `COMPANY_OR_BRANCH` | Context | `SalesRegisterQueryDto`: **req** `fromDate`, `toDate`; opt `documentKind[]`, `branchId`, `partyId`, `authorityStatus[]`, `includeCancelled` | `200` sales register + tax totals |
| `S4` | `GET` | `/api/tenant/accounting/v1/reports/purchase-register` | `accounting.report.read` | `accounting.tax.engine` | `COMPANY_OR_BRANCH` | Context | `PurchaseRegisterQueryDto`: **req** `fromDate`, `toDate`; opt `documentKind[]`, `partyId`, `inputTaxEvidence[]`, `matchStatus[]`, `attributionClass[]` | `200` purchase register + recovery totals |
| `S4` | `GET` | `/api/tenant/accounting/v1/reports/withholding-register` | `accounting.report.read` | `accounting.tax.withholding` | `COMPANY` | Context | `WithholdingRegisterQueryDto`: **req** `fromDate`, `toDate`; opt `direction` (`ISSUED\|RECEIVED`), `partyId[]`, `taxTypeCode[]`, `certificateStatus[]`, `remittedOnly` | `200` WHT register |
| `S4` | `GET` | `/api/tenant/accounting/v1/reports/cheque-register` | `accounting.report.read` | `accounting.treasury.cheques_pdc` | `COMPANY_OR_BRANCH` | Context | `ChequeRegisterQueryDto`: **req** `fromDate`, `toDate`; opt `kind[]`, `status[]`, `bankAccountId`, `partyId`, `dueFrom`, `dueTo` | `200` instrument register |
| `S4` | `GET` | `/api/tenant/accounting/v1/reports/depreciation-schedule` | `accounting.report.read` | `accounting.assets.core` | `COMPANY_OR_BRANCH` | Context | `DepreciationScheduleQueryDto`: **req** `fiscalYearId`, `bookCode` (`BOOK\|TAX`, `TAX` also needs `accounting.asset.view_tax_book`); opt `assetId[]`, `categoryId[]`, `periodId`, `status[]`, `includeFullyDepreciated` | `200` asset roll-forward schedule |
| `S4` | `GET` | `/api/tenant/accounting/v1/reports/deferrals` | `accounting.report.read` | `accounting.schedules.deferrals` | `COMPANY` | Context | `DeferralsQueryDto`: **req** `asOfDate`; opt `kind` (`REVENUE\|EXPENSE`), `templateId[]`, `scheduleStatus[]`, `partyId`, `includeCancelled` | `200` deferral recognition schedule |
| `S4` | `POST` | `/api/tenant/accounting/v1/reports/snapshots` | `accounting.report.snapshot` | `accounting.reporting.snapshots` | `COMPANY` | Context + `x-idempotency-key` | `CreateReportSnapshotDto`: `runId` (UUIDv7), `filedWithReturnPeriodId?` | `200`/`201` `ReportRunDetailDto` with `snapshotId` |
| `S4` | `GET` | `/api/tenant/accounting/v1/reports/snapshots/:id` | `accounting.report.read` | `accounting.reporting.snapshots` | `COMPANY` | Context | Path `:id` | `200` immutable snapshot + `checksum` + signed artifact URL |
| `S4` | `GET` | `/api/tenant/accounting/v1/export-definitions` | `accounting.export.read` | `accounting.reporting.statements` | `TENANT` | Context | `status?`, `format?`, `countryCode?` | `200` `ExportDefinitionSummaryDto[]` |
| `S4` | `POST` | `/api/tenant/accounting/v1/exports/:code/run` | `accounting.export.run` | `accounting.reporting.statements` | `COMPANY` | Context + `x-idempotency-key` | `RunExportDto`: **req** `definitionId`, `format` (`CSV\|XLSX\|...`), `fromDate`, `toDate`; opt `ledgerId`, `deliveredTo` | `202` + `Location` + `Retry-After` `ExportRunSummaryDto` |
| `S4` | `GET` | `/api/tenant/accounting/v1/exports/runs/:id` | `accounting.export.read` | `accounting.reporting.statements` | `COMPANY` | Context | Path `:id` | `200` `ExportRunDetailDto` (`checksum`, `rowCount`, `sizeBytes`, `expiresAt`) |
| `S4` | `GET` | `/api/tenant/accounting/v1/exports/runs/:id/download` | `accounting.export.download` | `accounting.reporting.statements` | `COMPANY` | Context | Path `:id` | `200` `SignedDownloadDto` (`{ url, expiresAt, checksum }`) |

### 5.2 Bilingual Dictionary Keys & Error Recovery Copy (`ar` / `en`)

Zero language ternaries appear in TSX. Representative keys added under `t.accounting.dataPatterns.*`:

| Key | Arabic (`ar`) | English (`en`) |
| --- | --- | --- |
| `ledger.chunkFooterNoSum` | `معروض {count} سطراً في الدفعة الحالية` | `Showing {count} lines in current chunk` |
| `ledger.openGlForTotals` | `عرض الإجماليات المعتمدة في تقرير الأستاذ العام` | `View server totals in General Ledger report` |
| `ledger.stornoBadge` | `ستورنو` | `Storno` |
| `ledger.lateRedirectBadge` | `موجّه من فترة مغلقة` | `Redirected from closed period` |
| `money.negativeInputForbidden` | `لا تقبل مبالغ الإدخال إشارة سالبة. أزل الإشارة (-) وحدد الاتجاه (مدين أو دائن).` | `Input amounts cannot be negative. Remove the minus sign and select Debit or Credit.` |
| `money.calcOnSave` | `يُحتسب عند حفظ المسودة بالسعر المثبّت ({rate})` | `Calculated on draft save at pinned rate ({rate})` |
| `money.currencyFrozenNotice` | `العملة الوظيفية ({code}) مقفلة نهائياً بعد أول قيد مرحّل للشركة.` | `Functional currency ({code}) is permanently locked after the company's first ledger posting.` |
| `fx.peggedLocked` | `سعر مربوط رسمياً — لا يُسمح بتجاوز سعر الصرف.` | `Officially pegged pair — FX rate override is forbidden.` |
| `fx.rateNotFound` | `لا يوجد سعر صرف فوري لزوج {from}/{to} بتاريخ {date}. لا يمكن حفظ المسودة أو ترحيلها قبل تسجيل السعر.` | `No SPOT rate found for {from}/{to} on {date}. This draft cannot be saved or posted until a rate is recorded.` |
| `picker.accountControlLocked` | `حساب رقابي أو خزينة — يُرحّل عبر مستندات الأستاذ المساعد أو الخزينة فقط.` | `Control or treasury account — post through subledger or treasury workflows only.` |
| `picker.partyCreditHold` | `إيقاف ائتماني نشط` | `Credit Hold` |
| `picker.partyUuidFallback` | `صلاحية قراءة أسماء الدليل غير ممنوحة لدورك؛ يتم المرجع بمعرّف الطرف.` | `Directory name access is not granted for your role; referencing party by verified ID.` |
| `picker.periodSoftClosedOverride` | `مسموح بالترحيل عبر تصريح استثنائي نشط حتى {expiresAt}` | `Posting permitted via active period override until {expiresAt}` |
| `report.unpostedWatermark` | `معاينة أولية تشمل مسودات غير مرحلة — لا تصلح للإقرار الرسمي ولا يمكن تثبيت لقطة لها.` | `Provisional preview including unposted drafts — not valid for statutory filing and cannot be snapshotted.` |
| `report.asyncRunning` | `جاري إعداد التقرير في الخلفية ({status})... يتم التحقق تلقائياً.` | `Preparing report in background ({status})... checking automatically.` |
| `report.snapshotImmutable` | `لقطة إقرار مثبتة غير قابلة للتعديل · البصمة الرقمية SHA-256` | `Immutable filing snapshot · SHA-256 verified` |

### 5.3 Contract Gaps Flagged for `P03.T11` (Backend LLD Reconciliation)

Per the strict no-invention rule, none of these gaps is worked around in the browser. Each is isolated with an honest UI boundary today and handed off to `P03.T11`:

1. **`CG-DATA-01` — Raw Keyset Ledger & Subledger Lists Omit Server-Computed Filter Totals (`<tfoot>` Sum Gap):**
   - **LLD Evidence:** `02_DTOs.md` §13 (`SuccessResponseDto<T[]>` and keyset `{ items, pageInfo: { nextCursor, hasMore } }`) on `GET /accounting/journal-lines`, `GET /accounting/open-items`, `GET /accounting/tax/transactions`, and `GET /accounting/bank-statements/:id/lines`.
   - **Impact & Current Honest UI:** Client-side summation is banned (`data-layer.md`), and summing one 100-row chunk of a 7M-line partition would misrepresent filter totals anyway. `AccountingLedgerGrid` renders monetary `<tfoot>` sums **only** when the endpoint returns server totals (`JournalEntryDetailDto`, `reports/general-ledger`, `reports/trial-balance`, `reports/party-ledger`, `reports/aging`), and shows chunk count + deep-link to `reports/general-ledger` on raw keyset endpoints.
   - **`P03.T11` Recommendation:** Confirm whether raw `journal-lines` and `open-items` intentionally delegate totals to `/accounting/reports/*`, or add an opt-in server `summary` (`totalDebitFunctional`, `totalCreditFunctional`, `openAmountFunctional`) endpoint/field.

2. **`CG-DATA-02` — Rendered Statement Payload (`ReportRunDetailDto`), Async Run Artifact Download Route, and 9 Read-Model `*QueryDto` / Response Shapes Underspecified in `02_DTOs.md`:**
   - **LLD Evidence:** `02_Endpoint_Catalogue.md` §10 (`POST /accounting/reports/:code/run`, `GET /accounting/reports/runs/:id`) & §12 lines `1138–1152` vs `02_DTOs.md` §11.3 lines `3381–3473` & `01_ERD/08_Close_and_Reporting_Tables.md` (`acc_report_runs`).
   - **Impact & Current Honest UI:** `02_DTOs.md` §11.3 defines TypeScript interfaces only for `TrialBalanceQueryDto`, `GeneralLedgerQueryDto`, `PartyLedgerQueryDto`, and `RunReportDto`, leaving the other 9 read-model `*QueryDto`s as prose table cells in `02_Endpoint_Catalogue.md` §12, and omits the TypeScript response DTOs for rendered statement lines (`columns[]`, `lines[]`, `valuesByColumn`, `totals`), `CreateReportSnapshotDto`, and a signed download route `GET /accounting/reports/runs/:id/download` (whereas exports have `GET /accounting/exports/runs/:id/download` and snapshots return a signed URL on `GET /accounting/reports/snapshots/:id`).
   - **`P03.T11` Recommendation:** Define explicit TypeScript DTOs in `02_DTOs.md` §11.3 for `ReportRunDetailDto` (including inline `rendered` rows/columns on both sync `200` and `COMPLETED` `GET /reports/runs/:id`), `CreateReportSnapshotDto`, a `GET /accounting/reports/runs/:id/download` (`SignedDownloadDto`) route for PDF/XLSX artifacts, and the remaining 9 read-model query + response DTOs.

3. **`CG-DATA-03` — `AccountLookupQueryDto` / `LookupItemDto` and `AccountSummaryDto` Omit Manual-Journal Eligibility & Dimension Requirement Fields (`AccountPicker`):**
   - **LLD Evidence:** `02_DTOs.md` §4.1, §4.3 (`AccountSummaryDto` vs `AccountDetailDto`), and §13.3 (`LookupItemDto { id, label, disabled? }`).
   - **Impact & Current Honest UI:** `allowManualJournal`, `currencyCode`, `requiresDimensionTypeCodes`, `parentId`, and `deprecatedAt` exist only on `AccountDetailDto` (`GET /accounting/accounts/:id`), not on `AccountSummaryDto` or `LookupItemDto`, and `AccountListQueryDto` / `AccountLookupQueryDto` have no `allowManualJournal?: boolean` filter. Today `AccountPicker` uses `GET /accounting/accounts` + fetches `GET /accounting/accounts/:id` on selection (cached per account) before commitment.
   - **`P03.T11` Recommendation:** Project `allowManualJournal`, `currencyCode`, `requiresDimensionTypeCodes`, `parentId`, and `deprecatedAt` onto `AccountSummaryDto` (so `AccountPicker` can badge and disable non-manual accounts before click) and add `allowManualJournal?: boolean` to `AccountListQueryDto` / `AccountLookupQueryDto`.

4. **`CG-DATA-04` — Pre-Save Functional-Currency Preview on Unsaved Foreign-Currency Draft Lines (`MoneyInput` + `FxRateStrip`):**
   - **LLD Evidence:** `02_Endpoint_Catalogue.md` line 220 (`POST /accounting/fx-rates/resolve` -> `FxPinDto`) and `02_DTOs.md` §5.2 (`JournalDraftLineInput.amountFunctional?: DecimalString`).
   - **Impact & Current Honest UI:** `POST /accounting/fx-rates/resolve` returns `rateValue` (`FxRateString`), not a server-rounded `amountFunctional`. Under zero-client-arithmetic (`data-layer.md`), `MoneyInput` omits `amountFunctional` on draft writes and displays `"Calculated on draft save at pinned rate"` until the draft save response returns the server's exact `amountFunctional` (and draft debit/credit balance).
   - **`P03.T11` Recommendation:** Optionally accept `amountTxn?: DecimalString` on `ResolveFxRateQueryDto` and return `convertedAmountFunctional?: DecimalString` rounded `HALF_UP` to `functionalCurrency.decimalPlaces` so multi-currency draft entry shows live server-computed functional equivalents prior to save.

5. **`CG-DATA-05` — Cross-Service Core Directory vs Accounting Party Lookup & `search` Parameter Contract (`PartyPicker`):**
   - **LLD Evidence:** `tenant-portal/docs/api/core-directory.md` line 93 (`PartyQueryDto`: `PaginationQueryDto` + `partyType?`, `status?`, `roleType?`, `branchId?`, `ownerUserId?`, gated on `directory.party.read`) and `02_Endpoint_Catalogue.md` line 101 (`POST /accounting/party-finance-profiles/lookup` -> `LookupItemDto[]`, gated on `accounting.party_finance_profile.read`).
   - **Impact & Current Honest UI:** `core-directory.md` does not explicitly document whether `PaginationQueryDto` on `GET /directory/parties` forwards a `search` text parameter across `displayName`/`legalName`/`taxNumber`, and `02_DTOs.md` §13.3 does not state whether `POST /accounting/party-finance-profiles/lookup` populates `LookupItemDto.label` via Core's internal `PartyPort` when an accountant lacks `directory.party.read`. Today `PartyPicker` uses `GET /directory/parties` when `directory.party.read` is held and falls back to `party-finance-profiles/lookup` + `<IdentifierText>` UUID (`Q14`).
   - **`P03.T11` Recommendation:** Document `POST /accounting/party-finance-profiles/lookup`'s `label` source (via `PartyPort` internal read or tax/code identifier) and verify `search` parameter support on Core's `GET /api/tenant/core/v1/directory/parties`.

6. **`CG-DATA-06` — `JournalLineSummaryDto` (`GET /accounting/journal-lines`) Lacks Parent `entryNo` and `entryKind`:**
   - **LLD Evidence:** `01_ERD/02_Ledger_Tables.md` lines `299–337` (`acc_journal_lines` denormalizes `posting_date`, `account_code_snapshot`, and `account_name_snapshot`, but not `entry_no` or `entry_kind`) and `02_DTOs.md` §13.1.
   - **Impact & Current Honest UI:** Raw `GET /accounting/journal-lines` rows carry `entryId` and `lineNo` without the human legal number (`JV-2026-000142`) or `entryKind`, whereas `GET /accounting/reports/general-ledger` joins `acc_journal_entries`. Today `AccountingLedgerGrid` in `JOURNAL_LINES` mode displays `#<lineNo>` + truncated `<IdentifierText>` `entryId` and resolves `entryNo` + `entryKind` when opening `LedgerDrillDrawer` (`GET /accounting/journal-entries/:entryId`), avoiding N+1 row fetches.
   - **`P03.T11` Recommendation:** Project `entryNo` and `entryKind` from `acc_journal_entries` onto `JournalLineSummaryDto` in `GET /accounting/journal-lines` so accountants scanning raw journal lines see gapless legal entry numbers inline.

## Contract reconciliation (P03.T11, 1 November 2026)

Reconciles the gaps of this spec against the Endpoint Catalogue and `02_DTOs.md` after `D-770`, `D-771` and `D-772`. The gap list above keeps the original findings; these rulings are final.

| Gap id | Ruling | Where |
| --- | --- | --- |
| `CG-DATA-01` | already in the contract | Raw keyset lists carry no totals by design (`02_DTOs.md` §13); filter totals come from `reports/general-ledger`, `trial-balance`, `party-ledger`, `aging` and `tax-report` (`LedgerBalance` ranges in `GeneralLedgerPageDto`) |
| `CG-DATA-02 (a)` | closed by D-770 | `RenderedReportDto`, `TrialBalanceDto`, `GeneralLedgerPageDto`, `PartyLedgerDto`, `ReportCoverageDto`, `CreateReportSnapshotDto` and `ReportSnapshotDetailDto` are declared |
| `CG-DATA-02 (b)` | deferred to stage 5 (storage P17, reporting breadth P27 definition of ready) | No `GET /accounting/reports/runs/:id/download`; stage 1 renders the run inline |
| `CG-DATA-02 (c)` | already in the contract | The nine read-model query DTOs are normative in the Endpoint Catalogue §12 query-DTO table |
| `CG-DATA-03` | closed by D-770 | `AccountSummaryDto` gains `parentId`, `depth`, `groupId`, `allowManualJournal`, `currencyCode`, `requiresDimensionTypeCodes` and an `ISODate` `deprecatedAt`; `AccountLookupQueryDto` gains `manualJournalOnly?` |
| `CG-DATA-04` | already in the contract | The saved draft carries the derived `amountFunctional` and totals (`JournalDraftLineInput.amountFunctional?`, draft `total_debit`/`total_credit`); the pre-save preview stays "calculated on save" |
| `CG-DATA-05` | closed by D-770 (accounting part) | `PartyFinanceProfileLookupItemDto { partyId }` with a Core-derived `label`; whether Core `GET /directory/parties` takes a search parameter is a Core-documentation question outside this contract |
| `CG-DATA-06` | closed by D-770 | `JournalLineSummaryDto extends JournalLineDetailDto` with `entryId`, `entryNo`, `journalId`, `entryKind`, `postingDate`, `periodId`, `chainSeq` |
