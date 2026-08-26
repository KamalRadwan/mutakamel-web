"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Button } from "../../primitives/Button";
import type { DataTablePaginationProps } from "../data-table/types";

const LIMIT_OPTIONS = [10, 20, 50, 100];

/**
 * Absorbs the old TablePagination.tsx (src/components/shared/), fixing its
 * English-only hardcoding ("Page X of Y", "Previous", "Next"). Consumed
 * directly by DataTable, and usable standalone anywhere the DataTable
 * pagination shape already fits.
 */
export function Pagination({
  page,
  limit,
  totalItems,
  totalPages,
  onPageChange,
  onLimitChange,
}: DataTablePaginationProps) {
  const { lang } = useI18n();

  if (totalPages <= 1 && !onLimitChange) return null;

  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const rangeStart = totalItems === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = Math.min(page * limit, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4 text-xs">
      <span className="font-medium text-muted-foreground">
        {lang === "ar"
          ? `عرض ${rangeStart}–${rangeEnd} من ${totalItems} · الصفحة ${page} من ${totalPages}`
          : `Showing ${rangeStart}–${rangeEnd} of ${totalItems} · Page ${page} of ${totalPages}`}
      </span>

      <div className="flex items-center gap-3">
        {onLimitChange && (
          <label className="flex items-center gap-1.5 text-muted-foreground">
            {lang === "ar" ? "لكل صفحة" : "Per page"}
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="h-(--size-control-sm) rounded-md border border-border bg-card px-1.5 text-xs text-foreground"
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasPrev}
            onClick={() => onPageChange(page - 1)}
            aria-label={lang === "ar" ? "الصفحة السابقة" : "Previous page"}
          >
            {lang === "ar" ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
            {lang === "ar" ? "السابق" : "Previous"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasNext}
            onClick={() => onPageChange(page + 1)}
            aria-label={lang === "ar" ? "الصفحة التالية" : "Next page"}
          >
            {lang === "ar" ? "التالي" : "Next"}
            {lang === "ar" ? <ChevronLeft className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
