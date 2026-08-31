"use client";

import { useCallback, useState } from "react";
import { tradeIfMatch, tradePost } from "../../trade-api";
import { TRADE_ACTION_RESPONSE_BYTES, tradeDocumentActionPath } from "../trade-document-contract";
import { useTradeWrite, type TradeWriteState } from "./useTradeWrite";

export interface TradeFinalizeActionState {
  write: TradeWriteState;
  isOpen: boolean;
  request: () => void;
  dismiss: () => void;
  run: () => Promise<void>;
}

/**
 * The one-way finalize step on a purchase quotation, an invoice or a contract.
 *
 * All three take **no body at all** — `issue` and `activate` declare no
 * `@Body()`, so `forbidUnknownValues` rejects a request that carries one; the
 * body argument is `undefined`, never `{}`. All three carry `If-Match` on the
 * document's own version, and all three are irreversible: there is no
 * un-issue, no void, no credit note, no cancel and no deactivate route
 * anywhere in the three families.
 */
export function useTradeFinalizeAction(
  basePath: string,
  documentId: string,
  version: number | null,
  action: string,
  operation: string,
  headers: Record<string, string>,
  onDone: () => Promise<unknown>,
): TradeFinalizeActionState {
  const write = useTradeWrite();
  const [isOpen, setIsOpen] = useState(false);

  const run = useCallback(async (): Promise<void> => {
    if (version === null) return;
    setIsOpen(false);
    await write.runWrite({
      operation,
      send: (idempotency) =>
        tradePost(tradeDocumentActionPath(basePath, documentId, action), undefined, {
          headers: { ...headers, ...idempotency, "if-match": tradeIfMatch(version) },
          maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
        }),
    });
    await onDone();
  }, [basePath, documentId, version, action, operation, headers, write, onDone]);

  return {
    write,
    isOpen,
    request: () => setIsOpen(true),
    dismiss: () => setIsOpen(false),
    run,
  };
}
