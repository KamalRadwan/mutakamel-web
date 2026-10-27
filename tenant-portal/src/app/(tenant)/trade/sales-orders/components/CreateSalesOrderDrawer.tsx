"use client";

import * as React from "react";
import { Field, FormDrawer, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { isUUIDv7 } from "@/lib/uuid";
import { tradePost } from "../../trade-api";
import { TRADE_ACTION_RESPONSE_BYTES } from "../../documents/trade-document-contract";
import { useTradeWrite } from "../../documents/hooks/useTradeWrite";
import { TradeWriteFields, TradeWriteOutcome } from "../../documents/components/TradeBoundaryStates";
import { TradeFinancialLinesEditor } from "../../documents/components/TradeFinancialLinesEditor";
import { useTradeOrderPricing } from "../../documents/hooks/useTradeOrderPricing";
import {
  createEmptyEvidenceLineDraft,
  type TradeEvidenceLineDraft,
} from "../../documents/lib/trade-financial-evidence";
import {
  SALES_ORDERS_PATH,
  buildCreateSalesOrder,
} from "../sales-order-contract";

export interface CreateSalesOrderDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  headers: Record<string, string>;
  onCreated: () => Promise<unknown>;
}

export function CreateSalesOrderDrawer({
  open,
  onOpenChange,
  headers,
  onCreated,
}: CreateSalesOrderDrawerProps) {
  const { t } = useI18n();
  const td = t.tradeDocuments;
  const write = useTradeWrite();

  const [partyId, setPartyId] = React.useState("");
  const [currencyCode, setCurrencyCode] = React.useState("SAR");
  const [draftReference, setDraftReference] = React.useState("");
  const [paymentTermCode, setPaymentTermCode] = React.useState("NET_30");
  const [lines, setLines] = React.useState<TradeEvidenceLineDraft[]>(() => [
    createEmptyEvidenceLineDraft(),
  ]);

  const priced = useTradeOrderPricing(headers, currencyCode, partyId, "SALES", lines, open);
  const computed = priced.computed;

  const canSubmit =
    computed !== null &&
    !write.isBlocked &&
    isUUIDv7(partyId.trim()) &&
    /^[A-Z]{3}$/u.test(currencyCode.trim().toUpperCase()) &&
    lines.length > 0 &&
    lines.every(
      (l) => isUUIDv7(l.itemId.trim()) && isUUIDv7(l.uomCode.trim()),
    );

  async function handleSubmit() {
    if (!canSubmit || !computed) return;
    const payload = buildCreateSalesOrder({
      partyId,
      currencyCode,
      draftReference,
      lines: computed.lines.map((l) => ({
        clientLineId: l.clientLineId,
        itemId: l.itemId,
        uomId: l.uomCode,
        quantity: l.quantity,
        financial: {
          discountTotal: l.discountAmount,
          chargeTotal: l.chargeAmount,
          taxTotal: l.taxAmount,
          lineTotal: l.lineTotal,
          taxSnapshot: l.taxSnapshot,
        },
      })),
      totals: {
        subtotal: computed.subtotal,
        discountTotal: computed.discountTotal,
        chargeTotal: computed.chargeTotal,
        taxTotal: computed.taxTotal,
        roundingTotal: computed.roundingTotal,
        grandTotal: computed.grandTotal,
        amountPaid: computed.amountPaid,
        amountDue: computed.amountDue,
      },
      terms: {
        paymentTermCode: paymentTermCode.trim() || "NET_30",
        fulfillmentMode: "STOCK_FIRST",
      },
    });

    await write.runWrite({
      operation: td.executive.newSalesOrder,
      send: (idempotency) =>
        tradePost(SALES_ORDERS_PATH, payload, {
          headers: { ...headers, ...idempotency },
          maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
        }),
      onSuccess: async () => { onOpenChange(false); await onCreated(); },
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={(next) => { if (!write.isBlocked) onOpenChange(next); }}
      title={td.executive.createSalesOrderTitle}
      description={td.executive.createSalesOrderDescription}
      isDirty={partyId !== "" || draftReference !== ""}
      isSubmitting={write.isWriting}
      submitDisabled={!canSubmit}
      onSubmit={() => void handleSubmit()}
      labels={{
        submit: td.executive.createSalesOrderSubmit,
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
          <Field label={td.draftReference} hint={td.draftReferenceHint}>
            <Input
              size="sm"
              value={draftReference}
              onChange={(e) => setDraftReference(e.target.value)}
              placeholder={td.draftReference}
            />
          </Field>
          <Field label={td.executive.paymentTermCodeLabel}>
            <Input
              size="sm"
              value={paymentTermCode}
              onChange={(e) => setPaymentTermCode(e.target.value)}
              placeholder="NET_30"
            />
          </Field>
        </div>
      </div>

      <TradeFinancialLinesEditor
        dialect="ORDER"
        currencyCode={currencyCode}
        lines={priced.lines}
        pricing={priced.pricing}
        onChangeLines={setLines}
        disabled={write.isBlocked}
      />
      </TradeWriteFields>
    </FormDrawer>
  );
}
