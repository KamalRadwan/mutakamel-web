import { TranslocoService } from '@jsverse/transloco';
import { ApiError, errorCodeOf } from '../../../../core/api/api-errors';
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
export const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  revision: number;
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
  status: 409 | 428;
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
  if (!local || local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
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
 * A revision conflict (409 stale revision, 428 missing If-Match). The gateway's 409 GW.IDEM.IN_FLIGHT
 * means the earlier attempt is still running, not that the config changed, so it is not a conflict.
 */
export function isConflictError(error: unknown): error is ApiError & { status: 409 | 428 } {
  return error instanceof ApiError && (error.status === 409 || error.status === 428) && !isIdempotencyCode(error.code);
}

function isIdempotencyCode(code: string | null | undefined): boolean {
  return !!code && (code.startsWith('GW.IDEM.') || code.startsWith('IDEM_') || code.startsWith('IDEMPOTENCY_'));
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

export function providerDriverLabel(driver: ProviderDriver, translate: (key: string) => string): string {
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
        return transloco.translate('wsEmail.bar.readOnlyHint');
      case 'TENANT_SMTP_CONNECTION_VERIFICATION_UNAVAILABLE':
        return transloco.translate('wsEmail.smtp.testNeedsSave');
      case 'TOO_MANY_REQUESTS':
        return transloco.translate('wsEmail.suppression.errors.rateLimited');
    }

    // Gateway codes (GW.IDEM.*) contain dots, so they cannot be translation keys.
    if (code === 'GW.IDEM.MISMATCH') {
      return transloco.translate('wsEmail.errors.idemMismatch');
    }
    if (isIdempotencyCode(code)) {
      return transloco.translate('settings.errors.idempotency');
    }
    if (code === 'CORE_VALIDATION_FAILED') {
      return transloco.translate('settings.errors.validation');
    }

    const key = `wsEmail.errors.${code}`;
    const translated = transloco.translate(key);
    if (translated && translated !== key) {
      return translated;
    }
  }

  if (error instanceof ApiError) {
    if (error.status === 0) return transloco.translate('settings.errors.network');
    if (error.status === 403) return transloco.translate('settings.errors.permission');
    if (error.status === 429) return transloco.translate('wsEmail.suppression.errors.rateLimited');
  }

  return transloco.translate('settings.errors.generic');
}
