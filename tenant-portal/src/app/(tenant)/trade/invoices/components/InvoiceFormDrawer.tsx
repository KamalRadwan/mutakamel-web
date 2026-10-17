"use client";

import * as React from "react";
import { Field, FormDrawer, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { isUUIDv7 } from "@/lib/uuid";
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
  computeTradeEvidence,
  createEmptyEvidenceLineDraft,
  type TradeEvidenceLineDraft,
} from "../../documents/lib/trade-financial-evidence";
import {
  INVOICES_PATH,
  buildInvoiceDraftContent,
  type InvoiceDetail,
} from "../invoice-contract";

export interface InvoiceFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  headers: Record<string, string>;
  invoice?: InvoiceDetail | null;
  onSaved: () => Promise<unknown>;
}

export function InvoiceFormDrawer({
  open,
  onOpenChange,
  headers,
  invoice,
  onSaved,
}: InvoiceFormDrawerProps) {
  const { t } = useI18n();
  const td = t.tradeDocuments;
  const write = useTradeWrite();
  const isEdit = Boolean(invoice);

  const [partyId, setPartyId] = React.useState(invoice?.partyId ?? "");
  const [currencyCode, setCurrencyCode] = React.useState(
    invoice?.currencyCode ?? "SAR",
  );
  const [dueDate, setDueDate] = React.useState(invoice?.dueDate ?? "");
  const [reference, setReference] = React.useState(invoice?.reference ?? "");
  const [notes, setNotes] = React.useState(invoice?.notes ?? "");
  const [roundingTotal, setRoundingTotal] = React.useState(() =>
    invoice
      ? (readTotalsSnapshot(invoice.totalsSnapshot).roundingTotal ?? "0")
      : "0",
  );
  const [lines, setLines] = React.useState<TradeEvidenceLineDraft[]>(() =>
    invoice && invoice.lines.length > 0
      ? invoice.lines.map((l) => ({
          id: l.clientLineId,
          itemId: l.itemId ?? "",
          itemCode: "",
          description: l.descriptionSnapshot ?? "",
          uomCode: l.uomId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountAmount: "0",
          chargeAmount: "0",
          taxCode: "VAT-15",
          taxRatePercent: "15",
        }))
      : [createEmptyEvidenceLineDraft()],
  );

  const computed = React.useMemo(
    () =>
      computeTradeEvidence(lines, {
        dialect: "FINANCIAL",
        currencyCode,
        roundingTotal,
      }),
    [lines, currencyCode, roundingTotal],
  );

  const canSubmit =
    !write.isWriting &&
    isUUIDv7(partyId.trim()) &&
    /^[A-Z]{3}$/u.test(currencyCode.trim().toUpperCase()) &&
    lines.length > 0 &&
    lines.every(
      (l) => isUUIDv7(l.itemId.trim()) && isUUIDv7(l.uomCode.trim()),
    );

  async function handleSubmit() {
    if (!canSubmit) return;
    const payload = buildInvoiceDraftContent({
      partyId,
      currencyCode,
      dueDate,
      reference,
      notes,
      totalsSnapshot: {
        subtotal: computed.subtotal,
        discountTotal: computed.discountTotal,
        chargeTotal: computed.chargeTotal,
        taxTotal: computed.taxTotal,
        roundingTotal: computed.roundingTotal,
        grandTotal: computed.grandTotal,
        amountPaid: "0",
        amountDue: computed.grandTotal,
      },
      lines: computed.lines.map((l) => ({
        clientLineId: l.clientLineId,
        itemId: l.itemId,
        uomId: l.uomCode,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountTotal: l.discountAmount,
        chargeTotal: l.chargeAmount,
        taxTotal: l.taxAmount,
        lineTotal: l.lineTotal,
        priceSnapshot: l.priceSnapshot,
        taxSnapshot: l.taxSnapshot,
        ...(l.description ? { description: l.description } : {}),
      })),
    });

    const ok = await write.runWrite({
      operation: isEdit ? td.executive.editInvoice : td.executive.newInvoice,
      send: (idempotency) =>
        invoice
          ? tradePatch(
              tradeDocumentPath(INVOICES_PATH, invoice.id),
              payload,
              {
                headers: {
                  ...headers,
                  ...idempotency,
                  "if-match": tradeIfMatch(invoice.version),
                },
                maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
              },
            )
          : tradePost(INVOICES_PATH, payload, {
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
          ? td.executive.editInvoiceTitle
          : td.executive.createInvoiceTitle
      }
      description={td.executive.invoiceDrawerDescription}
      isDirty={partyId !== "" || reference !== ""}
      isSubmitting={write.isWriting}
      submitDisabled={!canSubmit}
      onSubmit={() => void handleSubmit()}
      labels={{
        submit: td.executive.saveInvoiceDraft,
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
          <Field label={td.customer} required>
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
          <Field label={td.invoices.dueDate}>
            <Input
              size="sm"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              placeholder={td.invoices.dueDate}
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

      <TradeFinancialLinesEditor
        dialect="FINANCIAL"
        currencyCode={currencyCode}
        lines={lines}
        onChangeLines={setLines}
        roundingTotal={roundingTotal}
        onChangeRoundingTotal={setRoundingTotal}
        disabled={write.isWriting}
      />
    </FormDrawer>
  );
}
