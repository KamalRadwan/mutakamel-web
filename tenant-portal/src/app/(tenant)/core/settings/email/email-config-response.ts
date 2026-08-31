import { isBoundedInteger, isNonEmptyString, isTimestamp, record } from "../../core-validation";
import {
  CREDENTIALS_MODES,
  EMAIL_CONFIG_STATUSES,
  EMAIL_PROVIDER_DRIVERS,
  FROM_ADDRESS_MAX_LENGTH,
  FROM_NAME_MAX_LENGTH,
  SENDER_DOMAIN_MAX_LENGTH,
  SMTP_PROTOCOLS,
  SMTP_USERNAME_MAX_LENGTH,
  type CredentialsMode,
  type EmailConfig,
  type EmailConfigStatus,
  type EmailProviderDriver,
  type SmtpProtocol,
} from "./email-config-contract";

// Split out of email-config-contract.ts purely by size: that file owns the
// vocabulary, the bounds and the request builders; this one owns the response
// boundary. `TenantEmailConfigDto` has 24 fields and every one is checked.

/** The safe projection. It carries presence flags, never a secret. */
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
    typeof config.dkimVerified !== "boolean" ||
    !isEmailConfigStatus(config.status) ||
    !isTimestamp(config.updatedAt) ||
    !isNullableTimestamp(config.verifiedAt) ||
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
    dkimSelector: config.dkimSelector as string | null,
    dkimVerified: config.dkimVerified,
    verifiedAt: config.verifiedAt as string | null,
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
  throw new Error("Invalid Core email-config response.");
}
