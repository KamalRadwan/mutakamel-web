import { axiosClient, unwrapCoreData, withAuthLock } from "../api/axiosClient";

export interface MfaStep {
  mfaRequired: true;
  challengeId: string;
  expiresIn: number;
  resendAfterSeconds: number;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

/** Core common/auth/mfa/mfa.dto.ts and mfa.types.ts; never project the nonce. */
export function readMfaStep(response: unknown): MfaStep | null {
  const value = record(unwrapCoreData<unknown>(response));
  if (!value || !("mfaRequired" in value)) return null;
  if (value.mfaRequired !== true ||
      typeof value.challengeId !== "string" || !/^[A-Za-z0-9_-]{43}$/u.test(value.challengeId) ||
      typeof value.expiresIn !== "number" || !Number.isInteger(value.expiresIn) ||
      value.expiresIn < 0 || value.expiresIn > 600 ||
      typeof value.resendAfterSeconds !== "number" || !Number.isInteger(value.resendAfterSeconds) ||
      value.resendAfterSeconds < 0) {
    throw new Error("INVALID_MFA_RESPONSE");
  }
  return { mfaRequired: true, challengeId: value.challengeId,
    expiresIn: value.expiresIn, resendAfterSeconds: value.resendAfterSeconds };
}

export const mfaRequestOptions = {
  skipAuthRefresh: true,
  skipAutoIdempotency: true,
  nonReplayable: true,
  cache: "no-store",
} as const;

export async function readMfaSettings(): Promise<boolean> {
  const response = await axiosClient.get("/api/admin/core/v1/auth/me", { cache: "no-store" });
  const value = record(unwrapCoreData<unknown>(response.data));
  if (!value || typeof value.mfaEnabled !== "boolean" ||
      !(value.mfaUpdatedAt === null ||
        (typeof value.mfaUpdatedAt === "string" && Number.isFinite(Date.parse(value.mfaUpdatedAt))))) {
    throw new Error("INVALID_MFA_SETTINGS");
  }
  return value.mfaEnabled;
}

export async function startMfaSettings(enabled: boolean, currentPassword: string): Promise<MfaStep> {
  return withAuthLock(async () => {
    const response = await axiosClient.post("/api/admin/core/v1/auth/mfa/settings/challenge",
      { enabled, currentPassword }, { ...mfaRequestOptions });
    return requireMfaStep(response.data);
  });
}

export async function resendMfa(challengeId: string, settings = false): Promise<MfaStep> {
  return withAuthLock(async () => {
    const response = await axiosClient.post(settings
      ? "/api/admin/core/v1/auth/mfa/settings/resend"
      : "/api/admin/core/v1/auth/mfa/resend",
    { challengeId }, { ...mfaRequestOptions });
    return requireMfaStep(response.data);
  });
}

export async function confirmMfaSettings(challengeId: string, code: string): Promise<void> {
  await withAuthLock(async () => {
    const response = await axiosClient.post("/api/admin/core/v1/auth/mfa/settings/confirm",
      { challengeId, code }, { ...mfaRequestOptions });
    if (response.status !== 204) throw new Error("INVALID_MFA_RESPONSE");
  });
}

function requireMfaStep(value: unknown): MfaStep {
  const step = readMfaStep(value);
  if (!step) throw new Error("INVALID_MFA_RESPONSE");
  return step;
}

export type MfaErrorKind = "invalid" | "throttled" | "unavailable" | "currentPassword" | "ambiguous";

export function readMfaFailure(error: unknown): { kind: MfaErrorKind; retrySeconds: number } {
  const response = record(record(error)?.response);
  const data = record(response?.data);
  const code = data?.errorCode ?? data?.code;
  if (response?.status === 429) {
    const headers = response.headers;
    const header = headers instanceof Headers ? headers.get("Retry-After") : undefined;
    const detail = record(data?.details)?.retryAfterSeconds;
    const raw = header ?? (Array.isArray(detail) ? detail[0] : detail);
    const seconds = typeof raw === "number" || (typeof raw === "string" && /^\d+$/u.test(raw))
      ? Number(raw) : NaN;
    return { kind: "throttled", retrySeconds: Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 60 };
  }
  if (code === "CURRENT_PASSWORD_INVALID") return { kind: "currentPassword", retrySeconds: 0 };
  if (code === "AUTH_MFA_INVALID_CHALLENGE") return { kind: "invalid", retrySeconds: 0 };
  if (code === "AUTH_MFA_UNAVAILABLE") return { kind: "unavailable", retrySeconds: 0 };
  return { kind: "ambiguous", retrySeconds: 0 };
}
