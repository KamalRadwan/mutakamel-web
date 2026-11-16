"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  HistorySection,
  PermissionGate,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type HistoryFilterOption,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  HISTORY_SUBJECT_CATEGORIES,
  type HistorySubjectCategory,
} from "@/lib/audit/entity-history-contract";
import { toHistoryTreeItem } from "./EntityHistoryEvent";
import { useAuditAccess } from "./hooks/useAuditAccess";
import { useRecordHistory, type RecordHistoryOptions } from "./hooks/useRecordHistory";

export type RecordHistoryTabProps = Omit<RecordHistoryOptions, "historyCategory"> & {
  density?: "standard" | "compact";
  children?: ReactNode;
};

type FilterValue = "all" | HistorySubjectCategory;

function RecordHistoryConnectedSection({
  density,
  ...subject
}: Omit<RecordHistoryTabProps, "children">) {
  const { t, lang } = useI18n();
  const [selectedCategory, setSelectedCategory] = useState<FilterValue>("all");
  const hasRelatedFilter = Boolean(subject.relatedPartyIds?.length);
  const history = useRecordHistory({
    ...subject,
    historyCategory:
      hasRelatedFilter && selectedCategory !== "all" ? selectedCategory : null,
  });
  const copy = t.audit;

  const items = useMemo(
    () =>
      history.events.map((event) =>
        toHistoryTreeItem(
          event,
          lang,
          copy,
          t.statusValues,
          history.resolvedLabels,
          subject,
          history.people,
        ),
      ),
    [history.events, lang, copy, t.statusValues, history.resolvedLabels, subject, history.people],
  );

  const filterOptions = useMemo<readonly HistoryFilterOption<FilterValue>[] | undefined>(
    () =>
      hasRelatedFilter
        ? [
            { value: "all", label: copy.filters.all },
            ...HISTORY_SUBJECT_CATEGORIES.map((category) => ({
              value: category,
              label: copy.filters[category],
            })),
          ]
        : undefined,
    [hasRelatedFilter, copy.filters],
  );

  if (!history.canRead) return null;
  if (history.denied) return <PermissionGate require={[]} denied>{null}</PermissionGate>;

  return (
    <HistorySection
      title={copy.historyTitle}
      density={density}
      items={items}
      detailsLabel={copy.detailsOfChanges}
      emptyDetailsLabel={copy.detailsNotRecorded}
      expandAllLabel={copy.expandAll}
      collapseAllLabel={copy.collapseAll}
      filters={filterOptions}
      filterLabel={copy.filterLabel}
      selectedFilter={hasRelatedFilter ? selectedCategory : undefined}
      onFilterChange={hasRelatedFilter ? setSelectedCategory : undefined}
      isLoading={history.isLoading}
      emptyTitle={copy.historyEmptyTitle}
      emptyDescription={copy.historyEmptyDescription}
      errorTitle={history.failed ? copy.loadFailed : null}
      onRetry={history.reload}
      retryLabel={t.common.retry}
      onLoadMore={history.cursor ? history.loadMore : undefined}
      loadMoreLabel={copy.loadMore}
      isLoadingMore={history.isLoadingMore}
      loadMoreErrorTitle={history.moreFailed ? copy.loadFailed : null}
      onRetryLoadMore={history.loadMore}
    />
  );
}

/**
 * Canonical connected Record History Template (`src/components/audit/RecordHistoryTab.tsx`).
 *
 * - Standalone / inline dossier tabs: `<RecordHistoryTab entityType="..." entityId="..." />`
 * - Route layout wrapper (`Record | History`): `<RecordHistoryTab ...>{children}</RecordHistoryTab>`
 */
export function RecordHistoryTab({ children, ...subject }: RecordHistoryTabProps) {
  const { t } = useI18n();
  const canRead = useAuditAccess();
  if (!canRead) return children ?? null;
  if (children === undefined) return <RecordHistoryConnectedSection {...subject} />;
  return (
    <Tabs defaultValue="record" className="flex min-h-0 flex-1 flex-col gap-4">
      <TabsList aria-label={t.audit.ledger.record}>
        <TabsTrigger value="record">{t.audit.recordTabTitle}</TabsTrigger>
        <TabsTrigger value="history">{t.audit.historyTitle}</TabsTrigger>
      </TabsList>
      <TabsContent
        value="record"
        forceMount
        className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden"
      >
        {children}
      </TabsContent>
      <TabsContent value="history" className="mt-0">
        <RecordHistoryConnectedSection {...subject} />
      </TabsContent>
    </Tabs>
  );
}
