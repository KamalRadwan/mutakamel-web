"use client";

import { useDraftComparison, useSnapshotPage, useTemplateReviewDialog } from "../hooks/useTemplateDesignRecovery";
import { Badge, Button, DegradedBanner, Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger, EmptyState, ErrorState, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { type TemplateDraftDocument } from "../../template-design-api";
import type { EditorDocument } from "../../template-editor-model";
import { TemplateDesignCanvas } from "./TemplateDesignCanvas";

export { canReviewNewerDraft } from "../hooks/useTemplateDesignRecovery";
type AuthorityCheck = () => boolean;

export function TemplateDraftConflict({ base, local, current, onReload }: {
  base: TemplateDraftDocument;
  local: EditorDocument;
  current: AuthorityCheck;
  onReload: () => void;
}) {
  const { t } = useI18n();
  const copy = t.quotationPdf.draftRecovery;
  const { open, onOpenChange, notice } = useTemplateReviewDialog(current, true);
  return (
    <section className="grid gap-2 rounded-lg border border-border bg-destructive/5 p-4">
      <div ref={notice} role="alert" tabIndex={-1}>
        <h2 className="font-medium text-destructive">{copy.conflictTitle}</h2>
        <p className="text-sm text-muted-foreground">{copy.conflictHelp}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogTrigger asChild><Button variant="outline">{copy.compare}</Button></DialogTrigger>
          <DialogContent size="2xl" className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-[1100px] overflow-auto">
            <DialogTitle className="pe-10">{copy.compare}</DialogTitle>
            <DialogDescription>{copy.comparisonHelp}</DialogDescription>
            {open && <DraftComparison base={base} local={local} current={current} />}
          </DialogContent>
        </Dialog>
        <Button variant="outline" onClick={onReload}>{t.quotationPdf.reload}</Button>
      </div>
    </section>
  );
}

function DraftComparison({ base, local, current }: {
  base: TemplateDraftDocument; local: EditorDocument; current: AuthorityCheck;
}) {
  const { t } = useI18n();
  const copy = t.quotationPdf.draftRecovery;
  const { result, retry } = useDraftComparison(base, current);

  if (result.state === "loading") return <Skeleton className="h-24" aria-busy="true" />;
  if (result.state === "unavailable") return <DegradedBanner message={copy.savedUnavailable} />;
  if (result.state !== "ready") return <ErrorState title={copy.savedUnavailable} retryLabel={t.common.retry}
    onRetry={retry} />;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <section className="min-w-0 space-y-2">
        <h3 className="font-medium">{copy.local}</h3>
        <Badge tone="neutral">{t.quotationPdf.draft} <bdi>{base.revision}</bdi></Badge>
        <TemplateDesignCanvas document={local} label={copy.local} />
      </section>
      <section className="min-w-0 space-y-2">
        <h3 className="font-medium">{copy.saved}</h3>
        <Badge tone="neutral">{t.quotationPdf.draft} <bdi>{result.draft.revision}</bdi></Badge>
        <TemplateDesignCanvas document={result.draft.editorDocument} label={copy.saved} />
      </section>
    </div>
  );
}

export function TemplateSnapshotReview({ templateId, current }: { templateId: string; current: AuthorityCheck }) {
  const { t } = useI18n();
  const copy = t.quotationPdf.draftRecovery;
  const { open, onOpenChange } = useTemplateReviewDialog(current);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild><Button variant="outline" size="sm">{copy.snapshots}</Button></DialogTrigger>
      <DialogContent size="2xl" className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-auto">
        <DialogTitle className="pe-10">{copy.snapshots}</DialogTitle>
        <DialogDescription>{copy.metadataOnly}</DialogDescription>
        {open && <SnapshotPage templateId={templateId} current={current} />}
      </DialogContent>
    </Dialog>
  );
}

function SnapshotPage({ templateId, current }: { templateId: string; current: AuthorityCheck }) {
  const { t, lang } = useI18n();
  const copy = t.coreOperations.templates;
  const labels = t.quotationPdf.draftRecovery;
  const { cursor, result, retry, previous, next } = useSnapshotPage(templateId, current);

  if (result.state === "loading") return <Skeleton className="h-24" aria-busy="true" />;
  if (result.state === "unavailable") return <DegradedBanner message={labels.snapshotsUnavailable} />;
  if (result.state !== "ready") return <ErrorState title={copy.recoveryLoadFailed} retryLabel={t.common.retry}
    onRetry={retry} />;
  const { page, observedAt } = result;
  return (
    <>
      {cursor.wasReset && <DegradedBanner message={copy.cursorExpired} />}
      {page.items.length ? (
        <ul className="divide-y divide-border">
          {page.items.map(snapshot => (
            <li key={snapshot.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p>{formatTemplate(copy.snapshotLabel, { revision: String(snapshot.sourceDraftRevision) })}</p>
                <p className="text-xs text-muted-foreground">{formatTemplate(copy.snapshotExpiry, {
                  created: formatDateTime(snapshot.createdAt, lang), expires: formatDateTime(snapshot.expiresAt, lang),
                })}</p>
              </div>
              <span className="flex flex-wrap items-center gap-2">
                {snapshot.objectDeletedAt || Date.parse(snapshot.expiresAt) <= observedAt ?
                  <Badge tone="neutral">{labels.expired}</Badge> : snapshot.integrityStatus !== "AVAILABLE" ?
                    <Badge tone="negative">{copy.snapshotQuarantined}</Badge> :
                    <Badge tone="neutral">{labels.metadata}</Badge>}
                {snapshot.restoredAt && <Badge tone="neutral">{copy.snapshotRestoredBadge}</Badge>}
              </span>
            </li>
          ))}
        </ul>
      ) : <EmptyState title={copy.recoveryEmpty} description={copy.recoveryEmptyDescription} />}
      {(cursor.canGoBack || page.nextCursor) && <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" disabled={!cursor.canGoBack} onClick={previous}>{t.common.previousPage}</Button>
        <Button variant="outline" disabled={!page.hasNextPage || !page.nextCursor} onClick={next}>{t.common.nextPage}</Button>
      </div>}
    </>
  );
}
