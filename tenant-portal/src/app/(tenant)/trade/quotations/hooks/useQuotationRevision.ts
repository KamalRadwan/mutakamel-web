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
  deliveryDaysError?: string;
  warrantyMonthsError?: string;
  lineDraft: TradeLineDraftState;
  write: TradeWriteState;
  canSubmit: boolean;
  submit: () => Promise<void>;
}

// Terms are an object in CreateQuotationRevisionDto; bound integer conversion
// to JavaScript's exact range rather than silently rounding legal terms.
function parseTermInteger(input: string, blankDefault: number): number | null {
  const value = input.trim();
  if (value === "") return blankDefault;
  if (!/^[0-9]+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
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
  const parsedDeliveryDays = parseTermInteger(deliveryDays, 14);
  const parsedWarrantyMonths = parseTermInteger(warrantyMonths, 12);
  const termsReady = parsedDeliveryDays !== null && parsedWarrantyMonths !== null;

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
    if (!quotation || !linesReady || validUntil === "" || write.isBlocked || !termsReady) return;
    await write.runWrite({
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
              deliveryDays: parsedDeliveryDays,
              warrantyMonths: parsedWarrantyMonths,
            },
          },
          {
            headers: { ...headers, ...idempotency, "if-match": tradeIfMatch(quotation.version) },
            maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
          },
        ),
      onSuccess: async () => {
        setIsOpen(false);
        await onCreated();
      },
    });
  }, [
    quotation,
    linesReady,
    validUntil,
    paymentTermCode,
    incotermCode,
    parsedDeliveryDays,
    parsedWarrantyMonths,
    termsReady,
    write,
    t,
    lineDraft.lines,
    headers,
    onCreated,
  ]);

  return {
    isOpen,
    open: () => { if (!write.isBlocked) setIsOpen(true); },
    close: () => {
      if (write.isBlocked) return;
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
    deliveryDaysError: parsedDeliveryDays === null ? t.tradeDocuments.executive.revisionTermIntegerInvalid : undefined,
    warrantyMonthsError: parsedWarrantyMonths === null ? t.tradeDocuments.executive.revisionTermIntegerInvalid : undefined,
    lineDraft,
    write,
    canSubmit: linesReady && validUntil !== "" && !write.isBlocked && termsReady,
    submit,
  };
}

