"use client";

import { use } from "react";
import { Filter } from "lucide-react";
import {
  Badge,
  DetailHeader,
  DetailSection,
  EmptyState,
  ErrorState,
  IdentifierText,
  NotFoundState,
  PermissionGate,
  Skeleton,
} from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { TradeScopeBar } from "../../TradeScopeBar";
import { TRADE_PERMISSIONS } from "../../trade-scope";
import { tradeLocalizedName } from "../../trade-validation";
import { useUomDetail } from "../hooks/useUomDetail";

export default function TradeUomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, lang, uom, isLoading, error, isGone, scopeGap, reload } = useUomDetail(id);

  return (
    <PermissionGate require={TRADE_PERMISSIONS.itemsRead}>
      <div className="flex flex-col gap-4">
        <DetailHeader
          title={uom?.code ?? t.trade.uomsTitle}
          subtitle={uom?.displayName}
          backHref={TENANT_ROUTES.tradeUoms}
          backLabel={t.trade.backToUoms}
          status={
            uom ? (
              <Badge tone={uom.status === "ACTIVE" ? "positive" : "neutral"}>
                {t.trade[`uomStatus_${uom.status}`]}
              </Badge>
            ) : null
          }
        />

        <TradeScopeBar />

        {scopeGap ? (
          <EmptyState
            icon={Filter}
            title={t.trade.scopeRequiredTitle}
            description={t.trade.uomScopeRequiredDescription}
          />
        ) : isLoading ? (
          <Skeleton className="h-64" />
        ) : isGone ? (
          // No retry: the request succeeded and the answer was "gone".
          <NotFoundState
            title={t.trade.uomNotFoundTitle}
            description={t.trade.uomNotFoundDescription}
            backHref={TENANT_ROUTES.tradeUoms}
            backLabel={t.trade.backToUoms}
          />
        ) : error || !uom ? (
          <ErrorState
            title={t.trade.uomLoadFailed}
            onRetry={reload}
            retryLabel={t.common.retry}
          />
        ) : (
          <>
            <DetailSection
              title={t.trade.uomDetailTitle}
              emptyValueLabel="—"
              fields={[
                { label: t.trade.uomCode, value: <IdentifierText>{uom.code}</IdentifierText> },
                { label: t.trade.uomDisplayName, value: uom.displayName },
                {
                  label: t.trade.localizedName,
                  value: tradeLocalizedName(uom.localizedNames, lang),
                },
                { label: t.trade.version, value: <IdentifierText>{uom.version}</IdentifierText> },
                { label: t.trade.updatedAt, value: formatDateTime(uom.updatedAt, lang) },
              ]}
            />

            {/* The evidence a finalized document snapshots. `recordedBy` and
                `recordedAt` are stamped by the service, never submitted. */}
            <DetailSection
              title={t.trade.uomEvidenceTitle}
              description={t.trade.uomEvidenceDescription}
              emptyValueLabel="—"
              fields={[
                { label: t.trade.uomSourceKind, value: uom.sourceEvidence.sourceKind },
                { label: t.trade.uomReference, value: uom.sourceEvidence.reference },
                { label: t.trade.uomNote, value: uom.sourceEvidence.note, wide: true },
                {
                  label: t.trade.uomRecordedBy,
                  value: uom.sourceEvidence.recordedBy ? (
                    <IdentifierText className="text-xs">{uom.sourceEvidence.recordedBy}</IdentifierText>
                  ) : null,
                },
                {
                  label: t.trade.uomRecordedAt,
                  value: uom.sourceEvidence.recordedAt
                    ? formatDateTime(uom.sourceEvidence.recordedAt, lang)
                    : null,
                },
              ]}
            />
          </>
        )}
      </div>
    </PermissionGate>
  );
}
