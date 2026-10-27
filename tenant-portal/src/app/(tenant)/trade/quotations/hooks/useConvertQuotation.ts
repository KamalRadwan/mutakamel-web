"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { tradeIfMatch, tradePost } from "../../trade-api";
import {
  TRADE_ACTION_RESPONSE_BYTES,
  tradeDocumentActionPath,
} from "../../documents/trade-document-contract";
import { useTradeWrite } from "../../documents/hooks/useTradeWrite";
import { QUOTATIONS_PATH, type QuotationDetail } from "../quotation-contract";
import {
  buildConvertQuotationToSalesOrder,
  type QuotationConversionEvidenceDraft,
} from "../quotation-conversion-contract";

interface ConversionOptions {
  quotation: QuotationDetail;
  headers: Record<string, string>;
  onOpenChange: (open: boolean) => void;
  onConverted: () => Promise<void>;
}

export function useConvertQuotation({ quotation, headers, onOpenChange, onConverted }: ConversionOptions) {
  const { t } = useI18n();
  const write = useTradeWrite();
  const [evidence, setEvidence] = useState<QuotationConversionEvidenceDraft[]>(() =>
    quotation.currentLines.map((line) => ({
      clientLineId: line.clientLineId,
      discountTotal: "0",
      chargeTotal: "0",
      taxCode: "",
      category: "",
      ratePercent: "",
    })),
  );
  const [reviewed, setReviewed] = useState(false);
  const result = useMemo(() => {
    try {
      return { payload: buildConvertQuotationToSalesOrder(quotation, evidence), error: null };
    } catch (error) {
      return {
        payload: null,
        error: error instanceof Error && error.message === "QUOTATION_CONVERSION_SOURCE"
          ? t.tradeDocuments.quotationConversion.sourceInvalid
          : t.tradeDocuments.quotationConversion.evidenceInvalid,
      };
    }
  }, [quotation, evidence, t]);
  const locked = write.isWriting || write.ambiguous !== null;
  const isDirty = evidence.some((line) =>
    line.taxCode !== "" || line.category !== "" || line.ratePercent !== "" ||
    line.discountTotal !== "0" || line.chargeTotal !== "0",
  );
  const acceptedTerms = quotation.revisions.find((r) => r.id === quotation.acceptedRevisionId)?.termsSnapshot ?? {};

  function updateEvidence(clientLineId: string, field: keyof Omit<QuotationConversionEvidenceDraft, "clientLineId">, value: string) {
    if (locked) return;
    setReviewed(false);
    setEvidence((lines) => lines.map((line) =>
      line.clientLineId === clientLineId ? { ...line, [field]: value } : line,
    ));
  }

  async function handleSubmit() {
    if (!result.payload || !reviewed || locked) return;
    const payload = result.payload;
    await write.runWrite({
      operation: t.tradeDocuments.quotations.convert,
      send: (idempotency) => tradePost(
        tradeDocumentActionPath(QUOTATIONS_PATH, quotation.id, "convert-to-sales-order"),
        payload,
        {
          headers: { ...headers, ...idempotency, "if-match": tradeIfMatch(quotation.version) },
          maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
        },
      ),
      onSuccess: () => {
        onOpenChange(false);
        void onConverted();
      },
    });
  }

  return { evidence, reviewed, setReviewed, updateEvidence, ...result, locked, isDirty, acceptedTerms, write, handleSubmit };
}
