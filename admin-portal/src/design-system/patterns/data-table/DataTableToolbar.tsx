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
  scope = "EXPLICIT_IDS",
  onClearSelection,
  actions,
}: {
  selectedCount: number;
  scope?: "EXPLICIT_IDS" | "ALL_MATCHING";
  onClearSelection: () => void;
  actions?: React.ReactNode;
}) {
  const { lang } = useI18n();
  if (selectedCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-selected px-4 py-2 text-sm text-selected-foreground">
      <span className="inline-flex flex-col gap-0.5 font-medium">
        <span>{lang === "ar" ? `${selectedCount} محدد` : `${selectedCount} selected`}</span>
        <span className="text-xs font-normal text-muted-foreground">
          {scope === "ALL_MATCHING"
            ? lang === "ar"
              ? "كل النتائج المطابقة عدا الاستثناءات"
              : "All matching results except exclusions"
            : lang === "ar"
              ? "معرّفات محددة صراحةً"
              : "Explicit record IDs"}
        </span>
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        <Button type="button" variant="ghost" size="sm" onClick={onClearSelection}>
          {lang === "ar" ? "إلغاء التحديد" : "Clear"}
        </Button>
      </div>
    </div>
  );
}
