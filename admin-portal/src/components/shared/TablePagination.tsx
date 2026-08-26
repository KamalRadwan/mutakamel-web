"use client";

import { useI18n } from "@/i18n/I18nContext";

interface PaginationMeta {
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

interface TablePaginationProps {
  meta: PaginationMeta;
  page: number;
  setPage: (updater: (prev: number) => number) => void;
}

export function TablePagination({ meta, page, setPage }: TablePaginationProps) {
  const { lang } = useI18n();
  if (meta.totalPages <= 1) return null;

  return (
    <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
      <span className="text-slate-500 dark:text-slate-400 font-medium">
        {lang === "ar"
          ? `الصفحة ${page} من ${meta.totalPages}`
          : `Page ${page} of ${meta.totalPages}`}
      </span>
      <div className="flex gap-2">
        <button
          disabled={!meta.hasPrev}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          aria-label={lang === "ar" ? "الصفحة السابقة" : "Previous page"}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-semibold"
        >
          {lang === "ar" ? "السابق" : "Previous"}
        </button>
        <button
          disabled={!meta.hasNext}
          onClick={() => setPage((p) => p + 1)}
          aria-label={lang === "ar" ? "الصفحة التالية" : "Next page"}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-semibold"
        >
          {lang === "ar" ? "التالي" : "Next"}
        </button>
      </div>
    </div>
  );
}
