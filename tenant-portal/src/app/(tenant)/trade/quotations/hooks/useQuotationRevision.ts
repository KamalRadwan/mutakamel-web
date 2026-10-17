"use client";

import { useCallback, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { tradePost, tradeIfMatch } from "../../trade-api";
import {
  TRADE_ACTION_RESPONSE_BYTES,
  tradeDocumentActionPath,
} from "../../documents/trade-document-contract";
import { useTradeLineDraft, type TradeLineDraftState } from "../../documents/hooks/useTradeLineDraft";
import { useTradeWrite, type TradeWriteState } from "../../documents/hooks/useTradeWrite";
import { QUOTATIONS_PATH, type QuotationDetail } from "../quotation-contract";

export interface QuotationRevisionState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  validUntil: string;
  setValidUntil: (value: string) => void;
  paymentTermCode: string;
  setPaymentTermCode: (value: string) => void;
  incotermCode: string;
  setIncotermCode: (value: string) => void;
  deliveryDays: string;
  setDeliveryDays: (value: string) => void;
  warrantyMonths: string;
  setWarrantyMonths: (value: string) => void;
  lineDraft: TradeLineDraftState;
  write: TradeWriteState;
  canSubmit: boolean;
  submit: () => Promise<void>;
}

export function useQuotationRevision(
  quotation: QuotationDetail | null,
  headers: Record<string, string>,
  onCreated: () => Promise<unknown>,
): QuotationRevisionState {
  const { t } = useI18n();
  const write = useTradeWrite();
  const [isOpen, setIsOpen] = useState(false);
  const [validUntil, setValidUntil] = useState("");
  const [paymentTermCode, setPaymentTermCode] = useState("NET_30");
  const [incotermCode, setIncotermCode] = useState("EXW");
  const [deliveryDays, setDeliveryDays] = useState("14");
  const [warrantyMonths, setWarrantyMonths] = useState("12");

  const lineDraft = useTradeLineDraft(
    headers,
    quotation?.currencyCode ?? "",
    quotation?.partyId ?? null,
    "SALES",
    isOpen,
  );

  const linesReady =
    lineDraft.invalidLineIndex === null &&
    lineDraft.lines.every((line) => line.itemId !== "" && line.uomId !== "");

  const submit = useCallback(async (): Promise<void> => {
    if (!quotation || !linesReady || validUntil === "") return;
    const created = await write.runWrite({
      operation: t.tradeDocuments.quotations.newRevision,
      send: (idempotency) =>
        tradePost(
          tradeDocumentActionPath(QUOTATIONS_PATH, quotation.id, "revisions"),
          {
            validUntil,
            lines: lineDraft.lines.map((line) => ({
              clientLineId: line.clientLineId,
              itemId: line.itemId,
              uomId: line.uomId,
              quantity: line.quantity,
            })),
            terms: {
              paymentTermCode: paymentTermCode.trim() || "NET_30",
              incotermCode: incotermCode.trim() || "EXW",
              deliveryDays: Number.parseInt(deliveryDays || "14", 10) || 14,
              warrantyMonths: Number.parseInt(warrantyMonths || "12", 10) || 12,
            },
          },
          {
            headers: { ...headers, ...idempotency, "if-match": tradeIfMatch(quotation.version) },
            maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
          },
        ),
    });
    if (created) {
      setIsOpen(false);
      await onCreated();
    }
  }, [
    quotation,
    linesReady,
    validUntil,
    paymentTermCode,
    incotermCode,
    deliveryDays,
    warrantyMonths,
    write,
    t,
    lineDraft.lines,
    headers,
    onCreated,
  ]);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => {
      if (write.isWriting) return;
      setIsOpen(false);
    },
    validUntil,
    setValidUntil,
    paymentTermCode,
    setPaymentTermCode,
    incotermCode,
    setIncotermCode,
    deliveryDays,
    setDeliveryDays,
    warrantyMonths,
    setWarrantyMonths,
    lineDraft,
    write,
    canSubmit: linesReady && validUntil !== "" && !write.isWriting,
    submit,
  };
}

