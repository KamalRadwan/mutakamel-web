import { ApiError, fakeDelay, fakeId } from '../shared/settings-api';
import {
  CrmSourceRecord,
  EMAIL_PAGE_LIMIT,
  EmailDetail,
  EmailListFilter,
  EmailListPage,
  EmailOptionsRequest,
  EmailOptionsResponse,
  EmailPreviewRequest,
  EmailPreviewResponse,
  EmailRecipientOption,
  EmailRecipientReference,
  EmailRequesterSummary,
  EmailRow,
  EmailSourceType,
  EmailStatus,
  EmailTemplateOption,
  EmailTemplateSnapshot,
  EmailTimelineEvent,
  MAX_RANGE_DAYS,
  RETENTION_DAYS,
  RETRY_REASON_MAX,
  RetryEmailResult,
  SendEmailRequest,
  SendEmailResult,
  SenderStatusConfig,
} from './outbound-emails.model';

/** Set to false to preview the sender-not-ready state in the UI and compose modal. */
export const FAKE_SENDER_READY = true;
/** Set to false to preview the CRM_FEATURE_DISABLED (403) state. */
export const FAKE_FEATURE_ENABLED = true;
/** Set to false to preview the DEPENDENCY_UNAVAILABLE (503) state. */
export const FAKE_DEPENDENCY_AVAILABLE = true;

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const CURRENT_USER_ID = 'usr-1';
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const USER_PER_MINUTE_LIMIT = 30;
const USER_PER_DAY_LIMIT = 300;
const RECORD_RECIPIENT_PER_DAY_LIMIT = 5;
const CONTENT_MAX_BYTES = 512 * 1024;

// Source ids are UUIDs, as in the backend (`sourceId` is validated with @IsUUID).
const LEAD_1 = '0193f2a4-6c1e-7b3a-9d42-5e8a1c7f4a11';
const LEAD_2 = '0193f2a4-71d0-7c55-8e13-2b9d4f6a8c27';
const LEAD_3 = '0193f2a5-6b15-7c63-a2d8-4e9f1a7b3cf0';
const CUST_1 = '0193f2a5-0a3b-7d18-a6f4-7c2e9b1d3e52';
const CUST_2 = '0193f2a5-1f84-7e02-b5c9-3d7a6e8f0b6d';
const OPP_1 = '0193f2a5-3c27-7a49-8f61-9e4b2c5d7a83';
const OPP_2 = '0193f2a5-4e92-7b8c-9a37-1f6d8e2c4b9e';

const INELIGIBLE_RECORD_IDS = new Set([LEAD_3]);
const UNSENDABLE_TEMPLATE_IDS = new Set(['tpl-en-4', 'tpl-ar-4']);
const SUPPRESSED_CONTACT_IDS = new Set<string>(['cnt-suppressed']);
const RENDER_FAIL_TEMPLATE_IDS = new Set<string>();

const RECORDS: CrmSourceRecord[] = [
  { id: LEAD_1, type: 'LEAD', name: 'Al Noor Trading Co.' },
  { id: LEAD_2, type: 'LEAD', name: 'Delta Logistics' },
  { id: CUST_1, type: 'CUSTOMER_PROFILE', name: 'Nile Tech Solutions' },
  { id: CUST_2, type: 'CUSTOMER_PROFILE', name: 'Red Sea Contracting' },
  { id: OPP_1, type: 'OPPORTUNITY', name: 'Annual ERP Renewal - Cairo' },
  { id: OPP_2, type: 'OPPORTUNITY', name: 'Warehouse Expansion Rollout' },
  { id: LEAD_3, type: 'LEAD', name: 'Sphinx Imports' },
];

function primary(contactId: string, displayName: string, maskedAddress: string): EmailRecipientOption {
  return { reference: { kind: 'SOURCE_PRIMARY_CONTACT', contactId }, displayName, maskedAddress, isPrimary: true };
}

function partyContact(partyId: string, contactId: string, displayName: string, maskedAddress: string): EmailRecipientOption {
  return { reference: { kind: 'PARTY_CONTACT', partyId, contactId }, displayName, maskedAddress, isPrimary: false };
}

const RECIPIENTS_BY_RECORD: Record<string, EmailRecipientOption[]> = {
  [LEAD_1]: [
    primary('cnt-101', 'Karim Mansour', 'k***r@alnoor-trading.eg'),
    partyContact('pty-102', 'cnt-102', 'Heba El-Sayed', 'h***d@alnoor-trading.eg'),
  ],
  [LEAD_2]: [primary('cnt-201', 'Tarek Hassan', 't***n@deltalogistics.com')],
  [CUST_1]: [
    primary('cnt-301', 'Salma Ibrahim', 's***m@niletech.io'),
    partyContact('pty-302', 'cnt-302', 'Omar Farouk', 'o***k@niletech.io'),
  ],
  [CUST_2]: [
    primary('cnt-401', 'Mona Abdelrahman', 'm***n@redseacontracting.com'),
    partyContact('pty-402', 'cnt-suppressed', 'Omar Suppressed', 'o***r@redseacontracting.com'),
  ],
  [OPP_1]: [
    primary('cnt-501', 'Youssef Adel', 'y***l@cairocorp.eg'),
    partyContact('pty-502', 'cnt-502', 'Nadia Sami', 'n***i@cairocorp.eg'),
  ],
  [OPP_2]: [primary('cnt-601', 'Rami Khalil', 'r***l@warehouse-co.com')],
};

function templateOption(
  templateVersionId: string,
  code: string,
  name: string,
  versionNumber: number,
  locale: 'ar' | 'en',
  assigned = false,
): EmailTemplateOption {
  return {
    templateId: templateVersionId.replace('tpl-', 'tpd-'),
    templateVersionId,
    code,
    name,
    versionNumber,
    locale,
    direction: locale === 'ar' ? 'RTL' : 'LTR',
    selection: assigned ? 'EFFECTIVE_ASSIGNMENT' : 'ELIGIBLE_EXPLICIT',
    ...(assigned ? { assignmentId: templateVersionId.replace('tpl-', 'asg-') } : {}),
  };
}

const TEMPLATES: EmailTemplateOption[] = [
  templateOption('tpl-en-1', 'INTRO_WELCOME', 'Introductory welcome', 3, 'en', true),
  templateOption('tpl-en-2', 'PROPOSAL_FOLLOW_UP', 'Proposal follow-up', 2, 'en'),
  templateOption('tpl-en-3', 'RENEWAL_CHECK_IN', 'Renewal check-in', 1, 'en'),
  templateOption('tpl-en-4', 'SEASONAL_OFFER', 'Seasonal offer (draft)', 1, 'en'),
  templateOption('tpl-ar-1', 'INTRO_WELCOME', 'رسالة ترحيب تعريفية', 3, 'ar', true),
  templateOption('tpl-ar-2', 'PROPOSAL_FOLLOW_UP', 'متابعة عرض السعر', 2, 'ar'),
  templateOption('tpl-ar-3', 'RENEWAL_CHECK_IN', 'تذكير بتجديد الاشتراك', 1, 'ar'),
  templateOption('tpl-ar-4', 'SEASONAL_OFFER', 'عرض موسمي (مسودة)', 1, 'ar'),
];

const DATA_SOURCE_KEYS: Record<EmailSourceType, string> = {
  LEAD: 'CRM_LEAD_OUTBOUND_EMAIL_V1',
  CUSTOMER_PROFILE: 'CRM_CUSTOMER_OUTBOUND_EMAIL_V1',
  OPPORTUNITY: 'CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1',
};

/** The backend upper-cases the stored provider name into `provider.kind`. */
const PROVIDER_KINDS = ['SES', 'SENDGRID', 'PLATFORM-SHARED'] as const;

const REQUESTERS: EmailRequesterSummary[] = [
  { id: 'usr-1', displayName: 'Kamal Nabil' },
  { id: 'usr-2', displayName: 'Nourhan Adel' },
  { id: 'usr-3', displayName: 'Sherif Gamal' },
];

/** The backend sends the failure code only (no message); EMAIL.DELIVERY_FAILED is its default. */
const FAILURE_CODES = [
  'EMAIL.DELIVERY_FAILED',
  'PROVIDER_REJECTED',
  'MAILBOX_FULL',
  'DOMAIN_LOOKUP_FAILED',
  'PROVIDER_THROTTLED',
  'TLS_HANDSHAKE_FAILED',
];

const SUBJECTS = [
  'Welcome to Mutakamel CRM onboarding',
  'Follow-up on Q4 pricing proposal',
  'Contract renewal schedule for next quarter',
  'Requested product specification sheet',
  'Meeting summary and next milestones',
  'Updated implementation timeline',
  'Account onboarding checklist',
  'Quarterly executive review invitation',
];

const SENDER = {
  displayName: 'Mutakamel Sales',
  maskedAddress: 's***s@mutakamel.ai',
  maskedReplyTo: 'r***y@mutakamel.ai',
};
const SENDER_CONFIG_REVISION = 3;
const RETENTION_POLICY_REVISION = 1;

/**
 * One stored email. `detail` is what GET /:id returns; the list row is built from it
 * plus `requestedBy`, which the list sends and the detail does not.
 */
interface FakeEmail {
  detail: EmailDetail;
  requestedBy: EmailRequesterSummary;
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

function buildHtml(subject: string, recipientName: string, recordName: string): string {
  return [
    '<div style="font-family:Arial,sans-serif;color:#12141c;line-height:1.5;padding:16px;">',
    `<h2 style="margin:0 0 12px;font-size:16px;color:#0f2f78;">${subject}</h2>`,
    `<p style="margin:0 0 10px;">Hello ${recipientName},</p>`,
    `<p style="margin:0 0 10px;">Thank you for speaking with our team regarding <strong>${recordName}</strong>. Please find the latest details summarized below.</p>`,
    '<p style="margin:0 0 16px;">Reply directly to this email if you would like to schedule a follow-up call this week.</p>',
    '<p style="margin:0;color:#5b6072;font-size:12px;">Best regards,<br/>Mutakamel CRM Team</p>',
    '</div>',
  ].join('');
}

function buildText(subject: string, recipientName: string, recordName: string): string {
  return `${subject}\n\nHello ${recipientName},\n\nThank you for speaking with our team regarding ${recordName}.\nReply directly if you would like to schedule a follow-up call.\n\nBest regards,\nMutakamel CRM Team`;
}

function fakeChecksum(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `sha256:${hash.toString(16).padStart(8, '0').repeat(8)}`;
}

function templateSnapshot(template: EmailTemplateOption, sourceType: EmailSourceType): EmailTemplateSnapshot {
  return {
    templateDefinitionId: template.templateId,
    templateVersionId: template.templateVersionId,
    versionNumber: template.versionNumber,
    documentType: 'CRM_OUTBOUND_EMAIL',
    outputChannel: 'EMAIL',
    layoutMode: 'EMAIL_FLOW',
    locale: template.locale,
    direction: template.direction,
    dataSourceKey: DATA_SOURCE_KEYS[sourceType],
    dataSourceSchemaVersion: 1,
    dataSourceSchemaChecksum: fakeChecksum(`schema:${sourceType}`),
    templateContentChecksum: fakeChecksum(`content:${template.templateVersionId}`),
    compiledChecksum: fakeChecksum(`compiled:${template.templateVersionId}`),
    compilerFingerprint: 'template-compiler/1',
    lifecycleStatus: 'PUBLISHED',
  };
}

function seedEmails(): FakeEmail[] {
  const list: FakeEmail[] = [];
  const seedRecords = RECORDS.filter((record) => !INELIGIBLE_RECORD_IDS.has(record.id));
  const seedTemplates = TEMPLATES.filter((template) => !UNSENDABLE_TEMPLATE_IDS.has(template.templateVersionId));

  for (let i = 0; i < 40; i++) {
    const id = `eml-${String(i + 1).padStart(3, '0')}`;
    const record = seedRecords[i % seedRecords.length];
    const recipients = RECIPIENTS_BY_RECORD[record.id];
    const recipient = recipients[i % recipients.length];
    const template = seedTemplates[i % seedTemplates.length];
    const requester = REQUESTERS[i % REQUESTERS.length];

    // Spread over the last 60 days; make 3 old ones redacted.
    const isRedacted = i >= 37;
    const daysOffset = isRedacted ? 45 + (i - 36) * 4 : Math.floor((i * 55) / 37);
    const requestedAt = hoursAgo(daysOffset * 24 + (i % 12) + 1);
    const reqMs = Date.parse(requestedAt);

    let status: EmailStatus = 'SENT';
    if (i === 0 || i === 3) status = 'QUEUED';
    else if (i === 1 || i === 4) status = 'DISPATCHING';
    else if (i === 5 || i === 9 || i === 14 || i === 20 || i === 26 || i === 32) status = 'FAILED';

    const subject = `${SUBJECTS[i % SUBJECTS.length]} — ${record.name}`;
    const preheader = `Update regarding ${record.name}`;

    const timeline: EmailTimelineEvent[] = [{ state: 'QUEUED', occurredAt: requestedAt }];
    let sentAt: string | null = null;
    let failedAt: string | null = null;
    let failure: EmailDetail['failure'] = null;
    let provider: EmailDetail['provider'] = null;
    const feedback: EmailDetail['feedback'] = [];

    if (status === 'DISPATCHING') {
      timeline.push({ state: 'DISPATCHING', occurredAt: new Date(reqMs + 18_000).toISOString() });
    } else if (status === 'SENT') {
      const dispAt = new Date(reqMs + 15_000).toISOString();
      sentAt = new Date(reqMs + 42_000).toISOString();
      provider = {
        kind: PROVIDER_KINDS[i % PROVIDER_KINDS.length],
        submissionReference: `0100019${String(i).padStart(3, '0')}a7c4e2f1-${id}`,
      };
      timeline.push({ state: 'DISPATCHING', occurredAt: dispAt }, { state: 'SENT', occurredAt: sentAt });
    } else if (status === 'FAILED') {
      const dispAt = new Date(reqMs + 14_000).toISOString();
      failedAt = new Date(reqMs + 55_000).toISOString();
      const failureIdx = [5, 9, 14, 20, 26, 32].indexOf(i);
      failure = { code: FAILURE_CODES[failureIdx], automaticRetryExhausted: true, failedAt };
      timeline.push({ state: 'DISPATCHING', occurredAt: dispAt }, { state: 'FAILED', occurredAt: failedAt });
    }

    // Delivery feedback on sent emails: one hard bounce, one soft bounce, one complaint.
    if (i === 7 || i === 18 || i === 24) {
      const occurredAt = new Date(reqMs + 180_000).toISOString();
      const complaint = i === 24;
      feedback.push({
        type: complaint ? 'COMPLAINT' : 'BOUNCE',
        occurredAt,
        reasonCode: complaint ? 'COMPLAINT' : i === 7 ? 'HARD_BOUNCE' : 'SOFT_BOUNCE',
        suppressionApplied: false,
      });
      timeline.push({ state: complaint ? 'COMPLAINED' : 'BOUNCED', occurredAt });
    }

    const rowRetentionDays = isRedacted ? 30 : RETENTION_DAYS;
    const retentionUntil = new Date(reqMs + rowRetentionDays * DAY_MS).toISOString();
    const html = buildHtml(subject, recipient.displayName, record.name);

    list.push({
      requestedBy: requester,
      detail: {
        outboundEmailId: id,
        activityId: `act-${String(i + 1).padStart(3, '0')}`,
        sourceType: record.type,
        sourceId: record.id,
        template: templateSnapshot(template, record.type),
        recipient: { displayName: recipient.displayName, maskedAddress: recipient.maskedAddress, kind: 'TO' },
        sender: { ...SENDER, maskedReplyTo: i % 4 === 0 ? null : SENDER.maskedReplyTo },
        senderConfigRevision: SENDER_CONFIG_REVISION,
        content: isRedacted
          ? { state: 'REDACTED_BY_RETENTION', redactedAt: retentionUntil }
          : {
              state: 'AVAILABLE',
              subject,
              preheader,
              html,
              text: buildText(subject, recipient.displayName, record.name),
              contentChecksum: fakeChecksum(html),
            },
        status,
        statusRevision: timeline.length,
        provider,
        failure,
        feedback,
        timeline,
        requestedAt,
        sentAt,
        failedAt,
        retryOfId: null,
        retriedById: null,
        contentRetentionDays: rowRetentionDays,
        contentRetentionUntil: retentionUntil,
        contentRetentionPolicyRevision: RETENTION_POLICY_REVISION,
      },
    });
  }

  // Link 1 failed email (index 9: eml-010) already retried by a newer email (index 2: eml-003).
  // As in the backend, the retry's first event is RETRY_REQUESTED (not QUEUED).
  const retriedOriginal = list[9].detail;
  const retryChild = list[2].detail;
  retriedOriginal.retriedById = retryChild.outboundEmailId;
  retryChild.retryOfId = retriedOriginal.outboundEmailId;
  retryChild.sourceType = retriedOriginal.sourceType;
  retryChild.sourceId = retriedOriginal.sourceId;
  retryChild.recipient = { ...retriedOriginal.recipient };
  retryChild.template = { ...retriedOriginal.template };
  retryChild.timeline[0] = { state: 'RETRY_REQUESTED', occurredAt: retryChild.requestedAt };
  if (retryChild.content.state === 'AVAILABLE' && retriedOriginal.content.state === 'AVAILABLE') {
    retryChild.content = { ...retriedOriginal.content };
  }

  return list.sort((a, b) => Date.parse(b.detail.requestedAt) - Date.parse(a.detail.requestedAt));
}

const emails: FakeEmail[] = seedEmails();
const retryIdempotencyCache = new Map<string, { fingerprint: string; result: RetryEmailResult }>();
const sendIdempotencyCache = new Map<string, { fingerprint: string; result: SendEmailResult }>();
const sendLog: Array<{ at: number; userId: string; recipientKey: string }> = [];

function assertFeatureEnabled(): void {
  if (!FAKE_FEATURE_ENABLED) {
    throw new ApiError(403, 'CRM_FEATURE_DISABLED');
  }
}

function assertDependencyAvailable(): void {
  if (!FAKE_DEPENDENCY_AVAILABLE) {
    throw new ApiError(503, 'CRM.EMAIL.DEPENDENCY_UNAVAILABLE');
  }
}

function sameReference(a: EmailRecipientReference, b: EmailRecipientReference): boolean {
  return a.kind === b.kind && a.partyId === b.partyId && a.contactId === b.contactId;
}

function recipientKeyOf(req: Pick<EmailPreviewRequest, 'sourceType' | 'sourceId' | 'recipient'>): string {
  return `${req.sourceType}:${req.sourceId}:${req.recipient.kind}:${req.recipient.partyId ?? ''}:${req.recipient.contactId ?? ''}`;
}

function enforceRateLimits(req: SendEmailRequest, nowMs: number): void {
  const dayCutoff = nowMs - DAY_MS;
  while (sendLog.length > 0 && sendLog[0].at <= dayCutoff) {
    sendLog.shift();
  }

  const userMinute = sendLog.filter((entry) => entry.userId === CURRENT_USER_ID && nowMs - entry.at < MINUTE_MS);
  if (userMinute.length >= USER_PER_MINUTE_LIMIT) {
    const retryAfterSeconds = Math.max(1, Math.ceil((userMinute[0].at + MINUTE_MS - nowMs) / 1000));
    throw new ApiError(429, 'CRM.EMAIL.SEND_RATE_LIMITED', { retryAfterSeconds });
  }

  const userDay = sendLog.filter((entry) => entry.userId === CURRENT_USER_ID && nowMs - entry.at < DAY_MS);
  if (userDay.length >= USER_PER_DAY_LIMIT) {
    const retryAfterSeconds = Math.max(1, Math.ceil((userDay[0].at + DAY_MS - nowMs) / 1000));
    throw new ApiError(429, 'CRM.EMAIL.SEND_RATE_LIMITED', { retryAfterSeconds });
  }

  const recKey = recipientKeyOf(req);
  const recordRecipientDay = sendLog.filter((entry) => entry.recipientKey === recKey && nowMs - entry.at < DAY_MS);
  if (recordRecipientDay.length >= RECORD_RECIPIENT_PER_DAY_LIMIT) {
    const retryAfterSeconds = Math.max(1, Math.ceil((recordRecipientDay[0].at + DAY_MS - nowMs) / 1000));
    throw new ApiError(429, 'CRM.EMAIL.SEND_RATE_LIMITED', { retryAfterSeconds });
  }
}

/** Same projection as the backend `listProjection`: the subject is cut to 160 characters and is null once removed. */
function toRow({ detail, requestedBy }: FakeEmail): EmailRow {
  return {
    outboundEmailId: detail.outboundEmailId,
    activityId: detail.activityId,
    sourceType: detail.sourceType,
    sourceId: detail.sourceId,
    templateDefinitionId: detail.template.templateDefinitionId,
    templateVersionId: detail.template.templateVersionId,
    templateVersionNumber: detail.template.versionNumber,
    recipient: { displayName: detail.recipient.displayName, maskedAddress: detail.recipient.maskedAddress },
    subjectPreview: detail.content.state === 'AVAILABLE' ? [...detail.content.subject].slice(0, 160).join('') : null,
    status: detail.status,
    statusRevision: detail.statusRevision,
    requestedAt: detail.requestedAt,
    sentAt: detail.sentAt,
    failedAt: detail.failedAt,
    requestedBy: { ...requestedBy },
    retryOfId: detail.retryOfId,
  };
}

function cloneDetail(detail: EmailDetail): EmailDetail {
  return {
    ...detail,
    template: { ...detail.template },
    recipient: { ...detail.recipient },
    sender: { ...detail.sender },
    content: { ...detail.content },
    provider: detail.provider ? { ...detail.provider } : null,
    failure: detail.failure ? { ...detail.failure } : null,
    feedback: detail.feedback.map((item) => ({ ...item })),
    timeline: detail.timeline.map((item) => ({ ...item })),
  };
}

function findEmail(id: string): FakeEmail | undefined {
  return emails.find((item) => item.detail.outboundEmailId === id);
}

export async function fakeSenderStatus(): Promise<SenderStatusConfig> {
  await fakeDelay(180);
  const status = FAKE_SENDER_READY ? 'ACTIVE' : 'SUSPENDED';
  const dkimVerified = FAKE_SENDER_READY;
  const providerCredentialsConfigured = FAKE_SENDER_READY;
  const providerDriver = FAKE_SENDER_READY ? 'ses' : 'smtp';
  const canSendCrm = status === 'ACTIVE' && dkimVerified && providerCredentialsConfigured && providerDriver !== 'smtp';
  return {
    status,
    fromName: 'Mutakamel Sales',
    fromAddress: 'sales@mutakamel.ai',
    providerDriver,
    dkimVerified,
    providerCredentialsConfigured,
    canSendCrm,
  };
}

export async function fakeListSourceRecords(type?: EmailSourceType): Promise<CrmSourceRecord[]> {
  await fakeDelay(120);
  const items = type ? RECORDS.filter((item) => item.type === type) : RECORDS;
  return items.map((item) => ({ ...item }));
}

export async function fakeListEmails(filter: EmailListFilter, cursor?: string | null): Promise<EmailListPage> {
  await fakeDelay(260);
  assertFeatureEnabled();

  if (filter.requestedFrom && filter.requestedTo) {
    const fromMs = Date.parse(filter.requestedFrom);
    const toMs = Date.parse(filter.requestedTo);
    if (Number.isNaN(fromMs) || Number.isNaN(toMs) || fromMs >= toMs || toMs - fromMs > (MAX_RANGE_DAYS + 1) * DAY_MS) {
      throw new ApiError(400, 'CRM_VALIDATION_FAILED');
    }
  }

  const fromMs = filter.requestedFrom ? Date.parse(filter.requestedFrom) : null;
  const toMs = filter.requestedTo ? Date.parse(filter.requestedTo) : null;

  const filtered = emails.filter(({ detail: item }) => {
    if (filter.status && item.status !== filter.status) return false;
    if (filter.sourceType && item.sourceType !== filter.sourceType) return false;
    if (filter.sourceId && item.sourceId !== filter.sourceId) return false;
    const requestedMs = Date.parse(item.requestedAt);
    if (fromMs !== null && !Number.isNaN(fromMs) && requestedMs < fromMs) return false;
    if (toMs !== null && !Number.isNaN(toMs) && requestedMs > toMs) return false;
    return true;
  });

  const offset = cursor ? Math.max(0, Number.parseInt(cursor, 10) || 0) : 0;
  const slice = filtered.slice(offset, offset + EMAIL_PAGE_LIMIT);
  const nextOffset = offset + slice.length;
  const hasNext = nextOffset < filtered.length;

  return {
    items: slice.map(toRow),
    nextCursor: hasNext ? String(nextOffset) : null,
    hasNext,
    limit: EMAIL_PAGE_LIMIT,
  };
}

export async function fakeGetEmail(id: string): Promise<EmailDetail> {
  await fakeDelay(220);
  assertFeatureEnabled();
  const found = findEmail(id);
  if (!found) {
    throw new ApiError(404, 'CRM.EMAIL.SOURCE_NOT_FOUND');
  }
  return cloneDetail(found.detail);
}

export async function fakeRetryEmail(id: string, reason: string, idempotencyKey: string): Promise<RetryEmailResult> {
  await fakeDelay(300);
  assertFeatureEnabled();

  const trimmed = reason.trim();
  const fingerprint = JSON.stringify({ id, reason: trimmed });
  const cached = retryIdempotencyCache.get(idempotencyKey);
  if (cached) {
    if (cached.fingerprint !== fingerprint) {
      throw new ApiError(422, 'CRM.EMAIL.IDEMPOTENCY_MISMATCH');
    }
    return { ...cached.result };
  }

  assertDependencyAvailable();

  if (!trimmed || trimmed.length > RETRY_REASON_MAX || CONTROL_CHARS.test(trimmed)) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED');
  }

  const original = findEmail(id)?.detail;
  if (!original) {
    throw new ApiError(404, 'CRM.EMAIL.SOURCE_NOT_FOUND');
  }
  if (original.retriedById) {
    throw new ApiError(409, 'CRM.EMAIL.RETRY_ALREADY_CREATED', {
      existingOutboundEmailId: original.retriedById,
    });
  }
  if (original.status !== 'FAILED' || original.content.state !== 'AVAILABLE') {
    throw new ApiError(409, 'CRM.EMAIL.RETRY_NOT_ALLOWED');
  }

  const now = new Date().toISOString();
  const newId = fakeId();
  emails.unshift({
    requestedBy: { id: CURRENT_USER_ID, displayName: 'Kamal Nabil' },
    detail: {
      ...cloneDetail(original),
      outboundEmailId: newId,
      status: 'QUEUED',
      statusRevision: 1,
      provider: null,
      failure: null,
      feedback: [],
      // The backend writes RETRY_REQUESTED as the retry's first event.
      timeline: [{ state: 'RETRY_REQUESTED', occurredAt: now }],
      requestedAt: now,
      sentAt: null,
      failedAt: null,
      retryOfId: original.outboundEmailId,
      retriedById: null,
      contentRetentionDays: RETENTION_DAYS,
      contentRetentionUntil: new Date(Date.now() + RETENTION_DAYS * DAY_MS).toISOString(),
    },
  });
  original.retriedById = newId;

  const result: RetryEmailResult = { outboundEmailId: newId, status: 'QUEUED' };
  retryIdempotencyCache.set(idempotencyKey, { fingerprint, result });
  return { ...result };
}

export async function fakeEmailOptions(req: EmailOptionsRequest): Promise<EmailOptionsResponse> {
  await fakeDelay(240);
  assertFeatureEnabled();

  if (!FAKE_SENDER_READY) {
    throw new ApiError(422, 'CRM.EMAIL.SENDER_UNVERIFIED');
  }

  const record = RECORDS.find((item) => item.id === req.sourceId && item.type === req.sourceType);
  if (!record) {
    throw new ApiError(404, 'CRM.EMAIL.SOURCE_NOT_FOUND');
  }
  if (INELIGIBLE_RECORD_IDS.has(record.id)) {
    throw new ApiError(422, 'CRM.EMAIL.SOURCE_INELIGIBLE');
  }

  const recipients = (RECIPIENTS_BY_RECORD[record.id] ?? [])
    .slice(0, 50)
    .map((item) => ({ ...item, reference: { ...item.reference } }));
  const resolvedLocale = req.locale ?? 'en';
  const templates = TEMPLATES.filter((item) => item.locale === resolvedLocale).map((item) => ({ ...item }));
  const availability: EmailOptionsResponse['availability'] = [];
  if (recipients.length === 0) availability.push('NO_APPROVED_RECIPIENT');
  if (templates.length === 0) availability.push('NO_COMPATIBLE_TEMPLATE');

  return {
    sourceType: record.type,
    sourceId: record.id,
    resolvedLocale,
    recipients,
    templates,
    assignedTemplateVersionId:
      templates.find((item) => item.selection === 'EFFECTIVE_ASSIGNMENT')?.templateVersionId ?? null,
    availability,
  };
}

function resolvePreviewInputs(req: EmailPreviewRequest): {
  record: CrmSourceRecord;
  template: EmailTemplateOption;
  recipient: EmailRecipientOption;
} {
  if (!FAKE_SENDER_READY) {
    throw new ApiError(422, 'CRM.EMAIL.SENDER_UNVERIFIED');
  }

  const record = RECORDS.find((item) => item.id === req.sourceId && item.type === req.sourceType);
  const template = TEMPLATES.find((item) => item.templateVersionId === req.templateVersionId);
  if (!record || !template) {
    throw new ApiError(404, 'CRM.EMAIL.SOURCE_NOT_FOUND');
  }
  if (INELIGIBLE_RECORD_IDS.has(record.id)) {
    throw new ApiError(422, 'CRM.EMAIL.SOURCE_INELIGIBLE');
  }
  if (UNSENDABLE_TEMPLATE_IDS.has(template.templateVersionId)) {
    throw new ApiError(422, 'CRM.EMAIL.TEMPLATE_NOT_SENDABLE');
  }
  if (RENDER_FAIL_TEMPLATE_IDS.has(template.templateVersionId)) {
    throw new ApiError(422, 'CRM.EMAIL.TEMPLATE_RENDER_FAILED');
  }

  const recipients = RECIPIENTS_BY_RECORD[record.id] ?? [];
  const recipient = recipients.find((item) => sameReference(item.reference, req.recipient));
  if (!recipient) {
    throw new ApiError(422, 'CRM.EMAIL.RECIPIENT_INVALID');
  }
  if (recipient.reference.contactId && SUPPRESSED_CONTACT_IDS.has(recipient.reference.contactId)) {
    throw new ApiError(422, 'CRM.EMAIL.RECIPIENT_SUPPRESSED');
  }

  return { record, template, recipient };
}

function renderPreviewContent(
  req: EmailPreviewRequest,
  record: CrmSourceRecord,
  template: EmailTemplateOption,
  recipient: EmailRecipientOption,
): EmailPreviewResponse {
  const subject = `${template.name} — ${record.name}`;
  const preheader = req.locale === 'ar' ? `تحديث بخصوص ${record.name}` : `Update regarding ${record.name}`;
  const bodyHtml =
    req.locale === 'ar'
      ? [
          '<div dir="rtl" style="font-family:Tajawal,Arial,sans-serif;color:#12141c;line-height:1.6;padding:16px;">',
          `<h2 style="margin:0 0 12px;font-size:16px;color:#0f2f78;">${subject}</h2>`,
          `<p style="margin:0 0 10px;">مرحبًا ${recipient.displayName}،</p>`,
          `<p style="margin:0 0 10px;">نود مشاركة أحدث المستجدات الخاصة بسجل <strong>${record.name}</strong> وفق قالب <strong>${template.name}</strong>.</p>`,
          '<p style="margin:0 0 16px;">يمكنك الرد مباشرة على هذه الرسالة لتنسيق الخطوة التالية.</p>',
          '<p style="margin:0;color:#5b6072;font-size:12px;">مع أطيب التحيات،<br/>فريق متكامل</p>',
          '</div>',
        ].join('')
      : buildHtml(subject, recipient.displayName, record.name);

  const bodyText =
    req.locale === 'ar'
      ? `${subject}\n\nمرحبًا ${recipient.displayName}،\n\nنود مشاركة أحدث المستجدات الخاصة بسجل ${record.name}.\n\nمع أطيب التحيات،\nفريق متكامل`
      : buildText(subject, recipient.displayName, record.name);

  if (new TextEncoder().encode(bodyHtml).length > CONTENT_MAX_BYTES) {
    throw new ApiError(422, 'CRM.EMAIL.CONTENT_LIMIT_EXCEEDED');
  }

  return { subject, preheader, bodyHtml, bodyText };
}

export async function fakeEmailPreview(req: EmailPreviewRequest): Promise<EmailPreviewResponse> {
  await fakeDelay(240);
  assertFeatureEnabled();
  const { record, template, recipient } = resolvePreviewInputs(req);
  return renderPreviewContent(req, record, template, recipient);
}

export async function fakeSendEmail(req: SendEmailRequest, idempotencyKey: string): Promise<SendEmailResult> {
  await fakeDelay(320);
  assertFeatureEnabled();

  const fingerprint = JSON.stringify(req);
  const cached = sendIdempotencyCache.get(idempotencyKey);
  if (cached) {
    if (cached.fingerprint !== fingerprint) {
      throw new ApiError(422, 'CRM.EMAIL.IDEMPOTENCY_MISMATCH');
    }
    return { ...cached.result };
  }

  assertDependencyAvailable();

  const { record, template, recipient } = resolvePreviewInputs(req);
  const preview = renderPreviewContent(req, record, template, recipient);
  const nowMs = Date.now();
  enforceRateLimits(req, nowMs);
  sendLog.push({ at: nowMs, userId: CURRENT_USER_ID, recipientKey: recipientKeyOf(req) });

  const now = new Date(nowMs).toISOString();
  const outboundEmailId = fakeId();
  const activityId = fakeId();

  emails.unshift({
    requestedBy: { id: CURRENT_USER_ID, displayName: 'Kamal Nabil' },
    detail: {
      outboundEmailId,
      activityId,
      sourceType: record.type,
      sourceId: record.id,
      template: templateSnapshot(template, record.type),
      recipient: { displayName: recipient.displayName, maskedAddress: recipient.maskedAddress, kind: 'TO' },
      sender: { ...SENDER },
      senderConfigRevision: SENDER_CONFIG_REVISION,
      content: {
        state: 'AVAILABLE',
        subject: preview.subject,
        preheader: preview.preheader,
        html: preview.bodyHtml,
        text: preview.bodyText,
        contentChecksum: fakeChecksum(preview.bodyHtml),
      },
      status: 'QUEUED',
      statusRevision: 1,
      provider: null,
      failure: null,
      feedback: [],
      timeline: [{ state: 'QUEUED', occurredAt: now }],
      requestedAt: now,
      sentAt: null,
      failedAt: null,
      retryOfId: null,
      retriedById: null,
      contentRetentionDays: RETENTION_DAYS,
      contentRetentionUntil: new Date(nowMs + RETENTION_DAYS * DAY_MS).toISOString(),
      contentRetentionPolicyRevision: RETENTION_POLICY_REVISION,
    },
  });

  const result: SendEmailResult = { outboundEmailId, activityId, status: 'QUEUED' };
  sendIdempotencyCache.set(idempotencyKey, { fingerprint, result });
  return { ...result };
}
