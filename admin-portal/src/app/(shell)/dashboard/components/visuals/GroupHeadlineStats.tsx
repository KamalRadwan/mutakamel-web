"use client";

import { useI18n } from "@/i18n/I18nContext";
import type { DashboardMetric } from "@/types/dashboard";
import { formatDashboardMetric } from "../../utils/formatters";
import {
  resolveMetricDescription,
  resolveMetricLabel,
} from "../../utils/dashboard-copy";

/**
 * Up to three numbers, set inline with no card chrome, no icon, and no tone
 * fill. A number with no comparison is not a chart and should not pretend to
 * be one — the charts below carry every measure that has a relationship to
 * show, and this row carries the handful that do not.
 */
export function GroupHeadlineStats({
  cards,
  currencyCode = "USD",
}: {
  cards: DashboardMetric[];
  currencyCode?: string;
}) {
  const { lang, t } = useI18n();
  if (cards.length === 0) return null;

  return (
    <dl
      aria-label={t.dashboard.visuals.headlineAriaLabel}
      className="flex flex-wrap items-start gap-x-8 gap-y-2.5 rounded-lg border border-border bg-card p-3 sm:p-3.5"
    >
      {cards.map((card) => (
        <div key={card.key} className="min-w-36">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground rtl:normal-case rtl:tracking-normal">
            {resolveMetricLabel(card, lang, t)}
          </dt>
          <dd
            className="mt-0.5 font-mono text-xl font-semibold tabular-nums leading-none text-foreground sm:text-2xl"
            dir="auto"
          >
            {formatDashboardMetric(card, currencyCode, lang)}
          </dd>
          {card.description && (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {resolveMetricDescription(card, lang, t)}
            </p>
          )}
        </div>
      ))}
    </dl>
  );
}

/**
 * Which of a group's metrics survive as headline numbers. Cards whose value
 * is already an arc, a bar, or a gauge centre would only repeat the chart
 * beside them, so ratios and rendered "x / y" ratios are dropped first.
 */
export function selectHeadlineCards(
  cards: DashboardMetric[],
  limit = 3,
): DashboardMetric[] {
  const standalone = cards.filter(
    (card) => card.kind === "integer" || card.kind === "money",
  );
  return (standalone.length > 0 ? standalone : cards).slice(0, limit);
}
