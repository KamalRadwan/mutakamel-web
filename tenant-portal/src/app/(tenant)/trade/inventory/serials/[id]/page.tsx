"use client";

import { use } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Clock,
  History,
  ScanBarcode,
  Warehouse,
} from "lucide-react";
import {
  Badge,
  Card,
  cn,
  DetailHeader,
  DetailSection,
  EmptyState,
  ErrorState,
  IdentifierText,
  NotFoundState,
  PermissionGate,
  SWATCH_SURFACE_PALETTES,
  Skeleton,
  Timeline,
} from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../../../trade-advanced-validation";
import { InventoryModuleSubnav } from "../../components/InventoryModuleSubnav";
import { INVENTORY_READ_PERMISSION } from "../../inventory-contract";
import { useInventorySerial } from "./hooks/useInventorySerial";

function serialTone(state: string): "positive" | "caution" | "negative" | "neutral" {
  if (state === "ON_HAND") return "positive";
  if (state === "RESERVED") return "caution";
  if (state === "VOIDED") return "negative";
  return "neutral";
}

export default function InventorySerialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t, lang, canRead, serial, isLoading, queryError, isNotFound, reload } =
    useInventorySerial(id);
  const isAr = lang === "ar";

  const content = (
    <div className="flex flex-col gap-4">
      <InventoryModuleSubnav active="serials" />

      <DetailHeader
        title={serial?.serialKey ?? t.tradeInventory.serialDetailTitle}
        subtitle={serial?.itemId}
        status={
          serial ? (
            <Badge tone={serialTone(serial.state)}>
              {tradeStatusLabel(t.tradeStatus, serial.state, t.common.unknownCode)}
            </Badge>
          ) : undefined
        }
        backLabel={t.tradeInventory.backToSerials}
        backHref={TENANT_ROUTES.tradeInventorySerials}
      />

      {isNotFound ? (
        <NotFoundState
          title={t.tradeInventory.serialNotFound}
          description={t.tradeInventory.serialNotFoundDescription}
          backLabel={t.tradeInventory.backToSerials}
          backHref={TENANT_ROUTES.tradeInventorySerials}
        />
      ) : isLoading ? (
        <Skeleton className="h-64" />
      ) : queryError ? (
        <ErrorState
          title={t.tradeInventory.serialLoadFailed}
          description={queryError.message}
          onRetry={() => void reload()}
          retryLabel={t.common.retry}
        />
      ) : serial ? (
        <>
          {/* 4-Card 360° Serial Custody KPI Strip */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div
              className={cn(
                "flex flex-col justify-between gap-2 rounded-lg border border-s-4 p-3.5",
                SWATCH_SURFACE_PALETTES.green.sectionCard,
                SWATCH_SURFACE_PALETTES.green.accentBorder,
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {t.tradeInventory.serialState}
                </span>
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg",
                    SWATCH_SURFACE_PALETTES.green.iconBoxIdle,
                  )}
                >
                  <ScanBarcode className="size-4" aria-hidden="true" />
                </span>
              </div>
              <span className="font-mono text-lg font-semibold text-foreground">
                {tradeStatusLabel(
                  t.tradeStatus,
                  serial.state,
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
                  {t.tradeInventory.currentNode}
                </span>
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg",
                    SWATCH_SURFACE_PALETTES.teal.iconBoxIdle,
                  )}
                >
                  <Warehouse className="size-4" aria-hidden="true" />
                </span>
              </div>
              <span className="font-mono text-sm font-semibold text-foreground">
                {serial.currentFulfillmentNodeId
                  ? `${serial.currentFulfillmentNodeId.slice(0, 12)}…`
                  : isAr
                    ? "خارج العهدة"
                    : "Dispatched / External"}
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
                  {t.tradeInventory.serialLifecycle}
                </span>
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg",
                    SWATCH_SURFACE_PALETTES.purple.iconBoxIdle,
                  )}
                >
                  <History className="size-4" aria-hidden="true" />
                </span>
              </div>
              <span className="font-mono text-xl font-semibold text-foreground">
                {serial.lifecycle.length} {isAr ? "حدث" : "events"}
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
                  {t.tradeInventory.lastTransitionAt}
                </span>
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg",
                    SWATCH_SURFACE_PALETTES.amber.iconBoxIdle,
                  )}
                >
                  <Clock className="size-4" aria-hidden="true" />
                </span>
              </div>
              <span className="text-xs font-semibold text-foreground">
                {formatDateTime(serial.lastTransitionAt, lang)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="flex flex-col gap-4 lg:col-span-5">
              <DetailSection
                title={t.tradeCommon.overview}
                emptyValueLabel={t.tradeCommon.notSet}
                fields={[
                  { label: t.tradeInventory.serialKey, value: serial.serialKey },
                  { label: t.tradeInventory.itemId, value: serial.itemId },
                  {
                    label: t.tradeInventory.itemCompanyProfileId,
                    value: serial.itemCompanyProfileId,
                  },
                  {
                    label: t.tradeInventory.currentNode,
                    value: serial.currentFulfillmentNodeId,
                  },
                  {
                    label: t.tradeInventory.lastTransitionAt,
                    value: formatDateTime(serial.lastTransitionAt, lang),
                  },
                ]}
              />

              {serial.currentFulfillmentNodeId ? (
                <Card className="flex items-center justify-between gap-3 border border-border/80 p-3.5">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-2xs text-muted-foreground">
                      {isAr ? "عقدة العهدة الحالية" : "Active Custody Node"}
                    </span>
                    <IdentifierText className="text-xs font-semibold">
                      {serial.currentFulfillmentNodeId}
                    </IdentifierText>
                  </div>
                  <Link
                    href={`${TENANT_ROUTES.tradeInventoryNodes}/${serial.currentFulfillmentNodeId}`}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
                  >
                    <span>{isAr ? "فتح العقدة" : "Inspect Node"}</span>
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </Card>
              ) : null}
            </div>

            <div className="flex flex-col gap-4 lg:col-span-7">
              <DetailSection title={t.tradeInventory.serialLifecycle}>
                {serial.lifecycle.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    <Timeline
                      label={t.tradeInventory.serialLifecycle}
                      events={serial.lifecycle.map((entry) => ({
                        id: entry.id,
                        title: tradeStatusLabel(
                          t.tradeStatus,
                          entry.eventType,
                          t.common.unknownCode,
                        ),
                        timestamp: formatDateTime(entry.occurredAt, lang),
                      }))}
                    />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {serial.lifecycle.map((entry, idx) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/20 p-2.5 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <Badge tone="brand">
                              #{idx + 1}
                            </Badge>
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground">
                                {tradeStatusLabel(
                                  t.tradeStatus,
                                  entry.eventType,
                                  t.common.unknownCode,
                                )}
                              </span>
                              <IdentifierText className="text-2xs text-muted-foreground">
                                {entry.id.slice(0, 12)}…
                              </IdentifierText>
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
                            <Activity className="size-3 text-primary" aria-hidden="true" />
                            {formatDateTime(entry.occurredAt, lang)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <EmptyState title={t.tradeInventory.serialLifecycleEmpty} />
                )}
              </DetailSection>
            </div>
          </div>
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

