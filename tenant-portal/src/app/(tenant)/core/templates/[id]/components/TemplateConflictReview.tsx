"use client";

import { Badge, Button, DegradedBanner, Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger, ErrorState, PermissionGate, Skeleton } from "@/design-system";
import { TEMPLATE_READ_PERMISSION, TEMPLATE_UPDATE_PERMISSION } from "../../templates-contract";
import type { TemplateConflictCopy } from "@/i18n/dictionaries/template-conflict";
import { useTemplateConflictReview, type TemplateConflictReviewInput } from "../hooks/useTemplateConflictReview";
import { TemplateConflictDifferenceList } from "./TemplateConflictDifferenceList";
import { TemplateConflictDiscardDialog } from "./TemplateConflictDiscardDialog";

export function TemplateConflictReview(props: TemplateConflictReviewInput & { copy: TemplateConflictCopy; locale: string }) {
  const { authority, blocked, base, copy, locale } = props;
  const { notice, host, comparisonRoot, discardRoot, comparisonLifecycle, discardLifecycle, open, onOpenChange, result, comparison, confirmingDiscard, requestReload, confirmReload, cancelDiscard, retry } = useTemplateConflictReview(props);
  const number = new Intl.NumberFormat(locale);
  if (!authority.readable) return null;
  return <section ref={host} className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4">
    <div ref={notice} role="alert" tabIndex={-1}>
      <h2 className="font-medium">{copy.title}</h2>
      <p className="text-sm text-muted-foreground">{copy.help}</p>
    </div>
    <div className="flex flex-wrap gap-2">
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild><Button variant="outline" disabled={blocked}>{copy.compare}</Button></DialogTrigger>
        <DialogContent ref={comparisonRoot} {...comparisonLifecycle} size="2xl" className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-auto">
          <DialogTitle className="pe-10">{copy.compare}</DialogTitle>
          <DialogDescription>{copy.comparisonHelp}</DialogDescription>
          {open && <>
            {result.state === "loading" && <div role="status"><span className="sr-only">{copy.loading}</span><Skeleton className="h-24" aria-busy="true" /></div>}
            {result.state === "unavailable" && <DegradedBanner message={copy.unavailable} />}
            {result.state === "denied" && <PermissionGate require={[TEMPLATE_READ_PERMISSION, TEMPLATE_UPDATE_PERMISSION]} denied>{null}</PermissionGate>}
            {result.state === "failed" && <ErrorState title={copy.failed} retryLabel={copy.retry} onRetry={retry} />}
            {result.state === "ready" && comparison && <>
              <div className="flex flex-wrap gap-2">
                <Badge tone="neutral">{copy.base} · {copy.revision} <bdi>{number.format(base.revision)}</bdi></Badge>
                <Badge tone="neutral">{copy.saved} · {copy.revision} <bdi>{number.format(result.draft.revision)}</bdi></Badge>
              </div>
              <TemplateConflictDifferenceList comparison={comparison} copy={copy} locale={locale} />
            </>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>{copy.close}</Button>
              <Button variant="outline" disabled={blocked} onClick={requestReload}>{copy.reload}</Button>
            </div>
          </>}
        </DialogContent>
      </Dialog>
      <Button variant="outline" disabled={blocked} onClick={requestReload}>{copy.reload}</Button>
    </div>
    <TemplateConflictDiscardDialog open={confirmingDiscard} copy={copy} root={discardRoot} lifecycle={discardLifecycle} cancel={cancelDiscard} confirm={confirmReload} />
  </section>;
}

export function TemplateRecoveryBodyUnavailable({ copy }: { copy: TemplateConflictCopy }) {
  return <DegradedBanner message={copy.snapshotUnavailable} />;
}
