// Exact contract from docs/components/filter-bar.md.
interface FilterOption {
  value: string;
  labelEn: string;
  labelAr: string;
}

export interface FilterField {
  key: string;
  type: "search" | "select" | "date-range" | "boolean";
  placeholderEn?: string;
  placeholderAr?: string;
  options?: FilterOption[];
}

export interface FilterBarProps {
  fields: FilterField[];
  values: Record<string, unknown>;
  onChange: (newValues: Record<string, unknown>) => void;
  onReset?: () => void;
  isLoading?: boolean;
}
