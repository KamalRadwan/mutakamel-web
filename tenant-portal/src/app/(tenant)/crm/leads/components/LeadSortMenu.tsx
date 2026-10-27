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
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { LeadsSort } from "../hooks/useLeadList";

interface LeadSortMenuProps {
  sort: { id: string; direction: "asc" | "desc" };
  setSort: (sort: LeadsSort) => void;
}

export function LeadSortMenu({ sort, setSort }: LeadSortMenuProps) {
  const { t, dir } = useI18n();
  const labels = t.crmLeadWorkspace.sort;
  // Both list and search enforce LEAD_SORT_FIELDS in crm-app/src/crm/leads/leads.service.ts.
  const options = [
    { label: labels.newestFirst, sort: { id: "createdAt", direction: "desc" } },
    { label: labels.oldestFirst, sort: { id: "createdAt", direction: "asc" } },
    { label: labels.nameAscending, sort: { id: "displayName", direction: "asc" } },
    { label: labels.nameDescending, sort: { id: "displayName", direction: "desc" } },
  ] satisfies { label: string; sort: LeadsSort }[];

  return (
    <TooltipProvider>
      <DropdownMenu dir={dir}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                aria-label={labels.label}
                className="size-(--size-toolbar-control) shrink-0 rounded-lg border border-line-control bg-surface-subtle p-0 text-foreground-secondary"
              >
                <ArrowUpDown className={iconSize({ size: "sm" })} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{labels.label}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" aria-label={labels.label}>
          <DropdownMenuRadioGroup value={`${sort.id}:${sort.direction}`} aria-label={labels.label}>
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
