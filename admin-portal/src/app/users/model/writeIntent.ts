import { getApiRequestOutcome } from "@/lib/api/axiosClient";
import { generateUUIDv7 } from "@/lib/utils/uuid";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import {
  isAmbiguousWriteOutcome,
  shouldRotateWriteCommandKey,
} from "@/shared/api/write-command-recovery";

export interface AdminUserWriteIntent<T> {
  fingerprint: string;
  command: T;
  idempotencyKey: string;
  ambiguous: boolean;
}

export class PendingAdminUserWriteError extends Error {
  constructor() {
    super("PENDING_ADMIN_USER_WRITE_MUST_BE_RECONCILED");
    this.name = "PendingAdminUserWriteError";
  }
}

export function claimAdminUserWriteIntent<T>(
  current: AdminUserWriteIntent<T> | null,
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  command: T,
  generate: () => string = generateUUIDv7,
): AdminUserWriteIntent<T> {
  const fingerprint = JSON.stringify({ method, path, body: command });
  if (current?.ambiguous && current.fingerprint !== fingerprint) {
    throw new PendingAdminUserWriteError();
  }
  if (current?.fingerprint === fingerprint) return current;
  return {
    fingerprint,
    command,
    idempotencyKey: generate(),
    ambiguous: false,
  };
}

export function retainAdminUserWriteIntent(
  original: unknown,
  error: NormalizedApiError,
): boolean {
  return (
    getApiRequestOutcome(original) === "settled-before-session-change" ||
    isAmbiguousWriteOutcome(error) ||
    /(?:UPSTREAM|UNAVAILABLE|TIMEOUT)/u.test(error.errorCode)
  );
}

export function settleAdminUserWriteIntent<T>(
  intent: AdminUserWriteIntent<T>,
  original: unknown,
  error: NormalizedApiError,
): AdminUserWriteIntent<T> | null {
  if (retainAdminUserWriteIntent(original, error)) {
    return { ...intent, ambiguous: true };
  }
  return shouldRotateWriteCommandKey(error) ? null : intent;
}
