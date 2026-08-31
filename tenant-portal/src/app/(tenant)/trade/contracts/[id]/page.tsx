"use client";

import { use, useCallback } from "react";
import {
  ConfirmActionModal,
  DetailHeader,
  DetailSection,
  ErrorState,
  NotFoundState,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import {
  TradeEvidenceBlocked,
  TradeScopeRequired,
  TradeWriteOutcome,
} from "../../documents/components/TradeBoundaryStates";
import { TradeDocumentSkeleton } from "../../documents/components/TradeDocumentSkeleton";
import { TradeDocumentTotals } from "../../documents/components/TradeDocumentTotals";
import { TradeGate } from "../../documents/components/TradeGate";
import { TradePdfPanel } from "../../documents/components/TradePdfPanel";
import { TradeStatusBadge } from "../../documents/components/TradeStatusBadge";
import { useTradeDocumentDetail } from "../../documents/hooks/useTradeDocumentDetail";
import { useTradeFinalizeAction } from "../../documents/hooks/useTradeFinalizeAction";
import { useTradePdfJob } from "../../documents/hooks/useTradePdfJob";
import { partyDisplayName, readTotalsSnapshot } from "../../documents/trade-document-contract";
import {
  CONTRACTS_PATH,
  CONTRACT_PERMISSIONS,
  contractFinancialMode,
  parseContractDetail,
  type ContractDetail,
} from "../contract-contract";

export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const detail = useTradeDocumentDetail<ContractDetail>(CONTRACTS_PATH, id, parseContractDetail);
  const contract = detail.document;
  const { headers, canWrite } = detail.scope;
  const pdf = useTradePdfJob(CONTRACTS_PATH, id, headers);

  const reload = useCallback(async () => {
    await detail.reload();
  }, [detail]);

  const activate = useTradeFinalizeAction(
    CONTRACTS_PATH,
    id,
    contract?.version ?? null,
    "activate",
    t.tradeDocuments.contracts.activate,
    headers,
    reload,
  );

  if (!detail.scope.isResolved) {
    return (
      <TradeGate require={CONTRACT_PERMISSIONS.read}>
        <TradeScopeRequired />
      </TradeGate>
    );
  }

  if (detail.isMissing) {
    return (
      <TradeGate require={CONTRACT_PERMISSIONS.read}>
        <NotFoundState
          title={t.tradeDocuments.contracts.notFoundTitle}
          description={t.tradeDocuments.contracts.notFoundDescription}
          backLabel={t.tradeDocuments.contracts.back}
          backHref={TENANT_ROUTES.tradeContracts}
        />
      </TradeGate>
    );
  }

  const isDraft = contract?.lifecycleStatus === "DRAFT";

  return (
    <TradeGate require={CONTRACT_PERMISSIONS.read}>
      <div className="flex flex-col gap-4">
        {detail.isLoading || !contract ? (
          detail.loadError ? (
            <ErrorState
              title={t.tradeDocuments.contracts.loadFailed}
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
              title={contract.documentNumber}
              subtitle={partyDisplayName(contract.partySnapshot) ?? contract.partyId}
              status={
                <TradeStatusBadge kind="TradeContractStatus" value={contract.lifecycleStatus} />
              }
              backLabel={t.tradeDocuments.contracts.back}
              backHref={TENANT_ROUTES.tradeContracts}
              primaryAction={
                isDraft && canWrite(CONTRACT_PERMISSIONS.activate)
                  ? {
                      label: t.tradeDocuments.contracts.activate,
                      onClick: activate.request,
                      disabled: activate.write.isWriting,
                    }
                  : undefined
              }
            />

            <TradeWriteOutcome write={activate.write} />
            <TradeWriteOutcome write={pdf.write} />

            {isDraft ? (
              <TradeEvidenceBlocked
                title={t.tradeDocuments.contracts.createBlockedTitle}
                description={t.tradeDocuments.contracts.createBlockedDescription}
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                {contract.lifecycleStatus === "SIGNED"
                  ? t.tradeDocuments.contracts.signedNote
                  : t.tradeDocuments.contracts.activeNote}
              </p>
            )}

            <DetailSection
              title={t.tradeDocuments.identity}
              emptyValueLabel={t.tradeDocuments.notRecorded}
              fields={[
                { label: t.tradeDocuments.documentNumber, value: contract.documentNumber },
                { label: t.tradeDocuments.reference, value: contract.reference },
                { label: t.tradeDocuments.currency, value: contract.currencyCode },
                {
                  label: t.tradeDocuments.contracts.effectiveFrom,
                  value: contract.effectiveFrom,
                },
                { label: t.tradeDocuments.contracts.effectiveTo, value: contract.effectiveTo },
                {
                  label: t.tradeDocuments.contracts.financialMode,
                  value: contractFinancialMode(contract),
                },
                { label: t.tradeDocuments.notes, value: contract.notes, wide: true },
              ]}
            />

            <DetailSection
              title={t.tradeDocuments.contracts.clauses}
              emptyValueLabel={t.tradeDocuments.notRecorded}
              columns={1}
              // A clause is a title and up to 20,000 characters of body. A
              // definition list is the right shape: these are attributes of one
              // record, and the order is the contract's own `clauseOrder`.
              fields={
                contract.clauses.length > 0
                  ? [...contract.clauses]
                      .sort((left, right) => left.clauseOrder - right.clauseOrder)
                      .map((clause) => ({
                        label: `${clause.clauseOrder}. ${clause.title}`,
                        value: <span className="whitespace-pre-wrap">{clause.body}</span>,
                        wide: true,
                      }))
                  : [
                      {
                        label: t.tradeDocuments.contracts.clauses,
                        value: null,
                        wide: true,
                      },
                    ]
              }
            />

            <TradeDocumentTotals
              totals={readTotalsSnapshot(contract.totalsSnapshot)}
              currencyCode={contract.currencyCode}
              title={t.tradeDocuments.totals.grandTotal}
            />

            <TradePdfPanel
              state={pdf}
              canRender={!isDraft}
              onRender={() =>
                void pdf.render(
                  { sourceVersion: contract.version, purpose: "CONTRACT" },
                  t.tradeDocuments.pdf.operation,
                )
              }
              unavailableReason={t.tradeDocuments.contracts.activateDescription}
            />

            <ConfirmActionModal
              open={activate.isOpen}
              onOpenChange={(open) => (open ? activate.request() : activate.dismiss())}
              title={t.tradeDocuments.contracts.activateTitle}
              description={t.tradeDocuments.contracts.activateDescription}
              confirmLabel={t.tradeDocuments.contracts.activate}
              cancelLabel={t.common.cancel}
              loading={activate.write.isWriting}
              onConfirm={() => void activate.run()}
            />
          </>
        )}
      </div>
    </TradeGate>
  );
}
