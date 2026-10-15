"use client";

import { Download } from "lucide-react";
import { Button, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { LeadSelectionExport as LeadSelectionExportState } from "../../hooks/useLeadTableViewExport";

/** Downloads the selected rows as CSV; renders nothing without a selection on this page. */
export function LeadSelectionExport({ exporter }: { exporter: LeadSelectionExportState }) {
  const { t, lang } = useI18n();
  if (exporter.rowCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {exporter.failed && (
        <span role="alert" className="text-xs text-destructive">
          {t.crmLeadViews.exportFailed}
        </span>
      )}
      <Button variant="outline" size="sm" onClick={exporter.exportSelected}>
        <Download className={iconSize({ size: "sm" })} aria-hidden="true" />
        {formatTemplate(t.crmLeadViews.exportSelected, { count: formatNumber(exporter.rowCount, lang) })}
      </Button>
    </div>
  );
}
