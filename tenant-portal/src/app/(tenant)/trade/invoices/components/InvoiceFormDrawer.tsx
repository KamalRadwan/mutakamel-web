"use client";

import { Field, FormDrawer, Input } from "@/design-system";
import { TradeWriteFields, TradeWriteOutcome } from "../../documents/components/TradeBoundaryStates";
import { TradeFinancialLinesEditor } from "../../documents/components/TradeFinancialLinesEditor";
import type { InvoiceDetail } from "../invoice-contract";
import { useInvoiceFormDrawer } from "../hooks/useInvoiceFormDrawer";
import { InvoiceDraftLinesEditor } from "./InvoiceDraftLinesEditor";

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
  const form = useInvoiceFormDrawer({ open, onOpenChange, headers, invoice, onSaved });
  const { t, td, write, isEdit, partyId, setPartyId, currencyCode, setCurrencyCode,
    dueDate, setDueDate, reference, setReference, notes, setNotes, roundingTotal,
    setRoundingTotal, lines, setLines, canSubmit, handleSubmit } = form;

  return (
    <FormDrawer
      open={open}
      onOpenChange={(next) => { if (!write.isBlocked) onOpenChange(next); }}
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
      <TradeWriteFields write={write}>
      <div className="dossier-card dossier-card-indigo space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={td.customer} required>
            <Input
              size="sm"
              value={partyId}
              readOnly={isEdit}
              onChange={(e) => setPartyId(e.target.value)}
              placeholder="UUIDv7"
            />
          </Field>
          <Field label={td.currency} required hint={td.currencyHint}>
            <Input
              size="sm"
              value={currencyCode}
              readOnly={isEdit}
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

      {isEdit ? <InvoiceDraftLinesEditor
        lines={form.editLines} roundingTotal={roundingTotal}
        totals={form.editTotals} currencyCode={currencyCode}
        onUpdate={form.updateEditLine} onAdd={form.addEditLine} onRemove={form.removeEditLine}
        onRoundingChange={setRoundingTotal} disabled={write.isBlocked}
      /> : <TradeFinancialLinesEditor
        dialect="FINANCIAL"
        currencyCode={currencyCode}
        lines={lines}
        onChangeLines={setLines}
        roundingTotal={roundingTotal}
        onChangeRoundingTotal={setRoundingTotal}
        disabled={write.isBlocked}
      />}
      </TradeWriteFields>
    </FormDrawer>
  );
}
