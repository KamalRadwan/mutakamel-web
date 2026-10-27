"use client";

import { ArrowUpDown } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  iconSize,
  type SortState,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { OpportunitiesSort } from "../hooks/useOpportunitiesList";

interface OpportunitySortMenuProps {
  sort: SortState;
  setSort: (sort: OpportunitiesSort) => void;
}

export function OpportunitySortMenu({ sort, setSort }: OpportunitySortMenuProps) {
  const { t, dir } = useI18n();
  const labels = t.crmOpportunities;
  // Match the card toolbar and OPPORTUNITY_SORT_FIELDS in crm-app/src/crm/opportunities/opportunities.service.ts.
  const options = [
    { label: labels.sortNewest, sort: { id: "createdAt", direction: "desc" } },
    { label: labels.sortOldest, sort: { id: "createdAt", direction: "asc" } },
    { label: labels.sortValue, sort: { id: "amount", direction: "desc" } },
    { label: labels.sortProbability, sort: { id: "probabilityPercent", direction: "desc" } },
    { label: labels.sortCloseDate, sort: { id: "expectedCloseDate", direction: "asc" } },
    { label: labels.sortTitle, sort: { id: "title", direction: "asc" } },
  ] satisfies { label: string; sort: OpportunitiesSort }[];

  return (
    <TooltipProvider>
      <DropdownMenu dir={dir}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                aria-label={labels.sortLabel}
                className="size-(--size-toolbar-control) shrink-0 rounded-lg border border-line-control bg-surface-subtle p-0 text-foreground-secondary"
              >
                <ArrowUpDown className={iconSize({ size: "sm" })} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{labels.sortLabel}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" aria-label={labels.sortLabel}>
          <DropdownMenuRadioGroup value={`${sort.id}:${sort.direction}`} aria-label={labels.sortLabel}>
            {options.map((option) => (
              <DropdownMenuRadioItem
                key={`${option.sort.id}:${option.sort.direction}`}
                value={`${option.sort.id}:${option.sort.direction}`}
                onSelect={() => setSort(option.sort)}
              >
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}
