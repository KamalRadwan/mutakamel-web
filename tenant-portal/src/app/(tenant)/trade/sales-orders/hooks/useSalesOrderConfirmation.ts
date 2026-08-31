"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TradePath } from "@/lib/api/envelope";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import { tradeGet, tradeIfMatch, tradePost } from "../../trade-api";
import {
  TRADE_ACTION_RESPONSE_BYTES,
  tradeDocumentActionPath,
  tradeDocumentPath,
  tradeInvalidResponse,
} from "../../documents/trade-document-contract";
import { isAbortError } from "../../documents/hooks/useTradeDocumentList";
import { useTradeWrite, type TradeWriteState } from "../../documents/hooks/useTradeWrite";
import {
  SALES_ORDERS_PATH,
  parseSalesOrderAttempt,
  parseSalesOrderConfirmation,
  type SalesOrderAttempt,
  type SalesOrderDetail,
} from "../sales-order-contract";

const POLL_INTERVAL_MS = 2_000;
const POLL_LIMIT = 60;

export interface SalesOrderConfirmationState {
  write: TradeWriteState;
  attempt: SalesOrderAttempt | null;
  isPolling: boolean;
  isPollExhausted: boolean;
  pollError: NormalizedApiError | null;
  requestedDeadline: string;
  setRequestedDeadline: (value: string) => void;
  confirm: () => Promise<void>;
  cancelAttempt: (reasonCode: string) => Promise<void>;
}

/**
 * `POST /sales-orders/:id/confirm` and the attempt it may create.
 *
 * Four contract details drive this:
 *
 * 1. **The route answers 200 *or* 202.** There is no `@HttpCode`; the handler
 *    sets the status from the idempotency record. The body carries its own
 *    `statusCode`, and this branches on that rather than on the HTTP status,
 *    because a replayed 202 comes back as 202 again — the one place in Trade
 *    where a stored `responseStatus` is applied to the response.
 * 2. **`Location` is unusable** (Q34): it is `/trade/sales-orders/…`, which
 *    matches none of the Gateway's rewrite mappings, so it is forwarded
 *    verbatim and points at nothing. The poll URL is built from `orderId` and
 *    `attemptId` in the body.
 * 3. **`If-Match` on the cancel is the *attempt's* version, not the order's.**
 *    `cancelSalesOrderConfirmationAttempt` runs `assertVersion(attempt.version,
 *    expectedAttemptVersion)`. Sending the order's version is a 409.
 * 4. **Holding is refused while an attempt is pending** rather than cancelling
 *    it — only `cancel` cancels a pending attempt.
 */
export function useSalesOrderConfirmation(
  order: SalesOrderDetail | null,
  headers: Record<string, string>,
  onSettled: () => Promise<unknown>,
): SalesOrderConfirmationState {
  const { t } = useI18n();
  const write = useTradeWrite();
  const [attempt, setAttempt] = useState<SalesOrderAttempt | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isPollExhausted, setIsPollExhausted] = useState(false);
  const [pollError, setPollError] = useState<NormalizedApiError | null>(null);
  const [requestedDeadline, setRequestedDeadline] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Built from ids, never from the 202's `Location` header — that path has no
  // Gateway mapping and answers 404 (Q34). `tradeDocumentPath` validates the
  // order id; the attempt id is validated here for the same reason.
  const attemptPath = useCallback(
    (orderId: string, attemptId: string): TradePath => {
      if (!isUUIDv7(attemptId)) tradeInvalidResponse();
      return `${tradeDocumentPath(SALES_ORDERS_PATH, orderId)}/confirmation-attempts/${attemptId}` as TradePath;
    },
    [],
  );

  const poll = useCallback(
    async (orderId: string, attemptId: string): Promise<void> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsPolling(true);
      setIsPollExhausted(false);
      try {
        for (let tick = 0; tick < POLL_LIMIT; tick += 1) {
          await delay(POLL_INTERVAL_MS, controller.signal);
          if (controller.signal.aborted) return;
          const result = await tradeGet(attemptPath(orderId, attemptId), {
            signal: controller.signal,
            headers,
            maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
          });
          const next = parseSalesOrderAttempt(result.data);
          setAttempt(next);
          if (next.status !== "PENDING" && next.status !== "READY_TO_FINALIZE") {
            await onSettled();
            return;
          }
        }
        setIsPollExhausted(true);
      } catch (error) {
        if (isAbortError(error)) return;
        setPollError(normalizeApiError(error));
      } finally {
        if (!controller.signal.aborted) setIsPolling(false);
      }
    },
    [attemptPath, headers, onSettled],
  );

  const confirm = useCallback(async (): Promise<void> => {
    if (!order) return;
    setPollError(null);
    await write.runWrite({
      operation: t.tradeDocuments.salesOrders.confirm,
      send: (idempotency) =>
        tradePost(
          tradeDocumentActionPath(SALES_ORDERS_PATH, order.id, "confirm"),
          // `ConfirmSalesOrderDto` carries one optional field. An empty object
          // is what the DTO expects when no deadline is requested.
          requestedDeadline ? { requestedDeadline: new Date(requestedDeadline).toISOString() } : {},
          {
            headers: { ...headers, ...idempotency, "if-match": tradeIfMatch(order.version) },
            maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
          },
        ),
      onSuccess: (result) => {
        const confirmation = parseSalesOrderConfirmation(result.data);
        if (confirmation.statusCode === 202) {
          setAttempt({
            id: confirmation.attemptId,
            // The 202 body carries no attempt version. It is read on the first
            // poll, and until then a cancel has no `If-Match` to send.
            version: 0,
            status: confirmation.status,
            deadlineAt: null,
            lastErrorCode: null,
          });
          void poll(confirmation.orderId, confirmation.attemptId);
        } else {
          setAttempt(null);
          void onSettled();
        }
      },
    });
  }, [order, requestedDeadline, headers, write, t, poll, onSettled]);

  const cancelAttempt = useCallback(
    async (reasonCode: string): Promise<void> => {
      if (!order || !attempt || attempt.version < 1) return;
      abortRef.current?.abort();
      await write.runWrite({
        operation: t.tradeDocuments.salesOrders.attemptCancel,
        send: (idempotency) =>
          tradePost(
            `${attemptPath(order.id, attempt.id)}/cancel` as TradePath,
            { reasonCode },
            {
              headers: {
                ...headers,
                ...idempotency,
                "if-match": tradeIfMatch(attempt.version),
              },
              maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
            },
          ),
        onSuccess: (result) => setAttempt(parseSalesOrderAttempt(result.data)),
      });
      setIsPolling(false);
      await onSettled();
    },
    [order, attempt, attemptPath, headers, write, t, onSettled],
  );

  return {
    write,
    attempt,
    isPolling,
    isPollExhausted,
    pollError,
    requestedDeadline,
    setRequestedDeadline,
    confirm,
    cancelAttempt,
  };
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}
