"use client";

import * as React from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import {
  Button,
  Field,
  FormDrawer,
  IdentifierText,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { generateUUIDv7, isUUIDv7 } from "@/lib/uuid";
import { tradeIfMatch, tradePatch, tradePost } from "../../trade-api";
import {
  TRADE_ACTION_RESPONSE_BYTES,
  readTotalsSnapshot,
  tradeDocumentPath,
} from "../../documents/trade-document-contract";
import { useTradeWrite } from "../../documents/hooks/useTradeWrite";
import { TradeWriteOutcome } from "../../documents/components/TradeBoundaryStates";
import { TradeFinancialLinesEditor } from "../../documents/components/TradeFinancialLinesEditor";
import {
  buildZeroFinancialTotals,
  computeTradeEvidence,
  createEmptyEvidenceLineDraft,
  type TradeEvidenceLineDraft,
} from "../../documents/lib/trade-financial-evidence";
import {
  CONTRACTS_PATH,
  buildContractDraftContent,
  contractFinancialMode,
  type ContractClauseInputPayload,
  type ContractDetail,
  type ContractFinancialMode,
} from "../contract-contract";

export interface ContractFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  headers: Record<string, string>;
  contract?: ContractDetail | null;
  onSaved: () => Promise<unknown>;
}

function createEmptyClause(): ContractClauseInputPayload {
  return {
    clientClauseId: generateUUIDv7(),
    title: "",
    body: "",
  };
}

export function ContractFormDrawer({
  open,
  onOpenChange,
  headers,
  contract,
  onSaved,
}: ContractFormDrawerProps) {
  const { t } = useI18n();
  const td = t.tradeDocuments;
  const write = useTradeWrite();
  const isEdit = Boolean(contract);

  const initialMode: ContractFinancialMode =
    contract && contractFinancialMode(contract) === "FINANCIAL"
      ? "FINANCIAL"
      : "NON_FINANCIAL";

  const [partyId, setPartyId] = React.useState(contract?.partyId ?? "");
  const [currencyCode, setCurrencyCode] = React.useState(
    contract?.currencyCode ?? "SAR",
  );
  const [effectiveFrom, setEffectiveFrom] = React.useState(
    contract?.effectiveFrom ?? "",
  );
  const [effectiveTo, setEffectiveTo] = React.useState(
    contract?.effectiveTo ?? "",
  );
  const [reference, setReference] = React.useState(contract?.reference ?? "");
  const [notes, setNotes] = React.useState(contract?.notes ?? "");
  const [mode, setMode] = React.useState<ContractFinancialMode>(initialMode);
  const [clauses, setClauses] = React.useState<ContractClauseInputPayload[]>(
    () =>
      contract && contract.clauses.length > 0
        ? contract.clauses.map((c) => ({
            clientClauseId: c.id,
            title: c.title,
            body: c.body,
          }))
        : [createEmptyClause()],
  );
  const [lines, setLines] = React.useState<TradeEvidenceLineDraft[]>(() => {
    if (contract && initialMode === "FINANCIAL") {
      const snap = readTotalsSnapshot(contract.totalsSnapshot);
      return [
        {
          ...createEmptyEvidenceLineDraft(),
          unitPrice: snap.subtotal ?? "0",
          discountAmount: snap.discountTotal ?? "0",
          chargeAmount: snap.chargeTotal ?? "0",
          taxRatePercent: "0",
        },
      ];
    }
    return [createEmptyEvidenceLineDraft()];
  });

  const computed = React.useMemo(
    () =>
      computeTradeEvidence(lines, {
        dialect: "FINANCIAL",
        currencyCode,
      }),
    [lines, currencyCode],
  );

  const clausesValid =
    clauses.length > 0 &&
    clauses.every((c) => c.title.trim().length > 0 && c.body.trim().length > 0);

  const windowValid =
    !effectiveFrom || !effectiveTo || effectiveTo >= effectiveFrom;

  const canSubmit =
    !write.isWriting &&
    isUUIDv7(partyId.trim()) &&
    /^[A-Z]{3}$/u.test(currencyCode.trim().toUpperCase()) &&
    clausesValid &&
    windowValid;

  function updateClause(
    index: number,
    patch: Partial<ContractClauseInputPayload>,
  ) {
    setClauses((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)),
    );
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    const payload = buildContractDraftContent({
      partyId,
      currencyCode,
      effectiveFrom,
      effectiveTo,
      reference,
      notes,
      mode,
      totalsSnapshot:
        mode === "NON_FINANCIAL"
          ? buildZeroFinancialTotals()
          : {
              subtotal: computed.subtotal,
              discountTotal: computed.discountTotal,
              chargeTotal: computed.chargeTotal,
              taxTotal: computed.taxTotal,
              roundingTotal: computed.roundingTotal,
              grandTotal: computed.grandTotal,
              amountPaid: "0",
              amountDue: computed.grandTotal,
            },
      clauses,
    });

    const ok = await write.runWrite({
      operation: isEdit ? td.executive.editContract : td.executive.newContract,
      send: (idempotency) =>
        contract
          ? tradePatch(
              tradeDocumentPath(CONTRACTS_PATH, contract.id),
              payload,
              {
                headers: {
                  ...headers,
                  ...idempotency,
                  "if-match": tradeIfMatch(contract.version),
                },
                maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
              },
            )
          : tradePost(CONTRACTS_PATH, payload, {
              headers: { ...headers, ...idempotency },
              maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
            }),
    });

    if (ok) {
      onOpenChange(false);
      await onSaved();
    }
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={
        isEdit
          ? td.executive.editContractTitle
          : td.executive.createContractTitle
      }
      description={td.executive.contractDrawerDescription}
      isDirty={partyId !== "" || reference !== ""}
      isSubmitting={write.isWriting}
      submitDisabled={!canSubmit}
      onSubmit={() => void handleSubmit()}
      labels={{
        submit: td.executive.saveContractDraft,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <TradeWriteOutcome write={write} />

      <div className="dossier-card dossier-card-indigo space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={td.party} required>
            <Input
              size="sm"
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              placeholder="UUIDv7"
            />
          </Field>
          <Field label={td.currency} required hint={td.currencyHint}>
            <Input
              size="sm"
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
              placeholder="SAR"
            />
          </Field>
          <Field label={td.contracts.effectiveFrom}>
            <Input
              size="sm"
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              placeholder={td.contracts.effectiveFrom}
            />
          </Field>
          <Field label={td.contracts.effectiveTo}>
            <Input
              size="sm"
              type="date"
              value={effectiveTo}
              onChange={(e) => setEffectiveTo(e.target.value)}
              placeholder={td.contracts.effectiveTo}
            />
          </Field>
          <Field label={td.reference}>
            <Input
              size="sm"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={td.reference}
            />
          </Field>
          <Field label={td.executive.financialModeLabel}>
            <Select
              value={mode}
              onValueChange={(v) => setMode(v as ContractFinancialMode)}
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NON_FINANCIAL">
                  {td.executive.modeNonFinancial}
                </SelectItem>
                <SelectItem value="FINANCIAL">
                  {td.executive.modeFinancial}
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label={td.notes}>
              <Input
                size="sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={td.notes}
              />
            </Field>
          </div>
        </div>
      </div>

      {mode === "NON_FINANCIAL" ? (
        <div className="dossier-card dossier-card-emerald">
          <p className="text-xs text-muted-foreground">
            {td.executive.nonFinancialZeroHint}
          </p>
        </div>
      ) : (
        <TradeFinancialLinesEditor
          dialect="FINANCIAL"
          currencyCode={currencyCode}
          lines={lines}
          onChangeLines={setLines}
          disabled={write.isWriting}
        />
      )}

      <div className="dossier-card dossier-card-violet space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="dossier-icon-pill dossier-ip-violet" aria-hidden>
              <FileText className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold text-foreground">
              {td.contracts.clauses}
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setClauses((prev) => [...prev, createEmptyClause()])}
          >
            <Plus className="me-1.5 h-3.5 w-3.5" aria-hidden />
            {td.executive.addClause}
          </Button>
        </div>

        <div className="space-y-3">
          {clauses.map((clause, idx) => (
            <div key={clause.clientClauseId} className="trade-clause-card space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="trade-clause-order-badge">
                    <IdentifierText>{String(idx + 1)}</IdentifierText>
                  </span>
                  <span className="text-xs font-semibold text-foreground">
                    {td.executive.clauseOrderLabel}{" "}
                    <IdentifierText>{String(idx + 1)}</IdentifierText>
                  </span>
                </div>
                {clauses.length > 1 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setClauses((prev) => prev.filter((_, i) => i !== idx))
                    }
                    aria-label={td.executive.removeClause}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                  </Button>
                ) : null}
              </div>

              <Field label={td.executive.clauseTitleLabel} required>
                <Input
                  size="sm"
                  value={clause.title}
                  onChange={(e) => updateClause(idx, { title: e.target.value })}
                  placeholder={td.executive.clauseTitleLabel}
                />
              </Field>

              <Field label={td.executive.clauseBodyLabel} required>
                <Input
                  size="sm"
                  value={clause.body}
                  onChange={(e) => updateClause(idx, { body: e.target.value })}
                  placeholder={td.executive.clauseBodyLabel}
                />
              </Field>
            </div>
          ))}
        </div>
      </div>
    </FormDrawer>
  );
}
