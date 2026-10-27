"use client";

import * as React from "react";
import { useI18n } from "@/i18n/I18nContext";
import { generateUUIDv7, isUUIDv7 } from "@/lib/uuid";
import { tradeIfMatch, tradePatch, tradePost } from "../../trade-api";
import { TRADE_ACTION_RESPONSE_BYTES, tradeDocumentPath } from "../../documents/trade-document-contract";
import { useTradeWrite } from "../../documents/hooks/useTradeWrite";
import { computeTradeEvidence, createEmptyEvidenceLineDraft, type TradeEvidenceLineDraft } from "../../documents/lib/trade-financial-evidence";
import { INVOICES_PATH, buildInvoiceDraftContent, buildInvoiceDraftUpdate, type InvoiceDraftLinePayload } from "../invoice-contract";
import { invoiceEditFinancialContent, invoiceLineDraft } from "../invoice-edit-content";
import type { InvoiceFormDrawerProps } from "../components/InvoiceFormDrawer";

export function useInvoiceFormDrawer({ invoice, headers, onOpenChange, onSaved }: InvoiceFormDrawerProps) {
  const { t } = useI18n();
  const td = t.tradeDocuments;
  const write = useTradeWrite();
  const isEdit = Boolean(invoice);
  const [partyId, setPartyId] = React.useState(invoice?.partyId ?? "");
  const [currencyCode, setCurrencyCode] = React.useState(invoice?.currencyCode ?? "SAR");
  const [dueDate, setDueDate] = React.useState(invoice?.dueDate ?? "");
  const [reference, setReference] = React.useState(invoice?.reference ?? "");
  const [notes, setNotes] = React.useState(invoice?.notes ?? "");
  const [roundingTotal, setRoundingTotal] = React.useState(invoice?.totalsSnapshot.roundingTotal ?? "0");
  const [lines, setLines] = React.useState<TradeEvidenceLineDraft[]>(() => [createEmptyEvidenceLineDraft()]);
  const [editLines, setEditLines] = React.useState<InvoiceDraftLinePayload[]>(() => invoice?.lines.map(invoiceLineDraft) ?? []);
  const computed = React.useMemo(() => computeTradeEvidence(lines, {
    dialect: "FINANCIAL", currencyCode, roundingTotal,
  }), [lines, currencyCode, roundingTotal]);
  const edited = invoice ? invoiceEditFinancialContent(invoice, editLines, roundingTotal) : null;
  const validLines = invoice ? editLines.every((line) => isUUIDv7(line.itemId) && isUUIDv7(line.uomId)) :
    lines.every((line) => isUUIDv7(line.itemId.trim()) && isUUIDv7(line.uomCode.trim()));
  const canSubmit = !write.isBlocked && isUUIDv7(partyId.trim()) &&
    /^[A-Z]{3}$/u.test(currencyCode.trim().toUpperCase()) && validLines &&
    (invoice ? editLines.length > 0 && edited !== null : computed.ok);

  function updateEditLine(index: number, patch: Partial<InvoiceDraftLinePayload>) {
    setEditLines((previous) => previous.map((line, i) => i === index ? { ...line, ...patch } : line));
  }

  function addEditLine() {
    setEditLines((previous) => [...previous, {
      clientLineId: generateUUIDv7(), itemId: "", uomId: "", quantity: "1", unitPrice: "0",
      discountTotal: "0", chargeTotal: "0", taxTotal: "0", lineTotal: "0",
      priceSnapshot: {}, taxSnapshot: {},
    }]);
  }

  async function handleSubmit() {
    if (!canSubmit || (!invoice && !computed.ok)) return;
    const content = { dueDate: dueDate || undefined, reference: reference || undefined, notes: notes || undefined };
    const payload = invoice && edited ? buildInvoiceDraftUpdate({
      ...content, ...edited, termsSnapshot: invoice.termsSnapshot,
    }) : computed.ok ? buildInvoiceDraftContent({
      partyId, currencyCode, ...content,
      totalsSnapshot: {
        subtotal: computed.subtotal, discountTotal: computed.discountTotal,
        chargeTotal: computed.chargeTotal, taxTotal: computed.taxTotal,
        roundingTotal: computed.roundingTotal, grandTotal: computed.grandTotal,
        amountPaid: "0", amountDue: computed.grandTotal,
      },
      lines: computed.lines.map((line) => ({
        clientLineId: line.clientLineId, itemId: line.itemId, uomId: line.uomCode,
        quantity: line.quantity, unitPrice: line.unitPrice, discountTotal: line.discountAmount,
        chargeTotal: line.chargeAmount, taxTotal: line.taxAmount, lineTotal: line.lineTotal,
        priceSnapshot: line.priceSnapshot, taxSnapshot: line.taxSnapshot,
        ...(line.description ? { description: line.description } : {}),
      })),
    }) : null;
    if (!payload) return;
    await write.runWrite({
      operation: isEdit ? td.executive.editInvoice : td.executive.newInvoice,
      send: (idempotency) => invoice ? tradePatch(tradeDocumentPath(INVOICES_PATH, invoice.id), payload, {
        headers: { ...headers, ...idempotency, "if-match": tradeIfMatch(invoice.version) },
        maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
      }) : tradePost(INVOICES_PATH, payload, {
        headers: { ...headers, ...idempotency }, maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
      }),
      onSuccess: async () => { onOpenChange(false); await onSaved(); },
    });
  }

  return {
    t, td, write, isEdit, partyId, setPartyId, currencyCode, setCurrencyCode,
    dueDate, setDueDate, reference, setReference, notes, setNotes, roundingTotal, setRoundingTotal,
    lines, setLines, editLines, editTotals: edited?.totalsSnapshot ?? null, updateEditLine, addEditLine,
    removeEditLine: (index: number) => setEditLines((previous) => previous.filter((_, i) => i !== index)),
    canSubmit, handleSubmit,
  };
}
