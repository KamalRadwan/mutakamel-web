# Component Specification: `FilterBar` (Unified Filter Controls)

The `FilterBar` component provides a unified search input, status/enum dropdowns, date pickers, and filter reset controls placed directly above DataTables.

---

## ⚙️ Component API (Props Interface)

```typescript
export interface FilterOption {
  value: string;
  labelEn: string;
  labelAr: string;
}

export interface FilterField {
  key: string;
  type: 'search' | 'select' | 'date-range' | 'boolean';
  placeholderEn?: string;
  placeholderAr?: string;
  options?: FilterOption[];
}

export interface FilterBarProps {
  fields: FilterField[];
  values: Record<string, any>;
  onChange: (newValues: Record<string, any>) => void;
  onReset?: () => void;
  isLoading?: boolean;
}
```

---

## 🎨 Features & Rules

1. **Debounced Search**: Text search input automatically debounces user input by 300ms before triggering URL/API updates.
2. **Active Filter Tags**: Displays removable filter tags below the input bar when non-default filters are active.
3. **URL Query Param Sync**: Automatically stays in sync with URL search params (`search`, `status`, `tier`, `from`, `to`).
