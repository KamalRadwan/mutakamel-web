"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { tradeIfMatch, tradePost } from "../../trade-api";
import {
  TRADE_ACTION_RESPONSE_BYTES,
  tradeDocumentActionPath,
} from "../../documents/trade-document-contract";
import { useTradeWrite, type TradeWriteState } from "../../documents/hooks/useTradeWrite";
import {
  SALES_ORDERS_PATH,
  parseSalesOrderConfirmation,
  type SalesOrderDetail,
} from "../sales-order-contract";

export interface SalesOrderConfirmationState {
  write: TradeWriteState;
  requestedDeadline: string;
  setRequestedDeadline: (value: string) => void;
  confirm: () => Promise<void>;
}

/** Confirmation commits credit, reservations and order state in one request. */
export function useSalesOrderConfirmation(
  order: SalesOrderDetail | null,
  headers: Record<string, string>,
  onSettled: () => Promise<unknown>,
): SalesOrderConfirmationState {
  const { t } = useI18n();
  const toast = useToast();
  const write = useTradeWrite();
  const [requestedDeadline, setRequestedDeadline] = useState("");

  const confirm = useCallback(async (): Promise<void> => {
    if (!order) return;
    if (requestedDeadline && Number.isNaN(Date.parse(requestedDeadline))) {
      toast.error(
        t.tradeDocuments.salesOrders.requestedDeadline,
        t.tradeDocuments.salesOrders.requestedDeadlineInvalid,
      );
      return;
    }
    const body = requestedDeadline
      ? { requestedDeadline: new Date(requestedDeadline).toISOString() }
      : {};
    await write.runWrite({
      operation: t.tradeDocuments.salesOrders.confirm,
      send: (idempotency) =>
        tradePost(
          tradeDocumentActionPath(SALES_ORDERS_PATH, order.id, "confirm"),
          // `ConfirmSalesOrderDto` carries one optional field. An empty object
          // is what the DTO expects when no deadline is requested.
          body,
          {
            headers: { ...headers, ...idempotency, "if-match": tradeIfMatch(order.version) },
            maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
          },
        ),
      onSuccess: async (result) => {
        parseSalesOrderConfirmation(result.data);
        await onSettled();
      },
    });
  }, [order, requestedDeadline, headers, write, t, toast, onSettled]);

  return {
    write,
    requestedDeadline,
    setRequestedDeadline,
    confirm,
  };
}
