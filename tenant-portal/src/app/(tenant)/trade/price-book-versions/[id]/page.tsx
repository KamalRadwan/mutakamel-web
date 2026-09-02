"use client";

import { use } from "react";
import { FlaskConical, Send } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  DegradedBanner,
  DetailHeader,
  DetailSection,
  ErrorState,
  Money,
  NotFoundState,
  PermissionGate,
  Skeleton,
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
    { id: "itemId", header: t.tradePricing.itemId, cell: (entry) => entry.itemId },
    { id: "uomId", header: t.tradePricing.uomId, cell: (entry) => entry.uomId },
    {
      id: "minimumQuantity",
      header: t.tradePricing.minimumQuantity,
      numeric: true,
      cell: (entry) =>
        formatDecimalString(entry.minimumQuantity, lang, { maximumFractionDigits: 8 }),
    },
    {
      id: "unitPrice",
      header: t.tradePricing.unitPrice,
      numeric: true,
      // `numeric` on the wire: it stays a string all the way into Money.
      cell: (entry) => (
        <Money value={entry.unitPrice} currency={entry.currencyCode} language={lang} />
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
          />
        ),
    },
    {
      id: "priority",
      header: t.tradePricing.priority,
      numeric: true,
      cell: (entry) => String(entry.priority),
    },
  ];

  const promotionColumns: ColumnDef<PromotionRow>[] = [
    { id: "code", header: t.tradePricing.promotionCode, cell: (row) => row.code },
    { id: "name", header: t.tradePricing.promotionName, cell: (row) => row.name },
    {
      id: "status",
      header: t.common.status,
      cell: (row) => <Badge tone="neutral">{tradeStatusLabel(t.tradeStatus, row.status, t.common.unknownCode)}</Badge>,
    },
    { id: "stackGroup", header: t.tradePricing.stackGroup, cell: (row) => row.stackGroup },
    {
      id: "priority",
      header: t.tradePricing.priority,
      numeric: true,
      cell: (row) => String(row.priority),
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

  const content = (
    <div className="flex flex-col gap-4">
      <DetailHeader
        title={
          detail
            ? `${detail.book.code} · v${detail.version.versionNumber}`
            : t.tradePricing.versionDetailTitle
        }
        subtitle={detail?.book.currencyCode}
        status={
          detail ? (
            <Badge tone={detail.version.status === "PUBLISHED" ? "positive" : "neutral"}>
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
                variant="outline"
                disabled={!canTest || pending !== null}
                loading={pending === "test"}
                onClick={() => void test()}
              >
                <FlaskConical className="size-4" aria-hidden="true" />
                {t.tradePricing.runTest}
              </Button>
              <Button
                variant="outline"
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
              columns={entryColumns}
              rows={detail.entries}
              isLoading={false}
              rowKey={(entry) => entry.id}
              labels={tableLabels}
            />
          </DetailSection>

          <DetailSection title={t.tradePricing.promotions}>
            <DataTable
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
