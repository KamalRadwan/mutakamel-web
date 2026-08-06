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

export function toneToColorClass(tone: string): string {
  switch (tone) {
    case "amber":
      return "text-amber-500 bg-amber-500/10";
    case "blue":
      return "text-blue-500 bg-blue-500/10";
    case "cyan":
      return "text-cyan-500 bg-cyan-500/10";
    case "green":
      return "text-emerald-500 bg-emerald-500/10";
    case "purple":
      return "text-purple-500 bg-purple-500/10";
    case "red":
      return "text-red-500 bg-red-500/10";
    default:
      return "text-slate-500 bg-slate-500/10";
  }
}
