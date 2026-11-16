"use client";

import { useId } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useDictionary, useDirection, useLanguage } from "@/i18n/useLanguage";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { cn } from "../../lib/cn";
import { hitArea } from "../../lib/variants";
import { Button } from "../../primitives/Button";
import { Label } from "../../primitives/Label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../primitives/Select";
import type { PageInfo } from "../data-table/types";
import { pageWindow } from "./page-window";

export interface PaginationProps {
  page: PageInfo;
  onPageChange: (page: number) => void;
  pageSizeOptions?: readonly number[];
  onPageSizeChange?: (size: number) => void;
  hideFirstLast?: boolean;
  labels: {
    previous: string;
    next: string;
    summary: (from: number, to: number, total: number) => string;
    /**
     * Optional. Omitted, they resolve from the i18n context — never from an
     * English fallback. 38 call sites pass none of the three, and every one of
     * them announced "First page" / "Page 4" / "Last page" in English to an
     * Arabic screen-reader user until this defaulted through the dictionary.
     */
    first?: string;
    last?: string;
    page?: (n: number) => string;
    rowsPerPage?: string;
  };
  className?: string;
}

// Pagination arrows are direction-carrying — rtl:-scale-x-100 mirrors them
// rather than swapping icon components, so "previous" always points toward
// the start of reading direction. See docs/design/theming.md#rtl.
export function Pagination({
  page,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
  hideFirstLast = false,
  labels,
  className,
}: PaginationProps) {
  const t = useDictionary();
  const lang = useLanguage();
  const dir = useDirection();
  const rowsPerPageId = useId();
  const rowsPerPageLabelId = useId();

  const lastPage = Math.max(1, Math.ceil(page.total / page.limit));
  const from = page.total === 0 ? 0 : (page.page - 1) * page.limit + 1;
  const to = Math.min(page.page * page.limit, page.total);

  const validPageSizeOptions = pageSizeOptions
    ? Array.from(new Set(pageSizeOptions.filter((option) => Number.isSafeInteger(option) && option > 0)))
    : [];
  const rowsPerPageLabel = (labels.rowsPerPage ?? t.common.rowsPerPage).trim();
  const showPageSizePicker =
    validPageSizeOptions.length > 0 &&
    typeof onPageSizeChange === "function" &&
    rowsPerPageLabel.length > 0;

  function handlePageSizeChange(rawValue: string) {
    if (!onPageSizeChange || !/^\d+$/.test(rawValue)) return;
    const nextSize = Number(rawValue);
    if (!validPageSizeOptions.includes(nextSize) || nextSize === page.limit) return;
    onPageSizeChange(nextSize);
  }

  const summaryNode = <p className="text-xs text-muted-foreground">{labels.summary(from, to, page.total)}</p>;

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      {showPageSizePicker ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <Label
              id={rowsPerPageLabelId}
              htmlFor={rowsPerPageId}
              className="text-xs font-normal text-muted-foreground whitespace-nowrap"
            >
              {rowsPerPageLabel}
            </Label>
            <Select
              dir={dir}
              value={validPageSizeOptions.includes(page.limit) ? String(page.limit) : ""}
              onValueChange={handlePageSizeChange}
            >
              <SelectTrigger
                id={rowsPerPageId}
                aria-labelledby={rowsPerPageLabelId}
                size="xs"
                className={cn("w-auto min-w-14 tabular-nums", hitArea)}
              >
                <SelectValue placeholder={formatNumber(page.limit, lang)} />
              </SelectTrigger>
              <SelectContent>
                {validPageSizeOptions.map((option) => (
                  <SelectItem key={option} value={String(option)} className="tabular-nums text-xs">
                    {formatNumber(option, lang)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {summaryNode}
        </div>
      ) : (
        summaryNode
      )}

      <div className="flex flex-wrap items-center gap-1">
        {!hideFirstLast && (
          <Button
            variant="ghost"
            size="sm"
            disabled={page.page <= 1}
            onClick={() => onPageChange(1)}
            aria-label={labels.first ?? t.common.firstPage}
          >
            <ChevronsLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
          </Button>
        )}
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
              aria-label={labels.page?.(slot) ?? formatTemplate(t.common.pageNumber, { n: slot })}
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
        {!hideFirstLast && (
          <Button
            variant="ghost"
            size="sm"
            disabled={page.page >= lastPage}
            onClick={() => onPageChange(lastPage)}
            aria-label={labels.last ?? t.common.lastPage}
          >
            <ChevronsRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
