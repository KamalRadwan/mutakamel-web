import { DashboardMetric } from "@/types/dashboard";

export function formatDashboardMetric(
  metric: DashboardMetric | { kind: string; value: string | number },
  currencyCode = "USD",
): string {
  if (metric.kind === "money") {
    return `${currencyCode} ${String(metric.value)}`;
  }

  if (metric.kind === "percent" || metric.kind === "ratio") {
    const num = typeof metric.value === "string" ? parseFloat(metric.value) : metric.value;
    return new Intl.NumberFormat(undefined, {
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

export function toneToColorStyle(tone: string): ToneColorStyle {
  switch (tone) {
    case "amber":
      return {
        iconColor: "text-amber-500 dark:text-amber-400",
        iconBg: "bg-amber-500/15 border border-amber-500/30 dark:bg-amber-500/20",
        topBorder: "border-t-2 border-t-amber-500",
        badgeBg: "bg-amber-50 dark:bg-amber-950/50",
        badgeText: "text-amber-700 dark:text-amber-300",
      };
    case "blue":
      return {
        iconColor: "text-blue-500 dark:text-blue-400",
        iconBg: "bg-blue-500/15 border border-blue-500/30 dark:bg-blue-500/20",
        topBorder: "border-t-2 border-t-blue-500",
        badgeBg: "bg-blue-50 dark:bg-blue-950/50",
        badgeText: "text-blue-700 dark:text-blue-300",
      };
    case "cyan":
      return {
        iconColor: "text-cyan-500 dark:text-cyan-400",
        iconBg: "bg-cyan-500/15 border border-cyan-500/30 dark:bg-cyan-500/20",
        topBorder: "border-t-2 border-t-cyan-500",
        badgeBg: "bg-cyan-50 dark:bg-cyan-950/50",
        badgeText: "text-cyan-700 dark:text-cyan-300",
      };
    case "green":
      return {
        iconColor: "text-emerald-500 dark:text-emerald-400",
        iconBg: "bg-emerald-500/15 border border-emerald-500/30 dark:bg-emerald-500/20",
        topBorder: "border-t-2 border-t-emerald-500",
        badgeBg: "bg-emerald-50 dark:bg-emerald-950/50",
        badgeText: "text-emerald-700 dark:text-emerald-300",
      };
    case "purple":
      return {
        iconColor: "text-purple-500 dark:text-purple-400",
        iconBg: "bg-purple-500/15 border border-purple-500/30 dark:bg-purple-500/20",
        topBorder: "border-t-2 border-t-purple-500",
        badgeBg: "bg-purple-50 dark:bg-purple-950/50",
        badgeText: "text-purple-700 dark:text-purple-300",
      };
    case "red":
      return {
        iconColor: "text-rose-500 dark:text-rose-400",
        iconBg: "bg-rose-500/15 border border-rose-500/30 dark:bg-rose-500/20",
        topBorder: "border-t-2 border-t-rose-500",
        badgeBg: "bg-rose-50 dark:bg-rose-950/50",
        badgeText: "text-rose-700 dark:text-rose-300",
      };
    default:
      return {
        iconColor: "text-indigo-500 dark:text-indigo-400",
        iconBg: "bg-indigo-500/15 border border-indigo-500/30 dark:bg-indigo-500/20",
        topBorder: "border-t-2 border-t-indigo-500",
        badgeBg: "bg-slate-100 dark:bg-slate-800",
        badgeText: "text-slate-700 dark:text-slate-300",
      };
  }
}

export function toneToColorClass(tone: string): string {
  const style = toneToColorStyle(tone);
  return `${style.iconColor} ${style.iconBg}`;
}
