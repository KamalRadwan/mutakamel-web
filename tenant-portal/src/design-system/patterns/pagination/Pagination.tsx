"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "../../primitives/Button";
import type { PageInfo } from "../data-table/types";
import { pageWindow } from "./page-window";

export interface PaginationProps {
  page: PageInfo;
  onPageChange: (page: number) => void;
  labels: {
    previous: string;
    next: string;
    summary: (from: number, to: number, total: number) => string;
    /** Optional; the numbered controls fall back to English-neutral labels. */
    first?: string;
    last?: string;
    page?: (n: number) => string;
  };
  className?: string;
}

// Pagination arrows are direction-carrying — rtl:-scale-x-100 mirrors them
// rather than swapping icon components, so "previous" always points toward
// the start of reading direction. See docs/design/theming.md#rtl.
export function Pagination({ page, onPageChange, labels, className }: PaginationProps) {
  const lastPage = Math.max(1, Math.ceil(page.total / page.limit));
  const from = page.total === 0 ? 0 : (page.page - 1) * page.limit + 1;
  const to = Math.min(page.page * page.limit, page.total);

  return (
    <div className={`flex items-center justify-between gap-3 ${className ?? ""}`}>
      <p className="text-xs text-muted-foreground">{labels.summary(from, to, page.total)}</p>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={page.page <= 1}
          onClick={() => onPageChange(1)}
          aria-label={labels.first ?? "First page"}
        >
          <ChevronsLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={page.page <= 1}
          onClick={() => onPageChange(page.page - 1)}
          aria-label={labels.previous}
        >
          <ChevronLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
        </Button>

        {pageWindow(page.page, lastPage).map((slot) =>
          typeof slot === "number" ? (
            <Button
              key={slot}
              variant={slot === page.page ? "primary" : "ghost"}
              size="sm"
              onClick={() => onPageChange(slot)}
              aria-label={labels.page?.(slot) ?? `Page ${slot}`}
              aria-current={slot === page.page ? "page" : undefined}
              className={slot === page.page ? "pointer-events-none min-w-8 tabular-nums" : "min-w-8 tabular-nums"}
            >
              {slot}
            </Button>
          ) : (
            <span key={slot} aria-hidden="true" className="px-1 text-xs text-muted-foreground select-none">
              …
            </span>
          ),
        )}

        <Button
          variant="ghost"
          size="sm"
          disabled={page.page >= lastPage}
          onClick={() => onPageChange(page.page + 1)}
          aria-label={labels.next}
        >
          <ChevronRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={page.page >= lastPage}
          onClick={() => onPageChange(lastPage)}
          aria-label={labels.last ?? "Last page"}
        >
          <ChevronsRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
