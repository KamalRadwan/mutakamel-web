"use client";

import { use } from "react";
import {
  CheckCircle2,
  FlaskConical,
  Layers,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  DegradedBanner,
  DetailHeader,
  DetailSection,
  ErrorState,
  IdentifierText,
  Money,
  NotFoundState,
  PermissionGate,
  SWATCH_SURFACE_PALETTES,
  Skeleton,
  cn,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { formatDecimalString } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import {
  PRICING_READ_PERMISSION,
  type PriceEntry,
  type PromotionRow,
} from "../../price-books/pricing-contract";
import { usePriceBookVersion } from "./hooks/usePriceBookVersion";

export default function PriceBookVersionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useI18n();
  const {
    lang,
    canRead,
    canTest,
    canPublish,
    detail,
    isLoading,
    queryError,
    isNotFound,
    pending,
    test,
    publish,
    reload,
  } = usePriceBookVersion(id);

  const entryColumns: ColumnDef<PriceEntry>[] = [
    {
      id: "itemId",
      header: t.tradePricing.itemId,
      cell: (entry) => (
        <IdentifierText className="text-xs font-semibold text-foreground">
          {entry.itemId}
        </IdentifierText>
      ),
    },
    {
      id: "uomId",
      header: t.tradePricing.uomId,
      cell: (entry) => <IdentifierText className="text-xs">{entry.uomId}</IdentifierText>,
    },
    {
      id: "minimumQuantity",
      header: t.tradePricing.minimumQuantity,
      numeric: true,
      cell: (entry) =>
        formatDecimalString(entry.minimumQuantity, lang, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 8,
        }),
    },
    {
      id: "maximumQuantity",
      header: t.tradePricing.maximumQuantity,
      numeric: true,
      cell: (entry) =>
        entry.maximumQuantity === null
          ? "∞"
          : formatDecimalString(entry.maximumQuantity, lang, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 8,
            }),
    },
    {
      id: "unitPrice",
      header: t.tradePricing.unitPrice,
      numeric: true,
      cell: (entry) => (
        <Money
          value={entry.unitPrice}
          currency={entry.currencyCode}
          language={lang}
          minimumFractionDigits={2}
          maximumFractionDigits={8}
        />
      ),
    },
    {
      id: "minimumAllowedPrice",
      header: t.tradePricing.minimumAllowedPrice,
      numeric: true,
      cell: (entry) =>
        entry.minimumAllowedPrice === null ? (
          "—"
        ) : (
          <Money
            value={entry.minimumAllowedPrice}
            currency={entry.currencyCode}
            language={lang}
            minimumFractionDigits={2}
            maximumFractionDigits={8}
          />
        ),
    },
    {
      id: "priority",
      header: t.tradePricing.priority,
      numeric: true,
      cell: (entry) => <IdentifierText className="tabular-nums">{String(entry.priority)}</IdentifierText>,
    },
  ];

  const promotionColumns: ColumnDef<PromotionRow>[] = [
    {
      id: "code",
      header: t.tradePricing.promotionCode,
      cell: (row) => (
        <IdentifierText className="text-xs font-semibold text-foreground">{row.code}</IdentifierText>
      ),
    },
    { id: "name", header: t.tradePricing.promotionName, cell: (row) => row.name },
    {
      id: "status",
      header: t.common.status,
      cell: (row) => (
        <Badge tone={row.status === "ACTIVE" ? "positive" : "neutral"}>
          {tradeStatusLabel(t.tradeStatus, row.status, t.common.unknownCode)}
        </Badge>
      ),
    },
    {
      id: "stackGroup",
      header: t.tradePricing.stackGroup,
      cell: (row) => <IdentifierText className="text-xs">{row.stackGroup}</IdentifierText>,
    },
    {
      id: "exclusive",
      header: t.tradePricing.exclusive,
      cell: (row) => (
        <Badge tone={row.exclusive ? "caution" : "neutral"}>
          {row.exclusive ? t.tradePricing.exclusive : "—"}
        </Badge>
      ),
    },
    {
      id: "priority",
      header: t.tradePricing.priority,
      numeric: true,
      cell: (row) => <IdentifierText className="tabular-nums">{String(row.priority)}</IdentifierText>,
    },
  ];

  const tableLabels = {
    retry: t.common.retry,
    errorTitle: t.tradePricing.versionLoadFailed,
    emptyTitle: t.tradePricing.noEntries,
    selectAll: t.common.actions,
    selectRow: t.common.actions,
    sortAscending: t.common.actions,
    sortDescending: t.common.actions,
    notSorted: t.common.actions,
    pagination: {
      previous: t.common.previousPage,
      next: t.common.nextPage,
      summary: (from: number, to: number, total: number) =>
        formatTemplate(t.common.showingOf, { from, to, total }),
    },
  };

  const floorProtectedCount = detail
    ? detail.entries.filter((e) => e.minimumAllowedPrice !== null).length
    : 0;

  const content = (
    <div className="flex flex-col gap-4">
      <DetailHeader
        title={
          detail
            ? `${detail.book.code} · v${detail.version.versionNumber}`
            : t.tradePricing.versionDetailTitle
        }
        subtitle={detail ? `${detail.book.purpose} · ${detail.book.currencyCode}` : undefined}
        status={
          detail ? (
            <Badge
              tone={
                detail.version.status === "PUBLISHED"
                  ? "positive"
                  : detail.version.status === "TESTED"
                    ? "brand"
                    : "neutral"
              }
            >
              {tradeStatusLabel(t.tradeStatus, detail.version.status, t.common.unknownCode)}
            </Badge>
          ) : undefined
        }
        backLabel={t.tradePricing.backToBooks}
        backHref={TENANT_ROUTES.tradePriceBooks}
        secondaryActions={
          detail ? (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={!canTest || pending !== null}
                loading={pending === "test"}
                onClick={() => void test()}
              >
                <FlaskConical className="size-4" aria-hidden="true" />
                {t.tradePricing.runTest}
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={!canPublish || pending !== null}
                loading={pending === "publish"}
                onClick={() => void publish()}
              >
                <Send className="size-4" aria-hidden="true" />
                {t.tradeCommon.publish}
              </Button>
            </>
          ) : undefined
        }
      />

      {isNotFound ? (
        <NotFoundState
          title={t.tradePricing.versionNotFound}
          description={t.tradePricing.versionNotFoundDescription}
          backLabel={t.tradePricing.backToBooks}
          backHref={TENANT_ROUTES.tradePriceBooks}
        />
      ) : isLoading ? (
        <Skeleton className="h-80" />
      ) : queryError ? (
        <ErrorState
          title={t.tradePricing.versionLoadFailed}
          description={queryError.message}
          onRetry={() => void reload()}
          retryLabel={t.common.retry}
        />
      ) : detail ? (
        <>
          {canPublish ? null : (
            <DegradedBanner message={t.tradePricing.publishNeedsPolicyGrant} />
          )}

          {/* 4-Card Version Dossier KPI Strip */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div
              className={cn(
                "flex items-start justify-between gap-3 rounded-lg border border-s-4 bg-card p-3.5 shadow-2xs",
                SWATCH_SURFACE_PALETTES.indigo.accentBorder,
              )}
            >
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t.tradePricing.versionKpiEntries}
                </span>
                <IdentifierText className="text-xl font-semibold tabular-nums text-foreground">
                  {String(detail.entries.length)}
                </IdentifierText>
                <span className="text-xs text-muted-foreground">{detail.book.currencyCode}</span>
              </div>
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg border",
                  SWATCH_SURFACE_PALETTES.indigo.iconBoxIdle,
                )}
              >
                <Layers className="size-4" aria-hidden="true" />
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
                  {t.tradePricing.versionKpiPromotions}
                </span>
                <IdentifierText className="text-xl font-semibold tabular-nums text-foreground">
                  {String(detail.promotions.length)}
                </IdentifierText>
                <span className="text-xs text-muted-foreground">{t.tradePricing.promotions}</span>
              </div>
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg border",
                  SWATCH_SURFACE_PALETTES.purple.iconBoxIdle,
                )}
              >
                <Sparkles className="size-4" aria-hidden="true" />
              </span>
            </div>

            <div
              className={cn(
                "flex items-start justify-between gap-3 rounded-lg border border-s-4 bg-card p-3.5 shadow-2xs",
                SWATCH_SURFACE_PALETTES.amber.accentBorder,
              )}
            >
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t.tradePricing.versionKpiFloorProtected}
                </span>
                <IdentifierText className="text-xl font-semibold tabular-nums text-foreground">
                  {`${floorProtectedCount} / ${detail.entries.length}`}
                </IdentifierText>
                <span className="text-xs text-muted-foreground">
                  {t.tradePricing.minimumAllowedPrice}
                </span>
              </div>
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg border",
                  SWATCH_SURFACE_PALETTES.amber.iconBoxIdle,
                )}
              >
                <ShieldCheck className="size-4" aria-hidden="true" />
              </span>
            </div>

            <div
              className={cn(
                "flex items-start justify-between gap-3 rounded-lg border border-s-4 bg-card p-3.5 shadow-2xs",
                detail.latestTestEvidence?.passed
                  ? SWATCH_SURFACE_PALETTES.green.accentBorder
                  : SWATCH_SURFACE_PALETTES.blue.accentBorder,
              )}
            >
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t.tradePricing.versionKpiGovernance}
                </span>
                <span className="text-base font-semibold text-foreground">
                  {tradeStatusLabel(t.tradeStatus, detail.version.status, t.common.unknownCode)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {detail.latestTestEvidence
                    ? `${detail.latestTestEvidence.passed ? t.tradePricing.testPassedShort : t.tradePricing.testFailedShort}`
                    : t.tradeCommon.notSet}
                </span>
              </div>
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg border",
                  detail.latestTestEvidence?.passed
                    ? SWATCH_SURFACE_PALETTES.green.iconBoxIdle
                    : SWATCH_SURFACE_PALETTES.blue.iconBoxIdle,
                )}
              >
                <CheckCircle2 className="size-4" aria-hidden="true" />
              </span>
            </div>
          </div>

          <DetailSection
            title={t.tradeCommon.overview}
            emptyValueLabel={t.tradeCommon.notSet}
            fields={[
              {
                label: t.tradePricing.effectiveFrom,
                value: formatDateTime(detail.version.effectiveFrom, lang),
              },
              {
                label: t.tradePricing.effectiveTo,
                value: detail.version.effectiveTo
                  ? formatDateTime(detail.version.effectiveTo, lang)
                  : null,
              },
              { label: t.tradeCommon.version, value: String(detail.version.version) },
              {
                label: t.tradePricing.checksumLabel,
                value: (
                  <IdentifierText className="text-xs">{detail.version.checksum}</IdentifierText>
                ),
              },
              {
                label: t.tradePricing.lastTest,
                value: detail.latestTestEvidence
                  ? `${
                      detail.latestTestEvidence.passed
                        ? t.tradePricing.testPassedShort
                        : t.tradePricing.testFailedShort
                    } · ${formatDateTime(detail.latestTestEvidence.testedAt, lang)}`
                  : null,
              },
            ]}
          />

          <DetailSection title={t.tradePricing.entries}>
            <DataTable
              density="compact"
              columns={entryColumns}
              rows={detail.entries}
              isLoading={false}
              rowKey={(entry) => entry.id}
              labels={tableLabels}
            />
          </DetailSection>

          <DetailSection title={t.tradePricing.promotions}>
            <DataTable
              density="compact"
              columns={promotionColumns}
              rows={detail.promotions}
              isLoading={false}
              rowKey={(row) => row.id}
              labels={{ ...tableLabels, emptyTitle: t.tradePricing.noPromotions }}
            />
          </DetailSection>
        </>
      ) : null}
    </div>
  );

  return canRead ? (
    content
  ) : (
    <PermissionGate require={PRICING_READ_PERMISSION}>{content}</PermissionGate>
  );
}
