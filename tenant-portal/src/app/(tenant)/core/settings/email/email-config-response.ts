import { isBoundedInteger, isNonEmptyString, isTimestamp, record } from "../../core-validation";
import { SettingsInvalidResponseError } from "../settings-failure";
import {
  CREDENTIALS_MODES,
  DAILY_QUOTA_MAX,
  EMAIL_CONFIG_STATUSES,
  EMAIL_FEEDBACK_PROFILES,
  EMAIL_PROVIDER_DRIVERS,
  FROM_ADDRESS_MAX_LENGTH,
  FROM_NAME_MAX_LENGTH,
  RATE_LIMIT_PER_MIN_MAX,
  SENDER_DOMAIN_MAX_LENGTH,
  SMTP_PROTOCOLS,
  SMTP_USERNAME_MAX_LENGTH,
  type CredentialsMode,
  type EmailConfig,
  type EmailConfigStatus,
  type EmailFeedbackProfile,
  type EmailProviderDriver,
  type SmtpProtocol,
} from "./email-config-contract";

// Split out of email-config-contract.ts by size: `TenantEmailConfigDto` has 28
// fields and every one is validated at the runtime response boundary.

/** The safe projection. It carries presence flags and plan caps, never a secret. */
export function parseEmailConfigResponse(payload: unknown): EmailConfig {
  const config = record(payload);
  if (
    !config ||
    !isBoundedInteger(config.revision, 1, Number.MAX_SAFE_INTEGER) ||
    !isNonEmptyString(config.fromAddress, FROM_ADDRESS_MAX_LENGTH) ||
    !isNonEmptyString(config.fromName, FROM_NAME_MAX_LENGTH) ||
    !isNonEmptyString(config.senderDomain, SENDER_DOMAIN_MAX_LENGTH) ||
    !isProviderDriver(config.providerDriver) ||
    !isCredentialsMode(config.credentialsMode) ||
    typeof config.providerCredentialsConfigured !== "boolean" ||
    typeof config.smtpPasswordConfigured !== "boolean" ||
    !isNullableFeedbackProfile(config.feedbackProfile) ||
    typeof config.dkimVerified !== "boolean" ||
    !isEmailConfigStatus(config.status) ||
    !isTimestamp(config.updatedAt) ||
    !isNullableTimestamp(config.verifiedAt) ||
    !isBoundedInteger(config.planDailyQuota, 1, DAILY_QUOTA_MAX) ||
    !isBoundedInteger(config.planRateLimitPerMin, 1, RATE_LIMIT_PER_MIN_MAX) ||
    !isBoundedInteger(config.planQuotaRevision, 1, Number.MAX_SAFE_INTEGER) ||
    !isNullablePositiveQuota(config.dailyQuota, DAILY_QUOTA_MAX) ||
    !isNullablePositiveQuota(config.rateLimitPerMin, RATE_LIMIT_PER_MIN_MAX) ||
    !isBoundedInteger(config.effectiveDailyQuota, 0, Number.MAX_SAFE_INTEGER) ||
    !isBoundedInteger(config.effectiveRateLimitPerMin, 0, Number.MAX_SAFE_INTEGER) ||
    !isNullableText(config.replyTo, FROM_ADDRESS_MAX_LENGTH) ||
    !isNullableText(config.smtpHost, SENDER_DOMAIN_MAX_LENGTH) ||
    !isNullableText(config.smtpUsername, SMTP_USERNAME_MAX_LENGTH) ||
    !isNullableText(config.dkimSelector, 253) ||
    !isNullableText(config.providerCredentialsRefFingerprint, 512) ||
    !isNullablePort(config.smtpPort) ||
    !isNullableBoolean(config.smtpSecure) ||
    !isNullableSmtpProtocol(config.smtpProtocol) ||
    !isNullableVersion(config.providerCredentialsVersion)
  ) {
    invalidResponse();
  }

  return {
    revision: config.revision,
    fromAddress: config.fromAddress,
    fromName: config.fromName,
    replyTo: config.replyTo as string | null,
    senderDomain: config.senderDomain,
    providerDriver: config.providerDriver,
    credentialsMode: config.credentialsMode,
    providerCredentialsConfigured: config.providerCredentialsConfigured,
    providerCredentialsVersion: config.providerCredentialsVersion as number | null,
    providerCredentialsRefFingerprint: config.providerCredentialsRefFingerprint as string | null,
    smtpHost: config.smtpHost as string | null,
    smtpPort: config.smtpPort as number | null,
    smtpSecure: config.smtpSecure as boolean | null,
    smtpProtocol: config.smtpProtocol as SmtpProtocol | null,
    smtpUsername: config.smtpUsername as string | null,
    smtpPasswordConfigured: config.smtpPasswordConfigured,
    feedbackProfile: config.feedbackProfile as EmailFeedbackProfile | null,
    dkimSelector: config.dkimSelector as string | null,
    dkimVerified: config.dkimVerified,
    verifiedAt: config.verifiedAt as string | null,
    planDailyQuota: config.planDailyQuota,
    planRateLimitPerMin: config.planRateLimitPerMin,
    planQuotaRevision: config.planQuotaRevision,
    dailyQuota: config.dailyQuota as number | null,
    rateLimitPerMin: config.rateLimitPerMin as number | null,
    effectiveDailyQuota: config.effectiveDailyQuota,
    effectiveRateLimitPerMin: config.effectiveRateLimitPerMin,
    status: config.status,
    updatedAt: config.updatedAt,
  };
}

/** `verifySmtpConnection` answers exactly `{ verified: true }` or throws. */
export function parseVerifyConnectionResponse(payload: unknown): boolean {
  const result = record(payload);
  if (!result || result.verified !== true) invalidResponse();
  return true;
}

function isProviderDriver(value: unknown): value is EmailProviderDriver {
  return EMAIL_PROVIDER_DRIVERS.includes(value as EmailProviderDriver);
}

function isCredentialsMode(value: unknown): value is CredentialsMode {
  return CREDENTIALS_MODES.includes(value as CredentialsMode);
}

function isEmailConfigStatus(value: unknown): value is EmailConfigStatus {
  return EMAIL_CONFIG_STATUSES.includes(value as EmailConfigStatus);
}

function isNullableFeedbackProfile(value: unknown): value is EmailFeedbackProfile | null {
  return value === null || EMAIL_FEEDBACK_PROFILES.includes(value as EmailFeedbackProfile);
}

function isNullablePositiveQuota(value: unknown, max: number): value is number | null {
  return value === null || isBoundedInteger(value, 1, max);
}

function isNullableSmtpProtocol(value: unknown): boolean {
  return value === null || SMTP_PROTOCOLS.includes(value as SmtpProtocol);
}

function isNullableText(value: unknown, maxLength: number): boolean {
  return value === null || (typeof value === "string" && value.length <= maxLength);
}

function isNullableTimestamp(value: unknown): boolean {
  return value === null || isTimestamp(value);
}

function isNullableBoolean(value: unknown): boolean {
  return value === null || typeof value === "boolean";
}

function isNullablePort(value: unknown): boolean {
  return value === null || isBoundedInteger(value, 1, 65_535);
}

function isNullableVersion(value: unknown): boolean {
  return value === null || isBoundedInteger(value, 0, Number.MAX_SAFE_INTEGER);
}

function invalidResponse(): never {
  throw new SettingsInvalidResponseError("Invalid Core email-config response.");
}
