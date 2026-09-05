import { shouldRotateWriteCommandKey } from "@/shared/api/write-command-recovery";
import type { ApiRequestOutcome } from "@/lib/api/axiosClient";

/**
 * A definitive 4xx response completes the original write intent at Gateway,
 * so a later operator submission must use a new key. An in-flight response or
 * an unknown/5xx outcome keeps the original key for exact reconciliation.
 *
 * Delegates rather than restating the rule. This used to be a byte-identical
 * copy of `shouldRotateWriteCommandKey`, which meant it silently stopped
 * matching when that gained its `settled-before-session-change` case - the one
 * where a definitive-looking 409 hides a command that already succeeded.
 */
export function shouldResetDatabaseServerWriteKey(
  error: {
    httpStatus: number;
    errorCode: string;
    requestOutcome?: ApiRequestOutcome;
  },
): boolean {
  return shouldRotateWriteCommandKey(error);
}
