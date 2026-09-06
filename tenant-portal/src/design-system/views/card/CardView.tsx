"use client";

import { type ReactNode, useCallback, useState } from "react";
import { Skeleton } from "../../primitives/Skeleton";
import { EmptyState } from "../../patterns/empty-state/EmptyState";
import { ErrorState } from "../../patterns/error-state/ErrorState";
import { Pagination } from "../../patterns/pagination/Pagination";
import { cn } from "../../lib/cn";
import { WorkspaceCard } from "../WorkspaceCard";
import { useScrollRestoration } from "../useScrollRestoration";
import { useVirtualWindow } from "../useVirtualWindow";
import type { SortOption, WorkspaceViewLabels, WorkspaceViewProps } from "../types";
import { CardViewToolbar } from "./CardViewToolbar";

// Above this many cards the grid renders a window instead of the whole page
// of results — task 2.9. The estimate covers a typical CRM card plus the grid
// row gap; one laid-out row replaces it immediately.
const VIRTUALIZE_ABOVE = 100;
const ESTIMATED_ROW_PX = 160;
const GRID_CLASS = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4";

export interface CardViewLabels extends WorkspaceViewLabels {
  sortBy: string;
}

export interface CardViewProps<T> extends Omit<WorkspaceViewProps<T>, "labels"> {
  renderCard: (item: T) => ReactNode;
  // Per-card controls that must not open the card — they render outside the
  // activation surface, exactly as they do on a board card.
  renderActions?: (item: T) => ReactNode;
  // The card object is shared with the board, and so are its two other slots:
  // a full-width strip below the header row, and per-card surface classes.
  // The prop names are deliberately identical, so one screen hands both views
  // the same callbacks instead of maintaining two card designs.
  renderFooter?: (item: T) => ReactNode;
  cardClassName?: (item: T) => string | undefined;
  // The entity's sortable fields, already translated. Omit them and the sort
  // control does not render — which is the honest state for a list the server
  // will not sort.
  sortOptions?: SortOption[];
  labels: CardViewLabels;
}

// Responsive grid, no grouping — the same card object the board uses, at a
// wider measure. Generic and prop-driven: never fetches, never reads the
// dictionary, never knows which entity it renders. See
// docs/design/views.md#card-view.
export function CardView<T>({
  items,
  itemKey,
  renderCard,
  renderActions,
  renderFooter,
  cardClassName,
  sortOptions = [],
  isLoading,
  error,
  onRetry,
  emptyState,
  page,
  onPageChange,
  sort,
  onSortChange,
  selection,
  onActivate,
  labels,
  className,
}: CardViewProps<T>) {
  const [columnCount, setColumnCount] = useState(1);
  const setScrollElement = useScrollRestoration("card");
  const { scrollRef, itemRef, range } = useVirtualWindow({
    count: items.length,
    threshold: VIRTUALIZE_ABOVE,
    estimatedRowSize: ESTIMATED_ROW_PX,
    itemsPerRow: columnCount,
  });

  // The grid's column count is a breakpoint decision made in CSS, so it is
  // read back from the laid-out element rather than duplicated in JS where
  // the two could disagree.
  const setGridElement = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    function readColumns() {
      if (!element) return;
      setColumnCount(Math.max(1, getComputedStyle(element).gridTemplateColumns.split(" ").length));
    }
    readColumns();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(readColumns);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, []);

  // Two callback refs on one node: the virtualizer needs the scroll element,
  // and scroll restoration needs the same one. Only the restorer has a
  // cleanup to return.
  const setScrollContainer = useCallback(
    (element: HTMLDivElement | null) => {
      scrollRef(element);
      return setScrollElement(element);
    },
    [scrollRef, setScrollElement],
  );

  const selectedIds = selection?.selectedIds;
  const selectedOnPage = selectedIds ? items.filter((item) => selectedIds.has(itemKey(item))).length : 0;
  const isAllSelected = selection !== undefined && items.length > 0 && selectedOnPage === items.length;

  function toggleSelectAll() {
    if (!selection) return;
    selection.onSelectionChange(isAllSelected ? new Set() : new Set(items.map(itemKey)));
  }

  function toggleSelected(id: string, isSelected: boolean) {
    if (!selection) return;
    const next = new Set(selection.selectedIds);
    if (isSelected) next.add(id);
    else next.delete(id);
    selection.onSelectionChange(next);
  }

  if (isLoading) {
    return (
      <div className={cn(GRID_CLASS, className)}>
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={`card-skeleton-${index}`} className="h-32 rounded-md" />
        ))}
      </div>
    );
  }

  if (error) {
    return <ErrorState title={labels.errorTitle} onRetry={onRetry} retryLabel={labels.retry} className={className} />;
  }

  if (items.length === 0) {
    return emptyState ?? <EmptyState title={labels.emptyTitle} className={className} />;
  }

  const visible = range ? items.slice(range.start, range.end) : items;

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-3", className)}>
      <CardViewToolbar
        sortOptions={sortOptions}
        sort={sort}
        onSortChange={onSortChange}
        isAllSelected={isAllSelected}
        isSomeSelected={selectedOnPage > 0 && !isAllSelected}
        onToggleSelectAll={selection ? toggleSelectAll : undefined}
        labels={labels}
      />

      <div ref={setScrollContainer} className={cn("min-h-0 flex-1", range && "overflow-y-auto")}>
        <div ref={setGridElement} className={GRID_CLASS}>
          {range && range.paddingStart > 0 && (
            <div aria-hidden="true" className="col-span-full" style={{ height: range.paddingStart }} />
          )}
          {visible.map((item, index) => {
            const id = itemKey(item);
            return (
              <WorkspaceCard
                key={id}
                containerRef={index === 0 ? itemRef : undefined}
                onActivate={onActivate ? () => onActivate(item) : undefined}
                isSelected={selection?.selectedIds.has(id) ?? false}
                onSelectedChange={selection ? (next) => toggleSelected(id, next) : undefined}
                selectLabel={labels.selectRow}
                actions={renderActions?.(item)}
                footer={renderFooter?.(item)}
                className={cardClassName?.(item)}
              >
                {renderCard(item)}
              </WorkspaceCard>
            );
          })}
          {range && range.paddingEnd > 0 && (
            <div aria-hidden="true" className="col-span-full" style={{ height: range.paddingEnd }} />
          )}
        </div>
      </div>

      {page && onPageChange && (
        <Pagination page={page} onPageChange={onPageChange} labels={labels.pagination} />
      )}
    </div>
  );
}
