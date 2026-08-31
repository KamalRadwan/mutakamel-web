# Component Specification: `DataTable`

Status: **[Shared source implemented; runtime conformance pending]**

Last source verification: **2026-08-29**

## Purpose

`DataTable` is the standard server-backed directory and operational-history
surface for Tenants, Admin Staff, Roles, Invoices, Subscriptions, Database
Servers, Storage Servers, Backup Runs, and comparable collections.

It follows [Data experiences](../design-system/data-experiences.md),
[Operational UX](../design-system/operational-ux.md), and the applicable API
domain contract.

## Target API shape

```typescript
export interface ColumnDef<T> {
  key: string;
  headerEn: string;
  headerAr: string;
  sortable?: boolean;
  align?: "start" | "center" | "end";
  width?: string;
  priority?: "essential" | "supporting" | "detail";
  cell: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  labelEn?: string;
  labelAr?: string;
  columns: ColumnDef<T>[];
  data: T[];
  isLoading?: boolean;
  isRefreshing?: boolean;
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onLimitChange?: (limit: number) => void;
  };
  sort?: {
    sortBy: string;
    sortDir: "ASC" | "DESC";
    onSortChange: (sortBy: string, sortDir: "ASC" | "DESC") => void;
  };
  selection?:
    | {
        kind: "EXPLICIT_IDS";
        selectedIds: readonly string[];
        onSelectionChange: (selectedIds: string[]) => void;
        queryFingerprint?: string;
        isRowSelectable?: (row: T) => boolean;
        actions?: React.ReactNode;
      }
    | {
        kind: "ALL_MATCHING";
        queryFingerprint: string;
        totalMatching: number;
        excludedIds: readonly string[];
        onExcludedIdsChange: (excludedIds: string[]) => void;
        onClearSelection: () => void;
        isRowSelectable?: (row: T) => boolean;
        actions?: React.ReactNode;
      };
  getRowId?: (row: T) => string;
  getRowLabel?: (row: T) => string;
  responsiveMode?: "priority-columns" | "horizontal-scroll" | "record-cards";
  emptyState?: {
    titleEn: string;
    titleAr: string;
    descriptionEn?: string;
    descriptionAr?: string;
    action?: React.ReactNode;
  };
}
```

The source type in `src/design-system/patterns/data-table/types.ts` is
authoritative. The shape above summarizes the implemented contract. `labelEn`
and `labelAr` remain optional only as a typed compatibility bridge; new and
migrated consumers provide both bilingual region names. Legacy
`selectedIds`/`onSelectionChange` is a separate compatibility bridge.

## Visual contract

- One bordered white table surface; do not wrap it inside another card shell.
- Header surface uses semantic muted cold blue.
- Rows are 44px by default on desktop. Type never shrinks to create density.
- Table body values are regular weight; one primary identifier may use medium
  or semibold.
- Hover and selected treatments are distinct. Selection is not color-only.
- Numeric/currency columns align to logical end and use explicit locale/unit.
- A row shows at most one frequent direct action; secondary/destructive actions
  use a labelled overflow menu.

## Interaction and accessibility

- The table/scroll region has a localized accessible name.
- Sortable headers contain real buttons and expose direction through
  `aria-sort`.
- Sorting preserves focus and announces the resulting order.
- Selection checkboxes include the row's accessible name.
- The header checkbox communicates checked, unchecked, and mixed state.
- Horizontal scroll regions are focusable, named, and show a visible overflow
  affordance.
- Keyboard focus remains visible and unobscured by sticky chrome or the
  WebPhone.

## Loading, refresh, and pagination

- Initial loading may replace rows with reserved skeletons.
- Background refresh keeps rows, pagination, scroll position, and focus mounted.
  Selection is reconciled against authoritative row identity and current action
  eligibility; dropped selections are announced.
- The region exposes `aria-busy` and one concise loading/result status.
- Pagination does not disappear while focused.
- Obsolete requests are cancelled or ignored; an older response cannot
  overwrite a newer filter/page state.

## Empty, forbidden, and failure behavior

- First-use empty and filtered-empty are distinct.
- Filtered-empty preserves active filters and offers clear/reset.
- `403` renders a permission state, not empty.
- Refresh failure preserves safe prior rows with a degraded/stale qualifier.
- Full load failure uses a persistent in-body error with retry.

## Selection and bulk actions

- The shared DataTable represents explicit selected IDs or an explicitly
  query-scoped `ALL_MATCHING` model and requires a stable `getRowId` whenever
  selection is enabled.
- A persistent action bar displays selected count and explicit scope.
- A domain-specific “all matching results” action requires an authoritative bulk
  API plus a query fingerprint, total-matching count, and excluded-ID model; it
  is not represented by pretending `selectedIds` contains an unbounded result.
- Never fan out per-row mutations to simulate a bulk backend command.
- Filter/query changes clear incompatible selection and announce it.
- Mixed eligibility is explained before submission.
- Partial completion reports success, failure, skipped, and unresolved records
  separately.

## Responsive policy

Each table declares one of the strategies in
[Data experiences](../design-system/data-experiences.md#responsive-behavior).
Record cards are not permitted when column comparison is essential, including
financial, audit, and operational evidence tables.

## Current conformance gaps

The source now uses focusable sort buttons with `aria-sort`, preserves rows and
pagination during background refresh, names/focuses horizontal-scroll regions,
renders explicit selected-row treatment, and separates initial loading from
refreshing. Focused component tests cover those source behaviors.

Remaining evidence is runtime-dependent: complete the authenticated
keyboard-only workflow, the required real-viewport/zoom/coarse-pointer matrix,
and screen-reader smoke testing. No production consumer may enable
`ALL_MATCHING` until its domain supplies an authoritative bulk command and the
query-fingerprint/exclusion contract described above.
