"use client";

import { DetailSection, ErrorState, PermissionGate, Timeline } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { toTimelineEvent } from "./EntityHistoryEvent";
import { useRecordHistory, type RecordHistoryOptions } from "./hooks/useRecordHistory";

export type EntityHistoryCardProps = RecordHistoryOptions & { density?: "standard" | "compact" };

export function EntityHistoryCard({ density, ...subject }: EntityHistoryCardProps) {
  const { t, lang } = useI18n();
  const history = useRecordHistory(subject);
  const copy = t.audit;
  if (!history.canRead) return null;
  if (history.denied) return <PermissionGate require={[]} denied>{null}</PermissionGate>;
  return <DetailSection title={copy.historyTitle} density={density}>
    {history.failed ? <ErrorState title={copy.loadFailed} onRetry={history.reload} retryLabel={t.common.retry} />
      : <Timeline density={density} label={copy.historyTitle}
        events={history.events.map((event) => toTimelineEvent(event, lang, copy, t.statusValues,
          history.resolvedLabels, subject, history.people))}
        isLoading={history.isLoading} emptyTitle={copy.historyEmptyTitle}
        emptyDescription={copy.historyEmptyDescription}
        onLoadMore={history.cursor ? history.loadMore : undefined}
        loadMoreLabel={copy.loadMore} isLoadingMore={history.isLoadingMore} />}
    {history.moreFailed ? <ErrorState title={copy.loadFailed} onRetry={history.loadMore} retryLabel={t.common.retry} /> : null}
  </DetailSection>;
}
