"use client";

import { useI18n } from "@/i18n/I18nContext";
import { Button } from "../../primitives/Button";

/**
 * The bulk-selection bar ("N selected · Clear") — distinct from FilterBar,
 * which owns search/filter controls above the table. Only renders when
 * there's an active selection.
 */
export function DataTableToolbar({
  selectedCount,
  onClearSelection,
  actions,
}: {
  selectedCount: number;
  onClearSelection: () => void;
  actions?: React.ReactNode;
}) {
  const { lang } = useI18n();
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-brand-50/60 px-4 py-2 text-sm dark:bg-brand-950/20">
      <span className="font-medium text-foreground">
        {lang === "ar" ? `${selectedCount} محدد` : `${selectedCount} selected`}
      </span>
      <div className="flex items-center gap-2">
        {actions}
        <Button type="button" variant="ghost" size="sm" onClick={onClearSelection}>
          {lang === "ar" ? "إلغاء التحديد" : "Clear"}
        </Button>
      </div>
    </div>
  );
}
