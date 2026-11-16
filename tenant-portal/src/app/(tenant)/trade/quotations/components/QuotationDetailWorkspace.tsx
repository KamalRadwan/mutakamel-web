"use client";

import { useCallback, useRef } from "react";
import { ArrowRightLeft, Ban, CheckCircle2, FileText, MoreHorizontal, RotateCcw, Send, ShieldAlert, Trash2 } from "lucide-react";
import {
  Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuGroup,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  IdentifierText, PageHeader, type PageHeaderProps, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
  cn, hitArea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useTradeInlineScopeClaim } from "../../TradeInlineScope";
import type { TradeDocumentScope } from "../../documents/hooks/useTradeDocumentScope";
import { TradeStatusBadge } from "../../documents/components/TradeStatusBadge";
import { TradeEvidenceBlocked } from "../../documents/components/TradeBoundaryStates";
import { useQuotationDetailWorkspace } from "../hooks/useQuotationDetailWorkspace";
import type { QuotationDetail } from "../quotation-contract";
import { ConvertQuotationModal } from "./ConvertQuotationModal";
import { QuotationComposerBody } from "./QuotationComposerBody";
import { QuotationBackAction } from "./QuotationBackAction";
import { QuotationDeleteGuardModal } from "./QuotationDeleteGuardModal";
import { QuotationIssueConfirmation } from "./QuotationIssueConfirmation";
import { QuotationDetailSections } from "./QuotationDetailSections";
import { QuotationReasonModal } from "./QuotationReasonModal";
import { QuotationShareButtons } from "./QuotationShareButtons";

export function QuotationDetailWorkspace({
  initialQuotation,
  scope,
  onReload,
  reopenPdfJobId,
}: {
  initialQuotation: QuotationDetail;
  scope: TradeDocumentScope;
  onReload: () => Promise<unknown>;
  reopenPdfJobId?: string;
}) {
  const { t, dir } = useI18n();
  const qCopy = t.tradeDocuments.quotations;
  const copy = t.quotationExperience;
  const focusTargetRef = useRef<HTMLDivElement | null>(null);
  const focusWorkspace = useCallback(() => {
    requestAnimationFrame(() => {
      focusTargetRef.current?.focus();
    });
  }, []);

  const ws = useQuotationDetailWorkspace({
    initialQuotation,
    scope,
    onReload,
    onFocusWorkspace: focusWorkspace,
  });
  const { quotation, composer } = ws;
  const pdfTrigger = useRef<HTMLButtonElement>(null);
  const openPdf = () => {
    const trigger = pdfTrigger.current;
    if (!trigger) return;
    if (trigger.getAttribute("aria-expanded") === "false") trigger.click();
    trigger.focus({ preventScroll: true });
    trigger.scrollIntoView?.({ block: "nearest" });
  };

  const needsServerReload = composer.partialHeaderConflict || !composer.isDetailsCurrent || Boolean(composer.detailsError);
  const reloadDisabled = composer.isReloadingDetails || ws.write.isWriting || Boolean(ws.write.ambiguous);
  const isAuthoring = ws.viewMode !== "readonly";
  const resetDisabled = ws.write.isBlocked || composer.savingStep !== "idle";
  const canOfferSend = ws.viewMode === "edit" && Boolean(quotation.currentRevisionId) && ws.canSend;
  const canOfferAccept = isAuthoring && ws.advanceAction === "accept";
  const acceptDisabled = ws.write.isBlocked || composer.isDirty || ws.actions.pending !== null;
  const sendDisabled = composer.isDirty || !composer.canSendSaved || ws.actions.pending !== null;
  const documentBadgeText = `${quotation.documentNumber ?? qCopy.unnumberedDraft} · v${quotation.version}`;
  useTradeInlineScopeClaim(scope.isResolved);

  let primaryAction: PageHeaderProps["primaryAction"];
  if (isAuthoring) {
    primaryAction = needsServerReload
      ? { label: copy.reloadDetails, onClick: () => void composer.reloadSavedDetails(), disabled: reloadDisabled }
      : { label: t.common.save, onClick: ws.requestSave, disabled: !composer.canSubmit };
  } else if (ws.advanceAction === "send") {
    primaryAction = { label: qCopy.send, onClick: () => ws.setIssueOpen(true),
      icon: <Send className="size-3.5" aria-hidden="true" />, disabled: ws.actions.pending !== null || ws.write.isBlocked };
  } else if (ws.advanceAction === "accept") {
    primaryAction = { label: qCopy.accept, onClick: () => void ws.actions.run("accept"),
      icon: <CheckCircle2 className="size-3.5" aria-hidden="true" />, disabled: ws.actions.pending !== null || ws.write.isBlocked };
  } else if (ws.canConvert) {
    primaryAction = { label: t.tradeDocuments.executive.convertQuotation, onClick: () => ws.setConvertOpen(true),
      icon: <ArrowRightLeft className="size-3.5" aria-hidden="true" />, disabled: ws.write.isBlocked };
  }
  const banner = !isAuthoring ? undefined : needsServerReload ? (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/40 bg-warning-subtle px-3 py-2 text-xs text-warning-subtle-foreground">
      <div className="min-w-0 flex-1">
        <span className="font-semibold">
          {composer.partialHeaderConflict ? t.quotationFlow.partialConflictTitle : copy.detailUnavailableTitle}
          {": "}
        </span>
        <span>
          {composer.partialHeaderConflict ? t.quotationFlow.partialConflictDescription : copy.detailUnavailableDescription}
        </span>
      </div>
      <Button
        type="button"
        size="xs"
        variant="outline"
        loading={composer.isReloadingDetails}
        disabled={reloadDisabled}
        onClick={() => void composer.reloadSavedDetails()}
      >
        {copy.reloadDetails}
      </Button>
    </div>
  ) : composer.canPrepareReplacement ? (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/40 bg-warning-subtle px-3 py-2 text-xs text-warning-subtle-foreground">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{copy.revisionPricingPolicyRefused}</p>
        <p>{copy.replacementOffer}</p>
        {composer.replacementHandoffFailed ? <p className="mt-1 text-destructive">{t.quotationFlow.handoffFailed}</p> : null}
      </div>
      <Button type="button" size="xs" variant="outline" onClick={composer.prepareReplacement}>
        {copy.prepareReplacement}
      </Button>
    </div>
  ) : undefined;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-w-0 flex-col gap-2" data-testid="quotation-workspace">
        <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{ws.statusAnnouncement}</p>

        <div ref={focusTargetRef} tabIndex={-1} className="sr-only">
              {quotation.documentNumber ?? qCopy.unnumberedDraft}
        </div>
        <QuotationBackAction />
        <PageHeader
              className="sr-only"
              title={quotation.documentNumber ?? qCopy.unnumberedDraft}
              description={ws.customerName ?? copy.workspaceDescription}
              primaryAction={primaryAction}
              secondaryActions={
                <div className="flex shrink-0 items-center gap-1.5" data-testid="quotation-detail-actions">
                  <TradeStatusBadge
                    kind="TradeQuotationStatus"
                    value={quotation.lifecycleStatus}
                    className="hidden md:inline-flex"
                  />
                  <Badge tone="brand" size="sm" className="hidden md:inline-flex">
                    <IdentifierText>{documentBadgeText}</IdentifierText>
                  </Badge>
                  {isAuthoring && composer.isDirty ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="hidden md:inline-flex"
                      disabled={resetDisabled}
                      onClick={ws.requestResetDraft}
                    >
                      <RotateCcw className="size-3.5" aria-hidden="true" />
                      <span>{t.common.cancel}</span>
                    </Button>
                  ) : null}
                  {canOfferSend ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="hidden md:inline-flex"
                      disabled={sendDisabled}
                      onClick={() => ws.setIssueOpen(true)}
                    >
                      <Send className="size-3.5" aria-hidden="true" />
                      <span>{qCopy.send}</span>
                    </Button>
                  ) : null}
                  {canOfferAccept ? (
                    <Button type="button" size="sm" variant="outline" disabled={acceptDisabled}
                      className="hidden md:inline-flex" onClick={() => void ws.actions.run("accept")}>
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />{qCopy.accept}
                    </Button>
                  ) : null}

                  <Button type="button" variant="outline" size="sm" className="hidden gap-1.5 md:inline-flex"
                    onClick={openPdf}>
                    <FileText className="size-3.5" aria-hidden="true" />{t.quotationPdf.title}
                  </Button>
                  <QuotationShareButtons quotation={quotation} className="hidden lg:inline-flex" />
                  <DropdownMenu dir={dir}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            aria-label={t.common.actions}
                            className={cn("size-8 shrink-0 px-0", hitArea)}
                          >
                            <MoreHorizontal className="size-4" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>{t.common.actions}</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel className="flex flex-wrap items-center gap-1.5 md:hidden">
                        <TradeStatusBadge kind="TradeQuotationStatus" value={quotation.lifecycleStatus} />
                        <Badge tone="brand" size="sm">
                          <IdentifierText>{documentBadgeText}</IdentifierText>
                        </Badge>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="md:hidden" />
                      {canOfferSend ? (
                        <DropdownMenuItem
                          className="md:hidden"
                          disabled={sendDisabled}
                          onSelect={() => ws.setIssueOpen(true)}
                        >
                          <Send className="me-2 size-3.5" aria-hidden="true" />
                          <span>{qCopy.send}</span>
                        </DropdownMenuItem>
                      ) : null}
                      {canOfferAccept ? (
                        <DropdownMenuItem className="md:hidden" disabled={acceptDisabled}
                          onSelect={() => void ws.actions.run("accept")}>
                          <CheckCircle2 className="me-2 size-3.5" aria-hidden="true" />{qCopy.accept}
                        </DropdownMenuItem>
                      ) : null}
                      {isAuthoring && composer.isDirty ? (
                        <DropdownMenuItem
                          className="md:hidden"
                          disabled={resetDisabled}
                          onSelect={ws.requestResetDraft}
                        >
                          <RotateCcw className="me-2 size-3.5" aria-hidden="true" />
                          <span>{t.common.cancel}</span>
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuSeparator className="md:hidden" />
                      <DropdownMenuGroup className="lg:hidden">
                        <QuotationShareButtons quotation={quotation} presentation="menu" />
                        <DropdownMenuSeparator />
                      </DropdownMenuGroup>
                      <DropdownMenuItem className="md:hidden" onSelect={openPdf}>
                        <FileText className="me-2 size-3.5" aria-hidden="true" />
                        <span>{t.quotationPdf.title}</span>
                      </DropdownMenuItem>

                      {ws.canRejectQuote ? (
                        <DropdownMenuItem onSelect={() => ws.actions.requestReason("reject")}>
                          <ShieldAlert className="me-2 size-3.5" aria-hidden="true" />
                          <span>{qCopy.reject}</span>
                        </DropdownMenuItem>
                      ) : null}
                      {ws.canCancelQuote ? (
                        <DropdownMenuItem onSelect={() => ws.actions.requestReason("cancel")}>
                          <Ban className="me-2 size-3.5" aria-hidden="true" />
                          <span>{qCopy.cancel}</span>
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={ws.handleRequestDelete} className="text-destructive focus:text-destructive">
                        <Trash2 className="me-2 size-3.5" aria-hidden="true" />
                        <span>{qCopy.deleteAction}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              }
        />

        <div data-testid={isAuthoring ? undefined : "quotation-readonly-body"}>
          <QuotationComposerBody
                composer={composer}
                headers={ws.scopedHeaders}
                canUpdate={ws.canUpdate}
                isResolved={scope.isResolved}
                workspaceMode={ws.viewMode}
                contextLocked
                identityLocked
                headerFieldsLocked={!isAuthoring || composer.headerFieldsLocked}
                contextLabels={ws.contextLabels}
                customerLabel={ws.customerName}
                showContact={composer.hasOrganizationCustomer || Boolean(quotation.contactPartyId)}
                lineDisplayById={composer.lineDisplayById}
                headerBanner={banner}
          />
        </div>

        {ws.isAwaitingConversion && !ws.canConvert ? (
          <TradeEvidenceBlocked title={qCopy.convertBlockedTitle} description={qCopy.convertBlockedDescription} />
        ) : null}
        <QuotationDetailSections state={ws} pdfTrigger={pdfTrigger} reopenPdfJobId={reopenPdfJobId} />

        <Dialog open={ws.discardOpen} onOpenChange={ws.setDiscardOpen}>
          <DialogContent dir={dir}>
            <DialogHeader>
              <DialogTitle>{t.quotationFlow.leaveTitle}</DialogTitle>
              <DialogDescription>{t.quotationFlow.leaveDescription}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => ws.setDiscardOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button type="button" variant="destructive" disabled={ws.write.isBlocked} onClick={ws.confirmDiscard}>
                {t.quotationFlow.discardAndLeave}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <QuotationIssueConfirmation
          open={ws.issueOpen}
          onOpenChange={ws.setIssueOpen}
          onConfirm={() => void ws.confirmIssue()}
          loading={composer.savingStep === "sending" || ws.actions.pending === "send"}
        />

        {ws.canConvert ? (
          <ConvertQuotationModal
            open={ws.convertOpen}
            onOpenChange={ws.setConvertOpen}
            quotation={quotation}
            headers={ws.scopedHeaders}
            onConverted={async () => { await ws.onReload(); }}
          />
        ) : null}

        <QuotationReasonModal
          open={ws.actions.openReason === "reject" || ws.actions.openReason === "cancel"}
          action={ws.actions.openReason === "reject" || ws.actions.openReason === "cancel" ? ws.actions.openReason : null}
          quotation={quotation}
          write={ws.write}
          pending={ws.actions.pending !== null}
          onClose={ws.actions.closeReason}
          onConfirm={async (act, payload) => { await ws.actions.run(act, payload); }}
        />

        <QuotationDeleteGuardModal open={ws.deleteBlockedOpen} onOpenChange={ws.setDeleteBlockedOpen} quotation={quotation} />
      </div>
    </TooltipProvider>
  );
}
