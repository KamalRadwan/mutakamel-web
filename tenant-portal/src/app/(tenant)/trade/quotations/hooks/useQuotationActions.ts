"use client";

import { useCallback, useState } from "react";
import { tradePost, tradeIfMatch } from "../../trade-api";
import {
  TRADE_ACTION_RESPONSE_BYTES,
  tradeDocumentActionPath,
} from "../../documents/trade-document-contract";
import { useTradeWrite, type TradeWriteState } from "../../documents/hooks/useTradeWrite";
import {
  QUOTATIONS_PATH,
  TRADE_EVIDENCE_REF_MAX_LENGTH,
  type QuotationDetail,
} from "../quotation-contract";
import { TRADE_REASON_CODE_MAX_LENGTH } from "../../documents/trade-document-contract";

/** The four lifecycle transitions plus the two that carry a reason. */
type QuotationAction = "send" | "accept" | "reject" | "cancel";

interface QuotationReasonInput {
  reasonCode: string;
  evidenceRef?: string;
}

export interface QuotationActionsState {
  write: TradeWriteState;
  pending: QuotationAction | null;
  openReason: QuotationAction | null;
  requestReason: (action: QuotationAction) => void;
  closeReason: () => void;
  run: (action: QuotationAction, reason?: string | QuotationReasonInput) => Promise<void>;
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
  sharedWrite?: TradeWriteState,
): QuotationActionsState {
  const internalWrite = useTradeWrite();
  const write = sharedWrite ?? internalWrite;
  const [pending, setPending] = useState<QuotationAction | null>(null);
  const [openReason, setOpenReason] = useState<QuotationAction | null>(null);

  const run = useCallback(
    async (action: QuotationAction, reason?: string | QuotationReasonInput): Promise<void> => {
      if (!quotation) return;
      setPending(action);
      const needsReason = action === "reject" || action === "cancel";
      const normalizedReason =
        typeof reason === "string"
          ? { reasonCode: reason.trim().slice(0, TRADE_REASON_CODE_MAX_LENGTH) }
          : reason
            ? {
                reasonCode: reason.reasonCode.trim().slice(0, TRADE_REASON_CODE_MAX_LENGTH),
                ...(reason.evidenceRef && reason.evidenceRef.trim()
                  ? { evidenceRef: reason.evidenceRef.trim().slice(0, TRADE_EVIDENCE_REF_MAX_LENGTH) }
                  : {}),
              }
            : undefined;
      try {
        await write.runWrite({
          operation: labels[action],
          send: (idempotency) =>
            tradePost(
              tradeDocumentActionPath(QUOTATIONS_PATH, quotation.id, action),
              needsReason ? normalizedReason : undefined,
              {
                headers: {
                  ...headers,
                  ...idempotency,
                  "if-match": tradeIfMatch(quotation.version),
                },
                maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
              },
            ),
          onSuccess: async () => {
            setOpenReason(null);
            await onChanged();
          },
        });
      } finally {
        setPending(null);
      }
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
