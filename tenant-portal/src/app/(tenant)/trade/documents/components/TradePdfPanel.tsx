"use client";

import { AsyncJobState, Button, Card, CardContent, CardHeader, CardTitle } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeDocumentMessage } from "../trade-document-errors";
import type { TradePdfJobState } from "../hooks/useTradePdfJob";
import { TradeWriteOutcome } from "./TradeBoundaryStates";

export interface TradePdfPanelProps {
  state: TradePdfJobState;
  /** Disabled when the document has no printable source yet. */
  canRender: boolean;
  onRender: () => void;
  /** Why rendering is unavailable, when it is. Already translated. */
  unavailableReason?: string;
}

/**
 * The 202 render job, its poll, and its download.
 *
 * The in-flight affordance is `AsyncJobState`'s pending dot, not a progress
 * bar: the server reports no percentage anywhere in the job record, and a bar
 * that fills on a timer is fabricated success.
 */
export function TradePdfPanel({ state, canRender, onRender, unavailableReason }: TradePdfPanelProps) {
  const { t } = useI18n();
  const { job, uiStatus, isPolling, pollError, isPollExhausted, write } = state;
  const canReadStatus = state.canReadStatus ?? !write.isBlocked;

  const artifact = job?.artifact ?? null;
  const assignmentHelp = canRender ? state.defaultAssignmentHelp : null;
  const detail =
    tradeDocumentMessage(job?.failure?.code, t.tradeDocuments.errors) ??
    tradeDocumentMessage(pollError?.code, t.tradeDocuments.errors) ??
    (isPollExhausted ? t.tradeDocuments.pdf.stillRunning : undefined);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <CardTitle>{t.tradeDocuments.pdf.title}</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={onRender}
          disabled={!canRender || write.isBlocked || isPolling}
          loading={write.isWriting}
        >
          {t.tradeDocuments.pdf.render}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <TradeWriteOutcome write={write}
          retryBlockedReason={state.readOnlySettlement ? t.tradeDocuments.pdf.readOnlySettlement : undefined} />
        {write.writeError ? (
          <p role="alert" className="text-sm text-destructive">
            {assignmentHelp
              ? t.quotationPdf.noEligibleDefaultTemplate
              : tradeDocumentMessage(write.writeError.code, t.tradeDocuments.errors) ?? t.quotationPdf.requestError}
          </p>
        ) : null}
        {assignmentHelp === "configure" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={TENANT_ROUTES.coreTemplateAssignments}>{t.coreOperations.templates.assignmentsTitle}</a>
            </Button>
            <p className="text-sm text-muted-foreground">{t.quotationPdf.businessDefaultTemplateSetup}</p>
          </div>
        ) : assignmentHelp === "ask-admin" ? (
          <p className="text-sm text-muted-foreground">{t.quotationPdf.defaultTemplateAdminHelp}</p>
        ) : null}
        {!canRender && unavailableReason ? (
          <p className="text-xs text-muted-foreground">{unavailableReason}</p>
        ) : null}

        {uiStatus ? (
          <AsyncJobState
            status={uiStatus}
            operation={t.tradeDocuments.pdf.operation}
            detail={detail}
            busy={isPolling}
            onDownload={
              artifact
                ? () => window.open(artifact.downloadUrl, "_blank", "noopener,noreferrer")
                : undefined
            }
            onRetry={state.readOnlySettlement ? undefined : uiStatus === "ARTIFACT_EXPIRED" ? () => void state.refresh() : onRender}
            labels={{
              queued: t.tradeDocuments.pdf.queued,
              running: t.tradeDocuments.pdf.running,
              succeeded: t.tradeDocuments.pdf.succeeded,
              failed: t.tradeDocuments.pdf.failed,
              artifactExpired: t.tradeDocuments.pdf.artifactExpired,
              download: t.tradeDocuments.pdf.download,
              retry: t.common.retry,
              cancel: t.common.cancel,
            }}
          />
        ) : (
          <p className="text-xs text-muted-foreground">{t.tradeDocuments.pdf.idle}</p>
        )}

        {isPollExhausted || pollError || uiStatus === "ARTIFACT_EXPIRED" || (write.ambiguous && state.canReadStatus) ? (
          <Button type="button" variant="outline" size="sm" disabled={!canReadStatus || isPolling} onClick={() => void state.refresh()}>
            {state.readOnlySettlement ? t.tradeDocuments.pdf.refreshStatus
              : uiStatus === "ARTIFACT_EXPIRED" ? t.quotationPdf.refreshLink : t.quotationPdf.resume}
          </Button>
        ) : null}

        {/* The signed URL lives for 300 seconds and the page cannot renew it
            without a fresh poll, so the expiry is stated rather than left for
            the user to discover by clicking a dead link. */}
        {artifact ? (
          <p className="text-xs text-muted-foreground">{t.tradeDocuments.pdf.downloadExpiry}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
