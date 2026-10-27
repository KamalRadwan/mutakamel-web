"use client";

import * as React from "react";
import { use } from "react";
import {
  ArrowRightLeft,
  Building2,
  CreditCard,
  FileCheck2,
} from "lucide-react";
import {
  Button,
  DetailHeader,
  DetailSection,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ErrorState,
  IdentifierText,
  Money,
  NotFoundState,
  PermissionGate,
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
import { ConvertQuotationDrawer } from "../components/ConvertQuotationDrawer";
import { QuotationLinesPanel } from "../components/QuotationLinesPanel";
import { QuotationRevisionDrawer } from "../components/QuotationRevisionDrawer";
import { QuotationRevisionsPanel } from "../components/QuotationRevisionsPanel";
import { useTradeDraftReference } from "../../documents/hooks/useTradeDraftReference";
import { useQuotationScreen } from "../hooks/useQuotationScreen";
import { QUOTATIONS_PATH, QUOTATION_PERMISSIONS } from "../quotation-contract";
import { SALES_ORDER_PERMISSIONS } from "../../sales-orders/sales-order-contract";

export default function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useI18n();
  const td = t.tradeDocuments;
  const screen = useQuotationScreen(id);
  const { detail, actions, revision, pdf } = screen;
  const quotation = detail.document;
  const [convertOpen, setConvertOpen] = React.useState(false);

  const editReference = useTradeDraftReference(
    QUOTATIONS_PATH,
    id,
    quotation?.version ?? null,
    quotation?.draftReference ?? null,
    td.quotations.editTitle,
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

  if (detail.loadError?.status === 403) {
    return <PermissionGate require={QUOTATION_PERMISSIONS.read} denied>{null}</PermissionGate>;
  }

  if (detail.isMissing) {
    return (
      <TradeGate require={QUOTATION_PERMISSIONS.read}>
        <NotFoundState
          title={td.quotations.notFoundTitle}
          description={td.quotations.notFoundDescription}
          backLabel={td.quotations.back}
          backHref={TENANT_ROUTES.tradeQuotations}
        />
      </TradeGate>
    );
  }

  const canConvert =
    quotation?.lifecycleStatus === "ACCEPTED" &&
    detail.scope.canWrite(QUOTATION_PERMISSIONS.convert) &&
    detail.scope.canWrite(SALES_ORDER_PERMISSIONS.create);

  const stageSteps = [
    {
      status: "DRAFT",
      label: t.statusValues["TradeQuotationStatus.DRAFT"] ?? "DRAFT",
    },
    {
      status: "SENT",
      label: t.statusValues["TradeQuotationStatus.SENT"] ?? "SENT",
    },
    {
      status: "ACCEPTED",
      label: t.statusValues["TradeQuotationStatus.ACCEPTED"] ?? "ACCEPTED",
    },
    {
      status: "CONVERTED",
      label: t.statusValues["TradeQuotationStatus.CONVERTED"] ?? "CONVERTED",
    },
  ];

  return (
    <TradeGate require={QUOTATION_PERMISSIONS.read}>
      <div className="flex flex-col gap-4">
        {detail.isLoading || !quotation ? (
          detail.loadError ? (
            <ErrorState
              title={td.quotations.loadFailed}
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
              title={
                quotation.documentNumber ??
                quotation.draftReference ??
                quotation.id
              }
              subtitle={partyDisplayName(quotation.partySnapshot) ?? undefined}
              status={
                <TradeStatusBadge
                  kind="TradeQuotationStatus"
                  value={quotation.lifecycleStatus}
                />
              }
              backLabel={td.quotations.back}
              backHref={TENANT_ROUTES.tradeQuotations}
              primaryAction={
                screen.advance
                  ? {
                      label:
                        screen.advance === "send"
                          ? td.quotations.send
                          : td.quotations.accept,
                      onClick: () => void actions.run(screen.advance ?? "send"),
                      disabled: actions.pending !== null,
                    }
                  : canConvert
                    ? {
                        label: td.executive.convertQuotation,
                        onClick: () => setConvertOpen(true),
                      }
                    : undefined
              }
              secondaryActions={
                <>
                  {screen.canRevise ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={editReference.open}
                    >
                      {td.quotations.editTitle}
                    </Button>
                  ) : null}
                  {screen.canRevise ? (
                    <Button size="sm" variant="outline" onClick={revision.open}>
                      {td.quotations.newRevision}
                    </Button>
                  ) : null}
                  {canConvert ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConvertOpen(true)}
                    >
                      <ArrowRightLeft className="me-1.5 h-3.5 w-3.5" aria-hidden />
                      {td.executive.convertQuotation}
                    </Button>
                  ) : null}
                  {screen.canReject || screen.canCancel ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost">
                          {t.common.actions}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {screen.canReject ? (
                          <DropdownMenuItem
                            onSelect={() => actions.requestReason("reject")}
                          >
                            {td.quotations.reject}
                          </DropdownMenuItem>
                        ) : null}
                        {screen.canCancel ? (
                          <DropdownMenuItem
                            onSelect={() => actions.requestReason("cancel")}
                          >
                            {td.quotations.cancel}
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </>
              }
            />

            <div className="dossier-stage-bar">
              <span className="dossier-stage-label">
                {td.executive.lifecycleTrack}
              </span>
              <div className="dossier-stage-track">
                {stageSteps.map((step, idx) => {
                  const activeIdx = stageSteps.findIndex(
                    (s) => s.status === quotation.lifecycleStatus,
                  );
                  const stateClass =
                    step.status === quotation.lifecycleStatus
                      ? "active"
                      : activeIdx > idx
                        ? "done"
                        : "";
                  return (
                    <div
                      key={step.status}
                      className={`dossier-stage-cell ${stateClass}`}
                    >
                      <span className="dossier-stage-dot" aria-hidden />
                      <span>{step.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <TradeWriteOutcome write={actions.write} />
            <TradeWriteOutcome write={revision.write} />
            <TradeWriteOutcome write={pdf.write} />
            <TradeWriteOutcome write={editReference.write} />

            <div className="dossier-grid">
              <div className="dossier-col">
                <div className="dossier-card dossier-card-indigo">
                  <div className="dossier-card-header">
                    <div className="dossier-card-title">
                      <span
                        className="dossier-icon-pill dossier-ip-indigo"
                        aria-hidden
                      >
                        <Building2 className="h-4 w-4" />
                      </span>
                      <span>{td.executive.dossierOverview}</span>
                    </div>
                    <span className="dossier-tag dossier-tag-indigo">
                      <IdentifierText>{`v${quotation.version}`}</IdentifierText>
                    </span>
                  </div>
                  <div className="dossier-fields-grid">
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">{td.documentNumber}</span>
                      <span className="dossier-val">
                        <IdentifierText>
                          {quotation.documentNumber ?? td.notRecorded}
                        </IdentifierText>
                      </span>
                    </div>
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">{td.draftReference}</span>
                      <span className="dossier-val">
                        <IdentifierText>
                          {quotation.draftReference ?? td.notRecorded}
                        </IdentifierText>
                      </span>
                    </div>
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">{td.customer}</span>
                      <span className="dossier-val">
                        {partyDisplayName(quotation.partySnapshot) ??
                          td.notRecorded}
                      </span>
                    </div>
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">{td.businessDate}</span>
                      <span className="dossier-val">
                        <IdentifierText>{quotation.businessDate}</IdentifierText>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="dossier-col">
                <div className="dossier-card dossier-card-emerald">
                  <div className="dossier-card-header">
                    <div className="dossier-card-title">
                      <span
                        className="dossier-icon-pill dossier-ip-emerald"
                        aria-hidden
                      >
                        <CreditCard className="h-4 w-4" />
                      </span>
                      <span>{td.executive.financialSummary}</span>
                    </div>
                    <span className="dossier-tag dossier-tag-emerald">
                      <IdentifierText>{quotation.currencyCode}</IdentifierText>
                    </span>
                  </div>
                  <div className="dossier-fields-grid">
                    <div className="dossier-field-box dossier-span-all">
                      <span className="dossier-lbl">{td.grandTotal}</span>
                      <span className="dossier-val text-base">
                        <Money
                          value={quotation.grandTotal}
                          currency={quotation.currencyCode}
                          minimumFractionDigits={2}
                          maximumFractionDigits={8}
                        />
                      </span>
                    </div>
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">{td.quotations.revisions}</span>
                      <span className="dossier-val">
                        <IdentifierText>
                          {String(quotation.revisions.length)}
                        </IdentifierText>
                      </span>
                    </div>
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">
                        {td.executive.linesCount}
                      </span>
                      <span className="dossier-val">
                        <IdentifierText>
                          {String(quotation.currentLines.length)}
                        </IdentifierText>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DetailSection
              title={td.identity}
              emptyValueLabel={td.notRecorded}
              fields={[
                { label: td.documentNumber, value: quotation.documentNumber },
                { label: td.draftReference, value: quotation.draftReference },
                { label: td.currency, value: quotation.currencyCode },
                { label: td.businessDate, value: quotation.businessDate },
                {
                  label: td.version,
                  value: String(quotation.version),
                },
              ]}
            />

            <QuotationRevisionsPanel quotation={quotation} />
            <QuotationLinesPanel quotation={quotation} />

            {screen.isAwaitingConversion && !canConvert ? (
              <TradeEvidenceBlocked
                title={td.quotations.convertBlockedTitle}
                description={td.quotations.convertBlockedDescription}
              />
            ) : null}

            {screen.currentRevision &&
            Object.keys(screen.currentRevision.termsSnapshot).length > 0 ? (
              <div className="dossier-card dossier-card-violet">
                <div className="dossier-card-header">
                  <div className="dossier-card-title">
                    <span
                      className="dossier-icon-pill dossier-ip-violet"
                      aria-hidden
                    >
                      <FileCheck2 className="h-4 w-4" />
                    </span>
                    <span>{td.executive.structuredTermsTitle}</span>
                  </div>
                </div>
                <div className="rounded-md bg-muted/40 p-3 text-xs">
                  <IdentifierText>
                    {JSON.stringify(screen.currentRevision.termsSnapshot)}
                  </IdentifierText>
                </div>
              </div>
            ) : null}

            <TradePdfPanel
              state={pdf}
              canRender={screen.currentRevision !== null}
              onRender={screen.renderPdf}
              unavailableReason={td.quotations.noLines}
            />

            <QuotationRevisionDrawer
              state={revision}
              currencyCode={quotation.currencyCode}
            />

            <ConvertQuotationDrawer
              open={convertOpen}
              onOpenChange={setConvertOpen}
              quotation={quotation}
              headers={detail.scope.headers}
              onConverted={async () => {
                await detail.reload();
              }}
            />

            <TradeDraftReferenceDrawer
              state={editReference}
              title={td.quotations.editTitle}
              description={td.quotations.editDescription}
            />

            <ReasonDialog
              open={actions.openReason !== null}
              onOpenChange={(open) => (open ? undefined : actions.closeReason())}
              title={
                actions.openReason === "reject"
                  ? td.quotations.rejectTitle
                  : td.quotations.cancelTitle
              }
              reasonRequired
              destructive
              maxLength={TRADE_REASON_CODE_MAX_LENGTH}
              loading={actions.pending !== null}
              onConfirm={(reason) =>
                void actions.run(actions.openReason ?? "cancel", reason.trim())
              }
              labels={{
                reason: td.reasonCode,
                reasonHint: td.reasonCodeHint,
                confirm:
                  actions.openReason === "reject"
                    ? td.quotations.reject
                    : td.quotations.cancel,
                cancel: t.common.cancel,
              }}
            />
          </>
        )}
      </div>
    </TradeGate>
  );
}
