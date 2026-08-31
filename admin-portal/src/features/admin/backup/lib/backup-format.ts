export function formatBackupDate(value?: string | null, locale = "en-US"): string {
  const fallback = locale.toLowerCase().startsWith("ar") ? "غير متاح" : "Not available";
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return new Intl.DateTimeFormat(resolveBackupLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
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
  const formattedAmount = new Intl.NumberFormat(resolveBackupLocale(locale), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
  return `${formattedAmount} ${units[unitIndex]}`;
}

export function formatBackupNumber(value: number, locale = "en-US"): string {
  return backupNumberFormatters[resolveBackupLocale(locale)].format(value);
}

export function shortBackupId(value: string): string {
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

export function isAmbiguousWriteFailure(status: number): boolean {
  return status === 0 || status >= 500;
}

export function shouldRetainBackupCommandKey(error: {
  httpStatus: number;
  errorCode: string;
}): boolean {
  return (
    error.httpStatus === 401 ||
    isAmbiguousWriteFailure(error.httpStatus) ||
    error.errorCode === "GW.IDEM.IN_FLIGHT"
  );
}

const backupNumberFormatters = {
  "en-US": new Intl.NumberFormat("en-US"),
  "ar-EG": new Intl.NumberFormat("ar-EG"),
} as const;

function resolveBackupLocale(locale: string): keyof typeof backupNumberFormatters {
  return locale.toLowerCase().startsWith("ar") ? "ar-EG" : "en-US";
}
