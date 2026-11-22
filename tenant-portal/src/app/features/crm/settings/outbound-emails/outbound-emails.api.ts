import {
  fakeEmailOptions,
  fakeEmailPreview,
  fakeGetEmail,
  fakeListEmails,
  fakeListSourceRecords,
  fakeRetryEmail,
  fakeSendEmail,
  fakeSenderStatus,
} from './outbound-emails.fake';
import {
  CrmSourceRecord,
  EmailDetail,
  EmailListFilter,
  EmailListPage,
  EmailOptionsRequest,
  EmailOptionsResponse,
  EmailPreviewRequest,
  EmailPreviewResponse,
  EmailSourceType,
  RetryEmailResult,
  SendEmailRequest,
  SendEmailResult,
  SenderStatusConfig,
} from './outbound-emails.model';

/** Real endpoint: GET /api/tenant/core/v1/email-config (requires permission workspace.email.read). */
export function senderStatus(): Promise<SenderStatusConfig> {
  return fakeSenderStatus();
}

/** Real endpoint: CRM Leads / Customers / Opportunities lookup for outbound email composition & filtering. */
export function listSourceRecords(type?: EmailSourceType): Promise<CrmSourceRecord[]> {
  return fakeListSourceRecords(type);
}

/** Real endpoint: GET /api/tenant/crm/v1/outbound-emails?status&sourceType&sourceId&requestedFrom&requestedTo&cursor&limit=25. */
export function listEmails(filter: EmailListFilter, cursor?: string | null): Promise<EmailListPage> {
  return fakeListEmails(filter, cursor);
}

/** Real endpoint: GET /api/tenant/crm/v1/outbound-emails/:id. */
export function getEmail(id: string): Promise<EmailDetail> {
  return fakeGetEmail(id);
}

/** Real endpoint: POST /api/tenant/crm/v1/outbound-emails/:id/retry (with x-idempotency-key header). */
export function retryEmail(id: string, reason: string, idempotencyKey: string): Promise<RetryEmailResult> {
  return fakeRetryEmail(id, reason, idempotencyKey);
}

/** Real endpoint: POST /api/tenant/crm/v1/outbound-emails/options. */
export function emailOptions(body: EmailOptionsRequest): Promise<EmailOptionsResponse> {
  return fakeEmailOptions(body);
}

/** Real endpoint: POST /api/tenant/crm/v1/outbound-emails/preview. */
export function emailPreview(body: EmailPreviewRequest): Promise<EmailPreviewResponse> {
  return fakeEmailPreview(body);
}

/** Real endpoint: POST /api/tenant/crm/v1/outbound-emails (with x-idempotency-key header). */
export function sendEmail(body: SendEmailRequest, idempotencyKey: string): Promise<SendEmailResult> {
  return fakeSendEmail(body, idempotencyKey);
}
