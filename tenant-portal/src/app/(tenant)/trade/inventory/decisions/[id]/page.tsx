"use client";

import { use } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FileSearch,
  Gavel,
  Layers,
  ShieldAlert,
} from "lucide-react";
import {
  Badge,
  Card,
  cn,
  DetailHeader,
  DetailSection,
  ErrorState,
  IdentifierText,
  NotFoundState,
  PermissionGate,
  SWATCH_SURFACE_PALETTES,
  Skeleton,
} from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../../../trade-advanced-validation";
import { InventoryModuleSubnav } from "../../components/InventoryModuleSubnav";
import { INVENTORY_READ_PERMISSION } from "../../inventory-contract";
import { useInventoryDecision } from "./hooks/useInventoryDecision";

function outcomeTone(outcome: string | null): "positive" | "negative" | "caution" | "neutral" {
  if (outcome === "ALLOW") return "positive";
  if (outcome === "BLOCK" || outcome === "DENY") return "negative";
  if (outcome) return "caution";
  return "neutral";
}

function resolveAggregateRoute(decisionType: string, aggregateType: string): string {
  const combined = `${decisionType} ${aggregateType}`.toUpperCase();
  if (combined.includes("PERIOD")) return TENANT_ROUTES.tradeInventoryPeriods;
  if (combined.includes("UOM") || combined.includes("CONVERSION")) {
    return TENANT_ROUTES.tradeInventoryUomConversions;
  }
  if (combined.includes("SERIAL")) return TENANT_ROUTES.tradeInventorySerials;
  return TENANT_ROUTES.tradeInventoryMovements;
}

export default function InventoryDecisionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t, lang, canRead, decision, isLoading, queryError, isNotFound, reload } =
    useInventoryDecision(id);
  const isAr = lang === "ar";

  const content = (
    <div className="flex flex-col gap-4">
      <InventoryModuleSubnav active="decisions" />

      <DetailHeader
        title={t.tradeInventory.decisionDetailTitle}
        subtitle={
          decision
            ? tradeStatusLabel(
                t.tradeStatus,
                decision.decisionType,
                t.common.unknownCode,
              )
            : undefined
        }
        status={
          decision?.outcome ? (
            <Badge tone={outcomeTone(decision.outcome)}>
              {tradeStatusLabel(
                t.tradeStatus,
                decision.outcome,
                t.common.unknownCode,
              )}
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
        <>
          {/* 4-Card 360° Forensic KPI Strip */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div
              className={cn(
                "flex flex-col justify-between gap-2 rounded-lg border border-s-4 p-3.5",
                decision.outcome === "ALLOW"
                  ? SWATCH_SURFACE_PALETTES.green.sectionCard
                  : SWATCH_SURFACE_PALETTES.red.sectionCard,
                decision.outcome === "ALLOW"
                  ? SWATCH_SURFACE_PALETTES.green.accentBorder
                  : SWATCH_SURFACE_PALETTES.red.accentBorder,
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {t.tradeInventory.outcome}
                </span>
                {decision.outcome === "ALLOW" ? (
                  <CheckCircle2 className="size-4 text-positive-600" aria-hidden="true" />
                ) : (
                  <ShieldAlert className="size-4 text-negative-600" aria-hidden="true" />
                )}
              </div>
              <span className="font-mono text-lg font-semibold text-foreground">
                {decision.outcome
                  ? tradeStatusLabel(
                      t.tradeStatus,
                      decision.outcome,
                      t.common.unknownCode,
                    )
                  : "—"}
              </span>
            </div>

            <div
              className={cn(
                "flex flex-col justify-between gap-2 rounded-lg border border-s-4 p-3.5",
                SWATCH_SURFACE_PALETTES.purple.sectionCard,
                SWATCH_SURFACE_PALETTES.purple.accentBorder,
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {t.tradeInventory.decisionType}
                </span>
                <Gavel className="size-4 text-brand-600" aria-hidden="true" />
              </div>
              <span className="text-xs font-semibold text-foreground">
                {tradeStatusLabel(
                  t.tradeStatus,
                  decision.decisionType,
                  t.common.unknownCode,
                )}
              </span>
            </div>

            <div
              className={cn(
                "flex flex-col justify-between gap-2 rounded-lg border border-s-4 p-3.5",
                SWATCH_SURFACE_PALETTES.teal.sectionCard,
                SWATCH_SURFACE_PALETTES.teal.accentBorder,
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {t.tradeInventory.aggregateType}
                </span>
                <Layers className="size-4 text-positive-600" aria-hidden="true" />
              </div>
              <span className="text-xs font-semibold text-foreground">
                {tradeStatusLabel(
                  t.tradeStatus,
                  decision.aggregateType,
                  t.common.unknownCode,
                )}
              </span>
            </div>

            <div
              className={cn(
                "flex flex-col justify-between gap-2 rounded-lg border border-s-4 p-3.5",
                SWATCH_SURFACE_PALETTES.amber.sectionCard,
                SWATCH_SURFACE_PALETTES.amber.accentBorder,
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {t.tradeInventory.evaluatedAt}
                </span>
                <Clock className="size-4 text-caution-600" aria-hidden="true" />
              </div>
              <span className="text-xs font-semibold text-foreground">
                {formatDateTime(decision.evaluatedAt, lang)}
              </span>
            </div>
          </div>

          {/* Forensic Explanation Callout Card */}
          {decision.explanationCode || decision.explanation ? (
            <Card className="flex flex-col gap-2 border border-border/80 bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <FileSearch className="size-4 text-primary" aria-hidden="true" />
                  {t.tradeInventory.explanationCode}
                </span>
                {decision.explanationCode ? (
                  <IdentifierText className="rounded-md border border-border bg-card px-2.5 py-0.5 text-xs font-semibold">
                    {decision.explanationCode}
                  </IdentifierText>
                ) : null}
              </div>
              {decision.explanation ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {decision.explanation}
                </p>
              ) : null}
            </Card>
          ) : null}

          <DetailSection
            title={t.tradeCommon.overview}
            description={t.tradeInventory.decisionProjectionNote}
            emptyValueLabel={t.tradeCommon.notSet}
            fields={[
              {
                label: t.tradeInventory.aggregateType,
                value: tradeStatusLabel(
                  t.tradeStatus,
                  decision.aggregateType,
                  t.common.unknownCode,
                ),
              },
              { label: t.tradeInventory.aggregateId, value: decision.aggregateId },
              {
                label: t.tradeInventory.explanationCode,
                value: decision.explanationCode,
              },
              {
                label: t.tradeInventory.explanation,
                value: decision.explanation,
                wide: true,
              },
              {
                label: t.tradeInventory.evaluatedAt,
                value: formatDateTime(decision.evaluatedAt, lang),
              },
              { label: t.errors.reference, value: decision.correlationId },
            ]}
          />

          {/* Guided Remediation & Domain Navigation Card */}
          <Card className="flex flex-wrap items-center justify-between gap-3 border border-border/80 p-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-foreground">
                {isAr
                  ? "الانتقال إلى وحدة الحوكمة المرتبطة"
                  : "Navigate to Evaluated Governance Domain"}
              </span>
              <span className="text-2xs text-muted-foreground">
                {isAr
                  ? "راجع حالة الفترة المحاسبية أو معادلة التحويل أو الرقم التسلسلي المرتبط بهذا القرار"
                  : "Inspect the related Period, UOM Conversion, Serial, or Movement workspace for this aggregate"}
              </span>
            </div>
            <Link
              href={resolveAggregateRoute(
                decision.decisionType,
                decision.aggregateType,
              )}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-2xs transition-colors hover:bg-primary/90"
            >
              <span>
                {isAr ? "فتح وحدة الحوكمة" : "Open Governance Workspace"}
              </span>
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Card>
        </>
      ) : null}
    </div>
  );

  return canRead ? (
    content
  ) : (
    <PermissionGate require={INVENTORY_READ_PERMISSION}>{content}</PermissionGate>
  );
}

