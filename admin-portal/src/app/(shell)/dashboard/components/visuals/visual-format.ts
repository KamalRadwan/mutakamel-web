import type { Language } from "@/i18n/I18nContext";
import type {
  DashboardMetricTone,
  DashboardVisualPoint,
  DashboardVisualUnit,
} from "@/types/dashboard";
import {
  CHART_COLORS,
  DASHBOARD_CHART_VISUAL_ITEM_LIMIT,
  formatChartCurrency,
  formatChartNumber,
  formatChartPercent,
  qualitativeColor,
  STATUS_TONE_COLOR,
} from "../charts/ChartAccessibility";

/**
 * Formats a raw measure using the unit the payload declared, instead of
 * guessing from the field name the way the old ReportValue did.
 */
export function formatVisualValue(
  lang: Language,
  value: number,
  unit: DashboardVisualUnit,
  currencyCode = "USD",
): string {
  if (!Number.isFinite(value)) return "—";
  switch (unit) {
    case "usd":
      return formatChartCurrency(lang, value, currencyCode);
    case "ratio":
      return formatChartPercent(lang, value);
    case "seconds":
      return formatDuration(lang, value);
    case "bytes":
      return formatBytes(lang, value);
    default:
      return formatChartNumber(lang, value);
  }
}

/** Compact axis ticks — full precision stays in the exact-value table. */
export function formatVisualTick(
  lang: Language,
  value: number,
  unit: DashboardVisualUnit,
  currencyCode = "USD",
): string {
  if (!Number.isFinite(value)) return "";
  if (unit === "ratio") return formatChartPercent(lang, value, 0);
  if (unit === "seconds") return formatDuration(lang, value);
  if (unit === "bytes") return formatBytes(lang, value);
  const magnitude = Math.abs(value);
  if (magnitude >= 1000) {
    // Compact currency has to go through one formatter. Formatting the
    // number and prepending the symbol put it on the wrong side in Arabic,
    // where the currency follows the amount.
    if (unit === "usd") {
      try {
        return formatChartNumber(lang, value, {
          style: "currency",
          currency: currencyCode,
          notation: "compact",
          maximumFractionDigits: 1,
        });
      } catch {
        return formatChartCurrency(lang, value, currencyCode);
      }
    }
    return formatChartNumber(lang, value, {
      notation: "compact",
      maximumFractionDigits: 1,
    });
  }
  return unit === "usd"
    ? formatChartCurrency(lang, value, currencyCode)
    : formatChartNumber(lang, value);
}

export function formatDuration(lang: Language, seconds: number): string {
  if (!Number.isFinite(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${formatChartNumber(lang, total)}s`;
  if (total < 3600) {
    return `${formatChartNumber(lang, Math.round(total / 60))}m`;
  }
  if (total < 86_400) {
    return `${formatChartNumber(lang, Math.round((total / 3600) * 10) / 10)}h`;
  }
  return `${formatChartNumber(lang, Math.round(total / 86_400))}d`;
}

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;

export function formatBytes(lang: Language, bytes: number): string {
  if (!Number.isFinite(bytes)) return "—";
  let value = Math.max(0, bytes);
  let index = 0;
  while (value >= 1024 && index < BYTE_UNITS.length - 1) {
    value /= 1024;
    index += 1;
  }
  const digits = index === 0 || value >= 100 ? 0 : 1;
  return `${formatChartNumber(lang, Math.round(value * 10 ** digits) / 10 ** digits)} ${BYTE_UNITS[index]}`;
}

/**
 * Status data uses the semantic roles; unrelated categories walk the
 * validated qualitative ramp. Never generate a hue outside those two sets.
 */
export function visualColor(
  index: number,
  tone: DashboardMetricTone | undefined,
): string {
  if (!tone) return qualitativeColor(index);
  const semantic = STATUS_TONE_COLOR[tone];
  return semantic === CHART_COLORS.neutral ? qualitativeColor(index) : semantic;
}

export function bandColor(tone: "green" | "amber" | "red"): string {
  if (tone === "green") return CHART_COLORS.success;
  if (tone === "amber") return CHART_COLORS.warning;
  return CHART_COLORS.danger;
}

const OTHER_KEY = "__other__";

/**
 * Keeps the SVG bounded at 12 marks by folding the tail into one "Other"
 * point. The exact-value table always receives the unfolded list.
 */
export function foldVisualPoints(
  points: DashboardVisualPoint[],
  otherLabel: string,
  limit = DASHBOARD_CHART_VISUAL_ITEM_LIMIT,
): DashboardVisualPoint[] {
  if (points.length <= limit) return points;
  const head = points.slice(0, limit - 1);
  const tail = points.slice(limit - 1);
  const rest = tail.reduce((sum, point) => sum + point.value, 0);
  return [...head, { key: OTHER_KEY, label: otherLabel, value: rest }];
}

export function sortPointsDescending(
  points: DashboardVisualPoint[],
): DashboardVisualPoint[] {
  return [...points].sort((a, b) => b.value - a.value);
}

export function sumPoints(points: DashboardVisualPoint[]): number {
  return points.reduce((sum, point) => sum + point.value, 0);
}

export function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
