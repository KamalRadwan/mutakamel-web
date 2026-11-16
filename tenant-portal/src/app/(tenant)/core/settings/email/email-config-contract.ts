import type { CorePath } from "@/lib/api/envelope";
import {
  DAILY_QUOTA_MAX,
  QUOTA_EXCEEDS_PLAN_CODE,
  RATE_LIMIT_PER_MIN_MAX,
  applyEmailQuotaPatch,
  hasEmailQuotaChanges,
  savedQuotaToDraftString,
} from "./email-quota-contract";

export { DAILY_QUOTA_MAX, QUOTA_EXCEEDS_PLAN_CODE, RATE_LIMIT_PER_MIN_MAX };

// Vocabulary, DTO bounds and request builders. Runtime response validation for
// the 28-field `TenantEmailConfigDto` lives in `email-config-response.ts`.

export const EMAIL_CONFIG_PATH: CorePath = "/api/tenant/core/v1/email-config";
export const EMAIL_CONFIG_VERIFY_PATH: CorePath = "/api/tenant/core/v1/email-config/verify";
export const EMAIL_CONFIG_VERIFY_CONNECTION_PATH: CorePath =
  "/api/tenant/core/v1/email-config/verify-connection";

/** `TENANT_EMAIL_PROVIDER_DRIVERS` — tenant-email-config.dto.ts. */
export const EMAIL_PROVIDER_DRIVERS = ["smtp", "ses", "sendgrid", "platform-shared"] as const;
export type EmailProviderDriver = (typeof EMAIL_PROVIDER_DRIVERS)[number];

/** The portal has no versioned credential-reference editor for SES/SendGrid. */
export const SELECTABLE_EMAIL_PROVIDER_DRIVERS: readonly EmailProviderDriver[] = [
  "smtp",
  "platform-shared",
];

/** `TENANT_SMTP_PROTOCOLS`. */
export const SMTP_PROTOCOLS = ["smtp", "smtps"] as const;
export type SmtpProtocol = (typeof SMTP_PROTOCOLS)[number];

/** `TENANT_EMAIL_CONFIG_STATUSES`. */
export const EMAIL_CONFIG_STATUSES = ["ACTIVE", "SUSPENDED"] as const;
export type EmailConfigStatus = (typeof EMAIL_CONFIG_STATUSES)[number];

/** `TENANT_EMAIL_FEEDBACK_PROFILES` — tenant-email-config.dto.ts. */
export const EMAIL_FEEDBACK_PROFILES = ["CRM_FEEDBACK_V1"] as const;
export type EmailFeedbackProfile = (typeof EMAIL_FEEDBACK_PROFILES)[number];

/** `SMTP_ALLOWED_PORTS` — shared-libs/packages/email/src/smtp/smtp-egress-policy.ts. */
export const SMTP_ALLOWED_PORTS = [25, 465, 587, 2525] as const;

export const CREDENTIALS_MODES = [
  "TENANT_VERSIONED_REF",
  "TENANT_ENCRYPTED_SMTP",
  "PLATFORM_SHARED",
] as const;
export type CredentialsMode = (typeof CREDENTIALS_MODES)[number];

/** `PatchTenantEmailConfigDto` & `tenant-email-config.policy.ts` bounds. */
export const FROM_ADDRESS_MAX_LENGTH = 320;
export const FROM_NAME_MAX_LENGTH = 200;
export const SENDER_DOMAIN_MAX_LENGTH = 253;
export const SMTP_USERNAME_MAX_LENGTH = 320;
export const SMTP_PASSWORD_MAX_LENGTH = 1024;
const DKIM_SELECTOR_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,61}[a-z0-9])?$/u;

/** 428 (missing precondition) and 409 (stale revision) stay distinct by contract. */
export const PRECONDITION_REQUIRED_CODE = "TENANT_EMAIL_CONFIG_PRECONDITION_REQUIRED";
export const STALE_REVISION_CODE = "TENANT_EMAIL_CONFIG_STALE_REVISION";
export const NOT_READY_CODE = "TENANT_EMAIL_CONFIG_NOT_READY";
export const CONFIG_INVALID_CODE = "TENANT_EMAIL_CONFIG_INVALID";
export const DEPENDENCY_UNAVAILABLE_CODE = "TENANT_EMAIL_CONFIG_DEPENDENCY_UNAVAILABLE";
export const EMPTY_PATCH_CODE = "TENANT_EMAIL_CONFIG_EMPTY_PATCH";
export const NO_CHANGES_CODE = "TENANT_EMAIL_CONFIG_NO_CHANGES";
export const SECRET_REF_INVALID_CODE = "TENANT_EMAIL_CONFIG_SECRET_REF_INVALID";
export const SMTP_SETTINGS_INVALID_CODE = "TENANT_SMTP_SETTINGS_INVALID";
export const VERIFICATION_FAILED_CODE = "TENANT_EMAIL_CONFIG_VERIFICATION_FAILED";
export const SMTP_PROBE_UNAVAILABLE_CODE = "TENANT_SMTP_CONNECTION_VERIFICATION_UNAVAILABLE";
export const SMTP_CONNECTION_FAILED_CODE = "TENANT_SMTP_CONNECTION_FAILED";
export const DKIM_PROOF_NOT_REGISTERED_CODE = "TENANT_EMAIL_CONFIG_DKIM_PROOF_NOT_REGISTERED";

/** `TenantEmailConfigDto` — full 28-field safe projection. No secret ever appears here. */
export interface EmailConfig {
  revision: number;
  fromAddress: string;
  fromName: string;
  replyTo: string | null;
  senderDomain: string;
  providerDriver: EmailProviderDriver;
  credentialsMode: CredentialsMode;
  providerCredentialsConfigured: boolean;
  providerCredentialsVersion: number | null;
  providerCredentialsRefFingerprint: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  smtpProtocol: SmtpProtocol | null;
  smtpUsername: string | null;
  smtpPasswordConfigured: boolean;
  feedbackProfile: EmailFeedbackProfile | null;
  dkimSelector: string | null;
  dkimVerified: boolean;
  verifiedAt: string | null;
  planDailyQuota: number;
  planRateLimitPerMin: number;
  planQuotaRevision: number;
  dailyQuota: number | null;
  rateLimitPerMin: number | null;
  effectiveDailyQuota: number;
  effectiveRateLimitPerMin: number;
  status: EmailConfigStatus;
  updatedAt: string;
}

export interface EmailConfigFormValues {
  fromAddress: string;
  fromName: string;
  replyTo: string;
  senderDomain: string;
  dkimSelector: string;
  providerDriver: EmailProviderDriver;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpProtocol: SmtpProtocol;
  smtpUsername: string;
  /** Write-only. Empty means "leave the stored secret exactly as it is". */
  smtpPassword: string;
  status: EmailConfigStatus;
  /** Empty string means `null` (inherit `planDailyQuota`). */
  dailyQuota: string;
  /** Empty string means `null` (inherit `planRateLimitPerMin`). */
  rateLimitPerMin: string;
}

/** `PatchTenantEmailConfigDto`. Plan fields and `feedbackProfile` are never sent. */
export interface PatchEmailConfigRequest {
  fromAddress?: string;
  fromName?: string;
  replyTo?: string | null;
  senderDomain?: string;
  dkimSelector?: string | null;
  providerDriver?: EmailProviderDriver;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpProtocol?: SmtpProtocol;
  smtpUsername?: string;
  smtpPassword?: string;
  status?: EmailConfigStatus;
  dailyQuota?: number | null;
  rateLimitPerMin?: number | null;
}

export function toEmailConfigForm(config: EmailConfig): EmailConfigFormValues {
  return {
    fromAddress: config.fromAddress,
    fromName: config.fromName,
    replyTo: config.replyTo ?? "",
    senderDomain: config.senderDomain,
    dkimSelector: config.dkimSelector ?? "",
    providerDriver: config.providerDriver,
    smtpHost: config.smtpHost ?? "",
    smtpPort: config.smtpPort === null ? "" : String(config.smtpPort),
    smtpSecure: config.smtpSecure ?? false,
    smtpProtocol: config.smtpProtocol ?? "smtp",
    smtpUsername: config.smtpUsername ?? "",
    smtpPassword: "",
    status: config.status,
    dailyQuota: savedQuotaToDraftString(config.dailyQuota),
    rateLimitPerMin: savedQuotaToDraftString(config.rateLimitPerMin),
  };
}

export function ifMatchHeaderValue(revision: number): string {
  if (!Number.isSafeInteger(revision) || revision <= 0) throw new Error("EMAIL_FORM_REVISION");
  return `"${revision}"`;
}

export function readRevisionFromEtag(headers: Headers): number | null {
  const match = /^"([1-9][0-9]*)"$/u.exec(headers.get("etag") ?? "");
  if (!match) return null;
  const revision = Number(match[1]);
  return Number.isSafeInteger(revision) && revision > 0 ? revision : null;
}

export function dkimRecordHost(config: EmailConfig): string | null {
  if (config.dkimSelector === null || config.senderDomain.length === 0) return null;
  return `${config.dkimSelector}._domainkey.${config.senderDomain}`;
}

export function isValidDkimSelector(selector: string): boolean {
  return DKIM_SELECTOR_PATTERN.test(selector);
}

export function normalizeSenderDomainValue(domain: string): string {
  return domain.trim().replace(/\.$/u, "").toLowerCase();
}

export function extractEmailAddressDomain(address: string): string | null {
  const trimmed = address.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0 || at !== trimmed.lastIndexOf("@")) return null;
  const domain = normalizeSenderDomainValue(trimmed.slice(at + 1));
  return domain.length > 0 ? domain : null;
}

/** `tenant-email-config.service.ts` resets `dkimVerified` + suspends when any verification tuple field changes. */
export function willResetVerificationTuple(current: EmailConfig, values: EmailConfigFormValues): boolean {
  return (
    values.providerDriver !== current.providerDriver ||
    normalizeSenderDomainValue(values.senderDomain) !== normalizeSenderDomainValue(current.senderDomain) ||
    values.fromAddress.trim().toLowerCase() !== current.fromAddress.trim().toLowerCase() ||
    values.dkimSelector.trim().toLowerCase() !== (current.dkimSelector ?? "").trim().toLowerCase()
  );
}

export function canSelectEmailConfigStatus(config: EmailConfig, status: EmailConfigStatus): boolean {
  return status !== "ACTIVE" || config.dkimVerified;
}

export function hasEmailConfigChanges(current: EmailConfig, values: EmailConfigFormValues): boolean {
  if (values.fromAddress.trim() !== current.fromAddress) return true;
  if (values.fromName.trim() !== current.fromName) return true;
  if (values.replyTo.trim() !== (current.replyTo ?? "")) return true;
  if (values.senderDomain.trim() !== current.senderDomain) return true;
  if (values.dkimSelector.trim() !== (current.dkimSelector ?? "")) return true;
  if (values.providerDriver !== current.providerDriver) return true;
  if (values.status !== current.status) return true;
  if (hasEmailQuotaChanges(current, values)) return true;
  if (values.providerDriver === "smtp") {
    const savedPort = current.smtpPort === null ? "" : String(current.smtpPort);
    if (values.smtpHost.trim() !== (current.smtpHost ?? "")) return true;
    if (values.smtpPort.trim() !== savedPort) return true;
    if (values.smtpSecure !== current.smtpSecure) return true;
    if (values.smtpProtocol !== current.smtpProtocol) return true;
    if (values.smtpUsername.trim() !== (current.smtpUsername ?? "")) return true;
    if (values.smtpPassword.length > 0) return true;
  }
  return false;
}

export function buildPatchEmailConfigRequest(
  current: EmailConfig,
  values: EmailConfigFormValues,
): PatchEmailConfigRequest {
  const request: PatchEmailConfigRequest = {};
  const fromAddress = values.fromAddress.trim();
  const fromName = values.fromName.trim();
  const replyTo = values.replyTo.trim();
  const senderDomain = values.senderDomain.trim();
  const dkimSelector = values.dkimSelector.trim();

  if (fromAddress.length === 0 || fromAddress.length > FROM_ADDRESS_MAX_LENGTH) throw new Error("EMAIL_FORM_FROM_ADDRESS");
  if (fromName.length === 0 || fromName.length > FROM_NAME_MAX_LENGTH) throw new Error("EMAIL_FORM_FROM_NAME");
  if (replyTo.length > FROM_ADDRESS_MAX_LENGTH) throw new Error("EMAIL_FORM_REPLY_TO");
  if (senderDomain.length === 0 || senderDomain.length > SENDER_DOMAIN_MAX_LENGTH) throw new Error("EMAIL_FORM_SENDER_DOMAIN");
  const addressDomain = extractEmailAddressDomain(fromAddress);
  if (addressDomain !== null && addressDomain !== normalizeSenderDomainValue(senderDomain)) {
    throw new Error("EMAIL_FORM_DOMAIN_MISMATCH");
  }
  if (dkimSelector.length > 0 && !DKIM_SELECTOR_PATTERN.test(dkimSelector)) throw new Error("EMAIL_FORM_DKIM_SELECTOR");

  if (fromAddress !== current.fromAddress) request.fromAddress = fromAddress;
  if (fromName !== current.fromName) request.fromName = fromName;
  if (replyTo !== (current.replyTo ?? "")) request.replyTo = replyTo.length > 0 ? replyTo : null;
  if (senderDomain !== current.senderDomain) request.senderDomain = senderDomain;
  if (dkimSelector !== (current.dkimSelector ?? "")) request.dkimSelector = dkimSelector.length > 0 ? dkimSelector : null;
  if (values.providerDriver !== current.providerDriver) {
    if (!SELECTABLE_EMAIL_PROVIDER_DRIVERS.includes(values.providerDriver)) throw new Error("EMAIL_FORM_PROVIDER");
    request.providerDriver = values.providerDriver;
  }
  if (values.status !== current.status) {
    if (!canSelectEmailConfigStatus(current, values.status)) throw new Error("EMAIL_FORM_DKIM_REQUIRED");
    request.status = values.status;
  }
  applyEmailQuotaPatch(request, current, values);
  if (values.providerDriver === "smtp") applySmtpChanges(request, current, values);
  return request;
}

function applySmtpChanges(request: PatchEmailConfigRequest, current: EmailConfig, values: EmailConfigFormValues): void {
  const host = values.smtpHost.trim();
  const username = values.smtpUsername.trim();
  if (current.providerDriver !== "smtp" && !current.smtpPasswordConfigured && values.smtpPassword.length === 0) {
    throw new Error("EMAIL_FORM_SMTP_PASSWORD_REQUIRED");
  }
  if (host.length === 0) throw new Error("EMAIL_FORM_SMTP_HOST");
  if (username.length === 0 || username.length > SMTP_USERNAME_MAX_LENGTH) throw new Error("EMAIL_FORM_SMTP_USERNAME");
  if (values.smtpProtocol === "smtps" && !values.smtpSecure) throw new Error("EMAIL_FORM_SMTPS_SECURE");
  const port = Number(values.smtpPort.trim());
  if (!SMTP_ALLOWED_PORTS.includes(port as (typeof SMTP_ALLOWED_PORTS)[number])) throw new Error("EMAIL_FORM_SMTP_PORT");

  if (host !== (current.smtpHost ?? "")) request.smtpHost = host;
  if (port !== current.smtpPort) request.smtpPort = port;
  request.smtpSecure = values.smtpSecure;
  request.smtpProtocol = values.smtpProtocol;
  if (username !== (current.smtpUsername ?? "")) request.smtpUsername = username;
  if (values.smtpPassword.length > 0) {
    if (values.smtpPassword.length > SMTP_PASSWORD_MAX_LENGTH) throw new Error("EMAIL_FORM_SMTP_PASSWORD");
    request.smtpPassword = values.smtpPassword;
  }
}
