"use client";

import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { CheckCircle2, Download, FileText, LayoutTemplate, Link2, LoaderCircle, RefreshCw } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Field, IdentifierText, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeDocumentMessage } from "../../documents/trade-document-errors";
import type { QuotationDetail } from "../quotation-contract";
import { useQuotationPdfWorkspace } from "../hooks/useQuotationPdfWorkspace";
import { QuotationPdfViewer } from "./QuotationPdfViewer";
import { QuotationTemplateGallery } from "./QuotationTemplateGallery";

export interface QuotationPdfWorkspaceProps {
  quotation: QuotationDetail;
  headers: Record<string, string>;
  enabled?: boolean;
  compact?: boolean;
  reopenJobId?: string;
  templateChooserRef?: RefObject<HTMLButtonElement | null>;
}

type ResumeOwner = { scopeKey: string; jobId: string };

export function QuotationPdfWorkspace({ quotation, headers, enabled = true, compact = false, reopenJobId, templateChooserRef }: QuotationPdfWorkspaceProps) {
  const state = useQuotationPdfWorkspace(quotation, headers, enabled, reopenJobId);
  const { t, pdf, library, viewer } = state; const c = t.quotationPdf;
  const workspaceHeading = useRef<HTMLHeadingElement>(null);
  const restoreSetupFocus = useRef(false);
  const trackSetupLink = useCallback((link: HTMLAnchorElement | null) => {
    if (link) return () => { restoreSetupFocus.current = link.ownerDocument.activeElement === link; };
  }, []);
  useLayoutEffect(() => {
    if (!restoreSetupFocus.current) return;
    restoreSetupFocus.current = false;
    const heading = workspaceHeading.current;
    if (heading && heading.ownerDocument.activeElement === heading.ownerDocument.body) {
      heading.focus({ preventScroll: true });
    }
  }, [state.showDefaultAssignmentSetup]);
  const failed = pdf.uiStatus === "FAILED";
  const expired = pdf.uiStatus === "ARTIFACT_EXPIRED";
  const artifact = pdf.uiStatus === "SUCCEEDED" || expired ? pdf.job?.artifact : null;
  const accessError = viewer.accessError;
  const linkUnavailable = expired || !!accessError;
  const canDownload = !!artifact && !linkUnavailable;
  const reopenHref = canDownload && pdf.job
    ? `${TENANT_ROUTES.tradeQuotations}/${quotation.id}?pdfJobId=${pdf.job.renderJobId}#quotation-pdf-workspace`
    : null;
  const downloadBusy = !!viewer.downloadBusy;
  const downloadDisabled = downloadBusy || pdf.isPolling || pdf.write.isBlocked;
  const pollError = pdf.pollError ? tradeDocumentMessage(pdf.pollError.code, t.tradeDocuments.errors) ?? c.requestError : null;
  const reopenRecovery = !!reopenJobId && !pdf.job && (pdf.isPolling || !!pollError || pdf.isPollExhausted);
  const refreshDisabled = pdf.isPolling || pdf.write.isBlocked;
  const downloadError = viewer.downloadError ? t.tradeDocuments.errors.pdfArtifactUnavailable : pollError ?? undefined;
  const recovery = { refresh: pdf.refresh, busy: pdf.isPolling, disabled: pdf.write.isBlocked, error: pollError };
  const renewal = expired && !accessError ? recovery : undefined;
  const accessRecovery = accessError ? {
    ...recovery, error: pollError ?? tradeDocumentMessage(accessError.code, t.tradeDocuments.errors) ?? t.tradeDocuments.errors.pdfArtifactUnavailable,
  } : undefined;
  const active = pdf.uiStatus === "QUEUED" || pdf.uiStatus === "RUNNING";
  const { statusActionKey } = state;
  const jobId = pdf.job?.renderJobId;
  const [resumedJob, setResumedJob] = useState<ResumeOwner | null>(null);
  const generateAction = useRef<HTMLButtonElement>(null);
  const resumeFocus = useRef<ResumeOwner | null>(null);
  const acceptedRecovery = active && (!!pollError || pdf.isPollExhausted ||
    (pdf.isPolling && resumedJob !== null && resumedJob.scopeKey === statusActionKey && resumedJob.jobId === jobId));
  const statusRecovery = reopenRecovery || acceptedRecovery;

  const resumeStatus = () => {
    if (!active || !jobId) {
      void pdf.refresh();
      return;
    }
    const attempt = { scopeKey: statusActionKey, jobId };
    setResumedJob(attempt);
    void pdf.refresh().finally(() => setResumedJob((current) => current === attempt ? null : current));
  };

  const captureResumeFocus = useCallback((button: HTMLButtonElement | null) => {
    if (button && jobId) return () => {
      if (button.ownerDocument.activeElement === button) resumeFocus.current = { scopeKey: statusActionKey, jobId };
    };
  }, [statusActionKey, jobId]);

  useLayoutEffect(() => {
    const source = resumeFocus.current;
    resumeFocus.current = null;
    const button = generateAction.current;
    if (failed && source && source.scopeKey === statusActionKey && source.jobId === jobId &&
      button && !button.disabled && button.ownerDocument.activeElement === button.ownerDocument.body &&
      state.isTemplateFocusOwnerCurrent()) {
      button.focus({ preventScroll: true });
    }
  }, [acceptedRecovery, failed, jobId, state.isTemplateFocusOwnerCurrent, statusActionKey]);
  if (!state.eligible) return <>
    <section role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-card px-4 py-3 sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <FileText className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <h3 ref={workspaceHeading} tabIndex={-1} className="text-base font-semibold">{quotation.lifecycleStatus === "DRAFT" ? c.awaitingIssueTitle : c.title}</h3>
        <p id={`quotation-pdf-gate-${quotation.id}`} className="min-w-0 text-sm text-muted-foreground">{state.reason}</p>
      </div>
      <Button variant="outline" disabled aria-describedby={`quotation-pdf-gate-${quotation.id}`}><FileText className="size-4" aria-hidden="true" />{c.exportPdf}</Button>
    </section>
    {state.cancelledJobStatus ? <div className="flex flex-wrap items-center justify-between gap-3">
      <p role="status" className="text-sm">
        {pollError ?? (state.cancelledJobStatus === "COMPLETED" ? c.previousRequestCompleted
          : state.cancelledJobStatus === "FAILED" ? c.failed
          : state.cancelledJobStatus === "RETRYING" ? c.retrying : c.queued)}
      </p>
      {state.canCheckCancelledJob ? (
        <Button variant="outline" size="sm" disabled={refreshDisabled} onClick={() => void pdf.refresh()}>{c.resume}</Button>
      ) : null}
    </div> : null}
  </>;
  return <Card className="overflow-hidden rounded-card border-border/80">
    <CardHeader className="flex-row items-start gap-3 bg-muted/20"><span className="rounded-lg bg-primary/10 p-2.5 text-primary"><FileText className="size-5" aria-hidden="true" /></span><div className="flex-1"><CardTitle ref={workspaceHeading} tabIndex={-1}>{c.title}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{c.description}</p></div>{state.revision ? <Badge tone="neutral">{c.revision} {state.revision.revisionNumber}</Badge> : null}</CardHeader>
    <CardContent className={`flex flex-col gap-4 pt-5 ${compact ? "px-4" : "px-6"}`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={c.language} showLabel><Select value={state.locale} onValueChange={state.setLocale} disabled={state.locked}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ar-EG">{c.arabic}</SelectItem><SelectItem value="en-US">{c.english}</SelectItem></SelectContent></Select></Field>
        <Field label={c.timeZone} showLabel><Select value={state.timeZone} onValueChange={state.setTimeZone} disabled={state.locked}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Africa/Cairo">Africa/Cairo</SelectItem><SelectItem value="Asia/Riyadh">Asia/Riyadh</SelectItem><SelectItem value="Asia/Dubai">Asia/Dubai</SelectItem><SelectItem value="UTC">UTC</SelectItem></SelectContent></Select></Field>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4">
        <LayoutTemplate className="size-5 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <Field label={c.chooseTemplate} showLabel>
            <Select value={state.selected ? "PUBLISHED" : state.builtInSelected ? "BUILT_IN" : "AUTOMATIC"}
              onValueChange={(value) => {
                if (value === "AUTOMATIC") state.choose(null);
                if (value === "BUILT_IN") state.choose("BUILT_IN");
              }} disabled={state.locked}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AUTOMATIC">{c.defaultTemplate}</SelectItem>
                <SelectItem value="BUILT_IN">{c.builtInDesign}</SelectItem>
                {state.selected ? <SelectItem value="PUBLISHED">{state.selected.name}</SelectItem> : null}
              </SelectContent>
            </Select>
          </Field>
          {state.selected || !state.builtInSelected ? (
            <p className="mt-1 text-xs text-muted-foreground">{state.selected ? `${c.version} ${state.selected.version} · ${state.selected.locale}` : c.defaultHint}</p>
          ) : null}
        </div>
        <QuotationTemplateGallery
          library={library}
          selected={state.selected}
          canRead={state.canReadLibrary}
          canPreview={state.canPreview}
          choose={state.choose}
          isFocusOwnerCurrent={state.isTemplateFocusOwnerCurrent}
          fallbackFocusRef={workspaceHeading}
          trigger={(
            <Button ref={templateChooserRef} type="button" variant="outline" size="sm" disabled={state.locked || !state.canChangeTemplate}>
              {c.changeTemplate}
            </Button>
          )}
        />
      </div>
      {pdf.write.writeError ? (
        <p role="alert" className="text-sm text-destructive">
          {state.writeErrorMessage ?? c.requestError}
          {state.templateErrorReference ? (
            <span className="mt-1 block">{t.errors.reference} <IdentifierText>{state.templateErrorReference}</IdentifierText></span>
          ) : null}
        </p>
      ) : null}
      {state.showDefaultAssignmentSetup ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a ref={trackSetupLink} href={TENANT_ROUTES.coreTemplateAssignments}
              aria-describedby={`quotation-template-setup-${quotation.id}`}
              onClick={(event) => {
                if (state.isDefaultAssignmentSetupCurrent()) return;
                event.preventDefault();
                workspaceHeading.current?.focus({ preventScroll: true });
              }}>
              {t.coreOperations.templates.assignmentsTitle}
            </a>
          </Button>
          <p id={`quotation-template-setup-${quotation.id}`} className="text-sm text-muted-foreground">{c.businessDefaultTemplateSetup}</p>
        </div>
      ) : null}
      {pdf.isPolling && !pdf.job && !reopenRecovery ? <p role="status" className="text-sm text-muted-foreground">{t.common.loading}</p> : null}
      {active ? <div role="status" aria-live="polite" className="flex gap-3 rounded-lg bg-primary/5 p-4"><LoaderCircle className={`mt-0.5 size-5 shrink-0 text-primary ${pdf.isPolling ? "animate-spin" : ""}`} aria-hidden="true" /><div><p className="text-sm font-medium">{pdf.job?.status === "RETRYING" ? c.retrying : c.queued}</p><p className="mt-1 text-xs text-muted-foreground">{c.attempt} {pdf.job?.attemptCount} · {c.noProgress}</p></div></div> : null}
      {failed ? <div role="alert" className="rounded-lg bg-destructive/5 p-4"><p className="text-sm font-medium text-destructive">{c.failed}</p><p className="mt-1 text-xs text-muted-foreground">{tradeDocumentMessage(pdf.job?.failure?.code, t.tradeDocuments.errors) ?? c.failedHint}</p></div> : null}
      {!expired && !statusRecovery && (pollError || pdf.isPollExhausted) ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-4"><p role="status" className="text-sm">{pollError ?? c.paused}</p><Button variant="outline" size="sm" disabled={state.locked} onClick={() => void pdf.refresh()}><RefreshCw className="size-4" aria-hidden="true" />{c.resume}</Button></div> : null}
      {artifact || expired || statusRecovery ? (
        <div key={state.statusActionKey} className={linkUnavailable || statusRecovery ? "rounded-lg border border-border bg-muted/40 p-4" : "rounded-lg border border-positive-200/70 bg-positive-50/50 p-4 dark:border-positive-800 dark:bg-positive-950/20"}>
          <div role="status">
            <div className="flex items-center gap-2">
              {canDownload ? <CheckCircle2 className="size-5 text-positive-600" aria-hidden="true" /> : null}
              <p className="text-sm font-medium">
                {accessRecovery?.error ?? (artifact ? (expired ? c.expired : c.ready) : (pdf.isPolling ? t.common.loading : pollError ?? (statusRecovery && pdf.isPollExhausted ? c.paused : t.tradeDocuments.errors.pdfArtifactUnavailable)))}
              </p>
              {artifact ? <span className="ms-auto text-xs text-muted-foreground">{artifact.pageCount} {c.page}</span> : null}
            </div>
            {artifact && !accessError ? <p className="mt-2 text-xs text-muted-foreground">{expired ? c.expiredHint : c.expires}</p> : null}
          </div>
          {renewal && artifact && pollError ? <p role="alert" className="mt-2 text-sm text-destructive">{pollError}</p> : null}
          {viewer.downloadError ? <p role="alert" className="mt-2 text-sm text-destructive">{downloadError}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {artifact ? <QuotationPdfViewer viewer={viewer} download={canDownload ? {
              run: state.download, busy: downloadBusy, disabled: downloadDisabled, error: downloadError,
            } : undefined} renewal={renewal} accessRecovery={accessRecovery} /> : null}
            {canDownload ? (
              <Button variant="outline" size="sm" aria-busy={downloadBusy || undefined}
                aria-disabled={downloadDisabled || undefined} onClick={downloadDisabled ? undefined : state.download}>
                <Download className="size-4" aria-hidden="true" />{c.download}
              </Button>
            ) : (
              <Button ref={acceptedRecovery ? captureResumeFocus : undefined} variant="outline" size="sm"
                className="aria-disabled:cursor-not-allowed" aria-busy={pdf.isPolling || undefined}
                aria-disabled={refreshDisabled || undefined} onClick={refreshDisabled ? undefined : resumeStatus}>
                {pdf.isPolling ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
                {artifact && !accessError ? c.refreshLink : c.resume}
              </Button>
            )}
            {reopenHref ? (
              <Button variant="outline" size="sm" asChild>
                <a href={reopenHref} target="_blank" rel="noopener noreferrer">
                  <Link2 className="size-4" aria-hidden="true" />{c.openPdfWorkspace}
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {state.downloadedPdf ? (
        <DownloadedQuotationPdf pdf={state.downloadedPdf} download={state.download} readyLabel={c.ready} downloadLabel={c.download} />
      ) : null}
      <div className="flex justify-end border-t border-border pt-4"><Button ref={generateAction} variant="outline" loading={pdf.write.isWriting} disabled={state.locked} onClick={() => void state.render()}><FileText className="size-4" aria-hidden="true" />{failed || artifact || expired || state.downloadedPdf ? c.generateAgain : c.generate}</Button></div>
    </CardContent>
  </Card>;
}

function DownloadedQuotationPdf({ pdf, download, readyLabel, downloadLabel }: {
  pdf: Blob; download: () => void; readyLabel: string; downloadLabel: string;
}) {
  const [preview, setPreview] = useState<{ pdf: Blob; url: string } | null>(null);
  const current = preview?.pdf === pdf ? preview : null;
  useLayoutEffect(() => {
    if (current) return () => URL.revokeObjectURL(current.url);
  }, [current]);
  const openPreview = () => setPreview(current ?? { pdf, url: URL.createObjectURL(pdf) });
  return (
    <div className="rounded-lg border border-positive-200/70 bg-positive-50/50 p-4 dark:border-positive-800/60">
      <p role="status" className="text-sm font-medium">{readyLabel}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <QuotationPdfViewer viewer={{
          open: !!current,
          setOpen: (open) => { if (open) openPreview(); else setPreview(null); },
          url: current?.url ?? null,
          error: false,
          loading: false,
          retry: openPreview,
        }} />
        <Button variant="outline" size="sm" onClick={download}>
          <Download className="size-4" aria-hidden="true" />{downloadLabel}
        </Button>
      </div>
    </div>
  );
}
