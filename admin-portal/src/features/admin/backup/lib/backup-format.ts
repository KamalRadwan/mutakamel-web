export function formatBackupDate(value?: string | null, locale = "en-US"): string {
  const fallback = locale.toLowerCase().startsWith("ar") ? "غير متاح" : "Not available";
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function formatBackupBytes(value?: string | null, locale = "en-US"): string {
  const fallback = locale.toLowerCase().startsWith("ar") ? "غير متاح" : "Not available";
  if (!value) return fallback;
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return fallback;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let amount = bytes;
  let unitIndex = 0;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }
  const digits = amount >= 10 || unitIndex === 0 ? 0 : 1;
  return `${amount.toFixed(digits)} ${units[unitIndex]}`;
}

export function shortBackupId(value: string): string {
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

export function isAmbiguousWriteFailure(status: number): boolean {
  return status === 0 || status >= 500;
}
