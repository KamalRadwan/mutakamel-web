"use client";

import type { ReactNode } from "react";
import type { NormalizedApiError } from "@/lib/api/errors";
import { Skeleton } from "../../primitives/Skeleton";
import { EmptyState } from "../../patterns/empty-state/EmptyState";
import { ErrorState } from "../../patterns/error-state/ErrorState";

export interface CardViewProps<T> {
  items: T[];
  renderCard: (item: T) => ReactNode;
  itemKey: (item: T) => string;
  onItemClick?: (item: T) => void;
  isLoading: boolean;
  error?: NormalizedApiError | null;
  onRetry?: () => void;
  emptyState?: ReactNode;
  errorTitle?: string;
  retryLabel?: string;
}

// Responsive grid, no stage grouping — the same card renderer the board
// uses, at a wider measure. Generic and prop-driven: never fetches, never
// reads the dictionary, never knows which entity it renders. See
// docs/design/views.md#card-view.
export function CardView<T>({
  items,
  renderCard,
  itemKey,
  onItemClick,
  isLoading,
  error,
  onRetry,
  emptyState,
  errorTitle,
  retryLabel,
}: CardViewProps<T>) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={`card-skeleton-${index}`} className="h-32 rounded-md" />
        ))}
      </div>
    );
  }

  if (error) {
    return <ErrorState title={errorTitle ?? ""} onRetry={onRetry} retryLabel={retryLabel} />;
  }

  if (items.length === 0) {
    return emptyState ?? <EmptyState title="" />;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {items.map((item) => {
        const key = itemKey(item);
        return (
          <div
            key={key}
            role={onItemClick ? "button" : undefined}
            tabIndex={onItemClick ? 0 : undefined}
            onClick={() => onItemClick?.(item)}
            onKeyDown={(event) => {
              if (onItemClick && event.key === "Enter") {
                event.preventDefault();
                onItemClick(item);
              }
            }}
            className="rounded-md border border-border bg-card p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {renderCard(item)}
          </div>
        );
      })}
    </div>
  );
}
