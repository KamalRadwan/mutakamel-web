"use client";

import { use } from "react";
import {
  Badge,
  DetailHeader,
  DetailSection,
  ErrorState,
  NotFoundState,
  PermissionGate,
  Skeleton,
} from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import { POLICY_READ_PERMISSION } from "../../policies/governance-contract";
import { useDecisionReceipt } from "./hooks/useDecisionReceipt";

export default function DecisionReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t, lang, canRead, receipt, isLoading, queryError, isNotFound, reload } =
    useDecisionReceipt(id);

  const content = (
    <div className="flex flex-col gap-4">
      <DetailHeader
        title={t.tradeGovernance.decisionTitle}
        subtitle={receipt ? tradeStatusLabel(t.tradeStatus, receipt.decisionType) : undefined}
        status={
          receipt?.outcome ? (
            <Badge tone={receipt.outcome === "ALLOW" ? "positive" : "caution"}>
              {tradeStatusLabel(t.tradeStatus, receipt.outcome)}
            </Badge>
          ) : undefined
        }
        backLabel={t.tradeGovernance.backToPricing}
        backHref={TENANT_ROUTES.tradePricing}
      />

      {isNotFound ? (
        <NotFoundState
          title={t.tradeGovernance.decisionNotFound}
          description={t.tradeGovernance.decisionNotFoundDescription}
          backLabel={t.tradeGovernance.backToPricing}
          backHref={TENANT_ROUTES.tradePricing}
        />
      ) : isLoading ? (
        <Skeleton className="h-64" />
      ) : queryError ? (
        <ErrorState
          title={t.tradeGovernance.decisionLoadFailed}
          description={queryError.message}
          onRetry={() => void reload()}
          retryLabel={t.common.retry}
        />
      ) : receipt ? (
        <DetailSection
          title={t.tradeCommon.overview}
          emptyValueLabel={t.tradeCommon.notSet}
          fields={[
            {
              label: t.tradeInventory.aggregateType,
              value: tradeStatusLabel(t.tradeStatus, receipt.aggregateType),
            },
            { label: t.tradeInventory.aggregateId, value: receipt.aggregateId },
            {
              label: t.tradeGovernance.scopeTarget,
              value: tradeStatusLabel(t.tradeStatus, receipt.scopeTarget),
            },
            { label: t.tradeInventory.explanation, value: receipt.explanation, wide: true },
            {
              label: t.tradeInventory.evaluatedAt,
              value: formatDateTime(receipt.evaluatedAt, lang),
            },
            { label: t.errors.reference, value: receipt.correlationId },
          ]}
        />
      ) : null}
    </div>
  );

  return canRead ? (
    content
  ) : (
    <PermissionGate require={POLICY_READ_PERMISSION}>{content}</PermissionGate>
  );
}
