import type { NormalizedApiError } from "@/shared/api/normalized-api-error";

// HTML pattern attributes use Unicode Sets (`v`), where literal hyphens must be escaped.
export const STORAGE_SERVER_DNS_LABEL_PATTERN =
  "[a-z0-9](?:[a-z0-9\\-]{0,61}[a-z0-9])?";

export function isSecureStorageEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/" &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

export function shouldResetStorageServerWriteKey(
  error: Pick<NormalizedApiError, "httpStatus" | "errorCode">,
): boolean {
  return (
    error.httpStatus >= 400 &&
    error.httpStatus < 500 &&
    error.httpStatus !== 401 &&
    error.errorCode !== "GW.IDEM.IN_FLIGHT" &&
    error.errorCode !== "STORAGE_SERVER_PROBE_IN_PROGRESS" &&
    error.errorCode !== "STORAGE_SERVER_REGISTRATION_IN_PROGRESS"
  );
}

export function requiresStorageRuntimeSetup(
  error: Pick<NormalizedApiError, "errorCode">,
): boolean {
  return (
    error.errorCode === "CORE.STORAGE_RUNTIME.NOT_CONFIGURED" ||
    error.errorCode === "CORE.STORAGE.RUNTIME_KEY_UNAVAILABLE" ||
    error.errorCode === "CORE.STORAGE_RUNTIME.DISABLED"
  );
}

export function probeFreshnessPercent(
  testedAt: string | null,
  expiresAt: string | null,
  now = Date.now(),
): number {
  if (!testedAt || !expiresAt) return 0;
  const tested = Date.parse(testedAt);
  const expires = Date.parse(expiresAt);
  if (!Number.isFinite(tested) || !Number.isFinite(expires) || expires <= tested) {
    return 0;
  }
  return Math.max(0, Math.min(100, ((expires - now) / (expires - tested)) * 100));
}
