"use client";

import { useCallback, useState } from "react";
import { tradePost, tradeIfMatch } from "../../trade-api";
import {
  TRADE_ACTION_RESPONSE_BYTES,
  tradeDocumentActionPath,
} from "../../documents/trade-document-contract";
import { useTradeWrite, type TradeWriteState } from "../../documents/hooks/useTradeWrite";
import { QUOTATIONS_PATH, type QuotationDetail } from "../quotation-contract";

/** The four lifecycle transitions plus the two that carry a reason. */
type QuotationAction = "send" | "accept" | "reject" | "cancel";

export interface QuotationActionsState {
  write: TradeWriteState;
  pending: QuotationAction | null;
  openReason: QuotationAction | null;
  requestReason: (action: QuotationAction) => void;
  closeReason: () => void;
  run: (action: QuotationAction, reasonCode?: string) => Promise<void>;
}

export interface QuotationActionLabels {
  send: string;
  accept: string;
  reject: string;
  cancel: string;
}

/**
 * The quotation lifecycle: `send`, `accept`, `reject`, `cancel`.
 *
 * Two contract details shape this:
 *
 * - **`send` and `accept` take no body at all.** Neither handler declares
 *   `@Body()`, so `forbidUnknownValues` rejects a request that carries one.
 *   `tradePost` is called with `undefined`, not `{}`.
 * - **`reject` and `cancel` without a `reasonCode` are a 409, not a 400.** The
 *   service treats the missing field as a refused transition and answers
 *   `TRADE.QUOTE.TRANSITION_NOT_ALLOWED`, which reads as "you cannot do that"
 *   rather than "you left a field blank". The reason is therefore required
 *   locally, before the request is built.
 */
export function useQuotationActions(
  quotation: QuotationDetail | null,
  headers: Record<string, string>,
  labels: QuotationActionLabels,
  onChanged: () => Promise<unknown>,
): QuotationActionsState {
  const write = useTradeWrite();
  const [pending, setPending] = useState<QuotationAction | null>(null);
  const [openReason, setOpenReason] = useState<QuotationAction | null>(null);

  const run = useCallback(
    async (action: QuotationAction, reasonCode?: string): Promise<void> => {
      if (!quotation) return;
      setPending(action);
      const needsReason = action === "reject" || action === "cancel";
      await write.runWrite({
        operation: labels[action],
        send: (idempotency) =>
          tradePost(
            tradeDocumentActionPath(QUOTATIONS_PATH, quotation.id, action),
            needsReason ? { reasonCode } : undefined,
            {
              headers: {
                ...headers,
                ...idempotency,
                // Trade has one If-Match parser and answers 400
                // TRADE.CONCURRENCY.IF_MATCH_REQUIRED when it is missing or
                // unparseable — never 428. The strong form is what it emits.
                "if-match": tradeIfMatch(quotation.version),
              },
              maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
            },
          ),
      });
      setPending(null);
      setOpenReason(null);
      await onChanged();
    },
    [quotation, headers, labels, write, onChanged],
  );

  return {
    write,
    pending,
    openReason,
    requestReason: (action: QuotationAction) => setOpenReason(action),
    closeReason: () => setOpenReason(null),
    run,
  };
}
