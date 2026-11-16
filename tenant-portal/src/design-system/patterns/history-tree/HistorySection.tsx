"use client";

import { useState } from "react";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { Button } from "../../primitives/Button";
import { ToggleGroup, ToggleGroupItem } from "../../primitives/ToggleGroup";
import { DetailSection } from "../detail-section/DetailSection";
import { ErrorState } from "../error-state/ErrorState";
import { HistoryTree } from "./HistoryTree";
import type { HistorySectionProps } from "./history-tree-types";

/**
 * Full-frame Reusable History Card Template (`@/design-system`).
 *
 * Standardizes the `DetailSection` frame, `Expand all / Collapse all` header
 * control, optional category `ToggleGroup` filter bar, `ErrorState` handling,
 * and the 3-level `HistoryTree` across every page, tab, and modal in the portal.
 */
export function HistorySection<TFilter extends string = string>({
  title,
  description,
  items,
  detailsLabel,
  emptyDetailsLabel,
  expandAllLabel,
  collapseAllLabel,
  density = "standard",
  filters,
  filterLabel,
  selectedFilter,
  onFilterChange,
  isLoading,
  emptyTitle,
  emptyDescription,
  errorTitle,
  onRetry,
  retryLabel,
  onLoadMore,
  loadMoreLabel,
  isLoadingMore,
  loadMoreErrorTitle,
  onRetryLoadMore,
  className,
}: HistorySectionProps<TFilter>) {
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set());

  const allExpanded = items.length > 0 && items.every((item) => openIds.has(item.id));
  const toggleAll = () => {
    setOpenIds(allExpanded ? new Set() : new Set(items.map((item) => item.id)));
  };
  const toggleItem = (id: string, open: boolean) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const expandAction =
    items.length > 0 && !isLoading && !errorTitle ? (
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleAll}
        className="cursor-pointer gap-1 text-xs"
      >
        {allExpanded ? (
          <ChevronsDownUp className="size-3.5" aria-hidden="true" />
        ) : (
          <ChevronsUpDown className="size-3.5" aria-hidden="true" />
        )}
        <span>{allExpanded ? collapseAllLabel : expandAllLabel}</span>
      </Button>
    ) : undefined;

  return (
    <DetailSection
      title={title}
      description={description}
      density={density}
      action={expandAction}
      columns={1}
      className={className}
    >
      {filters && filters.length > 0 && selectedFilter !== undefined && onFilterChange ? (
        <div className="overflow-x-auto pb-1">
          <ToggleGroup
            type="single"
            size="sm"
            aria-label={filterLabel ?? title}
            value={selectedFilter}
            onValueChange={(value) => {
              if (value && filters.some((option) => option.value === value)) {
                onFilterChange(value as TFilter);
                setOpenIds(new Set());
              }
            }}
          >
            {filters.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      ) : null}

      {errorTitle ? (
        <ErrorState
          title={errorTitle}
          onRetry={onRetry}
          retryLabel={retryLabel}
        />
      ) : (
        <HistoryTree
          density={density}
          label={title}
          detailsLabel={detailsLabel}
          emptyDetailsLabel={emptyDetailsLabel}
          items={items}
          openIds={openIds}
          onToggleItem={toggleItem}
          isLoading={isLoading}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          onLoadMore={onLoadMore}
          loadMoreLabel={loadMoreLabel}
          isLoadingMore={isLoadingMore}
        />
      )}

      {loadMoreErrorTitle ? (
        <ErrorState
          title={loadMoreErrorTitle}
          onRetry={onRetryLoadMore}
          retryLabel={retryLabel}
        />
      ) : null}
    </DetailSection>
  );
}
