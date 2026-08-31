"use client";

import { use } from "react";
import {
  Button,
  DetailHeader,
  DetailSection,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ErrorState,
  NotFoundState,
  ReasonDialog,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import {
  TradeEvidenceBlocked,
  TradeScopeRequired,
  TradeWriteOutcome,
} from "../../documents/components/TradeBoundaryStates";
import { TradeDocumentSkeleton } from "../../documents/components/TradeDocumentSkeleton";
import { TradeDraftReferenceDrawer } from "../../documents/components/TradeDraftReferenceDrawer";
import { TradeGate } from "../../documents/components/TradeGate";
import { TradePdfPanel } from "../../documents/components/TradePdfPanel";
import { TradeStatusBadge } from "../../documents/components/TradeStatusBadge";
import {
  TRADE_REASON_CODE_MAX_LENGTH,
  partyDisplayName,
} from "../../documents/trade-document-contract";
import { QuotationLinesPanel } from "../components/QuotationLinesPanel";
import { QuotationRevisionDrawer } from "../components/QuotationRevisionDrawer";
import { QuotationRevisionsPanel } from "../components/QuotationRevisionsPanel";
import { useTradeDraftReference } from "../../documents/hooks/useTradeDraftReference";
import { useQuotationScreen } from "../hooks/useQuotationScreen";
import { QUOTATIONS_PATH, QUOTATION_PERMISSIONS } from "../quotation-contract";

export default function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const screen = useQuotationScreen(id);
  const { detail, actions, revision, pdf } = screen;
  const quotation = detail.document;
  const editReference = useTradeDraftReference(
    QUOTATIONS_PATH,
    id,
    quotation?.version ?? null,
    quotation?.draftReference ?? null,
    t.tradeDocuments.quotations.editTitle,
    detail.scope.headers,
    async () => {
      await detail.reload();
    },
  );

  if (!detail.scope.isResolved) {
    return (
      <TradeGate require={QUOTATION_PERMISSIONS.read}>
        <TradeScopeRequired />
      </TradeGate>
    );
  }

  if (detail.isMissing) {
    return (
      <TradeGate require={QUOTATION_PERMISSIONS.read}>
        <NotFoundState
          title={t.tradeDocuments.quotations.notFoundTitle}
          description={t.tradeDocuments.quotations.notFoundDescription}
          backLabel={t.tradeDocuments.quotations.back}
          backHref={TENANT_ROUTES.tradeQuotations}
        />
      </TradeGate>
    );
  }

  return (
    <TradeGate require={QUOTATION_PERMISSIONS.read}>
      <div className="flex flex-col gap-4">
        {detail.isLoading || !quotation ? (
          detail.loadError ? (
            <ErrorState
              title={t.tradeDocuments.quotations.loadFailed}
              description={detail.loadError.code ?? undefined}
              onRetry={() => void detail.reload()}
              retryLabel={t.common.retry}
            />
          ) : (
            <TradeDocumentSkeleton />
          )
        ) : (
          <>
            <DetailHeader
              title={quotation.documentNumber ?? quotation.draftReference ?? quotation.id}
              subtitle={partyDisplayName(quotation.partySnapshot) ?? undefined}
              status={
                <TradeStatusBadge
                  kind="TradeQuotationStatus"
                  value={quotation.lifecycleStatus}
                />
              }
              backLabel={t.tradeDocuments.quotations.back}
              backHref={TENANT_ROUTES.tradeQuotations}
              primaryAction={
                screen.advance
                  ? {
                      label:
                        screen.advance === "send"
                          ? t.tradeDocuments.quotations.send
                          : t.tradeDocuments.quotations.accept,
                      onClick: () => void actions.run(screen.advance ?? "send"),
                      disabled: actions.pending !== null,
                    }
                  : undefined
              }
              secondaryActions={
                <>
                  {screen.canRevise ? (
                    <Button variant="outline" onClick={editReference.open}>
                      {t.tradeDocuments.quotations.editTitle}
                    </Button>
                  ) : null}
                  {screen.canRevise ? (
                    <Button variant="outline" onClick={revision.open}>
                      {t.tradeDocuments.quotations.newRevision}
                    </Button>
                  ) : null}
                  {screen.canReject || screen.canCancel ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost">{t.common.actions}</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {screen.canReject ? (
                          <DropdownMenuItem onSelect={() => actions.requestReason("reject")}>
                            {t.tradeDocuments.quotations.reject}
                          </DropdownMenuItem>
                        ) : null}
                        {screen.canCancel ? (
                          <DropdownMenuItem onSelect={() => actions.requestReason("cancel")}>
                            {t.tradeDocuments.quotations.cancel}
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </>
              }
            />

            {/* One panel per write path. Each renders nothing until its own
                write ends ambiguously, and a lifecycle transition, a new
                revision and a PDF render are three different operations with
                three different idempotency keys. */}
            <TradeWriteOutcome write={actions.write} />
            <TradeWriteOutcome write={revision.write} />
            <TradeWriteOutcome write={pdf.write} />
            <TradeWriteOutcome write={editReference.write} />

            <DetailSection
              title={t.tradeDocuments.identity}
              emptyValueLabel={t.tradeDocuments.notRecorded}
              fields={[
                { label: t.tradeDocuments.documentNumber, value: quotation.documentNumber },
                { label: t.tradeDocuments.draftReference, value: quotation.draftReference },
                { label: t.tradeDocuments.currency, value: quotation.currencyCode },
                { label: t.tradeDocuments.businessDate, value: quotation.businessDate },
                {
                  label: t.tradeDocuments.version,
                  value: String(quotation.version),
                },
              ]}
            />

            <QuotationRevisionsPanel quotation={quotation} />
            <QuotationLinesPanel quotation={quotation} />

            {screen.isAwaitingConversion ? (
              <TradeEvidenceBlocked
                title={t.tradeDocuments.quotations.convertBlockedTitle}
                description={t.tradeDocuments.quotations.convertBlockedDescription}
              />
            ) : null}

            <TradePdfPanel
              state={pdf}
              canRender={screen.currentRevision !== null}
              onRender={screen.renderPdf}
              unavailableReason={t.tradeDocuments.quotations.noLines}
            />

            <QuotationRevisionDrawer state={revision} currencyCode={quotation.currencyCode} />

            <TradeDraftReferenceDrawer
              state={editReference}
              title={t.tradeDocuments.quotations.editTitle}
              description={t.tradeDocuments.quotations.editDescription}
            />

            <ReasonDialog
              open={actions.openReason !== null}
              onOpenChange={(open) => (open ? undefined : actions.closeReason())}
              title={
                actions.openReason === "reject"
                  ? t.tradeDocuments.quotations.rejectTitle
                  : t.tradeDocuments.quotations.cancelTitle
              }
              reasonRequired
              destructive
              maxLength={TRADE_REASON_CODE_MAX_LENGTH}
              loading={actions.pending !== null}
              onConfirm={(reason) =>
                void actions.run(actions.openReason ?? "cancel", reason.trim())
              }
              labels={{
                reason: t.tradeDocuments.reasonCode,
                reasonHint: t.tradeDocuments.reasonCodeHint,
                // The confirm names the transition rather than saying
                // "confirm": a dialog that can reject or cancel must not use
                // one word for both.
                confirm:
                  actions.openReason === "reject"
                    ? t.tradeDocuments.quotations.reject
                    : t.tradeDocuments.quotations.cancel,
                cancel: t.common.cancel,
              }}
            />
          </>
        )}
      </div>
    </TradeGate>
  );
}
