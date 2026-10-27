"use client";

import { useId } from "react";
import { Download } from "lucide-react";
import {
  Button,
  Checkbox,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { CUSTOMER_PROFILE_BOARD_STATUSES } from "../../hooks/useCustomerProfileBoard";
import type { CustomerProfileStatus } from "../../hooks/useCustomerProfiles";
import type { QuickSortKey } from "./useCustomerExecutiveCardView";

interface CustomerGridToolbarProps {
  totalItemsCount: number;
  selectedCount: number;
  exportCount: number;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  canExport: boolean;
  quickSort: QuickSortKey;
  localStatusFilter: CustomerProfileStatus | null;
  statusCounts: ReadonlyMap<CustomerProfileStatus, number>;
  onToggleSelectAll: () => void;
  onQuickSortChange: (next: QuickSortKey) => void;
  onStatusFilterChange: (next: CustomerProfileStatus | null) => void;
  onExportCsv: () => void;
}

export function CustomerGridToolbar({
  totalItemsCount,
  selectedCount,
  exportCount,
  isAllSelected,
  isSomeSelected,
  canExport,
  quickSort,
  localStatusFilter,
  statusCounts,
  onToggleSelectAll,
  onQuickSortChange,
  onStatusFilterChange,
  onExportCsv,
}: CustomerGridToolbarProps) {
  const { t, lang } = useI18n();
  const selectAllId = useId();
  const statusLabels: Record<string, string | undefined> = t.statusValues;

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2.5 rounded-card border border-line-column bg-surface-toolbar px-3.5 py-2 shadow-toolbar">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2">
          <Checkbox
            id={selectAllId}
            checked={
              isAllSelected ? true : isSomeSelected ? "indeterminate" : false
            }
            onCheckedChange={onToggleSelectAll}
            aria-label={t.views.selectAll}
          />
          <Label
            htmlFor={selectAllId}
            className="cursor-pointer select-none text-xs font-semibold"
          >
            {selectedCount > 0
              ? formatTemplate(t.crmCustomerProfiles.ui.card.value_selected, {
                  selectedIds_size: formatNumber(selectedCount, lang),
                })
              : t.crmCustomerProfiles.ui.card.select_all}
          </Label>
        </div>

        <div className="hidden flex-wrap items-center gap-1 sm:flex">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => onStatusFilterChange(null)}
            className={cn(
              "rounded-md border px-2 py-1 text-caption font-semibold transition-colors",
              localStatusFilter === null
                ? "border-chip-active-line bg-gradient-chip-active text-chip-active-fg"
                : "border-transparent text-muted-foreground not-disabled:hover:bg-surface-subtle not-disabled:hover:text-foreground",
            )}
          >
            {`${t.crmCustomerProfiles.ui.card.all} (${formatNumber(totalItemsCount, lang)})`}
          </Button>
          {CUSTOMER_PROFILE_BOARD_STATUSES.map((status) => {
            const count = statusCounts.get(status) ?? 0;
            const isSelected = localStatusFilter === status;
            const label = statusLabels[`CustomerStatus.${status}`] ?? status;
            return (
              <Button
                key={status}
                type="button"
                variant="ghost"
                size="xs"
                onClick={() =>
                  onStatusFilterChange(isSelected ? null : status)
                }
                className={cn(
                  "rounded-md border px-2 py-1 text-caption font-semibold transition-colors",
                  isSelected
                    ? "border-chip-active-line bg-gradient-chip-active text-chip-active-fg"
                    : "border-transparent text-muted-foreground not-disabled:hover:bg-surface-subtle not-disabled:hover:text-foreground",
                )}
              >
                <span>{label}</span>
                <span className="tabular-nums opacity-75">
                  {`(${formatNumber(count, lang)})`}
                </span>
              </Button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2">
          <span className="text-caption font-medium text-muted-foreground">
            {t.crmCustomerProfiles.ui.sort.label}
          </span>
          <Select
            value={quickSort}
            onValueChange={(value) => onQuickSortChange(value as QuickSortKey)}
          >
            <SelectTrigger
              size="sm"
              aria-label={t.crmCustomerProfiles.ui.card.sort_cards}
              className="h-(--size-toolbar-control) w-44 border-line-control bg-card font-semibold"
            >
              <SelectValue
                placeholder={t.crmCustomerProfiles.ui.card.sort_cards}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">
                {t.crmCustomerProfiles.ui.card.default_order}
              </SelectItem>
              <SelectItem value="name_asc">
                {t.crmCustomerProfiles.ui.card.name_a_z}
              </SelectItem>
              <SelectItem value="name_desc">
                {t.crmCustomerProfiles.ui.sort.nameDescending}
              </SelectItem>
              <SelectItem value="rating_desc">
                {t.crmCustomerProfiles.ui.card.highest_rating}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {canExport && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onExportCsv}
            disabled={exportCount === 0}
            title={t.crmCustomerProfiles.csvExport.selectionHint}
          >
            <Download className="size-3.5" aria-hidden="true" />
            {formatTemplate(t.crmCustomerProfiles.csvExport.selected, {
              count: formatNumber(exportCount, lang),
            })}
          </Button>
        )}
      </div>
    </div>
  );
}
