import { DashboardMetric } from "@/types/dashboard";

export function formatDashboardMetric(
  metric: DashboardMetric | { kind: string; value: string | number },
  currencyCode = "USD",
  lang: "ar" | "en" = "en",
): string {
  const locale = lang === "ar" ? "ar-EG" : "en-US";

  if (metric.kind === "money") {
    const num = typeof metric.value === "string" ? parseFloat(metric.value) : metric.value;
    if (Number.isNaN(num)) return `${currencyCode} ${String(metric.value)}`;
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(num);
  }

  if (metric.kind === "percent" || metric.kind === "ratio") {
    const num = typeof metric.value === "string" ? parseFloat(metric.value) : metric.value;
    return new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(num);
  }

  return String(metric.value);
}

export type MetricTone = "brand" | "warn" | "danger" | "neutral";

// Collapses the backend's 6-hue DashboardMetricTone onto the design
// system's 4 roles (brand/warn/danger/neutral) — docs/design-system: no
// fifth hue, and "in progress"/informational tones (blue, cyan, purple)
// are neutral, not decorative color, per the theme-flip rules.
export function metricToneToRole(tone: string): MetricTone {
  if (tone === "amber") return "warn";
  if (tone === "green") return "brand";
  if (tone === "red") return "danger";
  return "neutral";
}
