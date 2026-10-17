"use client";

import * as React from "react";
import { use, useCallback } from "react";
import { Building2, CreditCard, FileText, Pencil } from "lucide-react";
import {
  Button,
  ConfirmActionModal,
  DetailHeader,
  DetailSection,
  ErrorState,
  IdentifierText,
  Money,
  NotFoundState,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import {
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
import {
  partyDisplayName,
  readTotalsSnapshot,
} from "../../documents/trade-document-contract";
import { ContractFormDrawer } from "../components/ContractFormDrawer";
import {
  CONTRACTS_PATH,
  CONTRACT_PERMISSIONS,
  contractFinancialMode,
  parseContractDetail,
  type ContractDetail,
} from "../contract-contract";

export default function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useI18n();
  const td = t.tradeDocuments;
  const detail = useTradeDocumentDetail<ContractDetail>(
    CONTRACTS_PATH,
    id,
    parseContractDetail,
  );
  const contract = detail.document;
  const { headers, canWrite } = detail.scope;
  const pdf = useTradePdfJob(CONTRACTS_PATH, id, headers);
  const [editOpen, setEditOpen] = React.useState(false);

  const reload = useCallback(async () => {
    await detail.reload();
  }, [detail]);

  const activate = useTradeFinalizeAction(
    CONTRACTS_PATH,
    id,
    contract?.version ?? null,
    "activate",
    td.contracts.activate,
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
          title={td.contracts.notFoundTitle}
          description={td.contracts.notFoundDescription}
          backLabel={td.contracts.back}
          backHref={TENANT_ROUTES.tradeContracts}
        />
      </TradeGate>
    );
  }

  const isDraft = contract?.lifecycleStatus === "DRAFT";
  const stageSteps = [
    {
      status: "DRAFT",
      label: t.statusValues["TradeContractStatus.DRAFT"] ?? "DRAFT",
    },
    {
      status: "ACTIVE",
      label: t.statusValues["TradeContractStatus.ACTIVE"] ?? "ACTIVE",
    },
    {
      status: "SIGNED",
      label: t.statusValues["TradeContractStatus.SIGNED"] ?? "SIGNED",
    },
  ];

  const totalsEntries: Record<string, string> = contract
    ? readTotalsSnapshot(contract.totalsSnapshot)
    : {};
  const grandTotalValue = totalsEntries.grandTotal ?? "0";
  const mode = contract
    ? (contractFinancialMode(contract) ?? "NON_FINANCIAL")
    : "NON_FINANCIAL";

  return (
    <TradeGate require={CONTRACT_PERMISSIONS.read}>
      <div className="flex flex-col gap-4">
        {detail.isLoading || !contract ? (
          detail.loadError ? (
            <ErrorState
              title={td.contracts.loadFailed}
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
                <TradeStatusBadge
                  kind="TradeContractStatus"
                  value={contract.lifecycleStatus}
                />
              }
              backLabel={td.contracts.back}
              backHref={TENANT_ROUTES.tradeContracts}
              primaryAction={
                isDraft && canWrite(CONTRACT_PERMISSIONS.activate)
                  ? {
                      label: td.contracts.activate,
                      onClick: activate.request,
                      disabled: activate.write.isWriting,
                    }
                  : undefined
              }
              secondaryActions={
                isDraft && canWrite(CONTRACT_PERMISSIONS.update) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditOpen(true)}
                  >
                    <Pencil className="me-1.5 h-3.5 w-3.5" aria-hidden />
                    {td.executive.editContract}
                  </Button>
                ) : undefined
              }
            />

            <div className="dossier-stage-bar">
              <span className="dossier-stage-label">
                {td.executive.lifecycleTrack}
              </span>
              <div className="dossier-stage-track">
                {stageSteps.map((step, idx) => {
                  const activeIdx = stageSteps.findIndex(
                    (s) => s.status === contract.lifecycleStatus,
                  );
                  const stateClass =
                    step.status === contract.lifecycleStatus
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

            <TradeWriteOutcome write={activate.write} />
            <TradeWriteOutcome write={pdf.write} />

            {!isDraft ? (
              <p className="text-xs text-muted-foreground">
                {contract.lifecycleStatus === "SIGNED"
                  ? td.contracts.signedNote
                  : td.contracts.activeNote}
              </p>
            ) : null}

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
                      <IdentifierText>{`v${contract.version}`}</IdentifierText>
                    </span>
                  </div>
                  <div className="dossier-fields-grid">
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">{td.documentNumber}</span>
                      <span className="dossier-val">
                        <IdentifierText>{contract.documentNumber}</IdentifierText>
                      </span>
                    </div>
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">{td.party}</span>
                      <span className="dossier-val">
                        {partyDisplayName(contract.partySnapshot) ??
                          contract.partyId}
                      </span>
                    </div>
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">
                        {td.contracts.effectiveFrom}
                      </span>
                      <span className="dossier-val">
                        <IdentifierText>
                          {contract.effectiveFrom ?? td.notRecorded}
                        </IdentifierText>
                      </span>
                    </div>
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">
                        {td.contracts.effectiveTo}
                      </span>
                      <span className="dossier-val">
                        <IdentifierText>
                          {contract.effectiveTo ?? td.notRecorded}
                        </IdentifierText>
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
                      <IdentifierText>{mode}</IdentifierText>
                    </span>
                  </div>
                  <div className="dossier-fields-grid">
                    <div className="dossier-field-box dossier-span-all">
                      <span className="dossier-lbl">{td.grandTotal}</span>
                      <span className="dossier-val text-base">
                        <Money
                          value={grandTotalValue}
                          currency={contract.currencyCode}
                          minimumFractionDigits={2}
                          maximumFractionDigits={8}
                        />
                      </span>
                    </div>
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">
                        {td.executive.clausesCount}
                      </span>
                      <span className="dossier-val">
                        <IdentifierText>
                          {String(contract.clauses.length)}
                        </IdentifierText>
                      </span>
                    </div>
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">{td.currency}</span>
                      <span className="dossier-val">
                        <IdentifierText>{contract.currencyCode}</IdentifierText>
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
                { label: td.documentNumber, value: contract.documentNumber },
                { label: td.reference, value: contract.reference },
                { label: td.currency, value: contract.currencyCode },
                {
                  label: td.contracts.effectiveFrom,
                  value: contract.effectiveFrom,
                },
                { label: td.contracts.effectiveTo, value: contract.effectiveTo },
                {
                  label: td.contracts.financialMode,
                  value: contractFinancialMode(contract),
                },
                { label: td.notes, value: contract.notes, wide: true },
              ]}
            />

            {contract.clauses.length > 0 ? (
              <div className="dossier-card dossier-card-violet space-y-3">
                <div className="dossier-card-header">
                  <div className="dossier-card-title">
                    <span
                      className="dossier-icon-pill dossier-ip-violet"
                      aria-hidden
                    >
                      <FileText className="h-4 w-4" />
                    </span>
                    <span>{td.contracts.clauses}</span>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {[...contract.clauses]
                    .sort((left, right) => left.clauseOrder - right.clauseOrder)
                    .map((clause) => (
                      <div key={clause.id} className="trade-clause-card space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="trade-clause-order-badge">
                            <IdentifierText>
                              {String(clause.clauseOrder)}
                            </IdentifierText>
                          </span>
                          <span className="text-sm font-semibold text-foreground">
                            {clause.title}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                          {clause.body}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}

            <DetailSection
              title={td.contracts.clauses}
              emptyValueLabel={td.notRecorded}
              columns={1}
              fields={
                contract.clauses.length > 0
                  ? [...contract.clauses]
                      .sort((left, right) => left.clauseOrder - right.clauseOrder)
                      .map((clause) => ({
                        label: `${clause.clauseOrder}. ${clause.title}`,
                        value: (
                          <span className="whitespace-pre-wrap">
                            {clause.body}
                          </span>
                        ),
                        wide: true,
                      }))
                  : [
                      {
                        label: td.contracts.clauses,
                        value: null,
                        wide: true,
                      },
                    ]
              }
            />

            <TradeDocumentTotals
              totals={totalsEntries}
              currencyCode={contract.currencyCode}
              title={td.totals.grandTotal}
            />

            <TradePdfPanel
              state={pdf}
              canRender={!isDraft}
              onRender={() =>
                void pdf.render(
                  { sourceVersion: contract.version, purpose: "CONTRACT" },
                  td.pdf.operation,
                )
              }
              unavailableReason={td.contracts.activateDescription}
            />

            <ContractFormDrawer
              key={`${contract.id}-v${contract.version}`}
              open={editOpen}
              onOpenChange={setEditOpen}
              headers={headers}
              contract={contract}
              onSaved={reload}
            />

            <ConfirmActionModal
              open={activate.isOpen}
              onOpenChange={(open) =>
                open ? activate.request() : activate.dismiss()
              }
              title={td.contracts.activateTitle}
              description={td.contracts.activateDescription}
              confirmLabel={td.contracts.activate}
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
