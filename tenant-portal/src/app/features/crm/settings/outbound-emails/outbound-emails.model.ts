import { TranslocoService } from '@jsverse/transloco';
import { ApiError, crmSettingsError } from '../shared/settings-api';

export type EmailStatus = 'QUEUED' | 'DISPATCHING' | 'SENT' | 'FAILED';
export type EmailSourceType = 'LEAD' | 'CUSTOMER_PROFILE' | 'OPPORTUNITY';
export type ProviderDriver = 'smtp' | 'ses' | 'sendgrid' | 'platform-shared';
export type EmailRecipientKind = 'PARTY_CONTACT' | 'SOURCE_PRIMARY_CONTACT';
export type EmailFeedbackType = 'BOUNCE' | 'COMPLAINT';
/** Event types the backend writes to `crm_outbound_email_events` and returns as `timeline[].state`. */
export type EmailTimelineState =
  | 'QUEUED'
  | 'RETRY_REQUESTED'
  | 'DISPATCHING'
  | 'SENT'
  | 'FAILED'
  | 'BOUNCED'
  | 'COMPLAINED';
/** Backend `feedback[].reasonCode`: HARD_BOUNCE / SOFT_BOUNCE / COMPLAINT, or UNSPECIFIED when the event has no code. */
export type EmailFeedbackReasonCode = 'HARD_BOUNCE' | 'SOFT_BOUNCE' | 'COMPLAINT' | 'UNSPECIFIED';
export const EMAIL_FEEDBACK_REASON_CODES: readonly EmailFeedbackReasonCode[] = [
  'HARD_BOUNCE',
  'SOFT_BOUNCE',
  'COMPLAINT',
  'UNSPECIFIED',
];
export type EmailAvailabilityIssue = 'NO_APPROVED_RECIPIENT' | 'NO_COMPATIBLE_TEMPLATE';

export const EMAIL_PAGE_LIMIT = 25;
export const MAX_RANGE_DAYS = 366;
export const RETRY_REASON_MAX = 500;

export const EMAIL_STATUSES: readonly EmailStatus[] = ['QUEUED', 'DISPATCHING', 'SENT', 'FAILED'];
export const EMAIL_SOURCE_TYPES: readonly EmailSourceType[] = ['LEAD', 'CUSTOMER_PROFILE', 'OPPORTUNITY'];

export const STATUS_BADGE: Record<EmailStatus, string> = {
  QUEUED: 'bg-neutral-soft text-text-muted',
  DISPATCHING: 'bg-brand-soft text-on-brand-soft',
  SENT: 'bg-success text-on-success',
  FAILED: 'bg-danger text-on-danger',
};

export const SOURCE_LOOK: Record<EmailSourceType, { icon: string; tile: string }> = {
  LEAD: { icon: 'tablerUserPlus', tile: 'bg-icon-green' },
  CUSTOMER_PROFILE: { icon: 'tablerUsers', tile: 'bg-icon-blue' },
  OPPORTUNITY: { icon: 'tablerTarget', tile: 'bg-icon-red' },
};

export interface EmailRecipientSummary {
  displayName: string;
  maskedAddress: string;
}

export interface EmailRequesterSummary {
  id: string;
  displayName: string;
}

/** List item, exactly as `listProjection` in the backend outbound-emails service builds it. */
export interface EmailRow {
  outboundEmailId: string;
  activityId: string;
  sourceType: EmailSourceType;
  sourceId: string;
  templateDefinitionId: string;
  templateVersionId: string;
  templateVersionNumber: number;
  recipient: EmailRecipientSummary;
  /** First 160 characters of the subject; null once the content is gone. */
  subjectPreview: string | null;
  status: EmailStatus;
  statusRevision: number;
  requestedAt: string;
  sentAt: string | null;
  failedAt: string | null;
  requestedBy: EmailRequesterSummary;
  retryOfId: string | null;
}

export interface EmailListFilter {
  status?: EmailStatus;
  sourceType?: EmailSourceType;
  sourceId?: string;
  requestedFrom?: string;
  requestedTo?: string;
}

export interface EmailListPage {
  items: EmailRow[];
  nextCursor: string | null;
  hasNext: boolean;
  limit: number;
}

export type EmailContent =
  | {
      state: 'AVAILABLE';
      subject: string;
      preheader: string | null;
      html: string;
      text: string | null;
      contentChecksum: string;
    }
  | {
      state: 'REDACTED_BY_RETENTION';
      redactedAt: string;
    };

/** Template snapshot stored with the email (`detailProjection().template`). */
export interface EmailTemplateSnapshot {
  templateDefinitionId: string;
  templateVersionId: string;
  versionNumber: number;
  documentType: 'CRM_OUTBOUND_EMAIL';
  outputChannel: 'EMAIL';
  layoutMode: 'EMAIL_FLOW';
  locale: string;
  direction: 'LTR' | 'RTL';
  dataSourceKey: string;
  dataSourceSchemaVersion: number;
  dataSourceSchemaChecksum: string;
  templateContentChecksum: string;
  compiledChecksum: string;
  compilerFingerprint: string;
  lifecycleStatus: 'PUBLISHED';
}

export interface EmailSenderSnapshot {
  displayName: string;
  maskedAddress: string;
  maskedReplyTo: string | null;
}

/** `kind` is the stored provider name upper-cased by the backend (for example SES). */
export interface EmailProviderSubmission {
  kind: string;
  submissionReference: string;
}

export interface EmailFailure {
  code: string;
  automaticRetryExhausted: boolean;
  failedAt: string;
}

export interface EmailFeedback {
  type: EmailFeedbackType;
  occurredAt: string;
  reasonCode: EmailFeedbackReasonCode;
  suppressionApplied: boolean;
}

export interface EmailTimelineEvent {
  state: EmailTimelineState;
  occurredAt: string;
}

/** Detail, exactly as `detailProjection` in the backend outbound-emails service builds it. */
export interface EmailDetail {
  outboundEmailId: string;
  activityId: string;
  sourceType: EmailSourceType;
  sourceId: string;
  template: EmailTemplateSnapshot;
  recipient: EmailRecipientSummary & { kind: 'TO' };
  sender: EmailSenderSnapshot;
  senderConfigRevision: number;
  content: EmailContent;
  status: EmailStatus;
  statusRevision: number;
  provider: EmailProviderSubmission | null;
  failure: EmailFailure | null;
  feedback: EmailFeedback[];
  timeline: EmailTimelineEvent[];
  requestedAt: string;
  sentAt: string | null;
  failedAt: string | null;
  retryOfId: string | null;
  retriedById: string | null;
  contentRetentionDays: number;
  contentRetentionUntil: string;
  contentRetentionPolicyRevision: number;
}

export interface RetryEmailResult {
  outboundEmailId: string;
  status: 'QUEUED';
}

/** Backend `CrmRecipientReferenceProjectionDto`; also the `recipient` body of preview and send. */
export interface EmailRecipientReference {
  kind: EmailRecipientKind;
  partyId?: string;
  contactId?: string;
}

/** Backend `CrmOutboundEmailRecipientOptionDto`. */
export interface EmailRecipientOption {
  reference: EmailRecipientReference;
  displayName: string;
  maskedAddress: string;
  isPrimary: boolean;
}

/** Backend `CrmOutboundEmailTemplateOptionDto`. */
export interface EmailTemplateOption {
  templateId: string;
  templateVersionId: string;
  code: string;
  name: string;
  versionNumber: number;
  locale: string;
  direction: 'LTR' | 'RTL';
  selection: 'EFFECTIVE_ASSIGNMENT' | 'ELIGIBLE_EXPLICIT';
  assignmentId?: string;
}

/** Backend `CrmOutboundEmailOptionsRequestDto` (locale is optional there). */
export interface EmailOptionsRequest {
  sourceType: EmailSourceType;
  sourceId: string;
  locale?: 'ar' | 'en';
}

/** Backend `CrmOutboundEmailOptionsDto`. */
export interface EmailOptionsResponse {
  sourceType: EmailSourceType;
  sourceId: string;
  resolvedLocale: string;
  recipients: EmailRecipientOption[];
  templates: EmailTemplateOption[];
  assignedTemplateVersionId: string | null;
  availability: EmailAvailabilityIssue[];
}

export interface EmailPreviewRequest {
  sourceType: EmailSourceType;
  sourceId: string;
  locale?: 'ar' | 'en';
  recipient: EmailRecipientReference;
  templateVersionId?: string;
}

export interface EmailPreviewResponse {
  subject: string;
  preheader: string | null;
  bodyHtml: string;
  bodyText: string;
}

export interface SendEmailRequest extends EmailPreviewRequest {}

export interface SendEmailResult {
  outboundEmailId: string;
  activityId: string;
  status: 'QUEUED';
}

export interface SenderStatusConfig {
  status: 'ACTIVE' | 'SUSPENDED';
  fromName: string;
  fromAddress: string;
  providerDriver: ProviderDriver;
  dkimVerified: boolean;
  providerCredentialsConfigured: boolean;
  feedbackProfile: string | null;
  canSendCrm: boolean;
}

export interface CrmSourceRecord {
  id: string;
  type: EmailSourceType;
  name: string;
}

/**
 * List items carry only `status`; whether the content is still kept and whether a retry
 * already exists come from the detail. A row may offer Retry when it failed, and the
 * detail decides (see `canRetryEmail`).
 */
export function mayOfferRetry(row: Pick<EmailRow, 'status'>): boolean {
  return row.status === 'FAILED';
}

export function canRetryEmail(email: Pick<EmailDetail, 'status' | 'content' | 'retriedById'>): boolean {
  return email.status === 'FAILED' && email.content.state === 'AVAILABLE' && !email.retriedById;
}

/** Shortens a long id to `abcd…wxyz` for display where the backend sends no name; short ids stay as they are. */
export function shortEmailRef(id: string | null | undefined): string {
  const trimmed = id?.trim();
  if (!trimmed) return '—';
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

export function feedbackReasonKey(code: string): EmailFeedbackReasonCode {
  return (EMAIL_FEEDBACK_REASON_CODES as readonly string[]).includes(code)
    ? (code as EmailFeedbackReasonCode)
    : 'UNSPECIFIED';
}

export function wrapEmailHtml(html: string): string {
  return `<!doctype html><html style="color-scheme:light;background:#fff"><head><meta charset="utf-8"></head><body style="margin:0">${html}</body></html>`;
}

export function formatEmailDateTime(iso: string | null | undefined, language: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(`${language}-u-nu-latn`, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function resolveEmailErrorMessage(transloco: TranslocoService, error: unknown, write = false): string {
  if (error instanceof ApiError && error.status === 429 && error.code === 'CRM.EMAIL.SEND_RATE_LIMITED') {
    const raw = error.details?.['retryAfterSeconds'];
    const seconds = Number(Array.isArray(raw) ? raw[0] : raw);
    return transloco.translate('outboundEmails.errors.CRM.EMAIL.SEND_RATE_LIMITED', {
      minutes: Math.max(1, Math.ceil((Number.isFinite(seconds) && seconds > 0 ? seconds : 60) / 60)),
    });
  }
  if (write && error instanceof ApiError && error.status === 401) {
    return transloco.translate('outboundEmails.errors.notSaved');
  }
  if (write && error instanceof ApiError && (error.status === 0 || error.status >= 500)) {
    return transloco.translate('outboundEmails.errors.notSent');
  }
  return emailErrorState(transloco, error).message;
}

export function emailErrorState(transloco: TranslocoService, error: unknown) {
  const messages = transloco.getTranslation(transloco.getActiveLang());
  return crmSettingsError((key, params) => Object.hasOwn(messages, key)
    ? transloco.translate(key, params) : key, error, 'outboundEmails');
}

export function keepEmailKey(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 0 || error.status >= 500 ||
    error.status === 401 || error.code === 'GW.IDEM.IN_FLIGHT');
}

/** The API uses an exclusive end, so a selected end date advances one calendar day. */
export function emailDateBound(day: string, zone: string | null, exclusiveEnd = false): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (exclusiveEnd) date.setUTCDate(date.getUTCDate() + 1);
  const midnight = date.getTime();
  if (!zone) return date.toISOString();
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' });
  // Find the first instant of the date, including zones that skip midnight at DST.
  let start = midnight - 36 * 3_600_000;
  let end = midnight + 36 * 3_600_000;
  while (start < end) {
    const middle = Math.floor((start + end) / 2);
    const parts = Object.fromEntries(formatter.formatToParts(middle).map(({ type, value }) => [type, value]));
    const localDay = Date.UTC(+parts['year'], +parts['month'] - 1, +parts['day']);
    if (localDay < midnight) start = middle + 1;
    else end = middle;
  }
  return new Date(start).toISOString();
}
