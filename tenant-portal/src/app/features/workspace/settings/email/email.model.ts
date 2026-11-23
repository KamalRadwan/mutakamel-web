import { TranslocoService } from '@jsverse/transloco';
import { ApiError, errorCodeOf, errorMessage } from '../../../../core/api/api-errors';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { hasTenantWidePermission } from '../../../../core/auth/tenant-wide-permission';
import { coreFieldErrors } from '../core-response.model';

export type ProviderDriver = 'smtp' | 'ses' | 'sendgrid' | 'platform-shared';
export type CredentialsMode = 'TENANT_VERSIONED_REF' | 'TENANT_ENCRYPTED_SMTP' | 'PLATFORM_SHARED';
export type SmtpProtocol = 'smtp' | 'smtps';
export type EmailStatus = 'ACTIVE' | 'SUSPENDED';
export type SmtpPort = 25 | 465 | 587 | 2525;

export const SMTP_ALLOWED_PORTS = [25, 465, 587, 2525] as const;
export const DKIM_SELECTOR_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,61}[a-z0-9])?$/;
export const EMAIL_QUOTA_MAX = { daily: 1_000_000, perMinute: 10_000 } as const;
export const DOMAIN_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export interface TenantEmailConfig {
  revision: number;
  fromAddress: string;
  fromName: string;
  replyTo: string | null;
  senderDomain: string;
  providerDriver: ProviderDriver;
  credentialsMode: CredentialsMode;
  providerCredentialsConfigured: boolean;
  providerCredentialsVersion: number | null;
  providerCredentialsRefFingerprint: string | null;
  smtpHost: string | null;
  smtpPort: SmtpPort | null;
  smtpSecure: boolean | null;
  smtpProtocol: SmtpProtocol | null;
  smtpUsername: string | null;
  smtpPasswordConfigured: boolean;
  feedbackProfile: 'CRM_FEEDBACK_V1' | null;
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
  status: EmailStatus;
  updatedAt: string;
}

export interface EmailResult {
  config: TenantEmailConfig;
  etag: string;
}

export interface PatchEmailConfigRequest {
  fromAddress?: string;
  fromName?: string;
  replyTo?: string | null;
  senderDomain?: string;
  providerDriver?: ProviderDriver;
  smtpHost?: string;
  smtpPort?: SmtpPort;
  smtpSecure?: boolean;
  smtpProtocol?: SmtpProtocol;
  smtpUsername?: string;
  smtpPassword?: string;
  dkimSelector?: string | null;
  dailyQuota?: number | null;
  rateLimitPerMin?: number | null;
  status?: EmailStatus;
}

export interface SuppressionLookup {
  suppressed: boolean;
  reasonCode?: 'HARD_BOUNCE' | 'COMPLAINT';
  firstOccurredAt?: string;
  lastOccurredAt?: string;
}

export interface SuppressionLift {
  suppressed: false;
  lifted: boolean;
}

export interface EmailConflictPayload {
  status: 409;
  patch: PatchEmailConfigRequest | null;
}

export const isPlaceholderConfig = (c: TenantEmailConfig): boolean =>
  c.fromAddress.endsWith('.invalid') || c.senderDomain.endsWith('.invalid');

export function isValidDomain(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  if (!value || value.length > 253) return false;
  const labels = value.split('.');
  return labels.length >= 2 && labels.every((label) => DOMAIN_LABEL_PATTERN.test(label));
}

export function isValidBareEmail(raw: string): boolean {
  const value = raw.trim();
  if (!value || value.length > 320 || /[\s<>]/.test(value)) return false;
  const parts = value.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (
    !local ||
    local.length > 64 ||
    local.startsWith('.') ||
    local.endsWith('.') ||
    local.includes('..')
  ) {
    return false;
  }
  return isValidDomain(domain);
}

export function extractEmailDomain(raw: string): string | null {
  const parts = raw.trim().split('@');
  if (parts.length !== 2 || !parts[1]) return null;
  return parts[1].toLowerCase();
}

export function isValidSmtpHost(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  if (!value || value.length > 253 || /\s/.test(value)) return false;
  return isValidDomain(value);
}

export function isValidDkimSelector(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  return DKIM_SELECTOR_PATTERN.test(value);
}

/**
 * Only the config's stale revision is recoverable by rebasing the draft.
 */
export function isConflictError(error: unknown): error is ApiError & { status: 409 } {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    error.code === 'TENANT_EMAIL_CONFIG_STALE_REVISION'
  );
}

export function emailGates(me: TenantMe | null | undefined) {
  const manage = hasTenantWidePermission(me, 'workspace.email.manage');
  return {
    entitled: !!me && me.featureEntitlements['crm.outbound_email'] !== false,
    readable: !!me?.permissions.includes('workspace.email.read'),
    manage,
    lookup: manage || hasTenantWidePermission(me, 'workspace.email.read'),
  };
}

export function isManagedProvider(config: TenantEmailConfig): boolean {
  return config.providerDriver === 'ses' || config.providerDriver === 'sendgrid';
}

/**
 * The field a 400 CORE_VALIDATION_FAILED names (its details are keyed by field path). Core's
 * TENANT_EMAIL_CONFIG_INVALID carries no details, so it names no field.
 */
export function extractApiErrorField(error: unknown): string | null {
  const fields = coreFieldErrors(error);
  if (!fields) return null;
  return Object.keys(fields).find((field) => field !== '_') ?? null;
}

export function formatEmailDate(iso: string | null | undefined, language: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(`${language}-u-nu-latn`, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatEmailDateTime(iso: string | null | undefined, language: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(`${language}-u-nu-latn`, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatEmailNumber(value: number, language: string): string {
  return new Intl.NumberFormat(`${language}-u-nu-latn`).format(value);
}

export function providerDriverLabel(
  driver: ProviderDriver,
  translate: (key: string) => string,
): string {
  switch (driver) {
    case 'smtp':
      return 'SMTP';
    case 'ses':
      return 'Amazon SES';
    case 'sendgrid':
      return 'SendGrid';
    case 'platform-shared':
      return translate('wsEmail.provider.platform-shared');
  }
}

export function resolveEmailError(error: unknown, transloco: TranslocoService): string {
  if (error instanceof ApiError && error.status === 401)
    return transloco.translate('wsEmail.notSaved');
  if (error instanceof ApiError && error.status === 428)
    return errorMessage(new ApiError(428, 'GENERIC'), 'wsEmail', transloco);
  const fields = coreFieldErrors(error);
  const field = fields && Object.keys(fields).find((key) => key !== '_');
  if (field && fields?.[field]?.[0]) return fields[field][0];
  const code = errorCodeOf(error);
  if (code) {
    switch (code) {
      case 'TENANT_EMAIL_CONFIG_EMPTY_PATCH':
      case 'TENANT_EMAIL_CONFIG_NO_CHANGES':
        return transloco.translate('wsEmail.errors.noChanges');
      case 'TENANT_SMTP_SETTINGS_INVALID':
        return transloco.translate('wsEmail.errors.TENANT_EMAIL_CONFIG_INVALID');
      case 'TENANT_EMAIL_CONFIG_NOT_READY':
        return transloco.translate('wsEmail.states.notReadyTitle');
      case 'ACCESS_POLICY_BLOCKED':
        return transloco.translate('wsEmail.states.blockedTitle');
      case 'TENANT_WIDE_PERMISSION_REQUIRED':
        return transloco.translate('wsEmail.needsTenantWide');
    }

    const key = `wsEmail.errors.${code}`;
    const translated = transloco.translate(key);
    if (translated && translated !== key) {
      return translated;
    }
  }

  return errorMessage(error, 'wsEmail', transloco);
}
