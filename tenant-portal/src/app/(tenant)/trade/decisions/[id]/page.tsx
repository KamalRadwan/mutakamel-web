"use client";

import Link from "next/link";
import { use } from "react";
import { CheckCircle2, FileCheck2, Globe, RotateCcw, ShieldCheck } from "lucide-react";
import {
  Badge,
  DetailHeader,
  DetailSection,
  ErrorState,
  IdentifierText,
  NotFoundState,
  PermissionGate,
  SWATCH_SURFACE_PALETTES,
  Skeleton,
  cn,
} from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import { POLICY_READ_PERMISSION } from "../../policies/governance-contract";
import { useDecisionReceipt } from "./hooks/useDecisionReceipt";

function buildRerunPricingHref(inputs?: Record<string, unknown> | null): string {
  if (!inputs) return TENANT_ROUTES.tradePricing;
  const params = new URLSearchParams();
  for (const key of [
    "purpose",
    "itemId",
    "uomId",
    "quantity",
    "currencyCode",
    "priceBookId",
    "partyId",
  ]) {
    const val = inputs[key];
    if (typeof val === "string" && val.trim().length > 0) {
      params.set(key, val.trim());
    } else if (typeof val === "number" && Number.isFinite(val)) {
      params.set(key, String(val));
    }
  }
  const query = params.toString();
  return query ? `${TENANT_ROUTES.tradePricing}?${query}` : TENANT_ROUTES.tradePricing;
}

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
        subtitle={
          receipt
            ? tradeStatusLabel(t.tradeStatus, receipt.decisionType, t.common.unknownCode)
            : t.tradeGovernance.decisionForensicSubtitle
        }
        status={
          receipt?.outcome ? (
            <Badge tone={receipt.outcome === "ALLOW" ? "positive" : "caution"}>
              {tradeStatusLabel(t.tradeStatus, receipt.outcome, t.common.unknownCode)}
            </Badge>
          ) : undefined
        }
        backLabel={t.tradeGovernance.backToPricing}
        backHref={TENANT_ROUTES.tradePricing}
        secondaryActions={
          receipt ? (
            <Link
              href={buildRerunPricingHref(receipt.inputs)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-2xs hover:bg-muted"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              {t.tradeGovernance.rerunInWorkbench}
            </Link>
          ) : undefined
        }
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
        <>
          {/* 4-Card Forensic Receipt KPI Strip */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div
              className={cn(
                "flex items-start justify-between gap-3 rounded-lg border border-s-4 bg-card p-3.5 shadow-2xs",
                receipt.outcome === "ALLOW"
                  ? SWATCH_SURFACE_PALETTES.green.accentBorder
                  : SWATCH_SURFACE_PALETTES.amber.accentBorder,
              )}
            >
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t.tradeGovernance.decisionOutcomeLabel}
                </span>
                <span className="text-base font-semibold text-foreground">
                  {receipt.outcome
                    ? tradeStatusLabel(t.tradeStatus, receipt.outcome, t.common.unknownCode)
                    : t.tradeCommon.notSet}
                </span>
                <span className="text-xs text-muted-foreground">{receipt.explanation}</span>
              </div>
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg border",
                  receipt.outcome === "ALLOW"
                    ? SWATCH_SURFACE_PALETTES.green.iconBoxIdle
                    : SWATCH_SURFACE_PALETTES.amber.iconBoxIdle,
                )}
              >
                <CheckCircle2 className="size-4" aria-hidden="true" />
              </span>
            </div>

            <div
              className={cn(
                "flex items-start justify-between gap-3 rounded-lg border border-s-4 bg-card p-3.5 shadow-2xs",
                SWATCH_SURFACE_PALETTES.indigo.accentBorder,
              )}
            >
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t.tradeGovernance.decisionTypeLabel}
                </span>
                <span className="text-base font-semibold text-foreground">
                  {tradeStatusLabel(t.tradeStatus, receipt.decisionType, t.common.unknownCode)}
                </span>
                <IdentifierText className="truncate text-xs text-muted-foreground">
                  {receipt.id}
                </IdentifierText>
              </div>
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg border",
                  SWATCH_SURFACE_PALETTES.indigo.iconBoxIdle,
                )}
              >
                <FileCheck2 className="size-4" aria-hidden="true" />
              </span>
            </div>

            <div
              className={cn(
                "flex items-start justify-between gap-3 rounded-lg border border-s-4 bg-card p-3.5 shadow-2xs",
                SWATCH_SURFACE_PALETTES.blue.accentBorder,
              )}
            >
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t.tradeGovernance.decisionScopeLabel}
                </span>
                <span className="text-base font-semibold text-foreground">
                  {tradeStatusLabel(t.tradeStatus, receipt.scopeTarget, t.common.unknownCode)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(receipt.evaluatedAt, lang)}
                </span>
              </div>
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg border",
                  SWATCH_SURFACE_PALETTES.blue.iconBoxIdle,
                )}
              >
                <Globe className="size-4" aria-hidden="true" />
              </span>
            </div>

            <div
              className={cn(
                "flex items-start justify-between gap-3 rounded-lg border border-s-4 bg-card p-3.5 shadow-2xs",
                SWATCH_SURFACE_PALETTES.purple.accentBorder,
              )}
            >
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t.tradeGovernance.decisionSubjectLabel}
                </span>
                <span className="text-base font-semibold text-foreground">
                  {tradeStatusLabel(t.tradeStatus, receipt.aggregateType, t.common.unknownCode)}
                </span>
                <IdentifierText className="truncate text-xs text-muted-foreground">
                  {receipt.aggregateId}
                </IdentifierText>
              </div>
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg border",
                  SWATCH_SURFACE_PALETTES.purple.iconBoxIdle,
                )}
              >
                <ShieldCheck className="size-4" aria-hidden="true" />
              </span>
            </div>
          </div>

          <DetailSection
            title={t.tradeCommon.overview}
            emptyValueLabel={t.tradeCommon.notSet}
            fields={[
              {
                label: t.tradeInventory.aggregateType,
                value: tradeStatusLabel(t.tradeStatus, receipt.aggregateType, t.common.unknownCode),
              },
              {
                label: t.tradeInventory.aggregateId,
                value: <IdentifierText className="text-xs">{receipt.aggregateId}</IdentifierText>,
              },
              {
                label: t.tradeGovernance.scopeTarget,
                value: tradeStatusLabel(t.tradeStatus, receipt.scopeTarget, t.common.unknownCode),
              },
              { label: t.tradeInventory.explanation, value: receipt.explanation, wide: true },
              {
                label: t.tradeInventory.evaluatedAt,
                value: formatDateTime(receipt.evaluatedAt, lang),
              },
              {
                label: t.errors.reference,
                value: receipt.correlationId ? (
                  <IdentifierText className="text-xs">{receipt.correlationId}</IdentifierText>
                ) : null,
              },
            ]}
          />

          {receipt.inputs && Object.keys(receipt.inputs).length > 0 && (
            <DetailSection title={t.tradeGovernance.decisionPayloadTitle}>
              <pre
                dir="ltr"
                className="overflow-x-auto rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs text-foreground"
              >
                {JSON.stringify(receipt.inputs, null, 2)}
              </pre>
            </DetailSection>
          )}
        </>
      ) : null}
    </div>
  );

  return canRead ? (
    content
  ) : (
    <PermissionGate require={POLICY_READ_PERMISSION}>{content}</PermissionGate>
  );
}
