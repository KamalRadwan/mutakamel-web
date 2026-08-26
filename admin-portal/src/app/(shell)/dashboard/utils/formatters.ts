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

export interface ToneColorStyle {
  iconColor: string;
  iconBg: string;
  topBorder: string;
  badgeBg: string;
  badgeText: string;
}

// Collapses the backend's 6-hue DashboardMetricTone onto the design
// system's 4 roles (brand/warn/danger/neutral) — docs/design-system: no
// fifth hue, and "in progress"/informational tones (blue, cyan, purple)
// are neutral, not decorative color, per the theme-flip rules.
export function toneToColorStyle(tone: string): ToneColorStyle {
  const role =
    tone === "amber" ? "warn" : tone === "green" ? "brand" : tone === "red" ? "danger" : "neutral";

  const byRole: Record<string, ToneColorStyle> = {
    warn: {
      iconColor: "text-warn-600 dark:text-warn-400",
      iconBg: "bg-warn-500/15 border border-warn-500/30",
      topBorder: "border-t-2 border-t-warn-500",
      badgeBg: "bg-warn-50 dark:bg-warn-950/50",
      badgeText: "text-warn-700 dark:text-warn-300",
    },
    brand: {
      iconColor: "text-brand-600 dark:text-brand-400",
      iconBg: "bg-brand-500/15 border border-brand-500/30",
      topBorder: "border-t-2 border-t-brand-500",
      badgeBg: "bg-brand-50 dark:bg-brand-950/50",
      badgeText: "text-brand-700 dark:text-brand-300",
    },
    danger: {
      iconColor: "text-danger-600 dark:text-danger-400",
      iconBg: "bg-danger-500/15 border border-danger-500/30",
      topBorder: "border-t-2 border-t-danger-500",
      badgeBg: "bg-danger-50 dark:bg-danger-950/50",
      badgeText: "text-danger-700 dark:text-danger-300",
    },
    neutral: {
      iconColor: "text-muted-foreground",
      iconBg: "bg-ink-500/15 border border-ink-500/30",
      topBorder: "border-t-2 border-t-ink-400",
      badgeBg: "bg-ink-100 dark:bg-ink-800",
      badgeText: "text-ink-700 dark:text-ink-300",
    },
  };

  return byRole[role];
}

export function toneToColorClass(tone: string): string {
  const style = toneToColorStyle(tone);
  return `${style.iconColor} ${style.iconBg}`;
}
