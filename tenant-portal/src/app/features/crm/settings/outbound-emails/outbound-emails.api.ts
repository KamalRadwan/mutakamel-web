import { inject } from '@angular/core';
import { CoreHttp } from '../../../../core/api/core-http';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { crmHttp, crmQueries } from '../../shared/crm-http';
import { searchSourceRecords } from './source-lookup';
import { requestEmailData } from './outbound-email-request.api';
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
  EMAIL_PAGE_LIMIT,
} from './outbound-emails.model';

const queryKey = ['crm-settings', 'outbound-emails'] as const;

async function refreshEmails(): Promise<void> {
  await crmQueries().cancelQueries({ queryKey });
  await crmQueries().invalidateQueries({ queryKey });
}

/** Real endpoint: GET /api/tenant/core/v1/email-config (requires permission workspace.email.read). */
export function senderStatus(): Promise<SenderStatusConfig> {
  const http = inject(CoreHttp);
  return crmQueries().fetchQuery({ queryKey: [...queryKey, 'sender'], queryFn: async () => {
    const config = await http.read<Omit<SenderStatusConfig, 'canSendCrm'>>('/api/tenant/core/v1/email-config');
    return { ...config, canSendCrm: config.status === 'ACTIVE' && config.dkimVerified &&
      config.providerCredentialsConfigured && config.feedbackProfile === 'CRM_FEEDBACK_V1' };
  } });
}

/** Real endpoint: CRM Leads / Customers / Opportunities lookup for outbound email composition & filtering. */
export function listSourceRecords(type?: EmailSourceType): Promise<CrmSourceRecord[]> {
  const branchId = inject(TenantScopeState).selection()?.branchId;
  return branchId && type ? searchSourceRecords(type, branchId, '', 1) : Promise.resolve([]);
}

/** Real endpoint: GET /api/tenant/crm/v1/outbound-emails?status&sourceType&sourceId&requestedFrom&requestedTo&cursor&limit=25. */
export function listEmails(filter: EmailListFilter, cursor?: string | null): Promise<EmailListPage> {
  return crmQueries().fetchQuery({ queryKey: [...queryKey, 'list', filter, cursor],
    queryFn: () => crmHttp().read('/outbound-emails', { ...filter, cursor, limit: EMAIL_PAGE_LIMIT }) });
}

/** Real endpoint: GET /api/tenant/crm/v1/outbound-emails/:id. */
export function getEmail(id: string): Promise<EmailDetail> {
  return crmQueries().fetchQuery({ queryKey: [...queryKey, 'detail', id],
    queryFn: () => crmHttp().read(`/outbound-emails/${encodeURIComponent(id)}`) });
}

/** Real endpoint: POST /api/tenant/crm/v1/outbound-emails/:id/retry (with x-idempotency-key header). */
export async function retryEmail(id: string, reason: string, idempotencyKey: string): Promise<RetryEmailResult> {
  const result = await crmHttp().write<RetryEmailResult>('POST', `/outbound-emails/${encodeURIComponent(id)}/retry`,
    { reason }, { key: idempotencyKey });
  await refreshEmails();
  return result.data;
}

/** Real endpoint: POST /api/tenant/crm/v1/outbound-emails/options. */
export async function emailOptions(body: EmailOptionsRequest): Promise<EmailOptionsResponse> {
  return crmQueries().fetchQuery({ queryKey: [...queryKey, 'options', body],
    queryFn: () => requestEmailData('/outbound-emails/options', body) });
}

/** Real endpoint: POST /api/tenant/crm/v1/outbound-emails/preview. */
export async function emailPreview(body: EmailPreviewRequest): Promise<EmailPreviewResponse> {
  return crmQueries().fetchQuery({ queryKey: [...queryKey, 'preview', body],
    queryFn: () => requestEmailData('/outbound-emails/preview', body) });
}

/** Real endpoint: POST /api/tenant/crm/v1/outbound-emails (with x-idempotency-key header). */
export async function sendEmail(body: SendEmailRequest, idempotencyKey: string): Promise<SendEmailResult> {
  const result = await crmHttp().write<SendEmailResult>('POST', '/outbound-emails', body, { key: idempotencyKey });
  await refreshEmails();
  return result.data;
}
