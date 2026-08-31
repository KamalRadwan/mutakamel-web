"use client";

import { useCallback, useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { tradeIfMatch, tradePost } from "../../trade-api";
import {
  TRADE_ACTION_RESPONSE_BYTES,
  tradeDocumentActionPath,
} from "../../documents/trade-document-contract";
import { useTradeDocumentDetail } from "../../documents/hooks/useTradeDocumentDetail";
import { useTradePdfJob, type TradePdfJobState } from "../../documents/hooks/useTradePdfJob";
import { useTradeWrite, type TradeWriteState } from "../../documents/hooks/useTradeWrite";
import {
  PURCHASE_ORDERS_PATH,
  PURCHASE_ORDER_REASON_REQUIRED,
  parsePurchaseOrderDetail,
  purchaseOrderLadder,
  type PurchaseOrderAction,
  type PurchaseOrderDetail,
} from "../purchase-order-contract";

export interface PurchaseOrderScreenState {
  detail: ReturnType<typeof useTradeDocumentDetail<PurchaseOrderDetail>>;
  write: TradeWriteState;
  pdf: TradePdfJobState;
  allowed: Record<PurchaseOrderAction, boolean>;
  /** True when the actor raised this order — the maker half of maker–checker. */
  isMaker: boolean;
  openReason: PurchaseOrderAction | null;
  requestAction: (action: PurchaseOrderAction) => void;
  closeReason: () => void;
  run: (action: PurchaseOrderAction, reasonCode?: string) => Promise<void>;
  renderPdf: () => void;
}

const EMPTY_LADDER: Record<PurchaseOrderAction, boolean> = {
  submit: false,
  withdraw: false,
  approve: false,
  reject: false,
  confirm: false,
  cancel: false,
};

/**
 * The purchase-order approval ladder.
 *
 * `submit`, `approve` and `confirm` carry no reason; `reject` and `cancel` are
 * refused without one as a **409**, so those two open a reason dialog and the
 * other three run straight away.
 */
export function usePurchaseOrderScreen(id: string): PurchaseOrderScreenState {
  const { t } = useI18n();
  const detail = useTradeDocumentDetail<PurchaseOrderDetail>(
    PURCHASE_ORDERS_PATH,
    id,
    parsePurchaseOrderDetail,
  );
  const order = detail.document;
  const { headers, canWrite, userId } = detail.scope;
  const write = useTradeWrite();
  const pdf = useTradePdfJob(PURCHASE_ORDERS_PATH, id, headers);
  const [openReason, setOpenReason] = useState<PurchaseOrderAction | null>(null);

  const reload = useCallback(async () => {
    await detail.reload();
  }, [detail]);

  // Memoized because `run` depends on it: a fresh object every render would
  // rebuild the callback on every render and defeat its own dependency list.
  const labels: Record<PurchaseOrderAction, string> = useMemo(
    () => ({
      submit: t.tradeDocuments.purchaseOrders.submit,
      withdraw: t.tradeDocuments.purchaseOrders.withdraw,
      approve: t.tradeDocuments.purchaseOrders.approve,
      reject: t.tradeDocuments.purchaseOrders.reject,
      confirm: t.tradeDocuments.purchaseOrders.confirm,
      cancel: t.tradeDocuments.purchaseOrders.cancel,
    }),
    [t],
  );

  const run = useCallback(
    async (action: PurchaseOrderAction, reasonCode?: string): Promise<void> => {
      if (!order) return;
      await write.runWrite({
        operation: labels[action],
        send: (idempotency) =>
          tradePost(
            tradeDocumentActionPath(PURCHASE_ORDERS_PATH, order.id, action),
            // `PurchaseActionDto` has two optional fields. `evidence` is an
            // opaque object with no published schema (Q32) and is never sent.
            reasonCode ? { reasonCode } : {},
            {
              headers: { ...headers, ...idempotency, "if-match": tradeIfMatch(order.version) },
              maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
            },
          ),
      });
      setOpenReason(null);
      await reload();
    },
    [order, headers, write, labels, reload],
  );

  const renderPdf = useCallback(() => {
    if (!order) return;
    void pdf.render(
      { sourceVersion: order.version, purpose: "PURCHASE_ORDER" },
      t.tradeDocuments.pdf.operation,
    );
  }, [order, pdf, t]);

  return {
    detail,
    write,
    pdf,
    allowed: order ? purchaseOrderLadder(order, userId, canWrite) : EMPTY_LADDER,
    isMaker: order !== null && userId !== null && order.createdBy === userId,
    openReason,
    requestAction: (action: PurchaseOrderAction) => {
      if (PURCHASE_ORDER_REASON_REQUIRED.includes(action)) setOpenReason(action);
      else void run(action);
    },
    closeReason: () => setOpenReason(null),
    run,
    renderPdf,
  };
}
