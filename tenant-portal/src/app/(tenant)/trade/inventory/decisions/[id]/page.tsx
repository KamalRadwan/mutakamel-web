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
import { tradeStatusLabel } from "../../../trade-advanced-validation";
import { INVENTORY_READ_PERMISSION } from "../../inventory-contract";
import { useInventoryDecision } from "./hooks/useInventoryDecision";

export default function InventoryDecisionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t, lang, canRead, decision, isLoading, queryError, isNotFound, reload } =
    useInventoryDecision(id);

  const content = (
    <div className="flex flex-col gap-4">
      <DetailHeader
        title={t.tradeInventory.decisionDetailTitle}
        subtitle={decision ? tradeStatusLabel(t.tradeStatus, decision.decisionType) : undefined}
        status={
          decision?.outcome ? (
            <Badge tone={decision.outcome === "ALLOW" ? "positive" : "caution"}>
              {tradeStatusLabel(t.tradeStatus, decision.outcome)}
            </Badge>
          ) : undefined
        }
        backLabel={t.tradeInventory.backToDecisions}
        backHref={TENANT_ROUTES.tradeInventoryDecisions}
      />

      {isNotFound ? (
        <NotFoundState
          title={t.tradeInventory.decisionNotFound}
          description={t.tradeInventory.decisionNotFoundDescription}
          backLabel={t.tradeInventory.backToDecisions}
          backHref={TENANT_ROUTES.tradeInventoryDecisions}
        />
      ) : isLoading ? (
        <Skeleton className="h-64" />
      ) : queryError ? (
        <ErrorState
          title={t.tradeInventory.decisionLoadFailed}
          description={queryError.message}
          onRetry={() => void reload()}
          retryLabel={t.common.retry}
        />
      ) : decision ? (
        <DetailSection
          title={t.tradeCommon.overview}
          description={t.tradeInventory.decisionProjectionNote}
          emptyValueLabel={t.tradeCommon.notSet}
          fields={[
            {
              label: t.tradeInventory.aggregateType,
              value: tradeStatusLabel(t.tradeStatus, decision.aggregateType),
            },
            { label: t.tradeInventory.aggregateId, value: decision.aggregateId },
            { label: t.tradeInventory.explanationCode, value: decision.explanationCode },
            { label: t.tradeInventory.explanation, value: decision.explanation, wide: true },
            {
              label: t.tradeInventory.evaluatedAt,
              value: formatDateTime(decision.evaluatedAt, lang),
            },
            { label: t.errors.reference, value: decision.correlationId },
          ]}
        />
      ) : null}
    </div>
  );

  return canRead ? (
    content
  ) : (
    <PermissionGate require={INVENTORY_READ_PERMISSION}>{content}</PermissionGate>
  );
}
