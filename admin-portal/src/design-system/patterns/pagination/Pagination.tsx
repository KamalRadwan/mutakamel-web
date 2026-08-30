"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { formatLocaleNumber } from "@/i18n/locale";
import { Button } from "../../primitives/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../primitives/Select";
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

  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);
  const hasPrev = safePage > 1;
  const hasNext = safePage < safeTotalPages;
  const rangeStart = totalItems === 0 ? 0 : (safePage - 1) * limit + 1;
  const rangeEnd = Math.min(safePage * limit, totalItems);
  const number = (value: number) => formatLocaleNumber(lang, value);

  return (
    <nav
      aria-label={lang === "ar" ? "ترقيم صفحات الجدول" : "Table pagination"}
      className="flex flex-col items-stretch justify-between gap-3 border-t border-border bg-card p-4 text-xs sm:flex-row sm:items-center"
    >
      <span className="font-medium text-muted-foreground">
        {lang === "ar"
          ? `عرض ${number(rangeStart)}–${number(rangeEnd)} من ${number(totalItems)} · الصفحة ${number(safePage)} من ${number(safeTotalPages)}`
          : `Showing ${number(rangeStart)}–${number(rangeEnd)} of ${number(totalItems)} · Page ${number(safePage)} of ${number(safeTotalPages)}`}
      </span>

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        {onLimitChange && (
          <label className="flex items-center justify-between gap-2 text-muted-foreground sm:justify-start">
            {lang === "ar" ? "لكل صفحة" : "Per page"}
            <Select value={String(limit)} onValueChange={(value) => onLimitChange(Number(value))}>
              <SelectTrigger
                aria-label={lang === "ar" ? "عدد الصفوف في كل صفحة" : "Rows per page"}
                className="h-(--size-control-sm) w-auto min-w-20 px-2 text-xs"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
              {LIMIT_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {number(n)}
                </SelectItem>
              ))}
              </SelectContent>
            </Select>
          </label>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasPrev}
            onClick={() => onPageChange(safePage - 1)}
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
            onClick={() => onPageChange(safePage + 1)}
            aria-label={lang === "ar" ? "الصفحة التالية" : "Next page"}
          >
            {lang === "ar" ? "التالي" : "Next"}
            {lang === "ar" ? <ChevronLeft className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </Button>
        </div>
      </div>
    </nav>
  );
}
