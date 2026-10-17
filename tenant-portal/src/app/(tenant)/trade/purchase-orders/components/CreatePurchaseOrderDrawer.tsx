"use client";

import * as React from "react";
import { ShieldCheck } from "lucide-react";
import { Field, FormDrawer, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { isUUIDv7 } from "@/lib/uuid";
import { tradePost } from "../../trade-api";
import { TRADE_ACTION_RESPONSE_BYTES } from "../../documents/trade-document-contract";
import { useTradeWrite } from "../../documents/hooks/useTradeWrite";
import { TradeWriteOutcome } from "../../documents/components/TradeBoundaryStates";
import { TradeFinancialLinesEditor } from "../../documents/components/TradeFinancialLinesEditor";
import {
  computeTradeEvidence,
  createEmptyEvidenceLineDraft,
  type TradeEvidenceLineDraft,
} from "../../documents/lib/trade-financial-evidence";
import {
  PURCHASE_ORDERS_PATH,
  buildCreatePurchaseOrder,
} from "../purchase-order-contract";

export interface CreatePurchaseOrderDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  headers: Record<string, string>;
  onCreated: () => Promise<unknown>;
}

export function CreatePurchaseOrderDrawer({
  open,
  onOpenChange,
  headers,
  onCreated,
}: CreatePurchaseOrderDrawerProps) {
  const { t } = useI18n();
  const td = t.tradeDocuments;
  const write = useTradeWrite();

  const [supplierPartyId, setSupplierPartyId] = React.useState("");
  const [supplierAccountId, setSupplierAccountId] = React.useState("");
  const [receivingNodeId, setReceivingNodeId] = React.useState("");
  const [currencyCode, setCurrencyCode] = React.useState("SAR");
  const [draftReference, setDraftReference] = React.useState("");
  const [paymentTermsCode, setPaymentTermsCode] = React.useState("NET_30");
  const [incoterm, setIncoterm] = React.useState("DDP");
  const [lines, setLines] = React.useState<TradeEvidenceLineDraft[]>(() => [
    createEmptyEvidenceLineDraft(),
  ]);

  const computed = React.useMemo(
    () =>
      computeTradeEvidence(lines, {
        dialect: "ORDER",
        currencyCode,
      }),
    [lines, currencyCode],
  );

  const canSubmit =
    !write.isWriting &&
    isUUIDv7(supplierPartyId.trim()) &&
    isUUIDv7(supplierAccountId.trim()) &&
    isUUIDv7(receivingNodeId.trim()) &&
    /^[A-Z]{3}$/u.test(currencyCode.trim().toUpperCase()) &&
    lines.length > 0 &&
    lines.every(
      (l) => isUUIDv7(l.itemId.trim()) && isUUIDv7(l.uomCode.trim()),
    );

  async function handleSubmit() {
    if (!canSubmit) return;
    const payload = buildCreatePurchaseOrder({
      supplierPartyId,
      supplierAccountId,
      currencyCode,
      receivingNodeId,
      draftReference,
      lines: computed.lines.map((l) => ({
        clientLineId: l.clientLineId,
        itemId: l.itemId,
        uomId: l.uomCode,
        quantity: l.quantity,
        receivingNodeId: receivingNodeId.trim(),
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
        paymentTermsCode: paymentTermsCode.trim() || "NET_30",
        incoterm: incoterm.trim() || "DDP",
      },
    });

    const ok = await write.runWrite({
      operation: td.executive.newPurchaseOrder,
      send: (idempotency) =>
        tradePost(PURCHASE_ORDERS_PATH, payload, {
          headers: { ...headers, ...idempotency },
          maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
        }),
    });

    if (ok) {
      onOpenChange(false);
      await onCreated();
    }
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={td.executive.createPurchaseOrderTitle}
      description={td.executive.createPurchaseOrderDescription}
      isDirty={supplierPartyId !== "" || draftReference !== ""}
      isSubmitting={write.isWriting}
      submitDisabled={!canSubmit}
      onSubmit={() => void handleSubmit()}
      labels={{
        submit: td.executive.createPurchaseOrderSubmit,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <TradeWriteOutcome write={write} />

      <div className="dossier-card dossier-card-violet space-y-2">
        <div className="dossier-card-header">
          <div className="dossier-card-title">
            <span className="dossier-icon-pill dossier-ip-violet" aria-hidden>
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span>{td.executive.makerCheckerTitle}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {td.executive.makerCheckerDescription}
        </p>
      </div>

      <div className="dossier-card dossier-card-indigo space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={td.supplier} required>
            <Input
              size="sm"
              value={supplierPartyId}
              onChange={(e) => setSupplierPartyId(e.target.value)}
              placeholder="UUIDv7"
            />
          </Field>
          <Field label={td.purchaseOrders.supplierAccount} required>
            <Input
              size="sm"
              value={supplierAccountId}
              onChange={(e) => setSupplierAccountId(e.target.value)}
              placeholder="UUIDv7"
            />
          </Field>
          <Field label={td.purchaseOrders.receivingNode} required>
            <Input
              size="sm"
              value={receivingNodeId}
              onChange={(e) => setReceivingNodeId(e.target.value)}
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
          <Field label={td.executive.paymentTermsCodeLabel}>
            <Input
              size="sm"
              value={paymentTermsCode}
              onChange={(e) => setPaymentTermsCode(e.target.value)}
              placeholder="NET_30"
            />
          </Field>
          <Field label={td.executive.incotermLabel}>
            <Input
              size="sm"
              value={incoterm}
              onChange={(e) => setIncoterm(e.target.value)}
              placeholder="DDP"
            />
          </Field>
        </div>
      </div>

      <TradeFinancialLinesEditor
        dialect="ORDER"
        currencyCode={currencyCode}
        lines={lines}
        onChangeLines={setLines}
        disabled={write.isWriting}
      />
    </FormDrawer>
  );
}
