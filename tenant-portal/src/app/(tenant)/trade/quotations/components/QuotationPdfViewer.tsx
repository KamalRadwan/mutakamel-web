"use client";

import { ArrowUpRight, Loader2 } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { useQuotationPdfArtifact } from "../hooks/useQuotationPdfArtifact";
import { useQuotationPdfViewerActions, type QuotationPdfLinkRenewal } from "../hooks/useQuotationPdfViewerActions";

interface QuotationPdfViewerProps {
  viewer: Pick<ReturnType<typeof useQuotationPdfArtifact>, "open" | "setOpen" | "url" | "error" | "loading" | "retry">;
  download?: { run: () => void; busy: boolean; disabled: boolean; error?: string };
  renewal?: QuotationPdfLinkRenewal;
  accessRecovery?: QuotationPdfLinkRenewal;
}

export function QuotationPdfViewer({ viewer, download, renewal, accessRecovery }: QuotationPdfViewerProps) {
  const { t } = useI18n();
  const c = t.quotationPdf;
  const { actionRef, titleRef, focusTitle, refresh, refreshDisabled } = useQuotationPdfViewerActions(renewal ?? accessRecovery);
  const loading = viewer.loading || (!viewer.url && !viewer.error);
  const previewUrl = loading || viewer.error ? null : viewer.url;

  return (
    <Dialog open={viewer.open} onOpenChange={viewer.setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ArrowUpRight className="size-4" aria-hidden="true" />{c.previewActual}
        </Button>
      </DialogTrigger>
      <DialogContent size="2xl" onOpenAutoFocus={focusTitle} className="flex h-[90dvh] w-[calc(100vw-2rem)] max-w-[1200px] flex-col gap-4 p-4 sm:p-6">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 pe-8">
          <div>
            <DialogTitle ref={titleRef} tabIndex={-1}>{c.previewActual}</DialogTitle>
            <DialogDescription role="status">{previewUrl ? c.ready : null}</DialogDescription>
          </div>
          {renewal || download || accessRecovery ? (
            <div className="flex flex-col items-start gap-2">
              {renewal ? (
                <>
                  <p role="status" className="text-sm text-muted-foreground">{c.expired}</p>
                  <Button
                    ref={actionRef}
                    variant="outline"
                    aria-busy={renewal.busy || undefined}
                    aria-disabled={refreshDisabled || undefined}
                    className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                    onClick={refresh}
                  >
                    {renewal.busy ? <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden="true" /> : null}
                    {c.refreshLink}
                  </Button>
                  {renewal.error ? <p role="alert" className="text-sm text-destructive">{renewal.error}</p> : null}
                </>
              ) : accessRecovery ? (
                <Button ref={actionRef} variant="outline" aria-busy={accessRecovery.busy || undefined}
                  aria-disabled={refreshDisabled || undefined} onClick={refresh}>
                  {c.retry}
                </Button>
              ) : (
                <Button ref={actionRef} variant="outline" aria-busy={download?.busy || undefined}
                  aria-disabled={download?.disabled || undefined} onClick={download?.disabled ? undefined : download?.run}>
                  {c.download}
                </Button>
              )}
            </div>
          ) : null}
        </div>
        {download?.error ? <p role="alert" className="text-sm text-destructive">{download.error}</p> : null}
        {loading ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <p role="status" className="text-sm text-muted-foreground">{t.common.loading}</p>
            <Skeleton aria-hidden="true" className="flex-1" />
          </div>
        ) : viewer.error ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-auto rounded-card bg-muted/40 p-4 sm:p-8">
            <p role="alert" className="text-sm text-destructive">{accessRecovery?.error ?? (download ? c.previewFailed : t.tradeDocuments.errors.pdfArtifactUnavailable)}</p>
            {accessRecovery ? null : <Button variant="outline" onClick={viewer.retry}>{c.retry}</Button>}
          </div>
        ) : previewUrl ? (
          <iframe src={previewUrl} title={c.previewActual} className="min-h-0 w-full flex-1 rounded-lg border border-border bg-muted" />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
