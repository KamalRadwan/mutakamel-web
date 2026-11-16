"use client";

import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Columns3, LayoutGrid, Rows3, type LucideIcon } from "lucide-react";
import { FilterBar, PageActions, cn, focusRing, type FilterValues } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import {
  PRICE_BOOK_GOVERNANCE_FILTERS, PRICE_BOOK_PURPOSES, isPriceBookPurpose,
  type PriceBookGovernanceFilter,
} from "../pricing-contract";
import type { usePriceBooks, PriceBookViewMode } from "../hooks/usePriceBooks";

type PriceBookToolbarProps = Pick<ReturnType<typeof usePriceBooks>,
  "viewMode" | "setViewMode" | "search" | "setSearch" | "purpose" | "setPurpose" |
  "governanceFilter" | "setGovernanceFilter" | "setOnlyDefaults"
>;

const VIEW_MODES: ReadonlyArray<{ id: PriceBookViewMode; Icon: LucideIcon }> = [
  { id: "board", Icon: Columns3 },
  { id: "cards", Icon: LayoutGrid },
  { id: "table", Icon: Rows3 },
];

export function PriceBookToolbar({
  viewMode, setViewMode, search, setSearch, purpose, setPurpose,
  governanceFilter, setGovernanceFilter, setOnlyDefaults,
}: PriceBookToolbarProps) {
  const { t } = useI18n();
  const governanceLabel = (stage: PriceBookGovernanceFilter): string => {
    switch (stage) {
      case "PUBLISHED":
        return t.tradePricing.govPublishedLive;
      case "SCHEDULED":
        return t.tradePricing.govScheduled;
      case "TESTED":
        return t.tradePricing.govPendingChecker;
      case "DRAFT_ONLY":
        return t.tradePricing.govDraftOrEmpty;
      case "INACTIVE":
        return t.tradePricing.govInactive;
    }
  };

  const viewLabel = (mode: PriceBookViewMode): string => {
    switch (mode) {
      case "board":
        return t.views.board;
      case "cards":
        return t.views.card;
      case "table":
        return t.views.table;
    }
  };

  const filterValues: FilterValues = {
    ...(purpose ? { purpose: { kind: "select", value: purpose } } : {}),
    ...(governanceFilter ? { governance: { kind: "select", value: governanceFilter } } : {}),
  };

  return (
    <>
      {/* Search + Advanced Filters portalled into PageActionBar slot="search" */}
      <FilterBar
        searchWidth="wide"
        searchTextSize="compact"
        filters={[
          {
            id: "purpose",
            kind: "select",
            label: t.tradePricing.bookPurpose,
            placeholder: t.tradePricing.filterAllPurposes,
            options: PRICE_BOOK_PURPOSES.map((value) => ({
              value,
              label: tradeStatusLabel(t.tradeStatus, value, t.common.unknownCode),
            })),
          },
          {
            id: "governance",
            kind: "select",
            label: t.tradePricing.versionKpiGovernance,
            placeholder: t.tradePricing.filterGovernanceAll,
            options: PRICE_BOOK_GOVERNANCE_FILTERS.map((stage) => ({
              value: stage,
              label: governanceLabel(stage),
            })),
          },
        ]}
        values={filterValues}
        onChange={(next) => {
          const pVal = next.purpose;
          setPurpose(
            pVal?.kind === "select" && isPriceBookPurpose(pVal.value) ? pVal.value : undefined,
          );
          const gVal = next.governance;
          setGovernanceFilter(
            gVal?.kind === "select" &&
              PRICE_BOOK_GOVERNANCE_FILTERS.includes(gVal.value as PriceBookGovernanceFilter)
              ? (gVal.value as PriceBookGovernanceFilter)
              : undefined,
          );
        }}
        onReset={() => {
          setPurpose(undefined);
          setGovernanceFilter(undefined);
          setOnlyDefaults(false);
          setSearch("");
        }}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t.tradePricing.searchPlaceholder}
        filtersLabel={t.tradePricing.advancedFilters}
        clearAllLabel={t.filters.clearAll}
      />

      {/* Segmented 3-Way View Switcher portalled into PageActionBar slot="view" */}
      <PageActions slot="view">
        <RadioGroupPrimitive.Root
          value={viewMode}
          onValueChange={(next) => {
            if (next === "board" || next === "cards" || next === "table") {
              setViewMode(next);
            }
          }}
          aria-label={t.tradePricing.booksTitle}
          className="inline-flex h-(--size-toolbar-control) items-center gap-0.5 rounded-lg border border-line-control bg-surface-subtle p-0.5"
        >
          {VIEW_MODES.map(({ id, Icon }) => {
            const isActive = viewMode === id;
            return (
              <RadioGroupPrimitive.Item
                key={id}
                value={id}
                aria-label={viewLabel(id)}
                className={cn(
                  "inline-flex h-full cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-caption font-bold transition-colors",
                  isActive
                    ? "bg-gradient-primary text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                  focusRing,
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                <span>{viewLabel(id)}</span>
              </RadioGroupPrimitive.Item>
            );
          })}
        </RadioGroupPrimitive.Root>
      </PageActions>
    </>
  );
}
