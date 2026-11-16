import { describeApiOutcome, formatApiErrorMessage } from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { formatTemplate } from "@/lib/format/template";
import { SettingsInvalidResponseError } from "../settings-failure";
import {
  CONFIG_INVALID_CODE,
  DAILY_QUOTA_MAX,
  DEPENDENCY_UNAVAILABLE_CODE,
  DKIM_PROOF_NOT_REGISTERED_CODE,
  EMPTY_PATCH_CODE,
  FROM_ADDRESS_MAX_LENGTH,
  FROM_NAME_MAX_LENGTH,
  NOT_READY_CODE,
  NO_CHANGES_CODE,
  PRECONDITION_REQUIRED_CODE,
  QUOTA_EXCEEDS_PLAN_CODE,
  RATE_LIMIT_PER_MIN_MAX,
  SECRET_REF_INVALID_CODE,
  SELECTABLE_EMAIL_PROVIDER_DRIVERS,
  SENDER_DOMAIN_MAX_LENGTH,
  SMTP_ALLOWED_PORTS,
  SMTP_CONNECTION_FAILED_CODE,
  SMTP_PASSWORD_MAX_LENGTH,
  SMTP_PROBE_UNAVAILABLE_CODE,
  SMTP_SETTINGS_INVALID_CODE,
  SMTP_USERNAME_MAX_LENGTH,
  STALE_REVISION_CODE,
  VERIFICATION_FAILED_CODE,
  canSelectEmailConfigStatus,
  extractEmailAddressDomain,
  isValidDkimSelector,
  normalizeSenderDomainValue,
  type EmailConfig,
  type EmailConfigFormValues,
} from "./email-config-contract";
import { validateQuotaField } from "./email-quota-contract";

const EMAIL_LOCAL_PART_PATTERN = /^[^\s<>(),:;\\\x5b\x5d"@]+$/u;
const EMAIL_DOMAIN_LABEL_PATTERN = /^[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?$/u;

export type EmailConfigFieldErrors = Partial<Record<keyof EmailConfigFormValues, string>>;

/** Matches `normalizeTenantEmailAddress` bare addr-spec rules in `tenant-email-config.policy.ts`. */
function isValidEmailAddress(value: string): boolean {
  const candidate = value.trim();
  if (candidate.length === 0 || candidate.length > FROM_ADDRESS_MAX_LENGTH) return false;
  for (let i = 0; i < candidate.length; i += 1) {
    const code = candidate.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return false;
  }
  if (/\s/u.test(candidate) || candidate.includes("<") || candidate.includes(">")) return false;
  const at = candidate.indexOf("@");
  if (at <= 0 || at !== candidate.lastIndexOf("@")) return false;
  const local = candidate.slice(0, at);
  if (local.length > 64 || !EMAIL_LOCAL_PART_PATTERN.test(local)) return false;
  const domain = candidate.slice(at + 1).replace(/\.$/u, "");
  if (domain.length === 0 || domain.length > SENDER_DOMAIN_MAX_LENGTH || domain.includes(":")) {
    return false;
  }
  const labels = domain.split(".");
  return labels.length >= 2 && labels.every((label) => EMAIL_DOMAIN_LABEL_PATTERN.test(label));
}

/**
 * One message per documented rejection.
 *
 * 428 and 409 open `EmailConflictDialog` with distinct copy rather than toasting.
 */
export function emailConfigMessage(
  code: string | undefined,
  t: Dictionary,
): string | undefined {
  switch (code) {
    case "ACCESS_POLICY_BLOCKED":
      return t.coreSettings.emailAccessBlocked;
    case NOT_READY_CODE:
      return t.coreSettings.emailNotReadyDescription;
    case CONFIG_INVALID_CODE:
      return t.coreSettings.emailConfigInvalid;
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
    case SMTP_CONNECTION_FAILED_CODE:
      return t.coreSettings.emailSmtpConnectionFailed;
    case DKIM_PROOF_NOT_REGISTERED_CODE:
      return t.coreSettings.emailDkimProofNotRegistered;
    case QUOTA_EXCEEDS_PLAN_CODE:
      return t.coreSettings.emailQuotaExceedsPlan;
    default:
      return undefined;
  }
}

export function describeEmailConfigApiError(
  error: NormalizedApiError | null,
  t: Dictionary,
): string | undefined {
  if (!error) return undefined;

  const outcome = describeApiOutcome(error, t);
  if (outcome) {
    return formatApiErrorMessage(
      {
        status: error.status,
        message: `${outcome.title} — ${outcome.description}`,
        correlationId: error.correlationId,
      },
      t,
    );
  }

  const domainMessage = emailConfigMessage(error.code, t);
  const fallback =
    error.status === 0
      ? t.coreIdentity.errors.OFFLINE
      : (error.code ? t.coreIdentity.errors[error.code] : undefined) ??
        t.coreIdentity.errors.UNKNOWN;

  return formatApiErrorMessage(
    {
      status: error.status,
      message: domainMessage ?? fallback,
      correlationId: error.correlationId,
    },
    t,
  );
}

export type ClassifiedEmailWriteError =
  | { kind: "invalid-response"; detail: string }
  | { kind: "access-blocked"; error: NormalizedApiError }
  | { kind: "forbidden" }
  | { kind: "conflict"; conflict: "preconditionRequired" | "staleRevision" }
  | { kind: "api"; error: NormalizedApiError; detail: string | undefined; formatted: string };

export function classifyEmailWriteError(
  error: unknown,
  failureTitle: string,
  t: Dictionary,
  isHandledApiOutcome: (normalized: NormalizedApiError) => boolean,
): ClassifiedEmailWriteError | null {
  if (error instanceof SettingsInvalidResponseError) {
    return { kind: "invalid-response", detail: t.coreSettings.invalidResponseDescription };
  }
  const normalized = normalizeApiError(error);
  if (normalized.code === "ACCESS_POLICY_BLOCKED") {
    return { kind: "access-blocked", error: normalized };
  }
  if (normalized.status === 403) return { kind: "forbidden" };
  if (normalized.code === PRECONDITION_REQUIRED_CODE || normalized.status === 428) {
    return { kind: "conflict", conflict: "preconditionRequired" };
  }
  if (normalized.code === STALE_REVISION_CODE) {
    return { kind: "conflict", conflict: "staleRevision" };
  }
  if (isHandledApiOutcome(normalized)) return null;
  if (normalized.status === 409) {
    return { kind: "conflict", conflict: "staleRevision" };
  }
  const detail = describeEmailConfigApiError(normalized, t);
  return {
    kind: "api",
    error: normalized,
    detail,
    formatted: detail ? `${failureTitle} — ${detail}` : failureTitle,
  };
}

/**
 * Client-side field validation matching `buildPatchEmailConfigRequest` and
 * `tenant-email-config.policy.ts` bounds so all invalid fields surface inline errors.
 */
export function validateEmailConfigDraft(
  current: EmailConfig,
  values: EmailConfigFormValues,
  t: Dictionary,
): EmailConfigFieldErrors {
  const errors: EmailConfigFieldErrors = {};
  const fromAddress = values.fromAddress.trim();
  const fromName = values.fromName.trim();
  const replyTo = values.replyTo.trim();
  const senderDomain = values.senderDomain.trim();
  const normalizedDomain = normalizeSenderDomainValue(senderDomain);
  const dkimSelector = values.dkimSelector.trim();

  const validFromAddress = isValidEmailAddress(fromAddress);
  if (!validFromAddress) {
    errors.fromAddress = t.coreSettings.emailFormFromAddress;
  }
  if (fromName.length === 0 || fromName.length > FROM_NAME_MAX_LENGTH) {
    errors.fromName = t.coreSettings.emailFormFromName;
  }
  if (replyTo.length > 0 && !isValidEmailAddress(replyTo)) {
    errors.replyTo = t.coreSettings.emailFormReplyTo;
  }
  if (normalizedDomain.length === 0 || normalizedDomain.length > SENDER_DOMAIN_MAX_LENGTH) {
    errors.senderDomain = t.coreSettings.emailFormSenderDomain;
  } else if (validFromAddress) {
    const addressDomain = extractEmailAddressDomain(fromAddress);
    if (addressDomain !== normalizedDomain) {
      errors.fromAddress = formatTemplate(t.coreSettings.emailFormDomainMismatch, {
        domain: normalizedDomain,
      });
    }
  }
  if (dkimSelector.length > 0 && !isValidDkimSelector(dkimSelector)) {
    errors.dkimSelector = t.coreSettings.emailFormDkimSelector;
  }
  if (
    values.providerDriver !== current.providerDriver &&
    !SELECTABLE_EMAIL_PROVIDER_DRIVERS.includes(values.providerDriver)
  ) {
    errors.providerDriver = t.coreSettings.emailProviderUnsupported;
  }
  if (values.status !== current.status && !canSelectEmailConfigStatus(current, values.status)) {
    errors.status = t.coreSettings.emailActivationRequiresDkim;
  }

  if (values.providerDriver === "smtp") {
    const host = values.smtpHost.trim();
    const username = values.smtpUsername.trim();
    const port = Number(values.smtpPort.trim());

    if (host.length === 0) errors.smtpHost = t.coreSettings.emailFormSmtpHost;
    if (!SMTP_ALLOWED_PORTS.includes(port as (typeof SMTP_ALLOWED_PORTS)[number])) {
      errors.smtpPort = t.coreSettings.emailFormSmtpPort;
    }
    if (username.length === 0 || username.length > SMTP_USERNAME_MAX_LENGTH) {
      errors.smtpUsername = t.coreSettings.emailFormSmtpUsername;
    }
    if (values.smtpProtocol === "smtps" && !values.smtpSecure) {
      errors.smtpSecure = t.coreSettings.emailFormSmtpsRequiresSecure;
    }
    if (
      current.providerDriver !== "smtp" &&
      !current.smtpPasswordConfigured &&
      values.smtpPassword.length === 0
    ) {
      errors.smtpPassword = t.coreSettings.emailSmtpPasswordRequired;
    } else if (values.smtpPassword.length > SMTP_PASSWORD_MAX_LENGTH) {
      errors.smtpPassword = t.coreSettings.emailFormSmtpPassword;
    }
  }

  const dailyQuotaError = validateQuotaField(
    values.dailyQuota,
    current.planDailyQuota,
    DAILY_QUOTA_MAX,
    t,
  );
  if (dailyQuotaError) errors.dailyQuota = dailyQuotaError;

  const rateLimitError = validateQuotaField(
    values.rateLimitPerMin,
    current.planRateLimitPerMin,
    RATE_LIMIT_PER_MIN_MAX,
    t,
  );
  if (rateLimitError) errors.rateLimitPerMin = rateLimitError;

  return errors;
}
