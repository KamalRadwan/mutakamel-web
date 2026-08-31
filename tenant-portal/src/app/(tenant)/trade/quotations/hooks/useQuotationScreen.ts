"use client";

import { useCallback, useMemo } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { useTradeDocumentDetail } from "../../documents/hooks/useTradeDocumentDetail";
import { useTradePdfJob, type TradePdfJobState } from "../../documents/hooks/useTradePdfJob";
import {
  QUOTATIONS_PATH,
  QUOTATION_PERMISSIONS,
  parseQuotationDetail,
  type QuotationDetail,
  type QuotationRevision,
} from "../quotation-contract";
import { useQuotationActions, type QuotationActionsState } from "./useQuotationActions";
import { useQuotationRevision, type QuotationRevisionState } from "./useQuotationRevision";

/** The one action that advances the document, computed from its status. */
type QuotationAdvance = "send" | "accept" | null;

export interface QuotationScreenState {
  detail: ReturnType<typeof useTradeDocumentDetail<QuotationDetail>>;
  currentRevision: QuotationRevision | null;
  advance: QuotationAdvance;
  canRevise: boolean;
  canReject: boolean;
  canCancel: boolean;
  /** ACCEPTED, and conversion is the next step — which Q32 blocks. */
  isAwaitingConversion: boolean;
  actions: QuotationActionsState;
  revision: QuotationRevisionState;
  pdf: TradePdfJobState;
  renderPdf: () => void;
}

/**
 * Everything the quotation detail screen reads and writes.
 *
 * The **advance** action is computed from the lifecycle rather than listed, per
 * docs/design/patterns.md#multi-action-document-headers: a `DRAFT` advances by
 * Send, a `SENT` by Accept, and a terminal status has no filled action at all.
 * Send and Accept never render side by side with one disabled.
 */
export function useQuotationScreen(id: string): QuotationScreenState {
  const { t } = useI18n();
  const detail = useTradeDocumentDetail<QuotationDetail>(QUOTATIONS_PATH, id, parseQuotationDetail);
  const quotation = detail.document;
  const { headers } = detail.scope;

  const reload = useCallback(async () => {
    await detail.reload();
  }, [detail]);

  const actions = useQuotationActions(
    quotation,
    headers,
    {
      send: t.tradeDocuments.quotations.send,
      accept: t.tradeDocuments.quotations.accept,
      reject: t.tradeDocuments.quotations.reject,
      cancel: t.tradeDocuments.quotations.cancel,
    },
    reload,
  );
  const revision = useQuotationRevision(quotation, headers, reload);
  const pdf = useTradePdfJob(QUOTATIONS_PATH, id, headers);

  const currentRevision = useMemo(
    () => quotation?.revisions.find((entry) => entry.id === quotation.currentRevisionId) ?? null,
    [quotation],
  );

  const status = quotation?.lifecycleStatus ?? "";
  const canWrite = detail.scope.canWrite;

  // `send` additionally requires the revision to be DRAFT and its validity date
  // not to have passed; both are refused as 409s the screen surfaces rather
  // than pre-empts, because only the server knows the server's clock.
  const advance: QuotationAdvance =
    status === "DRAFT" && quotation?.currentRevisionId && canWrite(QUOTATION_PERMISSIONS.send)
      ? "send"
      : status === "SENT" && canWrite(QUOTATION_PERMISSIONS.accept)
        ? "accept"
        : null;

  const renderPdf = useCallback(() => {
    if (!currentRevision) return;
    void pdf.render(
      {
        revisionId: currentRevision.id,
        // `RenderQuotationPdfDto.purpose` is `@IsIn(["CUSTOMER_QUOTATION"])` —
        // the only value the DTO accepts.
        purpose: "CUSTOMER_QUOTATION",
      },
      t.tradeDocuments.pdf.operation,
    );
  }, [currentRevision, pdf, t]);

  return {
    detail,
    currentRevision,
    advance,
    canRevise: status === "DRAFT" && canWrite(QUOTATION_PERMISSIONS.update),
    canReject: status === "SENT" && canWrite(QUOTATION_PERMISSIONS.reject),
    canCancel:
      (status === "DRAFT" || status === "SENT") && canWrite(QUOTATION_PERMISSIONS.cancel),
    isAwaitingConversion: status === "ACCEPTED",
    actions,
    revision,
    pdf,
    renderPdf,
  };
}
