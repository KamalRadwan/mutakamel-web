"use client";

import { use } from "react";
import { isUUIDv7 } from "@/lib/uuid";
import { ErrorState, NotFoundState, PermissionGate } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { TradeScopeRequired } from "../../documents/components/TradeBoundaryStates";
import { TradeDocumentSkeleton } from "../../documents/components/TradeDocumentSkeleton";
import { TradeGate } from "../../documents/components/TradeGate";
import { useTradeDocumentDetail } from "../../documents/hooks/useTradeDocumentDetail";
import { QuotationDetailWorkspace } from "../components/QuotationDetailWorkspace";
import {
  QUOTATIONS_PATH,
  QUOTATION_PERMISSIONS,
  parseQuotationDetail,
  type QuotationDetail,
} from "../quotation-contract";

export default function QuotationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ pdfJobId?: string | string[] }>;
}) {
  const { id } = use(params);
  const pdfJobId = searchParams ? use(searchParams).pdfJobId : undefined;
  const reopenPdfJobId = typeof pdfJobId === "string" && isUUIDv7(pdfJobId) ? pdfJobId : undefined;
  const { t } = useI18n();
  const qCopy = t.tradeDocuments.quotations;
  const detail = useTradeDocumentDetail<QuotationDetail>(QUOTATIONS_PATH, id, parseQuotationDetail);
  const quotation = detail.document;

  if (!detail.scope.isResolved) {
    return (
      <TradeGate require={QUOTATION_PERMISSIONS.read}>
        <TradeScopeRequired />
      </TradeGate>
    );
  }

  if (detail.loadError?.status === 403) {
    return <PermissionGate require={QUOTATION_PERMISSIONS.read} denied>{null}</PermissionGate>;
  }

  if (detail.isMissing) {
    return (
      <TradeGate require={QUOTATION_PERMISSIONS.read}>
        <NotFoundState
          title={qCopy.notFoundTitle}
          description={qCopy.notFoundDescription}
          backLabel={qCopy.back}
          backHref={TENANT_ROUTES.tradeQuotations}
        />
      </TradeGate>
    );
  }

  return (
    <TradeGate require={QUOTATION_PERMISSIONS.read}>
      {detail.isLoading || !quotation ? (
        detail.loadError ? (
          <ErrorState
            title={qCopy.loadFailed}
            description={detail.loadError.code ?? undefined}
            onRetry={() => void detail.reload()}
            retryLabel={t.common.retry}
          />
        ) : (
          <TradeDocumentSkeleton />
        )
      ) : (
        <QuotationDetailWorkspace
          key={quotation.id}
          initialQuotation={quotation}
          scope={detail.scope}
          onReload={detail.reload}
          reopenPdfJobId={reopenPdfJobId}
        />
      )}
    </TradeGate>
  );
}
