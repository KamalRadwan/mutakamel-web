"use client";

import { useCallback, useState } from "react";
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
  SALES_ORDERS_PATH,
  SALES_ORDER_PERMISSIONS,
  parseSalesOrderDetail,
  type SalesOrderDetail,
} from "../sales-order-contract";
import {
  useSalesOrderConfirmation,
  type SalesOrderConfirmationState,
} from "./useSalesOrderConfirmation";

type SalesOrderReasonAction = "hold" | "release-hold" | "cancel";

export interface SalesOrderScreenState {
  detail: ReturnType<typeof useTradeDocumentDetail<SalesOrderDetail>>;
  confirmation: SalesOrderConfirmationState;
  write: TradeWriteState;
  pdf: TradePdfJobState;
  canConfirm: boolean;
  canHold: boolean;
  canRelease: boolean;
  canCancel: boolean;
  /** Holding is refused outright while a confirmation attempt is pending. */
  isHoldBlocked: boolean;
  openReason: SalesOrderReasonAction | null;
  requestReason: (action: SalesOrderReasonAction) => void;
  closeReason: () => void;
  runReason: (reasonCode: string) => Promise<void>;
  renderPdf: () => void;
}

export function useSalesOrderScreen(id: string): SalesOrderScreenState {
  const { t } = useI18n();
  const detail = useTradeDocumentDetail<SalesOrderDetail>(
    SALES_ORDERS_PATH,
    id,
    parseSalesOrderDetail,
  );
  const order = detail.document;
  const { headers, canWrite } = detail.scope;
  const write = useTradeWrite();
  const pdf = useTradePdfJob(SALES_ORDERS_PATH, id, headers);
  const [openReason, setOpenReason] = useState<SalesOrderReasonAction | null>(null);

  const reload = useCallback(async () => {
    await detail.reload();
  }, [detail]);

  const confirmation = useSalesOrderConfirmation(order, headers, reload);

  const runReason = useCallback(
    async (reasonCode: string): Promise<void> => {
      if (!order || !openReason) return;
      await write.runWrite({
        operation:
          openReason === "hold"
            ? t.tradeDocuments.salesOrders.hold
            : openReason === "release-hold"
              ? t.tradeDocuments.salesOrders.releaseHold
              : t.tradeDocuments.salesOrders.cancel,
        send: (idempotency) =>
          tradePost(
            tradeDocumentActionPath(SALES_ORDERS_PATH, order.id, openReason),
            // All three take `DocumentReasonDto`, and `cancel` refuses without
            // a `reasonCode` as a **409**, not a 400 — so it is required
            // locally rather than discovered as a transition failure.
            { reasonCode },
            {
              headers: { ...headers, ...idempotency, "if-match": tradeIfMatch(order.version) },
              maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
            },
          ),
      });
      setOpenReason(null);
      await reload();
    },
    [order, openReason, headers, write, t, reload],
  );

  const renderPdf = useCallback(() => {
    if (!order) return;
    void pdf.render(
      {
        // `sourceVersion` is the document version being printed — an int ≥ 1,
        // required, and pinned by `ck_trade_business_pdf_source_version`.
        sourceVersion: order.version,
        // `purpose` must match the route's own family; it is not inferred.
        purpose: "SALES_ORDER",
      },
      t.tradeDocuments.pdf.operation,
    );
  }, [order, pdf, t]);

  const isPendingConfirmation = order?.confirmationStatus === "PENDING";

  return {
    detail,
    confirmation,
    write,
    pdf,
    canConfirm:
      order?.lifecycleStatus === "DRAFT" &&
      order.confirmationStatus === "NOT_STARTED" &&
      canWrite(SALES_ORDER_PERMISSIONS.confirm),
    canHold:
      order?.holdStatus === "NONE" &&
      order.lifecycleStatus !== "CANCELLED" &&
      canWrite(SALES_ORDER_PERMISSIONS.hold),
    canRelease: order?.holdStatus === "HELD" && canWrite(SALES_ORDER_PERMISSIONS.hold),
    canCancel:
      order?.lifecycleStatus !== "CANCELLED" && canWrite(SALES_ORDER_PERMISSIONS.cancel),
    isHoldBlocked: isPendingConfirmation === true,
    openReason,
    requestReason: (action: SalesOrderReasonAction) => setOpenReason(action),
    closeReason: () => setOpenReason(null),
    runReason,
    renderPdf,
  };
}
