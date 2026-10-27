"use client";

import { Pagination } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";

export function InventoryListPagination({ page, onPageChange, isRefreshing }: {
  page: { page: number; total: number; limit: number };
  onPageChange: (page: number) => void;
  isRefreshing: boolean;
}) {
  const { t, lang } = useI18n();
  return (
    <fieldset disabled={isRefreshing} className="min-w-0 border-0 p-0">
      <Pagination
        page={page}
        onPageChange={onPageChange}
        labels={{
          previous: t.common.previousPage,
          next: t.common.nextPage,
          summary: (from, to, total) => formatTemplate(t.common.showingOf, {
            from: formatNumber(from, lang),
            to: formatNumber(to, lang),
            total: formatNumber(total, lang),
          }),
        }}
      />
    </fieldset>
  );
}
