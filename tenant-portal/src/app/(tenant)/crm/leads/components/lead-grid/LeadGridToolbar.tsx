"use client";

import { useId } from "react";
import {
  Button,
  Checkbox,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

interface LeadGridToolbarProps {
  selectedCount: number;
  hasSelectedOnPage: boolean;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  canExport: boolean;
  canSort: boolean;
  sortValue: string;
  loadedCount: number;
  totalCount: number;
  onToggleSelectAll: () => void;
  onExportCsv: () => void;
  onSortValueChange: (nextValue: string) => void;
}

export function LeadGridToolbar({
  selectedCount,
  hasSelectedOnPage,
  isAllSelected,
  isSomeSelected,
  canExport,
  canSort,
  sortValue,
  loadedCount,
  totalCount,
  onToggleSelectAll,
  onExportCsv,
  onSortValueChange,
}: LeadGridToolbarProps) {
  const { t } = useI18n();
  const selectAllId = useId();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-card border border-line-column bg-surface-toolbar px-3.5 py-2 shadow-toolbar">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2">
          <Checkbox
            id={selectAllId}
            checked={isAllSelected ? true : isSomeSelected ? "indeterminate" : false}
            onCheckedChange={onToggleSelectAll}
            aria-label={t.views.selectAll}
          />
          <Label htmlFor={selectAllId} className="cursor-pointer select-none text-xs font-semibold">
            {selectedCount > 0
              ? t.crmLeads.executive.selectedCount(selectedCount)
              : t.crmLeads.executive.selectAll}
          </Label>
        </div>

        {canExport && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onExportCsv}
            disabled={!hasSelectedOnPage}
          >
            {t.crmLeads.exportSelectedOnPage}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {canSort && (
          <div className="flex items-center gap-2">
            <span className="text-caption font-medium text-muted-foreground">
              {t.crmLeads.executive.sortBy}
            </span>
            <Select value={sortValue} onValueChange={onSortValueChange}>
              <SelectTrigger
                size="sm"
                aria-label={t.crmLeads.executive.sortBy}
                className="h-(--size-toolbar-control) w-48 border-line-control bg-card font-semibold"
              >
                <SelectValue placeholder={t.crmLeads.executive.sortBy} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt:desc">
                  {t.crmLeadWorkspace.sort.newestFirst}
                </SelectItem>
                <SelectItem value="createdAt:asc">
                  {t.crmLeadWorkspace.sort.oldestFirst}
                </SelectItem>
                <SelectItem value="displayName:asc">
                  {t.crmLeadWorkspace.sort.nameAscending}
                </SelectItem>
                <SelectItem value="displayName:desc">
                  {t.crmLeadWorkspace.sort.nameDescending}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <span className="text-caption font-medium tabular-nums text-muted-foreground">
          {t.crmLeads.executive.showingLeads(loadedCount, totalCount)}
        </span>
      </div>
    </div>
  );
}
