import type { Dictionary } from "@/i18n/dictionaries/ar";
import {
  DEPENDENCY_UNAVAILABLE_CODE,
  EMPTY_PATCH_CODE,
  NOT_READY_CODE,
  NO_CHANGES_CODE,
  SECRET_REF_INVALID_CODE,
  SMTP_PROBE_UNAVAILABLE_CODE,
  SMTP_SETTINGS_INVALID_CODE,
  VERIFICATION_FAILED_CODE,
} from "./email-config-contract";

/**
 * One message per documented rejection.
 *
 * The two precondition codes are deliberately absent: 428 and 409 do not
 * produce a toast at all, they open `ConflictDialog` with different copy —
 * see `useEmailConfig.handleWriteFailure` and MASTER-PLAN 5.9.
 */
export function emailConfigMessage(
  code: string | undefined,
  t: Dictionary,
): string | undefined {
  switch (code) {
    case NOT_READY_CODE:
      return t.coreSettings.emailNotReadyDescription;
    case DEPENDENCY_UNAVAILABLE_CODE:
      return t.coreSettings.emailDependencyUnavailable;
    case EMPTY_PATCH_CODE:
    case NO_CHANGES_CODE:
      return t.coreSettings.emailNoChanges;
    case SECRET_REF_INVALID_CODE:
      return t.coreSettings.emailSecretRefInvalid;
    case SMTP_SETTINGS_INVALID_CODE:
      return t.coreSettings.emailSmtpSettingsInvalid;
    case VERIFICATION_FAILED_CODE:
      return t.coreSettings.emailVerificationFailed;
    case SMTP_PROBE_UNAVAILABLE_CODE:
      return t.coreSettings.emailProbeUnavailable;
    default:
      return undefined;
  }
}
