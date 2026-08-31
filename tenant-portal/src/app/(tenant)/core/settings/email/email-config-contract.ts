import type { CorePath } from "@/lib/api/envelope";

// The vocabulary, the DTO bounds and the request builders. The response
// boundary lives in email-config-response.ts — `TenantEmailConfigDto` has 24
// fields and checking every one does not fit in the same file.

export const EMAIL_CONFIG_PATH: CorePath = "/api/tenant/core/v1/email-config";
export const EMAIL_CONFIG_VERIFY_PATH: CorePath = "/api/tenant/core/v1/email-config/verify";
export const EMAIL_CONFIG_VERIFY_CONNECTION_PATH: CorePath =
  "/api/tenant/core/v1/email-config/verify-connection";

/** `TENANT_EMAIL_PROVIDER_DRIVERS` — tenant-email-config.dto.ts. */
export const EMAIL_PROVIDER_DRIVERS = ["smtp", "ses", "sendgrid", "platform-shared"] as const;
export type EmailProviderDriver = (typeof EMAIL_PROVIDER_DRIVERS)[number];

/** `TENANT_SMTP_PROTOCOLS`. */
export const SMTP_PROTOCOLS = ["smtp", "smtps"] as const;
export type SmtpProtocol = (typeof SMTP_PROTOCOLS)[number];

/** `TENANT_EMAIL_CONFIG_STATUSES`. */
export const EMAIL_CONFIG_STATUSES = ["ACTIVE", "SUSPENDED"] as const;
export type EmailConfigStatus = (typeof EMAIL_CONFIG_STATUSES)[number];

/** `SMTP_ALLOWED_PORTS` — shared-libs/packages/email/src/smtp/smtp-egress-policy.ts. */
export const SMTP_ALLOWED_PORTS = [25, 465, 587, 2525] as const;

export const CREDENTIALS_MODES = [
  "TENANT_VERSIONED_REF",
  "TENANT_ENCRYPTED_SMTP",
  "PLATFORM_SHARED",
] as const;
export type CredentialsMode = (typeof CREDENTIALS_MODES)[number];

/** `PatchTenantEmailConfigDto` column bounds. */
export const FROM_ADDRESS_MAX_LENGTH = 320;
export const FROM_NAME_MAX_LENGTH = 200;
export const SENDER_DOMAIN_MAX_LENGTH = 253;
export const SMTP_USERNAME_MAX_LENGTH = 320;
export const SMTP_PASSWORD_MAX_LENGTH = 1024;
const DKIM_SELECTOR_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,61}[a-z0-9])?$/u;

/**
 * The two precondition failures this module exists to keep apart.
 *
 * 428 means the request carried no `If-Match` at all — reload and retry.
 * 409 means the revision was malformed or no longer current — someone else
 * changed the configuration while this form was open. Collapsing them into one
 * message is the mistake the contract is written to prevent.
 */
export const PRECONDITION_REQUIRED_CODE = "TENANT_EMAIL_CONFIG_PRECONDITION_REQUIRED";
export const STALE_REVISION_CODE = "TENANT_EMAIL_CONFIG_STALE_REVISION";
export const NOT_READY_CODE = "TENANT_EMAIL_CONFIG_NOT_READY";
export const DEPENDENCY_UNAVAILABLE_CODE = "TENANT_EMAIL_CONFIG_DEPENDENCY_UNAVAILABLE";
export const EMPTY_PATCH_CODE = "TENANT_EMAIL_CONFIG_EMPTY_PATCH";
export const NO_CHANGES_CODE = "TENANT_EMAIL_CONFIG_NO_CHANGES";
export const SECRET_REF_INVALID_CODE = "TENANT_EMAIL_CONFIG_SECRET_REF_INVALID";
export const SMTP_SETTINGS_INVALID_CODE = "TENANT_SMTP_SETTINGS_INVALID";
export const VERIFICATION_FAILED_CODE = "TENANT_EMAIL_CONFIG_VERIFICATION_FAILED";
export const SMTP_PROBE_UNAVAILABLE_CODE = "TENANT_SMTP_CONNECTION_VERIFICATION_UNAVAILABLE";

/** `TenantEmailConfigDto` — the safe projection. No secret ever appears here. */
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
  dkimSelector: string | null;
  dkimVerified: boolean;
  verifiedAt: string | null;
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
}

/** `PatchTenantEmailConfigDto`. Only the keys that changed are ever sent. */
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
    // Never seeded with a placeholder: the API does not return the password,
    // and a masked value the client invented would be a lie about what is
    // stored — and would overwrite the real secret on save.
    smtpPassword: "",
    status: config.status,
  };
}

/**
 * The exact strong validator `parseStrongRevision` applies: `"<n>"`, one
 * positive integer, no weak form. Weak etags are rejected here, unlike
 * `activities`.
 */
export function ifMatchHeaderValue(revision: number): string {
  if (!Number.isSafeInteger(revision) || revision <= 0) {
    throw new Error("EMAIL_FORM_REVISION");
  }
  return `"${revision}"`;
}

/** The controller sets `ETag: "<revision>"` on every response. */
export function readRevisionFromEtag(headers: Headers): number | null {
  const match = /^"([1-9][0-9]*)"$/u.exec(headers.get("etag") ?? "");
  if (!match) return null;
  const revision = Number(match[1]);
  return Number.isSafeInteger(revision) && revision > 0 ? revision : null;
}

/**
 * The DKIM record the server actually looks up:
 * `${selector}._domainkey.${domain}` — DnsTenantEmailVerificationAdapter.verify.
 *
 * The record's expected VALUE is deployment registry data
 * (`TENANT_EMAIL_DKIM_PROOFS_V1_JSON`) and is never returned by the API, so it
 * is not shown; inventing one would be worse than omitting it.
 */
export function dkimRecordHost(config: EmailConfig): string | null {
  if (config.dkimSelector === null || config.senderDomain.length === 0) return null;
  return `${config.dkimSelector}._domainkey.${config.senderDomain}`;
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

  if (fromAddress.length === 0 || fromAddress.length > FROM_ADDRESS_MAX_LENGTH) {
    throw new Error("EMAIL_FORM_FROM_ADDRESS");
  }
  if (fromName.length === 0 || fromName.length > FROM_NAME_MAX_LENGTH) {
    throw new Error("EMAIL_FORM_FROM_NAME");
  }
  if (senderDomain.length === 0 || senderDomain.length > SENDER_DOMAIN_MAX_LENGTH) {
    throw new Error("EMAIL_FORM_SENDER_DOMAIN");
  }
  if (dkimSelector.length > 0 && !DKIM_SELECTOR_PATTERN.test(dkimSelector)) {
    throw new Error("EMAIL_FORM_DKIM_SELECTOR");
  }

  if (fromAddress !== current.fromAddress) request.fromAddress = fromAddress;
  if (fromName !== current.fromName) request.fromName = fromName;
  if (replyTo !== (current.replyTo ?? "")) request.replyTo = replyTo.length > 0 ? replyTo : null;
  if (senderDomain !== current.senderDomain) request.senderDomain = senderDomain;
  if (dkimSelector !== (current.dkimSelector ?? "")) {
    request.dkimSelector = dkimSelector.length > 0 ? dkimSelector : null;
  }
  if (values.providerDriver !== current.providerDriver) {
    request.providerDriver = values.providerDriver;
  }
  if (values.status !== current.status) request.status = values.status;

  if (values.providerDriver === "smtp") {
    applySmtpChanges(request, current, values);
  }
  return request;
}

function applySmtpChanges(
  request: PatchEmailConfigRequest,
  current: EmailConfig,
  values: EmailConfigFormValues,
): void {
  const host = values.smtpHost.trim();
  const username = values.smtpUsername.trim();
  if (host.length === 0) throw new Error("EMAIL_FORM_SMTP_HOST");
  if (username.length === 0 || username.length > SMTP_USERNAME_MAX_LENGTH) {
    throw new Error("EMAIL_FORM_SMTP_USERNAME");
  }

  const port = Number(values.smtpPort.trim());
  if (!SMTP_ALLOWED_PORTS.includes(port as (typeof SMTP_ALLOWED_PORTS)[number])) {
    throw new Error("EMAIL_FORM_SMTP_PORT");
  }

  if (host !== (current.smtpHost ?? "")) request.smtpHost = host;
  if (port !== current.smtpPort) request.smtpPort = port;
  if (values.smtpSecure !== (current.smtpSecure ?? false)) request.smtpSecure = values.smtpSecure;
  if (values.smtpProtocol !== (current.smtpProtocol ?? "smtp")) {
    request.smtpProtocol = values.smtpProtocol;
  }
  if (username !== (current.smtpUsername ?? "")) request.smtpUsername = username;

  // A blank password field means "unchanged". `applyPatch` only re-encrypts
  // when `smtpPassword` is present, so omitting the key preserves the stored
  // secret; sending an empty string would fail `@Length(1, 1024)` anyway.
  if (values.smtpPassword.length > 0) {
    if (values.smtpPassword.length > SMTP_PASSWORD_MAX_LENGTH) {
      throw new Error("EMAIL_FORM_SMTP_PASSWORD");
    }
    request.smtpPassword = values.smtpPassword;
  }
}
