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
  lineDraft: TradeLineDraftState;
  write: TradeWriteState;
  canSubmit: boolean;
  submit: () => Promise<void>;
}

/**
 * `POST /quotations/:id/revisions`.
 *
 * Three things the contract page does not say, all read out of
 * `createQuotationRevision`:
 *
 * - A revision can only be added while the quotation is **`DRAFT`**. There is
 *   no revising a sent quotation; the caller gets
 *   `TRADE.QUOTE.TRANSITION_NOT_ALLOWED`.
 * - The lines carry **no prices**. The service prices them itself and writes
 *   the revision's `grandTotal` from its own figures, so nothing computed in
 *   the browser is submitted here.
 * - `terms` **defaults to `{}`** in the DTO, and this omits it. That is the
 *   server's own default rather than a shape invented here — but it has a
 *   consequence: `assertQuotationConversionEvidence` requires the accepted
 *   revision's `termsSnapshot` to be **non-empty**, so a revision created here
 *   can never be converted to a sales order. Recorded as Q80.
 */
export function useQuotationRevision(
  quotation: QuotationDetail | null,
  headers: Record<string, string>,
  onCreated: () => Promise<unknown>,
): QuotationRevisionState {
  const { t } = useI18n();
  const write = useTradeWrite();
  const [isOpen, setIsOpen] = useState(false);
  const [validUntil, setValidUntil] = useState("");

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
            // `@IsISO8601({ strict: true })`; the service then keeps the date
            // half only. A bare `yyyy-mm-dd` satisfies both.
            validUntil,
            lines: lineDraft.lines.map((line) => ({
              clientLineId: line.clientLineId,
              itemId: line.itemId,
              uomId: line.uomId,
              quantity: line.quantity,
            })),
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
  }, [quotation, linesReady, validUntil, write, t, lineDraft.lines, headers, onCreated]);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => {
      if (write.isWriting) return;
      setIsOpen(false);
    },
    validUntil,
    setValidUntil,
    lineDraft,
    write,
    canSubmit: linesReady && validUntil !== "" && !write.isWriting,
    submit,
  };
}
