"use client";

import { useCallback, useState } from "react";
import { tradeIfMatch, tradePatch } from "../../trade-api";
import { TRADE_ACTION_RESPONSE_BYTES, tradeDocumentPath } from "../trade-document-contract";
import { useTradeWrite, type TradeWriteState } from "./useTradeWrite";

export interface TradeDraftReferenceState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  value: string;
  setValue: (value: string) => void;
  write: TradeWriteState;
  isDirty: boolean;
  submit: () => Promise<void>;
}

/**
 * The draft reference — the only field a quotation, a sales order or a purchase
 * order will accept on a `PATCH`.
 *
 * `UpdateQuotationDto` takes `contactPartyId` and `draftReference`;
 * `UpdateSalesOrderDto` the same; `UpdatePurchaseOrderDto` takes
 * `receivingNodeId` and `draftReference`. **Lines and totals are immutable
 * after create** on all three, and the other three fields are bare UUIDs —
 * a contact party, a stock location — with no picker route anywhere in this
 * phase's 60. A text box for a UUID is not an editor, so only the reference is
 * offered and the rest is left alone rather than sent as null.
 *
 * A blank value clears the field: all three DTOs type `draftReference` as
 * nullable, so an explicit `null` is the documented way to remove it.
 */
export function useTradeDraftReference(
  basePath: string,
  documentId: string,
  version: number | null,
  current: string | null,
  operation: string,
  headers: Record<string, string>,
  onSaved: () => Promise<unknown>,
): TradeDraftReferenceState {
  const write = useTradeWrite();
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState("");

  const submit = useCallback(async (): Promise<void> => {
    if (version === null) return;
    const trimmed = value.trim();
    const saved = await write.runWrite({
      operation,
      send: (idempotency) =>
        tradePatch(
          tradeDocumentPath(basePath, documentId),
          { draftReference: trimmed.length > 0 ? trimmed.slice(0, 80) : null },
          {
            headers: { ...headers, ...idempotency, "if-match": tradeIfMatch(version) },
            maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
          },
        ),
    });
    if (saved) {
      setIsOpen(false);
      await onSaved();
    }
  }, [basePath, documentId, version, value, operation, headers, write, onSaved]);

  return {
    isOpen,
    open: () => {
      setValue(current ?? "");
      setIsOpen(true);
    },
    close: () => {
      if (write.isWriting) return;
      setIsOpen(false);
    },
    value,
    setValue,
    write,
    isDirty: value.trim() !== (current ?? "").trim(),
    submit,
  };
}
