"use client";

import {
  Badge,
  BarChart,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Money,
  StatCard,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { Language } from "@/i18n/useLanguage";
import { formatDecimalString, formatNumber } from "@/lib/format/number";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import type {
  DashboardPartition,
  DashboardScalar,
  WidgetExecutionResult,
} from "../analytics-contract";

interface WidgetTileProps {
  title: string;
  visualizationType: string;
  result: WidgetExecutionResult | undefined;
  lang: Language;
}

/**
 * One tile of a dashboard run.
 *
 * Six execution statuses have to render, not two. `READY` and `EMPTY` are
 * ordinary; `LIMITED` and `STALE` are answers with a caveat; `UNAVAILABLE` and
 * `FAILED` are refusals that arrive inside a **200** response, carrying
 * `errorCode: TRADE.DASHBOARD.EXECUTION_FAILED`. A grid that keys on the
 * request status alone renders a broken widget as loaded.
 */
export function WidgetTile({ title, visualizationType, result, lang }: WidgetTileProps) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <span className="flex items-center gap-2">
          <Badge tone="neutral">{tradeStatusLabel(t.tradeStatus, visualizationType, t.common.unknownCode)}</Badge>
          {result ? (
            <Badge tone={statusTone(result.status)}>
              {tradeStatusLabel(t.tradeStatus, result.status, t.common.unknownCode)}
            </Badge>
          ) : null}
        </span>
      </CardHeader>
      <CardContent>
        {!result ? (
          <EmptyState title={t.tradeAnalytics.tileNotRun} />
        ) : result.status === "FAILED" || result.status === "UNAVAILABLE" ? (
          <EmptyState
            title={
              result.status === "FAILED"
                ? t.tradeAnalytics.tileFailed
                : t.tradeAnalytics.tileUnavailable
            }
            description={result.errorCode ?? undefined}
          />
        ) : result.partitions.length === 0 || result.status === "EMPTY" ? (
          <EmptyState title={t.tradeAnalytics.tileEmpty} />
        ) : (
          <TileBody partition={result.partitions[0]} lang={lang} />
        )}
      </CardContent>
    </Card>
  );
}

function TileBody({ partition, lang }: { partition: DashboardPartition; lang: Language }) {
  const { t } = useI18n();
  const chartSeries = partition.series.filter((series) => series.points.length > 0);

  if (chartSeries.length > 0) {
    const first = chartSeries[0];
    return (
      <BarChart
        data={first.points.map((point) => ({
          label: point.key,
          // A chart axis is numeric by nature; the exact string stays on the
          // scalar path above, which is what money is read from.
          value: scalarToNumber(point.value),
        }))}
        xKey="label"
        series={[{ key: "value", label: first.key, role: "brand" }]}
        label={first.key}
        summary={t.tradeAnalytics.chartSummary}
        height={200}
      />
    );
  }

  if (partition.scalar === null) {
    return <EmptyState title={t.tradeAnalytics.tileEmpty} />;
  }

  // The scalar union, resolved: a COUNT metric is a number and everything
  // else — MONEY included — is an exact decimal string that never sees
  // Number().
  if (partition.scalar.kind === "count") {
    return (
      <StatCard
        label={t.tradeAnalytics.value}
        value={formatNumber(partition.scalar.value, lang)}
      />
    );
  }

  return partition.currencyCode ? (
    <p className="text-2xl">
      <Money
        value={partition.scalar.value}
        currency={partition.currencyCode}
        language={lang}
      />
    </p>
  ) : (
    <StatCard
      label={t.tradeAnalytics.value}
      value={formatDecimalString(partition.scalar.value, lang, { maximumFractionDigits: 8 })}
    />
  );
}

/**
 * Charts plot numbers, so a decimal string is converted **here and only here**.
 * The money path above never takes this route — the exact string is what
 * `Money` renders.
 */
function scalarToNumber(scalar: DashboardScalar | null): number {
  if (scalar === null) return 0;
  return scalar.kind === "count" ? scalar.value : Number(scalar.value);
}

function statusTone(status: string): "positive" | "caution" | "negative" | "neutral" {
  if (status === "READY") return "positive";
  if (status === "LIMITED" || status === "STALE") return "caution";
  if (status === "FAILED" || status === "UNAVAILABLE") return "negative";
  return "neutral";
}
