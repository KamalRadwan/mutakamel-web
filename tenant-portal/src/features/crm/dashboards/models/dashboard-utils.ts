export type DashboardFormatOptions = {
  currency?: string;
  compact?: boolean;
  precision?: number;
  prefix?: string;
  suffix?: string;
};

export function formatDashboardValue(
  value: number | undefined | null,
  options?: DashboardFormatOptions
): string {
  if (value === undefined || value === null) return "-";

  const num = Number(value);
  if (isNaN(num)) return "-";

  const precision = options?.precision;
  const fractionDigits = precision !== undefined ? Math.max(0, Math.min(20, precision)) : undefined;

  let formatted = "";

  if (options?.currency) {
    formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: options.currency,
      notation: options.compact ? "compact" : "standard",
      minimumFractionDigits: fractionDigits ?? 0,
      maximumFractionDigits: fractionDigits ?? 2,
    }).format(num);
  } else {
    formatted = new Intl.NumberFormat("en-US", {
      notation: options?.compact ? "compact" : "standard",
      minimumFractionDigits: fractionDigits ?? 0,
      maximumFractionDigits: fractionDigits ?? (options?.compact ? 1 : 2),
    }).format(num);
  }

  const prefix = options?.prefix ?? "";
  const suffix = options?.suffix ?? "";

  return `${prefix}${formatted}${suffix}`;
}
