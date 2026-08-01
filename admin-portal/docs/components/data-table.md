# Component Specification: `DataTable` (Server-Paginated Data Table)

The `DataTable` component is the standard grid component for all admin directory views (Tenants, Users, Roles, Invoices, Subscriptions, Database Servers, Backup Runs).

---

## 📍 Use Cases Across Admin Portal

- **Tenants Directory** (`/admin/tenants`)
- **Admin Staff Directory** (`/admin/users`)
- **Admin Roles Management** (`/admin/roles`)
- **Invoices Directory** (`/admin/invoices`)
- **Subscriptions Directory** (`/admin/subscriptions`)
- **Database Servers List** (`/admin/database-servers`)
- **Storage Servers List** (`/storage-servers`, live bounded client-filtered catalogue)
- **Backup & Restore Runs** (`/admin/backups/runs`)

---

## ⚙️ Component API (Props Interface)

```typescript
export interface ColumnDef<T> {
  key: string;
  headerEn: string;
  headerAr: string;
  sortable?: boolean;
  align?: 'start' | 'center' | 'end';
  width?: string;
  cell: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading?: boolean;
  /** Server pagination metadata */
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onLimitChange?: (limit: number) => void;
  };
  /** Server sorting handle */
  sort?: {
    sortBy: string;
    sortDir: 'ASC' | 'DESC';
    onSortChange: (sortBy: string, sortDir: 'ASC' | 'DESC') => void;
  };
  /** Selection */
  selectedIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  getRowId?: (row: T) => string;
  emptyState?: {
    titleEn: string;
    titleAr: string;
    descriptionEn?: string;
    descriptionAr?: string;
    action?: React.ReactNode;
  };
}
```

---

## 🎨 UI/UX Specifications

1. **Row Height**: 44px compact rows (`py-2.5 px-4 text-sm`).
2. **Hover States**: Subtle row highlight (`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors`).
3. **Borders & Dividers**: Crisp `border-b border-slate-200 dark:border-slate-800`.
4. **Header Alignment**: Header labels use logical flex placement (`text-start` by default, `text-end` for numeric/currency columns).
5. **Loading Skeleton**: 5 shimmer rows rendered during `isLoading = true` to preserve container height and avoid layout shift.
