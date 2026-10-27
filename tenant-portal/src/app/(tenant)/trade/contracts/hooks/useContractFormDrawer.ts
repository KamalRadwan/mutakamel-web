"use client";

import * as React from "react";
import { useI18n } from "@/i18n/I18nContext";
import { generateUUIDv7, isUUIDv7 } from "@/lib/uuid";
import { tradeIfMatch, tradePatch, tradePost } from "../../trade-api";
import { TRADE_ACTION_RESPONSE_BYTES, tradeDocumentPath } from "../../documents/trade-document-contract";
import { useTradeWrite } from "../../documents/hooks/useTradeWrite";
import { buildZeroFinancialTotals, computeTradeEvidence, createEmptyEvidenceLineDraft, type TradeEvidenceLineDraft } from "../../documents/lib/trade-financial-evidence";
import type { FinancialTotals } from "../../documents/financial-totals";
import { CONTRACTS_PATH, buildContractDraftContent, buildContractDraftUpdate, type ContractClauseInputPayload, type ContractFinancialMode } from "../contract-contract";
import { contractEditedTotals } from "../contract-edit-content";
import type { ContractFormDrawerProps } from "../components/ContractFormDrawer";

function createEmptyClause(): ContractClauseInputPayload {
  return { clientClauseId: generateUUIDv7(), title: "", body: "" };
}

export function useContractFormDrawer({ contract, headers, onOpenChange, onSaved }: ContractFormDrawerProps) {
  const { t } = useI18n();
  const td = t.tradeDocuments;
  const write = useTradeWrite();
  const isEdit = Boolean(contract);
  const [partyId, setPartyId] = React.useState(contract?.partyId ?? "");
  const [currencyCode, setCurrencyCode] = React.useState(contract?.currencyCode ?? "SAR");
  const [effectiveFrom, setEffectiveFrom] = React.useState(contract?.effectiveFrom ?? "");
  const [effectiveTo, setEffectiveTo] = React.useState(contract?.effectiveTo ?? "");
  const [reference, setReference] = React.useState(contract?.reference ?? "");
  const [notes, setNotes] = React.useState(contract?.notes ?? "");
  const [mode, setMode] = React.useState<ContractFinancialMode>(contract?.financialTerms.mode ?? "NON_FINANCIAL");
  const [clauses, setClauses] = React.useState<ContractClauseInputPayload[]>(() => contract ?
    contract.clauses.map((clause) => ({ clientClauseId: clause.id, title: clause.title, body: clause.body })) : [createEmptyClause()]);
  const [lines, setLines] = React.useState<TradeEvidenceLineDraft[]>(() => [createEmptyEvidenceLineDraft()]);
  const [editTotals, setEditTotals] = React.useState<FinancialTotals>(contract?.totalsSnapshot ?? buildZeroFinancialTotals());
  const [termsSnapshot, setTermsSnapshot] = React.useState<Record<string, unknown>>(
    contract?.termsSnapshot ?? { governingLawCountry: "SA", terminationNoticeDays: 30 },
  );
  const computed = React.useMemo(() => computeTradeEvidence(lines, { dialect: "FINANCIAL", currencyCode }), [lines, currencyCode]);
  const edited = contract ? contractEditedTotals(editTotals, contract.totalsSnapshot) : editTotals;
  const totalsSnapshot = mode === "NON_FINANCIAL" ?
    contract?.financialTerms.mode === mode ? contract.totalsSnapshot : buildZeroFinancialTotals()
    : contract ? edited : computed.ok ? {
    subtotal: computed.subtotal, discountTotal: computed.discountTotal, chargeTotal: computed.chargeTotal,
    taxTotal: computed.taxTotal, roundingTotal: computed.roundingTotal, grandTotal: computed.grandTotal,
    amountPaid: "0", amountDue: computed.grandTotal,
  } : null;
  const windowValid = !effectiveFrom || !effectiveTo || effectiveTo >= effectiveFrom;
  const clausesValid = clauses.length > 0 && clauses.every((clause) => clause.title.trim() && clause.body.trim());
  const canSubmit = !write.isBlocked && isUUIDv7(partyId.trim()) &&
    /^[A-Z]{3}$/u.test(currencyCode.trim().toUpperCase()) && Boolean(clausesValid) && windowValid && totalsSnapshot !== null;

  function updateClause(index: number, patch: Partial<ContractClauseInputPayload>) {
    setClauses((previous) => previous.map((clause, i) => i === index ? { ...clause, ...patch } : clause));
  }
  function changeMode(value: string) {
    if (value === "FINANCIAL" || value === "NON_FINANCIAL") setMode(value);
  }
  function updateTotal(key: keyof FinancialTotals, value: string) {
    setEditTotals((previous) => ({ ...previous, [key]: value }));
  }
  function updateTerm(key: "governingLawCountry" | "terminationNoticeDays", value: string) {
    setTermsSnapshot((previous) => ({ ...previous, [key]: key === "terminationNoticeDays" && /^\d+$/u.test(value) ? Number.parseInt(value, 10) : value }));
  }

  async function handleSubmit() {
    if (!canSubmit || !totalsSnapshot) return;
    const content = {
      effectiveFrom: effectiveFrom || undefined, effectiveTo: effectiveTo || undefined,
      reference: reference || undefined, notes: notes || undefined, termsSnapshot, clauses,
    };
    const payload = contract ? buildContractDraftUpdate({
      ...content, financialTerms: { mode, sourceEvidence: contract.financialTerms.sourceEvidence, totalsSnapshot },
    }) : buildContractDraftContent({ partyId, currencyCode, ...content, mode, totalsSnapshot });
    await write.runWrite({
      operation: isEdit ? td.executive.editContract : td.executive.newContract,
      send: (idempotency) => contract ? tradePatch(tradeDocumentPath(CONTRACTS_PATH, contract.id), payload, {
        headers: { ...headers, ...idempotency, "if-match": tradeIfMatch(contract.version) },
        maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
      }) : tradePost(CONTRACTS_PATH, payload, {
        headers: { ...headers, ...idempotency }, maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
      }),
      onSuccess: async () => { onOpenChange(false); await onSaved(); },
    });
  }

  return {
    t, td, write, isEdit, partyId, setPartyId, currencyCode, setCurrencyCode, effectiveFrom, setEffectiveFrom,
    effectiveTo, setEffectiveTo, reference, setReference, notes, setNotes, mode, setMode: changeMode,
    clauses, updateClause, lines, setLines,
    editTotals: { ...editTotals, grandTotal: edited?.grandTotal ?? editTotals.grandTotal,
      amountPaid: edited?.amountPaid ?? editTotals.amountPaid, amountDue: edited?.amountDue ?? editTotals.amountDue },
    updateTotal, termsSnapshot, updateTerm, editTotalsValid: edited !== null,
    addClause: () => setClauses((previous) => [...previous, createEmptyClause()]),
    removeClause: (index: number) => setClauses((previous) => previous.filter((_, i) => i !== index)),
    canSubmit, handleSubmit,
  };
}
