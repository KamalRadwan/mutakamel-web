"use client";

import { Badge, Button, DataTable, IdentifierText } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { useCategoryList } from "../hooks/useCategoryReads";
import { CATEGORY_PAGE_SIZE } from "../category-contract";

export function CategoryListPanel({ list, page, onPage, onSelect }: {
  list: ReturnType<typeof useCategoryList>; page: number; onPage: (page: number) => void; onSelect: (id: string) => void;
}) {
  const { t, lang } = useI18n(); const copy = t.trade.categories;
  return <DataTable rows={list.data?.items ?? []} rowKey={(node) => node.id} isLoading={list.loading}
    error={list.error} onRetry={() => void list.reload()} onPageChange={onPage}
    page={{ page, limit: CATEGORY_PAGE_SIZE, total: list.data?.total ?? 0 }}
    columns={[
      { id: "name", header: copy.defaultName, cell: (node) => <Button variant="ghost" size="sm" onClick={() => onSelect(node.id)}>{node.name}</Button> },
      { id: "code", header: copy.code, cell: (node) => <IdentifierText>{node.code}</IdentifierText> },
      { id: "path", header: copy.path, cell: (node) => node.path.map((entry) => entry.name).join(" / ") },
      { id: "status", header: t.common.status, cell: (node) => <Badge tone={node.effectiveActive ? "positive" : "neutral"}>
        {node.status === "ACTIVE" ? node.effectiveActive ? copy.status.ACTIVE : copy.inheritedInactive : node.status === "INACTIVE" ? copy.status.INACTIVE : copy.status.unknown}
      </Badge> },
    ]}
    labels={{ retry: t.common.retry, errorTitle: copy.loadFailed, emptyTitle: copy.noMatches,
      selectAll: t.common.actions, selectRow: t.common.actions, sortAscending: t.common.actions,
      sortDescending: t.common.actions, notSorted: t.common.actions,
      pagination: { previous: t.common.previousPage, next: t.common.nextPage,
        summary: (from, to, total) => formatTemplate(t.common.showingOf, { from: formatNumber(from, lang), to: formatNumber(to, lang), total: formatNumber(total, lang) }) },
    }} />;
}
